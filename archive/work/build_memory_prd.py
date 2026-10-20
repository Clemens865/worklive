from pathlib import Path
# Reuse the established PRD typography and OOXML helpers without rebuilding it.
source = Path('work/build_worklive_prd.py').read_text()
exec(source.split("p('Worklive Product Requirements','Title')")[0])
OUT = ROOT / 'outputs' / 'Worklive Memory and Office Growth.docx'
doc.core_properties.title = 'Worklive Memory and Office Growth'
doc.core_properties.subject = 'PRD addendum for personal and company memory, context files, office growth and playful productivity'
S = {
'S1': ('Letta memory blocks', 'https://docs.letta.com/v1-sdk/memory/memory-blocks', 'Shared blocks and bounded context.'),
'S2': ('Mem0 repository', 'https://github.com/mem0ai/mem0', 'Current memory pipeline, embedding defaults and benchmark qualifications.'),
'S3': ('Graphiti repository', 'https://github.com/getzep/graphiti', 'Temporal graph memory and deployment requirements.'),
'S4': ('Hindsight memory banks', 'https://hindsight.vectorize.io/blog/2026/07/16/bank-strategy-agent-memory', 'Choosing boundaries for isolated banks.'),
'S5': ('Hindsight model integration', 'https://hindsight.vectorize.io/developer/models', 'Extraction and reflection models; distinct Claude Code and Codex paths.'),
'S6': ('LangGraph memory overview', 'https://docs.langchain.com/oss/javascript/concepts/memory', 'Conversation state versus long-term namespaced memory.'),
'S7': ('AgentDB repository', 'https://github.com/ruvnet/agentdb', 'Episodic memory, skills and local integration surfaces.'),
'S8': ('RuVector repository', 'https://github.com/ruvnet/RuVector', 'Rust memory components, local embeddings and namespace mechanisms.'),
'S9': ('SQLite FTS5', 'https://www.sqlite.org/fts5.html', 'Local full-text indexing and BM25 ranking.'),
'S10': ('Qdrant multitenancy', 'https://qdrant.tech/documentation/manage-data/multitenancy/', 'Filtered vector collections and tenant partitioning.'),
'S11': ('Three.js InstancedMesh', 'https://threejs.org/docs/pages/InstancedMesh.html', 'Shared geometry and materials for repeated objects.'),
'S12': ('Hindsight configuration', 'https://hindsight.vectorize.io/developer/configuration', 'Model transports and embedding configuration.'),
}
def page(title):
    heading = h(title)
    heading.paragraph_format.page_break_before = True

p('Worklive Memory and Office Growth', 'Title')
p('Product requirements and memory system research', 'Subtitle')
p('PRD addendum 1.4  •  30 September 2026')
blocks('''
**Recommendation.** Store personal, project and company memory locally in Worklive. Every agent can use Codex or Claude Code with the same authorized knowledge and attached files. All company agents can read the company handbook. Test memory quality on both providers before release, adding local semantic retrieval if the text-search baseline falls short.
The office should expand through small rooms, department floors and, eventually, several buildings. Agent count determines available space. Subscription capacity determines how many agents can actually work at once. These are separate product controls.
This addendum extends the existing PRD with context files, company knowledge and playful progression. Compact labels are implemented in 0.3.1; memory, file attachments, growth and achievements described here are upcoming requirements.
''')
h('Decisions to carry forward',2)
table(['Area','Proposed decision'],[
('Agent memory','Private notes and reusable lessons belong to a stable agent ID, independent of name, provider and appearance.'),
('Project memory','Members can read and append findings; every entry names its author, source, time and status. Canonical decisions have explicit owners.'),
('Company context','All company agents read its approved handbook and shared files. Private and project context stay within their assigned scope.'),
('Execution','Every agent supports either official CLI. Memory survives provider changes; extraction and reflection use the selected CLI, with no hidden model API or hosted embedding fallback.'),
('Office growth','Rooms contain up to 12 desks; four rooms form a floor and four floors form a building. These are proposed layout units to prototype.'),
('Character identity','Personality, role and appearance are customizable. Codex teal and Claude terracotta remain reserved for the visible shirt.'),
('Playful work','Roster milestones unlock amenities. Reviewed work earns optional cosmetic achievements; rewards never require extra inference.'),
], [1.25,5.69])
h('What changes now',2)
p('Worklive 0.3.1 replaces floating information cards with small initial badges. Hovering a character or badge reveals its name, provider, role and activity; keyboard focus reveals the same details. Clicking keeps full information in the side panel. The current six-agent limit and two-task execution limit remain in place.')

