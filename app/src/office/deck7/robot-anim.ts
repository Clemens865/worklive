import * as T from "three";
import { EMOTIONS, type Emotion, type RobotSpec } from "./robot-spec";
import type { Input } from "./util";
import type { FaceRig, FaceState } from "./robot-face";
import type { MouthRig } from "./robot-mouth";
import type { Fx } from "./robot-fx";
import { poseLimb, type Limb, type ArmPose } from "./robot-limbs";
import { EMO } from "./robot-emotions";

export interface RobotRig {
  spec: RobotSpec;
  root: T.Group;
  torso: T.Group;
  headG: T.Group; // sits on the neck; springs up when poked
  head: T.Group;
  face: FaceRig;
  mouth: MouthRig;
  arms: { limb: Limb; s: number }[];
  legs: { limb: Limb; s: number; foot: T.Group; group: T.Group }[];
  tops: T.Object3D[];
  fx: Fx;
  blobs: T.Mesh[];
}

class Spring {
  v = 0;
  constructor(public x = 0, public k = 120, public c = 12) {}
  step(target: number, dt: number) { this.v += ((target - this.x) * this.k - this.v * this.c) * dt; this.x += this.v * dt; return this.x; }
}

const hashStr = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
const FACE_KEYS = ["upper", "slant", "lower", "browY", "browAng", "smile", "open", "pupil", "lookX", "lookY"] as const;
const q = new T.Quaternion();

