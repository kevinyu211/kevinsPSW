/* Kevin Metro · the city
   One unit is one metre. A street grid with a river, believable blocks of different kinds, parks and
   suburbs, and the structures of six metro lines: the Circle on a 9 m viaduct, Line 1 at street level along
   a boulevard, and Lines 2–5 on 18 m viaducts. Everything is generated here; nothing is loaded. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { buildLandmark } from './landmarks.js';

export const GAUGE = 1.435;
export const TRACK_OFF = 5; // track centres at ±5 m from the line centre
export const TRAIN_LAT = -TRACK_OFF; // the train uses the inner track, so it always runs clockwise around the city
export const RIVER = { z0: 170, z1: 230, water: -2.4 };
export const BOUNDS = { x0: -800, x1: 800, z0: -560, z1: 560 };
export const LOOP = { A: 520, B: 330, R: 110, y: 9 }; // half width, half depth, corner radius, rail height
const AVE_X = [-650, -520, -390, -260, -130, 0, 130, 260, 390, 520, 650]; // north–south avenues
const ST_Z = [-440, -330, -220, -110, 0, 100, 330, 440]; // east–west streets (the river runs between 100 and 330)
const isLoopAve = (x) => Math.abs(Math.abs(x) - LOOP.A) < 1;
const isLoopSt = (z) => Math.abs(Math.abs(z) - LOOP.B) < 1;
const aveW = (x) => (isLoopAve(x) ? 32 : 20);
const stW = (z) => (isLoopSt(z) ? 32 : z === 0 ? 40 : 16); // z = 0 carries Line 1 down its middle
const BRIDGE_AVES = [-390, -130, 130, 390];
const CORE = { x: -150, z: -160 }; // the tall middle of town
const RAIL_HALF = 8; // Line 1's corridor down the middle of the z = 0 boulevard

/* ---------- tiny helpers ---------- */
const rngFactory = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const vcol = (g, hex) => { g = g.index ? g.toNonIndexed() : g; const c = new THREE.Color(hex); const n = g.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.Float32BufferAttribute(a, 3)); return g; };

/* ---------- static batching: merge every static mesh per material ---------- */
export const TILE = 800;
export const tileOf = (x, z) => `${Math.floor(x / TILE)},${Math.floor(z / TILE)}`;
export class Batch {
  constructor(vc) { this.buckets = new Map(); this.vc = vc; }
  add(geo, mat, matrix, opts) {
    opts = opts || {};
    const cast = opts.cast !== false; const recv = opts.receive !== false;
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    const keepColor = mat === this.vc && g.attributes.color;
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name) && !(keepColor && name === 'color')) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (matrix) g.applyMatrix4(matrix);
    let useMat = mat;
    if (mat.userData.matte && this.vc) {
      // matte surfaces share one material; their colour rides on the vertices
      const n = g.attributes.position.count; const c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { c[i * 3] = mat.color.r; c[i * 3 + 1] = mat.color.g; c[i * 3 + 2] = mat.color.b; }
      g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
      useMat = this.vc;
    }
    g.computeBoundingBox(); const ctr = g.boundingBox.getCenter(new THREE.Vector3());
    const key = `${useMat.uuid}|${cast}|${recv}|${tileOf(ctr.x, ctr.z)}`;
    let bk = this.buckets.get(key);
    if (!bk) { bk = { mat: useMat, cast, recv, geos: [] }; this.buckets.set(key, bk); }
    bk.geos.push(g);
  }
  box(w, h, d, mat, x, y, z, ry = 0, opts) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1));
    this.add(new THREE.BoxGeometry(w, h, d), mat, m, opts);
  }
  build(parent) {
    for (const b of this.buckets.values()) {
      const merged = mergeGeometries(b.geos, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, b.mat);
      mesh.castShadow = b.cast; mesh.receiveShadow = b.recv;
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
    }
    this.buckets.clear();
  }
}

/* ---------- materials ---------- */
export function makeMaterials(lineHex) {
  const std = (color, rough = 0.85, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, side: THREE.DoubleSide, ...extra });
  const matteNames = ['asphalt', 'sidewalk', 'concrete', 'concreteDark', 'grass', 'grassDark', 'verge', 'ballast', 'white', 'ink', 'line', 'yellow', 'brick', 'wood', 'crane', 'steel', 'railSteel'];
  const M = {
    asphalt: std(0x5a5c60, 0.95),
    asphaltWet: std(0x4a4d53, 0.16, 0.1),
    sidewalk: std(0xd9d3c7, 0.92),
    concrete: std(0xc9c6bf, 0.9),
    concreteDark: std(0x9d9a94, 0.9),
    grass: std(0x93ad74, 1),
    grassDark: std(0x7e9a63, 1),
    verge: std(0xa8b48f, 1),
    ballast: std(0x8d877d, 1),
    steel: std(0x8f949b, 0.5),
    railSteel: std(0xc3c7cc, 0.45),
    water: std(0x5d8c99, 0.12, 0.15, { envMapIntensity: 1.2 }),
    white: std(0xf4f3ef, 0.6),
    ink: std(0x1f2126, 0.7),
    glass: std(0x26323e, 0.06, 0.4, { transparent: true, opacity: 0.55, envMapIntensity: 1.4 }),
    glassClear: std(0xbfd6e2, 0.05, 0.1, { transparent: true, opacity: 0.28, depthWrite: false, envMapIntensity: 1.2 }),
    line: std(lineHex, 0.5),
    yellow: std(0xf2b705, 0.6),
    brick: std(0x9b5b47, 0.95),
    wood: std(0x8a6a4b, 0.9),
    crane: std(0xe0a22a, 0.6),
    container: std(0xffffff, 0.75, 0.2),
  };
  matteNames.forEach((n) => { M[n].userData.matte = true; });
  M.vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, side: THREE.DoubleSide });
  return M;
}

