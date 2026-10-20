// Subagent helpers: while an agent's run has subagents, they appear as mini versions of it on its desk.
// They pop in through a little portal with sparkles, work, then turn into a star that flies into the
// agent's head (result delivered) and vanish in a puff. Driven only by real data: `setDemand(agentId, n)`.
// Worklive's CLI runs currently disable subagents, so nothing calls it yet (no invented activity).
import * as T from "three";
import { PROVIDER, DESK, keyboardZ } from "./layout.js";

const SCALE = 0.3, DESK_TOP = 0.768, APPEAR = 1.0, LEAVE = 1.4;
// Desk-local standing spots on the desk top (front corners; toys sit at the back, mug/mouse on the right).
// Laid out for a 1.9 m desk with the keyboard at z 0.28; scaled to the current DESK size.
const SLOTS = [{ x: -0.74, z: 0.22 }, { x: 0.76, z: 0.24 }, { x: -0.5, z: 0.16 }, { x: -0.52, z: -0.08 }]
  .map(s => ({ x: s.x * DESK.w / 1.9, z: s.z - 0.28 + keyboardZ }));
const TASKS = ["Source check", "Summarise page", "Compare pricing", "Find screenshots", "Draft outline", "Verify quotes"];
const starGeo = new T.OctahedronGeometry(1, 0), puffGeo = new T.SphereGeometry(1, 12, 9), ringGeo = new T.RingGeometry(0.7, 1, 40);
const glow = color => new T.MeshBasicMaterial({ color, transparent: true, depthWrite: false, toneMapped: false });
const clamp01 = x => Math.max(0, Math.min(1, x));
const elastic = x => x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -9 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI) / 3) + 1;

function effects(scene, color) {
  const g = new T.Group(); scene.add(g); g.visible = false;
  const ring = new T.Mesh(ringGeo, glow(color)); ring.rotation.x = -Math.PI / 2; g.add(ring);
  const sparks = Array.from({ length: 14 }, (_, k) => { const m = new T.Mesh(starGeo, glow(k % 3 ? "#fff3b0" : color)); g.add(m); return m; });
  const puffs = Array.from({ length: 7 }, () => { const m = new T.Mesh(puffGeo, glow("#ffffff")); g.add(m); return m; });
  const star = new T.Mesh(starGeo, glow("#ffd84a")); scene.add(star); star.visible = false;
  const trail = Array.from({ length: 8 }, () => { const m = new T.Mesh(starGeo, glow("#fff3b0")); scene.add(m); m.visible = false; return m; });
  const burst = new T.Mesh(ringGeo, glow("#ffd84a")); scene.add(burst); burst.visible = false;
  return { g, ring, sparks, puffs, star, trail, burst };
}

function taskTag(text, color) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64;
  const ctx = c.getContext("2d"), tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
  const sprite = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(0.3, 0.075, 1);
  sprite.userData.draw = (p, text) => {
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.beginPath(); ctx.roundRect(2, 2, 252, 60, 16); ctx.fill();
    ctx.strokeStyle = "#1f2430"; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = "#1f2430"; ctx.font = "700 22px -apple-system,sans-serif"; ctx.fillText(text, 14, 28);
    ctx.fillStyle = "#e6e2da"; ctx.fillRect(14, 40, 228, 10);
    ctx.fillStyle = color; ctx.fillRect(14, 40, 228 * p, 10);
    tex.needsUpdate = true;
  };
  return sprite;
}

