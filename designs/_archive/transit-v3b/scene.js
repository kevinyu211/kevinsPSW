/* Kevin Metro · engine
   Golden-hour light, a calm orthographic camera, the city, the K Line and one train.
   The canvas is decoration (aria-hidden); every action also exists as an HTML control. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { buildLine, buildCity, buildRail, makeMaterials, TRAIN_LAT, BOUNDS } from './world.js';
import { LANDMARKS, SignAtlas } from './landmarks.js';
import { buildTrain, placeTrain, setDoors, destSignTexture, CAR_LEN, CAR_GAP, DOORS } from './train.js';

const STOP_OFFSET = 41.5; // head of the train stops 41.5 m past the station centre, so the train sits centred
const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

export function createCity(host, opts) {
  const { reduce, isPhone, lineHex, destinations, onPick, onProgress } = opts;
  // phones and low-end machines: fewer things, no shadows, a lower pixel ratio
  const lowEnd = isPhone || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const renderer = new THREE.WebGLRenderer({ antialias: !lowEnd, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(lowEnd ? 1.25 : 2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = !lowEnd;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement; canvas.className = 'city-canvas'; canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const HAZE = new THREE.Color(0xd9e2e7);
  scene.background = HAZE;
  scene.fog = new THREE.Fog(HAZE, 1900, 2550); // the camera sits 1800 m out; far streets melt into haze
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  // golden-hour sun from the south-west, a warm sky fill
  const hemi = new THREE.HemisphereLight(0xdfe9f5, 0xb9a688, 1.15); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffdcb0, 3.1);
  sun.castShadow = !lowEnd;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 1600;
  scene.add(sun, sun.target);
  const sunDir = new THREE.Vector3(-0.55, 0.62, 0.56).normalize();

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 600, 2600); // past the haze nothing is drawn
  const camDirDefault = new THREE.Vector3(0.62, 0.66, 0.75).normalize();
  const camDirOverview = new THREE.Vector3(0.55, 0.92, 0.66).normalize();
  let camMode = 'platform';
  const camDir = camDirDefault.clone();
  const CAM_DIST = 1800;
  const target = new THREE.Vector3(); const targetGoal = new THREE.Vector3();
  let F = isPhone ? 900 : 760; let Fgoal = F;

  /* ---------- build the world ---------- */
  const M = makeMaterials(lineHex);
  const line = buildLine();
  const landmarks = LANDMARKS.map((l) => ({ ...l }));
  const atlas = new SignAtlas();
  const city = buildCity({ scene, M, line, lineHex, isPhone: lowEnd, landmarks, atlas });
  const doorS = (st) => { const out = []; for (let k = 0; k < 4; k++) { const sc = st.s + STOP_OFFSET - CAR_LEN / 2 - k * (CAR_LEN + CAR_GAP); DOORS.forEach((d) => out.push(sc + d)); } return out; };
  const rail = buildRail({ scene, M, line, lineHex, onRoad: city.onRoad, batch: city.batch, doorS });
  city.batch.build(scene);
  const anim = [...city.anim, ...rail.anim];

  // station name boards (line colour, code, English and 中文) into the sign atlas; street totems instanced
  const stCanvas = (st) => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 200; const g = c.getContext('2d');
    g.fillStyle = '#' + new THREE.Color(lineHex).getHexString(); g.fillRect(0, 0, 1024, 200);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(100, 100, 70, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#' + new THREE.Color(lineHex).getHexString(); g.font = '800 58px "Public Sans", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(st.code, 100, 104);
    g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.font = '800 78px "Public Sans", Arial'; g.fillText(st.name, 200, 82);
    g.font = '600 50px "PingFang SC", "Microsoft YaHei", sans-serif'; g.fillText(st.zh, 202, 158);
    return c;
  };
  const totems = [];
  rail.stationParts.forEach((sp) => {
    const st = sp.st; const cv = stCanvas(st);
    if (!sp.underground) {
      [-26, 26].forEach((d) => {
        const a = line.at(st.s + d); const o = new THREE.Object3D(); o.position.copy(a.p).setY(a.p.y + 4.6); o.lookAt(o.position.clone().add(a.n)); o.updateMatrix();
        atlas.add(cv, 5.6, 1.1, 0, 0, 0, 0, { matrix: o.matrix.clone() });
      });
    }
    (sp.totems || []).forEach((t) => totems.push(t));
  });
  atlas.build(scene);
  {
    const kc = document.createElement('canvas'); kc.width = 128; kc.height = 128; const g = kc.getContext('2d'); g.fillStyle = '#' + new THREE.Color(lineHex).getHexString(); g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.font = '800 80px "Public Sans", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('K', 64, 70);
    const kTex = new THREE.CanvasTexture(kc); kTex.colorSpace = THREE.SRGBColorSpace;
    const tm = new THREE.InstancedMesh(new THREE.CircleGeometry(0.75, 24), new THREE.MeshBasicMaterial({ map: kTex, side: THREE.DoubleSide, transparent: true }), totems.length);
    const o = new THREE.Object3D();
    totems.forEach(([x, y, z, ang], i) => { o.position.set(x, y, z); o.rotation.set(0, ang + Math.PI / 4, 0); o.updateMatrix(); tm.setMatrixAt(i, o.matrix); });
    tm.computeBoundingSphere(); scene.add(tm);
  }

  // platform screen doors that line up with the train's doors (on the edge facing the train's track)
  const psdLeaves = []; const psdMat = new THREE.MeshStandardMaterial({ color: 0xbfd6e2, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.45 });
  const psdFrameMat = new THREE.MeshStandardMaterial({ color: 0x8f949b, roughness: 0.35, metalness: 0.85 });
  const psdGeo = new THREE.BoxGeometry(0.06, 2.1, 0.7);
  const psd = new THREE.InstancedMesh(psdGeo, psdMat, line.stations.length * 16 * 2);
  let pi = 0; const m4 = new THREE.Matrix4(); const qq = new THREE.Quaternion(); const yAx = new THREE.Vector3(0, 1, 0);
  line.stations.forEach((st, si) => {
    doorS(st).forEach((s) => [-1, 1].forEach((half) => {
      const a = line.at(s); const p = a.p.clone().add(a.n.clone().multiplyScalar(Math.sign(TRAIN_LAT) * 3.3)); p.y += 1.1 + 1.05;
      qq.setFromAxisAngle(yAx, Math.atan2(a.t.x, a.t.z));
      psdLeaves.push({ si, p, t: a.t.clone(), half, idx: pi, q: qq.clone() });
      m4.compose(p.clone().addScaledVector(a.t, half * 0.36), qq, new THREE.Vector3(1, 1, 1)); psd.setMatrixAt(pi, m4); pi++;
    }));
  });
  scene.add(psd);
  const setPSD = (si, amount) => {
    psdLeaves.forEach((l) => { if (l.si !== si) return; m4.compose(l.p.clone().addScaledVector(l.t, l.half * (0.36 + 0.66 * amount)), l.q, new THREE.Vector3(1, 1, 1)); psd.setMatrixAt(l.idx, m4); });
    psd.instanceMatrix.needsUpdate = true;
  };

  // the tunnel's route drawn faintly on the streets, the way a transit map shows a subway below
  {
    const pos = [];
    for (let s = 0; s < line.portalS; s += 6) { const a = line.at(s); pos.push(a.p.x, a.p.z, Math.atan2(a.t.x, a.t.z)); }
    const dash = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.05, 3.4), new THREE.MeshBasicMaterial({ color: lineHex, transparent: true, opacity: 0.42, depthWrite: false }), pos.length / 3);
    for (let i = 0; i < pos.length / 3; i++) { m4.compose(new THREE.Vector3(pos[i * 3], 0.32, pos[i * 3 + 1]), qq.setFromAxisAngle(yAx, pos[i * 3 + 2]), new THREE.Vector3(1, 1, 1)); dash.setMatrixAt(i, m4); }
    dash.renderOrder = 2; scene.add(dash);
  }

  /* ---------- the train ---------- */
  const train = buildTrain({ lineHex, cars: 4, platformSide: Math.sign(-TRAIN_LAT) });
  scene.add(train.group, train.ghost);
  let sHead = line.stations[0].s + STOP_OFFSET;
  let ends = placeTrain(train, line, sHead, TRAIN_LAT);
  let curIdx = 0;
  const setSign = (text) => train.cars.forEach((c) => { if (c.sign) { c.sign.material.map.dispose(); c.sign.material.map = destSignTexture(text); c.sign.material.needsUpdate = true; } });
  setSign(`Kevin Metro · ${line.stations[0].name}`);
  const platformSide = (si) => {
    // which side of the car (local +x is +1) faces the island platform
    const c = train.cars[0].car; const x = new THREE.Vector3(1, 0, 0).applyQuaternion(c.quaternion);
    const toP = line.at(line.stations[si].s).p.clone().sub(c.position); return x.dot(toP) > 0 ? 1 : -1;
  };
  let doorAmt = 0; let doorGoal = 0;
  let ride = null;
  const trainMid = () => { const m = new THREE.Vector3(); ends.forEach((e) => m.add(e.mid)); return m.multiplyScalar(1 / ends.length); };

  const fade = document.createElement('div'); fade.className = 'ride-cut'; fade.setAttribute('aria-hidden', 'true'); host.appendChild(fade);

  function goTo(index, { instant = false } = {}) {
    const st = line.stations[index];
    const sT = st.s + STOP_OFFSET;
    return new Promise((resolve) => {
      if (ride) ride.cancel = true;
      setPSD(curIdx, 0);
      const arrive = () => {
        sHead = sT; ends = placeTrain(train, line, sHead, TRAIN_LAT); curIdx = index;
        onProgress && onProgress(index);
        doorGoal = 1; doorSide = platformSide(index);
        ride = null; resolve();
      };
      setSign(`${st.code}  ${st.name}`);
      if (instant || reduce || Math.abs(sT - sHead) < 0.5) {
        doorAmt = 0; doorGoal = 0; arrive();
        targetGoal.copy(trainMid()); if (instant || reduce) target.copy(targetGoal);
        if (reduce) { doorAmt = 1; }
        return;
      }
      const from = sHead; const D = sT - from; const dist = Math.abs(D);
      const long = dist > 950;
      const r = { cancel: false };
      ride = r;
      doorGoal = 0;
      // stage 1: doors close; stage 2: ride (with a cinematic cut on long journeys)
      const legs = long ? [[from, from + Math.sign(D) * 260, 'in'], [sT - Math.sign(D) * 300, sT, 'out']] : [[from, sT, 'both']];
      const durOf = (len, kind) => (kind === 'both' ? Math.min(11, Math.max(6, 4.5 + len / 85)) : 5.2);
      let leg = 0; let t0 = -1;
      r.step = (now) => {
        if (r.cancel) return;
        if (doorAmt > 0.02) return; // wait for doors to close
        if (t0 < 0) t0 = now;
        const [a, b, kind] = legs[leg]; const dur = durOf(Math.abs(b - a), kind);
        const p = Math.min(1, (now - t0) / dur);
        const e = kind === 'both' ? ease(p) : kind === 'in' ? p * p : 1 - (1 - p) * (1 - p);
        const prev = sHead; sHead = a + (b - a) * e;
        ends = placeTrain(train, line, sHead, TRAIN_LAT, Math.abs(sHead - prev));
        const f = line.stations.reduce((acc, s2, i) => (sHead - STOP_OFFSET >= s2.s ? i + (i < line.stations.length - 1 ? Math.min(1, (sHead - STOP_OFFSET - s2.s) / (line.stations[i + 1].s - s2.s)) : 0) : acc), 0);
        onProgress && onProgress(f);
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
  let doorSide = 1;

  /* ---------- labels: stations and destinations, crisp HTML pinned to the world ---------- */
  const tags = document.createElement('div'); tags.className = 'tags'; tags.setAttribute('aria-hidden', 'true'); host.appendChild(tags);
  const labelItems = [];
  line.stations.forEach((st, i) => {
    const el = document.createElement('button'); el.type = 'button'; el.tabIndex = -1; el.className = 'tag tag-st';
    el.innerHTML = '';
    const b = document.createElement('i'); b.className = 'kb'; b.textContent = st.code;
    const n = document.createElement('span'); n.textContent = st.name;
    el.append(b, n);
    el.addEventListener('click', () => onPick && onPick({ type: 'station', index: i }));
    tags.append(el);
    const under = st.y < -6.2; const a = line.at(st.s);
    labelItems.push({ el, pos: under ? a.p.clone().setY(9) : a.p.clone().setY(a.p.y + 9), kind: 'st', i });
  });
  destinations.forEach((d) => {
    const lm = landmarks.find((l) => l.id === d.landmark); if (!lm || !lm.focus) return;
    const el = document.createElement('button'); el.type = 'button'; el.tabIndex = -1; el.className = `tag tag-dest c-${d.color}`;
    const dot = document.createElement('i'); dot.className = 'dot';
    const n = document.createElement('span'); n.textContent = d.name;
    el.append(dot, n);
    el.addEventListener('click', () => onPick && onPick({ type: 'dest', id: d.id }));
    tags.append(el);
    labelItems.push({ el, pos: lm.focus.clone().setY(lm.focus.y + 14), kind: 'dest', id: d.id });
    d.focus = lm.focus.clone();
  });
  const v = new THREE.Vector3();

  /* ---------- picking landmarks in 3D ---------- */
  const hitBoxes = [];
  destinations.forEach((d) => { if (!d.focus) return; const h = new THREE.Mesh(new THREE.BoxGeometry(60, 40, 60), new THREE.MeshBasicMaterial({ visible: false })); h.position.copy(d.focus).setY(14); h.userData.dest = d.id; scene.add(h); hitBoxes.push(h); });
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener('click', (e) => {
    if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return; // a drag, not a click
    const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); const hit = ray.intersectObjects(hitBoxes, false)[0];
    if (hit && onPick) onPick({ type: 'dest', id: hit.object.userData.dest });
  });

  /* ---------- free roam ---------- */
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false; controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minZoom = 0.55; controls.maxZoom = 6; controls.minPolarAngle = 0.55; controls.maxPolarAngle = 1.2;
  controls.screenSpacePanning = false;
  let free = false;
  function setFreeRoam(on) {
    free = on; controls.enabled = on;
    if (on) { controls.target.copy(target); camera.zoom = 1; camera.updateProjectionMatrix(); controls.update(); }
    else { camera.zoom = 1; camera.updateProjectionMatrix(); camDir.copy(camDirDefault); }
  }

  /* ---------- size and loop ---------- */
  let W = 1; let H = 1; let offX = 0;
  function resize() {
    const r = host.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false); canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    applyFrustum();
  }
  function applyFrustum() {
    const aspect = W / H;
    camera.left = (-F * aspect) / 2; camera.right = (F * aspect) / 2; camera.top = F / 2; camera.bottom = -F / 2;
    if (offX) camera.setViewOffset(W + offX, H, offX, 0, W, H); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    const sh = Math.min(520, Math.max(130, F * 0.62 * Math.max(1, aspect)));
    const sc = sun.shadow.camera; if (Math.abs(sc.right - sh) > 4) { sc.left = -sh; sc.right = sh; sc.top = sh; sc.bottom = -sh; sc.updateProjectionMatrix(); }
  }
  function setViewOffset(px) { offX = Math.max(0, px | 0); applyFrustum(); }

  let running = true; let visible = true; let last = performance.now(); let clock = 0; let acc = 0;
  const minFrame = isPhone ? 1 / 40 : 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!running || !visible || document.hidden) { last = now; return; }
    const rdt = Math.min(0.25, (now - last) / 1000); last = now;
    acc += rdt; if (acc < minFrame) return; const real = acc; acc = 0;
    const step = Math.min(0.05, real);
    clock += step;
    const tnow = clock; const wall = now / 1000;
    if (ride && ride.step) { if (!ride.pauseUntil || wall > ride.pauseUntil) ride.step(wall); }
    // doors: train and platform screen doors move together
    const dSpeed = reduce ? 10 : 1.2;
    if (doorAmt !== doorGoal) { doorAmt = doorGoal > doorAmt ? Math.min(doorGoal, doorAmt + real * dSpeed) : Math.max(doorGoal, doorAmt - real * dSpeed * 1.4); setDoors(train, doorSide, ease(doorAmt)); setPSD(curIdx, ease(doorAmt)); }
    // underground: show the x-ray train
    const under = ends.some((e) => e.mid.y < -3);
    train.ghost.visible = under;
    // camera direction: a low side three-quarter view of the train while riding and at the platform
    const sideMode = (camMode === 'ride' || camMode === 'platform' || camMode === 'closeup') && !free;
    if (sideMode && ends.length) {
      const t = ends[0].fwd.clone().setY(0).normalize(); const out = new THREE.Vector3(t.z, 0, -t.x).multiplyScalar(Math.sign(TRAIN_LAT));
      const hz = out.multiplyScalar(0.84).addScaledVector(t, 0.54).normalize(); const el = camMode === 'ride' ? 0.36 : 0.41;
      dirGoal.set(hz.x * Math.cos(el), Math.sin(el), hz.z * Math.cos(el));
    } else dirGoal.copy(camMode === 'overview' ? camDirOverview : camDirDefault);
    if (!free) camDir.lerp(dirGoal, reduce ? 1 : 1 - Math.exp(-real * 1.3)).normalize();
    // cut open whatever stands between the camera and the train
    if (sideMode) { const m = trainMid(); city.uni.uCut.value.set(m.x, Math.max(m.y, 0) + 0.5, m.z, 30); city.uni.uCamDir.value.copy(camDir); } else city.uni.uCut.value.w = 0;
    // calm camera: follow the train during rides, glide elsewhere
    if (!free) {
      if (ride || followTrain) targetGoal.copy(trainMid()).setY(Math.max(0, trainMid().y));
      const k = reduce ? 1 : 1 - Math.exp(-real * 1.4);
      target.lerp(targetGoal, k);
      F += (Fgoal - F) * (reduce ? 1 : 1 - Math.exp(-real * 1.1));
      applyFrustum();
      camera.position.copy(target).addScaledVector(camDir, CAM_DIST); camera.lookAt(target);
    } else {
      controls.update();
      controls.target.x = Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, controls.target.x));
      controls.target.z = Math.max(BOUNDS.z0, Math.min(BOUNDS.z1, controls.target.z));
      target.copy(controls.target);
    }
    sun.position.copy(target).addScaledVector(sunDir, 900); sun.target.position.copy(target);
    if (!reduce) anim.forEach((f) => f(tnow, step));
    renderer.render(scene, camera);
    // labels
    const showDest = F * (free ? 1 / camera.zoom : 1) < 480;
    labelItems.forEach((it) => {
      v.copy(it.pos).project(camera);
      const x = (v.x * 0.5 + 0.5) * W; const y = (-v.y * 0.5 + 0.5) * H;
      const off = x < -60 || x > W + 60 || y < -30 || y > H + 30 || (it.kind === 'dest' && !showDest);
      it.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      it.el.style.visibility = off ? 'hidden' : 'visible';
    });
  }
  let followTrain = true;
  const dirGoal = new THREE.Vector3();
  resize(); requestAnimationFrame(frame);
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 }).observe(host);
  addEventListener('resize', resize);
  targetGoal.copy(trainMid()); target.copy(targetGoal);

  return {
    stations: line.stations,
    goTo, setFreeRoam, setViewOffset, resize,
    skip() { if (ride && ride.skip) ride.skip(); },
    isRiding: () => !!ride,
    closeDoors() { doorGoal = 0; },
    view(kind, opts = {}) {
      // overview, ride, platform, or a destination close-up
      followTrain = kind !== 'dest' && kind !== 'overview';
      camMode = kind;
      if (kind === 'overview') { Fgoal = isPhone ? 900 : 760; targetGoal.set(60, 0, -20); }
      if (kind === 'ride') Fgoal = isPhone ? 105 : 125;
      if (kind === 'platform') Fgoal = isPhone ? 85 : 100;
      if (kind === 'closeup') Fgoal = isPhone ? 46 : 48;
      if (kind === 'dest' && opts.focus) { Fgoal = isPhone ? 190 : 210; targetGoal.copy(opts.focus).lerp(trainMid().setY(0), 0.35); }
      if (opts.instant || reduce) { F = Fgoal; target.copy(targetGoal); if (followTrain) target.copy(trainMid()); applyFrustum(); }
    },
    focusOn(pos, f) { followTrain = false; camMode = 'dest'; targetGoal.set(pos.x, pos.y || 0, pos.z); Fgoal = f; },
    portal() { const a = line.at(line.portalS + 12); return a.p.clone().setY(0); },
    trainPos: () => trainMid(),
    info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }),
    stats() {
      const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const out = [];
      scene.traverse((o) => { if (!o.isMesh || !o.visible) return; if (o.frustumCulled && !fr.intersectsObject(o)) return; const g = o.geometry; const tri = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); out.push([Math.round(tri), o.isInstancedMesh ? 'inst' : 'mesh', o.material.type, o.material.vertexColors ? 'vc' : '', o.castShadow ? 'cast' : '', g.attributes.position.count]); });
      out.sort((a, b) => b[0] - a[0]); return out.slice(0, 14);
    },
    highlight(i) { labelItems.forEach((it) => it.el.classList.toggle('is-current', it.kind === 'st' && it.i === i)); },
    pause() { running = false; }, resume() { running = true; last = performance.now(); },
  };
}
