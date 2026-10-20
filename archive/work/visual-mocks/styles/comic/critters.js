import * as T from "three";
import { PLANTS } from "../../layout.js";
import { rb, cy, PAL } from "./room.js";
import { toon, flat, part, geo } from "./toon.js";
import { sphere, capsule, torus, lathe } from "./shapes.js";
import { addBox } from "./colliders.js";

// Objects with personality: plants with little faces, a grinning coffee machine.
const leafGeo = () => geo("leaf", () => {
  const g = new T.SphereGeometry(1, 14, 10), p = g.attributes.position, v = new T.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); p.setXYZ(i, v.x * 0.45 * (1 - Math.max(0, v.z) * 0.6), v.y * 0.1 + v.z * v.z * 0.12, v.z); }
  g.translate(0, 0, 1); g.computeVertexNormals(); return g;
});

export function cuteFace(parent, x, y, z, s = 1, mood = 1) {
  for (const k of [-1, 1]) {
    part(sphere(10), flat("#231a1e"), parent, { pos: [x + k * 0.06 * s, y, z], scale: [0.022 * s, 0.03 * s, 0.01], ink: 0 });
    part(sphere(6), flat("#ffffff"), parent, { pos: [x + k * 0.06 * s - 0.006 * s, y + 0.01 * s, z + 0.008], scale: 0.007 * s, ink: 0 });
    part(sphere(8), toon("#f08c86", { rim: 0 }), parent, { pos: [x + k * 0.1 * s, y - 0.035 * s, z - 0.004], scale: [0.025 * s, 0.014 * s, 0.006], ink: 0 });
  }
  const smile = part(geo("smileArc", () => new T.TorusGeometry(0.03, 0.007, 6, 12, Math.PI)), flat("#231a1e"), parent, { pos: [x, y - 0.03 * s, z], ink: 0 });
  smile.rotation.z = mood > 0 ? Math.PI : 0; smile.scale.setScalar(s);
}

function plant(root, x, z, s, i) {
  const g = new T.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); root.add(g);
  addBox("plant-pot", root, x, 0.21 * s, z, 0.5 * s, 0.42 * s, 0.5 * s);
  const potCol = [PAL.pot, "#f7c948", "#8fd3c1", "#e98bb0", "#a98bdf", "#7ec8e3"][i % 6];
  part(lathe("pot", [[0.001, 0], [0.17, 0], [0.22, 0.2], [0.24, 0.38], [0.26, 0.42], [0.001, 0.42]], 24), potCol, g, { ink: 0.012 });
  cy(0.22, 0.22, 0.02, "#5b3a2a", 0, 0.41, 0, g, 20, 0);
  cuteFace(g, 0, 0.22, 0.225, 1.2, 1);
  const leaves = new T.Group(); leaves.userData.dynamic = true; leaves.position.y = 0.4; g.add(leaves);
  const n = 9 + (i % 3) * 2;
  for (let k = 0; k < n; k++) {
    const a = k * 2.39 + i, tilt = 0.5 + (k % 3) * 0.25;
    const l = part(leafGeo(), k % 2 ? PAL.leaf : PAL.leaf2, leaves, { ink: 0.008, scale: 0.22 + (k % 4) * 0.04 });
    l.rotation.set(-tilt - 0.4, a, 0, "YXZ"); l.position.y = 0.05 + (k % 4) * 0.08;
  }
  // A flower on some plants
  if (i % 2 === 0) {
    part(capsule(0.008, 0.45), PAL.leaf, g, { pos: [0.05, 0.75, 0], ink: 0.004 });
    for (let k = 0; k < 5; k++) part(sphere(8), "#f7c948", g, { pos: [0.05 + Math.cos(k * 1.26) * 0.04, 1.0, Math.sin(k * 1.26) * 0.04], scale: [0.035, 0.012, 0.035], ink: 0.004 });
    part(sphere(8), "#e8594a", g, { pos: [0.05, 1.01, 0], scale: 0.022, ink: 0.004 });
  }
  g.userData.sway = leaves;
  return g;
}

export function buildPlants(root) {
  const list = PLANTS.map((p, i) => plant(root, p.x, p.z, p.s, i));
  root.userData.plants = list;
}

export function coffeeMachine(root, x, y, z) {
  const g = new T.Group(); g.position.set(x, y, z); root.add(g);
  rb(0.55, 0.62, 0.42, PAL.berry, 0, 0.31, 0, g, 0.08);
  rb(0.5, 0.12, 0.44, "#c9463a", 0, 0.66, 0, g, 0.05);
  rb(0.36, 0.2, 0.02, "#23324a", 0, 0.47, 0.215, g, 0.03, 0.006); // display = face
  for (const k of [-1, 1]) part(sphere(10), flat("#8ff0d0"), g, { pos: [k * 0.07, 0.49, 0.228], scale: [0.03, 0.035, 0.006], ink: 0 });
  part(geo("mSmile", () => new T.TorusGeometry(0.05, 0.01, 6, 14, Math.PI)), flat("#8ff0d0"), g, { pos: [0, 0.45, 0.228], rot: [0, 0, Math.PI], ink: 0 });
  rb(0.3, 0.03, 0.14, PAL.steel, 0, 0.06, 0.2, g, 0.01, 0.006); // drip tray
  cy(0.03, 0.02, 0.08, PAL.steel, 0, 0.3, 0.2, g, 10, 0.005); // spout
  cy(0.04, 0.035, 0.08, PAL.white, 0, 0.12, 0.2, g, 14, 0.005); // cup
  for (const k of [-1, 1]) cy(0.03, 0.03, 0.03, PAL.sun, k * 0.2, 0.47, 0.21, g, 12, 0.004).rotation.x = Math.PI / 2;
  // Bean hopper
  cy(0.12, 0.08, 0.18, "#fff4df", 0.1, 0.8, -0.05, g, 16, 0.008);
  // Steam puffs (animated in decor tick)
  const steam = new T.Group(); steam.userData.dynamic = true; steam.position.set(0, 0.2, 0.2); g.add(steam);
  for (let k = 0; k < 3; k++) part(sphere(10), toon("#ffffff", { transparent: true, opacity: 0.8, rim: 0 }), steam, { scale: 0.03, ink: 0 });
  root.userData.steam = steam;
}
