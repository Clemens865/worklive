import * as T from "three";
import { rbox, mat } from "./room.js";
import { PROVIDER } from "../../layout.js";

const SKIN = ["#e8c4a6", "#c99a78", "#8d5f45", "#f0d2bb", "#b27f5d", "#dcb08e"];
const HAIR = ["#2b2220", "#6b4a33", "#1b1b1b", "#b88a5a", "#3b2c24", "#8a8a8a"];

function capsule(r, len, m, parent) {
  const mesh = new T.Mesh(new T.CapsuleGeometry(r, len, 6, 16), typeof m === "string" ? mat(m) : m);
  mesh.castShadow = true; parent.add(mesh); return mesh;
}

// Style A character: adult proportions (~1.72 m), jointed limbs so it can sit, type and walk.
export function stylizedCharacter(agent, index) {
  const root = new T.Group();
  const shirt = new T.MeshStandardMaterial({ color: PROVIDER[agent.provider].color, roughness: 0.7 });
  const skin = mat(SKIN[index % SKIN.length], { roughness: 0.55 });
  const pants = mat(["#2f3a45", "#3a3530", "#4a4f55"][index % 3], { roughness: 0.8 });
  const shoe = mat("#f2f0ec", { roughness: 0.5 });

  const hips = new T.Group(); hips.position.y = 0.92; root.add(hips);
  const torso = new T.Group(); hips.add(torso);
  rbox(0.4, 0.2, 0.24, pants, 0, 0.02, 0, torso, 0.08);
  const chest = capsule(0.19, 0.3, shirt, torso); chest.position.y = 0.3; chest.scale.set(1.08, 1, 0.72);
  const neck = capsule(0.05, 0.05, skin, torso); neck.position.y = 0.58;
  const head = new T.Group(); head.position.y = 0.72; torso.add(head);
  const skull = new T.Mesh(new T.SphereGeometry(0.12, 28, 20), skin); skull.scale.set(0.92, 1.08, 1); skull.castShadow = true; head.add(skull);
  const hairMat = mat(HAIR[index % HAIR.length], { roughness: 0.7 });
  const hair = new T.Mesh(new T.SphereGeometry(0.128, 28, 16, 0, Math.PI * 2, 0, Math.PI * (index % 2 ? 0.55 : 0.48)), hairMat);
  hair.position.set(0, 0.012, -0.01); hair.rotation.x = -0.35; hair.scale.set(0.95, 1.08, 1.05); head.add(hair);
  if (index % 3 === 1) { const bun = new T.Mesh(new T.SphereGeometry(0.055, 16, 12), hairMat); bun.position.set(0, 0.08, -0.12); head.add(bun); }
  for (const s of [-1, 1]) {
    const eye = new T.Mesh(new T.SphereGeometry(0.014, 10, 8), mat("#1f2326")); eye.position.set(s * 0.042, 0.015, 0.108); head.add(eye);
  }
  const eyeAnchor = new T.Object3D(); eyeAnchor.position.set(0, 0.02, 0.1); head.add(eyeAnchor);

  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const shoulder = new T.Group(); shoulder.position.set(s * 0.25, 0.46, 0); torso.add(shoulder);
    capsule(0.058, 0.2, shirt, shoulder).position.y = -0.14;
    const elbow = new T.Group(); elbow.position.y = -0.29; shoulder.add(elbow);
    capsule(0.048, 0.2, skin, elbow).position.y = -0.13;
    const hand = new T.Mesh(new T.SphereGeometry(0.05, 12, 10), skin); hand.position.y = -0.27; hand.scale.set(0.8, 1, 0.6); elbow.add(hand);
    arms.push({ shoulder, elbow });

    const hip = new T.Group(); hip.position.set(s * 0.1, -0.02, 0); hips.add(hip);
    capsule(0.075, 0.34, pants, hip).position.y = -0.22;
    const knee = new T.Group(); knee.position.y = -0.44; hip.add(knee);
    capsule(0.062, 0.34, pants, knee).position.y = -0.2;
    rbox(0.11, 0.07, 0.24, shoe, 0, -0.43, 0.05, knee, 0.03);
    legs.push({ hip, knee });
  }

  let walkPhase = index;
  return {
    root, head, eyeAnchor, shirt,
    update(t, dt, pose) {
      walkPhase += dt * (pose === "walk" ? 7.5 : 0);
      const sit = pose === "sit" || pose === "type" || pose === "lounge";
      hips.position.y = sit ? 0.5 : 0.92 + (pose === "walk" ? Math.abs(Math.sin(walkPhase)) * 0.025 : 0);
      torso.rotation.x = pose === "type" ? 0.08 : pose === "lounge" ? -0.18 : 0;
      head.rotation.x = pose === "type" ? 0.12 : 0;
      head.rotation.y = pose === "type" ? Math.sin(t * 0.6 + index) * 0.12 : Math.sin(t * 0.4 + index) * 0.25;
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? 1 : -1, L = legs[i], A = arms[i];
        if (sit) {
          L.hip.rotation.x = -Math.PI / 2 + 0.08; L.knee.rotation.x = Math.PI / 2 - 0.05;
        } else if (pose === "walk") {
          L.hip.rotation.x = Math.sin(walkPhase + i * Math.PI) * 0.45;
          L.knee.rotation.x = Math.max(0, Math.sin(walkPhase + i * Math.PI + 1.2)) * 0.7;
        } else { L.hip.rotation.x = 0; L.knee.rotation.x = 0; }
        if (pose === "type") {
          A.shoulder.rotation.set(-0.7, 0, side * 0.3);
          A.elbow.rotation.set(-0.85 + Math.sin(t * 11 + i * 2.1) * 0.08, 0, side * 0.35);
        } else if (pose === "walk") {
          A.shoulder.rotation.set(Math.sin(walkPhase + i * Math.PI + Math.PI) * 0.4, 0, side * -0.06);
          A.elbow.rotation.set(-0.25, 0, 0);
        } else if (pose === "coffee" && i === 1) {
          A.shoulder.rotation.set(-0.4 - Math.max(0, Math.sin(t * 0.9)) * 0.6, 0, 0); A.elbow.rotation.set(-1.5, 0, 0);
        } else { A.shoulder.rotation.set(0, 0, side * -0.08); A.elbow.rotation.set(sit ? -0.6 : -0.1, 0, 0); }
      }
    },
  };
}
