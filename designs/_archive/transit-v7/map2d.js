/* Kevin Metro · the 2D map
   The same network as the 3D city, drawn flat as a metro diagram: thick strokes in the line colours, white
   interchange rings that join the lines, station names, a pin for every building, a moving marker for every
   train and one for the visitor. It reads the same sim.js as the 3D city, so a ride, a change of line and an
   arrival look the same here. It is a full version of the site: everything can be done without leaving it,
   and it is what shows when WebGL is not available. One SVG, rebuilt on resize; only the markers move. */
import { WORLD, coastX } from './city-data.js';
import { MAP_SIDE, HUB_R } from './network.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
const PARK = WORLD.districts.park; // [x0, x1, z0, z1]
// where station names sit when the map is turned for a tall screen (a station not listed here falls back to its own side, turned)
const TALL_SIDE = { sports: 'left', westgate: 'left', eastgate: 'left', harbour: 'left', kevin: 'right', hackhall: 'above', medical: 'below', studio: 'below', oldtown: 'above', party: 'above', arcade: 'above-right', jazz: 'below', cinema: 'below-right', university: 'right', dailyai: 'below', nonstop: 'right' };
const BOX = { x0: -815, x1: 950, z0: -578, z1: 578 };

export function createMap2D(host, { net, dests, plots, sim, reduce, onStation, onDest }) {
  const root = document.createElement('div'); root.className = 'map2d'; root.hidden = true;
  const svg = el('svg', { class: 'map2d-svg', role: 'group', 'aria-label': 'Kevin Metro network map: six lines, sixteen stations' }, root);
  host.appendChild(root);
  let W = 1; let H = 1; let k = 1; let ox = 0; let oy = 0; let portrait = false; let route = null; let current = null;
  const view = { s: 1, x: 0, y: 0 };
  // world metres to map pixels. On a tall screen the map is turned so the sea is at the bottom, as in the 3D city
  const P = (x, z) => (portrait ? [ox - z * k, oy + x * k] : [ox + x * k, oy + z * k]);
  const pathOf = (pts) => pts.map(([x, z], i) => { const [X, Y] = P(x, z); return `${i ? 'L' : 'M'}${X.toFixed(1)} ${Y.toFixed(1)}`; }).join('');
  const linePts = (l, s0 = 0, s1 = l.L) => { const out = []; const n = Math.max(2, Math.ceil((s1 - s0) / 6)); for (let i = 0; i <= n; i++) { const a = l.at(s0 + ((s1 - s0) * i) / n).p; out.push([a.x, a.z]); } return out; };
  // a spoke is drawn right into the hub, so the lines visibly meet there
  const fullPts = (l) => { const pts = linePts(l); if (l.closed) { pts.push(pts[0]); return pts; } const hub = net.stations.find((st) => st.hub && st.lines.includes(l.id)); if (hub && Math.hypot(pts[0][0] - hub.pos[0], pts[0][1] - hub.pos[1]) < 60) pts.unshift([hub.pos[0], hub.pos[1]]); return pts; };
  let gView; let gRoute; let gTrains; let pin; const trainEls = []; const lineEls = {}; const stEls = {};

  function build() {
    const r = host.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); portrait = W < H * 0.85;
    const padT = 14; const padB = portrait ? 96 : 84; const bw = portrait ? BOX.z1 - BOX.z0 : BOX.x1 - BOX.x0; const bh = portrait ? BOX.x1 - BOX.x0 : BOX.z1 - BOX.z0;
    k = Math.min((W - 28) / bw, (H - padT - padB) / bh);
    const cxw = (BOX.x0 + BOX.x1) / 2; const czw = (BOX.z0 + BOX.z1) / 2; ox = 0; oy = 0; const [mx, my] = P(cxw, czw); ox = W / 2 - mx; oy = padT + (H - padT - padB) / 2 - my;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H); svg.textContent = '';
    gView = el('g', {}, svg);
    // the ground: land, sea, river, the park
    const land = el('g', { class: 'm-ground', 'aria-hidden': 'true' }, gView);
    const corner = (x, z) => P(x, z).map((v) => v.toFixed(1)).join(' ');
    const coast = []; for (let z = BOX.z0; z <= BOX.z1; z += 40) coast.push([coastX(z), z]);
    el('path', { class: 'm-sea', d: `M${corner(BOX.x1, BOX.z0)} L${coast.map(([x, z]) => corner(x, z)).join(' L')} L${corner(BOX.x1, BOX.z1)} Z` }, land);
    el('path', { class: 'm-land', d: `M${corner(BOX.x0, BOX.z0)} L${coast.map(([x, z]) => corner(x, z)).join(' L')} L${corner(BOX.x0, BOX.z1)} Z` }, land);
    el('path', { class: 'm-water', d: `M${corner(BOX.x0, WORLD.river.z0)} L${corner(coastX(WORLD.river.z0) + 4, WORLD.river.z0)} L${corner(coastX(WORLD.river.z1) + 4, WORLD.river.z1)} L${corner(BOX.x0, WORLD.river.z1)} Z` }, land);
    el('path', { class: 'm-park', d: `M${corner(PARK[0], PARK[2])} L${corner(PARK[1], PARK[2])} L${corner(PARK[1], PARK[3])} L${corner(PARK[0], PARK[3])} Z` }, land);
    // the lines: a white casing under a thick stroke in the line colour
    const gl = el('g', { class: 'm-lines', 'aria-hidden': 'true' }, gView);
    const lw = Math.max(5, Math.min(9, k * 20));
    net.lines.forEach((l) => { const d = pathOf(fullPts(l)); const g = el('g', { class: 'm-line', 'data-line': l.id }, gl); el('path', { d, class: 'm-casing', 'stroke-width': lw + 5 }, g); el('path', { d, stroke: l.def.css, 'stroke-width': lw }, g); lineEls[l.id] = g; });
    gRoute = el('g', { class: 'm-route', 'aria-hidden': 'true' }, gView);
    // empty plots, and a pin for every building, tied to its station
    const gp = el('g', { class: 'm-pins' }, gView);
    plots.forEach((pl) => { const [X, Y] = P(pl.plot.x, pl.plot.z); const g = el('g', { class: 'm-plot' }, gp); el('rect', { x: X - 5, y: Y - 5, width: 10, height: 10, rx: 2 }, g); el('title', {}, g).textContent = 'Next project: under construction, still searching'; });
    dests.forEach((d) => {
      const st = net.stById[d.station]; const lm = d.plot || { x: st.pos[0], z: st.pos[1] }; const [X, Y] = P(lm.x, lm.z); const [SX, SY] = P(st.pos[0], st.pos[1]);
      const g = el('g', { class: 'm-pin', role: 'button', tabindex: '0', 'aria-label': `${d.name}, at ${st.name}` }, gp);
      el('path', { class: 'm-leader', d: `M${SX.toFixed(1)} ${SY.toFixed(1)} L${X.toFixed(1)} ${Y.toFixed(1)}` }, g);
      el('circle', { class: 'm-hit', cx: X, cy: Y, r: 20 }, g);
      el('rect', { class: 'm-pin-dot', x: X - 6, y: Y - 6, width: 12, height: 12, rx: 3, fill: d.css || '#16171a' }, g);
      if (!portrait) { // the name goes on the side away from the station; names under a row of pins step down in turn so they do not run together
        const vert = Math.abs(Y - SY) > Math.abs(X - SX) * 0.8; const right = X >= SX; const below = Y >= SY; const step = vert ? (Math.round(X / 60) % 2) * 12 : 0;
        const t = el('text', { class: 'm-pin-name', x: vert ? X + (right ? -7 : 7) : X + (right ? 11 : -11), y: vert ? Y + (below ? 19 : -11) : Y + 4, 'text-anchor': vert ? (right ? 'start' : 'end') : right ? 'start' : 'end' }, g); t.textContent = d.short || d.name; }
      const go = () => onDest(d); g.addEventListener('click', go); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    // stations: a dot on a single line; a white ring that joins the lines at an interchange; one large ring at the hub
    const gs = el('g', { class: 'm-stations' }, gView);
    net.stations.forEach((st) => {
      const [X, Y] = P(st.pos[0], st.pos[1]); const inter = st.lines.length > 1;
      const g = el('g', { class: `m-st${inter ? ' is-inter' : ''}${st.hub ? ' is-hub' : ''}`, role: 'button', tabindex: '0', 'data-st': st.id, 'aria-label': `${st.name} station, ${st.lines.map((l) => (l === 'c' ? 'Circle' : `Line ${l}`)).join(' and ')}. Ride here` }, gs);
      const rr = st.hub ? Math.max(15, HUB_R * k * 1.25) : inter ? Math.max(8.5, lw * 1.15) : Math.max(5.5, lw * 0.8);
      el('circle', { class: 'm-hit', cx: X, cy: Y, r: Math.max(22, rr + 8) }, g);
      el('circle', { class: 'm-ring', cx: X, cy: Y, r: rr, stroke: inter ? '#16171a' : net.byId[st.lines[0]].def.css }, g);
      if (st.hub) { // where each colour comes in, and a K in the middle
        st.lines.forEach((lid) => { const l = net.byId[lid]; const ps = net.stopOn(lid, st.id); [-1, 1].forEach((sg) => { const a = l.at(ps.s + sg * 46).p; const dx = a.x - st.pos[0]; const dz = a.z - st.pos[1]; const dd = Math.hypot(dx, dz); if (dd < 20) return; const [qx, qy] = P(st.pos[0] + (dx / dd) * 10, st.pos[1] + (dz / dd) * 10); const ux = qx - X; const uy = qy - Y; const ul = Math.hypot(ux, uy) || 1; el('circle', { cx: X + (ux / ul) * rr * 0.62, cy: Y + (uy / ul) * rr * 0.62, r: Math.max(2.6, rr * 0.17), fill: l.def.css }, g); }); });
        el('text', { class: 'm-k', x: X, y: Y + rr * 0.24, 'text-anchor': 'middle', 'font-size': rr * 0.66 }, g).textContent = 'K';
      } else if (inter) st.lines.forEach((lid, i) => el('circle', { cx: X + (i ? 1 : -1) * rr * 0.36, cy: Y, r: rr * 0.26, fill: net.byId[lid].def.css }, g));
      // the name, on the side the registry asks for
      const side = MAP_SIDE[st.id] || 'right'; const off = rr + 7; let dx = 0; let dy = 4; let anchor = 'middle';
      const sd = portrait ? TALL_SIDE[st.id] || { above: 'left', below: 'right', left: 'below', right: 'above', 'above-right': 'above-left', 'above-left': 'below-left', 'below-right': 'above-right', 'below-left': 'below-right' }[side] || side : side;
      if (sd.includes('above')) dy = -off; if (sd.includes('below')) dy = off + 10; if (sd.includes('left')) { dx = sd === 'left' ? -off : -off * 0.6; anchor = 'end'; } if (sd.includes('right')) { dx = sd === 'right' ? off : off * 0.6; anchor = 'start'; }
      el('text', { class: 'm-name', x: X + dx, y: Y + dy, 'text-anchor': anchor }, g).textContent = st.name;
      const go = () => onStation(st.id); g.addEventListener('click', go); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      stEls[st.id] = g;
    });
    // pin names that would run into a station name or another pin name move down a line at a time until they are clear
    requestAnimationFrame(() => {
      const hit = (a, b) => a.x < b.x + b.width + 3 && b.x < a.x + a.width + 3 && a.y < b.y + b.height + 1 && b.y < a.y + a.height + 1;
      const fixed = Array.from(gView.querySelectorAll('.m-name')).map((n) => n.getBBox());
      gView.querySelectorAll('.m-pin-name').forEach((n) => {
        for (let k = 0; k < 2; k++) { const bb = n.getBBox(); if (!fixed.some((f) => hit(bb, f))) break; n.setAttribute('y', +n.getAttribute('y') + 14); }
        fixed.push(n.getBBox());
      });
    });
    // every train, and the visitor
    gTrains = el('g', { class: 'm-trains', 'aria-hidden': 'true' }, gView); trainEls.length = 0;
    sim.trains.forEach((t) => { const g = el('g', { class: 'm-train' }, gTrains); el('rect', { x: -12, y: -5.5, width: 24, height: 11, rx: 5.5, fill: t.line.def.css }, g); el('circle', { cx: 7, cy: 0, r: 2.2, fill: '#fff' }, g); trainEls.push(g); });
    pin = el('g', { class: 'm-me' }, gView); el('circle', { class: 'm-me-pulse', r: 13 }, pin); el('circle', { class: 'm-me-dot', r: 7.5 }, pin); el('circle', { r: 2.6, fill: '#fff' }, pin);
    applyView(); setRoute(route); highlight(current); place();
  }
  const applyView = () => { view.s = Math.max(1, Math.min(4, view.s)); const mx = (W * (view.s - 1)); const my = (H * (view.s - 1)); view.x = Math.min(0, Math.max(-mx, view.x)); view.y = Math.min(0, Math.max(-my, view.y)); gView.setAttribute('transform', `translate(${view.x.toFixed(1)} ${view.y.toFixed(1)}) scale(${view.s.toFixed(3)})`); };
  function place() {
    sim.trains.forEach((t, i) => { const a = t.line.at(t.s); const [X, Y] = P(a.p.x, a.p.z); const [X2, Y2] = P(a.p.x + a.t.x * t.dir, a.p.z + a.t.z * t.dir); trainEls[i].setAttribute('transform', `translate(${X.toFixed(1)} ${Y.toFixed(1)}) rotate(${((Math.atan2(Y2 - Y, X2 - X) * 180) / Math.PI).toFixed(1)})`); });
    const p = sim.pax.pos; let [X, Y] = P(p.x, p.z);
    if (sim.pax.aboard) { const t = sim.trainOf(sim.pax.aboard); const a = t.line.at(t.s).p; [X, Y] = P(a.x, a.z); }
    pin.setAttribute('transform', `translate(${X.toFixed(1)} ${Y.toFixed(1)})`);
  }
  // the trip: its legs drawn bold, the other lines dimmed
  function setRoute(legs) {
    route = legs && legs.length ? legs : null; if (!gRoute) return; gRoute.textContent = '';
    net.lines.forEach((l) => lineEls[l.id].classList.toggle('is-dim', !!route && !route.some((lg) => lg.line === l.id)));
    Object.values(stEls).forEach((g) => g.classList.remove('is-via', 'is-end'));
    if (!route) return;
    const lw = Math.max(5, Math.min(9, k * 20));
    route.forEach((lg, i) => {
      const l = net.byId[lg.line]; const a = net.stopOn(l.id, lg.from).s; let b = net.stopOn(l.id, lg.to).s; if (l.closed && b < a) b += l.L;
      const d = pathOf(linePts(l, Math.min(a, b), Math.max(a, b)));
      el('path', { d, class: 'm-casing', 'stroke-width': lw + 10 }, gRoute); el('path', { d, stroke: l.def.css, 'stroke-width': lw + 4 }, gRoute);
      if (i) stEls[lg.from] && stEls[lg.from].classList.add('is-via');
    });
    const last = route[route.length - 1]; stEls[last.to] && stEls[last.to].classList.add('is-end');
  }
  function highlight(sid) { current = sid; Object.entries(stEls).forEach(([id, g]) => g.classList.toggle('is-current', id === sid)); }

  // wheel and pinch zoom, drag to move: the map stays inside its frame
  const pts = new Map(); let pinch = 0; let drag = null; let moved = false;
  const zoom = (f, cx, cy) => { const s0 = view.s; view.s = Math.max(1, Math.min(4, s0 * f)); const q = view.s / s0; view.x = cx - (cx - view.x) * q; view.y = cy - (cy - view.y) * q; applyView(); };
  root.addEventListener('wheel', (e) => { e.preventDefault(); const r = root.getBoundingClientRect(); zoom(Math.exp(-e.deltaY * 0.0016), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  root.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); moved = false; if (pts.size === 1) drag = [e.clientX, e.clientY, view.x, view.y]; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
  root.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); const r = root.getBoundingClientRect(); zoom(d / pinch, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); pinch = d; moved = true; return; }
    if (drag && view.s > 1 && Math.hypot(e.clientX - drag[0], e.clientY - drag[1]) > 4) { moved = true; view.x = drag[2] + e.clientX - drag[0]; view.y = drag[3] + e.clientY - drag[1]; applyView(); }
  });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; if (!pts.size) drag = null; };
  root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up);
  root.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);

  let on = false; let raf = 0;
  const frame = (now) => { if (!on) return; raf = requestAnimationFrame(frame); if (document.hidden) return; sim.advance(now); place(); };
  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { if (on) build(); }) : null; if (ro) ro.observe(host);
  return {
    el: root,
    show(v) { on = !!v; root.hidden = !on; cancelAnimationFrame(raf); if (on) { build(); raf = requestAnimationFrame(frame); } },
    shown: () => on, setRoute, highlight,
    zoomBy(f) { zoom(f, W / 2, H / 2); }, reset() { view.s = 1; view.x = 0; view.y = 0; applyView(); },
    // where a station is on the page, for tests and for pointing at it
    pointOf(sid) { const st = net.stById[sid]; const [X, Y] = P(st.pos[0], st.pos[1]); const r = root.getBoundingClientRect(); return [r.left + view.x + X * view.s, r.top + view.y + Y * view.s]; },
  };
}
