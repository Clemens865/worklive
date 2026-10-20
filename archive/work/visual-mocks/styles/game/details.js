import * as T from "three";
import { lathe, mesh, cached, tube } from "./geo.js";
import { cloth, phys, std, fabricNormal } from "./materials.js";
import { torsoShells } from "./clothes.js";
import { HEAD_C } from "./face.js";

const ring = (key, R, r, arc = Math.PI * 2, rs = 8, ts = 28) => cached(key, () => new T.TorusGeometry(R, r, rs, ts, arc));

// Collars, plackets, hood and other garment trims on the provider-coloured top.
export function buildTrims(J, g, shirtMat) {
  const trimMat = shirtMat, fem = g.fem ? 1 : 0;
  const chestY = 0.19, bw = g.build * (g.fem ? 0.92 : 1);
  if (g.top === "tee" || g.top === "sweater" || g.top === "henley") {
    mesh(ring("crew", 0.066, 0.009), trimMat, J.chest, [0, chestY, 0.004], { rot: [Math.PI / 2 - 0.25, 0, 0], scale: [1.02 * bw, 0.8, 1] });
  }
  if (g.top === "henley") for (let i = 0; i < 3; i++) mesh(cached("btn", () => new T.CylinderGeometry(0.0055, 0.0055, 0.003, 10).rotateX(Math.PI / 2)), std("#e8e2d6", { roughness: 0.3 }), J.chest, [0, 0.14 - i * 0.03, 0.068 + i * 0.012 + fem * 0.01], { rot: [-0.35, 0, 0], cast: false });
  if (g.top === "shirt" || g.top === "polo") {
    const collar = lathe("collar" + g.top, 0.05, [[0, 0.064], [1, 0.07]], { sz: 1.02, gap: 0.65, seg: 20, rows: 3 });
    const cm = cloth(new T.Color(shirtMat.color).getStyle(), "twill", { side: T.DoubleSide });
    mesh(collar, cm, J.neck, [0, 0.03, 0.0], { rot: [0.12, 0, 0] });
    for (const s of [-1, 1]) mesh(cached("collarTip", () => new T.BoxGeometry(0.045, 0.05, 0.004)), cm, J.chest, [s * 0.036, 0.19, 0.062], { rot: [-0.55, s * 0.4, s * 0.55], cast: false });
    const n = g.top === "polo" ? 2 : 5;
    for (let i = 0; i < n; i++) mesh(cached("btn", () => new T.CylinderGeometry(0.0055, 0.0055, 0.003, 10).rotateX(Math.PI / 2)), std("#f1ede4", { roughness: 0.3 }), J.chest, [0, 0.13 - i * 0.07, 0.073 + (i === 1 || i === 2 ? 0.022 + fem * 0.02 : 0.012)], { rot: [-0.2, 0, 0], cast: false });
  }
  if (g.top === "hoodie") {
    mesh(ring("hood", 0.1, 0.034, Math.PI * 1.35, 10, 22), trimMat, J.chest, [0, 0.2, -0.012], { rot: [Math.PI / 2 + 0.25, 0, -Math.PI * 0.175 + Math.PI], scale: [1.05, 1.05, 1] });
    const cord = std("#f0ece4", { roughness: 0.6 });
    for (const s of [-1, 1]) mesh(tube("cord" + s, [[s * 0.035, 0.18, 0.07], [s * 0.04, 0.12, 0.096], [s * 0.042, 0.05, 0.106]], 0.0035, 8, 5), cord, J.chest, [0, 0, 0], { cast: false });
    mesh(cached("pocket", () => new T.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI)), trimMat, J.spine, [0, -0.02, 0.07 + g.belly * 0.015], { scale: [0.12 * g.build, 0.07, 0.035], rot: [Math.PI / 2, 0, 0] });
  }
}

// Open-front outer layer that never covers the coloured front of the top.
export function buildOuter(J, g) {
  if (g.outer === "none") return null;
  // Sleeveless only (vest / quilted gilet): sleeves and front keep the provider colour from every angle.
  const puffer = g.outer === "puffer";
  const mat = puffer ? phys(g.outerCol, { roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.5, sheen: 0.4, sheenColor: new T.Color("#ffffff"),
    normalMap: fabricNormal("quilt"), normalScale: new T.Vector2(1, 1), side: T.DoubleSide }) : cloth(g.outerCol, "twill", { side: T.DoubleSide });
  torsoShells(J, g, mat, puffer ? 1.09 : 1.045, puffer ? 1.0 : 1.25, "outer" + g.outer);
  for (const s of [-1, 1]) mesh(ring("vestArm" + puffer, puffer ? 0.066 : 0.062, puffer ? 0.018 : 0.011), mat, J.chest, [s * 0.155 * g.build, 0.125, -0.012], { rot: [0, Math.PI / 2, 0], scale: [1, 1.25, 1] });
  if (puffer) mesh(lathe("pufcollar", 0.05, [[0, 0.07], [1, 0.08]], { sz: 0.95, gap: 0.9, seg: 20, rows: 3 }), mat, J.neck, [0, 0.03, 0]);
  return mat;
}

