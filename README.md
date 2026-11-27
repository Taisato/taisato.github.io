# First Touch — VR football

## Play

For GitHub Pages, extract the ZIP directly into the repository's existing publishing folder. Overwrite the matching files. Keep **`index.html`**, **`src/`**, **`styles/`**, **`vendor/`** and **`assets/`** together at that level. Open the published HTTPS URL to play, including on a headset.

Choose **Freeroam** or **3 TOUCH**, then **Enter VR** or **Play on screen**. VR uses the existing floor/playing-position calibration. Controls are available in the collapsed help section.

For a local desktop preview, run `python3 -m http.server 8000` in the extracted folder and open `http://localhost:8000/`.

## Menu and slow motion

**Y** opens the menu in VR; **Esc** opens it on desktop. Opening the menu eases the world from **1× to 0.25× speed over 0.6 seconds**, using the same transition as the chromatic aberration. Closing it eases back to normal. Reversing the transition midway continues from the current speed.

The ball, goalkeeper, net simulation and challenge clock all run in slow motion. Physics still uses its normal fixed timestep, gravity and velocity values. Menu selection, camera tracking and controller poses remain responsive. Movement and kicking are disabled while selecting menu options.

Game sounds slow down with the world: existing sounds continue from their current playback position, and new impacts use the current speed. At quarter speed, recordings take four times as long and play at a lower pitch. Rolling retains its quiet mix.

A shot already in flight can score, be saved or go out while the menu is open. The result is counted once. Placement for the next chance waits until the menu closes. Switching away from the app, losing the graphics context or calibrating still suspends gameplay rather than allowing an unseen simulation to continue.

## Settings

Choose **Settings** in the launcher or in-game menu. Settings opens on **Graphics**, with tabs for **Gameplay** and **Other**. In VR, point and press the trigger to select a tab or control.

| Setting | Options | Default |
| --- | --- | --- |
| Turn speed | 0.25×–4×, in 0.25× steps | 1× |
| VR resolution | 100% (Full), 85%, 70%, 50% | 100% (Full) |
| Chromatic aberration | On / Off | On |
| Noise | On / Off | On |
| Shot Trace | On / Off | Off |
| Wind | Normal / Heavy | Normal |
| Stadium (Freeroam) | Blue, Amber, Violet, Jade, Crimson, Turquoise, Gold, Indigo, Rose, Lime | Blue |

**Graphics → VR resolution** applies immediately, including during a run. On Quest 3, Full requests an eye buffer large enough to cover the panel in both dimensions while preserving the browser’s eye aspect ratio. A 1680 × 1760 recommendation gives a target of approximately 2108 × 2208 per eye. A larger native size reported by the browser takes priority. If the browser limits its output, the game renders at the higher scene resolution and scales it to the granted buffer. Graphics shows the measured scene dimensions and adds an **XR output** line when those sizes differ. At 70%, the scene uses 70% of the full width and height. The browser saves your preferences when local storage is available.

**Gameplay → Turn speed** affects the right stick, desktop turn keys and horizontal mouse movement. The default is **1×**. Shot Trace is also under Gameplay.

The two effects are independent. Disabling aberration removes world colour separation, motion-based separation, and the fringe on the HUD, menus and calibration panels. Disabling noise removes animated grain, including behind the menu. Re-enabling either restores its original strength. Menu slow motion works with either effect disabled.

**Back** returns to the main menu while the world remains in slow motion. Desktop **Esc** does the same from Settings. **Resume** returns to play. Preferences survive restarting a run or changing modes.

Open **Settings → Other → Credits** for the game and sound attribution and special thanks.

Normal wind plays as a continuous stereo background during gameplay. Select **Wind → Heavy** for the second recording. Switching blends between the ambiences smoothly, and the choice is remembered with the other settings. Older saved settings automatically use Normal without resetting any existing preferences.

The wind follows menu slow motion along with the other sounds. Ball respawns and new chances do not restart it. Leaving the game or a true suspension stops the ambience. Normal wind plays at 40% of its previous level. The wind setting changes sound only.

In Freeroam, **Graphics → Stadium** changes the sky and its lighting immediately. In VR, use the arrows beside the current name. Your choice is saved for Freeroam.

Turn on **Shot Trace** to see the path the ball takes after each strike for up to 2.5 seconds. The setting applies in both Freeroam and 3 Touch.

## Modes

**Freeroam** uses the full-size pitch, current ball physics and goalkeeper. Right-controller **A** spawns a new ball; keyboard **B** does the same.

When you bring the ball close under control, the keeper steps out inside the six-yard box to narrow the angle. He sets himself for the shot and retreats as you move away. A direct kick, a fast body collision or a hard shot to the torso or head can knock him down. The fall follows the direction and point of contact. The keeper gets back to his feet and repositions for the next play.

**3 TOUCH** starts each chance with a stationary ball and the player facing the guarded goal. You have three touches and three lives. Opening chances are central, 11–15 metres from the goal line. Scoring gradually introduces longer approaches, tighter angles and a more capable keeper. At 15 goals, starts average about 20.7 metres from the goal line, roughly 4.2 metres outside the penalty area. Starting depth remains bounded at 27 metres.

