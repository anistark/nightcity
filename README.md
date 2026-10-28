# Night City

Experiments in generative scenes that run forever and never repeat.

Each scene is a small set of rules fed by one random generator. Nothing is a stored clip and nothing loops: events are generated as they happen, so no two runs play the same way.


## Scenes

| Scene | What it is | By |
|---|---|---|
| [Pixel City](pixel-city/) | A pixel-art night city seen from a rooftop: traffic, a metro, a cat, pigeons, weather, flickering windows and neon | [@anistark](https://github.com/anistark) |
| [Half Court](basketball-court/) | One-on-one basketball under the floodlights, in isometric view, with players in streetwear inspired by the Night City logo: real ball physics, dribble moves, blocks, steals, streetball rules, and a cat that wanders by | [@anistark](https://github.com/anistark) |

## The approach

The scenes share a few rules for avoiding repetition:

- **One seed.** A single random generator, seeded from the clock when the page opens, drives every choice.
- **Independent timers.** Each kind of event waits a random, exponentially distributed gap, so the scene has bursts and lulls instead of a beat.
- **Variation inside every event.** Speed, colour, size, duration and direction come from continuous ranges, so the same kind of event never looks quite the same.
- **Slow drift.** Smooth noise shifts the overall mood over minutes, on top of the individual events.

These rules make exact repetition effectively impossible. The real target is *perceived* repetition, the feeling of "I've seen that before."

## Run it locally

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

## Embed a scene

Any scene can run as the live background of another site or app. Paste one line before `</body>`:

```html
<script src="https://anistark.github.io/nightcity/embed.js" data-scene="pixel-city" async></script>
```

`data-scene` is `pixel-city` or `basketball-court`. Add `data-target="#hero"` to fill one element instead of the page, `data-dim="0.4"` to darken the scene under your text, or `data-quality="high"` for full resolution. The scene runs in an iframe, ignores clicks, is hidden from screen readers, and pauses while scrolled out of view.

Each scene's share dialog has an **Embed** option with snippets for HTML, a plain iframe, React, Vue, React Native and Flutter, plus the Content Security Policy line a site may need and a note on transparent backgrounds.

## Contribute

These two scenes are just the start. New scenes, fixes and ideas are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) explains how the project is laid out and how to add a scene, including how to credit yourself in the table above.

## License

[MIT](LICENSE) © 2026 Kumar Anirudha. The landing page is set in [Pixelspace](https://pixelspace.anirudha.dev). The Pixel City overlay uses Silkscreen and VT323 from Google Fonts. All three are under the SIL Open Font License.