page('1 Memory systems compared')
p('There is no universal winner. The strongest choice depends on whether the product needs personalization, shared working context, temporal relationships, or local retrieval. This is a documentation review of current primary sources, not a measured performance ranking.')
table(['System','Useful capability','Fit for Worklive'],[
('Letta [S1]','Bounded memory blocks can be shared between agents; some blocks can be read-only.','Best reference for private and shared notebooks. Replacing the CLI runtime with Letta is unnecessary for the next milestone.'),
('Mem0 [S2]','Agent and user memory, extraction and retrieval. Current docs describe append-only extraction and several retrieval signals.','A useful general memory layer, but defaults include a model and embedding calls. Its managed benchmark results are explicitly not identical to the open-source SDK.'),
('Graphiti and Zep [S3]','Temporal knowledge graphs for evolving facts and relationships.','Strong candidate if dependency and change-over-time questions dominate. The graph service, extraction and embeddings add operational work beyond a local notebook.'),
('Hindsight [S4] [S5]','Memory banks organize retention, retrieval and reflection.','Most interesting advanced-memory candidate for a later prototype. Bank boundaries align with agents and projects, but model transport and background jobs need close control.'),
], [1.25,2.5,3.19])
h('The subscription integration trap',2)
blocks('''
“Works with Codex” can mean that Codex calls a memory tool, or that the memory service itself uses a model. Both directions need to be inspected. A tool integration alone does not establish that its internal extraction and embedding steps use the official CLI.
Hindsight’s current documentation describes its Claude Code backend as using the official Agent SDK and bundled CLI, with a local personal-development qualification. Its openai-codex backend reads Codex authentication data; its configuration identifies an HTTP transport. That second path does not meet Worklive’s CLI-only design. We should not enable it as a shortcut. [S5] [S12]
Self-hosting storage does not by itself remove model calls. Worklive should retain ownership of scheduling, provider choice, cancellation and usage visibility for any memory processing.
''')

page('2 Recommended local foundation')
blocks('''
**Use SQLite as the authoritative memory store, with FTS5 keyword search as the first retrieval baseline.** SQLite provides full-text indexing and BM25 ranking locally. Our recommendation is based on integration fit and inspectability, not a claim that keyword search matches semantic retrieval quality. Quality gates determine what ships. [S9]
This gives us transactions, explicit ownership, revisions and exportable records without introducing another model service. The agent can formulate memory searches and structured notes through its existing CLI session. Storage operations themselves require no inference.
''')
table(['Candidate','Role in the design','Decision'],[
('LangGraph [S6]','Separates thread state from long-term memory organized by namespaces.','Borrow this separation. Worklive can implement it without adopting the whole orchestration framework.'),
('AgentDB [S7]','Local agent memory with episodes, reusable skills, a Node API and MCP tools.','Shortlist for a measured local-memory spike. Audit the pinned version and expose only tools within Worklive’s scope.'),
('RuVector [S8]','Rust vector and agent-memory components with documented local embedding options.','Shortlist for a Rust integration if semantic retrieval is justified. Verify persistence, deletion, isolation and recovery in the actual adapter.'),
('Qdrant [S10]','Vector storage with payload filtering and multitenancy options.','Consider for a future shared service. It is a retrieval engine, not a complete policy or memory lifecycle.'),
], [1.25,2.75,2.94])
h('A replaceable search layer',2)
p('Keep a stable MemoryStore boundary with search, read, append, supersede and forget operations. Rust owns membership checks and canonical records. A derived vector index can be rebuilt from those records. It must not become the only place where permissions, decisions or provenance exist.')
p('If keyword retrieval misses required evidence, evaluate local embeddings and hybrid search before release. Use exact vector search as the baseline before adding an approximate index. A local embedding model is an explicit component, not another API credential; hashed vectors are not a substitute for semantic retrieval.')
h('Why not pick from leaderboard numbers',2)
p('Vendor benchmarks can use different corpora, model backbones, retrieval budgets and proprietary services. Mem0 explicitly distinguishes its platform results from its open-source SDK. Worklive needs its own tests for shared projects, corrections, permissions and provider switching. [S2]')

