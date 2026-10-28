# Contributing to Night City

Thanks for helping out. Night City is a growing set of generative night scenes that run forever and never repeat. New scenes are the most welcome contribution, and fixes, performance work and ideas are welcome too.

For a small fix, open a pull request straight away. For a new scene or a bigger change, open an issue first with a sentence or two about the idea, so nobody builds the same thing twice.

## Run it

There is no build step and nothing to install. Open `index.html` in a browser, or serve the project with [just](https://github.com/casey/just):

```sh
just serve
```

This serves everything at http://localhost:8765. `just serve pixel-city` serves one folder, and a second argument changes the port. Serving is closer to the live site than opening files from disk, because the service worker and the license page need HTTP.

## Layout

```
index.html  license.html  404.html    the site pages
manifest.webmanifest  sw.js           the PWA (sw.js stays at the root so it can cache the whole site)
embed.js                              the one-line embed installer (its URL is public, so it stays at the root)
assets/
  css/     site.css, scene-ui.css
  js/      site.js, beach.js, pwa.js, scene-ui.js
  images/  logo.png, favicon.png, og.jpg, icons/
pixel-city/                           one scene
  index.html
  README.md
  assets/
    css/style.css
    js/main.js
    images/logo.svg, og.jpg
basketball-court/                     Half Court, same layout
rain-window/                          Rain Window, same layout
```

Shared files live in the root `assets/` folder. Each scene keeps its own files in its own `assets/` folder, split into `css`, `js` and `images`. A scene's folder name is its public URL, so existing folders are never renamed.

## Add a scene

### The rules

- **No build, no libraries.** Plain HTML, CSS and Canvas 2D. The scene must open by double-clicking its `index.html`. Draw everything in code, with no image files beyond the logo and the share preview.
- **One seed from the clock.** Format the moment the page opens as `YYYY-MM-DD HH:MM:SS.mmm`, hash it with `cyrb128` and feed it into `sfc32`. Copy both from `pixel-city/assets/js/main.js` so every scene matches. Every random choice comes from that generator, never from `Math.random`. Show the seed somewhere in the scene.
- **Nothing loops.** Each kind of event waits on its own timer with exponentially distributed gaps, so the scene has bursts and lulls instead of a beat. Vary every event from continuous ranges, and let smooth noise drift the overall mood over minutes.
- **Reduced motion.** Respect `prefers-reduced-motion` and show a still frame instead.
- **Keep it light.** Cache static layers off screen and check that the scene holds about 60 fps on an ordinary laptop.

### Embed support

Every scene can run as a background on someone else's site, so a new one needs the same hooks as the existing ones. Copy them from any scene's `main.js`:

- `?embed` hides the overlay and controls, skips the wake lock, and draws at a lower resolution and about 30 fps unless `&q=high` is set.
- In embed mode the scene listens for `postMessage({nightcity:'pause'})` and `{nightcity:'play'}`.
- In embed mode it exposes `window.nightcity.step(dt)`, which pauses the scene and advances it by `dt` seconds, for frame-exact recordings.

### Checklist

1. Create a folder at the root named after the scene in kebab case, for example `night-train/`, with `index.html`, `README.md`, `assets/css/style.css`, `assets/js/main.js` and `assets/images/logo.svg`.
2. Make the logo 16×16 pixel art in the scene's palette: one SVG path per colour with `shape-rendering="crispEdges"`. Use it as the favicon.
3. Load the shared controls (back link, share, fullscreen, embed snippets) at the end of `index.html`, with your folder name and a share line, where `{seed}` becomes the scene's seed:

   ```html
   <link rel="stylesheet" href="../assets/css/scene-ui.css">
   <script src="../assets/js/scene-ui.js" data-scene="night-train" data-text="A night train that never runs the same way twice. Mine was seeded at {seed}." defer></script>
   ```

   They expect the scene's overlay to have `id="hud"`, a log button with `id="logBtn"` showing the page icon, and the seed shown in an element with `id="seed"`, as in the existing scenes.
4. Add a 1200x630 share preview at `assets/images/og.jpg`, and copy the Open Graph and Twitter tags from another scene's `<head>`, changing the title, description, URL and image.
5. Write the scene's `README.md`: what it shows, the files, and how it works.
6. Add a card to the scenes list in the root `index.html`, copied from an existing one.
7. Add every file of the scene to `CORE` in `sw.js` and bump `CACHE` by one (for example `nightcity-v6` to `nightcity-v7`), so the scene works offline.
8. Add the folder to `SCENES` in `embed.js`, and add it to the list of `data-scene` values in the root README's Embed section.
9. Add a row to the scenes table in the root `README.md`, with yourself in the By column (see below).

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

- Check the pages you touched in a browser at 375px, 1024px and 1600px wide: no sideways scroll, no console errors, and reduced motion still works.
- For a scene, check it on its own, inside the landing page card, and embedded with `?embed`.
- Keep one change per pull request, and say in the description what changed and how you checked it. A short screen recording helps a lot for a new scene.

By contributing, you agree that your work is released under the project's [MIT License](LICENSE).
