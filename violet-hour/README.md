# Violet Hour

A mountain lake at dusk, in pixel art and in one family of colours, from the navy of the near pines through violet and magenta to the white of the moon. The moon stands low in the gap between two walls of mountains. Clouds drift over and light up from below, the lake mirrors everything above it in broken dashes with a path of moonlight down its middle, and pines sway along the near shore. Nothing is scripted, so no evening is ever the same.

It was built after a small looping pixel-art picture of the same subject, and keeps its mood and its colours. Nothing of that picture is stored: everything here is generated, at several times the detail.

## Run it

From the project root, run `npm install` once, then `just serve`, and open http://localhost:8765/violet-hour/. The scene on its own, as embeds use it, is at http://localhost:8765/violet-hour/embed/.

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
| `violet-hour.11tydata.json` | Title, share tags, share text, log counters and landing card text |
| `index.njk` | The scene page, built from the shared scene layout with the overlay |
| `embed.njk` | The scene on its own, for embeds |
| `assets/css/style.css` | Overlay styles |
| `assets/js/main.js` | The whole scene: the palette, the world, the sky, mountains, clouds, lake, shore, events and drawing |
| `assets/images/logo.svg` | 16×16 pixel logo for the favicon |
| `assets/images/og.jpg` | 1200x630 share preview |

There are no libraries. The picture is worked out pixel by pixel into a small canvas that the browser scales up with `image-rendering: pixelated`. A scene pixel is always a whole number of device pixels, and the scene aims for about 720 by 405 of them, so it stays sharp on any screen. The only outside request is the Pixelspace font for the overlay. The seed, frame loop and embed mode come from `assets/js/nightcity.js` in the project root, and the overlay and its controls from the shared scene layout, `scene-ui.js` and `scene-ui.css`.

## How it works

### One seed, from the clock

When the page opens, it hashes the current date and time down to the millisecond (`cyrb128`) into the state of one small random generator (`sfc32`), the same pair the other scenes use. The seed picks the world first: where the moon stands and how large it is, which wall of the valley is taller, how many ridges each wall has and the shape of every one, whether the sky holds long streaks, heavy banks or little cloud at all, which way the wind blows, the colour of the evening, whether there is a cabin on the far shore, a waterfall, spits of land or islands, and every pine on the near shore. Fine detail comes from a hash of its position mixed with the seed, and every sprite from a private stream of its own, so resizing the window repaints the same world. The seed is shown at the bottom of the log.

### One palette

Every pixel is an entry in a palette of 38 colours. Sixteen are a single ramp, from near black through navy, indigo, violet and magenta to pink and white. Sixteen more are the same steps as the lake shows them, with the darks lifted to plum. The last six are the only warm colours: the lamp in the cabin window, its light on the water, a lantern, and the fireflies.

Everything is first worked out as a tone, a position along the ramp. A tone between two steps is dithered in a 2 by 2 pattern, but only through the middle of the step, so the picture is made of flat bands with a checkered edge between them. The colour of the evening is one number that drifts slowly on smooth noise. It turns every purple in the palette a few degrees toward blue or toward rose, so the whole picture changes colour without a single pixel being repainted.

### The sky and the mountains

The sky is painted once. Its light is a lens round the moon that widens as it climbs, over a sky that darkens upward and toward the sides, and two layers of stretched noise fray the bands sideways. Stars stand in the darker parts and each dims and brightens on its own slow clock.

Each wall of the valley is seven to ten ridges, far to near. A far ridge comes down to the water close under the moon and a near one stands off to the side, so the two walls open like a V with the moon in the gap. Far ridges are pale with haze and take their colour from the sky behind them. Near ones are dark, with pines along their crests, a line of light where a crest stands against the bright sky, gullies running down the slope away from the light, and forest lower down. Haze thickens toward the water. Some evenings a waterfall runs down one face, a cabin stands among pines on the far shore with a lamp in its window, and spits of land and small islands lie in the lake.

