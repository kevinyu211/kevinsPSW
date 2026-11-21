#!/usr/bin/env node
/* Kevin Yu · the island city · PLAN CHECK.
   Builds the town plan from the real data file and the real model manifest, and FAILS LOUDLY if anything is wrong:
   an overlap, something off the land or on a road, a broken road network, a door nobody can walk to, a station on a
   bend, a lane that turns too tightly, a plot too small for its building, a building with its back to the street.
   Then it adds a project to every town, and a sixth town, and checks again.

     node designs/city/plan-check.mjs            the test (exit code 1 on any problem)
     node designs/city/plan-check.mjs --shots    also save the map pictures (needs Playwright and the local server:
                                                 NODE_PATH=$(npm root -g), python3 -m http.server 8765 at the repo root)
     node designs/city/plan-check.mjs --list     print every problem instead of the first 40
     node designs/city/plan-check.mjs --self-test  also break the plan on purpose 15 ways and confirm each fault is caught */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { buildPlan, PLAN, coast, pointInPoly, polyGap, polyLineGap, distToLine, distToSeg, footprint, groundBox, toWorld, treeRadius, treeDisc, height, hillAmount, hillHeight, shoreDistance, softShoreDistance, buildable } from './plan.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const data = await import('./city-data.js');
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'models/manifest.json'), 'utf8'));
const content = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(HERE, '../shared/content.js'), 'utf8'), content);
const projects = content.window.KY.projects;
const ARGS = new Set(process.argv.slice(2));

/* ---------- the limits the plan is held to ---------- */
const LIMIT = {
  gapBuildings: 4,        // between any two of: project building, station, tower, lighthouse, ferry terminal, house (walls, not plots)
  gapHouses: 2.5,         // between two houses
  gapProps: 0.25,         // lamps, benches, umbrellas, sunbeds, from anything
  gapTree: 0.5,           // a tree's canopy from any footprint
  treeSpacing: 3.5,       // trunk to trunk
  gapPlots: 3.9,          // between two plots
  plotToRoad: 0.9,        // a plot's edge from a road's kerb (the pavement)
  onRoad: 0.3, onPath: 0.15,   // a footprint from a road's kerb, a path's edge
  laneRadius: 80,         // the tightest bend a metro lane may make
  stationStraight: 35,    // straight lane each side of a station's centre (70 m in all)
  faceStreet: 20,         // a door looks onto a street, its square or the waterfront walk within this many metres
  hillGrade: 0.14,        // the steepest the hill road may climb
  podClear: 3,            // the pod's lane from anything as tall as it flies
};

const key = (p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const bbox = (poly) => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const p of poly) { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); } return [a, b, c, d]; };
const apart = (A, B, pad) => A[2] < B[0] - pad || B[2] < A[0] - pad || A[3] < B[1] - pad || B[3] < A[1] - pad;
const pointToPoly = (p, poly) => (pointInPoly(p, poly) ? 0 : distToLine(p, poly, true));
const hitT = (a, b, c, d) => { const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]]; const den = r[0] * s[1] - r[1] * s[0]; if (Math.abs(den) < 1e-9) return null; const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den; return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { t, u, p: [a[0] + r[0] * t, a[1] + r[1] * t] } : null; };
const sampleLine = (line, step) => { const out = []; for (let i = 0; i < line.length - 1; i++) { const n = Math.max(1, Math.ceil(dist(line[i], line[i + 1]) / step)); for (let k = 0; k < n; k++) out.push([line[i][0] + ((line[i + 1][0] - line[i][0]) * k) / n, line[i][1] + ((line[i + 1][1] - line[i][1]) * k) / n]); } out.push(line[line.length - 1]); return out; };
const BIG = new Set(['building', 'station', 'tower', 'house', 'landmark']);
const SMALL = new Set(['lamp', 'bench', 'beach']);

/** Everything a placement covers, as parts: { poly, water } (a pier or a jetty stands in the water). */
function partsOf(pl, d) {
  if (pl.kind === 'tree') return [{ poly: treeDisc(pl, d) }];
  if (d.plazaRadius) return [{ poly: Array.from({ length: 24 }, (_, k) => [pl.x + d.plazaRadius * Math.cos(k * 0.261799), pl.z + d.plazaRadius * Math.sin(k * 0.261799)]) }];
  const box = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => toWorld(pl, x, z));
  if (d.quayEdge != null) return [{ poly: box(d.min[0], d.quayEdge, d.max[0], d.max[2]) }, { poly: box(d.min[0], d.min[2], d.max[0], d.quayEdge), water: true }];
  if (d.jettyEnd) return [{ poly: box(d.min[0], -6.2, d.max[0], d.max[2]) }, { poly: box(-2.8, d.jettyEnd[1], 2.8, -6.2), water: true }];   // the pavilion on its pad, and the 5.2 m wide jetty
  return [{ poly: footprint(pl, d) }];
}

