import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Agent, BrowserState } from "./types";
/** Browser state, or a run state the office shows: "review" = a finished run waits at the desk until the user accepts it,
 *  "needs" = a paused, interrupted, failed or limited run waits at the desk for the user (reason = short text for the label). */
export type OfficeState = Omit<BrowserState, "status"> & { status: BrowserState["status"] | "review" | "needs"; reason?: string };
import { PROVIDERS } from "./types";
// Comic office (toon characters + room), shared layout, navigation and crowd simulation. Plain JS modules.
import * as Comic from "./office/styles/comic/index.js";
import { DESKS, DESK_SLOTS, DESK, ROOM, seatOf, monitorOf, deskApproach } from "./office/layout.js";
import { NavGrid, buildObstacles, buildSpots } from "./office/nav.js";
import { Crowd } from "./office/crowd.js";
import { createHelpers } from "./office/helpers.js";

export interface Moment {
  text: string;
  speaker?: string;
}
type Pose = "stand" | "walk" | "sit" | "type" | "coffee" | "lounge";
interface Walker { id: string; x: number; z: number; yaw: number; pose: Pose; state: string; mode: string; spot: { id: string } | null; home: unknown; slide?: { seat?: { id: string } } | null }
interface Character { root: T.Object3D; head: T.Object3D; eyeAnchor: T.Object3D; update(t: number, dt: number, pose: Pose, ctx: object): void }
interface Actor {
  agent: Agent;
  a: { id: string; provider: Agent["provider"]; status: string }; // shape the helper module expects
  i: number;
  d: { x: number; z: number } | null;
  char: Character;
  walker: Walker;
  pos: T.Vector3;
  label: HTMLButtonElement;
  monitor: HTMLButtonElement;
  bubble: HTMLDivElement;
  alert: HTMLButtonElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  screen: T.CanvasTexture;
  status: string;
  reason: string;
  bubbleText: string;
  bubbleUntil: number;
}

// Chat lines for two free agents meeting at the coffee counter or the lounge (carried over from 0.8).
const CHATS = [
  ["I call this a productive pause.", "Agreed. The coffee has excellent uptime."],
  ["Anyone else have 47 tabs open?", "Only emotionally."],
  ["What should we name the office plant?", "Branch manager. Obviously."],
  ["A tiny office. Very big plans.", "And just the right amount of coffee."],
  ["I brought a fresh idea to the table.", "Excellent. I brought a mug."],
];
const SOCIAL = /^(counter|cafe|sofa|armchair)/;
const SPOT_LABELS: [RegExp, string][] = [
  [/^(counter|cafe)/, "Coffee break"], [/^(sofa|armchair)/, "Lounging"], [/^window/, "Enjoying the view"],
  [/^books/, "Browsing the shelf"], [/^plant/, "Checking on the plant"], [/^loiter/, "Stretching their legs"],
];
export type View = "office" | "team" | "follow" | "eyes";
// Team line-up: open floor between the desks and the lounge, everyone facing the camera.
const TEAM = { x: 10.5, z: -0.6, perRow: 8, gap: 1.15, rowGap: 1.3 };
const teamSpot = (i: number) => {
  const row = Math.floor(i / TEAM.perRow), col = i % TEAM.perRow;
  return { x: TEAM.x + (col - (TEAM.perRow - 1) / 2) * TEAM.gap + (row % 2) * TEAM.gap * 0.5, z: TEAM.z - row * TEAM.rowGap };
};
const SCREEN_W = 1088, SCREEN_H = 640; // 1.7 : 1 like the monitor plane; 1024 × 640 frames are letterboxed

