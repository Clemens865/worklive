import * as T from "three";
import { ROOM, DESKS, MEETING } from "../../layout.js";
import { rb, cy, PAL } from "./room.js";
import { toon, flat, part, geo } from "./toon.js";
import { sphere } from "./shapes.js";
import { addBox } from "./colliders.js";

// Posters, skyline, lamps, shelves, clock. Plus a tiny per-frame tick via onBeforeRender.
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}

const POSTERS = [
  (g, w, h) => { g.fillStyle = "#f7c948"; g.fillRect(0, 0, w, h); g.fillStyle = "#e8594a"; g.beginPath(); g.arc(w / 2, h * 0.42, w * 0.3, 0, 7); g.fill();
    g.fillStyle = "#231a1e"; g.font = `900 ${w * 0.13}px sans-serif`; g.textAlign = "center"; g.fillText("SHIP IT!", w / 2, h * 0.86);
    g.fillStyle = "#fff"; g.beginPath(); g.moveTo(w * 0.42, h * 0.3); g.lineTo(w * 0.62, h * 0.42); g.lineTo(w * 0.42, h * 0.54); g.fill(); },
  (g, w, h) => { g.fillStyle = "#7ec8e3"; g.fillRect(0, 0, w, h); for (let i = 0; i < 5; i++) { g.fillStyle = ["#fff", "#f7c948", "#e8594a", "#a98bdf", "#58b368"][i]; g.beginPath(); g.arc(w * (0.2 + i * 0.15), h * (0.3 + (i % 2) * 0.2), w * 0.09, 0, 7); g.fill(); }
    g.fillStyle = "#23324a"; g.font = `900 ${w * 0.12}px sans-serif`; g.textAlign = "center"; g.fillText("TEAMWORK", w / 2, h * 0.85); },
  (g, w, h) => { g.fillStyle = "#a98bdf"; g.fillRect(0, 0, w, h); g.fillStyle = "#fffaf0"; g.font = `900 ${w * 0.3}px sans-serif`; g.textAlign = "center"; g.fillText("☕", w / 2, h * 0.55);
    g.font = `900 ${w * 0.11}px sans-serif`; g.fillText("BREAK TIME", w / 2, h * 0.85); },
  (g, w, h) => { g.fillStyle = "#58b368"; g.fillRect(0, 0, w, h); g.fillStyle = "#f7c948";
    g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? w * 0.13 : w * 0.3, a = i * Math.PI / 5 - Math.PI / 2; g.lineTo(w / 2 + Math.cos(a) * r, h * 0.42 + Math.sin(a) * r); } g.fill();
    g.fillStyle = "#fff"; g.font = `900 ${w * 0.12}px sans-serif`; g.textAlign = "center"; g.fillText("YOU ROCK", w / 2, h * 0.87); },
];

function poster(parent, i, x, y, w, h, rot = 0) {
  const half = (parent.userData.name === "front" ? ROOM.maxX - ROOM.minX : ROOM.maxZ - ROOM.minZ) / 2 - w;
  x = Math.max(-half, Math.min(half, x));
  const tex = canvasTex(256, Math.round(256 * h / w), POSTERS[i % POSTERS.length]);
  rb(w + 0.08, h + 0.08, 0.04, PAL.navy, x, y, 0.14, parent, 0.015, 0.008).rotation.z = rot;
  const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, 0.165); m.rotation.z = rot; parent.add(m);
}

function skyline(scene) {
  const g = new T.Group(); g.name = "skyline"; scene.add(g);
  const cols = ["#f4a6a0", "#f7d08a", "#9fd5e8", "#b9a7e0", "#a8dcb0", "#f6c3dd"];
  const winTex = canvasTex(64, 128, (c, w, h) => { c.fillStyle = "#fff"; c.fillRect(0, 0, w, h); c.fillStyle = "#6c7fa8";
    for (let i = 0; i < 3; i++) for (let j = 0; j < 7; j++) if ((i * 5 + j * 3) % 4) { c.beginPath(); c.roundRect(8 + i * 18, 8 + j * 17, 12, 11, 3); c.fill(); } });
  winTex.wrapS = winTex.wrapT = T.RepeatWrapping;
  for (let i = 0; i < 24; i++) {
    const span = ROOM.maxX - ROOM.minX + 70, h = 6 + ((i * 37) % 17), w = 3 + (i % 3);
    const x = ROOM.minX - 35 + (i + 0.5) * span / 24, z = ROOM.minZ - 15 - (i % 4) * 6;
    const tex = winTex.clone(); tex.repeat.set(w / 3, h / 6); tex.needsUpdate = true;
    const b = new T.Mesh(geo(`bld${w},${h}`, () => new T.BoxGeometry(w, h, 3)), new T.MeshToonMaterial({ color: cols[i % 6], map: tex }));
    b.position.set(x, h / 2 - 3, z); g.add(b);
    if (i % 3 === 0) { const r = new T.Mesh(geo("roof", () => new T.ConeGeometry(1.8, 1.5, 4)), toon(cols[(i + 2) % 6])); r.position.set(x, h - 3 + 0.75, z); r.rotation.y = Math.PI / 4; g.add(r); }
  }
  // Puffy clouds
  for (let i = 0; i < 6; i++) for (let k = 0; k < 4; k++)
    part(sphere(12), toon("#ffffff", { rim: 0 }), g, { pos: [-36 + i * 14 + k * 1.6, 16 + (i % 3) * 3 + (k % 2) * 0.8, -40], scale: 1.6 + (k % 2), ink: 0, shadow: false });
  const ground = new T.Mesh(new T.PlaneGeometry(400, 400), toon("#9ed49a", { rim: 0 })); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -3.05, 0); g.add(ground);
}

