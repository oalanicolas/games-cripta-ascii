export const RULES = Object.freeze({
  step: 1 / 60, speed: 4.8, radius: 0.34, health: 100, mana: 100,
  fireCost: 5, fireDelay: 0.32, fireSpeed: 18, fireDamage: 26,
  burstCost: 32, burstDelay: 4, burstRadius: 5, burstDamage: 50,
  dodgeSpeed: 16, dodgeDuration: 0.22, dodgeDelay: 0.85,
  enemyDamage: 12, enemyRange: 1.2, bossHealth: 1100,
  checkpoint: [0, 12], dungeonSpawn: [0, 14], bossSpawn: [0, -13],
});

export const MAP = Object.freeze({
  outdoor: {
    bounds: [-25, 25, -27, 24],
    walls: [
      [-9, -2, 2, 13], [9, -2, 2, 13], [-5.2, -8, 5.5, 1.3], [5.2, -8, 5.5, 1.3],
      [-9, -10, 2, 2], [9, -10, 2, 2], [-18, 11, 3, 2], [18, 5, 3, 2],
    ],
    portal: [0, -7], shrine: [0, 12],
  },
  dungeon: {
    bounds: [-15, 15, -22, 18],
    walls: [
      [-7.5, 2, 1.2, 12], [7.5, 2, 1.2, 12], [-11.5, -5, 6, 1.2], [11.5, -5, 6, 1.2],
      [-4, -5, 2, 1.2], [4, -5, 2, 1.2], [-7.5, -15, 1.2, 13], [7.5, -15, 1.2, 13],
      [-11, 12, 5, 1.2], [11, 12, 5, 1.2],
    ],
    portal: [0, 15], shrine: [0, 13],
  },
});

