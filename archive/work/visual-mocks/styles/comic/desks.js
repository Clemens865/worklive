import * as T from "three";
import * as L from "../../layout.js";
const { DESKS, seatOf, monitorOf } = L;
const KZ = L.keyboardZ ?? 0.28; // keyboard sits at a fixed distance from the desk front
// Desk size from layout.js (falls back to the original 1.9 × 0.86 m).
const DESK = L.DESK || { w: 1.9, d: 0.86 }, DW = DESK.w, DD = DESK.d, TX = DW / 2 - 0.23, LX = DW / 2 - 0.1, LZ = DD / 2 - 0.1, DRX = DW / 2 - 0.35;
import { rb, cy, PAL } from "./room.js";
import { toon, flat, part, geo } from "./toon.js";
import { sphere, capsule, torus } from "./shapes.js";
import { addBox, COLLIDERS } from "./colliders.js";

const SEATS = ["#e8594a", "#f7c948", "#7ec8e3", "#a98bdf", "#58b368", "#ee8a5d", "#e98bb0", "#5b7fd6"];

export function comicChair(parent, color, collide = true) {
  const g = new T.Group(); parent.add(g);
  rb(0.5, 0.1, 0.44, color, 0, 0.47, -0.02, g, 0.05);
  rb(0.46, 0.46, 0.09, color, 0, 0.84, -0.26, g, 0.06).rotation.x = 0.12;
  rb(0.08, 0.3, 0.06, PAL.navy, 0, 0.6, -0.25, g, 0.03, 0.008);
  cy(0.035, 0.035, 0.34, PAL.steel, 0, 0.26, 0, g, 12, 0.008);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = rb(0.3, 0.05, 0.06, PAL.navy, Math.sin(a) * 0.15, 0.07, Math.cos(a) * 0.15, g, 0.02, 0.008);
    leg.rotation.y = a + Math.PI / 2;
    cy(0.035, 0.035, 0.05, "#2b2b30", Math.sin(a) * 0.3, 0.03, Math.cos(a) * 0.3, g, 10, 0.006);
  }
  for (const s of [-1, 1]) rb(0.05, 0.05, 0.3, PAL.navy, s * 0.27, 0.66, -0.02, g, 0.02, 0.008);
  for (const s of [-1, 1]) rb(0.04, 0.16, 0.04, PAL.navy, s * 0.27, 0.57, -0.1, g, 0.015, 0.006);
  if (collide) {
    addBox("chair-seat", g, 0, 0.47, -0.02, 0.5, 0.1, 0.44); COLLIDERS.at(-1).soft = true;
    addBox("chair-back", g, 0, 0.84, -0.27, 0.46, 0.46, 0.11); COLLIDERS.at(-1).soft = true;
    for (const s of [-1, 1]) addBox("chair-arm", g, s * 0.27, 0.64, -0.02, 0.05, 0.1, 0.3);
  }
  return g;
}

function deskToys(g, i) {
  // A few fun per-desk items, deterministic per desk index.
  const kind = i % 4;
  if (kind === 0) { // rubber duck
    const d = new T.Group(); d.position.set(TX, 0.8, -0.1); d.rotation.y = -0.6; g.add(d);
    part(sphere(), "#f7c948", d, { scale: [0.05, 0.04, 0.06], ink: 0.006 });
    part(sphere(), "#f7c948", d, { scale: 0.032, pos: [0, 0.045, 0.03], ink: 0.006 });
    part(sphere(), "#ee8a5d", d, { scale: [0.018, 0.008, 0.02], pos: [0, 0.042, 0.062], ink: 0.004 });
  } else if (kind === 1) { // cactus
    cy(0.05, 0.04, 0.07, PAL.pot, TX, 0.8, -0.15, g, 14, 0.006);
    part(capsule(0.03, 0.07), "#58b368", g, { pos: [TX, 0.88, -0.15], ink: 0.006 });
    part(capsule(0.015, 0.03), "#58b368", g, { pos: [TX + 0.035, 0.89, -0.15], rot: [0, 0, -0.9], ink: 0.005 });
    part(sphere(8), "#e98bb0", g, { pos: [TX, 0.94, -0.15], scale: 0.015, ink: 0.004 });
  } else if (kind === 2) { // stack of books
    for (let k = 0; k < 3; k++) rb(0.22 - k * 0.02, 0.035, 0.16, ["#e8594a", "#5b7fd6", "#f7c948"][k], -TX, 0.785 + k * 0.036, -0.12, g, 0.01, 0.006).rotation.y = k * 0.2;
  } else { // sticky notes on the monitor handled below; desk lamp
    cy(0.07, 0.08, 0.03, PAL.berry, -TX, 0.78, -0.2, g, 16, 0.006);
    const arm = rb(0.03, 0.3, 0.03, PAL.berry, -TX, 0.93, -0.2, g, 0.01, 0.006); arm.rotation.z = 0.3;
    cy(0.04, 0.09, 0.09, PAL.berry, -TX + 0.06, 1.07, -0.12, g, 16, 0.006).rotation.x = 0.7;
  }
  // mug on every desk
  cy(0.035, 0.032, 0.08, ["#ffffff", "#8fd3c1", "#f7c948", "#a98bdf"][i % 4], 0.52, 0.805, KZ - 0.1, g, 14, 0.006);
  part(torus(0.02, 0.006, Math.PI * 1.3), ["#ffffff", "#8fd3c1", "#f7c948", "#a98bdf"][i % 4], g, { pos: [0.557, 0.805, KZ - 0.1], rot: [0, 0, -Math.PI * 0.65], ink: 0.004 });
}

