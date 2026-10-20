# Worklive — The Atelier

An independent, interactive visual direction for Worklive: an architectural studio with original animated 3D characters, oak furniture, sage cabinetry, arched windows and a coffee lounge.

This is a visual concept, not a Worklive release. It is separate from Claude Code’s visual experiments and from the installed app. It does not access real agents, subscription credentials, task files, local memory or browser sessions.

## Open

While the local preview server is running, visit **http://127.0.0.1:8773/**.

To start it again, run this from this folder:

```sh
python3 -m http.server 8773 --bind 127.0.0.1
```

Open that address in a browser supporting WebGL 2. No build, account, package installation or internet connection is required. The page must be served over HTTP rather than opened as a file.

## Explore

- Drag the room to orbit; scroll to zoom; right-drag to pan.
- Choose **Studio**, **Desks** or **Coffee corner** for smooth camera moves.
- Choose a teammate in the bottom roster to see its illustrative activity. **Meet agent** moves closer to the character’s face.
- Click a desk monitor, or use **View screen**, to enlarge its designed screen content.
- Switch between **Golden hour** and **After hours**. Pause or resume character animation with the adjacent button.
- **Invite an agent** adds a local character and a desk, up to six characters. Choose Codex or Claude Code to set its shirt color. Refreshing returns to the original four characters.
- **Projects** and **Library** show illustrative project and memory panels.
- Press Escape to close a dialog or return to the studio. Controls also support keyboard activation.

## What is actually 3D

Every character and room object is built in JavaScript using Three.js. These are real, orbitable meshes, not generated pictures or a prerecorded video. Characters have modeled faces, eyes, hair, clothing, pockets, glasses where appropriate, and jointed arms and legs. Their poses include typing, a coffee break, subtle head movement and blinking.

No Blender models, downloaded character models, image generation or paid asset services were used. Procedural canvas textures supply wood grain, rugs, window views, signs and desk screens. Three.js and its bundled helper modules are vendored locally under their MIT license; see `vendor/THREE-LICENSE.txt`.

The render uses physically shaded materials, directional shadows, image-based room lighting and GTAO contact shading. Reduced-motion preferences initially pause character animation. Camera movement remains manually initiated.

Provider shirt base colors are fixed:

- Codex: `#2D9D8F`
- Claude Code: `#D97757`

Scene lighting naturally changes their apparent brightness. The roster and detail card also name the provider.

## Scope and integration

The screens are designed examples, not live browser captures. Task descriptions, project states and memory entries are illustrative. Invited characters exist only in the page’s memory. No model calls, official CLI calls, file uploads, task execution or persistence occur in this concept.

This room accommodates six characters for visual evaluation. It does not implement automatic departments/floors, large-office growth, pathfinding or production agent routines. Those belong to Worklive’s existing systems or future work.

To adopt this direction, transfer the character builder, environment styling and camera treatment into the application’s existing office renderer. Keep the real lifecycle, collision avoidance, browser textures, memories and provider supervision in their current modules. Benchmark rendering and add level-of-detail/instancing before scaling the style to many agents.

## Validation — 2026-09-30

The concept’s three authored JavaScript modules passed syntax checks. In the browser, verified scene rendering, character profiles and close-up views, all three camera presets, enlarged article screens (including a direct click on a 3D monitor), day/evening changes, pause/resume, both provider options, two new desks up to the six-character limit, and project/library dialogs. No browser console errors were reported during those checks. Semantic keyboard activation was used because the in-app browser’s automated click coordinates were offset. Direct monitor raycasting was verified; unrestricted camera dragging was not separately end-to-end verified.

The normal compact preview and the desktop breakpoint were inspected. Desktop viewport emulation exhibited screenshot/input offsets; its temporary override was reset. This is not a full cross-browser or production performance audit.

The unchanged application baseline was also checked: **39 JavaScript tests passed** (34 worker + 5 office), **30 Rust tests passed**, and 2 live-subscription tests remained ignored. The installed app was not rebuilt or replaced.

## Files

- `index.html`, `style.css`: interface and visual styling.
- `app.js`: rendering, camera transitions and local interactions.
- `characters.js`: original character meshes, poses and roster portraits.
- `world.js`: room, furnishings, materials and screen textures.
- `vendor/`: local Three.js runtime and supporting modules.

The neighboring `worklive-atelier-*.png` files are captured previews of this concept.
