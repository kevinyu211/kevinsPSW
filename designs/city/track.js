/* Island city · the lines, measured
   The metro loop (two lanes) and the hill pod line as distances in metres, so the trains, the camera, the
   line strip and the 2D map all agree on where things are. Pure maths on the town plan (layout.js): the lanes'
   centreline, its stations and the pod's path all come from there; nothing here draws.

   Distance s runs clockwise from the main station. The clockwise trains fly the inner lane and the
   anticlockwise trains the outer one, so every train keeps to the right. */
import { TOWNS } from './city-data.js';
import { LAYOUT } from './layout.js';

const M = LAYOUT.metro; const GAUGE = M.gauge || 4.2;
/* the centreline as a closed polyline with its running length */
const C = M.centre.map(([x, z]) => ({ x, z })); if (C.length > 2 && Math.hypot(C[0].x - C[C.length - 1].x, C[0].z - C[C.length - 1].z) < 0.01) C.pop();
const N = C.length; const cum0 = new Float64Array(N + 1); for (let i = 1; i <= N; i++) { const a = C[i - 1]; const b = C[i % N]; cum0[i] = cum0[i - 1] + Math.hypot(b.x - a.x, b.z - a.z); }
const LEN = cum0[N];
/** The plan's own distance round the loop of the nearest point to (x, z). */
function sOnLoop(x, z) { let best = Infinity; let s = 0; for (let i = 0; i < N; i++) { const a = C[i]; const b = C[(i + 1) % N]; const dx = b.x - a.x; const dz = b.z - a.z; const l2 = dx * dx + dz * dz || 1e-9; const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2)); const d = Math.hypot(a.x + dx * t - x, a.z + dz * t - z); if (d < best) { best = d; s = cum0[i] + Math.sqrt(l2) * t; } } return s; }
const MAIN = (TOWNS.find((t) => t.main) || TOWNS[0]).id;
const mainSt = M.stations.find((q) => q.town === MAIN) || M.stations[0]; const S0 = sOnLoop(mainSt.x, mainSt.z);
/* is the plan's line drawn clockwise (with rising s)? Its stations say which way clockwise trains head */
const DIRK = (() => { const q = mainSt; const i = Math.floor(((S0 % LEN) / LEN) * N); const a = C[i % N]; const b = C[(i + 1) % N]; return (b.x - a.x) * q.dir[0] + (b.z - a.z) * q.dir[1] >= 0 ? 1 : -1; })();

/** Length of the loop in metres. */
export const LOOP_LEN = LEN;
export const wrap = (s) => ((s % LOOP_LEN) + LOOP_LEN) % LOOP_LEN;
/** The shorter signed way from a to b round the loop. */
export const shortWay = (a, b) => { let d = wrap(b - a); if (d > LOOP_LEN / 2) d -= LOOP_LEN; return d; };
/** How far ahead b is from a for a train running in direction dir (+1 clockwise, −1 anticlockwise). */
export const ahead = (a, b, dir) => wrap((b - a) * dir);
const planS = (s) => wrap(S0 + DIRK * s); // our s (clockwise from the main station) to the plan's
function mid(s) { const w = planS(s); let lo = 0; let hi = N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum0[m] <= w) lo = m; else hi = m; } const a = C[lo % N]; const b = C[(lo + 1) % N]; const f = (w - cum0[lo]) / (cum0[lo + 1] - cum0[lo] || 1); return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f }; }

/** Every station on the loop, clockwise from the main station. */
export const PLACES = M.stations.map((q) => { const t = TOWNS.find((x) => x.id === q.town) || {}; return { id: q.town, code: q.code || t.code, s: wrap(DIRK * (sOnLoop(q.x, q.z) - S0)), x: q.x, z: q.z }; }).sort((a, b) => a.s - b.s).map((p, i) => ({ ...p, i }));
export const placeById = Object.fromEntries(PLACES.map((p) => [p.id, p]));
/** Half the straight run through a station (the plan keeps 70 m straight at every one). */
export const STRAIGHT = (LAYOUT.metro && 35) || 30;

/** Where the line is at distance s. lane: 0 = between the lanes, +1 = the inner (clockwise) lane,
    −1 = the outer (anticlockwise) lane. Returns the position, the clockwise direction (tx, tz) and the way
    inland (nx, nz: to the right of a clockwise train). */
export function trackAt(s, lane = 0) {
  const p = mid(s); const q0 = mid(s - 1.2); const q1 = mid(s + 1.2);
  let tx = q1.x - q0.x; let tz = q1.z - q0.z; const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L; const nx = -tz; const nz = tx; const o = (lane * GAUGE) / 2;
  return { x: p.x + nx * o, z: p.z + nz * o, tx, tz, nx, nz };
}
/** The lane a train running in direction dir uses. */
export const laneOf = (dir) => (dir > 0 ? 1 : -1);
export const sOfPoint = (x, z) => wrap(DIRK * (sOnLoop(x, z) - S0));

/* The hill pod: two pods on one lane that pass in the middle, from the Harbour station's pod platform up to
   the tower. Its path (with the height of the lane above the sea) is the plan's. */
const PP = LAYOUT.pod.path.map(([x, y, z]) => ({ x, y, z })); const pc = [0]; for (let i = 1; i < PP.length; i++) pc.push(pc[i - 1] + Math.hypot(PP[i].x - PP[i - 1].x, PP[i].z - PP[i - 1].z));
export const TRAM_LEN = pc[pc.length - 1];
const podAt = (d) => { d = Math.max(0, Math.min(TRAM_LEN, d)); let i = 1; while (i < pc.length - 1 && pc[i] < d) i++; const a = PP[i - 1]; const b = PP[i]; const f = (d - pc[i - 1]) / (pc[i] - pc[i - 1] || 1); return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f }; };
const first = PP[0]; const last = PP[PP.length - 1];
/** The pod line's two ends and its overall direction (for things that face along it). */
export const TRAM = { x0: first.x, z0: first.z, x1: last.x, z1: last.z, ux: (last.x - first.x) / (Math.hypot(last.x - first.x, last.z - first.z) || 1), uz: (last.z - first.z) / (Math.hypot(last.x - first.x, last.z - first.z) || 1), stops: LAYOUT.pod.stops };
const ease01 = (u) => { const k = Math.max(0, Math.min(1, u)); return k * k * (3 - 2 * k); };
/** Where a pod is. u: 0 = Harbour, 1 = Tower. side: +1 or −1, the branch it takes round the passing place.
    y is the lane's height above the sea (the pod's floor is `floor` above it). */
export function tramAt(u, side = 0) {
  const d = Math.max(0, Math.min(1, u)) * TRAM_LEN; const p = podAt(d); const a = podAt(d - 2.5); const b = podAt(d + 2.5);
  let ux = b.x - a.x; let uz = b.z - a.z; const L = Math.hypot(ux, uz) || 1; ux /= L; uz /= L;
  const w = side * 1.7 * ease01((0.5 - Math.abs(u - 0.5) - 0.28) / 0.12); // only the middle fifth is double
  return { x: p.x - uz * w, y: p.y, z: p.z + ux * w, slope: Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z) || 1), ux, uz };
}
