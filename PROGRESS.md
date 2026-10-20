# Worklive progress log

Shared between Codex and Claude Code. Newest entry first. Rules and project map: `AGENTS.md`.

## Current state (keep this block up to date)

- **Version:** 0.9.0 — installed at `build/Worklive.app` (debug build 2026-10-01 20:34, installed 2026-10-01); 0.8.0 app kept in `archive/work/v08-app-backup/`
- **Tests:** `npm run check` 67/67 JS (43 worker + 24 office) · `cargo test` 36/36 Rust, 2 live tests ignored
- **Status:** polish phase — Comic style chosen; overlaps fixed (crowd + poses), bigger office, subagent helpers — all in `work/visual-mocks/`, not yet ported to the app
- **Last editor:** Claude Code — 0.9.0 port done; added the optional **Deck 7** office look (2026-10-03, see newest entry). Debug bundle built, not installed yet.
- **Codex engine research:** complete; lightweight rendering is mandatory. Current recommendation: retain Three.js for the chosen Comic style and profile it in Tauri before considering migration. PlayCanvas remains an isolated comparison prototype; no measured engine advantage established. Unity/Unreal/Higgsfield researched; no engine migration started.
- **Codex visual concept:** earlier Atelier study in `outputs/worklive-atelier-concept/` at http://127.0.0.1:8773/ — compare alongside Claude’s styles.
- **Codex PlayCanvas prototype:** `outputs/worklive-playcanvas-prototype/` at http://127.0.0.1:8775/ — 20 characters, optional two real browser previews, measured short runs near 60 FPS; intermittent drops under background load remain unresolved. No migration to the installed app.
- **Codex Screen Landscape:** user-selected alternative visual direction; ten source-informed screen studies and screen plan in `outputs/worklive-screen-landscape/`. Static exploration only; no app integration.
- **Codex case concept:** user wants Workspace OS-style persistent context capsules in this design. Read-only source analysis and an additional case-folio study are in `outputs/worklive-screen-landscape/CASE-CONCEPT.txt` and `11-case-capsule.png`; not implemented.
- **Codex clickable mockup:** isolated Screen Landscape prototype at `outputs/worklive-landscape-mockup/`, served locally at http://127.0.0.1:8776/. Agent/case focus, scoped sample context, chat, attachments, case export, manual simulated tasks and reviews. Browser-local demo state only; no backend integration or provider calls.

### Open items / next up
1. **Polish pass** (agreed with the user 2026-09-30): review UI rough edges, usability and reliability across the whole
   workflow; then test in the running app together with Codex.
2. ~~Office signals~~ done 2026-10-01 (review pose, "!" marker, agent card).
3. Capacity/performance: target up to 20 team members for evaluation, initially retain the existing maximum of 2 active runs (1 per provider). Current browser worker separately caps created sessions at 6. Suspend idle screen captures and budget browser lifetimes before raising capacity; no 20-agent performance guarantee established.
4. Local project folders: agents edit files/run checks in isolated working copies (TerminalOS / Workspace-OS path).
5. Office growth: rooms/departments; amenities at 10 lounge, 20 table tennis, 30 TV, 40 gaming (PRD addendum v1.4).
6. Memory-quality benchmark for both providers (release requirement in PRD v1.3); semantic retrieval only if FTS falls short.
7. Not yet: signing/notarization, multi-file handoffs, autonomous delegation, Word/PDF generation.

---


## 2026-10-20 — Claude Code: moved to ~/Documents/Software-Projects/Worklive + private git repo

- Workspace moved from `~/Documents/Codex/2026-09-30/i-w` (old folder kept, with `MOVED.md`). New layout: `app/` (was `outputs/worklive/`), `build/Worklive.app`, `docs/` (PRDs), `design/` (concepts, prototypes, videos, screenshots), `archive/work/` (was `work/`). Older entries below use the old paths.
- Private GitHub repo: https://github.com/Clemens865/worklive (personal project, not a product). Not committed: `build/`, dependencies, `archive/work/*-data-backup/` (personal agent data).
- Dependencies reinstalled in `app/` and `app/worker/`. `npm run check` 67/67 (43 worker + 24 office), `cargo test` 36 passed, 2 ignored.
- User data stays in `~/Library/Application Support/com.worklive.prototype/` — unaffected by the move.
- Stopped the old `npm run web` dev server (port 1432) that ran from the old folder.

## Entry template

```
## YYYY-MM-DD HH:MM — <Codex | Claude Code> — <short title>
**Status:** done | in progress | blocked
**Changed:** files/areas
**Verified:** commands + counts, live/app checks
**Notes / open items:**
```

---

## 2026-10-04 20:00 — Claude Code — Deck 7: traffic manners, new interior, custom posters
**Status:** done (built; restart the app to load it)
**Changed:** `deck7/nav.ts` keep-right lanes; `world.ts` `traffic()` (following distance, give-way rule, detours around stopped robots), softer separation, shove counter (`stats`); `fun.ts` hamster-wheel generator (charges the lights) + jukebox with disco floor, replacing sofa and arcade; dance/rake poses; jukebox chiptune (ambient only); `posters.ts` + `poster-editor.ts` user posters (text or image + caption, localStorage); notices in `room.ts` became posters; label text now measured to fit; toolbar empty space click-through.
**Verified:** shoves (robots overlapping and pushed apart) in the deck lab with 10 robots and frequent state changes: 117 → 42 → 7 per minute; remaining ones are robots walking side by side to neighbouring break spots. Poster editor: text + colour and image + caption saved and shown on the wall. `npm run check` 43 + 24 pass; `cargo test` 36 pass, 2 ignored. Debug bundle built (`work/v09-deck7-build5.log`).

## 2026-10-03 21:30 — Claude Code — Deck 7: gaming station, quick tasks, learning
**Status:** done (built; restart the app to load it)
**Changed:** `src/office/deck7/gaming.ts` (Retro-Tron gaming station with an animated CRT: "Orbit Raiders" and "Chomp Maze", original 80s-style games) replaces the air-hockey table (`world.ts`, `layout.ts`, `remarks.ts`, new "mash" pose in `robot-anim.ts`). `main.ts` (deck only): agent card **Quick task** + presets and **Learn** (topic → self-study brief that uses `memory_append` scope agent + `study-notes.md`); both set the task brief and call the existing `startTask` on the user's click, with a reason when it can't start. `world.ts`: learning robots are marked "studying" and announce their topic. `sound.ts`: audio waits for the first click (no autoplay warnings).
**Verified:** `npm run check` 43 + 24 pass; `cargo test` 36 pass, 2 ignored. Mock backend: quick task sets the brief and starts the run; Learn builds the self-study brief; "one run per provider" reason shown; deck lab: gaming station renders with the game on the CRT and a robot on a beanbag. Debug bundle built (`work/v09-deck7-build4.log`).
**Notes:** learning is user-started on purpose (rule 3 human in the loop, rule 6 no fun spending on subscriptions); robots don't study by themselves.

## 2026-10-03 21:00 — Claude Code — Ops Deck 7 as a separate workspace
**Status:** done (built, not installed; the user restarts the app)
**Changed:** Rust `main.rs`: `data_dir_for()` replaces every `app_data_dir()` use (8 places); the studio keeps the original folder, Deck 7 uses `<app data>/workspaces/deck7/`; new commands `get_workspace` / `set_workspace` (writes `workspace.txt`, restarts the app); new unit test. Frontend: `src/workspace.ts` (mirrors the workspace in localStorage for a synchronous start, verified against the backend); `main.ts`: header workspace switch (replaces the earlier office-style toggle), office factory by workspace, robot creator instead of the hire dialog on the deck (`hire()` extracted, same agent fields), "Parts" on the agent card, deck wording; `src/office/deck7/creator.ts` (robot creator), `sound.ts` (Web Audio beeps + ambient), `theme.css` (dark control-room skin under `body.ws-deck7`); `world.ts` uses saved parts (`look.robot`) and plays sound cues. Studio behaviour and data unchanged.
**Verified:** `cargo test` 36 pass (new workspace test), 2 ignored; `npm run check` 43 worker + 24 office pass. Mock backend (`mock.html`), Chromium: deck workspace with skin, order a robot (look.robot saved, 458 bytes, under the 2 KB limit; crate delivery), Parts rebuild, take control/return, start task → review hatch, chat reply bubble, oil break; switch back to the studio (comic office, original wording). Debug bundle built (`work/v09-deck7-build3.log`). Not yet run in the native app with real agents.
**Notes / open items:** Deck 7 starts empty (new data folder). Studio data untouched.

