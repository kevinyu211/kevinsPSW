# Kevin Metro (Transit design)

"Everyone builds their own city. This is Kevin Yu's." A seaside city with six metro lines, one per kind of
work. Every project is a station and a building. There is one control: the project list. Click a project and
the train takes you there in one continuous camera move, then its story opens. Untouched, the page takes the
visitor on a tour by itself.

No build step. Open `index.html` through any static server.

## Files

| File | What it holds |
|---|---|
| `city-data.js` | **The registry.** The world rectangle, the lines, the stations, every building (place) and the empty plots. Everything else reads from it. |
| `network.js` | Line geometry (rounded polylines), where each line stops at each station, routing with the fewest changes, and how the platforms of one station connect (`cross`, `hub`, `walk`). |
| `graph.js` | **The knowledge graph.** Which places are connected and why (shared tags, neighbours on a line), the Skills groups. No drawing. |
| `sim.js` | **The trains and the trip.** One train per line, always running; the visitor's trip as a list of legs with every step in between. No drawing. |
| `world.js` | The city's layout: coast, sea, river, roads, districts, which kit model stands on which lot, the lines' viaducts, where the station modules go. |
| `landmarks.js` | Where each project building stands, and what its screens show: the photo atlas, the live screens, the sign atlas. |
| `models.js` | Loads `models/manifest.json` and the GLB files; places the kit (instanced, culled to the view), the landmarks, their screens and the station modules. |
| `scene.js` | The 3D engine: camera and its limits, drawing the trains, the passenger pin, the route stroke, the train silhouette, picking. |
| `map2d.js` | The 2D map: the same network, trains and trip as an SVG metro diagram. Also the whole site when there is no WebGL. |
| `app.js` | The interface, as one state machine: loading, opening, tour, the rail (project list), sheets (Skills, About, Contact, tours), station focus, article, pass. |
| `_shots/ride-matrix.js` | Test: every project row from three origins, direct clicks, "Connected to" hops, interruptions, the tour, the rail's filter and keyboard, links and back/forward. Real clicks, 3D and 2D, 1440 and 390. |
| `_shots/clamp-sweep.js` | Test: the camera never leaves the built city (3,456 poses across three screen shapes). |
| `_shots/monkey.js` | Test: 300 random real pointer actions per run; asserts never stuck, always a way on, no console errors, no sideways scroll. |
| `_shots/untouched.js` | The first visit with nothing touched for 90 s: a frame every 5 s, and what the page did by itself. |
| `_shots/gpu-fps.js` | Frame rate on the real GPU. |
| `../shared/content.js` | The facts about each project (shared with the other designs). |

## How to add a project

1. Add the project's facts to `../shared/content.js` (id, title, category, `one`, `body`, `facts`, `cover`,
   and optionally `intro`, `sections`, `stats`), **and its `tags`**: what it is built with and what kind of
   work it is. Reuse existing tags where they are true; that is what connects it.
2. In `city-data.js`, add one entry to `PLACES`. The quickest way is to take over an empty plot:
   cut one entry out of `PLOTS` and reuse its `plot`.

   ```js
   { id: 'newthing', projects: ['newthing'], category: 'software', line: '1',
     station: { id: 'newstation', name: 'New Station', zh: '新站', at: [-520, -165], lines: ['c'], side: 'left' },
     label: 'New Thing HQ', short: 'New Thing',
     model: 'plot_empty', screens: ['plot'],
     plot: { x: -588, z: -165, face: [1, 0] }, tint: 0xda291c },
   ```

   - `station` is either the id of an existing station (the building joins it) or a new station object.
     `at` is the station's one position and `lines` the lines that stop there; each line's platform is the
     point of that line nearest to `at`. A station on the Circle and one other line becomes a two-deck
     interchange (the other line must cross the Circle at a right angle there).
   - `plot.x, plot.z` name the city block the building stands on (any point inside the block);
     `plot.face` is the direction its front looks, normally towards its station.
   - `model` is the node name in `models/landmarks.glb`. Until the project has its own model, keep
     `plot_empty` (a construction site). `screens` names a photo slot for each of the model's screens;
     add a slot in `landmarks.js` (`SLOTS` and `photos()` or `boards()`) for a new image.
