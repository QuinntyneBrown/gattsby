import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import standaloneCode from 'ajv/dist/standalone/index.js';
import { build } from 'esbuild';

const schemas = new URL('../src/schemas/', import.meta.url);
const generated = new URL('./generated/', schemas);
await mkdir(generated, { recursive: true });
for (const name of await readdir(schemas)) {
  if (!name.endsWith('.schema.json')) continue;
  const validator = new Ajv({ code: { source: true }, strict: true });
  const schema = JSON.parse(await readFile(new URL(name, schemas), 'utf8'));
  const outfile = new URL(name.replace('.schema.json', '.js'), generated);
  await build({
    stdin: {
      contents: standaloneCode(validator, validator.compile(schema)),
      resolveDir: fileURLToPath(new URL('../', import.meta.url)),
    },
    outfile: fileURLToPath(outfile),
    bundle: true,
    format: 'esm',
    platform: 'browser',
  });
  await writeFile(
    new URL(name.replace('.schema.json', '.d.ts'), generated),
    'declare const validate: (value: unknown) => boolean;\nexport default validate;\n',
  );
}
