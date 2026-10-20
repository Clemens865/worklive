import * as T from "three";
import { Kit, label } from "./kit";
import { Holo } from "./holo";

// Deck 7 furniture. Every prop returns its group plus the spot(s) where a robot stands to use it
// (position + the direction it faces).

export interface Spot { pos: T.Vector3; face: number }

// Docking station: a battered console the robot stands behind, a power cable that plugs into its
// back, a projector puck and a holo screen hovering beside it.
export function station(kit: Kit, name: string, accent: string) {
  const g = new T.Group();
  const body = kit.paint("#3b4452"), panel = kit.paint("#596577"), key = kit.paint("#d9d3c7");
  const desk = kit.box(1.5, 0.46, 0.62, body, g, 0.06);
  desk.position.set(0, 0.23, 0.75);
  const top = kit.box(1.56, 0.08, 0.72, panel, g, 0.03);
  top.position.set(0, 0.49, 0.75);
  top.rotation.x = 0.12;
  const kb = kit.box(0.8, 0.05, 0.26, key, g, 0.02);
  kb.position.set(0.05, 0.55, 0.7);
  kb.rotation.x = 0.12;
  // buttons and a nameplate
  for (let i = 0; i < 4; i++) kit.mesh(new T.SphereGeometry(0.035, 10, 8), kit.glow(["#ff5a4f", "#f2c94c", "#5ff2b5", "#63d3ff"][i]), g, { line: false }).position.set(-0.6 + i * 0.1, 0.56, 0.92);
  const plate = kit.sign(0.7, 0.16, (c, w, h) => label(c, w, h, name.toUpperCase(), { bg: accent, fg: "#1d1b22" }), g);
  plate.position.set(0, 0.24, 1.065);
  // a mug (oil, presumably) and a sticky note
  const mug = kit.can(0.06, 0.06, 0.12, kit.paint("#f4f1ea"), g);
  mug.position.set(0.6, 0.52, 0.62);
  const note = kit.sign(0.16, 0.16, (c, w, h) => label(c, w, h, "IT IS\nFINE\n(IT ISN'T)", { bg: "#ffe066" }), g, 96);
  note.position.set(-0.52, 0.57, 0.6);
  note.rotation.x = -Math.PI / 2 + 0.12;
  // projector puck + holo
  const puck = kit.can(0.14, 0.12, 0.06, kit.paint("#23262d"), g);
  puck.position.set(-0.98, 0, 0.55);
  const ped = kit.can(0.05, 0.05, 1.0, kit.paint("#23262d"), g);
  ped.position.set(-0.98, 0, 0.55);
  const holo = new Holo(1.1, 0.68);
  holo.title = name;
  const holoG = new T.Group();
  holoG.position.set(-0.98, 1.72, 0.55);
  holoG.rotation.y = 0.45;
  holoG.add(holo.mesh);
  holoG.add(holo.beam);
  holo.beam.position.y = -0.36;
  g.add(holoG);
  // power socket on the console back and the cable (re-routed when the robot docks or leaves)
  const socket = new T.Vector3(0.45, 0.35, 0.44);
  const cableM = kit.paint("#e2574c");
  let cable: T.Mesh | null = null;
  const plug = (to: T.Vector3 | null) => {
    if (cable) { g.remove(cable); cable.geometry.dispose(); }
    const end = to ?? new T.Vector3(0.6, 0.03, 0.05); // lying on the floor
    cable = kit.cable(socket, end, to ? 0.25 : 0.1, 0.03, cableM, g);
  };
  plug(null);
  return { group: g, spot: { pos: new T.Vector3(0, 0, 0), face: 0 } as Spot, holo, plug };
}

// Charging pod: a tall alcove with a glowing ring. Paused robots park here.
export function chargePod(kit: Kit) {
  const g = new T.Group();
  const shellM = kit.paint("#b8c2cc"), dark = kit.paint("#2c3440");
  const back = new T.CylinderGeometry(0.75, 0.75, 2.5, 32, 1, true, 0.75, Math.PI * 2 - 1.5) // open towards the room;
  const sh = kit.mesh(back, shellM, g);
  sh.position.y = 1.35;
  (sh.material as T.Material).side = T.DoubleSide;
  kit.can(0.8, 0.8, 0.12, dark, g);
  const top = kit.can(0.82, 0.78, 0.16, dark, g);
  top.position.y = 2.6;
  const ring = kit.mesh(new T.TorusGeometry(0.62, 0.04, 8, 40), kit.glow("#7d6bff"), g, { line: false });
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.14;
  const s = kit.sign(0.9, 0.22, (c, w, h) => label(c, w, h, "MIN. 2 HRS", { bg: "#2c3440", fg: "#9d8cff" }), g);
  s.position.set(0, 2.45, 0.8);
  return { group: g, spot: { pos: new T.Vector3(0, 0.12, 0.05), face: 0 } as Spot, ring };
}

