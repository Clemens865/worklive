import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";

// Simulated Tauri backend for dev testing (mock.html). Answers the commands main.ts sends and pushes
// worker events (state, frame, run, chat) through the start_browser channel. Never used by the app bundle.

type Any = Record<string, any>;
let agents: Any[] = [
  { id: "ada", name: "Ada", role: "Researcher", personality: "Curious", task: "Find the latest news", color: "", provider: "claude", desk: 0, lookSeed: "a" },
  { id: "milo", name: "Milo", role: "Engineer", personality: "Calm", task: "", color: "", provider: "codex", desk: 1, lookSeed: "m" },
  { id: "lena", name: "Lena", role: "Analyst", personality: "Precise", task: "Check pricing", color: "", provider: "codex", desk: 2, lookSeed: "l" },
];
try { const seeded = localStorage.getItem("mock.agents"); if (seeded) agents = JSON.parse(seeded); } catch { /* keep defaults */ }
const states = new Map<string, Any>();
const chats = new Map<string, Any[]>();
const runs = new Map<string, Any>();
const calls: string[] = [];
let channelId = -1, index = 0;
const emit = (message: Any) => (window as any).__TAURI_INTERNALS__.runCallback(channelId, { index: index++, message });
const state = (id: string, patch: Any = {}) => {
  const s = { agentId: id, owner: "agent", status: "idle", url: "https://example.com", title: "Example", step: 0, message: "", hasRun: false, ...(states.get(id) || {}), ...patch };
  states.set(id, s);
  emit({ type: "state", state: s });
};
function frame(id: string) {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 640;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff"; g.fillRect(0, 0, 1024, 640);
  g.fillStyle = "#1a73e8"; g.fillRect(0, 0, 1024, 70);
  g.fillStyle = "#fff"; g.font = "700 32px sans-serif"; g.fillText("example.com · " + id + " · " + (states.get(id)?.owner || ""), 24, 46);
  g.fillStyle = "#222"; g.font = "28px sans-serif"; g.fillText(new Date().toLocaleTimeString(), 40, 150);
  emit({ type: "frame", agentId: id, image: c.toDataURL("image/jpeg", 0.6).split(",")[1], seq: Date.now() });
}
const live = new Set<string>();
setInterval(() => live.forEach(frame), 1200);

mockIPC((cmd, args: Any = {}) => {
  calls.push(cmd + (cmd === "browser_command" ? ":" + args.command.action : ""));
  if (cmd === "get_workspace") return localStorage.getItem("worklive.workspace") === "deck7" ? "deck7" : "studio";
  if (cmd === "set_workspace") { localStorage.setItem("worklive.workspace", args.workspace); setTimeout(() => location.reload(), 50); return null; }
  if (cmd === "load_agents") return agents;
  if (cmd === "save_agents") { agents = args.agents; return null; }
  if (cmd === "start_browser") {
    channelId = args.onEvent.id;
    setTimeout(() => agents.forEach(a => state(a.id)), 50);
    return null;
  }
  if (cmd === "knowledge_command" || cmd === "task_file_command") return { items: [], projects: [], handoffs: [], tasks: [], files: [], entries: [], accepted: [] };
  if (cmd !== "browser_command") return null;
  const { action, agentId: id } = args.command;
  switch (action) {
    case "hello": return { runs: [...runs.values()] };
    case "workflow": return { reviews: [], handoffs: [], projects: [], tasks: [], assignments: {}, acceptedMilestones: 0, busy: false };
    case "providers": return [{ provider: "codex", status: "ready", detail: "mock" }, { provider: "claude", status: "ready", detail: "mock" }];
    case "ensure": if (!states.has(id)) state(id); live.add(id); frame(id); return null;
    case "focus": return null;
    case "takeControl": state(id, { owner: "user" }); return null;
    case "returnControl": state(id, { owner: "agent" }); return null;
    case "click": case "scroll": case "key": case "text": case "navigate": case "back": case "forward": case "reload": case "home": return null;
    case "runHistory": return [...runs.values()].filter(r => r.agentId === id);
    case "chatHistory": return { messages: chats.get(id) || [], pending: false };
    case "chatClear": chats.set(id, []); return { messages: [], pending: false };
    case "chatSend": {
      const list = [...(chats.get(id) || []), { from: "user", text: args.command.text }];
      chats.set(id, list);
      setTimeout(() => { const reply = { from: "agent", text: "On it. (mock reply to: " + args.command.text + ")" }; list.push(reply); emit({ type: "chat", agentId: id, chat: { messages: list, pending: false }, reply }); }, 600);
      return { messages: list, pending: true };
    }
    case "suggest": return { text: "Rivet" };
    case "notes": return "";
    case "startTask": {
      const run = { id: "run-" + Date.now(), agentId: id, provider: agents.find(a => a.id === id)?.provider, task: "mock", status: "running", message: "Working…", text: "", startedAt: Date.now(), endedAt: null, sessionId: null, model: null, version: null, events: [], artifacts: [], sources: [], actions: 0 };
      runs.set(id, run); emit({ type: "run", run }); state(id, { status: "working", hasRun: true }); live.add(id);
      setTimeout(() => { const done = { ...run, status: "review", message: "Done", endedAt: Date.now() }; runs.set(id, done); emit({ type: "run", run: done }); state(id, { status: "complete" }); }, 8000);
      return run;
    }
    case "stopTask": case "pauseTask": case "runDemo": case "stopDemo": return null;
    default: return null;
  }
});
mockWindows("main");
(window as any).__mock = { agents: () => agents, states, calls, emit, state };
await import("../main.ts");