/* ---------- sweeping a cross-section along the line ---------- */
// profile: [[lat, dy, absY?], ...] — dy is relative to rail level unless absY is a number (then absolute y)
export function sweep(line, s0, s1, profile, opts = {}) {
  const out = [];
  // split at the joins between straights and curves; a straight piece needs only one segment
  const cuts = [s0, s1];
  const ks = line.closed ? [-1, 0, 1, 2] : [0];
  ks.forEach((k) => line.breaks.forEach((b) => { const v = b.s0 + k * line.L; if (v > s0 + 0.01 && v < s1 - 0.01) cuts.push(v); }));
  cuts.sort((a, b) => a - b);
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i]; const b = cuts[i + 1]; const mid = line.wrap((a + b) / 2);
    const straight = line.breaks.some((q) => q.straight && mid >= q.s0 && mid < q.s1);
    if (straight && !opts.dense) { const CH = 420; for (let c = a; c < b - 0.01; c += CH) out.push(...sweepOne(line, c, Math.min(b, c + CH), profile, { ...opts, n: 1 })); }
    else out.push(...sweepOne(line, a, b, profile, opts));
  }
  return out;
}
function sweepOne(line, s0, s1, profile, opts) {
  const n = opts.n || Math.max(1, Math.ceil((s1 - s0) / (opts.step || 2)));
  const strips = [];
  for (let j = 0; j < profile.length - 1 + (opts.closed ? 1 : 0); j++) {
    const a = profile[j]; const b = profile[(j + 1) % profile.length];
    const pos = []; const idx = []; const uv = [];
    for (let i = 0; i <= n; i++) {
      const s = s0 + ((s1 - s0) * i) / n;
      const fr = line.at(s);
      [a, b].forEach((q, k) => {
        const y = q[2] !== undefined && q[2] !== null ? q[2] : fr.p.y + q[1];
        const p = fr.p.clone().add(fr.n.clone().multiplyScalar(q[0]));
        pos.push(p.x, y, p.z); uv.push(k, s / (opts.vScale || 1));
      });
      if (i < n) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    strips.push(g);
  }
  return strips;
}
const addStrips = (batch, strips, mat, opts) => strips.forEach((g) => batch.add(g, mat, null, opts));

/* ---------- the city ---------- */
export function buildCity({ scene, M, net, isPhone, landmarks, atlas, photos }) {
  const lineDist = (x, z, except) => net.dist(x, z, except);
  const rng = rngFactory(20241120);
  const batch = new Batch(M.vc);
  const anim = [];
  const ROAD_Y = 0.02;

  /* roads: avenues and streets; the river cuts every avenue that has no bridge */
  const roadRects = []; // {x0,x1,z0,z1,dir,loop,c}
  const pushRoad = (x0, x1, z0, z1, dir, loop, c) => { if (x1 - x0 > 1 && z1 - z0 > 1) roadRects.push({ x0, x1, z0, z1, dir, loop, c }); };
  AVE_X.forEach((x) => {
    const w = aveW(x) / 2;
    // avenues stop either side of Line 1's corridor (a level crossing patch is drawn below); 650 gives way to the line south of it
    const spans = BRIDGE_AVES.includes(x) ? [[BOUNDS.z0, BOUNDS.z1]] : [[BOUNDS.z0, RIVER.z0 - 4], [RIVER.z1 + 4, BOUNDS.z1]];
    spans.forEach(([a, b]) => {
      const parts = a < 0 && b > 0 ? [[a, -RAIL_HALF], [RAIL_HALF, b]] : [[a, b]];
      parts.forEach(([p, q]) => { if (x === 650 && p >= RAIL_HALF - 1 && q < RIVER.z0) return; pushRoad(x - w, x + w, p, q, 'z', isLoopAve(x), x); });
    });
  });
  ST_Z.forEach((z) => {
    const w = stW(z) / 2;
    if (z === 0) { pushRoad(BOUNDS.x0, BOUNDS.x1, -w, -RAIL_HALF, 'x', false, -(w + RAIL_HALF) / 2); pushRoad(BOUNDS.x0, BOUNDS.x1, RAIL_HALF, w, 'x', false, (w + RAIL_HALF) / 2); return; }
    pushRoad(BOUNDS.x0, BOUNDS.x1, z - w, z + w, 'x', isLoopSt(z), z);
  });
  const onRoad = (x, z, pad = 0, skipLoop = false) => roadRects.some((r) => !(skipLoop && r.loop) && x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad);
  // a pier may stand off the roads, or down the middle of a road the line runs along; never under another line
  const pierOK = (x, z, tx, tz, self) => {
    if (Math.abs(x) > BOUNDS.x1 - 4 || Math.abs(z) > BOUNDS.z1 - 4) return false;
    if (lineDist(x, z, self) < 11) return false;
    if (Math.abs(z) < RAIL_HALF + 1 && x > -770 && x < 655) return false;
    if (x > 640 && x < 660 && z > 0 && z < RIVER.z0) return false;
    const along = Math.abs(tz) > Math.abs(tx) ? 'z' : 'x';
    return !roadRects.some((r) => x > r.x0 - 1.5 && x < r.x1 + 1.5 && z > r.z0 - 1.5 && z < r.z1 + 1.5 && !(r.dir === along && Math.abs((r.dir === 'z' ? x : z) - r.c) < 2.2));
  };
  roadRects.forEach((r) => batch.box(r.x1 - r.x0, 0.04, r.z1 - r.z0, M.asphalt, (r.x0 + r.x1) / 2, ROAD_Y + (r.dir === 'x' ? 0.003 : 0), (r.z0 + r.z1) / 2, 0, { cast: false }));
  // Line 1's corridor: a planted strip, with asphalt level crossings where avenues cross it
  batch.box(BOUNDS.x1 - BOUNDS.x0, 0.06, RAIL_HALF * 2, M.grassDark, 0, 0.03, 0, 0, { cast: false });
  AVE_X.forEach((x) => { if (x > -770 && x < 655) batch.box(aveW(x), 0.05, RAIL_HALF * 2, M.asphalt, x, 0.06, 0, 0, { cast: false }); });
  // boulevard medians under the viaduct: a kerbed strip between intersections
  roadRects.filter((r) => r.loop).forEach((r) => {
    const along = r.dir; const lo = along === 'z' ? r.z0 : r.x0; const hi = along === 'z' ? r.z1 : r.x1;
    const cross = (along === 'z' ? ST_Z.map((z) => [z, stW(z) / 2]) : AVE_X.map((x) => [x, aveW(x) / 2]));
    let a = lo;
    const stops = cross.filter(([v]) => v > lo && v < hi).sort((p, q) => p[0] - q[0]).concat([[hi + 1000, 0]]);
    stops.forEach(([v, hw]) => {
      const b = Math.min(hi, v - hw - 3);
      if (b - a > 6) {
        const mid = (a + b) / 2; const len = b - a;
        if (along === 'z') batch.box(3.2, 0.22, len, M.concrete, r.c, 0.11, mid, 0, { cast: false });
        else batch.box(len, 0.22, 3.2, M.concrete, mid, 0.11, r.c, 0, { cast: false });
      }
      a = v + hw + 3;
    });
  });

  /* ground with the river channel cut out */
  const shape = new THREE.Shape();
  const G = 900;
  shape.moveTo(BOUNDS.x0 - G, BOUNDS.z0 - G); shape.lineTo(BOUNDS.x1 + G, BOUNDS.z0 - G); shape.lineTo(BOUNDS.x1 + G, BOUNDS.z1 + G); shape.lineTo(BOUNDS.x0 - G, BOUNDS.z1 + G); shape.closePath();
  const river = new THREE.Path(); // Shape is in x/y; we map y -> -z after rotating
  river.moveTo(BOUNDS.x0 - G, -RIVER.z0); river.lineTo(BOUNDS.x0 - G, -RIVER.z1); river.lineTo(BOUNDS.x1 + G, -RIVER.z1); river.lineTo(BOUNDS.x1 + G, -RIVER.z0); river.closePath();
  shape.holes.push(river);
  const groundGeo = new THREE.ShapeGeometry(shape, 1); groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, M.verge); ground.receiveShadow = true; scene.add(ground);

  /* river: water, embankment walls, promenades, road bridges */
  const rw = BOUNDS.x1 - BOUNDS.x0 + 2 * G; const rcx = (BOUNDS.x0 + BOUNDS.x1) / 2;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(rw, RIVER.z1 - RIVER.z0), M.water);
  water.rotation.x = -Math.PI / 2; water.position.set(rcx, RIVER.water, (RIVER.z0 + RIVER.z1) / 2); water.receiveShadow = true; scene.add(water);
  batch.box(rw, 4.2, 1.2, M.concrete, rcx, -1.9, RIVER.z0 + 0.6, 0, { cast: false });
  batch.box(rw, 4.2, 1.2, M.concrete, rcx, -1.9, RIVER.z1 - 0.6, 0, { cast: false });
  BRIDGE_AVES.forEach((x) => {
    const len = RIVER.z1 - RIVER.z0 + 4; const w = aveW(x);
    batch.box(w + 3, 1.4, len, M.concrete, x, -0.68, (RIVER.z0 + RIVER.z1) / 2);
    batch.box(0.4, 1.1, len, M.concrete, x - w / 2 - 1.3, 0.55, (RIVER.z0 + RIVER.z1) / 2);
    batch.box(0.4, 1.1, len, M.concrete, x + w / 2 + 1.3, 0.55, (RIVER.z0 + RIVER.z1) / 2);
    [RIVER.z0 + 18, RIVER.z1 - 18].forEach((z) => batch.box(w - 4, 3, 3, M.concreteDark, x, -2.6, z));
  });

  /* blocks: between roads (and between the outer roads and the edge of the world) */
  const xEdges = [[BOUNDS.x0, 0], ...AVE_X.map((x) => [x, aveW(x) / 2]), [BOUNDS.x1, 0]];
  const zEdges = [[BOUNDS.z0, 0], ...ST_Z.map((z) => [z, stW(z) / 2]), [BOUNDS.z1, 0]];
  const blocks = [];
  for (let i = 0; i < xEdges.length - 1; i++) for (let j = 0; j < zEdges.length - 1; j++) {
    const x0 = xEdges[i][0] + xEdges[i][1]; const x1 = xEdges[i + 1][0] - xEdges[i + 1][1];
    let z0 = zEdges[j][0] + zEdges[j][1]; let z1 = zEdges[j + 1][0] - zEdges[j + 1][1];
    const parts = [];
    if (z0 < RIVER.z0 && z1 > RIVER.z1) { parts.push([z0, RIVER.z0 - 6], [RIVER.z1 + 6, z1]); } else parts.push([z0, z1]);
    parts.forEach(([a, b]) => {
      if (b - a < 12) return;
      const cx = (x0 + x1) / 2; const cz = (a + b) / 2;
      const inLoop = Math.abs(cx) < LOOP.A && Math.abs(cz) < LOOP.B;
      const ring = !inLoop && Math.abs(cx) < 650 && Math.abs(cz) < 440;
      blocks.push({ x0, x1, z0: a, z1: b, cx, cz, zone: inLoop ? 'city' : ring ? 'ring' : 'suburb', river: a === RIVER.z1 + 6 || b === RIVER.z0 - 6 });
    });
  }
  const blockAt = (x, z) => blocks.find((b) => x >= b.x0 - 1 && x <= b.x1 + 1 && z >= b.z0 - 1 && z <= b.z1 + 1);
  const reserved = new Map();
  landmarks.forEach((lm) => { const b = blockAt(lm.x, lm.z); if (b) { reserved.set(b, lm); lm.block = b; } });
  // how close a rectangle comes to the viaduct (sampled corners, edges and centre)
  const nearLine = (r, pad) => {
    for (let a = 0; a <= 4; a++) for (let c = 0; c <= 4; c++) if (lineDist(r.x0 + ((r.x1 - r.x0) * a) / 4, r.z0 + ((r.z1 - r.z0) * c) / 4) < pad) return true;
    return false;
  };

  const lotRects = [];
  blocks.forEach((b) => {
    batch.box(b.x1 - b.x0, 0.16, b.z1 - b.z0, b.zone === 'suburb' ? M.verge : M.sidewalk, b.cx, 0.08, b.cz, 0, { cast: false });
    if (reserved.has(b)) return;
    // a few parks: in the ring, by the river, and out in the suburbs
    const park = (b.zone === 'ring' && rng() < 0.16) || (b.zone === 'suburb' && rng() < 0.3) || (b.zone === 'city' && b.river && rng() < 0.5);
    if (park) { b.park = true; return; }
    const inset = b.zone === 'suburb' ? 8 : 5;
    const X0 = b.x0 + inset; const X1 = b.x1 - inset; const Z0 = b.z0 + inset; const Z1 = b.z1 - inset;
    const longX = X1 - X0 > Z1 - Z0;
    const Lg = longX ? X1 - X0 : Z1 - Z0; const Sh = longX ? Z1 - Z0 : X1 - X0;
    const target = b.zone === 'suburb' ? 18 : b.zone === 'ring' ? 30 : 34;
    const nLong = Math.max(1, Math.round(Lg / (target + rng() * 10))); const nShort = Sh > (b.zone === 'suburb' ? 34 : 54) ? 2 : 1;
    for (let a = 0; a < nLong; a++) for (let c = 0; c < nShort; c++) {
      const la = Lg / nLong; const lc = Sh / nShort;
      const r = longX ? { x0: X0 + a * la, x1: X0 + (a + 1) * la, z0: Z0 + c * lc, z1: Z0 + (c + 1) * lc } : { x0: X0 + c * lc, x1: X0 + (c + 1) * lc, z0: Z0 + a * la, z1: Z0 + (a + 1) * la };
      if (nearLine(r, 15)) r.garden = true;
      lotRects.push({ ...r, block: b });
    }
  });

  /* generic buildings: one instanced box mesh per tile with a window shader */
  const bld = []; const trees = []; const roofsHouse = [];
  // generic buildings stay quiet (softer colour, less contrast) so the project buildings read as landmarks
  const soft = (list) => list.map((h) => new THREE.Color(h).lerp(new THREE.Color(0xd8d4cc), 0.42).getHex());
  const MASONRY = soft([0xa0533f, 0x8f4a3a, 0xb0634c, 0xd8ccb6, 0xe2d8c4, 0xece8df, 0xc9c5bc]);
  const CONCRETE = soft([0xc9c5bc, 0xb9b6ae, 0xdedad2]);
  const GLASS = soft([0x8ea3b2, 0x9fb2bf, 0x7f95a6]);
  const HOUSE = soft([0xf1ece2, 0xe6dccb, 0xd9cdb8, 0xefe6d6, 0xc9b9a0]);
  const lmDist = (x, z) => landmarks.reduce((m, l) => Math.min(m, Math.hypot(x - l.x, z - l.z)), Infinity);
  lotRects.forEach((r) => {
    const w = r.x1 - r.x0 - 3; const d = r.z1 - r.z0 - 3;
    if (w < 8 || d < 8) return;
    const cx = (r.x0 + r.x1) / 2; const cz = (r.z0 + r.z1) / 2;
    if (r.garden) { batch.box(w, 0.1, d, M.grass, cx, 0.21, cz, 0, { cast: false }); for (let k = 0; k < 2; k++) trees.push([cx + (rng() - 0.5) * w * 0.7, cz + (rng() - 0.5) * d * 0.7, 0.95 + rng() * 0.5]); return; }
    const zone = r.block.zone;
    if (zone === 'suburb') {
      // a house with a pitched roof and a garden tree
      const hw = Math.min(w, 12 + rng() * 4); const hd = Math.min(d, 10 + rng() * 3); const h = 6.6;
      bld.push({ x: cx, z: cz, w: hw, d: hd, h, y: 0.16, color: HOUSE[Math.floor(rng() * HOUSE.length)], style: 0, shop: 0, seed: rng(), noRoof: true });
      roofsHouse.push({ x: cx, z: cz, w: hw + 0.8, d: hd + 0.8, y: 0.16 + h, rot: hw > hd ? 0 : Math.PI / 2 });
      if (rng() < 0.55) trees.push([cx + (rng() < 0.5 ? -1 : 1) * (hw / 2 + 3), cz + (rng() - 0.5) * hd, 0.9 + rng() * 0.4]);
      return;
    }
    let floors;
    if (zone === 'city') {
      const dd = Math.hypot(cx - CORE.x, cz - CORE.z); const tall = dd < 300 ? 1 - dd / 300 : 0;
      floors = Math.round(3 + rng() * 4 + tall * tall * (6 + rng() * 9));
    } else floors = Math.round(2 + rng() * 3);
    // the first rows beside any line stay low, so trains are never hidden from the side camera
    const ld = lineDist(cx, cz); if (ld < 48) floors = Math.min(floors, 2 + Math.round(rng() * 2)); else if (ld < 95) floors = Math.min(floors, 4 + Math.round(rng() * 3));
    // stay low near the project buildings
    const dl = lmDist(cx, cz); if (dl < 150) floors = Math.min(floors, 2 + Math.round(rng() * 2)); else if (dl < 260) floors = Math.min(floors, 6 + Math.round(rng() * 2));
    const h = floors * 3.2 + 1.2;
    const tallish = floors > 11;
    const style = tallish ? (rng() < 0.6 ? 2 : 1) : (rng() < 0.18 ? 1 : 0);
    const color = style === 2 ? GLASS[Math.floor(rng() * GLASS.length)] : style === 1 ? CONCRETE[Math.floor(rng() * CONCRETE.length)] : MASONRY[Math.floor(rng() * MASONRY.length)];
    const shop = zone === 'city' && rng() < 0.7 ? 1 : 0; const kind = rng();
    if (w > 26 && d > 26 && kind < 0.18 && floors <= 8) {
      // a courtyard block: four wings round a hidden yard
      const t = Math.min(10, w * 0.3); [[0, -(d - t) / 2, w, t], [0, (d - t) / 2, w, t], [-(w - t) / 2, 0, t, d - 2 * t], [(w - t) / 2, 0, t, d - 2 * t]].forEach(([ox, oz, ww, dd]) => bld.push({ x: cx + ox, z: cz + oz, w: ww, d: dd, h, y: 0.16, color, style, shop, seed: rng() }));
    } else if (w > 22 && d > 22 && kind < 0.36) {
      // an L: a long wing and a short wing
      const sx = rng() < 0.5 ? -1 : 1; bld.push({ x: cx, z: cz - d * 0.22, w, d: d * 0.56, h, y: 0.16, color, style, shop, seed: rng() }); bld.push({ x: cx + sx * w * 0.25, z: cz + d * 0.28, w: w * 0.5, d: d * 0.44, h: Math.max(4.4, h - 3.2 * Math.round(rng() * 2)), y: 0.16, color, style, shop, seed: rng() });
    } else if (floors > 9 && w > 20 && d > 20) {
      // a podium with a set-back tower
      bld.push({ x: cx, z: cz, w, d, h: 3 * 3.2 + 1.2, y: 0.16, color: CONCRETE[Math.floor(rng() * CONCRETE.length)], style: 1, shop, seed: rng() });
      bld.push({ x: cx, z: cz, w: w * 0.6, d: d * 0.6, h: h - 9.6, y: 0.16 + 3 * 3.2 + 1.2, color, style, shop: 0, seed: rng() });
    } else bld.push({ x: cx, z: cz, w, d, h, y: 0.16, color, style, shop, seed: rng() });
  });
  // parks: lawns, paths, a pond, trees
  blocks.filter((b) => b.park).forEach((b) => {
    const W = b.x1 - b.x0; const D = b.z1 - b.z0;
    batch.box(W - 6, 0.12, D - 6, M.grass, b.cx, 0.22, b.cz, 0, { cast: false });
    batch.box(W - 6, 0.13, 3.2, M.sidewalk, b.cx, 0.24, b.cz, 0, { cast: false });
    const pond = W > 60 && D > 50 && rng() < 0.6;
    if (pond) batch.add(new THREE.CircleGeometry(Math.min(W, D) * 0.16, 20), M.water, new THREE.Matrix4().compose(new THREE.Vector3(b.cx + W * 0.2, 0.3, b.cz - D * 0.2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), new THREE.Vector3(1, 1, 1)), { cast: false });
    const n = Math.round((W * D) / (isPhone ? 900 : 620));
    for (let k = 0; k < n; k++) {
      const x = b.x0 + 6 + rng() * (W - 12); const z = b.z0 + 6 + rng() * (D - 12);
      if (Math.abs(z - b.cz) < 4) continue;
      if (pond && Math.hypot(x - b.cx - W * 0.2, z - b.cz + D * 0.2) < Math.min(W, D) * 0.2) continue;
      if (lineDist(x, z) < 11) continue;
      trees.push([x, z, 0.85 + rng() * 0.6]);
    }
  });

  const addBuilding = (o) => bld.push({ shop: 0, seed: rng(), style: o.glassy ? 2 : o.style || 0, ...o });
  landmarks.forEach((lm) => { if (lm.block) buildLandmark(lm, { b: lm.block, batch, M, scene, anim, atlas, photos, addBuilding, addTree: (x, z, sc) => trees.push([x, z, sc]) }); });

  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const uni = { uTime: { value: 0 }, uDusk: { value: 0.6 }, uQuiet: { value: 0 }, uCut: { value: new THREE.Vector4(0, 0, 0, 0) }, uCamDir: { value: new THREE.Vector3(0, 1, 0) } };
  // cutaway: anything between the camera and the train is cut open so the train stays visible
  const CUT_DECL = 'uniform vec4 uCut; uniform vec3 uCamDir; varying vec3 vCutWP;';
  const CUT_TEST = 'if (uCut.w > 0.0 && vCutWP.y > uCut.y + 1.0) { vec3 cd = vCutWP - uCut.xyz; float al = dot(cd, uCamDir); if (al > 4.0 && length(cd - uCamDir * al) < uCut.w) discard; }';
  const withCut = (mat, extra, instanced = true) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uCut = uni.uCut; sh.uniforms.uCamDir = uni.uCamDir; sh.uniforms.uTime = uni.uTime; sh.uniforms.uDusk = uni.uDusk; sh.uniforms.uQuiet = uni.uQuiet;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCutWP;').replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\nvCutWP = (modelMatrix * ${instanced ? 'instanceMatrix * ' : ''}vec4(transformed, 1.0)).xyz;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${CUT_DECL}\nuniform float uQuiet;`).replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${CUT_TEST}`)
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.95, 0.945, 0.93) * (0.82 + 0.18 * dot(gl_FragColor.rgb, vec3(0.33))), uQuiet * 0.72);');
      if (extra) extra(sh);
    };
    return mat;
  };
  const bMat = withCut(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0.02 }), (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aInfo; // style, shopfront, seed, lights on
varying vec3 vLoc; varying vec3 vSize; varying vec3 vLN; varying vec4 vInfo;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vLoc = position; vLN = normal; vInfo = aInfo;
vSize = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uDusk;
varying vec3 vLoc; varying vec3 vSize; varying vec3 vLN; varying vec4 vInfo;
float h31(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
float wMask; float wLit;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
wMask = 0.0; wLit = 0.0;
if (abs(vLN.y) < 0.5) {
  bool sideX = abs(vLN.x) > 0.5;
  float faceW = sideX ? vSize.z : vSize.x;
  float along = (sideX ? vLoc.z : vLoc.x) + 0.5;
  float H = vSize.y; float y = vLoc.y * H;
  float st = vInfo.x;
  float target = st < 0.5 ? 3.0 : (st < 1.5 ? 6.0 : 1.6);
  float nCol = max(1.0, floor(faceW / target));
  float u = along * nCol; float cu = floor(u); float lx = fract(u);
  float nFl = max(1.0, floor((H - 1.4) / 3.2));
  float fy = y / 3.2; float fl = floor(fy); float ly = fract(fy);
  float rows = step(1.0, fl) * step(fl, nFl - 1.0);
  if (nFl < 2.5) rows = step(0.0, fl) * step(fl, nFl - 1.0) * step(0.9, y);
  float win = st < 0.5 ? step(0.24, lx) * step(lx, 0.76) * step(0.3, ly) * step(ly, 0.84)
            : st < 1.5 ? step(0.02, lx) * step(lx, 0.98) * step(0.34, ly) * step(ly, 0.8)
                       : step(0.14, ly) * step(ly, 0.9);
  win *= rows;
  float shopCols = max(1.0, floor(faceW / 4.0)); float sx = fract(along * shopCols);
  float shop = vInfo.y * step(0.5, y) * step(y, 2.9) * step(0.06, sx) * step(sx, 0.94);
  // far away, the pattern resolves to its average colour instead of speckle
  float px = max(fwidth(u), fwidth(fy));
  float fade = smoothstep(0.3, 0.8, px);
  float cover = (st < 0.5 ? 0.27 : (st < 1.5 ? 0.44 : 0.76)) * rows;
  wMask = mix(max(win, shop), cover, fade);
  vec3 glassCol = st > 1.5 ? vec3(0.34, 0.43, 0.51) : vec3(0.2, 0.24, 0.29);
  diffuseColor.rgb = mix(diffuseColor.rgb, glassCol, wMask * (st > 1.5 ? 0.75 : 0.92));
  // a calm evening: a few windows lit, mostly on upper floors; a clicked building lights every window
  float hsh = h31(vec3(cu + (sideX ? 37.0 : 0.0), fl, vInfo.z * 91.0));
  float p = (0.04 + 0.14 * (fl / nFl)) * uDusk;
  p *= step(st, 1.5); // glass towers: clean bands, no scattered lit windows
  p = mix(p, 0.92, vInfo.w);
  wLit = win * mix(1.0 - fade, 1.0, vInfo.w) * step(hsh, p) * (1.0 + vInfo.w * 0.6) + shop * 0.35 * (1.0 - fade) + vInfo.w * cover * fade;
  diffuseColor.rgb *= 1.0 - 0.12 * step(H - 1.2, y);
  // soft contact shadow where the wall meets the street, a plinth and a cornice line
  diffuseColor.rgb *= mix(0.62, 1.0, smoothstep(0.0, 5.5, y + (vInfo.y > 0.5 ? 0.0 : 1.5)));
  diffuseColor.rgb *= 1.0 - 0.1 * step(H - 1.9, y) * step(y, H - 1.4);
  diffuseColor.rgb *= 0.93 + 0.14 * fract(vInfo.z * 7.31);
} else {
  // roofs: a darker parapet edge, a lighter membrane with faint panel seams
  vec2 rp = vLoc.xz; vec2 ed = (0.5 - abs(rp)) * vSize.xz;
  float edge = 1.0 - smoothstep(0.4, 1.4, min(ed.x, ed.y));
  float seam = step(0.96, fract(rp.x * vSize.x / 6.0)) * 0.05;
  diffuseColor.rgb = mix(diffuseColor.rgb * 0.9, vec3(0.74, 0.73, 0.71), 0.35) * (1.0 - 0.22 * edge - seam);
}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.14, wMask);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += wLit * vec3(1.0, 0.74, 0.45) * 0.9;`);
  });
  const mtx = new THREE.Matrix4(); const col = new THREE.Color();
  // one instanced mesh per tile, so the GPU can skip whatever is off-screen
  const tiled = (geo, mat, items, xz, place, opts = {}) => {
    const groups = new Map();
    items.forEach((it) => { const [x, z] = xz(it); const k = tileOf(x, z); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); });
    const meshes = [];
    groups.forEach((list) => {
      const g = opts.perTileGeo ? opts.perTileGeo(list) : geo;
      const m = new THREE.InstancedMesh(g, mat, list.length);
      list.forEach((it, i) => { place(it, mtx, i, m); m.setMatrixAt(i, mtx); });
      m.computeBoundingSphere();
      m.castShadow = opts.cast !== false; m.receiveShadow = opts.receive !== false; scene.add(m); meshes.push(m);
      m.userData.items = list;
    });
    return meshes;
  };
  const bldMeshes = tiled(boxGeo, bMat, bld, (b) => [b.x, b.z], (b, m, i, mesh) => {
    m.compose(new THREE.Vector3(b.x, b.y, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w, b.h, b.d));
    mesh.setColorAt(i, col.setHex(b.color));
  }, { perTileGeo: (list) => { const g = boxGeo.clone(); const info = new Float32Array(list.length * 4); list.forEach((b, i) => { info[i * 4] = b.style || 0; info[i * 4 + 1] = b.shop; info[i * 4 + 2] = b.seed; info[i * 4 + 3] = 0; }); g.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 4)); return g; } });
  // little life: click a building to switch its lights on (and off)
  const toggleLights = (mesh, i) => { const a = mesh.geometry.attributes.aInfo; const on = a.getW(i) > 0.5 ? 0 : 1; a.setW(i, on); a.needsUpdate = true; const b = mesh.userData.items[i]; return { on: !!on, top: new THREE.Vector3(b.x, b.y + b.h, b.z) }; };

  // pitched roofs for houses
  if (roofsHouse.length) {
    const prism = new THREE.CylinderGeometry(0.5, 0.5, 1, 3, 1); prism.rotateZ(Math.PI / 2); prism.rotateX(Math.PI / 6); prism.scale(1, 0.62, 1.16); prism.translate(0, 0.27, 0);
    tiled(prism, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true }), roofsHouse, (r) => [r.x, r.z], (r, m, i, mesh) => {
      m.compose(new THREE.Vector3(r.x, r.y, r.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r.rot), new THREE.Vector3(r.rot ? r.d : r.w, 5, r.rot ? r.w : r.d));
      mesh.setColorAt(i, col.setHex(soft([0x9a4a36, 0x6f4b3e, 0x54606b, 0xa5583f])[i % 4]));
    });
  }

  /* rooftops: parapet caps and rooftop units merged per tile, water tanks */
  const tanks = [];
  const capGeo = (() => {
    const parts = [];
    const add = (w, h, d, x, y, z, hex) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); parts.push(vcol(g, hex)); };
    add(1.02, 0.05, 1.02, 0, 0.025, 0, 0x9a968f);
    add(0.24, 0.1, 0.18, -0.16, 0.08, -0.1, 0xd2cec8);
    return mergeGeometries(parts, false);
  })();
  const capPlain = (() => { const g = new THREE.BoxGeometry(1.02, 0.05, 1.02); g.translate(0, 0.025, 0); return vcol(g, 0x9a968f); })();
  withCut(M.vc, null, false);
  bld.forEach((b, i) => {
    if (b.noRoof || b.h < 14) return;
    batch.add(i % 2 ? capPlain : capGeo, M.vc, new THREE.Matrix4().compose(new THREE.Vector3(b.x, b.y + b.h, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w, Math.min(b.w, b.d) * 0.22 + 4, b.d)), { cast: false });
    if (b.style === 0 && b.h < 40 && b.h > 10 && rng() < 0.35) tanks.push([b.x + (rng() - 0.5) * b.w * 0.5, b.y + b.h, b.z + (rng() - 0.5) * b.d * 0.5]);
  });
  const tankGeo = (() => {
    const barrel = new THREE.CylinderGeometry(1.8, 1.8, 3.2, 10); barrel.translate(0, 3.4, 0);
    const roof = new THREE.ConeGeometry(2, 1.3, 10); roof.translate(0, 5.6, 0);
    const legs = new THREE.BoxGeometry(3.0, 1.8, 3.0); legs.translate(0, 0.9, 0);
    return mergeGeometries([vcol(barrel, 0x8a6a4b), vcol(roof, 0x2a2b2f), vcol(legs, 0x6b6e73)], false);
  })();
  tanks.forEach((c) => batch.add(tankGeo, M.vc, new THREE.Matrix4().makeTranslation(c[0], c[1], c[2])));

  /* rooftop detail: plant rooms, AC units and skylights, one instanced mesh for the whole city */
  {
    const items = [];
    bld.forEach((b) => { if (b.noRoof || b.landmark || b.h < 12 || b.w < 12 || b.d < 12) return; const n = 1 + Math.floor(rng() * 2); for (let k = 0; k < n; k++) items.push([b.x + (rng() - 0.5) * b.w * 0.6, b.y + b.h, b.z + (rng() - 0.5) * b.d * 0.6, 1.6 + rng() * 3.4, 1 + rng() * 1.8, 1.6 + rng() * 3.4, k === 0 && rng() < 0.4 ? 0x8f8b84 : rng() < 0.5 ? 0xd9d6d0 : 0xb9b6b0]); });
    const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0);
    const im = new THREE.InstancedMesh(g, withCut(new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.15 })), items.length);
    items.forEach(([x, y, z, w, h, d, c], i) => { mtx.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d)); im.setMatrixAt(i, mtx); im.setColorAt(i, col.setHex(c)); });
    im.castShadow = false; im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im);
  }

  /* street furniture: lane markings, crosswalks, lamps, trees */
  const marks = []; const lamps = [];
  const crossingAt = (r, x, z) => (r.dir === 'z' ? ST_Z.some((sz) => Math.abs(z - sz) < stW(sz) / 2 + 2) : AVE_X.some((ax) => Math.abs(x - ax) < aveW(ax) / 2 + 2));
  roadRects.forEach((r) => {
    const along = r.dir; const len = along === 'z' ? r.z1 - r.z0 : r.x1 - r.x0;
    const offs = r.loop ? [-7.5, 7.5] : [0];
    for (let t = 6; t < len - 6; t += 12) {
      offs.forEach((o) => {
        const x = along === 'z' ? (r.x0 + r.x1) / 2 + o : r.x0 + t; const z = along === 'z' ? r.z0 + t : (r.z0 + r.z1) / 2 + o;
        if (!crossingAt(r, x, z) && Math.abs(x) < BOUNDS.x1 - 10 && Math.abs(z) < BOUNDS.z1 - 10) marks.push([x, z, along === 'z' ? 0.18 : 3, along === 'z' ? 3 : 0.18]);
      });
    }
  });
  AVE_X.forEach((x) => ST_Z.forEach((z) => {
    if (!onRoad(x, z)) return;
    const hw = aveW(x) / 2; const hs = stW(z) / 2;
    [-1, 1].forEach((sg) => {
      if (onRoad(x, z + sg * (hs + 2.5))) for (let k = -hw + 2; k <= hw - 2; k += 2.6) marks.push([x + k, z + sg * (hs + 2.5), 1.2, 3.6]);
      if (onRoad(x + sg * (hw + 2.5), z)) for (let k = -hs + 2; k <= hs - 2; k += 2.6) marks.push([x + sg * (hw + 2.5), z + k, 3.6, 1.2]);
    });
  }));
  // traffic lights on the corners of busy crossings
  {
    const tl = []; AVE_X.forEach((x) => ST_Z.forEach((z) => { if (Math.abs(x) > 530 || Math.abs(z) > 340 || !onRoad(x, z - stW(z) / 2 - 1)) return; const hw = aveW(x) / 2 + 2; const hs = stW(z) / 2 + 2; tl.push([x - hw, z - hs, 0], [x + hw, z + hs, Math.PI]); }));
    const pole = new THREE.CylinderGeometry(0.1, 0.12, 5.2, 4, 1, true); pole.translate(0, 2.6, 0); const arm = new THREE.BoxGeometry(0.16, 0.16, 3.6); arm.translate(0, 5.1, 1.7); const head = new THREE.BoxGeometry(0.4, 1.0, 0.36); head.translate(0, 4.6, 3.3);
    const geo = mergeGeometries([vcol(pole, 0x2a2c30), vcol(arm, 0x2a2c30), vcol(head, 0x1b1c1f)], false);
    tl.forEach(([x, z, r]) => batch.add(geo, M.vc, new THREE.Matrix4().compose(new THREE.Vector3(x, 0.16, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r), new THREE.Vector3(1, 1, 1)), { cast: false }));
  }
  const markGeo = new THREE.PlaneGeometry(1, 1); markGeo.rotateX(-Math.PI / 2);
  marks.forEach((c) => batch.add(markGeo, M.white, new THREE.Matrix4().compose(new THREE.Vector3(c[0], 0.05, c[1]), new THREE.Quaternion(), new THREE.Vector3(c[2], 1, c[3])), { cast: false, receive: true }));
  blocks.forEach((b) => {
    if (b.zone === 'suburb') return;
    const edges = [[b.x0 + 1.6, b.z0 + 1.6, b.x1 - 1.6, b.z0 + 1.6], [b.x0 + 1.6, b.z1 - 1.6, b.x1 - 1.6, b.z1 - 1.6], [b.x0 + 1.6, b.z0 + 1.6, b.x0 + 1.6, b.z1 - 1.6], [b.x1 - 1.6, b.z0 + 1.6, b.x1 - 1.6, b.z1 - 1.6]];
    edges.forEach(([ax, az, bx, bz], e) => {
      const len = Math.hypot(bx - ax, bz - az);
      for (let t = 8; t < len - 4; t += 13) {
        const x = ax + ((bx - ax) * t) / len; const z = az + ((bz - az) * t) / len;
        if (lineDist(x, z) < 11) continue;
        if (Math.floor(t / 13) % 4 === 0) lamps.push([x, z, e]);
        else if (rng() < (isPhone ? 0.2 : 0.33)) trees.push([x, z, 0.85 + rng() * 0.5]);
      }
    });
  });
  const lampGeo = (() => { const pole = new THREE.CylinderGeometry(0.09, 0.13, 7, 3, 1, true); pole.translate(0, 3.5, 0); const head = new THREE.BoxGeometry(0.5, 0.18, 1.3); head.translate(0, 7.05, 0.5); return mergeGeometries([vcol(pole, 0x2a2c30), vcol(head, 0xf3e3c0)], false); })();
  lamps.forEach((c) => batch.add(lampGeo, M.vc, new THREE.Matrix4().compose(new THREE.Vector3(c[0], 0.16, c[1]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), [Math.PI, 0, Math.PI / 2, -Math.PI / 2][c[2]]), new THREE.Vector3(1, 1, 1)), { cast: false }));
  // suburbs: scattered field trees beyond the last streets
  for (let k = 0; k < (isPhone ? 80 : 160); k++) {
    const x = BOUNDS.x0 - 300 + rng() * (BOUNDS.x1 - BOUNDS.x0 + 600); const z = BOUNDS.z0 - 260 + rng() * (BOUNDS.z1 - BOUNDS.z0 + 520);
    if (Math.abs(x) < BOUNDS.x1 + 4 && Math.abs(z) < BOUNDS.z1 + 4) continue;
    if (z > RIVER.z0 - 6 && z < RIVER.z1 + 6) continue;
    trees.push([x, z, 0.9 + rng() * 0.7]);
  }
  const treeGeo = (() => { const trunk = new THREE.CylinderGeometry(0.16, 0.24, 2.6, 4, 1, true); trunk.translate(0, 1.3, 0); const crown = new THREE.IcosahedronGeometry(2.5, 0); crown.scale(1, 1.15, 1); crown.translate(0, 4.4, 0); return mergeGeometries([vcol(trunk, 0x7a5c40), vcol(crown, 0x6f9152)], false); })();
  const treeMat = withCut(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }), (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
float sway = sin(uTime * 0.8 + ip.x * 0.05 + ip.z * 0.07) * 0.06 * max(0.0, position.y - 2.5);
transformed.x += sway; transformed.z += sway * 0.6;`);
  });
  const tint = [0xffffff, 0xe9f0dc, 0xd7e4c6, 0xf3f5e6];
  const placeTree = (c, m, i, mesh) => { m.compose(new THREE.Vector3(c[0], 0.16, c[1]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), c[0] * 0.37), new THREE.Vector3(c[2], c[2], c[2])); mesh.setColorAt(i, col.setHex(tint[(Math.abs(c[0] * 7 + c[1] * 3) | 0) % 4])); };
  const treeMeshes = tiled(treeGeo, treeMat, trees, (c) => [c[0], c[1]], placeTree, { cast: false });
  // close up, only the trees near the camera target are drawn (an orthographic view still reaches far behind it)
  const cullTrees = (cx, cz, r) => treeMeshes.forEach((mesh) => {
    let n = 0; mesh.userData.items.forEach((c) => { if (r === Infinity || (c[0] - cx) ** 2 + (c[1] - cz) ** 2 < r * r) { placeTree(c, mtx, n, mesh); mesh.setMatrixAt(n, mtx); n++; } });
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  /* cars: slow traffic on the right-hand lane of each road; click one and it honks */
  const lanes = roadRects.filter((r) => (r.dir === 'z' ? r.z1 - r.z0 : r.x1 - r.x0) > 120);
  const carCount = isPhone ? 36 : 80;
  const cars = [];
  for (let k = 0; k < carCount; k++) {
    const r = lanes[Math.floor(rng() * lanes.length)];
    const len = r.dir === 'z' ? r.z1 - r.z0 : r.x1 - r.x0;
    cars.push({ r, sign: rng() < 0.5 ? 1 : -1, t: rng() * len, len, v: 6 + rng() * 4, hop: 0, color: [0xf1f1ee, 0x2c3e50, 0xb03a2e, 0x7f8c8d, 0x1f4e79, 0xd4ac0d, 0x222222, 0xe5e7e9][k % 8] });
  }
  const parked = [];
  roadRects.filter((r) => !r.loop && (r.dir === 'z' ? r.z1 - r.z0 : r.x1 - r.x0) > 80 && Math.abs(r.c) < 700).forEach((r) => {
    const len = r.dir === 'z' ? r.z1 - r.z0 : r.x1 - r.x0; const half = (r.dir === 'z' ? r.x1 - r.x0 : r.z1 - r.z0) / 2 - 1.3;
    for (let t = 14; t < len - 14; t += 9 + rng() * 20) {
      if (rng() < (isPhone ? 0.85 : 0.72)) continue;
      const sg = rng() < 0.5 ? -1 : 1; const x = r.dir === 'z' ? (r.x0 + r.x1) / 2 + sg * half : r.x0 + t; const z = r.dir === 'z' ? r.z0 + t : (r.z0 + r.z1) / 2 + sg * half;
      if (onRoad(x, z, 0) && roadRects.some((q) => q !== r && x > q.x0 - 3 && x < q.x1 + 3 && z > q.z0 - 3 && z < q.z1 + 3)) continue;
      parked.push({ x, z, ry: r.dir === 'z' ? 0 : Math.PI / 2, color: [0xe8e6e1, 0x3b4651, 0x8c2f27, 0x9aa0a6, 0x2b4a6b, 0x1f2124][Math.floor(rng() * 6)] });
    }
  });
  const carBody = new THREE.BoxGeometry(1.85, 0.75, 4.4); carBody.translate(0, 0.65, 0);
  const carCabin = new THREE.BoxGeometry(1.6, 0.6, 2.2); carCabin.translate(0, 1.32, -0.2);
  const carMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.4 });
  const bodyMesh = new THREE.InstancedMesh(carBody, carMat, cars.length + parked.length);
  const cabMesh = new THREE.InstancedMesh(carCabin, M.glass, cars.length + parked.length);
  bodyMesh.castShadow = true; cabMesh.castShadow = false;
  cars.forEach((c, i) => bodyMesh.setColorAt(i, col.setHex(c.color)));
  parked.forEach((p, k) => { const i = cars.length + k; mtx.compose(new THREE.Vector3(p.x, 0.16, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.ry), new THREE.Vector3(1, 1, 1)); bodyMesh.setMatrixAt(i, mtx); cabMesh.setMatrixAt(i, mtx); bodyMesh.setColorAt(i, col.setHex(p.color)); });
  scene.add(bodyMesh, cabMesh);
  const q = new THREE.Quaternion(); const up = new THREE.Vector3(0, 1, 0); const v3 = new THREE.Vector3(); const one = new THREE.Vector3(1, 1, 1);
  const carPos = (c) => {
    const r = c.r; const lane = (r.dir === 'z' ? r.x1 - r.x0 : r.z1 - r.z0) / 4;
    const along = c.sign > 0 ? c.t : c.len - c.t;
    if (r.dir === 'z') { v3.set((r.x0 + r.x1) / 2 - lane * c.sign, ROAD_Y, r.z0 + along); q.setFromAxisAngle(up, c.sign > 0 ? 0 : Math.PI); }
    else { v3.set(r.x0 + along, ROAD_Y, (r.z0 + r.z1) / 2 + lane * c.sign); q.setFromAxisAngle(up, c.sign > 0 ? Math.PI / 2 : -Math.PI / 2); }
    return v3;
  };
  const placeCars = (dt) => {
    cars.forEach((c, i) => {
      c.t += c.v * dt * (c.hop > 0 ? 0.2 : 1); if (c.t > c.len - 4) c.t = 4;
      carPos(c);
      if (c.hop > 0) { c.hop = Math.max(0, c.hop - dt * 2.2); v3.y += Math.sin(c.hop * Math.PI * 3) * 0.35 * c.hop; }
      mtx.compose(v3, q, one); bodyMesh.setMatrixAt(i, mtx); cabMesh.setMatrixAt(i, mtx);
    });
    bodyMesh.instanceMatrix.needsUpdate = true; cabMesh.instanceMatrix.needsUpdate = true;
    bodyMesh.computeBoundingSphere();
  };
  placeCars(0);
  anim.push((t, dt) => { uni.uTime.value = t; placeCars(dt); });
  const honk = (i) => { const c = cars[i]; if (!c) return parked[i - cars.length] ? new THREE.Vector3(parked[i - cars.length].x, 0, parked[i - cars.length].z) : null; c.hop = 1; return carPos(c).clone(); };

  /* pedestrians: small walkers on the sidewalk ring of city blocks */
  const walkers = [];
  const pedCount = isPhone ? 60 : 150;
  const busy = blocks.filter((b) => b.zone !== 'suburb' && !b.park && !reserved.has(b));
  for (let k = 0; k < pedCount; k++) {
    const b = busy[Math.floor(rng() * busy.length)];
    const per = 2 * (b.x1 - b.x0 + b.z1 - b.z0 - 6);
    walkers.push({ b, t: rng() * per, per, v: (rng() < 0.5 ? 1 : -1) * (0.9 + rng() * 0.6), color: [0x34495e, 0xc0392b, 0x16a085, 0xf39c12, 0x8e44ad, 0x2c3e50, 0xecf0f1][k % 7] });
  }
  const pedGeo = new THREE.CylinderGeometry(0.2, 0.26, 1.7, 5, 1); pedGeo.translate(0, 0.85, 0);
  const pedMesh = new THREE.InstancedMesh(pedGeo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), walkers.length);
  walkers.forEach((w, i) => pedMesh.setColorAt(i, col.setHex(w.color)));
  pedMesh.castShadow = false; pedMesh.frustumCulled = false; scene.add(pedMesh);
  const placePeds = (dt) => {
    walkers.forEach((w, i) => {
      w.t = (w.t + w.v * dt + w.per) % w.per;
      const b = w.b; const W = b.x1 - b.x0 - 3; const D = b.z1 - b.z0 - 3; let t = w.t;
      let x; let z;
      if (t < W) { x = b.x0 + 1.5 + t; z = b.z0 + 2.6; } else if ((t -= W) < D) { x = b.x1 - 2.6; z = b.z0 + 1.5 + t; } else if ((t -= D) < W) { x = b.x1 - 1.5 - t; z = b.z1 - 2.6; } else { t -= W; x = b.x0 + 2.6; z = b.z1 - 1.5 - t; }
      mtx.makeTranslation(x, 0.16, z); pedMesh.setMatrixAt(i, mtx);
    });
    pedMesh.instanceMatrix.needsUpdate = true;
  };
  placePeds(0);
  anim.push((t, dt) => placePeds(dt));

  return { cullTrees, batch, anim, roadRects, onRoad, pierOK, blocks, blockAt, uni, bldMeshes, toggleLights, carMesh: bodyMesh, honk };
}

