import * as T from "three";
import { toon, part, geo } from "./toon.js";
import { sphere, tube, lathe } from "./shapes.js";
import { darken } from "./face.js";

// Stylised hair on a unit head. Strong silhouettes, one toon material per colour.
const shell = (key, t0, tl, p0 = 0, pl = Math.PI * 2, r = 1.08) =>
  geo("shell" + key, () => new T.SphereGeometry(r, 36, 18, p0, pl, t0, tl));

// Lumpy blob (afro, curls, bun) — noise pushed along normals.
function blob(key, amp, freq) {
  return geo("blob" + key, () => {
    const g = new T.SphereGeometry(1, 36, 26), p = g.attributes.position, v = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = Math.sin(v.x * freq) * Math.sin(v.y * freq * 1.1 + 1.3) * Math.sin(v.z * freq * 0.9 + 0.7);
      v.multiplyScalar(1 + amp * Math.abs(n)); p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals(); return g;
  });
}
const cone = (r, h) => geo(`cone${r},${h}`, () => { const g = new T.ConeGeometry(r, h, 10); g.translate(0, h / 2, 0); return g; });

function cap(h, m, hairline = 1.2, tilt = -0.32) {
  // Back of the head down to the nape so updos don't look bald from behind
  part(shell("back2", 0.25, 1.55, Math.PI * 0.9, Math.PI * 1.2), m, h, { ink: 0.01, scale: [1.03, 1.02, 1.04] });
  return part(shell("cap" + hairline, 0, hairline), m, h, { ink: 0.01, rot: [tilt, 0, 0], scale: [1.02, 1.02, 1.04] });
}

