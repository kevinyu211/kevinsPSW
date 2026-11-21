/* Kevin Metro · the project buildings
   Every station has a building next to it that shows the work: real screens, covers and posters from
   ../../assets/work on its walls. Each building is drawn in a local frame whose front (+v) faces the line,
   so the arrival view always looks straight at it. Static parts go into the shared batch; every photo in
   the city shares one texture (one draw call); signs share the sign atlas. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

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

/* Every photo and screen in the city on one 2048² canvas. Images stream in and redraw their slot. */
const SLOTS = {
  star: [0, 0, 512, 512], crew: [512, 0, 512, 512], hat: [1024, 0, 512, 512], stickerScene: [1536, 0, 512, 512],
  yae: [0, 512, 910, 512], noir: [910, 512, 910, 512], court: [1820, 512, 228, 494],
  ipad: [0, 1024, 736, 512], party: [736, 1024, 288, 512], rx: [1024, 1024, 512, 512], risk: [1536, 1024, 512, 512],
  courtFloor: [0, 1536, 1024, 512], duck: [1024, 1536, 256, 256], dog: [1280, 1536, 256, 256], sunflower: [1536, 1536, 256, 256], boat: [1792, 1536, 256, 256],
  uhome: [1024, 1792, 512, 256], beads: [1536, 1792, 512, 256],
};
export class PhotoAtlas {
  constructor() {
    this.items = [];
    this.c = document.createElement('canvas'); this.c.width = 2048; this.c.height = 2048;
    this.g = this.c.getContext('2d'); this.g.fillStyle = '#2a2d33'; this.g.fillRect(0, 0, 2048, 2048);
    this.tex = canvasTex(this.c);
    this.draws();
  }
  rect(key) { return SLOTS[key]; }
  cover(key, src, opts = {}) {
    const [x, y, w, h] = SLOTS[key]; const im = new Image(); im.decoding = 'async';
    im.onload = () => {
      const g = this.g; g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
      g.fillStyle = opts.bg || '#1d1f23'; g.fillRect(x, y, w, h);
      const s = opts.contain ? Math.min(w / im.width, h / im.height) * (opts.scale || 1) : Math.max(w / im.width, h / im.height);
      const dw = im.width * s; const dh = im.height * s;
      g.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2 + (opts.dy || 0) * h, dw, dh);
      g.restore(); if (opts.after) opts.after(g, x, y, w, h);
      this.tex.needsUpdate = true;
    };
    im.src = src;
  }
  draws() {
    const g = this.g; const at = (key, fn) => { const [x, y, w, h] = SLOTS[key]; g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, w, h); g.clip(); fn(w, h); g.restore(); };
    this.cover('star', `${W_}book-star-cover.webp`); this.cover('crew', `${W_}book-crew.webp`); this.cover('hat', `${W_}book-hatshop.webp`);
    this.cover('yae', `${W_}yae-banner.webp`); this.cover('noir', `${W_}noir-skyline.webp`);
    this.cover('court', `${W_}court-booking.webp`); this.cover('ipad', `${W_}ipad-coloring.webp`); this.cover('party', `${W_}party-friends.webp`);
    // the sticker game: an empty room with stickers landing in it
    this.cover('stickerScene', `${W_}sticker-room.webp`, { bg: '#f6eee3', after: () => {
      const spots = [['sunflower', 0.06, 0.1], ['duck', 0.58, 0.16], ['dog', 0.32, 0.5], ['boat', 0.64, 0.56]];
      spots.forEach(([n, fx, fy]) => { const im = new Image(); im.onload = () => { const [x, y] = SLOTS.stickerScene; const w = 130; const h = (im.height / im.width) * w; this.g.drawImage(im, x + fx * 512, y + fy * 512, w, h); this.tex.needsUpdate = true; }; im.src = `${W_}sticker-${n}.webp`; });
    } });
    [['duck', '#ffe9a8'], ['dog', '#cfe6ff'], ['sunflower', '#d9f2c7'], ['boat', '#ffd1dc']].forEach(([n, bg]) => this.cover(n, `${W_}sticker-${n}.webp`, { contain: true, bg, scale: 0.8 }));
    // 對藥: the matching card, drawn
    at('rx', (w, h) => {
      g.fillStyle = '#f4f7f5'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#00933c'; g.fillRect(0, 0, w, 70); g.fillStyle = '#fff'; g.font = '800 40px "PingFang SC", "Public Sans", sans-serif'; g.textBaseline = 'middle'; g.fillText('對藥  Medication check', 24, 36);
      const card = (y, a, b, hi) => { g.fillStyle = '#fff'; g.strokeStyle = hi ? '#0039a6' : '#c9c9c3'; g.lineWidth = hi ? 5 : 2; g.beginPath(); g.roundRect(24, y, w - 48, 104, 14); g.fill(); g.stroke(); g.fillStyle = '#5b5c58'; g.font = '600 22px "Public Sans", sans-serif'; g.fillText(a, 46, y + 30); g.fillStyle = '#16171a'; g.font = '700 30px "PingFang SC", "Public Sans", sans-serif'; g.fillText(b, 46, y + 70); };
      card(96, '1  Snap', '必理痛 Panadol'); card(214, '2  Match', '= Paracetamol 500 mg', true); card(332, '3  Speak', '粵語 Cantonese');
      for (let i = 0; i < 18; i++) { const hh = 10 + Math.abs(Math.sin(i * 1.7)) * 30; g.fillStyle = '#0039a6'; g.fillRect(250 + i * 12, 404 - hh / 2, 7, hh); }
      g.fillStyle = '#00933c'; g.beginPath(); g.arc(w - 60, 266, 22, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.moveTo(w - 71, 266); g.lineTo(w - 62, 276); g.lineTo(w - 47, 256); g.stroke();
    });
    // the export tool: a risk watch list with placeholder buyers (no client names)
    at('risk', (w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#16171a'; g.fillRect(0, 0, w, 64); g.fillStyle = '#fff'; g.font = '700 30px "Public Sans", sans-serif'; g.textBaseline = 'middle'; g.fillText('Buyer risk watch', 24, 33);
      g.fillStyle = '#f1f1ec'; g.fillRect(24, 84, 220, 96); g.fillRect(268, 84, 220, 96);
      g.fillStyle = '#16171a'; g.font = '800 38px "Public Sans", sans-serif'; g.fillText('32,592', 40, 122); g.fillText('4 lists', 284, 122);
      g.fillStyle = '#5b5c58'; g.font = '600 18px "Public Sans", sans-serif'; g.fillText('entries checked', 40, 158); g.fillText('checked daily', 284, 158);
      [['Buyer · Germany', 'Clear', '#00933c'], ['Buyer · Chile', 'Clear', '#00933c'], ['Buyer · UAE', 'Review', '#9a6a00'], ['Buyer · Italy', 'Clear', '#00933c'], ['Buyer · Japan', 'Clear', '#00933c']].forEach(([n, s, c], i) => {
        const y = 220 + i * 56; g.fillStyle = '#e2e2dd'; g.fillRect(24, y + 26, w - 48, 2);
        g.fillStyle = '#16171a'; g.font = '600 24px "Public Sans", sans-serif'; g.fillText(n, 30, y + 6);
        g.fillStyle = c; g.globalAlpha = 0.14; g.beginPath(); g.roundRect(w - 150, y - 12, 120, 36, 18); g.fill(); g.globalAlpha = 1; g.font = '700 20px "Public Sans", sans-serif'; g.textAlign = 'center'; g.fillText(s, w - 90, y + 6); g.textAlign = 'left';
      });
    });
    // a full-size basketball court, seen from above
    at('courtFloor', (w, h) => {
      g.fillStyle = '#c27c4e'; g.fillRect(0, 0, w, h); g.fillStyle = '#2f6b8f'; g.fillRect(0, 0, w, 24); g.fillRect(0, h - 24, w, 24); g.fillRect(0, 0, 24, h); g.fillRect(w - 24, 0, 24, h);
      g.strokeStyle = '#ffffff'; g.lineWidth = 7; g.strokeRect(24, 24, w - 48, h - 48);
      g.beginPath(); g.moveTo(w / 2, 24); g.lineTo(w / 2, h - 24); g.stroke(); g.beginPath(); g.arc(w / 2, h / 2, 58, 0, Math.PI * 2); g.stroke();
      [[24, 1], [w - 24, -1]].forEach(([x, sgn]) => { g.strokeRect(sgn > 0 ? x : x - 190, h / 2 - 90, 190, 180); g.beginPath(); g.arc(x, h / 2, 230, -Math.PI / 2, Math.PI / 2, sgn < 0); g.stroke(); });
    });
    // UHOME: a quiet line drawing of an apartment block
    at('uhome', (w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.strokeStyle = '#0039a6'; g.lineWidth = 3;
      for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) g.strokeRect(150 + i * 36, 50 + j * 50, 24, 30);
      g.strokeStyle = '#16171a'; g.strokeRect(130, 30, 236, 180); g.fillStyle = '#0039a6'; g.font = '800 44px "Public Sans", sans-serif'; g.textBaseline = 'middle'; g.fillText('UHOME', 20, 236 - 20);
    });
    // 拼豆: a bead board
    at('beads', (w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      const pal = ['#da291c', '#f2b705', '#0039a6', '#00933c', '#8e3b9c', '#ff8fb1', '#16171a'];
      const heart = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];
      for (let y = 0; y < 10; y++) for (let x = 0; x < 22; x++) {
        const hx = x - 2; const hy = y - 2; const on = hx >= 0 && hx < 7 && hy >= 0 && hy < 6 && heart[hy][hx] === '1';
        g.fillStyle = on ? '#da291c' : pal[(x * 3 + y * 5) % pal.length]; g.globalAlpha = on ? 1 : 0.35;
        g.beginPath(); g.arc(14 + x * 22.6, 18 + y * 22.6, 8.5, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(14 + x * 22.6, 18 + y * 22.6, 3, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#16171a'; g.font = '800 40px "PingFang SC", "Public Sans", sans-serif'; g.textBaseline = 'middle'; g.fillText('拼豆', 330, 120);
    });
    this.tex.needsUpdate = true;
  }
  add(key, w, h, matrix) { this.items.push({ key, w, h, m: matrix }); }
  build(scene) {
    const geos = this.items.map((it) => {
      const [x, y, w, h] = SLOTS[it.key]; const geo = new THREE.PlaneGeometry(it.w, it.h); const uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, (x + 2 + uv.getX(k) * (w - 4)) / 2048, 1 - (y + 2 + (1 - uv.getY(k)) * (h - 4)) / 2048);
      geo.applyMatrix4(it.m); return geo;
    });
    if (!geos.length) return null;
    const mesh = new THREE.Mesh(mergeGeometries(geos, false), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    scene.add(mesh); return mesh;
  }
}

