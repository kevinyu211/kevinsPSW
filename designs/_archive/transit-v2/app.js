/* Kevin Yu · Transit, ride the line
   One train, nine stations. The line diagram (real buttons) drives the ride; the 3D city follows.
   Arriving opens the platform: a district's projects, the timetable, the news kiosk or the terminus. */
const KY = window.KY;
const G = window.gsap;
const doc = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const motion = !!G && !reduce;
const phone = window.matchMedia('(max-width: 760px)');
const NS = 'http://www.w3.org/2000/svg';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const h = (tag, attrs = {}, text) => {
  const n = document.createElement(tag);
  for (const k in attrs) { if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k]); }
  if (text != null) n.textContent = text;
  return n;
};
const s_ = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};
const dPath = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');

const STATUS = { live: 'Live', testing: 'In testing', building: 'Building', done: 'Done', parked: 'Planned' };
const WHEN = { uhome: 2025.5, books: 2025.85, hirvo: 2026.05, yae: 2026.2, duiyao: 2026.3, influencers: 2026.45, trade: 2026.6, hackathons: 2026.65, party: 2026.7, ipad: 2026.75, court: 2026.8, noir: 2026.82, stickers: 2027.05, pindou: 2027.12 };
const SHORT = { trade: 'Export risk tool', court: 'Court booking', books: 'Snuggle Crew books', ipad: 'iPad coloring app', duiyao: '對藥', pindou: '拼豆 store' };
const catName = Object.fromEntries(KY.categories.map((c) => [c.id, c.label]));
const LETTER = { software: 'S', books: 'B', film: 'F', games: 'G', health: 'H' };

/* ---------- The line: nine stations through Kevin's city ---------- */
const STATIONS = [
  { id: 'origin', kind: 'origin', name: 'Kevin', letter: 'K', x: -30, z: 20, sign: 'Mid-2024' },
  ...['software', 'books', 'film', 'games', 'health'].map((id, i) => ({ id, kind: 'district', name: catName[id], letter: LETTER[id], x: [-16, -2, 10, 24, 34][i], z: [8, 18, 4, 14, 0][i] })),
  { id: 'timetable', kind: 'ix', name: 'Timetable', letter: 'T', x: 26, z: -14, sign: 'Interchange' },
  { id: 'news', kind: 'ix', name: 'News kiosk', letter: 'N', x: 12, z: -22, sign: 'Interchange' },
  { id: 'terminus', kind: 'terminus', name: 'Non-stop', letter: '∞', x: -4, z: -18, sign: 'Next: still searching' },
];
const IDX = Object.fromEntries(STATIONS.map((s, i) => [s.id, i]));
const projById = Object.fromEntries(KY.projects.map((p) => [p.id, p]));
const lineVar = (s) => (s.kind === 'district' ? `var(--l-${s.id})` : 'var(--ink)');

let cur = 0;
let target = 0;
let visited = 0;
let scene = null;

/* ---------- Line diagram (HUD) ---------- */
const hud = $('[data-hud]');
const hudTrain = $('[data-hud-train]');
const stops = STATIONS.map((s, i) => {
  const li = h('div', { class: `hud-stop${s.kind === 'ix' || s.kind === 'terminus' ? ' is-ix' : ''}${s.id === 'books' ? ' is-light' : ''}` });
  li.style.setProperty('--dot', lineVar(s));
  const next = STATIONS[i + 1];
  const seg = h('span', { class: `hud-seg${next ? '' : ' is-future'}`, 'aria-hidden': 'true' });
  if (next) seg.style.setProperty('--seg', next.kind === 'district' ? lineVar(next) : s.kind === 'district' ? lineVar(s) : 'var(--ink)');
  else seg.style.width = '60%';
  const b = h('button', { type: 'button', 'data-index': String(i), 'aria-label': `Ride to ${s.name}${s.sign ? `, ${s.sign}` : ''}` });
  const dot = h('span', { class: 'hud-dot', 'aria-hidden': 'true' }, s.letter);
  b.append(dot, h('span', { class: 'hud-name' }, s.name));
  b.addEventListener('click', () => go(i));
  li.append(seg, b);
  hud.append(li);
  return li;
});
function centers() {
  return stops.map((li) => li.offsetLeft + li.offsetWidth / 2);
}
let cx = [];
function placeHudTrain(f) {
  if (!cx.length) cx = centers();
  const i = Math.max(0, Math.min(STATIONS.length - 1, Math.floor(f)));
  const t = f - i;
  const x = i >= STATIONS.length - 1 ? cx[cx.length - 1] : cx[i] + (cx[i + 1] - cx[i]) * t;
  hudTrain.style.transform = `translateX(${x.toFixed(1)}px)`;
  const reached = Math.floor(f + 0.001);
  if (reached > visited) visited = reached;
  stops.forEach((li, k) => li.classList.toggle('is-passed', k <= visited && k !== cur));
}
addEventListener('resize', () => { cx = centers(); placeHudTrain(cur); syncControls(); });

