import * as T from "three";
import { DIM } from "./body.js";
import { solveArm, handWorldQuat, wristLocal } from "./ik.js";

// Procedural animation: pose targets -> damped joint quaternions; arm IK for typing / mug / phone.
const E = new T.Euler(), Q = new T.Quaternion();
const qOf = (x = 0, y = 0, z = 0) => new T.Quaternion().setFromEuler(E.set(x, y, z));
const damp = (k, dt) => 1 - Math.exp(-k * dt);

export function createAnimator(c) {
  const { J, g, face, props, index } = c;
  const sc = g.height / 1.75;
  const st = { walk: index * 1.3, blink: 2 + index, blinkT: 0, sacc: 0, saccT: 1, eye: new T.Vector2(), wave: 4 + index * 1.7, sip: index, hipsY: DIM.hipY, hipsZ: 0 };
  const ikOut = [{ sh: new T.Quaternion(), el: new T.Quaternion() }, { sh: new T.Quaternion(), el: new T.Quaternion() }];
  const tgt = new T.Vector3(), pole = new T.Vector3(), hq = new T.Quaternion(), rq = new T.Quaternion(), wq = new T.Quaternion();
  const fv = new T.Vector3(), pv = new T.Vector3();
  const set = (obj, q, k) => obj.quaternion.slerp(q, k);

  // Local (root-space, metres) -> world.
  const W = (x, y, z) => c.root.localToWorld(new T.Vector3(x, y, z));
  const dirW = (x, y, z, v) => v.set(x, y, z).normalize().applyQuaternion(c.root.getWorldQuaternion(rq));

  function legsSeated(hipWorldY, reach, spread) {
    const yh = hipWorldY - 0.05 * sc, th = 1.32 + reach * 0.1, l1 = DIM.thigh * sc, l2 = DIM.shin * sc;
    const kneeY = yh - l1 * Math.cos(th), drop = kneeY - 0.075 * sc;
    const phi = Math.acos(Math.min(1, Math.max(-1, drop / l2))) * (1 + reach);
    return J.legs.map(L => ({ th: qOf(-th, L.s * spread * 0.5, L.s * spread), kn: qOf(th - phi), an: qOf(phi - 0.05) }));
  }

  return function update(t, dt, pose, ctx) {
    st.frames = (st.frames || 0) + 1; st.lastPose ??= pose;
    const snap = st.frames < 5 ? 1 : 0;
    const k = Math.max(snap, damp(pose === "walk" ? 16 : 7, dt)), kf = Math.max(snap, damp(14, dt));
    const status = ctx.status, seated = pose === "sit" || pose === "type" || pose === "lounge";
    const breathe = Math.sin(t * 1.55 + index) * 0.5 + 0.5;
    let hipsY = DIM.hipY, hipsZ = 0, hipsX = 0, hipsRot = [0, 0, 0], spine = [0, 0, 0], chest = [-0.02 * breathe, 0, 0], neck = [0, 0, 0], head = [0, 0, 0];
    let legs = null, arms = [null, null], ik = [null, null], curl = [0.35, 0.35], fingerTap = 0;
    if (pose === "walk") {
      st.walk += dt * 2 * Math.PI * 0.95;
      const p = st.walk;
      hipsY = DIM.hipY - 0.028 + 0.03 * Math.abs(Math.cos(p));
      hipsX = Math.sin(p) * 0.012;
      hipsRot = [0.04, Math.sin(p) * 0.13, Math.cos(p) * 0.035]; spine = [0.03, -Math.sin(p) * 0.08, -Math.cos(p) * 0.02]; chest[1] = -Math.sin(p) * 0.12;
      head = [0.04, Math.sin(p) * 0.06, 0];
      legs = J.legs.map((L, i) => {
        const ph = p + (i ? Math.PI : 0), th = -Math.sin(ph) * 0.46;
        const kn = 0.06 + 1.1 * Math.max(0, Math.cos(ph + 0.45)) ** 2;
        const an = -(th + kn) * 0.85 - Math.max(0, Math.sin(ph)) * 0.2 + Math.max(0, -Math.sin(ph + 0.6)) * 0.35;
        return { th: qOf(th, 0, L.s * 0.02), kn: qOf(kn), an: qOf(an) };
      });
      arms = J.arms.map((A, i) => { const sw = Math.sin(p + (i ? Math.PI : 0)) * 0.38; return { sh: qOf(sw, 0, A.s * 0.1), el: qOf(-0.28 - Math.max(0, -sw) * 0.5), wr: qOf(0, -A.s * Math.PI / 2 + A.s * 0.1, 0) }; });
      curl = [0.5, 0.5];
    } else if (seated) {
      const lounge = pose === "lounge";
      hipsY = ((lounge ? 0.47 : 0.52) + 0.085) / sc; hipsZ = (lounge ? -0.2 : -0.03) / sc;
      const lean = pose === "type" ? 0.14 : status === "review" ? -0.2 : lounge ? -0.34 : -0.05;
      hipsRot = [lean * 0.4, 0, 0]; spine = [lean * 0.5 + 0.015 * breathe, 0, 0]; chest[0] += lean * 0.3;
      head = [pose === "type" ? 0.08 : lounge ? 0.42 : 0.05, 0, 0];
      legs = legsSeated(hipsY * sc, lounge ? 0.35 : 0.05, lounge ? 0.18 : 0.1);
      if (pose === "type") {
        fingerTap = 1;
        for (const [i, A] of J.arms.entries()) {
          const tapX = Math.sin(t * 2.3 + i * 1.7) * 0.02;
          ik[i] = { target: W(A.s * 0.115 + tapX, 0.815 + Math.abs(Math.sin(t * 9 + i)) * 0.008, 0.36), pole: W(A.s * 0.5, 0.6, -0.3),
            fingers: dirW(-A.s * 0.12, -0.35, 1, fv).clone(), palm: dirW(-A.s * 0.15, -1, 0.1, pv).clone() };
        }
      } else if (lounge) {
        const A = J.arms[1];
        ik[1] = { target: W(-0.06, 1.0, 0.3), pole: W(-0.6, 0.4, -0.2), fingers: dirW(0.4, 0.5, 0.6, fv).clone(), palm: dirW(0.1, 0.55, -0.8, pv).clone() };
        arms[0] = { sh: qOf(-0.25, 0, 0.55), el: qOf(-0.9, 0, 0), wr: qOf(0, -Math.PI / 2, 0) };
        curl = [0.4, 0.55];
      } else {
        for (const [i, A] of J.arms.entries()) arms[i] = { sh: qOf(-0.35, 0, A.s * 0.12), el: qOf(-0.95, 0, -A.s * 0.35), wr: qOf(0.1, -A.s * 1.2, 0) };
      }
    } else if (pose === "coffee") {
      st.sip += dt; const cyc = (st.sip % 7) / 7, sip = cyc > 0.7 && cyc < 0.92 ? Math.sin((cyc - 0.7) / 0.22 * Math.PI) : 0;
      hipsX = 0.02; hipsRot = [0, 0, 0.03]; head = [0.05 - sip * 0.25, 0, 0];
      legs = J.legs.map((L, i) => ({ th: qOf(i ? -0.05 : 0.03, 0, L.s * 0.05), kn: qOf(i ? 0.12 : 0.02), an: qOf(i ? -0.07 : -0.05) }));
      const mouthY = (DIM.hipY + DIM.spine + DIM.chest + DIM.neck + DIM.head + 0.06) * sc;
      ik[1] = { target: W(-0.07 + sip * 0.04, 1.02 * sc + (mouthY - 0.22 * sc - 1.02 * sc) * sip, 0.25 - sip * 0.1), pole: W(-0.6, 0.3, -0.5),
        fingers: dirW(0.8, 0.1 * sip, 0.6, fv).clone(), palm: dirW(1, 0, -0.6, pv).clone() };
      arms[0] = { sh: qOf(0.05, 0, 0.1), el: qOf(-0.2), wr: qOf(0, -Math.PI / 2, 0) };
      curl = [0.4, 1.05];
    } else {
      const sway = Math.sin(t * 0.35 + index);
      hipsX = sway * 0.018; hipsRot = [0, sway * 0.03, sway * 0.025]; spine = [0.01 * breathe, 0, -sway * 0.02];
      legs = J.legs.map((L) => ({ th: qOf(0.0, 0, L.s * 0.04 - sway * 0.025), kn: qOf(0.03 + Math.max(0, sway * L.s) * 0.08), an: qOf(-0.03) }));
      for (const [i, A] of J.arms.entries()) arms[i] = { sh: qOf(0.04 + breathe * 0.02, 0, A.s * 0.1), el: qOf(-0.14), wr: qOf(0, -A.s * Math.PI / 2 + A.s * 0.15, 0) };
    }
    // Needs attention: occasional wave (not while typing hands are needed? we wave anyway).
    st.wave -= dt;
    const waving = status === "needs" && st.wave < 2.2 && pose !== "walk";
    if (st.wave < 0) st.wave = 5 + (index % 3);
    if (waving) { ik[1] = null; const w = Math.sin(t * 9) * 0.35; arms[1] = { sh: qOf(-0.4, 0, -2.45), el: qOf(-0.4, 0, -1.0 + w), wr: qOf(0, Math.PI / 2, 0) }; curl[1] = 0.05; }
    c.face.update(t, dt, status, ctx, st, pose, waving);

    // Apply torso.
    st.hipsY += (hipsY - st.hipsY) * k; st.hipsZ += (hipsZ - st.hipsZ) * k;
    J.hips.position.set(hipsX, st.hipsY, st.hipsZ);
    set(J.hips, qOf(...hipsRot), k); set(J.spine, qOf(...spine), k); set(J.chest, qOf(...chest), k);
    const look = c.lookAngles(ctx, pose);
    const kl = Math.max(snap, kf * 0.6);
    set(J.neck, qOf(neck[0] + look.pitch * 0.4, look.yaw * 0.4, 0), kl); set(J.head, qOf(head[0] + look.pitch * 0.6, head[1] + look.yaw * 0.6, 0), kl);
    if (legs) for (const [i, L] of J.legs.entries()) { set(L.th, legs[i].th, k); set(L.kn, legs[i].kn, k); set(L.an, legs[i].an, k); }
    c.root.updateMatrixWorld(true);
    for (const [i, A] of J.arms.entries()) {
      if (ik[i]) {
        const o = solveArm(A, ik[i].target, ik[i].pole, DIM.upper * sc, DIM.fore * sc, ikOut[i]);
        set(A.sh, o.sh, k); set(A.el, o.el, k);
        handWorldQuat(ik[i].fingers, ik[i].palm, hq); set(A.wr, wristLocal(o.elWorld, hq, wq), k);
      } else if (arms[i]) { set(A.sh, arms[i].sh, k); set(A.el, arms[i].el, k); set(A.wr, arms[i].wr, k); }
      const h = A.hand;
      for (const [f, F] of h.fingers.entries()) {
        const tap = fingerTap ? Math.max(0, Math.sin(t * 11 + f * 1.9 + i * 2.6)) ** 3 * 0.45 : 0;
        const cv = -(curl[i] + f * 0.05 * curl[i]) - tap;
        set(F.base, Q.setFromEuler(E.set(cv, 0, 0)), kf); set(F.tip, Q.setFromEuler(E.set(cv * 1.2, 0, 0)), kf);
      }
      set(h.ttip, Q.setFromEuler(E.set(-curl[i] * 0.6, 0, 0)), kf);
    }
    props.mug.visible = pose === "coffee"; props.phone.visible = pose === "lounge";
  };
}
