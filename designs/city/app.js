/* Island city · the page
   Owns the story: the opening, the metro line strip (the one control), the ride that plays when a project is
   picked, the look at its building, and the page that comes in beside it. The island itself is world.js (or
   map2d.js without WebGL).

   Address bar, for testing:  ?time=dawn|day|golden|night  ?weather=clear|rain|fog  ?look=film|model
                              ?nointro  ?reduce  ?2d  ?speed=4  ?debug      and  #/<project id>, #/tower */
import { DISTRICTS, TOWNS, PROJECTS, TRAM, levelOf } from './city-data.js';
import { PLACES, LOOP_LEN } from './track.js';
import { createSim } from './sim.js';
import { h, icon, projectPage, towerPage, levelText, levelMeter } from './pages.js';

const KY = window.KY; const Q = new URLSearchParams(location.search);
const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduce = Q.has('reduce') || matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPEED = clamp(parseFloat(Q.get('speed')) || 1, 0.25, 12); const DEBUG = Q.has('debug');
const phone = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
if (reduce) document.documentElement.classList.add('reduce');

/* ---------- the towns and their projects ---------- */
const DIST = Object.fromEntries(DISTRICTS.map((d) => [d.id, d]));
const first = KY.person.name.split(' ')[0];
const towns = PLACES.map((p) => { const t = TOWNS.find((q) => q.id === p.id); const d = DIST[t.district] || {}; return { ...t, s: p.s, color: d.color || '#16171A', label: d.label || '', projects: [] }; });
const townById = Object.fromEntries(towns.map((t) => [t.id, t])); const MAIN = (towns.find((t) => t.main) || towns[0]).id;
const all = PROJECTS.map((row, pi) => { const project = KY.projects.find((p) => p.id === row.project) || null; const town = townById[row.town] || towns[0]; return { ...row, pi, project, town, district: town.district, level: levelOf(row, project), title: project ? project.title : row.building, short: row.short || (project ? project.title : row.building), color: town.color, townName: town.name, code: town.code }; });
all.forEach((s) => s.town.projects.push(s));
const stops = towns.flatMap((t) => t.projects); stops.forEach((s, i) => { s.i = i; }); // the order of the tour: town by town round the loop
const stopById = Object.fromEntries(stops.map((s) => [s.id, s]));
const levels = Object.fromEntries(stops.map((s) => [s.id, s.level]));
const isTown = (id) => !!townById[id]; const valid = (id) => id === 'tower' || !!stopById[id] || isTown(id);
const nameOf = (id) => (id === 'tower' ? `${first}’s tower` : stopById[id] ? stopById[id].title : isTown(id) ? `${townById[id].code} ${townById[id].name}` : '');
const shortOf = (id) => (id === 'tower' ? `${first}’s tower` : stopById[id] ? stopById[id].short : isTown(id) ? townById[id].name : '');
const townOf = (id) => (id === 'tower' ? MAIN : stopById[id] ? stopById[id].town.id : id);
const nextOf = (id) => (stopById[id] ? stops[(stopById[id].i + 1) % stops.length].id : id === 'tower' ? stops[0].id : isTown(id) && townById[id].projects[0] ? townById[id].projects[0].id : stops[0].id);

