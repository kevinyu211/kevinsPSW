/* Kevin Yu · the island city · THE TOWN PLAN.
   Where everything stands: the island's shape, the flying metro lanes, the roads and paths, the zones, the
   plots, and the exact spot of every building, house, tree and prop. Pure data and maths: no three.js, no DOM.
   The same input always gives the same plan (every random choice is seeded).

   Read `PLAN.md` for the thinking. Run `node designs/city/plan-check.mjs` to prove the plan is sound.
   Open `plan-map.html` to see it from above.

   ---------------------------------------------------------------------------------------------------------
   CONVENTIONS (the scene must follow these)
   - World axes: X = east, Y = up, Z = south. Metres. A point on the ground is [x, z].
   - `rot` is in radians about Y, exactly what three.js wants: `object.rotation.y = rot`.
     A model's front (its +Z, where the door is) then points along (sin rot, cos rot) in (x, z), and its +X
     points along (cos rot, -sin rot). rot = 0 faces south, towards the default camera.
   - A local point (lx, lz) of a model placed at (x, z) with `rot` and `scale` lands at
       x + scale * (lx * cos rot + lz * sin rot),   z + scale * (-lx * sin rot + lz * cos rot).
   - Every polyline is a list of [x, z]. Roads and paths that meet share an EXACT point (to the centimetre),
     so a graph can be built by matching coordinates.
   - Heights: the flat land is `PLAN.plateau` above the sea (y = 0). `height(x, z)` is the ground everywhere.
     The metro lanes fly `plan.metro.height` above the flat land (y = plateau + height).
   --------------------------------------------------------------------------------------------------------- */

/* ============================================ the numbers ============================================ */
export const PLAN = {
  scale: 0.9,          // ONE factor on every project building's footprint. At 0.9 today's large buildings are 56 to 67 m
                       // wide, 9 to 11% of the island's 600 m, and every plot still fits its building's largest level.
                       // At 1 the plots no longer fit between the towns (see PLAN.md, "Size").
  plateau: 3.2,        // the flat land above the sea
  island: { rx: 288, rz: 210, power: 3 },     // a rounded-rectangle island: 600 m wide with the headland and the cargo quay, 420 m deep
  hill: { x: 24, z: 6, a: 72, b: 62, ta: 44, tb: 38, h: 24 },   // the green hill: foot ellipse a × b, flat top ellipse ta × tb, h above the flat land
  shore: 12,           // the natural shore slopes down to the sea over this many metres
  metro: { height: 10, gauge: 4.2, radius: 84, straight: 70, corridor: 6.5 },   // lanes 10 m up, 4.2 m apart; nothing tall within `corridor` m
  road: { coast: 8, main: 7, street: 6, lane: 4.5, hill: 6 },
  path: { footpath: 2.4, promenade: 4, boardwalk: 4.5, steps: 3 },
  coastRoad: { sea: 18, harbour: -28, beach: -18 },   // the coast road runs 18 m seaward of the lanes; it passes inland behind the Harbour and the Beach stations
  promenade: { shore: 8, keep: 40, beach: 66.5 },   // the promenade: 8 m in from the water, never more than `keep` m from the lanes; the boardwalk runs `beach` m from them
  setback: 2,          // a building at its largest level stays this far inside its plot
};

/* The towns, clockwise from the main station. Names, codes and districts are defaults: `buildPlan` takes them
   from the data file when it has them (TOWNS / DISTRICTS), and always groups projects by district. */
const TOWN_DEFAULTS = [
  { id: 'harbour', code: 'K1', name: 'Harbour town', district: 'software', main: true },
  { id: 'garden', code: 'K2', name: 'Garden village', district: 'books' },
  { id: 'north', code: 'K3', name: 'North shore', district: 'film' },
  { id: 'point', code: 'K4', name: 'Lighthouse point', district: 'health' },
  { id: 'beach', code: 'K5', name: 'Beach town', district: 'games' },
];

/* ============================================ small geometry ============================================ */
const R2 = (n) => Math.round(n * 100) / 100;
const P = (x, z) => [R2(x), R2(z)];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const len = (a) => Math.hypot(a[0], a[1]);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const right = (d) => [-d[1], d[0]];           // the right-hand side of a traveller going along d (seen from above, Z south)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };
const key = (p) => `${R2(p[0]).toFixed(2)},${R2(p[1]).toFixed(2)}`;

/** A small seeded random number generator (mulberry32). */
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function distToSeg(p, a, b) {
  const ab = sub(b, a); const l2 = dot(ab, ab) || 1e-9; const t = clamp(dot(sub(p, a), ab) / l2, 0, 1);
  return dist(p, [a[0] + ab[0] * t, a[1] + ab[1] * t]);
}
/** Distance from a point to a polyline (closed = also the edge back to the start). */
export function distToLine(p, line, closed = false) {
  let d = Infinity; const n = line.length;
  for (let i = 0; i < n - (closed ? 0 : 1); i++) d = Math.min(d, distToSeg(p, line[i], line[(i + 1) % n]));
  return d;
}
function segsCross(a, b, c, d) {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
function segSegDist(a, b, c, d) { if (segsCross(a, b, c, d)) return 0; return Math.min(distToSeg(a, c, d), distToSeg(b, c, d), distToSeg(c, a, b), distToSeg(d, a, b)); }
/** Gap between two simple polygons: 0 when they touch or overlap. */
export function polyGap(A, B) {
  if (pointInPoly(A[0], B) || pointInPoly(B[0], A)) return 0;
  let g = Infinity;
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) { g = Math.min(g, segSegDist(A[i], A[(i + 1) % A.length], B[j], B[(j + 1) % B.length])); if (g === 0) return 0; }
  return g;
}
/** Gap between a polygon and a polyline of a given half-width (a road or a path): 0 or less means it sits on it. */
export function polyLineGap(poly, line, half = 0) {
  let g = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    if (pointInPoly(line[i], poly)) return -half;
    for (let j = 0; j < poly.length; j++) { g = Math.min(g, segSegDist(line[i], line[i + 1], poly[j], poly[(j + 1) % poly.length])); }
  }
  if (pointInPoly(line[line.length - 1], poly)) return -half;
  return g - half;
}
function bbox(poly) { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const p of poly) { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); } return [a, b, c, d]; }
function lineLength(line) { let l = 0; for (let i = 1; i < line.length; i++) l += dist(line[i - 1], line[i]); return l; }
/** The point `s` metres along a polyline, and the direction there. */
function along(line, s) {
  let acc = 0;
  for (let i = 1; i < line.length; i++) { const l = dist(line[i - 1], line[i]); if (acc + l >= s || i === line.length - 1) { const t = l ? clamp((s - acc) / l, 0, 1) : 0; return { p: lerp(line[i - 1], line[i], t), d: unit(sub(line[i], line[i - 1])) }; } acc += l; }
  return { p: line[0], d: [1, 0] };
}
/** Project a point onto a polyline: nearest point, its segment and distance. */
function project(line, p) {
  let best = { d: Infinity, i: 0, q: line[0] };
  for (let i = 0; i < line.length - 1; i++) { const a = line[i], b = line[i + 1]; const ab = sub(b, a); const t = clamp(dot(sub(p, a), ab) / (dot(ab, ab) || 1e-9), 0, 1); const q = [a[0] + ab[0] * t, a[1] + ab[1] * t]; const d = dist(p, q); if (d < best.d) best = { d, i, q, t }; }
  return best;
}
/** A rectangle given by its centre, size, and the direction of its local +Z (its front). Returns 4 corners. */
function rectPoly(c, w, d, front) { const f = unit(front); const x = [f[1], -f[0]]; const hw = w / 2, hd = d / 2; return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([a, b]) => P(c[0] + x[0] * a + f[0] * b, c[1] + x[1] * a + f[1] * b)); }
const rotOf = (front) => Math.atan2(front[0], front[1]);        // rot whose front points along `front`
const frontOf = (rot) => [Math.sin(rot), Math.cos(rot)];
/** Model space to the world. */
export function toWorld(pl, lx, lz) { const c = Math.cos(pl.rot), s = Math.sin(pl.rot), k = pl.scale || 1; return [pl.x + k * (lx * c + lz * s), pl.z + k * (-lx * s + lz * c)]; }
/** The ground footprint of a placement as a polygon, from the model's min and max in the manifest. */
export function footprint(pl, def) {
  const b = groundBox(def);
  return [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]].map(([x, z]) => P(...toWorld(pl, x, z)));
}
/** [minX, minZ, maxX, maxZ] of what a model covers on the ground. A building site's crane jib swings high in the
    air, so for a site model (class "level" with a crane) the box stops at the fence: it is mirrored from its short side. */
const isSite = (def) => def.class === 'level' && Math.abs(Math.abs(def.min[0]) - Math.abs(def.max[0])) > 4;
export function groundBox(def) {
  if (def.lamp) return [-0.4, -0.4, 0.4, 0.4];                    // a street lamp stands on its pole; its arm hangs over the road
  const mn = def.min, mx = def.max; let x0 = mn[0], x1 = mx[0]; const z0 = mn[2], z1 = mx[2];
  if (isSite(def)) { const h = Math.min(Math.abs(x0), Math.abs(x1)); x0 = -h; x1 = h; }
  return [x0, z0, x1, z1];
}

/* ============================================ the island ============================================ */
const I = PLAN.island, H = PLAN.hill, M = PLAN.metro;

/* ---- the metro loop: an octagon with rounded corners. Stations stand on its straight sides. ---- */
/* Sharp corners, clockwise seen from above (east, south, west, north): the way the clockwise trains run. */
const LOOP_CORNERS = [
  [256, -94],    // 0 north end of the east side                     side 0: EAST (K4 Lighthouse point)
  [256, 56],     // 1                                                side 1: SOUTH-EAST (K5 Beach town)
  [146, 166],    // 2                                                side 2: SOUTH (the meadow kept for town six)
  [-94, 166],    // 3                                                side 3: SOUTH-WEST (K1 Harbour town)
  [-256, 4],     // 4                                                side 4: west (a bend only)
  [-256, -66],   // 5                                                side 5: NORTH-WEST (K2 Garden village)
  [-156, -166],  // 6                                                side 6: NORTH (K3 North shore)
  [184, -166],   // 7                                                side 7: north-east (a bend only)
];
/* Where each station stands: which side, and how far along its straight part (0 to 1). */
const STATION_AT = { harbour: { side: 3, t: 0.42 }, garden: { side: 5, t: 0.5 }, north: { side: 6, t: 0.507 }, point: { side: 0, t: 0.44 }, beach: { side: 1, t: 0.5 } };
const NEXT_TOWN_AT = { side: 2, t: 0.3 };