3. That is all (the Monopoly rule: one entry, and the city grows). The station appears on its line, on the
   2D map and in routing; the building gets a label, a hover box, a station focus and an
   article. **It connects itself:** `graph.js` joins it to every place that shares one of its tags and to
   its neighbours on the line, so it shows up in the rail under its line, in their "Connected to", in the Skills view
   under each of its tags, and in its line's tour. To put it in the Highlights tour, add it to `TOURS` in `app.js`.

Station codes (`104`, `C05`) are worked out from the order of stations along each line.

## The network: a mesh

A line is a kind of work: Line 1 · Software, Line 2 · Books & apps, Line 3 · Film & media, Line 4 · Games,
Line 5 · Healthcare AI, Circle · About Kevin. The lines cross each other all over the city, and a station
where two lines meet is a project that belongs to both kinds of work.

- **Two rail levels, one rule:** track running east–west is on the upper deck (24.6 m), track running
  north–south on the lower deck (9 m); a line that turns ramps between them on the bend. So every crossing is
  a right angle with one line above the other. Lines run along the grid (no diagonals).
- **One station is one building.** A station on two lines is a two-deck interchange: the platforms cross at
  one corner and an escalator joins them (`net.cross`).
- **Routing** (`net.route`): fewest changes, then fewest stops, over any number of changes.
- **Trains** (`sim.js`): each line has its own train in its colour, shuttling end to end (the Circle loops).
  They never stop.
- **A trip** is shown, never cut: walk to the platform, the train pulls in, doors, ride, doors; at each change
  a banner says "Change here: Line 3 → Line 1" while the passenger pin takes the escalator and the next
  line's train pulls in. A new destination may be asked for at any time: in a station it replaces the plan,
  on a moving train it takes over at the next stop.

## The knowledge graph (`graph.js`)

Two places are connected when their projects share a tag (the reason is the tag: "Both use Supabase",
"Same brand: Snuggle Crew") or when they are neighbours on a line ("Next on Line 1 · Software"). Ranked by
the number of shared tags. Nothing is listed by hand. It feeds:

- the focus panel's **Connected to** list;
- the **Skills** view: tags grouped Build / AI / Media / Work (`TAG_GROUPS`); picking one lights every
  station that has it, joins them with arcs (3D and 2D), dims the rest and lists the projects;
- the thin arcs on the 2D map when a station is hovered or focused.

## How it runs (`app.js`)

One state machine: **loading → opening → tour | explore → riding → focus → article**, with the sheets (Skills,
About, Contact, tour picker) over any of them. Every input is legal in every state.

- **Loading**: the network draws itself in the line colours over a progress line while the models load. If
  they cannot load, the 2D map is the site.
- **The rail** is the one control: every project, grouped by line, with a filter (project, station or skill)
  and the links to Tour, Skills, Résumé and Contact. Desktop: a left column that collapses to a strip. Phone:
  a bottom sheet, one row of chips when closed. It is a list with one tab stop: arrows move, Enter rides.
  A row lights its building in the city and on the map; a building lights its row.
- **The ride** is one camera move with no cuts: in to the train, close behind it and a little ahead, and over
  the last stretch the view turns from the train to the building and settles on its front as the panel
  slides in (`follow` and `focusPose` in `scene.js`). Dragging looks around; two seconds later the view comes
  back to the train. Another click redirects it. The rail shows "Riding to … · Skip" and a progress line.
- **Opening**: a flight in from over the sea, the headline, "Take the tour" / "Explore on my own". Untouched,
  the tour starts by itself after about 6 s (not under reduced motion).
- **Tour**: rides a curated order (`TOURS`: Highlights, Everything, one per line, About Kevin). At each stop
  the camera frames the building and a card shows the title, one line, one stat and its image; after 7 s it
  moves on. Its controls sit at the top of the rail. Dragging the city pauses it; after 25 s idle in explore
  mode the rail offers to resume. Reduced motion: no autoplay, next/previous, cuts with a short cross-fade.
- **Links**: `#/tour/<id>`, `#/station/<station>`, `#/<project>`, `#/skills/<tag>`, `#/about`, `#/contact`,
  `#/work`. Back and forward work.
