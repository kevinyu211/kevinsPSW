# The island town plan

Where everything on the island stands, and why. The plan is code (`plan.js`), it is proved by a test
(`plan-check.mjs`), and it can be looked at from above (`plan-map.html`).

    node designs/city/plan-check.mjs               # must end with "0 problems"
    node designs/city/plan-check.mjs --self-test   # also breaks the plan 15 ways to show each fault is caught
    node designs/city/plan-check.mjs --shots       # also saves the pictures (needs Playwright and the local server)

Pictures: `docs/designs/city-style/island-town-plan.png` (whole island), `island-town-<town>.png` (one per
town), `island-town-plan-six.png` (with a sixth town added).

## The plan in a few lines

- **One ring.** The metro's two flying lanes loop the island about 40 m in from the shore. The coast road
  runs beside them and links all five towns. Every other road joins it; the only dead ends are the hill road
  at the tower and two short house lanes.
- **Five towns, each round its station.** A station, a square in front of it, the town's project buildings
  facing the square or its streets, a few houses, one empty plot kept for the next project.
- **Green between.** The hill in the middle is a park with the tower on top. Between the towns: trees, an
  orchard, and a meadow in the south kept for a sixth town.
- **Everyone can walk.** A promenade follows the whole waterfront. From each station entrance there is a
  walking route to every project's door (`plan.walks`).

| Town | Shape |
| --- | --- |
| K1 Harbour (software) | Main station facing the bay. Port on the quays: the warehouse and its piers, the ferry pier, the fishers' quay. The coast road passes behind the station as Harbour Road; downtown is a grid of three blocks inland of it. Tower Avenue leads to the hill road; the pod flies above it. |
| K2 Garden (books) | Print works behind the square, bookshop across the coast road on the cape, studio up Second Street, a terrace of houses. Its two streets run through to the Harbour's West Street. |
| K3 North shore (film) | Square with two gardens; the museum and the jazz bar face it; the photo studio on Second Street. Hill Street joins on to Lighthouse point. |
| K4 Lighthouse point (health) | Square and event hall behind the station, pharmacy on First Street, lighthouse on the headland. East Hill Street runs south behind the towns to the Beach. |
| K5 Beach (games) | Car-free beach front: the station faces the sea, its square opens onto the boardwalk, the party house stands beside it. The coast road passes inland behind the station, with the toy shop on it. |

## What Hong Kong and Taiwan do, and where it shows up here

Looked up on 2026-11-21 (sources in brackets); the last three are common knowledge about those places, not
checked today.

| # | Principle | Where it is in the plan |
| --- | --- | --- |
| 1 | Hong Kong plans each new town round a town centre, and puts the centre at the railway station. [Wikipedia, New towns of Hong Kong] | Every town's square is at its station door; the buildings stand round the square. |
| 2 | The first new towns were meant to be self-contained: homes, shops, workplaces and recreation in each. [same] | Every town has project plots, houses, a square and its own piece of waterfront. |
| 3 | Rail and land are planned together ("rail plus property"). [transit-oriented-development reports from ISIS Malaysia and the Asian Development Bank] | A new kind of work means a new station and a town on its doorstep; the south meadow already has its straight stretch of lane. |
| 4 | On Cheung Chau there are no cars: narrow lanes, bicycles, a village packed in the middle by the harbour, the beach on the other side. Lamma is the same. [Wikipedia, Cheung Chau; hongkong-trip.com, Lamma] | Beach town's front is car-free: station, square, party house and boardwalk, with the coast road kept behind. Every square is paths only. |
| 5 | In Taiwan a lane (巷) branches off a road and an alley (弄) off a lane; long roads are cut into sections. [Wikipedia, House numbering] | Four ranks of road: coast road, main street, street, lane. A lane only ever leaves a street; houses stand on lanes or in terraces. |
| 6 | Taiwan's coast highways string the coastal towns together. [East Coast National Scenic Area, Provincial Highway 11] | The coast road is one ring through all five towns, and the metro loop runs beside it. |
| 7 | A waterfront is public. | The promenade runs unbroken round the island, along the quays and as a boardwalk at the beach. |
| 8 | Hong Kong zones land by use and names the zones (commercial, residential, community, open space, industrial, green belt, country park). | The zones below. The port is on its own quay; the hill is a park nobody builds on. |
| 9 | The steep hills stay green; the towns sit on the flat land below. | Nothing but the tower, its pod stop, the road and three flights of steps is on the hill. |
| 10 | The street in front of the station is the main street. | First and Second Street start either side of each station and run into town. |

## Zones

| Zone (`zone.use`) | What it is |
| --- | --- |
| `square` | The civic heart at each station; also the tower plaza. Paths only. |
| `project` | A plot with a project building. Sized for that building's largest level. |
| `port` | The cargo quay and the fishers' quay at the Harbour. |
| `reserved` | An empty plot kept for the town's next project. |
| `residential` | Houses: on a lane (a close with a pocket green at the end) or in a terrace along a street. |
| `park`, `farm` | Pocket greens, the gardens by the North shore square, the orchard. |
| `beach` | Sand, umbrellas, sunbeds. |
| `hill` | Tower Hill park: forest, the hill road, steps. |
| `future` | The south meadow, kept for town six. |
| everything else | Green belt. |

## Size: what had to give

The rules are: every plot fits its building's largest level, no two things overlap, every town keeps a spare
plot, and green stays between the towns. On a 560 × 340 m island at building scale 1.12 the plots alone cover
more than the flat land inside the loop, so three numbers moved:

- **The island is 600 × 420 m** (the sketch was about 560 × 340).
- **Building footprints are × 0.9** (`PLAN.scale`). Today's large buildings are 56 to 67 m wide, 9 to 11% of
  the island's width, so they read as large as before.
- **One spare plot per town**, and the meadow for town six holds a station, a square and one mid-size plot.

There is room for 19 houses, not the 46 in the data file.

## Add a project

Add its row to the data file. `buildPlan` gives it the town's next reserved plot (`LAYOUT[town].reserve`, in
order) and nothing else moves. A reserved plot is 58 × 42 m: it fits any of today's small and mid-size
buildings at their largest level. When a town's reserve is used up, the plan says so in `plan.problems` and the
check fails; draw a new plot in `LAYOUT` then.

To give a known project a particular plot, name it in `LAYOUT[town].assign`.

## Add a town

Add a new district (and town) to the data file with at least one project. `buildPlan` builds the station on the
south straight, its square, two streets and Hill Street on the meadow (`LAYOUT.next`).

## For the 3D scene

`buildPlan(cityData, manifest, { projects: KY.projects })` returns plain data; the top of `plan.js` states the
axes and the rotation rule, and the comment above `buildPlan` lists every field. Use `height(x, z)` for the
ground and `coast` for the shoreline. Place every `placements[]` entry as given (`rotation.y = rot`); a project
building keeps the same origin (`lot.origin`) at every level, so it grows in place. Building takes about half a
second.

## What the check holds the plan to

Gaps: 4 m between buildings (walls, not plots), 2.5 m between houses, 3.9 m between plots, a tree's canopy
0.5 m from any footprint. Nothing on a road or a path, nothing within 6.5 m of the lanes' centreline, nothing
off flat ground (the natural shore's last 12 m and the hill are not buildable). Lanes bend at 80 m or more;
70 m of straight at every station. Roads form one network with exact shared junction points. Every door looks
onto a street, its square or the boardwalk within 20 m and can be walked to from the station entrance. The hill
road climbs at 14% or less.
