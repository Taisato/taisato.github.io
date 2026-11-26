# First Touch — VR football

**Build V39:** Restored the V36 ball physics and reduced both wind ambiences to 40% of their V38 playback level (2.5× quieter).

## Play

Extract and upload the **entire ZIP**, keeping `src/`, `styles/`, `vendor/` and `assets/` beside **`index.html`**. No install or build step is required. Use HTTPS for VR. All 15 MP3 recordings are included.

Choose **Freeroam** or **3 TOUCH**, then **Enter VR** or **Play on screen**. VR uses the existing floor/playing-position calibration. Controls are available in the collapsed help section.

For a local desktop preview, run `python3 -m http.server 8000` from the extracted folder and open `http://localhost:8000/`. Use a server so modules and assets can load.

## Menu and slow motion

**Y** opens the menu in VR; **Esc** opens it on desktop. Opening the menu eases the world from **1× to 0.25× speed over 0.6 seconds**, using the same transition as the chromatic aberration. Closing it eases back to normal. Reversing the transition midway continues from the current speed.

The ball, goalkeeper, net simulation and challenge clock all run in slow motion. Physics still uses its normal fixed timestep, gravity and velocity values. Menu selection, camera tracking and controller poses remain responsive. Movement and kicking are disabled while selecting menu options.

Game sounds slow down with the world: existing sounds continue from their current playback position, and new impacts use the current speed. At quarter speed, recordings take four times as long and play at a lower pitch. Rolling retains its quiet mix.

A shot already in flight can score, be saved or go out while the menu is open. The result is counted once. Placement for the next chance waits until the menu closes. Switching away from the app, losing the graphics context or calibrating still suspends gameplay rather than allowing an unseen simulation to continue.

## Settings

Choose **Settings** in the launcher or in-game menu. In VR, point and press the trigger to select a control.

| Setting | Options | Default |
| --- | --- | --- |
| Turn speed | 0.25×–4×, in 0.25× steps | 1× |
| Chromatic aberration | On / Off | On |
| Noise | On / Off | On |
| Wind | Normal / Heavy | Normal |

Changes apply immediately and are remembered in this browser when local storage is available. **1× turn speed** is the original turning speed. The setting affects the right stick, desktop turn keys and horizontal mouse movement; walking speed and vertical mouse sensitivity stay the same.

The two effects are independent. Disabling aberration removes world colour separation, motion-based separation, and the fringe on the HUD, menus and calibration panels. Disabling noise removes animated grain, including behind the menu. Re-enabling either restores its original strength. Menu slow motion works with either effect disabled.

**Back** returns to the main menu while the world remains in slow motion. Desktop **Esc** does the same from Settings. **Resume** returns to play. Preferences survive restarting a run or changing modes.

Normal wind plays as a continuous stereo background during gameplay. Select **Wind → Heavy** for the second recording. Switching blends between the ambiences smoothly, and the choice is remembered with the other settings. Older saved settings automatically use Normal without resetting any existing preferences.

The wind follows menu slow motion along with the other sounds. Ball respawns and new chances do not restart it. Leaving the game or a true suspension stops the ambience. Both wind tracks now play at 40% of their previous level. The wind setting changes sound only.

## Modes

**Freeroam** uses the full-size pitch, current ball physics and goalkeeper. Right-controller **A** spawns a new ball; keyboard **B** does the same.

**3 TOUCH** starts each chance with a stationary ball and the player facing the guarded goal. You have three touches and three lives. Opening chances are central, 11–15 metres from the goal line. Scoring gradually introduces longer approaches, tighter angles and a more capable keeper. At 15 goals, starts average about 20.7 metres from the goal line, roughly 4.2 metres outside the penalty area. Starting depth remains bounded at 27 metres.

- Score to regain one life, up to three, and move to a new chance.
- Lose one life when the ball goes out, the keeper secures it, or the final shot fails.
- The third touch gets time to complete its shot. A fourth distinct touch loses the chance.
- Contacts less than 0.5 seconds apart count as one continuous sequence across both feet. Every contact still affects the ball normally.
- A parry remains playable when touches remain. Recovering the ball clears the pending save.
- There is no preparation timer or timer while touches remain. A final shot resolves when it stops, leaves play, scores or reaches the 14-second simulation-time failsafe.
- At zero lives, choose **Again**. Right-controller **A** also restarts a finished VR run. Free-ball respawn is disabled during a live challenge.

Use the menu to switch modes, restart or recalibrate. Recalibration preserves the current chance, ball, touches and lives. New chances refresh both legs before rendering their new position and clear old contact histories.

## Boot contact

Ball physics is restored byte-for-byte from V36, before the latest fast inside-foot contact adjustment. This restores that version's contact response, instep lift, curve, rolling resistance and receiving behavior.

Returning from menu slow motion also preserves the real speed of controller swings, so the reduced simulation rate does not multiply foot-impact power.

## Interface and rendering

The navy, mint and lilac interface retains the lower 3 TOUCH HUD, visible menu cursor and compact result labels. HUD text retains its 25% reduction in local chromatic separation. Pitch markings remain filtered into the turf so distant lines and intersections stay continuous.

The optical effect still uses one reusable scene target and one composite pass, with each VR eye sampled separately. Settings update existing uniforms. Menu and HUD textures redraw only when their displayed state changes. The wind recordings add no textures or rendering passes.

## Files

| Path | Purpose |
| --- | --- |
| `index.html`, `styles/main.css` | Launcher and desktop interface |
| `src/main.js`, `src/app.js` | Loading, VR session, game flow and menu time scaling |
| `src/settings.js` | Preference defaults, bounds and persistence |
| `src/game/challenge.js` | Chances, touches, lives and scoring |
| `src/ui/` | Shared theme, menus, HUD and calibration |
| `src/player/` | Controls, calibrated legs and boots |
| `src/physics/`, `src/render/` | Ball, goal nets, pitch paint, optical effects and motion sources |
| `src/keeper/`, `assets/models/keeper/` | Keeper behavior, animation and geometry |
| `src/world/`, `src/config.js` | Pitch and dimensions |
| `src/audio.js`, `assets/audio/` | Sound playback and all 15 recordings |
| `vendor/three.js` | Included graphics library |

## Verification

The complete ball-physics module matches the released V36 file. All other gameplay code, settings, rendering and audio playback code match V38. Only the two wind gains change in the audio manifest: Normal 0.112 and Heavy 0.048, both 40% of their previous values. All 15 supplied MP3 files remain byte-identical.

Validation checks the exact rollback, retained menu slow motion, gameplay integration, audio settings and every ZIP member. It uses native production JavaScript, controller traces, canvas output and decoded audio; it is **not a browser/GPU or physical-headset playtest**.

Sound-file mapping: [SOUND_EFFECTS.md](SOUND_EFFECTS.md). Graphics library license: [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).
