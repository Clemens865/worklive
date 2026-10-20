// Inbox: everything that is waiting for the user, in one place (PRD §5 "Review inbox").
// Blocking items (questions, stopped or failed work) are separated from finished results awaiting review.
import { PROVIDERS, type Agent, type RunState } from "./types";

type Group = "question" | "attention" | "review";
interface Item { group: Group; agent: Agent; run: RunState; label: string; detail: string }
const ATTENTION: Partial<Record<RunState["status"], string>> = { paused: "Paused", interrupted: "Interrupted", limited: "Limit reached", error: "Needs attention" };
const HEADINGS: Record<Group, [string, string]> = {
  question: ["Questions", "An agent needs an answer to continue."],
  attention: ["Blocked work", "Stopped, failed or limited tasks. Resume, revise or read what was saved."],
  review: ["Ready for review", "Finished results. Accepting one frees the agent and makes it available for handoffs."],
};
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text = "", cls = "") => { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; };
const ago = (at: number) => { const m = Math.round((Date.now() - at) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(at).toLocaleDateString(); };

export function createInbox(o: { agents: () => Agent[]; runs: () => RunState[]; accepted: (runId: string) => boolean; openWork: (agentId: string, runId: string) => Promise<void> | void }) {
  document.body.insertAdjacentHTML("beforeend", `<dialog id="inbox-dialog" aria-labelledby="inbox-title"><div class="dialog-heading"><div><span class="eyebrow">WAITING FOR YOU</span><h2 id="inbox-title">Inbox</h2></div><button id="inbox-close" class="icon-button" aria-label="Close inbox">×</button></div><div id="inbox-list"></div></dialog>`);
  const dialog = document.getElementById("inbox-dialog") as HTMLDialogElement, list = document.getElementById("inbox-list")!;
  function items(): Item[] {
    const out: Item[] = [];
    for (const run of o.runs()) {
      const agent = o.agents().find(a => a.id === run.agentId); if (!agent) continue;
      if (run.status === "waiting" && run.question) out.push({ group: "question", agent, run, label: "Has a question", detail: run.question.text });
      else if (ATTENTION[run.status]) out.push({ group: "attention", agent, run, label: ATTENTION[run.status]!, detail: run.message });
      else if (run.status === "review" && !o.accepted(run.id)) out.push({ group: "review", agent, run, label: "Ready for review", detail: run.taskTitle || run.task });
    }
    return out.sort((a, b) => (b.run.endedAt || b.run.startedAt) - (a.run.endedAt || a.run.startedAt));
  }
  function render() {
    const all = items(); list.replaceChildren();
    if (!all.length) { list.append(node("p", "Nothing is waiting for you. Questions, blocked tasks and finished results appear here.", "inbox-empty")); return; }
    for (const g of ["question", "attention", "review"] as Group[]) {
      const rows = all.filter(i => i.group === g); if (!rows.length) continue;
      const section = node("section", "", "inbox-group");
      const head = node("div", "", "inbox-head"); head.append(node("h3", `${HEADINGS[g][0]} · ${rows.length}`), node("p", HEADINGS[g][1], "fine-print"));
      section.append(head);
      for (const i of rows) {
        const row = node("button", "", `inbox-row inbox-${g}`);
        const dot = node("span", i.agent.name.slice(0, 1).toUpperCase(), "inbox-avatar"); dot.style.background = PROVIDERS[i.agent.provider].color;
        const text = node("span", "", "inbox-text");
        text.append(node("strong", `${i.agent.name} · ${i.label}`), node("small", i.detail.slice(0, 220)), node("small", `${(i.run.taskTitle || i.run.task).slice(0, 80)} · ${ago(i.run.endedAt || i.run.startedAt)}`, "inbox-meta"));
        row.append(dot, text, node("span", g === "question" ? "Answer" : g === "review" ? "Review" : "Open", "inbox-cta"));
        row.onclick = () => { dialog.close(); void o.openWork(i.agent.id, i.run.id); };
        section.append(row);
      }
      list.append(section);
    }
  }
  document.getElementById("inbox-close")!.onclick = () => dialog.close();
  return {
    /** Number of items, split so the header badge can show blocking ones prominently. */
    counts() { const all = items(); return { total: all.length, blocking: all.filter(i => i.group !== "review").length }; },
    open() { render(); document.body.append(dialog); if (!dialog.open) dialog.showModal(); },
    refresh() { if (dialog.open) render(); },
  };
}
