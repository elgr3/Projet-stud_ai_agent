import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/budget.js', ['budget.js', 'text/javascript; charset=utf-8']],
  ['/storage.js', ['storage.js', 'text/javascript; charset=utf-8']],
]);
const headers = {
  'Cache-Control': 'no-cache',
  'Content-Security-Policy': "default-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { ...headers, Allow: 'GET, HEAD' }).end();
    return;
  }

  const asset = assets.get(request.url.split('?')[0]);
  if (!asset) {
    response.writeHead(404, headers).end('Page introuvable');
    return;
  }

  try {
    const [file, type] = asset;
    const body = await readFile(new URL(file, import.meta.url));
    response.writeHead(200, { ...headers, 'Content-Type': type, 'Content-Length': body.length });
    response.end(request.method === 'GET' ? body : undefined);
  } catch (error) {
    console.error(error);
    response.writeHead(500, headers).end('Erreur de lecture');
  }
}).listen(port, host, function () {
  console.log(`Cap Étudiant écoute sur ${host}:${this.address().port}`);
});
