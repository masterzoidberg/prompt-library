import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const basePath = '/prompt-library';
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }

  if (pathname !== basePath && !pathname.startsWith(`${basePath}/`)) {
    response.writeHead(404).end();
    return;
  }

  let relativePath = pathname.slice(basePath.length).replace(/^\/+/, '');
  if (!relativePath || relativePath.endsWith('/')) relativePath += 'index.html';

  const filePath = resolve(distDir, relativePath);
  if (!filePath.startsWith(`${distDir}${sep}`)) {
    response.writeHead(404).end();
    return;
  }

  let body;
  let servedPath = filePath;
  try {
    body = await readFile(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT' || !request.headers.accept?.includes('text/html')) {
      response.writeHead(404).end();
      return;
    }
    servedPath = resolve(distDir, 'index.html');
    body = await readFile(servedPath);
  }

  response.writeHead(200, {
    'Cache-Control': 'no-cache',
    'Content-Type': contentTypes[extname(servedPath)] ?? 'application/octet-stream',
  });
  response.end(request.method === 'HEAD' ? undefined : body);
});

server.listen(4174, '127.0.0.1', () => {
  process.stdout.write('Static Pages preview: http://127.0.0.1:4174/prompt-library/\n');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
