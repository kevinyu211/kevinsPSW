/* Kevin Metro · the train
   Four 20 m cars, 3.0 m wide, floor at 1.1 m. Brushed stainless body, a cobalt line band with a
   yellow accent, a white rounded cab, four door pairs per side, two bogies per car, gangways.
   Built for few draw calls: each car is four merged meshes; the doors on the platform side are
   two instanced meshes for the whole train; gangways are instanced too. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

export const CAR_LEN = 20;
export const CAR_GAP = 1.0;
export const BOGIE = 6.6;
export const DOORS = [-7.2, -2.4, 2.4, 7.2];
const HALF = 1.5;
const T = (x, y, z, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));

function prep(g, m, hex) {
  let x = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k);
  if (!x.attributes.uv) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2));
  if (m) x.applyMatrix4(m);
  if (hex !== undefined) { const c = new THREE.Color(hex); const n = x.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } x.setAttribute('color', new THREE.Float32BufferAttribute(a, 3)); }
  return x;
}
const merge = (list) => mergeGeometries(list, false);

export function destSignTexture(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const g = c.getContext('2d'); g.fillStyle = '#0d0e10'; g.fillRect(0, 0, 512, 96);
  g.beginPath(); g.arc(46, 48, 30, 0, Math.PI * 2); g.fillStyle = '#2f6fe0'; g.fill();
  g.fillStyle = '#ffffff'; g.font = '700 54px "Public Sans", Arial, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText('K', 46, 50);
  g.fillStyle = '#ffb347'; g.textAlign = 'left'; g.fillText(text, 92, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildTrain({ lineHex, cars = 4, platformSide = 1 }) {
  const mat = {
    steel: new THREE.MeshStandardMaterial({ color: 0xc7ccd2, metalness: 0.88, roughness: 0.3 }),
    paint: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.15, roughness: 0.42 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x182029, metalness: 0.5, roughness: 0.06, envMapIntensity: 1.6 }),
    wheel: new THREE.MeshStandardMaterial({ color: 0x5c6066, roughness: 0.4, metalness: 0.9 }),
    door: new THREE.MeshStandardMaterial({ color: 0xd3d7dc, metalness: 0.85, roughness: 0.28 }),
    head: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3d6, emissiveIntensity: 3 }),
    tail: new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff2a1a, emissiveIntensity: 2 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.95 }),
  };
  const WHITE = 0xf2f3f1; const DARK = 0x2a2d32; const BAND = lineHex; const ACCENT = 0xf2b705; const GREY = 0x9aa0a7;

  const xs = new THREE.Shape();
  xs.moveTo(-HALF + 0.05, 0.95); xs.lineTo(HALF - 0.05, 0.95); xs.lineTo(HALF, 1.25); xs.lineTo(HALF, 3.05);
  xs.quadraticCurveTo(HALF - 0.02, 3.5, HALF - 0.45, 3.72); xs.lineTo(-HALF + 0.45, 3.72); xs.quadraticCurveTo(-HALF + 0.02, 3.5, -HALF, 3.05); xs.lineTo(-HALF, 1.25); xs.closePath();
  const ns = new THREE.Shape();
  ns.moveTo(0, 0.95); ns.lineTo(1.45, 0.95); ns.quadraticCurveTo(1.75, 1.05, 1.78, 1.5); ns.lineTo(1.72, 2.05);
  ns.quadraticCurveTo(1.55, 3.2, 0.95, 3.6); ns.quadraticCurveTo(0.6, 3.72, 0, 3.72); ns.closePath();
  const noseGeo = new THREE.ExtrudeGeometry(ns, { depth: 2.7, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 2, curveSegments: 8 });
  noseGeo.rotateY(-Math.PI / 2); noseGeo.translate(1.35, 0, 0);

  const group = new THREE.Group();
  const carObjs = [];
  const z0 = -CAR_LEN / 2;
  for (let k = 0; k < cars; k++) {
    const cab = k === 0 || k === cars - 1;
    const rear = k === cars - 1;
    const car = new THREE.Group(); const inner = new THREE.Group(); car.add(inner);
    if (rear) inner.rotation.y = Math.PI;
    // the static side (away from the platform) in inner coordinates
    const staticSide = rear ? platformSide : -platformSide;
    const bodyLen = cab ? CAR_LEN - 2.0 : CAR_LEN;
    const steel = []; const paint = []; const glass = []; const wheels = [];
    const bg = new THREE.ExtrudeGeometry(xs, { depth: bodyLen, bevelEnabled: false, curveSegments: 5 }); bg.translate(0, 0, z0); steel.push(prep(bg));
    [1.16, 1.32, 1.48].forEach((y) => [-1, 1].forEach((sg) => steel.push(prep(new THREE.BoxGeometry(0.04, 0.05, bodyLen - 0.4), T(sg * (HALF + 0.01), y, z0 + bodyLen / 2)))));
    const segs = []; let prev = z0 + 0.6;
    DOORS.forEach((d) => { segs.push([prev, d - 0.75]); prev = d + 0.75; }); segs.push([prev, z0 + bodyLen - 0.4]);
    segs.forEach(([a, b]) => {
      if (b - a < 0.4) return;
      [-1, 1].forEach((sg) => {
        glass.push(prep(new THREE.BoxGeometry(0.03, 0.95, b - a - 0.5), T(sg * (HALF + 0.015), 2.45, (a + b) / 2)));
        paint.push(prep(new THREE.BoxGeometry(0.03, 0.2, b - a), T(sg * (HALF + 0.02), 1.82, (a + b) / 2), BAND));
        paint.push(prep(new THREE.BoxGeometry(0.03, 0.05, b - a), T(sg * (HALF + 0.02), 1.69, (a + b) / 2), ACCENT));
      });
    });
    // roof: two air-conditioning units with grilles, a walkway strip, vents and gutters (third-rail stock: no pantograph)
    [-5.6, 5.6].forEach((z) => {
      paint.push(prep(new THREE.BoxGeometry(2.1, 0.34, 3.6), T(0, 3.88, z), 0xdfe2e5));
      paint.push(prep(new THREE.BoxGeometry(1.5, 0.04, 2.6), T(0, 4.07, z), 0x6a6f76));
      [-0.4, 0.4].forEach((x) => paint.push(prep(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 12), T(x, 4.1, z), 0x3a3e44)));
    });
    paint.push(prep(new THREE.BoxGeometry(0.5, 0.03, bodyLen - 1), T(0, 3.73, z0 + bodyLen / 2), GREY));
    [-1.5, 1.5].forEach((z) => paint.push(prep(new THREE.BoxGeometry(0.9, 0.16, 0.5), T(0, 3.8, z), 0x777c83)));
    [-1, 1].forEach((sg) => paint.push(prep(new THREE.BoxGeometry(0.06, 0.06, bodyLen - 0.6), T(sg * 1.06, 3.71, z0 + bodyLen / 2), DARK)));
    paint.push(prep(new THREE.BoxGeometry(2.3, 0.45, 6.5), T(0, 0.72, 0), DARK));
    DOORS.forEach((d) => [-1, 1].forEach((sg) => paint.push(prep(new THREE.BoxGeometry(0.02, 2.0, 1.45), T(sg * (HALF + 0.005), 2.08, d), DARK))));
    // doors on the static side are part of the body; the platform side is animated (below)
    DOORS.forEach((d) => [-1, 1].forEach((half) => {
      steel.push(prep(new THREE.BoxGeometry(0.04, 1.95, 0.66), T(staticSide * (HALF + 0.03), 2.08, d + half * 0.335)));
      glass.push(prep(new THREE.BoxGeometry(0.05, 0.85, 0.38), T(staticSide * (HALF + 0.035), 2.46, d + half * 0.335)));
    }));
    const fz = z0 + bodyLen;
    if (cab) {
      paint.push(prep(noseGeo, T(0, 0, fz), WHITE));
      glass.push(prep(new THREE.BoxGeometry(2.5, 1.25, 0.06), T(0, 2.72, fz + 1.62, 0, -0.38)));
      paint.push(prep(new THREE.BoxGeometry(2.9, 0.2, 0.06), T(0, 1.75, fz + 1.86), BAND));
      paint.push(prep(new THREE.BoxGeometry(1.2, 2.1, 0.1), T(0, 2.1, z0 - 0.02), DARK));
    } else {
      paint.push(prep(new THREE.BoxGeometry(1.2, 2.1, 0.1), T(0, 2.1, z0 - 0.02), DARK));
      paint.push(prep(new THREE.BoxGeometry(1.2, 2.1, 0.1), T(0, 2.1, z0 + CAR_LEN + 0.02), DARK));
    }
    // bogies (frames into the paint mesh, wheels into one wheel mesh)
    [-BOGIE, BOGIE].forEach((bz) => {
      paint.push(prep(new THREE.BoxGeometry(2.0, 0.34, 2.9), T(0, 0.62, bz), DARK));
      [-0.95, 0.95].forEach((x) => paint.push(prep(new THREE.BoxGeometry(0.18, 0.5, 3.0), T(x, 0.5, bz), DARK)));
      [-1.1, 1.1].forEach((az) => [-1, 1].forEach((sg) => paint.push(prep(new THREE.CylinderGeometry(0.43, 0.43, 0.13, 14), T(sg * 0.7175, 0.43, bz + az, 0, 0, Math.PI / 2), 0x4a4e54))));
    });
    [[steel, mat.steel, true], [paint, mat.paint, true], [glass, mat.glass, false]].forEach(([list, m, cast]) => {
      const mesh = new THREE.Mesh(merge(list), m); mesh.castShadow = cast; mesh.receiveShadow = true; inner.add(mesh);
    });
    let sign = null;
    if (cab) {
      const lights = merge([-1, 1].map((sg) => prep(new THREE.BoxGeometry(0.42, 0.16, 0.06), T(sg * 0.95, 1.4, fz + 1.82))));
      inner.add(new THREE.Mesh(lights, k === 0 ? mat.head : mat.tail));
      sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.3), new THREE.MeshBasicMaterial({ map: destSignTexture('Kevin Metro') }));
      sign.position.set(0, 3.45, fz + 1.18); sign.rotation.x = -0.55; inner.add(sign);
    }
    group.add(car);
    carObjs.push({ car, sign });
  }
  // platform-side door leaves for the whole train: one instanced mesh for leaves, one for their windows
  const nLeaves = cars * DOORS.length * 2;
  const leaves = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 1.95, 0.66), mat.door, nLeaves);
  const panes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.85, 0.38), mat.glass, nLeaves);
  leaves.frustumCulled = false; panes.frustumCulled = false; leaves.castShadow = true;
  group.add(leaves, panes);
  // gangways and couplers between cars
  const gang = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 2.3, 1.0), mat.rubber, cars - 1);
  const coup = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.3, 1.0), mat.rubber, cars - 1);
  gang.frustumCulled = false; coup.frustumCulled = false; gang.castShadow = true;
  group.add(gang, coup);
  // x-ray ghost for when the train runs underground
  const ghost = new THREE.InstancedMesh(new THREE.BoxGeometry(3.0, 2.8, CAR_LEN - 0.6), new THREE.MeshBasicMaterial({ color: lineHex, transparent: true, opacity: 0.6, depthTest: false }), cars);
  ghost.renderOrder = 999; ghost.frustumCulled = false; ghost.visible = false;

  return { group, cars: carObjs, leaves, panes, gang, coup, ghost, platformSide, doorAmt: 0, length: cars * CAR_LEN + (cars - 1) * CAR_GAP };
}

const _m = new THREE.Matrix4(); const _q = new THREE.Quaternion(); const _one = new THREE.Vector3(1, 1, 1); const _p = new THREE.Vector3();
function updateDoors(train) {
  const open = train.doorAmt; let i = 0;
  train.cars.forEach((c) => {
    c.car.updateMatrixWorld();
    DOORS.forEach((d) => [-1, 1].forEach((half) => {
      const x = train.platformSide * (HALF + 0.03 + 0.05 * Math.min(1, open * 3));
      const z = d + half * 0.335 + half * 0.62 * open;
      _m.compose(_p.set(x, 2.08, z), _q.identity(), _one).premultiply(c.car.matrixWorld); train.leaves.setMatrixAt(i, _m);
      _m.compose(_p.set(x + train.platformSide * 0.005, 2.46, z), _q.identity(), _one).premultiply(c.car.matrixWorld); train.panes.setMatrixAt(i, _m);
      i++;
    }));
  });
  train.leaves.instanceMatrix.needsUpdate = true; train.panes.instanceMatrix.needsUpdate = true;
}

/* Place the consist with its head at arc length sHead on track `lat`. */
export function placeTrain(train, line, sHead, lat) {
  const ends = [];
  train.cars.forEach((c, k) => {
    const sc = sHead - CAR_LEN / 2 - k * (CAR_LEN + CAR_GAP);
    const f = line.trackPoint(sc + BOGIE, lat); const r = line.trackPoint(sc - BOGIE, lat);
    const mid = f.clone().add(r).multiplyScalar(0.5);
    c.car.position.copy(mid); c.car.lookAt(f);
    const fwd = f.clone().sub(r).normalize();
    ends.push({ front: mid.clone().addScaledVector(fwd, CAR_LEN / 2 + 0.02), back: mid.clone().addScaledVector(fwd, -CAR_LEN / 2 - 0.02), mid, fwd });
    _m.compose(_p.copy(mid).setY(mid.y + 2.3), c.car.quaternion, _one); train.ghost.setMatrixAt(k, _m);
  });
  train.ghost.instanceMatrix.needsUpdate = true;
  for (let k = 0; k < ends.length - 1; k++) {
    const a = ends[k].back; const b = ends[k + 1].front; const m = a.clone().add(b).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), a.clone().sub(b).setY(0).normalize());
    _m.compose(_p.copy(m).setY(m.y + 2.15), q, _one); train.gang.setMatrixAt(k, _m);
    _m.compose(_p.copy(m).setY(m.y + 0.9), q, _one); train.coup.setMatrixAt(k, _m);
  }
  train.gang.instanceMatrix.needsUpdate = true; train.coup.instanceMatrix.needsUpdate = true;
  updateDoors(train);
  return ends;
}

/* Open (1) or close (0) the platform-side doors. */
export function setDoors(train, _side, amount) { train.doorAmt = amount; updateDoors(train); }
