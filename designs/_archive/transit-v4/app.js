/* Kevin Metro · interface
   Buy a ticket, board, ride, arrive, read. The ticket machine, the line diagram and every panel are
   real HTML controls; the 3D city follows them. Facts come from ../shared/content.js. */
const KY = window.KY;
const G = window.gsap;
const doc = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const phone = window.matchMedia('(max-width: 760px)');
const NS = 'http://www.w3.org/2000/svg';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const h = (tag, attrs = {}, text) => { const n = document.createElement(tag); for (const k in attrs) { if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k]); } if (text != null) n.textContent = text; return n; };
const sv = (tag, attrs = {}, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
const icon = (d) => { const s = sv('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }); sv('path', { d }, s); return s; };
const LINE_HEX = 0x0039a6;
if (G) G.ticker.lagSmoothing(0); // keep UI motion on real time even when the 3D scene is busy
const WHEN = { uhome: 2025.5, books: 2025.85, hirvo: 2026.05, yae: 2026.2, duiyao: 2026.3, influencers: 2026.45, trade: 2026.6, hackathons: 2026.65, party: 2026.7, ipad: 2026.75, court: 2026.8, noir: 2026.82, stickers: 2027.05, pindou: 2027.12 };
const SHORT = { trade: 'Export risk tool', court: 'Court booking', books: 'Snuggle Crew books', ipad: 'iPad coloring app', duiyao: '對藥', pindou: '拼豆 store' };

const STATUS = { live: 'Live', testing: 'In testing', building: 'Building', done: 'Done', parked: 'Planned' };
const CAT = Object.fromEntries(KY.categories.map((c) => [c.id, c.label]));
const projById = Object.fromEntries(KY.projects.map((p) => [p.id, p]));

/* ---------- the K Line: a loop of stations, and the places you can buy a ticket to ---------- */
const STATIONS = [
  { id: 'university', code: 'K01', name: 'University', zh: '大学', note: 'Kevin, mid-2024: the first line of code' },
  { id: 'downtown', code: 'K02', name: 'Downtown', zh: '市中心' },
  { id: 'medical', code: 'K03', name: 'Medical Centre', zh: '医疗中心' },
  { id: 'harbour', code: 'K04', name: 'Harbour', zh: '港口' },
  { id: 'oldtown', code: 'K05', name: 'Old Town', zh: '老城' },
  { id: 'cinema', code: 'K06', name: 'Cinema Row', zh: '影院街' },
  { id: 'arcade', code: 'K07', name: 'Arcade Street', zh: '游戏街' },
  { id: 'sports', code: 'K08', name: 'Sports Park', zh: '体育公园' },
  { id: 'nonstop', code: 'K09', name: 'Non-stop', zh: '不停站', note: 'Still searching. The loop never ends.' },
];
const SIDX = Object.fromEntries(STATIONS.map((s, i) => [s.id, i]));
const DEST = [
  { id: 'hirvo', name: 'Hirvo HQ', short: 'Hirvo', station: 'downtown', landmark: 'hirvo', color: 'software', projects: ['hirvo'] },
  { id: 'port', name: 'Export Terminal', short: 'Export tool', station: 'harbour', landmark: 'port', color: 'software', projects: ['trade'] },
  { id: 'courts', name: 'Sports Hall', short: 'Court booking', station: 'sports', landmark: 'courts', color: 'software', projects: ['court'] },
  { id: 'uhome', name: 'UHOME Apartments', short: 'UHOME', station: 'university', landmark: 'uhome', color: 'software', projects: ['uhome'] },
  { id: 'snuggle', name: 'Snuggle Crew Books', short: 'Books', station: 'oldtown', landmark: 'books', color: 'books', projects: ['books'] },
  { id: 'studio', name: 'Kids’ Coloring Studio', short: 'iPad app', station: 'oldtown', landmark: 'studio', color: 'books', projects: ['ipad'] },
  { id: 'cinema', name: 'The Picture House', short: 'Films', station: 'cinema', landmark: 'cinema', color: 'film', projects: ['yae', 'noir', 'influencers'] },
  { id: 'arcade', name: 'The Arcade', short: 'Games', station: 'arcade', landmark: 'arcade', color: 'games', projects: ['stickers', 'party', 'pindou'] },
  { id: 'clinic', name: 'Medical Centre', short: '對藥 · health AI', station: 'medical', landmark: 'clinic', color: 'health', projects: ['duiyao', 'hackathons'] },
  { id: 'campus', name: 'University', short: 'Résumé', station: 'university', landmark: 'campus', color: 'ink', panel: 'timetable', label: 'Résumé and education' },
  { id: 'dailyai', name: 'Daily AI Building', short: 'Newsletter', station: 'downtown', landmark: 'news', color: 'ink', panel: 'news', label: 'Service updates' },
  { id: 'nonstop', name: 'Non-stop Observatory', short: 'Contact', station: 'nonstop', landmark: 'nonstop', color: 'ink', panel: 'terminus', label: 'Still searching. Get in touch' },
];
const DID = Object.fromEntries(DEST.map((d) => [d.id, d]));
const destOfProject = (pid) => DEST.find((d) => (d.projects || []).includes(pid));
const READ_ORDER = DEST.flatMap((d) => d.projects || []);
const GROUPS = [
  { label: 'Work', items: ['hirvo', 'port', 'courts', 'clinic', 'snuggle', 'studio', 'cinema', 'arcade', 'uhome'] },
  { label: 'About me', items: ['campus', 'dailyai'] },
  { label: 'Contact', items: ['nonstop'] },
];

let city = null;
let cur = 0;
let riding = false;
let selected = null;
let ticketNo = 1000 + Math.floor(Math.random() * 8000);

/* ---------- line diagram: a racetrack, stations along the top, the line returning underneath ---------- */
const hud = $('[data-hud]'); const hudTrain = $('[data-hud-train]');
const hudSvg = sv('svg', { class: 'hud-loop', 'aria-hidden': 'true' }); const hudPath = sv('path', {}, hudSvg); hud.prepend(hudSvg);
const stops = STATIONS.map((s, i) => {
  const li = h('div', { class: 'hud-stop' });
  const b = h('button', { type: 'button', 'aria-label': `Ride to ${s.code} ${s.name}` });
  b.append(h('span', { class: 'hud-dot', 'aria-hidden': 'true' }, s.code), h('span', { class: 'hud-name' }, s.name));
  b.addEventListener('click', () => quickRide(i));
  li.append(b); hud.append(li); return li;
});
let cx = []; const HUD_TOP = 28; let hudBot = 74; let lastF = 0;
const centers = () => stops.map((li) => li.offsetLeft + li.offsetWidth / 2);
function drawHud() {
  cx = centers(); if (!cx.length) return;
  hudBot = hud.clientHeight - 9; const r = (hudBot - HUD_TOP) / 2; const x0 = cx[0]; const xN = cx[cx.length - 1];
  hudSvg.setAttribute('width', hud.scrollWidth); hudSvg.setAttribute('height', hud.clientHeight);
  hudPath.setAttribute('d', `M${x0} ${HUD_TOP} H${xN} A${r} ${r} 0 0 1 ${xN} ${hudBot} H${x0} A${r} ${r} 0 0 1 ${x0} ${HUD_TOP}`);
}
function placeHud(f) {
  lastF = f;
  if (!cx.length) drawHud(); if (!cx.length) return;
  const n = STATIONS.length; f = ((f % n) + n) % n;
  const i = Math.floor(f); const t = f - i; let x; let y = HUD_TOP; let back = false;
  if (i < n - 1) x = cx[i] + (cx[i + 1] - cx[i]) * t;
  else {
    // K09 back to K01: round the end, along the bottom, round again
    const r = (hudBot - HUD_TOP) / 2; const x0 = cx[0]; const xN = cx[n - 1]; const arc = Math.PI * r; const total = 2 * arc + (xN - x0); let d = t * total;
    if (d < arc) { const a = d / r; x = xN + r * Math.sin(a); y = HUD_TOP + r - r * Math.cos(a); }
    else if ((d -= arc) < xN - x0) { x = xN - d; y = hudBot; back = true; }
    else { const a = (d - (xN - x0)) / r; x = x0 - r * Math.sin(a); y = hudBot - r + r * Math.cos(a); back = true; }
  }
  hudTrain.style.transform = `translate(${x.toFixed(1)}px, ${(y - HUD_TOP).toFixed(1)}px)${back ? ' scaleX(-1)' : ''}`;
  const bar = $('[data-ride-progress]'); if (bar && rideFrom != null) { const span = ((rideTo - rideFrom + n) % n) || n; bar.style.setProperty('--p', Math.min(1, Math.max(0, (((f - rideFrom) + n) % n) / span))); }
}
function markHud() { stops.forEach((li, k) => { const b = $('button', li); if (k === cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); }); }
addEventListener('resize', () => { drawHud(); placeHud(lastF); });

/* ---------- top bar ---------- */
const now = $('[data-now]');
const setNow = (lead, name) => { now.textContent = ''; now.append(document.createTextNode(`${lead} `), h('b', {}, name)); };
$('[data-overview]').addEventListener('click', () => { if (city) { city.view('overview'); setFollow(false); } });
const followBtn = $('[data-follow]');
const setFollow = (on) => { followBtn.setAttribute('aria-pressed', String(on)); };
followBtn.addEventListener('click', () => { if (!city) return; city.view(riding ? 'ride' : city.moving() ? 'follow' : 'platform'); setFollow(true); });
$('[data-home]').addEventListener('click', (e) => { e.preventDefault(); quickRide(0); });

/* ---------- ticket machine: the full list, or a compact pill once you have a destination ---------- */
const tvm = $('[data-tvm]'); const tvmBody = $('[data-tvm-body]');
const pill = h('div', { class: 'tvm-pill', 'aria-live': 'polite' }); tvm.append(pill);
const ticketSlot = h('div', { class: 'tvm-ticket', 'aria-hidden': 'true' }); tvm.append(ticketSlot);
const setStep = (n) => $$('.tvm-steps li', tvm).forEach((li) => li.classList.toggle('is-on', +li.dataset.step <= n));
const setTvm = (state) => { tvm.dataset.state = state; if (city && !phone.matches && pop.hidden) city.setViewOffset(state === 'full' ? Math.round(tvm.offsetWidth * 0.9) : 0, 'left'); };
const bulletFor = (d) => h('span', { class: `cbul c-${d.color}`, 'aria-hidden': 'true' });
const collapseBtn = h('button', { type: 'button', class: 'icon-btn tvm-collapse', 'aria-label': 'Collapse the ticket machine' }); collapseBtn.append(icon('M6 9l6 6 6-6'));
collapseBtn.addEventListener('click', () => (selected ? tvmTicket() : pillIdle()));
$('.tvm-head', tvm).append(collapseBtn);
const expandBtn = () => { const b = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Open the ticket machine' }); b.append(icon('M6 15l6-6 6 6')); b.addEventListener('click', () => tvmPick()); return b; };

function tvmPick() {
  setStep(1); setTvm('full'); ticketSlot.textContent = '';
  tvmBody.textContent = '';
  tvmBody.append(h('p', { class: 'tvm-lede' }, 'Where to? Pick a place in Kevin’s city.'));
  GROUPS.forEach((g) => {
    const box = h('div', { class: 'tvm-group', role: 'group', 'aria-label': g.label });
    box.append(h('p', { class: 'tvm-glabel' }, g.label));
    const grid = h('div', { class: 'tvm-grid' });
    g.items.forEach((id) => {
      const d = DID[id]; const st = STATIONS[SIDX[d.station]];
      const b = h('button', { type: 'button', class: 'dest-btn', 'aria-label': `${d.name}, ${st.code} ${st.name}${d.label ? `, ${d.label}` : ''}` });
      const txt = h('span', { class: 'dest-txt' }); txt.append(h('b', {}, d.name), h('span', {}, d.label || CAT[d.color] || st.name));
      b.append(h('span', { class: 'kcode', 'aria-hidden': 'true' }, st.code), txt, bulletFor(d));
      b.dataset.si = SIDX[d.station];
      b.addEventListener('click', () => { selected = d; tvmTicket(); if (city) city.view('dest', { focus: d.focus }); });
      grid.append(b);
    });
    box.append(grid); tvmBody.append(box);
  });
  markHere();
}
function markHere() {
  const moving = !!(city && city.moving());
  $$('.dest-btn', tvm).forEach((b) => { const on = +b.dataset.si === cur && !riding && !moving; b.classList.toggle('is-here', on); if (on) b.setAttribute('aria-current', 'location'); else b.removeAttribute('aria-current'); });
}
function pillIdle() {
  setTvm('pill'); ticketSlot.textContent = ''; pill.textContent = '';
  const b = h('button', { type: 'button', class: 'pill-main' }); b.append(h('span', { class: 'roundel roundel-sm', 'aria-hidden': 'true' }, 'K'), h('span', { class: 'pill-txt' }, 'Buy a ticket: where to?'));
  b.addEventListener('click', tvmPick);
  pill.append(b, expandBtn());
}
function pillHead(d, st) { const t = h('span', { class: 'pill-txt' }); t.append(h('b', {}, d ? d.name : st.name), h('span', {}, `${st.code} ${st.name}`)); return t; }
function tvmTicket() {
  setStep(2); setTvm('pill'); ticketSlot.textContent = '';
  const d = selected; const st = STATIONS[SIDX[d.station]]; const here = SIDX[d.station] === cur && !riding;
  pill.textContent = '';
  const get = h('button', { type: 'button', class: 'btn btn-ink btn-sm' }, here ? 'Open' : 'Get ticket');
  get.addEventListener('click', () => { if (here) openPop(SIDX[d.station], d.id); else printTicket(d, st, STATIONS[cur]); });
  pill.append(h('span', { class: 'kcode', 'aria-hidden': 'true' }, st.code), pillHead(d, st), get, expandBtn());
  get.focus({ preventScroll: true });
}
let autoBoard = null;
function printTicket(d, st, from, auto) {
  setStep(3); clearTimeout(autoBoard); setTvm('pill');
  ticketNo += 1;
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const t = h('div', { class: 'ticket', role: 'img', 'aria-label': `Ticket ${ticketNo}: ${from.name} to ${st.name}, Kevin Metro K Line, ${date}` });
  const top = h('div', { class: 'tk-top' }); top.append(h('span', { class: 'roundel roundel-sm' }, 'K'), h('b', {}, 'Kevin Metro'), h('span', { class: 'tk-no' }, `No. ${ticketNo}`));
  const mid = h('div', { class: 'tk-mid' });
  const a = h('div'); a.append(h('span', {}, 'From'), h('b', {}, `${from.code} ${from.name}`));
  const b = h('div'); b.append(h('span', {}, 'To'), h('b', {}, `${st.code} ${st.name}`));
  mid.append(a, b);
  const bot = h('div', { class: 'tk-bot' }); bot.append(h('span', {}, d.name), h('span', {}, date), h('span', {}, 'Fare: free'));
  t.append(top, mid, bot, h('i', { class: 'tk-band', 'aria-hidden': 'true' }));
  ticketSlot.textContent = ''; ticketSlot.append(t); ticketSlot.removeAttribute('aria-hidden');
  if (G && !reduce) G.fromTo(t, { y: 40, clipPath: 'inset(100% 0 0 0)' }, { y: 0, clipPath: 'inset(0% 0 0 0)', duration: 0.9, ease: 'power2.out' });
  pill.textContent = '';
  const board = h('button', { type: 'button', class: 'btn btn-ink btn-sm' }); board.append(document.createTextNode('Board'), icon('M9 5l7 7-7 7'));
  board.addEventListener('click', () => ride(SIDX[d.station], d.id));
  pill.append(h('span', { class: 'kcode', 'aria-hidden': 'true' }, st.code), pillHead(d, st), board, expandBtn());
  board.focus({ preventScroll: true });
  if (auto) autoBoard = setTimeout(() => ride(SIDX[d.station], d.id), reduce ? 300 : 1500);
}

let rideFrom = null; let rideTo = null;
function tvmRiding(st) {
  setTvm('pill'); ticketSlot.textContent = ''; pill.textContent = '';
  const t = h('span', { class: 'pill-txt' }); t.append(h('b', {}, `Next stop: ${st.name}`), h('span', {}, selected ? selected.name : st.code));
  const bar = h('span', { class: 'ride-bar', 'data-ride-progress': '' }); bar.append(h('i'));
  t.append(bar);
  const skip = h('button', { type: 'button', class: 'btn btn-line btn-sm' }, 'Skip'); skip.addEventListener('click', () => city && city.skip());
  pill.append(h('span', { class: 'kcode', 'aria-hidden': 'true' }, st.code), t, skip);
}

/* ---------- riding: always forward round the loop ---------- */
let rideSeq = 0;
async function ride(i, destId, opts = {}) {
  if (i < 0 || i >= STATIONS.length) return;
  const st = STATIONS[i];
  clearTimeout(autoBoard); idle.stop();
  closePop(true);
  if (i === cur && !riding && !(city && city.moving())) { openPop(i, destId); return; }
  const seq = ++rideSeq;
  riding = true; rideFrom = lastF; rideTo = i;
  setNow('Riding to', `${st.code} ${st.name}`);
  tvmRiding(st);
  history.replaceState(null, '', `#/station/${st.id}`);
  if (city) { city.highlight(-1); city.view('ride'); setFollow(true); const ok = await city.goTo(i, opts); if (!ok || seq !== rideSeq) return; } else placeHud(i);
  riding = false; cur = i; rideFrom = null;
  markHud(); placeHud(i);
  setNow('Now at', `${st.code} ${st.name}`);
  if (city) { city.highlight(i); city.view('platform'); }
  setTimeout(() => { if (seq === rideSeq && !riding) openPop(i, destId); }, reduce || !city ? 0 : 1300);
}
function quickRide(i) { const d = DEST.find((x) => x.station === STATIONS[i].id); selected = d || null; ride(i, d && d.id); }

/* ---------- idle: after a quiet moment the train carries on round the loop by itself ---------- */
const idle = (() => {
  let t = null;
  const quiet = () => !riding && pop.hidden && read.hidden && pass.hidden;
  const arm = () => { clearTimeout(t); if (!city || reduce) return; t = setTimeout(() => { if (quiet()) { city.cruise(true); if (city.mode() === 'platform') city.view('follow'); } else arm(); }, 7000); };
  return { arm, stop() { clearTimeout(t); if (city) city.cruise(false); } };
})();
['pointerdown', 'keydown', 'wheel'].forEach((ev) => addEventListener(ev, () => { if (city && !riding) idle.arm(); }, { passive: true }));

/* ---------- arrival board ---------- */
const pop = $('[data-pop]'); const popBody = $('[data-pop-body]');
let popStation = null;
function openPop(i, destId) {
  const st = STATIONS[i]; popStation = i; idle.stop();
  $('[data-pop-code]').textContent = st.code;
  $('[data-pop-title]').textContent = `${st.name} · ${st.zh}`;
  $('[data-pop-sub]').textContent = st.note ? `Arrived. ${st.note}` : 'Arrived. Doors open.';
  popBody.textContent = '';
  const here = DEST.filter((d) => d.station === st.id).sort((a, b) => (a.id === destId ? -1 : b.id === destId ? 1 : 0));
  here.forEach((d) => popBody.append(destSection(d)));
  pop.hidden = false; tvm.dataset.state = 'hidden';
  if (!phone.matches && city) city.setViewOffset(Math.min(560, innerWidth * 0.4));
  if (G && !reduce) G.fromTo(pop, phone.matches ? { yPercent: 30, opacity: 0 } : { x: 40, opacity: 0 }, { x: 0, yPercent: 0, opacity: 1, duration: 0.7, ease: 'expo.out', clearProps: 'transform,opacity' });
  $('[data-pop-title]').focus({ preventScroll: true });
  const first = here[0]; if (first && city && first.focus) city.view('dest', { focus: first.focus });
}
function closePop(silent) { if (pop.hidden) return; pop.hidden = true; if (city) city.setViewOffset(0); if (!silent) { pillIdle(); if (city) city.view('platform'); idle.arm(); } }
$('[data-pop-close]').addEventListener('click', () => closePop());
pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closePop(); pill.querySelector('button')?.focus(); } });

function destSection(d) {
  const sec = h('section', { class: 'dsec' });
  const head = h('header', { class: 'dsec-head' });
  head.append(bulletFor(d), h('h3', {}, d.name));
  if (city && d.focus) { const look = h('button', { type: 'button', class: 'link-btn' }, 'Look at it'); look.addEventListener('click', () => city.view('dest', { focus: d.focus })); head.append(look); }
  sec.append(head);
  if (d.projects) {
    const [first, ...rest] = d.projects.map((pid) => projById[pid]).filter(Boolean);
    if (first) {
      const lead = h('button', { type: 'button', class: 'lead', 'aria-label': `${first.title}, ${STATUS[first.status]}. Read more.` });
      lead.append(coverEl(first, true));
      const cap = h('span', { class: 'lead-cap' });
      const st = h('span', { class: 'tile-s' }); st.append(statusMark(first), document.createTextNode(`${STATUS[first.status]}${first.year ? ` · ${first.year}` : ''}`));
      cap.append(h('b', {}, first.title), h('span', { class: 'lead-one' }, first.one), st);
      lead.append(cap);
      lead.addEventListener('click', () => openRead(first.id, lead));
      sec.append(lead);
    }
    if (rest.length) { const grid = h('div', { class: 'tiles' }); rest.forEach((p) => grid.append(tile(p))); sec.append(grid); }
  } else if (d.panel === 'timetable') sec.append(timetable());
  else if (d.panel === 'news') sec.append(news());
  else if (d.panel === 'terminus') sec.append(terminus());
  return sec;
}

const statusMark = (p) => {
  const v = sv('svg', { viewBox: '0 0 12 12', 'aria-hidden': 'true' }); const c = sv('circle', { cx: 6, cy: 6, r: 4.2, 'stroke-width': 1.8 }, v);
  const col = `var(--l-${p.category})`;
  if (p.status === 'live') { c.setAttribute('fill', col); c.setAttribute('stroke', col); }
  else if (p.status === 'done') { c.setAttribute('fill', 'var(--ink)'); c.setAttribute('stroke', 'var(--ink)'); }
  else { c.setAttribute('fill', 'none'); c.setAttribute('stroke', p.status === 'parked' ? 'var(--muted)' : col); if (p.status !== 'testing') c.setAttribute('stroke-dasharray', '2 1.6'); }
  return v;
};
function coverEl(p, big) {
  const box = h('div', { class: big ? 'stage-media' : 'tile-media' });
  const c = p.cover || {};
  if (c.type === 'img') box.append(h('img', { src: c.src, alt: big ? (c.alt || '') : '', loading: 'lazy', decoding: 'async' }));
  else if (c.type === 'video') { if (reduce) box.append(h('img', { src: c.poster, alt: '' })); else { const v = h('video', { src: c.src, poster: c.poster, muted: '', loop: '', playsinline: '', autoplay: '', 'aria-hidden': 'true' }); v.muted = true; box.append(v); v.play().catch(() => {}); } }
  else if (c.type === 'stickers') { box.append(stickerScene(c)); box.append(h('span', { class: 'cap' }, 'Game art')); }
  else if (c.type === 'mock') { box.append(mockSvg(c.mock)); box.append(h('span', { class: 'cap' }, 'Illustration')); }
  else { box.style.background = `color-mix(in srgb, var(--l-${p.category}) 14%, #fff)`; box.append(h('span', { class: 'tile-empty' }, 'Images soon')); }
  return box;
}
function stickerScene(c) {
  const d = h('div', { class: 'stk-scene' }); d.style.backgroundImage = `url("${c.room}")`;
  const spots = [['6%', '10%'], ['60%', '14%'], ['34%', '50%'], ['68%', '56%']];
  c.stickers.forEach((src, i) => { const im = h('img', { src, alt: '', class: 'stk' }); im.style.left = spots[i % 4][0]; im.style.top = spots[i % 4][1]; im.style.animationDelay = `${0.2 + i * 0.18}s`; d.append(im); });
  return d;
}
function tile(p) {
  const b = h('button', { type: 'button', class: 'tile', 'aria-label': `${p.title}, ${STATUS[p.status]}. Read more.` });
  b.append(coverEl(p, false));
  const t = h('span', { class: 'tile-t' }, p.title);
  const s = h('span', { class: 'tile-s' }); s.append(statusMark(p), document.createTextNode(`${STATUS[p.status]}${p.year ? ` · ${p.year}` : ''}`));
  b.append(t, s, h('span', { class: 'tile-one' }, p.one));
  b.addEventListener('click', () => openRead(p.id, b));
  return b;
}

/* ---------- timetable, service updates, terminus ---------- */
function timetable() {
  const R = KY.resume; const wrap = h('div', { class: 'stack' });
  const row = (r) => { const d = h('div', { class: 'tt-row' }); d.append(h('p', { class: 'tt-when' }, r.when)); const w = h('div'); w.append(h('p', { class: 'tt-role' }, r.role || r.org)); if (r.role && r.org) w.append(h('p', { class: 'tt-org' }, r.org)); if (r.note) w.append(h('p', { class: 'tt-note' }, r.note)); d.append(w); return d; };
  const head = (a, b) => { const x = h('h4', { class: 'tt-h' }); x.append(h('span', {}, a), h('span', {}, b)); return x; };
  const ex = h('div'); R.experience.forEach((r) => ex.append(row(r)));
  const ed = h('div'); R.education.forEach((r) => ed.append(row({ when: r.when, role: r.org, note: r.note })));
  const sk = h('dl', { class: 'skills' }); R.skills.forEach(([k, v]) => { const x = h('div'); x.append(h('dt', {}, k), h('dd', {}, v)); sk.append(x); });
  wrap.append(head('Experience', 'Departures'), ex, head('Education', 'Origin'), ed, head('Skills', 'On board'), sk);
  return wrap;
}
let issues = null;
function news() {
  const wrap = h('div', { class: 'stack' }); const list = h('ol', { class: 'up-list' }); const more = h('a', { class: 'btn btn-line', href: KY.newsletter.index }, 'All issues');
  wrap.append(h('p', { class: 'muted' }, 'Daily AI: a short, sourced brief on what changed in AI, in English and 中文.'), list, more);
  const fmt = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); };
  const fill = (all) => { list.textContent = ''; all.slice(0, 6).forEach((it) => { const li = h('li'); const a = h('a', { href: `${KY.newsletter.index}${it.date}/` }); a.append(h('span', { class: 'up-date' }, `${fmt(it.date)}${it.topic ? ` · ${it.topic[0].toUpperCase()}${it.topic.slice(1)}` : ''}`), h('span', { class: 'up-title' }, (it.en && it.en.title) || (it.zh && it.zh.title) || 'Daily AI')); li.append(a); list.append(li); }); more.textContent = `All ${all.length} issues`; };
  if (issues) fill(issues);
  else { list.append(h('li', { class: 'muted' }, 'Loading the latest issues…')); fetch(KY.newsletter.issues, { cache: 'no-cache' }).then((r) => r.json()).then((d) => { issues = (d.issues || d).slice().sort((a, b) => (a.date < b.date ? 1 : -1)); fill(issues); }).catch(() => { list.textContent = ''; list.append(h('li', { class: 'muted' }, 'The latest issues are in the archive.')); }); }
  return wrap;
}
function terminus() {
  const wrap = h('div', { class: 'stack' });
  const sign = h('div', { class: 'term-sign' }); sign.append(h('p', {}, 'Next'), h('p', {}, 'Still searching.'), h('p', { lang: 'zh-Hans' }, '下一站：还在寻找')); wrap.append(sign);
  wrap.append(h('p', {}, 'The line keeps going. I keep building. If you want to build something together, this is your stop.'));
  const asks = h('ul', { class: 'asks' }); KY.contact.asks.forEach((a) => asks.append(h('li', {}, a))); wrap.append(asks);
  const act = h('div', { class: 'row-actions' });
  const li = h('a', { class: 'btn btn-ink', href: KY.contact.linkedin, target: '_blank', rel: 'noopener' }); li.append(document.createTextNode('Message me on LinkedIn'), icon('M7 17L17 7M9 7h8v8'));
  const ph = h('a', { class: 'btn btn-line', href: KY.contact.phoneHref }, `Call ${KY.contact.phone}`);
  const pass = h('button', { type: 'button', class: 'btn btn-line' }, 'Show my pass'); pass.addEventListener('click', (e) => openPass(e.currentTarget));
  act.append(li, ph, pass);
  if (!KY.contact.email) act.append(h('span', { class: 'btn btn-line', 'aria-disabled': 'true' }, 'Email, coming soon'));
  if (!KY.contact.x) act.append(h('span', { class: 'btn btn-line', 'aria-disabled': 'true' }, 'X, coming soon'));
  wrap.append(act);
  const qr = h('figure', { class: 'qr' }); qr.append(h('img', { src: KY.contact.wechatQr, alt: 'WeChat QR code for Kevin Yu', width: '104', height: '104', loading: 'lazy' }), h('figcaption', {}, 'Or scan in WeChat')); wrap.append(qr);
  return wrap;
}

