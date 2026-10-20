import { openDialog, closeDialog, toast } from "./motion/motion";
import "./style.css";
import "./motion/motion.css";
import { invoke, Channel } from "@tauri-apps/api/core";
import { createIcons, icons } from "lucide";
import { createProjects } from "./projects";
import { createWorkflow } from "./workflow";
import { createContext } from "./context";
import { createDocuments } from "./documents";
import { createInbox } from "./inbox";
import { createOffice } from "./office";
import { createDeckOffice } from "./office/deck7/office";
import { openRobotDialog } from "./office/deck7/creator";
import "./office/deck7/theme.css";
import { isDeck, verifyWorkspace, switchWorkspace } from "./workspace";

// Workspace look: Deck 7 is a separate crew with its own data folder and its own skin (body.ws-deck7).
document.body.classList.toggle("ws-deck7", isDeck);
import { openHireDialog } from "./office/hire.js";
import * as Comic from "./office/styles/comic/index.js";

const MAX_AGENTS = 24; // desk slots in the office; the browser worker pools 4 live browsers across them
import { PROVIDERS, isRunning, type ChatMessage, type Agent, type BrowserEvent, type BrowserState, type Provider, type ProviderStatus, type RunState, type WorkflowState } from "./types";

document.querySelector("#app")!.innerHTML = `
<header class="app-header">
  <div class="brand"><span class="brand-mark" aria-hidden="true">w</span><span class="brand-name">Worklive</span></div>
  <nav class="header-nav" aria-label="Workspace">
    <button class="quiet" id="open-inbox"><i data-lucide="inbox"></i>Inbox<span id="inbox-count" class="nav-badge" hidden></span></button>
    <button class="quiet" id="projects-open"><i data-lucide="square-kanban"></i>Projects</button>
    <button class="quiet" id="project-handoffs"><i data-lucide="arrow-left-right"></i>Handoffs</button>
    <button class="quiet" id="company-context"><i data-lucide="book-open"></i>Company knowledge</button>
    <button class="quiet" id="find-files" title="Find a file (⌘P)"><i data-lucide="file-search"></i>Files<kbd>⌘P</kbd></button>
  </nav>
  <div class="header-actions"><button class="quiet workspace-switch" id="workspace-switch" title="Switch workspace. Each has its own agents, projects, knowledge and files; the app restarts."><i data-lucide="${isDeck ? "building-2" : "rocket"}"></i>${isDeck ? "Worklive studio" : "Ops Deck 7"}</button><span class="connection" id="connection">Starting browser service…</span><button class="primary" id="add-agent"><i data-lucide="plus"></i>New agent</button></div>
</header>
<main id="office-view" class="office-layout"><section class="office-workspace">
  <div class="office-stage">
    <div id="office-scene"></div>
    <div class="stage-title scene-heading"><h1>The studio</h1><p id="team-summary">One desk. Room to grow.</p><span id="studio-achievement" hidden></span></div>
    <div class="stage-toolbar scene-controls" role="toolbar" aria-label="Office view">
      <button id="rotate-left" class="icon-button" aria-label="Rotate office left" title="Rotate left"><i data-lucide="rotate-ccw"></i></button>
      <button id="rotate-right" class="icon-button" aria-label="Rotate office right" title="Rotate right"><i data-lucide="rotate-cw"></i></button>
      <span class="toolbar-sep" aria-hidden="true"></span>
      <button id="zoom-out" class="icon-button" aria-label="Zoom out" title="Zoom out"><i data-lucide="minus"></i></button>
      <button id="zoom-in" class="icon-button" aria-label="Zoom in" title="Zoom in"><i data-lucide="plus"></i></button>
      <span class="toolbar-sep" aria-hidden="true"></span>
      <button id="motion" class="quiet">Pause movement</button>
      <button id="coffee-break" class="quiet" title="Invite free agents to the community table"><i data-lucide="coffee"></i>Coffee break</button>

    </div>
    <div class="stage-hint scene-caption" id="stage-hint"><i data-lucide="scan"></i><span id="stage-hint-text">Click someone to meet them</span></div>
    <div class="view-switch" role="group" aria-label="Camera">
      <button data-view="office" aria-pressed="true" title="Whole office"><i data-lucide="building-2"></i>Office</button>
      <button data-view="team" aria-pressed="false" title="Everyone lined up"><i data-lucide="users"></i>Team</button>
      <button data-view="follow" aria-pressed="false" title="Follow the selected agent"><i data-lucide="locate-fixed"></i>Follow</button>
      <button data-view="eyes" aria-pressed="false" title="See through the selected agent's eyes"><i data-lucide="eye"></i>Eyes</button>
    </div>
    <section class="agent-card" id="agent-card" aria-label="Agent" hidden>
      <button class="icon-button card-close" id="card-close" aria-label="Close"><i data-lucide="x"></i></button>
      <div class="card-who"><span class="card-avatar" id="card-avatar"></span><div><h2 id="card-name"></h2><p id="card-role"></p></div></div>
      <p class="card-status"><span class="card-dot" id="card-dot"></span><span id="card-status"></span></p>
      <p class="card-about" id="card-about"></p>
      <div class="card-traits" id="card-traits"></div>
      <div class="card-actions"><button class="primary" id="card-chat"><i data-lucide="message-circle"></i>Chat</button><button class="secondary" id="card-follow"><i data-lucide="locate-fixed"></i>Follow</button><button class="secondary" id="card-eyes"><i data-lucide="eye"></i>Eyes</button><button class="secondary icon-button" id="card-browser" aria-label="Open browser" title="Open browser"><i data-lucide="monitor-up"></i></button></div>
    </section>
    <section class="chat-panel" id="chat-panel" aria-label="Chat" hidden>
      <header class="chat-head"><span class="card-avatar small" id="chat-avatar"></span><div><h2 id="chat-name"></h2><p id="chat-via"></p></div><button class="quiet" id="chat-clear" title="Clear this conversation">Clear</button><button class="icon-button" id="chat-close" aria-label="Close chat"><i data-lucide="x"></i></button></header>
      <div class="chat-log" id="chat-log" aria-live="polite"></div>
      <form class="chat-form" id="chat-form"><textarea id="chat-input" rows="1" maxlength="2000" placeholder="Say hi…" aria-label="Message"></textarea><button class="primary icon-button" id="chat-send" aria-label="Send"><i data-lucide="arrow-up"></i></button></form>
      <p class="chat-note">Answers come from the agent’s own subscription tool. Chat has no tools: it can’t browse or work — use Start task for that.</p>
    </section>
  </div>
  <div class="office-strip">
    <section class="office-life-panel" aria-label="Office life"><div class="panel-heading"><h2>Office life</h2><span class="playful-badge">Just for fun</span></div><p id="office-moment" role="status">Coffee, small talk, and a little room to breathe.</p></section>
    <section class="activity-panel"><div class="panel-heading"><h2>Around the office</h2><span class="live-badge">Live</span></div><div id="activity" aria-live="polite"><div class="activity-item">Your studio is opening.</div></div></section>
  </div>
</section>
<aside class="inspector">
  <div class="profile"><span id="agent-avatar" class="avatar"><i data-lucide="bot"></i></span><div class="profile-text"><h2 id="agent-name">Ada</h2><span id="agent-status">Opening browser</span></div></div>
  <button id="open-screen" class="secondary wide"><i data-lucide="monitor-up"></i>Open browser</button>
  <section class="inspector-section task-actions" aria-label="Task"><label>Task brief<textarea id="edit-task" maxlength="1000" rows="4" placeholder="What should this agent work on?"></textarea></label><button id="start-task" class="primary wide">Start task</button><div class="button-pair"><button id="agent-context" class="secondary">Context & files</button><button id="work-results" class="secondary">Work & results</button></div><p id="run-summary" role="status"></p></section>
  <section class="inspector-section provider-block" aria-label="Provider"><label>Powered by<select id="edit-provider"><option value="codex">Codex · teal shirt</option><option value="claude">Claude Code · terracotta shirt</option></select></label><p id="provider-detail" class="fine-print">Checking subscriptions…</p><div class="button-row"><button id="check-providers" class="quiet">Check connection</button><button id="provider-login" class="quiet">Open official tool</button></div></section>
  <details class="inspector-section profile-details"><summary>Agent profile</summary><div class="inspector-fields"><label>Name<input id="edit-name" maxlength="40"></label><label>Role<select id="edit-role"><option>Researcher</option><option>Designer</option><option>Developer</option><option>Coordinator</option><option>Writer</option><option>Generalist</option></select></label><label>Personality<textarea id="edit-personality" maxlength="500" rows="3"></textarea></label></div></details>
  <details class="inspector-section practice-block"><summary>Browser practice</summary><p>A local, scripted demonstration. No subscription usage.</p><button id="run-demo" class="secondary wide"><i data-lucide="play"></i><span>Run browser practice</span></button><button id="view-notes" class="quiet wide"><i data-lucide="file-text"></i>View saved notes</button></details>
  <div class="inspector-note">Public research and writing, saved locally.<br>Runs through your official subscription tools.</div>
</aside></main>
<main id="browser-view" class="browser-layout" hidden><div class="browser-heading"><div class="browser-heading-left"><button id="back-office" class="secondary"><i data-lucide="arrow-left"></i>Office</button><div><h1 id="computer-title">Ada’s computer</h1><p id="computer-subtitle">Watching the same session as the desk monitor.</p></div></div><div class="browser-heading-right"><button id="stop-demo" class="secondary"><i data-lucide="square"></i>Stop task</button><button id="take-control" class="primary"><i data-lucide="mouse-pointer-2"></i><span>Take control</span></button></div></div><div class="browser-columns"><section class="computer"><div class="browser-toolbar"><button id="browser-back" class="icon-button" aria-label="Browser back"><i data-lucide="arrow-left"></i></button><button id="browser-forward" class="icon-button" aria-label="Browser forward"><i data-lucide="arrow-right"></i></button><button id="browser-reload" class="icon-button" aria-label="Reload page"><i data-lucide="rotate-cw"></i></button><form id="address-form"><i data-lucide="globe"></i><input id="address" aria-label="Browser address" placeholder="https://example.com" autocomplete="off" spellcheck="false"><button type="submit" class="address-go" aria-label="Open address">↵</button></form><button id="browser-home" class="icon-button" aria-label="Open practice page"><i data-lucide="house"></i></button></div><div id="browser-surface" class="browser-surface" tabindex="0" role="application" aria-label="Live browser. Take control to click, type, paste, and scroll."><img id="browser-frame" alt="Live agent browser" draggable="false"><span id="browser-cursor" class="browser-cursor" hidden></span><div id="browser-placeholder">Opening the browser session…</div></div><div class="computer-footer"><span id="control-hint">Watching · Take control to interact</span><span id="frame-status">Waiting for first frame</span></div></section><aside class="browser-activity"><div class="ownership"><span class="status-dot"></span><span id="owner-status">Agent in control</span></div><span class="eyebrow">Current task</span><p id="focused-task"></p><p id="task-message" aria-live="polite"></p><button id="focus-start" class="primary wide">Start task</button><button id="focus-context" class="secondary wide">Context & files</button><button id="focus-work" class="secondary wide">Work & results</button><p class="fine-print">The agent reads public pages in this browser and saves Markdown, text, or CSV results.</p><details class="practice-block"><summary>Browser practice</summary><button id="focus-run" class="quiet wide">Run browser practice</button><button id="focus-notes" class="quiet wide">View practice notes</button></details></aside></div><nav id="computer-switcher" aria-label="Agent computers"></nav></main>
<footer class="app-footer"><span id="footer-context">Office / Creative studio</span><span>Tauri + Rust · A living office · 0.9.0</span></footer>
<dialog id="notes-dialog"><div class="dialog-heading"><h2 id="notes-title">Saved research notes</h2><button id="close-notes" class="icon-button" aria-label="Close saved notes"><i data-lucide="x"></i></button></div><pre id="notes-text"></pre><p id="notes-path" class="fine-print"></p></dialog>
<dialog id="work-dialog"><div class="dialog-heading"><div><span class="eyebrow" id="work-provider"></span><h2 id="work-title">Work & results</h2></div><button id="close-work" class="icon-button" aria-label="Close work and results"><i data-lucide="x"></i></button></div><label>Task history<select id="run-history"></select></label><div class="work-status"><strong id="work-status"></strong><p id="work-message" role="status"></p><p id="handoff-origin" class="fine-print" hidden></p><div class="button-row"><button id="pause-task" class="secondary">Pause</button><button id="stop-task" class="secondary">Stop</button><button id="resume-task" class="primary">Resume</button></div></div><section id="question-box" class="question-box" hidden><span class="eyebrow">QUESTION FOR YOU</span><p id="question-text"></p><div id="question-options" class="question-options"></div><label>Your answer<textarea id="question-answer" maxlength="2000" rows="2" placeholder="Answer in your own words…"></textarea></label><div class="button-row"><button id="question-send" class="primary">Send answer and continue</button></div></section><section class="review-bar"><div><strong id="review-state">Your review</strong><p id="review-help" class="fine-print"></p></div><div class="button-row"><button id="accept-work" class="primary">Mark accepted</button><button id="reopen-work" class="secondary">Reopen review</button><button id="handoff-work" class="secondary">Hand off to teammate</button></div></section><div class="work-grid"><section><h3>Saved results</h3><div id="artifacts"></div><h3>Sources observed</h3><div id="sources"></div><h3>Context received</h3><div id="context-used"></div><h3>Memories added</h3><div id="memories-added"></div></section><section><h3>Activity</h3><ol id="run-events"></ol></section></div><details id="reply-details"><summary>Agent’s response</summary><pre id="run-text"></pre></details><div class="revision"><label>Continue or revise<textarea id="followup" maxlength="4000" rows="2" placeholder="e.g. Make the recommendation shorter and add a comparison table."></textarea></label><button id="revise-task" class="primary">Send revision</button><p class="fine-print" id="revision-provider"></p></div></dialog>`;
createIcons({ icons });
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
let agents: Agent[] = [],
  selected = "",
  focused: string | null = null,
  ready = false,
  pendingControl = false,
  saveTimer: ReturnType<typeof setTimeout> | undefined;
