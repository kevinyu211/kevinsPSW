/* Kevin Yu · the island city. ONE data file drives the whole city.
   Add a project = add one row to STOPS (and its text to ../shared/content.js). The island, the metro
   loop, the stations and the line strip all rebuild from this file.

   World axes (three.js): X = east, Y = up, Z = south (towards the default camera). Metres.
   The Blender rough model (tools/city3d/island_blockout.py) uses the same numbers with north = -Z.

   Rules: never invent a number. Every figure in NUMBERS has a date and a source. */

export const ISLAND = {
  rx: 380, rz: 235,                       // half-sizes of the island
  plateau: 3.2,                           // height of the flat land above the sea
  hill: { h: 42, sx: 120, sz: 62, z: -6 }, // the green hill in the middle; the tower stands on top
};

export const LOOP = {
  rx: 300, rz: 170,   // half-sizes of the metro loop
  deck: 13.2,         // height of the track above the sea: 10 m above the flat land, as the station models expect
  gapSlots: 2.5,      // empty slots kept before the main station, for "what comes next"
  mainAngle: 90,      // the main station sits at the front (south)
};

export const TOWER = { x: 0, z: -6, height: 200 };

/* The default camera: the rough model's angle. `distance` is for a wide screen; a narrow screen steps
   back until the island fits. `lens` is the vertical field of view in degrees. */
export const VIEW = { target: [0, 40, 0], elevation: 30, azimuth: 8, distance: 1230, lens: 23 };
export const ROADS = { coastOffset: -21, coastWidth: 9, streetWidth: 6 }; // negative = sea side of the loop

export const DISTRICTS = [
  { id: 'software', label: 'Software', color: '#D5281E' },
  { id: 'books', label: 'Books & apps', color: '#E0A800' },
  { id: 'film', label: 'Film & media', color: '#1F4FD8' },
  { id: 'games', label: 'Games', color: '#E8731A' },
  { id: 'health', label: 'Healthcare AI', color: '#00843D' },
];

/* Five building levels. A project's stage sets 1 to 4; one real public number lifts it to 5. */
export const LEVELS = [
  null,
  { n: 1, name: 'Lot', what: 'A fenced empty plot with a sign.' },
  { n: 2, name: 'Site', what: 'Scaffolding and a crane.' },
  { n: 3, name: 'Open', what: 'A small finished building.' },
  { n: 4, name: 'Live', what: 'The full building, lit and busy.' },
  { n: 5, name: 'Thriving', what: 'Bigger, with extras. Earned by a real number.' },
];
export const STATUS_LEVEL = { parked: 1, building: 2, testing: 3, done: 3, live: 4 };
/* A live project reaches level 5 when any ONE of these is met. Kevin can change the bars. */
export const THRIVING = { subscribers: 1000, views: 100000, users: 1000, sales: 1000 };

/* Real public numbers. asOf = the day it was read. */
export const NUMBERS = {
  yae: { subscribers: 23, videos: 24, views: 7615, asOf: '2026-11-21', source: 'YouTube channel page' },
  noir: { subscribers: 6, videos: 5, views: 770, asOf: '2026-11-21', source: 'YouTube channel page' },
};

/* Stops in order round the loop, clockwise from the main station.
   project  = id in ../shared/content.js (window.KY.projects)
   building = what the building is; model = node name prefix in models/buildings.glb
   side     = 'in' (hill side of the track) or 'sea' (on the coast)
   short    = optional shorter name for the line strip (the page always uses the project's own title) */
export const STOPS = [
  { id: 'hirvo', project: 'hirvo', district: 'software', building: 'Careers office', model: 'b_hirvo', side: 'in' },
  { id: 'trade', project: 'trade', short: 'Export tool', district: 'software', building: 'Harbour warehouse', model: 'b_trade', side: 'sea' },
  { id: 'court', project: 'court', short: 'Court booking', district: 'software', building: 'Sports hall', model: 'b_court', side: 'in' },
  { id: 'uhome', project: 'uhome', district: 'software', building: 'Apartment show home', model: 'b_uhome', side: 'in' },
  { id: 'pindou', project: 'pindou', short: 'Bead store', district: 'software', building: 'Craft shop', model: 'b_pindou', side: 'in' },
  { id: 'books', project: 'books', short: 'Snuggle Crew', district: 'books', building: 'Bookshop', model: 'b_books', side: 'in' },
  { id: 'bookflow', project: 'bookflow', district: 'books', building: 'Print works', model: 'b_bookflow', side: 'in' },
  { id: 'ipad', project: 'ipad', short: 'Coloring app', district: 'books', building: 'Art studio', model: 'b_ipad', side: 'in' },
  { id: 'yae', project: 'yae', district: 'film', building: 'Natural history museum', model: 'b_yae', side: 'in' },
  { id: 'noir', project: 'noir', district: 'film', building: 'Late-night jazz bar', model: 'b_noir', side: 'in' },
  { id: 'influencers', project: 'influencers', district: 'film', building: 'Photo studio', model: 'b_influencers', side: 'in' },
  { id: 'stickers', project: 'stickers', district: 'games', building: 'Toy shop', model: 'b_stickers', side: 'in' },
  { id: 'party', project: 'party', district: 'games', building: 'Party house', model: 'b_party', side: 'in' },
  { id: 'duiyao', project: 'duiyao', short: '對藥', district: 'health', building: 'Pharmacy', model: 'b_duiyao', side: 'in' },
  { id: 'hackathons', project: 'hackathons', district: 'health', building: 'Event hall', model: 'b_hackathons', side: 'in' },
];

