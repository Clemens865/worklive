import * as T from "three";
import { toon, part, withFinish } from "./toon.js";
import { headGeo, limb } from "./shapes.js";
import { lookFor } from "./looks.js";
import { dims, buildArm, buildLeg, buildPelvis } from "./body.js";
import { buildTorso } from "./clothes.js";
import { buildFace, surfaceOf } from "./face.js";
import { buildHair } from "./hair.js";
import { buildAccessories } from "./accessories.js";
import { createAnimator } from "./anim.js";
import { mergePerGroup } from "./merge.js";
import { makeProbes } from "./probes.js";

// Joint hierarchy: root > hips > spine > chest > neck > head, chest > shoulders > elbows > wrists,
// hips > thighs > knees > ankles. All meshes are toon + inverted-hull ink.
// The finish (comic toon or clay) comes from the saved look; every part built inside uses it.
// opts.merge = false keeps every piece as its own mesh (fit checks read the tags on single pieces).
export function buildCharacter(agent, index, opts = {}) {
  const look = lookFor(agent);
  return withFinish(look.finish, () => build(agent, index, look, opts));
}
function build(agent, index, look, opts) {
  const D = dims(look);
  const root = new T.Group(); root.name = "comic-" + agent.id;
  const hipY = D.thigh + D.shin + D.ankle;
  const hips = new T.Group(); hips.position.y = hipY; root.add(hips);
  buildPelvis(hips, look, D);
  const spine = new T.Group(); spine.position.y = 0.06; hips.add(spine);
  const chest = new T.Group(); chest.position.y = D.spineH; spine.add(chest);
  const neck = buildTorso(spine, chest, look, D);
  part(limb(0.09, 0.05, 0.055, 0), toon(look.skinColor), neck, { ink: 0.008, pos: [0, 0.07, 0] });
  const head = new T.Group(); head.name = "head"; head.position.y = D.neck; neck.add(head);
  const headS = new T.Group(); headS.scale.setScalar(D.headR); headS.position.set(0, D.headR * 0.95, 0.01); head.add(headS);
  part(headGeo(look.head), toon(look.skinColor), headS, { ink: 0.012 }).userData.surface = "head";
  const face = buildFace(headS, look, surfaceOf(look.head, headGeo));
  buildHair(headS, look);
  buildAccessories(headS, look);

  const arms = [-1, 1].map(s => buildArm(chest, look, D, s));
  const legs = [-1, 1].map(s => buildLeg(hips, look, D, s));

  const J = { root, hips, spine, chest, neck, head, headS, arms, legs, hipY, D, look };
  const anim = createAnimator(J, face, agent, index);
  root.userData.probes = makeProbes(J); root.userData.agentId = agent.id;
  if (opts.merge !== false) mergePerGroup(root);
  let meshes = 0;
  root.traverse(o => {
    if (!o.isMesh) return;
    meshes++; o.receiveShadow = false;
    // Only big forms cast shadows (halves the shadow-pass draw calls)
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const s = new T.Vector3(); o.getWorldScale(s);
    if (o.material.isShaderMaterial || o.geometry.boundingSphere.radius * Math.max(s.x, s.y, s.z) < 0.07) o.castShadow = false;
  });
  root.userData.meshCount = meshes;
  return { root, head, hips, headS, eyeAnchor: face.eyeAnchor, update: anim.update, look };
}
