# First Touch — VR football

**Build V31:** Galactic Football-inspired menus and the new **3 TOUCH** mode.

## Play

Extract and upload the **entire ZIP**, keeping `src/`, `styles/`, `vendor/` and `assets/` beside **`index.html`**. No install or build step is required. Use HTTPS for VR. All 13 MP3 recordings are included.

Choose **Freeroam** or **3 TOUCH**, then **Enter VR** or **Play on screen**. VR uses the existing floor/playing-position calibration. Controls are available in the collapsed help section.

## Modes

**Freeroam** keeps the current full-size pitch, ball physics and goalkeeper. Right-controller **A** spawns a new ball; keyboard **B** does the same.

**3 TOUCH** starts each chance with a stationary ball and the player facing the guarded goal. You have three touches and three lives. The opening chances are central, 11–15 metres from the goal line. Goals introduce longer approaches and tighter angles while improving the keeper's reaction, movement, dives and recovery. Progression continues with diminishing increases within bounded physical limits.

- Score to gain one life, up to three, and move to a new chance.
- Lose one life when the ball goes out, the keeper actually secures it, or the final shot fails.
- Your third touch still gets time to complete its shot. A fourth distinct touch loses the chance.
- A parry stays playable when touches remain. Recovering the ball clears the pending save.
- There is no preparation timer or timer while touches remain. A final shot resolves when it stops, leaves play, scores or reaches the 14-second failsafe.
- At zero lives, choose **Again**. Right-controller **A** also restarts a finished VR run. Free-ball respawn is disabled during a live challenge.

Pause to switch modes, start a new run or recalibrate. Recalibration preserves an active challenge's ball, touches and lives. A new run resets score and difficulty.

## Interface

The launcher, VR pause menu, calibration panels and challenge HUD share a navy, mint and lilac style. The HUD shows only touches, goals and lives. Result messages are brief; control instructions stay in the help section.

The HUD and menu textures update only when their displayed state changes. No extra font, texture or audio download is required.

## Files

| Path | Purpose |
| --- | --- |
| `index.html`, `styles/main.css` | Launcher and desktop interface |
| `src/main.js`, `src/app.js` | Loading, game flow and VR session |
| `src/game/challenge.js` | Chances, touches, lives and scoring |
| `src/ui/` | Shared theme, menus, HUD and calibration |
| `src/player/` | Controls, calibrated legs and boots |
| `src/physics/`, `src/render/` | Ball and interactive goal nets |
| `src/keeper/`, `assets/models/keeper/` | Keeper behavior, animation and geometry |
| `src/world/`, `src/config.js` | Pitch and dimensions |
| `src/audio.js`, `assets/audio/` | Sound playback and all 13 recordings |
| `vendor/three.js` | Included graphics library |

For a local desktop preview, run `python3 -m http.server 8000` from the extracted folder and open `http://localhost:8000/`. Use a server so the modules and assets can load.

## Verification

The release passed 41 focused checks across mode rules, keeper behavior, UI and complete app flow. Checks include 1,500 seeded chance placements, whole-ball goal and out detection at physics substeps, a completed third-touch shot, fourth-touch rejection, keeper parries and recovery, life restoration, game over, restart, mode switching and recalibration. The existing 414-frame VR input replay still passes in freeroam.

The keeper improves continuously while accurate high-corner shots remain possible. Switching to freeroam restores the previous keeper's exact behavior. V30 contact, rolling, curve and lift tuning is unchanged; the ball solver only gained a passive movement observer for the mode's rules. Boot geometry, calibration, net physics and audio files are unchanged.

The actual production canvas menus, HUD and calibration panels were rendered and visually inspected, including ray selection. The complete module graph and all sounds load without new fetches or audio decoding during play. Verification uses native production-code replays and canvas rendering; it is not a browser/GPU or headset playtest.

Sound-file mapping: [SOUND_EFFECTS.md](SOUND_EFFECTS.md). Library license: [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).
