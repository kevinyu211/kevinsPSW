# Construction audit: island models (2026-11-21, third pass)

The question for every model: what holds each part up, what does it connect to, could a person walk in and
use it? Renders are beauty renders (sky, sun, real materials) made with `look.py`:
`python3 look.py <model>` writes `previews/look-<model>-{a,b,c}.png` (front three-quarter, back three-quarter,
eye level at the entrance); `python3 look.py lineup <id>` writes `previews/lineup-<id>.png` (L3, L4, L5);
`python3 look.py tower` writes five tower views.

## Pipeline changes that apply to everything

- `detail.py` (new): railings (frameless glass in a base channel, 1.1 m, round handrail), stairs (0.17 m
  risers, stringers or solid cheeks, handrails), plinths under drums, ring beams under domes, sills and heads,
  columns, roof plant, downpipes, paving with bands, round forecourts, lamp posts, benches, planters with
  trees, hedges, bike hoops, signposts, flag rows, fountain pools, straight glazing with mullions.
- `future.gband` now has a sill, a head and slim mullion strips; `portal` posts stand on plinths; `street`
  has modern lamps, a bench and optional bike hoops; `round_win` is real glass with a cross bar.
- Rounder edges (Kevin's note): `ilib.soften` chamfers every sharp edge on opaque parts (14 cm on big parts,
  6 cm on medium ones); with smooth shading the chamfer reads as a rounded edge that catches a highlight.
  Glass, glow and sign faces stay crisp. Lettering is now moulded 3D letters in a rounded typeface (macOS
  Arial Rounded Bold, local system font) with bevelled edges, about 8 cm proud of their board.
- New material `glass_tint` (smoked blue-grey, alpha 0.82, roughness 0.06, metalness 0.3) on the train and
  pod canopies and door leaves. Listed in the manifest and README.
- Daylight renders: glow emission lowered so lit panes read as warm windows, not white blocks; ground plane
  reaches the horizon; camera clipping fixed (the plaza was flickering into the ground).

## Per model