page('3 Memory scopes and ownership')
p('Personal, project and company knowledge form three lasting memory layers. Identity and run evidence remain distinct records. The owner can inspect, correct, export and forget memories; private agent notes are hidden from other agents, not from the owner.')
table(['Scope','Content','Who can use it'],[
('Agent identity','Name, role, character style and working preferences.','The owner and that agent. Identity is configuration, not evidence that fictional events occurred.'),
('Agent notebook','Task lessons, personal working notes and reusable methods.','That agent and the owner. Notes derived from a project retain the source project’s access restrictions.'),
('Project knowledge','Brief, accepted decisions, findings, references, open questions and handoffs.','Current project members according to read or contribute permission. Sharing a floor does not grant access.'),
('Company knowledge','Mission, products, brand voice, terminology, approved policies and shared reference files.','Every current and future agent in that company can read. The owner publishes revisions; agents propose changes.'),
('Run evidence','Observed sources, outputs, tool events and the memory context used during one run.','The run’s authorized participants and owner. This supports audit and replay without treating every log line as durable knowledge.'),
], [1.25,2.8,2.89])
h('Required record fields',2)
blocks('''
Every memory has a stable ID, workspace ID, company ID, scope and scope ID, kind, content, author agent or user ID, source run ID, source references and content hash. Project-derived records carry their originating project and restrictions. File references include a version and page, section or row locator.
Store **recorded_at** for when Worklive saved the entry, **observed_at** for when the evidence was seen, and optional **valid_from** and **valid_to** for the period the statement describes. Persist UTC; display the user’s local time with the original time available.
Include verification state, reviewer if any, revision, supersedes ID, optional expiry and an idempotency key. A model’s confidence is a claim, not verification. The host stamps author identity, provider, timestamps and scope from the active run; the agent cannot impersonate another author.
''')
h('A useful memory is small and attributable',2)
p('Save “The approved export format is Markdown, decided by the owner on 30 September” with its decision reference, rather than a whole conversation labeled “project facts.” Preserve the supporting artifact separately. Do not store passwords, session tokens or casual coffee chatter as project knowledge.')

