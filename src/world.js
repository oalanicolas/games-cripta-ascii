import * as THREE from 'three';
import { MAP, SEALS, random } from './rules.js';

const vertexShader = `
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vLocal;
varying vec2 vUv;
uniform float uTime;
uniform float uSway;
void main(){
  vec3 p=position;
  vLocal=p; vUv=uv;
  vec4 wp=vec4(p,1.0);
  vec3 n=normal;
  #ifdef USE_INSTANCING
  wp=instanceMatrix*wp;
  n=mat3(instanceMatrix)*n;
  #endif
  wp=modelMatrix*wp;
  wp.x+=sin(uTime*1.7+wp.x*0.6+wp.z)*uSway*uv.y*uv.y;
  vWorld=wp.xyz;
  vNormal=normalize(mat3(modelMatrix)*n);
  gl_Position=projectionMatrix*viewMatrix*wp;
}`;

const fragmentShader = `
uniform sampler2D uAtlas;
uniform vec3 uColor;
uniform vec3 uPlayer;
uniform vec3 uFocus;
uniform float uTime;
uniform float uDensity;
uniform float uAmbient;
uniform float uEmissive;
uniform float uThunder;
uniform float uDungeon;
uniform float uFoliage;
uniform float uLocal;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vLocal;
varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  vec3 n=normalize(vNormal);
  vec3 p=mix(vWorld,vLocal,uLocal);
  vec3 an=abs(n);
  vec2 coord=an.y>an.x&&an.y>an.z ? p.xz : an.x>an.z ? p.zy : p.xy;
  coord*=vec2(1.5,1.0)*uDensity;
  if(uFoliage>0.5)coord=vUv;
  vec2 cell=floor(coord);
  vec2 inside=fract(coord);
  float r=hash(cell);
  float glyph=floor(r*79.0)+16.0;
  if(uFoliage>0.5){
    r=hash(floor(vWorld.xz*4.0));
    glyph=r<0.34?15.0:r<0.68?60.0:92.0;
  }
  vec2 offset=vec2(mod(glyph,16.0),floor(glyph/16.0));
  float ink=texture2D(uAtlas,(offset+vec2(inside.x,1.0-inside.y))/vec2(16.0,6.0)).r;
  float light=0.30+max(0.0,dot(n,normalize(vec3(-0.3,0.8,0.4))))*0.65;
  float torch=pow(max(0.0,1.0-distance(vWorld,uPlayer)/9.0),2.0);
  float flame=0.94+0.06*sin(uTime*13.0+vWorld.x);
  vec3 base=uColor*light*(uAmbient+uThunder*0.9);
  base+=mix(vec3(1.0,0.49,0.12),vec3(0.80,0.92,0.20),uDungeon)*torch*flame*0.43*(uDungeon>0.5?0.9:0.55);
  if(uDungeon>0.5)base+=uColor*torch*1.8;
  base+=uColor*uEmissive;
  float detail=0.65+0.55*r;
  float mask=ink*0.94+0.035;
  if(uFoliage>0.5 && ink<0.15)discard;
  vec3 c=base*mask*detail*(uFoliage>0.5?1.55:1.0);
  float range=length(vWorld.xz-uFocus.xz);
  float fog=smoothstep(uDungeon>0.5?9.0:16.0,uDungeon>0.5?20.0:34.0,range);
  c=mix(c,vec3(0.014,0.016,0.030),fog);
  gl_FragColor=vec4(pow(max(c,vec3(0.0)),vec3(0.62)),1.0);
}`;

