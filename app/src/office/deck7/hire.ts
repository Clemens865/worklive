import * as T from "three";
import { Kit, label } from "./kit";

// Hiring on Deck 7: a crate drops out of the delivery chute, bounces, its sides flop open, packing
// foam goes everywhere and the new robot pops out. Worklive's "hire an agent", but with shipping.

export const CHUTE = new T.Vector3(-0.2, 0, 2.55); // where crates land (front aisle, centre)

export function buildChute(kit: Kit) {
  const g = new T.Group();
  g.position.set(CHUTE.x, 0, CHUTE.z);
  const pipeM = kit.paint("#9aa6b2");
  const pipe = kit.mesh(new T.CylinderGeometry(0.62, 0.62, 3, 28, 1, true), pipeM, g);
  pipe.position.y = 5.6;
  (pipe.material as T.Material).side = T.DoubleSide;
  const lip = kit.mesh(new T.TorusGeometry(0.62, 0.07, 10, 32), kit.paint("#f2c94c"), g);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 4.1;
  const s = kit.sign(1.1, 0.24, (c, w, h) => label(c, w, h, "NEW HIRES ↓ STAND CLEAR", { bg: "#f2c94c" }), g);
  s.position.set(0, 4.4, 0.66);
  // hazard ring on the floor where crates land
  const ring = kit.mesh(new T.RingGeometry(0.62, 0.72, 32), new T.MeshBasicMaterial({ color: "#e0b531" }), g, { line: false, shadow: false });
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  return g;
}

export class Delivery {
  group = new T.Group();
  done = false;
  private t = 0;
  private y = 6;
  private vy = 0;
  private sides: T.Object3D[] = [];
  private foam: { m: T.Mesh; v: T.Vector3 }[] = [];
  private robotRoot: T.Object3D;
  opened = false;

  constructor(kit: Kit, robotRoot: T.Object3D, private onOpen: () => void, private onDone: () => void) {
    this.robotRoot = robotRoot;
    this.group.position.copy(CHUTE);
    const wood = kit.paint("#a07a52"), tape = kit.paint("#d9d4c3");
    const S = 1.1;
    const crate = new T.Group();
    this.group.add(crate);
    // four hinged sides + a lid; each side pivots on its bottom edge
    for (let i = 0; i < 4; i++) {
      const hinge = new T.Group();
      const a = (i / 4) * Math.PI * 2;
      hinge.position.set(Math.sin(a) * S / 2, 0, Math.cos(a) * S / 2);
      hinge.rotation.order = "YXZ"; // yaw to face outwards, then tip over the bottom edge
      hinge.rotation.y = a;
      crate.add(hinge);
      const side = kit.box(S, S * 1.25, 0.06, wood, hinge, 0.02);
      side.position.y = (S * 1.25) / 2;
      kit.box(S * 1.01, 0.1, 0.07, tape, hinge, 0.01).position.y = S * 0.62;
      if (i === 0) {
        const s = kit.sign(0.8, 0.3, (c, w, h) => label(c, w, h, "THIS SIDE UP\n(WRONG)", { fg: "#c0462f" }), hinge);
        s.position.set(0, S * 0.35, 0.04);
        s.rotation.z = Math.PI;
      }
      this.sides.push(hinge);
    }
    const lid = kit.box(S + 0.04, 0.06, S + 0.04, wood, crate, 0.02);
    lid.position.y = S * 1.25;
    this.sides.push(lid);
    // the robot waits inside, folded small
    robotRoot.scale.setScalar(0.001);
    this.group.add(robotRoot);
    const foamM = kit.paint("#f4f1ea");
    for (let i = 0; i < 22; i++) {
      const m = kit.mesh(new T.CapsuleGeometry(0.035, 0.05, 3, 6), foamM, this.group, { line: false });
      m.position.set((Math.random() - 0.5) * 0.8, 0.3 + Math.random() * 0.8, (Math.random() - 0.5) * 0.8);
      m.visible = false;
      this.foam.push({ m, v: new T.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 2.5, (Math.random() - 0.5) * 3) });
    }
    this.group.position.y = this.y;
  }

  update(dt: number, scale: number) {
    this.t += dt;
    if (!this.opened) {
      // fall and bounce
      this.vy -= 22 * dt;
      this.y += this.vy * dt;
      if (this.y < 0) { this.y = 0; this.vy = Math.abs(this.vy) > 2 ? -this.vy * 0.3 : 0; }
      this.group.position.y = this.y;
      if (this.y === 0 && this.vy === 0 && this.t > 1.4) {
        this.opened = true;
        this.t = 0;
        this.foam.forEach(f => (f.m.visible = true));
        this.onOpen();
      }
      return;
    }
    // sides flop outwards, the lid flies off, foam scatters, robot springs up
    const k = Math.min(1, this.t / 0.45);
    this.sides.forEach((s, i) => {
      if (i < 4) s.rotation.x = k * 1.55;
      else { s.position.y = 1.4 + this.t * 3; s.rotation.z = this.t * 4; s.visible = this.t < 0.8; }
    });
    for (const f of this.foam) {
      f.v.y -= 9.8 * dt;
      f.m.position.addScaledVector(f.v, dt);
      if (f.m.position.y < 0.03) { f.m.position.y = 0.03; f.v.set(f.v.x * 0.5, 0, f.v.z * 0.5); }
    }
    const pop = this.t < 0.15 ? 0.001 : Math.min(1, (this.t - 0.15) / 0.35);
    const over = pop < 1 ? pop * 1.15 : 1 + Math.sin(Math.min(1, (this.t - 0.5) / 0.4) * Math.PI) * 0.06;
    this.robotRoot.scale.setScalar(Math.max(0.001, over) * scale);
    if (this.t > 1.2 && !this.done) { this.done = true; this.onDone(); }
  }
}