const runs = new Map<string, RunState>(), providers = new Map<Provider, ProviderStatus>();
let checkingProviders = false, workAgent = "", historyRuns: RunState[] = [], viewedRun = "";
const browserStates = new Map<string, BrowserState>(),
  frames = new Map<
    string,
    {
      url: string;
      seq: number;
      at: number;
      cursor?: { x: number; y: number } | null;
    }
  >(),
  activity: { name: string; message: string }[] = [];
const context = createContext({agents:()=>agents,current:()=>focused||selected,error:showError});
$("#company-context").onclick=()=>run(()=>context.open(selected,"company"));
$("#agent-context").onclick=()=>run(()=>context.open(selected));
$("#focus-context").onclick=()=>run(()=>context.open(focused||selected));
// The studio shows the comic office; the Deck 7 workspace shows its robot deck (same interface).
const office: ReturnType<typeof createOffice> = (isDeck ? createDeckOffice : createOffice)(
  $("#office-scene"),
  (id) => { selectAgent(id); openCard(id); },
  openComputer,
  (moment) => {
    $("#office-moment").textContent = moment.speaker
      ? `${moment.speaker}: “${moment.text}”`
      : moment.text;
  },
  showView,
);
let workflowState: WorkflowState | null = null;
const documents = createDocuments({ agents: () => agents, command: (action, agentId, extra) => command(action, agentId ?? (focused || selected), extra),
  workflow: () => workflowState, accepted: id => workflow.accepted(id), busy: () => [...runs.values()].some(isRunning),
  changed: () => { void workflow.reload().catch(showError); context.refresh(); }, error: showError });
