// The official CLI owns stdio. This process exposes only Worklive's small tool
// surface and forwards calls over a private, per-run Unix socket.
import { createInterface } from "node:readline";
import { createConnection } from "node:net";
import { TOOL_DEFINITIONS, validateTool } from "./tool-definitions.mjs";

function callHost(name, args) {
  validateTool(name, args);
  return new Promise((resolve, reject) => {
    const socket = createConnection(process.env.WORKLIVE_SOCKET);
    let buffer = "", settled = false;
    const finish = (error, value) => { if (settled) return; settled = true; socket.destroy(); error ? reject(error) : resolve(value); };
    socket.setTimeout(45000, () => finish(new Error("Worklive’s tool connection timed out.")));
    socket.on("error", () => finish(new Error("Worklive’s task connection is closed. Stop and return control to the user.")));
    socket.on("close", () => finish(new Error("Worklive stopped this task. Do not retry.")));
    socket.on("connect", () => socket.write(JSON.stringify({ token: process.env.WORKLIVE_TOKEN, name, args }) + "\n"));
    socket.setEncoding("utf8");
    socket.on("data", (data) => {
      buffer += data;
      if (buffer.length > 1000000) return finish(new Error("Tool response too large."));
      const i = buffer.indexOf("\n");
      if (i < 0) return;
      try { const result = JSON.parse(buffer.slice(0, i)); finish(result.error ? new Error(result.error) : null, result.result); }
      catch (e) { finish(e); }
    });
  });
}
const reply = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", (line) => {
  void (async () => {
    let m;
    try { m = JSON.parse(line); } catch { return; }
    if (m.id === undefined) return;
    if (m.method === "initialize") return reply(m.id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "worklive", version: "0.3.0" } });
    if (m.method === "ping") return reply(m.id, {});
    if (m.method === "tools/list") return reply(m.id, { tools: TOOL_DEFINITIONS });
    if (m.method === "resources/list") return reply(m.id, { resources: [] });
    if (m.method === "prompts/list") return reply(m.id, { prompts: [] });
    if (m.method === "tools/call") {
      try {
        const result = await callHost(m.params?.name, m.params?.arguments || {});
        return reply(m.id, { content: [{ type: "text", text: JSON.stringify(result) }] });
      } catch (e) { return reply(m.id, { isError: true, content: [{ type: "text", text: e.message }] }); }
    }
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: m.id, error: { code: -32601, message: "Method not found" } }) + "\n");
  })().catch(() => {});
});
