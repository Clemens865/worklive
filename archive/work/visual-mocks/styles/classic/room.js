import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { ROOM, DESKS, LOUNGE, CAFE, MEETING, PLANTS } from "../../layout.js";

// Style A: clean, detailed, rounded forms. Everything procedural, no external assets.
export const PAL = {
  floor: "#d6cfc4", oak: "#cfb08a", white: "#f6f5f2", black: "#2a2c2e", steel: "#9aa0a3",
  sage: "#9fb59a", oat: "#d9cfc0", clay: "#c98f6b", wall: "#f1efeb", glass: "#cfe6ee",
  leaf: "#5f8a5a", leaf2: "#86a870", pot: "#e7dfd3",
};
const mats = {};
export function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  return mats[key] ||= new T.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, ...o });
}
export function rbox(w, h, d, m, x, y, z, parent, r = 0.03) {
  const mesh = new T.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)), typeof m === "string" ? mat(m) : m);
  mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
export function cyl(rt, rb, h, m, x, y, z, parent, seg = 28) {
  const mesh = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg), typeof m === "string" ? mat(m) : m);
  mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

function floorTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 1024;
  const g = c.getContext("2d");
  g.fillStyle = PAL.floor; g.fillRect(0, 0, 1024, 1024);
  // Large-format tiles with subtle variation
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const v = 212 + ((i * 7 + j * 13) % 9) - 4;
    g.fillStyle = `rgb(${v},${v - 6},${v - 14})`; g.fillRect(i * 128 + 1, j * 128 + 1, 126, 126);
  }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(5.5, 3.5); t.anisotropy = 8; return t;
}

export function officeChair(parent, color = PAL.black) {
  const g = new T.Group(); parent.add(g);
  rbox(0.5, 0.08, 0.48, color, 0, 0.48, 0, g, 0.035);
  rbox(0.46, 0.52, 0.06, color, 0, 0.8, 0.24, g, 0.03).rotation.x = -0.1;
  cyl(0.025, 0.025, 0.36, PAL.steel, 0, 0.27, 0, g, 12);
  for (let i = 0; i < 5; i++) {
    const leg = rbox(0.3, 0.03, 0.04, PAL.steel, 0, 0.06, 0, g, 0.01);
    leg.rotation.y = (i / 5) * Math.PI * 2; leg.translateX(0.15);
    cyl(0.03, 0.03, 0.04, PAL.black, 0, 0.025, 0, g, 10).position.set(Math.cos(-leg.rotation.y) * 0.29, 0.025, Math.sin(-leg.rotation.y) * 0.29);
  }
  for (const s of [-1, 1]) rbox(0.04, 0.2, 0.3, color, s * 0.26, 0.6, 0.02, g, 0.015);
  return g;
}

function plant(parent, x, z, s) {
  const g = new T.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); parent.add(g);
  cyl(0.22, 0.17, 0.42, PAL.pot, 0, 0.21, 0, g);
  cyl(0.2, 0.2, 0.02, "#5b4a3a", 0, 0.41, 0, g);
  for (let i = 0; i < 14; i++) {
    const a = i * 2.39, h = 0.6 + (i % 5) * 0.14, r = 0.08 + (i % 3) * 0.06;
    const leaf = new T.Mesh(new T.SphereGeometry(0.13, 14, 10), mat(i % 2 ? PAL.leaf : PAL.leaf2, { roughness: 0.5 }));
    leaf.scale.set(0.45, 0.12, 1.25); leaf.position.set(Math.sin(a) * r * 2, h, Math.cos(a) * r * 2);
    leaf.rotation.set(-0.5 - (i % 3) * 0.2, a, 0); leaf.castShadow = true; g.add(leaf);
    const stem = cyl(0.008, 0.01, h - 0.4, PAL.leaf, Math.sin(a) * r, 0.4 + (h - 0.4) / 2, Math.cos(a) * r, g, 6);
    stem.rotation.set(Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25);
  }
}

