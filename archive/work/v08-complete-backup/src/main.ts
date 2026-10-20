import "./style.css";
import { invoke, Channel } from "@tauri-apps/api/core";
import { createIcons, icons } from "lucide";
import { createProjects } from "./projects";
import { createWorkflow } from "./workflow";
import { createContext } from "./context";
import { createOffice } from "./office";
import { PROVIDERS, isRunning, type Agent, type BrowserEvent, type BrowserState, type Provider, type ProviderStatus, type RunState } from "./types";

document.querySelector("#app")!.innerHTML = `
<header class="app-header"><div class="brand"><span class="brand-mark">w</span><span>Worklive<small>A little space for big ideas.</small></span></div><div class="header-actions"><span class="connection" id="connection">Starting browser service…</span><button class="secondary" id="projects-open">Projects</button><button class="secondary" id="project-handoffs">Handoffs</button><button class="secondary" id="company-context">Company knowledge</button><button class="primary" id="add-agent"><i data-lucide="plus"></i> New agent</button></div></header>
<main id="office-view" class="office-layout"><section class="office-workspace"><div class="scene-heading"><div><span class="eyebrow">YOUR TEAM, TOGETHER</span><h1>The studio.</h1><span id="studio-achievement" hidden></span><p id="team-summary">One desk. Room to grow.</p></div><div class="scene-controls"><button id="rotate-left" class="icon-button" aria-label="Rotate office left"><i data-lucide="rotate-ccw"></i></button><button id="rotate-right" class="icon-button" aria-label="Rotate office right"><i data-lucide="rotate-cw"></i></button><button id="zoom-in" class="icon-button" aria-label="Zoom in"><i data-lucide="plus"></i></button><button id="zoom-out" class="icon-button" aria-label="Zoom out"><i data-lucide="minus"></i></button></div></div><div id="office-scene"></div><div class="scene-caption"><span><i data-lucide="scan"></i>Hover a character for details. Click a monitor to open its browser.</span><button id="motion" class="quiet">Pause movement</button></div><section class="office-life-panel" aria-label="Office life"><div><span class="eyebrow">OFFICE LIFE <span class="playful-badge">JUST FOR FUN</span></span><p id="office-moment" role="status">Coffee, small talk, and a little room to breathe.</p></div><button id="coffee-break" class="secondary" title="Invite free agents to the community table"><i data-lucide="coffee"></i>Coffee break</button></section><section class="activity-panel"><div class="panel-heading"><h2>Around the office</h2><span>LIVE ACTIVITY</span></div><div id="activity" aria-live="polite"><div class="activity-item">Your studio is opening.</div></div></section></section>
<aside class="inspector"><div class="profile"><span id="agent-avatar" class="avatar"><i data-lucide="bot"></i></span><div><h2 id="agent-name">Ada</h2><span id="agent-status">Opening browser</span></div></div><button id="open-screen" class="primary wide"><i data-lucide="monitor-up"></i>Open browser</button><div class="provider-block"><label>Powered by<select id="edit-provider"><option value="codex">Codex · teal shirt</option><option value="claude">Claude Code · terracotta shirt</option></select></label><p id="provider-detail" class="fine-print">Checking subscriptions…</p><div class="button-row"><button id="check-providers" class="quiet">Check connection</button><button id="provider-login" class="quiet">Open official tool</button></div></div><div class="task-actions"><label>Task brief<textarea id="edit-task" maxlength="1000" rows="3"></textarea></label><button id="start-task" class="primary wide">Start task</button><button id="agent-context" class="secondary wide">Context & files</button><button id="work-results" class="secondary wide">Work & results</button><p id="run-summary" role="status"></p></div><details class="profile-details"><summary>Agent profile</summary><div class="inspector-fields"><label>Name<input id="edit-name" maxlength="40"></label><label>Role<select id="edit-role"><option>Researcher</option><option>Designer</option><option>Developer</option><option>Coordinator</option><option>Writer</option><option>Generalist</option></select></label><label>Personality<textarea id="edit-personality" maxlength="500" rows="3"></textarea></label></div></details><details class="practice-block"><summary>Browser practice</summary><p>A local, scripted demonstration. No subscription usage.</p><button id="run-demo" class="secondary wide"><i data-lucide="play"></i><span>Run browser practice</span></button><button id="view-notes" class="quiet wide"><i data-lucide="file-text"></i>View saved notes</button></details><div class="inspector-note">Public research & writing · saved locally<br>Official subscription tools · shared usage limits</div></aside></main>
<main id="browser-view" class="browser-layout" hidden><div class="browser-heading"><div class="browser-heading-left"><button id="back-office" class="secondary"><i data-lucide="arrow-left"></i>Office</button><div><h1 id="computer-title">Ada’s computer</h1><p id="computer-subtitle">Watching the same session as the desk monitor.</p></div></div><div class="browser-heading-right"><button id="stop-demo" class="secondary"><i data-lucide="square"></i>Stop task</button><button id="take-control" class="primary"><i data-lucide="mouse-pointer-2"></i><span>Take control</span></button></div></div><div class="browser-columns"><section class="computer"><div class="browser-toolbar"><button id="browser-back" class="icon-button" aria-label="Browser back"><i data-lucide="arrow-left"></i></button><button id="browser-forward" class="icon-button" aria-label="Browser forward"><i data-lucide="arrow-right"></i></button><button id="browser-reload" class="icon-button" aria-label="Reload page"><i data-lucide="rotate-cw"></i></button><form id="address-form"><i data-lucide="globe"></i><input id="address" aria-label="Browser address" placeholder="https://example.com" autocomplete="off" spellcheck="false"><button type="submit" class="address-go" aria-label="Open address">↵</button></form><button id="browser-home" class="icon-button" aria-label="Open practice page"><i data-lucide="house"></i></button></div><div id="browser-surface" class="browser-surface" tabindex="0" role="application" aria-label="Live browser. Take control to click, type, paste, and scroll."><img id="browser-frame" alt="Live agent browser" draggable="false"><span id="browser-cursor" class="browser-cursor" hidden></span><div id="browser-placeholder">Opening the browser session…</div></div><div class="computer-footer"><span id="control-hint">Watching · Take control to interact</span><span id="frame-status">Waiting for first frame</span></div></section><aside class="browser-activity"><div class="ownership"><span class="status-dot"></span><span id="owner-status">Agent in control</span></div><span class="eyebrow">CURRENT TASK</span><p id="focused-task"></p><p id="task-message" aria-live="polite"></p><button id="focus-start" class="primary wide">Start task</button><button id="focus-context" class="secondary wide">Context & files</button><button id="focus-work" class="secondary wide">Work & results</button><p class="fine-print">The agent reads public pages in this browser and saves Markdown, text, or CSV results.</p><details class="practice-block"><summary>Browser practice</summary><button id="focus-run" class="quiet wide">Run browser practice</button><button id="focus-notes" class="quiet wide">View practice notes</button></details></aside></div><nav id="computer-switcher" aria-label="Agent computers"></nav></main>
<footer class="app-footer"><span id="footer-context">Office / Creative studio</span><span>Tauri + Rust · A living office · 0.8.0</span></footer><div id="toast" role="alert" hidden></div>
<dialog id="new-dialog"><form id="new-form"><div class="dialog-heading"><h2>A new face in the studio.</h2><button type="button" id="cancel-new" class="icon-button" aria-label="Close new agent dialog"><i data-lucide="x"></i></button></div><label>Name<input name="name" required maxlength="40" placeholder="e.g. Milo"></label><label>Role<select name="role"><option>Researcher</option><option>Designer</option><option>Developer</option><option>Coordinator</option><option>Writer</option><option>Generalist</option></select></label><label>Powered by<select name="provider"><option value="codex">Codex · teal shirt</option><option value="claude">Claude Code · terracotta shirt</option></select></label><label>Personality<textarea name="personality" rows="3" maxlength="500" placeholder="Curious, thoughtful, and direct."></textarea></label><p class="fine-print">A desk and a separate browser session will be created.</p><button class="primary wide" type="submit">Create agent</button></form></dialog>
<dialog id="notes-dialog"><div class="dialog-heading"><h2 id="notes-title">Saved research notes</h2><button id="close-notes" class="icon-button" aria-label="Close saved notes"><i data-lucide="x"></i></button></div><pre id="notes-text"></pre><p id="notes-path" class="fine-print"></p></dialog>
<dialog id="work-dialog"><div class="dialog-heading"><div><span class="eyebrow" id="work-provider"></span><h2 id="work-title">Work & results</h2></div><button id="close-work" class="icon-button" aria-label="Close work and results"><i data-lucide="x"></i></button></div><label>Task history<select id="run-history"></select></label><div class="work-status"><strong id="work-status"></strong><p id="work-message" role="status"></p><p id="handoff-origin" class="fine-print" hidden></p><div class="button-row"><button id="pause-task" class="secondary">Pause</button><button id="stop-task" class="secondary">Stop</button><button id="resume-task" class="primary">Resume</button></div></div><section class="review-bar"><div><strong id="review-state">Your review</strong><p id="review-help" class="fine-print"></p></div><div class="button-row"><button id="accept-work" class="primary">Mark accepted</button><button id="reopen-work" class="secondary">Reopen review</button><button id="handoff-work" class="secondary">Hand off to teammate</button></div></section><div class="work-grid"><section><h3>Saved results</h3><div id="artifacts"></div><h3>Sources observed</h3><div id="sources"></div><h3>Context received</h3><div id="context-used"></div><h3>Memories added</h3><div id="memories-added"></div></section><section><h3>Activity</h3><ol id="run-events"></ol></section></div><details id="reply-details"><summary>Agent’s response</summary><pre id="run-text"></pre></details><div class="revision"><label>Continue or revise<textarea id="followup" maxlength="4000" rows="2" placeholder="e.g. Make the recommendation shorter and add a comparison table."></textarea></label><button id="revise-task" class="primary">Send revision</button><p class="fine-print" id="revision-provider"></p></div></dialog>`;
createIcons({ icons });
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
let agents: Agent[] = [],
  selected = "",
  focused: string | null = null,
  ready = false,
  pendingControl = false,
  saveTimer: ReturnType<typeof setTimeout>,
  toastTimer: ReturnType<typeof setTimeout>;
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
const office = createOffice(
  $("#office-scene"),
  selectAgent,
  openComputer,
  (moment) => {
    $("#office-moment").textContent = moment.speaker
      ? `${moment.speaker}: “${moment.text}”`
      : moment.text;
  },
);
const workflow=createWorkflow({agents:()=>agents,runs:()=>[...runs.values()],command:(action,extra)=>command(action,focused||selected,extra),error:showError,changed:state=>{projects.apply(state);if(agents.length)refresh();},openWork,openProject:id=>projects.open(id),award:earned=>office.achievement(earned)});
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
  const toast = $("#toast");
  toast.textContent = String(error);
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.hidden = true), 6500);
}
async function command(
  action: string,
  agentId = focused || selected,
  extra: Record<string, unknown> = {},
): Promise<any> {
  if (!ready) throw new Error("The browser service is still starting.");
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
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void invoke("save_agents", { agents }).catch(showError);
  }, 350);
}
function refresh() {
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
    if (document.activeElement !== input) input.value = a[field];
  }
  syncOffice();
  office.select(a.id);
  const working = agents.filter(a => isRunning(runs.get(a.id)) || browserStates.get(a.id)?.status === "working").length;
  $("#team-summary").textContent =
    `${agents.length} ${agents.length === 1 ? "agent" : "agents"} · ${working} working · room to grow`;
  $<HTMLButtonElement>("#add-agent").disabled = agents.length >= 6;
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
    ready = false;
    $("#connection").textContent = "Browser disconnected";
    $("#connection").classList.remove("connected");
    showError(e.message);
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
$("#rotate-left").onclick = () => office.rotate(-10);
$("#rotate-right").onclick = () => office.rotate(10);
$("#zoom-in").onclick = () => office.zoom(0.1);
$("#zoom-out").onclick = () => office.zoom(-0.1);
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
$("#add-agent").onclick = () => {
  $<HTMLDialogElement>("#new-dialog").showModal();
  $<HTMLInputElement>("#new-form input").focus();
};
$("#cancel-new").onclick = () => $<HTMLDialogElement>("#new-dialog").close();
$("#new-form").onsubmit = (e) => {
  e.preventDefault();
  if (agents.length >= 6) return;
  const form = $<HTMLFormElement>("#new-form"),
    values = new FormData(form),
    name = String(values.get("name") || "").trim();
  if (!name) return;
  const colors = [
    "#aec49a",
    "#d6aa87",
    "#a8bfd0",
    "#bba6c9",
    "#cbbc84",
    "#93beb1",
  ];
  const a: Agent = {
    id: "agent-" + crypto.randomUUID(),
    name,
    provider: values.get("provider") === "claude" ? "claude" : "codex",
    role: String(values.get("role")),
    personality: String(
      values.get("personality") ||
        "Thoughtful, resourceful, and ready to help.",
    ),
    task: "",
    color: colors[agents.length],
  };
  agents.push(a);
  selected = a.id;
  syncOffice();
  refresh();
  persist();
  form.reset();
  $<HTMLDialogElement>("#new-dialog").close();
  run(() => command("ensure", a.id));
};
async function notes() {
  const result = await command("notes");
  $("#notes-title").textContent = "Practice notes";
  $("#notes-text").textContent =
    result.text ||
    "No saved output yet. Complete the browser practice task first.";
  $("#notes-path").textContent = result.text
    ? "Saved locally: " + result.path
    : "";
  $<HTMLDialogElement>("#notes-dialog").showModal();
}
$("#view-notes").onclick = () => run(notes);
$("#focus-notes").onclick = () => run(notes);
$("#close-notes").onclick = () => $<HTMLDialogElement>("#notes-dialog").close();
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
    for (const a of agents) await command("ensure", a.id);
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
function syncOffice() {
  office.setAgents(agents.map(a => ({ ...a, provider: displayProvider(a) })));
  for (const a of agents) {
    const s = browserStates.get(a.id), r = runs.get(a.id);
    if (s) office.state({ ...s, status: isRunning(r) ? "working" : s.status });
  }
}
function runLabel(r: RunState) {
  if(r.status==="review"&&workflow.accepted(r.id))return "Accepted";
  return { starting: "Preparing", running: "Working", pausing: "Pausing", paused: "Paused", stopping: "Stopping", stopped: "Stopped", review: "Ready for review", error: "Needs attention", interrupted: "Interrupted", limited: "Limit reached" }[r.status];
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
  const r = await command("startTask", agentId, { agent, previousRunId, followup });
  runs.set(agentId, r); refresh();
}
async function openWork(agentId: string,runId?:string) {
  workAgent = agentId;
  historyRuns = await command("runHistory", agentId);
  viewedRun = runId&&historyRuns.some(r=>r.id===runId)?runId:historyRuns[0]?.id || "";
  await workflow.reload();
  refreshWork();
  if(!$<HTMLDialogElement>("#work-dialog").open){document.body.append($("#work-dialog"));$<HTMLDialogElement>("#work-dialog").showModal();}
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
  $("#work-message").textContent = r&&workflow.accepted(r.id)?"You accepted this result. Its sources and saved files remain available below.":r?.message || "Add a task brief and start from the office.";
  $("#handoff-origin").hidden=!r?.handoff&&!r?.taskId;
  $("#handoff-origin").textContent=[r?.taskId?`Project task · ${r.taskTitle}`:"",r?.handoff?`Shared input · ${r.handoff.fileName}`:""].filter(Boolean).join(" · ");
  const active = isRunning(r), latest = runs.get(workAgent)?.id === r?.id;
  $("#pause-task").hidden = !active || !latest;
  $("#stop-task").hidden = !active || !latest;
  for (const id of ["pause-task", "stop-task"]) $<HTMLButtonElement>("#" + id).disabled = r?.status === "pausing" || r?.status === "stopping";
  $("#resume-task").hidden = !r || active || r.status === "review";
  $<HTMLButtonElement>("#resume-task").disabled = !canStart({...agent,task:r?.task||agent.task});
  $<HTMLButtonElement>("#revise-task").disabled = !r || !canStart({...agent,task:r.task}) || !$<HTMLTextAreaElement>("#followup").value.trim();
  $("#revision-provider").textContent = `Next run uses ${PROVIDERS[agent.provider].name}. The saved session continues when context is unchanged. Context changes start a fresh session; switching provider also starts fresh.`;
  const reviewed=!!r&&workflow.accepted(r.id),reviewable=r?.status==="review";
  $("#review-state").textContent=reviewed?"Accepted by you":"Your review";
  $("#review-help").textContent=reviewed?"This result can be handed to a project teammate. Reopening cancels its queued handoffs.":"Read the saved result and its sources. Mark accepted when it is useful; completion alone does not earn a trophy.";
  $("#accept-work").hidden=!reviewable||reviewed;$("#reopen-work").hidden=!reviewed;$("#handoff-work").hidden=!reviewed;
  for(const id of ["accept-work","reopen-work","handoff-work"])$<HTMLButtonElement>("#"+id).disabled=workflow.locked();
  const artifacts = $("#artifacts"); artifacts.replaceChildren();
  if (!r?.artifacts.length) addText(artifacts, "p", "Results will appear here as they are saved.", "empty-state");
  for (const a of r?.artifacts || []) {
    const row = addText(artifacts, "div", "", "artifact-row");
    addText(row, "strong", a.name);
    addText(row, "span", `${Math.max(1, Math.round(a.bytes / 1024))} KB`, "fine-print");
    const preview = addText(row, "button", "Read", "quiet") as HTMLButtonElement;
    preview.onclick = () => run(async () => {
      const result = await command("artifact", workAgent, { runId: r!.id, name: a.name });
      $("#notes-title").textContent = a.name; $("#notes-text").textContent = result.content;
      $("#notes-path").textContent = (result.unchanged ? "Saved locally: " : "Edited since this run: ") + result.path;
      $<HTMLDialogElement>("#notes-dialog").showModal();
    });
    const open = addText(row, "button", "Open", "quiet") as HTMLButtonElement;
    open.onclick = () => run(() => invoke("open_artifact", { runId: r!.id, name: a.name }));
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
$("#handoff-work").onclick=()=>run(async()=>{const r=historyRuns.find(r=>r.id===viewedRun);if(r){$<HTMLDialogElement>("#work-dialog").close();try{await workflow.compose(r);}catch(e){await openWork(r.agentId,r.id);throw e;}}});
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
$("#close-work").onclick = () => $<HTMLDialogElement>("#work-dialog").close();
$("#run-history").onchange = () => { viewedRun = $<HTMLSelectElement>("#run-history").value; refreshWork(); };
$("#pause-task").onclick = () => run(() => command("pauseTask", workAgent));
$("#stop-task").onclick = () => run(() => command("stopTask", workAgent));
$("#resume-task").onclick = () => run(() => startTask(workAgent, viewedRun));
$("#followup").oninput = refreshWork;
$("#revise-task").onclick = () => run(async () => {
  await startTask(workAgent, viewedRun, $<HTMLTextAreaElement>("#followup").value);
  $<HTMLTextAreaElement>("#followup").value = ""; refreshWork();
});
void start();
