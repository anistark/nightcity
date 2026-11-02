# Bonfire

A bonfire in a clearing deep in the mountains, in pixel art. The flames lick and lean in the wind, sparks drift up into the stars, and a little smoke climbs above them. Far away, through a gap in the forest and between the ridges, Night City glows on its plain, and planes come and go from its airport. Nothing is scripted, so the fire never burns the same way twice.

## Run it

From the project root, run `npm install` once, then `just serve`, and open http://localhost:8765/bonfire/. The scene on its own, as embeds use it, is at http://localhost:8765/bonfire/embed/.

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
| `bonfire.11tydata.json` | Title, share tags, share text, log counters and landing card text |
| `index.njk` | The scene page, built from the shared scene layout with the overlay |
| `embed.njk` | The scene on its own, for embeds |
| `assets/css/style.css` | Overlay styles |
| `assets/js/main.js` | The whole scene: the world, the fire, sparks, smoke, flights, events and drawing |
| `assets/images/logo.svg` | 16×16 pixel logo for the favicon |
| `assets/images/og.jpg` | 1200x630 share preview |

There are no libraries. Everything is drawn with plain Canvas 2D into a small canvas that the browser scales up with `image-rendering: pixelated`, a whole number of screen pixels to each scene pixel, two or more depending on the window. The only outside request is the Pixelspace font for the overlay. The seed, frame loop and embed mode come from `assets/js/nightcity.js` in the project root, and the overlay and its controls from the shared scene layout, `scene-ui.js` and `scene-ui.css`.

## How it works

### One seed, from the clock

When the page opens, it hashes the current date and time down to the millisecond (`cyrb128`) into the state of one small random generator (`sfc32`), the same pair the other scenes use. The seed picks the world first: which side the city lies on, its size and shape (one bright core, two clusters of towers or a wide low sprawl), the colours of its glow, whether there is a moon and how full it is, where the Milky Way crosses, the shape of every ridge, the direction of the runway, a few loose constellations, and the camp: how many logs there are to sit on, where they lie and at what angle, whether two lie side by side, and whether there is a stump with a tin mug or a stack of split wood. Fine detail, like which windows are lit or where each tree stands, comes from a hash of its position mixed with the seed, so resizing the window repaints the same world. The seed is shown at the bottom of the log.

### The world

The sky is painted once, with ordered dithering so its gradients band into pixel steps. Mountains rise behind the city, the city's glow tints the sky and the ridges around it, and the suburbs spread toward us as a scatter of single-pixel lights. Each building has its own height, shade and window colour, a few towers carry antennas with blinking red beacons, and some have a neon crown. Stars are sparse, mostly faint with a few bright ones, and thin out in the city's glow. Each dims now and then on its own slow clock, so they blink at their own intervals, and a few loose groups of slightly brighter stars make constellations with nothing drawn between them. When there is a moon, only its lit side shows, with darker seas on its face, and its dark side still hides the stars behind it. Four ridges stand between the clearing and the city, each hazier the farther it is, with pines along the nearer ridgelines and a V-shaped valley that keeps the city in view.

The clearing is painted twice: once in the cold of the night, and once lit by the fire at full strength, with the light falling off with distance and depth and catching the edges of things that face the flames. The ring of stones and everything in the camp cast shadows away from the fire. Each frame draws the cold version, then the lit one on top at the fire's current brightness, so the whole clearing flickers with the flames.

### The fire

The flames are a heat field about a quarter of the window tall, rising from a teepee of logs over a bed of glowing coals. Each step, the logs feed heat into the bottom rows, with hot spots that drift along the pile, and every cell above takes the average heat of the cells below it, minus a cooling map. The cooling map is smooth noise that scrolls upward with the heat, so its holes tear tongues of flame loose and send them up as they fade. Extra cooling toward the sides, stronger higher up, gives the fire its taper. The field steps about 26 times a second, slower than the frame rate, so the fire burns lazily. The wind, slow sway and small random jitters shift each row a pixel sideways, so the flames lean and dance. The heat maps onto a palette from dark red to pale yellow with a little dithering at the edges, and a second, brighter pass makes the core glow.

The total heat sets the brightness of the firelight on the clearing, the glow in the air and the coals, so a flare lights everything up. How much fuel the fire has drifts slowly on smooth noise over minutes.

### Sparks, embers and smoke

Sparks rise from the hottest parts of the flames. Each has its own buoyancy, cooling rate and turbulence, drifts with a wind that blows harder higher up, and cools from white through yellow and orange to a dull red before it goes out. A few climb far above the trees. Fast ones leave a short trail, and hot ones glow. When the fire pops, embers fly out, fall back to the ground around the stones and glow there until they die. Flakes of ash float up more slowly. Smoke starts above the flame tips, warm where the fire lights it from below and grey higher up, swelling and fading as the wind takes it.

### The look

The scene is meant to feel like a lazy night on a camping trip, with lo-fi warmth. Sparks and smoke drift slowly, gusts are gentle, and the firelight eases up and down instead of flickering fast. Over every frame goes a grade: the blacks are lifted toward a dusky purple, everything is tinted warm, the corners fall into a soft vignette, and a fine film grain shifts a few times a second, like footage from an old camcorder.

### Events

Each kind of event has its own timer, with exponentially distributed gaps, so the night has bursts and lulls instead of a beat.

| Event | Average gap |
|---|---|
| A window in the city lights up or goes dark | ~2.5 s |
| The fire pops, throwing sparks and embers | ~4.5 s |
| A flight descends toward the city airport, its landing lights growing brighter | ~55 s |
| A flight takes off and climbs away | ~60 s |
| A gust leans the flames and the smoke | ~75 s |
| Eyes shine far off in the dark: a fox, a pack of wolves, deer, an owl in the trees, or rarely something large and quiet | ~95 s |
| Bats flit over the clearing | ~110 s |
| A log settles into the coals and the fire flares | ~150 s |
| A shooting star | ~160 s |
| A plane passes high over the mountains | ~170 s |
| A satellite crosses the stars | ~260 s |
| A district of the city goes dark, then comes back | ~540 s |
| Fireworks over the city, too far away to hear | ~780 s |

You can tune these in `assets/js/main.js`: the `SCHED` table holds the average gap (`m`) and the first appearance (`f`) for each event. Cars move along the highway out of the city, the approach lights run toward the runway, the beacons blink and the brightest stars twinkle all the time.

Before the first frame, the scene runs eight seconds of fire out of sight, so it opens on flames already burning, with sparks and smoke in the air. With reduced motion on, it shows that frame and stays still.

## Testing

Two URL parameters help when changing the scene:

- `?speed=8` runs the scene eight times faster.
- `?debug` exposes the live state as `window.BF`. `BF.run(600)` simulates ten minutes at once, `BF.fire('settle')` starts any event from `SCHED` now, and `NightCity.paused = true` freezes the frame loop.
