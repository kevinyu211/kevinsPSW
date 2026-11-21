/* Kevin Metro · interface
   Pick a line, pick a place, ride (changing trains if you must), arrive, read. Every control is real HTML;
   the 3D city follows along. Facts come from ../shared/content.js and nowhere else. */
import { buildNetwork } from './network.js';
import { PLACES, PLOTS, MODELS, stationIdOf } from './city-data.js';

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
const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
if (G) G.ticker.lagSmoothing(0);

const STATUS = { live: 'Live', testing: 'In testing', building: 'Building', done: 'Done', parked: 'Planned' };
const CAT = Object.fromEntries(KY.categories.map((c) => [c.id, c.label]));
const projById = Object.fromEntries(KY.projects.map((p) => [p.id, p]));
const SHORT = { trade: 'Export risk tool', court: 'Court booking', books: 'Snuggle Crew books', ipad: 'iPad coloring app', duiyao: '對藥', pindou: '拼豆 store' };

/* ---------- the network (shared with the 3D engine) ---------- */
const net = buildNetwork();
const LINES = net.lines; const LBY = net.byId; const STBY = net.stById;
const CATLINE = { software: '1', books: '2', film: '3', games: '4', health: '5' };
// every place comes from the registry (city-data.js)
const DEST = PLACES.map((p) => ({ id: p.id, name: p.label, short: p.short, station: stationIdOf(p), landmark: p.id, projects: p.projects, panel: p.panel, label: p.note, lineId: p.line }));
DEST.forEach((d) => { const p = d.projects && projById[d.projects[0]]; d.line = d.lineId || (p ? CATLINE[p.category] : 'c'); d.css = p ? LBY[CATLINE[p.category]].def.css : '#16171A'; });
const DID = Object.fromEntries(DEST.map((d) => [d.id, d]));
const destOfProject = (pid) => DEST.find((d) => (d.projects || []).includes(pid));
const READ_ORDER = KY.categories.flatMap((c) => KY.projects.filter((p) => p.category === c.id).map((p) => p.id));
const lineChip = (lid, big) => { const d = LBY[lid].def; const i = h('span', { class: `lchip${big ? ' lchip-lg' : ''}${lid === '2' ? ' on-yellow' : ''}`, 'aria-hidden': 'true' }, d.no); i.style.background = d.css; return i; };
const lineName = (lid) => { const d = LBY[lid].def; return lid === 'c' ? 'Circle Line' : `${d.name} · ${d.label}`; };

let city = null;
let cur = 'kevin';
let riding = false;
let selected = null;
let ticketNo = 1000 + Math.floor(Math.random() * 8000);
let hudLine = '1';

/* ---------- line strip: a line switcher, and the stations of one line ---------- */
const hudLines = $('[data-hud-lines]'); const hud = $('[data-hud]'); const hudTrain = $('[data-hud-train]');
const hudSvg = sv('svg', { class: 'hud-loop', 'aria-hidden': 'true' }); const hudPath = sv('path', {}, hudSvg);
LINES.forEach((l) => {
  const b = h('button', { type: 'button', class: 'hud-line', 'aria-pressed': 'false', 'aria-label': `Show ${lineName(l.id)}` });
  b.append(lineChip(l.id), h('span', {}, l.id === 'c' ? 'Circle' : l.def.label));
  b.addEventListener('click', () => { hudLine = l.id; drawHud(); if (city && city.focusLine() === l.id) placeHud(l.id, lastF); });
  b.dataset.line = l.id; hudLines.append(b);
});
let stops = []; let cx = []; let lastF = 0; let lastFLine = '1'; const HUD_TOP = 28; let hudBot = 64;
function drawHud() {
  $$('.hud-line', hudLines).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.line === hudLine)));
  const l = LBY[hudLine]; hud.style.setProperty('--lc', l.def.css); hud.classList.toggle('is-loop', l.closed);
  hud.textContent = ''; hud.append(hudSvg, hudTrain);
  stops = l.stations.map((ps, i) => {
    const li = h('div', { class: 'hud-stop' });
    const b = h('button', { type: 'button', 'aria-label': `Ride to ${ps.st.name}${ps.st.lines.length > 1 ? `, change for ${ps.st.lines.filter((x) => x !== l.id).map(lineName).join(' and ')}` : ''}` });
    const dot = h('span', { class: 'hud-dot', 'aria-hidden': 'true' }); if (ps.st.lines.length > 1) dot.classList.add('is-inter');
    b.append(dot, h('span', { class: 'hud-name' }, ps.st.name));
    b.addEventListener('click', () => rideTo(ps.id, (DEST.find((d) => d.station === ps.id) || {}).id));
    li.append(b); hud.append(li); return li;
  });
  requestAnimationFrame(() => {
    cx = stops.map((li) => li.offsetLeft + li.offsetWidth / 2); if (!cx.length) return;
    hudBot = hud.clientHeight - 10; const r = (hudBot - HUD_TOP) / 2; const x0 = cx[0]; const xN = cx[cx.length - 1];
    hudSvg.setAttribute('width', hud.scrollWidth); hudSvg.setAttribute('height', hud.clientHeight);
    hudPath.setAttribute('d', l.closed ? `M${x0} ${HUD_TOP} H${xN} A${r} ${r} 0 0 1 ${xN} ${hudBot} H${x0} A${r} ${r} 0 0 1 ${x0} ${HUD_TOP}` : `M${x0 - 14} ${HUD_TOP} H${xN + 14}`);
    markHud(); placeHud(lastFLine, lastF);
  });
}
function placeHud(lid, f) {
  lastF = f; lastFLine = lid;
  const show = lid === hudLine && cx.length; hudTrain.hidden = !show; if (!show) return;
  const l = LBY[lid]; const n = l.stations.length; let x; let y = HUD_TOP; let back = false;
  if (l.closed) {
    f = ((f % n) + n) % n; const i = Math.floor(f); const t = f - i;
    if (i < n - 1) x = cx[i] + (cx[i + 1] - cx[i]) * t;
    else { const r = (hudBot - HUD_TOP) / 2; const x0 = cx[0]; const xN = cx[n - 1]; const arc = Math.PI * r; let d = t * (2 * arc + (xN - x0)); if (d < arc) { const a = d / r; x = xN + r * Math.sin(a); y = HUD_TOP + r - r * Math.cos(a); } else if ((d -= arc) < xN - x0) { x = xN - d; y = hudBot; back = true; } else { const a = (d - (xN - x0)) / r; x = x0 - r * Math.sin(a); y = hudBot - r + r * Math.cos(a); back = true; } }
  } else { f = Math.max(0, Math.min(n - 1, f)); const i = Math.min(n - 2, Math.floor(f)); const t = f - i; x = n > 1 ? cx[i] + (cx[i + 1] - cx[i]) * t : cx[0]; }
  hudTrain.style.transform = `translate(${x.toFixed(1)}px, ${(y - HUD_TOP).toFixed(1)}px)${back ? ' scaleX(-1)' : ''}`;
}
function markHud() { const l = LBY[hudLine]; stops.forEach((li, k) => { const b = $('button', li); if (l.stations[k].id === cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); }); }
addEventListener('resize', () => drawHud());

