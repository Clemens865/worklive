// Character workbench: design characters (looks, proportions, finish) in isolation with the office's own builder.
// Whatever is saved here as a look is exactly what the office renders.
import "./lab.css";
import * as T from "three";
import { createStage } from "./scene.js";
import { LOOK_OPTIONS, PROPORTION_RANGE, lookFor } from "../office/styles/comic/looks.js";
import { CLAY } from "../office/styles/comic/toon.js";
import { checkCharacter } from "../office/styles/comic/fitcheck.js";
import { PROVIDER } from "../office/layout.js";

const LABELS = { body: "Body", head: "Head", skin: "Skin", hair: "Hair", hairColor: "Hair colour", eyes: "Eyes", eyeColor: "Eye colour", nose: "Nose",
  top: "Top", glasses: "Glasses", beard: "Beard", moustache: "Moustache", freckles: "Freckles", earrings: "Earrings", headset: "Headset", cap: "Cap", pants: "Trousers", shoes: "Shoes" };
const SWATCH_INDEX = new Set(["skin", "hairColor", "pants", "shoes"]);
const SWATCH_HEX = new Set(["eyeColor"]);
const PROP_LABELS = { height: "Height", width: "Width", belly: "Belly", leg: "Legs", head: "Head size" };
const NAMES = ["Ada", "Milo", "Heiko", "Mike", "Juno", "Sam", "Noor", "Tomas", "Lena", "Ravi", "Ines", "Kofi", "Yuki", "Bea", "Otto", "Zara", "Emil", "Priya", "Lars", "Maya"];

const state = load() || { finish: "clay", light: "studio", pose: "stand", view: "team", count: 6, spin: false, selected: 0, agents: [] };
if (!state.agents.length) state.agents = NAMES.map((n, i) => ({ id: i < 6 ? n.toLowerCase() : "lab-" + n.toLowerCase(), name: n, provider: i % 2 ? "claude" : "codex", status: "idle", look: {} }));
function load() { try { return JSON.parse(localStorage.getItem("worklive-lab") || "null"); } catch { return null; } }
function save() { try { localStorage.setItem("worklive-lab", JSON.stringify(state)); } catch { /* private window */ } }

document.body.insertAdjacentHTML("beforeend", `
  <div id="stage"></div>
  <aside id="panel">
    <h1>Character workbench</h1>
    <p>Same builder as the office. Click a character to edit it; drag to orbit, scroll to zoom.</p>
    <section><h2>Look</h2>
      <div class="row"><span>Finish</span><div class="chips" data-set="finish"><button class="chip" value="comic">Comic</button><button class="chip" value="clay">Clay</button></div></div>
      <div class="row"><span>Light</span><div class="chips" data-set="light"><button class="chip" value="office">Office</button><button class="chip" value="studio">Studio</button></div></div>
      <div id="clay-tune">
        <div class="slider"><span>Lumps</span><input type="range" min="0" max="2.5" step="0.05" data-clay="lumps"><output></output></div>
        <div class="slider"><span>Thumbprints</span><input type="range" min="0" max="3" step="0.05" data-clay="detail"><output></output></div>
        <div class="slider"><span>Warm edges</span><input type="range" min="0" max="2.5" step="0.05" data-clay="warmth"><output></output></div>
      </div>
    </section>
    <section><h2>Scene</h2>
      <div class="row"><span>View</span><div class="chips" data-set="view"><button class="chip" value="team">Lineup</button><button class="chip" value="single">Single</button></div></div>
      <div class="row"><span>Lineup</span><div class="chips" data-set="count"><button class="chip" value="6">6</button><button class="chip" value="12">12</button><button class="chip" value="20">20</button></div></div>
      <div class="row"><span>Pose</span><div class="chips" data-set="pose"><button class="chip" value="stand">Stand</button><button class="chip" value="walk">Walk</button><button class="chip" value="coffee">Coffee</button><button class="chip" value="sit">Sit</button><button class="chip" value="type">Type</button></div></div>
      <div class="row"><span>Turntable</span><div class="chips" data-set="spin"><button class="chip" value="false">Off</button><button class="chip" value="true">On</button></div></div>
      <div id="fit">Fit check runs when seated at the desk (Single view, Sit or Type).</div>
    </section>
    <section id="editor"></section>
  </aside>
  <div id="who"></div><div id="hud"></div>`);

