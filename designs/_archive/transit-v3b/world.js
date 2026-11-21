/* Kevin Metro · the city
   One unit is one metre. A street grid with a river, believable blocks, and one double-track
   line (K Line) that runs underground, through an open cut, and onto a viaduct.
   Everything is generated here; nothing is loaded from the network. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { buildLandmark } from './landmarks.js';

export const GAUGE = 1.435;
export const TRACK_OFF = 5; // track centres at ±5 m from the line centre
export const TRAIN_LAT = -TRACK_OFF; // the train uses the track on the camera's side
export const RIVER = { z0: 166, z1: 234, water: -2.4 };
export const BOUNDS = { x0: -760, x1: 880, z0: -520, z1: 470 };
const AVE_X = Array.from({ length: 13 }, (_, i) => -720 + 130 * i); // north–south avenues
const ST_Z = Array.from({ length: 9 }, (_, j) => -460 + 110 * j); // east–west streets
const AVE_W = 20;
const ST_W = 16;
const BRIDGE_AVES = [-330, 190, 580];

/* ---------- tiny helpers ---------- */
const rngFactory = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const smooth = (a, b, t) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };

/* ---------- static batching: merge every static mesh per material ---------- */
export const TILE = 400;
export const tileOf = (x, z) => `${Math.floor(x / TILE)},${Math.floor(z / TILE)}`;
export class Batch {
  constructor(vc) { this.buckets = new Map(); this.vc = vc; }
  add(geo, mat, matrix, opts = {}) {
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
  const matteNames = ['asphalt', 'sidewalk', 'concrete', 'concreteDark', 'grass', 'grassDark', 'verge', 'ballast', 'white', 'ink', 'line', 'yellow', 'brick', 'wood', 'crane'];
  const M = {
    asphalt: std(0x5a5c60, 0.95),
    asphaltWet: std(0x2f3136, 0.18, 0.1),
    sidewalk: std(0xd9d3c7, 0.92),
    concrete: std(0xc9c6bf, 0.9),
    concreteDark: std(0x9d9a94, 0.9),
    grass: std(0x93ad74, 1),
    grassDark: std(0x7e9a63, 1),
    verge: std(0xa8b48f, 1),
    ballast: std(0x8d877d, 1),
    steel: std(0x8f949b, 0.38, 0.85),
    railSteel: std(0xb7bcc2, 0.28, 0.95),
    water: std(0x5d8c99, 0.12, 0.15, { envMapIntensity: 1.2 }),
    white: std(0xf4f3ef, 0.6),
    ink: std(0x1f2126, 0.7),
    glass: std(0x26323e, 0.06, 0.4, { transparent: true, opacity: 0.55, envMapIntensity: 1.4 }),
    glassClear: std(0xbfd6e2, 0.05, 0.1, { transparent: true, opacity: 0.28, depthWrite: false, envMapIntensity: 1.2 }),
    line: std(lineHex, 0.5),
    yellow: std(0xf2b705, 0.6),
    brick: std(0x9b5b47, 0.95),
    wood: std(0x8a6a4b, 0.9),
    crane: std(0xe0a22a, 0.6, 0.2),
    container: std(0xffffff, 0.75, 0.2),
  };
  matteNames.forEach((n) => { M[n].userData.matte = true; });
  M.vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, side: THREE.DoubleSide });
  return M;
}

/* ---------- the K Line: alignment, profile and segment types ---------- */
export const STATION_DEFS = [
  { id: 'university', code: 'K01', name: 'University', zh: '大学', x: -560, z: -300, hx: 1, hz: 0, y: -10 },
  { id: 'downtown', code: 'K02', name: 'Downtown', zh: '市中心', x: -300, z: -300, hx: 1, hz: 0, y: -10 },
  { id: 'oldtown', code: 'K03', name: 'Old Town', zh: '老城', x: -5, z: -185, hx: 1, hz: 0, y: -4 },
  { id: 'harbour', code: 'K04', name: 'Harbour', zh: '港口', x: 240, z: 100, hx: 0.6, hz: 0.8, y: 9 },
  { id: 'arts', code: 'K05', name: 'Arts District', zh: '艺术区', x: 330, z: 360, hx: 1, hz: 0, y: 9 },
  { id: 'sports', code: 'K06', name: 'Sports Park', zh: '体育公园', x: 580, z: 360, hx: 0.97, hz: -0.25, y: 9 },
  { id: 'innovation', code: 'K07', name: 'Innovation Hall', zh: '创新馆', x: 700, z: 95, hx: 0, hz: -1, y: 9 },
  { id: 'nonstop', code: 'K08', name: 'Non-stop', zh: '不停站', x: 700, z: -170, hx: 0, hz: -1, y: 9 },
];

