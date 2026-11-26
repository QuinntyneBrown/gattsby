// Validates every knowledge-base data file and writes the merged, normalised
// src/knowledge-base/generated/knowledge-base.json (maintain-the-knowledge-base design). Runs
// before every build, serve and unit test run, and in CI's lint step. Fails with
// `file: JSON pointer: message` for each problem.

import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const DECODER_IDS: string[] = JSON.parse(
  readFileSync(
    join(import.meta.dirname, '..', 'src', 'app', 'knowledge-base', 'decoders', 'decoder-ids.json'),
    'utf8',
  ),
);
const BASE_SUFFIX = '-0000-1000-8000-00805f9b34fb';
const KINDS = [
  'manifest',
  'blocklist',
  'standard-service',
  'vendor',
  'brand-suggestions',
  'command-set',
  'control-limits',
  'encoding-ranges',
];
const FTMS_COMMANDS = new Map([
  ['requestControl', 0],
  ['reset', 1],
  ['setTargetSpeed', 2],
  ['setTargetIncline', 3],
  ['setTargetResistance', 4],
  ['setTargetPower', 5],
  ['start', 7],
  ['stop', 8],
]);

type Json = Record<string, unknown>;

export function canonical(uuid: string): string {
  return /^0x[0-9a-f]{4}$/.test(uuid) ? `0000${uuid.slice(2)}${BASE_SUFFIX}` : uuid;
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'generated' ? [] : files(path);
    return name.endsWith('.json') && name !== 'knowledge-base.schema.json' ? [path] : [];
  });
}

