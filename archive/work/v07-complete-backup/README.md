# Worklive 0.7.0

A local Tauri desktop app where agents have desks, characters, and real browser screens in a 3D office. Agents perform research and writing through your existing Codex or Claude Code subscription, with local personal, project, and company knowledge.

## Try it

Open the accompanying **Worklive.app** on this Apple Silicon Mac.

1. Select an agent and choose **Codex** (teal shirt) or **Claude Code** (terracotta shirt). The name badge also identifies the provider.
2. Check the connection status. Worklive uses the official installed command-line tools and their existing subscription logins. If necessary, use **Open official tool**, finish signing in there, then **Check connection**.
3. Write a bounded task. For example: “Read https://tauri.app/ and save a short Markdown summary with its source URL.” Select **Start task**.
4. Click the little monitor or **Open browser** to see the same Chromium session the agent is using.
5. Open **Work & results** to follow activity, read or open saved files, and inspect sources and earlier runs.
6. Use **Pause**, **Resume**, or **Stop** in the work panel. **Take control** pauses the real agent before handing over browser input. Returning control does not restart it automatically; choose **Resume**.
7. Send a revision from the work panel. The same provider continues its saved session when local knowledge is unchanged. Changing knowledge or project access starts fresh, without copying the old result; switching provider starts a new session with the same authorized local knowledge.
8. **New agent** adds another character, desk, and separate browser. **Agent profile** edits its name, role, and personality.

The office now uses compact initial badges. Hover a character or badge, or focus a badge with the keyboard, to see the full name, provider, role, and status. Click to select it in the side panel; Escape dismisses the detail tooltip. Provider shirt colors are unchanged.

Your original agents and task briefs are preserved when upgrading. Old profiles default to Codex until you choose a provider. A provider change during a task applies to the next run; the shirt continues to show the provider currently working.

Coffee breaks, stretching, plant care, and office chatter remain playful local animation. They do not use subscription capacity or represent real delegation. **Browser practice** remains available as a separate scripted demonstration.

## Context and memory

Select **Context & files** on an agent, or **Company knowledge** in the top bar.

- **Personal** holds an agent’s notes and reference files across either provider.
- **Project** shares knowledge between agents assigned to the same working project. Create a project and assign collaborators in the drawer. Each agent has one working project in this release.
- **Company** is the shared handbook and reference library for all current and future agents in this office. Notes you add are published immediately. Agent contributions arrive as proposals; review and publish them yourself.

Add or drag in TXT, Markdown, CSV, JSON, text PDF, or DOCX files, up to **10 MB each**, ten at a time. Originals and extracted passages are stored locally. PDF passages retain page numbers; text and Word passages carry extraction line references. Word import reads the main document body; images, comments, headers, footnotes and layout are omitted. Scanned/image-only documents need OCR, which is not included. Extraction is limited to 800 KB of text and 200 PDF pages; failures are shown rather than silently truncating the file. Importing the same bytes into the same scope reuses the existing file. A changed file is a separate entry; archive the superseded copy.

You can edit notes, attach a source, pin important notes, inspect revision history, archive entries, and restore them. Archive excludes context from future retrieval; it is **not permanent erasure**. Original files, older versions, past run evidence, and provider-side conversations can remain. This release has no full-forget function. Pause active tasks before editing shared context.

At task start the agent receives a bounded selection of pinned and relevant context. It can then list, search, and read authorized passages, and append durable memories. **Work & results → Context received** records excerpts and versions supplied to that run; it does not prove the model relied on every passage. **Memories added** shows new contributions. Memory is independent of the provider, so an agent can switch between Codex and Claude Code without losing it.

Access is checked in Rust using the run’s assigned agent and project. Agents cannot select another identity or change their own project. A run that has received personal context cannot write it into a project or company note; a project-bound run cannot write company proposals. Personal memories derived inside a project stay restricted to that project. The owner can deliberately add a reviewed summary to a wider scope. Source labels provide provenance, not a guarantee that a statement is true.

Storage uses SQLite with versioned entries and keyword retrieval (FTS5). There are no hosted embeddings or separate model calls for memory. Relevant context is sent through the selected official CLI when an agent works. There is one local company workspace. Image/spreadsheet interpretation, task-only attachments, multiple simultaneous project memberships, semantic retrieval, and a larger memory-quality benchmark remain future work.

## Reviewed work and project handoffs

1. In **Context & files**, create a project and assign two agents to it. Each keeps its own provider, personality, and private notebook.
2. Open a completed run in **Work & results**. Read its deliverable and sources, then **Mark accepted** when it is useful. Agent completion alone does not count as acceptance.
3. Choose **Hand off to teammate**, or **Hand off result** on an accepted project card. Pick one saved file and a teammate in the same project, read the exact preview, and give the next task a title and brief. Confirm that the file can be used in project notes and results, then **Queue handoff task**.
4. The new handoff appears as a planned project task with its approved input attached. Start it from **Projects** or **Handoffs**; both open the same run, using the recipient’s currently selected provider. Queued work never starts automatically.
5. The recipient gets the approved file and the new brief, plus its normally authorized local context. The source agent’s notebook, other files, and CLI conversation are not transferred. The recipient reads the snapshot with a scoped tool; received passages appear in **Context received**.