/** Run every check on one plan. Returns a list of problems (strings). */
function check(plan, mf) {
  const bad = []; const say = (group, msg) => bad.push(`[${group}] ${msg}`);
  const defs = new Map(mf.models.map((m) => [m.name, m])); const Y0 = plan.plateau;
  for (const p of plan.problems) say('plan', p);

  /* 1. models */
  for (const pl of plan.placements) if (!defs.has(pl.model) && !pl.builtin) say('model', `${pl.model} is not in the manifest`);

  /* 2. footprints */
  const items = [];
  plan.placements.forEach((pl, i) => { const d = defs.get(pl.model); if (!d || pl.kind === 'gate') return; for (const part of partsOf(pl, d)) items.push({ i, pl, d, kind: pl.kind, poly: part.poly, water: !!part.water || !!pl.water, bb: bbox(part.poly), top: Y0 + (d.size[1] || 0) * (pl.scale || 1) + hillHeight(pl.x, pl.z), name: `${pl.model}${pl.project ? ` (${pl.project})` : ''} at ${pl.x},${pl.z}` }); });
  const need = (a, b) => {
    if (a.i === b.i) return null;
    if (a.kind === 'tree' && b.kind === 'tree') return 'trees';
    if (a.kind === 'tree' || b.kind === 'tree') return LIMIT.gapTree;
    if (SMALL.has(a.kind) || SMALL.has(b.kind)) return LIMIT.gapProps;
    if (a.kind === 'boat' || b.kind === 'boat') return 0.5;
    if (a.kind === 'house' && b.kind === 'house') return LIMIT.gapHouses;
    return LIMIT.gapBuildings;
  };
  for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
    const A = items[a], B = items[b]; const want = need(A, B); if (want == null) continue;
    if (want === 'trees') { if (dist([A.pl.x, A.pl.z], [B.pl.x, B.pl.z]) < LIMIT.treeSpacing) say('overlap', `two trees ${dist([A.pl.x, A.pl.z], [B.pl.x, B.pl.z]).toFixed(1)} m apart at ${A.pl.x},${A.pl.z}`); continue; }
    if (apart(A.bb, B.bb, want)) continue; const g = polyGap(A.poly, B.poly);
    if (g < want - 0.01) say('overlap', `${A.name} and ${B.name}: ${g === 0 ? 'they overlap' : `only ${g.toFixed(2)} m apart (need ${want})`}`);
  }

  /* 3. plots: apart from each other, clear of roads, paths, squares and the lanes; nothing else stands on them */
  const plots = plan.lots.filter((l) => l.use === 'project' || l.use === 'reserved'); const loop = plan.metro.centre;
  for (const l of plots) l.bb = bbox(l.poly);
  for (let a = 0; a < plots.length; a++) for (let b = a + 1; b < plots.length; b++) { if (apart(plots[a].bb, plots[b].bb, LIMIT.gapPlots)) continue; const g = polyGap(plots[a].poly, plots[b].poly); if (g < LIMIT.gapPlots) say('plots', `plots ${plots[a].id} and ${plots[b].id} are ${g.toFixed(2)} m apart (need ${LIMIT.gapPlots})`); }
  for (const l of plots) {
    const c = l.poly.reduce((m, p) => [m[0] + p[0] / l.poly.length, m[1] + p[1] / l.poly.length], [0, 0]);
    for (const p of l.poly) { const q = [p[0] + (c[0] - p[0]) * 0.012, p[1] + (c[1] - p[1]) * 0.012]; if (!buildable(q[0], q[1])) { say('ground', `plot ${l.id} is not on flat buildable land at ${p}`); break; } }
    for (const r of plan.roads) { const g = polyLineGap(l.poly, r.points, r.width / 2); if (g < LIMIT.plotToRoad - 0.01) say('plots', `plot ${l.id} is ${g.toFixed(2)} m from the kerb of ${r.id} (need ${LIMIT.plotToRoad})`); }
    for (const r of plan.paths) { if (r.id === `door-${l.project}`) continue; const g = polyLineGap(l.poly, r.points, r.width / 2); if (g < -0.01) say('plots', `path ${r.id} crosses plot ${l.id}`); }
    for (const z of plan.zones) if (z.use === 'square' && polyGap(l.poly, z.poly) < 0.5) say('plots', `plot ${l.id} overlaps ${z.id}`);
    const inner = l.poly.map((p) => { const d = [c[0] - p[0], c[1] - p[1]]; const n = Math.hypot(...d); return [p[0] + (d[0] / n) * PLAN.setback * Math.SQRT2, p[1] + (d[1] / n) * PLAN.setback * Math.SQRT2]; });   // where a building's walls can reach
    const gl = Math.min(...inner.map((p) => distToLine(p, loop)), ...loop.filter((p) => !apart([p[0], p[1], p[0], p[1]], l.bb, 8)).map((p) => pointToPoly(p, inner)));
    if (gl < PLAN.metro.corridor) say('lanes', `a building on plot ${l.id} could stand ${gl.toFixed(1)} m from the metro lanes (need ${PLAN.metro.corridor})`);
    for (const it of items) { if (it.pl.lot === l.id || apart(it.bb, l.bb, 0.5)) continue; if (polyGap(it.poly, l.poly) < 0.05) say('plots', `${it.name} stands on plot ${l.id}`); }
  }

  /* 4. the largest level of every project fits its plot, with the setback */
  for (const l of plots.filter((q) => q.use === 'project')) {
    const nodes = ((mf.buildings || {})[l.project] || {}).nodes || { 1: 'lot', 2: 'site_small' }; const o = { ...l.origin, scale: plan.scale };
    const fm = [l.front.x, l.front.z]; const edges = l.poly.map((p, i) => [p, l.poly[(i + 1) % l.poly.length]]); const far = edges.map(([a, b]) => distToSeg(fm, a, b)); const back = far.indexOf(Math.max(...far));
    for (const [lvl, name] of Object.entries(nodes)) {
      const d = defs.get(name); if (!d) { say('model', `${l.project} level ${lvl}: ${name} is not in the manifest`); continue; }
      const b = groundBox(d); if (d.quayEdge != null) b[1] = d.quayEdge;
      for (const [x, z] of [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]]) {
        const w = toWorld(o, x, z); const inset = Math.min(...edges.filter((_, i) => !(l.quay && i === back)).map(([a, c]) => distToSeg(w, a, c)));
        const inside = pointInPoly([w[0] + (l.origin.x - w[0]) * 1e-3, w[1] + (l.origin.z - w[1]) * 1e-3], l.poly);
        if (!inside || inset < PLAN.setback - 0.02) { say('plots', `plot ${l.id} is too small for ${l.project} at level ${lvl} (${name}): a corner is ${inside ? inset.toFixed(2) : 'outside'} (need ${PLAN.setback} m inside)`); break; }
      }
    }
  }

  /* 5. everything stands on the right kind of ground */
  const beach = plan.zones.find((z) => z.use === 'beach');
  for (const it of items) {
    const c = it.poly.reduce((m, p) => [m[0] + p[0] / it.poly.length, m[1] + p[1] / it.poly.length], [0, 0]); const pts = [...it.poly.map((p) => [p[0] + (c[0] - p[0]) * 0.01, p[1] + (c[1] - p[1]) * 0.01]), c];
    if (it.water) { const wet = it.poly.filter((p) => !pointInPoly(p, coast)).length; if (it.kind === 'boat' ? wet < it.poly.length : wet < 2) say('ground', `${it.name} should be in the water`); continue; }
    const on = (test, what) => { const p = pts.find((q) => !test(q)); if (p) say('ground', `${it.name} is not ${what} (at ${p.map((n) => n.toFixed(1))})`); };
    if (it.d.name === 'tower' || it.d.name === 'tram_stop') on((p) => hillAmount(p[0], p[1]) >= 0.999, 'on the flat top of the hill');
    else if (it.kind === 'tree') on((p) => pointInPoly(p, coast) && shoreDistance(p[0], p[1]) >= 1.5, 'on the land');
    else if (it.kind === 'beach') on((p) => pointInPoly(p, coast) && shoreDistance(p[0], p[1]) >= 2.5 && beach && pointInPoly(p, beach.poly), 'on the beach');
    else if (SMALL.has(it.kind)) on((p) => pointInPoly(p, coast) && shoreDistance(p[0], p[1]) >= 0.8, 'on the land');
    else if (it.pl.ground === 'shore') on((p) => pointInPoly(p, coast) && shoreDistance(p[0], p[1]) >= 1.5 && hillAmount(p[0], p[1]) === 0, 'on the land');   // the lighthouse stands on the rocks at the water's edge
    else on((p) => buildable(p[0], p[1]), 'on flat buildable land');
  }

  /* 6. nothing stands on a road or a path, or in the lanes' corridor */
  for (const it of items) {
    if (it.water) continue;
    for (const r of plan.roads) { const rb = r.bb || (r.bb = bbox(r.points)); if (apart(it.bb, rb, 6)) continue; const g = polyLineGap(it.poly, r.points, r.width / 2); if (g < (it.kind === 'lamp' ? 0.15 : LIMIT.onRoad) - 0.01) say('on road', `${it.name} is ${g <= 0 ? 'on' : `${g.toFixed(2)} m from`} ${r.id}`); }
    for (const r of plan.paths) { const rb = r.bb || (r.bb = bbox(r.points)); if (apart(it.bb, rb, 4)) continue; if (pointToPoly(r.points[0], it.poly) < 0.6 || pointToPoly(r.points[r.points.length - 1], it.poly) < 0.6) continue;   /* a path may start or end at this building's own door */ const g = polyLineGap(it.poly, r.points, r.width / 2); if (g < LIMIT.onPath - 0.01) say('on path', `${it.name} is ${g <= 0 ? 'on' : `${g.toFixed(2)} m from`} path ${r.id}`); }
    if (it.kind === 'station' && it.d.track) continue;
    const gl = Math.min(...it.poly.map((p) => distToLine(p, loop)));
    if (gl < PLAN.metro.corridor - 0.01) say('lanes', `${it.name} is ${gl.toFixed(1)} m from the metro lanes (need ${PLAN.metro.corridor})`);
  }
  // a crane's jib swings in the air: nothing as tall as the jib may stand under its circle
  for (const it of items) { const jib = it.d.pivots && Object.entries(it.d.pivots).find(([k]) => k.endsWith('_jib')); if (!jib) continue; const c = toWorld(it.pl, jib[1][0], jib[1][2]); const reach = Math.max(Math.abs(it.d.max[0] - jib[1][0]), Math.abs(it.d.min[0] - jib[1][0])) * (it.pl.scale || 1); const jy = Y0 + jib[1][1] * (it.pl.scale || 1);
    for (const o of items) if (o.i !== it.i && o.top > jy - 3 && pointToPoly(c, o.poly) < reach + 1) say('overlap', `the crane on ${it.name} would swing into ${o.name}`); }

  /* 7. roads: on the land, connected, no stubs, every crossing a shared point */
  const nodes = new Map(); const link = (a, b) => { for (const [p, q] of [[a, b], [b, a]]) { const k = key(p); if (!nodes.has(k)) nodes.set(k, new Set()); nodes.get(k).add(key(q)); } };
  for (const r of plan.roads) {
    for (let i = 0; i < r.points.length - 1; i++) link(r.points[i], r.points[i + 1]);
    for (const p of sampleLine(r.points, 4)) {
      if (!pointInPoly(p, coast) || shoreDistance(p[0], p[1]) < r.width / 2 + 0.5) { say('road', `${r.id} leaves the land at ${p.map((n) => n.toFixed(1))}`); break; }
      if (r.kind !== 'hill' && hillHeight(p[0], p[1]) > 1.5) { say('road', `${r.id} climbs the hill at ${p.map((n) => n.toFixed(1))}`); break; }
    }
    if (r.kind === 'hill') for (let i = 0; i < r.points.length - 1; i++) { const a = r.points[i], b = r.points[i + 1]; const run = dist(a, b); if (run < 0.5) continue; const g = Math.abs(height(b[0], b[1]) - height(a[0], a[1])) / run; if (g > LIMIT.hillGrade) { say('road', `${r.id} climbs at ${(g * 100).toFixed(0)}% near ${a} (limit ${LIMIT.hillGrade * 100}%)`); break; } }
  }
  { const seen = new Set(); const start = nodes.keys().next().value; const stack = [start]; while (stack.length) { const k = stack.pop(); if (seen.has(k)) continue; seen.add(k); for (const n of nodes.get(k)) if (!seen.has(n)) stack.push(n); }
    if (seen.size !== nodes.size) { for (const r of plan.roads) if (!seen.has(key(r.points[0]))) say('road', `${r.id} is not joined to the road network`); } }
  for (const r of plan.roads) { if (r.closed) continue; for (const end of [r.points[0], r.points[r.points.length - 1]]) if (nodes.get(key(end)).size === 1 && !r.culdesac) say('road', `${r.id} ends in a stub at ${end}`); }
  for (let a = 0; a < plan.roads.length; a++) for (let b = a + 1; b < plan.roads.length; b++) { const A = plan.roads[a], B = plan.roads[b]; if (apart(A.bb, B.bb, 1)) continue;
    outer: for (let i = 0; i < A.points.length - 1; i++) for (let j = 0; j < B.points.length - 1; j++) { const h = hitT(A.points[i], A.points[i + 1], B.points[j], B.points[j + 1]); if (!h) continue; const shared = [A.points[i], A.points[i + 1]].some((p) => [B.points[j], B.points[j + 1]].some((q) => dist(p, q) < 0.011)); if (!shared) { say('road', `${A.id} and ${B.id} cross at ${h.p.map((n) => n.toFixed(1))} without a shared junction point`); break outer; } } }

  /* 8. paths stay on the land */
  for (const r of plan.paths) for (const p of sampleLine(r.points, 3)) if (!pointInPoly(p, coast) || shoreDistance(p[0], p[1]) < 0.8) { say('path', `${r.id} leaves the land at ${p.map((n) => n.toFixed(1))}`); break; }

  /* 9. the metro: gentle bends, two lanes the right distance apart, every station on a straight */
  for (const [name, lane] of [['clockwise lane', plan.metro.cw], ['anticlockwise lane', plan.metro.ccw]]) {
    let worst = Infinity; const n = lane.length - 1;
    for (let i = 0; i < n; i++) { const a = lane[i], b = lane[(i + 4) % n], c = lane[(i + 8) % n];   /* points about 8 m apart, so rounding to the centimetre does not matter */ const ab = dist(a, b), bc = dist(b, c), ca = dist(c, a); const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2; if (area < 1e-4) continue; worst = Math.min(worst, (ab * bc * ca) / (4 * area)); }
    if (worst < LIMIT.laneRadius - 0.3) say('lanes', `the ${name} bends at a radius of ${worst.toFixed(1)} m (limit ${LIMIT.laneRadius})`);
    plan.metro[`minRadius_${name[0]}`] = worst;
  }
  if (Math.abs(plan.metro.height - 10) > 1e-9) say('lanes', `the lanes fly ${plan.metro.height} m above station ground; the station models expect 10`);
  for (const t of plan.towns) {
    const s = t.station; const d = defs.get(s.model); let bi = 0, bd = Infinity; loop.forEach((p, i) => { const q = dist(p, [s.x, s.z]); if (q < bd) { bd = q; bi = i; } });
    const n = loop.length - 1; const along = [Math.cos(s.rot), -Math.sin(s.rot)]; let worst = 0;
    for (const dir of [1, -1]) { let acc = 0, i = bi; while (acc < LIMIT.stationStraight) { const j = (i + dir + n) % n; acc += dist(loop[i], loop[j]); const off = Math.abs((loop[j][0] - s.x) * along[1] - (loop[j][1] - s.z) * along[0]); if (acc <= LIMIT.stationStraight + 2) worst = Math.max(worst, off); i = j; } }
    const offCentre = Math.min(...loop.slice(0, n).map((p, i) => distToSeg([s.x, s.z], p, loop[i + 1])));
    if (offCentre > 0.05) say('station', `${t.code} ${t.name} stands ${offCentre.toFixed(2)} m off the lanes`);
    if (worst > 0.05) say('station', `${t.code} ${t.name} is not on a straight ${LIMIT.stationStraight * 2} m stretch (the lanes bend ${worst.toFixed(2)} m away within it)`);
    if (Math.min(...s.straight) < LIMIT.stationStraight) say('station', `${t.code} ${t.name}: only ${Math.min(...s.straight)} m of straight on one side`);
    if (d && d.length && Math.min(...s.straight) < d.length / 2) say('station', `${t.code}: the ${d.length} m platforms reach the bend`);
  }

  /* 10. every project: its door looks onto a street, and can be walked to from its town's station entrance */
  const walkLines = [...plan.roads, ...plan.paths]; const wnodes = new Map(); const wlink = (a, b) => { for (const [p, q] of [[a, b], [b, a]]) { const k = key(p); if (!wnodes.has(k)) wnodes.set(k, new Set()); wnodes.get(k).add(key(q)); } };
  for (const r of walkLines) for (let i = 0; i < r.points.length - 1; i++) wlink(r.points[i], r.points[i + 1]);
  const reach = (from) => { const seen = new Set(); const stack = [key(from)]; while (stack.length) { const k = stack.pop(); if (seen.has(k) || !wnodes.has(k)) continue; seen.add(k); for (const n of wnodes.get(k)) stack.push(n); } return seen; };
  for (const t of plan.towns) {
    const sd = defs.get(t.station.model); const entrance = t.station.exits[0]; const from = reach(entrance.at); const sq = t.square;
    if (sd && sd.entrance && sd.entrance.door) { const w = toWorld({ x: t.station.x, z: t.station.z, rot: t.station.rot, scale: 1 }, sd.entrance.door[0], sd.entrance.door[1]); if (dist(w, entrance.at) > 0.05) say('walk', `${t.code}: the walks do not start at the station's entrance`); }
    for (const id of t.projects) {
      const pl = plan.placements.find((p) => p.project === id); const d = defs.get(pl.model); const door = d && d.door ? toWorld(pl, d.door[0], d.door[1]) : pl.door; const f = [Math.sin(pl.rot), Math.cos(pl.rot)];
      const ahead = [door[0] + f[0] * LIMIT.faceStreet, door[1] + f[1] * LIMIT.faceStreet]; const front = [door[0] + f[0] * 0.2, door[1] + f[1] * 0.2];
      const ontoRoad = plan.roads.some((r) => r.points.some((p, i) => i && hitT(front, ahead, r.points[i - 1], p)));
      const ontoWalk = plan.paths.some((r) => (r.kind === 'boardwalk' || r.kind === 'promenade' || r.id.endsWith('-square-walk')) && r.points.some((p, i) => i && hitT(front, ahead, r.points[i - 1], p)));
      const ontoSquare = sq && pointToPoly(door, sq) < 8;
      if (!ontoRoad && !ontoWalk && !ontoSquare) say('street', `${id} does not face a street, its square or the waterfront walk`);
      if (!from.has(key(door.map((n) => Math.round(n * 100) / 100)))) say('walk', `${id}: its door cannot be reached on foot from ${t.code} station`);
      const w = plan.walks[id]; if (!w) { say('walk', `${id}: no walking route`); continue; }
      if (dist(w[0], entrance.at) > 0.05 && !(t.main && t.station.exits.some((e) => dist(w[0], e.at) < 0.05))) say('walk', `${id}: the route does not start at ${t.code}'s entrance`);
      if (dist(w[w.length - 1], door) > 0.05) say('walk', `${id}: the route ends ${dist(w[w.length - 1], door).toFixed(2)} m from the door`);
      for (const p of sampleLine(w, 2)) if (!walkLines.some((r) => !apart([p[0], p[1], p[0], p[1]], r.bb || (r.bb = bbox(r.points)), 1) && distToLine(p, r.points) < 0.35)) { say('walk', `${id}: the route leaves the roads and paths at ${p.map((n) => n.toFixed(1))}`); break; }
      for (const p of sampleLine(w, 2)) { const hit = items.find((it) => BIG.has(it.kind) && it.pl.project !== id && !(it.kind === 'station' && it.pl.town === t.id) && !it.water && pointInPoly(p, it.poly)); if (hit) { say('walk', `${id}: the route runs through ${hit.name}`); break; } }
    }
  }

  /* 11. the hill pod's lane clears the ground and everything tall */
  { const line = plan.pod.path; let acc = 0; const total = line.reduce((s, p, i) => s + (i ? Math.hypot(p[0] - line[i - 1][0], p[2] - line[i - 1][2]) : 0), 0);
    for (let i = 0; i < line.length; i++) { const [x, y, z] = line[i]; if (i) acc += Math.hypot(x - line[i - 1][0], z - line[i - 1][2]);
      if (y < height(x, z) + 0.9) { say('pod', `the pod's lane touches the ground at ${x},${z}`); break; }
      if (acc < 20 || acc > total - 14) continue;
      const hit = items.find((it) => !it.water && it.d.name !== 'station_main' && it.d.name !== 'tram_stop' && it.top > y - 2 && pointToPoly([x, z], it.poly) < LIMIT.podClear);   /* the pod starts and ends at its own docks */ if (hit) { say('pod', `the pod's lane passes ${pointToPoly([x, z], hit.poly).toFixed(1)} m from ${hit.name} at height ${y}`); break; } } }

  /* 12. squares and other tinted zones lie on the land */
  for (const z of plan.zones) { if (z.use === 'beach' || z.use === 'port') continue; const c = z.poly.reduce((m, p) => [m[0] + p[0] / z.poly.length, m[1] + p[1] / z.poly.length], [0, 0]); if (z.poly.some((p) => !pointInPoly([p[0] + (c[0] - p[0]) * 0.02, p[1] + (c[1] - p[1]) * 0.02], coast))) say('ground', `zone ${z.id} runs into the sea`); }
  return bad;
}