/* How far a building's centre sits from the track, and how many empty plots wait in the gap. */
export const PLACING = { inOffset: 58, seaOffset: 34, nextPlots: 2 };

/* Island life. Counts are for the whole island. */
export const LIFE = {
  cars: 44, houses: 40, trees: 430,
  boats: { sail: 5, fishing: 3, ferry: 1 },
  lighthouse: { angle: 20, edge: 0.97 },           // on the east point
  beach: { fromAngle: 40, toAngle: 78, umbrellas: 14 }, // the sandy stretch at the front right
  animals: { gulls: 14, dolphins: 3, sheep: 9, deer: 4, dogs: 3 },
};

/* ---------- geometry helpers (shared by the scene, the roads and the tests) ---------- */
const rad = (a) => (a * Math.PI) / 180;

/** The coast is an ellipse with a gentle wobble. `th` is the angle in the squashed plane. */
export function coastK(th) {
  return 1 + 0.035 * Math.sin(3 * th + 1.0) + 0.025 * Math.sin(5 * th + 2.0) + 0.015 * Math.sin(9 * th + 0.5);
}

/** 0 at the centre of the island, 1 at the shoreline, more than 1 out at sea. */
export function edge(x, z) {
  const n = -z;
  return Math.hypot(x / ISLAND.rx, n / ISLAND.rz) / coastK(Math.atan2(n / ISLAND.rz, x / ISLAND.rx));
}

const smooth = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };

export function hillHeight(x, z) {
  const h = ISLAND.hill;
  return h.h * Math.exp(-((x / h.sx) ** 2 + ((z - h.z) / h.sz) ** 2));
}

/** Ground height in metres. Below 0 is under the sea. */
export function height(x, z) {
  const e = edge(x, z);
  if (e < 1) return ISLAND.plateau * smooth(1.0, 0.9, e) + hillHeight(x, z);
  return -Math.min(8, (e - 1) * 55);
}

/** A point on the metro loop. Angle in degrees: 90 = the front (south), then clockwise seen from above. */
export function loopPoint(a) {
  return { x: LOOP.rx * Math.cos(rad(a)), z: LOOP.rz * Math.sin(rad(a)) };
}

/** Unit direction of travel at angle a (the train runs with rising angle). */
export function loopTangent(a) {
  const dx = -LOOP.rx * Math.sin(rad(a)), dz = LOOP.rz * Math.cos(rad(a));
  const l = Math.hypot(dx, dz);
  return { x: dx / l, z: dz / l };
}

/** A point `off` metres from the loop: positive = towards the hill, negative = towards the sea. */
export function loopOffset(a, off) {
  const p = loopPoint(a), t = loopTangent(a);
  let n = { x: -t.z, z: t.x };
  if (n.x * -p.x + n.z * -p.z < 0) n = { x: t.z, z: -t.x };
  return { x: p.x + n.x * off, z: p.z + n.z * off };
}

export const SLOT = 360 / (STOPS.length + LOOP.gapSlots);
/** Loop angle of stop i (0-based). The main station is at LOOP.mainAngle. */
export const stopAngle = (i) => LOOP.mainAngle + SLOT * (i + 1);

/** The level (1 to 5) a project's building shows, from its status and its real numbers. */
export function levelOf(stop, project) {
  const base = STATUS_LEVEL[project && project.status] || 1;
  if (base < 4) return base;
  const n = NUMBERS[stop.id] || {};
  const thriving = Object.keys(THRIVING).some((k) => typeof n[k] === 'number' && n[k] >= THRIVING[k]);
  return thriving ? 5 : 4;
}
