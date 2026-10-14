/* Kevin Yu · site motion
   GSAP + ScrollTrigger + Flip for choreography, Lenis for smooth scrolling.
   Every animated element rests in its finished state in the HTML; motion only plays on top. */
(() => {
  'use strict';

  const doc = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const G = window.gsap;
  const ST = window.ScrollTrigger;
  const FlipP = window.Flip;
  const hasG = !!(G && ST);
  const motion = hasG && !reduce;
  const NS = 'http://www.w3.org/2000/svg';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const svgEl = (tag, attrs, parent) => {
    const el = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  };
  const whenVisible = (el, onIn, onOut, threshold = 0.25) => {
    if (!el || !('IntersectionObserver' in window)) { if (el) onIn(); return; }
    new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? onIn() : onOut && onOut()));
    }, { threshold }).observe(el);
  };
  const storage = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } },
  };

  if (hasG) {
    G.registerPlugin(ST);
    if (FlipP) G.registerPlugin(FlipP);
    G.config({ nullTargetWarn: false });
  }

  /* ---------- Theme switch with a circular reveal ---------- */
  const themeBtn = $('.theme-toggle');
  const isDark = () => (doc.dataset.theme
    ? doc.dataset.theme === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark';
      const apply = () => { doc.dataset.theme = next; storage.set('ky-theme', next); };
      if (!document.startViewTransition || reduce) { apply(); return; }
      const r = themeBtn.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      const t = document.startViewTransition(apply);
      t.ready.then(() => {
        doc.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
          { duration: 750, easing: 'cubic-bezier(.16,1,.3,1)', pseudoElement: '::view-transition-new(root)' },
        );
      }).catch(() => {});
    });
  }

  /* ---------- Smooth scroll ---------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.095, smoothWheel: true });
    if (hasG) {
      lenis.on('scroll', ST.update);
      G.ticker.add((t) => lenis.raf(t * 1000));
      G.ticker.lagSmoothing(0);
    } else {
      const loop = (t) => { lenis.raf(t); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  }

  /* ---------- Header: hide on scroll down, progress bar ---------- */
  const header = $('.site-header');
  const progress = $('.progress span');
  let lastY = 0;
  let menuOpen = false;
  const onScroll = (y) => {
    const max = doc.scrollHeight - innerHeight;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    header.classList.toggle('is-scrolled', y > 8);
    const delta = y - lastY;
    if (Math.abs(delta) > 6) {
      header.classList.toggle('is-hidden', delta > 0 && y > 360 && !menuOpen);
      lastY = y;
    }
  };
  if (lenis) lenis.on('scroll', (l) => onScroll(l.scroll));
  else addEventListener('scroll', () => onScroll(scrollY), { passive: true });
  onScroll(scrollY);

  /* ---------- Nav indicator follows the section in view ---------- */
  const navLinks = $$('.nav a');
  const indicator = $('.nav-indicator');
  let activeLink = null;
  const placeIndicator = (a) => {
    if (!indicator) return;
    if (!a) { indicator.style.opacity = '0'; return; }
    indicator.style.width = `${a.offsetWidth}px`;
    indicator.style.transform = `translateX(${a.offsetLeft}px)`;
    indicator.style.opacity = '1';
  };
  if ('IntersectionObserver' in window) {
    let activeId = null;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) activeId = e.target.id;
        else if (activeId === e.target.id) activeId = null;
      });
      activeLink = navLinks.find((a) => a.getAttribute('href') === `#${activeId}`) || null;
      navLinks.forEach((a) => a.classList.toggle('is-active', a === activeLink));
      placeIndicator(activeLink);
    }, { rootMargin: '-45% 0px -54% 0px' });
    navLinks.forEach((a) => {
      const s = document.getElementById(a.getAttribute('href').slice(1));
      if (s) io.observe(s);
      a.addEventListener('pointerenter', () => placeIndicator(a));
    });
    $('.nav')?.addEventListener('pointerleave', () => placeIndicator(activeLink));
  }

  /* ---------- Mobile menu ---------- */
  const menuBtn = $('.menu-btn');
  const sheet = $('#menu-sheet');
  const setMenu = (open) => {
    if (!sheet || open === menuOpen) return;
    menuOpen = open;
    doc.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    sheet.inert = !open;
    if (open) {
      header.classList.remove('is-hidden');
      if (lenis) lenis.stop();
      if (motion) {
        G.fromTo($$('.menu-links a, .menu-meta', sheet), { yPercent: 50, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.8, stagger: 0.05, ease: 'expo.out', delay: 0.05 });
      }
    } else if (lenis) {
      lenis.start();
    }
  };
  menuBtn?.addEventListener('click', () => setMenu(!menuOpen));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  /* ---------- In-page links ---------- */
  const goTo = (hash) => {
    const target = hash === '#top' ? 0 : document.querySelector(hash);
    if (target === null) return false;
    if (lenis) {
      lenis.scrollTo(target, { duration: 1.5, easing: (t) => 1 - Math.pow(1 - t, 4) });
    } else if (target === 0) {
      scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    } else {
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    }
    return true;
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const hash = a.getAttribute('href');
    if (hash.length < 2) return;
    setMenu(false);
    if (goTo(hash)) e.preventDefault();
  });

  /* ---------- Word splitting ---------- */
  const splitWords = (el) => {
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const s = document.createElement('span');
            s.className = 'split-word';
            s.textContent = part;
            frag.appendChild(s);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    };
    walk(el);
    return $$('.split-word', el);
  };

  /* =====================================================================
     Company OS diagram: Kevin → agents and tools → lanes
     ===================================================================== */
  const org = (() => {
    const svg = $('.org-svg');
    const fig = $('.org');
    const cap = $('.org-caption');
    const capName = $('.org-cap-name');
    const capText = $('.org-cap-text');
    if (!svg) return { build() {}, intro() {}, start() {} };

    const AGENTS = [
      { name: 'Codex', role: 'Second coding agent on deep product work for Hirvo.', to: ['hirvo'] },
      { name: 'Claude Code', role: 'Deep repo work: the Hirvo rewrite, Bookflow hardening, sites and 3D builds.', to: ['hirvo', 'uhome', 'hack', 'pindou', 'kdp'] },
      { name: 'Big Three', role: 'Strategy agents behind story-IP calls and the build-in-public plan.', to: ['x', 'kdp'] },
      { name: 'Sadie', role: 'Sets story-IP direction for the book line.', to: ['kdp'] },
      { name: 'Cindy', role: 'Finds niches and sorts keywords into keep and skip.', to: ['kdp'] },
      { name: 'Tim', role: 'Pulls reverse-ASIN and longtail keywords from SellerSprite.', to: ['kdp'] },
      { name: 'Jennifer', role: 'Makes art packs and A+ content.', to: ['kdp'] },
      { name: 'Alex', role: 'Reads Amazon Ads campaigns and recommends hold or change.', to: ['kdp'] },
      { name: 'Bob', role: 'Builds and maintains the Bookflow tooling.', to: ['kdp'] },
      { name: 'Video + music', role: 'Reference, Claude shot list, edit, Drive. Plus AI-assisted music production.', to: ['aigc', 'yae', 'noir'] },
      { name: 'Higgsfield', role: 'Soul 2.0 looks trained for realistic AI influencers.', to: ['influ'] },
    ];
    const LANES = [
      { id: 'hirvo', name: 'Hirvo', what: 'Visa-aware job search.' },
      { id: 'uhome', name: 'UHOME', what: 'Student apartment site and 3D renders.' },
      { id: 'hack', name: 'Hackathons', what: 'Healthcare AI demos in Hong Kong and Shanghai.' },
      { id: 'pindou', name: '拼豆 store', what: 'Social and a WeChat mini program for a Shanghai store.' },
      { id: 'x', name: 'X · in public', what: 'Shipping every lane in public.' },
      { id: 'kdp', name: 'Bookflow · KDP', what: 'Nine books live on Amazon.' },
      { id: 'aigc', name: 'AIGC video', what: 'Cinematic AI ads for brands.' },
      { id: 'yae', name: 'YouAreExtinct', what: 'Story AI films on YouTube.' },
      { id: 'noir', name: 'Noir Hours', what: 'Noir jazz for focused work.' },
      { id: 'influ', name: 'AI influencers', what: 'Realistic AI talent across platforms.' },
    ];

    let L = null;
    let compact = null;
    let nodes = { agents: [], lanes: {}, kevin: null };
    let edgesK = [];
    let edgesA = [];
    let pulseLayer = null;
    let built = false;
    let running = false;
    let inView = true;
    let paused = false;
    let idx = 1;
    let current = { type: 'agent', i: 1 };
    let laneCall = null;
    let resumeT = null;

    const layoutFor = (isCompact) => (isCompact
      ? { W: 400, kx: 27, kr: 22, ax: 146, aw: 104, lx: 318, lw: 122, ph: 30, fs: 12.5 }
      : { W: 520, kx: 40, kr: 27, ax: 198, aw: 112, lx: 434, lw: 144, ph: 30, fs: 12.5 });

    const curve = (x1, y1, x2, y2) => {
      const dx = (x2 - x1) * 0.55;
      return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
    };

    function build(force) {
      const isCompact = fig.clientWidth < 470;
      if (built && !force && isCompact === compact) return false;
      compact = isCompact;
      L = layoutFor(compact);
      svg.setAttribute('viewBox', `0 0 ${L.W} 600`);
      $$(':scope > g', svg).forEach((g) => g.remove());

      const gHead = svgEl('g', null, svg);
      const gEdges = svgEl('g', null, svg);
      const gFlow = svgEl('g', null, svg);
      const gNodes = svgEl('g', null, svg);
      pulseLayer = svgEl('g', null, svg);

      const top = 70;
      const bot = 572;
      const ky = (top + bot) / 2;
      const ay = (i) => top + (i * (bot - top)) / (AGENTS.length - 1);
      const ly = (j) => top + (j * (bot - top)) / (LANES.length - 1);
      const laneIndex = {};
      LANES.forEach((l, j) => { laneIndex[l.id] = j; });

      [['Human', L.kx], ['Agents + tools', L.ax], ['Lanes', L.lx]].forEach(([t, x]) => {
        svgEl('text', { x, y: 30, 'text-anchor': 'middle', class: 'org-colhead' }, gHead).textContent = t;
      });

      edgesK = [];
      edgesA = [];
      nodes = { agents: [], lanes: {}, kevin: null };

      AGENTS.forEach((a, i) => {
        const y = ay(i);
        const d = curve(L.kx + L.kr, ky, L.ax - L.aw / 2, y);
        edgesK.push(svgEl('path', { d, class: 'org-edge from-kevin' }, gEdges));
        svgEl('path', { d, class: 'org-flow' }, gFlow);
        const map = {};
        a.to.forEach((id) => {
          const d2 = curve(L.ax + L.aw / 2, y, L.lx - L.lw / 2, ly(laneIndex[id]));
          map[id] = svgEl('path', { d: d2, class: 'org-edge' }, gEdges);
          svgEl('path', { d: d2, class: 'org-flow' }, gFlow);
        });
        edgesA.push(map);
      });

      const pill = (cx, cy, w, label, cls) => {
        const outer = svgEl('g', { transform: `translate(${cx},${cy})` }, gNodes);
        const g = svgEl('g', { class: `org-node ${cls}` }, outer);
        svgEl('rect', { x: -w / 2, y: -L.ph / 2, width: w, height: L.ph, rx: L.ph / 2 }, g);
        svgEl('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', y: 0.5, style: `font-size:${L.fs}px` }, g).textContent = label;
        return g;
      };
      AGENTS.forEach((a, i) => {
        const g = pill(L.ax, ay(i), L.aw, a.name, 'org-agent');
        g.addEventListener('pointerenter', (e) => hold(e, () => focusAgent(i)));
        g.addEventListener('click', (e) => hold(e, () => focusAgent(i)));
        nodes.agents.push(g);
      });
      LANES.forEach((l, j) => {
        const g = pill(L.lx, ly(j), L.lw, l.name, 'org-lane');
        g.addEventListener('pointerenter', (e) => hold(e, () => focusLane(l.id)));
        g.addEventListener('click', (e) => hold(e, () => focusLane(l.id)));
        nodes.lanes[l.id] = g;
      });
      const kOuter = svgEl('g', { transform: `translate(${L.kx},${ky})` }, gNodes);
      const k = svgEl('g', { class: 'org-kevin' }, kOuter);
      svgEl('circle', { r: L.kr, class: 'halo' }, k);
      svgEl('circle', { r: L.kr, class: 'core' }, k);
      svgEl('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', y: 0.5 }, k).textContent = 'Kevin';
      nodes.kevin = k;

      built = true;
      return true;
    }

    const hold = (e, fn) => {
      paused = true;
      clearTimeout(resumeT);
      if (e.pointerType && e.pointerType !== 'mouse') resumeT = setTimeout(() => { paused = false; }, 6000);
      fn();
    };
    svg.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') { clearTimeout(resumeT); paused = false; }
    });

    const clearHot = () => {
      if (laneCall) { laneCall.kill(); laneCall = null; }
      $$('.is-hot', svg).forEach((el) => el.classList.remove('is-hot'));
      svg.classList.add('is-focused');
    };

    const setCaption = (name, text, isLane) => {
      const apply = () => {
        capName.textContent = name;
        capText.textContent = text;
        cap.classList.toggle('is-lane', !!isLane);
      };
      if (!motion) { apply(); return; }
      G.killTweensOf([capName, capText]);
      G.to([capName, capText], {
        opacity: 0, y: -6, duration: 0.18, ease: 'power2.in',
        onComplete: () => {
          apply();
          G.fromTo([capName, capText], { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: 'expo.out' });
        },
      });
    };

    const pulse = (path, human, delay) => {
      if (!motion || !path) return;
      const len = path.getTotalLength();
      const dot = svgEl('circle', { r: human ? 4.2 : 3.4, class: `org-pulse${human ? ' human' : ''}`, opacity: 0 }, pulseLayer);
      const o = { t: 0 };
      G.to(o, {
        t: 1, duration: human ? 0.6 : 0.75, delay, ease: 'power2.inOut',
        onStart: () => dot.setAttribute('opacity', '1'),
        onUpdate: () => {
          const p = path.getPointAtLength(o.t * len);
          dot.setAttribute('cx', p.x);
          dot.setAttribute('cy', p.y);
        },
        onComplete: () => G.to(dot, { attr: { r: 10, opacity: 0 }, duration: 0.5, ease: 'power2.out', onComplete: () => dot.remove() }),
      });
    };

    function focusAgent(i) {
      current = { type: 'agent', i };
      const a = AGENTS[i];
      clearHot();
      nodes.agents[i].classList.add('is-hot');
      edgesK[i].classList.add('is-hot');
      const ids = Object.keys(edgesA[i]);
      ids.forEach((id) => edgesA[i][id].classList.add('is-hot'));
      const lightLanes = () => ids.forEach((id) => nodes.lanes[id].classList.add('is-hot'));
      if (motion) laneCall = G.delayedCall(1.0, lightLanes); else lightLanes();
      setCaption(a.name, a.role, false);
      pulse(edgesK[i], true, 0);
      ids.forEach((id, n) => pulse(edgesA[i][id], false, 0.55 + n * 0.07));
    }

    function focusLane(id) {
      current = { type: 'lane', id };
      const lane = LANES.find((l) => l.id === id);
      clearHot();
      nodes.lanes[id].classList.add('is-hot');
      const who = [];
      AGENTS.forEach((a, i) => {
        if (!edgesA[i][id]) return;
        edgesA[i][id].classList.add('is-hot');
        nodes.agents[i].classList.add('is-hot');
        who.push(a.name);
        pulse(edgesA[i][id], false, who.length * 0.05);
      });
      const list = who.length > 1 ? `${who.slice(0, -1).join(', ')} and ${who[who.length - 1]}` : who[0];
      setCaption(lane.name, `${lane.what} Worked on by ${list}.`, true);
    }

    const tick = () => {
      if (paused || !inView || document.hidden) return;
      focusAgent(idx);
      idx = (idx + 1) % AGENTS.length;
    };

    function start() {
      build();
      if (running) return;
      running = true;
      focusAgent(1);
      idx = 2;
      if (!reduce) setInterval(tick, 3000);
    }

    function intro() {
      build();
      if (!motion) { start(); return; }
      const edges = $$('.org-edge', svg);
      const flows = $$('.org-flow', svg);
      const agentEdges = edgesA.flatMap((m) => Object.values(m));
      edges.forEach((p) => {
        const l = p.getTotalLength();
        p.style.strokeDasharray = `${l}`;
        p.style.strokeDashoffset = `${l}`;
      });
      G.set(flows, { opacity: 0 });
      G.timeline({
        onComplete: () => {
          edges.forEach((p) => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; });
          start();
        },
      })
        .fromTo(nodes.kevin, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.9, ease: 'back.out(2)' }, 0)
        .to(edgesK, { strokeDashoffset: 0, duration: 0.9, stagger: 0.035, ease: 'power2.inOut' }, 0.15)
        .fromTo(nodes.agents, { opacity: 0, x: -12 }, { opacity: 1, x: 0, duration: 0.7, stagger: 0.04, ease: 'expo.out' }, 0.35)
        .to(agentEdges, { strokeDashoffset: 0, duration: 0.9, stagger: 0.02, ease: 'power2.inOut' }, 0.65)
        .fromTo(Object.values(nodes.lanes), { opacity: 0, x: -12 }, { opacity: 1, x: 0, duration: 0.7, stagger: 0.045, ease: 'expo.out' }, 0.9)
        .to(flows, { opacity: 0.5, duration: 1.2, ease: 'power1.out' }, 1.5);
    }

    whenVisible(svg, () => { inView = true; }, () => { inView = false; }, 0.15);
    let rT = null;
    addEventListener('resize', () => {
      clearTimeout(rT);
      rT = setTimeout(() => {
        if (!running) return;
        if (build()) {
          if (current.type === 'lane') focusLane(current.id); else focusAgent(current.i);
        }
      }, 180);
    });

    build();
    return { build, intro, start };
  })();

  /* ---------- Hero entrance ---------- */
  (function heroIntro() {
    let started = false;
    const go = () => {
      if (started) return;
      started = true;
      doc.classList.remove('intro-pending');
      if (!motion) { org.start(); return; }
      G.timeline({ defaults: { ease: 'expo.out' } })
        .fromTo('.hero .eyebrow', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9 }, 0)
        .fromTo('.hero-title .line-in', { yPercent: 115, rotate: 3, transformOrigin: '0% 100%' },
          { yPercent: 0, rotate: 0, duration: 1.3, stagger: 0.1 }, 0.08)
        .fromTo('.hero .lede, .hero .cta-row, .hero .legend', { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 1, stagger: 0.08 }, 0.5)
        .fromTo('.org', { y: 40, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 1.3, clearProps: 'transform' }, 0.2)
        .add(() => org.intro(), 0.5)
        .fromTo('.facts li', { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.07 }, 0.8);
    };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(go);
      setTimeout(go, 900);
    } else {
      go();
    }
  })();

  /* =====================================================================
     How it runs: five steps, pinned on large screens
     ===================================================================== */
  const buildStep = [
    (v) => {
      const kp = $('.idea-killed p', v);
      return G.timeline({ paused: true, defaults: { ease: 'expo.out' } })
        .fromTo($('.v-q', v), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6 }, 0.1)
        .fromTo($$('.idea', v), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.12 }, 0.25)
        .fromTo($('.stamp-kill', v), { opacity: 0, scale: 2.2, rotate: -24 }, { opacity: 1, scale: 1, rotate: -8, duration: 0.5, ease: 'back.out(2.4)' }, 1.0)
        .fromTo(kp, { '--strike': 0 }, { '--strike': 1, duration: 0.45, ease: 'power2.inOut' }, 1.1)
        .fromTo($('.stamp-build', v), { opacity: 0, scale: 2.2, rotate: 16 }, { opacity: 1, scale: 1, rotate: -5, duration: 0.5, ease: 'back.out(2.4)' }, 1.6);
    },
    (v) => G.timeline({ paused: true })
      .fromTo($$('.cl', v), { clipPath: 'inset(0 100% 0 0)' },
        { clipPath: 'inset(0 0% 0 0)', duration: 0.4, ease: 'steps(16)', stagger: 0.15 }, 0.1),
    (v) => {
      const sts = $$('.st', v);
      const set = (el, s) => { el.dataset.s = s; el.textContent = s; };
      const tl = G.timeline({ paused: true })
        .call(() => sts.forEach((s) => set(s, 'queued')), null, 0.001)
        .fromTo($('.crew-kevin', v), { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(2)' }, 0)
        .fromTo($$('.crew li', v), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: 'expo.out' }, 0.1);
      sts.forEach((s, k) => {
        tl.call(() => set(s, 'running'), null, 0.55 + k * 0.15);
        tl.call(() => set(s, 'done'), null, 1.35 + k * 0.18 + (k % 3) * 0.12);
      });
      return tl;
    },
    (v) => {
      const gates = $$('.gate', v);
      const tl = G.timeline({ paused: true })
        .call(() => gates.forEach((g) => { g.classList.remove('is-ok'); $('.gate-state', g).textContent = 'Waiting for Kevin'; }), null, 0.001)
        .fromTo(gates, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.1, ease: 'expo.out' }, 0);
      gates.forEach((g, k) => tl.call(() => {
        g.classList.add('is-ok');
        $('.gate-state', g).textContent = 'Approved by Kevin';
      }, null, 1.1 + k * 0.6));
      return tl;
    },
    (v) => {
      const ch = $$('.channels li', v);
      const tl = G.timeline({ paused: true })
        .call(() => ch.forEach((c) => c.classList.remove('is-on')), null, 0.001)
        .fromTo($$('.log p', v), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.4, ease: 'steps(14)', stagger: 0.35 }, 0.1)
        .fromTo(ch, { opacity: 0.4, x: -8 }, { opacity: 1, x: 0, duration: 0.5, stagger: 0.12, ease: 'expo.out' }, 1.1);
      ch.forEach((c, k) => tl.call(() => c.classList.add('is-on'), null, 1.25 + k * 0.12));
      return tl;
    },
  ];

  (function how() {
    const section = $('#how');
    if (!section || !motion) return;
    const steps = $$('.how-step', section);
    const stage = $('.how-stage', section);
    const pin = $('.how-pin', section);
    const rail = $('.how-rail span', section);
    const visuals = steps.map((s) => $('.how-visual', s));
    const players = visuals.map((v, i) => {
      let tl = null;
      return {
        play() { if (!tl) tl = buildStep[i](v); tl.restart(); },
        final() { if (tl) tl.progress(1).pause(); },
      };
    });
    const n = steps.length;
    const mm = G.matchMedia();

    mm.add('(min-width: 1021px) and (min-height: 700px)', () => {
      section.classList.add('is-pinned');
      visuals.forEach((v) => stage.appendChild(v));
      let currentStep = -1;
      let entered = false;
      const show = (i, animate) => {
        if (i === currentStep) return;
        const prev = currentStep;
        currentStep = i;
        steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
        if (prev >= 0) {
          const pv = visuals[prev];
          G.killTweensOf(pv);
          G.to(pv, { opacity: 0, y: -28, filter: 'blur(6px)', duration: 0.4, ease: 'power2.in', onComplete: () => pv.classList.remove('is-current') });
        }
        const v = visuals[i];
        G.killTweensOf(v);
        v.classList.add('is-current');
        if (animate) {
          G.fromTo(v, { opacity: 0, y: 40, filter: 'blur(8px)' },
            { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'expo.out', delay: prev >= 0 ? 0.18 : 0 });
        } else {
          G.set(v, { opacity: 1, y: 0, filter: 'none' });
        }
        if (entered) players[i].play();
      };
      G.set(visuals, { opacity: 0 });
      show(0, false);

      const st = ST.create({
        trigger: pin,
        start: 'top top',
        end: () => `+=${Math.round(innerHeight * 0.8 * n)}`,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          show(Math.min(n - 1, Math.floor(self.progress * n)), true);
          if (rail) rail.style.transform = `scaleY(${self.progress})`;
        },
      });
      ST.create({
        trigger: section,
        start: 'top 55%',
        onEnter: () => { if (!entered) { entered = true; players[currentStep].play(); } },
      });

      const handlers = steps.map((s, k) => {
        const h = () => {
          const y = st.start + ((k + 0.5) / n) * (st.end - st.start);
          if (lenis) lenis.scrollTo(y, { duration: 1.2 }); else scrollTo({ top: y, behavior: 'smooth' });
        };
        s.addEventListener('click', h);
        return h;
      });

      return () => {
        section.classList.remove('is-pinned');
        steps.forEach((s, k) => {
          s.appendChild(visuals[k]);
          s.removeEventListener('click', handlers[k]);
          s.classList.toggle('is-active', k === 0);
        });
        visuals.forEach((v) => v.classList.remove('is-current'));
        G.set(visuals, { clearProps: 'all' });
        players.forEach((p) => p.final());
        if (rail) rail.style.transform = '';
      };
    });

    mm.add('(max-width: 1020px), (max-height: 699px)', () => {
      visuals.forEach((v, i) => ST.create({ trigger: v, start: 'top 82%', once: true, onEnter: () => players[i].play() }));
    });
  })();

  /* ---------- Scroll reveals (from a visible resting state) ---------- */
  if (motion) {
    $$('[data-split]').forEach((h) => {
      G.fromTo(splitWords(h), { yPercent: 45, opacity: 0.15 },
        { yPercent: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.04, scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
    });
    $$('[data-reveal]').forEach((el) => {
      G.fromTo(el, { y: 56, opacity: 0.4 },
        { y: 0, opacity: 1, duration: 1.3, ease: 'expo.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
    });
    $$('[data-reveal-group]').forEach((g) => {
      G.fromTo(g.children, { y: 36, opacity: 0.4 },
        { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.06, clearProps: 'transform,opacity', scrollTrigger: { trigger: g, start: 'top 88%', once: true } });
    });
    $$('.section-sub').forEach((el) => {
      G.fromTo(el, { y: 20, opacity: 0.4 }, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
    });

    const stmt = $('[data-words]');
    if (stmt) {
      G.fromTo(splitWords(stmt), { opacity: 0.16 },
        { opacity: 1, ease: 'none', stagger: 0.12, scrollTrigger: { trigger: stmt, start: 'top 80%', end: 'bottom 45%', scrub: 0.6 } });
    }
  }

  /* ---------- Small loops that run only while visible ---------- */
  const loopWhileVisible = (el, create, threshold = 0.3) => {
    if (!el || !motion) return;
    let tl = null;
    whenVisible(el, () => { if (!tl) tl = create(el); tl.play(); }, () => { if (tl) tl.pause(); }, threshold);
  };
  const sequence = (root, items, durations) => {
    if (!root || !items.length || reduce) return;
    let i = -1;
    let t = null;
    const step = () => {
      items.forEach((el) => el.classList.remove('is-on'));
      i = (i + 1) % items.length;
      items[i].classList.add('is-on');
      t = setTimeout(step, Array.isArray(durations) ? durations[i] : durations);
    };
    whenVisible(root, () => { if (!t) step(); }, () => {
      clearTimeout(t);
      t = null;
      items.forEach((el) => el.classList.remove('is-on'));
    }, 0.35);
  };

  // Hirvo: a draft invents facts, the check flags them, the final line stays true to the source.
  loopWhileVisible($('[data-anim="hirvo"]'), (root) => {
    const draftRow = $('.rw-draft', root);
    const checkRow = $('.rw-check', root);
    const finalRow = $('.rw-final', root);
    const marks = $$('mark.fab', root);
    return G.timeline({ repeat: -1, repeatDelay: 0.3, defaults: { ease: 'expo.out' } })
      .call(() => marks.forEach((m) => m.classList.remove('is-flagged')), null, 0.02)
      .set(marks, { '--strike': 0 }, 0.02)
      .set([draftRow, checkRow, finalRow], { opacity: 0, y: 10 }, 0.02)
      .to(draftRow, { opacity: 1, y: 0, duration: 0.5 }, 0.3)
      .fromTo($('p', draftRow), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.5, ease: 'steps(34)' }, 0.35)
      .call(() => marks.forEach((m) => m.classList.add('is-flagged')), null, 2.1)
      .to(checkRow, { opacity: 1, y: 0, duration: 0.5 }, 2.3)
      .fromTo($$('.flag', root), { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.5, stagger: 0.18 }, 2.35)
      .to(marks, { '--strike': 1, duration: 0.5, stagger: 0.15, ease: 'power2.inOut' }, 2.9)
      .to(finalRow, { opacity: 1, y: 0, duration: 0.7 }, 3.5)
      .fromTo($('.ok-dot', root), { scale: 0 }, { scale: 1, duration: 0.6, ease: 'back.out(3)' }, 3.6)
      .to([draftRow, checkRow, finalRow], { opacity: 0, y: -6, duration: 0.5, ease: 'power2.in', stagger: 0.05 }, 7.6);
  });

  // KDP shelf: browse the spines, pull out the real cover wherever Amazon has one.
  (function shelf() {
    const root = $('[data-anim="shelf"]');
    if (!root) return;
    const books = $$('.book', root);
    const cur = $('.shelf-current', root);
    const pop = $('.shelf-cover', root);
    const popImg = pop && $('img', pop);
    const covers = new Map();
    books.forEach((b) => {
      if (!b.dataset.asin) return;
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      // Amazon answers a missing cover with a 1px placeholder, so only keep real images.
      img.onload = () => { if (img.naturalWidth > 60) covers.set(b, img.src); };
      img.src = `https://images-na.ssl-images-amazon.com/images/P/${b.dataset.asin}.01.LZZZZZZZ.jpg`;
    });
    const hideCover = () => { if (pop) pop.classList.remove('is-on'); };
    const show = (b) => {
      cur.textContent = `${b.textContent.trim()} · ${b.dataset.note}${b.dataset.asin ? ' ↗' : ''}`;
      const src = covers.get(b);
      if (!pop || !src) { hideCover(); return; }
      if (popImg.src !== src) popImg.src = src;
      const r = root.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      const w = pop.offsetWidth || 150;
      const x = Math.max(0, Math.min(r.width - w, br.left - r.left + br.width / 2 - w / 2));
      pop.style.setProperty('--cx', `${Math.round(x)}px`);
      pop.classList.add('is-on');
    };
    let hovering = false;
    books.forEach((b) => {
      b.addEventListener('pointerenter', () => { hovering = true; books.forEach((x) => x.classList.remove('is-lift')); show(b); });
      b.addEventListener('pointerleave', () => { hovering = false; hideCover(); });
      b.addEventListener('focusin', () => { books.forEach((x) => x.classList.remove('is-lift')); show(b); });
      b.addEventListener('focusout', hideCover);
    });
    if (!motion) return;
    G.fromTo(books, { y: 44, opacity: 0.5 }, {
      y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.05, clearProps: 'transform,opacity',
      scrollTrigger: { trigger: root, start: 'top 88%', once: true },
    });
    let i = 0;
    let t = null;
    const step = () => {
      let wait = 1700;
      if (!hovering && !root.contains(document.activeElement)) {
        books.forEach((x) => x.classList.remove('is-lift'));
        const b = books[i % books.length];
        b.classList.add('is-lift');
        show(b);
        if (covers.has(b)) wait = 2800;
        i += 1;
      }
      t = setTimeout(step, wait);
    };
    whenVisible(root, () => { if (!t) step(); }, () => {
      clearTimeout(t);
      t = null;
      hideCover();
      books.forEach((x) => x.classList.remove('is-lift'));
    }, 0.4);
  })();

  $$('.flow').forEach((f) => sequence(f, $$('li', f), 950));
  sequence($('[data-anim="rx"]'), $$('[data-anim="rx"] .rx-step'), [1500, 1700, 2600]);

  // YouAreExtinct: real YouTube thumbnails, played inline on click.
  (function player() {
    const root = $('[data-player]');
    if (!root) return;
    const yt = $('.yt', root);
    const link = $('.yt-link', yt);
    const thumb = $('.yt-thumb', yt);
    const label = $('.yt-title', yt);
    const items = $$('.pl-item', root);
    let warmed = false;
    const warm = () => {
      if (warmed) return;
      warmed = true;
      ['https://www.youtube-nocookie.com', 'https://www.google.com'].forEach((href) => {
        const l = document.createElement('link');
        l.rel = 'preconnect';
        l.href = href;
        document.head.appendChild(l);
      });
    };
    // Upgrade to the HD thumbnail when the video has one; YouTube serves a 120px stand-in when it doesn't.
    const upgradeThumb = (id) => {
      const hd = new Image();
      hd.referrerPolicy = 'no-referrer';
      hd.onload = () => { if (hd.naturalWidth > 120 && yt.dataset.yt === id) thumb.src = hd.src; };
      hd.src = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
    };
    const play = () => {
      const f = document.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${yt.dataset.yt}?autoplay=1&rel=0&playsinline=1`;
      f.title = `${label.textContent} · YouAreExtinct`;
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      $$('iframe', yt).forEach((old) => old.remove());
      link.hidden = true;
      yt.appendChild(f);
      f.focus();
    };
    const select = (btn) => {
      const id = btn.dataset.yt;
      items.forEach((b) => {
        const on = b === btn;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
      });
      const playing = link.hidden;
      if (yt.dataset.yt === id) { if (!playing) play(); return; }
      yt.dataset.yt = id;
      link.href = `https://youtu.be/${id}`;
      link.setAttribute('aria-label', `Play ${btn.dataset.title}`);
      label.textContent = btn.dataset.title;
      if (playing) { play(); return; }
      thumb.classList.add('is-swapping');
      setTimeout(() => {
        thumb.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
        upgradeThumb(id);
        thumb.classList.remove('is-swapping');
      }, motion ? 240 : 0);
    };
    yt.addEventListener('pointerenter', warm);
    link.addEventListener('focus', warm);
    link.addEventListener('click', (e) => { e.preventDefault(); warm(); play(); });
    items.forEach((b) => {
      b.addEventListener('pointerenter', warm);
      b.addEventListener('click', () => { warm(); select(b); });
    });
    upgradeThumb(yt.dataset.yt);
  })();

  // UHOME: an isometric block that goes from wireframe model to lit render.
  (function iso() {
    const root = $('[data-anim="iso"]');
    const svg = root && $('.iso-svg', root);
    if (!svg) return;
    const tag = $('.iso-tag b', root);
    const s = 13;
    const c = Math.cos(Math.PI / 6);
    const W = 7;
    const D = 3;
    const Hh = 5;
    const ox = 160 - ((W - D) / 2) * c * s;
    const oy = 108 - (((W + D) / 2) * 0.5 * s - (Hh / 2) * s);
    const pt = (x, y, z) => `${((x - y) * c * s + ox).toFixed(1)},${((x + y) * 0.5 * s - z * s + oy).toFixed(1)}`;
    const poly = (pts, cls, parent) => svgEl('polygon', { points: pts.map((p) => pt(...p)).join(' '), class: cls }, parent);
    let seed = 5;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

    const grid = svgEl('g', { class: 'iso-grid' }, svg);
    for (let x = -3; x <= W + 3; x += 1) svgEl('polyline', { points: `${pt(x, -3, 0)} ${pt(x, D + 3, 0)}` }, grid);
    for (let y = -3; y <= D + 3; y += 1) svgEl('polyline', { points: `${pt(-3, y, 0)} ${pt(W + 3, y, 0)}` }, grid);

    const b = svgEl('g', null, svg);
    const faces = [
      poly([[0, D, 0], [W, D, 0], [W, D, Hh], [0, D, Hh]], 'iso-face iso-left', b),
      poly([[W, 0, 0], [W, D, 0], [W, D, Hh], [W, 0, Hh]], 'iso-face iso-right', b),
      poly([[0, 0, Hh], [W, 0, Hh], [W, D, Hh], [0, D, Hh]], 'iso-face iso-top', b),
      poly([[1, 1.8, Hh], [2.6, 1.8, Hh], [2.6, 1.8, Hh + 0.8], [1, 1.8, Hh + 0.8]], 'iso-face iso-left', b),
      poly([[2.6, 0.6, Hh], [2.6, 1.8, Hh], [2.6, 1.8, Hh + 0.8], [2.6, 0.6, Hh + 0.8]], 'iso-face iso-right', b),
      poly([[1, 0.6, Hh + 0.8], [2.6, 0.6, Hh + 0.8], [2.6, 1.8, Hh + 0.8], [1, 1.8, Hh + 0.8]], 'iso-face iso-top', b),
    ];
    const wins = [];
    for (let f = 0; f < Hh; f += 1) {
      for (let i = 0; i < W; i += 1) {
        wins.push({ el: poly([[i + 0.28, D, f + 0.3], [i + 0.72, D, f + 0.3], [i + 0.72, D, f + 0.78], [i + 0.28, D, f + 0.78]], 'iso-win', b), k: f + i * 0.6, lit: rnd() > 0.45 });
      }
      for (let j = 0; j < D; j += 1) {
        wins.push({ el: poly([[W, j + 0.28, f + 0.3], [W, j + 0.72, f + 0.3], [W, j + 0.72, f + 0.78], [W, j + 0.28, f + 0.78]], 'iso-win', b), k: f + W * 0.6 + j * 0.6, lit: rnd() > 0.45 });
      }
    }
    wins.forEach((w) => w.el.classList.toggle('is-lit', w.lit));
    [[W + 1.5, D + 1.3], [-1, D + 1.8], [W + 2.3, -0.6]].forEach(([x, y]) => {
      svgEl('polyline', { points: `${pt(x, y, 0)} ${pt(x, y, 1.1)}`, class: 'iso-tree-trunk' }, svg);
      const [cx, cy] = pt(x, y, 1.5).split(',');
      svgEl('circle', { cx, cy, r: 7, class: 'iso-tree-top' }, svg);
    });
    let e = `M${pt(0, D, 0)} L${pt(W, D, 0)} L${pt(W, 0, 0)} L${pt(W, 0, Hh)} L${pt(0, 0, Hh)} L${pt(0, D, Hh)} Z`;
    e += ` M${pt(0, D, Hh)} L${pt(W, D, Hh)} L${pt(W, 0, Hh)} M${pt(W, D, Hh)} L${pt(W, D, 0)}`;
    for (let f = 1; f < Hh; f += 1) e += ` M${pt(0, D, f)} L${pt(W, D, f)} L${pt(W, 0, f)}`;
    for (let i = 1; i < W; i += 1) e += ` M${pt(i, D, 0)} L${pt(i, D, Hh)} L${pt(i, 0, Hh)}`;
    const edge = svgEl('path', { d: e, class: 'iso-edge' }, svg);

    loopWhileVisible(root, () => {
      const len = edge.getTotalLength();
      const winEls = wins.map((w) => w.el);
      const tl = G.timeline({ repeat: -1, repeatDelay: 0.2 })
        .call(() => { tag.textContent = 'model'; }, null, 0.02)
        .set(edge, { strokeDasharray: len, strokeDashoffset: len, opacity: 1 }, 0.02)
        .to(faces, { fillOpacity: 0, strokeOpacity: 0.2, duration: 0.6, ease: 'power2.inOut' }, 0.02)
        .to(winEls, { opacity: 0, duration: 0.4 }, 0.02)
        .to(edge, { strokeDashoffset: 0, duration: 1.7, ease: 'power2.inOut' }, 0.35)
        .call(() => { tag.textContent = 'render'; winEls.forEach((w) => w.classList.remove('is-lit')); }, null, 2.2)
        .to(faces, { fillOpacity: 1, strokeOpacity: 1, duration: 0.9, stagger: 0.1, ease: 'power2.out' }, 2.2)
        .to(edge, { opacity: 0, duration: 0.7 }, 2.7)
        .set(winEls, { opacity: 1 }, 2.6);
      wins.forEach((w) => tl.call(() => w.el.classList.toggle('is-lit', w.lit), null, 2.7 + w.k * 0.12));
      tl.call(() => wins[3].el.classList.toggle('is-lit'), null, 5.6)
        .call(() => wins[17].el.classList.toggle('is-lit'), null, 6.2)
        .to({}, { duration: 1.2 }, 6.4);
      return tl;
    }, 0.35);
  })();

  /* ---------- Lanes: filter with Flip, expand rows ---------- */
  (function lanes() {
    const filters = $$('.filter');
    const items = $$('.lane');
    let refreshT = null;
    const refresh = () => { if (!hasG) return; clearTimeout(refreshT); refreshT = setTimeout(() => ST.refresh(), 680); };
    filters.forEach((btn) => btn.addEventListener('click', () => {
      const f = btn.dataset.filter;
      filters.forEach((x) => {
        const on = x === btn;
        x.classList.toggle('is-on', on);
        x.setAttribute('aria-pressed', String(on));
      });
      const state = motion && FlipP ? FlipP.getState(items) : null;
      items.forEach((li) => li.classList.toggle('is-out', f !== 'all' && li.dataset.status !== f));
      if (state) {
        FlipP.from(state, {
          duration: 0.7, ease: 'expo.out', absolute: true,
          onEnter: (els) => G.fromTo(els, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.04, ease: 'expo.out' }),
          onLeave: (els) => G.to(els, { opacity: 0, duration: 0.25 }),
        });
      }
      refresh();
    }));
    $$('.lane-row').forEach((btn) => btn.addEventListener('click', () => {
      const li = btn.closest('.lane');
      const open = !li.classList.contains('is-open');
      li.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
      refresh();
    }));
  })();

  /* ---------- Pointer details ---------- */
  if (finePointer) {
    $$('[data-spot]').forEach((el) => el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    }));
    if (motion) {
      $$('.magnetic').forEach((el) => {
        const xTo = G.quickTo(el, 'x', { duration: 0.6, ease: 'expo.out' });
        const yTo = G.quickTo(el, 'y', { duration: 0.6, ease: 'expo.out' });
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect();
          xTo((e.clientX - r.left - r.width / 2) * 0.25);
          yTo((e.clientY - r.top - r.height / 2) * 0.4);
        });
        el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
      });
    }
  }

  /* ---------- Keep ScrollTrigger measurements honest ---------- */
  if (hasG) {
    ST.sort();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ST.refresh());
    addEventListener('load', () => ST.refresh());
  }
})();
