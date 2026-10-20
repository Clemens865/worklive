import * as T from "three";

// Pose library. Writes joint targets (Euler) into S via S.set, returns face + optional IK callback.
// Conventions (joint local): rot.x < 0 swings a limb forward; rot.z = side * a swings an arm outward.
const KEY = new T.Vector3(), POLE = new T.Vector3(), HEAD = new T.Vector3(), UP = new T.Vector3(0, 1, 0);

export function bodyPose(S, look, ctx) {
  const { J, t } = S, pose = S.pose, st = ctx.status, D = J.D;
  const breath = Math.sin(t * 1.9 + S.seed) * 0.5 + 0.5;
  S.squash = (breath - 0.5) * 0.025;
  S.hipTarget.set(0, J.hipY, 0);
  let out = { expr: "relaxed" };
  const legsStand = () => J.legs.forEach((L, i) => { const s = i ? 1 : -1; S.set(L.hip, 0, 0, -s * 0.03); S.set(L.knee, 0.02); S.set(L.ankle, -0.02, 0, s * 0.03); });
  const legsSit = (spread = 0.12) => J.legs.forEach((L, i) => { const s = i ? 1 : -1; S.set(L.hip, -Math.PI / 2 + (S.kneeTilt || 0.14), s * 0.04, s * spread); S.set(L.knee, Math.PI / 2 - 0.3 + (i ? 0 : Math.sin(t * 0.8 + S.seed) * 0.06)); S.set(L.ankle, 0.08); });
  const armsRelax = (x = 0.05, e = -0.15) => J.arms.forEach((A, i) => { const s = i ? 1 : -1; S.set(A.shoulder, x, 0, s * 0.14); S.set(A.elbow, e, 0, 0); S.set(A.wrist, 0, s * 0.3, s * 0.1); curl(A, 0.35); });
  const curl = (A, c) => { A.fingers.forEach((f, k) => S.set(f, c + k * 0.05)); S.set(A.thumb, 0.4, 0, (A === J.arms[1] ? 1 : -1) * -0.7 + c * 0.2); };
  const head = (x = 0, y = 0, z = 0) => { S.set(J.neck, look.pitch * 0.4 + x * 0.4, look.yaw * 0.4 + y * 0.4, z * 0.3); S.set(J.head, look.pitch * 0.6 + x * 0.6, look.yaw * 0.6 + y * 0.6, z * 0.7); };

  if (pose === "walk") {
    const p = S.phase, sw = Math.sin(p), bob = Math.abs(Math.cos(p));
    S.hipTarget.set(0, J.hipY - 0.025 + bob * 0.06, 0);
    S.squash = (bob - 0.6) * 0.09;
    S.set(J.hips, 0.04, sw * 0.2, Math.cos(p) * 0.05);
    S.set(J.spine, 0.06, -sw * 0.18, -Math.cos(p) * 0.04);
    S.set(J.chest, 0.02, -sw * 0.16, 0);
    J.legs.forEach((L, i) => {
      const s = i ? 1 : -1, ph = p + (i ? Math.PI : 0);
      const swing = Math.sin(ph);
      S.set(L.hip, -swing * 0.62, 0, -s * 0.03);
      S.set(L.knee, Math.max(0, Math.sin(ph - 1.2)) * 1.25 + 0.08);
      S.set(L.ankle, swing * 0.16 - Math.max(0, Math.sin(ph - 1.2)) * 0.12);
    });
    J.arms.forEach((A, i) => {
      const s = i ? 1 : -1, ph = p + (i ? 0 : Math.PI);
      S.set(A.shoulder, -Math.sin(ph) * 0.7, 0, s * 0.18);
      S.set(A.elbow, -0.45 - Math.max(0, -Math.sin(ph)) * 0.6);
      S.set(A.wrist, 0, s * 0.2, 0); curl(A, 0.7);
    });
    head(-0.02, sw * 0.12, 0);
    out = { expr: "happy" };
  } else if (pose === "sit" || pose === "type") {
    // Pelvis rests on the seat (top 0.52); thighs tilt down enough that knees clear the desk underside (0.70).
    const hipY = 0.52 + D.waist * 0.8 - 0.01;
    const kneeTilt = Math.max(0.1, Math.asin(T.MathUtils.clamp((hipY - 0.685 + D.legR) / D.thigh, 0, 0.9)));
    S.hipTarget.set(0, hipY, 0.05);
    S.kneeTilt = kneeTilt;
    S.set(J.hips, 0, 0, 0);
    legsSit();
    if (pose === "type") {
      S.set(J.spine, 0.14 + breath * 0.02, 0, 0); S.set(J.chest, 0.06, Math.sin(t * 0.7 + S.seed) * 0.05, 0);
      head(0.05, 0, 0);
      J.arms.forEach((A, i) => {
        const s = i ? 1 : -1;
        S.set(A.wrist, 0.25, 0, -s * 0.15);
        A.fingers.forEach((f, k) => S.set(f, 0.55 + Math.max(0, Math.sin(t * 15 + k * 2.1 + i * 1.3 + S.seed)) * 0.7));
        S.set(A.thumb, 0.3, 0, -s * 0.6);
      });
      out.ik = () => J.arms.forEach((A, i) => {
        const s = i ? 1 : -1, tap = Math.max(0, Math.sin(t * 7.5 + i * Math.PI + S.seed));
        KEY.set(s * 0.12 + Math.sin(t * 0.9 + i) * 0.025, 0.84 + tap * 0.025, 0.38);
        POLE.set(s * 1.0, -0.6, -0.8);
        S.ikArm(A, s, KEY, POLE);
      });
      const phase = (t + S.seed) % 9;
      out.expr = phase < 2.2 ? "tongue" : "focused";
    } else {
      S.set(J.spine, -0.06, 0, 0); S.set(J.chest, 0, look.yaw * 0.25, 0);
      head();
      armsRelax(-0.55, -0.9);
      J.arms.forEach((A, i) => { S.set(A.wrist, 0.15, 0, (i ? -1 : 1) * 0.1); curl(A, 0.5); });
      // Hands rest on the desk in front (IK, so short and long arms both land on the desk instead of in its edge).
      out.rest = i => {
        const s = i ? 1 : -1;
        KEY.set(s * 0.19, 0.86 + Math.sin(t * 0.6 + i * 2 + S.seed) * 0.006, 0.34);
        POLE.set(s * 1.0, -0.6, -0.8);
        S.ikArm(J.arms[i], s, KEY, POLE);
      };
      out.ik = () => { out.rest(0); out.rest(1); };
      out.expr = "relaxed";
    }
  } else if (pose === "lounge") {
    out = loungePose(S, J, t, look, ctx, curl, head);
  } else {
    // stand / coffee
    const sway = Math.sin(t * 0.7 + S.seed);
    S.set(J.hips, 0, sway * 0.04, sway * 0.03); S.set(J.spine, 0.02, 0, -sway * 0.03); S.set(J.chest, -0.02 + breath * 0.02, 0, 0);
    legsStand(); armsRelax(); head();
    out.expr = "relaxed";
    if (pose === "coffee") coffee(S, J, t, out, curl);
  }
  statusOverlay(S, J, t, pose, st, out, curl, look);
  return out;
}