const STYLES = {
  spikes(h, m) {
    cap(h, m, 1.25);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, ring = i % 3 === 0 ? 0.25 : 0.62;
      const d = new T.Vector3(Math.sin(a) * ring, 1, Math.cos(a) * ring * 0.9 + 0.12).normalize();
      const s = part(cone(0.22, 0.7 + (i % 2) * 0.2), m, h, { ink: 0.009 });
      s.position.copy(d).multiplyScalar(0.8); s.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().add(new T.Vector3(0, 0.3, 0)).normalize());
    }
  },
  quiff(h, m) {
    cap(h, m, 1.15, -0.3);
    part(lathe("quiff", [[0.001, 0.5], [0.3, 0.38], [0.45, 0.1], [0.4, -0.25], [0.001, -0.4]], 18), m, h, { ink: 0.01, pos: [0.05, 1.05, 0.45], rot: [-1.1, 0, -0.25], scale: [1.35, 1.35, 0.9] });
    for (const s of [-1, 1]) part(sphere(14), m, h, { ink: 0.009, pos: [s * 0.9, 0.3, -0.15], scale: [0.2, 0.45, 0.5] });
  },
  afro(h, m) {
    part(blob("afro", 0.12, 7), m, h, { ink: 0.012, pos: [0, 0.64, -0.36], scale: [1.42, 1.2, 1.2] });
  },
  bob(h, m) {
    part(shell("bob", 0, 2.05, Math.PI * 0.72, Math.PI * 1.56, 1.1), m, h, { ink: 0.01, pos: [0, 0.02, -0.02], scale: [1.08, 1.02, 1.08] });
    cap(h, m, 1.0, 0);
    part(lathe("bangs", [[0.001, 0.2], [0.5, 0.18], [0.72, 0.0], [0.5, -0.12], [0.001, -0.14]], 20), m, h, { ink: 0.009, pos: [0.08, 0.72, 0.62], rot: [1.25, 0, 0.12], scale: [1.1, 1, 0.8] });
  },
  bun(h, m) {
    cap(h, m, 1.3, -0.4);
    part(blob("bun", 0.08, 9), m, h, { ink: 0.01, pos: [0, 1.12, -0.35], scale: 0.42 });
    part(geo("bunband", () => new T.TorusGeometry(0.3, 0.07, 8, 20)), toon("#e8594a"), h, { ink: 0.006, pos: [0, 0.98, -0.3], rot: [1.2, 0, 0] });
    part(sphere(), m, h, { ink: 0.008, pos: [0.55, 0.62, 0.72], scale: [0.35, 0.16, 0.12], rot: [0, 0, -0.5] });
  },
  ponytail(h, m) {
    cap(h, m, 1.3, -0.4);
    part(tube("pony", [[0, 0.75, -0.9], [0, 0.55, -1.35], [0, 0.0, -1.45], [0, -0.55, -1.25], [0.05, -0.85, -1.05]], 0.2, 20), m, h, { ink: 0.01 });
    part(geo("tie", () => new T.TorusGeometry(0.16, 0.06, 8, 16)), toon("#f2c94c"), h, { ink: 0.006, pos: [0, 0.72, -0.98], rot: [0.6, 0, 0] });
  },
  bald(h, m) {
    for (const s of [-1, 1]) part(sphere(14), m, h, { ink: 0.009, pos: [s * 0.86, 0.12, -0.35], scale: [0.25, 0.32, 0.55] });
    part(sphere(14), m, h, { ink: 0.009, pos: [0, 0.1, -0.88], scale: [0.7, 0.32, 0.3] });
  },
  curly(h, m) {
    cap(h, m, 1.2);
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4, y = 0.35 + (i % 4) * 0.18;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const pos = [Math.sin(a) * r, y, Math.cos(a) * r * 0.95 - 0.05];
      if (pos[2] > 0.4 && y < 0.8) continue;
      part(blob("curl", 0.2, 11), m, h, { ink: 0.008, pos, scale: 0.3 });
    }
  },
  mohawk(h, m) {
    part(shell("buzz", 0, 1.9), m, h, { ink: 0.008, scale: [1.0, 1.0, 1.0], rot: [-0.2, 0, 0] });
    for (let i = 0; i < 6; i++) {
      const a = -0.7 + i * 0.36, d = new T.Vector3(0, Math.cos(a), Math.sin(a));
      const s = part(cone(0.18, 0.5 + Math.sin(i) * 0.1), toon("#e8594a"), h, { ink: 0.009, scale: [0.45, 1, 1] });
      s.position.copy(d).multiplyScalar(0.9); s.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d);
    }
  },
  side(h, m) {
    cap(h, m, 1.25, -0.35);
    part(lathe("swoop", [[0.001, 0.3], [0.35, 0.2], [0.5, -0.05], [0.3, -0.3], [0.001, -0.35]], 18), m, h, { ink: 0.01, pos: [-0.3, 0.78, 0.55], rot: [1.0, 0.4, 0.9], scale: [1.4, 1.2, 0.6] });
  },
  pigtails(h, m) {
    cap(h, m, 1.3, -0.4);
    for (const s of [-1, 1]) {
      part(blob("pig", 0.1, 8), m, h, { ink: 0.01, pos: [s * 1.12, 0.35, -0.2], scale: [0.35, 0.45, 0.35] });
      part(geo("tie", () => new T.TorusGeometry(0.16, 0.06, 8, 16)), toon("#9b6ad6"), h, { ink: 0.006, pos: [s * 0.92, 0.45, -0.2], rot: [0, Math.PI / 2, 0] });
    }
  },
  buzz(h, m) {
    part(shell("buzz2", 0, 1.55), m, h, { ink: 0.008, scale: 1.0, rot: [-0.25, 0, 0] });
  },
};

export function buildHair(headS, look) {
  const m = toon(look.hairColorHex, { side: T.DoubleSide });
  (STYLES[look.hair] || STYLES.buzz)(headS, m);
  const facial = toon(look.hair === "bald" ? look.hairColorHex : darken(look.hairColorHex, 0.9), { side: T.DoubleSide });
  if (look.beard === "full") {
    part(shell("beardL", 1.55, 1.35, -0.3, 1.5, 1.06), facial, headS, { ink: 0.01, scale: [1.04, 1.0, 1.04] });
    part(shell("beardR", 1.55, 1.35, 1.94, 1.5, 1.06), facial, headS, { ink: 0.01, scale: [1.04, 1.0, 1.04] });
    part(blob("chin", 0.14, 8), facial, headS, { ink: 0.01, pos: [0, -0.92, 0.42], scale: [0.62, 0.36, 0.5] });
  } else if (look.beard === "goatee") {
    part(blob("goat", 0.1, 8), facial, headS, { ink: 0.01, pos: [0, -0.8, 0.72], scale: [0.2, 0.22, 0.18] });
  }
  if (look.moustache || look.beard === "full") {
    for (const s of [-1, 1]) part(blob("mst", 0.08, 9), facial, headS, { ink: 0.008, pos: [s * 0.14, -0.3, 0.95], scale: [0.2, 0.09, 0.1], rot: [0, 0, s * -0.25] });
  }
}
