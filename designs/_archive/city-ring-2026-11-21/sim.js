/* Island city · the train and the tram, as pure logic
   One train runs round the loop by itself, calling at every stop. A ride borrows it: it goes the shorter way
   round to the stop that was asked for, then waits there until it is released. The hill tram shuttles between
   the main station and the tower the same way. Nothing here draws: the 3D city, the 2D map and the line strip
   all read `train` and `tram` after advance(). */
import { PLACES, placeById, LOOP_LEN, TRAM_LEN, wrap, shortWay } from './track.js';

const smoother = (p) => p * p * p * (p * (p * 6 - 15) + 10);

export function createSim() {
  const train = { s: 0, v: 0, at: 'main', next: 0, mode: 'idle', dwell: 2.4, move: null, doors: 0, dir: 1 };
  const tram = { u: 0, v: 0, at: 0, mode: 'idle', dwell: 5, move: null, dir: 1 };

  // a move from p0 by D that takes T seconds: it eases in and out and is fastest in the middle. v0 carries
  // on whatever speed the thing already had, so a redirect never jerks.
  const start = (o, key, D, T, v0 = 0) => { o.move = { p0: o[key], D, T: Math.max(0.01, T), t: 0, v0, key }; };
  const step = (o, dt) => {
    const m = o.move; if (!m) { o.v = 0; return false; }
    m.t = Math.min(m.T, m.t + dt); const p = m.t / m.T; const was = o[m.key];
    o[m.key] = m.p0 + m.D * smoother(p) + m.v0 * m.t * (1 - p) * (1 - p);
    o.v = dt > 0 ? (o[m.key] - was) / dt : 0;
    if (p >= 1) { o.move = null; o.v = 0; return true; }
    return false;
  };

  function advance(dt) {
    // the train
    if (train.move) {
      if (step(train, dt)) {
        train.s = wrap(train.s);
        if (train.mode === 'idle') { train.at = PLACES[train.next].id; train.dwell = 2.6; } else if (train.mode === 'ride') { train.at = train.to; train.mode = 'hold'; }
      }
    } else if (train.mode === 'idle') {
      train.dwell -= dt;
      if (train.dwell <= 0) {
        const i = PLACES.findIndex((p) => p.id === train.at); train.next = (Math.max(0, i) + 1) % PLACES.length;
        const D = wrap(PLACES[train.next].s - wrap(train.s)); train.at = null; train.dir = 1; start(train, 's', D, 3.2 + D / 26);
      }
    } else if (train.mode === 'hold' && train.release != null) {
      train.release -= dt; if (train.release <= 0) { train.release = null; train.mode = 'idle'; train.dwell = 0.4; }
    }
    if (Math.abs(train.v) > 0.5) train.dir = Math.sign(train.v);
    const open = !train.move && train.at && (train.mode !== 'idle' || (train.dwell > 0.35 && train.dwell < 2.3));
    train.doors += ((open ? 1 : 0) - train.doors) * Math.min(1, dt * 5);
    // the tram
    if (tram.move) { if (step(tram, dt)) { tram.u = Math.max(0, Math.min(1, tram.u)); tram.at = tram.u > 0.5 ? 1 : 0; if (tram.mode === 'idle') tram.dwell = 6; else if (tram.mode === 'ride' && tram.then) { const f = tram.then; tram.then = null; f(); } else if (tram.mode === 'ride') tram.mode = 'hold'; } } else if (tram.mode === 'idle') {
      tram.dwell -= dt; if (tram.dwell <= 0) { const to = tram.u > 0.5 ? 0 : 1; start(tram, 'u', to - tram.u, 11); }
    } else if (tram.mode === 'hold' && tram.release != null) { tram.release -= dt; if (tram.release <= 0) { tram.release = null; tram.mode = 'idle'; tram.dwell = 1; } }
    if (Math.abs(tram.v) > 0.001) tram.dir = Math.sign(tram.v);
    tram.doors = (tram.doors || 0) + ((!tram.move && (tram.mode !== 'idle' || (tram.dwell > 0.5 && tram.dwell < 5.5)) ? 1 : 0) - (tram.doors || 0)) * Math.min(1, dt * 5);
  }

  /** How far the train is from a place, the shorter way round (signed metres). */
  const gapTo = (id) => shortWay(wrap(train.s), placeById[id].s);
  /** Send the train to a place in T seconds. */
  function rideTo(id, T) { const D = gapTo(id); train.mode = 'ride'; train.to = id; train.at = null; train.release = null; start(train, 's', D, T, T > 0.5 ? train.v : 0); return D; }
  /** Put the train at a place at once (reduced motion, deep links). */
  function putAt(id) { train.s = placeById[id].s; train.v = 0; train.move = null; train.at = id; train.to = id; train.mode = 'hold'; train.release = null; }
  /** Let the train go back to running by itself after `delay` seconds. */
  function release(delay = 5) { if (train.mode === 'hold') train.release = delay; else if (train.mode === 'ride' && !train.move) { train.mode = 'hold'; train.release = delay; } if (tram.mode === 'hold') tram.release = delay + 2; }
  /** Send the tram to u (0 = main station, 1 = the tower) in T seconds; it then waits there. */
  function tramTo(u, T) { tram.mode = 'ride'; tram.release = null; tram.then = null; start(tram, 'u', u - tram.u, T, 0); }
  /** Keep the tram where it is until it is sent on or set free. */
  function tramHold() { if (!tram.move) { tram.mode = 'hold'; tram.release = null; } }
  /** Let the tram go back to shuttling by itself. */
  function tramFree() { if (tram.mode === 'idle') return; if (tram.move) { tram.mode = 'idle'; tram.dwell = 3; } else { tram.mode = 'hold'; tram.release = 2; } }
  function tramPut(u) { tram.u = u; tram.v = 0; tram.move = null; tram.then = null; tram.at = u > 0.5 ? 1 : 0; tram.mode = 'hold'; tram.release = null; }
  /** Where the train is on the line strip: a place index plus the fraction of the way to the next one. */
  function fraction() {
    const s = wrap(train.s); const n = PLACES.length; let i = n - 1;
    for (let k = 0; k < n; k++) if (PLACES[k].s <= s + 1e-6) i = k;
    const a = PLACES[i].s; const b = i === n - 1 ? LOOP_LEN : PLACES[i + 1].s;
    return { i, f: Math.max(0, Math.min(1, (s - a) / (b - a || 1))) };
  }
  return { train, tram, advance, gapTo, rideTo, putAt, release, tramTo, tramHold, tramFree, tramPut, fraction, LOOP_LEN, TRAM_LEN };
}
