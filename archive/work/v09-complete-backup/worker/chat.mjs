// Chat with an agent: a short conversation through the agent's own official CLI (subscription login,
// no tools, no MCP servers). Each chat is saved locally per agent; the last messages travel with every prompt,
// so no CLI session state is needed and both providers behave the same.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const KEEP = 60, CONTEXT = 12, MAX_IN = 2000, MAX_OUT = 4000;
const clip = (s, n) => String(s || "").replace(/\s+$/g, "").slice(0, n);
const idOk = (id) => /^[\w-]{1,64}$/.test(String(id || ""));

export function chatPrompt(agent, messages) {
  const who = [
    `You are ${clip(agent.name, 40) || "an agent"}, an AI teammate in Worklive, a small visual office on the user's Mac.`,
    agent.role && `Your role: ${clip(agent.role, 60)}.`,
    agent.personality && `Your personality: ${clip(agent.personality, 500)}`,
    agent.task && `Your current task brief: ${clip(agent.task, 1000)}`,
    agent.status && `Your current status: ${clip(agent.status, 300)}`,
  ].filter(Boolean).join("\n");
  const rules = "This is a casual chat with your user, not a task run. Answer in character, briefly and helpfully (usually 1–4 sentences). " +
    "You have no tools here: you cannot browse, read files, or start work. If the user wants real work done, suggest they write it as the task brief and press Start task. " +
    "Never invent results you have not produced.";
  const lines = messages.slice(-CONTEXT).map((m) => `${m.from === "user" ? "User" : clip(agent.name, 40) || "You"}: ${clip(m.text, MAX_IN)}`);
  return `${who}\n\n${rules}\n\nConversation so far:\n${lines.join("\n")}\n\nReply as ${clip(agent.name, 40) || "the agent"} with only your message text.`;
}

export class Chats {
  constructor(dir, { ask, ready, emit }) { this.dir = join(dir, "chats"); this.ask = ask; this.ready = ready; this.emit = emit; this.busy = new Set(); }
  file(id) { if (!idOk(id)) throw new Error("Unknown agent."); return join(this.dir, id + ".json"); }
  async load(id) {
    try { const saved = JSON.parse(await readFile(this.file(id), "utf8")); return Array.isArray(saved.messages) ? saved.messages : []; }
    catch (e) { if (e.message === "Unknown agent.") throw e; return []; }
  }
  async save(id, messages) {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    await writeFile(this.file(id), JSON.stringify({ messages: messages.slice(-KEEP) }), { mode: 0o600 });
  }
  async history(id) { return { messages: await this.load(id), pending: this.busy.has(id) }; }
  async clear(id) { if (this.busy.has(id)) throw new Error("Wait for the reply first."); await this.save(id, []); return this.history(id); }
  /** Saves the user's message, returns at once, and answers later with a `chat` event. */
  async send(agent, text) {
    const id = agent?.id, message = clip(String(text || "").trim(), MAX_IN);
    if (!message) throw new Error("Write a message first.");
    if (!["codex", "claude"].includes(agent.provider)) throw new Error("Unknown provider.");
    if (this.busy.has(id)) throw new Error(`${clip(agent.name, 40)} is still answering.`);
    this.busy.add(id); // claimed before any await, so two quick sends cannot both pass
    let messages;
    try {
      messages = await this.load(id);
      messages.push({ from: "user", text: message, at: Date.now() });
      await this.save(id, messages);
    } catch (e) { this.busy.delete(id); throw e; }
    this.answer(agent, messages);
    return { messages, pending: true };
  }
  async answer(agent, messages) {
    const id = agent.id;
    let reply;
    try {
      if (!(await this.ready(agent.provider))) throw new Error(`Sign in to ${agent.provider === "codex" ? "Codex" : "Claude Code"} with your subscription to chat.`);
      reply = { from: "agent", text: clip(String(await this.ask(agent.provider, chatPrompt(agent, messages))).trim(), MAX_OUT) || "…", at: Date.now() };
    } catch (e) {
      reply = { from: "system", text: String(e?.message || e).slice(0, 300), at: Date.now() };
    }
    const all = await this.load(id).catch(() => messages);
    all.push(reply);
    await this.save(id, all).catch(() => {});
    this.busy.delete(id);
    this.emit({ type: "chat", agentId: id, chat: { messages: all.slice(-KEEP), pending: false }, reply });
  }
}
