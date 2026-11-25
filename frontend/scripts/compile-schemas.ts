import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import standaloneCode from 'ajv/dist/standalone/index.js';
import { build } from 'esbuild';

const schemas = new URL('../src/schemas/', import.meta.url);
const generated = new URL('./generated/', schemas);
await mkdir(generated, { recursive: true });
const ajv = new Ajv({ code: { source: true }, strict: true, strictRequired: false });
const validators = new Map<string, string>();
for (const name of await readdir(schemas)) {
  if (!name.endsWith('.schema.json')) continue;
  const schema = JSON.parse(await readFile(new URL(name, schemas), 'utf8'));
  ajv.addSchema(schema, name);
  validators.set(name.replace('.schema.json', ''), name);
}
const record = validators.get('investigation-record-1');
if (record) validators.set('raw-log-page-1', `${record}#/properties/rawLog`);

for (const [module, key] of validators) {
  const validate = ajv.getSchema(key);
  if (!validate) throw new Error(`Missing schema: ${key}`);
  await build({
    stdin: {
      contents: standaloneCode(ajv, validate),
      resolveDir: fileURLToPath(new URL('../', import.meta.url)),
    },
    outfile: fileURLToPath(new URL(`${module}.js`, generated)),
    bundle: true,
    format: 'esm',
    platform: 'browser',
  });
  await writeFile(
    new URL(`${module}.d.ts`, generated),
    'declare const validate: { (value: unknown): boolean; errors?: readonly { instancePath: string; keyword: string }[] | null };\nexport default validate;\n',
  );
}

// The catalog is the source of the executable input checks as well as the model's tool list.
const catalogModule = new URL('tool-catalog.mjs', generated);
await build({
  entryPoints: [fileURLToPath(new URL('../src/app/tools/tool-catalog.ts', import.meta.url))],
  outfile: fileURLToPath(catalogModule),
  bundle: true,
  packages: 'external',
  format: 'esm',
  platform: 'node',
});
const { TOOL_CATALOG } = (await import(
  catalogModule.href
)) as typeof import('../src/app/tools/tool-catalog');
const inputs = new Ajv({ code: { source: true }, strict: true, strictRequired: false });
const exported: Record<string, string> = {};
for (const tool of TOOL_CATALOG) {
  const id = `tool:${tool.name}`;
  exported[tool.name] = id;
  inputs.addSchema(tool.inputSchema, id);
}
await build({
  stdin: {
    contents: standaloneCode(inputs, exported),
    resolveDir: fileURLToPath(new URL('../', import.meta.url)),
  },
  outfile: fileURLToPath(new URL('tool-inputs.js', generated)),
  bundle: true,
  format: 'esm',
  platform: 'browser',
});
await writeFile(
  new URL('tool-inputs.d.ts', generated),
  'declare const inputs: Record<string, (value: unknown) => boolean>;\nexport default inputs;\n',
);
