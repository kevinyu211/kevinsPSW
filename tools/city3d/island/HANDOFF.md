# Handoff: island model library (2026-11-21, second pass)

Scope of this pass: the glass bullet train and the hill pod, the construction logic of `station` and
`station_main`, the material set, and the beauty renders. The 45 project buildings, the tower and the
other props were NOT audited or re-detailed: that is the next builder's job, in these same scripts.

## Build

    ./build.sh --no-preview     # builds both GLBs, compresses, checks every name, writes manifest.json (about 10 s)
    ./beauty.sh                 # previews/beauty-*.png with the real materials (about 30 s)
    ./previews.sh               # sheets, close-ups, scene-*.png, then beauty.sh

Last run: "manifest.json written: 84 models, all names check out". buildings.glb 3,923 KB (166,109
triangles), props.glb 459 KB (15,277 triangles).

## Materials

Ten materials (now with glass_tint), defined once in `ilib.py` (`MATS`, `MAT_DEF` = roughness, metallic, alpha). All of them take
their colour from the vertex colours; the material only says how the surface behaves.
`pearl` glossy white coachwork · `metal` brushed metal · `stone` paving and masonry · `rubber` dark trims ·
`glass` see-through (alpha 0.34, exports as BLEND) · `glass_dark` opaque reflective glazing · `city` matte
paint and nature · `glow` · `sign`.

How a face gets its material:

1. By colour name, automatically. `MAT_OF` in `ilib.py` maps palette names to materials
   (`pearl`, `pearl_hi`, `trim` ... -> pearl; `pale_metal`, `steel_light`, `iron` ... -> metal;
   `pave`, `kerb`, `plinth` ... -> stone; `rubber`, `seam` ... -> rubber). A face drawn in the default
   `city` material with one of those colours lands in that material. `shade()`, `tint()` and `mixc()` keep
   the name's material. A raw `(r, g, b)` tuple has no material and stays `city`.
   To move a colour to another material, edit `MAT_OF`. To add a material: add it to `MATS` and `MAT_DEF`
   in `ilib.py` and to `MATS` and the `materials` text in `finish_island.mjs`.
2. Explicitly: `with m.use('metal'):` (or any material name) around the drawing calls.
3. Glass: `with m.use('glass'):` means `m.glass_mat`, which is `glass_dark` by default (buildings have nothing
   behind their windows). Set `m.glass_mat = 'glass'` at the top of a model whose glass should be see-through
   (the train, the pod and both stations do), and use `with m.use('glass_dark'):` for the odd opaque pane.
   See-through glass shows what is behind it, so model the inside (or use `glass_dark`).

The site's loader sorts by name: anything containing "glass" is glazing, "glow" is glow, the rest is one
matte material. So the new names load today; the site has to add real materials to show pearl, metal and
see-through glass.

## Beauty renders

`preview_scene.py` places models from the raw GLBs and renders them; `beauty=1` adds a sky for reflections,
a soft sun and the real materials. Items are `<file>:<model>@x,y,z,yaw` in glTF axes (`b` = buildings,
`p` = props, `t` = out/test.raw.glb from `build_island.py -- props only=name`). Options: `look=x,y,z`
`dist=` `lens=` `res=WxH` `ground=<height|none>` `gcol=r,g,b` `open=1` (slides every door and gate)
`night=1` `sky=<strength>`. Copy a line from `beauty.sh`. It uses EEVEE; the glass is alpha-blended, so
there is no refraction.

## What changed in this pass

- `train_end`, `train_mid` (`props.py`: `Capsule`, `METRO`, `metro_car`, `glass_doors`, `cabin`): a rounded tube,
  solid pearl below the floor line, one glass canopy over the roof on slim pearl ribs, a long tapered nose
  with a small pearl tip, glass door leaves in frames (same 8 children, same pivots, same slide), an
  interior (floor, seats, grab rails on poles, end bulkheads with a way through, a driver's desk).
  Height is now 3.75 m (was 3.6). An end car is 16.5 m with its nose; a 3-car train is 47.7 m, inside the
  48 m platforms. Triangles: 1,560 and 1,220.
- `tram` (the pod): the same idea, a glass bubble on a pearl base with benches inside; 3.4 m high; 1,364 triangles.
- `station` (`shared.py`): rebuilt as a working elevated station. Entrance pavilion on a forecourt with a 2.3 m
  door, fare gates inside, escalators and a stair up to a concourse under the lanes, escalators and a glass lift
  up through an opening in each platform, a street lift beside the front landing, a back stair, glass
  railings everywhere, platform end rails, portal frames on footings, vault on columns and ribs with a
  real underside. Gates, platform numbers, stopping numbers and child names are unchanged; `station_sign_5`
  moved 0.3 m; `door` and `backDoor` moved; new keys `concourse` and `entrance`. 7,072 triangles (was 3,896).
- `station_main`: the same platform openings with escalators going down into the hall, platform lifts,
  2.3 m entrance doors under a band of glass, posts under the entrance canopies, bases under the covered
  walk's posts, three posts under the pod dock's roof. 5,792 triangles.
- `audit_parts.py`: lists parts of a model that touch nothing. It is coarse (thin rods and surface-mounted
  bands show up as false alarms), but it is a start for the audit.
- Shared helpers touched before the scope was narrowed (they build cleanly, but I did NOT look at the
  buildings afterwards): `future.portal` (door-sized doors with a glass light above, a threshold, canopy
  posts, posts under the name board), `future.halo` (spokes and a hub), `parts2.umbrella_table` (pole
  reaches the canopy), `parts2.softbox` (arm), the tower's entrance doors (2.4 m), the lighthouse gallery
  rail, the ferry's foredeck rails, the crane's load slings.

## What I saw in the beauty renders

Looked at: train side, three-quarter and nose; pod; station from the street, the entrance, the platform
with doors and gates open, the back; main station from above and along the platforms.
The train reads as a glass bullet train with people-sized seats inside. The station reads as a building
you could walk through: door, gates, way up, concourse, platforms.

## Still wrong or unfinished

- Not looked at after my changes: every project building, the tower, the lighthouse, the ferry, the sites
  (the `beauty-building-*.png` and `beauty-tower*.png` files exist but I did not inspect them).
- Three buildings were already over the 6,000-triangle guide and grew a little (portal posts, halo spokes); `b_pindou_L5` is newly over it (6,113).
- buildings.glb is 3.9 MB, over the 3.5 MB target (more materials, the new station).
- Train: the nose tip is a small pearl cap that starts abruptly; the seats are flat slabs; no ceiling lights;
  the pod's step plates under the doors look stuck on.
- Station: under the vault it renders dark (EEVEE has no bounced light); the stair and escalator flights span
  10 m with no mid support; the pavilion's far end is open where the escalators leave; the platform is only
  1.3 m wide beside the lifts and the escalator opening.
- `station_main`: the hall is still a closed box (opaque windows), so the route from the door to the
  escalators is implied, not shown; the hall roof still lies under the lanes.
- The site still places trains at `DECK + 0.22`; the origin belongs on the datum (`track.railTop`).
- The site renders all glass opaque and metallic today, so the train's interior will not show until the
  site gives `glass` a transparent material.