function buildLoop() {
  const n = LOOP_CORNERS.length, R = M.radius; const sides = [], pts = [], tan = [];
  const corner = LOOP_CORNERS.map((v, i) => {
    const a = LOOP_CORNERS[(i + n - 1) % n], b = LOOP_CORNERS[(i + 1) % n];
    const din = unit(sub(v, a)), dout = unit(sub(b, v)); const turn = Math.acos(clamp(dot(din, dout), -1, 1)); const t = R * Math.tan(turn / 2);
    const p0 = sub(v, mul(din, t)), p1 = add(v, mul(dout, t)); const c = add(p0, mul(right(din), R));
    return { turn, p0, p1, c, dout };
  });
  for (let i = 0; i < n; i++) {
    const A = corner[i], B = corner[(i + 1) % n];
    const a0 = Math.atan2(A.p0[1] - A.c[1], A.p0[0] - A.c[0]); const steps = Math.max(2, Math.round((A.turn * R) / 2));
    for (let k = 0; k < steps; k++) { const ang = a0 + A.turn * (k / steps); pts.push([A.c[0] + R * Math.cos(ang), A.c[1] + R * Math.sin(ang)]); tan.push([-Math.sin(ang), Math.cos(ang)]); }
    const L = dist(A.p1, B.p0); if (dot(sub(B.p0, A.p1), A.dout) < -1e-6) throw new Error(`plan: loop side ${i} is too short for its two bends`);
    sides.push({ from: A.p1, to: B.p0, dir: A.dout, length: L, start: pts.length });
    const m = Math.max(1, Math.round(L / 2)); for (let k = 0; k < m; k++) { pts.push(lerp(A.p1, B.p0, k / m)); tan.push(A.dout); }
  }
  const s = [0]; for (let i = 1; i <= pts.length; i++) s.push(s[i - 1] + dist(pts[i - 1], pts[i % pts.length]));
  return { pts, tan, sides, s, length: s[pts.length] };
}
const LOOP = buildLoop();
const wrapS = (s) => ((s % LOOP.length) + LOOP.length) % LOOP.length;
/** The loop centreline `s` metres round from its start: the point and the way clockwise trains head. */
function loopAt(s) {
  s = wrapS(s); let lo = 0, hi = LOOP.pts.length; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (LOOP.s[mid] <= s) lo = mid; else hi = mid; }
  const j = (lo + 1) % LOOP.pts.length; const t = (s - LOOP.s[lo]) / ((LOOP.s[lo + 1] - LOOP.s[lo]) || 1);
  return { p: lerp(LOOP.pts[lo], LOOP.pts[j], t), t: unit(lerp(LOOP.tan[lo], LOOP.tan[j], t)) };
}
/** A line beside the loop from s0 to s1 (s1 > s0), `d` metres to seaward (negative = inland); d may be a function of s. */
function besideLoop(s0, s1, d, step = 2) {
  const out = []; const n = Math.max(1, Math.ceil((s1 - s0) / step));
  for (let k = 0; k <= n; k++) { const s = s0 + ((s1 - s0) * k) / n; const q = loopAt(s); const off = typeof d === 'function' ? d(wrapS(s)) : d; out.push(P(...sub(q.p, mul(right(q.t), off)))); }
  return out;
}
/** A station's frame: origin on the loop centreline, u = the way clockwise trains run, v = inland (to their right). */
function frameAt(side, t) {
  const S = LOOP.sides[side]; const o = lerp(S.from, S.to, t); const u = S.dir; const v = right(u);
  const L = (a, b) => [o[0] + u[0] * a + v[0] * b, o[1] + u[1] * a + v[1] * b];
  const inv = (p) => { const d = sub(p, o); return [dot(d, u), dot(d, v)]; };
  return { o, u, v, L, inv, side, room: [S.length * t, S.length * (1 - t)], s: LOOP.s[S.start] + S.length * t };
}
/** The same kind of frame anywhere on the loop, `s` metres round it: for plots that follow a bend. */
function frameAtS(s) { const q = loopAt(s); const o = q.p, u = q.t, v = right(u); return { o, u, v, L: (a, b) => [o[0] + u[0] * a + v[0] * b, o[1] + u[1] * a + v[1] * b], inv: (p) => { const d = sub(p, o); return [dot(d, u), dot(d, v)]; }, s }; }
const FRAMES = Object.fromEntries(Object.entries(STATION_AT).map(([id, a]) => [id, frameAt(a.side, a.t)]));
FRAMES.next = frameAt(NEXT_TOWN_AT.side, NEXT_TOWN_AT.t);

/* ---- the coast: a rounded rectangle with a headland in the east, a shallow beach bay in the south-east,
        and the Harbour cut into the south-west as straight quays. ---- */
const HB = FRAMES.harbour;                      // harbour frame: u runs north-west along the lanes, -v is out to sea
const HQ = (u, w) => HB.L(u, -w);               // a harbour point: u along the quay, w metres seaward of the lanes
/* The Harbour's waterline from the south-east to the north-west (u rising), as [u, w]: the fishers' quay, the
   ferry pier, the head quay in front of the main station, then the long cargo quay that closes the bay.
   The first w is set on the natural shore. */
const HARBOUR_QUAY = [[-108, null], [-101, 54], [-40, 54], [-40, 78], [-12, 78], [-12, 54], [40, 54], [40, 64], [124, 64], [124, null]];
const BEACH_ANGLE = [0.3, 0.97];               // the beach: this stretch of shore, as an angle from east towards south (radians)

/* Two corners of the island are pushed out to make room on the waterfront: [metres, angle of the middle, half-width of
   the full push, half-width where it fades out] (angles in radians from east, clockwise seen from above). */
const CAPE = { garden: [30, -2.56, 0.11, 0.26], beach: [29, 0.58, 0.18, 0.31] };
function naturalCoast() {
  const out = []; const N = 440; const e = 2 / I.power;
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2; const c = Math.cos(a), s = Math.sin(a);
    const x = I.rx * Math.sign(c) * Math.abs(c) ** e, z = I.rz * Math.sign(s) * Math.abs(s) ** e;
    const ang = Math.atan2(z, x); const r = Math.hypot(x, z);
    const bump = (at, wide) => { const d = Math.atan2(Math.sin(ang - at), Math.cos(ang - at)); return Math.exp(-((d / wide) ** 2)); };
    const cape = ([m, at, full, fade]) => { const d = Math.abs(Math.atan2(Math.sin(ang - at), Math.cos(ang - at))); return (m / r) * (1 - smooth((d - full) / (fade - full))); };
    const k2 = 1 + (14 / r) * bump(-0.1, 0.15) + cape(CAPE.garden) + cape(CAPE.beach);                 // the headland, the Garden cape, the beach
    out.push([x * k2, z * k2]);
  }
  return out;
}
function buildCoast() {
  const nat = naturalCoast(); const n = nat.length;
  const shoreW = (u) => { let w = 0; while (w < 220 && pointInPoly(HQ(u, w + 0.5), nat)) w += 0.5; return w; };          // where a quay end meets the natural shore
  const q = HARBOUR_QUAY.map(([u, w]) => HQ(u, w == null ? shoreW(u) : w)); const u0 = HARBOUR_QUAY[0][0], u1 = HARBOUR_QUAY[HARBOUR_QUAY.length - 1][0];
  const nearest = (p) => { let b = 0, bd = Infinity; nat.forEach((c, i) => { const d = dist(c, p); if (d < bd) { bd = d; b = i; } }); return b; };
  let i0 = nearest(q[0]), i1 = nearest(q[q.length - 1]);
  while (HB.inv(nat[i0])[0] > u0 - 2) i0 = (i0 + n - 1) % n;                                           // step off so the shore meets each end cleanly
  while (HB.inv(nat[i1])[0] < u1 + 2) i1 = (i1 + 1) % n;
  const pts = [], hard = [];
  for (let k = i1; k !== (i0 + 1) % n; k = (k + 1) % n) { pts.push(P(...nat[k])); hard.push(false); }
  const natural = pts.length;
  q.forEach((p) => { pts.push(P(...p)); hard.push(true); });
  hard[hard.length - 1] = false;                                                                      // from the quay's end back to the rocks
  return { pts, hard, natural, w0: shoreW(u0) };
}
const COAST = buildCoast();
/** The shoreline: a closed polygon, clockwise seen from above. */
export const coast = COAST.pts;
/** The straight Harbour quays (a wall down to the water) as a polyline. */
export const quay = COAST.pts.slice(COAST.natural);

/* A grid of distances to the shore, built once on first use: positive on land, negative at sea. `soft` is the
   distance to the natural shore only (the land slopes down to it); the quays are a wall. */
const GRID = { x0: -340, z0: -270, step: 2, nx: 341, nz: 271, d: null, soft: null };
function buildGrid() {
  const { nx, nz, step, x0, z0 } = GRID; const d = new Float32Array(nx * nz), soft = new Float32Array(nx * nz); const n = coast.length;
  const segs = coast.map((a, i) => { const b = coast[(i + 1) % n]; return [a[0], a[1], b[0] - a[0], b[1] - a[1], (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 || 1e-9, COAST.hard[i]]; });
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * step, z = z0 + j * step; let dAll = 1e12, dSoft = 1e12;
    for (let k = 0; k < n; k++) { const s = segs[k]; let t = ((x - s[0]) * s[2] + (z - s[1]) * s[3]) / s[4]; t = t < 0 ? 0 : t > 1 ? 1 : t; const dx = x - s[0] - s[2] * t, dz = z - s[1] - s[3] * t; const dd = dx * dx + dz * dz; if (dd < dAll) dAll = dd; if (!s[5] && dd < dSoft) dSoft = dd; }
    d[j * nx + i] = (pointInPoly([x, z], coast) ? 1 : -1) * Math.sqrt(dAll); soft[j * nx + i] = Math.sqrt(dSoft);
  }
  GRID.d = d; GRID.soft = soft;
}
function sample(arr, x, z) {
  const { nx, nz, step, x0, z0 } = GRID; const fx = clamp((x - x0) / step, 0, nx - 1.001), fz = clamp((z - z0) / step, 0, nz - 1.001); const i = Math.floor(fx), j = Math.floor(fz), a = fx - i, b = fz - j;
  return arr[j * nx + i] * (1 - a) * (1 - b) + arr[j * nx + i + 1] * a * (1 - b) + arr[(j + 1) * nx + i] * (1 - a) * b + arr[(j + 1) * nx + i + 1] * a * b;
}
/* The same kind of grid for the distance to the metro loop's centreline, so scattering trees is quick. */
const LANE_GRID = { x0: -340, z0: -270, step: 4, nx: 171, nz: 136, d: null };
function laneDistance(p) {
  const G = LANE_GRID; const closed = [...LOOP.pts, LOOP.pts[0]];
  if (!G.d) { G.d = new Float32Array(G.nx * G.nz); for (let j = 0; j < G.nz; j++) for (let i = 0; i < G.nx; i++) G.d[j * G.nx + i] = distToLine([G.x0 + i * G.step, G.z0 + j * G.step], closed); }
  const i = clamp(Math.round((p[0] - G.x0) / G.step), 0, G.nx - 1), j = clamp(Math.round((p[1] - G.z0) / G.step), 0, G.nz - 1); const rough = G.d[j * G.nx + i];
  return rough > 16 ? rough - 3 : distToLine(p, closed);                 // exact only near the lanes
}
/** Metres to the shoreline: positive on land, negative at sea (smooth, from the grid; exact tests use `coast`). */
export function shoreDistance(x, z) { if (!GRID.d) buildGrid(); return sample(GRID.d, x, z); }
/** Metres to the natural (sloping) shore, ignoring the quays. */
export function softShoreDistance(x, z) { if (!GRID.d) buildGrid(); return sample(GRID.soft, x, z); }
/** 0 at the foot of the hill and beyond, 1 on its flat top. */
export function hillAmount(x, z) {
  const q1 = Math.hypot((x - H.x) / H.a, (z - H.z) / H.b); if (q1 >= 1) return 0;
  const q0 = Math.hypot((x - H.x) / H.ta, (z - H.z) / H.tb); if (q0 <= 1) return 1;
  const t = (1 - q1) / (1 - q1 + (q0 - 1)); return 0.6 * t + 0.4 * smooth(t);
}
export const hillHeight = (x, z) => H.h * hillAmount(x, z);
/** Ground height in metres above the sea (y). Below 0 is the sea bed. The flat land is PLAN.plateau. */
export function height(x, z) {
  const d = shoreDistance(x, z);
  if (d <= 0) return -Math.min(8, 0.5 - d * 0.4);
  const wall = smooth(d / 1.2);                                         // a quay drops to the water in about a metre
  const slope = smooth(sample(GRID.soft, x, z) / PLAN.shore);           // the natural shore slopes over `shore` metres
  return PLAN.plateau * Math.min(wall, slope) + hillHeight(x, z);
}
/** True where a building may stand: flat land, off the hill, back from the sloping shore (quay edges are fine). */
export function buildable(x, z, margin = 0) {
  if (!pointInPoly([x, z], coast)) return false;
  if (softShoreDistance(x, z) < PLAN.shore + margin) return false;
  return Math.hypot((x - H.x) / (H.a + margin), (z - H.z) / (H.b + margin)) >= 1;
}

