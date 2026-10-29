# Contributing to Night City

Thanks for helping out. Night City is a growing set of generative night scenes that run forever and never repeat. New scenes are the most welcome contribution, and fixes, performance work and ideas are welcome too.

For a small fix, open a pull request straight away. For a new scene or a bigger change, open an issue first with a sentence or two about the idea, so nobody builds the same thing twice.

## Run it

The site is built with [Eleventy](https://www.11ty.dev). You need Node 24 (the version is in `.nvmrc`) and [just](https://github.com/casey/just):

```sh
npm install
just serve
```

This builds the site and serves it at http://localhost:8765, rebuilding whenever a file changes. `just build` writes the site to `_site/` once, and `just check` builds it and checks that every internal link resolves, the same check every pull request runs.

Pages link to folders, like `rain-window/`, so opening the built files straight from disk doesn't work. Always use `just serve`.

## Layout

```
index.njk  license.njk  404.njk       the site pages
_includes/layouts/                    site.njk (site pages), scene.njk (a scene page), embed.njk (a scene on its own)
_includes/partials/                   head tags, nav and footer
_data/                                site.json (name, URL, share defaults), redirects.json (pages that moved)
redirect.njk                          builds a forwarding page for each moved page
eleventy.config.js                    what gets copied, and the sw.js file list
scripts/check-links.js                the link check
manifest.webmanifest  sw.js           the PWA (the build fills in sw.js's file list)
embed.js                              the one-line embed installer (its URL is public, so it stays at the root)
assets/
  css/     site.css, scene-ui.css
  js/      site.js, beach.js, pwa.js, nightcity.js (shared scene runtime), scene-ui.js (shared scene overlay)
  images/  logo.png, favicon.png, og.jpg, icons/
pixel-city/                           one scene
  pixel-city.11tydata.json            its title, share tags, log counters and landing card
  index.njk                           the scene page, built at /pixel-city/
  embed.njk                           the scene on its own, built at /pixel-city/embed/
  README.md
  assets/
    css/style.css
    js/main.js
    images/logo.svg, og.jpg
basketball-court/                     Half Court, same layout
rain-window/                          Rain Window, same layout
shoreline/                            Shoreline, same layout
.github/                              workflows for deploying and checking, and Dependabot
```

Shared files live in the root `assets/` folder. Each scene keeps its own files in its own folder, with its code, styles and images in `assets/`. A scene's folder name is its public URL, so existing folders are never renamed.

## Add a scene

### The rules

- **No libraries.** Plain JavaScript and Canvas 2D in the browser. Eleventy only builds the pages around the scene. Draw everything in code, with no image files beyond the logo and the share preview.
- **One seed from the clock.** `assets/js/nightcity.js` seeds one generator from the moment the page opens and shares it as `NightCity.R`, with helpers like `rr`, `pick`, `chance`, `expo` and `noise`. Every random choice comes from it, never from `Math.random`. The overlay shows the seed in the log.
- **Nothing loops.** Each kind of event waits on its own timer with exponentially distributed gaps, so the scene has bursts and lulls instead of a beat. Vary every event from continuous ranges, and let smooth noise drift the overall mood over minutes.
- **Reduced motion.** Respect `prefers-reduced-motion` and show a still frame instead.
- **Keep it light.** Cache static layers off screen and check that the scene holds about 60 fps on an ordinary laptop.

### The shared runtime

A scene's `main.js` holds only its world. The shared runtime and the scene layout handle the rest:

- **The overlay.** The layout renders the title, the clock, the log panel and the log button from the scene's data file, and `scene-ui.js` adds back, share, fullscreen and the embed snippets. Report events with `NightCity.log(text)` and counters with `NightCity.stats({...})`, using the keys listed in the data file's `stats`.
- **The frame loop.** Start the scene with `NightCity.run({update, draw, step, ui})`. `step` is a fixed substep in seconds (`1/60`), or leave it out to get each frame's own time. `ui` refreshes overlay parts only your scene has, like Half Court's score. The loop handles reduced motion (one still frame, unless you pass `still:false`), `?speed`, the low-quality embed mode, pause and play from a host page, `window.nightcity.step(dt)` for frame-exact recordings, and the wake lock.
- **Embeds.** The scene's `embed/` page runs it with no overlay, at a lower resolution and about 30 fps unless `?q=high` is set. Keep `main.js` working without the overlay in the page.

### Checklist

1. Create a folder at the root named after the scene in kebab case, for example `night-train/`, with `README.md`, `assets/css/style.css`, `assets/js/main.js` and `assets/images/logo.svg`.
2. Add `night-train.11tydata.json`, copied from another scene, with `"tags": "scene"`, an `order`, the title, descriptions, share text, canvas label, log counters and landing card text.
3. Add `index.njk` with `{% extends "layouts/scene.njk" %}`, and `embed.njk` copied from another scene.
4. Make the logo 16×16 pixel art in the scene's palette: one SVG path per colour with `shape-rendering="crispEdges"`. The layout uses it as the favicon.
5. Add a 1200x630 share preview at `assets/images/og.jpg`.
6. Write the scene's `README.md`: what it shows, the files, and how it works.
7. Add the folder to `SCENES` in `embed.js`, and add it to the list of `data-scene` values in the root README's Embed section.
8. Add a row to the scenes table in the root `README.md`, with yourself in the By column (see below).

The landing page card and the offline cache come from the build, so there is nothing to add for those.

### Credit yourself

The scenes table in the root README credits each scene's author. Add your row with a link to your GitHub profile:

```md
| [Night Train](night-train/) | A sleeper train crossing the country at night: ... | [@yourname](https://github.com/yourname) |
```

Write the link out in full. GitHub turns a bare `@yourname` into a profile link in issues, pull requests and comments, but not in a rendered Markdown file like the README, where it stays plain text. If several people built a scene, list them all, separated by commas.

## Writing style

This applies to READMEs, page copy, code comments and commit messages:

- No em dashes or en dashes. Recast the sentence, or use a hyphen for a range.
- No semicolons in prose.
- No hard wraps in Markdown. Write each paragraph on one line.
- Keep it plain and concise, and describe what is there now. Plans and wish lists belong in issues.

## Before you open a pull request

- Run `just check`.
- Check the pages you touched in a browser at 375px, 1024px and 1600px wide: no sideways scroll, no console errors, and reduced motion still works.
- For a scene, check it on its own, inside the landing page card, and at its `embed/` page.
- Keep one change per pull request, and say in the description what changed and how you checked it. A short screen recording helps a lot for a new scene.

By contributing, you agree that your work is released under the project's [MIT License](LICENSE).
