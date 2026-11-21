/* Island city · the page
   Owns the story: the opening, the metro line strip (the one control), the ride that plays when a stop is
   picked, and the page the train doors open onto. The island itself is world.js (or map2d.js without WebGL).

   Address bar, for testing:  ?time=dawn|day|golden|night  ?weather=clear|rain|fog  ?look=film|model
                              ?nointro  ?reduce  ?2d  ?speed=4  ?debug      and  #/<stop id>, #/tower, #/main */
import { DISTRICTS, STOPS, LEVELS, levelOf } from './city-data.js';
import { PLACES, placeById, TRAM_LEN } from './track.js';
import { createSim } from './sim.js';
import { h, icon, projectPage, towerPage, mainPage, levelText, levelMeter } from './pages.js';

const KY = window.KY; const Q = new URLSearchParams(location.search);
const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduce = Q.has('reduce') || matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPEED = clamp(parseFloat(Q.get('speed')) || 1, 0.25, 12); const DEBUG = Q.has('debug');
const phone = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
if (reduce) document.documentElement.classList.add('reduce');

/* ---------- the stops, joined to their projects ---------- */
const DIST = Object.fromEntries(DISTRICTS.map((d) => [d.id, d]));
const first = KY.person.name.split(' ')[0];
const stops = STOPS.map((st, i) => { const project = KY.projects.find((p) => p.id === st.project) || null; const level = levelOf(st, project); return { ...st, i, project, level, title: project ? project.title : st.building, short: st.short || (project ? project.title : st.building), color: (DIST[st.district] || {}).color || '#16171A', town: (DIST[st.district] || {}).label || '' }; });
const stopById = Object.fromEntries(stops.map((s) => [s.id, s]));
const levels = Object.fromEntries(stops.map((s) => [s.id, s.level]));
const ORDER = ['main', ...stops.map((s) => s.id)]; // the way the line runs
const nameOf = (id) => (id === 'main' ? 'Main station' : id === 'tower' ? `${first}’s tower` : stopById[id] ? stopById[id].title : '');
const shortOf = (id) => (id === 'main' ? 'Main station' : id === 'tower' ? `${first}’s tower` : stopById[id] ? stopById[id].short : '');
const valid = (id) => id === 'main' || id === 'tower' || !!stopById[id];
const nextOf = (id) => (id === 'tower' ? 'main' : ORDER[(ORDER.indexOf(id) + 1) % ORDER.length]);

