import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Agent } from "../../types";
import { PROVIDERS } from "../../types";
import type { OfficeState, Moment, View } from "../../office";
import { DeckWorld, SCALE, type Bot } from "./world";
import { HOME, STATIONS, PLACES } from "./layout";
import { JUNK_KINDS, JUNK_LABEL, type JunkKind } from "./junk";
import { cue, sound } from "./sound";
import { openPosterEditor } from "./poster-editor";

// "Deck 7": a second look for Worklive's office. Same interface as createOffice() in ../../office.ts,
// so the app drives it exactly like the comic office: same agents, run states, live browser frames,
// selection, views and buttons. Only the presentation differs.

const STYLE = `
.deck7-tools { position: absolute; left: 14px; top: 68px; z-index: 6; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; max-width: 60%; pointer-events: none; }
.deck7-tools > * { pointer-events: auto; }
.deck7-tools button { border: 0; border-radius: 999px; padding: 6px 11px; font: 600 12px/1 -apple-system, system-ui, sans-serif; background: rgba(255,255,255,.88); color: #1d1b22; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,.15); }
.deck7-tools button[aria-pressed="true"] { background: #1d1b22; color: #fff; }
.deck7-tools .deck7-title { font: 700 11px/1 -apple-system, system-ui, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.75); margin-right: 2px; }
.deck7-scene.placing canvas { cursor: crosshair; }
`;