/* ============================================ the town layouts ============================================ */
/* Every town is drawn in its station's own frame: u runs along the lanes (the way clockwise trains head),
   v runs inland (negative v is towards the sea). A plot is `rect` [u0, u1, v0, v1] with `face` '+u' '-u' '+v' '-v'
   for its front; or, for the plots along East Hill Street, `world` [x0, x1, z0, z1] with `face` 'N' 'S' 'E' 'W'.
   A street is a line of [u, v] (or world [x, z] with `world: true`); `from` / `to` name the road it is cut back to.
   `assign` gives today's projects their plots; `reserve` lists the empty plots a new project takes, in order.
   Nothing here depends on the data file, so adding a project never moves anything that already stands. */
const LAYOUT = {
  /* K1 Harbour town: the main station faces the bay, the port fills the quays, the coast road passes behind
     as Harbour Road, and downtown is a grid of blocks inland of it. */
  harbour: {
    faceSea: true,
    streets: [
      { id: 'pier-w', kind: 'lane', name: 'West Pier Lane', pts: [[37, 28], [37, -2.4]] },
      { id: 'pier-e', kind: 'lane', name: 'East Pier Lane', pts: [[-37, 28], [-37, -2.4]] },
      { id: 'east', kind: 'main', name: 'Tower Avenue', pts: [[-89, 0], [-89, 101]], from: 'coast' },
      { id: 'west', kind: 'main', name: 'West Street', pts: [[67, 0], [67, 175.2]], from: 'coast' },
      { id: 'mid', kind: 'street', name: 'Mid Street', pts: [[-89, 101], [67, 101]] },
      { id: 'park', kind: 'street', name: 'Park Street', pts: [[-7, 101], [-7, 158]] },
      { id: 'uptown', kind: 'street', name: 'Uptown Street', pts: [[-7, 158], [67, 158]] },
    ],
    plots: [
      { slot: 'quay', rect: [42, 116, -64, -6], face: '+v', use: 'port', quay: true },   // the cargo quay (the warehouse and its piers)
      { slot: 'A', rect: [-8, 62, 38, 94], face: '-v' },
      { slot: 'B', rect: [-84, -12, 38, 96], face: '-v' },
      { slot: 'C', rect: [-2, 62, 105.5, 153.5], face: '-v' },
      { slot: 'D', rect: [-92, -46, -44, -8], face: '+v', use: 'port' },                 // on the fishers' quay
      { slot: 'R1', rect: [-136, -94, 50, 108], face: '+u' },                            // across Tower Avenue, by the south meadow
    ],
    assign: { trade: 'quay', hirvo: 'A', court: 'B', uhome: 'C', pindou: 'D' },
    reserve: ['R1'],
  },
  /* K2 Garden village: the print works behind the square, the bookshop across the coast road on the cape, the
     studio up Second Street. Its two streets run inland to the Harbour's West Street. */
  garden: {
    square: [-25, 49, 19.5, 37],
    streets: [
      { id: 'rung-a', kind: 'main', name: 'First Street', pts: [[-30, -40], [-30, 125]], from: 'coast', to: 'harbour-west' },
      { id: 'rung-b', kind: 'main', name: 'Second Street', pts: [[55, -40], [55, 109]], from: 'coast', toEnd: 'harbour-west' },
    ],
    walk: [[-30, 38.2], [55, 38.2]],
    capeWalks: [-33, 33],
    plots: [
      { slot: 'A', rect: [-22, 50, 39.7, 89.7], face: '-v' },
      { slot: 'B', rect: [-28, 28, -66, -24], face: '+v' },
      { slot: 'C', rect: [60, 102, 46, 104], face: '-u' },
      { slot: 'R1', rect: [-76.5, -34.5, 30, 88], face: '+u' },
    ],
    assign: { bookflow: 'A', books: 'B', ipad: 'C' }, reserve: ['R1'],
  },
  /* K3 North shore: a ladder. Two streets run inland from the coast road either side of the station, Hill Street
     joins them and carries on east to East Hill Street; the square lies behind the station. */
  north: {
    square: [-29, 29, 19.5, 41], gardens: [[-62, -33, 19.5, 41], [33, 62, 19.5, 41]],
    streets: [
      { id: 'rung-a', kind: 'main', name: 'First Street', pts: [[-68, -40], [-68, 102.5]], from: 'coast' },
      { id: 'rung-b', kind: 'main', name: 'Second Street', pts: [[68, -40], [68, 102.5]], from: 'coast' },
      { id: 'hill', kind: 'street', name: 'Hill Street', pts: [[-68, 102.5], [131, 102.5]] },
    ],
    walk: [[-68, 42.5], [68, 42.5]],
    plots: [
      { slot: 'A', rect: [-9, 63, 44, 98], face: '-v' },
      { slot: 'B', rect: [-63, -13, 44, 82], face: '-v' },
      { slot: 'C', rect: [73, 115, 10, 68], face: '-u' },
      { slot: 'R1', world: [100.5, 142.5, -59, -1], face: 'E' },
    ],
    assign: { yae: 'A', noir: 'B', influencers: 'C' }, reserve: ['R1'],
  },
  /* K4 Lighthouse point: the square and the event hall behind the station; First and Second Street run from the
     coast road to East Hill Street, which runs south behind the towns to the coast road at the Beach. */
  point: {
    square: [-29, 26, 19.5, 49.5],
    streets: [
      { id: 'rung-a', kind: 'main', name: 'First Street', world: true, pts: [[292, -63.5], [147, -63.5]], from: 'coast' },
      { id: 'rung-b', kind: 'main', name: 'Second Street', world: true, pts: [[292, 18.5], [147, 18.5]], from: 'coast' },
      { id: 'east-hill', kind: 'street', name: 'East Hill Street', world: true, pts: [[147, -63.5], [147, 152]], to: 'coast' },
    ],
    walkWorld: [[205, -63.5], [205, 18.5]],
    plots: [
      { slot: 'A', world: [151.5, 203.5, -58.5, 13.5], face: 'E' },
      { slot: 'B', world: [166, 218, -105.5, -69.5], face: 'S' },
      { slot: 'R1', world: [100.5, 142.5, 3, 61], face: 'E' },
    ],
    assign: { hackathons: 'A', duiyao: 'B' }, reserve: ['R1'],
  },
  /* K5 Beach town: a car-free beach front. The station faces the sea, its square opens onto the boardwalk with the
     party house beside it; the coast road passes inland behind the station, with the toy shop on it. */
  beach: {
    faceSea: true,
    square: [6, 46, -64, -19.5],
    plots: [
      { slot: 'A', rect: [-50, 2, -62, -22], face: '-v' },
      { slot: 'B', rect: [-43, 7, 24, 62], face: '-v' },
      { slot: 'R1', world: [100.5, 142.5, 65, 123], face: 'E' },
    ],
    assign: { party: 'A', stickers: 'B' }, reserve: ['R1'],
  },
  /* The meadow kept for a sixth town. Nothing is built here until the data file names a sixth kind of work. */
  next: {
    square: [-29, 29, 19.5, 41],
    streets: [
      { id: 'rung-a', kind: 'main', name: 'First Street', pts: [[-34, -40], [-34, 89]], from: 'coast' },
      { id: 'rung-b', kind: 'main', name: 'Second Street', pts: [[36, -40], [36, 89]], from: 'coast' },
      { id: 'hill', kind: 'street', name: 'Hill Street', pts: [[-34, 89], [36, 89]] },
    ],
    walk: [[-34, 42.5], [36, 42.5]],
    plots: [
      { slot: 'R1', rect: [-29, 29, 44, 84.5], face: '-v' },                               // one mid-size plot: the meadow's ends are taken by the Harbour's and the Beach's reserves
    ],
    assign: {}, reserve: ['R1'],
  },
};

/* Short dead-end lanes of pod houses ("closes"): [u, v] where the lane leaves a street, the way it runs, and how
   many houses stand on each side. A pocket green closes the far end. */
const CLOSES = {
  harbour: [{ at: [30, 158], dir: '+v', n: 2, name: 'Uptown Close' }],
  north: [{ world: [147, -63.5], dir: 'N', n: 2, name: 'East Hill Close' }],
};
/* Terraces: a tidy row of houses along an existing street. `at` is the first house, `dir` the way the row runs,
   `face` the side their doors are on. */
const ROWS = {
  garden: [{ at: [-16, 98.4], dir: '+u', n: 5, face: '+v', name: 'Garden Terrace' }],
  point: [{ world: [160, 29.3], dir: 'E', n: 2, face: 'N', name: 'Second Street Row' }, { world: [203, 29.3], dir: 'E', n: 2, face: 'N', name: 'Second Street Row' }],
  beach: [{ at: [17, 29.3], dir: '+u', n: 2, face: '-v', name: 'Beach Row' }],
};
/* Orchards in the green belt between the towns, as [x0, z0, x1, z1, turn in degrees] in world metres. */
const FARMS = [[152, -150, 192, -112, 0]];
/* Paths from the towns to the foot of the hill, then steps straight up to the tower plaza: [town, [[u, v] …], name]. */
const STEPS = [['north', [[-11, 42.5], [-11, 102.5], [-11, 106]], 'North steps'], ['point', [['w', 147, 1], ['w', 101, 1]], 'East steps'], ['next', [[0, -18], [0, 93]], 'South steps']];
/* Open meadows where the animals graze: [x, z, radius]. */
const MEADOWS = { sheep: [[60, 118, 26]], deer: [[178, -128, 20], [24, 62, 14]] };

const FACE = { '+u': (f) => f.u, '-u': (f) => mul(f.u, -1), '+v': (f) => f.v, '-v': (f) => mul(f.v, -1), N: () => [0, -1], S: () => [0, 1], E: () => [1, 0], W: () => [-1, 0] };
const WORLD = { o: [0, 0], u: [1, 0], v: [0, 1], L: (a, b) => [a, b], inv: (p) => p };       // a plot given in world metres: u = east, v = south