/* ---------- 1: the plan as it is today ---------- */
const t0 = Date.now(); const plan = buildPlan(data, manifest, { projects }); const built = Date.now() - t0;
const today = check(plan, manifest);

/* ---------- 2: growth. A new project in every town lands on a reserved plot; nothing else moves ---------- */
const rows = data.PROJECTS || data.STOPS || []; const growth = []; const same = (a, b) => a.model === b.model && a.x === b.x && a.z === b.z && a.rot === b.rot;
const districts = [...new Set(plan.towns.map((t) => t.district))];
{ // a) a small new project (a fenced lot) in every town at once
  const more = { ...data, PROJECTS: [...rows, ...districts.map((d) => ({ id: `new-${d}`, district: d }))], STOPS: undefined };
  const p2 = buildPlan(more, manifest, { projects });
  for (const p of check(p2, manifest)) growth.push(`one more project per town: ${p}`);
  for (const d of districts) { const pr = p2.projects[`new-${d}`]; const was = pr && plan.lots.find((l) => l.id === pr.lot); if (!pr) growth.push(`a new ${d} project was not placed`); else if (!was || was.use !== 'reserved') growth.push(`the new ${d} project did not land on a reserved plot`); }
  for (const a of plan.placements) if (!p2.placements.some((b) => same(a, b))) { growth.push(`adding projects moved ${a.model} at ${a.x},${a.z}`); break; }
}
{ // b) the same, but each new project is already a full "Thriving" building as big as today's mid-sized ones
  const twin = Object.entries(manifest.buildings).map(([id, b]) => { const d = manifest.models.find((m) => m.name === b.nodes[5]); return { id, w: d.size[0], dz: d.size[2] }; }).filter((b) => b.w <= 58 && b.dz <= 42).sort((a, b) => b.w * b.dz - a.w * a.dz)[0];
  const mf2 = { ...manifest, buildings: { ...manifest.buildings } }; for (const d of districts) mf2.buildings[`big-${d}`] = { ...manifest.buildings[twin.id] };
  const more = { ...data, PROJECTS: [...rows, ...districts.map((d) => ({ id: `big-${d}`, district: d }))], STOPS: undefined };
  const p3 = buildPlan(more, mf2, { projects, levels: Object.fromEntries(districts.map((d) => [`big-${d}`, 5])) });
  for (const p of check(p3, mf2)) growth.push(`one more full-size project per town (as big as ${twin.id}): ${p}`);
  for (const a of plan.placements) if (!p3.placements.some((b) => same(a, b))) { growth.push(`adding full-size projects moved ${a.model} at ${a.x},${a.z}`); break; }
}
let p6 = null;
{ // c) a sixth kind of work: a new town and station on the meadow
  const more = { ...data, DISTRICTS: [...(data.DISTRICTS || []), { id: 'newwork', label: 'New work', color: '#7A3FB5' }], TOWNS: [...(data.TOWNS || []), { id: 'meadow', code: 'K6', name: 'Meadow town', district: 'newwork' }], PROJECTS: [...rows, { id: 'new-a', district: 'newwork' }], STOPS: undefined };
  p6 = buildPlan(more, manifest, { projects });
  for (const p of check(p6, manifest)) growth.push(`a sixth town: ${p}`);
  if (p6.towns.length !== plan.towns.length + 1) growth.push('the sixth town did not get a station');
  for (const a of plan.placements) if (['building', 'station', 'tower', 'house', 'landmark'].includes(a.kind) && !p6.placements.some((b) => same(a, b))) { growth.push(`adding a town moved ${a.model} at ${a.x},${a.z}`); break; }
}

