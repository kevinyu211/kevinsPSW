/* Noir Hours
   A rainy city at night, drawn procedurally on two canvases: a static backdrop (sky, skyline,
   facades, wet cobblestones) and a live layer (lit windows, neon, lamp light, reflections, rain,
   steam, a passing car). Plus a one-track-at-a-time sample player built from the <li> items.
   The city pauses offscreen and in hidden tabs, holds one still frame under reduced motion,
   and leans gently into the music through a Web Audio analyser once the visitor presses play.
   No dependencies. */
(() => {
  'use strict';

  const root = document.getElementById('noir');
  if (!root) return;

  const reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reduced = !!(reduceMQ && reduceMQ.matches);

  // Shared by the player and the city: the music level, 0..1, smoothed
  const sound = { playing: false, level: 0, analyser: null, bins: null, fast: 0, slow: 0 };

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const fmt = (s) => {
    if (!isFinite(s) || s < 0) return '0:00';
    s = Math.floor(s);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  // Small seeded generator so the skyline is the same city on every visit and every resize
  const seeded = (seed) => () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };

  /* =====================================================================
     The city
     ===================================================================== */
  function makeCity() {
    const sceneEl = root.querySelector('[data-noir-scene]');
    const bgCv = root.querySelector('[data-noir-bg]');
    const fxCv = root.querySelector('[data-noir-fx]');
    if (!sceneEl || !bgCv || !fxCv || !bgCv.getContext) return null;
    const bgx = bgCv.getContext('2d');
    const ctx = fxCv.getContext('2d');
    if (!bgx || !ctx) return null;

    /* ---------- Colors: read from the --noir-* tokens in noir.css ---------- */
    const TOKENS = {
      skyTop: '#04060b', sky: '#0a101a', haze: '#1d2938', far: '#121a26', mid: '#0b1018',
      near: '#06080c', street: '#05070a', stone: '#2a3644', amber: '#f0a14a', hot: '#ffe2b4',
      window: '#e9a552', blue: '#78acff', rain: '#b4c4dc',
    };
    const parseColor = (v) => {
      v = (v || '').trim();
      let m = /^#([0-9a-f]{3})$/i.exec(v);
      if (m) return m[1].split('').map((c) => parseInt(c + c, 16));
      m = /^#([0-9a-f]{6})$/i.exec(v);
      if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
      m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v);
      return m ? [+m[1], +m[2], +m[3]] : null;
    };
    const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
    const mix = (a, b, k) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * k));
    function readColors() {
      const cs = getComputedStyle(root);
      const out = {};
      Object.keys(TOKENS).forEach((k) => {
        const name = '--noir-' + k.replace(/[A-Z]/g, (x) => '-' + x.toLowerCase());
        out[k] = parseColor(cs.getPropertyValue(name)) || parseColor(TOKENS[k]);
      });
      out.pale = mix(out.window, out.hot, 0.45);
      out.cool = mix(out.blue, [205, 214, 230], 0.55);
      out.white = [255, 244, 226];
      out.tail = [255, 86, 54];
      return out;
    }
    function fonts() {
      const cs = getComputedStyle(root);
      return {
        sign: cs.getPropertyValue('--noir-sign-font').trim() || 'Georgia, serif',
        label: cs.getPropertyValue('--noir-label-font').trim() || 'system-ui, sans-serif',
      };
    }

    const canvas = (w, h) => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(w));
      c.height = Math.max(1, Math.ceil(h));
      return c;
    };
    // Soft round light, reused stretched for halos, reflections, fog and beams
    function glow(c) {
      const s = 128, cv = canvas(s, s), g = cv.getContext('2d');
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      [[0, 1], [0.1, 0.8], [0.24, 0.45], [0.42, 0.18], [0.62, 0.06], [0.82, 0.015], [1, 0]]
        .forEach(([o, a]) => gr.addColorStop(o, rgba(c, a)));
      g.fillStyle = gr;
      g.fillRect(0, 0, s, s);
      return cv;
    }
    const roundRect = (g, x, y, w, h, r) => {
      r = Math.min(r, w / 2, h / 2);
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    };

    /* ---------- State ---------- */
    let W = 0, H = 0, dpr = 1, C = null, L = null, F = null, built = false;
    let SP = {};                         // glow sprites by color
    let front = null;                    // frames, blinds, fire escape, lamp post: sits over lit windows
    let cone = null, neon = null, hotel = null, lowRes = false, slow = 0;
    let far = [], deco = [], mid = [], wins = [], toggleable = [];
    let drops = [], splashes = [], steam = [], fog = [];
    let car = null, nextCar = 4, nextToggle = 2, steamClock = 0;
    let t = 0, raf = 0, last = 0, visible = true;
    const neonFx = { level: 1, letter: 1, seq: null, seqT: 0, kind: 'all', next: 6 };
    const hotelFx = { level: 1, letter: 1, seq: null, seqT: 0, kind: 'letter', next: 15 };
    const hooks = [];

    /* ---------- Layout: proportions for wide (desktop) and tall (phone) frames ---------- */
    function layout() {
      const wide = W / H >= 1.3;
      const R = Math.max(W, H * 1.3);            // building scale
      const s = Math.sqrt(W * H) / 860;          // general size scale
      const gy = Math.round(H * (wide ? 0.69 : 0.665));
      const sw = Math.max(5, Math.round(H * 0.024));
      const curb = gy + sw;
      const lb = { x0: -2, x1: Math.round(W * (wide ? 0.25 : 0.27)), top: Math.round(H * (wide ? 0.07 : 0.09)) };
      const rb = { x0: Math.round(W * (wide ? 0.645 : 0.5)), x1: W + 2, top: Math.round(H * (wide ? 0.2 : 0.25)) };
      const rbW = rb.x1 - rb.x0;

      // Blue HOTEL sign on the left building, the amber Noir Hours sign on the jazz bar at right
      const ls = clamp(H * 0.04, 11, 28);
      const hbw = Math.round(ls * 1.6), hbh = Math.round(ls * 1.2 * 5 + ls * 0.7);
      const hs = { x0: lb.x1 - hbw - Math.max(4, W * 0.009), y0: Math.round(lb.top + H * 0.09), w: hbw, h: hbh, ls };

      const lampX = W * (wide ? 0.385 : 0.345);
      const pw = clamp(R * 0.0042, 2.2, 6);
      const arm = clamp(R * 0.028, 11, 36);
      const lw = clamp(R * 0.015, 8, 20);
      const lamp = { x: lampX, base: gy + sw * 0.6, top: gy - H * (wide ? 0.44 : 0.41), pw, arm, lw };
      lamp.hx = lamp.x + arm;
      lamp.hang = lamp.top + arm * 0.22;
      lamp.capH = lw * 0.42;
      lamp.glassH = lw * 0.95;
      lamp.gy0 = lamp.hang + lamp.capH;
      lamp.gy1 = lamp.gy0 + lamp.glassH;
      lamp.ly = (lamp.gy0 + lamp.gy1) / 2;

      return {
        wide, R, s, gy, sw, curb, lb, rb, rbW, hs, lamp,
        sign: { cx: rb.x0 + rbW * 0.53, cy: gy - H * (wide ? 0.255 : 0.25), w: rbW * (wide ? 0.68 : 0.82) },
        awning: { x0: rb.x0 + rbW * 0.12, x1: rb.x0 + rbW * 0.95, y: gy - H * 0.128, h: Math.max(6, H * 0.026) },
        door: { x: rb.x0 + rbW * 0.19, y: gy - H * 0.1, w: Math.max(11, rbW * 0.085), h: H * 0.1 },
        barWin: { x: rb.x0 + rbW * 0.37, y: gy - H * 0.088, w: rbW * 0.53, h: H * 0.066 },
        carY: curb + (H - curb) * 0.34,
        carL: clamp(W * (wide ? 0.15 : 0.36), 96, 260),
        manhole: { x: W * (wide ? 0.585 : 0.68), y: curb + (H - curb) * 0.7, rx: clamp(R * 0.032, 14, 40) },
      };
    }

    // Is a rectangle hidden behind one of the near buildings?
    const behindNear = (r) => [L.lb, L.rb].some((b) =>
      r.x + r.w > b.x0 - 1 && r.x < b.x1 + 1 && r.y + r.h > b.top - 2);

    /* ---------- City generation ---------- */
    function mkWin(r, near, rnd) {
      const hue = rnd();
      const col = hue < 0.1 ? C.cool : hue < 0.38 ? C.pale : C.window;
      const lit = rnd() < (near ? 0.55 : 0.66);
      const w = Object.assign({}, r, {
        near, col, on: lit ? 1 : 0, target: lit ? 1 : 0, rate: 1,
        b: (near ? 0.74 + rnd() * 0.2 : 0.5 + rnd() * 0.45) * (col === C.cool ? 0.7 : 1),
        blinds: near && rnd() < 0.55, blindsTo: 0.25 + rnd() * 0.6, steady: false, figure: false,
      });
      if (near) {
        // Warm interior: brighter low in the room where the lamp would be
        const g = ctx.createLinearGradient(0, w.y, 0, w.y + w.h);
        g.addColorStop(0, rgba(mix(col, [40, 24, 10], 0.35), 1));
        g.addColorStop(1, rgba(mix(col, C.hot, 0.3), 1));
        w.fill = g;
      } else {
        w.fill = rgba(col, 1);
      }
      return w;
    }

    function genCity(rnd) {
      const { R, gy } = L;
      far = []; deco = []; mid = []; wins = [];

      // Far skyline: low-contrast blue-grey blocks, some stepped
      let x = -R * 0.03;
      while (x < W + R * 0.03) {
        const w = R * (0.028 + rnd() * 0.05);
        const h = H * (0.18 + rnd() * 0.24);
        far.push({ x, w, top: gy - h, step: rnd() < 0.35 ? 0.45 + rnd() * 0.3 : 0, ant: rnd() < 0.14 });
        x += w * (0.72 + rnd() * 0.35);
      }
      // Two art deco towers rising out of the gap between the near buildings
      const gap0 = L.lb.x1, gapW = L.rb.x0 - L.lb.x1;
      deco.push({ x: gap0 + gapW * 0.62, w: R * 0.05, top: gy - H * (L.wide ? 0.6 : 0.52), beacon: true });
      deco.push({ x: gap0 + gapW * 0.2, w: R * 0.036, top: gy - H * (L.wide ? 0.46 : 0.42), beacon: false });

      // Mid row: darker, with cornices, setbacks and water towers
      x = -R * 0.04;
      while (x < W + R * 0.02) {
        const w = R * (0.05 + rnd() * 0.065);
        const h = H * (0.12 + rnd() * 0.21);
        const b = {
          x, w, top: gy - h, tank: rnd() < 0.42, cornice: rnd() < 0.7, ant: rnd() < 0.12,
          set: rnd() < 0.25 ? { f: 0.55 + rnd() * 0.25, h: H * (0.025 + rnd() * 0.045) } : null,
          dark: [],
        };
        const cw = R * 0.0125, rh = H * 0.031;
        const ww = Math.max(2, R * 0.0052), wh = Math.max(2.5, H * 0.012);
        for (let wy = b.top + H * 0.022; wy < gy - H * 0.045; wy += rh) {
          for (let wx = b.x + cw * 0.55; wx < b.x + b.w - cw * 0.6; wx += cw) {
            const r = { x: wx, y: wy, w: ww, h: wh };
            if (rnd() < 0.12) { if (!behindNear(r)) wins.push(mkWin(r, false, rnd)); }
            else b.dark.push(r);
          }
        }
        mid.push(b);
        x += w + (rnd() < 0.25 ? R * 0.006 : -R * 0.002);
      }

      // Near windows on the two framing buildings
      const ww = clamp(R * 0.026, 10, 40), wh = ww * 1.45;
      const colStep = ww * 2.05, rowStep = Math.max(wh * 1.6, H * 0.09);
      const lx0 = L.lb.x0 + ww * 0.75, lx1 = L.hs.x0 - ww * 0.55;
      const lcols = Math.max(1, Math.floor((lx1 - lx0 - ww) / colStep) + 1);
      const leftWins = [];
      for (let r = 0; ; r++) {
        const y = L.lb.top + H * 0.05 + r * rowStep;
        if (y + wh > gy - H * 0.13) break;
        for (let c = 0; c < lcols; c++) {
          const w = mkWin({ x: lx0 + c * colStep, y, w: ww, h: wh, row: r, ci: c }, true, rnd);
          leftWins.push(w); wins.push(w);
        }
      }
      // A figure in a fedora behind the blinds, a light that stays on
      const fig = leftWins.find((w) => w.row === 2 && w.ci === Math.min(1, lcols - 1)) || leftWins[0];
      if (fig) {
        const warm = mkWin(fig, true, () => 0.5);
        Object.assign(fig, { steady: true, figure: true, blinds: true, blindsTo: 0.34, on: 1, target: 1, col: warm.col, fill: warm.fill, b: 0.9 });
      }

      const signTop = L.sign.cy - L.sign.w * 0.16;
      const rx0 = L.rb.x0 + ww * 0.9;
      for (let r = 0; ; r++) {
        const y = L.rb.top + H * 0.04 + r * rowStep;
        if (y + wh > signTop - H * 0.02) break;
        for (let wx = rx0, c = 0; wx + ww < W - ww * 0.3; wx += colStep, c++) {
          wins.push(mkWin({ x: wx, y, w: ww, h: wh, row: r, ci: c }, true, rnd));
        }
      }
      toggleable = wins.filter((w) => !w.steady);
      wins.forEach((w) => { w.reflect = w.near && w.y + w.h > gy - H * 0.3; });
    }

    /* ---------- Static backdrop ---------- */
    function paintBackdrop(rnd) {
      const g = bgx;
      const { gy, curb, R } = L;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, W, H);

      // Sky, with city glow on the low clouds
      let gr = g.createLinearGradient(0, 0, 0, gy);
      gr.addColorStop(0, rgba(C.skyTop, 1));
      gr.addColorStop(0.5, rgba(C.sky, 1));
      gr.addColorStop(1, rgba(C.haze, 1));
      g.fillStyle = gr;
      g.fillRect(0, 0, W, curb);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        const cx = rnd() * W, cy = H * (0.06 + rnd() * 0.3), cw = W * (0.35 + rnd() * 0.5);
        g.globalAlpha = 0.08 + rnd() * 0.08;
        g.drawImage(SP.haze, cx - cw / 2, cy - H * 0.08, cw, H * 0.16);
      }
      g.globalAlpha = 0.1;
      g.drawImage(SP.amber, W * 0.1, gy - H * 0.5, W * 0.8, H * 0.75);
      g.globalAlpha = 0.22;
      g.drawImage(SP.haze, -W * 0.1, gy - H * 0.35, W * 1.2, H * 0.6);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';

      // Far skyline
      const farLit = rgba(mix(C.window, C.haze, 0.25), 1);
      const drawFar = (b) => {
        g.fillStyle = rgba(C.far, 1);
        g.fillRect(b.x, b.top, b.w, gy - b.top);
        if (b.step) g.fillRect(b.x + b.w * (1 - b.step) / 2, b.top - H * 0.03, b.w * b.step, H * 0.031);
        if (b.ant) g.fillRect(b.x + b.w * 0.5, b.top - H * 0.07, 1, H * 0.07);
        g.fillStyle = farLit;
        for (let y = b.top + 4; y < gy - 8; y += Math.max(5, H * 0.014)) {
          for (let x = b.x + 3; x < b.x + b.w - 3; x += Math.max(4, R * 0.0055)) {
            if (rnd() < 0.065) { g.globalAlpha = 0.18 + rnd() * 0.4; g.fillRect(x, y, 1.6, 2.2); }
          }
        }
        g.globalAlpha = 1;
      };
      far.forEach(drawFar);
      // Art deco towers: stacked setbacks and a spire
      deco.forEach((d) => {
        g.fillStyle = rgba(mix(C.far, C.haze, 0.12), 1);
        let w = d.w, y = gy, top = d.top;
        const tiers = [1, 0.78, 0.58, 0.4];
        const tierH = (gy - top) * 0.2;
        g.fillRect(d.x - w / 2, top + tierH * 1.6, w, gy - top - tierH * 1.6);
        for (let i = 1; i < tiers.length; i++) {
          w = d.w * tiers[i];
          y = top + tierH * (1.6 - i * 0.45);
          g.fillRect(d.x - w / 2, y, w, tierH * 0.6);
        }
        const tipY = top - (gy - top) * 0.16;
        g.beginPath();
        g.moveTo(d.x - d.w * 0.16, top + tierH * 0.3);
        g.lineTo(d.x, tipY);
        g.lineTo(d.x + d.w * 0.16, top + tierH * 0.3);
        g.closePath();
        g.fill();
        d.tip = { x: d.x, y: tipY };
        // Vertical light bands on the crown
        g.fillStyle = farLit;
        for (let i = -2; i <= 2; i++) {
          g.globalAlpha = 0.16;
          g.fillRect(d.x + i * d.w * 0.11 - 0.6, top + tierH * 0.5, 1.2, tierH * 1.4);
        }
        g.globalAlpha = 1;
      });
      // Haze settles over the far city
      gr = g.createLinearGradient(0, gy - H * 0.55, 0, gy);
      gr.addColorStop(0, rgba(C.haze, 0));
      gr.addColorStop(1, rgba(C.haze, 0.62));
      g.fillStyle = gr;
      g.fillRect(0, 0, W, gy);

      // Mid row
      const midC = rgba(C.mid, 1);
      mid.forEach((b) => {
        g.fillStyle = midC;
        g.fillRect(b.x, b.top, b.w, gy - b.top);
        let roof = b.top;
        if (b.set) {
          const sw = b.w * b.set.f;
          g.fillRect(b.x + (b.w - sw) / 2, b.top - b.set.h, sw, b.set.h + 1);
          roof = b.top - b.set.h;
        }
        if (b.cornice) {
          g.fillRect(b.x - 2, b.top - 2, b.w + 4, 3);
          g.fillStyle = rgba(C.stone, 0.22);
          g.fillRect(b.x - 2, b.top - 2, b.w + 4, 1);
          g.fillStyle = midC;
        }
        if (b.tank) {
          // Wooden water tower on legs
          const tw = clamp(R * 0.02, 7, 24), th = tw * 1.05, legs = tw * 0.55;
          const tx = b.x + b.w * (0.25 + (b.x % 7) / 14);
          const ty = roof - legs - th;
          g.fillRect(tx - tw * 0.42, roof - legs, 1.2, legs);
          g.fillRect(tx + tw * 0.42 - 1.2, roof - legs, 1.2, legs);
          g.fillRect(tx - 0.6, roof - legs, 1.2, legs);
          g.fillRect(tx - tw / 2, ty, tw, th);
          g.beginPath();
          g.moveTo(tx - tw * 0.55, ty + 1);
          g.lineTo(tx, ty - th * 0.45);
          g.lineTo(tx + tw * 0.55, ty + 1);
          g.closePath();
          g.fill();
          g.fillStyle = rgba(C.stone, 0.2);
          g.fillRect(tx - tw / 2, ty + th * 0.3, tw, 1);
          g.fillRect(tx - tw / 2, ty + th * 0.7, tw, 1);
          g.fillStyle = midC;
        }
        if (b.ant) g.fillRect(b.x + b.w * 0.7, roof - H * 0.06, 1.2, H * 0.06);
        // Unlit windows: just a whisper of sky in the glass
        g.fillStyle = rgba(C.haze, 0.35);
        b.dark.forEach((r) => g.fillRect(r.x, r.y, r.w, r.h));
      });
      gr = g.createLinearGradient(0, gy - H * 0.22, 0, gy);
      gr.addColorStop(0, rgba(C.haze, 0));
      gr.addColorStop(1, rgba(C.haze, 0.45));
      g.fillStyle = gr;
      g.fillRect(0, gy - H * 0.22, W, H * 0.22);

      // Near buildings
      const nearC = rgba(C.near, 1);
      [L.lb, L.rb].forEach((b) => {
        g.fillStyle = nearC;
        g.fillRect(b.x0, b.top, b.x1 - b.x0, gy - b.top + 1);
        // Cornice catching a little sky light
        g.fillRect(b.x0 - 4, b.top - H * 0.012, b.x1 - b.x0 + 8, H * 0.012);
        g.fillStyle = rgba(C.stone, 0.4);
        g.fillRect(b.x0 - 4, b.top - H * 0.012, b.x1 - b.x0 + 8, 1);
        g.fillStyle = rgba(C.stone, 0.14);
        g.fillRect(b.x0, b.top + H * 0.012, b.x1 - b.x0, 1);
        // Faint brick coursing so the facade is not a flat void
        g.fillStyle = rgba(C.stone, 0.045);
        for (let y = b.top + H * 0.02; y < gy; y += Math.max(3, H * 0.008)) g.fillRect(b.x0, y, b.x1 - b.x0, 0.6);
        // Sky light fading down the facade
        const fg = g.createLinearGradient(0, b.top, 0, b.top + H * 0.25);
        fg.addColorStop(0, rgba(C.haze, 0.22));
        fg.addColorStop(1, rgba(C.haze, 0));
        g.fillStyle = fg;
        g.fillRect(b.x0, b.top, b.x1 - b.x0, H * 0.25);
      });
      // Corner edges facing the street light
      g.fillStyle = rgba(C.stone, 0.4);
      g.fillRect(L.lb.x1 - 1, L.lb.top, 1, gy - L.lb.top);
      g.fillRect(L.rb.x0, L.rb.top, 1, gy - L.rb.top);
      // Water tower on the bar's roof
      {
        const tw = clamp(R * 0.034, 14, 40), th = tw * 1.1, legs = tw * 0.6;
        const tx = L.rb.x0 + L.rbW * 0.72, roof = L.rb.top - H * 0.012;
        g.fillStyle = nearC;
        [-0.42, 0, 0.42].forEach((f) => g.fillRect(tx + tw * f - 1, roof - legs, 2, legs));
        g.fillRect(tx - tw / 2, roof - legs - th, tw, th);
        g.beginPath();
        g.moveTo(tx - tw * 0.56, roof - legs - th + 1);
        g.lineTo(tx, roof - legs - th * 1.48);
        g.lineTo(tx + tw * 0.56, roof - legs - th + 1);
        g.closePath();
        g.fill();
        g.fillStyle = rgba(C.stone, 0.32);
        g.fillRect(tx - tw / 2, roof - legs - th * 0.7, tw, 1);
        g.fillRect(tx - tw / 2, roof - legs - th * 0.3, tw, 1);
      }
      // Unlit near-window glass
      g.fillStyle = rgba(C.haze, 0.3);
      wins.forEach((w) => { if (w.near) g.fillRect(w.x, w.y, w.w, w.h); });

      // Light washing the facades: lamp at left, neon and bar at right
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.12;
      g.drawImage(SP.amber, L.lamp.hx - R * 0.2, L.lamp.ly - H * 0.3, R * 0.4, H * 0.6);
      g.globalAlpha = 0.1;
      g.drawImage(SP.amber, L.sign.cx - L.sign.w * 0.9, L.sign.cy - H * 0.22, L.sign.w * 1.8, H * 0.44);
      g.globalAlpha = 0.07;
      g.drawImage(SP.blue, L.hs.x0 + L.hs.w / 2 - L.hs.w * 3, L.hs.y0 - L.hs.h * 0.2, L.hs.w * 6, L.hs.h * 1.4);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';

      // Sign hardware and dead tubes (visible when the neon stutters off)
      const hs = L.hs;
      g.beginPath();
      roundRect(g, hs.x0, hs.y0, hs.w, hs.h, 4);
      g.fillStyle = '#07090f';
      g.fill();
      g.strokeStyle = rgba(C.stone, 0.35);
      g.lineWidth = 1;
      g.stroke();
      if (hotel) {
        g.save();
        g.font = hotel.font;
        g.textAlign = 'center';
        g.fillStyle = rgba(C.stone, 0.5);
        hotel.letters.forEach((p) => g.fillText(p.ch, hotel.x + p.x, hotel.y + p.y));
        g.restore();
      }
      if (neon) {
        g.save();
        g.font = neon.font;
        g.fillStyle = rgba(C.stone, 0.42);
        g.fillText(neon.text, neon.x + neon.tx, neon.y + neon.base);
        g.restore();
      }

      // Far sidewalk: slabs with joints, a wet sheen at the curb
      g.fillStyle = rgba(mix(C.street, C.stone, 0.22), 1);
      g.fillRect(0, gy, W, curb - gy);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      for (let x = (rnd() * R * 0.05); x < W; x += R * 0.05) g.fillRect(x, gy, 1, curb - gy);
      g.fillStyle = rgba(C.stone, 0.5);
      g.fillRect(0, curb - 1.5, W, 1.5);

      // Street base
      gr = g.createLinearGradient(0, curb, 0, H);
      gr.addColorStop(0, rgba(mix(C.street, C.haze, 0.55), 1));
      gr.addColorStop(1, rgba(C.street, 1));
      g.fillStyle = gr;
      g.fillRect(0, curb, W, H - curb);

      // Mirror of the city in the wet street, softened
      const span = H - curb;
      const tmp = canvas(bgCv.width, bgCv.height);
      tmp.getContext('2d').drawImage(bgCv, 0, 0);
      g.save();
      g.beginPath();
      g.rect(0, curb, W, span);
      g.clip();
      g.translate(0, curb + span);
      g.scale(1, -1);
      g.globalAlpha = 0.34;
      try { g.filter = 'blur(1.5px)'; } catch (e) { /* no canvas filters */ }
      g.drawImage(tmp, 0, Math.max(0, (curb - span * 1.6)) * dpr, W * dpr, span * 1.6 * dpr, 0, 0, W, span);
      g.restore();
      try { g.filter = 'none'; } catch (e) { /* no canvas filters */ }

      // Fade toward the viewer
      gr = g.createLinearGradient(0, curb, 0, H);
      gr.addColorStop(0, rgba(C.street, 0.05));
      gr.addColorStop(1, rgba(C.street, 0.72));
      g.fillStyle = gr;
      g.fillRect(0, curb, W, span);

      // Cobblestones in perspective, wet tops catching sky and lamp light
      const lightAt = (x, y) => {
        const lx = (x - L.lamp.hx) / (R * 0.16), ly = (y - curb) / (H * 0.12);
        const bx = (x - L.sign.cx) / (L.sign.w * 0.8), by = (y - curb) / (H * 0.08);
        return { lamp: Math.exp(-(lx * lx + ly * ly)), bar: Math.exp(-(bx * bx + by * by)) * 0.7 };
      };
      const horizon = gy - H * 0.06;
      const puddles = [];
      for (let i = 0; i < 4; i++) {
        puddles.push({ x: W * (0.1 + rnd() * 0.85), y: curb + (H - curb) * (0.25 + rnd() * 0.65), rx: R * (0.05 + rnd() * 0.07) });
      }
      const inPuddle = (x, y) => puddles.some((p) => {
        const dx = (x - p.x) / p.rx, dy = (y - p.y) / (p.rx * (0.12 + 0.2 * (y - curb) / (H - curb)));
        return dx * dx + dy * dy < 1;
      });
      for (let y = curb + 1; y < H;) {
        const rh = Math.max(2, (y - horizon) * 0.058);
        const gap = Math.max(0.6, rh * 0.13);
        let x = -rnd() * rh * 2;
        while (x < W) {
          const sw = rh * (1.3 + rnd() * 1.1);
          const cx = x + sw / 2, cy = y + rh / 2;
          if (!inPuddle(cx, cy)) {
            const lt = lightAt(cx, y);
            const warm = clamp(lt.lamp + lt.bar, 0, 1);
            g.fillStyle = rgba(mix(C.stone, C.amber, warm * 0.55), 0.035 + rnd() * 0.05 + warm * 0.1);
            g.beginPath();
            roundRect(g, x + gap / 2, y + gap / 2, sw - gap, rh - gap, rh * 0.4);
            g.fill();
            // Wet highlight along the top edge of the stone
            g.fillStyle = rgba(mix(C.rain, C.hot, warm), 0.025 + warm * 0.32 + rnd() * 0.035);
            g.fillRect(x + gap + rh * 0.3, y + gap / 2 + 0.3, Math.max(1, sw - gap * 2 - rh * 0.6), Math.max(0.6, rh * 0.07));
          }
          x += sw;
        }
        y += rh;
      }

      // Manhole: iron lid with a faint rim
      const mh = L.manhole;
      g.save();
      g.beginPath();
      g.ellipse(mh.x, mh.y, mh.rx, mh.rx * 0.26, 0, 0, Math.PI * 2);
      g.fillStyle = '#06080b';
      g.fill();
      g.strokeStyle = rgba(C.stone, 0.45);
      g.lineWidth = 1;
      g.stroke();
      g.beginPath();
      g.ellipse(mh.x, mh.y, mh.rx * 0.7, mh.rx * 0.18, 0, 0, Math.PI * 2);
      g.strokeStyle = rgba(C.stone, 0.18);
      g.stroke();
      g.restore();
    }

    /* ---------- Front layer: drawn over the lit windows every frame ---------- */
    let frontBoxes = [];
    function paintFront() {
      front = canvas(W * dpr, H * dpr);
      // Regions worth copying each frame: the two facades and the lamp in between
      const yb = Math.ceil(L.curb + 2), lp0 = L.lamp;
      const lx = Math.floor(lp0.x - lp0.pw * 3), lw = Math.ceil(lp0.arm + lp0.lw + lp0.pw * 6);
      frontBoxes = [
        [0, 0, Math.ceil(L.lb.x1 + 2), yb],
        [lx, Math.floor(lp0.top - lp0.arm), lw, Math.ceil(yb - lp0.top + lp0.arm)],
        [Math.floor(L.rb.x0 - 2), 0, Math.ceil(W - L.rb.x0 + 2), yb],
      ].map((b) => [clamp(b[0], 0, W), clamp(b[1], 0, H), Math.min(b[2], W - clamp(b[0], 0, W)), Math.min(b[3], H - clamp(b[1], 0, H))]);
      const g = front.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { gy, R } = L;
      const dark = rgba(C.near, 1);
      const rim = rgba(C.stone, 0.42);

      // Window frames, sills and venetian blinds
      wins.forEach((w) => {
        if (!w.near) return;
        const mw = Math.max(1.2, w.w * 0.07);
        g.fillStyle = dark;
        g.fillRect(w.x + w.w / 2 - mw / 2, w.y, mw, w.h);
        g.fillRect(w.x, w.y + w.h * 0.4, w.w, mw);
        g.strokeStyle = dark;
        g.lineWidth = mw;
        g.strokeRect(w.x + mw / 2, w.y + mw / 2, w.w - mw, w.h - mw);
        g.fillStyle = rim;
        g.fillRect(w.x - 2, w.y + w.h, w.w + 4, Math.max(1.2, w.h * 0.05));
        if (w.figure) {
          // A man in a fedora, standing at the window
          const r = w.w * 0.15, hx = w.x + w.w * 0.6, hy = w.y + w.h * 0.5;
          g.fillStyle = 'rgba(4,5,8,0.94)';
          g.beginPath();
          g.arc(hx, hy, r, 0, Math.PI * 2);
          g.fill();
          g.beginPath();
          g.ellipse(hx, hy - r * 0.55, r * 1.9, r * 0.32, 0, 0, Math.PI * 2);
          g.fill();
          g.beginPath();
          roundRect(g, hx - r * 1.05, hy - r * 1.7, r * 2.1, r * 1.25, r * 0.5);
          g.fill();
          g.beginPath();
          g.moveTo(hx - r * 0.6, hy + r * 0.8);
          g.quadraticCurveTo(hx - r * 3, hy + r * 1.3, hx - r * 3.4, w.y + w.h);
          g.lineTo(hx + r * 3.2, w.y + w.h);
          g.quadraticCurveTo(hx + r * 2.8, hy + r * 1.3, hx + r * 0.6, hy + r * 0.8);
          g.closePath();
          g.fill();
        }
        if (w.blinds) {
          const slat = Math.max(1, w.h * 0.05), step = slat * 2.1;
          g.fillStyle = 'rgba(4,5,8,0.6)';
          for (let y = w.y + mw; y < w.y + w.h * w.blindsTo; y += step) g.fillRect(w.x + mw, y, w.w - mw * 2, slat);
        }
      });

      // Fire escape across the hotel's left windows
      const fe = wins.filter((w) => w.near && w.x < L.lb.x1 && w.ci === 0);
      if (fe.length > 1 && L.wide) {
        const x0 = fe[0].x - fe[0].w * 0.45, x1 = fe[0].x + fe[0].w * 1.45;
        g.lineCap = 'square';
        fe.forEach((w, i) => {
          const py = w.y + w.h + w.h * 0.18, rail = w.h * 0.42;
          g.fillStyle = '#020305';
          g.fillRect(x0, py, x1 - x0, 2);
          g.fillRect(x0, py - rail, x1 - x0, 1.2);
          for (let x = x0; x <= x1; x += Math.max(3, w.w * 0.12)) g.fillRect(x, py - rail, 0.8, rail);
          g.fillStyle = rgba(C.stone, 0.5);
          g.fillRect(x0, py - rail - 0.6, x1 - x0, 0.6);
          g.fillRect(x0, py - 0.6, x1 - x0, 0.6);
          // Ladder to the platform below
          const nx = fe[i + 1];
          if (nx) {
            const ny = nx.y + nx.h + nx.h * 0.18;
            const a = i % 2 ? [x0 + 3, py] : [x1 - 3, py];
            const b = i % 2 ? [x1 - 6, ny] : [x0 + 6, ny];
            g.strokeStyle = '#020305';
            g.lineWidth = 1.6;
            g.beginPath();
            g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
            g.moveTo(a[0] + 4, a[1]); g.lineTo(b[0] + 4, b[1]);
            g.stroke();
          }
        });
      }

      // Storefront: door frame, window mullions, blinds, awning
      const d = L.door, bw = L.barWin;
      g.fillStyle = dark;
      g.fillRect(d.x, d.y + d.h * 0.5, d.w, d.h * 0.5);
      g.fillRect(d.x + d.w / 2 - 0.75, d.y, 1.5, d.h * 0.5);
      g.fillStyle = rgba(C.amber, 0.25);
      g.fillRect(d.x + d.w * 0.15, d.y + d.h * 0.62, d.w * 0.7, 1);
      g.strokeStyle = dark;
      g.lineWidth = Math.max(1.5, d.w * 0.09);
      g.strokeRect(d.x, d.y, d.w, d.h);
      g.lineWidth = Math.max(1.5, bw.w * 0.012);
      g.strokeRect(bw.x, bw.y, bw.w, bw.h);
      for (let i = 1; i < 3; i++) g.fillRect(bw.x + (bw.w * i) / 3 - 1, bw.y, 2, bw.h);
      g.fillStyle = 'rgba(4,5,8,0.5)';
      const slat = Math.max(1, bw.h * 0.06);
      for (let y = bw.y + 2; y < bw.y + bw.h * 0.42; y += slat * 2.2) g.fillRect(bw.x + 2, y, bw.w - 4, slat);
      // Double bass in the window, the band's on tonight
      {
        const bh = bw.h * 0.92, bx = bw.x + bw.w * 0.78, by = bw.y + bw.h;
        g.fillStyle = 'rgba(4,5,8,0.92)';
        g.beginPath();
        g.ellipse(bx, by - bh * 0.2, bh * 0.17, bh * 0.2, 0, 0, Math.PI * 2);
        g.ellipse(bx, by - bh * 0.48, bh * 0.13, bh * 0.15, 0, 0, Math.PI * 2);
        g.fill();
        g.fillRect(bx - bh * 0.02, by - bh * 0.98, bh * 0.04, bh * 0.6);
        g.beginPath();
        g.arc(bx + bh * 0.02, by - bh * 0.98, bh * 0.04, 0, Math.PI * 2);
        g.fill();
      }
      const aw = L.awning;
      g.fillStyle = '#080a10';
      g.beginPath();
      g.moveTo(aw.x0 + aw.h * 0.4, aw.y);
      g.lineTo(aw.x1 - aw.h * 0.4, aw.y);
      g.lineTo(aw.x1, aw.y + aw.h);
      const sc = Math.max(6, aw.h * 0.9), n = Math.max(4, Math.round((aw.x1 - aw.x0) / sc));
      for (let i = n; i > 0; i--) {
        const xa = aw.x0 + ((aw.x1 - aw.x0) * i) / n, xb = aw.x0 + ((aw.x1 - aw.x0) * (i - 1)) / n;
        g.quadraticCurveTo((xa + xb) / 2, aw.y + aw.h * 1.45, xb, aw.y + aw.h);
      }
      g.closePath();
      g.fill();
      g.fillStyle = rgba(C.amber, 0.08);
      for (let i = 0; i < n; i += 2) {
        const xa = aw.x0 + ((aw.x1 - aw.x0) * i) / n;
        g.fillRect(xa, aw.y + 1, (aw.x1 - aw.x0) / n, aw.h - 1);
      }
      g.fillStyle = rgba(C.amber, 0.4);
      g.fillRect(aw.x0 + aw.h * 0.4, aw.y, aw.x1 - aw.x0 - aw.h * 0.8, 1);

      // Street lamp: fluted post, shepherd's crook, hanging lantern
      const lp = L.lamp;
      g.fillStyle = '#030408';
      g.beginPath();
      g.moveTo(lp.x - lp.pw * 2.2, lp.base);
      g.lineTo(lp.x + lp.pw * 2.2, lp.base);
      g.lineTo(lp.x + lp.pw * 1.3, lp.base - H * 0.04);
      g.lineTo(lp.x - lp.pw * 1.3, lp.base - H * 0.04);
      g.closePath();
      g.fill();
      g.fillRect(lp.x - lp.pw / 2, lp.top, lp.pw, lp.base - lp.top);
      g.fillRect(lp.x - lp.pw * 1.1, lp.base - H * 0.12, lp.pw * 2.2, 2.5);
      g.fillRect(lp.x - lp.pw * 0.9, lp.top + H * 0.04, lp.pw * 1.8, 2);
      g.strokeStyle = '#030408';
      g.lineWidth = lp.pw * 0.75;
      g.beginPath();
      g.arc(lp.x + lp.arm / 2, lp.top, lp.arm / 2, Math.PI, 0);
      g.lineTo(lp.hx, lp.hang);
      g.stroke();
      g.beginPath();
      g.arc(lp.x, lp.top - lp.pw * 0.6, lp.pw * 0.8, 0, Math.PI * 2);
      g.fill();
      // Rim light on the lamp side facing the bar
      g.fillStyle = rgba(C.stone, 0.45);
      g.fillRect(lp.x + lp.pw / 2 - 0.8, lp.top, 0.8, lp.base - lp.top - H * 0.04);
      // Lantern cap and frame
      g.fillStyle = '#05060a';
      g.beginPath();
      g.moveTo(lp.hx - lp.lw * 0.62, lp.gy0);
      g.lineTo(lp.hx + lp.lw * 0.62, lp.gy0);
      g.lineTo(lp.hx + lp.lw * 0.18, lp.hang);
      g.lineTo(lp.hx - lp.lw * 0.18, lp.hang);
      g.closePath();
      g.fill();
      g.fillRect(lp.hx - lp.lw * 0.32, lp.gy1, lp.lw * 0.64, Math.max(1.5, lp.lw * 0.12));
      g.strokeStyle = 'rgba(5,6,10,0.85)';
      g.lineWidth = Math.max(0.8, lp.lw * 0.07);
      g.beginPath();
      g.moveTo(lp.hx, lp.gy0); g.lineTo(lp.hx, lp.gy1);
      g.stroke();
    }

    /* ---------- Neon signs, pre-rendered once per size ---------- */
    function neonPaint(g, shape, col, hot, size) {
      g.save();
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.shadowColor = rgba(col, 1);
      g.shadowBlur = size * 0.55 * dpr;
      g.fillStyle = g.strokeStyle = rgba(col, 0.5);
      g.lineWidth = size * 0.07;
      shape(g);
      g.shadowBlur = size * 0.18 * dpr;
      g.fillStyle = g.strokeStyle = rgba(col, 0.95);
      g.lineWidth = size * 0.055;
      shape(g);
      g.shadowColor = rgba(hot, 1);
      g.shadowBlur = size * 0.05 * dpr;
      g.fillStyle = g.strokeStyle = rgba(hot, 0.95);
      g.lineWidth = size * 0.022;
      shape(g);
      g.restore();
    }
    const sprite = (w, h, paint) => {
      const c = canvas(w * dpr, h * dpr), g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint(g);
      return c;
    };

    function buildSigns() {
      // "Noir Hours" in italic serif with a swash underline; the second "o" can stutter alone
      const text = 'Noir Hours', k = 6;
      const font = (s) => `italic 500 ${s}px ${F.sign}`;
      const m = canvas(4, 4).getContext('2d');
      m.font = font(100);
      let fs = Math.max(14, (L.sign.w / m.measureText(text).width) * 100);
      fs = Math.min(fs, H * 0.12);
      m.font = font(fs);
      const tw = m.measureText(text).width;
      const pad = fs * 0.85;
      const sw = tw + pad * 2, sh = fs * 1.5 + pad * 2;
      const base = pad + fs * 0.92;
      const x1 = pad + m.measureText(text.slice(0, k)).width, x2 = pad + m.measureText(text.slice(0, k + 1)).width;
      const swash = (g) => {
        g.beginPath();
        g.moveTo(pad + tw * 0.08, base + fs * 0.24);
        g.bezierCurveTo(pad + tw * 0.38, base + fs * 0.36, pad + tw * 0.7, base + fs * 0.12, pad + tw * 0.97, base + fs * 0.2);
        g.stroke();
      };
      const setFont = (g) => { g.font = font(fs); g.textBaseline = 'alphabetic'; };
      neon = {
        text, font: font(fs), fs, tw, base, tx: pad, w: sw, h: sh,
        x: L.sign.cx - sw / 2, y: L.sign.cy - (base - fs * 0.3),
        main: sprite(sw, sh, (g) => {
          setFont(g);
          neonPaint(g, (c) => { c.fillText(text.slice(0, k), pad, base); c.fillText(text.slice(k + 1), x2, base); swash(c); }, C.amber, C.hot, fs);
        }),
        letter: sprite(sw, sh, (g) => { setFont(g); neonPaint(g, (c) => c.fillText(text[k], x1, base), C.amber, C.hot, fs); }),
      };

      // Vertical HOTEL sign in cool blue, its E buzzes now and then
      const hs = L.hs, ls = hs.ls;
      const hpad = ls * 1.1;
      const hfont = `600 ${ls}px ${F.label}`;
      const letters = 'HOTEL'.split('').map((ch, i) => ({ ch, x: hpad + hs.w / 2, y: hpad + ls * 0.35 + ls * 1.2 * i + ls * 0.95 }));
      const tube = (g) => { g.beginPath(); roundRect(g, hpad + 3, hpad + 3, hs.w - 6, hs.h - 6, 3); g.stroke(); };
      const hw = hs.w + hpad * 2, hh = hs.h + hpad * 2;
      const setH = (g) => { g.font = hfont; g.textAlign = 'center'; };
      hotel = {
        font: hfont, letters, x: hs.x0 - hpad, y: hs.y0 - hpad, w: hw, h: hh,
        main: sprite(hw, hh, (g) => {
          setH(g);
          neonPaint(g, (c) => { letters.forEach((p, i) => { if (i !== 3) c.fillText(p.ch, p.x, p.y); }); tube(c); }, C.blue, [225, 236, 255], ls);
        }),
        letter: sprite(hw, hh, (g) => { setH(g); neonPaint(g, (c) => c.fillText(letters[3].ch, letters[3].x, letters[3].y), C.blue, [225, 236, 255], ls); }),
      };
      // Dead-tube letters live in the backdrop, so offsets are relative to the sprite origin
      hotel.letters = letters.map((p) => ({ ch: p.ch, x: p.x, y: p.y }));
    }

    function buildCone() {
      const lp = L.lamp;
      const top = lp.gy1, bot = L.curb + (H - L.curb) * 0.1;
      const hw0 = lp.lw * 0.45, hw1 = clamp(L.R * 0.1, 44, 140);
      const cw = hw1 * 2.8, ch = bot - top;
      const c = canvas(cw * dpr, ch * dpr), g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalCompositeOperation = 'lighter';
      const n = 40, slice = ch / n;
      for (let i = 0; i <= n; i++) {
        const k = i / n, y = k * ch, hw = lerp(hw0, hw1, k);
        g.globalAlpha = 0.085 * (1 - 0.45 * k);
        g.drawImage(SP.amber, cw / 2 - hw * 1.3, y - slice * 2, hw * 2.6, slice * 4);
      }
      cone = { c, x: lp.hx - cw / 2, y: top, w: cw, h: ch, top, bot, hw0, hw1 };
    }

    // Film grain, baked into the backdrop in device pixels
    function paintGrain() {
      const s = 192, c = canvas(s, s), g = c.getContext('2d');
      const img = g.createImageData(s, s), d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() < 0.5 ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = Math.random() * (v ? 13 : 20);
      }
      g.putImageData(img, 0, 0);
      const p = bgx.createPattern(c, 'repeat');
      if (!p) return;
      bgx.save();
      bgx.setTransform(1, 0, 0, 1, 0, 0);
      bgx.globalAlpha = 1;
      bgx.globalCompositeOperation = 'source-over';
      bgx.fillStyle = p;
      bgx.fillRect(0, 0, bgCv.width, bgCv.height);
      bgx.restore();
    }

    /* ---------- Rain, splashes, steam, fog ---------- */
    const RAIN = [
      { v: 0.95, len: 0.02, lw: 0.8, a: 0.13 },
      { v: 1.35, len: 0.034, lw: 1, a: 0.2 },
      { v: 1.95, len: 0.06, lw: 1.25, a: 0.26 },
    ];
    const SLANT = 0.2;
    function resetDrop(d, anywhere) {
      const P = RAIN[d.layer];
      d.len = H * P.len * (0.7 + Math.random() * 0.6);
      d.v = H * P.v * (0.85 + Math.random() * 0.3);
      d.x = Math.random() * (W + H * SLANT);
      d.y = anywhere ? Math.random() * H : -d.len - Math.random() * H * 0.15;
      d.ground = d.layer === 0 ? H * (0.35 + Math.random() * 0.4)
        : d.layer === 1 ? L.curb + Math.random() * (H - L.curb) : H + d.len;
      return d;
    }
    function seedParticles() {
      const n = Math.round(clamp((W * H) / 1700, 140, 560));
      drops = [];
      for (let i = 0; i < n; i++) {
        const r = Math.random();
        drops.push(resetDrop({ layer: r < 0.5 ? 0 : r < 0.84 ? 1 : 2 }, true));
      }
      splashes = [];
      steam = [];
      fog = [];
      for (let i = 0; i < 6; i++) {
        fog.push({
          x: Math.random() * W, y: L.gy + H * (-0.05 + Math.random() * 0.12),
          w: W * (0.35 + Math.random() * 0.35), h: H * (0.06 + Math.random() * 0.07),
          v: (3 + Math.random() * 7) * (Math.random() < 0.5 ? -1 : 1), a: 0.05 + Math.random() * 0.05,
        });
      }
    }

    /* ---------- Build everything for the current size ---------- */
    function build() {
      const w = Math.round(sceneEl.clientWidth), h = Math.round(sceneEl.clientHeight);
      if (w < 40 || h < 40) return false;
      W = w; H = h;
      dpr = lowRes ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      [bgCv, fxCv].forEach((c) => { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });
      C = readColors();
      F = fonts();
      L = layout();
      SP = {
        amber: glow(C.amber), hot: glow(C.hot), blue: glow(C.blue), white: glow(C.white),
        tail: glow(C.tail), haze: glow(mix(C.haze, C.rain, 0.3)), steam: glow(mix(C.haze, C.rain, 0.55)),
      };
      const rnd = seeded(1947);
      genCity(rnd);
      buildSigns();
      paintBackdrop(rnd);
      paintFront();
      buildCone();
      paintGrain();
      seedParticles();
      for (let i = 0; i < 90; i++) stepParticles(1 / 30);   // let steam and splashes settle in
      built = true;
      return true;
    }

    /* ---------- Simulation ---------- */
    const FLICKERS = {
      all: [[0.06, 0.18], [0.05, 1], [0.07, 0.06], [0.11, 0.9], [0.05, 0.3], [0.3, 1]],
      letter: [[0.07, 0.1], [0.06, 0.8], [0.35, 0.04], [0.05, 0.7], [0.08, 0.08], [1.1, 0.02], [0.06, 0.6], [0.05, 0.1], [0.2, 1]],
    };
    function stepFlicker(st, dt) {
      if (!st.seq) return;
      st.seqT += dt;
      let acc = 0, v = 1;
      for (let i = 0; i < st.seq.length; i++) {
        acc += st.seq[i][0];
        if (st.seqT < acc) { v = st.seq[i][1]; break; }
      }
      if (st.seqT >= acc) { st.seq = null; v = 1; }
      if (st.kind === 'all') st.level = v; else st.letter = v;
    }

    function stepLevel(dt) {
      let target = 0;
      if (sound.playing) {
        if (sound.analyser) {
          // Low and mid energy; a fast follower over a slow one picks out notes and hits,
          // so the lights swell with the phrasing instead of sitting at one brightness
          sound.analyser.getByteFrequencyData(sound.bins);
          const n = Math.min(sound.bins.length, 40);
          let sum = 0;
          for (let i = 0; i < n; i++) sum += sound.bins[i];
          const raw = sum / (n * 255);
          sound.fast += (raw - sound.fast) * (1 - Math.exp(-dt * 20));
          sound.slow += (raw - sound.slow) * (1 - Math.exp(-dt * 0.8));
          const gate = clamp(sound.slow / 0.06, 0, 1);
          const pulse = sound.slow > 0.005 ? clamp((sound.fast / sound.slow - 0.9) * 3.2, 0, 1) : 0;
          target = gate * (0.32 + 0.68 * pulse);
        } else {
          target = 0.4 + 0.25 * Math.sin(t * 2.2) * Math.sin(t * 0.63);   // no analyser: a slow breath
        }
      }
      const k = 1 - Math.exp(-dt * (target > sound.level ? 12 : 3.2));
      sound.level += (target - sound.level) * k;
    }

    function stepParticles(dt) {
      // Rain and the splashes it leaves on the street
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        d.y += d.v * dt;
        d.x -= d.v * SLANT * dt;
        if (d.y >= d.ground) {
          if (d.layer > 0 && d.y < H && Math.random() < 0.45 && splashes.length < 70) {
            splashes.push({ x: d.x, y: d.ground, age: 0, life: 0.28 + Math.random() * 0.2, r: (d.layer + 1) * 1.6 * (0.6 + (d.ground - L.curb) / (H - L.curb)) });
          }
          resetDrop(d, false);
        }
      }
      for (let i = splashes.length - 1; i >= 0; i--) {
        splashes[i].age += dt;
        if (splashes[i].age > splashes[i].life) splashes.splice(i, 1);
      }
      // Steam rising from the manhole
      steamClock -= dt;
      const mh = L.manhole;
      if (steamClock <= 0) {
        steamClock = 0.07;
        steam.push({
          x: mh.x + (Math.random() - 0.5) * mh.rx * 0.9, y: mh.y - 1,
          vx: -(2 + Math.random() * 5), vy: -(H * 0.045 + Math.random() * H * 0.04),
          r: mh.rx * (0.18 + Math.random() * 0.14), age: 0, life: 2.6 + Math.random() * 1.8,
          ph: Math.random() * 6.28,
        });
      }
      for (let i = steam.length - 1; i >= 0; i--) {
        const p = steam[i];
        p.age += dt;
        p.x += (p.vx + Math.sin(p.age * 1.7 + p.ph) * 6) * dt;
        p.y += p.vy * dt;
        p.vy *= 1 - dt * 0.25;
        p.vx -= dt * 3;
        if (p.age > p.life) steam.splice(i, 1);
      }
      fog.forEach((f) => {
        f.x += f.v * dt;
        if (f.x > W + f.w / 2) f.x = -f.w / 2;
        if (f.x < -f.w / 2) f.x = W + f.w / 2;
      });
    }

    function update(dt) {
      t += dt;
      stepLevel(dt);
      // Windows fade slowly toward their target
      for (let i = 0; i < wins.length; i++) {
        const w = wins[i];
        if (w.on !== w.target) {
          const s = dt * w.rate;
          w.on = w.on < w.target ? Math.min(w.target, w.on + s) : Math.max(w.target, w.on - s);
        }
      }
      if (t > nextToggle && toggleable.length) {
        nextToggle = t + 1.4 + Math.random() * 3;
        const w = toggleable[(Math.random() * toggleable.length) | 0];
        const lit = toggleable.reduce((s, x) => s + (x.target ? 1 : 0), 0) / toggleable.length;
        if (!(w.target && lit < 0.42)) { w.target = w.target ? 0 : 1; w.rate = 0.45 + Math.random() * 0.8; }
      }
      // Neon stutters now and then
      if (t > neonFx.next) {
        neonFx.kind = Math.random() < 0.55 ? 'all' : 'letter';
        neonFx.seq = FLICKERS[neonFx.kind];
        neonFx.seqT = 0;
        neonFx.next = t + 9 + Math.random() * 12;
      }
      if (t > hotelFx.next) { hotelFx.seq = FLICKERS.letter; hotelFx.seqT = 0; hotelFx.next = t + 18 + Math.random() * 20; }
      stepFlicker(neonFx, dt);
      stepFlicker(hotelFx, dt);
      // A car now and then
      if (!car && t > nextCar) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        car = { dir, x: dir > 0 ? -L.carL * 2.2 : W + L.carL * 2.2, v: W / (6.5 + Math.random() * 2.5) };
      }
      if (car) {
        car.x += car.dir * car.v * dt;
        if ((car.dir > 0 && car.x > W + L.carL * 0.2) || (car.dir < 0 && car.x < -L.carL * 0.2)) {
          car = null;
          nextCar = t + 14 + Math.random() * 16;
        }
      }
      stepParticles(dt);
    }

    /* ---------- Drawing the live layer ---------- */
    // A wet-street reflection: a column of soft rippling bands under a light
    function streak(spr, x, srcY, w, a, seed, top, bottom) {
      if (a < 0.01) return;
      top = top || L.curb + 1;
      bottom = bottom || H;
      const span = bottom - top;
      if (span < 4) return;
      const my = top + Math.min(span * 0.9, (top - srcY) * 0.55);
      const sig = span * 0.42;
      const step = Math.max(2.2, span / 56);
      for (let y = top; y < bottom; y += step) {
        const k = (y - top) / span;
        const d = (y - my) / sig;
        let al = a * (0.32 + 0.68 * Math.exp(-d * d)) * (1 - 0.4 * k);
        al *= 0.5 + 0.28 * Math.sin(y * 0.21 + t * 2.3 + seed * 3.7) + 0.22 * Math.sin(y * 0.067 - t * 1.3 + seed * 1.7);
        if (al < 0.008) continue;
        const amp = (1.2 + 6 * k) * Math.max(0.6, L.s);
        const off = Math.sin(y * 0.11 + t * 1.4 + seed) * amp + Math.sin(y * 0.047 - t * 0.9 + seed * 2.1) * amp * 0.6;
        const ww = w * (0.75 + 0.6 * k) * (0.8 + 0.35 * Math.sin(y * 0.33 + seed));
        ctx.globalAlpha = Math.min(1, al);
        ctx.drawImage(spr, x + off - ww / 2, y - step, ww, step * 2.6);
      }
    }

    function carPath(g) {
      g.beginPath();
      g.moveTo(0.015, -0.085);
      g.bezierCurveTo(0, -0.11, 0.004, -0.17, 0.035, -0.19);
      g.bezierCurveTo(0.07, -0.215, 0.12, -0.25, 0.2, -0.29);
      g.bezierCurveTo(0.26, -0.33, 0.33, -0.355, 0.42, -0.355);
      g.bezierCurveTo(0.5, -0.355, 0.55, -0.34, 0.585, -0.3);
      g.lineTo(0.64, -0.228);
      g.bezierCurveTo(0.72, -0.226, 0.83, -0.224, 0.9, -0.205);
      g.bezierCurveTo(0.955, -0.19, 0.99, -0.16, 0.995, -0.12);
      g.bezierCurveTo(1, -0.1, 0.99, -0.085, 0.975, -0.08);
      g.lineTo(0.885, -0.08);
      g.bezierCurveTo(0.875, -0.17, 0.725, -0.17, 0.715, -0.08);
      g.lineTo(0.305, -0.08);
      g.bezierCurveTo(0.295, -0.17, 0.145, -0.17, 0.135, -0.08);
      g.closePath();
    }

    function drawCar() {
      const Lc = L.carL, cy = L.carY, dir = car.dir;
      const nose = car.x + dir * Lc;
      // Reflection: dark mirrored body, then the lights' streaks
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.translate(car.x, cy);
      ctx.scale(dir * Lc, -Lc * 0.75);
      carPath(ctx);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = rgba(C.street, 1);
      ctx.fill();
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      streak(SP.white, nose - dir * Lc * 0.03, cy - Lc * 0.15, Lc * 0.12, 0.5, 4.2, cy + 2, Math.min(H, cy + Lc * 0.9));
      streak(SP.tail, car.x + dir * Lc * 0.03, cy - Lc * 0.17, Lc * 0.06, 0.35, 1.7, cy + 2, Math.min(H, cy + Lc * 0.6));
      // Headlight beam and its pool on the wet street
      for (let i = 0; i <= 12; i++) {
        const k = i / 12;
        const bx = nose + dir * Lc * (0.05 + k * 0.95), by = cy - Lc * lerp(0.15, 0.03, k), bh = Lc * (0.05 + k * 0.12);
        ctx.globalAlpha = 0.11 * (1 - k * 0.75);
        ctx.drawImage(SP.white, bx - Lc * 0.12, by - bh, Lc * 0.24, bh * 2);
      }
      ctx.globalAlpha = 0.3;
      ctx.drawImage(SP.white, nose + dir * Lc * 0.75 - Lc * 0.6, cy - Lc * 0.05, Lc * 1.2, Lc * 0.14);
      // Body
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(car.x, cy);
      ctx.scale(dir * Lc, Lc);
      carPath(ctx);
      ctx.fillStyle = '#040508';
      ctx.fill();
      ctx.lineWidth = 1.2 / Lc;
      ctx.strokeStyle = rgba(C.rain, 0.22);
      ctx.stroke();
      // Side glass with a pillar
      ctx.beginPath();
      ctx.moveTo(0.25, -0.245);
      ctx.bezierCurveTo(0.31, -0.31, 0.36, -0.335, 0.43, -0.336);
      ctx.lineTo(0.55, -0.33);
      ctx.lineTo(0.605, -0.245);
      ctx.closePath();
      ctx.fillStyle = rgba(mix(C.haze, C.rain, 0.25), 0.55);
      ctx.fill();
      ctx.fillStyle = '#040508';
      ctx.fillRect(0.445, -0.34, 0.022, 0.1);
      // Chrome strip, whitewall tires
      ctx.fillStyle = rgba(C.rain, 0.2);
      ctx.fillRect(0.05, -0.155, 0.88, 0.006);
      [0.22, 0.8].forEach((wx) => {
        ctx.beginPath();
        ctx.arc(wx, -0.075, 0.072, 0, Math.PI * 2);
        ctx.fillStyle = '#020203';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(wx, -0.075, 0.048, 0, Math.PI * 2);
        ctx.lineWidth = 0.014;
        ctx.strokeStyle = 'rgba(225,220,208,0.38)';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(wx, -0.075, 0.022, 0, Math.PI * 2);
        ctx.fillStyle = rgba(C.rain, 0.3);
        ctx.fill();
      });
      ctx.restore();
      // Head and tail lamps
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.95;
      const hs = Lc * 0.2;
      ctx.drawImage(SP.white, nose - dir * Lc * 0.03 - hs / 2, cy - Lc * 0.15 - hs / 2, hs, hs);
      ctx.globalAlpha = 0.6;
      ctx.drawImage(SP.tail, car.x + dir * Lc * 0.03 - hs * 0.3, cy - Lc * 0.17 - hs * 0.3, hs * 0.6, hs * 0.6);
    }

    function draw() {
      const g = ctx, lv = sound.level, lp = L.lamp;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.clearRect(0, 0, W, H);

      // Lit windows, under their frames and blinds
      const boost = 0.84 + 0.42 * lv;
      for (let i = 0; i < wins.length; i++) {
        const w = wins[i];
        const a = w.on * w.b * boost;
        if (a < 0.01) continue;
        g.globalAlpha = Math.min(1, a);
        g.fillStyle = w.fill;
        g.fillRect(w.x, w.y, w.w, w.h);
      }
      // Storefront and lantern glass
      const bar = 0.88 + 0.16 * lv;
      g.globalAlpha = Math.min(1, bar);
      g.fillStyle = barFill.door;
      g.fillRect(L.door.x, L.door.y, L.door.w, L.door.h);
      g.fillStyle = barFill.win;
      g.fillRect(L.barWin.x, L.barWin.y, L.barWin.w, L.barWin.h);
      g.globalAlpha = 1;
      g.fillStyle = rgba(C.hot, 1);
      g.beginPath();
      g.moveTo(lp.hx - lp.lw * 0.55, lp.gy0);
      g.lineTo(lp.hx + lp.lw * 0.55, lp.gy0);
      g.lineTo(lp.hx + lp.lw * 0.32, lp.gy1);
      g.lineTo(lp.hx - lp.lw * 0.32, lp.gy1);
      g.closePath();
      g.fill();

      for (let i = 0; i < frontBoxes.length; i++) {
        const b = frontBoxes[i];
        g.drawImage(front, b[0] * dpr, b[1] * dpr, b[2] * dpr, b[3] * dpr, b[0], b[1], b[2], b[3]);
      }

      // Light: everything from here adds up
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < wins.length; i++) {
        const w = wins[i];
        if (!w.near || w.on < 0.02) continue;
        g.globalAlpha = Math.min(1, w.on * (0.14 + 0.24 * lv));
        g.drawImage(w.col === C.cool ? SP.blue : SP.amber, w.x - w.w, w.y - w.h * 0.8, w.w * 3, w.h * 2.6);
      }
      // Beacon on the deco tower
      const tip = deco[0] && deco[0].tip;
      if (tip) {
        g.globalAlpha = 0.25 + 0.55 * Math.pow(Math.max(0, Math.sin(t * 1.4)), 6);
        const bs = Math.max(8, H * 0.025);
        g.drawImage(SP.tail, tip.x - bs / 2, tip.y - bs / 2, bs, bs);
      }
      // Lamp: cone, halo, pool
      g.globalAlpha = 1;
      g.drawImage(cone.c, cone.x, cone.y, cone.w, cone.h);
      const halo = H * 0.4;
      g.globalAlpha = 0.14;
      g.drawImage(SP.amber, lp.hx - halo, lp.ly - halo, halo * 2, halo * 2);
      g.globalAlpha = 0.6;
      g.drawImage(SP.amber, lp.hx - halo / 2, lp.ly - halo / 2, halo, halo);
      g.globalAlpha = 1;
      g.drawImage(SP.hot, lp.hx - lp.lw * 1.6, lp.ly - lp.lw * 1.6, lp.lw * 3.2, lp.lw * 3.2);
      g.globalAlpha = 0.6;
      g.drawImage(SP.amber, lp.hx - cone.hw1 * 1.5, L.gy - H * 0.03, cone.hw1 * 3, L.sw + H * 0.09);

      // Neon: hum, stutter, and a lift with the music
      const hum = 0.955 + 0.03 * Math.sin(t * 9.1) + 0.015 * Math.sin(t * 23.7 + 1.3);
      const nI = neonFx.level * hum * (0.86 + 0.28 * lv);
      g.globalAlpha = clamp(0.2 * nI + 0.3 * lv, 0, 1);
      g.drawImage(SP.amber, L.sign.cx - neon.tw * 0.85, L.sign.cy - neon.fs * 1.7, neon.tw * 1.7, neon.fs * 3.4);
      g.globalAlpha = clamp(nI, 0, 1);
      g.drawImage(neon.main, neon.x, neon.y, neon.w, neon.h);
      g.globalAlpha = clamp(nI * neonFx.letter, 0, 1);
      g.drawImage(neon.letter, neon.x, neon.y, neon.w, neon.h);
      g.globalAlpha = 0.16 * nI;
      g.drawImage(SP.amber, L.sign.cx - neon.tw * 0.7, L.gy - H * 0.05, neon.tw * 1.4, H * 0.09);
      const hI = hotelFx.level * (0.96 + 0.03 * Math.sin(t * 7.3 + 2)) * (0.9 + 0.16 * lv);
      g.globalAlpha = clamp(hI, 0, 1);
      g.drawImage(hotel.main, hotel.x, hotel.y, hotel.w, hotel.h);
      g.globalAlpha = clamp(hI * hotelFx.letter, 0, 1);
      g.drawImage(hotel.letter, hotel.x, hotel.y, hotel.w, hotel.h);

      // Wet street reflections
      streak(SP.amber, lp.hx, lp.ly, cone.hw1 * 0.6, 0.7, 0.3);
      streak(SP.hot, lp.hx, lp.ly, lp.lw * 1.8, 0.8, 1.1);
      [-0.34, 0, 0.34].forEach((f, i) => streak(SP.amber, L.sign.cx + f * neon.tw, L.sign.cy, neon.tw * 0.42, 0.5 * nI, 2 + i));
      streak(SP.blue, L.hs.x0 + L.hs.w / 2, L.hs.y0 + L.hs.h / 2, L.hs.w * 1.8, 0.55 * hI, 5.5);
      streak(SP.amber, L.door.x + L.door.w / 2, L.door.y, L.door.w * 1.6, 0.45 * bar, 6.1);
      streak(SP.amber, L.barWin.x + L.barWin.w * 0.3, L.barWin.y, L.barWin.w * 0.45, 0.38 * bar, 7.3);
      streak(SP.amber, L.barWin.x + L.barWin.w * 0.75, L.barWin.y, L.barWin.w * 0.45, 0.38 * bar, 8.9);
      for (let i = 0; i < wins.length; i++) {
        const w = wins[i];
        if (w.reflect && w.on > 0.05) streak(w.col === C.cool ? SP.blue : SP.amber, w.x + w.w / 2, w.y, w.w * 1.4, 0.16 * w.on * boost, i * 0.7);
      }

      // Fog drifting along the street
      g.globalCompositeOperation = 'source-over';
      fog.forEach((f) => {
        g.globalAlpha = f.a;
        g.drawImage(SP.haze, f.x - f.w / 2, f.y - f.h / 2, f.w, f.h);
      });

      // Splashes
      g.lineWidth = 0.8;
      g.strokeStyle = rgba(C.rain, 1);
      for (let i = 0; i < splashes.length; i++) {
        const s = splashes[i], k = s.age / s.life, r = s.r * (0.3 + k);
        g.globalAlpha = 0.3 * (1 - k);
        g.beginPath();
        g.ellipse(s.x, s.y, r, r * 0.28, 0, 0, Math.PI * 2);
        g.stroke();
      }

      if (car) drawCar();

      // Steam, catching a little light
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < steam.length; i++) {
        const p = steam[i], k = p.age / p.life, r = p.r * (1 + k * 3.2);
        g.globalAlpha = 0.15 * Math.sin(Math.PI * Math.min(1, k * 1.6)) * (1 - k * 0.8);
        g.drawImage(SP.steam, p.x - r, p.y - r * 1.3, r * 2, r * 2.6);
      }

      drawRain(nI, hI);

      g.globalAlpha = 1;
      for (let i = 0; i < hooks.length; i++) hooks[i]();
    }

    // Rain: one path per depth layer, plus drops caught in the lamp, the neon and headlights
    const litA = [], litB = [], litBlue = [], litWhite = [];
    function drawRain(nI, hI) {
      const g = ctx;
      g.globalCompositeOperation = 'source-over';
      g.lineCap = 'round';
      litA.length = litB.length = litBlue.length = litWhite.length = 0;
      const cn = cone, sx = L.sign.cx, sy = L.sign.cy, srx = neon.tw * 0.75, sry = neon.fs * 1.8;
      const hx = L.hs.x0 + L.hs.w / 2, hy = L.hs.y0 + L.hs.h / 2, hrx = L.hs.w * 2.6, hry = L.hs.h * 0.7;
      let bx = 0, by = 0, brx = 0, bry = 0;
      if (car) {
        bx = car.x + car.dir * L.carL * 1.5; by = L.carY - L.carL * 0.1; brx = L.carL * 0.6; bry = L.carL * 0.22;
      }
      for (let layer = 0; layer < 3; layer++) {
        const P = RAIN[layer];
        g.beginPath();
        for (let i = 0; i < drops.length; i++) {
          const d = drops[i];
          if (d.layer !== layer) continue;
          g.moveTo(d.x, d.y);
          g.lineTo(d.x + d.len * SLANT, d.y - d.len);
          // Which light is this drop passing through?
          if (d.y > cn.top && d.y < cn.bot) {
            const hw = lerp(cn.hw0, cn.hw1, (d.y - cn.top) / (cn.bot - cn.top));
            const f = 1 - Math.abs(d.x - L.lamp.hx) / hw;
            if (f > 0.45) { litA.push(d); continue; }
            if (f > 0) { litB.push(d); continue; }
          }
          let ex = (d.x - sx) / srx, ey = (d.y - sy) / sry;
          if (ex * ex + ey * ey < 1) { litB.push(d); continue; }
          ex = (d.x - hx) / hrx; ey = (d.y - hy) / hry;
          if (ex * ex + ey * ey < 1) { litBlue.push(d); continue; }
          if (car) {
            ex = (d.x - bx) / brx; ey = (d.y - by) / bry;
            if (ex * ex + ey * ey < 1) litWhite.push(d);
          }
        }
        g.globalAlpha = P.a;
        g.lineWidth = P.lw;
        g.strokeStyle = rgba(C.rain, 1);
        g.stroke();
      }
      const lit = (arr, col, a, lw) => {
        if (!arr.length) return;
        g.beginPath();
        for (let i = 0; i < arr.length; i++) {
          const d = arr[i];
          g.moveTo(d.x, d.y);
          g.lineTo(d.x + d.len * SLANT, d.y - d.len);
        }
        g.globalAlpha = clamp(a, 0, 1);
        g.lineWidth = lw;
        g.strokeStyle = rgba(col, 1);
        g.stroke();
      };
      lit(litA, C.hot, 0.6, 1.2);
      lit(litB, C.amber, 0.38 * Math.max(0.5, nI), 1.1);
      lit(litBlue, C.blue, 0.35 * hI, 1);
      lit(litWhite, C.white, 0.5, 1.1);
    }

    let barFill = null;
    function makeBarFill() {
      const d = L.door, w = L.barWin;
      const dim = [26, 12, 4];
      const door = ctx.createLinearGradient(0, d.y, 0, d.y + d.h);
      door.addColorStop(0, rgba(mix(C.amber, dim, 0.45), 1));
      door.addColorStop(1, rgba(mix(C.amber, C.hot, 0.3), 1));
      const win = ctx.createLinearGradient(w.x, 0, w.x + w.w, 0);
      win.addColorStop(0, rgba(mix(C.amber, dim, 0.55), 1));
      win.addColorStop(0.45, rgba(mix(C.amber, C.hot, 0.12), 1));
      win.addColorStop(0.7, rgba(mix(C.amber, dim, 0.2), 1));
      win.addColorStop(1, rgba(mix(C.amber, dim, 0.6), 1));
      barFill = { door, win };
    }

    /* ---------- Loop control ---------- */
    const shouldRun = () => built && visible && !document.hidden && !reduced;
    function loop(now) {
      raf = 0;
      if (!shouldRun()) return;
      const gap = (now - last) / 1000;
      const dt = Math.min(0.05, Math.max(0, gap));
      last = now;
      // Under ~20 fps for a few seconds: drop to 1x pixels, which is most of the fill cost
      if (!lowRes && dpr > 1) {
        slow = gap > 0.05 && gap < 0.5 ? slow + 1 : Math.max(0, slow - 2);
        if (slow > 90) { lowRes = true; rebuild(); return; }
      }
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    }
    function start() {
      if (raf || !shouldRun()) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }
    // One composed frame: used for reduced motion, and right after a rebuild
    function still() {
      if (!built) return;
      wins.forEach((w) => { w.on = w.target; });
      neonFx.level = neonFx.letter = hotelFx.level = hotelFx.letter = 1;
      draw();
    }
    function rebuild() {
      if (!build()) return;
      makeBarFill();
      still();
      start();
    }

    /* ---------- Wiring: size, visibility, motion preference, fonts ---------- */
    rebuild();
    let rzTimer = 0, seenW = W, seenH = H;
    if ('ResizeObserver' in window) {
      new ResizeObserver(() => {
        const w = Math.round(sceneEl.clientWidth), h = Math.round(sceneEl.clientHeight);
        if (w === seenW && h === seenH) return;
        seenW = w; seenH = h;
        clearTimeout(rzTimer);
        rzTimer = setTimeout(rebuild, built ? 140 : 0);
      }).observe(sceneEl);
    } else {
      window.addEventListener('resize', () => { clearTimeout(rzTimer); rzTimer = setTimeout(rebuild, 200); });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        visible = entries[entries.length - 1].isIntersecting;
        if (visible) start(); else stop();
      }, { rootMargin: '80px 0px' }).observe(sceneEl);
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
    if (reduceMQ) {
      const onPref = (e) => { reduced = e.matches; if (reduced) { stop(); still(); } else start(); };
      if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', onPref);
      else if (reduceMQ.addListener) reduceMQ.addListener(onPref);
    }
    // The signs are set in the site fonts; redraw once they arrive
    if (document.fonts && document.fonts.load) {
      const f0 = F || fonts();
      const want = [`italic 500 40px ${f0.sign}`, `600 20px ${f0.label}`];
      const missing = want.filter((f) => { try { return !document.fonts.check(f, 'Noir Hours HOTEL'); } catch (e) { return false; } });
      if (missing.length) {
        Promise.all(missing.map((f) => document.fonts.load(f, 'Noir Hours HOTEL').catch(() => null)))
          .then(() => { if (built) rebuild(); });
      }
    }

    return {
      wake: start,
      onFrame: (fn) => hooks.push(fn),
    };
  }

  /* =====================================================================
     The sample player
     ===================================================================== */
  function makePlayer(city) {
    const el = root.querySelector('[data-noir-player]');
    if (!el) return;
    const q = (s) => el.querySelector(s);
    const list = q('[data-noir-tracks]');
    const items = list ? Array.prototype.filter.call(list.querySelectorAll('li[data-src]'), (li) => li.getAttribute('data-src').trim()) : [];
    const audio = q('[data-noir-audio]') || q('audio');
    const playBtn = q('[data-noir-play]');
    const seek = q('[data-noir-seek]');
    const titleEl = q('[data-noir-title]'), subEl = q('[data-noir-sub]');
    const curEl = q('[data-noir-cur]'), durEl = q('[data-noir-dur]');
    const artEl = q('[data-noir-art]'), live = q('[data-noir-live]');

    // No tracks yet (or broken markup): show the "samples drop here soon" state, the city keeps running
    if (!items.length || !audio || !audio.canPlayType || !playBtn || !seek) {
      el.setAttribute('data-state', 'empty');
      return;
    }
    el.setAttribute('data-state', 'ready');

    const parseDur = (v) => {
      if (!v) return 0;
      const p = String(v).split(':').map(Number);
      const s = p.length > 1 ? p[0] * 60 + p[1] : p[0];
      return isFinite(s) && s > 0 ? s : 0;
    };
    const span = (cls, text) => { const s = document.createElement('span'); s.className = cls; s.textContent = text; return s; };

    const tracks = items.map((li, i) => {
      const tr = {
        li, i,
        title: (li.getAttribute('data-title') || li.textContent || `Sample ${i + 1}`).trim(),
        src: li.getAttribute('data-src').trim(),
        art: (li.getAttribute('data-art') || '').trim(),
        dur: parseDur(li.getAttribute('data-duration')),
      };
      li.textContent = '';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'noir-track';
      const n = span('noir-track-n', String(i + 1).padStart(2, '0'));
      n.setAttribute('aria-hidden', 'true');
      tr.durEl = span('noir-track-dur', tr.dur ? fmt(tr.dur) : '');
      btn.append(n, span('noir-track-name', tr.title), tr.durEl);
      btn.addEventListener('click', () => {
        if (cur === i && !audio.paused) audio.pause();
        else select(i, true);
      });
      li.appendChild(btn);
      tr.btn = btn;
      return tr;
    });

    let cur = -1, dragging = false, pendingSeek = null, lastText = '';
    const sameOrigin = location.protocol !== 'file:' && tracks.every((tr) => {
      try { return new URL(tr.src, document.baseURI).origin === location.origin; } catch (e) { return false; }
    });

    /* ---------- Web Audio: created on the first press of play ---------- */
    let actx = null, graphTried = false;
    function ensureGraph() {
      if (actx) {
        if (actx.state === 'suspended') actx.resume().catch(() => {});
        return;
      }
      if (graphTried) return;
      graphTried = true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC || !sameOrigin) return;   // cross-origin audio would play silent through the graph
      let srcNode = null;
      try {
        if (navigator.audioSession) navigator.audioSession.type = 'playback';   // iOS: ignore the silent switch like normal media
        actx = new AC();
        const an = actx.createAnalyser();
        an.fftSize = 512;
        an.smoothingTimeConstant = 0.6;
        srcNode = actx.createMediaElementSource(audio);
        srcNode.connect(an);
        an.connect(actx.destination);
        sound.analyser = an;
        sound.bins = new Uint8Array(an.frequencyBinCount);
        if (actx.state === 'suspended') actx.resume().catch(() => {});
      } catch (e) {
        sound.analyser = null;
        // If the element was already routed into the graph, keep it audible
        try { if (srcNode && actx) srcNode.connect(actx.destination); } catch (e2) { /* plays on its own */ }
      }
    }

    /* ---------- Rendering ---------- */
    const duration = () => {
      const d = audio.duration;
      if (isFinite(d) && d > 0) return d;
      return (tracks[cur] && tracks[cur].dur) || 0;
    };
    function render() {
      const d = duration();
      const c = dragging && d ? (seek.value / 1000) * d : audio.currentTime || 0;
      const p = d ? clamp(c / d, 0, 1) : 0;
      if (!dragging) seek.value = String(Math.round(p * 1000));
      seek.style.setProperty('--p', (p * 100).toFixed(2) + '%');
      const text = fmt(c) + '|' + fmt(d);
      if (text !== lastText) {
        lastText = text;
        curEl.textContent = fmt(c);
        durEl.textContent = fmt(d);
        seek.setAttribute('aria-valuetext', d ? `${fmt(c)} of ${fmt(d)}` : fmt(c));
      }
    }
    function note(msg) {
      if (subEl) subEl.textContent = msg;
      if (live) live.textContent = msg;
    }
    function setArt(src) {
      if (!artEl) return;
      if (src) {
        artEl.onerror = () => { artEl.hidden = true; };
        artEl.src = src;
        artEl.hidden = false;
      } else {
        artEl.removeAttribute('src');
        artEl.hidden = true;
      }
    }
    function mediaMeta(tr) {
      if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: tr.title, artist: 'Noir Hours', album: 'Samples',
          artwork: tr.art ? [{ src: new URL(tr.art, document.baseURI).href }] : [],
        });
      } catch (e) { /* metadata is a nicety */ }
    }
    function select(i, autoplay) {
      const tr = tracks[i];
      if (!tr) return;
      if (cur !== i) {
        cur = i;
        pendingSeek = null;
        audio.src = tr.src;
        tr.li.classList.remove('is-missing');
        tracks.forEach((x) => x.btn.setAttribute('aria-current', x === tr ? 'true' : 'false'));
        if (titleEl) titleEl.textContent = tr.title;
        if (subEl) subEl.textContent = tracks.length > 1 ? `Sample ${i + 1} of ${tracks.length}` : 'Noir Hours sample';
        setArt(tr.art);
        lastText = '';
        render();
        mediaMeta(tr);
      }
      if (autoplay) play();
    }
    function play() {
      ensureGraph();
      const p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch((err) => {
          if (audio.error || (err && err.name === 'NotSupportedError')) note('This sample could not load.');
          else if (!err || err.name !== 'AbortError') note('Press play to start the sample.');
        });
      }
    }
    function setPlaying(on) {
      sound.playing = on;
      el.classList.toggle('is-playing', on);
      playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play');
      if (on && live && tracks[cur]) live.textContent = 'Playing ' + tracks[cur].title;
      try { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = on ? 'playing' : 'paused'; } catch (e) { /* optional */ }
      if (city) city.wake();
    }
    function seekTo(f) {
      const d = duration();
      f = clamp(f, 0, 1);
      if (d && audio.readyState > 0) audio.currentTime = f * d;
      else {
        // Not loaded yet: remember where to go and fetch the metadata
        pendingSeek = f;
        if (audio.readyState === 0) { audio.preload = 'metadata'; audio.load(); }
      }
      render();
    }

    /* ---------- Events ---------- */
    playBtn.addEventListener('click', () => {
      if (audio.paused) select(cur < 0 ? 0 : cur, true);
      else audio.pause();
    });
    seek.addEventListener('pointerdown', () => { dragging = true; });
    const endDrag = () => { if (dragging) { dragging = false; render(); } };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    seek.addEventListener('input', () => seekTo(seek.value / 1000));
    seek.addEventListener('keydown', (e) => {
      const d = duration();
      if (!d) return;
      const jumps = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 15, PageDown: -15 };
      const now = pendingSeek != null ? pendingSeek * d : audio.currentTime || 0;
      let next;
      if (e.key in jumps) next = now + jumps[e.key];
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = d - 0.5;
      else return;
      e.preventDefault();
      seek.value = String(Math.round(clamp(next / d, 0, 1) * 1000));
      seekTo(next / d);
    });

    audio.addEventListener('play', () => setPlaying(true));
    audio.addEventListener('playing', () => { if (actx && actx.state === 'suspended') actx.resume().catch(() => {}); });
    audio.addEventListener('pause', () => setPlaying(false));
    audio.addEventListener('timeupdate', render);
    const onMeta = () => {
      const tr = tracks[cur], d = audio.duration;
      if (tr && isFinite(d) && d > 0) { tr.dur = d; tr.durEl.textContent = fmt(d); }
      if (pendingSeek != null && isFinite(d) && d > 0) { audio.currentTime = pendingSeek * d; pendingSeek = null; }
      render();
    };
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', onMeta);
    audio.addEventListener('ended', () => {
      const next = tracks.find((tr) => tr.i > cur && !tr.li.classList.contains('is-missing'));
      if (next) select(next.i, true);
      else { audio.currentTime = 0; render(); }
    });
    audio.addEventListener('waiting', () => el.classList.add('is-loading'));
    ['playing', 'canplay', 'pause', 'error'].forEach((ev) => audio.addEventListener(ev, () => el.classList.remove('is-loading')));
    audio.addEventListener('error', () => {
      if (!audio.getAttribute('src') || !tracks[cur]) return;
      tracks[cur].li.classList.add('is-missing');
      note('This sample could not load.');
      setPlaying(false);
    });

    if ('mediaSession' in navigator) {
      const on = (a, fn) => { try { navigator.mediaSession.setActionHandler(a, fn); } catch (e) { /* unsupported action */ } };
      on('play', () => play());
      on('pause', () => audio.pause());
      on('previoustrack', () => select(Math.max(0, cur - 1), true));
      on('nexttrack', () => select(Math.min(tracks.length - 1, cur + 1), true));
    }

    // Smooth progress while the city is animating; timeupdate covers reduced motion
    if (city) city.onFrame(() => { if (sound.playing && !dragging) render(); });

    // Fill in durations the markup left out, once the player is near the viewport
    const probe = () => tracks.forEach((tr) => {
      if (tr.dur) return;
      const a = new Audio();
      a.preload = 'metadata';
      a.addEventListener('loadedmetadata', () => {
        if (isFinite(a.duration) && a.duration > 0) {
          tr.dur = a.duration;
          tr.durEl.textContent = fmt(a.duration);
          if (tr.i === cur) render();
        }
        a.removeAttribute('src');
        a.load();
      }, { once: true });
      a.addEventListener('error', () => tr.li.classList.add('is-missing'), { once: true });
      a.src = tr.src;
    });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { io.disconnect(); probe(); }
      }, { rootMargin: '600px 0px' });
      io.observe(el);
    } else {
      probe();
    }

    select(0, false);
  }

  let city = null;
  try { city = makeCity(); } catch (e) { city = null; /* the CSS backdrop stays; the player still works */ }
  makePlayer(city);
})();
