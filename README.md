# kevinsPSW

Kevin Yu's personal website: a one-person company staffed by AI agents, with the work and the system behind it.

It is a static site with no build step:

- `index.html` holds all content
- `assets/css/main.css` holds the design tokens (light and dark), layout and component styles
- `assets/js/main.js` holds the motion: the hero entrance, the company map, the pinned "How I work" sequence, the card loops, the project filters and smooth scrolling
- `assets/css/noir.css` and `assets/js/noir.js` draw the Noir Hours city and run its sample player
- `assets/css/contact.css` and `assets/js/contact.js` style the contact section and its copy button
- `newsletter/` is the Daily AI archive and one page per issue, generated from `newsletter/issues.json` by `tools/build_newsletter.py`; `assets/css/newsletter.css` and `assets/js/newsletter.js` style it and run the English / 中文 switch, topic filters and search
- `assets/vendor/` contains GSAP 3.13 (with ScrollTrigger and Flip) and Lenis 1.1, vendored so the site has no CDN dependency

## Run locally

```bash
npx serve .
# or
python3 -m http.server 8000
```

## Deploy

Live at https://kevinpeiyuanyu.com (Vercel, deployed from `main`). The canonical URL, share image (`assets/og-image.png`), `robots.txt` and `sitemap.xml` all point at that domain.

Any static host works.

- **GitHub Pages:** Settings → Pages → Deploy from a branch → `main` / root.
- **Vercel or Netlify:** import the repo, set no framework, no build command and `.` as the output directory.

## Editing content

All copy lives in `index.html`. The page reads in chapters: 01 Who I am (`#about`), 02 How I work (`#how`, `#build`), 03 What I do (`#work`, `#noir`, `#lanes`), 04 What I write (`#newsletter`), 05 Toolbox (`#stack`, `#learning`) and 06 Contact. A section without its own nav link names its chapter's link in `data-nav`, so the nav highlight follows it.

Lanes are the `<li class="lane">` rows: set `data-status` to `live`, `progress` or `done` and update the counts on the filter buttons. To link a book on the KDP shelf, give its spine a `data-asin` and wrap the title in an Amazon link, like the Cozy Thanksgiving spine. The cover pops out automatically when Amazon has one. The YouTube films are the `.pl-item` buttons: set `data-yt` to the video ID.

The company map under the hero is plain HTML cards in `[data-sys]`, each with a `data-node` id. The wires between them come from `EDGES` in the company map code in `assets/js/main.js`, and the caption text from `INFO` beside it.

Noir Hours samples live in `assets/audio/`. Add one with an `<li data-src="assets/audio/file.mp3" data-title="Title" data-art="assets/audio/cover.jpg">` inside `<ol data-noir-tracks>`. Keep the files on this site so the city can react to the music.

### Newsletter

Each issue is one entry in `newsletter/issues.json`: `date`, `no`, `topic` (`policy`, `safety`, `agents`, `models` or `chips`) and an `en` and/or `zh` block with a `title`, a `dek` (the one-line summary) and `stories`. Each story has a headline `h`, `body` paragraphs (`{"p": "..."}` or list items `{"li": "..."}`, in light Markdown: links, bold, italics) and `sources` (`{"t": "Reuters, Oct 13", "u": "https://..."}`). After editing, run:

```bash
python3 tools/build_newsletter.py
```

It rewrites `newsletter/index.html`, every `newsletter/<date>/index.html`, the home-page section between the `NEWSLETTER:START` and `NEWSLETTER:END` markers in `index.html`, and `sitemap.xml`. The issues came from the Daily AI Newsletter database in Notion; its "Blog angle" notes are post ideas and are left off the site.

The X card in the contact section is commented out. Put the handle in and remove the two comment lines to show it.

Motion respects `prefers-reduced-motion`, and every animated element rests in its finished state in the HTML, so the page reads correctly even before the scripts run.
