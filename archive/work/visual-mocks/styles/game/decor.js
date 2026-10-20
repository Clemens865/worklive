import * as T from "three";
import { ROOM, LOUNGE, CAFE, MEETING, PLANTS } from "../../layout.js";
import { rb, cyl, M, officeChair } from "./furniture.js";
import { std, phys, cloth, feltTex } from "./materials.js";

function leafTex() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 128; const g = c.getContext("2d");
  g.clearRect(0, 0, 64, 128);
  const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, "#2f5a2c"); gr.addColorStop(0.5, "#4f8a45"); gr.addColorStop(1, "#2f5a2c");
  g.fillStyle = gr; g.beginPath(); g.moveTo(32, 2); g.bezierCurveTo(64, 30, 62, 90, 32, 126); g.bezierCurveTo(2, 90, 0, 30, 32, 2); g.fill();
  g.strokeStyle = "rgba(200,230,170,.5)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(32, 4); g.lineTo(32, 124); g.stroke();
  for (let i = 1; i < 8; i++) { g.lineWidth = 0.8; g.beginPath(); g.moveTo(32, i * 15); g.lineTo(8, i * 15 - 10); g.moveTo(32, i * 15); g.lineTo(56, i * 15 - 10); g.stroke(); }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
let leafGeo, leafMat;
function plant(parent, x, z, s) {
  leafGeo ||= (() => { const g = new T.PlaneGeometry(0.16, 0.34, 2, 6); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 0.17, xx = p.getX(i); p.setZ(i, -y * y * 1.2 + Math.abs(xx) * -0.25); p.setY(i, y); } g.computeVertexNormals(); return g; })();
  leafMat ||= std("#ffffff", { map: leafTex(), alphaTest: 0.5, side: T.DoubleSide, roughness: 0.55 });
  const g = new T.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); parent.add(g);
  const pot = new T.Mesh(new T.LatheGeometry([[0, 0], [0.17, 0], [0.21, 0.05], [0.23, 0.42], [0.21, 0.42], [0.2, 0.38], [0, 0.38]].map(p => new T.Vector2(...p)), 28), std("#8d8880", { roughness: 0.85 }));
  pot.castShadow = pot.receiveShadow = true; g.add(pot);
  let r = s * 99 | 0; const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 26; i++) {
    const a = i * 2.39996, h = 0.45 + rnd() * 0.9, rad = 0.04 + rnd() * 0.16;
    const stem = cyl(0.006, 0.008, h - 0.3, std("#4d6b3a"), Math.sin(a) * rad * 0.5, 0.3 + (h - 0.3) / 2, Math.cos(a) * rad * 0.5, g, 5, { cast: false });
    const leaf = new T.Mesh(leafGeo, leafMat); leaf.position.set(Math.sin(a) * rad, h, Math.cos(a) * rad);
    leaf.rotation.set(-0.9 + rnd() * 0.5, a, 0, "YXZ"); leaf.scale.setScalar(0.8 + rnd() * 0.6); leaf.castShadow = true; g.add(leaf);
    stem.rotation.set(Math.cos(a) * 0.15, 0, -Math.sin(a) * 0.15);
  }
}

function pendant(parent, x, z, lights, glow, withLight = true) {
  const y = ROOM.height - 1.25;
  cyl(0.004, 0.004, 1.2, M.plastic, x, ROOM.height - 0.6, z, parent, 6, { cast: false });
  const shade = new T.Mesh(new T.LatheGeometry([[0.02, 0.2], [0.05, 0.19], [0.1, 0.12], [0.26, 0.0], [0.255, -0.005], [0.095, 0.115], [0.045, 0.185]].map(p => new T.Vector2(...p)), 36), phys("#1f2023", { roughness: 0.35, metalness: 0.6, side: T.DoubleSide }));
  shade.position.set(x, y, z); parent.add(shade);
  const bulb = new T.Mesh(new T.SphereGeometry(0.05, 16, 10), glow); bulb.position.set(x, y + 0.03, z); parent.add(bulb);
  if (!withLight) return;
  const light = new T.PointLight("#ffc98c", 3.2, 7, 1.7); light.position.set(x, y - 0.05, z); parent.add(light); lights.push(light);
}

