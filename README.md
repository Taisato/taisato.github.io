# First Touch — VR football

The entry file is **`index.html`**. JavaScript, styles, keeper geometry and the 13 supplied sound recordings are separate files. No package install or build step is required.

**Build V29:** easier instep lift and kick-ups, shorter rolls after light touches, and ball respawn on **A on the right controller**.

## Run / upload

1. Extract the entire ZIP.
2. Upload its contents to your game hosting folder, preserving `src/`, `styles/`, `vendor/` and `assets/` beside `index.html`. Replace the previous game files together.
3. Open the hosted page. Use HTTPS for the headset version.
4. Click **Enter VR** or **Play on screen** to unlock sound and begin. In VR, finish calibration before the starting whistle.

All 13 MP3 files are already included. No additional audio files are required to run this version.

Press **A** on the right VR controller for a new ball. **B** no longer respawns in VR. The desktop keyboard shortcut is still **B**; keyboard **A** remains left movement.

Walking is 4.3 m/s and sprinting is 5.8 m/s. Joystick direction changes retain the current movement speed. Rolling audio is a faint background detail, and very gentle ball touches are quieter.

Close control uses softer boot rebound and allows more tangential slip at moderate contact speeds. Fast swings regain the established shot response, including grazing curved strikes. V29 makes deliberate upward contacts more responsive and gives active ground-level instep strikes a modest lift from their existing speed. Light touches lose speed sooner during their final slow roll. Calibration and the visible boot/contact shapes are unchanged.

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

V29 passed nine focused physics checks: everyday and aligned full-instep launches, rising-foot lifts, four continuous airborne keep-ups, passive/departing-ball guards, light side/toe taps, six walking dribble replays, and preservation of non-instep low/power/curved shots and fast free motion. In the tested everyday full-instep pose, 6/12/18 m/s strikes now give approximately 4/13/42 cm maximum ball clearance above the turf; walking-speed contacts remain grounded. Representative light-tap coasting distances are 23–26% shorter.

The integrated controls also passed a 414-frame calibration/input replay with A respawn, ignored right B input, tracking loss/recovery, menus and sound. Held A, reconnecting with A already pressed and menu transitions do not cause repeated or delayed respawns. All 13 supplied MP3 files and the V28 net solver are unchanged.

Validation uses native execution of the actual calibrated controls, boot hull and ball solver, with replayed input and a recorded audio graph. It does not replace headset playtesting or a browser/GPU performance check.

Third-party library license: [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).
