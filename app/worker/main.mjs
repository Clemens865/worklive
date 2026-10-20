import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { createInterface } from "node:readline";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ControlLane } from "./control.mjs";
import { randomUUID } from "node:crypto";
import { AgentRuntime } from "./agent-runtime.mjs";
import { suggest, inspectProvider, askCli } from "./providers.mjs";
import { Chats } from "./chat.mjs";
import { publicProxy, publicUrl } from "./public-network.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const data = process.argv[2];
const agents = new Map();
const knowledgeRequests = new Map();
function knowledge(request) {
  return new Promise((resolve,reject)=>{
    const requestId=randomUUID();
    const timer=setTimeout(()=>{knowledgeRequests.delete(requestId);reject(new Error("Local knowledge did not respond. Stop and retry the task."));},12000);
    knowledgeRequests.set(requestId,{resolve,reject,timer});
    emit({type:"knowledge",requestId,request});
  });
}
let browser,
  browserStarting,
  focused = null,
  closing = false,
  backpressure = false;
function emit(value) {
  if (value.type === "frame" && backpressure) return;
  const ok = process.stdout.write(JSON.stringify(value) + "\n");
  if (!ok) {
    backpressure = true;
    process.stdout.once("drain", () => {
      backpressure = false;
    });
  }
}
const practice = await readFile(join(root, "practice.html"));
const server = createServer((req, res) => {
  if (req.url !== "/" && req.url !== "/practice") {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(practice);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const practiceURL = "http://127.0.0.1:" + server.address().port + "/practice";
const proxy = await publicProxy();
function idOf(id) {
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(id))
    throw new Error("Invalid agent identity");
  return id;
}
function validUrl(value) {
  const u = new URL(value);
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
    throw new Error(
      "Use an http or https address without embedded credentials.",
    );
  return u.href;
}
function state(a) {
  return {
    agentId: a.id,
    owner: a.lane.owner,
    status: a.status,
    url: a.page?.url() || "",
    title: a.title || "",
    step: a.step,
    message: a.message,
    hasRun: a.hasRun,
    parked: !!a.parked,
  };
}
function publish(a) {
  emit({ type: "state", agentId: a.id, state: state(a) });
}
function activity(a, message) {
  a.message = message;
  emit({ type: "activity", agentId: a.id, message });
  publish(a);
}
async function startBrowser() {
  if (browser) return browser;
  if (browserStarting) return browserStarting;
  browserStarting = (async () => {
    const executable = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    ].find(existsSync);
    if (!executable)
      throw new Error(
        "Install Google Chrome, Chromium, or Brave to run Worklive’s browser.",
      );
    browser = await chromium.launch({
      executablePath: executable,
      headless: true,
      proxy: { server: proxy.url, bypass: "127.0.0.1" },
      args: [
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
      ],
    });
    browser.on("disconnected", () => {
      browser = undefined; // the next ensure() launches a fresh browser
      if (!closing) {
        for (const a of agents.values()) {
          // Drop the dead context; the agent reopens its last page when it is used again.
          if (a.context) { a.parked = true; a.context = null; a.page = null; a.observation = null; a.cursor = null; a.ready = null; }
          a.status = "error";
          a.message = "The browser stopped. It reopens when you use this agent again.";
          publish(a);
          void runtime.stop(a.id, "error", "The browser disconnected. Saved work is preserved.");
        }
      }
    });
    return browser;
  })();
  try {
    return await browserStarting;
  } finally {
    browserStarting = null;
  }
}
// Browser pool: every agent can browse, but at most POOL contexts are open at once. When another agent needs one,
// the least recently used idle agent is parked: cookies/storage and its last URL are kept in memory and restored
// when it wakes. Runs never lose their browser (the runtime already admits at most 2 runs at a time).
const POOL = 4;
const live = () => [...agents.values()].filter((x) => x.context && !x.parked);
function evictable() {
  return live().filter((x) => !x.runActive && !x.cliActive && x.lane.owner === "agent" && focused !== x.id && x.status !== "loading")
    .sort((p, q) => (p.lastUsed || 0) - (q.lastUsed || 0))[0];
}
async function park(a) {
  a.parked = true;
  try { a.storage = await a.context.storageState(); a.lastUrl = a.page?.url() || a.lastUrl; } catch {}
  const context = a.context;
  a.context = null; a.page = null; a.observation = null; a.cursor = null;
  a.status = "idle"; a.message = "Browser parked — it reopens where it left off when needed.";
  publish(a);
  await context?.close().catch(() => {});
}
function record(id) {
  const a = {
    id,
    lane: new ControlLane(),
    status: "loading",
    title: "Starting browser",
    step: 0,
    message: "Opening a browser session",
    hasRun: false,
    runActive: false,
    queue: null,
    capturing: false,
    seq: 0,
    nextCapture: 0,
    cursor: null,
    navigation: 0,
    observation: null,
    cliActive: false,
    parked: false,
    storage: undefined,
    lastUrl: "",
    lastUsed: Date.now(),
  };
  agents.set(id, a);
  return a;
}
// lazy: register without taking a browser slot when the pool is full (used at startup for large teams).
async function ensure(id, { lazy = false } = {}) {
  id = idOf(id);
  let a = agents.get(id);
  if (a && !a.parked) {
    if (a.ready) await a.ready;
    a.lastUsed = Date.now();
    return a;
  }
  if (live().length >= POOL) {
    const victim = evictable();
    if (!victim) {
      if (lazy) { a ||= record(id); a.parked = true; a.status = "idle"; a.message = "Waiting for a free browser slot."; publish(a); return a; }
      throw new Error(`All ${POOL} browser slots are busy. Try again when a task finishes.`);
    }
    if (lazy && !a) { a = record(id); a.parked = true; a.status = "idle"; a.message = "Browser parked — it opens when needed."; publish(a); return a; }
    await park(victim);
  }
  a ||= record(id);
  a.parked = false;
  a.status = "loading";
  a.message = a.lastUrl ? "Reopening the browser where it left off" : "Opening a browser session";
  a.lastUsed = Date.now();
  publish(a);
  a.ready = (async () => {
    try {
      a.hasRun = !!(
        data && existsSync(join(data, "outputs", a.id + "-research-notes.txt"))
      );
      await openContext(a);
      try { await a.page.goto(a.lastUrl || practiceURL, { waitUntil: "domcontentloaded" }); }
      catch { await a.page.goto(practiceURL, { waitUntil: "domcontentloaded" }); }
      a.title = await a.page.title();
      a.status = "idle";
      activity(a, "Browser ready. Give this agent a task to begin.");
      return a;
    } catch (e) {
      a.status = "error";
      activity(a, e.message);
      await a.context?.close().catch(() => {});
      a.context = null; a.page = null; a.parked = true;
      throw e;
    }
  })();
  await a.ready;
  return a;
}
async function openContext(a) {
      const b = await startBrowser();
      a.context = await b.newContext({
        storageState: a.storage,
        viewport: { width: 1024, height: 640 },
        deviceScaleFactor: 1,
        acceptDownloads: false,
        permissions: [],
        serviceWorkers: "block",
      });
      await a.context.route("**/*", async (route) => {
        try {
          const request = route.request(), url = new URL(request.url());
          if (url.origin !== new URL(practiceURL).origin) publicUrl(url.href);
          if (!["GET", "HEAD"].includes(request.method())) throw new Error("Research only");
          await route.continue();
        } catch { await route.abort("blockedbyclient").catch(() => {}); }
      });
      await a.context.routeWebSocket("**/*", (socket) => socket.close());
      a.page = await a.context.newPage();
      a.page.setDefaultTimeout(5000);
      a.page.setDefaultNavigationTimeout(20000);
      a.context.on("page", (p) => {
        if (p !== a.page) void p.close();
      });
      a.page.on("dialog", (d) => void d.dismiss());
      a.page.on("framenavigated", (frame) => {
        if (frame === a.page.mainFrame()) {
          a.navigation++;
          a.observation = null;
          publish(a);
        }
      });
      a.page.on("load", () => {
        void a.page
          .title()
          .then((title) => {
            a.title = title;
            publish(a);
          })
          .catch(() => {});
      });
}
async function observe(a) {
  const navigation = a.navigation;
  const url = a.page.url();
  const captured = await a.page.evaluate(() => ({
    title: document.title,
    text: (document.body?.innerText || "").slice(0, 24000),
    links: [...document.querySelectorAll("a[href]")].map((link) => ({ text: (link.innerText || link.getAttribute("aria-label") || "Link").trim().slice(0, 180), url: link.href }))
      .filter((link) => /^https?:\/\//i.test(link.url)).slice(0, 80),
  }));
  if (a.navigation !== navigation || a.page.url() !== url) throw new Error("The page changed while reading. Read it again.");
  const observationId = randomUUID();
  const links = captured.links.map((link, i) => ({ linkId: i + 1, ...link }));
  a.observation = { id: observationId, navigation, links };
  a.title = captured.title;
  publish(a);
  return { observationId, source: { url, title: captured.title, text: captured.text, retrievedAt: new Date().toISOString(), truncated: captured.text.length >= 24000 }, links };
}
async function browserTool(id, name, args, permitted) {
  const a = await ensure(id);
  const epoch = a.lane.epoch;
  let result;
  const executed = await a.lane.automation(epoch, async () => {
    if (!permitted()) throw new Error("This task has been stopped.");
    if (name === "browser_open") {
      const url = publicUrl(args.url).href;
      activity(a, "Reading " + url);
      await a.page.goto(url, { waitUntil: "domcontentloaded" });
    } else if (name === "browser_follow") {
      if (!a.observation || a.observation.id !== args.observationId || a.observation.navigation !== a.navigation)
        throw new Error("This link reference is stale. Read the page again.");
      const link = a.observation.links.find((link) => link.linkId === args.linkId);
      if (!link) throw new Error("That link was not in the observation.");
      activity(a, "Following " + link.text);
      await a.page.goto(publicUrl(link.url).href, { waitUntil: "domcontentloaded" });
    } else if (name === "browser_scroll") {
      await a.page.mouse.wheel(0, args.direction === "up" ? -530 : 530);
    } else if (name !== "browser_read") throw new Error("Unsupported browser tool.");
    if (!permitted()) throw new Error("This task has been stopped.");
    result = await observe(a);
  });
  if (!executed) throw new Error("The user has taken control. Browser actions are paused; do not retry.");
  return result;
}
const runtime = new AgentRuntime({
  knowledge,
  data, emit, browserTool,
  prepareBrowser: async (id, permitted) => {
    const a = await ensure(id);
    if (permitted && !permitted()) return;
    if (a.runActive) throw new Error("Stop the browser practice task first.");
    if (a.lane.owner !== "agent") throw new Error("Return browser control before starting the task.");
    a.cliActive = true; a.status = "working"; a.observation = null; publish(a);
  },
  releaseBrowser: async (id) => {
    const a = agents.get(id); if (!a) return;
    a.lane.invalidate(); await a.lane.enqueue(() => { a.cliActive = false; a.status = "idle"; a.cursor = null; publish(a); });
  },
});
await runtime.init();
async function capture(a) {
  if (
    !a.page ||
    a.parked ||
    a.capturing ||
    closing ||
    backpressure ||
    Date.now() < a.nextCapture
  )
    return;
  a.capturing = true;
  a.nextCapture = Date.now() + (focused === a.id ? 180 : 650);
  try {
    const image = await a.page.screenshot({
      type: "jpeg",
      quality: focused === a.id ? 80 : 65,
      timeout: 5000,
    });
    emit({
      type: "frame",
      agentId: a.id,
      seq: ++a.seq,
      image: image.toString("base64"),
      width: 1024,
      height: 640,
      cursor: a.cursor,
    });
  } catch {
  } finally {
    a.capturing = false;
  }
}
const captureTimer = setInterval(() => {
  for (const a of agents.values()) void capture(a);
}, 90);
async function pointAt(a, selector) {
  const rect = await a.page.locator(selector).boundingBox();
  if (rect) {
    a.cursor = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    await a.page.mouse.move(a.cursor.x, a.cursor.y);
  }
}
const steps = [
  async (a) => {
    activity(a, "Opening the practice research library");
    await a.page.goto(practiceURL, { waitUntil: "domcontentloaded" });
  },
  async (a) => {
    activity(a, "Reading “The calm studio”");
    await pointAt(a, "#open-source");
    await a.page.locator("#open-source").click();
  },
  async (a) => {
    activity(a, "Opening the research notes");
    await pointAt(a, "#make-notes");
    await a.page.locator("#make-notes").click();
  },
  async (a) => {
    activity(a, "Writing three ideas into the page");
    await pointAt(a, "#note");
    await a.page
      .locator("#note")
      .fill(
        "Worklive research notes\n\n• Give every agent a desk and a persistent workspace.\n• Mirror the real browser on the desk monitor.\n• Pause agent input while a person takes control.",
      );
  },
  async (a) => {
    activity(a, "Saving notes and checking the result");
    await pointAt(a, "#save-notes");
    await a.page.locator("#save-notes").click();
    await a.page.locator("#saved").waitFor({ state: "visible" });
    const note = await a.page.locator("#note").inputValue();
    if (!note.trim())
      throw new Error("The page did not contain the expected notes.");
    if (data) {
      await mkdir(join(data, "outputs"), { recursive: true });
      await writeFile(
        join(data, "outputs", a.id + "-research-notes.txt"),
        note,
        { mode: 0o600 },
      );
    }
  },
];
function schedule(a, token) {
  clearTimeout(a.timer);
  if (!a.runActive || a.lane.owner !== "agent" || token !== a.lane.epoch)
    return;
  a.timer = setTimeout(() => {
    void a.lane
      .automation(token, async () => {
        if (a.step >= steps.length) return;
        await steps[a.step](a);
        a.step++;
        a.title = await a.page.title();
        if (a.step >= steps.length) {
          a.status = "complete";
          a.runActive = false;
          a.cursor = null;
          activity(a, "Practice task complete. Notes were saved and verified.");
        } else publish(a);
      })
      .then((executed) => {
        if (executed && a.runActive && token === a.lane.epoch)
          schedule(a, token);
      })
      .catch((e) => {
        a.runActive = false;
        a.status = "error";
        a.cursor = null;
        activity(a, "Task stopped: " + e.message);
      });
  }, 1900);
}
// Subscription status is checked at most every 5 minutes per provider (hire suggestions and chat).
const providerReady = new Map();
async function cliDir() { const dir = join(data || ".", "provider-check"); await mkdir(dir, { recursive: true, mode: 0o700 }); return dir; }
async function ready(provider) {
  const hit = providerReady.get(provider);
  if (hit && Date.now() - hit.at < 300000) return hit.ok;
  const ok = (await inspectProvider(provider, await cliDir())).status === "ready";
  providerReady.set(provider, { ok, at: Date.now() });
  return ok;
}
const chats = new Chats(data || ".", { ready, emit, ask: async (provider, prompt) => askCli(provider, prompt, await cliDir(), { timeout: 120000 }) });
async function handle(c) {
  if (c.action === "hello")
    return {
      practiceURL,
      engine: "Chromium",
      automation: "subscription CLI agents",
      runs: runtime.state(),
    };
  if (c.action === "workflow") return runtime.workflow();
  if (["saveProject","saveProjectTask","archiveProjectTask"].includes(c.action)) return runtime.projectCommand(c.action,c);
  if (c.action === "startProjectTask") return runtime.startProjectTask(c.agent,c.taskId);
  if (c.action === "reviewRun") return runtime.review(c.runId,c.accepted);
  if (c.action === "createHandoff") return runtime.createHandoff(c);
  if (c.action === "startHandoff") return runtime.startHandoff(c.agent,c.handoffId);
  if (c.action === "cancelHandoff") return runtime.cancelHandoff(c.handoffId);
  if (c.action === "handoffPreview") return runtime.handoffPreview(c.handoffId);
  if (c.action === "providers") return runtime.providers();
  if (c.action === "suggest") return { text: await suggest(c.provider, c.field, c.draft || {}, await cliDir(), ready) };
  if (c.action === "chatHistory") return chats.history(c.agentId);
  if (c.action === "chatSend") return chats.send(c.agent, c.text);
  if (c.action === "chatClear") return chats.clear(c.agentId);
  if (c.action === "startTask") return runtime.start(c.agent, { previousRunId: c.previousRunId, followup: c.followup });
  if (c.action === "pauseTask") return runtime.stop(idOf(c.agentId), "paused");
  if (c.action === "stopTask") return runtime.stop(idOf(c.agentId));
  if (c.action === "runHistory") return runtime.history(idOf(c.agentId));
  if (c.action === "artifact") return runtime.artifact(c.runId, c.name);
  if (c.action === "saveArtifact") return runtime.saveArtifact(c.runId, c.name, c.content, c.baseHash);
  if (c.action === "documents") return runtime.documents();
  if (c.action === "shutdown") {
    void shutdown();
    return {};
  }
  if (c.action === "focus") {
    focused = c.agentId ? idOf(c.agentId) : null;
    if (focused && agents.get(focused)?.parked) await ensure(focused); // opening the computer view wakes a parked browser
    return {};
  }
  if (c.action === "ensure") {
    const a = await ensure(c.agentId, { lazy: !!c.lazy });
    return state(a);
  }
  let a = agents.get(idOf(c.agentId));
  if (a?.parked) a = await ensure(a.id); // any browser action wakes a parked browser (may park another idle one)
  if (!a?.page) throw new Error("Open this agent’s browser first.");
  a.lastUsed = Date.now();
  if (c.action === "takeControl") {
    clearTimeout(a.timer);
    a.observation = null;
    a.lane.invalidate();
    const stopped = runtime.stop(a.id, "paused", "Paused while you use the browser. Return control, then choose Resume task.");
    await a.lane.handoff("user");
    await stopped;
    a.cursor = null;
    a.status = a.runActive ? "paused" : "idle";
    activity(a, "You have control. Agent browser actions are paused.");
    return state(a);
  }
  if (c.action === "returnControl") {
    a.observation = null;
    await a.lane.handoff("agent");
    a.status = a.runActive
      ? "working"
      : a.hasRun && a.step >= steps.length
        ? "complete"
        : "idle";
    activity(
      a,
      a.runActive
        ? "Control returned. Continuing the practice task."
        : "Control returned to the agent.",
    );
    schedule(a, a.lane.epoch);
    return state(a);
  }
  if (c.action === "runDemo") {
    if (runtime.active(a.id)) throw new Error("Pause or stop the current agent task first.");
    if (a.lane.owner !== "agent")
      throw new Error("Return control before starting the practice task.");
    clearTimeout(a.timer);
    const token = a.lane.invalidate();
    return a.lane.enqueue(() => {
      a.step = 0;
      a.runActive = true;
      a.hasRun = true;
      a.status = "working";
      activity(a, "Practice task started: read a source and save notes");
      schedule(a, token);
      return state(a);
    });
  }
  if (c.action === "stopDemo") {
    clearTimeout(a.timer);
    a.lane.invalidate();
    return a.lane.enqueue(() => {
      a.runActive = false;
      a.status = "idle";
      a.cursor = null;
      activity(a, "Practice task stopped");
      return state(a);
    });
  }
  if (c.action === "notes") {
    return {
      text: data
        ? await readFile(
            join(data, "outputs", a.id + "-research-notes.txt"),
            "utf8",
          ).catch(() => "")
        : "",
      path: data ? join(data, "outputs", a.id + "-research-notes.txt") : null,
    };
  }
  return a.lane.user(async () => {
    if (c.action === "navigate") {
      a.runActive = false;
      clearTimeout(a.timer);
      a.status = "loading";
      publish(a);
      try {
        await a.page.goto(validUrl(c.url), { waitUntil: "domcontentloaded" });
        a.title = await a.page.title();
        a.status = "idle";
        activity(a, "Opened " + a.page.url());
      } catch (e) {
        a.status = "error";
        activity(a, "Navigation failed: " + e.message);
        throw e;
      }
      return state(a);
    }
    if (c.action === "home") {
      await a.page.goto(practiceURL, { waitUntil: "domcontentloaded" });
      a.status = "idle";
      a.title = await a.page.title();
      activity(a, "Opened the practice page");
      return state(a);
    }
    if (c.action === "back") {
      await a.page.goBack({ waitUntil: "domcontentloaded" });
      publish(a);
      return {};
    }
    if (c.action === "forward") {
      await a.page.goForward({ waitUntil: "domcontentloaded" });
      publish(a);
      return {};
    }
    if (c.action === "reload") {
      await a.page.reload({ waitUntil: "domcontentloaded" });
      publish(a);
      return {};
    }
    if (c.action === "click") {
      if (
        !Number.isFinite(c.x) ||
        !Number.isFinite(c.y) ||
        c.x < 0 ||
        c.x > 1024 ||
        c.y < 0 ||
        c.y > 640
      )
        throw new Error("Invalid browser coordinates");
      await a.page.mouse.click(c.x, c.y, {
        button: c.button === "right" ? "right" : "left",
        clickCount: c.count === 2 ? 2 : 1,
      });
      return {};
    }
    if (c.action === "scroll") {
      await a.page.mouse.wheel(
        Math.max(-1200, Math.min(1200, Number(c.dx) || 0)),
        Math.max(-1200, Math.min(1200, Number(c.dy) || 0)),
      );
      return {};
    }
    if (c.action === "text") {
      if (typeof c.text !== "string" || c.text.length > 10000)
        throw new Error("Input is too long");
      await a.page.keyboard.insertText(c.text);
      return {};
    }
    if (c.action === "key") {
      if (typeof c.key !== "string" || c.key.length > 80)
        throw new Error("Invalid key");
      await a.page.keyboard.press(c.key);
      return {};
    }
    throw new Error("Unknown browser action");
  });
}
async function shutdown() {
  if (closing) return;
  closing = true;
  clearInterval(captureTimer);
  await runtime.shutdown();
  for (const a of agents.values()) {
    clearTimeout(a.timer);
    a.lane.invalidate();
  }
  await browser?.close().catch(() => {});
  server.close();
  proxy.close();
  process.exit(0);
}
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", (line) => {
  let command;
  try {
    command = JSON.parse(line);
    if (command?.action === "knowledgeReply") {
      const pending=knowledgeRequests.get(command.requestId);
      if(pending){clearTimeout(pending.timer);knowledgeRequests.delete(command.requestId);command.error?pending.reject(new Error(command.error)):pending.resolve(command.result);}
      return;
    }
    if (!command || typeof command.action !== "string")
      throw new Error("Invalid command");
  } catch {
    return;
  }
  void handle(command)
    .then((result) => emit({ type: "reply", id: command.id, ok: true, result }))
    .catch((e) =>
      emit({
        type: "reply",
        id: command.id,
        ok: false,
        error: e.message || String(e),
      }),
    );
});
input.on("close", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
emit({ type: "ready", message: "Browser service ready" });