function pendant(parent, x, z, lights) {
  cyl(0.004, 0.004, 1.2, PAL.black, x, ROOM.height - 0.6, z, parent, 6);
  const shade = cyl(0.05, 0.28, 0.22, mat(PAL.black, { roughness: 0.35, metalness: 0.3 }), x, ROOM.height - 1.3, z, parent);
  shade.castShadow = false;
  const bulb = new T.Mesh(new T.CircleGeometry(0.26, 28), new T.MeshBasicMaterial({ color: "#fff3dc" }));
  bulb.rotation.x = Math.PI / 2; bulb.position.set(x, ROOM.height - 1.42, z); parent.add(bulb);
  const light = new T.PointLight("#ffe6c2", 5, 6, 1.6); light.position.set(x, ROOM.height - 1.5, z); parent.add(light); lights.push(light);
}

function skyline(parent) {
  const g = new T.Group(); parent.add(g);
  const win = document.createElement("canvas"); win.width = 64; win.height = 128;
  const w = win.getContext("2d"); w.fillStyle = "#b9c6cf"; w.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 10; j++) { w.fillStyle = (i + j) % 3 ? "#9fb0bd" : "#d5dee4"; w.fillRect(4 + i * 15, 4 + j * 12, 10, 8); }
  const wt = new T.CanvasTexture(win); wt.colorSpace = T.SRGBColorSpace;
  for (let i = 0; i < 26; i++) {
    const h = 5 + ((i * 37) % 19), wdt = 3 + (i % 4), x = -44 + i * 3.6, z = -30 - (i % 5) * 6;
    const tex = wt.clone(); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(wdt / 3, h / 6); tex.needsUpdate = true;
    const b = new T.Mesh(new T.BoxGeometry(wdt, h, 3), new T.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    b.position.set(x, h / 2 - 3, z); g.add(b);
  }
  const ground = new T.Mesh(new T.PlaneGeometry(200, 80), mat("#b9c4b6")); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -3.05, -40); g.add(ground);
  return g;
}

