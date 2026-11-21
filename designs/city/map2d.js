/* Island city · the flat map
   Shown when the browser cannot draw the 3D island (no WebGL), or with ?2d. Same data, same line strip, same
   pages: only the picture is simpler. It offers the same handful of methods app.js uses on the 3D island. */
import { LAYOUT, HALF, TOWER_AT, placementsOf } from './layout.js';
import { trackAt, tramAt, laneOf, LOOP_LEN } from './track.js';
import { sv } from './pages.js';

export function createMap({ host, stops, towns, first }) {
  const W = HALF.x * 1.12; const H = HALF.z * 1.18; const cx0 = HALF.cx; const cz0 = HALF.cz;
  const svg = sv('svg', { viewBox: `${cx0 - W} ${cz0 - H} ${W * 2} ${H * 2}`, class: 'map', role: 'img', 'aria-label': `Map of ${first}’s island: five towns on the metro loop, and the tower` });
  host.prepend(svg);
  const line = (pts, closed) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('') + (closed ? 'Z' : '');
  // the plan, simplified: shallows, sand, the land, the hill park, the roads, the lanes, the pod line
  { const C = LAYOUT.island.coast; const grow = (k) => C.map(([x, z]) => [cx0 + (x - cx0) * k, cz0 + (z - cz0) * k]); sv('path', { d: line(grow(1.06), true), class: 'm-shallow' }, svg); sv('path', { d: line(C, true), class: 'm-sand' }, svg); sv('path', { d: line(grow(0.965), true), class: 'm-grass' }, svg); }
  { const h = LAYOUT.island.hill; for (const k of [1, 0.7]) sv('ellipse', { cx: h.x, cy: h.z, rx: h.a * k, ry: h.b * k, class: 'm-hill' }, svg); }
  LAYOUT.roads.forEach((r) => sv('path', { d: line(r.points, r.closed), class: 'm-road', style: `stroke-width:${Math.max(2.5, r.width * 0.7)}` }, svg));
  sv('path', { d: line(LAYOUT.metro.centre, true), class: 'm-line' }, svg);
  sv('path', { d: line(LAYOUT.pod.path.map((p) => [p[0], p[2]])), class: 'm-tram', fill: 'none' }, svg);
  const TOWER = TOWER_AT; const bld = Object.fromEntries(placementsOf('building').map((p) => [p.project, p]));
  const groups = {}; const built = {};
  const place = (id, order, cls, color) => { const g = sv('g', { class: `m-place ${cls}`, 'data-id': id, style: `--c:${color}` }, svg); groups[id] = g; (built[order] = built[order] || []).push(g); return g; };
  towns.forEach((t) => {
    const pt = LAYOUT.towns.find((x) => x.id === t.id); const st = pt ? pt.station : trackAt(t.s); const q = trackAt(t.s);
    t.projects.forEach((s) => { const b = bld[s.id]; if (!b) return; const g = place(s.id, s.pi, s.level <= 2 ? 'is-site' : '', s.color); sv('rect', { x: b.x - 11, y: b.z - 11, width: 22, height: 22, rx: 5, class: 'm-build' }, g); sv('rect', { x: b.x - 15, y: b.z - 15, width: 30, height: 30, class: 'm-hit' }, g); });
    const g = place(t.id, -1, 'is-town', t.color); sv('circle', { cx: st.x, cy: st.z, r: 12, class: 'm-stop' }, g); const c = sv('text', { x: st.x, y: st.z + 4, 'text-anchor': 'middle', class: 'm-code' }, g); c.textContent = t.code;
    const out = { x: st.x - q.nx * 30, z: st.z - q.nz * 30 }; const nm = sv('text', { x: out.x, y: out.z + 4, 'text-anchor': Math.abs(q.nx) < 0.5 ? 'middle' : (q.nx > 0 ? 'end' : 'start'), class: 'm-name' }, g); nm.textContent = t.name;
  });
  { const g = place('tower', 999, 'is-tower', '#D5281E'); sv('circle', { cx: TOWER.x, cy: TOWER.z, r: 22, class: 'm-plinth' }, g); sv('path', { d: `M${TOWER.x} ${TOWER.z - 15}l12 23h-24z`, class: 'm-spire' }, g); const t = sv('text', { x: TOWER.x, y: TOWER.z - 30, 'text-anchor': 'middle', class: 'm-name' }, g); t.textContent = `${first}’s tower`; }
  const cars = []; const pods = [1, -1].map(() => { const g = sv('g', { class: 'm-tramcar' }, svg); sv('rect', { x: -4, y: -6, width: 8, height: 12, rx: 3 }, g); return g; });
  const state = { look: 'film', time: 'day', weather: 'clear' }; const paint = () => { svg.dataset.look = state.look; svg.dataset.time = state.time; svg.dataset.weather = state.weather; };
  let hot = null;
  return {
    is2d: true, mode: 'orbit', used: { real: [], stand: [] }, state,
    setLook(l) { state.look = l; paint(); }, setTime(t) { state.time = t; paint(); }, setWeather(w) { state.weather = w; paint(); },
    resize() {}, render() {}, resetView() {}, showStation() {}, follow() {}, inside() {}, setHouses() {},
    trainSubject: () => () => ({}), tramSubject: () => () => ({}),
    update(dt, sim) {
      sim.trains.forEach((t, i) => { if (!cars[i]) { cars[i] = sv('g', { class: 'm-train' }, svg); sv('rect', { x: -17, y: -4.5, width: 34, height: 9, rx: 4 }, cars[i]); } const q = trackAt(t.s, laneOf(t.dir)); cars[i].setAttribute('transform', `translate(${q.x.toFixed(1)} ${q.z.toFixed(1)}) rotate(${((Math.atan2(q.tz, q.tx) * 180) / Math.PI).toFixed(1)})`); });
      pods.forEach((g, k) => { const p = tramAt(sim.tramU(k ? -1 : 1), k ? -1 : 1); g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.z.toFixed(1)})`); });
    },
    setBuilt(order, k) { (built[order === stops.length + 1 || order > 900 ? 999 : order] || built[order] || []).forEach((g) => { g.style.opacity = k > 0.02 ? Math.min(1, k * 1.4).toFixed(2) : '0'; }); },
    setAllBuilt(k) { Object.values(built).forEach((list) => list.forEach((g) => { g.style.opacity = k > 0.02 ? '1' : '0'; })); },
    pick(x, y) { const el = document.elementFromPoint(x, y); const g = el && el.closest && el.closest('[data-id]'); return g && svg.contains(g) ? g.dataset.id : null; },
    hover(id) { if (hot && groups[hot]) groups[hot].classList.remove('is-hot'); hot = id; if (id && groups[id]) groups[id].classList.add('is-hot'); },
    screenOf() { return null; },
  };
}
