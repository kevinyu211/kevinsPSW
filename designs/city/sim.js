/* Island city · the trains and the tram, as pure logic
   The metro is one loop with two tracks. Trains run all the time by themselves: clockwise on the inner track,
   anticlockwise on the outer one. Each brakes smoothly into every station, stops with its doors at the
   platform gates, waits, and leaves. A ride borrows the train that will reach the wanted station soonest: it
   runs there a little faster (still calling briefly at any station on the way), then waits until released.
   The hill tram is a funicular: two cars on one track that pass in the middle.
   Nothing here draws: the 3D city, the 2D map and the line strip read `trains` and `tram` after advance(). */
import { LOOP } from './city-data.js';
import { PLACES, placeById, LOOP_LEN, wrap, ahead } from './track.js';

const smoother = (p) => p * p * p * (p * (p * 6 - 15) + 10);
export const DWELL = 7; const RUN = (d) => 5 + d / 15; const TRAM_RUN = 14; const TRAM_DWELL = 8;

export function createSim() {
  const n = PLACES.length; const trains = [];
  for (const dir of [1, -1]) for (let k = 0; k < LOOP.trainsEachWay; k++) {
    const at = (k * Math.floor(n / LOOP.trainsEachWay) + (dir > 0 ? 0 : 2)) % n;
    trains.push({ id: `${dir > 0 ? 'cw' : 'acw'}${k + 1}`, dir, s: PLACES[at].s, v: 0, at: PLACES[at].id, to: null, mode: 'idle', dwell: 2 + k * 2 + (dir > 0 ? 0 : 3), move: null, doors: 0, plan: null });
  }
  const tram = { u: 0, v: 0, dir: 1, move: null, dwell: 4, mode: 'idle', doors: 0 };
  const idx = (id) => PLACES.findIndex((p) => p.id === id);
  const nextOf = (t, from) => PLACES[(idx(from) + t.dir + n) % n].id;
  // a move of length D (always forwards) lasting T: eases in and out, fastest in the middle. v0 keeps the speed
  // the train already has, so taking a train over never jerks it.
  const start = (t, D, T, v0 = 0) => { t.move = { p0: t.s, D: D * t.dir, T: Math.max(0.05, T), t: 0, v0 }; };
  const step = (o, key, dt) => { const m = o.move; m.t = Math.min(m.T, m.t + dt); const p = m.t / m.T; const was = o[key]; o[key] = m.p0 + m.D * smoother(p) + m.v0 * m.t * (1 - p) * (1 - p); o.v = dt > 0 ? (o[key] - was) / dt : 0; if (p >= 1) { o.move = null; o.v = 0; return true; } return false; };
  const leader = (t) => { let best = Infinity; for (const o of trains) if (o !== t && o.dir === t.dir) best = Math.min(best, ahead(t.s, o.s, t.dir)); return best; };

  function advance(dt) {
    for (const t of trains) {
      if (t.move) {
        if (step(t, 's', dt)) {
          t.s = wrap(t.s); t.at = t.to; t.to = null;
          if (t.mode === 'idle') t.dwell = DWELL; else if (t.plan && t.plan.length) t.dwell = 0.9; else { t.mode = 'hold'; t.plan = null; }
        }
      } else if (t.mode === 'idle') {
        t.dwell -= dt;
        if (t.dwell <= 0) { if (leader(t) < LOOP_LEN * 0.3) t.dwell = 1.5; else { const to = nextOf(t, t.at); const D = ahead(t.s, placeById[to].s, t.dir); t.to = to; t.at = null; start(t, D, RUN(D)); } } // keep the trains evenly spaced
      } else if (t.mode === 'ride') {
        t.dwell -= dt; if (t.dwell <= 0 && t.plan && t.plan.length) { const hop = t.plan.shift(); t.to = hop.to; t.at = null; start(t, ahead(t.s, placeById[hop.to].s, t.dir), hop.T); }
      } else if (t.mode === 'hold' && t.release != null) { t.release -= dt; if (t.release <= 0) { t.release = null; t.mode = 'idle'; t.dwell = 1.5; } }
      const open = !t.move && t.at && (t.mode === 'hold' || (t.mode === 'idle' && t.dwell > 0.6 && t.dwell < DWELL - 0.6));
      t.doors += ((open ? 1 : 0) - t.doors) * Math.min(1, dt * 4);
    }
    if (tram.move) { if (step(tram, 'u', dt)) { tram.u = tram.u > 0.5 ? 1 : 0; if (tram.mode === 'idle') tram.dwell = TRAM_DWELL; else tram.mode = 'hold'; } } else if (tram.mode === 'idle') {
      tram.dwell -= dt; if (tram.dwell <= 0) { tram.dir = tram.u > 0.5 ? -1 : 1; tram.move = { p0: tram.u, D: tram.dir, T: TRAM_RUN, t: 0, v0: 0 }; }
    } else if (tram.mode === 'hold' && tram.release != null) { tram.release -= dt; if (tram.release <= 0) { tram.release = null; tram.mode = 'idle'; tram.dwell = 2; } }
    tram.doors += ((!tram.move ? 1 : 0) - tram.doors) * Math.min(1, dt * 4);
  }

  /** How far a train still has to run to reach a station (0 when it is standing there). */
  const toGo = (t, id) => (t.at === id && !t.move ? 0 : ahead(t.s, placeById[id].s, t.dir));
  /** The train that can be at a station soonest, either way round. */
  const nearest = (id) => trains.reduce((b, t) => (!b || toGo(t, id) < toGo(b, id) ? t : b), null);
  /** Send a train on to a station within about T seconds, calling briefly at any station on the way. */
  function rideTo(t, id, T) {
    const D = toGo(t, id); t.release = null; if (D < 1) { t.mode = 'hold'; t.plan = null; return 0; }
    const stops = []; let from = t.to || t.at; // where it is, or is already heading
    if (t.move) stops.push(t.to); while (stops[stops.length - 1] !== id && stops.length < n + 1) { from = nextOf(t, stops.length ? stops[stops.length - 1] : from); stops.push(from); }
    let at = t.s; const hops = stops.map((to) => { const d = ahead(at, placeById[to].s, t.dir); at = placeById[to].s; return { to, d }; });
    const w = hops.reduce((a, h) => a + Math.max(20, h.d) ** 0.6, 0); const run = Math.max(2, T - 0.9 * (hops.length - 1)); hops.forEach((h) => { h.T = Math.max(1.6, (run * Math.max(20, h.d) ** 0.6) / w); });
    const total = hops.reduce((a2, h) => a2 + h.T, 0) + 0.9 * (hops.length - 1);
    t.mode = 'ride'; t.plan = hops; t.dwell = 0; const first = t.plan.shift(); const v0 = t.move ? t.v : 0; t.to = first.to; t.at = null; start(t, first.d, first.T, v0);
    return total;
  }
  /** Put a train at a station at once (reduced motion, deep links, Skip). The nearest one is used. */
  function putAt(id) { const t = nearest(id); t.s = placeById[id].s; t.v = 0; t.move = null; t.plan = null; t.at = id; t.to = null; t.mode = 'hold'; t.release = null; return t; }
  /** Let held trains (and the tram) go back to running by themselves after `delay` seconds. */
  function release(delay = 4) { for (const t of trains) if (t.mode === 'hold' && t.release == null) t.release = delay; if (tram.mode === 'hold') tram.release = delay; }
  /** When each service next calls at a station, in seconds (an estimate from where the trains are). */
  function nextAt(id) { const out = {}; for (const t of trains) { const D = toGo(t, id); let eta = 0; if (D > 0) { let d = D; let from = t.s; if (t.move) { const rem = Math.abs(placeById[t.to].s - t.s) < 1 ? 0 : t.move.T - t.move.t; eta += rem; d -= ahead(t.s, placeById[t.to].s, t.dir); from = placeById[t.to].s; if (t.to !== id) eta += DWELL; } else eta += Math.max(0, t.dwell); let cur = t.move ? t.to : t.at; while (d > 1 && cur !== id) { const nx = nextOf(t, cur); const dd = ahead(from, placeById[nx].s, t.dir); eta += RUN(dd) + (nx === id ? 0 : DWELL); d -= dd; from = placeById[nx].s; cur = nx; } } const k = t.dir > 0 ? 'cw' : 'acw'; if (out[k] == null || eta < out[k]) out[k] = eta; (out[`${k}All`] = out[`${k}All`] || []).push(eta); } if (out.cwAll) out.cwAll.sort((a, b) => a - b); if (out.acwAll) out.acwAll.sort((a, b) => a - b); return out; }
  /** The tram: which car is going up next, and send it up within T seconds. Car +1 starts at the bottom. */
  function tramUp(T) { tram.mode = 'ride'; tram.release = null; if (tram.move) { const car = tram.dir > 0 ? 1 : -1; const left = tram.move.T - tram.move.t; if (left > T) { tram.move = { p0: tram.u, D: (tram.dir > 0 ? 1 : 0) - tram.u, T, t: 0, v0: tram.v }; } return car; } const car = tram.u < 0.5 ? 1 : -1; tram.dir = tram.u < 0.5 ? 1 : -1; tram.move = { p0: tram.u, D: tram.dir, T, t: 0, v0: 0 }; return car; }
  function tramPut(carAtTop) { tram.u = carAtTop > 0 ? 1 : 0; tram.v = 0; tram.move = null; tram.mode = 'hold'; tram.release = null; }
  /** Where car `c` (+1 or −1) of the tram is: 0 = Harbour, 1 = Tower. */
  const tramU = (c) => (c > 0 ? tram.u : 1 - tram.u);
  return { trains, tram, advance, toGo, nearest, rideTo, putAt, release, nextAt, tramUp, tramPut, tramU, LOOP_LEN };
}
