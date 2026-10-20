import * as T from "three";
import { lathe, sculpt, mesh, cached, smooth } from "./geo.js";
import { cloth, phys, std } from "./materials.js";

const TOP_KIND = { tee: "twill", henley: "knit", shirt: "twill", sweater: "knit", hoodie: "knit", polo: "knit" };
const LONG = { tee: false, polo: false, henley: true, shirt: "rolled", sweater: true, hoodie: true };
const g2 = (d, s) => Math.exp(-(d * d) / (s * s));

// Torso shell (chest + belly), shared by shirt and outer layers (scale `k`, optional open front `gap`).
export function torsoShells(J, g, mat, k = 1, gap = 0, tag = "shirt") {
  const bw = g.build * (g.fem ? 0.92 : 1), fem = g.fem ? 1 : 0, b = g.belly;
  const chestBulge = (t, a) => { const fr = Math.max(0, Math.cos(a)); return [1, 1 + (fem * 0.22 + 0.05) * fr * fr * g2(t - 0.42, 0.18) + 0.06 * Math.max(0, -Math.cos(a)) * g2(t - 0.3, 0.2)]; };
  const chest = lathe(`chest${tag}${fem}${k}`, 0.36, [[0, 0.07], [0.07, 0.13], [0.17, 0.162], [0.34, 0.162], [0.62, 0.15 - fem * 0.012], [1, 0.144 - fem * 0.016]].map(([t, r]) => [t, r * k]),
    { sx: bw, sz: 0.6 + fem * 0.02, seg: 24, rows: 18, gap, bulge: chestBulge });
  mesh(chest, mat, J.chest, [0, 0.215, 0]);
  const hemLow = ["tee", "sweater", "hoodie", "henley"].includes(g.top) || tag !== "shirt" ? 0.2 : 0.14;
  const belly = lathe(`belly${tag}${fem}${k}${b.toFixed(2)}${hemLow}`, 0.14 + hemLow, [[0, 0.149 - fem * 0.016], [0.45, 0.143 - fem * 0.022 + b * 0.012], [0.8, 0.148 + b * 0.008], [1, 0.155 + fem * 0.01]].map(([t, r]) => [t, r * k]),
    { sx: bw, sz: 0.62 + b * 0.08, seg: 24, rows: 12, gap, bulge: (t, a) => [1, 1 + b * 0.22 * Math.max(0, Math.cos(a)) ** 2 * g2(t - 0.55, 0.3)] });
  mesh(belly, mat, J.spine, [0, 0.14, 0]);
}

