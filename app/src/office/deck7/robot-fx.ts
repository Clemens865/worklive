import * as T from "three";
import type { Emotion, RobotFinish } from "./robot-spec";
import { outline } from "./robot-materials";

// Status signals that read from across the office: a status light (colour = agent state)
// and small cartoon props over the head: steam, Zzz, "!", thinking dots, sparkles, a sweat drop.

export const STATUS_COLOR: Record<Emotion, string> = {
  idle: "#8fa0b3", working: "#36d06c", thinking: "#4fa3ff", waiting: "#f5b335",
  attention: "#ff8a1f", happy: "#3fe07a", angry: "#ff3434", sleepy: "#7d6bff",
};

const flat = (color: string, finish: RobotFinish, opacity = 1) => finish === "cartoon"
  ? new T.MeshBasicMaterial({ color, transparent: opacity < 1, opacity })
  : new T.MeshStandardMaterial({ color, roughness: 0.4, transparent: true, opacity, emissive: color, emissiveIntensity: 0.25 });

function zShape(s: number) {
  const sh = new T.Shape();
  sh.moveTo(0, s); sh.lineTo(s, s); sh.lineTo(s, s * 0.8); sh.lineTo(s * 0.32, s * 0.2); sh.lineTo(s, s * 0.2);
  sh.lineTo(s, 0); sh.lineTo(0, 0); sh.lineTo(0, s * 0.2); sh.lineTo(s * 0.68, s * 0.8); sh.lineTo(0, s * 0.8);
  const g = new T.ExtrudeGeometry(sh, { depth: s * 0.18, bevelEnabled: false });
  g.translate(-s / 2, -s / 2, 0);
  return g;
}

function star(s: number) {
  const sh = new T.Shape();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? s * 0.32 : s;
    i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new T.ExtrudeGeometry(sh, { depth: s * 0.2, bevelEnabled: false });
}

export interface Fx { light: T.MeshStandardMaterial; update(dt: number, t: number, w: Record<Emotion, number>, e: Emotion): void; dispose(): void }

// top = height of the head top above the head group; steamAt = where steam leaves (chimney or ears)
export function buildFx(head: T.Group, top: number, headW: number, finish: RobotFinish, steamAt: T.Vector3[]): Fx {
  const geos: T.BufferGeometry[] = [];
  const mats: T.Material[] = [];
  const ink = finish === "cartoon" ? outline(0.012) : null;
  const add = (g: T.BufferGeometry, m: T.Material, parent: T.Object3D) => {
    geos.push(g); mats.push(m);
    const o = new T.Mesh(g, m);
    o.userData.keep = true; // animated
    if (ink) o.add(new T.Mesh(g, ink));
    parent.add(o);
    return o;
  };
  const light = new T.MeshStandardMaterial({ color: "#222", emissive: STATUS_COLOR.idle, emissiveIntensity: 1, roughness: 0.3 });
  mats.push(light);

  // "!" bubble
  const bang = new T.Group();
  bang.position.set(headW * 0.9, top + 0.38, 0);
  head.add(bang);
  const orange = flat("#ff8a1f", finish);
  add(new T.CapsuleGeometry(0.045, 0.16, 4, 10), orange, bang).position.y = 0.06;
  add(new T.SphereGeometry(0.05, 12, 8), orange, bang).position.y = -0.13;

  // Zzz
  const zs = [0, 1, 2].map(i => { const z = add(zShape(0.09 + i * 0.03), flat("#9d8cff", finish), head); z.userData.i = i; return z; });

  // thinking dots
  const dots = [0, 1, 2].map(i => { const d = add(new T.SphereGeometry(0.045, 12, 8), flat("#4fa3ff", finish), head); d.position.set(-0.12 + i * 0.12, top + 0.25, 0); return d; });

  // sparkles
  const stars = [0, 1, 2].map(i => add(star(0.07 - i * 0.012), flat("#ffd23f", finish), head));

  // steam puffs (several per vent)
  const puffs: { m: T.Mesh; at: T.Vector3; ph: number }[] = [];
  steamAt.forEach((at, k) => { for (let i = 0; i < 3; i++) puffs.push({ m: add(new T.SphereGeometry(0.07, 14, 10), flat("#f4f4f2", finish, 0.9), head), at, ph: i / 3 + k * 0.17 }); });

  // sweat drop
  const drop = new T.Group();
  head.add(drop);
  const blue = flat("#7cc8ff", finish);
  add(new T.SphereGeometry(0.045, 14, 10), blue, drop);
  add(new T.ConeGeometry(0.044, 0.08, 14), blue, drop).position.y = 0.05;
  drop.position.set(-headW * 1.02, top * 0.75, 0.1);

  const show = (o: T.Object3D, k: number) => { o.visible = k > 0.02; o.scale.setScalar(Math.max(1e-3, k)); };
  let blinkPh = 0;

  return {
    light,
    update(dt, t, w, e) {
      // status light: colour by state, rhythm by urgency
      blinkPh += dt;
      const rate = e === "angry" ? 5 : e === "attention" ? 3 : e === "working" ? 1.6 : e === "thinking" ? 2.2 : e === "waiting" ? 0.8 : 0.4;
      const pulse = e === "happy" ? 1 : e === "sleepy" ? 0.35 + 0.2 * Math.sin(t * 1.2) : e === "idle" ? 0.5 : 0.55 + 0.45 * Math.sin(blinkPh * rate * Math.PI * 2);
      light.emissive.lerp(new T.Color(STATUS_COLOR[e]), Math.min(1, dt * 6));
      light.emissiveIntensity = 0.4 + pulse * 1.6;

      const pop = (k: number) => T.MathUtils.smoothstep(k, 0, 1);
      show(bang, pop(w.attention) * (1 + Math.sin(t * 8) * 0.06));
      bang.position.y = top + 0.38 + Math.abs(Math.sin(t * 4)) * 0.05;
      bang.rotation.z = Math.sin(t * 6) * 0.15;

      zs.forEach(z => {
        const u = (t * 0.35 + z.userData.i / 3) % 1;
        show(z, pop(w.sleepy) * Math.sin(u * Math.PI));
        z.position.set(headW * 0.5 + u * 0.35, top + 0.1 + u * 0.55, 0);
        z.rotation.z = -0.2 + Math.sin(t + z.userData.i) * 0.2;
      });
      dots.forEach((d, i) => { show(d, pop(w.thinking)); d.position.y = top + 0.25 + Math.max(0, Math.sin(t * 6 - i * 0.9)) * 0.08; });
      stars.forEach((s, i) => {
        const a = t * 1.5 + (i * Math.PI * 2) / 3;
        show(s, pop(w.happy) * (0.7 + 0.3 * Math.sin(t * 7 + i * 2)));
        s.position.set(Math.cos(a) * headW * 1.5, top * 0.6 + Math.sin(a * 1.3) * 0.2, Math.sin(a) * 0.3 + 0.2);
        s.rotation.z = t * 2 + i;
      });
      puffs.forEach(p => {
        const u = (t * 1.3 + p.ph) % 1;
        show(p.m, pop(w.angry) * (0.5 + u * 1.3) * (1 - u * u));
        p.m.position.set(p.at.x * (1 + u * 0.6), p.at.y + u * 0.45, p.at.z);
      });
      show(drop, pop(w.waiting));
      drop.position.y = top * 0.75 - ((t * 0.5) % 1) * 0.15;
    },
    dispose() { geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); },
  };
}
