/* Kevin Metro · interface
   One state machine: opening → tour | explore → riding → focus → article, with the All stops, Skills, About,
   Contact and tour-picker sheets over any of them. Every input is legal in every state, and there is always a
   visible way to go on: the dock at the bottom says where you are and where you can go next.
   The trains and the trip live in sim.js; the 3D city (scene.js) and the 2D map (map2d.js) both draw them.
   What connects to what comes from graph.js. Facts come from ../shared/content.js and nowhere else. */
import { buildNetwork } from './network.js';
import { PLACES, PLOTS, MODELS, stationIdOf } from './city-data.js';
import { createSim } from './sim.js';
import { createMap2D } from './map2d.js';
import { buildGraph } from './graph.js';

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
const btn = (cls, label, fn, attrs = {}) => { const b = h('button', { type: 'button', class: cls, ...attrs }); if (label != null) b.append(document.createTextNode(label)); if (fn) b.addEventListener('click', fn); return b; };

const STATUS = { live: 'Live', testing: 'In testing', building: 'Building', done: 'Done', parked: 'Planned' };
const CAT = Object.fromEntries(KY.categories.map((c) => [c.id, c.label]));
const projById = Object.fromEntries(KY.projects.map((p) => [p.id, p]));
const SHORT = { trade: 'Export risk tool', court: 'Court booking', books: 'Snuggle Crew books', ipad: 'iPad coloring app', duiyao: '對藥', pindou: '拼豆 store' };
/* ---------- the network, the places, the graph ---------- */
const net = buildNetwork();
const LINES = net.lines; const LBY = net.byId; const STBY = net.stById;
const CATLINE = { software: '1', books: '2', film: '3', games: '4', health: '5' };
const ORDER = ['1', '2', '3', '4', '5', 'c'];
// every place comes from the registry (city-data.js)
const DEST = PLACES.map((p) => ({ id: p.id, name: p.label, short: p.short, station: stationIdOf(p), landmark: p.id, projects: p.projects, panel: p.panel, label: p.note, lineId: p.line, plot: p.plot }));
DEST.forEach((d) => { const p = d.projects && projById[d.projects[0]]; d.line = d.lineId || (p ? CATLINE[p.category] : 'c'); d.css = p ? LBY[CATLINE[p.category]].def.css : '#16171A'; });
const DID = Object.fromEntries(DEST.map((d) => [d.id, d]));
const destOfProject = (pid) => DEST.find((d) => (d.projects || []).includes(pid));
const READ_ORDER = KY.categories.flatMap((c) => KY.projects.filter((p) => p.category === c.id).map((p) => p.id));
const lineChip = (lid, big) => { const d = LBY[lid].def; const i = h('span', { class: `lchip${big ? ' lchip-lg' : ''}${lid === '2' ? ' on-yellow' : ''}`, 'aria-hidden': 'true' }, d.no); i.style.background = d.css; return i; };
// a line is a kind of work, said plainly: "Line 1 · Software", "Circle · About Kevin"
const lineName = (lid) => { const d = LBY[lid].def; return `${d.name} · ${d.label}`; };
const lineShort = (lid) => LBY[lid].def.name;
const titleOf = (d) => (d.projects ? d.projects.map((id) => SHORT[id] || projById[id].title).join(' · ') : d.label || d.name);
const sim = createSim(net, { reduce, speed: +(location.search.match(/[?&]speed=([\d.]+)/) || [0, 1])[1] || 1 });
const graph = buildGraph({ places: DEST, projById, net, lineName });

/* ---------- state ---------- */
let city = null; let map = null; let mode2d = false;
let mode = 'explore';      // 'opening' | 'tour' | 'explore'
let cur = 'kevin';         // the station the visitor is at (or left from, while riding)
let place = 'kevin';       // the place there
let riding = false; let rideLeg = null;
let focusId = null;        // the place whose panel is open
let sheet = null;          // 'stops' | 'skills' | 'about' | 'contact' | 'tours'
let skill = null;          // the tag picked in the Skills view
let tour = null;           // { def, i, paused, dwell, shown }
let lastTour = null;       // where a tour was left, for "Resume tour"
let idle = 0; let offer = 0; let opening = 0;
const placeAt = (sid, destId) => (DID[destId] && DID[destId].station === sid ? destId : (DEST.find((d) => d.station === sid) || {}).id);
const stage = $('[data-stage]'); const dockEl = $('[data-dock]'); const focus = $('[data-focus]'); const fPanel = $('[data-focus-panel]');
const setHash = (hsh) => history.replaceState(null, '', hsh || location.pathname + location.search);
const restHash = () => setHash(mode === 'tour' && tour ? `#/tour/${tour.def.id}` : !focus.hidden && focusId ? `#/station/${DID[focusId].station}` : '');

/* ---------- the tours: selections for the viewer ---------- */
const TOURS = [
  { id: 'highlights', name: 'Highlights', sub: 'about 1 minute', stops: ['hirvo', 'port', 'snuggle', 'cinema', 'clinic'] },
  { id: 'everything', name: 'Everything', sub: 'every stop in the city', stops: ['hirvo', 'port', 'arcade', 'studio', 'party', 'snuggle', 'jazz', 'nonstop', 'uhome', 'clinic', 'hackhall', 'courts', 'cinema', 'creators', 'campus', 'dailyai'] },
  ...['1', '2', '3', '4', '5'].map((lid) => ({ id: LBY[lid].def.cat, name: LBY[lid].def.label, sub: lineShort(lid), line: lid, stops: LBY[lid].stations.flatMap((ps) => DEST.filter((d) => d.station === ps.id && d.line === lid).map((d) => d.id)) })),
  { id: 'about', name: 'About Kevin', sub: 'résumé, newsletter, contact', line: 'c', stops: ['campus', 'dailyai', 'nonstop'] },
].map((t) => ({ ...t, stops: t.stops.filter((id) => DID[id]) }));
const DWELL = 7;

/* ---------- the lines, as a compact legend: pick one to see its stops ---------- */
ORDER.forEach((lid) => {
  const li = h('li'); const b = btn('lg', null, () => openSheet('stops', lid), { 'aria-label': `${lineName(lid)}: see its stops`, title: lineName(lid) });
  b.append(lineChip(lid), h('span', { class: 'lg-t' }, LBY[lid].def.label)); li.append(b); $('[data-legend]').append(li);
});

