# Island city models

The 3D model library for the island city, in the "city of tomorrow" style (smooth pearl-white shells, curved glass, district colour as an accent): 84 models in two files, plus `manifest.json`, which lists
every model with its size, triangle count, child nodes and door.

| File | What is in it |
|---|---|
| `buildings.glb` | 15 project buildings × 3 finished levels (`b_<id>_L3`, `_L4`, `_L5`), `lot`, `site_small`, `site_large`, `tower`, `station`, `station_main` |
| `props.glb` | `train_end`, `train_mid`, `tram` (the hill pod; all three with sliding door children), `lane_ring`, `lane_ring_double`, houses, trees (`tree_a` to `tree_c`, `tree_pine`, `palm`), pod cars, `bus`, `streetlamp`, `bench`, boats, `ferry`, `lighthouse`, `tram_stop`, `ferry_terminal`, beach things, animals |
| `manifest.json` | Names, sizes, triangles, child nodes and pivots, doors, station and train numbers |
| `CREDITS.md` | Where everything came from (all made here) |

## Rebuild

    tools/city3d/island/build.sh

Needs Blender 5.x and Node. It builds every model, bakes the shading, exports and compresses the two
GLBs, checks every node name against the manifest, and renders the proof pictures into
`tools/city3d/island/previews/` and `docs/designs/city-style/island-detailed-*.png`.
Add `--no-preview` to skip the pictures (about 10 seconds instead of a few minutes).
`beauty.sh` renders `previews/beauty-*.png` with the real materials (sky reflections, see-through glass).
`previews.sh` alone renders the sheets, the close-ups and the `scene-*.png` pictures (the train docked in a
station, the pod at its dock, a train flying through a ring). `preview_scene.py` places any models together
for a picture: see the top of that file.

## Rules the models follow

- Metres. glTF Y up. A building's front (entrance) faces +Z and its origin is the footprint centre on
  the ground. Things that move (trains, tram, cars, bus, boats, animals) lie along X and face +X.
- Every model is a top-level node at the origin. Moving parts are child nodes named `<model>_<part>`
  (`site_small_jib`, `train_end_door_1`, `gull_wing_l`, `lighthouse_lamp`, `tower_crown`). A child's
  own origin is its pivot.
- Ten materials, no textures. Every one multiplies a white base colour by the vertex colours (`COLOR_0`,
  with soft baked shading), so colour still comes from the vertices; the material says how the surface
  behaves. Give `pearl`, `metal` and both glasses an environment map (a sky) to see them properly.

  | Material | What it is | Roughness / metalness |
  |---|---|---|
  | `pearl` | Glossy white coachwork and shells: train and pod bodies, building shells, canopies | 0.26 / 0 |
  | `metal` | Brushed metal: rails, poles, posts, frames | 0.36 / 0.9 |
  | `glass_tint` | Smoked, slightly blue-grey glass for the train and pod canopies and door leaves: reflects the sky, the cabin shows only faintly. `alphaMode: BLEND`, alpha 0.82; COLOR_0 is already the dark tint | 0.06 / 0.3 |
  | `glass` | Clear tinted glass you can see through: platform screens and gates, lift shafts, railings, the station entrance. `alphaMode: BLEND`, alpha 0.34. Draw it after the opaque parts | 0.05 / 0 |
  | `glass_dark` | Opaque reflective glazing for building windows (nothing is modelled behind them) | 0.1 / 0.4 |
  | `stone` | Paving, kerbs, plinths, masonry | 0.94 / 0 |
  | `rubber` | Dark trims, tyres, seals | 0.7 / 0 |
  | `city` | Everything painted or natural: matte | 0.82 / 0 |
  | `glow` | Window panes, signs, lamps, the hover glow: lit at night | 0.35 / 0 |
  | `sign` | Blank name boards and next-train displays (child nodes `<model>_sign_n`, `<model>_board_n`: one quad each with 0-1 UVs to draw on) | 0.6 / 0 |

  A loader that only knows `glass`, `glow` and "everything else" still works: `glass_dark` contains the
  word glass, and the other new names fall into "everything else".
- The metro has no track. The trains (and the hill pod, node `tram`) float along a lane; a soft blue glow
  along the belly (`glow` material) shows they hover. The cars are rounded glass tubes on a pearl base, 3.75 m
  to the top of the roof, with the cabin modelled inside (floor, seats, grab rails); an end car with its
  nose is 16.5 m long (the nominal `length` stays 14.5 m and the pitch 14.6 m). A vehicle's origin is on the lane's datum, which the
  manifest still calls rail level (`railLevel`, `track.railTop`): the floor is `floor` above it (1.1 m for
  the metro, 0.9 m for the pod) and the belly `underside` above it. So a train stopped in a station has
  its origin at `track.railTop` (10 m above the station's ground), and its floor meets the platform.
- Stations are docks for two lanes: lane centres 2.1 m either side of the centreline, two 48 m side
  platforms with a line of light along each edge, and nothing between them but a slim docking line of
  light (on curved ribs under `station`, on the hall roof of `station_main`). `station` is a complete
  elevated station: a glass entrance pavilion with fare gates on a forecourt (`door`), escalators and a
  stair up to a concourse under the lanes (`concourse`), escalators and a lift up through each platform,
  a street lift, and a back stair (`backDoor`). It reaches 18 m in front of the centreline (the forecourt) and 12 m behind. The manifest gives the
  stopping point, car pitch, door centres and the sliding platform gates (`<station>_gate_1` to `_12`).
- `lane_ring` and `lane_ring_double` are slim floating gates the trains fly through. Origin at the ring's
  centre, axis along X. Put the centre `aboveDatum` (1.97 m) over the lane datum; the double one goes
  midway between the two lanes. The clear opening is in `opening` ([width, height]).
- The files use meshopt compression, so the loader needs `MeshoptDecoder`. Positions are ordinary
  floats in metres, so geometry can be instanced or merged as it is.

## Add a building for a new project

1. Add the stop to `designs/city/city-data.js` (that file belongs to the site).
2. In `tools/city3d/island/future.py`, add one function:

        @building('<id>', '<district>')            # add site='site_large' for a big plot
        def b_<id>(m, L):                          # called three times: L = 3, 4, 5
            ph = fpad(m, width, depth)             # the paved plot
            set_door(m, 0, -depth / 2)             # where the street meets it
            ...                                    # L3 small, L4 full, L5 full plus extras

   Copy a building of a similar size as a start. The shape helpers at the top of `future.py` (dome,
   drum, glass band, disc, soft box, halo, strip of light, portal) do most of the work; `ilib.py` and
   `parts2.py` hold the lower-level pieces and themed props. (`buildings.py` is the first, traditional
   set; it is kept only because `future.py` borrows a few pieces from it.)
3. Run `tools/city3d/island/build.sh`. The new nodes and their sizes appear in `manifest.json`.
4. Look at the new row in `tools/city3d/island/previews/` before using it.

Keep each level under about 6,000 triangles and to one or two bold, simple shapes: white and glass
with greenery, and the district colour as an accent (a ring, a canopy edge, a band of light, a sign). Signs carry shapes, generic words or public project names only: never a client,
customer or staff name.
