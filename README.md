# First Touch — VR football

The entry file is **`index.html`**. JavaScript, styles, keeper geometry and the 13 supplied sound recordings are separate files. No package install or build step is required.

**Build V30:** shorter ordinary forward dribbling touches and a halfway restoration of firmer rebounds off your own boot. Ball respawn remains **A on the right controller**.

## Run / upload

1. Extract the entire ZIP.
2. Upload its contents to your game hosting folder, preserving `src/`, `styles/`, `vendor/` and `assets/` beside `index.html`. Replace the previous game files together.
3. Open the hosted page. Use HTTPS for the headset version.
4. Click **Enter VR** or **Play on screen** to unlock sound and begin. In VR, finish calibration before the starting whistle.

All 13 MP3 files are already included. No additional audio files are required to run this version.

Press **A** on the right VR controller for a new ball. **B** no longer respawns in VR. The desktop keyboard shortcut is still **B**; keyboard **A** remains left movement.

Walking is 4.3 m/s and sprinting is 5.8 m/s. Joystick direction changes retain the current movement speed. Rolling audio is a faint background detail, and very gentle ball touches are quieter.

Joystick movement and the real calibrated controller swing are now measured separately. During an ordinary forward ground touch, walking or sprinting no longer makes a small swing unlock the firm-shot response. The boot still contacts the ball at its actual physical speed; a deliberate strong swing progressively restores the established shot response. Extra rolling resistance acts smoothly in the ordinary-punt speed range, alongside the existing light-touch slowdown. The separated ball remains free: there is no attraction to the player or automatic ball following.

Firm incoming-ball rebounds off your own boot are restored halfway toward the earlier response: the receiving coefficient is 0.45, between the previous 0.30 and original 0.60. This controls the incoming-ball portion of the collision separately from active kicks. Very light receiving touches remain cushioned.

The instep lift and rising-foot response for kick-ups introduced in V29 remain. Calibration, visible boot geometry, contact shapes and walking/sprinting speed are unchanged.

The V28 net fixes remain: inside/outside state updates during every collision substep, and sloped-edge contacts require the ball to reach the actual triangle. Cloth looseness, deformation and boot interaction are unchanged.

For a local desktop preview, run this command from the extracted folder:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/`. Use a server instead of opening the HTML as a `file://` URL so modules and assets can load.

## Layout

| Path | Contents |
| --- | --- |
| `index.html` | Launcher and entry module |
| `styles/main.css` | Page styling |
| `src/main.js` | Asset loading and startup |
| `src/app.js` | Main loop, VR session and event routing |
| `src/config.js` | Pitch dimensions and constants |
| `src/player/` | Controls, calibration, boots and player legs |
| `src/physics/` | Ball and net physics |
| `src/keeper/` | Keeper behavior, animation and mesh loading |
| `src/world/` | Pitch, goals and lighting |
| `src/render/` | Deformed net rendering |
| `src/ui/` | VR menu and calibration panel |
| `src/audio.js` | Sample playback, spatial audio and rolling loop |
| `assets/models/keeper/` | Packed keeper geometry |
| `assets/audio/` | All MP3 recordings and active `manifest.json` |
| `vendor/three.js` | Included graphics library |

## Sound files

See **[SOUND_EFFECTS.md](SOUND_EFFECTS.md)** for the original-to-installed filename map, playback behavior and useful next recordings. Exact filenames matter. Audio loads from the local game folder; no CDN is required.

If sounds are missing after an upload, check that `assets/audio/manifest.json` and every MP3 from the ZIP reached the same hosting directory as the new code. Reload the page after replacing cached files and enter play with a click.

## Verification

V30 passed six focused physics groups, covering 18 calibrated forward side/toe punts at rest, walking and sprinting; feather touches; six joystick reversal replays; full-instep launches; continuous airborne keep-ups and a rising reception while walking. The additional receiving, powerful running-shot and curved-goal checks passed independently.

Representative measurements from identical calibrated controller traces:

| Scenario | V29 | V30 |
| --- | ---: | ---: |
| 2 m/s local sidefoot swing while walking: ball release speed | 9.93 m/s | 6.25 m/s |
| Same walking touch: maximum extra separation gained after release | 3.91 m | 0.52 m |
| Same walking touch: free coasting distance after release | 28.32 m | 12.52 m |
| 2 m/s local sidefoot swing while sprinting: maximum extra separation | 3.29 m | 0.27 m |
| 4 m/s sidefoot swing from a standstill: free coasting distance | 10.35 m | 7.13 m |
| 10 m/s incoming ball against a stationary boot: normal rebound speed | 3.00 m/s | 4.50 m/s |

Extra separation compares the released ball's forward travel with a player continuing at the same movement speed. It does not mean that the game attracts or automatically catches the ball. Total coasting distance describes a freely rolling ball with no later foot contact.

The new rolling loss fades in from 1.5 to 3 m/s, stays strongest through 6 m/s and fades out by 9 m/s. Strong ground passes can therefore settle sooner later in their roll. The tested strong running launches remained identical. The central power shot and both curved top-corner shots still score, with goal-line positions changing by less than 0.21 mm due to the requested receiving-rebound adjustment. The four-touch keep-up replay remains airborne and controlled.

Fifty-five movement checks covered controller swings, roomscale motion, locomotion, turning, direction reversals, pitch boundaries and tracking loss at 60–144 Hz and uneven render intervals. The additional locomotion metadata leaves the original calibrated poses, boot paths and movement velocities unchanged.

The integrated game passed a 414-frame calibration/input replay with A respawn, ignored right B input, tracking loss/recovery, menus and sound. Held A, reconnecting with A already pressed and menu transitions do not cause repeated or delayed respawns. All 17 JavaScript modules and 13 supplied MP3 recordings loaded; play caused no further asset fetches or sound decoding. The V28 net solver and all supplied audio files are unchanged.

Validation uses native execution of the actual calibrated controls, boot hull and ball solver, with replayed input and a recorded audio graph. It does not replace headset playtesting or a browser/GPU performance check.

Third-party library license: [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).
