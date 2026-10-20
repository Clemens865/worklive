import * as T from "three";

// Face rig: blinking, saccades, gaze, and status-driven expressions. Everything damped.
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function createFaceRig(face, J, root, index) {
  const hp = new T.Vector3(), rq = new T.Quaternion(), look = { yaw: 0, pitch: 0 };
  const cur = { up: -0.5, lo: 0.4, brow: 0, browY: 0, smile: 0, open: 0 };
  let blinkIn = 1.5 + index * 0.7, blinkT = -1, saccIn = 0.5, sacc = new T.Vector2(), eyeCur = new T.Vector2();

  function lookAngles(ctx, pose) {
    let yaw = 0, pitch = 0;
    if (ctx.lookAt) {
      J.head.getWorldPosition(hp);
      const d = ctx.lookAt.clone().sub(hp).applyQuaternion(root.getWorldQuaternion(rq).invert());
      yaw = Math.atan2(d.x, d.z); pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z));
      if (Math.abs(yaw) > 1.5) { yaw = 0; pitch = 0; }
      const wgt = pose === "type" ? 0.35 : pose === "walk" ? 0.6 : 1;
      yaw = clamp(yaw, -1.05, 1.05) * wgt; pitch = clamp(pitch, -0.45, 0.35) * wgt;
    }
    look.yaw = yaw; look.pitch = pitch; return look;
  }

  function update(t, dt, status, ctx, st, pose, waving) {
    const k = 1 - Math.exp(-10 * dt);
    // Blink.
    blinkIn -= dt;
    if (blinkIn < 0 && blinkT < 0) { blinkT = 0; blinkIn = 2 + ((index * 7 + t * 13) % 3.5); }
    let blink = 0;
    if (blinkT >= 0) { blinkT += dt; blink = Math.sin(Math.min(1, blinkT / 0.16) * Math.PI); if (blinkT > 0.16) blinkT = -1; }
    // Saccades.
    saccIn -= dt;
    if (saccIn < 0) { saccIn = 0.4 + ((index * 3 + t * 7) % 1.8); sacc.set(Math.sin(t * 12.9 + index) * 0.16, Math.cos(t * 7.3) * 0.07); if (pose === "type") sacc.set(Math.sin(t * 5) * 0.2, 0.18); }
    // Expressions.
    const E = { working: { up: -0.45, lo: 0.4, brow: 0.1, browY: -0.0015, smile: 0, open: 0 },
      needs: { up: -0.7, lo: 0.48, brow: -0.32, browY: 0.0025, smile: -0.4, open: 0.25 },
      review: { up: -0.5, lo: 0.28, brow: -0.05, browY: 0.001, smile: 1, open: 0.1 },
      idle: { up: -0.55, lo: 0.42, brow: 0, browY: 0, smile: 0.35, open: 0 } }[status] || {};
    for (const key in cur) cur[key] += ((E[key] ?? 0) - cur[key]) * k;
    if (waving) cur.open += (0.6 - cur.open) * k;
    const up = cur.up + (0.95 - cur.up) * blink, lo = cur.lo + (0.12 - cur.lo) * blink;
    for (const L of face.lids) { L.up.rotation.x = up; L.lo.rotation.x = lo; }
    eyeCur.x += (clamp(look.yaw * 0.45, -0.35, 0.35) + sacc.x - eyeCur.x) * Math.min(1, dt * 30);
    eyeCur.y += (clamp(look.pitch * 0.4, -0.3, 0.3) + sacc.y - eyeCur.y) * Math.min(1, dt * 30);
    for (const e of face.eyes) e.rotation.set(eyeCur.y, eyeCur.x, 0);
    for (const [i, b] of face.brows.entries()) { const s = i ? 1 : -1; b.rotation.z = s * cur.brow * 0.8; b.position.y = b.userData.y0 + cur.browY + blink * -0.0015; }
    face.mouth.scale.set(1 + cur.smile * 0.1, 1, 1);
    face.mouth.position.y = face.mouth.userData.y0 + cur.smile * 0.0012;
    face.upper.rotation.x = -cur.smile * 0.05;
    face.lower.position.y = -0.0038 - cur.open * 0.004; face.lower.rotation.x = cur.open * 0.25 - cur.smile * 0.08;
  }
  for (const b of face.brows) b.userData.y0 = b.position.y;
  face.mouth.userData.y0 = face.mouth.position.y;
  return { update, lookAngles };
}
