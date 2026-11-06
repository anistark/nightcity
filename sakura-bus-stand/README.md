# Sakura Bus Stand

You are sitting on a bench at a bus stand in Night City, under a cherry tree in full bloom. Petals let go of the branches and drift down, slowly, turning as they fall, and settle on the pavement and the road. In front of you the street gets on with its night. People walk past, taxis and vans go by, buses pull in with their lit windows, and a side street runs away from you between the lit shops. A cat comes over to look at you, sits for a while and leaves. A dog does the same with more enthusiasm. Once in a long while two chromed-up strangers stop nose to nose and it turns into a fight, and then it is over and they limp off in different directions while the petals keep falling. None of it is scripted, so no two nights play the same way.

## Run it

From the project root, run `npm install` once, then `just serve`, and open http://localhost:8765/sakura-bus-stand/. The scene on its own, as embeds use it, is at http://localhost:8765/sakura-bus-stand/embed/.

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
| `sakura-bus-stand.11tydata.json` | Title, share tags, share text, log counters and landing card text |
| `index.njk` | The scene page, built from the shared scene layout with the overlay |
| `embed.njk` | The scene on its own, for embeds |
| `assets/css/style.css` | Overlay styles and the vignette |
| `assets/js/main.js` | The whole scene: camera, city, tree, petals, people, animals, traffic, events, drawing |
| `assets/images/logo.svg` | 16×16 pixel logo for the favicon |
| `assets/images/og.jpg` | 1200x630 share preview |

There are no libraries. Everything is drawn with plain Canvas 2D at the screen's full resolution. The only outside request is the Pixelspace font for the overlay. The seed, frame loop and embed mode come from `assets/js/nightcity.js` in the project root, and the overlay and its controls from the shared scene layout, `scene-ui.js` and `scene-ui.css`.

## How it works

### One seed, from the clock

When the page opens, it hashes the current date and time down to the millisecond (`cyrb128`) into the state of one small random generator (`sfc32`), the same pair the other scenes use. The seed picks the night (clear, damp and neon, or warm and hazy), the kind of cherry (pale pink or a deeper pink), which side of the bench the tree stands on, the name of the stop and its routes, the colour of the buses, every building and sign, and every person, car and animal after that. It is shown at the bottom of the log.

### A seat at the side of the road

The view is a real camera, with its eye 1.15 m above the pavement, the height of someone sitting down, looking straight across the road. Everything on the street stands on the ground at a place in metres, and the camera works out where that lands on the screen. That is why people's heads rise above the horizon when they pass, the way they do when you are sitting, and why a cat that walks up to you really does get bigger. From near to far there is the pavement with its yellow guide tiles, the kerb, two lanes, the far pavement, and a row of shops and flats with one gap in it, where a side street runs away to the vanishing point. A phone gets a wider lens than a laptop, so a car still fits on the screen.

### The tree

The tree stands beside the bench and spreads above it, so looking across the road you don't see it, only what falls from it. Its place is measured out from the middle of the view in window heights, which means a wider window shows more of it. An ordinary window, including a maximised browser on a 16:9 monitor, shows none of it. From about 2.06 to 1 its outer blossom comes in at the side, a 21:9 monitor shows the edge of the trunk too, and a 32:9 monitor shows all of it. When it isn't in view it isn't painted at all.

When it is in view, the trunk and its main limbs are drawn as tapering outlines with the rings of cherry bark, lighter on the side facing the street. Boughs grow from the limbs, each one a walk of short steps that droop more the further they go, and each is stamped with flowers: five notched petals, in five tones from deep shadow to lit, darker on top and brighter underneath. Every bough is its own layer and sways slowly from its root on its own noise.

### Petals

Petals come in over the top of the view from the crown above you, a little more often on the tree's side. A petal falls at between 6 and 13 cm a second, slowed and sped by its own flutter, carried on a light wind and on slow eddies that change with height and depth, so one takes the best part of a minute to come down. It turns on two axes, so it goes thin as it tips edge-on. Petals close to you are large and out of focus, and ones across the road are specks. Passing cars drag the petals near them along. When a petal lands it is stamped flat into a layer on the ground, foreshortened by how far away it is, and slowly fades. Tyres clear a track through the ones on the road.

The rate of falling drifts on smooth noise, so there are thick spells and thin ones. A gust shakes the boughs and sends a rush of petals sideways past the stop.

### The look

The scene is drawn like a hard-edged neon anime: heavy blacks, flat colour with sharp-edged shadows, and light that arrives in shapes rather than soft gradients. Nothing in it comes from any particular show or game.

The far city is painted once. A skyline fades into the haze, the side street runs away between its walls, shops and lanterns, and the shops across the road stand in front. Walls are made of something, ribbed metal, tile, brick or concrete panels, with water stains, rust, pipes, cable runs, air conditioners dripping down the wall, balconies and rubbish along the kerb, from tiles of grime worked out once when the page loads. Each shop is a dark room with a hot ceiling, and throws hard wedges of its colour up the wall and across the pavement. The road has grit, tar lines, patches and worn paint, and its puddles are sharp mirrors of whatever stands over them. A last pass deepens the blacks and blooms only the brightest lights.

### Bodies