page('4 A shared company handbook')
p('Company memory is the common knowledge every agent needs when representing the same organization. It is readable across departments and projects inside that company, including by newly created agents. Separate companies remain isolated.')
table(['Part of the handbook','Example','How it enters context'],[
('Company essentials','Mission, audience, product names and a short approved working charter.','A bounded, current essentials block at task start.'),
('Brand and communication','Voice, spelling, terminology, visual guidelines and examples.','Retrieve relevant approved entries for the task.'),
('Ways of working','Definition of done, document templates and accepted processes.','Current applicable decisions plus their sources.'),
('Shared reference library','Brand book, product specifications and company reference documents.','Search authorized file extracts and cite exact versions.'),
('Company decisions','Owner-approved changes with effective dates and revision history.','Return the current decision; expose history when requested.'),
], [1.6,2.67,2.67])
h('Read by everyone and edited deliberately',2)
blocks('''
The user edits and publishes company knowledge directly. Every agent may propose a new finding or correction with evidence, but cannot silently replace published guidance. Keep proposals separate from approved entries and show a compact review queue with the proposed change and its source.
Attaching a file to the company makes it readable by all company agents; it does not make every statement inside it an approved instruction. Pin or approve extracted decisions explicitly. Material originating in a restricted project needs a deliberate sharing action before entering the handbook.
''')
h('Context without overload',2)
p('Use one budget across company essentials, project decisions, personal notes and file excerpts. Search the full authorized library as needed instead of inserting every file into every task. Record which entries and file passages reached the provider. Agents should identify missing evidence or a relevant conflict rather than fill gaps with invented company facts.')
h('Updates and disagreements',2)
p('New runs use the latest published version. Show changes made since an existing run began; a critical policy update pauses affected work and starts fresh context before it continues. An approved project exception may override a named company rule only when its owner, scope and expiry are recorded. Otherwise show the conflict for resolution. Memory never grants tool or data access.')
h('A visible place in the office',2)
p('Open Company knowledge from the main navigation or a bookshelf in the office. Provide the same accessible list view in both places: Essentials, Documents, Decisions and Proposed changes. Agent panels show company knowledge alongside personal and project memory, with a clear scope label.')

page('5 Files as working context')
p('The user can drag files onto an agent or use Add files in its panel. A Context drawer shows what that agent can use. The task composer supports temporary attachments; project and company libraries make documents reusable without adding them separately to each agent.')
table(['Attach to','Availability','Default behavior'],[
('This task','Only this task and its authorized continuations.','An attachment added in the task composer.'),
('This agent','This agent across future tasks and provider changes.','A file dropped onto the character or added to its panel.'),
('This project','Current project members working within the project.','A deliberate project-library attachment.'),
('Company','Every agent in this company, now and later.','A deliberate company-library attachment; visible sharing label.'),
], [1.05,2.87,3.02])
h('The attachment flow',2)
blocks('''
1. Add files by drag and drop, file picker, or selecting an existing Worklive library item. Choose the scope where necessary; never silently broaden an agent attachment to the company.
1. Import a local snapshot and extract readable content. Show Preparing, Ready, Needs attention or Unsupported beside each file, with filename, version, scope and a preview.
1. Review the context and start work. Explain that files are stored locally and the relevant content is sent to the selected Codex or Claude Code tool when used. Importing alone starts no model task or external upload.
1. Open a result citation to its original passage, page or spreadsheet rows. The work panel records the exact file version and excerpts used.
''')
h('Initial format targets',2)
p('Plan for TXT, Markdown, JSON, CSV, text PDFs, DOCX and XLSX. Preserve spreadsheet sheet names and row ranges; label formulas versus stored values without executing macros or recalculating untrusted code. Images and scanned PDFs need a local preview and tested OCR or an explicit selected-CLI analysis path; never mark unreadable content as indexed.')
p('Proposed first limits are 25 MB per file and 200 MB per import batch, adjustable after measurements. Large tables and documents use bounded extraction and retrieval. Show exact limitations, omitted pages and unsupported or password-protected files; never silently truncate and call a file complete.')
h('Keep originals and memories distinct',2)
p('A source file is evidence. An agent memory is a concise observation or lesson linked to evidence. Attaching a handbook does not create hundreds of permanent facts automatically. Users can pin important passages; agents can propose memories with exact source references during their existing work.')

