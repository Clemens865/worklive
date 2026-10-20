// One jelly snail agent: crawling, springs (squash/lean), eyes, statuses, poke.
import * as THREE from "three";
import { createBean, deformPoint, HEAD, mulberry } from "./bean.js";
import { ACCESSORIES } from "./accessories.js";

const tmp = new THREE.Vector3();
const exclaim = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
  x.fillStyle = "#f5a524"; x.beginPath(); x.arc(64, 64, 56, 0, Math.PI * 2); x.fill();
  x.lineWidth = 8; x.strokeStyle = "#fff"; x.stroke();
  x.fillStyle = "#fff"; x.font = "bold 84px system-ui"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("!", 64, 70);
  return new THREE.CanvasTexture(c);
})();

export function createAgent({ name, provider, color, accessory, seed, desk }) {
  const bean = createBean(color, { seed });
  const rnd = mulberry(seed * 13 + 1);
  const a = {
    name, provider, desk, bean, group: bean.group, status: "free",
    pos: new THREE.Vector3(), heading: rnd() * Math.PI * 2, speed: 0, target: null, wait: rnd() * 3,
    squash: 0, squashV: 0, lean: new THREE.Vector2(), leanV: new THREE.Vector2(),
    eyeOut: 1, eyeOutV: 0, blink: 2 + rnd() * 3, trailT: 0, rnd, accessory: null, acc: [],
  };
  a.alert = new THREE.Sprite(new THREE.SpriteMaterial({ map: exclaim, depthTest: false }));
  a.alert.scale.setScalar(0.26); a.alert.visible = false; a.group.add(a.alert);
  setAccessory(a, accessory);
  return a;
}

export function setAccessory(a, names) {
  for (const g of a.acc) g.parent?.remove(g);
  a.acc = [];
  a.accessory = [].concat(names).filter(Boolean); a.glasses = null;
  for (const n of a.accessory) {
    const g = ACCESSORIES[n]?.(); if (!g) continue;
    if (g.userData.onEyes) { g.position.set(0, 0.125, 0.1); g.scale.x = 1.45; a.bean.head.add(g); a.glasses = g; }   // across both eyes
    else if (g.userData.onBack) a.bean.group.add(g), g.position.add(new THREE.Vector3(0, 0.62, 0.05));
    else a.bean.head.add(g);
    a.acc.push(g);
  }
}

export function poke(a) {
  a.squashV -= 3.2;           // squish down…
  a.eyeOutV -= 9;             // …and the eyes pop in, like a real snail
  a.leanV.x += (a.rnd() - 0.5) * 2;
}

// Desk for working/review/needs; free agents wander.
export function setStatus(a, status) {
  a.status = status;
  a.target = status === "free" ? null : a.desk.seat.clone();
  a.wait = 0;
  if (status !== "free") a.squashV += 1.2; // a little hop of surprise
}

function spring(x, v, target, k, c, dt) { const acc = -k * (x - target) - c * v; v += acc * dt; x += v * dt; return [x, v]; }

