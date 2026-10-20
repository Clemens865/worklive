import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { AGENTS, DESKS, DESK_SLOTS, DESK, ROOM, deskApproach, STATUS, PROVIDER, seatOf, monitorOf } from "./layout.js";
import { openHireDialog } from "./hire.js";
import { createScreen, createPill, createCard, createBeacon, ease } from "./common.js";
import { NavGrid, buildObstacles, buildSpots, AGENT_RADIUS } from "./nav.js";
import { Crowd } from "./crowd.js";
import { createHelpers } from "./helpers.js";

const params = new URLSearchParams(location.search);
const STYLES = { classic: "Classic", game: "Game", comic: "Comic" };
const style = STYLES[params.get("style")] ? params.get("style") : "comic";
const S = await import(`./styles/${style}/index.js`);

const stage = document.getElementById("stage");
const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping; renderer.outputColorSpace = T.SRGBColorSpace;
stage.append(renderer.domElement);

const scene = new T.Scene();
const camera = new T.PerspectiveCamera(42, 1, 0.05, 300);
camera.position.set(21, 21, 25);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.maxPolarAngle = 1.42; controls.minDistance = 0.6; controls.maxDistance = 60;
controls.zoomToCursor = true; controls.screenSpacePanning = false;
controls.target.set(-1, 0.5, 0);

// Base lights; each style tunes (or replaces) them in applyLook.
const hemi = new T.HemisphereLight("#fdf8f0", "#9c978d", 1.0); scene.add(hemi);
const sun = new T.DirectionalLight("#fff1dc", 2.6);
sun.position.set(-6, 14, -12); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 12, bottom: -12, far: 40 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; scene.add(sun);

const set = await S.buildRoom(scene, renderer);
S.applyLook({ scene, renderer, hemi, sun, camera }, set);
const pipeline = S.createPipeline ? S.createPipeline({ renderer, scene, camera }) : null;

// ---------- Agents ----------
// Movement comes from the crowd simulation (nav.js + crowd.js): routes around furniture, personal space, reserved spots.
let grid = new NavGrid(buildObstacles());
const crowd = new Crowd({ grid, spots: buildSpots() });
const deskSpot = (i, pose) => { const s = seatOf(DESKS[i]); return { id: "desk" + i, at: { x: s.x, z: s.z }, yaw: s.yaw, pose, via: deskApproach(s) }; };
// ?crowd=N adds N extra wandering agents (no desk) to stress-test movement and look variety.
const GUESTS = ["Noor", "Tomas", "Lena", "Ravi", "Ines", "Kofi", "Yuki", "Bea", "Otto", "Zara", "Emil", "Priya", "Lars", "Maya", "Jonas", "Clara"];
const everyone = AGENTS.concat(Array.from({ length: Math.min(+params.get("crowd") || 0, GUESTS.length) }, (_, k) =>
  ({ id: "guest-" + GUESTS[k].toLowerCase(), name: GUESTS[k], role: "Guest", provider: k % 2 ? "codex" : "claude", status: "idle", desk: null })));
