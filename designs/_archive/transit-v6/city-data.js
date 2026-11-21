/* Kevin Metro · the city registry
   One file decides what is in the city. Every entry in PLACES adds a building on a plot and (if it is new)
   a station on a line; the 3D scene, the ticket machine, the line strip, the labels, routing, the flat map
   and the article links all read from here. To add a project, add one entry (see README.md).
   One unit is one metre; x runs east, z runs south. */

/* The world. The camera can never show anything outside `safe`; `city` is what the widest view frames.
   East of the coast is sea; the river runs east along z 170–230 into it. */
export const WORLD = {
  city: { x0: -800, x1: 900, z0: -560, z1: 560 },
  safe: { x0: -2300, x1: 2900, z0: -2300, z1: 2300 },
  river: { z0: 170, z1: 230, water: -2.4 },
  // the coastline, as [z, x] pairs from north to south (the sea is east of it)
  coast: [[-2600, 930], [-560, 880], [-250, 850], [100, 826], [170, 826], [230, 800], [420, 770], [560, 745], [2600, 560]],
  // districts, for the plan and for the model kit: [x0, x1, z0, z1]
  districts: {
    downtown: [-390, 390, -220, 160], // towers round Kevin Square
    midtown: [-520, 520, -330, 330], // the mid-rise ring inside the Circle (minus downtown and the park)
    park: [-120, 120, -314, -118], // Central Park
    campus: [-250, 120, -560, -346], // the university, north of the Circle
    port: [660, 830, -560, 164], // the industrial port on the sea, north of the river mouth
    bund: [660, 800, 236, 560], // the waterfront promenade and beach, south of the river mouth
    lowrise: [-800, 660, -560, 560], // everything else inside the city
    suburbs: [-2300, 930, -2300, 2300], // houses to about 300 m out, then forest and hills, on the three land sides
  },
};
export function coastX(z) {
  const c = WORLD.coast; if (z <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) if (z <= c[i][0]) { const t = (z - c[i - 1][0]) / (c[i][0] - c[i - 1][0]); return c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t; }
  return c[c.length - 1][1];
}

/* The model library (models/manifest.json + GLB files): every building, prop and station comes from it.
   `?models=<folder>/` tries another library; `?models=off` shows the flat map. */
export const MODELS = { enabled: true, base: './models/' };

/* The lines. `pts` are the corners of each line; corners are rounded with radius `r`.
   `y` is rail height: the Circle runs at 9 m, Line 1 at street level, Lines 2–5 at 24.6 m (one station module above the Circle). */
export const LINES = [
  { id: 'c', no: 'C', name: 'Circle Line', label: 'Circle', cat: null, hex: 0x4b5560, css: '#4B5560', y: 9, kind: 'viaduct', closed: true, r: 110, pts: [[-520, -330], [520, -330], [520, 330], [-520, 330]] },
  { id: '1', no: '1', name: 'Line 1', label: 'Software', cat: 'software', hex: 0xda291c, css: '#DA291C', y: 0.42, kind: 'grade', r: 50, pts: [[-765, 0], [650, 0], [650, 168]] },
  { id: '2', no: '2', name: 'Line 2', label: 'Books & apps', cat: 'books', hex: 0xf2b705, css: '#F2B705', y: 24.6, kind: 'viaduct', r: 70, pts: [[30, -30], [260, -260], [260, -528]] },
  { id: '3', no: '3', name: 'Line 3', label: 'Film & media', cat: 'film', hex: 0x0039a6, css: '#0039A6', y: 24.6, kind: 'viaduct', r: 60, pts: [[0, 26], [0, 538]] },
  { id: '4', no: '4', name: 'Line 4', label: 'Games', cat: 'games', hex: 0x8e3b9c, css: '#8E3B9C', y: 24.6, kind: 'viaduct', r: 60, pts: [[-30, 30], [-130, 130], [-130, 538]] },
  { id: '5', no: '5', name: 'Line 5', label: 'Healthcare AI', cat: 'health', hex: 0x00933c, css: '#00933C', y: 24.6, kind: 'viaduct', r: 70, pts: [[-30, -30], [-260, -260], [-260, -528]] },
];

/* Stations. A place names its station by id; `at` gives the station's position on each line it serves
   (it snaps to the nearest point of that line). `side` is where its name sits on the map. */