/* ---------- Ride controls ---------- */
const prevBtn = $('[data-prev]');
const nextBtn = $('[data-next]');
const nextLabel = $('[data-next-label]');
const rideLabel = $('[data-ride-label]');
const barNow = $('[data-now]');
const panel = $('[data-panel]');
const panelIn = $('[data-panel-in]');
prevBtn.addEventListener('click', () => go(Math.max(0, target - 1)));
nextBtn.addEventListener('click', () => go(Math.min(STATIONS.length - 1, target + 1)));
function syncControls() {
  prevBtn.disabled = target <= 0;
  const n = STATIONS[target + 1];
  nextBtn.disabled = !n;
  nextLabel.textContent = n ? (target === 0 ? 'Ride' : phone.matches ? 'Next' : `Next: ${n.name}`) : 'Non-stop';
  nextBtn.setAttribute('aria-label', n ? `Ride to the next station, ${n.name}` : 'This is the last station');
  stops.forEach((li, k) => {
    const b = $('button', li);
    if (k === target) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
  });
}

/* ---------- Go: ride the train to a station ---------- */
async function go(i, opts = {}) {
  if (i < 0 || i >= STATIONS.length) return;
  const s = STATIONS[i];
  const riding = i !== cur || target !== cur;
  target = i;
  syncControls();
  history.replaceState(null, '', `#/station/${s.id}`);
  stops[i].scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce || opts.instant ? 'auto' : 'smooth' });
  if (!riding && !opts.force) { arrive(i, opts); return; }
  panel.classList.add('is-riding');
  barNow.textContent = '';
  barNow.append(document.createTextNode('Riding to '), h('b', {}, s.name));
  rideLabel.textContent = `Next stop: ${s.name}`;
  if (scene) {
    scene.highlight(-1);
    await scene.goTo(i, { instant: !!opts.instant });
    if (target !== i) return;
  } else placeHudTrain(i);
  arrive(i, opts);
}

function arrive(i, opts = {}) {
  cur = i;
  const s = STATIONS[i];
  panel.classList.remove('is-riding');
  barNow.textContent = '';
  barNow.append(document.createTextNode('Now at '), h('b', {}, s.name));
  rideLabel.textContent = s.name;
  if (scene) scene.highlight(i);
  placeHudTrain(i);
  syncControls();
  renderPanel(s);
  panel.scrollTop = 0;
  if (motion && !opts.instant) G.fromTo(panelIn.children, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, stagger: 0.05, ease: 'expo.out', clearProps: 'transform,opacity' });
  if (!opts.quiet && document.activeElement && document.activeElement.closest('.hud, .stage-ride')) {
    // keep keyboard users in the diagram; the panel announces itself via aria-live
  }
}

/* ---------- Platform panels ---------- */
function sign(s, sub) {
  const head = h('header', { class: 'p-sign' });
  const b = h('span', { class: `bullet ${s.kind === 'district' ? `b-${s.id}` : 'b-ink'}`, 'aria-hidden': 'true' }, s.letter);
  const t = h('div');
  t.append(h('h2', { id: 'panel-title', tabindex: '-1' }, s.name));
  if (sub) t.append(h('p', {}, sub));
  head.append(b, t);
  return head;
}
const arrowSvg = (cls = '') => { const v = s_('svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true', class: cls }); s_('path', { d: 'M3 8h10M9 4l4 4-4 4' }, v); return v; };
const extSvg = () => { const v = s_('svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true' }); s_('path', { d: 'M5 11L11 5M6 5h5v5' }, v); return v; };

