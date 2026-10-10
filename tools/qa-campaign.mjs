import { chromium } from '../../../libraries/metal-assault/lab/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const url = process.argv[2], output = new URL('../output/qa/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: process.env.QA_HEADED !== '1', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const report = { url, method: 'Controles públicos, tempo real, sem teleporte ou alteração de estado. observe/project somente leitura.', checks: [], errors: [], failures: [] };
page.on('pageerror', e => report.errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
page.on('response', r => { if (r.status() >= 400) report.failures.push({ url: r.url(), status: r.status() }); });
const state = () => page.evaluate(() => window.__game.observe());
const sleep = ms => page.waitForTimeout(ms);
const check = (name, data = {}) => { report.checks.push({ name, ...data }); console.log(name, JSON.stringify(data)); };
async function aim(target) {
  const screen = await page.evaluate(t => window.__game.project(t.x, 0, t.z), target);
  await page.mouse.move(screen.x, screen.y);
}
async function care(s) {
  if (s.player.hp < 60 && s.player.potions > 0) await page.keyboard.press('h');
  if (s.status === 'dead') throw new Error(`Derrota durante ${report.checks.at(-1)?.name}`);
}
async function kill(ids) {
  const start = Date.now(); await page.mouse.down();
  while (true) {
    const s = await state(); await care(s);
    const enemies = s.enemies[s.zone].filter(e => e.alive && ids.includes(e.id));
    if (!enemies.length) break;
    const e = enemies.sort((a, b) => Math.hypot(a.x - s.player.x, a.z - s.player.z) - Math.hypot(b.x - s.player.x, b.z - s.player.z))[0];
    await aim(e);
    if (Math.hypot(e.x - s.player.x, e.z - s.player.z) < 4.5 && !s.player.burstCd && s.player.mana > 40) await page.keyboard.press('q');
    if (Date.now() - start > 22000) throw new Error(`Não derrotou ${ids}: ${JSON.stringify(enemies)}`);
    await sleep(120);
  }
  await page.mouse.up(); check('inimigos derrotados', { ids });
}
let held = [];
async function release() { for (const key of held) await page.keyboard.up(key); held = []; }
async function go(x, z) {
  const start = Date.now();
  while (true) {
    const s = await state(); await care(s);
    const dx = x - s.player.x, dz = z - s.player.z;
    if (Math.hypot(dx, dz) < 0.3) break;
    const next = [];
    if (Math.abs(dx) > 0.18) next.push(dx > 0 ? 'd' : 'a');
    if (Math.abs(dz) > 0.18) next.push(dz > 0 ? 's' : 'w');
    for (const key of held) if (!next.includes(key)) await page.keyboard.up(key);
    for (const key of next) if (!held.includes(key)) await page.keyboard.down(key);
    held = next;
    if (Date.now() - start > 18000) throw new Error(`Rota travada: ${s.player.x},${s.player.z} → ${x},${z}`);
    await sleep(80);
  }
  await release();
}
async function capture(name) { await page.screenshot({ path: new URL(name + '.png', output).pathname }); }
try {
  await page.goto(url); await page.waitForFunction(() => window.__game);
  await page.getByRole('button', { name: 'Acender a tocha' }).click();
  await sleep(300); check('abertura jogável');
  await page.keyboard.press('Escape'); const paused = await state(); await sleep(400);
  assert.equal((await state()).time, paused.time); assert.equal((await page.evaluate(() => window.__game.info())).audio.voices, 0);
  await capture('pause'); await page.getByRole('button', { name: 'Voltar à expedição' }).click(); check('pausa congela regras e interrompe áudio');
  await kill(['o1', 'o2']);
  await go(0, 0); await capture('ruins'); await page.mouse.wheel(0, -450); await sleep(150); await capture('ruins-zoom'); await page.mouse.wheel(0, 450);
  await go(0, -6); await page.keyboard.press('e'); await sleep(300); assert.equal((await state()).zone, 'dungeon');
  await capture('dungeon'); check('portal entrou na masmorra');
  await go(0, 10); await go(-11, 10); await go(-11, 7); await kill(['d1', 'd2']);
  await go(-11, 1); await page.keyboard.press('e'); await sleep(120); assert.equal((await state()).seals.length, 1); check('primeiro selo');
  await capture('dungeon-seal');
  await go(-11, 10); await go(11, 10); await go(11, 7); await kill(['d3', 'd4']);
  await go(11, 1); await page.keyboard.press('e'); await sleep(120); assert.equal((await state()).seals.length, 2); check('segundo selo');
  await go(11, 10); await go(0, 10); await go(0, -8); await kill(['d5', 'd6']);
  await go(0, -17); await page.keyboard.press('e'); await sleep(120); assert.equal((await state()).seals.length, 3); check('três de três selos');
  await go(0, 14); await page.keyboard.press('e'); await sleep(300); assert.equal((await state()).zone, 'outdoor'); check('retorno ao exterior');
  await go(0, -11); await capture('dragon');
  await page.mouse.down(); const fightStart = Date.now();
  while (true) {
    const s = await state(); if (s.status === 'won') break; await care(s); await aim(s.boss);
    if (s.hazards.some(h => h.warning > 0 && h.warning < 0.5 && (h.type === 'breath' || Math.hypot(h.x - s.player.x, h.z - s.player.z) < h.radius + 1)) && !s.player.dodgeCd) {
      const side = s.player.x > 8 ? 'a' : 'd'; await page.keyboard.down(side); await page.keyboard.press('Space'); await sleep(260); await page.keyboard.up(side);
    }
    if (Date.now() - fightStart > 65000) throw new Error(`Chefe não terminou: ${s.boss.hp}`);
    await sleep(120);
  }
  await page.mouse.up(); await capture('victory'); check('vitória via combate real', { seconds: (Date.now() - fightStart) / 1000 });
  await page.getByRole('button', { name: 'Nova expedição', exact: true }).first().click(); await sleep(200);
  assert.equal((await state()).seals.length, 0); assert.equal((await state()).status, 'playing'); check('reinício limpa campanha');
  await kill(['o1']);
  await go(3, 0.9);
  const deathStart = Date.now();
  while ((await state()).status !== 'dead') {
    if (Date.now() - deathStart > 45000) throw new Error('Dano adversário não levou à derrota');
    await sleep(300);
  }
  await capture('death'); await page.getByRole('button', { name: 'Voltar ao santuário' }).click(); await sleep(200);
  assert.equal((await state()).player.hp, 100); assert.equal((await state()).status, 'playing'); check('derrota e retorno ao santuário');
  report.info = await page.evaluate(() => window.__game.info());
  report.final = await state(); report.events = await page.evaluate(() => window.__game.events());
  assert.equal(report.errors.length, 0); assert.equal(report.failures.length, 0); report.passed = true;
} catch (error) {
  report.error = error.stack; report.state = await state().catch(() => null); await capture('failure').catch(() => {}); report.passed = false; console.error(error.message); process.exitCode = 1;
} finally {
  await writeFile(new URL('campaign.json', output), JSON.stringify(report, null, 2)); await browser.close();
}