$("#find-files").onclick = () => documents.find();
const inbox = createInbox({ agents: () => agents, runs: () => [...runs.values()], accepted: id => workflow.accepted(id), openWork });
$("#open-inbox").onclick = () => inbox.open();
function paintInbox() {
  const { total, blocking } = inbox.counts(), badge = $("#inbox-count");
  badge.hidden = !total; badge.textContent = String(total); badge.classList.toggle("blocking", blocking > 0);
  $("#open-inbox").setAttribute("aria-label", total ? `Inbox, ${total} waiting${blocking ? `, ${blocking} blocking` : ""}` : "Inbox");
  inbox.refresh();
}
$("#connection").addEventListener("click", () => { if (offline) run(reconnect); });
const workflow=createWorkflow({agents:()=>agents,runs:()=>[...runs.values()],command:(action,extra)=>command(action,focused||selected,extra),error:showError,changed:state=>{workflowState=state;projects.apply(state);if(agents.length)refresh();},openWork,openProject:id=>projects.open(id),award:earned=>office.achievement(earned)});
const projects=createProjects({agents:()=>agents,runs:()=>[...runs.values()],command:(action,extra)=>command(action,focused||selected,extra),reload:()=>workflow.reload(),apply:state=>workflow.apply(state),error:showError,openWork,handoff:async(id,runId)=>{const history:RunState[]=await command("runHistory",id);const source=history.find(r=>r.id===runId);if(!source)throw new Error("Saved source run not found.");await workflow.compose(source);},openContext:id=>context.open(id,"project")});
$("#projects-open").onclick=()=>run(()=>projects.open());
$("#project-handoffs").onclick=()=>run(()=>workflow.open());
$("#motion").textContent = office.isMoving()
  ? "Pause movement"
  : "Resume movement";
$("#coffee-break").onclick = () => {
  if (!office.isMoving()) {
    $("#office-moment").textContent =
      "Resume movement to enjoy a coffee break.";
    return;
  }
  if (!office.coffeeBreak())
    $("#office-moment").textContent =
      "Everyone is busy. Coffee can wait until they are free.";
};
function showError(error: unknown) {
  const text = String(error instanceof Error ? error.message : error).replace(/^Error:\s*/, "");
  toast(text, "", "error");
}
let offline = false;
/** Restart the worker after it stopped, then reload runs and browsers (same steps as startup). */
async function reconnect() {
  if (!offline) return;
  $("#connection").textContent = "Reconnecting…";
  const channel = new Channel<BrowserEvent>();
  channel.onmessage = receive;
  await invoke("start_browser", { onEvent: channel });
  ready = true; offline = false;
  const hello = await command("hello");
  for (const r of hello.runs || []) runs.set(r.agentId, r);
  $("#connection").textContent = "Browser service connected";
  $("#connection").classList.remove("offline");
  $("#connection").classList.add("connected");
  for (const a of agents) await command("ensure", a.id, { lazy: true }).catch(() => {});
  syncOffice(); refresh(); void workflow.reload().catch(showError);
}
async function command(
  action: string,
  agentId = focused || selected,
  extra: Record<string, unknown> = {},
): Promise<any> {
  if (!ready) throw new Error(offline ? "The Worklive worker stopped. Click “Reconnect” at the top right." : "The browser service is still starting.");
  return invoke("browser_command", { command: { action, agentId, ...extra } });
}
function run(action: () => Promise<unknown>) {
  void action().catch(showError);
}
function current() {
  return agents.find((a) => a.id === (focused || selected))!;
}
function record(id: string, message: string) {
  const name = agents.find((a) => a.id === id)?.name || "Worklive";
  activity.unshift({ name, message });
  activity.splice(4);
  const panel = $("#activity");
  panel.replaceChildren();
  for (const item of activity) {
    const row = document.createElement("div");
    row.className = "activity-item";
    const dot = document.createElement("span");
    dot.className = "activity-dot";
    const text = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = item.name;
    text.append(strong, document.createTextNode(" · " + item.message));
    row.append(dot, text);
    panel.append(row);
  }
}
function statusText(s?: BrowserState) {
  if (!s) return "Opening browser";
  if (s.owner === "user") return "You have control";
  return {
    idle: "Available",
    working: "Working",
    paused: "Paused",
    complete: "Task complete",
    error: "Needs attention",
    loading: "Opening page",
  }[s.status];
}
function persist(now = false) {
  clearTimeout(saveTimer);
  const save = () => { saveTimer = undefined; void invoke("save_agents", { agents: agents.map(({ fresh, ...a }) => a) }).catch(showError); };
  if (now) save(); else saveTimer = setTimeout(save, 350);
}
// Quitting right after an edit must not lose it.
addEventListener("beforeunload", () => { if (saveTimer !== undefined) persist(true); });
function refresh() {
  paintInbox();
  const a = agents.find((a) => a.id === selected);
  if (!a) return;
  const state = browserStates.get(a.id);
  $("#agent-name").textContent = a.name;
  $("#agent-status").textContent = runs.has(a.id) ? runLabel(runs.get(a.id)!) : statusText(state);
  $("#agent-avatar").style.background = PROVIDERS[displayProvider(a)].color + "33";
  $<HTMLSelectElement>("#edit-provider").value = a.provider;
  const provider = providers.get(a.provider);
  $("#provider-detail").textContent = (checkingProviders ? "Checking connection…" : provider?.detail || "Connection not checked yet.") + (isRunning(runs.get(a.id)) ? " Provider changes apply to the next run." : "");
  $<HTMLButtonElement>("#check-providers").disabled = checkingProviders || !ready;
  $("#provider-login").hidden = provider?.status === "ready";
  $<HTMLButtonElement>("#provider-login").disabled = [...runs.values()].some(r => isRunning(r) && r.provider === a.provider);
  const busyProvider = [...runs.values()].find(r => isRunning(r) && r.provider === a.provider && r.agentId !== a.id);
  if (busyProvider) $("#provider-detail").textContent += " Another agent is using this provider. Wait for it to finish, or choose the other provider.";
  $<HTMLButtonElement>("#start-task").disabled = !canStart(a);
  $("#run-summary").textContent = runs.get(a.id)&&workflow.accepted(runs.get(a.id)!.id)?"Accepted. This result is available for project handoffs.":runs.get(a.id)?.message || "Give this agent a research or writing task below.";
  for (const field of ["name", "role", "personality", "task"] as const) {
    const input = $<HTMLInputElement | HTMLTextAreaElement>("#edit-" + field);
    // Hired agents can have any role: add it to the role list so it shows instead of a blank choice.
    if (field === "role" && a.role && !Array.from((input as unknown as HTMLSelectElement).options).some(o => o.value === a.role)) (input as unknown as HTMLSelectElement).add(new Option(a.role, a.role));
    if (document.activeElement !== input) input.value = a[field];
  }
  syncOffice();
  office.select(a.id);
  const working = agents.filter(a => isRunning(runs.get(a.id)) || browserStates.get(a.id)?.status === "working").length;
  const needYou = agents.filter(a => { const r = runs.get(a.id); return !!r && !!NEEDS_YOU[r.status] && browserStates.get(a.id)?.owner !== "user"; }).length;
  $("#team-summary").textContent =
    `${agents.length} ${isDeck ? (agents.length === 1 ? "robot" : "robots") : agents.length === 1 ? "agent" : "agents"} · ${working} working` +
    (needYou ? ` · ${needYou} ${needYou === 1 ? "needs" : "need"} you` : " · room to grow");
  $<HTMLButtonElement>("#add-agent").disabled = agents.length >= MAX_AGENTS;
  $<HTMLButtonElement>("#run-demo").disabled =
    !state || isRunning(runs.get(a.id)) ||
    state.owner === "user" ||
    state.status === "working" ||
    state.status === "loading";
  $("#run-demo span").textContent =
    state?.status === "working"
      ? "Practice task running"
      : "Run browser practice";
  $<HTMLButtonElement>("#view-notes").disabled = !state?.hasRun;
  refreshFocus();
  refreshWork();
  if (cardAgent) paintCard();
  if (chatAgent) { const c = agents.find(x => x.id === chatAgent); if (c) $("#chat-name").textContent = c.name; else paintChat(); }
}
function selectAgent(id: string) {
  selected = id;
  office.select(id);
  refresh();
}
async function openComputer(id: string) {
  selected = id;
  focused = id;
  $("#office-view").hidden = true;
  $("#browser-view").hidden = false;
  $("#footer-context").textContent = "Computer / Live browser";
  refresh();
  paintFocusedFrame();
  buildSwitcher();
  try {
    await command("ensure", id);
    await command("focus", id);
  } catch (e) {
    showError(e);
  }
  refreshFocus();
}
function closeComputer() {
  focused = null;
  $("#browser-view").hidden = true;
  $("#office-view").hidden = false;
  $("#footer-context").textContent = "Office / Creative studio";
  run(() => command("focus", ""));
  refresh();
}
function buildSwitcher() {
  const row = $("#computer-switcher");
  row.replaceChildren();
  for (const a of agents) {
    const b = document.createElement("button");
    b.className = "secondary";
    b.textContent = a.name;
    b.setAttribute("aria-pressed", String(a.id === focused));
    b.onclick = () => void openComputer(a.id);
    row.append(b);
  }
}
function refreshFocus() {
  if (!focused) return;
  const a = current(),
    s = browserStates.get(focused);
  $("#computer-title").textContent = a.name + "’s computer";
  $("#computer-subtitle").textContent =
    s?.owner === "user"
      ? "You have control · agent input paused"
      : "Watching the same session as the desk monitor";
  $("#focused-task").textContent = (isRunning(runs.get(a.id)) ? runs.get(a.id)?.task : a.task) || "No task brief assigned.";
  $<HTMLButtonElement>("#focus-start").disabled = !canStart(a);
  const user = s?.owner === "user";
  $("#owner-status").textContent = user
    ? "You have control"
    : "Agent in control";
  $("#take-control span").textContent = pendingControl
    ? "Switching control…"
    : user
      ? "Return control"
      : "Take control";
  $<HTMLButtonElement>("#take-control").disabled = !s || pendingControl;
  $("#take-control").classList.toggle("user-control", user);
  $("#browser-surface").classList.toggle("is-controlled", user);
  $("#control-hint").textContent = user
    ? "Your mouse and keyboard control this browser"
    : "Watching · Take control to interact";
  const address = $<HTMLInputElement>("#address");
  if (document.activeElement !== address) address.value = s?.url || "";
  address.disabled = !user;
  for (const id of [
    "browser-back",
    "browser-forward",
    "browser-reload",
    "browser-home",
  ])
    $<HTMLButtonElement>("#" + id).disabled = !user;
  $("#task-message").textContent = runs.get(a.id)?.message || s?.message || "Opening browser…";
  $("#stop-demo").hidden = !isRunning(runs.get(a.id)) && s?.status !== "working" && s?.status !== "paused";
  $<HTMLButtonElement>("#focus-run").disabled =
    !s || isRunning(runs.get(a.id)) || user || s.status === "working" || s.status === "loading";
  $<HTMLButtonElement>("#focus-notes").disabled = !s?.hasRun;
  document.querySelectorAll<HTMLElement>("[data-step]").forEach((el) => {
    const step = Number(el.dataset.step);
    el.classList.toggle("done", !!s && s.step >= step);
    el.classList.toggle(
      "active",
      !!s && s.status === "working" && s.step === step - 1,
    );
  });
}
function paintFocusedFrame() {
  if (!focused) return;
  const frame = frames.get(focused);
  const img = $<HTMLImageElement>("#browser-frame");
  if (frame) {
    img.src = frame.url;
    img.hidden = false;
    $("#browser-placeholder").hidden = true;
    const cursor = $("#browser-cursor");
    cursor.hidden =
      !frame.cursor || browserStates.get(focused)?.owner === "user";
    if (frame.cursor) {
      cursor.style.left = (frame.cursor.x / 1024) * 100 + "%";
      cursor.style.top = (frame.cursor.y / 640) * 100 + "%";
    }
  } else {
    img.hidden = true;
    $("#browser-placeholder").hidden = false;
    $("#browser-cursor").hidden = true;
  }
}
function receive(e: BrowserEvent) {
  if(e.type==="workflow"&&e.workflow){workflow.apply(e.workflow);return;}
  if (e.type === "chat") { receiveChat(e); return; }
  if (e.type === "run" && e.run) {
    const old = runs.get(e.run.agentId);
    runs.set(e.run.agentId, e.run);
    if(old?.status!==e.run.status){context.refresh();run(()=>workflow.reload());}
    if (e.run.message !== old?.message) record(e.run.agentId, e.run.message);
    if (workAgent === e.run.agentId) {
      const index = historyRuns.findIndex(r => r.id === e.run!.id);
      if (index >= 0) historyRuns[index] = e.run;
      else { historyRuns.unshift(e.run); viewedRun = e.run.id; }
    }
    refresh();
  } else if (e.type === "runtimeWarning") showError(e.message);
  else if (e.type === "state" && e.state) {
    browserStates.set(e.state.agentId, e.state);
    syncOffice();
    refresh();
  } else if (e.type === "frame" && e.agentId && e.image) {
    const id = e.agentId,
      seq = e.seq || 0;
    if (seq <= (frames.get(id)?.seq || 0)) return;
    const frame = {
      url: "data:image/jpeg;base64," + e.image,
      seq,
      at: Date.now(),
      cursor: e.cursor,
    };
    frames.set(id, frame);
    const image = new Image();
    image.onload = () => {
      if (frames.get(id)?.seq === seq) office.frame(id, image);
    };
    image.src = frame.url;
    if (focused === id) paintFocusedFrame();
  } else if (e.type === "activity" && e.agentId && e.message)
    record(e.agentId, e.message);
  else if (e.type === "offline") {
    ready = false; offline = true;
    // Runs cannot continue without the worker: show them as interrupted (the worker marks them the same on restart).
    for (const [id, r] of runs) if (isRunning(r)) runs.set(id, { ...r, status: "interrupted", message: "The Worklive worker stopped. Reconnect, then resume this task." });
    $("#connection").textContent = "Worker stopped · Reconnect";
    $("#connection").classList.remove("connected");
    $("#connection").classList.add("offline");
    showError(e.message);
    syncOffice(); refresh();
  }
}
for (const field of ["name", "role", "personality", "task"] as const)
  $<HTMLInputElement>("#edit-" + field).addEventListener("input", (event) => {
    const a = agents.find((a) => a.id === selected)!;
    a[field] = (event.target as HTMLInputElement).value;
    syncOffice();
    persist();
    refresh();
  });
