/* Island city · built-in stand-in models
   Simple block shapes, ported from tools/city3d/island_blockout.py. They are used for any model that has not
   arrived in models/*.glb yet, so the city always draws.

   Every model, real or stand-in, has the same shape in code:
     { name, real, size: [w, h, d], geo: { city, glass, glow }, kids: { part: { geo, pos: [x, y, z] } } }
   - metres, Y up, front faces +Z, origin at the footprint centre on the ground
   - the same material names as the model files (`city`, `dark` glass, `glow` lit at night, …: see models.js)
   - every vertex has two colours: `color` (the film look) and `mcol` (the white model look) */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { DISTRICTS } from './city-data.js';

const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
export const WHITE = [0.80, 0.785, 0.75];
export const RED = [0.84, 0.10, 0.07];
const DIST = Object.fromEntries(DISTRICTS.map((d) => [d.id, lin(d.color)]));
const WALLS = { software: [0.90, 0.90, 0.92], books: [0.96, 0.88, 0.70], film: [0.86, 0.82, 0.78], games: [0.98, 0.90, 0.80], health: [0.95, 0.96, 0.95] };
const GLASS = [0.20, 0.40, 0.52];

/* name: [film colour, model colour, material] */
const PAL = {
  pave: [[0.82, 0.76, 0.66]], deck: [[0.80, 0.78, 0.74]], line: [RED, RED], canopy: [[0.96, 0.96, 0.94]],
  station: [[0.90, 0.88, 0.84]], train: [[0.96, 0.96, 0.95]], glass: [GLASS, [0.56, 0.55, 0.53], 'dark'],
  tree: [[0.17, 0.42, 0.13]], tree2: [[0.29, 0.54, 0.16]], trunk: [[0.28, 0.19, 0.12]], palm: [[0.24, 0.50, 0.18]],
  house_wall: [[0.95, 0.91, 0.82]], house_roof: [[0.72, 0.30, 0.18]],
  tower: [[0.95, 0.90, 0.80], [0.80, 0.11, 0.08]], tower_band: [RED, [0.60, 0.07, 0.05]],
  scaffold: [[0.60, 0.60, 0.60]], crane: [[0.96, 0.70, 0.08], [0.96, 0.70, 0.08]], lot: [[0.74, 0.64, 0.46]],
  fence: [[0.93, 0.93, 0.92]], court_a: [[0.78, 0.30, 0.22], DIST.software.map((v) => v * 0.85)], court_b: [[0.16, 0.42, 0.66], DIST.software.map((v) => v * 0.85)],
  road: [[0.19, 0.20, 0.22], [0.58, 0.57, 0.55]], ballast: [[0.56, 0.55, 0.52], [0.66, 0.65, 0.62]], sleeper: [[0.80, 0.79, 0.75], [0.74, 0.73, 0.70]], shell: [[0.93, 0.93, 0.91]], strip: [[1.0, 0.16, 0.10], [0.84, 0.10, 0.07], 'glow'], steel: [[0.42, 0.44, 0.47]], dark: [[0.10, 0.11, 0.13]], rail: [[0.36, 0.37, 0.40]],
  white: [[0.95, 0.95, 0.93]], plot: [[0.42, 0.56, 0.24], [0.86, 0.86, 0.82]], cream: [[0.93, 0.88, 0.76]], wood: [[0.52, 0.36, 0.22]], sand: [[0.88, 0.78, 0.56]],
  hull: [[0.93, 0.93, 0.90]], hull2: [[0.16, 0.30, 0.46]], sail: [[0.98, 0.97, 0.93]],
  fur: [[0.94, 0.92, 0.86]], deer: [[0.62, 0.42, 0.26]], dog: [[0.36, 0.26, 0.18]], grey: [[0.52, 0.56, 0.60]], gull: [[0.97, 0.97, 0.97]],
  lamp: [[1.0, 0.86, 0.60], [0.95, 0.93, 0.88], 'glow'], window: [[1.0, 0.80, 0.50], [0.56, 0.55, 0.53], 'glow'],
  beam: [[1.0, 0.93, 0.72], [1.0, 0.93, 0.72], 'glow'], redglow: [[1.0, 0.22, 0.14], [0.84, 0.10, 0.07], 'glow'],
  head: [[1.0, 0.95, 0.80], [0.95, 0.93, 0.88], 'glow'], tail: [[0.9, 0.12, 0.08], [0.70, 0.68, 0.65], 'glow'],
};
['#F4F4F2', '#CC1F1A', '#1F4DB3', '#F2BC1A', '#1F2126', '#2E8B6B'].forEach((h, i) => { PAL[`car${i}`] = [lin(h)]; });
['#D5281E', '#E0A800', '#1F4FD8', '#F4F4F2', '#E8731A'].forEach((h, i) => { PAL[`umb${i}`] = [lin(h)]; });

