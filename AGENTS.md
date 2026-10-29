# AGENTS.md

Context for coding agents working on Night City. Read this first. The [README](README.md) explains the project for people. This file covers what an agent needs to keep the work consistent.

## What this project is

Night City is a set of generative browser scenes that run forever and never repeat. Each scene is a small set of rules fed by one seeded random generator. Nothing is a stored clip and nothing loops.

The real goal behind it is a scene of two people playing basketball on an empty court forever, with no movement ever repeating. Pixel City tested that theory on a simpler scene, and Half Court (`basketball-court/`) is the first version of the basketball scene itself. Plans for future scenes live in `plan/`, which is gitignored. Read it for context, but never commit it or mention its contents in public files.

Owner: Kumar Anirudha (GitHub `anistark`, X `kranirudha`). Repo: `github.com/anistark/nightcity`, branch `main`.

## Layout

The site is built with Eleventy 3 into `_site/` (gitignored). Scenes stay plain JavaScript and Canvas 2D, and Eleventy only builds the pages around them.

```
index.njk             landing page: the scenes, each with a live preview, cards generated from the scenes collection
license.njk           renders LICENSE in the theme at build time, built at /license/
404.njk               catch-all page with a procedural moonlit beach, built at /404.html
redirect.njk          a forwarding page for each entry in _data/redirects.json (license.html goes to license/)
_includes/layouts/    site.njk (root pages), scene.njk (scene page with the overlay), embed.njk (scene alone)
_includes/partials/   head.njk (meta and share tags), nav.njk, footer.njk
_data/                site.json (name, URL, share defaults), license.js, redirects.json
eleventy.config.js    passthrough copies, the root filter, the scenes collection, and writing sw.js's file list after each build
scripts/check-links.js  fails on broken internal links and on links to .html pages, run by `just check` and CI
manifest.webmanifest  PWA manifest
sw.js                 service worker source: the build fills in CORE and CACHE (stays at the root so it can cache the whole site)
embed.js              one-line installer for embedding a scene (stays at the root: its URL is published)
assets/
  css/  site.css (root pages), scene-ui.css (shared scene controls)
  js/   site.js (stars), beach.js (404 scene), pwa.js (registers sw.js), nightcity.js (shared scene runtime), scene-ui.js (shared scene overlay)
  images/  logo.png, favicon.png, og.jpg, icons/ (PWA icons)
pixel-city/           a scene: pixel-city.11tydata.json, index.njk, embed.njk, README.md, assets/{css/style.css, js/main.js, images/logo.svg, images/og.jpg}
basketball-court/     Half Court, same layout
rain-window/          Rain Window, same layout
.github/              pages.yml (build and deploy on push to main), check.yml (build and link check on pull requests), dependabot.yml
README.md  CONTRIBUTING.md  AGENTS.md  CLAUDE.md  LICENSE  justfile  package.json  .nvmrc
plan/                 private planning notes and tools, gitignored
.claude/launch.json   preview server config for the Claude desktop app, runs `just serve`
```

Every page lives at a folder URL with no `.html`: `/`, `/license/`, `/rain-window/`, `/rain-window/embed/`. Links point at folders, never at `index.html` or other `.html` files, except `404.html`, which GitHub Pages requires. A page that moves gets an entry in `_data/redirects.json`.

Every scene follows the same layout: a data file named after the folder, `index.njk` and `embed.njk` (one line each, extending the layouts), `README.md`, and its own `assets/css`, `assets/js` and `assets/images`. The data file holds the title, descriptions, share text, canvas label, log counters, landing card text and `order`. Scene folder names are their public URLs, so don't rename them.

Notes on the pieces:

