/* Kevin Metro · the project buildings
   Every station has a building next to it that shows the work. The buildings are models from
   models/landmarks.glb (see models.js); this file decides where each one stands and what its screens show:
   real screens, covers and posters from ../../assets/work. Every photo in the city shares one texture
   (one draw call); signs share the sign atlas. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { PLACES, PLOTS, stationIdOf } from './city-data.js';

const yAx = new THREE.Vector3(0, 1, 0);
const W_ = '../../assets/work/';

export function sign(text, opts = {}) {
  const w = opts.w || 1024; const h = opts.h || 256;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = opts.bg || '#16171a'; g.fillRect(0, 0, w, h);
  if (opts.bar) { g.fillStyle = opts.bar; g.fillRect(0, h - h * 0.14, w, h * 0.14); }
  g.fillStyle = opts.fg || '#ffffff';
  g.font = `${opts.weight || 800} ${opts.size || Math.round(h * 0.42)}px ${opts.font || '"Public Sans", Arial, sans-serif'}`;
  g.textAlign = opts.align || 'center'; g.textBaseline = 'middle';
  if (opts.glow) { g.shadowColor = opts.glow; g.shadowBlur = 28; }
  const lines = String(text).split('\n');
  lines.forEach((ln, i) => g.fillText(ln, opts.align === 'left' ? w * 0.06 : w / 2, h / 2 + (i - (lines.length - 1) / 2) * (opts.lh || h * 0.42)));
  return c;
}
export const canvasTex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

/* Every sign in the city on one texture: two meshes (plain and glowing) instead of one per sign. */
export class SignAtlas {
  constructor() { this.items = []; }
  add(canvas, w, h, x, y, z, yaw, opts = {}) { this.items.push({ canvas, w, h, m: opts.matrix || new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(yAx, yaw), new THREE.Vector3(1, 1, 1)), glow: opts.emissive || 0 }); }
  build(scene) {
    const S = 0.5; const W = 2048; let x = 0; let y = 0; let rowH = 0;
    const rects = this.items.map((it) => {
      const cw = Math.ceil(it.canvas.width * S); const ch = Math.ceil(it.canvas.height * S);
      if (x + cw > W) { x = 0; y += rowH + 2; rowH = 0; }
      const r = { x, y, w: cw, h: ch }; x += cw + 2; rowH = Math.max(rowH, ch); return r;
    });
    const H = y + rowH;
    const atlas = document.createElement('canvas'); atlas.width = W; atlas.height = H; const g = atlas.getContext('2d');
    this.items.forEach((it, i) => { const r = rects[i]; g.drawImage(it.canvas, r.x, r.y, r.w, r.h); });
    const tex = canvasTex(atlas);
    const plain = []; const glow = [];
    this.items.forEach((it, i) => {
      const r = rects[i]; const geo = new THREE.PlaneGeometry(it.w, it.h); const uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, (r.x + uv.getX(k) * r.w) / W, 1 - (r.y + (1 - uv.getY(k)) * r.h) / H);
      geo.applyMatrix4(it.m); (it.glow ? glow : plain).push(geo);
    });
    const mk = (list, mat) => { if (!list.length) return; const m = new THREE.Mesh(mergeGeometries(list, false), mat); scene.add(m); };
    mk(plain, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
    mk(glow, new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.2, roughness: 0.6 }));
  }
}

/* Every photo and screen in the city on one canvas. Each slot has the shape of the screen it is shown on
   (the `<name>_screen` quads in models/landmarks.glb), so nothing is stretched. Images stream in and redraw
   their slot. To add one: add a slot here, draw it in draws(), and name it in a place's `screens` (city-data.js). */
