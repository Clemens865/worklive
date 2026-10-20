import * as T from "three";

// Body collision probes (spheres; capsules are sampled as several spheres), attached to joints.
// Used by the pose check only. kind: "limb" (checked against furniture), "core" (head/torso, also self-contact targets).
export function makeProbes(J) {
  const D = J.D, P = [];
  const add = (name, obj, x, y, z, r, kind = "limb", side = 0) => P.push({ name, obj, local: new T.Vector3(x, y, z), r, kind, side });
  const capsule = (name, obj, len, r0, r1, n, kind, side) => { for (let k = 0; k <= n; k++) add(name, obj, 0, -len * k / n, 0, r0 + (r1 - r0) * k / n, kind, side); };
  const w = D.waist, b = D.belly;
  add("head", J.headS, 0, 0, 0, D.headR * 0.95, "core");
  add("chest", J.chest, 0, D.chestH * 0.5, 0, D.shoulderW * 0.7, "core");
  add("belly", J.spine, 0, D.spineH * 0.5, 0.01 * b, w * (1.02 + b * 0.25) * 0.82, "core");
  add("pelvis", J.hips, 0, -0.02, 0, w * 0.8, "core");
  for (const [i, A] of J.arms.entries()) {
    const s = i ? 1 : -1, tag = s < 0 ? "L" : "R";
    capsule("upperarm" + tag, A.shoulder, D.upper, D.armR * 1.1, D.armR, 2, "limb", s);
    capsule("forearm" + tag, A.elbow, D.fore, D.armR * 0.95, D.armR * 0.8, 2, "limb", s);
    add("hand" + tag, A.wrist, 0, -0.07, 0, 0.055, "hand", s);
  }
  for (const [i, L] of J.legs.entries()) {
    const s = i ? 1 : -1, tag = s < 0 ? "L" : "R";
    capsule("thigh" + tag, L.hip, D.thigh, D.legR * 1.15, D.legR, 2, "limb", s);
    add("knee" + tag, L.knee, 0, 0, 0, D.legR, "limb", s);
    capsule("shin" + tag, L.knee, D.shin, D.legR * 0.95, D.legR * 0.85, 2, "limb", s);
    add("footheel" + tag, L.ankle, 0, 0.045, -0.02, 0.05, "foot", s);
    add("foottoe" + tag, L.ankle, 0, 0.035, 0.13, 0.045, "foot", s);
  }
  return P;
}

const _v = new T.Vector3();
export function probeWorld(p, out = _v) { return out.copy(p.local).applyMatrix4(p.obj.matrixWorld); }
