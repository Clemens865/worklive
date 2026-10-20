import * as T from "three";
import { COLLIDERS } from "./colliders.js";

// Lounge seat geometry measured from the furniture colliders, expressed in the agent's root space.
// This keeps the lounge pose glued to the real cushion even while the harness slides the root into place.
const SEAT = {
  sofa: { base: "sofa-base", top: 0.51, back: -0.16, front: 0.44 },
  armchair: { base: "armchair-base", top: 0.56, back: -0.19, front: 0.335 },
};
const _w = new T.Vector3(), _l = new T.Vector3(), _m = new T.Matrix4();

// Is the root standing over a lounge seat footprint? Returns "sofa" | "armchair" | null.
export function seatUnder(pos) {
  for (const c of COLLIDERS) {
    if (c.name !== "sofa-base" && c.name !== "armchair-base") continue;
    _l.copy(pos).applyMatrix4(_m.copy(c.obj.matrixWorld).invert());
    if (_l.x > c.min.x + 0.1 && _l.x < c.max.x - 0.1 && _l.z > c.min.z && _l.z < c.max.z + 0.02) return c.name.startsWith("sofa") ? "sofa" : "armchair";
  }
  return null;
}

// { kind, top, back, front } with back/front as root-local z of the backrest face and cushion front edge.
export function seatInfo(root, spot) {
  const kind = spot && spot.startsWith("armchair") ? "armchair" : "sofa", K = SEAT[kind];
  root.updateMatrixWorld(true);
  let best = null, bd = Infinity;
  for (const c of COLLIDERS) {
    if (c.name !== K.base) continue;
    c.obj.getWorldPosition(_w); const d = _w.distanceTo(root.position);
    if (d < bd) { bd = d; best = c; }
  }
  if (!best || bd > 2) return { kind, top: K.top, back: kind === "sofa" ? -0.28 : -0.24, front: kind === "sofa" ? 0.32 : 0.285, yaw: 0 };
  // Distances are measured along the seat's own facing so the body can face the seat even while the root turns.
  const fwd = new T.Vector3(0, 0, 1).transformDirection(best.obj.matrixWorld); fwd.y = 0; fwd.normalize();
  const origin = new T.Vector3().setFromMatrixPosition(best.obj.matrixWorld);
  const rel = root.position.clone().sub(origin); rel.y = 0;
  const at = (z) => z - rel.dot(fwd);
  const seatYaw = Math.atan2(fwd.x, fwd.z), d = seatYaw - root.rotation.y;
  const yaw = Math.atan2(Math.sin(d), Math.cos(d));
  // Which hand points at the sofa's middle (the neighbour's seat): that one rests in the lap instead.
  const right = new T.Vector3(fwd.z, 0, -fwd.x), lateral = rel.dot(right);
  const inner = kind === "sofa" && Math.abs(lateral) > 0.2 ? (lateral > 0 ? -1 : 1) : 0;
  return { kind, top: K.top, back: at(K.back), front: at(K.front), yaw, inner };
}
