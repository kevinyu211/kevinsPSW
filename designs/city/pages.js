/* Island city · the pages the train doors open onto
   A project page for every building, and the tower page about Kevin.
   Every word and number comes from ../shared/content.js (window.KY) or from NUMBERS in city-data.js. */
import { DISTRICTS, LEVELS, NUMBERS, THRIVING } from './city-data.js';

export const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v === false || v == null) continue; if (k === 'class') el.className = v; else if (k === 'style') el.style.cssText = v; else if (k === 'text') el.textContent = v; else el.setAttribute(k, v === true ? '' : v); }
  kids.flat().forEach((c) => { if (c != null && c !== false) el.append(c); });
  return el;
};
export const sv = (tag, attrs = {}, parent) => { const el = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); if (parent) parent.append(el); return el; };
export const icon = (d, box = '0 0 24 24') => { const s = sv('svg', { viewBox: box, 'aria-hidden': 'true' }); d.split('|').forEach((p) => sv('path', { d: p }, s)); return s; };
const IC = { go: 'M5 12h14|M13 6l6 6-6 6', out: 'M7 17L17 7|M8 7h9v9', play: 'M7 4.5v15l13-7.5z', phone: 'M6 3h4l1.5 5-2.5 1.5a12 12 0 0 0 5.5 5.5L16 12.5l5 1.5v4a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z', card: 'M3 6h18v12H3z|M7 10h5|M7 14h8', tram: 'M7 4h10v12H7z|M9 20l1.5-4|M15 20l-1.5-4|M7 11h10' };
const DIST = Object.fromEntries(DISTRICTS.map((d) => [d.id, d]));
const fmt = (n) => Number(n).toLocaleString('en-US');
const orList = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} or ${a[a.length - 1]}`);
const dateOf = (iso) => { const d = new Date(`${iso}T12:00:00`); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
export const levelText = (n) => `Level ${n} · ${LEVELS[n].name}`;
/** Five small blocks, the first n filled. */
export const levelMeter = (n) => { const m = h('span', { class: 'lvl', 'aria-hidden': 'true' }); for (let i = 1; i <= 5; i++) m.append(h('i', { class: i <= n ? 'on' : '' })); return m; };

/* ---------- illustrations for work with no pictures to show ---------- */
function mock(kind) {
  const s = sv('svg', { viewBox: '0 0 640 400', class: 'mock', role: 'img', 'aria-label': 'Illustration' });
  const T = (x, y, txt, a = {}) => { const t = sv('text', { x, y, 'font-size': 16, fill: '#16171a', ...a }, s); t.textContent = txt; return t; };
  if (kind === 'risk') {
    sv('rect', { x: 60, y: 40, width: 520, height: 320, rx: 4, fill: '#fff', stroke: '#C9C9C3' }, s);
    sv('rect', { x: 84, y: 64, width: 228, height: 74, rx: 3, fill: '#F1F1EC' }, s); sv('rect', { x: 328, y: 64, width: 228, height: 74, rx: 3, fill: '#F1F1EC' }, s);
    T(100, 100, '32,592', { 'font-size': 26, 'font-weight': 800 }); T(100, 124, 'sanctions entries checked', { 'font-size': 13, fill: '#5E5F5B' });
    T(344, 100, '4 lists', { 'font-size': 26, 'font-weight': 800 }); T(344, 124, 'checked every day', { 'font-size': 13, fill: '#5E5F5B' });
    [['Buyer · Germany', 'Clear', '#00843D'], ['Buyer · Chile', 'Clear', '#00843D'], ['Buyer · UAE', 'Review', '#8A5D00'], ['Buyer · Italy', 'Clear', '#00843D']].forEach(([n, st, c], i) => { const y = 170 + i * 44; sv('line', { x1: 84, x2: 556, y1: y + 22, y2: y + 22, stroke: '#E2E2DD' }, s); T(88, y + 6, n, { 'font-weight': 600 }); sv('rect', { x: 470, y: y - 10, width: 84, height: 24, rx: 12, fill: c, opacity: 0.12 }, s); T(512, y + 7, st, { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: c }); });
  } else if (kind === 'rx') {
    const bx = (y, k, txt, hi) => { sv('rect', { x: 120, y, width: 400, height: 84, rx: 4, fill: '#fff', stroke: hi ? '#00843D' : '#C9C9C3', 'stroke-width': hi ? 2 : 1 }, s); T(146, y + 30, k, { 'font-size': 12, fill: '#5E5F5B' }); T(146, y + 60, txt, { 'font-size': 18, 'font-weight': 600 }); };
    bx(36, '1  Snap', '必理痛 Panadol   +   Paracetamol 500 mg'); bx(144, '2  Match', 'Same active ingredient: paracetamol', true); bx(252, '3  Speak', '');
    for (let i = 0; i < 16; i++) { const hh = 8 + Math.abs(Math.sin(i * 1.7)) * 26; sv('rect', { x: 148 + i * 9, y: 312 - hh / 2, width: 5, height: hh, rx: 2, fill: '#00843D' }, s); }
    T(310, 318, '粵語 Cantonese', { 'font-size': 16, 'font-weight': 600 });
  } else if (kind === 'flow') {
    const steps = ['Plan', 'Line art', 'Review', 'Cover', 'Book details', 'Export'];
    steps.forEach((name, i) => {
      const col = i % 3; const row = Math.floor(i / 3); const x = 70 + col * 176; const y = 70 + row * 150;
      sv('rect', { x, y, width: 148, height: 104, rx: 4, fill: '#fff', stroke: i === 5 ? '#16171a' : '#C9C9C3', 'stroke-width': i === 5 ? 2 : 1 }, s);
      T(x + 16, y + 36, String(i + 1), { 'font-size': 26, 'font-weight': 800, fill: '#B88600' }); T(x + 16, y + 78, name, { 'font-size': 17, 'font-weight': 700 });
      if (col < 2) sv('path', { d: `M${x + 154} ${y + 52}h16m-6-6l6 6-6 6`, fill: 'none', stroke: '#16171a', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s);
    });
    T(70, 358, 'KDP-ready interior PDF and A+ Content', { 'font-size': 14, fill: '#5E5F5B' });
  } else {
    const g = sv('g', { transform: 'translate(320 215)', fill: 'none', stroke: '#16171a', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, s);
    const iso = (x, y, z) => [(x - y) * 0.866, (x + y) * 0.5 - z];
    const P = (pts, a = {}) => sv('path', { d: `${pts.map((p, i) => { const q = iso(...p); return `${i ? 'L' : 'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`; }).join(' ')}Z`, ...a }, g);
    P([[-90, -60, 0], [90, -60, 0], [90, 60, 0], [-90, 60, 0]]); P([[-90, 60, 0], [90, 60, 0], [90, 60, 150], [-90, 60, 150]]); P([[90, -60, 0], [90, 60, 0], [90, 60, 150], [90, -60, 150]]); P([[-90, -60, 150], [90, -60, 150], [90, 60, 150], [-90, 60, 150]]);
    for (let f = 1; f < 5; f++) for (let w = 0; w < 6; w++) { const x0 = -78 + w * 28; const z0 = f * 30 - 20; P([[x0, 60, z0], [x0 + 16, 60, z0], [x0 + 16, 60, z0 + 16], [x0, 60, z0 + 16]], { stroke: '#D5281E', 'stroke-width': 1 }); }
  }
  return s;
}

/* ---------- pictures and video ---------- */
function media(m, { lead = false, reduce = false } = {}) {
  const f = h('figure', { class: `fig fig-${m.type}${lead ? ' fig-lead' : ''}` });
  if (m.type === 'img') f.append(h('img', { src: m.src, alt: m.alt || '', decoding: 'async', loading: lead ? 'eager' : 'lazy' }));
  else if (m.type === 'video') { const v = h('video', { src: m.src, poster: m.poster || '', playsinline: true, muted: true, loop: true, preload: 'metadata', 'aria-label': m.alt || '' }); v.muted = true; if (reduce) v.setAttribute('controls', ''); else { v.autoplay = true; v.play().catch(() => {}); } f.append(v); }
  else if (m.type === 'yt') {
    const b = h('button', { type: 'button', class: 'yt', 'aria-label': `Play ${m.alt || 'the video'} from YouTube` }); b.style.backgroundImage = `url("https://i.ytimg.com/vi/${m.id}/hqdefault.jpg")`; b.append(h('span', {}, icon(IC.play)));
    b.addEventListener('click', () => { b.replaceWith(h('iframe', { src: `https://www.youtube-nocookie.com/embed/${m.id}?autoplay=1&rel=0`, title: m.alt || 'YouTube video', allow: 'autoplay; encrypted-media; picture-in-picture', allowfullscreen: true })); }, { once: true });
    f.append(b);
  } else if (m.type === 'mock') f.append(mock(m.mock));
  else if (m.type === 'stickers') { const d = h('div', { class: 'stk' }); d.style.backgroundImage = `url("${m.room}")`; const spots = [['6%', '10%'], ['60%', '14%'], ['34%', '50%'], ['68%', '56%']]; (m.stickers || []).forEach((src, i) => { const im = h('img', { src, alt: '' }); im.style.left = spots[i % 4][0]; im.style.top = spots[i % 4][1]; im.style.animationDelay = `${0.25 + i * 0.16}s`; d.append(im); }); f.append(d); }
  else return null;
  if (m.alt) f.append(h('figcaption', { text: m.type === 'mock' ? `${m.alt.replace(/^Illustration:?\s*/i, '').replace(/^./, (c) => c.toUpperCase())} (illustration)` : m.alt }));
  return f;
}
function mediaList(p) {
  const list = []; const c = p.cover || {}; if (c.type && c.type !== 'none') list.push(c);
  (p.media || []).forEach((m) => { if (list.some((x) => (x.src && x.src === m.src) || (x.type === 'mock' && m.type === 'mock') || (x.id && x.id === m.id))) return; list.push(m); });
  return list;
}

