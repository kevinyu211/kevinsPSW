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
    park: [-120, 120, -314, -152], // Central Park
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

/* The lines. `pts` are the corners of each line; corners are rounded with radius `r`. `y` is rail height.
   There are two rail levels only. The lower deck is the Circle, at 9 m. The upper deck, at 24.6 m (one station
   module higher), carries the five category lines: Line 1 runs across town over the boulevard, Lines 2–5 are
   spokes that end inside the Kevin Square hub. Every crossing of the Circle is a right angle, so every
   interchange is one two-deck station. `label` is the category the line carries. */
export const LINES = [
  { id: 'c', no: 'C', name: 'Circle', label: 'About Kevin', cat: null, hex: 0x4b5560, css: '#4B5560', y: 9, kind: 'viaduct', closed: true, r: 110, pts: [[-520, -330], [520, -330], [520, 330], [-520, 330]] },
  { id: '1', no: '1', name: 'Line 1', label: 'Software', cat: 'software', hex: 0xda291c, css: '#DA291C', y: 24.6, kind: 'viaduct', r: 50, pts: [[-765, 0], [650, 0], [650, 168]] },
  { id: '2', no: '2', name: 'Line 2', label: 'Books & apps', cat: 'books', hex: 0xf2b705, css: '#F2B705', y: 24.6, kind: 'viaduct', r: 70, pts: [[16, -16], [260, -260], [260, -528]] },
  { id: '3', no: '3', name: 'Line 3', label: 'Film & media', cat: 'film', hex: 0x0039a6, css: '#0039A6', y: 24.6, kind: 'viaduct', r: 60, pts: [[0, 22], [0, 538]] },
  { id: '4', no: '4', name: 'Line 4', label: 'Games', cat: 'games', hex: 0x8e3b9c, css: '#8E3B9C', y: 24.6, kind: 'viaduct', r: 60, pts: [[-16, 16], [-130, 130], [-130, 538]] },
  { id: '5', no: '5', name: 'Line 5', label: 'Healthcare AI', cat: 'health', hex: 0x00933c, css: '#00933C', y: 24.6, kind: 'viaduct', r: 70, pts: [[-16, -16], [-260, -260], [-260, -528]] },
];

/* Stations. One station is one building at one place: `at` is its position and `lines` the lines that stop
   there, all in the same complex. Each line's platform is the point of that line nearest to `at` (a spoke
   that ends at the hub stops with its platform inside the hub hall). `side` is where the name sits in 2D. */
const S = {
  kevin: { name: 'Kevin Square', zh: '凯文广场', at: [0, 0], lines: ['1', '2', '3', '4', '5'], side: 'below-right' },
  medical: { name: 'Medical Centre', zh: '医疗中心', at: [-260, -330], lines: ['c', '5'], side: 'below-left' },
  university: { name: 'University', zh: '大学', at: [0, -330], lines: ['c'], side: 'below' },
  oldtown: { name: 'Old Town', zh: '老城', at: [260, -330], lines: ['c', '2'], side: 'below-right' },
  dailyai: { name: 'Daily AI', zh: '每日 AI', at: [520, -165], lines: ['c'], side: 'left' },
  eastgate: { name: 'East Gate', zh: '东门', at: [520, 0], lines: ['c', '1'], side: 'above-right' },
  nonstop: { name: 'Non-stop', zh: '不停站', at: [260, 330], lines: ['c'], side: 'below' },
  cinema: { name: 'Cinema Row', zh: '影院街', at: [0, 330], lines: ['c', '3'], side: 'above-right' },
  arcade: { name: 'Arcade Street', zh: '游戏街', at: [-130, 330], lines: ['c', '4'], side: 'above-left' },
  westgate: { name: 'West Gate', zh: '西门', at: [-520, 0], lines: ['c', '1'], side: 'above-right' },
  sports: { name: 'Sports Park', zh: '体育公园', at: [-712, 0], lines: ['1'], side: 'above' },
  harbour: { name: 'Harbour', zh: '港口', at: [650, 112], lines: ['1'], side: 'right' },
  studio: { name: 'Studio Park', zh: '画室公园', at: [260, -470], lines: ['2'], side: 'right' },
  jazz: { name: 'Jazz Alley', zh: '爵士巷', at: [0, 482], lines: ['3'], side: 'right' },
  party: { name: 'Party House', zh: '派对屋', at: [-130, 482], lines: ['4'], side: 'left' },
  hackhall: { name: 'Hackathon Hall', zh: '黑客松馆', at: [-260, -470], lines: ['5'], side: 'left' },
};

/* Places: one entry per building. Fields:
   id        unique; also the #/station deep link target
   projects  ids from ../shared/content.js shown here (the first one leads), or
   panel     'intro' | 'timetable' | 'news' | 'terminus' for the non-project buildings
   category  the project category (decides the line colour of labels); null for panels
   line      the line this place belongs to
   station   a station id from the table above, or a new { id, name, zh, at: [x, z], lines, side } object
   label     the building's name;  short  the map label;  note  one line for non-project places
   model     node name in models/landmarks.glb;  annex  { model, screens } a second building on the same block
   screens   photo keys for the model's screen quads, in the manifest's order (SLOTS in landmarks.js)
   plot      { x, z } the block the building stands on, `face`, the direction its front looks (towards its station),
             and optionally `rect` [x0, x1, z0, z1] for a plot that spans more than one block
   tint      the colour of the model's canopy, if it has one */
export const PLACES = [
  { id: 'kevin', panel: 'intro', category: null, line: '1', station: 'kevin', label: 'Kevin Square', short: 'Kevin Yu', note: 'Who I am', model: 'k_tower', screens: ['kname', 'ksay'], plot: { x: 0, z: -91, face: [0, 1], rect: [-58, 58, -150, -32] }, tint: 0x0039a6 },
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

/* Derived: every station once, with its position and the lines it serves. */
export function stationsOf(places = PLACES) {
  const out = new Map();
  places.forEach((p) => {
    const def = typeof p.station === 'string' ? { id: p.station, ...S[p.station] } : p.station;
    if (!def || !Array.isArray(def.at) || !def.lines) throw new Error(`city-data: place "${p.id}" needs a station with "at": [x, z] and "lines"`);
    if (!out.has(def.id)) out.set(def.id, { id: def.id, name: def.name, zh: def.zh || '', side: def.side || 'right', pos: def.at, lines: [...def.lines] });
  });
  return [...out.values()];
}
export const stationIdOf = (p) => (typeof p.station === 'string' ? p.station : p.station.id);
