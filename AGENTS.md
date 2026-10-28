# AGENTS.md

Context for coding agents working on Night City. Read this first. The [README](README.md) explains the project for people. This file covers what an agent needs to keep the work consistent.

## What this project is

Night City is a set of generative browser scenes that run forever and never repeat. Each scene is a small set of rules fed by one seeded random generator. Nothing is a stored clip and nothing loops.

The real goal behind it is a scene of two people playing basketball on an empty court forever, with no movement ever repeating. Pixel City tested that theory on a simpler scene, and Half Court (`basketball-court/`) is the first version of the basketball scene itself. Plans for future scenes live in `plan/`, which is gitignored. Read it for context, but never commit it or mention its contents in public files.

Owner: Kumar Anirudha (GitHub `anistark`, X `kranirudha`). Repo: `github.com/anistark/nightcity`, branch `main`.

## Layout

```
index.html            landing page: the scenes, each with a live preview
license.html          renders LICENSE in the theme
404.html              catch-all page with a procedural moonlit beach
manifest.webmanifest  PWA manifest
sw.js                 service worker (stays at the root so it can cache the whole site)
embed.js              one-line installer for embedding a scene (stays at the root: its URL is published)
assets/
  css/  site.css (root pages), scene-ui.css (shared scene controls)
  js/   site.js (stars), beach.js (404 scene), pwa.js (registers sw.js), scene-ui.js (shared scene controls)
  images/  logo.png, favicon.png, og.jpg, icons/ (PWA icons)
pixel-city/           a scene: index.html, README.md, assets/{css/style.css, js/main.js, images/logo.svg, images/og.jpg}
basketball-court/     Half Court, same layout
rain-window/          Rain Window, same layout
README.md  CONTRIBUTING.md  AGENTS.md  CLAUDE.md  LICENSE  justfile
plan/                 private planning notes and tools, gitignored
.claude/launch.json   preview server config for the Claude desktop app, runs `just serve`
```

Every scene follows the same layout: `index.html` and `README.md` at the top of its folder, and its own `assets/css`, `assets/js` and `assets/images`. Scenes load the shared controls from `../assets/`. Scene folder names are their public URLs, so don't rename them.

Notes on the pieces:

- **Logo:** `assets/images/logo.png` is a hooded cyberpunk character in sunglasses with yellow and cyan neon trim, supplied by the owner as a transparent PNG. It is 512px and shows in the nav. `favicon.png` is 64px for the browser tab. Earlier drafts and the scripts that made the Pixel City logo, the app icons and the old avatars are in `plan/logo-drafts/`.
- **Shared scene controls:** `scene-ui.js` and `scene-ui.css` add a back link (bottom left), and share and fullscreen buttons (top right, `F` for fullscreen). Share opens a dialog with the link and a copy button, social buttons, and a separate Embed button with snippets per platform. Each scene loads `scene-ui.js` with `data-scene` and `data-text` set.
- **Share previews:** `assets/images/og.jpg` and each scene's `assets/images/og.jpg` are 1200x630, referenced by the Open Graph and Twitter tags in every page's `<head>`. Rebuild them with the private `plan/og-compose.html` and headless Chrome. A new scene needs its own `og.jpg` and tags.
- **Half Court debugging:** `?speed=8`, and `?debug` exposes `window.HC` with `run()`, `step()` and `testShot()`.
- **Rain Window debugging:** `?speed=8`, and `?debug` exposes `window.RW` with `run()`, `step()`, `draw()` and `fire()`.
- **Embed mode:** every scene supports `?embed`: no overlay or controls, no wake lock, lower resolution and about 30 fps unless `&q=high`. It listens for `postMessage({nightcity:'pause'})` and `{nightcity:'play'}`, and exposes `window.nightcity.step(dt)` for frame-exact recordings. A new scene needs the same.

The nav and footer markup is copied into `index.html`, `license.html` and `404.html`. A change to one must go into all three.

The site is a PWA. `sw.js` fetches from the network first and falls back to its cache, so changes show up without a hard reload, and the site opens offline. Every file it precaches is listed in `CORE` in `sw.js`. When you add, move or rename a page, script, style or scene file, update `CORE` and bump `CACHE` (for example `nightcity-v6` to `nightcity-v7`), or it won't be there offline. Root pages link the manifest and load `assets/js/pwa.js`.

Contributors follow [CONTRIBUTING.md](CONTRIBUTING.md). Each scene's author is credited in the README's scenes table, as a link to their GitHub profile. A bare `@username` is not linked in rendered files, only in issues and pull requests.

## Rules for scenes

- **No build, no libraries.** Plain HTML, CSS and Canvas 2D, and no image files beyond logos and avatars. A scene must open by double-clicking its `index.html`.
- **One folder per scene,** laid out as above, with a `logo.svg` in `assets/images`. Scene logos are 16×16 pixel art in the scene palette, written as one SVG path per colour with `shape-rendering="crispEdges"`. Only the umbrella Night City logo is an illustration. Add it to the scenes list on the landing page and to the table in the root README, with its author in the By column.
- **One seed from the clock.** Hash the page-open time, formatted `YYYY-MM-DD HH:MM:SS.mmm`, with `cyrb128` into `sfc32`. Every choice in a scene comes from that generator, never from `Math.random`. Copy the generator from `pixel-city/assets/js/main.js` so all scenes match. Show the seed somewhere in the scene.
- **Events on independent timers** with exponentially distributed gaps, so there are bursts and lulls instead of a beat.
- **Variation inside every event** from continuous ranges, plus slow drift from smooth noise.
- **Pixel art, mostly.** Pixel City draws at low resolution and scales up with `image-rendering: pixelated`. Half Court and Rain Window are the exceptions: the owner asked for them to look as realistic as possible, so they draw smooth geometry at full device resolution. Its players wear streetwear inspired by the logo, and their feet plant on the floor instead of sliding.
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
- **Icons:** the nav uses a `?` box for How it works. The footer has GitHub and X icon buttons, then one line: copyright mark, year and name, MIT License (linking to `license.html`), and the Pixelspace credit.
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

This serves the project at http://localhost:8765. `just serve pixel-city` serves one folder. Opening a page from disk also works, except that the license page can't fetch `LICENSE` and links to GitHub instead.

Before calling a visual change done, check it in a browser at 375px, 1024px and 1600px wide: no sideways scroll, no console errors, and reduced motion still works.

`404.html` adds a `<base>` element pointing at the site root, so its relative links work at any missing path. On a `*.github.io` project site that root is the first path segment. While the page loads, the browser makes a few harmless early requests relative to the missing path before the base takes effect.

## Licensing

The code is MIT, © 2026 Kumar Anirudha. All fonts used are under the SIL Open Font License.