/* ---------- time of day and weather ---------- */
const TIME_LABEL = { dawn: 'Dawn', day: 'Day', golden: 'Golden hour', night: 'Night' }; const WEATHER_LABEL = { clear: 'Clear', rain: 'Rain', fog: 'Fog' };
function clockTime() { const d = new Date(); const t = d.getHours() + d.getMinutes() / 60; return t >= 5 && t < 8 ? 'dawn' : t >= 8 && t < 16.5 ? 'day' : t >= 16.5 && t < 19.5 ? 'golden' : 'night'; }
function rollWeather() { const r = Math.random(); return r < 0.72 ? 'clear' : r < 0.86 ? 'rain' : 'fog'; }
const sky = { time: TIME_LABEL[Q.get('time')] ? Q.get('time') : clockTime(), weather: WEATHER_LABEL[Q.get('weather')] ? Q.get('weather') : rollWeather(), look: Q.get('look') === 'model' ? 'model' : 'film' };
const SKY_ICON = { day: 'M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z|M12 2v2.5|M12 19.5V22|M2 12h2.5|M19.5 12H22|M4.9 4.9l1.8 1.8|M17.3 17.3l1.8 1.8|M4.9 19.1l1.8-1.8|M17.3 6.7l1.8-1.8', dawn: 'M3 18h18|M6.5 18a5.5 5.5 0 0 1 11 0|M12 5v4|M9.5 7.5L12 5l2.5 2.5|M4.5 12.5l1.8 1.4|M19.5 12.5l-1.8 1.4', golden: 'M3 18h18|M6.5 18a5.5 5.5 0 0 1 11 0|M12 9V5|M9.5 6.5L12 9l2.5-2.5|M4.5 12.5l1.8 1.4|M19.5 12.5l-1.8 1.4', night: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z', rain: 'M7 15a4 4 0 0 1 .6-7.95A5.5 5.5 0 0 1 18 8.5a3.3 3.3 0 0 1-.5 6.5z|M8.5 18l-1 3|M12.5 18l-1 3|M16.5 18l-1 3', fog: 'M4 9h16|M4 13h12|M7 17h13|M10 5h8' };

/* ---------- state ---------- */
const sim = createSim();
const S = { phase: 'loading', here: 'main', page: null, pageMode: null, focus: null, ride: null, opening: null, hover: null, view3d: false };
let view = null; // the 3D island, or the 2D map when WebGL is missing
const live = $('[data-live]'); const say = (t) => { live.textContent = ''; requestAnimationFrame(() => { live.textContent = t; }); };

/* ---------- top bar ---------- */
$('[data-owner]').textContent = KY.person.name; $('[data-roundel]').textContent = first[0];
$('[data-brand]').setAttribute('aria-label', `${KY.person.name}. Ride up to ${first}’s tower: who I am, résumé, contact`);
$('[data-brand]').addEventListener('click', () => (S.view3d && !reduce ? look('tower') : go('tower')));
function paintSky() { const el = $('[data-sky]'); el.hidden = false; const ic = $('[data-sky-icon]'); ic.textContent = ''; ic.append(icon(SKY_ICON[sky.weather !== 'clear' ? sky.weather : sky.time])); $('[data-sky-text]').textContent = `${TIME_LABEL[sky.time]} · ${WEATHER_LABEL[sky.weather]}`; el.title = Q.get('time') || Q.get('weather') ? 'Set in the address bar' : 'The light follows your clock. The weather changes every visit.'; }
paintSky();
$$('[data-look]').forEach((b) => b.addEventListener('click', () => setLook(b.dataset.look)));
function setLook(l) { sky.look = l; $$('[data-look]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.look === l))); document.documentElement.dataset.look = l; if (view) view.setLook(l); }
$('[data-reset]').addEventListener('click', () => { if (!view || S.ride || (S.phase !== 'idle' && S.phase !== 'page')) return; if (S.page) { hidePage({ quiet: true }); S.phase = 'idle'; sim.release(5); history.replaceState(null, '', location.pathname + location.search); paintStrip(); } clearFocus(); view.resetView(true); say('Back to the whole island'); });

/* ---------- the line strip ---------- */
const stopsEl = $('[data-stops]'); const townsEl = $('[data-towns]'); const stripScroll = $('[data-strip-scroll]'); const lineEl = $('[data-line]');
const cells = {}; // id -> { li, btn }
function buildStrip() {
  const N = stops.length + 3; lineEl.style.setProperty('--n', N);
  const cell = (id, cls, color, name, label) => {
    const btn = h('button', { type: 'button', class: 'stop-b', 'data-stop': id, 'aria-label': label, tabindex: '-1' }, h('span', { class: 'stop-name', text: name }), h('span', { class: 'stop-dot' }));
    const li = h('li', { class: `stop ${cls}`, style: `--c:${color}` }, btn); stopsEl.append(li); cells[id] = { li, btn };
    btn.addEventListener('click', () => go(id)); btn.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showTip(id, btn); }); btn.addEventListener('pointerleave', () => hideTip()); btn.addEventListener('focus', () => { if (btn.matches(':focus-visible')) showTip(id, btn); }); btn.addEventListener('blur', hideTip);
    return btn;
  };
  cell('tower', 'is-tower', '#D5281E', `${first}’s tower`, `${first}’s tower, by the hill tram from the main station. About ${first}: résumé and contact.`);
  cell('main', 'is-main', '#16171A', 'Main station', 'Main station. Every stop on one board.');
  stops.forEach((s) => cell(s.id, '', s.color, s.short, `Stop ${s.i + 1} of ${stops.length}: ${s.title}. ${s.building}, ${s.town}. ${levelText(s.level)}.`));
  stopsEl.append(h('li', { class: 'stop is-loop', style: '--c:#16171A', 'aria-hidden': 'true' }, h('span', { class: 'loop-g' }, icon('M4 12a8 8 0 1 0 2.6-5.9|M4 4.5V9h4.5'), h('span', { text: 'Round again' }))));
  // town names under the line, each spanning its own stops
  let at = 3; DISTRICTS.forEach((d) => { const n = stops.filter((s) => s.district === d.id).length; if (!n) return; townsEl.append(h('span', { class: 'town', style: `grid-column:${at} / span ${n};--c:${d.color}` }, h('i'), d.label)); at += n; });
  townsEl.prepend(h('span', { class: 'town town-tram', style: 'grid-column:1 / span 2;--c:#D5281E' }, h('i'), 'Hill tram'));
  // one tab stop; arrows move along the line
  const keys = ['tower', ...ORDER];
  stopsEl.addEventListener('keydown', (e) => { const i = keys.indexOf(document.activeElement && document.activeElement.dataset.stop); if (i < 0) return; let j = i; if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = Math.min(keys.length - 1, i + 1); else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = Math.max(0, i - 1); else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = keys.length - 1; else return; e.preventDefault(); roving(keys[j], true); });
  roving('main', false);
}
function roving(id, focus) { Object.entries(cells).forEach(([k, c]) => c.btn.setAttribute('tabindex', k === id ? '0' : '-1')); if (focus && cells[id]) { cells[id].btn.focus(); keepInView(id); } }
function keepInView(id) { const c = cells[id]; if (!c || stripScroll.scrollWidth <= stripScroll.clientWidth + 2) return; const x = c.li.offsetLeft + c.li.offsetWidth / 2 - stripScroll.clientWidth / 2; stripScroll.scrollTo({ left: clamp(x, 0, stripScroll.scrollWidth), behavior: reduce ? 'auto' : 'smooth' }); }
const atK = $('[data-at-k]'); const atEl = $('[data-at]'); const nextBtn = $('[data-next]'); const nextName = $('[data-next-name]'); const nextK = $('.next-k', nextBtn);
function paintStrip() {
  const riding = !!S.ride && !S.ride.out; const dest = riding ? S.ride.id : null;
  Object.entries(cells).forEach(([id, c]) => { c.li.classList.toggle('is-here', !riding && id === S.here); c.li.classList.toggle('is-dest', id === dest); if (!riding && id === S.here) c.btn.setAttribute('aria-current', 'location'); else c.btn.removeAttribute('aria-current'); });
  atK.textContent = riding ? 'Riding to' : S.phase === 'opening' ? 'Building the island' : 'You are at'; atEl.textContent = riding ? nameOf(dest) : S.phase === 'opening' ? `${stops.length} stops` : nameOf(S.here);
  nextBtn.classList.toggle('is-skip', riding || S.phase === 'opening'); nextK.textContent = riding ? 'On the way' : S.phase === 'opening' ? 'Opening' : 'Next stop';
  nextName.textContent = riding ? 'Skip the ride' : S.phase === 'opening' ? 'Skip' : shortOf(nextOf(S.here));
  nextBtn.setAttribute('aria-label', riding ? `Skip the ride and open ${nameOf(dest)}` : S.phase === 'opening' ? 'Skip the opening' : `Next stop: ${nameOf(nextOf(S.here))}. The train takes you there.`);
}
nextBtn.addEventListener('click', () => { if (S.phase === 'opening') { finishOpening(); return; } if (S.ride && !S.ride.out) { arrive(S.ride.id); return; } go(nextOf(S.here)); });
// where the train and the tram are on the strip
const markTrain = $('[data-mark-train]'); const markTram = $('[data-mark-tram]'); let cellX = null;
function measureStrip() { cellX = {}; Object.entries(cells).forEach(([id, c]) => { cellX[id] = c.li.offsetLeft + c.li.offsetWidth / 2; }); const loop = $('.is-loop', stopsEl); cellX.loop = loop.offsetLeft + loop.offsetWidth / 2; cellX.w = loop.offsetWidth; cellX.y = stopsEl.offsetTop + stopsEl.offsetHeight - 17 - 9; }
function paintMarks() {
  if (!cellX) measureStrip();
  const f = sim.fraction(); const a = cellX[PLACES[f.i].id]; let x; let o = 1;
  if (f.i < PLACES.length - 1) x = a + (cellX[PLACES[f.i + 1].id] - a) * f.f; else if (f.f < 0.5) { x = a + (cellX.loop - a) * (f.f / 0.5); o = 1 - Math.max(0, f.f - 0.3) / 0.2; } else { x = cellX.main - cellX.w * 0.5 * (1 - (f.f - 0.5) / 0.5); o = Math.min(1, (f.f - 0.5) / 0.2); }
  markTrain.style.transform = `translate3d(${x.toFixed(1)}px,${cellX.y}px,0)`; markTrain.style.opacity = o.toFixed(2);
  markTram.style.transform = `translate3d(${(cellX.main + (cellX.tower - cellX.main) * sim.tram.u).toFixed(1)}px,${cellX.y}px,0)`;
}

/* ---------- the hover card ---------- */
const tip = $('[data-tip]'); let tipFor = null;
function tipBody(id) {
  tip.textContent = '';
  if (id === 'main') { tip.append(h('p', { class: 'tip-k' }, h('i', { class: 'dot', style: 'background:#16171A' }), 'Main station'), h('b', { text: 'Every stop on one board' }), h('p', { class: 'tip-one', text: 'The line starts and ends here.' })); return; }
  if (id === 'tower') { tip.append(h('p', { class: 'tip-k' }, h('i', { class: 'dot', style: 'background:#D5281E' }), 'Hill tram'), h('b', { text: `${first}’s tower` }), h('p', { class: 'tip-one', text: 'Who I am, my résumé and how to reach me.' })); return; }
  const s = stopById[id]; if (!s) return;
  tip.append(h('p', { class: 'tip-k' }, h('i', { class: 'dot', style: `background:${s.color}` }), `${s.town} · Stop ${s.i + 1}`), h('b', { text: s.title }), h('p', { class: 'tip-l' }, levelMeter(s.level), `${s.building} · ${levelText(s.level)}`), s.project && s.project.one ? h('p', { class: 'tip-one', text: s.project.one }) : null);
}
function placeTip(x, y, above) { tip.hidden = false; const w = tip.offsetWidth; const hh = tip.offsetHeight; const left = clamp(x - w / 2, 8, innerWidth - w - 8); let top = above ? y - hh - 12 : y + 18; if (top < 8) top = y + 18; if (top + hh > innerHeight - 8) top = y - hh - 12; tip.style.transform = `translate3d(${Math.round(left)}px,${Math.round(top)}px,0)`; }
function showTip(id, anchor, pt) { if (S.phase !== 'idle' && S.phase !== 'ride') return; if (tipFor !== id) { tipFor = id; tipBody(id); } if (anchor) { const r = anchor.getBoundingClientRect(); placeTip(r.left + r.width / 2, r.top + r.height - 36, true); } else if (pt) placeTip(pt[0], pt[1], false); if (view) view.hover(id === 'main' ? null : id); if (cells[id]) Object.entries(cells).forEach(([k, c]) => c.li.classList.toggle('is-hot', k === id)); }
function hideTip() { if (tipFor == null) return; tipFor = null; tip.hidden = true; if (view) view.hover(null); Object.values(cells).forEach((c) => c.li.classList.remove('is-hot')); }

/* ---------- what the visitor is looking at ---------- */
const focusEl = $('[data-focus]'); const focusA = $('[data-focus-a]');
const actBtn = (label, cls, fn, ic) => { const b = h('button', { type: 'button', class: `btn btn-sm ${cls}` }, h('span', { text: label }), ic ? icon(ic) : null); b.addEventListener('click', fn); return b; };
function paintFocus() {
  const id = S.focus; const riding = S.ride && !S.ride.out;
  if (!id || riding || S.phase === 'opening' || S.phase === 'loading' || (S.page && S.pageMode === 'full')) { focusEl.hidden = true; return; }
  const k = $('[data-focus-k]'); const t = $('[data-focus-t]'); const l = $('[data-focus-l]'); k.textContent = ''; l.textContent = ''; focusA.textContent = '';
  focusEl.classList.toggle('is-hero', !!S.ride);
  if (id.startsWith('x:')) { const e = view && view.extra ? view.extra(id) : null; k.append(h('i', { class: 'dot', style: 'background:#16171A' }), 'On the water'); t.textContent = e ? e.name : ''; if (id === 'x:lighthouse') k.lastChild.textContent = 'On the east point'; focusEl.hidden = false; return; }
  const s = stopById[id];
  if (s) { k.append(h('i', { class: 'dot', style: `background:${s.color}` }), `${s.town} · Stop ${s.i + 1} of ${stops.length}`); t.textContent = s.title; l.append(levelMeter(s.level), `${s.building} · ${levelText(s.level)}`); } else if (id === 'tower') { k.append(h('i', { class: 'dot', style: 'background:#D5281E' }), 'Up the hill tram'); t.textContent = `${first}’s tower`; l.textContent = 'Who I am, my résumé and how to reach me.'; } else { k.append(h('i', { class: 'dot', style: 'background:#16171A' }), 'Where the line starts'); t.textContent = 'Main station'; l.textContent = 'Every stop on one board.'; }
  if (!S.ride) {
    if (S.page === id && S.pageMode === 'tucked') focusA.append(actBtn('Read about it', 'btn-ink', () => setPageMode('side'), 'M5 12h14|M13 6l6 6-6 6'));
    else if (S.page !== id && S.here === id) focusA.append(actBtn('Read about it', 'btn-ink', () => openHere(id), 'M5 12h14|M13 6l6 6-6 6'));
    else if (S.page !== id) focusA.append(actBtn(id === 'tower' ? 'Ride the tram up' : 'Ride here', 'btn-ink', () => go(id), 'M5 12h14|M13 6l6 6-6 6'), actBtn('Read now', '', () => arrive(id)));
  }
  focusEl.hidden = false;
}
function clearFocus() { S.focus = null; focusEl.hidden = true; }
$('[data-focus-x]').addEventListener('click', clearFocus);
/** Look at something on the island: the camera glides to it. No ride. */
function look(id) {
  if (!view || S.ride || (S.phase !== 'idle' && S.phase !== 'page')) return;
  if (S.page === id) { if (S.pageMode === 'tucked') view.hero(id, 0.9, true); return; }
  if (S.page) { hidePage({ quiet: true }); S.phase = 'idle'; sim.release(5); history.replaceState(null, '', location.pathname + location.search); }
  hideTip();
  if (id.startsWith('x:')) { const e = view.extra && view.extra(id); if (!e) return; view.lookAtPoint(e.x, e.y, e.z, e.d, 1.0); } else if (view.hero) view.hero(id, 1.1, false);
  S.focus = id; paintFocus(); paintStrip(); say(`Looking at ${id.startsWith('x:') ? (view.extra(id) || {}).name : nameOf(id)}`);
}

/* ---------- the page ---------- */
const page = $('[data-page]'); const pageBody = $('[data-page-body]'); const pageWhere = $('[data-page-where]'); const pageNext = $('[data-page-next]'); const pageNextLabel = $('[data-page-next-label]');
const behind = [$('.top'), $('[data-strip]'), $('[data-stage]'), focusEl]; let pageTimer = 0; let pageSettled = false;
const expandBtn = $('[data-expand]'); const tuckBtn = $('[data-tuck]');
function fillPage(id) {
  pageBody.textContent = ''; pageWhere.textContent = '';
  if (id === 'tower') { pageBody.append(towerPage({ KY, go })); pageWhere.append(h('i', { class: 'dot', style: 'background:#D5281E' }), `${first}’s tower`); } else if (id === 'main') { pageBody.append(mainPage({ KY, stops, go })); pageWhere.append(h('i', { class: 'dot', style: 'background:#16171A' }), 'Main station'); } else { const s = stopById[id]; pageBody.append(projectPage(s, { stops, reduce, go })); pageWhere.append(h('i', { class: 'dot', style: `background:${s.color}` }), `${s.town} · Stop ${s.i + 1} of ${stops.length}`); }
  const nx = nextOf(id); pageNextLabel.textContent = id === 'tower' ? 'Main station' : `Next: ${shortOf(nx)}`; pageNext.setAttribute('aria-label', `Ride to ${nameOf(nx)}`);
  tuckBtn.setAttribute('aria-label', `Look at ${id === 'tower' ? 'the tower' : id === 'main' ? 'the station' : 'the building'}: tuck this page away`);
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
  const st = stage.getBoundingClientRect(); const wide = innerWidth > 760;
  if (wide) view.setShift(Math.min(page.offsetWidth, st.width * 0.6) / 2, 0); else view.setShift(0, Math.max(0, st.bottom - (innerHeight - page.offsetHeight)) / 2);
}
function showPage(id, { push = true, mode = 'side' } = {}) {
  clearTimeout(pageTimer); fillPage(id); S.page = id; S.here = id; S.focus = id;
  page.hidden = false; page.scrollTop = 0; void page.offsetWidth; page.classList.add('is-in');
  document.title = `${nameOf(id)} · ${KY.person.name}`;
  // one history entry for "a page is open": Back always returns to the island, however many stops were visited
  if (push && location.hash !== `#/${id}`) history[history.state && history.state.city ? 'replaceState' : 'pushState']({ city: id }, '', `#/${id}`);
  roving(id, false); setPageMode(mode); paintStrip(); keepInView(id); hideTip();
  say(`Arrived: ${nameOf(id)}`);
}
function hidePage({ quiet = false } = {}) {
  if (!S.page) return; const id = S.page; S.page = null; S.pageMode = null; pageSettled = false; clearTimeout(pageTimer);
  page.classList.remove('is-in'); behind.forEach((el) => { el.inert = false; });
  $$('video', pageBody).forEach((v) => v.pause()); $$('iframe', pageBody).forEach((f) => f.remove());
  pageTimer = setTimeout(() => { page.hidden = true; pageBody.textContent = ''; }, reduce ? 0 : 520);
  document.title = `${KY.person.name} · Island city`; document.body.classList.remove('has-page'); placeView();
  if (!quiet) { S.phase = 'idle'; sim.release(5); paintStrip(); paintFocus(); const b = $('.btn', focusA) || (cells[id] && cells[id].btn); if (b) b.focus({ preventScroll: true }); say(`Page closed. You are looking at ${nameOf(id)}.`); }
}
function closePage() { if (!S.page) return; if (history.state && history.state.city) history.back(); else { history.replaceState(null, '', location.pathname + location.search); hidePage(); } }
/** Open the page of the place the visitor is already at. */
function openHere(id) { if (S.ride) return; S.phase = 'page'; sim.train.release = null; if (view && view.hero) view.hero(id, 0.8, true); showPage(id); }
$('[data-close]').addEventListener('click', closePage);
pageNext.addEventListener('click', () => { if (S.page) go(nextOf(S.page)); });
expandBtn.addEventListener('click', () => setPageMode(S.pageMode === 'full' ? 'side' : 'full'));
tuckBtn.addEventListener('click', () => setPageMode('tucked'));
addEventListener('resize', () => { if (S.page) placeView(); });

/* ---------- the ride ---------- */
const cabin = $('[data-cabin]'); const TRAM_T = 3.6; const STEP_OUT = 1.3; const HOLD = 2.5; let cabinTimer = 0;
function cabinOff(now) { clearTimeout(cabinTimer); const off = () => { cabin.className = 'cabin'; }; if (now) off(); else { cabin.classList.add('is-out'); cabinTimer = setTimeout(off, 520); } }
function cabinOn(id) {
  clearTimeout(cabinTimer); cabin.className = `cabin is-on${S.view3d ? '' : ' is-flat'}`;
  const s = stopById[id]; cabin.style.setProperty('--c', id === 'tower' ? '#D5281E' : s ? s.color : '#16171A');
  $('[data-sign-k]').textContent = id === 'tower' ? 'Hill tram · last stop' : id === 'main' ? 'This train ends at' : 'Next stop';
  $('[data-sign-name]').textContent = nameOf(id); $('[data-sign-sub]').textContent = id === 'tower' ? 'Mind the step' : id === 'main' ? 'All change' : `${s.building} · ${levelText(s.level)}`;
}
/** Take the visitor to a stop: the ride, the doors, a long look at the building, then its page beside it. */
function go(id, { instant = false } = {}) {
  if (!valid(id) || S.phase === 'loading') return;
  if (S.phase === 'opening') finishOpening();
  if (S.ride && S.ride.id === id) return;
  if (S.page === id && !S.ride) { if (S.pageMode === 'tucked') setPageMode('side'); return; }
  hideTip();
  if (reduce || instant || !view) { arrive(id); return; }
  if (S.page) hidePage({ quiet: true });
  if (S.ride) cabinOff(true);
  clearFocus();
  const tower = id === 'tower'; const to = tower ? 'main' : id; const D = Math.abs(sim.gapTo(to)); const k = S.view3d ? 1 : 0.4;
  const T = D < 8 ? (tower ? 0 : 1.1) : (tower ? clamp(2.5 + D / 120, 2.5, 5.2) : clamp(3.4 + D / 95, 3.4, 8.2)) * k;
  sim.rideTo(to, Math.max(T, 0.05));
  const r = { id, tower, t: 0, T, side: tower ? 1 : (stopById[id] && stopById[id].side === 'sea' ? -1 : 1) };
  if (tower) { const down = sim.tram.u > 0.02 ? Math.max(0.9, Math.min(T, 2.6)) : 0; if (down) sim.tramTo(0, down); else sim.tramHold(); r.tramStart = Math.max(T, down); r.end = r.tramStart + TRAM_T * k; r.cutIn = r.end - 1.4 * k; } else { sim.tramFree(); r.end = T; r.cutIn = Math.max(0, T - 1.5 * k); }
  r.doorsAt = r.end + 0.25; r.outAt = r.doorsAt + 0.9; r.pageAt = r.outAt + (STEP_OUT + HOLD) * k;
  S.ride = r; S.phase = 'ride';
  if (tower && T === 0) view.follow(view.tramSubject(sim)); else view.follow(view.trainSubject(sim));
  paintStrip(); keepInView(id); say(`Riding to ${nameOf(id)}`);
}
function stepRide(dt) {
  const r = S.ride; if (!r) return; r.t += dt;
  if (r.tower && !r.tramGo && r.t >= r.tramStart) { r.tramGo = true; sim.tramTo(1, TRAM_T * (S.view3d ? 1 : 0.4)); if (!r.in) view.follow(view.tramSubject(sim)); }
  if (!r.in && r.t >= r.cutIn) { r.in = true; cabinOn(r.id); }
  if (r.in && !r.swap && r.t >= r.cutIn + 0.3) { r.swap = true; if (r.tower) view.inside(view.tramSubject(sim, 'inside'), 'tram'); else view.inside(view.trainSubject(sim, r.side), 'train'); cabin.classList.add('is-clear'); }
  if (!r.doors && r.t >= r.doorsAt) { r.doors = true; cabin.classList.add('is-open'); }
  // step out: the doors fall away and the camera settles on the building, with its name, for a good look
  if (!r.out && r.t >= r.outAt) { r.out = true; cabinOff(false); S.here = r.id; S.focus = r.id; if (view.hero) view.hero(r.id, STEP_OUT, true); paintFocus(); paintStrip(); say(`${nameOf(r.id)}. ${stopById[r.id] ? `${stopById[r.id].building}. ${levelText(stopById[r.id].level)}.` : ''}`); }
  if (r.t >= r.pageAt) { S.ride = null; S.phase = 'page'; showPage(r.id); }
}
/** Be there at once: no ride (reduced motion, deep links, Skip, "Read now"). */
function arrive(id, opt) {
  if (!valid(id) || S.phase === 'loading') return;
  if (S.phase === 'opening') finishOpening();
  S.ride = null; cabinOff(true);
  if (id === 'tower') { if (sim.train.mode !== 'hold' || sim.train.at !== 'main') sim.putAt('main'); sim.tramPut(1); } else { sim.putAt(id); sim.tramFree(); }
  if (S.page && S.page !== id) hidePage({ quiet: true });
  S.phase = 'page'; if (view) view.showStation(id, true);
  if (S.page !== id) showPage(id, opt); else { paintStrip(); paintFocus(); }
}

/* ---------- the opening ---------- */
const opening = $('[data-opening]'); const openingBar = $('[data-opening-bar]'); const skipBtn = $('[data-skip]');
function startOpening() {
  const n = stops.length; const step = Math.min(0.3, 4.5 / n);
  S.opening = { t: 0, step, towerAt: 1.0 + n * step + 0.1, total: 1.0 + n * step + 0.1 + 1.2 + 0.3 };
  S.phase = 'opening'; view.setAllBuilt(0); Object.values(cells).forEach((c) => c.li.classList.add('is-unbuilt')); skipBtn.hidden = false; document.body.classList.add('is-opening');
  if (view.openingCamera) view.openingCamera(S.opening.total); paintStrip();
}
function stepOpening(dt) {
  const o = S.opening; o.t += dt; const k = (t0, d) => clamp((o.t - t0) / d, 0, 1);
  view.setBuilt(-1, k(0.45, 0.7)); if (o.t > 0.45) cells.main.li.classList.remove('is-unbuilt');
  stops.forEach((s, i) => { const t0 = 1.0 + i * o.step; view.setBuilt(i, k(t0, 0.7)); if (o.t > t0) cells[s.id].li.classList.remove('is-unbuilt'); });
  view.setBuilt(stops.length + 1, k(o.towerAt, 1.2)); if (o.t > o.towerAt) cells.tower.li.classList.remove('is-unbuilt');
  view.setHouses(k(0.8, o.towerAt));
  openingBar.style.transform = `scaleX(${clamp(o.t / o.total, 0, 1).toFixed(3)})`;
  if (o.t >= o.total) finishOpening();
}
function finishOpening() {
  if (S.phase !== 'opening') return; S.opening = null; S.phase = 'idle';
  view.setAllBuilt(1); Object.values(cells).forEach((c) => c.li.classList.remove('is-unbuilt')); skipBtn.hidden = true;
  document.body.classList.remove('is-opening'); document.body.classList.add('is-open'); opening.classList.add('is-done'); setTimeout(() => { opening.hidden = true; }, reduce ? 0 : 900);
  if (view.resetView && view.mode !== 'orbit') view.resetView(false);
  sim.train.dwell = 1.2; paintStrip(); say(`The island is built. You are at the main station. Next stop: ${nameOf(nextOf('main'))}.`);
}
skipBtn.addEventListener('click', finishOpening);

/* ---------- names floating over the island ---------- */
const tagsEl = $('[data-tags]'); const tags = [];
function buildTags() {
  const mk = (id, name, color) => { const b = h('button', { type: 'button', class: 'tag', tabindex: '-1', 'data-id': id }, h('i', { style: `background:${color}` }), name); b.addEventListener('click', () => look(id)); b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showTip(id, null, [e.clientX, e.clientY]); }); b.addEventListener('pointerleave', hideTip); tagsEl.append(b); tags.push({ id, el: b, w: 0, on: false }); };
  mk('tower', `${first}’s tower`, '#D5281E'); stops.forEach((s) => mk(s.id, s.short, s.color)); mk('main', 'Main station', '#16171A');
}
function paintTags() {
  const show = S.phase === 'idle' && view && view.mode === 'orbit' && S.view3d && !S.focus; tagsEl.classList.toggle('is-on', !!show); if (!show) return;
  const host = tagsEl.getBoundingClientRect(); const kept = [];
  const list = tags.map((t) => ({ t, p: view.screenOf(t.id, 10) })).filter((x) => x.p).sort((a, b) => (a.t.id === 'tower' ? -1 : b.t.id === 'tower' ? 1 : a.p[2] - b.p[2]));
  tags.forEach((t) => { t.next = false; });
  list.forEach(({ t, p }) => { if (!t.w) t.w = t.el.offsetWidth || 80; const x = p[0] - host.left; const y = p[1] - host.top; const r = [x - t.w / 2 - 4, y - 30, x + t.w / 2 + 4, y + 2]; if (r[0] < 4 || r[2] > host.width - 4 || r[1] < 56 || r[3] > host.height - 4) return; if (kept.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) return; kept.push(r); t.next = true; t.el.style.transform = `translate3d(${Math.round(x - t.w / 2)}px,${Math.round(y - 28)}px,0)`; });
  tags.forEach((t) => { if (t.next !== t.on) { t.on = t.next; t.el.classList.toggle('is-on', t.on); } });
}

