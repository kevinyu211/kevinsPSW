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
  // a ribbon along any polylines (for the links of the Skills view)
  const polyGeo = (lines, hex) => {
    const pos = []; const nrm = []; const side = []; const colr = []; const idx = []; let base = 0; const c = new THREE.Color(hex);
    lines.forEach((P) => { P.forEach((p, i) => { const a = P[Math.max(0, i - 1)]; const b = P[Math.min(P.length - 1, i + 1)]; let tx = b.x - a.x; let tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; [-1, 1].forEach((sg) => { pos.push(p.x, p.y, p.z); nrm.push(tz, 0, -tx); side.push(sg); colr.push(c.r, c.g, c.b); }); if (i < P.length - 1) { const k = base + i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } }); base += P.length * 2; });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aN', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1)); g.setAttribute('aCol', new THREE.Float32BufferAttribute(colr, 3)); g.setIndex(idx); return g;
  };
  /* The Skills view: the stations that share a tag are joined by glowing arcs and ringed; a pale veil goes
     over every line and the other labels fade, so the pattern reads. Nothing is hidden. */
  const linkGroup = new THREE.Group(); scene.add(linkGroup); let lit = null;
  function setLinks(sids) {
    linkGroup.children.slice().forEach((m) => { m.geometry.dispose(); m.material.dispose(); linkGroup.remove(m); });
    lit = sids && sids.length ? sids : null; tags.classList.toggle('is-skill', !!lit);
    labelItems.forEach((it) => it.el.classList.toggle('is-lit', !!lit && ((it.kind === 'st' && lit.includes(it.id)) || (it.kind === 'dest' && lit.includes((destinations.find((d) => d.id === it.id) || {}).station)))));
    if (!lit) return;
    const pt = (sid) => { const st = net.stById[sid]; return new THREE.Vector3(st.pos[0], Math.max(...st.lines.map((l) => net.byId[l].at(net.stopOn(l, sid).s).p.y)) + 8, st.pos[1]); };
    const pairs = []; if (lit.length <= 5) { for (let i = 0; i < lit.length; i++) for (let j = i + 1; j < lit.length; j++) pairs.push([lit[i], lit[j]]); }
    else lit.forEach((a) => lit.filter((b) => b !== a).map((b) => [pt(a).distanceTo(pt(b)), b]).sort((x, y) => x[0] - y[0]).slice(0, 2).forEach(([, b]) => { if (!pairs.some(([p, q]) => (p === a && q === b) || (p === b && q === a))) pairs.push([a, b]); }));
    const arcs = pairs.map(([a, b]) => { const A = pt(a); const B = pt(b); const mid = A.clone().add(B).multiplyScalar(0.5); mid.y += 50 + A.distanceTo(B) * 0.2; const P = []; for (let i = 0; i <= 28; i++) { const t = i / 28; P.push(new THREE.Vector3().addScaledVector(A, (1 - t) * (1 - t)).addScaledVector(mid, 2 * t * (1 - t)).addScaledVector(B, t * t)); } return P; });
    const rings = lit.map((sid) => { const c = pt(sid); const P = []; for (let i = 0; i <= 40; i++) { const an = (i / 40) * Math.PI * 2; P.push(new THREE.Vector3(c.x + Math.cos(an) * 34, c.y - 2, c.z + Math.sin(an) * 34)); } return P; });
    const veil = new THREE.Mesh(ribbonGeo(net.lines.map((l) => [l, 0, l.L]), () => 0xf4f3ef, 0, 1.08), ribbonMat(0.55, true)); veil.material.uniforms.uW = { value: 12.4 }; veil.renderOrder = 3;
    const halo = new THREE.Mesh(polyGeo([...arcs, ...rings], 0xffffff), ribbonMat(0.92, false)); halo.material.uniforms.uS.value = 2.1; halo.renderOrder = 22;
    const core = new THREE.Mesh(polyGeo([...arcs, ...rings], 0xf2a900), ribbonMat(1, false)); core.material.uniforms.uS.value = 1.05; core.renderOrder = 23;
    [veil, halo, core].forEach((m) => { m.frustumCulled = false; linkGroup.add(m); });
  }
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
  const OV = isPhone ? { th: Math.PI / 2 + 0.5, ph: 0.8 } : { th: Math.PI / 2 + 0.55, ph: 0.66 }; // the widest view: from over the sea, the whole waterfront across the frame
  let th = OV.th; let ph = OV.ph; let thG = th; let phG = ph;
  let F = isPhone ? 1500 : 1100; let Fgoal = F;
  const F_MIN = 40; const F_MAX = 4000; // the real ceiling is capF(): the view may never leave the world
  // overview: the whole city, framed. free: wherever the visitor left it. follow: stays with the passenger or
  // one line's train, looking along the track. focus: one building. dest: a look at one place.
  const follow = { F: 120, ph: 0.8, zoom: 1, pose: null, shift: undefined }; let lead = 0;
  let camMode = 'overview'; let focusOn = false; let followSub = null; let followTh = OV.th; let thOff = 0; let flying = null;
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
  function resize() { const r = host.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); renderer.setSize(W, H, false); canvas.style.width = `${W}px`; canvas.style.height = `${H}px`; applyFrustum(); if (camMode === 'overview') { const o = widest(OV.th, OV.ph); Fgoal = o.F; targetGoal.copy(o.target); } labelItems.forEach((it) => { it.w = 0; }); }
  // fit the city (or the whole network map) into the stage, leaving room for the bottom UI
  // the widest view at this turn and tilt
  const widest = (t, p) => { const Fv = capF(t, p); const tg = new THREE.Vector3(120, 0, 0); clampTarget(tg, t, p, Fv); return { F: Fv, target: tg }; };
  // room for a panel at one side of the stage. It eases, so a panel arriving never jolts the view
  let offGoal = 0;
  function setViewOffset(px, side = 'right') { const sd = side === 'left' ? -1 : 1; offGoal = Math.max(0, px | 0); if (sd !== offSide && offX > 1) offX = 0; if (offGoal > 0) offSide = sd; if (reduce) offX = offGoal; }

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
    const y = Math.max(...st.lines.map((l) => net.byId[l].at(net.stopOn(l, st.id).s).p.y)) + 9;
    labelItems.push({ el, pos: new THREE.Vector3(nd.x, y, nd.z), map: new THREE.Vector3(nd.x, 0, nd.z), kind: 'st', id: st.id });
  });
  const lmById = Object.fromEntries(landmarks.map((l) => [l.id, l]));
  destinations.forEach((d) => {
    const lm = lmById[d.landmark]; if (!lm || !lm.focus) return;
    d.focus = lm.focus.clone(); d.hit = lm.hit; d.face = lm.toLine; d.focusF = lm.focusF || 0; d.view = lm.view || null;
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
  let hoverObj = null; let dragging = false; let spotId = null; let selId = null; let nowAt = null;
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
  /* Camera limits: the built city only. The view's footprint on the ground (a rectangle turned by the
     azimuth) must stay inside REGION: the city grid, extended east over the sea. The suburbs, the forest and
     the hills beyond never enter the frame, at any turn, tilt or zoom. So the whole city cannot be seen at
     once in 3D (the 2D map is the whole-network view): the widest zoom is whatever still fits inside REGION
     at this turn and tilt, and the target is clamped so the footprint cannot slide out. Every mode obeys it. */
  const REGION = { x0: WORLD.city.x0, x1: WORLD.safe.x1, z0: WORLD.city.z0, z1: WORLD.city.z1 };
  /* The frame is the canvas. When a panel covers one side of it the view is shifted (see setViewOffset), so the
     middle of the frame is not the camera's target: `mid` is where it is on the ground. */
  const half = (t, p, Fv) => { const a = (Fv * W) / H / 2; const b = Fv / (2 * Math.max(0.25, Math.sin(p))); return [Math.abs(Math.cos(t)) * a + Math.abs(Math.sin(t)) * b, Math.abs(Math.sin(t)) * a + Math.abs(Math.cos(t)) * b]; };
  const shiftOf = (t, Fv, off) => { const k = (offSide < 0 ? -1 : 1) * (off / 2) * (Fv / H); return [Math.cos(t) * k, -Math.sin(t) * k]; };
  const capF = (t, p) => { const [hx, hz] = half(t, p, 1); return Math.min(((REGION.x1 - REGION.x0) / 2 / hx) * 0.985, ((REGION.z1 - REGION.z0) / 2 / hz) * 0.985, isPhone ? 1500 : 1100); };
  const clampTarget = (tg, t = th, p = ph, Fv = F, off = offX) => {
    const [hx, hz] = half(t, p, Fv); const [sx, sz] = shiftOf(t, Fv, off); const lx = REGION.x0 + hx; const ux = Math.min(REGION.x1 - hx, WORLD.city.x1 - 40); const lz = REGION.z0 + hz; const uz = REGION.z1 - hz;
    const mx = tg.x + sx; const mz = tg.z + sz; /* the view may reach out over the sea, but its middle stays on the waterfront */
    tg.x = (lx > ux ? Math.max(lx, (REGION.x0 + REGION.x1) / 2) : Math.max(lx, Math.min(ux, mx))) - sx; tg.z = (lz > uz ? (REGION.z0 + REGION.z1) / 2 : Math.max(lz, Math.min(uz, mz))) - sz;
  };
  // the four corners of the frame, on the ground (for the clamp test)
  const corners = () => { const a = (F * W) / H / 2; const b = F / (2 * Math.sin(ph)); const rx = Math.cos(th); const rz = -Math.sin(th); const fx = -Math.sin(th); const fz = -Math.cos(th); const [sx, sz] = shiftOf(th, F, offX); return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => [target.x + sx + rx * a * i + fx * b * j, target.z + sz + rz * a * i + fz * b * j]); };
  const following = () => camMode === 'follow';
  const goFree = () => { if (camMode !== 'free') { camMode = 'free'; followSub = null; focusOn = false; onFree && onFree(true); } };
  // turning and tilting never stop a follow: the camera keeps the train and takes the new angle
  const riding = () => camMode === 'follow' && followSub === 'pax';
  const look = { off: new THREE.Vector3(), at: 0, ph: 0 }; // where the visitor has dragged the view to during a ride
  const orbit = (dth, dph) => { if (riding()) { look.at = performance.now(); look.ph += dph; } if (following()) { thOff += dth; if (!riding()) follow.ph = Math.max(PH_MIN, Math.min(PH_MAX, follow.ph + dph)); return; } thG += dth; if (camMode === 'overview' || camMode === 'focus' || camMode === 'dest') goFree(); phG = Math.max(PH_MIN, Math.min(PH_MAX, phG + dph)); };
  const zoomAt = (factor, cx, cy, soft) => {
    const base = soft ? Fgoal : F; const nf = Math.max(F_MIN, Math.min(F_MAX, capF(th, ph), base * factor)); if (Math.abs(nf - base) < 0.01) return;
    if (following()) { follow.zoom = Math.max(0.5, Math.min(4, follow.zoom * factor)); return; }
    if (soft) { Fgoal = nf; if (camMode === 'overview') goFree(); return; }
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
    if (!dragging && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) { dragging = true; showHL(null); onHover && onHover(null); canvas.style.cursor = 'grabbing'; if (!rot && !riding()) goFree(); }
    if (!dragging) return;
    if (rot) { orbit(-(e.clientX - rot[0]) * 0.0062, (e.clientY - rot[1]) * 0.0048); rot = [e.clientX, e.clientY]; return; }
    if (grab && riding()) { const now = groundAt(e.clientX, e.clientY); look.off.add(grab.clone().sub(now).setY(0)); look.at = performance.now(); return; }
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
      let pos; let fwd = null; let moving = false;
      if (followSub === 'pax') { pos = sim.pax.pos; const lid = sim.pax.aboard; if (lid) { const t = sim.trainOf(lid); fwd = t.line.at(t.s).t.multiplyScalar(t.dir); moving = !!t.hop && t.doors < 0.03; } }
      else { const t = sim.trainOf(followSub); pos = sim.trainPoint(t); if (t.hop) { fwd = t.line.at(t.s).t.multiplyScalar(Math.sign(t.hop.b - t.hop.a) || 1); moving = true; } }
      // lead the train a little, so more of the line ahead is in the frame
      lead += ((moving ? 1 : 0) - lead) * (reduce ? 1 : 1 - Math.exp(-real * 1.2));
      targetGoal.set(pos.x + (fwd ? fwd.x * F * 0.16 * lead : 0), 0, pos.z + (fwd ? fwd.z * F * 0.16 * lead : 0));
      if (fwd) followTh += angDiff(followTh, Math.atan2(-fwd.x, -fwd.z) + 0.42) * (reduce ? 1 : 1 - Math.exp(-real * 0.9));
      let tG = followTh; let pG = follow.ph; let fG = follow.F;
      // the last approach: the view turns from the train to the building it is going to, and settles on its front
      const tr = sim.trip; const dd = followSub === 'pax' && tr && tr.meta && tr.k === tr.legs.length - 1 && (tr.phase === 'ride' || tr.phase === 'alight' || tr.phase === 'out') ? destinations.find((x) => x.id === tr.meta.destId && x.hit) : null;
      if (dd) { const q = tr.phase === 'ride' ? Math.max(0, (sim.progress() - 0.55) / 0.45) : 1; const w = q * q * (3 - 2 * q); if (!follow.pose || follow.pose.id !== dd.id) follow.pose = focusPose(dd, follow.shift);
        const fp = follow.pose; targetGoal.x += (fp.x - targetGoal.x) * w; targetGoal.z += (fp.z - targetGoal.z) * w; tG = followTh + angDiff(followTh, fp.th) * w; pG += (fp.ph - pG) * w; fG = Math.exp(Math.log(fG) + (Math.log(fp.F) - Math.log(fG)) * w); }
      else if (follow.pose && followSub === 'pax' && !tr) { const fp = follow.pose; targetGoal.set(fp.x, 0, fp.z); tG = followTh + angDiff(followTh, fp.th); pG = fp.ph; fG = fp.F; }
      else follow.pose = null;
      // the visitor may look around; two seconds after they let go the view comes back to the train
      if (riding()) { if (!dragging && !rot && performance.now() - look.at > 2000) { const kk = reduce ? 1 : 1 - Math.exp(-real * 2.6); look.off.multiplyScalar(1 - kk); thOff *= 1 - kk; look.ph *= 1 - kk; } targetGoal.add(look.off); } else { look.off.set(0, 0, 0); look.ph = 0; }
      thG = tG + thOff; phG = Math.max(PH_MIN, Math.min(PH_MAX, pG + look.ph)); Fgoal = fG * follow.zoom;
    }
    // a timed flight (the opening): from one view to another along a smooth curve; any input takes over
    if (camMode === 'fly' && flying) {
      flying.t += real; const q = flying.dur > 0 ? Math.min(1, flying.t / flying.dur) : 1; const e = q * q * (3 - 2 * q); const { a, b } = flying;
      th = a.th + angDiff(a.th, b.th) * e; ph = a.ph + (b.ph - a.ph) * e; F = Math.exp(Math.log(a.F) + (Math.log(b.F) - Math.log(a.F)) * e); target.set(a.x + (b.x - a.x) * e, 0, a.z + (b.z - a.z) * e);
      const cf = capF(th, ph); if (F > cf) F = cf; clampTarget(target); thG = th; phG = ph; Fgoal = F; targetGoal.copy(target); if (q >= 1) { flying = null; camMode = 'dest'; }
    }
    const kA = reduce ? 1 : 1 - Math.exp(-real * (dragging || rot ? 9 : 3));
    th += angDiff(th, thG) * kA; ph += (phG - ph) * kA;
    if (!dragging) {
      if (vel.lengthSq() > 1) { target.addScaledVector(vel, real); clampTarget(target); targetGoal.copy(target); vel.multiplyScalar(Math.exp(-real * 5)); }
      target.lerp(targetGoal, reduce ? 1 : 1 - Math.exp(-real * (following() ? 5 : 2.2)));
      F += (Fgoal - F) * (reduce ? 1 : 1 - Math.exp(-real * 2.4));
    }
    // the limits: never wider than the world allows at this turn and tilt, never looking past its edge
    { const capG = capF(thG, phG); if (Fgoal > capG) Fgoal = capG; const cap = capF(th, ph); if (F > cap) F = cap; clampTarget(target); if (!dragging) clampTarget(targetGoal, thG, phG, Fgoal, offGoal); }
    // far plane and haze follow the depth of the view: the far ground softens, and nothing is clipped
    { const dpt = Math.min(1500, Math.max(200, F / (2 * Math.tan(Math.max(0.25, ph))))); camera.near = Math.max(40, CAM_DIST - dpt - 520); camera.far = CAM_DIST + dpt + 620; scene.fog.near = CAM_DIST + dpt * 0.1 + 60; scene.fog.far = CAM_DIST + dpt * 1.7 + 520; }
    if (Math.abs(offGoal - offX) > 0.5) offX += (offGoal - offX) * (1 - Math.exp(-real * 5)); else offX = offGoal;
    applyFrustum(); placeCamera();
    const camMoved = lastCam.distanceToSquared(camera.position) > 0.01 || Math.abs(lastF - F) > 0.05 || Math.abs(lastTh - th) > 1e-4 || Math.abs(lastPh - ph) > 1e-4 || offX !== offGoal;
    { // the land beyond the grid is drawn only on the sides this view can see
      const nc = F < 400 && camMode !== 'follow'; if (nc !== nearCast) { nearCast = nc; nearCasters.forEach((m) => { m.castShadow = nc; }); renderer.shadowMap.needsUpdate = true; }
      // only the kit instances in or near the view are drawn; a tall one leans into it from farther away. Checked
      // whenever the camera moves, with a margin, so nothing appears or vanishes at the edge of the screen
      const far = farLod ? F > 600 : F > 660;
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
    const placed = []; const near = F < 330;
    labelItems.forEach((it) => {
      v.copy(it.pos).project(camera);
      const x = (v.x * 0.5 + 0.5) * W; let y = (-v.y * 0.5 + 0.5) * H;
      const off = x < -60 || x > W + 60 || y < -30 || y > H + 30 || (it.kind === 'st' ? !(near || it.id === nowAt || (lit && lit.includes(it.id))) : it.kind === 'plot' ? !(near && !focusOn) : !(it.id === spotId || it.id === selId || (hoverObj && hoverObj.userData.pick.type === 'dest' && hoverObj.userData.pick.id === it.id) || (lit && it.el.classList.contains('is-lit'))));
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
  { const o = widest(th, ph); F = Fgoal = o.F; target.copy(o.target); targetGoal.copy(o.target); }
  renderer.shadowMap.needsUpdate = true;
  const snap = () => { th = thG; ph = phG; F = Fgoal; target.copy(targetGoal); applyFrustum(); };
  // reduced motion: no flights. The view cuts to where it is going, behind a short cross-fade
  const cutTo = () => { snap(); if (canvas.animate) canvas.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' }); };
  /* Where the camera stands to show one building: in front of it (the registry's `face`), at three quarters,
     high enough to clear whatever stands between (other buildings, a viaduct, a station), close enough that
     the view stays inside the limits. A place may carry its own `view: { az, ph, F }` (az is measured from
     its front) for the stubborn ones. */
  function focusPose(d, shift) {
    const hgt = d.hit.size.y; const foot = Math.hypot(d.hit.size.x, d.hit.size.z); const c = d.hit.center; const base = Math.atan2(d.face[0], d.face[1]);
    const block = kitSet.near(c.x, c.z, 420); destinations.forEach((o) => { if (o !== d && o.hit && Math.hypot(o.hit.center.x - c.x, o.hit.center.z - c.z) < 460) block.push([o.hit.center.x, o.hit.center.z, Math.hypot(o.hit.size.x, o.hit.size.z) / 2, o.hit.size.y]); });
    const tryPose = (az, p, Fset) => {
      let Fv = Fset || Math.max(isPhone ? 120 : 96, Math.min(420, d.focusF || Math.max(hgt * Math.cos(p) * 1.5 + foot * Math.sin(p) * 0.9, foot * 1.12))) * (isPhone ? 1.3 : 1); Fv = Math.min(Fv, capF(az, p));
      // on a phone the story sheet covers the lower half: the building is framed in the strip above it
      const at = (fv) => { const lift = (hgt * 0.42) / Math.tan(p) * (isPhone ? 0.2 : 1); const off = lift - (isPhone ? ((shift ?? 0.24) * fv) / Math.sin(p) : 0); return new THREE.Vector3(c.x - Math.sin(az) * off, 0, c.z - Math.cos(az) * off); };
      // near the edge of the city the limits push the building out of the middle: come closer first
      let want = at(Fv); let tg = want.clone(); clampTarget(tg, az, p, Fv, offGoal);
      for (let i = 0; i < 6 && tg.distanceTo(want) > Fv * 0.1 && Fv > 84; i++) { Fv *= 0.9; want = at(Fv); tg = want.clone(); clampTarget(tg, az, p, Fv, offGoal); }
      return { id: d.id, th: az, ph: p, F: Fv, x: tg.x, z: tg.z, miss: tg.distanceTo(want) / Fv };
    };
    if (d.view && d.view.az != null) return tryPose(base + d.view.az, d.view.ph ?? 0.7, d.view.F);
    let best = null;
    [0.55, -0.55, 0.28, -0.28, 0.85, -0.85, 1.2, -1.2].forEach((o) => (hgt > 150 ? [0.5, 0.66, 0.85] : [0.6, 0.76, 0.92, 1.08, 1.24]).forEach((pp) => {
      const a = base + o; const dx = Math.sin(a); const dz = Math.cos(a); const t = Math.tan(pp); let sc = Math.abs(Math.abs(o) - 0.55) * 16 + (pp - 0.5) * 30;
      block.forEach(([bx, bz, br, bh]) => { const ox = bx - c.x; const oz = bz - c.z; const along = ox * dx + oz * dz; if (along < 6) return; if (Math.abs(ox * dz - oz * dx) > br + foot * 0.5) return; const sight = along * t + hgt * 0.15; if (bh > sight) sc += Math.min(80, bh - sight) + 14; });
      // a viaduct or a station between the camera and the front
      for (let al = 14; al <= 150; al += 8) { const x = c.x + dx * al; const z = c.z + dz * al; if (net.dist(x, z) > 11) continue; const st = net.stations.some((q) => Math.hypot(q.pos[0] - x, q.pos[1] - z) < 62); const top = (st ? 42 : 29); const sight = al * t + hgt * 0.15; if (top > sight) { sc += Math.min(60, top - sight) + 10; break; } }
      const pose = tryPose(a, pp); sc += pose.miss * 160; // a view the limits would push the building out of
      if (!best || sc < best.sc) best = { sc, pose };
    }));
    return best.pose;
  }

  return {
    net, setViewOffset, resize, setRoute, setLinks,
    // fly from view a to view b ({ x, z, F, th, ph }) in `sec` seconds
    fly(a, b, sec) { [a, b].forEach((q) => { q.F = Math.min(q.F, capF(q.th, q.ph)); const tg = new THREE.Vector3(q.x, 0, q.z); clampTarget(tg, q.th, q.ph, q.F); q.x = tg.x; q.z = tg.z; }); focusOn = false; followSub = null; flying = { a, b, t: 0, dur: sec }; camMode = 'fly'; th = a.th; ph = a.ph; F = a.F; target.set(a.x, 0, a.z); thG = th; phG = ph; Fgoal = F; targetGoal.copy(target); applyFrustum(); },
    // look at the whole city, or at one place
    view(kind, o = {}) {
      focusOn = false; followSub = null; camMode = kind; onFree && onFree(false);
      if (kind === 'overview') { thG = th + angDiff(th, OV.th); phG = OV.ph; const f = widest(OV.th, OV.ph); Fgoal = f.F; targetGoal.copy(f.target); }
      if (kind === 'dest' && o.focus) { Fgoal = o.F || (isPhone ? 210 : 230); targetGoal.copy(o.focus).setY(0); thG = th + angDiff(th, o.th ?? 0.62); phG = o.ph ?? 0.62; }
      if (o.instant) snap(); else if (reduce) cutTo();
    },
    // stay with the passenger ('pax') or with one line's train (its id), from a higher tilt, along the corridor
    follow(sub, o = {}) {
      if (!(camMode === 'follow' && followSub === sub)) { thOff = 0; followTh = th; follow.zoom = 1; look.off.set(0, 0, 0); look.ph = 0; lead = 0; }
      focusOn = false; camMode = 'follow'; followSub = sub; watch = sub === 'pax' ? null : sub; follow.F = o.F || (isPhone ? 118 : 124); follow.ph = o.ph ?? 0.8; follow.shift = o.shift; onFree && onFree(false);
      if (o.instant || reduce) { const p = sub === 'pax' ? sim.pax.pos : sim.trainPoint(sim.trainOf(sub)); const t = sub === 'pax' ? (sim.pax.aboard ? sim.trainOf(sim.pax.aboard) : null) : sim.trainOf(sub); if (t) { const f = t.line.at(t.s).t.multiplyScalar(t.dir); followTh = Math.atan2(-f.x, -f.z) + 0.42; } targetGoal.set(p.x, 0, p.z); thG = followTh; phG = follow.ph; Fgoal = follow.F; clampTarget(targetGoal, thG, phG, Fgoal); cutTo(); }
    },
    watch(lid) { watch = lid; },
    focusOn(d, o = {}) {
      // the building fills the stage, seen from its front at three quarters
      camMode = 'focus'; focusOn = true; followSub = null; onFree && onFree(false);
      const fp = focusPose(d, o.shift); thG = th + angDiff(th, fp.th); phG = fp.ph; Fgoal = fp.F; targetGoal.set(fp.x, 0, fp.z);
      if (reduce) cutTo();
    },
    mode: () => camMode, following: () => followSub,
    // the on-screen cluster and the keyboard: every move eases, and a new one takes over from the last
    turnBy(d) { orbit(d, 0); }, tiltBy(d) { orbit(0, d); }, zoomBy(f) { zoomAt(f, W / 2, H / 2, true); }, panBy,
    north() { if (following()) { thOff = angDiff(followTh, 0); look.at = performance.now(); } else { thG = th + angDiff(th, 0); if (camMode !== 'free') goFree(); } },
    hold(k, val) { held[k] = val; }, release() { Object.keys(held).forEach((k) => { held[k] = 0; }); },
    heading: () => th, tilt: () => ph,
    models: () => ({ kit: city.kitItems.length, kitModels: kitSet.sets.length, shown: cull.shown, kitTris: kitSet.tris(), byModel: kitSet.sets.filter((q) => q.im.visible).map((q) => [q.name, q.im.count]), stations: rails.stations.length }),
    info: () => ({ calls: stats.calls, triangles: stats.triangles, maxCalls: stats.maxCalls, maxTris: stats.maxTris, frames: stats.frames, fps: Math.round(fps), F: Math.round(F), mode: camMode, renderer: (() => { const gl = renderer.getContext(); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; })() }),
    resetStats() { stats.maxCalls = 0; stats.maxTris = 0; stats.frames = 0; },
    projectHover(pick) { const obj = proxies.find((p) => p.userData.pick.type === pick.type && p.userData.pick.id === pick.id); if (!obj) return null; v.copy(obj.position).project(camera); const r = canvas.getBoundingClientRect(); return [r.left + (v.x * 0.5 + 0.5) * W, r.top + (-v.y * 0.5 + 0.5) * H]; },
    project(x, y, z) { v.set(x, y, z).project(camera); const r = canvas.getBoundingClientRect(); return [r.left + (v.x * 0.5 + 0.5) * W, r.top + (-v.y * 0.5 + 0.5) * H]; },
    limits: () => { const [hx, hz] = half(th, ph, F); return { F: Math.round(F), cap: Math.round(capF(th, ph)), foot: [Math.round(target.x - hx), Math.round(target.x + hx), Math.round(target.z - hz), Math.round(target.z + hz)], region: REGION }; },
    debug: () => ({ target: target.toArray().map(Math.round), th: +th.toFixed(2), ph: +ph.toFixed(2), F: Math.round(F), mode: camMode, detail: detail && detail.line.id }),
    highlight(sid) { nowAt = sid; labelItems.forEach((it) => it.el.classList.toggle('is-current', it.kind === 'st' && it.id === sid)); },
    // the rail and the city point at each other: `spot` glows a building and shows its label; `select` keeps one labelled
    spot(id) { spotId = id || null; const obj = id ? proxies.find((q) => q.userData.pick.type === 'dest' && q.userData.pick.id === id) : null; if (!pointer || !hoverObj || obj) showHL(obj); },
    select(id) { selId = id || null; },
    // for the clamp test: ask for any view; what comes back is what the limits allow
    setPose(o) { focusOn = false; followSub = null; camMode = 'free'; flying = null; thG = o.th; phG = Math.max(PH_MIN, Math.min(PH_MAX, o.ph)); Fgoal = Math.min(o.F, capF(thG, phG)); targetGoal.set(o.x, 0, o.z); clampTarget(targetGoal, thG, phG, Fgoal); snap(); placeCamera(); return { th, ph, F, corners: corners(), region: REGION }; },
    corners, region: () => REGION,
    pause() { running = false; }, resume() { running = true; last = performance.now(); },
  };
}
