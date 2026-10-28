# Shoreline

Looking down at bare feet on wet sand at night, under the moon. Waves run up the beach one after another. Some fall a few centimetres short of the toes, some wash over the feet and pull back, and now and then a bigger one runs past the ankles. Foam laces the water and dissolves as each wave drains, the sand stays dark where it has been wet, and the feet slowly sink as the water passes. A ghost crab sometimes scuttles by, small clams surface in the backwash and dig straight back in, and a wave may leave a shell behind for the next one to take. None of it is scripted, so no two waves land the same way.

## Run it

From the project root, run `npm install` once, then `just serve`, and open http://localhost:8765/shoreline/. The scene on its own, as embeds use it, is at http://localhost:8765/shoreline/embed/.

## Controls

- **Log**, the page icon (bottom-right), or `L`: open the live event list with counters. The ✕ closes it.
- **Share** (top-right, beside fullscreen): a dialog with the link and a copy button, then X, Bluesky, LinkedIn and Reddit as pixel logos, plus your device's own share sheet where there is one. A separate **Embed** button gives copy-paste snippets for putting the scene behind another site or app.
- **Fullscreen** (top-right) or `F`.
- **Back** (bottom-left): return to the Night City landing page.
- Click the scene or press `H`: hide or show the overlay.

The title and clock sit in the top-left corner.

## Files

| File | What it holds |
|---|---|
| `shoreline.11tydata.json` | Title, share tags, share text, log counters and landing card text |
| `index.njk` | The scene page, built from the shared scene layout with the overlay |
| `embed.njk` | The scene on its own, for embeds |
| `assets/css/style.css` | Overlay styles |
| `assets/js/main.js` | The whole scene: sand, foam and feet textures, waves, creatures, events, drawing |
| `assets/images/logo.svg` | 16×16 pixel logo for the favicon |
| `assets/images/og.jpg` | 1200x630 share preview |

There are no libraries. Everything is drawn with plain Canvas 2D at the screen's full resolution. The only outside request is the Pixelspace font for the overlay. The seed, frame loop and embed mode come from `assets/js/nightcity.js` in the project root, and the overlay and its controls from the shared scene layout, `scene-ui.js` and `scene-ui.css`.

## How it works

### One seed, from the clock

The seed is the moment the page opened, hashed into one random generator shared with the other scenes. It picks the sand (pale, golden, grey or dark), the moonlight, how lively the surf is, which way the tide is drifting, and the people: one pair of feet, or sometimes two, each with a skin tone, a size, leg hair or none, painted nails or none, and sometimes an anklet.

### Textures, made once

Sand, foam and feet are generated pixel by pixel when the scene starts, and again when the window changes size.

- **Sand** is a tile of soft blotches, grain-level noise, and scattered pebbles, shell fragments and dark grains with small shadows. A darker, more even copy is the wet sand.
- **Foam** is a sheet of bubbles with round holes punched through it, from two sizes of jittered cells with their own radii, warped so no hole is a clean circle. A dense and a sparse version cut the same holes at two sizes, so when foam thins the same holes grow and join up.
- **Feet** are drawn in foot-sized units: the top of the foot and the leg, five toes from big to little with knuckle creases and nails, tendons, ankle bones, a faint vein, leg hair and skin texture. Each foot also gets a silhouette, a soft ring for foam, a contact shadow, a wet sheen and a band of sand for sinking in.

### Waves

A new wave arrives every 4 to 20 seconds or so, as a fixed wait plus an exponentially distributed one, so waves come in sets and lulls. Each picks how far it runs, short of the toes, over the feet, or past them, and the tide nudges that over minutes. Its front is a few lobes across the beach that runs up fast, slows, holds and drains back, a little earlier on one side than the other.

Every frame, the water's edge is the furthest any wave reaches at each point. The sand inside it is drawn through the water, darker toward the sea, with ripples drifting toward the shore and the moon's path on the surface. Foam masks are painted at low resolution so their edges come out soft: dense foam along each wave's leading edge, lace behind it, a strand left on the line it reached, and a ring around the feet while water runs past. The foam textures are drawn through those masks, each with a faint shadow on the sand beneath, and a bright rim marks the edge of each wave while it runs up.

The sand stays wet wherever water has been and slowly dries. When the water touches the feet they turn wet and glossy and dry again over half a minute, and each time it washes over them they sink a little further into the sand.

### Life on the beach

| Event | When |
|---|---|
| Tiny holes open in the sand as air escapes after each wave drains | Every wave |
| Coquina clams surface in the backwash and dig back in | About 1 wave in 5 |
| A ghost crab scuttles in, pauses, runs from the water and leaves or burrows | ~140 s |
| A wave leaves a shell on the sand, until a later wave rolls it back | ~170 s |
| Toes wiggle free of the sand they have sunk into | ~160 s, once they have sunk |
| A cloud passes over the moon and the beach goes dim | ~220 s |

You can tune these in `assets/js/main.js`: the `SCHED` table holds the average gap (`m`) and the first appearance (`f`) for each event.

### Drawing

Each frame draws the dry sand, the wet sand through its mask, things on the sand, the water, the foam and its shadows, the feet with their contact shadows, sinking sand, water over the toes and wet sheen, then the moonlight over everything, glints on the water and wet sand, a vignette and a little film grain. The moonlight first takes out some of the colour, then tints the whole frame, and dims when a cloud passes.

## WebGL prototype

Open the scene with `?gl` to try a WebGL 2 version that aims closer to a photograph. A camera at eye height looks down at the feet in real perspective, and a fragment shader works out every pixel:

- **Sand** has grain-level relief from noise, round pebbles and shell bits, and turns darker and shinier where a wet-sand map, kept on the GPU, says water has been.
- **Water** has a surface: the raised lip of an incoming wave, the sheet thinning as it drains, and ripples that drift up the beach with the uprush and back with the drain. It bends the view of the sand beneath it, focuses moonlight into faint caustics on it, soaks up red light first as it deepens, and mirrors the moon. Sand the water has only just left keeps a film that glitters, and a soaked darker band runs just ahead of the edge.
- **Foam** is a sheet of bubbles cut by holes of three sizes, thick and bright along its strands and translucent where it thins. Each bubble catches the moon, the water darkens in the shade at the rim of each hole, and the sand beneath gets a faint shadow. It rides up with each wave's front, then stays where the wave reached and stretches into streaks as the water drains. Fine detail fades out once it gets smaller than a pixel, so nothing shimmers.
- **Feet and legs** are smooth 3D shapes, ray-marched and lit with light scattering through the skin, soft shadows on themselves and the sand, ambient occlusion and glossy nails. They get glossier when wet, sink a little with each wave, and water and foam ride over the toes.

The waves, tide and log run in JavaScript, in metres, and reach the shader through a small data texture each frame. The prototype doesn't have the crabs, clams, shells or air holes yet. If WebGL 2 isn't available, or a shader fails to compile, the Canvas 2D version runs instead. `?glq=0.7` lowers the render resolution, and `?glfail` forces the fallback for testing.

## Testing

Two URL parameters help when changing the scene:

- `?speed=8` runs the scene eight times faster.
- `?debug` exposes the live state as `window.SH`. `SH.run(60)` simulates a minute at once, `SH.newWave()` sends a wave now, `SH.fire('crab')` starts any event from `SCHED`, and `SH.paused = true` freezes the frame loop.
