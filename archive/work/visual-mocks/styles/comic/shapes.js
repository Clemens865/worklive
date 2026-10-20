import * as T from "three";
import { geo } from "./toon.js";

// Sculpted procedural geometry shared by characters (cached by key).

// Lathe from a list of [radius, y] points, smoothed via Catmull-Rom.
export function lathe(key, pts, seg = 20, div = 3) {
  return geo("lathe:" + key, () => {
    const P = pts[0][1] > pts[pts.length - 1][1] ? [...pts].reverse() : pts; // bottom -> top = outward normals
    const curve = new T.SplineCurve(P.map(([r, y]) => new T.Vector2(r, y)));
    const g = new T.LatheGeometry(curve.getPoints(pts.length * div), seg);
    g.computeVertexNormals();
    return g;
  });
}

// Tapered limb from top (y=0) down to y=-len, radius r0 -> r1, rounded ends.
export function limb(len, r0, r1, bulge = 0.12) {
  const k = [len, r0, r1, bulge].map(v => v.toFixed(3)).join(",");
  const pts = [[0.001, r0 * 0.6], [r0 * 0.75, r0 * 0.35], [r0, 0], [r0 * (1 + bulge), -len * 0.3], [(r0 + r1) / 2 * (1 + bulge * 0.5), -len * 0.6], [r1, -len], [r1 * 0.72, -len - r1 * 0.45], [0.001, -len - r1 * 0.7]];
  return lathe("limb" + k, pts, 16, 3);
}

// Deformed sphere with per-type head shapes (big cartoon heads, jaw and cheeks).
export function headGeo(type) {
  return geo("head:" + type, () => {
    const g = new T.SphereGeometry(1, 40, 30);
    const p = g.attributes.position, v = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const y = v.y, z = v.z;
      let sx = 1, sy = 1.08, sz = 0.96;
      if (type === "egg") { sx = 0.9 + y * 0.12; sy = 1.14; }
      if (type === "wide") { sx = 1.12 - y * 0.06; sy = 0.98; }
      if (type === "long") { sx = 0.86; sy = 1.22; sz = 0.94; }
      if (type === "square") { const s = 1 + 0.12 * Math.pow(Math.abs(v.x * v.y) * 2.2, 1.5); sx = s * 1.02; sy = 1.06 * (1 + 0.05 * Math.abs(v.x)); }
      if (type === "pear") { sx = 0.92 - y * 0.14; sy = 1.06; }
      // Cheeks & jaw: widen the lower front, flatten the back slightly
      const front = Math.max(0, z);
      const low = Math.max(0, -y);
      sx *= 1 + 0.08 * front * low;
      sz *= 1 + 0.06 * front - 0.05 * Math.max(0, -z);
      v.set(v.x * sx, v.y * sy * (y < 0 ? 0.9 : 1), v.z * sz);
      // Chin
      if (y < -0.6 && z > 0) v.z += (-(y + 0.6)) * 0.12 * z;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  });
}

// Chunky cartoon sneaker, toe toward +z, sole at y=0.
export function shoeGeo() {
  return geo("shoe", () => {
    const g = new T.SphereGeometry(1, 24, 16);
    const p = g.attributes.position, v = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      let x = v.x * 0.06, y = v.y * 0.055, z = v.z * 0.12;
      if (y < -0.018) y = -0.018 - (y + 0.018) * 0.12; // flat sole
      if (z > 0) { x *= 1 + z * 1.2; y *= 1 - z * 1.8; } // wider, flatter toe
      if (v.y > 0 && z < 0) y *= 1.35; // taller heel cuff
      p.setXYZ(i, x, y + 0.02, z + 0.03);
    }
    g.computeVertexNormals();
    return g;
  });
}
export function soleGeo() {
  return geo("sole", () => {
    const g = new T.CylinderGeometry(1, 1, 1, 24);
    g.scale(0.068, 0.022, 0.135); g.translate(0, 0.011, 0.035);
    return g;
  });
}

export const sphere = (seg = 20) => geo("sph" + seg, () => new T.SphereGeometry(1, seg, Math.round(seg * 0.75)));
export const capsule = (r, l) => geo(`cap${r},${l}`, () => new T.CapsuleGeometry(r, l, 4, 10));
export const cyl = (rt, rb, h, s = 16) => geo(`cyl${rt},${rb},${h},${s}`, () => new T.CylinderGeometry(rt, rb, h, s));
export const torus = (R, r, arc = Math.PI * 2) => geo(`tor${R},${r},${arc}`, () => new T.TorusGeometry(R, r, 8, 24, arc));
export const circle = (r = 1, s = 24) => geo(`circ${r},${s}`, () => new T.CircleGeometry(r, s));

// Tube along a list of points (used for brows, hair strands, straps).
export function tube(key, pts, r, seg = 16, closed = false) {
  return geo("tube:" + key, () => new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p))), seg, r, 8, closed));
}