const actors = [];
const labels = new T.Group(); scene.add(labels);
const freeCards = [];
// Adds one agent to the office (startup, or later from the hire dialog).
function addActor(a, { start } = {}) {
  const i = actors.length;
  const hasDesk = a.desk !== null && a.desk !== undefined, d = hasDesk ? DESKS[a.desk] : null;
  const pill = createPill(a); pill.sprite.userData.pill = true; labels.add(pill.sprite);
  let screen = null, card = null, beacon = null;
  if (hasDesk) {
    screen = createScreen(a);
    set.screens[a.desk].material = new T.MeshBasicMaterial({ map: screen.tex, toneMapped: false });
    card = createCard(a); beacon = createBeacon(a);
    labels.add(card.sprite, beacon.group);
    card.sprite.position.set(d.x, 1.78, d.z - 0.35);
    beacon.group.position.set(d.x + 0.42, 1.42, d.z - 0.3);
    if (freeCards[a.desk]) { labels.remove(freeCards[a.desk].sprite); freeCards[a.desk] = null; }
  }
  const char = S.createCharacter(a, i); scene.add(char.root);
  const home = hasDesk ? deskSpot(a.desk, a.status === "working" ? "type" : "sit") : null;
  const walker = crowd.add({ id: a.id, home, mode: a.status === "idle" || start ? "wander" : "desk", start: start || (a.path ? a.path[0] : undefined), traits: a.traits || [] });
  const actor = { a, i, d, screen, pill, card, beacon, char, walker, pos: new T.Vector3(walker.x, 0, walker.z), yaw: walker.yaw, pose: walker.pose };
  actors.push(actor); addChip(actor);
  return actor;
}
function addChip(ac) {
  const b = document.createElement("button"); b.className = "chip"; b.dataset.id = ac.a.id;
  b.innerHTML = `<span class="av" style="background:${PROVIDER[ac.a.provider].color}">${ac.a.name[0]}</span><span>${ac.a.name} <small>${STATUS[ac.a.status].label}</small></span><span class="st" style="background:${STATUS[ac.a.status].color}"></span>`;
  b.onclick = () => setMode(mode === "pov" ? "pov" : "follow", ac);
  document.getElementById("agents").append(b);
}
for (const a of everyone) addActor(a);