/* ---------- the dock: where you are, where you can go next, the tour ---------- */
const stopsText = (n) => `${n} stop${n > 1 ? 's' : ''}`;
// the trip plan, as one strip: From → (line) → Change at X → (line) → To, with the stops on each line
function planStrip(legs) {
  const wrap = h('span', { class: 'plan', role: 'img', 'aria-label': legs.map((lg, i) => `${i ? `change at ${STBY[lg.from].name}, ` : `from ${STBY[lg.from].name}, `}${lineName(lg.line)}, ${stopsText(lg.stops)}`).join('; ') + `, to ${STBY[legs[legs.length - 1].to].name}` });
  legs.forEach((lg, i) => {
    wrap.append(h('span', { class: `plan-st${i ? ' is-change' : ''}` }, i ? `Change at ${STBY[lg.from].name}` : STBY[lg.from].name));
    const seg = h('span', { class: 'plan-leg' }); seg.style.setProperty('--lc', LBY[lg.line].def.css); seg.append(lineChip(lg.line), h('i', {}, stopsText(lg.stops))); wrap.append(seg);
  });
  wrap.append(h('span', { class: 'plan-st is-end' }, STBY[legs[legs.length - 1].to].name));
  return wrap;
}
// one connection, as a chip or a row: the place, its line, and why it is connected
function linkButton(c, cls) {
  const d = c.place; const b = btn(cls, null, () => go(d), { 'aria-label': `Ride to ${d.name}, ${STBY[d.station].name}. ${c.reason}` });
  const t = h('span', { class: 'lk-t' }); t.append(h('b', {}, d.short || d.name), h('span', {}, c.reason));
  b.append(lineChip(d.line), t, icon('M9 5l7 7-7 7')); return b;
}
function dock() {
  const el = dockEl; el.textContent = ''; el.hidden = mode === 'opening'; el.dataset.state = mode === 'tour' ? 'tour' : riding ? 'ride' : 'here';
  if (mode === 'opening') return;
  if (mode === 'tour' && tour) { dockTour(el); return; }
  if (riding) { dockRide(el); return; }
  const d = DID[place] || DID[placeAt(cur)]; const st = STBY[cur];
  const head = h('div', { class: 'dock-here' }); const where = h('p', { class: 'dock-at' }); where.append(h('span', {}, 'You are at'), h('b', {}, d.name), h('span', { class: 'dock-st' }, st.name));
  const open = btn('link-btn', focus.hidden ? 'Open' : 'Open again', () => openFocus(d.id), { 'aria-label': `Open ${d.name}` }); head.append(where); if (focus.hidden) head.append(open);
  const next = h('div', { class: 'dock-next' }); next.append(h('p', { class: 'dock-q', id: 'dock-q' }, offer > 0 ? `Resuming the tour in ${Math.ceil(offer)}…` : 'Where to next?'));
  const chips = h('div', { class: 'dock-chips', role: 'group', 'aria-labelledby': 'dock-q' });
  if (offer > 0) chips.append(btn('btn btn-ink btn-sm', 'Resume now', () => resumeTour()), btn('btn btn-line btn-sm', 'Stay here', () => { offer = 0; idle = -600; dock(); }));
  else {
    const n = phone.matches ? 3 : 5; const cs = graph.connections(d.id, n);
    // a place with few connections of its own (Kevin Square, the résumé) also offers the highlights
    TOURS[0].stops.forEach((id) => { if (cs.length < Math.min(n, 4) && id !== d.id && !cs.some((c) => c.place.id === id)) cs.push({ place: DID[id], reason: 'A highlight', tags: [] }); });
    cs.forEach((c) => chips.append(linkButton(c, 'chip')));
  }
  next.append(chips);
  const acts = h('div', { class: 'dock-acts' });
  const all = btn('btn btn-line btn-sm', 'All stops', () => openSheet('stops'), { 'data-all-stops': '' }); const tb = btn('btn btn-ink btn-sm', lastTour ? 'Resume tour' : 'Tour', () => (lastTour ? resumeTour() : openSheet('tours')), { 'data-tour-open': '' });
  acts.append(all, tb); if (lastTour) acts.append(btn('link-btn', 'Other tours', () => openSheet('tours')));
  el.append(head, next, acts);
}
function dockRide(el) {
  const tr = sim.trip; const lg = rideLeg || (tr && tr.legs[tr.k]); if (!tr || !lg) return;
  const head = h('div', { class: 'dock-here' }); const p = h('p', { class: 'dock-at' }); p.append(h('span', {}, tr.legs.length > 1 ? `Leg ${tr.k + 1} of ${tr.legs.length}` : 'Riding'), lineChip(lg.line), h('b', {}, `Next stop: ${STBY[lg.to].name}`)); head.append(p);
  const mid = h('div', { class: 'dock-next' }); mid.append(planStrip(tr.legs)); const bar = h('span', { class: 'ride-bar', 'data-ride-progress': '' }); bar.append(h('i')); bar.style.setProperty('--lc', LBY[lg.line].def.css); bar.style.setProperty('--k', LBY[lg.line].def.css); mid.append(bar);
  const acts = h('div', { class: 'dock-acts' }); acts.append(btn('btn btn-line btn-sm', 'Skip the ride', () => sim.skip(), { 'data-skip': '' }), btn('btn btn-line btn-sm', 'All stops', () => openSheet('stops'), { 'data-all-stops': '' }));
  el.append(head, mid, acts);
}
function dockTour(el) {
  const n = tour.def.stops.length; const d = DID[tour.def.stops[tour.i]]; const p = d.projects && projById[d.projects[0]];
  const ctl = h('div', { class: 'tour-ctl', role: 'group', 'aria-label': 'Tour controls' });
  const prev = btn('icon-btn', null, () => tourGoto(tour.i - 1), { 'aria-label': 'Previous stop', 'data-tour': 'prev' }); prev.append(icon('M15 5l-7 7 7 7')); prev.disabled = tour.i <= 0;
  const pp = btn('icon-btn tour-pp', null, () => (tour.paused ? tourPlay() : tourPause()), { 'aria-label': tour.paused ? 'Play the tour' : 'Pause the tour', 'data-tour': 'pause' }); pp.append(icon(tour.paused ? 'M8 5l11 7-11 7z' : 'M8 5v14M16 5v14'));
  const nx = btn('icon-btn', null, () => tourNext(), { 'aria-label': tour.i < n - 1 ? 'Next stop' : 'Finish the tour', 'data-tour': 'next' }); nx.append(icon('M9 5l7 7-7 7'));
  ctl.append(prev, pp, nx);
  const lab = h('div', { class: 'tour-lab' }); const t = h('p', { class: 'tour-now' }); t.append(h('span', {}, `${tour.def.name} · stop ${tour.i + 1} of ${n}`), h('b', {}, tour.shown ? (p ? p.title : d.name) : `Riding to ${p ? p.title : d.name}`));
  const dots = h('div', { class: 'tour-dots', 'aria-hidden': 'true' }); tour.def.stops.forEach((id, k) => { const i = h('i', { class: k < tour.i ? 'is-done' : k === tour.i ? 'is-on' : '' }); if (k === tour.i) i.append(h('b', { 'data-tour-fill': '' })); dots.append(i); });
  lab.append(t, dots);
  const acts = h('div', { class: 'dock-acts' });
  if (tour.paused) acts.append(btn('btn btn-ink btn-sm', 'Resume tour', () => tourPlay(), { 'data-tour': 'resume' }));
  if (p && tour.shown) { const r = btn('btn btn-ink btn-sm', 'Read the story', () => { tourPause(); openRead(p.id, $('.cap-media', capEl)); }, { 'data-tour': 'read' }); r.append(icon('M9 5l7 7-7 7')); if (!tour.paused) acts.append(r); else acts.append(btn('btn btn-line btn-sm', 'Read the story', () => openRead(p.id, null))); }
  acts.append(btn('btn btn-line btn-sm', 'Tours', () => openSheet('tours'), { 'data-tour-open': '' }), btn('btn btn-line btn-sm', 'Explore on my own', () => stopTour(true), { 'data-tour': 'exit' }));
  el.append(ctl, lab, acts);
}

