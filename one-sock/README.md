# One Sock

An unattended vending machine outside a closed laundromat at 4am. Every selection offers one sock, never a pair. No customers arrive. A cat sometimes investigates the warm cabinet while lights flicker, glass mists and lint moves across the pavement.

Open `/one-sock/` with the local server running. The scene on its own is at `/one-sock/embed/`. The shared overlay provides the clock, sharing, fullscreen and embed snippets, without an on-screen log. Click the canvas or press H to hide it and F for fullscreen.

The clock ticks from 04:00:00 to 04:00:59, then resets to 04:00:00. It follows scene time, including accelerated playback, and freezes in reduced motion or paused embeds. The overlay shows the real local time, and sharing includes the page-open seed.

One shared seeded generator supplies all choices. Independent exponential timers control flickers, condensation, a coin-return rattle, socks slipping inside their slots, passing headlights, a cat and breezes. The cabinet also has slow light surges, traveling glass reflections, selection-button lights, sliding droplets and faint vent heat. Only one cat and one passing-light effect can exist at a time, with at most six droplets. The displayed socks remain stocked, and the collection flap stays closed.

Mobile frames a large, centered cabinet close-up. From 768px wide, the view opens up to include the full laundromat, starry sky, stool and street. Socks have dark outlines, bright fabric and contrasting cuffs and heel patches against recessed dark slots. The street and cabinet are cached pixel art scaled by whole pixels. Signs, clock and overlay use Pixelspace, including in embeds. Scene lettering draws directly at display resolution. Drawing, font loading and resizing do not use the random generator.

The sky has 1100 seeded stars, with stylized Orion, Cassiopeia and Ursa Major's Big Dipper patterns and faint connecting lines. It is not a location-specific astronomical chart. Stars fill the sky above and beside the store, with the walls and pavement masked out. Every field star continuously shimmers at its own seeded rate and phase, with smooth noise varying its brightness and brighter stars forming tiny cross-shaped glints at their peaks. An independent timer brings occasional shooting stars with varied paths and fading tails, averaging 75 seconds between attempts. Only one shooting star can be active. The sky cache fills the available sky without regenerating its stars when the viewport changes.

The road uses one viewport-sized cache with a restrained depth gradient and fine seeded grain, keeping its texture uniform beyond the original scenery bounds. Local cabinet reflections remain visible over the surface.

Reduced motion shows a still, empty corner with a static star field and no shooting stars. Embeds omit the overlay and use the shared pause/play and quality behavior. One Sock does not load the character renderer.

The data file supplies metadata and counters for light flickers, cat visits, passing lights and shooting stars. The templates use the shared layouts, the scene lives in `assets/js/main.js`, the overlay styles in `assets/css/style.css`, and the logo and rendered share preview in `assets/images/`.

With `?debug`, `window.OS` exposes `pause()`, `run()`, `step(seconds)`, `draw()`, `state()` and `fire(event)`. State returns a copy. Events are flicker, mist, rattle, slip, car, cat, breeze, surge, glint, buttons, drip, vent and meteor. Debug pages also expose `render_game_to_text()` and `advanceTime(ms)` for automated recording and checks.

Run `npm run check:one-sock` to check the absence of customers, ambient events, seeded state, reduced motion, clock rollover and a long simulated session. These checks use Node and no extra dependencies.
