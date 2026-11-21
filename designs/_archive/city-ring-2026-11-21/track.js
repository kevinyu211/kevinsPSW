/* Island city · the line, measured
   The loop and the hill tram as distances in metres, so the train, the camera, the line strip and the 2D map
   all agree on where things are. Pure maths on top of city-data.js: nothing here draws. */
import { LOOP, TOWER, STOPS, stopAngle, loopPoint, loopTangent, height } from './city-data.js';

const N = 1440; // samples round the loop
const cum = new Float32Array(N + 1);
{ let prev = loopPoint(LOOP.mainAngle); for (let i = 1; i <= N; i++) { const p = loopPoint(LOOP.mainAngle + (360 * i) / N); cum[i] = cum[i - 1] + Math.hypot(p.x - prev.x, p.z - prev.z); prev = p; } }

/** Length of the loop in metres. */
export const LOOP_LEN = cum[N];
export const wrap = (s) => ((s % LOOP_LEN) + LOOP_LEN) % LOOP_LEN;
/** The shorter signed way from a to b round the loop. */
export const shortWay = (a, b) => { let d = wrap(b - a); if (d > LOOP_LEN / 2) d -= LOOP_LEN; return d; };

/** Distance along the loop of a loop angle (degrees). 0 at the main station, rising the way the train runs. */
export function sOfAngle(a) {
  const f = ((((a - LOOP.mainAngle) % 360) + 360) % 360) / 360 * N; const i = Math.floor(f);
  return cum[i] + (cum[Math.min(N, i + 1)] - cum[i]) * (f - i);
}
/** The loop angle (degrees) at distance s. */
export function angleOfS(s) {
  const w = wrap(s); let lo = 0; let hi = N;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= w) lo = mid; else hi = mid; }
  const span = cum[hi] - cum[lo] || 1;
  return LOOP.mainAngle + ((lo + (w - cum[lo]) / span) * 360) / N;
}
/* The loop as drawn on the plan: a plain ellipse. Roads and streets follow this. */
function curveAt(s) {
  const a = angleOfS(s); const p = loopPoint(a); const t = loopTangent(a);
  return { a, x: p.x, z: p.z, tx: t.x, tz: t.z };
}
/* Stations are straight, so the track runs straight through each one: a chord of the curve as long as the
   station, eased back into the curve over EASE metres at each end. */
const HALF = { main: 31, stop: 21 }; const EASE = 9.5; // short enough that two neighbouring stations never overlap
const ease01 = (u) => { const k = Math.max(0, Math.min(1, u)); return k * k * (3 - 2 * k); };
let STRAIGHT = null;
function pointAt(s) {
  const c = curveAt(s); if (!STRAIGHT) return c;
  for (const st of STRAIGHT) {
    const d = shortWay(st.s, wrap(s)); const ad = Math.abs(d); if (ad >= st.h + EASE) continue;
    const u = (d + st.h) / (2 * st.h); const lx = st.ax + (st.bx - st.ax) * u; const lz = st.az + (st.bz - st.az) * u; // on the chord, or on its line beyond the ends
    const k = ad <= st.h ? 1 : 1 - ease01((ad - st.h) / EASE);
    return { a: c.a, x: c.x + (lx - c.x) * k, z: c.z + (lz - c.z) * k };
  }
  return c;
}
/** Where the track is at distance s: position, the way the train runs (tx, tz) and the way to the hill (nx, nz). */
export function trackAt(s) {
  const p = pointAt(s); const q0 = pointAt(s - 0.6); const q1 = pointAt(s + 0.6);
  let tx = q1.x - q0.x; let tz = q1.z - q0.z; const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
  let nx = -tz; let nz = tx; if (nx * -p.x + nz * -p.z < 0) { nx = -nx; nz = -nz; }
  return { a: p.a, x: p.x, z: p.z, tx, tz, nx, nz };
}

/** Every place the line calls at, in order: the main station first, then the stops. */
export const PLACES = [{ id: 'main', i: -1, angle: LOOP.mainAngle, s: 0 }, ...STOPS.map((st, i) => ({ id: st.id, i, angle: stopAngle(i), s: sOfAngle(stopAngle(i)) }))];
export const placeById = Object.fromEntries(PLACES.map((p) => [p.id, p]));
STRAIGHT = PLACES.map((p) => { const h = p.id === 'main' ? HALF.main : HALF.stop; const A = curveAt(p.s - h); const B = curveAt(p.s + h); return { s: p.s, h, ax: A.x, az: A.z, bx: B.x, bz: B.z }; });
/** How long the straight piece of track at a place is, each side of its middle. */
export const straightHalf = (id) => (id === 'main' ? HALF.main : HALF.stop);

/* The hill tram: a straight line from the back of the main station up the hill to the foot of the tower. */
export const TRAM = { x: TOWER.x, z0: LOOP.rz - 19, z1: TOWER.z + 33 };
export const TRAM_LEN = Math.abs(TRAM.z0 - TRAM.z1);
/** Where the tram is at u (0 = main station, 1 = the tower), with the slope of the hill under it. */
export function tramAt(u) {
  const z = TRAM.z0 + (TRAM.z1 - TRAM.z0) * u; const y = height(TRAM.x, z); const y2 = height(TRAM.x, z - 1);
  return { x: TRAM.x, y, z, slope: Math.atan2(y2 - y, 1) };
}