const SLOTS = {
  court: [0, 0, 264, 512], star: [264, 0, 364, 512], ariana: [628, 0, 266, 512], ipad: [894, 0, 844, 512],
  yae: [0, 512, 1024, 452], stickerScene: [1024, 512, 768, 402],
  party: [0, 964, 768, 448], rx: [768, 964, 640, 405], beads: [1408, 964, 512, 304],
  risk: [0, 1412, 960, 408], kname: [960, 1412, 720, 400],
  ksay: [0, 1820, 720, 400], uhome: [720, 1820, 768, 288], hack: [1488, 1820, 544, 300],
  resume: [0, 2220, 624, 300], news: [624, 2220, 300, 338], nonstop: [924, 2220, 552, 300], plot: [1476, 2220, 520, 200],
};
const AH = 2560; const SANS = '"Public Sans", Arial, sans-serif'; const HAN = '"PingFang SC", "Public Sans", sans-serif';
export class PhotoAtlas {
  constructor() {
    this.c = document.createElement('canvas'); this.c.width = 2048; this.c.height = AH;
    this.g = this.c.getContext('2d'); this.g.fillStyle = '#2a2d33'; this.g.fillRect(0, 0, 2048, AH);
    this.tex = canvasTex(this.c);
    this.photos(); this.boards();
    // the drawn boards use the page's typeface: draw them again once it has loaded
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.boards());
  }
  rect(key) { return SLOTS[key]; }
  // an image filling its slot (or, with `contain`, sitting whole inside part of it)
  cover(key, src, opts = {}) {
    const [sx, sy, sw, sh] = SLOTS[key]; const im = new Image(); im.decoding = 'async';
    im.onload = () => {
      const [fx, fy, fw, fh] = opts.box || [0, 0, 1, 1]; const x = sx + fx * sw; const y = sy + fy * sh; const w = fw * sw; const h = fh * sh;
      const g = this.g; g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
      if (opts.bg) { g.fillStyle = opts.bg; g.fillRect(x, y, w, h); }
      const s = opts.contain ? Math.min(w / im.width, h / im.height) * (opts.scale || 1) : Math.max(w / im.width, h / im.height);
      const dw = im.width * s; const dh = im.height * s;
      g.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2 + (opts.dy || 0) * h, dw, dh);
      g.restore(); this.tex.needsUpdate = true;
    };
    im.src = src;
  }
  photos() {
    this.cover('court', `${W_}court-booking.webp`, { bg: '#ffffff', dy: 0.1 }); this.cover('star', `${W_}book-star-cover.webp`); this.cover('ariana', '../../assets/media/influencer-classic.jpg');
    this.cover('ipad', `${W_}ipad-coloring.webp`); this.cover('yae', `${W_}yae-banner.webp`);
    // the party game: two phone screens side by side
    this.cover('party', `${W_}party-intro.webp`, { box: [0.04, 0.04, 0.44, 0.92], contain: true }); this.cover('party', `${W_}party-friends.webp`, { box: [0.52, 0.04, 0.44, 0.92], contain: true });
    // the sticker game: the empty room, and stickers landing in it
    this.cover('stickerScene', `${W_}sticker-room.webp`, { box: [0, 0, 0.56, 1], bg: '#f6eee3' });
    [['sunflower', 0.58, 0.06, 0.1, 0.88], ['duck', 0.69, 0.1, 0.14, 0.36], ['dog', 0.7, 0.52, 0.13, 0.42], ['boat', 0.85, 0.2, 0.13, 0.6]].forEach(([n, x, y, w, h]) => this.cover('stickerScene', `${W_}sticker-${n}.webp`, { box: [x, y, w, h], contain: true }));
  }
  boards() {
    const g = this.g;
    const at = (key, fn) => { const [x, y, w, h] = SLOTS[key]; g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, w, h); g.clip(); g.textBaseline = 'middle'; g.textAlign = 'left'; fn(w, h); g.restore(); };
    const board = (key, bg, fg, title, sub, accent) => at(key, (w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      let size = Math.round(h * 0.3); g.font = `800 ${size}px ${SANS}`; const tw = g.measureText(title).width; if (tw > w * 0.86) { size = Math.floor((size * w * 0.86) / tw); g.font = `800 ${size}px ${SANS}`; }
      g.textAlign = 'center'; g.fillStyle = fg; g.fillText(title, w / 2, h * (sub ? 0.4 : 0.5));
      if (sub) { let s2 = Math.round(h * 0.12); g.font = `600 ${s2}px ${SANS}`; const sw = g.measureText(sub).width; if (sw > w * 0.88) { s2 = Math.floor((s2 * w * 0.88) / sw); g.font = `600 ${s2}px ${SANS}`; } g.globalAlpha = 0.82; g.fillText(sub, w / 2, h * 0.7); g.globalAlpha = 1; }
      if (accent) { g.fillStyle = accent; g.fillRect(0, h - Math.round(h * 0.06), w, Math.round(h * 0.06)); }
    });
    board('kname', '#0039a6', '#ffffff', 'Kevin Yu', 'Kevin Square', '#f2b705');
    at('ksay', (w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#16171a'; g.font = `800 ${Math.round(h * 0.24)}px ${SANS}`; g.textAlign = 'center'; g.fillText('Kevin Metro', w / 2, h * 0.36);
      ['#5b5c58', '#da291c', '#f2b705', '#0039a6', '#8e3b9c', '#00933c'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(w / 2 + (i - 2.5) * h * 0.2, h * 0.7, h * 0.075, 0, Math.PI * 2); g.fill(); });
    });
    board('hack', '#00933c', '#ffffff', 'Hackathons', '3 hackathons, entered solo');
    board('resume', '#f4f3ef', '#16171a', 'Résumé', 'Résumé and education', '#9b5b47');
    board('news', '#16171a', '#ffffff', 'Daily AI', 'Newsletter', '#da291c');
    board('nonstop', '#16171a', '#f2b705', 'Non-stop', 'Still searching. Get in touch');
    board('plot', '#f2b705', '#16171a', 'Next project', 'Under construction: still searching');
    // 對藥: snap, match, speak
    at('rx', (w, h) => {
      g.fillStyle = '#f4f7f5'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#00933c'; g.fillRect(0, 0, w, 66); g.fillStyle = '#fff'; g.font = `800 38px ${HAN}`; g.fillText('對藥  Medication check', 24, 34);
      [['1  Snap', '必理痛 Panadol', 0], ['2  Match', '= Paracetamol 500 mg', 1], ['3  Speak', '粵語 Cantonese', 0]].forEach(([a, b, hi], i) => {
        const y = 84 + i * 104; g.fillStyle = '#fff'; g.strokeStyle = hi ? '#0039a6' : '#c9c9c3'; g.lineWidth = hi ? 5 : 2; g.beginPath(); g.roundRect(24, y, w - 48, 90, 14); g.fill(); g.stroke();
        g.fillStyle = '#5b5c58'; g.font = `600 22px ${SANS}`; g.fillText(a, 46, y + 26); g.fillStyle = '#16171a'; g.font = `700 30px ${HAN}`; g.fillText(b, 46, y + 60);
      });
    });
    // the export tool: a risk watch list with placeholder buyers (no client names)
    at('risk', (w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#16171a'; g.fillRect(0, 0, w, 60); g.fillStyle = '#fff'; g.font = `700 30px ${SANS}`; g.fillText('Buyer risk watch', 24, 31);
      [['32,592', 'entries checked'], ['4 lists', 'checked daily']].forEach(([n, l], i) => { const y = 80 + i * 158; g.fillStyle = '#f1f1ec'; g.fillRect(24, y, 250, 140); g.fillStyle = '#16171a'; g.font = `800 48px ${SANS}`; g.fillText(n, 44, y + 56); g.fillStyle = '#5b5c58'; g.font = `600 22px ${SANS}`; g.fillText(l, 44, y + 106); });
      [['Buyer · Germany', 'Clear', '#00933c'], ['Buyer · Chile', 'Clear', '#00933c'], ['Buyer · UAE', 'Review', '#9a6a00'], ['Buyer · Italy', 'Clear', '#00933c'], ['Buyer · Japan', 'Clear', '#00933c']].forEach(([n, s, c], i) => {
        const y = 112 + i * 60; g.fillStyle = '#e2e2dd'; g.fillRect(310, y + 30, w - 334, 2);
        g.fillStyle = '#16171a'; g.font = `600 28px ${SANS}`; g.fillText(n, 316, y);
        g.fillStyle = c; g.globalAlpha = 0.14; g.beginPath(); g.roundRect(w - 164, y - 20, 140, 40, 20); g.fill(); g.globalAlpha = 1; g.font = `700 22px ${SANS}`; g.textAlign = 'center'; g.fillText(s, w - 94, y); g.textAlign = 'left';
      });
    });
    // UHOME: a quiet line drawing of an apartment block beside the name
    at('uhome', (w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.strokeStyle = '#0039a6'; g.lineWidth = 3;
      for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) g.strokeRect(54 + i * 40, 50 + j * 50, 26, 32);
      g.strokeStyle = '#16171a'; g.strokeRect(34, 30, 262, 228); g.fillStyle = '#0039a6'; g.font = `800 96px ${SANS}`; g.fillText('UHOME', 340, h / 2);
    });
    // 拼豆: a bead board
    at('beads', (w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      const pal = ['#da291c', '#f2b705', '#0039a6', '#00933c', '#8e3b9c', '#ff8fb1', '#16171a'];
      const heart = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];
      for (let y = 0; y < 13; y++) for (let x = 0; x < 22; x++) {
        const hx = x - 2; const hy = y - 3; const on = hx >= 0 && hx < 7 && hy >= 0 && hy < 6 && heart[hy][hx] === '1';
        if (x > 11 && y > 3 && y < 9) continue;
        g.fillStyle = on ? '#da291c' : pal[(x * 3 + y * 5) % pal.length]; g.globalAlpha = on ? 1 : 0.35;
        g.beginPath(); g.arc(18 + x * 22.6, 16 + y * 22.6, 8.5, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(18 + x * 22.6, 16 + y * 22.6, 3, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#16171a'; g.font = `800 84px ${HAN}`; g.fillText('拼豆', 300, 152);
    });
    this.tex.needsUpdate = true;
  }
}

