import * as T from "three";
import { Kit, label } from "./kit";

// Junk the boss can throw onto the deck: it falls, bounces and rolls (tiny hand-rolled physics:
// gravity, friction, walls, furniture boxes, robots as round bumpers). Robots kick it around,
// the trash bin counts as a goal, and the janitor drone cleans it all up.

export const JUNK_KINDS = ["can", "paper", "duck", "pizza", "peel"] as const;
export type JunkKind = (typeof JUNK_KINDS)[number];
export const JUNK_LABEL: Record<JunkKind, string> = { can: "Oil can", paper: "Paper ball", duck: "Rubber duck", pizza: "Pizza box", peel: "Banana peel" };

// rolling things keep going, boxes and peels slide to a stop
const PHYS: Record<JunkKind, { r: number; friction: number; bounce: number }> = {
  can: { r: 0.13, friction: 1.25, bounce: 0.45 }, paper: { r: 0.12, friction: 1.8, bounce: 0.6 },
  duck: { r: 0.14, friction: 1.6, bounce: 0.7 }, pizza: { r: 0.24, friction: 3.2, bounce: 0.15 }, peel: { r: 0.14, friction: 0.8, bounce: 0.1 },
};

export interface Rect { x0: number; x1: number; z0: number; z1: number }

export class Junk {
  group = new T.Group();
  vel = new T.Vector3();
  r: number;
  gone = false;
  kickedBy = "";
  private spinAxis = new T.Vector3(1, 0, 0);
  constructor(public kind: JunkKind, kit: Kit, at: T.Vector3) {
    this.r = PHYS[kind].r;
    const g = this.group;
    if (kind === "can") {
      const c = kit.can(0.13, 0.13, 0.3, kit.paint("#c0462f"), g);
      c.position.y = -0.15;
      const l = kit.sign(0.4, 0.12, (cx, w, h) => label(cx, w, h, "OIL · LUKEWARM", { bg: "#f4f1ea" }), g, 128);
      l.position.set(0, 0, 0.135);
      g.rotation.z = Math.PI / 2; // lying down, ready to roll
    } else if (kind === "paper") {
      const p = kit.mesh(new T.IcosahedronGeometry(0.12, 1), kit.paint("#f4f1ea"), g);
      const pos = p.geometry.attributes.position as T.BufferAttribute;
      for (let i = 0; i < pos.count; i++) { const k = 0.8 + Math.random() * 0.35; pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k); }
      p.geometry.computeVertexNormals();
    } else if (kind === "duck") {
      const yel = kit.paint("#f2c94c");
      const b = kit.mesh(new T.SphereGeometry(0.13, 20, 14), yel, g);
      b.scale.set(1.15, 0.8, 0.9);
      const h = kit.mesh(new T.SphereGeometry(0.08, 16, 12), yel, g);
      h.position.set(0.08, 0.11, 0);
      const beak = kit.mesh(new T.ConeGeometry(0.035, 0.07, 10), kit.paint("#e07a3f"), g);
      beak.rotation.z = -Math.PI / 2;
      beak.position.set(0.17, 0.1, 0);
    } else if (kind === "pizza") {
      kit.box(0.48, 0.06, 0.48, kit.paint("#d9b98c"), g, 0.01);
      const s = kit.sign(0.36, 0.16, (cx, w, h) => label(cx, w, h, "PIZZA (OLD)", { fg: "#c0462f" }), g, 128);
      s.rotation.x = -Math.PI / 2;
      s.position.y = 0.032;
    } else {
      const m = kit.paint("#f2d14c");
      for (let i = 0; i < 4; i++) {
        const leaf = kit.mesh(new T.CapsuleGeometry(0.035, 0.16, 3, 8), m, g);
        leaf.rotation.set(Math.PI / 2 - 0.25, (i / 4) * Math.PI * 2, 0);
        leaf.position.set(Math.sin((i / 4) * Math.PI * 2) * 0.07, 0.02, Math.cos((i / 4) * Math.PI * 2) * 0.07);
      }
    }
    g.position.copy(at);
    g.position.y = 2.2; // dropped from above
    this.vel.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6);
  }

  kick(dir: T.Vector3, power: number, by: string) {
    this.vel.x = dir.x * power;
    this.vel.z = dir.z * power;
    this.vel.y = this.kind === "pizza" || this.kind === "peel" ? 0.6 : 1.8 + Math.random();
    this.kickedBy = by;
  }

  get resting() { return this.group.position.y <= this.r + 0.001 && this.vel.lengthSq() < 0.02; }

  step(dt: number, walls: Rect, boxes: Rect[], bumpers: T.Vector3[]) {
    const p = this.group.position, P = PHYS[this.kind];
    const floorY = this.kind === "pizza" ? 0.03 : this.kind === "peel" ? 0.03 : this.r;
    this.vel.y -= 9.8 * dt;
    p.addScaledVector(this.vel, dt);
    if (p.y < floorY) { p.y = floorY; this.vel.y = Math.abs(this.vel.y) > 0.6 ? -this.vel.y * P.bounce : 0; }
    // rolling friction on the floor
    if (p.y <= floorY + 0.001) { const k = Math.max(0, 1 - P.friction * dt); this.vel.x *= k; this.vel.z *= k; }
    // walls
    if (p.x < walls.x0 + this.r) { p.x = walls.x0 + this.r; this.vel.x = Math.abs(this.vel.x) * 0.6; }
    if (p.x > walls.x1 - this.r) { p.x = walls.x1 - this.r; this.vel.x = -Math.abs(this.vel.x) * 0.6; }
    if (p.z < walls.z0 + this.r) { p.z = walls.z0 + this.r; this.vel.z = Math.abs(this.vel.z) * 0.6; }
    if (p.z > walls.z1 - this.r) { p.z = walls.z1 - this.r; this.vel.z = -Math.abs(this.vel.z) * 0.6; }
    // furniture: push out of boxes along the shallowest side and reflect
    if (p.y < 1.0) for (const b of boxes) {
      if (p.x < b.x0 - this.r || p.x > b.x1 + this.r || p.z < b.z0 - this.r || p.z > b.z1 + this.r) continue;
      const dx0 = p.x - (b.x0 - this.r), dx1 = b.x1 + this.r - p.x, dz0 = p.z - (b.z0 - this.r), dz1 = b.z1 + this.r - p.z;
      const m = Math.min(dx0, dx1, dz0, dz1);
      if (m === dx0) { p.x -= dx0; this.vel.x = -Math.abs(this.vel.x) * 0.5; }
      else if (m === dx1) { p.x += dx1; this.vel.x = Math.abs(this.vel.x) * 0.5; }
      else if (m === dz0) { p.z -= dz0; this.vel.z = -Math.abs(this.vel.z) * 0.5; }
      else { p.z += dz1; this.vel.z = Math.abs(this.vel.z) * 0.5; }
    }
    // robots are round bumpers: walking into junk shoves it along
    for (const c of bumpers) {
      const d = new T.Vector3(p.x - c.x, 0, p.z - c.z);
      const dist = d.length(), R = 0.38 + this.r;
      if (dist >= R || dist < 1e-4) continue;
      d.multiplyScalar(1 / dist);
      p.x += d.x * (R - dist); p.z += d.z * (R - dist);
      const vn = this.vel.x * d.x + this.vel.z * d.z;
      if (vn < 0.8) { this.vel.x += d.x * (0.8 - vn); this.vel.z += d.z * (0.8 - vn); }
    }
    // spin with the motion (cans roll about their long axis, the rest tumbles)
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (speed > 0.01) {
      this.spinAxis.set(this.vel.z, 0, -this.vel.x).normalize();
      if (this.kind === "pizza" || this.kind === "peel") this.group.rotation.y += speed * dt * 2;
      else this.group.rotateOnWorldAxis(this.spinAxis, (speed / this.r) * dt * (this.kind === "can" ? 1 : 0.6));
    }
  }
}

