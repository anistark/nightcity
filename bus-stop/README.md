# Bus Stop

A late-night bus stop, seen from across an empty street, painted like a hand-drawn anime film. Most of the time nothing much happens. The shelter light hums, a car goes by, a window across the street goes dark. Buses come and go without stopping. Then someone walks up, reads the timetable and sits down to wait. They check their phone, look up the road, stand up when a bus comes and sit back down when it isn't theirs. When their bus finally pulls in, they get on, and you can see them through the lit windows walking to a seat as it pulls away. Then the stop is empty again. None of it is scripted, so no two nights play the same way.

## Run it

From the project root, run `npm install` once, then `just serve`, and open http://localhost:8765/bus-stop/. The scene on its own, as embeds use it, is at http://localhost:8765/bus-stop/embed/.

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
| `bus-stop.11tydata.json` | Title, share tags, share text, log counters and landing card text |
| `index.njk` | The scene page, built from the shared scene layout with the overlay |
| `embed.njk` | The scene on its own, for embeds |
| `assets/css/style.css` | Overlay styles |
| `assets/js/main.js` | The whole scene: generator, street, people, buses, events, lighting, drawing |
| `assets/images/logo.svg` | 16×16 pixel logo for the favicon |
| `assets/images/og.jpg` | 1200x630 share preview |

There are no libraries. Everything is drawn with plain Canvas 2D at the screen's full resolution. The only outside request is the Pixelspace font for the overlay. The seed, frame loop and embed mode come from `assets/js/nightcity.js` in the project root, and the overlay and its controls from the shared scene layout, `scene-ui.js` and `scene-ui.css`.

## How it works

### One seed, from the clock

When the page opens, it hashes the current date and time down to the millisecond (`cyrb128`) into the state of one small random generator (`sfc32`), the same pair the other scenes use. The seed picks the night (clear and cold, overcast, or damp and misty), the name of the stop and the two or three routes that stop there, the colour of the buses, the buildings across the street and which windows are lit, and every person, car and bus after that. It is shown at the bottom of the log.

### The street

The view is a window onto an 800 unit wide street, centred on the stop. A unit is about 8.5 cm, so a person is about 20 units tall. From the bottom up: the near pavement, two lanes of road, the far pavement with the shelter, the stop pole, a bin, street lamps and utility poles with wires slung between them, then a row of buildings with shops at street level and flats above, a skyline far behind and the sky. Windows have curtains, blinds, plant pots, air conditioners and the odd balcony with washing on it. Sometimes there is a moon, a street tree, a drinks machine glowing against a wall, a neon sign on the side of a building, or a launderette that stays lit all night. There is always one all-night shop, which closes at some point and pulls its shutter down.

### The look

The scene borrows the way animated films are made: painted backgrounds and flat-coloured characters on top. Backgrounds are soft colour fields with a little paper texture, painted brick suggested by a few loose bricks, big night clouds with a pale crown and a warm underside, and few outlines. People, animals and vehicles are cel-shaded: a flat colour, one darker tone with a hard edge on the side away from the light, and an inked outline. Faces are simple, with dark eyes and a highlight, and heads a little large, as anime draws them.

### Light

Everything is painted flat first, then lit. The street lamps, the strip light in the shelter, the shop, the poster, the drinks machine, the launderette and the lamps over doorways each add their colour, falling off with distance, through a light map smoothed over the street. The shelter light and the shop are kept apart, so the shelter light can flicker and go out and the shop can close. People, cars and buses are drawn into their own layer and lit with the same light, a little less strongly than the backgrounds so they stay easy to read, the way a film keeps its characters clear. Someone walking under the lamp warms up and someone on the bench takes the cold light of the shelter. Their own lights, a bus's lit windows, headlights, a phone screen, go on top unlit, and a soft glow goes over everything: halos round the lamps and their cones of light in damp air, the shelter light, the shop window and the headlights.

### The waiting

Someone comes to the stop on average every two and a half minutes, if nobody is there already. Now and then a second person arrives while the first is still waiting. Each person has a route in mind. They walk in from one side, stop at the pole to read the timetable, then sit on the bench or stand. While they wait, small things each run on their own timer: looking up the road, checking their phone, standing up to stretch or pacing a few steps, and in the cold, their breath showing. If nothing comes for a long time, they give up and walk away.

Buses come about every 75 seconds, each on a random route, with at least a minute between two buses on the same route. About one in eight is not in service, and some go the other way on the near side of the road. When a bus comes up the road, whoever is waiting stands and turns to watch it. If it's their route, the bus slows to a stop with its indicator blinking, they walk to the door and disappear behind it, and a moment later they walk down the aisle in the lit windows and sit down. If it isn't, it goes by and they sit back down. Sometimes a passenger gets off instead, and walks away once the bus has gone. Cars keep their distance from whatever is ahead, so traffic queues behind a bus at the stop.

### Everything else

Each kind of event has its own timer, with exponentially distributed gaps, so the night has bursts and lulls instead of a beat.

| Event | Average gap |
|---|---|
| A car, taxi, van, motorbike or delivery scooter passes, more often in some stretches than others | ~9 s |
| A window across the street lights up or goes dark, more often dark as the night goes on | ~16 s |
| A bus comes | ~75 s |
| The poster in the shelter scrolls to the next ad | ~80 s |
| Someone walks past, sometimes with a dog, sometimes running | ~95 s |
| Someone comes to wait | ~150 s |
| The wind blows a scrap of paper down the street | ~150 s |
| The shelter light flickers, and sometimes goes out for a while | ~170 s |
| A plane blinks across the sky | ~240 s |
| It starts or stops raining, more likely on a damp night | ~420 s |
| A cat walks along the pavement, and sometimes sits by the bench | ~420 s |
| The shop closes, once a night | ~700 s |

You can tune these in `assets/js/main.js`: the `SCHED` table holds the average gap (`m`) and the first appearance (`f`) for each event. Clouds drift with the wind, which itself drifts on smooth noise, and rain takes a while to wet the road and much longer to dry, leaving puddles and the reflections of the lamps on the asphalt.

About half the time the scene opens with someone already waiting on the bench. With reduced motion on, it shows that first frame and stays still.

## Testing

Two URL parameters help when changing the scene:

- `?speed=8` runs the scene eight times faster.
- `?debug` exposes the live state as `window.BS`. `BS.run(600)` simulates ten minutes at once, `BS.fire('arrive')` starts any event from `SCHED` now, `BS.people()` and `BS.veh()` list who and what is on the street, and `BS.paused = true` freezes the frame loop.