function look(mat) {
  if (Array.isArray(mat)) return { c: mat, m: WHITE, kind: 'city' };
  if (mat.includes(':')) {
    const [d, part] = mat.split(':'); const c = DIST[d] || DIST.software;
    if (part === 'wall') return { c: WALLS[d] || WALLS.software, m: c, kind: 'city' };
    if (part === 'roof') return { c, m: c.map((v) => v * 0.80), kind: 'city' };
    if (part === 'trim') return { c: c.map((v) => v * 0.8), m: c.map((v) => v * 0.7), kind: 'city' };
    return { c: GLASS, m: c.map((v) => v * 0.62), kind: 'dark' };
  }
  const p = PAL[mat] || PAL.white;
  return { c: p[0], m: p[1] || WHITE, kind: p[2] || 'city' };
}

/* Collects coloured shapes and merges them into one geometry per material.
   The b* helpers take the rough model's coordinates (x, y, z with z up; local −y is the front) so its
   shapes port line for line; they are stored in three.js axes (x, z, −y). */
export class Kit {
  constructor() { this.list = { city: [], pearl: [], stone: [], rubber: [], metal: [], dark: [], glow: [], sign: [], tint: [], glass: [] }; }
  add(geo, mat, smooth = false) {
    const { c, m, kind } = look(mat);
    let g = geo;
    if (!smooth) { g = g.index ? g.toNonIndexed() : g; g.computeVertexNormals(); } else { g.computeVertexNormals(); g = g.index ? g.toNonIndexed() : g; }
    g.deleteAttribute('uv');
    const n = g.attributes.position.count; const col = new Float32Array(n * 3); const mc = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col.set(c, i * 3); mc.set(m, i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('mcol', new THREE.BufferAttribute(mc, 3));
    this.list[kind].push(g); return this;
  }
  bx(mat, dx, dy, dz, s, yaw = 0) { const g = new THREE.BoxGeometry(s[0], s[2], s[1]); if (yaw) g.rotateY(yaw); g.translate(dx, dz, -dy); return this.add(g, mat); }
  cyl(mat, dx, dy, dz, r, h, r2 = r, seg = 14, smooth = true) { const g = new THREE.CylinderGeometry(r2, r, h, seg); g.translate(dx, dz, -dy); return this.add(g, mat, smooth); }
  ico(mat, dx, dy, dz, r, sz = 1, sub = 1) { const g = new THREE.IcosahedronGeometry(r, sub); g.scale(1, sz, 1); g.translate(dx, dz, -dy); return this.add(g, mat); }
  /* a ridged roof: ridge along local x, base at dz */
  gable(mat, dx, dy, dz, L, W, H, yaw = 0) {
    const P = [[-L / 2, 0, W / 2], [-L / 2, 0, -W / 2], [-L / 2, H, 0], [L / 2, 0, W / 2], [L / 2, 0, -W / 2], [L / 2, H, 0]];
    const F = [[0, 2, 1], [3, 4, 5], [0, 1, 4], [0, 4, 3], [1, 2, 5], [1, 5, 4], [0, 3, 5], [0, 5, 2]];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(F.flat().flatMap((i) => P[i]), 3));
    if (yaw) g.rotateY(yaw); g.translate(dx, dz, -dy); return this.add(g, mat);
  }
  /* a barrel roof: axis along local x */
  vault(mat, dx, dy, dz, L, W, H, yaw = 0) {
    const g = new THREE.CylinderGeometry(1, 1, 1, 20, 1, false, 0, Math.PI); g.rotateZ(Math.PI / 2); g.scale(L, H, W / 2);
    if (yaw) g.rotateY(yaw); g.translate(dx, dz, -dy); return this.add(g, mat, true);
  }
  /* soften the foot of walls, like baked shade */
  shade(h = 5, low = 0.80) {
    for (const g of this.list.city) { const p = g.attributes.position; const c = g.attributes.color; const m = g.attributes.mcol; for (let i = 0; i < p.count; i++) { const k = low + (1 - low) * Math.min(1, Math.max(0, p.getY(i)) / h); c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k); m.setXYZ(i, m.getX(i) * k, m.getY(i) * k, m.getZ(i) * k); } }
    return this;
  }
  scale(s) { for (const k of Object.keys(this.list)) this.list[k].forEach((g) => g.scale(s, s, s)); return this; }
  geo() { const out = {}; for (const k of Object.keys(this.list)) out[k] = this.list[k].length ? (this.list[k].length === 1 ? this.list[k][0] : mergeGeometries(this.list[k], false)) : null; return out; }
}

const sizeOf = (geo) => { const b = new THREE.Box3(); Object.values(geo).forEach((g) => { if (g) { g.computeBoundingBox(); b.union(g.boundingBox); } }); const s = b.getSize(new THREE.Vector3()); return [s.x, b.max.y, s.z]; };
const model = (name, kit, kids = {}) => { const geo = kit.geo(); return { name, real: false, size: sizeOf(geo), geo, kids }; };
const kid = (kit, pos = [0, 0, 0]) => ({ geo: kit.geo(), pos });