const S = {
  kevin: { name: 'Kevin Square', zh: '凯文广场', at: { 1: [0, 0], 2: [65, -65], 3: [0, 72], 4: [-64, 64], 5: [-65, -65] }, side: 'above-right' },
  medical: { name: 'Medical Centre', zh: '医疗中心', at: { c: [-260, -330], 5: [-260, -330] }, side: 'above-left' },
  university: { name: 'University', zh: '大学', at: { c: [0, -330] }, side: 'above' },
  oldtown: { name: 'Old Town', zh: '老城', at: { c: [260, -330], 2: [260, -330] }, side: 'above-right' },
  dailyai: { name: 'Daily AI', zh: '每日 AI', at: { c: [520, -165] }, side: 'left' },
  eastgate: { name: 'East Gate', zh: '东门', at: { c: [520, 0], 1: [455, 0] }, side: 'above-right' },
  nonstop: { name: 'Non-stop', zh: '不停站', at: { c: [260, 330] }, side: 'below' },
  cinema: { name: 'Cinema Row', zh: '影院街', at: { c: [0, 330], 3: [0, 330] }, side: 'below-right' },
  arcade: { name: 'Arcade Street', zh: '游戏街', at: { c: [-130, 330], 4: [-130, 330] }, side: 'below-left' },
  westgate: { name: 'West Gate', zh: '西门', at: { c: [-520, 0], 1: [-455, 0] }, side: 'above-right' },
  sports: { name: 'Sports Park', zh: '体育公园', at: { 1: [-712, 0] }, side: 'above' },
  harbour: { name: 'Harbour', zh: '港口', at: { 1: [650, 112] }, side: 'right' },
  studio: { name: 'Studio Park', zh: '画室公园', at: { 2: [260, -470] }, side: 'right' },
  jazz: { name: 'Jazz Alley', zh: '爵士巷', at: { 3: [0, 482] }, side: 'right' },
  party: { name: 'Party House', zh: '派对屋', at: { 4: [-130, 482] }, side: 'left' },
  hackhall: { name: 'Hackathon Hall', zh: '黑客松馆', at: { 5: [-260, -470] }, side: 'left' },
};

/* Places: one entry per building. Fields:
   id        unique; also the #/station deep link target
   projects  ids from ../shared/content.js shown here (the first one leads), or
   panel     'intro' | 'timetable' | 'news' | 'terminus' for the non-project buildings
   category  the project category (decides the line colour of labels); null for panels
   line      the line this place belongs to
   station   a station id from the table above, or a new { id, name, zh, at, side } object
   label     the building's name;  short  the map label;  note  one line for non-project places
   model     node name in models/landmarks.glb;  annex  { model, screens } a second building on the same block
   screens   photo keys for the model's screen quads, in the manifest's order (SLOTS in landmarks.js)
   plot      { x, z } the block the building stands on, `face`, the direction its front looks (towards its station),
             and optionally `rect` [x0, x1, z0, z1] for a plot that spans more than one block
   tint      the colour of the model's canopy, if it has one */