/* ---------- illustrations for private or image-less work ---------- */
function mockSvg(kind) {
  const s = sv('svg', { viewBox: '0 0 640 400', class: 'mock-svg', role: 'img', 'aria-label': 'Illustration' });
  const T = (x, y, txt, a = {}) => { const t = sv('text', { x, y, 'font-size': 16, fill: '#16171a', ...a }, s); t.textContent = txt; return t; };
  if (kind === 'risk') {
    sv('rect', { x: 60, y: 40, width: 520, height: 320, rx: 14, fill: '#fff', stroke: '#C9C9C3' }, s);
    sv('rect', { x: 84, y: 64, width: 228, height: 74, rx: 10, fill: '#F1F1EC' }, s); sv('rect', { x: 328, y: 64, width: 228, height: 74, rx: 10, fill: '#F1F1EC' }, s);
    T(100, 100, '32,592', { 'font-size': 26, 'font-weight': 800 }); T(100, 124, 'sanctions entries checked', { 'font-size': 13, fill: '#5B5C58' });
    T(344, 100, '4 lists', { 'font-size': 26, 'font-weight': 800 }); T(344, 124, 'checked every day', { 'font-size': 13, fill: '#5B5C58' });
    [['Buyer · Germany', 'Clear', '#00933C'], ['Buyer · Chile', 'Clear', '#00933C'], ['Buyer · UAE', 'Review', '#9A6A00'], ['Buyer · Italy', 'Clear', '#00933C']].forEach(([n, st, c], i) => { const y = 170 + i * 44; sv('line', { x1: 84, x2: 556, y1: y + 22, y2: y + 22, stroke: '#E2E2DD' }, s); T(88, y + 6, n, { 'font-weight': 600 }); sv('rect', { x: 470, y: y - 10, width: 84, height: 24, rx: 12, fill: c, opacity: 0.12 }, s); T(512, y + 7, st, { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: c }); });
  } else if (kind === 'rx') {
    const bx = (y, k, txt, hi) => { sv('rect', { x: 120, y, width: 400, height: 84, rx: 12, fill: '#fff', stroke: hi ? '#0039A6' : '#C9C9C3', 'stroke-width': hi ? 2 : 1 }, s); T(146, y + 30, k, { 'font-size': 12, fill: '#5B5C58' }); T(146, y + 60, txt, { 'font-size': 18, 'font-weight': 600 }); };
    bx(36, '1  Snap', '必理痛 Panadol   +   Paracetamol 500 mg'); bx(144, '2  Match', 'Same active ingredient: paracetamol', true); bx(252, '3  Speak', '');
    for (let i = 0; i < 16; i++) { const hh = 8 + Math.abs(Math.sin(i * 1.7)) * 26; sv('rect', { x: 148 + i * 9, y: 312 - hh / 2, width: 5, height: hh, rx: 2, fill: '#0039A6' }, s); }
    T(310, 318, '粵語 Cantonese', { 'font-size': 16, 'font-weight': 600 });
  } else {
    const g = sv('g', { transform: 'translate(320 215)', fill: 'none', stroke: '#16171a', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, s);
    const iso = (x, y, z) => [(x - y) * 0.866, (x + y) * 0.5 - z];
    const P = (pts, a = {}) => sv('path', { d: `${pts.map((p, i) => { const q = iso(...p); return `${i ? 'L' : 'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`; }).join(' ')}Z`, ...a }, g);
    P([[-90, -60, 0], [90, -60, 0], [90, 60, 0], [-90, 60, 0]]); P([[-90, 60, 0], [90, 60, 0], [90, 60, 150], [-90, 60, 150]]); P([[90, -60, 0], [90, 60, 0], [90, 60, 150], [90, -60, 150]]); P([[-90, -60, 150], [90, -60, 150], [90, 60, 150], [-90, 60, 150]]);
    for (let f = 1; f < 5; f++) for (let w = 0; w < 6; w++) { const x0 = -78 + w * 28; const z0 = f * 30 - 20; P([[x0, 60, z0], [x0 + 16, 60, z0], [x0 + 16, 60, z0 + 16], [x0, 60, z0 + 16]], { stroke: '#0039A6', 'stroke-width': 1 }); }
  }
  return s;
}

/* ---------- full reading page ---------- */
const read = $('[data-read]'); const media = $('[data-media]'); const thumbs = $('[data-thumbs]');
let readFrom = null; let readId = null; let readPushed = false;
function mediaList(p) {
  const list = []; const c = p.cover || {};
  if (c.type === 'video' || c.type === 'stickers') list.push(c);
  (p.media || []).forEach((m) => { if (m.type === 'mock' && list.some((x) => x.type === 'mock' && x.mock === m.mock)) return; if (c.type === 'stickers' && m.type === 'img') return; list.push(m); });
  if (!list.length && c.type && c.type !== 'none') list.push(c);
  return list;
}
function showMedia(m, p) {
  media.textContent = '';
  if (!m) { const d = h('div', { class: 'media-empty' }); d.style.background = `color-mix(in srgb, var(--l-${p.category}) 16%, #fff)`; d.append(h('span', {}, 'Images coming soon')); media.append(d); return; }
  if (m.type === 'img') media.append(h('img', { src: m.src, alt: m.alt || '', decoding: 'async' }));
  else if (m.type === 'video') { const v = h('video', { src: m.src, poster: m.poster || '', playsinline: '', muted: '', loop: '', 'aria-label': m.alt || '', class: 'is-cover' }); v.muted = true; if (reduce) v.setAttribute('controls', ''); else { v.autoplay = true; v.play().catch(() => {}); } media.append(v); }
  else if (m.type === 'yt') { const b = h('button', { type: 'button', class: 'yt-btn', 'aria-label': `Play ${m.alt || 'video'} from YouTube` }); b.style.backgroundImage = `url("https://i.ytimg.com/vi/${m.id}/hqdefault.jpg")`; const sp = h('span'); const pl = sv('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }); sv('path', { d: 'M7 4.5v15l13-7.5z' }, pl); sp.append(pl); b.append(sp); b.addEventListener('click', () => { media.textContent = ''; media.append(h('iframe', { src: `https://www.youtube-nocookie.com/embed/${m.id}?autoplay=1&rel=0`, title: m.alt || 'YouTube video', allow: 'autoplay; encrypted-media; picture-in-picture', allowfullscreen: '' })); }); media.append(b); }
  else if (m.type === 'mock') media.append(mockSvg(m.mock), h('span', { class: 'cap' }, 'Illustration'));
  else if (m.type === 'stickers') media.append(stickerScene(m), h('span', { class: 'cap' }, 'Game art'));
}
function openRead(id, from, opts = {}) {
  const p = projById[id]; if (!p) return;
  readId = id; const d = destOfProject(id); const st = d ? STATIONS[SIDX[d.station]] : null;
  $('[data-read-crumb]').textContent = `${st ? `${st.code} ${st.name} · ` : ''}${d ? d.name : CAT[p.category]}`;
  $('[data-read-back-label]').textContent = st ? `Back to ${st.name}` : 'Back';
  const status = $('[data-read-status]'); status.textContent = ''; status.append(statusMark(p), document.createTextNode(` ${STATUS[p.status]} · ${CAT[p.category]}${p.year ? ` · ${p.year}` : ''}`));
  $('[data-read-title]').textContent = p.title;
  $('[data-read-role]').textContent = p.role || '';
  const body = $('[data-read-body]'); body.textContent = ''; (p.body || []).forEach((t) => body.append(h('p', {}, t)));
  const facts = $('[data-read-facts]'); facts.textContent = ''; facts.style.setProperty('--fact', `var(--l-${p.category})`); (p.facts || []).forEach((f) => facts.append(h('li', {}, f)));
  const links = $('[data-read-links]'); links.textContent = ''; (p.links || []).forEach((l, i) => { const a = h('a', { class: `btn ${i ? 'btn-line' : 'btn-ink'}`, href: l.href, target: '_blank', rel: 'noopener' }, l.label); a.append(icon('M7 17L17 7M9 7h8v8')); links.append(a); });
  const list = mediaList(p); thumbs.textContent = '';
  const pick = (k) => { $$('button', thumbs).forEach((t, j) => t.setAttribute('aria-pressed', String(j === k))); showMedia(list[k], p); };
  if (list.length > 1) list.forEach((m, k) => { const t = h('button', { type: 'button', 'aria-label': `Show ${m.alt || `item ${k + 1}`}`, 'aria-pressed': 'false' }); const src = m.type === 'img' ? m.src : m.type === 'video' ? m.poster : m.type === 'yt' ? `https://i.ytimg.com/vi/${m.id}/mqdefault.jpg` : m.type === 'stickers' ? m.room : null; if (src) t.style.backgroundImage = `url("${src}")`; else { t.classList.add('th-mock'); t.textContent = 'Sketch'; } t.addEventListener('click', () => pick(k)); thumbs.append(t); });
  pick(0);
  const k = READ_ORDER.indexOf(id);
  $('[data-read-prev]').disabled = k <= 0; $('[data-read-next]').disabled = k >= READ_ORDER.length - 1;
  if (!opts.fromHash && location.hash !== `#/${id}`) { history.pushState(null, '', `#/${id}`); readPushed = true; }
  if (read.hidden) {
    readFrom = from || document.activeElement; read.hidden = false; doc.style.overflow = 'hidden'; if (city) city.pause();
    if (G && !reduce) G.fromTo('.read-in', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'expo.out', clearProps: 'transform,opacity' });
  }
  $('.read-in').scrollTop = 0;
  $('[data-read-back]').focus({ preventScroll: true });
}
function closeRead(opts = {}) {
  if (read.hidden) return;
  read.hidden = true; media.textContent = ''; doc.style.overflow = ''; if (city) city.resume();
  if (!opts.fromHash) { if (readPushed) { readPushed = false; history.back(); } else history.replaceState(null, '', `#/station/${STATIONS[cur].id}`); }
  readFrom?.focus?.({ preventScroll: true });
}
$('[data-read-back]').addEventListener('click', () => closeRead());
$('[data-read-prev]').addEventListener('click', () => { const k = READ_ORDER.indexOf(readId); if (k > 0) openRead(READ_ORDER[k - 1], null, { fromHash: true }); history.replaceState(null, '', `#/${readId}`); });
$('[data-read-next]').addEventListener('click', () => { const k = READ_ORDER.indexOf(readId); if (k < READ_ORDER.length - 1) openRead(READ_ORDER[k + 1], null, { fromHash: true }); history.replaceState(null, '', `#/${readId}`); });
const trap = (root, e) => { if (e.key !== 'Tab') return; const f = $$('button:not([disabled]), a[href], iframe, video[controls]', root).filter((n) => n.offsetParent !== null); if (!f.length) return; const a = f[0]; const z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } };
read.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closeRead(); } else trap(read, e); });

/* ---------- the pass ---------- */
const pass = $('[data-pass]'); const card = $('[data-pass-card]'); const passNote = $('[data-pass-note]'); const flipBtn = $('[data-pass-flip]');
let passFrom = null;
function openPass(from) { passFrom = from || document.activeElement; pass.hidden = false; card.classList.remove('is-added', 'is-flipped'); flipBtn.setAttribute('aria-pressed', 'false'); passNote.textContent = ''; doc.style.overflow = 'hidden'; if (G && !reduce) G.fromTo('.pass', { y: 40, rotateX: 25, opacity: 0 }, { y: 0, rotateX: 0, opacity: 1, duration: 0.8, ease: 'expo.out', clearProps: 'transform,opacity' }); flipBtn.focus({ preventScroll: true }); }
function closePass() { pass.hidden = true; doc.style.overflow = ''; passFrom?.focus?.({ preventScroll: true }); }
$('[data-pass-open]').addEventListener('click', (e) => openPass(e.currentTarget));
$$('[data-pass-close]').forEach((b) => b.addEventListener('click', closePass));
flipBtn.addEventListener('click', () => { const on = card.classList.toggle('is-flipped'); flipBtn.setAttribute('aria-pressed', String(on)); });
$('[data-pass-add]').addEventListener('click', () => { card.classList.remove('is-tap', 'is-flipped'); void card.offsetWidth; card.classList.add('is-tap', 'is-added'); flipBtn.setAttribute('aria-pressed', 'false'); passNote.textContent = 'Saved kevin-yu.vcf. Open it to add Kevin to your contacts.'; });
$('[data-pass-copy]').addEventListener('click', async () => { const url = 'https://kevinpeiyuanyu.com'; try { await navigator.clipboard.writeText(url); passNote.textContent = 'Link copied: kevinpeiyuanyu.com'; } catch (e) { passNote.textContent = `Copy this link: ${url}`; } });
pass.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closePass(); } else trap($('.pass-wrap'), e); });
if (window.matchMedia('(pointer: fine)').matches && !reduce) {
  card.addEventListener('pointermove', (e) => { const r = card.getBoundingClientRect(); card.classList.add('is-tilting'); card.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 16}deg`); card.style.setProperty('--rx', `${(0.5 - (e.clientY - r.top) / r.height) * 12}deg`); });
  card.addEventListener('pointerleave', () => { card.classList.remove('is-tilting'); card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
}
card.addEventListener('click', (e) => { if (!e.target.closest('a')) flipBtn.click(); });

/* ---------- keys and links ---------- */
addEventListener('keydown', (e) => {
  if (!read.hidden || !pass.hidden || e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); quickRide((cur + 1) % STATIONS.length); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); quickRide((cur - 1 + STATIONS.length) % STATIONS.length); }
});
function route() {
  const m = location.hash.match(/^#\/(station\/)?([\w-]+)$/);
  if (!m) return null;
  if (m[1]) return { station: SIDX[m[2]] ?? 0 };
  const d = destOfProject(m[2]); if (d) return { station: SIDX[d.station], project: m[2], dest: d.id };
  if (DID[m[2]]) return { station: SIDX[DID[m[2]].station], dest: m[2] };
  return null;
}
addEventListener('hashchange', () => {
  const r = route(); if (!r) { closeRead({ fromHash: true }); return; }
  if (r.project) { if (r.station !== cur) ride(r.station, r.dest); openRead(r.project, null, { fromHash: true }); }
  else { closeRead({ fromHash: true }); if (r.station !== cur) ride(r.station, r.dest); }
});

/* ---------- hover tip: what a building, station or the train is, and what a click does ---------- */
const tip = h('div', { class: 'hover-tip', 'aria-hidden': 'true' }); document.body.append(tip);
function tipFor(pick) {
  tip.textContent = '';
  const line1 = h('span', { class: 'tip-k' }); const big = h('b'); const sub = h('span', { class: 'tip-sub' }); const act = h('span', { class: 'tip-act' });
  if (pick.type === 'dest') {
    const d = DID[pick.id]; const st = STATIONS[SIDX[d.station]]; const here = SIDX[d.station] === cur && !riding && !(city && city.moving());
    line1.append(h('i', { class: 'kcode' }, st.code), document.createTextNode(st.name));
    big.textContent = d.name;
    sub.textContent = d.projects ? d.projects.map((id) => SHORT[id] || projById[id].title).join(' · ') : d.label;
    act.textContent = here ? 'You’re here · Open' : 'Ride here';
  } else if (pick.type === 'station') {
    const st = STATIONS[pick.index]; line1.append(h('i', { class: 'kcode' }, st.code), document.createTextNode('Station'));
    big.textContent = st.name; sub.textContent = DEST.filter((d) => d.station === st.id).map((d) => d.name).join(' · ');
    act.textContent = pick.index === cur && !riding ? 'You’re here · Open' : 'Ride here';
  } else { line1.append(h('i', { class: 'kcode' }, 'K'), document.createTextNode('Kevin Metro')); big.textContent = 'The K Line train'; sub.textContent = riding ? `Next stop: ${STATIONS[rideTo].name}` : 'Four cars, clockwise round the city'; act.textContent = 'Follow the train'; }
  tip.append(line1, big, sub, act);
}
let tipKey = '';
function onHover(pick, x, y) {
  if (!pick) { tip.classList.remove('is-on'); tipKey = ''; return; }
  const key = JSON.stringify(pick) + riding + cur; if (key !== tipKey) { tipFor(pick); tipKey = key; }
  if (x != null) { const w = tip.offsetWidth; const left = Math.min(innerWidth - w - 8, x + 16); tip.style.transform = `translate(${left}px, ${Math.max(8, y - 12 - tip.offsetHeight)}px)`; tip.classList.add('is-on'); }
}

/* ---------- boot: the 3D city, or the flat diagram without WebGL ---------- */
let wasMoving = false;
const webgl = () => { if (/[?&]flat/.test(location.search)) return false; try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } };
async function boot() {
  const stage = $('[data-stage]');
  const r = route();
  cur = r ? r.station : 0;
  if (webgl()) {
    try {
      const { createCity } = await import('./scene.js');
      city = createCity(stage, {
        reduce, isPhone: phone.matches, lineHex: LINE_HEX, destinations: DEST,
        onProgress: (f) => { placeHud(f); if (f !== Math.floor(f) && !wasMoving) { wasMoving = true; markHere(); } },
        onHover,
        onFree: (on) => { if (on) setFollow(false); },
        onArrive: (i, o) => {
          wasMoving = false;
          if (!o.cruise) { markHere(); return; }
          cur = i; markHere(); markHud(); placeHud(i); city.highlight(i);
          const st = STATIONS[i]; setNow('Now at', `${st.code} ${st.name}`); history.replaceState(null, '', `#/station/${st.id}`);
        },
        onPick: (p) => {
          onHover(null);
          if (p.type === 'train') { city.view(riding ? 'ride' : city.moving() ? 'follow' : 'platform'); setFollow(true); return; }
          if (p.type === 'station') { quickRide(p.index); return; }
          const d = DID[p.id]; if (!d) return; selected = d;
          const i = SIDX[d.station];
          if (i === cur && !riding && !city.moving()) { openPop(cur, d.id); return; }
          // a click in the city prints a ticket, then boards by itself
          idle.stop(); city.view('dest', { focus: d.focus }); setFollow(false);
          printTicket(d, STATIONS[i], STATIONS[cur], true);
        },
      });
      await city.goTo(cur, { instant: true });
    } catch (e) { console.warn('3D city unavailable; showing the line diagram.', e); city = null; stage.textContent = ''; }
  }
  if (!city) {
    const { renderFallback } = await import('./fallback.js');
    stage.classList.add('is-flat'); $('[data-overview]').hidden = true; followBtn.hidden = true; $('.stage-hint').hidden = true;
    renderFallback(stage, { stations: STATIONS, dests: DEST, projById, onDest: (d) => { cur = SIDX[d.station]; markHud(); placeHud(cur); openPop(cur, d.id); } });
  }
  if (/[?&]debug/.test(location.search)) window.__kmetro = { city, ride, quickRide, openPop, openRead, onHover, DEST, STATIONS };
  drawHud(); markHud(); placeHud(cur);
  const st = STATIONS[cur]; setNow('Now at', `${st.code} ${st.name}`);
  pillIdle();
  if (city) {
    city.highlight(cur);
    if (!r) { city.view('overview', { instant: true }); setFollow(false); }
    else { city.view('platform', { instant: true }); setFollow(true); }
    idle.arm();
  }
  if (r && r.project) { openPop(cur, r.dest); openRead(r.project, null, { fromHash: true }); }
  else if (r && r.dest) openPop(cur, r.dest);
  else history.replaceState(null, '', `#/station/${st.id}`);
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot); else boot();