export function updateAgent(a, t, dt, ctx) {
  const atDesk = a.status !== "free" && a.target && a.pos.distanceTo(a.target) < 0.08;
  // ----- choose where to go -----
  if (a.status === "free" && !a.target) {
    a.wait -= dt;
    if (a.wait <= 0) a.target = new THREE.Vector3((a.rnd() * 2 - 1) * ctx.bounds.x, 0, (a.rnd() * 2 - 1) * ctx.bounds.z * 0.7 + 0.4);
  }
  // ----- crawl -----
  let wantSpeed = 0, turn = 0;
  if (a.target && !atDesk) {
    tmp.subVectors(a.target, a.pos); tmp.y = 0;
    const dist = tmp.length(), want = Math.atan2(tmp.x, tmp.z);
    let d = want - a.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
    turn = THREE.MathUtils.clamp(d, -1, 1) * 1.6;
    wantSpeed = Math.min(0.42, dist * 0.8) * Math.max(0.15, Math.cos(d));
    if (dist < 0.05) { if (a.status === "free") { a.target = null; a.wait = 2 + a.rnd() * 6; } else a.pos.copy(a.target); }
  } else if (atDesk) {
    let d = a.desk.face - a.heading; d = Math.atan2(Math.sin(d), Math.cos(d)); turn = d * 3;
  }
  const prevSpeed = a.speed;
  a.speed += (wantSpeed - a.speed) * Math.min(1, dt * 3);
  a.heading += turn * dt;
  a.pos.x += Math.sin(a.heading) * a.speed * dt; a.pos.z += Math.cos(a.heading) * a.speed * dt;
  a.group.position.copy(a.pos); a.group.rotation.y = a.heading;
  // ----- jelly springs -----
  const accel = (a.speed - prevSpeed) / Math.max(dt, 1e-3);
  a.leanV.y -= accel * 0.9 * dt * 60 * 0.016;    // speeding up: top lags back; stopping: top sloshes forward
  a.leanV.x -= turn * a.speed * 0.5 * dt;          // turning: top swings outward
  let sqTarget = 0;
  if (a.status === "working" && atDesk) sqTarget = 0.02 + 0.02 * Math.sin(t * 7);               // typing bob
  if (a.status === "review" && atDesk) { a.leanV.x += Math.sin(t * 3) * 0.6 * dt; sqTarget = -0.04; } // proud happy sway, a bit taller
  if (a.status === "needs") { if ((t + a.rnd() * 0.01) % 1.4 < dt) a.squashV += 2.4; }         // keeps bouncing for attention
  [a.squash, a.squashV] = spring(a.squash, a.squashV, sqTarget, 120, 5, dt);
  [a.lean.x, a.leanV.x] = spring(a.lean.x, a.leanV.x, 0, 90, 4.5, dt);
  [a.lean.y, a.leanV.y] = spring(a.lean.y, a.leanV.y, 0, 90, 4.5, dt);
  a.squash = THREE.MathUtils.clamp(a.squash, -0.35, 0.45);
  const u = a.bean.uniforms;
  u.uTime.value = t; u.uSquash.value = a.squash; u.uLean.value.set(a.lean.x * 0.25, a.lean.y * 0.25);
  u.uCrawl.value += ((a.speed > 0.03 ? 1 : 0) - u.uCrawl.value) * Math.min(1, dt * 4);
  // head (eyes, hats) follows the same deformation as the body
  deformPoint(a.bean.head.position, HEAD.top, u);
  a.bean.inner.scale.set(1 + a.squash * 0.55, 1 - a.squash, 1 + a.squash * 0.55);
  // ----- eyes -----
  [a.eyeOut, a.eyeOutV] = spring(a.eyeOut, a.eyeOutV, 1, 40, 7, dt);
  const out = THREE.MathUtils.clamp(a.eyeOut, 0.2, 1.25);
  a.blink -= dt; const closing = a.blink < 0.12; if (a.blink < 0) a.blink = 2.5 + a.rnd() * 4;
  for (const s of a.bean.stalks) {
    s.stalk.scale.y = out;
    s.eye.scale.y = 1 / Math.max(out, 0.6); s.lid.visible = closing;  // blink: the lid covers the eye
    s.stalk.rotation.x = -a.lean.y * 0.6 + (a.status === "working" && atDesk ? 0.35 : 0);  // look down at the screen while working
    s.stalk.rotation.z = -s.side * (0.18 + (a.status === "needs" ? 0.25 : 0)) - a.lean.x * 0.5 + Math.sin(t * 1.3 + s.side + a.rnd() * 0.001) * 0.04;
  }
  if (a.glasses) a.glasses.position.y = 0.125 * out - 0.03 * (1 - out);  // glasses ride down with retracting eyes
  for (const g of a.acc) if (g.userData.spin) g.userData.spin.rotation.y += dt * (4 + a.speed * 30);
  // ----- status extras -----
  a.alert.visible = a.status === "needs";
  if (a.alert.visible) a.alert.position.set(0, 1.2 + Math.sin(t * 4) * 0.04, HEAD.top.z);
  a.desk.screen.emissiveIntensity = a.status === "working" && atDesk ? 0.55 + 0.1 * Math.sin(t * 9) : a.status === "review" && atDesk ? 0.35 : 0;
  a.desk.screen.emissive.set(a.status === "review" ? "#8b6cf0" : "#6aa7ff");
  // ----- slime trail -----
  a.trailT -= a.speed * dt;
  if (a.trailT < 0) { a.trailT = 0.09; ctx.trail.drop(a.pos.x - Math.sin(a.heading) * 0.3, a.pos.z - Math.cos(a.heading) * 0.3, a.bean.tint, -a.heading); }
}
