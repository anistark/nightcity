# Afterglow

A flat beach at low tide, just after sunset. The sky is a deep orange above a dusky band of haze, with a low island on the horizon. Small waves break far out, and each one that reaches the shore sends a thin sheet of water up the wet sand, where it slows, rests and drains away. The sand is soaked, so it mirrors the sky, and at our feet it is ridged with ripple marks. Nothing is scripted, so no sheet of water ever stops along the same line twice.

The scene is built after a short video of a beach in that light. It has three looks, and all three draw the same evening:

- **Photo** is as close to the video as the scene gets: soft light, muted foam and a little grain.
- **Painted** is the same beach as a background painted for an animated film, with plum clouds lit gold from below, a clean mirror of them in the wet sand, white foam and visible brush marks. It is original, with nothing taken from a particular film.
- **Pixel** is pixel art in a palette of twenty colours, with dithered bands in the sky.

The seed picks one look for each visit, and the button under the title changes it.

## Run it

From the project root, run `npm install` once, then `just serve`, and open http://localhost:8765/afterglow/. The scene on its own, as embeds use it, is at http://localhost:8765/afterglow/embed/.

## Controls

- **Art style**, the button under the title, or `S`: redraw the same evening in the next look. The waves carry on from where they were.
- **Log**, the page icon (bottom-right), or `L`: open the live event list with counters. The X closes it.
- **Share** (top-right, beside fullscreen): a dialog with the link and a copy button, then X, Bluesky, LinkedIn and Reddit as pixel logos, plus your device's own share sheet where there is one. A separate **Embed** button gives copy-paste snippets for putting the scene behind another site or app.
- **Fullscreen** (top-right) or `F`.
- **Back** (bottom-left): return to the Night City landing page.
- Click the scene or press `H`: hide or show the overlay.

The title and clock sit in the top-left corner.

`?style=photo`, `?style=paint` or `?style=pixel` in the address opens the scene in that look. It works on the embed page too, so an embed can keep to one look: `afterglow/embed/?style=pixel`.

## Files

| File | What it holds |
|---|---|
| `afterglow.11tydata.json` | Author, title, share tags, share text, log counters and landing card text |
| `index.njk` | The scene page, built from the shared scene layout with the overlay, plus the art style button |
| `embed.njk` | The scene on its own, for embeds |
| `assets/css/style.css` | Overlay styles, the art style button and the vignette |
| `assets/js/main.js` | The whole scene: the world, the three looks, the sky, the sand, the waves and sheets, events and drawing |
| `assets/images/logo.svg` | 16x16 pixel logo for the favicon |
| `assets/images/og.jpg` | 1200x630 share preview |

There are no libraries. Everything is drawn with plain Canvas 2D. The only outside request is the Pixelspace font for the overlay. The seed, frame loop and embed mode come from `assets/js/nightcity.js` in the project root, and the overlay and its controls from the shared scene layout, `scene-ui.js` and `scene-ui.css`.

## How it works

### One seed, from the clock

When the page opens, it hashes the current date and time down to the millisecond (`cyrb128`) into the state of one small random generator (`sfc32`), the same pair the other scenes use. The seed picks the look, the colour of the evening, where along the horizon the glow is strongest, the cloud cover and the wind, the size and slant of the swell, the shape of the island and whether it has a lamp, and the direction and spacing of the ripples in the sand. Then it drives every wave. The seed is shown at the bottom of the log.

Painting has generators of its own, started from the seed. They place the shells on the sand and shake the film grain. Keeping them apart means the size of the window and the look change how the beach is drawn, but never what the sea does.

### A picture worked out pixel by pixel

The scene does not draw shapes. It works out the colour of every pixel into a small buffer and lets the browser scale that up to the window. The photo and painted looks use about half a million pixels, which is enough because the light is soft. The pixel look uses a few hundred pixels along its longer side and scales up with hard edges.

The beach is a flat ground seen in true perspective from eye height, 1.5 m above the sand, with the shore about ten metres ahead. Every row of the picture below the horizon is a distance, and every pixel a spot on the ground measured in metres. Waves, sheets of water and ripples all live on that ground, so they shrink and crowd together toward the horizon by themselves.

### The sky

The sky is a gradient taken from the video: a dusky band at the horizon, the brightest orange a third of the way up, and a dull mauve red at the top. Clouds are a deck seen from below, made of smooth noise stretched along the horizon, finer and flatter the lower it sits. A second reading of the noise a little lower down finds each cloud's underside, which is the side the glow lights. The island is a low outline with a few trees.

The sky changes slowly. The wind carries the clouds along and their shapes shift as they go, while slow noise brightens and dims the glow and moves it between crimson and gold. So a few rows of sky are painted again every frame, in a scattered order, and the whole sky is fresh every couple of seconds without a moving line ever showing.

### Sand that mirrors the sky