/* ---------- project buildings ---------- */
const S = 1.32; // the rough model drew every building at this scale
const KIND = { b_hirvo: 'office', b_trade: 'harbour', b_court: 'sports', b_uhome: 'flats', b_pindou: 'craft', b_books: 'bookshop', b_bookflow: 'works', b_ipad: 'studio', b_yae: 'museum', b_noir: 'bar', b_influencers: 'photo', b_stickers: 'toyshop', b_party: 'party', b_duiyao: 'pharmacy', b_hackathons: 'hall' };

function shape(k, kind, d, level) {
  const W = `${d}:wall`; const R = `${d}:roof`; const G = `${d}:glass`; const big = level >= 5;
  k.bx('pave', 0, 0, 0.3, [52, 40, 0.6]);
  if (kind === 'office') {
    k.bx(G, -6, 2, 26, [24, 24, 52]).bx(R, -6, 2, 53, [25, 25, 1.6]).bx(R, -6, 2, 56, [8, 8, 5]);
    for (let f = 1; f < 9; f++) k.bx(W, -6, 2, f * 5.8, [24.5, 24.5, 0.5]);
    k.bx(W, 16, 2, 8, [20, 24, 16]).bx(R, 16, 2, 16.5, [21, 25, 1.0]).bx(G, 16, -10.2, 7, [16, 0.6, 9]);
  } else if (kind === 'harbour') {
    k.bx('pave', 0, 14, 0.5, [86, 30, 1.0]).bx(W, 0, -2, 5, [62, 28, 10]).vault(R, 0, -2, 10, 62, 28, 7);
    k.bx('deck', -24, 44, 0.9, [10, 46, 1.8]).bx('deck', 24, 44, 0.9, [10, 46, 1.8]);
    for (const sx of [-24, 24]) k.bx('crane', sx, 34, 12, [1.8, 1.8, 24]).bx('crane', sx, 42, 23, [1.8, 22, 1.8]).bx('crane', sx, 34, 24.6, [4, 4, 2]);
    const cols = ['software:roof', 'books:roof', 'film:roof', 'health:roof'];
    for (let i = 0; i < 10; i++) k.bx(cols[i % 4], -12 + (i % 5) * 6.4, 20 + Math.floor(i / 5) * 3.2, 2.3, [6, 2.6, 2.6]);
    for (let i = 0; i < 5; i++) k.bx(G, -24 + i * 12, -16.2, 4.5, [7, 0.5, 5]);
  } else if (kind === 'sports') {
    k.bx(W, 0, 10, 5, [44, 24, 10]).vault(R, 0, 10, 10, 44, 24, 6.5).bx(G, 0, -2.2, 4.5, [30, 0.5, 5]);
    k.bx('court_a', -12, -12, 0.75, [20, 11, 0.3]).bx('court_b', 12, -12, 0.75, [20, 11, 0.3]);
    for (const x of [-12, 12]) k.bx('white', x, -12, 0.92, [0.3, 11, 0.06]).bx('white', x, -12, 0.92, [20, 0.3, 0.06]);
  } else if (kind === 'flats') {
    k.bx(W, 0, 2, 8, [36, 20, 16]).bx(W, -5, 2, 20, [26, 20, 8]).bx(W, -10, 2, 28, [16, 20, 8]);
    k.bx(R, 13, 2, 16.4, [10, 20, 0.8]).bx(R, 4, 2, 24.4, [8, 20, 0.8]).bx(R, -10, 2, 32.4, [17, 21, 0.9]);
    k.bx(G, 0, -8.2, 8, [30, 0.6, 12]);
    for (let f = 0; f < 3; f++) k.bx(W, 0, -8.6, 4 + f * 4, [31, 0.9, 0.5]);
  } else if (kind === 'bookshop') {
    k.bx(W, 0, 2, 7, [34, 22, 14]).gable(R, 0, 2, 14, 36, 24, 8).bx(R, 0, -11, 5.5, [18, 5, 0.7]);
    for (const dx of [-7, -2.4, 2.4, 7]) k.cyl('canopy', dx, -12.6, 2.9, 0.7, 5.2);
    k.bx(G, 0, -9.2, 8, [24, 0.6, 5]).bx(G, 0, -9.2, 2.6, [12, 0.6, 4.4]);
  } else if (kind === 'works') {
    k.bx(W, 0, 2, 5.5, [42, 24, 11]);
    for (let i = 0; i < 4; i++) k.gable(R, -15.75 + i * 10.5, 2, 11, 24, 10.5, 5, Math.PI / 2);
    k.cyl(W, 17, 11, 13, 1.7, 26).cyl(R, 17, 11, 25.5, 2.0, 1.6).bx(G, 0, -10.2, 5, [30, 0.5, 4]);
  } else if (kind === 'museum') {
    k.bx(W, 0, 3, 7.5, [44, 24, 15]).bx(R, 0, 3, 15.4, [45, 25, 0.9]).ico(R, 0, 3, 15.5, 10.5, 0.95, 2);
    k.bx('pave', 0, -12, 1.2, [22, 6, 2.4]);
    for (const dx of [-9, -5.4, -1.8, 1.8, 5.4, 9]) k.cyl('canopy', dx, -10.4, 7.5, 0.8, 12);
    k.bx(W, 0, -10.4, 14, [22, 3, 2]).bx(G, 0, -9.2, 6, [14, 0.5, 8]);
  } else if (kind === 'bar') {
    k.bx(W, 0, 2, 5.5, [26, 18, 11]).bx(R, 0, 2, 11.3, [27, 19, 0.7]);
    k.bx(R, -10, -7.6, 12, [1.4, 2.6, 16]).bx(R, 3, -8.6, 4.2, [14, 3.2, 0.6]).bx(G, 3, -7.2, 2.4, [12, 0.5, 3.2]);
    k.bx('window', -10, -9.0, 12, [0.5, 0.3, 12]);
  } else if (kind === 'toyshop') {
    k.bx(W, 0, 2, 4.5, [22, 18, 9]).gable(R, 0, 2, 9, 25, 21, 10).bx(G, 0, -7.2, 3.6, [14, 0.5, 5]);
  } else if (kind === 'party') {
    k.bx(W, -3, 2, 5.5, [22, 18, 11]).gable(R, -3, 2, 11, 24, 20, 7);
    k.cyl(W, 11, -4, 9, 5, 18).cyl(R, 11, -4, 22.5, 6.2, 9, 0.01).bx(G, -3, -7.2, 4, [12, 0.5, 5]);
  } else if (kind === 'pharmacy') {
    k.bx(W, 0, 2, 5, [22, 16, 10]).bx(R, 0, 2, 10.3, [23, 17, 0.7]);
    k.bx(R, 0, 2, 15, [8.5, 2.2, 2.8]).bx(R, 0, 2, 15, [2.8, 2.2, 8.5]).bx(G, 0, -6.2, 3.6, [14, 0.5, 5]);
  } else if (kind === 'hall') {
    k.bx(W, 0, 3, 5, [40, 24, 10]).vault(R, 0, 3, 10, 40, 24, 7.5).bx(G, 0, -9.2, 4.5, [26, 0.5, 6]);
  } else if (kind === 'craft') {
    k.bx(W, 0, 2, 4.5, [24, 16, 9]).gable(R, 0, 2, 9, 26, 18, 6).bx(R, 0, -7.5, 4.6, [20, 3, 0.5]).bx(G, 0, -6.2, 2.6, [16, 0.5, 3.6]);
  } else if (kind === 'studio') {
    k.bx(W, 0, 2, 6, [30, 20, 12]);
    for (let i = 0; i < 3; i++) k.gable(R, -10 + i * 10, 2, 12, 20, 10, 4.5, Math.PI / 2);
    k.bx(G, 0, -8.2, 6.5, [22, 0.5, 8]);
  } else if (kind === 'photo') {
    k.bx(W, 0, 2, 7, [28, 20, 14]).bx(R, 0, 2, 14.4, [29, 21, 0.8]).bx(G, -4, -8.2, 7.5, [14, 0.5, 10]);
    k.cyl(R, 9, 2, 16.5, 3.4, 3.6, 3.4, 18).bx(R, 9, -8.6, 9, [5, 0.6, 5]);
  } else {
    k.bx(W, 0, 2, 7, [28, 20, 14]).bx(R, 0, 2, 14.4, [29, 21, 0.8]).bx(G, 0, -8.2, 5, [18, 0.5, 6]);
  }
  if (big) { k.cyl('steel', -20, -14, 9, 0.25, 18, 0.25, 6).bx(R, -17.6, -14, 16.4, [4.6, 0.12, 2.6]); k.bx(R, 20, -15, 1.6, [8, 4, 2.2]); }
}
export function standBuilding(stop, level) {
  const k = new Kit(); shape(k, KIND[stop.model] || 'plain', stop.district, level);
  k.shade(6, 0.78).scale(S * (level <= 3 ? 0.9 : level >= 5 ? 1.08 : 1));
  return model(`${stop.model}_L${level}`, k);
}
export function standLot(district = 'software') {
  const k = new Kit(); k.bx('lot', 0, 0, 0.35, [34, 26, 0.5]);
  for (const [dx, dy, s] of [[0, 13, [34, 0.4, 1.8]], [0, -13, [34, 0.4, 1.8]], [17, 0, [0.4, 26, 1.8]], [-17, 0, [0.4, 26, 1.8]]]) k.bx('fence', dx, dy, 1.3, s);
  k.bx(`${district}:roof`, -10, -13.4, 4, [6, 0.4, 3.4]).bx('steel', -12.4, -13.4, 1.5, [0.3, 0.3, 3]).bx('steel', -7.6, -13.4, 1.5, [0.3, 0.3, 3]);
  k.scale(S); return model('lot', k);
}
export function standSite(large = false) {
  const w = large ? 34 : 26; const d = large ? 22 : 18; const floors = large ? 4 : 3; const k = new Kit();
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) k.bx('scaffold', -w / 2 + (i * w) / 3, -d / 2 + (j * d) / 2, floors * 3, [0.7, 0.7, floors * 6]);
  for (let f = 1; f <= floors; f++) k.bx('scaffold', 0, 0, f * 6, [w + 1, d + 1, 0.45]);
  k.bx('lot', 0, 0, 0.35, [w + 14, d + 12, 0.5]);
  const H = large ? 46 : 38; const cx = w / 2 + 6; const cy = d / 2;
  k.bx('crane', cx, cy, H / 2, [1.6, 1.6, H]).scale(S);
  const jib = new Kit(); jib.bx('crane', -8, 0, -1, [30, 1.4, 1.4]).bx('crane', 0, 0, 0.6, [3, 3, 2]).bx('steel', 6, 0, -0.2, [5, 2.2, 1.6]).scale(S);
  const name = large ? 'site_large' : 'site_small';
  return model(name, k, { jib: kid(jib, [cx * S, H * S, -cy * S]) });
}

