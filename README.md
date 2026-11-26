# First Touch — VR football

**Build V34:** Continuous distant pitch markings, a visible VR menu pointer and a more gradual goalkeeper difficulty ramp. The V33 visual effects keep their exact strength.

## Play

Extract and upload the **entire ZIP**, keeping `src/`, `styles/`, `vendor/` and `assets/` beside **`index.html`**. No install or build step is required. Use HTTPS for VR. All 13 MP3 recordings are included.

Choose **Freeroam** or **3 TOUCH**, then **Enter VR** or **Play on screen**. VR uses the existing floor/playing-position calibration. Controls are available in the collapsed help section.

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

The goalkeeper now takes 30% more goals to reach a comparable ability: the previous 10-goal level is reached at 13 goals. The opening difficulty, eventual maximum and freeroam keeper are unchanged. Chance positions and their distance progression are unchanged.

## Pitch markings

Paint is filtered directly into the turf instead of using separate thin geometry. Close markings retain their 0.115-metre width; distant, subpixel lines retain enough coverage to stay continuous at shallow viewing angles. Circles, box corners and arc intersections remain joined. The fix adds no extra rendering pass and leaves chromatic aberration, motion effects and grain unchanged.

## Interface

The launcher, VR pause menu, calibration panels and challenge HUD share a navy, mint and lilac style without decorative background arcs. The HUD shows only touches, goals and lives. It keeps its current position in both VR and the desktop view, with adjustment for narrower or asymmetric headset projections. Result messages are brief; control instructions stay in the help section.

Menu rays and the selection marker draw over the panel. The marker has a white centre and dark rim, so it remains visible on both dark panels and bright buttons. The marker stays aligned with the selected button when both controllers point at the menu, and disappears immediately when the menu closes.

Chromatic separation is visibly stronger across the view, with extra separation following fast ball movement, boot swings and the goalkeeper's body and gloves. The effect uses actual object motion; rotating the camera alone does not generate object streaks. Scene depth confines the motion treatment to visible objects. The HUD is protected using its actual projected position in each eye.

Monochrome grain is stronger, especially in dark areas and the black sky. Opening the menu eases into stronger separation, grain and edge shading over 0.6 seconds. Menu and calibration surfaces receive their own local colour fringe. The desktop menu no longer blurs away the background effects.

The rendering effect uses one reusable scene target with depth and one composite pass, with each eye sampled separately in VR. Motion records and shader vectors are reused; only nearby projected objects require extra depth samples. The target resizes only when the output size changes. No additional image or sound assets are needed.

The HUD and menu textures update only when their displayed state changes. No extra font, texture or audio download is required.

## Files

| Path | Purpose |
| --- | --- |
| `index.html`, `styles/main.css` | Launcher and desktop interface |
| `src/main.js`, `src/app.js` | Loading, game flow and VR session |
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

Checks cover complete game flow, third-touch shots, life recovery, game over, restart, mode switching and recalibration. The existing 414-frame VR input replay still passes in freeroam. Challenge rules and all physical simulation files remain byte-identical to V33.

Keeper replays verify the slower progression, identical opening and freeroam behavior, completed dive/recovery animations and accurate high-corner goals against the maximum keeper. Only the score-to-difficulty ramp changed; ball/contact/rolling/curve/lift tuning, boot geometry, calibration, net physics and audio are unchanged.

The production canvas panels and CPU pointer previews were visually inspected. Native checks execute the bundled renderer's draw ordering, both-hand selection, all menu callbacks and immediate pointer cleanup. Paint checks cover shader construction, the unchanged turf, true circles, joined corners, narrow spots and 8,000 sampling phases at representative 5/20/50/100-metre distances. No tested phase lost the filtered line. CPU paint previews include the unchanged V33 chromatic separation and grain.

The optical and motion-effect modules remain byte-identical to V33. Integration checks cover their per-eye routing, menu fade, object motion and pause/reset behavior. The complete module graph and all sounds load without new fetches or audio decoding during play. These are native production-code replays, canvas renders and shader-equation checks, not a browser/GPU or headset playtest.

Sound-file mapping: [SOUND_EFFECTS.md](SOUND_EFFECTS.md). Library license: [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).
