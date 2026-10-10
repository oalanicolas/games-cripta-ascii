import { readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

for (const file of ['index.html', 'style.css', 'src/main.js', 'src/world.js', 'src/rules.js', 'assets/sfx/sources.json', 'node_modules/three/build/three.module.js']) await access(file);
for (const file of ['src/main.js', 'src/world.js', 'src/rules.js']) execFileSync(process.execPath, ['--check', file]);
const sources = JSON.parse(await readFile('assets/sfx/sources.json', 'utf8'));
console.log('Arquivos, módulos JS e recibo de áudio presentes.');
console.log(`Three.js: ${JSON.parse(await readFile('node_modules/three/package.json')).version}`);
for (const file of sources.files) { await access(`assets/sfx/${file.src}`); if (file.license !== 'CC0-1.0') throw new Error(`Licença não conferida: ${file.id}`); }
console.log(`Áudio: ${sources.files.length} de ${sources.files.length} arquivos com recibo CC0 e bytes locais.`);
