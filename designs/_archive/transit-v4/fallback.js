/* Kevin Metro · 2D fallback
   Without WebGL the city becomes a flat map: the K Line as a rounded square, nine stations round it,
   and each project building drawn as a small icon outside its station. Every icon is a button. */
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };

// station positions on a 1000 × 640 map: the loop is x 160..840, y 110..530 (same order as the 3D line, clockwise)
const POS = {
  university: [300, 110, 'n'], downtown: [480, 110, 'n'], medical: [660, 110, 'n'],
  harbour: [840, 330, 'e'],
  oldtown: [690, 530, 's'], cinema: [500, 530, 's'], arcade: [310, 530, 's'],
  sports: [160, 380, 'w'], nonstop: [160, 230, 'w'],
};
const ICON = {
  // tiny buildings in the city's colours, drawn round (0,0) with the door facing the line
  hirvo: (g) => { el('rect', { x: -9, y: -46, width: 18, height: 46, fill: '#9fb3c2', stroke: '#16171a', 'stroke-width': 1.5 }, g); el('rect', { x: -7, y: -38, width: 14, height: 10, fill: '#16171a' }, g); },
  news: (g) => { el('rect', { x: -14, y: -24, width: 28, height: 24, fill: '#c8b39a', stroke: '#16171a', 'stroke-width': 1.5 }, g); el('rect', { x: -14, y: -12, width: 28, height: 4, fill: '#f2b705' }, g); },
  campus: (g) => { el('rect', { x: -16, y: -16, width: 32, height: 16, fill: '#b46a52', stroke: '#16171a', 'stroke-width': 1.5 }, g); el('rect', { x: -4, y: -32, width: 8, height: 16, fill: '#9b5b47', stroke: '#16171a', 'stroke-width': 1.5 }, g); el('circle', { cx: 0, cy: -25, r: 2.5, fill: '#f4efe4' }, g); },
  uhome: (g) => { el('rect', { x: -14, y: -22, width: 28, height: 22, fill: '#e6e1d7', stroke: '#16171a', 'stroke-width': 1.5 }, g); },
  clinic: (g) => { el('rect', { x: -16, y: -18, width: 32, height: 18, fill: '#f1f1ee', stroke: '#16171a', 'stroke-width': 1.5 }, g); el('path', { d: 'M-3 -15h6v4h4v6h-4v4h-6v-4h-4v-6h4z', fill: '#00933c' }, g); },
  port: (g) => { el('rect', { x: -16, y: -6, width: 10, height: 6, fill: '#b03a2e' }, g); el('rect', { x: -4, y: -6, width: 10, height: 6, fill: '#1f4e79' }, g); el('rect', { x: -10, y: -12, width: 10, height: 6, fill: '#d4ac0d' }, g); el('path', { d: 'M10 0V-26h2V0M8 -24h18', stroke: '#e0a22a', 'stroke-width': 2.5, fill: 'none' }, g); },
  books: (g) => { el('rect', { x: -16, y: -14, width: 32, height: 14, fill: '#9e5d4a', stroke: '#16171a', 'stroke-width': 1.5 }, g); [['#a5584a', -12], ['#0039a6', -16], ['#f2b705', -20]].forEach(([c, y], i) => el('rect', { x: -10 + i * 2, y, width: 16, height: 4, fill: c }, g)); },
  studio: (g) => { el('rect', { x: -14, y: -12, width: 28, height: 12, fill: '#f6efe4', stroke: '#16171a', 'stroke-width': 1.5 }, g); el('rect', { x: -9, y: -24, width: 18, height: 13, rx: 2, fill: '#16171a' }, g); el('rect', { x: -7, y: -22, width: 14, height: 9, fill: '#ffd1dc' }, g); },
  cinema: (g) => { el('rect', { x: -16, y: -20, width: 32, height: 20, fill: '#e8dcc8', stroke: '#16171a', 'stroke-width': 1.5 }, g); el('rect', { x: -18, y: -32, width: 5, height: 22, fill: '#da291c' }, g); el('rect', { x: -12, y: -9, width: 24, height: 3, fill: '#ffd27a' }, g); },
  arcade: (g) => { el('rect', { x: -16, y: -14, width: 32, height: 14, fill: '#2c2f36', stroke: '#16171a', 'stroke-width': 1.5 }, g); el('rect', { x: -10, y: -11, width: 20, height: 4, fill: '#d58fe3' }, g); },
  courts: (g) => { el('rect', { x: -18, y: -10, width: 36, height: 10, fill: '#c27c4e', stroke: '#fff', 'stroke-width': 1.2 }, g); el('line', { x1: 0, y1: -10, x2: 0, y2: 0, stroke: '#fff', 'stroke-width': 1.2 }, g); },
  nonstop: (g) => { el('rect', { x: -12, y: -10, width: 24, height: 10, fill: '#f4f3ef', stroke: '#16171a', 'stroke-width': 1.5 }, g); el('path', { d: 'M-12 -10a12 12 0 0 1 24 0z', fill: '#dfe3e7', stroke: '#16171a', 'stroke-width': 1.5 }, g); el('line', { x1: 2, y1: -16, x2: 12, y2: -28, stroke: '#16171a', 'stroke-width': 3, 'stroke-linecap': 'round' }, g); },
};
const SIDE = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

