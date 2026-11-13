# Windy Hill

A hilltop of long grass under a tree at the edge of the view. A breeze runs through the meadow in slow waves, and now and then a gust lays the whole hill over and turns it bright. Below the hill a wide river slides past, and Night City stands on the far bank. The hour is different every time the page opens, anywhere from dusk to full night. Nothing is scripted, so the grass never moves the same way twice.

The look is a painted anime film: flat tones, an inked outline on the tree, soft distance. The scene is original, with nothing taken from a particular film, game or picture.

## Run it

From the project root, run `npm install` once, then `just serve`, and open http://localhost:8765/windy-hill/. The scene on its own, as embeds use it, is at http://localhost:8765/windy-hill/embed/.

## Controls

- **Log**, the page icon (bottom-right), or `L`: open the live event list with counters. The X closes it.
- **Share** (top-right, beside fullscreen): a dialog with the link and a copy button, then X, Bluesky, LinkedIn and Reddit as pixel logos, plus your device's own share sheet where there is one. A separate **Embed** button gives copy-paste snippets for putting the scene behind another site or app.
- **Fullscreen** (top-right) or `F`.
- **Back** (bottom-left): return to the Night City landing page.
- Click the scene or press `H`: hide or show the overlay.

The title and clock sit in the top-left corner.

## Files

| File | What it holds |
|---|---|
| `windy-hill.11tydata.json` | Author, title, share tags, share text, log counters and landing card text |
| `index.njk` | The scene page, built from the shared scene layout with the overlay |
| `embed.njk` | The scene on its own, for embeds |
| `assets/css/style.css` | Overlay styles and the vignette |
| `assets/js/main.js` | The whole scene: the world, the light, the wind, the grass, the tree, the city, events and drawing |
| `assets/images/logo.svg` | 16x16 pixel logo for the favicon |
| `assets/images/og.jpg` | 1200x630 share preview |

There are no libraries. Everything is drawn with plain Canvas 2D at the device's resolution, up to about 2.8 megapixels. The only outside request is the Pixelspace font for the overlay. The seed, frame loop and embed mode come from `assets/js/nightcity.js` in the project root, and the overlay and its controls from the shared scene layout, `scene-ui.js` and `scene-ui.css`.

## How it works

### One seed, from the clock

When the page opens, it hashes the current date and time down to the millisecond (`cyrb128`) into the state of one small random generator (`sfc32`), the same pair the other scenes use. The seed picks the hour, which side the tree stands on, which way the wind blows, where the moon sits and its phase, the shape of the hill, and the whole city building by building. The seed is shown at the bottom of the log.

Painting has generators of its own, started from the seed. They decide where each tuft of grass stands and what each leaf looks like. Keeping them apart means the size of the window changes how much grass is drawn, but never what happens on the hill.

### The hour

The hour is one number. The seed picks it between dusk, with the last orange light along the horizon, and full night under the moon, and anything between. Each hour has its own sky, haze and light, and the scene blends the two nearest. Every surface is a flat colour times the light that reaches it: an ambient part from the sky, plus a key light from the afterglow or the moon for the sides that face it. So one set of colours gives olive grass against an orange dusk and dark teal grass under the moon. As the hour gets later more of the city's windows, neon and lamps are on, and more stars are out.

The same scale goes back through the golden hour to a bright afternoon. The seed never picks those hours, but `?debug&hour` can.

### The wind

The wind is a field over the ground, measured across the hill and away from the viewer. Slow swells and smaller ripples are smooth noise carried along by the breeze, at a slant to the rows of grass, so they cross the hill as bands. The breeze itself rises and falls on a slow drift. A gust is a front with a sharp leading edge and a long tail that sweeps across the whole field in a few seconds. Because the field lives on the ground and not on the screen, its waves are small and close together far away and broad up close, which is what gives the hill its depth.

### The grass

