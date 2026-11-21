/* Kevin Yu · Transit, 2D fallback
   When WebGL is unavailable, the city becomes the flat Vignelli diagram: lines are categories,
   stations are projects placed in time, and every line runs toward Non-stop. */
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};
const dPath = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');

export function renderFallback(host, { KY, when, short, status, onStation }) {
  const NOW = 2026.9;
  const lines = KY.categories.map((c) => c.id);
  const knots = [[2024.5, 150], [2025, 500], [2026, 760], [NOW, 1150], [2027.3, 1330]];
  const xOf = (t) => {
    for (let i = 1; i < knots.length; i++) if (t <= knots[i][0]) {
      const [t0, v0] = knots[i - 1]; const [t1, v1] = knots[i];
      return v0 + ((t - t0) / (t1 - t0)) * (v1 - v0);
    }
    return knots[knots.length - 1][1];
  };
  const TRACK = { software: 130, books: 230, film: 330, games: 430, health: 530 };
  const svg = el('svg', { class: 'fallback-map', viewBox: '0 72 1440 560', role: 'group', 'aria-label': 'Transit map of Kevin Yu’s projects' });
  host.appendChild(svg);
  const nowX = xOf(NOW);
  el('line', { x1: nowX, x2: nowX, y1: 90, y2: 600, class: 'grid-now' }, svg);
  lines.forEach((id, i) => {
    const sy = 330 + (i - 2) * 12; const ty = TRACK[id]; const dy = ty - sy;
    const pts = [[150, sy], [175, sy]];
    if (Math.abs(dy) > 0.5) pts.push([175 + Math.abs(dy), ty]);
    el('path', { d: dPath([...pts, [nowX, ty]]), class: `ln c-${id}` }, svg);
    el('path', { d: dPath([[nowX, ty], [1330, ty]]), class: `ln ln-future c-${id}` }, svg);
  });
  el('rect', { x: 136, y: 296, width: 28, height: 68, rx: 14, class: 'ix' }, svg);
  el('rect', { x: 395, y: 108, width: 30, height: 444, rx: 15, class: 'ix' }, svg);
  el('rect', { x: 1315, y: 108, width: 30, height: 444, rx: 15, class: 'ix' }, svg);
  const lab = (x, y, a, t, cls) => { el('text', { x, y, 'text-anchor': a, class: cls }, svg).textContent = t; };
  lab(124, 335, 'end', 'Kevin', 'ix-label'); lab(410, 94, 'middle', 'Claude Code', 'ix-label'); lab(1330, 94, 'middle', 'Non-stop', 'ix-label');
  const projects = KY.projects.filter((p) => TRACK[p.category]).map((p) => ({ ...p, t: when[p.id] ?? 2026.5 })).sort((a, b) => a.t - b.t);
  const count = {};
  projects.forEach((p) => {
    const k = (count[p.category] = (count[p.category] || 0) + 1);
    const x = xOf(p.t); const y = TRACK[p.category];
    const g = el('g', { class: 'stn', transform: `translate(${x} ${y})`, tabindex: '0', role: 'button', 'aria-label': `${p.title}, ${status[p.status]}. Open details.` }, svg);
    const c = el('circle', { r: 8.5, class: `st-${p.status}` }, g);
    if (p.status === 'live') c.setAttribute('fill', `var(--l-${p.category})`);
    if (p.status === 'testing' || p.status === 'building') c.setAttribute('stroke', `var(--l-${p.category})`);
    el('text', { class: 'stn-label', y: k % 2 ? -18 : 30, 'text-anchor': 'middle' }, g).textContent = short[p.id] || p.title;
    const go = () => onStation(p);
    g.addEventListener('click', go);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  return { svg };
}
