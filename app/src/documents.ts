// Document viewer/editor and file finder: saved results, context files and notes, and task references.
// Markdown renders formatted (sanitized, no remote images or scripts); text formats can be edited where the
// owning store allows it. Rust and the worker re-check every save (revision/hash, running work, accepted results).
import { invoke } from "@tauri-apps/api/core";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { Agent, ProjectTask, WorkflowState } from "./types";

export type DocRef =
  | { kind: "output"; runId: string; name: string; agentId: string }
  | { kind: "context"; id: string; agentId: string }
  | { kind: "task"; taskId: string; fileId: string };
interface Loaded { title: string; text: string; format: string; meta: string; editable: boolean; why: string; save?: (text: string) => Promise<void>; external?: () => Promise<unknown> }
interface Found { ref: DocRef; title: string; where: string; group: "Results" | "Context" | "Task files"; at: number }

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text = "", cls = "") => { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; };
const extOf = (name: string) => name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
const GROUPS = ["Results", "Context", "Task files"];
const when = (at: number) => at ? new Date(at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";

/** Markdown → sanitized HTML. Images are dropped (the app has no remote image access anyway), links open externally. */
export function renderMarkdown(text: string) {
  const html = marked.parse(text, { async: false, gfm: true, breaks: false }) as string;
  return DOMPurify.sanitize(html, { FORBID_TAGS: ["img", "style", "form", "input", "button", "iframe", "svg", "math"], FORBID_ATTR: ["style"] });
}
function renderCsv(text: string) {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; }
    else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
    if (rows.length > 2000) break;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const table = node("table", "", "doc-table");
  rows.filter(r => r.some(c => c.trim())).forEach((r, i) => { const tr = table.insertRow(); for (const c of r) tr.append(node(i ? "td" : "th", c)); });
  return table;
}

