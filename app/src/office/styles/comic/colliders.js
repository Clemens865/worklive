import * as T from "three";

// Furniture collision volumes (debug / pose-check only; never rendered).
// A collider is an axis-aligned box in the local space of an Object3D (no scale), so rotating chairs stay correct.
export const COLLIDERS = [];

// Box given by centre + size in `obj` local space.
export function addBox(name, obj, x, y, z, w, h, d) {
  COLLIDERS.push({ name, obj, min: new T.Vector3(x - w / 2, y - h / 2, z - d / 2), max: new T.Vector3(x + w / 2, y + h / 2, z + d / 2) });
}

const _p = new T.Vector3(), _inv = new T.Matrix4();
// Signed distance from a world point to a collider (negative = inside).
export function boxDistance(c, world) {
  _inv.copy(c.obj.matrixWorld).invert();
  _p.copy(world).applyMatrix4(_inv);
  const dx = Math.max(c.min.x - _p.x, 0, _p.x - c.max.x);
  const dy = Math.max(c.min.y - _p.y, 0, _p.y - c.max.y);
  const dz = Math.max(c.min.z - _p.z, 0, _p.z - c.max.z);
  const out = Math.hypot(dx, dy, dz);
  if (out > 0) return out;
  return -Math.min(_p.x - c.min.x, c.max.x - _p.x, _p.y - c.min.y, c.max.y - _p.y, _p.z - c.min.z, c.max.z - _p.z);
}

export function colliderCentre(c, out = new T.Vector3()) {
  return out.addVectors(c.min, c.max).multiplyScalar(0.5).applyMatrix4(c.obj.matrixWorld);
}