The source file is checked against its saved fingerprint at acceptance and sharing, and the handoff keeps an immutable copy. Both agents must still belong to the project when work starts or resumes. The task and handoff have one current run, reserved together before subscription checks. A sign-in failure appears as **Needs input**; use **Work & results → Resume** after fixing the connection. Continuations retain both links, including when switching providers. Older handoffs created before 0.7 keep their original workflow and are not retroactively added to the board; those still remain queued if subscription checks fail before context is attached.

**Reopen review** withdraws acceptance and cancels queued handoffs from that run. It also blocks future continuation of a started handoff based on that approval. Already produced results and history remain; this cannot retract information already sent to a provider. When the source is itself a project task, its current run must still match the shared source. A newer source run requires a fresh handoff even if an older result was accepted. Pause active tasks before changing reviews or queued handoffs. Cancelling a started task uses its normal Pause/Stop controls.

Your first accepted deliverable adds a small **First delivery** trophy to the office. It is cosmetic, local, and uses no model calls. Each original task earns at most one milestone across its revisions; reopening and accepting it again adds no credit. Earned decorations remain visible. There are no streak penalties or rewards for tokens spent.

This first handoff release shares one text/Markdown/CSV file per handoff, up to 100,000 characters. It has no automatic delegation, multi-file handoff, or automatic publication to project memory. Those remain later steps. Project tasks can express a manual prerequisite chain as described below.

## Projects and task board

Open **Projects** in the top bar. Existing projects and agent assignments are retained.

1. Create a project or **Edit brief** to give it a goal and a definition of done. The complete brief is included in each project agent’s next run, with its version and timestamp in **Context received**. Changing it starts fresh context on continuation.
2. Use **Manage team** to add agents. Each has one working project; moving it changes its future context access. **Shared context & files** opens the existing project library for a teammate.
3. **Add task** with a title, owner, brief, and expected deliverable. Optionally choose one prerequisite from the same project. Ordinary planned tasks can be edited or removed; dependency loops and cross-project links are rejected.
4. Choose **Start** on a task. It uses the owner’s currently selected provider and preserves their office task brief. Work is always started manually. A prerequisite unlocks only after its **current** result is accepted by you.
5. Cards move through **Planned**, **Working**, **Needs input**, **Review**, and **Accepted** from the real run and review records. Open **View work** to pause, resume, revise, or inspect saved files. Provider errors and interrupted runs remain linked to the card.

Tasks, current run links, and project briefs are stored in SQLite. Revisions remain attached to the same task; old history cannot fork it into a second current run. Project membership and prerequisite acceptance are checked again at start and resume. Revising or reopening a prerequisite blocks future dependent starts until its latest result is accepted; it does not stop already-running work or retract previously sent context.

A dependency controls order, **not file sharing**. **Hand off result** creates a new task with one explicitly reviewed input. Click the input filename on its card to inspect the immutable snapshot, source run, approval timestamp, and fingerprint. No other files, notebooks, or conversations are transferred. If source approval changes, the unstarted card moves to **Needs input**. A task currently supports one prerequisite. A handoff from a project task automatically uses that source task as its prerequisite. A handoff task keeps its agreed recipient, brief, and file; to change them before starting, remove the planned task and create a new reviewed handoff. Removing an unstarted handoff task also cancels its queue entry. Started cards keep their original brief and history; use revisions for follow-up work. Pause active tasks before editing the shared plan.

## This release can do

- Project briefs, team assignment, and a persistent task board with accepted prerequisites and reviewed input files.
- Human acceptance, queued project handoffs, and a First delivery office trophy.
- Local notes and uploaded reference files, scoped to an agent, project, or company.
- Public web research in the visible browser: open a URL, read a page, follow an observed link, and scroll.
- Writing and source-based summaries saved as Markdown, plain text, or CSV.
- Per-agent provider selection and isolated browser contexts.
- Real activity, captured source excerpts and hashes, versioned files, revisions, and persistent task history.
- Pause, stop, manual takeover, exact-session continuation, and recovery after interruption.
- One Codex and one Claude Code task at the same time, across an office of up to six agents.

This first productive slice does not yet edit projects, run user commands, generate Word/PDF files, autonomously delegate between agents, submit forms, or act in signed-in accounts. Research contexts are fresh after restart and do not use your personal browser profile. There is one page per agent; popups, downloads, service workers, and WebSockets are disabled. External requests are limited to public HTTP/HTTPS destinations on standard ports and GET/HEAD requests. Some websites therefore will not work in this release.

