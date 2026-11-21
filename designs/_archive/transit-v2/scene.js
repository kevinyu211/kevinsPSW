/* Kevin Yu · Transit city
   A low-poly city on white porcelain ground. One elevated line runs from Kevin's first line of code
   through five districts and two interchanges to a terminus that never ends. One train rides it. */
import * as THREE from './vendor/three.module.min.js';

const INK = 0x16171a;
const GROUND = 0xf3f3ef;
const PORCELAIN = 0xffffff;
const TRACK_Y = 3.2;

export function createScene(host, opts) {
  const { stations, reduce, onPick, onProgress, onArrive } = opts;
  const colorOf = (cssVar) => new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim() || '#111111');

  /* ---------- Renderer, camera, light ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'city-canvas';
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(GROUND);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
  const camDir = new THREE.Vector3(1, 1.05, 0.92).normalize();
  const camTarget = new THREE.Vector3();
  let frustum = 30;
  let viewOffsetPx = 0;

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d6cf, 2.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -46; sun.shadow.camera.right = 46;
  sun.shadow.camera.top = 46; sun.shadow.camera.bottom = -46;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 160;
  sun.shadow.bias = -0.0006;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);

  /* ---------- Shared materials ---------- */
  const lambert = (c) => new THREE.MeshLambertMaterial({ color: c });
  const M = {
    ground: lambert(GROUND),
    road: lambert(0xe6e6e1),
    ink: lambert(INK),
    porcelain: lambert(PORCELAIN),
    bone: lambert(0xeeeeea),
    stone: lambert(0xdedfdb),
    glass: new THREE.MeshStandardMaterial({ color: 0xcfe2f4, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88 }),
    dark: lambert(0x2a2d33),
  };
  const lineColor = {
    origin: new THREE.Color(INK), software: colorOf('--l-software'), books: colorOf('--l-books'), film: colorOf('--l-film'),
    games: colorOf('--l-games'), health: colorOf('--l-health'), timetable: new THREE.Color(INK), news: new THREE.Color(INK), terminus: new THREE.Color(INK),
  };
  const lineMat = Object.fromEntries(Object.entries(lineColor).map(([k, c]) => [k, lambert(c)]));
  const glowMat = (c, i = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i) });

  /* ---------- Ground and streets ---------- */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), M.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const streets = new THREE.Group();
  for (let i = -6; i <= 6; i++) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(160, 0.04, 1.4), M.road);
    a.position.set(0, 0.02, i * 13 + 4); a.receiveShadow = true; streets.add(a);
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 160), M.road);
    b.position.set(i * 15 - 4, 0.02, 0); b.receiveShadow = true; streets.add(b);
  }
  scene.add(streets);

  /* ---------- The line ---------- */
  const P = stations.map((s) => new THREE.Vector3(s.x, TRACK_Y, s.z));
  const pre = new THREE.Vector3(stations[0].x - 6, TRACK_Y, stations[0].z + 4);
  const last = stations[stations.length - 1];
  const tail1 = new THREE.Vector3(last.x - 16, TRACK_Y, last.z - 6);
  const tail2 = new THREE.Vector3(last.x - 34, TRACK_Y, last.z - 10);
  const tail3 = new THREE.Vector3(last.x - 56, TRACK_Y, last.z - 13);
  const curve = new THREE.CatmullRomCurve3([pre, ...P, tail1, tail2, tail3], false, 'centripetal');
  const LEN = curve.getLength();

  // u along the curve for each station (closest sample)
  const SAMPLES = 2000;
  const samples = [];
  for (let i = 0; i <= SAMPLES; i++) samples.push(curve.getPointAt(i / SAMPLES));
  const uOf = (v) => { let best = 0; let bd = Infinity; samples.forEach((p, i) => { const d = p.distanceToSquared(v); if (d < bd) { bd = d; best = i; } }); return best / SAMPLES; };
  stations.forEach((s, i) => { s.u = uOf(P[i]); });
  const uTerm = stations[stations.length - 1].u;
  const nearTrack = (x, z, r) => samples.some((p, i) => i % 4 === 0 && (p.x - x) ** 2 + (p.z - z) ** 2 < r * r);

  const subCurve = (u0, u1, n = 60) => {
    const pts = []; for (let i = 0; i <= n; i++) pts.push(curve.getPointAt(u0 + (u1 - u0) * (i / n)));
    return new THREE.CatmullRomCurve3(pts);
  };
  // Beam (solid to the terminus, then fading pieces off the edge of the world)
  const beam = new THREE.Mesh(new THREE.TubeGeometry(subCurve(0, uTerm + 0.01, 300), 600, 0.34, 10, false), M.ink);
  beam.castShadow = true; scene.add(beam);
  for (let k = 0; k < 6; k++) {
    const u0 = uTerm + 0.01 + k * ((1 - uTerm - 0.01) / 6);
    const u1 = u0 + (1 - uTerm - 0.01) / 6;
    const m = new THREE.MeshLambertMaterial({ color: INK, transparent: true, opacity: 0.8 - k * 0.13 });
    const seg = new THREE.Mesh(new THREE.TubeGeometry(subCurve(u0, Math.min(1, u1), 20), 40, 0.34, 8, false), m);
    scene.add(seg);
  }
  // Line-colour stripe on top of the beam, district by district
  for (let i = 0; i < stations.length - 1; i++) {
    const s = stations[i + 1];
    const c = s.kind === 'district' ? lineColor[s.id] : lineColor[stations[i].kind === 'district' ? stations[i].id : 'origin'];
    if (s.kind !== 'district' && stations[i].kind !== 'district') continue;
    const stripe = new THREE.Mesh(new THREE.TubeGeometry(subCurve(stations[i].u, s.u, 40), 120, 0.16, 6, false), lambert(c));
    stripe.position.y = 0.3;
    scene.add(stripe);
  }
  // Sleepers and pillars (instanced)
  const sleeperCount = Math.floor(LEN / 0.7);
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.12, 0.22), new THREE.MeshLambertMaterial({ color: 0xffffff }), sleeperCount);
  const pillarsArr = [];
  const tmpM = new THREE.Matrix4(); const tmpQ = new THREE.Quaternion(); const tmpS = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  const sleeperBase = new THREE.Color(0x3a3c41); const groundC = new THREE.Color(GROUND);
  for (let i = 0; i < sleeperCount; i++) {
    const u = i / sleeperCount;
    const p = curve.getPointAt(u); const t = curve.getTangentAt(u);
    tmpQ.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(t.x, 0, t.z).normalize());
    tmpM.compose(new THREE.Vector3(p.x, p.y + 0.34, p.z), tmpQ, tmpS);
    sleepers.setMatrixAt(i, tmpM);
    const fade = u > uTerm ? Math.min(1, (u - uTerm) / (1 - uTerm)) : 0;
    sleepers.setColorAt(i, sleeperBase.clone().lerp(groundC, fade));
    if (i % 7 === 0 && u < uTerm + 0.04) pillarsArr.push(p);
  }
  sleepers.castShadow = true; scene.add(sleepers);
  const pillars = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.3, TRACK_Y, 8), M.stone, pillarsArr.length);
  pillarsArr.forEach((p, i) => { tmpM.makeTranslation(p.x, TRACK_Y / 2, p.z); pillars.setMatrixAt(i, tmpM); });
  pillars.castShadow = true; scene.add(pillars);
  // Buffer stop before Kevin
  const buf = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.5), lambert(0xf2b705));
  const p0 = curve.getPointAt(0.002); buf.position.set(p0.x, TRACK_Y + 0.7, p0.z);
  buf.lookAt(curve.getPointAt(0.02).setY(TRACK_Y + 0.7)); scene.add(buf);

  /* ---------- Windows: one instanced mesh for every lit square in the city ---------- */
  const win = [];
  const WARM = new THREE.Color(0xffc861); const COOL = new THREE.Color(0xa9d4ff); const OFF = new THREE.Color(0x3b404a);
  const addWindows = (x, z, w, h, d, opt = {}) => {
    const floors = Math.floor((h - 0.8) / 1.1);
    const step = opt.step || 0.95;
    const faces = [{ n: 'z', len: w }, { n: 'x', len: d }];
    faces.forEach((f) => {
      const cols = Math.max(1, Math.floor((f.len - 0.6) / step));
      for (let fl = 0; fl < floors; fl++) for (let c = 0; c < cols; c++) {
        const off = -((cols - 1) * step) / 2 + c * step;
        const y = 0.9 + fl * 1.1;
        const pos = f.n === 'z' ? new THREE.Vector3(x + off, y, z + d / 2 + 0.02) : new THREE.Vector3(x + w / 2 + 0.02, y, z + off);
        const r = Math.random();
        const col = opt.palette ? opt.palette[(fl + c) % opt.palette.length] : r < 0.38 ? WARM : r < 0.52 ? COOL : OFF;
        win.push({ pos, face: f.n, col: col.clone(), base: col.clone(), scale: opt.scale || 1 });
      }
    });
  };
  const box = (x, z, w, h, d, mat, y = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
  };
  const building = (x, z, w, h, d, accent, opt = {}) => {
    box(x, z, w, h, d, opt.mat || (Math.random() < 0.5 ? M.porcelain : M.bone));
    if (accent) box(x, z, w + 0.06, 0.28, d + 0.06, accent, h);
    if (opt.windows !== false) addWindows(x, z, w, h, d, opt);
  };

  /* ---------- Districts: one landmark per line, then a neighbourhood around it ---------- */
  const byId = Object.fromEntries(stations.map((s) => [s.id, s]));
  const side = (s, dist) => {
    const t = curve.getTangentAt(s.u); const n = new THREE.Vector3(-t.z, 0, t.x).normalize();
    return { x: s.x + n.x * dist, z: s.z + n.z * dist, n };
  };
  const anim = []; // per-frame updaters

  // Origin: Kevin's first desk, a small studio with a glowing screen of code
  {
    const s = byId.origin; const { x, z } = side(s, 7);
    box(x, z, 5, 3.2, 4, M.porcelain); box(x, z, 5.1, 0.25, 4.1, M.ink, 3.2);
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160;
    const g = cv.getContext('2d'); g.fillStyle = '#16171a'; g.fillRect(0, 0, 256, 160);
    const cols = ['#5cc8ff', '#f2b705', '#e8e8e8', '#8be28b', '#ff7a6b'];
    for (let r = 0; r < 9; r++) { let cx = 14 + (r % 3) * 12; for (let k = 0; k < 4; k++) { const wdt = 16 + ((r * 7 + k * 13) % 40); g.fillStyle = cols[(r + k) % cols.length]; g.fillRect(cx, 14 + r * 15, wdt, 7); cx += wdt + 8; } }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2), new THREE.MeshBasicMaterial({ map: tex }));
    scr.position.set(x, 1.8, z + 2.03); scene.add(scr);
    addWindows(x, z, 5, 3.2, 4, { step: 1.4 });
  }

  // Software: server towers with blinking status LEDs, plus a glass office
  {
    const s = byId.software; const { x, z } = side(s, 8);
    for (let k = 0; k < 3; k++) {
      const tx = x - 3 + k * 2.2; const tz = z - 3;
      box(tx, tz, 1.6, 6.2, 1.6, M.dark);
      box(tx, tz, 1.66, 0.2, 1.66, lineMat.software, 6.2);
      addWindows(tx, tz, 1.6, 6.2, 1.6, { step: 0.4, scale: 0.32, palette: [new THREE.Color(0x4ade80), lineColor.software, new THREE.Color(0x4ade80), OFF] });
    }
    const o = box(x + 3.5, z + 2.5, 5, 9, 4, M.glass);
    o.castShadow = true;
    box(x + 3.5, z + 2.5, 5.08, 0.35, 4.08, lineMat.software, 9);
    for (let f = 1; f < 9; f += 1.5) box(x + 3.5, z + 2.5, 5.04, 0.08, 4.04, M.porcelain, f);
  }

  // Books & apps: a building of stacked books, and a small library
  {
    const s = byId.books; const { x, z } = side(s, -8);
    const bookCols = [0x5e7a8c, 0xa5584a, 0xc9a65a, 0xc7959c, 0xc27c4e, 0x4e6b5c, 0x6b6a8e];
    let y = 0;
    bookCols.forEach((c, i) => {
      const h = 0.9 + (i % 3) * 0.2;
      const b = box(x + Math.sin(i * 1.7) * 0.5, z + Math.cos(i * 1.3) * 0.4, 5.2 - (i % 2) * 0.6, h, 3.6, lambert(c), y);
      b.rotation.y = (i % 2 ? 1 : -1) * 0.08 * (i % 3);
      box(x + Math.sin(i * 1.7) * 0.5 + 2.62 - (i % 2) * 0.3, z + Math.cos(i * 1.3) * 0.4, 0.06, h * 0.86, 3.4, M.porcelain, y + h * 0.07).rotation.y = b.rotation.y;
      y += h;
    });
    box(x - 6, z + 1, 4.5, 3.4, 4, M.porcelain);
    box(x - 6, z + 1, 4.9, 0.4, 4.4, lineMat.books, 3.4);
    for (let c = 0; c < 4; c++) box(x - 7.6 + c * 1.05, z + 3.1, 0.3, 3.2, 0.3, M.bone);
  }

  // Film & media: a studio with a big screen playing a real Noir Hours loop
  let video = null;
  {
    const s = byId.film; const { x, z } = side(s, 8.5);
    box(x, z, 7, 4.2, 5.5, M.porcelain);
    box(x, z, 7.08, 0.3, 5.58, lineMat.film, 4.2);
    box(x - 2.2, z - 3.6, 0.3, 7.6, 0.3, M.ink); box(x + 2.2, z - 3.6, 0.3, 7.6, 0.3, M.ink);
    video = document.createElement('video');
    video.src = '../../assets/work/noir-loop.mp4'; video.muted = true; video.loop = true; video.playsInline = true; video.crossOrigin = 'anonymous';
    video.setAttribute('aria-hidden', 'true');
    const vt = new THREE.VideoTexture(video); vt.colorSpace = THREE.SRGBColorSpace;
    const frame = box(x, z - 3.5, 6.4, 3.8, 0.3, M.ink, 4.2);
    frame.castShadow = true;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.4), new THREE.MeshBasicMaterial({ map: vt }));
    screen.position.set(x, 6.1, z - 3.33); scene.add(screen);
    addWindows(x, z, 7, 4.2, 5.5, { step: 1.6 });
  }

  // Games: an arcade block with a pixel facade and a controller on the roof
  {
    const s = byId.games; const { x, z } = side(s, -8);
    box(x, z, 6, 4.4, 4.6, M.porcelain);
    box(x, z, 6.08, 0.3, 4.68, lineMat.games, 4.4);
    const pix = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.42, 0.08), new THREE.MeshBasicMaterial(), 48);
    const pcols = [lineColor.games, lineColor.books, lineColor.film, new THREE.Color(0xffffff)];
    let k = 0;
    for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) {
      tmpM.makeTranslation(x - 1.65 + c * 0.47, 1.2 + r * 0.47, z + 2.34);
      pix.setMatrixAt(k, tmpM); pix.setColorAt(k, pcols[(r * 3 + c * 5 + (r * c)) % 4].clone()); k++;
    }
    scene.add(pix);
    anim.push((t) => { if (Math.floor(t * 2) % 2 === 0) return; const i = Math.floor(Math.random() * 48); pix.setColorAt(i, pcols[Math.floor(Math.random() * 4)].clone()); pix.instanceColor.needsUpdate = true; });
    const pad = new THREE.Mesh(new THREE.CapsuleGeometry(0.8, 2.2, 6, 14), M.ink);
    pad.rotation.z = Math.PI / 2; pad.position.set(x, 5.5, z); pad.castShadow = true; scene.add(pad);
    [[-0.9, lineColor.software], [0.6, lineColor.health], [1.1, lineColor.books]].forEach(([dx, c], i) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.25, 12), glowMat(c));
      b.position.set(x + dx, 6.2, z + (i ? 0.2 * (i === 1 ? -1 : 1) : 0)); scene.add(b);
    });
  }

  // Healthcare AI: a clinic with a pill sign and a heart-pulse line
  {
    const s = byId.health; const { x, z } = side(s, 8);
    box(x, z, 6.4, 5.2, 4.6, M.porcelain);
    box(x, z, 6.48, 0.32, 4.68, lineMat.health, 5.2);
    const pill = new THREE.Group();
    const h1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.2, 6, 14), lineMat.health);
    const h2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.56, 0.6, 6, 14), M.porcelain);
    h2.position.y = 0.45; h1.position.y = -0.1;
    pill.add(h1, h2); pill.rotation.z = -0.7; pill.position.set(x, 7.4, z); pill.traverse((m) => { m.castShadow = true; }); scene.add(pill);
    anim.push((t) => { pill.rotation.y = t * 0.6; });
    const pts = [[-2.6, 0], [-1.2, 0], [-0.8, 0.9], [-0.3, -0.9], [0.2, 1.4], [0.7, 0], [2.6, 0]];
    const path = new THREE.CurvePath();
    for (let i = 1; i < pts.length; i++) path.add(new THREE.LineCurve3(new THREE.Vector3(x + pts[i - 1][0], 3.4 + pts[i - 1][1], z + 2.35), new THREE.Vector3(x + pts[i][0], 3.4 + pts[i][1], z + 2.35)));
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(path, 80, 0.09, 6, false), glowMat(lineColor.health, 1.1)));
    addWindows(x, z, 6.4, 2.6, 4.6, { step: 1.2 });
  }

  // Timetable interchange: a clock tower
  {
    const s = byId.timetable; const { x, z } = side(s, 6);
    box(x, z, 2.6, 9, 2.6, M.porcelain); box(x, z, 2.8, 0.3, 2.8, M.ink, 9);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2, 1.6, 4), M.ink); roof.position.set(x, 10.1, z); roof.rotation.y = Math.PI / 4; roof.castShadow = true; scene.add(roof);
    const faces = [];
    [['z', 0], ['x', Math.PI / 2]].forEach(([n, ry]) => {
      const g = new THREE.Group(); g.rotation.y = ry; g.position.set(x, 7.4, z); scene.add(g);
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.95, 32), M.porcelain); face.position.z = 1.32; g.add(face);
      const rim = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.08, 32), M.ink); rim.position.z = 1.33; g.add(rim);
      const hh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.02), M.ink); hh.geometry.translate(0, 0.27, 0); hh.position.z = 1.35; g.add(hh);
      const mh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.02), lineMat.software); mh.geometry.translate(0, 0.4, 0); mh.position.z = 1.36; g.add(mh);
      faces.push({ hh, mh });
    });
    anim.push((t) => faces.forEach((f) => { f.mh.rotation.z = -t * 0.8; f.hh.rotation.z = -t * 0.067; }));
  }

  // News kiosk: a kiosk with a scrolling ticker
  {
    const s = byId.news; const { x, z } = side(s, -6);
    box(x, z, 4, 2.6, 3, M.porcelain);
    for (let i = 0; i < 6; i++) box(x - 1.75 + i * 0.7, z + 1.7, 0.7, 0.18, 0.9, i % 2 ? M.porcelain : M.ink, 2.6);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const g = cv.getContext('2d'); g.fillStyle = '#16171a'; g.fillRect(0, 0, 512, 64);
    g.fillStyle = '#f2b705'; g.font = '700 30px "Public Sans", Arial, sans-serif'; g.textBaseline = 'middle';
    g.fillText('DAILY AI   ·   SERVICE UPDATES   ·   ', 12, 33);
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.repeat.x = 0.6;
    const tick = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.55), new THREE.MeshBasicMaterial({ map: tex }));
    tick.position.set(x, 2.15, z + 1.52); scene.add(tick);
    anim.push((t, dt) => { tex.offset.x += dt * 0.08; });
  }

  // Terminus: an open arch over the line that keeps going
  {
    const s = byId.terminus; const p = curve.getPointAt(Math.min(1, s.u + 0.012)); const t = curve.getTangentAt(s.u);
    const n = new THREE.Vector3(-t.z, 0, t.x).normalize();
    [-1, 1].forEach((sg) => box(p.x + n.x * 2.4 * sg, p.z + n.z * 2.4 * sg, 0.5, 7.4, 0.5, M.ink));
    const bar = box(p.x, p.z, 5.4, 0.9, 0.5, M.ink, 7.4);
    bar.lookAt(new THREE.Vector3(p.x + t.x, 7.85, p.z + t.z)); bar.rotateY(Math.PI / 2);
  }

  // A neighbourhood of quiet buildings around every station, plus scattered blocks
  const rnd = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
  stations.forEach((s) => {
    if (s.kind === 'terminus') return;
    const accent = s.kind === 'district' ? lineMat[s.id] : null;
    for (let k = 0; k < 7; k++) {
      const ang = rnd() * Math.PI * 2; const dist = 9 + rnd() * 9;
      const x = s.x + Math.cos(ang) * dist; const z = s.z + Math.sin(ang) * dist;
      if (nearTrack(x, z, 4.4)) continue;
      const w = 2.4 + rnd() * 2.4; const d = 2.4 + rnd() * 2.4; const h = 2.2 + rnd() * (s.kind === 'district' ? 5.5 : 3.2);
      building(x, z, w, h, d, k % 4 === 1 ? accent : null);
    }
  });
  for (let k = 0; k < 26; k++) {
    const x = -70 + rnd() * 140; const z = -60 + rnd() * 110;
    if (nearTrack(x, z, 6) || stations.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < 140)) continue;
    building(x, z, 2.4 + rnd() * 3, 2 + rnd() * 5, 2.4 + rnd() * 3, null);
  }

  const winMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.36, 0.5), new THREE.MeshBasicMaterial(), win.length);
  const qZ = new THREE.Quaternion(); const qX = new THREE.Quaternion().setFromAxisAngle(up, Math.PI / 2);
  win.forEach((w, i) => {
    tmpM.compose(w.pos, w.face === 'z' ? qZ : qX, new THREE.Vector3(w.scale, w.scale, 1));
    winMesh.setMatrixAt(i, tmpM); winMesh.setColorAt(i, w.col);
  });
  scene.add(winMesh);
  let blinkT = 0;
  win.forEach((w) => { w.on = !w.col.equals(OFF); });
  anim.push((t, dt) => {
    blinkT += dt; if (blinkT < 0.35) return; blinkT = 0;
    for (let k = 0; k < 4; k++) {
      const i = Math.floor(Math.random() * win.length); const w = win[i];
      w.on = !w.on;
      winMesh.setColorAt(i, w.on ? (w.scale < 1 ? w.base : (Math.random() < 0.7 ? WARM : COOL)) : OFF);
    }
    winMesh.instanceColor.needsUpdate = true;
  });

  /* ---------- Stations: platforms, canopies, lamps, signals ---------- */
  const hits = [];
  const lamps = [];
  const rings = [];
  stations.forEach((s, i) => {
    const p = curve.getPointAt(s.u); const t = curve.getTangentAt(s.u);
    const n = new THREE.Vector3(-t.z, 0, t.x).normalize();
    const g = new THREE.Group(); g.position.set(p.x + n.x * 1.7, TRACK_Y - 0.35, p.z + n.z * 1.7);
    g.lookAt(new THREE.Vector3(p.x + n.x * 1.7 + t.x, TRACK_Y - 0.35, p.z + n.z * 1.7 + t.z));
    scene.add(g);
    const plat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 6), M.porcelain); plat.castShadow = true; plat.receiveShadow = true; g.add(plat);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 6), s.kind === 'district' ? lineMat[s.id] : lineMat.books); edge.position.x = -0.68; g.add(edge);
    [-2.4, 2.4].forEach((zz) => { const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), M.ink); post.position.set(0.55, 1.15, zz); g.add(post); });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 6.4), M.porcelain); roof.position.set(0.55, 2.3, 0); roof.castShadow = true; g.add(roof);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.08, 6.42), M.ink); trim.position.set(0.55, 2.2, 0); g.add(trim);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 1.6), s.kind === 'district' ? lineMat[s.id] : M.ink); sign.position.set(-0.6, 1.85, 0); g.add(sign);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xc9c9c3 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), lampMat); lamp.position.set(0.25, 2.1, -2.8); g.add(lamp);
    lamps.push({ mat: lampMat, on: (s.kind === 'district' ? lineColor[s.id] : new THREE.Color(0xffc861)).clone(), lit: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.9, 40), new THREE.MeshBasicMaterial({ color: s.kind === 'district' ? lineColor[s.id] : INK, transparent: true, opacity: 0, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, TRACK_Y + 0.05, p.z); scene.add(ring); rings.push(ring);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(7, 6, 7), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    hit.position.set(p.x, TRACK_Y, p.z); hit.userData.index = i; scene.add(hit); hits.push(hit);
    s.anchor = new THREE.Vector3(p.x + n.x * 3.4, TRACK_Y + 4.4, p.z + n.z * 3.4);
  });
  // Signals along the line
  const signals = [];
  for (let k = 1; k < 9; k++) {
    const u = (k / 9) * uTerm; const p = curve.getPointAt(u); const t = curve.getTangentAt(u);
    const n = new THREE.Vector3(-t.z, 0, t.x).normalize();
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.12), M.ink); post.position.set(p.x - n.x * 0.9, TRACK_Y + 0.7, p.z - n.z * 0.9); scene.add(post);
    const m = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), m); bulb.position.set(post.position.x, TRACK_Y + 1.5, post.position.z); scene.add(bulb);
    signals.push({ m, phase: k * 0.37 });
  }
  anim.push((t) => signals.forEach((s) => { s.m.color.setHex(Math.sin(t * 1.4 + s.phase * 6) > 0.6 ? 0xff4d3d : 0x22c55e); }));

  /* ---------- The train ---------- */
  const train = new THREE.Group();
  const trainBody = new THREE.Group(); train.add(trainBody);
  const bodyM = M.porcelain;
  const carGeo = new THREE.CapsuleGeometry(0.78, 2.6, 8, 18); carGeo.rotateX(Math.PI / 2);
  const cars = [0, -4.3].map((zz) => {
    const car = new THREE.Group(); car.position.z = zz;
    const b = new THREE.Mesh(carGeo, bodyM); b.scale.set(1, 1.05, 1); b.castShadow = true; car.add(b);
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.22, 3.2), new THREE.MeshLambertMaterial({ color: INK })); band.position.y = -0.18; car.add(band);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.3, 3.1), new THREE.MeshLambertMaterial({ color: INK })); stripe.position.y = 0.0; car.add(stripe);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 2.4), new THREE.MeshLambertMaterial({ color: INK })); cap.position.y = 0.86; car.add(cap);
    car.userData.stripe = stripe;
    for (let w = 0; w < 4; w++) [-1, 1].forEach((sg) => {
      const wm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.5), new THREE.MeshBasicMaterial({ color: 0x1e2a3a }));
      wm.position.set(0.79 * sg, 0.35, -1.2 + w * 0.8); car.add(wm);
    });
    [-1.1, 1.1].forEach((wz) => [-1, 1].forEach((sg) => {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.16, 14), M.ink); wh.rotation.z = Math.PI / 2; wh.position.set(0.62 * sg, -0.82, wz); car.add(wh);
      (car.userData.wheels ||= []).push(wh);
    }));
    trainBody.add(car); return car;
  });
  const front = cars[0];
  const wind = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.2), new THREE.MeshBasicMaterial({ color: 0x1e2a3a })); wind.position.set(0, 0.35, 2.02); front.add(wind);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), new THREE.MeshBasicMaterial({ color: 0xfff3c4 })); head.position.set(0, -0.15, 2.12); front.add(head);
  const headGlow = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24), new THREE.MeshBasicMaterial({ color: 0xffe9a3, transparent: true, opacity: 0.35, depthWrite: false }));
  headGlow.position.set(0, -0.15, 2.2); front.add(headGlow);
  const lightBeam = new THREE.PointLight(0xffe9a3, 6, 9, 2); lightBeam.position.set(0, 0.2, 3.2); front.add(lightBeam);
  // Doors on the platform side of the front car
  const doors = [-0.32, 0.32].map((dz) => { const d = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.6), M.ink); d.position.set(0.8, 0.05, dz + 0.1); front.add(d); return { d, base: dz + 0.1, dir: Math.sign(dz) }; });
  train.scale.setScalar(1.22);
  scene.add(train);

  /* ---------- Train motion ---------- */
  let u = stations[0].u;
  let tween = null;
  let doorOpen = 0;
  let ringT = -1; let ringIdx = 0;
  const placeTrain = () => {
    const pos = curve.getPointAt(u); const ahead = curve.getPointAt(Math.min(1, u + 0.002));
    train.position.set(pos.x, TRACK_Y + 1.5, pos.z);
    train.lookAt(ahead.x, TRACK_Y + 1.5, ahead.z);
  };
  placeTrain();
  camTarget.copy(train.position);

  const stationFloat = (uu) => {
    for (let i = 1; i < stations.length; i++) {
      if (uu <= stations[i].u) return i - 1 + (uu - stations[i - 1].u) / (stations[i].u - stations[i - 1].u);
    }
    return stations.length - 1;
  };
  const setStripe = (id) => cars.forEach((c) => c.userData.stripe.material.color.copy(lineColor[id] || new THREE.Color(INK)));
  const light = (i) => { const l = lamps[i]; if (!l || l.lit) return; l.lit = true; l.mat.color.copy(l.on); };

  function goTo(index, { instant = false } = {}) {
    const target = stations[index];
    return new Promise((resolve) => {
      if (tween) tween.kill();
      const from = u;
      const finish = () => {
        u = target.u; placeTrain(); light(index);
        setStripe(target.kind === 'district' ? target.id : 'origin');
        doorOpen = 1; ringT = 0; ringIdx = index;
        onProgress && onProgress(index);
        onArrive && onArrive(index);
        resolve();
      };
      doorOpen = 0;
      if (instant || reduce || Math.abs(target.u - from) < 1e-4 || !window.gsap) {
        finish();
        if (instant || reduce) camTarget.copy(train.position);
        return;
      }
      const dist = Math.abs(target.u - from) * LEN;
      const o = { u: from };
      let prevU = from;
      tween = window.gsap.to(o, {
        u: target.u, duration: Math.min(5, Math.max(1.3, dist / 16)), ease: 'power2.inOut',
        onUpdate: () => {
          u = o.u; placeTrain();
          const dd = (u - prevU) * LEN; prevU = u;
          cars.forEach((c) => c.userData.wheels.forEach((w) => { w.rotation.x += dd / 0.26; }));
          const f = stationFloat(u);
          onProgress && onProgress(f);
          stations.forEach((s, i) => { if ((from < target.u && s.u <= u + 1e-4) || (from > target.u && s.u >= u - 1e-4)) light(i); });
          const near = stations.reduce((a, s) => (Math.abs(s.u - u) < Math.abs(a.u - u) ? s : a));
          if (near.kind === 'district') setStripe(near.id);
        },
        onComplete: finish,
      });
    });
  }

  /* ---------- Picking ---------- */
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(hits, false)[0];
    if (hit) onPick && onPick(hit.object.userData.index);
  });
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    canvas.style.cursor = ray.intersectObjects(hits, false).length ? 'pointer' : '';
  });

  /* ---------- Labels: crisp HTML tags pinned to 3D stations ---------- */
  const tagLayer = document.createElement('div'); tagLayer.className = 'tags'; tagLayer.setAttribute('aria-hidden', 'true'); host.appendChild(tagLayer);
  const tags = stations.map((s) => {
    const t = document.createElement('div'); t.className = `tag tag-${s.kind}`; t.dataset.line = s.id;
    const b = document.createElement('i'); b.className = `bullet b-${s.kind === 'district' ? s.id : 'ink'}`; b.textContent = s.letter;
    const n = document.createElement('span'); n.textContent = s.name;
    t.append(b, n);
    if (s.sign) { const sg = document.createElement('em'); sg.textContent = s.sign; t.append(sg); }
    tagLayer.append(t); return t;
  });
  const v3 = new THREE.Vector3();

  /* ---------- Size, view offset, loop ---------- */
  let W = 1; let H = 1;
  function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    frustum = W < 700 ? 34 : 46;
    const aspect = W / H;
    camera.left = (-frustum * aspect) / 2; camera.right = (frustum * aspect) / 2;
    camera.top = frustum / 2; camera.bottom = -frustum / 2;
    if (viewOffsetPx) camera.setViewOffset(W + viewOffsetPx, H, viewOffsetPx, 0, W, H);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  function setViewOffset(px) { viewOffsetPx = Math.max(0, px | 0); resize(); }

  let running = true; let visible = true; let raf = 0; let lastT = performance.now(); let clock = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!running || !visible || document.hidden) { lastT = now; return; }
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; clock += dt;
    // camera follows the train with a soft lag
    const k = reduce ? 1 : 1 - Math.exp(-dt * 3.2);
    camTarget.lerp(train.position, k);
    camera.position.copy(camTarget).addScaledVector(camDir, 90);
    camera.lookAt(camTarget);
    sun.position.copy(camTarget).add(new THREE.Vector3(26, 46, 18)); sun.target.position.copy(camTarget);
    // doors and arrival ring
    doors.forEach((d) => { d.d.position.z += ((d.base + d.dir * 0.42 * doorOpen) - d.d.position.z) * Math.min(1, dt * 6); });
    if (ringT >= 0) {
      ringT += dt; const r = rings[ringIdx];
      const p = Math.min(1, ringT / 1.1);
      r.scale.setScalar(1 + p * 5); r.material.opacity = (1 - p) * 0.7;
      if (p >= 1) { ringT = -1; r.material.opacity = 0; }
    }
    headGlow.material.opacity = 0.28 + Math.sin(clock * 3) * 0.06;
    if (!reduce) anim.forEach((f) => f(clock, dt));
    renderer.render(scene, camera);
    // labels
    stations.forEach((s, i) => {
      v3.copy(s.anchor).project(camera);
      const x = (v3.x * 0.5 + 0.5) * W; const y = (-v3.y * 0.5 + 0.5) * H;
      const off = x < -80 || x > W + 80 || y < -40 || y > H + 40;
      tags[i].style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      tags[i].style.visibility = off ? 'hidden' : 'visible';
    });
  }
  resize();
  raf = requestAnimationFrame(frame);
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (video) (visible && !reduce ? video.play().catch(() => {}) : video.pause()); }, { threshold: 0 }).observe(host);
  if (video && !reduce) video.play().catch(() => {});
  addEventListener('resize', resize);

  return {
    goTo, resize, setViewOffset,
    highlight(i) { tags.forEach((t, k) => t.classList.toggle('is-current', k === i)); },
    pause() { running = false; }, resume() { running = true; },
  };
}