function pendant(root, x, z, color) {
  cy(0.008, 0.008, 1.0, PAL.ink, x, ROOM.height - 0.5, z, root, 6, 0);
  const s = cy(0.08, 0.32, 0.26, color, x, ROOM.height - 1.1, z, root, 24, 0.01); s.castShadow = false;
  const bulb = part(sphere(12), flat("#fff6d8"), root, { pos: [x, ROOM.height - 1.24, z], scale: 0.1, ink: 0, shadow: false });
}

export function buildDecor(scene, root, { left, right, back, front }) {
  skyline(scene);
  // Left wall: bookshelf + posters
  for (let i = 0; i < 2; i++) {
    const sx = -2.3 + i * 1.4;
    for (let s = 0; s < 4; s++) rb(1.3, 0.06, 0.36, PAL.wood, sx, 0.35 + s * 0.52, 0.28, left, 0.02, 0.008);
    for (const e of [-0.65, 0.65]) rb(0.06, 2.0, 0.36, PAL.woodDark, sx + e, 1.0, 0.28, left, 0.02, 0.008);
    for (let s = 0; s < 4; s++) for (let b = 0; b < 6; b++) if ((b + s + i) % 4) {
      const book = rb(0.08, 0.28 + (b % 3) * 0.04, 0.24, ["#e8594a", "#f7c948", "#7ec8e3", "#a98bdf", "#58b368", "#f5e6c8"][(b + s * 2 + i) % 6], sx - 0.5 + b * 0.18, 0.53 + s * 0.52 + (b % 3) * 0.02, 0.28, left, 0.012, 0.006);
      if (b === 5) book.rotation.z = 0.35;
    }
  }
  addBox("bookshelf", left, -1.6, 1.0, 0.28, 2.8, 2.05, 0.38);
  poster(left, 0, 2.2, 1.85, 0.9, 1.2, 0.04); poster(left, 1, 3.6, 1.75, 0.9, 1.2, -0.03);
  poster(front, 2, 4.0, 1.8, 0.8, 1.05, 0.03); poster(front, 3, -6.5, 1.8, 0.8, 1.05, -0.04);
  poster(right, 3, -4.5, 1.8, 0.8, 1.05, 0.02);
  // Wall clock on the left wall
  cy(0.3, 0.3, 0.06, PAL.white, -5.2, 2.2, 0.16, left, 32, 0.012).rotation.x = Math.PI / 2;
  const hand = rb(0.03, 0.2, 0.02, PAL.ink, -5.2, 2.28, 0.2, left, 0.01, 0);
  const hand2 = rb(0.03, 0.14, 0.02, PAL.berry, -5.2, 2.2, 0.21, left, 0.01, 0);
  hand.userData.dynamic = hand2.userData.dynamic = true;
  // One lamp over each pair of desks (pods), wherever layout.js puts them.
  for (let k = 0; k + 1 < DESKS.length; k += 2) {
    const a = DESKS[k], b = DESKS[k + 1];
    pendant(root, (a.x + b.x) / 2, (a.z + b.z) / 2, k % 4 === 0 ? PAL.sun : PAL.wallAccent);
  }
  pendant(root, 3.6, -3.6, PAL.berry);
  // Whiteboard in meeting room (on back wall)
  rb(2.2, 1.1, 0.05, PAL.white, (MEETING.minX + MEETING.maxX) / 2, 1.6, 0.2, back, 0.03, 0.01);
  // Tick: sway plants, puff steam, clock hands. Runs from the floor's onBeforeRender.
  const ticker = root.children[0];
  ticker.onBeforeRender = () => {
    const t = performance.now() / 1000;
    for (const [i, p] of (root.userData.plants || []).entries()) { const l = p.userData.sway; l.rotation.z = Math.sin(t * 1.3 + i) * 0.05; l.rotation.x = Math.cos(t * 1.1 + i) * 0.04; }
    const steam = root.userData.steam;
    if (steam) steam.children.forEach((s, k) => { const ph = (t * 0.6 + k / 3) % 1; s.position.set(Math.sin(ph * 6 + k) * 0.03, ph * 0.5, 0); s.scale.setScalar(0.02 + ph * 0.05); s.visible = ph < 0.9; });
    hand.rotation.z = -t * 0.1; hand2.rotation.z = -t * 0.01;
  };
  return { board: root.userData.board };
}