The grass is about two thousand tufts standing in rows on the ground, from the crest of the hill to the viewer's feet, plus a band of small ones on the lower slope by the water. Each tuft is a handful of blades from one root, painted once: lush, yellow-green, dry with pale plumes, or with a few flowers. Patches of each kind follow a slow noise over the ground.

Every frame, each tuft reads the wind where it stands and leans over by that much, with a slow sway of its own on top. A small tuft leans as one piece. A larger one is drawn in two or three slices, each leaning further than the one below and starting where that one ended, so it bends in a curve from root to tip. Where the wind is strong the blades turn over and catch the light, so each tuft is also painted in several steps from unlit to fully lit and shows the step that matches its wind. Tufts step at their own moments, so the bright band of a gust crosses the field smoothly.

Rows are drawn far to near, and the tree stands in its own row, so the grass behind it is behind and the grass in front is in front.

### The tree

The trunk and boughs are painted once in three tones. The leaves are about a hundred clumps in three depths, each painted once and then shifted and turned by the wind every frame, more at the end of a bough than near the trunk. Sprigs hang from the lower edge and swing. Leaves let go, tumble across the view on the wind and land in the grass.

### The sky

The sky is clear. Stars are painted once: a field of small ones, a slanting band of fainter ones, and a few bright ones with a glint, all fading toward the glow over the city. A handful more are drawn each frame so they can twinkle. The moon is worked out pixel by pixel as a sphere lit from where the sun went down, so its bright limb always faces the afterglow. It has a soft edge between day and night, faint seas, and no pixels at all on its dark side, so only sky shows there. Its glow falls away smoothly from the lit limb, with no edge at the rim of the disc. The seed picks its phase, from a thin crescent to nearly full, and it keeps to the open side of the sky, clear of the tree. No star shows through it.

### The river and the city

Night City is laid out once along a strip, measured from the middle of downtown, so a wider window shows more of the same city. It stands in three rows behind mist, with setbacks, spires, beacons and neon. The river carries the sky, the city upside down drawn three times at different lengths so its lights run into streaks, and a path of light under the sun or moon. A few hundred glints blink on the water, brighter when the breeze is up. A couple of hundred windows are kept out of the painted city and drawn each frame, so they can go on and off.

### Events

Each kind of event has its own timer, with exponentially distributed gaps, so the hill has bursts and lulls instead of a beat.

| Event | Average gap |
|---|---|
| A window in the city lights up or goes dark | ~0.7 s |
| A leaf lets go of the tree | ~11 s |
| A gust crosses the hilltop | ~26 s |
| A flying car threads between the towers | ~55 s |
| Seeds lift off the grass | ~70 s |
| A flock of birds crosses the river, while there is still light | ~75 s |
| A train runs along the far bank | ~85 s |
| A few fireflies come up out of the grass, glow dimly and go out | ~80 s |
| A boat slides along the river | ~100 s |
| The wind drops to a whisper | ~150 s |
| A shooting star, once the stars are out | ~150 s |
| The wind turns and blows the other way | ~480 s |

You can tune these in `assets/js/main.js`: the `SCHED` table holds the average gap (`m`) and the average wait for the first one (`f`) for each event. A few stars twinkle, the beacons blink, the water glints and seeds ride the breeze all the time.

With reduced motion on, the scene shows one still frame.

## Testing

These URL parameters help when changing the scene:

- `?speed=8` runs the scene eight times faster.
- `?debug&hour=2.5` forces the hour: 2 is dusk and 3 is night. It also takes the hours the seed never picks, 0 for a bright afternoon and 1 for the golden hour, where butterflies take the place of fireflies.
- `?debug&flip` and `?debug&noflip` choose which side the tree stands on.
- `?debug` exposes the live state as `window.WH`. `WH.run(300)` simulates five minutes at once, `WH.fire('gust')` starts any event from `SCHED` now, `WH.state()` reports the wind, the grass and what is in the air, `WH.profile()` gives the time one frame takes to draw, `WH.rebuild()` repaints everything at the current size, and `WH.pause()` and `WH.resume()` stop and start the world.