export const PLACES = [
  { id: 'kevin', panel: 'intro', category: null, line: '1', station: 'kevin', label: 'Kevin Square', short: 'Kevin Yu', note: 'Who I am', model: 'k_tower', screens: ['kname', 'ksay'], plot: { x: 65, z: 56, face: [0, -1], rect: [10, 120, 20, 164] }, tint: 0x0039a6 },
  { id: 'hirvo', projects: ['hirvo'], category: 'software', line: '1', station: 'eastgate', label: 'Hirvo HQ', short: 'Hirvo', model: 'hq_hirvo', screens: ['hirvo-cycle'], plot: { x: 588, z: -61, face: [-1, 0] }, tint: 0xda291c },
  { id: 'port', projects: ['trade'], category: 'software', line: '1', station: 'harbour', label: 'Export Terminal', short: 'Export tool', model: 'hq_trade', screens: ['risk'], plot: { x: 721, z: 136, face: [-1, 0] }, tint: 0xda291c },
  { id: 'courts', projects: ['court'], category: 'software', line: '1', station: 'sports', label: 'Sports Hall', short: 'Court booking', model: 'hq_court', screens: ['court'], plot: { x: -730, z: 56, face: [0, -1] }, tint: 0xda291c },
  { id: 'uhome', projects: ['uhome'], category: 'software', line: '1', station: 'westgate', label: 'UHOME Apartments', short: 'UHOME', model: 'hq_uhome', screens: ['uhome'], plot: { x: -588, z: 56, face: [1, 0] }, tint: 0xda291c },
  { id: 'snuggle', projects: ['books'], category: 'books', line: '2', station: 'oldtown', label: 'Snuggle Crew Books', short: 'Books', model: 'hq_books', screens: ['star'], plot: { x: 325, z: -389, face: [0, 1] }, tint: 0xf2b705 },
  { id: 'studio', projects: ['ipad'], category: 'books', line: '2', station: 'studio', label: 'Kids’ Coloring Studio', short: 'iPad app', model: 'hq_ipad', screens: ['ipad'], plot: { x: 325, z: -504, face: [-1, 0] }, tint: 0xf2b705 },
  { id: 'cinema', projects: ['yae'], category: 'film', line: '3', station: 'cinema', label: 'The Picture House', short: 'YouAreExtinct', model: 'hq_yae', screens: ['yae'], plot: { x: -65, z: 389, face: [0, -1] }, tint: 0x0039a6 },
  { id: 'creators', projects: ['influencers'], category: 'film', line: '3', station: 'cinema', label: 'Creator Studio', short: 'AI influencers', model: 'hq_influencers', screens: ['ariana'], plot: { x: 65, z: 389, face: [0, -1] }, tint: 0x0039a6 },
  { id: 'jazz', projects: ['noir'], category: 'film', line: '3', station: 'jazz', label: 'Noir Hours Jazz Club', short: 'Noir Hours', model: 'hq_noir', screens: ['noir-video'], plot: { x: 65, z: 504, face: [-1, 0] }, tint: 0x0039a6 },
  { id: 'arcade', projects: ['stickers', 'pindou'], category: 'games', line: '4', station: 'arcade', label: 'The Arcade', short: 'Sticker Scenes', model: 'hq_stickers', screens: ['stickerScene'], annex: { model: 'hq_pindou', screens: ['beads'] }, plot: { x: -195, z: 389, face: [0, -1] }, tint: 0x8e3b9c },
  { id: 'party', projects: ['party'], category: 'games', line: '4', station: 'party', label: 'The Party House', short: 'One Too Far', model: 'hq_party', screens: ['party'], plot: { x: -195, z: 504, face: [1, 0] }, tint: 0x8e3b9c },
  { id: 'clinic', projects: ['duiyao'], category: 'health', line: '5', station: 'medical', label: 'Medical Centre', short: '對藥', model: 'hq_duiyao', screens: ['rx'], plot: { x: -325, z: -389, face: [0, 1] }, tint: 0x00933c },
  { id: 'hackhall', projects: ['hackathons'], category: 'health', line: '5', station: 'hackhall', label: 'Hackathon Hall', short: 'Hackathons', model: 'hq_hackathons', screens: ['hack'], plot: { x: -325, z: -504, face: [1, 0] }, tint: 0x00933c },
  { id: 'campus', panel: 'timetable', category: null, line: 'c', station: 'university', label: 'University', short: 'Résumé', note: 'Résumé and education', model: 'hq_resume', screens: ['resume'], plot: { x: -65, z: -389, face: [0, 1] }, tint: 0x9b5b47 },
  { id: 'dailyai', panel: 'news', category: null, line: 'c', station: 'dailyai', label: 'Daily AI Building', short: 'Newsletter', note: 'Service updates', model: 'hq_news', screens: ['news'], plot: { x: 588, z: -165, face: [-1, 0] }, tint: 0x16171a },
  { id: 'nonstop', panel: 'terminus', category: null, line: 'c', station: 'nonstop', label: 'Non-stop Observatory', short: 'Contact', note: 'Still searching. Get in touch', model: 'hq_nonstop', screens: ['nonstop'], plot: { x: 325, z: 389, face: [0, -1] }, tint: 0xf2b705 },
];

/* Empty plots, waiting for the next projects. To build one: move it into PLACES, give it a station and a project. */
export const PLOTS = [
  { id: 'next-1', plot: { x: -588, z: -165, face: [1, 0] }, model: 'plot_empty', near: 'Circle Line, west side' },
  { id: 'next-2', plot: { x: 195, z: -389, face: [0, 1] }, model: 'plot_empty', near: 'Circle Line, north side' },
  { id: 'next-3', plot: { x: -325, z: 389, face: [0, -1] }, model: 'plot_empty', near: 'Circle Line, south side' },
  { id: 'next-4', plot: { x: 325, z: 56, face: [0, -1] }, model: 'plot_empty', near: 'Line 1, east of Kevin Square' },
];

/* Derived: every station once, with the lines it serves. */
export function stationsOf(places = PLACES) {
  const out = new Map();
  places.forEach((p) => {
    const def = typeof p.station === 'string' ? { id: p.station, ...S[p.station] } : p.station;
    if (!def || !def.at) throw new Error(`city-data: place "${p.id}" needs a station with an "at" position`);
    const cur = out.get(def.id) || { id: def.id, name: def.name, zh: def.zh || '', side: def.side || 'right', at: {} };
    Object.assign(cur.at, def.at); out.set(def.id, cur);
  });
  return [...out.values()];
}
export const stationIdOf = (p) => (typeof p.station === 'string' ? p.station : p.station.id);
