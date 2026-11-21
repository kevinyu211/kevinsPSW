/* Kevin Metro · engine
   Soft daylight, an orthographic camera you can pan, turn through 360°, tilt from 20° to straight down and
   zoom like a maps app, the city, six metro lines and a train on each. The trains and the visitor's trip come
   from sim.js; this file only draws them. Nothing is ever hidden to keep the train in view: when a train
   passes behind a building its silhouette shows through in the line colour. The canvas is decoration
   (aria-hidden); every action also exists as an HTML control. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { MAP_SIDE, STOP, TRACK_LAT } from './network.js';
import { WORLD, PLOTS } from './city-data.js';
import { buildCity, buildLines, makeMaterials } from './world.js';
import { LANDMARKS, SignAtlas, PhotoAtlas } from './landmarks.js';
import { placeModels, placeKit } from './models.js';
import { buildTrain, buildFleet, placeTrain, setDoors, destSignTexture } from './train.js';

const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const PH_MIN = 0.35; const PH_MAX = 1.553; // 20° above the ground to straight down

export function createCity(host, opts) {
  const { reduce, isPhone, destinations, sim, onPick, onHover, onFree, onCam, lib } = opts;
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
  const hemi = new THREE.HemisphereLight(0xe6eef8, 0xcbbfa8, 1.45); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe9cf, 2.7);
  sun.castShadow = !lowEnd; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6; sun.shadow.radius = 3;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 1900;
  scene.add(sun, sun.target);
  const sunDir = new THREE.Vector3(0.5, 0.56, 0.62).normalize(); // over the sea, from the south-east

  /* ---------- the world ---------- */
  const net = sim.net;
  const M = makeMaterials(0x0039a6);
  const landmarks = LANDMARKS.map((l) => ({ ...l }));
  const atlas = new SignAtlas(); const photos = new PhotoAtlas();
  const city = buildCity({ scene, M, net, isPhone: lowEnd, landmarks, atlas, photos, lib });
  const rails = buildLines({ M, net, pierOK: city.pierOK, onRoad: city.onRoad, batch: city.batch, lib, atlas });
  // the model library: kit buildings and props (instanced), the project buildings and the station modules
  const models = placeModels({ lib, scene, landmarks, stations: rails.stations, photos, signs: atlas, isPhone: lowEnd });
  const kitSet = placeKit({ lib, scene, items: city.kitItems, isPhone: lowEnd });
  // from far away only the towers cast shadows: the small ones cost draw calls and cannot be seen
  const nearCasters = [...models.meshes.filter((m) => m.castShadow), ...kitSet.sets.filter((q) => q.im.castShadow && q.tall < 100).map((q) => q.im)]; let nearCast = true;
  city.batch.build(scene);
  atlas.build(scene);
  const anim = [...city.anim];
  const screens = [...models.screens];
  // the observatory dome turns slowly; the cranes on the empty plots swing
  anim.push((tt) => models.spin.forEach((sp) => { sp.mesh.rotation.y = sp.kind === 'dome' ? sp.yaw + tt * 0.06 : sp.yaw + Math.sin(tt * 0.1 + sp.seed) * 1.1; }));
  scene.traverse((o) => { if (!o.matrixAutoUpdate) o.matrixWorldNeedsUpdate = true; });
  // the city's fixed parts that cast shadows (viaducts, piers, quays): in the widest views only the towers still do
  const farCasters = []; { const skip = new Set([...models.meshes, ...kitSet.sets.map((q) => q.im)]); scene.traverse((o) => { if (o.isMesh && o.castShadow && !skip.has(o)) farCasters.push(o); }); }
  const platforms = net.lines.flatMap((l) => l.stations);
  const nodes = net.stations.map((st) => ({ st, x: st.pos[0], z: st.pos[1], inter: st.lines.length > 1, hex: net.byId[st.lines[0]].def.hex }));
  const mapAmt = 0; const m4 = new THREE.Matrix4();

  /* ---------- trains: every line's own train, all the time. The one the visitor rides (or watches) is the
     detailed model with doors; the others are a light instanced fleet. Each also has a silhouette. ---------- */
  const fleet = buildFleet(net.lines); fleet.meshes.forEach((m) => scene.add(m));
  const train = buildTrain({ lineHex: net.lines[0].def.hex, cars: 4, platformSide: Math.sign(TRACK_LAT) });
  train.group.traverse((o) => { o.renderOrder = 6; }); scene.add(train.group);
  let detail = null; let showDetail = true; let ends = null; let lastDoors = -1;
  const setSign = (text) => train.cars.forEach((c) => { if (c.sign) { c.sign.material.map.dispose(); c.sign.material.map = destSignTexture(text); c.sign.material.needsUpdate = true; } });
  const headOf = (t) => t.s + t.dir * STOP;
  const trainMid = () => { if (ends) { const m = new THREE.Vector3(); ends.forEach((e) => m.add(e.mid)); return m.multiplyScalar(1 / ends.length); } return sim.trainPoint(detail || sim.trains[0]); };
  // which train gets the detailed model: the one the visitor is on or waiting for, else the one being watched
  let watch = null;
  const wantDetail = () => { const tr = sim.trip; if (sim.pax.aboard) return sim.trainOf(sim.pax.aboard); if (tr && tr.called && tr.legs[tr.k]) return sim.trainOf(tr.legs[tr.k].line); if (tr && detail) return detail; return sim.trainOf(watch || sim.pax.line); };
  function drawTrains() {
    const want = wantDetail();
    if (want !== detail) { detail = want; train.setLine(detail.line.def.hex); lastDoors = -1; const tr = sim.trip; setSign(`${detail.line.def.no}  ${tr && tr.legs[tr.k] && tr.legs[tr.k].line === detail.line.id ? net.stById[tr.legs[tr.k].to].name : detail.line.def.label}`); }
    sim.trains.forEach((t) => fleet.place(t.li, t.line, headOf(t), TRACK_LAT, t.dir, showDetail && t === detail));
    fleet.flush();
    train.group.visible = showDetail;
    if (showDetail) { ends = placeTrain(train, detail.line, headOf(detail), TRACK_LAT, detail.dir); if (detail.doors !== lastDoors) { lastDoors = detail.doors; setDoors(train, 1, ease(detail.doors)); } } else ends = null;
  }

  /* ---------- the passenger: the visitor's pin. Always drawn on top, sized to stay readable ---------- */
  const pin = new THREE.Group();
  { const mat = (hex) => new THREE.MeshBasicMaterial({ color: hex, depthTest: false, depthWrite: false, transparent: true, toneMapped: false, fog: false });
    const stem = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 12), mat(0x0039a6)); stem.rotation.x = Math.PI; stem.position.y = 0.75;
    const rim = new THREE.Mesh(new THREE.SphereGeometry(1.25, 14, 10), mat(0xffffff)); rim.position.y = 2.3;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.98, 14, 10), mat(0x0039a6)); head.position.y = 2.3;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), mat(0xffffff)); dot.position.y = 2.3;
    [stem, rim, head, dot].forEach((m, i) => { m.renderOrder = 30 + i; pin.add(m); }); }
  scene.add(pin);
  // the way the passenger is walking (through an interchange): a dotted trail, drawn on top
  const trail = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0x0039a6, size: isPhone ? 7 : 6, sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true, toneMapped: false, fog: false }));
  trail.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(120 * 3), 3)); trail.frustumCulled = false; trail.renderOrder = 28; trail.visible = false; scene.add(trail);
  let trailOf = null;
  const drawTrail = () => {
    const P = sim.walkPath(); if (P === trailOf) return; trailOf = P; trail.visible = !!P && P.length > 2; if (!trail.visible) return;
    const a = trail.geometry.attributes.position; let n = 0;
    for (let i = 1; i < P.length && n < 120; i++) { const len = P[i].distanceTo(P[i - 1]); const m = Math.max(1, Math.round(len / 2.4)); for (let k = 0; k < m && n < 120; k++) { const q = P[i - 1].clone().lerp(P[i], k / m); a.setXYZ(n++, q.x, q.y + 0.6, q.z); } }
    trail.geometry.setDrawRange(0, n); a.needsUpdate = true;
  };

  /* ---------- the route of the current trip: a bright stroke over its lines, a pale veil over the rest ---------- */
  const routeU = { uW: { value: 6 } };
  const ribbonMat = (opacity, depthTest) => new THREE.ShaderMaterial({ uniforms: { uW: routeU.uW, uS: { value: 1 }, uOp: { value: opacity } }, transparent: true, depthTest, depthWrite: false,
    vertexShader: 'attribute vec3 aN; attribute float aSide; attribute vec3 aCol; uniform float uW; uniform float uS; varying vec3 vCol; void main(){ vec3 p = position + aN * aSide * uW * uS * 0.5; vCol = aCol; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
    fragmentShader: 'uniform float uOp; varying vec3 vCol; void main(){ gl_FragColor = vec4(vCol, uOp);\n#include <colorspace_fragment>\n}' });
  const routeGroup = new THREE.Group(); scene.add(routeGroup);
  // pieces: [line, s0, s1] in the direction of travel
  const ribbonGeo = (pieces, colOf, lat, dy) => {
    const pos = []; const nrm = []; const side = []; const colr = []; const idx = []; let base = 0; const c = new THREE.Color();
    pieces.forEach(([l, s0, s1]) => {
      const len = s1 - s0; const n = Math.max(2, Math.ceil(Math.abs(len) / 6)); c.setHex(colOf(l));
      for (let i = 0; i <= n; i++) { const a = l.at(s0 + (len * i) / n); const p = a.p.addScaledVector(a.n, lat); [-1, 1].forEach((sg) => { pos.push(p.x, p.y + dy, p.z); nrm.push(a.n.x, 0, a.n.z); side.push(sg); colr.push(c.r, c.g, c.b); }); if (i < n) { const k = base + i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } }
      base += (n + 1) * 2;
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aN', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1)); g.setAttribute('aCol', new THREE.Float32BufferAttribute(colr, 3)); g.setIndex(idx); return g;
  };
  function setRoute(legs) {
    routeGroup.children.slice().forEach((m) => { m.geometry.dispose(); m.material.dispose(); routeGroup.remove(m); });
    if (!legs || !legs.length) return;
    const on = []; const off = [];
    net.lines.forEach((l) => {
      const mine = legs.filter((lg) => lg.line === l.id).map((lg) => { const a = net.stopOn(l.id, lg.from).s; let b = net.stopOn(l.id, lg.to).s; if (l.closed && b < a) b += l.L; return [Math.min(a, b), Math.max(a, b)]; });
      mine.forEach(([a, b]) => on.push([l, a, b]));
      if (!mine.length) { off.push([l, 0, l.L]); return; }
      if (l.closed) { const [a, b] = mine[0]; off.push([l, b, a + l.L]); } else { const lo = Math.min(...mine.map((m) => m[0])); const hi = Math.max(...mine.map((m) => m[1])); if (lo > 1) off.push([l, 0, lo]); if (hi < l.L - 1) off.push([l, hi, l.L]); }
    });
    const veil = new THREE.Mesh(ribbonGeo(off, () => 0xf4f3ef, 0, 1.08), ribbonMat(0.5, true)); veil.material.uniforms.uS.value = 0; veil.material.uniforms.uW = { value: 12.4 }; veil.material.uniforms.uS.value = 1; veil.renderOrder = 3;
    const casing = new THREE.Mesh(ribbonGeo(on, () => 0xffffff, 0, 1.3), ribbonMat(0.9, false)); casing.material.uniforms.uS.value = 1.8; casing.renderOrder = 20;
    const stroke = new THREE.Mesh(ribbonGeo(on, (l) => l.def.hex, 0, 1.3), ribbonMat(0.95, false)); stroke.renderOrder = 21;
    [veil, casing, stroke].forEach((m) => { m.frustumCulled = false; routeGroup.add(m); });
  }

  /* ---------- the camera: target on the ground, azimuth, elevation, zoom ---------- */
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 400, 3400);
  const CAM_DIST = 1800;
  const target = new THREE.Vector3(); const targetGoal = new THREE.Vector3();
  const OV = isPhone ? { th: 1.5, ph: 0.95 } : { th: 0.98, ph: 0.8 };
  let th = OV.th; let ph = OV.ph; let thG = th; let phG = ph;
  let F = isPhone ? 1500 : 1100; let Fgoal = F;
  const F_MIN = 40; const F_MAX = 4000; // the real ceiling is capF(): the view may never leave the world
  // overview: the whole city, framed. free: wherever the visitor left it. follow: stays with the passenger or
  // one line's train, looking along the track. focus: one building. dest: a look at one place.
  let camMode = 'overview'; let focusOn = false; let followSub = null; let followTh = OV.th; let thOff = 0;
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
  function resize() { const r = host.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); renderer.setSize(W, H, false); canvas.style.width = `${W}px`; canvas.style.height = `${H}px`; applyFrustum(); if (camMode === 'overview') { const o = fit(OV.th, OV.ph, false); Fgoal = o.F; targetGoal.copy(o.target); } labelItems.forEach((it) => { it.w = 0; }); }
  // fit the city (or the whole network map) into the stage, leaving room for the bottom UI
  function fit(t, p, whole) {
    const tmp = new THREE.OrthographicCamera(); placeCam(tmp, new THREE.Vector3(), t, p);
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity; const q = new THREE.Vector3();
    const C = WORLD.city;
    [C.x0, C.x1].forEach((x) => [C.z0, C.z1].forEach((z) => [0, whole ? 0 : 70].forEach((y) => { q.set(x, y, z).applyMatrix4(tmp.matrixWorldInverse); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); })));
    const inset = isPhone ? 78 : 70; const Hf = Math.max(1, H - inset);
    const Fv = Math.max((y1 - y0) * (H / Hf), ((x1 - x0) / W) * H) * (whole ? (isPhone ? 1.2 : 1.04) : 0.84);
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
    d.focus = lm.focus.clone(); d.hit = lm.hit; d.face = lm.toLine; d.focusF = lm.focusF || 0;
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
  PLOTS.forEach((pl) => {
    const lm = lmById[pl.id]; if (!lm || !lm.hit) return;
    const h = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), hitMat); h.position.copy(lm.hit.center); h.scale.copy(lm.hit.size); h.userData.pick = { type: 'plot', id: pl.id }; h.updateMatrixWorld(); proxies.push(h);
    const el = document.createElement('span'); el.className = 'tag tag-plot'; el.textContent = 'Next project'; tags.append(el);
    labelItems.push({ el, pos: new THREE.Vector3(lm.hit.center.x, lm.hit.size.y + 4, lm.hit.center.z), kind: 'plot', id: pl.id });
  });
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

  /* ---------- input: drag pans, right-drag (or shift-drag) turns and tilts, the wheel zooms; on touch one
     finger pans, two fingers turn, pinch and tilt. Keys and the on-screen cluster call the same moves. ---------- */
  const pts = new Map(); let downAt = null; let grab = null; let pinch = null; let rot = null; const vel = new THREE.Vector3(); let lastPan = 0;
  /* Camera limits. The view's footprint on the ground is a rectangle turned by the azimuth; its bounding box
     must stay inside WORLD.safe, where there is always city, suburb, forest or sea. So: the widest zoom is
     the smaller of "the whole city plus a small margin" and "what still fits in the safe rectangle" at this
     turn and tilt; and the target is clamped so the footprint cannot slide out. */
  const SAFE = WORLD.safe; const fitC = { t: 99, p: 99, w: 0, h: 0, F: 1000 };
  const half = (t, p, Fv) => { const asp = (W + offX) / H; const a = (Fv * asp) / 2; const b = Fv / (2 * Math.max(0.25, Math.sin(p))); return [Math.abs(Math.cos(t)) * a + Math.abs(Math.sin(t)) * b, Math.abs(Math.sin(t)) * a + Math.abs(Math.cos(t)) * b]; };
  const capF = (t, p) => {
    if (Math.abs(t - fitC.t) > 0.01 || Math.abs(p - fitC.p) > 0.01 || fitC.w !== W || fitC.h !== H) { fitC.t = t; fitC.p = p; fitC.w = W; fitC.h = H; fitC.F = fit(t, p, p > 1.3).F; }
    const [hx, hz] = half(t, p, 1); return Math.min(((SAFE.x1 - SAFE.x0) / 2 / hx) * 0.98, ((SAFE.z1 - SAFE.z0) / 2 / hz) * 0.98, fitC.F * 1.06);
  };
  const clampTarget = (tg, t = th, p = ph, Fv = F) => {
    // the centre of the view never leaves the city itself, so the city is always in the frame
    const C = WORLD.city; tg.x = Math.max(C.x0, Math.min(C.x1, tg.x)); tg.z = Math.max(C.z0, Math.min(C.z1, tg.z));
    const [hx, hz] = half(t, p, Fv); const lx = SAFE.x0 + hx; const ux = SAFE.x1 - hx; const lz = SAFE.z0 + hz; const uz = SAFE.z1 - hz;
    tg.x = lx > ux ? (SAFE.x0 + SAFE.x1) / 2 : Math.max(lx, Math.min(ux, tg.x)); tg.z = lz > uz ? (SAFE.z0 + SAFE.z1) / 2 : Math.max(lz, Math.min(uz, tg.z));
  };
  const following = () => camMode === 'follow';
  const goFree = () => { if (camMode !== 'free') { camMode = 'free'; followSub = null; focusOn = false; onFree && onFree(true); } };
  // turning and tilting never stop a follow: the camera keeps the train and takes the new angle
  const orbit = (dth, dph) => { if (following()) thOff += dth; else { thG += dth; if (camMode === 'overview' || camMode === 'focus' || camMode === 'dest') goFree(); } phG = Math.max(PH_MIN, Math.min(PH_MAX, phG + dph)); };
  const zoomAt = (factor, cx, cy, soft) => {
    const base = soft ? Fgoal : F; const nf = Math.max(F_MIN, Math.min(F_MAX, capF(th, ph), base * factor)); if (Math.abs(nf - base) < 0.01) return;
    if (soft || following()) { Fgoal = nf; if (!soft) F = nf; if (camMode === 'overview') goFree(); return; }
    const before = groundAt(cx, cy); F = nf; Fgoal = nf; applyFrustum(); placeCamera();
    const after = groundAt(cx, cy); target.add(before.sub(after)).setY(0); clampTarget(target); targetGoal.copy(target); placeCamera();
    if (camMode !== 'free') goFree();
  };
  // a pan in screen directions (right, up), in metres on the ground
  const panBy = (right, up) => { const fx = -Math.sin(th); const fz = -Math.cos(th); const rx = Math.cos(th); const rz = -Math.sin(th); goFree(); targetGoal.x += rx * right + fx * up; targetGoal.z += rz * right + fz * up; clampTarget(targetGoal, thG, phG, Fgoal); };
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
      orbit(angDiff(pinch.ang, ang) * 0.8, (my - pinch.my) * 0.0058); pinch.ang = ang; pinch.my = my; return;
    }
    if (!downAt) return;
    if (!dragging && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) { dragging = true; showHL(null); onHover && onHover(null); canvas.style.cursor = 'grabbing'; if (!rot) goFree(); }
    if (!dragging) return;
    if (rot) { orbit(-(e.clientX - rot[0]) * 0.0062, (e.clientY - rot[1]) * 0.0048); rot = [e.clientX, e.clientY]; return; }
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
    if (ch) { const p = city.honk(ch.instanceId); if (p) { pulseAt.copy(p); pulseT = 0; pulse.visible = true; say('Beep', p.clone().setY(4)); } }
  });
  canvas.addEventListener('pointercancel', endPtr);
  canvas.addEventListener('pointerleave', () => { pointer = null; hoverDirty = true; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX, e.clientY); }, { passive: false });
  canvas.style.cursor = 'grab';
  // held keys and held buttons: { right, up, turn, tilt, zoom } each -1, 0 or 1
  const held = { right: 0, up: 0, turn: 0, tilt: 0, zoom: 0 };

  /* ---------- the frame ---------- */
  let running = true; let visible = true; let last = performance.now(); let clock = 0; let acc = 0; let frameNo = 0;
  const minFrame = 0; // every frame the browser offers: a cap below the display rate halves it (40 → 30 on a 60 Hz phone)
  const frustum = new THREE.Frustum(); const pm = new THREE.Matrix4();
  const lastCam = new THREE.Vector3(); let lastF = 0; let lastTh = 0; let lastPh = 0; let farLod = false; let fps = 60;
  const stats = { calls: 0, triangles: 0, maxCalls: 0, maxTris: 0, frames: 0 };
  const cull = { shown: 0, v: new THREE.Vector3() };
  function frame(now) {
    requestAnimationFrame(frame);
    if (!running || !visible || document.hidden) { last = now; return; }
    const rdt = Math.min(0.25, (now - last) / 1000); last = now;
    acc += rdt; if (acc < minFrame) return; const real = acc; acc = 0;
    const step = Math.min(0.05, real); clock += step; frameNo++; stats.frames++; fps += (1 / Math.max(real, 0.001) - fps) * 0.05;
    sim.advance(now);
    showDetail = F < 560;
    drawTrains();
    { const mid = trainMid(); trainProxy.position.copy(mid).setY(mid.y + 2.6); if (ends) trainProxy.quaternion.copy(train.cars[1].car.quaternion); trainProxy.updateMatrixWorld(); trainProxy.userData.pick.line = detail.line.id; }
    // held keys
    if (held.right || held.up) panBy(held.right * F * 0.9 * real, held.up * F * 0.9 * real);
    if (held.turn || held.tilt) orbit(held.turn * 1.5 * real, held.tilt * 0.9 * real);
    if (held.zoom) zoomAt(Math.exp(held.zoom * 1.4 * real), W / 2, H / 2, true);
    // following: stay with the passenger or a train, behind it and a little to one side, looking along the track
    if (camMode === 'follow') {
      let pos; let fwd = null;
      if (followSub === 'pax') { pos = sim.pax.pos; const lid = sim.pax.aboard; if (lid) { const t = sim.trainOf(lid); fwd = t.line.at(t.s).t.multiplyScalar(t.dir); } }
      else { const t = sim.trainOf(followSub); pos = sim.trainPoint(t); if (t.hop) fwd = t.line.at(t.s).t.multiplyScalar(Math.sign(t.hop.b - t.hop.a) || 1); }
      targetGoal.set(pos.x, 0, pos.z);
      if (fwd) followTh += angDiff(followTh, Math.atan2(-fwd.x, -fwd.z) + 0.42) * (reduce ? 1 : 1 - Math.exp(-real * 0.9));
      thG = followTh + thOff;
    }
    const kA = reduce ? 1 : 1 - Math.exp(-real * (dragging || rot ? 9 : 3));
    th += angDiff(th, thG) * kA; ph += (phG - ph) * kA;
    if (!dragging) {
      if (vel.lengthSq() > 1) { target.addScaledVector(vel, real); clampTarget(target); targetGoal.copy(target); vel.multiplyScalar(Math.exp(-real * 5)); }
      target.lerp(targetGoal, reduce ? 1 : 1 - Math.exp(-real * (following() ? 5 : 2.2)));
      F += (Fgoal - F) * (reduce ? 1 : 1 - Math.exp(-real * 2.4));
    }
    // the limits: never wider than the world allows at this turn and tilt, never looking past its edge
    { const cap = capF(th, ph); if (F > cap) F = cap; const capG = capF(thG, phG); if (Fgoal > capG) Fgoal = capG; if (!following()) { clampTarget(target); if (!dragging) clampTarget(targetGoal, thG, phG, Fgoal); } }
    // far plane and haze follow the depth of the view: the far ground softens, and nothing is clipped
    { const dpt = Math.min(1500, Math.max(200, F / (2 * Math.tan(Math.max(0.25, ph))))); camera.near = Math.max(40, CAM_DIST - dpt - 520); camera.far = CAM_DIST + dpt + 620; scene.fog.near = CAM_DIST + dpt * 0.1 + 60; scene.fog.far = CAM_DIST + dpt * 1.7 + 520; }
    applyFrustum(); placeCamera();
    const camMoved = lastCam.distanceToSquared(camera.position) > 0.01 || Math.abs(lastF - F) > 0.05 || Math.abs(lastTh - th) > 1e-4 || Math.abs(lastPh - ph) > 1e-4;
    { // the land beyond the grid is drawn only on the sides this view can see
      const wide = F > 420; const vis = wide || target.z < -250 || target.z > 250 || target.x < -480; city.outer.all.forEach((m) => { m.visible = vis; });
      const nc = F < 400 && camMode !== 'follow'; if (nc !== nearCast) { nearCast = nc; nearCasters.forEach((m) => { m.castShadow = nc; }); renderer.shadowMap.needsUpdate = true; }
      // only the kit instances in or near the view are drawn; a tall one leans into it from farther away. Checked
      // whenever the camera moves, with a margin, so nothing appears or vanishes at the edge of the screen
      const far = farLod ? F > 780 : F > 880;
      if (camMoved || far !== farLod || frameNo < 3) {
        if (far !== farLod) { farCasters.forEach((m) => { m.castShadow = !far; }); renderer.shadowMap.needsUpdate = true; }
        farLod = far; city.carMesh.visible = !far;
        const [hx, hz] = half(th, ph, F); const reach = Math.min(3.4, 1 / Math.tan(Math.max(0.28, ph))); const pad = 46 + 40 * reach;
        camera.getWorldDirection(cull.v); const dl = Math.hypot(cull.v.x, cull.v.z) || 1;
        cull.shown = kitSet.cull(target.x - hx - pad, target.x + hx + pad, target.z - hz - pad, target.z + hz + pad, reach * 1.08, cull.v.x / dl, cull.v.z / dl, far);
      } }
    sun.position.copy(target).addScaledVector(sunDir, 1000); sun.target.position.copy(target);
    if (!reduce) anim.forEach((f) => f(clock, step));
    // the passenger's pin, the same size on screen at any zoom; the route stroke likewise
    drawTrail();
    { const p = sim.pax.pos; const s = Math.max(1.9, F * 0.016); pin.position.set(p.x, p.y + (sim.pax.aboard ? 3.3 : 0.2), p.z); pin.scale.setScalar(s); routeU.uW.value = Math.max(1.5, F * 0.006); }
    pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pm);
    screens.forEach((s) => s.update(clock, step, !reduce && frustum.intersectsObject(s.mesh), F < 340));
    if (pointer && camMoved) hoverDirty = true;
    if (hoverDirty && !dragging) { hoverDirty = false; if (pointer) { setNdc(pointer[0], pointer[1]); const obj = pickProxy(); if (obj !== hoverObj) { showHL(obj); onHover && onHover(obj ? obj.userData.pick : null); } if (obj) onHover && onHover(obj.userData.pick, pointer[0], pointer[1]); } else if (hoverObj) { showHL(null); onHover && onHover(null); } }
    if (hoverObj) { if (hoverObj === trainProxy) showHL(trainProxy); const pul = 0.5 + 0.5 * Math.sin(clock * 4); hlFill.material.opacity = 0.06 + 0.06 * pul; ring.material.opacity = 0.3 + 0.4 * pul; }
    if (pulseT < 1) { pulseT = Math.min(1, pulseT + real * 1.4); pulse.position.set(pulseAt.x, 0.4, pulseAt.z); const s = 2 + pulseT * 14; pulse.scale.set(s, s, s); pulse.material.opacity = 0.9 * (1 - pulseT); if (pulseT >= 1) pulse.visible = false; }
    if (camMoved) onCam && onCam(th, ph, F);
    lastCam.copy(camera.position); lastF = F; lastTh = th; lastPh = ph;
    if (renderer.shadowMap.enabled && (camMoved || frameNo % 3 === 0)) renderer.shadowMap.needsUpdate = true;
    renderer.info.reset();
    renderer.render(scene, camera);
    stats.calls = renderer.info.render.calls; stats.triangles = renderer.info.render.triangles;
    stats.maxCalls = Math.max(stats.maxCalls, stats.calls); stats.maxTris = Math.max(stats.maxTris, stats.triangles);
    // labels: HQ labels step up or down out of each other's way
    tags.classList.toggle('is-far', F > 560);
    const placed = []; const hideDest = isPhone && F > 900;
    labelItems.forEach((it) => {
      v.copy(it.pos).project(camera);
      const x = (v.x * 0.5 + 0.5) * W; let y = (-v.y * 0.5 + 0.5) * H;
      const off = x < -60 || x > W + 60 || y < -30 || y > H + 30 || (it.kind === 'dest' && hideDest) || (it.kind === 'plot' && F > 760) || (focusOn && it.kind !== 'st');
      if (!off) {
        if (!it.w) it.w = it.el.offsetWidth || 80; const w = it.w; const hgt = 24;
        const hit = (yy) => placed.some((r) => Math.abs(r[0] - x) < (r[2] + w) / 2 + 3 && Math.abs(r[1] - yy) < hgt);
        if (it.kind !== 'st') { for (const dy of [0, -26, 26, -52, 52]) { if (!hit(y + dy)) { y += dy; break; } } }
        placed.push([x, y, w]);
      }
      it.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      it.el.style.visibility = off ? 'hidden' : 'visible';
    });
    if (bubbleT < 1) { bubbleT = Math.min(1, bubbleT + real * 0.8); v.copy(bubblePos).project(camera); bubble.style.transform = `translate(${((v.x * 0.5 + 0.5) * W).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * H - bubbleT * 30).toFixed(1)}px) translate(-50%, -100%)`; bubble.style.opacity = String(bubbleT < 0.8 ? 1 : (1 - bubbleT) * 5); }
  }
  drawTrains();
  resize(); requestAnimationFrame(frame);
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 }).observe(host);
  addEventListener('resize', resize);
  { const o = fit(th, ph, false); F = Fgoal = o.F; target.copy(o.target); targetGoal.copy(o.target); }
  renderer.shadowMap.needsUpdate = true;
  const snap = () => { th = thG; ph = phG; F = Fgoal; target.copy(targetGoal); applyFrustum(); };

  return {
    net, setViewOffset, resize, setRoute,
    // look at the whole city, or at one place
    view(kind, o = {}) {
      focusOn = false; followSub = null; camMode = kind; onFree && onFree(false);
      if (kind === 'overview') { thG = th + angDiff(th, OV.th); phG = OV.ph; const f = fit(OV.th, OV.ph, false); Fgoal = f.F; targetGoal.copy(f.target); }
      if (kind === 'dest' && o.focus) { Fgoal = o.F || (isPhone ? 210 : 230); targetGoal.copy(o.focus).setY(0); thG = th + angDiff(th, o.th ?? 0.62); phG = o.ph ?? 0.62; }
      if (o.instant || reduce) snap();
    },
    // stay with the passenger ('pax') or with one line's train (its id), from a higher tilt, along the corridor
    follow(sub, o = {}) {
      if (camMode === 'follow' && followSub === sub && !o.instant) { Fgoal = o.F || (isPhone ? 140 : 150); return; } // already with it: only the zoom changes
      focusOn = false; camMode = 'follow'; followSub = sub; watch = sub === 'pax' ? null : sub; thOff = 0; onFree && onFree(false);
      Fgoal = o.F || (isPhone ? 140 : 150); phG = o.ph ?? 0.95; followTh = th;
      const t = sub === 'pax' ? (sim.pax.aboard ? sim.trainOf(sim.pax.aboard) : null) : sim.trainOf(sub);
      if (t) { const f = t.line.at(t.s).t.multiplyScalar(t.dir); followTh = th + angDiff(th, Math.atan2(-f.x, -f.z) + 0.42); }
      if (o.instant || reduce) { const p = sub === 'pax' ? sim.pax.pos : sim.trainPoint(sim.trainOf(sub)); targetGoal.set(p.x, 0, p.z); thG = followTh; snap(); }
    },
    watch(lid) { watch = lid; },
    focusOn(d) {
      // level 2: the HQ fills the stage. Seen from the front, a little to one side, the whole height in frame
      camMode = 'focus'; focusOn = true; followSub = null; onFree && onFree(false);
      const hgt = d.hit.size.y; const foot = Math.hypot(d.hit.size.x, d.hit.size.z);
      // nothing is hidden, so the camera looks for a clear line: from the front if it can, else from the side or
      // from higher up, whichever has the least standing between it and the building
      const base = Math.atan2(d.face[0], d.face[1]); const block = kitSet.near(d.hit.center.x, d.hit.center.z, 340); let best = null;
      [0.6, -0.6, 0.15, 1.25, -1.25, 2.1, -2.1, Math.PI].forEach((o) => (hgt > 150 ? [0.5, 0.7] : [0.62, 0.84, 1.05]).forEach((p) => {
        const az = base + o; const dx = Math.sin(az); const dz = Math.cos(az); const t = Math.tan(p); let sc = Math.abs(o) * 7 + (p - 0.5) * 26;
        block.forEach(([bx, bz, br, bh]) => { const ox = bx - d.hit.center.x; const oz = bz - d.hit.center.z; const along = ox * dx + oz * dz; if (along < 6) return; if (Math.abs(ox * dz - oz * dx) > br + foot * 0.55) return; const sight = along * t + hgt * 0.2; if (bh > sight) sc += Math.min(80, bh - sight) + 12; });
        if (!best || sc < best.sc) best = { sc, az, p };
      }));
      phG = best.p; thG = th + angDiff(th, best.az);
      Fgoal = Math.max(100, Math.min(460, d.focusF || Math.max(hgt * Math.cos(phG) * 1.5 + foot * Math.sin(phG) * 0.9, foot * 1.15))) * (isPhone ? 1.35 : 1);
      // on a phone the story sheet covers the lower half: the building is framed in the strip above it
      const lift = (hgt * 0.42) / Math.tan(phG) * (isPhone ? 0.2 : 1); const off = lift - (isPhone ? (0.24 * Fgoal) / Math.sin(phG) : 0);
      targetGoal.set(d.hit.center.x - Math.sin(thG) * off, 0, d.hit.center.z - Math.cos(thG) * off);
      if (reduce) snap();
    },
    mode: () => camMode, following: () => followSub,
    // the on-screen cluster and the keyboard: every move eases, and a new one takes over from the last
    turnBy(d) { orbit(d, 0); }, tiltBy(d) { orbit(0, d); }, zoomBy(f) { zoomAt(f, W / 2, H / 2, true); }, panBy,
    north() { if (following()) thOff = angDiff(followTh, 0); else { thG = th + angDiff(th, 0); if (camMode !== 'free') goFree(); } },
    hold(k, val) { held[k] = val; }, release() { Object.keys(held).forEach((k) => { held[k] = 0; }); },
    heading: () => th, tilt: () => ph,
    models: () => ({ kit: city.kitItems.length, kitModels: kitSet.sets.length, shown: cull.shown, kitTris: kitSet.tris(), byModel: kitSet.sets.filter((q) => q.im.visible).map((q) => [q.name, q.im.count]), stations: rails.stations.length }),
    info: () => ({ calls: stats.calls, triangles: stats.triangles, maxCalls: stats.maxCalls, maxTris: stats.maxTris, frames: stats.frames, fps: Math.round(fps), F: Math.round(F), mode: camMode, renderer: (() => { const gl = renderer.getContext(); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; })() }),
    resetStats() { stats.maxCalls = 0; stats.maxTris = 0; stats.frames = 0; },
    projectHover(pick) { const obj = proxies.find((p) => p.userData.pick.type === pick.type && p.userData.pick.id === pick.id); if (!obj) return null; v.copy(obj.position).project(camera); const r = canvas.getBoundingClientRect(); return [r.left + (v.x * 0.5 + 0.5) * W, r.top + (-v.y * 0.5 + 0.5) * H]; },
    project(x, y, z) { v.set(x, y, z).project(camera); const r = canvas.getBoundingClientRect(); return [r.left + (v.x * 0.5 + 0.5) * W, r.top + (-v.y * 0.5 + 0.5) * H]; },
    limits: () => { const [hx, hz] = half(th, ph, F); return { F: Math.round(F), cap: Math.round(capF(th, ph)), fit: Math.round(fitC.F), foot: [Math.round(target.x - hx), Math.round(target.x + hx), Math.round(target.z - hz), Math.round(target.z + hz)], safe: SAFE }; },
    debug: () => ({ target: target.toArray().map(Math.round), th: +th.toFixed(2), ph: +ph.toFixed(2), F: Math.round(F), mode: camMode, detail: detail && detail.line.id }),
    highlight(sid) { labelItems.forEach((it) => it.el.classList.toggle('is-current', it.kind === 'st' && it.id === sid)); },
    pause() { running = false; }, resume() { running = true; last = performance.now(); },
  };
}
