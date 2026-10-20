import * as T from "three";
import { LOUNGE, CAFE, MEETING, ROOM } from "../../layout.js";
import { rb, cy, PAL } from "./room.js";
import { toon, flat, part, geo } from "./toon.js";
import { sphere, capsule, torus } from "./shapes.js";
import { comicChair } from "./desks.js";
import { addBox, COLLIDERS } from "./colliders.js";
const soft = () => { COLLIDERS.at(-1).soft = true; };
import { buildPlants, coffeeMachine } from "./critters.js";

function sofa(root) {
  const g = new T.Group(); g.position.set(LOUNGE.sofa.x, 0, LOUNGE.sofa.z); g.rotation.y = LOUNGE.sofa.yaw; root.add(g);
  const c = "#e8594a", c2 = "#f07a68";
  rb(2.4, 0.26, 0.95, c, 0, 0.25, 0, g, 0.1);
  rb(2.4, 0.62, 0.3, c, 0, 0.66, -0.34, g, 0.14);
  for (const s of [-1, 1]) rb(0.3, 0.5, 0.95, c, s * 1.12, 0.45, 0, g, 0.13);
  for (const s of [-0.53, 0.53]) rb(1.02, 0.14, 0.68, c2, s, 0.44, 0.1, g, 0.07);
  for (const s of [-0.55, 0.55]) rb(0.95, 0.45, 0.16, c2, s, 0.72, -0.2, g, 0.08).rotation.x = -0.12;
  rb(0.4, 0.34, 0.14, PAL.sun, 0.85, 0.66, -0.06, g, 0.08).rotation.set(-0.2, -0.2, 0.2); // cushion
  addBox("sofa-base", g, 0, 0.25, 0, 2.4, 0.26, 0.95);
  for (const s of [-0.53, 0.53]) { addBox("sofa-cushion", g, s, 0.44, 0.1, 1.02, 0.14, 0.68); soft(); }
  addBox("sofa-back", g, 0, 0.66, -0.34, 2.4, 0.62, 0.3);
  for (const s of [-0.55, 0.55]) { addBox("sofa-backcushion", g, s, 0.72, -0.22, 0.95, 0.45, 0.12); soft(); }
  for (const s of [-1, 1]) addBox("sofa-arm", g, s * 1.12, 0.45, 0, 0.3, 0.5, 0.95);
  for (const s of [-1, 1]) for (const z of [-0.35, 0.35]) cy(0.04, 0.03, 0.12, PAL.woodDark, s * 1.15, 0.06, z, g, 10, 0.006);
}

