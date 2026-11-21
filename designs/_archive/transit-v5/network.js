/* Kevin Metro · the network
   Six lines over one city. The Circle runs on a 9 m viaduct round the middle; Line 1 (software) runs at
   street level along a boulevard; Lines 2–5 leave the Kevin Square hub on 18 m viaducts, so every crossing
   clears the one below it. One unit is one metre; x runs east, z runs south. */
import * as THREE from 'three';

export const LINE_DEFS = [
  { id: 'c', no: 'C', name: 'Circle Line', label: 'Circle', cat: null, hex: 0x4b5560, css: '#4B5560', y: 9, kind: 'viaduct', closed: true, r: 110, pts: [[-520, -330], [520, -330], [520, 330], [-520, 330]] },
  { id: '1', no: '1', name: 'Line 1', label: 'Software', cat: 'software', hex: 0xda291c, css: '#DA291C', y: 0.42, kind: 'grade', r: 50, pts: [[-765, 0], [650, 0], [650, 168]] },
  { id: '2', no: '2', name: 'Line 2', label: 'Books & apps', cat: 'books', hex: 0xf2b705, css: '#F2B705', y: 18, kind: 'viaduct', r: 70, pts: [[30, -30], [260, -260], [260, -528]] },
  { id: '3', no: '3', name: 'Line 3', label: 'Film & media', cat: 'film', hex: 0x0039a6, css: '#0039A6', y: 18, kind: 'viaduct', r: 60, pts: [[0, 26], [0, 538]] },
  { id: '4', no: '4', name: 'Line 4', label: 'Games', cat: 'games', hex: 0x8e3b9c, css: '#8E3B9C', y: 18, kind: 'viaduct', r: 60, pts: [[-30, 30], [-130, 130], [-130, 538]] },
  { id: '5', no: '5', name: 'Line 5', label: 'Healthcare AI', cat: 'health', hex: 0x00933c, css: '#00933C', y: 18, kind: 'viaduct', r: 70, pts: [[-30, -30], [-260, -260], [-260, -528]] },
];

// every station once; `at` places it on each line it serves
export const STATIONS = [
  { id: 'kevin', name: 'Kevin Square', zh: '凯文广场', at: { 1: [0, 0], 2: [65, -65], 3: [0, 72], 4: [-64, 64], 5: [-65, -65] } },
  { id: 'medical', name: 'Medical Centre', zh: '医疗中心', at: { c: [-260, -330], 5: [-260, -330] } },
  { id: 'university', name: 'University', zh: '大学', at: { c: [0, -330] } },
  { id: 'oldtown', name: 'Old Town', zh: '老城', at: { c: [260, -330], 2: [260, -330] } },
  { id: 'dailyai', name: 'Daily AI', zh: '每日 AI', at: { c: [520, -165] } },
  { id: 'eastgate', name: 'East Gate', zh: '东门', at: { c: [520, 0], 1: [520, 0] } },
  { id: 'nonstop', name: 'Non-stop', zh: '不停站', at: { c: [260, 330] } },
  { id: 'cinema', name: 'Cinema Row', zh: '影院街', at: { c: [0, 330], 3: [0, 330] } },
  { id: 'arcade', name: 'Arcade Street', zh: '游戏街', at: { c: [-130, 330], 4: [-130, 330] } },
  { id: 'westgate', name: 'West Gate', zh: '西门', at: { c: [-520, 0], 1: [-520, 0] } },
  { id: 'sports', name: 'Sports Park', zh: '体育公园', at: { 1: [-705, 0] } },
  { id: 'harbour', name: 'Harbour', zh: '港口', at: { 1: [650, 112] } },
  { id: 'studio', name: 'Studio Park', zh: '画室公园', at: { 2: [260, -470] } },
  { id: 'jazz', name: 'Jazz Alley', zh: '爵士巷', at: { 3: [0, 482] } },
  { id: 'party', name: 'Party House', zh: '派对屋', at: { 4: [-130, 482] } },
  { id: 'hackhall', name: 'Hackathon Hall', zh: '黑客松馆', at: { 5: [-260, -470] } },
];

// which side of its roundel each station's name sits on, on the map
export const MAP_SIDE = { sports: 'above', westgate: 'above-right', eastgate: 'above-right', harbour: 'right', dailyai: 'left', medical: 'above-left', university: 'above', oldtown: 'above-right', hackhall: 'left', studio: 'right', nonstop: 'below', cinema: 'below-right', arcade: 'below-left', party: 'left', jazz: 'right', kevin: 'above-right' };

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
    l.stations.forEach((ps, i) => { ps.i = i; });
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
