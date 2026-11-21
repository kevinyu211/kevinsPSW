/* Island city · the layout
   The one place the island's shape and the position of everything on it come from: the town plan
   (plan.js, owned by the town planner), built once from the data file and the model manifest. Every other
   file asks here: the 3D island, the lines (track.js), the flat map, the tests.
   buildPlan reads sizes and doors from models/manifest.json, so the manifest is fetched first (this module
   waits for it; a missing manifest still gives a plan, with problems listed in LAYOUT.problems). */
import * as cityData from './city-data.js';
import { buildPlan, PLAN } from './plan.js';

let manifest = {};
try { const r = await fetch(new URL('./models/manifest.json', import.meta.url), { cache: 'no-cache' }); if (r.ok) manifest = await r.json(); } catch (e) { manifest = {}; }
const KY = globalThis.KY || {};
/** The manifest the plan was built from (models.js loads the models it lists). */
export const MANIFEST = manifest;
/** The whole plan: see the comment above buildPlan in plan.js for every field. */
export const LAYOUT = buildPlan(cityData, manifest, { projects: KY.projects || [] });
if (LAYOUT.problems && LAYOUT.problems.length) console.warn(`The town plan has ${LAYOUT.problems.length} problems; the island is drawn as planned anyway.`, LAYOUT.problems.slice(0, 5));
export { PLAN };
export { height, coast, quay, shoreDistance, softShoreDistance, hillHeight, hillAmount, pointInPoly, distToLine, toWorld } from './plan.js';

/* Small helpers on the plan, shared by the island and the map. */
const byModelKind = (kind) => LAYOUT.placements.filter((p) => p.kind === kind);
export const placementsOf = byModelKind;
/** The tower's placement. */
export const TOWER_AT = byModelKind('tower')[0] || { x: 0, z: 0, rot: 0 };
/** The flat land's height above the sea, and the lanes' height above the sea. */
export const PLATEAU = LAYOUT.plateau; export const LANE_Y = LAYOUT.metro.y;
/** The island's half sizes (for the camera and the map). */
export const HALF = (() => { let x0 = Infinity; let x1 = -Infinity; let z0 = Infinity; let z1 = -Infinity; for (const [x, z] of LAYOUT.island.coast) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return { x: (x1 - x0) / 2, z: (z1 - z0) / 2, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 }; })();
