# AGENTS.md

Context for coding agents working on Night City. Read this first. The [README](README.md) explains the project for people. This file covers what an agent needs to keep the work consistent.

## What this project is

Night City is a set of generative browser scenes that run forever and never repeat. Each scene is a small set of rules fed by one seeded random generator. Nothing is a stored clip and nothing loops.

The real goal behind it is a scene of two people playing basketball on an empty court forever, with no movement ever repeating. Pixel City tested that theory on a simpler scene, and Half Court (`basketball-court/`) is the first version of the basketball scene itself. Plans for future scenes live in `plan/`, which is gitignored. Read it for context, but never commit it or mention its contents in public files.

Owner: Kumar Anirudha (GitHub `anistark`, X `kranirudha`). Repo: `github.com/anistark/nightcity`, branch `main`.

## Layout

| Path | What it is |
|---|---|
| `index.html` | Landing page. Lists the scenes, each with a live preview in an iframe |
| `license.html` | Fetches `LICENSE` and renders it in the theme |
| `404.html`, `beach.js` | Catch-all page with a procedural moonlit beach |
| `site.css` | Shared styles for the three root pages |
| `site.js` | Twinkling star background for the landing and license pages |
| `logo.png`, `favicon.png` | Night City logo: a hooded cyberpunk character in sunglasses with yellow and cyan neon trim, supplied by the owner as a transparent PNG. `logo.png` is 512px and shows in the nav. `favicon.png` is 64px for the browser tab. Earlier SVG drafts, and the script that generated the Pixel City pixel logo from a grid (`logos.py`), are in `plan/logo-drafts/` |
| `manifest.webmanifest`, `sw.js`, `pwa.js`, `icons/` | PWA: the manifest, the service worker, its registration, and app icons made from `logo.png` on the night background (`plan/logo-drafts/make_icons.swift` regenerates them) |
| `scene-ui.js`, `scene-ui.css` | Shared scene controls: back link (bottom left), fullscreen (top right, `F`), and a share button beside Log that opens a dialog of share options. Each scene loads them with `data-text` set to its share message |
| `justfile` | `just serve [dir] [port]` serves over HTTP and returns `404.html` for missing paths |
| `pixel-city/` | The Pixel City scene: `index.html`, `style.css`, `main.js`, `logo.svg`, its own README |
| `basketball-court/` | The Half Court scene: one-on-one basketball in isometric view, drawn smooth at full resolution. Same file set as Pixel City. Outfits vary per seed, the logo's hooded look is one of them, and each avatar is drawn from the player's outfit. `?speed=8` and `?debug` (exposes `window.HC` with `run()` and `testShot()`) help when tuning it |
| `plan/` | Private planning notes, gitignored |
| `.claude/launch.json` | Preview server config for the Claude desktop app, runs `just serve` |

The nav and footer markup is copied into `index.html`, `license.html` and `404.html`. A change to one must go into all three.

The site is a PWA. `sw.js` fetches from the network first and falls back to its cache, so changes show up without a hard reload, and the site opens offline. Every file it precaches is listed in `CORE` in `sw.js`. When you add a page, script or scene file, add it to `CORE` and bump `CACHE` (`nightcity-v1` to `nightcity-v2`), or it won't be there offline. Root pages link the manifest and load `pwa.js`.

## Rules for scenes

- **No build, no libraries.** Plain HTML, CSS and Canvas 2D, and no image files beyond logos and avatars. A scene must open by double-clicking its `index.html`.
- **One folder per scene** with `index.html`, `README.md` and a `logo.svg`. Scene logos are 16×16 pixel art in the scene palette, written as one SVG path per colour with `shape-rendering="crispEdges"`. Only the umbrella Night City logo is an illustration. Add it to the scenes list on the landing page and to the table in the root README.
- **One seed from the clock.** Hash the page-open time, formatted `YYYY-MM-DD HH:MM:SS.mmm`, with `cyrb128` into `sfc32`. Every choice in a scene comes from that generator, never from `Math.random`. Copy the generator from `pixel-city/main.js` so all scenes match. Show the seed somewhere in the scene.
- **Events on independent timers** with exponentially distributed gaps, so there are bursts and lulls instead of a beat.
- **Variation inside every event** from continuous ranges, plus slow drift from smooth noise.
- **Pixel art, mostly.** Pixel City draws at low resolution and scales up with `image-rendering: pixelated`. Half Court is the exception: the owner asked for it to look as realistic as possible, so it draws smooth geometry at full device resolution. Its players wear streetwear inspired by the logo, and their feet plant on the floor instead of sliding.
- **Reduced motion.** Respect `prefers-reduced-motion` and show a still frame instead.
- **Keep it light.** Cache static layers off-screen. Check that the scene holds about 60 fps.

## Design rules for the site pages

- **Dark only.** It's a night look by design. The colour tokens are on `:root` in `site.css` and match Pixel City's `style.css`. The accent is amber `#ffcf7a`.
- **Font:** Pixelspace, the owner's own pixel typeface, loaded from `https://pixelspace.anirudha.dev/pixelspace-font.css` (the font is embedded, so it works offline once cached). Pixel City's overlay still uses Silkscreen and VT323 from Google Fonts.
- **Font sizes are multiples of 8px only** (16, 24, 32, 48, 64), or the pixel glyphs blur. Body text is 16px, the intro paragraph 24px from 640px up. The owner found a larger step too big, so don't raise sizes without being asked.
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