/* ---------- top bar ---------- */
const now = $('[data-now]');
const setNow = (lead, name, lid) => { now.textContent = ''; now.append(document.createTextNode(`${lead} `)); if (lid) now.append(lineChip(lid), document.createTextNode(' ')); now.append(h('b', {}, name)); };
const mapBtn = $('[data-map]');
const setMapBtn = (on) => { mapBtn.setAttribute('aria-pressed', String(on)); $('span', mapBtn).textContent = on ? '3D city' : 'Map'; };
mapBtn.addEventListener('click', () => { if (!city) return; const on = !city.isMap(); city.setMap(on); setMapBtn(on); setFollow(false); });
const followBtn = $('[data-follow]');
const setFollow = (on) => followBtn.setAttribute('aria-pressed', String(on));
followBtn.addEventListener('click', () => { if (!city) return; city.view(riding ? 'ride' : city.moving() ? 'follow' : 'platform'); setFollow(true); setMapBtn(false); });
$('[data-home]').addEventListener('click', (e) => { e.preventDefault(); openIntro(); });

/* ---------- ticket machine: 1 line, 2 place, 3 ride ---------- */
const tvm = $('[data-tvm]'); const tvmBody = $('[data-tvm-body]');
const pill = h('div', { class: 'tvm-pill', 'aria-live': 'polite' }); tvm.append(pill);
const ticketSlot = h('div', { class: 'tvm-ticket', 'aria-hidden': 'true' }); tvm.append(ticketSlot);
const setStep = (n) => $$('.tvm-steps li', tvm).forEach((li) => li.classList.toggle('is-on', +li.dataset.step <= n));
const setTvm = (state) => { tvm.dataset.state = state; if (city && !phone.matches && focus.hidden) city.setViewOffset(state === 'full' ? Math.round(tvm.offsetWidth * 0.9) : 0, 'left'); };
const collapseBtn = h('button', { type: 'button', class: 'icon-btn tvm-collapse', 'aria-label': 'Collapse the ticket machine' }); collapseBtn.append(icon('M6 9l6 6 6-6'));
collapseBtn.addEventListener('click', () => (selected ? tvmTicket() : pillIdle()));
$('.tvm-head', tvm).append(collapseBtn);
const expandBtn = () => { const b = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Open the ticket machine' }); b.append(icon('M6 15l6-6 6 6')); b.addEventListener('click', () => tvmLines()); return b; };
let tvmLine = null;
function tvmLines() {
  setStep(1); setTvm('full'); ticketSlot.textContent = ''; tvmBody.textContent = ''; tvmLine = null;
  tvmBody.append(h('p', { class: 'tvm-lede' }, 'Which line? Each one carries one kind of work.'));
  const grid = h('div', { class: 'tvm-lines' });
  LINES.filter((l) => l.id !== 'c').concat([LBY.c]).forEach((l) => {
    const b = h('button', { type: 'button', class: 'line-btn' }); b.style.setProperty('--lc', l.def.css);
    const txt = h('span', { class: 'dest-txt' }); txt.append(h('b', {}, l.id === 'c' ? 'Circle Line' : l.def.label), h('span', {}, l.stations.map((p) => p.st.name).join(' · ')));
    b.append(lineChip(l.id, true), txt);
    b.addEventListener('click', () => { hudLine = l.id; drawHud(); tvmPlaces(l.id); });
    grid.append(b);
  });
  const all = h('button', { type: 'button', class: 'line-btn line-all' }); const t2 = h('span', { class: 'dest-txt' }); t2.append(h('b', {}, 'All stations'), h('span', {}, 'Every place in the city, A to Z'));
  all.append(h('span', { class: 'lchip lchip-lg lchip-all', 'aria-hidden': 'true' }, 'A–Z'), t2); all.addEventListener('click', () => tvmPlaces(null)); grid.append(all);
  tvmBody.append(grid);
}
function destButton(d) {
  const st = STBY[d.station];
  const b = h('button', { type: 'button', class: 'dest-btn', 'aria-label': `${d.name}, ${st.name}${d.label ? `, ${d.label}` : ''}` });
  const chips = h('span', { class: 'chips' }); st.lines.forEach((lid) => chips.append(lineChip(lid)));
  const txt = h('span', { class: 'dest-txt' }); txt.append(h('b', {}, d.name), h('span', {}, `${st.name} · ${d.projects ? d.projects.map((id) => SHORT[id] || projById[id].title).join(', ') : d.label}`));
  b.append(chips, txt); b.dataset.st = d.station;
  b.addEventListener('click', () => { selected = d; tvmTicket(); if (city) city.view('dest', { focus: d.focus }); });
  return b;
}
function tvmPlaces(lid) {
  setStep(2); setTvm('full'); tvmBody.textContent = ''; tvmLine = lid;
  const back = h('button', { type: 'button', class: 'link-btn tvm-back' }); back.append(icon('M15 5l-7 7 7 7'), document.createTextNode('All lines')); back.addEventListener('click', tvmLines);
  const head = h('div', { class: 'tvm-linehead' });
  if (lid) { head.style.setProperty('--lc', LBY[lid].def.css); head.append(lineChip(lid, true), h('b', {}, lineName(lid))); } else head.append(h('b', {}, 'All stations'));
  tvmBody.append(back, head);
  const grid = h('div', { class: 'tvm-grid' });
  if (lid) LBY[lid].stations.forEach((ps) => { const ds = DEST.filter((d) => d.station === ps.id); if (!ds.length) { const b = destButton({ id: `st-${ps.id}`, name: ps.st.name, station: ps.id, label: 'Interchange' }); b.onclick = null; b.addEventListener('click', () => { selected = null; tvmTicketStation(ps.id); }); grid.append(b); } else ds.forEach((d) => grid.append(destButton(d))); });
  else DEST.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach((d) => grid.append(destButton(d)));
  tvmBody.append(grid); markHere();
}
function markHere() { const moving = !!(city && city.moving()); $$('.dest-btn', tvm).forEach((b) => { const on = b.dataset.st === cur && !riding && !moving; b.classList.toggle('is-here', on); if (on) b.setAttribute('aria-current', 'location'); else b.removeAttribute('aria-current'); }); }
function pillIdle() {
  setTvm('pill'); ticketSlot.textContent = ''; pill.textContent = '';
  const b = h('button', { type: 'button', class: 'pill-main' }); b.append(h('span', { class: 'roundel roundel-sm', 'aria-hidden': 'true' }, 'K'), h('span', { class: 'pill-txt' }, 'Buy a ticket: pick a line'));
  b.addEventListener('click', tvmLines);
  pill.append(b, expandBtn());
}
const routeFor = (toSid) => net.route(cur, toSid, city ? city.focusLine() : null) || [];
function routeLine(legs) {
  const wrap = h('span', { class: 'route' });
  legs.forEach((lg, i) => { if (i) wrap.append(h('span', { class: 'route-change' }, `change at ${STBY[lg.from].name}`)); wrap.append(lineChip(lg.line)); });
  return wrap;
}
function pillHead(name, sub) { const t = h('span', { class: 'pill-txt' }); t.append(h('b', {}, name), sub); return t; }
function tvmTicket() {
  const d = selected; const sid = d.station; const here = sid === cur && !riding && !(city && city.moving());
  setStep(2); setTvm('pill'); ticketSlot.textContent = ''; pill.textContent = '';
  const legs = here ? [] : routeFor(sid);
  const sub = here ? h('span', {}, 'You’re here') : routeLine(legs);
  const get = h('button', { type: 'button', class: 'btn btn-ink btn-sm' }, here ? 'Open' : 'Get ticket');
  get.addEventListener('click', () => { if (here) openFocus(placeAt(sid, d.id)); else printTicket(d, sid); });
  pill.append(pillHead(d.name, sub), get, expandBtn());
  get.focus({ preventScroll: true });
}
function tvmTicketStation(sid) { selected = { id: `st-${sid}`, name: STBY[sid].name, station: sid }; tvmTicket(); }
let autoBoard = null;
function printTicket(d, sid, auto) {
  setStep(3); clearTimeout(autoBoard); setTvm('pill');
  ticketNo += 1;
  const legs = routeFor(sid); const from = STBY[cur]; const to = STBY[sid];
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const t = h('div', { class: 'ticket', role: 'img', 'aria-label': `Ticket ${ticketNo}: ${from.name} to ${to.name}${legs.length > 1 ? `, change at ${legs.slice(1).map((l) => STBY[l.from].name).join(' and ')}` : ''}` });
  const top = h('div', { class: 'tk-top' }); top.append(h('span', { class: 'roundel roundel-sm' }, 'K'), h('b', {}, 'Kevin Metro'), h('span', { class: 'tk-no' }, `No. ${ticketNo}`));
  const mid = h('div', { class: 'tk-mid' });
  const a = h('div'); a.append(h('span', {}, 'From'), h('b', {}, from.name)); const b = h('div'); b.append(h('span', {}, 'To'), h('b', {}, to.name)); mid.append(a, b);
  const steps = h('ol', { class: 'tk-legs' });
  legs.forEach((lg, i) => { const li = h('li'); if (i) li.append(h('span', { class: 'tk-change' }, `Change at ${STBY[lg.from].name}`)); const r = h('span', { class: 'tk-leg' }); r.append(lineChip(lg.line), document.createTextNode(` ${lineName(lg.line)} to ${STBY[lg.to].name} · ${lg.stops} stop${lg.stops > 1 ? 's' : ''}`)); li.append(r); steps.append(li); });
  const bot = h('div', { class: 'tk-bot' }); bot.append(h('span', {}, d.name), h('span', {}, date), h('span', {}, 'Fare: free'));
  t.append(top, mid, steps, bot);
  ticketSlot.textContent = ''; ticketSlot.append(t); ticketSlot.removeAttribute('aria-hidden');
  if (G && !reduce) G.fromTo(t, { y: 40, clipPath: 'inset(100% 0 0 0)' }, { y: 0, clipPath: 'inset(0% 0 0 0)', duration: 0.9, ease: 'power2.out' });
  pill.textContent = '';
  const board = h('button', { type: 'button', class: 'btn btn-ink btn-sm' }); board.append(document.createTextNode('Board'), icon('M9 5l7 7-7 7'));
  board.addEventListener('click', () => rideTo(sid, d.id));
  pill.append(pillHead(d.name, routeLine(legs)), board, expandBtn());
  board.focus({ preventScroll: true });
  if (auto) autoBoard = setTimeout(() => rideTo(sid, d.id), reduce ? 300 : 1600);
}

/* ---------- riding: one leg per line, a change at the interchange ---------- */
let rideSeq = 0;
const cutEl = () => $('.ride-cut');
async function cutTo(fn) { const c = cutEl(); if (!c || reduce) { fn(); return; } c.classList.add('is-on'); await wait(420); fn(); await wait(80); c.classList.remove('is-on'); }
function tvmRiding(lg, legs, k) {
  setTvm('pill'); ticketSlot.textContent = ''; pill.textContent = '';
  const t = h('span', { class: 'pill-txt' }); const head = h('b'); head.append(lineChip(lg.line), document.createTextNode(` Next stop: ${STBY[lg.to].name}`));
  t.append(head, h('span', {}, legs.length > 1 ? `Leg ${k + 1} of ${legs.length}${k < legs.length - 1 ? ` · then change at ${STBY[lg.to].name}` : ''}` : (selected ? selected.name : lineName(lg.line))));
  const bar = h('span', { class: 'ride-bar', 'data-ride-progress': '' }); bar.append(h('i')); bar.style.setProperty('--lc', LBY[lg.line].def.css); t.append(bar);
  const skip = h('button', { type: 'button', class: 'btn btn-line btn-sm' }, 'Skip'); skip.addEventListener('click', () => city && city.skip());
  pill.append(t, skip);
}
function tvmChange(lg) {
  pill.textContent = '';
  const t = h('span', { class: 'pill-txt' }); const head = h('b'); head.append(document.createTextNode(`Change at ${STBY[lg.from].name} `), lineChip(lg.line));
  t.append(head, h('span', {}, `${lineName(lg.line)} towards ${STBY[lg.to].name}`)); pill.append(t);
}
let rideLeg = null;
async function rideTo(sid, destId, opts = {}) {
  if (!STBY[sid]) return;
  clearTimeout(autoBoard); idle.stop(); closeFocus(true);
  if (sid === cur && !riding && !(city && city.moving())) { openFocus(placeAt(sid, destId)); return; }
  const legs = routeFor(sid); if (!legs.length) { openFocus(placeAt(sid, destId)); return; }
  const seq = ++rideSeq; riding = true; markHere();
  history.replaceState(null, '', `#/station/${sid}`);
  for (let k = 0; k < legs.length; k++) {
    const lg = legs[k]; rideLeg = { ...lg, from0: lg.from };
    hudLine = lg.line; drawHud();
    if (city) {
      const at = city.at();
      if (k > 0) { tvmChange(lg); setNow('Change at', STBY[lg.from].name, lg.line); await wait(700); if (seq !== rideSeq) return; }
      if (at.line !== lg.line || at.station !== lg.from || at.moving) { await cutTo(() => { city.board(lg.line, lg.from, { instant: true }); city.view('platform', { instant: true }); }); await wait(900); if (seq !== rideSeq) return; }
      setNow('Riding to', STBY[lg.to].name, lg.line); tvmRiding(lg, legs, k); city.highlight(null); city.view('ride'); setFollow(true); setMapBtn(false);
      const ok = await city.goTo(lg.line, lg.to, opts); if (!ok || seq !== rideSeq) return;
    }
    cur = lg.to;
  }
  riding = false; rideLeg = null; cur = sid; markHud(); markHere();
  const st = STBY[sid]; setNow('Now at', st.name, legs[legs.length - 1].line);
  if (city) { city.highlight(sid); city.view('platform'); }
  setTimeout(() => { if (seq === rideSeq && !riding) openFocus(placeAt(sid, destId)); }, reduce || !city ? 0 : 1100);
}
const rideToStation = (sid) => { const d = DEST.find((x) => x.station === sid); selected = d || { id: `st-${sid}`, name: STBY[sid].name, station: sid }; rideTo(sid, d && d.id); };

/* ---------- idle: after a quiet moment the trains keep running their lines ---------- */
const idle = (() => {
  let t = null;
  const quiet = () => !riding && focus.hidden && read.hidden && pass.hidden && intro.hidden;
  const arm = () => { clearTimeout(t); if (!city || reduce) return; t = setTimeout(() => { if (quiet()) { city.cruise(true); if (city.mode() === 'platform') city.view('follow'); } else arm(); }, 7000); };
  return { arm, stop() { clearTimeout(t); if (city) city.cruise(false); } };
})();
['pointerdown', 'keydown', 'wheel'].forEach((ev) => addEventListener(ev, () => { if (city && !riding) idle.arm(); }, { passive: true }));

/* ---------- level 2 · station focus: the building fills the stage, its story sits beside it ----------
   City/Map -> Station focus -> Article. Arriving by train, or clicking a building, opens the focus; "Read the
   story" opens the article from it; Esc or "Back to map" zooms out to the city again. */
const focus = $('[data-focus]'); const fPanel = $('[data-focus-panel]');
let focusId = null; let wasMap = false;
const placeAt = (sid, destId) => (DID[destId] && DID[destId].station === sid ? destId : (DEST.find((d) => d.station === sid) || {}).id);
function focusLineOf(d) { const st = STBY[d.station]; return st.lines.includes(hudLine) ? hudLine : st.lines.includes(d.line) ? d.line : st.lines[0]; }
function openFocus(id, opts = {}) {
  const d = DID[id]; if (!d) return;
  const st = STBY[d.station]; idle.stop(); onHover(null);
  if (focus.hidden) wasMap = !!(city && city.isMap());
  focusId = id;
  const lid = focusLineOf(d); const line = LBY[lid]; const ps = line.stations.find((p) => p.id === st.id);
  focus.style.setProperty('--lc', d.css === '#16171A' ? line.def.css : d.css);
  // where we are: the lines here, the station, its code
  const where = $('[data-focus-where]'); where.textContent = ''; st.lines.forEach((l) => where.append(lineChip(l)));
  where.append(h('b', {}, st.name), h('span', { lang: 'zh-Hans' }, st.zh), h('span', { class: 'focus-code' }, ps.code));
  // other buildings at this station
  const tabs = $('[data-focus-tabs]'); tabs.textContent = ''; const here = DEST.filter((x) => x.station === st.id);
  tabs.hidden = here.length < 2;
  here.forEach((x) => { const b = h('button', { type: 'button', class: 'focus-tab', 'aria-pressed': String(x.id === id) }, x.name); b.addEventListener('click', () => openFocus(x.id)); tabs.append(b); });
  const projects = (d.projects || []).map((pid) => projById[pid]).filter(Boolean); const p = projects[0];
  $('[data-focus-title]').textContent = p ? p.title : d.name;
  $('[data-focus-place]').textContent = p ? d.name : (d.label || '');
  $('[data-focus-dek]').textContent = p ? p.one : '';
  $('[data-focus-dek]').hidden = !p;
  const stats = $('[data-focus-stats]'); stats.textContent = '';
  if (p) { const st3 = (p.stats || []).slice(0, 3); st3.forEach((x) => { const c = h('div'); c.append(h('dt', {}, x.n), h('dd', {}, x.l)); stats.append(c); }); const sl = h('div'); const dt = h('dt', { class: 'is-status' }); dt.append(statusMark(p), document.createTextNode(STATUS[p.status])); sl.append(dt, h('dd', {}, [p.role, p.year].filter(Boolean).join(' · '))); if (st3.length < 3) stats.append(sl); }
  stats.hidden = !p;
  const media = $('[data-focus-media]'); media.textContent = ''; media.hidden = !p;
  const body = $('[data-focus-body]'); body.textContent = '';
  const acts = $('[data-focus-actions]'); acts.textContent = '';
  if (p) {
    const lead = h('button', { type: 'button', class: 'focus-lead', 'aria-label': `${p.title}: read the story` }); lead.append(coverEl(p, true)); lead.addEventListener('click', () => openRead(p.id, lead)); media.append(lead);
    const read1 = h('button', { type: 'button', class: 'btn btn-ink' }); read1.append(document.createTextNode('Read the story'), icon('M9 5l7 7-7 7')); read1.addEventListener('click', () => openRead(p.id, lead)); acts.append(read1);
    (p.links || []).slice(0, 1).forEach((l) => { const a = h('a', { class: 'btn btn-line', href: l.href, target: '_blank', rel: 'noopener' }, l.label); a.append(icon('M7 17L17 7M9 7h8v8')); acts.append(a); });
    if (projects.length > 1) { const more = h('div', { class: 'focus-more' }); more.append(h('p', {}, 'Also in this building')); projects.slice(1).forEach((q) => more.append(tile(q))); body.append(more); }
  } else if (d.panel === 'timetable') body.append(timetable());
  else if (d.panel === 'news') body.append(news());
  else if (d.panel === 'terminus') body.append(terminus());
  else if (d.panel === 'intro') body.append(introBlock(false));
  // previous and next station on this line
  const nav = $('[data-focus-nav]'); nav.textContent = ''; const n = line.stations.length; const i = ps.i;
  [[line.closed ? (i - 1 + n) % n : i - 1, 'Previous', 'M15 5l-7 7 7 7'], [line.closed ? (i + 1) % n : i + 1, 'Next', 'M9 5l7 7-7 7']].forEach(([k, lab, ic]) => {
    if (k < 0 || k >= n) { nav.append(h('span')); return; }
    const q = line.stations[k]; const b = h('button', { type: 'button', class: `focus-nb${lab === 'Next' ? ' is-next' : ''}`, 'aria-label': `${lab} station on ${lineName(lid)}: ${q.st.name}` });
    const t = h('span', { class: 'focus-nb-t' }); t.append(h('span', {}, `${lab} station`), h('b', {}, q.st.name)); const chip = lineChip(lid);
    if (lab === 'Next') b.append(chip, t, icon(ic)); else b.append(icon(ic), chip, t);
    b.addEventListener('click', () => rideToStation(q.id)); nav.append(b);
  });
  const opening = focus.hidden; focus.hidden = false; tvm.dataset.state = 'hidden'; fPanel.scrollTop = 0;
  if (city) { city.highlight(st.id); if (!phone.matches) city.setViewOffset(Math.round(fPanel.getBoundingClientRect().right), 'left'); if (d.hit) city.focusOn(d); setFollow(false); setMapBtn(false); }
  if (!opts.fromHash && read.hidden) history.replaceState(null, '', `#/station/${st.id}`);
  if (G && !reduce) G.fromTo(opening ? [fPanel, '.focus-top', '.focus-nav'] : '.focus-panel > *', opening ? (phone.matches ? { yPercent: 14, opacity: 0 } : { x: -28, opacity: 0 }) : { opacity: 0, y: 10 }, { x: 0, y: 0, yPercent: 0, opacity: 1, duration: opening ? 0.75 : 0.4, ease: 'expo.out', stagger: opening ? 0.05 : 0.02, clearProps: 'transform,opacity', overwrite: true });
  $('[data-focus-title]').focus({ preventScroll: true });
}
function closeFocus(silent) {
  if (focus.hidden) return; focus.hidden = true; focusId = null;
  if (city) city.setViewOffset(0);
  if (silent) return;
  pillIdle(); history.replaceState(null, '', location.pathname + location.search);
  if (city) { if (wasMap) { city.setMap(true); setMapBtn(true); } else city.view('overview'); setFollow(false); }
  idle.arm();
}
$('[data-focus-back]').addEventListener('click', () => { closeFocus(); pill.querySelector('button')?.focus(); });
focus.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closeFocus(); pill.querySelector('button')?.focus(); } });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !focus.hidden && read.hidden && pass.hidden && intro.hidden && !focus.contains(e.target)) { e.preventDefault(); closeFocus(); } });
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
  const b = h('button', { type: 'button', class: 'tile', 'aria-label': `${p.title}, ${STATUS[p.status]}. Read the story.` });
  b.append(coverEl(p, false));
  const s2 = h('span', { class: 'tile-s' }); s2.append(statusMark(p), document.createTextNode(`${STATUS[p.status]}${p.year ? ` · ${p.year}` : ''}`));
  b.append(h('span', { class: 'tile-t' }, p.title), s2, h('span', { class: 'tile-one' }, p.one));
  b.addEventListener('click', () => openRead(p.id, b));
  return b;
}