function lounge(root, right) {
  sofa(root);
  const rug = new T.Mesh(geo("rug", () => new T.CylinderGeometry(2.3, 2.3, 0.02, 48)), toon("#a98bdf", { rim: 0 }));
  rug.position.set(LOUNGE.table.x - 0.2, 0.01, LOUNGE.table.z); rug.receiveShadow = true; root.add(rug);
  const rug2 = new T.Mesh(geo("rug2", () => new T.RingGeometry(1.7, 1.95, 48)), flat("#f5e6c8"));
  rug2.rotation.x = -Math.PI / 2; rug2.position.set(LOUNGE.table.x - 0.2, 0.025, LOUNGE.table.z); root.add(rug2);
  cy(0.6, 0.6, 0.08, PAL.wood, LOUNGE.table.x, 0.42, LOUNGE.table.z, root, 32);
  cy(0.12, 0.3, 0.38, PAL.navy, LOUNGE.table.x, 0.19, LOUNGE.table.z, root, 20);
  // Table props: magazine + bowl of fruit
  rb(0.3, 0.015, 0.22, PAL.sky, LOUNGE.table.x - 0.2, 0.47, LOUNGE.table.z + 0.1, root, 0.005, 0.005).rotation.y = 0.4;
  cy(0.14, 0.09, 0.07, PAL.white, LOUNGE.table.x + 0.2, 0.5, LOUNGE.table.z - 0.1, root, 18, 0.006);
  for (let k = 0; k < 3; k++) part(sphere(10), ["#e8594a", "#f7c948", "#58b368"][k], root, { pos: [LOUNGE.table.x + 0.15 + k * 0.05, 0.56, LOUNGE.table.z - 0.12 + (k % 2) * 0.05], scale: 0.045, ink: 0.005 });
  for (const ch of LOUNGE.chairs) {
    const g = new T.Group(); g.position.set(ch.x, 0, ch.z); g.rotation.y = ch.yaw; root.add(g);
    rb(0.9, 0.26, 0.8, "#58b368", 0, 0.32, 0, g, 0.1);
    rb(0.9, 0.55, 0.22, "#58b368", 0, 0.66, -0.3, g, 0.1);
    for (const s of [-1, 1]) rb(0.18, 0.38, 0.8, "#58b368", s * 0.42, 0.5, 0, g, 0.08);
    rb(0.6, 0.12, 0.55, "#8fd16a", 0, 0.5, 0.06, g, 0.05);
    addBox("armchair-base", g, 0, 0.32, 0, 0.9, 0.26, 0.8);
    addBox("armchair-cushion", g, 0, 0.5, 0.06, 0.6, 0.12, 0.55); soft();
    addBox("armchair-back", g, 0, 0.66, -0.3, 0.9, 0.55, 0.22); soft();
    for (const s of [-1, 1]) addBox("armchair-arm", g, s * 0.42, 0.5, 0, 0.18, 0.38, 0.8);
  }
  // Big wall TV
  const tv = rb(0.08, 1.15, 1.95, PAL.navy, LOUNGE.screen.x - 0.14, 1.55, LOUNGE.screen.z, root, 0.04);
  const board = new T.Mesh(new T.PlaneGeometry(1.78, 1.0), new T.MeshBasicMaterial({ color: "#23324a" }));
  board.userData.keep = true; board.rotation.y = -Math.PI / 2; board.position.set(LOUNGE.screen.x - 0.19, 1.55, LOUNGE.screen.z); root.add(board);
  right.attach(tv); right.attach(board);
  return board;
}

function cafe(root) {
  const c = CAFE.counter;
  rb(c.w, 0.92, 0.66, PAL.sky, c.x, 0.46, c.z, root, 0.05);
  rb(c.w + 0.1, 0.07, 0.74, PAL.cream, c.x, 0.95, c.z, root, 0.03);
  addBox("counter", root, c.x, 0.49, c.z, c.w + 0.1, 0.99, 0.74);
  addBox("coffee-machine", root, c.x + 1.25, 1.4, c.z - 0.02, 0.55, 0.82, 0.44);
  addBox("microwave", root, c.x - 1.2, 1.14, c.z - 0.1, 0.5, 0.3, 0.25);
  addBox("cabinet", root, c.x, 2.15, c.z - 0.12, c.w, 0.62, 0.38);
  for (let k = 0; k < 5; k++) rb(0.6, 0.5, 0.02, "#6db5d0", c.x - 1.6 + k * 0.8, 0.5, c.z + 0.33, root, 0.03, 0.006);
  rb(c.w, 0.62, 0.38, PAL.white, c.x, 2.15, c.z - 0.12, root, 0.04);
  for (let k = 0; k < 4; k++) rb(0.02, 0.5, 0.01, PAL.woodDark, c.x - 1.05 + k * 0.7, 2.15, c.z + 0.075, root, 0.005, 0);
  coffeeMachine(root, c.x + 1.25, 0.99, c.z - 0.02);
  // Mug tree + cups
  for (let k = 0; k < 4; k++) cy(0.04, 0.035, 0.09, ["#e8594a", "#f7c948", "#a98bdf", "#58b368"][k], c.x - 0.2 + k * 0.12, 1.03, c.z + 0.1, root, 14, 0.006);
  rb(0.5, 0.3, 0.25, PAL.berry, c.x - 1.2, 1.14, c.z - 0.1, root, 0.04); // toaster-ish microwave
  rb(0.3, 0.18, 0.02, "#23324a", c.x - 1.25, 1.14, c.z + 0.03, root, 0.02, 0.004);
  // Table + stools
  cy(0.5, 0.5, 0.06, PAL.cream, CAFE.table.x, 1.02, CAFE.table.z, root, 32);
  addBox("cafe-table", root, CAFE.table.x, 1.02, CAFE.table.z, 0.8, 0.06, 0.8);
  addBox("cafe-pole", root, CAFE.table.x, 0.5, CAFE.table.z, 0.1, 1.0, 0.1);
  cy(0.05, 0.05, 1.0, PAL.navy, CAFE.table.x, 0.5, CAFE.table.z, root, 12);
  cy(0.3, 0.34, 0.05, PAL.navy, CAFE.table.x, 0.025, CAFE.table.z, root, 20);
  for (const s of CAFE.stools) {
    cy(0.2, 0.2, 0.09, PAL.berry, s.x, 0.74, s.z, root, 20);
    addBox("stool", root, s.x, 0.39, s.z, 0.32, 0.79, 0.32);
    cy(0.025, 0.025, 0.7, PAL.steel, s.x, 0.36, s.z, root, 8, 0.006);
    part(torus(0.15, 0.015), PAL.steel, root, { pos: [s.x, 0.3, s.z], rot: [Math.PI / 2, 0, 0], ink: 0.004 });
  }
}

