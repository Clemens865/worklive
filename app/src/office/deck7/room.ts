import * as T from "three";
import { Kit, label } from "./kit";

// The shell of Ops Deck 7: grimy panel floor, a cut-away back and left wall, portholes onto space,
// flickering light strips, taped pipes and passive-aggressive notices.

export interface RoomDims { x0: number; x1: number; z0: number; z1: number; h: number }

function floorTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const g = c.getContext("2d")!;
  g.fillStyle = "#59616f"; g.fillRect(0, 0, 1024, 1024);
  const n = 12, s = 1024 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const k = ((i * 7 + j * 13) % 5) * 3;
    g.fillStyle = `rgb(${104 + k},${112 + k},${126 + k})`;
    g.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
    g.fillStyle = "#2f343e";
    for (const [x, y] of [[8, 8], [s - 8, 8], [8, s - 8], [s - 8, s - 8]]) { g.beginPath(); g.arc(i * s + x, j * s + y, 3, 0, 7); g.fill(); }
  }
  // grime, oil stains and scuffs
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * 1024, y = Math.random() * 1024, r = 10 + Math.random() * 60;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(20,18,16,${0.12 + Math.random() * 0.2})`);
    gr.addColorStop(1, "rgba(20,18,16,0)");
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.strokeStyle = "rgba(255,255,255,0.05)"; g.lineWidth = 2;
  for (let i = 0; i < 40; i++) { const x = Math.random() * 1024, y = Math.random() * 1024; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 120, y + (Math.random() - 0.5) * 40); g.stroke(); }
  // hazard stripes along the back wall
  for (let x = -40; x < 1024; x += 40) { g.fillStyle = "#e0b531"; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 20, 0); g.lineTo(x + 40, 26); g.lineTo(x + 20, 26); g.fill(); }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function starTexture() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, 256);
  bg.addColorStop(0, "#070b1c"); bg.addColorStop(1, "#151036");
  g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`; g.fillRect(Math.random() * 512, Math.random() * 256, Math.random() < 0.1 ? 2 : 1, Math.random() < 0.1 ? 2 : 1); }
  // a ringed planet, for scale and for existential staring
  g.fillStyle = "#e07a5f"; g.beginPath(); g.arc(380, 150, 46, 0, 7); g.fill();
  g.strokeStyle = "rgba(242,204,143,0.8)"; g.lineWidth = 5; g.beginPath(); g.ellipse(380, 150, 80, 16, -0.3, 0, 7); g.stroke();
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = T.RepeatWrapping;
  return t;
}

