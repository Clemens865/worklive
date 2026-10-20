import * as T from "three";
import { sculpt, smooth, mesh, tube, cached } from "./geo.js";
import { phys, std } from "./materials.js";

// Head centre relative to the head joint (top of neck).
export const HEAD_C = [0, 0.105, 0.012];
const g2 = (d2, s) => Math.exp(-d2 / (s * s));
const fr0 = z => Math.max(0, z);

// Sculpted skull + face as a deformed unit sphere. Front = +z. `inflate` grows the shape (for hair shells).
export function headShape(f, inflate = 0, top = 0) {
  return (x, y, z) => {
    let X = x * 0.078, Y = y * 0.114 * f.long, Z = z * 0.1;
    const low = smooth(0.05, -0.95, y);                        // lower face factor
    const jaw = 0.78 + 0.12 * f.jaw;
    X *= 1 - (1 - jaw) * low * (0.6 + 0.4 * Math.max(0, z));  // taper to the jaw
    X *= 1 - 0.16 * smooth(-0.15, -0.75, y) * (0.55 + 0.45 * Math.max(0, z));  // narrower mouth/chin region
    if (z < 0) { Z *= 1.1 + 0.05 * Math.max(0, y); Z *= 1 - 0.35 * smooth(-0.2, -0.9, y); } // cranium, nape tuck
    else Z *= 1 - 0.1 * smooth(0.2, -0.4, y) * (1 - Math.abs(x)); // flatter face under the eyes
    Z += 0.014 * f.chin * g2((y + 0.86) ** 2 + x * x * 3, 0.22) * Math.max(0, z);  // chin
    Z += 0.009 * g2((y - 0.2) ** 2 * 4 + (Math.abs(x) - 0.35) ** 2, 0.35) * Math.max(0, z); // brow ridge
    Z -= 0.012 * g2((y - 0.02) ** 2 * 1.5 + (Math.abs(x) - 0.38) ** 2, 0.2) * Math.max(0, z);      // eye sockets
    X += Math.sign(x) * 0.01 * f.cheek * g2((y + 0.12) ** 2 + (z - 0.62) ** 2, 0.28);         // cheekbones
    X -= Math.sign(x) * 0.004 * g2((y + 0.4) ** 2 + (z - 0.6) ** 2, 0.25);                     // cheek hollow
    X -= Math.sign(x) * 0.004 * g2((y - 0.3) ** 2 + (z - 0.45) ** 2, 0.25);                     // temples
    Z += 0.003 * g2((Math.abs(x) - 0.3) ** 2 * 3 + (y + 0.52) ** 2, 0.14) * fr0(z);        // nasolabial fold
    Y -= 0.012 * smooth(-0.6, -1, y) * (1 - Math.abs(x));                                       // chin underside
    if (inflate) { const k = inflate * (1 + top * smooth(0.0, 0.9, y) + (z < 0 ? 0.2 : 0)); X += x * k; Y += Math.max(0, y) * k * 1.1; Z += z * k; }
    return [X + HEAD_C[0], Y + HEAD_C[1], Z + HEAD_C[2]];
  };
}
export const faceKey = f => Object.values(f).map(v => v.toFixed(2)).join(",");