const stage = createStage(document.getElementById("stage"));
let chars = [];
const $ = s => document.querySelector(s);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const visible = () => state.view === "single" ? [state.selected] : [...Array(state.count).keys()];
const withFinish = a => ({ ...a, look: { ...a.look, finish: state.finish } });

// ---------- placement ----------
function spotOf(slot, n) {
  if (state.view === "single") {
    const seated = state.pose === "sit" || state.pose === "type";
    return seated ? { x: stage.DESK_SEAT.x, z: stage.DESK_SEAT.z, yaw: Math.PI } : { x: 0, z: 0, yaw: 0 };
  }
  const perRow = Math.min(n, 10), row = Math.floor(slot / perRow), col = slot % perRow, cols = Math.min(perRow, n - row * perRow);
  return { x: (col - (cols - 1) / 2) * 0.95, z: -row * 1.3, yaw: 0 };
}
function rebuild() {
  for (const c of chars) stage.remove(c);
  const ids = visible();
  chars = ids.map((idx, slot) => { const c = stage.build(withFinish(state.agents[idx]), idx); c.idx = idx; c.name = state.agents[idx].name; c.spot = spotOf(slot, ids.length); return c; });
  const seated = state.pose === "sit" || state.pose === "type";
  stage.setFurniture(state.view === "single" && seated ? "desk" : seated ? "chairs" : "none", state.finish, chars.map(c => c.spot));
  frameCamera();
  paint();
}
function rebuildOne(idx) {
  const i = chars.findIndex(c => c.idx === idx); if (i < 0) return rebuild();
  const old = chars[i]; stage.remove(old);
  const c = stage.build(withFinish(state.agents[idx]), idx); c.idx = idx; c.name = state.agents[idx].name; c.spot = old.spot; chars[i] = c;
}
let framed = "";
function frameCamera() {
  const sig = state.view + state.count + (state.view === "single" ? state.pose : "");
  if (sig === framed) return; framed = sig;
  const { camera, controls } = stage;
  if (state.view === "single") {
    const seated = state.pose === "sit" || state.pose === "type";
    controls.target.set(0, seated ? 0.85 : 0.82, seated ? 0.55 : 0);
    camera.position.set(seated ? 2.6 : 0.4, seated ? 1.7 : 1.25, seated ? 2.4 : 3.3);
  } else {
    const rows = Math.ceil(state.count / 10), wide = Math.min(state.count, 10);
    controls.target.set(0, 0.8, -(rows - 1) * 0.65);
    camera.position.set(0, 1.5 + rows * 0.5, 2.6 + wide * 0.95 + rows * 0.9);
  }
}

// ---------- panel ----------
function paint() {
  for (const box of document.querySelectorAll("[data-set]")) {
    const k = box.dataset.set;
    for (const b of box.children) b.setAttribute("aria-pressed", String(String(state[k]) === b.value));
  }
  $("#clay-tune").hidden = state.finish !== "clay";
  for (const r of document.querySelectorAll("[data-clay]")) { r.value = CLAY[r.dataset.clay].value; r.nextElementSibling.textContent = (+r.value).toFixed(2); }
  paintWho(); paintEditor();
}
function paintWho() {
  const who = $("#who"); who.replaceChildren();
  for (const idx of state.view === "single" ? [...Array(state.count).keys()] : visible()) {
    const a = state.agents[idx], b = el("button", "chip");
    const dot = el("span", "dot"); dot.style.background = PROVIDER[a.provider].color;
    b.append(dot, a.name); b.setAttribute("aria-pressed", String(idx === state.selected));
    b.onclick = () => select(idx); who.append(b);
  }
}
function select(idx) { state.selected = idx; save(); if (state.view === "single") rebuild(); else paint(); }

