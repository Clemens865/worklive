import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { sculpt, mesh, cached, lathe, tube, smooth } from "./geo.js";
import { headShape, faceKey, HEAD_C } from "./face.js";
import { phys, fabricNormal } from "./materials.js";

// Hair and facial hair: sculpted shells around the head, textured with strands and cut by a hairline alpha.
function rng(seed) { let s = seed; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const dFront = u => Math.abs(((u - 0.25 + 1.5) % 1) - 0.5) * 2;   // 0 = face centre, 1 = back of head

const COVER = {
  short: (u, v, d) => v < 0.33 + d * 0.15 + (d > 0.35 && d < 0.62 ? 0.04 : 0) + smooth(0.6, 1, d) * 0.2,
  sidepart: (u, v, d) => v < 0.33 + d * 0.15 + smooth(0.6, 1, d) * 0.22,
  buzz: (u, v, d) => v < 0.33 + d * 0.15 + smooth(0.6, 1, d) * 0.2,
  undercutSides: (u, v, d) => v < 0.31 + d * 0.16 + smooth(0.6, 1, d) * 0.19 && v > 0.12,
  undercutTop: (u, v, d) => v < 0.26 - d * 0.04,
  bob: (u, v, d) => d < 0.28 ? v < 0.27 + (d > 0.12 ? 0.05 : 0) : v < 0.74,
  long: (u, v, d) => d < 0.3 ? v < 0.29 : v < 0.8,
  slick: (u, v, d) => v < 0.33 + d * 0.18 + smooth(0.55, 1, d) * 0.2,
  curly: (u, v, d) => v < 0.31 + d * 0.18 + smooth(0.6, 1, d) * 0.18,
  bald: (u, v, d) => d > 0.42 && v > 0.36 && v < 0.5 + d * 0.16,
  full: (u, v, d) => d < 0.5 && v > 0.5 + Math.max(0, 0.4 - d) * 0.4 && v < 0.83 && !(d < 0.14 && v > 0.685 && v < 0.742),
  stubble: (u, v, d) => COVER.full(u, v, d),
  goatee: (u, v, d) => d < 0.16 && v > 0.64 && v < 0.86 && !(d < 0.14 && v > 0.685 && v < 0.742),
  drape: () => true,
  moustache: (u, v, d) => d < 0.17 && v > 0.64 && v < 0.69,
};

function hairTex(style, col, skin, sparse) {
  return cached(`hairTex${style}${col}${sparse}`, () => {
    const W = 512, H = 256, c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"), img = g.createImageData(W, H), px = img.data, r = rng(7 + style.length * 13);
    const base = new T.Color(col), sk = new T.Color(skin), strand = new Float32Array(W);
    for (let x = 0; x < W; x++) strand[x] = 0.6 + r() * 0.7;
    const cov = COVER[style];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H, d = dFront(u), i = (y * W + x) * 4;
      const edge = (r() - 0.5) * 0.02;
      let on = cov(u, v + edge, d);
      if (sparse && r() > sparse) on = false;
      const band = Math.exp(-(((v - 0.2 - 0.03 * Math.sin(u * 40)) / 0.05) ** 2)) * 0.3;       // baked specular band
      const k = strand[x] * (0.8 + 0.35 * Math.sin(y * 0.11 + strand[x] * 20)) * (0.75 + 0.25 * (1 - v)) + band * strand[x];
      const cc = sparse ? base.clone().lerp(sk, 0.35) : base;
      px[i] = Math.min(255, cc.r * 255 * k); px[i + 1] = Math.min(255, cc.g * 255 * k); px[i + 2] = Math.min(255, cc.b * 255 * k);
      px[i + 3] = on ? 255 : 0;
    }
    g.putImageData(img, 0, 0);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
  });
}
function hairMat(style, g, sparse = 0) {
  return phys(g.hairCol, { map: hairTex(style, g.hairCol, g.skin, sparse), color: "#ffffff", alphaTest: 0.5, roughness: 0.55,
    sheen: 0.3, sheenRoughness: 0.4, sheenColor: new T.Color(g.hairCol).lerp(new T.Color("#fff"), 0.25), side: T.DoubleSide });
}
const volumeMat = g => phys(g.hairCol, { roughness: 0.55, sheen: 0.35, sheenRoughness: 0.4, sheenColor: new T.Color(g.hairCol).lerp(new T.Color("#fff"), 0.25), normalMap: fabricNormal("knit"), normalScale: new T.Vector2(1.2, 1.2) });

