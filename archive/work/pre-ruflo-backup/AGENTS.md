# Worklive — shared agent guide (Codex + Claude Code)

This file is the single source of truth for **both** Codex and Claude Code.
`CLAUDE.md` only imports this file. Keep project knowledge here, not in either tool's private memory.

**Before starting work:** read `PROGRESS.md` (the newest entry is at the top).
**Before ending a session:** add a `PROGRESS.md` entry (template inside that file).

## What Worklive is

A local macOS Tauri desktop app. Agents are 3D characters with desks in an office (Three.js).
Each agent runs real tasks through the user's **official Codex CLI or Claude Code CLI subscription** —
never direct API calls. Agents have a visible Chromium browser shown on their desk monitor, plus scoped
local memory (personal / project / company), projects with a task board, reviewed handoffs, and task files.

Owner: Clemens. Language of UI and docs: English.

## Layout

```
i-w/                              ← workspace root (Codex + Claude Code cwd; NOT a git repo)
├── AGENTS.md / CLAUDE.md / PROGRESS.md
├── outputs/                      ← deliverables shown to the user
│   ├── worklive/                 ← THE SOURCE CODE (edit here)
│   ├── Worklive.app              ← installed build (copied from src-tauri/target after `npm run build`)
│   ├── Worklive Product Requirements.docx          ← main PRD
│   ├── Worklive Memory and Office Growth.docx      ← PRD addendum (memory, office growth, gamification)
│   ├── Worklive-Videos/          ← demo + concept videos (README.txt explains them)
│   └── worklive-*.png            ← release screenshots
└── work/                         ← scratch: backups, smoke runs, PRD render checks, one-off patch scripts
    ├── vNN-complete-backup/      ← full source snapshot taken BEFORE building version NN+1
    ├── vNN-data-backup/          ← copy of user app data before a storage migration
    └── build_*.py / update_*.py  ← scripts that generated the PRD .docx files
```

Source (`outputs/worklive/`):
- `src/` — TypeScript frontend (no framework). `main.ts` UI + wiring, `office.ts` / `office-life.ts` 3D office,
  movement and routines, `context.ts` memory drawer, `projects.ts` board, `task-files.ts`, `workflow.ts`, `types.ts`.
- `src-tauri/src/` — Rust: `knowledge.rs` (SQLite + FTS5 memory), `projects.rs`, `collaboration.rs` (review/handoffs),
  `task_files.rs`, `context_files.rs` (PDF/DOCX extraction), `main.rs` (commands, worker supervision).
- `worker/` — Node sidecar: `providers.mjs` (CLI adapters, subscription checks), `agent-runtime.mjs` (run lifecycle,
  per-run MCP tool bridge), `tool-definitions.mjs`, `main.mjs` (Chromium sessions), `public-network.mjs` (public-only proxy).
- `README.md` — user-facing release notes and full behavior spec; it is updated with every release.

User data (do not delete): `~/Library/Application Support/com.worklive.prototype/`
(`agents.json`, `knowledge.sqlite`, `run-index.json`, `runs/`). Back up to `work/vNN-data-backup/` before migrations.

## Commands (run in `outputs/worklive/`)

```sh
npm run check                                   # tsc + worker syntax + JS tests (34 worker + 5 office)
cargo test --manifest-path src-tauri/Cargo.toml # Rust tests (30; 2 live-subscription tests are #[ignore])
npm run web                                     # frontend only in a browser, http://127.0.0.1:1432
npm run dev                                     # full Tauri app in dev mode
npm run build -- --debug                        # bundle; then replace outputs/Worklive.app
```

Always run both test suites after code changes and record the counts in `PROGRESS.md`.

## Non-negotiable product rules

1. **Subscriptions only.** Model calls go through the unmodified official `codex` / `claude` CLIs with their own login.
   No API keys, no API-key fallback, no token extraction, no credential proxy.
2. **Provider colors are fixed:** Codex shirt `#2D9D8F` (teal), Claude Code shirt `#D97757` (terracotta).
3. **Human in the loop:** work starts manually; "completed" ≠ "accepted"; handoffs share one explicitly reviewed file.
4. **Scope isolation is enforced in Rust** (personal / project / company / task). Don't move checks into the UI.
5. **Preserve user data** across upgrades: existing agents, briefs, runs, and results must survive migrations.
6. Fun elements (coffee breaks, trophies, amenities) are local animation — never spend subscription capacity.
7. Be honest in docs: label concept/planned features as such; don't claim verification that wasn't run.

## Working conventions (established by Codex, keep them)

- Before a new version: snapshot source to `work/vNN-complete-backup/` (NN = the current version).
- Bump `version` in `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`.
- Update `outputs/worklive/README.md`: behavior spec for the new feature + verification paragraph with check counts.
- Verify in the real app (packaged build, restart test), and save a screenshot as `outputs/worklive-<feature>-vNN.png`.
- There is no git. `PROGRESS.md` is the change log between the two tools — write to it.

## Coordinating Codex and Claude Code

- Only one tool edits the source at a time. If the latest `PROGRESS.md` entry says "in progress" by the other tool, ask the user first.
- Leave the source buildable and both test suites green at the end of a session; otherwise say so explicitly in `PROGRESS.md`.
- Put open questions for the other tool / the user under **Open items** in `PROGRESS.md`.