function paintEditor() {
  const a = state.agents[state.selected], look = lookFor(withFinish(a)), box = $("#editor");
  box.replaceChildren(el("h2", "", `Editing ${a.name}`));
  const name = el("input"); name.value = a.name; name.style.cssText = "font:inherit;padding:5px 8px;border-radius:7px;border:1px solid rgba(24,25,29,.16);width:100%";
  name.onchange = () => { a.name = name.value.trim() || a.name; save(); paintWho(); };
  box.append(row("Name", name));
  box.append(row("Provider", chips(["codex", "claude"], a.provider, v => { a.provider = v; save(); rebuildOne(state.selected); paint(); }, v => PROVIDER[v].name)));
  // proportions
  box.append(el("h2", "", "Proportions"));
  for (const [k, [lo, hi]] of Object.entries(PROPORTION_RANGE)) {
    const s = el("div", "slider"), input = el("input"), out = el("output");
    Object.assign(input, { type: "range", min: lo, max: hi, step: 0.01, value: look.B[k] });
    out.textContent = (+look.B[k]).toFixed(2);
    input.oninput = () => { a.look.shape = { ...(a.look.shape || {}), [k]: +input.value }; out.textContent = (+input.value).toFixed(2); save(); rebuildOne(state.selected); };
    s.append(el("span", "", PROP_LABELS[k]), input, out); box.append(s);
  }
  // look options
  box.append(el("h2", "", "Details"));
  for (const [k, opts] of Object.entries(LOOK_OPTIONS)) {
    const cur = look[k];
    const set = v => { a.look = { ...a.look, [k]: v }; if (k === "body") delete a.look.shape; save(); rebuildOne(state.selected); paintEditor(); };
    if (SWATCH_INDEX.has(k) || SWATCH_HEX.has(k)) {
      const wrap = el("div", "chips");
      opts.forEach((hex, i) => {
        const val = SWATCH_INDEX.has(k) ? i : hex, b = el("button", "sw");
        b.style.background = hex; b.title = hex; b.setAttribute("aria-pressed", String(SWATCH_INDEX.has(k) ? cur % opts.length === i : cur === hex));
        b.onclick = () => set(val); wrap.append(b);
      });
      box.append(row(LABELS[k] || k, wrap));
    } else box.append(row(LABELS[k] || k, chips(opts, cur, set, v => v === null ? "none" : v === false ? "no" : v === true ? "yes" : v)));
  }
  const btns = el("div", "btns");
  btns.append(button("Check this character", () => runCheck(a), true), button("Surprise me", () => surprise(a)), button("Reroll", () => { a.look = {}; a.lookSeed = Math.random().toString(36).slice(2, 10); done(); }),
    button("Reset", () => { a.look = {}; delete a.lookSeed; done(); }), button("Copy look", () => copy(a)));
  box.append(btns, Object.assign(el("div", "", ""), { id: "check" }));
  function done() { save(); rebuildOne(state.selected); paintEditor(); }
}
const row = (label, content) => { const r = el("div", "row"); r.append(el("span", "", label), content); return r; };
function chips(opts, cur, set, label = v => v) {
  const wrap = el("div", "chips");
  for (const v of opts) { const b = el("button", "chip", String(label(v))); b.setAttribute("aria-pressed", String(cur === v || (cur == null && v == null))); b.onclick = () => set(v); wrap.append(b); }
  return wrap;
}
const button = (text, fn, primary) => { const b = el("button", "btn" + (primary ? " primary" : ""), text); b.onclick = fn; return b; };

// The same fit check as tests/character-fit.test.mjs: every pose and status, furniture, floor, hands, outfit layers.
function runCheck(a) {
  const out = $("#check"), t0 = performance.now();
  const issues = checkCharacter({ ...withFinish(a) });
  out.className = issues.length ? "bad" : "ok";
  out.replaceChildren(el("strong", "", issues.length ? `${issues.length} problem${issues.length > 1 ? "s" : ""}` : "Fits everywhere"),
    el("span", "", ` · all poses and statuses, desk, floor, outfit · ${Math.round(performance.now() - t0)} ms`));
  if (issues.length) { const ul = el("ul"); for (const i of issues) ul.append(el("li", "", `${i.what} — ${i.amount} ${i.unit} (${i.pose})`)); out.append(ul); }
}

