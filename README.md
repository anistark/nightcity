# Night City

Experiments in generative scenes that run forever and never repeat.

Each scene is a small set of rules fed by one random generator. Nothing is a stored clip and nothing loops: events are generated as they happen, so no two runs play the same way.


## Scenes

| Scene | What it is | By |
|---|---|---|
| [Pixel City](pixel-city/) | A pixel-art night city seen from a rooftop: traffic, a metro, a cat, pigeons, weather, flickering windows and neon | [@anistark](https://github.com/anistark) |
| [Half Court](basketball-court/) | One-on-one basketball under the floodlights, in isometric view, with players in streetwear inspired by the Night City logo: real ball physics, dribble moves, blocks, steals, streetball rules, and a cat that wanders by | [@anistark](https://github.com/anistark) |
| [Rain Window](rain-window/) | Slow rain on a window at night in front of a city out of focus: drops land, join, run down the glass and wipe clear trails, while cars, windows, showers and lightning come and go behind | [@anistark](https://github.com/anistark) |
| [Shoreline](shoreline/) | A dark beach under the moon, as waves run up the sand and drain away, with footprints in the sand, Night City glowing across the bay, and speedboats and sea creatures passing in the dark | [@anistark](https://github.com/anistark) |
| [Bus Stop](bus-stop/) | A late-night bus stop across an empty street, painted like an anime film: long quiet stretches, buses that go by without stopping, and now and then one person who waits, checks the road and finally gets on | [@anistark](https://github.com/anistark) |
| [One Sock](one-sock/) | An unattended sock vending machine at 4am, under a starry sky, with flickering lights and an occasional cat | [@pratik-anurag](https://github.com/pratik-anurag) |
| [Coffee Window](coffee-window/) | A window seat in a late-night cafe, with the neon street softly out of focus beyond the glass: your coffee steams while cars, people and dogs pass outside, you sip now and then, a little robot rises out of the counter to refill the cup, and sometimes a cat curls up to sleep | [@anistark](https://github.com/anistark) |
| [Tennis Court](tennis-court/) | A singles match under the floodlights, in isometric view, on grass, clay or a hard court picked each night: the ball flies with drag and spin and bounces the way the surface makes it, every shot is aimed rather than scripted, clay keeps ball marks for close calls, between points the players fetch balls and change ends, a cat paws at the fence trying to get in, and a raven perches on the umpire's chair | [@anistark](https://github.com/anistark) |
| [Bonfire](bonfire/) | A pixel-art bonfire in a clearing deep in the mountains: flames that lick and lean in the wind, sparks drifting into the stars and smoke above them, while far away between the ridges Night City glows and planes come and go from its airport | [@anistark](https://github.com/anistark) |
| [Diwali Night](diwali-night/) | The moonless night of Diwali in pixel art, from a rooftop in the thick of the city where someone sits on the ledge: blocks of flats all around strung with bulbs and paper lanterns, people drifting out onto their balconies, a man smoking by the rail, and now and then a firework going up between the buildings | [@anistark](https://github.com/anistark) |
| [Snow Bubble](snow-bubble/) | A soap bubble comes down close to the lens below moonlit snow mountains while others fall far off, frost spreads over it layer on layer until it is white, then it bursts into thin curved flakes that flutter into the snow, under a moon of its own each night or none at all, with a faint aurora and a snow leopard crossing a far ridge | [@pratik-anurag](https://github.com/pratik-anurag) |
| [Aurora](aurora/) | A wide river through thin snow with Night City and far mountains along the horizon, while curtains of aurora fold, curl, surge and fade across a real night sky and in the water, and boats drift past on the current: the curtains are simulated sheets of charge lit by the oxygen and nitrogen they strike, the stars and the Milky Way turn slowly behind them, and the snow takes on their light | [@anistark](https://github.com/anistark) |
| [Sakura Bus Stand](sakura-bus-stand/) | The view from a bench at a Night City bus stand, under a cherry tree in full bloom: petals drift slowly down and settle while the street carries on in front of you, with people, traffic and buses, a cat or a dog that comes over to look at you and leaves, and once in a long while a fight between chromed-up strangers | [@anistark](https://github.com/anistark) |
| [Mandala](mandala/) | A sand mandala made grain by grain on a board at night, seen from above, on wood, marble, stone, sand or grass among lamps, incense and offerings that change every night: chalk guidelines go down first, then coloured sand from the centre outward, every line traced and every section filled, slowly and calmly, by funnels that join as it grows, then after 42 seconds of rest it is cut, swept into a heap and poured into a bowl of water, and a new design begins | [@anistark](https://github.com/anistark) |

## The approach

The scenes share a few rules for avoiding repetition:

- **One seed.** A single random generator, seeded from the clock when the page opens, drives every choice.
- **Independent timers.** Each kind of event waits a random, exponentially distributed gap, so the scene has bursts and lulls instead of a beat.
- **Variation inside every event.** Speed, colour, size, duration and direction come from continuous ranges, so the same kind of event never looks quite the same.
- **Slow drift.** Smooth noise shifts the overall mood over minutes, on top of the individual events.

These rules make exact repetition effectively impossible. The real target is *perceived* repetition, the feeling of "I've seen that before."

## Run it locally

The site is built with [Eleventy](https://www.11ty.dev). With Node 24 and [just](https://github.com/casey/just) installed:

```sh
npm install
just serve
```

This serves the site at http://localhost:8765 and rebuilds on every change. The landing page lists every scene with a live preview and links to each one. The scenes themselves use no libraries, only plain JavaScript and Canvas 2D.

## Embed a scene

Any scene can run as the live background of another site or app. Paste one line before `</body>`:

```html
<script src="https://anistark.github.io/nightcity/embed.js" data-scene="pixel-city" async></script>
```

`data-scene` is `pixel-city`, `basketball-court`, `rain-window`, `shoreline`, `bus-stop`, `one-sock`, `coffee-window`, `tennis-court`, `bonfire`, `diwali-night`, `snow-bubble`, `aurora`, `sakura-bus-stand` or `mandala`. Add `data-target="#hero"` to fill one element instead of the page, `data-dim="0.4"` to darken the scene under your text, or `data-quality="high"` for full resolution. The scene runs in an iframe, ignores clicks, is hidden from screen readers, and pauses while scrolled out of view.

Each scene's share dialog has an **Embed** option with snippets for HTML, a plain iframe, React, Vue, React Native and Flutter, plus the Content Security Policy line a site may need and a note on transparent backgrounds.

## Contribute

These scenes are just the start. New scenes, fixes and ideas are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) explains how the project is laid out and how to add a scene, including how to credit yourself in the table above.

## Privacy

The site counts visits with Google Analytics. Embedded scenes, the landing page's live previews and local builds don't load it.

## License

[MIT](LICENSE) © 2026 Kumar Anirudha. The landing page is set in [Pixelspace](https://pixelspace.anirudha.dev). The Pixel City overlay uses Silkscreen and VT323 from Google Fonts. All three are under the SIL Open Font License.