// ---------- Hiring ----------
// Mock only: hires live in this browser's localStorage. In the app they go into agents.json (look, lookSeed, traits).
const HIRES_KEY = "worklive-mock-hires";
const loadHires = () => { try { return JSON.parse(localStorage.getItem(HIRES_KEY)) || []; } catch { return []; } };
const saveHires = list => { try { localStorage.setItem(HIRES_KEY, JSON.stringify(list)); } catch {} };
const freeDesk = () => { const used = new Set(actors.map(ac => ac.a.desk)); const i = DESKS.findIndex((_, k) => !used.has(k)); return i < 0 ? null : i; };
// Office growth: the next pair of desk slots is built (pop-in), after anyone standing there has stepped aside.
const canGrow = () => DESKS.length < DESK_SLOTS.length;
async function growOffice(animated = true) {
  const next = DESK_SLOTS.slice(DESKS.length, DESKS.length + 2);
  const zone = d => ({ x1: d.x - DESK.w / 2 - 0.5, x2: d.x + DESK.w / 2 + 0.5, z1: d.z - DESK.d / 2 - 0.5, z2: d.z + DESK.d / 2 + 1.6 });
  const inZone = w => next.some(d => { const z = zone(d); return w.x > z.x1 && w.x < z.x2 && w.z > z.z1 && w.z < z.z2; });
  if (animated) for (let tries = 0; tries < 20 && crowd.agents.some(inZone); tries++) {
    for (const w of crowd.agents) if (inZone(w) && w.state !== "walking") { const p = crowd.randomFreePoint(); crowd.goTo(w, { id: "loiter", at: p, via: p, yaw: 0, pose: "stand", loiter: true }); }
    await new Promise(r => setTimeout(r, 700));
  }
  for (const d of next) {
    const i = DESKS.length; DESKS.push(d);
    S.addDesk(set, i, d);
    const free = freeCards[i] = createCard({ name: "Free desk", provider: "codex", role: "add an agent", status: "idle", id: "free" + i });
    free.sprite.position.set(d.x, 1.6, d.z - 0.3); free.sprite.scale.multiplyScalar(0.8); labels.add(free.sprite);
  }
  crowd.grid = grid = new NavGrid(buildObstacles());
  // Anyone who ended up inside the new footprint walks out.
  for (const w of crowd.agents) if (!grid.freeAt(w.x, w.z) && w.state !== "seated") crowd.goTo(w, crowd.pickTarget(w));
}
if (!params.has("nohires")) {
  const saved = loadHires();
  while (canGrow() && saved.some(h => h.desk !== null && h.desk >= DESKS.length)) await growOffice(false);
  for (const h of saved) if (!actors.some(ac => ac.a.id === h.id)) addActor(h.desk !== null && actors.some(ac => ac.a.desk === h.desk) ? { ...h, desk: null } : h);
}
const ENTRANCE = { x: -1.5, z: ROOM.maxZ - 0.9 };
const confetti = [];
function welcome(a) {
  const toast = Object.assign(document.createElement("div"), { className: "toast", textContent: `🎉 Welcome to the team, ${a.name}!` });
  document.body.append(toast); setTimeout(() => toast.remove(), 4200);
  const cols = ["#f2c94c", "#e8594a", "#5b7fd6", "#58b368", "#a98bdf", PROVIDER[a.provider].color];
  for (let k = 0; k < 60; k++) {
    const m = new T.Mesh(new T.PlaneGeometry(0.06, 0.035), new T.MeshBasicMaterial({ color: cols[k % cols.length], side: T.DoubleSide }));
    m.position.set(ENTRANCE.x, 1.6, ENTRANCE.z - 0.4); scene.add(m);
    confetti.push({ m, v: new T.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 2.5, -Math.random() * 2), spin: new T.Vector3(Math.random() * 9, Math.random() * 9, 0), life: 2.6 });
  }
}
function stepConfetti(dt) {
  for (let k = confetti.length - 1; k >= 0; k--) {
    const c = confetti[k]; c.life -= dt; c.v.y -= 6 * dt; c.v.multiplyScalar(0.985);
    c.m.position.addScaledVector(c.v, dt); c.m.position.y = Math.max(0.01, c.m.position.y);
    c.m.rotation.x += c.spin.x * dt; c.m.rotation.y += c.spin.y * dt;
    if (c.life <= 0) { scene.remove(c.m); c.m.geometry.dispose(); c.m.material.dispose(); confetti.splice(k, 1); }
  }
}
async function hire(a) {
  if (a.desk === null || a.desk === undefined || actors.some(ac => ac.a.desk === a.desk)) a.desk = freeDesk();
  if (a.desk === null && canGrow()) { await growOffice(); a.desk = freeDesk(); }
  saveHires([...loadHires(), a]);
  // One arrival at a time: wait until nobody is near the entrance.
  for (let k = 0; k < 60 && crowd.agents.some(w => Math.hypot(w.x - ENTRANCE.x, w.z - ENTRANCE.z) < 1.6); k++) await new Promise(r => setTimeout(r, 500));
  const ac = addActor(a, { start: ENTRANCE });
  welcome(a);
  // Walk in, sit at the new desk for a while, then settle into normal office life.
  if (ac.a.desk !== null) { crowd.setMode(a.id, "desk"); setTimeout(() => crowd.setMode(a.id, "wander"), 25000); }
  setMode("follow", ac);
}
window.__hire = hire; window.__crowd = crowd; window.__cam = camera; // debug/tests
document.getElementById("hire-btn").onclick = () => openHireDialog({ S, taken: actors.map(ac => ac.a.name), deskFor: () => freeDesk() ?? (canGrow() ? DESKS.length : null), onHire: hire });
// ?debug=nav: show where agent centres may go (green) and each agent's body disc + route.
const navDebug = params.get("debug") === "nav" ? (() => {
  const pts = [];
  for (let i = 0; i < grid.nx; i += 2) for (let j = 0; j < grid.nz; j += 2) if (grid.free(i, j)) pts.push(grid.x0 + i * 0.1, 0.03, grid.z0 + j * 0.1);
  const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
  scene.add(new T.Points(g, new T.PointsMaterial({ color: "#2fbf71", size: 0.05 })));
  const discs = [], lines = [];
  return { update() {
    for (const [k, ac] of actors.entries()) {
      const w = ac.walker;
      discs[k] ||= scene.add(new T.Mesh(new T.RingGeometry(AGENT_RADIUS - 0.02, AGENT_RADIUS, 32).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: "#e0245e" }))).children.at(-1);
      discs[k].position.set(w.x, 0.04, w.z);
      lines[k] ||= scene.add(new T.Line(new T.BufferGeometry(), new T.LineBasicMaterial({ color: "#1d4ed8" }))).children.at(-1);
      lines[k].geometry.dispose(); lines[k].geometry = new T.BufferGeometry().setFromPoints([new T.Vector3(w.x, 0.05, w.z), ...(w.state === "walking" ? w.path : []).map(p => new T.Vector3(p.x, 0.05, p.z))]);
    }
  } };
})() : null;
// ?place=sam:sofa0&place=juno:armchair1 pins agents into spots (pose checks). Spot ids: nav.js buildSpots + desk<N>.
for (const pin of params.getAll("place")) { const [id, spot] = pin.split(":"); if (!crowd.place(id, spot)) console.warn("place failed", pin); }
// Spot the agent sits in, is sliding into, or is getting up from (null while walking).
const spotOf = w => w.state === "seated" || w.state === "settling" ? w.spot?.id ?? null : w.state === "leaving" ? w.slide?.seat?.id ?? null : null;
const atDesk = ac => ac.d && ac.walker.state === "seated" && ac.walker.spot === ac.walker.home;
// Subagent helpers on the desks of working agents (?helpers=0 turns them off).
const helpers = params.get("helpers") === "0" ? null : createHelpers({ scene, S, actors, freeze: params.get("helperfreeze") });
window.__helpers = helpers;
// Free desks show a quiet "+" card.
for (const [i, d] of DESKS.entries()) if (!AGENTS.some(a => a.desk === i)) {
  const free = freeCards[i] = createCard({ name: "Free desk", provider: "codex", role: "add an agent", status: "idle", id: "free" + i });
  free.sprite.position.set(d.x, 1.6, d.z - 0.3); free.sprite.scale.multiplyScalar(0.8); labels.add(free.sprite);
  free.sprite.userData.free = true;
}