function renderPanel(s) {
  panelIn.textContent = '';
  if (s.kind === 'origin') {
    panelIn.append(sign(s, 'Mid-2024 · where the first line of code was written'));
    panelIn.append(h('p', { class: 'p-big' }, KY.person.name));
    panelIn.append(h('p', { class: 'p-lede' }, `${KY.person.line} ${KY.person.short}`));
    const a = h('div', { class: 'p-actions' });
    const ride = h('button', { class: 'btn btn-ink', type: 'button' }, 'Ride to Software');
    ride.append(arrowSvg());
    ride.addEventListener('click', () => go(1));
    const pass = h('button', { class: 'btn btn-line', type: 'button' }, 'Show my pass');
    pass.addEventListener('click', (e) => openPass(e.currentTarget));
    a.append(ride, pass);
    panelIn.append(a);
    const lines = h('div', { class: 'p-lines', role: 'group', 'aria-label': 'Ride to a line' });
    STATIONS.filter((x) => x.kind === 'district').forEach((x) => {
      const n = KY.projects.filter((p) => p.category === x.id).length;
      const b = h('button', { type: 'button' });
      b.append(h('span', { class: `bullet b-${x.id}`, 'aria-hidden': 'true' }, x.letter), h('span', { class: 'p-l-name' }, x.name), h('span', { class: 'p-l-n' }, `${n} ${n === 1 ? 'stop' : 'stops'}`));
      b.addEventListener('click', () => go(IDX[x.id]));
      lines.append(b);
    });
    panelIn.append(lines);
    const hint = h('p', { class: 'p-hint' });
    hint.append(document.createTextNode('Pick a station on the line, or press Ride. Keys: '), h('kbd', {}, '←'), document.createTextNode(' '), h('kbd', {}, '→'));
    panelIn.append(hint);
  } else if (s.kind === 'district') {
    const list = KY.projects.filter((p) => p.category === s.id);
    const live = list.filter((p) => p.status === 'live').length;
    panelIn.append(sign(s, `${list.length} ${list.length === 1 ? 'project' : 'projects'}${live ? ` · ${live} live` : ''}`));
    const grid = h('div', { class: 'tiles' });
    list.forEach((p) => grid.append(tile(p)));
    panelIn.append(grid);
  } else if (s.id === 'timetable') {
    panelIn.append(sign(s, 'Interchange · experience, education, skills'));
    panelIn.append(timetable());
  } else if (s.id === 'news') {
    panelIn.append(sign(s, 'Interchange · Daily AI service updates'));
    panelIn.append(h('p', { class: 'p-lede' }, 'A short, sourced brief on what changed in AI, in English and 中文.'));
    panelIn.append(news());
  } else {
    panelIn.append(sign(s, 'Terminus, but the line keeps going'));
    const t = h('div', { class: 'term-sign' });
    t.append(h('p', {}, 'Next'), h('p', {}, 'Still searching.'));
    const dots = h('div', { class: 'term-dots', 'aria-hidden': 'true' });
    ['software', 'books', 'film', 'games', 'health'].forEach((id) => { const i = h('i'); i.style.background = `var(--l-${id})`; dots.append(i); });
    t.append(dots);
    panelIn.append(t);
    panelIn.append(h('p', { class: 'p-lede' }, 'Non-stop. I keep building. If you want to build something together, this is your stop.'));
    const asks = h('ul', { class: 'asks' });
    KY.contact.asks.forEach((a) => asks.append(h('li', {}, a)));
    panelIn.append(asks);
    const a = h('div', { class: 'p-actions' });
    const li = h('a', { class: 'btn btn-ink', href: KY.contact.linkedin, target: '_blank', rel: 'noopener' }, 'Message me on LinkedIn'); li.append(extSvg());
    const ph = h('a', { class: 'btn btn-line', href: KY.contact.phoneHref }, `Call ${KY.contact.phone}`);
    const pass = h('button', { class: 'btn btn-line', type: 'button' }, 'Show my pass');
    pass.addEventListener('click', (e) => openPass(e.currentTarget));
    a.append(li, ph, pass);
    if (!KY.contact.email) a.append(h('span', { class: 'btn btn-line', 'aria-disabled': 'true' }, 'Email, coming soon'));
    if (!KY.contact.x) a.append(h('span', { class: 'btn btn-line', 'aria-disabled': 'true' }, 'X, coming soon'));
    panelIn.append(a);
    const qr = h('figure', { class: 'qr' });
    qr.append(h('img', { src: KY.contact.wechatQr.replace('../../', '../../'), alt: 'WeChat QR code for Kevin Yu', width: '112', height: '112', loading: 'lazy' }), h('figcaption', {}, 'Or scan in WeChat'));
    panelIn.append(qr);
  }
}