// A random but complete look, proportions included (within the range the poses fit).
function surprise(a) {
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const look = {};
  for (const [k, opts] of Object.entries(LOOK_OPTIONS)) look[k] = SWATCH_INDEX.has(k) ? Math.floor(Math.random() * opts.length) : pick(opts);
  look.shape = Object.fromEntries(Object.entries(PROPORTION_RANGE).map(([k, [lo, hi]]) => [k, +(lo + Math.random() * (hi - lo)).toFixed(2)]));
  a.look = look; save(); rebuildOne(state.selected); paintEditor();
}
async function copy(a) {
  const text = JSON.stringify({ name: a.name, provider: a.provider, lookSeed: a.lookSeed, look: a.look }, null, 2);
  try { await navigator.clipboard.writeText(text); flash("Look copied"); } catch { prompt("Look JSON", text); }
}
function flash(text) { const f = $("#fit"); const prev = f.textContent; f.textContent = text; setTimeout(() => (f.textContent = prev), 1200); }

for (const box of document.querySelectorAll("[data-set]")) for (const b of box.children) b.onclick = () => {
  const k = box.dataset.set, v = b.value;
  state[k] = k === "count" ? +v : k === "spin" ? v === "true" : v;
  if (k === "count" && state.selected >= state.count) state.selected = 0;
  save();
  if (k === "light") { stage.setLight(state.light); paint(); } else if (k === "spin") paint(); else rebuild();
};
for (const r of document.querySelectorAll("[data-clay]")) r.oninput = () => { CLAY[r.dataset.clay].value = +r.value; r.nextElementSibling.textContent = (+r.value).toFixed(2); state.clay = { ...(state.clay || {}), [r.dataset.clay]: +r.value }; save(); };
for (const [k, v] of Object.entries(state.clay || {})) if (CLAY[k]) CLAY[k].value = v;

// Click a character in the scene to select it.
const ray = new T.Raycaster(), ndc = new T.Vector2(); let down = null;
stage.renderer.domElement.addEventListener("pointerdown", e => (down = [e.clientX, e.clientY]));
stage.renderer.domElement.addEventListener("pointerup", e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
  const r = stage.renderer.domElement.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, stage.camera);
  const hit = ray.intersectObjects(chars.map(c => c.root), true).find(h => !h.object.material.isShaderMaterial);
  if (!hit) return;
  const c = chars.find(c => { for (let o = hit.object; o; o = o.parent) if (o === c.root) return true; return false; });
  if (c && c.idx !== state.selected) select(c.idx);
});

// ---------- loop ----------
const clock = new T.Timer(); let frames = 0, acc = 0, spin = 0, fitT = 0;
function frame() {
  clock.update(); const dt = Math.min(clock.getDelta(), 0.05), t = clock.getElapsed();
  if (state.spin) spin += dt * 0.5;
  for (const c of chars) {
    c.root.position.set(c.spot.x, 0, c.spot.z);
    c.root.rotation.y = c.spot.yaw + (state.view === "single" && c.spot.yaw === 0 ? spin : 0);
    const camDist = stage.camera.position.distanceTo(c.root.position);
    c.update(t, dt, state.pose, { status: "idle", lookAt: state.pose === "stand" ? stage.camera.position : null, camDist, mode: "preview", chair: null, spot: null });
  }
  stage.controls.update();
  stage.renderer.render(stage.scene, stage.camera);
  frames++; acc += dt; fitT += dt;
  if (acc > 0.5) { $("#hud").textContent = `${Math.round(frames / acc)} fps · ${stage.renderer.info.render.calls} draw calls · ${chars.length} characters`; frames = 0; acc = 0; }
  if (fitT > 0.5) { fitT = 0; paintFit(); }
  requestAnimationFrame(frame);
}
function paintFit() {
  const f = $("#fit"), seated = state.pose === "sit" || state.pose === "type";
  if (state.view !== "single" || !seated) { f.className = ""; f.textContent = "Fit check runs when seated at the desk (Single view, Sit or Type)."; return; }
  const hits = stage.fitCheck(chars);
  f.className = hits.length ? "bad" : "ok";
  f.textContent = hits.length ? "Clips: " + [...new Set(hits.map(h => `${h.part} into ${h.what} (${h.cm} cm)`))].slice(0, 4).join(", ") : "Fits the desk and chair: no body part cuts into furniture.";
}

stage.setLight(state.light);
rebuild();
frame();
window.__lab = { state, stage, chars: () => chars, rebuild };
