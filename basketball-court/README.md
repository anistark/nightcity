# Half Court

Two players, one hoop, an outdoor court at night under the floodlights, seen in isometric view. They play one-on-one forever. Shots swish, roll in off the rim, bank off the glass, rim out, clank off the pole or fall short as air balls. Defenders contest, block and poke the ball loose, rebounds bounce wherever the physics sends them, and between games the players sit on the bench and catch their breath. A cat wanders by now and then. None of it is scripted: every move, shot and bounce is decided as it happens, so no two games play the same way.

## Run it

Double-click `index.html`. It opens in any modern browser. There is no server, build step or install.

To serve it over HTTP instead, run `just serve basketball-court` from the project root.

## Controls

- **Log** (bottom-right) or `L`: open the live event list with counters. The ✕ closes it.
- **Share** (top-right, beside fullscreen): a dialog with the link and a copy button, then X, Bluesky, LinkedIn and Reddit as pixel logos, plus your device's own share sheet where there is one. A separate **Embed** button gives copy-paste snippets for putting the scene behind another site or app.
- **Fullscreen** (top-right) or `F`.
- **Back** (bottom-left): return to the Night City landing page.
- Click the scene or press `H`: hide or show the overlay.

The title, clock and score sit in the top-left corner.

## Files

| File | What it holds |
|---|---|
| `index.html` | Page markup: the canvas and the overlay |
| `style.css` | Overlay styles |
| `main.js` | The whole simulation: generator, court, players, ball physics, events, drawing |
| `logo.svg` | 16×16 pixel logo for the favicon |

There are no libraries. Everything, including the avatars, is drawn with plain Canvas 2D at the screen's full resolution. The only outside request is the Pixelspace font for the overlay. The back, fullscreen and share controls come from `scene-ui.js` and `scene-ui.css` in the project root.

## How it works

### One seed, from the clock

When the page opens, it hashes the current date and time down to the millisecond (`cyrb128`) into the state of one small random generator (`sfc32`), the same pair Pixel City uses. The seed picks the court colours, the two players, the rules of the night and every decision after that. It is shown at the bottom of the log.

### Two players, drawn from ranges

Each player gets a height, speed, hops, shooting touch, handle, defence, reaction time, a favourite style (threes, mid-range, driving or the post) and sometimes a left hand. Outfits are drawn fresh each night around a neon accent colour, which also names the player (Cyan, Red, Lime and so on): a hoodie with the hood up or down, a tank or tee with a jersey number, or a track jacket, with shorts and socks or joggers, a cap or headband, one of several hairstyles, shades or none, and sometimes a beard. The Night City logo's look, hood up with aviators and neon trim, is one of the outfits. Each player's avatar next to the score is drawn from their outfit. Fatigue builds over a game and fades on the bench. Making shots warms a player up, and missing cools them down.

### The game

The rules come from the seed: a game to 7, 11 or 15, sometimes win by two, either make it take it or loser's ball, and ones and twos. Every possession starts with a check at the top of the key. After a defensive rebound or a steal, the ball has to go back past the arc before the new offense can score.

On offense, a player picks a plan: work to a spot for a three or a mid-range jumper, drive, back down in the post, or size the defender up. Dribble moves (crossover, between the legs, behind the back, hesitation, in and out, spin) can buy a step on a slow defender. The shot list covers layups, reverse layups, finger rolls, dunks, floaters, jumpers, pull-ups, step-backs, fadeaways, hooks, turnarounds, set shots, putbacks and the odd heave.

On defense, a player stays between the ball and the rim, gives a shooter less room than a driver, reacts with a lag, reaches for steals, contests shots and sometimes goes up for the block. A reach can draw a foul call.

### Ball physics

Every shot is aimed, not decided. The shooter picks an arc and a target point at the rim, with an error that grows with distance, contest and fatigue, and shrinks with skill. The ball then flies under gravity and collides with the rim (a torus), the backboard, the pole, the floor and the fences. Whether it goes in is up to the physics. Bank shots aim at the mirror image of the rim behind the glass. Very rarely, a soft shot wedges between the rim and the glass until someone jumps up and knocks it free.

### Events around the court

Each kind of event has its own timer, with exponentially distributed gaps, so the night has bursts and lulls instead of a beat.

| Event | Average gap |
|---|---|
| Someone strolls, walks, hurries, jogs or runs past the fence, alone, in a pair or with a dog, sometimes slowing to stop and watch | ~75 s |
| A cat wanders in, sits, grooms, watches, and dodges loose balls and players | ~110 s |
| A floodlight flickers, or cuts out for a while | ~130 s |
| A gust blows leaves across the court | ~150 s |
| Bats flit over the lights | ~200 s |
| A plane crosses the sky over the skyline | ~200 s |
| A player stops to tie a shoelace before the check | ~300 s |

You can tune these in `main.js`: the `SCHED` table holds the average gap (`m`) and the first appearance (`f`) for each event. Moths circle the lights, antenna lights blink on the skyline, and the wind sways the net all the time.

### Drawing

The court, lines, paint wear, cracks, skyline and bench are drawn once per resize as real geometry, in metres, through isometric canvas transforms, so lines stay smooth at any size. Warm pools of light from the three floodlights are added on top. The fence and light poles go on a second layer, so passersby can walk behind them.

Each frame, every player's body is rebuilt from a pose: feet, knees, hips, shoulders, head and hands, placed by what the player is doing. Feet plant where they land and grip the floor: a foot only lifts to step when the body has moved far enough from it, swings to where the body is heading, and plants again, with a flight phase when running. Knees and elbows come from two-bone inverse kinematics with real limb lengths, and the hips, shoulders, head and hands ease toward their new places, so stances blend instead of snapping. Players stop when they stop, with static friction instead of a slow creep. Posture follows what they are doing: upright when standing, walking or running, a low stance only when guarding up close, a crouch when sizing up a defender or gathering for a shot, and it eases between them. Passersby wear everyday clothes, keep their own pace, drifting faster and slower, and walk with their hands in their pockets, on a phone or swinging. The body bobs with the stride, leans into speed, folds forward when it crouches and sinks a little on landing. Fabric creases at bent knees and elbows, the jacket folds as the body bends, and the hem and hood trail when running. Every floodlight casts its own soft shadow under each player. The ball spins with its seams, the rim is a ring with a diamond-mesh net that swishes, and the backboard is glass with a reflection.

## Testing

Two URL parameters help when changing the simulation:

- `?speed=8` runs the scene eight times faster.
- `?debug` exposes the live state as `window.HC`. `HC.run(600)` simulates ten minutes at once, `HC.testShot('jumper', 2, 5.5, 300)` fires 300 open shots from one spot and reports how they went, `HC.step(n)` advances n frames without drawing, and `HC.paused = true` freezes the frame loop.