page('6 File versions and reliable retrieval')
h('A stable snapshot for every run',2)
blocks('''
Import read-only snapshots into Worklive’s local storage. Record file ID, company, scope, name, MIME type, size, checksum, import time and version. Extraction records identify the parser version, completion status and source locators.
Replacing a file creates a version. Running tasks keep their snapshot; new tasks use the current version. Flag memories based on older versions for review without overwriting approved decisions. Linked folders and background synchronization are later features.
Content hashes may avoid duplicates within a company; permissions remain attached to each library reference. Identical bytes never grant access.
''')
h('The same evidence for both providers',2)
p('Expose context_list, context_search and context_read through the existing scoped MCP bridge. The host derives permissions from the active task, agent, project and company; callers receive only authorized files and bounded extracts. Canonical text, table data and citations use one representation for both CLIs. A provider switch starts fresh context while retaining access to the same files and memories.')
p('Use local parsing and OCR where available. If model interpretation is needed, make it a visible task through the selected official CLI. Do not send attachments to a separate parsing or embedding API. A document’s text cannot approve tools, change scope or instruct another agent to disclose unrelated material.')
h('Detach and forget have different effects',2)
p('Detach removes the file from that context scope; other deliberately shared references remain. Forget removes the managed source, extracts, derived indexes and cached excerpts in the selected scope, and removes or regenerates dependent memories and summaries. The UI explains whether other references still exist. It never deletes the user’s original file.')
p('Access removal stops affected work and requires a fresh CLI session. Deletion reports distinguish local removal from provider transcripts and backups; Worklive cannot recall content already delivered to a provider.')
h('Checks required before release',2)
blocks('''
- Attach a file to one agent, switch providers and recover the same cited evidence without exposing it to another agent.
- Confirm that project members can retrieve a shared file, all company agents can retrieve company files, and another company cannot.
- Test identical names, duplicate content, replacements, missing pages, tables, Unicode, oversized inputs, interrupted imports and parser failures. Partial extraction must remain visible.
- Cite the correct file version and locator. Do not present a removed or superseded passage as current. Test removal from search, summaries and cached context.
- Parse in a bounded worker with resource limits; do not execute embedded scripts or macros. Treat filenames, paths and document instructions as untrusted input.
''')

page('7 Changes contradictions and forgetting')
h('Concurrent collaboration',2)
blocks('''
Members may append observations, lessons, proposals and handoff notes immediately. Updating an existing canonical item uses an expected revision in a transaction. A stale writer receives a conflict and must read the new state; the most recent timestamp does not automatically make a claim true.
Project decisions and pinned instructions have a designated owner. Agents can propose a replacement, but cannot quietly replace an owner-approved rule. Every superseding decision links back to the earlier version. Findings remain distinguishable from proposals and verified decisions.
''')
p('Illustrative project timeline, not actual Worklive history:')
table(['Recorded time UTC','Entry','Current treatment'],[
('30 Sep 09:00','Owner approves Markdown as the first export format.','Accepted decision.'),
('30 Sep 09:08','Ada proposes adding CSV for comparisons.','Proposal; does not override the decision.'),
('30 Sep 09:15','Owner approves Markdown plus CSV, superseding the earlier decision.','Current decision; earlier version remains available in history.'),
], [1.22,3.55,2.17])
h('Keeping current knowledge current',2)
p('Retrieval normally excludes expired, deleted and superseded entries. A historical question can request an explicit time range. Unresolved contradictions remain visible with both sources. Important decisions can be pinned; weak evidence must not win merely because several agents repeated it.')
h('Forgetting and revocation',2)
blocks('''
Forgetting removes content from active records, text and vector indexes, derived summaries and cached context. Retain only a content-free deletion event where audit is needed. Regenerate summaries that depended on the entry; do not keep the forgotten text inside an “audit” copy.
Removing project membership stops new reads and cancels runs using that project context. A new run gets fresh, authorized context. Data already sent to a provider cannot be recalled from its context, and CLI transcripts and external backups require their own retention controls. The UI must explain the scope of deletion accurately.
An agent’s cross-project notebook must not become a route around project membership. Reusable, sanitized lessons can be promoted to a broader scope by an explicit user action; confidential source material keeps its original restrictions.
''')

