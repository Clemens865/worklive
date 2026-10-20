import * as T from "three";
import { toon, part, geo } from "./toon.js";
import { sphere, tube, cyl, torus } from "./shapes.js";
import { darken } from "./face.js";

// Head accessories on the unit head: glasses, headset, cap.
export function buildAccessories(headS, look) {
  if (look.glasses) {
    const frame = toon(look.glasses === "round" ? "#3a2a24" : "#2b3a55");
    const lensG = look.glasses === "round"
      ? geo("gRound", () => new T.TorusGeometry(0.27, 0.035, 8, 28))
      : geo("gSquare", () => { const s = new T.Shape(); s.moveTo(-0.3, -0.24); s.lineTo(0.3, -0.24); s.lineTo(0.32, 0.22); s.lineTo(-0.32, 0.22); s.closePath();
          const p = new T.Path(); p.moveTo(-0.25, -0.19); p.lineTo(0.25, -0.19); p.lineTo(0.27, 0.17); p.lineTo(-0.27, 0.17); p.closePath(); s.holes.push(p);
          return new T.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }); });
    for (const s of [-1, 1]) {
      part(lensG, frame, headS, { ink: 0.005, pos: [s * 0.31, 0.1, 1.06], rot: [0, s * 0.2, 0] });
      const glass = new T.Mesh(geo("lens", () => new T.CircleGeometry(0.26, 24)), new T.MeshBasicMaterial({ color: "#dff4ff", transparent: true, opacity: 0.18, depthWrite: false }));
      glass.position.set(s * 0.31, 0.1, 1.07); glass.rotation.y = s * 0.2; headS.add(glass);
      part(tube("arm" + s, [[s * 0.6, 0.14, 1.0], [s * 0.98, 0.14, 0.55], [s * 1.02, 0.1, 0.0]], 0.025, 8), frame, headS, { ink: 0 });
    }
    part(tube("bridge", [[-0.06, 0.14, 1.1], [0, 0.18, 1.13], [0.06, 0.14, 1.1]], 0.03, 6), frame, headS, { ink: 0.004 });
  }
  if (look.headset) {
    const dark = toon("#2c2d33"), acc = toon(look.accentColor);
    part(geo("band", () => new T.TorusGeometry(1.13, 0.05, 8, 32, Math.PI)), dark, headS, { ink: 0.006, rot: [0, 0, 0], pos: [0, 0.08, -0.05] });
    for (const s of [-1, 1]) {
      part(cyl(0.22, 0.24, 0.14, 20), dark, headS, { ink: 0.008, pos: [s * 1.08, 0.02, -0.03], rot: [0, 0, Math.PI / 2] });
      part(cyl(0.16, 0.16, 0.02, 16), acc, headS, { ink: 0, pos: [s * 1.16, 0.02, -0.03], rot: [0, 0, Math.PI / 2] });
    }
    part(tube("mic", [[-1.1, -0.05, 0.05], [-0.95, -0.4, 0.5], [-0.45, -0.55, 0.85]], 0.03, 10), dark, headS, { ink: 0.004 });
    part(sphere(10), acc, headS, { ink: 0.005, pos: [-0.42, -0.55, 0.87], scale: 0.07 });
  }
  if (look.cap) {
    const c = toon(look.accentColor);
    part(geo("capDome", () => new T.SphereGeometry(1.13, 30, 14, 0, Math.PI * 2, 0, Math.PI * 0.4)), c, headS, { ink: 0.01, rot: [-0.25, 0, 0], pos: [0, 0.06, 0] });
    const brim = part(geo("brim", () => { const g = new T.CylinderGeometry(0.62, 0.62, 0.05, 24, 1, false, -Math.PI / 2, Math.PI); g.scale(1, 1, 1.2); return g; }), c, headS, { ink: 0.008 });
    brim.position.set(0, 0.78, 0.72); brim.rotation.set(0.45, 0, 0); brim.material = toon(darken(look.accentColor, 0.8));
    part(sphere(8), toon("#f4f1ea"), headS, { ink: 0.004, pos: [0, 1.18, -0.2], scale: 0.07 });
  }
}
