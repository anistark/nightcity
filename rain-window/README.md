# Rain Window

Slow rain on a window at night, in front of a city out of focus, made to be calming. It moves at the pace of a resting heart: about one new drop a second, and nothing sudden. Drops land on the glass and sit. Neighbours touch and join, and once a drop is heavy enough it lets go and glides down, pausing as the glass holds it, swallowing every drop in its path and leaving a clear trail and a few droplets behind. Some runs stop halfway, some reach the bottom and fall off. Behind the glass, windows go dark and light up, cars and buses pass on the wet street, some crawling and some speeding, a beacon blinks on the tallest tower, and now and then the rain thickens a little or eases off, a breeze leans it onto the pane or lightning glows softly far away. None of it is scripted, so the glass never looks the same twice.

## Run it

Double-click `index.html`. It opens in any modern browser. There is no server, build step or install.

To serve it over HTTP instead, run `just serve rain-window` from the project root.

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
| `index.html` | Page markup: the canvas and the overlay |
| `assets/css/style.css` | Overlay styles |
| `assets/js/main.js` | The whole scene: generator, city, drops, events, drawing |
| `assets/images/logo.svg` | 16×16 pixel logo for the favicon |
| `assets/images/og.jpg` | 1200x630 share preview |

There are no libraries. Everything is drawn with plain Canvas 2D at the screen's full resolution. The only outside request is the Pixelspace font for the overlay. The back, fullscreen and share controls come from `scene-ui.js` and `scene-ui.css` in the project root.

## How it works

### One seed, from the clock

When the page opens, it hashes the current date and time down to the millisecond (`cyrb128`) into the state of one small random generator (`sfc32`), the same pair the other scenes use. The seed picks the hour and colour of the sky (blue hour, deep night, sodium haze or cold rain), the skyline, the lights, how hard it rains and every drop after that. It is shown at the bottom of the log.

### The city behind the glass

The skyline is generated once: far towers in the haze, nearer buildings with lit windows, a street with lamps, a glow over the city, sometimes a bridge and a neon sign. It is painted small, blurred and scaled up, so it looks like a camera focused on the glass, and every light is drawn on top as a soft disc, the way a lens draws a light out of focus. A second, much sharper copy is what the drops see.

### Drops

Rain lands at random times as a Poisson process, about one drop a second on average, so it comes in small clumps and gaps on its own. Each drop's size comes from a continuous range weighted toward small ones. The smallest specks never move, so they are drawn once into a mist layer, and some landings throw a few specks around them.

A drop that lands on another joins it. The smaller one slides into the bigger over about half a second while the bigger one swells, and a damped spring gives it a gentle wobble. Each drop has its own stickiness. Once it grows past it, the drop starts to run. Runs are slow, around ten pixels a second, and only a handful happen at once. Heavier drops go a little faster, and smooth noise makes each one hold and let go, so they pause and drift on instead of sliding at a steady speed. A running drop drifts a little sideways, swallows any drop in its path, wipes the mist and haze from the glass and picks up the water it wipes. It loses water as it goes and now and then leaves a droplet behind, so a run can stall halfway and wait for the next one to collect it. The wiped trail mists over again slowly.

### Drawing

Each drop is a lens. The sharp city is drawn inside its outline turned upside down and shrunk, the way a real drop shows the world behind it, then shaded with a dark rim where the curved water bends light away, a bright rim along the bottom and a small glint. A sitting drop is round and slightly uneven, and a running drop has a round head and a tapered tail. Each frame draws the blurred city, the live lights, the haze where the glass hasn't been wiped, the mist layer, the drops, a vignette and a little film grain.

### Rain and events

The strength of the rain drifts on smooth noise over minutes. On top of that, each kind of event has its own timer, with exponentially distributed gaps, so the night has bursts and lulls instead of a beat.

| Event | Average gap |
|---|---|
| A window across the street lights up or goes dark | ~15 s |
| A car, taxi, van or motorbike passes on the street below, at its own speed from a crawl to a rush, drifting faster and slower | ~25 s |
| A bus passes | ~120 s |
| The neon sign down the street dims and comes back | ~120 s |
| A breeze leans the rain onto the glass | ~130 s |
| Water spills over the top of the frame and runs down | ~150 s |
| A late train crosses the bridge, when there is one | ~210 s |
| A plane blinks across the sky | ~230 s |
| The rain thickens a little | ~260 s |
| The rain eases off | ~320 s |
| Lightning glows softly far away, only in heavier rain | ~480 s |

You can tune these in `assets/js/main.js`: the `SCHED` table holds the average gap (`m`) and the first appearance (`f`) for each event. The beacon on the tallest tower blinks all the time.

Before the first frame, the scene scatters drops over the glass and runs three minutes of rain out of sight, so it opens on a window that has been in the rain a while. With reduced motion on, it shows that frame and stays still.

## Testing

Two URL parameters help when changing the scene:

- `?speed=8` runs the scene eight times faster.
- `?debug` exposes the live state as `window.RW`. `RW.run(600)` simulates ten minutes at once, `RW.fire('shower')` starts any event from `SCHED` now, and `RW.paused = true` freezes the frame loop.