- Score to regain one life, up to your current life limit, and move to a new chance.
- Lose one life when the ball goes out, the keeper secures it, or the final shot fails.
- The final allowed touch gets time to complete its shot. The next distinct touch loses the chance.
- By default, contacts less than 0.5 seconds apart count as one continuous sequence across both feet. Every contact still affects the ball normally.
- A parry remains playable when touches remain. Recovering the ball clears the pending save.
- There is no preparation timer or timer while touches remain. A final shot resolves when it stops, leaves play, scores or reaches the 14-second simulation-time failsafe.
- At zero lives, choose **Again**. Right-controller **A** also restarts a finished VR run. Free-ball respawn is disabled during a live challenge.

Use the menu to switch modes, restart or recalibrate. Recalibration preserves the current chance, ball, touches and lives. New chances refresh both legs before rendering their new position and clear old contact histories.

### Abilities

At each five-goal milestone, time slows to quarter speed. Aim at an available card and hold the trigger until it fills. On desktop, hold the card or its number key (1–3). A goal that takes the score past a milestone still earns its draft.

Picking Phase I pins that tree in the same slot. Its next phase stays available until you take it. Phase III completes the tree and closes the slot. When all three trees are complete, the run continues with the finished build. A new run resets the slots and effects.

Lilac outlines identify pinned upgrades. Rare upgrades have a gold outline with a soft glow.

Each draft with an open slot has a 20% chance to offer one rare upgrade. **1 Life Slot** adds a slot and restores one life, **Extra Touch** adds a touch per chance, and **Power Strike** adds 10% shot strength. Picking a rare leaves its slot open, and repeat picks stack.

First-Time Finish I, Double From Distance I and Woodwork Credit III each add one goal for a qualifying finish. With all three equipped, scoring off the post or crossbar on your first strike from outside the box is worth four goals and restores one life. Each 3 Touch run opens under Blue. Confirming a draft choice advances to the next of ten colored skies, returning to Blue after Lime.

| Tree | Phase I | Phase II | Phase III |
| --- | --- | --- | --- |
| First-Time Finish | Score with a genuine strike on first contact to add one goal. | Your opening strike gains 10% forward pace. | Keep the bonus with an immediate airborne finish after a keeper parry. |
| Double From Distance | Score from outside the penalty area to add one goal. | Shots struck from outside the penalty area launch with 10% more forward pace. | Score from 23 m or farther to bank a same-spot retry for an outside shot that goes straight out. |
| Bend It | Add 10% sideways curve to spinning shots. | Increase the curve bonus to 20%. | Low curlers retain their sidespin on the first bounce. |
| Grass Cutter | Firm ground shots have up to 40% less rolling resistance. | Increase the rolling resistance reduction to 55%. | Drive a knee-high ball downward to activate the bonus on landing. |
| Volley Boost | Airborne strikes gain 25% shot strength. | Keep the volley bonus for 0.25 s after a bounce. | Downward volleys retain more forward pace. |
| Woodwork Credit | The first post or bar hit each chance refunds one touch. | A shot out directly off the frame costs a life but carries one touch to the next chance. | A goal scored off a post or the crossbar adds one goal. |
| Quick Feet | Move 10% faster. | Move 25% faster for 2 s after a frame hit or keeper parry. | Your first recovery touch is free once per chance. |
| Touch Window | Add 0.5 s to the gap needed to count a new touch. | Gentle control uses a 1.25 s touch window. | Once per chance, a soft trap that would use your last touch is free. |
| Long-Range Bonus | A goal from outside the box adds one touch to your next chance. | Keep that extra touch in reserve until you spend it. | Bank up to two extra touches and spend both in one chance. |
| Keeper Setback | Lower the keeper difficulty by five goal levels. | The keeper takes 0.12 s longer to reverse after committing. | Once per chance, a wrong-footed keeper parries a ball they would have caught. |
| Last Chance | Once per run, a miss on your last life gives a same-spot retry. | Start a chance or retry on your last life with one extra touch. | Your run can use two retries in total. |

Quick Feet increases movement speed. Its extra run-up speed can add up to 10% to the forward pace of a shot compared with the same swing and contact at ordinary running speed. A stationary swing gets no extra pace from Quick Feet.

### Freeroam ability switcher

Open **Settings → Gameplay → Abilities** in Freeroam. Select I, II or III to equip a tree through that phase, combine any trees and adjust rare counts with the minus and plus buttons. Select **Off** to remove one tree or **Clear** to empty the loadout. Your Freeroam choices are saved in this browser.

With abilities equipped, the HUD shows practice goals, touches and lives for shots at the guarded goal. Press **B** on desktop or **A** on the right controller for the next ball. Starting-touch bonuses apply when you spawn the next ball. A protected retry returns to the original spot. A new ball after the last life starts fresh practice counters.

## Net damage

An exceptionally fast ball impact can rupture the back, side or roof of the net. The opening belongs to the existing deformable cloth: torn faces stop colliding, severed links release, and loose cord ends remain attached around the uneven edge. Ordinary catches still use the existing net response.

