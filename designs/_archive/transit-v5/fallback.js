/* Kevin Metro · 2D fallback
   Without WebGL the city becomes its network map: the six lines drawn the way a metro map draws them,
   every station a roundel, every headquarters a labelled button beside its station. */
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };

import { MAP_SIDE } from './network.js';

const SIDE = { right: [12, 4, 'start'], left: [-12, 4, 'end'], above: [0, -12, 'middle'], below: [0, 20, 'middle'], 'above-left': [-8, -10, 'end'], 'above-right': [8, -10, 'start'], 'below-left': [-8, 18, 'end'], 'below-right': [8, 18, 'start'] };
export function renderFallback(host, { net, dests, onDest }) {
  const X = (x) => (x + 820) * 0.62; const Y = (z) => (z + 580) * 0.62;
  const svg = el('svg', { class: 'fallback-map', viewBox: `0 0 ${X(820)} ${Y(580)}`, role: 'group', 'aria-label': 'Network map of Kevin Yu’s city: six lines, one for each kind of work' });
  host.appendChild(svg);
  el('rect', { x: X(-800), y: Y(170), width: X(800) - X(-800), height: Y(230) - Y(170), fill: '#cfe0e6' }, svg);
  const path = (l) => { const pts = l.samples.filter((_, i) => i % 3 === 0).map(([x, z]) => [X(x), Y(z)]); if (['2', '3', '4', '5'].includes(l.id)) pts.unshift([X(0), Y(0)]); return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') + (l.closed ? 'Z' : ''); };
  net.lines.forEach((l) => el('path', { d: path(l), class: 'net-casing' }, svg));
  net.lines.forEach((l) => el('path', { d: path(l), class: 'net-line', stroke: l.def.css }, svg));
  net.stations.forEach((st) => {
    const ps = Object.values(st.at); const x = st.id === 'kevin' ? 0 : ps.reduce((a, p) => a + p[0], 0) / ps.length; const z = st.id === 'kevin' ? 0 : ps.reduce((a, p) => a + p[1], 0) / ps.length;
    const inter = st.lines.length > 1;
    el('circle', { cx: X(x), cy: Y(z), r: st.id === 'kevin' ? 13 : inter ? 8.5 : 6.5, class: 'net-stn', stroke: inter ? '#16171a' : net.byId[st.lines[0]].def.css }, svg);
    const [dx, dy, anchor] = SIDE[MAP_SIDE[st.id] || 'right']; const t = el('text', { x: X(x) + dx, y: Y(z) + dy, 'text-anchor': anchor, class: 'net-name' }, svg); t.textContent = st.name;
  });
  const byStation = {};
  dests.forEach((d) => { (byStation[d.station] = byStation[d.station] || []).push(d); });
  Object.entries(byStation).forEach(([sid, list]) => {
    const st = net.stById[sid]; const ps = Object.values(st.at); const x = sid === 'kevin' ? 0 : ps.reduce((a, p) => a + p[0], 0) / ps.length; const z = sid === 'kevin' ? 0 : ps.reduce((a, p) => a + p[1], 0) / ps.length;
    list.forEach((d, k) => {
      const w = 18 + (d.short || d.name).length * 7.1; const side = MAP_SIDE[sid] || 'right'; const left = side.includes('left'); const below = side.includes('above') ? 8 : side.includes('below') ? 26 : 10;
      const g = el('g', { class: 'loop-dest', transform: `translate(${left ? X(x) - 12 - w : X(x) + 12} ${Y(z) + below + k * 22})`, tabindex: '0', role: 'button', 'aria-label': `${d.name}, ${st.name}. Open.` }, svg);
      el('rect', { x: 0, y: -2, width: w, height: 19, rx: 9.5, class: 'net-pill' }, g);
      el('circle', { cx: 9, cy: 7.5, r: 4, fill: d.css }, g);
      const t = el('text', { x: 17, y: 12, class: 'loop-dlabel' }, g); t.textContent = d.short || d.name;
      const go = () => onDest(d);
      g.addEventListener('click', go);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  });
  return { svg };
}