const statusMark = (p) => {
  const v = s_('svg', { viewBox: '0 0 12 12', 'aria-hidden': 'true' });
  const c = s_('circle', { cx: 6, cy: 6, r: 4.2, 'stroke-width': 1.8 }, v);
  const col = `var(--l-${p.category})`;
  if (p.status === 'live') { c.setAttribute('fill', col); c.setAttribute('stroke', col); }
  else if (p.status === 'done') { c.setAttribute('fill', 'var(--ink)'); c.setAttribute('stroke', 'var(--ink)'); }
  else { c.setAttribute('fill', 'none'); c.setAttribute('stroke', p.status === 'parked' ? 'var(--muted)' : col); if (p.status !== 'testing') c.setAttribute('stroke-dasharray', '2 1.6'); }
  return v;
};

function tileMedia(p) {
  const box = h('div', { class: 'tile-media' });
  const c = p.cover || {};
  if (c.type === 'img') box.append(h('img', { src: c.src, alt: '', loading: 'lazy', decoding: 'async' }));
  else if (c.type === 'video') {
    if (reduce) box.append(h('img', { src: c.poster, alt: '', loading: 'lazy' }));
    else { const v = h('video', { src: c.src, poster: c.poster, muted: '', loop: '', playsinline: '', autoplay: '', 'aria-hidden': 'true' }); v.muted = true; box.append(v); v.play().catch(() => {}); }
  } else if (c.type === 'stickers') {
    const d = h('div', { class: 'stk-scene' }); d.style.backgroundImage = `url("${c.room}")`;
    const spots = [['6%', '10%'], ['60%', '14%'], ['34%', '50%'], ['68%', '56%']];
    c.stickers.forEach((src, i) => { const im = h('img', { src, alt: '', class: 'stk' }); im.style.left = spots[i % 4][0]; im.style.top = spots[i % 4][1]; im.style.animationDelay = `${0.2 + i * 0.18}s`; d.append(im); });
    box.append(d);
    box.append(h('span', { class: 'tile-cap' }, 'Game art'));
  } else if (c.type === 'mock') {
    box.append(mockSvg(c.mock));
    box.append(h('span', { class: 'tile-cap' }, 'Illustration'));
  } else {
    box.style.background = `color-mix(in srgb, var(--l-${p.category}) 14%, #fff)`;
    box.append(h('span', { class: 'tile-empty' }, 'Images soon'));
  }
  return box;
}
function tile(p) {
  const b = h('button', { class: 'tile', type: 'button', 'aria-label': `${p.title}, ${STATUS[p.status]}. Open details.` });
  b.append(tileMedia(p), h('span', { class: 'tile-t' }, SHORT[p.id] || p.title));
  const st = h('span', { class: 'tile-s' }); st.append(statusMark(p), document.createTextNode(`${STATUS[p.status]}${p.year ? ` · ${p.year}` : ''}`));
  b.append(st);
  b.addEventListener('click', () => openBoard(p.id, b));
  return b;
}

function timetable() {
  const R = KY.resume;
  const wrap = h('div', { style: 'display:grid;gap:16px' });
  const ORG = { Hirvo: 'software', 'Client work': 'software', 'Snuggle Crew': 'books' };
  const row = (r, line) => {
    const d = h('div', { class: 'tt-row' });
    d.append(h('p', { class: 'tt-when' }, r.when));
    const w = h('div');
    const role = h('p', { class: 'tt-role' });
    if (line) role.append(h('span', { class: `bullet b-${line}`, 'aria-hidden': 'true' }, LETTER[line]));
    role.append(document.createTextNode(r.role || r.org));
    w.append(role);
    if (r.role && r.org) w.append(h('p', { class: 'tt-org' }, r.org));
    if (r.note) w.append(h('p', { class: 'tt-note' }, r.note));
    d.append(w);
    return d;
  };
  const head = (a, b) => { const x = h('h3', { class: 'tt-h' }); x.append(h('span', {}, a), h('span', {}, b)); return x; };
  const ex = h('div', { class: 'tt-list' }); R.experience.forEach((r) => ex.append(row(r, r.org && r.org.startsWith('AIx') ? 'health' : ORG[r.org])));
  const ed = h('div', { class: 'tt-list' }); R.education.forEach((r) => ed.append(row({ when: r.when, role: r.org, note: r.note })));
  const sk = h('dl', { class: 'skills' }); R.skills.forEach(([k, v]) => { const d = h('div'); d.append(h('dt', {}, k), h('dd', {}, v)); sk.append(d); });
  wrap.append(head('Experience', 'Departures'), ex, head('Education', 'Origin'), ed, head('Skills', 'On board'), sk);
  return wrap;
}