$("#open-screen").onclick = () => void openComputer(selected);
$("#back-office").onclick = closeComputer;
$("#workspace-switch").onclick = () => void switchWorkspace(isDeck ? "studio" : "deck7");
void verifyWorkspace();
if (isDeck) {
  // Deck 7 wording; everything else (buttons, flows, data) works exactly like the studio
  $("#add-agent").innerHTML = '<i data-lucide="plus"></i>Order a robot';
  $(".stage-title h1").textContent = "Ops Deck 7";
  $("#coffee-break").innerHTML = '<i data-lucide="droplet"></i>Oil break';
  $("#coffee-break").title = "Send the free robots to the oil dispenser";
  $(".office-life-panel h2").textContent = "Deck life";
  $("#office-moment").textContent = "Lukewarm oil, small talk, and a little room to rust.";
  $(".activity-panel h2").textContent = "Station log";
  $(".brand-name").textContent = "Ops Deck 7";
  $(".brand-mark").textContent = "7";
  document.querySelectorAll<HTMLOptionElement>("#edit-provider option").forEach(o => (o.textContent = o.textContent!.replace("shirt", "trim")));
  const opening = document.querySelector("#activity .activity-item");
  if (opening) opening.textContent = "Deck 7 is powering up. Please hold your applause.";
  // the footer says where you are; keep the studio's words out of the deck
  const footer = $("#footer-context");
  const deckWords = () => { if (footer.textContent!.includes("Creative studio")) footer.textContent = footer.textContent!.replace("Creative studio", "Ops Deck 7"); };
  new MutationObserver(deckWords).observe(footer, { childList: true, characterData: true, subtree: true });
  deckWords();
  $(".card-actions").insertAdjacentHTML("beforeend", '<button class="secondary" id="card-parts" title="Swap this robot\'s parts"><i data-lucide="wrench"></i>Parts</button>');
  // Dispatch: hand a robot a quick task or a topic to study. Both just set the task brief (visible in
  // the sidebar) and start it the normal way; nothing runs without this click (human in the loop).
  $(".card-actions").insertAdjacentHTML("afterend", `<div class="deck7-orders">
    <form id="quick-form" class="quick-form"><input id="quick-input" maxlength="600" placeholder="Quick task, e.g. find 3 reviews of the new Pixel phone" aria-label="Quick task"><button class="primary" type="submit">Go</button></form>
    <div class="quick-presets" id="quick-presets"></div>
    <form id="learn-form" class="quick-form"><input id="learn-input" maxlength="120" placeholder="Something to learn" aria-label="Topic to learn"><button class="secondary" type="submit"><i data-lucide="graduation-cap"></i>Learn</button></form>
    <div class="quick-presets" id="learn-topics"></div></div>`);
}
const QUICK_PRESETS: [string, string][] = [["Latest news", "Find the 5 most important news items this week about "], ["Compare", "Compare the 3 best options for "], ["Summarise a page", "Open this page and save a one-page summary: https://"], ["Fact-check", "Fact-check this claim with 3 reliable sources: "]];
function topicsFor(role: string) {
  const r = role.toLowerCase();
  if (/research|analy/.test(r)) return ["Spotting unreliable sources", "Search operators that save time", "Summarising long reports"];
  if (/writ|copy|edit/.test(r)) return ["Writing clear headlines", "Plain-language editing", "Tone of voice guides"];
  if (/design/.test(r)) return ["Accessible colour contrast", "Typography basics", "Design systems"];
  if (/engineer|develop|code/.test(r)) return ["Reading error logs", "Web performance basics", "Git good practice"];
  if (/market|sales/.test(r)) return ["Landing page copy", "SEO basics", "Email subject lines"];
  return ["Writing better summaries", "Fact-checking", "The boss's industry"];
}
function cannotStart(a: Agent) {
  const p = providers.get(a.provider), s = browserStates.get(a.id);
  if (p?.status !== "ready") return `Connect ${PROVIDERS[a.provider].name} first (check the connection in the sidebar).`;
  const busy = [...runs.values()].find(r => isRunning(r) && (r.agentId === a.id || r.provider === a.provider));
  if (busy) return busy.agentId === a.id ? `${a.name} is already working.` : `${agents.find(x => x.id === busy.agentId)?.name || "Another robot"} is using ${PROVIDERS[a.provider].name} right now. One run per provider at a time.`;
  if (!s) return "Its browser is still starting. Try again in a moment.";
  if (s.owner === "user") return "You have control of its browser. Return control first.";
  return "It can't start right now.";
}
async function dispatch(id: string, brief: string, what: string) {
  const a = agents.find(x => x.id === id);
  if (!a || !brief.trim()) return;
  a.task = brief.trim().slice(0, 4000);
  persist(true);
  refresh();
  try { await command("ensure", a.id); } catch { /* reported by canStart below */ }
  if (!canStart(a)) { toast(`${a.name} can't start yet`, cannotStart(a)); return; }
  await startTask(a.id);
  toast(`${a.name}: ${what}`, a.task.length > 90 ? a.task.slice(0, 88) + "…" : a.task);
}
const learnBrief = (topic: string) => `Learning session (self-study). Topic: ${topic}.
Study this topic with 3 to 5 reliable public sources in your browser. Then:
1. Save the most useful, sourced facts to your personal memory with memory_append (scope "agent"), one short note per idea, so you can use them in future tasks.
2. Save a short study note as study-notes.md: key ideas, important terms and open questions, with the source URLs.
Keep it concise. Only ask the user if something essential is missing.`;
if (isDeck) {
  document.getElementById("quick-presets")!.innerHTML = QUICK_PRESETS.map(([l], i) => `<button type="button" class="chip-btn" data-preset="${i}">${l}</button>`).join("");
  document.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach(b => (b.onclick = () => {
    const inp = $<HTMLInputElement>("#quick-input");
    inp.value = QUICK_PRESETS[+b.dataset.preset!][1];
    inp.focus();
    inp.setSelectionRange(inp.value.length, inp.value.length);
  }));
  $("#quick-form").onsubmit = e => { e.preventDefault(); const v = $<HTMLInputElement>("#quick-input").value; if (cardAgent && v.trim()) { $<HTMLInputElement>("#quick-input").value = ""; run(() => dispatch(cardAgent!, v, "on it")); } };
  $("#learn-form").onsubmit = e => { e.preventDefault(); const v = $<HTMLInputElement>("#learn-input").value.trim(); if (cardAgent && v) { $<HTMLInputElement>("#learn-input").value = ""; run(() => dispatch(cardAgent!, learnBrief(v), `studying "${v}"`)); } };
}
$("#rotate-left").onclick = () => office.rotate(-10);
$("#rotate-right").onclick = () => office.rotate(10);
$("#zoom-in").onclick = () => office.zoom(0.1);
$("#zoom-out").onclick = () => office.zoom(-0.1);