// Trash bin: also the goal.
export function trashBin(kit: Kit) {
  const g = new T.Group();
  const body = kit.mesh(new T.CylinderGeometry(0.34, 0.28, 0.75, 24, 1, true), kit.paint("#5f7f6a"), g);
  body.position.y = 0.375;
  (body.material as T.Material).side = T.DoubleSide;
  kit.mesh(new T.TorusGeometry(0.34, 0.035, 8, 24), kit.paint("#3f4f57"), g).rotation.x = Math.PI / 2;
  g.children[g.children.length - 1].position.y = 0.75;
  kit.can(0.28, 0.28, 0.03, kit.paint("#3f4f57"), g);
  const s = kit.sign(0.5, 0.16, (c, w, h) => label(c, w, h, "GOAL / BIN", { bg: "#f4f1ea" }), g, 128);
  s.position.set(0, 0.45, 0.32);
  return g;
}

// Janitor drone: a grumbling disc that hoovers up junk, then goes home.
export class Janitor {
  group = new T.Group();
  target: Junk | null = null;
  home = new T.Vector3(-8.7, 0, 1.8);
  active = false;
  private brush: T.Object3D;
  private eye: T.Mesh;
  constructor(kit: Kit) {
    const g = this.group;
    kit.can(0.42, 0.38, 0.22, kit.paint("#f2c94c"), g).position.y = 0.06;
    const dome = kit.mesh(new T.SphereGeometry(0.26, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), kit.paint("#3f4f57"), g);
    dome.position.y = 0.27;
    this.eye = kit.mesh(new T.SphereGeometry(0.07, 14, 10), kit.glow("#ff5a4f"), g, { line: false });
    this.eye.position.set(0, 0.36, 0.2);
    this.brush = new T.Group();
    this.brush.position.set(0.3, 0.05, 0.3);
    g.add(this.brush);
    for (let i = 0; i < 6; i++) { const b = kit.box(0.24, 0.02, 0.03, kit.paint("#23262d"), this.brush, 0.005); b.rotation.y = (i / 6) * Math.PI; }
    const sign = kit.sign(0.5, 0.12, (c, w, h) => label(c, w, h, "JANITOR-9", { bg: "#3f4f57", fg: "#f2c94c" }), g, 128);
    sign.position.set(0, 0.19, 0.41);
    g.position.copy(this.home);
    g.visible = false;
  }

  // returns the junk it just swallowed, if any
  step(dt: number, t: number, junk: Junk[]): Junk | null {
    if (!this.active) return null;
    this.group.visible = true;
    this.brush.rotation.y += dt * 18;
    (this.eye.material as T.MeshStandardMaterial).emissiveIntensity = 1 + Math.sin(t * 10) * 0.5;
    if (!this.target || this.target.gone) this.target = junk.filter(j => !j.gone).sort((a, b) => a.group.position.distanceTo(this.group.position) - b.group.position.distanceTo(this.group.position))[0] ?? null;
    const goal = this.target ? this.target.group.position : this.home;
    const d = new T.Vector3(goal.x - this.group.position.x, 0, goal.z - this.group.position.z);
    const dist = d.length();
    if (dist > 0.05) {
      d.normalize();
      this.group.position.addScaledVector(d, Math.min(dist, 2.2 * dt));
      this.group.rotation.y = Math.atan2(d.x, d.z);
      this.group.position.y = Math.abs(Math.sin(t * 20)) * 0.015; // rattles along
    }
    if (this.target && dist < 0.45) { const j = this.target; j.gone = true; this.target = null; return j; }
    if (!this.target && dist < 0.1) { this.active = false; this.group.visible = false; }
    return null;
  }
}