let issuesCache = null;
function news() {
  const list = h('ol', { class: 'up-list' });
  const more = h('a', { class: 'btn btn-line', href: KY.newsletter.index }, 'All issues');
  const wrap = h('div', { style: 'display:grid;gap:16px;justify-items:start' });
  wrap.append(list, more);
  const fill = (issues) => {
    list.textContent = '';
    const fmt = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); };
    issues.slice(0, 6).forEach((it) => {
      const li = h('li'); const a = h('a', { href: `${KY.newsletter.index}${it.date}/` });
      const topic = it.topic ? ` · ${it.topic[0].toUpperCase()}${it.topic.slice(1)}` : '';
      a.append(h('span', { class: 'up-date' }, `${fmt(it.date)}${topic}`), h('span', { class: 'up-title' }, (it.en && it.en.title) || (it.zh && it.zh.title) || 'Daily AI'), arrowSvg('up-go'));
      li.append(a); list.append(li);
    });
    more.textContent = `All ${issues.length} issues`;
  };
  if (issuesCache) fill(issuesCache);
  else {
    list.append(h('li', { class: 'p-hint' }, 'Loading the latest issues…'));
    fetch(KY.newsletter.issues, { cache: 'no-cache' }).then((r) => r.json()).then((d) => {
      issuesCache = (d.issues || d).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
      fill(issuesCache);
    }).catch(() => { list.textContent = ''; list.append(h('li', { class: 'p-hint' }, 'The latest issues are in the archive.')); });
  }
  return wrap;
}

