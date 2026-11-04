# Diwali Night

The moonless night of Diwali from a rooftop in the thick of the city, in pixel art. Someone sits on the ledge with their back to us, a steel cup of chai beside them, with buildings rising on every side, all of them lit by hand. Balconies are strung with bulbs and paper lanterns, people come out to watch, a man smokes by the rail, children wave sparklers, crackers go off on the road, and fireworks go up here and there between the blocks. Nothing is scripted, so no two Diwalis go the same way.

## Run it

From the project root, run `npm install` once, then `just serve`, and open http://localhost:8765/diwali-night/. The scene on its own, as embeds use it, is at http://localhost:8765/diwali-night/embed/.

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
| `diwali-night.11tydata.json` | Title, share tags, share text, log counters and landing card text |
| `index.njk` | The scene page, built from the shared scene layout with the overlay |
| `embed.njk` | The scene on its own, for embeds |
| `assets/css/style.css` | Overlay styles |
| `assets/js/main.js` | The whole scene: the city, the lights, people, the street, fireworks, the figure on the ledge, events and drawing |
| `assets/images/logo.svg` | 16×16 pixel logo for the favicon |
| `assets/images/og.jpg` | 1200x630 share preview |

There are no libraries. Everything is drawn with plain Canvas 2D into a small canvas that the browser scales up with `image-rendering: pixelated`, a whole number of screen pixels to each scene pixel, two or more depending on the window. The only outside request is the Pixelspace font for the overlay. The seed, frame loop and embed mode come from `assets/js/nightcity.js` in the project root, and the overlay and its controls from the shared scene layout, `scene-ui.js` and `scene-ui.css`.

## How it works

### One seed, from the clock

When the page opens, it hashes the current date and time down to the millisecond (`cyrb128`) into the state of one small random generator (`sfc32`), the same pair the other scenes use. The seed picks the night first: which side the figure on the ledge sits, how wide the view between the near blocks is, how smoky the air is, whether a temple spire stands among the buildings, and the colours and petals of the rangoli. Fine detail, like every wall colour, window, balcony and string of bulbs, comes from a hash of its position mixed with the seed, so resizing the window repaints the same city. The seed is shown at the bottom of the log.

### The city

There is no moon, because Diwali falls on the new moon, so the sky is dark and only the brightest stars get through the smoke and the city's light. Now and then a plane crosses very far above it all, one point of light with a double flash and a slow red blink, taking a minute or two and passing behind whatever stands in its way. There is no skyline either, because we are inside the city. The same kind of block goes on in every direction, six rows of them, each a little hazier than the last, with taller ones among them at every distance, until they close off the view. Roofs below eye level show their tops, with black water tanks, stair boxes and strings of bulbs along the parapets, and taller blocks show only a parapet against the sky. A few carry a red light for aircraft or a line of neon, and now and then a whole wall of lights hangs like a curtain. In the gap between the near blocks a side street runs off past a row of flats with shops at street level and a few old trees wound with fairy lights. The near blocks rise past our eye level on either side, with shops along the street below, and the street runs across the front with its lamps, sagging wires and bulbs strung over the road. Neighbouring buildings stand right beside us at both edges of the view and run past the top of the frame, close enough to see into. Our own roof comes last, and it is only a narrow strip along the bottom of the frame: the ledge, the wall below it, plants in old tins and the far part of a rangoli on the floor, cut off by the edge of the view. It has no flame of its own, only what the city throws back.

Each block is painted as flat colour first, then lit in one pass from a list of lights: rooms, balcony lamps, lanterns, diyas, shops and street lamps. A balcony's lamp stays inside its recess, so the walls stay dark with pools of light around them, and lights add up without ever burning out to white. Each row keeps three pictures, one with every electric light on, one with them off for a power cut, and the current one, and a window lighting up or going dark just copies its rectangle from one to the other. Rails, slabs and trees sit on a separate front layer, so people stand behind them.

### The lights

Strings of bulbs glow steady, or swell and fade slowly along the wire, each on its own clock, and the long strands down the corners of a block have a soft glint drifting down them. Paper lanterns are small heavy pendulums barely pushed by the air, with tails that trail behind the swing. Diyas and candles sit on the balcony rails with small, slow flames that hardly move. Each burns for its own length of time, anywhere from a few minutes to many hours, so they go out one by one and never together, and a gust can take a few at once.

One window high up keeps its own hours, chosen fresh each night and on a bare wall where one is free. Neon pours out through its blinds, drifting between two colours with a slow buzz, and its light spills over the wall around it. Rice lights are strung round the frame all the same, running along the top, hanging past the sides and across the glass, with a soft swell moving along the string.

### People

A person is a small skeleton, not a sprite. Each foot stays planted for its part of the step while the body moves over it, so nothing slides, knees and elbows come from two-bone reach, and hands and heads move on springs toward wherever a routine wants them. Nobody is in a hurry: a walk is an amble with short steps, at about half of real walking pace, and starts, stops and turns all ease in. Standing still is not still: weight drifts from foot to foot on a slow clock of its own. Everyone has their own height, stride, tempo, clothes and hair, and turning is a smooth change of facing, so nobody snaps from pose to pose.

Each person runs one small routine, written as a generator that yields once a tick, and every timing in it comes from a range. Visits only happen on balconies we can see, and the walls beside us get more than their share. Someone comes out and watches, leaning on the rail, looking about, pointing at what goes up. Someone paces on a phone call or films the sky. A family comes out one at a time, and the children hop when a shell opens. A child waves a sparkler in loops until it burns down. When diyas burn out, someone comes out with a plate of new ones, lifts each spent one off the rail and sets a lit one in its place, and relights any the wind took. When a big shell opens, some heads turn a moment later, each at its own speed. Most of the time people just stand there.

