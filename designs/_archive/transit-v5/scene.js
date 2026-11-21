/* Kevin Metro · engine
   Golden-hour light, an orthographic camera you can pan, turn, tilt and zoom like a globe viewer, the city,
   six metro lines and a train on each. The canvas is decoration (aria-hidden); every action also exists as an
   HTML control. In Map mode the camera tilts to straight down, the city goes quiet and the lines are drawn
   over it like a metro map. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { buildNetwork, MAP_SIDE } from './network.js';
import { buildCity, buildLines, makeMaterials, TRAIN_LAT, BOUNDS } from './world.js';
import { LANDMARKS, SignAtlas, PhotoAtlas } from './landmarks.js';
import { buildTrain, buildFleet, placeTrain, setDoors, destSignTexture, CAR_LEN, CAR_GAP, DOORS } from './train.js';

const STOP = 41.5; // the head stops 41.5 m past the station centre, so the 83 m train sits centred
const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const easeSoft = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

export function createCity(host, opts) {
  const { reduce, isPhone, destinations, onPick, onProgress, onArrive, onHover, onFree, onMode } = opts;
  const lowEnd = isPhone || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const renderer = new THREE.WebGLRenderer({ antialias: !lowEnd, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(lowEnd ? 1.25 : 1.75, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = !lowEnd;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.info.autoReset = false;
  const canvas = renderer.domElement; canvas.className = 'city-canvas'; canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const HAZE = new THREE.Color(0xdde3e4);
  scene.background = HAZE;
  scene.fog = new THREE.Fog(HAZE, 2100, 3200);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;
  // golden hour: a warm low sun from the south-west, a cool sky fill, a warm bounce from the ground
  const hemi = new THREE.HemisphereLight(0xdbe6f2, 0xc2a682, 1.1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd6a6, 3.3);
  sun.castShadow = !lowEnd; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6; sun.shadow.radius = 3;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 1900;
  scene.add(sun, sun.target);
  const sunDir = new THREE.Vector3(-0.55, 0.58, 0.6).normalize();

  /* ---------- the world ---------- */
  const net = buildNetwork();
  const M = makeMaterials(0x0039a6);
  const landmarks = LANDMARKS.map((l) => ({ ...l }));
  const atlas = new SignAtlas(); const photos = new PhotoAtlas();
  const city = buildCity({ scene, M, net, isPhone: lowEnd, landmarks, atlas, photos });
  const doorS = (ps) => { const out = []; for (let k = 0; k < 4; k++) { const sc = ps.s + STOP - CAR_LEN / 2 - k * (CAR_LEN + CAR_GAP); DOORS.forEach((d) => out.push(sc + d)); } return out; };
  const rails = buildLines({ M, net, pierOK: city.pierOK, onRoad: city.onRoad, batch: city.batch, doorS, atlas });
  city.batch.build(scene);
  atlas.build(scene); photos.build(scene);
  const anim = [...city.anim];
  const screens = landmarks.flatMap((l) => l.screens || []);

  // platform screen doors on every platform, one instanced mesh
  const platforms = net.lines.flatMap((l) => l.stations);
  const psdLeaves = []; const psdMat = new THREE.MeshStandardMaterial({ color: 0xbfd6e2, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.45 });
  const psd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 2.1, 0.7), psdMat, platforms.length * 32);
  let pi = 0; const m4 = new THREE.Matrix4(); const qq = new THREE.Quaternion(); const yAx = new THREE.Vector3(0, 1, 0); const ONE = new THREE.Vector3(1, 1, 1);
  platforms.forEach((ps) => {
    ps.leaves = [];
    doorS(ps).forEach((s) => [-1, 1].forEach((half) => {
      const a = ps.line.at(s); const p = a.p.clone().add(a.n.clone().multiplyScalar(Math.sign(TRAIN_LAT) * 3.3)); p.y += 1.1 + 1.05;
      qq.setFromAxisAngle(yAx, Math.atan2(a.t.x, a.t.z));
      const lf = { p, t: a.t.clone(), half, idx: pi, q: qq.clone() }; ps.leaves.push(lf);
      m4.compose(p.clone().addScaledVector(a.t, half * 0.36), qq, ONE); psd.setMatrixAt(pi, m4); pi++;
    }));
  });
  psd.computeBoundingSphere(); scene.add(psd);
  const setPSD = (ps, amount) => { if (!ps) return; ps.leaves.forEach((l) => { m4.compose(l.p.clone().addScaledVector(l.t, l.half * (0.36 + 0.66 * amount)), l.q, ONE); psd.setMatrixAt(l.idx, m4); }); psd.instanceMatrix.needsUpdate = true; };
  scene.traverse((o) => { if (!o.matrixAutoUpdate) o.matrixWorldNeedsUpdate = true; });

  /* ---------- the map layer: thick coloured strokes with a white casing, station roundels, all drawn on top ---------- */
  const mapU = { uW: { value: 14 }, uOp: { value: 0 } };
  const mkRibbon = (white, wScale) => {
    const pos = []; const nrm = []; const side = []; const colr = []; const idx = []; let base = 0;
    net.lines.forEach((l) => {
      const pts = l.samples.filter((_, i) => i % 2 === 0).map(([x, z]) => [x, z]);
      if (l.closed) pts.push(pts[0]);
      if (['2', '3', '4', '5'].includes(l.id)) pts.unshift([0, 0]); // the spokes meet at Kevin Square on the map
      const c = new THREE.Color(white ? 0xffffff : l.def.hex);
      pts.forEach(([x, z], i) => {
        const a = pts[Math.max(0, i - 1)]; const b = pts[Math.min(pts.length - 1, i + 1)];
        let tx = b[0] - a[0]; let tz = b[1] - a[1]; const len = Math.hypot(tx, tz) || 1; tx /= len; tz /= len;
        [-1, 1].forEach((sg) => { pos.push(x, 0, z); nrm.push(tz, 0, -tx); side.push(sg); colr.push(c.r, c.g, c.b); });
        if (i < pts.length - 1) { const k = base + i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      });
      base += pts.length * 2;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aN', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1)); g.setAttribute('aCol', new THREE.Float32BufferAttribute(colr, 3)); g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({ uniforms: { uW: mapU.uW, uOp: mapU.uOp, uS: { value: wScale } }, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: 'attribute vec3 aN; attribute float aSide; attribute vec3 aCol; uniform float uW; uniform float uS; varying vec3 vCol; void main(){ vec3 p = position + aN * aSide * uW * uS * 0.5; vCol = aCol; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'uniform float uOp; varying vec3 vCol; void main(){ gl_FragColor = vec4(vCol, uOp);\n#include <colorspace_fragment>\n}' });
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = white ? 20 : 21; m.visible = false; scene.add(m); return m;
  };
  const casing = mkRibbon(true, 1.55); const ribbon = mkRibbon(false, 1);
  const nodes = net.stations.map((st) => {
    const ps = Object.entries(st.at).map(([, p]) => p); const x = st.id === 'kevin' ? 0 : ps.reduce((a, p) => a + p[0], 0) / ps.length; const z = st.id === 'kevin' ? 0 : ps.reduce((a, p) => a + p[1], 0) / ps.length;
    return { st, x, z, inter: st.lines.length > 1, hex: net.byId[st.lines[0]].def.hex };
  });
  const discGeo = new THREE.CircleGeometry(1, 32); discGeo.rotateX(-Math.PI / 2);
  const ringGeo = new THREE.RingGeometry(0.72, 1, 32); ringGeo.rotateX(-Math.PI / 2);
  const mkDots = (geo, order) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, opacity: 0 }), nodes.length); m.frustumCulled = false; m.renderOrder = order; m.visible = false; scene.add(m); return m; };
  const dotFill = mkDots(discGeo, 22); const dotRing = mkDots(ringGeo, 23);
  const cc = new THREE.Color();
  nodes.forEach((nd, i) => { dotFill.setColorAt(i, cc.setHex(0xffffff)); dotRing.setColorAt(i, cc.setHex(nd.inter ? 0x16171a : nd.hex)); });
  const placeDots = (F) => {
    nodes.forEach((nd, i) => { const r = Math.max(4, F * (nd.st.id === 'kevin' ? 0.017 : nd.inter ? 0.0115 : 0.0085)); m4.compose(new THREE.Vector3(nd.x, 0, nd.z), new THREE.Quaternion(), new THREE.Vector3(r, 1, r)); dotFill.setMatrixAt(i, m4); dotRing.setMatrixAt(i, m4); });
    dotFill.instanceMatrix.needsUpdate = true; dotRing.instanceMatrix.needsUpdate = true;
  };
  let mapAmt = 0; let mapGoal = 0;

  /* ---------- trains: a detailed one on the focus line, a light instanced fleet everywhere else ---------- */
  const fleet = buildFleet(net.lines); fleet.meshes.forEach((m) => scene.add(m));
  const train = buildTrain({ lineHex: net.lines[0].def.hex, cars: 4, platformSide: Math.sign(-TRAIN_LAT) });
  scene.add(train.group);
  const T = net.lines.map((line, li) => {
    const n = line.stations.length; const start = line.id === '1' ? line.stations.findIndex((p) => p.id === 'kevin') : (li * 2) % n;
    const dir = 1; const ps = line.stations[start];
    return { line, li, cur: start, dir, sHead: ps.s + dir * STOP, motion: null, dwell: 2 + li * 1.7, doorAmt: 0, doorGoal: 0, ends: null };
  });
  let focus = T[1];
  const setSign = (text) => train.cars.forEach((c) => { if (c.sign) { c.sign.material.map.dispose(); c.sign.material.map = destSignTexture(text); c.sign.material.needsUpdate = true; } });
  const placeAll = () => { T.forEach((t) => { if (t === focus) t.ends = placeTrain(train, t.line, t.sHead, TRAIN_LAT, t.dir); else fleet.place(t.li, t.line, t.sHead, TRAIN_LAT, t.dir, false); }); fleet.place(focus.li, focus.line, focus.sHead, TRAIN_LAT, focus.dir, true); fleet.flush(); };
  const setFocus = (t) => {
    if (focus === t) return; setPSD(focus.line.stations[focus.cur], 0); focus.doorAmt = 0; focus.doorGoal = 0;
    focus = t; train.setLine(t.line.def.hex); setDoors(train, 1, 0); placeAll();
  };
  train.setLine(focus.line.def.hex); placeAll();
  const trainMid = (t = focus) => { if (t === focus && t.ends) { const m = new THREE.Vector3(); t.ends.forEach((e) => m.add(e.mid)); return m.multiplyScalar(1 / t.ends.length); } return t.line.trackPoint(t.sHead - t.dir * 41.5, TRAIN_LAT); };
  const fracOf = (t) => { // position as a fractional station index along the line, for the line strip
    const S = t.line.stations; const n = S.length; const p = t.line.wrap(t.sHead - t.dir * STOP);
    if (t.line.closed) { let i = n - 1; for (let k = 0; k < n; k++) if (S[k].s <= p) i = k; const gap = t.line.wrap(S[(i + 1) % n].s - S[i].s) || t.line.L; return (i + t.line.wrap(p - S[i].s) / gap) % n; }
    if (p <= S[0].s) return 0; if (p >= S[n - 1].s) return n - 1;
    let i = 0; for (let k = 0; k < n - 1; k++) if (S[k].s <= p) i = k; return i + (p - S[i].s) / (S[i + 1].s - S[i].s);
  };
  const fade = document.createElement('div'); fade.className = 'ride-cut'; fade.setAttribute('aria-hidden', 'true'); host.appendChild(fade);

  // drive one line's train to a station: forward round the Circle, either way on the other lines
  function drive(t, idx, { instant = false, cruise = false } = {}) {
    const line = t.line; const ps = line.stations[idx];
    return new Promise((resolve) => {
      if (t.motion) { t.motion.cancel = true; t.motion.resolve(false); t.motion = null; }
      if (t === focus) setPSD(line.stations[t.cur], 0);
      if (!line.closed && idx !== t.cur) { const nd = ps.s > line.stations[t.cur].s ? 1 : -1; if (nd !== t.dir && !t.motion) { const curPs = line.stations[t.cur]; t.dir = nd; t.sHead = curPs.s + nd * STOP; } }
      const sT0 = ps.s + t.dir * STOP;
      const D = line.closed ? line.wrap(sT0 - t.sHead) : Math.abs(sT0 - t.sHead);
      const sT = line.closed ? t.sHead + (D < 0.5 ? 0 : D) : sT0;
      const arrive = () => {
        t.sHead = sT; t.cur = idx; t.motion = null; t.dwell = cruise ? 6 + Math.random() * 3 : 9; t.doorGoal = 1;
        if (t === focus) { t.ends = placeTrain(train, line, t.sHead, TRAIN_LAT, t.dir); onProgress && onProgress(line.id, idx); onArrive && onArrive(line.id, ps.id, { cruise }); }
        else { fleet.place(t.li, line, t.sHead, TRAIN_LAT, t.dir, false); fleet.flush(); }
        resolve(true);
      };
      if (t === focus) setSign(`${line.def.no}  ${ps.st.name}`);
      if (instant || reduce || D < 0.5) { t.doorAmt = t === focus && reduce ? 1 : 0; arrive(); if (t === focus && (instant || reduce)) { target.copy(trainMid()).setY(0); targetGoal.copy(target); } return; }
      const from = t.sHead; const long = !cruise && D > 950;
      const r = { cancel: false, cruise, resolve };
      t.motion = r; t.doorGoal = 0;
      const sgn = Math.sign(sT - from);
      const legs = long ? [[from, from + sgn * 260, 'in'], [sT - sgn * 300, sT, 'out']] : [[from, sT, 'both']];
      const durOf = (len, kind) => (cruise ? 9 + len / 38 : kind === 'both' ? Math.min(11, Math.max(5.5, 4.2 + len / 85)) : 5.2);
      let leg = 0; let t0 = -1;
      r.step = (now) => {
        if (r.cancel) return;
        if (t === focus && t.doorAmt > 0.02) return;
        if (t0 < 0) t0 = now;
        const [a, b, kind] = legs[leg]; const dur = durOf(Math.abs(b - a), kind);
        const p = Math.min(1, (now - t0) / dur);
        const e = kind === 'both' ? (cruise ? easeSoft(p) : ease(p)) : kind === 'in' ? p * p : 1 - (1 - p) * (1 - p);
        t.sHead = a + (b - a) * e;
        if (t === focus) { t.ends = placeTrain(train, line, t.sHead, TRAIN_LAT, t.dir); onProgress && onProgress(line.id, fracOf(t)); } else fleet.place(t.li, line, t.sHead, TRAIN_LAT, t.dir, false);
        if (p >= 1) {
          if (leg < legs.length - 1) {
            leg++; t0 = -1;
            if (t === focus) { fade.classList.add('is-on'); setTimeout(() => { if (r.cancel) return; t.sHead = legs[leg][0]; t.ends = placeTrain(train, line, t.sHead, TRAIN_LAT, t.dir); target.copy(trainMid()).setY(0); fade.classList.remove('is-on'); }, 450); r.pauseUntil = now + 0.9; }
            else t.sHead = legs[leg][0];
          } else arrive();
        }
      };
      r.skip = () => { r.cancel = true; arrive(); target.copy(trainMid()).setY(0); };
    });
  }

  /* ---------- the camera: target on the ground, azimuth, elevation, zoom ---------- */
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 400, 3400);
  const CAM_DIST = 1800;
  const target = new THREE.Vector3(); const targetGoal = new THREE.Vector3();
  const OV = isPhone ? { th: 1.22, ph: 0.92 } : { th: 0.42, ph: 0.84 };
  let th = OV.th; let ph = OV.ph; let thG = th; let phG = ph;
  let F = isPhone ? 1500 : 1100; let Fgoal = F;
  const F_MIN = 40; const F_MAX = isPhone ? 2600 : 1800;
  let camMode = 'overview'; let followTrain = false; let userOrbit = false;
  const dirOf = (t, p) => new THREE.Vector3(Math.cos(p) * Math.sin(t), Math.sin(p), Math.cos(p) * Math.cos(t));
  const placeCam = (cam, tgt, t, p) => {
    const d = dirOf(t, p); cam.position.copy(tgt).addScaledVector(d, CAM_DIST);
    const right = new THREE.Vector3(Math.cos(t), 0, -Math.sin(t)); const fwd = d.clone().negate(); cam.up.copy(new THREE.Vector3().crossVectors(right, fwd).normalize());
    cam.lookAt(tgt); cam.updateMatrixWorld();
  };
  const placeCamera = () => placeCam(camera, target, th, ph);
  let W = 1; let H = 1; let offX = 0; let offSide = 1;
  function applyFrustum() {
    const aspect = W / H;
    camera.left = (-F * aspect) / 2; camera.right = (F * aspect) / 2; camera.top = F / 2; camera.bottom = -F / 2;
    if (offX) camera.setViewOffset(W + offX, H, offSide > 0 ? offX : 0, 0, W, H); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    const sh = Math.min(640, Math.max(140, F * 0.62 * Math.max(1, aspect)));
    const sc = sun.shadow.camera; if (Math.abs(sc.right - sh) > 4) { sc.left = -sh; sc.right = sh; sc.top = sh; sc.bottom = -sh; sc.updateProjectionMatrix(); renderer.shadowMap.needsUpdate = true; }
  }
  function resize() { const r = host.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); renderer.setSize(W, H, false); canvas.style.width = `${W}px`; canvas.style.height = `${H}px`; applyFrustum(); if (camMode === 'overview' || camMode === 'map') { const o = fit(thG, phG, camMode === 'map'); Fgoal = o.F; targetGoal.copy(o.target); } labelItems.forEach((it) => { it.w = 0; }); }
  // fit the city (or the whole network map) into the stage, leaving room for the bottom UI
  function fit(t, p, whole) {
    const tmp = new THREE.OrthographicCamera(); placeCam(tmp, new THREE.Vector3(), t, p);
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity; const q = new THREE.Vector3();
    const bx = whole ? 790 : 690; const bz = whole ? 545 : 470;
    [-bx, bx].forEach((x) => [-bz, bz].forEach((z) => [0, whole ? 0 : 40].forEach((y) => { q.set(x, y, z).applyMatrix4(tmp.matrixWorldInverse); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); })));
    const inset = isPhone ? 78 : 70; const Hf = Math.max(1, H - inset);
    const Fv = Math.max((y1 - y0) * (H / Hf), ((x1 - x0) / W) * H) * (whole ? (isPhone ? 1.32 : 1.03) : 0.98);
    const cy = (y0 + y1) / 2 - (inset / 2) * (Fv / H);
    const pt = new THREE.Vector3((x0 + x1) / 2, cy, -CAM_DIST).applyMatrix4(tmp.matrixWorld); const d = dirOf(t, p);
    pt.addScaledVector(d, -pt.y / d.y);
    return { F: Fv, target: pt.setY(0) };
  }
  function setViewOffset(px, side = 'right') { offX = Math.max(0, px | 0); offSide = side === 'left' ? -1 : 1; applyFrustum(); }

  /* ---------- labels: stations and headquarters, crisp HTML pinned to the world ---------- */
  const tags = document.createElement('div'); tags.className = 'tags'; tags.setAttribute('aria-hidden', 'true'); host.appendChild(tags);
  const labelItems = [];
  nodes.forEach((nd) => {
    const st = nd.st; const el = document.createElement('button'); el.type = 'button'; el.tabIndex = -1; el.className = 'tag tag-st'; el.dataset.id = st.id; el.dataset.side = (isPhone && { party: 'above', studio: 'above', kevin: 'right', university: 'below-right', oldtown: 'below' }[st.id]) || MAP_SIDE[st.id] || 'right';
    const chips = document.createElement('span'); chips.className = 'tag-lines';
    st.lines.forEach((lid) => { const d = net.byId[lid].def; const i = document.createElement('i'); i.textContent = d.no; i.style.background = d.css; if (lid === '2') i.style.color = '#16171a'; chips.append(i); });
    const n = document.createElement('span'); n.className = 'tag-name'; n.textContent = st.name;
    el.append(chips, n);
    el.addEventListener('click', () => onPick && onPick({ type: 'station', id: st.id }));
    tags.append(el);
    const y = Math.max(...st.lines.map((l) => net.byId[l].Y)) + 9;
    labelItems.push({ el, pos: new THREE.Vector3(nd.x, y, nd.z), map: new THREE.Vector3(nd.x, 0, nd.z), kind: 'st', id: st.id });
  });
  const lmById = Object.fromEntries(landmarks.map((l) => [l.id, l]));
  destinations.forEach((d) => {
    const lm = lmById[d.landmark]; if (!lm || !lm.focus) return;
    d.focus = lm.focus.clone(); d.hit = lm.hit;
    const el = document.createElement('button'); el.type = 'button'; el.tabIndex = -1; el.className = 'tag tag-dest';
    const dot = document.createElement('i'); dot.className = 'dot'; dot.style.background = d.css || '#16171a';
    const n = document.createElement('span'); n.textContent = d.short || d.name;
    el.append(dot, n);
    el.addEventListener('click', () => onPick && onPick({ type: 'dest', id: d.id }));
    tags.append(el);
    labelItems.push({ el, pos: new THREE.Vector3(lm.hit.center.x, lm.hit.size.y + 6, lm.hit.center.z), kind: 'dest', id: d.id });
  });
  const v = new THREE.Vector3();

  /* ---------- hover and click ---------- */
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const proxies = [];
  destinations.forEach((d) => { if (!d.hit) return; const h = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), hitMat); h.position.copy(d.hit.center); h.scale.copy(d.hit.size); h.userData.pick = { type: 'dest', id: d.id }; h.updateMatrixWorld(); proxies.push(h); });
  platforms.forEach((ps) => { const a = ps.line.at(ps.s); const h = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), hitMat); h.position.copy(a.p).setY(a.p.y + 2); h.rotation.y = Math.atan2(a.t.x, a.t.z); h.scale.set(16, 12, 92); h.userData.pick = { type: 'station', id: ps.id }; h.updateMatrixWorld(); proxies.push(h); });
  const trainProxy = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), hitMat); trainProxy.scale.set(5, 6, 86); trainProxy.userData.pick = { type: 'train' }; proxies.push(trainProxy);
  const hl = new THREE.Group(); hl.visible = false; scene.add(hl);
  const hlFill = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x0039a6, transparent: true, opacity: 0.12, depthWrite: false }));
  const hlEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false }));
  hlEdge.renderOrder = 10; hl.add(hlFill, hlEdge);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 64), new THREE.MeshBasicMaterial({ color: 0x0039a6, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; ring.renderOrder = 3; scene.add(ring);
  let hoverObj = null; let dragging = false;
  const showHL = (obj) => {
    hoverObj = obj; hl.visible = !!obj && mapAmt < 0.5; ring.visible = !!obj && mapAmt < 0.5;
    canvas.style.cursor = obj ? 'pointer' : (dragging ? 'grabbing' : 'grab');
    if (!obj) return;
    const pk = obj.userData.pick; const col = pk.type === 'station' ? net.byId[platforms.find((p) => p.id === pk.id)?.line.id || 'c'].def.hex : 0x0039a6;
    hlFill.material.color.setHex(col); ring.material.color.setHex(col);
    hl.position.copy(obj.position); hl.quaternion.copy(obj.quaternion); hl.scale.copy(obj.scale).multiplyScalar(1.04);
    ring.position.set(obj.position.x, 0.6, obj.position.z); const rr = Math.hypot(obj.scale.x, obj.scale.z) * 0.5 + 4; ring.scale.set(rr, rr, rr);
  };
  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  pulse.rotation.x = -Math.PI / 2; pulse.visible = false; scene.add(pulse);
  let pulseT = 1; const pulseAt = new THREE.Vector3();
  const bubble = document.createElement('span'); bubble.className = 'bubble'; bubble.setAttribute('aria-hidden', 'true'); host.appendChild(bubble);
  let bubbleT = 1; const bubblePos = new THREE.Vector3();
  const say = (text, pos) => { bubble.textContent = text; bubblePos.copy(pos); bubbleT = 0; };

  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  const setNdc = (cx, cy) => { const r = canvas.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); };
  const groundAt = (cx, cy) => { setNdc(cx, cy); ray.setFromCamera(ndc, camera); const t = -ray.ray.origin.y / ray.ray.direction.y; return ray.ray.origin.clone().addScaledVector(ray.ray.direction, t); };
  let pointer = null; let hoverDirty = false;
  const pickProxy = () => { ray.setFromCamera(ndc, camera); const hit = ray.intersectObjects(proxies, false)[0]; return hit ? hit.object : null; };

  /* ---------- input: drag to pan, right-drag or two fingers to turn and tilt, wheel or pinch to zoom ---------- */
  const pts = new Map(); let downAt = null; let grab = null; let pinch = null; let rot = null; const vel = new THREE.Vector3(); let lastPan = 0;
  const clampTarget = (t) => { t.x = Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, t.x)); t.z = Math.max(BOUNDS.z0, Math.min(BOUNDS.z1, t.z)); };
  const goFree = () => { if (camMode !== 'free') { camMode = 'free'; followTrain = false; onFree && onFree(true); } };
  const orbit = (dx, dy) => {
    thG -= dx * 0.0062; phG = Math.max(0.3, Math.min(1.553, phG + dy * 0.0048)); userOrbit = true;
    if (!followTrain) goFree();
    if (mapGoal > 0 && phG < 1.3) { mapGoal = 0; onMode && onMode('3d'); }
  };
  const zoomAt = (factor, cx, cy) => {
    const nf = Math.max(F_MIN, Math.min(F_MAX, F * factor)); if (Math.abs(nf - F) < 0.01) return;
    if (followTrain) { F = nf; Fgoal = nf; applyFrustum(); return; }
    const before = groundAt(cx, cy); F = nf; Fgoal = nf; applyFrustum(); placeCamera();
    const after = groundAt(cx, cy); target.add(before.sub(after)).setY(0); clampTarget(target); targetGoal.copy(target); placeCamera();
    if (camMode === 'overview') goFree();
  };
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); vel.set(0, 0, 0);
    if (pts.size === 1) { downAt = [e.clientX, e.clientY]; dragging = false; rot = (e.button === 2 || e.shiftKey || e.ctrlKey || e.altKey) ? [e.clientX, e.clientY] : null; grab = rot ? null : groundAt(e.clientX, e.clientY); }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), F, ang: Math.atan2(b[1] - a[1], b[0] - a[0]), my: (a[1] + b[1]) / 2 }; dragging = true; grab = null; }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) { pointer = [e.clientX, e.clientY]; hoverDirty = true; return; }
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); const my = (a[1] + b[1]) / 2;
      zoomAt((pinch.F * (pinch.d / Math.max(20, d))) / F, (a[0] + b[0]) / 2, my);
      orbit(-angDiff(pinch.ang, ang) / 0.0062 * 0.8, (my - pinch.my) * 1.2); pinch.ang = ang; pinch.my = my; return;
    }
    if (!downAt) return;
    if (!dragging && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) { dragging = true; showHL(null); onHover && onHover(null); canvas.style.cursor = 'grabbing'; if (!rot) goFree(); }
    if (!dragging) return;
    if (rot) { orbit(e.clientX - rot[0], e.clientY - rot[1]); rot = [e.clientX, e.clientY]; return; }
    if (grab) { const now = groundAt(e.clientX, e.clientY); const dlt = grab.clone().sub(now).setY(0); target.add(dlt); clampTarget(target); targetGoal.copy(target); placeCamera(); const tnow = performance.now(); const dt = Math.max(8, tnow - lastPan); vel.copy(dlt).multiplyScalar(1000 / dt); lastPan = tnow; }
  });
  const endPtr = (e) => {
    pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
    if (pts.size === 0) { const wasDrag = dragging; dragging = false; downAt = null; grab = null; rot = null; canvas.style.cursor = hoverObj ? 'pointer' : 'grab'; if (performance.now() - lastPan > 80) vel.set(0, 0, 0); return wasDrag; }
    return true;
  };
  canvas.addEventListener('pointerup', (e) => {
    const wasDrag = endPtr(e);
    if (wasDrag || e.button > 0) return;
    setNdc(e.clientX, e.clientY);
    const obj = pickProxy();
    if (obj) { onPick && onPick(obj.userData.pick); return; }
    ray.setFromCamera(ndc, camera);
    const ch = ray.intersectObject(city.carMesh, false)[0];
    if (ch) { const p = city.honk(ch.instanceId); if (p) { pulseAt.copy(p); pulseT = 0; pulse.visible = true; say('Beep', p.clone().setY(4)); } return; }
    const bh = ray.intersectObjects(city.bldMeshes, false)[0];
    if (bh && bh.instanceId !== undefined) { const r = city.toggleLights(bh.object, bh.instanceId); say(r.on ? 'Lights on' : 'Lights off', r.top.setY(r.top.y + 3)); }
  });
  canvas.addEventListener('pointercancel', endPtr);
  canvas.addEventListener('pointerleave', () => { pointer = null; hoverDirty = true; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX, e.clientY); }, { passive: false });
  canvas.style.cursor = 'grab';

  /* ---------- the frame ---------- */
  let running = true; let visible = true; let last = performance.now(); let clock = 0; let acc = 0; let frameNo = 0; let cruiseFocus = false;
  const minFrame = isPhone ? 1 / 40 : 0;
  const frustum = new THREE.Frustum(); const pm = new THREE.Matrix4();
  const lastCam = new THREE.Vector3(); let lastF = 0;
  const stats = { calls: 0, triangles: 0, maxCalls: 0, maxTris: 0 };
  const cull = { x: 1e9, z: 1e9, r: -1 };
  function frame(now) {
    requestAnimationFrame(frame);
    if (!running || !visible || document.hidden) { last = now; return; }
    const rdt = Math.min(0.25, (now - last) / 1000); last = now;
    acc += rdt; if (acc < minFrame) return; const real = acc; acc = 0;
    const step = Math.min(0.05, real); clock += step; frameNo++;
    const wall = now / 1000;
    // trains: the focus train obeys rides (and cruises when idle); every other train keeps its own timetable
    let fleetMoved = false;
    T.forEach((t) => {
      if (t.motion && t.motion.step) { if (!t.motion.pauseUntil || wall > t.motion.pauseUntil) { t.motion.step(wall); if (t !== focus) fleetMoved = true; } }
      else if (!reduce && (t !== focus || cruiseFocus)) {
        t.dwell -= real;
        if (t.dwell <= 0) { const n = t.line.stations.length; let nx; if (t.line.closed) nx = (t.cur + 1) % n; else { nx = t.cur + t.dir; if (nx < 0 || nx >= n) { t.dir = -t.dir; nx = t.cur + t.dir; } } drive(t, nx, { cruise: true }); }
      }
    });
    if (fleetMoved) fleet.flush();
    const dSpeed = reduce ? 10 : 1.2;
    if (focus.doorAmt !== focus.doorGoal) { focus.doorAmt = focus.doorGoal > focus.doorAmt ? Math.min(focus.doorGoal, focus.doorAmt + real * dSpeed) : Math.max(focus.doorGoal, focus.doorAmt - real * dSpeed * 1.4); setDoors(train, 1, ease(focus.doorAmt)); setPSD(focus.line.stations[focus.cur], ease(focus.doorAmt)); }
    if (focus.ends) { const mid = trainMid(); trainProxy.position.copy(mid).setY(mid.y + 2.6); trainProxy.quaternion.copy(train.cars[1].car.quaternion); trainProxy.updateMatrixWorld(); }
    // camera goals by mode
    const sideMode = (camMode === 'ride' || camMode === 'platform' || camMode === 'follow') && followTrain && !userOrbit;
    if (sideMode && focus.ends) {
      const t = focus.ends[0].fwd.clone().setY(0).normalize(); const out = new THREE.Vector3(t.z, 0, -t.x).multiplyScalar(Math.sign(TRAIN_LAT));
      const hz = out.multiplyScalar(0.84).addScaledVector(t, 0.54).normalize(); const el = camMode === 'ride' ? 0.36 : camMode === 'follow' ? 0.5 : 0.41;
      thG = Math.atan2(hz.x, hz.z); phG = el;
    }
    const kA = reduce ? 1 : 1 - Math.exp(-real * (dragging || rot ? 9 : 2.2));
    th += angDiff(th, thG) * kA; ph += (phG - ph) * kA;
    mapAmt += (mapGoal - mapAmt) * (reduce ? 1 : 1 - Math.exp(-real * 3));
    if (followTrain) targetGoal.copy(trainMid()).setY(0);
    if (!dragging) {
      if (vel.lengthSq() > 1) { target.addScaledVector(vel, real); clampTarget(target); targetGoal.copy(target); vel.multiplyScalar(Math.exp(-real * 5)); }
      const k = reduce ? 1 : 1 - Math.exp(-real * (focus.motion && followTrain ? 4.5 : 1.6));
      target.lerp(targetGoal, k);
      F += (Fgoal - F) * (reduce ? 1 : 1 - Math.exp(-real * 1.3));
    }
    // cut open whatever stands between the camera and the train, in the side views
    if (sideMode) { const m = trainMid(); city.uni.uCut.value.set(m.x, m.y + 6, m.z, 24); city.uni.uCamDir.value.copy(dirOf(th, ph)); } else city.uni.uCut.value.w = 0;
    city.uni.uQuiet.value = mapAmt;
    applyFrustum(); placeCamera();
    { const r = F < 420 ? F * 1.5 + 170 : Infinity; if (r !== cull.r && (r === Infinity || cull.r === Infinity || Math.abs(r - cull.r) > 60) || (r !== Infinity && (target.x - cull.x) ** 2 + (target.z - cull.z) ** 2 > 40 * 40)) { city.cullTrees(target.x, target.z, r); cull.x = target.x; cull.z = target.z; cull.r = r; } }
    sun.position.copy(target).addScaledVector(sunDir, 1000); sun.target.position.copy(target);
    if (!reduce) anim.forEach((f) => f(clock, step));
    // the map layer
    const showMap = mapAmt > 0.02; [casing, ribbon, dotFill, dotRing].forEach((m) => { m.visible = showMap; });
    if (showMap) { mapU.uW.value = Math.max(5, F * 0.0135); mapU.uOp.value = Math.min(1, mapAmt * 1.4); dotFill.material.opacity = mapU.uOp.value; dotRing.material.opacity = mapU.uOp.value; placeDots(F); }
    pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pm);
    screens.forEach((s) => s.update(clock, step, !reduce && frustum.intersectsObject(s.mesh), F < 340));
    const camMoved = lastCam.distanceToSquared(camera.position) > 0.01 || Math.abs(lastF - F) > 0.05;
    if (pointer && (camMoved || focus.motion)) hoverDirty = true;
    if (hoverDirty && !dragging) { hoverDirty = false; if (pointer) { setNdc(pointer[0], pointer[1]); const obj = pickProxy(); if (obj !== hoverObj) { showHL(obj); onHover && onHover(obj ? obj.userData.pick : null); } if (obj) onHover && onHover(obj.userData.pick, pointer[0], pointer[1]); } else if (hoverObj) { showHL(null); onHover && onHover(null); } }
    if (hoverObj) { if (hoverObj === trainProxy) showHL(trainProxy); const pul = 0.5 + 0.5 * Math.sin(clock * 4); hlFill.material.opacity = 0.06 + 0.06 * pul; ring.material.opacity = 0.3 + 0.4 * pul; }
    if (pulseT < 1) { pulseT = Math.min(1, pulseT + real * 1.4); pulse.position.set(pulseAt.x, 0.4, pulseAt.z); const s = 2 + pulseT * 14; pulse.scale.set(s, s, s); pulse.material.opacity = 0.9 * (1 - pulseT); if (pulseT >= 1) pulse.visible = false; }
    lastCam.copy(camera.position); lastF = F;
    if (renderer.shadowMap.enabled && (focus.motion || camMoved || focus.doorAmt !== focus.doorGoal || frameNo % 6 === 0)) renderer.shadowMap.needsUpdate = true;
    renderer.info.reset();
    renderer.render(scene, camera);
    stats.calls = renderer.info.render.calls; stats.triangles = renderer.info.render.triangles;
    stats.maxCalls = Math.max(stats.maxCalls, stats.calls); stats.maxTris = Math.max(stats.maxTris, stats.triangles);
    // labels
    const inMap = mapAmt > 0.5; tags.classList.toggle('is-map', inMap); tags.classList.toggle('is-far', !inMap && F > 560);
    // HQ labels step up or down out of each other's way
    const placed = []; const hideDest = inMap || (isPhone && F > 900);
    labelItems.forEach((it) => {
      v.copy(inMap && it.map ? it.map : it.pos).project(camera);
      const x = (v.x * 0.5 + 0.5) * W; let y = (-v.y * 0.5 + 0.5) * H;
      const off = x < -60 || x > W + 60 || y < -30 || y > H + 30 || (it.kind === 'dest' && hideDest);
      if (!off && !(inMap && it.kind === 'st')) {
        if (!it.w) it.w = it.el.offsetWidth || 80; const w = it.w; const hgt = 24;
        const hit = (yy) => placed.some((r) => Math.abs(r[0] - x) < (r[2] + w) / 2 + 3 && Math.abs(r[1] - yy) < hgt);
        if (it.kind === 'dest') { for (const dy of [0, -26, 26, -52, 52]) { if (!hit(y + dy)) { y += dy; break; } } }
        placed.push([x, y, w]);
      }
      it.el.style.transform = inMap && it.kind === 'st' ? `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)` : `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      it.el.style.visibility = off ? 'hidden' : 'visible';
    });
    if (bubbleT < 1) { bubbleT = Math.min(1, bubbleT + real * 0.8); v.copy(bubblePos).project(camera); bubble.style.transform = `translate(${((v.x * 0.5 + 0.5) * W).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * H - bubbleT * 30).toFixed(1)}px) translate(-50%, -100%)`; bubble.style.opacity = String(bubbleT < 0.8 ? 1 : (1 - bubbleT) * 5); }
  }
  resize(); requestAnimationFrame(frame);
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 }).observe(host);
  addEventListener('resize', resize);
  { const o = fit(th, ph, false); F = Fgoal = o.F; target.copy(o.target); targetGoal.copy(o.target); }
  renderer.shadowMap.needsUpdate = true;

  const MODE_F = { ride: isPhone ? 115 : 130, platform: isPhone ? 92 : 104, follow: isPhone ? 150 : 165, closeup: isPhone ? 48 : 50 };
  const lineT = (lid) => T.find((t) => t.line.id === lid);
  const stIdx = (t, sid) => t.line.stations.findIndex((p) => p.id === sid);
  return {
    net, focusLine: () => focus.line.id,
    // put a line's train at a station with its doors open (the next train arriving), and make it the focus
    board(lid, sid, { instant = false } = {}) {
      const t = lineT(lid); const i = stIdx(t, sid); if (i < 0) return;
      if (t.motion) { t.motion.cancel = true; t.motion.resolve(false); t.motion = null; }
      setFocus(t);
      if (t.cur !== i || Math.abs(t.sHead - (t.line.stations[i].s + t.dir * STOP)) > 1) { t.cur = i; t.sHead = t.line.stations[i].s + t.dir * STOP; }
      t.ends = placeTrain(train, t.line, t.sHead, TRAIN_LAT, t.dir); fleet.place(t.li, t.line, t.sHead, TRAIN_LAT, t.dir, true); fleet.flush();
      t.doorGoal = 1; if (instant || reduce) t.doorAmt = 1; setSign(`${t.line.def.no}  ${t.line.stations[i].st.name}`);
      onProgress && onProgress(lid, i);
    },
    goTo(lid, sid, o = {}) { const t = lineT(lid); setFocus(t); return drive(t, stIdx(t, sid), o); },
    at: () => ({ line: focus.line.id, station: focus.line.stations[focus.cur].id, moving: !!focus.motion }),
    setViewOffset, resize,
    skip() { if (focus.motion && focus.motion.skip) focus.motion.skip(); },
    moving: () => !!focus.motion,
    cruise(on) { cruiseFocus = !!on && !reduce; if (cruiseFocus && focus.dwell > 4) focus.dwell = 4; },
    setMap(on, o = {}) {
      mapGoal = on ? 1 : 0; userOrbit = false; followTrain = false;
      if (on) { camMode = 'map'; thG = isPhone ? Math.PI / 2 : 0; phG = 1.553; const f = fit(thG, 1.553, true); Fgoal = f.F; targetGoal.copy(f.target); }
      else { camMode = 'overview'; thG = OV.th; phG = OV.ph; const f = fit(OV.th, OV.ph, false); Fgoal = f.F; targetGoal.copy(f.target); }
      if (o.instant || reduce) { th = thG; ph = phG; F = Fgoal; target.copy(targetGoal); mapAmt = mapGoal; }
    },
    isMap: () => mapGoal > 0,
    view(kind, o = {}) {
      followTrain = kind === 'ride' || kind === 'platform' || kind === 'follow' || kind === 'closeup';
      userOrbit = false; camMode = kind; if (mapGoal > 0 && kind !== 'map') { mapGoal = 0; onMode && onMode('3d'); } onFree && onFree(false);
      if (kind === 'overview') { thG = OV.th; phG = OV.ph; const f = fit(thG, phG, false); Fgoal = f.F; targetGoal.copy(f.target); }
      else if (MODE_F[kind]) Fgoal = MODE_F[kind];
      if (kind === 'dest' && o.focus) { Fgoal = o.F || (isPhone ? 210 : 230); targetGoal.copy(o.focus).setY(0); thG = th + angDiff(th, o.th ?? 0.62); phG = o.ph ?? 0.62; }
      if (o.instant || reduce) { F = Fgoal; if (followTrain) targetGoal.copy(trainMid()).setY(0); target.copy(targetGoal); if (kind === 'overview' || kind === 'dest') { th = thG; ph = phG; } applyFrustum(); }
    },
    mode: () => camMode,
    trainPos: () => trainMid(),
    info: () => ({ calls: stats.calls, triangles: stats.triangles, maxCalls: stats.maxCalls, maxTris: stats.maxTris, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, F: Math.round(F), mode: camMode }),
    resetStats() { stats.maxCalls = 0; stats.maxTris = 0; },
    stats() {
      const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const out = [];
      scene.traverse((o) => { if (!o.isMesh || !o.visible) return; if (o.frustumCulled && !fr.intersectsObject(o)) return; const g = o.geometry; const tri = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); out.push([Math.round(tri), o.isInstancedMesh ? 'inst' : 'mesh', o.material.type, o.castShadow ? 'cast' : '']); });
      out.sort((a, b) => b[0] - a[0]); return { count: out.length, top: out.slice(0, 16) };
    },
    projectHover(pick) { const obj = proxies.find((p) => JSON.stringify(p.userData.pick) === JSON.stringify(pick)); if (!obj) return null; v.copy(obj.position).project(camera); const r = canvas.getBoundingClientRect(); return [r.left + (v.x * 0.5 + 0.5) * W, r.top + (-v.y * 0.5 + 0.5) * H]; },
    debug: () => ({ target: target.toArray().map(Math.round), th: +th.toFixed(2), ph: +ph.toFixed(2), F: Math.round(F), mode: camMode, focus: focus.line.id, at: focus.line.stations[focus.cur].id, moving: !!focus.motion }),
    peek() {
      const r = canvas.getBoundingClientRect(); const toScr = (p3) => { v.copy(p3).project(camera); return [r.left + (v.x * 0.5 + 0.5) * W, r.top + (-v.y * 0.5 + 0.5) * H, v.x, v.y]; };
      const inView = (q) => Math.abs(q[2]) < 0.6 && Math.abs(q[3]) < 0.6; const mm = new THREE.Matrix4(); const pp = new THREE.Vector3(); let car = null; let bld = null;
      for (let i = 0; i < city.carMesh.count && !car; i++) { city.carMesh.getMatrixAt(i, mm); pp.setFromMatrixPosition(mm).setY(1); const q = toScr(pp); if (inView(q)) car = q; }
      for (const m of city.bldMeshes) { for (let i = 0; i < m.count && !bld; i++) { const b = m.userData.items[i]; if (b.h < 8 || b.h > 30 || b.landmark) continue; const q = toScr(new THREE.Vector3(b.x, b.y + b.h + 0.5, b.z)); if (inView(q) && !proxies.some((px) => Math.abs(px.position.x - b.x) < px.scale.x && Math.abs(px.position.z - b.z) < px.scale.z)) bld = q; } if (bld) break; }
      return { car, bld };
    },
    highlight(sid) { labelItems.forEach((it) => it.el.classList.toggle('is-current', it.kind === 'st' && it.id === sid)); },
    pause() { running = false; }, resume() { running = true; last = performance.now(); },
  };
}
