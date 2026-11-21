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
      const key = activeId && (document.getElementById(activeId).dataset.nav || activeId);
      activeLink = navLinks.find((a) => a.getAttribute('href') === `#${key}`) || null;
      navLinks.forEach((a) => a.classList.toggle('is-active', a === activeLink));
      placeIndicator(activeLink);
    }, { rootMargin: '-45% 0px -54% 0px' });
    // Sections without their own link light up their chapter's link (data-nav).
    $$('main > section[id]').forEach((s) => io.observe(s));
    navLinks.forEach((a) => a.addEventListener('pointerenter', () => placeIndicator(a)));
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

  /* ---------- Hero entrance ---------- */
  (function heroIntro() {
    let started = false;
    const go = () => {
      if (started) return;
      started = true;
      doc.classList.remove('intro-pending');
      if (!motion) return;
      G.timeline({ defaults: { ease: 'expo.out' }, delay: doc.classList.contains('has-curtain') ? 1.05 : 0 })
        .fromTo('.hero .eyebrow', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9 }, 0)
        .fromTo('.hero-title .line-in', { yPercent: 115, rotate: 3, transformOrigin: '0% 100%' },
          { yPercent: 0, rotate: 0, duration: 1.3, stagger: 0.1 }, 0.08)
        .fromTo('.hero .lede, .hero .cta-row', { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 1, stagger: 0.08 }, 0.4)
        .fromTo('.hero-art', { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 2.2, ease: 'power2.out' }, 0.2)
        .fromTo('.facts li', { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.07 }, 0.9);
    };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(go);
      setTimeout(go, 900);
    } else {
      go();
    }
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

  // AI influencer clips: muted loops that only play on screen, with a sound toggle.
  $$('[data-clip]').forEach((video) => {
    const btn = video.parentElement.querySelector('.clip-sound');
    if (reduce) video.controls = true;
    else whenVisible(video, () => { video.play().catch(() => {}); }, () => video.pause(), 0.4);
    if (!btn) return;
    btn.addEventListener('click', () => {
      video.muted = !video.muted;
      btn.setAttribute('aria-pressed', String(!video.muted));
      btn.setAttribute('aria-label', video.muted ? 'Turn sound on' : 'Turn sound off');
      if (video.paused) video.play().catch(() => {});
    });
  });

  // Ariana: her photos crossfade while the card is on screen; the dots pick one.
  $$('[data-gallery]').forEach((g) => {
    const imgs = $$('img', g);
    const dots = $$('.clip-dots button', g);
    if (imgs.length < 2) return;
    let i = 0;
    let t = null;
    const show = (n) => {
      i = (n + imgs.length) % imgs.length;
      imgs.forEach((im, k) => im.classList.toggle('is-on', k === i));
      dots.forEach((d, k) => d.setAttribute('aria-pressed', String(k === i)));
    };
    const stop = () => { clearInterval(t); t = null; };
    const run = () => { if (!reduce && !t) t = setInterval(() => show(i + 1), 3800); };
    dots.forEach((d, k) => d.addEventListener('click', () => { stop(); show(k); run(); }));
    whenVisible(g, run, stop, 0.4);
  });

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