/* Each project building sits in the block just outside its station. The camera looks from the south-east. */
export const LANDMARKS = [
  { id: 'campus', x: -325, z: -389, toLine: [0, 1], tint: 0x9b5b47, scale: 1.2 },
  { id: 'uhome', x: -455, z: -389, toLine: [0, 1], tint: 0xda291c, scale: 1.15 },
  { id: 'hirvo', x: 65, z: -389, toLine: [0, 1], tint: 0xda291c, scale: 1 },
  { id: 'news', x: -65, z: -389, toLine: [0, 1], tint: 0x16171a, scale: 1 },
  { id: 'clinic', x: 325, z: -389, toLine: [0, 1], tint: 0x00933c, scale: 1.15 },
  { id: 'port', x: 588, z: 136, toLine: [-1, 0], tint: 0xda291c, scale: 1 },
  { id: 'books', x: 325, z: 389, toLine: [0, -1], tint: 0xf2b705, scale: 1.6 },
  { id: 'studio', x: 195, z: 389, toLine: [0, -1], tint: 0xf2b705, scale: 1.5 },
  { id: 'cinema', x: -65, z: 389, toLine: [0, -1], tint: 0x0039a6, scale: 1.5 },
  { id: 'arcade', x: -325, z: 389, toLine: [0, -1], tint: 0x8e3b9c, scale: 1.5 },
  { id: 'courts', x: -588, z: 50, toLine: [1, 0], tint: 0xda291c, scale: 1.3 },
  { id: 'nonstop', x: -588, z: -165, toLine: [1, 0], tint: 0xf2b705, scale: 1.5 },
];

const OV = new THREE.Vector3(0.64, 0, 0.77).normalize(); // where the overview camera stands, seen from the ground

