# Tennis Court

Two players, a tennis court under the floodlights, seen in isometric view. Each night the court is grass, clay or a hard court. They play a singles match, best of three sets, then shake hands at the net, sit for a while and start another. Serves go wide, down the T or into the body, rallies run cross-court and down the line, players come to the net, lob, drop shot, smash and miss. None of it is scripted: every shot is aimed and then flies under real physics, and the rules judge where it lands, so no two points play the same way.

## Run it

From the project root, run `npm install` once, then `just serve`, and open http://localhost:8765/tennis-court/. The scene on its own, as embeds use it, is at http://localhost:8765/tennis-court/embed/.

## Controls

- **Log**, the page icon (bottom-right), or `L`: open the live event list with counters. The ✕ closes it.
- **Share** (top-right, beside fullscreen): a dialog with the link and a copy button, then X, Bluesky, LinkedIn and Reddit as pixel logos, plus your device's own share sheet where there is one. A separate **Embed** button gives copy-paste snippets for putting the scene behind another site or app.
- **Fullscreen** (top-right) or `F`.
- **Back** (bottom-left): return to the Night City landing page.
- Click the scene or press `H`: hide or show the overlay.

The title and clock sit in the top-left corner, and the scoreboard at the top: each player's avatar, the sets, the games and the points, with a dot by whoever is serving.

## Files

| File | What it holds |
|---|---|
| `tennis-court.11tydata.json` | Title, share tags, share text, log counters and landing card text |
| `index.njk` | The scene page, built from the shared scene layout with the overlay and the scoreboard |
| `embed.njk` | The scene on its own, for embeds |
| `assets/css/style.css` | Overlay and scoreboard styles |
| `assets/js/main.js` | The whole simulation: court, players, ball physics, aiming, rules, scoring, events, drawing |
| `assets/images/logo.svg` | 16×16 pixel logo for the favicon |
| `assets/images/og.jpg` | 1200x630 share preview |

There are no libraries. Everything, including the avatars, is drawn with plain Canvas 2D at the screen's full resolution. The only outside request is the Pixelspace font for the overlay. The seed, frame loop and embed mode come from `assets/js/nightcity.js` in the project root, and the overlay and its controls from the shared scene layout, `scene-ui.js` and `scene-ui.css`.

## How it works

### One seed, from the clock

When the page opens, it hashes the current date and time down to the millisecond (`cyrb128`) into the state of one small random generator (`sfc32`), the same pair every Night City scene uses. The seed picks the surface, the two players, who serves first and every decision after that. It is shown at the bottom of the log.

### Three surfaces

Each surface has its own look and its own bounce, and the players adapt to it.

- **Grass** is mown in stripes across the court and worn to bare earth behind the baselines, more or less depending on how late in the season the night falls. It is fast and low: the ball keeps most of its pace and stays down, worn patches can kick it sideways, and serve-and-volley pays.
- **Clay**, red or green, is brushed and grainy. It is slow and high: the ball loses pace and topspin kicks it up, so rallies run longer and players come in less. Players slide into hard stops, and every bounce and slide leaves a mark. On a close call the player checks the mark on the line. The marks fade at each set break, when the court is dragged and the lines swept.
- **Hard courts**, painted blue, green or purple with a different colour around them, bounce true at a medium pace. Black rubber streaks and a polished sheen show where players run most.

The net sags from 1.07 m at the posts to 0.914 m in the middle, and each floodlight throws its own faint shadow of it across the court.

### Two players, drawn from ranges

Each player gets a height, speed, reaction time, power, control, a serve, a liking for the net, topspin, slice, touch, nerve and temper, a one or two-handed backhand and sometimes a left hand. Kit is drawn fresh each night around a neon accent colour, which also names the player: a polo, tee, tank or dress, shorts or a skirt, a cap, visor, headband or bandana, wristbands and a racket. Some nights the club asks for whites, and the colour shows only in the trim. Confidence rises with points won, and fatigue builds over long rallies and fades at the changeovers.

### Ball physics

