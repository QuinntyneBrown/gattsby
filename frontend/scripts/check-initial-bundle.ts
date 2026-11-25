// Fails when the initial bundle is over 250 KB compressed (NFR-004, A-08; ADR 0002). The initial
// bundle is every script and stylesheet index.html loads directly, plus every chunk those scripts
// import statically; lazy chunks, loaded later by import(), are not counted. Run after the
// production build.
//
// Usage: node scripts/check-initial-bundle.ts [--limit <KB>, default 250]

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const output = resolve(import.meta.dirname, '..', 'dist', 'frontend', 'browser');
const limitFlag = process.argv.indexOf('--limit');
const limitKb = limitFlag === -1 ? 250 : Number(process.argv[limitFlag + 1]);
const limitBytes = limitKb * 1024;

const html = readFileSync(join(output, 'index.html'), 'utf8');
const direct = [
  ...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g),
  ...html.matchAll(/<link[^>]*\brel="(?:stylesheet|modulepreload)"[^>]*\bhref="([^"]+)"/g),
].map((match) => match[1]);

// Static imports only: `import ... from "./x.js"` and `import "./x.js"`, never `import("./x.js")`.
const staticImport = /(?:\bfrom\s*|\bimport\s*)["'](\.\/[^"']+\.js)["']/g;

const initial = new Set<string>();
const queue = [...direct];
while (queue.length > 0) {
  const file = queue.shift()!.replace(/^\.?\//, '');
  if (initial.has(file) || /^[a-z]+:/i.test(file)) continue;
  initial.add(file);
  if (file.endsWith('.js')) {
    for (const match of readFileSync(join(output, file), 'utf8').matchAll(staticImport)) {
      queue.push(match[1]);
    }
  }
}

let total = 0;
const rows = [...initial].map((file) => {
  const size = gzipSync(readFileSync(join(output, file)), { level: 9 }).length;
  total += size;
  return `  ${file.padEnd(40)} ${(size / 1024).toFixed(1).padStart(7)} KB`;
});

console.log(`Initial bundle, gzip level 9:\n${rows.join('\n')}`);
console.log(`  ${'Total'.padEnd(40)} ${(total / 1024).toFixed(1).padStart(7)} KB of ${limitKb} KB`);
if (total > limitBytes) {
  console.error(`The initial bundle is over ${limitKb} KB compressed (NFR-004).`);
  process.exit(1);
}
