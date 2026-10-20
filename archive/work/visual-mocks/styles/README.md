# Office style modules

`mock.js` loads exactly one style per page: `?style=game|comic|classic` (default comic).
Useful URL flags: `cam=overview|follow|pov|lineup`, `agent=<id>` (for follow/pov), `snap` (no camera fly animation — use for screenshots).

Screenshot: `node tools/shot.mjs "http://127.0.0.1:8765/?style=game&cam=lineup&snap" shots/game-lineup.png 6000`
Server: `cd work/visual-mocks && python3 -m http.server 8765`

## A style module (`styles/<name>/index.js`) exports

- `meta = { label }`
- `async buildRoom(scene, renderer)` → `{ root, walls, screens, ... }`
  - builds the whole office from `layout.js` (ROOM, DESKS, LOUNGE, CAFE, MEETING, PLANTS, seatOf, monitorOf), incl. desks, monitors, keyboards, chairs.
  - `walls`: Groups with `userData.normal` (inward-facing unit Vector3); hidden automatically when between camera and room (dollhouse cut-away).
  - `screens[i]`: one Mesh per DESKS index, PlaneGeometry(0.68, 0.4) at `monitorOf(d)` + y 0.12, facing +z. mock.js puts the live browser canvas texture on it.
- `applyLook({ scene, renderer, hemi, sun, camera }, set)` → background, fog, environment, tone mapping, light tuning. `sun` casts shadows.
- optional `createPipeline({ renderer, scene, camera })` → `{ render(), setSize(w, h) }` for post-processing (outlines, AO, grading…).
- `createCharacter(agent, index)` → `{ root, head, eyeAnchor, update(t, dt, pose, ctx) }`
  - root stands on y = 0 at the origin, faces local **+z**. mock.js sets root position + rotation.y each frame.
  - `pose`: `stand | walk | sit | type | coffee | lounge` (walk speed 1.25 m/s).
  - `ctx`: `{ status: working|needs|review|idle, lookAt: Vector3|null (camera position when the viewer is close / following), camDist, mode, chair, spot }`.
    - `chair`: the agent's desk chair Object3D while it sits at its own desk (from `set.chairs[deskIndex]`), else null. Rotate it (yaw) when the body swivels so they never intersect.
    - `settling`: true while sliding into / out of `spot` (pose switches mid-slide).
    - `spot`: id of the spot the agent is settled in, sliding into, or getting up from (`desk<N>`, `sofa0/1`, `armchair0/1`, `counter0-2`, `cafe-n`, `cafe-e`, `window0-2`, `books`, `plant`) or null while walking.
- optional `set.chairs[i]`: one unmerged chair Object3D per DESKS index, pivot at floor centre of the seat.

Movement comes from `nav.js` + `crowd.js` (routes around furniture, personal space 0.56 m between agent centres, reserved spots,
settle slide from a spot's approach point `via` into `at`). Test: `node tests/crowd.test.mjs`.
Debug flags: `crowd=N` (extra wandering agents), `debug=nav` (walkable area + routes), `place=<agentId>:<spotId>` (pin an agent into a spot).
  - `eyeAnchor`: Object3D between the eyes (used for the "Agent's eyes" camera).
  - Seated geometry: chair seat top ≈ 0.52 m, desk top 0.765 m, keyboard ≈ 0.44 m in front of the seat (local +z) at 0.78 m high, monitor centre ≈ 0.94 m ahead at 1.24 m.
    These stay fixed for any `DESK` size: seat, keyboard (`keyboardZ`) and monitor are placed relative to the desk's front edge (see `layout.js`).

`agent` = `{ id, name, role, provider: codex|claude, status, desk, task?, path? }` (see layout.js).
Provider shirt colours are fixed product rules: Codex `#2D9D8F`, Claude Code `#D97757` — the main top/shirt must carry that colour.
