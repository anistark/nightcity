# Starry Nights

Van Gogh's The Starry Night, repainted stroke by stroke over the Night City skyline. The sky is thick blue paint that never dries: short brush strokes follow its swirls and cover the ones before them, so the two great curls turn and wander, the stars swell and shrink inside their halos, and an orange crescent moon sits in its ring of yellow. A tall cypress stands on the left and sways like a dark flame. Some nights one or two shorter ones stand beside it, and now and then another stands at the right edge. Low under the hills, where the painting has a village, the towers of Night City keep their windows, neon signs and beacons lit. Nothing is scripted, so the sky never flows the same way twice.

The painting is from 1889 and in the public domain. The scene holds no image of it. It only has rules that paint a picture like it, differently every time.

## Run it

From the project root, run `npm install` once, then `just serve`, and open http://localhost:8765/starry-nights/. The scene on its own, as embeds use it, is at http://localhost:8765/starry-nights/embed/.

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
| `starry-nights.11tydata.json` | Author, title, share tags, share text, log counters and landing card text |
| `index.njk` | The scene page, built from the shared scene layout with the overlay |
| `embed.njk` | The scene on its own, for embeds |
| `assets/css/style.css` | Overlay styles and the two stacked canvases |
| `assets/js/main.js` | The whole scene: the world, the flow of the sky, the strokes, the city, events and painting |
| `assets/images/logo.svg` | 16x16 pixel logo for the favicon |
| `assets/images/og.jpg` | 1200x630 share preview |

There are no libraries. Everything is drawn with plain Canvas 2D at the device's resolution, up to about 2.6 megapixels. The only outside request is the Pixelspace font for the overlay. The seed, frame loop and embed mode come from `assets/js/nightcity.js` in the project root, and the overlay and its controls from the shared scene layout, `scene-ui.js` and `scene-ui.css`.

## How it works

### One seed, from the clock

When the page opens, it hashes the current date and time down to the millisecond (`cyrb128`) into the state of one small random generator (`sfc32`), the same pair the other scenes use. The seed picks the world first: where the two great swirls sit and how strong they are, how many small swirls there are, nine to eleven stars and whether each is yellow, white or orange, the size of the moon and which way its crescent faces, how many cypresses there are and how tall each one is, the shape of three ridges of hills, which way the wind blows, and the whole city, building by building. The seed is shown at the bottom of the log.

The brush has a generator of its own, started from the seed. It decides where each stroke begins and how its colour wavers. Keeping it apart means the size of the window and the speed of the machine change how many strokes are painted, but never what happens in the sky.

### A sky that flows

The sky is a flow. A wind crosses it in slow waves, and round vortices turn in it: two great swirls that curl into each other, a few small ones, one around every star and one around the moon. Each vortex is a bump in a single stream function, and the direction of the flow at any point follows the contours of that function. The swirls wander on smooth noise, each at its own pace, and grow and weaken as they go, so the pattern they make together never comes back.

The same function colours the sky. Its contours are bands, so ribbons of lighter and darker blue run along the flow and wind into each swirl. On top of that the sky is deepest overhead, a band of pale light lies over the hills, and the inside of a great swirl is brighter than the sky around it. A stroke picks its colour from that at the point where it begins, then shifts it a little, and now and then a stroke is much paler, much darker or green, the way neighbouring strokes differ in the painting.

Each star is a halo: a pale core, then yellow or orange, then pale green, fading into the blue. The halo's size breathes on its own slow noise, and the strokes inside it are short and slow, so they stay as rings. The moon is a larger halo with an orange crescent round a pale hollow.

### Strokes

About a thousand strokes begin every second. A stroke lives for around a second. It moves along the flow, faster near a swirl, and paints the length it has covered as it goes, so you can see each one being drawn. It is thick at first and thins toward its end, and it carries two hairs of the brush, one lighter and one darker than its colour, which is what makes it look like paint and not a line.

The canvas is never cleared. Every stroke lands on top of the ones before it, and the whole sky is painted over every few seconds. That is all the animation there is: the picture changes because the flow has moved on by the time a place is painted again.

Each stroke belongs to what it started on, and stops where that ends. The sky is one such subject. The hills are another, painted slowly along their own ridges, with a dark line on each crest. The ground at the foot of the tree is painted in short curling strokes. Each cypress is painted upward, like flame, and its outline sways from the root up, often with a second, shorter tongue against its right side. The tall one is always there. The others are shorter, each a different height and narrower the shorter it is, and a narrow window keeps fewer of them so the city always has at least half the width. Where a tree moves, the sky paints over what it leaves behind, and the tree paints over the sky.

Before the first frame, the whole picture is painted twice over out of sight, so the scene opens on a finished canvas. With reduced motion on, it shows that picture and stays still.

### The city

The city stands on a canvas of its own, above the sky, in three rows: towers at the back with a downtown that rises to the right of centre, lower blocks in front of them, and a front row with flat or pitched roofs. It keeps low, under the line of the hills, the way the village does in the painting. It is laid out once along a strip, measured from the middle of downtown, so a wider window shows more of the same city and a phone shows the towers.

Each building is painted in upright dabs of its own colour, lighter on the side that faces the moon, with windows as single dabs of yellow, cyan, pink or white inside dark rings, a dark outline laid down in short unsteady lengths, and whatever stands on its roof: a setback, a spire with a red beacon, a water tank, a neon crown or a sign. Every half second or so one building is repainted in fresh strokes, along with everything in front of it, so the paint in the city never sits still either.

### Events

Each kind of event has its own timer, with exponentially distributed gaps, so the night has bursts and lulls instead of a beat.

| Event | Average gap |
|---|---|
| A building is repainted in fresh strokes | ~0.55 s |
| A window lights up or goes dark | ~1.2 s |
| A star swells in its halo, then settles | ~38 s |
| A neon sign changes colour or flickers | ~42 s |
| A new swirl comes in on the wind, crosses the sky and fades | ~55 s |
| A gust runs through the sky and the waves in the wind deepen | ~75 s |
| A flying car crosses between the towers, leaving a thin trail | ~85 s |
| A shooting star leaves a streak of wet paint | ~125 s |
| Pale cloud rolls in along the hills | ~140 s |
| The halo of the moon widens | ~170 s |
| The great swirls unwind, turn the other way for a while, then curl up again | ~290 s |
| The sky slows almost to a stop | ~340 s |
| The wind turns and the sky flows the other way | ~520 s |
| A district of the city goes dark, then comes back | ~580 s |

You can tune these in `assets/js/main.js`: the `SCHED` table holds the average gap (`m`) and the average wait for the first one (`f`) for each event. The beacons blink and the cypresses sway all the time, and the strength of the wind, the pace of the brush, the band of light over the hills and the mood of the blues all drift on smooth noise.

A shooting star and a flying car are strokes too. They are painted into the sky like everything else, and the sky paints over them in the seconds that follow.

## Testing

These URL parameters help when changing the scene:

- `?speed=8` runs the scene eight times faster.
- `?debug&trees=2` puts that many shorter cypresses beside the tall one, from 0 to 2, and `?debug&right` adds the one at the right edge.
- `?debug` exposes the live state as `window.SN`. `SN.run(300)` simulates five minutes at once, `SN.fire('curl')` starts any event from `SCHED` now, `SN.state()` reports the wind, the strokes in flight and the city, `SN.rebuild()` repaints everything at the current size, and `SN.pause()` and `SN.resume()` stop and start the frame loop.