export function buildDecor(root) {
  const lights = [];
  const glow = std("#fff2d8", { emissive: "#ffd9a0", emissiveIntensity: 6 });
  for (const x of [-7.15, -1.85]) for (const z of [-3.2, 0.8]) pendant(root, x, z, lights, glow, false);
  // One warm point light per desk cluster (instead of one per pendant) keeps the per-pixel light count low.
  for (const x of [-7.15, -1.85]) { const l = new T.PointLight("#ffc98c", 6, 9, 1.6); l.position.set(x, 1.9, -1.2); root.add(l); lights.push(l); }
  pendant(root, CAFE.table.x, CAFE.table.z, lights, glow);

  // Lounge: rug, leather-and-fabric sofa, walnut table, two armchairs, media wall.
  const rugMat = std("#ffffff", { map: feltTex("#9a8a74", 12), roughness: 1 }); rugMat.map.repeat.set(6, 6);
  const rug = new T.Mesh(new T.CircleGeometry(2.3, 48), rugMat); rug.rotation.x = -Math.PI / 2; rug.position.set(6.7, 0.006, 4.2); rug.receiveShadow = true; root.add(rug);
  const sofa = new T.Group(); sofa.position.set(LOUNGE.sofa.x, 0, LOUNGE.sofa.z); sofa.rotation.y = LOUNGE.sofa.yaw; root.add(sofa);
  rb(2.3, 0.2, 0.9, M.fabricSofa, 0, 0.23, -0.04, sofa, 0.05);
  for (const s of [-0.56, 0.56]) rb(1.08, 0.13, 0.72, M.fabricSofa, s, 0.4, 0.03, sofa, 0.06);
  rb(2.3, 0.5, 0.22, M.fabricSofa, 0, 0.6, -0.4, sofa, 0.08);
  for (const s of [-0.56, 0.56]) rb(1.0, 0.4, 0.14, M.fabricSofa, s, 0.66, -0.26, sofa, 0.07, { rot: [-0.15, 0, 0] });
  for (const s of [-1, 1]) rb(0.18, 0.46, 0.9, M.fabricSofa, s * 1.12, 0.42, -0.04, sofa, 0.07);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.02, 0.015, 0.13, M.walnut, sx * 1.05, 0.065, sz * 0.36 - 0.04, sofa, 8);
  rb(0.42, 0.34, 0.12, cloth("#b56a47", "knit"), 0.8, 0.6, -0.22, sofa, 0.06, { rot: [-0.2, 0.2, 0.08] });
  cyl(0.55, 0.55, 0.04, M.walnut, LOUNGE.table.x, 0.42, LOUNGE.table.z, root, 40);
  cyl(0.03, 0.03, 0.4, M.steel, LOUNGE.table.x, 0.2, LOUNGE.table.z, root, 10);
  cyl(0.3, 0.3, 0.02, M.steel, LOUNGE.table.x, 0.01, LOUNGE.table.z, root, 28);
  for (let i = 0; i < 3; i++) rb(0.22, 0.03, 0.3, [M.paper, std("#2f4a5a"), std("#b04a36")][i], LOUNGE.table.x - 0.1 + i * 0.03, 0.455 + i * 0.03, LOUNGE.table.z + 0.05, root, 0.004, { rot: [0, i * 0.3, 0] });
  for (const c of LOUNGE.chairs) {
    const g = new T.Group(); g.position.set(c.x, 0, c.z); g.rotation.y = c.yaw; root.add(g);
    rb(0.78, 0.14, 0.72, M.leather, 0, 0.36, 0, g, 0.05); rb(0.78, 0.5, 0.14, M.leather, 0, 0.62, -0.32, g, 0.06, { rot: [-0.12, 0, 0] });
    for (const s of [-1, 1]) { rb(0.1, 0.24, 0.66, M.leather, s * 0.37, 0.5, 0, g, 0.04); cyl(0.018, 0.012, 0.3, M.walnut, s * 0.32, 0.15, 0.28, g, 8); cyl(0.018, 0.012, 0.3, M.walnut, s * 0.32, 0.15, -0.28, g, 8); }
  }
  const tv = new T.Group(); tv.position.set(LOUNGE.screen.x - 0.12, 1.5, LOUNGE.screen.z); tv.rotation.y = -Math.PI / 2; root.add(tv);
  rb(1.9, 1.1, 0.05, M.plastic, 0, 0, 0, tv, 0.01);
  const board = new T.Mesh(new T.PlaneGeometry(1.84, 1.04), new T.MeshBasicMaterial({ color: "#1b2a33" })); board.position.z = 0.027; tv.add(board);
  rb(2.2, 0.35, 0.4, M.walnut, LOUNGE.screen.x - 0.3, 0.18, LOUNGE.screen.z, root, 0.02);

  // Cafe: concrete-top counter with walnut fronts, espresso machine, upper shelf.
  const c = CAFE.counter;
  rb(c.w, 0.88, 0.6, M.walnut, c.x, 0.44, c.z, root, 0.01);
  rb(c.w + 0.06, 0.05, 0.66, std("#8a8782", { roughness: 0.5 }), c.x, 0.905, c.z, root, 0.01);
  rb(0.42, 0.42, 0.36, M.alu, c.x + 1.2, 1.14, c.z - 0.05, root, 0.03);
  rb(0.34, 0.05, 0.3, M.plastic, c.x + 1.2, 0.96, c.z + 0.02, root, 0.01);
  for (let i = 0; i < 5; i++) cyl(0.04, 0.035, 0.09, M.ceramic, c.x - 1.4 + i * 0.12, 0.975, c.z - 0.1, root, 14);
  rb(c.w, 0.04, 0.3, M.oak, c.x, 1.75, c.z - 0.15, root, 0.01);
  for (let i = 0; i < 9; i++) rb(0.12, 0.2 + (i % 3) * 0.04, 0.12, [M.ceramic, std("#6d8b74"), std("#c4744f")][i % 3], c.x - 1.8 + i * 0.44, 1.87, c.z - 0.15, root, 0.02);
  cyl(0.45, 0.45, 0.04, M.oak, CAFE.table.x, 1.02, CAFE.table.z, root, 36);
  cyl(0.035, 0.035, 1.0, M.steel, CAFE.table.x, 0.5, CAFE.table.z, root, 10); cyl(0.25, 0.25, 0.02, M.steel, CAFE.table.x, 0.01, CAFE.table.z, root, 24);
  for (const s of CAFE.stools) { cyl(0.18, 0.17, 0.05, M.leather, s.x, 0.74, s.z, root, 24); cyl(0.02, 0.02, 0.72, M.steel, s.x, 0.36, s.z, root, 8); cyl(0.14, 0.14, 0.012, M.steel, s.x, 0.3, s.z, root, 18, { cast: false }); }

  // Meeting room: steel-framed glass box.
  const m = MEETING, mw = m.maxX - m.minX, md = m.maxZ - m.minZ;
  const glassMat = phys("#b8d0d6", { transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false, side: T.DoubleSide });
  const g1 = new T.Mesh(new T.PlaneGeometry(mw, ROOM.height), glassMat); g1.position.set(m.minX + mw / 2, ROOM.height / 2, m.maxZ); root.add(g1);
  const g2 = new T.Mesh(new T.PlaneGeometry(md, ROOM.height), glassMat); g2.rotation.y = Math.PI / 2; g2.position.set(m.minX, ROOM.height / 2, m.minZ + md / 2); root.add(g2);
  rb(0.06, ROOM.height, 0.06, M.steel, m.minX, ROOM.height / 2, m.maxZ, root, 0.005);
  rb(mw, 0.05, 0.06, M.steel, m.minX + mw / 2, ROOM.height - 0.025, m.maxZ, root, 0.005); rb(0.06, 0.05, md, M.steel, m.minX, ROOM.height - 0.025, m.minZ + md / 2, root, 0.005);
  rb(2.6, 0.05, 1.1, M.walnut, m.minX + mw / 2, 0.745, m.minZ + md / 2, root, 0.015);
  for (const s of [-1, 1]) rb(0.06, 0.72, 0.8, M.steel, m.minX + mw / 2 + s * 1.05, 0.36, m.minZ + md / 2, root, 0.01);
  for (let i = 0; i < 4; i++) { const ch = officeChair(root); ch.position.set(m.minX + mw / 2 - 0.7 + (i % 2) * 1.4, 0, m.minZ + md / 2 + (i < 2 ? -0.85 : 0.85)); ch.rotation.y = i < 2 ? Math.PI : 0; }

  for (const p of PLANTS) plant(root, p.x, p.z, p.s);
  return { lights, board };
}