/* ---------- résumé, newsletter, contact, and who Kevin is ---------- */
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
function contactRow() {
  const act = h('div', { class: 'row-actions' });
  const li = h('a', { class: 'btn btn-ink', href: KY.contact.linkedin, target: '_blank', rel: 'noopener' }); li.append(document.createTextNode('Message me on LinkedIn'), icon('M7 17L17 7M9 7h8v8'));
  const ph = h('a', { class: 'btn btn-line', href: KY.contact.phoneHref }, `Call ${KY.contact.phone}`);
  const ps = h('button', { type: 'button', class: 'btn btn-line' }, 'Show my pass'); ps.addEventListener('click', (e) => openPass(e.currentTarget));
  act.append(li, ph, ps);
  if (!KY.contact.email) act.append(h('span', { class: 'btn btn-line', 'aria-disabled': 'true' }, 'Email, coming soon'));
  if (!KY.contact.x) act.append(h('span', { class: 'btn btn-line', 'aria-disabled': 'true' }, 'X, coming soon'));
  return act;
}
function terminus() {
  const wrap = h('div', { class: 'stack' });
  const sign = h('div', { class: 'term-sign' }); sign.append(h('p', {}, 'Next'), h('p', {}, 'Still searching.'), h('p', { lang: 'zh-Hans' }, '下一站：还在寻找')); wrap.append(sign);
  wrap.append(h('p', {}, 'The lines keep running. I keep building. If you want to build something together, this is your stop.'));
  const asks = h('ul', { class: 'asks' }); KY.contact.asks.forEach((a) => asks.append(h('li', {}, a))); wrap.append(asks, contactRow());
  const qr = h('figure', { class: 'qr' }); qr.append(h('img', { src: KY.contact.wechatQr, alt: 'WeChat QR code for Kevin Yu', width: '104', height: '104', loading: 'lazy' }), h('figcaption', {}, 'Or scan in WeChat')); wrap.append(qr);
  return wrap;
}
function introBlock(full) {
  const P = KY.person; const wrap = h('div', { class: 'intro-block' });
  if (full) { const nm = h('h2', { class: 'intro-name', id: 'intro-title', tabindex: '-1' }); nm.append(document.createTextNode(P.name), h('span', { lang: 'zh-Hans' }, P.alt[1])); wrap.append(nm); }
  wrap.append(h('p', { class: 'intro-line' }, P.short));
  const facts = h('ul', { class: 'intro-facts' });
  [['Started', P.since.replace('First line of code: ', 'First line of code, ').replace(/\.$/, '')], ['Works in', `${P.languages} · ${P.places}`], ['How', 'Builds by directing AI coding agents']].forEach(([k, v]) => { const li = h('li'); li.append(h('span', {}, k), h('b', {}, v)); facts.append(li); });
  wrap.append(facts);
  const legend = h('ul', { class: 'intro-lines', 'aria-label': 'The lines' });
  LINES.filter((l) => l.id !== 'c').forEach((l) => { const li = h('li'); li.append(lineChip(l.id), h('span', {}, l.def.label)); legend.append(li); });
  wrap.append(legend, contactRow());
  return wrap;
}
const intro = $('[data-intro]');
let introFrom = null;
function openIntro(from) {
  introFrom = from || document.activeElement; intro.hidden = false; $('[data-intro-body]').textContent = ''; $('[data-intro-body]').append(introBlock(true));
  if (G && !reduce) G.fromTo('.intro-card', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', clearProps: 'transform,opacity' });
  $('#intro-title').focus({ preventScroll: true });
}
function closeIntro() { if (intro.hidden) return; intro.hidden = true; try { sessionStorage.setItem('km-intro', '1'); } catch (e) { /* private mode */ } introFrom?.focus?.({ preventScroll: true }); idle.arm(); }
$$('[data-intro-close]').forEach((b) => b.addEventListener('click', closeIntro));
$('[data-intro-ride]').addEventListener('click', () => { closeIntro(); tvmLines(); });
intro.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closeIntro(); } else trap($('.intro-card'), e); });

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