// ---------- Camera views ----------
const VIEW_HINTS: Record<string, string> = {
  office: "Click someone to meet them",
  team: "Click someone to meet them",
  follow: "Following · Esc for the office",
  eyes: "Drag to look around · Esc to step back",
};
function showView(view: string) {
  document.querySelectorAll<HTMLButtonElement>(".view-switch button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
  $("#stage-hint-text").textContent = VIEW_HINTS[view] || VIEW_HINTS.office;
}
document.querySelectorAll<HTMLButtonElement>(".view-switch button").forEach(b => {
  b.onclick = () => office.view(b.dataset.view as "office" | "team" | "follow" | "eyes", selected || undefined);
});

// ---------- Agent card: who someone is, plus quick actions ----------
let cardAgent = "";
const TRAITS: Record<string, string> = { coffee: "☕ Coffee lover", lounge: "🛋 Couch potato", nature: "🌿 Plant gazer", books: "📚 Bookworm", chatty: "💬 Chatty", focused: "🎯 Focused" };
const initialsOf = (name: string) => name.trim().split(/\s+/).map(w => Array.from(w)[0] || "").slice(0, 2).join("").toLocaleUpperCase() || "?";
function paintAvatar(el: HTMLElement, a: Agent) {
  el.textContent = initialsOf(a.name);
  el.style.setProperty("--provider", PROVIDERS[displayProvider(a)].color);
}
function agentStatus(a: Agent) {
  const r = runs.get(a.id);
  if (!r) return statusText(browserStates.get(a.id));
  const label = runLabel(r);
  return r.message && !r.message.toLowerCase().startsWith(label.toLowerCase()) ? `${label} · ${r.message}` : label;
}
function openCard(id: string) {
  cardAgent = id;
  paintCard();
  $("#agent-card").hidden = false;
  $("#stage-hint").hidden = true;
}
function closeCard() {
  cardAgent = "";
  $("#agent-card").hidden = true;
  $("#stage-hint").hidden = false;
}
function paintCard() {
  const a = agents.find(x => x.id === cardAgent);
  if (!a) { if (cardAgent) closeCard(); return; }
  paintAvatar($("#card-avatar"), a);
  const topics = document.getElementById("learn-topics");
  if (topics && topics.dataset.for !== a.id) {
    // study ideas that fit the robot's job; a click puts the topic in the Learn field
    topics.dataset.for = a.id;
    topics.innerHTML = topicsFor(a.role).map(t => `<button type="button" class="chip-btn">${t.replace(/[&<>"]/g, "")}</button>`).join("");
    topics.querySelectorAll<HTMLButtonElement>("button").forEach(b => (b.onclick = () => { $<HTMLInputElement>("#learn-input").value = b.textContent || ""; $<HTMLInputElement>("#learn-input").focus(); }));
  }
  $("#card-name").textContent = a.name;
  $("#card-role").textContent = `${a.role} · ${PROVIDERS[displayProvider(a)].name}`;
  $("#card-status").textContent = agentStatus(a);
  $("#card-dot").dataset.working = String(isRunning(runs.get(a.id)));
  { const r = runs.get(a.id); $("#card-dot").dataset.needs = String(!!r && !!NEEDS_YOU[r.status]); }
  $("#card-about").textContent = a.personality || "No description yet. Add one under Agent profile.";
  $("#card-traits").replaceChildren(...(a.traits || []).filter(t => TRAITS[t]).map(t => Object.assign(document.createElement("span"), { textContent: TRAITS[t] })));
}
$("#card-close").onclick = closeCard;
$("#card-chat").onclick = () => run(() => openChat(cardAgent));
$("#card-follow").onclick = () => office.view("follow", cardAgent);
$("#card-eyes").onclick = () => office.view("eyes", cardAgent);
$("#card-browser").onclick = () => void openComputer(cardAgent);

// ---------- Chat with an agent (through its own subscription CLI, no tools) ----------
let chatAgent = "";
const chats = new Map<string, { messages: ChatMessage[]; pending: boolean }>();
async function openChat(id: string) {
  const a = agents.find(x => x.id === id);
  if (!a) return;
  chatAgent = id;
  $("#chat-panel").hidden = false;
  paintChat();
  $<HTMLTextAreaElement>("#chat-input").focus();
  chats.set(id, await command("chatHistory", id));
  if (chatAgent === id) paintChat();
}
function paintChat() {
  const a = agents.find(x => x.id === chatAgent);
  if (!a) { $("#chat-panel").hidden = true; chatAgent = ""; return; }
  paintAvatar($("#chat-avatar"), a);
  $("#chat-name").textContent = a.name;
  $("#chat-via").textContent = `${a.role} · via ${PROVIDERS[a.provider].name}`;
  const chat = chats.get(a.id) || { messages: [], pending: false };
  const log = $("#chat-log");
  log.replaceChildren();
  if (!chat.messages.length) {
    const hello = document.createElement("p");
    hello.className = "chat-empty";
    hello.textContent = `Ask ${a.name} how it’s going, what they’re working on, or bounce an idea off them.`;
    log.append(hello);
  }
  for (const m of chat.messages) {
    const row = document.createElement("div");
    row.className = "chat-msg " + m.from;
    row.textContent = m.text;
    log.append(row);
  }
  if (chat.pending) {
    const typing = document.createElement("div");
    typing.className = "chat-msg agent typing";
    typing.setAttribute("aria-label", `${a.name} is typing`);
    typing.innerHTML = "<span></span><span></span><span></span>";
    log.append(typing);
  }
  $<HTMLButtonElement>("#chat-send").disabled = chat.pending;
  $<HTMLButtonElement>("#chat-clear").disabled = chat.pending || !chat.messages.length;
  log.scrollTop = log.scrollHeight;
}
async function sendChat() {
  const a = agents.find(x => x.id === chatAgent);
  const input = $<HTMLTextAreaElement>("#chat-input");
  const text = input.value.trim();
  if (!a || !text || chats.get(a.id)?.pending) return;
  input.value = "";
  const status = agentStatus(a) + (a.task ? "" : " · no task brief yet");
  const agent = { id: a.id, name: a.name, role: a.role, personality: a.personality, task: a.task, provider: a.provider, status };
  try { chats.set(a.id, await command("chatSend", a.id, { agent, text })); }
  catch (e) { input.value = text; throw e; }
  if (chatAgent === a.id) paintChat();
}
$("#chat-form").onsubmit = (e) => { e.preventDefault(); run(sendChat); };
$("#chat-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); run(sendChat); }
});
$("#chat-close").onclick = () => { $("#chat-panel").hidden = true; chatAgent = ""; };
$("#chat-clear").onclick = () => run(async () => { chats.set(chatAgent, await command("chatClear", chatAgent)); paintChat(); });
function receiveChat(e: BrowserEvent) {
  if (!e.agentId || !e.chat) return;
  chats.set(e.agentId, e.chat);
  if (chatAgent === e.agentId) paintChat();
  if (e.reply?.from === "agent") {
    const short = e.reply.text.length > 90 ? e.reply.text.slice(0, 88).trimEnd() + "…" : e.reply.text;
    office.say(e.agentId, short);
    if (chatAgent !== e.agentId) toast(`${agents.find(a => a.id === e.agentId)?.name || "An agent"} replied`, short);
  }
}
$("#motion").onclick = () => {
  $("#motion").textContent = office.motion()
    ? "Pause movement"
    : "Resume movement";
};
const startDemo = async () => {
  const id = focused || selected;
  await command("ensure", id);
  await command("runDemo", id);
};
$("#run-demo").onclick = () => run(startDemo);
$("#focus-run").onclick = () => run(startDemo);
$("#stop-demo").onclick = () => run(() => command(isRunning(runs.get(focused!)) ? "stopTask" : "stopDemo"));
$("#take-control").onclick = () =>
  run(async () => {
    pendingControl = true;
    refreshFocus();
    try {
      const user = browserStates.get(focused!)?.owner === "user";
      await command(user ? "returnControl" : "takeControl");
      if (!user) $("#browser-surface").focus({ preventScroll: true });
    } finally {
      pendingControl = false;
      refreshFocus();
    }
  });
