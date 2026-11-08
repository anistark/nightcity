# Mandala

A sand mandala made grain by grain on a board at night, seen from straight above, on a floor and among lamps, incense and offerings that change from night to night. First the guidelines go down in chalk: the main axes, the circles and the outline of the palace. Then the coloured sand goes down, starting at the centre and working outward, every section traced round its edge and then filled, so you can watch each line being drawn. Sand flows from one funnel at the centre at first, and a second and sometimes a third join as the mandala grows, each working its own side, slowly and calmly. There are no hands, only the sand and a glint at each funnel's tip. When it is finished it rests for 42 seconds. Then eight cuts run in from the rim, the sand is swept into a heap at the centre, the heap is poured into a bowl of water beside the board, the board is wiped clean and the next mandala begins. No two are the same.

## Run it

From the project root, run `npm install` once, then `just serve`, and open http://localhost:8765/mandala/. The scene on its own, as embeds use it, is at http://localhost:8765/mandala/embed/.

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
| `mandala.11tydata.json` | Author, title, share tags, share text, log counters and landing card text |
| `index.njk` | The scene page, built from the shared scene layout with the overlay |
| `embed.njk` | The scene on its own, for embeds |
| `assets/css/style.css` | Overlay styles and the two stacked canvases |
| `assets/js/main.js` | The whole scene: the place, the designs, turning them into grains, the chalk, the sand, the sweeping away, the flames, the water and drawing |
| `assets/images/logo.svg` | 16x16 pixel logo for the favicon |
| `assets/images/og.jpg` | 1200x630 share preview |

There are no libraries. Everything is drawn with plain Canvas 2D. The only outside request is the Pixelspace font for the overlay. The seed, frame loop and embed mode come from `assets/js/nightcity.js` in the project root, and the overlay and its controls from the shared scene layout, `scene-ui.js` and `scene-ui.css`.

## How it works

### One seed, from the clock

When the page opens, it hashes the current date and time down to the millisecond (`cyrb128`) into the state of one small random generator (`sfc32`), the same pair the other scenes use. Each new mandala draws its own seed from it, and that seed picks the whole design. It is shown at the bottom of the log.

### One pixel, one grain

The scene is pixel art where every pixel is a grain of sand. The mandala is always about 240 grains from its centre to its rim, whatever the screen, and each grain is a whole number of device pixels, scaled up with crisp edges. A grain has its own small variation in brightness, and now and then one is much lighter or darker, the way dyed sand is. The sand also has height: lines stand a little proud of the fills, so the light from the lamp overhead catches one side of every line and the other side falls into shadow, and the sand casts a thin shadow on the bare board.

### A new design every time

Every mandala is built from the same parts in a different way:

- **The rim**, from outside in: a ring of fire in four to seven colours swirling one way or the other, often a ring of vajras, usually a ring of lotus petals, sometimes in two rows, and up to two more bands of beads, teeth, waves, scallops, jewels, chain, dots, checks or stripes, with fine lines of black, white or gold between them.
- **The palace**, most of the time: a square with a stepped gate in each side, its walls in three to five coloured stripes, a frieze of hanging garlands inside the walls, and an ornamented arch beyond each gate. There can be one, two or three palaces nested inside each other. Inside, the floor is split along the diagonals into the colours of the four directions: east at the bottom in white or blue, south on the left in yellow, west at the top in red and north on the right in green. There may be fine lines along the diagonals and small round seats in the corners. Outside the walls, the grounds are one colour or the four directions again, with ornaments either side of each gate: jewels, a moon and sun, swirls or clouds.
- **Or a star**, now and then: rings all the way in around an eight pointed star, with a second star turned between its points and a jewel beyond each tip.
- **The centre**: a lotus of eight petals, the four facing the directions in the colours of the directions, around a centre that is rings, a wheel of eight spokes, a three part swirl, a double vajra or a small star.

The colours come from one of four schemes, the old full set, reds and golds, blues and greens, or deep jewel colours, picked so neighbouring parts never share a colour. Nothing in the design is a picture of a particular mandala.

### From a design to grains

A design is a function from a point to a colour. When a new mandala begins, that function is worked out for every grain, and the grains are split into pieces of one colour. Each piece gets a path for the sand to follow: once round its edge first, then inward in rings, ring after ring, the way a section is outlined and then filled by hand. Pieces that run round much of the mandala are shared out into sections, so several funnels can work on them at once. Within a section the lines go down first, then the small pieces like petals and jewels, then the wide fields around them. This work is spread over many frames while the chalk lines are drawn, so it never stalls the scene.

### Chalk, then sand

The chalk lines are drawn one after another, slowly, with a pause between them: the four axes, then every main circle, then the outline of each palace with its gates. A small point of light marks the chalk as it moves. This takes about two minutes.