/* ---------- the metro: stations, train, tram ---------- */
/* A station for the floating trains: two side platforms, 48 m long, with half-height glass gates, open air
   between them and a strip of light where each train docks; one curved roof over both; steps down to the
   square. rise = how far the trains' level is above the ground. The lane runs along local x; +z is the square. */
export function standStation(big, rise) {
  const k = new Kit(); const L = 48; const top = rise + 1.1; const half = 2.1; // lane centres ±2.1 m
  for (const u of [-1, 1]) {
    const z0 = u * (half + 1.62); const zc = u * (half + 1.62 + 1.9); // platform edge, platform middle
    k.bx('shell', 0, -zc, top - 0.25, [L + 2, 3.8, 0.5]).bx('shell', 0, -(zc + u * 0.6), top - 0.8, [L - 6, 2.2, 0.6]);
    k.bx('glass', 0, -(z0 + u * 0.1), top + 0.65, [L, 0.06, 1.3]).bx('shell', 0, -(z0 + u * 0.1), top + 1.33, [L, 0.12, 0.08]);
    for (let x = -L / 2; x <= L / 2; x += 4) k.bx('shell', x, -(z0 + u * 0.1), top + 0.66, [0.12, 0.12, 1.34]);
    k.bx('strip', 0, -(u * half), rise - 0.3, [L, 0.5, 0.08]).bx('shell', 0, -(u * half), rise - 0.45, [L + 4, 0.9, 0.22]);
    for (const x of [-18, -6, 6, 18]) k.cyl('shell', x, -(u * 6.6), top / 2 - 0.2, 0.42, top - 0.4, 0.3, 14).cyl('shell', x, -(u * 6.9), top + 2.3, 0.14, 4.6, 0.14, 8);
    for (const x of [-12, 12]) k.bx('lamp', x, -(u * 5), top + 4.3, [5, 0.3, 0.1]);
  }
  for (const x of [-20, 0, 20]) k.bx('shell', x, 0, rise - 0.9, [1.2, 12.6, 0.5]); // slim ties under the lanes
  k.vault('shell', 0, 0, top + 4.5, L + 4, 16.4, 3.1).vault('glass', 0, 0, top + 4.52, L - 8, 9, 2.9);
  const steps = 12; for (let i = 0; i < steps; i++) { const y = top - ((i + 0.5) * top) / steps; k.bx('shell', 0, -(8 + i * 0.9), y - 0.2, [big ? 12 : 7, 0.92, 0.4]); k.bx('shell', big ? 22 : 16, 8 + i * 0.9, y - 0.2, [4, 0.92, 0.4]); }
  k.bx('strip', 0, -8.05, top + 0.2, [big ? 12 : 7, 0.08, 0.1]);
  if (big) k.bx('shell', -20, -11, top / 2, [9, 6, top]).bx('glass', -20, -14.05, top / 2, [7, 0.1, top - 2]);
  return model(big ? 'station_main' : 'station', k);
}
/* one car: length along local z, sitting on the rails */
export function standCar(end) {
  const k = new Kit();
  k.bx('train', 0, 0, 1.95, [2.9, 14.5, 3.1]).bx('line', 0, 0, 1.25, [3.0, 14.6, 0.5]).bx('glass', 0, 0, 2.5, [3.02, 12.5, 0.9]);
  k.bx('dark', 0, 0, 0.25, [2.5, 13.4, 0.5]).bx('steel', 0, 0, 3.6, [2.2, 12, 0.3]);
  if (end) k.bx('glass', 0, -7.28, 2.4, [2.3, 0.1, 1.2]).bx('head', -0.9, -7.3, 1.0, [0.4, 0.1, 0.25]).bx('head', 0.9, -7.3, 1.0, [0.4, 0.1, 0.25]);
  const kids = {};
  [-3.4, 3.4].forEach((y, i) => { const d = new Kit(); d.bx('train', 0, 0, 1.2, [3.06, 1.5, 2.3]).bx('glass', 0, 0, 1.6, [3.08, 1.0, 1.1]); kids[`door_${i + 1}`] = kid(d, [0, 0.55, -y]); });
  return model(end ? 'train_end' : 'train_mid', k, kids);
}
export function standTram() {
  const k = new Kit(); k.bx('line', 0, 0, 2.2, [3.0, 9, 3.2]).bx('glass', 0, 0, 2.8, [3.05, 7.5, 1.0]).bx('glass', 0, -4.52, 2.6, [2.3, 0.1, 1.3]).bx('glass', 0, 4.52, 2.6, [2.3, 0.1, 1.3]);
  k.bx('dark', 0, 0, 0.35, [2.4, 8, 0.5]).bx('white', 0, 0, 3.95, [2.6, 8.4, 0.3]).bx('head', 0, -4.54, 1.2, [1.2, 0.1, 0.25]).bx('head', 0, 4.54, 1.2, [1.2, 0.1, 0.25]);
  return model('tram', k);
}

