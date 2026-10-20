import * as T from "three";
import { toon, part, geo } from "./toon.js";
import { sphere, tube, cyl, torus, headShell, fitToHead, headRadius, headGeo } from "./shapes.js";
import { darken, surfaceOf } from "./face.js";
import { wearsCap } from "./hair.js";

// Head accessories on the unit head: glasses, headset, cap.
export function buildAccessories(headS, look) {
  const type = look.head || "round";
  if (look.glasses) {
    const frame = toon(look.glasses === "round" ? "#3a2a24" : "#2b3a55");
    const lensG = look.glasses === "round"
      ? geo("gRound", () => new T.TorusGeometry(0.27, 0.035, 8, 28))
      : geo("gSquare", () => { const s = new T.Shape(); s.moveTo(-0.3, -0.24); s.lineTo(0.3, -0.24); s.lineTo(0.32, 0.22); s.lineTo(-0.32, 0.22); s.closePath();
          const p = new T.Path(); p.moveTo(-0.25, -0.19); p.lineTo(0.25, -0.19); p.lineTo(0.27, 0.17); p.lineTo(-0.27, 0.17); p.closePath(); s.holes.push(p);
          return new T.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }); });
    // Lenses sit just in front of the eyes (eyeballs reach z ≈ 0.99) or the face, whichever is further out;
    // the arms run along the side of this head shape to the ears.
    const surf = surfaceOf(type, headGeo), lensZ = Math.max(0.99, surf(0.31, 0.1)) + (look.glasses === "round" ? 0.07 : 0.035); // the square frame is extruded forward from its back face
    const side = (s, y, z, out) => { const d = new T.Vector3(s * 0.98, y, z).normalize(); return d.multiplyScalar(headRadius(type, d) + out).toArray(); };
    for (const s of [-1, 1]) {
      part(lensG, frame, headS, { ink: 0.005, pos: [s * 0.31, 0.1, lensZ], rot: [0, s * 0.2, 0] }).userData.on = "head";
      const glass = new T.Mesh(geo("lens", () => new T.CircleGeometry(0.26, 24)), new T.MeshBasicMaterial({ color: "#dff4ff", transparent: true, opacity: 0.18, depthWrite: false }));
      glass.position.set(s * 0.31, 0.1, lensZ + 0.01); glass.rotation.y = s * 0.2; headS.add(glass);
      const pts = [[s * 0.6, 0.14, lensZ - 0.06], side(s, 0.14, 0.55, 0.05), side(s, 0.1, 0.0, 0.04)];
      const arm = part(tube("arm" + s + type + lensZ.toFixed(2), pts, 0.025, 8), frame, headS, { ink: 0 });
      arm.userData.on = "head"; arm.userData.float = 0.02;
    }
    part(tube("bridge" + lensZ.toFixed(2), [[-0.06, 0.14, lensZ + 0.04], [0, 0.18, lensZ + 0.07], [0.06, 0.14, lensZ + 0.04]], 0.03, 6), frame, headS, { ink: 0.004 });
    for (const m of headS.children) if (m.geometry === lensG) m.userData.float = 0.02;   // glasses rest on nose and ears only
  }
  // Headwear follows the head shape (taller heads would otherwise poke through the cap or the headset band).
  const from = headS.children.length;
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
  if (wearsCap(look)) {
    const c = toon(look.accentColor);
    // a little wider than the hair shells (≤ 1.12) so cap and hair never flicker against each other
    part(headShell("capDome", type, 1.17, 0, Math.PI * 0.4, 0, Math.PI * 2, -0.25), c, headS, { ink: 0.01, rot: [-0.25, 0, 0], pos: [0, 0.06, 0] }).userData.wear = "cap";
    const brim = part(geo("brim", () => { const g = new T.CylinderGeometry(0.62, 0.62, 0.05, 24, 1, false, -Math.PI / 2, Math.PI); g.scale(1, 1, 1.2); return g; }), c, headS, { ink: 0.008 });
    brim.position.set(0, 0.78, 0.72); brim.rotation.set(0.45, 0, 0); brim.material = toon(darken(look.accentColor, 0.8));
    part(sphere(8), toon("#f4f1ea"), headS, { ink: 0.004, pos: [0, 1.18, -0.2], scale: 0.07 });
  }
  fitToHead(type, headS, from);
}