// Oil dispenser: "Lukewarm" is the default setting and the only one that works.
export function oilDispenser(kit: Kit) {
  const g = new T.Group();
  const m = kit.box(1.0, 1.9, 0.7, kit.paint("#c0462f"), g, 0.08);
  m.position.y = 0.95;
  const win = kit.box(0.7, 0.5, 0.05, kit.paint("#2c3440"), g, 0.03);
  win.position.set(0, 1.3, 0.36);
  const nozzle = kit.can(0.05, 0.03, 0.18, kit.paint("#9aa6b2"), g);
  nozzle.position.set(0, 0.72, 0.4);
  nozzle.rotation.x = Math.PI;
  kit.box(0.5, 0.06, 0.3, kit.paint("#2c3440"), g, 0.02).position.set(0, 0.42, 0.42);
  const s = kit.sign(0.72, 0.38, (c, w, h) => label(c, w, h, "OIL\nLUKEWARM", { bg: "#f4f1ea", fg: "#c0462f" }), g);
  s.position.set(0, 1.3, 0.39);
  const puddle = kit.mesh(new T.CircleGeometry(0.35, 24), new T.MeshBasicMaterial({ color: "#1d1b22", transparent: true, opacity: 0.35 }), g, { line: false, shadow: false });
  puddle.rotation.x = -Math.PI / 2;
  puddle.position.set(0.1, 0.012, 0.75);
  return { group: g, spots: [{ pos: new T.Vector3(-0.35, 0, 1.15), face: 0.2 }, { pos: new T.Vector3(0.75, 0, 1.0), face: -0.6 }] as Spot[] };
}

// Air hockey with one puck too few.
export function hockeyTable(kit: Kit) {
  const g = new T.Group();
  const top = kit.box(2.2, 0.16, 1.2, kit.paint("#4f6fa8"), g, 0.05);
  top.position.y = 0.72;
  const rim = kit.paint("#f2c94c");
  for (const z of [-0.6, 0.6]) kit.box(2.2, 0.1, 0.07, rim, g, 0.02).position.set(0, 0.84, z);
  for (const [x, z] of [[-0.95, -0.45], [0.95, -0.45], [-0.95, 0.45], [0.95, 0.45]]) kit.box(0.1, 0.65, 0.1, kit.paint("#2c3440"), g, 0.02).position.set(x, 0.33, z);
  const line = kit.box(0.03, 0.01, 1.1, kit.glow("#63d3ff"), g, 0.005);
  line.position.y = 0.81;
  const puck = kit.can(0.07, 0.07, 0.03, kit.paint("#e2574c"), g);
  puck.position.y = 0.8;
  return { group: g, spots: [{ pos: new T.Vector3(-1.5, 0, 0), face: Math.PI / 2 }, { pos: new T.Vector3(1.5, 0, 0), face: -Math.PI / 2 }] as Spot[], puck };
}

// The sofa. Taped, sagging, and reserved.
export function sofa(kit: Kit) {
  const g = new T.Group();
  const fabric = kit.paint("#7a8f6a"), dark = kit.paint("#5c6e50");
  kit.box(2.2, 0.42, 0.9, fabric, g, 0.12).position.set(0, 0.3, 0);
  kit.box(2.2, 0.75, 0.25, dark, g, 0.1).position.set(0, 0.7, -0.38);
  for (const x of [-1.05, 1.05]) kit.box(0.24, 0.6, 0.9, dark, g, 0.1).position.set(x, 0.45, 0);
  const patch = kit.box(0.4, 0.04, 0.3, kit.paint("#d9d4c3"), g, 0.01);
  patch.position.set(0.5, 0.52, 0.05);
  patch.rotation.y = 0.4;
  const tag = kit.sign(0.6, 0.2, (c, w, h) => label(c, w, h, "RESERVED: BRICK", { bg: "#f4f1ea" }), g);
  tag.position.set(0, 0.95, -0.24);
  return { group: g, spots: [{ pos: new T.Vector3(-0.5, 0.2, 0.25), face: 0 }, { pos: new T.Vector3(0.55, 0.2, 0.25), face: 0 }] as Spot[] };
}

