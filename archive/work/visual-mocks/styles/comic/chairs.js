import * as T from "three";

// Rolling desk chairs. A chair belongs to whoever sits in it: it swivels with that agent's hips and, while the harness
// slides the agent in or out of the seat, it rolls along under them (so nobody slides through armrests or the back).
// Free chairs roll back to their desk.
export const CHAIRS = [];
const _e = new T.Euler();
let lastTick = -1;

export function addChair(c) { c.userData.home = c.position.clone(); c.userData.owner = null; CHAIRS.push(c); }

export function registerChairs(list) {
  CHAIRS.length = 0;
  for (const c of list) { c.userData.home = c.position.clone(); c.userData.owner = null; CHAIRS.push(c); }
}

// Returns the chair this agent is using this frame (or null) and whether it should sit.
export function claimChair(id, root, pose, ctx) {
  for (const c of CHAIRS) if (c.userData.owner === id && c !== ctx.chair) {
    // Keep riding the chair while still close to its desk and not walking yet.
    if (pose !== "walk" && root.position.distanceTo(c.userData.home) < 0.75 && !ctx.spot) return { chair: c, sit: true };
    c.userData.owner = null;
  }
  if (ctx.chair && root.position.distanceTo(ctx.chair.userData.home) < 0.75) { // (lineup view moves roots far away)
    if (ctx.chair.userData.owner !== id) ctx.chair.userData.snap = true; // spawned seated: no swing-in
    ctx.chair.userData.owner = id; return { chair: ctx.chair, sit: false };
  }
  if (pose === "stand" && !ctx.spot) {
    for (const c of CHAIRS) {
      if (c.userData.owner && c.userData.owner !== id) continue;
      if (root.position.distanceTo(c.userData.home) < 0.55) { c.userData.owner = id; return { chair: c, sit: true }; }
    }
  }
  return { chair: null, sit: false };
}

// Place an owned chair under the agent: same floor position, yaw = root yaw + hips swivel (damped).
export function driveChair(chair, root, hips, dt) {
  chair.position.x = root.position.x; chair.position.z = root.position.z;
  const want = root.rotation.y + _e.setFromQuaternion(hips.quaternion, "YXZ").y;
  const d = Math.atan2(Math.sin(want - chair.rotation.y), Math.cos(want - chair.rotation.y));
  chair.rotation.y += d * (chair.userData.snap ? 1 : Math.min(1, dt * 12));
  chair.userData.snap = false;
}

// Once per frame: free chairs roll home.
export function tickChairs(t, dt) {
  if (t === lastTick) return; lastTick = t;
  for (const c of CHAIRS) {
    if (c.userData.owner) continue;
    const k = Math.min(1, dt * 4), h = c.userData.home, base = c.userData.baseYaw;
    c.position.x += (h.x - c.position.x) * k; c.position.z += (h.z - c.position.z) * k;
    c.rotation.y += Math.atan2(Math.sin(base - c.rotation.y), Math.cos(base - c.rotation.y)) * k;
  }
}
