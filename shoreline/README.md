# Shoreline

A dark beach at night under the moon, looking out toward Night City across the bay. Waves run up the sand one after another, some only lapping at the wet edge, some running far up the beach, and foam laces the water and dissolves as each wave drains. Across the water is a low skyline of lit towers and neon, its glow smeared into long reflections, and fish, the odd fin and now and then a speedboat pass in the dark. None of it is scripted, so no two waves land the same way.

The scene runs in WebGL 2. Where that isn't available, a simpler Canvas 2D version of the beach runs instead, with crabs, clams and shells along the water's edge but no city.

## Run it

From the project root, run `npm install` once, then `just serve`, and open http://localhost:8765/shoreline/. The scene on its own, as embeds use it, is at http://localhost:8765/shoreline/embed/.

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
| `shoreline.11tydata.json` | Title, share tags, share text, log counters and landing card text |
| `index.njk` | The scene page, built from the shared scene layout with the overlay |
| `embed.njk` | The scene on its own, for embeds |
| `assets/css/style.css` | Overlay styles |
| `assets/js/main.js` | Starts `gl.js`, and holds the Canvas 2D fallback: sand and foam textures, waves, creatures, events, drawing |
| `assets/js/gl.js` | The scene: the beach, the bay and the city in one WebGL 2 fragment shader, with the waves and events that drive it |
| `assets/images/logo.svg` | 16×16 pixel logo for the favicon |
| `assets/images/og.jpg` | 1200x630 share preview |

There are no libraries. The shader is plain WebGL 2 and the fallback plain Canvas 2D. The only outside request is the Pixelspace font for the overlay. The seed, frame loop and embed mode come from `assets/js/nightcity.js` in the project root, and the overlay and its controls from the shared scene layout, `scene-ui.js` and `scene-ui.css`.

## How it works

### One seed, from the clock

The seed is the moment the page opened, hashed into one random generator shared with the other scenes. It picks the sand (white, pale or grey), who has walked on it, how lively the surf is, which way the tide is drifting, where the moon hangs, where the city sits on the far shore, how wide it spreads, its two neon colours and how clear the sky is. About one night in 28 has no moon at all, only the city's glow and more stars.

### The picture

The scene aims to look like a photograph. A camera at standing height looks out over the beach in real perspective, and a fragment shader works out every pixel:

- **Sand** is pale and grainy: mottled, scattered with dark mineral grains and bits of shell, with fine grain relief and low ripples. On top of that are lumps and hollows, sand kicked about, and on most nights footprints: trails along the beach or down to the water, and loose prints where people stood. Each print is a soft bowl, deeper at the heel and the ball of the foot, with a low rim, and the low moon leaves its far side in shade. A map of the beach, kept on the GPU, records what the water has done. Each time a wave covers a spot, its prints and lumps wear down a little, so near the water they fade over several minutes while higher up they last, but the grain always stays. Sand the water has just left turns darker and shinier, with faint lines down the slope, fading as it dries. Pinholes open where air escapes once the water has gone, and a thin line of dark grit and shell bits marks where each wave stopped, until the next one washes it off.
- **Water** has a surface: the raised lip of an incoming wave, a sheet that is deeper in some places than others, swell further out, and ripples that drift up the beach with the uprush and back with the drain. A thin sheet is clear and looks like the glossy wet sand it covers, but it is never glassy: its edge wobbles in small scallops, it ripples choppily as it runs up and runs in rills down the slope as it drains, and under about a centimetre it breaks into patches with sand showing through, so the backwash thins into islands and threads. Deeper, it bends the view of the sand, focuses moonlight into faint caustics, soaks up red light first and turns into a dark mirror. Sand churned up by the water clouds it behind the front and streaks back down the slope as it drains. Sand the water has only just left keeps a film that glitters, and a soaked darker band runs just ahead of the edge. Out past the swash, broken lines of surf roll in.
- **Foam** is a sheet of bubbles cut by holes of four sizes, thick along its strands and translucent where it thins, lit dimly by the moon so it never glares. The white roll along the front is thicker in places and broken in others. Behind it the foam spreads wide across the swash, opening into patches with loose bubbles between them, and lags behind the front so the lace stretches. It stays where the wave reached and pulls into streaks as the water drains. Where a new wave runs into water still draining from the last, the meeting line churns white, and spray flickers just ahead of a fast front. Fine detail fades out once it gets smaller than a pixel, so nothing shimmers.
- **Sky and city** are a dark night sky with a few stars, the moon and a faint glow around it. The moon's disc is drawn only in the sky: the water and wet sand mirror it as a soft glow and glitter, never a second disc. Across the bay, Night City is a low line of towers with lit windows, bands of neon in two colours and a haze of light above it. The water smears all of it into long vertical streaks, with a soft shimmer of the city's glow far out.