function glyphAtlas() {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 512, 192);
  ctx.font = '25px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
  for (let k = 0; k < 96; k++) ctx.fillText(String.fromCharCode(32 + k), k % 16 * 32 + 16, Math.floor(k / 16) * 32 + 16);
  const texture = new THREE.CanvasTexture(canvas); texture.flipY = false;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setClearColor('#090a13'); renderer.setPixelRatio(window.devicePixelRatio);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  const atlas = glyphAtlas(), materials = [], rng = random(20261009), dummy = new THREE.Object3D();
  const common = { uAtlas: { value: atlas }, uPlayer: { value: new THREE.Vector3(0, 1.6, 12) },
    uFocus: { value: new THREE.Vector3(0, 0, 12) }, uTime: { value: 0 }, uThunder: { value: 0 },
    uDungeon: { value: 0 }, uAmbient: { value: 0.65 } };
  function material(color, density = 9, options = {}) {
    const m = new THREE.ShaderMaterial({ vertexShader, fragmentShader, side: THREE.DoubleSide,
      uniforms: { ...common, uColor: { value: new THREE.Color(color) }, uDensity: { value: density },
        uEmissive: { value: options.glow || 0 }, uSway: { value: options.sway || 0 },
        uFoliage: { value: options.foliage ? 1 : 0 }, uLocal: { value: options.local ? 1 : 0 } } });
    materials.push(m); return m;
  }
  const stone = material('#8da2ac', 8), moss = material('#587d57', 9), darkStone = material('#657762', 10);
  const groundMat = material('#41624c', 13), dirtMat = material('#706247', 14);
  const bark = material('#79745a', 9), leaf = material('#47694f', 8, { sway: 0.1 });
  const grass = material('#60946b', 10, { foliage: true, sway: 0.17 });
  const bone = material('#adb2a0', 12, { local: true }), cloak = material('#6b7880', 11, { local: true });
  const metal = material('#a3bcc6', 14, { local: true }), hide = material('#bd8152', 9, { local: true });
  const redWing = material('#844b36', 8, { local: true });
  const glow = material('#ffc057', 10, { glow: 2, local: true });
  const yellow = material('#c8d771', 10, { glow: 1.4, local: true });
  const outdoor = new THREE.Group(), dungeon = new THREE.Group(); scene.add(outdoor, dungeon);
  const dynamic = new THREE.Group(); scene.add(dynamic);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1), sphereGeo = new THREE.SphereGeometry(1, 12, 10);
  const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
  function mesh(geo, mat, parent, position = [0, 0, 0], scale = [1, 1, 1]) {
    const m = new THREE.Mesh(geo, mat); m.position.set(...position); m.scale.set(...scale); parent.add(m); return m;
  }
  function box(parent, mat, x, y, z, w, h, d) { return mesh(boxGeo, mat, parent, [x, y, z], [w, h, d]); }
  function sphere(parent, mat, x, y, z, sx, sy = sx, sz = sx) { return mesh(sphereGeo, mat, parent, [x, y, z], [sx, sy, sz]); }
  function segment(parent, mat, from, to, radius, tip = radius) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), direction = b.clone().sub(a);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(tip, radius, direction.length(), 8), mat);
    m.position.copy(a.add(b).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    parent.add(m); return m;
  }
  function instances(parent, geometry, mat, transforms) {
    const obj = new THREE.InstancedMesh(geometry, mat, transforms.length);
    transforms.forEach((t, i) => { dummy.position.set(...t.p); dummy.rotation.set(...(t.r || [0, 0, 0]));
      dummy.scale.set(...(t.s || [1, 1, 1])); dummy.updateMatrix(); obj.setMatrixAt(i, dummy.matrix); });
    obj.computeBoundingSphere(); parent.add(obj); return obj;
  }

  const terrain = new THREE.PlaneGeometry(62, 62, 70, 70); terrain.rotateX(-Math.PI / 2);
  const pos = terrain.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, (Math.sin(x * 0.7) * Math.sin(z * 0.4) * 0.06) - 0.06);
  }
  terrain.computeVertexNormals(); mesh(terrain, groundMat, outdoor);
  mesh(new THREE.PlaneGeometry(7, 42).rotateX(-Math.PI / 2), dirtMat, outdoor, [0, 0.005, -1]);
  const blade = new THREE.PlaneGeometry(0.16, 0.75, 1, 2); blade.translate(0, 0.37, 0);
  const grassTransforms = [];
  for (let i = 0; i < 90000; i++) {
    const x = (rng() - 0.5) * 58, z = (rng() - 0.5) * 58;
    if (Math.abs(x) < 3 && z < 16 && z > -24) continue;
    grassTransforms.push({ p: [x, 0, z], r: [0, rng() * Math.PI, (rng() - 0.5) * 0.4], s: [0.6 + rng(), 0.5 + rng() * 0.8, 1] });
  }
  instances(outdoor, blade, grass, grassTransforms);
  const rocks = [];
  for (let i = 0; i < 280; i++) {
    const x = (rng() - 0.5) * 56, z = (rng() - 0.5) * 56;
    if (Math.abs(x) < 4) continue;
    rocks.push({ p: [x, 0.05, z], r: [rng(), rng(), rng()], s: [0.18 + rng() * 0.4, 0.15 + rng() * 0.2, 0.2 + rng() * 0.5] });
  }
  instances(outdoor, new THREE.IcosahedronGeometry(1, 1), darkStone, rocks);
  const treeLeaves = [], trunks = [];
  for (let k = 0; k < 65; k++) {
    const x = (rng() - 0.5) * 58, z = (rng() - 0.5) * 58;
    if (Math.abs(x) < 12 || Math.hypot(x, z - 12) < 8) continue;
    const h = 4 + rng() * 4;
    trunks.push({ p: [x, h / 2, z], s: [0.19 + rng() * 0.15, h, 0.23] });
    for (let j = 0; j < 5; j++) {
      const a = rng() * Math.PI * 2, y = h * (0.5 + rng() * 0.35);
      segment(outdoor, bark, [x, y, z], [x + Math.sin(a) * 1.7, y + 0.6, z + Math.cos(a) * 1.7], 0.1, 0.02);
      treeLeaves.push({ p: [x + Math.sin(a) * 1.3, y + 1, z + Math.cos(a) * 1.3], s: [1.7, 1.5, 1.6], r: [rng(), rng(), rng()] });
    }
  }
  instances(outdoor, cylinderGeo, bark, trunks);
  instances(outdoor, new THREE.IcosahedronGeometry(1, 2), leaf, treeLeaves);

  function wall(parent, cx, cz, w, d, height = 4.8, mat = stone) {
    box(parent, mat, cx, height / 2, cz, w, height, d);
    const masonry = [];
    const count = Math.ceil(w / 0.75);
    for (let row = 0; row < Math.ceil(height / 0.47); row++) {
      for (let k = 0; k < count; k++) {
        const x = cx - w / 2 + (k + 0.5) * w / count;
        masonry.push({ p: [x, 0.24 + row * 0.47, cz + d / 2 + 0.028], s: [w / count - 0.05, 0.42, 0.045 + rng() * 0.05] });
      }
    }
    instances(parent, boxGeo, mat, masonry);
    for (let j = 0; j < Math.ceil(w / 1.4); j++) box(parent, mat, cx - w / 2 + (j + 0.5) * w / Math.ceil(w / 1.4), height + 0.32, cz, 0.75, 0.65, d + 0.08);
    box(parent, moss, cx, 0.45, cz + d / 2 + 0.06, w, 0.5, 0.09);
  }
  for (const [x, z, w, d] of MAP.outdoor.walls) wall(outdoor, x, z, w, d, w < 3 ? 5.8 : 4.8);
  function arch(parent, x, z, width, height, mat = stone) {
    const radius = width / 2, base = height - radius;
    wall(parent, x - radius - 0.45, z, 0.85, 1.05, base, mat);
    wall(parent, x + radius + 0.45, z, 0.85, 1.05, base, mat);
    for (let k = 0; k < 15; k++) {
      const a = (k + 0.5) / 15 * Math.PI;
      const block = box(parent, mat, x + Math.cos(a) * (radius + 0.3), base + Math.sin(a) * (radius + 0.3), z, 0.65, 0.8, 1.1);
      block.rotation.z = a - Math.PI / 2;
    }
  }
  arch(outdoor, 0, -8, 4.2, 5.6);
  for (const x of [-9, 9]) {
    box(outdoor, stone, x, 3, -8, 2.7, 6, 2.7);
    box(outdoor, moss, x, 6.1, -8, 3, 0.45, 3);
    for (const z of [-9, -7]) box(outdoor, stone, x, 6.6, z, 2.7, 0.7, 0.5);
  }
  for (const x of [-5.5, 5.5]) {
    box(outdoor, stone, x, 2.6, 4, 0.8, 5.2, 0.9);
    sphere(outdoor, moss, x, 5.2, 4, 0.55, 0.4, 0.6);
  }
  const flags = [];
  for (const x of [-8.1, 8.1]) {
    segment(outdoor, metal, [x, 1, -6.6], [x, 5, -6.6], 0.035);
    const banner = box(outdoor, redWing, x + 0.48, 3.8, -6.6, 0.92, 1.85, 0.035); flags.push(banner);
  }
  const rubble = [];
  for (let k = 0; k < 75; k++) {
    const x = (rng() < 0.5 ? -1 : 1) * (4.1 + rng() * 6), z = -4 + rng() * 18;
    rubble.push({ p: [x, 0.2, z], r: [rng(), rng(), rng()], s: [0.25 + rng() * 0.7, 0.3, 0.5] });
  }
  instances(outdoor, boxGeo, stone, rubble);

  mesh(new THREE.PlaneGeometry(34, 44).rotateX(-Math.PI / 2), darkStone, dungeon, [0, -0.03, -2]);
  for (const [x, z, w, d] of MAP.dungeon.walls) wall(dungeon, x, z, w, d, 3.5, darkStone);
  for (const [x, z, w, d] of [[-15.8, -2, 1.3, 42], [15.8, -2, 1.3, 42], [0, -22.6, 32, 1.2], [0, 18.6, 32, 1.2]]) wall(dungeon, x, z, w, d, 3.8, darkStone);
  for (const z of [8, -4, -12]) arch(dungeon, 0, z, 4.3, 4.2, darkStone);
  const tiles = [];
  for (let x = -14; x < 15; x += 1.2) for (let z = -21; z < 18; z += 1.2) {
    tiles.push({ p: [x, -0.005, z], s: [1.12, 0.04, 1.12], r: [0, (rng() - 0.5) * 0.01, 0] });
  }
  instances(dungeon, boxGeo, darkStone, tiles);
  for (const x of [-12, 12]) for (const z of [-18, -10, 6, 14]) {
    box(dungeon, darkStone, x, 0.3, z, 1.6, 0.6, 0.9);
    box(dungeon, bone, x, 0.62, z, 1.7, 0.08, 1);
    for (let j = 0; j < 4; j++) sphere(dungeon, bone, x + (rng() - 0.5), 0.2, z + (rng() - 0.5), 0.14);
  }

  function ring(parent, x, z, radius, color, opacity = 1) {
    const geometry = new THREE.RingGeometry(radius - 0.06, radius, 72);
    geometry.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x, 0.055, z); parent.add(m); return m;
  }
  function rune(parent, x, z, color) {
    const group = new THREE.Group(); group.position.set(x, 0, z); parent.add(group);
    ring(group, 0, 0, 1.05, color, 0.8);
    const shape = mesh(new THREE.OctahedronGeometry(0.34), yellow, group, [0, 1.2, 0], [1, 1.5, 1]);
    box(group, darkStone, 0, 0.22, 0, 0.95, 0.44, 0.95);
    return { group, shape };
  }
  const seals = SEALS.map(s => ({ ...rune(dungeon, s.x, s.z, '#c9d46c'), id: s.id }));
  const shrineOutdoor = rune(outdoor, 0, 12, '#deb87c'), shrineDungeon = rune(dungeon, 0, 13, '#c6d46c');
  const portalOutdoor = ring(outdoor, 0, -7, 1.1, '#bcc773'), portalDungeon = ring(dungeon, 0, 15, 1.1, '#bcc773');
  const motesGeo = new THREE.BufferGeometry(), motePositions = [];
  for (let k = 0; k < 200; k++) motePositions.push((rng() - 0.5) * 28, rng() * 5, (rng() - 0.5) * 40);
  motesGeo.setAttribute('position', new THREE.Float32BufferAttribute(motePositions, 3));
  dungeon.add(new THREE.Points(motesGeo, new THREE.PointsMaterial({ color: '#b8cb5a', size: 0.045, transparent: true, opacity: 0.55, depthWrite: false })));

  function humanoid(isSkeleton = false) {
    const body = new THREE.Group(), mat = isSkeleton ? bone : cloak;
    const torso = sphere(body, mat, 0, 1.02, 0, 0.25, 0.38, 0.16);
    sphere(body, isSkeleton ? bone : metal, 0, 1.55, 0, 0.19, 0.22, 0.18);
    box(body, material(isSkeleton ? '#12150d' : '#151c23', 14, { local: true }), 0, 1.55, 0.16, 0.26, 0.065, 0.035);
    if (!isSkeleton) {
      const capeGeo = new THREE.ConeGeometry(0.45, 1.08, 9, 3, true, 0, Math.PI * 1.4);
      const cape = mesh(capeGeo, cloak, body, [0, 0.92, -0.18]); cape.rotation.y = Math.PI * 0.3;
      sphere(body, metal, -0.32, 1.25, 0, 0.15); sphere(body, metal, 0.32, 1.25, 0, 0.15);
    } else {
      for (let k = 0; k < 4; k++) box(body, bone, 0, 0.89 + k * 0.13, 0.04, 0.5 - k * 0.055, 0.045, 0.12);
    }
    const limbs = [];
    for (const sign of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(sign * 0.15, 0.78, 0); body.add(leg);
      segment(leg, mat, [0, 0, 0], [0, -0.48, 0], 0.095, 0.07);
      box(leg, isSkeleton ? bone : metal, 0, -0.68, 0.06, 0.16, 0.28, 0.25); limbs.push(leg);
      const arm = new THREE.Group(); arm.position.set(sign * 0.29, 1.27, 0); body.add(arm);
      segment(arm, mat, [0, 0, 0], [sign * 0.07, -0.35, 0.07], 0.075);
      segment(arm, mat, [sign * 0.07, -0.35, 0.07], [sign * 0.05, -0.37, 0.35], 0.065);
      limbs.push(arm);
    }
    segment(body, isSkeleton ? bone : bark, [0.34, 0.9, 0.3], [0.34, 1.65, 0.3], 0.04);
    const flame = sphere(body, glow, 0.34, 1.7, 0.3, 0.085, 0.18, 0.08);
    if (isSkeleton) flame.visible = false;
    return { body, limbs, torso, flame };
  }
  const hero = humanoid(); dynamic.add(hero.body);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.62, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#030609', transparent: true, opacity: 0.55, depthWrite: false }));
  shadow.position.y = 0.06; dynamic.add(shadow);
  const actors = new Map();
  for (const [zone, es] of Object.entries({ outdoor: [['o1', 'skeleton'], ['o2', 'skeleton'], ['o3', 'wisp']],
    dungeon: [['d1', 'skeleton'], ['d2', 'wisp'], ['d3', 'skeleton'], ['d4', 'wisp'], ['d5', 'skeleton'], ['d6', 'skeleton']] })) {
    for (const [id, type] of es) {
      const actor = type === 'skeleton' ? humanoid(true) : { body: new THREE.Group(), limbs: [] };
      if (type === 'wisp') {
        sphere(actor.body, yellow, 0, 1.3, 0, 0.28, 0.36, 0.28);
        for (let k = 0; k < 6; k++) segment(actor.body, yellow, [0, 1.25, 0], [Math.sin(k) * 0.35, 0.3 + rng() * 0.3, Math.cos(k) * 0.35], 0.035, 0.005);
      }
      actors.set(id, actor); dynamic.add(actor.body);
    }
  }

  const dragon = new THREE.Group(); outdoor.add(dragon);
  const dragonBody = sphere(dragon, hide, 0, 2.8, 0, 1.35, 1.4, 2.1);
  sphere(dragon, hide, 0, 2.35, 1.3, 1.05, 1.2, 1.3);
  segment(dragon, hide, [0, 2.6, 1.5], [0, 3.5, 2.6], 0.7, 0.48);
  sphere(dragon, hide, 0, 3.8, 2.9, 0.62, 0.46, 0.83);
  sphere(dragon, hide, 0, 3.5, 3.6, 0.45, 0.25, 0.55);
  const eyes = material('#ffb43d', 14, { glow: 2, local: true });
  for (const side of [-1, 1]) {
    sphere(dragon, eyes, side * 0.5, 3.94, 3.15, 0.095);
    segment(dragon, bone, [side * 0.35, 4.0, 2.6], [side * 0.6, 4.85, 2.05], 0.19, 0.015);
    segment(dragon, hide, [side * 0.9, 2.8, 1], [side * 1.65, 1.2, 1.35], 0.38, 0.23);
    segment(dragon, hide, [side * 1.65, 1.2, 1.35], [side * 1.8, 0.4, 2], 0.23, 0.16);
    sphere(dragon, hide, side * 1.8, 0.4, 2.2, 0.45, 0.25, 0.65);
    segment(dragon, hide, [side * 1.05, 2.1, -1.1], [side * 1.7, 0.5, -1.5], 0.5, 0.24);
    for (let k = 0; k < 3; k++) {
      segment(dragon, bone, [side * 1.8 + (k - 1) * 0.2, 0.4, 2.4], [side * 1.8 + (k - 1) * 0.22, 0.15, 2.85], 0.065, 0.005);
    }
  }
  const tail = new THREE.Group(); dragon.add(tail);
  const tailPoints = [[0, 2, -1.5], [0.7, 1.7, -3], [1.3, 1, -4.5], [2.2, 0.6, -5.5], [2.8, 0.5, -6.6]];
  for (let k = 0; k < tailPoints.length - 1; k++) segment(tail, hide, tailPoints[k], tailPoints[k + 1], 0.55 - k * 0.12, 0.42 - k * 0.12);
  for (let k = 0; k < 7; k++) {
    const z = 1.4 - k * 0.6, y = 4.15 - Math.abs(z) * 0.15;
    segment(dragon, bone, [0, y, z], [0, y + 0.65, z - 0.25], 0.2, 0);
  }
  const wings = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Group(); wing.position.set(side * 0.9, 3.4, -0.6); dragon.add(wing); wings.push(wing);
    const verts = [[0, 0, 0], [side * 2.3, 1.8, -1.3], [side * 5.3, 1.0, -1.8], [side * 4.0, -0.5, 0.2], [side * 3.0, -0.55, 1.2], [side * 1.7, -0.7, 1.75]];
    const faces = [];
    for (let k = 1; k < 5; k++) for (const idx of [0, k, k + 1]) faces.push(...verts[idx]);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(faces, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(faces.flatMap((_, i) => i % 3 === 0 ? [faces[i] * 0.2, faces[i + 2] * 0.2] : []), 2));
    geometry.computeVertexNormals(); mesh(geometry, redWing, wing);
    for (let k = 2; k < 6; k++) segment(wing, hide, verts[0], verts[k], 0.08, 0.02);
    segment(wing, hide, verts[0], verts[1], 0.25, 0.13); segment(wing, hide, verts[1], verts[2], 0.13, 0.01);
  }
  ring(dragon, 0, 0, 3, '#9a6c42', 0.6);

  const projectileActors = new Map(), hazardActors = new Map(), effects = [];
  const particleGeo = new THREE.BufferGeometry(), particlePositions = new Float32Array(1500 * 3);
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particles = new THREE.Points(particleGeo, new THREE.PointsMaterial({ color: '#ffbf64', size: 0.10, transparent: true, opacity: 0.9, depthWrite: false }));
  dynamic.add(particles); const sparks = [];
  const rainGeo = new THREE.BufferGeometry(), rainPositions = new Float32Array(2200 * 6);
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#a0c3cf', transparent: true, opacity: 0.23, depthWrite: false }));
  scene.add(rain);
  const rainSeeds = Array.from({ length: 2200 }, () => [rng() * 48 - 24, rng() * 16, rng() * 48 - 24]);
  let zoom = 1, currentZone = 'outdoor', reducedMotion = false, cameraReady = false;
  const focus = new THREE.Vector3(0, 0, 12), aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ray = new THREE.Raycaster();
  const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  window.addEventListener('resize', resize); resize();
  function burst(x, z, count = 45, spread = 2.5, tint = null) {
    for (let k = 0; k < count; k++) sparks.push({ x, y: 0.8, z, vx: (rng() - 0.5) * spread * 3,
      vy: 1 + rng() * spread * 2, vz: (rng() - 0.5) * spread * 3, ttl: 0.4 + rng() * 0.6 });
    if (tint) particles.material.color.set(tint);
  }
  function event(e) {
    if (['hit', 'kill', 'hurt', 'seal', 'fire', 'dodge'].includes(e.type)) burst(e.x, e.z, e.type === 'fire' ? 8 : 35, 1.4);
    if (e.type === 'burst') {
      burst(e.x, e.z, 120, 3);
      const r = ring(dynamic, e.x, e.z, 0.7, '#f4dc99'); effects.push({ mesh: r, ttl: 0.6, duration: 0.6 });
    }
    if (e.type === 'explosion') burst(e.x, e.z, 110, e.breath ? 4 : 2.5);
    if (e.type === 'portal') { sparks.length = 0; cameraReady = false; }
  }
  function update(s, dt, prefs = {}) {
    reducedMotion = prefs.reducedMotion;
    const t = s.time, p = s.player, paused = s.status !== 'playing';
    outdoor.visible = s.zone === 'outdoor'; dungeon.visible = s.zone === 'dungeon'; rain.visible = outdoor.visible;
    if (currentZone !== s.zone) { currentZone = s.zone; cameraReady = false; }
    common.uDungeon.value = dungeon.visible ? 1 : 0; common.uAmbient.value = dungeon.visible ? 0.045 : 1.25;
    common.uThunder.value = !reducedMotion && outdoor.visible && t % 14 > 10 && t % 14 < 10.18 ? 0.85 : 0;
    common.uTime.value = t; common.uPlayer.value.set(p.x, 1.7, p.z);
    if (!cameraReady) { focus.set(p.x, 0, p.z); cameraReady = true; }
    focus.lerp(new THREE.Vector3(p.x, 0, p.z - (s.status === 'title' ? 5 : 0)), 1 - Math.exp(-dt * 8));
    common.uFocus.value.copy(focus);
    camera.position.set(focus.x, 18 * zoom, focus.z + 16 * zoom); camera.lookAt(focus.x, 0.4, focus.z - 1.5);
    hero.body.position.set(p.x, p.dodgeTime > 0 ? 0.1 : 0, p.z); hero.body.rotation.y = p.facing;
    hero.body.rotation.z = p.dodgeTime > 0 ? -0.18 : 0;
    hero.body.visible = s.status !== 'dead' || t % 0.3 > 0.15;
    const moving = p.walk;
    hero.limbs[0].rotation.x = Math.sin(moving) * 0.35; hero.limbs[2].rotation.x = -Math.sin(moving) * 0.35;
    hero.limbs[1].rotation.x = Math.sin(moving) * 0.15; hero.limbs[3].rotation.x = p.fireCd > 0.15 ? -0.6 : 0;
    hero.flame.scale.y = 0.18 * (0.9 + Math.sin(t * 12) * 0.15);
    shadow.position.set(p.x, 0.06, p.z);
    for (const [id, actor] of actors) {
      const e = s.enemies[s.zone].find(e => e.id === id);
      actor.body.visible = !!e?.alive;
      if (!e) continue;
      actor.body.position.set(e.x, e.type === 'wisp' ? Math.sin(t * 3 + e.x) * 0.18 : 0, e.z);
      actor.body.rotation.y = e.facing;
      if (e.windup > 0) actor.body.scale.setScalar(1 + Math.sin(t * 15) * 0.06); else actor.body.scale.setScalar(1);
      actor.limbs.forEach((part, k) => part.rotation.x = Math.sin(t * 5 + k * Math.PI) * 0.35);
    }
    for (const r of seals) { r.group.visible = !s.seals.includes(r.id); r.shape.rotation.y = t; r.shape.position.y = 1.2 + Math.sin(t * 2) * 0.12; }
    shrineOutdoor.shape.rotation.y = t * 0.5; shrineDungeon.shape.rotation.y = t * 0.5;
    portalOutdoor.material.opacity = portalDungeon.material.opacity = 0.6 + Math.sin(t * 3) * 0.2;
    const b = s.boss;
    dragon.visible = s.seals.length === 3;
    dragon.position.set(b.x, b.dead ? -2.1 : 0, b.z); dragon.rotation.y = b.facing;
    dragonBody.scale.y = 1.4 + Math.sin(t * 1.8) * 0.065;
    wings.forEach((w, k) => { w.rotation.z = (k ? -1 : 1) * (0.08 + Math.sin(t * 1.6) * 0.16); });
    tail.rotation.y = Math.sin(t * 0.8) * 0.15;
    flags.forEach((f, k) => f.rotation.z = Math.sin(t * 3 + k) * 0.06);
    for (const q of s.projectiles) {
      let obj = projectileActors.get(q.id);
      if (!obj) { obj = sphere(dynamic, q.hostile ? yellow : glow, q.x, 1.0, q.z, 0.14); projectileActors.set(q.id, obj); }
      obj.position.set(q.x, 1.0, q.z); if (!paused && rng() < 0.7) burst(q.x, q.z, 1, 0.2);
    }
    for (const [id, obj] of projectileActors) if (!s.projectiles.some(q => q.id === id)) { dynamic.remove(obj); projectileActors.delete(id); }
    for (const h of s.hazards) {
      let obj = hazardActors.get(h.id);
      if (!obj) {
        if (h.type === 'breath') {
          const geo = new THREE.CircleGeometry(h.radius, 50, -0.42, 0.84); geo.rotateX(-Math.PI / 2); geo.rotateY(h.angle - Math.PI / 2);
          obj = mesh(geo, new THREE.MeshBasicMaterial({ color: '#f0954a', transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }), dynamic, [h.x, 0.09, h.z]);
        } else { obj = ring(dynamic, h.x, h.z, h.radius, '#ed9d53'); }
        hazardActors.set(h.id, obj);
      }
      obj.material.opacity = h.warning > 0 ? 0.45 + Math.sin(t * 10) * 0.2 : 0.9;
      obj.material.color.set(h.warning > 0 ? '#ecac64' : '#ff6429');
      if (h.warning <= 0 && !paused) burst(h.x, h.z, 3, 1.5);
    }
    for (const [id, obj] of hazardActors) if (!s.hazards.some(q => q.id === id)) { dynamic.remove(obj); obj.geometry.dispose(); obj.material.dispose(); hazardActors.delete(id); }
    for (let i = effects.length - 1; i >= 0; i--) {
      const fx = effects[i]; if (!paused) fx.ttl -= dt;
      fx.mesh.scale.setScalar(1 + (1 - fx.ttl / fx.duration) * 7); fx.mesh.material.opacity = fx.ttl / fx.duration;
      if (fx.ttl <= 0) { dynamic.remove(fx.mesh); fx.mesh.geometry.dispose(); fx.mesh.material.dispose(); effects.splice(i, 1); }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const f = sparks[i]; if (!paused) { f.ttl -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; f.vy -= dt * 7; }
      if (f.ttl <= 0) sparks.splice(i, 1);
    }
    const visibleSparks = sparks.slice(-1500);
    visibleSparks.forEach((f, k) => { particlePositions[k * 3] = f.x; particlePositions[k * 3 + 1] = f.y; particlePositions[k * 3 + 2] = f.z; });
    particleGeo.setDrawRange(0, visibleSparks.length); particleGeo.attributes.position.needsUpdate = true;
    for (let k = 0; k < rainSeeds.length; k++) {
      const [x, y, z] = rainSeeds[k], height = (y - t * 13 % 16 + 16) % 16;
      rainPositions.set([p.x + x, height, p.z + z, p.x + x - 0.15, height - 0.6, p.z + z + 0.12], k * 6);
    }
    rainGeo.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
  }
  return {
    update, event,
    aim(x, y) { const r = canvas.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1), camera);
      const point = new THREE.Vector3(); return ray.ray.intersectPlane(aimPlane, point) ? { x: point.x, z: point.z } : null; },
    project(x, y, z) { const v = new THREE.Vector3(x, y, z).project(camera); return { x: (v.x + 1) / 2 * canvas.clientWidth, y: (1 - v.y) / 2 * canvas.clientHeight, visible: v.z < 1 }; },
    zoom(delta) { zoom = THREE.MathUtils.clamp(zoom + delta * 0.0006, 0.5, 1.35); },
    reset() {
      sparks.length = 0; cameraReady = false;
      for (const fx of effects) { dynamic.remove(fx.mesh); fx.mesh.geometry.dispose(); fx.mesh.material.dispose(); }
      effects.length = 0;
      for (const obj of projectileActors.values()) dynamic.remove(obj);
      projectileActors.clear();
      for (const obj of hazardActors.values()) { dynamic.remove(obj); obj.geometry.dispose(); obj.material.dispose(); }
      hazardActors.clear();
    },
    info() { const gl = renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info'); return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries }; },
    capture() { return canvas.toDataURL('image/png'); },
    dispose() { window.removeEventListener('resize', resize); renderer.dispose(); scene.traverse(obj => obj.geometry?.dispose()); materials.forEach(m => m.dispose()); atlas.dispose(); },
  };
}
