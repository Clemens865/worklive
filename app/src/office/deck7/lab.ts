import "../../style.css";
import "./theme.css";
document.body.classList.add("ws-deck7");
import type { Agent } from "../../types";
import { createDeckOffice } from "./office";

// Dev-only harness: the same calls main.ts makes (setAgents, state, frame, say, subagents, views),
// fed with fake data so Deck 7 can be checked without the Tauri backend.

document.body.innerHTML = `<div style="position:fixed;inset:0;display:flex;flex-direction:column;background:#ebe9e4;font:13px -apple-system,system-ui,sans-serif">
  <div style="display:flex;gap:8px;padding:10px 14px;align-items:center;flex-wrap:wrap">
    <b>Deck 7 lab</b><button id="hire">Hire (fresh)</button><button id="day">Random states</button><button id="coffee">Coffee break</button>
    <button data-v="office">Office</button><button data-v="team">Team</button><button data-v="follow">Follow</button><button data-v="eyes">Eyes</button>
    <span id="moment" style="color:#555"></span></div>
  <div id="scene" style="position:relative;flex:1;margin:0 14px 14px;border-radius:16px;overflow:hidden"></div></div>`;
const names = ["Ada", "Milo", "Olivia", "Mike", "Lena", "Noor", "Theo", "Ivy", "Sam", "Juno"];
const agents: Agent[] = names.slice(0, 7).map((n, i) => ({ id: "a" + i, name: n, role: ["Researcher", "Engineer", "Writer", "Analyst"][i % 4], personality: "", task: "", color: "", provider: i % 2 ? "claude" : "codex", desk: i }));
const office = createDeckOffice(document.getElementById("scene")!, id => office.select(id), id => alert("open browser of " + id), m => (document.getElementById("moment")!.textContent = (m.speaker ? m.speaker + ": " : "") + m.text));
office.setAgents(agents);
const STATES = ["idle", "loading", "working", "working", "working", "paused", "complete", "error", "review", "needs"] as const;
const set = (id: string, s: (typeof STATES)[number]) => office.state({ agentId: id, status: s as never, owner: s === "paused" ? "user" : "agent", reason: s === "needs" ? (Math.random() < 0.5 ? "usage limit reached" : "question for you") : undefined } as never);
agents.forEach((a, i) => set(a.id, STATES[(i * 3) % STATES.length]));
document.getElementById("day")!.onclick = () => agents.forEach(a => set(a.id, STATES[Math.floor(Math.random() * STATES.length)]));
document.getElementById("hire")!.onclick = () => {
  const i = agents.length;
  agents.push({ id: "a" + i, name: names[i % names.length] + (i >= names.length ? i : ""), role: "Intern", personality: "", task: "", color: "", provider: i % 2 ? "claude" : "codex", fresh: true });
  office.setAgents(agents.map(a => ({ ...a })));
  agents.forEach(a => (a.fresh = false));
};
document.getElementById("coffee")!.onclick = () => office.coffeeBreak();
document.querySelectorAll<HTMLButtonElement>("[data-v]").forEach(b => (b.onclick = () => office.view(b.dataset.v as never, "a2")));
office.subagents("a2", 2);
// fake live browser frames for the working agents (what the worker streams: 1024 × 640 images)
setInterval(() => {
  for (const a of agents) {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 640;
    const g = c.getContext("2d")!;
    g.fillStyle = "#fff"; g.fillRect(0, 0, 1024, 640);
    g.fillStyle = "#1a73e8"; g.fillRect(0, 0, 1024, 70);
    g.fillStyle = "#fff"; g.font = "700 34px sans-serif"; g.fillText("example.com/" + a.name.toLowerCase(), 24, 48);
    g.fillStyle = "#222"; g.font = "700 44px sans-serif"; g.fillText("Quarterly pricing research", 40, 150);
    g.fillStyle = "#666"; g.font = "26px sans-serif";
    for (let l = 0; l < 9; l++) g.fillText("Lorem ipsum dolor sit amet, line " + (l + 1) + " · " + new Date().toLocaleTimeString(), 40, 210 + l * 44);
    const img = new Image();
    img.onload = () => office.frame(a.id, img);
    img.src = c.toDataURL("image/jpeg", 0.7);
  }
}, 1500);
setTimeout(() => office.say("a1", "Chat reply: I found three sources, boss."), 3000);
(window as unknown as { office: typeof office }).office = office;