## 2026-10-03 20:20 — Claude Code — Deck 7 hardening + mock-backend test page
**Status:** done (rebuilt, user to restart the app)
**Changed:** `src/office/deck7/office.ts`: every office call is now fail-safe (try/catch + console.error). Reason: main.ts calls the office inside the worker-event Channel handler; an exception there stops the Tauri Channel from advancing, so every later worker event (browser state, frames, take control) would never arrive. Also guarded the frame loop. New dev-only `mock.html` + `src/dev/mock-backend.ts` (Tauri `mockIPC`): runs the real app UI against a simulated backend (agents, states, frames, runs, chat, take control) for either office look.
**Verified:** `npm run check` 43 worker + 24 office pass. Mock backend, both looks, Chromium and WebKit (Playwright WebKit): open computer → Take control → "You have control" → Return control; start task; chat bubble; provider change; hire; coffee break; replay of the 6 real agents (ids/looks only) through all run statuses; no console errors. Rebuilt the debug bundle (`work/v09-deck7-build2.log`). Not reproduced: the user reports Take control not working in the real app; root cause not found yet (real backend not exercised here).

## 2026-10-03 00:20 — Claude Code — second office look: Deck 7 (robots)
**Status:** done (built, not installed)
**Changed:** new `src/office/deck7/` (robots, room, props, holo screens, nav, junk, crate delivery; ported from the user's ThreeJS_Characters studio). `deck7/office.ts` exports `createDeckOffice()` with exactly the interface of `createOffice()`. `src/main.ts`: imports it, picks the factory from `localStorage["worklive.officeStyle"]`, and adds an **office-style** toolbar button (Deck 7 ↔ Comic office; the office view reloads on switch). No other logic touched: same agents, run states, frames, selection, views, chat bubbles, coffee break, achievement, 24 desks. Live browser frames from `office.frame()` are projected on each station's hologram. New dev page `deck7-lab.html` (+ `deck7/lab.ts`) drives Deck 7 with fake agents/states/frames; not in the bundle. README section added. Source backup before the change: `work/v09-complete-backup/`.
**Verified:** `npm run check` tsc + 43 worker + 24 office pass; `cargo test` 35 pass, 2 ignored. In the browser (`npm run web`): comic office unchanged; Deck 7 lab with 7–8 agents, all states, a fresh hire (crate), subagent drones, coffee break, Office/Team/Follow/Eyes views and fake 1024×640 frames on the holograms, no console errors. `npm run build -- --debug` succeeded (`src-tauri/target/debug/bundle/macos/Worklive.app`, log `work/v09-deck7-build.log`). Not yet run inside Tauri/WebKit with real agents and real browser frames.
**Notes / open items:**
- Rule 6: Deck 7's robot remarks are scripted; no model calls. (The studio prototype's live Claude talk is deliberately not ported.)
- Not installed over `outputs/Worklive.app`; waiting for the user.

## 2026-10-01 23:50 — Claude Code — results "Open" uses the document window
**Status:** done
**Changed:** `src/main.ts` results list: the separate Read and Open buttons are now one **Open** that opens Worklive's document window (Open used to hand the file to the macOS default app, TextEdit for .md). `src/documents.ts`: the window's external button is now labelled **Open in default app**. README viewer paragraph updated. Context & files and Task files already opened the window.
**Verified:** `npm run check` 43 worker + 24 office pass; `cargo test` 35 pass, 2 ignored. Rebuilt the debug bundle, replaced `outputs/Worklive.app` and relaunched; the built frontend contains the new label. Haven't clicked through it in the app yet.
**Notes / open items:** none new.

## 2026-10-01 23:30 — Claude Code — 0.9.0 installed
**Status:** done
**Changed:** moved the 0.8.0 `outputs/Worklive.app` to `work/v08-app-backup/Worklive.app`; copied the 0.9.0 debug bundle (`src-tauri/target/debug/bundle/macos/Worklive.app`, built 20:34 with the fit-check, outfit and clay changes) to `outputs/Worklive.app`. No source changes.
**Verified:** installed bundle reports 0.9.0; launched from `outputs/`, the app and its worker process start against the real data folder; `agents.json` still lists the 5 agents (Ada, Milo, Olivia, Mike, Lena). Source and data backups from before 0.9.0 are in `work/v08-complete-backup/` and `work/v08-data-backup/`. Last test run unchanged: 43 worker + 24 office JS, 35 Rust (2 ignored).
**Notes / open items:**
- Installed at the user's request, before they had finished the 0.9.0 live checks. Still not exercised: ask_user with a real CLI, the document window, the ⌘P finder, accepting a review, and Codex or in-app chat.
- Clay and proportions can't be chosen in the app yet (no hire/edit dialog controls); offered to add them with a fit warning.

## 2026-10-01 23:06 — Codex — clickable Screen Landscape and case prototype
**Status:** done (standalone interactive prototype; no production integration)
**Changed:** new `outputs/worklive-landscape-mockup/` with HTML/CSS/JS, seeded data, original local SVG scenery/icons, sample input, launch script, screenshots and README. Preview at http://127.0.0.1:8776/ bound to loopback. Packaged as `outputs/Worklive-Landscape-Mockup.zip`. Main app source, release version, build and real user data untouched; Claude retains application editing ownership.
**Verified:** app/data JavaScript syntax; real embedded-browser walkthrough using accessible controls/keyboard: create Iris with Claude identity, create case 025, add a message, attach sample-brief.txt, manually run a five-second local simulation, read and accept its result. Reload retained the new agent/case, both file contents, conversation and accepted decision. Inspected complete export JSON in the visible export dialog (2 file contents, 4 messages, 6 history entries, assigned provider). Checked project navigation/filtering, case search, provider preview, library, reduced-motion switch and 390×844 layout (no document-level horizontal overflow). Browser log inspection showed no application errors/warnings. Main suites: `npm run check` 43 worker + 24 office pass; `cargo test` 35 pass, 2 live tests ignored. No real CLI/browser-worker runs, packaged-app build or measured FPS benchmark.
**Notes / open items:**
- User requested a working clickable version with smooth movement/animation. Built independently of Claude-owned app source. Latest Screen Landscape design remains the reference; agent screens and persistent case folios are separate entry points.
- Interactions: agent/browser/chat/task/context/results; case overview/files/sources/conversation/history; new agents and cases; attention inbox; project filter; memory notes; search; file preview, local upload and export; sample provider connections; reduced motion; reset confirmation. Codex teal and Claude terracotta stay fixed. A case has neutral visual ownership.
- Motion uses finite transform/opacity animations, focus expansion/return, hover movement and layered folio unfolding. No 3D engine, framework, remote font/asset requests, continuous rendering loop or polling. Up to five screens displayed per page (four at medium width); 20-agent creation cap. Responsive shelves scroll inside their own container. No guarantee about production browser/CLI resource use.
- Demo runs start manually, allow at most one per provider/two total, finish as ready for review, and require explicit result acceptance. Takeover pauses a running demo and returning control does not resume it. Reload converts interrupted simulated work to paused. Replies/results/source pages are clearly marked samples; no subscription is used.
- Local storage is namespaced `worklive.screen-landscape.prototype.v1`; uploads capped at 1 MB/file and browser quota. Text/binary file contents are included in case exports. Production scope enforcement, durable backend storage, live browser capture and official CLI integration remain future adapter work, not mockup capabilities.
- Embedded browser download completion could not be verified (no download event). Export opens the complete readable JSON plus Copy record and Download JSON controls. Keep this limitation in the prototype README; do not claim portable import or confirmed download delivery. Keyboard activation was reliable; pointer automation was inconsistent in the embedded viewport, so do not claim exhaustive pointer testing.
- Fixed unnecessary full redraws on every window resize, hidden-toolbar CSS precedence, cropped card content, chat draft loss when switching tabs, and returning keyboard focus to a reopened origin. Full motion restored after testing; viewport override cleared. Iris and case 025 are retained in the local preview as example records from verification.
- Shared-layout principles reviewed through design-reference-library and official Motion docs; implementation/assets are original, with no copied component code or Motion dependency. Before integration, add durable case/message capture in Rust/store and preserve scope checks, reviewed single-file handoffs and existing user data.