/* ---------- 3 (with --self-test): break the plan on purpose and make sure each fault is caught ---------- */
const selfTest = [];
if (ARGS.has('--self-test')) {
  const copy = () => structuredClone(plan); const find = (p, id) => p.placements.find((q) => q.project === id);
  const faults = [
    ['a building pushed onto its neighbour', 'overlap', (p) => { find(p, 'hirvo').x += 40; }],
    ['a tree planted on the coast road', 'on road', (p) => { const t = p.placements.find((q) => q.kind === 'tree'); const r = p.roads[0].points[40]; t.x = r[0]; t.z = r[1]; }],
    ['a house moved into the sea', 'ground', (p) => { const h = p.placements.find((q) => q.kind === 'house'); h.x = 0; h.z = 240; }],
    ['a street cut 12 m short of its junction', 'road', (p) => { const r = p.roads.find((q) => q.id === 'harbour-mid'); const n = r.points.length; const a = r.points[n - 2], b = r.points[n - 1]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); r.points[n - 1] = [b[0] - ((b[0] - a[0]) / l) * 12, b[1] - ((b[1] - a[1]) / l) * 12]; }],
    ['a door path removed', 'walk', (p) => { p.paths = p.paths.filter((q) => q.id !== 'door-yae'); }],
    ['a building turned to face the open sea', 'street', (p) => { find(p, 'trade').rot += Math.PI; }],
    ['a station moved 3 m off the lanes', 'station', (p) => { p.towns[2].station.x += 0; p.towns[2].station.z += 3; }],
    ['a station slid 30 m along onto the bend', 'station', (p) => { const s = p.towns[3].station; s.z += 30; }],
    ['a lane bent to a 60 m radius', 'lanes', (p) => { p.metro.cw = Array.from({ length: 181 }, (_, k) => [60 * Math.cos(k * 0.0349066), 60 * Math.sin(k * 0.0349066)]); }],
    ['a plot shrunk to 70%', 'plots', (p) => { const l = p.lots.find((q) => q.id === 'harbour-A'); const c = l.poly.reduce((m, v) => [m[0] + v[0] / 4, m[1] + v[1] / 4], [0, 0]); l.poly = l.poly.map((v) => [c[0] + (v[0] - c[0]) * 0.7, c[1] + (v[1] - c[1]) * 0.7]); }],
    ['a model the manifest does not have', 'model', (p) => { p.placements.find((q) => q.kind === 'bench').model = 'no_such_model'; }],
    ['a building under the metro lanes', 'lanes', (p) => { const b = find(p, 'duiyao'); b.x = p.metro.centre[300][0]; b.z = p.metro.centre[300][1]; }],
    ['a path laid through a plot', 'plots', (p) => { const l = p.lots.find((q) => q.id === 'north-A'); p.paths.push({ id: 'test', kind: 'footpath', width: 2.4, points: [l.poly[0], l.poly[2]] }); }],
    ['a walking route that stops short of the door', 'walk', (p) => { p.walks.party = p.walks.party.slice(0, -1); }],
    ['the hill road straightened into a steep climb', 'road', (p) => { const r = p.roads.find((q) => q.id === 'hill'); r.points = [r.points[1], r.points[r.points.length - 1]]; }],
  ];
  for (const [what, group, breakIt] of faults) { const p = copy(); breakIt(p); const found = check(p, manifest).filter((m) => m.startsWith(`[${group}]`)); selfTest.push([what, group, found.length]); }
}

