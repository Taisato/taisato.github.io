# First Touch — VR football

The entry file is **`index.html`**. JavaScript, styles, keeper geometry and the 13 supplied sound recordings are separate files. No package install or build step is required.

## Run / upload

1. Extract the entire ZIP.
2. Upload its contents to your game hosting folder, preserving `src/`, `styles/`, `vendor/` and `assets/` beside `index.html`. Replace the previous game files together.
3. Open the hosted page. Use HTTPS for the headset version.
4. Click **Enter VR** or **Play on screen** to unlock sound and begin. In VR, finish calibration before the starting whistle.

All 13 MP3 files are already included. No additional audio files are required to run this version.

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

Third-party library license: [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).
