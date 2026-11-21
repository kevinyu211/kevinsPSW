/* Kevin Metro · the trains and the visitor's trip
   Pure logic, shared by the 3D city and the 2D map, so both always show the same thing.
   - Every line has one train, in its line colour, running only on its own line: Lines 1–5 shuttle end to
     end, the Circle loops. They keep running whether or not anyone rides.
   - The visitor is a passenger marker. A trip is a list of legs (one per line). Each leg: walk to the
     platform, the line's train pulls in, doors open, board, ride, doors open, step out. Between two legs the
     passenger walks the interchange (escalator or hub gallery) while the next line's train pulls in.
   Nothing here draws; renderers read `trains`, `pax` and `trip` every frame after calling advance(). */
import * as THREE from 'three';
import { STOP, TRACK_LAT, PLAT_UP } from './network.js';

const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const easeOut = (p) => 1 - (1 - p) * (1 - p);

export function createSim(net, { reduce = false, start = 'kevin', speed = 1 } = {}) {
  const listeners = []; const emit = (type, data) => listeners.forEach((f) => f(type, data));
  const trains = net.lines.map((line, li) => {
    const n = line.stations.length; const i = line.stations.findIndex((p) => p.id === start) >= 0 && line.id === '1' ? line.stations.findIndex((p) => p.id === start) : (li * 2 + 1) % n;
    return { line, li, i, dir: 1, s: line.stations[i].s, doors: 0, doorGoal: 0, hop: null, dwell: 1 + li * 1.4, held: false };
  });
  const trainOf = (lid) => trains.find((t) => t.line.id === lid);
  const gap = (t, to) => (t.line.closed ? t.line.wrap(to - t.line.wrap(t.s)) : to - t.s);
  // send a train to station j of its line
  const hopTo = (t, j, dur, kind) => { const to = t.line.stations[j].s; const d = gap(t, to); if (!t.line.closed && Math.abs(d) > 0.5) t.dir = d > 0 ? 1 : -1; t.hop = { a: t.s, b: t.s + d, t: 0, dur: dur || Math.max(5.5, 4 + Math.abs(d) / 45), j, kind: kind || 'both' }; t.doorGoal = 0; };
  const nextStop = (t) => { const n = t.line.stations.length; if (t.line.closed) return (t.i + 1) % n; let j = t.i + t.dir; if (j < 0 || j >= n) { t.dir = -t.dir; j = t.i + t.dir; } return j; };
  const trainPoint = (t, dy = 0) => t.line.trackPoint(t.s, TRACK_LAT, dy);
  // position as a fractional station index, for the line strip
  const fracOf = (t) => {
    const S = t.line.stations; const n = S.length; const p = t.line.wrap(t.s);
    if (t.line.closed) { let i = n - 1; for (let k = 0; k < n; k++) if (S[k].s <= p) i = k; const g = t.line.wrap(S[(i + 1) % n].s - S[i].s) || t.line.L; return (i + t.line.wrap(p - S[i].s) / g) % n; }
    if (p <= S[0].s) return 0; if (p >= S[n - 1].s) return n - 1;
    let i = 0; for (let k = 0; k < n - 1; k++) if (S[k].s <= p) i = k; return i + (p - S[i].s) / (S[i + 1].s - S[i].s);
  };

  /* the passenger */
  const st0 = net.stById[start] ? start : 'kevin';
  const pax = { station: st0, line: net.stById[st0].lines.includes('1') ? '1' : net.stById[st0].lines[0], aboard: null, pos: new THREE.Vector3(), walking: false };
  const home = (sid, lid) => net.platPoint(net.byId[lid], net.stopOn(lid, sid).s);
  pax.pos.copy(home(pax.station, pax.line));
  let trip = null; let path = null;
  const walkTo = (pts, then) => {
    const P = [pax.pos.clone(), ...pts]; const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + P[i].distanceTo(P[i - 1]));
    const len = L[L.length - 1]; if (len < 0.5) { then && then(); return; }
    path = { P, L, len, t: 0, dur: Math.min(4.6, Math.max(0.5, len / 16)), then }; pax.walking = true;
  };
  const stepWalk = (dt) => {
    if (!path) return; path.t += dt; const p = Math.min(1, path.t / path.dur); const d = ease(p) * path.len; let i = 1; while (i < path.L.length - 1 && path.L[i] < d) i++;
    const a = path.P[i - 1]; const b = path.P[i]; const seg = path.L[i] - path.L[i - 1] || 1; pax.pos.lerpVectors(a, b, Math.min(1, Math.max(0, (d - path.L[i - 1]) / seg)));
    if (p >= 1) { const then = path.then; path = null; pax.walking = false; then && then(); }
  };

  /* a trip, as a small state machine */
  const leg = () => trip.legs[trip.k];
  const call = (lg) => { // the leg's train pulls in at the boarding station, heading for the leg's last stop
    const t = trainOf(lg.line); const line = t.line; const A = net.stopOn(lg.line, lg.from); const B = net.stopOn(lg.line, lg.to); t.held = true;
    const dir = line.closed ? 1 : Math.sign(B.s - A.s) || 1;
    if (!t.hop && t.i === A.i && Math.abs(gap(t, A.s)) < 1) { t.dir = dir; t.doorGoal = 1; return; }
    let from = A.s - dir * 240; if (!line.closed && (from < STOP + 3 || from > line.L - STOP - 3)) { from = A.s + dir * 240; from = Math.min(line.L - STOP - 3, Math.max(STOP + 3, from)); }
    t.dir = dir; t.s = line.closed ? line.wrap(from) : from; t.doors = 0; t.doorGoal = 0; t.i = A.i; t.hop = { a: t.s, b: t.s + gap(t, A.s), t: 0, dur: 2.8, j: A.i, kind: 'out', open: true };
  };
  const enter = (phase) => {
    trip.phase = phase; trip.t = 0; const lg = leg(); const t = trainOf(lg.line);
    if (phase === 'walk') { // to the platform of this leg's line (a change of line when the passenger came by another)
      const pts = pax.line !== lg.line ? net.walk(lg.from, pax.line, lg.line) : [home(lg.from, lg.line)];
      if (pax.line !== lg.line) emit('change', { station: lg.from, from: pax.line, to: lg.line, k: trip.k });
      pax.line = lg.line; trip.called = false; walkTo(pts, () => enter('wait'));
    } else if (phase === 'wait') { if (!trip.called) { trip.called = true; call(lg); } }
    else if (phase === 'board') { emit('board', { ...lg, k: trip.k }); walkTo([trainPoint(t, PLAT_UP)], () => { pax.aboard = lg.line; t.doorGoal = 0; enter('depart'); }); }
    else if (phase === 'ride') { const B = net.stopOn(lg.line, lg.to); const d = Math.abs(gap(t, B.s)); hopTo(t, B.i, Math.min(9, Math.max(4.6, 3.4 + d / 120))); emit('leg', { ...lg, k: trip.k }); }
    else if (phase === 'alight') { t.doorGoal = 1; }
  };
  const finish = () => { const done = trip; trip = null; emit('arrive', { station: pax.station, line: pax.line, meta: done.meta }); };
  const stepTrip = (dt) => {
    if (!trip) return; trip.t += dt; const lg = leg(); const t = trainOf(lg.line);
    if (trip.phase === 'walk') { if (!trip.called && path && path.dur - path.t < 2.7) { trip.called = true; call(lg); } }
    else if (trip.phase === 'wait') { if (!t.hop && t.doors > 0.97) enter('board'); }
    else if (trip.phase === 'depart') { if (t.doors < 0.03) enter('ride'); }
    else if (trip.phase === 'ride') { if (!t.hop) enter('alight'); }
    else if (trip.phase === 'alight' && t.doors > 0.97 && !path) {
      pax.aboard = null; pax.station = lg.to; t.held = false; t.dwell = 2.6;
      trip.phase = 'out';
      walkTo([home(lg.to, lg.line)], () => {
        if (trip.redirect) { const r = trip.redirect; const legs = net.route(pax.station, r.to, pax.line) || []; if (!legs.length) { trip.meta = r.meta; finish(); return; } trip = { legs, k: 0, meta: r.meta }; emit('trip', trip); enter('walk'); return; }
        if (trip.k < trip.legs.length - 1) { trip.k++; enter('walk'); } else finish();
      });
    }
  };
  const place = (sid, lid) => { // put the passenger at a station at once (deep links, skip, reduced motion)
    if (trip) trains.forEach((t) => { t.held = false; }); trip = null; path = null; pax.walking = false; pax.aboard = null;
    pax.station = sid; pax.line = lid && net.stById[sid].lines.includes(lid) ? lid : net.stById[sid].lines[0]; pax.pos.copy(home(sid, pax.line));
  };
  function startTrip(to, meta) {
    let replaced = false;
    if (trip) { // already travelling
      const riding = trip.phase === 'depart' || trip.phase === 'ride' || trip.phase === 'alight' || trip.phase === 'out';
      if (riding) { if (leg().to === to) { trip.legs = trip.legs.slice(0, trip.k + 1); trip.meta = meta; trip.redirect = null; emit('trip', trip); return trip.legs; } trip.redirect = { to, meta }; emit('redirect', { via: leg().to, to }); return trip.legs; }
      trains.forEach((t) => { t.held = false; }); trip = null; path = null; pax.walking = false; pax.aboard = null; replaced = true; // still in the station: just plan again from here
    }
    const legs = net.route(pax.station, to, pax.line) || [];
    if (!legs.length) { if (replaced) emit('arrive', { station: pax.station, line: pax.line, meta }); return []; } // asked to go where the passenger already is: the trip is over
    trip = { legs, k: 0, meta }; emit('trip', trip);
    if (reduce) { skip(); return legs; }
    enter('walk'); return legs;
  }
  function skip() {
    if (!trip) return; const r = trip.redirect; const last = trip.legs[trip.legs.length - 1]; const meta = trip.meta;
    trip.legs.forEach((lg) => { const t = trainOf(lg.line); t.held = false; });
    const t = trainOf(last.line); const B = net.stopOn(last.line, last.to); t.hop = null; t.i = B.i; t.s = B.s; t.doors = 1; t.doorGoal = 1; t.dwell = 3;
    place(last.to, last.line); emit('arrive', { station: last.to, line: last.line, meta });
    if (r) startTrip(r.to, r.meta);
  }

  let lastNow = 0; let rate = 1;
  function advance(now) { // call once per frame from whichever view is showing; a second call in the same frame does nothing
    if (!lastNow) { lastNow = now; return 0; }
    const dt = Math.min(0.1, (now - lastNow) / 1000) * speed * rate; if (dt <= 0) return 0; lastNow = now; // `speed` is for tests only
    trains.forEach((t) => {
      if (t.doors !== t.doorGoal) t.doors = t.doorGoal > t.doors ? Math.min(t.doorGoal, t.doors + dt * 1.5) : Math.max(t.doorGoal, t.doors - dt * 2);
      if (t.hop) {
        if (t.doors > 0.03) return; // wait for the doors
        const h = t.hop; h.t += dt; const p = Math.min(1, h.t / h.dur); t.s = h.a + (h.b - h.a) * (h.kind === 'out' ? easeOut(p) : ease(p));
        if (p >= 1) { t.s = t.line.closed ? t.line.wrap(h.b) : h.b; t.i = h.j; t.hop = null; t.dwell = 4.5 + (t.li % 3); t.doorGoal = 1; }
      } else if (!t.held && !reduce) { t.dwell -= dt; if (t.dwell <= 0) { if (t.doorGoal) t.doorGoal = 0; else if (t.doors < 0.03) hopTo(t, nextStop(t)); } }
    });
    stepWalk(dt); stepTrip(dt);
    if (pax.aboard) pax.pos.copy(trainPoint(trainOf(pax.aboard), PLAT_UP));
    return dt;
  }
  // how far along the current leg the train is (0..1), for the progress bar
  const progress = () => { if (!trip || trip.phase !== 'ride') return trip && (trip.phase === 'alight' || trip.phase === 'out') ? 1 : 0; const h = trainOf(leg().line).hop; return h ? Math.min(1, h.t / h.dur) : 1; };
  return { net, trains, trainOf, trainPoint, fracOf, pax, get trip() { return trip; }, startTrip, skip, place, advance, progress, walkPath: () => (path ? path.P : null), setRate: (r) => { rate = r; }, on: (f) => listeners.push(f), busy: () => !!trip };
}
