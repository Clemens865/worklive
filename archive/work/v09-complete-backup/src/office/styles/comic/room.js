import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { ROOM } from "../../layout.js";
import { toon, ink, geo, flat, gradientMap } from "./toon.js";
import { buildDesks } from "./desks.js";
import { buildFurniture } from "./furniture.js";
import { buildDecor } from "./decor.js";
import { mergeStatic, mergePerGroup } from "./merge.js";
import { addBox } from "./colliders.js";

// Comic office: chunky rounded furniture, toon materials, ink hulls, warm cheerful palette.
export const PAL = {
  wood: "#e0a96d", woodDark: "#b97c45", wall: "#fbf1dd", wallAccent: "#8fd3c1", trim: "#f6d487",
  ink: "#231a1e", white: "#fffaf0", navy: "#33415e", berry: "#e8594a", sun: "#f7c948", lilac: "#a98bdf",
  sky: "#7ec8e3", leaf: "#58b368", leaf2: "#8fd16a", pot: "#ee8a5d", steel: "#9aa6b8", cream: "#f5e6c8",
};

// Rounded box with toon material + ink outline. Geometry is cached per size.
export function rb(w, h, d, color, x, y, z, parent, r = 0.04, w8 = 0.012) {
  const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const g = geo(`rb${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)},${rr.toFixed(3)}`, () => new RoundedBoxGeometry(w, h, d, 3, rr));
  const m = new T.Mesh(g, typeof color === "string" ? toon(color, { rim: 0.12 }) : color);
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
  if (w8) ink(m, w8);
  parent.add(m); return m;
}
export function cy(rt, rb_, h, color, x, y, z, parent, seg = 24, w8 = 0.012) {
  const g = geo(`cy${rt},${rb_},${h},${seg}`, () => new T.CylinderGeometry(rt, rb_, h, seg));
  const m = new T.Mesh(g, typeof color === "string" ? toon(color, { rim: 0.12 }) : color);
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
  if (w8) ink(m, w8);
  parent.add(m); return m;
}

function floorTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 1024;
  const g = c.getContext("2d");
  const cols = ["#e8b57a", "#e2ab6e", "#edbd84", "#dea468"];
  const plankH = 64;
  for (let row = 0; row < 1024 / plankH; row++) {
    let x = -((row * 173) % 300);
    while (x < 1024) {
      const len = 240 + ((row * 31 + x) % 5) * 40;
      g.fillStyle = cols[(row + Math.floor(x / 97)) & 3]; g.fillRect(x, row * plankH, len, plankH);
      g.strokeStyle = "rgba(120,70,30,0.12)"; g.lineWidth = 2;
      for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x + 10, row * plankH + 14 + k * 16); g.bezierCurveTo(x + len * 0.3, row * plankH + 8 + k * 16, x + len * 0.6, row * plankH + 22 + k * 16, x + len - 10, row * plankH + 14 + k * 16); g.stroke(); }
      g.fillStyle = "#7a4a2a"; g.fillRect(x, row * plankH, 3, plankH);
      x += len;
    }
    g.fillStyle = "#8a5634"; g.fillRect(0, row * plankH, 1024, 3);
  }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set((ROOM.maxX - ROOM.minX) / 5, (ROOM.maxZ - ROOM.minZ) / 5); t.anisotropy = 8; return t;
}

function wallGroup(root, walls, name, x, z, rotY) {
  const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
  g.userData = { name, normal: new T.Vector3(0, 0, 1).applyAxisAngle(new T.Vector3(0, 1, 0), rotY) };
  root.add(g); walls.push(g); return g;
}

export function buildComicRoom(scene, renderer) {
  const root = new T.Group(); scene.add(root);
  const walls = [];
  const W = ROOM.maxX - ROOM.minX, D = ROOM.maxZ - ROOM.minZ, H = ROOM.height;
  const floor = new T.Mesh(new T.BoxGeometry(W, 0.2, D), new T.MeshToonMaterial({ map: floorTexture(), gradientMap: gradientMap() }));
  floor.position.y = -0.1; floor.receiveShadow = true; root.add(floor);
  rb(W + 0.4, 0.5, D + 0.4, "#6f5a7a", 0, -0.35, 0, root, 0.12, 0.02);

  // Back wall: chunky window frames looking out onto a cartoon city
  const back = wallGroup(root, walls, "back", 0, ROOM.minZ, 0);
  addBox("window-wall", back, 0, H / 2, 0, W, H, 0.3);
  rb(W, 0.5, 0.26, PAL.wallAccent, 0, 0.25, 0, back, 0.06);
  rb(W, 0.3, 0.26, PAL.wallAccent, 0, H - 0.15, 0, back, 0.06);
  const n = 8;
  for (let i = 0; i <= n; i++) rb(0.22, H, 0.28, PAL.wallAccent, -W / 2 + (i * W) / n, H / 2, 0, back, 0.06);
  for (let i = 0; i < n; i++) rb(W / n - 0.2, 0.1, 0.12, PAL.white, -W / 2 + (i + 0.5) * W / n, 1.9, 0, back, 0.03, 0.008);
  const glass = new T.Mesh(new T.PlaneGeometry(W, H), new T.MeshBasicMaterial({ color: "#e6f7ff", transparent: true, opacity: 0.12, depthWrite: false }));
  glass.position.y = H / 2; back.add(glass);

  const left = wallGroup(root, walls, "left", ROOM.minX, 0, Math.PI / 2);
  const right = wallGroup(root, walls, "right", ROOM.maxX, 0, -Math.PI / 2);
  const front = wallGroup(root, walls, "front", 0, ROOM.maxZ, Math.PI);
  for (const [g, w] of [[left, D], [right, D], [front, W]]) {
    rb(w, H, 0.24, PAL.wall, 0, H / 2, 0, g, 0.05);
    rb(w, 0.16, 0.3, PAL.woodDark, 0, 0.08, 0.03, g, 0.04);
    rb(w, 0.9, 0.04, "#f4c9a8", 0, 0.62, 0.13, g, 0.02, 0.008);
    rb(w, 0.06, 0.08, PAL.woodDark, 0, 1.07, 0.15, g, 0.02, 0.008);
  }
  buildDesks(root);
  buildFurniture(root, right);
  const decor = buildDecor(scene, root, { left, right, back, front });
  {
    mergeStatic(root, walls);
    for (const w of walls) mergeStatic(w);
    mergeStatic(scene.getObjectByName("skyline"));
    for (const c of root.userData.chairs) mergePerGroup(c);
  }
  return { root, walls, screens: root.userData.screens, chairs: root.userData.chairs, ...decor };
}
