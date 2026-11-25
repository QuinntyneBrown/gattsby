// Serves the production build on localhost with every header from public/_headers (ADR 0003).
// The behaviour specs and check-headers.ts run against it, so they see the deployed Content
// Security Policy. Only Node's built-in modules are used.
//
// Usage: node scripts/serve-dist.ts [--port 4300]

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { parseHeadersFile, headersFor } from './headers-file.ts';

const root = resolve(import.meta.dirname, '..', 'dist', 'frontend', 'browser');
const portFlag = process.argv.indexOf('--port');
const port = portFlag === -1 ? 4300 : Number(process.argv[portFlag + 1]);

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

const rules = parseHeadersFile(await readFile(join(root, '_headers'), 'utf8').catch(() => ''));

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${port}`);
  const pathname = decodeURIComponent(url.pathname);
  const requested = normalize(join(root, pathname));
  if (!requested.startsWith(root)) {
    response.writeHead(400).end();
    return;
  }

  let file = requested;
  let status = 200;
  if (!(await isFile(file))) {
    // A path without an extension is an app route: answer with index.html, as the static host's
    // single-page fallback does. Anything else is a missing file.
    if (extname(pathname) === '') {
      file = join(root, 'index.html');
    } else {
      status = 404;
    }
  }

  const headers: Record<string, string> = { ...headersFor(rules, pathname) };
  if (status === 404) {
    response.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  headers['Content-Type'] = contentTypes[extname(file)] ?? 'application/octet-stream';
  response.writeHead(200, headers);
  response.end(request.method === 'HEAD' ? undefined : await readFile(file));
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} on http://localhost:${port}`);
});
