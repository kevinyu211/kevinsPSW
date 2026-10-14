# kevinsPSW

Kevin Yu's personal website: a one-person company staffed by AI agents, with the work and the system behind it.

It is a static site with no build step:

- `index.html` holds all content
- `assets/css/main.css` holds the design tokens (light and dark), layout and component styles
- `assets/js/main.js` holds the motion: the hero entrance, the live Company OS diagram, the pinned "How it runs" sequence, the card loops, the lane filters and smooth scrolling
- `assets/vendor/` contains GSAP 3.13 (with ScrollTrigger and Flip) and Lenis 1.1, vendored so the site has no CDN dependency

## Run locally

```bash
npx serve .
# or
python3 -m http.server 8000
```

## Deploy

Any static host works.

- **GitHub Pages:** Settings → Pages → Deploy from a branch → `main` / root.
- **Vercel or Netlify:** import the repo, set no framework, no build command and `.` as the output directory.

## Editing content

All copy lives in `index.html`. Lanes are the `<li class="lane">` rows: set `data-status` to `live`, `progress` or `done` and update the counts on the filter buttons. The hero diagram's agents and lanes are the `AGENTS` and `LANES` arrays near the top of `assets/js/main.js`.

Motion respects `prefers-reduced-motion`, and every animated element rests in its finished state in the HTML, so the page reads correctly even before the scripts run.
