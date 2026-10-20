import * as T from "three";
import { canGeo, bulbGeo, domeGeo, boxGeo, BULB_PB, BULB_PT } from "./robot-geo";
import { shell, outline } from "./robot-materials";
import { blobTexture } from "./util";
import type { RobotSpec, RobotFinish } from "./robot-spec";
import type { Creature, Input } from "./util";
import { hoseLimb, buildHand } from "./robot-limbs";
import { buildFace } from "./robot-face";
import { buildMouth } from "./robot-mouth";
import { buildFx } from "./robot-fx";
import { animateRobot, type RobotRig } from "./robot-anim";
import { mergeStatic } from "./robot-optimize";

const darker = (c: string, k: number) => "#" + new T.Color(c).multiplyScalar(k).getHexString();

export function buildRobot(spec: RobotSpec, finish: RobotFinish): Creature {
  const geos: T.BufferGeometry[] = [];
  const toon = finish === "cartoon";
  const ink = toon ? outline(0.024) : null;
  const mesh = (g: T.BufferGeometry, m: T.Material, parent: T.Object3D, line = true) => {
    geos.push(g);
    const o = new T.Mesh(g, m);
    o.castShadow = true;
    o.receiveShadow = !toon; // cel shading makes its own light bands; self-shadows only add noise
    parent.add(o);
    if (ink && line) o.add(new T.Mesh(g, ink));
    return o;
  };
  const metal = shell(spec.metal, finish);
  const trim = shell(spec.trim, finish);
  const B = spec.body, H = spec.head, A = spec.arms, Lg = spec.legs;

  const root = new T.Group();
  const hipY = Lg.len + Lg.foot * 0.45;
  const torso = new T.Group(); // pivot at the hips: leans, bobs, stomps
  torso.position.y = hipY;
  root.add(torso);

  // --- body
  const rb = B.w * (1 + B.taper);
  const base = -0.08;
  const radiusAt = (y: number) => {
    const u = T.MathUtils.clamp((y - base) / B.h, 0, 1);
    if (B.shape === "box") return B.w;
    if (B.shape === "barrel") return rb + (B.w - rb) * u;
    const m = 2 * u - 1, a = Math.sign(m) * Math.asin(Math.pow(Math.abs(m), 1 / 0.9)); // invert the bulb profile
    return rb * 1.05 * Math.pow(Math.cos(a), a < 0 ? BULB_PB : BULB_PT);
  };
  const zAt = (y: number) => (B.shape === "box" ? B.d : radiusAt(y) * (B.d / B.w));
  if (B.shape === "box") mesh(boxGeo(B.w * 2, B.h, B.d * 2, 0.22), metal, torso).position.y = base + B.h / 2;
  else {
    const b = mesh(B.shape === "bulb" ? bulbGeo(rb * 1.05, B.h) : canGeo(rb, B.w, B.h, 0.12, B.w * 0.04), metal, torso);
    b.position.y = base;
    b.scale.z = B.d / B.w;
  }
  const top = base + B.h;
  if (B.shape === "barrel") {
    const collar = mesh(new T.TorusGeometry(B.w * 0.9, 0.045, 8, 40), trim, torso);
    collar.rotation.x = Math.PI / 2;
    collar.scale.y = B.d / B.w;
    collar.position.y = top - 0.03;
  }
  if (B.hatch) {
    const hy = base + B.h * 0.4;
    mesh(boxGeo(B.w * 0.8, B.h * 0.4, 0.12, 0.07), shell(darker(spec.metal, 0.86), finish), torso).position.set(0, hy, zAt(hy) - 0.035);
    mesh(new T.SphereGeometry(0.04, 16, 12), trim, torso).position.set(B.w * 0.28, hy, zAt(hy) + 0.03);
  }

  // --- head on a springy neck
  const headG = new T.Group();
  headG.position.y = top;
  torso.add(headG);
  const head = new T.Group();
  head.position.y = H.neck;
  head.rotation.z = H.tilt;
  headG.add(head);
  const neckR = Math.min(B.w, H.w) * 0.32;
  if (H.neck > 0.01) mesh(canGeo(neckR, neckR * 0.9, H.neck + 0.08, 0.03), trim, headG).position.y = -0.06;
  if (H.shape === "box") mesh(boxGeo(H.w * 2, H.h, H.w * 1.8, 0.16), metal, head).position.y = H.h / 2;
  else if (H.shape === "bulb") { const m = mesh(new T.SphereGeometry(H.w, 40, 28), metal, head); m.scale.y = H.h / (2 * H.w); m.position.y = H.h / 2; }
  else if (H.shape === "dome") mesh(domeGeo(H.w, H.h * 0.55, H.h * 0.45), metal, head);
  else mesh(canGeo(H.w, H.w * 0.94, H.h, 0.1), metal, head);
  const front = H.shape === "box" ? H.w * 0.9 : H.w;
  // radius of a round head at height y, so face parts sit on the surface instead of floating
  const headR = (y: number) => {
    if (H.shape === "dome") { const c = H.h * 0.55; return y <= c ? H.w : H.w * Math.sqrt(Math.max(0, 1 - ((y - c) / (H.h * 0.45)) ** 2)); }
    if (H.shape === "bulb") return H.w * Math.sqrt(Math.max(0, 1 - ((y - H.h / 2) / (H.h / 2)) ** 2));
    if (H.shape === "can") return H.w * (1 - 0.06 * T.MathUtils.clamp(y / H.h, 0, 1));
    return front;
  };
  const vy = H.shape === "dome" ? H.h * 0.42 : H.h * 0.6;

  // status props + light (the light material is shared by the chest lamp and the head top)
  const P = spec.top;
  const fxTop = H.h + (P.kind === "antenna" ? P.h + 0.1 : P.kind === "none" ? 0 : 0.2);
  const steamAt = P.kind === "chimney"
    ? [new T.Vector3(H.w * 0.45, H.h + P.h + 0.05, -0.05)]
    : [new T.Vector3(-H.w * 1.05, H.h * 0.55, 0), new T.Vector3(H.w * 1.05, H.h * 0.55, 0)];
  const fx = buildFx(head, fxTop, H.w, finish, steamAt);

  // chest status lamp, which every robot carries
  const ly = base + B.h * (B.hatch ? 0.74 : 0.62);
  const lampX = B.hatch ? -B.w * 0.3 : 0;
  const rim = mesh(new T.CylinderGeometry(0.1, 0.11, 0.06, 24), trim, torso);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(lampX, ly, zAt(ly) - 0.005);
  const lamp = mesh(new T.SphereGeometry(0.07, 20, 14), fx.light, torso, false);
  lamp.position.set(lampX, ly, zAt(ly) + 0.02);
  lamp.scale.z = 0.6;

  // --- face
  const face = buildFace(spec, finish, head, front, vy, mesh, headR);
  const F = spec.face;
  const visorBottom = vy - (F.visor === "porthole" && F.eyes === 2 ? F.spread + F.eye * 1.45 : F.eye * 1.45);
  const my = Math.max(spec.mouth.h / 2 + 0.07, visorBottom - 0.07 - spec.mouth.h / 2);
  const mouthR = H.shape === "box" ? Infinity : headR(my);
  const mouth = buildMouth(spec, finish, mouthR);
  geos.push(mouth.mesh.geometry);
  mouth.mesh.position.set(0, my, (H.shape === "box" ? front : mouthR) + 0.005);
  head.add(mouth.mesh);

  // --- head top
  const tops: T.Object3D[] = [];
  if (P.kind !== "none") {
    const g = new T.Group();
    g.position.y = H.h - 0.02;
    head.add(g);
    tops.push(g);
    if (P.kind === "antenna") {
      mesh(canGeo(0.07, 0.022, P.h * 0.25, 0.02), trim, g);
      mesh(canGeo(0.022, 0.018, P.h, 0.01), trim, g);
      mesh(new T.SphereGeometry(0.075, 24, 16), fx.light, g).position.y = P.h + 0.05;
    } else if (P.kind === "lamp") {
      mesh(canGeo(0.16, 0.14, 0.08, 0.02), trim, g);
      mesh(new T.SphereGeometry(0.12, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), fx.light, g).position.y = 0.07;
    } else if (P.kind === "chimney") {
      g.position.x = H.w * 0.45;
      mesh(canGeo(0.075, 0.085, P.h, 0.02), trim, g);
      const lip = mesh(new T.TorusGeometry(0.085, 0.028, 10, 24), trim, g);
      lip.rotation.x = Math.PI / 2;
      lip.position.y = P.h;
    } else {
      mesh(canGeo(0.022, 0.018, P.h, 0.01), trim, g);
      const dish = mesh(canGeo(0.03, 0.2, 0.08, 0.01), trim, g);
      dish.position.y = P.h;
      dish.rotation.x = -0.5;
    }
  }

  // --- arms (skinned hoses)
  const arms: RobotRig["arms"] = [];
  const shY = top - 0.24;
  const shR = radiusAt(shY);
  // hanging hands must clear the ground: limit the hose to the shoulder height minus the hand
  const handLen = A.hand === "claw" ? A.r * 4.2 : A.r * 3.6;
  const armLen = Math.max(0.3, Math.min(A.len, hipY + shY - handLen - Lg.foot * 0.9));
  for (const s of [-1, 1]) {
    const g = new T.Group();
    g.position.set(s * (shR - A.r * 0.4), shY, 0);
    torso.add(g);
    mesh(new T.SphereGeometry(A.r * 1.5, 24, 16), trim, g);
    const limb = hoseLimb(armLen, A.r, metal, ink);
    geos.push(limb.mesh.geometry);
    g.add(limb.mesh);
    const hand = new T.Group();
    limb.end.add(hand);
    buildHand(hand, A.hand, A.r, s, mesh, metal, trim);
    // pull finger segments out of their pivot groups so the whole hand merges into ~2 meshes
    const nested: T.Mesh[] = [];
    hand.traverse(o => { if ((o as T.Mesh).isMesh && o.parent !== hand && !(o.parent as T.Mesh).isMesh) nested.push(o as T.Mesh); });
    nested.forEach(m => hand.attach(m));
    arms.push({ limb, s });
  }

  // --- legs (in the root, so feet stay planted while the torso moves)
  const legs: RobotRig["legs"] = [];
  const bootM = shell(darker(spec.trim, 0.8), finish);
  for (const s of [-1, 1]) {
    const g = new T.Group();
    g.position.set(s * Lg.stance * rb, hipY, 0);
    root.add(g);
    const limb = hoseLimb(Math.max(0.05, Lg.len), Lg.r, metal, ink, 3);
    geos.push(limb.mesh.geometry);
    limb.mesh.visible = Lg.len > 0.05;
    g.add(limb.mesh);
    const foot = new T.Group();
    limb.end.add(foot);
    const boot = mesh(domeGeo(Lg.foot, Lg.foot * 0.22, Lg.foot * 0.42, 0.04), bootM, foot);
    boot.position.set(s * 0.02, -Lg.foot * 0.45, Lg.foot * 0.25);
    boot.scale.z = 1.35;
    legs.push({ limb, s, foot, group: g });
  }

  // --- contact shadows
  const blobMat = new T.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.85 });
  const blobs: T.Mesh[] = [];
  for (const l of legs) {
    const b = new T.Mesh(new T.PlaneGeometry(Lg.foot * 2.8, Lg.foot * 3.6), blobMat);
    geos.push(b.geometry);
    b.rotation.x = -Math.PI / 2;
    b.position.set(l.group.position.x + l.s * 0.02, 0.003, Lg.foot * 0.25);
    b.renderOrder = -2;
    root.add(b);
    blobs.push(b);
  }

  mergeStatic(root, ink, geos);

  const rig: RobotRig = { spec, root, torso, headG, head, face, mouth, arms, legs, tops, fx, blobs };
  const update = animateRobot(rig);
  return {
    root,
    update: (dt: number, t: number, input: Input) => update(dt, t, input),
    dispose() { geos.forEach(g => g.dispose()); blobMat.dispose(); fx.dispose(); },
  };
}