/* ---------- the network: viaducts, the street-level line, piers, track, stations ---------- */
export function lineRoundel(def, opts = {}) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = opts.bg || def.css; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill();
  g.fillStyle = def.css; g.beginPath(); g.arc(128, 128, 98, 0, Math.PI * 2); g.fill();
  g.fillStyle = def.id === '2' ? '#16171a' : '#ffffff'; g.font = '800 120px "Public Sans", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(def.no, 128, 136);
  return c;
}
function nameBoard(def, st) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 200; const g = c.getContext('2d');
  g.fillStyle = '#16171a'; g.fillRect(0, 0, 1024, 200); g.fillStyle = def.css; g.fillRect(0, 168, 1024, 32);
  g.fillStyle = def.css; g.beginPath(); g.arc(96, 90, 64, 0, Math.PI * 2); g.fill();
  g.fillStyle = def.id === '2' ? '#16171a' : '#ffffff'; g.font = '800 72px "Public Sans", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(def.no, 96, 96);
  g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.font = '800 70px "Public Sans", Arial'; g.fillText(st.name, 190, 70);
  g.font = '600 46px "PingFang SC", "Microsoft YaHei", sans-serif'; g.fillStyle = '#c9c8c2'; g.fillText(st.zh, 192, 136);
  return c;
}