function coffee(S, J, t, out, curl) {
  const A = J.arms[1], cyc = (t + S.seed) % 5.5;
  const sip = cyc > 3.6 && cyc < 5.0 ? Math.sin(((cyc - 3.6) / 1.4) * Math.PI) : 0;
  S.set(A.shoulder, -0.35 - sip * 0.55, 0, 0.22 - sip * 0.12);
  S.set(A.elbow, -1.75 - sip * 0.5, 0.35, 0);
  S.set(A.wrist, 0, 0.9, 0);
  curl(A, 1.25);
  if (sip > 0.3) { out.expr = "sip"; S.set(J.head, -0.25 * sip, 0, 0); }
  else out.expr = "happy";
  // Other hand in the pocket-ish
  const B = J.arms[0];
  S.set(B.shoulder, 0.12, 0, -0.22); S.set(B.elbow, -0.35, 0, 0); curl(B, 0.9);
}

// Status-driven overlays: needs = worried + wave; review = proud lean-back, hands behind head, fist pump.
function statusOverlay(S, J, t, pose, st, out, curl, look) {
  if (pose === "walk" || pose === "lounge" || pose === "coffee") return;
  if (st === "needs" && pose !== "type") {
    const A = J.arms[1], cyc = (t + S.seed) % 6;
    const waving = cyc < 4;
    // Seated: the free (left) hand keeps resting on the desk while the right one waves; the cheek gesture uses both.
    out.ik = waving && out.rest ? () => out.rest(0) : null;
    if (waving) {
      S.set(A.shoulder, -0.25, 0, 2.55);
      S.set(A.elbow, -0.25, 0, 0.35 + Math.sin(t * 10) * 0.45);
      S.set(A.wrist, 0, 0, 0); curl(A, 0.05);
    } else {
      // "!" gesture: index up, the other hand on the cheek
      S.set(A.shoulder, -0.55, 0, 0.5); S.set(A.elbow, -1.9, 0, 0); S.set(A.wrist, 0, 0, 0);
      A.fingers.forEach((f, k) => S.set(f, k === 2 ? 0 : 1.5));
      const B = J.arms[0];
      S.set(B.shoulder, -0.5, 0, -0.35); S.set(B.elbow, -2.2, 0.3, 0); curl(B, 0.3);
    }
    S.set(J.chest, 0.02, look.yaw * 0.5 + Math.sin(t * 2) * 0.03, 0);
    // Swivel toward the viewer so the wave reads
    if (S.camYaw !== null && pose === "sit") S.set(J.hips, 0, T.MathUtils.clamp(S.camYaw, -1.2, 1.2) * 0.75, 0);
    out.expr = "worried"; out.talk = waving ? 0 : 1;
  } else if (st === "review" && pose !== "type") {
    const cyc = (t + S.seed) % 8, pump = cyc > 6 ? Math.sin(((cyc - 6) / 2) * Math.PI) : 0;
    S.set(J.spine, -0.18 - pump * 0.05, 0, 0);
    const pumping = pump > 0.05;
    J.arms.forEach((A, i) => {
      const s = i ? 1 : -1;
      if (i === 1 && pumping) {
        // up and out to the side (never forward, where a desk may be)
        S.set(A.shoulder, 0.1, 0, 0.7 + 1.65 * pump); S.set(A.elbow, -0.5 - Math.sin(t * 14) * 0.25 * pump, 0, 0); curl(A, 1.6);
      } else { S.set(A.wrist, 0.3, 0, 0); curl(A, 0.9); }
    });
    // Hands clasped behind the head: IK to points outside the skull (hand never enters the head sphere).
    out.ik = () => {
      J.headS.getWorldPosition(HEAD); J.root.worldToLocal(HEAD);
      const R = J.D.headR;
      J.arms.forEach((A, i) => {
        if (i === 1 && pumping) return;
        const s = i ? 1 : -1;
        KEY.set(HEAD.x + s * R * 1.45, HEAD.y + R * 0.1, HEAD.z - R * 1.25);
        POLE.set(s, 0.25, 0.15); S.ikArm(A, s, KEY, POLE);
      });
    };
    out.expr = pump > 0.1 ? "grin" : "proud";
  } else if (st === "idle" && pose === "stand") {
    out.expr = "happy";
  }
}