$("#address-form").onsubmit = (e) => {
  e.preventDefault();
  let url = $<HTMLInputElement>("#address").value.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  run(() => command("navigate", focused!, { url }));
};
for (const [id, action] of [
  ["browser-back", "back"],
  ["browser-forward", "forward"],
  ["browser-reload", "reload"],
  ["browser-home", "home"],
])
  $("#" + id).onclick = () => run(() => command(action));
const surface = $("#browser-surface");
function isUser() {
  return (
    !!focused && browserStates.get(focused)?.owner === "user" && !pendingControl
  );
}
surface.addEventListener("click", (e) => {
  if (!isUser()) {
    showError("Choose “Take control” to interact with this browser.");
    return;
  }
  surface.focus({ preventScroll: true });
  const r = $("#browser-frame").getBoundingClientRect();
  run(() =>
    command("click", focused!, {
      x: Math.max(0, Math.min(1024, ((e.clientX - r.left) / r.width) * 1024)),
      y: Math.max(0, Math.min(640, ((e.clientY - r.top) / r.height) * 640)),
      count: e.detail > 1 ? 2 : 1,
    }),
  );
});
let wheelAt = 0;
surface.addEventListener(
  "wheel",
  (e) => {
    if (!isUser()) return;
    e.preventDefault();
    if (Date.now() - wheelAt < 35) return;
    wheelAt = Date.now();
    run(() => command("scroll", focused!, { dx: e.deltaX, dy: e.deltaY }));
  },
  { passive: false },
);
surface.addEventListener("keydown", (e) => {
  if (!isUser()) return;
  if (e.key === "Escape") {
    surface.blur();
    return;
  }
  if (["Shift", "Control", "Meta", "Alt"].includes(e.key)) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") return;
  e.preventDefault();
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    run(() => command("text", focused!, { text: e.key }));
  } else {
    let key = e.key;
    if (e.metaKey) key = "Meta+" + key;
    else if (e.ctrlKey) key = "Control+" + key;
    if (e.altKey) key = "Alt+" + key;
    if (e.shiftKey && e.key !== "Shift") key = "Shift+" + key;
    run(() => command("key", focused!, { key }));
  }
});
surface.addEventListener("paste", (e) => {
  if (!isUser()) return;
  e.preventDefault();
  const text = e.clipboardData?.getData("text/plain");
  if (text) run(() => command("text", focused!, { text }));
});
// Lowest desk index nobody uses (agents from 0.8 have no desk yet).
function nextDesk(list: Agent[] = agents) {
  const used = new Set(list.map(a => a.desk).filter(d => d !== undefined));
  for (let i = 0; i < MAX_AGENTS; i++) if (!used.has(i)) return i;
  return undefined;
}
const DESK_TINTS = ["#aec49a", "#d6aa87", "#a8bfd0", "#bba6c9", "#cbbc84", "#93beb1"];
const suggestName = async (field: string, draft: any, taken: string[]) => {
  const result = await command("suggest", selected, { provider: draft.provider, field, draft: { name: draft.name, role: draft.role, traits: draft.traits, taken } });
  return result.text as string;
};
$("#add-agent").onclick = () => {
  if (agents.length >= MAX_AGENTS) return;
  if (isDeck) return openRobotDialog({ taken: agents.map(a => a.name), deskFor: () => nextDesk() ?? null, suggest: suggestName, onDone: hire });
  openHireDialog({
    S: Comic,
    taken: agents.map(a => a.name),
    deskFor: () => nextDesk() ?? null,
    suggestNote: "✦ Suggestions come from Claude Code or Codex through your own subscription. They take a few seconds.",
    suggest: async (field: string, draft: any, taken: string[]) => {
      const result = await command("suggest", selected, { provider: draft.provider, field, draft: { name: draft.name, role: draft.role, traits: draft.traits, taken } });
      return result.text as string;
    },
    onHire: (draft: any) => hire(draft),
  });
};
function hire(draft: any) {
      if (agents.length >= MAX_AGENTS) return;
      const a: Agent = {
        id: "agent-" + crypto.randomUUID(),
        name: String(draft.name).slice(0, 40),
        provider: draft.provider === "claude" ? "claude" : "codex",
        role: String(draft.role).slice(0, 60),
        personality: String(draft.description || "Thoughtful, resourceful, and ready to help.").slice(0, 2000),
        task: "",
        color: DESK_TINTS[agents.length % DESK_TINTS.length],
        desk: nextDesk(),
        lookSeed: draft.lookSeed,
        look: draft.look,
        traits: (draft.traits || []).slice(0, 2),
        fresh: true,
      };
      agents.push(a);
      persist(true); // a new hire is saved right away
      selected = a.id;
      syncOffice();
      refresh();
      persist();
      if (isDeck) toast(`${a.name} is on its way`, `Crate incoming at the chute. Docking station ${(a.desk ?? 0) + 1} is ready.`);
      else toast(`${a.name} joined the team`, `Walking in to desk ${(a.desk ?? 0) + 1} now.`);
      setTimeout(() => { a.fresh = false; }, 30000);
      run(() => command("ensure", a.id, { lazy: true }));
}
// Deck 7: rebuild a robot's parts (only its look changes)
document.getElementById("card-parts")?.addEventListener("click", () => {
  const a = agents.find(x => x.id === cardAgent);
  if (!a) return;
  openRobotDialog({ edit: { name: a.name, provider: a.provider, look: a.look, lookSeed: a.lookSeed }, onDone: d => {
    a.look = d.look as unknown as Agent["look"];
    a.lookSeed = d.lookSeed;
    persist(true);
    syncOffice();
    toast(`${a.name} rebuilt`, "New parts fitted. Old parts donated to the janitor.");
  } });
});
async function notes() {
  const result = await command("notes");
  $("#notes-title").textContent = "Practice notes";
  $("#notes-text").textContent =
    result.text ||
    "No saved output yet. Complete the browser practice task first.";
  $("#notes-path").textContent = result.text
    ? "Saved locally: " + result.path
    : "";
  openDialog($<HTMLDialogElement>("#notes-dialog"));
}
$("#view-notes").onclick = () => run(notes);
$("#focus-notes").onclick = () => run(notes);
$("#close-notes").onclick = () => closeDialog($<HTMLDialogElement>("#notes-dialog"));
setInterval(() => {
  if (!focused) return;
  const f = frames.get(focused);
  $("#frame-status").textContent = f
    ? Date.now() - f.at < 3000
      ? "Live · Chromium · 1024 × 640"
      : "Last frame " + Math.round((Date.now() - f.at) / 1000) + "s ago"
    : "Waiting for first frame";
}, 1000);
async function start() {
  try {
    const saved = await invoke<Agent[]>("load_agents");
    agents = saved.length
      ? saved.map(a => ({ ...a, provider: a.provider === "claude" ? "claude" as const : "codex" as const }))
      : [
          {
            id: "ada",
            name: "Ada",
            provider: "codex",
            role: "Researcher",
            personality:
              "Curious, methodical, and quietly opinionated. Always brings sources.",
            task: "Read https://example.com and save a short summary with the source URL.",
            color: "#aec49a",
          },
        ];
    for (const a of agents) if (a.desk === undefined) a.desk = nextDesk(); // 0.8 → 0.9: agent i keeps the i-th desk
    selected = agents[0].id;
    syncOffice();
    refresh();
    const channel = new Channel<BrowserEvent>();
    channel.onmessage = receive;
    await invoke("start_browser", { onEvent: channel });
    ready = true;
    const hello = await command("hello");
    for (const r of hello.runs || []) runs.set(r.agentId, r);
    $("#connection").textContent = "Browser service connected";
    $("#connection").classList.add("connected");
    // The worker keeps 4 live browsers; others are registered "parked" and open when they need the web.
    // One agent's browser failing to open must not block provider checks and the project board.
    for (const a of agents) await command("ensure", a.id, { lazy: true }).catch(e => record(a.id, "Browser could not open: " + String(e?.message || e)));
    persist();
    refresh();
    void checkProviders();
    run(()=>workflow.reload());
  } catch (e) {
    $("#connection").textContent = "Setup needs attention";
    showError(e);
  }
}
function displayProvider(a: Agent): Provider {
  const r = runs.get(a.id);
  return isRunning(r) ? r!.provider : a.provider;
}
const NEEDS_YOU: Partial<Record<RunState["status"], string>> = { waiting: "has a question", paused: "task paused", interrupted: "task interrupted", limited: "limit reached", error: "task failed" };
function syncOffice() {
  office.setAgents(agents.map(a => ({ ...a, provider: displayProvider(a) })));
  for (const a of agents) {
    const s = browserStates.get(a.id), r = runs.get(a.id);
    // A finished run keeps its agent at the desk, leaning back, until the user accepts the result.
    const waiting = r?.status === "review" && !workflow.accepted(r.id);
    // A paused, interrupted, failed or limited run keeps its agent at the desk with a "!" until the user acts on it.
    const needs = r && s?.owner !== "user" ? NEEDS_YOU[r.status] : undefined;
    if (s) office.state({ ...s, status: isRunning(r) ? "working" : waiting ? "review" : needs ? "needs" : s.status, reason: needs });
  }
}
function runLabel(r: RunState) {
  if(r.status==="review"&&workflow.accepted(r.id))return "Accepted";
  return { starting: "Preparing", running: "Working", pausing: "Pausing", paused: "Paused", stopping: "Stopping", stopped: "Stopped", review: "Ready for review", waiting: "Needs your answer", error: "Needs attention", interrupted: "Interrupted", limited: "Limit reached" }[r.status];
}
function canStart(a: Agent) {
  const s = browserStates.get(a.id);
  return ready && !!a.task.trim() && providers.get(a.provider)?.status === "ready" && !!s && s.owner === "agent" && !["working", "loading"].includes(s.status) && ![...runs.values()].some(r => isRunning(r) && (r.agentId === a.id || r.provider === a.provider));
}
async function checkProviders() {
  checkingProviders = true; refresh();
  try {
    const result: ProviderStatus[] = await command("providers");
    for (const p of result) providers.set(p.provider, p);
    const count = result.filter(p => p.status === "ready").length;
    $("#connection").textContent = count ? `${count} subscription${count > 1 ? "s" : ""} connected` : "Connect a subscription to work";
  } catch (e) { showError(e); }
  finally { checkingProviders = false; refresh(); }
}
async function startTask(agentId: string, previousRunId?: string, followup = "") {
  const agent = agents.find(a => a.id === agentId)!;
  const r: RunState = await command("startTask", agentId, { agent, previousRunId, followup });
  // A run event may already have delivered newer progress for this run; keep whichever is further along.
  const known = runs.get(agentId);
  if (known?.id !== r.id || known.events.length <= r.events.length) runs.set(agentId, r);
  refresh();
}
async function openWork(agentId: string,runId?:string) {
  workAgent = agentId;
  historyRuns = await command("runHistory", agentId);
  viewedRun = runId&&historyRuns.some(r=>r.id===runId)?runId:historyRuns[0]?.id || "";
  await workflow.reload();
  refreshWork();
  if(!$<HTMLDialogElement>("#work-dialog").open){document.body.append($("#work-dialog"));openDialog($<HTMLDialogElement>("#work-dialog"));}
}
function addText(parent: HTMLElement, tag: string, text: string, className = "") {
  const el = document.createElement(tag); el.textContent = text; el.className = className; parent.append(el); return el;
}
function refreshWork() {
  if (!workAgent) return;
  const agent = agents.find(a => a.id === workAgent)!;
  const r = historyRuns.find(r => r.id === viewedRun);
  $("#work-title").textContent = `${agent.name}’s work`;
  $("#work-provider").textContent = r ? `${PROVIDERS[r.provider].name} · ${r.model || r.version || "Subscription"}` : PROVIDERS[agent.provider].name;
  const history = $<HTMLSelectElement>("#run-history");
  history.replaceChildren();
  for (const item of historyRuns) {
    const option = new Option(`${new Date(item.startedAt).toLocaleString()} · ${runLabel(item)} · ${item.task.slice(0, 65)}`, item.id);
    history.add(option);
  }
  if (!r) history.add(new Option("No tasks yet", ""));
  history.value = viewedRun;
  $("#work-status").textContent = r ? runLabel(r) : "Ready when you are";
  $("#work-message").textContent = r&&workflow.accepted(r.id)?"You accepted this result. Its sources and saved files remain available below.":r?.status==="waiting"?`${agent.name} stopped to ask you something. Your answer continues the same session; no subscription time is used while it waits.`:r?.message || "Add a task brief and start from the office.";
  $("#handoff-origin").hidden=!r?.handoff&&!r?.taskId;
  $("#handoff-origin").textContent=[r?.taskId?`Project task · ${r.taskTitle}`:"",r?.handoff?`Shared input · ${r.handoff.fileName}`:""].filter(Boolean).join(" · ");
  const active = isRunning(r), latest = runs.get(workAgent)?.id === r?.id;
  $("#pause-task").hidden = !active || !latest;
  $("#stop-task").hidden = !active || !latest;
  for (const id of ["pause-task", "stop-task"]) $<HTMLButtonElement>("#" + id).disabled = r?.status === "pausing" || r?.status === "stopping";
  const asking = r?.status === "waiting" && !!r.question && latest;
  $("#question-box").hidden = !asking;
  if (asking && $("#question-text").textContent !== r!.question!.text) {
    $("#question-text").textContent = r!.question!.text;
    const options = $("#question-options"); options.replaceChildren();
    for (const o of r!.question!.options) { const b = addText(options, "button", o, "secondary") as HTMLButtonElement; b.onclick = () => run(() => answerQuestion(o)); }
  }
  $<HTMLButtonElement>("#question-send").disabled = !asking || !canStart({...agent,task:r!.task}) || !$<HTMLTextAreaElement>("#question-answer").value.trim();
  $("#resume-task").hidden = !r || active || r.status === "review" || r.status === "waiting";
  $<HTMLButtonElement>("#resume-task").disabled = !canStart({...agent,task:r?.task||agent.task});
  $<HTMLButtonElement>("#revise-task").disabled = !r || !canStart({...agent,task:r.task}) || !$<HTMLTextAreaElement>("#followup").value.trim();
  $("#revision-provider").textContent = `Next run uses ${PROVIDERS[agent.provider].name}. The saved session continues when context is unchanged. Context changes start a fresh session; switching provider also starts fresh.`;
  const reviewed=!!r&&workflow.accepted(r.id),reviewable=r?.status==="review";
  $("#review-state").textContent=reviewed?"Accepted by you":"Your review";
  $("#review-help").textContent=reviewed?"This result can be handed to a project teammate. Reopening cancels its queued handoffs.":"Read the saved result and its sources. Mark accepted when it is useful; completion alone does not earn a trophy.";
  document.querySelector<HTMLElement>(".review-bar")!.hidden=!reviewable&&!reviewed;
  $("#accept-work").hidden=!reviewable||reviewed;$("#reopen-work").hidden=!reviewed;$("#handoff-work").hidden=!reviewed;
  for(const id of ["accept-work","reopen-work","handoff-work"])$<HTMLButtonElement>("#"+id).disabled=workflow.locked();
  const artifacts = $("#artifacts"); artifacts.replaceChildren();
  if (!r?.artifacts.length) addText(artifacts, "p", "Results will appear here as they are saved.", "empty-state");
  for (const a of r?.artifacts || []) {
    const row = addText(artifacts, "div", "", "artifact-row");
    addText(row, "strong", a.name);
    addText(row, "span", `${Math.max(1, Math.round(a.bytes / 1024))} KB`, "fine-print");
    // Opens in Worklive's document window; "Open in default app" is inside the window.
    const open = addText(row, "button", "Open", "quiet") as HTMLButtonElement;
    open.onclick = () => documents.open({ kind: "output", runId: r!.id, name: a.name, agentId: r!.agentId });
  }
  const sources = $("#sources"); sources.replaceChildren();
  const unique = [...new Map((r?.sources || []).map(s => [s.url, s])).values()];
  if (!unique.length) addText(sources, "p", "No public sources observed in this run.", "empty-state");
  for (const source of unique) {
    const row = addText(sources, "div", "", "source-row");
    addText(row, "strong", source.title || source.url);
    addText(row, "small", source.url);
  }
  const contextUsed=$("#context-used");contextUsed.replaceChildren();
  if(!r?.contextUsed?.length)addText(contextUsed,"p","No local context supplied in this run.","empty-state");
  for(const c of r?.contextUsed||[]){
    const row=addText(contextUsed,"details","","source-row");
    addText(row,"summary",`${c.title} · v${c.revision} · ${c.locator||"Preview"}`);
    addText(row,"small",`${c.scope} · ${c.id}${c.hash?` · SHA-256 ${c.hash}`:""}`);
    if(c.warning)addText(row,"small",c.warning);
    addText(row,"pre",c.text||c.excerpt||c.preview||"");
  }
  const memories=$("#memories-added");memories.replaceChildren();
  if(!r?.memoriesAdded?.length)addText(memories,"p","No new memories saved in this run.","empty-state");
  for(const m of r?.memoriesAdded||[])addText(memories,"p",`${m.title} · ${m.scope}${m.status==="proposal"?" · awaiting your review":""}`,"source-row");
  const events = $("#run-events"); events.replaceChildren();
  for (const event of r?.events.slice(-30) || []) addText(events, "li", `${new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · ${event.message}`);
  $("#run-text").textContent = r?.text || "No response yet.";
}
$("#accept-work").onclick=()=>run(async()=>{const r=historyRuns.find(r=>r.id===viewedRun);if(r)await workflow.review(r,true);});
$("#reopen-work").onclick=()=>run(async()=>{const r=historyRuns.find(r=>r.id===viewedRun);if(r)await workflow.review(r,false);});
$("#handoff-work").onclick=()=>run(async()=>{const r=historyRuns.find(r=>r.id===viewedRun);if(r){closeDialog($<HTMLDialogElement>("#work-dialog"));try{await workflow.compose(r);}catch(e){await openWork(r.agentId,r.id);throw e;}}});
$("#edit-provider").addEventListener("change", () => {
  agents.find(a => a.id === selected)!.provider = $<HTMLSelectElement>("#edit-provider").value as Provider;
  persist(); refresh();
});
$("#check-providers").onclick = () => void checkProviders();
$("#provider-login").onclick = () => run(() => invoke("open_provider_terminal", { provider: agents.find(a => a.id === selected)!.provider }));
$("#start-task").onclick = () => run(() => startTask(selected));
$("#focus-start").onclick = () => run(() => startTask(focused!));
$("#work-results").onclick = () => run(() => openWork(selected));
$("#focus-work").onclick = () => run(() => openWork(focused!));
$("#close-work").onclick = () => closeDialog($<HTMLDialogElement>("#work-dialog"));
$("#run-history").onchange = () => { viewedRun = $<HTMLSelectElement>("#run-history").value; refreshWork(); };
$("#pause-task").onclick = () => run(() => command("pauseTask", workAgent));
$("#stop-task").onclick = () => run(() => command("stopTask", workAgent));
$("#resume-task").onclick = () => run(() => startTask(workAgent, viewedRun));
/** The user's answer continues the same session (exact resume when context is unchanged). */
async function answerQuestion(answer: string) {
  const r = historyRuns.find(x => x.id === viewedRun) || runs.get(workAgent);
  if (!r?.question || !answer.trim()) return;
  await startTask(workAgent, r.id, `The user answered your question "${r.question.text}": ${answer.trim()}`);
  $<HTMLTextAreaElement>("#question-answer").value = ""; $("#question-text").textContent = ""; refreshWork();
}
$("#question-answer").oninput = refreshWork;
$("#question-send").onclick = () => run(() => answerQuestion($<HTMLTextAreaElement>("#question-answer").value));
$("#followup").oninput = refreshWork;
$("#revise-task").onclick = () => run(async () => {
  await startTask(workAgent, viewedRun, $<HTMLTextAreaElement>("#followup").value);
  $<HTMLTextAreaElement>("#followup").value = ""; refreshWork();
});
void start();
