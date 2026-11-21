# Island city

Kevin Yu's portfolio as a small 3D island. Each kind of work is a town with one metro station; every
project is a building in its town; Kevin's tower stands on the hill. Static files, no build step.

Open `designs/city/` from a local server at the repo root (`python3 -m http.server 8765`).

## How it works

| File | What it does |
| --- | --- |
| `city-data.js` | **The one data file.** The towns, the projects, level rules, real numbers. No geometry. |
| `plan.js` | **The town plan** (owned by the town planner, proved by `plan-check.mjs`): the island's shape and ground, the lanes, roads, paths, zones, plots and the place of every building, house, tree and prop. |
| `layout.js` | Builds the plan once (`buildPlan(cityData, manifest)`) and hands it to everything else. |
| `../shared/content.js` | All project text, the résumé and contact (`window.KY`). Shared by every design. |
| `track.js` | The plan's metro loop (two lanes) and pod line, measured in metres. |
| `sim.js` | Where the trains and the pods are. Pure logic, nothing drawn. |
| `world.js` | The 3D island (three.js): draws the plan (ground, roads by rank, squares, every placement), the sea and sky, the lanes, trains, the camera. |
| `kit.js` | Built-in stand-in models, used for anything missing from `models/`. |
| `models.js` | Loads `models/manifest.json` and its `.glb` files, keeping each part's own material (`city`, `pearl`, `metal`, `stone`, `rubber`, `glass`, `glass_tint`, `glass_dark`, `glow`, `sign`). |
| `map2d.js` | A flat map, shown when the browser has no WebGL (or with `?2d`). |
| `pages.js` | The pages: a project, and the tower (about Kevin). |
| `app.js` | The story: the opening, the line strip, the ride, the doors, the look at the building, the page. |

**The metro.** One loop, a lane for each direction, five stations (K1 to K5). There is no track: the trains
fly along a lane marked by small lights and ring gates (`drawGuideway` in `world.js` is the one function
that draws it). Two trains run each way all the time, brake into every station, stop with their doors at the
platform gates, wait, and leave. The hill line (T1 Harbour to T2 Tower) is two pods that pass half-way.

**The strip** at the bottom is the one control: the five stations with their codes, live train positions,
and each town's projects as buttons.
- Click a project: the train that gets to its town soonest glides in (seen from outside), the camera moves
  into the glass car for the last seconds, the train stops, the car doors and platform gates slide open, the
  view steps out onto the platform, walks the plan's route from the station to the building and settles on its
  hero shot (a front three-quarter view, framed from the building's own size, from an angle nothing blocks),
  and then the page comes in **beside** it (a panel on the right; a sheet at the bottom of a phone). A second
  click skips the ride. From the overview there is always a train; only right after closing a page in the
  same town is it just the walk.
- Click a station: ride there and see the whole town, with its buildings named and the next trains.
- The page has Expand (full screen) and Look at the building (tuck it away). Closing it leaves you looking
  at the building, free to move.

**Moving around.** Drag pans, the wheel zooms towards the pointer, right-drag turns and tilts (touch: one
finger pans, pinch zooms, two fingers turn). The camera comes down to street level but never under the
ground, inside a building, or so far out that the island is lost. Clicking a building, a station, the
tower, the lighthouse or a boat glides the camera to it with no ride. Reset view goes back to the island.

## Add a project, or a town

1. Add the project's text to `../shared/content.js` (copy a neighbour; `status` is `live`, `testing`,
   `building`, `done` or `parked`).
2. Add one row to `PROJECTS` in `city-data.js`: `id`, `project`, `town`, `building`, `model`.

The plan gives it its town's next reserved plot, and the island draws it there; it gets a button on the strip
and a page. A new kind of work is a new row in `DISTRICTS` and in `TOWNS`: the plan builds its station and
town on the meadow kept for it. Run `node designs/city/plan-check.mjs` after either: it must say 0 problems.

**Levels.** A building shows one of five levels: 1 Lot, 2 Site, 3 Open, 4 Live, 5 Thriving. The project's
`status` sets 1 to 4 (`STATUS_LEVEL`). A live project reaches 5 when one real number in `NUMBERS` passes its
bar in `THRIVING`. Every number in `NUMBERS` needs an `asOf` date and a `source`. Never invent one.

## Models

`models/` is written by the Blender tools, not by hand. The city loads whatever `models/manifest.json`
lists and draws a stand-in for anything missing. Buildings: `b_<project id>_L3` / `_L4` / `_L5` (the highest
at or below the project's level), `lot`, `site_small`, `site_large`. Also `tower`, `station`,
`station_main`, `train_end`, `train_mid`, `tram`, `lane_ring_double`, and the props in `kit.js`. The
manifest's `forward`, `door`, `doors`, `gates`, `signs`, `boards`, `track` and `pitch` fields are read.

## Drawing: one mesh per material

Everything that never moves (the ground's plots and squares aside) is merged into one mesh per material for
the whole island; each piece carries its building's number so the opening still raises every building on its
own, in the shader. Trains, pods, gates, houses, trees, cars and props are instanced. All station name boards
are one draw call from one picture (an atlas), and so are the next-train boards. A lost WebGL context pauses
drawing and rebuilds what lived on the GPU when it comes back; if it does not come back within 4 s the flat
map takes over.

## Address bar, for testing

- `?time=dawn|day|golden|night` (default: the visitor's clock)
- `?weather=clear|rain|fog` (default: random each visit, mostly clear)
- `?look=film|model`
- `?nointro` skips the opening. `?reduce` acts as reduced motion. `?2d` forces the flat map.
- `?speed=4` runs the trains faster. `?debug` exposes `window.__city` (with `loseContext()` to test a lost GPU).
- `#/<project id>` or `#/tower` opens a page directly.

## Tests

Scripts are in `_shots/` and use Playwright on the real GPU:

```
NODE_PATH=$(npm root -g) node designs/city/_shots/ride-matrix.js   # every project from every town
NODE_PATH=$(npm root -g) node designs/city/_shots/untouched.js     # 60 s untouched: trains call at stations
NODE_PATH=$(npm root -g) node designs/city/_shots/monkey.js        # 300 random actions, desktop and phone
NODE_PATH=$(npm root -g) node designs/city/_shots/gpu-fps.js       # frames per second
NODE_PATH=$(npm root -g) node designs/city/_shots/roam.js          # drive the camera by hand, to its limits
NODE_PATH=$(npm root -g) node designs/city/_shots/ride-film.js     # one ride, saved frame by frame
NODE_PATH=$(npm root -g) node designs/city/_shots/towns.js         # a picture of every town
NODE_PATH=$(npm root -g) node designs/city/_shots/lane.js          # docked train, floating train, the pod
NODE_PATH=$(npm root -g) node designs/city/_shots/hero-all.js      # the hero shot of all 15 buildings and the tower
NODE_PATH=$(npm root -g) node designs/city/_shots/stats.js         # draw calls, triangles and GPU memory per frame
```
