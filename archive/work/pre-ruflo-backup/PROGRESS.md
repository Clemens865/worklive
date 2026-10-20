# Worklive progress log

Shared between Codex and Claude Code. Newest entry first. Rules and project map: `AGENTS.md`.

## Current state (keep this block up to date)

- **Version:** 0.8.0 — installed at `outputs/Worklive.app` (built 2026-09-30 19:52)
- **Tests:** `npm run check` 39/39 JS (34 worker + 5 office) · `cargo test` 30/30 Rust, 2 live tests ignored
- **Status:** polish phase — **Comic style chosen** (`work/visual-mocks/styles/comic/`); now removing overlaps (crowd navigation done, body poses in progress)
- **Last editor:** Codex (isolated PlayCanvas prototype only; app source unchanged). Claude Code retains its visual-mock work.
- **Codex engine research:** complete; user rejected the heavier Blender Loft. lightweight rendering is mandatory; PlayCanvas leads for real 3D, 2.5D remains an optional tradeoff. Unity/Unreal/Higgsfield researched; no engine migration started.
- **Codex visual concept:** earlier Atelier study in `outputs/worklive-atelier-concept/` at http://127.0.0.1:8773/ — compare alongside Claude’s styles.
- **Codex PlayCanvas prototype:** `outputs/worklive-playcanvas-prototype/` at http://127.0.0.1:8775/ — 20 characters, optional two real browser previews, measured short runs near 60 FPS; intermittent drops under background load remain unresolved. No migration to the installed app.

### Open items / next up
1. **Polish pass** (agreed with the user 2026-09-30): review UI rough edges, usability and reliability across the whole
   workflow; then test in the running app together with Codex.
2. Office signals: indicator when an agent needs input; clicking an agent shows its current task.
3. Capacity/performance: target up to 20 team members for evaluation, initially retain the existing maximum of 2 active runs (1 per provider). Current browser worker separately caps created sessions at 6. Suspend idle screen captures and budget browser lifetimes before raising capacity; no 20-agent performance guarantee established.
4. Local project folders: agents edit files/run checks in isolated working copies (TerminalOS / Workspace-OS path).
5. Office growth: rooms/departments; amenities at 10 lounge, 20 table tennis, 30 TV, 40 gaming (PRD addendum v1.4).
6. Memory-quality benchmark for both providers (release requirement in PRD v1.3); semantic retrieval only if FTS falls short.
7. Not yet: signing/notarization, multi-file handoffs, autonomous delegation, Word/PDF generation.

---

## Entry template

```
## YYYY-MM-DD HH:MM — <Codex | Claude Code> — <short title>
**Status:** done | in progress | blocked
**Changed:** files/areas
**Verified:** commands + counts, live/app checks
**Notes / open items:**
```

---

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