export function buildClothes(J, g, provider, skinMat) {
  const shirtMat = cloth(provider, TOP_KIND[g.top]);
  const pantsMat = cloth(g.pants, g.denim ? "denim" : "twill");
  torsoShells(J, g, shirtMat);
  // Pelvis + belt.
  const fem = g.fem ? 1 : 0;
  mesh(lathe("pelvis" + fem, 0.22, [[0, 0.146 - fem * 0.012], [0.35, 0.158 + fem * 0.014], [0.8, 0.146 + fem * 0.01], [1, 0.07]], { sx: g.build * (g.fem ? 0.97 : 0.97), sz: 0.66, seg: 22 }), pantsMat, J.hips, [0, 0.07, 0]);
  if (!["tee", "sweater", "hoodie", "henley"].includes(g.top)) {
    mesh(lathe("belt" + fem, 0.035, [[0, 0.152], [1, 0.152]], { sx: g.build * 0.99, sz: 0.68, seg: 24, rows: 2 }), phys("#2a1d15", { roughness: 0.45, clearcoat: 0.4 }), J.hips, [0, 0.07, 0]);
    mesh(cached("buckle", () => new T.BoxGeometry(0.036, 0.028, 0.008)), std("#b9b2a2", { metalness: 1, roughness: 0.3 }), J.hips, [0, 0.052, 0.104]);
  }
  // Sleeves.
  const long = LONG[g.top];
  for (const A of J.arms) {
    const r0 = g.fem ? 0.056 : 0.062;
    mesh(cached("delt" + r0, () => new T.SphereGeometry(r0, 16, 12)), shirtMat, A.sh, [0, 0.0, 0], { scale: [1, 0.95, 1] });
    mesh(lathe("usl" + r0 + (long ? "L" : "S"), long ? DIMU + 0.04 : 0.15, long ? [[0, r0], [0.3, r0 * 0.92], [1, r0 * 0.78]] : [[0, r0], [0.8, r0 * 0.92], [1, r0 * 0.9]], { sz: 0.96 }), shirtMat, A.sh, [0, 0.035, 0]);
    if (long) {
      mesh(cached("elb" + r0, () => new T.SphereGeometry(r0 * 0.78, 14, 10)), shirtMat, A.el, [0, 0, 0]);
      const rolled = long === "rolled", len = rolled ? 0.11 : 0.225;
      mesh(lathe("fsl" + r0 + rolled, len, [[0, r0 * 0.8], [0.6, r0 * 0.72], [1, rolled ? r0 * 0.76 : r0 * 0.6]], { sz: 0.85 }), shirtMat, A.el, [0, 0.01, 0]);
      if (rolled || g.top === "sweater" || g.top === "hoodie") mesh(cached("cuff" + r0 + rolled, () => { const t = new T.TorusGeometry(rolled ? r0 * 0.76 : r0 * 0.6, 0.009, 6, 18); t.rotateX(Math.PI / 2); return t; }), shirtMat, A.el, [0, 0.01 - len, 0], { scale: [1, 1, 0.85] });
    } else mesh(cached("elbS", () => new T.SphereGeometry(0.036, 12, 8)), skinMat, A.el, [0, 0, 0], { cast: false });
  }
  // Legs.
  const slim = g.denim ? 0.92 : 1;
  for (const L of J.legs) {
    mesh(cached("hipBall" + fem, () => new T.SphereGeometry(0.092 + fem * 0.006, 16, 12)), pantsMat, L.th, [0, -0.01, 0], { scale: [1, 1, 0.9] });
    mesh(lathe("thigh" + fem + slim, 0.45, [[0, 0.092 + fem * 0.006], [0.35, 0.08 * slim + fem * 0.004], [1, 0.058 * slim]], { sz: 0.96 }), pantsMat, L.th, [0, 0.02, 0]);
    mesh(cached("knee" + slim, () => new T.SphereGeometry(0.058 * slim, 14, 10)), pantsMat, L.kn, [0, 0, 0.004]);
    mesh(lathe("shin" + slim, 0.36, [[0, 0.058 * slim], [0.4, 0.054 * slim], [1, 0.052 * slim]], { sz: 0.95 }), pantsMat, L.kn, [0, 0.01, 0]);
    buildShoe(L.an, g);
  }
  return { shirtMat, pantsMat };
}
const DIMU = 0.29;

function buildShoe(ankle, g) {
  const boot = g.shoes === "boot", leather = g.shoes !== "sneaker";
  const upper = leather ? phys(g.shoeCol, { roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.35 }) : cloth(g.shoeCol, "twill", { roughness: 0.85 });
  const soleMat = std(leather ? "#1e1a17" : "#f4f2ee", { roughness: 0.7 });
  const shape = sculpt("shoe" + g.shoes, (x, y, z) => {
    const toe = smooth(-0.2, 1, z);
    let Y = y * 0.048 * (1 - 0.5 * toe * Math.max(0, y)) + 0.01;
    if (y < -0.3) Y = -0.03 + (y + 0.3) * 0.02;
    return [x * 0.047 * (1 + 0.12 * z - 0.1 * Math.max(0, -z)), Y, z * 0.135 + 0.055];
  }, 22, 14);
  mesh(shape, upper, ankle, [0, -0.032, 0]);
  mesh(shape, soleMat, ankle, [0, -0.036, 0], { scale: [1.04, 0.35, 1.02] }).position.y = -0.061;
  if (boot) mesh(lathe("bootshaft", 0.1, [[0, 0.056], [1, 0.05]], { sz: 1 }), upper, ankle, [0, 0.07, 0]);
  if (!leather) mesh(cached("lace", () => new T.BoxGeometry(0.04, 0.004, 0.07)), std("#fafafa"), ankle, [0, 0.012, 0.085], { rot: [-0.45, 0, 0], cast: false });
}