- **Logo:** `assets/images/logo.png` is a hooded cyberpunk character in sunglasses with yellow and cyan neon trim, supplied by the owner as a transparent PNG. It is 512px and shows in the nav. `favicon.png` is 64px for the browser tab. Earlier drafts and the scripts that made the Pixel City logo, the app icons and the old avatars are in `plan/logo-drafts/`.
- **Shared scene runtime:** `nightcity.js` holds what every scene needs: the seeded generator and helpers (`NightCity.R`, `rr`, `pick`, `noise` and so on), the frame loop (`NightCity.run({update, draw, step, ui, still})`), reduced motion, `?speed`, embed mode and the wake lock. Scenes report with `NightCity.log(text)` and `NightCity.stats({...})`. Moving code into it must not change the order a scene draws random numbers in, or the same seed makes a different scene.
- **Shared scene overlay:** `scene.njk` renders the title, clock, log panel and page-icon log button. `scene-ui.js` and `scene-ui.css` wire them up (the clock's colon blinks once a second, `L` for the log, `H` or a click hides the overlay), then add a back link (bottom left), and share and fullscreen buttons (top right, `F` for fullscreen). Share opens a dialog with the link and a copy button, social buttons, and a separate Embed button with snippets per platform. Each scene styles the overlay in its own `style.css`.
- **Share previews:** `assets/images/og.jpg` and each scene's `assets/images/og.jpg` are 1200x630, referenced by the Open Graph and Twitter tags that `head.njk` writes from each page's data. Rebuild them with the private `plan/og-compose.html` and headless Chrome. A new scene needs its own `og.jpg`.
- **Half Court debugging:** `?speed=8`, and `?debug` exposes `window.HC` with `run()`, `step()` and `testShot()`.
- **Rain Window debugging:** `?speed=8`, and `?debug` exposes `window.RW` with `run()`, `step()`, `draw()` and `fire()`.
- **Embed mode:** every scene has an `embed/` page with only the canvas and its scripts, which `embed.js` and the share snippets use. `?embed` on the full page still works for older embeds. Either way: no overlay or controls, no wake lock, lower resolution and about 30 fps unless `q=high`. `nightcity.js` listens for `postMessage({nightcity:'pause'})` and `{nightcity:'play'}`, and exposes `window.nightcity.step(dt)` for frame-exact recordings.

The head tags, nav and footer live once in `_includes/partials/` and appear on every root page.

The site is a PWA. `sw.js` fetches from the network first and falls back to its cache, so changes show up without a hard reload, and the site opens offline. After each build, `eleventy.config.js` fills `CORE` with every built file (folder URLs for pages, skipping share images and forwarding pages) and sets `CACHE` from a hash of their contents, so there is nothing to update by hand. Root pages link the manifest and load `assets/js/pwa.js`.

GitHub Pages deploys from GitHub Actions (`pages.yml`), not from the branch. Pull requests run `check.yml`. Dependabot opens weekly updates for the pinned actions and Eleventy.

Contributors follow [CONTRIBUTING.md](CONTRIBUTING.md). Each scene's author is credited in the README's scenes table, as a link to their GitHub profile. A bare `@username` is not linked in rendered files, only in issues and pull requests.

## Rules for scenes

- **No libraries in scenes.** Plain JavaScript, CSS and Canvas 2D, and no image files beyond logos and avatars. Eleventy builds the pages, never the scene code.
- **One folder per scene,** laid out as above, with a `logo.svg` in `assets/images`. Scene logos are 16×16 pixel art in the scene palette, written as one SVG path per colour with `shape-rendering="crispEdges"`. Only the umbrella Night City logo is an illustration. The landing page card comes from its data file. Add it to the table in the root README, with its author in the By column, and to `SCENES` in `embed.js`.
- **One seed from the clock.** `nightcity.js` hashes the page-open time, formatted `YYYY-MM-DD HH:MM:SS.mmm`, with `cyrb128` into `sfc32`. Every choice in a scene comes from that generator, never from `Math.random`. The overlay shows the seed in the log.
- **Events on independent timers** with exponentially distributed gaps, so there are bursts and lulls instead of a beat.
- **Variation inside every event** from continuous ranges, plus slow drift from smooth noise.
- **Pixel art, mostly.** Pixel City draws at low resolution and scales up with `image-rendering: pixelated`. Half Court and Rain Window are the exceptions: the owner asked for them to look as realistic as possible, so they draw smooth geometry at full device resolution. Half Court's players wear streetwear inspired by the logo, and their feet plant on the floor instead of sliding.
- **Reduced motion.** Respect `prefers-reduced-motion` and show a still frame instead.
- **Keep it light.** Cache static layers off-screen. Check that the scene holds about 60 fps.

## Design rules for the site pages

- **Dark only.** It's a night look by design. The colour tokens are on `:root` in `assets/css/site.css` and match Pixel City's `assets/css/style.css`. The accent is amber `#ffcf7a`.
- **Font:** Pixelspace, the owner's own pixel typeface, loaded from `https://pixelspace.anirudha.dev/pixelspace-font.css` (the font is embedded, so it works offline once cached). Pixel City's overlay still uses Silkscreen and VT323 from Google Fonts.
- **Font sizes are multiples of 8px only** (16, 24, 32, 48, 64), or the pixel glyphs blur. The one exception is Rain Window's log panel at 12px, which the owner chose. Body text is 16px, the intro paragraph 24px from 640px up. The owner found a larger step too big, so don't raise sizes without being asked.
- **Pixelspace is ASCII only.** No `©`, `·`, curly quotes or other non-ASCII text, because they fall back to another font. Use an inline pixel SVG instead, like the copyright mark in the footer.
- **No max widths on landing page text.** Content spans the window with a 16px side gutter. The scene cards keep their own internal layout.
- **Scene grid:** one column below 1200px, two columns from 1200px.
- **No underlines on links,** including on hover. Show hover with colour or a border.
- **Icons:** the nav uses a `?` box for How it works. The footer has GitHub and X icon buttons, then one line: copyright mark, year and name, MIT License (linking to `license/`), and the Pixelspace credit.
- **The LICENSE link on the license page goes to `github.com/anistark/nightcity/blob/main/LICENSE`,** not the local file, which downloads instead of opening.

## Writing style

This applies to READMEs, page copy, comments and commit messages.

- No em dashes or en dashes. Recast the sentence, or use a hyphen for ranges.
- No semicolons in prose.
- No hard-wrapped prose in Markdown. Write one paragraph per line.
- Keep it plain and concise, and describe the project as it is now. Plans go in `plan/`, not in READMEs.

## Running and checking

```sh
just serve
```

Run `npm install` once (Node 24, from `.nvmrc`). `just serve` builds the site and serves it at http://localhost:8765 with Eleventy's dev server, rebuilding on every change and serving `404.html` for missing paths. `just build` builds once. `just check` builds and runs the link check. Pages link to folders, so the built files don't open from disk.

Before calling a change done, run `just check`. For a visual change, also check it in a browser at 375px, 1024px and 1600px wide: no sideways scroll, no console errors, and reduced motion still works.

`404.njk` adds a `<base>` element pointing at the site root, so its relative links work at any missing path. On a `*.github.io` project site that root is the first path segment. While the page loads, the browser makes a few harmless early requests relative to the missing path before the base takes effect.

## Licensing

The code is MIT, © 2026 Kumar Anirudha. All fonts used are under the SIL Open Font License.