- **2D** is the same site on a flat map, and what shows when there is no WebGL.
- **Motion**: one easing (`cubic-bezier(0.16, 1, 0.3, 1)`) and four durations (120 / 220 / 360 / 600 ms).
  Panels rise a little as they fade in and leave faster than they came (`enter` and `leave` in `app.js`).

## The world and the camera

- **The camera never leaves the built city.** The view's footprint on the ground must stay inside the city
  grid (`WORLD.city`), extended east over the sea (`REGION`, `capF` and `clampTarget` in `scene.js`), at every
  turn, tilt and zoom, in every mode. So the whole city cannot be seen at once in 3D; the 2D map is the
  whole-network view. Nothing is built beyond the grid. If the city grows, change `WORLD.city`.
- **Labels**: station names show when zoomed in; a place's label shows only when it is hovered, selected, or
  its row is hovered.
- **Focus framing**: `focusPose` stands the camera in front of a building (its `face`), at three quarters,
  high enough to clear towers, viaducts and stations. For a stubborn one, add `view: { az, ph, F }` to its
  `plot` in the registry.
- Free camera: full 360° turn, tilt from 20° to straight down, zoom inside the clamp. Mouse: drag pans,
  right-drag turns and tilts, wheel zooms. Touch: one finger pans, two fingers turn, pinch and tilt.
  Keys: arrows pan, Q/E turn, R/F tilt, +/− zoom, M 2D/3D. The cluster on the stage does the same;
  its last button is the widest view the limits allow.
- Buildings are never hidden. A train behind a building shows through as a silhouette in its line colour
  (`buildFleet` in `train.js`: a second pass with the depth test turned round).
- In the widest views small props marked `lod: 1` (most trees, parked cars, the rest of a row of houses)
  are left out, and only the towers cast shadows.

## Models

Every building, prop and station is a model from `models/` (built by `tools/city3d`, see its README).
`models.js` loads `manifest.json`, `kit.glb` and `landmarks.glb`. If they cannot be loaded, or with
`?models=off`, the page shows the flat network map instead. To try another library: `?models=./other/`.

- **Kit** (`kit.glb`): generic buildings and props. `world.js` gives every lot the kit model that suits its
  district and fills it best (`fitKit`): towers downtown, mid-rise inside the Circle, low-rise and houses at
  the edges, industrial models at the port. Each model name is one `InstancedMesh`; only the instances near
  the view are drawn (`placeKit().cull`). Trees, parked cars, boats, ferries, piers and port cranes are kit props.
- **Landmarks** (`landmarks.glb`): one headquarters per place, named in the place's `model` (a second
  building beside it goes in `annex`). A plot bigger than one block has a `rect` (Kevin Square).
- **Stations**: `station_elevated` stands at every stop, canopy tinted in the line colour. The escalators,
  and lift cores are built in `world.js` from `net.cross`.
  A module is raised until its platforms meet the train floor; on the upper deck (24.6 m, one module
  height above the Circle so interchanges stack cleanly) it stands on portal frames.
- **Screens**: each `<name>_screen` quad shows the photo slot named in the place's `screens`
  (`SLOTS` in `landmarks.js`, one slot per screen, in the screen's shape). `hirvo-cycle` and `noir-video`
  are live screens. Screens are unlit, so they show true colours.
- **Parts**: `*_canopy` takes a tint; `hq_nonstop_dome` and `plot_empty_jib` turn.
- One material for everything: the facade atlas (sRGB) × vertex colour (with the baked shade) × light.

Manifest:

```json
{ "version": 1, "unit": "m",
  "files": { "kit": "kit.glb", "landmarks": "landmarks.glb" },
  "kit": [{ "name": "tower_glass_a", "class": "tower", "w": 55, "d": 28, "h": 215 }],
  "landmarks": [{ "name": "hq_hirvo", "project": "hirvo", "w": 66, "d": 56, "h": 121, "screens": ["hq_hirvo_screen"], "parts": [] }] }
```

Conventions: every model is a top-level node named as in the manifest; origin at the footprint centre on
the ground; Y up; metres; the front faces +Z; screens and parts are child nodes; screen quads have 0–1 UVs.