export function buildLines({ M, net, pierOK, onRoad, batch, doorS, atlas }) {
  const yAx = new THREE.Vector3(0, 1, 0);
  const lineMats = {};
  net.lines.forEach((l) => { const m = new THREE.MeshStandardMaterial({ color: l.def.hex, roughness: 0.5, side: THREE.DoubleSide }); m.userData.matte = true; lineMats[l.id] = m; });
  // a trackbed textured with sleepers every 0.65 m
  const tb = document.createElement('canvas'); tb.width = 64; tb.height = 64; const tg = tb.getContext('2d');
  tg.fillStyle = '#8d877d'; tg.fillRect(0, 0, 64, 64);
  let sd = 7; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  for (let i = 0; i < 260; i++) { tg.fillStyle = rnd() < 0.5 ? '#7d776e' : '#9c968c'; tg.fillRect(rnd() * 64, rnd() * 64, 2, 2); }
  tg.fillStyle = '#b9b4ab'; tg.fillRect(4, 22, 56, 20); tg.fillStyle = '#a29d94'; tg.fillRect(4, 38, 56, 4);
  const tbTex = new THREE.CanvasTexture(tb); tbTex.wrapS = THREE.ClampToEdgeWrapping; tbTex.wrapT = THREE.RepeatWrapping; tbTex.colorSpace = THREE.SRGBColorSpace; tbTex.anisotropy = 4;
  const trackbedMat = new THREE.MeshStandardMaterial({ map: tbTex, roughness: 1, side: THREE.DoubleSide });
  const pierGeo = new THREE.BoxGeometry(2.2, 1, 2.6); pierGeo.translate(0, 0.5, 0);
  const unit = new THREE.BoxGeometry(1, 1, 1); unit.translate(0, 0.5, 0);
  const stationParts = [];

  net.lines.forEach((line) => {
    const L = line.L; const LM = lineMats[line.id]; const grade = line.kind === 'grade'; const def = line.def;
    const put = (geo, mat, s, lat, y, scale, opts, extraRot) => {
      const a = line.at(s); const p = a.p.clone().addScaledVector(a.n, lat);
      const q = new THREE.Quaternion().setFromAxisAngle(yAx, Math.atan2(a.t.x, a.t.z)); if (extraRot) q.multiply(extraRot);
      batch.add(geo, mat, new THREE.Matrix4().compose(new THREE.Vector3(p.x, y, p.z), q, scale || new THREE.Vector3(1, 1, 1)), opts);
    };
    if (!grade) {
      // 1) the deck: concrete box with chamfered soffit; parapet tops, outer faces and floor in the line colour
      const VIADUCT = [[-7.0, 1.0], [-6.3, 1.0], [-6.3, -0.75], [6.3, -0.75], [6.3, 1.0], [7.0, 1.0], [7.0, -1.7], [4.6, -2.9], [-4.6, -2.9], [-7.0, -1.7]];
      addStrips(batch, sweep(line, 0, L, VIADUCT, { closed: true, step: 4 }), M.concrete);
      [-1, 1].forEach((sg) => {
        addStrips(batch, sweep(line, 0, L, [[sg * 6.28, 1.02], [sg * 7.02, 1.02]], { step: 4 }), LM, { cast: false });
        addStrips(batch, sweep(line, 0, L, [[sg * 7.03, 1.02], [sg * 7.03, -1.7]], { step: 4 }), LM, { cast: false });
      });
      addStrips(batch, sweep(line, 0, L, [[-6.29, -0.73], [6.29, -0.73]], { step: 4 }), LM, { cast: false });
      // 2) piers: never on a crossing road, never under another line; in the water where a line crosses the river
      for (let s = line.closed ? 0 : 6; s < L - (line.closed ? 0 : 4); s += 30) {
        let ok = null;
        for (const d of [0, 5, -5, 9, -9, 13, -13]) { const a = line.at(s + d); if (pierOK(a.p.x, a.p.z, a.t.x, a.t.z, line.id)) { ok = s + d; break; } }
        if (ok === null) continue;
        const a = line.at(ok); const inRiver = a.p.z > RIVER.z0 - 1 && a.p.z < RIVER.z1 + 1;
        const yb = inRiver ? RIVER.water - 1 : 0; const top = a.p.y - 2.9;
        const w = line.Y > 12 ? 1.25 : 1;
        put(pierGeo, M.concrete, ok, 0, yb, new THREE.Vector3(w, top - yb - 1.1, w));
        put(unit, M.concrete, ok, 0, top - 1.1, new THREE.Vector3(9.2, 1.1, 2.9));
      }
      // open ends: a closing wall on the deck
      if (!line.closed) [0.3, L - 0.3].forEach((s) => put(unit, M.concrete, s, 0, line.Y - 2.9, new THREE.Vector3(14, 3.9, 0.6)));
    } else {
      // street level: a ballast bed in a planted corridor, kerbs in the line colour
      addStrips(batch, sweep(line, 0, L, [[-7.0, 0, 0.2], [7.0, 0, 0.2]], { step: 4 }), M.ballast, { cast: false });
      [-1, 1].forEach((sg) => {
        addStrips(batch, sweep(line, 0, L, [[sg * 7.0, 0, 0.36], [sg * 7.7, 0, 0.36]], { step: 4 }), LM, { cast: false });
        addStrips(batch, sweep(line, 0, L, [[sg * 7.7, 0, 0.36], [sg * 7.7, 0, 0.02]], { step: 4 }), LM, { cast: false });
      });
      // catenary masts every 40 m, a wire over each track
      for (let s = 8; s < L - 4; s += 40) {
        const a = line.at(s); if (onRoad(a.p.x + a.n.x * 7.5, a.p.z + a.n.z * 7.5, 1)) continue;
        put(unit, M.steel, s, 7.4, 0, new THREE.Vector3(0.28, 6.6, 0.28), { cast: true });
        put(unit, M.steel, s, 1.5, 6.4, new THREE.Vector3(12, 0.2, 0.2), { cast: false });
      }
      [-5, 5].forEach((c) => addStrips(batch, sweep(line, 0, L, [[c - 0.03, 5.9], [c + 0.03, 5.9]], { step: 6 }), M.ink, { cast: false }));
    }
    // 3) two tracks: sleepers, rails; a third rail with a yellow cover on the viaducts
    [TRACK_OFF, -TRACK_OFF].forEach((c) => {
      addStrips(batch, sweep(line, 0, L, [[c - 1.55, -0.18], [c + 1.55, -0.18]], { step: 3, vScale: 0.65 }), trackbedMat, { cast: false });
      [c - GAUGE / 2, c + GAUGE / 2].forEach((r) => addStrips(batch, sweep(line, 0, L, [[r - 0.04, -0.17], [r - 0.035, 0], [r + 0.035, 0]], { step: 4 }), M.railSteel, { cast: false }));
      if (!grade) { const tr = c + Math.sign(c) * 1.55; addStrips(batch, sweep(line, 0, L, [[tr - 0.18, 0.12], [tr + 0.18, 0.12]], { step: 6 }), M.yellow, { cast: false }); }
    });
    // buffer stops at the ends of open lines
    if (!line.closed) [[2.2, 1], [L - 2.2, -1]].forEach(([s]) => [-TRACK_OFF, TRACK_OFF].forEach((c) => put(unit, M.yellow, s, c, line.Y - 0.2, new THREE.Vector3(2.6, 1.3, 0.9))));

    // 4) stations
    const rc = lineRoundel(def);
    line.stations.forEach((ps) => {
      const st = ps.st; const s0 = ps.s - 46; const s1 = ps.s + 46;
      addStrips(batch, sweep(line, s0, s1, [[-3.5, -0.75], [-3.5, 1.1], [3.5, 1.1], [3.5, -0.75]], { closed: true }), M.sidewalk);
      [-1, 1].forEach((sg) => addStrips(batch, sweep(line, s0, s1, [[sg * 2.9, 1.112], [sg * 3.2, 1.112]]), M.yellow, { cast: false }));
      const roof = []; for (let k = 0; k <= 8; k++) { const lat = -3.7 + (7.4 * k) / 8; roof.push([lat, 4.9 + 0.45 * Math.cos(((k / 8) - 0.5) * Math.PI)]); }
      addStrips(batch, sweep(line, s0 - 2, s1 + 2, roof), LM);
      [-1, 1].forEach((sg) => addStrips(batch, sweep(line, s0 - 2, s1 + 2, [[sg * 3.72, 4.5], [sg * 3.72, 4.95]]), M.white, { cast: false }));
      for (let s = s0; s <= s1; s += 11.5) put(new THREE.CylinderGeometry(0.16, 0.16, 3.9, 8), M.ink, s, 0, line.Y + 1.1 + 1.95);
      // platform screen doors: glass panels between the door openings on the train's side, a line-colour header
      [-1, 1].forEach((sg) => {
        if (sg === Math.sign(TRAIN_LAT) && doorS) {
          const gaps = doorS(ps).sort((x, y) => x - y); let from = s0 + 1;
          gaps.forEach((g) => { if (g - 0.75 > from + 0.2) addStrips(batch, sweep(line, from, g - 0.75, [[sg * 3.38, 1.1], [sg * 3.38, 3.3]], { step: 1 }), M.glassClear, { cast: false }); from = g + 0.75; });
          if (s1 - 1 > from + 0.2) addStrips(batch, sweep(line, from, s1 - 1, [[sg * 3.38, 1.1], [sg * 3.38, 3.3]], { step: 1 }), M.glassClear, { cast: false });
        } else addStrips(batch, sweep(line, s0 + 1, s1 - 1, [[sg * 3.38, 1.1], [sg * 3.38, 3.3]]), M.glassClear, { cast: false });
        addStrips(batch, sweep(line, s0 + 1, s1 - 1, [[sg * 3.3, 3.3], [sg * 3.3, 3.7], [sg * 3.46, 3.7], [sg * 3.46, 3.3]], { closed: true }), LM);
      });
      // boards on the canopy roof (both faces) and roundels lying on the roof, readable from above
      const nb = nameBoard(def, st);
      [-24, 24].forEach((d) => [-1, 1].forEach((side) => { const a = line.at(ps.s + d); const o = new THREE.Object3D(); o.position.copy(a.p).addScaledVector(a.n, side * 0.3).setY(a.p.y + 6.05); o.lookAt(o.position.clone().addScaledVector(a.n, side)); o.updateMatrix(); atlas.add(nb, 6, 1.17, 0, 0, 0, 0, { matrix: o.matrix.clone() }); }));
      [-36, 0, 36].forEach((d) => { const a = line.at(ps.s + d); atlas.add(rc, 6.2, 6.2, 0, 0, 0, 0, { matrix: new THREE.Matrix4().compose(a.p.clone().setY(a.p.y + 5.42), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, Math.atan2(a.t.x, a.t.z) + Math.PI / 2, 'YXZ')), new THREE.Vector3(1, 1, 1)) }); });
      const totems = [];
      const totem = (s, lat) => { const a = line.at(s); const p = a.p.clone().addScaledVector(a.n, lat); batch.add(new THREE.CylinderGeometry(0.11, 0.11, 4.4, 8), M.ink, new THREE.Matrix4().makeTranslation(p.x, 2.2, p.z)); const ang = Math.atan2(a.t.x, a.t.z) + Math.PI / 2; [0, Math.PI].forEach((r) => atlas.add(rc, 1.5, 1.5, 0, 0, 0, 0, { matrix: new THREE.Matrix4().compose(new THREE.Vector3(p.x, 4.9, p.z).addScaledVector(new THREE.Vector3(Math.sin(ang + r), 0, Math.cos(ang + r)), 0.06), new THREE.Quaternion().setFromAxisAngle(yAx, ang + r), new THREE.Vector3(1, 1, 1)) })); totems.push(p); };
      const gate = st.lines.includes('1') && line.id === 'c';
      if (grade) {
        // a ramp up to the platform at each end, and a totem by each
        const rise = 1.1 + line.Y; const run = 11; const slope = Math.atan2(rise, run);
        [[s1 + run / 2, 1], [s0 - run / 2, -1]].forEach(([s, dir]) => { put(new THREE.BoxGeometry(3.2, 0.4, Math.hypot(run, rise)), M.concrete, s, 0, rise / 2, null, null, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dir * slope)); totem(s + dir * (run / 2 + 2), 2.2); });
      } else if (line.Y < 12 && !gate) {
        // the Circle: a mezzanine under the deck, footbridges over the outer lanes, stairs to both sidewalks
        put(new THREE.BoxGeometry(16, 2.0, 22), M.white, ps.s, 0, 5.25);
        put(new THREE.BoxGeometry(16.2, 0.5, 22.2), LM, ps.s, 0, 4.1, null, { cast: false });
        [-1, 1].forEach((sg) => {
          put(new THREE.BoxGeometry(11, 1.9, 3.4), M.white, ps.s + 8, sg * 13.5, 5.2);
          put(new THREE.BoxGeometry(11.2, 0.3, 3.6), M.glassClear, ps.s + 8, sg * 13.5, 6.3, null, { cast: false });
          const run = 11; const rise = 4.3; const slope = Math.atan2(rise, run); const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), slope);
          put(new THREE.BoxGeometry(2.8, 0.5, Math.hypot(run, rise)), M.concrete, ps.s + 8 + 5.5 + run / 2, sg * 19.2, rise / 2 + 0.2, null, null, rot);
          put(new THREE.BoxGeometry(0.12, 1.0, Math.hypot(run, rise)), M.steel, ps.s + 8 + 5.5 + run / 2, sg * 20.6, rise / 2 + 0.9, null, { cast: false }, rot);
          put(new THREE.BoxGeometry(3.6, 4.3, 3.6), M.white, ps.s + 8 + 3.8, sg * 19.2, 2.15);
          totem(ps.s + 8 + 5.5 + run + 2, sg * 21.4);
        });
      } else if (!grade && line.Y > 12) {
        // the high lines: a lift-and-stair tower beside the viaduct, a skybridge over the free track into the concourse on the canopy
        let best = null;
        [[34, 1], [-34, 1], [34, -1], [-34, -1]].forEach(([d, side]) => { const lat = side * 17; const a = line.at(ps.s + d); const x = a.p.x + a.n.x * lat; const z = a.p.z + a.n.z * lat; const sc = Math.min(net.dist(x, z, line.id), 60) - (onRoad(x, z, 2) ? 40 : 0) + (side > 0 ? 3 : 0); if (!best || sc > best.sc) best = { d, lat, sc }; });
        const H = line.Y + 7.2;
        put(unit, M.white, ps.s + best.d, best.lat, 0, new THREE.Vector3(7, H, 8));
        put(unit, M.glass, ps.s + best.d, best.lat + Math.sign(best.lat) * 0.1, 0.4, new THREE.Vector3(7.2, H - 3, 5.5), { cast: false });
        put(unit, LM, ps.s + best.d, best.lat, H - 1.2, new THREE.Vector3(7.3, 1.2, 8.3), { cast: false });
        put(unit, M.white, ps.s + best.d, best.lat / 2, line.Y + 5.6, new THREE.Vector3(Math.abs(best.lat), 2.2, 4));
        put(unit, M.glassClear, ps.s + best.d, best.lat / 2, line.Y + 5.3, new THREE.Vector3(Math.abs(best.lat) + 0.2, 2.6, 4.2), { cast: false });
        put(unit, LM, ps.s + best.d, best.lat, 0, new THREE.Vector3(7.6, 0.6, 8.6), { cast: false });
        totem(ps.s + best.d + Math.sign(best.d) * 7, best.lat);
      }
      stationParts.push({ ps, line, totems });
    });
  });
  return { stationParts, lineMats };
}
