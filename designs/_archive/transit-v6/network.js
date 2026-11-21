/* Kevin Metro · the network
   Six lines over one city. The Circle runs on a 9 m viaduct round the middle; Line 1 (software) runs at
   street level along a boulevard; Lines 2–5 leave the Kevin Square hub on 18 m viaducts, so every crossing
   clears the one below it. One unit is one metre; x runs east, z runs south. */
import * as THREE from 'three';

import { LINES, PLACES, stationsOf } from './city-data.js';

// lines and stations come from the registry (city-data.js): add a place there and its station appears here
export const LINE_DEFS = LINES;
export const STATIONS = stationsOf(PLACES);
export const MAP_SIDE = Object.fromEntries(STATIONS.map((s) => [s.id, s.side]));

/* A polyline with rounded corners: straights and circular arcs, measured by arc length. */
export function buildPath(def) {
  const P = def.pts.map(([x, z]) => new THREE.Vector2(x, z));
  const n = P.length; const closed = !!def.closed;
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
    corners.push({ a, b, c, r, phiA: Math.atan2(a.y - c.y, a.x - c.x), sign, len: r * alpha });
  }
  const segs = [];
  const straight = (p, q) => { const d = q.clone().sub(p); const len = d.length(); d.normalize(); segs.push({ len, straight: true, f: (u) => [p.x + d.x * u, p.y + d.y * u, d.x, d.y] }); };
  const arc = (k) => segs.push({ len: k.len, straight: false, f: (u) => { const ph = k.phiA + k.sign * (u / k.r); return [k.c.x + k.r * Math.cos(ph), k.c.y + k.r * Math.sin(ph), -k.sign * Math.sin(ph), k.sign * Math.cos(ph)]; } });
  if (closed) {
    for (let i = 0; i < n; i++) { const k0 = corners[i]; const k1 = corners[(i + 1) % n]; straight(k0 ? k0.b : P[i], k1 ? k1.a : P[(i + 1) % n]); if (k1) arc(k1); }
  } else {
    let from = P[0];
    for (let i = 1; i < n; i++) { const k = corners[i]; straight(from, k ? k.a : P[i]); if (k) { arc(k); from = k.b; } }
  }
  let acc = 0; segs.forEach((g) => { g.s0 = acc; acc += g.len; });
  const L = acc; const Y = def.y;
  const wrap = closed ? (s) => ((s % L) + L) % L : (s) => Math.min(L, Math.max(0, s));
  const at = (s) => {
    s = wrap(s);
    let g = segs[segs.length - 1]; for (const q of segs) if (s < q.s0 + q.len) { g = q; break; }
    const [x, z, tx, tz] = g.f(Math.min(g.len, Math.max(0, s - g.s0)));
    return { p: new THREE.Vector3(x, Y, z), t: new THREE.Vector3(tx, 0, tz), n: new THREE.Vector3(tz, 0, -tx) };
  };
  const trackPoint = (s, lat, dy = 0) => { const a = at(s); return a.p.add(a.n.multiplyScalar(lat)).setY(a.p.y + dy); };
  // samples for nearest-point and distance queries
  const samples = []; for (let s = 0; s <= L; s += 2) { const a = at(s); samples.push([a.p.x, a.p.z, s]); }
  const project = (x, z) => { let best = 0; let bd = Infinity; samples.forEach(([sx, sz, s]) => { const d = (sx - x) ** 2 + (sz - z) ** 2; if (d < bd) { bd = d; best = s; } }); return best; };
  const breaks = segs.map((g) => ({ s0: g.s0, s1: g.s0 + g.len, straight: g.straight }));
  return { def, id: def.id, closed, L, Y, wrap, at, trackPoint, samples, project, breaks, kind: def.kind };
}

/* The whole network: paths, station positions along each line, a distance field and routing. */
export function buildNetwork() {
  const lines = LINE_DEFS.map((d) => buildPath(d));
  const byId = Object.fromEntries(lines.map((l) => [l.id, l]));
  // stations along each line, in order of arc length
  lines.forEach((l) => {
    l.stations = STATIONS.filter((st) => st.at[l.id]).map((st) => { const [x, z] = st.at[l.id]; return { st, id: st.id, s: l.project(x, z), line: l }; }).sort((a, b) => a.s - b.s);
    l.stations.forEach((ps, i) => { ps.i = i; ps.code = `${l.def.no}${String(i + 1).padStart(2, '0')}`; });
  });
  const stById = Object.fromEntries(STATIONS.map((s) => [s.id, s]));
  STATIONS.forEach((st) => { st.lines = lines.filter((l) => st.at[l.id]).map((l) => l.id); });
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
  return { lines, byId, stations: STATIONS, stById, dist, route };
}
