# Decisions

## 2026-11-20 · What the site is for
- **Question:** Keep the site as a tour of the AI-agent company (Grok Bot org map, 5-step "How I work"), or make it a personal brand portfolio?
- **Decision:** Personal brand + portfolio/résumé. Lead with shipped work and a résumé; the agent team gets one line, not a section. Drop the org map, the pinned agent walkthrough, the big Noir Hours player and the Learning section.
- **Why:** Kevin: "less emphasis on the grokbot… cut out any bs… whatever displays what I do the best."

## 2026-11-20 — Transit v4: a loop around the city, with stations as project buildings
- **Question:** how should the Transit metro run through Kevin's city?
- **Decision:** one simple square loop around the city, at street level or elevated, with no underground. The train runs round and back to the start. Each station is a building that shows its project. The city gets more to click on.
- **Why:** Kevin said the underground route was more complicated than it needed to be. A loop is easier to read, and buildings that show the work display the projects better than signs do.

## 2026-11-20 — Transit v5: a full metro network, like the Shanghai map (replaces the single loop)
- **Question:** one loop or a real network?
- **Decision:** a network of coloured lines laid into a complete city: a circle line (the v4 loop) plus one line per kind of work, crossing at interchange stations. Each project gets a headquarters building designed to match it. Visitors pick a line and a station.
  - The camera works like Google Earth: zoom, tilt and rotate, plus a flat top-down map view.
  - Project pages read like short articles.
- **Why:** Kevin, pointing at the Shanghai metro map: the city should feel complete, with lines and colours visible everywhere, and the project write-ups must explain the work as well as Monograph does.

## 2026-11-20 — Transit v6: a seaside city built from Blender models, with a "Monopoly" rule
- **Question:** how do we make the city look like a real city, and how does it grow?
- **Decision:**
  - The buildings come from a Blender model library (reusing free CC0 models where they fit), not from boxes drawn in code.
  - The city is a seaside city with a dense downtown and Kevin's own tower in the middle, taking cues from New York and Shanghai.
  - Monopoly rule: every project adds one metro station and one building, driven from a single data file. Empty plots mark future projects.
  - Arrival fills the screen with that station's section; visitors click in for the article or exit to the whole map.
  - The camera cannot zoom out past the city.
- **Why:** Kevin: the v5 city "doesn't really look like a city", the zoomed-out view showed empty land, and Blender gives more control and a more systematic way to add buildings.

## 2026-11-20 — Transit v7: one building per station, visible transfers, a full 2D version
- **Question:** how does changing lines work, and how do the 2D and 3D views relate?
- **Decision:**
  - A station is one building. Lines that share a station have their platforms inside the same building, joined by escalators.
  - Two rail levels only: the five category lines on the upper deck, all meeting in one hub hall at Kevin Square under the tower; the Circle on the lower deck, crossing them at two-deck interchange stations.
  - A transfer is shown, not cut: get off, a marker rides the escalator or crosses the hall, board the next line's train.
  - Buildings are never hidden. The 2D map is a full version of the site, not just a view, with joined interchange symbols.
- **Why:** Kevin could not follow how interchanges worked; in v6 an "interchange" was separate stations about 65 m apart at three heights.

## 2026-11-20 — Transit v8: it plays by itself, and the network is a knowledge graph
- **Question:** how does a first-time visitor know what to do, and how do projects connect?
- **Decision:**
  - The site opens with one line of story ("Everyone builds their own city. This is Kevin Yu's.") and a tour that starts by itself: the train rides stop to stop, the camera zooms in on each headquarters, and a caption explains it.
  - One dock replaces the ticket machine: "You are at …", "Where to next?" with the connected places, and "All stops".
  - Lines stay categories, but they now cross each other at projects that belong to two kinds of work, across the whole map, not only at Kevin Square.
  - Each project carries tags taken from its existing facts. Shared tags make the "Connected to" links and a Skills view that lights up every project using a skill.
- **Why:** Kevin: a visitor should know exactly what to do, the trains should run non-stop on their own, everything should be connected like a knowledge graph, and it should work as a portfolio for a master's application.

## 2026-11-21 — Transit v9: click a project, the train takes you there
- **Question:** what is the simplest way to use the metro city?
- **Decision:** a project list is always on screen. Clicking a project makes the camera zoom in on the train and follow it to that project's building. The view can no longer zoom out past the built city, so the grass and forest around it never show.
- **Why:** Kevin: "the viewer can just click on each individual project and the train automatically animates"; the wide view showing green land looked wrong.