const kicker = (color, ...parts) => h('p', { class: 'kicker' }, h('i', { class: 'dot', style: `background:${color}` }), parts.filter(Boolean).join(' · '));
const linkBtn = (l, ink) => h('a', { class: `btn${ink ? ' btn-ink' : ''}`, href: l.href, target: '_blank', rel: 'noopener' }, h('span', { text: l.label }), icon(IC.out));

/* ---------- a project ---------- */
export function projectPage(stop, { stops, reduce, go }) {
  const p = stop.project || {}; const d = DIST[stop.district] || { label: '', color: '#16171A' };
  const art = h('div', { class: 'art', style: `--c:${d.color}` });
  const meta = h('dl', { class: 'meta' });
  const row = (k, v) => meta.append(h('div', {}, h('dt', { text: k }), h('dd', {}, v)));
  row('Building', stop.building);
  row('Level', h('span', { class: 'lvl-row' }, levelMeter(stop.level), levelText(stop.level)));
  if (p.role) row('Role', p.role); if (p.year) row('Year', p.year);
  art.append(h('header', { class: 'art-head' },
    h('div', { class: 'art-title' }, kicker(d.color, `${stop.code} ${stop.townName}`, d.label), h('h1', { id: 'page-title', text: p.title || stop.building }), p.one ? h('p', { class: 'one', text: p.one }) : null),
    meta));
  const list = mediaList(p); const lead = list[0] ? media(list[0], { lead: true, reduce }) : null; if (lead) art.append(lead);
  const body = h('div', { class: 'art-body' });
  if (p.intro) body.append(h('p', { class: 'intro', text: p.intro }));
  (p.sections || []).forEach((s) => body.append(h('section', { class: 'sec' }, h('h2', { text: s.h }), h('p', { text: s.p }))));
  if (!p.intro && !(p.sections || []).length) (p.body || []).forEach((t) => body.append(h('p', { class: 'intro', text: t })));
  art.append(body);
  if ((p.stats || []).length) art.append(h('ul', { class: 'stats' }, p.stats.map((s) => h('li', {}, h('b', { text: s.n }), h('span', { text: s.l })))));
  // the building on the island: its level, and the real numbers behind it
  const lv = h('section', { class: 'island', 'aria-label': 'This building on the island' });
  lv.append(h('h2', { text: 'On the island' }));
  const ladder = h('ol', { class: 'ladder' }); for (let n = 1; n <= 5; n++) ladder.append(h('li', { class: n === stop.level ? 'is-now' : n < stop.level ? 'is-done' : '', 'aria-current': n === stop.level ? 'step' : null }, h('b', { text: String(n) }), h('span', { text: LEVELS[n].name })));
  const say = h('div', { class: 'island-say' }, h('p', {}, h('b', { text: `${stop.building}. ${levelText(stop.level)}.` }), ` ${LEVELS[stop.level].what}`));
  const num = NUMBERS[stop.id];
  if (num) { const parts = Object.keys(num).filter((k) => typeof num[k] === 'number').map((k) => `${fmt(num[k])} ${k}`); say.append(h('p', { class: 'muted', text: `${parts.join(' · ')}. Read on ${dateOf(num.asOf)} from the ${num.source}.` })); }
  if (stop.level === 4) say.append(h('p', { class: 'muted', text: `Level 5 takes one real number: ${orList(Object.entries(THRIVING).map(([k, v]) => `${fmt(v)} ${k}`))}.` }));
  lv.append(ladder, say); art.append(lv);
  if (list.length > 1) art.append(h('div', { class: 'gallery' }, list.slice(1).map((m) => media(m, { reduce })).filter(Boolean)));
  if ((p.links || []).length) art.append(h('p', { class: 'links' }, p.links.map((l, i) => linkBtn(l, i === 0))));
  const next = stops[stop.i + 1];
  art.append(h('footer', { class: 'art-foot' }, next
    ? footBtn(next.town === stop.town ? `Next in ${stop.townName}` : `Next station · ${next.code} ${next.townName}`, next.title, () => go(next.id), next.color)
    : footBtn('Round the loop again', stops[0].title, () => go(stops[0].id), stops[0].color)));
  return art;
}
function footBtn(k, name, fn, color) { const b = h('button', { type: 'button', class: 'foot-btn', style: `--c:${color || '#16171A'}` }, h('span', { class: 'foot-k', text: k }), h('b', { text: name }), icon(IC.go)); b.addEventListener('click', fn); return b; }

