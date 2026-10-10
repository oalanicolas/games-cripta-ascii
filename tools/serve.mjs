import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync(process.execPath, [resolve(project, 'tools/build.mjs')], { cwd: project, stdio: 'inherit' });
const root = resolve(project, 'dist');
const args = process.argv.slice(2);
const port = Number(process.env.PORT || args[args.indexOf('--port') + 1] || 8080);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.png': 'image/png' };
http.createServer(async (req, res) => {
  try {
    let path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!path.startsWith(root + '/') && path !== root) { res.writeHead(403).end(); return; }
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(404).end('Não encontrado'); }
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/`));