/* ---------- the story: a short article that rises out of the card you clicked ---------- */
const read = $('[data-read]'); const readIn = $('.read-in', read);
let readFrom = null; let readId = null; let readPushed = false; let readTween = null;
function mediaNode(m, p, lead) {
  const f = h('figure', { class: lead ? 'art-figure art-lead-fig' : 'art-figure' });
  if (m.type === 'img') f.append(h('img', { src: m.src, alt: m.alt || '', decoding: 'async', loading: lead ? 'eager' : 'lazy' }));
  else if (m.type === 'video') { const v = h('video', { src: m.src, poster: m.poster || '', playsinline: '', muted: '', loop: '', 'aria-label': m.alt || '' }); v.muted = true; if (reduce) v.setAttribute('controls', ''); else { v.autoplay = true; v.play().catch(() => {}); } f.append(v); }
  else if (m.type === 'yt') { const b = h('button', { type: 'button', class: 'yt-btn', 'aria-label': `Play ${m.alt || 'video'} from YouTube` }); b.style.backgroundImage = `url("https://i.ytimg.com/vi/${m.id}/hqdefault.jpg")`; const sp = h('span'); const pl = sv('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }); sv('path', { d: 'M7 4.5v15l13-7.5z' }, pl); sp.append(pl); b.append(sp); b.addEventListener('click', () => { const fr = h('iframe', { src: `https://www.youtube-nocookie.com/embed/${m.id}?autoplay=1&rel=0`, title: m.alt || 'YouTube video', allow: 'autoplay; encrypted-media; picture-in-picture', allowfullscreen: '' }); b.replaceWith(fr); }, { once: true }); f.append(b); }
  else if (m.type === 'mock') f.append(mockSvg(m.mock));
  else if (m.type === 'stickers') f.append(stickerScene(m));
  else return null;
  if (m.alt && m.type !== 'stickers') f.append(h('figcaption', {}, m.type === 'mock' ? `${m.alt} (illustration)` : m.alt));
  return f;
}
function mediaList(p) {
  const list = []; const c = p.cover || {};
  if (c.type && c.type !== 'none') list.push(c);
  (p.media || []).forEach((m) => { if (list.some((x) => (x.src && x.src === m.src) || (x.type === 'mock' && m.type === 'mock'))) return; list.push(m); });
  return list;
}
function fillRead(p) {
  const d = destOfProject(p.id); const st = d ? STBY[d.station] : null; const lid = CATLINE[p.category];
  const crumb = $('[data-read-crumb]'); crumb.textContent = ''; crumb.append(lineChip(lid), document.createTextNode(` ${lineName(lid)}${st ? ` · ${st.name}` : ''}${d ? ` · ${d.name}` : ''}`));
  $('[data-read-back-label]').textContent = st ? `Back to ${st.name}` : 'Back';
  const art = $('[data-art]'); art.textContent = ''; art.style.setProperty('--lc', LBY[lid].def.css);
  const list = mediaList(p);
  const leadWrap = h('div', { class: 'art-lead' }); const lead = list[0] ? mediaNode(list[0], p, true) : null;
  if (lead) leadWrap.append(lead); else { const e = h('div', { class: 'media-empty' }); e.append(h('span', {}, 'Images coming soon')); leadWrap.append(e); }
  const head = h('header', { class: 'art-head' });
  const status = h('p', { class: 'art-status' }); status.append(statusMark(p), document.createTextNode(` ${STATUS[p.status]} · ${CAT[p.category]}${p.year ? ` · ${p.year}` : ''}`));
  head.append(status, h('h2', { id: 'read-title', class: 'art-title' }, p.title), h('p', { class: 'art-dek' }, p.one), h('p', { class: 'art-role' }, p.role || ''));
  const body = h('div', { class: 'art-body' });
  if (p.intro) body.append(h('p', { class: 'art-intro' }, p.intro)); else (p.body || []).forEach((t) => body.append(h('p', { class: 'art-intro' }, t)));
  if (p.stats && p.stats.length) { const row = h('dl', { class: 'art-stats' }); p.stats.forEach((s) => { const x = h('div'); x.append(h('dt', {}, s.n), h('dd', {}, s.l)); row.append(x); }); body.append(row); }
  (p.sections || []).forEach((s) => { const sec = h('section', { class: 'art-sec' }); sec.append(h('h3', {}, s.h), h('p', {}, s.p)); body.append(sec); });
  if (p.facts && p.facts.length) { const ul = h('ul', { class: 'facts' }); p.facts.forEach((f) => ul.append(h('li', {}, f))); const sec = h('section', { class: 'art-sec' }); sec.append(h('h3', {}, 'In detail'), ul); body.append(sec); }
  const links = h('div', { class: 'read-links' }); (p.links || []).forEach((l, i) => { const a = h('a', { class: `btn ${i ? 'btn-line' : 'btn-ink'}`, href: l.href, target: '_blank', rel: 'noopener' }, l.label); a.append(icon('M7 17L17 7M9 7h8v8')); links.append(a); });
  if (p.private) links.append(h('span', { class: 'btn btn-line', 'aria-disabled': 'true' }, 'Private client tool · demo on request'));
  if (links.childNodes.length) body.append(links);
  const gal = list.slice(1).map((m) => mediaNode(m, p, false)).filter(Boolean);
  if (gal.length) { const g = h('div', { class: 'art-gallery' }); gal.forEach((n) => g.append(n)); const sec = h('section', { class: 'art-sec art-gal-sec' }); sec.append(h('h3', {}, 'Gallery'), g); body.append(sec); }
  // previous and next, along the lines
  const k = READ_ORDER.indexOf(p.id); const nav = h('nav', { class: 'art-next', 'aria-label': 'More stories' });
  [[READ_ORDER[k - 1], 'Previous'], [READ_ORDER[k + 1], 'Next']].forEach(([id, lab]) => {
    if (!id) { nav.append(h('span')); return; }
    const q = projById[id]; const ql = CATLINE[q.category]; const b = h('button', { type: 'button', class: `art-nb${lab === 'Next' ? ' is-next' : ''}` });
    const tt = h('span', { class: 'art-nb-k' }); tt.append(document.createTextNode(`${lab} `), lineChip(ql), document.createTextNode(` ${LBY[ql].def.label}`));
    b.append(tt, h('b', {}, q.title), h('span', {}, q.one)); b.addEventListener('click', () => { openRead(id, null, { swap: true }); history.replaceState(null, '', `#/${id}`); });
    nav.append(b);
  });
  art.append(leadWrap, head, body, nav);
  $('[data-read-prev]').disabled = k <= 0; $('[data-read-next]').disabled = k >= READ_ORDER.length - 1;
}
async function openRead(id, from, opts = {}) {
  const p = projById[id]; if (!p) return;
  readId = id;
  if (!opts.fromHash && location.hash !== `#/${id}`) { history.pushState(null, '', `#/${id}`); readPushed = true; }
  fillRead(p); readIn.scrollTop = 0;
  if (opts.swap) { if (G && !reduce) G.fromTo('.art > *', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.04, ease: 'expo.out', clearProps: 'transform,opacity' }); $('[data-read-back]').focus({ preventScroll: true }); return; }
  if (!read.hidden && !readTween) return;
  readFrom = from || document.activeElement;
  // the camera flies into the building first, then the page rises out of the card
  const d = destOfProject(id);
  if (city && d && d.hit && !opts.fromHash && focusId !== d.id) { city.focusOn(d); await wait(420); }
  if (readId !== id) return;
  if (readTween) { readTween.kill(); readTween = null; }
  read.hidden = false; doc.style.overflow = 'hidden';
  const card = from && from.getBoundingClientRect ? from.getBoundingClientRect() : null;
  if (G && !reduce) {
    const ins = card ? `inset(${card.top}px ${innerWidth - card.right}px ${innerHeight - card.bottom}px ${card.left}px round 14px)` : 'inset(18% 18% 18% 18% round 14px)';
    readTween = G.timeline({ onComplete: () => { readTween = null; if (city) city.pause(); } });
    readTween.fromTo(readIn, { clipPath: ins }, { clipPath: 'inset(0px 0px 0px 0px round 0px)', duration: 0.75, ease: 'expo.inOut', clearProps: 'clipPath' })
      .fromTo('.art > *, .read-bar > *', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'expo.out', stagger: 0.05, clearProps: 'transform,opacity' }, 0.32);
  } else if (city) city.pause();
  $('[data-read-back]').focus({ preventScroll: true });
}
function closeRead(opts = {}) {
  if (read.hidden) return;
  const finish = () => { read.hidden = true; $('[data-art]').querySelectorAll('video').forEach((v) => v.pause()); doc.style.overflow = ''; readTween = null; };
  if (city) city.resume();
  if (readTween) readTween.kill();
  const card = readFrom && readFrom.isConnected && readFrom.getBoundingClientRect ? readFrom.getBoundingClientRect() : null;
  if (G && !reduce && card && card.width) {
    readTween = G.to(readIn, { clipPath: `inset(${card.top}px ${innerWidth - card.right}px ${innerHeight - card.bottom}px ${card.left}px round 14px)`, duration: 0.55, ease: 'expo.inOut', onComplete: () => { finish(); G.set(readIn, { clearProps: 'clipPath' }); } });
  } else finish();
  if (!opts.fromHash) { if (readPushed) { readPushed = false; history.back(); } else history.replaceState(null, '', `#/station/${cur}`); }
  readFrom?.focus?.({ preventScroll: true });
}
$('[data-read-back]').addEventListener('click', () => closeRead());
$('[data-read-prev]').addEventListener('click', () => { const k = READ_ORDER.indexOf(readId); if (k > 0) { openRead(READ_ORDER[k - 1], null, { swap: true }); history.replaceState(null, '', `#/${readId}`); } });
$('[data-read-next]').addEventListener('click', () => { const k = READ_ORDER.indexOf(readId); if (k < READ_ORDER.length - 1) { openRead(READ_ORDER[k + 1], null, { swap: true }); history.replaceState(null, '', `#/${readId}`); } });
const trap = (root, e) => { if (e.key !== 'Tab') return; const f = $$('button:not([disabled]), a[href], iframe, video[controls], [tabindex="-1"]#intro-title', root).filter((n) => n.offsetParent !== null && n.tabIndex >= 0); if (!f.length) return; const a = f[0]; const z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } };
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