// Eye texture: sclera with limbal ring, textured iris and pupil (front at u = .25).
function eyeTex(col) {
  return cached("eyeTex" + col, () => {
    const c = document.createElement("canvas"); c.width = 256; c.height = 128; const g = c.getContext("2d");
    g.fillStyle = "#efe9e2"; g.fillRect(0, 0, 256, 128);
    const cx = 64, cy = 64, r = 23;
    const vein = g.createRadialGradient(cx, cy, r, cx, cy, 70); vein.addColorStop(0, "rgba(220,170,160,0)"); vein.addColorStop(1, "rgba(200,140,130,.45)");
    g.fillStyle = vein; g.fillRect(0, 0, 256, 128);
    const base = new T.Color(col), ir = g.createRadialGradient(cx, cy, 4, cx, cy, r);
    ir.addColorStop(0, "#" + base.clone().multiplyScalar(0.55).getHexString()); ir.addColorStop(0.45, "#" + base.clone().lerp(new T.Color("#fff"), 0.25).getHexString());
    ir.addColorStop(0.85, "#" + base.getHexString()); ir.addColorStop(1, "#1a1410");
    g.fillStyle = ir; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    for (let i = 0; i < 60; i++) { const a = i / 60 * 7; g.strokeStyle = `rgba(0,0,0,${0.08 + (i % 3) * 0.05})`; g.beginPath(); g.moveTo(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8); g.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2)); g.stroke(); }
    g.fillStyle = "#050505"; g.beginPath(); g.arc(cx, cy, 8.5, 0, 7); g.fill();
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  });
}

function faceColors(geo, g) {
  if (geo.attributes.color) return geo;
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), male = g.fem ? 0 : 1;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / 0.078, y = (p.getY(i) - HEAD_C[1]) / 0.114, z = (p.getZ(i) - HEAD_C[2]) / 0.1, fr = Math.max(0, z);
    const rosy = g2((Math.abs(x) - 0.5) ** 2 + (y + 0.25) ** 2, 0.3) * fr + g2(x * x * 4 + (y + 0.2) ** 2, 0.25) * fr * 0.8;
    const socket = g2((Math.abs(x) - 0.38) ** 2 + (y - 0.03) ** 2 * 2, 0.17) * fr;
    const jaw = male * smooth(-0.35, -0.8, y) * fr * (g.beard === "none" ? 0.6 : 1);
    let r = 1 - socket * 0.22 - jaw * 0.06, gg = 1 - rosy * 0.12 - socket * 0.27 - jaw * 0.05, b = 1 - rosy * 0.13 - socket * 0.2 - jaw * 0.02;
    col.set([r, gg, b], i * 3);
  }
  geo.setAttribute("color", new T.BufferAttribute(col, 3)); return geo;
}

