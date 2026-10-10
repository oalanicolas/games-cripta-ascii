import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, step, RULES, collides, interact, respawn, snapshotSave } from '../src/rules.js';

function play() { const s = createState(); s.status = 'playing'; return s; }
function advance(s, seconds, input = {}) { for (let k = 0; k < seconds / RULES.step; k++) step(s, input); }

test('movimento percorre terreno e a parede bloqueia o corpo sem atravessar', () => {
  const s = play(); advance(s, 1, { z: -1 }); assert.ok(s.player.z < 7.3);
  s.player.x = -7; s.player.z = 0; advance(s, 2, { x: -1 });
  assert.ok(s.player.x >= -7.67); assert.equal(collides('outdoor', s.player.x, s.player.z), false);
});

test('pausa congela vida, mana, projéteis e o relógio', () => {
  const s = play(); step(s, { fire: true }); s.status = 'paused'; const before = structuredClone(s);
  advance(s, 3, { x: 1, fire: true }); assert.deepEqual(s, before);
});

test('projétil atinge inimigo e não atravessa parede em passo extenso', () => {
  const s = play(); s.player.x = -4; s.player.z = 8;
  advance(s, 0.7, { fire: true, aim: { x: -4, z: 3 } }); assert.ok(s.enemies.outdoor[0].hp < 78);
  s.projectiles = [{ id: 100, x: -6, z: 0, dx: -1, dz: 0, ttl: 5, speed: 80, hostile: false }];
  step(s, {}, 0.5); assert.equal(s.projectiles.length, 0);
});

test('esquiva evita dano, termina e tem recuperação', () => {
  const s = play(); s.hazards = [{ id: 1, type: 'meteor', x: 0, z: 12, radius: 5, warning: 0, active: 1 }];
  step(s, { dodge: true, x: 1 }); assert.equal(s.player.hp, 100); assert.ok(s.player.dodgeCd > 0);
  advance(s, 0.3); assert.equal(s.player.dodgeTime, 0); assert.ok(s.player.hp < 100);
});

test('portal é local, troca mapa e limpa perigos pendentes', () => {
  const s = play(); assert.equal(interact(s), true); assert.equal(s.zone, 'outdoor');
  s.player.z = -7; s.projectiles.push({ id: 4 }); assert.equal(interact(s), true);
  assert.equal(s.zone, 'dungeon'); assert.equal(s.projectiles.length, 0); assert.equal(s.checkpoint, 'dungeon');
  s.player.z = 15; interact(s); assert.equal(s.zone, 'outdoor'); assert.equal(s.player.z, -4);
});

test('selo exige derrotar guardiões e não duplica prêmio', () => {
  const s = play(); s.zone = 'dungeon'; s.player.x = -11; s.player.z = 1;
  assert.equal(interact(s), false); assert.equal(s.seals.length, 0);
  s.enemies.dungeon.slice(0, 2).forEach(e => { e.alive = false; });
  assert.equal(interact(s), true); assert.deepEqual(s.seals, ['cinza']);
  const potions = s.player.potions; interact(s); assert.equal(s.player.potions, potions); assert.equal(s.seals.length, 1);
});

test('cura consome poção só quando há vida a recuperar', () => {
  const s = play(); step(s, { heal: true }); assert.equal(s.player.potions, 5);
  s.player.hp = 10; step(s, { heal: true }); assert.equal(s.player.hp, 65); assert.equal(s.player.potions, 4);
});

test('chefe desperta com três selos e alterna avisos, sopro e projéteis', () => {
  const s = play(); s.player.z = -12; step(s); assert.equal(s.boss.active, false);
  s.seals = ['cinza', 'eco', 'noite']; step(s); assert.equal(s.boss.active, true);
  advance(s, 2.1); assert.ok(s.hazards.some(h => h.type === 'meteor' && h.warning > 0));
  s.player.x = 19; s.player.z = -20; advance(s, 3.3); assert.ok(s.hazards.some(h => h.type === 'breath'));
  advance(s, 3.4); assert.ok(s.projectiles.some(p => p.hostile));
});

test('morte retorna ao checkpoint com selos, vida e estado de combate limpo', () => {
  const s = play(); s.checkpoint = 'dungeon'; s.seals = ['cinza']; s.player.hp = 5;
  s.hazards = [{ id: 1, type: 'meteor', x: 0, z: 12, radius: 2, warning: 0, active: 0.5 }];
  step(s); assert.equal(s.status, 'dead');
  const next = respawn(s); assert.equal(next.status, 'playing'); assert.equal(next.zone, 'dungeon');
  assert.deepEqual(next.seals, ['cinza']); assert.equal(next.player.hp, 100); assert.equal(next.hazards.length, 0);
});

test('vitória fecha combate; reinício não herda selos nem perigos', () => {
  const s = play(); s.seals = ['cinza', 'eco', 'noite']; s.player.z = -12;
  s.boss.hp = 20; s.player.mana = 100; step(s, { burst: true });
  // A ativação ocorre após a entrada; a próxima explosão atinge o chefe ativo.
  s.player.burstCd = 0; step(s, { burst: true });
  assert.equal(s.status, 'won'); assert.equal(s.boss.hp, 0); assert.equal(s.hazards.length, 0);
  const fresh = createState(); assert.equal(fresh.seals.length, 0); assert.equal(fresh.boss.active, false);
});

test('save versão 1 recompõe checkpoint; ids desconhecidos e duplicados não entram', () => {
  const s = createState({ version: 1, seals: ['cinza', 'cinza', 'fantasma'], zone: 'dungeon', kills: 3 });
  assert.deepEqual(s.seals, ['cinza']); assert.equal(s.player.z, 13);
  assert.deepEqual(snapshotSave(s), { version: 1, seals: ['cinza'], zone: 'dungeon', kills: 3 });
});