| Model | What was wrong | What changed | Render checked |
|---|---|---|---|
| tower | Lobby a solid yellow wall; entrance a grey box; no floor lines or mullions; pod a ring with no deck; fins sat on the paving; two fins shared faces (invalid mesh) | Podium of five 0.18 m steps all round; stone footing under each fin; lobby double height in see-through glass with floor, lift core and doors, gallery with railing, curved desk; floor line at every slab, mullions up the core; glass porch with three pairs of doors, canopy on posts, steps with handrails; front walk between two fountain pools; plaza paved in rings and spokes, lamps, trees in planters, hedges, benches; observation pod rebuilt: glass room round a lift core, cantilevered deck with a railing, upper glass room, roof cone; beacon on the needle tip. Mesh valid | look-tower-a..e |
| hirvo | Whole floors glowing white; podium roof garden with no railing; podium ran into the tower; ac unit on the roof | Glass tower with a slab edge every floor and a few lit panes; double-height lobby; sky lounge with railed terrace; halo on a mast with stays; podium moved clear of the entrance, roof garden with lawn, trees, benches, skylight, railing that stops at the tower; walk from the street, bike hoops, CV sign on two posts. L5: glass welcome dome on plinth and ring beam with ribs and its own door, fountain plaza, flag row, globe, second halo | look-b_hirvo_L4-a/c, L5-a, lineup-hirvo |
| trade | Shell sat straight on the paving; plain roof | Stone plinth and drainage channel along both feet; glazed strip and vent cowls on the crown; walk to the door; crane rails in the quay; bollards along the piers and a rubber fender at each head. L5 control tower: railing on its balcony, plinth, door, beacon, flags | look-b_trade_L4-a/c, lineup-trade |
| court | Path ran across court B; dome straight on the drum; no fences | Ring beam under the dome, curb round the roof light, plinth; entrance moved to face the gap between courts A and B, walk along that gap; ball-stop fences (3 m) with posts round each court, players' benches. L5: railed roof garden on the annex, a four-tier stand with a back railing | look-b_court_L4-a/c, lineup-court |
| uhome | Pods floated on 0.45 m gaps; balconies and roofs with no railings | A slab between every pair of pods; every cantilevered balcony has a railing and a planter; railing round every roof; columns under the top canopy; residents' back door; glass dome on a plinth with ribs; walk. L5: pool loungers, flag row | look-b_uhome_L4-a/c, lineup-uhome |
| pindou | Beads only touched; windows beige | Glazed links on stone sills from the big bead to each small one ("beads on a string"); plinth under each bead; the bead hole is a glazed roof light with a curb; porthole windows in glass; walk, bike hoops; smoother spheres | look-b_pindou_L4-a/c, lineup-pindou |
| books | Book roof held by nothing but a stub; terrace without railing; bunting tied to air | Reading terrace on top of the drum (deck) with railing, open where the ramp arrives; four struts carry the pages; ramp parapet 1.1 m with a cap; plinth; walk. L5: railed annex roof garden with its own door, bunting on two poles, fountain | look-b_books_L4-a/c, lineup-books |
| bookflow | Wave roof dipped into the hall; canopy on a thin pole; flue started in mid air | Roof raised clear and carried on posts at every trough; glazing with mullions on the sides; plinth; canopy column with four struts and a footing; flue rises from the roof; signboard moved off the walk; walk and bike hoops. L5: ink tanks on plinths | look-b_bookflow_L4-a, lineup-bookflow |
| ipad | Door at x 0 but entrance at the side, no path | L-shaped walk to the entrance; plinth, downpipes, roof plant; pencil pot moved off the walk. L5: annex with ring beam, roof light, door, forecourt | look-b_ipad_L4-a, lineup-ipad |
| yae | Dome sat on the roof disc directly | Plinth, ring beam under the dome, walk, benches, museum signpost. L5: annex with plinth, ring beam, ribs and door; fountain plaza | look-b_yae_L4-c, lineup-yae |
| noir | 17 m fin stood on nothing; roof terrace with no railing; tables in the doorway | Footing under the fin; plinth; walk; tables moved clear; name board at L4 too. L5: railing round the roof terrace | look-b_noir_L4-c, lineup-noir |
| influencers | The studio front was simply open | Curved glass wall with mullions and a glass door under the lintel; plinth; walk; roof plant; camera moved off the walk. L5: annex with plinth, ring beam and door | look-b_influencers_L4-c, lineup-influencers |
| stickers | Shop window a flat plate; bunting tied to air | Glazed shopfront with mullions; plinths; downpipe; walk. L5: door into the yellow ball, bunting on poles | look-b_stickers_L4-a, lineup-stickers |
| party | Domes straight on drums; light poles with no bases | Ring beams under both domes, plinths, footings for the light poles, paved apron and walk. L5: annex on a plinth with a door and walk | look-b_party_L4-a, lineup-party |
| duiyao | Pill sunk into the ground; cross on a 14 cm post | Two cradles under the pill; cross on a thicker post with a footing; pill-shaped sign on two posts by the street (L4, L5); walk. L5: dome on plinth with a door | look-b_duiyao_L4-a, lineup-duiyao |
| hackathons | Brim held only by the glass | Ring of slim columns under the brim; plinth; footings for the fins of light; walk. L5: door in the beacon tower | look-b_hackathons_L4-a, lineup-hackathons |
| site_small, site_large | Hoarding panels with no posts | A post at every panel joint | look-site_large-a |
| lot | Nothing physically wrong | Unchanged (render looked at) | look-lot-a |
| station | 10 m flights spanning on their own | Steel portals at mid-span (or thirds) down to footings | beauty-station-street, beauty-station-back |
| train_end, train_mid, tram | Clear canopies showed the whole interior | `glass_tint` smoked glazing | beauty-train-side, beauty-train-three-quarter, beauty-pod |

## Not done in this pass

- Props (houses, trees, cars, bus, boats, ferry, lighthouse, beach things, animals): only the global edge
  softening reached them; no construction audit, no new detail.
- Station weak points still open: dark under the vault in EEVEE, the narrow platform beside the lifts,
  `station_main` hall still a closed box. Train nose tip and flat seats unchanged.
- Spheres and drums still show facets at eye level (vertex AO and weighted normals); the beads were given
  more segments, the rest were not.
- L3s are mostly smaller versions of L4 with fewer extras; only some L5s got a truly new wing.

# Fourth pass (coordinator's list, 2026-11-21)