Then the sand. The mandala is made from the centre outward, one part at a time, and each part is split into sections round the circle. One funnel works at the centre. Another joins as the work moves outward, and on some mandalas a third for the outer rings, and each takes the next section on its own side. A glint marks each funnel's tip, with grains falling round it. It is slow and calm on purpose. A line takes about 8 seconds to run the length of the radius, fields fill a little faster, the pace drifts gently, and between sections a funnel rests for a moment, sometimes for several seconds, as if it were being refilled. Now and then a grain bounces and lands a little way off. The pace is measured on a fixed grid, so it is the same on a phone as on a wide monitor. A whole mandala takes roughly a quarter of an hour to half an hour, depending on how much there is in it and whether two or three funnels share the work.

### Swept away

When the last grain of the ring of fire is down, the mandala rests for 42 seconds. Then the sand is taken back, unhurried, over about three minutes:

- **Eight cuts** run in from the rim to the centre, east and west, south and north, then the diagonals, each pushing the sand up to either side.
- **The sweep.** A wavy front moves in from the rim in strokes and pushes a ridge of sand ahead of it. The colours mix as they go, so the ridge turns to a confetti of every colour in the mandala, and it grows taller as it gathers more. Behind it the board is bare, with a few coloured specks and the old chalk lines showing through.
- **The heap.** The ridge closes into a mound of mixed sand at the centre.
- **Into the water.** The heap shrinks as its sand runs off in a stream to the bowl of water beside the board, where the grains swirl and slowly sink and the water takes on their colour for a while.
- **Wiped clean.** The board is wiped from one side to the other, and after a few moments the chalk lines of the next mandala begin.

### The place

Each night the board is set out somewhere new, picked from the seed when the page opens: wooden floorboards, a woven carpet over floorboards, marble, granite, cement, terracotta tiles or slate flagstones indoors, or sand, cobblestones or grass under the open sky, where the dark turns a little blue. Polished stone throws the lamplight back. The board itself is always dark blue with a red lacquered frame and a gold line inside it, under a warm light that hangs over it.

Around it stand the things kept near a sand mandala, placed at random on the floor either side of the board: left and right on wide screens, above and below on tall ones.

- **Light:** butter lamps in pairs facing each other across the board, clusters of candles, rows of tea lights, or some of each. Every flame has its own pool of light and flickers on its own.
- **Incense:** always at least one stick, in a dish of ash or a pot of sand, and sometimes two or three holders, each with its own curl of smoke.
- **The bowl of water:** always there, since the sand ends up in it, in brass, copper, clay, stone or silver.
- **A few more things,** two to five of them: small dishes of coloured sand, the metal funnels the sand is poured from, a singing bowl and its striker, prayer beads, marigolds loose or on a plate, a folded white silk scarf, a conch shell, a bell and vajra, or a scatter of pebbles and shells, more often out of doors.

Incense smoke curls up and drifts on a slow current of air, motes of dust float in the light, and the flames show as small wavering lights in the water.

Each of these has its own timer, with exponentially distributed gaps, so the night has bursts and lulls instead of a beat:

| Event | Average gap |
|---|---|
| A draft, or a breeze out of doors, leans the flames and bends the smoke | ~150 s |
| A flame gutters, dimming and steadying over a few seconds | ~160 s |
| A moth comes in to circle a flame, and sometimes settles on the edge of the board for a while | ~300 s |
| A fresh stick of incense is lit and the smoke thickens | ~360 s |

You can tune these in `assets/js/main.js`, in the `means` table.

The board and the sand live on one canvas, and only the grains that change are written to it. The floor and the things around the board are painted once at each size and lit with the board. Everything that moves every frame, the flames, the glints, the falling grains, the stream, the water, the moth and the smoke, is drawn on a second canvas on top, so the sand is never copied.

With reduced motion on, the scene shows one finished mandala. Inside a frame, as a preview on the landing page or as an embed, it starts partway through one.

## Testing

Two URL parameters help when changing the scene:

- `?speed=8` runs the scene eight times faster.
- `?debug` exposes the live state as `window.MD`. `MD.run(300)` simulates five minutes at once, `MD.finish()` completes the current mandala, `MD.skip()` ends the 42 second rest so the sweeping away starts now, `MD.next()` clears the board for a new mandala, `MD.fire('moth')` starts any event from the table above (`flicker`, `draft`, `moth`, `incense`), `MD.state()` sums up the place, the design and the progress, `MD.pause()` freezes the frame loop, `MD.step(1)` moves it on by a second and `MD.draw()` paints one frame. `?debug&done` opens on a finished mandala, and `?debug&floor=marble` picks the floor: `wood`, `rug`, `marble`, `granite`, `cement`, `terracotta`, `slate`, `sand`, `cobbles` or `grass`.