export function buildLandmark(lm, ctx) {
  const { b, batch, M, scene, addBuilding, addTree, anim, atlas, photos } = ctx;
  const screens = lm.screens = [];
  const mats = {}; const matte = (hex) => { if (!mats[hex]) { mats[hex] = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85, side: THREE.DoubleSide }); mats[hex].userData.matte = true; } return mats[hex]; };
  const f = new THREE.Vector3(lm.toLine[0], 0, lm.toLine[1]); const r = new THREE.Vector3(f.z, 0, -f.x);
  const cx = b.cx; const cz = b.cz;
  const S = lm.scale || 1; // landmarks are drawn larger than life so they read as the city's landmarks
  let W = Math.abs(r.x) * (b.x1 - b.x0) + Math.abs(r.z) * (b.z1 - b.z0); // along the street
  let D = Math.abs(f.x) * (b.x1 - b.x0) + Math.abs(f.z) * (b.z1 - b.z0); // toward the line
  const yawF = Math.atan2(f.x, f.z);
  const FACE = { front: 0, back: Math.PI, right: Math.PI / 2, left: -Math.PI / 2 };
  const NORM = { front: f, back: f.clone().negate(), right: r, left: r.clone().negate() };
  const ovFace = Object.keys(NORM).reduce((a, k) => (NORM[k].dot(OV) > NORM[a].dot(OV) ? k : a), 'front');
  const P = (u, v) => new THREE.Vector3(cx + (r.x * u + f.x * v) * S, 0, cz + (r.z * u + f.z * v) * S);
  const M4 = (u, y, v, yaw = 0, rx = 0, rz = 0, sc = 1) => { const p = P(u, v); return new THREE.Matrix4().compose(new THREE.Vector3(p.x, y * S, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, yawF + yaw, rz, 'YXZ')), new THREE.Vector3(sc * S, sc * S, sc * S)); };
  const box = (w, h, d, mat, u, y, v, yaw = 0, o) => batch.add(new THREE.BoxGeometry(w, h, d), mat, M4(u, y, v, yaw), o);
  const geo = (g, mat, u, y, v, yaw = 0, rx = 0, o) => batch.add(g, mat, M4(u, y, v, yaw, rx), o);
  const swap = Math.abs(f.x) > 0.5;
  const bldg = (u, v, w, d, h, color, o = {}) => { const p = P(u, v); w *= S; d *= S; addBuilding({ x: p.x, z: p.z, w: swap ? d : w, d: swap ? w : d, h: h * S, y: o.y != null ? o.y * S : 0.16, landmark: 1, color, glassy: o.glassy ? 1 : 0, style: o.style || 0, noRoof: o.noRoof }); };
  // a plane flush on one face of a box centred at (u, v) with half sizes (hw along u, hd along v)
  const onFace = (face, u, v, hw, hd) => (face === 'front' ? [u, v + hd + 0.08] : face === 'back' ? [u, v - hd - 0.08] : face === 'right' ? [u + hw + 0.08, v] : [u - hw - 0.08, v]);
  const signAt = (canvas, w, h, u, y, v, face = 'front', o) => { atlas.add(canvas, w, h, 0, 0, 0, 0, { matrix: M4(u, y, v, FACE[face]), ...o }); };
  const photo = (key, w, h, u, y, v, face = 'front') => photos.add(key, w, h, M4(u, y, v, FACE[face]));
  const photoFlat = (key, w, h, u, y, v) => photos.add(key, w, h, M4(u, y, v, 0, -Math.PI / 2));
  W /= S; D /= S; // from here on, sizes are in the landmark's own (unscaled) units
  if (lm.tint) { const pc = new THREE.Color(0xd9d3c7).lerp(new THREE.Color(lm.tint), 0.3); box(W - 3 / S, 0.04 / S, D - 3 / S, matte(pc.getHex()), 0, 0.18 / S, 0, 0, { cast: false }); }
  lm.focus = new THREE.Vector3(cx, 0, cz); lm.hitH = 20; lm.hitW = W - 8; lm.hitD = D - 8;
  const front = D / 2;

  switch (lm.id) {
    case 'campus': {
      // the university: a brick hall with a clock tower, two wings, a green quad and a gate on the street
      box(W - 10, 0.12, D - 10, M.grass, 0, 0.22, 0, 0, { cast: false });
      box(6, 0.13, D - 10, M.sidewalk, 0, 0.24, 0, 0, { cast: false });
      bldg(0, -22, 60, 22, 16.2, 0xb46a52);
      bldg(-36, 6, 16, 32, 13, 0xc8b39a); bldg(36, 6, 16, 32, 13, 0xc8b39a);
      box(8, 32, 8, M.brick, 0, 16, -9);
      geo(new THREE.ConeGeometry(6.2, 7, 4), matte(0x3c4a5a), 0, 35.5, -9, Math.PI / 4);
      const clock = document.createElement('canvas'); clock.width = 256; clock.height = 256; const cg = clock.getContext('2d');
      cg.fillStyle = '#9b5b47'; cg.fillRect(0, 0, 256, 256); cg.fillStyle = '#f4efe4'; cg.beginPath(); cg.arc(128, 128, 110, 0, Math.PI * 2); cg.fill(); cg.strokeStyle = '#16171a'; cg.lineWidth = 10; cg.lineCap = 'round';
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; cg.beginPath(); cg.moveTo(128 + Math.sin(a) * 88, 128 - Math.cos(a) * 88); cg.lineTo(128 + Math.sin(a) * 100, 128 - Math.cos(a) * 100); cg.stroke(); }
      cg.beginPath(); cg.moveTo(128, 128); cg.lineTo(128, 60); cg.moveTo(128, 128); cg.lineTo(178, 150); cg.stroke();
      [...new Set(['front', ovFace])].forEach((fc) => { const [u, v] = onFace(fc, 0, -9, 4, 4); signAt(clock, 5.4, 5.4, u, 26, v, fc); });
      const gv = front - 3;
      box(2.4, 9, 2.4, M.brick, -7, 4.5, gv); box(2.4, 9, 2.4, M.brick, 7, 4.5, gv); box(17, 2, 2.6, M.brick, 0, 9.8, gv);
      signAt(sign('UNIVERSITY · 大学', { bg: '#7a3b2a', fg: '#f3e7d3', size: 100 }), 12.5, 1.5, 0, 9.8, gv + 1.35);
      for (let k = 0; k < 16; k++) addTree(...(() => { const p = P(-27 + (k % 4) * 18, -2 + Math.floor(k / 4) * 11); return [p.x, p.z]; })(), 1.05);
      lm.focus = P(0, 0).setY(10); lm.hitH = 36;
      break;
    }
    case 'uhome': {
      // UHOME student apartments: two mid-rise slabs round a courtyard, a rooftop sign
      bldg(0, -20, W - 22, 16, 22.4, 0xe6e1d7);
      bldg(16, 16, W - 52, 18, 19.2, 0xd6cbb8);
      box(W - 60, 0.12, 22, M.grass, -24, 0.22, 16, 0, { cast: false });
      signAt(sign('UHOME', { bg: '#ffffff', fg: '#0039a6', size: 150 }), 10, 2.6, 16, 15, 16 + 9.1);
      box(10.6, 5.6, 0.4, M.ink, 16, 22.5, 16 + 8.85, 0, { cast: false }); photo('uhome', 10, 5, 16, 22.5, 16 + 9.1);
      for (let k = 0; k < 6; k++) { const p = P(-40 + k * 6, front - 4); addTree(p.x, p.z, 0.9); }
      lm.focus = P(8, 0).setY(10); lm.hitH = 26;
      break;
    }
    case 'hirvo': {
      // Hirvo HQ: a glass tower on a stone podium; a giant screen on its face cycles the real product
      bldg(0, 0, W - 14, D - 14, 7.6, 0xd9d3c7);
      bldg(8, -6, 30, 26, 104, 0x9fb3c2, { glassy: true });
      box(30.6, 6, 26.6, M.ink, 8, 107, -6);
      const t = sign('HIRVO', { bg: '#16171a', fg: '#ffffff', size: 150, bar: '#da291c' });
      signAt(t, 16, 4, 8, 107, -6 + 13.4); signAt(t, 16, 4, 8 + 15.4, 107, -6, 'right');
      // the screen: a black frame, the image on top; it changes every few seconds when you can see it
      box(28.4, 20.6, 0.8, M.ink, 8, 62, 7.4, 0, { cast: false });
      // the real screens are dark interfaces: shown here in light mode (inverted, hues kept) so they read from the street, in a light bezel
      const mkScreen = (url) => {
        const c = document.createElement('canvas'); c.width = 1024; c.height = 740; const g = c.getContext('2d');
        g.fillStyle = '#f4f3ef'; g.fillRect(0, 0, 1024, 740); g.fillStyle = '#da291c'; g.fillRect(0, 0, 1024, 12);
        g.fillStyle = '#16171a'; g.font = '800 40px "Public Sans", Arial, sans-serif'; g.textBaseline = 'middle'; g.fillText('Hirvo', 30, 44);
        g.fillStyle = '#5b5c58'; g.font = '600 26px "Public Sans", Arial, sans-serif'; g.textAlign = 'right'; g.fillText('AI career platform · live', 994, 44);
        const tx = canvasTex(c); const im = new Image();
        im.onload = () => { g.filter = 'invert(0.94) hue-rotate(180deg) saturate(1.35) contrast(1.05)'; g.drawImage(im, 48, 80, 928, 645); g.filter = 'none'; tx.needsUpdate = true; };
        im.src = url; return tx;
      };
      const texs = ['hirvo-builder', 'hirvo-visa', 'hirvo-dashboard'].map((n) => mkScreen(`${W_}${n}.webp`));
      const mat = new THREE.MeshBasicMaterial({ map: texs[0], toneMapped: false });
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(27, 19.5), mat); scr.matrixAutoUpdate = false; scr.matrix.copy(M4(8, 62, 7.85)); scene.add(scr);
      let k = 0; let next = 4.5; let flick = 0;
      screens.push({ mesh: scr, update: (tt, dt, visible) => { if (flick > 0) { flick = Math.max(0, flick - dt * 3); mat.color.setScalar(1 - Math.sin(flick * Math.PI) * 0.7); } if (!visible) return; next -= dt; if (next <= 0) { k = (k + 1) % texs.length; mat.map = texs[k]; flick = 1; next = 4.5; } } });
      // a second, smaller screen at street level on the podium
      lm.focus = P(8, 0).setY(40); lm.hitH = 110; lm.hitW = 40; lm.hitD = 40; lm.hitU = 8; lm.hitV = -2;
      break;
    }
    case 'news': {
      // the Daily AI building: an older newspaper block with a news ticker band
      bldg(0, 0, W - 14, D - 16, 28.4, 0xc8b39a);
      const tex = canvasTex(sign('DAILY AI · 每日 AI · DAILY AI · ', { w: 2048, h: 128, bg: '#16171a', fg: '#f2b705', size: 72 }));
      tex.wrapS = THREE.RepeatWrapping;
      const g1 = new THREE.PlaneGeometry(W - 14, 2.2); g1.applyMatrix4(M4(0, 9, (D - 16) / 2 + 0.1));
      const g2 = new THREE.PlaneGeometry(D - 16, 2.2); g2.applyMatrix4(M4((W - 14) / 2 + 0.1, 9, 0, Math.PI / 2));
      scene.add(new THREE.Mesh(mergeGeometries([g1, g2], false), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.8 })));
      anim.push((tt, dt) => { tex.offset.x += dt * 0.03; });
      signAt(sign('THE DAILY AI', { bg: '#f4efe4', fg: '#16171a', size: 120, font: 'Georgia, serif', weight: 700 }), 18, 3, 0, 31.2, (D - 16) / 2 - 2);
      lm.focus = P(0, 0).setY(12); lm.hitH = 32;
      break;
    }
    case 'clinic': {
      // the medical centre: a white clinic with a green cross, the 對藥 card on its face, a pill on the roof; the hackathon hall next door
      bldg(-14, -6, 58, 34, 13, 0xf1f1ee);
      [[-6 + 17.15, 58.4, 0.5], [-6 - 17.15, 58.4, 0.5]].forEach(([v, w, d]) => box(w, 1.4, d, matte(0x00933c), -14, 12.4, v, 0, { cast: false })); [-14 - 29.15, -14 + 29.15].forEach((u) => box(0.5, 1.4, 34.4, matte(0x00933c), u, 12.4, -6, 0, { cast: false }));
      photo('rx', 11, 11, -24, 7.2, -6 + 17.1); if (ovFace !== 'front') { const [ou, ov] = onFace(ovFace, -14, -6, 29, 17); photo('rx', 11, 11, ou, 7.2, ov, ovFace); }
      signAt(sign('對藥 · MEDICATION CHECK', { bg: '#ffffff', fg: '#00933c', size: 92, font: '"PingFang SC", "Public Sans", sans-serif' }), 16, 2.4, -2, 10.6, -6 + 17.1);
      // the pharmacy cross on a bracket, glowing and breathing slowly
      const crossMat = new THREE.MeshStandardMaterial({ color: 0x00933c, emissive: 0x00c853, emissiveIntensity: 1.2 });
      const cross = new THREE.Mesh(mergeGeometries([new THREE.BoxGeometry(3.6, 1.2, 0.5), new THREE.BoxGeometry(1.2, 3.6, 0.5)], false), crossMat);
      cross.matrixAutoUpdate = false; cross.matrix.copy(M4(-43.5 + 0.6, 9, -6 + 17 + 1.2, Math.PI / 2)); scene.add(cross);
      box(0.3, 0.3, 1.4, M.ink, -43.2, 9, -6 + 17 + 0.6);
      anim.push((tt) => { crossMat.emissiveIntensity = 0.8 + Math.sin(tt * 1.6) * 0.5; });
      const pill = new THREE.Group();
      const halves = [[0x00933c, 1], [0xf4f3ef, -1]].map(([c, sg]) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(1.6, 2.2, 6, 14), new THREE.MeshStandardMaterial({ color: c, roughness: 0.35 })); m.scale.set(1, 0.5, 1); m.position.y = sg * 1.4; m.castShadow = true; return m; });
      halves.forEach((h) => pill.add(h)); const pp = P(-14, -6); pill.position.set(pp.x, 27 * S, pp.z); pill.rotation.z = Math.PI / 3; pill.scale.setScalar(3.4 * S); scene.add(pill);
      anim.push((tt) => { pill.rotation.y = tt * 0.3; pill.position.y = (27 + Math.sin(tt * 0.9) * 0.8) * S; });
      // a big green cross on a rooftop frame, readable from far away
      box(0.5, 9, 0.5, M.ink, -34, 18, -16); box(10.4, 10.4, 0.6, matte(0xf4f3ef), -34, 22, -16, 0, { cast: false });
      [[8, 2.8], [2.8, 8]].forEach(([w, h]) => { box(w, h, 0.8, matte(0x00933c), -34, 22, -15.7, 0, { cast: false }); box(w, h, 0.8, matte(0x00933c), -34, 22, -16.3, 0, { cast: false }); });
      // the hackathon hall: sawtooth roof and a heart-pulse line
      bldg(32, -4, 28, 36, 9.8, 0xe6e1d7);
      for (let i = 0; i < 3; i++) { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(9, 0); sh.lineTo(9, 3.4); sh.closePath(); const eg = new THREE.ExtrudeGeometry(sh, { depth: 34, bevelEnabled: false }); eg.translate(-4.5, 0, -17); geo(eg, M.white, 23 + i * 9, 10.3, -4); }
      const pts = [[-8, 0], [-3, 0], [-2, 2.6], [-0.8, -2.6], [0.5, 4], [1.6, 0], [8, 0]];
      const path = new THREE.CurvePath();
      for (let i = 1; i < pts.length; i++) { const a = P(32 + pts[i - 1][0], -4 + 18.15); const c = P(32 + pts[i][0], -4 + 18.15); path.add(new THREE.LineCurve3(new THREE.Vector3(a.x, (5 + pts[i - 1][1] * 0.55) * S, a.z), new THREE.Vector3(c.x, (5 + pts[i][1] * 0.55) * S, c.z))); }
      batch.add(new THREE.TubeGeometry(path, 40, 0.22, 5), new THREE.MeshStandardMaterial({ color: 0x00933c, emissive: 0x00c853, emissiveIntensity: 1.1 }), null, { cast: false });
      signAt(sign('HACKATHON HALL', { bg: '#16171a', fg: '#ffffff', size: 104, bar: '#00933c' }), 13, 2, 32, 8.4, -4 + 18.12);
      lm.focus = P(0, 0).setY(8); lm.hitH = 26;
      break;
    }
    case 'port': {
      // the export terminal on the river: a warehouse with the risk board, a container yard, two gantry cranes, a ship at the quay
      bldg(-6, -24, 40, 46, 11, 0xcfd4d6);
      photo('risk', 10, 10, -6, 6.2, -24 + 23.1);
      signAt(sign('EXPORT TERMINAL', { bg: '#1f4e79', fg: '#ffffff', size: 104 }), 16, 2.4, -6, 9.4, -24 + 23.12);
      signAt(sign('EXPORT TERMINAL', { bg: '#1f4e79', fg: '#ffffff', size: 104 }), 18, 2.6, -6 + 20.1, 8.6, -24, 'right');
      box(W - 4, 0.6, D - 6, M.concrete, 0, 0.3, 0, 0, { cast: false });
      const cont = new THREE.InstancedMesh(new THREE.BoxGeometry(2.45, 2.6, 12.2), M.container, 120);
      const m4 = new THREE.Matrix4(); const c = new THREE.Color(); let k = 0;
      const cc = [0xb03a2e, 0x1f4e79, 0xd4ac0d, 0x1e8449, 0x7f8c8d, 0xe67e22];
      let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const yaw = new THREE.Quaternion().setFromAxisAngle(yAx, yawF);
      for (let row = 0; row < 7; row++) for (let col = 0; col < 3; col++) for (let lev = 0; lev < 3; lev++) {
        if (lev > 0 && rnd() < 0.25) continue;
        const p = P(-20 + row * 2.9, 6 + col * 13.2); m4.compose(new THREE.Vector3(p.x, 1.9 + lev * 2.6, p.z), yaw, new THREE.Vector3(1, 1, 1)); cont.setMatrixAt(k, m4); cont.setColorAt(k, c.setHex(cc[(row * 3 + col + lev * 2) % 6])); k++;
      }
      // the ship moored in the river, loaded with containers
      const shipU = W / 2 + 34; const hullY = -2.4;
      box(16, 5, 70, matte(0x2c3e50), shipU, hullY + 1.8, 0); box(16.2, 1.2, 70.2, matte(0xb03a2e), shipU, hullY - 0.2, 0, 0, { cast: false });
      box(13, 9, 9, M.white, shipU, hullY + 8.8, -28); box(13.4, 1, 9.4, M.ink, shipU, hullY + 13.6, -28);
      for (let row = 0; row < 4; row++) for (let lev = 0; lev < 2; lev++) for (let col = 0; col < 4; col++) {
        const p = P(shipU - 4.4 + row * 2.9, -14 + col * 12.8); m4.compose(new THREE.Vector3(p.x, hullY + 5.6 + lev * 2.6, p.z), yaw, new THREE.Vector3(1, 1, 1)); cont.setMatrixAt(k, m4); cont.setColorAt(k, c.setHex(cc[(row + col * 2 + lev) % 6])); k++;
      }
      cont.count = k; cont.castShadow = true; cont.receiveShadow = true; scene.add(cont);
      // gantry cranes on the quay, booms out over the ship
      [-16, 18].forEach((v) => {
        const u = W / 2 - 6;
        [[-6, -7], [-6, 7], [6, -7], [6, 7]].forEach(([du, dv]) => box(1.2, 28, 1.2, M.crane, u + du, 14, v + dv));
        box(13, 1.6, 1.6, M.crane, u, 28, v - 7); box(13, 1.6, 1.6, M.crane, u, 28, v + 7);
        box(56, 2.2, 3, M.crane, u + 18, 30.2, v); box(4, 3.4, 5, M.white, u + 4, 27.6, v);
        box(0.12, 12, 0.12, M.ink, u + 34, 24, v);
      });
      lm.focus = P(10, 0).setY(8); lm.hitH = 32; lm.hitW = W + 70; lm.hitU = 26;
      break;
    }
    case 'books': {
      // Snuggle Crew Books: a brick bookshop whose walls are giant covers; a stack of giant books on the roof
      bldg(0, 4, 52, 28, 10, 0x9e5d4a);
      [['star', -16], ['crew', 0], ['hat', 16]].forEach(([k, u]) => { photo(k, 8.6, 8.6, u, 5.6, 4 + 14.1); photo(k, 8.6, 8.6, u, 5.6, 4 - 14.1, 'back'); });
      signAt(sign('Snuggle Crew Books', { bg: '#a5584a', fg: '#fbf6ea', size: 92 }), 18, 2.4, 0, 11.5, 4 + 14.12);
      signAt(sign('Snuggle Crew Books', { bg: '#a5584a', fg: '#fbf6ea', size: 92 }), 18, 2.4, 0, 11.5, 4 - 14.12, 'back');
      const spines = [[0xa5584a, 22, 3.2], [0x0039a6, 20, 2.8], [0xf2b705, 21, 3.4], [0x00933c, 18, 2.6], [0x8e3b9c, 16, 2.4]];
      let y = 10.2; spines.forEach(([hex, w, h], i) => { const tw = (i % 2 ? 1 : -1) * 0.1; box(w, h, 13, matte(hex), -9 + (i % 2) * 1.8, y + h / 2, 2, tw); box(w - 0.8, h - 0.5, 0.3, matte(0xfbf6ea), -9 + (i % 2) * 1.8, y + h / 2, 2 + 6.55, tw, { cast: false }); box(w - 0.8, h - 0.5, 0.3, matte(0xfbf6ea), -9 + (i % 2) * 1.8, y + h / 2, 2 - 6.55, tw, { cast: false }); y += h; });
      const pageGeo = new THREE.BoxGeometry(7, 0.3, 9.4);
      batch.add(pageGeo, matte(0xfbf6ea), M4(11.4, 12.4, 4, 0, 0, 0.32)); batch.add(pageGeo, matte(0xfbf6ea), M4(18.6, 12.4, 4, 0, 0, -0.32));
      batch.add(new THREE.BoxGeometry(15, 0.5, 10), matte(0xa5584a), M4(15, 11.1, 4));
      for (let k = 0; k < 8; k++) { const p = P(-40 + k * 11, -26); addTree(p.x, p.z, 0.95); }
      lm.focus = P(0, 4).setY(8); lm.hitH = 22;
      break;
    }
    case 'studio': {
      // the kids' studio: a cream building with a giant iPad on its face and crayon columns
      bldg(0, 2, 46, 30, 9, 0xf6efe4);
      [['front', 2 + 15.4], ['back', 2 - 15.4]].forEach(([fc, v]) => {
        box(17.6, 12.4, 0.7, M.ink, 0, 9.4, v + (fc === 'front' ? 0.1 : -0.1), 0, { cast: false });
        photo('ipad', 16, 11.1, 0, 9.4, v + (fc === 'front' ? 0.5 : -0.5), fc);
      });
      [0xda291c, 0xf2b705, 0x0039a6, 0x00933c, 0x8e3b9c].forEach((hex, i) => {
        const u = -20 + i * 10; const v = 2 + 17.6;
        const hh = 12 + (i % 3) * 3;
        geo(new THREE.CylinderGeometry(1.5, 1.5, hh, 10), matte(hex), u, hh / 2 + 0.2, v);
        geo(new THREE.ConeGeometry(1.5, 3.2, 10), matte(hex), u, hh + 1.8, v);
        geo(new THREE.CylinderGeometry(1.32, 1.32, 1.4, 10), matte(0xf4f3ef), u, 3, v);
      });
      signAt(sign('Snuggle Crew Coloring', { bg: '#ffffff', fg: '#0039a6', size: 92 }), 16, 2.2, 0, 1.9, 2 + 15.12);
      lm.focus = P(0, 2).setY(7); lm.hitH = 18;
      break;
    }
    case 'cinema': {
      // Cinema Row: an art-deco picture house; a marquee with lights, posters, a blade sign, and an outdoor screen
      bldg(0, -6, 48, 34, 15, 0xe8dcc8);
      box(48.4, 2, 34.4, matte(0xb28a5a), 0, 15.6, -6, 0, { cast: false });
      const fv = -6 + 17;
      box(32, 1.2, 6, M.ink, 0, 5.4, fv + 3, 0); // marquee canopy
      signAt(sign('NOW SHOWING · YouAreExtinct · Noir Hours', { w: 2048, h: 160, bg: '#16171a', fg: '#ffd27a', size: 78, glow: '#ffb347' }), 31, 2.3, 0, 7.2, fv + 6.05, 'front', { emissive: 1 });
      photo('yae', 9.6, 5.4, -15, 11, fv + 0.1); photo('noir', 9.6, 5.4, 15, 11, fv + 0.1);
      // the blade: a tall vertical CINEMA sign standing off the corner
      const blade = sign('C\nI\nN\nE\nM\nA', { w: 256, h: 1024, bg: '#da291c', fg: '#fff6e0', size: 150, lh: 160, glow: '#fff1c9' });
      box(0.6, 15, 3.2, M.ink, -24.4, 15, fv - 2, 0);
      signAt(blade, 3, 12, -24.75, 15, fv - 2, 'left', { emissive: 1.1 }); signAt(blade, 3, 12, -24.05, 15, fv - 2, 'right', { emissive: 1.1 });
      // the outdoor screen faces the overview; it plays the Noir Hours loop when you come close
      const sFace = ovFace === 'front' ? 'back' : ovFace;
      const out = (d) => { const n = NORM[sFace]; const [u0, v0] = onFace(sFace, 0, -6, 24, 17); return [u0 + n.dot(r) * d, v0 + n.dot(f) * d]; };
      const [fu, fv2] = out(0.35); box(24, 14.4, 0.7, M.ink, fu, 23.2, fv2, FACE[sFace], { cast: false });
      const poster = new THREE.TextureLoader().load(`${W_}noir-loop-poster.jpg`); poster.colorSpace = THREE.SRGBColorSpace;
      const smat = new THREE.MeshBasicMaterial({ map: poster, toneMapped: false });
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(22.4, 12.6), smat); scr.matrixAutoUpdate = false; const [su, sv] = out(0.8); scr.matrix.copy(M4(su, 23.2, sv, FACE[sFace])); scene.add(scr);
      let video = null; let vtex = null;
      screens.push({ mesh: scr, near: true, update: (tt, dt, visible, near) => {
        const want = visible && near;
        if (want && !video) { video = document.createElement('video'); video.src = `${W_}noir-loop.mp4`; video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto'; vtex = new THREE.VideoTexture(video); vtex.colorSpace = THREE.SRGBColorSpace; }
        if (!video) return;
        if (want && video.paused) { video.play().then(() => { smat.map = vtex; smat.needsUpdate = true; }).catch(() => {}); }
        if (!want && !video.paused) { video.pause(); smat.map = poster; smat.needsUpdate = true; }
      } });
      // a giant film reel standing on the roof
      { const reel = []; const rk = (g, x, y, z) => { g.translate(x, y, z); reel.push(g); };
        const disc = new THREE.CylinderGeometry(8, 8, 1.2, 28); disc.rotateX(Math.PI / 2); rk(disc, 0, 0, 0);
        const hub = new THREE.CylinderGeometry(1.6, 1.6, 2.2, 14); hub.rotateX(Math.PI / 2); rk(hub, 0, 0, 0);
        const holes = []; for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; const hd = new THREE.CylinderGeometry(1.9, 1.9, 1.4, 14); hd.rotateX(Math.PI / 2); hd.translate(Math.cos(a) * 4.6, Math.sin(a) * 4.6, 0); holes.push(hd); }
        batch.add(mergeGeometries(reel.map((g) => g.toNonIndexed()), false), matte(0x0039a6), M4(-8, 25, -12, 0.35));
        batch.add(mergeGeometries(holes.map((g) => g.toNonIndexed()), false), matte(0xf2b705), M4(-8, 25, -12, 0.35), { cast: false });
        box(1.2, 8, 3, M.ink, -8, 20, -12, 0.35); }
      // the influencer studio's ring light on the roof
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.45, 10, 36), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 1.4 }));
      const rp = P(14, -14); ring.position.set(rp.x, 23 * S, rp.z); ring.scale.setScalar(S); ring.rotation.y = yawF + 0.6; scene.add(ring);
      box(0.4, 5, 0.4, M.ink, 14, 18.6, -14);
      lm.focus = P(0, -4).setY(10); lm.hitH = 32;
      break;
    }
    case 'arcade': {
      // the arcade: a dark hall with neon, windows full of game art, pixel blocks that blink; the bead store next door
      bldg(-8, 0, 50, 32, 10.4, 0x2c2f36);
      const mq = sign('ARCADE', { bg: '#8e3b9c', fg: '#ffffff', size: 150, glow: '#ffd6ff' });
      signAt(mq, 20, 3.8, -8, 8.2, 16.12, 'front', { emissive: 0.9 }); signAt(mq, 20, 3.8, -8, 8.2, -16.12, 'back', { emissive: 0.9 });
      photo('stickerScene', 8, 8, -24, 4.6, 16.1); photo('party', 3.2, 5.7, -14, 3.4, 16.1);
      ['duck', 'dog', 'sunflower', 'boat'].forEach((k, i) => photo(k, 3.4, 3.4, -4 + i * 4, 3, 16.1));
      photo('stickerScene', 8, 8, 8, 4.6, -16.1, 'back'); photo('party', 3.2, 5.7, -2, 3.4, -16.1, 'back');
      const px = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 1.1, 0.2), new THREE.MeshStandardMaterial({ roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.25 }), 40);
      const cols = [0x8e3b9c, 0xf2b705, 0x0039a6, 0xda291c, 0x00933c];
      const m4 = new THREE.Matrix4(); const c = new THREE.Color(); const q = new THREE.Quaternion().setFromAxisAngle(yAx, yawF);
      for (let i = 0; i < 40; i++) { const p = P(-32 + (i % 20) * 1.6 + 0.8 + 16, 16.2); m4.compose(new THREE.Vector3(p.x, (10.9 + Math.floor(i / 20) * 1.3) * S, p.z), q, new THREE.Vector3(S, S, S)); px.setMatrixAt(i, m4); px.setColorAt(i, c.setHex(cols[(i * 7) % 5])); }
      scene.add(px);
      let tick = 0; anim.push((tt, dt) => { tick += dt; if (tick < 0.12) return; tick = 0; const i = (Math.random() * 40) | 0; px.setColorAt(i, c.setHex(cols[(Math.random() * 5) | 0])); px.instanceColor.needsUpdate = true; });
      // a pixel gamepad standing on the roof
      { const art = ['0011111111100', '0111111111110', '1101111110111', '1000111101011', '1101111111111', '1111111110101', '1111000001111', '1110000000111'];
        const pad = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.MeshStandardMaterial({ roughness: 0.55 }), 104); let n = 0;
        art.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch !== '1') return; const p = P(-8 + (rx - 6) * 1.5, -2); m4.compose(new THREE.Vector3(p.x, (11.4 + (art.length - ry) * 1.5) * S, p.z), q, new THREE.Vector3(S, S, S)); pad.setMatrixAt(n, m4); pad.setColorAt(n, c.setHex(ry === 0 ? 0xf2b705 : (rx + ry) % 4 === 0 ? 0xd27be8 : 0xa03fc0)); n++; }));
        pad.count = n; pad.castShadow = true; scene.add(pad); }
      bldg(27, 4, 16, 18, 6.6, 0xe6e1d7);
      photo('beads', 10, 5, 27, 3.6, 4 + 9.1);
      signAt(sign('拼豆 BEADS', { bg: '#ffffff', fg: '#16171a', size: 96, bar: '#f2b705' }), 9, 1.6, 27, 7.4, 4 + 9.12);
      lm.focus = P(-4, 0).setY(6); lm.hitH = 16;
      break;
    }
    case 'courts': {
      // Sports Park: a sports hall with a court painted on its roof, an outdoor court with floodlights, a giant phone with the booking screen
      bldg(0, -20, 60, 40, 11.6, 0xd6cbb8, { noRoof: true });
      photoFlat('courtFloor', 50, 25, 0, 11.86, -20);
      box(W - 8, 0.1, 30, M.concreteDark, 0, 0.2, 20, 0, { cast: false });
      photoFlat('courtFloor', 30, 15, 0, 0.29, 20);
      [[-17, 9], [17, 9], [-17, 31], [17, 31]].forEach(([u, v]) => { box(0.4, 14, 0.4, M.ink, u, 7, v); geo(new THREE.BoxGeometry(2.2, 0.8, 1.2), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff8e0, emissiveIntensity: 1.2 }), u, 14.2, v, 0, 0.5, { cast: false }); });
      [-1, 1].forEach((sg) => { box(0.25, 3.05, 0.25, M.ink, sg * 15.6, 1.7, 20); box(0.1, 1.05, 1.8, M.white, sg * 15.2, 3.4, 20, Math.PI / 2); });
      box(8.2, 15.6, 0.7, M.ink, 22, 9.6, -20 + 20.4, 0, { cast: false });
      photo('court', 7, 14.2, 22, 9.6, -20 + 20.8);
      signAt(sign('COURTS · 球馆', { bg: '#00933c', fg: '#ffffff', size: 120 }), 16, 2.6, -8, 9, -20 + 20.12);
      { const ball = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 16), new THREE.MeshStandardMaterial({ color: 0xf07a1c, roughness: 0.7 })); const bp = P(-14, -26); ball.position.set(bp.x, 19.8 * S, bp.z); ball.scale.setScalar(1.5 * S); ball.castShadow = true; scene.add(ball);
        const seams = new THREE.Mesh(mergeGeometries([new THREE.TorusGeometry(5.02, 0.16, 6, 40), new THREE.TorusGeometry(5.02, 0.16, 6, 40).rotateY(Math.PI / 2), new THREE.TorusGeometry(5.02, 0.16, 6, 40).rotateX(Math.PI / 2)], false), new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.8 }));
        ball.add(seams); anim.push((tt) => { ball.rotation.y = tt * 0.4; }); box(5, 1.2, 5, M.ink, -14, 12.2, -26); }
      lm.focus = P(0, 0).setY(6); lm.hitH = 20;
      break;
    }
    case 'nonstop': {
      // Non-stop: an observatory whose telescope keeps sweeping the sky. The loop never ends.
      box(W - 8, 0.12, D - 8, M.grass, 0, 0.22, 0, 0, { cast: false });
      box(30, 0.14, 30, M.sidewalk, 0, 0.26, 10, 0, { cast: false });
      geo(new THREE.CylinderGeometry(13, 14, 11, 32), M.white, 0, 5.5, -10);
      geo(new THREE.CylinderGeometry(14.2, 14.2, 0.8, 32), M.line, 0, 11.2, -10, 0, 0, { cast: false });
      const dome = new THREE.Group(); const dp = P(0, -10); dome.position.set(dp.x, 11.6 * S, dp.z); dome.scale.setScalar(S); scene.add(dome);
      const domeMat = new THREE.MeshStandardMaterial({ color: 0xdfe3e7, roughness: 0.3, metalness: 0.6 });
      const shell = new THREE.Mesh(new THREE.SphereGeometry(13, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), domeMat); shell.castShadow = true; dome.add(shell);
      const slit = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1, 13.4), new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.9 }));
      slit.geometry.translate(0, 0, 0); slit.scale.set(1, 1, 1); slit.position.set(0, 9.4, 4.6); slit.rotation.x = -0.75; dome.add(slit);
      const scope = new THREE.Group(); scope.position.set(0, 6, 2); dome.add(scope);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.6, 18, 18), new THREE.MeshStandardMaterial({ color: 0x0039a6, roughness: 0.4, metalness: 0.2 })); tube.position.set(0, 9, 0);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.15, 1.6, 18), new THREE.MeshStandardMaterial({ color: 0xf2b705, roughness: 0.5 })); band.position.set(0, 15.5, 0); scope.add(band); tube.castShadow = true; scope.add(tube);
      anim.push((tt) => { dome.rotation.y = yawF + Math.sin(tt * 0.12) * 1.3 + 0.5; scope.rotation.x = 0.5 + Math.sin(tt * 0.31) * 0.28; });
      // the departures board on the plaza
      box(0.5, 8, 0.5, M.ink, -9, 4, 24); box(0.5, 8, 0.5, M.ink, 9, 4, 24);
      signAt(sign('NON-STOP\nstill searching\n不停站 · 还在寻找', { w: 1024, h: 512, bg: '#f2b705', fg: '#16171a', size: 92, lh: 130 }), 17, 8.5, 0, 7.2, 24.3);
      signAt(sign('The loop never ends.', { w: 1024, h: 160, bg: '#16171a', fg: '#f2b705', size: 76 }), 17, 2.6, 0, 1.6, 24.3);
      // a beacon on a mast that blinks
      box(0.4, 26, 0.4, M.ink, 24, 13, -26);
      const beaconMat = new THREE.MeshStandardMaterial({ color: 0xff3b2e, emissive: 0xff3b2e, emissiveIntensity: 2 });
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), beaconMat); const bp = P(24, -26); beacon.position.set(bp.x, 26.4 * S, bp.z); beacon.scale.setScalar(S); scene.add(beacon);
      anim.push((tt) => { beaconMat.emissiveIntensity = (tt % 2) < 0.25 ? 3 : 0.3; });
      for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; const p = P(Math.cos(a) * 28, -6 + Math.sin(a) * 25); addTree(p.x, p.z, 1 + (k % 3) * 0.15); }
      lm.focus = P(0, 0).setY(10); lm.hitH = 28;
      break;
    }
    default: break;
  }
  // a hover box around the main structures, in world space
  const hc = P(lm.hitU || 0, lm.hitV || 0);
  const hw = lm.hitW * S; const hd = lm.hitD * S; const hh = lm.hitH * S;
  lm.hit = { center: new THREE.Vector3(hc.x, hh / 2, hc.z), size: swap ? new THREE.Vector3(hd, hh, hw) : new THREE.Vector3(hw, hh, hd) };
}
