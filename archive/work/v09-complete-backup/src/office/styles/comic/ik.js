import * as T from "three";

// Analytic two-bone IK in the parent's (chest) local space. Bones hang along local -Y.
const DOWN = new T.Vector3(0, -1, 0);
const d = new T.Vector3(), dn = new T.Vector3(), ax = new T.Vector3(), u = new T.Vector3(), f = new T.Vector3(), tmp = new T.Vector3();
const qInv = new T.Quaternion();

export function solveTwoBone(shoulderPos, target, L1, L2, pole, outQ1, outQ2) {
  d.subVectors(target, shoulderPos);
  const dist = T.MathUtils.clamp(d.length(), Math.abs(L1 - L2) + 0.01, (L1 + L2) * 0.995);
  dn.copy(d).normalize();
  const cosA = T.MathUtils.clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1);
  const A = Math.acos(cosA);
  ax.crossVectors(dn, pole);
  if (ax.lengthSq() < 1e-6) ax.set(1, 0, 0);
  ax.normalize();
  u.copy(dn).applyAxisAngle(ax, A);
  outQ1.setFromUnitVectors(DOWN, u);
  // Forearm direction
  tmp.copy(dn).multiplyScalar(dist).add(shoulderPos);
  f.copy(tmp).sub(u.multiplyScalar(L1).add(shoulderPos)).normalize();
  qInv.copy(outQ1).invert();
  f.applyQuaternion(qInv);
  outQ2.setFromUnitVectors(DOWN, f);
}