/* Screens that change by themselves: Hirvo's tall screen cycles the real product screens, in their own colours;
   the jazz club's plays the Noir Hours loop when you come close. Both stop when they are off screen. */
export function liveScreen(kind) {
  if (kind === 'noir-video') {
    const poster = new THREE.TextureLoader().load(`${W_}noir-loop-poster.jpg`); poster.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: poster, toneMapped: false }); let video = null; let vtex = null;
    return { material, near: true, update: (tt, dt, visible, near) => {
      const want = visible && near;
      if (want && !video) { video = document.createElement('video'); video.src = `${W_}noir-loop.mp4`; video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto'; vtex = new THREE.VideoTexture(video); vtex.colorSpace = THREE.SRGBColorSpace; }
      if (!video) return;
      if (want && video.paused) { video.play().then(() => { material.map = vtex; material.needsUpdate = true; }).catch(() => {}); }
      if (!want && !video.paused) { video.pause(); material.map = poster; material.needsUpdate = true; }
    } };
  }
  const names = ['hirvo-builder', 'hirvo-visa', 'hirvo-dashboard']; const ims = names.map(() => null); const CW = 512; const CH = 1024;
  const texs = names.map((_, k) => { const c = document.createElement('canvas'); c.width = CW; c.height = CH; const tx = canvasTex(c); tx.userData = { c, k }; return tx; });
  const paint = (tx) => {
    const { c, k } = tx.userData; const g = c.getContext('2d');
    g.fillStyle = '#0e1116'; g.fillRect(0, 0, CW, CH); g.fillStyle = '#da291c'; g.fillRect(0, 0, CW, 10);
    g.fillStyle = '#ffffff'; g.font = `800 46px ${SANS}`; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText('Hirvo', 26, 54);
    g.fillStyle = '#b9bcc4'; g.font = `600 22px ${SANS}`; g.textAlign = 'right'; g.fillText('AI career platform', CW - 26, 56);
    for (let i = 0; i < 3; i++) { const im = ims[(k + i) % 3]; const y = 100 + i * 306; if (im) g.drawImage(im, 43, y, 426, 296); else { g.fillStyle = '#1b2029'; g.fillRect(43, y, 426, 296); } }
    tx.needsUpdate = true;
  };
  texs.forEach(paint);
  names.forEach((n, i) => { const im = new Image(); im.onload = () => { ims[i] = im; texs.forEach(paint); }; im.src = `${W_}${n}.webp`; });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => texs.forEach(paint));
  const material = new THREE.MeshBasicMaterial({ map: texs[0], toneMapped: false }); let k = 0; let next = 4.5; let flick = 0;
  return { material, update: (tt, dt, visible) => { if (flick > 0) { flick = Math.max(0, flick - dt * 3); material.color.setScalar(1 - Math.sin(flick * Math.PI) * 0.5); } if (!visible) return; next -= dt; if (next <= 0) { k = (k + 1) % texs.length; material.map = texs[k]; flick = 1; next = 4.5; } } };
}
export const PHOTO_SLOTS = SLOTS; export const PHOTO_H = AH;