## 2026-11-21 — The city is redesigned from scratch as a small island that grows
- **Question:** the v9 metro city is too busy, its layout makes no sense and it doesn't feel like Kevin's. What should the city be?
- **Decision:**
  - A small island that starts with a few buildings and adds land as projects are added. Green and open. Kevin's tower (a tall, slim spire) is the centre.
  - One building per project, shaped like the work. Each building has five levels: Lot, Site, Open, Live, Thriving. The project's stage sets levels 1 to 4; a real public number (views, users, sales) lifts it to 5.
  - One metro line now, more lines later. Districts by kind of work. One line strip at the bottom is the main control.
  - Click a project: the view follows the train, cuts inside as it pulls in, the doors open onto a full project page.
  - On opening, the city builds itself in the order the projects were made.
  - Two looks with a switch: animated film (real light, simple shapes) and white model (colour only on Kevin's buildings and the train). Day or night follows the visitor's clock; weather is random.
  - Built for Kevin first, from one data file, so other people can have their own city later.
  - Sample pictures come from Blender or code, not Higgsfield (too expensive).
- **Why:** Kevin: "its a portfolio site, but we see the progress ppl make… the better we do the more developed it gets… The main piece will be the personal building." The mesh network of v8/v9 was easy to get lost in.
- **Island plan (same day):** the coast loop. The metro circles the island along the shore, each kind of work is a seaside town, and the tower stands on a green hill in the middle. A second line across the island comes later. Kevin dropped the spiral as messy and asked for a shape real island railways use.
- **Details settled the same day:**
  - A hill tram links the main station to the tower, like Hong Kong's Peak Tram.
  - BookFlow gets its own building, a print works, so the island has 15 project buildings.
  - Buildings rise along the line, stop 1 to stop 15, until Kevin sends real start dates.
  - Roads for cars: a coast road beside the metro, a street to every building, a winding road up the hill.
  - Island life: boats, a ferry, a lighthouse, a beach with umbrellas, and animals.
  - Kevin kept the island size from the rough model ("keep it as it is").
  - Every building is modelled in Blender with real detail. The working site is built at this layout first.
  - Level 5 bars (any one): 1,000 subscribers, 100,000 views, 1,000 users or 1,000 sales. Kevin can change them in `designs/city/city-data.js`.
- **Open:** the order the projects were made; real user and sales numbers.

## 2026-11-21 — Island city: the visitor must see the building on arrival
- **Question:** after a ride the project page covered the screen at once, so nobody saw the building. What should arrival look like?
- **Decision:** the doors open, the view settles on that project's building for a moment, and then the page comes in beside it (a side panel on desktop, a sheet under it on phones). The page can be expanded to full screen or tucked away. This replaces "a full project page fills the screen".
- **Also decided:** visitors can pan, zoom and rotate more freely and click anything to look at it, within limits. The tower is rebuilt to match the reference picture. Trains, the hill tram, trees, the sea and the buildings get a more real look.
- **Why:** Kevin, after trying the first working version: "they're not able to actually look at that building", and the tower "does not look like the reference picture we had in mind".

## 2026-11-21 — Island city style: a future city on an island
- **Question:** what should the buildings look like?
- **Decision:** futuristic and simple, built from clear shapes (domes, capsules, rings, smooth shells), round where round. White and glass with each town's colour as an accent. Trains, tram, houses and street furniture follow the same style. Trees, animals, sand and sea stay natural.
- **Why:** Kevin: "kind of like what a Disney futuristic house looks like… like a future city on an island, that's the overall goal." This replaces the brick-and-tile realism I had asked the model builder for an hour earlier.
- **Limit:** take the general "city of tomorrow" idea only; no copy of a specific existing building or film design.

## 2026-11-21 — Island city: five towns, one station each, a metro that works like a real one
- **Question:** the 15 buildings sat evenly round a ring and looked too small. How should a real island be laid out?
- **Decision:**
  - Each kind of work is a town with its own station: Harbour town (Software, the main station), Garden village (Books), North shore (Film), Lighthouse point (Healthcare), Beach town (Games). Open land between them.
  - The coast gets a bay, a headland and a beach. The island is smaller (about 560 m wide) so buildings read bigger.
  - The metro is one double-track loop run like Taipei's or a Japanese loop line: trains both ways, stopping at every station with doors lined up to platform gates, station codes K1 to K5, name boards, next-train boards. The hill tram is a separate short line that connects at the Harbour.
  - **This replaces the rule of 2026-11-20** that every project adds a station. New rule: a project adds a building in its town; a new kind of work adds a town and a station.
- **Why:** Kevin: "they just put them in a circle"; "each category of thing I do is like a town and then it will have its own station"; "it should be like an actual system that would work, like how Taiwan has it… or like how Japan does it."

## 2026-11-21 — Island city: the metro has no track
- **Question:** how can the trains and track look more futuristic?
- **Decision:** no track at all. The trains fly along an invisible lane marked by dots of light and floating rings. It still runs like a real system: two directions, five stations, doors lined up with platform gates. The hill tram becomes a small flying pod in the same style.
- **Options turned down:** a slim glide beam (my recommendation, because the route stays visible) and a glass tube.
- **Guard against getting lost:** the lane of lights is always faintly visible and brightens when the visitor uses the line strip or rides.
- **Why:** Kevin picked it from three sketches (`docs/designs/city-style/transit-options.html`): "we could get rid of the tracks themselves… it might look better."
- **Cars and tram (Kevin agreed the same day):** the hill tram is a small flying glass pod; cars keep their roads and wheels and get a rounder future shape.

## 2026-11-21 — Island city: the land gets a real town plan
- **Question:** roads ran to each building one by one, buildings overlapped, and nothing felt like a neighbourhood. How should the land be organised?
- **Decision:** a dedicated town-planning builder owns the layout. It writes one layout file (`designs/city/plan.js`) that the 3D scene draws from, plus a checker that fails on any overlap, any item off the land, any road that isn't connected, and any building that can't be reached on foot from its station.
  - Roads in ranks: one coast road, a main street per town, side streets that form blocks, short lanes. No private drive per building.
  - Each town is zoned: station square, project plots on the square or main street, a neighbourhood of houses in rows, reserved plots. The harbour adds a port zone; the hill stays protected green.
  - Principles are taken from how Hong Kong's station-centred new towns and small islands, and Taiwan's coastal towns, are organised.
- **Why:** Kevin: "It should be like an organized city on the island. You can look at Hong Kong, you can look at Taiwan."

## 2026-11-21 — Island city: Kevin approved the town plan
- **Question:** is the planner's layout right, including three sizes it changed to make things fit?
- **Decision:** approved as drawn ("looks good"). The island is 601 m by 420 m, buildings are placed at 90% size, each town has one spare plot, and there are 19 houses.
- **Why:** plots big enough for each building's largest level did not fit on a 560 m island. The plan passes its checker with 0 problems, including the growth tests.
- **Noted but not asked for:** I flagged a boxy coast, Harbour town and Garden village touching, few houses and a narrow beach. Kevin did not ask for changes, so they stay as they are.
- **Map:** `docs/designs/city-style/island-town-plan.png`.

## 2026-11-22 — Island city goes live at its own link first
- **Question:** when we deploy, what does kevinpeiyuanyu.com show?
- **Decision:** the home page stays as it is. The island city is live at `kevinpeiyuanyu.com/designs/city/`. It becomes the home page after Kevin has tried it on a real phone.
  - `main` holds the city commit only. The reworked five-look home page stays on `redesign/five-designs` and is not live.
  - `.vercelignore` keeps `tools/`, `docs/`, `designs/_archive/` and `PRODUCT.md` off the live site. Test screenshots and Blender previews stay out of git.
- **Why:** the city is not yet tested on a real phone, Safari or a weak laptop, so the home page should not depend on it yet.

## 2026-11-22 — The reworked home page goes live too
- **Question:** the "Editorial" link in the city's Designs menu opened the old home page, not the one we built. Put the reworked home page live?
- **Decision:** yes. kevinpeiyuanyu.com is now the reworked portfolio and résumé page (five looks, Editorial by default). The island city stays at `/designs/city/`. This replaces the "home page stays as it is" part of the entry above.
- **Why:** Kevin: the editorial one "doesn't look like it's the one that we were working on". `main` and `redesign/five-designs` are now the same.
