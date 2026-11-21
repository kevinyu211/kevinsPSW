/* Island city · the flat map
   Shown when the browser cannot draw the 3D island (no WebGL), or with ?2d. Same data, same line strip, same
   pages: only the picture is simpler. It offers the same handful of methods app.js uses on the 3D island. */
import { ISLAND, LOOP, TOWER, ROADS, PLACING, coastK, loopPoint, loopOffset } from './city-data.js';
import { placeById, trackAt, tramAt, TRAM } from './track.js';
import { sv } from './pages.js';

export function createMap({ host, stops, first }) {
  const W = ISLAND.rx * 1.2; const H = ISLAND.rz * 1.24;
  const svg = sv('svg', { viewBox: `${-W} ${-H} ${W * 2} ${H * 2}`, class: 'map', role: 'img', 'aria-label': `Map of ${first}’s island: the metro loop, its stops and the tower` });
  host.prepend(svg);
  const coast = (k) => { let d = ''; for (let i = 0; i <= 120; i++) { const a = (i / 120) * Math.PI * 2; const r = coastK(-a) * k; d += `${i ? 'L' : 'M'}${(ISLAND.rx * r * Math.cos(a)).toFixed(1)} ${(ISLAND.rz * r * Math.sin(a)).toFixed(1)}`; } return `${d}Z`; };
  const ring = (off) => { let d = ''; for (let a = 0; a <= 360; a += 3) { const p = loopOffset(a, off); d += `${a ? 'L' : 'M'}${p.x.toFixed(1)} ${p.z.toFixed(1)}`; } return `${d}Z`; };
  sv('path', { d: coast(1.085), class: 'm-shallow' }, svg); sv('path', { d: coast(1.0), class: 'm-sand' }, svg); sv('path', { d: coast(0.935), class: 'm-grass' }, svg);
  for (const k of [1.5, 1.0, 0.55]) sv('ellipse', { cx: 0, cy: ISLAND.hill.z, rx: ISLAND.hill.sx * k, ry: ISLAND.hill.sz * k, class: 'm-hill' }, svg);
  sv('path', { d: ring(ROADS.coastOffset), class: 'm-road' }, svg);
  const built = { '-1': [] }; const groups = {};
  stops.forEach((s) => { const a = placeById[s.id].angle; const p = loopOffset(a, ROADS.coastOffset); const q = loopOffset(a, s.side === 'sea' ? -PLACING.seaOffset : PLACING.inOffset); sv('path', { d: `M${p.x.toFixed(1)} ${p.z.toFixed(1)}L${q.x.toFixed(1)} ${q.z.toFixed(1)}`, class: 'm-road m-street' }, svg); });
  sv('path', { d: ring(0), class: 'm-line' }, svg);
  sv('path', { d: `M${TRAM.x} ${TRAM.z0}L${TRAM.x} ${TRAM.z1}`, class: 'm-tram' }, svg);
  const place = (id, order, x, z, cls, color, label, anchor) => {
    const g = sv('g', { class: `m-place ${cls}`, 'data-id': id, style: `--c:${color}` }, svg); groups[id] = g; (built[order] = built[order] || []).push(g);
    return { g, x, z, label, anchor };
  };
  const mainP = loopPoint(LOOP.mainAngle);
  { const m = place('main', -1, mainP.x, mainP.z, 'is-main', '#16171A'); sv('rect', { x: mainP.x - 26, y: mainP.z - 9, width: 52, height: 18, rx: 3, class: 'm-station' }, m.g); const t = sv('text', { x: mainP.x, y: mainP.z + 32, 'text-anchor': 'middle', class: 'm-name' }, m.g); t.textContent = 'Main station'; }
  stops.forEach((s) => {
    const t = trackAt(placeById[s.id].s); const f = s.side === 'sea' ? -1 : 1; const bx = t.x + t.nx * PLACING.inOffset * 0.8 * f; const bz = t.z + t.nz * PLACING.inOffset * 0.8 * f;
    const m = place(s.id, s.i, t.x, t.z, s.level <= 2 ? 'is-site' : '', s.color);
    sv('rect', { x: bx - 17, y: bz - 13, width: 34, height: 26, rx: 2, class: 'm-build' }, m.g); sv('circle', { cx: t.x, cy: t.z, r: 8, class: 'm-stop' }, m.g);
    const out = f > 0 ? -1 : 1; const lx = t.x + t.nx * 34 * out; const lz = t.z + t.nz * 34 * out;
    const tx = sv('text', { x: lx, y: lz + 5, 'text-anchor': Math.abs(t.nx) < 0.5 ? 'middle' : (t.nx * out > 0 ? 'start' : 'end'), class: 'm-name' }, m.g); tx.textContent = s.short;
    sv('rect', { x: Math.min(bx, t.x) - 24, y: Math.min(bz, t.z) - 20, width: Math.abs(bx - t.x) + 48, height: Math.abs(bz - t.z) + 40, class: 'm-hit' }, m.g);
  });
  { const m = place('tower', stops.length + 1, TOWER.x, TOWER.z, 'is-tower', '#D5281E'); sv('circle', { cx: TOWER.x, cy: TOWER.z, r: 26, class: 'm-plinth' }, m.g); sv('path', { d: `M${TOWER.x} ${TOWER.z - 17}l14 25h-28z`, class: 'm-spire' }, m.g); const t = sv('text', { x: TOWER.x, y: TOWER.z - 36, 'text-anchor': 'middle', class: 'm-name' }, m.g); t.textContent = `${first}’s tower`; }
  const train = sv('g', { class: 'm-train' }, svg); sv('rect', { x: -22, y: -6, width: 44, height: 12, rx: 4 }, train);
  const tram = sv('g', { class: 'm-tramcar' }, svg); sv('rect', { x: -5, y: -8, width: 10, height: 16, rx: 3 }, tram);
  const state = { look: 'film', time: 'day', weather: 'clear' };
  const paint = () => { svg.dataset.look = state.look; svg.dataset.time = state.time; svg.dataset.weather = state.weather; };
  let hot = null;
  return {
    is2d: true, mode: 'orbit', used: { real: [], stand: [] }, state,
    setLook(l) { state.look = l; paint(); }, setTime(t) { state.time = t; paint(); }, setWeather(w) { state.weather = w; paint(); },
    resize() {}, render() {}, resetView() {}, showStation() {}, follow() {}, inside() {}, setHouses() {},
    trainSubject: () => () => ({}), tramSubject: () => () => ({}),
    update(dt, sim) { const t = trackAt(sim.train.s); train.setAttribute('transform', `translate(${t.x.toFixed(1)} ${t.z.toFixed(1)}) rotate(${((Math.atan2(t.tz, t.tx) * 180) / Math.PI).toFixed(1)})`); const p = tramAt(sim.tram.u); tram.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.z.toFixed(1)})`); },
    setBuilt(order, k) { (built[order] || []).forEach((g) => { g.style.opacity = k > 0.02 ? Math.min(1, k * 1.4).toFixed(2) : '0'; g.style.transform = `scale(${(0.6 + 0.4 * Math.min(1, k)).toFixed(3)})`; }); },
    setAllBuilt(k) { Object.keys(built).forEach((o) => this.setBuilt(o, k)); },
    pick(x, y) { const el = document.elementFromPoint(x, y); const g = el && el.closest && el.closest('[data-id]'); return g && svg.contains(g) ? g.dataset.id : null; },
    hover(id) { if (hot && groups[hot]) groups[hot].classList.remove('is-hot'); hot = id; if (id && groups[id]) groups[id].classList.add('is-hot'); },
    screenOf() { return null; },
  };
}
