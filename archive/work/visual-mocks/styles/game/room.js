import * as T from "three";
import { ROOM } from "../../layout.js";
import { concreteTex, concreteRough, plasterTex, woodTex, std, phys, noiseTex } from "./materials.js";

// Room shell: polished concrete, brick + plaster walls, steel-and-glass curtain wall, city at golden hour.
export function box(w, h, d, m, x, y, z, parent, o = {}) {
  const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z); if (o.rot) mesh.rotation.set(...o.rot);
  mesh.castShadow = o.cast !== false; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

function brickTex() {
  const c = document.createElement("canvas"); c.width = c.height = 1024; const g = c.getContext("2d");
  let s = 5; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.fillStyle = "#b9ada0"; g.fillRect(0, 0, 1024, 1024);
  const bw = 128, bh = 42;
  for (let row = 0; row * bh < 1024; row++) for (let col = -1; col * bw < 1024; col++) {
    const x = col * bw + (row % 2) * bw / 2, y = row * bh;
    const h = 8 + r() * 14, l = 30 + r() * 16, sat = 30 + r() * 20;
    g.fillStyle = `hsl(${h},${sat}%,${l}%)`; g.fillRect(x + 4, y + 4, bw - 8, bh - 8);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,230,210"},${r() * 0.08})`; g.fillRect(x + 4 + r() * (bw - 12), y + 4 + r() * (bh - 12), 2 + r() * 10, 1 + r() * 4); }
  }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; return t;
}
function brickBump() {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
  g.fillStyle = "#222"; g.fillRect(0, 0, 256, 256); g.fillStyle = "#ddd";
  const bw = 32, bh = 10.5;
  for (let row = 0; row * bh < 256; row++) for (let col = -1; col * bw < 256; col++) g.fillRect(col * bw + (row % 2) * bw / 2 + 1.2, row * bh + 1.2, bw - 2.4, bh - 2.4);
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
}

function skyTex() {
  const c = document.createElement("canvas"); c.width = 16; c.height = 256; const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, "#5a7494"); gr.addColorStop(0.45, "#c9a88a"); gr.addColorStop(0.7, "#f2b27a"); gr.addColorStop(1, "#f6d3a2");
  g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

function city(scene) {
  const g = new T.Group(); scene.add(g);
  const sky = new T.Mesh(new T.PlaneGeometry(260, 70), new T.MeshBasicMaterial({ map: skyTex(), fog: false }));
  sky.position.set(0, 22, -95); g.add(sky);
  const wc = document.createElement("canvas"); wc.width = 64; wc.height = 128; const w = wc.getContext("2d");
  w.fillStyle = "#39414d"; w.fillRect(0, 0, 64, 128);
  let s = 3; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 10; j++) { const lit = r() < 0.3; w.fillStyle = lit ? `hsl(${35 + r() * 15},80%,${60 + r() * 20}%)` : `hsl(215,${15 + r() * 10}%,${22 + r() * 18}%)`; w.fillRect(4 + i * 15, 4 + j * 12, 10, 8); }
  const wt = new T.CanvasTexture(wc); wt.colorSpace = T.SRGBColorSpace; wt.wrapS = wt.wrapT = T.RepeatWrapping;
  for (let i = 0; i < 34; i++) {
    const h = 8 + ((i * 37) % 26), wd = 4 + (i % 5) * 1.5, x = -70 + i * 4.3 + (i % 3), z = -26 - (i % 6) * 7;
    const tex = wt.clone(); tex.repeat.set(wd / 4, h / 7); tex.needsUpdate = true;
    const m = new T.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: "#ffc98a", emissiveIntensity: 0.35, roughness: 0.7, metalness: 0.2 });
    const b = new T.Mesh(new T.BoxGeometry(wd, h, 4), m); b.position.set(x, h / 2 - 4, z); g.add(b);
  }
  const ground = new T.Mesh(new T.PlaneGeometry(300, 120), std("#4d4a44", { roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -4, -60); g.add(ground);
  return g;
}

export function buildShell(scene) {
  const root = new T.Group(); scene.add(root);
  const walls = [];
  const W = ROOM.maxX - ROOM.minX, D = ROOM.maxZ - ROOM.minZ, H = ROOM.height;
  const floorMat = std("#ffffff", { map: concreteTex(), roughnessMap: concreteRough(), roughness: 0.55, metalness: 0.0, envMapIntensity: 0.9 });
  const floor = new T.Mesh(new T.PlaneGeometry(W, D), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; root.add(floor);
  box(W + 0.6, 0.4, D + 0.6, std("#3b3a37", { roughness: 0.9 }), 0, -0.201, 0, root, { cast: false });
  const steel = std("#23262a", { roughness: 0.4, metalness: 0.7 });
  const plaster = std("#ffffff", { map: plasterTex(), roughness: 0.92 });
  const bt = brickTex(); bt.repeat.set(D / 4, H / 4);
  const bb = brickBump(); bb.repeat.set(D / 4, H / 4);
  const brick = std("#ffffff", { map: bt, bumpMap: bb, bumpScale: 2.5, roughness: 0.95, roughnessMap: noiseTex(4, 256, 160, 240) });
  const wall = (name, w, x, z, rotY, kind) => {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
    g.userData = { name, normal: new T.Vector3(0, 0, 1).applyAxisAngle(new T.Vector3(0, 1, 0), rotY) }; root.add(g);
    if (kind === "glass") {
      box(w, 0.5, 0.2, steel, 0, 0.25, 0, g); box(w, 0.16, 0.2, steel, 0, H - 0.08, 0, g); box(w, 0.06, 0.12, steel, 0, 2.3, 0, g);
      const n = Math.round(w / 1.8); for (let i = 0; i <= n; i++) box(0.09, H, 0.18, steel, -w / 2 + i * (w / n), H / 2, 0, g);
      const pane = new T.Mesh(new T.PlaneGeometry(w, H), phys("#a9c4cf", { transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.1, depthWrite: false }));
      pane.position.y = H / 2; g.add(pane);
    } else {
      box(w, H, 0.2, kind === "brick" ? brick : plaster, 0, H / 2, -0.02, g);
      box(w, 0.12, 0.03, std("#2c2a28", { roughness: 0.6 }), 0, 0.06, 0.09, g, { cast: false });
    }
    walls.push(g); return g;
  };
  wall("back", W, 0, ROOM.minZ, 0, "glass");
  const left = wall("left", D, ROOM.minX, 0, Math.PI / 2, "brick");
  const right = wall("right", D, ROOM.maxX, 0, -Math.PI / 2, "plaster");
  const front = wall("front", W, 0, ROOM.maxZ, Math.PI, "plaster");
  // Walnut slat panel on the right wall behind the lounge screen.
  const slat = std("#ffffff", { map: woodTex("#6b4a32", 8, 1, 256, 1024), roughness: 0.6 });
  for (let i = 0; i < 26; i++) box(0.05, H - 0.4, 0.04, slat, 2.65 + i * 0.12, (H - 0.4) / 2 + 0.2, 0.1, right, { cast: false });
  city(scene);
  return { root, walls, left, right, front };
}
