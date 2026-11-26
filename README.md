# First Touch — VR football

**Build V38:** Added the supplied Normal wind ambience and a saved Normal / Heavy wind choice in Settings.

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

The wind follows menu slow motion along with the other sounds. Ball respawns and new chances do not restart it. Leaving the game or a true suspension stops the ambience. The wind setting changes sound only; the ball physics remains the V37 version.

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

Fast side-foot strikes could treat the boot's upper edge as a rigid upward ramp. V37 blends the impact response across that edge for fast, predominantly horizontal, actively driven side contacts with a ball close to the turf. The correction fades in with speed and contact angle. Actual boot geometry still determines collision detection and separation; normal and friction impulses use the same corrected response direction.

The change is local to that contact case. Ordinary touches, lower-angle strikes, deliberately rising kicks, airborne contacts and passive receiving retain the existing behavior. Gravity, drag, rolling resistance, spin decay, ball speed limits, instep lift and boot dimensions have not been retuned. The earlier protection against artificial kick energy from floor-constrained controller motion remains.

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

Ball and net physics, calibrated controls, goalkeeper behavior, challenge rules, HUD placement and optical shaders remain byte-identical to V37, retaining the previous shot correction and gameplay checks.

Wind checks cover the original MP3 files, prepared stereo loops, seamless wrap points, balanced levels, smooth switching, rapid repeated selections, voice limits and slow-motion playback. Integration checks cover the Normal default, migration from older preferences, saved Heavy selection, launcher and VR menu controls, ball resets, mode changes, suspension and disposal. Existing gameplay and menu behavior are also checked.

Validation uses native production JavaScript, calibrated controller traces, canvas renders, decoded audio and audio timing equations. It is **not a browser/GPU or physical-headset playtest**. Release checks compare unaffected files against V37 and verify every ZIP member.

Sound-file mapping: [SOUND_EFFECTS.md](SOUND_EFFECTS.md). Graphics library license: [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).