// the buildings come from the registry (city-data.js): one landmark per place, plus the empty plots
export const LANDMARKS = [
  ...PLACES.map((p) => ({ id: p.id, station: stationIdOf(p), model: p.model, screenKeys: p.screens || [], annex: p.annex || null, rect: p.plot.rect || null, x: p.plot.x, z: p.plot.z, toLine: p.plot.face, view: p.plot.view || null, tint: p.tint })),
  ...PLOTS.map((p) => ({ id: p.id, model: p.model, screenKeys: ['plot'], annex: null, rect: null, x: p.plot.x, z: p.plot.z, toLine: p.plot.face, empty: true })),
];

/* Stand a landmark's model (and its annex, if it has one) on its block, front towards its station.
   `defs` are the manifest entries. A model is shrunk only if it would not fit the block. */
export function buildLandmark(lm, b, defs) {
  const f = new THREE.Vector3(lm.toLine[0], 0, lm.toLine[1]); const r = new THREE.Vector3(f.z, 0, -f.x);
  const W = Math.abs(r.x) * (b.x1 - b.x0) + Math.abs(r.z) * (b.z1 - b.z0); // along the street
  const D = Math.abs(f.x) * (b.x1 - b.x0) + Math.abs(f.z) * (b.z1 - b.z0); // toward the line
  const yaw = Math.atan2(f.x, f.z); const gap = 4;
  const total = defs.reduce((a, m) => a + m.w, 0) + gap * (defs.length - 1); const deep = Math.max(...defs.map((m) => m.d)); const tall = Math.max(...defs.map((m) => m.h));
  const fit = Math.min(1, (W + 2) / total, (D + 2) / deep);
  let u = (-total * fit) / 2;
  lm.places = defs.map((m, i) => { const uc = u + (m.w * fit) / 2; u += (m.w + gap) * fit; return { x: b.cx + r.x * uc, z: b.cz + r.z * uc, yaw, scale: fit, name: m.name, keys: i === 0 ? lm.screenKeys : (lm.annex && lm.annex.screens) || [] }; });
  const H = Math.max(8, tall * fit); const swap = Math.abs(f.x) > 0.5; const hw = total * fit; const hd = deep * fit;
  lm.height = H; lm.focus = new THREE.Vector3(b.cx, Math.min(H * 0.42, 150), b.cz); lm.focusF = H > 130 ? Math.min(520, H * 1.2) : 0;
  lm.hit = { center: new THREE.Vector3(b.cx, H / 2, b.cz), size: swap ? new THREE.Vector3(hd, H, hw) : new THREE.Vector3(hw, H, hd) };
}