## 2026-10-01 22:31 — Codex — Workspace OS cases mapped into Screen Landscape
**Status:** done (source analysis and design proposal only)
**Changed:** added `outputs/worklive-screen-landscape/11-case-capsule.png`, `CASE-CONCEPT.txt` and `case-capsule-prompt.json`; updated this progress record. No app source, build, user data or previous designs changed. The earlier ZIP remains the original ten-screen pack.
**Verified:** read Workspace OS case model, handlers, agent case guidance, case prompts, run-state integration and full-case UI; compared Worklive types, chat and run persistence. Visually reviewed the generated case-folio image; verified the copied PNG dimensions (1774×887) and source/destination hashes. No code changes; no app tests, real CLI runs or performance checks. Last recorded baseline remains 67 JS pass / 35 Rust pass / 2 ignored live tests.
**Notes / open items:**
- User said only the latest designs are needed and asked to bring Workspace OS's case/context-capsule model into this direction. Continued the latest Screen Landscape studies; no deletion inferred.
- Proposed: case tab below an agent screen; Agents/Cases overview toggle; neutral case folio with Overview, Files, Sources, Conversation and History. Agent/provider identity retains teal/terracotta. Case persists beyond a run or provider; project membership is optional.
- Host should create or resolve a stable case when a goal starts, and retain it across answers/retries/revisions. Workspace OS currently expresses every-run case participation through agent guidance; do not describe that as verified host-enforced automatic creation.
- Workspace OS persists readable case Markdown, artifact paths and authored timestamped notes. Complete chat/file-byte co-location is not established. Worklive currently has run/source/artifact/context pieces but no Case entity; agent chat retains 60 messages and run event/text buffers are bounded. Full case history therefore needs new durable capture, with honest partial labels for already-truncated legacy records.
- Case storage does not expand permissions. Preserve Rust scope isolation, explicit starts, completed-versus-accepted, one reviewed handoff file and company-memory review. Full local archive differs from bounded, authorized context sent to the CLI. Provider switching keeps authorized case material, not the previous CLI session.
- Concept document outlines portable export, provenance/versioning and migration/verification requirements. No implementation started; Claude retains source ownership.

## 2026-10-01 22:09 — Codex — Screen Landscape selected for expanded screen exploration
**Status:** done (source-informed design pack; no app implementation)
**Changed:** `outputs/worklive-screen-landscape/` with ten final PNGs, `SCREEN-PLAN.txt`, exact initial/refinement prompts and image provenance. Download pack: `outputs/Worklive-Screen-Landscape.zip`. This progress record only outside those deliverables. App source, build, data, providers and Claude's work unchanged.
**Verified:** inspected current frontend types/main UI, chat, projects, context, task files, document viewer/finder, inbox, handoffs, hiring and worker task admission, plus README and shared progress. Used the user's attached Screen Landscape image as the visual reference in built-in image generation. Visually reviewed all outputs; targeted corrections for idle-agent copy, provider concurrency, acceptance semantics and provider-independent shared scopes. Verified all ten final PNG headers/dimensions, source-copy hashes and ZIP integrity. No code changes, app tests, CLI runs, packaged-app verification or performance measurement in this design session. Last recorded baseline at inspection: 67 JS pass / 35 Rust pass / 2 live tests ignored.
**Notes / open items:**
- User explicitly liked Screen Landscape (`02-screen-landscape.png` from the revised studies), despite calling it the first image, and requested team overview, chat, menu and other screens based on existing Worklive capabilities. This is the preferred direction for this exploration, not an instruction to delete the office or start integration.
- Ten views: Team overview (12 sample identities, 2 working); focused agent browser/workspace; per-agent chat; menu; project space; scoped memory/files; inbox/result review; reviewed file handoff; create agent; provider connections/first-run setup.
- Source review matters: current chat is tool-free, includes profile/status/task brief/recent messages and does not retrieve the memory library. It cannot start browsing work. The illustrated Prepare task action is a proposed explicit bridge into a separate task composer. Current work admission is two active task runs, at most one per provider; it does not limit all possible chat subprocesses.
- Preserve takeover-pauses-work, manual Resume, completed versus accepted, one reviewed handoff file and explicit sharing consent, manual handoff start, scope isolation, task-only files and context version rules. Shared-plan/context/review edits remain locked while work runs; merely opening a view must not pause tasks automatically. Project and company memory are not owned by one provider.
- Screen plan also maps supporting states: task composer, profile, finder, shared document reader/editor, history, company proposals, team management, connection recovery, empty states and stale/live browser previews. Source capability is not a claim that every path was verified in the packaged build.
- Proposed interaction: click/Enter focuses a screen; Escape returns; Browser/Chat/Task/Context/Results stay with the selected agent; consistent compact global menu; optional drag shortcuts with click/keyboard alternatives. Legible foreground content stays face-on. A global project filter must not silently reassign agents.
- Candidate first prototype: shallow DOM/CSS presentation and static background, with existing browser images, bounded preview updates and reduced-motion support. Browser lifecycle work and performance profiling are still needed; still images do not establish smoothness or resource cost. No engine migration or runtime-capacity expansion implied.
- Claude retains source ownership. The first implementation decision remains open pending user feedback on the design pack.

## 2026-10-01 21:50 — Codex — alternative interaction concepts; revised after design feedback
**Status:** done (visual exploration only; no chosen replacement or app implementation)
**Changed:** `outputs/worklive-interface-concepts/` — six final generated interaction-study PNGs, `READ-ME.txt` with interaction rationale/tradeoffs, `interaction-studies-prompts.json` with exact prompts, and `image-manifest.json` with provenance. First-round images/prompts retained separately under `superseded-dashboard-studies/`.
**Verified:** read shared guide and latest progress; visually inspected the generated images; copied all six final PNGs into the workspace and verified dimensions and copy checksums. Built-in image generation used, no API-key fallback. No app/source/code edits, release/build changes, data changes or runtime benchmark. Test suites not rerun for image/document-only work; last recorded baseline at inspection was 67 JS pass / 35 Rust pass / 2 live tests ignored. Claude retains application editing ownership.
**Notes / open items:**
- User is exploring fundamentally different productive interactions beyond the 3D office, including display keys and groups of agent screens. This is exploration, not an instruction to remove the office or replace the backend.
- Initial eight conventional UI mockups (deck, wall, workbench, inbox, project map, timeline, mixer, notebook) were rejected mid-turn: "What is this? This looks like a normal app?" Do not continue that dashboard-first direction based on these images. Stopped the remaining first-round correction work and revised the concept brief.
- Revised six: Screen Keys (press a display key to enter an agent workspace), Screen Landscape (pull a screen forward, pair screens), Task Pucks (place an agent on a task and add source papers), Agent Cartridges (dock a reusable agent into a project, insert context chips), Focus Orbit (stationary radial agent selection around one workspace), Work Ribbons (pull an evidence frame out of a work history).
- All are on-screen metaphors; no physical hardware is required/proposed. Retain Codex teal and Claude Code terracotta identity, explicit task start, scoped memories/files and human review. Any proposed drag/gesture/history behavior needs implementation and validation.
- Generated content inside preview screens is illustrative; not actual CLI activity, factual research, timings or proof of performance. Early superseded images also invented extra providers and must not be treated as a product capability specification. Final revised designs use only the two providers.
- Suggest Screen Keys and Task Pucks as candidates for a small interaction prototype after user feedback. Consider shallow CSS/canvas layers or rendered assets for depth; do not assume these stills require heavy 3D or promise low runtime cost without profiling. No app changes made while Claude's ownership marker remains active.

## 2026-10-01 20:45 — Claude Code — character fit check + trouser/outfit fixes
**Status:** done
**Changed:** new `src/office/styles/comic/fitcheck.js` + `tests/character-fit.test.mjs` (in `npm run check`); workbench "Check this character".
`body.js` (thigh/shin same radius at the knee + knee ball; pelvis wide enough for the thighs); `clothes.js` (`torsoSurface`: details placed on the
real torso via raycasts, `conform` bends flat pieces; collar/hood marked free); `face.js` (ears on the head shape; sclera = head surface);
`accessories.js` (glasses in front of eyes/face, arms along the head shape); `poses.js` (seated hands rest on the desk via IK; wave keeps the free
hand down; review pump goes up/sideways); `character.js` (`buildCharacter(…, {merge:false})`, head tagged); `toon.js` (`geo()` names geometries).
**Verified:** first run: buried bib/straps/tie/buttons/V on wide+round bodies (bib 5 cm inside), ears inside wide heads, hands 1–4 cm into the desk
edge for short builds and during needs/review gestures. Now `npm run check` 43/43 worker + 24/24 office (8 crowd + 7 hair + 9 fit: 180 body/top/head
combos + 4 proportion corners × 18); `cargo test` 35 pass, 2 ignored. Workbench in Chromium: lineup (clay) shows bib/straps/tie on the body; Mike seated,
hands on the desk; "Check this character" → fits (44 ms).
**Notes / open items:** fit check does not cover lounge seats (sofa/armchair) yet; the hood and collar are exempt (they wrap the neck).