export function buildDesks(root) {
  const screens = [], chairs = [];
  for (const [i, d] of DESKS.entries()) { const r = buildDesk(root, i, d); screens.push(r.screen); chairs.push(r.chair); }
  root.userData.screens = screens; root.userData.chairs = chairs;
}

// One complete workstation: desk, drawer, panel, monitor + screen, keyboard, toys, chair and colliders.
export function buildDesk(root, i, d) {
    const g = new T.Group(); g.position.set(d.x, 0, d.z); root.add(g);
    rb(DW, 0.05, DD, PAL.cream, 0, 0.74, 0, g, 0.022);
    rb(DW - 0.04, 0.016, DD - 0.04, PAL.wood, 0, 0.707, 0, g, 0.007, 0.006);
    addBox("desk-top" + i, g, 0, 0.732, 0, DW, 0.066, DD);
    addBox("drawer" + i, g, DRX, 0.38, -0.02, 0.46, 0.5, DD - 0.16);
    addBox("panel" + i, g, 0, 0.93, -DD / 2 - 0.01, Math.min(1.3, DW * 0.68), 0.34, 0.05);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) addBox("desk-leg" + i, g, sx * LX, 0.34, sz * LZ, 0.08, 0.68, 0.08);
    for (const s of [-1, 1]) {
      rb(0.08, 0.68, 0.08, PAL.navy, s * LX, 0.34, LZ, g, 0.03, 0.01);
      rb(0.08, 0.68, 0.08, PAL.navy, s * LX, 0.34, -LZ, g, 0.03, 0.01);
    }
    rb(0.46, 0.5, DD - 0.16, SEATS[(i + 3) % 8], DRX, 0.38, -0.02, g, 0.05); // drawer unit
    for (let k = 0; k < 3; k++) rb(0.12, 0.03, 0.02, PAL.white, DRX, 0.25 + k * 0.15, DD / 2 - 0.09, g, 0.01, 0.005);
    rb(Math.min(1.3, DW * 0.68), 0.34, 0.05, PAL.wallAccent, 0, 0.93, -DD / 2 - 0.01, g, 0.02); // privacy panel
    // Monitor
    const m = monitorOf(d);
    rb(0.8, 0.52, 0.06, PAL.navy, m.x, m.y + 0.12, m.z - 0.02, root, 0.04);
    addBox("monitor" + i, root, m.x, m.y + 0.12, m.z - 0.02, 0.8, 0.52, 0.06);
    rb(0.08, 0.26, 0.05, PAL.steel, m.x, 0.9, m.z - 0.06, root, 0.02, 0.008);
    rb(0.3, 0.03, 0.18, PAL.steel, m.x, 0.78, m.z - 0.04, root, 0.015, 0.008);
    const screen = new T.Mesh(new T.PlaneGeometry(0.68, 0.4), new T.MeshBasicMaterial({ color: "#222" }));
    screen.userData.keep = true; screen.position.set(m.x, m.y + 0.12, m.z + 0.013); root.add(screen);
    part(sphere(8), "#8fd3c1", root, { pos: [m.x + 0.36, m.y - 0.1, m.z + 0.012], scale: [0.012, 0.012, 0.006], ink: 0 });
    // sticky note on the bezel
    rb(0.07, 0.07, 0.005, ["#f7c948", "#e98bb0", "#8fd3c1"][i % 3], m.x - 0.36, m.y + 0.33, m.z + 0.015, root, 0.002, 0.004).rotation.z = 0.15;
    // Keyboard + mouse
    const kb = rb(0.46, 0.025, 0.15, PAL.white, 0, 0.78, KZ, g, 0.012, 0.008);
    for (let r = 0; r < 3; r++) rb(0.4, 0.01, 0.028, "#d9d2c6", 0, 0.795, KZ - 0.045 + r * 0.04, g, 0.004, 0);
    part(sphere(12), PAL.white, g, { pos: [0.36, 0.785, KZ + 0.02], scale: [0.03, 0.02, 0.045], ink: 0.006 });
    deskToys(g, i);
    const chair = comicChair(root, SEATS[i % 8]); const s = seatOf(d);
    // Unmerged, pivot at the seat centre on the floor (= agent root) so it can swivel with the body.
    chair.position.set(s.x, 0, s.z); chair.rotation.y = Math.PI; chair.userData.dynamic = true; chair.userData.baseYaw = Math.PI;
    return { screen, chair };
}
