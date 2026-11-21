// Compress the raw GLBs (meshopt), check them against the row lists, and write manifest.json.
// usage: node finish_island.mjs <outDir> <modelsDir>
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, prune, quantize, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const [outDir, modelsDir] = process.argv.slice(2);
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const FILES = { buildings: 'buildings.glb', props: 'props.glb' };
const MATS = ['city', 'glass', 'glow', 'sign', 'pearl', 'metal', 'stone', 'rubber', 'glass_dark', 'glass_tint'];
let bad = 0;
const fail = (m) => { bad++; console.error('FAIL ' + m); };
const models = [];
const sizes = {};

for (const [key, fname] of Object.entries(FILES)) {
  const rows = JSON.parse(fs.readFileSync(path.join(outDir, key + '.json')));
  const doc = await io.read(path.join(outDir, key + '.raw.glb'));
  // Positions stay real 32-bit floats in metres (so the site can instance and merge geometry without
  // surprises); they are snapped to 2 mm so they pack well. Normals and colours are quantized.
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const a = pos.getArray();
      for (let i = 0; i < a.length; i++) a[i] = Math.round(a[i] * 512) / 512;
      pos.setArray(a);
    }
  }
  await doc.transform(dedup(), reorder({ encoder: MeshoptEncoder }),
    quantize({ pattern: /^(NORMAL|COLOR_\d+)$/, quantizeNormal: 8, quantizeColor: 8 }), prune({ keepAttributes: true, keepLeaves: true }));
  doc.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const out = path.join(modelsDir, fname);
  await io.write(out, doc);

  // ---- read it back (decodes meshopt) and check every name
  const back = await io.read(out);
  const root = back.getRoot();
  const scene = root.getDefaultScene() || root.listScenes()[0];
  const tops = new Map(scene.listChildren().map((n) => [n.getName(), n]));
  const used = new Set();
  const trisOf = (node) => {
    let t = 0;
    const mesh = node.getMesh();
    if (mesh) for (const p of mesh.listPrimitives()) {
      t += (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3;
      const mn = p.getMaterial() && p.getMaterial().getName();
      used.add(mn);
      if (!MATS.includes(mn)) fail(`${node.getName()}: unexpected material ${mn}`);
      if (!p.getAttribute('COLOR_0')) fail(`${node.getName()}: no COLOR_0`);
      if (p.getAttribute('POSITION').getComponentType() !== 5126) fail(`${node.getName()}: positions are not floats`);
    }
    return t;
  };
  let total = 0;
  for (const r of rows) {
    const n = tops.get(r.name);
    if (!n) { fail(`${key}: ${r.name} is not a top-level node`); continue; }
    if (n.getTranslation().some((v) => Math.abs(v) > 1e-5) || n.getScale().some((v) => Math.abs(v - 1) > 1e-5) || Math.abs(n.getRotation()[3] - 1) > 1e-5) fail(`${r.name}: node is not at the origin`);
    let tris = trisOf(n);
    const kids = new Map(n.listChildren().map((c) => [c.getName(), c]));
    const children = [];
    const pivots = {};
    for (const c of r.children || []) {
      const k = kids.get(c.name);
      if (!k) { fail(`${r.name}: child ${c.name} missing`); continue; }
      const t = k.getTranslation();
      if (t.some((v, i) => Math.abs(v - c.pivot[i]) > 0.01)) fail(`${c.name}: pivot ${t} != ${c.pivot}`);
      tris += trisOf(k);
      children.push(c.name);
      pivots[c.name] = c.pivot;
    }
    for (const kn of kids.keys()) if (!children.includes(kn)) fail(`${r.name}: unexpected child ${kn}`);
    total += tris;
    const row = { name: r.name, file: fname, class: r.class, size: r.size, tris };
    row.min = r.min; row.max = r.max;
    if (children.length) { row.children = children; row.pivots = pivots; }
    for (const [k, v] of Object.entries(r)) if (!(k in row) && k !== 'children') row[k] = v;
    if (r.class === 'building') row.levels = [3, 4, 5];
    models.push(row);
  }
  const extra = [...tops.keys()].filter((n) => !rows.some((r) => r.name === n));
  if (extra.length) fail(`${key}: unexpected top-level nodes ${extra.join(', ')}`);
  if (root.listCameras().length) fail(`${key}: cameras present`);
  sizes[key] = { file: fname, bytes: fs.statSync(out).size, models: rows.length, tris: total };
  console.log(`${fname}: ${rows.length} models, ${total} tris, ${(fs.statSync(out).size / 1024).toFixed(0)} KB (raw ${(fs.statSync(path.join(outDir, key + '.raw.glb')).size / 1024).toFixed(0)} KB), materials: ${[...used].join(', ')}`);
}