The impact and swept-crossing paths both require at least **33 m/s** of ball speed and outward impact speed relative to the cloth. The previous low-speed escape fallback has been removed. A lower-speed numerical crossing is contained. Shared material edges between panels are explicitly retained, including the corner where the side and back meet. Existing holes remain open and passable.

Damage lasts for the **whole 3 TOUCH run**. Scoring, losing one life and advancing to another chance do not repair the nets. At zero lives, the holes remain visible on the game-over screen. Choosing **Again**, pressing right-controller **A** at game over, or explicitly restarting begins a new run with repaired nets. Launching Freeroam again also repairs them. Free-ball respawns, menus, recalibration and tracking recovery preserve damage. A legal goal still counts when the ball subsequently breaks through the net.

## Boot contact and flight

The base ball speed ceiling is 38 m/s. Firm drives shed excess upward speed progressively at launch and keep their horizontal pace and spin. Low lifts use the usual contact response. Rising swings and airborne contacts allow extra height.

After a strike leaves the boot, sidespin can increase its flight pace by up to 8%. Firm shots headed high gain up to another 12% pace as their projected peak rises. This shortens travel time while preserving the flight path.

The follow-through correction addresses repeated contact after a firm strike. A tracked boot can outrun the ball at its speed ceiling, or accelerate and turn upward while the ball is still below that ceiling. These continuing overlaps can redirect an already-launched shot. The contact episode now releases that shot along its established direction rather than treating every overlap as another powered kick. The release also handles position separation, so correcting velocity alone cannot leave an upward position jump.

Power Strike and Volley Boost add speed at launch. The follow-through of that same swing leaves the boosted ball in free flight even across a brief tracking gap. A separate kick or trap can contact it again.

Genuinely separate kicks remain available. Ordinary controlled touches, rising kicks and curved shots continue through the existing contact solver. Returning from menu slow motion preserves the real speed of controller swings, so reduced simulation time does not multiply foot-impact power.

## Interface and rendering

Both goal frames now have rounded post/crossbar joints that match the existing frame radius. The corner and tube geometry share aligned circular segments and the same material, removing the missing outer corner and exposed flat tube ends. The four joints are static instances.

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

V43 was inspected using front and oblique close-up CPU projections of the actual production geometry. All four joints align with the existing frame endpoints and 6 cm radius. The complete geometry loads and disposes through the existing field lifecycle. All game files except this README and `src/world/field.js` are byte-identical to V42.

The physics and gameplay results below belong to the unchanged V42 modules.

Verification uses the actual production physics, calibrated controller motion and convex boot geometry. Matched replays separate the first impact from subsequent follow-through impulses and position corrections. Additional checks cover curved shots, deliberate loft, separate follow-up kicks, close control, receiving and unchanged free flight.

Net tests cover both goals, side/back seams, other joined edges, intact catches below the rupture threshold, exceptional hard impacts, finite open-mouth boundaries and existing holes. Application checks exercise scoring, lost lives, life recovery, complete run loss, the game-over screen and restart, with real damaged topology retained until the new run begins.

The V42 release passed **72 checks**: 11 focused follow-through checks, 12 net checks, 16 independent physics/integration checks, 23 full-application checks and 10 net-lifetime checks. The follow-through suite includes 14 strong steady strokes and 18 accelerating variants. The first-impact position, velocity and spin match the restored V40 response in the compared traces.

| Matched contact replay | V40 maximum upward speed | V42 maximum upward speed |
| --- | --- | --- |
| Strong shallow contact, 40 m/s stroke at 10° | 9.484 m/s | 4.441 m/s |
| Strong shallow contact, 44 m/s stroke at 8°, full instep | 19.015 m/s | 7.890 m/s |
| Accelerating 24→44 m/s stroke at 15°, full instep | 16.696 m/s | 7.028 m/s |

These are specific generated controller replays, not universal angles or speeds imposed on every kick. The correction retains the first strike direction and its intended loft. Affected final release speeds can differ because the erroneous extra-contact sequence is removed; there is no global shot-power reduction. Ordinary mirrored curved shots retain their previous trajectories and score from 16 m at approximately ±2.97 m from the goal centre, 1.91 m above the pitch, with 0.52 m of sideways bend.

The reported 27 m/s diagonal side/back-corner escape is reproduced in V40 and contained by V42. The 90-shot seam discovery grid changed from 10 intact escapes to zero. The focused final suite separately checks 14 mirrored/ground corner cases and 32 panel/speed cases. Existing seam-adjacent holes remain passable in both directions. A valid calibrated 38 m/s boot stroke from 8 m reaches the cloth at 33.694 m/s and tears it; the same stroke from 10 or 16 m is caught. The net-lifetime test keeps both goals damaged through scoring, a missed chance, life recovery and all three lost lives, then verifies full repair on Again.

Validation runs native production JavaScript and geometry, not a browser/GPU or physical-headset playtest. The controller replays are repeatable test movements rather than recordings from the latest user session.

Sound-file mapping: [SOUND_EFFECTS.md](SOUND_EFFECTS.md). Graphics library license: [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).