The man smoking gets the longest routine. He steps out, reaches into his pocket, lights up with cupped hands and a lighter that takes a few tries, then settles at the rail. A faint thread of smoke rises from the burning end. Each drag brightens the ember, a little smoke is let go a moment later, and he stands a long while between drags, looking about and tapping off the ash. At the end he flicks the stub over the rail, and it falls and bounces on the road below.

On the street people walk through alone or in twos and threes, and some stop to look up. Now and then a scooter, motorbike, auto, car or bicycle comes through at a crawl with its lights on. Once in a while someone sets a cracker on the road, lights it at arm's length and backs away, with the children kept well back: a flowerpot that climbs, roars and sputters out, a spinner skating about in a ring of sparks, or a string of crackers popping along the road in a run of hard white flashes and paper smoke. Up on the roofs, people stand rockets in bottles, light them and step smartly back.

### Fireworks

Depth decides everything about a shell: how big it opens, what stands in front of it, and how much of the city it lights. There are five depths, from small silent pops far across the rooftops to a big shell right over the lane, and most shells open in the sky left between the blocks. Everything in the air runs at about two thirds of real speed, so a shell's bloom and fall are slow enough to watch. A shell climbs on a slowing, slightly wandering path with a trail of sparks, then opens as one of nine types: a round shell, a chrysanthemum with trails, a gold willow that falls for seconds, a palm of a few heavy arms, a tilted ring, a crossette whose stars split into four, strobing stars, a crackling shell whose stars each pop at the end, or a double shell. Stars are spread over a sphere and seen flat, which gives a shell its roundness, and each has its own speed, drag, gravity and fade from white through its colour to an ember. A cake fires five to eleven shots from one spot, one after another.

A flash lights what faces it. The sky glows around the shell, the rows nearer than it stand out as silhouettes, and shells on our side of them wash the walls in their own colour, using a flat copy of each row's colours tinted by a soft pool of the flash. Smoke stays after the stars are gone and drifts off with the wind, and every shell thickens the long banks of smoke over the city, which thin again in the quiet.

### The one on the ledge

The figure on the ledge is close enough to paint a pixel at a time. It is built each frame into a small buffer: back and shoulders, sometimes a shawl with a gold hem, neck, head, hair in one of several styles, and arms. A last pass lets the flashes catch whichever edges face them and the city's glow warm the sides of the body from below. Head, lean and arms all move on slow springs, and long stretches pass with nothing but breathing. They sip from the cup, shift their weight, look down at the road, check a phone, stretch and slump. A big shell turns their head a moment after it opens, and their gaze follows it down.

### Events

The scene is meant to be slow, with only a few things happening at any moment. Each kind of event has its own timer, with exponentially distributed gaps, so the night has bursts and lulls instead of a beat. Far shells are the one exception: one goes up every 5 to 30 seconds whatever the mood of the night, so the distance is never quite still. The nearer fireworks are thinned over minutes on smooth noise, which makes their real gaps longer than the table below. That comes to about five shells a minute, most of them far off, with only one or two nearer ones and quiet stretches of up to about four minutes between those.

| Event | Average gap |
|---|---|
| A window lights up or goes dark | ~9 s |
| A far shell across the rooftops | 5 to 30 s |
| Someone crosses a room behind a curtain | ~18 s |
| Someone sees to a balcony's burnt-out diyas, when any need it | ~40 s |
| A man steps out to smoke, when nobody else is | ~60 s |
| Someone comes out on a balcony to watch | ~64 s |
| A vehicle passes | ~72 s |
| People walk along the street | ~78 s |
| A shell over the city | ~95 s |
| A sparkler on a balcony | ~2 min |
| A shell over the flats | ~3 min |
| A family comes out on a balcony | ~3 min |
| A phone call on a balcony | ~3.5 min |
| A rocket is lit on a roof | ~4 min |
| Someone films the sky | ~4.5 min |
| A gust swings the lanterns and takes a few diyas | ~4.5 min |
| A shell close by | ~5 min |
| A flowerpot on the road | ~5 min |
| A plane crosses, very far above the city | ~5 min |
| A cat walks along the ledge, and may bolt at a big shell | ~6 min |
| A ground spinner on the road | ~9 min |
| A big shell right over the lane | ~11 min |
| A string of crackers on the road | ~13 min |
| A cake of five to eleven shots | ~20 min |
| The power goes and the diyas have the street to themselves | ~25 min |

You can tune these in `assets/js/main.js`: the `SCHED` table holds the average gap (`m`) and the first appearance (`f`) for each event, with the shortest and longest gap (`lo`, `hi`) in place of `m` for far shells. Bulbs, beacons, smoke and a very light wind run all the time.

Before the first frame, the scene runs half a minute out of sight, so it opens on a night already under way, with a few people out and one shell open in the sky. With reduced motion on, it shows that frame and stays still.

## Testing

Two URL parameters help when changing the scene:

- `?speed=8` runs the scene eight times faster.
- `?debug` exposes the live state as `window.DW`. `DW.run(600)` simulates ten minutes at once, `DW.fire('smoker')` starts any event from `SCHED` now, `DW.launch({...})` sends up a shell of your choice, and `NightCity.paused = true` freezes the frame loop.