/* ---------- the tour: the city shows itself ---------- */
const capEl = $('[data-cap]');
const hideCap = () => { capEl.hidden = true; capEl.textContent = ''; };
function showCap(d) {
  const p = d.projects && projById[d.projects[0]]; const st = STBY[d.station]; capEl.textContent = ''; capEl.hidden = false; capEl.style.setProperty('--lc', d.css === '#16171A' ? LBY[d.line].def.css : d.css);
  const where = h('p', { class: 'cap-where' }); st.lines.forEach((l) => where.append(lineChip(l))); where.append(h('b', {}, st.name), h('span', {}, d.name));
  const title = h('h2', { class: 'cap-title' }, p ? p.title : d.name); const one = h('p', { class: 'cap-one' }, p ? p.one : d.label || '');
  capEl.append(where, title, one);
  const s1 = p && (p.stats || [])[0]; if (s1) { const s = h('p', { class: 'cap-stat' }); s.append(h('b', {}, s1.n), h('span', {}, s1.l)); capEl.append(s); }
  if (p) { const m = h('div', { class: 'cap-media' }); m.append(coverEl(p, true)); capEl.append(m); }
  else if (d.panel === 'intro') capEl.append(h('p', { class: 'cap-one' }, KY.person.line));
  if (G && !reduce) G.fromTo(capEl, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: 'power3.out', clearProps: 'transform,opacity', overwrite: true });
}
function startTour(id, at = 0) {
  const def = TOURS.find((t) => t.id === id) || TOURS[0]; if (!def.stops.length) return;
  if (mode === 'opening') endOpening(null);
  closeSheet(true); closeRead({ fromHash: true }); closeFocus(true); offer = 0; idle = 0;
  mode = 'tour'; tour = { def, i: -1, paused: false, dwell: 0, shown: false }; lastTour = null; sim.setRate(reduce ? 1 : 2.1); setHash(`#/tour/${def.id}`);
  tourGoto(Math.max(0, Math.min(def.stops.length - 1, at)));
}
function tourGoto(i) {
  if (!tour) return; const n = tour.def.stops.length; if (i < 0 || i >= n) return;
  tour.i = i; tour.shown = false; tour.dwell = 0; hideCap(); closeFocus(true);
  const d = DID[tour.def.stops[i]];
  if (reduce) { sim.place(d.station, d.line); cur = d.station; riding = false; tourShow(d); return; }
  if (d.station === cur && !riding) { tourShow(d); return; }
  dock(); rideTo(d.station, d.id, { tour: true });
}
function tourShow(d) {
  if (!tour) return; place = d.id; tour.shown = true; tour.dwell = DWELL; showCap(d);
  if (city && !mode2d && d.hit) { city.setViewOffset(phone.matches ? 0 : Math.round(capEl.getBoundingClientRect().right), 'left'); if (!tour.paused || reduce) city.focusOn(d, { shift: -0.06 }); }
  if (city) city.highlight(d.station); if (map) map.highlight(d.station);
  dock();
}
function tourNext() { if (!tour) return; if (riding) { sim.skip(); return; } if (tour.i < tour.def.stops.length - 1) tourGoto(tour.i + 1); else endTour(); }
function tourPause() { if (!tour || tour.paused) return; tour.paused = true; dock(); }
function tourPlay() {
  if (!tour) return; tour.paused = false; idle = 0;
  if (city && !mode2d) { if (riding) city.follow('pax'); else if (tour.shown && DID[place] && DID[place].hit) city.focusOn(DID[place], { shift: -0.06 }); }
  if (tour.shown && tour.dwell < 2.5) tour.dwell = 2.5; dock();
}
// the visitor takes over: the tour steps aside and can be resumed where it was
function stopTour(open) {
  if (mode !== 'tour' || !tour) return; lastTour = { id: tour.def.id, i: tour.i }; const was = tour; tour = null; mode = 'explore'; sim.setRate(1); hideCap(); if (city) city.setViewOffset(0); setHash('');
  if (open && !riding && was.shown) openFocus(place); else dock();
}
function endTour() {
  if (!tour) return; tour = null; lastTour = null; mode = 'explore'; sim.setRate(1); hideCap(); idle = -600; if (city) { city.setViewOffset(0); if (!mode2d) city.view('overview'); } setHash(''); dock();
  openSheet('tours', 'done');
}
function resumeTour() { const t = lastTour || { id: 'highlights', i: 0 }; offer = 0; startTour(t.id, t.i); }

/* ---------- riding ----------
   sim.js runs the trip: walk to the platform, the line's train pulls in, doors, ride, doors; at a change the
   passenger walks the interchange while the next line's train pulls in. Nothing is cut: the 3D camera stays
   with the passenger the whole way, and the 2D map shows the same moves. A new destination may be asked for
   at any time: in a station it replaces the plan, on a moving train it takes over at the next stop. */