The ball flies with air drag and with spin: topspin dips it, slice floats it. How much height and pace the ball keeps through the bounce depends on the surface, and topspin kicks it up more on clay. The net is a real obstacle: a ball that clips the tape can trickle over or drop back, and a serve that clips it and lands in is a let.

### Every shot is aimed

The hitter reads the situation (how hard the ball was to reach, where the opponent stands, the score, how long the rally has gone on) and picks a shot: a drive cross-court, down the line or at the backhand, a slice, an approach, a passing shot, a lob, a drop shot, a volley or a smash. That gives a target, a pace, a spin and a net clearance, and the stroke is solved by simulating the flight until it lands on the target. Then an error spreads it, larger for a stretched, rushed or low ball, for a tired or nervous player, and for a big point. Whether it lands in is up to the physics.

### Reading the ball

The receiver predicts the ball's flight and picks where and when to meet it: a volley or smash before the bounce, or a ground stroke after it at a comfortable height, as early as they can get there. Feet plant and step as in Half Court, and the swing is timed to the ball, so the strings meet it at the middle of the stroke. A ball read as going out is left alone, and sometimes the read is wrong.

### The match

Points, games and sets follow the rules: deuce and advantage, a tiebreak at six games all, ends changed after odd games, and a rest on the chairs at the changeovers and between sets. Between points the players pick up the balls on their side, the receiver sends theirs back to the server, and the server bounces the ball a few times before tossing it. Now and then a toss gets caught and tried again.

### Events around the court

Each kind of event has its own timer, with exponentially distributed gaps, so the night has bursts and lulls instead of a beat.

| Event | Average gap |
|---|---|
| Someone strolls, walks, hurries, jogs or runs past the fence, alone, in a pair or with a dog, sometimes stopping to watch | ~70 s |
| A cat pads up to one of the far fences from outside, paws at it in a spot or two looking for a way in, gives up, sits a while and wanders off | ~120 s |
| A floodlight flickers, or cuts out for a while | ~140 s |
| A raven glides down to perch on the empty umpire's chair, looks about, preens and caws, and flaps off when play comes close | ~240 s |
| A gust blows leaves across the court | ~160 s |
| Bats flit over the lights | ~210 s |
| A plane crosses the sky over the skyline | ~200 s |
| A player stops to tie a shoelace between points | ~320 s |

You can tune these in `assets/js/main.js`: the `SCHED` table holds the average gap (`m`) and the first appearance (`f`) for each event. Moths circle the lights, antenna lights blink on the skyline, and a light breeze drifts the ball a little all the time.

### Drawing

The surface, lines, wear, trees, skyline and the shadow of the net are drawn once per resize as real geometry, in metres, through isometric canvas transforms. Ball marks and slides on clay go on their own layer as they happen. The fence and light poles go on another, so passersby and the cat can walk behind them. The windscreen hangs clear of the ground, so the cat shows under it. The net is drawn to its own layer and then in slices, sorted with the players, so a player can stand in front of one end of it and behind the other.

Each frame, every player's body is rebuilt from a pose, with knees and elbows from two-bone inverse kinematics. A stroke is a path of keyframes for the racket hand and the racket's direction, from the backswing through contact to the follow-through, with the shoulders turning into it. The racket is placed in 3D from the hand, with an oval head and strings, and blurs through a fast swing. The ball is drawn a little larger than life, so it reads at any size, with a streak when it flies fast.

## Testing

Two URL parameters help when changing the simulation:

- `?speed=8` runs the scene eight times faster.
- `?debug` exposes the live state as `window.GC`. `GC.run(600)` simulates ten minutes at once, `GC.step(n)` advances n frames without drawing, `GC.testShot(x, z, h, diff, n)` hits n shots from one spot and counts where they land, `GC.testServe(first, n)` does the same for serves, `GC.closeup(x, z, zoom)` draws the scene around a point at a larger scale, and `GC.paused = true` freezes the frame loop. `?debug&grass`, `?debug&clay` and `?debug&hard` force a surface. `GC.AIM` holds the error scales.
