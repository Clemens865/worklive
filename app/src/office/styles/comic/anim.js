import * as T from "three";
import { createExpressions } from "./expressions.js";
import { solveTwoBone } from "./ik.js";
import { buildMug } from "./props.js";
import { bodyPose } from "./poses.js";

// Drives the rig: pose targets -> damped quaternions (never snaps), IK typing, look-at, squash & stretch.
const _e = new T.Euler(), _v = new T.Vector3(), _w = new T.Vector3(), _q = new T.Quaternion();

export function createAnimator(J, face, agent, index) {
  const seed = (J.look.seed % 1000) / 1000 * 50;
  const expr = createExpressions(face, J.look, J.look.seed % 97);
  const mug = buildMug(J.arms[1].wrist);
  const targets = new Map();
  const S = { J, t: 0, phase: seed, pose: "stand", status: agent.status, seed, hipPos: new T.Vector3(0, J.hipY, 0), hipTarget: new T.Vector3(),
    squash: 0, glance: 0, glanceT: 3 + seed % 4, lookYaw: 0, lookPitch: 0, idleYaw: 0, idleT: 0, gesture: 0, fidget: 0, fidgetT: 4 + seed % 5 };

  // Target setter used by poses.js
  S.set = (j, x = 0, y = 0, z = 0, order = "XYZ") => {
    let q = targets.get(j); if (!q) { q = new T.Quaternion(); targets.set(j, q); }
    q.setFromEuler(_e.set(x, y, z, order)); return q;
  };
  S.setQ = (j, q) => { let t = targets.get(j); if (!t) { t = new T.Quaternion(); targets.set(j, t); } t.copy(q); };

  const q1 = new T.Quaternion(), q2 = new T.Quaternion();
  function ikArm(arm, side, targetRoot, pole) {
    // target given in root-local space -> chest-local
    _v.copy(targetRoot); J.root.localToWorld(_v); J.chest.worldToLocal(_v);
    solveTwoBone(arm.shoulder.position, _v, J.D.upper, J.D.fore + 0.02, pole, q1, q2);
    S.setQ(arm.shoulder, q1); S.setQ(arm.elbow, q2);
  }
  S.ikArm = ikArm;

  function damp(joints, k) {
    for (const j of joints) { const q = targets.get(j); if (q) j.quaternion.slerp(q, k); }
  }

  function lookAtCam(ctx, dt) {
    // Head + eye tracking toward ctx.lookAt, with idle glances when no target.
    let yaw = S.idleYaw, pitch = -0.05;
    S.idleT -= dt;
    if (S.idleT <= 0) { S.idleT = 1.5 + Math.abs(Math.sin(S.t * 3.1 + seed)) * 3; S.idleYaw = Math.sin(S.t * 1.7 + seed) * 0.6; }
    let wantCam = !!ctx.lookAt;
    S.camYaw = null;
    if (ctx.lookAt) { _w.copy(ctx.lookAt); J.root.worldToLocal(_w); S.camYaw = Math.atan2(_w.x, _w.z); }
    if (S.pose === "type") {
      S.glanceT -= dt; if (S.glanceT <= 0) { S.glance = S.glance ? 0 : 1; S.glanceT = S.glance ? 1.6 : 4 + Math.abs(Math.sin(S.t + seed)) * 4; }
      yaw = Math.sin(S.t * 0.5 + seed) * 0.12; pitch = 0.02;
      wantCam = wantCam && S.glance;
    }
    if (S.pose === "walk") { yaw = Math.sin(S.t * 0.6 + seed) * 0.25; pitch = 0.05; }
    if (wantCam) {
      J.root.updateMatrixWorld(true);
      _v.copy(ctx.lookAt); J.chest.worldToLocal(_v); _v.sub(J.neck.position);
      yaw = Math.atan2(_v.x, _v.z); pitch = -Math.atan2(_v.y - 0.25, Math.hypot(_v.x, _v.z));
      if (Math.abs(yaw) > (ctx.status === "needs" ? 2.4 : 1.45)) { yaw = S.idleYaw * 0.4; pitch = -0.05; }
    }
    const cy = T.MathUtils.clamp(yaw, -1.1, 1.1), cp = T.MathUtils.clamp(pitch, -0.55, 0.45);
    const k = 1 - Math.exp(-dt * 5);
    S.lookYaw += (cy - S.lookYaw) * k; S.lookPitch += (cp - S.lookPitch) * k;
    // Eyes lead: they get the full angle immediately, head follows with damping
    expr.gaze.yaw = T.MathUtils.clamp((yaw - S.lookYaw) * 1.2 + S.lookYaw * 0.3, -0.45, 0.45);
    expr.gaze.pitch = T.MathUtils.clamp((pitch - S.lookPitch) * 1.2 + S.lookPitch * 0.25 - 0.05, -0.35, 0.3);
    return { yaw: S.lookYaw, pitch: S.lookPitch };
  }

  function update(t, dt, pose, ctx) {
    S.t = t; S.dt = dt; S.pose = pose; S.status = ctx.status;
    if (pose === "walk") S.phase += dt * 8.6;
    const look = lookAtCam(ctx, dt);
    const face = bodyPose(S, look, ctx);
    expr.set(face.expr); expr.setTalk(face.talk || 0);
    // Hips position + squash & stretch
    const snap = !S.started; S.started = true; // first frame: start in pose, don't animate from T-pose
    const kh = snap ? 1 : 1 - Math.exp(-dt * (pose === "walk" ? 18 : 7));
    S.hipPos.lerp(S.hipTarget, kh);
    J.hips.position.copy(S.hipPos);
    const sq = S.squash;
    J.spine.scale.set(1 - sq * 0.5, 1 + sq, 1 - sq * 0.5);
    const k = snap ? 1 : 1 - Math.exp(-dt * (pose === "walk" ? 22 : 9));
    damp([J.hips, J.spine, J.chest], k);
    damp([J.neck, J.head], snap ? 1 : 1 - Math.exp(-dt * 8));
    for (const L of J.legs) damp([L.hip, L.knee, L.ankle], k);
    // Arms may use IK against the freshly placed torso
    if (face.ik) { J.root.updateMatrixWorld(true); face.ik(); }
    for (const A of J.arms) {
      damp([A.shoulder, A.elbow, A.wrist, A.thumb], k);
      damp(A.fingers, 1 - Math.exp(-dt * 25));
    }
    mug.visible = pose === "coffee";
    if (mug.visible) {
      // Keep the mug upright in world space whatever the wrist does
      J.root.updateMatrixWorld(true);
      J.arms[1].wrist.getWorldQuaternion(_q).invert();
      J.root.getWorldQuaternion(mug.quaternion);
      mug.quaternion.premultiply(_q);
    }
    // LOD: fingers only when the camera is near
    const near = ctx.camDist < 9 || ctx.mode === "pov";
    if (near !== S.near) { S.near = near; for (const A of J.arms) { A.fingers.forEach(f => f.visible = near); A.thumb.visible = near; } }
    expr.update(dt, t);
  }
  return { update, expr };
}
