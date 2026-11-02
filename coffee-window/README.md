# Coffee Window

A window seat in a late-night cafe in Night City. The inside of the cafe is painted as realistically as the scene can manage, and the neon street, drawn in the flat look of a cyberpunk anime, sits softly out of focus beyond the glass. Your coffee steams on the walnut counter while the street outside keeps moving: cars and taxis hiss past, people walk by under glowing umbrellas, flyers drift between the towers and a big screen loops its ads. Now and then you pick up the cup and drink. When it runs dry, a hatch slides open in the counter and a little robot rises out of it, rolls over and pours you a fresh cup. Sometimes a cat climbs onto the counter and curls up to sleep at the daisy's end. None of it is scripted, so no two nights play the same way.

## Run it

From the project root, run `npm install` once, then `just serve`, and open http://localhost:8765/coffee-window/. The scene on its own, as embeds use it, is at http://localhost:8765/coffee-window/embed/.

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
| `coffee-window.11tydata.json` | Author, title, share tags, share text, log counters and landing card text |
| `index.njk` | The scene page, built from the shared scene layout with the overlay |
| `embed.njk` | The scene on its own, for embeds |
| `assets/css/style.css` | Overlay styles |
| `assets/js/main.js` | The whole scene: street, people, cars, the cafe, the cup, the robot, the cat, events and drawing |
| `assets/images/logo.svg` | 16x16 pixel logo for the favicon |
| `assets/images/og.jpg` | 1200x630 share preview |

## How it works

Like the other scenes, everything comes from one generator seeded with the moment the page opens. It picks the night's mood (clear, wet or smoggy), the cafe's name in reversed neon on the glass, your cup, your arm (sometimes a chrome one), the robot's colours, the long Edison bulbs over the counter and the whole street across the road: its shops, signs, lit windows and the towers behind.

A daisy in a bud vase stands at one end of the counter and a small bookshelf at the other, holding two to four books, sometimes with the last one leaning over. The books are real classics, each with its title and author on the spine in its own language and script: Tolkien, Asimov, Archer, Austen, Orwell and Dickens, Hugo, Kafka, Dante, Cervantes, Goethe, Rilke, Neruda, Dostoevsky and Tolstoy, the Odyssey in Greek, Premchand, Bachchan and Dinkar in Hindi, Tagore, Bibhutibhushan and Satyajit Ray in Bengali, Soseki, Kawabata, Dazai, Murakami and Basho in Japanese, Dream of the Red Chamber, the Thirukkural in Tamil and Ghalib in Urdu. Japanese and Chinese spines stack their characters top to bottom, the way those books are bound. The log names what is on the shelf when the scene opens. Usually the cup is on its own. Sometimes a book lies open beside it, or a spiral notepad with a few lines of handwriting and a pen. About one night in 42 the cafe's lights are off, the bulbs hang dark, and a candle burns beside the daisy instead.

The scene is drawn in layers. The far city and the street across the road are painted once into off-screen canvases at half resolution, and the inside of the cafe at full resolution, with a hole where the glass is. Each frame draws the street at half resolution, the far city, then what moves in it (the big screen, flyers, blinking aerials), then the buildings, lit windows, neon signs, people, cars and their lights, and lays it in with a slight blur, like a camera focused on the counter. Then come the rain on the glass and the cafe over the top, with the street faintly reflected in the varnish, and finally the bulbs, the props on the counter, the cup and its steam, the robot and your hand.

Everything inside is shaded for realism rather than outlined: the glazed cup and saucer, the votive's amber glass and its flame, the daisy in a glass bud vase with water in it, the bookshelf's cloth-bound spines with their gilt bands, an open hardback with lines of print and a ribbon marker, a ruled notepad, the walnut boards with their grain, your hand (sometimes chrome), and the robot's moulded plastic. The cat's fur is built from strands over a lit shape with a fringe of fine hairs round its outline, then softened with a slight blur. The steam is a few tapering ribbons that rise and curl on smooth noise and fade as they climb, drawn into their own small canvas and blurred. The people and animals outside are backlit, with a rim of neon round their edges. Everyone moves with a proper gait: each foot stays planted while the body passes over it, then the knee lifts and the leg swings through, and the stride is timed to the speed so feet never slide. People stroll, walk, hurry or run (leaning in, arms pumping, both feet off the ground between strides), and some stop and stand around for a while before moving on. Dogs come in breeds with their own build, from terriers, corgis, dachshunds and pugs to labradors, shepherds, huskies and greyhounds, and walk, trot with diagonal legs together, or gallop, some on a lead keeping pace with their owner. Vehicles each keep their own pace, ease off behind slower traffic with their brake lights on, and now and then a taxi pulls over outside with its hazards blinking. The cat walks one leg after another, its tail held up in a question mark and swaying, and when it sits the tip of its tail lifts and taps now and then.

### The coffee

The coffee cools slowly, and its steam thins as it does. Now and then your hand comes in from the bottom right, takes the cup by the handle and lifts it toward you for a sip, then puts it back a little emptier. When the cup is empty, a while later a hatch opens in the counter and the robot rises out of it on a lift. It rolls to the cup, swings its spout over the rim and pours from the tank on its back until the cup is full and hot again, then rolls home and sinks out of sight.

### Everything else

Each kind of event has its own timer, with exponentially distributed gaps, so the night has bursts and lulls instead of a beat.

| Event | Average gap |
|---|---|
| A car, taxi, van, sports car, motorbike or delivery truck passes, keeping its distance from the one ahead | ~6 s |
| Someone strolls, walks, hurries, runs or stops to stand along the far pavement, now and then with a dog | ~9 s |
| Someone walks right past the window, sometimes under a glowing umbrella or lit by a phone, and now and then glances in | ~24 s |
| A window across the street lights up or goes dark | ~24 s |
| A flyer crosses the sky | ~28 s |
| You take a sip | ~40 s |
| A neon sign flickers, or sometimes goes out for a while | ~60 s |
| The big screen on the tower changes | ~70 s |
| A dog of some breed walks, trots or gallops by on its own, and may stop to sniff or look in at the window | ~110 s |
| A bulb over the counter flickers, unless the lights are off | ~200 s |
| A cat climbs onto the counter, settles by the daisy, then curls up to sleep or grooms and goes | ~300 s |
| It starts or stops raining, more likely on a wet night | ~420 s |

You can tune these in `assets/js/main.js`: the `SCHED` table holds the average gap (`m`) and the first appearance (`f`) for each event. Rain gathers on the glass in drops and runs down it in trails, and the road slowly gets wet and reflects the signs.

With reduced motion on, the scene shows its first frame and stays still.

## Testing

Two URL parameters help when changing the scene:

- `?speed=8` runs the scene eight times faster.
- `?debug` exposes the live state as `window.CF`. `CF.run(600)` simulates ten minutes at once, `CF.fire('cat')` starts any event from `SCHED` now, `CF.startSip()` takes a sip, `CF.refill()` empties the cup and calls the robot, `CF.cars()` and `CF.walkers()` list what is on the street, `CF.PROPS` holds what is on the counter, and `CF.paused = true` freezes the frame loop. Add `&dark` to see the rare night with the lights off.