export function buildStylizedRoom(scene) {
  const root = new T.Group(); scene.add(root);
  const lights = [], walls = [];
  const W = ROOM.maxX - ROOM.minX, D = ROOM.maxZ - ROOM.minZ;
  const floor = new T.Mesh(new T.BoxGeometry(W, 0.2, D), new T.MeshStandardMaterial({ map: floorTexture(), roughness: 0.55 }));
  floor.position.y = -0.1; floor.receiveShadow = true; root.add(floor);
  rbox(W + 0.3, 0.3, D + 0.3, "#d8d4ce", 0, -0.2, 0, root, 0.05);

  // Walls: each is its own group so the camera can cut it away (dollhouse view).
  const wall = (name, w, x, z, rotY, glass) => {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; g.userData = { name, normal: new T.Vector3(0, 0, 1).applyAxisAngle(new T.Vector3(0, 1, 0), rotY) }; root.add(g);
    if (glass) {
      rbox(w, 0.12, 0.16, PAL.black, 0, 0.06, 0, g, 0.01);
      rbox(w, 0.1, 0.16, PAL.black, 0, ROOM.height, 0, g, 0.01);
      for (let i = 0; i <= Math.round(w / 2.2); i++) rbox(0.07, ROOM.height, 0.14, PAL.black, -w / 2 + i * (w / Math.round(w / 2.2)), ROOM.height / 2, 0, g, 0.01);
      const pane = new T.Mesh(new T.PlaneGeometry(w, ROOM.height), new T.MeshPhysicalMaterial({ color: PAL.glass, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0, depthWrite: false }));
      pane.position.y = ROOM.height / 2; g.add(pane);
    } else {
      rbox(w, ROOM.height, 0.18, PAL.wall, 0, ROOM.height / 2, 0, g, 0.02);
      rbox(w, 0.1, 0.2, "#e2ded7", 0, 0.05, 0.01, g, 0.01);
    }
    walls.push(g); return g;
  };
  wall("back", W, 0, ROOM.minZ, 0, true);
  const left = wall("left", D, ROOM.minX, 0, Math.PI / 2, false);
  const right = wall("right", D, ROOM.maxX, 0, -Math.PI / 2, false);
  wall("front", W, 0, ROOM.maxZ, Math.PI, false);
  skyline(scene);

  // Left wall: shelving and a framed print
  for (let i = 0; i < 3; i++) {
    const shelfX = -2.2 + i * 1.3;
    for (let s = 0; s < 4; s++) rbox(1.2, 0.04, 0.34, PAL.oak, shelfX, 0.4 + s * 0.5, 0.2, left, 0.01);
    for (const e of [-0.6, 0.6]) rbox(0.03, 1.95, 0.34, PAL.black, shelfX + e, 1.0, 0.2, left, 0.01);
    for (let s = 0; s < 4; s++) for (let b = 0; b < 5; b++) if ((b + s + i) % 3) rbox(0.07, 0.26 + (b % 2) * 0.05, 0.22, ["#c6b59a", "#7f9a86", "#d8cfc0", "#c98f6b"][(b + s) % 4], shelfX - 0.45 + b * 0.18, 0.56 + s * 0.5, 0.22, left, 0.01);
  }
  rbox(1.6, 1.0, 0.04, PAL.white, 2.8, 1.8, 0.12, left, 0.01);
  rbox(1.44, 0.84, 0.02, PAL.sage, 2.8, 1.8, 0.15, left, 0.01);

  // Desks
  for (const d of DESKS) {
    const g = new T.Group(); g.position.set(d.x, 0, d.z); root.add(g);
    rbox(1.9, 0.045, 0.85, PAL.white, 0, 0.74, 0, g, 0.015);
    rbox(1.88, 0.02, 0.83, PAL.oak, 0, 0.71, 0, g, 0.008);
    for (const s of [-1, 1]) { rbox(0.05, 0.7, 0.7, PAL.black, s * 0.88, 0.36, 0, g, 0.01); }
    rbox(1.2, 0.3, 0.02, PAL.sage, 0, 0.92, -0.43, g, 0.01); // privacy panel
  }
  // Pendants over desk clusters
  for (const x of [-7.15, -1.85]) for (const z of [-3.2, 0.8]) pendant(root, x, z, lights);

  // Lounge
  const sofa = new T.Group(); sofa.position.set(LOUNGE.sofa.x, 0, LOUNGE.sofa.z); sofa.rotation.y = LOUNGE.sofa.yaw; root.add(sofa);
  rbox(2.3, 0.22, 0.9, PAL.oat, 0, 0.3, 0, sofa, 0.08);
  rbox(2.3, 0.5, 0.22, PAL.oat, 0, 0.62, -0.36, sofa, 0.1);
  for (const s of [-1, 1]) rbox(0.2, 0.42, 0.9, PAL.oat, s * 1.1, 0.42, 0, sofa, 0.08);
  for (const s of [-0.55, 0.55]) rbox(1.0, 0.12, 0.66, "#e4dbcd", s, 0.47, 0.08, sofa, 0.06);
  for (const s of [-1, 1]) cyl(0.025, 0.02, 0.2, PAL.black, s * 1.05, 0.1, 0.35, sofa, 8);
  const rug = new T.Mesh(new T.CylinderGeometry(2.2, 2.2, 0.015, 48), mat("#c9c1b3", { roughness: 0.95 })); rug.position.set(6.8, 0.008, 4.2); rug.receiveShadow = true; root.add(rug);
  cyl(0.55, 0.55, 0.05, PAL.oak, LOUNGE.table.x, 0.42, LOUNGE.table.z, root);
  cyl(0.06, 0.2, 0.4, PAL.black, LOUNGE.table.x, 0.2, LOUNGE.table.z, root);
  for (const c of LOUNGE.chairs) {
    const g = new T.Group(); g.position.set(c.x, 0, c.z); g.rotation.y = c.yaw; root.add(g);
    rbox(0.8, 0.2, 0.75, PAL.sage, 0, 0.36, 0, g, 0.08); rbox(0.8, 0.45, 0.18, PAL.sage, 0, 0.62, -0.3, g, 0.08);
    for (const s of [-1, 1]) rbox(0.14, 0.3, 0.75, PAL.sage, s * 0.38, 0.5, 0, g, 0.06);
  }
  const screen = rbox(0.06, 1.1, 1.9, PAL.black, LOUNGE.screen.x - 0.1, 1.55, LOUNGE.screen.z, root, 0.02);
  const board = new T.Mesh(new T.PlaneGeometry(1.8, 1.0), new T.MeshBasicMaterial({ color: "#20302a" })); board.rotation.y = -Math.PI / 2; board.position.set(LOUNGE.screen.x - 0.14, 1.55, LOUNGE.screen.z); root.add(board);
  right.attach(screen); right.attach(board);

  // Cafe
  const c = CAFE.counter;
  rbox(c.w, 0.9, 0.62, PAL.white, c.x, 0.45, c.z, root, 0.02);
  rbox(c.w + 0.05, 0.04, 0.66, "#3b3f41", c.x, 0.92, c.z, root, 0.01);
  rbox(0.4, 0.45, 0.35, "#b8bcbe", c.x + 1.2, 1.17, c.z, root, 0.04);
  rbox(c.w, 0.6, 0.36, PAL.white, c.x, 2.1, c.z - 0.12, root, 0.02);
  cyl(0.45, 0.45, 0.04, PAL.white, CAFE.table.x, 1.02, CAFE.table.z, root);
  cyl(0.04, 0.04, 1.0, PAL.black, CAFE.table.x, 0.5, CAFE.table.z, root);
  for (const s of CAFE.stools) { cyl(0.18, 0.18, 0.05, PAL.clay, s.x, 0.72, s.z, root); cyl(0.02, 0.02, 0.7, PAL.black, s.x, 0.36, s.z, root, 8); }

  // Meeting room: glass box
  const m = MEETING, mw = m.maxX - m.minX, md = m.maxZ - m.minZ;
  const glassMat = new T.MeshPhysicalMaterial({ color: PAL.glass, transparent: true, opacity: 0.2, roughness: 0.05, depthWrite: false, side: T.DoubleSide });
  const g1 = new T.Mesh(new T.PlaneGeometry(mw, ROOM.height), glassMat); g1.position.set(m.minX + mw / 2, ROOM.height / 2, m.maxZ); root.add(g1);
  const g2 = new T.Mesh(new T.PlaneGeometry(md, ROOM.height), glassMat); g2.rotation.y = Math.PI / 2; g2.position.set(m.minX, ROOM.height / 2, m.minZ + md / 2); root.add(g2);
  rbox(0.05, ROOM.height, 0.05, PAL.black, m.minX, ROOM.height / 2, m.maxZ, root, 0.01);
  rbox(2.6, 0.05, 1.1, PAL.oak, m.minX + mw / 2, 0.74, m.minZ + md / 2, root, 0.02);
  for (const s of [-1, 1]) rbox(0.05, 0.72, 0.8, PAL.black, m.minX + mw / 2 + s * 1.1, 0.36, m.minZ + md / 2, root, 0.01);
  for (let i = 0; i < 4; i++) { const ch = officeChair(root, PAL.clay); ch.position.set(m.minX + mw / 2 - 0.9 + (i % 2) * 1.8, 0, m.minZ + md / 2 + (i < 2 ? -0.8 : 0.8)); ch.rotation.y = i < 2 ? 0 : Math.PI; }

  for (const p of PLANTS) plant(root, p.x, p.z, p.s);
  return { root, lights, walls, board };
}
