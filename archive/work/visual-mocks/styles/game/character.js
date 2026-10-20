import * as T from "three";
import { PROVIDER } from "../../layout.js";
import { genome } from "./look.js";
import { buildSkeleton } from "./body.js";
import { buildFace } from "./face.js";
import { buildHair } from "./hair.js";
import { buildClothes } from "./clothes.js";
import { buildTrims, buildOuter, buildAccessories } from "./details.js";
import { createFaceRig } from "./expr.js";
import { createAnimator } from "./anim.js";
import { skin, phys, std } from "./materials.js";
import { mesh, cached, lathe } from "./geo.js";

function props(J) {
  const R = J.arms[1].hand.hand; // right hand
  const mug = new T.Group(); R.add(mug);
  mug.position.set(0, -0.065, 0.048); mug.rotation.z = Math.PI / 2;
  const ceramic = phys("#ece6da", { roughness: 0.25, clearcoat: 0.6 });
  mesh(lathe("mug", 0.1, [[0, 0.041], [0.9, 0.039], [1, 0.034]], { seg: 20, rows: 4 }), ceramic, mug, [0, 0.05, 0]);
  mesh(cached("coffee", () => new T.CircleGeometry(0.037, 18).rotateX(-Math.PI / 2)), std("#3b2416", { roughness: 0.2 }), mug, [0, 0.04, 0], { cast: false });
  mesh(cached("handle", () => new T.TorusGeometry(0.024, 0.007, 6, 12, Math.PI)), ceramic, mug, [0, 0.0, -0.043], { rot: [0, Math.PI / 2, -Math.PI / 2] });
  const phone = new T.Group(); R.add(phone); phone.position.set(0, -0.07, 0.022);
  mesh(cached("phone", () => new T.BoxGeometry(0.072, 0.15, 0.008)), phys("#1c1d20", { roughness: 0.3, metalness: 0.5, clearcoat: 1 }), phone);
  mesh(cached("phoneScr", () => new T.PlaneGeometry(0.064, 0.138)), new T.MeshBasicMaterial({ color: "#8fc4d8", toneMapped: false }), phone, [0, 0, 0.0045], { cast: false });
  return { mug, phone };
}

export function gameCharacter(agent, index) {
  const g = genome(agent);
  const provider = PROVIDER[agent.provider].color;
  const root = new T.Group(); root.name = "char-" + agent.id;
  const skinMat = skin(g.skin);
  const J = buildSkeleton(root, g, skinMat);
  const face = buildFace(J.headScale, g, skinMat, skin(g.skin, true));
  buildHair(J.headScale, g);
  const { shirtMat } = buildClothes(J, g, provider, skinMat);
  buildTrims(J, g, shirtMat);
  buildOuter(J, g);
  buildAccessories(J, g, face, provider);
  const P = props(J);
  const rig = createFaceRig(face, J, root, index);
  face.update = rig.update;
  const anim = createAnimator({ J, g, face, props: P, index, root, lookAngles: rig.lookAngles });
  let meshes = 0; root.traverse(o => { if (o.isMesh) meshes++; });
  root.userData.meshes = meshes;
  return {
    root, head: J.head, eyeAnchor: face.eyeAnchor, genome: g,
    update(t, dt, pose, ctx) { root.updateMatrixWorld(true); anim(t, dt, pose, ctx); },
  };
}
