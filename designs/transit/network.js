/* Kevin Metro · the network
   Six lines, one per kind of work, laid as a mesh over one city. Two rail levels and one rule: track running
   east–west is on the upper deck, track running north–south on the lower deck, and a line that turns ramps
   between them on the bend. So every crossing is a right angle with one line above the other, and a station
   at a crossing is one two-deck building. One unit is one metre; x runs east, z runs south. */
import * as THREE from 'three';

import { LINES, LEVELS, PLACES, stationsOf } from './city-data.js';

// lines and stations come from the registry (city-data.js): add a place there and its station appears here
export const LINE_DEFS = LINES;
export const STATIONS = stationsOf(PLACES);
export const MAP_SIDE = Object.fromEntries(STATIONS.map((s) => [s.id, s.side]));
export const STOP = 41.5;     // half a train: its head stops this far past the station centre
export const HALF_PLAT = 46;  // half a platform
export const TRACK_LAT = -5;  // the track trains use, measured across the line
export const PLAT_LAT = -8.6; // the middle of the platform beside that track
export const PLAT_UP = 1.1;   // platform height above the rails

/* A polyline with rounded corners: straights and circular arcs, measured by arc length. */
export function buildPath(def) {
  const P = def.pts.map(([x, z]) => new THREE.Vector2(x, z));
  const n = P.length; const closed = !!def.closed;
  const levelOf = (tx) => (Math.abs(tx) > 0.5 ? LEVELS.upper : LEVELS.lower); // east–west: upper deck; north–south: lower deck
  const corners = []; // per vertex: { a, b, c, r, phiA, sign, len } or null
  for (let i = 0; i < n; i++) {
    if (!closed && (i === 0 || i === n - 1)) { corners.push(null); continue; }
    const prev = P[(i - 1 + n) % n]; const cur = P[i]; const next = P[(i + 1) % n];
    const din = cur.clone().sub(prev).normalize(); const dout = next.clone().sub(cur).normalize();
    const alpha = Math.acos(Math.min(1, Math.max(-1, din.dot(dout))));
    if (alpha < 1e-4) { corners.push(null); continue; }
    const r = def.r; const t = r * Math.tan(alpha / 2);
    const a = cur.clone().addScaledVector(din, -t); const b = cur.clone().addScaledVector(dout, t);
    let perp = new THREE.Vector2(-din.y, din.x); if (perp.dot(dout) < 0) perp.negate();
    const c = a.clone().addScaledVector(perp, r);
    const cross = din.x * dout.y - din.y * dout.x; const sign = cross > 0 ? 1 : -1;
    corners.push({ a, b, c, r, phiA: Math.atan2(a.y - c.y, a.x - c.x), sign, len: r * alpha, y0: levelOf(din.x), y1: levelOf(dout.x) });
  }
  const segs = [];
  const straight = (p, q) => { const d = q.clone().sub(p); const len = d.length(); d.normalize(); const lv = levelOf(d.x); segs.push({ len, straight: true, y: () => lv, f: (u) => [p.x + d.x * u, p.y + d.y * u, d.x, d.y] }); };
  // on a bend the line ramps from the deck it leaves to the deck it joins
  const arc = (k) => segs.push({ len: k.len, straight: false, y: (u) => { const q = Math.min(1, Math.max(0, u / k.len)); return k.y0 + (k.y1 - k.y0) * q * q * (3 - 2 * q); }, f: (u) => { const ph = k.phiA + k.sign * (u / k.r); return [k.c.x + k.r * Math.cos(ph), k.c.y + k.r * Math.sin(ph), -k.sign * Math.sin(ph), k.sign * Math.cos(ph)]; } });
  if (closed) {
    for (let i = 0; i < n; i++) { const k0 = corners[i]; const k1 = corners[(i + 1) % n]; straight(k0 ? k0.b : P[i], k1 ? k1.a : P[(i + 1) % n]); if (k1) arc(k1); }
  } else {
    let from = P[0];
    for (let i = 1; i < n; i++) { const k = corners[i]; straight(from, k ? k.a : P[i]); if (k) { arc(k); from = k.b; } }
  }
  let acc = 0; segs.forEach((g) => { g.s0 = acc; acc += g.len; });
  const L = acc;
  const wrap = closed ? (s) => ((s % L) + L) % L : (s) => Math.min(L, Math.max(0, s));
  const at = (s) => {
    s = wrap(s);
    let g = segs[segs.length - 1]; for (const q of segs) if (s < q.s0 + q.len) { g = q; break; }
    const u = Math.min(g.len, Math.max(0, s - g.s0)); const [x, z, tx, tz] = g.f(u);
    return { p: new THREE.Vector3(x, g.y(u), z), t: new THREE.Vector3(tx, 0, tz), n: new THREE.Vector3(tz, 0, -tx) };
  };
  const trackPoint = (s, lat, dy = 0) => { const a = at(s); return a.p.add(a.n.multiplyScalar(lat)).setY(a.p.y + dy); };
  // samples for nearest-point and distance queries
  const samples = []; for (let s = 0; s <= L; s += 2) { const a = at(s); samples.push([a.p.x, a.p.z, s]); }
  const project = (x, z) => { let best = 0; let bd = Infinity; samples.forEach(([sx, sz, s]) => { const d = (sx - x) ** 2 + (sz - z) ** 2; if (d < bd) { bd = d; best = s; } }); return best; };
  const breaks = segs.map((g) => ({ s0: g.s0, s1: g.s0 + g.len, straight: g.straight }));
  return { def, id: def.id, closed, L, wrap, at, trackPoint, samples, project, breaks, kind: def.kind };
}

