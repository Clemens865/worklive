WORKLIVE — SCREEN LANDSCAPE
Working interaction prototype · 2026-10-01

OPEN
http://127.0.0.1:8776/

The local preview server is running for this session. If it is stopped later,
double-click start.command, then open the address above. Python 3 is required.
Or run: python3 -m http.server 8776 --bind 127.0.0.1
from this directory. Serve over HTTP; ES modules do not run by double-clicking
index.html. No npm install, build, framework or game engine is required.

TRY THIS
1. Open Ada's screen. Use the sample browser arrows and Take control.
2. Open case. Explore Files, Sources, Conversation and History.
3. Open Findings, read it and accept that version. The decision stays in History.
4. Press Escape to return. Switch Agents / Cases to see both ways of organizing work.
5. Add an agent: choose Codex or Claude Code, name, role and personality.
6. Give the agent a task. A new case saves the brief before any work starts.
7. Add a small file, send a case message, then start the demo task from Overview.
8. In five seconds a sample result appears for review. Refresh to check persistence.
9. Export case opens the complete JSON capsule. It includes file contents, sources,
   conversation and history. Download JSON or use Copy record. The embedded browser
   did not expose a download completion event during verification; the readable
   record/copy path is available in the same dialog.
10. Try Projects, Library, Inbox, Search (Command/Ctrl+K), and Menu.

WHAT WORKS
- Perspective agent screens with fixed teal Codex / terracotta Claude Code identity.
- Transform/opacity focus transitions; case folios unfold in shallow layers.
- Agent Browser, Chat, Task, Context and Results tabs.
- Case Overview, Files, Sources, Conversation and History tabs.
- Persistent local agents, cases, messages, attachments, memory notes and reviews.
- New agent and case forms, file preview/download, case export and search.
- Local demo task start, pause and completion; at most two simulations at once,
  with one per provider. Nothing starts automatically on page load.
- Take control pauses an active simulation; returning control does not resume it.
- Revision briefs remain in the accepted case and require a manual next start.
- Project filters, an attention inbox and a sample scoped memory library.
- Pagination, a horizontally browsable compact layout, keyboard navigation,
  dialog focus handling, and reduced motion (system preference or Menu switch).
- Confirmed reset affects only this prototype's local data.

SIMULATION BOUNDARY
This is a standalone clickable mockup. It does not connect to Worklive's Tauri
backend, the real browser worker, CLI subscriptions, private memory or user data.
Agent replies and results are clearly labeled local samples. Browser pages and
source captures are illustrative. Provider connections show preview status only.
No model/API calls, authentication, shell agent tasks or autonomous handoffs occur.
No security or scope enforcement is claimed for this frontend-only demo.

Attachments stay in browser localStorage, under a separate prototype key.
Limit: 1 MB per file, also subject to the browser's total storage quota. Text files
retain text; binary files retain a data URL for download/export. Export before
clearing browser data. Other browsers or ports have separate storage.
The capsule format is a prototype JSON export, not an implemented Worklive import
format. The case's assigned agent profile is included; global memories are not
silently exported with it.

MOTION / PERFORMANCE
Vanilla HTML, CSS and JavaScript. No WebGL, Three.js, PlayCanvas, animation library,
remote font or external asset requests. Original vector scenery and icons are
included locally. No continuous requestAnimationFrame loop or background polling.
Animation runs on interaction (and one five-second progress line during a demo).
Pagination bounds displayed agent screens to five, or four on medium widths.
The agent creation limit is 20. This is not a measured production performance
promise: actual browser sessions, provider work and Tauri integration need their
own profiling. The prototype uses a new directory; main app source is unchanged.

VERIFICATION
- JavaScript syntax checked for app.js and data.js.
- Actual embedded-browser walkthrough: agent creation with Claude identity;
  new case; case conversation; attaching the included sample-brief.txt; running
  a simulation; reviewing/accepting its result; reload persistence of those records.
- Inspected exported JSON in the UI: both file contents, accepted state, conversation,
  activity history and assigned provider were retained. Download completion was
  not confirmed by the embedded browser; it returned no download event.
- Project filtering/search, provider preview, library navigation and reduced-motion
  switch checked. Narrow viewport tested at 390 × 844 with no document-level
  horizontal overflow; shelves scroll locally and long case contents scroll.
- Browser console checked during the walkthrough: no errors or warnings observed.
- Main Worklive suites run read-only relative to source: npm run check passed
  43 worker + 24 office tests; cargo test passed 35, with 2 live tests ignored.
  No packaged-app rebuild or live provider/browser test was performed.

DESIGN / IMPLEMENTATION
The latest Worklive Screen Landscape studies and the case-capsule proposal are
in the sibling worklive-screen-landscape directory. This prototype uses original
implementation and locally drawn SVG assets. The design-reference-library skill
was used to review shared-layout motion principles; Motion's official reference:
https://motion.dev/docs/react-layout-animations
No Motion or third-party component source was copied or bundled.

NEXT INTEGRATION STEP
Replace the local demo store and simulation with a Worklive adapter. Add durable
cases/message history in the backend first; retain Rust scope checks, manual starts,
reviewed single-file handoffs, context provenance and official subscription CLIs.
Use the current browser worker's bounded previews in the screen surfaces.
