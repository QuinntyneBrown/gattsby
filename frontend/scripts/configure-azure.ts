import { readFile, writeFile } from 'node:fs/promises';
import { parseHeadersFile } from './headers-file.ts';

const output = new URL('../dist/frontend/browser/', import.meta.url);
const rules = parseHeadersFile(await readFile(new URL('_headers', output), 'utf8'));
if (rules.length !== 1 || rules[0].pattern !== '/*') {
  throw new Error('Azure globalHeaders requires a single /* header rule.');
}

const config = {
  navigationFallback: {
    rewrite: '/index.html',
    exclude: ['/*.{js,css,json,svg,ico,woff2,png,webmanifest,txt}'],
  },
  globalHeaders: rules[0].headers,
};
await writeFile(new URL('staticwebapp.config.json', output), JSON.stringify(config, null, 2));