// ---- budgets (reported, not fatal)
const over = [];
for (const m of models) {
  const lim = m.name === 'tower' ? 12000 : m.class === 'building' || m.class === 'station' ? 9000 : m.class === 'tree' ? 700 : m.class === 'car' ? (m.name === 'bus' ? 500 : 260) : m.class === 'train' ? 2400 : m.class === 'lane' ? 250 : m.name === 'gull' ? 60 : null;
  if (lim && m.tris > lim) over.push(`${m.name} ${m.tris} (limit about ${lim})`);
}
if (over.length) console.log('over the triangle guide: ' + over.join('; '));

const buildings = {};
for (const m of models.filter((x) => x.class === 'building')) {
  const b = buildings[m.project] || (buildings[m.project] = { model: 'b_' + m.project, district: m.district, levels: [1, 2, 3, 4, 5], nodes: { 1: 'lot', 2: m.site } });
  b.nodes[m.level] = m.name;
}
const manifest = {
  version: 1, unit: 'm', files: FILES, compression: 'meshopt (EXT_meshopt_compression; normals and colours quantized, positions are plain floats in metres)',
  totals: sizes,
  conventions: {
    axes: 'glTF Y up. Buildings: front (entrance) faces +Z, origin at the footprint centre on the ground. Moving things (trains, tram, cars, bus, boats, animals): length along X, facing +X.',
    lane: 'There is no track. The metro cars and the hill pod (node `tram`) float along a lane. Their origin is on the lane datum, which the numbers still call rail level (railLevel, track.railTop): the floor is `floor` above it and the belly `underside` above it. lane_ring and lane_ring_double are gates the trains fly through: origin at the ring\'s centre, axis along X; place the centre `aboveDatum` over the datum (and, for the double one, midway between the two lanes).',
    nodes: 'Every model is a top-level node at the origin. Moving parts are child nodes named <model>_<part>; their own origin is the pivot (listed under pivots).',
    colour: 'No textures. COLOR_0 (linear) carries the film-look colour with ambient occlusion baked in. For the white model look, replace the material and ignore COLOR_0, or multiply it away.',
    door: 'door = [x, z] in the model\'s own space: where the street should meet the plot.',
    size: 'size = [width (x), height above the origin (y), depth (z)]; min and max give the full box, including parts below the ground (skirts, piles).',
  },
  materials: {
    _how: 'Every material multiplies its base colour (white) by the vertex colour (COLOR_0), so colour and baked shade still come from the vertices; the material adds how the surface behaves. Names containing "glass" are glazing; everything that is not glass, glow or sign can share one matte material if reflections are not wanted. For the real look give pearl, metal and both glasses an environment map.',
    city: 'Anything painted or natural: matte. Roughness 0.82, metalness 0.',
    pearl: 'Glossy white coachwork and shells (train and pod bodies, building shells, canopies). Roughness 0.26, metalness 0: wants sky reflections.',
    metal: 'Brushed metal (rails, poles, masts, frames, lamp posts). Roughness 0.36, metalness 0.9.',
    stone: 'Paving, kerbs, plinths and masonry: fully matte. Roughness 0.94.',
    rubber: 'Dark trims, tyres, seals, gangway openings. Roughness 0.7.',
    glass_tint: 'Smoked, slightly blue-grey glass for the train and pod canopies and door leaves: reflects the sky and lets the cabin show only faintly, like a bullet train\'s windows. alphaMode BLEND, alpha 0.82, roughness 0.06, metalness 0.3. COLOR_0 is already the dark smoke tint. Draw it after the opaque parts.',
    glass: 'Clear tinted glass you can see through (platform screens and gates, lift shafts, railings, the station entrance). alphaMode BLEND, alpha 0.34, roughness 0.05. COLOR_0 is the tint. Draw it after the opaque parts, without writing depth.',
    glass_dark: 'Opaque reflective glazing for building windows (there is nothing modelled behind them). Roughness 0.1, metalness 0.4. COLOR_0 is the tint.',
    sign: 'Name boards and next-train displays (child nodes <model>_sign_n, <model>_board_n): one quad each with 0-1 UVs (u to the right, v up, seen from the front). Give it your own texture.',
    glow: 'Window panes, signs and lamps to light at night. COLOR_0 is the daytime colour. At night set emissive (warm: #ffd58a) and raise emissiveIntensity; to keep each sign\'s own colour, multiply emissive by the vertex colour in the shader.',
  },
  levels: { 1: 'lot', 2: 'site_small or site_large (see buildings.<id>.nodes[2])', 3: 'b_<id>_L3', 4: 'b_<id>_L4', 5: 'b_<id>_L5' },
  buildings, models,
};
fs.writeFileSync(path.join(modelsDir, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(bad ? `${bad} problem(s)` : `manifest.json written: ${models.length} models, all names check out`);
process.exit(bad ? 1 : 0);
