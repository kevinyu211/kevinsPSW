/* Kevin Metro · engine
   Golden-hour light, a calm orthographic camera, the city, the K Line loop and one train.
   The canvas is decoration (aria-hidden); every action also exists as an HTML control. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { buildLine, buildCity, buildRail, makeMaterials, TRAIN_LAT, BOUNDS } from './world.js';
import { LANDMARKS, SignAtlas, PhotoAtlas } from './landmarks.js';
import { buildTrain, placeTrain, setDoors, destSignTexture, CAR_LEN, CAR_GAP, DOORS } from './train.js';

const STOP_OFFSET = 41.5; // head of the train stops 41.5 m past the station centre, so the train sits centred
const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const easeSoft = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

export function createCity(host, opts) {
  const { reduce, isPhone, lineHex, destinations, onPick, onProgress, onArrive, onHover, onFree } = opts;
  // phones and low-end machines: fewer things, no shadows, a lower pixel ratio
  const lowEnd = isPhone || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const renderer = new THREE.WebGLRenderer({ antialias: !lowEnd, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(lowEnd ? 1.25 : 2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = !lowEnd;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.info.autoReset = false;
  const canvas = renderer.domElement; canvas.className = 'city-canvas'; canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const HAZE = new THREE.Color(0xd9e2e7);
  scene.background = HAZE;
  scene.fog = new THREE.Fog(HAZE, 1950, 2700);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  // golden-hour sun from the south-west, a warm sky fill
  const hemi = new THREE.HemisphereLight(0xdfe9f5, 0xb9a688, 1.15); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffdcb0, 3.1);
  sun.castShadow = !lowEnd;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 1700;
  scene.add(sun, sun.target);
  const sunDir = new THREE.Vector3(-0.55, 0.62, 0.56).normalize();

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 600, 2800);
  const camDirDefault = new THREE.Vector3(0.62, 0.66, 0.75).normalize();
  // phones are portrait: look from the east so the long side of the loop runs up the screen
  const camDirOverview = (isPhone ? new THREE.Vector3(0.82, 1.1, 0.3) : new THREE.Vector3(0.36, 1.0, 0.8)).normalize();
  let camMode = 'platform';
  const camDir = camDirDefault.clone();
  const dirGoal = new THREE.Vector3();
  const CAM_DIST = 1800;
  const target = new THREE.Vector3(); const targetGoal = new THREE.Vector3();
  const F_OVER = isPhone ? 1480 : 1060;
  let F = isPhone ? 900 : 760; let Fgoal = F;
  const F_MIN = 45; const F_MAX = isPhone ? 1500 : 1100;

  /* ---------- build the world ---------- */
  const M = makeMaterials(lineHex);
  const line = buildLine();
  const N = line.stations.length;
  const landmarks = LANDMARKS.map((l) => ({ ...l }));
  const atlas = new SignAtlas(); const photos = new PhotoAtlas();
  const city = buildCity({ scene, M, line, lineHex, isPhone: lowEnd, landmarks, atlas, photos });
  const doorS = (st) => { const out = []; for (let k = 0; k < 4; k++) { const sc = st.s + STOP_OFFSET - CAR_LEN / 2 - k * (CAR_LEN + CAR_GAP); DOORS.forEach((d) => out.push(sc + d)); } return out; };
  const rail = buildRail({ scene, M, line, lineHex, pierOK: city.pierOK, batch: city.batch, doorS });
  city.batch.build(scene);
  const anim = [...city.anim, ...rail.anim];
  const screens = landmarks.flatMap((l) => l.screens || []);

  // station name boards on the canopy roof, one facing out of the loop and one facing in
  const stCanvas = (st) => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 200; const g = c.getContext('2d');
    const hex = '#' + new THREE.Color(lineHex).getHexString();
    g.fillStyle = hex; g.fillRect(0, 0, 1024, 200);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(100, 100, 70, 0, Math.PI * 2); g.fill();
    g.fillStyle = hex; g.font = '800 58px "Public Sans", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(st.code, 100, 104);
    g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.font = '800 74px "Public Sans", Arial'; g.fillText(st.name, 200, 82);
    g.font = '600 50px "PingFang SC", "Microsoft YaHei", sans-serif'; g.fillText(st.zh, 202, 158);
    return c;
  };
  const totems = [];
  rail.stationParts.forEach((sp) => {
    const st = sp.st; const cv = stCanvas(st);
    [-24, 24].forEach((d) => [-1, 1].forEach((side) => {
      const a = line.at(st.s + d); const o = new THREE.Object3D();
      o.position.copy(a.p).addScaledVector(a.n, side * 0.3).setY(a.p.y + 6.05); o.lookAt(o.position.clone().addScaledVector(a.n, side)); o.updateMatrix();
      atlas.add(cv, 6, 1.17, 0, 0, 0, 0, { matrix: o.matrix.clone() });
    }));
    (sp.totems || []).forEach((t) => totems.push(t));
    // a white roundel with the station code on the blue canopy roof, readable from above
    const rc = document.createElement('canvas'); rc.width = 256; rc.height = 256; const rg = rc.getContext('2d'); const hex = '#' + new THREE.Color(lineHex).getHexString();
    rg.fillStyle = hex; rg.fillRect(0, 0, 256, 256); rg.fillStyle = '#ffffff'; rg.beginPath(); rg.arc(128, 128, 118, 0, Math.PI * 2); rg.fill();
    rg.fillStyle = hex; rg.font = '800 92px "Public Sans", Arial'; rg.textAlign = 'center'; rg.textBaseline = 'middle'; rg.fillText(st.code, 128, 134);
    [-30, 0, 30].forEach((d) => { const a = line.at(st.s + d); atlas.add(rc, 6.4, 6.4, 0, 0, 0, 0, { matrix: new THREE.Matrix4().compose(a.p.clone().setY(a.p.y + 5.42), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1)) }); });
  });
  atlas.build(scene);
  photos.build(scene);
  {
    const kc = document.createElement('canvas'); kc.width = 128; kc.height = 128; const g = kc.getContext('2d'); g.fillStyle = '#' + new THREE.Color(lineHex).getHexString(); g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.font = '800 80px "Public Sans", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('K', 64, 70);
    const kTex = new THREE.CanvasTexture(kc); kTex.colorSpace = THREE.SRGBColorSpace;
    const tm = new THREE.InstancedMesh(new THREE.CircleGeometry(0.75, 24), new THREE.MeshBasicMaterial({ map: kTex, side: THREE.DoubleSide, transparent: true }), totems.length);
    const o = new THREE.Object3D();
    totems.forEach(([x, y, z, ang], i) => { o.position.set(x, y, z); o.rotation.set(0, ang + Math.PI / 2, 0); o.updateMatrix(); tm.setMatrixAt(i, o.matrix); });
    tm.computeBoundingSphere(); scene.add(tm);
  }

  // platform screen doors that line up with the train's doors (on the platform edge facing the inner track)
  const psdLeaves = []; const psdMat = new THREE.MeshStandardMaterial({ color: 0xbfd6e2, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.45 });
  const psd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 2.1, 0.7), psdMat, N * 16 * 2);
  let pi = 0; const m4 = new THREE.Matrix4(); const qq = new THREE.Quaternion(); const yAx = new THREE.Vector3(0, 1, 0); const ONE = new THREE.Vector3(1, 1, 1);
  line.stations.forEach((st, si) => {
    doorS(st).forEach((s) => [-1, 1].forEach((half) => {
      const a = line.at(s); const p = a.p.clone().add(a.n.clone().multiplyScalar(Math.sign(TRAIN_LAT) * 3.3)); p.y += 1.1 + 1.05;
      qq.setFromAxisAngle(yAx, Math.atan2(a.t.x, a.t.z));
      psdLeaves.push({ si, p, t: a.t.clone(), half, idx: pi, q: qq.clone() });
      m4.compose(p.clone().addScaledVector(a.t, half * 0.36), qq, ONE); psd.setMatrixAt(pi, m4); pi++;
    }));
  });
  psd.computeBoundingSphere(); scene.add(psd);
  const setPSD = (si, amount) => {
    psdLeaves.forEach((l) => { if (l.si !== si) return; m4.compose(l.p.clone().addScaledVector(l.t, l.half * (0.36 + 0.66 * amount)), l.q, ONE); psd.setMatrixAt(l.idx, m4); });
    psd.instanceMatrix.needsUpdate = true;
  };
  // objects placed by matrix: let three.js compute their world matrix once
  scene.traverse((o) => { if (!o.matrixAutoUpdate) o.matrixWorldNeedsUpdate = true; });

  /* ---------- the train: always forward, clockwise round the loop ---------- */
  const train = buildTrain({ lineHex, cars: 4, platformSide: Math.sign(-TRAIN_LAT) });
  scene.add(train.group);
  let sHead = line.stations[0].s + STOP_OFFSET;
  let ends = placeTrain(train, line, sHead, TRAIN_LAT);
  let curIdx = 0;
  const setSign = (text) => train.cars.forEach((c) => { if (c.sign) { c.sign.material.map.dispose(); c.sign.material.map = destSignTexture(text); c.sign.material.needsUpdate = true; } });
  setSign(`Kevin Metro · ${line.stations[0].name}`);
  const platformSide = () => {
    const c = train.cars[0].car; const x = new THREE.Vector3(1, 0, 0).applyQuaternion(c.quaternion);
    const a = line.at(sHead - STOP_OFFSET); return x.dot(a.p.clone().sub(c.position).setY(0)) > 0 ? 1 : -1;
  };
  let doorAmt = 0; let doorGoal = 0; let doorSide = 1;
  let motion = null;
  let cruiseOn = false; let dwell = 0;
  const trainMid = () => { const m = new THREE.Vector3(); ends.forEach((e) => m.add(e.mid)); return m.multiplyScalar(1 / ends.length); };
  const fracAt = (sh) => {
    const p = line.wrap(sh - STOP_OFFSET); const S = line.stations;
    let i = N - 1; for (let k = 0; k < N; k++) if (S[k].s <= p) i = k;
    const gap = line.wrap(S[(i + 1) % N].s - S[i].s) || line.L;
    return (i + line.wrap(p - S[i].s) / gap) % N;
  };
  const fade = document.createElement('div'); fade.className = 'ride-cut'; fade.setAttribute('aria-hidden', 'true'); host.appendChild(fade);

  function goTo(index, { instant = false, cruise = false } = {}) {
    const st = line.stations[index];
    return new Promise((resolve) => {
      if (motion) { motion.cancel = true; motion.resolve(false); }
      setPSD(curIdx, 0);
      const D = line.wrap(st.s + STOP_OFFSET - sHead);
      const sT = sHead + (D < 0.5 ? 0 : D);
      const arrive = () => {
        sHead = sT; ends = placeTrain(train, line, sHead, TRAIN_LAT); curIdx = index;
        onProgress && onProgress(index);
        doorGoal = 1; doorSide = platformSide();
        motion = null; dwell = cruise ? 6 : 9;
        onArrive && onArrive(index, { cruise });
        resolve(true);
      };
      setSign(`${st.code}  ${st.name}`);
      if (instant || reduce || D < 0.5) {
        doorAmt = 0; doorGoal = 0; motion = null; arrive();
        targetGoal.copy(trainMid()); if (instant || reduce) target.copy(targetGoal);
        if (reduce) doorAmt = 1;
        return;
      }
      const from = sHead;
      const long = !cruise && D > 950;
      const r = { cancel: false, cruise, resolve };
      motion = r;
      doorGoal = 0;
      // doors close, then the ride; long journeys get one quiet cut in the middle
      const legs = long ? [[from, from + 260, 'in'], [sT - 300, sT, 'out']] : [[from, sT, 'both']];
      const durOf = (len, kind) => (cruise ? 9 + len / 38 : kind === 'both' ? Math.min(11, Math.max(6, 4.5 + len / 85)) : 5.2);
      let leg = 0; let t0 = -1;
      r.step = (now) => {
        if (r.cancel) return;
        if (doorAmt > 0.02) return; // wait for the doors
        if (t0 < 0) t0 = now;
        const [a, b, kind] = legs[leg]; const dur = durOf(Math.abs(b - a), kind);
        const p = Math.min(1, (now - t0) / dur);
        const e = kind === 'both' ? (cruise ? easeSoft(p) : ease(p)) : kind === 'in' ? p * p : 1 - (1 - p) * (1 - p);
        sHead = a + (b - a) * e;
        ends = placeTrain(train, line, sHead, TRAIN_LAT);
        onProgress && onProgress(fracAt(sHead));
        if (p >= 1) {
          if (leg < legs.length - 1) {
            leg++; t0 = -1;
            fade.classList.add('is-on');
            setTimeout(() => { if (r.cancel) return; sHead = legs[leg][0]; ends = placeTrain(train, line, sHead, TRAIN_LAT); target.copy(trainMid()); fade.classList.remove('is-on'); }, 450);
            r.pauseUntil = now + 0.9;
          } else arrive();
        }
      };
      r.skip = () => { r.cancel = true; arrive(); target.copy(trainMid()); };
    });
  }

  /* ---------- labels: stations and destinations, crisp HTML pinned to the world ---------- */
  const tags = document.createElement('div'); tags.className = 'tags'; tags.setAttribute('aria-hidden', 'true'); host.appendChild(tags);
  const labelItems = [];
  line.stations.forEach((st, i) => {
    const el = document.createElement('button'); el.type = 'button'; el.tabIndex = -1; el.className = 'tag tag-st';
    const b = document.createElement('i'); b.className = 'kb'; b.textContent = st.code;
    const n = document.createElement('span'); n.textContent = st.name;
    el.append(b, n);
    el.addEventListener('click', () => onPick && onPick({ type: 'station', index: i }));
    tags.append(el);
    const a = line.at(st.s);
    labelItems.push({ el, pos: a.p.clone().setY(a.p.y + 9), kind: 'st', i });
  });
  const lmById = Object.fromEntries(landmarks.map((l) => [l.id, l]));
  destinations.forEach((d) => {
    const lm = lmById[d.landmark]; if (!lm || !lm.focus) return;
    d.focus = lm.focus.clone(); d.hit = lm.hit;
    const el = document.createElement('button'); el.type = 'button'; el.tabIndex = -1; el.className = 'tag tag-dest';
    const dot = document.createElement('i'); dot.className = `dot c-${d.color}`;
    const n = document.createElement('span'); n.textContent = d.short || d.name;
    el.append(dot, n);
    el.addEventListener('click', () => onPick && onPick({ type: 'dest', id: d.id }));
    tags.append(el);
    labelItems.push({ el, pos: new THREE.Vector3(lm.hit.center.x, lm.hit.size.y + 6, lm.hit.center.z), kind: 'dest', id: d.id });
  });
  const v = new THREE.Vector3();

  /* ---------- hover and click: project buildings, stations, the train, and a few toys ---------- */
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const proxies = [];
  destinations.forEach((d) => { if (!d.hit) return; const h = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), hitMat); h.position.copy(d.hit.center); h.scale.copy(d.hit.size); h.userData.pick = { type: 'dest', id: d.id }; h.updateMatrixWorld(); proxies.push(h); });
  line.stations.forEach((st, i) => { const a = line.at(st.s); const h = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), hitMat); h.position.copy(a.p).setY(9); h.rotation.y = Math.atan2(a.t.x, a.t.z); h.scale.set(18, 18, 92); h.userData.pick = { type: 'station', index: i }; h.updateMatrixWorld(); proxies.push(h); });
  const trainProxy = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), hitMat); trainProxy.scale.set(5, 6, 86); trainProxy.userData.pick = { type: 'train' }; proxies.push(trainProxy);
  // the highlight: a soft cobalt volume, crisp white edges, a ring on the ground
  const hl = new THREE.Group(); hl.visible = false; scene.add(hl);
  const hlFill = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: lineHex, transparent: true, opacity: 0.14, depthWrite: false }));
  const hlEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false }));
  hlEdge.renderOrder = 10; hl.add(hlFill, hlEdge);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 64), new THREE.MeshBasicMaterial({ color: lineHex, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; ring.renderOrder = 3; scene.add(ring);
  let hoverObj = null;
  const showHL = (obj) => {
    hoverObj = obj; hl.visible = !!obj; ring.visible = !!obj;
    canvas.style.cursor = obj ? 'pointer' : (dragging ? 'grabbing' : 'grab');
    if (!obj) return;
    hl.position.copy(obj.position); hl.quaternion.copy(obj.quaternion); hl.scale.copy(obj.scale).multiplyScalar(1.04);
    ring.position.set(obj.position.x, 0.6, obj.position.z); const rr = Math.hypot(obj.scale.x, obj.scale.z) * 0.5 + 4; ring.scale.set(rr, rr, rr);
  };
  // the honk: a ring on the road and a little word
  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  pulse.rotation.x = -Math.PI / 2; pulse.visible = false; scene.add(pulse);
  let pulseT = 1; let pulseAt = new THREE.Vector3();
  const bubble = document.createElement('span'); bubble.className = 'bubble'; bubble.setAttribute('aria-hidden', 'true'); host.appendChild(bubble);
  let bubbleT = 1; const bubblePos = new THREE.Vector3();
  const say = (text, pos) => { bubble.textContent = text; bubblePos.copy(pos); bubbleT = 0; };

  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  const setNdc = (cx, cy) => { const r = canvas.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); };
  const groundAt = (cx, cy) => { setNdc(cx, cy); ray.setFromCamera(ndc, camera); const t = -ray.ray.origin.y / ray.ray.direction.y; return ray.ray.origin.clone().addScaledVector(ray.ray.direction, t); };
  let pointer = null; let hoverDirty = false;
  const pickProxy = () => { ray.setFromCamera(ndc, camera); const hit = ray.intersectObjects(proxies, false)[0]; return hit ? hit.object : null; };

  /* ---------- pan (drag), zoom (wheel, pinch) ---------- */
  const pts = new Map(); let dragging = false; let downAt = null; let grab = null; let pinch = null;
  const placeCamera = () => { camera.position.copy(target).addScaledVector(camDir, CAM_DIST); camera.lookAt(target); camera.updateMatrixWorld(); };
  const clampTarget = (t) => { t.x = Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, t.x)); t.z = Math.max(BOUNDS.z0, Math.min(BOUNDS.z1, t.z)); };
  const goFree = () => { if (camMode !== 'free') { camMode = 'free'; followTrain = false; dirGoal.copy(camDir); onFree && onFree(true); } };
  const zoomAt = (factor, cx, cy) => {
    const nf = Math.max(F_MIN, Math.min(F_MAX, F * factor)); if (Math.abs(nf - F) < 0.01) return;
    if (followTrain) { F = nf; Fgoal = nf; userF = nf; applyFrustum(); return; }
    const before = groundAt(cx, cy); F = nf; Fgoal = nf; applyFrustum(); placeCamera();
    const after = groundAt(cx, cy); target.add(before.sub(after)).setY(0); clampTarget(target); targetGoal.copy(target); placeCamera();
  };
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { downAt = [e.clientX, e.clientY]; grab = groundAt(e.clientX, e.clientY); dragging = false; }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), F }; dragging = true; }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) { pointer = [e.clientX, e.clientY]; hoverDirty = true; return; }
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      zoomAt((pinch.F * (pinch.d / Math.max(20, d))) / F, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); return;
    }
    if (!downAt) return;
    if (!dragging && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) { dragging = true; goFree(); showHL(null); canvas.style.cursor = 'grabbing'; }
    if (dragging && grab) { const now = groundAt(e.clientX, e.clientY); target.add(grab.clone().sub(now)).setY(0); clampTarget(target); targetGoal.copy(target); placeCamera(); }
  });
  const endPtr = (e) => {
    pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
    if (pts.size === 0) { const wasDrag = dragging; dragging = false; downAt = null; grab = null; canvas.style.cursor = hoverObj ? 'pointer' : 'grab'; return wasDrag; }
    return true;
  };
  canvas.addEventListener('pointerup', (e) => {
    const wasDrag = endPtr(e);
    if (wasDrag || e.button > 0) return;
    // a click: a place, a station or the train first; otherwise a car honks or a building switches its lights on
    setNdc(e.clientX, e.clientY);
    const obj = pickProxy();
    if (obj) { onPick && onPick(obj.userData.pick); return; }
    ray.setFromCamera(ndc, camera);
    const ch = ray.intersectObject(city.carMesh, false)[0];
    if (ch) { const p = city.honk(ch.instanceId); if (p) { pulseAt.copy(p); pulseT = 0; pulse.visible = true; say('Beep', p.clone().setY(4)); } return; }
    const bh = ray.intersectObjects(city.bldMeshes, false)[0];
    if (bh && bh.instanceId !== undefined) { const r = city.toggleLights(bh.object, bh.instanceId); say(r.on ? 'Lights on' : 'Lights off', r.top.setY(r.top.y + 3)); renderer.shadowMap.needsUpdate = true; }
  });
  canvas.addEventListener('pointercancel', endPtr);
  canvas.addEventListener('pointerleave', () => { pointer = null; hoverDirty = true; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX, e.clientY); }, { passive: false });
  canvas.style.cursor = 'grab';

  /* ---------- size and loop ---------- */
  let W = 1; let H = 1; let offX = 0; let userF = 0;
  function resize() {
    const r = host.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false); canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    applyFrustum();
  }
  function applyFrustum() {
    const aspect = W / H;
    camera.left = (-F * aspect) / 2; camera.right = (F * aspect) / 2; camera.top = F / 2; camera.bottom = -F / 2;
    if (offX) camera.setViewOffset(W + offX, H, offSide > 0 ? offX : 0, 0, W, H); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    const sh = Math.min(560, Math.max(130, F * 0.62 * Math.max(1, aspect)));
    const sc = sun.shadow.camera; if (Math.abs(sc.right - sh) > 4) { sc.left = -sh; sc.right = sh; sc.top = sh; sc.bottom = -sh; sc.updateProjectionMatrix(); renderer.shadowMap.needsUpdate = true; }
  }
  let offSide = 1;
  function setViewOffset(px, side = 'right') { offX = Math.max(0, px | 0); offSide = side === 'left' ? -1 : 1; applyFrustum(); }

  let running = true; let visible = true; let last = performance.now(); let clock = 0; let acc = 0; let frameNo = 0;
  const minFrame = isPhone ? 1 / 40 : 0;
  const frustum = new THREE.Frustum(); const pm = new THREE.Matrix4();
  const lastCam = new THREE.Vector3(); let lastF = 0;
  const stats = { calls: 0, triangles: 0, maxCalls: 0, maxTris: 0 };
  let followTrain = true;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!running || !visible || document.hidden) { last = now; return; }
    const rdt = Math.min(0.25, (now - last) / 1000); last = now;
    acc += rdt; if (acc < minFrame) return; const real = acc; acc = 0;
    const step = Math.min(0.05, real);
    clock += step; frameNo++;
    const wall = now / 1000;
    if (motion && motion.step) { if (!motion.pauseUntil || wall > motion.pauseUntil) motion.step(wall); }
    // idle: the train keeps going round, stopping at each station for a few seconds
    if (cruiseOn && !motion && !reduce) { dwell -= real; if (dwell <= 0) goTo((curIdx + 1) % N, { cruise: true }); }
    // doors: train and platform screen doors move together
    const dSpeed = reduce ? 10 : 1.2;
    if (doorAmt !== doorGoal) { doorAmt = doorGoal > doorAmt ? Math.min(doorGoal, doorAmt + real * dSpeed) : Math.max(doorGoal, doorAmt - real * dSpeed * 1.4); setDoors(train, doorSide, ease(doorAmt)); setPSD(curIdx, ease(doorAmt)); }
    // the train's hover box rides along with it
    if (ends.length) { const mid = trainMid(); trainProxy.position.copy(mid).setY(mid.y + 2.6); trainProxy.quaternion.copy(train.cars[1].car.quaternion); trainProxy.updateMatrixWorld(); }
    // camera direction: a low side three-quarter view of the train, from inside the loop
    const sideMode = (camMode === 'ride' || camMode === 'platform' || camMode === 'follow') && followTrain;
    if (sideMode && ends.length) {
      const t = ends[0].fwd.clone().setY(0).normalize(); const out = new THREE.Vector3(t.z, 0, -t.x).multiplyScalar(Math.sign(TRAIN_LAT));
      const hz = out.multiplyScalar(0.84).addScaledVector(t, 0.54).normalize(); const el = camMode === 'ride' ? 0.36 : camMode === 'follow' ? 0.5 : 0.41;
      dirGoal.set(hz.x * Math.cos(el), Math.sin(el), hz.z * Math.cos(el));
    } else if (camMode === 'overview') dirGoal.copy(camDirOverview);
    else if (camMode === 'dest') dirGoal.copy(camDirDefault);
    camDir.lerp(dirGoal, reduce ? 1 : 1 - Math.exp(-real * 1.3)).normalize();
    // cut open whatever stands between the camera and the train
    if (sideMode) { const m = trainMid(); city.uni.uCut.value.set(m.x, Math.max(m.y, 0) + 6, m.z, 24); city.uni.uCamDir.value.copy(camDir); } else city.uni.uCut.value.w = 0;
    if (followTrain) targetGoal.copy(trainMid()).setY(Math.max(0, trainMid().y));
    if (!dragging) {
      const k = reduce ? 1 : 1 - Math.exp(-real * (motion && followTrain ? 4.5 : 1.4));
      target.lerp(targetGoal, k);
      F += (Fgoal - F) * (reduce ? 1 : 1 - Math.exp(-real * 1.1));
    }
    const near = sideMode || (camMode === 'dest') || F < 300;
    const farGoal = near ? CAM_DIST + 520 : 2800; if (Math.abs(camera.far - farGoal) > 1) { camera.far = farGoal; scene.fog.near = near ? CAM_DIST + 160 : 1950; scene.fog.far = near ? CAM_DIST + 520 : 2700; }
    applyFrustum(); placeCamera();
    const camMoved0 = lastCam.distanceToSquared(camera.position) > 0.01 || Math.abs(lastF - F) > 0.05;
    sun.position.copy(target).addScaledVector(sunDir, 950); sun.target.position.copy(target);
    if (!reduce) anim.forEach((f) => f(clock, step));
    // screens change and play only when you can see them
    pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pm);
    screens.forEach((s) => s.update(clock, step, !reduce && frustum.intersectsObject(s.mesh), F < 340));
    // hover (once per frame at most)
    if (pointer && (camMoved0 || motion)) hoverDirty = true;
    if (hoverDirty && !dragging) { hoverDirty = false; if (pointer) { setNdc(pointer[0], pointer[1]); const obj = pickProxy(); if (obj !== hoverObj) { showHL(obj); onHover && onHover(obj ? obj.userData.pick : null); } if (obj) onHover && onHover(obj.userData.pick, pointer[0], pointer[1], true); } else if (hoverObj) { showHL(null); onHover && onHover(null); } }
    if (hoverObj) { if (hoverObj === trainProxy) showHL(trainProxy); const pul = 0.5 + 0.5 * Math.sin(clock * 4); hlFill.material.opacity = 0.06 + 0.06 * pul; ring.material.opacity = 0.3 + 0.4 * pul; }
    if (pulseT < 1) { pulseT = Math.min(1, pulseT + real * 1.4); pulse.position.set(pulseAt.x, 0.4, pulseAt.z); const s = 2 + pulseT * 14; pulse.scale.set(s, s, s); pulse.material.opacity = 0.9 * (1 - pulseT); if (pulseT >= 1) pulse.visible = false; }
    // shadows: re-render while anything big moves, otherwise a few times a second
    const camMoved = lastCam.distanceToSquared(camera.position) > 0.01 || Math.abs(lastF - F) > 0.05; lastCam.copy(camera.position); lastF = F;
    if (renderer.shadowMap.enabled && (motion || camMoved || doorAmt !== doorGoal || frameNo % 6 === 0)) renderer.shadowMap.needsUpdate = true;
    renderer.info.reset();
    renderer.render(scene, camera);
    stats.calls = renderer.info.render.calls; stats.triangles = renderer.info.render.triangles;
    stats.maxCalls = Math.max(stats.maxCalls, stats.calls); stats.maxTris = Math.max(stats.maxTris, stats.triangles);
    // labels
    const showDest = F < 1700;
    labelItems.forEach((it) => {
      v.copy(it.pos).project(camera);
      const x = (v.x * 0.5 + 0.5) * W; const y = (-v.y * 0.5 + 0.5) * H;
      const off = x < -60 || x > W + 60 || y < -30 || y > H + 30 || (it.kind === 'dest' && !showDest);
      it.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      it.el.style.visibility = off ? 'hidden' : 'visible';
    });
    tags.classList.toggle('is-far', F > 560);
    if (bubbleT < 1) { bubbleT = Math.min(1, bubbleT + real * 0.8); v.copy(bubblePos).project(camera); bubble.style.transform = `translate(${((v.x * 0.5 + 0.5) * W).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * H - bubbleT * 30).toFixed(1)}px) translate(-50%, -100%)`; bubble.style.opacity = String(bubbleT < 0.8 ? 1 : (1 - bubbleT) * 5); }
  }
  resize(); requestAnimationFrame(frame);
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 }).observe(host);
  addEventListener('resize', resize);
  targetGoal.copy(trainMid()); target.copy(targetGoal);
  renderer.shadowMap.needsUpdate = true;

  // fit the loop (and the project buildings just outside it) into the stage, leaving room for the bottom UI
  function fitOverview() {
    const tmp = new THREE.OrthographicCamera(); tmp.position.copy(camDirOverview).multiplyScalar(CAM_DIST); tmp.lookAt(0, 0, 0); tmp.updateMatrixWorld();
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity; const q = new THREE.Vector3();
    [-600, 600].forEach((x) => [-420, 420].forEach((z) => [0, 30].forEach((y) => { q.set(x, y, z).applyMatrix4(tmp.matrixWorldInverse); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); })));
    const inset = isPhone ? 76 : 64; const Hfree = Math.max(1, H - inset);
    const Fv = Math.max((y1 - y0) * (H / Hfree), ((x1 - x0) / W) * H) * 1.06;
    const cy = (y0 + y1) / 2 - (inset / 2) * (Fv / H);
    const p = new THREE.Vector3((x0 + x1) / 2, cy, -CAM_DIST).applyMatrix4(tmp.matrixWorld);
    p.addScaledVector(camDirOverview, -p.y / camDirOverview.y);
    return { F: Fv, target: p.setY(0) };
  }
  addEventListener('resize', () => { if (camMode === 'overview') { const o = fitOverview(); Fgoal = o.F; targetGoal.copy(o.target); } });
  const MODE_F = { ride: isPhone ? 115 : 130, platform: isPhone ? 92 : 104, follow: isPhone ? 150 : 165, closeup: isPhone ? 48 : 50 };
  return {
    stations: line.stations,
    goTo, setViewOffset, resize,
    skip() { if (motion && motion.skip) motion.skip(); },
    isRiding: () => !!motion && !motion.cruise,
    moving: () => !!motion,
    cruise(on) { cruiseOn = !!on && !reduce; if (cruiseOn && dwell > 4) dwell = 4; },
    closeDoors() { doorGoal = 0; },
    view(kind, o = {}) {
      // overview, ride, platform, follow (the idle train), or a destination close-up
      followTrain = kind === 'ride' || kind === 'platform' || kind === 'follow' || kind === 'closeup';
      camMode = kind; onFree && onFree(false);
      if (kind === 'overview') { const o = fitOverview(); Fgoal = o.F; targetGoal.copy(o.target); }
      else if (MODE_F[kind]) Fgoal = userF && kind === 'follow' ? userF : MODE_F[kind];
      if (kind === 'dest' && o.focus) { Fgoal = o.F || (isPhone ? 210 : 230); targetGoal.copy(o.focus).setY(o.focus.y * 0.6); }
      if (o.instant || reduce) { F = Fgoal; if (followTrain) targetGoal.copy(trainMid()); target.copy(targetGoal); if (kind === 'overview') camDir.copy(camDirOverview); applyFrustum(); }
    },
    mode: () => camMode,
    trainPos: () => trainMid(),
    debug: () => ({ target: target.toArray().map(Math.round), train: trainMid().toArray().map(Math.round), camDir: camDir.toArray().map((x) => +x.toFixed(2)), mode: camMode, follow: followTrain, F: Math.round(F), sHead: Math.round(sHead), moving: !!motion }),
    info: () => ({ calls: stats.calls, triangles: stats.triangles, maxCalls: stats.maxCalls, maxTris: stats.maxTris, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, F: Math.round(F), mode: camMode }),
    resetStats() { stats.maxCalls = 0; stats.maxTris = 0; },
    stats() {
      const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const out = [];
      scene.traverse((o) => { if (!o.isMesh || !o.visible) return; if (o.frustumCulled && !fr.intersectsObject(o)) return; const g = o.geometry; const tri = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); out.push([Math.round(tri), o.isInstancedMesh ? 'inst' : 'mesh', o.material.type, o.castShadow ? 'cast' : '']); });
      out.sort((a, b) => b[0] - a[0]); return { count: out.length, top: out.slice(0, 16) };
    },
    projectHover(pick) { // screen position of a pick target (for keyboard and tests)
      const obj = proxies.find((p) => JSON.stringify(p.userData.pick) === JSON.stringify(pick)); if (!obj) return null;
      v.copy(obj.position).project(camera); const r = canvas.getBoundingClientRect(); return [r.left + (v.x * 0.5 + 0.5) * W, r.top + (-v.y * 0.5 + 0.5) * H];
    },
    peek() { // debug: screen positions of a car and an ordinary building near the view centre
      const r = canvas.getBoundingClientRect(); const toScr = (p3) => { v.copy(p3).project(camera); return [r.left + (v.x * 0.5 + 0.5) * W, r.top + (-v.y * 0.5 + 0.5) * H, v.x, v.y]; };
      const inView = (q) => Math.abs(q[2]) < 0.6 && Math.abs(q[3]) < 0.6;
      const mm = new THREE.Matrix4(); const pp = new THREE.Vector3(); let car = null; let bld = null;
      for (let i = 0; i < city.carMesh.count && !car; i++) { city.carMesh.getMatrixAt(i, mm); pp.setFromMatrixPosition(mm).setY(1); const q = toScr(pp); if (inView(q)) car = q; }
      for (const m of city.bldMeshes) { for (let i = 0; i < m.count && !bld; i++) { const b = m.userData.items[i]; if (b.h < 8 || b.h > 30) continue; const q = toScr(new THREE.Vector3(b.x, b.y + b.h + 0.5, b.z)); if (inView(q) && !proxies.some((px) => Math.abs(px.position.x - b.x) < px.scale.x && Math.abs(px.position.z - b.z) < px.scale.z)) bld = q; } if (bld) break; }
      return { car, bld };
    },
    highlight(i) { labelItems.forEach((it) => it.el.classList.toggle('is-current', it.kind === 'st' && it.i === i)); },
    pause() { running = false; }, resume() { running = true; last = performance.now(); },
  };
}