export function buildRoom(kit: Kit, dims: RoomDims, windowsAt: number[]) {
  const g = new T.Group();
  const { x0, x1, z0, z1, h } = dims;
  const W = x1 - x0, D = z1 - z0;

  const floorMat = kit.finish === "cartoon" ? new T.MeshToonMaterial({ map: floorTexture() }) : new T.MeshStandardMaterial({ map: floorTexture(), roughness: 0.85, metalness: 0.15 });
  kit.mats.push(floorMat);
  const floor = kit.mesh(new T.BoxGeometry(W, 0.2, D), floorMat, g, { line: false, shadow: false });
  floor.position.set((x0 + x1) / 2, -0.1, (z0 + z1) / 2);
  floor.receiveShadow = true;

  const wallM = kit.paint("#7d8a9c"), trimM = kit.paint("#2c3440"), pipeM = kit.paint("#8a6f5a"), tape = kit.paint("#d9d4c3");
  const back = kit.box(W, h, 0.3, wallM, g, 0.06);
  back.position.set((x0 + x1) / 2, h / 2, z0 - 0.15);
  const left = kit.box(0.3, h, D, wallM, g, 0.06);
  left.position.set(x0 - 0.15, h / 2, (z0 + z1) / 2);
  // skirting and a top rail
  kit.box(W, 0.22, 0.12, trimM, g).position.set((x0 + x1) / 2, 0.11, z0 + 0.04);
  kit.box(0.12, 0.22, D, trimM, g).position.set(x0 + 0.04, 0.11, (z0 + z1) / 2);
  kit.box(W, 0.14, 0.16, trimM, g).position.set((x0 + x1) / 2, h - 0.2, z0 + 0.06);

  // portholes onto space (the stars drift)
  const stars = starTexture();
  const starM = new T.MeshBasicMaterial({ map: stars });
  kit.mats.push(starM);
  const windows: { x: number; z: number }[] = [];
  for (const [i, x] of windowsAt.entries()) {
    const w = new T.Group();
    w.position.set(x, 2.25, z0 + 0.02);
    g.add(w);
    const rim = kit.mesh(new T.TorusGeometry(0.85, 0.12, 12, 40), kit.paint("#9aa6b2"), w);
    rim.position.z = 0.05;
    const glassDisc = kit.mesh(new T.CircleGeometry(0.85, 40), starM, w, { line: false, shadow: false });
    glassDisc.position.z = 0.01;
    if (i === 0) stars.offset.x = 0.3;
    for (let k = 0; k < 8; k++) { // rivets
      const a = (k / 8) * Math.PI * 2;
      kit.mesh(new T.SphereGeometry(0.035, 8, 6), trimM, w, { line: false }).position.set(Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0.17);
    }
    windows.push({ x, z: z0 + 1.1 });
  }

  // pipes along the left wall with duct-tape patches
  for (const [y, r] of [[3.3, 0.11], [3.0, 0.07], [0.5, 0.09]] as const) {
    const p = kit.mesh(new T.CylinderGeometry(r, r, D - 0.2, 16), pipeM, g);
    p.rotation.x = Math.PI / 2;
    p.position.set(x0 + 0.2, y, (z0 + z1) / 2);
    for (const z of [z0 + D * 0.2, z0 + D * 0.5, z0 + D * 0.75]) { const b = kit.mesh(new T.CylinderGeometry(r * 1.15, r * 1.15, 0.18, 16), tape, g, { line: false }); b.rotation.x = Math.PI / 2; b.position.set(x0 + 0.2, y, z + y * 0.3); }
  }

  // light strips; one of them has given up
  const strips: T.MeshStandardMaterial[] = [];
  for (const [i, x] of [x0 + W * 0.15, (x0 + x1) / 2, x1 - W * 0.15].entries()) {
    const m = new T.MeshStandardMaterial({ color: "#fff4d6", emissive: "#fff4d6", emissiveIntensity: 1.2 });
    kit.mats.push(m);
    strips.push(m);
    kit.box(2.4, 0.08, 0.1, m, g, 0.02).position.set(x, h - 0.38, z0 + 0.08);
    if (i === 1) m.userData.flaky = true;
  }

  // the wall notices are user-editable posters now (posters.ts)
  const big = kit.sign(3.2, 0.7, (c, cw, ch) => label(c, cw, ch, "OPS DECK 7", { bg: "#2c3440", fg: "#f2c94c" }), g, 512);
  big.position.set(x0 + 0.02, 2.3, (z0 + z1) / 2 - 1);
  big.rotation.y = Math.PI / 2;

  // crates and a cable bundle in the corner
  const crateM = kit.paint("#a07a52");
  for (const [x, z, s, r] of [[x1 - 0.9, z0 + 0.7, 0.7, 0.2], [x1 - 0.8, z0 + 1.5, 0.5, -0.3], [x1 - 1.5, z0 + 0.75, 0.45, 0.5]] as const) {
    const cr = kit.box(s, s, s, crateM, g, 0.03);
    cr.position.set(x, s / 2 + (s === 0.45 ? 0.7 : 0), z);
    cr.rotation.y = r;
    kit.box(s * 1.01, 0.08, s * 1.01, tape, cr, 0.01);
  }
  const cableM = kit.paint("#23262d");
  for (let i = 0; i < 4; i++) kit.cable(new T.Vector3(x0 + 0.3, 0.5, z0 + 3.4 + i * 0.25), new T.Vector3(x0 + 0.5 + i * 0.12, 0.04, z0 + 1.9 + i * 0.2), 0.45, 0.035, cableM, g); // along the wall, out of the way

  return {
    group: g,
    windows,
    /** 0..1 from the hamster-wheel generator: the light strips get brighter. */
    boost: 0,
    update(t: number, dt: number) {
      stars.offset.x += dt * 0.004;
      for (const m of strips) m.emissiveIntensity = m.userData.flaky ? (Math.random() < 0.06 * (1 - this.boost) ? 0.1 : Math.sin(t * 40) > -0.9 ? 1.2 + this.boost : 0.3) : 1.2 + this.boost * 0.8;
    },
  };
}
