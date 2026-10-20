import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createStage, createTrail } from "./scene.js";
import { createAgent, updateAgent, setStatus, poke, setAccessory } from "./agent.js";
import { PALETTES } from "./bean.js";
import { ACCESSORY_NAMES } from "./accessories.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.transmissionResolutionScale = 0.6; // jelly see-through pass at reduced resolution (cheaper)
document.getElementById("stage").append(renderer.domElement);
const { scene, desks, bounds } = createStage(renderer);
const trail = createTrail(scene);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 80);
camera.position.set(0, 7.5, 10.5);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.3, 0); controls.enableDamping = true; controls.maxPolarAngle = 1.45; controls.minDistance = 1.2; controls.maxDistance = 20;

const NAMES = ["Ada", "Milo", "Lena", "Noor", "Heiko", "Mike", "Juno", "Pip", "Ruth", "Kai", "Bea", "Oskar", "Lia", "Tom", "Zoe", "Finn", "Ivy", "Max", "Ona", "Sam"];
const LOOKS = [["headphones"], ["beanie"], ["sunglasses", "bowtie"], ["propeller"], ["party"], ["flower", "laptopShell"], ["laptopShell"], ["bowtie"], ["headphones", "sunglasses"], []];
let palette = "provider", agents = [], selected = null;

function build(count) {
  for (const a of agents) scene.remove(a.group);
  agents = [];
  for (let i = 0; i < count; i++) {
    const provider = i % 2 ? "claude" : "codex";
    const a = createAgent({ name: NAMES[i], provider, color: PALETTES[palette][provider], accessory: LOOKS[i % LOOKS.length], seed: i + 1, desk: desks[i % desks.length] });
    a.pos.set((i % 5 - 2) * 1.2, 0, Math.floor(i / 5) * 1.1 - 0.5);
    scene.add(a.group); agents.push(a);
  }
  select(agents[0]);
  // demo statuses: two at work, one needs you, one waits for review
  if (agents[1]) setStatus(agents[1], "working");
  if (agents[2]) setStatus(agents[2], "needs");
  if (agents[3]) setStatus(agents[3], "review");
  chips();
}
function recolor() {
  for (const a of agents) {
    const c = new THREE.Color(PALETTES[palette][a.provider]), m = a.bean.mesh.material;
    m.attenuationColor.copy(c); m.color.copy(c).lerp(new THREE.Color("#fff"), 0.25); m.sheenColor.copy(c).lerp(new THREE.Color("#fff"), 0.6);
    a.bean.tint.copy(c);
    for (const s of a.bean.stalks) s.stalk.children[0].material.color.copy(c);
  }
  chips();
}
function select(a) { selected = a; document.querySelectorAll("[data-status]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.status === a?.status))); chips(); }
function chips() {
  const el = document.getElementById("chips"); el.replaceChildren();
  for (const a of agents.slice(0, 12)) {
    const b = document.createElement("button"); b.className = "chip"; b.setAttribute("aria-pressed", String(a === selected));
    b.innerHTML = `<span class="dot" style="background:${PALETTES[palette][a.provider]}"></span>${a.name}<small>${a.status === "free" ? "" : a.status}</small>`;
    b.onclick = () => { select(a); follow = a; }; el.append(b);
  }
}

// Click a bean: select + poke (squish, eyes pop in).
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
let downAt = null;
renderer.domElement.addEventListener("pointerdown", e => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener("pointerup", e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
  mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects(agents.map(a => a.group), true)[0];
  if (!hit) return;
  const a = agents.find(x => { let o = hit.object; while (o) { if (o === x.group) return true; o = o.parent; } return false; });
  if (a) { poke(a); select(a); }
});

// UI
const seg = (name, fn) => document.querySelectorAll(`[data-${name}]`).forEach(b => b.onclick = () => { document.querySelectorAll(`[data-${name}]`).forEach(x => x.setAttribute("aria-pressed", String(x === b))); fn(b.dataset[name]); });
seg("palette", v => { palette = v; recolor(); });
seg("count", v => build(+v));
document.querySelectorAll("[data-status]").forEach(b => b.onclick = () => { if (selected) { setStatus(selected, b.dataset.status); select(selected); } });
document.getElementById("poke").onclick = () => selected && poke(selected);
document.getElementById("acc").onclick = () => { if (!selected) return; const cur = ACCESSORY_NAMES.indexOf(selected.accessory[0]); setAccessory(selected, ACCESSORY_NAMES[(cur + 1) % ACCESSORY_NAMES.length]); };
let follow = null;
document.getElementById("close").onclick = () => { follow = selected; };
document.getElementById("overview").onclick = () => { follow = null; camera.position.set(0, 7.5, 10.5); controls.target.set(0, 0.3, 0); };
addEventListener("resize", () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

// Loop + FPS
const clock = new THREE.Clock(); let frames = 0, acc = 0;
const fpsEl = document.getElementById("fps");
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 1 / 20), t = clock.elapsedTime;
  for (const a of agents) updateAgent(a, t, dt, { bounds, trail });
  trail.update(dt);
  if (follow) {
    // from the front-side; at a desk the bean faces the monitor, so look from the side and a bit higher
    // over the shoulder at the desk (it faces the monitor), front-side view while crawling around
    const desk = follow.status !== "free", side = desk ? Math.PI - 0.55 : 0.7, r = desk ? 2.2 : 1.9;
    const want = new THREE.Vector3(Math.sin(follow.heading + side) * r, desk ? 1.5 : 1.1, Math.cos(follow.heading + side) * r).add(follow.pos);
    camera.position.lerp(want, Math.min(1, dt * 2)); controls.target.lerp(follow.pos.clone().setY(0.45), Math.min(1, dt * 4));
  }
  controls.update();
  renderer.render(scene, camera);
  frames++; acc += dt; if (acc > 0.5) { fpsEl.textContent = `${Math.round(frames / acc)} fps · ${agents.length} beans`; frames = 0; acc = 0; }
});
build(6);
document.getElementById("loading").remove();
window.__jelly = { agents, setStatus, poke, select: i => select(agents[i]), follow: i => { follow = agents[i]; } };
