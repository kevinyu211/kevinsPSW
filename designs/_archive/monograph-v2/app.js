/* Monograph · Kevin Yu
   Every project is a numbered plate with its own line drawing. A tiny 3D→2D projector draws
   each object as hairlines in one SVG, assembling it edge by edge and turning it slowly. */
(() => {
  'use strict';

  const KY = window.KY;
  if (!KY) return;
  const doc = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = matchMedia('(max-width: 900px)');
  const finePointer = matchMedia('(pointer: fine)').matches;
  const G = window.gsap;
  const ST = window.ScrollTrigger;
  const FlipP = window.Flip;
  const motion = !!G && !reduce;
  if (G) { if (ST) G.registerPlugin(ST); if (FlipP) G.registerPlugin(FlipP); }
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const STATUS = { live: 'Live', testing: 'In testing', building: 'Building', done: 'Done', parked: 'Parked' };

  /* ------------------------------------------------------------------
     Plates: projects in category order, numbered 01…
     ------------------------------------------------------------------ */
  const order = KY.categories.map((c) => c.id);
  const plates = KY.projects.slice().sort((a, b) => (order.indexOf(a.category) - order.indexOf(b.category)) || ((a.status === 'parked') - (b.status === 'parked')));
  plates.forEach((p, i) => { p.no = pad(i + 1); });
  const byId = Object.fromEntries(plates.map((p) => [p.id, p]));

  /* ------------------------------------------------------------------
     Geometry: tiny helpers that return edges [[x,y,z],[x,y,z]]
     ------------------------------------------------------------------ */
  const V = (x, y, z) => [x, y, z];
  const box = (c, s) => {
    const [x, y, z] = c; const [w, h, d] = s.map((v) => v / 2);
    const v = [V(x - w, y - h, z - d), V(x + w, y - h, z - d), V(x + w, y + h, z - d), V(x - w, y + h, z - d),
      V(x - w, y - h, z + d), V(x + w, y - h, z + d), V(x + w, y + h, z + d), V(x - w, y + h, z + d)];
    return [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].map(([a, b]) => [v[a], v[b]]);
  };
  const poly = (pts, closed = true) => {
    const out = [];
    for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) out.push([pts[i], pts[(i + 1) % pts.length]]);
    return out;
  };
  // Circle in a plane: 'xz' (flat), 'xy' (facing viewer), 'yz' (side)
  const circle = (c, r, plane = 'xz', n = 28, a0 = 0, a1 = Math.PI * 2) => {
    const pts = [];
    const closed = Math.abs(a1 - a0 - Math.PI * 2) < 1e-6;
    const steps = closed ? n : n;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      const u = Math.cos(a) * r; const w = Math.sin(a) * r;
      if (plane === 'xz') pts.push(V(c[0] + u, c[1], c[2] + w));
      else if (plane === 'xy') pts.push(V(c[0] + u, c[1] + w, c[2]));
      else pts.push(V(c[0], c[1] + u, c[2] + w));
    }
    if (closed) pts.pop();
    return poly(pts, closed);
  };
  const seg = (a, b) => [[a, b]];
  const rectY = (y, x0, x1, z0, z1) => poly([V(x0, y, z0), V(x1, y, z0), V(x1, y, z1), V(x0, y, z1)]);
  const rectZ = (z, x0, x1, y0, y1) => poly([V(x0, y0, z), V(x1, y0, z), V(x1, y1, z), V(x0, y1, z)]);
  const rectX = (x, z0, z1, y0, y1) => poly([V(x, y0, z0), V(x, y0, z1), V(x, y1, z1), V(x, y1, z0)]);

  // Each object: { g: guide edges, e: ink edges, a: accent edges }
  const OBJECTS = {
    hirvo() {
      const e = []; const a = [];
      for (let i = 0; i < 3; i++) e.push(...box([i * 0.09 - 0.09, -0.36 + i * 0.13, -i * 0.09 + 0.09], [1.3, 0.035, 1.7]));
      const top = -0.36 + 2 * 0.13 + 0.02; const dx = 0.09; const dz = -0.09;
      [[-0.5, 0.25], [-0.5, 0.05], [-0.5, 0.3], [-0.5, -0.1], [-0.5, 0.2], [-0.5, -0.25]].forEach(([x0, x1], j) => {
        const z = -0.62 + j * 0.2 + dz;
        e.push(...seg(V(x0 + dx, top, z), V(x1 + dx, top, z)));
      });
      a.push(...poly([V(0.18 + dx, top, 0.42 + dz), V(0.3 + dx, top, 0.58 + dz), V(0.56 + dx, top, 0.18 + dz)], false));
      return { g: rectY(-0.9, -1.1, 1.1, -1.2, 1.2), e, a };
    },
    trade() {
      const e = [...box([0, -0.45, 0], [1.3, 0.9, 1.0])];
      [-0.6, -0.3].forEach((y) => e.push(...seg(V(-0.65, y, 0.5), V(0.65, y, 0.5)), ...seg(V(0.65, y, 0.5), V(0.65, y, -0.5))));
      e.push(...seg(V(-0.65, -0.9, 0.5), V(0.65, 0, 0.5)));
      e.push(...circle([0, 0.55, 0], 0.5, 'xz', 30), ...circle([0, 0.55, 0], 0.5, 'yz', 30));
      e.push(...seg(V(0, 0.05, 0), V(0, 0, 0)));
      const a = circle([0, 0.55, 0], 0.5, 'xy', 30);
      return { g: rectY(-0.9, -1.1, 1.1, -0.9, 0.9), e, a };
    },
    court() {
      const e = [...box([0, -0.2, 0], [0.95, 0.08, 1.9])];
      const y = -0.155;
      e.push(...rectY(y, -0.4, 0.4, -0.85, 0.85));
      e.push(...seg(V(-0.12, y, -0.8), V(0.12, y, -0.8)));
      [-0.27, 0, 0.27].forEach((cx) => {
        e.push(...rectY(y, cx - 0.1, cx + 0.1, -0.55, 0.6));
        e.push(...seg(V(cx - 0.1, y, 0.025), V(cx + 0.1, y, 0.025)));
      });
      e.push(...rectY(y, -0.32, 0.32, 0.66, 0.78));
      const a = rectY(y + 0.004, -0.37, -0.17, -0.55, 0.025);
      return { g: rectY(-0.6, -1.0, 1.0, -1.2, 1.2), e, a };
    },
    uhome() {
      const e = [...box([0, 0, 0], [1.1, 1.8, 0.8]), ...box([0, 0.97, 0], [0.5, 0.14, 0.4])];
      [-0.45, 0, 0.45].forEach((y) => e.push(...seg(V(-0.55, y, 0.4), V(0.55, y, 0.4)), ...seg(V(0.55, y, 0.4), V(0.55, y, -0.4))));
      const a = [];
      [-0.68, -0.23, 0.22, 0.67].forEach((y, fi) => [-0.32, 0, 0.32].forEach((x, wi) => {
        const r = rectZ(0.401, x - 0.09, x + 0.09, y - 0.12, y + 0.12);
        if (fi === 2 && wi === 2) a.push(...r); else e.push(...r);
      }));
      [-0.68, -0.23, 0.22, 0.67].forEach((y) => [-0.18, 0.18].forEach((z) => e.push(...rectX(0.551, z - 0.08, z + 0.08, y - 0.12, y + 0.12))));
      return { g: rectY(-0.9, -1.2, 1.2, -1.0, 1.0), e, a };
    },
    books() {
      const e = []; const a = [];
      const L = [V(0, -0.15, -0.75), V(0, -0.15, 0.75), V(-1.05, 0.05, 0.75), V(-1.05, 0.05, -0.75)];
      const R = L.map(([x, y, z]) => V(-x, y, z));
      e.push(...poly(L), ...poly(R));
      const C = [V(0, -0.33, -0.78), V(0, -0.33, 0.78), V(-1.1, -0.15, 0.78), V(-1.1, -0.15, -0.78)];
      const CR = C.map(([x, y, z]) => V(-x, y, z));
      e.push(...poly(C), ...poly(CR));
      [[-1.05, 0.05, -1.1, -0.15], [1.05, 0.05, 1.1, -0.15]].forEach(([x0, y0, x1, y1]) => [-0.75, 0.75].forEach((z) => e.push(...seg(V(x0, y0, z), V(x1, y1, z)))));
      for (let i = 0; i < 5; i++) {
        const z = -0.5 + i * 0.22;
        e.push(...seg(V(-0.18, -0.115, z), V(-0.85 + (i % 2) * 0.12, 0.015, z)));
        e.push(...seg(V(0.18, -0.115, z), V(0.85 - (i % 3) * 0.1, 0.015, z)));
      }
      a.push(...poly([V(0.02, -0.15, 0.2), V(0.12, -0.42, 0.95), V(0.2, -0.38, 0.92)], false));
      return { g: rectY(-0.6, -1.3, 1.3, -1.1, 1.1), e, a };
    },
    ipad() {
      const e = [...box([0, -0.3, 0], [1.7, 0.07, 1.25])];
      const y = -0.26;
      e.push(...rectY(y, -0.75, 0.75, -0.55, 0.55));
      e.push(...circle([-0.2, y, 0], 0.32, 'xz', 24), ...circle([-0.2, y, 0], 0.14, 'xz', 16));
      e.push(...seg(V(-0.52, y, 0), V(0.12, y, 0)));
      const p0 = V(0.95, -0.05, 0.75); const p1 = V(0.15, 0.25, -0.35);
      const off = V(0.04, 0.03, 0.03);
      const a = [
        ...seg(p0, p1), ...seg(V(p0[0] + off[0], p0[1] + off[1], p0[2] + off[2]), V(p1[0] + off[0], p1[1] + off[1], p1[2] + off[2])),
        ...seg(p1, V(0.05, 0.2, -0.5)), ...seg(V(p1[0] + off[0], p1[1] + off[1], p1[2] + off[2]), V(0.05, 0.2, -0.5)),
      ];
      return { g: rectY(-0.75, -1.2, 1.2, -1.0, 1.0), e, a };
    },
    yae() {
      const e = [...box([0, -0.2, 0], [1.2, 0.72, 0.55])];
      [[-0.32, 0.5, 0.32], [0.36, 0.46, 0.27]].forEach(([x, y, r]) => {
        e.push(...circle([x, y, 0], r, 'xy', 28), ...circle([x, y, 0], 0.06, 'xy', 10));
        for (let k = 0; k < 3; k++) { const ang = (k * Math.PI * 2) / 3; e.push(...seg(V(x + Math.cos(ang) * 0.06, y + Math.sin(ang) * 0.06, 0), V(x + Math.cos(ang) * r * 0.82, y + Math.sin(ang) * r * 0.82, 0))); }
      });
      const a = [...circle([0.22, -0.2, 0.3], 0.18, 'xy', 22), ...circle([0.22, -0.2, 0.62], 0.24, 'xy', 22)];
      [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach((ang) => a.push(...seg(V(0.22 + Math.cos(ang) * 0.18, -0.2 + Math.sin(ang) * 0.18, 0.3), V(0.22 + Math.cos(ang) * 0.24, -0.2 + Math.sin(ang) * 0.24, 0.62))));
      e.push(...seg(V(-0.6, -0.56, 0), V(-0.9, -1.0, 0.2)), ...seg(V(0.6, -0.56, 0), V(0.9, -1.0, 0.2)), ...seg(V(0, -0.56, -0.27), V(0, -1.0, -0.5)));
      return { g: rectY(-1.0, -1.1, 1.1, -0.9, 0.9), e, a };
    },
    noir() {
      const e = [...box([0, -0.25, 0], [1.8, 0.18, 1.4])];
      const y = -0.16;
      e.push(...circle([-0.2, y, 0], 0.6, 'xz', 32), ...circle([-0.2, y + 0.02, 0], 0.15, 'xz', 16), ...seg(V(-0.2, y, 0), V(-0.2, y + 0.12, 0)));
      const a = [...circle([-0.2, y + 0.02, 0], 0.42, 'xz', 30), ...circle([-0.2, y + 0.02, 0], 0.3, 'xz', 26)];
      e.push(...poly([V(0.65, y, -0.48), V(0.65, y + 0.12, -0.48), V(0.12, y + 0.1, 0.24), V(0.03, y + 0.06, 0.3)], false));
      e.push(...circle([0.65, y, -0.48], 0.09, 'xz', 12));
      return { g: rectY(-0.6, -1.2, 1.2, -1.0, 1.0), e, a };
    },
    influencers() {
      const a = [...circle([0, 0.45, 0], 0.55, 'xy', 36)];
      const e = [...circle([0, 0.45, 0], 0.45, 'xy', 32)];
      e.push(...rectZ(0.02, -0.15, 0.15, 0.18, 0.72));
      e.push(...seg(V(0, -0.1, 0), V(0, -0.65, 0)));
      [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].forEach((ang) => e.push(...seg(V(0, -0.65, 0), V(Math.cos(ang) * 0.55, -1.15, Math.sin(ang) * 0.55))));
      return { g: rectY(-1.15, -0.9, 0.9, -0.9, 0.9), e, a };
    },
    stickers() {
      const s = 0.8; const y0 = -0.6; const y1 = 0.8;
      const e = [...rectY(y0, -s, s, -s, s), ...seg(V(-s, y0, -s), V(-s, y1, -s)), ...seg(V(-s, y1, -s), V(s, y1, -s)), ...seg(V(s, y0, -s), V(s, y1, -s)),
        ...seg(V(-s, y1, -s), V(-s, y1, s)), ...seg(V(-s, y0, s), V(-s, y1, s))];
      e.push(...rectZ(-s + 0.001, 0.05, 0.55, 0.0, 0.5), ...seg(V(0.3, 0.0, -s + 0.001), V(0.3, 0.5, -s + 0.001)));
      const g = [];
      for (let i = 1; i < 4; i++) { const t = -s + (2 * s * i) / 4; g.push(...seg(V(t, y0, -s), V(t, y0, s)), ...seg(V(-s, y0, t), V(s, y0, t))); }
      const a = [...box([0.2, -0.48, 0.25], [0.32, 0.24, 0.32]), ...rectX(-s + 0.001, -0.5, -0.1, 0.05, 0.45)];
      return { g, e, a };
    },
    party() {
      const e = [...box([-0.35, -0.42, 0], [0.8, 0.07, 1.6])];
      e.push(...rectY(-0.38, -0.7, 0, -0.7, 0.7), ...circle([-0.35, -0.38, 0.2], 0.16, 'xz', 18));
      const d2 = box([0.62, -0.25, -0.4], [0.4, 0.4, 0.4]);
      e.push(...d2);
      const a = box([0.68, -0.19, 0.35], [0.46, 0.46, 0.46]);
      const pip = (x, y, z, r = 0.04) => [...seg(V(x - r, y, z), V(x + r, y, z)), ...seg(V(x, y, z - r), V(x, y, z + r))];
      a.push(...pip(0.58, 0.041, 0.25), ...pip(0.68, 0.041, 0.35), ...pip(0.78, 0.041, 0.45));
      e.push(...pip(0.62, -0.049, -0.4), ...pip(0.52, -0.049, -0.5), ...pip(0.72, -0.049, -0.3));
      return { g: rectY(-0.46, -1.1, 1.1, -1.0, 1.0), e, a };
    },
    duiyao() {
      const e = [...box([0, -0.3, 0], [1.6, 0.35, 0.6])];
      for (let i = 1; i < 7; i++) { const x = -0.8 + (1.6 * i) / 7; e.push(...seg(V(x, -0.125, -0.3), V(x, -0.125, 0.3))); }
      e.push(...poly([V(-0.8, -0.125, -0.3), V(0.8, -0.125, -0.3), V(0.8, 0.35, -0.55), V(-0.8, 0.35, -0.55)]));
      const a = [...circle([-0.25, 0.25, 0.25], 0.13, 'yz', 18), ...circle([0.25, 0.25, 0.25], 0.13, 'yz', 18),
        ...seg(V(-0.25, 0.38, 0.25), V(0.25, 0.38, 0.25)), ...seg(V(-0.25, 0.12, 0.25), V(0.25, 0.12, 0.25)), ...seg(V(0, 0.38, 0.25), V(0, 0.12, 0.25))];
      return { g: rectY(-0.48, -1.1, 1.1, -0.9, 0.9), e, a };
    },
    hackathons() {
      const e = [...box([0, -0.4, 0.15], [1.6, 0.06, 1.0])];
      e.push(...rectY(-0.369, -0.65, 0.65, -0.25, 0.25), ...rectY(-0.369, -0.22, 0.22, 0.32, 0.58));
      const S = [V(-0.8, -0.37, -0.35), V(0.8, -0.37, -0.35), V(0.8, 0.55, -0.62), V(-0.8, 0.55, -0.62)];
      e.push(...poly(S));
      const lerp = (p, q, t) => p.map((v, i) => v + (q[i] - v) * t);
      const a = [];
      [0.25, 0.4, 0.55, 0.7].forEach((t, i) => {
        const L = lerp(S[0], S[3], t); const R = lerp(S[1], S[2], t);
        a.push(...seg(lerp(L, R, 0.12 + (i % 2) * 0.06), lerp(L, R, 0.55 + (i % 3) * 0.1)));
      });
      return { g: rectY(-0.44, -1.1, 1.1, -0.9, 1.0), e, a };
    },
    pindou() {
      const e = [...box([0, -0.35, 0], [1.6, 0.05, 1.6])];
      const a = [];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const c = circle([-0.54 + i * 0.36, -0.32, -0.54 + j * 0.36], 0.09, 'xz', 10);
        if ((i + j) % 3 === 0) a.push(...c); else e.push(...c);
      }
      return { g: rectY(-0.6, -1.1, 1.1, -1.1, 1.1), e, a };
    },
  };

  /* ------------------------------------------------------------------
     Projector: a technical drawing in one SVG.
     Scene mode: the current project large, its two neighbours smaller, a drafting grid with
     grid bubbles, and dimension lines. Single mode (inside a spread): the one object.
     ------------------------------------------------------------------ */
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
  const svg = $('[data-obj]');
  const stageHome = $('[data-stage]');
  const stageSpread = $('[data-sp-stage]');
  const expoOut = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
  const normalized = (id) => {
    const o = OBJECTS[id] ? OBJECTS[id]() : OBJECTS.pindou();
    let r = 0.1;
    [...(o.e || []), ...(o.a || [])].forEach((e) => e.forEach((p) => { r = Math.max(r, Math.hypot(p[0], p[2]), Math.abs(p[1]) * 1.2); }));
    const f = 1 / r;
    const map = (list) => (list || []).map(([a, b]) => [a.map((v) => v * f), b.map((v) => v * f)]);
    return { e: map(o.e), a: map(o.a) };
  };
  const place = (edges, s, off) => edges.map(([a, b]) => [[a[0] * s + off[0], a[1] * s + off[1], a[2] * s + off[2]], [b[0] * s + off[0], b[1] * s + off[1], b[2] * s + off[2]]]);

  const draw = (() => {
    const root = svgEl('g', { class: 'scene' }, svg);
    const gGrid = svgEl('g', { class: 'g-grid' }, root);
    const gNb = svgEl('g', { class: 'g-nb' }, root);
    const gDim = svgEl('g', { class: 'g-dim' }, root);
    const gAct = svgEl('g', { class: 'g-act' }, root);
    let grid = []; let nb = []; let act = []; let dims = []; let labels = [];
    let id = null; let mode = 'scene';
    let tAct = 0; let tNb = 0; let tGrid = 0;
    let visible = true;
    const PITCH = -0.56; const YAW0 = -0.72;
    const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    let scale = 175;
    const born = performance.now();

    const lines = (g, edges, cls) => edges.map(([a, b], i) => ({ a, b, i, cls, ln: svgEl('line', cls ? { class: cls } : null, g) }));
    const clear = (g) => { while (g.firstChild) g.removeChild(g.firstChild); };

    function buildGrid() {
      clear(gGrid); labels.forEach((l) => l.node.remove()); labels = [];
      const R = mode === 'scene' ? 2.4 : 1.5; const y = -1.02; const step = mode === 'scene' ? 0.6 : 0.5;
      const edges = [];
      for (let v = -R; v <= R + 1e-6; v += step) { edges.push([[v, y, -R], [v, y, R]], [[-R, y, v], [R, y, v]]); }
      grid = lines(gGrid, edges, 'gd');
      if (mode === 'scene') {
        const letters = 'ABCDEFGHI';
        let k = 0;
        for (let v = -R; v <= R + 1e-6; v += step * 2) {
          labels.push({ p: [v, y, R + 0.32], node: svgEl('text', { class: 'tick' }, gGrid), t: letters[k] });
          labels.push({ p: [-R - 0.32, y, v], node: svgEl('text', { class: 'tick' }, gGrid), t: String(k + 1) });
          k++;
        }
        labels.forEach((l) => { l.node.textContent = l.t; });
      }
      tGrid = performance.now();
    }

    function buildDims(edgesForBox) {
      clear(gDim); dims = [];
      let mn = [9, 9, 9]; let mx = [-9, -9, -9];
      edgesForBox.forEach((e) => e.forEach((p) => p.forEach((v, i) => { mn[i] = Math.min(mn[i], v); mx[i] = Math.max(mx[i], v); })));
      const y = -1.02; const o = 0.34; const tk = 0.06;
      const out = [];
      const z = mx[2] + o; const x = mx[0] + o;
      out.push([[mn[0], y, mx[2]], [mn[0], y, z + 0.08]], [[mx[0], y, mx[2]], [mx[0], y, z + 0.08]], [[mn[0], y, z], [mx[0], y, z]]);
      out.push([[mn[0] - tk, y, z - tk], [mn[0] + tk, y, z + tk]], [[mx[0] - tk, y, z - tk], [mx[0] + tk, y, z + tk]]);
      out.push([[mx[0], y, mn[2]], [x + 0.08, y, mn[2]]], [[mx[0], y, mx[2]], [x + 0.08, y, mx[2]]], [[x, y, mn[2]], [x, y, mx[2]]]);
      out.push([[x - tk, y, mn[2] - tk], [x + tk, y, mn[2] + tk]], [[x - tk, y, mx[2] - tk], [x + tk, y, mx[2] + tk]]);
      const hx = mn[0] - o; const hz = mx[2];
      out.push([[hx, mn[1], hz], [hx, mx[1], hz]], [[hx - tk, mn[1] - tk, hz], [hx + tk, mn[1] + tk, hz]], [[hx - tk, mx[1] - tk, hz], [hx + tk, mx[1] + tk, hz]]);
      dims = lines(gDim, out, 'dm');
      const mm = (v) => String(Math.round(v * 600));
      const t1 = svgEl('text', { class: 'dimt' }, gDim); t1.textContent = mm(mx[0] - mn[0]);
      const t2 = svgEl('text', { class: 'dimt' }, gDim); t2.textContent = mm(mx[2] - mn[2]);
      const t3 = svgEl('text', { class: 'dimt' }, gDim); t3.textContent = mm(mx[1] - mn[1]);
      dims.texts = [{ node: t1, p: [(mn[0] + mx[0]) / 2, y, z + 0.16] }, { node: t2, p: [x + 0.2, y, (mn[2] + mx[2]) / 2] }, { node: t3, p: [hx - 0.12, (mn[1] + mx[1]) / 2, hz] }];
    }

    function set(next, opts = {}) {
      const nextMode = opts.mode || mode;
      const modeChanged = nextMode !== mode;
      mode = nextMode;
      if (!OBJECTS[next]) next = 'pindou';
      const same = next === id && !modeChanged;
      id = next;
      scale = mode === 'scene' ? 192 : 196;
      if (modeChanged || !grid.length) buildGrid();
      if (!same) {
        const o = normalized(next);
        clear(gAct);
        act = [...lines(gAct, o.e, ''), ...lines(gAct, o.a, 'ac')];
        act.forEach((l) => { l.done = false; });
        buildDims([...o.e, ...o.a]);
        tAct = performance.now() - (opts.assemble === false || !motion ? 100000 : 0);
      }
      clear(gNb); nb = [];
      if (mode === 'scene') {
        const i = plates.findIndex((p) => p.id === next);
        const prev = plates[(i - 1 + plates.length) % plates.length].id;
        const nxt = plates[(i + 1) % plates.length].id;
        const A = normalized(prev); const B = normalized(nxt);
        nb = [...lines(gNb, place([...A.e, ...A.a], 0.5, [-1.85, -0.5, -1.25]), 'nb'), ...lines(gNb, place([...B.e, ...B.a], 0.44, [1.7, -0.56, 1.35]), 'nb')];
        tNb = performance.now() - (motion ? 0 : 100000);
      }
      const p = byId[next];
      svg.setAttribute('aria-label', p ? `Technical line drawing for ${p.title}` : '');
      render(performance.now());
    }

    function project(p, yaw, pitch) {
      const cy = Math.cos(yaw); const sy = Math.sin(yaw);
      const cp = Math.cos(pitch); const sp = Math.sin(pitch);
      const x = p[0] * cy + p[2] * sy;
      const z = -p[0] * sy + p[2] * cy;
      const y = p[1] * cp - z * sp;
      return [300 + x * scale, 300 - y * scale];
    }
    function paint(list, t0, now, span, edgeDur, yaw, pitch, mark) {
      const t = (now - t0) / 1000; const n = list.length || 1;
      list.forEach((l) => {
        const k = motion ? expoOut(Math.max(0, Math.min(1, (t - (l.i / n) * span) / edgeDur))) : 1;
        const b = k >= 1 ? l.b : [l.a[0] + (l.b[0] - l.a[0]) * k, l.a[1] + (l.b[1] - l.a[1]) * k, l.a[2] + (l.b[2] - l.a[2]) * k];
        const p = project(l.a, yaw, pitch); const q = project(b, yaw, pitch);
        l.ln.setAttribute('x1', p[0].toFixed(1)); l.ln.setAttribute('y1', p[1].toFixed(1));
        l.ln.setAttribute('x2', q[0].toFixed(1)); l.ln.setAttribute('y2', q[1].toFixed(1));
        l.ln.style.opacity = k > 0.001 ? '' : '0';
        if (mark && !l.done && k >= 1) { l.done = true; l.ln.classList.add('set'); }
      });
      return t;
    }
    function render(now) {
      ptr.x += (ptr.tx - ptr.x) * 0.06; ptr.y += (ptr.ty - ptr.y) * 0.06;
      const life = (now - born) / 1000;
      const ta = (now - tAct) / 1000;
      const swing = motion ? -0.5 * (1 - expoOut(Math.min(1, ta / 2.4))) : 0;
      const yaw = YAW0 + (motion ? life * 0.07 + swing + ptr.x * 0.35 : 0);
      const pitch = PITCH + (motion ? ptr.y * 0.1 : 0);
      paint(grid, tGrid, now, 0.7, 0.5, yaw, pitch, false);
      paint(nb, tNb, now, 0.6, 0.45, yaw, pitch, false);
      paint(act, tAct, now, 1.3, 0.6, yaw, pitch, true);
      const td = Math.max(0, (now - tAct) / 1000 - 1.1);
      const dk = motion ? Math.min(1, td / 0.6) : 1;
      paint(dims, tAct + 1100, now, 0.4, 0.4, yaw, pitch, false);
      (dims.texts || []).forEach(({ node, p }) => { const q = project(p, yaw, pitch); node.setAttribute('x', q[0].toFixed(1)); node.setAttribute('y', (q[1] + 4).toFixed(1)); node.style.opacity = String(dk); });
      labels.forEach(({ node, p }) => { const q = project(p, yaw, pitch); node.setAttribute('x', q[0].toFixed(1)); node.setAttribute('y', (q[1] + 4).toFixed(1)); });
      root.setAttribute('transform', motion ? `translate(${(-ptr.x * 12).toFixed(1)} ${(-ptr.y * 8).toFixed(1)})` : '');
    }
    if (motion) {
      const loop = (now) => { if (visible && !document.hidden) render(now); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
      if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(svg);
      if (finePointer) addEventListener('pointermove', (e) => { ptr.tx = e.clientX / innerWidth - 0.5; ptr.ty = e.clientY / innerHeight - 0.5; }, { passive: true });
    }
    return { set, get id() { return id; }, get mode() { return mode; } };
  })();

  // A still drawing for small places (the business card).
  function stillDrawing(target, id, yaw = -0.72, pitch = -0.56) {
    const o = normalized(id);
    const s = 210;
    const pr = (p) => {
      const cy = Math.cos(yaw); const sy = Math.sin(yaw); const cp = Math.cos(pitch); const sp = Math.sin(pitch);
      const x = p[0] * cy + p[2] * sy; const z = -p[0] * sy + p[2] * cy; const y = p[1] * cp - z * sp;
      return [300 + x * s, 300 - y * s];
    };
    [[o.e, ''], [o.a, 'ac']].forEach(([list, cls]) => list.forEach(([a, b]) => {
      const p = pr(a); const q = pr(b);
      svgEl('line', { x1: p[0].toFixed(1), y1: p[1].toFixed(1), x2: q[0].toFixed(1), y2: q[1].toFixed(1), class: cls }, target);
    }));
  }

  /* ------------------------------------------------------------------
     Home: name, lede, index, caption, cursor preview
     ------------------------------------------------------------------ */
  const photoOf = (p) => {
    const c = p.cover || {};
    if (c.type === 'img') return c.src;
    if (c.type === 'video') return c.poster;
    if (c.type === 'stickers') return c.room;
    return null;
  };
  $('[data-lede]').textContent = KY.person.short;
  const index = $('[data-index]');
  KY.categories.forEach((cat) => {
    const list = plates.filter((p) => p.category === cat.id);
    if (!list.length) return;
    index.appendChild(el('li', 'group', `<span>${esc(cat.label)}</span><span>${list.length}</span>`));
    list.forEach((p) => {
      const li = el('li', 'row');
      li.dataset.id = p.id;
      const ph = photoOf(p);
      li.innerHTML = `<button class="row-btn" type="button" aria-label="Plate ${p.no}, ${esc(p.title)}. ${esc(STATUS[p.status] || '')}. Open">`
        + `<span class="row-no">${p.no}</span><span class="row-title">${esc(p.title)}</span>`
        + `<span class="row-role">${esc(p.role || '')}</span><span class="row-year">${esc(p.year || '')}</span>`
        + `<span class="row-status">${esc(STATUS[p.status] || '')}</span>`
        + `<span class="row-thumb" aria-hidden="true">${ph ? `<img src="${esc(ph)}" alt="" loading="lazy" decoding="async">` : ''}</span></button>`;
      index.appendChild(li);
    });
  });
  const rows = $$('.row', index);

  const capNo = $('[data-cap-no]'); const capTitle = $('[data-cap-title]'); const capOne = $('[data-cap-one]');
  let active = null;
  function setActive(id) {
    if (!byId[id] || id === active) return;
    active = id;
    const p = byId[id];
    rows.forEach((r) => r.classList.toggle('is-on', r.dataset.id === id));
    capNo.textContent = p.no; capTitle.textContent = p.title; capOne.textContent = p.one;
    draw.set(id, { mode: openId ? 'single' : 'scene' });
  }

  // Cursor preview: the project's real image follows the pointer over the index.
  const preview = $('[data-preview]'); const pvImg = $('img', preview);
  const pv = { x: 0, y: 0, tx: 0, ty: 0, on: false, raf: 0 };
  const pvLoop = () => {
    pv.x += (pv.tx - pv.x) * 0.18; pv.y += (pv.ty - pv.y) * 0.18;
    preview.style.transform = `translate3d(${pv.x.toFixed(1)}px, ${pv.y.toFixed(1)}px, 0)`;
    pv.raf = pv.on || Math.abs(pv.tx - pv.x) > 0.5 ? requestAnimationFrame(pvLoop) : 0;
  };
  const showPreview = (p) => {
    const src = photoOf(p);
    if (!src || !finePointer) { preview.classList.remove('is-on'); return; }
    if (pvImg.getAttribute('src') !== src) {
      preview.classList.remove('is-on', 'is-colour'); void preview.offsetWidth;
      pvImg.src = src;
    }
    pvImg.alt = '';
    preview.classList.add('is-on');
    clearTimeout(pv.ct); pv.ct = setTimeout(() => preview.classList.add('is-colour'), 260);
    pv.on = true; if (!pv.raf) pv.raf = requestAnimationFrame(pvLoop);
  };
  index.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    pv.tx = e.clientX + 28; pv.ty = e.clientY - 110;
    if (!pv.on) { pv.x = pv.tx; pv.y = pv.ty; }
  });
  index.addEventListener('pointerleave', () => { pv.on = false; preview.classList.remove('is-on', 'is-colour'); });

  let hoverT = null;
  rows.forEach((r) => {
    const btn = $('.row-btn', r);
    btn.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || narrow.matches) return;
      if (!reduce) showPreview(byId[r.dataset.id]);
      clearTimeout(hoverT); hoverT = setTimeout(() => setActive(r.dataset.id), 70);
    });
    btn.addEventListener('focus', () => setActive(r.dataset.id));
    btn.addEventListener('click', () => { openedFromPage = true; location.hash = `#/${r.dataset.id}`; });
  });
  // On phones the drawing follows whichever row crosses the middle of the screen.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (!narrow.matches) return;
      entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.dataset.id); });
    }, { rootMargin: '-58% 0px -38% 0px' });
    rows.forEach((r) => io.observe(r));
  }

  /* ------------------------------------------------------------------
     Plate spread
     ------------------------------------------------------------------ */
  const spread = $('[data-spread]');
  const main = $('#main'); const bar = $('[data-bar]');
  const sp = {
    plate: $('[data-sp-plate]'), no: $('[data-sp-no]'), title: $('[data-sp-title]'), role: $('[data-sp-role]'),
    body: $('[data-sp-body]'), facts: $('[data-sp-facts]'), links: $('[data-sp-links]'), gallery: $('[data-sp-gallery]'),
    scroller: $('.spread-body', spread),
  };
  let openId = null;
  let openedFromPage = false;
  let returnTo = null;

  function mediaNode(m) {
    if (m.type === 'img') {
      const f = el('figure', 'fig');
      const img = el('img'); img.src = m.src; img.alt = m.alt || ''; img.loading = 'lazy'; img.decoding = 'async';
      img.addEventListener('load', () => { if (img.naturalHeight > img.naturalWidth * 1.05) f.classList.add('fig-portrait'); });
      f.append(img, el('figcaption', '', esc(m.alt || '')));
      return f;
    }
    if (m.type === 'video') {
      const f = el('figure', 'fig');
      const v = el('video'); v.src = m.src; if (m.poster) v.poster = m.poster;
      v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = !reduce; v.preload = 'metadata';
      v.setAttribute('aria-label', m.alt || '');
      v.addEventListener('loadedmetadata', () => { if (v.videoHeight > v.videoWidth * 1.05) f.classList.add('fig-portrait'); });
      f.append(v, el('figcaption', '', esc(m.alt || '')));
      return f;
    }
    if (m.type === 'yt') {
      const f = el('figure', 'fig');
      const b = el('button', 'yt'); b.type = 'button';
      b.style.backgroundImage = `url(https://i.ytimg.com/vi/${m.id}/hqdefault.jpg)`;
      b.setAttribute('aria-label', `Play ${m.alt || 'video'} from YouTube`);
      b.addEventListener('click', () => {
        const fr = document.createElement('iframe');
        fr.src = `https://www.youtube-nocookie.com/embed/${m.id}?autoplay=1&rel=0`;
        fr.title = m.alt || 'YouTube video';
        fr.allow = 'autoplay; encrypted-media; picture-in-picture'; fr.allowFullscreen = true;
        const wrap = el('div', 'yt-wrap'); wrap.appendChild(fr); b.replaceWith(wrap);
      }, { once: true });
      f.append(b, el('figcaption', '', `${esc(m.alt || '')}, on YouTube`));
      return f;
    }
    return null;
  }

  function fill(p) {
    sp.plate.textContent = `Plate ${p.no} of ${pad(plates.length)}`;
    sp.no.textContent = p.no;
    sp.title.textContent = p.title;
    sp.role.textContent = [p.role, p.year, STATUS[p.status]].filter(Boolean).join(', ');
    sp.body.innerHTML = (p.body || []).map((t) => `<p>${esc(t)}</p>`).join('');
    sp.facts.innerHTML = (p.facts || []).map((f, i) => `<div><dt>${pad(i + 1)}</dt><dd>${esc(f)}</dd></div>`).join('');
    sp.facts.hidden = !(p.facts || []).length;
    const links = (p.links || []).map((l) => `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}<span class="sr"> (opens in a new tab)</span></a>`);
    if (p.private) links.push('<span class="soon">Private client tool. A demo is available on request.</span>');
    sp.links.innerHTML = links.join('');
    sp.links.hidden = !links.length;
    sp.gallery.innerHTML = '';
    (p.media || []).forEach((m) => { const n = mediaNode(m); if (n) sp.gallery.appendChild(n); });
    if (p.asins && p.asins.length) {
      const f = el('figure', 'fig');
      const strip = el('div', 'covers');
      p.asins.forEach((a) => {
        const link = el('a'); link.href = `https://www.amazon.com/dp/${a}`; link.target = '_blank'; link.rel = 'noopener';
        const img = el('img'); img.alt = 'Book cover on Amazon'; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
        img.src = `https://images-na.ssl-images-amazon.com/images/P/${a}.01.LZZZZZZZ.jpg`;
        img.addEventListener('load', () => { if (img.naturalWidth < 60) link.remove(); });
        img.addEventListener('error', () => link.remove());
        link.appendChild(img); strip.appendChild(link);
      });
      f.append(strip, el('figcaption', '', 'The books on Amazon'));
      sp.gallery.appendChild(f);
    }
    const i = plates.indexOf(p);
    $('[data-sp-prev]', spread).disabled = i === 0;
    $('[data-sp-next]', spread).disabled = i === plates.length - 1;
  }

  function open(id, animate) {
    const p = byId[id]; if (!p) return;
    const first = openId == null;
    openId = id;
    if (first) returnTo = $(`.row[data-id="${id}"] .row-btn`);
    fill(p);
    const state = first && FlipP && animate && motion ? FlipP.getState(svg) : null;
    if (first) {
      stageSpread.appendChild(svg);
      spread.hidden = false;
      main.inert = true; bar.inert = true;
      if (lenis) lenis.stop();
      doc.classList.add('has-spread');
      sp.scroller.scrollTop = 0;
    }
    if (active !== id) setActive(id);
    draw.set(id, { mode: 'single', assemble: !first });
    if (state) {
      FlipP.from(state, { duration: 0.9, ease: 'expo.inOut', absolute: true });
      G.fromTo($$('.spread-text > *, .gallery > *, .spread-bar > *', spread), { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.04, delay: 0.25, clearProps: 'transform,opacity' });
    } else if (motion && !first) {
      sp.scroller.scrollTop = 0;
      G.fromTo($$('.spread-text > *, .gallery > *', spread), { opacity: 0, x: 14 }, { opacity: 1, x: 0, duration: 0.6, ease: 'expo.out', stagger: 0.03, clearProps: 'transform,opacity' });
    }
    sp.title.focus({ preventScroll: true });
    document.title = `${p.title} · Kevin Yu`;
  }

  function close(animate) {
    if (openId == null) return;
    const state = FlipP && animate && motion ? FlipP.getState(svg) : null;
    stageHome.appendChild(svg);
    spread.hidden = true;
    sp.gallery.querySelectorAll('video').forEach((v) => v.pause());
    sp.gallery.innerHTML = '';
    main.inert = false; bar.inert = false;
    doc.classList.remove('has-spread');
    if (lenis) lenis.start();
    if (state) FlipP.from(state, { duration: 0.85, ease: 'expo.inOut', absolute: true });
    const back = $(`.row[data-id="${openId}"] .row-btn`) || returnTo;
    openId = null;
    draw.set(active, { mode: 'scene', assemble: false });
    document.title = 'Kevin Yu · Monograph';
    if (back) back.focus({ preventScroll: true });
  }

  function route(animate = true) {
    const m = location.hash.match(/^#\/([\w-]+)/);
    if (m && byId[m[1]]) open(m[1], animate);
    else close(animate);
  }
  addEventListener('hashchange', () => route(true));
  const leave = () => {
    if (openedFromPage) { openedFromPage = false; history.back(); }
    else { history.replaceState(null, '', location.pathname + location.search); route(true); }
  };
  $('[data-sp-close]', spread).addEventListener('click', leave);
  const step = (d) => {
    const i = plates.findIndex((p) => p.id === openId);
    const n = plates[i + d]; if (!n) return;
    history.replaceState(null, '', `#/${n.id}`);
    open(n.id, false);
  };
  $('[data-sp-prev]', spread).addEventListener('click', () => step(-1));
  $('[data-sp-next]', spread).addEventListener('click', () => step(1));
  spread.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); leave(); }
    if (e.key === 'ArrowRight' && !e.target.closest('a, button.yt')) step(1);
    if (e.key === 'ArrowLeft' && !e.target.closest('a, button.yt')) step(-1);
  });

  /* ------------------------------------------------------------------
     Plates: the best real visuals as an editorial sequence
     ------------------------------------------------------------------ */
  const W = '../../assets/work/';
  const PLATE_SEQ = {
    grid: [
      { id: 'hirvo', src: `${W}hirvo-builder.webp`, cap: 'Résumé builder', cls: 'pl-a' },
      { id: 'hirvo', src: `${W}hirvo-visa.webp`, cap: 'Visa sponsor browser', cls: 'pl-b' },
      { id: 'ipad', src: `${W}ipad-coloring.webp`, cap: 'Coloring a page with Apple Pencil', cls: 'pl-c' },
      { id: 'books', src: `${W}book-star-cover.webp`, cap: 'The Lost Christmas Star, cover', cls: 'pl-d' },
      { id: 'noir', video: `${W}noir-loop.mp4`, poster: `${W}noir-loop-poster.jpg`, cap: 'Window-scene loop', cls: 'pl-e' },
    ],
    run: [
      { id: 'books', src: `${W}book-crew.webp`, cap: 'The crew by the tree' },
      { id: 'stickers', stickers: true, cap: 'Stickers landing in a room' },
      { id: 'court', src: `${W}court-booking.webp`, cap: 'Choosing a half court', phone: true },
      { id: 'books', src: `${W}book-hatshop.webp`, cap: 'The hat shop' },
      { id: 'party', src: `${W}party-friends.webp`, cap: 'Pick your friends', phone: true },
      { id: 'ipad', src: `${W}ipad-shelf.webp`, cap: 'The book shelf' },
      { id: 'party', src: `${W}party-intro.webp`, cap: 'How to play', phone: true },
    ],
    tail: [
      { id: 'yae', video: `${W}yae-intro.mp4`, poster: `${W}yae-intro-poster.jpg`, cap: 'Channel intro', cls: 'pl-f' },
      { id: 'influencers', src: '../../assets/media/influencer-classic.jpg', cap: 'Ariana, the classic persona', cls: 'pl-g' },
    ],
  };
  function plateFig(it, extra = '') {
    const p = byId[it.id];
    const f = el('figure', `pl ${it.cls || ''} ${it.phone ? 'pl-phone' : ''} ${extra}`.trim());
    let media;
    if (it.video) {
      media = `<video muted loop playsinline preload="none" poster="${esc(it.poster)}" aria-label="${esc(it.cap)}"><source src="${esc(it.video)}" type="video/mp4"></video>`;
    } else if (it.stickers) {
      const c = p.cover;
      media = `<div class="stk-scene"><img class="stk-room" src="${esc(c.room)}" alt="${esc(c.alt)}" loading="lazy">${c.stickers.map((s, i) => `<img class="stk stk-${i}" src="${esc(s)}" alt="" loading="lazy">`).join('')}</div>`;
    } else {
      media = `<img src="${esc(it.src)}" alt="${esc(it.cap)}" loading="lazy" decoding="async">`;
    }
    f.innerHTML = `<a class="pl-media" href="#/${esc(it.id)}" aria-label="Open plate ${p.no}, ${esc(p.title)}">${media}</a>`
      + `<figcaption><span class="pl-no">${p.no}</span><span>${esc(p.title)}. ${esc(it.cap)}</span></figcaption>`;
    return f;
  }
  (function platesSection() {
    const grid = $('[data-plates-grid]'); const track = $('[data-run-track]'); const tail = $('[data-plates-tail]');
    PLATE_SEQ.grid.forEach((it) => grid.appendChild(plateFig(it)));
    PLATE_SEQ.run.forEach((it) => track.appendChild(plateFig(it, 'pl-run')));
    PLATE_SEQ.tail.forEach((it) => tail.appendChild(plateFig(it)));
    const figs = $$('.pl');
    // Black and white until a plate is in view; videos play only on screen.
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => entries.forEach((e) => {
        e.target.classList.toggle('is-in', e.isIntersecting);
        const v = $('video', e.target);
        if (v && !reduce) { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }
        if (e.isIntersecting && e.target.querySelector('.stk-scene') && !e.target.dataset.dropped) {
          e.target.dataset.dropped = '1';
          if (motion) G.fromTo($$('.stk', e.target), { y: -220, rotation: (i) => [-18, 14, -8, 22][i % 4], opacity: 0 }, { y: 0, rotation: (i) => [-6, 5, -3, 8][i % 4], opacity: 1, duration: 1.1, ease: 'bounce.out', stagger: 0.22, delay: 0.2 });
        }
      }), { threshold: 0.45 });
      figs.forEach((f) => io.observe(f));
    } else figs.forEach((f) => f.classList.add('is-in'));

    if (!motion || !ST) return;
    $$('.pl:not(.pl-run) .pl-media').forEach((m) => {
      G.fromTo(m, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: m, start: 'top 92%', end: 'top 42%', scrub: 0.6 } });
      const inner = m.firstElementChild;
      G.fromTo(inner, { scale: 1.14 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: m, start: 'top bottom', end: 'bottom 40%', scrub: 0.8 } });
    });
    const mm = G.matchMedia();
    mm.add('(min-width: 901px)', () => {
      const run = $('[data-run]');
      const dist = () => Math.max(0, track.scrollWidth - innerWidth);
      const tw = G.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: run, start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: 0.7, invalidateOnRefresh: true, anticipatePin: 1 } });
      $$('.pl-run', track).forEach((f) => {
        G.fromTo($('.pl-media', f), { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: f, containerAnimation: tw, start: 'left 95%', end: 'left 55%', scrub: 0.5 } });
      });
      const bar = $('[data-run-bar]');
      if (bar) G.fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: run, start: 'top top', end: () => `+=${dist()}`, scrub: true } });
    });
  })();

  /* ------------------------------------------------------------------
     Technical graphics: the timeline axis and three drawn figures
     ------------------------------------------------------------------ */
  (function timeline() {
    const host = $('[data-timeline]'); if (!host) return;
    const M = 29; const x0 = 40; const x1 = 1160; const ax = 118;
    const X = (m) => x0 + (m / M) * (x1 - x0);
    const s = svgEl('svg', { viewBox: '0 0 1200 200', class: 'tl', role: 'img', 'aria-label': 'Timeline from mid-2024 to now: first line of code mid-2024, first book on Amazon November 2025, Hirvo in 2026, a healthcare hackathon in September 2026, a book made in 15 days in October 2026, the export risk tool live in November 2026.' }, host);
    const axis = svgEl('path', { d: `M${x0} ${ax} H${x1}`, class: 'tl-axis', pathLength: 1 }, s);
    for (let m = 0; m <= M; m++) {
      const jan = (m + 5) % 12 === 0;
      svgEl('line', { x1: X(m), x2: X(m), y1: ax, y2: ax + (jan ? 14 : 6), class: 'tl-tick' }, s);
    }
    [[0, 'Mid-2024'], [7, '2025'], [19, '2026'], [M, 'Now']].forEach(([m, t]) => {
      const tx = svgEl('text', { x: X(m), y: ax + 34, class: `tl-year${t === 'Now' ? ' is-now' : ''}`, 'text-anchor': m === 0 ? 'start' : m === M ? 'end' : 'middle' }, s); tx.textContent = t;
    });
    const span = svgEl('g', { class: 'tl-ev' }, s);
    svgEl('path', { d: `M${X(19)} ${ax + 46} V${ax + 54} H${X(M)} V${ax + 46}`, class: 'tl-span' }, span);
    const st = svgEl('text', { x: X(19), y: ax + 76, class: 'tl-lab' }, span); st.textContent = 'Hirvo, co-founder & CTO';
    const EV = [[0, 'First line of code', 22], [17, 'First book on Amazon', 22], [27, 'Hackathon, Shanghai', 70], [28, 'A book in 15 days', 46], [29, 'Export risk tool live', 22]];
    const evs = [span];
    EV.forEach(([m, t, y]) => {
      const g = svgEl('g', { class: `tl-ev${m === M ? ' is-now' : ''}` }, s);
      svgEl('line', { x1: X(m), x2: X(m), y1: ax, y2: y + 6, class: 'tl-lead' }, g);
      const tx = svgEl('text', { x: X(m) + (m >= 27 ? -6 : 6), y, class: 'tl-lab', 'text-anchor': m >= 27 ? 'end' : 'start' }, g); tx.textContent = t;
      g.dataset.f = String(m / M); evs.push(g);
    });
    span.dataset.f = String(19 / M);
    if (!motion || !ST) return;
    evs.forEach((g) => { g.style.opacity = '0.08'; });
    G.fromTo(axis, { strokeDashoffset: 1, strokeDasharray: 1 }, {
      strokeDashoffset: 0, ease: 'none',
      scrollTrigger: { trigger: host, start: 'top 85%', end: 'top 35%', scrub: 0.6, onUpdate: (self) => evs.forEach((g) => { g.style.opacity = self.progress >= parseFloat(g.dataset.f) - 0.02 ? '1' : '0.08'; }) },
    });
  })();

  (function figures() {
    const host = $('[data-figures]'); if (!host) return;
    const make = (num, label, build) => {
      const f = el('figure', 'figure');
      const s = svgEl('svg', { viewBox: '0 0 360 190', class: 'fg', 'aria-hidden': 'true' }, f);
      build(s);
      const cap = el('figcaption', '', `<span class="fg-num" data-to="${num}">${num.toLocaleString('en-US')}</span><span class="fg-lab">${esc(label)}</span>`);
      f.appendChild(cap); host.appendChild(f);
    };
    const L = (s, x1, y1, x2, y2, cls = '') => svgEl('line', { x1, y1, x2, y2, class: `fl ${cls}`, pathLength: 1 }, s);
    make(9, 'books live on Amazon', (s) => {
      L(s, 6, 176, 354, 176);
      const H = [118, 140, 104, 132, 112, 152, 124, 98, 136];
      H.forEach((h, i) => {
        const x = 18 + i * 37; const w = 27; const y = 176 - h;
        const c = i === 8 ? 'ac' : '';
        L(s, x, 176, x, y, c); L(s, x, y, x + w, y, c); L(s, x + w, y, x + w, 176, c);
        L(s, x + 5, y + 16, x + w - 5, y + 16, c); L(s, x + 5, 160, x + w - 5, 160, c);
      });
    });
    make(32592, 'sanctions-list entries checked every day', (s) => {
      for (let k = 3; k >= 0; k--) {
        const x = 30 + k * 18; const y = 18 + (3 - k) * 14; const w = 230; const h = 140;
        const c = k === 0 ? 'ac' : '';
        L(s, x, y, x + w, y, c); L(s, x + w, y, x + w, y + h, c); L(s, x + w, y + h, x, y + h, c); L(s, x, y + h, x, y, c);
        if (k === 0) for (let r = 1; r < 13; r++) L(s, x + 12, y + r * 10.5, x + (r % 3 ? 190 : 140), y + r * 10.5);
      }
    });
    make(161, 'tests in the iPad app', (s) => {
      for (let i = 0; i < 161; i++) {
        const c = i % 23; const r = Math.floor(i / 23);
        const x = 14 + c * 14.5; const y = 30 + r * 20;
        L(s, x, y + 12, x + 6, y, i === 160 ? 'ac' : '');
      }
      L(s, 6, 176, 354, 176);
    });
    if (!motion || !ST) return;
    $$('.figure', host).forEach((f) => {
      const ls = $$('.fl', f); const num = $('.fg-num', f); const to = +num.dataset.to; const o = { v: 0 };
      G.set(ls, { strokeDasharray: 1, strokeDashoffset: 1 });
      num.textContent = '0';
      ST.create({ trigger: f, start: 'top 85%', once: true, onEnter: () => {
        G.to(ls, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.out', stagger: { amount: 1.4 } });
        G.to(o, { v: to, duration: 1.8, ease: 'expo.out', onUpdate: () => { num.textContent = Math.round(o.v).toLocaleString('en-US'); } });
      } });
    });
  })();

  /* ------------------------------------------------------------------
     Business card: an 85 × 55 letterpress card that turns over
     ------------------------------------------------------------------ */
  function makeCard(suffix) {
    const C = KY.contact;
    const wrap = el('div', 'bcard-wrap');
    wrap.innerHTML = `<div class="bcard" data-bcard>
      <div class="bcard-in">
        <div class="bcard-face bcard-front">
          <svg class="bcard-obj" viewBox="0 0 600 600" aria-hidden="true"></svg>
          <p class="bcard-name">Kevin Yu</p>
          <p class="bcard-role">Builder · Co-founder &amp; CTO, Hirvo</p>
          <p class="bcard-site">kevinpeiyuanyu.com</p>
        </div>
        <div class="bcard-face bcard-back" inert>
          <dl class="bcard-dl">
            <div><dt>Phone</dt><dd><a href="${esc(C.phoneHref)}">${esc(C.phone)}</a></dd></div>
            <div><dt>LinkedIn</dt><dd><a href="${esc(C.linkedin)}" target="_blank" rel="noopener">kevin-yu-5b7103327</a></dd></div>
            <div><dt>Website</dt><dd><a href="https://kevinpeiyuanyu.com">kevinpeiyuanyu.com</a></dd></div>
          </dl>
          <figure class="bcard-qr"><img src="${esc(C.wechatQr)}" alt="WeChat QR code for Kevin Yu" loading="lazy"><figcaption>WeChat</figcaption></figure>
          <div class="bcard-actions">
            <a class="bcard-btn" href="../shared/kevin-yu.vcf" download="kevin-yu.vcf">Add to contacts</a>
            <button class="bcard-btn" type="button" data-copy>Copy link</button>
          </div>
        </div>
      </div>
    </div>
    <div class="bcard-under"><button class="text-btn" type="button" data-flip aria-pressed="false">Turn the card over</button><span class="bcard-status" role="status" aria-live="polite"></span></div>`;
    stillDrawing($('.bcard-obj', wrap), 'hirvo', -0.62, -0.62);
    const card = $('[data-bcard]', wrap); const inner = $('.bcard-in', wrap);
    const front = $('.bcard-front', wrap); const back = $('.bcard-back', wrap);
    const flipBtn = $('[data-flip]', wrap); const status = $('.bcard-status', wrap);
    let flipped = false;
    const flip = () => {
      flipped = !flipped;
      card.classList.toggle('is-flipped', flipped);
      front.inert = flipped; back.inert = !flipped;
      flipBtn.setAttribute('aria-pressed', String(flipped));
      flipBtn.textContent = flipped ? 'Turn to the front' : 'Turn the card over';
    };
    card.addEventListener('click', (e) => { if (!e.target.closest('a, button')) flip(); });
    flipBtn.addEventListener('click', flip);
    $('[data-copy]', wrap).addEventListener('click', () => {
      const url = 'https://kevinpeiyuanyu.com';
      const done = () => { status.textContent = 'Link copied'; setTimeout(() => { status.textContent = ''; }, 2200); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => { status.textContent = url; });
      else status.textContent = url;
    });
    if (finePointer && !reduce) {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5; const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--rx', `${(-py * 9).toFixed(2)}deg`); card.style.setProperty('--ry', `${(px * 11).toFixed(2)}deg`);
        card.style.setProperty('--gx', `${((px + 0.5) * 100).toFixed(1)}%`); card.style.setProperty('--gy', `${((py + 0.5) * 100).toFixed(1)}%`);
      });
      card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
    }
    wrap.dataset.card = suffix;
    return wrap;
  }

  /* ------------------------------------------------------------------
     Résumé, writing, contact
     ------------------------------------------------------------------ */
  (function resume() {
    const R = KY.resume; const host = $('[data-resume]');
    const line = (label, what, when, first) => {
      const d = el('div', `co-line${first ? ' co-first' : ''}`);
      d.innerHTML = `<span class="co-label">${first ? esc(label) : ''}</span><span class="co-what">${what}</span><span class="co-when">${esc(when || '')}</span>`;
      host.appendChild(d);
    };
    R.experience.forEach((x, i) => line('Experience', `<b>${esc(x.role)}</b>${x.org ? `, ${esc(x.org)}` : ''}<span>${esc(x.note)}</span>`, x.when, i === 0));
    R.education.forEach((x, i) => line('Education', `<b>${esc(x.org)}</b>${x.note ? `<span>${esc(x.note)}</span>` : ''}`, x.when, i === 0));
    R.skills.forEach(([k, v], i) => line('Skills', `<b>${esc(k)}</b><span>${esc(v)}</span>`, '', i === 0));
    $('[data-print]').addEventListener('click', () => window.print());
  })();

  (function writing() {
    const host = $('[data-issues]');
    const fmt = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    fetch(KY.newsletter.issues).then((r) => (r.ok ? r.json() : Promise.reject(r.status))).then((data) => {
      const list = (Array.isArray(data) ? data : data.issues || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);
      host.innerHTML = list.map((it) => {
        const t = (it.en && it.en.title) || (it.zh && it.zh.title) || it.date;
        const topic = it.topic ? it.topic[0].toUpperCase() + it.topic.slice(1) : '';
        return `<li class="issue"><a href="${KY.newsletter.index}${esc(it.date)}/"><time datetime="${esc(it.date)}">${fmt(it.date)}</time><b>${esc(t)}</b><span class="topic">${esc(topic)}</span></a></li>`;
      }).join('');
      if (ST) ST.refresh();
    }).catch(() => { host.innerHTML = '<li class="issue"><a href="../../newsletter/"><b>Read the Daily AI archive</b></a></li>'; });
  })();

  (function contact() {
    const C = KY.contact;
    $('[data-asks]').textContent = `Open to ${C.asks.map((a) => (/^[A-Z][a-z]/.test(a) ? a.charAt(0).toLowerCase() + a.slice(1) : a)).join(', ').replace(/, ([^,]*)$/, ', and $1')}.`;
    const host = $('[data-contact]');
    const ways = el('div', 'ways');
    const way = (k, v) => { const d = el('div', 'way'); d.innerHTML = `<span class="way-k">${esc(k)}</span>${v}`; ways.appendChild(d); };
    way('LinkedIn', `<a class="way-v" href="${esc(C.linkedin)}" target="_blank" rel="noopener">Message me</a>`);
    way('Phone', `<a class="way-v" href="${esc(C.phoneHref)}">${esc(C.phone)}</a>`);
    way('WeChat', '<span class="way-v">Same number, or scan the card</span>');
    way('Newsletter', `<a class="way-v" href="${esc(KY.newsletter.index)}">Read Daily AI</a>`);
    way('X', C.x ? `<a class="way-v" href="${esc(C.x)}">${esc(C.x)}</a>` : '<span class="way-v way-soon">Coming soon</span>');
    way('Email', C.email ? `<a class="way-v" href="mailto:${esc(C.email)}">${esc(C.email)}</a>` : '<span class="way-v way-soon">Coming soon</span>');
    const cardCol = el('div', 'contact-card');
    cardCol.appendChild(makeCard('contact'));
    host.append(ways, cardCol);
  })();

  (function cardOverlay() {
    const ov = $('[data-card-overlay]'); if (!ov) return;
    $('[data-card-slot-overlay]', ov).appendChild(makeCard('overlay'));
    let last = null;
    const hide = () => {
      if (ov.hidden) return;
      ov.hidden = true; main.inert = false; bar.inert = false;
      if (lenis) lenis.start();
      if (last) last.focus({ preventScroll: true });
    };
    const show = (e) => {
      e.preventDefault();
      last = document.activeElement;
      ov.hidden = false; main.inert = true; bar.inert = true;
      if (lenis) lenis.stop();
      $('[data-flip]', ov).focus({ preventScroll: true });
      if (motion) G.fromTo($('.bcard', ov), { y: 50, rotateX: 28, opacity: 0 }, { y: 0, rotateX: 0, opacity: 1, duration: 1, ease: 'expo.out', clearProps: 'transform,opacity' });
    };
    $$('[data-card-open]').forEach((b) => b.addEventListener('click', show));
    $('[data-card-close]', ov).addEventListener('click', hide);
    ov.addEventListener('click', (e) => { if (e.target === ov) hide(); });
    ov.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); hide(); } });
  })();

  /* ------------------------------------------------------------------
     Scroll: Lenis, bar, nav, rules
     ------------------------------------------------------------------ */
  let lenis = null;
  if (motion && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    if (ST) lenis.on('scroll', ST.update);
    G.ticker.add((t) => lenis.raf(t * 1000));
    G.ticker.lagSmoothing(0);
  }
  const barEl = $('[data-bar]');
  const onScroll = () => barEl.classList.toggle('is-scrolled', scrollY > 4);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').startsWith('#/') || a.hasAttribute('data-card-open')) return;
    const id = a.getAttribute('href').slice(1);
    const target = id === 'top' ? 0 : document.getElementById(id);
    if (target == null) return;
    e.preventDefault();
    const barH = barEl.offsetHeight;
    if (lenis) lenis.scrollTo(target, { offset: target === 0 ? 0 : -barH, duration: 1.2 });
    else if (target === 0) scrollTo({ top: 0 }); else scrollTo({ top: target.getBoundingClientRect().top + scrollY - barH });
  });

  const navLinks = $$('.bar-nav a');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('is-on', a.getAttribute('href') === `#${e.target.id}`));
    }), { rootMargin: '-45% 0px -50% 0px' });
    ['index', 'plates', 'resume', 'writing', 'contact'].forEach((id) => { const n = document.getElementById(id); if (n) io.observe(n); });
  }

  if (motion && ST) {
    $$('[data-rule]').forEach((r, i) => {
      G.fromTo(r, { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'expo.out', delay: i === 0 ? 0.5 : 0, scrollTrigger: i === 0 ? undefined : { trigger: r, start: 'top 92%', once: true } });
    });
    G.fromTo('.title > *, .lede', { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.08, clearProps: 'transform,opacity' });
    G.fromTo('.row', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out', stagger: 0.035, delay: 0.55, clearProps: 'transform,opacity' });
  }

  /* ------------------------------------------------------------------
     Start
     ------------------------------------------------------------------ */
  setActive(plates[0].id);
  route(false);
})();