/* ---------- time of day and weather ---------- */
const TIME_LABEL = { dawn: 'Dawn', day: 'Day', golden: 'Golden hour', night: 'Night' }; const WEATHER_LABEL = { clear: 'Clear', rain: 'Rain', fog: 'Fog' };
function clockTime() { const d = new Date(); const t = d.getHours() + d.getMinutes() / 60; return t >= 5 && t < 8 ? 'dawn' : t >= 8 && t < 16.5 ? 'day' : t >= 16.5 && t < 19.5 ? 'golden' : 'night'; }
function rollWeather() { const r = Math.random(); return r < 0.72 ? 'clear' : r < 0.86 ? 'rain' : 'fog'; }
const sky = { time: TIME_LABEL[Q.get('time')] ? Q.get('time') : clockTime(), weather: WEATHER_LABEL[Q.get('weather')] ? Q.get('weather') : rollWeather(), look: Q.get('look') === 'model' ? 'model' : 'film' };
const SKY_ICON = { day: 'M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z|M12 2v2.5|M12 19.5V22|M2 12h2.5|M19.5 12H22|M4.9 4.9l1.8 1.8|M17.3 17.3l1.8 1.8|M4.9 19.1l1.8-1.8|M17.3 6.7l1.8-1.8', dawn: 'M3 18h18|M6.5 18a5.5 5.5 0 0 1 11 0|M12 5v4|M9.5 7.5L12 5l2.5 2.5|M4.5 12.5l1.8 1.4|M19.5 12.5l-1.8 1.4', golden: 'M3 18h18|M6.5 18a5.5 5.5 0 0 1 11 0|M12 9V5|M9.5 6.5L12 9l2.5-2.5|M4.5 12.5l1.8 1.4|M19.5 12.5l-1.8 1.4', night: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z', rain: 'M7 15a4 4 0 0 1 .6-7.95A5.5 5.5 0 0 1 18 8.5a3.3 3.3 0 0 1-.5 6.5z|M8.5 18l-1 3|M12.5 18l-1 3|M16.5 18l-1 3', fog: 'M4 9h16|M4 13h12|M7 17h13|M10 5h8' };
const GO = 'M5 12h14|M13 6l6 6-6 6';

/* ---------- state ---------- */
const sim = createSim();
/* at = the town the visitor is in; here = the last place arrived at (a project, a town or the tower) */
/* onFoot = the town the visitor is standing in, having just closed a page there: only then is the way to a
   neighbour a walk. From the overview (or after Reset) they always come in by train. */
const S = { phase: 'loading', at: MAIN, here: MAIN, page: null, pageMode: null, focus: null, ride: null, opening: null, view3d: false, onFoot: null };
let view = null; // the 3D island, or the 2D map when WebGL is missing
const live = $('[data-live]'); const say = (t) => { live.textContent = ''; requestAnimationFrame(() => { live.textContent = t; }); };

/* ---------- top bar ---------- */
$('[data-owner]').textContent = KY.person.name; $('[data-roundel]').textContent = first[0];
$('[data-brand]').setAttribute('aria-label', `${KY.person.name}. Look at ${first}’s tower: who I am, résumé, contact`);
$('[data-brand]').addEventListener('click', () => (S.view3d && !reduce ? look('tower') : go('tower')));
{ const el = $('[data-sky]'); el.hidden = false; $('[data-sky-icon]').append(icon(SKY_ICON[sky.weather !== 'clear' ? sky.weather : sky.time])); $('[data-sky-text]').textContent = `${TIME_LABEL[sky.time]} · ${WEATHER_LABEL[sky.weather]}`; el.title = Q.get('time') || Q.get('weather') ? 'Set in the address bar' : 'The light follows your clock. The weather changes every visit.'; }
$$('[data-look]').forEach((b) => b.addEventListener('click', () => setLook(b.dataset.look)));
function setLook(l) { sky.look = l; $$('[data-look]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.look === l))); document.documentElement.dataset.look = l; if (view) view.setLook(l); }
$('[data-reset]').addEventListener('click', () => { if (!view || (S.ride && !S.ride.out) || S.phase === 'opening' || S.phase === 'loading') return; S.ride = null; S.onFoot = null; if (S.page) { hidePage({ quiet: true }); history.replaceState(null, '', location.pathname + location.search); } S.phase = 'idle'; sim.release(4); clearFocus(); view.resetView(true); paintStrip(); say('Back to the whole island'); });

/* ---------- the line strip: the route map above a train door ---------- */
const stripEl = $('[data-strip]'); const lineEl = $('[data-line]'); const stripScroll = $('[data-strip-scroll]');
const cells = {}; const chips = {}; const marks = [];
function buildStrip() {
  lineEl.textContent = ''; lineEl.style.setProperty('--n', towns.length);
  const row = h('ol', { class: 'stations' });
  towns.forEach((t) => {
    const btn = h('button', { type: 'button', class: 'st-b', 'data-stop': t.id, 'aria-label': `${t.code} ${t.name}, ${t.label}. Ride there and see the town.` }, h('span', { class: 'code', style: `--c:${t.color}` }, t.code), h('span', { class: 'st-n' }, h('b', { text: t.name }), h('span', { text: t.label })));
    btn.addEventListener('click', () => go(t.id));
    const list = h('ul', { class: 'chips' }, t.projects.map((s) => { const c = h('button', { type: 'button', class: 'chip-p', 'data-stop': s.id, 'aria-label': `${s.title}. ${s.building}, ${levelText(s.level)}. The train takes you there.` }, h('i', { style: `background:${s.color}` }), s.short); c.addEventListener('click', () => go(s.id)); c.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showTip(s.id, c); }); c.addEventListener('pointerleave', hideTip); c.addEventListener('focus', () => { if (c.matches(':focus-visible')) showTip(s.id, c); }); c.addEventListener('blur', hideTip); chips[s.id] = c; return h('li', {}, c); }));
    if (t.main) { const tb = h('button', { type: 'button', class: 'chip-p chip-tram', 'data-stop': 'tower', 'aria-label': `Hill tram, ${TRAM.stops[0].code} to ${TRAM.stops[1].code}: ${first}’s tower. About ${first}, résumé and contact.` }, h('span', { class: 'code code-t' }, TRAM.stops[1].code), `${first}’s tower`); tb.addEventListener('click', () => go('tower')); chips.tower = tb; list.append(h('li', { class: 'is-tram' }, tb)); }
    const weight = t.projects.reduce((n, p) => n + p.short.length + 6, t.main ? 19 : 0); const li = h('li', { class: `station${t.main ? ' is-main' : ''}`, style: `--c:${t.color};flex-grow:${weight}` }, btn, list); row.append(li); cells[t.id] = { li, btn };
  });
  lineEl.append(row, h('span', { class: 'rail', 'aria-hidden': 'true' }));
  sim.trains.forEach((t) => { const m = h('span', { class: `mark ${t.dir > 0 ? 'is-cw' : 'is-acw'}`, 'aria-hidden': 'true' }); m.append(icon('M2 3h17l5 4.5-5 4.5H2z', '0 0 26 15')); lineEl.append(m); marks.push(m); });
  stripEl.addEventListener('pointerenter', () => { if (view && view.laneGlow) view.laneGlow(true); }); stripEl.addEventListener('pointerleave', () => { if (view && view.laneGlow) view.laneGlow(false); });
}
function keepInView(id) { const c = cells[townOf(id)]; if (!c || stripScroll.scrollWidth <= stripScroll.clientWidth + 2) return; const x = c.li.offsetLeft + c.li.offsetWidth / 2 - stripScroll.clientWidth / 2; stripScroll.scrollTo({ left: clamp(x, 0, stripScroll.scrollWidth), behavior: reduce ? 'auto' : 'smooth' }); }
const atK = $('[data-at-k]'); const atEl = $('[data-at]'); const nextBtn = $('[data-next]'); const nextName = $('[data-next-name]'); const nextK = $('.next-k', nextBtn);
function paintStrip() {
  const riding = !!S.ride && !S.ride.out; const dest = riding ? S.ride.id : null;
  towns.forEach((t) => { const c = cells[t.id]; c.li.classList.toggle('is-here', !riding && S.at === t.id); c.li.classList.toggle('is-dest', riding && townOf(dest) === t.id); if (!riding && S.at === t.id) c.btn.setAttribute('aria-current', 'location'); else c.btn.removeAttribute('aria-current'); });
  Object.entries(chips).forEach(([id, c]) => { c.classList.toggle('is-here', !riding && (S.page === id || S.focus === id)); c.classList.toggle('is-dest', dest === id); });
  atK.textContent = riding ? 'Riding to' : S.phase === 'opening' ? 'Building the island' : 'You are at'; atEl.textContent = riding ? nameOf(dest) : S.phase === 'opening' ? `${towns.length} towns, ${stops.length} projects` : S.here === 'tower' ? nameOf('tower') : stopById[S.here] ? `${stopById[S.here].short} · ${townById[S.at].name}` : nameOf(S.at);
  nextBtn.classList.toggle('is-skip', riding || S.phase === 'opening'); nextK.textContent = riding ? 'On the way' : S.phase === 'opening' ? 'Opening' : 'Next stop';
  nextName.textContent = riding ? 'Skip the ride' : S.phase === 'opening' ? 'Skip' : shortOf(nextOf(S.here));
  nextBtn.setAttribute('aria-label', riding ? `Skip the ride and go straight to ${nameOf(dest)}` : S.phase === 'opening' ? 'Skip the opening' : `Next stop: ${nameOf(nextOf(S.here))}. The train takes you there.`);
}
nextBtn.addEventListener('click', () => { if (S.phase === 'opening') { finishOpening(); return; } if (S.ride && !S.ride.out) { skipRide(); return; } go(nextOf(S.here)); });
// where the trains are on the strip
let cellX = null;
function measureStrip() { cellX = { x: towns.map((t) => { const c = cells[t.id].btn.querySelector('.code'); return c.offsetLeft + c.offsetWidth / 2 + cells[t.id].li.offsetLeft; }), y: 0 }; const c0 = cells[towns[0].id]; cellX.y = c0.li.offsetTop + c0.btn.offsetTop + c0.btn.querySelector('.code').offsetTop + c0.btn.querySelector('.code').offsetHeight / 2; cellX.end = lineEl.scrollWidth - 14; }
function paintMarks() {
  if (!cellX) measureStrip(); const n = towns.length;
  sim.trains.forEach((t, k) => {
    const s = ((t.s % LOOP_LEN) + LOOP_LEN) % LOOP_LEN; let i = n - 1; for (let j = 0; j < n; j++) if (towns[j].s <= s + 1e-6) i = j;
    const a = towns[i].s; const b = i === n - 1 ? LOOP_LEN : towns[i + 1].s; const f = clamp((s - a) / (b - a || 1), 0, 1); let x; let o = 1;
    if (i < n - 1) x = cellX.x[i] + (cellX.x[i + 1] - cellX.x[i]) * f; else if (f < 0.5) { x = cellX.x[i] + (cellX.end - cellX.x[i]) * (f / 0.5); o = 1 - Math.max(0, f - 0.35) / 0.15; } else { x = cellX.x[0] - (cellX.x[0] - 6) * (1 - (f - 0.5) / 0.5); o = Math.min(1, (f - 0.5) / 0.15); }
    marks[k].style.transform = `translate3d(${x.toFixed(1)}px,${(cellX.y + (t.dir > 0 ? -27 : 18)).toFixed(1)}px,0) scaleX(${t.dir})`; marks[k].style.opacity = o.toFixed(2);
  });
}

/* ---------- the hover card ---------- */
const tip = $('[data-tip]'); let tipFor = null;
function tipBody(id) {
  tip.textContent = '';
  if (id === 'tower') { tip.append(h('p', { class: 'tip-k' }, h('i', { class: 'dot', style: 'background:#D5281E' }), 'Hill tram'), h('b', { text: `${first}’s tower` }), h('p', { class: 'tip-one', text: 'Who I am, my résumé and how to reach me.' })); return; }
  if (isTown(id)) { const t = townById[id]; tip.append(h('p', { class: 'tip-k' }, h('i', { class: 'dot', style: `background:${t.color}` }), `${t.code} · ${t.label}`), h('b', { text: t.name }), h('p', { class: 'tip-one', text: t.what || '' })); return; }
  const s = stopById[id]; if (!s) return;
  tip.append(h('p', { class: 'tip-k' }, h('i', { class: 'dot', style: `background:${s.color}` }), `${s.code} ${s.townName} · ${s.town.label}`), h('b', { text: s.title }), h('p', { class: 'tip-l' }, levelMeter(s.level), `${s.building} · ${levelText(s.level)}`), s.project && s.project.one ? h('p', { class: 'tip-one', text: s.project.one }) : null);
}
function placeTip(x, y, above) { tip.hidden = false; const w = tip.offsetWidth; const hh = tip.offsetHeight; const left = clamp(x - w / 2, 8, innerWidth - w - 8); let top = above ? y - hh - 12 : y + 18; if (top < 8) top = y + 18; if (top + hh > innerHeight - 8) top = y - hh - 12; tip.style.transform = `translate3d(${Math.round(left)}px,${Math.round(top)}px,0)`; }
function showTip(id, anchor, pt) { if (S.phase !== 'idle' && S.phase !== 'ride' && S.phase !== 'page') return; if (tipFor !== id) { tipFor = id; tipBody(id); } if (anchor) { const r = anchor.getBoundingClientRect(); placeTip(r.left + r.width / 2, r.top, true); } else if (pt) placeTip(pt[0], pt[1], false); if (view) view.hover(isTown(id) ? null : id); }
function hideTip() { if (tipFor == null) return; tipFor = null; tip.hidden = true; if (view) view.hover(null); }

/* ---------- what the visitor is looking at ---------- */
const focusEl = $('[data-focus]'); const focusA = $('[data-focus-a]'); const focusN = h('p', { class: 'focus-n', 'aria-live': 'off' });
const actBtn = (label, cls, fn, ic) => { const b = h('button', { type: 'button', class: `btn btn-sm ${cls}` }, h('span', { text: label }), ic ? icon(ic) : null); b.addEventListener('click', fn); return b; };
const mins = (sec) => (sec < 8 ? 'now' : sec < 50 ? `${Math.round(sec / 5) * 5} s` : `${Math.round(sec / 60)} min`);
function paintBoard() { if (!S.focus || !isTown(S.focus) || focusEl.hidden) return; const n = sim.nextAt(S.focus); focusN.textContent = `Next trains: clockwise ${mins(n.cw)} · anticlockwise ${mins(n.acw)}`; }
function paintFocus() {
  const id = S.focus; const riding = S.ride && !S.ride.out;
  if (!id || riding || S.phase === 'opening' || S.phase === 'loading' || (S.page && S.pageMode === 'full')) { focusEl.hidden = true; return; }
  const k = $('[data-focus-k]'); const t = $('[data-focus-t]'); const l = $('[data-focus-l]'); k.textContent = ''; l.textContent = ''; focusA.textContent = '';
  focusEl.classList.toggle('is-hero', !!S.ride && !isTown(id)); focusEl.classList.toggle('is-town', isTown(id)); focusN.remove();
  if (id.startsWith('x:')) { const e = view && view.extra ? view.extra(id) : null; k.append(h('i', { class: 'dot', style: 'background:#16171A' }), id === 'x:lighthouse' ? 'On the east headland' : 'On the water'); t.textContent = e ? e.name : ''; focusEl.hidden = false; return; }
  const s = stopById[id];
  if (s) { k.append(h('span', { class: 'code', style: `--c:${s.color}` }, s.code), `${s.townName} · ${s.town.label}`); t.textContent = s.title; l.append(levelMeter(s.level), `${s.building} · ${levelText(s.level)}`); } else if (id === 'tower') { k.append(h('span', { class: 'code code-t' }, TRAM.stops[1].code), 'Up the hill tram'); t.textContent = `${first}’s tower`; l.textContent = 'Who I am, my résumé and how to reach me.'; } else {
    const T = townById[id]; k.append(h('span', { class: 'code', style: `--c:${T.color}` }, T.code), T.label); t.textContent = T.name; l.textContent = T.what || ''; l.after(focusN);
    if (!S.ride) { if (S.at !== id) focusA.append(actBtn('Ride here', 'btn-ink', () => go(id), GO)); T.projects.forEach((p) => focusA.append(actBtn(p.short, 'btn-p', () => go(p.id)))); }
    focusEl.hidden = false; paintBoard(); return;
  }
  if (!S.ride) {
    if (S.page === id && S.pageMode === 'tucked') focusA.append(actBtn('Read about it', 'btn-ink', () => setPageMode('side'), GO));
    else if (S.page !== id && S.here === id) focusA.append(actBtn('Read about it', 'btn-ink', () => openHere(id), GO));
    else if (S.page !== id) focusA.append(actBtn(id === 'tower' ? 'Ride up' : S.onFoot === townOf(id) ? 'Walk there' : 'Ride here', 'btn-ink', () => go(id), GO), actBtn('Read now', '', () => arrive(id)));
  }
  focusEl.hidden = false;
}
function clearFocus() { S.focus = null; focusEl.hidden = true; paintStrip(); }
$('[data-focus-x]').addEventListener('click', clearFocus);
/** Look at something on the island: the camera glides to it. No ride. */
function look(id) {
  if (!view || (S.ride && !S.ride.out) || (S.phase !== 'idle' && S.phase !== 'page' && S.phase !== 'ride')) return;
  if (S.page === id) { if (S.pageMode === 'tucked') view.hero(id, 0.9, true); return; }
  S.ride = null; if (S.page) { hidePage({ quiet: true }); history.replaceState(null, '', location.pathname + location.search); } S.phase = 'idle'; sim.release(4);
  if (id.startsWith('x:') || townOf(id) !== S.onFoot || id === 'tower') S.onFoot = null;
  hideTip();
  if (id.startsWith('x:')) { const e = view.extra && view.extra(id); if (!e) return; view.lookAtPoint(e.x, e.y, e.z, e.d, 1.0); } else if (isTown(id)) view.showTown(id, 1.2); else if (view.hero) view.hero(id, 1.1, false);
  S.focus = id; paintFocus(); paintStrip(); say(`Looking at ${id.startsWith('x:') ? (view.extra(id) || {}).name : nameOf(id)}`);
}

/* ---------- the page ---------- */
const page = $('[data-page]'); const pageBody = $('[data-page-body]'); const pageWhere = $('[data-page-where]'); const pageNext = $('[data-page-next]'); const pageNextLabel = $('[data-page-next-label]');
const stage = $('[data-stage]'); const behind = [$('.top'), stripEl, stage, focusEl]; let pageTimer = 0; let pageSettled = false;
const expandBtn = $('[data-expand]'); const tuckBtn = $('[data-tuck]');
function fillPage(id) {
  pageBody.textContent = ''; pageWhere.textContent = '';
  if (id === 'tower') { pageBody.append(towerPage({ KY, go, next: stops[0] })); pageWhere.append(h('i', { class: 'dot', style: 'background:#D5281E' }), `${first}’s tower`); } else { const s = stopById[id]; pageBody.append(projectPage(s, { stops, reduce, go })); pageWhere.append(h('i', { class: 'dot', style: `background:${s.color}` }), `${s.code} ${s.townName}`); }
  const nx = nextOf(id); pageNextLabel.textContent = `Next: ${shortOf(nx)}`; pageNext.setAttribute('aria-label', `Go on to ${nameOf(nx)}`);
  tuckBtn.setAttribute('aria-label', `Look at ${id === 'tower' ? 'the tower' : 'the building'}: tuck this page away`);
}
/* The page sits beside the building (side), fills the screen (full), or is tucked away so the building can be looked at. */
function setPageMode(mode) {
  if (!S.page) return; S.pageMode = mode; page.dataset.mode = mode; pageSettled = false; clearTimeout(pageTimer);
  const full = mode === 'full'; page.setAttribute('aria-modal', String(full)); behind.forEach((el) => { el.inert = full; });
  expandBtn.setAttribute('aria-pressed', String(full)); $('[data-expand-label]').textContent = full ? 'Shrink' : 'Expand'; expandBtn.setAttribute('aria-label', full ? 'Shrink the page so the building shows again' : 'Expand the page to the full screen');
  if (full) pageTimer = setTimeout(() => { pageSettled = true; }, 700);
  document.body.classList.toggle('has-page', mode === 'side'); placeView(); paintFocus();
  if (mode === 'tucked') { const b = $('.btn', focusA); if (b) b.focus({ preventScroll: true }); } else page.focus({ preventScroll: true });
}
/* Slide the 3D picture so its middle sits in the part of the view the page leaves free. */
function placeView() {
  if (!view || !view.setShift) return;
  if (!S.page || S.pageMode !== 'side') { view.setShift(0, 0); return; }
  const st = stage.getBoundingClientRect();
  if (innerWidth > 760) view.setShift(Math.min(page.offsetWidth, st.width * 0.6) / 2, 0); else view.setShift(0, Math.max(0, st.bottom - (innerHeight - page.offsetHeight)) / 2);
}
function showPage(id, { push = true, mode = 'side' } = {}) {
  clearTimeout(pageTimer); fillPage(id); S.page = id; S.here = id; S.at = townOf(id); S.focus = id;
  page.hidden = false; page.scrollTop = 0; void page.offsetWidth; page.classList.add('is-in');
  document.title = `${nameOf(id)} · ${KY.person.name}`;
  // one history entry for "a page is open": Back always returns to the island, however many pages were visited
  if (push && location.hash !== `#/${id}`) history[history.state && history.state.city ? 'replaceState' : 'pushState']({ city: id }, '', `#/${id}`);
  setPageMode(mode); paintStrip(); keepInView(id); hideTip(); say(`${nameOf(id)}: the page is open beside the building.`);
}
function hidePage({ quiet = false } = {}) {
  if (!S.page) return; const id = S.page; S.page = null; S.pageMode = null; pageSettled = false; clearTimeout(pageTimer);
  page.classList.remove('is-in'); behind.forEach((el) => { el.inert = false; });
  $$('video', pageBody).forEach((v) => v.pause()); $$('iframe', pageBody).forEach((f) => f.remove());
  pageTimer = setTimeout(() => { page.hidden = true; pageBody.textContent = ''; }, reduce ? 0 : 520);
  document.title = `${KY.person.name} · Island city`; document.body.classList.remove('has-page'); placeView();
  if (!quiet) { S.onFoot = id === 'tower' ? 'tower' : townOf(id); S.phase = 'idle'; sim.release(4); paintStrip(); paintFocus(); const b = $('.btn', focusA) || chips[id]; if (b) b.focus({ preventScroll: true }); say(`Page closed. You are looking at ${nameOf(id)}.`); }
}
function closePage() { if (!S.page) return; if (history.state && history.state.city) history.back(); else { history.replaceState(null, '', location.pathname + location.search); hidePage(); } }
/** Open the page of the place the visitor is already looking at. */
function openHere(id) { if (S.ride) return; S.phase = 'page'; if (view && view.hero) view.hero(id, 0.8, true); showPage(id); }
$('[data-close]').addEventListener('click', closePage);
pageNext.addEventListener('click', () => { if (S.page) go(nextOf(S.page)); });
expandBtn.addEventListener('click', () => setPageMode(S.pageMode === 'full' ? 'side' : 'full'));
tuckBtn.addEventListener('click', () => setPageMode('tucked'));
addEventListener('resize', () => { if (S.page) placeView(); });

/* ---------- the ride ---------- */
const cabin = $('[data-cabin]'); const TRAM_T = 4.2; const WALK = 3.0; const HOLD = 2.0; let cabinTimer = 0;
function cabinOff(now) { clearTimeout(cabinTimer); const off = () => { cabin.className = 'cabin'; }; if (now) off(); else { cabin.classList.add('is-out'); cabinTimer = setTimeout(off, 520); } }
function cabinOn(r) {
  clearTimeout(cabinTimer); cabin.className = `cabin is-on${S.view3d ? '' : ' is-flat'}`; const T = townById[r.town]; const s = stopById[r.id];
  cabin.style.setProperty('--c', r.tower ? '#D5281E' : T.color);
  $('[data-sign-k]').textContent = r.tower ? `Hill tram · ${TRAM.stops[1].code}` : 'Next station';
  $('[data-sign-name]').textContent = r.tower ? `${first}’s tower` : `${T.code} ${T.name}`; $('[data-sign-sub]').textContent = r.tower ? 'Mind the step' : s ? `For ${s.title} · ${s.building}` : T.label;
}
/** Take the visitor somewhere. A project: board the train that gets to its town soonest, ride, step out, walk to
    the building, look at it, then its page comes in beside it. A town: ride there and see the whole town. */
function go(id, { instant = false } = {}) {
  if (!valid(id) || S.phase === 'loading') return;
  if (S.phase === 'opening') finishOpening();
  if (S.ride && S.ride.id === id) { if (!S.ride.out) skipRide(); return; } // a second click skips to the look at the building
  if (S.page === id && !S.ride) { if (S.pageMode === 'tucked') setPageMode('side'); return; }
  hideTip();
  if (reduce || instant || !view) { arrive(id); return; }
  if (S.page) { if (!S.ride) S.onFoot = S.page === 'tower' ? 'tower' : townOf(S.page); hidePage({ quiet: true }); } // leaving an open page is closing it
  if (S.ride) cabinOff(true);
  S.focus = null; focusEl.hidden = true; sim.release(1.5);
  const tower = id === 'tower'; const town = townOf(id); const k = S.view3d ? 1 : 0.4;
  const r = { id, tower, town, t: 0, isTown: isTown(id) };
  const riding = !!(S.ride && !S.ride.out);
  const walkOnly = !tower && !riding && S.onFoot === town; // standing in this town, having just closed a page here
  const podOnly = tower && !riding && S.onFoot === MAIN;    // standing in Harbour town: straight up the hill
  if (walkOnly || podOnly) r.T = 0; else { r.train = sim.trains.reduce((b, t) => { const d = sim.toGo(t, town); return d >= 70 && (!b || d < sim.toGo(b, town)) ? t : b; }, null) || sim.nearest(town); const D = sim.toGo(r.train, town); /* a train with a little way still to go, so it is seen gliding in */ r.T = sim.rideTo(r.train, town, (tower ? clamp(3 + D / 90, 3.5, 5.5) : clamp(3.6 + D / 80, 4.6, 7)) * k); }
  // the end of the ride: the train (or, for the tower, the pod) stops at r.end
  if (tower) { r.tramStart = r.T; r.end = r.T + TRAM_T * k; } else r.end = r.T;
  if (walkOnly) { r.in = r.doors = r.stepped = true; r.outAt = 0; } else {
    r.cutIn = Math.max(tower ? r.tramStart + 0.6 : 1.6, r.end - (tower ? 2.4 : 2.8) * k); // into the car for the last seconds as it glides in
    r.doorsAt = r.end + 0.15; r.stepAt = r.end + 0.85 * k; r.outAt = r.stepAt + 1.0 * k;   // doors open, a beat, out through the doorway
  }
  r.pageAt = r.outAt + (r.isTown ? 1.5 : tower ? 1.4 + HOLD : WALK + HOLD) * k;
  S.ride = r; S.phase = 'ride'; S.onFoot = null;
  if (r.train) view.follow(view.trainSubject(r.train, false)); else if (podOnly) view.follow(view.tramSubject(sim, 1, false));
  paintStrip(); keepInView(id); say(walkOnly ? `Walking to ${nameOf(id)}` : `Riding to ${nameOf(id)}`);
}
function stepRide(dt) {
  const r = S.ride; if (!r) return; r.t += dt;
  if (r.tower && !r.tramGo && r.t >= r.tramStart) { r.tramGo = true; r.car = sim.tramUp(TRAM_T * (S.view3d ? 1 : 0.4)); if (!r.in) view.follow(view.tramSubject(sim, r.car, false)); }
  // into the car: in 3D the camera glides inside the glass car and stands by the doors (the flat map shows the drawn cabin)
  if (!r.in && r.t >= r.cutIn) { r.in = true; if (S.view3d) { if (r.tower) view.inside(view.tramSubject(sim, r.car, true)); else view.inside(view.trainSubject(r.train, true)); } else cabinOn(r); }
  if (!r.doors && r.t >= r.doorsAt) { r.doors = true; if (!S.view3d) cabin.classList.add('is-clear', 'is-open'); }
  if (!r.stepped && r.t >= r.stepAt) { r.stepped = true; if (S.view3d && view.stepOut) view.stepOut(1.0, r.tower ? null : r.town); }
  // off the platform: down to the street and along it to the building (or the whole town, or the tower)
  if (!r.out && r.t >= r.outAt) {
    r.out = true; cabinOff(false); S.at = r.town; S.here = r.id; S.focus = r.id;
    if (r.isTown) { if (view.showTown) view.showTown(r.id, 1.4); } else if (r.tower) { if (view.hero) view.hero('tower', 1.4, true); } else if (view.walkTo) view.walkTo(r.id, WALK * 0.6, WALK * 0.4);
    paintFocus(); paintStrip(); say(r.isTown ? `${nameOf(r.id)}. ${townById[r.id].projects.map((p) => p.title).join(', ')}.` : `${nameOf(r.id)}. ${stopById[r.id] ? `${stopById[r.id].building}. ${levelText(stopById[r.id].level)}.` : ''}`);
  }
  if (r.t >= r.pageAt) { S.ride = null; if (r.isTown) { S.phase = 'idle'; sim.release(4); paintFocus(); paintStrip(); } else { S.phase = 'page'; showPage(r.id); } }
}
/** A second click while riding: the train is put at the station and the look at the building starts now. */
function skipRide() { const r = S.ride; if (!r || r.out) return; if (r.tower) sim.tramPut(r.car || 1); sim.putAt(r.town); cabinOff(true); r.in = r.doors = r.stepped = r.tramGo = true; r.outAt = r.t; r.pageAt = r.t + (r.isTown ? 1.5 : r.tower ? 1.4 + HOLD : WALK + HOLD); }
/** Be there at once: no ride (reduced motion, deep links, "Read now"). */
function arrive(id, opt) {
  if (!valid(id) || S.phase === 'loading') return;
  if (S.phase === 'opening') finishOpening();
  S.ride = null; cabinOff(true); sim.putAt(townOf(id)); if (id === 'tower') sim.tramPut(1);
  if (S.page && S.page !== id) hidePage({ quiet: true });
  S.at = townOf(id); S.here = id; S.focus = id;
  if (isTown(id)) { S.phase = 'idle'; sim.release(4); if (view) view.showStation(id, false); paintFocus(); paintStrip(); return; }
  S.phase = 'page'; if (view) view.showStation(id, true);
  if (S.page !== id) showPage(id, opt); else { paintStrip(); paintFocus(); }
}

/* ---------- the opening ---------- */
const opening = $('[data-opening]'); const openingBar = $('[data-opening-bar]'); const skipBtn = $('[data-skip]');
function startOpening() {
  const n = stops.length; const step = Math.min(0.3, 4.5 / n);
  S.opening = { t: 0, step, towerAt: 1.0 + n * step + 0.1, total: 1.0 + n * step + 0.1 + 1.2 + 0.3 };
  S.phase = 'opening'; view.setAllBuilt(0); stripEl.classList.add('is-unbuilt'); Object.values(chips).forEach((c) => c.classList.add('is-unbuilt')); skipBtn.hidden = false; document.body.classList.add('is-opening');
  if (view.openingCamera) view.openingCamera(S.opening.total); paintStrip();
}
function stepOpening(dt) {
  const o = S.opening; o.t += dt; const k = (t0, d) => clamp((o.t - t0) / d, 0, 1);
  view.setBuilt(-1, k(0.3, 0.8)); if (o.t > 0.5) stripEl.classList.remove('is-unbuilt');
  stops.forEach((s, i) => { const t0 = 1.0 + i * o.step; view.setBuilt(s.pi, k(t0, 0.7)); if (o.t > t0) chips[s.id].classList.remove('is-unbuilt'); });
  view.setBuilt(PROJECTS.length + 1, k(o.towerAt, 1.2)); if (o.t > o.towerAt) chips.tower.classList.remove('is-unbuilt');
  view.setHouses(k(0.8, o.towerAt));
  openingBar.style.transform = `scaleX(${clamp(o.t / o.total, 0, 1).toFixed(3)})`;
  if (o.t >= o.total) finishOpening();
}
function finishOpening() {
  if (S.phase !== 'opening') return; S.opening = null; S.phase = 'idle';
  view.setAllBuilt(1); stripEl.classList.remove('is-unbuilt'); Object.values(chips).forEach((c) => c.classList.remove('is-unbuilt')); skipBtn.hidden = true;
  document.body.classList.remove('is-opening'); document.body.classList.add('is-open'); opening.classList.add('is-done'); setTimeout(() => { opening.hidden = true; }, reduce ? 0 : 900);
  if (view.resetView && view.mode !== 'orbit') view.resetView(false);
  paintStrip(); say(`The island is built. You are at ${nameOf(MAIN)}. Next stop: ${nameOf(nextOf(MAIN))}.`);
}
skipBtn.addEventListener('click', finishOpening);

/* ---------- names floating over the island ---------- */
const tagsEl = $('[data-tags]'); const tags = [];
function buildTags() {
  const mk = (id, node, cls = '') => { const b = h('button', { type: 'button', class: `tag ${cls}`, tabindex: '-1', 'data-id': id }, node); b.addEventListener('click', () => look(id)); b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showTip(id, null, [e.clientX, e.clientY]); }); b.addEventListener('pointerleave', hideTip); tagsEl.append(b); tags.push({ id, el: b, w: 0, on: false }); };
  mk('tower', [h('i', { style: 'background:#D5281E' }), `${first}’s tower`]); towns.forEach((t) => mk(t.id, [h('span', { class: 'code', style: `--c:${t.color}` }, t.code), t.name], 'tag-town')); stops.forEach((s) => mk(s.id, [h('i', { style: `background:${s.color}` }), s.short]));
}
function paintTags() {
  // in the overview: the tower and the towns. Looking at a town: its buildings. Looking at one building: none.
  const show = S.phase === 'idle' && view && view.mode === 'orbit' && S.view3d && (!S.focus || isTown(S.focus)); tagsEl.classList.toggle('is-on', !!show); if (!show) return;
  const host = tagsEl.getBoundingClientRect(); const kept = []; const inTown = S.focus && isTown(S.focus) ? S.focus : null; const close = view.camera.position.distanceTo(view.controls.target) < 420;
  const list = tags.filter((t) => (inTown ? stopById[t.id] && stopById[t.id].town.id === inTown : close || !stopById[t.id])).map((t) => ({ t, p: view.screenOf(t.id, 8) })).filter((x) => x.p).sort((a, b) => (isTown(b.t.id) || b.t.id === 'tower' ? 1 : 0) - (isTown(a.t.id) || a.t.id === 'tower' ? 1 : 0) || a.p[2] - b.p[2]);
  tags.forEach((t) => { t.next = false; });
  list.forEach(({ t, p }) => { if (!t.w) t.w = t.el.offsetWidth || 80; const x = p[0] - host.left; const y = p[1] - host.top; const r = [x - t.w / 2 - 4, y - 30, x + t.w / 2 + 4, y + 2]; if (r[0] < 4 || r[2] > host.width - 4 || r[1] < 56 || r[3] > host.height - 4) return; if (kept.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) return; kept.push(r); t.next = true; t.el.style.transform = `translate3d(${Math.round(x - t.w / 2)}px,${Math.round(y - 28)}px,0)`; });
  tags.forEach((t) => { if (t.next !== t.on) { t.on = t.next; t.el.classList.toggle('is-on', t.on); } });
}