// Lounge: slouched ON the cushion, back on the backrest, knees over the front edge.
// Numbers are root-local (root faces +z): seat top, backrest front and where the arms rest.
const SEATS = {
  sofa: { top: 0.51, back: -0.28, hand: (s, q) => [s * 0.52, 1.06, q.back - 0.14], pole: (s) => [s * 0.3, 1, 0.1] },
  armchair: { top: 0.56, back: -0.24, hand: (s, q) => [s * 0.4, 0.8, q.back + 0.4], pole: (s) => [s, -0.3, -0.8] },
};
function loungePose(S, J, t, look, ctx, curl, head) {
  const seat = ctx.seat || { kind: "sofa", top: 0.51, back: -0.28, front: 0.32 }, K = SEATS[seat.kind], D = J.D;
  // Hips as far back as the backrest allows, but far enough forward that the knees clear the cushion edge.
  const backZ = seat.back + 0.3, kneeZ = seat.front + D.legR + 0.03 - D.thigh * 0.99;
  const hipZ = Math.max(backZ, kneeZ), slouch = (hipZ - backZ) / 0.42;
  const tilt = 0.35 + slouch * 0.5, sway = Math.sin(t * 0.6 + S.seed) * 0.02;
  const yaw = seat.yaw || 0; // body faces the seat even while the root is still turning in
  S.hipTarget.set(Math.sin(yaw) * hipZ, seat.top + D.waist * 0.8 - 0.005, Math.cos(yaw) * hipZ);
  S.set(J.hips, -tilt, yaw, 0, "YXZ");
  // C-curve slouch: pelvis rolls back, chest and head curl forward so the head stays off the backrest.
  S.set(J.spine, -0.1 - slouch * 0.3 + sway, 0, 0.03); S.set(J.chest, 0.12 + slouch * 0.25, look.yaw * 0.2, 0);
  J.legs.forEach((L, i) => {
    const s = i ? 1 : -1, bob = i ? Math.max(0, Math.sin(t * 1.4 + S.seed)) * 0.12 : 0; // one foot swings
    S.set(L.hip, -1.47 + tilt, s * 0.08, s * 0.1); S.set(L.knee, 0.6 + bob); S.set(L.ankle, -0.3);
  });
  J.arms.forEach((A, i) => { const s = i ? 1 : -1; S.set(A.wrist, 0.2, 0, s * 0.2); curl(A, 0.5); });
  head(0.2, 0, 0.08);
  return { expr: "relaxed", ik: () => J.arms.forEach((A, i) => {
    const s = i ? 1 : -1;
    if (seat.inner && s === seat.inner) { KEY.set(s * 0.14, seat.top + 0.3, hipZ + 0.18); POLE.set(s, -0.4, -0.4); } // lap
    else { KEY.set(...K.hand(s, seat)); POLE.set(...K.pole(s)); }
    KEY.applyAxisAngle(UP, yaw); POLE.applyAxisAngle(UP, yaw); S.ikArm(A, s, KEY, POLE);
  }) };
}