/* ---------- pointing at the island ---------- */
function bindStage(stage) {
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
  if (valid(id)) { if (S.page !== id || S.ride) { S.ride = null; cabinOff(true); arriveQuiet(id); } } else if (S.page) hidePage(); else if (S.ride) { arrive(S.ride.id); hidePage(); }
}
function arriveQuiet(id) { arrive(id, { push: false }); }
addEventListener('popstate', route); addEventListener('hashchange', () => { if (!history.state || !history.state.city) route(); });

/* ---------- start ---------- */
buildStrip(); buildTags(); paintStrip(); setLook(sky.look);
const stage = $('[data-stage]');
async function boot() {
  let make = null; const step = (k) => { openingBar.style.transform = `scaleX(${k})`; }; step(0.15);
  const { hasWebGL } = await import('./world.js').catch((e) => { console.warn('The 3D island could not be loaded; showing the map.', e); return { hasWebGL: () => false }; });
  if (!Q.has('2d') && hasWebGL()) {
    try {
      const [{ createWorld }, { loadLibrary }] = await Promise.all([import('./world.js'), import('./models.js')]);
      step(0.35); const lib = await loadLibrary('./models/', (k) => step(0.35 + 0.4 * k)); step(0.8);
      make = () => createWorld({ host: stage, lib, levels, owner: first, phone, reduce });
      view = make(); S.view3d = true;
    } catch (e) { console.warn('The 3D island could not be drawn; showing the map.', e); view = null; }
  }
  if (!view) { const { createMap } = await import('./map2d.js'); view = createMap({ host: stage, stops, first }); S.view3d = false; document.documentElement.classList.add('is-2d'); }
  view.setLook(sky.look); view.setTime(sky.time); view.setWeather(sky.weather); view.resize();
  bindStage(stage); new ResizeObserver(() => { view.resize(); cellX = null; }).observe(stage); new ResizeObserver(() => { cellX = null; }).observe(lineEl);
  step(0); document.body.classList.remove('is-loading');
  const startAt = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  S.phase = 'idle';
  if (valid(startAt)) { opening.hidden = true; document.body.classList.add('is-open'); arriveQuiet(startAt); } else if (reduce || Q.has('nointro')) { opening.hidden = true; document.body.classList.add('is-open'); paintStrip(); } else startOpening();
  let last = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000) * SPEED; last = now;
    if (S.phase === 'opening') stepOpening(dt); else sim.advance(dt);
    if (S.ride) stepRide(dt);
    view.update(dt, sim); paintMarks(); paintTags();
    if (!(S.page && S.pageMode === 'full' && pageSettled && !S.ride)) view.render();
  };
  requestAnimationFrame(frame);
  const reset = (id = 'main') => { S.ride = null; cabinOff(true); if (S.page) hidePage({ quiet: true }); clearFocus(); if (id === 'tower') { sim.putAt('main'); sim.tramPut(1); } else { sim.putAt(id); sim.tramFree(); } S.here = id; S.phase = 'idle'; if (view.resetView) view.resetView(false); history.replaceState(null, '', location.pathname + location.search); paintStrip(); };
  if (DEBUG) window.__city = { S, sim, view, stops, go, arrive, closePage, finishOpening, reset, nameOf, look, state: () => ({ phase: S.phase, here: S.here, page: S.page, pageMode: S.pageMode, focus: S.focus, ride: S.ride ? S.ride.id : null, title: (document.getElementById('page-title') || {}).textContent || null, train: { s: sim.train.s, at: sim.train.at, mode: sim.train.mode }, tram: sim.tram.u, view3d: S.view3d, mode: view.mode, used: view.used || null }) };
}
boot().catch((e) => { console.error(e); document.body.classList.remove('is-loading'); });
void LEVELS; void placeById; void TRAM_LEN;
