import { createState, step, respawn, snapshotSave, MAP, SEALS, RULES } from './rules.js';
import { createWorld } from './world.js';
import { createAudio } from './audio.js';

const $ = id => document.getElementById(id), canvas = $('world');
const storageKey = 'cripta-ascii:v1', preferencesKey = 'cripta-ascii:preferences';
function readStorage(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function writeStorage(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { $('toast').textContent = 'O navegador não permitiu salvar esta expedição.'; } }
const candidate = readStorage(storageKey);
const saved = candidate?.version === 1 && Array.isArray(candidate.seals) && candidate.seals.every(x => SEALS.some(s => s.id === x)) ? candidate : null;
const preferences = { muted: false, reducedMotion: matchMedia('(prefers-reduced-motion:reduce)').matches, ...readStorage(preferencesKey) };
let state = createState(), world, audio, running = true, lastTime = 0, accumulator = 0, raf = 0;
let pointer = null, pointerDown = false, stick = { x: 0, z: 0 }, previousStatus = 'title', previousZone = 'outdoor';
let queued = {}, keys = new Set(), fireTouch = false, uiTime = 0;
const frameTimes = [];
const labelNodes = new Map();
const frameEvents = [];

function begin(load = false) {
  state = createState(load ? saved : null); state.status = 'playing'; world.reset(); clearInput();
  writeStorage(storageKey, snapshotSave(state)); audio.resume(); canvas.focus(); refreshUI(true);
}
function clearInput() { keys.clear(); queued = {}; pointerDown = false; fireTouch = false; stick = { x: 0, z: 0 }; $('stick-knob').style.transform = ''; }
function pause() {
  if (state.status !== 'playing') return;
  state.status = 'paused'; clearInput(); audio.pause(); refreshUI(true); $('resume-button').focus();
}
function resume() { if (state.status !== 'paused') return; state.status = 'playing'; audio.resume(); refreshUI(true); canvas.focus(); }
function input() {
  let x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + stick.x;
  let z = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + stick.z;
  let aim = pointer ? world.aim(pointer.x, pointer.y) : null;
  if (fireTouch) {
    const p = state.player;
    const enemies = [...state.enemies[state.zone].filter(e => e.alive), ...(state.zone === 'outdoor' && state.boss.active ? [state.boss] : [])];
    aim = enemies.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0] || null;
  }
  const result = { x, z, aim, fire: pointerDown || keys.has('KeyJ') || fireTouch, ...queued }; queued = {}; return result;
}
function simulate() {
  const intent = input(); step(state, intent);
  for (const e of state.events) {
    world.event(e); audio.event(e); frameEvents.push({ time: state.time, ...e });
    if (frameEvents.length > 100) frameEvents.shift();
    if (e.type === 'save') writeStorage(storageKey, snapshotSave(state));
  }
  audio.update(state, Math.hypot(intent.x, intent.z) > 0);
  if (state.status !== 'playing') audio.pause();
}
function prompt() {
  const p = state.player, map = MAP[state.zone];
  if (Math.hypot(p.x - map.portal[0], p.z - map.portal[1]) < 2.5) return state.zone === 'outdoor' ? 'E · Descer na cripta' : 'E · Voltar às ruínas';
  if (state.zone === 'dungeon') {
    const seal = SEALS.find(s => !state.seals.includes(s.id) && Math.hypot(p.x - s.x, p.z - s.z) < 2.3);
    if (seal) return `E · Recuperar ${seal.name.toLowerCase()}`;
  }
  if (Math.hypot(p.x - map.shrine[0], p.z - map.shrine[1]) < 2.3) return 'E · Descansar no santuário';
  return '';
}
function labels() {
  const entries = [{ id: 'player', x: state.player.x, y: 2.05, z: state.player.z, text: 'Peregrino' }];
  for (const e of state.enemies[state.zone]) if (e.alive && Math.hypot(e.x - state.player.x, e.z - state.player.z) < 12) entries.push({ ...e, y: 2.1, text: e.type === 'wisp' ? 'Eco' : 'Guardião', ratio: e.hp / e.maxHp });
  for (const e of entries) {
    let node = labelNodes.get(e.id);
    if (!node) { node = document.createElement('div'); node.className = 'actor-label'; node.dataset.actor = e.id; labelNodes.set(e.id, node); $('labels').append(node); }
    const screen = world.project(e.x, e.y, e.z); node.style.left = `${screen.x}px`; node.style.top = `${screen.y}px`;
    node.hidden = !screen.visible || state.status === 'title';
    node.innerHTML = e.text + (e.ratio !== undefined ? `<div class="bar"><i style="width:${Math.max(0, e.ratio) * 100}%"></i></div>` : '');
  }
  for (const [id, node] of labelNodes) if (!entries.some(e => e.id === id)) node.hidden = true;
}
function refreshUI(force = false) {
  $('title-screen').hidden = state.status !== 'title'; $('pause-screen').hidden = state.status !== 'paused';
  $('end-screen').hidden = !['dead', 'won'].includes(state.status); $('hud').hidden = state.status === 'title';
  $('controls').hidden = state.status !== 'playing'; $('touch').hidden = state.status !== 'playing' || !matchMedia('(pointer:coarse)').matches;
  $('boss-bar').hidden = !state.boss.active || state.zone !== 'outdoor';
  $('hp').style.width = `${state.player.hp}%`; $('mana').style.width = `${state.player.mana}%`;
  $('hp-text').textContent = Math.ceil(state.player.hp); $('mana-text').textContent = Math.floor(state.player.mana);
  $('boss-hp').style.width = `${state.boss.hp / state.boss.maxHp * 100}%`; $('boss-phase').textContent = `FASE ${state.boss.phase} / 3`;
  $('zone-label').textContent = state.zone === 'outdoor' ? 'Ruínas da Cinza' : 'Cripta dos Ecos';
  $('seal-count').textContent = Array.from({ length: 3 }, (_, i) => i < state.seals.length ? '◆' : '◇').join(' ');
  $('quest-kicker').textContent = state.seals.length === 3 ? 'O ÚLTIMO GUARDIÃO' : 'A PRIMEIRA DESCIDA';
  $('quest').textContent = state.seals.length === 3 ? state.zone === 'dungeon' ? 'Volte às ruínas pelo portal' : 'Enfrente o dragão além do arco' : state.zone === 'outdoor' ? 'Encontre a entrada da cripta' : 'Recupere os três selos';
  $('potion-count').textContent = `${state.player.potions} poções`; $('burst-status').textContent = state.player.burstCd > 0 ? `${state.player.burstCd.toFixed(1)}s` : 'explosão';
  $('toast').textContent = state.messageTime > 0 ? state.message : '';
  const text = prompt(); $('interact').hidden = !text || state.status !== 'playing'; $('interact').textContent = text;
  $('damage').style.opacity = state.player.hurt > 0 && !preferences.reducedMotion ? '0.6' : '0';
  if (['dead', 'won'].includes(state.status)) {
    const won = state.status === 'won';
    $('end-kicker').textContent = won ? 'OS TRÊS SELOS RESPONDEM' : 'A LUZ SE APAGA';
    $('end-title').textContent = won ? 'A cinza se aquieta.' : 'Ainda há uma brasa.';
    $('end-copy').textContent = won ? `Você atravessou a cripta e derrotou o guardião. ${state.player.kills} criaturas vencidas nesta expedição.` : `Retorne ao santuário. ${state.seals.length} de 3 selos preservados.`;
    $('end-button').textContent = won ? 'Nova expedição' : 'Voltar ao santuário'; $('new-button').hidden = won;
  }
  if (force || previousZone !== state.zone) world.reset();
  previousStatus = state.status; previousZone = state.zone;
}
function frame(now) {
  if (!running) return;
  const dt = Math.min((now - (lastTime || now)) / 1000, 0.1); lastTime = now;
  if (state.status === 'playing') {
    accumulator += dt;
    while (accumulator >= RULES.step) { simulate(); accumulator -= RULES.step; }
    if (frameTimes.length < 600) frameTimes.push(dt * 1000);
  } else accumulator = 0;
  world.update(state, dt, preferences); labels();
  uiTime += dt;
  if (uiTime > 0.08 || previousStatus !== state.status) { refreshUI(); uiTime = 0; }
  raf = requestAnimationFrame(frame);
}

