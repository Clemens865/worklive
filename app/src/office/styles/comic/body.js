import * as T from "three";
import { toon, part } from "./toon.js";
import { limb, sphere, capsule, shoeGeo, soleGeo, lathe, torus } from "./shapes.js";

// Limbs and cartoon four-finger hands. Joints are Groups; meshes hang off them.

const SHORT = new Set(["tee", "polo"]);

export function dims(look) {
  const B = look.B;
  return {
    thigh: 0.28 * B.leg, shin: 0.27 * B.leg, ankle: 0.075,
    hipW: 0.085 * B.width, waist: 0.15 * B.width, belly: B.belly,
    spineH: 0.19 * B.height, chestH: 0.22 * B.height,
    shoulderW: 0.17 * B.width + 0.02, upper: 0.23 * B.height, fore: 0.21 * B.height,
    armR: 0.06 * (0.8 + B.width * 0.2), legR: 0.078 * B.width,
    headR: 0.215 * B.head, neck: 0.06,
  };
}

export function buildHand(parent, look, side) {
  const skin = toon(look.skinColor);
  const hand = new T.Group(); hand.scale.setScalar(1.3); parent.add(hand);
  part(sphere(16), skin, hand, { ink: 0.008, scale: [0.052, 0.058, 0.03], pos: [0, -0.045, 0] });
  const fingers = [];
  for (let i = 0; i < 3; i++) {
    const f = new T.Group(); f.position.set((i - 1) * 0.026, -0.088, 0.004); hand.add(f);
    part(capsule(0.014, 0.036), skin, f, { ink: 0.006, pos: [0, -0.026, 0] });
    fingers.push(f);
  }
  const thumb = new T.Group(); thumb.position.set(side * -0.045, -0.04, 0.02); thumb.rotation.set(0.4, 0, side * -0.7); hand.add(thumb);
  part(capsule(0.015, 0.03), skin, thumb, { ink: 0.006, pos: [0, -0.024, 0] });
  return { hand, fingers, thumb };
}

export function buildArm(chest, look, D, side) {
  const shirt = toon(look.shirt), skin = toon(look.skinColor);
  const short = SHORT.has(look.top);
  const shoulder = new T.Group(); shoulder.position.set(side * D.shoulderW, D.chestH - 0.05, 0); chest.add(shoulder);
  part(sphere(16), shirt, shoulder, { ink: 0.01, scale: D.armR * 1.35 });
  if (short) {
    part(limb(D.upper * 0.5, D.armR * 1.3, D.armR * 1.25, 0.05), shirt, shoulder, { ink: 0.01 });
    part(limb(D.upper, D.armR * 0.85, D.armR * 0.8), skin, shoulder, { ink: 0.009 });
  } else part(limb(D.upper, D.armR * 1.15, D.armR), shirt, shoulder, { ink: 0.01 });
  const elbow = new T.Group(); elbow.position.y = -D.upper; shoulder.add(elbow);
  if (short) part(limb(D.fore, D.armR * 0.8, D.armR * 0.62), skin, elbow, { ink: 0.009 });
  else {
    part(limb(D.fore, D.armR * 0.98, D.armR * 0.85), shirt, elbow, { ink: 0.01 });
    part(torus(1, 0.25), toon(look.top === "cardigan" ? look.shirt : look.shirt), elbow, { ink: 0.006, pos: [0, -D.fore + 0.01, 0], rot: [Math.PI / 2, 0, 0], scale: D.armR * 0.9 });
  }
  const wrist = new T.Group(); wrist.position.y = -D.fore - 0.02; elbow.add(wrist);
  const h = buildHand(wrist, look, side);
  return { shoulder, elbow, wrist, ...h };
}

export function buildLeg(hips, look, D, side) {
  const pants = toon(look.pantsColor);
  // Trouser leg: thigh and shin meet at the same radius, and a knee ball fills the gap between their rounded ends,
  // so the leg reads as one tube standing and stays closed when bent.
  const rKnee = D.legR * 0.97;
  const hip = new T.Group(); hip.position.set(side * D.hipW, 0, 0); hips.add(hip);
  part(limb(D.thigh, D.legR * 1.1, rKnee, 0.03), pants, hip, { ink: 0.011 });
  const knee = new T.Group(); knee.position.y = -D.thigh; hip.add(knee);
  part(sphere(16), pants, knee, { ink: 0, scale: rKnee });
  part(limb(D.shin, rKnee, D.legR * 0.9, 0.03), pants, knee, { ink: 0.011 });
  part(torus(1, 0.3), toon(look.pantsColor), knee, { ink: 0.006, pos: [0, -D.shin + 0.02, 0], rot: [Math.PI / 2, 0, 0], scale: D.legR * 0.95 });
  const ankle = new T.Group(); ankle.position.y = -D.shin - D.ankle; knee.add(ankle);
  const shoe = new T.Group(); ankle.add(shoe); shoe.scale.setScalar(1.15 + look.B.width * 0.1);
  part(shoeGeo(), toon(look.shoeColor), shoe, { ink: 0.01 });
  part(soleGeo(), toon("#f7f3ea"), shoe, { ink: 0.008 });
  part(sphere(10), toon("#f7f3ea"), shoe, { ink: 0, scale: [0.02, 0.012, 0.02], pos: [side * 0.04, 0.055, 0.02] });
  return { hip, knee, ankle };
}

// Pelvis (pants) with a belt.
export function buildPelvis(hips, look, D) {
  const pants = toon(look.pantsColor);
  // Wide enough to contain the tops of both thighs, so the legs grow out of the seat of the trousers instead of bulging past it.
  const w = D.waist, rx = Math.max(w * 1.02, D.hipW + D.legR * 1.1 + 0.006), sx = rx / (w * 1.02);
  part(lathe("pelvis" + w.toFixed(3), [[0.001, -0.12], [w * 0.7, -0.1], [w * 1.02, -0.04], [w * 1.02, 0.05], [w * 0.95, 0.1], [0.001, 0.1]], 20), pants, hips, { ink: 0.011, scale: [sx, 1, 0.78] });
  if (look.top !== "overalls") part(torus(1, 0.06), toon("#3b2a22"), hips, { ink: 0.005, pos: [0, 0.07, 0], rot: [Math.PI / 2, 0, 0], scale: [w * 0.98 * sx, w * 0.98 * 0.78, w] });
}