/* The whole network: paths, station positions along each line, a distance field and routing. */
export function buildNetwork() {
  const lines = LINE_DEFS.map((d) => buildPath(d));
  const byId = Object.fromEntries(lines.map((l) => [l.id, l]));
  // stations along each line, in order of arc length
  lines.forEach((l) => {
    // a platform is the point of the line nearest the station; on an open line it is kept clear of the ends
    l.stations = STATIONS.filter((st) => st.lines.includes(l.id)).map((st) => { let s = l.project(st.pos[0], st.pos[1]); if (!l.closed) s = Math.min(l.L - HALF_PLAT - 2, Math.max(HALF_PLAT + 2, s)); return { st, id: st.id, s, line: l }; }).sort((a, b) => a.s - b.s);
    l.stations.forEach((ps, i) => { ps.i = i; ps.code = `${l.def.no}${String(i + 1).padStart(2, '0')}`; });
  });
  const stById = Object.fromEntries(STATIONS.map((s) => [s.id, s]));
  STATIONS.forEach((st) => { st.lines = lines.filter((l) => st.lines.includes(l.id)).map((l) => l.id); });
  // a coarse spatial hash of every line sample, for "how far is this point from a line?"
  const CELL = 40; const hash = new Map();
  lines.forEach((l) => l.samples.forEach(([x, z]) => { const k = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`; if (!hash.has(k)) hash.set(k, []); hash.get(k).push([x, z, l.id]); }));
  const dist = (x, z, except) => {
    const cx = Math.floor(x / CELL); const cz = Math.floor(z / CELL); let best = Infinity;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const list = hash.get(`${cx + i},${cz + j}`); if (list) list.forEach(([sx, sz, id]) => { if (id === except) return; const d = (sx - x) ** 2 + (sz - z) ** 2; if (d < best) best = d; }); }
    return Math.sqrt(best);
  };
  // routing: fewest changes first, then fewest stops. The Circle only runs clockwise.
  const stopsOn = (l, i, j) => (l.closed ? (j - i + l.stations.length) % l.stations.length : Math.abs(j - i));
  function route(fromId, toId, startLine) {
    if (fromId === toId) return [];
    const best = new Map(); const q = [];
    STATIONS.find((s) => s.id === fromId).lines.forEach((lid) => q.push({ st: fromId, line: lid, cost: lid === startLine ? 0 : 0.5, legs: [] }));
    let found = null;
    while (q.length) {
      q.sort((a, b) => a.cost - b.cost); const cur = q.shift();
      const key = `${cur.st}|${cur.line}`; if (best.has(key) && best.get(key) <= cur.cost) continue; best.set(key, cur.cost);
      if (found && cur.cost >= found.cost) break;
      const l = byId[cur.line]; const i = l.stations.findIndex((p) => p.id === cur.st);
      l.stations.forEach((p, j) => {
        if (j === i) return;
        const stops = stopsOn(l, i, j); const legs = [...cur.legs, { line: l.id, from: cur.st, to: p.id, stops }];
        const cost = cur.cost + stops * 0.01 + 0;
        if (p.id === toId) { if (!found || cost < found.cost) found = { cost, legs }; return; }
        stById[p.id].lines.forEach((lid) => { if (lid !== l.id) q.push({ st: p.id, line: lid, cost: cost + 1, legs }); });
      });
    }
    return found ? found.legs : null;
  }
  /* How the platforms of an interchange connect: the two lines cross at a right angle, one above the other.
     The platforms cross at the corner X, and an escalator runs from the lower platform (foot) up to the
     upper one (top), outside the upper deck. walk(sid, fromLine, toLine) is the way a passenger goes. */
  const platPoint = (l, s, lat = PLAT_LAT) => { const a = l.at(s); return a.p.addScaledVector(a.n, lat).setY(a.p.y + PLAT_UP); };
  const stopOn = (lid, sid) => byId[lid].stations.find((p) => p.id === sid);
  const cross = (st) => {
    if (st.lines.length !== 2) return null;
    const l0 = byId[st.lines[0]]; const l1 = byId[st.lines[1]]; const h0 = l0.at(stopOn(l0.id, st.id).s).p.y; const h1 = l1.at(stopOn(l1.id, st.id).s).p.y; if (Math.abs(h0 - h1) < 1) return null;
    const lo = h0 < h1 ? l0 : l1; const up = lo === l0 ? l1 : l0; const yLo = Math.min(h0, h1); const yUp = Math.max(h0, h1);
    const pa = stopOn(lo.id, st.id); const pb = stopOn(up.id, st.id); const A = lo.at(pa.s); const Bq = up.at(pb.s);
    const X = A.p.clone().setY(0).addScaledVector(A.n, PLAT_LAT).addScaledVector(Bq.n, PLAT_LAT); const out = Bq.n.clone().multiplyScalar(Math.sign(PLAT_LAT));
    return { lo, up, pa, pb, X, out, yLo, yUp, foot: X.clone().addScaledVector(out, 30).setY(yLo + PLAT_UP), top: X.clone().addScaledVector(out, 3).setY(yUp + PLAT_UP), centre: A.p.clone().setY(0) };
  };
  function walk(sid, fromLine, toLine) {
    const st = stById[sid]; const la = byId[fromLine]; const lb = byId[toLine]; if (la === lb) return [platPoint(la, stopOn(la.id, sid).s)];
    const k = cross(st);
    if (k) { const up = la === k.lo; const a = platPoint(k.lo, k.pa.s + k.out.dot(lo_t(k)) * 16); const pts = [a, k.foot.clone(), k.top.clone(), k.X.clone().setY(k.yUp + PLAT_UP)]; return up ? pts : pts.reverse(); }
    return [platPoint(la, stopOn(la.id, sid).s), platPoint(lb, stopOn(lb.id, sid).s)]; // same deck: straight across
  }
  const lo_t = (k) => k.lo.at(k.pa.s).t;
  return { lines, byId, stations: STATIONS, stById, dist, route, platPoint, stopOn, cross, walk };
}
