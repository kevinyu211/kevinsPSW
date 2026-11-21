/* Kevin Metro · landmarks
   Each destination is a real place in the city, built from one of Kevin's projects.
   Builders draw into the shared static batch; signs are small canvas textures. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

const yAx = new THREE.Vector3(0, 1, 0);

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
  add(canvas, w, h, x, y, z, yaw, opts = {}) { this.items.push({ canvas, w, h, m: opts.matrix || new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(yAx, yaw), new THREE.Vector3(1, 1, 1)), glow: opts.emissive || 0, both: opts.both }); }
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
      for (let k = 0; k < uv.count; k++) { uv.setXY(k, (r.x + uv.getX(k) * r.w) / W, 1 - (r.y + (1 - uv.getY(k)) * r.h) / H); }
      geo.applyMatrix4(it.m); (it.glow ? glow : plain).push(geo);
    });
    const mk = (list, mat) => { if (!list.length) return; const m = new THREE.Mesh(mergeGeometries(list, false), mat); scene.add(m); };
    mk(plain, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide }));
    mk(glow, new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.2, roughness: 0.6, side: THREE.DoubleSide }));
  }
}
/* The camera looks from the south-east, so the most visible faces are +x (east) and +z (south). */
export const LANDMARKS = [
  { id: 'campus', x: -525, z: -405 },
  { id: 'uhome', x: -655, z: -405 },
  { id: 'hirvo', x: -265, z: -405 },
  { id: 'news', x: -395, z: -190 },
  { id: 'books', x: -5, z: -295 },
  { id: 'arcade', x: -5, z: -75 },
  { id: 'park', x: -135, z: -75 },
  { id: 'port', x: 385, z: 130 },
  { id: 'museum', x: 385, z: 271 },
  { id: 'jazz', x: 515, z: 271 },
  { id: 'studio', x: 385, z: 449 },
  { id: 'courts', x: 775, z: 365 },
  { id: 'hall', x: 775, z: 35 },
  { id: 'build', x: 775, z: -295 },
];