/* ---------- pointing at the island ---------- */
function bindStage() {
  let down = null;
  // a name tag must never swallow the wheel: pass it on to the island under it
  tagsEl.addEventListener('wheel', (e) => { if (!view || !view.canvas) return; e.preventDefault(); view.canvas.dispatchEvent(new WheelEvent('wheel', { deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode, clientX: e.clientX, clientY: e.clientY, ctrlKey: e.ctrlKey, cancelable: true })); }, { passive: false });
  stage.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  stage.addEventListener('pointerup', (e) => { const d = down; down = null; if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 7 || performance.now() - d.t > 600) return; if (e.target.closest('.tag')) return; if (S.phase === 'opening') return; const id = view.pick(e.clientX, e.clientY); if (id) { if (S.view3d) look(id); else go(id); } });
  stage.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse' || S.phase !== 'idle' || e.buttons || e.target.closest('.tag')) return; const id = view.mode === 'orbit' || !S.view3d ? view.pick(e.clientX, e.clientY) : null; stage.classList.toggle('is-point', !!id); if (id && !id.startsWith('x:') && id !== S.focus) showTip(id, null, [e.clientX, e.clientY]); else hideTip(); });
  stage.addEventListener('pointerleave', () => { stage.classList.remove('is-point'); hideTip(); });
}