## 2026-10-01 20:20 — Claude Code — character workbench + clay finish
**Status:** done (design tool; clay not yet offered in the app UI)
**Changed:** new dev page `lab.html` + `src/lab/{lab.js,scene.js,lab.css}` (not bundled: Vite builds only index.html);
`toon.js` (`withFinish`/`finish`, clay MeshStandard material with object-space noise bump + warm rim, shared `CLAY` uniforms; `ink()` off in clay;
`gloss` option); `face.js` (glossy sclera/iris); `character.js` (builds inside `withFinish(look.finish)`); `looks.js` (`PROPORTION_RANGE`,
`FINISHES`, `look.shape` overrides clamped, `look.finish`); `index.js` exports; `shapes.js` (`smoothNormals` for head/shoe/head shells,
lathe keeps its own seam-smooth normals); `hair.js` (blob normals; bald fringe = 13 lumps ear to ear instead of two side blobs).
**Verified:** `npm run check` 43/43 worker + 15/15 office; `cargo test` 35 pass, 2 ignored. Workbench checked in Chromium (Playwright): lineup of 6/20,
clay vs comic, office/studio light, single view typing at desk → fit check "fits" for Heiko (round, width 1.22). Seam stripes confirmed gone
with a plain-material render. App bundle not rebuilt (office look changes only by the seam fix and bald fringe).
**Notes / open items:** next for characters: full-beard side shells look like flaps from behind (clay shows it more); decide per-agent vs
office-wide finish; clay room materials; finish + proportions in the hire dialog; profile clay with 20 agents in WebKit.

## 2026-10-01 15:40 — Claude Code — hair/headwear overlap fix for all head shapes
**Status:** done
**Changed:** `src/office/styles/comic/shapes.js` (`deformHead` extracted from `headGeo`; new `headRadius`, `headShell`, `fitToHead`);
`hair.js` (shells follow the head shape, other pieces moved out by head size; cap: pieces under the dome removed, `wearsCap` = cap and not afro;
bob slimmer; ponytail marked `throughCap`; bob fringe, bald tufts, afro hairline adjusted); `accessories.js` (cap dome follows the head at 1.17,
headset/brim fitted; uses `wearsCap`); `merge.js` (never merges hidden meshes); new `tests/hair-check.test.mjs` added to `npm run check`.
**Verified:** before the fix the new test failed on all 6 head shapes (e.g. buzz 55 / 207 bare-scalp spots, cap on long head 64); now
`npm run check` 43/43 worker + 15/15 office (8 crowd + 7 hair); `cargo test` 35 pass, 2 ignored. Renders checked: 6 heads × buzz/mohawk/bob/bald,
caps with spikes/curly/bob/ponytail, headsets, 6 tops × 5 bodies, beards+glasses+headset. Debug bundle rebuilt and relaunched.
**Notes / open items:** user report: hair overlapping the head (screenshot 15:19). Saved agents with cap + afro now show no cap.

## 2026-10-01 14:20 — Claude Code — agents ask questions + inbox
**Status:** done
**Changed:** `worker/tool-definitions.mjs` (`ask_user`: question + up to 4 options, validated); `worker/agent-runtime.mjs` (records
`r.question`, one per run; run ends as new status `waiting`; prompt tells agents to ask only for essential missing info; `question`
in public run); `src/types.ts`; `src/main.ts` (question panel in Work & results with choice buttons/free answer → continuation with
the answer; "Needs your answer" label; office "!" reason "has a question"; review bar hidden when nothing to review; Inbox button + badge);
new `src/inbox.ts` (Questions / Blocked work / Ready for review); styles; README section.
**Verified:** `npm run check` 43/43 worker + 8/8 office; `cargo test` 35 pass, 2 ignored. Browser preview with stubbed Tauri: badge 3
(amber), three inbox groups, answering "Both" sends the continuation with previousRunId. Debug bundle rebuilt + relaunched.
Not yet run with a real CLI calling `ask_user`.
**Notes / open items:** jelly direction dropped by the user. Backlog next: DOCX export (FR07), bounded helper (FR09), eval set + memory benchmark.

## 2026-10-01 13:30 — Claude Code — jelly snail-bean agents: visual mock
**Status:** DROPPED by the user (13:40) — not to be ported; files kept in `work/visual-mocks/jelly/` for reference only
**Changed:** new `work/visual-mocks/jelly/` (`index.html`, `main.js`, `scene.js`, `bean.js`, `agent.js`, `accessories.js`), served at
http://127.0.0.1:8790/jelly/. Translucent jelly beans without arms/legs that glide like snails (crawl wave in the vertex shader, slime trail),
spring squash/lean, snail eye stalks that retract when poked, statuses (working = typing bob + lit screen, needs you = bouncing + "!",
review = proud sway), accessories (headphones, beanie, sunglasses, bow tie, propeller cap, party hat, flower, laptop worn as a shell).
Material: MeshPhysicalMaterial transmission + thickness + attenuation (Beer–Lambert) + clearcoat; transmission pass at 0.6 resolution.
Palette toggle: provider teal/terracotta (product rule) vs blue/red (only for comparison).
**Verified:** Playwright headless: no errors, 120 fps cap with 6 and 20 beans (headless Chrome; not measured in Tauri/WKWebView). Shots:
`work/visual-mocks/shots/jelly-overview.png`, `jelly-free.png`.
**Notes / open items:** user to choose colours (keeping teal/terracotta = no rule change) and give feedback on shape/accessories before any port.