export function createOffice(
  container: HTMLElement,
  onSelect: (id: string) => void,
  onOpen: (id: string) => void,
  onMoment: (moment: Moment) => void,
  onView: (view: View, id: string | null) => void = () => {},
) {
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(38, 1, 0.1, 220);
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  // Codex's profiling advice: cap the pixel ratio; the toon look doesn't need full Retina resolution.
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.domElement.setAttribute("aria-label", "Worklive three-dimensional office");
  renderer.domElement.classList.add("office-canvas");
  container.append(renderer.domElement);
  const labels = document.createElement("div");
  labels.className = "office-labels";
  container.append(labels);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = 1.36;
  controls.minDistance = 2.2;
  controls.maxDistance = 46;
  controls.zoomToCursor = true;
  controls.screenSpacePanning = false;
  const HOME = { pos: new T.Vector3(17, 19, 22), target: new T.Vector3(-3, 0.4, 0.5) };
  camera.position.copy(HOME.pos);
  controls.target.copy(HOME.target);
  let fly: { t: number; p0: T.Vector3; t0: T.Vector3; p1: T.Vector3; t1: T.Vector3 } | null = null;
  const flyTo = (p1: T.Vector3, t1: T.Vector3) => { fly = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1, t1 }; };
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const hemi = new T.HemisphereLight("#fdf8f0", "#9c978d", 1);
  const sun = new T.DirectionalLight("#fff1dc", 2.6);
  sun.position.set(-6, 14, -12);
  sun.castShadow = true;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(hemi, sun);

  // Tooltip (hover / keyboard focus) — styled by the app, not by the 3D scene.
  const tooltip = document.createElement("div");
  tooltip.className = "agent-tooltip";
  tooltip.id = "office-agent-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  const tooltipName = document.createElement("strong"), tooltipProvider = document.createElement("span"), tooltipStatus = document.createElement("small");
  tooltip.append(tooltipName, tooltipProvider, tooltipStatus);
  labels.append(tooltip);

  const actors: Actor[] = [];
  let set: any = null, grid: any = null, crowd: any = null, helpers: any = null, trophy: T.Object3D | null = null, earned = false;
  let selected = "", hovered: string | null = null, keyboardFocus: string | null = null, paused = false, width = 1, height = 1;
  let last = performance.now(), clock = 0;
  let view: View = "office", followId: string | null = null;
  const eyesLook = { yaw: 0, pitch: 0 };
  const pending: Agent[] = [];
  const queuedStates = new Map<string, OfficeState>();
  const freeDesks = () => { const used = new Set(actors.map(a => a.agent.desk)); return DESKS.map((_: unknown, i: number) => i).filter((i: number) => !used.has(i)); };

  // ---------- Room (async: the comic room builds its geometry, then queued agents are added) ----------
  (async () => {
    set = await Comic.buildRoom(scene, renderer);
    Comic.applyLook({ scene, renderer, hemi, sun, camera }, set);
    sun.shadow.mapSize.set(2048, 2048); // 4096 is overkill in WKWebView
    grid = new NavGrid(buildObstacles());
    crowd = new Crowd({ grid, spots: buildSpots() });
    helpers = createHelpers({ scene, S: Comic, actors: () => actors });
    trophy = buildTrophy();
    trophy.visible = earned;
    scene.add(trophy);
    for (const a of pending.splice(0)) await create(a);
    resize();
  })().catch(error => console.error("Office failed to build", error));

  function buildTrophy() {
    const g = new T.Group(), gold = new T.MeshToonMaterial({ color: "#f2c94c" }), base = new T.MeshToonMaterial({ color: "#23324a" });
    const cup = new T.Mesh(new T.CylinderGeometry(0.11, 0.05, 0.16, 20), gold);
    cup.position.y = 0.2;
    const stem = new T.Mesh(new T.CylinderGeometry(0.02, 0.03, 0.08, 12), gold);
    stem.position.y = 0.09;
    const foot = new T.Mesh(new T.BoxGeometry(0.16, 0.05, 0.12), base);
    foot.position.y = 0.025;
    for (const s of [-1, 1]) {
      const handle = new T.Mesh(new T.TorusGeometry(0.045, 0.012, 8, 16, Math.PI), gold);
      handle.position.set(s * 0.11, 0.21, 0);
      handle.rotation.z = s * -Math.PI / 2;
      g.add(handle);
    }
    g.add(cup, stem, foot);
    g.position.set(ROOM.minX + 0.3, 2.1, 1.6); // top of the bookshelf
    g.traverse(o => { if ((o as T.Mesh).isMesh) o.castShadow = true; });
    return g;
  }

  // Office growth: next pair of desk slots pops in once nobody stands there.
  const canGrow = () => DESKS.length < DESK_SLOTS.length;
  async function growOffice() {
    const next = DESK_SLOTS.slice(DESKS.length, DESKS.length + 2);
    const inZone = (w: Walker) => next.some((d: { x: number; z: number }) =>
      w.x > d.x - DESK.w / 2 - 0.5 && w.x < d.x + DESK.w / 2 + 0.5 && w.z > d.z - DESK.d / 2 - 0.5 && w.z < d.z + DESK.d / 2 + 1.6);
    for (let tries = 0; tries < 20 && crowd.agents.some(inZone); tries++) {
      for (const w of crowd.agents) if (inZone(w) && w.state !== "walking") { const p = crowd.randomFreePoint(); crowd.goTo(w, { id: "loiter", at: p, via: p, yaw: 0, pose: "stand", loiter: true }); }
      await new Promise(r => setTimeout(r, 700));
    }
    for (const d of next) { const i = DESKS.length; DESKS.push(d); Comic.addDesk(set, i, d); }
    crowd.grid = grid = new NavGrid(buildObstacles());
  }

  function deskSpot(i: number, pose: Pose) {
    const s = seatOf(DESKS[i]);
    return { id: "desk" + i, at: { x: s.x, z: s.z }, yaw: s.yaw, pose, via: deskApproach(s) };
  }
  function placeholder(ctx: CanvasRenderingContext2D, name: string, text: string) {
    const g = ctx.createLinearGradient(0, 0, 0, SCREEN_H);
    g.addColorStop(0, "#1d2433"); g.addColorStop(1, "#111620");
    ctx.fillStyle = g; ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.fillStyle = "#e8ecf4"; ctx.font = "600 46px -apple-system, 'SF Pro Display', sans-serif";
    ctx.fillText(name, 84, 280);
    ctx.fillStyle = "#8b93a7"; ctx.font = "30px -apple-system, 'SF Pro Text', sans-serif";
    ctx.fillText(text, 84, 336);
  }

  async function create(agent: Agent) {
    if (actors.some(a => a.agent.id === agent.id)) return;
    let desk = typeof agent.desk === "number" && agent.desk < DESK_SLOTS.length && !actors.some(a => a.agent.desk === agent.desk) ? agent.desk : null;
    while (desk !== null && desk >= DESKS.length && canGrow()) await growOffice();
    if (desk === null) { desk = freeDesks()[0] ?? null; if (desk === null && canGrow()) { await growOffice(); desk = freeDesks()[0] ?? null; } }
    agent.desk = desk ?? undefined;
    const d = desk === null ? null : DESKS[desk];
    const canvas = document.createElement("canvas");
    canvas.width = SCREEN_W; canvas.height = SCREEN_H;
    const ctx = canvas.getContext("2d")!;
    placeholder(ctx, agent.name, "Browser starting…");
    const screen = new T.CanvasTexture(canvas);
    screen.colorSpace = T.SRGBColorSpace;
    screen.minFilter = T.LinearFilter;
    if (desk !== null) set.screens[desk].material = new T.MeshBasicMaterial({ map: screen, toneMapped: false });
    const char = Comic.createCharacter(agent, actors.length) as Character;
    scene.add(char.root);
    const home = desk === null ? null : deskSpot(desk, "sit");
    const entrance = { x: -1.5, z: ROOM.maxZ - 0.9 };
    const walker = crowd.add({ id: agent.id, home, mode: "desk", traits: agent.traits || [], start: agent.fresh ? entrance : undefined }) as Walker;
    if (agent.fresh) { crowd.setMode(agent.id, "wander"); crowd.setMode(agent.id, "desk"); }
    const label = document.createElement("button");
    label.className = "agent-label";
    label.dataset.name = agent.name;
    label.addEventListener("click", () => choose(agent.id));
    label.addEventListener("pointerenter", () => { hovered = agent.id; });
    label.addEventListener("pointerleave", () => { hovered = null; });
    label.addEventListener("focus", () => { keyboardFocus = agent.id; });
    label.addEventListener("blur", () => { keyboardFocus = null; });
    const monitor = document.createElement("button");
    monitor.className = "monitor-target";
    monitor.setAttribute("aria-label", "Open " + agent.name + " browser");
    monitor.addEventListener("click", () => onOpen(agent.id));
    monitor.hidden = desk === null;
    const bubble = document.createElement("div");
    bubble.className = "speech-bubble";
    bubble.hidden = true;
    // "!" over the head while the agent needs the user; opens the agent card like the label.
    const alert = document.createElement("button");
    alert.className = "needs-marker";
    alert.textContent = "!";
    alert.hidden = true;
    alert.addEventListener("click", () => choose(agent.id));
    labels.append(label, monitor, bubble, alert);
    const actor: Actor = { agent, a: { id: agent.id, provider: agent.provider, status: "idle" }, i: actors.length, d, char, walker,
      pos: new T.Vector3(walker.x, 0, walker.z), label, monitor, bubble, alert, canvas, ctx, screen, status: "idle", reason: "", bubbleText: "", bubbleUntil: 0 };
    actors.push(actor);
    const queued = queuedStates.get(agent.id);
    if (queued) { queuedStates.delete(agent.id); applyState(actor, queued); } else applyState(actor, null);
    updateLabel(actor);
  }

  // ---------- Status ----------
  // Browser/run status → what the character shows (expression, desk or free) and the label text.
  function mood(status: string) {
    return status === "working" || status === "loading" ? "working" : status === "error" || status === "paused" || status === "needs" ? "needs" : status === "complete" || status === "review" ? "review" : "idle";
  }
  function applyState(a: Actor, state: OfficeState | null) {
    a.status = !state ? "idle" : state.owner === "user" && state.status === "idle" ? "paused" : state.status;
    a.a.status = mood(a.status);
    a.reason = state?.reason || "";
    const busy = !["idle", "complete"].includes(a.status);
    if (!crowd) return;
    const w = crowd.agents.find((w: Walker) => w.id === a.agent.id);
    if (busy || !a.d) crowd.setMode(a.agent.id, busy && a.d ? "desk" : "wander");
    else if (w.mode === "desk" && w.state === "seated" && !a.agent.fresh) { crowd.setMode(a.agent.id, "wander"); w.timer = 6 + Math.random() * 20; }
    else crowd.setMode(a.agent.id, "wander");
    if (w?.home) {
      (w.home as { pose: Pose }).pose = a.status === "working" || a.status === "loading" ? "type" : "sit";
      // Already in the chair: switch between typing and leaning back right away.
      if (w.state === "seated" && w.spot === w.home) w.pose = (w.home as { pose: Pose }).pose;
    }
  }
  function actorStatus(a: Actor) {
    const w = a.walker;
    if (a.status === "working") return "Working";
    if (a.status === "loading") return "Opening browser";
    if (a.status === "paused") return "You have control";
    if (a.status === "error") return "Needs attention";
    if (a.status === "needs") return w.state === "seated" && w.spot?.id === "desk" + a.agent.desk ? "Needs you" + (a.reason ? ": " + a.reason : "") : "Heading to desk";
    if (w.state === "walking") return w.spot?.id?.startsWith("desk") ? "Heading to desk" : "On the move";
    if (a.status === "review") return w.state === "seated" && w.spot?.id === "desk" + a.agent.desk ? "Waiting for your review" : "Heading to desk";
    if (w.state === "seated" && w.spot?.id?.startsWith("desk")) return a.status === "complete" ? "Result ready" : "At the desk";
    const id = w.spot?.id || "";
    for (const [re, text] of SPOT_LABELS) if (re.test(id)) return text;
    return "Settling in";
  }
  function updateLabel(a: Actor) {
    a.label.replaceChildren();
    const dot = document.createElement("span");
    dot.className = "agent-dot";
    dot.style.background = PROVIDERS[a.agent.provider].color;
    const initials = document.createElement("span");
    initials.className = "agent-initials";
    initials.textContent = a.agent.name.trim().split(/\s+/).map(word => Array.from(word)[0] || "").slice(0, 2).join("").toLocaleUpperCase() || "?";
    const state = document.createElement("span");
    state.className = "agent-state";
    state.dataset.mood = a.a.status;
    a.label.append(dot, initials, state);
    a.label.dataset.status = actorStatus(a);
    a.label.setAttribute("aria-label", `${a.agent.name}, ${PROVIDERS[a.agent.provider].name}, ${actorStatus(a)}`);
    a.label.setAttribute("aria-pressed", String(selected === a.agent.id));
    a.alert.setAttribute("aria-label", `${a.agent.name} needs you${a.reason ? ": " + a.reason : ""}`);
  }
  function positionTooltip() {
    const actor = actors.find(a => a.agent.id === (hovered || keyboardFocus));
    tooltip.hidden = !actor;
    for (const a of actors) {
      if (a === actor) a.label.setAttribute("aria-describedby", tooltip.id);
      else a.label.removeAttribute("aria-describedby");
    }
    if (!actor) return;
    const provider = PROVIDERS[actor.agent.provider];
    if (tooltipName.textContent !== actor.agent.name) tooltipName.textContent = actor.agent.name;
    const providerText = provider.name + " · " + actor.agent.role;
    if (tooltipProvider.textContent !== providerText) tooltipProvider.textContent = providerText;
    const status = actorStatus(actor);
    if (tooltipStatus.textContent !== status) tooltipStatus.textContent = status;
    tooltip.style.setProperty("--provider", provider.color);
    const anchor = actor.pos.clone().setY(2.1).project(camera);
    const half = tooltip.offsetWidth / 2;
    tooltip.style.left = Math.max(half + 8, Math.min(width - half - 8, ((anchor.x + 1) * width) / 2)) + "px";
    tooltip.style.top = Math.max(tooltip.offsetHeight + 8, Math.min(height - 8, ((1 - anchor.y) * height) / 2)) + "px";
  }

  // ---------- Chats: two free agents settled at the coffee counter or in the lounge ----------
  let chat: { one: Actor; two: Actor; lines: string[]; turn: number; at: number } | null = null, chatNumber = 0, nextChat = 8;
  function say(a: Actor, text: string) {
    a.bubbleText = text;
    a.bubbleUntil = clock + 4.8;
    onMoment({ speaker: a.agent.name, text });
  }
  function stepChats() {
    if (chat) {
      const gone = ![chat.one, chat.two].every(a => a.walker.state === "seated" && SOCIAL.test(a.walker.spot?.id || "") && a.a.status === "idle");
      if (gone) { chat = null; return; }
      if (clock >= chat.at) {
        if (chat.turn >= chat.lines.length) { chat = null; nextChat = clock + 25; return; }
        say(chat.turn % 2 ? chat.two : chat.one, chat.lines[chat.turn]);
        chat.turn++; chat.at = clock + 5.2;
      }
      return;
    }
    if (clock < nextChat) return;
    nextChat = clock + 3;
    const free = actors.filter(a => a.a.status === "idle" && a.walker.state === "seated" && SOCIAL.test(a.walker.spot?.id || ""));
    for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++)
      if (free[i].pos.distanceTo(free[j].pos) < 3.2) { chat = { one: free[i], two: free[j], lines: CHATS[chatNumber++ % CHATS.length], turn: 0, at: clock + 1 }; return; }
  }

  // ---------- Pointer ----------
  const raycaster = new T.Raycaster(), ndc = new T.Vector2();
  function pick(event: PointerEvent | MouseEvent): { actor: Actor; monitor: boolean } | null {
    const bounds = renderer.domElement.getBoundingClientRect();
    ndc.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const screens = actors.filter(a => a.d).map(a => set.screens[a.agent.desk!]);
    for (const hit of raycaster.intersectObjects([...actors.map(a => a.char.root), ...screens], true)) {
      for (const a of actors) {
        if (a.d && set.screens[a.agent.desk!] === hit.object) return { actor: a, monitor: true };
        for (let o: T.Object3D | null = hit.object; o; o = o.parent) if (o === a.char.root) return { actor: a, monitor: false };
      }
    }
    return null;
  }
  let downAt = { x: 0, y: 0 };
  renderer.domElement.addEventListener("pointerdown", e => { downAt = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener("pointermove", e => {
    if (view === "eyes" && e.buttons === 1) {
      eyesLook.yaw -= e.movementX * 0.004;
      eyesLook.pitch = Math.max(-0.35, Math.min(0.35, eyesLook.pitch - e.movementY * 0.003));
      return;
    }
    if (e.buttons) return;
    const hit = pick(e);
    hovered = hit?.actor.agent.id || null;
    renderer.domElement.style.cursor = hit ? "pointer" : "";
  });
  renderer.domElement.addEventListener("pointerleave", () => { hovered = null; });
  renderer.domElement.addEventListener("click", e => {
    if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4) return; // it was a drag
    const hit = pick(e);
    if (!hit) return;
    if (hit.monitor && view !== "team") onOpen(hit.actor.agent.id);
    else choose(hit.actor.agent.id);
  });
  renderer.domElement.addEventListener("dblclick", e => {
    const hit = pick(e);
    if (hit && !hit.monitor) { onSelect(hit.actor.agent.id); setView("eyes", hit.actor.agent.id); }
  });
  addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    const t = e.target as HTMLElement | null;
    if (t?.closest("input, textarea, select, dialog") || !container.clientWidth) return;
    hovered = null; keyboardFocus = null; tooltip.hidden = true;
    if (view !== "office") setView(view === "eyes" ? "follow" : "office");
  });
  // Clicking someone: in the line-up just select them; elsewhere the camera starts following them.
  function choose(id: string) {
    onSelect(id);
    if (view !== "team" && view !== "eyes") setView("follow", id);
    else if (view === "eyes") setView("eyes", id);
  }
  // ---------- Camera views: office overview, team line-up, follow an agent, through an agent's eyes ----------
  function setView(next: View, id: string | null = followId || selected || actors[0]?.agent.id || null) {
    const a = actors.find(x => x.agent.id === id);
    if ((next === "follow" || next === "eyes") && !a) next = "office";
    view = next;
    followId = a ? a.agent.id : null;
    controls.enabled = next !== "eyes";
    camera.near = next === "eyes" ? 0.03 : 0.1;
    camera.updateProjectionMatrix();
    eyesLook.yaw = eyesLook.pitch = 0;
    labels.classList.toggle("team-view", next === "team");
    labels.classList.toggle("eyes-view", next === "eyes");
    if (next === "office") flyTo(HOME.pos.clone(), HOME.target.clone());
    if (next === "team") {
      const rows = Math.max(1, Math.ceil(actors.length / TEAM.perRow));
      const across = Math.min(actors.length, TEAM.perRow);
      // Far enough back that the widest row fits; high enough to look over the lounge armchair.
      const halfWidth = (across * TEAM.gap) / 2 + 0.8;
      const tanHalf = Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * Math.max(0.6, camera.aspect);
      const dist = Math.min(9.6, Math.max(5.6, halfWidth / tanHalf + rows * 0.4));
      flyTo(new T.Vector3(TEAM.x, 1.1 + dist * 0.32 + rows * 0.35, TEAM.z + dist),
        new T.Vector3(TEAM.x, 0.85, TEAM.z - (rows - 1) * TEAM.rowGap * 0.5));
    }
    if (next === "follow" && a) { const v = followView(a); flyTo(v.pos, v.target); }
    if (next === "eyes" && a) { const v = eyesView(a); flyTo(v.pos, v.target); }
    onView(view, followId);
  }
  // Over the shoulder; at the desk the camera looks at the monitor.
  function followView(a: Actor) {
    if (atDesk(a)) {
      const m = monitorOf(a.d!);
      // Low enough to stay under the pendant lamps above the desks.
      return { pos: new T.Vector3(a.d!.x + 1.4, 1.75, a.d!.z + 2.5), target: new T.Vector3(m.x, 0.9, m.z + 0.45) };
    }
    return { pos: a.pos.clone().add(new T.Vector3(2.2, 2.4, 3.2)), target: a.pos.clone().setY(1) };
  }
  function eyesView(a: Actor) {
    const eye = new T.Vector3();
    a.char.eyeAnchor.getWorldPosition(eye);
    const yaw = a.walker.yaw + eyesLook.yaw;
    const fwd = new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    let target: T.Vector3;
    if (atDesk(a) && !eyesLook.yaw && !eyesLook.pitch) { const m = monitorOf(a.d!); target = new T.Vector3(m.x, m.y + 0.12, m.z); }
    else target = eye.clone().addScaledVector(fwd, 3).add(new T.Vector3(0, -0.4 + eyesLook.pitch * 3, 0));
    return { pos: eye.addScaledVector(fwd, 0.05), target };
  }

  // ---------- Frame ----------
  const spotOf = (w: Walker) => (w.state === "seated" || w.state === "settling" ? w.spot?.id ?? null : w.state === "leaving" ? w.slide?.seat?.id ?? null : null);
  const atDesk = (a: Actor) => !!a.d && a.walker.state === "seated" && a.walker.spot?.id === "desk" + a.agent.desk;
  const look = new T.Vector3();
  function resize() {
    if (!container.clientWidth || !container.clientHeight) return;
    width = container.clientWidth;
    height = container.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    draw(performance.now());
  }
  new ResizeObserver(resize).observe(container);
  function draw(ms: number) {
    const dt = Math.min(Math.max((ms - last) / 1000, 0), 0.1);
    last = ms;
    if (!container.clientWidth || !set) return;
    const step = paused ? 0 : dt;
    clock += step;
    const team = view === "team";
    crowd.step(team ? 0 : step);
    const followed = view === "follow" || view === "eyes" ? actors.find(a => a.agent.id === followId) : undefined;
    if ((view === "follow" || view === "eyes") && !followed) setView("office");
    if (fly && followed) {
      // Keep the end of the flight on a moving agent.
      const v = view === "eyes" ? eyesView(followed) : followView(followed);
      if (view === "eyes" || !atDesk(followed)) { fly.p1.copy(v.pos); fly.t1.copy(v.target); }
    }
    if (fly) {
      fly.t = Math.min(1, fly.t + dt / 1.1);
      const k = ease(fly.t);
      camera.position.lerpVectors(fly.p0, fly.p1, k);
      controls.target.lerpVectors(fly.t0, fly.t1, k);
      if (fly.t >= 1) fly = null;
    } else if (followed && view === "eyes") {
      const v = eyesView(followed);
      camera.position.lerp(v.pos, Math.min(1, dt * 10));
      controls.target.lerp(v.target, Math.min(1, dt * 8));
    } else if (followed) {
      // Glide along with the agent; the user can still orbit and zoom around it.
      const delta = followView(followed).target.sub(controls.target).multiplyScalar(Math.min(1, dt * 3));
      controls.target.add(delta);
      camera.position.add(delta);
    }
    if (view === "eyes") camera.lookAt(controls.target);
    else controls.update();
    const occupied: { x: number; y: number }[] = [];
    for (const a of actors) {
      const w = a.walker;
      const lined = team ? teamSpot(actors.indexOf(a)) : null;
      a.pos.set(lined ? lined.x : w.x, 0, lined ? lined.z : w.z);
      a.char.root.position.copy(a.pos);
      a.char.root.rotation.y = lined ? 0 : w.yaw;
      const me = view === "eyes" && a === followed;
      const near = team || camera.position.distanceTo(a.pos) < 5 || hovered === a.agent.id;
      a.char.update(clock, step || (team ? dt : 0), lined ? "stand" : w.pose, {
        status: a.a.status, lookAt: near && !me && (team || a.a.status !== "working") ? camera.position : null, camDist: camera.position.distanceTo(a.pos),
        mode: "office", chair: !lined && atDesk(a) ? set.chairs?.[a.agent.desk!] ?? null : null, spot: lined ? null : spotOf(w),
        settling: !lined && (w.state === "settling" || w.state === "leaving"),
      });
      if (a.label.dataset.status !== actorStatus(a)) updateLabel(a);
      // Compact identity chip under the agent; nudged apart when two overlap on screen.
      const p = a.pos.clone().setY(0.05).project(camera);
      const lx = ((p.x + 1) * width) / 2;
      let ly = ((1 - p.y) * height) / 2 + 14;
      for (const o of occupied) if (Math.abs(o.x - lx) < 46 && Math.abs(o.y - ly) < 26) ly = o.y + 27;
      occupied.push({ x: lx, y: ly });
      const onScreen = !me && p.z < 1 && lx > -40 && lx < width + 40 && ly > -20 && ly < height + 20;
      a.label.hidden = !onScreen;
      a.label.style.transform = `translate(${Math.round(lx)}px, ${Math.round(ly)}px) translate(-50%, -50%)`;
      // Speech bubble above the head.
      const talking = a.bubbleText && clock < a.bubbleUntil;
      a.bubble.hidden = !talking;
      if (talking) {
        if (a.bubble.textContent !== a.bubbleText) a.bubble.textContent = a.bubbleText;
        a.char.head.getWorldPosition(look);
        const bp = look.setY(look.y + 0.55).project(camera);
        const half = a.bubble.offsetWidth / 2;
        const bx = Math.max(half + 8, Math.min(width - half - 8, ((bp.x + 1) * width) / 2));
        a.bubble.style.transform = `translate(${Math.round(bx)}px, ${Math.round(((1 - bp.y) * height) / 2)}px) translate(-50%, -100%)`;
      }
      // "!" marker over the head while the agent needs the user (kept clear of a speech bubble).
      const needs = a.status === "needs" && onScreen;
      a.alert.hidden = !needs || !!talking;
      if (needs && !talking) {
        a.char.head.getWorldPosition(look);
        const mp = look.setY(look.y + 0.5).project(camera);
        a.alert.style.transform = `translate(${Math.round(((mp.x + 1) * width) / 2)}px, ${Math.round(((1 - mp.y) * height) / 2)}px) translate(-50%, -100%)`;
      }
      // Invisible keyboard target over the monitor (clicks on the 3D screen are handled by the raycast).
      if (a.d) {
        const m = monitorOf(a.d);
        const mp = new T.Vector3(m.x, m.y + 0.12, m.z).project(camera);
        a.monitor.style.transform = `translate(${Math.round(((mp.x + 1) * width) / 2)}px, ${Math.round(((1 - mp.y) * height) / 2)}px) translate(-50%, -50%)`;
      }
    }
    if (!paused) stepChats();
    if (!team) helpers?.update(clock, step, camera, atDesk);
    // Dollhouse view: walls between the camera and the room are hidden (seen from inside, all walls stay).
    for (const wall of set.walls) {
      const toCam = camera.position.clone().sub(wall.position).setY(0);
      wall.visible = view === "eyes" || toCam.dot(wall.userData.normal) >= 0;
    }
    positionTooltip();
    renderer.render(scene, camera);
  }
  function animate(ms: number) {
    if (!document.hidden) draw(ms);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
  // WKWebView may suspend animation frames in an unfocused, still-visible window.
  setInterval(() => {
    if (container.clientWidth && !document.hidden && performance.now() - last > 45) draw(performance.now());
  }, 50);

  function rotateCamera(deg: number) {
    const offset = camera.position.clone().sub(controls.target).applyAxisAngle(new T.Vector3(0, 1, 0), (deg * Math.PI) / 180);
    flyTo(controls.target.clone().add(offset), controls.target.clone());
  }
  function zoomCamera(delta: number) {
    const offset = camera.position.clone().sub(controls.target).multiplyScalar(1 - delta * 1.6);
    if (offset.length() < controls.minDistance || offset.length() > controls.maxDistance) return;
    flyTo(controls.target.clone().add(offset), controls.target.clone());
  }

  return {
    achievement(value: boolean) {
      earned = value;
      if (trophy) trophy.visible = value;
    },
    setAgents(list: Agent[]) {
      for (const agent of list) {
        const old = actors.find(x => x.agent.id === agent.id) || pending.find(x => x.id === agent.id);
        if (!old) { if (set) void create(agent); else pending.push(agent); continue; }
        if ("agent" in old) {
          const providerChanged = old.agent.provider !== agent.provider || JSON.stringify([old.agent.look, old.agent.lookSeed]) !== JSON.stringify([agent.look, agent.lookSeed]);
          old.agent = { ...agent, desk: old.agent.desk };
          old.label.dataset.name = agent.name;
          old.a.provider = agent.provider;
          old.monitor.setAttribute("aria-label", "Open " + agent.name + " browser");
          if (providerChanged) {
            // Rebuild the character so the shirt colour / look follows the change.
            scene.remove(old.char.root);
            old.char = Comic.createCharacter(old.agent, old.i) as Character;
            scene.add(old.char.root);
          }
          updateLabel(old);
        }
      }
      // Agents that no longer exist leave the office.
      for (const a of [...actors]) if (!list.some(x => x.id === a.agent.id)) {
        scene.remove(a.char.root);
        a.label.remove(); a.monitor.remove(); a.bubble.remove(); a.alert.remove();
        const w = crowd.agents.findIndex((w: Walker) => w.id === a.agent.id);
        if (w >= 0) { crowd.release(crowd.agents[w]); crowd.agents.splice(w, 1); }
        if (a.d) placeholder(a.ctx, "Free desk", "Hire someone to use it"), (a.screen.needsUpdate = true);
        actors.splice(actors.indexOf(a), 1);
      }
    },
    /** Desk index each agent actually got (so the app can persist it). */
    desks() { return Object.fromEntries(actors.map(a => [a.agent.id, a.agent.desk ?? null])); },
    select(id: string) {
      selected = id;
      actors.forEach(updateLabel);
    },
    state(state: OfficeState) {
      const a = actors.find(x => x.agent.id === state.agentId);
      if (!a) { queuedStates.set(state.agentId, state); return; }
      applyState(a, state);
      updateLabel(a);
    },
    frame(id: string, img: HTMLImageElement) {
      const a = actors.find(x => x.agent.id === id);
      if (!a) return;
      a.ctx.fillStyle = "#0f131b";
      a.ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      a.ctx.drawImage(img, (SCREEN_W - 1024) / 2, 0, 1024, 640);
      a.screen.needsUpdate = true;
    },
    /** Real subagent count for an agent's run (helpers appear on its desk). */
    subagents(id: string, count: number) { helpers?.setDemand(id, count); },
    rotate(delta: number) { rotateCamera(delta); },
    zoom(delta: number) { zoomCamera(delta); },
    overview() { setView("office"); },
    focus(id: string) { setView("follow", id); },
    view(next: View, id?: string) { setView(next, id ?? (followId || selected || null)); },
    currentView() { return { view, id: followId }; },
    /** A short speech bubble over the agent (chat replies). */
    say(id: string, text: string) { const a = actors.find(x => x.agent.id === id); if (a) { a.bubbleText = text; a.bubbleUntil = clock + 6; } },
    coffeeBreak() {
      if (!crowd) return 0;
      let n = 0;
      for (const a of actors) if (!["working", "loading", "paused", "error", "review", "needs"].includes(a.status) && crowd.sendTo(a.agent.id, /^(counter|cafe)/)) n++;
      if (n) onMoment({ text: "Coffee is on. The free agents are heading to the café." });
      return n;
    },
    capacity() { return { desks: DESKS.length, max: DESK_SLOTS.length }; },
    isMoving() { return !paused; },
    motion() { paused = !paused; return !paused; },
  };
}