### Clouds

A cloud is a small sprite of five shades: a dark cap on top, then lighter toward its belly, which hangs in scallops and ends in a bright rim. Thick clouds are built in tiers, each lower and in front of the one before. What colour each shade becomes depends on where the cloud is, because all five are worked out once for every pixel of sky. So a cloud lights up from below as it drifts toward the moon and goes dark again as it leaves.

Higher clouds are nearer, so they are larger and drift faster, and long streaks lean toward the point under the moon, as rows of cloud do in perspective. The sky is wider than the window. A cloud that leaves the far end of it is replaced, after a wait, by a new one upwind.

### The lake

The lake is drawn fresh every frame as a mirror of whatever stands above it, clouds, birds and lightning included. Each row of water copies a row from above the waterline, slid sideways by an amount that changes with time and grows toward us. Two rows of stretched noise slide over each other to break the mirror into dashes, small and close together far away, long and thick near us. Where the mirror is broken, the water shows sky from higher up, which is darker, and a few dashes catch the light and show a step brighter.

The moon's light lies down the middle as a column of dashes that widens toward us and never holds still. When a cloud covers the moon, the column fades. Islands, the canoe and the ducks are drawn with their own mirror image under them, cut by the same ripples.

### The near shore

Four rows of pines stand on the near shore, the farthest a shade of indigo and the nearest almost black. Each tree is built bough by bough: a bough starts narrow against the trunk, reaches out as it hangs lower, and ends in drooping tips with needles under it. Thin larches and a few bare snags stand among them. The trees are taller toward the sides of the window, so they frame the lake on any shape of screen. Every tree leans with the breeze, more at its top than its foot, and a gust lays them over as it passes.

### Events

Each kind of event has its own timer, with exponentially distributed gaps, so the evening has bursts and lulls instead of a beat.

| Event | Average gap |
|---|---|
| A fish rises and rings spread over the water | ~8 s |
| A gust comes down the valley, ruffles patches of the lake and leans the pines | ~60 s |
| A skein of geese crosses the valley in a V, or herons on slow wings | ~80 s |
| Ducks paddle across the lake in a line, trailing wakes | ~140 s |
| A shooting star | ~150 s |
| Fireflies come up among the pines | ~170 s |
| An owl glides low over the water | ~230 s |
| Mist gathers along the far shore | ~280 s |
| The lamp in the cabin goes out, or is lit again | ~320 s |
| Heat lightning flickers behind the peaks and lights the clouds | ~330 s |
| A canoe crosses the lake with a lantern at its bow | ~460 s |
| The wind turns and the clouds drift back the way they came | ~1100 s |

You can tune these in `assets/js/main.js`: the `SCHED` table holds the average gap (`m`) and the first appearance (`f`) for each event. The clouds drift, the water moves, the stars twinkle, the waterfall runs and smoke rises from the cabin all the time. The log also notes when a cloud crosses the moon.

Before the first frame, the scene runs thirty seconds out of sight, so it opens with the lake already alive. With reduced motion on, it shows that frame and stays still.

## Testing

A few URL parameters help when changing the scene:

- `?speed=8` runs the scene eight times faster.
- `?debug` exposes the live state as `window.VH`. `VH.run(600)` simulates ten minutes at once, `VH.fire('birds')` starts any event from `SCHED` now, `VH.state()` reports what is going on, `VH.profile()` times each stage of a frame, and `VH.pause()` and `VH.resume()` stop and start the frame loop.
- `?debug&sky=streaks`, `sky=banks` or `sky=open` forces the kind of sky, `?debug&mood=0` sets the colour of the evening from -1, blue, to 1, rose, and `?debug&cabin` and `?debug&falls` put in a cabin and a waterfall.
- `?debug&px=1` sets the size of a scene pixel in CSS pixels, to look at the picture at one size on any window.