/* ---------- the report ---------- */
const pad = (s, n) => String(s).padEnd(n); const c = plan.counts; const roadLen = (k) => plan.roads.filter((r) => r.kind === k).reduce((s, r) => s + r.points.reduce((a, p, i) => a + (i ? dist(p, r.points[i - 1]) : 0), 0), 0);
const use = (u) => plan.lots.filter((l) => l.use === u).length; const mainW = rows.map((r) => plan.placements.find((p) => p.project === r.id)).filter((p) => p && p.level >= 4).map((p) => manifest.models.find((m) => m.name === p.model).size[0] * plan.scale);
console.log('\nISLAND TOWN PLAN: check\n');
const table = [
  ['island', `${plan.island.width.toFixed(0)} × ${plan.island.depth.toFixed(0)} m, hill ${plan.island.hill.h} m, building scale × ${plan.scale}`],
  ['towns', plan.towns.map((t) => `${t.code} ${t.name} (${t.projects.length})`).join(' · ')],
  ['project buildings', `${c.buildings} on ${use('project')} plots, ${use('reserved')} plots reserved (${plan.towns.map((t) => `${t.code} ${plan.lots.filter((l) => l.town === t.id && l.use === 'reserved').length}`).join(', ')})`],
  ['level 4 buildings', mainW.length ? `${Math.min(...mainW).toFixed(0)} to ${Math.max(...mainW).toFixed(0)} m wide = ${((Math.min(...mainW) / plan.island.width) * 100).toFixed(0)} to ${((Math.max(...mainW) / plan.island.width) * 100).toFixed(0)}% of the island's width (the large ones ${Math.min(...mainW.filter((w) => w > 48)).toFixed(0)} to ${Math.max(...mainW).toFixed(0)} m = ${((Math.min(...mainW.filter((w) => w > 48)) / plan.island.width) * 100).toFixed(0)} to ${((Math.max(...mainW) / plan.island.width) * 100).toFixed(0)}%)` : 'none at level 4 yet'],
  ['roads', `${plan.roads.length}: coast ${roadLen('coast').toFixed(0)} m, main ${roadLen('main').toFixed(0)} m, street ${roadLen('street').toFixed(0)} m, lane ${roadLen('lane').toFixed(0)} m, hill ${roadLen('hill').toFixed(0)} m`],
  ['paths', `${plan.paths.length}: ${['promenade', 'boardwalk', 'footpath', 'steps'].map((k) => `${k} ${plan.paths.filter((p) => p.kind === k).length}`).join(', ')}`],
  ['metro', `loop ${plan.metro.length} m, 2 lanes ${plan.metro.gauge} m apart, ${plan.metro.height} m up; tightest bend ${Math.min(plan.metro.minRadius_c, plan.metro.minRadius_a).toFixed(1)} m; ${c.gates} ring gates`],
  ['stations', plan.towns.map((t) => `${t.code} ${Math.min(...t.station.straight).toFixed(0)}+${Math.max(...t.station.straight).toFixed(0)} m straight`).join(' · ')],
  ['walks', Object.entries(plan.walks).map(([id, w]) => `${id} ${w.reduce((a, p, i) => a + (i ? dist(p, w[i - 1]) : 0), 0).toFixed(0)} m`).join(', ')],
  ['placed', `${c.placements} things: ${c.houses} houses, ${c.trees} trees, ${c.lamps} lamps, ${c.benches} benches, ${c.boats} boats, ${plan.placements.filter((p) => p.kind === 'beach').length} beach things`],
  ['zones', Object.entries(plan.zones.reduce((m, z) => { m[z.use] = (m[z.use] || 0) + 1; return m; }, {})).map(([k, v]) => `${k} ${v}`).join(', ')],
  ['sixth town', p6 ? `${p6.towns[p6.towns.length - 1].code} on the south meadow: ${p6.towns[p6.towns.length - 1].projects.length} projects placed, ${p6.roads.length - plan.roads.length} new streets` : 'not tested'],
  ['built in', `${built} ms`],
];
for (const [k, v] of table) console.log(`  ${pad(k, 18)} ${v}`);
const show = (title, list) => { console.log(`\n  ${title}: ${list.length} problem${list.length === 1 ? '' : 's'}`); const groups = {}; for (const p of list) { const g = p.match(/\[(.*?)\]/); groups[g ? g[1] : 'other'] = (groups[g ? g[1] : 'other'] || 0) + 1; } if (list.length) console.log('    ' + Object.entries(groups).map(([k, v]) => `${k} ${v}`).join(' · ')); for (const p of ARGS.has('--list') ? list : list.slice(0, 40)) console.log(`    ✗ ${p}`); if (!ARGS.has('--list') && list.length > 40) console.log(`    … and ${list.length - 40} more (run with --list)`); };
show('Today', today); show('Growth (a project added to every town, twice; then a sixth town)', growth);
if (selfTest.length) { console.log(`\n  Self-test: ${selfTest.length} faults put in on purpose`); for (const [what, group, n] of selfTest) console.log(`    ${n ? '✓ caught' : '✗ MISSED'}  ${what}  (${n} "${group}" problem${n === 1 ? '' : 's'})`); }
const missed = selfTest.filter((s) => !s[2]).length;
const total = today.length + growth.length + missed;
console.log(total === 0 ? '\n0 problems\n' : `\nFAILED: ${total} problems\n`);

/* ---------- pictures ---------- */
if (ARGS.has('--shots')) {
  const { chromium } = createRequire(import.meta.url)('playwright'); const outDir = path.join(HERE, '../../docs/designs/city-style'); const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1760, height: 1320 } });
  const shot = async (query, file) => { await page.goto(`http://localhost:8765/designs/city/plan-map.html?shot&${query}`, { waitUntil: 'load' }); await page.waitForFunction(() => document.documentElement.dataset.ready === '1', null, { timeout: 60000 }); await page.locator('#map').screenshot({ path: path.join(outDir, file) }); console.log(`  saved docs/designs/city-style/${file}`); };
  await shot('', 'island-town-plan.png'); for (const t of plan.towns) await shot(`town=${t.id}`, `island-town-${t.id}.png`); await shot('six', 'island-town-plan-six.png'); await b.close();
}
process.exit(total === 0 ? 0 : 1);