export function buildLine() {
  const ctrl = [];
  const push = (x, z) => ctrl.push(new THREE.Vector3(x, 0, z));
  push(-700, -300);
  STATION_DEFS.forEach((s, i) => {
    const h = new THREE.Vector2(s.hx, s.hz).normalize();
    push(s.x - h.x * 60, s.z - h.y * 60); push(s.x, s.z); push(s.x + h.x * 60, s.z + h.y * 60);
    if (s.id === 'oldtown') { push(130, -150); }
    if (s.id === 'harbour') { push(296, 245); }
    if (s.id === 'sports') { push(690, 280); }
  });
  push(700, -330); push(700, -520);
  const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal', 0.5);
  const L = curve.getLength();
  const N = Math.ceil(L);
  const P = []; const T = [];
  for (let i = 0; i <= N; i++) { const u = i / N; P.push(curve.getPointAt(u)); T.push(curve.getTangentAt(u).setY(0).normalize()); }
  const step = L / N;
  const nearestS = (x, z) => { let best = 0; let bd = Infinity; for (let i = 0; i <= N; i++) { const d = (P[i].x - x) ** 2 + (P[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } } return best * step; };
  const stations = STATION_DEFS.map((d) => ({ ...d, s: nearestS(d.x, d.z) }));
  // elevation keyframes: flat ±55 m around every station, eased ramps between
  const keys = [];
  stations.forEach((st) => { keys.push([st.s - 55, st.y], [st.s + 55, st.y]); });
  keys.unshift([0, -10]);
  keys.push([L, 9]);
  const yAt = (s) => {
    if (s <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (s <= keys[i][0]) { const [s0, y0] = keys[i - 1]; const [s1, y1] = keys[i]; const t = (s - s0) / Math.max(1e-6, s1 - s0); return y0 + (y1 - y0) * (0.5 - 0.5 * Math.cos(Math.PI * t)); }
    }
    return keys[keys.length - 1][1];
  };
  const at = (s) => {
    const f = Math.min(N - 1e-6, Math.max(0, s / step)); const i = Math.floor(f); const t = f - i;
    const p = P[i].clone().lerp(P[i + 1], t); const tg = T[i].clone().lerp(T[i + 1], t).normalize();
    const n = new THREE.Vector3(tg.z, 0, -tg.x); // the "+" side of the line
    p.y = yAt(s);
    return { p, t: tg, n };
  };
  // a point on a track (lat = lateral offset) at arc length s
  const trackPoint = (s, lat, dy = 0) => { const a = at(s); return a.p.add(a.n.multiplyScalar(lat)).setY(a.p.y + dy); };
  const typeAt = (s) => { const y = yAt(s); if (y < -6.2) return 'tunnel'; if (y < -0.3) return 'cut'; if (y < 4.6) return 'embankment'; return 'viaduct'; };
  // where the line can't share space with a road (too low to bridge, too high to pass under)
  const noCross = (s) => { const y = yAt(s); return y > -5.6 && y < 7.6; };
  const portalS = (() => { for (let s = stations[1].s; s < stations[2].s; s += 0.5) if (yAt(s) >= -6.2) return s; return stations[1].s + 120; })();
  const endBuiltS = stations[7].s + 140; // finished deck ends here; beyond is under construction
  return { curve, L, step, P, T, at, yAt, trackPoint, typeAt, noCross, stations, portalS, endBuiltS };
}

/* ---------- sweeping a cross-section along the line ---------- */
// profile: [[lat, dy, absY?], ...] — dy is relative to rail level unless absY is a number (then absolute y)
export function sweep(line, s0, s1, profile, opts = {}) {
  const CH = 150; const out = [];
  for (let c0 = s0; c0 < s1 - 0.01; c0 += CH) out.push(...sweepOne(line, c0, Math.min(s1, c0 + CH), profile, opts));
  return out;
}
function sweepOne(line, s0, s1, profile, opts) {
  const step = opts.step || 2;
  const n = Math.max(1, Math.ceil((s1 - s0) / step));
  const strips = [];
  for (let j = 0; j < profile.length - 1 + (opts.closed ? 1 : 0); j++) {
    const a = profile[j]; const b = profile[(j + 1) % profile.length];
    const pos = []; const idx = []; const uv = [];
    for (let i = 0; i <= n; i++) {
      const s = s0 + ((s1 - s0) * i) / n;
      const fr = line.at(s);
      [a, b].forEach((q, k) => {
        const y = q[2] !== undefined && q[2] !== null ? (typeof q[2] === 'function' ? q[2](s) : q[2]) : fr.p.y + q[1];
        const p = fr.p.clone().add(fr.n.clone().multiplyScalar(q[0]));
        pos.push(p.x, y, p.z); uv.push(k, s / (opts.vScale || 1));
      });
      if (i < n) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    strips.push(g);
  }
  return strips;
}
const addStrips = (batch, strips, mat, opts) => strips.forEach((g) => batch.add(g, mat, null, opts));

/* ---------- the city ---------- */
export function buildCity({ scene, M, line, lineHex, isPhone, landmarks, atlas }) {
  const rng = rngFactory(20240611);
  const batch = new Batch(M.vc);
  const anim = [];
  const ROAD_Y = 0.02;

  /* roads: avenues and streets, cut by the river and by the rail corridor where it can't be crossed */
  const corridor = [];
  for (let s = 0; s < line.L; s += 3) if (line.typeAt(s) !== 'tunnel' && line.noCross(s)) corridor.push(line.at(s).p);
  const inCorridor = (x, z, pad) => corridor.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < (pad) ** 2);
  const roadRects = []; // {x0,x1,z0,z1,dir}
  const pushRoad = (x0, x1, z0, z1, dir) => { if (x1 - x0 > 1 && z1 - z0 > 1) roadRects.push({ x0, x1, z0, z1, dir }); };
  AVE_X.forEach((x) => {
    // walk along z and split where the river (no bridge) or the corridor blocks the road
    let start = BOUNDS.z0; let open = true;
    const blocked = (z) => ((z > RIVER.z0 - 4 && z < RIVER.z1 + 4) && !BRIDGE_AVES.includes(x)) || inCorridor(x, z, 15);
    for (let z = BOUNDS.z0; z <= BOUNDS.z1; z += 2) {
      const b = blocked(z);
      if (open && b) { pushRoad(x - AVE_W / 2, x + AVE_W / 2, start, z - 2, 'z'); open = false; }
      else if (!open && !b) { start = z; open = true; }
    }
    if (open) pushRoad(x - AVE_W / 2, x + AVE_W / 2, start, BOUNDS.z1, 'z');
  });
  ST_Z.forEach((z) => {
    if (z > RIVER.z0 - 10 && z < RIVER.z1 + 10) return;
    let start = BOUNDS.x0; let open = true;
    const blocked = (x) => inCorridor(x, z, 13);
    for (let x = BOUNDS.x0; x <= BOUNDS.x1; x += 2) {
      const b = blocked(x);
      if (open && b) { pushRoad(start, x - 2, z - ST_W / 2, z + ST_W / 2, 'x'); open = false; }
      else if (!open && !b) { start = x; open = true; }
    }
    if (open) pushRoad(start, BOUNDS.x1, z - ST_W / 2, z + ST_W / 2, 'x');
  });
  const onRoad = (x, z, pad = 0) => roadRects.some((r) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad);
  roadRects.forEach((r, i) => batch.box(r.x1 - r.x0, 0.04, r.z1 - r.z0, M.asphalt, (r.x0 + r.x1) / 2, ROAD_Y + (r.dir === 'x' ? 0.003 : 0), (r.z0 + r.z1) / 2, 0, { cast: false }));

  /* ground with holes: the river channel and the open cut */
  const shape = new THREE.Shape();
  shape.moveTo(BOUNDS.x0 - 400, BOUNDS.z0 - 400); shape.lineTo(BOUNDS.x1 + 400, BOUNDS.z0 - 400); shape.lineTo(BOUNDS.x1 + 400, BOUNDS.z1 + 400); shape.lineTo(BOUNDS.x0 - 400, BOUNDS.z1 + 400); shape.closePath();
  const river = new THREE.Path(); // Shape is in x/y; we map y -> -z after rotating
  river.moveTo(BOUNDS.x0 - 400, -RIVER.z0); river.lineTo(BOUNDS.x0 - 400, -RIVER.z1); river.lineTo(BOUNDS.x1 + 400, -RIVER.z1); river.lineTo(BOUNDS.x1 + 400, -RIVER.z0); river.closePath();
  shape.holes.push(river);
  // the cut: from the portal to where the line climbs out
  let cutEnd = line.portalS; while (line.typeAt(cutEnd) === 'cut' || line.typeAt(cutEnd) === 'tunnel') cutEnd += 1;
  const cutHole = new THREE.Path();
  const left = []; const right = [];
  for (let s = line.portalS; s <= cutEnd; s += 3) { const a = line.at(s); left.push(a.p.clone().add(a.n.clone().multiplyScalar(-6.9))); right.push(a.p.clone().add(a.n.clone().multiplyScalar(6.9))); }
  cutHole.moveTo(left[0].x, -left[0].z); left.forEach((p) => cutHole.lineTo(p.x, -p.z)); right.reverse().forEach((p) => cutHole.lineTo(p.x, -p.z)); cutHole.closePath();
  shape.holes.push(cutHole);
  const groundGeo = new THREE.ShapeGeometry(shape, 1); groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, M.verge); ground.receiveShadow = true; scene.add(ground);

  /* river: water, embankment walls, promenade railings, road bridges */
  const water = new THREE.Mesh(new THREE.PlaneGeometry(BOUNDS.x1 - BOUNDS.x0 + 800, RIVER.z1 - RIVER.z0), M.water);
  water.rotation.x = -Math.PI / 2; water.position.set((BOUNDS.x0 + BOUNDS.x1) / 2, RIVER.water, (RIVER.z0 + RIVER.z1) / 2); water.receiveShadow = true; scene.add(water);
  const rw = BOUNDS.x1 - BOUNDS.x0 + 800; const rcx = (BOUNDS.x0 + BOUNDS.x1) / 2;
  batch.box(rw, 4.2, 1.2, M.concrete, rcx, -1.9, RIVER.z0 + 0.6, 0, { cast: false });
  batch.box(rw, 4.2, 1.2, M.concrete, rcx, -1.9, RIVER.z1 - 0.6, 0, { cast: false });
  batch.box(rw, 3, 6, M.sidewalk, rcx, -1.4, RIVER.z0 - 3, 0, { cast: false });
  batch.box(rw, 3, 6, M.sidewalk, rcx, -1.4, RIVER.z1 + 3, 0, { cast: false });
  BRIDGE_AVES.forEach((x) => {
    const len = RIVER.z1 - RIVER.z0 + 4;
    batch.box(AVE_W + 3, 1.4, len, M.concrete, x, -0.68, (RIVER.z0 + RIVER.z1) / 2);
    batch.box(0.4, 1.1, len, M.concrete, x - AVE_W / 2 - 1.3, 0.55, (RIVER.z0 + RIVER.z1) / 2);
    batch.box(0.4, 1.1, len, M.concrete, x + AVE_W / 2 + 1.3, 0.55, (RIVER.z0 + RIVER.z1) / 2);
    [RIVER.z0 + 22, RIVER.z1 - 22].forEach((z) => batch.box(AVE_W - 4, 3, 3, M.concreteDark, x, -2.6, z));
  });

  /* blocks: raised sidewalks with kerbs, then lots */
  const blocks = [];
  for (let i = 0; i < AVE_X.length - 1; i++) for (let j = 0; j < ST_Z.length - 1; j++) {
    let x0 = AVE_X[i] + AVE_W / 2; let x1 = AVE_X[i + 1] - AVE_W / 2;
    let z0 = ST_Z[j] + ST_W / 2; let z1 = ST_Z[j + 1] - ST_W / 2;
    if (z0 < RIVER.z0 && z1 > RIVER.z0) z1 = RIVER.z0 - 6;
    if (z0 < RIVER.z1 && z1 > RIVER.z1) z0 = RIVER.z1 + 6;
    if (z1 - z0 < 12) continue;
    blocks.push({ x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, i, j });
  }
  // the outer ring of streets also borders the world edge: add blocks beyond the outer avenues/streets
  const nearLine = (x, z, r, types) => { for (let s = 0; s < line.L; s += 4) { if (types && !types.includes(line.typeAt(s))) continue; const p = line.at(s).p; if ((p.x - x) ** 2 + (p.z - z) ** 2 < r * r) return true; } return false; };
  const rectNearLine = (b, pad, types) => { for (let s = 0; s < line.L; s += 3) { if (types && !types.includes(line.typeAt(s))) continue; const p = line.at(s).p; if (p.x > b.x0 - pad && p.x < b.x1 + pad && p.z > b.z0 - pad && p.z < b.z1 + pad) return true; } return false; };

  const lotRects = []; // where generic buildings go
  const reserved = new Map(); // block -> landmark id
  const blockAt = (x, z) => blocks.find((b) => x >= b.x0 - 1 && x <= b.x1 + 1 && z >= b.z0 - 1 && z <= b.z1 + 1);
  landmarks.forEach((lm) => { const b = blockAt(lm.x, lm.z); if (b) { reserved.set(b, lm); lm.block = b; } });

  blocks.forEach((b) => {
    const cutThrough = rectNearLine(b, 8, ['cut', 'embankment']);
    if (cutThrough) { b.corridor = true; return; } // rail corridor: left as green verge
    batch.box(b.x1 - b.x0, 0.16, b.z1 - b.z0, M.sidewalk, b.cx, 0.08, b.cz, 0, { cast: false });
    if (reserved.has(b)) return;
    const underViaduct = rectNearLine(b, 9, ['viaduct']);
    // split into lots along the long side
    const inset = 5;
    const X0 = b.x0 + inset; const X1 = b.x1 - inset; const Z0 = b.z0 + inset; const Z1 = b.z1 - inset;
    const longX = X1 - X0 > Z1 - Z0;
    const nLong = 2 + Math.floor(rng() * 3); const nShort = (longX ? Z1 - Z0 : X1 - X0) > 50 ? 2 : 1;
    for (let a = 0; a < nLong; a++) for (let c = 0; c < nShort; c++) {
      const la = (longX ? X1 - X0 : Z1 - Z0) / nLong; const lc = (longX ? Z1 - Z0 : X1 - X0) / nShort;
      const r = longX ? { x0: X0 + a * la, x1: X0 + (a + 1) * la, z0: Z0 + c * lc, z1: Z0 + (c + 1) * lc } : { x0: X0 + c * lc, x1: X0 + (c + 1) * lc, z0: Z0 + a * la, z1: Z0 + (a + 1) * la };
      const cx = (r.x0 + r.x1) / 2; const cz = (r.z0 + r.z1) / 2;
      if (underViaduct && nearLine(cx, cz, 16 + Math.max(r.x1 - r.x0, r.z1 - r.z0) / 2, ['viaduct'])) { r.garden = true; }
      lotRects.push({ ...r, block: b });
    }
  });

  /* generic buildings: one instanced box mesh with a window shader */
  const bld = [];
  const trees = [];
  const DOWNTOWN = STATION_DEFS[1];
  const MASONRY = [0xa0533f, 0x8f4a3a, 0xb0634c, 0xd8ccb6, 0xe2d8c4, 0xece8df, 0xc9c5bc];
  const CONCRETE = [0xc9c5bc, 0xb9b6ae, 0xdedad2];
  const GLASS = [0x8ea3b2, 0x9fb2bf, 0x7f95a6];
  lotRects.forEach((r) => {
    const w = r.x1 - r.x0 - 3; const d = r.z1 - r.z0 - 3;
    if (w < 8 || d < 8) return;
    if (r.garden) {
      batch.box(w, 0.1, d, M.grass, (r.x0 + r.x1) / 2, 0.21, (r.z0 + r.z1) / 2, 0, { cast: false });
      return;
    }
    const cx = (r.x0 + r.x1) / 2; const cz = (r.z0 + r.z1) / 2;
    const dd = Math.hypot(cx - DOWNTOWN.x, cz - DOWNTOWN.z);
    const tall = dd < 240 ? 1 - dd / 240 : 0;
    const floors = Math.round(3 + rng() * 6 + tall * (10 + rng() * 26));
    const h = floors * 3.2 + 1.2;
    // style 0 punched windows (brick, stone, concrete), 1 ribbon glazing (offices), 2 curtain wall (towers)
    const style = tall > 0.35 ? (rng() < 0.6 ? 2 : 1) : (rng() < 0.18 ? 1 : 0);
    const color = style === 2 ? GLASS[Math.floor(rng() * GLASS.length)] : style === 1 ? CONCRETE[Math.floor(rng() * CONCRETE.length)] : MASONRY[Math.floor(rng() * MASONRY.length)];
    bld.push({ x: cx, z: cz, w, d, h, y: 0.16, color, style, shop: rng() < 0.7 ? 1 : 0, seed: rng() });
    if (h > 50 && rng() < 0.7) bld.push({ x: cx, z: cz, w: w * 0.62, d: d * 0.62, h: 3.2 * Math.round(4 + rng() * 8) + 1.2, y: 0.16 + h, color, style, shop: 0, seed: rng() });
  });
  landmarks.forEach((lm) => { if (lm.block) buildLandmark(lm, { b: lm.block, batch, M, scene, anim, lineHex, atlas, addBuilding: (o) => bld.push({ shop: 0, seed: rng(), style: o.glassy ? 2 : 0, ...o }), addTree: (x, z, sc) => trees.push([x, z, sc]) }); });

  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const uni = { uTime: { value: 0 }, uDusk: { value: 0.6 }, uCut: { value: new THREE.Vector4(0, 0, 0, 0) }, uCamDir: { value: new THREE.Vector3(0, 1, 0) } };
  // cutaway: anything between the camera and the train is cut open so the train stays visible
  const CUT_DECL = 'uniform vec4 uCut; uniform vec3 uCamDir; varying vec3 vCutWP;';
  const CUT_TEST = `if (uCut.w > 0.0 && vCutWP.y > uCut.y + 1.0) { vec3 cd = vCutWP - uCut.xyz; float al = dot(cd, uCamDir); if (al > 4.0 && length(cd - uCamDir * al) < uCut.w) discard; }`;
  const withCut = (mat, extra, instanced = true) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uCut = uni.uCut; sh.uniforms.uCamDir = uni.uCamDir; sh.uniforms.uTime = uni.uTime; sh.uniforms.uDusk = uni.uDusk;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nvarying vec3 vCutWP;`).replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\nvCutWP = (modelMatrix * ${instanced ? 'instanceMatrix * ' : ''}vec4(transformed, 1.0)).xyz;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${CUT_DECL}`).replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${CUT_TEST}`);
      if (extra) extra(sh);
    };
    return mat;
  };
  const bMat = withCut(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0.02 }), (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec3 aInfo; // style, shopfront, seed
varying vec3 vLoc; varying vec3 vSize; varying vec3 vLN; varying vec3 vInfo;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vLoc = position; vLN = normal; vInfo = aInfo;
vSize = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uDusk;
varying vec3 vLoc; varying vec3 vSize; varying vec3 vLN; varying vec3 vInfo;
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
  float win = st < 0.5 ? step(0.24, lx) * step(lx, 0.76) * step(0.3, ly) * step(ly, 0.84)
            : st < 1.5 ? step(0.02, lx) * step(lx, 0.98) * step(0.34, ly) * step(ly, 0.8)
                       : step(0.05, lx) * step(lx, 0.95) * step(0.06, ly) * step(ly, 0.94);
  win *= rows;
  float shopCols = max(1.0, floor(faceW / 4.0)); float sx = fract(along * shopCols);
  float shop = vInfo.y * step(0.5, y) * step(y, 2.9) * step(0.06, sx) * step(sx, 0.94);
  // far away, the pattern resolves to its average colour instead of speckle
  float px = max(fwidth(u), fwidth(fy));
  float fade = smoothstep(0.3, 0.8, px);
  float cover = (st < 0.5 ? 0.27 : (st < 1.5 ? 0.44 : 0.8)) * rows;
  wMask = mix(max(win, shop), cover, fade);
  vec3 glassCol = st > 1.5 ? vec3(0.34, 0.43, 0.51) : vec3(0.2, 0.24, 0.29);
  diffuseColor.rgb = mix(diffuseColor.rgb, glassCol, wMask * (st > 1.5 ? 0.75 : 0.92));
  // a calm evening: a few windows lit, mostly on upper floors
  float hsh = h31(vec3(cu + (sideX ? 37.0 : 0.0), fl, vInfo.z * 91.0));
  float p = (0.04 + 0.14 * (fl / nFl)) * uDusk;
  wLit = win * (1.0 - fade) * step(hsh, p) + shop * 0.35 * (1.0 - fade);
  diffuseColor.rgb *= 1.0 - 0.12 * step(H - 1.2, y);
} else { diffuseColor.rgb *= 0.9; }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.14, wMask);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += wLit * vec3(1.0, 0.74, 0.45) * 0.9;`);
  });
  const mtx = new THREE.Matrix4(); const col = new THREE.Color();
  // one instanced mesh per 300 m tile, so the GPU can skip whatever is off-screen
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
    });
    return meshes;
  };
  tiled(boxGeo, bMat, bld, (b) => [b.x, b.z], (b, m, i, mesh) => {
    m.compose(new THREE.Vector3(b.x, b.y, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w, b.h, b.d));
    mesh.setColorAt(i, col.setHex(b.color));
  }, { perTileGeo: (list) => { const g = boxGeo.clone(); const info = new Float32Array(list.length * 3); list.forEach((b, i) => { info[i * 3] = b.style || 0; info[i * 3 + 1] = b.shop; info[i * 3 + 2] = b.seed; }); g.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 3)); return g; } });

  /* rooftops: parapet caps and rooftop units merged into one geometry per building type, water tanks */
  const roofs = []; const tanks = [];
  bld.forEach((b) => {
    if (b.noRoof) return;
    roofs.push(b);
    if (b.style === 0 && b.h < 40 && rng() < 0.4) tanks.push([b.x + (rng() - 0.5) * b.w * 0.5, b.y + b.h, b.z + (rng() - 0.5) * b.d * 0.5]);
  });
  // a cap is a parapet ring plus two rooftop units, in unit space (scaled per building)
  const capGeo = (() => {
    const parts = [];
    const add = (w, h, d, x, y, z, hex) => { const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y, z); const c = new THREE.Color(hex); const n = g.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.Float32BufferAttribute(a, 3)); parts.push(g); };
    add(1.02, 0.05, 1.02, 0, 0.025, 0, 0x9a968f); // a cornice cap
    add(0.24, 0.1, 0.18, -0.16, 0.08, -0.1, 0xd2cec8); // one rooftop unit
    return mergeGeometries(parts, false);
  })();
  const capPlain = (() => { const g = new THREE.BoxGeometry(1.02, 0.05, 1.02).toNonIndexed(); g.translate(0, 0.025, 0); const c = new THREE.Color(0x9a968f); const n = g.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.Float32BufferAttribute(a, 3)); return g; })();
  withCut(M.vc, null, false);
  roofs.forEach((b, i) => batch.add(i % 2 ? capPlain : capGeo, M.vc, new THREE.Matrix4().compose(new THREE.Vector3(b.x, b.y + b.h, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w, Math.min(b.w, b.d) * 0.22 + 4, b.d)), { cast: false }));
  const tankGeo = (() => {
    const mk = (g, hex) => { g = g.toNonIndexed(); const c = new THREE.Color(hex); const n = g.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.Float32BufferAttribute(a, 3)); return g; };
    const barrel = new THREE.CylinderGeometry(1.8, 1.8, 3.2, 10); barrel.translate(0, 3.4, 0);
    const roof = new THREE.ConeGeometry(2, 1.3, 10); roof.translate(0, 5.6, 0);
    const legs = new THREE.BoxGeometry(3.0, 1.8, 3.0); legs.translate(0, 0.9, 0);
    return mergeGeometries([mk(barrel, 0x8a6a4b), mk(roof, 0x2a2b2f), mk(legs, 0x6b6e73)], false);
  })();
  tanks.forEach((c) => batch.add(tankGeo, M.vc, new THREE.Matrix4().makeTranslation(c[0], c[1], c[2])));

  /* street furniture: lane markings, crosswalks, lamps, trees */
  const marks = []; const lamps = [];
  roadRects.forEach((r) => {
    const along = r.dir; const len = along === 'z' ? r.z1 - r.z0 : r.x1 - r.x0;
    for (let t = 6; t < len - 6; t += 9) {
      const x = along === 'z' ? (r.x0 + r.x1) / 2 : r.x0 + t; const z = along === 'z' ? r.z0 + t : (r.z0 + r.z1) / 2;
      const crossing = along === 'z' ? ST_Z.some((sz) => Math.abs(z - sz) < ST_W / 2 + 2) : AVE_X.some((ax) => Math.abs(x - ax) < AVE_W / 2 + 2);
      if (!crossing) marks.push([x, z, along === 'z' ? 0.18 : 3, along === 'z' ? 3 : 0.18]);
    }
  });
  // crosswalks at every intersection that exists
  AVE_X.forEach((x) => ST_Z.forEach((z) => {
    if (!onRoad(x, z) || !onRoad(x, z - ST_W / 2 - 3) && !onRoad(x, z + ST_W / 2 + 3)) return;
    [-1, 1].forEach((sg) => {
      if (onRoad(x, z + sg * (ST_W / 2 + 2.5))) for (let k = -4; k <= 4; k++) marks.push([x + k * 2, z + sg * (ST_W / 2 + 2.5), 1, 3.6]);
      if (onRoad(x + sg * (AVE_W / 2 + 2.5), z)) for (let k = -3; k <= 3; k++) marks.push([x + sg * (AVE_W / 2 + 2.5), z + k * 2, 3.6, 1]);
    });
  }));
  const markGeo = new THREE.PlaneGeometry(1, 1); markGeo.rotateX(-Math.PI / 2);
  marks.forEach((c) => batch.add(markGeo, M.white, new THREE.Matrix4().compose(new THREE.Vector3(c[0], 0.05, c[1]), new THREE.Quaternion(), new THREE.Vector3(c[2], 1, c[3])), { cast: false, receive: true }));
  blocks.forEach((b) => {
    if (b.corridor) return;
    const edges = [[b.x0 + 1.6, b.z0 + 1.6, b.x1 - 1.6, b.z0 + 1.6], [b.x0 + 1.6, b.z1 - 1.6, b.x1 - 1.6, b.z1 - 1.6], [b.x0 + 1.6, b.z0 + 1.6, b.x0 + 1.6, b.z1 - 1.6], [b.x1 - 1.6, b.z0 + 1.6, b.x1 - 1.6, b.z1 - 1.6]];
    edges.forEach(([ax, az, bx, bz], e) => {
      const len = Math.hypot(bx - ax, bz - az);
      for (let t = 8; t < len - 4; t += 13) {
        const x = ax + ((bx - ax) * t) / len; const z = az + ((bz - az) * t) / len;
        if (nearLine(x, z, 9, ['viaduct', 'embankment', 'cut'])) continue;
        if (Math.floor(t / 13) % 3 === 0) lamps.push([x, z, e]);
        else if (rng() < (isPhone ? 0.35 : 0.7)) trees.push([x, z, 0.8 + rng() * 0.5]);
      }
    });
  });
  const vcol = (g, hex) => { g = g.index ? g.toNonIndexed() : g; const c = new THREE.Color(hex); const n = g.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.Float32BufferAttribute(a, 3)); return g; };
  // street lamps: post and head in one geometry
  const lampGeo = (() => { const pole = new THREE.CylinderGeometry(0.09, 0.13, 7, 5, 1, true); pole.translate(0, 3.5, 0); const head = new THREE.BoxGeometry(0.5, 0.18, 1.3); head.translate(0, 7.05, 0.5); return mergeGeometries([vcol(pole, 0x2a2c30), vcol(head, 0xf3e3c0)], false); })();
  lamps.forEach((c) => batch.add(lampGeo, M.vc, new THREE.Matrix4().compose(new THREE.Vector3(c[0], 0.16, c[1]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), [Math.PI, 0, Math.PI / 2, -Math.PI / 2][c[2]]), new THREE.Vector3(1, 1, 1)), { cast: false }));
  // trees: trunk and crown in one geometry; the crown sways a little
  const treeGeo = (() => { const trunk = new THREE.CylinderGeometry(0.16, 0.24, 2.6, 5, 1, true); trunk.translate(0, 1.3, 0); const crown = new THREE.IcosahedronGeometry(2.5, 0); crown.scale(1, 1.15, 1); crown.translate(0, 4.4, 0); return mergeGeometries([vcol(trunk, 0x7a5c40), vcol(crown, 0x6f9152)], false); })();
  const treeMat = withCut(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }), (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
float sway = sin(uTime * 0.8 + ip.x * 0.05 + ip.z * 0.07) * 0.06 * max(0.0, position.y - 2.5);
transformed.x += sway; transformed.z += sway * 0.6;`);
  });
  const tint = [0xffffff, 0xe9f0dc, 0xd7e4c6, 0xf3f5e6];
  tiled(treeGeo, treeMat, trees, (c) => [c[0], c[1]], (c, m, i, mesh) => {
    m.compose(new THREE.Vector3(c[0], 0.16, c[1]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), c[0] * 0.37), new THREE.Vector3(c[2], c[2], c[2]));
    mesh.setColorAt(i, col.setHex(tint[i % 4]));
  });

  /* cars: slow traffic on the right-hand lane of each road segment */
  const lanes = roadRects.filter((r) => (r.dir === 'z' ? r.z1 - r.z0 : r.x1 - r.x0) > 120);
  const carCount = isPhone ? 40 : 90;
  const cars = [];
  for (let k = 0; k < carCount; k++) {
    const r = lanes[Math.floor(rng() * lanes.length)];
    const dirSign = rng() < 0.5 ? 1 : -1;
    const len = r.dir === 'z' ? r.z1 - r.z0 : r.x1 - r.x0;
    cars.push({ r, sign: dirSign, t: rng() * len, len, v: 6 + rng() * 4, color: [0xf1f1ee, 0x2c3e50, 0xb03a2e, 0x7f8c8d, 0x1f4e79, 0xd4ac0d, 0x222222, 0xe5e7e9][k % 8] });
  }
  const carBody = new THREE.BoxGeometry(1.85, 0.75, 4.4); carBody.translate(0, 0.65, 0);
  const carCabin = new THREE.BoxGeometry(1.6, 0.6, 2.2); carCabin.translate(0, 1.32, -0.2);
  const carMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.4 });
  const bodyMesh = new THREE.InstancedMesh(carBody, carMat, cars.length);
  const cabMesh = new THREE.InstancedMesh(carCabin, M.glass, cars.length);
  bodyMesh.castShadow = true; cabMesh.castShadow = false;
  cars.forEach((c, i) => bodyMesh.setColorAt(i, col.setHex(c.color)));
  scene.add(bodyMesh, cabMesh);
  const q = new THREE.Quaternion(); const up = new THREE.Vector3(0, 1, 0); const v3 = new THREE.Vector3(); const one = new THREE.Vector3(1, 1, 1);
  const placeCars = (dt) => {
    cars.forEach((c, i) => {
      c.t += c.v * dt; if (c.t > c.len - 4) c.t = 4;
      const r = c.r; const lane = (r.dir === 'z' ? AVE_W : ST_W) / 4;
      const along = c.sign > 0 ? c.t : c.len - c.t;
      if (r.dir === 'z') { v3.set((r.x0 + r.x1) / 2 + lane * c.sign * -1, ROAD_Y, r.z0 + along); q.setFromAxisAngle(up, c.sign > 0 ? 0 : Math.PI); }
      else { v3.set(r.x0 + along, ROAD_Y, (r.z0 + r.z1) / 2 + lane * c.sign); q.setFromAxisAngle(up, c.sign > 0 ? Math.PI / 2 : -Math.PI / 2); }
      mtx.compose(v3, q, one); bodyMesh.setMatrixAt(i, mtx); cabMesh.setMatrixAt(i, mtx);
    });
    bodyMesh.instanceMatrix.needsUpdate = true; cabMesh.instanceMatrix.needsUpdate = true;
  };
  placeCars(0);
  anim.push((t, dt) => { uni.uTime.value = t; placeCars(dt); });

  /* pedestrians: small walkers on the sidewalk ring of busy blocks */
  const walkers = [];
  const pedCount = isPhone ? 60 : 160;
  const busy = blocks.filter((b) => !b.corridor);
  for (let k = 0; k < pedCount; k++) {
    const b = busy[Math.floor(rng() * busy.length)];
    const per = 2 * (b.x1 - b.x0 + b.z1 - b.z0 - 6);
    walkers.push({ b, t: rng() * per, per, v: (rng() < 0.5 ? 1 : -1) * (0.9 + rng() * 0.6), color: [0x34495e, 0xc0392b, 0x16a085, 0xf39c12, 0x8e44ad, 0x2c3e50, 0xecf0f1][k % 7] });
  }
  const pedGeo = new THREE.CylinderGeometry(0.2, 0.26, 1.7, 5, 1); pedGeo.translate(0, 0.85, 0);
  const pedMesh = new THREE.InstancedMesh(pedGeo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), walkers.length);
  walkers.forEach((w, i) => pedMesh.setColorAt(i, col.setHex(w.color)));
  pedMesh.castShadow = false; scene.add(pedMesh);
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

  return { batch, anim, roadRects, onRoad, blocks, blockAt, uni };
}

/* ---------- the K Line: structures, track, stations ---------- */
export function buildRail({ scene, M, line, lineHex, onRoad, batch, doorS }) {
  const anim = [];
  const L = line.L;
  // 1) structure along the line by segment type
  const ranges = []; let cur = null;
  for (let s = 0; s <= line.endBuiltS + 200; s += 1) {
    const t = line.typeAt(s);
    if (!cur || cur.t !== t) { if (cur) cur.s1 = s; cur = { t, s0: s }; ranges.push(cur); }
  }
  cur.s1 = Math.min(L, line.endBuiltS + 200);
  const VIADUCT = [[-6.4, 1.0], [-6.05, 1.0], [-6.05, -0.75], [6.05, -0.75], [6.05, 1.0], [6.4, 1.0], [6.4, -1.3], [4.3, -2.7], [-4.3, -2.7], [-6.4, -1.3]];
  ranges.forEach((r) => {
    if (r.t === 'tunnel') return;
    const s0 = Math.max(r.s0, line.portalS - 2); const s1 = Math.min(r.s1, line.endBuiltS);
    if (s1 <= s0) return;
    if (r.t === 'viaduct') addStrips(batch, sweep(line, s0, s1, VIADUCT, { closed: true, step: 4 }), M.concrete);
    if (r.t === 'cut') {
      // trench floor, retaining walls up to street level, coping
      addStrips(batch, sweep(line, s0, s1, [[-6.6, -0.8], [6.6, -0.8]]), M.ballast, { cast: false });
      addStrips(batch, sweep(line, s0, s1, [[6.6, -0.8], [6.6, 0, 0.5], [7.0, 0, 0.5], [7.0, -0.8]]), M.concrete);
      addStrips(batch, sweep(line, s0, s1, [[-7.0, -0.8], [-7.0, 0, 0.5], [-6.6, 0, 0.5], [-6.6, -0.8]]), M.concrete);
    }
    if (r.t === 'embankment') {
      addStrips(batch, sweep(line, s0, s1, [[-6.4, 1.0], [-6.05, 1.0], [-6.05, -0.75], [6.05, -0.75], [6.05, 1.0], [6.4, 1.0], [6.4, 0, 0], [-6.4, 0, 0]], { closed: true }), M.concrete);
    }
  });
  // piers under the viaduct, kept off roads
  const pierGeo = new THREE.BoxGeometry(2.2, 1, 2.6); pierGeo.translate(0, 0.5, 0);
  const pierMat = M.concrete;
  for (let s = 0; s < line.endBuiltS + 180; s += 32) {
    if (line.typeAt(s) !== 'viaduct') continue;
    let ok = null;
    for (const d of [0, 6, -6, 11, -11]) { const p = line.at(s + d).p; if (!onRoad(p.x, p.z, 1.5)) { ok = s + d; break; } }
    if (ok === null) continue;
    const a = line.at(ok); const inRiver = a.p.z > RIVER.z0 && a.p.z < RIVER.z1;
    const yb = inRiver ? RIVER.water - 1 : 0; const top = a.p.y - 2.7;
    const ang = Math.atan2(a.t.x, a.t.z);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(a.p.x, yb, a.p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang), new THREE.Vector3(1, top - yb - 1.1, 1));
    batch.add(pierGeo, pierMat, m);
    const cap = new THREE.Matrix4().compose(new THREE.Vector3(a.p.x, top - 1.1, a.p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang), new THREE.Vector3(4.2, 1.1, 1.15));
    batch.add(pierGeo, pierMat, cap);
  }
  // the tunnel portal
  {
    const a = line.at(line.portalS); const ang = Math.atan2(a.t.x, a.t.z);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang);
    const put = (w, h, d, lat, y, along = 0, mat = M.concrete) => {
      const p = a.p.clone().add(a.n.clone().multiplyScalar(lat)).add(a.t.clone().multiplyScalar(along));
      batch.add(new THREE.BoxGeometry(w, h, d), mat, new THREE.Matrix4().compose(new THREE.Vector3(p.x, y, p.z), q, new THREE.Vector3(1, 1, 1)));
    };
    const ry = a.p.y;
    put(15.4, 1.6, 1.6, 0, 0.7, -0.6); // lintel at street level
    put(1.2, -ry + 1.4, 1.6, -7.0, (ry + 1.4) / 2 - 0.2, -0.6);
    put(1.2, -ry + 1.4, 1.6, 7.0, (ry + 1.4) / 2 - 0.2, -0.6);
    put(1.2, -ry + 1.4, 1.6, 0, (ry + 1.4) / 2 - 0.2, -0.6, M.concreteDark);
    put(13, 5.4, 0.4, 0, ry + 2.2, -2.2, M.ink); // the dark tunnel mouth
  }
  // 2) the two tracks: a trackbed textured with sleepers every 0.65 m, two rails, a third rail with a cover board
  const tb = document.createElement('canvas'); tb.width = 64; tb.height = 64; const tg = tb.getContext('2d');
  tg.fillStyle = '#8d877d'; tg.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 260; i++) { tg.fillStyle = Math.random() < 0.5 ? '#7d776e' : '#9c968c'; tg.fillRect(Math.random() * 64, Math.random() * 64, 2, 2); }
  tg.fillStyle = '#b9b4ab'; tg.fillRect(4, 22, 56, 20); tg.fillStyle = '#a29d94'; tg.fillRect(4, 38, 56, 4);
  const tbTex = new THREE.CanvasTexture(tb); tbTex.wrapS = THREE.ClampToEdgeWrapping; tbTex.wrapT = THREE.RepeatWrapping; tbTex.colorSpace = THREE.SRGBColorSpace; tbTex.anisotropy = 4;
  const trackbedMat = new THREE.MeshStandardMaterial({ map: tbTex, roughness: 1, side: THREE.DoubleSide });
  const tracks = [TRACK_OFF, -TRACK_OFF];
  tracks.forEach((c) => {
    const s0 = line.portalS - 30; const s1 = line.endBuiltS;
    addStrips(batch, sweep(line, s0, s1, [[c - 1.55, -0.18], [c + 1.55, -0.18]], { step: 3, vScale: 0.65 }), trackbedMat, { cast: false });
    addStrips(batch, sweep(line, s0, s1, [[c - 1.75, -0.5], [c - 1.55, -0.18]], { step: 6 }), M.ballast, { cast: false });
    addStrips(batch, sweep(line, s0, s1, [[c + 1.55, -0.18], [c + 1.75, -0.5]], { step: 6 }), M.ballast, { cast: false });
    [c - GAUGE / 2, c + GAUGE / 2].forEach((r) => addStrips(batch, sweep(line, s0, s1, [[r - 0.04, -0.17], [r - 0.035, 0], [r + 0.035, 0], [r + 0.04, -0.17]], { step: 4 }), M.railSteel, { cast: false }));
    const tr = c + Math.sign(c) * 1.55;
    addStrips(batch, sweep(line, s0, s1, [[tr - 0.05, -0.2], [tr - 0.05, 0.05], [tr + 0.05, 0.05]], { step: 6 }), M.steel, { cast: false });
    addStrips(batch, sweep(line, s0, s1, [[tr - 0.18, 0.12], [tr + 0.18, 0.12]], { step: 6 }), M.yellow, { cast: false });
  });
  const yAx = new THREE.Vector3(0, 1, 0);

  // 3) the unfinished line beyond Non-stop: piers waiting for a deck, a crane, barriers
  const unfinished = { s: line.endBuiltS };
  {
    const endA = line.at(line.endBuiltS);
    const q2 = new THREE.Quaternion().setFromAxisAngle(yAx, Math.atan2(endA.t.x, endA.t.z));
    [[-3.5], [3.5]].forEach(([lat]) => { const p = endA.p.clone().add(endA.n.clone().multiplyScalar(lat)).add(endA.t.clone().multiplyScalar(-3)); batch.add(new THREE.BoxGeometry(2.4, 1.2, 0.6), M.yellow, new THREE.Matrix4().compose(new THREE.Vector3(p.x, endA.p.y + 0.4, p.z), q2, new THREE.Vector3(1, 1, 1))); });
    for (let s = line.endBuiltS + 30; s < line.endBuiltS + 200; s += 32) {
      const a = line.at(s); const h = (a.p.y - 2.7) * Math.max(0.25, 1 - (s - line.endBuiltS) / 220);
      batch.add(pierGeo, M.concreteDark, new THREE.Matrix4().compose(new THREE.Vector3(a.p.x, 0, a.p.z), new THREE.Quaternion().setFromAxisAngle(yAx, Math.atan2(a.t.x, a.t.z)), new THREE.Vector3(1, h, 1)));
      for (let k = 0; k < 4; k++) batch.add(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 4), M.steel, new THREE.Matrix4().makeTranslation(a.p.x + (k - 1.5) * 0.4, h + 1.1, a.p.z));
    }
  }

  // 4) stations: island platform, canopy, platform screen doors, name boards, entrances
  const stationParts = [];
  line.stations.forEach((st, si) => {
    const s0 = st.s - 46; const s1 = st.s + 46;
    const underground = st.y < -6.2;
    addStrips(batch, sweep(line, s0, s1, [[-3.5, -0.75], [-3.5, 1.1], [3.5, 1.1], [3.5, -0.75]], { closed: true }), M.sidewalk);
    [-1, 1].forEach((sg) => addStrips(batch, sweep(line, s0, s1, [[sg * 2.9, 1.112], [sg * 3.2, 1.112]]), M.yellow, { cast: false }));
    if (!underground) {
      // canopy: a shallow curved roof on a central row of columns
      const roof = []; for (let k = 0; k <= 8; k++) { const lat = -3.7 + (7.4 * k) / 8; roof.push([lat, 4.9 + 0.45 * Math.cos(((k / 8) - 0.5) * Math.PI)]); }
      addStrips(batch, sweep(line, s0 - 2, s1 + 2, roof), M.white);
      for (let s = s0; s <= s1; s += 11.5) { const a = line.at(s); batch.add(new THREE.CylinderGeometry(0.16, 0.16, 3.9, 8), M.ink, new THREE.Matrix4().makeTranslation(a.p.x, a.p.y + 1.1 + 1.95, a.p.z)); }
    }
    // platform screen doors: glass on both edges, a line-colour header, frames between door sets
    [-1, 1].forEach((sg) => {
      if (sg === Math.sign(TRAIN_LAT) && doorS) {
        // glass panels between the door openings on the side the train uses
        const gaps = doorS(st).sort((x, y) => x - y); let from = s0 + 1;
        gaps.forEach((g) => { if (g - 0.75 > from + 0.2) addStrips(batch, sweep(line, from, g - 0.75, [[sg * 3.38, 1.1], [sg * 3.38, 3.3]], { step: 1 }), M.glassClear, { cast: false }); from = g + 0.75; });
        if (s1 - 1 > from + 0.2) addStrips(batch, sweep(line, from, s1 - 1, [[sg * 3.38, 1.1], [sg * 3.38, 3.3]], { step: 1 }), M.glassClear, { cast: false });
      } else addStrips(batch, sweep(line, s0 + 1, s1 - 1, [[sg * 3.38, 1.1], [sg * 3.38, 3.3]]), M.glassClear, { cast: false });
      addStrips(batch, sweep(line, s0 + 1, s1 - 1, [[sg * 3.3, 3.3], [sg * 3.3, 3.7], [sg * 3.46, 3.7], [sg * 3.46, 3.3]], { closed: true }), M.line);
      for (let s = s0 + 1; s <= s1 - 1; s += 2.5) { const p = line.trackPoint(s, sg * 3.38, 1.1 + 1.1); batch.add(new THREE.BoxGeometry(0.12, 2.2, 0.12), M.steel, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)); }
    });
    stationParts.push({ st, underground });
    // street entrances for underground stations (and a stair tower for raised ones)
    if (underground || st.y > 4) {
      const a = line.at(st.s);
      const spots = underground ? [[-36, 14], [36, -14]] : [[0, 12]];
      spots.forEach(([along, lat]) => {
        const p = a.p.clone().add(a.t.clone().multiplyScalar(along)).add(a.n.clone().multiplyScalar(lat));
        let px = p.x; let pz = p.z;
        const ang = Math.atan2(a.t.x, a.t.z); const qq = new THREE.Quaternion().setFromAxisAngle(yAx, ang);
        if (underground) {
          batch.add(new THREE.BoxGeometry(3.6, 1.1, 7.5), M.concrete, new THREE.Matrix4().compose(new THREE.Vector3(px, 0.6, pz), qq, new THREE.Vector3(1, 1, 1)));
          batch.add(new THREE.BoxGeometry(3.9, 0.12, 7.8), M.glassClear, new THREE.Matrix4().compose(new THREE.Vector3(px, 3.1, pz), qq, new THREE.Vector3(1, 1, 1)), { cast: false });
          [[-1.8, -3.7], [1.8, -3.7], [-1.8, 3.7], [1.8, 3.7]].forEach(([dx, dz]) => { const o = new THREE.Vector3(dx, 0, dz).applyQuaternion(qq); batch.add(new THREE.BoxGeometry(0.12, 2.5, 0.12), M.steel, new THREE.Matrix4().makeTranslation(px + o.x, 1.85, pz + o.z)); });
        } else {
          const h = a.p.y + 1.1;
          batch.add(new THREE.BoxGeometry(5, h, 7), M.white, new THREE.Matrix4().compose(new THREE.Vector3(px, h / 2, pz), qq, new THREE.Vector3(1, 1, 1)));
          batch.add(new THREE.BoxGeometry(5.3, 0.5, 7.3), M.line, new THREE.Matrix4().compose(new THREE.Vector3(px, h + 0.25, pz), qq, new THREE.Vector3(1, 1, 1)), { cast: false });
        }
        // the metro totem: a pole with a "K" disc
        const o = new THREE.Vector3(2.6, 0, -3.4).applyQuaternion(qq);
        batch.add(new THREE.CylinderGeometry(0.1, 0.1, 4.2, 8), M.ink, new THREE.Matrix4().makeTranslation(px + o.x, 2.1, pz + o.z));
        stationParts[stationParts.length - 1].totems = (stationParts[stationParts.length - 1].totems || []).concat([[px + o.x, 4.6, pz + o.z, ang]]);
      });
    }
  });
  return { anim, stationParts, unfinished };
}
