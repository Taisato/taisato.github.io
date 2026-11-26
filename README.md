# First Touch — VR football

**Build V32:** Cleaner panels, a higher HUD, half-second touch counting, longer chances and a restrained optical finish.

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

## Interface

The launcher, VR pause menu, calibration panels and challenge HUD share a navy, mint and lilac style without decorative background arcs. The HUD shows only touches, goals and lives. It sits near the top of the view and adjusts to narrower or asymmetric headset projections to avoid clipping. Result messages are brief; control instructions stay in the help section.

The optical treatment combines subtle edge chromatic separation, fine grain and cooler shadows. Opening the menu eases into stronger separation and edge shading over 0.6 seconds. The aiming area and upper HUD remain clear. Menu and calibration surfaces receive a much smaller local colour fringe.

The rendering effect uses one reusable scene target and one composite pass, with each eye sampled separately in VR. The target resizes only when the output size changes; no additional image or sound assets are needed.

The HUD and menu textures update only when their displayed state changes. No extra font, texture or audio download is required.

## Files

| Path | Purpose |
| --- | --- |
| `index.html`, `styles/main.css` | Launcher and desktop interface |
| `src/main.js`, `src/app.js` | Loading, game flow and VR session |
| `src/game/challenge.js` | Chances, touches, lives and scoring |
| `src/ui/` | Shared theme, menus, HUD and calibration |
| `src/player/` | Controls, calibrated legs and boots |
| `src/physics/`, `src/render/` | Ball, interactive goal nets and optical rendering |
| `src/keeper/`, `assets/models/keeper/` | Keeper behavior, animation and geometry |
| `src/world/`, `src/config.js` | Pitch and dimensions |
| `src/audio.js`, `assets/audio/` | Sound playback and all 13 recordings |
| `vendor/three.js` | Included graphics library |

For a local desktop preview, run `python3 -m http.server 8000` from the extracted folder and open `http://localhost:8000/`. Use a server so the modules and assets can load.

## Verification

Checks cover 12,000 seeded chance placements, the exact half-second touch boundary, opposite-foot contact sequences, whole-ball goal and out detection at physics substeps, a completed third-touch shot, fourth-touch rejection, keeper parries and recovery, life restoration, game over, restart, mode switching and recalibration. The existing 414-frame VR input replay still passes in freeroam.

The keeper improves continuously while accurate high-corner shots remain possible. Switching to freeroam restores the previous keeper's exact behavior. This update changes neither ball/contact/rolling/curve/lift tuning nor the keeper, boot geometry, calibration, net physics or audio files.

The production canvas panels were rendered and visually inspected; native checks cover ray selection and HUD projection bounds. Optical verification covers per-eye sample boundaries, output routing, transition timing, target reuse and shader construction, with CPU previews used to compare strengths. The complete module graph and all sounds load without new fetches or audio decoding during play. These are native production-code replays, canvas renders and shader checks, not a browser/GPU or headset playtest.

Sound-file mapping: [SOUND_EFFECTS.md](SOUND_EFFECTS.md). Library license: [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).
