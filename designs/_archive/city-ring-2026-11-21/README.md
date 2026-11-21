# Island city

Kevin Yu's portfolio as a small 3D island. One metro line loops round the shore, every project is a stop
with its own building, and Kevin's tower stands on the hill. Static files, no build step.

Open `designs/city/` from a local server at the repo root (`python3 -m http.server 8765`).

## How it works

| File | What it does |
| --- | --- |
| `city-data.js` | **The one data file.** Island size, the loop, the stops, towns and colours, level rules, real numbers. |
| `../shared/content.js` | All project text, the résumé and contact (`window.KY`). Shared by every design. |
| `track.js` | The loop and the hill tram measured in metres. |
| `sim.js` | Where the train and the tram are. Pure logic, nothing drawn. |
| `world.js` | The 3D island (three.js): land, sea, sky, track, stations, buildings, life, the camera. |
| `kit.js` | Built-in stand-in models, used for anything missing from `models/`. |
| `models.js` | Loads `models/manifest.json` and its `.glb` files. |
| `map2d.js` | A flat map, shown when the browser has no WebGL (or with `?2d`). |
| `pages.js` | The pages the doors open onto: a project, the tower (about Kevin), the main station. |
| `app.js` | The story: the opening, the line strip, the ride, the doors, links and keys. |

The visitor uses one control: the **line strip** at the bottom. Pick a stop and one ride plays: the view
follows the train, cuts inside as it pulls in, the doors open, the camera steps out and settles on that
project's building for a good look (name and level as a caption), and only then does the project page come
in **beside** the building: a panel on the right of a wide screen, a sheet at the bottom of a phone. The page
has Expand (full screen) and Look at the building (tuck it away). Closing it leaves the visitor looking at
the building, free to move.

**Moving around.** Drag pans across the island, the wheel zooms towards the pointer, right-drag turns and
tilts (touch: one finger pans, pinch zooms, two fingers turn). The camera can come down to street level but
never under the ground, inside a building, or far enough out to lose the island. Clicking a building, the
tower, the lighthouse or a boat glides the camera to it without a ride; the card that appears offers
"Ride here" and "Read now". Reset view goes back to the whole island.

**The look.** Day and night follow the visitor's clock and the weather is random each visit. The sea, the
sky and its reflections are shaders in `world.js`; at night the lights bloom a little (a three.js
post-processing pass in `vendor/addons/postprocessing`, used only at night and not on phones). The metro
runs straight through every station (`track.js`), on a slim white beam with a red light strip.

## Add a project

1. Add its text to `../shared/content.js` (copy a neighbour; `status` is `live`, `testing`, `building`,
   `done` or `parked`).
2. Add one row to `STOPS` in `city-data.js`: `id`, `project`, `district`, `building`, `model`, `side`.

That adds a station, a building, a street, a stop on the strip and a page. The stops re-space themselves
round the loop.

**Levels.** A building shows one of five levels: 1 Lot, 2 Site, 3 Open, 4 Live, 5 Thriving. The project's
`status` sets 1 to 4 (`STATUS_LEVEL`). A live project reaches 5 when one real number in `NUMBERS` passes its
bar in `THRIVING`. Every number in `NUMBERS` needs an `asOf` date and a `source`. Never invent one.

## Models

`models/` is written by the Blender tools, not by hand. The city loads whatever is listed in
`models/manifest.json` and draws a stand-in for anything missing, so it never breaks on a late model.
Names: `b_<stop id>_L3` / `_L4` / `_L5` for buildings (the highest at or below the project's level is
used), `lot`, `site_small`, `site_large`, `tower`, `station`, `station_main`, `train_end`, `train_mid`,
`tram` (doors `tram_door_n`), and the props listed in `kit.js` (trees: `tree_a`, `tree_b`, `tree_c`, `tree_pine`).
Things that move lie along X in the model files; the manifest's `forward`, `door`, `doors` and `track` fields are read. Metres, Y up, front faces +Z, origin on the ground at the middle
of the footprint. Materials by name: `city`, `glass`, `glow`.

## Address bar, for testing

- `?time=dawn|day|golden|night` (default: the visitor's clock)
- `?weather=clear|rain|fog` (default: random each visit, mostly clear)
- `?look=film|model`
- `?nointro` skips the opening. `?reduce` acts as reduced motion. `?2d` forces the flat map.
- `?speed=4` runs the trains faster. `?debug` exposes `window.__city`.
- `#/<stop id>`, `#/tower`, `#/main` open a page directly.

## Tests

Scripts are in `_shots/` and use Playwright on the real GPU:

```
NODE_PATH=$(npm root -g) node designs/city/_shots/ride-matrix.js   # every ride ends on the right page
NODE_PATH=$(npm root -g) node designs/city/_shots/untouched.js     # 60 s without touching anything
NODE_PATH=$(npm root -g) node designs/city/_shots/monkey.js        # 300 random actions, desktop and phone
NODE_PATH=$(npm root -g) node designs/city/_shots/gpu-fps.js       # frames per second
NODE_PATH=$(npm root -g) node designs/city/_shots/roam.js          # drive the camera by hand, to its limits
NODE_PATH=$(npm root -g) node designs/city/_shots/ride-film.js     # one ride, saved frame by frame
```
