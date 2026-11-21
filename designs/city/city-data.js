/* Kevin Yu · the island city. ONE data file drives the whole city.
   Each kind of work is a TOWN with one metro station. A project is a building in its town.
   - Add a project  = add one row to PROJECTS (and its text to ../shared/content.js). The town plan gives it
     its town's next reserved plot.
   - Add a kind of work = add a row to DISTRICTS and to TOWNS. That adds a town and a station on the loop.
   The island, the metro, the stations, the towns and the line strip all rebuild from this file.

   World axes (three.js): X = east, Y = up, Z = south (towards the default camera). Metres.

   Rules: never invent a number. Every figure in NUMBERS has a date and a source. */

/* The island's shape, its ground, the metro lanes, the pod line and where every building, house and tree stands
   are the town plan's (plan.js, read through layout.js): this file no longer holds any geometry. */

/* The metro's service: three cars a train, two trains each way round the loop. */
export const LOOP = { cars: 3, trainsEachWay: 2 };

/* The default camera. `distance` is the closest it starts; a narrow screen steps back until the island fits. */
export const VIEW = { target: [0, 70, 0], elevation: 30, azimuth: 8, distance: 990, lens: 23 };

export const DISTRICTS = [
  { id: 'software', label: 'Software', color: '#D5281E' },
  { id: 'books', label: 'Books & apps', color: '#E0A800' },
  { id: 'film', label: 'Film & media', color: '#1F4FD8' },
  { id: 'games', label: 'Games', color: '#E8731A' },
  { id: 'health', label: 'Healthcare AI', color: '#00843D' },
];

/* The towns, in station order clockwise from the main station. Where each station stands is the plan's. */
export const TOWNS = [
  { id: 'harbour', code: 'K1', name: 'Harbour town', district: 'software', main: true, what: 'The port, the ferry and the hill tram.' },
  { id: 'garden', code: 'K2', name: 'Garden village', district: 'books', what: 'Quiet, among the trees.' },
  { id: 'north', code: 'K3', name: 'North shore', district: 'film', what: 'The side that lights up at night.' },
  { id: 'point', code: 'K4', name: 'Lighthouse point', district: 'health', what: 'Calm, on the headland.' },
  { id: 'beach', code: 'K5', name: 'Beach town', district: 'games', what: 'By the sand and the umbrellas.' },
];
/* The hill tram: its own short line from the main station up to the tower. */
export const TRAM = { stops: [{ code: 'T1', name: 'Harbour' }, { code: 'T2', name: 'Tower' }] };

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

/* The projects. Each is one building in its town.
   project  = id in ../shared/content.js (window.KY.projects)
   building = what the building is; model = node name prefix in models/buildings.glb
   short    = optional shorter name for the line strip (the page always uses the project's own title) */
export const PROJECTS = [
  { id: 'hirvo', project: 'hirvo', town: 'harbour', building: 'Careers office', model: 'b_hirvo' },
  { id: 'trade', project: 'trade', short: 'Export tool', town: 'harbour', building: 'Harbour warehouse', model: 'b_trade' },
  { id: 'court', project: 'court', short: 'Court booking', town: 'harbour', building: 'Sports hall', model: 'b_court' },
  { id: 'uhome', project: 'uhome', town: 'harbour', building: 'Apartment show home', model: 'b_uhome' },
  { id: 'pindou', project: 'pindou', short: 'Bead store', town: 'harbour', building: 'Craft shop', model: 'b_pindou' },
  { id: 'books', project: 'books', short: 'Snuggle Crew', town: 'garden', building: 'Bookshop', model: 'b_books' },
  { id: 'bookflow', project: 'bookflow', town: 'garden', building: 'Print works', model: 'b_bookflow' },
  { id: 'ipad', project: 'ipad', short: 'Coloring app', town: 'garden', building: 'Art studio', model: 'b_ipad' },
  { id: 'yae', project: 'yae', town: 'north', building: 'Natural history museum', model: 'b_yae' },
  { id: 'noir', project: 'noir', town: 'north', building: 'Late-night jazz bar', model: 'b_noir' },
  { id: 'influencers', project: 'influencers', town: 'north', building: 'Photo studio', model: 'b_influencers' },
  { id: 'duiyao', project: 'duiyao', short: '對藥', town: 'point', building: 'Pharmacy', model: 'b_duiyao' },
  { id: 'hackathons', project: 'hackathons', town: 'point', building: 'Event hall', model: 'b_hackathons' },
  { id: 'stickers', project: 'stickers', town: 'beach', building: 'Toy shop', model: 'b_stickers' },
  { id: 'party', project: 'party', town: 'beach', building: 'Party house', model: 'b_party' },
];

/* Island life. Counts are for the whole island. */
export const LIFE = {
  cars: 34, houses: 46, trees: 400,   // wishes: the plan places as many as fit (today 19 houses and 375 trees)
  boats: { sail: 5, fishing: 3, ferry: 1 },
  beach: { umbrellas: 14 },
  animals: { gulls: 14, dolphins: 3, sheep: 9, deer: 4, dogs: 3 },
};

/** The level (1 to 5) a project's building shows, from its status and its real numbers. */
export function levelOf(row, project) {
  const base = STATUS_LEVEL[project && project.status] || 1;
  if (base < 4) return base;
  const n = NUMBERS[row.id] || {};
  const thriving = Object.keys(THRIVING).some((k) => typeof n[k] === 'number' && n[k] >= THRIVING[k]);
  return thriving ? 5 : 4;
}