export const SEALS = Object.freeze([
  { id: 'cinza', name: 'Selo da Cinza', x: -11, z: 1 },
  { id: 'eco', name: 'Selo do Eco', x: 11, z: 1 },
  { id: 'noite', name: 'Selo da Noite', x: 0, z: -17 },
]);

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export function random(seed) {
  let n = seed >>> 0;
  return () => {
    n += 0x6d2b79f5;
    let t = Math.imul(n ^ n >>> 15, 1 | n);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function enemy(id, type, x, z) {
  return { id, type, x, z, hp: type === 'wisp' ? 52 : 78, maxHp: type === 'wisp' ? 52 : 78,
    cooldown: 1, hurt: 0, facing: 0, windup: 0, attackTarget: null, alive: true };
}

export function createState(save = null) {
  const seals = Array.isArray(save?.seals) ? SEALS.filter(s => save.seals.includes(s.id)).map(s => s.id) : [];
  return {
    status: 'title', zone: save?.zone === 'dungeon' ? 'dungeon' : 'outdoor', time: 0, seed: 20261009,
    player: { x: 0, z: save?.zone === 'dungeon' ? 13 : 12, hp: 100, mana: 100, potions: 5,
      facing: Math.PI, fireCd: 0, burstCd: 0, dodgeCd: 0, dodgeTime: 0, dodgeX: 0, dodgeZ: 0,
      invulnerable: 0, hurt: 0, walk: 0, kills: save?.kills || 0 },
    enemies: {
      outdoor: [enemy('o1', 'skeleton', -4, 3), enemy('o2', 'skeleton', 4, 0), enemy('o3', 'wisp', 15, -10)],
      dungeon: [enemy('d1', 'skeleton', -10, 4), enemy('d2', 'wisp', -12, -1),
        enemy('d3', 'skeleton', 10, 4), enemy('d4', 'wisp', 12, -1),
        enemy('d5', 'skeleton', -2, -14), enemy('d6', 'skeleton', 2, -14)],
    },
    seals, checkpoint: save?.zone === 'dungeon' ? 'dungeon' : 'outdoor',
    boss: { x: 0, z: -16, hp: RULES.bossHealth, maxHp: RULES.bossHealth, active: false,
      cooldown: 2, facing: 0, phase: 1, attack: 0, hurt: 0, dead: false },
    projectiles: [], hazards: [], events: [], serial: 0, message: '', messageTime: 0, won: false,
  };
}

export function snapshotSave(s) {
  return { version: 1, seals: [...s.seals], zone: s.checkpoint, kills: s.player.kills };
}

function emit(s, type, data = {}) { s.events.push({ type, ...data }); }
function message(s, text) { s.message = text; s.messageTime = 4; }

export function collides(zone, x, z, radius = RULES.radius) {
  const map = MAP[zone], [minX, maxX, minZ, maxZ] = map.bounds;
  if (x < minX + radius || x > maxX - radius || z < minZ + radius || z > maxZ - radius) return true;
  return map.walls.some(([cx, cz, w, d]) => {
    const dx = Math.max(Math.abs(x - cx) - w / 2, 0);
    const dz = Math.max(Math.abs(z - cz) - d / 2, 0);
    return dx * dx + dz * dz < radius * radius;
  });
}

function move(s, body, dx, dz, radius = RULES.radius) {
  if (!collides(s.zone, body.x + dx, body.z, radius)) body.x += dx;
  if (!collides(s.zone, body.x, body.z + dz, radius)) body.z += dz;
}

function hurtPlayer(s, amount) {
  const p = s.player;
  if (p.invulnerable > 0 || p.dodgeTime > 0 || s.status !== 'playing') return;
  p.hp = Math.max(0, p.hp - amount); p.invulnerable = 0.65; p.hurt = 0.28;
  emit(s, 'hurt', { x: p.x, z: p.z, amount });
  if (!p.hp) { s.status = 'dead'; emit(s, 'death'); }
}

function hurtEnemy(s, e, amount) {
  if (!e.alive) return;
  e.hp = Math.max(0, e.hp - amount); e.hurt = 0.22;
  emit(s, 'hit', { x: e.x, z: e.z, amount });
  if (!e.hp) {
    e.alive = false; s.player.kills++; s.player.mana = Math.min(100, s.player.mana + 15);
    emit(s, 'kill', { x: e.x, z: e.z });
  }
}

function hurtBoss(s, amount) {
  const b = s.boss;
  if (!b.active || b.dead) return;
  b.hp = Math.max(0, b.hp - amount); b.hurt = 0.16;
  emit(s, 'hit', { x: b.x, z: b.z, amount });
  if (!b.hp) {
    b.dead = true; b.active = false; s.hazards = []; s.projectiles = []; s.won = true;
    s.status = 'won'; emit(s, 'victory');
  }
}

export function interact(s) {
  if (s.status !== 'playing') return false;
  const p = s.player, map = MAP[s.zone];
  if (Math.hypot(p.x - map.portal[0], p.z - map.portal[1]) < 2.5) {
    s.zone = s.zone === 'outdoor' ? 'dungeon' : 'outdoor';
    p.x = 0; p.z = s.zone === 'dungeon' ? 12 : -4;
    p.invulnerable = 1; s.projectiles = []; s.hazards = []; s.checkpoint = s.zone;
    message(s, s.zone === 'dungeon' ? 'A cripta desperta. Encontre os três selos.' :
      s.seals.length === 3 ? 'O dragão despertou. Atravesse o arco e enfrente-o.' : 'Você voltou às ruínas.');
    emit(s, 'portal'); emit(s, 'save'); return true;
  }
  if (s.zone === 'dungeon') {
    const seal = SEALS.find(t => !s.seals.includes(t.id) && Math.hypot(p.x - t.x, p.z - t.z) < 2.3);
    if (seal) {
      if (s.enemies.dungeon.some(e => e.alive && Math.hypot(e.x - seal.x, e.z - seal.z) < 5)) {
        message(s, 'Derrote os guardiões antes de tocar o selo.'); return false;
      }
      s.seals.push(seal.id); p.hp = Math.min(100, p.hp + 25); p.potions++;
      message(s, s.seals.length === 3 ? 'Três selos reunidos. Volte pelo portal e procure o dragão.' : `${seal.name} recuperado.`);
      emit(s, 'seal', { x: seal.x, z: seal.z }); emit(s, 'save'); return true;
    }
  }
  if (Math.hypot(p.x - map.shrine[0], p.z - map.shrine[1]) < 2.3) {
    p.hp = 100; p.mana = 100; p.potions = Math.max(p.potions, 5); s.checkpoint = s.zone;
    message(s, 'Santuário: vida, luz e poções restauradas.'); emit(s, 'heal'); emit(s, 'save'); return true;
  }
  message(s, 'Aproxime-se de um selo, portal ou santuário.'); return false;
}

export function respawn(s) {
  const fresh = createState(snapshotSave(s)); fresh.status = 'playing';
  fresh.player.invulnerable = 2;
  message(fresh, 'A tocha ainda arde. Seus selos foram preservados.');
  return fresh;
}

export function step(s, input = {}, dt = RULES.step) {
  if (s.status !== 'playing') return;
  s.events = [];
  s.time += dt; s.messageTime = Math.max(0, s.messageTime - dt);
  const p = s.player, b = s.boss;
  for (const key of ['fireCd', 'burstCd', 'dodgeCd', 'dodgeTime', 'invulnerable', 'hurt']) p[key] = Math.max(0, p[key] - dt);
  p.mana = Math.min(100, p.mana + dt * 6);
  let mx = input.x || 0, mz = input.z || 0;
  const length = Math.hypot(mx, mz);
  if (length > 1) { mx /= length; mz /= length; }
  if (input.aim && Number.isFinite(input.aim.x) && Number.isFinite(input.aim.z)) {
    p.facing = Math.atan2(input.aim.x - p.x, input.aim.z - p.z);
  } else if (length) p.facing = Math.atan2(mx, mz);
  if (input.dodge && p.dodgeCd === 0) {
    p.dodgeX = length ? mx / length : Math.sin(p.facing);
    p.dodgeZ = length ? mz / length : Math.cos(p.facing);
    p.dodgeTime = RULES.dodgeDuration; p.dodgeCd = RULES.dodgeDelay; emit(s, 'dodge', { x: p.x, z: p.z });
  }
  if (p.dodgeTime > 0) move(s, p, p.dodgeX * dt * RULES.dodgeSpeed, p.dodgeZ * dt * RULES.dodgeSpeed);
  else move(s, p, mx * dt * RULES.speed, mz * dt * RULES.speed);
  if (length) p.walk += dt * 10;
  if (input.fire && !p.fireCd && p.mana >= RULES.fireCost) {
    p.mana -= RULES.fireCost; p.fireCd = RULES.fireDelay;
    s.projectiles.push({ id: ++s.serial, x: p.x, z: p.z, dx: Math.sin(p.facing), dz: Math.cos(p.facing),
      speed: RULES.fireSpeed, ttl: 1.4, hostile: false });
    emit(s, 'fire', { x: p.x, z: p.z });
  }
  if (input.burst && !p.burstCd && p.mana >= RULES.burstCost) {
    p.mana -= RULES.burstCost; p.burstCd = RULES.burstDelay;
    for (const e of s.enemies[s.zone]) if (distance(p, e) < RULES.burstRadius) hurtEnemy(s, e, RULES.burstDamage);
    if (s.zone === 'outdoor' && distance(p, b) < RULES.burstRadius + 2.5) hurtBoss(s, RULES.burstDamage);
    emit(s, 'burst', { x: p.x, z: p.z });
  }
  if (input.heal && p.potions && p.hp < 100) {
    p.potions--; p.hp = Math.min(100, p.hp + 55); emit(s, 'heal', { x: p.x, z: p.z });
  }
  if (input.interact) interact(s);
  for (const e of s.enemies[s.zone]) {
    if (!e.alive) continue;
    e.cooldown = Math.max(0, e.cooldown - dt); e.hurt = Math.max(0, e.hurt - dt);
    const d = distance(e, p); e.facing = Math.atan2(p.x - e.x, p.z - e.z);
    if (e.windup > 0) {
      e.windup -= dt;
      if (e.windup <= 0) {
        if (e.type === 'wisp') {
          const angle = Math.atan2(e.attackTarget.x - e.x, e.attackTarget.z - e.z);
          s.projectiles.push({ id: ++s.serial, x: e.x, z: e.z, dx: Math.sin(angle), dz: Math.cos(angle),
            speed: 6, ttl: 2.5, hostile: true });
        } else if (d < 1.6) hurtPlayer(s, RULES.enemyDamage);
        e.cooldown = e.type === 'wisp' ? 2.2 : 1.4;
      }
    } else if (d < (e.type === 'wisp' ? 8 : RULES.enemyRange) && !e.cooldown) {
      e.windup = 0.6; e.attackTarget = { x: p.x, z: p.z }; emit(s, 'enemy-windup', { x: e.x, z: e.z });
    } else if (d < 12 && d > (e.type === 'wisp' ? 5 : 0.9)) {
      const speed = e.type === 'wisp' ? 1.2 : 1.6;
      move(s, e, Math.sin(e.facing) * speed * dt, Math.cos(e.facing) * speed * dt, 0.3);
    }
  }
  if (s.zone === 'outdoor' && s.seals.length === 3 && !b.dead && p.z < -10 && !b.active) {
    b.active = true; message(s, 'O guardião da cinza despertou. Evite o fogo anunciado no chão.'); emit(s, 'boss');
  }
  if (b.active && s.zone === 'outdoor') {
    b.phase = b.hp < b.maxHp * 0.32 ? 3 : b.hp < b.maxHp * 0.65 ? 2 : 1;
    b.hurt = Math.max(0, b.hurt - dt); b.cooldown -= dt;
    b.facing = Math.atan2(p.x - b.x, p.z - b.z);
    if (b.cooldown <= 0) {
      b.attack++;
      if (b.attack % 3 === 1) {
        for (let k = 0; k < b.phase + 2; k++) {
          const angle = k * 2.1 + b.attack;
          s.hazards.push({ id: ++s.serial, type: 'meteor', x: p.x + Math.sin(angle) * k * 1.6,
            z: p.z + Math.cos(angle) * k * 1.6, radius: 1.8, warning: 1.5, active: 0.45 });
        }
      } else if (b.attack % 3 === 2) {
        s.hazards.push({ id: ++s.serial, type: 'breath', x: b.x, z: b.z, angle: b.facing,
          radius: 10, warning: 1.3, active: 1.1 });
      } else {
        for (let k = 0; k < 8 + b.phase * 2; k++) {
          const a = k * Math.PI * 2 / (8 + b.phase * 2);
          s.projectiles.push({ id: ++s.serial, x: b.x, z: b.z, dx: Math.sin(a), dz: Math.cos(a),
            speed: 5 + b.phase, ttl: 3.2, hostile: true });
        }
      }
      b.cooldown = 3.6 - b.phase * 0.4; emit(s, 'boss-attack');
    }
  }
  for (const h of s.hazards) {
    if (h.warning > 0) {
      h.warning -= dt;
      if (h.warning <= 0) emit(s, 'explosion', { x: h.x, z: h.z, radius: h.radius, breath: h.type === 'breath' });
    } else {
      h.active -= dt;
      if (h.type === 'meteor' && distance(p, h) < h.radius + RULES.radius) hurtPlayer(s, 25);
      if (h.type === 'breath') {
        const a = Math.atan2(p.x - h.x, p.z - h.z);
        const delta = Math.atan2(Math.sin(a - h.angle), Math.cos(a - h.angle));
        if (distance(p, h) < h.radius && Math.abs(delta) < 0.42) hurtPlayer(s, 22);
      }
    }
  }
  s.hazards = s.hazards.filter(h => h.warning > 0 || h.active > 0);
  for (const q of s.projectiles) {
    q.ttl -= dt;
    const subdivisions = Math.ceil(q.speed * dt / 0.16);
    for (let k = 0; k < subdivisions && q.ttl > 0; k++) {
      q.x += q.dx * q.speed * dt / subdivisions; q.z += q.dz * q.speed * dt / subdivisions;
      if (collides(s.zone, q.x, q.z, 0.1)) { q.ttl = 0; break; }
      if (q.hostile) {
        if (distance(q, p) < 0.6) { hurtPlayer(s, 14); q.ttl = 0; }
      } else {
        const e = s.enemies[s.zone].find(e => e.alive && distance(q, e) < 0.65);
        if (e) { hurtEnemy(s, e, RULES.fireDamage); q.ttl = 0; }
        else if (s.zone === 'outdoor' && b.active && distance(q, b) < 2.7) { hurtBoss(s, RULES.fireDamage); q.ttl = 0; }
      }
    }
  }
  s.projectiles = s.projectiles.filter(q => q.ttl > 0);
  p.hp = clamp(p.hp, 0, 100);
}