## 2026-10-01 12:10 — Claude Code — documents (view/edit/find) + reliability fixes from audit
**Status:** done
**Changed:** new `src/documents.ts` (document viewer/editor + ⌘P file finder; `marked` + `dompurify` added to package.json);
new `src-tauri/src/documents.rs` (knowledge actions `document`, `editFile`; task file actions `document`, `edit`); `open_link`
command (http/https only) in `main.rs`; worker `saveArtifact` (not while running/accepted, base-hash check, previous text kept in
`runs/<id>/versions/`, artifact hash updated so review/handoff use the edit) and `documents` listing; Read in Work & results,
"Open document" in context drawer and task files; Files button in header; styles.
Reliability audit (subagent, 12 findings) — fixed: browser crash now relaunches on next use (#1); natural finish vs late
Pause/Stop race (#2); hire suggestions finish within the 50 s command limit + inline error (#3); chat double-send race (#4);
Start reply no longer overwrites newer run events (#5); worker death marks runs interrupted + "Reconnect" in the header (#6);
one agent's browser failure no longer blocks startup (#7); failed knowledge `begin` always releases the binding (#8);
CLI stdin EPIPE handled (#9); damaged run-index rebuilt from run folders (#10); custom hired roles shown in profile (#11);
new hires saved immediately + flush on quit (#12).
**Verified:** `npm run check` 42/42 worker + 8/8 office; `cargo test` 35 pass, 2 ignored. Browser preview with stubbed Tauri: finder,
formatted Markdown + table, sanitizer, edit + ⌘S save payload. Debug bundle rebuilt and relaunched. Not clicked through in the
packaged app; #6 Reconnect not exercised against a real worker crash.
**Notes / open items:** run-output edits are stored next to the run (`versions/`), not in SQLite.

## 2026-10-01 10:20 — Claude Code — office signal: "!" when an agent needs you
**Status:** done
**Changed:** `src/office.ts` (office status `needs` + `reason`; agent stays seated, uses the existing worried wave / "!" overlay; label
"Needs you: <reason>"; new clickable `.needs-marker` "!" above the head, hidden while a speech bubble shows; coffee break skips it);
`src/main.ts` (`NEEDS_YOU` map: paused / interrupted / limited / error run → `needs`, unless the user holds the browser; studio summary
"· N need you"; card dot amber); `src/style.css` (marker with pulse ring, reduced-motion safe); README section.
**Verified:** `npm run check` 38/38 worker + 8/8 office; `cargo test` 33 pass, 2 ignored. Browser preview with stubbed Tauri: Mike (limited)
and Noor (error) seated with markers, Lena in review pose, summary "2 need you"; clicking a marker opens the card + follow view.
Fixed during check: marker inherited `pointer-events: none` from the labels layer. Debug bundle rebuilt (not relaunched).
**Notes / open items:** "clicking an agent shows its current task" (open item 2) is covered by the 0.9.0 agent card. Not yet seen with a real failed/limited run.

## 2026-10-01 08:50 — Claude Code — finished runs wait at the desk for the user's review
**Status:** done
**Changed:** `src/office.ts` (new office status `review`: agent stays seated, uses the existing lean-back / fist-pump review pose,
label "Waiting for your review", skipped by coffee breaks; seated pose switches type ↔ sit immediately; desk follow camera lowered
under the pendant lamps); `src/main.ts` (`syncOffice` sends `review` while the latest run is `review` and not accepted; card status no longer repeats the label).
**Verified:** `npm run check` all JS pass; browser preview with stubbed backend: agent with an unaccepted review run stays seated in the review pose
while others wander. Debug bundle rebuilt and launched. Not yet watched live through a real run → accept cycle.
**Notes / open items:** user feedback: after a finished task the agent stood up and walked away; the reviewer is the user (not a handoff).

## 2026-10-01 08:25 — Claude Code — camera views, agent card, chat with agents
**Status:** done for this feature; the overall 0.9.0 port entry below is still open (installed `outputs/Worklive.app` is still 0.8.0)
**Changed:** `src/office.ts` (views office / team / follow / eyes, `view()`, `say()`, Esc handling, double-click → eyes, bubble clamped to stage);
`src/main.ts` (view switch, agent card, chat panel, `chat` events, footer 0.9.0); `src/style.css`; `src/types.ts` (ChatMessage);
`worker/providers.mjs` (shared `askCli`, `suggest` now uses it); new `worker/chat.mjs` + `worker/chat.test.mjs`; `worker/main.mjs`
(`chatHistory` / `chatSend` / `chatClear`, shared provider-ready cache). README section added.
**Verified:** `npm run check` 38/38 worker (35 + 3 chat) + 8/8 office; `cargo test` 33 pass, 2 ignored. One live chat reply via
Claude Code CLI from the worker module. Browser preview with stubbed Tauri: team line-up, follow, eyes, Esc chain, card, chat round trip.
Debug bundle built and launched (`src-tauri/target/debug/bundle/macos/Worklive.app`).
**Notes / open items:** chat replies arrive asynchronously as a `chat` event (Rust command timeout is 50 s; CLI timeout 120 s).
Not run live: Codex chat, chat from the packaged UI. Team line-up stands at x≈10.5, z≈-0.6 (open floor left of the lounge).
macOS showed "Worklive was prevented from modifying apps on your Mac" at launch — cause not investigated.

## 2026-09-30 23:10 — Codex — Three.js versus PlayCanvas for the Comic office
**Status:** done (analysis and recommendation; no renderer migration)
**Changed:** shared progress record only; revised the current engine recommendation after inspecting Claude's Comic implementation and the limits of the PlayCanvas experiment. Claude retains source-editing ownership.
**Verified:** read Comic render pipeline, geometry-merging utilities, room/character integration and renderer settings. Checked official PlayCanvas Engine/Editor/optimization documentation and Three.js InstancedMesh documentation. No source changes or new benchmark; tests not rerun. Last verified app baseline remains 39 JS pass / 30 Rust pass / 2 live tests ignored; isolated prototype 4 pass.
**Notes / open items:**
- Recommend keeping Three.js for the chosen Comic style. PlayCanvas offers an optional visual Editor, asset workflow and integrated component-based game systems; it does not inherently guarantee a better look or lower resource usage. Its engine can also be used locally without the hosted Editor.
- Comic already merges geometry by material and animated group, and uses a forward render with mesh outlines. Three.js also supports GPU instancing. Existing custom character, pose, room and movement work makes a renderer port a real cost.
- Prototype and Comic use different scenes and settings; no controlled same-scene comparison establishes PlayCanvas as faster. Short near-60-FPS prototype samples coexist with unresolved slowdowns under background load. Do not promise a smooth 20-agent product on that evidence.
- Proposed next step: profile the current Comic office with up to 20 characters and two active browser previews in actual Tauri. Measure sustained frame-time spikes, CPU/GPU and memory; inspect resolution, shadows, geometry/outline cost and browser capture independently. Rendering settings differ (Comic pixel-ratio cap 2 versus prototype cap 1); equal CSS viewport dimensions are not equal pixel workloads on a high-DPI display.
- Keep the PlayCanvas prototype as a reference. Reconsider migration only for a concrete workflow/capability benefit or a controlled measured performance advantage. This recommendation is not a user-approved architecture change.
- Sources: https://developer.playcanvas.com/user-manual/engine/ ; https://developer.playcanvas.com/user-manual/editor/ ; https://developer.playcanvas.com/user-manual/optimization/ ; https://threejs.org/docs/pages/InstancedMesh.html

## 2026-09-30 23:06 — Codex — located Claude's comic visual direction
**Status:** done (read-only inspection)
**Changed:** this progress entry; copied the existing comic line-up screenshot to `outputs/worklive-comic-reference.png` for a user-facing reference. No source, prototype, app build, data, Ruflo settings or Claude work changed.
**Verified:** read shared guide/progress, style-module README, comic entry point and render pipeline; visually inspected `shots/comic-overview.png` and `shots/comic-lineup.png`. Confirmed the comic style source exists in `work/visual-mocks/styles/comic/`, using Three.js and modular characters/room code with outlined toon rendering. No tests rerun for this read-only inspection; last verified baseline remains prototype 4 pass, app 39 JS pass / 30 Rust pass / 2 live tests ignored.
**Notes / open items:** user confirms Claude is actively developing the Comic style. Use it as the visual reference for future discussion; it is separate from the PlayCanvas capacity prototype and has not been ported. Claude retains editing ownership. Shared record also notes miniature helper characters and a planned more spacious office/bigger desks. No claim that current pose work or helper integration is production-complete.

## 2026-09-30 22:49 — Codex — PlayCanvas prototype ready for evaluation
**Status:** done (standalone prototype; sustained performance acceptance remains open)
**Changed:** new `outputs/worklive-playcanvas-prototype/` with pinned PlayCanvas 2.22.6 and Playwright Core 1.61.0, Node loopback server, HTML/CSS/JS office, movement simulation, four tests, README and `measurements.json`. Screenshots: `outputs/worklive-playcanvas-overview.png` and `outputs/worklive-playcanvas-screen.png`. App source, installed 0.8.0 build, user data and Claude's visual work remain unchanged.
**Verified:** prototype `npm run check`: 4/4 tests pass; includes five simulated minutes with 20 people, furniture clearance, minimum centre separation 0.88 m, and participation by all 18 idle agents. Existing app `npm run check`: 39/39 JS (34 worker + 5 office); Rust: 30 pass, 2 live-subscription tests ignored. Browser UI verified direct monitor click, both providers' screens, enlarged preview, real public-site navigation, 5/10/20 size controls, pause/resume, Eco selection, and browser stop/restart. No console warnings/errors observed in the inspected page logs. Temporary viewport override reset; tab marked as a deliverable.
**Notes / open items:**
- Original procedural scene: 20 standing desks, stylized characters, windows/plants, coffee counter, lounge and table tennis. Fixed provider shirts preserved. Shared meshes and GPU instancing, one directional light, no real-time shadows or post-processing; 55 draw calls, 74,340 submitted triangles with all 20 people. No Blender assets and no model calls.
- Movement uses A*, a furniture margin, reserved break destinations, separation, blocked-path replanning and fair break admission. Team-size changes reset routines to avoid restoring hidden characters inside moving agents. Names stay in the side panel / hover label.
- Optional browser demo opens two real anonymous documentation pages (PlayCanvas and MDN) in one fresh Chromium context, separate from personal profiles. It is scripted browsing, not two working CLI agents; the enlarged view is an image preview with a preset navigation button. Desktop previews use 256 × 160 textures; expanded view retains 1024 × 640. Ordinary capture targets 5 seconds, expanded 0.8 seconds, with immediate refresh after preset navigation.
- Office drawing pauses while hidden or with a dialog open. Capture pauses without a visible viewer; browser closes after roughly 90 seconds without one. One transient capture timeout was observed under load; cached frames are retained and retried, and previews older than 12 seconds are labelled as last captures. Idle desks do not each own a browser.
- Final 15-second runs in the Codex in-app browser at 1280 × 900 (office buffer 969 × 637): office-only 59.95 FPS / p95 17.7 ms / 0 intervals over 50 ms; with two optimized previews 60.00 FPS / p95 17.6 ms / 0 intervals over 50 ms. These short observations are not sustained-performance guarantees.
- An earlier full-resolution, faster-capture run fell to 9.45 FPS; other browser/rendering work was active on the Mac. A later rolling sample also showed about 9 FPS with zero browser pages. Both capture settings and background load varied; do not claim an isolated engine speedup, a resolved jitter issue, or that the browser feeds alone caused the slowdown. All observations are retained in the README/measurement record.
- No packaged-Tauri benchmark, app release/restart check or real CLI execution was performed. Next gate is sustained measurement in actual WKWebView with two official CLI tasks and ordinary apps open. Do not migrate renderers solely from these short samples.
- Loopback server remains running on port 8775 for user evaluation. Demo Chromium pages were stopped; status verified `enabled: false`, `pages: 0`, empty error. Start them explicitly with the prototype's button. Main Worklive remains 0.8.0.

## 2026-09-30 22:16 — Codex — isolated PlayCanvas capacity prototype
**Status:** done — see completion entry above
**Changed:** new `outputs/worklive-playcanvas-prototype/` only, plus this log. User approved trying PlayCanvas after agreeing with the smaller-team recommendation.
**Verified:** current app remains version 0.8.0. Read latest shared progress and source constraints. This is a separate engine/performance experiment; Claude retains its visual mock and app work.
**Notes / open items:** target 20 lightweight animated characters, clickable monitor views, optional two real isolated browser previews, explicit simulation labels, and visible performance measurements. No model calls or app migration. Preserve fixed provider colors. Validate prototype interactions and run both existing app test suites before finishing; do not claim packaged-Tauri or CLI-concurrency performance based on a browser-only experiment.

## 2026-09-30 22:12 — Codex — local capacity and smaller-team recommendation
**Status:** done (read-only analysis and recommendation; no capacity changes implemented)
**Changed:** this progress record only. User questioned the need for 1,000 agents and suggested a smaller team, perhaps up to 20, with smooth performance as the priority.
**Verified:** hardware inspection reports MacBook Pro, Apple M1 Pro, 10 CPU cores, 16 GB unified memory. Read `worker/agent-runtime.mjs` and `worker/main.mjs`: active task admission already permits at most 2 runs total, with at most 1 per provider; the browser worker separately limits its session map to 6. Browser capture currently runs periodically for every created page, including idle pages, at approximately 180 ms focused / 650 ms unfocused intervals. Reviewed official subscription-limit documentation. No app changes or performance benchmark; test suites not rerun. Last recorded app baseline remains 39 JS pass, 30 Rust pass, 2 live tests ignored.
**Notes / open items:**
- Recommend a first product target of up to 20 named characters with personal memory, initially retaining 2 concurrent real tasks. Evaluate 4 concurrent tasks only after measuring representative workloads and changing the existing admission policy deliberately. These are proposed budgets, not measured hardware limits or a committed hard cap.
- Separate roster size, visible animated characters, active official CLI runs, open browser pages, monitor capture rates, and subprocess workloads. Model inference uses the subscribed providers; local browser/tool/build work and graphics still compete for this Mac's resources. More identities do not multiply the account's subscription allowance.
- A large stored roster is feasible in principle; 1,000 simultaneous CLI/browser workloads is not an appropriate performance target for this 16 GB laptop. Even 20 simultaneous active workloads cannot be promised smooth performance.
- Proposed browser lifecycle: create on demand for active work, retain last screenshot for idle desks with an honest idle label, suspend idle capture, and release idle browser resources while respecting resumability. Do not claim this lifecycle is already implemented.
- Proposed acceptance test: 20 lightweight animated characters plus 2 actual working sessions and real browser previews, sustained operation in packaged Tauri, measure frame-time spikes, total process memory/memory pressure, CPU/GPU use and responsiveness with ordinary apps also open. The earlier 60-character scaling experiment is lower priority pending this smaller-team direction.
- If the team cap is adopted, revisit amenities currently tied to 30/40+ agents; accepted work and project milestones could unlock them instead. PRDs and app limits were not changed in this analysis.
- Sources: https://learn.chatgpt.com/docs/pricing ; https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work
- Claude retains its in-progress visual work; app source, installed build and user data remain untouched.

## 2026-09-30 22:07 — Codex — lightweight requirement and Higgsfield findings
**Status:** done (research only; no new prototype or engine migration)
**Changed:** shared progress record. User clarified that graphics must stay lightweight and requested Higgsfield research in addition to Unity/Unreal.
**Verified:** primary vendor documentation, official Higgsfield repository references, and read-only connected Higgsfield model searches. No generation, upload, publishing, installation or model-run jobs submitted. Tests remain the verified app baseline: 39 JS pass; 30 Rust pass, 2 ignored. Documentation-only follow-up did not rerun tests.
**Notes / open items:**
- Recommended first runtime candidate: PlayCanvas with deliberately modest real 3D assets, precomputed lighting, limited visible floors/characters, and independently throttled browser screen updates. Babylon.js is another web-native option. Engine performance rankings are architectural judgments, not measurements.
- Lowest graphics-cost alternative to evaluate if a fixed view is acceptable: 2.5D isometric sprites with PixiJS. This changes the original fully rotatable 3D requirement and is an option, not an accepted product change. It can retain walking, desks, provider shirt colors, amenities and clickable browser screens.
- Unity is viable and has official AI/editor tooling; it introduces another runtime/build/integration layer. Unreal has experimental official MCP tooling, but its documented Pixel Streaming browser route adds a running desktop/server renderer and video delivery. Neither is the default recommendation under the clarified lightweight/browser-first priority.
- Higgsfield Games 2.0/Supercomputer is game creation/deployment tooling; 3D Jutsu is scene authoring/previz with GLB/image/video export. Do not present either as a proven lightweight embeddable runtime for Worklive. Their current official game workflow has moved onto the website stack and says the earlier separate game engine is being retired.
- Live model catalog confirms `image_to_3d` / `multi_image_to_3d` output GLB with optional rigging/animation, and `target_polycount` (default 30,000, request range 100–300,000). A requested target still requires output validation. `autosprite` outputs sprite sheets and exposes isometric idle/walk/run/jump variants and custom animations. `sam_3_3d` produces static meshes. These are authoring tools; generated rig/animation quality and runtime performance were not tested.
- If adopted later, Higgsfield would supply optional development-time art; this does not replace the subscription-only official Codex/Claude CLI requirement for Worklive agent execution. Hosted Higgsfield model selection should not be conflated with the user's CLI subscription billing.
- Proposed proof: a small 20-character office with 4 actual browser previews; measure camera responsiveness, frame-time spikes, CPU/GPU, RAM and sustained operation in the real app. Then try 60 characters. Target low idle use and suspend office drawing when hidden. Do not claim zero graphics cost or scalability to 1,000 simultaneous full-detail characters/browsers.
- Additional primary sources:
  - https://higgsfield.ai/blog/higgsfield-mcp-gpt6-astra-games-2
  - https://higgsfield.ai/blog/higgsfield-3d-jutsu
  - https://github.com/higgsfield-ai/skills/blob/main/higgsfield-websites/references/game-flow.md
  - https://github.com/higgsfield-ai/skills/blob/main/higgsfield-websites/references/game-3d-animation.md
  - Connected Higgsfield `models_search`: `image_to_3d`, `autosprite` (read-only, 2026-09-30).


## 2026-09-30 22:04 — Codex — stop heavy visual study; browser-engine research
**Status:** done (research); Blender visual study discontinued at the user's request
**Changed:** isolated `outputs/worklive-blender-studio/` and `work/blender-studio/` during the visual experiment; this progress record. The app source, installed build, user data, Atelier, and Claude's work remain unchanged.
**Verified:** unchanged app baseline was rerun during the visual session: `npm run check` 39/39 JS (34 worker + 5 office); Rust 30 pass, 2 ignored. Concept JS and Blender script syntax pass. The first lighter browser mode loaded without console errors; one at-rest sample was 26 rendered FPS at a 30 FPS target, 713,735 triangles and 199 draw calls (847 × 853 canvas). This is not a controlled before/after benchmark. No release build or installed-app restart performed.
**Notes / open items:**
- User rejected the compute-heavy/jittery Loft and requested research on browser-capable engines with Codex Astra / Claude Code Opus 5.5, explicitly asking about Unity. Stop graphics authoring and do not integrate this study.
- Stopped owned background Blender rendering and the subsequent CPU-only optimization job. Confirmed no Blender background processes remain. Files preserved. Fast character exports exist but the optimized room export is incomplete and the viewer does not load the fast directory. The final cached-shadow/lazy-postprocessing edits have syntax validation only; do not report the performance issue fixed.
- Research shortlist: PlayCanvas for direct web/Tauri integration; Unity for the full editor/asset/animation workflow. Babylon.js and Godot are viable alternatives; PixiJS enables a lower-cost fixed-camera 2.5D option. These are architectural judgments, not comparative measurements on Worklive.
- Unity now documents official Codex and Claude Code plugins, CLI/editor control and web optimization. PlayCanvas documents both clients, an official Editor MCP server and a standalone local TypeScript workflow. Astra's documented Void Explorer uses TypeScript/Vite/Three.js with measured rendering budgets. No controlled Astra-vs-Opus-5.5 game-quality comparison was established.
- Keep the existing subscription-only CLI/backend, memories, projects and files; a rendering change should replace the office view. Treat browser captures as a separately budgeted workload. A pure website still needs a local companion for official CLIs. Benchmark the actual Tauri WKWebView as well as Chrome before choosing a renderer.
- Proposed next decision test (not implemented): identical small office in the shortlisted engine, 20 animated characters, 4 real browser monitor previews, expand-on-click, then 60 characters. Measure frame-time spikes, memory, CPU/GPU, and sustained operation; distinguish company roster size from simultaneously visible characters and active CLI/browser sessions.
- User also explicitly asked about Unreal. Epic documents Unreal MCP for Codex/Claude Code, currently Experimental, and Pixel Streaming for browser delivery. Pixel Streaming runs the Unreal application on a desktop/server and streams video; it does not move Unreal rendering into the browser or eliminate its compute cost. Unreal remains a possible native/streamed route, but is not the recommended default for a local browser-capable productivity app.
- Primary research sources (accessed 2026-09-30):
  - https://learn.chatgpt.com/blog/how-to-build-games-with-astra
  - https://unity.com/blog/unity-plugin-codex
  - https://unity.com/blog/unity-plugin-for-claude-code
  - https://unity.com/blog/meet-the-unity-cli
  - https://unity.com/resources/what-is-unity-ai
  - https://docs.unity3d.com/Manual/webgl-technical-overview.html
  - https://developer.playcanvas.com/user-manual/engine/developing-with-ai/
  - https://developer.playcanvas.com/user-manual/editor/mcp-server/
  - https://developer.playcanvas.com/user-manual/optimization/
  - https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html
  - https://www.babylonjs.com/
  - https://pixijs.com/8.x/guides/components/scene-objects
  - https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering/
  - https://v2.tauri.app/reference/webview-versions/
  - https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor
  - https://dev.epicgames.com/documentation/unreal-engine/pixel-streaming-in-unreal-engine?lang=en-US

## 2026-09-30 21:09 — Codex — Blender studio visual pass
**Status:** discontinued — user rejected performance; see engine-research entry above
**Changed:** new isolated `outputs/worklive-blender-studio/`; no changes to the app, Claude's visual work, or the earlier Atelier concept.
**Verified:** read shared guide/progress; Blender executable is installed. User explicitly approved trying custom Blender assets after discussing the first concept's visual limitations.
**Notes / open items:** author original Blender characters and furnishings, export real 3D assets into an interactive preview, retain fixed provider colors and label simulated activities. Current authorization covers this separate Blender experiment despite the earlier code-only decision recorded for Claude's branch.

## 2026-09-30 20:59 — Codex — Atelier interactive visual concept ready
**Status:** done (standalone visual concept; not integrated into the application)
**Changed:** `outputs/worklive-atelier-concept/` (HTML/CSS, Three.js scene, original procedural characters, local vendor modules and README); captured previews `outputs/worklive-atelier-*.png`. Claude's `work/visual-mocks/`, app source, installed build and user data were not edited.
**Verified:** concept JS syntax checks pass; live browser rendering, camera presets, character close-ups, direct 3D-monitor click and enlarged screen, day/evening, pause/resume, adding both providers up to six characters, capacity notice, projects/library panels. No browser console errors during interaction checks. Unchanged app baseline: `npm run check` 39/39 (34 worker + 5 office); `cargo test --manifest-path src-tauri/Cargo.toml` 30 pass, 2 ignored. No release build or installed-app restart required/performed for this isolated concept.
**Notes / open items:**
- All characters and room objects are built directly in Three.js; no Blender or imported character models used. Codex teal `#2D9D8F`, Claude terracotta `#D97757` preserved.
- Oak/sage studio, arched windows, detailed desks/coffee/lounge, jointed characters with blinking/typing/coffee poses, contact shading, camera transitions and illustrative screens.
- The concept is fully local and makes no model/CLI calls. Task, project and memory contents are examples. Extra agents are session-only; refresh restores four. Not a large-office growth or production performance implementation.
- Local preview server on loopback port 8773; README includes restart instructions and limitations. Kept separate for user style comparison before any integration.
- Browser automation button clicks had coordinate offsets; keyboard activation and a direct monitor click were verified. Temporary desktop viewport override was reset. No claim of full cross-browser/performance validation.
- Claude's active visual work remains reserved to Claude; this entry does not authorize overwriting it.

## 2026-09-30 20:36 — Codex — independent atelier visual concept
**Status:** done — see completion entry above
**Changed:** isolated concept in `outputs/worklive-atelier-concept/`; Claude's `work/visual-mocks/`, the app source, installed build and user data remain reserved/unmodified.
**Verified:** read latest shared guide and progress. User explicitly requested a separate best-effort visualization after authorizing parallel concepts.
**Notes / open items:** build a detailed interactive architectural studio with original procedural characters, fixed teal/terracotta provider shirts, warm lighting, camera presets and illustrative monitor interactions. This is a visual prototype, not a release or real task execution.

## 2026-09-30 20:34 — Codex — parallel-work coordination check
**Status:** done (record check only; Claude's visual work remains in progress)
**Changed:** this progress entry only; no app source or build changes.
**Verified:** read the shared guide and progress log; confirmed the standalone visual mock files and A/B screenshots exist. No code changes, so test suites were not rerun; the recorded baseline remains 39 JS + 30 Rust passing, 2 live tests ignored.
**Notes / open items:**
- User proposed parallel work while Claude improves the characters and office look and feel.
- Claude's latest visual entry reports a style choice pending: A modern stylized or B semi-realistic. Its mock is separate from the shipped app.
- Keep Claude responsible for the visual mock and subsequent office rendering changes. Codex can do an independent, read-only audit of task workflows, memory and reliability alongside it; that audit has not started in this session.
- This entry does not release Claude's active work or authorize overwriting its files. Coordinate source edits and packaged builds under the shared guide before applying fixes.

## 2026-09-30 23:59 — Claude Code — port to app 0.9.0 (started)
**Status:** in progress
**Changed:** backups `work/v08-complete-backup/` (source) and `work/v08-data-backup/` (user data). Plan: `work/visual-mocks` Comic office, nav/crowd, helpers,
hire dialog (AI suggestions via the provider CLIs), office growth, clean high-end UI with Transitions.dev CSS recipes; keep main.ts API; Rust agent fields + migration.

## 2026-09-30 23:40 — Claude Code — body overlaps fixed, bigger office
**Status:** done (mock); app source still untouched
**Changed (`work/visual-mocks/`):**
- Comic sub-agent: sofa/armchair/desk poses sit on real seat heights, chairs are separate objects that swivel with the agent,
  gestures keep hands out of heads, walk toes stay above the floor. New `tests/pose-check.mjs` (collision boxes per furniture piece
  in `styles/comic/colliders.js`, body probes in `probes.js`; 6 scenes, 44 agent checks). Close-ups: `shots/check-*.png`.
- Bigger office (user request): `layout.js` room 32 × 20 m (was 22 × 14), `DESK = 2.3 × 1.05 m` (was 1.9 × 0.86), 12 desks in three
  pairs of columns, wide aisles; café, meeting room and lounge moved right. Seat, keyboard (`keyboardZ`) and monitor keep fixed distances
  to the desk front, so poses stay valid for any desk size. nav.js, crowd.js, helpers.js, comic desks/rug/shadows follow the constants.
- `ctx.spot` / `ctx.settling` now also passed during seat slides.
**Verified:** `node tests/crowd.test.mjs` 3/3 seeds PASS (bunching 0.4–2.7 %, ~40 replans, 0 hits). `node tests/pose-check.mjs` 44/44 PASS
(was 18/44 before the fixes). Screens: `shots/comic-overview-big.png`, `shots/comic-desk-big.png` (helpers on the bigger desk).
**Notes / open items:** lower half of the room (z 2…10) is mostly empty — space for office growth (3rd desk row, amenities).
Next big step: port the comic style + nav/crowd + helpers into `outputs/worklive/src/office.ts` / `office-life.ts` (new version, backup first).

## 2026-09-30 23:05 — Claude Code — ruflo initialized
**Status:** done
**Changed:** workspace root: `.claude/`, `.claude-flow/`, `.mcp.json`, `.swarm/`, `ruvector.db`, `.gitignore` (from `ruflo init --no-signup --no-global --no-skills-sh`, ruflo v3.32.38).
AGENTS.md / CLAUDE.md / PROGRESS.md were not touched by init (verified against `work/pre-ruflo-backup/`). Removed ruflo's `"model": "claude-sonnet-5"`
pin from `.claude/settings.json` (original kept as `work/pre-ruflo-backup/settings.ruflo-original.json`). Added a Ruflo section to AGENTS.md.
**Verified:** `ruflo init check` → initialized. Daemon/swarm not started. New hooks load in the next Claude Code session.
Then, per user: pinned `"model": "claude-opus-5-5"` in `.claude/settings.json` (ruflo agents have no own model → they inherit it).
**Notes / open items:** skills.sh registration skipped (`npx skills add ruvnet/ruflo`) — run later if wanted.

## 2026-09-30 22:30 — Claude Code — comic style chosen; no-overlap movement
**Status:** in progress — body/pose overlap fixes running (comic sub-agent)
**Changed:** `work/visual-mocks/` only (app source untouched).
- User picked **Comic** (liked look + toon shaders). Game style stopped half-built (`styles/game/`, no screenshots) — not maintained.
- New `nav.js`: furniture footprints for the whole office, 10 cm grid, A* with 5 cm planning margin + string pulling, reserved spots (sofa, armchairs, counter, café, windows, books, plant, desks).
- New `crowd.js`: agents walk routes, slow/sidestep for each other, hard rule never closer than 0.56 m between centres or into furniture,
  replan when stuck, settle-slide into seats. Replaces the fixed waypoint loops in `mock.js`.
- Mock flags: `crowd=N` extra agents, `debug=nav`, `place=<agent>:<spot>`; `ctx.chair` / `ctx.spot` passed to characters (see `styles/README.md`).
**Verified:** `node tests/crowd.test.mjs` — 20 agents × 5 simulated min × 3 seeds: PASS (min gap 0.56 m, 0 furniture hits, 147–189 arrivals).
18 agents render in the browser (`shots/crowd-nav-debug.png`). Found pose overlaps: sofa (sinks into cushion), desk swivel through chair back.
- Follow-up (user: "stuck in the couch", "walking in a crowd"): seat slides never pause half-standing inside furniture (sit back after 1.5 s),
  pose switches with slide progress; ≤ 25 % of agents walk at once; no departing next to a walker; destinations spread; congestion-aware
  routes; same-direction walkers follow at ≥ 1 m instead of tailgating. Test now also fails on walker bunching (> 8 %) and slides > 3 s.
  Result: bunching 28–51 % → 2.5–4.8 %, replans 1,176 → ≤ 180, all 3 seeds PASS (`shots/crowd-spread.png`, 18 agents).
- **Subagent helpers** (user asked for it): `helpers.js` — while an agent works, mini versions of it (comic character at 0.3 scale) pop onto the
  desk's front corners through a portal ring with sparkles and a puff, show a tiny task tag, then turn into a gold star that flies into the
  agent's head ("result delivered"). Demo schedule only (Ada ≤ 3, Milo ≤ 2). Flags: `helpers=0`, `helperfreeze=appearing|working|leaving:0.5`.
  Screens: `shots/helpers-appear.png`, `shots/helpers-leave.png`.
**Notes / open items:** real helper data = subagent start/stop events from the CLI (Claude Code: Task/subagent events in stream-json — verify; Codex: unverified whether it has subagents).
Subagents share the parent's process (cheap in RAM) but spend subscription usage — show usage in the app.
User wants a **more spacious office + bigger desks**: next after the comic pose fixes (layout.js DESK constant; comic room reads it).
Port nav/crowd into `src/office-life.ts` later (it has its own hard-coded obstacles + tests); concurrency limit ~3–5 running agents (memory is per running agent, not graphics).

## 2026-09-30 21:10 — Claude Code — code-only character styles (polish, step 2)
**Status:** in progress — two Claude sub-agents building styles in parallel
**Changed:** `work/visual-mocks/` only (app source untouched).
- User decision: no imported model files; characters and office built fully in code. Old style B (Poly Haven + Xbot) moved to `work/visual-mocks/_dropped-style-b/`.
- Harness refactor: `mock.js` loads one style module per page (`?style=game|comic|classic`), interface in `styles/README.md`.
  New `Line-up` camera (all agents standing side by side), `snap` URL flag, `ctx.lookAt` so characters can look at the viewer.
- Old style A moved to `styles/classic/`. Headless screenshots: `node tools/shot.mjs <url> <out.png>` (Playwright in `tools/`).
- Building now: `styles/game/` (AAA-game look à la Witcher/GTA) and `styles/comic/` (detailed cartoon, Simpsons/Rick & Morty/Mario fun) — every character unique, generated from agent id; provider shirt colours kept.
**Verified:** `shots/classic-lineup.png` renders via the new harness.
**Notes / open items:** user picks Game or Comic from the screenshots, then port into `src/office.ts`.

## 2026-09-30 20:20 — Claude Code — office visual direction mock (polish, step 1)
**Status:** in progress — waiting for the user to pick a style
**Changed:** new standalone prototype `work/visual-mocks/` (not wired into the app; `outputs/worklive/` untouched).
Run: `cd work/visual-mocks && python3 -m http.server 8765` → http://127.0.0.1:8765 (three.js 0.185.1 from jsDelivr).
- Style A "modern stylized": procedural only (`stylized-room.js`, `stylized-character.js`).
- Style B "semi-realistic": CC0 Poly Haven furniture/HDRI/floor + three.js Xbot mannequin (`realistic.js`, assets in `assets/`, ~30 MB; Xbot is a Mixamo asset — check licence before shipping).
- Shared: perspective camera + OrbitControls (zoom to cursor, pan, WASD), fly-to, Follow, **Agent's eyes** (POV from the agent's head, drag to look), dollhouse wall cut-away,
  status beacons, name pills far away → task cards with progress up close, live-drawn monitor pages.
**Verified:** Playwright screenshots in `work/visual-mocks/shots/` (overview, follow, POV for A; overview, follow for B). No app tests affected.
**Notes / open items:** after the style decision, port into `src/office.ts` keeping `office-life.ts` movement + its tests; office grows from 6 desks to a layout-driven desk list.

## 2026-09-30 20:00 — Claude Code — shared handoff docs
**Status:** done
**Changed:** added `AGENTS.md` (shared guide), `CLAUDE.md` (imports it), `PROGRESS.md` (this log). No source changes.
**Verified:** `npm run check` 39/39 pass; `cargo test` 30 pass, 2 ignored.
**Notes:** history below reconstructed from the Codex session transcript
(`~/.codex/sessions/2026/09/30/rollout-2026-09-30T09-22-21-…`) and `outputs/worklive/README.md`.

## 2026-09-30 — Codex — history 0.1 → 0.8 (reconstructed)

Times are local (CEST).

| Time | Version | What was built | Checks |
|---|---|---|---|
| 09:22–09:52 | concept | Idea: 3D office of agents with desks; Tauri chosen; concepts from TerminalOS + Workspace-OS; agent browsers on desk monitors. Named **Worklive**. | — |
| ~10:20 | 0.1–0.2 | 3D office, agent creation (+ button), collision-free walking, coffee/chat routines | office tests |
| 10:44–11:16 | PRD | `Worklive Product Requirements.docx`; rule: all model calls via Codex/Claude subscriptions, shirt color per provider | — |
| ~12:30 | 0.3 | Real tasks through official CLIs, visible Chromium, pause/resume/take control, results + history | 24 |
| 12:45 | 0.3.1 + PRD v1.3–1.4 | Compact initial badges; memory + office-growth + gamification PRD addendum | — |
| 13:45 | 0.4 | Personal / project / company memory (SQLite FTS5), file import (TXT/MD/CSV/JSON/PDF/DOCX), revisions, proposals | 38 |
| 14:15 | 0.5 | Review/accept, single-file project handoffs, First delivery trophy | 46 |
| 14:35 | videos | `Worklive-Videos/`: live browser demo (real capture), office-growth-to-60 (concept animation) | — |
| 15:25 | 0.6 | Projects: briefs, team, persistent task board, accepted-prerequisite gating | 56 |
| 16:42 | 0.7 | Hand off result from the board → linked follow-up task; atomic task/handoff creation | 64 |
| 19:53 | 0.8 | Per-task reference files (10 × 10 MB), locked at start, private to the task | 69 |
| 19:55 | — | User: polish next, done with Claude Code in a terminal; Codex will review Claude's changes afterwards | — |