/* ---------- hover tip ---------- */
const tip = h('div', { class: 'hover-tip', 'aria-hidden': 'true' }); document.body.append(tip);
function tipFor(pick) {
  tip.textContent = '';
  const line1 = h('span', { class: 'tip-k' }); const big = h('b'); const sub = h('span', { class: 'tip-sub' }); const act = h('span', { class: 'tip-act' });
  if (pick.type === 'dest') {
    const d = DID[pick.id]; const st = STBY[d.station]; const here = d.station === cur && !riding && !(city && city.moving());
    st.lines.forEach((lid) => line1.append(lineChip(lid))); line1.append(document.createTextNode(st.name));
    big.textContent = d.name; sub.textContent = d.projects ? d.projects.map((id) => SHORT[id] || projById[id].title).join(' · ') : d.label;
    act.textContent = here ? 'You’re here · Open' : 'Open';
  } else if (pick.type === 'plot') {
    const pl = PLOTS.find((x) => x.id === pick.id); line1.append(document.createTextNode(pl ? pl.near : 'Empty plot'));
    big.textContent = 'Next project'; sub.textContent = 'Under construction: still searching'; act.textContent = 'A station and a building go here';
  } else if (pick.type === 'station') {
    const st = STBY[pick.id]; st.lines.forEach((lid) => line1.append(lineChip(lid))); line1.append(document.createTextNode('Station'));
    big.textContent = st.name; sub.textContent = DEST.filter((d) => d.station === st.id).map((d) => d.name).join(' · ') || 'Interchange';
    act.textContent = st.id === cur && !riding ? 'You’re here · Open' : 'Ride here';
  } else { const lid = city ? city.focusLine() : '1'; line1.append(lineChip(lid), document.createTextNode(lineName(lid))); big.textContent = 'The train'; sub.textContent = riding && rideLeg ? `Next stop: ${STBY[rideLeg.to].name}` : 'Four cars, in the line colour'; act.textContent = 'Follow the train'; }
  tip.append(line1, big, sub, act);
}
let tipKey = ''; let tipTimer = null; const lastPtr = [0, 0]; addEventListener('pointerdown', (e) => { lastPtr[0] = e.clientX; lastPtr[1] = e.clientY; }, { passive: true });
function onHover(pick, x, y) {
  if (!pick) { tip.classList.remove('is-on'); tipKey = ''; return; }
  const key = JSON.stringify(pick) + riding + cur; if (key !== tipKey) { tipFor(pick); tipKey = key; }
  if (x != null) { const w = tip.offsetWidth; const left = Math.min(innerWidth - w - 8, x + 16); tip.style.transform = `translate(${left}px, ${Math.max(8, y - 12 - tip.offsetHeight)}px)`; tip.classList.add('is-on'); }
}