export function renderFallback(host, { stations, dests, projById, onDest }) {
  const svg = el('svg', { class: 'fallback-map', viewBox: '0 0 1000 640', role: 'group', 'aria-label': 'Map of Kevin Yu’s city: the K Line loop and a building for each project' });
  host.appendChild(svg);
  el('rect', { x: 160, y: 110, width: 680, height: 420, rx: 70, class: 'loop-line' }, svg);
  el('path', { d: 'M520 110 l-10 -7 v14 z', class: 'loop-arrow' }, svg);
  const byStation = {};
  dests.forEach((d) => { (byStation[d.station] = byStation[d.station] || []).push(d); });
  stations.forEach((st) => {
    const [x, y, side] = POS[st.id]; const [ox, oy] = SIDE[side];
    el('rect', { x: x - 21, y: y - 12, width: 42, height: 24, rx: 7, class: 'loop-stn' }, svg);
    const code = el('text', { x, y: y + 5, 'text-anchor': 'middle', class: 'loop-code' }, svg); code.textContent = st.code;
    const nm = el('text', { x: x - ox * 30 - (side === 'e' ? 0 : 0), y: y - oy * 26 + (side === 'n' ? 6 : side === 's' ? -2 : 4), 'text-anchor': side === 'e' ? 'end' : side === 'w' ? 'start' : 'middle', class: 'loop-name' }, svg); nm.textContent = st.name;
    const list = byStation[st.id] || [];
    list.forEach((d, k) => {
      const spread = (k - (list.length - 1) / 2) * 72;
      const bx = x + ox * 58 + (oy ? spread : 0); const by = y + oy * 58 + (ox ? spread : 0) + (oy < 0 ? 0 : oy > 0 ? 34 : 14);
      const g = el('g', { class: 'loop-dest', transform: `translate(${bx} ${by})`, tabindex: '0', role: 'button', 'aria-label': `${d.name}, ${st.code} ${st.name}. Open.` }, svg);
      el('rect', { x: -34, y: -50, width: 68, height: 72, rx: 10, class: 'loop-hit' }, g);
      (ICON[d.landmark] || ICON.uhome)(g);
      const t = el('text', { y: 16, 'text-anchor': 'middle', class: 'loop-dlabel' }, g); t.textContent = d.short || d.name;
      const go = () => onDest(d);
      g.addEventListener('click', go);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  });
  const c = el('text', { x: 500, y: 330, 'text-anchor': 'middle', class: 'loop-centre' }, svg); c.textContent = 'Kevin’s city';
  const c2 = el('text', { x: 500, y: 356, 'text-anchor': 'middle', class: 'loop-centre-sub' }, svg); c2.textContent = 'The K Line runs clockwise and never ends.';
  return { svg };
}