function shell(head, g, style, inflate, top = 0, flare = 0, sparse = 0) {
  const base = headShape(g.face, inflate, top);
  const fn = flare ? (x, y, z) => { const p = base(x, y, z), k = 1 + flare * smooth(0.1, -0.7, y); return [(p[0] - HEAD_C[0]) * k + HEAD_C[0], p[1], (p[2] - HEAD_C[2]) * (z < 0 ? k : 1 + (k - 1) * 0.3) + HEAD_C[2]]; } : base;
  const m = mesh(sculpt(`hair${style}${faceKey(g.face)}${inflate}${top}${flare}`, fn, 40, 30), hairMat(style, g, sparse), head, [0, 0, 0], { cast: true });
  if (!sparse && inflate > 0.005) {   // sparse outer layer breaks up the silhouette
    const fz = headShape(g.face, inflate + 0.0035, top);
    const f2 = flare ? (x, y, z) => { const p = fz(x, y, z), k = 1 + flare * smooth(0.1, -0.7, y); return [(p[0] - HEAD_C[0]) * k + HEAD_C[0], p[1], (p[2] - HEAD_C[2]) * (z < 0 ? k : 1 + (k - 1) * 0.3) + HEAD_C[2]]; } : fz;
    mesh(sculpt(`fuzz${style}${faceKey(g.face)}${inflate}${top}${flare}`, f2, 40, 30), hairMat(style + "", g, 0.45), head, [0, 0, 0], { cast: false });
  }
  return m;
}

export function buildHair(head, g) {
  const s = g.hair, out = [];
  if (s === "short") out.push(shell(head, g, "short", 0.006, 1.2));
  if (s === "sidepart") out.push(shell(head, g, "sidepart", 0.01, 2.4));
  if (s === "buzz") out.push(shell(head, g, "buzz", 0.0022, 0, 0, 0.55));
  if (s === "undercut") { out.push(shell(head, g, "undercutSides", 0.002, 0, 0, 0.5)); out.push(shell(head, g, "undercutTop", 0.012, 2.8)); }
  if (s === "bob") out.push(shell(head, g, "bob", 0.012, 0.8, 0.28));
  if (s === "long") {
    out.push(shell(head, g, "long", 0.009, 0.6, 0.18));
    out.push(mesh(lathe("drape", 0.3, [[0, 0.09], [0.4, 0.105], [1, 0.1]], { sx: 1, sz: 0.62, gap: 2.4, seg: 20 }), hairMat("drape", g), head, [0, HEAD_C[1] - 0.02, HEAD_C[2] - 0.012]));
  }
  if (s === "bun" || s === "ponytail") {
    out.push(shell(head, g, "slick", 0.004, 0.4));
    const m = volumeMat(g);
    if (s === "bun") {
      out.push(mesh(cached("bun", () => mergeGeometries([0, 1, 2, 3, 4].map(i => new T.TorusGeometry(0.03 - i * 0.004, 0.018 - i * 0.002, 8, 18).rotateZ(i * 0.7).translate(0, 0, i * 0.006)))), m, head, [0, HEAD_C[1] + 0.085, HEAD_C[2] - 0.07], { rot: [-0.9, 0, 0] }));
    } else {
      out.push(mesh(cached("tie", () => new T.TorusGeometry(0.016, 0.006, 6, 14)), phys("#1c1c1e", { roughness: 0.5 }), head, [0, HEAD_C[1] + 0.03, HEAD_C[2] - 0.11], { rot: [0.5, 0, 0] }));
      out.push(mesh(tube("tail", [[0, HEAD_C[1] + 0.03, HEAD_C[2] - 0.115], [0, HEAD_C[1] - 0.03, HEAD_C[2] - 0.14], [0, HEAD_C[1] - 0.13, HEAD_C[2] - 0.13], [0, HEAD_C[1] - 0.2, HEAD_C[2] - 0.12]], 0.02, 16, 8), m, head));
    }
  }
  if (s === "curly") {
    out.push(shell(head, g, "curly", 0.01, 1.0));
    const geo = cached("curls" + faceKey(g.face), () => {
      const r = rng(99), f = headShape(g.face, 0.011, 1.0), parts = [];
      for (let i = 0; i < 230; i++) {
        const th = Math.acos(1 - r() * 1.15), ph = r() * Math.PI * 2, x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
        if (z > 0.3 && y < 0.62) continue;
        const p = f(x, y, z); parts.push(new T.IcosahedronGeometry(0.007 + r() * 0.006, 1).translate(...p));
      }
      return mergeGeometries(parts);
    });
    out.push(mesh(geo, volumeMat(g), head));
  }
  if (s === "bald") out.push(shell(head, g, "bald", 0.0025, 0, 0, 0.55));
  if (g.beard !== "none") out.push(shell(head, g, g.beard, g.beard === "full" ? 0.0045 : 0.0018, 0, 0, g.beard === "stubble" ? 0.35 : g.beard === "full" ? 0 : 0));
  return out;
}
