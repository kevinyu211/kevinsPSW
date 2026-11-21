/* Kevin Yu · design layer
   Five looks share one page of content. This file draws each look's hero graphic,
   adds the shared polish (intro curtain, counters, mask reveals, cursor light, marquee)
   and runs the design switcher. Everything here sits on top of main.js and is safe to remove. */
(() => {
  'use strict';

  const doc = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const G = window.gsap;
  const ST = window.ScrollTrigger;
  const motion = !!(G && ST) && !reduce;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const DESIGNS = [
    { id: 'editorial', name: 'Editorial', note: 'Magazine serif, ink lines' },
    { id: 'aurora', name: 'Aurora', note: 'Dark, glowing agent network' },
    { id: 'swiss', name: 'Swiss', note: 'Strict grid, one red accent' },
    { id: 'bento', name: 'Bento', note: 'Soft tiles, Apple-style' },
    { id: 'noir', name: 'Noir', note: 'Cinematic, gold on black' },
  ];
  const current = () => doc.dataset.design || 'editorial';
  const css = (name) => getComputedStyle(doc).getPropertyValue(name).trim();

  /* ---------------------------------------------------------------
     Hero art: one canvas behind the hero, redrawn per design
     --------------------------------------------------------------- */
  const hero = $('.hero');
  let art = null;
  if (hero) {
    art = document.createElement('div');
    art.className = 'hero-art';
    art.setAttribute('aria-hidden', 'true');
    art.innerHTML = '<canvas></canvas>';
    hero.prepend(art);
  }
  const canvas = art && $('canvas', art);
  const ctx = canvas && canvas.getContext('2d');
  let W = 0;
  let H = 0;
  let DPR = 1;
  const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
  let scene = null;
  let raf = 0;
  let heroVisible = true;

  const resize = () => {
    if (!canvas) return;
    const r = art.getBoundingClientRect();
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (scene && scene.init) scene.init();
  };

  const rand = (a, b) => a + Math.random() * (b - a);
  const hexA = (hex, a) => {
    const h = hex.replace('#', '');
    if (h.length < 6) return `rgba(128,128,128,${a})`;
    const n = parseInt(h.slice(0, 6), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  /* Editorial: slow topographic ink contours, like an engraved map */
  const editorial = () => {
    let t = 0;
    return {
      init() {},
      draw(dt) {
        t += dt * 0.00012;
        ctx.clearRect(0, 0, W, H);
        const ink = css('--ink') || '#222';
        const accent = css('--human') || '#9A573F';
        const cx = W * 0.86;
        const cy = H * 0.22;
        for (let i = 0; i < 26; i++) {
          const base = 30 + i * 22;
          ctx.beginPath();
          for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 90) {
            const n = Math.sin(a * 3 + t * 6 + i * 0.35) * 10 + Math.cos(a * 5 - t * 4 + i * 0.2) * 7;
            const r = base + n + Math.sin(t * 3 + i) * 4;
            const x = cx + Math.cos(a) * r * 1.35;
            const y = cy + Math.sin(a) * r;
            if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = i === 7 ? hexA(accent, 0.35) : hexA(ink, 0.07 + (i % 4 === 0 ? 0.05 : 0));
          ctx.lineWidth = i === 7 ? 1.4 : 1;
          ctx.stroke();
        }
      },
    };
  };

  /* Aurora: drifting light, plus a network of agents passing messages */
  const aurora = () => {
    let nodes = [];
    let edges = [];
    let pulses = [];
    let t = 0;
    return {
      init() {
        const count = Math.round(Math.min(46, Math.max(18, (W * H) / 26000)));
        nodes = Array.from({ length: count }, () => ({
          x: rand(W * 0.35, W), y: rand(0, H), vx: rand(-0.08, 0.08), vy: rand(-0.06, 0.06), r: rand(1.2, 2.6),
        }));
        edges = [];
        nodes.forEach((a, i) => {
          nodes.map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.y - b.y) }))
            .filter((o) => o.j !== i).sort((p, q) => p.d - q.d).slice(0, 2)
            .forEach((o) => edges.push([i, o.j]));
        });
        pulses = [];
      },
      draw(dt) {
        t += dt * 0.001;
        ctx.clearRect(0, 0, W, H);
        const c1 = css('--glow-1') || '#5EEAD4';
        const c2 = css('--glow-2') || '#A78BFA';
        const c3 = css('--glow-3') || '#38BDF8';
        const blobs = [
          [W * (0.7 + Math.sin(t * 0.21) * 0.08), H * (0.25 + Math.cos(t * 0.17) * 0.1), W * 0.42, c2, 0.28],
          [W * (0.9 + Math.cos(t * 0.13) * 0.06), H * (0.6 + Math.sin(t * 0.19) * 0.12), W * 0.36, c1, 0.2],
          [W * (0.45 + Math.sin(t * 0.11) * 0.1), H * (0.05 + Math.sin(t * 0.23) * 0.06), W * 0.3, c3, 0.16],
        ];
        ctx.globalCompositeOperation = 'lighter';
        blobs.forEach(([x, y, r, c, a]) => {
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, hexA(c, a));
          g.addColorStop(1, hexA(c, 0));
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, H);
        });
        ctx.globalCompositeOperation = 'source-over';
        nodes.forEach((n) => {
          n.x += n.vx * dt * 0.06; n.y += n.vy * dt * 0.06;
          if (n.x < W * 0.3 || n.x > W) n.vx *= -1;
          if (n.y < 0 || n.y > H) n.vy *= -1;
          const dm = Math.hypot(n.x - mouse.x, n.y - mouse.y);
          n.hot = dm < 160 ? 1 - dm / 160 : 0;
        });
        edges.forEach(([i, j]) => {
          const a = nodes[i]; const b = nodes[j];
          ctx.strokeStyle = hexA(c1, 0.09 + Math.max(a.hot, b.hot) * 0.35);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        });
        if (Math.random() < dt * 0.004 && edges.length) {
          const e = edges[(Math.random() * edges.length) | 0];
          pulses.push({ e, p: 0, c: Math.random() < 0.5 ? c1 : c2 });
        }
        pulses = pulses.filter((p) => p.p <= 1);
        pulses.forEach((p) => {
          p.p += dt * 0.0011;
          const a = nodes[p.e[0]]; const b = nodes[p.e[1]];
          const x = a.x + (b.x - a.x) * p.p; const y = a.y + (b.y - a.y) * p.p;
          const g = ctx.createRadialGradient(x, y, 0, x, y, 10);
          g.addColorStop(0, hexA(p.c, 0.95)); g.addColorStop(1, hexA(p.c, 0));
          ctx.fillStyle = g; ctx.fillRect(x - 10, y - 10, 20, 20);
        });
        nodes.forEach((n) => {
          ctx.fillStyle = hexA('#FFFFFF', 0.35 + n.hot * 0.6);
          ctx.beginPath(); ctx.arc(n.x, n.y, n.r + n.hot * 2, 0, Math.PI * 2); ctx.fill();
        });
      },
    };
  };

  /* Swiss: a dot matrix that swells under the cursor and with a slow wave */
  const swiss = () => {
    let t = 0;
    const gap = 26;
    return {
      init() {},
      draw(dt) {
        t += dt * 0.001;
        ctx.clearRect(0, 0, W, H);
        const ink = css('--ink') || '#111';
        const red = css('--human') || '#E63312';
        const x0 = W * 0.52;
        for (let x = x0; x < W + gap; x += gap) {
          for (let y = gap; y < H; y += gap) {
            const wave = Math.sin((x - x0) * 0.012 + y * 0.008 - t * 1.4) * 0.5 + 0.5;
            const dm = Math.hypot(x - mouse.x, y - mouse.y);
            const near = dm < 150 ? 1 - dm / 150 : 0;
            const fade = Math.min(1, (x - x0) / (W * 0.18));
            const r = (0.9 + wave * 1.6 + near * 5) * fade;
            const isRed = near > 0.35;
            ctx.fillStyle = isRed ? hexA(red, 0.9) : hexA(ink, 0.18 + wave * 0.16);
            if (r > 0.2) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
          }
        }
      },
    };
  };

  /* Bento: soft colored orbs drifting inside the hero tile */
  const bento = () => {
    let t = 0;
    return {
      init() {},
      draw(dt) {
        t += dt * 0.0004;
        ctx.clearRect(0, 0, W, H);
        const cols = [css('--orb-1') || '#FDBA74', css('--orb-2') || '#93C5FD', css('--orb-3') || '#C4B5FD', css('--orb-4') || '#86EFAC'];
        cols.forEach((c, i) => {
          const x = W * (0.62 + 0.26 * Math.sin(t * (1 + i * 0.3) + i * 1.7));
          const y = H * (0.42 + 0.34 * Math.cos(t * (0.8 + i * 0.25) + i));
          const r = Math.max(W, H) * (0.22 + i * 0.03);
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, hexA(c, 0.55)); g.addColorStop(1, hexA(c, 0));
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        });
      },
    };
  };

  /* Noir: a projector beam with floating dust and flickering grain */
  const noir = () => {
    let dust = [];
    let t = 0;
    return {
      init() {
        dust = Array.from({ length: 90 }, () => ({ x: rand(0, W), y: rand(0, H), s: rand(0.4, 1.8), v: rand(0.02, 0.09), o: rand(0.2, 0.8) }));
      },
      draw(dt) {
        t += dt * 0.001;
        ctx.clearRect(0, 0, W, H);
        const gold = css('--human') || '#D4A853';
        const flick = 0.9 + Math.sin(t * 23) * 0.03 + Math.sin(t * 7.1) * 0.04;
        const sx = W * 1.02; const sy = -H * 0.08;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(W, H) * 1.05);
        g.addColorStop(0, hexA(gold, 0.30 * flick));
        g.addColorStop(0.45, hexA(gold, 0.07 * flick));
        g.addColorStop(1, hexA(gold, 0));
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(W * 0.18, H * 1.05);
        ctx.lineTo(W * 0.78, H * 1.05);
        ctx.closePath();
        ctx.fillStyle = g; ctx.fill();
        ctx.restore();
        dust.forEach((d) => {
          d.y -= d.v * dt * 0.05; d.x += Math.sin(t + d.y * 0.01) * 0.08;
          if (d.y < -4) { d.y = H + 4; d.x = rand(0, W); }
          ctx.fillStyle = hexA('#FFF4DC', d.o * 0.5 * flick);
          ctx.beginPath(); ctx.arc(d.x, d.y, d.s, 0, Math.PI * 2); ctx.fill();
        });
        if (mouse.x > -999) {
          const sp = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 260);
          sp.addColorStop(0, hexA(gold, 0.12)); sp.addColorStop(1, hexA(gold, 0));
          ctx.fillStyle = sp; ctx.fillRect(0, 0, W, H);
        }
      },
    };
  };

  const SCENES = { editorial, aurora, swiss, bento, noir };

  let last = 0;
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (!heroVisible || document.hidden) { last = now; return; }
    const dt = Math.min(48, now - (last || now));
    last = now;
    mouse.x += (mouse.tx - mouse.x) * 0.12;
    mouse.y += (mouse.ty - mouse.y) * 0.12;
    if (scene) scene.draw(dt);
  };
  const startScene = () => {
    if (!canvas) return;
    const make = SCENES[current()] || editorial;
    const host = current() === 'bento' ? ($('.hero-top') || hero) : hero;
    if (art.parentNode !== host) host.prepend(art);
    scene = make();
    resize();
    if (reduce) { scene.draw(16); return; }
    if (!raf) raf = requestAnimationFrame(loop);
  };

  if (canvas) {
    let rt = 0;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 120); });
    hero.addEventListener('pointermove', (e) => {
      const r = art.getBoundingClientRect();
      mouse.tx = e.clientX - r.left; mouse.ty = e.clientY - r.top;
      if (mouse.x < -999) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
    });
    hero.addEventListener('pointerleave', () => { mouse.tx = -9999; mouse.ty = -9999; mouse.x = -9999; mouse.y = -9999; });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }, { threshold: 0 }).observe(hero);
    }
    startScene();
  }

  /* ---------------------------------------------------------------
     Intro curtain: a short wipe with the monogram, once per visit
     --------------------------------------------------------------- */
  (function curtain() {
    if (reduce || !G || !doc.classList.contains('has-curtain')) return;
    const c = document.createElement('div');
    c.className = 'curtain';
    c.setAttribute('aria-hidden', 'true');
    c.innerHTML = '<div class="curtain-in"><span class="curtain-mark">KY</span><span class="curtain-bar"><i></i></span></div>';
    document.body.appendChild(c);
    G.timeline({ onComplete: () => c.remove() })
      .fromTo('.curtain-mark', { yPercent: 110 }, { yPercent: 0, duration: 0.55, ease: 'expo.out' }, 0)
      .fromTo('.curtain-bar i', { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: 'power2.inOut' }, 0.1)
      .to('.curtain-in', { opacity: 0, y: -16, duration: 0.3, ease: 'power2.in' }, 0.72)
      .to(c, { clipPath: 'inset(0 0 100% 0)', duration: 0.8, ease: 'expo.inOut' }, 0.8)
      .call(() => doc.classList.remove('has-curtain'), null, 1.4);
  })();

  /* ---------------------------------------------------------------
     Tool marquee under the hero
     --------------------------------------------------------------- */
  (function marquee() {
    const facts = $('.hero .facts');
    if (!facts) return;
    const tools = ['Claude Code', 'Codex', 'Higgsfield', 'Notion', 'Next.js', 'TypeScript', 'Supabase', 'Anthropic API', 'GSAP', 'Vercel', 'ComfyUI', 'DGX Spark', 'Firecrawl', 'Cloudflare', 'CapCut', 'WeChat Mini Programs', 'SwiftUI'];
    const row = tools.map((t) => `<li>${t}</li>`).join('');
    const m = document.createElement('div');
    m.className = 'marquee';
    m.setAttribute('aria-label', 'Tools I build with');
    m.innerHTML = `<p class="marquee-label">Built with</p><div class="marquee-track"><ul>${row}</ul><ul aria-hidden="true">${row}</ul></div>`;
    facts.after(m);
  })();

  /* ---------------------------------------------------------------
     CSS-driven mocks play when they scroll into view
     --------------------------------------------------------------- */
  (function playOnView() {
    const els = $$('[data-play]');
    if (!('IntersectionObserver' in window) || reduce) { els.forEach((el) => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      e.target.classList.toggle('is-in', e.isIntersecting);
    }), { threshold: 0.35 });
    els.forEach((el) => io.observe(el));
  })();

  const printBtn = $('[data-print]');
  if (printBtn) printBtn.addEventListener('click', () => window.print());

  /* ---------------------------------------------------------------
     Counters: the hero facts count up the first time they show
     --------------------------------------------------------------- */
  (function counters() {
    if (!motion) return;
    $$('.fact-v').forEach((el) => {
      const raw = el.textContent.trim();
      const m = raw.match(/^(\d+)(.*)$/);
      if (!m) return;
      const end = +m[1];
      const tail = m[2];
      const o = { v: 0 };
      ST.create({
        trigger: el, start: 'top 92%', once: true,
        onEnter: () => G.to(o, { v: end, duration: 1.4, ease: 'power3.out', delay: 0.9, onUpdate: () => { el.textContent = `${Math.round(o.v)}${tail}`; } }),
      });
    });
  })();

  /* ---------------------------------------------------------------
     Mask reveals and gentle parallax on the work visuals
     --------------------------------------------------------------- */
  (function reveals() {
    if (!motion) return;
    $$('.work-visual').forEach((v) => {
      G.fromTo(v, { clipPath: 'inset(12% 6% 12% 6% round 18px)' }, {
        clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
        scrollTrigger: { trigger: v, start: 'top 95%', end: 'top 45%', scrub: 0.6 },
      });
      const inner = v.firstElementChild;
      if (inner) {
        G.fromTo(inner, { yPercent: 6 }, {
          yPercent: -4, ease: 'none',
          scrollTrigger: { trigger: v, start: 'top bottom', end: 'bottom top', scrub: 0.8 },
        });
      }
    });
    $$('.section-head .kicker').forEach((k) => {
      G.fromTo(k, { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: k, start: 'top 88%', once: true } });
    });
    $$('.stack-card, .learn-card, .loop-step').forEach((c, i) => {
      G.fromTo(c, { y: 34, opacity: 0, rotateX: 8, transformPerspective: 900 }, {
        y: 0, opacity: 1, rotateX: 0, duration: 1.1, ease: 'expo.out', delay: (i % 3) * 0.08,
        scrollTrigger: { trigger: c, start: 'top 90%', once: true },
        clearProps: 'transform',
      });
    });
  })();

  /* ---------------------------------------------------------------
     Cursor light: a soft glow that trails the pointer on cards
     --------------------------------------------------------------- */
  (function cursorLight() {
    if (!finePointer || reduce) return;
    const dot = document.createElement('div');
    dot.className = 'cursor-light';
    dot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(dot);
    let x = innerWidth / 2; let y = innerHeight / 2; let tx = x; let ty = y; let on = false;
    addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; if (!on) { on = true; dot.classList.add('is-on'); } }, { passive: true });
    document.addEventListener('pointerleave', () => { on = false; dot.classList.remove('is-on'); });
    document.addEventListener('pointerover', (e) => {
      dot.classList.toggle('is-link', !!e.target.closest('a, button, [data-spot]'));
    });
    const tick = () => {
      x += (tx - x) * 0.16; y += (ty - y) * 0.16;
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })();

  /* ---------------------------------------------------------------
     Tilt: cards lean a little toward the pointer
     --------------------------------------------------------------- */
  (function tilt() {
    if (!finePointer || reduce) return;
    $$('.work-card, .stack-card, .learn-card, .new-card').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        if (!doc.matches('[data-design="bento"], [data-design="aurora"]')) return;
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(1200px) rotateX(${(-py * 2.2).toFixed(2)}deg) rotateY(${(px * 2.2).toFixed(2)}deg) translateY(-2px)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
  })();

  /* ---------------------------------------------------------------
     Design switcher (preview only): pick one of five looks
     --------------------------------------------------------------- */
  (function switcher() {
    const dock = document.createElement('div');
    dock.className = 'design-dock';
    dock.setAttribute('role', 'group');
    dock.setAttribute('aria-label', 'Preview a design');
    dock.innerHTML = `<span class="dd-label">Design</span>${DESIGNS.map((d, i) => `<button type="button" data-d="${d.id}" title="${d.note}" aria-pressed="${d.id === current()}"><i class="dd-swatch dd-${d.id}"></i><span>${i + 1}. ${d.name}</span></button>`).join('')}`;
    document.body.appendChild(dock);
    const set = (id) => {
      const apply = () => {
        doc.dataset.design = id;
        try { localStorage.setItem('ky-design', id); } catch (e) { /* blocked */ }
        const u = new URL(location.href); u.searchParams.set('design', id); history.replaceState(null, '', u);
        $$('button', dock).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.d === id)));
        startScene();
        if (ST) requestAnimationFrame(() => ST.refresh());
      };
      if (!document.startViewTransition || reduce) { apply(); return; }
      doc.classList.add('is-switching');
      const vt = document.startViewTransition(apply);
      vt.finished.finally(() => doc.classList.remove('is-switching'));
    };
    dock.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-d]');
      if (b && b.dataset.d !== current()) set(b.dataset.d);
    });
    addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = +e.key;
      if (n >= 1 && n <= DESIGNS.length) set(DESIGNS[n - 1].id);
    });
  })();
})();