Wet sand is a mirror, so each pixel of the beach takes its colour from the sky. A blurred copy of the sky is kept for this. A pixel of flat wet sand reads the point as far above the horizon as it lies below it. How strongly it mirrors depends on the angle: almost fully far away, where the view grazes the sand, and only a little at our feet, where the sand's own dark colour shows instead. That one rule gives the bright band below the shore and the dark foreground.

The sand has a shape: broad shallow bars everywhere and, near us, ripple marks in two crossing sets, each ridge with a long rise and a short fall, swelling and dying away along its length. A slope that faces us mirrors the sky higher up, where it is darker, and a slope that faces away mirrors it lower down, in the glow. So each ridge shows as a dark face with a thin bright line beside it. Shells and pebbles are scattered once.

Every pixel of the beach is kept in two states: bare wet sand with its ripples, and the same sand under a film of water, which lies flat, hides the ripples and mirrors the sky straight.

### Waves

A wave is a crest line at a distance from us, slanted and bent a little, taller in some stretches than others. A new one sets out from far off every few seconds, at a gap that is never the same. It slows as the water shallows, so the lines bunch up toward the shore. It breaks where its height is most of the depth, which happens sooner where it is taller, so foam starts in patches and spreads along the crest. After that it runs in as a low wall of foam that dies down in some stretches and picks up in others, and leaves foam on the water behind it.

Between the waves the sea is three layers of noise moving toward the shore. They mix the dull colour of the sky just above the horizon with the colour of the glow, as tilting water does. Far rows of the picture hold many metres of sea each, so the layers fade out there instead of turning to noise.

### Sheets of water

When a crest reaches the shore it launches a sheet. The sheet runs up the sand, slowing all the way, to a reach set by the height of the wave: three or four metres for a small one, the whole beach for a big one, which floods the ripples at our feet until it drains. It rests for a moment, then the shine draws back toward the sea with a soft edge. Its front stays behind as a thin line on the sand, and fades over half a minute unless a later sheet runs over it first.

Each point along the shore starts when the crest gets there, so a slanted wave sweeps its sheet along the beach, and lines from different waves cross each other at different angles. The fronts are uneven, in broad lobes. A strong sheet carries foam behind its front.

Where a sheet lies, the picture shows the sand's second state. Up the beach, where bare sand is only damp, that is a clear step in brightness. Near the sea, where the sand is soaked through, a sheet shows mostly by its edge.

### Three looks, one world

A look changes how a pixel is finished, never what the sea does. The photo look adds a little noise so the smooth sky does not band, blurs the sky well before the sand mirrors it, and lays a tile of film grain over the picture. The painted look has its own colours, hard-edged clouds with darker middles, a much sharper mirror, white foam and a tile of brush marks. The pixel look matches every colour to its palette through a 4x4 dither, and mirrors the sky with no blur at all, so cloud shapes lie whole on the wet sand.

### Events

Each kind of event has its own timer, with exponentially distributed gaps, so the beach has bursts and lulls instead of a beat.

| Event | Average gap |
|---|---|
| A wave sets out from far off | ~5.6 s |
| Birds cross the sky in a loose V | ~70 s |
| A set of bigger waves comes in | ~95 s |
| The sea goes quiet for a while | ~150 s |
| The glow flares up, toward gold | ~170 s |
| The sky sinks toward a deeper red | ~220 s |
| A fishing boat heads along the horizon | ~240 s |
| A plane catches the last light | ~300 s |

You can tune these in `assets/js/main.js`: the `SCHED` table holds the average gap (`m`) and the average wait for the first one (`f`) for each event. Waves have a timer of their own in `update()`. The clouds drift, the tide creeps in and out, and on some evenings a lamp on the island flashes all the time.

The sea has been running for a while before the page opens, so there are waves on their way in and water on the sand from the first frame. With reduced motion on, the scene shows that frame and stays still.

On a slow machine the buffer is made smaller during the first two seconds, so the scene holds its frame rate.

## Testing

These URL parameters help when changing the scene:

- `?speed=8` runs the scene eight times faster.
- `?style=photo`, `?style=paint` and `?style=pixel` pick the look.
- `?debug&warm=0` sets the colour of the evening, from -1 for crimson to 1 for gold. 0 is the colour of the video.
- `?debug` exposes the live state as `window.AG`. `AG.run(300)` simulates five minutes at once, `AG.step(2)` moves on two seconds and repaints, `AG.fire('set')` starts any event from `SCHED` now, `AG.wave(0.6)` sends in a wave that tall, in metres, a few seconds from the shore, `AG.look('pixel')` changes the look, `AG.state()` reports the mood, the waves and the sheets on the sand, `AG.profile()` gives the time each stage of a frame takes, `AG.rebuild()` repaints everything at the current size, and `AG.pause()` and `AG.resume()` stop and start the world.