/* ---------- the tower: about Kevin ---------- */
export function towerPage({ KY, go, next }) {
  const P = KY.person; const R = KY.resume; const C = KY.contact; const first = P.name.split(' ')[0];
  const art = h('div', { class: 'art art-tower', style: '--c:#D5281E' });
  const meta = h('dl', { class: 'meta' });
  [['Started', P.since], ['Where', P.places], ['Languages', P.languages]].forEach(([k, v]) => { if (v) meta.append(h('div', {}, h('dt', { text: k }), h('dd', { text: v }))); });
  art.append(h('header', { class: 'art-head' },
    h('div', { class: 'art-title' }, kicker('#D5281E', `${first}’s tower`, 'Up the hill tram'), h('h1', { id: 'page-title', text: P.name }), (P.alt || []).length ? h('p', { class: 'alt', text: P.alt.join(' · ') }) : null, h('p', { class: 'one', text: P.line })),
    meta));
  const body = h('div', { class: 'art-body' }); body.append(h('p', { class: 'intro', text: P.short }));
  // contact first: the one thing a visitor came up here to do
  const asks = (C.asks || []).length ? h('ul', { class: 'asks' }, C.asks.map((a) => h('li', { text: a }))) : null;
  const acts = h('p', { class: 'links' });
  if (C.linkedin) acts.append(linkBtn({ label: 'LinkedIn', href: C.linkedin }, true));
  if (C.phone) acts.append(h('a', { class: 'btn', href: C.phoneHref }, icon(IC.phone), h('span', { text: C.phone })));
  acts.append(h('a', { class: 'btn', href: '../shared/kevin-yu.vcf', download: true }, icon(IC.card), h('span', { text: 'Save contact' })));
  const contact = h('section', { class: 'sec sec-contact' }, h('h2', { text: 'Get in touch' }), h('div', {}, asks ? h('p', { class: 'muted', text: 'Open to' }) : null, asks, acts,
    C.wechatQr ? h('figure', { class: 'qr' }, h('img', { src: C.wechatQr, alt: 'WeChat QR code', loading: 'lazy', width: 120, height: 120 }), h('figcaption', { text: 'WeChat: scan to add me' })) : null));
  body.append(contact);
  const rows = (list) => h('ul', { class: 'cv' }, list.map((e) => h('li', {}, h('span', { class: 'cv-when', text: e.when }), h('div', {}, h('b', { text: e.role ? `${e.role}${e.org ? `, ${e.org}` : ''}` : e.org }), e.note ? h('p', { text: e.note }) : null))));
  body.append(h('section', { class: 'sec' }, h('h2', { text: 'Experience' }), rows(R.experience)));
  body.append(h('section', { class: 'sec' }, h('h2', { text: 'Education' }), rows(R.education)));
  body.append(h('section', { class: 'sec' }, h('h2', { text: 'Skills' }), h('ul', { class: 'cv' }, R.skills.map(([k, v]) => h('li', {}, h('span', { class: 'cv-when', text: k }), h('div', {}, h('p', { text: v })))))));
  art.append(body);
  if (KY.newsletter && KY.newsletter.index) art.append(h('p', { class: 'links' }, h('a', { class: 'btn', href: KY.newsletter.index }, h('span', { text: 'Read the Daily AI newsletter' }), icon(IC.go))));
  if (next) art.append(h('footer', { class: 'art-foot' }, footBtn(`Back down the hill · ${next.code} ${next.townName}`, next.title, () => go(next.id), next.color)));
  return art;
}
