import * as T from "three";
import { lathe, sculpt, mesh, joint, cached, smooth } from "./geo.js";

// Skeleton in a 1.75 m reference frame (rig is scaled by height/1.75). Facing +z, left = +x.
export const REF_H = 1.75;
export const DIM = { hipY: 0.95, spine: 0.09, chest: 0.17, neck: 0.16, head: 0.08, upper: 0.29, fore: 0.255, thigh: 0.42, shin: 0.405, legX: 0.093 };

export function buildSkeleton(root, g, skinMat) {
  const rig = joint(root, [0, 0, 0], "rig"); rig.scale.setScalar(g.height / REF_H);
  const J = { rig };
  J.hips = joint(rig, [0, DIM.hipY, 0], "hips");
  J.spine = joint(J.hips, [0, DIM.spine, 0], "spine");
  J.chest = joint(J.spine, [0, DIM.chest, 0], "chest");
  J.neck = joint(J.chest, [0, DIM.neck, -0.005], "neck");
  J.head = joint(J.neck, [0, DIM.head, 0.012], "head");
  J.headScale = joint(J.head, [0, 0, 0], "headScale"); J.headScale.scale.setScalar(1.06);
  const sw = (g.fem ? 0.152 : 0.166) * (0.94 + g.build * 0.06);
  J.arms = []; J.legs = [];
  // Neck skin.
  mesh(lathe("neck" + (g.fem ? "f" : "m"), 0.15, [[0, 0.047], [0.5, g.fem ? 0.047 : 0.055], [1, g.fem ? 0.056 : 0.065]], { sz: 1.05 }), skinMat, J.neck, [0, 0.12, 0.004]);
  for (const s of [1, -1]) {
    const sh = joint(J.chest, [s * sw, 0.155, -0.012], "shoulder");
    const el = joint(sh, [0, -DIM.upper, 0], "elbow");
    const wr = joint(el, [0, -DIM.fore, 0], "wrist");
    const ar = g.fem ? 0.9 : 1.0;
    mesh(lathe("uarm" + ar, DIM.upper + 0.03, [[0, 0.05 * ar], [0.18, 0.05 * ar], [0.55, 0.041 * ar], [1, 0.035 * ar]], { sz: 0.95 }), skinMat, sh, [0, 0.02, 0]);
    mesh(lathe("farm" + ar, DIM.fore + 0.02, [[0, 0.035 * ar], [0.25, 0.038 * ar], [0.75, 0.028 * ar], [1, 0.023 * ar]], { sz: 0.78 }), skinMat, el, [0, 0.01, 0]);
    const hand = buildHand(wr, s, skinMat, ar);
    J.arms.push({ s, sh, el, wr, hand });
    const th = joint(J.hips, [s * DIM.legX * (g.fem ? 1.04 : 1), -0.05, 0], "thigh");
    const kn = joint(th, [0, -DIM.thigh, 0], "knee");
    const an = joint(kn, [0, -DIM.shin, 0], "ankle");
    J.legs.push({ s, th, kn, an });
  }
  return J;
}

// Hand: sculpted palm, four two-segment fingers and a thumb. Anatomical frame: fingers -y, palm faces +z, thumb at +x*s.
function buildHand(wrist, s, skinMat, k) {
  const hand = joint(wrist, [0, 0, 0], "hand");
  const palmG = sculpt("palm", (x, y, z) => {
    const w = 1 - 0.25 * smooth(0.2, 1, y);
    return [x * 0.041 * w, y * 0.047 - 0.045, z * 0.015 * (1 - 0.3 * Math.max(0, z)) * (1 - 0.3 * smooth(-0.3, -1, y))];
  }, 16, 12);
  mesh(palmG, skinMat, hand, [0, 0, 0], { scale: [s * k, k, k] });
  const seg = (len, r) => cached(`fseg${len}${r}`, () => { const g = new T.CapsuleGeometry(r, len, 3, 8); g.translate(0, -len / 2 - r * 0.4, 0); return g; });
  const fingers = [];
  const spec = [[-0.028, 0.038, 0.0075], [-0.009, 0.043, 0.0082], [0.01, 0.041, 0.008], [0.027, 0.032, 0.007]]; // x (thumb side +), length, radius
  for (const [fx, len, r] of spec) {
    const base = joint(hand, [-fx * s * k, -0.088 * k, 0.001], "finger");
    base.scale.setScalar(k);
    mesh(seg(len * 0.55, r), skinMat, base, [0, 0, 0], { cast: false });
    const tip = joint(base, [0, -len * 0.55 - r * 0.8, 0]);
    mesh(seg(len * 0.45, r * 0.88), skinMat, tip, [0, 0, 0], { cast: false });
    fingers.push({ base, tip });
  }
  const thumb = joint(hand, [s * 0.034 * k, -0.03 * k, 0.012 * k], "thumb");
  thumb.rotation.set(0.5, 0, s * 0.55); thumb.scale.setScalar(k);
  mesh(seg(0.03, 0.0095), skinMat, thumb, [0, 0, 0], { cast: false });
  const ttip = joint(thumb, [0, -0.04, 0]);
  mesh(seg(0.022, 0.0085), skinMat, ttip, [0, 0, 0], { cast: false });
  return { hand, fingers, thumb, ttip };
}