/* ---------- Kevin's tower: a slim spire with three soft ribs ---------- */
export function standTower(H = 200) {
  const N = 46; const SEG = 36; const pos = []; const idx = [];
  for (let i = 0; i <= N; i++) { const t = i / N; const r = 1.6 + 19.0 * (1 - t) ** 2.3; for (let s = 0; s < SEG; s++) { const ph = (2 * Math.PI * s) / SEG; const rr = r * (1 + 0.20 * Math.cos(3 * ph) * (1 - t) ** 0.6); pos.push(rr * Math.cos(ph), 0.5 + H * t, -rr * Math.sin(ph)); } }
  for (let i = 0; i < N; i++) for (let s = 0; s < SEG; s++) { const a = i * SEG + s; const b = i * SEG + ((s + 1) % SEG); const c = (i + 1) * SEG + ((s + 1) % SEG); const d = (i + 1) * SEG + s; idx.push(a, b, c, a, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const k = new Kit(); k.add(g, 'tower', true);
  k.cyl('pave', 0, 0, -5, 27, 11, 27, 40);
  for (const t of [0.18, 0.36, 0.54, 0.72]) { const r = 1.6 + 19.0 * (1 - t) ** 2.3; k.cyl('tower_band', 0, 0, 0.5 + H * t, r * 1.24, 1.6, r * 1.24, 36); }
  // window slits between the ribs, low on the shaft
  for (let j = 0; j < 3; j++) { const ph = (j + 0.5) * ((2 * Math.PI) / 3); for (let f = 0; f < 7; f++) { const t = 0.04 + f * 0.035; const r = (1.6 + 19.0 * (1 - t) ** 2.3) * (1 - 0.2 * (1 - t) ** 0.6) + 0.15; const b = new THREE.BoxGeometry(2.6, 3.4, 0.3); b.rotateY(ph + Math.PI / 2); b.translate(r * Math.cos(ph), 0.5 + H * t, -r * Math.sin(ph)); k.add(b, 'glass'); } }
  const crown = new Kit(); crown.cyl('tower', 0, 0, 14, 0.7, 30, 0.1, 8).cyl('redglow', 0, 0, 0.4, 2.4, 0.8, 2.4, 20).ico('redglow', 0, 0, 29.5, 1.1, 1, 1);
  return model('tower', k, { crown: kid(crown, [0, H + 0.5, 0]) });
}

/* ---------- props ---------- */
const P = {
  house_a: () => new Kit().bx('house_wall', 0, 0, 2.6, [9.5, 7.2, 5.2]).gable('house_roof', 0, 0, 5.2, 10.5, 8.2, 3.2).bx('window', 0, -3.62, 2.6, [1.6, 0.08, 1.4]).bx('wood', 2.6, -3.62, 1.1, [1.1, 0.08, 2.2]).shade(3, 0.85),
  house_b: () => new Kit().bx('house_wall', 0, 0, 2.3, [8.2, 6.6, 4.6]).gable('house_roof', 0, 0, 4.6, 9.2, 7.6, 3.0).bx('window', -1.8, -3.32, 2.4, [1.4, 0.08, 1.3]).bx('window', 1.8, -3.32, 2.4, [1.4, 0.08, 1.3]).shade(3, 0.85),
  house_c: () => new Kit().bx('cream', 0, 0, 3.0, [10.8, 7.8, 6.0]).gable('house_roof', 0, 0, 6.0, 11.8, 8.8, 3.4).bx('window', -2.6, -3.92, 3.6, [1.5, 0.08, 1.3]).bx('window', 2.6, -3.92, 3.6, [1.5, 0.08, 1.3]).bx('wood', 0, -3.92, 1.1, [1.2, 0.08, 2.2]).shade(3, 0.85),
  house_d: () => new Kit().bx('house_wall', -1.5, 0, 2.2, [7, 6.5, 4.4]).gable('house_roof', -1.5, 0, 4.4, 8, 7.5, 2.8).bx('cream', 3.4, 0.8, 1.6, [3.6, 4.6, 3.2]).bx('house_roof', 3.4, 0.8, 3.3, [4, 5, 0.3]).bx('window', -1.5, -3.27, 2.4, [1.5, 0.08, 1.3]).shade(3, 0.85),
  tree_a: () => new Kit().cyl('trunk', 0, 0, 2.2, 0.45, 4.4, 0.35, 6).ico('tree', 0, 0, 7.4, 4.2, 1.15, 1),
  tree_b: () => new Kit().cyl('trunk', 0, 0, 2.6, 0.45, 5.2, 0.35, 6).ico('tree2', 0, 0, 8.2, 4.6, 1.0, 1).ico('tree2', 1.6, 0.8, 6.4, 2.8, 1, 1),
  tree_c: () => new Kit().cyl('trunk', 0, 0, 2.0, 0.5, 4.0, 0.36, 6).ico('tree', -1.4, 0, 6.6, 3.6, 0.9, 1).ico('tree2', 1.8, 0.6, 7.2, 3.2, 0.95, 1),
  tree_pine: () => new Kit().cyl('trunk', 0, 0, 1.6, 0.4, 3.2, 0.3, 6).cyl('tree', 0, 0, 6.6, 3.2, 8.2, 0.05, 8, false),
  palm: () => { const k = new Kit().cyl('trunk', 0, 0, 3.6, 0.32, 7.2, 0.22, 6); for (let i = 0; i < 6; i++) { const g = new THREE.BoxGeometry(4.4, 0.12, 1.0); g.translate(2.3, 0, 0); g.rotateZ(-0.38); g.rotateY((i * Math.PI) / 3); g.translate(0, 7.3, 0); k.add(g, 'palm'); } return k; },
  car_a: () => car('car0'), car_b: () => car('car1'), car_c: () => car('car2'),
  bus: () => new Kit().bx('line', 0, 0, 2.05, [3.0, 11, 3.3]).bx('glass', 0, 0, 2.7, [3.04, 9.6, 1.1]).bx('dark', 0, 0, 0.35, [2.6, 9.4, 0.5]).bx('head', 0, -5.52, 1.1, [1.8, 0.08, 0.3]).bx('tail', 0, 5.52, 1.1, [1.8, 0.08, 0.3]),
  streetlamp: () => new Kit().cyl('steel', 0, 0, 3.4, 0.16, 6.8, 0.12, 6).bx('steel', 0, -0.9, 6.7, [0.14, 1.9, 0.14]).bx('lamp', 0, -1.7, 6.55, [0.5, 0.9, 0.18]),
  bench: () => new Kit().bx('wood', 0, 0, 0.5, [2.2, 0.6, 0.12]).bx('wood', 0, 0.3, 0.9, [2.2, 0.1, 0.6]).bx('steel', -0.9, 0, 0.25, [0.1, 0.5, 0.5]).bx('steel', 0.9, 0, 0.25, [0.1, 0.5, 0.5]),
  boat_sail: () => { const k = new Kit().bx('hull', 0, 0, 0.5, [2.6, 8, 1.4]).bx('hull2', 0, 0, -0.1, [2.7, 8.1, 0.4]).cyl('steel', 0, 0.4, 6, 0.12, 11, 0.1, 6); const s = new THREE.BufferGeometry(); s.setAttribute('position', new THREE.Float32BufferAttribute([0.02, 1.6, -0.2, 0.02, 11.2, -0.2, 0.02, 1.6, 3.6, -0.02, 1.6, -0.2, -0.02, 1.6, 3.6, -0.02, 11.2, -0.2, 0.02, 1.9, -0.7, 0.02, 1.9, -3.6, 0.02, 9.4, -0.7, -0.02, 1.9, -0.7, -0.02, 9.4, -0.7, -0.02, 1.9, -3.6], 3)); return k.add(s, 'sail'); },
  boat_fishing: () => new Kit().bx('hull2', 0, 0, 0.6, [3.4, 9.5, 1.6]).bx('white', 0, 1.6, 2.2, [2.4, 3.2, 1.8]).bx('glass', 0, 0.0, 2.4, [2.42, 0.1, 0.9]).cyl('steel', 0, -2.2, 3.4, 0.1, 4.4, 0.1, 6).bx('redglow', 0, 1.6, 3.2, [0.3, 0.3, 0.2]),
  ferry: () => new Kit().bx('hull', 0, 0, 1.0, [8, 30, 2.6]).bx('line', 0, 0, 0.2, [8.1, 30.1, 0.6]).bx('white', 0, 1, 3.6, [6.6, 22, 2.6]).bx('glass', 0, 1, 3.8, [6.64, 20, 1.0]).bx('white', 0, 3, 5.8, [5, 9, 1.8]).bx('glass', 0, -1.52, 6.0, [4.4, 0.1, 0.9]).cyl('line', 0, 5, 7.8, 0.8, 2.4, 0.7, 10).bx('window', 0, 1, 2.75, [6.66, 20, 0.3]),
  umbrella: () => new Kit().cyl('white', 0, 0, 1.3, 0.06, 2.6, 0.06, 5).cyl('white', 0, 0, 2.75, 1.9, 0.7, 0.05, 8, false),
  sunbed: () => new Kit().bx('white', 0, 0, 0.3, [0.7, 1.9, 0.12]).bx('white', 0, 0.75, 0.52, [0.7, 0.6, 0.1]),
  sheep: () => new Kit().bx('fur', 0, 0, 0.75, [0.7, 1.2, 0.7]).bx('dark', 0, -0.72, 0.95, [0.36, 0.4, 0.38]).bx('dark', -0.22, -0.4, 0.2, [0.12, 0.12, 0.4]).bx('dark', 0.22, -0.4, 0.2, [0.12, 0.12, 0.4]).bx('dark', -0.22, 0.4, 0.2, [0.12, 0.12, 0.4]).bx('dark', 0.22, 0.4, 0.2, [0.12, 0.12, 0.4]),
  deer: () => new Kit().bx('deer', 0, 0, 1.15, [0.5, 1.4, 0.6]).bx('deer', 0, -0.75, 1.75, [0.3, 0.3, 0.9]).bx('deer', 0, -1.0, 2.2, [0.32, 0.6, 0.34]).bx('wood', -0.14, -0.9, 2.6, [0.06, 0.06, 0.5]).bx('wood', 0.14, -0.9, 2.6, [0.06, 0.06, 0.5]).bx('deer', -0.18, -0.5, 0.42, [0.1, 0.1, 0.85]).bx('deer', 0.18, -0.5, 0.42, [0.1, 0.1, 0.85]).bx('deer', -0.18, 0.5, 0.42, [0.1, 0.1, 0.85]).bx('deer', 0.18, 0.5, 0.42, [0.1, 0.1, 0.85]),
  dog: () => new Kit().bx('dog', 0, 0, 0.42, [0.3, 0.8, 0.32]).bx('dog', 0, -0.5, 0.62, [0.26, 0.34, 0.28]).bx('dog', 0, 0.44, 0.62, [0.07, 0.07, 0.3]).bx('dog', -0.1, -0.28, 0.13, [0.08, 0.08, 0.26]).bx('dog', 0.1, -0.28, 0.13, [0.08, 0.08, 0.26]).bx('dog', -0.1, 0.28, 0.13, [0.08, 0.08, 0.26]).bx('dog', 0.1, 0.28, 0.13, [0.08, 0.08, 0.26]),
  dolphin: () => { const k = new Kit(); const b = new THREE.SphereGeometry(1, 8, 6); b.scale(0.36, 0.38, 1.5); k.add(b, 'grey', true); return k.bx('grey', 0, 1.6, 0, [1.1, 0.5, 0.08]).bx('grey', 0, -0.1, 0.42, [0.06, 0.6, 0.4]); },
};
function car(col) {
  return new Kit().bx(col, 0, 0, 0.75, [2.0, 4.6, 0.9]).bx(col, 0, 0.25, 1.45, [1.8, 2.5, 0.6]).bx('glass', 0, 0.25, 1.5, [1.84, 2.2, 0.42]).bx('glass', 0, -1.02, 1.42, [1.6, 0.1, 0.44])
    .bx('dark', 0, 0, 0.24, [2.04, 3.4, 0.3]).bx('head', -0.65, -2.31, 0.8, [0.4, 0.06, 0.18]).bx('head', 0.65, -2.31, 0.8, [0.4, 0.06, 0.18]).bx('tail', -0.65, 2.31, 0.85, [0.4, 0.06, 0.16]).bx('tail', 0.65, 2.31, 0.85, [0.4, 0.06, 0.16]);
}
export function standProp(name) {
  if (name === 'lighthouse') {
    const k = new Kit().cyl('pave', 0, 0, 0.6, 5.2, 1.2, 5.6, 16); const H = 26;
    for (let i = 0; i < 4; i++) { const r0 = 3.4 - i * 0.42; k.cyl(i % 2 ? 'line' : 'white', 0, 0, 1.2 + (i + 0.5) * (H / 4), r0, H / 4, r0 - 0.42, 16); }
    k.cyl('steel', 0, 0, H + 1.4, 2.6, 0.4, 2.6, 16).cyl('glass', 0, 0, H + 3.0, 1.5, 2.8, 1.5, 12).cyl('line', 0, 0, H + 5.2, 1.9, 1.6, 0.05, 12);
    const lamp = new Kit().ico('beam', 0, 0, 0, 0.9, 1, 1);
    return model(name, k, { lamp: kid(lamp, [0, H + 3.0, 0]) });
  }
  if (name === 'gull') {
    const k = new Kit().bx('gull', 0, 0, 0, [0.22, 0.9, 0.2]).bx('crane', 0, -0.52, 0, [0.08, 0.16, 0.08]);
    const wing = (s) => { const w = new Kit(); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.28, s * 1.5, 0, 0.1, 0, 0, 0.32, 0, 0, -0.28, 0, 0, 0.32, s * 1.5, 0, 0.1], 3)); w.add(g, 'gull'); return kid(w, [s * 0.1, 0.05, 0]); };
    return model(name, k, { wing_l: wing(-1), wing_r: wing(1) });
  }
  const make = P[name]; if (!make) return null;
  return model(name, make());
}
export const PROP_NAMES = [...Object.keys(P), 'lighthouse', 'gull'];