Each run has a ten-minute and 40-tool-call limit. Provider subscription limits still apply and may be shared with your other usage. This is not a guarantee of unlimited or free usage: provider-side extra-usage settings and plan rules remain yours. There is no direct model API client, API-key fallback, token extraction, or credential proxy in Worklive.

## Local execution and storage

Rust supervises a local Node worker. It starts the official, unmodified Codex or Claude Code executable as a subprocess, reads structured output, and supplies a small per-run MCP tool bridge. Model calls originate in those official tools using their own authentication. Worklive does not scrape an interactive terminal screen or emulate provider login protocols.

Each run gets a private working directory and a separate local tool connection. Built-in command/file tools, unrelated integrations, hooks, and inherited API credentials are disabled or excluded for this research slice. Browser requests pass through a public-address proxy that validates DNS and pins the connection address. Stopping a task revokes its tool connection; stale link references cannot be reused after navigation or a control handoff.

The app stores agents and runs in:

`~/Library/Application Support/com.worklive.prototype/`

- `agents.json`: profiles and selected providers.
- `knowledge.sqlite` (and SQLite journal files): scoped notes, projects and briefs, task plans and run links, original attachments, extracted passages, revisions, the search index, review records, immutable handoffs, and earned milestones.
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
cargo test --manifest-path src-tauri/Cargo.toml
npm run build -- --debug
```

`npm run check` covers movement/collision behavior, browser ownership, subscription classification, process configuration, private-network restrictions, output isolation, pause cancellation, session continuation, and crash recovery. Live smoke checks additionally exercised both installed CLIs through the real MCP bridge, browser, saved outputs, and exact-session revisions. The packaged 0.4.0 interface was checked with note creation, Word import, read-only context during a run, and a completed local-reference task. PDF extraction was also checked in the isolated parser. The memory checks cover scope isolation, revision conflicts, archive/restore, inherited project restrictions, source receipts, and context changes invalidating old sessions. The opt-in Rust test `subscription_memory_smoke` exercises actual Codex → Claude memory handoff and a corrected source in a fresh Codex session with synthetic data. The 0.5.0 checks additionally cover accepted-file fingerprints, duplicate handoffs, recipient/project boundaries, withdrawn reviews, resume ownership and milestone deduplication. A native Ada → Milo handoff completed with Codex; the opt-in `subscription_handoff_smoke` test also completed with Claude Code. The 0.6.0 checks add dependency gates, cycle rejection, membership checks, stale run prevention, project-brief revisions, durable task links, old-database migration, provider failures, and separation of entity IDs from transport IDs. The 0.7.0 checks additionally cover atomic task/handoff creation and claiming, rollback on storage failure, exact source-run matching, shared-input enforcement, cancellation, and starting from either interface. There are 64 passing automated checks (38 JavaScript/office checks and 26 Rust storage/import/workflow checks), plus opt-in live subscription tests. The packaged 0.6.0 app was exercised with an existing project brief, task creation and editing, a Codex task, manual acceptance unlocking a Claude Code task, shared context access, and a full restart. Both saved outputs cited project goal v1; agent profiles and office task briefs remained unchanged. The packaged 0.7.0 app was exercised from an accepted Milo/Codex board card through an explicit single-file handoff to Ada/Claude Code. Ada read and cited the shared snapshot and saved a three-scenario test plan for review. The board and handoff inbox opened the same run; a full restart preserved the link, output fingerprints, review state, and existing agent profiles. These checks are not a measured general recall/accuracy benchmark.

- `src/`: Three.js office, movement simulation, task and result interface.
- `src-tauri/`: native shell, SQLite knowledge, isolated file extraction, worker supervision, and local document opening.
- `worker/providers.mjs`: official CLI adapters and subscription checks.
- `worker/agent-runtime.mjs`: task lifecycle, history, scoped tool bridge, and output storage.
- `worker/main.mjs`: visible Chromium sessions and serialized browser input.
- `worker/public-network.mjs`: public research proxy and destination validation.
- `worker/*.test.mjs`, `tests/`: runtime and office checks.

The bundle includes the browser worker and its library. Installed Node.js and a browser are still required; signing, notarization, installers, and cross-platform distribution remain future work.

Workspace-OS and TerminalOS informed the workstation, browser, activity, and source/output concepts. Neither existing project was modified. Reviewed handoffs are now included. A permissioned workspace for editing project files remains a later integration step.

## Product roadmap

The memory and office-growth PRD remains the broader design. This build keeps the existing six-agent studio and local daily routines. Stepped amenities—10 lounge, 20 table tennis, 30 TV, 40 gaming—and later floors/departments are planned. The 0.5.0 First delivery trophy celebrates accepted work. Larger rosters, room/floor growth, and the 20/30/40 amenity unlocks remain planned. No activity points, streak pressure, or background model chatter are introduced.
