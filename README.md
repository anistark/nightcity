# Night City

Experiments in generative scenes that run forever and never repeat.

Each scene is a small set of rules fed by one random generator. Nothing is a stored clip and nothing loops: events are generated as they happen, so no two runs play the same way.

## Run it

Open `index.html` in a browser. It lists every scene with a live preview and links to each one.

Each scene is a single browser page with no server, build step, install or libraries, so you can also open a scene's own `index.html` directly.

To serve over HTTP instead, use [just](https://github.com/casey/just):

```sh
just serve
```

```sh
just serve pixel-city
```

The first serves the whole project and the second serves one folder, both at http://localhost:8765. Pass a second argument to change the port.

Any missing path gets `404.html`, the way static hosts handle it. That page is a scene of its own: a moonlit beach seen from above, with waves that wash in at random and footprints they wipe away.

## Install it

Night City is a Progressive Web App. Serve it over HTTP, open it in Chrome, Edge or Safari, and use Install (or Add to Home Screen) to get it as an app with its own icon. Once it has loaded, it also works offline.

## Scenes

| Scene | What it is |
|---|---|
| [Pixel City](pixel-city/) | A pixel-art night city seen from a rooftop: traffic, a metro, a cat, pigeons, weather, flickering windows and neon |
| [Half Court](basketball-court/) | One-on-one basketball under the floodlights, in isometric view, with players in streetwear inspired by the Night City logo: real ball physics, dribble moves, blocks, steals, streetball rules, and a cat that wanders by |

## The approach

The scenes share a few rules for avoiding repetition:

- **One seed.** A single random generator, seeded from the clock when the page opens, drives every choice.
- **Independent timers.** Each kind of event waits a random, exponentially distributed gap, so the scene has bursts and lulls instead of a beat.
- **Variation inside every event.** Speed, colour, size, duration and direction come from continuous ranges, so the same kind of event never looks quite the same.
- **Slow drift.** Smooth noise shifts the overall mood over minutes, on top of the individual events.

These rules make exact repetition effectively impossible. The real target is *perceived* repetition, the feeling of "I've seen that before."

## License

[MIT](LICENSE) © 2026 Kumar Anirudha. The landing page is set in [Pixelspace](https://pixelspace.anirudha.dev). The Pixel City overlay uses Silkscreen and VT323 from Google Fonts. All three are under the SIL Open Font License.