### Events

Things that happen out there, each on its own timer, with exponentially distributed gaps:

| Event | When |
|---|---|
| A flying car crosses above the towers | ~45 s |
| A speedboat idles slowly across the bay, drifting a little closer and further, lights streaking on the water and a faint wake behind it. A while later the wake reaches the beach as a small wave or two | ~150 s |
| A neon sign across the bay stutters | ~80 s |
| A small school of fish flickers through the shallows | ~110 s |
| The breaking foam glows blue with plankton for a minute or so | ~240 s |
| A cloud passes over the moon | ~240 s |
| A fin breaks the moon's path far out, then slips under | ~300 s |

You can tune these in `assets/js/gl.js`: the `SCHED` table holds the average gap (`m`) and the first appearance (`f`) for each event.

### Waves

A new wave arrives every 5 to 20 seconds or so, as a fixed wait plus an exponentially distributed one, so waves come in sets and lulls. Each runs a short, middling or long way up the sand, and the tide nudges that over minutes. Along its front, each stretch arrives a little earlier or later, runs up faster or slower and drains at its own pace, so the edge pushes ahead in fingers and pulls back in tongues instead of sliding as one curve. Between waves, the sea's edge rests in an uneven line that shifts slowly. The waves, tide and log run in JavaScript, in metres, and reach the shader through a small data texture each frame.

If frames keep running long, the render resolution steps down a little, at most a few times.

## Canvas 2D fallback

If WebGL 2 isn't available, or a shader fails to compile, `main.js` runs a Canvas 2D version of the beach instead, with no city or sea creatures but its own life along the water's edge. `?2d` opens it on purpose.

### Textures, made once

Sand and foam are generated pixel by pixel when the scene starts, and again when the window changes size.

- **Sand** is a tile of soft blotches, grain-level noise, and scattered pebbles, shell fragments and dark grains with small shadows. A darker, more even copy is the wet sand.
- **Foam** is a sheet of bubbles with round holes punched through it, from two sizes of jittered cells with their own radii, warped so no hole is a clean circle. A dense and a sparse version cut the same holes at two sizes, so when foam thins the same holes grow and join up.

### Waves

A new wave arrives every 4 to 20 seconds or so, as a fixed wait plus an exponentially distributed one, so waves come in sets and lulls. Each picks how far it runs, from a small one that stops short to a bigger one that races far up the sand, and the tide nudges that over minutes. Its front is a few lobes across the beach that runs up fast, slows, holds and drains back, a little earlier on one side than the other.

Every frame, the water's edge is the furthest any wave reaches at each point. The sand inside it is drawn through the water, darker toward the sea, with ripples drifting toward the shore and the moon's path on the surface. Foam masks are painted at low resolution so their edges come out soft: dense foam along each wave's leading edge, lace behind it, and a strand left on the line it reached. The foam textures are drawn through those masks, each with a faint shadow on the sand beneath, and a bright rim marks the edge of each wave while it runs up. The sand stays wet wherever water has been and slowly dries.

### Life on the beach

| Event | When |
|---|---|
| Tiny holes open in the sand as air escapes after each wave drains | Every wave |
| Coquina clams surface in the backwash and dig back in | About 1 wave in 5 |
| A ghost crab scuttles in, pauses, runs from the water and leaves or burrows | ~140 s |
| A wave leaves a shell on the sand, until a later wave rolls it back | ~170 s |
| A cloud passes over the moon and the beach goes dim | ~220 s |

Its own `SCHED` table in `assets/js/main.js` holds the average gap (`m`) and the first appearance (`f`) for each event.

### Drawing

Each frame draws the dry sand, the wet sand through its mask, things on the sand, the water, the foam and its shadows, then the moonlight over everything, glints on the water and wet sand, a vignette and a little film grain. The moonlight first takes out some of the colour, then tints the whole frame, and dims when a cloud passes.

## Testing

A few URL parameters help when changing the scene:

- `?speed=8` runs the scene eight times faster.
- `?debug` exposes the live state as `window.SH`. `SH.run(60)` simulates a minute at once, `SH.newWave()` sends a wave now, `SH.fire('boat')` starts any event from `SCHED` (`SH.fire('crab')` in the fallback), and `SH.paused = true` freezes the frame loop.
- `?2d` runs the Canvas 2D fallback, and `?glfail` makes the WebGL version fail and fall back, to test that path.
- `?glq=0.7` lowers the WebGL render resolution.