window.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Escape') { state.status === 'paused' ? resume() : pause(); return; }
  if (state.status === 'title' && e.code === 'Enter') { begin(); return; }
  if (state.status !== 'playing') return;
  keys.add(e.code);
  const actions = { Space: 'dodge', KeyQ: 'burst', KeyH: 'heal', KeyE: 'interact' };
  if (actions[e.code]) queued[actions[e.code]] = true;
  if (e.code === 'KeyR') begin();
});
window.addEventListener('keyup', e => keys.delete(e.code));
canvas.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') pointer = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerdown', e => { if (state.status === 'playing' && e.button === 0) { pointer = { x: e.clientX, y: e.clientY }; pointerDown = true; canvas.focus(); } });
window.addEventListener('pointerup', () => { pointerDown = false; fireTouch = false; });
canvas.addEventListener('wheel', e => { e.preventDefault(); world.zoom(e.deltaY); }, { passive: false });
canvas.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('blur', () => { clearInput(); pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
$('start-button').onclick = () => begin(); $('continue-button').onclick = () => begin(true);
$('pause-button').onclick = pause; $('resume-button').onclick = resume; $('restart-button').onclick = () => begin();
$('end-button').onclick = () => { if (state.status === 'dead') { state = respawn(state); world.reset(); audio.resume(); clearInput(); refreshUI(true); canvas.focus(); } else begin(); };
$('new-button').onclick = () => begin();
for (const [id, key] of [['mute', 'muted'], ['reduced-motion', 'reducedMotion']]) {
  $(id).checked = preferences[key]; $(id).onchange = () => { preferences[key] = $(id).checked; audio.mute(preferences.muted); writeStorage(preferencesKey, preferences); };
}
let stickPointer = null;
$('stick').addEventListener('pointerdown', e => { stickPointer = e.pointerId; $('stick').setPointerCapture(e.pointerId); updateStick(e); });
function updateStick(e) {
  if (e.pointerId !== stickPointer) return;
  const r = $('stick').getBoundingClientRect(), dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
  const length = Math.hypot(dx, dy), limit = Math.min(length, 36), scale = length ? limit / length : 0;
  stick = { x: dx * scale / 36, z: dy * scale / 36 }; $('stick-knob').style.transform = `translate(${dx * scale}px,${dy * scale}px)`;
}
$('stick').addEventListener('pointermove', updateStick);
function stopStick() { stickPointer = null; stick = { x: 0, z: 0 }; $('stick-knob').style.transform = ''; }
$('stick').addEventListener('pointerup', stopStick); $('stick').addEventListener('pointercancel', stopStick);
for (const button of document.querySelectorAll('[data-action]')) {
  button.addEventListener('pointerdown', e => { e.preventDefault(); if (button.dataset.action === 'fire') { fireTouch = true; queued.fire = true; } else queued[button.dataset.action] = true; });
  button.addEventListener('pointerup', () => { if (button.dataset.action === 'fire') fireTouch = false; });
  button.addEventListener('pointercancel', () => { if (button.dataset.action === 'fire') fireTouch = false; });
}

try {
  world = createWorld(canvas); audio = createAudio(); audio.mute(preferences.muted);
  await audio.loading; $('loading').hidden = true; $('continue-button').hidden = !saved;
  refreshUI(true); raf = requestAnimationFrame(frame);
  window.__game = {
    observe: () => structuredClone(state), events: () => structuredClone(frameEvents),
    project: (x, y, z) => world.project(x, y, z), info: () => ({ ...world.info(), audio: audio.info(), frameTimes: [...frameTimes] }),
    pause, resume, reset: () => begin(),
    act: action => { queued = { ...queued, ...action }; },
    dispose: () => { running = false; cancelAnimationFrame(raf); world.dispose(); audio.dispose(); },
  };
} catch (error) {
  $('loading').textContent = 'Não foi possível abrir a expedição. Recarregue a página.';
  console.error(error);
}