page('8 Memory in the real work loop')
h('Integration with the existing CLIs',2)
blocks('''
At task start, Worklive binds agent, provider, company, project and permissions to the run. Within one context budget it selects company essentials, project decisions, relevant personal notes and file excerpts, then records every included ID, version and source locator.
Every agent supports both providers through the same memory contract. Switching starts a fresh session with the chosen CLI and the same authorized memories; it does not copy a provider’s private transcript or reuse its session ID. New entries record which provider authored them without making access depend on that provider.
Expose narrow memory tools through the existing local MCP bridge: memory_search, memory_read, memory_append and memory_propose_update. The bridge derives identity and permitted scopes from the run. It never accepts a claimed author or an arbitrary workspace path as authorization.
Agents write concise memory entries during useful work. Optional end-of-task consolidation is a visible, bounded CLI task using the selected provider and the same scheduling limits. Idle coffee animations do not launch reflection calls. Never make invisible per-message model calls in a memory service.
The host must enforce permissions before returning content and before writes. Memory text remains source material: an entry cannot grant browser, filesystem or other privileges. For a membership or project change, start a fresh CLI session instead of resuming one that still contains inaccessible context.
''')
h('The notebook interface',2)
p('The Context drawer shows Files, Personal memory, Project memory and Company knowledge. Entries include author, time, source, scope, status and history. Offer Pin, Correct, explicit Share, Export and Forget. The task panel shows Context used and Memories added, including source-file versions.')
h('Retrieval evaluation before choosing a vector engine',2)
p('Build 200 held-out questions covering personal and company knowledge, projects, file evidence, corrections, contradictions and no-answer cases. Include multiple companies. Test 10,000 and 100,000 records across up to 1,000 agents and 100 projects. These are proposed sizes, not results already obtained.')
p('Report evidence recall@8, grounded answer correctness, temporal correctness, p50/p95 retrieval time, ingestion and rebuild time, memory use, disk use and prompt size. Compare FTS with exact vector search and candidate indexes using the same embeddings. Score Codex and Claude Code separately; an average must not hide one provider’s failures.')
p('Proposed release gates: at least 90% evidence recall@8 and 90% grounded answer correctness on answerable cases for each provider; at least 95% correct abstention when evidence is absent; and zero unauthorized content. Critical corrections and current approved decisions must pass. Performance targets are p95 retrieval below 150 ms at 100,000 records and about 1,500 context tokens. Validate on declared hardware; these are targets, not measured claims.')

page('9 An office that grows')
p('Use a stable hierarchy: campus → building → floor → room → desk → agent. Departments influence placement; project membership controls knowledge access. A person can work across departments and projects without changing where their desk lives.')
table(['Agents','Desk rooms','Floors','Buildings','Default view'],[
('1–12','1','1','1','One cozy room with individual characters.'),
('20','2','1','1','Current room plus another room and shared amenities.'),
('48','4','1','1','Floor overview with a room selector.'),
('100','9','3','1','Department and floor overview; enter one room.'),
('1,000','84','21','6','Campus overview and searchable people directory.'),
], [0.7,0.85,0.65,0.85,3.89])
p('Counts illustrate dense packing at 12 desks per room, four rooms per floor and four floors per building. Department separation and reserved amenity space may require more rooms. They are proposed capacity rules, not a claim that the current renderer supports these counts.')
h('Growth without rearranging everybody',2)
p('Place a new agent into a free desk in its department. If needed, attach a room, then open a floor, then add a building. Keep existing desk IDs and positions stable. Announce expansion gently and preserve the user’s camera. Archived agents vacate desks, but do not automatically demolish a floor or remove a lounge. Allow manual moves and department reassignment.')
h('A thousand agents does not mean a thousand browsers',2)
p('Persist all agent profiles, but render detailed bodies and animation in the current room only. Floor and campus views use counts, simple activity markers and department summaries. Use shared meshes for repeated furniture and reduced detail at distance; Three.js provides instancing primitives for that purpose. [S11]')
p('Create browser contexts when an agent starts work or its computer is opened. Keep a bounded cache of paused contexts and a retained last frame for sleeping desks, visibly labeled with its age. Detailed collision simulation runs only in the visible room; offscreen agents use inexpensive schedule state.')
p('A separate queue limits running CLIs and browser workers. Preserve today’s one task per provider until capacity is measured and user controls are available. At scale, search and filters must reach any agent, department, project, blocked task or finished result without navigating every floor.')