// Emotions blend through per-emotion weights, so switching state (working → error) eases instead of popping.
export function animateRobot(r: RobotRig) {
  const ph = hashStr(r.spec.id) * 100;
  const temper = r.spec.face.temper;
  const weight = Object.fromEntries(EMOTIONS.map(e => [e, new Spring(e === r.spec.emotion ? 1 : 0, 60, 15)])) as Record<Emotion, Spring>;
  const w = {} as Record<Emotion, number>;
  const yaw = new Spring(r.spec.yaw, 40, 9);
  const neck = new Spring(0, 160, 6), hop = new Spring(0, 90, 8), wobble = new Spring(0, 70, 3), surprise = new Spring(0, 30, 8);
  const lookX = new Spring(0, 160, 16), lookY = new Spring(0, 160, 16);
  const walk = new Spring(0, 60, 14);
  let blinkAt = 1 + (ph % 3), blink = 0, lastPoke = 0, saccAt = 0;
  const sacc = new T.Vector2();
  const tilt0 = r.head.rotation.z, hipY = r.torso.position.y, headY0 = r.headG.position.y;
  const face = {} as FaceState;

  return (dtIn: number, t: number, input: Input) => {
    const dt = Math.min(dtIn, 1 / 30);
    const tt = t + ph;
    const still = !!input.still;
    const cur = (input.emotion ?? r.spec.emotion) as Emotion;
    let sum = 0;
    for (const e of EMOTIONS) { w[e] = Math.max(0, still ? (e === cur ? 1 : 0) : weight[e].step(e === cur ? 1 : 0, dt)); sum += w[e]; }
    for (const e of EMOTIONS) w[e] /= sum || 1;

    if (input.poke !== lastPoke) { lastPoke = input.poke; hop.v += 3; neck.v += 2.4; wobble.v += 9; surprise.x = 1; }
    const hy = Math.max(0, hop.step(0, dt));
    if (hop.x < 0) { hop.x = 0; if (hop.v < -0.5) { neck.v += hop.v * 0.8; wobble.v -= hop.v * 3; } hop.v = 0; }
    const wide = surprise.step(0, dt);

    // --- face: weighted emotion faces + temper + surprise
    for (const k of FACE_KEYS) face[k] = 0;
    for (const e of EMOTIONS) {
      if (w[e] < 1e-3) continue;
      const f = EMO[e].face;
      for (const k of FACE_KEYS) face[k] += (f[k] ?? 0) * w[e];
    }
    const grump = temper * (1 - w.happy * 0.7);
    face.slant += grump * 0.35; face.browAng += grump * 0.4; face.upper += grump * 0.12; face.smile -= grump * 0.25;
    face.upper *= 1 - wide; face.lower *= 1 - wide; face.browY += wide * 0.4; face.open = Math.max(face.open, wide * 0.6);

    // --- body motion per emotion (summed by weight)
    const m = { bob: 0, lift: 0, swayZ: 0, leanX: 0, tilt: 0, nod: 0, turn: 0, legL: [0, 0] };
    const armAdd: ArmPose[] = r.arms.map(() => ({ z: 0, x: 0, bz: 0, bx: 0 }));
    if (!still) {
      const W = w;
      m.bob += Math.sin(tt * 2.4) * 0.006;
      // idle: look around now and then
      m.tilt += W.idle * Math.sin(tt * 0.6) * 0.04; m.turn += W.idle * Math.sin(tt * 0.37) * 0.25;
      // working: hunched in, typing fast, tiny head nods
      m.leanX += W.working * 0.12; m.nod += W.working * (0.12 + Math.sin(tt * 9) * 0.02);
      armAdd.forEach((a, i) => (a.bx += W.working * Math.sin(tt * 11 + i * Math.PI) * 0.22));
      // thinking: head tilt, tap the chin
      m.tilt += W.thinking * (0.18 + Math.sin(tt * 0.8) * 0.05); armAdd[1].bx += W.thinking * Math.max(0, Math.sin(tt * 5)) * 0.25;
      // waiting: lean back, tap a foot, sigh
      m.leanX -= W.waiting * 0.06; m.legL[1] += W.waiting * Math.max(0, Math.sin(tt * 6)) * 0.05; m.tilt += W.waiting * 0.08;
      m.bob += W.waiting * Math.max(0, Math.sin(tt * 0.9)) ** 8 * 0.04;
      // attention: bouncing on the toes, waving
      m.bob += W.attention * Math.abs(Math.sin(tt * 5)) * 0.05; m.leanX += W.attention * 0.06;
      armAdd[1].z += W.attention * Math.sin(tt * 8) * 0.35;
      // happy: jumping for joy
      m.lift += W.happy * Math.abs(Math.sin(tt * 4.5)) * 0.16; m.tilt += W.happy * Math.sin(tt * 4.5) * 0.08;
      armAdd.forEach((a, i) => (a.z += W.happy * Math.sin(tt * 9 + i) * 0.2));
      // angry: vibrating with rage, stomping, shaking fists
      m.swayZ += W.angry * Math.sin(tt * 38) * 0.02; m.leanX += W.angry * 0.1;
      const st = (tt * 2) % 1;
      m.legL[Math.floor(tt * 2) % 2] += W.angry * (st < 0.3 ? Math.sin((st / 0.3) * Math.PI) * 0.12 : 0);
      m.bob -= W.angry * (st > 0.28 && st < 0.36 ? 0.03 : 0);
      armAdd.forEach((a, i) => (a.bx += W.angry * Math.sin(tt * 14 + i * 2) * 0.3));
      // sleepy: slumped, slow nod with a jerk awake
      const nodU = (tt * 0.25) % 1;
      m.leanX += W.sleepy * 0.1; m.nod += W.sleepy * (nodU < 0.85 ? nodU / 0.85 : (1 - nodU) / 0.15) * 0.35; m.swayZ += W.sleepy * Math.sin(tt * 0.5) * 0.03;
      // walking (driven by the deck): clockwork stomp, arms swing, whole body rocks
      const wk = walk.step(input.walking ?? 0, dt);
      if (wk > 0.01) {
        const ph2 = t * 9;
        m.legL[0] = m.legL[0] * (1 - wk) + wk * Math.max(0, Math.sin(ph2)) * 0.11;
        m.legL[1] = m.legL[1] * (1 - wk) + wk * Math.max(0, -Math.sin(ph2)) * 0.11;
        m.bob += wk * Math.abs(Math.cos(ph2)) * 0.035;
        m.swayZ += wk * Math.sin(ph2) * 0.04;
        armAdd.forEach((a, i) => (a.x += wk * (i ? 1 : -1) * Math.sin(ph2) * 0.45));
      }
      // break activities: sip oil (arm to mouth), hockey (swat), stare (still, slow tilt)
      if (input.act === "sip") { const u = (t * 0.4) % 1, k = u < 0.3 ? Math.sin((u / 0.3) * Math.PI) : 0; armAdd[1].bx += k * 1.6; armAdd[1].x += k * 0.6; }
      if (input.act === "swat") { armAdd[1].z += Math.max(0, Math.sin(t * 7)) * 0.9; m.swayZ += Math.sin(t * 7) * 0.05; }
      if (input.act === "stare") { m.tilt += 0.12; m.turn = 0; }
      if (input.act === "dance") { // the robot: arms up and down in turns, hips (well, torso) swaying, little hops
        const beat = t * 4.4;
        armAdd.forEach((x, i) => { x.z += 1.2 + Math.sin(beat + i * Math.PI) * 0.9; x.bz += Math.sin(beat * 2 + i) * 0.4; });
        m.swayZ += Math.sin(beat) * 0.12; m.tilt -= Math.sin(beat) * 0.14;
        m.lift += Math.max(0, Math.sin(beat * 2)) * 0.06;
        m.legL[0] = Math.max(m.legL[0], Math.max(0, Math.sin(beat)) * 0.07); m.legL[1] = Math.max(m.legL[1], Math.max(0, -Math.sin(beat)) * 0.07);
      }
      if (input.act === "rake") { // raking the screw garden: both hands forward, slow sweeps
        const sw = Math.sin(t * 1.6);
        armAdd.forEach(x => { x.x += 0.9 + sw * 0.25; x.bx += 0.5; x.z += sw * 0.15; });
        m.leanX += 0.12; m.turn = sw * 0.15;
      }
      if (input.act === "mash") { // gamepad in both hands, thumbs going wild
        armAdd.forEach((x, i) => { x.x += 0.7; x.bx += 1.0 + Math.sin(t * 22 + i * 1.7) * 0.18; x.z -= 0.15; });
        m.leanX += 0.08 + Math.sin(t * 3) * 0.03; m.tilt += Math.sin(t * 2.2) * 0.06;
      }
      if (input.act === "kick") { m.legL[1] = 0.24; m.leanX -= 0.08; armAdd[0].z += 0.6; } // one big swing
    }

    r.root.position.y = hy + m.lift;
    r.torso.position.y = hipY + m.bob;
    r.torso.rotation.set(m.leanX, 0, m.swayZ);
    r.headG.position.y = headY0 + neck.step(0, dt) * 0.09;

    const lx = still ? 0 : input.hover ? input.look.x : 0;
    const ly = still ? 0 : input.hover ? input.look.y : 0;
    r.root.rotation.y = yaw.step(r.spec.yaw * (input.hover ? 0.4 : 1) + lx * 0.35, dt);
    const faceUp = (input.camElev ?? 0) * 0.32 * (1 - w.sleepy * 0.6 - w.working * 0.5);
    r.head.rotation.set(m.nod - ly * 0.15 - m.leanX * 0.5 - faceUp, lx * 0.35 + m.turn * (input.hover ? 0 : 1), tilt0 + m.tilt - m.swayZ * 0.6);

    // --- eyes: emotion gaze, pointer, saccades, blinks
    if (still) sacc.set(0, 0);
    else if (t > saccAt) { sacc.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.2); saccAt = t + 0.5 + Math.random() * 1.8; }
    face.lookX = lookX.step(T.MathUtils.clamp(face.lookX + lx * 0.8 + sacc.x, -0.8, 0.8), dt);
    face.lookY = lookY.step(T.MathUtils.clamp(face.lookY + ly * 0.8 + sacc.y, -0.7, 0.7), dt);
    if (!still && t > blinkAt) { blink = 0.16; blinkAt = t + (Math.random() < 0.2 ? 0.3 : 2.2 + Math.random() * 3); }
    blink = Math.max(0, blink - dt);
    if (blink > 0) face.upper = Math.max(face.upper, 1 - Math.abs(blink - 0.08) / 0.08);
    face.upper = T.MathUtils.clamp(face.upper, 0, 1);
    r.face.apply(face);
    const talk = still ? 0 : w.angry * Math.abs(Math.sin(tt * 13)) * 0.35 + w.happy * Math.abs(Math.sin(tt * 6)) * 0.2;
    r.mouth.apply(face.smile, T.MathUtils.clamp(face.open - talk, 0, 1));

    // --- arms
    r.arms.forEach((a, i) => {
      const p: ArmPose = { z: 0, x: 0, bz: 0, bx: 0 };
      for (const e of EMOTIONS) if (w[e] > 1e-3) { const b = EMO[e].arms[i]; p.z += b.z * w[e]; p.x += b.x * w[e]; p.bz += b.bz * w[e]; p.bx += b.bx * w[e]; }
      poseLimb(a.limb, a.s, { z: p.z + armAdd[i].z, x: p.x + armAdd[i].x, bz: p.bz + armAdd[i].bz, bx: p.bx + armAdd[i].bx });
    });

    // --- legs: lift with a knee bend, boots stay level
    r.legs.forEach((l, i) => {
      const lift = m.legL[i];
      l.group.position.y = hipY + lift * 0.5;
      const [b0, b1, b2] = l.limb.bones;
      b0.rotation.set(-lift * 3, 0, 0);
      b1.rotation.set(lift * 5, 0, 0);
      b2.rotation.set(0, 0, 0);
      q.copy(b0.quaternion).multiply(b1.quaternion).multiply(b2.quaternion).invert();
      l.foot.quaternion.copy(q);
    });

    const wob = wobble.step(0, dt) + (still ? 0 : Math.sin(tt * 6) * (0.015 + w.happy * 0.05 + w.angry * 0.08));
    r.tops.forEach(o => o.rotation.set(wob * 0.05, 0, wob * 0.08));
    r.fx.update(dt, still ? 0.4 : tt, w, cur);

    const k = 1 / (1 + (hy + m.lift) * 2.5);
    r.blobs.forEach((b, i) => { b.position.y = 0.003 - hy - m.lift; b.scale.setScalar(k * (1 - m.legL[i] * 2)); });
  };
}