People are about seven and a half heads tall, long and lean, in bomber jackets, long coats, hoodies, puffers and tech vests with one loud accent, and a good many have chrome arms, visors or lines of light under the skin. Every limb is a smooth tapering shape with a knee or an elbow worked out from where the hand or foot has to be.

Everything that moves is lit where it stands, in three flat tones. The colour comes from the shops behind it, the light falls on the side of each part facing the brightest shops, and it moves across a person as they walk past. It is a shape inside each part of the body, never an outline around it.

### How they move

A body is 18 numbers: the hip, the chest, the twist between them, the head and each hand and foot. Poses are blended, not switched, so nobody snaps from walking to standing. A foot lands on its heel, rolls and pushes off its toe, and stays planted while the body goes over it, because the stride is worked out from the speed. The hips dip between steps, the shoulders swing against them, the arms swing a little late and the head stays level. People ease into a walk and slow to a stop. Hair and coats trail on springs, standing people shift their weight and breathe, and everybody blinks. Turning round is a quick narrowing and widening of the figure, not a flip in one frame.

Cats and dogs share one four-legged skeleton with breeds of different build. Their feet land one after another in a true walk or in diagonal pairs at a trot, the spine rises and falls, and hind legs have a proper hock. The tail is a chain of joints that lag behind each other, ears twitch, flanks breathe, and a sitting animal looks round, blinks and flicks its tail.

Vehicles ride on their springs, nose down under braking. Wheels are separate from the body and really turn, and their spokes blur together at speed. The colours of the shopfronts slide along car bodies as they pass, and headlights flare in a long thin line across the lens.

### Who comes by

People walk along both pavements, some on their phones, some with a dog, some in a hurry. Friends pass talking. Someone stops for a while to smoke or check their phone. Someone stops under the tree to look up at it, or holds a phone up to take a picture. People cross at the zebra, waiting at the kerb for a gap, and traffic stops for them. 
Someone may come to wait by the pole for a particular route. They look up the road and check their phone, and if nothing comes for long enough they give up. The panel on the pole counts down to the next bus. If someone is waiting for it, or someone on board wants to get off, it slows and pulls in with its indicator going, the doors open, and it fills your view for a moment. Otherwise it goes by. You stay on your bench.

A cat may be passing through, or it may settle on the far pavement in the light of a shop, or it may come to see you. Then it walks up, sits down in front of you and stares. It blinks, looks around, washes, and bats at a petal if one comes close, until it loses interest. A dog can do the same, tail going and tongue out, or just stop to sniff something and move on.

### A fight

About every ten minutes on average, and never in the first two, two or three hard cases walk in from opposite sides and stop face to face, on the far pavement or right in front of the stop. It starts with words and gestures, goes to a shove, and then to a few seconds of jabs, hooks, kicks and blocks, with sparks off the chrome. Passers-by stop to watch and cats run for it. It ends with one of them on the ground or with both backing off. Then they go their separate ways, one of them limping.

### Everything else

Each kind of event has its own timer, with exponentially distributed gaps, so the night has bursts and lulls instead of a beat.

| Event | Average gap |
|---|---|
| A car, taxi, van, truck, motorbike or courier, more often in some stretches than others | ~7 s |
| Someone walks along the far pavement | ~9 s |
| A window across the road lights up or goes dark | ~14 s |
| Someone walks along the near pavement | ~38 s |
| A flyer crosses the sky between the towers | ~45 s |
| A sign stutters | ~60 s |
| Someone crosses the road | ~65 s |
| Someone stops somewhere for a while | ~70 s |
| A gust goes through the tree | ~95 s |
| Two friends walk past | ~95 s |
| A delivery drone hums overhead | ~120 s |
| A cat appears | ~170 s |
| Someone comes to wait at the stop | ~170 s |
| A plane blinks across the sky | ~190 s |
| A bus goes by on the far side | ~210 s |
| A dog appears | ~220 s |
| Someone stops to look up at the tree | ~240 s |
| A police drone drifts down the road with its searchlight on | ~380 s |
| A little robot sweeps the pavement, clearing a line through the petals | ~520 s |
| It starts or stops raining, more likely on a damp night | ~560 s |
| A fight | ~640 s |

You can tune these in `assets/js/main.js`: the `SCHED` table holds the average gap (`m`) and the first appearance (`f`) for each event. Buses for the stop have their own timer, about three minutes apart, so the panel on the pole can count down to them.

With reduced motion on, the scene shows one still frame of a night already under way.

## Testing

Two URL parameters help when changing the scene:

- `?speed=8` runs the scene eight times faster.
- `?debug` exposes the live state as `window.SK`. `SK.run(600)` simulates ten minutes at once, `SK.fire('cat')` starts any event from `SCHED` now, `SK.brawl('near')` starts a fight in front of the stop, `SK.state()` sums up what is on the street, `SK.pause()` freezes the frame loop and `SK.draw()` paints one frame. `SK.lab('walk')` draws one part of the scene large on a plain ground, frame by frame, for checking shape and motion. It also takes `run`, `cast`, `big`, `views`, `head`, `fight`, `cat`, `catsit`, `dog`, `dogsit`, `cars` and `bus`.