// Glasses, watch, lanyard, earrings, headphones.
export function buildAccessories(J, g, face, provider) {
  if (g.glasses !== "none") {
    const thick = g.glasses === "thick", frame = thick ? phys("#1c1614", { roughness: 0.25, clearcoat: 1 }) : std(g.glasses === "round" ? "#b8964e" : "#2a2a2c", { metalness: g.glasses === "round" ? 1 : 0.2, roughness: 0.3 });
    const lens = phys("#dfe8ee", { roughness: 0.03, metalness: 0.1, transparent: true, opacity: 0.14, clearcoat: 1, depthWrite: false });
    const ex = face.eyes[1].parent.position.x, ey = face.eyes[1].parent.position.y, ez = face.eyes[1].parent.position.z + 0.02;
    const sx = g.glasses === "rect" ? 1.3 : thick ? 1.25 : 1.05, sy = g.glasses === "rect" ? 0.82 : thick ? 0.95 : 1;
    for (const s of [-1, 1]) {
      mesh(ring("gl" + thick, 0.0165, thick ? 0.0028 : 0.0012, Math.PI * 2, 6, 24), frame, J.headScale, [s * Math.abs(ex) * 1.05, ey, ez], { scale: [sx, sy, 1], cast: false });
      mesh(cached("lens", () => new T.CircleGeometry(0.0165, 20)), lens, J.headScale, [s * Math.abs(ex) * 1.05, ey, ez - 0.001], { scale: [sx, sy, 1], cast: false });
      mesh(cached("temple" + thick, () => new T.BoxGeometry(thick ? 0.004 : 0.002, thick ? 0.005 : 0.0025, 0.1)), frame, J.headScale, [s * 0.074, ey + 0.004, ez - 0.05], { rot: [0.05, s * 0.06, 0], cast: false });
    }
    mesh(cached("bridge" + thick, () => new T.TorusGeometry(0.009, thick ? 0.0025 : 0.0011, 5, 10, Math.PI)), frame, J.headScale, [0, ey + 0.003, ez + 0.002], { cast: false });
  }
  if (g.watch) {
    const w = J.arms[0].wr;
    mesh(ring("strap", 0.028, 0.006, Math.PI * 2, 6, 20), phys("#3a2a1e", { roughness: 0.5 }), w, [0, 0.03, 0], { rot: [Math.PI / 2, 0, 0], scale: [1, 0.78, 1.4], cast: false });
    mesh(cached("wface", () => new T.CylinderGeometry(0.016, 0.016, 0.008, 20)), std("#d8d6d0", { metalness: 1, roughness: 0.2 }), w, [0.027, 0.03, 0], { rot: [0, 0, Math.PI / 2], cast: false });
  }
  if (g.lanyard) {
    const strap = std(provider === "#2D9D8F" ? "#1c2a36" : "#2b2b30", { roughness: 0.7 });
    mesh(tube("lany" + g.fem, [[-0.05, 0.215, -0.05], [-0.07, 0.2, 0.03], [-0.03, 0.12, 0.1 + (g.fem ? 0.03 : 0)], [0, 0.04, 0.11 + (g.fem ? 0.02 : 0)], [0.03, 0.12, 0.1 + (g.fem ? 0.03 : 0)], [0.07, 0.2, 0.03], [0.05, 0.215, -0.05]], 0.004, 30, 4), strap, J.chest, [0, 0, 0], { cast: false });
    mesh(cached("badge", () => new T.BoxGeometry(0.055, 0.08, 0.004)), std("#f2f1ec", { roughness: 0.4 }), J.chest, [0, 0.0, 0.112 + (g.fem ? 0.02 : 0) + g.belly * 0.01], { rot: [-0.15, 0, 0], cast: false });
    mesh(cached("badgeStripe", () => new T.BoxGeometry(0.056, 0.018, 0.005)), std(provider), J.chest, [0, 0.028, 0.113 + (g.fem ? 0.02 : 0) + g.belly * 0.01], { rot: [-0.15, 0, 0], cast: false });
  }
  if (g.earrings) for (const s of [-1, 1]) mesh(cached("ear-ring", () => new T.SphereGeometry(0.0038, 8, 6)), std("#d8b25a", { metalness: 1, roughness: 0.25 }), J.headScale, [s * 0.08, HEAD_C[1] - 0.03, HEAD_C[2] - 0.005], { cast: false });
  if (g.headphones) {
    const hp = phys("#202124", { roughness: 0.35, clearcoat: 0.6 });
    mesh(ring("hpband", 0.085, 0.009, Math.PI, 6, 18), hp, J.chest, [0, 0.19, -0.02], { rot: [-Math.PI / 2 - 0.5, 0, Math.PI], scale: [1.05, 1, 1] });
    for (const s of [-1, 1]) mesh(cached("cup", () => new T.CylinderGeometry(0.038, 0.038, 0.03, 18)), hp, J.chest, [s * 0.09, 0.19, 0.02], { rot: [0.3, 0, Math.PI / 2 + s * 0.3] });
  }
}
