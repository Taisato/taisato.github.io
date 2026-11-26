# First Touch — installed audio

All 15 supplied recordings are included and connected. The original MP3 bytes are preserved; files were given consistent names. Audio uses `assets/audio/manifest.json`.

## Installed files

Every destination below is inside **`assets/audio/`**.

| Original recording | Installed filename | Plays for |
| --- | --- | --- |
| `light punt.mp3` | `ball_touch_soft_01.mp3` | Gentle boot contact and small touches |
| `medium kick.mp3` | `ball_kick_medium_01.mp3` | Ordinary passes and medium contacts |
| `solid shot.mp3` | `ball_kick_strong_01.mp3` | Strong kicks, first alternating variant |
| `solid shot 2.mp3` | `ball_kick_strong_02.mp3` | Strong kicks, second alternating variant |
| `hard shot.mp3` | `ball_kick_hard_01.mp3` | The strongest contacts and power shots |
| `slow woodwork.mp3` | `goal_frame_soft_01.mp3` | Light post / crossbar impact |
| `woodwork.mp3` | `goal_frame_hard_01.mp3` | Strong post / crossbar impact |
| `net.mp3` | `goal_net_01.mp3` | Net contact, variant 1 |
| `net 2.mp3` | `goal_net_02.mp3` | Net contact, variant 2 |
| `net 3.mp3` | `goal_net_03.mp3` | Net contact, variant 3 |
| `Goalkeeper being hit.mp3` | `keeper_hit_01.mp3` | Goalkeeper contact; currently shared by gloves and body |
| `roll.mp3` | `ball_roll_grass_loop.mp3` | Continuous rolling while the ball moves on the ground |
| `Whistle.mp3` | `whistle_start_01.mp3` | Once when a fresh mode entry or new run becomes ready |
| `normal wind.mp3` | `wind_normal.mp3` | Default continuous wind ambience |
| `Heavy wind.mp3` | `wind_heavy.mp3` | Alternative ambience selected through Settings → Wind |

## Playback behavior

- Small, medium, strong and hard contacts use different recordings. The two strong-shot clips alternate. Sound selection uses the actual normal contact speed, independently of the ball's physics.
- Very slow boot contacts fade smoothly toward silence. Contacts at 1.5 m/s and above retain their previous sound levels.
- Light and hard frame hits use their own recordings. All three net recordings cycle without immediate repetition; touching the net with a boot is quieter.
- Physical sounds come from their world positions and follow the player's head direction and distance. The starting whistle stays centred and keeps its stereo recording.
- Wind keeps the supplied stereo image and surrounds the scene without following the ball. Normal is the default; Settings → Wind selects Heavy and saves the choice. Loop seams are crossfaded, and switching ambience blends the recordings. Levels are balanced against the existing effects. Ball resets and new chances do not restart the wind; true suspension or leaving the game stops it.
- Leading low-level padding is removed from decoded impact samples, preserving 4 ms before the detected onset. The MP3 files themselves are unchanged.
- Rolling uses a crossfaded middle section of `roll.mp3`, avoiding its initial thump. Its level is 24.4 dB below the original mix, making it a faint close-range detail. One loop follows the ball, with volume and rate adjusted smoothly. Airborne motion, stopping, respawning with A in VR (B on the keyboard), calibration and interrupted play stop it.
- Opening the menu gradually slows ongoing and newly triggered game sounds with the world to 0.25× speed over 0.6 seconds. Existing sources, including the rolling loop, keep their playback position. Recordings last four times as long at quarter speed, with lower pitch. Closing the menu gradually restores the normal rate. Original sound variation and the quiet rolling mix are retained.
- The whistle plays once per fresh mode entry or new run. In VR it waits for calibration and trigger release. Ball respawn, menu resume, manual recalibration and automatically advancing a chance do not repeat it.
- Recordings are fetched once during startup. They are decoded before play when offline audio decoding is available; the compatibility path decodes once when audio is unlocked. No fetch or decoding happens in contact handlers or the frame loop.
- If an individual impact recording fails to load, a quiet synthesized impact fallback keeps the interaction audible. Missing audio never prevents the football simulation from starting.

## Where files go

Upload the entire ZIP contents beside `index.html`, preserving folders. Playback and mixing are in `src/audio.js`; game events and startup connect it through `src/app.js` and `src/main.js`. The audio manifest and all 15 MP3s are in `assets/audio/`. Replace the code and assets together.

Keep the exact installed filenames, including case. To replace a recording, overwrite its MP3 at the same path and reload. The `gain` field in `assets/audio/manifest.json` controls that recording's relative level. To change its filename, update the matching `file` field while retaining its `id`. Loop settings describe the supplied rolling and wind sources; revisit them if those recordings are replaced.

## Useful next recordings

The current build needs no extra files. These are proposed additions, not files it is currently trying to load.

| Suggested filename | Missing detail | Next integration |
| --- | --- | --- |
| `keeper_glove_save_01.mp3` | A distinct ball-on-latex glove sound | Separate existing glove saves from body contacts. |
| `ball_bounce_grass_01.mp3` | Ball bouncing on the pitch | Add a ground-impact audio event. |
| `boot_step_grass_01.mp3` | Boots stepping on grass | Add movement-driven steps for walking/running and the keeper. |
| `boot_scuff_grass_01.mp3` | A short boot scrape | Add a scuff trigger for suitable planted-foot movement. |
| `keeper_land_grass_01.mp3` | Keeper landing after a dive | Add a landing event in the keeper animation. |

Send these when available. Their eventual folder is also `assets/audio/`; adding a new filename by itself will not create a trigger. The new event and manifest mapping need to be connected as part of the next update. A separate gentle net-rubbing recording would also improve boot/net contact, which currently uses the provided net variants at lower volume.

For repeated effects, optional `_02` / `_03` variants are useful. Prefer one event per file, little leading silence, a natural tail and no added reverb. Mono is suitable for positional effects; ambience may be stereo.