export function createDeckOffice(
  container: HTMLElement,
  onSelect: (id: string) => void,
  onOpen: (id: string) => void,
  onMoment: (moment: Moment) => void,
  onView: (view: View, id: string | null) => void = () => {},
) {
  if (!document.getElementById("deck7-style")) { const s = document.createElement("style"); s.id = "deck7-style"; s.textContent = STYLE; document.head.append(s); }
  container.classList.add("deck7-scene");
  const scene = new T.Scene();
  scene.background = new T.Color("#262b34");
  const camera = new T.PerspectiveCamera(38, 1, 0.1, 220);
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.NeutralToneMapping;
  renderer.domElement.setAttribute("aria-label", "Worklive office, Deck 7 style");
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
  const home = { pos: new T.Vector3(...HOME.pos), target: new T.Vector3(...HOME.target) };
  camera.position.copy(home.pos);
  controls.target.copy(home.target);
  let fly: { t: number; p0: T.Vector3; t0: T.Vector3; p1: T.Vector3; t1: T.Vector3 } | null = null;
  const flyTo = (p1: T.Vector3, t1: T.Vector3) => { fly = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1, t1 }; };
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  scene.add(new T.HemisphereLight("#fff1dc", "#3a3f4a", 1.2));
  const key = new T.DirectionalLight("#fff4e6", 1.8);
  key.position.set(-6, 18, 10);
  key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, far: 50 });
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0005;
  scene.add(key);

  const world = new DeckWorld("cartoon", m => onMoment(m));
  scene.add(world.root);

  // ---------- labels, monitor buttons, speech bubbles and "!" markers (same classes as the comic office) ----------
  interface Ui { label: HTMLButtonElement; monitor: HTMLButtonElement; bubble: HTMLDivElement; alert: HTMLButtonElement }
  const ui = new Map<string, Ui>();
  let selected: string | null = null;
  const mood = (s: string) => (s === "working" || s === "loading" ? "working" : s === "error" || s === "paused" || s === "needs" ? "needs" : s === "complete" || s === "review" ? "review" : "idle");
  function statusText(b: Bot) {
    if (b.arriving) return "Being delivered";
    if (b.status === "working") return "Working";
    if (b.status === "loading") return "Opening browser";
    if (b.status === "paused") return "You have control";
    if (b.status === "error") return "Needs attention";
    if (b.status === "needs") return "Needs you" + (b.reason ? ": " + b.reason : "");
    if (b.status === "review") return b.arrived ? "Waiting for your review" : "Heading to the review hatch";
    if (b.moving) return b.plan === "dock" ? "Heading to station" : "On the move";
    const at: Record<string, string> = { dock: "At the station", celebrate: "Result ready", oil: "Getting oil", window: "Staring into space", games: "Playing 80s games", wheel: "Generating power", dance: "Dancing",
      wander: "Wandering", rewire: "Rewiring something", zen: "Raking screws", kick: "Playing football", rest: "Recharging" };
    return at[b.plan] ?? "Settling in";
  }
  function paintLabel(b: Bot) {
    const u = ui.get(b.agent.id)!;
    u.label.replaceChildren();
    const dot = document.createElement("span");
    dot.className = "agent-dot";
    dot.style.background = PROVIDERS[b.agent.provider].color;
    const initials = document.createElement("span");
    initials.className = "agent-initials";
    initials.textContent = b.agent.name.trim().split(/\s+/).map(w => Array.from(w)[0] || "").slice(0, 2).join("").toLocaleUpperCase() || "?";
    const state = document.createElement("span");
    state.className = "agent-state";
    state.dataset.mood = mood(b.status);
    u.label.append(dot, initials, state);
    u.label.dataset.name = b.agent.name;
    u.label.dataset.status = statusText(b);
    u.label.setAttribute("aria-label", `${b.agent.name}, ${PROVIDERS[b.agent.provider].name}, ${statusText(b)}`);
    u.label.setAttribute("aria-pressed", String(selected === b.agent.id));
    u.alert.setAttribute("aria-label", `${b.agent.name} needs you${b.reason ? ": " + b.reason : ""}`);
    u.monitor.setAttribute("aria-label", "Open " + b.agent.name + " browser");
    u.monitor.hidden = !b.station;
  }
  function makeUi(b: Bot) {
    const id = b.agent.id;
    const label = document.createElement("button");
    label.className = "agent-label";
    label.addEventListener("click", () => choose(id));
    const monitor = document.createElement("button");
    monitor.className = "monitor-target";
    monitor.addEventListener("click", () => onOpen(id));
    const bubble = document.createElement("div");
    bubble.className = "speech-bubble";
    bubble.hidden = true;
    const alert = document.createElement("button");
    alert.className = "needs-marker";
    alert.textContent = "!";
    alert.hidden = true;
    alert.addEventListener("click", () => choose(id));
    labels.append(label, monitor, bubble, alert);
    ui.set(id, { label, monitor, bubble, alert });
    paintLabel(b);
  }

  // ---------- views: overview, line-up, follow, through the robot's eyes ----------
  let view: View = "office", followId: string | null = null;
  const bot = (id: string | null) => world.bots.find(b => b.agent.id === id);
  const atDesk = (b: Bot) => !!b.home && b.plan === "dock" && b.arrived && !b.moving;
  function followView(b: Bot) {
    if (atDesk(b)) { const h = b.home!.pos; return { pos: h.clone().add(new T.Vector3(-2.2, 2.3, 3.4)), target: h.clone().add(new T.Vector3(-0.6, 1.3, 0.3)) }; } // in front: face + live hologram
    return { pos: b.mover.position.clone().add(new T.Vector3(2.2, 2.6, 3.4)), target: b.mover.position.clone().setY(1) };
  }
  function eyesView(b: Bot) {
    const eye = b.mover.position.clone().setY(2.05 * SCALE);
    if (atDesk(b)) return { pos: eye, target: b.home!.pos.clone().add(new T.Vector3(-0.98, 1.6, 0.6)) };
    const fwd = new T.Vector3(Math.sin(b.mover.rotation.y), -0.1, Math.cos(b.mover.rotation.y));
    return { pos: eye.clone().addScaledVector(fwd, 0.3), target: eye.clone().addScaledVector(fwd, 4) };
  }
  function setView(next: View, id: string | null = followId || selected || world.bots[0]?.agent.id || null) {
    const b = bot(id);
    if ((next === "follow" || next === "eyes") && !b) next = "office";
    view = next;
    followId = b ? b.agent.id : null;
    controls.enabled = next !== "eyes";
    labels.classList.toggle("team-view", next === "team");
    labels.classList.toggle("eyes-view", next === "eyes");
    if (next === "office") flyTo(home.pos.clone(), home.target.clone());
    if (next === "team") flyTo(new T.Vector3(0, 9, 19), new T.Vector3(0, 1.2, 2.5));
    if (next === "follow" && b) { const v = followView(b); flyTo(v.pos, v.target); }
    if (next === "eyes" && b) { const v = eyesView(b); flyTo(v.pos, v.target); }
    onView(view, followId);
  }
  function choose(id: string) {
    onSelect(id);
    if (view !== "team" && view !== "eyes") setView("follow", id);
    else if (view === "eyes") setView("eyes", id);
  }
  addEventListener("keydown", e => {
    if (e.key !== "Escape" || !container.isConnected || !container.clientWidth) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest("input, textarea, select, dialog")) return;
    if (view !== "office") setView(view === "eyes" ? "follow" : "office");
  });
  function rotateCamera(deg: number) {
    const offset = camera.position.clone().sub(controls.target).applyAxisAngle(new T.Vector3(0, 1, 0), (deg * Math.PI) / 180);
    flyTo(controls.target.clone().add(offset), controls.target.clone());
  }
  function zoomCamera(delta: number) {
    const offset = camera.position.clone().sub(controls.target).multiplyScalar(1 - delta * 1.6);
    if (offset.length() < controls.minDistance || offset.length() > controls.maxDistance) return;
    flyTo(controls.target.clone().add(offset), controls.target.clone());
  }

  // ---------- junk toolbar (Deck 7 only; purely local fun) ----------
  const tools = document.createElement("div");
  tools.className = "deck7-tools";
  tools.innerHTML = `<span class="deck7-title">Junk</span>${JUNK_KINDS.map(k => `<button type="button" data-junk="${k}" aria-pressed="false">${JUNK_LABEL[k]}</button>`).join("")}<button type="button" data-janitor>Call Janitor-9</button><span class="deck7-title" title="Click a poster on the wall to change it">Posters: click one</span><span class="deck7-title">Sound</span><button type="button" data-sound="beeps" aria-pressed="${sound.beeps}">Beeps</button><button type="button" data-sound="ambient" aria-pressed="${sound.ambient}">Ambient</button>`;
  container.append(tools);
  let armed: JunkKind | null = null;
  tools.querySelectorAll<HTMLButtonElement>("[data-junk]").forEach(b => (b.onclick = () => {
    armed = armed === b.dataset.junk ? null : (b.dataset.junk as JunkKind);
    tools.querySelectorAll<HTMLButtonElement>("[data-junk]").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.junk === armed)));
    container.classList.toggle("placing", !!armed);
  }));
  tools.querySelector<HTMLButtonElement>("[data-janitor]")!.onclick = () => world.cleanUp();
  tools.querySelectorAll<HTMLButtonElement>("[data-sound]").forEach(b => (b.onclick = () => {
    const on = b.getAttribute("aria-pressed") !== "true";
    if (b.dataset.sound === "beeps") sound.setBeeps(on); else sound.setAmbient(on);
    b.setAttribute("aria-pressed", String(on));
  }));

  // ---------- picking: click a robot to choose it, a holo screen to open the browser, the floor to drop junk ----------
  const ray = new T.Raycaster();
  const floor = new T.Plane(new T.Vector3(0, 1, 0), 0);
  let downAt: { x: number; y: number } | null = null;
  function hit(e: MouseEvent) {
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    for (const b of world.bots) if (b.station && ray.intersectObject(b.station.holo.mesh, true).length) return { b, monitor: true };
    let best: Bot | null = null, bestD = Infinity;
    for (const b of world.bots) {
      const d = ray.ray.distanceToPoint(b.mover.position.clone().setY(0.9));
      if (d < 0.7 && d < bestD) { best = b; bestD = d; }
    }
    return best ? { b: best, monitor: false } : null;
  }
  renderer.domElement.addEventListener("pointerdown", e => { downAt = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener("click", e => {
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return; // that was a drag
    if (armed) {
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const p = ray.ray.intersectPlane(floor, new T.Vector3());
      if (p && Math.abs(p.x) < 10.2 && p.z > -6.8 && p.z < 11.2) world.drop(armed, p);
      return;
    }
    // a poster on the wall: open the poster editor
    const r2 = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new T.Vector2(((e.clientX - r2.left) / r2.width) * 2 - 1, -((e.clientY - r2.top) / r2.height) * 2 + 1), camera);
    const poster = ray.intersectObjects(world.posters.meshes, false)[0];
    const h = hit(e);
    if (poster && (!h || poster.distance < h.b.mover.position.distanceTo(camera.position))) {
      openPosterEditor(world.posters, poster.object.userData.poster, text => onMoment({ text }));
      return;
    }
    if (!h) return;
    if (h.monitor && view !== "team") onOpen(h.b.agent.id);
    else { h.b.input.poke++; cue("click"); choose(h.b.agent.id); }
  });
  renderer.domElement.addEventListener("dblclick", e => { const h = hit(e); if (h && !h.monitor) { onSelect(h.b.agent.id); setView("eyes", h.b.agent.id); } });

  // ---------- frame loop ----------
  let width = 1, height = 1, paused = false, clock = 0, last = performance.now();
  function resize() {
    width = Math.max(1, container.clientWidth); height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = width + "px";
    renderer.domElement.style.height = height + "px";
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();
  const tmp = new T.Vector3();
  const toScreen = (p: T.Vector3) => { tmp.copy(p).project(camera); return { x: ((tmp.x + 1) * width) / 2, y: ((1 - tmp.y) * height) / 2, front: tmp.z < 1 }; };
  function animate(now: number) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!container.isConnected || !container.clientWidth) return; // hidden: don't spend anything
    if (!paused) { clock += dt; try { world.update(dt, clock); } catch (e) { console.error("Deck 7 office: update failed", e); } }
    if (fly) {
      fly.t = Math.min(1, fly.t + dt / 0.9);
      const k = ease(fly.t);
      camera.position.lerpVectors(fly.p0, fly.p1, k);
      controls.target.lerpVectors(fly.t0, fly.t1, k);
      if (fly.t >= 1) fly = null;
    } else if ((view === "follow" || view === "eyes") && bot(followId)) {
      const b = bot(followId)!, v = view === "follow" ? followView(b) : eyesView(b);
      camera.position.lerp(v.pos, Math.min(1, dt * 3));
      controls.target.lerp(v.target, Math.min(1, dt * 3));
    }
    if (view === "eyes") camera.lookAt(controls.target); else controls.update();
    renderer.render(scene, camera);
    // DOM overlays
    for (const b of world.bots) {
      const u = ui.get(b.agent.id);
      if (!u) continue;
      const head = toScreen(b.mover.position.clone().setY(2.25 * SCALE + 0.35));
      const show = head.front && !b.arriving;
      u.label.hidden = !show || view === "eyes";
      if (show) u.label.style.transform = `translate(${Math.round(head.x)}px, ${Math.round(head.y)}px) translate(-50%, -50%)`;
      const talking = b.bubbleText && clock < b.bubbleUntil && show;
      u.bubble.hidden = !talking;
      if (talking) {
        if (u.bubble.textContent !== b.bubbleText) u.bubble.textContent = b.bubbleText;
        u.bubble.style.transform = `translate(${Math.round(head.x)}px, ${Math.round(head.y - 18)}px) translate(-50%, -100%)`;
      }
      const needs = ["needs", "error"].includes(b.status);
      u.alert.hidden = !needs || !!talking || !show;
      if (!u.alert.hidden) u.alert.style.transform = `translate(${Math.round(head.x)}px, ${Math.round(head.y - 22)}px) translate(-50%, -100%)`;
      if (b.station) {
        const m = toScreen(b.station.group.position.clone().add(new T.Vector3(-0.98, 1.72, 0.55)));
        u.monitor.hidden = !m.front || view === "team";
        if (!u.monitor.hidden) u.monitor.style.transform = `translate(${Math.round(m.x)}px, ${Math.round(m.y)}px) translate(-50%, -50%)`;
      }
      if (u.label.dataset.status !== statusText(b)) paintLabel(b);
    }
  }
  requestAnimationFrame(animate);

  // ---------- the same interface as createOffice() ----------
  // Every call is fail-safe: main.ts calls the office from inside the worker-event channel, and an
  // exception there would stall all later worker events (browser state, frames, take control).
  const safe = <A extends unknown[], R>(name: string, fn: (...a: A) => R, fallback: R) => (...args: A): R => {
    try { return fn(...args); } catch (e) { console.error(`Deck 7 office: ${name} failed`, e); return fallback; }
  };
  let first = true;
  const queued = new Map<string, OfficeState>();
  const apply = (s: OfficeState) => world.setStatus(s.agentId, s.owner === "user" && s.status === "idle" ? "paused" : s.status, s.reason || "");
  const api = {
    achievement(value: boolean) { world.achievement(value); },
    setAgents(list: Agent[]) {
      for (const agent of list) {
        if (world.bots.some(b => b.agent.id === agent.id)) { world.updateAgent(agent); continue; }
        if (world.bots.length >= STATIONS.length + PLACES.loiter.length) continue;
        const b = world.addAgent({ ...agent }, !first && !!agent.fresh);
        makeUi(b);
        const q = queued.get(agent.id);
        if (q) { queued.delete(agent.id); apply(q); }
      }
      for (const b of [...world.bots]) if (!list.some(a => a.id === b.agent.id)) {
        const u = ui.get(b.agent.id);
        if (u) { u.label.remove(); u.monitor.remove(); u.bubble.remove(); u.alert.remove(); ui.delete(b.agent.id); }
        world.removeAgent(b.agent.id);
      }
      first = false;
    },
    /** Desk index each agent actually got (so the app can persist it). */
    desks() { return Object.fromEntries(world.bots.map(b => [b.agent.id, b.desk])); },
    select(id: string) { selected = id; world.bots.forEach(paintLabel); },
    state(state: OfficeState) {
      if (!world.bots.some(b => b.agent.id === state.agentId)) { queued.set(state.agentId, state); return; }
      apply(state);
      const b = bot(state.agentId);
      if (b) paintLabel(b);
    },
    frame(id: string, img: HTMLImageElement) { world.frame(id, img); },
    subagents(id: string, count: number) { world.subagents(id, count); },
    rotate(delta: number) { rotateCamera(delta); },
    zoom(delta: number) { zoomCamera(delta); },
    overview() { setView("office"); },
    focus(id: string) { setView("follow", id); },
    view(next: View, id?: string) { setView(next, id ?? (followId || selected || null)); },
    currentView() { return { view, id: followId }; },
    say(id: string, text: string) { const b = bot(id); if (b) world.say(b, text, 6); },
    coffeeBreak() {
      const n = world.coffeeBreak();
      if (n) onMoment({ text: "Oil is on. The free robots are heading to the dispenser. It will be lukewarm." });
      return n;
    },
    capacity() { return { desks: STATIONS.length, max: STATIONS.length }; },
    isMoving() { return !paused; },
    motion() { paused = !paused; return !paused; },
  };
  return {
    achievement: safe("achievement", api.achievement, undefined),
    setAgents: safe("setAgents", api.setAgents, undefined),
    desks: safe("desks", api.desks, {} as Record<string, number | null>),
    select: safe("select", api.select, undefined),
    state: safe("state", api.state, undefined),
    frame: safe("frame", api.frame, undefined),
    subagents: safe("subagents", api.subagents, undefined),
    rotate: safe("rotate", api.rotate, undefined),
    zoom: safe("zoom", api.zoom, undefined),
    overview: safe("overview", api.overview, undefined),
    focus: safe("focus", api.focus, undefined),
    view: safe("view", api.view, undefined),
    currentView: safe("currentView", api.currentView, { view: "office" as View, id: null as string | null }),
    say: safe("say", api.say, undefined),
    coffeeBreak: safe("coffeeBreak", api.coffeeBreak, 0),
    capacity: api.capacity,
    /** Dev only (deck7-lab): the simulation, for measuring behaviour. */
    debugWorld: () => world,
    debugCamera: () => camera,
    isMoving: api.isMoving,
    motion: api.motion,
  };
}