// Review hatch with a bell nobody answers.
export function reviewHatch(kit: Kit) {
  const g = new T.Group();
  const frame = kit.box(1.6, 1.3, 0.3, kit.paint("#2c3440"), g, 0.06);
  frame.position.set(0, 1.6, 0);
  const shutter = kit.box(1.3, 1.0, 0.06, kit.paint("#9aa6b2"), g, 0.02);
  shutter.position.set(0, 1.6, 0.14);
  const counter = kit.box(1.8, 0.1, 0.55, kit.paint("#596577"), g, 0.03);
  counter.position.set(0, 0.95, 0.3);
  kit.box(1.6, 0.9, 0.4, kit.paint("#3b4452"), g, 0.04).position.set(0, 0.45, 0.25);
  const bell = kit.mesh(new T.SphereGeometry(0.09, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), kit.paint("#f2c94c"), g);
  bell.position.set(0.5, 1.0, 0.35);
  const s = kit.sign(1.3, 0.3, (c, w, h) => label(c, w, h, "HUMAN REVIEW · RING BELL", { bg: "#f2c94c" }), g);
  s.position.set(0, 2.35, 0.16);
  return { group: g, spots: [{ pos: new T.Vector3(-0.3, 0, 1.0), face: 0 }, { pos: new T.Vector3(0.8, 0, 1.15), face: -0.3 }] as Spot[], bell };
}

// Arcade cabinet; the only game is a tax simulator.
export function arcade(kit: Kit) {
  const g = new T.Group();
  const cab = kit.box(0.9, 1.8, 0.7, kit.paint("#3d405b"), g, 0.05);
  cab.position.y = 0.9;
  const scr = kit.sign(0.6, 0.45, (c, w, h) => { c.fillStyle = "#0d1020"; c.fillRect(0, 0, w, h); label(c, w, h, "TAX\nINVADERS", { fg: "#5ff2b5" }); }, g, 128, true);
  scr.position.set(0, 1.35, 0.36);
  kit.box(0.8, 0.08, 0.35, kit.paint("#2c3440"), g, 0.02).position.set(0, 0.95, 0.45);
  for (const [x, c] of [[-0.2, "#ff5a4f"], [0, "#f2c94c"], [0.2, "#63d3ff"]] as const) kit.mesh(new T.SphereGeometry(0.04, 10, 8), kit.glow(c), g, { line: false }).position.set(x, 1.0, 0.52);
  const top = kit.sign(0.86, 0.2, (c, w, h) => label(c, w, h, "OUT OF ORDER*", { bg: "#f2c94c" }), g);
  top.position.set(0, 1.92, 0.36);
  return { group: g, spots: [{ pos: new T.Vector3(0, 0, 0.95), face: Math.PI }] as Spot[] };
}

// The Zen garden: a tray of screws, raked into patterns by robots who need a minute.
export function zenGarden(kit: Kit) {
  const g = new T.Group();
  kit.box(1.6, 0.3, 1.0, kit.paint("#8a6f5a"), g, 0.05).position.y = 0.15;
  const sand = kit.box(1.45, 0.04, 0.85, kit.paint("#a8a49a"), g, 0.01);
  sand.position.y = 0.31;
  const screw = kit.paint("#5d6b7d");
  for (let i = 0; i < 24; i++) kit.mesh(new T.CylinderGeometry(0.02, 0.012, 0.06, 6), screw, g, { line: false }).position.set((i % 6 - 2.5) * 0.2, 0.35, (Math.floor(i / 6) - 1.5) * 0.18);
  const s = kit.sign(0.8, 0.18, (c, w, h) => label(c, w, h, "ZEN GARDEN (SCREWS)", { bg: "#f4f1ea" }), g);
  s.position.set(0, 0.16, 0.51);
  return { group: g, spots: [{ pos: new T.Vector3(0, 0, -0.9), face: 0 }] as Spot[] };
}

// Leftovers: an office plant (deceased) and the head of a previous employee.
export function junk(kit: Kit) {
  const g = new T.Group();
  const pot = kit.can(0.22, 0.28, 0.4, kit.paint("#c06a3c"), g);
  pot.position.set(-0.9, 0, 0);
  const stem = kit.can(0.02, 0.015, 0.7, kit.paint("#6b5a3a"), g);
  stem.position.set(-0.9, 0.38, 0);
  stem.rotation.z = 0.5;
  const tag = kit.sign(0.5, 0.14, (c, w, h) => label(c, w, h, "PLANT (DECEASED)", { bg: "#f4f1ea" }), g);
  tag.position.set(-0.9, 0.2, 0.3);
  const head = kit.box(0.45, 0.38, 0.4, kit.paint("#9aa6b2"), g, 0.08);
  head.position.set(0.4, 0.17, 0.1);
  head.rotation.set(0.3, 0.6, 0.5);
  for (const x of [-0.09, 0.09]) { const e = kit.mesh(new T.TorusGeometry(0.05, 0.015, 6, 16), kit.paint("#2c3440"), head, { line: false }); e.position.set(x, 0.04, 0.21); }
  const rip = kit.sign(0.42, 0.12, (c, w, h) => label(c, w, h, "R.I.P. KEVIN", { bg: "#f4f1ea" }), g);
  rip.position.set(0.45, 0.03, 0.45);
  rip.rotation.x = -Math.PI / 2;
  return { group: g };
}