export function buildLandmark(lm, ctx) {
  const { b, batch, M, scene, addBuilding, addTree, anim, lineHex, atlas } = ctx;
  const put = (canvas, w, h, x, y, z, yaw, opts) => atlas.add(canvas, w, h, x, y, z, yaw, opts);
  const mats = {}; const matte = (hex) => { if (!mats[hex]) { mats[hex] = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85, side: THREE.DoubleSide }); mats[hex].userData.matte = true; } return mats[hex]; };
  const T = (x, y, z, rx = 0, ry = 0, rz = 0, sc = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sc, sc, sc));
  const cx = b.cx; const cz = b.cz; const W = b.x1 - b.x0; const D = b.z1 - b.z0;
  const box = (w, h, d, mat, x, y, z, ry = 0, o) => batch.box(w, h, d, mat, x, y, z, ry, o);
  const glassTower = (x, z, w, d, h, color) => addBuilding({ x, z, w, d, h, y: 0.16, color, glassy: 1 });
  const masonry = (x, z, w, d, h, color) => addBuilding({ x, z, w, d, h, y: 0.16, color, glassy: 0 });
  lm.focus = new THREE.Vector3(cx, 0, cz);

  switch (lm.id) {
    case 'campus': {
      // a green quad with an arched gate on the south side and three halls
      box(W - 10, 0.12, D - 10, M.grass, cx, 0.22, cz, 0, { cast: false });
      box(6, 0.13, D - 10, M.sidewalk, cx, 0.24, cz, 0, { cast: false });
      masonry(cx - 30, cz - 28, 34, 16, 16.2, 0xb46a52);
      masonry(cx + 30, cz - 28, 34, 16, 16.2, 0xb46a52);
      masonry(cx - 42, cz + 6, 14, 34, 13, 0xc8b39a);
      // the gate: two brick piers and a lintel with the name
      const gz = b.z1 - 4;
      box(2.2, 9, 2.2, M.brick, cx - 6, 4.5, gz); box(2.2, 9, 2.2, M.brick, cx + 6, 4.5, gz); box(15, 1.8, 2.4, M.brick, cx, 9.6, gz);
      put(sign('UNIVERSITY', { bg: '#7a3b2a', fg: '#f3e7d3', size: 110 }), 11, 1.4, cx, 9.6, gz + 1.25, 0);
      for (let k = 0; k < 18; k++) addTree(cx - 30 + (k % 6) * 12, cz - 6 + Math.floor(k / 6) * 12, 1.1);
      lm.focus.set(cx, 4, gz);
      break;
    }
    case 'uhome': {
      // student apartments: two mid-rise slabs around a courtyard by the campus
      masonry(cx, cz - 22, W - 16, 16, 22.4, 0xe6e1d7);
      masonry(cx + 20, cz + 18, W - 56, 18, 19.2, 0xd6cbb8);
      box(W - 60, 0.12, 24, M.grass, cx - 22, 0.22, cz + 18, 0, { cast: false });
      put(sign('UHOME', { bg: '#ffffff', fg: '#0039a6', size: 140 }), 9, 2.2, cx + 20, 16, cz + 27.1, 0);
      for (let k = 0; k < 6; k++) addTree(cx - 40 + k * 6, cz + 30, 0.9);
      lm.focus.set(cx, 8, cz + 18);
      break;
    }
    case 'hirvo': {
      // startup HQ: a slim glass tower on a stone podium, a rooftop sign
      masonry(cx, cz, W - 12, D - 12, 7.6, 0xd9d3c7);
      glassTower(cx + 8, cz + 6, 30, 26, 102, 0x9fb3c2);
      const t = sign('HIRVO', { bg: '#16171a', fg: '#ffffff', size: 150, bar: '#da291c' });
      put(t, 16, 4, cx + 8, 112, cz + 19.05, 0);
      put(t, 16, 4, cx + 23.05, 112, cz + 6, Math.PI / 2);
      box(30.4, 6, 26.4, M.ink, cx + 8, 109, cz + 6);
      lm.focus.set(cx + 8, 30, cz + 6);
      break;
    }
    case 'news': {
      // the Daily AI building: an older newspaper block with a news ticker band
      masonry(cx, cz, W - 12, D - 14, 28.4, 0xc8b39a);
      const tex = canvasTex(sign('DAILY AI · 每日 AI · DAILY AI · ', { w: 2048, h: 128, bg: '#16171a', fg: '#f2b705', size: 72 }));
      tex.wrapS = THREE.RepeatWrapping;
      const g1 = new THREE.PlaneGeometry(W - 12, 2.2); g1.translate(cx, 9, cz + (D - 14) / 2 + 0.06);
      const g2 = new THREE.PlaneGeometry(D - 14, 2.2); g2.rotateY(Math.PI / 2); g2.translate(cx + (W - 12) / 2 + 0.06, 9, cz);
      scene.add(new THREE.Mesh(mergeGeometries([g1, g2], false), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.8 })));
      anim.push((tt, dt) => { tex.offset.x += dt * 0.03; });
      lm.focus.set(cx, 10, cz);
      break;
    }
    case 'books': {
      // Snuggle Crew: a low brick bookshop with a giant open book on the roof, and a publishing house behind
      masonry(cx + 6, cz + 12, 40, 26, 9.8, 0x9e5d4a);
      masonry(cx - 20, cz - 24, 36, 22, 16.2, 0xd9c9b0);
      const pageGeo = new THREE.BoxGeometry(7, 0.3, 9.4);
      batch.add(pageGeo, matte(0xfbf6ea), T(cx + 2.4, 12.2, cz + 12, 0, 0, 0.32));
      batch.add(pageGeo, matte(0xfbf6ea), T(cx + 9.6, 12.2, cz + 12, 0, 0, -0.32));
      batch.add(new THREE.BoxGeometry(15, 0.5, 10), matte(0xa5584a), T(cx + 6, 10.9, cz + 12));
      put(sign('Snuggle Crew Books', { bg: '#a5584a', fg: '#fbf6ea', size: 92 }), 18, 2.6, cx + 6, 6.4, cz + 25.1, 0);
      lm.focus.set(cx + 6, 6, cz + 12);
      break;
    }
    case 'arcade': {
      // the arcade: a bright two-storey hall with a pixel marquee; a small bead store next door
      masonry(cx - 6, cz + 4, 44, 30, 9.8, 0x2c2f36);
      const mq = sign('ARCADE', { bg: '#8e3b9c', fg: '#ffffff', size: 150, glow: '#ffd6ff' });
      put(mq, 22, 4, cx - 6, 7.2, cz + 19.1, 0, { emissive: 0.9 });
      put(mq, 18, 3.4, cx + 16.1, 7.2, cz + 4, Math.PI / 2, { emissive: 0.9 });
      const px = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 1.1, 0.2), new THREE.MeshStandardMaterial({ roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.25 }), 60);
      const cols = [0x8e3b9c, 0xf2b705, 0x0039a6, 0xda291c, 0x00933c];
      const m4 = new THREE.Matrix4(); const c = new THREE.Color();
      for (let i = 0; i < 60; i++) { m4.makeTranslation(cx - 22 + (i % 20) * 1.6, 1.6 + Math.floor(i / 20) * 1.4, cz + 19.15); px.setMatrixAt(i, m4); px.setColorAt(i, c.setHex(cols[(i * 7) % 5])); }
      scene.add(px);
      anim.push((tt) => { if (Math.random() > 0.08) return; const i = Math.floor(Math.random() * 60); px.setColorAt(i, c.setHex(cols[Math.floor(Math.random() * 5)])); px.instanceColor.needsUpdate = true; });
      masonry(cx + 30, cz + 8, 14, 16, 6.6, 0xe6e1d7);
      put(sign('拼豆 BEADS', { bg: '#ffffff', fg: '#16171a', size: 96, bar: '#f2b705' }), 9, 1.6, cx + 30, 4.4, cz + 16.1, 0);
      lm.focus.set(cx - 6, 5, cz + 4);
      break;
    }
    case 'park': {
      box(W - 6, 0.12, D - 6, M.grass, cx, 0.22, cz, 0, { cast: false });
      box(W - 6, 0.13, 3.5, M.sidewalk, cx, 0.24, cz, 0, { cast: false });
      box(3.5, 0.13, D - 6, M.sidewalk, cx, 0.24, cz, 0, { cast: false });
      batch.add(new THREE.CircleGeometry(11, 24), M.water, T(cx + 24, 0.3, cz - 18, -Math.PI / 2), { cast: false });
      for (let k = 0; k < 40; k++) { const x = b.x0 + 6 + Math.random() * (W - 12); const z = b.z0 + 6 + Math.random() * (D - 12); if (Math.abs(x - cx) < 4 || Math.abs(z - cz) < 4 || Math.hypot(x - cx - 24, z - cz + 18) < 13) continue; addTree(x, z, 0.9 + Math.random() * 0.6); }
      break;
    }
    case 'port': {
      // export port: a quay on the river, stacked containers, two gantry cranes, a warehouse
      box(W - 6, 0.6, 26, M.concrete, cx, 0.3, b.z1 - 13, 0, { cast: false });
      masonry(cx - 30, b.z0 + 18, 40, 24, 10.6, 0xcfd4d6);
      const cont = new THREE.InstancedMesh(new THREE.BoxGeometry(12.2, 2.6, 2.45), M.container, 72);
      const m4 = new THREE.Matrix4(); const c = new THREE.Color(); let k = 0;
      const cc = [0xb03a2e, 0x1f4e79, 0xd4ac0d, 0x1e8449, 0x7f8c8d, 0xe67e22];
      for (let row = 0; row < 6; row++) for (let col = 0; col < 4; col++) for (let lev = 0; lev < 3; lev++) {
        if (k >= 72) break;
        if (Math.random() < 0.18 && lev > 0) continue;
        m4.makeTranslation(cx + 4 + col * 13, 1.5 + lev * 2.6, b.z0 + 8 + row * 2.8); cont.setMatrixAt(k, m4); cont.setColorAt(k, c.setHex(cc[(row * 3 + col + lev) % 6])); k++;
      }
      cont.count = k; cont.castShadow = true; cont.receiveShadow = true; scene.add(cont);
      [cx - 18, cx + 20].forEach((x) => {
        const z = b.z1 - 8;
        [[-7, -6], [-7, 6], [7, -6], [7, 6]].forEach(([dx, dz]) => box(1.1, 26, 1.1, M.crane, x + dx, 13, z + dz));
        box(16, 1.6, 1.4, M.crane, x, 26, z - 6); box(16, 1.6, 1.4, M.crane, x, 26, z + 6);
        box(3, 2, 46, M.crane, x, 28, z + 8); box(4, 3.2, 5, M.white, x, 25.5, z + 2);
      });
      put(sign('EXPORT PORT', { bg: '#1f4e79', fg: '#ffffff', size: 110 }), 14, 2.6, cx - 30, 8.2, b.z0 + 30.1, 0);
      lm.focus.set(cx, 6, cz);
      break;
    }
    case 'museum': {
      // natural history museum: a stone hall with a colonnade, a pediment and a mammoth banner
      masonry(cx, cz - 4, 70, 34, 16.2, 0xe9e4da);
      box(74, 1.2, 38, M.white, cx, 16.9, cz - 4);
      const pz = cz + 13.5;
      box(44, 1.2, 8, M.white, cx, 0.8, pz + 3);
      for (let i = 0; i < 8; i++) { const x = cx - 19 + i * 5.4; batch.add(new THREE.CylinderGeometry(0.8, 0.9, 12, 14), M.white, new THREE.Matrix4().makeTranslation(x, 7.4, pz + 5.5)); }
      const tri = new THREE.Shape(); tri.moveTo(-24, 0); tri.lineTo(24, 0); tri.lineTo(0, 6); tri.closePath();
      const ped = new THREE.ExtrudeGeometry(tri, { depth: 2, bevelEnabled: false }); ped.translate(0, 0, -1);
      batch.add(ped, M.white, new THREE.Matrix4().makeTranslation(cx, 13.4, pz + 5.5));
      // mammoth silhouette as a cut-out banner
      const s = new THREE.Shape();
      s.moveTo(-6, 0); s.lineTo(-5.5, 3.2); s.bezierCurveTo(-6.6, 5.6, -4.4, 8.4, -1.2, 8.6); s.bezierCurveTo(2.4, 9.2, 4.6, 7.6, 5.2, 5.6);
      s.bezierCurveTo(6.6, 4.6, 7.0, 2.4, 6.6, 0.4); s.lineTo(5.9, 0.4); s.bezierCurveTo(6.1, 2.4, 5.6, 3.6, 4.8, 4.0); s.lineTo(4.4, 0); s.lineTo(3.0, 0); s.lineTo(3.0, 2.6);
      s.lineTo(-2.4, 2.6); s.lineTo(-2.4, 0); s.lineTo(-3.8, 0); s.lineTo(-3.8, 2.2); s.lineTo(-4.6, 2.2); s.lineTo(-4.6, 0); s.closePath();
      batch.add(new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false }), matte(0x3a2e26), T(cx + 22, 17.6, cz - 2, 0, 0, 0, 1.2));
      put(sign('NATURAL HISTORY MUSEUM · YouAreExtinct', { w: 2048, h: 160, bg: '#e9e4da', fg: '#3a2e26', size: 72 }), 40, 3.1, cx, 14.6, pz + 6.6, 0);
      lm.focus.set(cx, 8, cz + 6);
      break;
    }
    case 'jazz': {
      // Noir Hours jazz club: dark brick, a neon sign, a rain-slick street in front
      masonry(cx - 8, cz - 4, 44, 30, 13, 0x5b3a32);
      const neon = sign('NOIR HOURS', { bg: '#120d10', fg: '#ff6ec7', size: 150, glow: '#ff6ec7', font: 'Georgia, serif', weight: 400 });
      put(neon, 16, 3.8, cx - 8, 8.6, cz + 11.1, 0, { emissive: 1.6 });
      batch.add(new THREE.PlaneGeometry(W - 8, 14), M.asphaltWet, T(cx, 0.24, b.z1 - 7, -Math.PI / 2), { cast: false });
      for (let i = 0; i < 4; i++) masonry(cx + 30, cz - 20 + i * 12, 14, 10, 16, 0x7d5245);
      lm.focus.set(cx - 8, 6, cz + 8);
      break;
    }
    case 'studio': {
      // AI influencer studio: a white box with a giant ring light
      masonry(cx - 6, cz, 50, b.z1 - b.z0 - 10, 12.4, 0xf4f3ef);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.55, 12, 40), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 1.4 }));
      ring.position.set(cx - 6, 18, cz); ring.rotation.y = Math.PI / 4; scene.add(ring);
      box(0.4, 6, 0.4, M.ink, cx - 6, 15, cz);
      put(sign('STUDIO', { bg: '#ffffff', fg: '#0039a6', size: 150 }), 12, 2.4, cx - 6, 9, cz + (b.z1 - b.z0 - 10) / 2 + 0.06, 0);
      lm.focus.set(cx - 6, 8, cz);
      break;
    }
    case 'courts': {
      // court booking: a basketball venue hall with two outdoor courts
      masonry(cx - 30, cz - 26, 44, 36, 14, 0xd6cbb8);
      put(sign('COURTS · 球馆', { bg: '#00933c', fg: '#ffffff', size: 120 }), 16, 2.8, cx - 30, 10.5, cz - 7.9, 0);
      const ct = document.createElement('canvas'); ct.width = 1024; ct.height = 560; const g = ct.getContext('2d');
      g.fillStyle = '#c27c4e'; g.fillRect(0, 0, 1024, 560); g.strokeStyle = '#ffffff'; g.lineWidth = 8;
      g.strokeRect(12, 12, 1000, 536); g.beginPath(); g.moveTo(512, 12); g.lineTo(512, 548); g.stroke();
      g.beginPath(); g.arc(512, 280, 64, 0, Math.PI * 2); g.stroke();
      [[12, 1], [1012, -1]].forEach(([x, sgn]) => { g.strokeRect(sgn > 0 ? x : x - 210, 180, 210, 200); g.beginPath(); g.arc(x, 280, 260, -Math.PI / 2, Math.PI / 2, sgn < 0); g.stroke(); });
      const tex = new THREE.CanvasTexture(ct); tex.colorSpace = THREE.SRGBColorSpace;
      const courtMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
      [[cx + 22, cz - 18], [cx + 22, cz + 18]].forEach(([x, z]) => {
        box(34, 0.1, 20, M.concreteDark, x, 0.2, z, 0, { cast: false });
        batch.add(new THREE.PlaneGeometry(28, 15), courtMat, T(x, 0.27, z, -Math.PI / 2), { cast: false });
        [-1, 1].forEach((sg) => { box(0.25, 3.05, 0.25, M.ink, x + sg * 14.9, 1.7, z); box(0.1, 1.05, 1.8, M.white, x + sg * 14.6, 3.4, z); });
      });
      lm.focus.set(cx + 10, 4, cz);
      break;
    }
    case 'hall': {
      // hackathon hall: a sawtooth-roof hall with a pill sign and a heart-pulse line
      masonry(cx, cz, 60, 40, 9.8, 0xe6e1d7);
      for (let i = 0; i < 6; i++) {
        const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(10, 0); sh.lineTo(10, 3.6); sh.closePath();
        const eg = new THREE.ExtrudeGeometry(sh, { depth: 40, bevelEnabled: false }); eg.translate(-5, 0, -20);
        batch.add(eg, M.white, new THREE.Matrix4().makeTranslation(cx - 25 + i * 10, 10.4, cz));
      }
      const pill = new THREE.Group();
      const c1 = new THREE.Mesh(new THREE.CapsuleGeometry(1.4, 3.4, 8, 18), new THREE.MeshStandardMaterial({ color: 0x00933c, roughness: 0.4 }));
      pill.add(c1); pill.rotation.z = Math.PI / 3; pill.position.set(cx + 22, 18, cz + 8); c1.castShadow = true; scene.add(pill);
      anim.push((tt) => { pill.rotation.y = tt * 0.25; });
      const pts = [[-10, 0], [-4, 0], [-2.6, 2.6], [-1, -2.6], [0.6, 4], [2, 0], [10, 0]];
      const path = new THREE.CurvePath();
      for (let i = 1; i < pts.length; i++) path.add(new THREE.LineCurve3(new THREE.Vector3(cx + pts[i - 1][0], 5.2 + pts[i - 1][1] * 0.6, cz + 20.15), new THREE.Vector3(cx + pts[i][0], 5.2 + pts[i][1] * 0.6, cz + 20.15)));
      batch.add(new THREE.TubeGeometry(path, 40, 0.2, 5), new THREE.MeshStandardMaterial({ color: 0x00933c, emissive: 0x00c853, emissiveIntensity: 1.1 }), null, { cast: false });
      put(sign('HACKATHON HALL', { bg: '#16171a', fg: '#ffffff', size: 110, bar: '#00933c' }), 18, 2.6, cx, 8.4, cz + 20.1, 0);
      lm.focus.set(cx, 6, cz);
      break;
    }
    case 'build': {
      // the line under construction: fenced site, a tower crane, a sign
      box(W - 8, 0.1, D - 8, M.ballast, cx, 0.22, cz, 0, { cast: false });
      for (let i = 0; i < 4; i++) box(W - 10, 2, 0.15, M.white, cx, 1.2, i < 2 ? b.z0 + 4 : b.z1 - 4);
      const mx = cx - 30; const mz = cz;
      box(2.4, 64, 2.4, M.crane, mx, 32, mz); box(54, 1.6, 1.6, M.crane, mx + 14, 64, mz); box(5, 4, 4, M.concreteDark, mx - 10, 62, mz); box(3, 3, 3, M.white, mx, 66, mz);
      const hook = new THREE.Mesh(new THREE.BoxGeometry(0.1, 30, 0.1), M.ink); hook.position.set(mx + 32, 49, mz); scene.add(hook);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(10, 0.6, 0.6), M.steel); beam.position.set(mx + 32, 34, mz); beam.castShadow = true; scene.add(beam);
      anim.push((tt) => { const y = 34 + Math.sin(tt * 0.25) * 6; beam.position.y = y; hook.scale.y = (64 - y) / 30; hook.position.y = (64 + y) / 2; });
      put(sign('NEXT: STILL SEARCHING\n下一站：还在寻找', { w: 1024, h: 384, bg: '#f2b705', fg: '#16171a', size: 64, lh: 110 }), 14, 5.2, cx + 12, 9, cz + 20, 0);
      box(0.4, 7, 0.4, M.ink, cx + 6, 3.5, cz + 20); box(0.4, 7, 0.4, M.ink, cx + 18, 3.5, cz + 20);
      lm.focus.set(cx, 6, cz);
      break;
    }
    default: break;
  }
}
