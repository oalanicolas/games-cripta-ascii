import { chromium } from '../../../libraries/metal-assault/lab/node_modules/playwright/index.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const url = process.argv[2], output = new URL('../output/qa/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: process.env.QA_HEADED !== '1', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const report = { url, checks: [], errors: [], failures: [], device: 'Desktop e toque emulado; nenhum aparelho físico.' };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) report.failures.push({ status: r.status(), url: r.url() }); });
  const response = await page.goto(url); assert.equal(response.status(), 200);
  assert.equal(await response.text(), await readFile(new URL('../dist/index.html', import.meta.url), 'utf8'));
  const served = await page.request.get(new URL('build.json', url).href);
  report.build = await served.json(); assert.deepEqual(report.build, JSON.parse(await readFile(new URL('../dist/build.json', import.meta.url))));
  for (const name of ['src/main.js', 'src/world.js', 'src/rules.js', 'src/audio.js', 'style.css']) {
    const asset = await page.request.get(new URL(name, url).href); assert.equal(asset.status(), 200);
    assert.deepEqual(await asset.body(), await readFile(new URL('../dist/' + name, import.meta.url)));
  }
  report.checks.push('HTML, build.json, módulos e CSS servidos idênticos ao build local');
  await page.waitForFunction(() => window.__game); await page.waitForTimeout(600);
  await page.screenshot({ path: new URL('final-title.png', output).pathname });
  await page.getByRole('button', { name: 'Acender a tocha' }).click();
  await page.mouse.move(700, 330); await page.mouse.down(); await page.keyboard.down('w');
  await page.waitForTimeout(3650); await page.keyboard.up('w'); await page.mouse.up();
  await page.screenshot({ path: new URL('final-ruins.png', output).pathname });
  await page.keyboard.down('w'); await page.waitForTimeout(240); await page.keyboard.up('w'); await page.keyboard.press('e');
  await page.waitForTimeout(300); assert.equal((await page.evaluate(() => window.__game.observe())).zone, 'dungeon');
  await page.mouse.wheel(0, -450); await page.waitForTimeout(200);
  await page.screenshot({ path: new URL('final-dungeon.png', output).pathname });
  await page.keyboard.press('q'); await page.waitForTimeout(80); await page.keyboard.press('r'); await page.waitForTimeout(200);
  const reset = await page.evaluate(() => window.__game.observe()); assert.equal(reset.seals.length, 0); assert.equal(reset.zone, 'outdoor');
  report.checks.push('Ajuste de luz subterrânea, zoom e limpeza dos efeitos no reinício observados');
  await page.keyboard.press('Escape'); await page.getByLabel('Silenciar áudio').check();
  await page.getByLabel('Reduzir movimento e relâmpagos').check(); await page.getByRole('button', { name: 'Voltar à expedição' }).click();
  assert.equal((await page.evaluate(() => window.__game.info())).audio.muted, true);
  await page.keyboard.press('Escape'); await page.reload(); await page.waitForFunction(() => window.__game);
  assert.equal(await page.getByRole('button', { name: 'Continuar expedição' }).isVisible(), true);
  await page.getByRole('button', { name: 'Continuar expedição' }).click();
  report.checks.push('Save e preferências sobrevivem ao reload');
  report.info = await page.evaluate(() => window.__game.info());
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  mobile.on('pageerror', e => report.errors.push(e.message));
  await mobile.goto(url); await mobile.waitForFunction(() => window.__game); await mobile.getByRole('button', { name: 'Acender a tocha' }).tap();
  await mobile.waitForTimeout(200); assert.equal(await mobile.locator('#touch').isVisible(), true);
  const before = await mobile.evaluate(() => window.__game.observe().player.x);
  await mobile.mouse.move(110, 740); await mobile.mouse.down();
  await mobile.waitForTimeout(400); await mobile.mouse.up();
  assert.ok((await mobile.evaluate(() => window.__game.observe().player.x)) > before + 0.2);
  await mobile.getByRole('button', { name: 'Atirar' }).tap();
  await mobile.waitForTimeout(100); assert.ok((await mobile.evaluate(() => window.__game.events())).some(e => e.type === 'fire'));
  await mobile.screenshot({ path: new URL('mobile.png', output).pathname });
  report.checks.push('Layout 390×844: joystick por ponteiro e disparo por touchscreen.tap; não é aparelho físico');
  assert.equal(report.errors.length, 0); assert.equal(report.failures.length, 0); report.passed = true;
} catch (e) { report.error = e.stack; report.passed = false; process.exitCode = 1; }
finally { await writeFile(new URL('final.json', output), JSON.stringify(report, null, 2)); await browser.close(); console.log(JSON.stringify({ passed: report.passed, checks: report.checks, error: report.error, build: report.build }, null, 2)); }