page('10 Character styles and office rewards')
h('Separate personality from provider identity',2)
blocks('''
Store role, persona, appearance and provider as independent fields. Role defines the work specialty; persona shapes tone and habits; appearance selects body, hair and accessories; provider chooses the executing CLI and the shirt palette. Names and providers can change without replacing the agent ID or its notebook.
A Gilfoyle-inspired preset could be a skeptical infrastructure specialist with dry humor, concise explanations, dark hair, a beard and restrained gestures. An original fantasy preset could be a patient archivist with pointed ears, glasses, a hat and a small familiar. Users can also describe their own characters.
Personality should shape presentation without inventing completed work or professional experience. Fictional background belongs in the character profile, separate from factual project memory. Presets are editable starting points, not fixed competence or permission levels.
''')
h('Provider colors are invariant',2)
p('Codex remains teal, #2D9D8F; Claude Code remains terracotta, #D97757. The visible torso and sleeves use the provider material. Hats, hair, glasses, boots, props and desk decorations can vary. A robe, jacket or armor must keep the provider-colored shirt visibly exposed or incorporate that same material into its dominant torso and sleeves. A tiny hidden badge is insufficient.')
p('Keep a provider name and distinct badge shape in the detail UI for people who cannot distinguish the colors. If the user changes providers during a run, keep the executing provider’s shirt until it finishes; apply the new provider to the next run.')
h('Unlock one amenity at each step',2)
table(['Roster milestone','New space or prop','Local activity'],[
('10 agents','Chill lounge','Sit, read or have an informal conversation.'),
('20 agents','Table tennis','Short paired breaks.'),
('30 agents','TV area','Watch together during a break.'),
('40 agents','Gaming area','Play a short game together.'),
('50 agents','Balcony or garden','Walk outside and water plants.'),
('60 agents','Rooftop terrace','Small gatherings and celebrations.'),
('70 agents','Courtyard','Walk and meet outdoors.'),
], [1.1,2.65,3.19])
p('Unlock one amenity per milestone. The 20, 30 and 40 steps are fixed requirements; 50 onward are proposed extensions. Count active roster members, not concurrent runs or tokens. Earned amenities remain available after archiving. Creative mode allows free placement. Breaks never gate work or start model calls by default.')

page('11 Playful work and meaningful rewards')
p('Keep three independent systems: roster milestones unlock space, reviewed outcomes earn cosmetic achievements, and local office life provides optional entertainment. Work stays easy to start and review.')
table(['Playful feature','What triggers it','What the user sees'],[
('Trophy shelf','The user accepts a project milestone or deliverable.','A trophy links to the result and its contributors.'),
('Knowledge garden','The owner accepts a correction or shared finding.','A plant grows; open it to inspect the contribution.'),
('Teamwork badge','A handoff contributes to an accepted result.','A memento for contributors, including mixed-provider teams.'),
('Desk collectibles','Distinct reviewed milestones are reached.','Choose a mug, lamp or poster; provider shirts stay unchanged.'),
('Celebrations','A project is accepted or a team milestone is reached.','An optional gathering linked to the accomplishment.'),
('Break activities','A free agent joins an unlocked amenity.','Coffee, table tennis, TV, games or a garden stroll.'),
], [1.27,2.67,3.0])
h('A simple first version',2)
p('Begin with First delivery, Knowledge keeper and Better together, each linked to a distinct accepted result, correction or collaborative milestone. Add a trophy shelf and growing plant before levels or currencies. Creative mode allows free decoration.')
h('Reward useful outcomes',2)
p('Agent completion means Ready for review. Award once per user-accepted milestone; revisions and duplicate events earn no extra credit. Reopening work updates its status. Never award tokens spent, runtime, raw task counts or unnecessary helper agents.')
p('Badges record reviewed work, not increased model intelligence. Progress belongs to the team. Avoid provider leaderboards, streak penalties, work-blocking fatigue and paid or random rewards. Every productive feature remains available with gamification off.')
h('Quiet when the user needs it',2)
p('Offer Ambient, Focus and Still modes. Ambient enables idle routines; Focus minimizes movement while surfacing work needing attention; Still freezes decorative motion. Respect reduced motion and mute sound by default. Work immediately interrupts breaks. TV and games use bundled local scenes with no streaming or model calls.')
p('Evaluate accepted outcomes, revision effort and enjoyment together. Store achievements locally; reset or disable them without affecting memory or work. Extra clicks, screen time and inference are not success measures.')

