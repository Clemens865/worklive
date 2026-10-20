import * as T from "three";

// Analytic two-bone IK for an arm (shoulder -> elbow -> wrist), plus hand orientation.
// Produces TARGET local quaternions (caller damps toward them).
const DOWN = new T.Vector3(0, -1, 0);
const _S = new T.Vector3(), _d = new T.Vector3(), _p = new T.Vector3(), _u = new T.Vector3(), _E = new T.Vector3(), _f = new T.Vector3(), _tmp = new T.Vector3();
const _pq = new T.Quaternion(), _uq = new T.Quaternion(), _eq = new T.Quaternion(), _inv = new T.Quaternion(), _m = new T.Matrix4();

export function solveArm(A, targetW, poleW, l1, l2, out) {
  A.sh.getWorldPosition(_S);
  A.sh.parent.getWorldQuaternion(_pq);
  _d.subVectors(targetW, _S);
  const dist = Math.min(Math.max(_d.length(), Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.002);
  _d.normalize();
  const cosA = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  _p.subVectors(poleW, _S); _p.addScaledVector(_d, -_p.dot(_d)).normalize();
  _u.copy(_d).multiplyScalar(cosA).addScaledVector(_p, sinA).normalize();
  _E.copy(_S).addScaledVector(_u, l1);
  _f.subVectors(_S.addScaledVector(_d, dist), _E).normalize();
  // Shoulder: local -y -> upper direction (in parent space).
  _inv.copy(_pq).invert();
  out.sh.setFromUnitVectors(DOWN, _tmp.copy(_u).applyQuaternion(_inv));
  _uq.copy(_pq).multiply(out.sh);
  _inv.copy(_uq).invert();
  out.el.setFromUnitVectors(DOWN, _tmp.copy(_f).applyQuaternion(_inv));
  _eq.copy(_uq).multiply(out.el);
  out.elWorld = out.elWorld || new T.Quaternion(); out.elWorld.copy(_eq);
  return out;
}

// World quaternion for a hand whose fingers point along `fingers` and palm faces `palm` (both world vectors).
const _x = new T.Vector3(), _y = new T.Vector3(), _z = new T.Vector3();
export function handWorldQuat(fingers, palm, q) {
  _y.copy(fingers).negate().normalize();
  _z.copy(palm).addScaledVector(_y, -palm.dot(_y)).normalize();
  _x.crossVectors(_y, _z);
  _m.makeBasis(_x, _y, _z); return q.setFromRotationMatrix(_m);
}
export function wristLocal(elWorld, handWorld, out) { return out.copy(elWorld).invert().multiply(handWorld); }
