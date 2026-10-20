# Worklive 0.3.1

A local Tauri desktop app where agents have desks, characters, and real browser screens in a 3D office. Agents can now perform research and writing through your existing Codex or Claude Code subscription.

## Try it

Open the accompanying **Worklive.app** on this Apple Silicon Mac.

1. Select an agent and choose **Codex** (teal shirt) or **Claude Code** (terracotta shirt). The name badge also identifies the provider.
2. Check the connection status. Worklive uses the official installed command-line tools and their existing subscription logins. If necessary, use **Open official tool**, finish signing in there, then **Check connection**.
3. Write a bounded task. For example: “Read https://tauri.app/ and save a short Markdown summary with its source URL.” Select **Start task**.
4. Click the little monitor or **Open browser** to see the same Chromium session the agent is using.
5. Open **Work & results** to follow activity, read or open saved files, and inspect sources and earlier runs.
6. Use **Pause**, **Resume**, or **Stop** in the work panel. **Take control** pauses the real agent before handing over browser input. Returning control does not restart it automatically; choose **Resume**.
7. Send a revision from the work panel. The same provider continues the exact saved CLI session. Changing provider starts a fresh session with the prior visible result and task context.
8. **New agent** adds another character, desk, and separate browser. **Agent profile** edits its name, role, and personality.

The office now uses compact initial badges. Hover a character or badge, or focus a badge with the keyboard, to see the full name, provider, role, and status. Click to select it in the side panel; Escape dismisses the detail tooltip. Provider shirt colors are unchanged.

Your original agents and task briefs are preserved when upgrading. Old profiles default to Codex until you choose a provider. A provider change during a task applies to the next run; the shirt continues to show the provider currently working.

Coffee breaks, stretching, plant care, and office chatter remain playful local animation. They do not use subscription capacity or represent real delegation. **Browser practice** remains available as a separate scripted demonstration.

## This release can do

- Public web research in the visible browser: open a URL, read a page, follow an observed link, and scroll.
- Writing and source-based summaries saved as Markdown, plain text, or CSV.
- Per-agent provider selection and isolated browser contexts.
- Real activity, captured source excerpts and hashes, versioned files, revisions, and persistent task history.
- Pause, stop, manual takeover, exact-session continuation, and recovery after interruption.
- One Codex and one Claude Code task at the same time, across an office of up to six agents.

This first productive slice does not yet edit projects, run user commands, generate Word/PDF files, delegate between agents, submit forms, or act in signed-in accounts. Research contexts are fresh after restart and do not use your personal browser profile. There is one page per agent; popups, downloads, service workers, and WebSockets are disabled. External requests are limited to public HTTP/HTTPS destinations on standard ports and GET/HEAD requests. Some websites therefore will not work in this release.

Each run has a ten-minute and 40-tool-call limit. Provider subscription limits still apply and may be shared with your other usage. This is not a guarantee of unlimited or free usage: provider-side extra-usage settings and plan rules remain yours. There is no direct model API client, API-key fallback, token extraction, or credential proxy in Worklive.

## Local execution and storage

Rust supervises a local Node worker. It starts the official, unmodified Codex or Claude Code executable as a subprocess, reads structured output, and supplies a small per-run MCP tool bridge. Model calls originate in those official tools using their own authentication. Worklive does not scrape an interactive terminal screen or emulate provider login protocols.

Each run gets a private working directory and a separate local tool connection. Built-in command/file tools, unrelated integrations, hooks, and inherited API credentials are disabled or excluded for this research slice. Browser requests pass through a public-address proxy that validates DNS and pins the connection address. Stopping a task revokes its tool connection; stale link references cannot be reused after navigation or a control handoff.

The app stores agents and runs in:

`~/Library/Application Support/com.worklive.prototype/`

- `agents.json`: profiles and selected providers.
- `run-index.json`: task history index.
- `runs/<run-id>/run.json`: task, provider/session identifiers, activity, source excerpts, and file hashes.
- `runs/<run-id>/outputs/`: the saved documents and the agent’s final response.

Previous outputs are retained. A final reply without a document is shown as needing attention, not a successfully delivered task. “Ready for review” means the process completed and a document was saved; it does not certify factual quality. The work panel keeps provider failures and partial results visible.

CLIs may also retain conversations under their own normal storage policies. Browser contents and task instructions are sent to the chosen provider through its CLI. Consult the provider’s current terms before distributing a commercial wrapper; this build is a local prototype, not a statement of general integration approval.

## Requirements and development

This build uses installed Node.js, Chrome (Chromium or Brave as fallbacks), Rust, and Xcode command-line tools. For tasks, install and sign in to at least one official CLI. Verified locally with **Codex 0.159.0** and **Claude Code 2.1.285**. Startup checks for required controls and blocks unsupported versions or API-based authentication instead of falling back.

```sh
npm run setup
npm run dev
npm run check
npm run build -- --debug
```

`npm run check` covers movement/collision behavior, browser ownership, subscription classification, process configuration, private-network restrictions, output isolation, pause cancellation, session continuation, and crash recovery. Live smoke checks additionally exercised both installed CLIs through the real MCP bridge, browser, saved outputs, and exact-session revisions. The packaged app was checked through its native interface.

- `src/`: Three.js office, movement simulation, task and result interface.
- `src-tauri/`: native shell, persistence, worker supervision, and local document opening.
- `worker/providers.mjs`: official CLI adapters and subscription checks.
- `worker/agent-runtime.mjs`: task lifecycle, history, scoped tool bridge, and output storage.
- `worker/main.mjs`: visible Chromium sessions and serialized browser input.
- `worker/public-network.mjs`: public research proxy and destination validation.
- `worker/*.test.mjs`, `tests/`: runtime and office checks.

The bundle includes the browser worker and its library. Installed Node.js and a browser are still required; signing, notarization, installers, and cross-platform distribution remain future work.

Workspace-OS and TerminalOS informed the workstation, browser, activity, and source/output concepts. Neither existing project was modified. The next integration step is a permissioned project workspace and a reviewable handoff between agents.
