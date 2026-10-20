import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { DESKS, seatOf, monitorOf } from "../../layout.js";
import { woodTex, brushedTex, std, phys, cloth, feltTex } from "./materials.js";

const geos = new Map();
export function rgeo(w, h, d, r) { const k = [w, h, d, r].join(); if (!geos.has(k)) geos.set(k, new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2))); return geos.get(k); }
export function rb(w, h, d, m, x, y, z, parent, r = 0.01, o = {}) {
  const mesh = new T.Mesh(rgeo(w, h, d, r), m); mesh.position.set(x, y, z);
  if (o.rot) mesh.rotation.set(...o.rot);
  mesh.castShadow = o.cast !== false; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
export function cyl(rt, rb_, h, m, x, y, z, parent, seg = 20, o = {}) {
  const k = `c${rt},${rb_},${h},${seg}`; if (!geos.has(k)) geos.set(k, new T.CylinderGeometry(rt, rb_, h, seg));
  const mesh = new T.Mesh(geos.get(k), m); mesh.position.set(x, y, z); if (o.rot) mesh.rotation.set(...o.rot);
  mesh.castShadow = o.cast !== false; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

export const M = {};
export function initMats() {
  M.oak = std("#ffffff", { map: woodTex("#a7794f", 5, 4), roughness: 0.48 });
  M.walnut = std("#ffffff", { map: woodTex("#5e3f2a", 9, 3), roughness: 0.42 });
  M.steel = std("#1f2226", { roughness: 0.38, metalness: 0.75 });
  M.alu = std("#b9bcc0", { roughness: 0.3, metalness: 1, roughnessMap: brushedTex() });
  M.plastic = std("#141517", { roughness: 0.45 });
  M.mesh = cloth("#2b2d31", "twill", { roughness: 0.9 });
  M.leather = phys("#6e3f26", { roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.3 });
  M.fabricSofa = cloth("#566153", "twill", { map: feltTex("#8a9786", 6) });
  M.fabricChair = cloth("#b0674a", "twill", { map: feltTex("#c9876a", 7) });
  M.paper = std("#efece4", { roughness: 0.9 });
  M.ceramic = phys("#e7e1d6", { roughness: 0.3, clearcoat: 0.5 });
}

export function officeChair(parent) {
  const g = new T.Group(); parent.add(g);
  rb(0.5, 0.075, 0.48, M.mesh, 0, 0.483, 0, g, 0.035);
  rb(0.46, 0.035, 0.44, M.plastic, 0, 0.435, 0, g, 0.012);
  const back = new T.Group(); back.position.set(0, 0.6, 0.25); back.rotation.x = -0.12; g.add(back);
  rb(0.46, 0.46, 0.05, M.mesh, 0, 0.25, 0, back, 0.03);
  rb(0.48, 0.48, 0.02, M.plastic, 0, 0.25, 0.03, back, 0.01);
  rb(0.05, 0.28, 0.03, M.alu, 0, 0.0, -0.01, back, 0.01);
  cyl(0.028, 0.028, 0.3, M.alu, 0, 0.27, 0, g, 14);
  cyl(0.04, 0.04, 0.12, M.plastic, 0, 0.16, 0, g, 14);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + 0.3;
    const leg = rb(0.3, 0.03, 0.045, M.alu, Math.cos(a) * 0.15, 0.075, Math.sin(a) * 0.15, g, 0.012); leg.rotation.y = -a;
    cyl(0.025, 0.025, 0.035, M.plastic, Math.cos(a) * 0.29, 0.03, Math.sin(a) * 0.29, g, 10, { rot: [0, 0, Math.PI / 2] });
  }
  for (const s of [-1, 1]) {
    rb(0.03, 0.2, 0.03, M.plastic, s * 0.25, 0.57, 0.02, g, 0.01);
    rb(0.07, 0.03, 0.26, M.plastic, s * 0.25, 0.68, 0.0, g, 0.012);
  }
  return g;
}

function deskItems(g, i) {
  rb(0.44, 0.018, 0.145, M.alu, 0, 0.774, 0.28, g, 0.006);                         // keyboard base
  rb(0.41, 0.006, 0.12, std("#2a2c30", { roughness: 0.55 }), 0, 0.785, 0.28, g, 0.003, { cast: false }); // keys
  rb(0.06, 0.02, 0.1, M.plastic, 0.34, 0.775, 0.3, g, 0.01);                       // mouse
  if (i % 3 !== 1) { cyl(0.04, 0.036, 0.1, M.ceramic, -0.62, 0.815, 0.2, g, 18); }  // mug
  if (i % 2 === 0) { rb(0.21, 0.02, 0.29, M.paper, 0.6, 0.776, 0.2, g, 0.004, { rot: [0, 0.25, 0] }); rb(0.2, 0.004, 0.28, std("#3b4a5a"), 0.6, 0.788, 0.2, g, 0.002, { rot: [0, 0.25, 0], cast: false }); }
  if (i % 4 === 1) { cyl(0.06, 0.07, 0.12, std("#c8bfb2", { roughness: 0.9 }), -0.7, 0.825, -0.2, g, 16); for (let k = 0; k < 6; k++) rb(0.02, 0.12, 0.06, std("#4f7a4a", { roughness: 0.6 }), -0.7 + Math.sin(k) * 0.03, 0.93, -0.2 + Math.cos(k) * 0.03, g, 0.01, { rot: [0.3 * Math.sin(k * 2), k, 0.3] }); }
}

// Desks with monitors, keyboards and chairs. Returns one screen mesh per desk.
export function buildDesks(root) {
  const screens = [];
  for (const [i, d] of DESKS.entries()) {
    const g = new T.Group(); g.position.set(d.x, 0, d.z); root.add(g);
    rb(1.9, 0.035, 0.85, M.oak, 0, 0.7475, 0, g, 0.008);
    for (const s of [-1, 1]) {
      rb(0.05, 0.7, 0.05, M.steel, s * 0.86, 0.365, -0.33, g, 0.008); rb(0.05, 0.7, 0.05, M.steel, s * 0.86, 0.365, 0.33, g, 0.008);
      rb(0.05, 0.04, 0.76, M.steel, s * 0.86, 0.71, 0, g, 0.008); rb(0.06, 0.03, 0.8, M.steel, s * 0.86, 0.015, 0, g, 0.008);
    }
    rb(1.66, 0.05, 0.04, M.steel, 0, 0.7, -0.38, g, 0.008);
    rb(1.3, 0.34, 0.03, cloth("#4e5a52", "twill"), 0, 0.93, -0.44, g, 0.012); // acoustic privacy panel
    deskItems(g, i);
    const m = monitorOf(d);
    const mon = new T.Group(); mon.position.set(m.x, 0, m.z); root.add(mon);
    rb(0.72, 0.44, 0.025, M.plastic, 0, m.y + 0.12, 0, mon, 0.01);
    rb(0.7, 0.42, 0.03, M.alu, 0, m.y + 0.12, -0.012, mon, 0.01);
    rb(0.05, 0.36, 0.025, M.alu, 0, 0.95, -0.05, mon, 0.01);
    rb(0.22, 0.012, 0.16, M.alu, 0, 0.771, -0.02, mon, 0.006);
    const screen = new T.Mesh(new T.PlaneGeometry(0.68, 0.4), new T.MeshBasicMaterial({ color: "#222" }));
    screen.position.set(m.x, m.y + 0.12, m.z + 0.0135); root.add(screen); screens.push(screen);
    const chair = officeChair(root); const s = seatOf(d); chair.position.set(s.x, 0, s.z + 0.06);
  }
  return screens;
}
