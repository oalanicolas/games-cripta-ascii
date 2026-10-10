import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

await mkdir('dist', { recursive: true });
for (const name of ['index.html', 'style.css', 'src', 'assets']) await cp(name, `dist/${name}`, { recursive: true });
await mkdir('dist/vendor', { recursive: true });
for (const name of ['three.module.js', 'three.core.js']) await cp(`node_modules/three/build/${name}`, `dist/vendor/${name}`);
await cp('node_modules/three/LICENSE', 'dist/vendor/LICENSE');
const html = (await readFile('index.html', 'utf8')).replace('./node_modules/three/build/three.module.js', './vendor/three.module.js');
await writeFile('dist/index.html', html);
const hash = createHash('sha256').update(await readFile('src/rules.js')).update(await readFile('src/world.js')).update(await readFile('src/main.js')).digest('hex');
await writeFile('dist/build.json', JSON.stringify({ id: hash, name: 'cripta-ascii', version: '0.1.0' }, null, 2));
console.log(`Build estático: dist/ · ${hash}`);