const banner = h('div', { class: 'change-banner', role: 'status', 'aria-live': 'polite', hidden: '' }); $('.city').append(banner);
function showBanner(lg) {
  banner.textContent = ''; banner.hidden = false; const k = net.cross(STBY[lg.station]);
  const row = h('span', { class: 'cb-row' }); row.append(lineChip(lg.from, true), h('span', { class: 'cb-arrow', 'aria-hidden': 'true' }, '→'), lineChip(lg.to, true));
  const txt = h('span', { class: 'cb-txt' }); txt.append(h('b', {}, `Change here: ${lineShort(lg.from)} → ${lineShort(lg.to)}`), h('span', {}, `${STBY[lg.station].name} · ${!k ? 'across the concourse' : k.up === LBY[lg.to] ? 'up the escalator' : 'down the escalator'}`));
  banner.append(row, txt);
  if (G && !reduce) G.fromTo(banner, { y: -14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out', overwrite: true });
}
const hideBanner = () => { banner.hidden = true; };
let arriveSeq = 0;
sim.on((type, d) => {
  if (type === 'trip') {
    riding = true; rideLeg = d.legs[0]; hideBanner(); hideCap();
    if (city) { city.setRoute(d.legs); city.setViewOffset(0); if (!mode2d && !(tour && tour.paused)) city.follow('pax'); city.highlight(null); } if (map) { map.setRoute(d.legs); map.highlight(null); }
    dock();
  } else if (type === 'change') {
    if (d.k > 0) { showBanner(d); if (city && !mode2d && !(tour && tour.paused)) city.follow('pax', { F: phone.matches ? 100 : 104 }); }
  } else if (type === 'leg') {
    rideLeg = d; hideBanner(); if (city && !mode2d && !(tour && tour.paused)) city.follow('pax'); dock();
  } else if (type === 'redirect') {
    const t = $('.dock-at span', dockEl); if (t) t.textContent = `New plan from ${STBY[d.via].name}`;
  } else if (type === 'arrive') {
    riding = false; rideLeg = null; cur = d.station; place = placeAt(cur, d.meta && d.meta.destId); hideBanner();
    if (city) { city.setRoute(null); city.highlight(cur); } if (map) { map.setRoute(null); map.highlight(cur); }
    const seq = ++arriveSeq; const dd = DID[place];
    if (mode === 'tour' && tour && d.meta && d.meta.tour) { tourShow(dd); return; }
    dock();
    setTimeout(() => { if (seq === arriveSeq && !riding && mode === 'explore') openFocus(place); }, reduce ? 0 : 500);
  }
});
/* Ride to a station (and open the place there). Legal in every state: it ends the opening, steps the tour
   aside, closes whatever is open, and redirects a ride that is already under way. */
function rideTo(sid, destId, o = {}) {
  if (!STBY[sid]) return;
  if (mode === 'opening') endOpening(null);
  if (mode === 'tour' && !o.tour) stopTour(false);
  closeSheet(true); closeRead({ fromHash: true }); arriveSeq++; offer = 0; idle = 0;
  if (sid === cur && !riding) { place = placeAt(sid, destId); if (o.tour) tourShow(DID[place]); else openFocus(place); return; }
  closeFocus(true);
  if (!o.tour) setHash(`#/station/${sid}`);
  const legs = sim.startTrip(sid, { destId, tour: !!o.tour });
  if (!legs.length && !riding) { place = placeAt(sid, destId); openFocus(place); }
}
const go = (d) => rideTo(d.station, d.id);
const rideToStation = (sid) => { const d = DEST.find((x) => x.station === sid); rideTo(sid, d && d.id); };

/* ---------- station focus: the building fills the stage, its story sits beside it, and it says what it is
   connected to ---------- */
function openFocus(id, opts = {}) {
  const d = DID[id]; if (!d) return;
  const st = STBY[d.station]; onHover(null); hideCap();
  focusId = id; place = id;
  const lid = st.lines.includes(d.line) ? d.line : st.lines[0]; const line = LBY[lid]; const ps = line.stations.find((p) => p.id === st.id);
  focus.style.setProperty('--lc', d.css === '#16171A' ? line.def.css : d.css);
  const where = $('[data-focus-where]'); where.textContent = ''; st.lines.forEach((l) => where.append(lineChip(l)));
  where.append(h('b', {}, st.name), h('span', { lang: 'zh-Hans' }, st.zh), h('span', { class: 'focus-code' }, ps.code));
  // other buildings at this station
  const tabs = $('[data-focus-tabs]'); tabs.textContent = ''; const here = DEST.filter((x) => x.station === st.id);
  tabs.hidden = here.length < 2;
  here.forEach((x) => tabs.append(btn('focus-tab', x.name, () => openFocus(x.id), { 'aria-pressed': String(x.id === id) })));
  const projects = (d.projects || []).map((pid) => projById[pid]).filter(Boolean); const p = projects[0];
  $('[data-focus-title]').textContent = p ? p.title : d.name;
  $('[data-focus-place]').textContent = p ? `${d.name}${st.lines.length > 1 ? ` · where ${st.lines.map((l) => LBY[l].def.label).join(' meets ')}` : ''}` : (d.label || '');
  $('[data-focus-dek]').textContent = p ? p.one : '';
  $('[data-focus-dek]').hidden = !p;
  const stats = $('[data-focus-stats]'); stats.textContent = '';
  if (p) { const st3 = (p.stats || []).slice(0, 3); st3.forEach((x) => { const c = h('div'); c.append(h('dt', {}, x.n), h('dd', {}, x.l)); stats.append(c); }); const sl = h('div'); const dt = h('dt', { class: 'is-status' }); dt.append(statusMark(p), document.createTextNode(STATUS[p.status])); sl.append(dt, h('dd', {}, [p.role, p.year].filter(Boolean).join(' · '))); if (st3.length < 3) stats.append(sl); }
  stats.hidden = !p;
  const media = $('[data-focus-media]'); media.textContent = ''; media.hidden = !p;
  const body = $('[data-focus-body]'); body.textContent = '';
  const acts = $('[data-focus-actions]'); acts.textContent = '';
  if (p) {
    const lead = btn('focus-lead', null, () => openRead(p.id, lead), { 'aria-label': `${p.title}: read the story` }); lead.append(coverEl(p, true)); media.append(lead);
    const read1 = btn('btn btn-ink', 'Read the story', () => openRead(p.id, lead)); read1.append(icon('M9 5l7 7-7 7')); acts.append(read1);
    (p.links || []).slice(0, 1).forEach((l) => { const a = h('a', { class: 'btn btn-line', href: l.href, target: '_blank', rel: 'noopener' }, l.label); a.append(icon('M7 17L17 7M9 7h8v8')); acts.append(a); });
    const tg = p.tags || []; /* the lead project's own tags: a second project in the building has its own */ if (tg.length) { const tl = h('ul', { class: 'tagrow', 'aria-label': 'Built with' }); tg.forEach((t) => { const li = h('li'); li.append(btn('tag-b', t, () => openSheet('skills', t), { 'aria-label': `${t}: see everything that uses it` })); tl.append(li); }); body.append(tl); }
    if (projects.length > 1) { const more = h('div', { class: 'focus-more' }); more.append(h('p', {}, 'Also in this building')); projects.slice(1).forEach((q) => more.append(tile(q))); body.append(more); }
  } else if (d.panel === 'timetable') body.append(resumeBlock());
  else if (d.panel === 'news') body.append(news());
  else if (d.panel === 'terminus') body.append(terminus());
  else if (d.panel === 'intro') body.append(introBlock());
  // what this place is connected to, and why: ride straight there
  const links = $('[data-focus-links]'); links.textContent = ''; const cs = graph.connections(d.id, 4);
  if (cs.length) { links.append(h('h3', {}, 'Connected to')); const ul = h('div', { class: 'lk-list' }); cs.forEach((c) => ul.append(linkButton(c, 'lk'))); links.append(ul); }
  const opening2 = focus.hidden; focus.hidden = false; fPanel.scrollTop = 0;
  if (city) { city.highlight(st.id); city.setViewOffset(phone.matches ? 0 : Math.round(fPanel.getBoundingClientRect().right), 'left'); if (d.hit && !mode2d) city.focusOn(d); }
  if (map) { map.highlight(st.id); map.setInset(phone.matches ? 0 : Math.round(fPanel.getBoundingClientRect().right), 0); }
  if (!opts.fromHash && read.hidden) setHash(`#/station/${st.id}`);
  if (G && !reduce) G.fromTo(opening2 ? [fPanel] : '.focus-panel > *', opening2 ? (phone.matches ? { yPercent: 14, opacity: 0 } : { x: -28, opacity: 0 }) : { opacity: 0, y: 10 }, { x: 0, y: 0, yPercent: 0, opacity: 1, duration: opening2 ? 0.6 : 0.4, ease: 'expo.out', stagger: opening2 ? 0 : 0.02, clearProps: 'transform,opacity', overwrite: true });
  dock();
  if (!opts.quiet) $('[data-focus-title]').focus({ preventScroll: true });
}
function closeFocus(silent) {
  if (focus.hidden) return; focus.hidden = true; focusId = null;
  if (city) city.setViewOffset(0); if (map) map.setInset(0, 0);
  if (silent) return;
  setHash(''); if (city && !mode2d && !riding) city.view('overview');
  dock();
}
$('[data-focus-back]').addEventListener('click', () => { closeFocus(); $('button', dockEl)?.focus({ preventScroll: true }); });

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
const ttRow = (r) => { const d = h('div', { class: 'tt-row' }); d.append(h('p', { class: 'tt-when' }, r.when)); const w = h('div'); w.append(h('p', { class: 'tt-role' }, r.role || r.org)); if (r.role && r.org) w.append(h('p', { class: 'tt-org' }, r.org)); if (r.note) w.append(h('p', { class: 'tt-note' }, r.note)); d.append(w); return d; };
const secHead = (t) => h('h3', { class: 'sec-h' }, t);
function educationBlock() { const ed = h('div'); KY.resume.education.forEach((r) => ed.append(ttRow({ when: r.when, role: r.org, note: r.note }))); return ed; }
function experienceBlock() { const ex = h('div'); KY.resume.experience.forEach((r) => ex.append(ttRow(r))); return ex; }
function skillsBlock() {
  const sk = h('dl', { class: 'skills' }); KY.resume.skills.forEach(([k, v]) => { const x = h('div'); x.append(h('dt', {}, k), h('dd', {}, v)); sk.append(x); });
  const wrap = h('div', { class: 'stack' }); wrap.append(sk); const b = btn('btn btn-line btn-sm', 'See where each skill is used', () => openSheet('skills')); b.append(icon('M9 5l7 7-7 7')); wrap.append(b); return wrap;
}
function resumeBlock() { const wrap = h('div', { class: 'stack' }); wrap.append(secHead('Education'), educationBlock(), secHead('Experience'), experienceBlock(), secHead('Skills'), skillsBlock()); return wrap; }
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
  const ps = btn('btn btn-line', 'Show my pass', (e) => openPass(e.currentTarget));
  act.append(li, ph, ps);
  if (KY.contact.email) act.append(h('a', { class: 'btn btn-line', href: `mailto:${KY.contact.email}` }, 'Email'));
  if (KY.contact.x) act.append(h('a', { class: 'btn btn-line', href: KY.contact.x, target: '_blank', rel: 'noopener' }, 'X'));
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
function factsList() {
  const P = KY.person; const facts = h('ul', { class: 'intro-facts' });
  [['Now', 'Co-founder and CTO of Hirvo'], ['Studies', 'Biomedical engineering at Purdue, on a gap year to build full time'], ['Started', P.since.replace('First line of code: ', 'First line of code, ').replace(/\.$/, '')], ['Works in', `${P.languages} · ${P.places}`], ['How', 'Builds by directing AI coding agents']].forEach(([k, v]) => { const li = h('li'); li.append(h('span', {}, k), h('b', {}, v)); facts.append(li); });
  return facts;
}
// what Kevin builds: one row per line, with how much is on it
function linesBlock() {
  const ul = h('div', { class: 'lines-list' });
  ORDER.forEach((lid) => { const ds = DEST.filter((d) => d.line === lid); const n = ds.reduce((a, d) => a + (d.projects ? d.projects.length : 0), 0); const b = btn('line-row', null, () => openSheet('stops', lid), { 'aria-label': `${lineName(lid)}: see its stops` }); b.style.setProperty('--lc', LBY[lid].def.css);
    const t = h('span', { class: 'lk-t' }); t.append(h('b', {}, lineName(lid)), h('span', {}, lid === 'c' ? 'Résumé, newsletter, contact' : `${n} project${n > 1 ? 's' : ''}: ${ds.flatMap((d) => (d.projects || []).map((id) => SHORT[id] || projById[id].title)).join(', ')}`)); b.append(lineChip(lid, true), t, icon('M9 5l7 7-7 7')); ul.append(b); });
  return ul;
}
function introBlock() { const wrap = h('div', { class: 'stack' }); wrap.append(h('p', { class: 'intro-line' }, KY.person.short), factsList(), secHead('What I build'), linesBlock(), contactRow()); return wrap; }

/* ---------- the sheets: All stops, Skills, About, Contact, the tour picker ---------- */
const sheetEl = $('[data-sheet]'); const sheetBody = $('[data-sheet-body]'); let sheetFrom = null;
function openSheet(name, arg) {
  if (mode === 'opening') endOpening(null);
  if (mode === 'tour' && name !== 'tours') tourPause();
  if (name === 'skills') closeFocus(true); // the Skills view needs the whole city
  if (sheet !== name) sheetFrom = document.activeElement;
  setSkill(null); sheet = name; sheetEl.hidden = false; sheetEl.dataset.kind = name; sheetBody.textContent = ''; sheetBody.scrollTop = 0; offer = 0; idle = 0; onHover(null);
  const title = { stops: 'All stops', skills: 'Skills', about: 'Kevin Yu', contact: 'Contact', tours: arg === 'done' ? 'That was the tour. Where next?' : 'Pick a tour' }[name];
  $('[data-sheet-title]').textContent = title;
  ({ stops: sheetStops, skills: sheetSkills, about: sheetAbout, contact: sheetContact, tours: sheetTours })[name](arg);
  { const w = name === 'skills' && !phone.matches ? Math.round($('.sheet-in').getBoundingClientRect().width + 24) : 0; if (city) city.setViewOffset(w, 'right'); if (map) map.setInset(0, w); }
  setHash({ stops: '#/work', skills: `#/skills${arg ? `/${encodeURIComponent(arg)}` : ''}`, about: '#/about', contact: '#/contact' }[name] || location.hash);
  $$('[data-nav]').forEach((b) => b.setAttribute('aria-current', String(b.dataset.nav === name)));
  if (G && !reduce) G.fromTo('.sheet-in', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out', clearProps: 'transform,opacity', overwrite: true });
  $('[data-sheet-title]').focus({ preventScroll: true });
}
function closeSheet(silent) {
  if (!sheet) return; const was = sheet; sheet = null; sheetEl.hidden = true; setSkill(null); if (was === 'skills') { if (city) city.setViewOffset(0); if (map) map.setInset(0, 0); } $$('[data-nav]').forEach((b) => b.setAttribute('aria-current', 'false'));
  if (silent) return; restHash(); if (was !== 'tours' || mode !== 'tour') sheetFrom?.focus?.({ preventScroll: true }); dock();
}
$$('[data-sheet-close]').forEach((b) => b.addEventListener('click', () => closeSheet()));
$$('[data-nav]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); if (sheet === b.dataset.nav) closeSheet(); else openSheet(b.dataset.nav); }));
// a place, as a row: ride there
function stopRow(d, extra) {
  const st = STBY[d.station]; const here = d.station === cur && !riding;
  const b = btn('stop-row', null, () => go(d), { 'aria-label': `${d.name}, ${st.name}. ${here ? 'You are here: open' : 'Ride here'}`, 'data-place': d.id });
  const chips = h('span', { class: 'chips' }); st.lines.forEach((l) => chips.append(lineChip(l)));
  const t = h('span', { class: 'lk-t' }); t.append(h('b', {}, d.projects ? titleOf(d) : d.name), h('span', {}, extra || `${d.projects ? `${d.name} · ` : ''}${st.name}${d.projects ? '' : ` · ${d.label}`}`));
  b.append(chips, t, h('span', { class: 'stop-go' }, here ? 'Open' : 'Ride')); return b;
}
function sheetStops(lineId) {
  const bar = h('div', { class: 'sheet-tools' }); const inp = h('input', { type: 'search', class: 'filter', placeholder: 'Filter: a project, a station, a skill', 'aria-label': 'Filter the stops', autocomplete: 'off', spellcheck: 'false' });
  const pick = h('div', { class: 'pick', role: 'group', 'aria-label': 'Lines' }); let only = lineId || null;
  const list = h('div', { class: 'stops' }); const none = h('p', { class: 'sheet-none', hidden: '' }, 'Nothing matches. Try a project, a station or a skill.');
  const draw = () => {
    const q = inp.value.trim().toLowerCase(); list.textContent = ''; let count = 0;
    $$('button', pick).forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.line || null) === only)));
    ORDER.filter((l) => !only || l === only).forEach((lid) => {
      const ds = LBY[lid].stations.flatMap((ps) => DEST.filter((d) => d.station === ps.id && d.line === lid)).filter((d) => !q || [d.name, d.short, STBY[d.station].name, titleOf(d), ...graph.tagsOf(d.id), LBY[lid].def.label].join(' ').toLowerCase().includes(q));
      if (!ds.length) return; count += ds.length;
      const sec = h('section', { class: 'stops-g' }); sec.style.setProperty('--lc', LBY[lid].def.css); const hd = h('h3'); hd.append(lineChip(lid, true), document.createTextNode(lineName(lid))); sec.append(hd); ds.forEach((d) => sec.append(stopRow(d))); list.append(sec);
    });
    none.hidden = count > 0;
  };
  pick.append(btn('pick-b', 'All lines', () => { only = null; draw(); }));
  ORDER.forEach((lid) => { const b = btn('pick-b', null, () => { only = lid; draw(); }, { 'data-line': lid, 'aria-label': lineName(lid) }); b.append(lineChip(lid), h('span', {}, LBY[lid].def.label)); pick.append(b); });
  inp.addEventListener('input', draw); bar.append(inp, pick); sheetBody.append(bar, list, none); draw();
}
// the Skills view: pick a tag, and every station that uses it lights up, joined to the others
function setSkill(tag) {
  skill = tag; const ds = tag ? graph.byTag(tag) : []; const sids = [...new Set(ds.map((d) => d.station))];
  if (city) city.setLinks(tag ? sids : null); if (map) map.setLinks(tag ? sids : null);
}
function sheetSkills(tag) {
  sheetBody.append(h('p', { class: 'sheet-lede' }, 'What I build with, and the kind of work it is. Pick one: every station that uses it lights up, joined to the others.'));
  const res = h('div', { class: 'skill-res', 'aria-live': 'polite' }); const groups = h('div', { class: 'skill-groups' });
  const pickTag = (t) => {
    const on = skill === t ? null : t; setSkill(on); $$('.skill-b', groups).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tag === on)));
    res.textContent = ''; setHash(`#/skills${on ? `/${encodeURIComponent(on)}` : ''}`); if (!on) { if (city && !mode2d && !riding) city.view('overview'); return; }
    const ds = graph.byTag(on); const n = ds.reduce((a, d) => a + d.projects.filter((id) => (projById[id].tags || []).includes(on)).length, 0);
    const hd = h('h3', {}, `${on}: ${n} project${n > 1 ? 's' : ''}, ${new Set(ds.map((d) => d.station)).size} station${new Set(ds.map((d) => d.station)).size > 1 ? 's' : ''}`); res.append(hd);
    ds.forEach((d) => d.projects.filter((id) => (projById[id].tags || []).includes(on)).forEach((id) => { const p = projById[id]; const r = stopRow(d, `${p.one}`); $('.lk-t b', r).textContent = p.title; res.append(r); }));
    if (city && !mode2d && !riding) city.view('overview');
  };
  graph.groups.forEach(([g, tags]) => { if (!tags.length) return; const sec = h('section', { class: 'skill-g' }); sec.append(h('h3', {}, g)); const row = h('div', { class: 'skill-row' });
    tags.forEach((t) => { const b = btn('skill-b', null, () => pickTag(t), { 'data-tag': t, 'aria-pressed': 'false' }); b.append(document.createTextNode(t), h('i', {}, String(graph.byTag(t).reduce((a, d) => a + d.projects.filter((id) => (projById[id].tags || []).includes(t)).length, 0)))); row.append(b); }); sec.append(row); groups.append(sec); });
  sheetBody.append(groups, res); if (tag && graph.all.includes(tag)) pickTag(tag);
}
function sheetAbout() {
  const P = KY.person; const top = h('div', { class: 'about-top' }); const nm = h('p', { class: 'about-name' }); nm.append(document.createTextNode(P.name), h('span', { lang: 'zh-Hans' }, P.alt[1]));
  top.append(nm, h('p', { class: 'about-line' }, P.line), h('p', { class: 'intro-line' }, P.short)); sheetBody.append(top, factsList());
  sheetBody.append(secHead('What I build'), linesBlock(), secHead('Education'), educationBlock(), secHead('Skills'), skillsBlock(), secHead('Experience'), experienceBlock(), secHead('Contact'), contactRow());
}
function sheetContact() {
  const wrap = h('div', { class: 'stack' }); wrap.append(h('p', { class: 'sheet-lede' }, 'If you want to build something together, this is the stop.'));
  const asks = h('ul', { class: 'asks' }); KY.contact.asks.forEach((a) => asks.append(h('li', {}, a))); wrap.append(asks, contactRow());
  const qr = h('figure', { class: 'qr' }); qr.append(h('img', { src: KY.contact.wechatQr, alt: 'WeChat QR code for Kevin Yu', width: '104', height: '104', loading: 'lazy' }), h('figcaption', {}, 'Or scan in WeChat')); wrap.append(qr);
  const go2 = btn('btn btn-line btn-sm', 'Ride to the Non-stop Observatory', () => go(DID.nonstop)); if (DID.nonstop) wrap.append(go2); sheetBody.append(wrap);
}
function sheetTours() {
  const list = h('div', { class: 'tours' });
  TOURS.forEach((t) => { const b = btn('tour-b', null, () => startTour(t.id), { 'data-tour-id': t.id, 'aria-label': `${t.name}: ${t.stops.length} stops` }); if (t.line) b.style.setProperty('--lc', LBY[t.line].def.css);
    const tx = h('span', { class: 'lk-t' }); tx.append(h('b', {}, t.name), h('span', {}, `${stopsText(t.stops.length)} · ${t.sub}`), h('span', { class: 'tour-stops' }, t.stops.map((id) => DID[id].short || DID[id].name).join(' → ')));
    b.append(t.line ? lineChip(t.line, true) : h('span', { class: 'lchip lchip-lg lchip-all', 'aria-hidden': 'true' }, t.id === 'highlights' ? '★' : 'A–Z'), tx, icon('M8 5l11 7-11 7z')); list.append(b); });
  sheetBody.append(list); const ex = btn('btn btn-line btn-sm', 'Explore on my own', () => closeSheet()); sheetBody.append(ex);
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
  if (city && !mode2d) city.resume();
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

/* ---------- the opening: what this is, two ways in, and the tour starts by itself ---------- */
const opEl = $('[data-opening]'); const OPEN_S = 6.5;
function startOpening() {
  mode = 'opening'; opEl.hidden = false; document.body.classList.add('is-opening'); opening = reduce ? 0 : OPEN_S; dock();
  $('[data-opening-note]').textContent = reduce ? '' : 'The tour starts by itself in a moment.';
  if (city && !mode2d) city.fly({ x: 560, z: 40, F: 760, th: 1.52, ph: 0.37 }, { x: 10, z: -30, F: 600, th: 1.12, ph: 0.56 }, reduce ? 0 : 6);
  if (G && !reduce) G.fromTo('.opening-in > *', { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out', stagger: 0.12, delay: 0.25, clearProps: 'transform,opacity' });
  $('#opening-title').focus({ preventScroll: true });
}
function endOpening(next) {
  if (mode !== 'opening') return; mode = 'explore'; opening = 0; opEl.hidden = true; document.body.classList.remove('is-opening');
  if (next === 'tour') startTour('highlights'); else if (next === 'explore') { if (city && !mode2d) city.view('overview'); dock(); $('button', dockEl)?.focus({ preventScroll: true }); } else dock();
}
$('[data-opening-tour]').addEventListener('click', () => endOpening('tour'));
$('[data-opening-explore]').addEventListener('click', () => endOpening('explore'));

/* ---------- 2D and 3D: two views of the same trains, the same trip and the same panels ---------- */
function set2D(on) {
  if (!map || (!city && !on)) return; mode2d = on; map.show(on); stage.classList.toggle('is-2d', on); document.body.classList.toggle('is-2d', on);
  if (city) { if (on) city.pause(); else { city.resume(); if (riding) city.follow('pax', { instant: true }); else if (!focus.hidden && focusId && DID[focusId].hit) city.focusOn(DID[focusId]); else if (tour && tour.shown && DID[place].hit) city.focusOn(DID[place]); } }
  $$('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.view === '2d') === on))); onHover(null); if (skill) setSkill(skill);
}
$$('[data-view]').forEach((b) => b.addEventListener('click', () => set2D(b.dataset.view === '2d')));

/* ---------- hover tip ---------- */
const tip = h('div', { class: 'hover-tip', 'aria-hidden': 'true' }); document.body.append(tip);
function tipFor(pick) {
  tip.textContent = '';
  const line1 = h('span', { class: 'tip-k' }); const big = h('b'); const sub = h('span', { class: 'tip-sub' }); const act = h('span', { class: 'tip-act' });
  if (pick.type === 'dest') {
    const d = DID[pick.id]; const st = STBY[d.station]; const here = d.station === cur && !riding;
    st.lines.forEach((lid) => line1.append(lineChip(lid))); line1.append(document.createTextNode(st.name));
    big.textContent = d.name; sub.textContent = titleOf(d); act.textContent = here ? 'You’re here · Open' : 'Ride here';
  } else if (pick.type === 'plot') {
    const pl = PLOTS.find((x) => x.id === pick.id); line1.append(document.createTextNode(pl ? pl.near : 'Empty plot'));
    big.textContent = 'Next project'; sub.textContent = 'Under construction: still searching'; act.textContent = 'A station and a building go here';
  } else if (pick.type === 'station') {
    const st = STBY[pick.id]; st.lines.forEach((lid) => line1.append(lineChip(lid))); line1.append(document.createTextNode(st.lines.length > 1 ? 'Interchange' : 'Station'));
    big.textContent = st.name; sub.textContent = DEST.filter((d) => d.station === st.id).map((d) => d.name).join(' · ');
    act.textContent = st.id === cur && !riding ? 'You’re here · Open' : 'Ride here';
  } else { const lid = pick.line || '1'; line1.append(lineChip(lid), document.createTextNode(lineName(lid))); big.textContent = `The ${lineShort(lid)} train`; sub.textContent = riding && rideLeg && rideLeg.line === lid ? `Next stop: ${STBY[rideLeg.to].name}` : 'It never stops: end to end, all day'; act.textContent = 'Follow this train'; }
  tip.append(line1, big, sub, act);
}
let tipKey = ''; let tipTimer = null; const lastPtr = [0, 0]; addEventListener('pointerdown', (e) => { lastPtr[0] = e.clientX; lastPtr[1] = e.clientY; }, { passive: true });
function onHover(pick, x, y) {
  if (!pick) { tip.classList.remove('is-on'); tipKey = ''; return; }
  const key = JSON.stringify(pick) + riding + cur; if (key !== tipKey) { tipFor(pick); tipKey = key; }
  if (x != null) { const w = tip.offsetWidth; const left = Math.min(innerWidth - w - 8, x + 16); tip.style.transform = `translate(${left}px, ${Math.max(8, y - 12 - tip.offsetHeight)}px)`; tip.classList.add('is-on'); }
}

/* ---------- keys, the clock, links ---------- */
// the camera from the keyboard: arrows pan, Q and E turn, R and F tilt, + and − zoom, M switches 2D and 3D
const KEYS = { ArrowLeft: ['right', -1], ArrowRight: ['right', 1], ArrowUp: ['up', 1], ArrowDown: ['up', -1], q: ['turn', 1], e: ['turn', -1], r: ['tilt', 1], f: ['tilt', -1], '+': ['zoom', -1], '=': ['zoom', -1], '-': ['zoom', 1], _: ['zoom', 1] };
const keyFree = (e) => read.hidden && pass.hidden && !e.metaKey && !e.ctrlKey && !e.altKey && !e.target.closest('input, textarea, select, .focus-panel, .sheet-in');
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && read.hidden && pass.hidden) { if (sheet) { e.preventDefault(); closeSheet(); } else if (!focus.hidden) { e.preventDefault(); closeFocus(); } else if (mode === 'opening') endOpening('explore'); return; }
  if (!keyFree(e)) return; const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (key === 'm' && map && city) { e.preventDefault(); set2D(!mode2d); return; }
  if (mode === 'tour' && key === ' ' && !e.target.closest('button, a')) { e.preventDefault(); if (tour.paused) tourPlay(); else tourPause(); return; }
  const kk = KEYS[key]; if (!kk) return;
  if (mode2d) { if (kk[0] === 'zoom') { e.preventDefault(); map.zoomBy(kk[1] < 0 ? 1.25 : 0.8); } return; }
  if (city) { e.preventDefault(); city.hold(kk[0], kk[1]); }
});
addEventListener('keyup', (e) => { const key = e.key.length === 1 ? e.key.toLowerCase() : e.key; const kk = KEYS[key]; if (kk && city) city.hold(kk[0], 0); });
addEventListener('blur', () => city && city.release());
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => addEventListener(ev, () => { idle = Math.min(idle, 0) < 0 ? idle : 0; if (offer > 0) { offer = 0; dock(); } }, { passive: true }));
// one clock for everything that counts down: the opening, a tour stop, the idle offer. It stops with the tab
let lastTick = 0;
function tick(now) {
  requestAnimationFrame(tick); if (document.hidden) { lastTick = now; return; }
  const dt = Math.min(0.25, lastTick ? (now - lastTick) / 1000 : 0); lastTick = now; sim.advance(now);
  if (riding) { const bar = $('[data-ride-progress]'); if (bar) bar.style.setProperty('--p', sim.progress().toFixed(3)); }
  const quiet = read.hidden && pass.hidden && !sheet;
  if (mode === 'opening' && opening > 0) { opening -= dt; opEl.style.setProperty('--left', Math.max(0, opening / OPEN_S).toFixed(3)); if (opening <= 0) endOpening('tour'); }
  else if (mode === 'tour' && tour && tour.shown && !tour.paused && !reduce && quiet) { tour.dwell -= dt; const f = $('[data-tour-fill]'); if (f) f.style.transform = `scaleX(${Math.min(1, 1 - tour.dwell / DWELL).toFixed(3)})`; if (tour.dwell <= 0) tourNext(); }
  else if (mode === 'explore' && !riding && quiet && focus.hidden && !reduce) {
    idle += dt;
    if (offer > 0) { const b = Math.ceil(offer); offer -= dt; if (offer <= 0) { offer = 0; resumeTour(); } else if (Math.ceil(offer) !== b) { const q = $('.dock-q', dockEl); if (q) q.textContent = `Resuming the tour in ${Math.ceil(offer)}…`; } }
    else if (idle > 25) { idle = 0; offer = 8; dock(); }
  } else if (mode === 'explore') idle = Math.min(idle, 0) < 0 ? idle + dt : 0;
}
function route() {
  const m = location.hash.match(/^#\/(tour|skills|station)?\/?([^/]*)$/); if (!m) return null; const a = m[1]; const b = decodeURIComponent(m[2] || '');
  if (a === 'tour') return { tour: TOURS.some((t) => t.id === b) ? b : 'highlights' };
  if (a === 'skills') return { sheet: 'skills', arg: b || undefined };
  if (a === 'station') return STBY[b] ? { station: b } : null;
  if (b === 'about' || b === 'contact') return { sheet: b }; if (b === 'work') return { sheet: 'stops' }; if (b === 'skills') return { sheet: 'skills' };
  const d = destOfProject(b); if (d) return { station: d.station, project: b, dest: d.id };
  if (DID[b]) return { station: DID[b].station, dest: b };
  return null;
}
// a link (typed, clicked, or back and forward in the browser) puts the page in the state it names
function applyRoute(r) {
  if (!r) { closeRead({ fromHash: true }); if (!location.hash) { if (sheet) closeSheet(true); if (!focus.hidden) closeFocus(true); dock(); } return; }
  if (mode === 'opening') endOpening(null);
  if (r.tour) { if (!(mode === 'tour' && tour && tour.def.id === r.tour)) startTour(r.tour); return; }
  if (r.sheet) { closeRead({ fromHash: true }); if (sheet !== r.sheet || (r.arg && r.arg !== skill)) openSheet(r.sheet, r.arg); return; }
  if (mode === 'tour') stopTour(false); if (sheet) closeSheet(true);
  if (r.station !== cur && !riding) { cur = r.station; sim.place(cur); place = placeAt(cur, r.dest); }
  const id = r.dest || placeAt(r.station);
  if (r.project) { if (focusId !== id) openFocus(id, { fromHash: true }); openRead(r.project, null, { fromHash: true }); }
  else { closeRead({ fromHash: true }); if (focusId !== id) openFocus(id, { fromHash: true }); }
}
addEventListener('hashchange', () => applyRoute(route()));

/* ---------- boot: the 3D city and the 2D map; the 2D map alone when there is no WebGL ---------- */
const webgl = () => { if (/[?&]flat/.test(location.search)) return false; try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } };
async function boot() {
  const r = route();
  if (r && r.station) { cur = r.station; place = placeAt(cur, r.dest); }
  sim.place(cur);
  if (webgl()) {
    try {
      // the city is built from the model library (models/); without it, or without WebGL, the 2D map is the site
      const mq = location.search.match(/[?&]models=([^&]+)/); const { loadLibrary } = await import('./models.js');
      const lib = mq && mq[1] === 'off' ? null : await loadLibrary(mq ? decodeURIComponent(mq[1]) : MODELS.base);
      if (!lib) throw new Error('the model library is not available');
      const { createCity } = await import('./scene.js');
      city = createCity(stage, {
        reduce, isPhone: phone.matches, destinations: DEST, lib, sim,
        onHover,
        // the visitor takes the camera: a tour waits, the opening gives way
        onFree: (on) => { if (!on) return; if (mode === 'tour' && tour && !tour.paused) tourPause(); if (mode === 'opening') endOpening('explore'); },
        onCam: (th) => { const n = $('[data-ctl-needle]'); if (n) n.style.transform = `rotate(${(th * 180 / Math.PI).toFixed(1)}deg)`; },
        onPick: (p) => {
          onHover(null);
          if (p.type === 'train') { if (mode === 'tour') tourPause(); city.follow(riding ? 'pax' : p.line); return; }
          if (p.type === 'station') { rideToStation(p.id); return; }
          if (p.type === 'plot') { tipFor(p); tip.style.transform = `translate(${Math.min(innerWidth - 300, lastPtr[0] + 16)}px, ${Math.max(8, lastPtr[1] - 120)}px)`; tip.classList.add('is-on'); clearTimeout(tipTimer); tipTimer = setTimeout(() => onHover(null), 2600); return; }
          const d = DID[p.id]; if (d) go(d); // a click on a building rides to its station (changing lines if it must), then opens it
        },
      });
    } catch (e) { console.warn('3D city unavailable; showing the 2D map.', e); city = null; $$('.city-canvas, .tags, .bubble', stage).forEach((n) => n.remove()); }
  }
  map = createMap2D(stage, { net, dests: DEST, plots: PLOTS, sim, reduce, linked: graph.linked, onStation: (sid) => rideToStation(sid), onDest: (d) => go(d) });
  if (!city) { stage.classList.add('is-flat'); document.body.classList.add('is-flat'); mode2d = true; map.show(true); $$('[data-view]').forEach((b) => { b.disabled = b.dataset.view === '3d'; b.setAttribute('aria-pressed', String(b.dataset.view === '2d')); }); }
  else if (/[?&]2d/.test(location.search)) set2D(true);
  // the camera cluster
  $$('[data-ctl]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.ctl;
    if (mode2d) { if (k === 'in') map.zoomBy(1.3); if (k === 'out') map.zoomBy(1 / 1.3); if (k === 'all') map.reset(); return; }
    if (!city) return;
    if (k === 'north') city.north(); if (k === 'left') city.turnBy(Math.PI / 6); if (k === 'right') city.turnBy(-Math.PI / 6);
    if (k === 'up') city.tiltBy(0.2); if (k === 'down') city.tiltBy(-0.2); if (k === 'in') city.zoomBy(1 / 1.35); if (k === 'out') city.zoomBy(1.35);
    if (k === 'all') { if (mode === 'tour') tourPause(); city.view('overview'); }
  }));
  if (/[?&]debug/.test(location.search)) window.__kmetro = { city, map, sim, graph, rideTo, rideToStation, go, openFocus, closeFocus, openRead, openSheet, closeSheet, startTour, set2D, onHover, DEST, TOURS, net,
    state: () => ({ mode, cur, place, riding, mode2d, focusId, sheet, skill, article: !read.hidden, tour: tour ? { id: tour.def.id, i: tour.i, shown: tour.shown, paused: tour.paused } : null, offer: offer > 0 }),
    reset: (sid = 'kevin') => { closeRead({ fromHash: true }); closeSheet(true); if (mode === 'opening') endOpening(null); if (tour) { tour = null; mode = 'explore'; sim.setRate(1); } lastTour = null; hideCap(); closeFocus(true); sim.place(sid); cur = sid; place = placeAt(sid); riding = false; idle = 0; offer = 0; if (city) { city.setRoute(null); city.setViewOffset(0); city.view('overview', { instant: true }); } if (map) { map.setRoute(null); map.highlight(sid); } setHash(''); dock(); } };
  if (city) { city.highlight(cur); city.view('overview', { instant: true }); }
  map.highlight(cur);
  requestAnimationFrame(tick);
  if (r) { dock(); applyRoute(r); }
  else if (/[?&]nointro/.test(location.search)) { setHash(''); dock(); }
  else { setHash(''); startOpening(); }
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot); else boot();
