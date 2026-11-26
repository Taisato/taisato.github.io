# First Touch — VR football

**Build V42:** Previous shot tuning restored, targeted follow-through correction, stronger net seams, rarer tears and damage that lasts for the whole 3 TOUCH run.

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

## Net damage

An exceptionally fast ball impact can rupture the back, side or roof of the net. The opening belongs to the existing deformable cloth: torn faces stop colliding, severed links release, and loose cord ends remain attached around the uneven edge. Ordinary catches still use the existing net response.

The impact and swept-crossing paths both require at least **33 m/s** of ball speed and outward impact speed relative to the cloth. The previous low-speed escape fallback has been removed. A lower-speed numerical crossing is contained. Shared material edges between panels are explicitly retained, including the corner where the side and back meet. Existing holes remain open and passable.

Damage lasts for the **whole 3 TOUCH run**. Scoring, losing one life and advancing to another chance do not repair the nets. After all three lives are lost, the holes remain visible on the game-over screen. Choosing **Again**, pressing right-controller **A** at game over, or explicitly restarting begins a new run with repaired nets. Launching Freeroam again also repairs them. Free-ball respawns, menus, recalibration and tracking recovery preserve damage. A legal goal still counts when the ball subsequently breaks through the net.

## Boot contact and flight

The V41 changes to shot power, instep assistance and upward aerodynamic lift have been reverted. Shot strength, the 38 m/s general speed ceiling, instep launch tuning, curve, ground rolling and receiving response use the previous tuning again.

The follow-through correction addresses repeated contact after a firm strike. A tracked boot can outrun the ball at its speed ceiling, or accelerate and turn upward while the ball is still below that ceiling. These continuing overlaps can redirect an already-launched shot. The contact episode now releases that shot along its established direction rather than treating every overlap as another powered kick. The release also handles position separation, so correcting velocity alone cannot leave an upward position jump.

Genuinely separate kicks remain available. Ordinary controlled touches, rising kicks and curved shots continue through the existing contact solver. Returning from menu slow motion preserves the real speed of controller swings, so reduced simulation time does not multiply foot-impact power.

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

Verification uses the actual production physics, calibrated controller motion and convex boot geometry. Matched replays separate the first impact from subsequent follow-through impulses and position corrections. Additional checks cover curved shots, deliberate loft, separate follow-up kicks, close control, receiving and unchanged free flight.

Net tests cover both goals, side/back seams, other joined edges, intact catches below the rupture threshold, exceptional hard impacts, finite open-mouth boundaries and existing holes. Application checks exercise scoring, lost lives, life recovery, complete run loss, the game-over screen and restart, with real damaged topology retained until the new run begins.

All **72 checks** passed on the final source: 11 focused follow-through checks, 12 net checks, 16 independent physics/integration checks, 23 full-application checks and 10 net-lifetime checks. The follow-through suite includes 14 strong steady strokes and 18 accelerating variants. The first-impact position, velocity and spin match the restored V40 response in the compared traces.

| Matched contact replay | V40 maximum upward speed | V42 maximum upward speed |
| --- | --- | --- |
| Strong shallow contact, 40 m/s stroke at 10° | 9.484 m/s | 4.441 m/s |
| Strong shallow contact, 44 m/s stroke at 8°, full instep | 19.015 m/s | 7.890 m/s |
| Accelerating 24→44 m/s stroke at 15°, full instep | 16.696 m/s | 7.028 m/s |

These are specific generated controller replays, not universal angles or speeds imposed on every kick. The correction retains the first strike direction and its intended loft. Affected final release speeds can differ because the erroneous extra-contact sequence is removed; there is no global shot-power reduction. Ordinary mirrored curved shots retain their previous trajectories and score from 16 m at approximately ±2.97 m from the goal centre, 1.91 m above the pitch, with 0.52 m of sideways bend.

The reported 27 m/s diagonal side/back-corner escape is reproduced in V40 and contained by V42. The 90-shot seam discovery grid changed from 10 intact escapes to zero. The focused final suite separately checks 14 mirrored/ground corner cases and 32 panel/speed cases. Existing seam-adjacent holes remain passable in both directions. A valid calibrated 38 m/s boot stroke from 8 m reaches the cloth at 33.694 m/s and tears it; the same stroke from 10 or 16 m is caught. The net-lifetime test keeps both goals damaged through scoring, a missed chance, life recovery and all three lost lives, then verifies full repair on Again.

Validation runs native production JavaScript and geometry, not a browser/GPU or physical-headset playtest. The controller replays are repeatable test movements rather than recordings from the latest user session.

Sound-file mapping: [SOUND_EFFECTS.md](SOUND_EFFECTS.md). Graphics library license: [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).