/* ---------- Illustrations for private or image-less work ---------- */
function mockSvg(kind) {
  const s = s_('svg', { viewBox: '0 0 640 400', class: 'mock-svg', role: 'img', 'aria-label': 'Illustration' });
  const T = (x, y, txt, a = {}) => { const t = s_('text', { x, y, 'font-size': 16, fill: '#16171a', ...a }, s); t.textContent = txt; return t; };
  if (kind === 'risk') {
    s_('rect', { x: 60, y: 40, width: 520, height: 320, rx: 14, fill: '#fff', stroke: '#C9C9C3' }, s);
    s_('rect', { x: 84, y: 64, width: 228, height: 74, rx: 10, fill: '#F1F1EC' }, s);
    s_('rect', { x: 328, y: 64, width: 228, height: 74, rx: 10, fill: '#F1F1EC' }, s);
    T(100, 100, '32,592', { 'font-size': 26, 'font-weight': 800 }); T(100, 124, 'sanctions entries checked', { 'font-size': 13, fill: '#5B5C58' });
    T(344, 100, '4 lists', { 'font-size': 26, 'font-weight': 800 }); T(344, 124, 'checked every day', { 'font-size': 13, fill: '#5B5C58' });
    [['Buyer · Germany', 'Clear', '#00933C'], ['Buyer · Chile', 'Clear', '#00933C'], ['Buyer · UAE', 'Review', '#9A6A00'], ['Buyer · Italy', 'Clear', '#00933C']].forEach(([n, st, c], i) => {
      const y = 170 + i * 44;
      s_('line', { x1: 84, x2: 556, y1: y + 22, y2: y + 22, stroke: '#E2E2DD' }, s);
      T(88, y + 6, n, { 'font-weight': 600 });
      s_('rect', { x: 470, y: y - 10, width: 84, height: 24, rx: 12, fill: c, opacity: 0.12 }, s);
      T(512, y + 7, st, { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: c });
    });
  } else if (kind === 'rx') {
    const box = (y, k, txt, hi) => {
      s_('rect', { x: 120, y, width: 400, height: 84, rx: 12, fill: '#fff', stroke: hi ? '#0039A6' : '#C9C9C3', 'stroke-width': hi ? 2 : 1 }, s);
      T(146, y + 30, k, { 'font-size': 12, fill: '#5B5C58' }); T(146, y + 60, txt, { 'font-size': 18, 'font-weight': 600 });
    };
    box(36, '1  Snap', '必理痛 Panadol   +   Paracetamol 500 mg');
    box(144, '2  Match', 'Same active ingredient: paracetamol', true);
    box(252, '3  Speak', '');
    for (let i = 0; i < 16; i++) { const hh = 8 + Math.abs(Math.sin(i * 1.7)) * 26; s_('rect', { x: 148 + i * 9, y: 312 - hh / 2, width: 5, height: hh, rx: 2, fill: '#0039A6' }, s); }
    T(310, 318, '粵語 Cantonese', { 'font-size': 16, 'font-weight': 600 });
  } else {
    const g = s_('g', { transform: 'translate(320 215)', fill: 'none', stroke: '#16171a', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, s);
    const iso = (x, y, z) => [(x - y) * 0.866, (x + y) * 0.5 - z];
    const P = (pts, a = {}) => s_('path', { d: `${dPath(pts.map((p) => iso(...p)))}Z`, ...a }, g);
    P([[-90, -60, 0], [90, -60, 0], [90, 60, 0], [-90, 60, 0]]);
    P([[-90, 60, 0], [90, 60, 0], [90, 60, 150], [-90, 60, 150]]);
    P([[90, -60, 0], [90, 60, 0], [90, 60, 150], [90, -60, 150]]);
    P([[-90, -60, 150], [90, -60, 150], [90, 60, 150], [-90, 60, 150]]);
    for (let f = 1; f < 5; f++) for (let w = 0; w < 6; w++) { const x0 = -78 + w * 28; const z0 = f * 30 - 20; P([[x0, 60, z0], [x0 + 16, 60, z0], [x0 + 16, 60, z0 + 16], [x0, 60, z0 + 16]], { stroke: '#0039A6', 'stroke-width': 1 }); }
  }
  return s;
}

/* ---------- Departure board: one project ---------- */
const board = $('[data-board]');
const boardPanel = $('[data-board-panel]');
const media = $('[data-media]');
const thumbs = $('[data-thumbs]');
let boardFrom = null;
let boardProj = null;
let boardPushed = false;

function mediaList(p) {
  const list = [];
  const c = p.cover || {};
  if (c.type === 'video' || c.type === 'stickers') list.push(c);
  (p.media || []).forEach((m) => {
    if (m.type === 'mock' && list.some((x) => x.type === 'mock' && x.mock === m.mock)) return;
    if (c.type === 'stickers' && m.type === 'img') return;
    list.push(m);
  });
  if (!list.length && c.type && c.type !== 'none') list.push(c);
  return list;
}
function showMedia(m, p) {
  media.textContent = '';
  if (!m) {
    const d = h('div'); d.style.background = `color-mix(in srgb, var(--l-${p.category}) 16%, #fff)`; media.append(d, h('span', { class: 'stage-cap' }, 'Images coming soon')); return;
  }
  if (m.type === 'img') media.append(h('img', { src: m.src, alt: m.alt || '', decoding: 'async' }));
  else if (m.type === 'video') {
    const v = h('video', { src: m.src, poster: m.poster || '', playsinline: '', muted: '', loop: '', 'aria-label': m.alt || '', class: 'is-cover' });
    v.muted = true; if (reduce) v.setAttribute('controls', ''); else { v.autoplay = true; v.play().catch(() => {}); }
    media.append(v);
  } else if (m.type === 'yt') {
    const b = h('button', { type: 'button', class: 'yt-btn', 'aria-label': `Play ${m.alt || 'video'} from YouTube` });
    b.style.backgroundImage = `url("https://i.ytimg.com/vi/${m.id}/hqdefault.jpg")`;
    const sp = h('span'); const pl = s_('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }); s_('path', { d: 'M7 4.5v15l13-7.5z' }, pl); sp.append(pl); b.append(sp);
    b.addEventListener('click', () => { media.textContent = ''; media.append(h('iframe', { src: `https://www.youtube-nocookie.com/embed/${m.id}?autoplay=1&rel=0`, title: m.alt || 'YouTube video', allow: 'autoplay; encrypted-media; picture-in-picture', allowfullscreen: '' })); });
    media.append(b);
  } else if (m.type === 'mock') { media.append(mockSvg(m.mock), h('span', { class: 'stage-cap' }, 'Illustration')); }
  else if (m.type === 'stickers') {
    const d = h('div', { class: 'stk-scene', role: 'img', 'aria-label': m.alt || '' }); d.style.backgroundImage = `url("${m.room}")`;
    const spots = [['8%', '12%'], ['62%', '18%'], ['36%', '52%'], ['70%', '58%']];
    m.stickers.forEach((src, i) => { const im = h('img', { src, alt: '', class: 'stk' }); im.style.left = spots[i % 4][0]; im.style.top = spots[i % 4][1]; im.style.animationDelay = `${0.15 + i * 0.18}s`; d.append(im); });
    media.append(d, h('span', { class: 'stage-cap' }, 'Game art'));
  }
}
function openBoard(id, from, opts = {}) {
  const p = projById[id];
  if (!p) return;
  boardProj = p;
  const line = p.category;
  const bul = $('[data-bullets]'); bul.textContent = '';
  bul.append(h('span', { class: `bullet b-${line}`, 'aria-hidden': 'true' }, LETTER[line]));
  $('[data-title]').textContent = p.title;
  const st = $('[data-status]'); st.textContent = '';
  st.append(h('b', {}, STATUS[p.status]), document.createTextNode(` · ${catName[line]} line${p.year ? ` · ${p.year}` : ''}`));
  $('[data-role]').textContent = p.role || '';
  const body = $('[data-body]'); body.textContent = ''; (p.body || []).forEach((t) => body.append(h('p', {}, t)));
  const facts = $('[data-facts]'); facts.textContent = ''; facts.style.setProperty('--fact', `var(--l-${line})`); (p.facts || []).forEach((f) => facts.append(h('li', {}, f)));
  const links = $('[data-links]'); links.textContent = '';
  (p.links || []).forEach((l, i) => { const a = h('a', { class: `btn ${i ? 'btn-line' : 'btn-ink'}`, href: l.href, target: '_blank', rel: 'noopener' }, l.label); a.append(extSvg()); links.append(a); });
  const list = mediaList(p);
  thumbs.textContent = '';
  const pick = (k) => { $$('button', thumbs).forEach((t, j) => t.setAttribute('aria-pressed', String(j === k))); showMedia(list[k], p); };
  if (list.length > 1) list.forEach((m, k) => {
    const t = h('button', { type: 'button', 'aria-label': `Show ${m.alt || `item ${k + 1}`}`, 'aria-pressed': 'false' });
    const src = m.type === 'img' ? m.src : m.type === 'video' ? m.poster : m.type === 'yt' ? `https://i.ytimg.com/vi/${m.id}/mqdefault.jpg` : m.type === 'stickers' ? m.room : null;
    if (src) t.style.backgroundImage = `url("${src}")`; else { t.classList.add('th-mock'); t.textContent = 'Sketch'; }
    t.addEventListener('click', () => pick(k)); thumbs.append(t);
  });
  pick(0);
  if (!opts.fromHash && location.hash !== `#/${id}`) { history.pushState(null, '', `#/${id}`); boardPushed = true; }
  if (!board.hidden) return;
  boardFrom = from || document.activeElement;
  board.hidden = false;
  doc.style.overflow = 'hidden';
  if (scene) scene.pause();
  if (motion) {
    G.fromTo(boardPanel, phone.matches ? { yPercent: 100 } : { xPercent: 100 }, { xPercent: 0, yPercent: 0, duration: 0.6, ease: 'expo.out' });
    G.fromTo('.board-scrim', { opacity: 0 }, { opacity: 1, duration: 0.4 });
  }
  $('.board-close').focus({ preventScroll: true });
}
function closeBoard(opts = {}) {
  if (board.hidden) return;
  const done = () => { board.hidden = true; media.textContent = ''; doc.style.overflow = ''; if (scene) scene.resume(); boardFrom?.focus?.({ preventScroll: true }); };
  if (!opts.fromHash) {
    if (boardPushed) { boardPushed = false; history.back(); } else history.replaceState(null, '', `#/station/${STATIONS[cur].id}`);
  }
  if (motion) { G.to(boardPanel, { ...(phone.matches ? { yPercent: 100 } : { xPercent: 100 }), duration: 0.4, ease: 'power3.in', onComplete: done }); G.to('.board-scrim', { opacity: 0, duration: 0.35 }); }
  else done();
}
$$('[data-close]', board).forEach((b) => b.addEventListener('click', () => closeBoard()));
const trap = (root, e) => {
  if (e.key !== 'Tab') return;
  const f = $$('button:not([disabled]), a[href], iframe, video[controls]', root).filter((n) => n.offsetParent !== null);
  if (!f.length) return;
  const first = f[0]; const last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
};
board.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closeBoard(); } else trap(boardPanel, e); });

