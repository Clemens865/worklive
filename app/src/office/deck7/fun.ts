import * as T from "three";
import { Kit, label } from "./kit";
import type { Spot } from "./props";

// Two things for bored robots to *do*: a hamster-wheel generator (voluntary power contribution)
// and a jukebox with a small disco floor.

export function hamsterWheel(kit: Kit) {
  const g = new T.Group();
  const frame = kit.paint("#3f4f57"), rim = kit.paint("#f2c94c"), dark = kit.paint("#23262d");
  // two A-frame legs and an axle
  for (const z of [-0.75, 0.75]) {
    for (const s of [-1, 1]) { const leg = kit.can(0.06, 0.05, 1.45, frame, g); leg.position.set(s * 0.6, 0, z); leg.rotation.z = -s * 0.38; }
  }
  const axle = kit.mesh(new T.CylinderGeometry(0.06, 0.06, 1.7, 12), frame, g);
  axle.rotation.x = Math.PI / 2;
  axle.position.y = 1.32;
  // the wheel spins about the axle (z axis)
  const wheel = new T.Group();
  wheel.position.y = 1.32;
  g.add(wheel);
  for (const z of [-0.6, 0.6]) { const r = kit.mesh(new T.TorusGeometry(1.2, 0.06, 10, 48), rim, wheel); r.position.z = z; }
  for (let i = 0; i < 16; i++) { // running slats
    const a = (i / 16) * Math.PI * 2;
    const slat = kit.box(0.08, 0.05, 1.22, dark, wheel, 0.01);
    slat.position.set(Math.cos(a) * 1.18, Math.sin(a) * 1.18, 0);
    slat.rotation.z = a;
  }
  for (let i = 0; i < 6; i++) for (const z of [-0.6, 0.6]) { // spokes
    const sp = kit.box(2.3, 0.035, 0.035, frame, wheel, 0.01);
    sp.position.z = z;
    sp.rotation.z = (i / 6) * Math.PI;
  }
  // power meter + sign
  const meter = new T.Group();
  meter.position.set(1.0, 0, 0.95);
  g.add(meter);
  kit.box(0.34, 1.0, 0.2, kit.paint("#2c3440"), meter, 0.03).position.y = 0.5;
  const barMat = new T.MeshStandardMaterial({ color: "#3fe07a", emissive: "#3fe07a", emissiveIntensity: 1.2 });
  kit.mats.push(barMat);
  const bar = kit.mesh(new T.BoxGeometry(0.18, 0.8, 0.04), barMat, meter, { line: false });
  bar.position.set(0, 0.5, 0.11);
  const s = kit.sign(1.3, 0.3, (c, w, h) => label(c, w, h, "VOLUNTARY POWER\nCONTRIBUTION", { bg: "#f2c94c" }), g);
  s.position.set(0, 2.85, 0);
  return {
    group: g,
    spots: [{ pos: new T.Vector3(0, 0.16, 0), face: Math.PI / 2 }] as Spot[], // inside, running along the wheel
    // spin with the runner; the meter fills while someone runs and drains slowly
    update(dt: number, running: boolean, charge: { v: number }) {
      wheel.rotation.z += dt * (running ? 2.2 : 0.15);
      charge.v = T.MathUtils.clamp(charge.v + dt * (running ? 0.12 : -0.03), 0, 1);
      bar.scale.y = Math.max(0.02, charge.v);
      bar.position.y = 0.1 + 0.4 * bar.scale.y;
      barMat.emissiveIntensity = 0.6 + charge.v * 1.4;
    },
  };
}

export function jukebox(kit: Kit) {
  const g = new T.Group();
  const body = kit.box(0.9, 1.4, 0.6, kit.paint("#7d4a6a"), g, 0.08);
  body.position.y = 0.7;
  const arch = kit.mesh(new T.CylinderGeometry(0.45, 0.45, 0.6, 32, 1, false, -Math.PI / 2, Math.PI), kit.paint("#7d4a6a"), g);
  arch.rotation.x = Math.PI / 2;
  arch.position.set(0, 1.4, 0);
  const bands: T.MeshStandardMaterial[] = [];
  ["#ff5a4f", "#f2c94c", "#5ff2b5", "#63d3ff"].forEach((c, i) => {
    const m = new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1 });
    kit.mats.push(m);
    bands.push(m);
    const band = kit.mesh(new T.TorusGeometry(0.36 - i * 0.07, 0.025, 8, 32, Math.PI), m, g, { line: false });
    band.position.set(0, 1.4, 0.31);
  });
  const win = kit.box(0.6, 0.35, 0.04, kit.paint("#2c3440"), g, 0.03);
  win.position.set(0, 0.95, 0.31);
  const s = kit.sign(0.56, 0.14, (c, w, h) => label(c, w, h, "HITS OF 2387", { bg: "#f2c94c" }), g);
  s.position.set(0, 0.55, 0.31);
  // the disco floor in front: 3 × 3 light-up tiles
  const tiles: T.MeshStandardMaterial[] = [];
  for (let i = 0; i < 9; i++) {
    const m = new T.MeshStandardMaterial({ color: "#2c3440", emissive: "#000000", roughness: 0.4 });
    kit.mats.push(m);
    tiles.push(m);
    const t = kit.mesh(new T.BoxGeometry(0.68, 0.04, 0.68), m, g, { line: false, shadow: false });
    t.position.set(((i % 3) - 1) * 0.72, 0.02, 1.25 + Math.floor(i / 3) * 0.72);
  }
  const colors = ["#ff5a4f", "#f2c94c", "#5ff2b5", "#63d3ff", "#ff9fd0", "#9d8cff"].map(c => new T.Color(c));
  return {
    group: g,
    spots: [{ pos: new T.Vector3(-0.55, 0, 1.6), face: 0.4 }, { pos: new T.Vector3(0.6, 0, 1.75), face: -0.4 }] as Spot[],
    update(t: number, dancers: number) {
      const beat = Math.floor(t * 2.2);
      bands.forEach((m, i) => (m.emissiveIntensity = dancers ? 0.6 + 0.8 * Math.abs(Math.sin(t * 4.4 + i)) : 0.5));
      tiles.forEach((m, i) => {
        if (!dancers) { m.emissive.setRGB(0, 0, 0); return; }
        m.emissive.copy(colors[(((beat + i * 2) % colors.length) + colors.length) % colors.length] ?? colors[0]);
        m.emissiveIntensity = (beat + i) % 3 === 0 ? 1.1 : 0.15;
      });
    },
  };
}
