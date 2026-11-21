/* Cutting Bench · Kevin Yu
   Everything renders from window.KY (../shared/content.js).
   The signature move: an inertial reel that settles on frame pitch, and a frame that opens into a punched window. */
(() => {
  'use strict';
  const KY = window.KY;
  const G = window.gsap;
  const doc = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = !!G && !reduce;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } },
  };
  const LAST = 'ky-bench-last';

  /* A shared SVG filter for grease-pencil strokes */
  document.body.insertAdjacentHTML('afterbegin', '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3.2"/></filter></svg>');

  const STATE_WORD = { live: 'Live', testing: 'In testing', building: 'Building', done: 'Done', parked: 'Set aside' };
  const pad = (n) => String(n).padStart(2, '0');
  const arrow = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 9L9 3M4 3h5v5"/></svg>';
  const tick = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 9l4 4 8-10"/></svg>';
  const crossSvg = '<svg class="cross" viewBox="0 0 64 64" aria-hidden="true"><path d="M10 12 C26 26 40 40 54 54"/><path d="M54 10 C40 26 26 40 12 52"/></svg>';

  /* ---------- Drawn illustrations for work with no public screenshots ---------- */
  const MOCKS = {
    risk: `<svg viewBox="0 0 300 188" aria-hidden="true">
      <rect class="mk-soft" x="16" y="18" width="128" height="40"/><rect class="mk-soft" x="156" y="18" width="128" height="40"/>
      <text x="26" y="44">32,592 checked</text><text x="166" y="44">7 watched</text>
      <g><path class="mk-ink" d="M16 74H284M16 100H284M16 126H284M16 152H284"/>
      <text x="18" y="92">Buyer · Germany</text><rect class="mk-fill" x="236" y="80" width="48" height="14"/>
      <text x="18" y="118">Buyer · Chile</text><rect class="mk-fill" x="236" y="106" width="48" height="14"/>
      <text x="18" y="144">Buyer · UAE</text><rect class="mk-or" x="236" y="132" width="48" height="14"/>
      <text x="18" y="170">4 drafts · Spanish</text></g></svg>`,
    iso: `<svg viewBox="0 0 300 188" aria-hidden="true"><g transform="translate(150 104)">
      <path class="mk-ink" d="M-96 18 L0 -30 L96 18 L0 66 Z"/><path class="mk-ink" d="M-96 18 V-38 L0 -86 L96 -38 V18"/><path class="mk-ink" d="M0 -30 V-86"/><path class="mk-ink" d="M0 66 V10 M-96 -38 L0 10 L96 -38"/>
      <g class="mk-or"><rect x="-74" y="-24" width="12" height="12" transform="skewY(26.5)"/><rect x="-50" y="-12" width="12" height="12" transform="skewY(26.5)"/><rect x="-74" y="2" width="12" height="12" transform="skewY(26.5)"/><rect x="38" y="-24" width="12" height="12" transform="skewY(-26.5)"/><rect x="62" y="-36" width="12" height="12" transform="skewY(-26.5)"/></g>
      </g></svg>`,
    rx: `<svg viewBox="0 0 300 188" aria-hidden="true">
      <rect class="mk-soft" x="22" y="26" width="112" height="34"/><text x="32" y="48">必理痛 Panadol</text>
      <rect class="mk-ink" x="160" y="26" width="118" height="34" stroke-dasharray="4 3"/><text x="168" y="48">Paracetamol 500</text>
      <path class="mk-or-s" d="M78 62 V84 H218 V62"/><text x="96" y="106">Same ingredient</text>
      <g class="mk-fill">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((i) => { const h = [8, 16, 26, 14, 22, 30, 12, 24, 18, 28, 10, 20, 14, 8][i]; return `<rect x="${86 + i * 9}" y="${150 - h / 2}" width="4" height="${h}"/>`; }).join('')}</g>
      <text x="220" y="156">粵語</text></svg>`,
  };
  const mockHtml = (name) => `<div class="mock">${MOCKS[name] || ''}<span class="label mock-note">Illustration</span></div>`;

  /* ---------- Frame faces ---------- */
  function face(p) {
    const c = p.cover || { type: 'none' };
    if (c.type === 'img') return `<img src="${esc(c.src)}" alt="" loading="lazy" decoding="async">`;
    if (c.type === 'video') return `<video src="${esc(c.src)}" poster="${esc(c.poster)}" muted loop playsinline preload="none" data-autoplay></video>`;
    if (c.type === 'mock') return mockHtml(c.mock);
    if (c.type === 'stickers') {
      return `<div class="frame-fill" data-stickers><img class="stk-room" src="${esc(c.room)}" alt="" loading="lazy">${c.stickers.map((s) => `<img class="stk" src="${esc(s)}" alt="" loading="lazy">`).join('')}</div>`;
    }
    return '';
  }

  function marks(p) {
    let m = '';
    if (p.status === 'live') m += `<span class="tape label">Live</span>`;
    else if (p.status === 'testing' || p.status === 'building') m += `<span class="tape is-thin label">${STATE_WORD[p.status]}</span>`;
    if (p.status === 'done') m += crossSvg;
    if (p.private) m += '<span class="punch" aria-hidden="true"></span>';
    return m;
  }

  /* ---------- Work reel ---------- */
  const order = [];
  function renderWork() {
    const strip = $('[data-rail="work"] [data-strip]');
    let html = '';
    let n = 0;
    KY.categories.forEach((cat, ci) => {
      const items = KY.projects.filter((p) => p.category === cat.id && p.status !== 'parked');
      if (!items.length) return;
      html += `<div class="cell cell-leader" aria-hidden="true">${ci ? '<span class="splice"></span>' : ''}<div class="frame leader">
        <svg viewBox="0 0 300 188"><circle cx="150" cy="94" r="70"/><circle cx="150" cy="94" r="56"/><path d="M150 0V188M0 94H300"/></svg>
        <span class="leader-name">${esc(cat.label)}</span><span class="label leader-count">${items.length} ${items.length === 1 ? 'frame' : 'frames'}</span></div>
        <p class="cell-label label"><b>${esc(cat.label)}</b><span>Leader</span></p></div>`;
      items.forEach((p) => {
        n += 1;
        order.push(p.id);
        const state = STATE_WORD[p.status] || '';
        html += `<div class="cell${p.private ? ' is-private' : ''}" data-cell="${esc(p.id)}">
          <span class="flag" aria-hidden="true"></span>
          <button class="frame" type="button" data-open="${esc(p.id)}" aria-label="${esc(p.title)}. ${esc(state)}. Open details">${face(p)}${marks(p)}</button>
          <p class="cell-label label"><b>${pad(n)} ${esc(p.title)}</b><span>${esc(p.year || '')}</span></p></div>`;
      });
    });
    strip.innerHTML = html;
    $('[data-line]').textContent = KY.person.line;

    const pins = $('[data-pins]');
    const parked = KY.projects.filter((p) => p.status === 'parked');
    pins.innerHTML = parked.map((p) => `<li class="pin"><button class="trim" type="button" data-open="${esc(p.id)}" aria-label="${esc(p.title)}, set aside. Open details"><b>${esc(p.title)}</b><span>${esc(p.one)}</span></button></li>`).join('')
;
  }

  /* ---------- Résumé reel and skills ---------- */
  const cvItems = [];
  function renderResume() {
    const strip = $('[data-rail="resume"] [data-strip]');
    const r = KY.resume;
    r.experience.forEach((e, i) => cvItems.push({ id: `cv-${i}`, kind: 'Experience', when: e.when, title: e.role, sub: e.org, note: e.note }));
    r.education.forEach((e, i) => cvItems.push({ id: `edu-${i}`, kind: 'Education', when: e.when, title: e.org, sub: '', note: e.note }));
    let html = '';
    let lastKind = '';
    cvItems.forEach((c) => {
      if (c.kind !== lastKind) {
        html += `<div class="cell cell-leader" aria-hidden="true">${lastKind ? '<span class="splice"></span>' : ''}<div class="frame leader"><svg viewBox="0 0 300 188"><circle cx="150" cy="94" r="70"/><circle cx="150" cy="94" r="56"/><path d="M150 0V188M0 94H300"/></svg><span class="leader-name">${esc(c.kind)}</span></div><p class="cell-label label"><b>${esc(c.kind)}</b><span>Leader</span></p></div>`;
        lastKind = c.kind;
      }
      html += `<div class="cell" data-cell="${c.id}"><span class="flag" aria-hidden="true"></span>
        <button class="frame card" type="button" data-open="${c.id}" aria-label="${esc(c.title)}${c.sub ? `, ${esc(c.sub)}` : ''}. ${esc(c.when)}. Open details">
          <span class="label card-when">${esc(c.when)}</span>
          <span><span class="card-title${c.title.length > 22 ? ' is-long' : ''}">${esc(c.title)}</span>${c.sub ? `<span class="card-sub">${esc(c.sub)}</span>` : ''}</span>
        </button><p class="cell-label label"><b>${esc(c.kind)}</b><span>${esc(c.when)}</span></p></div>`;
    });
    strip.innerHTML = html;
    $('[data-skills]').innerHTML = `<dl style="display:contents">${r.skills.map(([k, v]) => `<div><dt class="label">${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
  }

  /* ---------- Writing reel: newest issues, fetched so new ones appear on their own ---------- */
  async function renderWriting(rail) {
    const strip = $('[data-rail="writing"] [data-strip]');
    const all = `<div class="cell cell-all"><a class="frame" href="${esc(KY.newsletter.index)}"><span>All issues<i class="label">Open the archive</i></span></a><p class="cell-label label"><b>Archive</b><span>EN · 中文</span></p></div>`;
    let issues = [];
    try {
      const res = await fetch(KY.newsletter.issues, { cache: 'no-cache' });
      const data = await res.json();
      issues = (data.issues || data || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);
    } catch (e) { issues = []; }
    const fmt = (d) => { const t = new Date(`${d}T12:00:00`); return t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
    strip.innerHTML = issues.map((is, i) => {
      const t = (is.en && is.en.title) || (is.zh && is.zh.title) || 'Issue';
      return `<div class="cell"><a class="frame card" href="../../newsletter/${esc(is.date)}/" aria-label="${esc(t)}, ${fmt(is.date)}">
        <span class="label card-when">${fmt(is.date)}</span>
        <span><span class="card-title${t.length > 46 ? ' is-long' : ''}">${esc(t)}</span></span></a>
        <p class="cell-label label"><b>${i === 0 ? 'Latest' : 'Issue'}</b><span>${esc(is.topic || '')}</span></p></div>`;
    }).join('') + all;
    if (rail) rail.measure();
  }

  /* ---------- Contact window ---------- */
  function renderContact() {
    const c = KY.contact;
    $('[data-contact]').innerHTML = `
      <div><h3>Work with Kevin</h3><ul class="asks text">${c.asks.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>
      <div class="ways">
        <p class="way"><span class="label">LinkedIn</span><a href="${esc(c.linkedin)}" target="_blank" rel="noopener">Message me</a></p>
        <p class="way"><span class="label">Phone, text or WeChat</span><a href="${esc(c.phoneHref)}">${esc(c.phone)}</a></p>
        <p class="way"><span class="label">Email</span><span class="soon">Coming soon</span></p>
        <p class="way"><span class="label">X</span><span class="soon">Coming soon</span></p>
      </div>
      <figure class="qr"><img src="${esc(c.wechatQr)}" alt="WeChat QR code for Kevin Yu" width="150" height="150" loading="lazy"><figcaption class="label">Scan in WeChat</figcaption></figure>`;
  }

  /* =====================================================================
     The reel: drag, wheel and keys, with inertia that settles on frame pitch
     ===================================================================== */
  class Reel {
    constructor(rail) {
      this.rail = rail;
      this.strip = $('[data-strip]', rail);
      this.x = 0;
      this.anim = null;
      this.listeners = [];
      this.measure();
      this.bind();
    }
    measure() {
      const cs = getComputedStyle(doc);
      this.pitch = parseFloat(cs.getPropertyValue('--pitch')) || 328;
      this.min = Math.min(0, this.rail.clientWidth - this.strip.scrollWidth);
      this.apply(this.clamp(this.x));
    }
    clamp(x) { return Math.max(this.min, Math.min(0, x)); }
    rubber(x) {
      if (x > 0) return x * 0.35;
      if (x < this.min) return this.min + (x - this.min) * 0.35;
      return x;
    }
    snapOf(x) {
      const s = Math.round(x / this.pitch) * this.pitch;
      if (s < this.min) return this.min;
      return Math.min(0, s);
    }
    apply(x) {
      this.x = x;
      this.strip.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
      this.listeners.forEach((f) => f(x));
    }
    to(x, dur) {
      if (this.anim) this.anim.kill();
      const target = this.clamp(x);
      if (!motion || !dur) { this.apply(target); return; }
      const o = { x: this.x };
      this.anim = G.to(o, { x: target, duration: dur, ease: 'power3.out', onUpdate: () => this.apply(o.x) });
    }
    step(dir) { this.to(this.snapOf(this.x - dir * this.pitch), 0.6); }
    show(el) {
      const cell = el.closest('.cell');
      if (!cell) return;
      const left = cell.offsetLeft;
      const pad = parseFloat(getComputedStyle(this.strip).paddingLeft) || 0;
      const viewL = -this.x;
      const viewR = viewL + this.rail.clientWidth;
      if (left - pad < viewL || left + cell.offsetWidth + pad > viewR) this.to(this.snapOf(-(left - pad)), 0.6);
    }
    bind() {
      const rail = this.rail;
      let down = false; let startX = 0; let startY = 0; let base = 0; let moved = 0; let lastX = 0; let lastT = 0; let v = 0; let axis = '';
      rail.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        down = true; axis = ''; moved = 0; startX = lastX = e.clientX; startY = e.clientY; base = this.x; lastT = performance.now(); v = 0;
        if (this.anim) this.anim.kill();
      });
      addEventListener('pointermove', (e) => {
        if (!down) return;
        const dx = e.clientX - startX; const dy = e.clientY - startY;
        if (!axis) {
          if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
          axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
          if (axis === 'x') { rail.classList.add('is-dragging'); try { rail.setPointerCapture(e.pointerId); } catch (err) { /* ok */ } }
        }
        if (axis !== 'x') return;
        moved = Math.abs(dx);
        const now = performance.now();
        const dt = Math.max(1, now - lastT);
        v = 0.8 * ((e.clientX - lastX) / dt) + 0.2 * v;
        lastX = e.clientX; lastT = now;
        this.apply(this.rubber(base + dx));
      });
      const up = () => {
        if (!down) return;
        down = false;
        rail.classList.remove('is-dragging');
        if (axis === 'x') {
          const projected = motion ? this.x + v * 320 : this.x;
          const dur = motion ? Math.min(1.2, Math.max(0.5, Math.abs(v) * 0.6)) : 0;
          this.to(this.snapOf(projected), dur);
        }
        this.suppress = moved > 6;
        setTimeout(() => { this.suppress = false; }, 50);
      };
      addEventListener('pointerup', up);
      addEventListener('pointercancel', up);
      rail.addEventListener('click', (e) => { if (this.suppress) { e.preventDefault(); e.stopPropagation(); } }, true);
      rail.addEventListener('dragstart', (e) => e.preventDefault());

      let wheelT = null;
      rail.addEventListener('wheel', (e) => {
        const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
        if (!dx) return;
        e.preventDefault();
        if (this.anim) this.anim.kill();
        this.apply(this.clamp(this.x - dx));
        clearTimeout(wheelT);
        wheelT = setTimeout(() => this.to(this.snapOf(this.x), 0.45), 140);
      }, { passive: false });

      rail.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const frames = $$('.frame[data-open], a.frame', rail);
        const i = frames.indexOf(document.activeElement);
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        if (i > -1) {
          const next = frames[Math.max(0, Math.min(frames.length - 1, i + dir))];
          next.focus({ preventScroll: true });
          this.show(next);
        } else {
          this.step(dir);
        }
      });
      rail.addEventListener('focusin', (e) => { if (e.target !== rail) this.show(e.target); });
      let rt = null;
      addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => this.measure(), 120); });
    }
  }

  /* ---------- Pins: trims swing when touched and when the reel moves ---------- */
  function pins(reel) {
    if (!motion) return;
    const trims = $$('.trim');
    const swing = (t, amt) => {
      G.killTweensOf(t);
      G.fromTo(t, { rotation: amt }, { rotation: 0, duration: 2.4, ease: 'elastic.out(1.1, 0.18)' });
    };
    trims.forEach((t, i) => {
      t.addEventListener('pointerenter', () => swing(t, i % 2 ? -9 : 9));
    });
    let last = reel.x; let acc = 0;
    reel.listeners.push((x) => {
      acc += x - last; last = x;
      if (Math.abs(acc) > 120) { trims.forEach((t, i) => swing(t, Math.max(-7, Math.min(7, acc / 40)) * (i % 2 ? 0.8 : 1))); acc = 0; }
    });
  }

  /* ---------- Covers that move: videos play and stickers land only while visible ---------- */
  function liveCovers() {
    const vids = $$('video[data-autoplay]');
    const stick = $$('[data-stickers]');
    if (!('IntersectionObserver' in window)) { stick.forEach((s) => s.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      const el = e.target;
      if (el.tagName === 'VIDEO') {
        if (e.isIntersecting && !reduce) { el.preload = 'auto'; el.play().catch(() => {}); } else el.pause();
      } else el.classList.toggle('is-in', e.isIntersecting);
    }), { threshold: 0.4 });
    vids.forEach((v) => io.observe(v));
    stick.forEach((s) => io.observe(s));
  }

  /* =====================================================================
     The viewer: a frame opens into a punched white window
     ===================================================================== */
  const viewer = $('[data-viewer]');
  const win = $('[data-window]');
  const body = $('[data-wbody]');
  const main = $('#main');
  let current = null;
  let origin = null;

  const findProject = (id) => KY.projects.find((p) => p.id === id);
  const findCv = (id) => cvItems.find((c) => c.id === id);
  const sequence = () => [...order, ...KY.projects.filter((p) => p.status === 'parked').map((p) => p.id)];

  function mediaNode(m, cover) {
    if (!m) return '';
    if (m.type === 'img') return `<img src="${esc(m.src)}" alt="${esc(m.alt || '')}"${cover ? ' class="is-cover"' : ''}>`;
    if (m.type === 'video') return `<video src="${esc(m.src)}" poster="${esc(m.poster || '')}" ${reduce ? 'controls' : 'autoplay'} muted loop playsinline aria-label="${esc(m.alt || '')}"></video>`;
    if (m.type === 'mock') return mockHtml(m.mock);
    if (m.type === 'yt') return `<button class="yt-load" type="button" data-yt="${esc(m.id)}" aria-label="Play ${esc(m.alt || 'video')} on YouTube"><img src="https://i.ytimg.com/vi/${esc(m.id)}/hqdefault.jpg" alt="" referrerpolicy="no-referrer"><span class="play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4l14 8-14 8z"/></svg></span></button>`;
    return '';
  }
  const thumbSrc = (m) => (m.type === 'img' ? m.src : m.type === 'video' ? m.poster : m.type === 'yt' ? `https://i.ytimg.com/vi/${m.id}/mqdefault.jpg` : null);

  function projectHtml(p) {
    let media = (p.media && p.media.length ? p.media : [p.cover]).filter((m) => m && m.type !== 'none');
    if (p.cover && p.cover.type === 'video' && !media.some((m) => m.src === p.cover.src)) media = [p.cover, ...media];
    if (p.cover && p.cover.type === 'stickers') media = [{ type: 'img', src: p.cover.room, alt: 'Sticker Scenes room' }, ...p.cover.stickers.map((s) => ({ type: 'img', src: s, alt: 'A sticker from Sticker Scenes' }))];
    const first = media[0];
    const light = first && (first.type === 'mock' || p.id === 'stickers' || p.id === 'party' || p.id === 'court');
    const thumbs = media.length > 1 ? `<div class="w-thumbs" role="group" aria-label="Pictures">${media.map((m, i) => {
      const s = thumbSrc(m);
      return `<button class="w-thumb" type="button" data-media="${i}" aria-pressed="${i === 0}" aria-label="Show ${esc(m.alt || `picture ${i + 1}`)}">${s ? `<img src="${esc(s)}" alt="" referrerpolicy="no-referrer">` : ''}</button>`;
    }).join('')}</div>` : '';
    const seq = sequence();
    const idx = seq.indexOf(p.id);
    return `
      <div class="w-media">${first ? `<div class="w-stage${light ? ' is-light' : ''}" data-stage>${mediaNode(first, false)}</div>` : ''}${thumbs}</div>
      <div class="w-text">
        <h2 class="w-title" id="w-title">${esc(p.title)}</h2>
        <p class="w-meta"><span class="w-state label">${esc(STATE_WORD[p.status] || '')}</span><span class="label">${esc(p.role || '')}${p.year ? ` · ${esc(p.year)}` : ''}</span></p>
        <div class="w-copy text">${(p.body || []).map((b) => `<p>${esc(b)}</p>`).join('')}</div>
        ${p.facts && p.facts.length ? `<ul class="w-facts text">${p.facts.slice(0, 4).map((f) => `<li>${tick}${esc(f)}</li>`).join('')}</ul>` : ''}
        ${p.links && p.links.length ? `<p class="w-links">${p.links.map((l) => `<a class="w-link" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)} ${arrow}</a>`).join('')}</p>` : (p.private ? '<p class="w-private label">Private client tool · demo on request</p>' : '')}
      </div>
      <nav class="w-nav" aria-label="More frames"><button type="button" data-step="-1"${idx <= 0 ? ' disabled' : ''}>Previous frame</button><button type="button" data-step="1"${idx >= seq.length - 1 ? ' disabled' : ''}>Next frame</button></nav>`;
    }

  function cvHtml(c) {
    return `
      <div class="w-media"><div class="w-stage" style="aspect-ratio:16/9"><div class="frame card" style="position:absolute;inset:0;width:auto;height:auto;padding:clamp(22px,4vw,48px)"><span class="label card-when">${esc(c.when)}</span><span><span class="card-title" style="font-size:clamp(2rem,4vw,3.4rem)">${esc(c.title)}</span>${c.sub ? `<span class="card-sub" style="font-size:1.25rem;margin-top:8px;display:block">${esc(c.sub)}</span>` : ''}</span></div></div></div>
      <div class="w-text">
        <h2 class="w-title" id="w-title">${esc(c.title)}</h2>
        <p class="w-meta"><span class="w-state label">${esc(c.kind)}</span><span class="label">${esc(c.when)}</span></p>
        ${c.note ? `<div class="w-copy text"><p>${esc(c.note)}</p></div>` : ''}
        <p class="w-links"><a class="w-link" href="#contact" data-goto-contact>Get in touch ${arrow}</a></p>
      </div>`;
  }

  function wireWindow(p) {
    const stage = $('[data-stage]', body);
    let media = null;
    if (p && p.media !== undefined) {
      media = (p.media && p.media.length ? p.media : [p.cover]).filter((m) => m && m.type !== 'none');
      if (p.cover && p.cover.type === 'video' && !media.some((m) => m.src === p.cover.src)) media = [p.cover, ...media];
      if (p.cover && p.cover.type === 'stickers') media = [{ type: 'img', src: p.cover.room, alt: 'Sticker Scenes room' }, ...p.cover.stickers.map((s) => ({ type: 'img', src: s, alt: 'A sticker from Sticker Scenes' }))];
    }
    body.onclick = (e) => {
      const yt = e.target.closest('[data-yt]');
      if (yt) {
        const id = yt.dataset.yt;
        yt.outerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0" title="YouTube video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
        return;
      }
      const th = e.target.closest('[data-media]');
      if (th && media && stage) {
        const m = media[+th.dataset.media];
        $$('[data-media]', body).forEach((b) => b.setAttribute('aria-pressed', String(b === th)));
        stage.classList.toggle('is-light', m.type === 'mock');
        stage.innerHTML = mediaNode(m, false);
        if (motion) G.fromTo(stage.firstElementChild, { opacity: 0, scale: 1.02 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'expo.out' });
        return;
      }
      const st = e.target.closest('[data-step]');
      if (st) {
        const seq = sequence();
        const next = seq[seq.indexOf(current) + +st.dataset.step];
        if (next) location.hash = `#/${next}`;
        return;
      }
      if (e.target.closest('[data-goto-contact]')) { e.preventDefault(); close(true); setTimeout(() => $('#contact').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }), 60); }
    };
  }

  function open(id) {
    const p = findProject(id);
    const c = p ? null : findCv(id);
    if (!p && !c) return false;
    const switching = !viewer.hidden;
    current = id;
    body.innerHTML = p ? projectHtml(p) : cvHtml(c);
    wireWindow(p || c);
    store.set(LAST, id);
    $$('.cell.is-flagged').forEach((el) => el.classList.remove('is-flagged'));
    const cell = $(`[data-cell="${CSS.escape(id)}"]`);
    if (cell) cell.classList.add('is-flagged');
    const frame = $(`[data-open="${CSS.escape(id)}"]`);
    if (!switching) origin = frame || document.activeElement;

    viewer.hidden = false;
    main.inert = true;
    $('.bar').inert = true;
    document.body.style.overflow = 'hidden';
    body.scrollTop = 0;

    if (motion && !switching) {
      const wr = win.getBoundingClientRect();
      let from = 'inset(46% 46% 46% 46%)';
      if (frame) {
        const fr = frame.getBoundingClientRect();
        const t = Math.max(0, fr.top - wr.top); const l = Math.max(0, fr.left - wr.left);
        const b = Math.max(0, wr.bottom - fr.bottom); const r = Math.max(0, wr.right - fr.right);
        from = `inset(${t}px ${r}px ${b}px ${l}px)`;
      }
      G.fromTo(win, { clipPath: from }, { clipPath: 'inset(0px 0px 0px 0px)', duration: 0.75, ease: 'expo.inOut', clearProps: 'clipPath' });
      G.fromTo('.viewer-shade', { opacity: 0 }, { opacity: 1, duration: 0.4 });
      G.fromTo($$('.w-text > *', body), { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.05, ease: 'expo.out', delay: 0.45 });
    } else if (motion) {
      G.fromTo(body, { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.45, ease: 'expo.out' });
    }
    win.focus({ preventScroll: true });
    return true;
  }

  function close(keepHash) {
    if (viewer.hidden) return;
    const done = () => {
      viewer.hidden = true;
      body.innerHTML = '';
      main.inert = false;
      $('.bar').inert = false;
      document.body.style.overflow = '';
      if (origin && origin.focus) origin.focus({ preventScroll: true });
      current = null;
    };
    if (!keepHash && location.hash.startsWith('#/')) history.replaceState(null, '', location.pathname + location.search);
    else if (keepHash && location.hash.startsWith('#/')) history.replaceState(null, '', location.pathname + location.search);
    if (!motion) { done(); return; }
    const frame = current && $(`[data-open="${CSS.escape(current)}"]`);
    let to = 'inset(46% 46% 46% 46%)';
    if (frame) {
      const wr = win.getBoundingClientRect(); const fr = frame.getBoundingClientRect();
      to = `inset(${Math.max(0, fr.top - wr.top)}px ${Math.max(0, wr.right - fr.right)}px ${Math.max(0, wr.bottom - fr.bottom)}px ${Math.max(0, fr.left - wr.left)}px)`;
    }
    G.to('.viewer-shade', { opacity: 0, duration: 0.45 });
    G.fromTo(win, { clipPath: 'inset(0px 0px 0px 0px)' }, { clipPath: to, duration: 0.55, ease: 'expo.inOut', onComplete: () => { G.set(win, { clearProps: 'clipPath' }); done(); } });
  }

  function route() {
    const m = location.hash.match(/^#\/(.+)$/);
    if (m) {
      const id = decodeURIComponent(m[1]);
      const frame = $(`[data-open="${CSS.escape(id)}"]`);
      const reel = frame && reels.find((r) => r.rail.contains(frame));
      if (reel && viewer.hidden) reel.show(frame);
      if (!open(id)) close();
    } else close(true);
  }

  /* ---------- Section indicator in the bar ---------- */
  function navSpy() {
    const links = $$('.bar-nav a');
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const id = e.target.id === 'top' ? 'work' : e.target.id;
      links.forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('href') === `#${id}`)));
    }), { rootMargin: '-45% 0px -50% 0px' });
    $$('.sheet').forEach((s) => io.observe(s));
  }

  /* ---------- Intro: the film threads in from the right ---------- */
  function intro(reel) {
    const lines = $$('#work-title .line > span');
    if (!motion) return;
    const start = reel.x;
    reel.apply(window.innerWidth * 0.9);
    const o = { x: window.innerWidth * 0.9 };
    G.timeline({ defaults: { ease: 'expo.out' } })
      .fromTo(lines, { yPercent: 110 }, { yPercent: 0, duration: 1.1, stagger: 0.08 }, 0.05)
      .fromTo('.sheet-work .head-side', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.8 }, 0.35)
      .to(o, { x: start, duration: 1.7, ease: 'expo.out', onUpdate: () => reel.apply(o.x) }, 0.15)
      .fromTo('.pin', { y: -26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.08 }, 0.9)
      .add(() => $$('.trim').forEach((t, i) => G.fromTo(t, { rotation: i % 2 ? -8 : 8 }, { rotation: 0, duration: 2.4, ease: 'elastic.out(1.1, 0.18)' })), 1.0);
  }

  /* ---------- Boot ---------- */
  renderWork();
  renderResume();
  renderContact();
  const reels = $$('[data-rail]').map((r) => new Reel(r));
  const workReel = reels[0];
  renderWriting(reels[2]);

  const last = store.get(LAST);
  if (last) {
    const cell = $(`[data-cell="${CSS.escape(last)}"]`);
    if (cell) {
      cell.classList.add('is-flagged');
      const reel = reels.find((r) => r.rail.contains(cell));
      if (reel) { const pad = parseFloat(getComputedStyle(reel.strip).paddingLeft) || 0; reel.apply(reel.snapOf(-(cell.offsetLeft - pad - reel.pitch))); }
    }
  }

  pins(workReel);
  liveCovers();
  navSpy();

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]');
    if (b && !viewer.contains(b)) { e.preventDefault(); location.hash = `#/${b.dataset.open}`; return; }
    if (e.target.closest('[data-close]')) { e.preventDefault(); close(); }
  });
  addEventListener('keydown', (e) => {
    if (viewer.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Tab') {
      const f = $$('button, a[href], iframe, video[controls], [tabindex="0"]', win).filter((el) => !el.disabled && el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0]; const lastEl = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === win)) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    }
  });
  addEventListener('hashchange', route);

  if (location.hash.startsWith('#/')) { route(); } else intro(workReel);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => reels.forEach((r) => r.measure()));
})();