export function buildFace(head, g, skinMat, faceMat) {
  const f = g.face, key = faceKey(f);
  const skull = mesh(faceColors(sculpt("head" + key + g.fem + g.beard, headShape(f), 40, 30), g), faceMat, head);
  const lipMat = phys(new T.Color(g.skin).lerp(new T.Color(new T.Color(g.skin).getHSL({}).l < 0.3 ? "#5e2c2a" : "#a8494a"), 0.45).getStyle(), { roughness: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.3, sheen: 0.3, sheenColor: new T.Color("#ffb0a0") });
  const eyeMat = phys("#ffffff", { map: eyeTex(g.eye), roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02 });
  const lashMat = std("#1a1412", { roughness: 0.8 });
  const browMat = std(new T.Color(g.hairCol).multiplyScalar(0.75).getStyle(), { roughness: 0.9 });
  const ey = HEAD_C[1] + 0.006, ez = HEAD_C[2] + 0.08, ex = 0.031 * (0.96 + f.eyeSize * 0.04);
  const er = 0.0124 * f.eyeSize;
  const eyes = [], lids = [], brows = [];
  for (const s of [-1, 1]) {
    const socket = new T.Group(); socket.position.set(s * ex, ey, ez); head.add(socket);
    const ball = mesh(cached("eyeball", () => new T.SphereGeometry(1, 20, 14)), eyeMat, socket, [0, 0, 0], { scale: er, cast: false });
    eyes.push(ball);
    const upG = cached("lidUp", () => new T.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2));
    const loG = cached("lidLo", () => new T.SphereGeometry(1, 18, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2));
    const up = mesh(upG, skinMat, socket, [0, 0, 0], { scale: er * 1.1, cast: false });
    const lo = mesh(loG, skinMat, socket, [0, 0, 0], { scale: er * 1.09, cast: false });
    const lash = mesh(cached("lash", () => new T.TorusGeometry(1, 0.13, 4, 18, Math.PI)), lashMat, up, [0, 0, 0], { rot: [Math.PI / 2, 0, 0], scale: [1, 1, 1], cast: false });
    lash.scale.set(1.0, 1.0, 0.6);
    lids.push({ up, lo });
    // Brow: tapered tube arcing over the socket.
    const bw = 0.0034 * f.brow * (g.fem ? 0.85 : 1.15);
    const brow = new T.Group(); brow.position.set(s * (ex + 0.002), ey + 0.02 * (0.95 + f.brow * 0.05), HEAD_C[2] + 0.086); head.add(brow);
    const bpts = [[-0.013, -0.001, 0.001], [-0.004, 0.0025, 0.003], [0.007, 0.002, 0.001], [0.016, -0.003, -0.005]].map(p => [p[0] * s, p[1], p[2]]);
    mesh(tube("brow" + s + bw.toFixed(4), bpts, bw, 14, 5), browMat, brow, [0, 0, 0], { scale: [1, 1, 0.6], cast: false });
    brows.push(brow);
  }
  // Nose: bridge-to-tip sculpt + alar wings.
  const nose = sculpt("nose" + f.nose.toFixed(2) + f.noseW.toFixed(2), (x, y, z) => {
    const tip = smooth(0.2, -0.7, y);
    return [x * 0.0102 * f.noseW * (0.5 + 0.7 * tip), y * 0.027 * f.nose, z * 0.0075 + 0.008 * tip * Math.max(0, z + 0.3) * f.nose];
  }, 16, 14);
  mesh(nose, skinMat, head, [0, HEAD_C[1] - 0.026 * f.nose, HEAD_C[2] + 0.087], { cast: false });
  for (const s of [-1, 1]) mesh(cached("ala", () => new T.SphereGeometry(1, 10, 8)), skinMat, head, [s * 0.0118 * f.noseW, HEAD_C[1] - 0.046 * f.nose, HEAD_C[2] + 0.088], { scale: [0.0062, 0.0048, 0.0068], cast: false });
  // Lips.
  const mouth = new T.Group(); mouth.position.set(0, HEAD_C[1] - 0.071 - 0.005 * (f.nose - 1), HEAD_C[2] + 0.083); head.add(mouth);
  const lipG = sculpt("lip", (x, y, z) => [x, y * (1 - 0.5 * x * x), z * (1 - 0.6 * x * x)], 16, 10);
  const upper = mesh(lipG, lipMat, mouth, [0, 0.0032, 0], { scale: [0.0225, 0.0046 * f.lips, 0.0075], cast: false });
  const lower = mesh(lipG, lipMat, mouth, [0, -0.0048, -0.001], { scale: [0.0195, 0.0058 * f.lips, 0.008], cast: false });
  mesh(lipG, std("#3a1c18", { roughness: 0.9 }), mouth, [0, -0.0003, -0.0035], { scale: [0.019, 0.0009, 0.004], cast: false });
  // Ears.
  const earG = sculpt("ear", (x, y, z) => { const rim = 1 + 0.35 * Math.max(0, z) * (x * x + y * y); return [x * 0.012 * rim, y * 0.028 * (1 - 0.25 * smooth(0, -1, y)), z * 0.006 * (1 - 0.6 * (1 - x * x - y * y))]; }, 16, 12);
  const ears = [];
  for (const s of [-1, 1]) ears.push(mesh(earG, skinMat, head, [s * 0.0765, HEAD_C[1] - 0.004, HEAD_C[2] - 0.012], { rot: [0, s * 1.25, s * 0.08], scale: f.ears }));
  const eyeAnchor = new T.Object3D(); eyeAnchor.position.set(0, ey, ez + 0.02); head.add(eyeAnchor);
  return { skull, eyes, lids, brows, mouth, upper, lower, eyeAnchor, ears, er };
}
