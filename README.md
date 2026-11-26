# First Touch — VR football

**Build V36:** The 3 TOUCH overlay is one more visible strip-height lower. The menu now includes turn speed, chromatic aberration and noise settings.

## Play

Extract and upload the **entire ZIP**, keeping `src/`, `styles/`, `vendor/` and `assets/` beside **`index.html`**. No install or build step is required. Use HTTPS for VR. All 13 MP3 recordings are included.

Choose **Freeroam** or **3 TOUCH**, then **Enter VR** or **Play on screen**. VR uses the existing floor/playing-position calibration. Controls are available in the collapsed help section.

## Settings

Choose **Settings** in the launcher or pause menu. In VR, **Y** opens the menu and the controller trigger selects buttons. On desktop, **Esc** opens the menu.

| Setting | Range | Default |
| --- | --- | --- |
| Turn speed | 0.25×–4×, in 0.25× steps | 1×, the previous turning speed |
| Chromatic aberration | On / Off | On |
| Noise | On / Off | On |

Changes apply immediately and are saved in this browser when local storage is available. Turn speed controls the right stick, desktop turn keys and horizontal mouse turning. Walking speed and vertical mouse sensitivity are unchanged.

Chromatic aberration and noise are independent. Switching aberration off removes world colour separation, the extra separation around moving objects, and the HUD, menu and calibration fringe. Switching noise off removes animated grain, including the stronger grain behind the menu. Switching either effect back on restores its existing strength. Edge shading remains.

**Back** returns to the main menu while keeping the game paused. Desktop **Esc** does the same from Settings. **Resume**, or the normal menu button from the main menu, returns to play. Settings remain accessible after a run ends and persist through restarting or changing modes.

## Modes

**Freeroam** keeps the current full-size pitch, ball physics and goalkeeper. Right-controller **A** spawns a new ball; keyboard **B** does the same.

**3 TOUCH** starts each chance with a stationary ball and the player facing the guarded goal. You have three touches and three lives. The opening chances are central, 11–15 metres from the goal line. Goals introduce longer approaches and tighter angles while improving the keeper's reaction, movement, dives and recovery. At 15 goals, starts average about 20.7 metres from the goal line: roughly 4.2 metres beyond the front of the penalty area. Distance increases gradually and stays bounded, with a furthest depth of 27 metres.

- Score to gain one life, up to three, and move to a new chance.
- Lose one life when the ball goes out, the keeper actually secures it, or the final shot fails.
- Your third touch still gets time to complete its shot. A fourth distinct touch loses the chance.
- Contacts less than 0.5 seconds apart count as one continuous sequence, across both feet. A full 0.5-second gap is needed before another contact uses a touch. Every contact still affects the ball normally.
- A parry stays playable when touches remain. Recovering the ball clears the pending save.
- There is no preparation timer or timer while touches remain. A final shot resolves when it stops, leaves play, scores or reaches the 14-second failsafe.
- At zero lives, choose **Again**. Right-controller **A** also restarts a finished VR run. Free-ball respawn is disabled during a live challenge.

Pause to switch modes, start a new run or recalibrate. Recalibration preserves an active challenge's ball, touches and lives. A new run resets score and difficulty.

The goalkeeper retains the more gradual V34 progression: it takes 30% more goals to reach a comparable ability than in V33. The former 10-goal level is reached at 13 goals. The opening difficulty, eventual maximum and freeroam keeper are unchanged. Chance positions and their distance progression are unchanged.

New chances immediately refresh both legs from the current calibrated controller poses. Their contact and motion histories reset at the new position, so the previous chance's legs cannot appear for a frame or create a teleport kick.

## Boot contact

The boot still permits the existing 20-centimetre floor penetration. Controller motion blocked by that limit no longer contributes vertical kick energy. The contact solver retains real vertical boot motion without treating a visual clearance adjustment as a powered swing. Ordinary contact coefficients, instep lift, curve, rolling, receiving, and the ball's speed limit are unchanged.

## Pitch markings

Paint is filtered directly into the turf instead of using separate thin geometry. Close markings retain their 0.115-metre width; distant, subpixel lines retain enough coverage to stay continuous at shallow viewing angles. Circles, box corners and arc intersections remain joined. The fix adds no extra rendering pass and leaves chromatic aberration, motion effects and grain unchanged.

## Interface

The launcher, VR pause menu, calibration panels and challenge HUD share a navy, mint and lilac style without decorative background arcs. The HUD shows only touches, goals and lives. It is another visible strip-height lower than V35 in both VR and desktop, with adjustment for narrower or asymmetric headset projections. Result messages are brief; control instructions stay in the help section.