function meeting(root) {
  const m = MEETING, mw = m.maxX - m.minX, md = m.maxZ - m.minZ, H = ROOM.height;
  const glassMat = new T.MeshBasicMaterial({ color: "#bfeaf5", transparent: true, opacity: 0.18, depthWrite: false, side: T.DoubleSide });
  const g1 = new T.Mesh(new T.PlaneGeometry(mw, H), glassMat); g1.position.set(m.minX + mw / 2, H / 2, m.maxZ); root.add(g1);
  const g2 = new T.Mesh(new T.PlaneGeometry(md, H), glassMat); g2.rotation.y = Math.PI / 2; g2.position.set(m.minX, H / 2, m.minZ + md / 2); root.add(g2);
  rb(mw, 0.1, 0.1, PAL.lilac, m.minX + mw / 2, H - 0.05, m.maxZ, root, 0.03);
  rb(0.1, 0.1, md, PAL.lilac, m.minX, H - 0.05, m.minZ + md / 2, root, 0.03);
  rb(0.12, H, 0.12, PAL.lilac, m.minX, H / 2, m.maxZ, root, 0.04);
  rb(mw, 0.08, 0.06, PAL.lilac, m.minX + mw / 2, 1.1, m.maxZ, root, 0.02, 0.008);
  rb(0.06, 0.08, md, PAL.lilac, m.minX, 1.1, m.minZ + md / 2, root, 0.02, 0.008);
  const cx = m.minX + mw / 2, cz = m.minZ + md / 2;
  rb(2.7, 0.08, 1.2, PAL.wood, cx, 0.74, cz, root, 0.06);
  for (const s of [-1, 1]) rb(0.1, 0.7, 0.8, PAL.navy, cx + s * 1.05, 0.36, cz, root, 0.04);
  for (let i = 0; i < 4; i++) {
    const ch = comicChair(root, ["#f7c948", "#8fd3c1", "#e98bb0", "#7ec8e3"][i]);
    ch.position.set(cx - 0.8 + (i % 2) * 1.6, 0, cz + (i < 2 ? -0.85 : 0.85)); ch.rotation.y = i < 2 ? 0 : Math.PI;
  }
}

export function buildFurniture(root, right) {
  const board = lounge(root, right);
  cafe(root);
  meeting(root);
  buildPlants(root);
  root.userData.board = board;
}