// `freeze` (screenshots): "appearing:0.6" pins every helper at 60 % of that phase.
export function createHelpers({ scene, S, actors, random = Math.random, freeze = null }) {
  const demand = new Map(); // agentId -> number of subagents currently running
  const [freezeState, freezeK] = freeze ? [freeze.split(":")[0], +freeze.split(":")[1] || 0.5] : [];
  const crews = [];
  // Crews are built lazily the first time an agent has subagents (actors can be added later).
  function crewFor(ac) {
    let crew = crews.find(c => c.ac === ac);
    if (crew || !ac.d) return crew;
    const color = PROVIDER[ac.a.provider].color;
    const max = SLOTS.length;
    const slots = SLOTS.slice(0, max).map((s, k) => {
      const char = S.createCharacter({ ...ac.a, role: "Subagent" }, 1000 + ac.i * 10 + k);
      char.root.scale.setScalar(0); char.root.visible = false; scene.add(char.root);
      const tag = taskTag("", color); scene.add(tag); tag.visible = false;
      return { k, char, tag, label: "", fx: effects(scene, color), state: "gone", t: 0, wait: 1 + k * 2.2 + random() * 2, work: 0, pos: new T.Vector3(ac.d.x + s.x, DESK_TOP, ac.d.z + s.z) };
    });
    crew = { ac, slots }; crews.push(crew); return crew;
  }
  const head = new T.Vector3(), tmp = new T.Vector3();

  function animateFx(h, t, dt, parentHead) {
    const { fx } = h, p = h.pos;
    fx.g.position.copy(p);
    if (h.state === "appearing") {
      const k = h.t / APPEAR;
      fx.g.visible = true;
      fx.ring.visible = true; fx.ring.scale.setScalar(0.13 * elastic(clamp01(k * 2.2)) * (1 - clamp01((k - 0.7) / 0.3)));
      fx.ring.rotation.z += dt * 6; fx.ring.material.opacity = 0.9;
      fx.sparks.forEach((m, i) => {
        const a = i / fx.sparks.length * Math.PI * 2 + k * 9, r = 0.12 * (1 - k * 0.6), y = k * 0.45 + (i % 4) * 0.03;
        m.visible = k < 0.95; m.position.set(Math.cos(a) * r, y, Math.sin(a) * r); m.scale.setScalar(0.012 * (1 - k) + 0.004); m.rotation.y = t * 8;
      });
      puffs(fx, clamp01((k - 0.35) / 0.5));
    } else if (h.state === "leaving") {
      const k = h.t / LEAVE;
      fx.g.visible = true; fx.ring.visible = false; fx.sparks.forEach(m => (m.visible = false));
      puffs(fx, clamp01((k - 0.15) / 0.4));
      // Star flies along an arc from the desk into the agent's head, then a golden ring pulses there.
      const f = clamp01((k - 0.2) / 0.55);
      fx.star.visible = f > 0 && f < 1;
      const arc = (u, out) => out.lerpVectors(p, parentHead, u).setY(p.y + (parentHead.y - p.y) * u + Math.sin(u * Math.PI) * 0.45);
      arc(f, fx.star.position); fx.star.scale.setScalar(0.03 + Math.sin(f * Math.PI) * 0.02); fx.star.rotation.set(t * 5, t * 7, 0);
      fx.trail.forEach((m, i) => { const u = f - (i + 1) * 0.035; m.visible = fx.star.visible && u > 0; if (m.visible) { arc(u, m.position); m.scale.setScalar(0.014 * (1 - i / fx.trail.length)); } });
      const b = clamp01((k - 0.75) / 0.25);
      fx.burst.visible = b > 0 && b < 1; fx.burst.position.copy(parentHead); fx.burst.quaternion.copy(camQuat);
      fx.burst.scale.setScalar(0.05 + b * 0.25); fx.burst.material.opacity = 1 - b;
    } else { fx.g.visible = false; fx.star.visible = false; fx.burst.visible = false; fx.trail.forEach(m => (m.visible = false)); }
  }
  function puffs(fx, k) {
    fx.puffs.forEach((m, i) => {
      const a = i / fx.puffs.length * Math.PI * 2;
      m.visible = k > 0 && k < 1;
      m.position.set(Math.cos(a) * 0.07 * (0.5 + k), 0.1 + Math.sin(i * 1.7) * 0.04 + k * 0.08, Math.sin(a) * 0.07 * (0.5 + k));
      m.scale.setScalar(0.035 * (0.4 + k) * (1 - k * 0.3)); m.material.opacity = 0.9 * (1 - k);
    });
  }
  let camQuat = new T.Quaternion();

  return {
    states: () => crews.map(c => c.ac.a.id + " active=" + c.active + " frames=" + (c.frames || 0) + " " + c.slots.map(h => `${h.state}:${h.wait.toFixed(1)}`).join(",")),
    count: () => crews.reduce((n, c) => n + c.slots.filter(h => h.state !== "gone").length, 0),
    setDemand(agentId, n) { demand.set(agentId, Math.max(0, Math.min(SLOTS.length, n | 0))); },
    update(t, dt, camera, atDesk) {
      camQuat = camera.quaternion;
      for (const ac of (typeof actors === "function" ? actors() : actors)) if ((demand.get(ac.a.id) || 0) > 0) crewFor(ac);
      for (const crew of crews) {
        const { ac, slots } = crew;
        const want = demand.get(ac.a.id) || 0;
        const active = atDesk(ac) && want > 0; crew.active = active; crew.frames = (crew.frames || 0) + 1;
        ac.char.head.getWorldPosition(head); head.y += 0.12;
        for (const h of slots) {
          h.t += dt;
          if (freezeState) {
            h.state = freezeState; h.label ||= TASKS[h.k % TASKS.length]; h.work = 10; h.char.root.visible = true;
            h.t = freezeK * (freezeState === "appearing" ? APPEAR : freezeState === "leaving" ? LEAVE : 10);
          }
          if (h.state === "gone") {
            if (active && h.k < want && (h.wait -= dt) <= 0) { h.state = "appearing"; h.t = 0; h.work = 7 + random() * 9; h.label = `Subagent ${h.k + 1}`; h.char.root.visible = true; }
          } else if (h.state === "appearing" && h.t >= APPEAR) { h.state = "working"; h.t = 0; }
          else if (h.state === "working" && (!active || h.k >= want)) { h.state = "leaving"; h.t = 0; }
          else if (h.state === "leaving" && h.t >= LEAVE) { h.state = "gone"; h.t = 0; h.wait = 2 + random() * 5; h.char.root.visible = false; }

          const r = h.char.root;
          let s = 0, spin = 0, hop = 0, squash = 1;
          if (h.state === "appearing") { const k = clamp01((h.t / APPEAR - 0.25) / 0.75); s = elastic(k); spin = (1 - k) * Math.PI * 3; }
          else if (h.state === "working") { s = 1; hop = Math.max(0, Math.sin(t * 2.3 + h.k * 2)) > 0.97 ? 0.02 : 0; }
          else if (h.state === "leaving") {
            const k = h.t / LEAVE;
            if (k < 0.15) { s = 1; squash = 1 - Math.sin(k / 0.15 * Math.PI) * 0.25; }
            else { const e = clamp01((k - 0.15) / 0.3); s = 1 - e * e; spin = e * Math.PI * 4; hop = Math.sin(e * Math.PI) * 0.12; }
          }
          r.visible = s > 0.001;
          r.position.set(h.pos.x, h.pos.y + hop, h.pos.z);
          r.scale.set(SCALE * s / Math.sqrt(squash), SCALE * s * squash, SCALE * s / Math.sqrt(squash));
          // Face the agent while working; spin during the magic.
          r.rotation.y = Math.atan2(ac.pos.x - h.pos.x, ac.pos.z - h.pos.z) + spin;
          if (r.visible) h.char.update(t, dt, "stand", { status: "working", lookAt: (Math.sin(t * 0.7 + h.k) > 0.2) ? head : null, camDist: 99, mode: "helper", chair: null, spot: null });
          animateFx(h, t, dt, head);
          // Little task tag with progress above each working helper.
          const near = camera.position.distanceTo(h.pos) < 7;
          h.tag.visible = h.state === "working" && near;
          if (h.tag.visible) {
            h.tag.position.set(h.pos.x, h.pos.y + 0.62, h.pos.z);
            if (!h.drawn || t - h.drawn > 0.25) { h.tag.userData.draw((Math.sin(t * 0.8 + h.k) + 1) / 2 * 0.2 + 0.4, h.label); h.drawn = t; }
          }
        }
      }
    },
  };
}