| Item | What changed | Render checked |
|---|---|---|
| File size | Vertex colours exported at 8 bits (were 10); lettering under 0.6 m stays flat; moulded letters are lighter (no hidden back band, coarser curves, near-flat faces merged). buildings.glb 6,457 KB -> 5,151 KB | - |
| Houses | Round windows: moulded frame, glass, cross bar, sill; a lamp by every door; plinths. house_a: terrace with a planter and a seat. house_b: base, roof planter box. house_c: railing round the balcony. house_d: cradles under the capsule, a planter | row-houses-close |
| Cars, bus | 12-sided wheels under dark arches; door seams; car_a has a coral lower body and one door a side, car_b is silver with two doors a side | row-cars-close |
| Boats | Sail boat: forestay, backstay, shrouds on spreaders, lifelines on stanchions. Ferry: stowed gangway by the stern | row-boats-close |
| Street, stops | Tram stop: five steps (0.18 m) up to the platform inside its depth, handrails, the sign hung on rods. Ferry terminal: a railing along the jetty, bollards, a fender at the end (it already had piles) | row-street |
| Trees, animals | Rounder canopy clumps; no edge chamfer on nature (it made them faceted); legs eight-sided | row-nature-close |
| Stations | station_main hall opened: pearl base and fascia, clear glass between, mullions, stone floor, lit ceiling, fare gates, escalators from the hall floor up to the platform escalators, lifts down to the hall floor. Both stations: light bars on rods under the vault | beauty-station-main-front, beauty-station-platform |
| Train, pod | Nose: the glass stops earlier, so the pearl tip is a full nose cone instead of a small cap. Seats: cushion, raked back, headrest. Pod step plates are now soft sills flush with the body | beauty-train-nose, beauty-train-seats, beauty-pod |
| Levels | L5 extras: pharmacy fountain garden, party dance deck with umbrellas, photo studio fountain forecourt and flags | lineup-duiyao, lineup-party, lineup-influencers |
| Round shapes, panes | Drums 36 sides by default, bead spheres 28 x 14; lit panes are a warm amber (`lit_pane`) instead of pale cream | look-b_hackathons_L4-c |
| Skipped renders | Looked at: BookFlow, Studio, Sticker shop, Party house, Pharmacy, Hackathon eye-level views; line-ups of Court, UHOME, Pindou, Books, Pharmacy. Fixed: the studio's blank front wall (now glazed) | look-b_ipad_L4-c |

Still open after this pass: the station platform beside the lifts is unchanged (moving the lifts would run them into
the outer railing; needs a redesign of the platform edge); the underside of the vault still renders dark in EEVEE
(the model has light soffits and light bars; EEVEE adds no bounce light); most L3s are still smaller versions
of their L4; the BookFlow, Studio and Pharmacy line-ups were rendered but not re-checked after the last changes.

# Fifth pass: platform edge, metro mark, first buildings (2026-11-21)

| Item | What changed | Render checked |
|---|---|---|
| Platform edge (`station`, `station_main`) | Platforms widened outward: outer edge 8.2 -> 9.4 m from the centre line (manifest `platform.outer`). Escalator openings moved out 1.2 m (y 6.7-8.9), platform lifts moved out to 7.9 m with a slimmer 2.2 m shaft. Clear walking width between the gate line and the lift is now 2.5 m (was 1.3), and 2.6 m past the escalator opening (was 1.4). The outer screen, canopy columns, benches and vault moved out with the edge; the name boards (sign children) stay exactly where they were, now on two posts each. Haunched brackets carry the wider deck out past the portal columns. `station`: the concourse gets a bay at each escalator foot, railings rerouted, a solid skirt under the low end of each escalator. Track centres, edge line, gates, doors, stopping point and signs unchanged; footprints did not grow (`station` x 49.6 -> 49.0 because the mark moved) | beauty-station-liftside, beauty-station-concourse, beauty-station-entrance, beauty-station-street |
| Metro mark | The red ring with a bar (too close to an existing system's mark) is replaced on both stations by an original mark: an open pearl ring with a gap at the top right, like the loop line, with a line of light in the line colour round its face. Same family as the ring gates. No sign panel added | beauty-station-entrance |
| L3 first buildings | Each project's L3 is now its own modest first building with a lawn and a line of light marking where the next phase will grow: Hirvo two-storey glass pavilion with railed roof terrace and small halo; harbour one small vault, one crane, two containers, one pier; courts one fenced court and a changing pavilion; UHOME one two-storey pod with a balcony and a small glass dome; Pindou one bead with a roof light; books a reading kiosk under an open-book canopy on posts; BookFlow a shed under a single roof wave; studio one room with one curved skylight; museum a small glass dome and the skeleton; Noir a small pill lounge and a short fin; photo studio a small round room with a glass front and a ring light; sticker shop one soft cube; party house one small dome with strung lights; pharmacy a pill kiosk on cradles; hackathon a small lens pavilion on columns | all 15 lineup-*.png; look-b_hirvo_L3-c, look-b_bookflow_L3-c |

Line-ups are copied to docs/designs/city-style/buildings/lineups/.
