import * as T from "three";
import { toon, flat, part, geo } from "./toon.js";
import { lathe, sphere, torus, tube, capsule, cyl } from "./shapes.js";
import { darken } from "./face.js";

// Torso + outfit. The main top always carries the provider colour.
export function buildTorso(spine, chest, look, D) {
  const shirt = toon(look.shirt);
  const w = D.waist, b = D.belly;
  // Lower torso / belly (spine joint)
  part(lathe(`belly${w.toFixed(3)}${b}`, [[0.001, -0.04], [w * 0.98, -0.02], [w * (1.05 + b * 0.28), D.spineH * 0.45], [w * (1.02 + b * 0.18), D.spineH * 0.95], [w * 0.8, D.spineH * 1.2], [0.001, D.spineH * 1.25]], 22), shirt, spine, { ink: 0.012, scale: [1, 1, 0.8 + b * 0.08] });
  // Chest (chest joint): broad shoulders, narrow top
  const cw = D.shoulderW * 1.02, h = D.chestH;
  part(lathe(`chest${cw.toFixed(3)}${h.toFixed(3)}`, [[0.001, -0.06], [w * 0.95, -0.04], [cw * 0.95, h * 0.45], [cw * 1.02, h * 0.75], [cw * 0.75, h * 0.98], [0.06, h * 1.04], [0.001, h * 1.05]], 22), shirt, chest, { ink: 0.012, scale: [1, 1, 0.72] });
  const neck = new T.Group(); neck.position.y = h; chest.add(neck);
  const top = TOPS[look.top] || TOPS.tee;
  top(chest, look, D, h);
  return neck;
}

const collarRing = (chest, look, h, color, r = 0.075) =>
  part(torus(1, 0.28), toon(color), chest, { ink: 0.007, pos: [0, h * 0.98, 0.005], rot: [Math.PI / 2 - 0.15, 0, 0], scale: [r, r * 0.9, r] });

function flaps(chest, h, color) {
  for (const s of [-1, 1]) {
    const f = part(geo("flap", () => { const g = new T.ConeGeometry(0.045, 0.08, 3); g.rotateZ(Math.PI); return g; }), toon(color), chest, { ink: 0.006 });
    f.position.set(s * 0.04, h * 0.93, 0.085); f.rotation.set(0.3, 0, s * 0.5); f.scale.set(1, 1, 0.3);
  }
}
function buttons(chest, h, n, color, z = 0.118, x = 0) {
  for (let i = 0; i < n; i++) part(sphere(8), flat(color), chest, { ink: 0, shadow: false, pos: [x, h * 0.8 - i * 0.055, z], scale: [0.011, 0.011, 0.006] });
}

const TOPS = {
  tee(chest, look, D, h) { collarRing(chest, look, h, darken(look.shirt, 0.82)); },
  polo(chest, look, D, h) {
    collarRing(chest, look, h, look.shirt, 0.078); flaps(chest, h, darken(look.shirt, 1.12));
    buttons(chest, h, 2, "#f4f1ea", 0.105);
  },
  hoodie(chest, look, D, h) {
    part(lathe("hood", [[0.001, -0.02], [0.12, 0.0], [0.15, 0.06], [0.13, 0.13], [0.06, 0.16], [0.001, 0.16]], 18), toon(darken(look.shirt, 0.92), { side: T.DoubleSide }), chest, { ink: 0.01, pos: [0, h * 0.9, -0.1], scale: [1.1, 0.9, 0.7], rot: [-0.4, 0, 0] });
    collarRing(chest, look, h, darken(look.shirt, 0.85), 0.08);
    for (const s of [-1, 1]) part(capsule(0.006, 0.08), flat("#f4f1ea"), chest, { ink: 0, pos: [s * 0.035, h * 0.72, 0.105], rot: [0.2, 0, 0] });
  },
  cardigan(chest, look, D, h) {
    // Undershirt V shows the accent colour between the cardigan fronts
    const v = part(geo("vneck", () => { const g = new T.ConeGeometry(0.07, 0.16, 3); g.rotateZ(Math.PI); return g; }), toon(look.accentColor), chest, { ink: 0.006 });
    v.position.set(0, h * 0.8, 0.085); v.scale.set(1, 1, 0.15); v.rotation.x = 0.35;
    buttons(chest, h, 3, "#f2e2b8", 0.117, 0);
  },
  tie(chest, look, D, h) {
    collarRing(chest, look, h, "#f7f4ee", 0.078); flaps(chest, h, "#f7f4ee");
    part(sphere(10), toon(look.accentColor), chest, { ink: 0.006, pos: [0, h * 0.9, 0.095], scale: [0.02, 0.018, 0.015] });
    const t = part(geo("tieb", () => { const g = new T.CylinderGeometry(0.012, 0.032, 0.2, 4); g.translate(0, -0.1, 0); return g; }), toon(look.accentColor), chest, { ink: 0.006 });
    t.position.set(0, h * 0.88, 0.108); t.rotation.set(0.12, Math.PI / 4, 0); t.scale.set(1, 1, 0.3);
  },
  overalls(chest, look, D, h) {
    collarRing(chest, look, h, darken(look.shirt, 0.82));
    const denim = toon(look.pantsColor);
    part(geo("bib", () => new T.BoxGeometry(0.16, 0.14, 0.02, 1, 1, 1)), denim, chest, { ink: 0.007, pos: [0, 0.06, 0.1], rot: [0.12, 0, 0] });
    for (const s of [-1, 1]) {
      part(tube("strap" + s, [[s * 0.06, 0.12, 0.105], [s * 0.1, h * 0.8, 0.1], [s * 0.11, h * 1.02, 0.0], [s * 0.1, h * 0.8, -0.11], [s * 0.07, 0.0, -0.12]], 0.011, 16), denim, chest, { ink: 0.005 });
      part(cyl(0.014, 0.014, 0.008, 10), toon("#f2c94c"), chest, { ink: 0.004, pos: [s * 0.06, 0.12, 0.112], rot: [Math.PI / 2, 0, 0] });
    }
    part(sphere(10), toon(darken(look.pantsColor, 0.8)), chest, { ink: 0.004, pos: [0.03, 0.06, 0.112], scale: [0.03, 0.025, 0.006] });
  },
};