// ---------- Camera modes ----------
let mode = "overview", focus = actors[0], fly = null;
const povLook = { yaw: 0, pitch: 0 };
function setMode(next, actor = focus) {
  mode = next; focus = actor;
  document.querySelectorAll("#cam-seg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cam === next)));
  document.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", String(c.dataset.id === focus.a.id && next !== "overview")));
  document.getElementById("pov").classList.toggle("on", next === "pov");
  document.getElementById("vignette").classList.toggle("on", next === "pov");
  controls.enabled = next !== "pov";
  povLook.yaw = povLook.pitch = 0;
  if (next === "lineup") { const w = Math.min(actors.length, 11) * 1.2; flyTo(new T.Vector3(-1.475, 1.3 + w * 0.08, 4.4 + Math.max(6.8, w * 0.95)), new T.Vector3(-1.475, 0.9, 3.8)); }
  if (next === "overview") flyTo(new T.Vector3(19, 20, 23), new T.Vector3(-1.5, 0.5, 0));
  if (next === "follow") { const { pos, target } = followView(focus); flyTo(pos, target); }
  if (next === "pov") {
    document.getElementById("pov-name").textContent = focus.a.name;
    document.getElementById("pov-sub").textContent = `${PROVIDER[focus.a.provider].name} · ${STATUS[focus.a.status].label}${focus.a.url ? " · " + focus.a.url : ""}`;
    const { pos, target } = povView(focus); flyTo(pos, target, 1.1);
  }
}
function followView(ac) {
  const fwd = new T.Vector3(Math.sin(ac.yaw), 0, Math.cos(ac.yaw)), side = new T.Vector3(fwd.z, 0, -fwd.x);
  const target = atDesk(ac) ? new T.Vector3(ac.d.x, 1.0, ac.d.z - 0.1) : ac.pos.clone().setY(1.1);
  return { pos: ac.pos.clone().addScaledVector(fwd, -2.3).addScaledVector(side, 1.1).setY(2.3), target };
}
function rig(ac) { return ac.char; }
function povView(ac) {
  const eye = new T.Vector3(); rig(ac).eyeAnchor.getWorldPosition(eye);
  const fwd = new T.Vector3(Math.sin(ac.yaw + povLook.yaw), 0, Math.cos(ac.yaw + povLook.yaw));
  let target;
  if (atDesk(ac) && povLook.yaw === 0 && povLook.pitch === 0) { const m = monitorOf(ac.d); target = new T.Vector3(m.x, m.y + 0.12, m.z); }
  else target = eye.clone().addScaledVector(fwd, 3).add(new T.Vector3(0, -0.4 + povLook.pitch * 3, 0));
  return { pos: eye.addScaledVector(fwd, 0.04), target };
}
function flyTo(pos, target, dur = 1.2) {
  if (params.has("snap")) { camera.position.copy(pos); controls.target.copy(target); fly = null; return; }
  fly = { t: 0, dur, p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target };
}

// ---------- Walls cut away when they block the view (dollhouse) ----------
function updateWalls() {
  for (const w of set.walls) {
    const toCam = camera.position.clone().sub(w.position); toCam.y = 0;
    const outside = toCam.dot(w.userData.normal) < 0 && mode !== "pov";
    w.visible = !outside;
  }
}

// ---------- Input ----------
const ray = new T.Raycaster(), ndc = new T.Vector2();
function pick(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(actors.map(ac => rig(ac).root).concat(set.screens), true);
  for (const h of hits) {
    const ac = actors.find(ac => { let o = h.object; while (o) { if (o === rig(ac).root) return true; o = o.parent; } return ac.d && set.screens[ac.a.desk] === h.object; });
    if (ac) return ac;
  }
  return null;
}
let down = null;
renderer.domElement.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener("pointermove", e => {
  if (mode === "pov" && e.buttons === 1) { povLook.yaw -= e.movementX * 0.004; povLook.pitch = Math.max(-0.3, Math.min(0.3, povLook.pitch - e.movementY * 0.003)); }
  else renderer.domElement.style.cursor = pick(e) ? "pointer" : "";
});
renderer.domElement.addEventListener("click", e => {
  if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
  const ac = pick(e); if (ac && mode !== "pov") setMode("follow", ac);
});
renderer.domElement.addEventListener("dblclick", e => { const ac = pick(e); if (ac) setMode("pov", ac); });
const keys = new Set();
addEventListener("keydown", e => { if (e.key === "Escape") setMode(mode === "pov" ? "follow" : "overview"); keys.add(e.key.toLowerCase()); });
addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
document.getElementById("pov-exit").onclick = () => setMode("follow");
document.querySelectorAll("#style-seg button").forEach(b => { b.setAttribute("aria-pressed", String(b.dataset.style === style)); b.onclick = () => { params.set("style", b.dataset.style); location.search = params; }; });
document.querySelectorAll("#cam-seg button").forEach(b => b.onclick = () => setMode(b.dataset.cam));


function resize() { renderer.setSize(innerWidth, innerHeight); pipeline?.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

// ---------- Loop ----------
const clock = new T.Timer();
let screenTimer = 0;
function frame() {
  clock.update(); const dt = Math.min(clock.getDelta(), 0.05), t = clock.getElapsed();
  if (mode !== "lineup") crowd.step(dt);
  stepConfetti(dt);
  navDebug?.update();
  for (const ac of actors) {
    if (mode !== "lineup") { ac.pos.set(ac.walker.x, 0, ac.walker.z); ac.yaw = ac.walker.yaw; ac.pose = ac.walker.pose; }
    const r = ac.char, lineup = mode === "lineup";
    if (lineup) { const cols = Math.min(actors.length, 11), row = Math.floor(ac.i / cols); ac.pos.set(-1.475 + ((ac.i % cols) - (cols - 1) / 2) * 1.2 + row * 0.6, 0, 4.4 - row * 1.5); ac.yaw = 0; ac.pose = "stand"; }
    r.root.position.copy(ac.pos); r.root.rotation.y = ac.yaw;
    const camDist = camera.position.distanceTo(ac.pos);
    const lookAt = (lineup || (mode === "follow" && focus === ac) || camDist < 3.5) && mode !== "pov" ? camera.position : null;
    r.update(t, dt, ac.pose, { status: ac.a.status, lookAt, camDist, mode, chair: atDesk(ac) ? set.chairs?.[ac.a.desk] ?? null : null, spot: spotOf(ac.walker), settling: ac.walker.state === "settling" || ac.walker.state === "leaving" });
    const head = ac.pos.clone().setY(2.05);
    ac.pill.sprite.position.copy(!atDesk(ac) || lineup ? head : new T.Vector3(ac.d.x, 2.3, ac.d.z - 0.3));
    if (ac.beacon) { ac.beacon.update(t, camera); ac.beacon.group.visible = mode !== "pov" && !lineup; }
  }
  if (mode !== "lineup") helpers?.update(t, dt, camera, atDesk);
  // Level of detail: pills far away, full cards close up.
  for (const s of labels.children) if (s.isSprite && s.material.map) {
    const dist = camera.position.distanceTo(s.position);
    const isPill = s.userData.pill;
    const near = T.MathUtils.clamp((11 - dist) / 4, 0, 1);
    s.material.opacity = mode === "pov" ? 0 : mode === "lineup" ? (isPill ? 1 : 0) : isPill ? 1 - near * 0.85 : near;
    s.visible = s.material.opacity > 0.02;
  }
  screenTimer -= dt;
  if (screenTimer <= 0) { screenTimer = 1 / 12; for (const ac of actors) ac.screen?.draw(t); }

  if (fly) {
    fly.t = Math.min(1, fly.t + dt / fly.dur); const k = ease(fly.t);
    camera.position.lerpVectors(fly.p0, fly.p1, k); controls.target.lerpVectors(fly.t0, fly.t1, k);
    if (fly.t >= 1) fly = null;
  } else if (mode === "follow" && !atDesk(focus)) {
    const { target } = followView(focus); const delta = target.clone().sub(controls.target).multiplyScalar(Math.min(1, dt * 3));
    controls.target.add(delta); camera.position.add(delta);
  } else if (mode === "pov") {
    const { pos, target } = povView(focus); camera.position.lerp(pos, Math.min(1, dt * 10)); controls.target.lerp(target, Math.min(1, dt * 8));
  }
  // WASD glides the view over the floor.
  if (mode !== "pov" && keys.size) {
    const f = new T.Vector3(); camera.getWorldDirection(f); f.y = 0; f.normalize(); const r = new T.Vector3(-f.z, 0, f.x);
    const v = new T.Vector3();
    if (keys.has("w")) v.add(f); if (keys.has("s")) v.sub(f); if (keys.has("d")) v.add(r); if (keys.has("a")) v.sub(r);
    if (v.lengthSq()) { v.normalize().multiplyScalar(dt * 6); camera.position.add(v); controls.target.add(v); if (mode === "follow") mode = "overview"; fly = null; }
  }
  if (mode === "pov") camera.lookAt(controls.target); else controls.update();
  updateWalls();
  if (pipeline) pipeline.render(); else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
document.getElementById("loading").style.display = "none";
const startCam = params.get("cam");
if (startCam) setMode(startCam, actors.find(ac => ac.a.id === params.get("agent")) || actors[0]);
else setMode("overview");
frame();