With aberration enabled, the VR HUD's text and its colour fringe retain their 25% reduction in local chromatic separation. Touch/life icons, panel borders, the world view, menu effects and grain keep their existing appearance. The desktop HUD remains its original unfiltered canvas. Text bounds update only when the displayed state changes; the adjustment adds no texture or rendering pass.

Menu rays and the selection marker draw over the panel. The marker has a white centre and dark rim, so it remains visible on both dark panels and bright buttons. The marker stays aligned with the selected button when both controllers point at the menu, and disappears immediately when the menu closes.

Chromatic separation is visibly stronger across the view, with extra separation following fast ball movement, boot swings and the goalkeeper's body and gloves. The effect uses actual object motion; rotating the camera alone does not generate object streaks. Scene depth confines the motion treatment to visible objects. The HUD is protected using its actual projected position in each eye.

Monochrome grain is stronger, especially in dark areas and the black sky. Opening the menu eases into stronger separation, grain and edge shading over 0.6 seconds. Menu and calibration surfaces receive their own local colour fringe. The desktop menu no longer blurs away the background effects.

The rendering effect uses one reusable scene target with depth and one composite pass, with each eye sampled separately in VR. Motion records and shader vectors are reused; only nearby projected objects require extra depth samples. The target resizes only when the output size changes. Settings update existing uniforms without rebuilding materials or adding passes. No additional image or sound assets are needed.

The HUD and menu textures update only when their displayed state changes. No extra font, texture or audio download is required.

## Files

| Path | Purpose |
| --- | --- |
| `index.html`, `styles/main.css` | Launcher and desktop interface |
| `src/main.js`, `src/app.js` | Loading, game flow and VR session |
| `src/settings.js` | Preference defaults, bounds and local persistence |
| `src/game/challenge.js` | Chances, touches, lives and scoring |
| `src/ui/` | Shared theme, menus, HUD and calibration |
| `src/player/` | Controls, calibrated legs and boots |
| `src/physics/`, `src/render/` | Ball, interactive goal nets, filtered pitch paint, optical rendering and motion sources |
| `src/keeper/`, `assets/models/keeper/` | Keeper behavior, animation and geometry |
| `src/world/`, `src/config.js` | Pitch and dimensions |
| `src/audio.js`, `assets/audio/` | Sound playback and all 13 recordings |
| `vendor/three.js` | Included graphics library |

For a local desktop preview, run `python3 -m http.server 8000` from the extracted folder and open `http://localhost:8000/`. Use a server so the modules and assets can load.

## Verification

Checks cover complete game flow, third-touch shots, life recovery, game over, restart, mode switching and recalibration. The existing 414-frame VR input replay remains identical at the default turn speed. Ball and net physics, challenge rules, boot geometry, calibration, goalkeeper, pitch markings, motion sources and audio are byte-identical to V35.

Settings checks cover both menu paths, selection rays, all speed steps and limits, mouse and stick turning, pause preservation, keyboard focus, immediate effects, reload persistence and unavailable or malformed storage. All four combinations of the effect switches are checked, including stereo routing, moving-object separation and menu transitions. Startup checks cover loading and failure. HUD projection checks verify the additional height change across ordinary and asymmetric eye projections.

The V34 goalkeeper and filtered pitch markings are unchanged. New transition replays cover the first rendered frame after goals and misses in VR and desktop at 72, 90 and 120 Hz, plus tracking recovery, restart and mode switches. They check both leg transforms, contact histories and motion-effect velocities.

An actual calibrated floor-limit fixture reproduced a 15.45 m/s upward launch from a boot with zero vertical movement. The corrected solver matches the stationary-input outcome. A second fixture starts with the foot clear of the ball and verifies that blocked upward motion is removed while real forward contact and natural lift remain.

Focused physics replays cover both feet, 72/90/120 Hz sampling, blocked downward motion, partial release, and instep clearance changes. Ordinary punts, feather touches, running power shots, lateral dribbling, keepups, full instep, passive rebounds, centre and curved-corner shots, free flight and rolling retain their exact tested V34 trajectories. Genuine upward foot motion remains free to produce high shots.

HUD checks cover every result label and multi-digit scores, including the visible colour fringe outside the glyphs. Raw canvas output, non-text pixels, menu/calibration shaders and the global compositor are compared with V34. Region objects are reused through state changes, resizing and asymmetric-eye fitting.

The global optical constants, shader source and motion-effect module remain exact; the compositor now honors the two independent switches. With both enabled, visual strengths and timing match V35. Integration checks cover per-eye routing, menu fade, object motion and pause/reset behavior. The complete module graph and all sounds load without new fetches or audio decoding during play. These are native production-code replays, canvas renders and shader-equation checks, not a browser/GPU or headset playtest. Release checks compare unaffected files against V35 and verify every ZIP member.

Sound-file mapping: [SOUND_EFFECTS.md](SOUND_EFFECTS.md). Library license: [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).
