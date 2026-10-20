import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Chats, chatPrompt } from "./chat.mjs";

const ada = { id: "agent-1", name: "Ada", role: "Researcher", personality: "Curious.", task: "Read about desks.", status: "Free", provider: "claude" };

test("chat prompt: persona, no-tools rule, recent messages only", () => {
  const messages = Array.from({ length: 20 }, (_, i) => ({ from: i % 2 ? "agent" : "user", text: "m" + i }));
  const prompt = chatPrompt(ada, messages);
  assert.match(prompt, /You are Ada/);
  assert.match(prompt, /Your role: Researcher/);
  assert.match(prompt, /no tools/);
  assert.match(prompt, /User: m18/);
  assert.match(prompt, /Ada: m19/);
  assert.doesNotMatch(prompt, /: m7\n/);
});

test("chat: saves, answers through the CLI later, one message at a time per agent", async () => {
  const dir = await mkdtemp(join(tmpdir(), "worklive-chat-"));
  const events = [];
  let release;
  const chats = new Chats(dir, { ready: async () => true, emit: (e) => events.push(e), ask: () => new Promise((r) => { release = r; }) });
  const sent = await chats.send(ada, "  Hi Ada  ");
  assert.equal(sent.pending, true);
  assert.equal(sent.messages.at(-1).text, "Hi Ada");
  await assert.rejects(chats.send(ada, "again"), /still answering/);
  await assert.rejects(chats.send(ada, "   "), /Write a message/);
  release("Hello! ");
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "chat");
  assert.equal(events[0].reply.text, "Hello!");
  const saved = JSON.parse(await readFile(join(dir, "chats", "agent-1.json"), "utf8"));
  assert.deepEqual(saved.messages.map((m) => m.from), ["user", "agent"]);
  assert.deepEqual((await chats.clear("agent-1")).messages, []);
  await assert.rejects(chats.history("../etc"), /Unknown agent/);
});

test("chat: a missing subscription becomes a visible system message", async () => {
  const dir = await mkdtemp(join(tmpdir(), "worklive-chat-"));
  const events = [];
  const chats = new Chats(dir, { ready: async () => false, emit: (e) => events.push(e), ask: async () => assert.fail("must not call the CLI") });
  await chats.send({ ...ada, provider: "codex" }, "Hi");
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(events[0].reply.from, "system");
  assert.match(events[0].reply.text, /Sign in to Codex/);
  assert.equal((await chats.history("agent-1")).pending, false);
});

test("chat: two quick sends cannot both pass the busy check (no lost message)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "worklive-chat-"));
  const chats = new Chats(dir, { ready: async () => true, emit: () => {}, ask: () => new Promise(() => {}) });
  const [a, b] = await Promise.allSettled([chats.send(ada, "one"), chats.send(ada, "two")]);
  assert.equal(a.status, "fulfilled");
  assert.equal(b.status, "rejected");
  assert.deepEqual((await chats.history("agent-1")).messages.map((m) => m.text), ["one"]);
});