/* ---- cutting and joining lines so that roads and paths share exact points ---- */
function segHit(a, b, c, d) {              // where segment ab crosses cd: { t (along ab), p } or null
  const r = sub(b, a), s = sub(d, c); const den = r[0] * s[1] - r[1] * s[0]; if (!(Math.abs(den) > 0.03 * len(r) * len(s))) return null;   // near-parallel lines do not count as a crossing
  const qp = sub(c, a); const t = (qp[0] * s[1] - qp[1] * s[0]) / den, u = (qp[0] * r[1] - qp[1] * r[0]) / den;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null; return { t, u, p: [a[0] + r[0] * t, a[1] + r[1] * t] };
}
/** Walk a line from its start and cut it where it first meets `target`: returns the line from that point on. */
function cutStart(pts, target) {
  for (let i = 0; i < pts.length - 1; i++) { let best = null; for (let j = 0; j < target.length - 1; j++) { const h = segHit(pts[i], pts[i + 1], target[j], target[j + 1]); if (h && (!best || h.t < best.t)) best = h; } if (best) return [P(...best.p), ...pts.slice(i + 1)]; }
  return null;
}
const cutEnd = (pts, target) => { const r = cutStart([...pts].reverse(), target); return r && r.reverse(); };
function insertAt(line, i, q) { if (dist(line[i], q) < 0.02 || dist(line[i + 1], q) < 0.02) return false; line.splice(i + 1, 0, q); return true; }
/** Make every meeting exact: ends that touch another line are snapped onto it, crossings get a shared point. */
function nodeLines(lines) {
  const boxes = () => lines.map((l) => bbox(l.points));
  let bb = boxes();
  const near = (i, j, pad = 1) => !(bb[i][2] < bb[j][0] - pad || bb[j][2] < bb[i][0] - pad || bb[i][3] < bb[j][1] - pad || bb[j][3] < bb[i][1] - pad);
  // 1. ends
  lines.forEach((l, i) => { if (l.closed) return; for (const end of [0, l.points.length - 1]) {
    const e = l.points[end]; let best = null;
    lines.forEach((m, j) => { if (j === i || !near(i, j)) return; const pr = project(m.points, e); if (pr.d < 0.6 && (!best || pr.d < best.pr.d)) best = { m, pr }; });
    if (!best) continue; const q = P(...best.pr.q); const i0 = best.pr.i; const mp = best.m.points;
    const at = dist(mp[i0], q) < 0.02 ? mp[i0] : dist(mp[i0 + 1], q) < 0.02 ? mp[i0 + 1] : null;
    if (at) l.points[end] = at; else { mp.splice(i0 + 1, 0, q); l.points[end] = q; }
  } });
  // 2. crossings
  bb = boxes();
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    if (!near(i, j)) continue; const A = lines[i].points, B = lines[j].points;
    for (let a = 0; a < A.length - 1; a++) for (let b = 0; b < B.length - 1; b++) {
      if (Math.max(A[a][0], A[a + 1][0]) < Math.min(B[b][0], B[b + 1][0]) || Math.max(B[b][0], B[b + 1][0]) < Math.min(A[a][0], A[a + 1][0]) || Math.max(A[a][1], A[a + 1][1]) < Math.min(B[b][1], B[b + 1][1]) || Math.max(B[b][1], B[b + 1][1]) < Math.min(A[a][1], A[a + 1][1])) continue;
      const h = segHit(A[a], A[a + 1], B[b], B[b + 1]); if (!h) continue; let q = P(...h.p);
      for (const v of [A[a], A[a + 1], B[b], B[b + 1]]) if (dist(v, q) < 0.02) q = v;
      const ia = insertAt(A, a, q), ib = insertAt(B, b, q); if (ia) a++; if (ib) b++;
    }
  }
}

/* ============================================ building the plan ============================================ */
/**
 * buildPlan(cityData, manifest, options?) → the whole plan as plain data (safe to JSON.stringify).
 *
 *   cityData  the exports of city-data.js. Only the project list is needed (PROJECTS or STOPS: { id, district or town });
 *             TOWNS (id, code, name, district), LIFE (counts) and levelOf are used when present.
 *   manifest  models/manifest.json. Every size, door and level is read from it at run time.
 *   options   { levels: { projectId: 1..5 } }  set building levels directly, or
 *             { projects: window.KY.projects } so cityData.levelOf can work them out.
 *             With neither, globalThis.KY.projects is used if it exists; otherwise known projects stand at level 3.
 *
 * Returns
 *   scale, plateau          the building scale (PLAN.scale) and the height of the flat land
 *   island                  { coast, quay, hill, width, depth }
 *   towns[]                 { id, code, name, district, main, projects: [ids],
 *                             station: { x, z, rot, model, s, straight: [m before, m after], exits: [{ side, at: [x, z], kerb? }] },
 *                             square: polygon }                         exits[0] is the station's entrance: every walk starts there
 *   nextTown                { station, site } for the sixth town's meadow (null once the data has a sixth town)
 *   metro                   { cw, ccw, centre: closed lines of [x, z]; height (above the flat land), y (above the sea), gauge,
 *                             length, stations: [{ town, code, x, z, s, dir }] }   cw is the inner lane (clockwise trains keep right)
 *   pod                     { path: [[x, y, z] …] from the Harbour station to the tower, stops: [{ code, name, x, y, z }] }
 *   roads[]                 { id, kind: coast | main | street | lane | hill, width, name, town?, points, closed?, culdesac? }
 *   paths[]                 { id, kind: footpath | promenade | boardwalk | steps, width, name?, points }
 *   zones[]                 { id, town, use: square | project | port | reserved | residential | park | farm | beach | hill | future, poly, label? }
 *   lots[]                  { id, town, use: project | reserved | station, poly, front: { x, z, rot }, size: [frontage, depth],
 *                             project?, origin?: { x, z, rot } }       origin = where that project's model stands at EVERY level
 *   placements[]            { model, x, z, rot, scale, kind, lot?, project?, level?, town?, door?, y? (gates), water? (boats) }
 *                           kind: building | station | tower | landmark | house | tree | lamp | bench | beach | boat | gate
 *   walks                   { projectId: [[x, z] …] } from the station entrance to the building's door, along roads and paths
 *   projects                { projectId: { town, lot, level, model, door } }
 *   spawns                  cars, buses, boats and animals: counts with the roads or areas they belong to
 *   counts, problems        problems lists anything the plan could not satisfy (plan-check fails on any entry)
 */