/* ---------- keys, links, back and forward ---------- */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (S.phase === 'opening') { finishOpening(); return; }
  if (S.page && !S.ride) { e.preventDefault(); if (S.pageMode === 'full') setPageMode('side'); else closePage(); } else if (S.focus && !S.ride) clearFocus();
});
function route() {
  const id = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  if (valid(id) && !isTown(id)) { if (S.page !== id || S.ride) arrive(id, { push: false }); } else if (S.page) hidePage(); else if (S.ride) { const r = S.ride.id; arrive(r); if (S.page) hidePage(); }
}
addEventListener('popstate', route); addEventListener('hashchange', () => { if (!history.state || !history.state.city) route(); });

/* ---------- start ---------- */
buildStrip(); buildTags(); paintStrip(); setLook(sky.look);
async function boot() {
  const step = (k) => { openingBar.style.transform = `scaleX(${k})`; }; step(0.15);
  const { hasWebGL } = await import('./world.js').catch((e) => { console.warn('The 3D island could not be loaded; showing the map.', e); return { hasWebGL: () => false }; });
  if (!Q.has('2d') && hasWebGL()) {
    try {
      const [{ createWorld }, { loadLibrary }] = await Promise.all([import('./world.js'), import('./models.js')]);
      step(0.35); const lib = await loadLibrary('./models/', (k) => step(0.35 + 0.4 * k)); step(0.8);
      view = createWorld({ host: stage, lib, levels, owner: first, phone, reduce }); S.view3d = true;
    } catch (e) { console.warn('The 3D island could not be drawn; showing the map.', e); view = null; }
  }
  if (!view) { const { createMap } = await import('./map2d.js'); view = createMap({ host: stage, stops, towns, first }); S.view3d = false; document.documentElement.classList.add('is-2d'); }
  view.setLook(sky.look); view.setTime(sky.time); view.setWeather(sky.weather); view.resize();
  if (view.onContextLost) { let timer = 0; view.onContextLost((isLost) => { clearTimeout(timer); if (isLost) { say('The 3D island stopped drawing for a moment.'); timer = setTimeout(() => { if (view.lost) fallBackToMap(); }, 4000); } else say('The 3D island is back.'); }); }
  bindStage(); new ResizeObserver(() => { view.resize(); cellX = null; }).observe(stage); new ResizeObserver(() => { cellX = null; }).observe(lineEl);
  step(0); document.body.classList.remove('is-loading');
  const startAt = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  S.phase = 'idle';
  if (valid(startAt) && !isTown(startAt)) { opening.hidden = true; document.body.classList.add('is-open'); arrive(startAt, { push: false }); } else if (reduce || Q.has('nointro')) { opening.hidden = true; document.body.classList.add('is-open'); paintStrip(); } else startOpening();
  let last = performance.now(); let tick = 0;
  const frame = (now) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000) * SPEED; last = now;
    if (S.phase === 'opening') stepOpening(dt); else sim.advance(dt);
    if (S.ride) stepRide(dt);
    view.update(dt, sim); paintMarks(); paintTags(); if ((tick += dt) > 1) { tick = 0; paintBoard(); }
    if (!(S.page && S.pageMode === 'full' && pageSettled && !S.ride)) view.render();
  };
  requestAnimationFrame(frame);
  const reset = (id = MAIN) => { S.ride = null; cabinOff(true); if (S.page) hidePage({ quiet: true }); S.focus = null; focusEl.hidden = true; sim.putAt(townOf(id)); sim.release(2); S.at = townOf(id); S.here = id; S.phase = 'idle'; if (view.resetView) view.resetView(false); history.replaceState(null, '', location.pathname + location.search); paintStrip(); };
  if (DEBUG) window.__city = { S, sim, get view() { return view; }, stops, towns, loseContext: (back = true) => { const ext = view.renderer && view.renderer.getContext().getExtension('WEBGL_lose_context'); if (!ext) return false; ext.loseContext(); if (back) setTimeout(() => ext.restoreContext(), 1500); return true; }, go, arrive, look, closePage, finishOpening, reset, nameOf, state: () => ({ phase: S.phase, at: S.at, here: S.here, page: S.page, pageMode: S.pageMode, focus: S.focus, ride: S.ride ? S.ride.id : null, out: !!(S.ride && S.ride.out), title: (document.getElementById('page-title') || {}).textContent || null, trains: sim.trains.map((t) => ({ id: t.id, s: +t.s.toFixed(1), at: t.at, v: +t.v.toFixed(2), doors: +t.doors.toFixed(2), mode: t.mode })), tram: +sim.tram.u.toFixed(3), view3d: S.view3d, mode: view.mode, used: view.used || null }) };
}
/* The 3D island lost its GPU and did not get it back: swap to the flat map, keeping where the visitor is. */
async function fallBackToMap() {
  if (!view || !S.view3d) return; const old = view; S.ride = null; cabinOff(true);
  try { old.canvas.remove(); old.dispose(); } catch (e) { /* already gone */ }
  const { createMap } = await import('./map2d.js'); view = createMap({ host: stage, stops, towns, first }); S.view3d = false; document.documentElement.classList.add('is-2d');
  view.setLook(sky.look); view.setTime(sky.time); view.setWeather(sky.weather); view.setAllBuilt(1); view.resize(); S.phase = S.page ? 'page' : 'idle'; paintStrip(); paintFocus();
}
boot().catch((e) => { console.error(e); document.body.classList.remove('is-loading'); });