export function buildKnowledgeBase(dir: string): { errors: string[]; output: Json | null } {
  const errors: string[] = [];
  const schema = JSON.parse(readFileSync(join(dir, 'knowledge-base.schema.json'), 'utf8'));
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  ajv.addSchema(schema);
  const byKind = new Map<string, { path: string; data: Json }[]>();

  for (const path of files(dir).sort()) {
    const name = relative(dir, path);
    let data: Json;
    try {
      data = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      errors.push(`${name}: : ${(error as Error).message}`);
      continue;
    }
    const kind = String(data['kind']);
    if (!KINDS.includes(kind)) {
      errors.push(`${name}: /kind: unknown kind "${kind}"`);
      continue;
    }
    const validate = ajv.getSchema(`${schema.$id}#/$defs/${kind}`)!;
    if (!validate(data)) {
      for (const e of validate.errors ?? [])
        errors.push(`${name}: ${e.instancePath}: ${e.message}`);
      continue;
    }
    const sources = (data['sources'] ?? {}) as Json;
    const check = (items: unknown, pointer: string) =>
      ((items as Json[] | undefined) ?? []).forEach((item, i) => {
        if (!(String(item['source']) in sources)) {
          errors.push(`${name}: ${pointer}/${i}/source: no source "${item['source']}" in sources`);
        }
      });
    if (kind === 'vendor' || kind === 'blocklist') {
      for (const key of [
        'services',
        'characteristics',
        'namePatterns',
        'manufacturerIds',
        'handshakes',
        'entries',
      ]) {
        check(data[key], `/${key}`);
      }
    }
    if (kind === 'standard-service') {
      ((data['characteristics'] as Json[]) ?? []).forEach((c, i) => {
        if (c['decoder'] && !DECODER_IDS.includes(String(c['decoder']))) {
          errors.push(`${name}: /characteristics/${i}/decoder: no decoder "${c['decoder']}"`);
        }
      });
    }
    if (kind === 'vendor') {
      ((data['namePatterns'] as Json[]) ?? []).forEach((p, i) => {
        try {
          new RegExp(String(p['pattern']), 'u');
        } catch {
          errors.push(`${name}: /namePatterns/${i}/pattern: does not compile`);
        }
      });
    }
    if (kind === 'encoding-ranges') {
      const ranges = data['byMachineType'] as Record<string, { min: number; max: number }>;
      for (const [deviceType, { min, max }] of Object.entries(ranges)) {
        if (min >= max) errors.push(`${name}: /byMachineType/${deviceType}: min must be below max`);
      }
    }
    byKind.set(kind, [...(byKind.get(kind) ?? []), { path: name, data }]);
  }

  const manifests = byKind.get('manifest') ?? [];
  if (manifests.length !== 1) errors.push(`manifest.json: : expected exactly one manifest`);

  const claimed = new Map<string, string>();
  const claim = (uuid: string, owner: string, sharedWith: unknown) => {
    const key = canonical(uuid);
    const other = claimed.get(key);
    const shared = (sharedWith as string[] | undefined) ?? [];
    if (other && !shared.includes(other)) {
      errors.push(`${owner}: /uuid: service ${uuid} is also claimed by ${other}`);
    }
    claimed.set(key, owner);
  };

  const services = (byKind.get('standard-service') ?? []).map(({ path, data }) => {
    claim(String(data['uuid']), path, data['sharedWith']);
    return {
      id: data['id'],
      name: data['name'],
      shortName: data['shortName'],
      hypothesisLabel: data['hypothesisLabel'] ?? null,
      uuid: canonical(String(data['uuid'])),
      scanFilter: data['scanFilter'],
      characteristics: (data['characteristics'] as Json[]).map((c) => ({
        ...c,
        uuid: canonical(String(c['uuid'])),
      })),
      profiles: (data['profiles'] as Json[]).map((p) => ({
        ...p,
        requires: (p['requires'] as string[]).map(canonical),
        expects: (p['expects'] as string[]).map(canonical),
      })),
    };
  });

  const vendors = (byKind.get('vendor') ?? []).map(({ path, data }) => {
    for (const s of data['services'] as Json[]) claim(String(s['uuid']), path, undefined);
    const handshakes = ((data['handshakes'] ?? []) as Json[]).map((handshake) => ({
      ...handshake,
      service: canonical(String(handshake['service'])),
      command: canonical(String(handshake['command'])),
      data: canonical(String(handshake['data'])),
    }));
    const characteristics = (data['characteristics'] as Json[]).map((c) => ({
      ...c,
      uuid: canonical(String(c['uuid'])),
      service: canonical(String(c['service'])),
    }));
    const ids = new Set<unknown>();
    for (const [index, handshake] of handshakes.entries()) {
      const entry = (data['handshakes'] as Json[])[index];
      const has = (uuid: string, property: string) =>
        characteristics.some(
          (c) =>
            c.service === handshake.service &&
            c.uuid === uuid &&
            (c as Json)['properties'] instanceof Array &&
            ((c as Json)['properties'] as unknown[]).includes(property),
        );
      if (
        ids.has(entry['id']) ||
        !has(handshake.command, 'write') ||
        !has(handshake.data, 'notify')
      )
        errors.push(
          `${path}: /handshakes/${index}: expected a unique id and sourced command and data characteristics`,
        );
      ids.add(entry['id']);
    }
    return {
      ...data,
      handshakes,
      services: (data['services'] as Json[]).map((s) => ({
        ...s,
        uuid: canonical(String(s['uuid'])),
      })),
      characteristics,
    };
  });

  const blocklist = (byKind.get('blocklist') ?? []).flatMap(({ data }) =>
    (data['entries'] as Json[]).map((e) => ({
      uuid: canonical(String(e['uuid'])),
      name: e['name'],
      exclusion: e['exclusion'],
    })),
  );
  const excluded = new Set(blocklist.filter((e) => e.exclusion === 'all').map((e) => e.uuid));
  const knownServiceUuids = [
    ...services.map((s) => s.uuid),
    ...vendors.flatMap((v) => (v['services'] as Json[]).map((s) => String(s['uuid']))),
  ].filter((uuid) => !excluded.has(uuid));
  const commandIds = new Set<string>();
  const commands = (byKind.get('command-set') ?? []).flatMap(({ path, data }) =>
    (data['commands'] as Json[]).map((command, index) => {
      const id = String(command['id']);
      const opCode = FTMS_COMMANDS.get(id);
      const fixed = command['fixedBytes'] as number[] | undefined;
      if (commandIds.has(id) || command['opCode'] !== opCode)
        errors.push(`${path}: /commands/${index}: unexpected or duplicate FTMS command`);
      const usesParameter = opCode !== undefined && opCode >= 2 && opCode <= 5;
      if (
        usesParameter
          ? !command['parameter'] || !!fixed
          : command['parameter'] || fixed?.length !== (id === 'stop' ? 1 : 0)
      )
        errors.push(`${path}: /commands/${index}: incorrect parameters for this FTMS command`);
      commandIds.add(id);
      return {
        ...command,
        protocol: data['protocol'],
        service: canonical(String(data['service'])),
        characteristic: canonical(String(data['characteristic'])),
        ...(command['rangeCharacteristic'] && {
          rangeCharacteristic: canonical(String(command['rangeCharacteristic'])),
        }),
      };
    }),
  );
  const controlLimits: Record<string, unknown> = {};
  for (const { path, data } of byKind.get('control-limits') ?? []) {
    const deviceType = String(data['deviceType']);
    const test = data['test'] as {
      command: string;
      direction: number;
      minValue: number;
      maxValue: number;
      maxStep: number;
    };
    const expected =
      deviceType === 'treadmill'
        ? 'setTargetSpeed'
        : deviceType === 'bike'
          ? 'setTargetResistance'
          : null;
    if (
      controlLimits[deviceType] ||
      !commandIds.has(test.command) ||
      test.command !== expected ||
      test.minValue >= test.maxValue ||
      (deviceType === 'treadmill' &&
        (test.direction !== -1 || test.maxValue > 6 || test.maxStep > 0.1)) ||
      (deviceType === 'bike' && (test.direction !== 1 || test.maxValue > 10 || test.maxStep > 1))
    )
      errors.push(`${path}: /test: invalid control limits for ${deviceType}`);
    controlLimits[deviceType] = test;
  }

  if (errors.length > 0) return { errors, output: null };
  const manifest = manifests[0].data;
  const body = {
    services,
    vendors,
    commands,
    controlLimits,
    blocklist,
    brandSuggestions: (byKind.get('brand-suggestions') ?? [])[0]?.data['byMachineType'] ?? {},
    encodingRanges: (byKind.get('encoding-ranges') ?? [])[0]?.data['byMachineType'] ?? {},
    knownServiceUuids,
  };
  const contentHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  return {
    errors,
    output: {
      version: manifest['version'],
      schemaVersion: manifest['schemaVersion'],
      contentHash,
      ...body,
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = process.argv[2] ?? join(import.meta.dirname, '..', 'src', 'knowledge-base');
  const { errors, output } = buildKnowledgeBase(dir);
  if (errors.length > 0 || !output) {
    console.error(`The knowledge base is invalid:\n${errors.map((e) => `  ${e}`).join('\n')}`);
    process.exit(1);
  }
  mkdirSync(join(dir, 'generated'), { recursive: true });
  writeFileSync(
    join(dir, 'generated', 'knowledge-base.json'),
    `${JSON.stringify(output, null, 2)}\n`,
  );
  console.log(`Knowledge base ${output['version']} is valid.`);
}
