# Pixel City

A pixel-art night city seen from a rooftop. Cars and buses cross the overpass. A metro rattles past. A cat wanders along the ledge. Pigeons, planes and the odd helicopter cross the sky. Windows light up and go dark, a neon sign loses a letter, and rain rolls in and clears. Nobody scripted any of it: every event is generated as it happens, so the scene never plays the same way twice and never loops.

## Why a city at night

The scene asks one question: *can a small set of rules, fed by a random generator, keep a scene feeling alive and never repeating?* A city at night fits well, because life there is made of small, independent things happening at irregular times.

In a simulated hour, the city produced about 1,700 events and no two were identical.

## Run it

Double-click `index.html`. It opens in any modern browser. There is no server, build step or install.

To serve it over HTTP instead, run `just serve pixel-city` from the project root.

## Controls

- **Log** (bottom-right) or `L`: open the live event list with counters. The ✕ closes it.
- **Share** (top-right, beside fullscreen): a dialog with the link and a copy button, then X, Bluesky, LinkedIn and Reddit as pixel logos, plus your device's own share sheet where there is one. A separate **Embed** button gives copy-paste snippets for putting the scene behind another site or app.
- **Fullscreen** (top-right) or `F`.
- **Back** (bottom-left): return to the Night City landing page.
- Click the scene or press `H`: hide or show the overlay.

The title and clock sit in the top-left corner.

## Files

| File | What it holds |
|---|---|
| `index.html` | Page markup: the canvas and the overlay |
| `assets/css/style.css` | Overlay styles and fonts |
| `assets/js/main.js` | The whole simulation: generator, world, events, drawing (about 46 KB) |
| `assets/images/logo.svg` | 16×16 pixel logo for the favicon |
| `assets/images/og.jpg` | 1200x630 share preview |

The scene uses no libraries and no image files. Everything is drawn with plain Canvas 2D at a low resolution, then scaled up with crisp pixels. The only outside requests are two Google Fonts (Silkscreen and VT323) for the overlay. Offline, the overlay falls back to a monospace font and the scene runs the same.

## How it works

### 1. One seed, from the clock

When the page opens, it takes the current date and time down to the millisecond, for example `2026-10-28 10:14:32.481`. It hashes that string (`cyrb128`) into the four-number state of a small, fast random generator (`sfc32`). Every random choice in the scene comes from that one generator. The seed is shown at the bottom of the log.

The seed fixes the **starting point**: the skyline, which windows are lit, the neon word, the rooftop props, the moon's phase. After that, frame timing also affects the order of random draws, so two screens opened at the same millisecond start identical but drift apart over time. Exact replay is not possible, because the simulation does not use a fixed time step.

### 2. Events on independent timers

Each kind of event has its own timer. The gap until the next one is drawn from an exponential distribution, which is the same kind of randomness as real arrivals: mostly near the average, sometimes much sooner, occasionally much later. That gives the scene bursts and lulls instead of a beat.

| Event | Average gap | Notes |
|---|---|---|
| Vehicle | ~4 s | Car, taxi, van, bus, truck, motorbike, scooter, rarely police or ambulance. Traffic density drifts over minutes. |
| Window life | ~13 s | Someone walks past, curtains move, a TV turns on or off |
| Cloud | ~26 s | |
| Neon sign | ~32 s | Loses a letter for a while, or stutters |
| Pigeons | ~42 s | Flock of 3-9 |
| Plane | ~55 s | Blinking navigation lights |
| Cat | ~60 s | Walks, sits, grooms, stares, trots, turns back |
| Metro | ~80 s | 3-6 cars, random lit windows, sparks |
| Shooting star | ~85 s | Skipped in heavy rain |
| Street lamp | ~95 s | Sputters or goes out for a while |
| Satellite | ~2 min | |
| Weather check | ~2.7 min | About 1 in 3 starts rain of random strength and length |
| Rooftop smoker | ~3 min | Door opens, light spills out, they smoke and go back in |
| Helicopter | ~3.3 min | Sometimes with a searchlight |
| Fireworks | ~13 min | 3-9 bursts |

Separately, hundreds of building windows each switch on and off on their own slow random timers.

You can tune these in `assets/js/main.js`: the `SCHED` table holds the average gap (`m`) and the first appearance (`f`) for each event.

### 3. Variation inside every event

An event is never a stored clip. Each one draws its details from continuous ranges: speed, colour, size, height, duration, direction, how many. Two taxis are never quite the same taxi.

Some things have small state machines. The cat chooses between walking, sitting, grooming, looking and trotting with weighted odds, and its tail and blinks run on their own random timers. Traffic in each lane slows down behind a slower vehicle.

### 4. Slow drift

Smooth noise (layered value noise) changes things over minutes rather than seconds: how busy the road is, which way and how hard the wind blows. Wind moves the laundry, the vent steam, cigarette smoke and the rain angle. The moon creeps across the sky. This keeps the overall mood shifting, not just the individual events.

### 5. Layers

The scene is drawn back to front: sky gradient with dithering, stars, moon, clouds, far skyline, mid skyline with lit windows and neon, the elevated metro, the road with traffic and lamp glow, the nearby building, then the rooftop with its props, the cat, particles and rain. Static layers are drawn once to off-screen canvases and reused each frame, so the page stays light.

## What "never repeats" means here

Repetition can be exact or perceived.

- **Exact repetition** is effectively impossible here. Every event has several continuous random parameters, so the chance of two matching exactly is negligible.
- **Perceived repetition** is the real risk: "that's the same bus again." Pixel City tackles it with many independent event types, random gaps, variation inside each event, and slow drift on top.

## Related projects

Similar ideas, for comparison:

- [Night City](https://github.com/jackcoldrick90/nightcity): walkable pixel city, mostly still, with timed lights and passing cars
- [cityscape](https://github.com/marianmeres/cityscape): endless parallax skyline from a seeded generator
- [Pixel City by Shamus Young (2009)](https://www.shamusyoung.com/twentysidedtale/?p=2940): procedural 3D night-city fly-through screensaver that shares this project's name
- [Johnny Castaway (1992)](https://en.wikipedia.org/wiki/Johnny_Castaway): screensaver with random scenes and clock-triggered holidays
- [Mountain (2014)](https://en.wikipedia.org/wiki/Mountain_(video_game)): a mountain that plays itself, with weather and random events
- [Reflection by Brian Eno](https://apps.apple.com/us/app/id1180524479): endless generative music whose rules follow the time of day

Pixel City differs in being a single, tiny browser page where the whole scene is a stream of small unscripted events.
