import * as T from "three";
import { hoseGeo } from "./robot-geo";

// Rubber-hose limbs: one corrugated tube skinned to a short bone chain, so a pose is just a few
// rotations and the hose bends smoothly. Cheap on the GPU (one draw call per limb).

export interface Limb { mesh: T.SkinnedMesh; bones: T.Bone[]; end: T.Bone }

export function hoseLimb(len: number, r: number, mat: T.Material, ink: T.Material | null, nb = 4): Limb {
  const top = r * 0.6; // tuck the open end into the shoulder ball
  const geo = hoseGeo(new T.LineCurve3(new T.Vector3(0, top, 0), new T.Vector3(0, -len, 0)), r, 0.12);
  const p = geo.attributes.position as T.BufferAttribute;
  const idx = new Uint16Array(p.count * 4), wts = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) {
    let t = T.MathUtils.clamp(-p.getY(i) / len, 0, 1) * (nb - 1);
    let k = Math.floor(t);
    if (k >= nb - 1) { k = nb - 2; t = nb - 1; }
    const w = t - k;
    idx[i * 4] = k; idx[i * 4 + 1] = k + 1;
    wts[i * 4] = 1 - w; wts[i * 4 + 1] = w;
  }
  geo.setAttribute("skinIndex", new T.Uint16BufferAttribute(idx, 4));
  geo.setAttribute("skinWeight", new T.Float32BufferAttribute(wts, 4));

  const bones: T.Bone[] = [];
  for (let i = 0; i < nb; i++) {
    const b = new T.Bone();
    if (i) { b.position.y = -len / (nb - 1); bones[i - 1].add(b); }
    bones.push(b);
  }
  const mesh = new T.SkinnedMesh(geo, mat);
  mesh.add(bones[0]);
  mesh.castShadow = true;
  mesh.frustumCulled = false; // bind-pose bounds don't cover raised arms
  const skel = new T.Skeleton(bones);
  mesh.bind(skel);
  if (ink) {
    const o = new T.SkinnedMesh(geo, ink);
    o.frustumCulled = false;
    mesh.add(o);
    o.bind(skel, mesh.bindMatrix);
  }
  return { mesh, bones, end: bones[nb - 1] };
}

// Arm pose: z = swing out to the side, x = swing forward, bz/bx = elbow bend (spread over the middle bones).
export interface ArmPose { z: number; x: number; bz: number; bx: number }

export function poseLimb(l: Limb, s: number, a: ArmPose) {
  const [b0, b1, b2, b3] = l.bones;
  b0.rotation.set(-a.x, 0, s * a.z);
  b1.rotation.set(-a.bx / 2, 0, s * a.bz / 2);
  b2.rotation.set(-a.bx / 2, 0, s * a.bz / 2);
  if (b3) b3.rotation.set(0, 0, 0);
}

export const lerpPose = (a: ArmPose, b: ArmPose, t: number): ArmPose =>
  ({ z: a.z + (b.z - a.z) * t, x: a.x + (b.x - a.x) * t, bz: a.bz + (b.bz - a.bz) * t, bx: a.bx + (b.bx - a.bx) * t });

// Hands hang off the last bone, pointing down -y.
export function buildHand(
  g: T.Object3D, kind: "claw" | "mitt" | "ball", r: number, s: number,
  mesh: (geo: T.BufferGeometry, m: T.Material, parent: T.Object3D) => T.Mesh, metal: T.Material, trim: T.Material,
) {
  const cuff = mesh(new T.CylinderGeometry(r * 1.3, r * 1.2, r * 0.8, 20), trim, g);
  cuff.position.y = -r * 0.2;
  if (kind === "ball") { mesh(new T.SphereGeometry(r * 1.75, 24, 16), metal, g).position.y = -r * 1.6; return; }
  if (kind === "mitt") {
    const m = mesh(new T.SphereGeometry(r * 1.8, 24, 16), metal, g);
    m.scale.set(1.05, 1.2, 0.62);
    m.position.y = -r * 1.9;
    const th = mesh(new T.SphereGeometry(r * 0.8, 16, 12), metal, g); // thumb
    th.position.set(s * r * 1.5, -r * 1.3, r * 0.3);
    return;
  }
  mesh(new T.SphereGeometry(r * 1.4, 24, 16), metal, g).position.y = -r * 1.1;
  for (let i = 0; i < 3; i++) {
    const f = new T.Group();
    f.position.y = -r * 1.6;
    f.rotation.y = (i / 3) * Math.PI * 2 + s * 0.5;
    g.add(f);
    const seg = new T.Group();
    seg.rotation.z = 0.45;
    f.add(seg);
    const finger = mesh(new T.CapsuleGeometry(r * 0.38, r * 1.4, 4, 10), metal, seg);
    finger.position.y = -r * 0.9;
    const tip = new T.Group();
    tip.position.y = -r * 1.7;
    tip.rotation.z = -0.8;
    seg.add(tip);
    mesh(new T.CapsuleGeometry(r * 0.34, r * 0.8, 4, 10), metal, tip).position.y = -r * 0.5;
  }
}