export function createDocuments(o: {
  agents: () => Agent[];
  command: (action: string, agentId: string | null, extra?: Record<string, unknown>) => Promise<any>;
  workflow: () => WorkflowState | null;
  accepted: (runId: string) => boolean;
  busy: () => boolean; // a task is running: shared context and references are locked
  changed: () => void;
  error: (e: unknown) => void;
}) {
  document.body.insertAdjacentHTML("beforeend", `<dialog id="doc-dialog" aria-labelledby="doc-title"><div class="dialog-heading"><div><span class="eyebrow" id="doc-where"></span><h2 id="doc-title"></h2></div><div class="doc-actions"><div class="doc-toggle" role="group" aria-label="Display"><button data-mode="formatted" aria-pressed="true">Formatted</button><button data-mode="source" aria-pressed="false">Source</button></div><button id="doc-edit" class="secondary">Edit</button><button id="doc-external" class="quiet" title="Open this file in the app macOS uses for it">Open in default app</button><button id="doc-close" class="icon-button" aria-label="Close document">×</button></div></div><p id="doc-meta" class="fine-print"></p><div id="doc-body" class="doc-body"></div><div id="doc-editbar" class="doc-editbar" hidden><p id="doc-edit-note" class="fine-print"></p><div class="button-row"><button id="doc-cancel" class="secondary">Cancel</button><button id="doc-save" class="primary">Save</button></div></div></dialog>
  <dialog id="finder-dialog" aria-label="Find a file"><div class="finder-search"><input id="finder-input" type="search" placeholder="Find results, context and task files…" autocomplete="off" spellcheck="false" aria-controls="finder-list"><kbd>esc</kbd></div><div id="finder-list" role="listbox" aria-label="Files"></div><p id="finder-foot" class="fine-print"></p></dialog>`);
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const dialog = $<HTMLDialogElement>("doc-dialog"), body = $("doc-body");
  let doc: Loaded | null = null, current: DocRef | null = null, mode: "formatted" | "source" = "formatted", editing = false, saving = false, token = 0;
  const safe = (f: () => Promise<unknown>) => void f().catch(o.error);
  const agentName = (id: string) => o.agents().find(a => a.id === id)?.name || "Former agent";
  const dirty = () => editing && !!doc && body.querySelector("textarea")?.value !== doc.text;

  async function load(ref: DocRef): Promise<Loaded> {
    if (ref.kind === "output") {
      const f = await o.command("artifact", ref.agentId, { runId: ref.runId, name: ref.name });
      const run = (await o.command("runHistory", ref.agentId) as { id: string; status: string; taskTitle?: string; task: string }[]).find(r => r.id === ref.runId);
      const working = !!run && ["starting", "running", "pausing", "stopping"].includes(run.status), accepted = o.accepted(ref.runId);
      return {
        title: f.name, text: f.content, format: extOf(f.name),
        meta: `${agentName(ref.agentId)}’s result · ${run?.taskTitle || run?.task?.slice(0, 80) || "task"} · saved ${when(f.editedAt || f.at)}${f.edits ? ` · edited by you ${f.edits}×` : ""}${f.unchanged ? "" : " · changed outside Worklive"}`,
        editable: !working && !accepted && f.unchanged,
        why: working ? "Pause or stop the task to edit its result." : accepted ? "Accepted results stay as reviewed. Reopen the review to edit." : !f.unchanged ? "This file was changed outside Worklive. Ask for a revised result instead." : "",
        save: async text => { await o.command("saveArtifact", ref.agentId, { runId: ref.runId, name: ref.name, content: text, baseHash: f.currentHash }); },
        external: () => invoke("open_artifact", { runId: ref.runId, name: ref.name }),
      };
    }
    if (ref.kind === "context") {
      const d = await invoke<any>("knowledge_command", { command: { action: "document", agentId: ref.agentId, id: ref.id } });
      const e = d.entry, note = e.kind === "note";
      const scope = e.scope === "company" ? "Company knowledge" : e.scope === "project" ? "Project context" : `${agentName(ref.agentId)} · personal`;
      return {
        title: e.title, text: d.text, format: note ? "md" : d.format, meta: `${scope} · version ${e.revision} · ${e.author || "You"} · ${when(e.updatedAt)}${e.warning ? " · " + e.warning : ""}`,
        editable: (note || d.editable) && !o.busy(),
        why: o.busy() ? "Pause running tasks before changing shared context." : note || d.editable ? "" : "Only the extracted text of PDF and Word files is kept, so they are read-only here.",
        save: async text => {
          if (note) await invoke("knowledge_command", { command: { action: "editNote", agentId: ref.agentId, id: e.id, revision: e.revision, title: e.title, content: text, source: e.source, pinned: e.pinned } });
          else await invoke("knowledge_command", { command: { action: "editFile", agentId: ref.agentId, id: e.id, revision: e.revision, content: text } });
        },
      };
    }
    const task = o.workflow()?.tasks.find(t => t.id === ref.taskId);
    const d = await invoke<any>("task_file_command", { command: { action: "document", taskId: ref.taskId, fileId: ref.fileId } });
    const started = !!task?.runId;
    return {
      title: d.entry.title, text: d.text, format: d.format, meta: `Task file · ${task?.title || "task"} · version ${d.entry.revision} · ${when(d.entry.updatedAt)}`,
      editable: d.editable && !started && !o.busy(),
      why: started ? "References stay fixed once the task has started." : o.busy() ? "Pause running work before changing references." : d.editable ? "" : "Only the extracted text of PDF and Word files is kept, so they are read-only here.",
      save: async text => { await invoke("task_file_command", { command: { action: "edit", taskId: ref.taskId, fileId: ref.fileId, revision: task?.revision ?? -1, fileRevision: d.entry.revision, content: text } }); },
    };
  }
  function paint() {
    if (!doc) return;
    $("doc-title").textContent = doc.title;
    $("doc-meta").textContent = doc.meta;
    const formattable = ["md", "csv", "json"].includes(doc.format);
    $("doc-dialog").querySelector<HTMLElement>(".doc-toggle")!.hidden = !formattable || editing;
    dialog.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    const edit = $<HTMLButtonElement>("doc-edit");
    edit.hidden = editing; edit.disabled = !doc.editable; edit.title = doc.why || "Edit this document";
    $("doc-external").hidden = !doc.external || editing;
    $("doc-editbar").hidden = !editing;
    $<HTMLButtonElement>("doc-save").disabled = saving;
    $("doc-edit-note").textContent = current?.kind === "output" ? "Saving keeps the previous text as a version. Review and handoffs then use your edit." : "Saving creates a new version. Agents use it from their next task.";
    body.replaceChildren();
    body.className = "doc-body";
    if (editing) {
      const area = node("textarea", "", "doc-editor"); area.value = doc.text; area.spellcheck = doc.format === "md" || doc.format === "txt"; area.setAttribute("aria-label", "Document text");
      body.append(area); area.focus(); return;
    }
    if (doc.why && !doc.editable) body.append(node("p", doc.why, "doc-hint"));
    if (mode === "formatted" && doc.format === "md") { const md = node("article", "", "doc-markdown"); md.innerHTML = renderMarkdown(doc.text); body.append(md); }
    else if (mode === "formatted" && doc.format === "csv") body.append(renderCsv(doc.text));
    else if (mode === "formatted" && doc.format === "json") { let t = doc.text; try { t = JSON.stringify(JSON.parse(doc.text), null, 2); } catch { /* show as saved */ } body.append(node("pre", t, "doc-source")); }
    else body.append(node("pre", doc.text, "doc-source"));
  }
  async function open(ref: DocRef) {
    const mine = ++token; current = ref; editing = false; doc = null;
    $("doc-where").textContent = ref.kind === "output" ? "RESULT" : ref.kind === "task" ? "TASK FILE" : "CONTEXT";
    $("doc-title").textContent = "Loading…"; $("doc-meta").textContent = ""; body.replaceChildren();
    document.body.append(dialog); if (!dialog.open) dialog.showModal();
    const loaded = await load(ref); if (mine !== token) return;
    doc = loaded; mode = "formatted"; paint();
  }
  async function save() {
    if (!doc?.save || !current || saving) return;
    const text = body.querySelector("textarea")!.value;
    if (text === doc.text) { editing = false; paint(); return; }
    saving = true; paint();
    try { await doc.save(text); editing = false; o.changed(); doc = await load(current); }
    finally { saving = false; paint(); }
  }
  const close = () => { if (dirty() && !confirm("Discard your unsaved changes?")) return; editing = false; dialog.close(); };
  dialog.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach(b => b.onclick = () => { mode = b.dataset.mode as typeof mode; paint(); });
  $("doc-edit").onclick = () => { if (doc?.editable) { editing = true; paint(); } };
  $("doc-cancel").onclick = () => { if (dirty() && !confirm("Discard your unsaved changes?")) return; editing = false; paint(); };
  $("doc-save").onclick = () => safe(save);
  $("doc-external").onclick = () => safe(async () => doc?.external?.());
  $("doc-close").onclick = close;
  dialog.oncancel = e => { e.preventDefault(); close(); };
  dialog.addEventListener("keydown", e => { if (editing && (e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); safe(save); } });
  body.addEventListener("click", e => {
    const a = (e.target as HTMLElement).closest("a"); if (!a) return;
    e.preventDefault(); const href = a.getAttribute("href") || "";
    if (/^https?:\/\//i.test(href)) safe(() => invoke("open_link", { url: href }));
  });

  // ---------- File finder ----------
  const finder = $<HTMLDialogElement>("finder-dialog"), input = $<HTMLInputElement>("finder-input"), list = $("finder-list");
  let items: Found[] = [], shown: Found[] = [], active = 0;
  async function collect() {
    const found: Found[] = [];
    const outputs: any[] = await o.command("documents", null).catch(() => []);
    for (const d of outputs) found.push({ ref: { kind: "output", runId: d.runId, name: d.name, agentId: d.agentId }, title: d.name, where: `${agentName(d.agentId)} · ${String(d.task).slice(0, 70)}${d.kind === "reply" ? " · reply" : ""}`, group: "Results", at: d.at });
    const seen = new Set<string>();
    for (const viewer of [...o.agents().map(a => a.id), "owner"]) {
      const listing = await invoke<any>("knowledge_command", { command: { action: "list", agentId: viewer } }).catch(() => null);
      for (const e of listing?.entries || []) {
        if (seen.has(e.id) || e.scope === "task") continue; seen.add(e.id);
        const project = listing.projects.find((p: { id: string }) => p.id === e.scopeId)?.name;
        const where = e.scope === "company" ? "Company knowledge" : e.scope === "project" ? `Project · ${project || "project"}` : `${agentName(viewer)} · personal`;
        found.push({ ref: { kind: "context", id: e.id, agentId: viewer }, title: e.title, where: `${where}${e.kind === "note" ? " · note" : ""}`, group: "Context", at: e.updatedAt });
      }
    }
    for (const t of (o.workflow()?.tasks || []) as ProjectTask[]) for (const f of t.files || [])
      found.push({ ref: { kind: "task", taskId: t.id, fileId: f.id }, title: f.title, where: `${t.title} · ${agentName(t.agentId)}`, group: "Task files", at: f.createdAt });
    return found;
  }
  function score(f: Found, q: string) {
    if (!q) return 1;
    const name = f.title.toLowerCase(), all = (name + " " + f.where).toLowerCase();
    if (name.startsWith(q)) return 4; if (name.includes(q)) return 3;
    if (q.split(/\s+/).every(w => all.includes(w))) return 2;
    let i = 0; for (const c of name) if (c === q[i]) i++; return i === q.length ? 1 : 0; // letters in order
  }
  function paintFinder() {
    const q = input.value.trim().toLowerCase();
    shown = items.map(f => ({ f, s: score(f, q) })).filter(x => x.s > 0).sort((a, b) => q ? b.s - a.s || b.f.at - a.f.at : GROUPS.indexOf(a.f.group) - GROUPS.indexOf(b.f.group) || b.f.at - a.f.at).map(x => x.f).slice(0, 60);
    active = Math.min(active, Math.max(0, shown.length - 1));
    list.replaceChildren();
    let group = "";
    shown.forEach((f, i) => {
      if (!q && f.group !== group) { group = f.group; list.append(node("p", group, "finder-group")); }
      const row = node("button", "", "finder-row"); row.setAttribute("role", "option"); row.setAttribute("aria-selected", String(i === active));
      const icon = node("span", f.ref.kind === "context" && f.where.endsWith("note") ? "NOTE" : extOf(f.title).toUpperCase().slice(0, 4) || "DOC", "finder-ext");
      const text = node("span", "", "finder-text"); text.append(node("strong", f.title), node("small", f.where));
      row.append(icon, text, node("small", when(f.at), "finder-when"));
      row.onclick = () => choose(f); row.onmousemove = () => { if (active !== i) { active = i; mark(); } };
      list.append(row);
    });
    if (!shown.length) list.append(node("p", items.length ? "No files match." : "No files yet. Results, context files and task references appear here.", "finder-empty"));
    $("finder-foot").textContent = `${shown.length} of ${items.length} · ↑↓ to move · Enter to open`;
  }
  function mark() { list.querySelectorAll(".finder-row").forEach((r, i) => r.setAttribute("aria-selected", String(i === active))); list.querySelectorAll(".finder-row")[active]?.scrollIntoView({ block: "nearest" }); }
  function choose(f: Found) { finder.close(); safe(() => open(f.ref)); }
  input.oninput = () => { active = 0; paintFinder(); };
  input.onkeydown = e => {
    if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(shown.length - 1, active + 1); mark(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(0, active - 1); mark(); }
    else if (e.key === "Enter" && shown[active]) { e.preventDefault(); choose(shown[active]); }
  };
  finder.onclick = e => { if (e.target === finder) finder.close(); };
  async function find() {
    input.value = ""; active = 0; items = []; list.replaceChildren(node("p", "Looking through your files…", "finder-empty"));
    document.body.append(finder); if (!finder.open) finder.showModal(); input.focus();
    items = await collect(); paintFinder();
  }
  addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === "p" || e.key === "k")) { e.preventDefault(); if (!dialog.open || !editing) safe(find); }
  });
  // Other panels (context drawer, task files) open documents without a direct reference to this module.
  addEventListener("worklive:open-document", e => { const ref = (e as CustomEvent<DocRef>).detail; if (ref) safe(() => open(ref)); });
  return { open: (ref: DocRef) => safe(() => open(ref)), find: () => safe(find) };
}