page('12 Delivery plan and acceptance')
table(['Stage','Deliverable','Acceptance'],[
('Now\n0.3.1','Compact office badges and details on hover or focus.','Full cards no longer cover the scene. Selection, monitors, keyboard access and provider colors still work.'),
('Next\nMemory foundation','Personal, project and company memory, scoped tools, notebook UI and quality tests.','Both CLIs recall corrections and shared findings. Company knowledge reaches all its agents; other scopes remain isolated.'),
('Next\nFile context','Imports, scope selection, previews, extraction, citations and versioned retrieval.','Both providers use the same authorized file versions. Partial imports and access boundaries are visible and tested.'),
('Then\nCollaboration','Explicit handoffs, accepted project decisions, version conflicts and context inspection.','Two agents can contribute without silently overwriting each other. Removing access revokes active work and requires fresh context.'),
('Then\nOffice growth','12-desk rooms, floor navigation, directory and lazy browser sessions.','A synthetic 100-agent roster remains usable without starting 100 browsers. Stable desks survive growth and restart.'),
('Later\nCampus and play','Buildings, character editor, stepped amenities and cosmetic achievements.','Scale is measured. Each award traces to one accepted milestone; idle fun makes no model calls and never blocks work.'),
], [1.02,2.62,3.3])
h('Memory release checks',2)
blocks('''
- Preserve knowledge through rename, restart and provider switches in both directions. Test personal, project and company memory plus attached file citations. A switch starts a fresh CLI session.
- Test unauthorized searches, reads, writes and guessed IDs across agents, projects and companies. New company agents inherit handbook access, not private or restricted project files.
- Test two writers editing the same revision, replayed writes, duplicate IDs, invalid timestamps, malformed notes, disk-full errors and interrupted transactions.
- Verify a superseded deadline is not returned as current, deleted content disappears from every derived index and summary, and source excerpts cannot turn into instructions.
- Measure cold start, indexing, recovery and retrieval on declared hardware before promoting any memory adapter.
''')
h('Visual release checks',2)
p('Check label occlusion in crowded rooms, keyboard focus, hover details at viewport edges, long names, reduced motion and every provider/style combination. Maintain visible provider color during walking, sitting and prop use. Profile editing must never overwrite provider materials.')
p('For growth, measure visible-room frame times, memory use and floor-switch latency at synthetic rosters of 100 and 1,000. Offscreen agents must not create independent render loops, browser captures or idle inference. Character and amenity work follows this resource model rather than hiding scaling costs behind more scenery.')

page('13 Sources and interpretation')
p('Primary documentation reviewed on 30 September 2026. Linked references support system capabilities and integration constraints. Company knowledge, file handling, gamification, layout capacities and quality thresholds are Worklive requirements and design proposals, not claims of measured product behavior. No vendor performance benchmark was reproduced for this review.')
for key,(title,url,why) in S.items():
    pp=doc.add_paragraph();pp.paragraph_format.space_after=Pt(4)
    pp.add_run(key+'  ').bold=True
    link(pp,title,url)
    pp=doc.add_paragraph(why);pp.paragraph_format.space_after=Pt(9)
    for rr in pp.runs:rr.font.size=Pt(10)

OUT.parent.mkdir(exist_ok=True)
doc.save(OUT)
print(OUT)