/* ---------- The metro pass ---------- */
const pass = $('[data-pass]');
const card = $('[data-pass-card]');
const passNote = $('[data-pass-note]');
const flipBtn = $('[data-pass-flip]');
let passFrom = null;
function openPass(from) {
  passFrom = from || document.activeElement;
  pass.hidden = false;
  card.classList.remove('is-added');
  passNote.textContent = '';
  doc.style.overflow = 'hidden';
  if (motion) G.fromTo('.pass', { y: 40, rotateX: 25, opacity: 0 }, { y: 0, rotateX: 0, opacity: 1, duration: 0.8, ease: 'expo.out', clearProps: 'transform,opacity' });
  flipBtn.focus({ preventScroll: true });
}
function closePass() { pass.hidden = true; doc.style.overflow = ''; card.classList.remove('is-flipped'); flipBtn.setAttribute('aria-pressed', 'false'); passFrom?.focus?.({ preventScroll: true }); }
$('[data-pass-open]').addEventListener('click', (e) => openPass(e.currentTarget));
$$('[data-pass-close]').forEach((b) => b.addEventListener('click', closePass));
flipBtn.addEventListener('click', () => { const on = card.classList.toggle('is-flipped'); flipBtn.setAttribute('aria-pressed', String(on)); });
$('[data-pass-add]').addEventListener('click', () => {
  card.classList.remove('is-tap'); void card.offsetWidth; card.classList.add('is-tap', 'is-added');
  card.classList.remove('is-flipped'); flipBtn.setAttribute('aria-pressed', 'false');
  passNote.textContent = 'Saved kevin-yu.vcf. Open it to add Kevin to your contacts.';
});
$('[data-pass-copy]').addEventListener('click', async () => {
  const url = 'https://kevinpeiyuanyu.com';
  try { await navigator.clipboard.writeText(url); passNote.textContent = 'Link copied: kevinpeiyuanyu.com'; }
  catch (e) { passNote.textContent = `Copy this link: ${url}`; }
});
pass.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closePass(); } else trap($('.pass-wrap'), e); });
if (window.matchMedia('(pointer: fine)').matches && !reduce) {
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    card.classList.add('is-tilting');
    card.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width) - 0.5) * 16}deg`);
    card.style.setProperty('--rx', `${(0.5 - ((e.clientY - r.top) / r.height)) * 12}deg`);
  });
  card.addEventListener('pointerleave', () => { card.classList.remove('is-tilting'); card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
}
card.addEventListener('click', (e) => { if (e.target.closest('a')) return; flipBtn.click(); });

/* ---------- Keys and links ---------- */
addEventListener('keydown', (e) => {
  if (!board.hidden || !pass.hidden) return;
  if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); go(Math.min(STATIONS.length - 1, target + 1)); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); go(Math.max(0, target - 1)); }
});
$('.brand').addEventListener('click', (e) => { e.preventDefault(); go(0); });
$('.skip').addEventListener('click', (e) => { e.preventDefault(); panel.focus(); });

function route(fromHash) {
  const m = location.hash.match(/^#\/(station\/)?([\w-]+)$/);
  if (!m) { if (!board.hidden) closeBoard({ fromHash: true }); return null; }
  if (m[1]) {
    if (!board.hidden) closeBoard({ fromHash: true });
    return { station: IDX[m[2]] ?? 0 };
  }
  const p = projById[m[2]];
  if (!p) return null;
  return { station: IDX[p.category] ?? 0, project: p.id };
}
addEventListener('hashchange', () => {
  const r = route(true);
  if (!r) return;
  if (r.project) { if (r.station !== target) go(r.station); openBoard(r.project, null, { fromHash: true }); }
  else if (r.station !== target) go(r.station);
});

/* ---------- Boot: the 3D city when WebGL works, the flat diagram when it doesn't ---------- */
function webglOK() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
  catch (e) { return false; }
}
function offsetForPanel() {
  if (!scene) return;
  scene.setViewOffset(phone.matches ? 0 : panel.offsetWidth + 24);
}
async function boot() {
  const stage = $('[data-stage]');
  const r = route();
  const start = r ? r.station : 0;
  if (webglOK()) {
    try {
      const { createScene } = await import('./scene.js');
      scene = createScene(stage, {
        stations: STATIONS, reduce,
        onPick: (i) => go(i),
        onProgress: (f) => placeHudTrain(f),
      });
      offsetForPanel();
      addEventListener('resize', offsetForPanel);
    } catch (e) { console.warn('3D city unavailable, showing the line diagram instead.', e); scene = null; }
  }
  if (!scene) {
    const { renderFallback } = await import('./fallback.js');
    renderFallback(stage, {
      KY, when: WHEN, short: SHORT, status: STATUS,
      onStation: (p) => { go(IDX[p.category]); openBoard(p.id); },
    });
  }
  cx = centers();
  cur = start; target = start; visited = start;
  if (scene) await scene.goTo(start, { instant: true });
  arrive(start, { instant: true, quiet: true });
  history.replaceState(null, '', r && r.project ? `#/${r.project}` : `#/station/${STATIONS[start].id}`);
  if (r && r.project) openBoard(r.project, null, { fromHash: true });
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot); else boot();