export function buildPlan(cityData = {}, manifest = {}, options = {}) {
  const S = PLAN.scale, Y0 = PLAN.plateau;
  const defs = new Map((manifest.models || []).map((m) => [m.name, m]));
  const def = (name) => defs.get(name) || null;
  const problems = [];                      // anything the plan could not satisfy; plan-check fails on every entry
  const rand = rng(options.seed == null ? 20261121 : options.seed);
  const LIFE = cityData.LIFE || {};

  /* ---------- towns and projects ---------- */
  const rows = cityData.PROJECTS || cityData.STOPS || [];
  const dataTowns = cityData.TOWNS || [];
  const districtOf = (row) => row.district || (dataTowns.find((t) => t.id === row.town) || {}).district || ((manifest.buildings || {})[row.id] || {}).district || null;
  const towns = TOWN_DEFAULTS.map((d) => { const dt = dataTowns.find((t) => t.district === d.district) || {}; return { id: dt.id || d.id, key: d.id, code: dt.code || d.code, name: dt.name || d.name, district: d.district, main: !!d.main, projects: [] }; });
  const knownDistricts = new Set(TOWN_DEFAULTS.map((d) => d.district));
  const extra = [...new Set([...dataTowns.map((t) => t.district), ...rows.map(districtOf)].filter((d) => d && !knownDistricts.has(d)))];
  if (extra.length) { const dt = dataTowns.find((t) => t.district === extra[0]) || {}; towns.push({ id: dt.id || 'next', key: 'next', code: dt.code || `K${towns.length + 1}`, name: dt.name || 'New town', district: extra[0], main: false, projects: [] }); }
  if (extra.length > 1) problems.push(`only one town site is reserved: no site for ${extra.slice(1).join(', ')}`);
  const townByKey = Object.fromEntries(towns.map((t) => [t.key, t]));
  const projList = options.projects || (globalThis.KY && globalThis.KY.projects) || [];
  const levelFor = (row) => {
    if (options.levels && options.levels[row.id] != null) return options.levels[row.id];
    const proj = projList.find((p) => p.id === (row.project || row.id));
    if (proj && typeof cityData.levelOf === 'function') return cityData.levelOf(row, proj);
    return row.level || (projList.length ? 1 : 3);
  };

  /* ---------- roads ---------- */
  const roads = [], paths = [];
  const clean = (points) => points.map((p) => P(...p)).filter((p, i, a) => i === 0 || dist(p, a[i - 1]) > 0.02);
  const road = (id, kind, points, more = {}) => { const r = { id, kind, width: PLAN.road[kind], points: clean(points), ...more }; roads.push(r); return r; };
  const path = (id, kind, points, more = {}) => { const r = { id, kind, width: PLAN.path[kind], points: clean(points), ...more }; paths.push(r); return r; };

  /* The coast road: one ring round the island. It runs 18 m seaward of the lanes, except where a town fills the
     waterfront: past the Harbour (port and main station) and the Beach (the car-free beach front) it passes inland,
     behind the station. */
  const CR = PLAN.coastRoad; const relTo = (f) => (s) => { let d = wrapS(s - f.s); if (d > LOOP.length / 2) d -= LOOP.length; return d; };
  const rel = relTo(HB); const relBeach = relTo(FRAMES.beach), relGarden = relTo(FRAMES.garden);
  const INLAND = [{ rel, a: -95, b: 118, off: CR.harbour, ramp: [80, 55] }, { rel: relBeach, a: -94, b: 94, off: CR.beach, ramp: [30, 36] }];   // metres along the loop from each station
  const coastOff = (s) => { let off = CR.sea; for (const st of INLAND) { const d = st.rel(s); let k = 0; if (d >= st.a && d <= st.b) k = 1; else if (d < st.a && d > st.a - st.ramp[0]) k = 1 - smooth((st.a - d) / st.ramp[0]); else if (d > st.b && d < st.b + st.ramp[1]) k = 1 - smooth((d - st.b) / st.ramp[1]); if (k > 0) off = CR.sea + (st.off - CR.sea) * k; } return off; };
  const coastRoad = road('coast', 'coast', besideLoop(0, LOOP.length, coastOff, 2), { name: 'Coast Road', closed: true });
  coastRoad.points[coastRoad.points.length - 1] = coastRoad.points[0];
  const PORT = 2.4;                                                                                    // Port Road and Fishers' Road run under the seaward lane, this far out
  const cross = (() => { let lo = 0, hi = 1; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (CR.sea + (CR.harbour - CR.sea) * (1 - smooth(m)) < PORT) lo = m; else hi = m; } return lo; })();   // … and join the coast road where it crosses under that lane
  const hb = HB.L;
  const sPort = HB.s + INLAND[0].b + cross * INLAND[0].ramp[1], sFish = HB.s + INLAND[0].a - cross * INLAND[0].ramp[0];
  road('harbour-port', 'lane', [...besideLoop(HB.s + 37, sPort - 16, PORT), besideLoop(sPort, sPort, PORT)[0]], { name: 'Port Road', town: 'harbour' });
  road('harbour-fishers', 'lane', [besideLoop(sFish, sFish, PORT)[0], ...besideLoop(sFish + 16, HB.s - 37, PORT)], { name: "Fishers' Road", town: 'harbour' });

  /* Every town's own streets, from its layout */
  for (const town of towns) {
    const lay = LAYOUT[town.key], f = FRAMES[town.key];
    for (const st of lay.streets || []) {
      let pts = st.world ? st.pts : st.pts.map(([a, b]) => f.L(a, b)); const id = `${town.key}-${st.id}`;
      if (st.from) { const target = roads.find((r) => r.id === st.from); const c = target && cutStart(pts, target.points); if (c) pts = c; else problems.push(`street ${id} does not reach ${st.from}`); }
      if (st.to) { const target = roads.find((r) => r.id === st.to); const c = target && cutEnd(pts, target.points); if (c) pts = c; else problems.push(`street ${id} does not reach ${st.to}`); }
      if (st.toEnd) { const target = roads.find((r) => r.id === st.toEnd); if (target) pts[pts.length - 1] = target.points[target.points.length - 1]; else problems.push(`street ${id} does not reach ${st.toEnd}`); }
      road(id, st.kind, pts, { name: st.name, town: town.key });
    }
  }
  /* Closes: short lanes of houses */
  const closeList = [];
  for (const town of towns) (CLOSES[town.key] || []).forEach((c, k) => {
    const f = FRAMES[town.key]; const d = FACE[c.dir](f); const a = c.world || f.L(c.at[0], c.at[1]); const L = 5 + c.n * 14 + 3; const b = add(a, mul(d, L));
    road(`${town.key}-close-${k + 1}`, 'lane', [a, b], { name: c.name || 'Close', town: town.key, culdesac: true });
    closeList.push({ town, a, d, L, n: c.n, sides: c.sides || 'both', k });
  });

  /* The hill road: Tower Avenue carries on from Mid Street to the foot of the hill, then winds once round it to the
     tower plaza at an even climb */
  const hillRoad = (() => {
    const start = hb(-89, 101); const a0 = Math.atan2((start[1] - H.z) / H.b, (start[0] - H.x) / H.a); const sweep = (300 * Math.PI) / 180; const pts = [start]; const N = 90;
    for (let k = 0; k <= N; k++) {
      const g = k / N; const ang = a0 - sweep * g; const at = (tau) => [H.x + (H.ta + (H.a - H.ta) * tau) * Math.cos(ang), H.z + (H.tb + (H.b - H.tb) * tau) * Math.sin(ang)];
      let lo = 0, hi = 1; for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (hillAmount(...at(m)) > g) lo = m; else hi = m; }
      pts.push(at(g >= 1 ? -0.02 : (lo + hi) / 2));
    }
    return road('hill', 'hill', pts, { name: 'Tower Road', culdesac: true });
  })();

  /* ---------- plots, squares, stations ---------- */
  const lots = [], zones = [], placements = [];
  const lotInfo = new Map();                 // lot id → { centre, fd (front direction), W, D }
  const zone = (id, town, use, poly, more = {}) => { zones.push({ id, town, use, poly: poly.map((p) => P(...p)), ...more }); };
  const rectOf = (f, [u0, u1, v0, v1]) => [f.L(u0, v0), f.L(u1, v0), f.L(u1, v1), f.L(u0, v1)].map((p) => P(...p));
  const place = (model, p, rot, more = {}) => { const pl = { model, x: R2(p[0]), z: R2(p[1]), rot: Math.round(rot * 1e5) / 1e5, scale: 1, ...more }; if (!def(model) && !pl.builtin) problems.push(`no model called ${model}`); placements.push(pl); return pl; };
  const polyOf = (pl) => { const d = def(pl.model); return d ? footprint(pl, d) : rectPoly([pl.x, pl.z], 1, 1, [0, 1]); };

  for (const town of towns) {
    const lay = LAYOUT[town.key], f = FRAMES[town.key];
    for (const sp of lay.plots) {
      const lf = sp.world ? WORLD : sp.ds != null ? frameAtS(f.s + sp.ds) : f;
      const [u0, u1, v0, v1] = sp.world || sp.rect; const fd = FACE[sp.face](lf); const alongU = sp.face[1] === 'u' || sp.face === 'E' || sp.face === 'W';
      const W = alongU ? v1 - v0 : u1 - u0, D = alongU ? u1 - u0 : v1 - v0; const centre = lf.L((u0 + u1) / 2, (v0 + v1) / 2); const fm = add(centre, mul(fd, D / 2));
      const lot = { id: `${town.key}-${sp.slot}`, town: town.id, use: 'reserved', zone: sp.use || 'project', ...(sp.quay ? { quay: true } : {}), poly: rectOf(lf, sp.world || sp.rect), front: { x: R2(fm[0]), z: R2(fm[1]), rot: Math.round(rotOf(fd) * 1e5) / 1e5 }, size: [R2(W), R2(D)], slot: sp.slot };
      lots.push(lot); lotInfo.set(lot.id, { centre, fd, W, D });
    }
    // the station
    const main = !!town.main; const model = main ? 'station_main' : 'station'; const sd = def(model);
    const front = lay.faceSea ? mul(f.v, -1) : f.v;                    // a station faces its square: inland, or the sea at the Harbour and the Beach
    const st = place(model, f.o, rotOf(front), { lot: `${town.key}-station`, kind: 'station', town: town.id });
    const exits = []; const frontSide = lay.faceSea ? 'sea' : 'town', backSide = lay.faceSea ? 'town' : 'sea';
    if (sd) { const kerb = P(...toWorld(st, sd.door[0], sd.door[1])); const ent = sd.entrance && sd.entrance.door ? P(...toWorld(st, sd.entrance.door[0], sd.entrance.door[1])) : kerb; exits.push({ side: frontSide, at: ent, kerb }); }
    if (sd && sd.backDoor) exits.push({ side: backSide, at: P(...toWorld(st, sd.backDoor[0], sd.backDoor[1])) });
    else if (sd && main) exits.push({ side: backSide, at: P(...toWorld(st, 16, sd.min[2])), derived: true });   // the hall has doors on both sides; the town side is taken at the edge of its paving
    town.station = { x: st.x, z: st.z, rot: st.rot, model, exits, s: R2(f.s), straight: [R2(f.room[0]), R2(f.room[1])] };
    if (sd) lots.push({ id: `${town.key}-station`, town: town.id, use: 'station', zone: 'civic', poly: polyOf(st), front: { x: st.x, z: st.z, rot: st.rot } });
    // the square
    if (lay.square) { town.square = rectOf(f, lay.square); (lay.gardens || []).forEach((g, k) => zone(`${town.key}-garden-${k + 1}`, town.id, 'park', rectOf(f, g))); }
    else town.square = [hb(-33, -14), hb(33, -14), hb(33, -53.5), hb(-12.5, -53.5), hb(-12.5, -60), hb(-39.5, -60), hb(-39.5, -14)].map((p) => P(...p));   // the quay in front of the main station
    zone(`${town.key}-square`, town.id, 'square', town.square, { label: main ? 'Harbour Square' : 'Station Square' });
  }
  const NEXT_SITE = rectOf(FRAMES.next, [-37, 41, 9, 94]);
  if (!townByKey.next) zone('next-town', null, 'future', NEXT_SITE, { label: 'South meadow: kept for town six' });
  zone('port-cargo', townByKey.harbour.id, 'port', [hb(40.5, -5), hb(123.5, -5), hb(123.5, -63.5), hb(40.5, -63.5)], { label: 'Port' });
  zone('port-fishers', townByKey.harbour.id, 'port', [hb(-100, -5), hb(-41, -5), hb(-41, -53), hb(-100, -50.5)], { label: "Fishers' quay" });

  /* ---------- projects onto plots ---------- */
  const nodesOf = (id) => ((manifest.buildings || {})[id] || {}).nodes || { 1: 'lot', 2: 'site_small' };
  const landBox = (d) => { const b = groundBox(d); if (d.quayEdge != null) b[1] = d.quayEdge; return b.map((n) => n * S); };   // a quay building's piers stand in the water
  const largest = (id) => { let u = null; for (const name of Object.values(nodesOf(id))) { const d = def(name); if (!d) continue; const b = landBox(d); u = u ? [Math.min(u[0], b[0]), Math.min(u[1], b[1]), Math.max(u[2], b[2]), Math.max(u[3], b[3])] : b; } return u || [-17, -13, 17, 13]; };
  const taken = new Set(); const projects = {};
  for (const row of rows) {
    const town = towns.find((t) => t.district === districtOf(row)); if (!town) { problems.push(`project ${row.id} has no town (district ${districtOf(row)})`); continue; }
    const lay = LAYOUT[town.key]; let slot = lay.assign[row.id]; if (slot && taken.has(`${town.key}-${slot}`)) slot = null;
    if (!slot) slot = lay.reserve.find((s) => !taken.has(`${town.key}-${s}`));
    if (!slot) { problems.push(`${town.name} has no free plot left for ${row.id}`); continue; }
    const lot = lots.find((l) => l.id === `${town.key}-${slot}`); taken.add(lot.id); town.projects.push(row.id);
    const { centre, fd, W, D } = lotInfo.get(lot.id); const x = [fd[1], -fd[0]]; const u = largest(row.id); const sb = PLAN.setback;
    if (u[2] - u[0] > W - 2 * sb + 1e-6 || u[3] - u[1] > D - (lot.quay ? sb : 2 * sb) + 1e-6) problems.push(`plot ${lot.id} (${W} × ${D} m) is too small for ${row.id} at its largest (${R2(u[2] - u[0])} × ${R2(u[3] - u[1])} m plus ${sb} m all round)`);
    const o = add(add(centre, mul(x, -(u[0] + u[2]) / 2)), mul(fd, D / 2 - sb - u[3]));
    const level = clamp(Math.round(levelFor(row)), 1, 5); const nodes = nodesOf(row.id); let model = null;
    for (let l = level; l >= 1 && !model; l--) if (nodes[l] && def(nodes[l])) model = nodes[l];
    if (!model) { model = 'lot'; } if (!nodes[level] || !def(nodes[level])) problems.push(`no model for ${row.id} at level ${level}`);
    const pl = place(model, o, rotOf(fd), { scale: S, lot: lot.id, project: row.id, level, kind: 'building', town: town.id });
    const dd = def(model); pl.door = dd && dd.door ? P(...toWorld(pl, dd.door[0], dd.door[1])) : P(...add(o, mul(fd, u[3])));
    lot.use = 'project'; lot.project = row.id; lot.origin = { x: pl.x, z: pl.z, rot: pl.rot }; projects[row.id] = { town: town.id, lot: lot.id, level, model, door: pl.door };
  }
  for (const lot of lots) if (lot.use !== 'station') zone(`zone-${lot.id}`, lot.town, lot.use === 'project' ? lot.zone : 'reserved', lot.poly);

  /* ---------- landmarks: the tower and its pod stop, the ferry terminal, the lighthouse ---------- */
  const hillC = [H.x, H.z]; const toHarbour = unit(sub(HB.o, hillC));
  const tower = place('tower', hillC, rotOf(toHarbour), { lot: 'tower', kind: 'tower' });
  const podStop = place('tram_stop', add(hillC, mul(toHarbour, 41.5)), rotOf(mul(toHarbour, -1)), { lot: 'tower', kind: 'station' });
  const ferryT = place('ferry_terminal', hb(-26, -68), rotOf(HB.v), { lot: 'harbour-ferry', kind: 'station', town: townByKey.harbour.id, ground: 'quay' });
  const PT = FRAMES.point; let lw = 0; while (lw < 120 && pointInPoly(PT.L(-10, -(lw + 0.5)), coast)) lw += 0.5;      // out on the headland, by the water
  const lighthouse = place('lighthouse', PT.L(-10, -(lw - 9.4)), rotOf(PT.v), { lot: 'lighthouse', kind: 'landmark', town: townByKey.point.id, ground: 'shore' });
  zone('hill', null, 'hill', Array.from({ length: 48 }, (_, k) => [H.x + H.a * Math.cos((k / 48) * 6.28319), H.z + H.b * Math.sin((k / 48) * 6.28319)]), { label: 'Tower Hill park' });
  zone('tower-plaza', null, 'square', Array.from({ length: 36 }, (_, k) => [H.x + H.ta * Math.cos((k / 36) * 6.28319), H.z + H.tb * Math.sin((k / 36) * 6.28319)]), { label: 'Tower plaza' });

  /* ---------- houses: along the closes, and in terraces on the streets ---------- */
  const houseModels = ['house_a', 'house_b', 'house_c', 'house_d'].filter(def); let houseNo = 0;
  const houseHalf = Math.max(5, ...houseModels.map((n) => (def(n).max[2] - def(n).min[2]) / 2)) + 0.15;      // half the depth of the deepest house
  const house = (centre, fd, lotId, town) => { const name = houseModels[houseNo++ % houseModels.length]; const d = def(name); if (!d) return null; const x = [fd[1], -fd[0]];
    const pl = place(name, add(add(centre, mul(x, -(d.min[0] + d.max[0]) / 2)), mul(fd, -(d.min[2] + d.max[2]) / 2)), rotOf(fd), { lot: lotId, kind: 'house', town: town.id }); pl.door = d.door ? P(...toWorld(pl, d.door[0], d.door[1])) : null; return pl; };
  for (const c of closeList) {
    const n = right(c.d); let count = 0; const off = PLAN.road.lane / 2 + 2 + houseHalf;
    for (let k = 0; k < c.n; k++) for (const side of [1, -1]) { if ((c.sides === 'right' && side < 0) || (c.sides === 'left' && side > 0)) continue; if (house(add(add(c.a, mul(c.d, 5 + 14 * (k + 0.5))), mul(n, side * off)), mul(n, -side), `${c.town.key}-close-${c.k + 1}`, c.town)) count++; }
    const hw = off + 7.5; const A = add(c.a, mul(c.d, 3)), B = add(c.a, mul(c.d, c.L + 11)); const sideA = c.sides === 'left' ? 2 : hw, sideB = c.sides === 'right' ? 2 : hw;
    zone(`${c.town.key}-homes-${c.k + 1}`, c.town.id, 'residential', [add(A, mul(n, sideA)), add(B, mul(n, sideA)), add(B, mul(n, -sideB)), add(A, mul(n, -sideB))], { houses: count, label: c.name });
    const g = add(c.a, mul(c.d, c.L + 6)); zone(`${c.town.key}-green-${c.k + 1}`, c.town.id, 'park', rectPoly(g, 11, 9, c.d), { label: 'Pocket green' }); c.green = g;
  }
  for (const town of towns) (ROWS[town.key] || []).forEach((r, k) => {
    const f = FRAMES[town.key]; const d = FACE[r.dir](f), fd = FACE[r.face](f); const a = r.world || f.L(r.at[0], r.at[1]);
    for (let i = 0; i < r.n; i++) house(add(a, mul(d, 14 * i)), fd, `${town.key}-row-${k + 1}`, town);
    const A = add(a, mul(d, -8)), B = add(a, mul(d, 14 * (r.n - 1) + 8)); zone(`${town.key}-terrace-${k + 1}`, town.id, 'residential', [add(A, mul(fd, 7.2)), add(B, mul(fd, 7.2)), add(B, mul(fd, -8)), add(A, mul(fd, -8))], { houses: r.n, label: r.name });
  });

  /* ---------- paths ---------- */
  // the waterfront promenade: 8 m in from the water, but never far from the lanes (so a wide shore keeps its beach or park)
  const PR = PLAN.promenade; const prom = []; const nat = coast.slice(0, COAST.natural);
  const nearLane = nat.map((c) => { let bi = 0, bd = Infinity; LOOP.pts.forEach((p, i) => { const d = dist(p, c); if (d < bd) { bd = d; bi = i; } }); const s = LOOP.s[bi]; const r = rel(s); return { i: bi, d: bd, s, harbour: r > -175 && r < 165 }; });
  const offs = nat.map((c, k) => {
    const { d: bd, s, harbour } = nearLane[k]; if (harbour) return PR.shore;                              // round the Harbour it keeps to the water's edge
    const rg = relGarden(s), rb = relBeach(s); const hug = smooth((rg + 75) / 30) * smooth((75 - rg) / 30);   // … and round the Garden cape
    const inBeach = smooth((rb + 92) / 26) * smooth((88 - rb) / 26); const atHead = Math.exp(-(((Math.atan2(c[1], c[0]) + 0.1) / 0.13) ** 2));
    let keep = PR.keep - 14.5 * atHead; keep += (PR.beach - keep) * inBeach;                                 // behind the lighthouse; and the boardwalk at the top of the beach
    let o = Math.max(PR.shore, bd - keep); o += (PR.shore - o) * hug;
    return Math.max(3, Math.min(o, bd - 25.5));
  });
  for (let pass = 0; pass < 2; pass++) { const was = offs.slice(); for (let k = 0; k < offs.length; k++) { let s = 0, n = 0; for (let j = -3; j <= 3; j++) { const v = was[k + j]; if (v != null) { s += v; n++; } } offs[k] = Math.min(s / n, nearLane[k].d - 25.5); } }   // smoothed along the shore, never onto the road
  nat.forEach((c, k) => { const dl = dist(c, [lighthouse.x, lighthouse.z]); if (dl < 56) offs[k] += (nearLane[k].d - 25.5 - offs[k]) * smooth((56 - dl) / 30); });   // behind the lighthouse it runs beside the coast road
  const inward = nat.map((c, k) => { if (nearLane[k].harbour) { const a = nat[Math.max(0, k - 1)], b = nat[Math.min(nat.length - 1, k + 1)]; return right(unit(sub(b, a))); } return unit(sub(LOOP.pts[nearLane[k].i], c)); });   // towards the lanes, so the distance from them is exact
  nat.forEach((c, k) => prom.push(P(...add(c, mul(inward[k], offs[k])))));
  const beachIdx = nat.map((c, k) => (relBeach(nearLane[k].s) >= -84 && relBeach(nearLane[k].s) <= 80 ? k : -1)).filter((k) => k >= 0);
  const b0 = beachIdx[0], b1 = beachIdx[beachIdx.length - 1];
  path('promenade-north', 'promenade', prom.slice(0, b0 + 1), { name: 'North promenade' });
  path('boardwalk', 'boardwalk', prom.slice(b0, b1 + 1), { name: 'Beach boardwalk' });
  path('promenade-south', 'promenade', [...prom.slice(b1), hb(-99, -50.2), hb(-44, -50.2), hb(37, -50.5)], { name: 'South promenade and the quay' });
  path('harbour-quay-walk', 'footpath', [hb(37, -50.5), hb(37, -3)]);
  { const pr = project(roads.find((r) => r.id === 'harbour-port').points, hb(120.5, -6)); path('harbour-port-walk', 'footpath', [prom[0], hb(120.5, -45), hb(120.5, -8), pr.q], { name: 'Round the cargo quay' }); }
  path('harbour-ferry-walk', 'footpath', [hb(-26, -50.5), hb(-26, -61)]);
  zone('beach', townByKey.beach.id, 'beach', [...nat.slice(b0, b1 + 1), ...prom.slice(b0, b1 + 1).map((p, i) => add(nat[b0 + i], mul(inward[b0 + i], offs[b0 + i] - PLAN.path.boardwalk / 2 - 0.3))).reverse()], { label: 'Beach' });

  // from each station's doors: to its square and its streets on one side, to the waterfront on the other
  const promAll = [...paths.find((p) => p.id === 'promenade-north').points, ...paths.find((p) => p.id === 'boardwalk').points, ...paths.find((p) => p.id === 'promenade-south').points];
  for (const town of towns) {
    const lay = LAYOUT[town.key], f = FRAMES[town.key]; const ex = town.station.exits; if (!ex.length) continue;
    const a = f.inv(ex[0].kerb), b = ex[1] && f.inv(ex[1].at);
    if (town.main) { path(`${town.key}-exit-sea`, 'footpath', [ex[0].at, f.L(a[0], -50.5)], { name: 'To the quay' }); path(`${town.key}-exit-town`, 'footpath', [ex[1].at, f.L(b[0], 28)], { name: 'To Harbour Road' }); continue; }
    if (lay.faceSea) {                                                                                   // the Beach: out of the front door, over the square, onto the boardwalk
      const c = cutEnd([ex[0].at, ex[0].kerb, f.L(a[0], -90)], promAll); if (c) path(`${town.key}-exit-sea`, 'footpath', c, { name: 'Across the square' }); else problems.push(`${town.name}: the front door does not reach the boardwalk`);
      if (b) { const d = cutEnd([ex[1].at, f.L(b[0], 40)], coastRoad.points); if (d) path(`${town.key}-exit-town`, 'footpath', d, { name: 'To the coast road' }); }
      { const side = a[0] + 10.8; const d = cutEnd([ex[0].kerb, f.L(side, a[1]), f.L(side, 40)], coastRoad.points); if (d) path(`${town.key}-side-walk`, 'footpath', d, { name: 'Round the station to the coast road' }); else problems.push(`${town.name}: no way round the station`); }
      continue;
    }
    const walk = lay.walkWorld || lay.walk.map(([u, v]) => f.L(u, v)); const walkV = f.inv(walk[0])[1];
    path(`${town.key}-square-walk`, 'footpath', walk, { name: 'Square walk' });
    path(`${town.key}-exit-town`, 'footpath', [ex[0].at, ex[0].kerb, f.L(a[0], walkV)], { name: 'Across the square' });
    if (b && lay.capeWalks) {                                                                          // a building stands between this station and the water: out to the coast road, then round it
      path(`${town.key}-exit-sea`, 'footpath', [ex[1].at, f.L(b[0], -18)], { name: 'To the coast road' });
      lay.capeWalks.forEach((u, k) => { const c = cutEnd([f.L(u, -18), f.L(u, -120)], promAll); if (c) path(`${town.key}-cape-walk-${k + 1}`, 'footpath', c, { name: 'To the waterfront' }); else problems.push(`${town.name}: a cape walk does not reach the promenade`); });
    } else if (b) { const c = cutEnd([ex[1].at, f.L(b[0], -18), f.L(b[0], -110)], promAll); if (c) path(`${town.key}-exit-sea`, 'footpath', c, { name: 'To the waterfront' }); else problems.push(`${town.name}: the sea-side exit does not reach the promenade`); }
  }
  // the tower plaza ring, and steps up the hill from the north, the east and the south
  const ring = Array.from({ length: 49 }, (_, k) => [H.x + 33.3 * Math.cos((k / 48) * 6.28319), H.z + 33.3 * Math.sin((k / 48) * 6.28319)]); ring[48] = ring[0];
  path('tower-ring', 'footpath', ring, { name: 'Tower plaza', closed: true });
  STEPS.forEach(([key, way, name]) => { if (key !== 'next' && !townByKey[key]) return; if (key === 'next' && townByKey.next) way = [[1, 89], [1, 94]]; const pts = way.map((w) => (w[0] === 'w' ? [w[1], w[2]] : FRAMES[key].L(w[0], w[1]))); const from = pts[pts.length - 1]; const d = unit(sub(hillC, from)); path(`walk-${key}-hill`, 'footpath', pts, { name: `To the ${name.toLowerCase()}` }); path(`steps-${key}`, 'steps', [from, add(hillC, mul(d, -33.3))], { name }); });

  // from every door to its street
  const doorLink = (id, from, dir, reach = 34) => {
    const far = add(from, mul(dir, reach)); let best = null;
    for (const r of [...roads, ...paths]) for (let i = 0; i < r.points.length - 1; i++) { const h = segHit(from, far, r.points[i], r.points[i + 1]); if (h && h.t > 1e-6 && (!best || h.t < best.t)) best = h; }
    if (!best) { problems.push(`${id}: no street in front of the door`); return null; }
    return path(id, 'footpath', [from, best.p]);
  };
  for (const pl of placements) if (pl.kind === 'building') doorLink(`door-${pl.project}`, pl.door, frontOf(pl.rot), 40);
  for (const pl of placements) if (pl.kind === 'house' && pl.door) doorLink(`door-house-${placements.indexOf(pl)}`, pl.door, frontOf(pl.rot), 12);
  { const d = def('tower'); if (d && d.door) doorLink('door-tower', toWorld(tower, d.door[0], d.door[1] - 0.5), frontOf(tower.rot), 8); }
  { const d = def('tram_stop'); if (d && d.door) doorLink('door-pod', toWorld(podStop, d.door[0], d.door[1]), frontOf(podStop.rot), 12); }
  { const d = def('lighthouse'); if (d && d.door) { const from = toWorld(lighthouse, d.door[0], d.door[1]); const c = cutEnd([from, add(from, mul(frontOf(lighthouse.rot), 60))], promAll); if (c) path('door-lighthouse', 'footpath', c); else problems.push('the lighthouse has no path'); } }

  /* ---------- make every junction exact ---------- */
  nodeLines(roads);
  nodeLines([...paths, ...roads]);

  /* ---------- the metro lanes and the hill pod ---------- */
  const laneOf = (sign) => LOOP.pts.map((p, i) => P(...add(p, mul(right(LOOP.tan[i]), (sign * M.gauge) / 2))));
  const cw = laneOf(1); cw.push(cw[0]); const ccw = laneOf(-1).reverse(); ccw.push(ccw[0]);
  const centre = LOOP.pts.map((p) => P(...p)); centre.push(centre[0]);
  const metro = { cw, ccw, centre, height: M.height, y: Y0 + M.height, gauge: M.gauge, length: R2(LOOP.length), stations: towns.map((t) => ({ town: t.id, code: t.code, x: t.station.x, z: t.station.z, s: t.station.s, dir: FRAMES[t.key].u.map(R2) })) };
  // ring gates the trains fly through: two on the way into every station from each side, and one every 70 m or so between
  { const ringModel = def('lane_ring_double') ? 'lane_ring_double' : 'ring_gate'; const lift = (def(ringModel) || {}).aboveDatum || 2; const marks = [];
    const ss = towns.map((t) => t.station.s).sort((a, b) => a - b);
    ss.forEach((s0, i) => { const s1 = i + 1 < ss.length ? ss[i + 1] : ss[0] + LOOP.length; marks.push(s0 + 58, s0 + 88, s1 - 88, s1 - 58); const gap = s1 - s0 - 176; const n = Math.floor(gap / 70); for (let k = 1; k <= n; k++) marks.push(s0 + 88 + (gap * k) / (n + 1)); });
    for (const s of marks) { const q = loopAt(s); place(ringModel, q.p, Math.atan2(-q.t[1], q.t[0]), { kind: 'gate', y: R2(Y0 + M.height + lift), builtin: !def(ringModel) }); } }
  const pod = (() => {
    const end = HB.inv([podStop.x, podStop.z]); const top = H.h + 1.2; const sm = def('station_main'); const dock = sm && sm.tram ? -sm.tram.trackCentre[1] : 16.7;   // the pod's dock behind the main hall
    const way = [[0, dock, 1.2], [-24, dock, 3.2], [-62, dock + 2.3, 8.5], [-86, 36, 12], [-89, 62, 14], [-89, 98, 16], [end[0] * 0.5 - 44, 98 + (end[1] - 98) * 0.5, 19], [end[0], end[1], top]];   // out along the back of the station, up Tower Avenue, then over the hillside
    let pts = way.map(([u, v, y]) => [...hb(u, v), y]);
    for (let pass = 0; pass < 3; pass++) { const out = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; out.push(a.map((v, k) => v * 0.75 + b[k] * 0.25), a.map((v, k) => v * 0.25 + b[k] * 0.75)); } out.push(pts[pts.length - 1]); pts = out; }
    const line = pts.map(([x, z, y], i) => [R2(x), R2(Math.max(Y0 + y, i > 4 ? height(x, z) + (i < pts.length - 3 ? 4.5 : 1.2) : 0)), R2(z)]);
    const names = (cityData.TRAM && cityData.TRAM.stops) || [{ code: 'T1', name: 'Harbour' }, { code: 'T2', name: 'Tower' }];
    return { path: line, stops: [{ ...names[0], x: line[0][0], y: line[0][1], z: line[0][2] }, { ...names[1], x: line[line.length - 1][0], y: line[line.length - 1][1], z: line[line.length - 1][2] }] };
  })();

  /* ---------- what is already standing, for everything that is scattered after it ---------- */
  const solids = []; const noGo = [];                      // footprints; and areas kept clear (plots, squares, the meadow kept for town six)
  const solid = (poly, kind) => solids.push({ poly, bb: bbox(poly), kind });
  const plazaR = (def('tower') || {}).plazaRadius || 31;
  for (const pl of placements) if (pl.kind !== 'gate') solid(pl.model === 'tower' ? Array.from({ length: 20 }, (_, k) => [pl.x + plazaR * Math.cos(k * 0.314159), pl.z + plazaR * Math.sin(k * 0.314159)]) : polyOf(pl), pl.kind);
  for (const l of lots) if (l.use !== 'station') noGo.push({ poly: l.poly, bb: bbox(l.poly) });
  for (const z of zones) if (['square', 'future', 'beach', 'park'].includes(z.use)) noGo.push({ poly: z.poly, bb: bbox(z.poly), use: z.use });
  /* the gap between a footprint and a line of a given half-width, looking only at the stretches of the line near it */
  const chunksOf = (pts) => { const out = []; for (let i = 0; i < pts.length - 1; i += 12) { const part = pts.slice(i, Math.min(pts.length, i + 13)); out.push({ part, bb: bbox(part) }); } return out; };
  const lineGap = (poly, bb, line, half, reach) => { const ch = line.chunks || (line.chunks = chunksOf(line.points)); let g = Infinity;
    for (const c of ch) { if (c.bb[2] < bb[0] - reach || c.bb[0] > bb[2] + reach || c.bb[3] < bb[1] - reach || c.bb[1] > bb[3] + reach) continue; g = Math.min(g, polyLineGap(poly, c.part, half)); } return g; };
  const podLine = { points: pod.path.map((p) => [p[0], p[2]]) };                                                   // nothing is scattered under the pod's lane
  const loopClosed = centre;
  /** May this footprint stand here? `o`: gaps to keep from solids, roads and paths; `land` = metres back from the water;
      `lane` = keep out of the metro corridor; `plots` = keep off plots and squares. */
  const fits = (poly, o = {}) => {
    const bb = bbox(poly); const pad = 12;
    for (const p of poly) { if (!pointInPoly(p, coast)) return false; if (o.land && shoreDistance(p[0], p[1]) < o.land) return false; if (o.flat && !buildable(p[0], p[1], 0.5)) return false; if (o.lane !== false && laneDistance(p) < M.corridor + 0.5) return false; }
    for (const s of solids) { if (s.bb[2] < bb[0] - pad || s.bb[0] > bb[2] + pad || s.bb[3] < bb[1] - pad || s.bb[1] > bb[3] + pad) continue; if (polyGap(poly, s.poly) < (o.solid == null ? 1 : o.solid)) return false; }
    if (o.plots !== false) for (const s of noGo) { if (o.allow && o.allow === s.use) continue; if (s.bb[2] < bb[0] - 3 || s.bb[0] > bb[2] + 3 || s.bb[3] < bb[1] - 3 || s.bb[1] > bb[3] + 3) continue; if (polyGap(poly, s.poly) < 0.6) return false; }
    if (lineGap(poly, bb, podLine, 0, 7) < 5.5) return false;
    for (const r of roads) if (lineGap(poly, bb, r, r.width / 2, 8) < (o.road == null ? 0.8 : o.road)) return false;
    for (const r of paths) if (lineGap(poly, bb, r, r.width / 2, 5) < (o.path == null ? 0.4 : o.path)) return false;
    return true;
  };
  const put = (model, p, rot, more, o) => { const d = def(model); if (!d) return null; const pl = { model, x: R2(p[0]), z: R2(p[1]), rot: Math.round(rot * 1e5) / 1e5, scale: (more && more.scale) || 1, ...more }; const poly = pl.kind === 'tree' ? treeDisc(pl, d) : footprint(pl, d); if (!fits(poly, o)) return null; placements.push(pl); solid(poly, pl.kind); return pl; };

  /* ---------- street lamps: along the coast road and the streets, never on a junction ---------- */
  const junctions = (() => { const seen = new Map(); for (const r of roads) r.points.forEach((p, i) => { if (r.closed && i === r.points.length - 1) return; const k = key(p); seen.set(k, (seen.get(k) || 0) + 1); }); return [...seen].filter(([, n]) => n > 1).map(([k]) => k.split(',').map(Number)); })();
  for (const r of roads) {
    if (r.kind === 'lane') continue; const L = lineLength(r.points); const gap = r.kind === 'coast' ? 30 : r.kind === 'hill' ? 44 : 24; let side = 1;
    for (let s = gap / 2; s < L - 6; s += gap) { const q = along(r.points, s); if (junctions.some((j) => dist(j, q.p) < 9)) continue; const n = right(q.d);
      for (const sd of [side, -side]) { const at = add(q.p, mul(n, sd * (r.width / 2 + 0.7))); if (put('streetlamp', at, rotOf(mul(n, -sd)), { kind: 'lamp', road: r.id }, { solid: 0.5, road: -0.2, path: 0.3, land: 2, lane: true })) break; } side = -side; }
  }

  /* ---------- benches: in the squares and along the promenade, facing the open side ---------- */
  for (const town of towns) { const lay = LAYOUT[town.key], f = FRAMES[town.key]; if (!lay.square) continue; const [u0, u1, v0, v1] = lay.square;
    for (const [u, v, dir] of [[u0 + 7, v0 + 6, f.u], [u1 - 7, v0 + 6, mul(f.u, -1)], [u0 + 7, v1 - 5, f.u], [u1 - 7, v1 - 5, mul(f.u, -1)]]) put('bench', f.L(u, v), rotOf(dir), { kind: 'bench', town: town.id }, { plots: false, solid: 0.6 });
    for (const [u, v] of [[u0 + 3.5, v0 + 12], [u1 - 3.5, v0 + 12], [u0 + 3.5, v1 - 3], [u1 - 3.5, v1 - 3]]) put('tree_c', f.L(u, v), 0, { kind: 'tree', scale: 0.62, town: town.id }, { plots: false, solid: 0.5 });
    (lay.gardens || []).forEach((g) => { for (const [a, b] of [[0.3, 0.3], [0.72, 0.62], [0.3, 0.82]]) put(a > 0.5 ? 'tree_a' : 'tree_c', f.L(g[0] + (g[1] - g[0]) * a, g[2] + (g[3] - g[2]) * b), 0, { kind: 'tree', scale: 0.7, town: town.id }, { plots: false, solid: 0.5 }); });
  }
  for (const id of ['promenade-north', 'promenade-south', 'boardwalk']) { const p = paths.find((q) => q.id === id); const L = lineLength(p.points);
    for (let s = 20; s < L - 10; s += 46) { const q = along(p.points, s); const sea = mul(right(q.d), -1); put('bench', add(q.p, mul(sea, -(p.width / 2 + 0.8))), rotOf(sea), { kind: 'bench' }, { solid: 0.5, road: 0.5, land: 1, lane: true, allow: 'beach' }); } }
  for (const c of closeList) { put('bench', add(c.green, mul(c.d, 2.2)), rotOf(mul(c.d, -1)), { kind: 'bench', town: c.town.id }, { plots: false, solid: 0.5 }); put('tree_c', add(c.green, mul(right(c.d), 3)), 0, { kind: 'tree', scale: 0.6, town: c.town.id }, { plots: false, solid: 0.5 }); }

  /* ---------- the beach: a row of umbrellas along the sand, a sunbed either side of each, palms by the boardwalk ---------- */
  { const bw = paths.find((p) => p.id === 'boardwalk'); const L = lineLength(bw.points); const want = (LIFE.beach && LIFE.beach.umbrellas) || 14; const sand = [];
    for (let s = 6; s < L - 6; s += 2) { const q = along(bw.points, s); const sea = mul(right(q.d), -1); const at = add(q.p, mul(sea, bw.width / 2 + 5)); if (shoreDistance(at[0], at[1]) >= 8.5) sand.push({ s, q, sea, at }); }   // where the sand is wide enough
    const step = Math.max(4, Math.floor(sand.length / want)); let done = 0;
    for (let k = Math.floor(step / 2); k < sand.length && done < want; k += step) { const { q, sea, at } = sand[k]; const rot = rotOf(sea);
      if (!put('umbrella', at, rot, { kind: 'beach', town: townByKey.beach.id }, { allow: 'beach', solid: 0.6, land: 4, lane: true })) continue; done++;
      for (const sd of [1, -1]) put('sunbed', add(at, mul(q.d, sd * 3)), Math.atan2(-sea[1], sea[0]), { kind: 'beach', town: townByKey.beach.id }, { allow: 'beach', solid: 0.3, land: 3, lane: true }); }
    for (let s = 12; s < L - 8; s += 21) { const q = along(bw.points, s); const sea = mul(right(q.d), -1); put('palm', add(q.p, mul(sea, bw.width / 2 + 13.5)), R2(rand() * 6.28), { kind: 'tree', scale: 0.8, town: townByKey.beach.id }, { allow: 'beach', solid: 0.6, land: 3 }); } }

  /* ---------- boats: moored in the bay, at the fishers' quay and off the beach; the ferry at its jetty ---------- */
  const afloat = (model, p, rot, more = {}) => { const d = def(model); if (!d) return; const pl = { model, x: R2(p[0]), z: R2(p[1]), rot: Math.round(rot * 1e5) / 1e5, scale: 1, kind: 'boat', water: true, ...more }; placements.push(pl); solid(footprint(pl, d), 'boat'); return pl; };
  const headingOf = (d) => Math.atan2(-d[1], d[0]);                       // a boat lies along its +X
  const B = LIFE.boats || { sail: 5, fishing: 3, ferry: 1 };
  if (B.ferry) afloat('ferry', hb(-15.6, -98), headingOf(mul(HB.v, -1)), { moored: 'ferry jetty' });
  [[8, 64], [27, 62], [17, 80]].slice(0, B.sail).forEach(([u, w], k) => afloat('boat_sail', hb(u, -w), headingOf(HB.u) + (k - 1) * 0.25, { moored: 'bay' }));
  [[-56, 58.5], [-74, 58.2], [-92, 57.6]].slice(0, B.fishing).forEach(([u, w]) => afloat('boat_fishing', hb(u, -w), headingOf(HB.u), { moored: "fishers' quay" }));
  { const BF = FRAMES.beach; [[-30, 46], [34, 54]].slice(0, Math.max(0, (B.sail || 0) - 3)).forEach(([u, out], k) => { let w = 0; while (w < 200 && pointInPoly(BF.L(u, -(w + 0.5)), coast)) w += 0.5; afloat('boat_sail', BF.L(u, -(w + out)), headingOf(BF.u) + 0.4 * (k ? 1 : -1), { moored: 'off the beach' }); }); }

  /* ---------- trees ---------- */
  const wantTrees = Math.min(LIFE.trees || 400, 520); const treeNames = ['tree_a', 'tree_b', 'tree_c', 'tree_pine'].filter(def);
  const treePts = []; const treeAt = (model, p, scale, more, o) => { for (const t of treePts) if (dist(t, p) < 5.2) return null; const pl = put(model, p, R2(rand() * 6.28), { kind: 'tree', scale: R2(scale), ...more }, { solid: 0.8, road: 0.7, path: 0.5, land: 3, ...o }); if (pl) treePts.push(p); return pl; };
  for (const pl of placements) if (pl.kind === 'tree') treePts.push([pl.x, pl.z]);
  // orchards in the green belt
  FARMS.forEach(([x0, z0, x1, z1, rotDeg = 0], k) => { const c = [(x0 + x1) / 2, (z0 + z1) / 2]; const a = (rotDeg * Math.PI) / 180; const ux = [Math.cos(a), Math.sin(a)], uz = [-Math.sin(a), Math.cos(a)]; const w = x1 - x0, d = z1 - z0;
    zone(`farm-${k + 1}`, null, 'farm', [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([p, q]) => add(c, add(mul(ux, p), mul(uz, q)))), { label: 'Orchard' });
    for (let p = -w / 2 + 5; p <= w / 2 - 5; p += 9.5) for (let q = -d / 2 + 5; q <= d / 2 - 5; q += 9.5) treeAt('tree_c', add(c, add(mul(ux, p), mul(uz, q))), 0.58, { grove: 'orchard' }, { flat: true }); });
  // the forest on the hill
  { let tries = 0; const want = Math.round(wantTrees * 0.36); let got = 0; while (got < want && tries++ < want * 30) { const a = rand() * 6.28319, q = Math.sqrt(0.2 + rand() * 0.8); const p = [H.x + H.a * 0.97 * q * Math.cos(a), H.z + H.b * 0.97 * q * Math.sin(a)]; const amt = hillAmount(p[0], p[1]); if (amt <= 0 || amt >= 1) continue; const high = amt > 0.55; if (treeAt(high ? (rand() < 0.7 ? 'tree_pine' : 'tree_b') : treeNames[Math.floor(rand() * treeNames.length)], p, 0.8 + rand() * 0.35, { grove: 'hill' }, { path: 0.8 })) got++; } }
  // the green belt: clumps of trees wherever the land is open
  { let tries = 0; while (treePts.length < wantTrees && tries++ < 900) { const c = [-290 + rand() * 580, -215 + rand() * 430]; if (!pointInPoly(c, coast) || hillAmount(c[0], c[1]) > 0) continue; const n = 3 + Math.floor(rand() * 5);
      for (let k = 0; k < n && treePts.length < wantTrees; k++) { const a = rand() * 6.28319, r = k ? 5 + rand() * 13 : 0; treeAt(treeNames[Math.floor(rand() * treeNames.length)], [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)], 0.75 + rand() * 0.4, { grove: 'belt' }); } } }

  /* ---------- walking routes: from the station's entrance to each project's door ---------- */
  const graph = new Map(); const node = (p) => { const k = key(p); if (!graph.has(k)) graph.set(k, { p, e: [] }); return graph.get(k); };
  for (const r of [...roads, ...paths]) for (let i = 0; i < r.points.length - 1; i++) { const a = node(r.points[i]), b = node(r.points[i + 1]); if (a === b) continue; const w = dist(a.p, b.p) * (r.kind === 'coast' ? 1.15 : 1); a.e.push([b, w]); b.e.push([a, w]); }
  const route = (from, goals) => {
    const start = graph.get(key(from)); if (!start) return null; const want = new Set(goals.map(key)); const distTo = new Map([[start, 0]]), prev = new Map(); const open = [[0, start]];
    while (open.length) { let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i; const [d, n] = open.splice(bi, 1)[0]; if (d > (distTo.get(n) ?? Infinity)) continue;
      if (want.has(key(n.p))) { const out = [n.p]; let c = n; while (prev.has(c)) { c = prev.get(c); out.push(c.p); } return out; }
      for (const [m, w] of n.e) { const nd = d + w; if (nd < (distTo.get(m) ?? Infinity)) { distTo.set(m, nd); prev.set(m, n); open.push([nd, m]); } } }
    return null;
  };
  const tidy = (line) => { const keep = new Array(line.length).fill(false); keep[0] = keep[line.length - 1] = true; const stack = [[0, line.length - 1]];          // drop points that add less than 5 cm (Douglas-Peucker)
    while (stack.length) { const [a, b] = stack.pop(); let worst = 0, wi = -1; for (let i = a + 1; i < b; i++) { const d = distToSeg(line[i], line[a], line[b]); if (d > worst) { worst = d; wi = i; } } if (worst > 0.05) { keep[wi] = true; stack.push([a, wi], [wi, b]); } }
    return line.filter((_, i) => keep[i]); };
  const walks = {};
  for (const town of towns) for (const id of town.projects) {
    const pr = projects[id]; const r = route(pr.door, town.main ? town.station.exits.map((e) => e.at) : [town.station.exits[0].at]);      // from the entrance (the main station has doors on both sides); searched from the door, so the list runs station → door
    if (!r) { problems.push(`no walking route from ${town.name} station to ${id}`); continue; } walks[id] = tidy(r);
  }

  /* ---------- things that move: where they start and where they may go ---------- */
  const A = LIFE.animals || { gulls: 14, dolphins: 3, sheep: 9, deer: 4, dogs: 3 };
  const spawns = {
    cars: { count: LIFE.cars || 34, models: ['car_a', 'car_b', 'car_c'].filter(def), roads: roads.filter((r) => r.kind !== 'lane').map((r) => r.id) },
    buses: { count: 2, model: 'bus', route: 'coast', stops: towns.map((t) => { const f = FRAMES[t.key]; const pr = project(coastRoad.points, f.L(t.main ? 52 : 0, t.main ? 28 : 0)); return { town: t.id, at: P(...pr.q) }; }) },
    boats: { ferry: { route: [hb(-15.6, -98), hb(-10, -150), hb(60, -260), hb(-10, -150)].map((p) => P(...p)) }, sail: { area: { centre: P(...FRAMES.beach.L(0, -150)), radius: 90 } }, fishing: { area: { centre: P(...hb(-120, -150)), radius: 70 } } },
    animals: [
      { model: 'gull', count: A.gulls || 0, areas: [{ centre: P(...hb(10, -80)), radius: 70, y: [12, 40] }, { centre: P(...FRAMES.beach.L(0, -50)), radius: 80, y: [10, 35] }, { centre: [lighthouse.x, lighthouse.z], radius: 45, y: [20, 45] }] },
      { model: 'dolphin', count: A.dolphins || 0, areas: [{ centre: P(...FRAMES.beach.L(-20, -140)), radius: 60 }] },
      { model: 'sheep', count: A.sheep || 0, areas: townByKey.next ? [] : MEADOWS.sheep.map((m) => ({ centre: m.slice(0, 2), radius: m[2] })) },
      { model: 'deer', count: A.deer || 0, areas: MEADOWS.deer.map((m) => ({ centre: m.slice(0, 2), radius: m[2] })) },
      { model: 'dog', count: A.dogs || 0, areas: towns.filter((t) => t.square).slice(0, 3).map((t) => { const c = t.square.reduce((a, p) => add(a, p), [0, 0]); return { centre: P(c[0] / t.square.length, c[1] / t.square.length), radius: 12 }; }) },
    ],
  };

  for (const r of [...roads, ...paths]) delete r.chunks;
  const count = (k) => placements.filter((p) => p.kind === k).length;
  return {
    version: 1, scale: S, plateau: Y0,
    island: { coast, quay, hill: { ...H }, width: R2(Math.max(...coast.map((p) => p[0])) - Math.min(...coast.map((p) => p[0]))), depth: R2(Math.max(...coast.map((p) => p[1])) - Math.min(...coast.map((p) => p[1]))) },
    towns: towns.map((t) => ({ id: t.id, code: t.code, name: t.name, district: t.district, main: t.main, station: t.station, square: t.square, projects: t.projects })),
    nextTown: townByKey.next ? null : { station: { x: R2(FRAMES.next.o[0]), z: R2(FRAMES.next.o[1]), rot: R2(rotOf(FRAMES.next.v)) }, site: NEXT_SITE },
    metro, pod, roads, paths, zones, lots, placements, walks, projects, spawns,
    counts: { towns: towns.length, roads: roads.length, paths: paths.length, lots: lots.length, placements: placements.length, buildings: count('building'), houses: count('house'), trees: count('tree'), lamps: count('lamp'), benches: count('bench'), boats: count('boat'), gates: count('gate') },
    problems,
  };
}

/** The canopy of a tree as a small polygon (trees are tested as discs, not boxes). */
export function treeRadius(def, scale = 1) { return 0.42 * Math.max(def.size[0], def.size[2]) * scale; }
export function treeDisc(pl, def) { const r = treeRadius(def, pl.scale || 1); return Array.from({ length: 10 }, (_, k) => P(pl.x + r * Math.cos(k * 0.628319), pl.z + r * Math.sin(k * 0.628319))); }
