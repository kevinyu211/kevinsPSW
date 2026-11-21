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
     Drawing engine. Each scene is one SVG: a technical drawing that can assemble,
     turn, explode into its parts and reassemble, or be scrubbed by scroll.
     ------------------------------------------------------------------ */
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
  const expoOut = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
  const ease2 = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const normalized = (id) => {
    const o = OBJECTS[id] ? OBJECTS[id]() : OBJECTS.pindou();
    let r = 0.1;
    [...(o.e || []), ...(o.a || [])].forEach((e) => e.forEach((p) => { r = Math.max(r, Math.hypot(p[0], p[2]), Math.abs(p[1]) * 1.2); }));
    const f = 1 / r;
    const map = (list) => (list || []).map(([a, b]) => [a.map((v) => v * f), b.map((v) => v * f)]);
    return { e: map(o.e), a: map(o.a) };
  };
  const place = (edges, s, off) => edges.map(([a, b]) => [[a[0] * s + off[0], a[1] * s + off[1], a[2] * s + off[2]], [b[0] * s + off[0], b[1] * s + off[1], b[2] * s + off[2]]]);
  // Exploded view: edges that touch belong to one part; parts fly apart from the centre, stacked by height.
  function explodeOffsets(list) {
    const key = (p) => p.map((v) => v.toFixed(3)).join(',');
    const parent = {};
    const find = (k) => { while (parent[k] !== k) { parent[k] = parent[parent[k]]; k = parent[k]; } return k; };
    const add = (k) => { if (!(k in parent)) parent[k] = k; };
    list.forEach((l) => { const a = key(l.a); const b = key(l.b); add(a); add(b); const ra = find(a); const rb = find(b); if (ra !== rb) parent[ra] = rb; });
    const parts = {};
    list.forEach((l) => {
      const r = find(key(l.a));
      const P = parts[r] || (parts[r] = { s: [0, 0, 0], n: 0, ls: [] });
      [l.a, l.b].forEach((p) => { P.s[0] += p[0]; P.s[1] += p[1]; P.s[2] += p[2]; P.n++; });
      P.ls.push(l);
    });
    const arr = Object.values(parts).map((P) => ({ ...P, c: P.s.map((v) => v / P.n) }));
    const C = [0, 1, 2].map((i) => arr.reduce((s, P) => s + P.c[i], 0) / (arr.length || 1));
    arr.sort((a, b) => a.c[1] - b.c[1]);
    const n = arr.length;
    arr.forEach((P, li) => {
      const lift = n > 1 ? (li / (n - 1) - 0.5) * 1.05 : 0;
      const off = n > 1 ? [(P.c[0] - C[0]) * 0.75, (P.c[1] - C[1]) * 0.7 + lift, (P.c[2] - C[2]) * 0.75] : [0, 0, 0];
      P.ls.forEach((l) => { l.off = off; });
    });
  }

  const scenes = [];
  function makeScene(svg, cfg) {
    const c = { grid: 'scene', dims: true, nb: false, scale: 190, pointer: false, spin: 0.07, yaw0: -0.72, pitch: -0.56, gridR: 2.4, gridStep: 0.6, letters: true, ...cfg };
    const root = svgEl('g', { class: 'scene' }, svg);
    const gGrid = svgEl('g', { class: 'g-grid' }, root);
    const gNb = svgEl('g', { class: 'g-nb' }, root);
    const gDim = svgEl('g', { class: 'g-dim' }, root);
    const gAct = svgEl('g', { class: 'g-act' }, root);
    const S = { grid: [], nb: [], act: [], dims: [], dimTexts: [], labels: [], id: null, tAct: 0, tNb: 0, tGrid: performance.now(), ex: 0, exT: 0, progress: null, visible: true, ptr: { x: 0, y: 0, tx: 0, ty: 0 } };
    const born = performance.now();
    const lines = (g, edges, cls) => edges.map(([a, b], i) => ({ a, b, i, off: [0, 0, 0], ln: svgEl('line', cls ? { class: cls } : null, g) }));
    const clear = (g) => { while (g.firstChild) g.removeChild(g.firstChild); };

    if (c.grid !== 'none') {
      const R = c.gridR; const y = -1.02; const step = c.gridStep; const edges = [];
      for (let v = -R; v <= R + 1e-6; v += step) edges.push([[v, y, -R], [v, y, R]], [[-R, y, v], [R, y, v]]);
      S.grid = lines(gGrid, edges, 'gd');
      if (c.letters) {
        let k = 0;
        for (let v = -R; v <= R + 1e-6; v += step * 2) {
          S.labels.push({ p: [v, y, R + 0.32], node: svgEl('text', { class: 'tick' }, gGrid), t: 'ABCDEFGHI'[k] });
          S.labels.push({ p: [-R - 0.32, y, v], node: svgEl('text', { class: 'tick' }, gGrid), t: String(k + 1) });
          k++;
        }
        S.labels.forEach((l) => { l.node.textContent = l.t; });
      }
    }
    function buildDims(edges) {
      clear(gDim); S.dims = []; S.dimTexts = [];
      if (!c.dims) return;
      const mn = [9, 9, 9]; const mx = [-9, -9, -9];
      edges.forEach((e) => e.forEach((p) => p.forEach((v, i) => { mn[i] = Math.min(mn[i], v); mx[i] = Math.max(mx[i], v); })));
      const y = -1.02; const o = 0.34; const tk = 0.06; const out = [];
      const z = mx[2] + o; const x = mx[0] + o; const hx = mn[0] - o; const hz = mx[2];
      out.push([[mn[0], y, mx[2]], [mn[0], y, z + 0.08]], [[mx[0], y, mx[2]], [mx[0], y, z + 0.08]], [[mn[0], y, z], [mx[0], y, z]],
        [[mn[0] - tk, y, z - tk], [mn[0] + tk, y, z + tk]], [[mx[0] - tk, y, z - tk], [mx[0] + tk, y, z + tk]],
        [[mx[0], y, mn[2]], [x + 0.08, y, mn[2]]], [[mx[0], y, mx[2]], [x + 0.08, y, mx[2]]], [[x, y, mn[2]], [x, y, mx[2]]],
        [[x - tk, y, mn[2] - tk], [x + tk, y, mn[2] + tk]], [[x - tk, y, mx[2] - tk], [x + tk, y, mx[2] + tk]],
        [[hx, mn[1], hz], [hx, mx[1], hz]], [[hx - tk, mn[1] - tk, hz], [hx + tk, mn[1] + tk, hz]], [[hx - tk, mx[1] - tk, hz], [hx + tk, mx[1] + tk, hz]]);
      S.dims = lines(gDim, out, 'dm');
      const mm = (v) => String(Math.round(v * 600));
      [[mx[0] - mn[0], [(mn[0] + mx[0]) / 2, y, z + 0.16]], [mx[2] - mn[2], [x + 0.2, y, (mn[2] + mx[2]) / 2]], [mx[1] - mn[1], [hx - 0.12, (mn[1] + mx[1]) / 2, hz]]].forEach(([v, p]) => {
        const t = svgEl('text', { class: 'dimt' }, gDim); t.textContent = mm(v); S.dimTexts.push({ node: t, p });
      });
    }
    function set(id, opts = {}) {
      if (!OBJECTS[id]) id = 'pindou';
      const same = id === S.id;
      S.id = id;
      if (!same) {
        const o = normalized(id);
        clear(gAct);
        S.act = [...lines(gAct, o.e, ''), ...lines(gAct, o.a, 'ac')];
        S.act.forEach((l) => { l.done = false; });
        explodeOffsets(S.act);
        buildDims([...o.e, ...o.a]);
        S.tAct = performance.now() - (opts.assemble === false || !motion ? 100000 : 0);
      }
      if (c.nb) {
        clear(gNb);
        const i = plates.findIndex((p) => p.id === id);
        const A = normalized(plates[(i - 1 + plates.length) % plates.length].id);
        const B = normalized(plates[(i + 1) % plates.length].id);
        S.nb = [...lines(gNb, place([...A.e, ...A.a], 0.5, [-1.85, -0.5, -1.25]), 'nb'), ...lines(gNb, place([...B.e, ...B.a], 0.44, [1.7, -0.56, 1.35]), 'nb')];
        S.tNb = performance.now() - (motion ? 0 : 100000);
      }
      const p = byId[id];
      if (p) svg.setAttribute('aria-label', `Technical line drawing for ${p.title}`);
      render(performance.now());
    }
    const project = (p, yaw, pitch) => {
      const cy = Math.cos(yaw); const sy = Math.sin(yaw); const cp = Math.cos(pitch); const sp = Math.sin(pitch);
      const x = p[0] * cy + p[2] * sy; const z = -p[0] * sy + p[2] * cy; const y = p[1] * cp - z * sp;
      return [300 + x * c.scale, 300 - y * c.scale];
    };
    function paint(list, t0, now, span, dur, yaw, pitch, ex, mark, prog) {
      const t = (now - t0) / 1000; const n = list.length || 1;
      list.forEach((l) => {
        let k;
        if (prog != null) k = clamp01((prog - (l.i / n) * 0.75) / 0.25);
        else k = motion ? expoOut(clamp01((t - (l.i / n) * span) / dur)) : 1;
        const o = l.off; const e = ex || 0;
        const a = e ? [l.a[0] + o[0] * e, l.a[1] + o[1] * e, l.a[2] + o[2] * e] : l.a;
        const b0 = e ? [l.b[0] + o[0] * e, l.b[1] + o[1] * e, l.b[2] + o[2] * e] : l.b;
        const b = k >= 1 ? b0 : [a[0] + (b0[0] - a[0]) * k, a[1] + (b0[1] - a[1]) * k, a[2] + (b0[2] - a[2]) * k];
        const p = project(a, yaw, pitch); const q = project(b, yaw, pitch);
        l.ln.setAttribute('x1', p[0].toFixed(1)); l.ln.setAttribute('y1', p[1].toFixed(1));
        l.ln.setAttribute('x2', q[0].toFixed(1)); l.ln.setAttribute('y2', q[1].toFixed(1));
        l.ln.style.opacity = k > 0.001 ? '' : '0';
        if (mark && !l.done && k >= 1) { l.done = true; l.ln.classList.add('set'); }
      });
    }
    function render(now) {
      const P = S.ptr; P.x += (P.tx - P.x) * 0.06; P.y += (P.ty - P.y) * 0.06;
      S.ex += (S.exT - S.ex) * 0.085;
      const life = (now - born) / 1000; const ta = (now - S.tAct) / 1000;
      const prog = S.progress;
      let yaw = c.yaw0; let pitch = c.pitch;
      if (motion) {
        if (prog != null) yaw += (prog - 0.5) * 1.3;
        else yaw += life * c.spin - 0.5 * (1 - expoOut(Math.min(1, ta / 2.4))) + P.x * 0.35;
        pitch += P.y * 0.1;
      }
      let ex = ease2(clamp01(S.ex));
      if (prog != null) ex = prog < 0.42 ? 0 : prog < 0.72 ? ease2((prog - 0.42) / 0.3) : prog < 0.86 ? 1 : 1 - ease2((prog - 0.86) / 0.14);
      paint(S.grid, S.tGrid, now, 0.7, 0.5, yaw, pitch, 0, false, prog != null ? Math.min(1, prog * 3) : null);
      paint(S.nb, S.tNb, now, 0.6, 0.45, yaw, pitch, 0, false, null);
      paint(S.act, S.tAct, now, 1.3, 0.6, yaw, pitch, ex, true, prog != null ? Math.min(1, prog / 0.42) : null);
      const dk = (prog != null ? clamp01((prog - 0.3) / 0.1) : (motion ? clamp01(((now - S.tAct) / 1000 - 1.1) / 0.6) : 1)) * (1 - ex);
      paint(S.dims, S.tAct + 1100, now, 0.4, 0.4, yaw, pitch, 0, false, prog != null ? clamp01((prog - 0.3) / 0.12) : null);
      gDim.style.opacity = String(1 - ex);
      S.dimTexts.forEach(({ node, p }) => { const q = project(p, yaw, pitch); node.setAttribute('x', q[0].toFixed(1)); node.setAttribute('y', (q[1] + 4).toFixed(1)); node.style.opacity = String(dk); });
      S.labels.forEach(({ node, p }) => { const q = project(p, yaw, pitch); node.setAttribute('x', q[0].toFixed(1)); node.setAttribute('y', (q[1] + 4).toFixed(1)); });
      root.setAttribute('transform', motion && c.pointer ? `translate(${(-P.x * 12).toFixed(1)} ${(-P.y * 8).toFixed(1)})` : '');
    }
    const api = {
      set, render, svg,
      get id() { return S.id; },
      explode(on) { S.exT = on ? 1 : 0; },
      progress(p) { S.progress = p; if (!motion) render(performance.now()); },
      pointer(x, y) { S.ptr.tx = x; S.ptr.ty = y; },
      set visible(v) { S.visible = v; }, get visible() { return S.visible; },
    };
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { S.visible = e.isIntersecting; }).observe(svg);
    scenes.push(api);
    return api;
  }
  if (motion) {
    const loop = (now) => { if (!document.hidden) scenes.forEach((s) => { if (s.visible) s.render(now); }); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  // A still drawing for small places (the business card).
  function stillDrawing(target, id, yaw = -0.72, pitch = -0.56) {
    const o = normalized(id); const s = 210;
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

  const photoOf = (p) => {
    const c = p.cover || {};
    if (c.type === 'img') return c.src;
    if (c.type === 'video') return c.poster;
    if (c.type === 'stickers') return c.room;
    return null;
  };

  /* ------------------------------------------------------------------
     Hero: kinetic title, the drawing, the drafting crosshair, the tour
     ------------------------------------------------------------------ */
  $('[data-lede]').textContent = KY.person.short;
  const heroScene = makeScene($('[data-obj]'), { nb: true, pointer: true, scale: 194 });
  const stage = $('[data-stage]');
  const capNo = $('[data-cap-no]'); const capTitle = $('[data-cap-title]'); const capOne = $('[data-cap-one]'); const capOpen = $('[data-cap-open]');
  const tour = $('[data-tour]');
  plates.forEach((p) => {
    const b = el('button', 'tour-tick'); b.type = 'button'; b.dataset.id = p.id;
    b.setAttribute('aria-label', `Show plate ${p.no}, ${p.title}`);
    b.innerHTML = `<span>${p.no}</span>`;
    b.addEventListener('click', () => { setActive(p.id); tourHold = performance.now() + 9000; });
    tour.appendChild(b);
  });
  let active = null;
  let tourHold = 0;
  let rows = [];
  function setActive(id) {
    if (!byId[id] || id === active) return;
    active = id;
    const p = byId[id];
    rows.forEach((r) => r.classList.toggle('is-on', r.dataset.id === id));
    $$('.tour-tick', tour).forEach((b) => b.classList.toggle('is-on', b.dataset.id === id));
    capNo.textContent = p.no; capTitle.textContent = p.title; capOne.textContent = p.one;
    capOpen.href = `#/${id}`; capOpen.setAttribute('aria-label', `Open plate ${p.no}, ${p.title}`);
    heroScene.set(id);
    if (motion) G.fromTo([capNo, capTitle, capOne], { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, ease: 'expo.out', stagger: 0.05 });
  }
  let stageHover = false;
  if (finePointer && motion) {
    const xh = $('[data-xhair]', stage); const xt = $('.xh-t', xh);
    stage.addEventListener('pointerenter', () => { stageHover = true; heroScene.explode(true); xh.classList.add('is-on'); });
    stage.addEventListener('pointerleave', () => { stageHover = false; heroScene.explode(false); xh.classList.remove('is-on'); });
    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      const x = e.clientX - r.left; const y = e.clientY - r.top;
      xh.style.setProperty('--x', `${x}px`); xh.style.setProperty('--y', `${y}px`);
      xt.textContent = `X ${String(Math.round(x * 2.4)).padStart(4, '0')}  Y ${String(Math.round(y * 2.4)).padStart(4, '0')}`;
    });
    addEventListener('pointermove', (e) => heroScene.pointer(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5), { passive: true });
  }
  stage.addEventListener('click', (e) => {
    if (e.target.closest('button, a')) return;
    if (!finePointer) { heroScene.explode(stage.classList.toggle('is-exploded')); return; }
    openedFromPage = true; location.hash = `#/${active}`;
  });
  if (motion) setInterval(() => {
    if (stageHover || openId || !heroScene.visible || performance.now() < tourHold || document.hidden) return;
    const i = plates.findIndex((p) => p.id === active);
    setActive(plates[(i + 1) % plates.length].id);
  }, 6200);

  // Kinetic type: the words slide up and stack, then a weight sweep runs through them and follows the pointer.
  (function kinetic() {
    const lines = $$('[data-kinetic]');
    const letters = [];
    lines.forEach((ln) => {
      const text = ln.textContent; ln.textContent = '';
      const inner = el('span', 'k-in'); ln.appendChild(inner);
      [...text].forEach((ch) => {
        const s = el('span', ch === ' ' ? 'k-sp' : 'k-ch'); s.textContent = ch === ' ' ? ' ' : ch;
        inner.appendChild(s); if (ch !== ' ') letters.push({ s, w: 300, tw: 300, wd: 100, twd: 100 });
      });
    });
    const apply = (L) => L.s.style.setProperty('font-variation-settings', `"wght" ${L.w.toFixed(0)}, "wdth" ${L.wd.toFixed(1)}`);
    letters.forEach(apply);
    if (!motion) return;
    G.fromTo('.k-in', { yPercent: 105 }, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.12, delay: 0.15 });
    G.fromTo('.t-name', { yPercent: 105 }, { yPercent: 0, duration: 1.2, ease: 'expo.out' });
    const sweep = () => G.to(letters, { keyframes: [{ w: 860, wd: 112, duration: 0.35, ease: 'power2.out' }, { w: 300, wd: 100, duration: 0.7, ease: 'power2.inOut' }], stagger: 0.045, onUpdate() {}, overwrite: 'auto' });
    letters.forEach((L) => { L.tween = null; });
    let following = false;
    G.delayedCall(1.1, sweep);
    G.ticker.add(() => {
      letters.forEach((L) => {
        if (following) { L.w += (L.tw - L.w) * 0.18; L.wd += (L.twd - L.wd) * 0.18; }
        apply(L);
      });
    });
    const title = $('.title');
    title.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      following = true; G.killTweensOf(letters);
      letters.forEach((L) => {
        const r = L.s.getBoundingClientRect();
        const d = Math.hypot(e.clientX - (r.left + r.width / 2), (e.clientY - (r.top + r.height / 2)) * 0.6);
        const k = Math.exp(-((d / 110) ** 2));
        L.tw = 300 + 560 * k; L.twd = 100 + 14 * k;
      });
    });
    title.addEventListener('pointerleave', () => { letters.forEach((L) => { L.tw = 300; L.twd = 100; }); setTimeout(() => { following = false; }, 900); });
    setInterval(() => { if (!following && !document.hidden) sweep(); }, 9000);
  })();

  /* ------------------------------------------------------------------
     Media strip: real work right after the hero, on a blue field
     ------------------------------------------------------------------ */
  (function strip() {
    const host = $('[data-strip]'); if (!host) return;
    const W = '../../assets/work/';
    const items = [
      ['hirvo', 'img', `${W}hirvo-builder.webp`, 'Résumé builder'],
      ['books', 'img', `${W}book-star-cover.webp`, 'The Lost Christmas Star'],
      ['noir', 'video', `${W}noir-loop.mp4`, 'Window-scene loop', `${W}noir-loop-poster.jpg`],
      ['ipad', 'img', `${W}ipad-coloring.webp`, 'Coloring with Apple Pencil'],
      ['court', 'img', `${W}court-booking.webp`, 'Choosing a half court'],
      ['yae', 'video', `${W}yae-intro.mp4`, 'Channel intro', `${W}yae-intro-poster.jpg`],
      ['books', 'img', `${W}book-hatshop.webp`, 'The hat shop'],
      ['party', 'img', `${W}party-friends.webp`, 'Pick your friends'],
      ['influencers', 'img', '../../assets/media/influencer-classic.jpg', 'Ariana'],
      ['hirvo', 'img', `${W}hirvo-visa.webp`, 'Visa sponsor browser'],
    ];
    const make = (dup) => items.map(([id, type, src, cap, poster]) => {
      const p = byId[id];
      const m = type === 'video'
        ? `<video muted loop playsinline preload="none" poster="${esc(poster)}" aria-label="${esc(cap)}"><source src="${esc(src)}" type="video/mp4"></video>`
        : `<img src="${esc(src)}" alt="${dup ? '' : esc(cap)}" loading="lazy" decoding="async">`;
      return `<a class="st-item" href="#/${id}"${dup ? ' tabindex="-1" aria-hidden="true"' : ''}><span class="st-media">${m}</span><span class="st-cap"><span class="st-no">${p.no}</span> ${esc(p.title)}. ${esc(cap)}</span></a>`;
    }).join('');
    host.innerHTML = `<div class="st-row">${make(false)}</div><div class="st-row" aria-hidden="true">${make(true)}</div>`;
    const vids = $$('video', host);
    const sec = host.closest('section');
    let on = false;
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => {
      on = e.isIntersecting;
      vids.forEach((v) => { if (on && !reduce) v.play().catch(() => {}); else v.pause(); });
    }, { threshold: 0.1 }).observe(sec);
    if (!motion) { host.classList.add('is-static'); return; }
    let x = 0; let speed = 0.6; let target = 0.6; let boost = 0;
    host.addEventListener('pointerenter', () => { target = 0.12; });
    host.addEventListener('pointerleave', () => { target = 0.6; });
    G.ticker.add(() => {
      if (!on) return;
      speed += (target - speed) * 0.05;
      const v = lenis ? Math.abs(lenis.velocity || 0) : 0;
      boost += (Math.min(v, 60) * 0.18 - boost) * 0.1;
      x -= speed + boost;
      const w = host.firstElementChild.offsetWidth;
      if (-x >= w) x += w;
      host.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
    });
  })();

  /* ------------------------------------------------------------------
     Index: rows fill with the project's picture in a blue duotone
     ------------------------------------------------------------------ */
  const index = $('[data-index]');
  KY.categories.forEach((cat) => {
    const list = plates.filter((p) => p.category === cat.id);
    if (!list.length) return;
    index.appendChild(el('li', 'group', `<span>${esc(cat.label)}</span><span>${list.length}</span>`));
    list.forEach((p) => {
      const li = el('li', 'row'); li.dataset.id = p.id;
      const ph = photoOf(p);
      li.innerHTML = `<span class="row-bg" aria-hidden="true">${ph ? `<img src="${esc(ph)}" alt="" loading="lazy" decoding="async">` : ''}</span>`
        + `<button class="row-btn" type="button" aria-label="Plate ${p.no}, ${esc(p.title)}. ${esc(STATUS[p.status] || '')}. Open">`
        + `<span class="row-no">${p.no}</span><span class="row-title">${esc(p.title)}</span>`
        + `<span class="row-role">${esc(p.role || '')}</span><span class="row-year">${esc(p.year || '')}</span>`
        + `<span class="row-status">${esc(STATUS[p.status] || '')}</span>`
        + `<span class="row-thumb" aria-hidden="true">${ph ? `<img src="${esc(ph)}" alt="" loading="lazy" decoding="async">` : ''}</span></button>`;
      index.appendChild(li);
    });
  });
  rows = $$('.row', index);
  rows.forEach((r) => {
    const btn = $('.row-btn', r);
    const bg = $('.row-bg', r);
    btn.addEventListener('pointermove', (e) => {
      const rc = r.getBoundingClientRect();
      bg.style.setProperty('--py', `${(((e.clientY - rc.top) / rc.height) * 100).toFixed(1)}%`);
    });
    btn.addEventListener('click', () => { openedFromPage = true; location.hash = `#/${r.dataset.id}`; });
  });

  /* ------------------------------------------------------------------
     Blueprint: a big drawing on a blue field, redrawn and exploded by scroll
     ------------------------------------------------------------------ */
  (function blueprint() {
    const sec = $('[data-blueprint]'); if (!sec) return;
    const bp = makeScene($('[data-bp]'), { scale: 205, gridR: 1.8, gridStep: 0.3, letters: false, spin: 0.05 });
    bp.set('yae', { assemble: false });
    const cap = $('[data-bp-cap]');
    if (cap) cap.textContent = `Plate ${byId.yae.no}. YouAreExtinct, the camera, drawn and taken apart`;
    if (!motion || !ST) { bp.progress(null); return; }
    bp.progress(0);
    G.matchMedia().add({ big: '(min-width: 901px)', small: '(max-width: 900px)' }, (ctx) => {
      ST.create({
        trigger: sec, start: ctx.conditions.big ? 'top top' : 'top 80%', end: ctx.conditions.big ? '+=140%' : 'bottom 30%',
        pin: ctx.conditions.big ? sec : false, scrub: 0.6,
        onUpdate: (self) => bp.progress(self.progress),
      });
    });
  })();

  /* ------------------------------------------------------------------
     The oversized object that crosses into the blue Contact field
     ------------------------------------------------------------------ */
  (function crossing() {
    const a = $('[data-cross-a]'); const b = $('[data-cross-b]'); if (!a || !b) return;
    const cfg = { grid: 'none', dims: false, scale: 230, spin: 0.05, yaw0: -0.5 };
    makeScene(a, cfg).set('noir', { assemble: false });
    makeScene(b, cfg).set('noir', { assemble: false });
  })();

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

  const spScene = makeScene(svgEl('svg', { class: 'obj', viewBox: '0 0 600 600', role: 'img' }, $('[data-sp-stage]')), { gridR: 1.5, gridStep: 0.5, letters: false, scale: 196 });

  function open(id, animate) {
    const p = byId[id]; if (!p) return;
    const first = openId == null;
    openId = id;
    if (first) returnTo = document.activeElement;
    fill(p);
    if (first) {
      spread.hidden = false;
      main.inert = true; bar.inert = true;
      if (lenis) lenis.stop();
      doc.classList.add('has-spread');
      sp.scroller.scrollTop = 0;
    }
    spScene.set(id);
    if (motion && first && animate) {
      G.fromTo(spread, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.85, ease: 'expo.inOut', clearProps: 'clipPath' });
      G.fromTo($$('.spread-text > *, .gallery > *, .spread-bar > *', spread), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.04, delay: 0.35, clearProps: 'transform,opacity' });
    } else if (motion && !first) {
      sp.scroller.scrollTop = 0;
      G.fromTo($$('.spread-text > *, .gallery > *', spread), { opacity: 0, x: 14 }, { opacity: 1, x: 0, duration: 0.6, ease: 'expo.out', stagger: 0.03, clearProps: 'transform,opacity' });
    }
    sp.title.focus({ preventScroll: true });
    document.title = `${p.title} · Kevin Yu`;
  }

  function close() {
    if (openId == null) return;
    spread.hidden = true;
    sp.gallery.querySelectorAll('video').forEach((v) => v.pause());
    sp.gallery.innerHTML = '';
    main.inert = false; bar.inert = false;
    doc.classList.remove('has-spread');
    if (lenis) lenis.start();
    openId = null;
    document.title = 'Kevin Yu · Monograph';
    if (returnTo && document.contains(returnTo)) returnTo.focus({ preventScroll: true });
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
      { id: 'noir', video: `${W}noir-loop.mp4`, poster: `${W}noir-loop-poster.jpg`, cap: 'Window-scene loop', cls: 'pl-e pl-full' },
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
      { id: 'yae', video: `${W}yae-intro.mp4`, poster: `${W}yae-intro-poster.jpg`, cap: 'Channel intro', cls: 'pl-f pl-full' },
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
    ['index', 'blueprint', 'plates', 'resume', 'writing', 'contact'].forEach((id) => { const n = document.getElementById(id); if (n) io.observe(n); });
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
