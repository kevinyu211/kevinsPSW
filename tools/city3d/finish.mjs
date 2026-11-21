// Validate the GLBs against the manifest and write the final manifest.json.
// usage: node finish.mjs <outDir> <modelsDir>
import fs from 'node:fs';
import path from 'node:path';
const [outDir, modelsDir] = process.argv.slice(2);
const readGlb = (p) => { const b = fs.readFileSync(p); if (b.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB: ' + p); const n = b.readUInt32LE(12); return { json: JSON.parse(b.subarray(20, 20 + n).toString('utf8')), bytes: b.length }; };
const kit = JSON.parse(fs.readFileSync(path.join(outDir, 'kit.json')));
const lms = JSON.parse(fs.readFileSync(path.join(outDir, 'landmarks.json')));
const manifest = { version: 1, unit: 'm', files: { kit: 'kit.glb', landmarks: 'landmarks.glb' },
  conventions: 'Y up, metres, front = +Z, origin at footprint centre on the ground. Vertex colours (COLOR_0, with baked AO) multiply one shared facade atlas. Screens and parts are child nodes of their model. Station canopies are white so code can tint them.',
  kit, landmarks: lms };
let bad = 0;
const fail = (m) => { bad++; console.error('FAIL ' + m); };
for (const [key, rows] of [['kit', kit], ['landmarks', lms]]) {
  const { json, bytes } = readGlb(path.join(modelsDir, manifest.files[key]));
  const ext = json.extensionsRequired || [];
  if (ext.includes('EXT_meshopt_compression')) manifest.compression = 'meshopt';
  const nodes = json.nodes || [];
  const byName = new Map(nodes.map((n, i) => [n.name, i]));
  const roots = new Set((json.scenes[json.scene || 0].nodes || []).map((i) => nodes[i].name));
  const kids = (name) => (nodes[byName.get(name)].children || []).map((i) => nodes[i].name);
  for (const r of rows) {
    if (!roots.has(r.name)) { fail(`${key}: ${r.name} is not a top-level node`); continue; }
    const n = nodes[byName.get(r.name)];
    if (n.translation && n.translation.some((v) => Math.abs(v) > 1e-4)) fail(`${r.name}: node is not at the origin`);
    const prim = json.meshes[n.mesh].primitives[0];
    if (prim.attributes.COLOR_0 === undefined) fail(`${r.name}: no COLOR_0`);
    if (prim.attributes.TEXCOORD_0 === undefined) fail(`${r.name}: no UVs`);
    for (const c of [...(r.screens || []), ...(r.parts || [])]) if (!kids(r.name).includes(c)) fail(`${r.name}: child ${c} missing`);
    if (key === 'landmarks' && !(r.screens || []).length) fail(`${r.name}: no screen`);
  }
  const extra = [...roots].filter((n) => !rows.some((r) => r.name === n));
  if (extra.length) fail(`${key}: unexpected top-level nodes ${extra.join(', ')}`);
  if (json.cameras || (json.extensions && json.extensions.KHR_lights_punctual)) fail(`${key}: cameras or lights present`);
  const mats = (json.materials || []).map((m) => `${m.name}${m.doubleSided ? ' (double-sided)' : ''}`);
  console.log(`${manifest.files[key]}: ${rows.length} models, ${rows.reduce((a, r) => a + r.tris, 0)} tris, ${(bytes / 1024).toFixed(0)} KB, materials: ${mats.join(', ')}, extensions: ${(json.extensionsUsed || []).join(', ') || 'none'}`);
}
fs.writeFileSync(path.join(modelsDir, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(bad ? `${bad} problem(s)` : 'manifest.json written, all names check out');
process.exit(bad ? 1 : 0);
