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
~/Documents/Software-Projects/Worklive/   ← workspace root (Codex + Claude Code cwd; private git repo)
├── AGENTS.md / CLAUDE.md / PROGRESS.md
├── app/                          ← THE SOURCE CODE (edit here)
├── build/Worklive.app            ← installed build (copied from src-tauri/target after `npm run build`; not in git)
├── docs/                         ← PRDs: Worklive Product Requirements (v1.0 + drafts), Memory and Office Growth addendum
├── design/                       ← concepts, mockups, prototypes, Worklive-Videos/, images/ (release screenshots), zips/
└── archive/work/                 ← scratch: backups, smoke runs, PRD render checks, one-off patch scripts
    ├── vNN-complete-backup/      ← full source snapshot taken BEFORE building version NN+1
    ├── vNN-data-backup/          ← copy of user app data before a storage migration (not in git)
    └── build_*.py / update_*.py  ← scripts that generated the PRD .docx files
```

Moved here on 2026-10-20 from `~/Documents/Codex/2026-09-30/i-w` (old paths in `PROGRESS.md` entries before that
date refer to it: `outputs/worklive/` → `app/`, `outputs/Worklive.app` → `build/`, `outputs/worklive-*` → `design/`, `work/` → `archive/work/`).

Source (`app/`):
- `src/` — TypeScript frontend (no framework). `main.ts` UI + wiring, `office.ts` / `office-life.ts` 3D office,
  movement and routines, `context.ts` memory drawer, `projects.ts` board, `task-files.ts`, `workflow.ts`, `types.ts`.
- `src-tauri/src/` — Rust: `knowledge.rs` (SQLite + FTS5 memory), `projects.rs`, `collaboration.rs` (review/handoffs),
  `task_files.rs`, `context_files.rs` (PDF/DOCX extraction), `main.rs` (commands, worker supervision).
- `worker/` — Node sidecar: `providers.mjs` (CLI adapters, subscription checks), `agent-runtime.mjs` (run lifecycle,
  per-run MCP tool bridge), `tool-definitions.mjs`, `main.mjs` (Chromium sessions), `public-network.mjs` (public-only proxy).
- `README.md` — user-facing release notes and full behavior spec; it is updated with every release.

User data (do not delete): `~/Library/Application Support/com.worklive.prototype/`
(`agents.json`, `knowledge.sqlite`, `run-index.json`, `runs/`). Back up to `archive/work/vNN-data-backup/` before migrations.

## Commands (run in `app/`)

```sh
npm run check                                   # tsc + worker syntax + JS tests (43 worker + 24 office: crowd + hair + character fit)
cargo test --manifest-path src-tauri/Cargo.toml # Rust tests (36; 2 live-subscription tests are #[ignore])
npm run web                                     # frontend only in a browser, http://127.0.0.1:1432
npm run dev                                     # full Tauri app in dev mode
npm run build -- --debug                        # bundle; then replace build/Worklive.app
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

- Before a new version: snapshot source to `archive/work/vNN-complete-backup/` (NN = the current version).
- Bump `version` in `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`.
- Update `app/README.md`: behavior spec for the new feature + verification paragraph with check counts.
- Verify in the real app (packaged build, restart test), and save a screenshot as `design/images/worklive-<feature>-vNN.png`.
- Git (private GitHub repo) keeps history, but `PROGRESS.md` stays the change log between the two tools — write to it.

## Ruflo (initialized 2026-09-30)

- `ruflo init` ran at the workspace root: `.claude/` (settings with hooks, skills, commands, agents, helpers), `.mcp.json`
  (`claude-flow` MCP server, autoStart off), `.claude-flow/` runtime, `.swarm/`, `ruvector.db`. Codex already has the `ruflo` MCP server in `~/.codex/config.toml`.
- `.claude/settings.json` pins `"model": "claude-opus-5-5"` (user's choice: Claude Code works with Opus 5.5 here). Ruflo's init wrote `claude-sonnet-5` — don't let a re-init overwrite it.
- Ruflo memory is optional help; `PROGRESS.md` stays the source of truth between Codex and Claude Code.
- Pre-init copies: `archive/work/pre-ruflo-backup/`.

## Coordinating Codex and Claude Code

- Only one tool edits the source at a time. If the latest `PROGRESS.md` entry says "in progress" by the other tool, ask the user first.
- Leave the source buildable and both test suites green at the end of a session; otherwise say so explicitly in `PROGRESS.md`.
- Put open questions for the other tool / the user under **Open items** in `PROGRESS.md`.
