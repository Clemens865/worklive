// Comic characters: hair, caps and headsets must stay outside the skin for every head shape.
// Rays go from the head centre outwards; wherever something covers the head, its outermost layer has to clear
// the skin by a small gap, otherwise the scalp pokes through (as on the "buzz" cut before 0.9.0).
import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { buildHair } from "../src/office/styles/comic/hair.js";
import { buildAccessories } from "../src/office/styles/comic/accessories.js";
import { deformHead } from "../src/office/styles/comic/shapes.js";
import { LOOK_OPTIONS } from "../src/office/styles/comic/looks.js";

const HEADS = ["round", "egg", "wide", "long", "square", "pear"];
const GAP = 0.012;            // in head units (head radius ≈ 0.215 m → about 2.5 mm)
const HAIR = LOOK_OPTIONS.hair;
const CAP_AXIS = new T.Vector3(0, Math.cos(-0.25), Math.sin(-0.25));
const SPOTS = 15;             // the seam where a curl or tuft passes through the skin gives a thin band (≤ 13); a bare-scalp patch was 45–207

function dressed(head, hair, wear) {
  const headS = new T.Group();
  const look = { head, hair, hairColorHex: "#5b3a29", accentColor: "#3b82f6", beard: null, moustache: false, glasses: null, headset: wear === "headset", cap: wear === "cap" };
  buildHair(headS, look);
  buildAccessories(headS, look);
  const meshes = [];
  headS.traverse(o => { if (o.isMesh && o.visible && !o.material.isShaderMaterial && !o.material.transparent) { o.material = o.material.clone(); o.material.side = T.DoubleSide; meshes.push(o); } });
  headS.updateMatrixWorld(true);
  return meshes;
}
// Directions over the upper head (where hair and hats live), golden-spiral sampled.
const DIRS = [];
for (let i = 0; i < 700; i++) {
  const y = 1 - (i / 699) * 1.2, r = Math.sqrt(1 - y * y), a = i * 2.39996;
  if (y > 0.15) DIRS.push(new T.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
}

function pokes(head, hair, wear) {
  const meshes = dressed(head, hair, wear), ray = new T.Raycaster(), bad = [];
  for (const d of DIRS) {
    const skin = deformHead(head, d.clone()).length();
    ray.set(new T.Vector3(), deformHead(head, d.clone()).normalize());
    const hits = ray.intersectObjects(meshes, false);
    // Poke-through: hair lies just under or on the skin (meant to cover it) and nothing covers that spot from outside.
    // Hair sunk deep inside the head is invisible and harmless; hair that crosses the skin is visible and fine.
    const outside = hits.some(h => h.distance >= skin + GAP);
    const nearSkin = hits.some(h => h.distance > skin - 0.03 && h.distance < skin + GAP);
    if (nearSkin && !outside) bad.push(d);
    // With a cap: no hair may come out through the cap dome.
    // (Only inside the dome, not at its rim where side hair may peek out; a ponytail through the back opening is intended.)
    const cap = hits.filter(h => h.object.userData.wear === "cap");
    if (cap.length && d.angleTo(CAP_AXIS) < Math.PI * 0.34 && hits.some(h => !h.object.userData.wear && !h.object.userData.throughCap && h.distance > Math.max(...cap.map(c => c.distance)) - 0.004)) bad.push(d);
  }
  return bad.length;
}

for (const head of HEADS) {
  test(`hair and headwear clear the skin on a ${head} head`, () => {
    const failures = [];
    for (const hair of HAIR) for (const wear of ["none", "cap", "headset"]) {
      const n = pokes(head, hair, wear);
      if (n > SPOTS) failures.push(`${hair}${wear === "none" ? "" : " + " + wear}: ${n} spots`);
    }
    assert.deepEqual(failures, [], "skin pokes through:\n" + failures.join("\n"));
  });
}

test("pieces tucked under a cap are removed, not just hidden (the character merge bakes hidden meshes in)", () => {
  for (const hair of HAIR) {
    const headS = new T.Group(), look = { head: "round", hair, hairColorHex: "#555", accentColor: "#3b82f6", cap: true };
    buildHair(headS, look); buildAccessories(headS, look);
    let hidden = 0; headS.traverse(o => { if (!o.visible) hidden++; });
    assert.equal(hidden, 0, hair);
  }
});