/* ---------- keys and links ---------- */
addEventListener('keydown', (e) => {
  if (!read.hidden || !pass.hidden || !intro.hidden || e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
  const l = LBY[hudLine]; const i = l.stations.findIndex((p) => p.id === cur);
  if (e.key === 'ArrowRight' && i >= 0) { e.preventDefault(); rideToStation(l.stations[(i + 1) % l.stations.length].id); }
  if (e.key === 'ArrowLeft' && i >= 0) { e.preventDefault(); rideToStation(l.stations[(i - 1 + l.stations.length) % l.stations.length].id); }
  if (e.key.toLowerCase() === 'm' && city) { e.preventDefault(); mapBtn.click(); }
});
function route() {
  const m = location.hash.match(/^#\/(station\/)?([\w-]+)$/);
  if (!m) return null;
  if (m[1]) return STBY[m[2]] ? { station: m[2] } : null;
  const d = destOfProject(m[2]); if (d) return { station: d.station, project: m[2], dest: d.id };
  if (DID[m[2]]) return { station: DID[m[2]].station, dest: m[2] };
  return null;
}
addEventListener('hashchange', () => {
  const r = route(); if (!r) { closeRead({ fromHash: true }); if (!location.hash) closeFocus(); return; }
  const jump = () => { if (r.station !== cur && !riding) { cur = r.station; if (city) { const lid = STBY[cur].lines[0]; city.board(lid, cur, { instant: true }); hudLine = lid; drawHud(); } } };
  if (r.project) { jump(); if (focusId !== r.dest) openFocus(r.dest, { fromHash: true }); openRead(r.project, null, { fromHash: true }); }
  else { closeRead({ fromHash: true }); jump(); const id = r.dest || placeAt(r.station); if (focusId !== id) openFocus(id, { fromHash: true }); }
});

/* ---------- boot: the 3D city, or the flat network map without WebGL ---------- */
let wasMoving = false;
const webgl = () => { if (/[?&]flat/.test(location.search)) return false; try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } };
async function boot() {
  const stage = $('[data-stage]');
  const r = route();
  cur = r ? r.station : 'kevin';
  if (webgl()) {
    try {
      // the city is built from the model library (models/); without it, or without WebGL, the flat network map is shown
      const mq = location.search.match(/[?&]models=([^&]+)/); const { loadLibrary } = await import('./models.js');
      const lib = mq && mq[1] === 'off' ? null : await loadLibrary(mq ? decodeURIComponent(mq[1]) : MODELS.base);
      if (!lib) throw new Error('the model library is not available');
      const { createCity } = await import('./scene.js');
      city = createCity(stage, {
        reduce, isPhone: phone.matches, destinations: DEST, lib,
        onProgress: (lid, f) => { placeHud(lid, f); if (f !== Math.floor(f) && !wasMoving) { wasMoving = true; markHere(); } const bar = $('[data-ride-progress]'); if (bar && rideLeg) { const l = LBY[lid]; const a = l.stations.findIndex((p) => p.id === rideLeg.from); const b = l.stations.findIndex((p) => p.id === rideLeg.to); const n = l.stations.length; const span = l.closed ? ((b - a + n) % n) || n : b - a; const done = l.closed ? ((f - a + n) % n) : f - a; bar.style.setProperty('--p', Math.min(1, Math.max(0, span ? done / span : 1))); } },
        onHover,
        onFree: (on) => { if (on) setFollow(false); },
        onMode: (m) => setMapBtn(m === 'map'),
        onArrive: (lid, sid, o) => {
          wasMoving = false;
          if (!o.cruise) { markHere(); return; }
          cur = sid; markHud(); markHere(); city.highlight(sid);
          setNow('Now at', STBY[sid].name, lid); history.replaceState(null, '', `#/station/${sid}`);
        },
        onPick: (p) => {
          onHover(null);
          if (p.type === 'train') { city.view(riding ? 'ride' : city.moving() ? 'follow' : 'platform'); setFollow(true); setMapBtn(false); return; }
          if (p.type === 'station') { rideToStation(p.id); return; }
          if (p.type === 'plot') { tipFor(p); tip.style.transform = `translate(${Math.min(innerWidth - 300, lastPtr[0] + 16)}px, ${Math.max(8, lastPtr[1] - 120)}px)`; tip.classList.add('is-on'); clearTimeout(tipTimer); tipTimer = setTimeout(() => onHover(null), 2600); return; }
          const d = DID[p.id]; if (!d) return; selected = d;
          // a click on a building goes straight to it: the camera flies in and its section opens
          clearTimeout(autoBoard); idle.stop(); rideSeq++; riding = false; rideLeg = null;
          if (d.station !== cur || city.moving()) { cur = d.station; const lid = STBY[cur].lines.includes(d.line) ? d.line : STBY[cur].lines[0]; city.board(lid, cur, { instant: true }); hudLine = lid; drawHud(); setNow('Now at', STBY[cur].name, lid); markHere(); }
          openFocus(d.id);
        },
      });
      const lid0 = STBY[cur].lines.includes('1') ? '1' : STBY[cur].lines[0];
      city.board(lid0, cur, { instant: true }); hudLine = lid0;
    } catch (e) { console.warn('3D city unavailable; showing the network map.', e); city = null; stage.textContent = ''; }
  }
  if (!city) {
    const { renderFallback } = await import('./fallback.js');
    stage.classList.add('is-flat'); $('[data-map]').hidden = true; followBtn.hidden = true; $('.stage-hint').hidden = true; hudTrain.style.display = 'none';
    renderFallback(stage, { net, dests: DEST, onDest: (d) => { cur = d.station; markHud(); openFocus(d.id); } });
  }
  if (/[?&]debug/.test(location.search)) window.__kmetro = { city, rideTo, rideToStation, openFocus, closeFocus, openRead, openIntro, onHover, DEST, net };
  drawHud();
  const st = STBY[cur]; setNow('Now at', st.name, hudLine);
  pillIdle();
  if (city) {
    city.highlight(cur);
    city.view('overview', { instant: true }); setFollow(false);
  }
  let seen = false; try { seen = sessionStorage.getItem('km-intro') === '1'; } catch (e) { /* private mode */ }
  if (r && r.project) { openFocus(r.dest, { fromHash: true }); openRead(r.project, null, { fromHash: true }); }
  else if (r) openFocus(r.dest || placeAt(r.station), { fromHash: true });
  else if (!r) { history.replaceState(null, '', location.pathname + location.search); if (!seen && !/[?&]nointro/.test(location.search)) openIntro(); }
  if (city && intro.hidden) idle.arm();
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot); else boot();
