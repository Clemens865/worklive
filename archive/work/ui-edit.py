from pathlib import Path
p=Path('src/main.ts');s=p.read_text()
s=s.replace('import type { Agent, BrowserEvent, BrowserState } from "./types";', 'import { PROVIDERS, isRunning, type Agent, type BrowserEvent, type BrowserState, type Provider, type ProviderStatus, type RunState } from "./types";')
s=s.replace('REAL BROWSER ACTIVITY','LIVE ACTIVITY')
s=s.replace('<div class="inspector-fields">','<div class="provider-block"><label>Powered by<select id="edit-provider"><option value="codex">Codex · teal shirt</option><option value="claude">Claude Code · terracotta shirt</option></select></label><p id="provider-detail" class="fine-print">Checking subscriptions…</p><div class="button-row"><button id="check-providers" class="quiet">Check connection</button><button id="provider-login" class="quiet">Open official tool</button></div></div><div class="task-actions"><button id="start-task" class="primary wide">Start task</button><button id="work-results" class="secondary wide">Work & results</button><p id="run-summary" role="status"></p></div><div class="inspector-fields">',1)
s=s.replace('<div class="practice-block"><span class="eyebrow">FIRST WORKING EXPERIMENT</span><h3>Read. Write. Save.</h3><p>A scripted agent reads a real practice webpage, writes notes, and saves the result.</p>', '<details class="practice-block"><summary>Browser practice</summary><p>A local, scripted demonstration. No subscription usage.</p>')
s=s.replace('</button></div><div class="inspector-note">Live Chromium browser · isolated session<br>Language-model agents are not connected yet.</div>', '</button></details><div class="inspector-note">Public research & writing · saved locally<br>Official subscription tools · shared usage limits</div>')
a=s.index('<ol class="task-steps">');b=s.index('</aside></div><nav id="computer-switcher"',a)
s=s[:a]+'''<p id="task-message" aria-live="polite"></p><button id="focus-start" class="primary wide">Start task</button><button id="focus-work" class="secondary wide">Work & results</button><p class="fine-print">The agent reads public pages in this browser and saves Markdown, text, or CSV results.</p><details class="practice-block"><summary>Browser practice</summary><button id="focus-run" class="quiet wide">Run browser practice</button><button id="focus-notes" class="quiet wide">View practice notes</button></details>'''+s[b:]
s=s.replace('0.2</span>','0.3</span>')
s=s.replace('<label>Personality<textarea name="personality"','<label>Powered by<select name="provider"><option value="codex">Codex · teal shirt</option><option value="claude">Claude Code · terracotta shirt</option></select></label><label>Personality<textarea name="personality"')
s=s.replace('<h2>Saved research notes</h2>', '<h2 id="notes-title">Saved research notes</h2>')
s=s.replace('</dialog>`;', '''</dialog>
<dialog id="work-dialog"><div class="dialog-heading"><div><span class="eyebrow" id="work-provider"></span><h2 id="work-title">Work & results</h2></div><button id="close-work" class="icon-button" aria-label="Close work and results"><i data-lucide="x"></i></button></div><label>Task history<select id="run-history"></select></label><div class="work-status"><strong id="work-status"></strong><p id="work-message" role="status"></p><div class="button-row"><button id="pause-task" class="secondary">Pause</button><button id="stop-task" class="secondary">Stop</button><button id="resume-task" class="primary">Resume</button></div></div><div class="work-grid"><section><h3>Saved results</h3><div id="artifacts"></div><h3>Sources observed</h3><div id="sources"></div></section><section><h3>Activity</h3><ol id="run-events"></ol></section></div><details id="reply-details"><summary>Agent’s response</summary><pre id="run-text"></pre></details><div class="revision"><label>Continue or revise<textarea id="followup" maxlength="4000" rows="2" placeholder="e.g. Make the recommendation shorter and add a comparison table."></textarea></label><button id="revise-task" class="primary">Send revision</button><p class="fine-print" id="revision-provider"></p></div></dialog>`;''')
s=s.replace('const browserStates =', 'const runs = new Map<string, RunState>(), providers = new Map<Provider, ProviderStatus>();\nlet checkingProviders = false, workAgent = "", historyRuns: RunState[] = [], viewedRun = "";\nconst browserStates =',1)
s=s.replace('$("#agent-status").textContent = statusText(state);','$("#agent-status").textContent = runs.has(a.id) ? runLabel(runs.get(a.id)!) : statusText(state);')
s=s.replace('$("#agent-avatar").style.background = a.color;', '$("#agent-avatar").style.background = PROVIDERS[displayProvider(a)].color + "33";\n  $<HTMLSelectElement>("#edit-provider").value = a.provider;\n  const provider = providers.get(a.provider);\n  $("#provider-detail").textContent = (checkingProviders ? "Checking connection…" : provider?.detail || "Connection not checked yet.") + (isRunning(runs.get(a.id)) ? " Provider changes apply to the next run." : "");\n  $<HTMLButtonElement>("#check-providers").disabled = checkingProviders || !ready;\n  $<HTMLButtonElement>("#provider-login").disabled = [...runs.values()].some(r => isRunning(r) && r.provider === a.provider);\n  $<HTMLButtonElement>("#start-task").disabled = !canStart(a);\n  $("#run-summary").textContent = runs.get(a.id)?.message || "Give this agent a research or writing task below.";')
s=s.replace('office.setAgents(agents);','syncOffice();')
s=s.replace('const working = [...browserStates.values()].filter(\n    (s) => s.status === "working",\n  ).length;', 'const working = agents.filter(a => isRunning(runs.get(a.id)) || browserStates.get(a.id)?.status === "working").length;')
s=s.replace('!state ||\n    state.owner', '!state || isRunning(runs.get(a.id)) ||\n    state.owner')
s=s.replace('  refreshFocus();\n}\nfunction selectAgent', '  refreshFocus();\n  refreshWork();\n}\nfunction selectAgent')
s=s.replace('$("#focused-task").textContent = a.task || "No task brief assigned.";', '$("#focused-task").textContent = (isRunning(runs.get(a.id)) ? runs.get(a.id)?.task : a.task) || "No task brief assigned.";\n  $<HTMLButtonElement>("#focus-start").disabled = !canStart(a);')
s=s.replace('$("#task-message").textContent = s?.message || "Opening browser…";','$("#task-message").textContent = runs.get(a.id)?.message || s?.message || "Opening browser…";')
s=s.replace('$("#stop-demo").hidden = s?.status !== "working" && s?.status !== "paused";', '$("#stop-demo").hidden = !isRunning(runs.get(a.id)) && s?.status !== "working" && s?.status !== "paused";')
s=s.replace('!s || user || s.status', '!s || isRunning(runs.get(a.id)) || user || s.status')
s=s.replace('    office.state(e.state);','    syncOffice();')
s=s.replace('  if (e.type === "state" && e.state)', '  if (e.type === "run" && e.run) {\n    const old = runs.get(e.run.agentId);\n    runs.set(e.run.agentId, e.run);\n    if (e.run.message !== old?.message) record(e.run.agentId, e.run.message);\n    if (workAgent === e.run.agentId) {\n      const index = historyRuns.findIndex(r => r.id === e.run!.id);\n      if (index >= 0) historyRuns[index] = e.run;\n      else { historyRuns.unshift(e.run); viewedRun = e.run.id; }\n    }\n    refresh();\n  } else if (e.type === "runtimeWarning") showError(e.message);\n  else if (e.type === "state" && e.state)',1)
s=s.replace('$("#stop-demo").onclick = () => run(() => command("stopDemo"));','$("#stop-demo").onclick = () => run(() => command(isRunning(runs.get(focused!)) ? "stopTask" : "stopDemo"));')
s=s.replace('    name,\n    role:', '    name,\n    provider: values.get("provider") === "claude" ? "claude" : "codex",\n    role:')
s=s.replace('  const result = await command("notes");','  const result = await command("notes");\n  $("#notes-title").textContent = "Practice notes";')
s=s.replace('      ? saved','      ? saved.map(a => ({ ...a, provider: a.provider === "claude" ? "claude" as const : "codex" as const }))')
s=s.replace('            name: "Ada",','            name: "Ada",\n            provider: "codex",')
s=s.replace('task: "Read a reference about thoughtful workspaces and save the key ideas."','task: "Read https://example.com and save a short summary with the source URL."')
s=s.replace('    await command("hello");','    const hello = await command("hello");\n    for (const r of hello.runs || []) runs.set(r.agentId, r);')
s=s.replace('    persist();\n  } catch (e) {\n    $("#connection")', '    persist();\n    refresh();\n    void checkProviders();\n  } catch (e) {\n    $("#connection")')
s=s.replace('void start();', '''function displayProvider(a: Agent): Provider {
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
async function openWork(agentId: string) {
  workAgent = agentId;
  historyRuns = await command("runHistory", agentId);
  viewedRun = historyRuns[0]?.id || "";
  refreshWork();
  $<HTMLDialogElement>("#work-dialog").showModal();
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
  $("#work-message").textContent = r?.message || "Add a task brief and start from the office.";
  const active = isRunning(r), latest = runs.get(workAgent)?.id === r?.id;
  $("#pause-task").hidden = !active || !latest;
  $("#stop-task").hidden = !active || !latest;
  for (const id of ["pause-task", "stop-task"]) $<HTMLButtonElement>("#" + id).disabled = r?.status === "pausing" || r?.status === "stopping";
  $("#resume-task").hidden = !r || active || r.status === "review";
  $<HTMLButtonElement>("#resume-task").disabled = !canStart(agent);
  $<HTMLButtonElement>("#revise-task").disabled = !r || !canStart(agent) || !$<HTMLTextAreaElement>("#followup").value.trim();
  $("#revision-provider").textContent = `Next run uses ${PROVIDERS[agent.provider].name}. ${r && r.provider !== agent.provider ? "A new session will receive the previous result." : "The saved session continues, with a fresh look at the browser."}`;
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
  const events = $("#run-events"); events.replaceChildren();
  for (const event of r?.events.slice(-30) || []) addText(events, "li", `${new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · ${event.message}`);
  $("#run-text").textContent = r?.text || "No response yet.";
}
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
void start();''')
p.write_text(s)
