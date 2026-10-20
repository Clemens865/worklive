import * as T from "three";
import { toon, flat, part, geo } from "./toon.js";
import { lathe, sphere, torus, tube, capsule, cyl } from "./shapes.js";
import { darken } from "./face.js";

// Torso + outfit. The main top always carries the provider colour.
export function buildTorso(spine, chest, look, D) {
  const shirt = toon(look.shirt);
  const w = D.waist, b = D.belly;
  // Lower torso / belly (spine joint)
  const belly = part(lathe(`belly${w.toFixed(3)}${b}`, [[0.001, -0.04], [w * 0.98, -0.02], [w * (1.05 + b * 0.28), D.spineH * 0.45], [w * (1.02 + b * 0.18), D.spineH * 0.95], [w * 0.8, D.spineH * 1.2], [0.001, D.spineH * 1.25]], 22), shirt, spine, { ink: 0.012, scale: [1, 1, 0.8 + b * 0.08] });
  // Chest (chest joint): broad shoulders, narrow top
  const cw = D.shoulderW * 1.02, h = D.chestH;
  const chestM = part(lathe(`chest${cw.toFixed(3)}${h.toFixed(3)}`, [[0.001, -0.06], [w * 0.95, -0.04], [cw * 0.95, h * 0.45], [cw * 1.02, h * 0.75], [cw * 0.75, h * 0.98], [0.06, h * 1.04], [0.001, h * 1.05]], 22), shirt, chest, { ink: 0.012, scale: [1, 1, 0.72] });
  const neck = new T.Group(); neck.position.y = h; chest.add(neck);
  belly.userData.surface = chestM.userData.surface = "torso";
  // Outfit details are placed on the real torso surface (bodies range from lanky to round), like face parts on the head.
  const S = torsoSurface(chest, [belly, chestM]);
  const top = TOPS[look.top] || TOPS.tee, from = chest.children.length;
  top(chest, look, D, h, S);
  // Everything the top adds lies on the torso (fit check: not sunk into it, not floating off it). Collar and hood wrap the neck.
  for (const m of chest.children.slice(from)) if (m.isMesh && !m.userData.free) m.userData.on = "torso";
  return neck;
}

// z of the torso surface at chest-local (x, y): side 1 = front, -1 = back. Rays come from outside, so the outermost
// layer (belly or chest, whichever bulges further) wins. Falls back to `fallback` where the ray misses.
function torsoSurface(chest, meshes) {
  chest.updateWorldMatrix(true, false);
  for (const m of meshes) m.updateMatrixWorld(true);
  const inv = chest.matrixWorld.clone().invert(), ray = new T.Raycaster(), o = new T.Vector3(), d = new T.Vector3();
  const z = (x, y, side = 1, fallback = 0.1 * side) => {
    o.set(x + 7e-4, y, side * 1.0).applyMatrix4(chest.matrixWorld); // off the lathe seam (x = 0), where rays slip between triangles
    d.set(0, 0, -side).transformDirection(chest.matrixWorld);
    ray.set(o, d);
    const hit = ray.intersectObjects(meshes, false)[0];
    return hit ? hit.point.applyMatrix4(inv).z : fallback;
  };
  /** Point on the surface plus `lift` along the outward z. */
  const at = (x, y, lift = 0, side = 1) => [x, y, z(x, y, side) + side * lift];
  /** Tilt (x rotation) that lays a piece spanning y0..y1 flat against the surface. */
  const slope = (x, y0, y1, side = 1) => Math.atan2(z(x, y1, side) - z(x, y0, side), y1 - y0) * side;
  /** Bend a placed piece so it follows the surface curvature around its anchor (bibs, panels, strings on a round chest).
   *  The piece gets its own copy of the geometry. */
  const conform = (mesh, side = 1) => {
    mesh.updateMatrix();
    const g = mesh.geometry.clone(), p = g.attributes.position, v = new T.Vector3(), inv = mesh.matrix.clone().invert();
    const z0 = z(mesh.position.x, mesh.position.y, side, null);
    if (z0 === null) return mesh;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrix);
      const zs = z(v.x, v.y, side, null);
      if (zs !== null) v.z += zs - z0;
      v.applyMatrix4(inv); p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals(); g.name = mesh.geometry.name;
    for (const c of mesh.children) if (c.geometry === mesh.geometry) c.geometry = g;   // ink hull shares the shape
    mesh.geometry = g;
    return mesh;
  };
  return { z, at, slope, conform };
}

const collarRing = (chest, look, h, color, r = 0.075) => {
  const c = part(torus(1, 0.28), toon(color), chest, { ink: 0.007, pos: [0, h * 0.98, 0.005], rot: [Math.PI / 2 - 0.15, 0, 0], scale: [r, r * 0.9, r] });
  c.userData.free = true; return c;
};

function flaps(chest, h, color, S) {
  for (const s of [-1, 1]) {
    const f = part(geo("flap", () => { const g = new T.ConeGeometry(0.045, 0.08, 3); g.rotateZ(Math.PI); return g; }), toon(color), chest, { ink: 0.006 });
    f.position.set(...S.at(s * 0.04, h * 0.93, 0.006)); f.rotation.set(S.slope(s * 0.04, h * 0.9, h * 0.96), 0, s * 0.5); f.scale.set(1, 1, 0.3);
  }
}
function buttons(chest, h, n, color, S, x = 0) {
  for (let i = 0; i < n; i++) part(sphere(8), flat(color), chest, { ink: 0, shadow: false, pos: S.at(x, h * 0.8 - i * 0.055, 0.002), scale: [0.011, 0.011, 0.006] });
}

const TOPS = {
  tee(chest, look, D, h) { collarRing(chest, look, h, darken(look.shirt, 0.82)); },
  polo(chest, look, D, h, S) {
    collarRing(chest, look, h, look.shirt, 0.078); flaps(chest, h, darken(look.shirt, 1.12), S);
    buttons(chest, h, 2, "#f4f1ea", S);
  },
  hoodie(chest, look, D, h, S) {
    part(lathe("hood", [[0.001, -0.02], [0.12, 0.0], [0.15, 0.06], [0.13, 0.13], [0.06, 0.16], [0.001, 0.16]], 18), toon(darken(look.shirt, 0.92), { side: T.DoubleSide }), chest, { ink: 0.01, pos: [0, h * 0.9, S.z(0, h * 0.9, -1) + 0.05], scale: [1.1, 0.9, 0.7], rot: [-0.4, 0, 0] }).userData.free = true;
    collarRing(chest, look, h, darken(look.shirt, 0.85), 0.08);
    for (const s of [-1, 1]) S.conform(part(capsule(0.006, 0.08), flat("#f4f1ea"), chest, { ink: 0, pos: S.at(s * 0.035, h * 0.72, 0.005), rot: [S.slope(s * 0.035, h * 0.68, h * 0.76), 0, 0] }));
  },
  cardigan(chest, look, D, h, S) {
    // Undershirt V shows the accent colour between the cardigan fronts
    const v = part(geo("vneck", () => { const g = new T.ConeGeometry(0.055, 0.09, 3); g.rotateZ(Math.PI); return g; }), toon(look.accentColor), chest, { ink: 0.006 });
    v.position.set(...S.at(0, h * 0.72, 0.004)); v.scale.set(1, 1, 0.15); v.rotation.x = S.slope(0, h * 0.72 - 0.03, h * 0.72 + 0.03);
    S.conform(v);
    buttons(chest, h, 3, "#f2e2b8", S);
  },
  tie(chest, look, D, h, S) {
    collarRing(chest, look, h, "#f7f4ee", 0.078); flaps(chest, h, "#f7f4ee", S);
    part(sphere(10), toon(look.accentColor), chest, { ink: 0.006, pos: S.at(0, h * 0.9, 0.008), scale: [0.02, 0.018, 0.015] });
    // The blade hangs from the knot and rests on the belly: aim it at the surface 20 cm lower.
    const top = S.at(0, h * 0.88, 0.006), low = S.at(0, h * 0.88 - 0.2, 0.006);
    const t = part(geo("tieb", () => { const g = new T.CylinderGeometry(0.012, 0.032, 0.2, 4); g.translate(0, -0.1, 0); return g; }), toon(look.accentColor), chest, { ink: 0.006 });
    t.position.set(...top); t.rotation.set(-Math.atan2(low[2] - top[2], top[1] - low[1]), Math.PI / 4, 0, "XYZ"); t.scale.set(1, 1, 0.3);
  },
  overalls(chest, look, D, h, S) {
    collarRing(chest, look, h, darken(look.shirt, 0.82));
    const denim = toon(look.pantsColor);
    S.conform(part(geo("bib", () => new T.BoxGeometry(0.16, 0.14, 0.02, 6, 6, 1)), denim, chest, { ink: 0.007, pos: S.at(0, 0.06, 0.008), rot: [S.slope(0, -0.01, 0.13), 0, 0] }));
    for (const s of [-1, 1]) {
      // Straps run from the bib over the shoulder and down the back, 1 cm off the surface.
      const pts = [S.at(s * 0.06, 0.12, 0.01), S.at(s * 0.1, h * 0.8, 0.01), [s * 0.11, h * 1.02, 0.0], S.at(s * 0.1, h * 0.8, 0.01, -1), S.at(s * 0.07, 0.0, 0.01, -1)];
      part(tube("strap" + s + pts.flat().map(v => v.toFixed(3)).join(), pts, 0.011, 16), denim, chest, { ink: 0.005 });
      part(cyl(0.014, 0.014, 0.008, 10), toon("#f2c94c"), chest, { ink: 0.004, pos: S.at(s * 0.06, 0.12, 0.016), rot: [Math.PI / 2, 0, 0] });
    }
    part(sphere(10), toon(darken(look.pantsColor, 0.8)), chest, { ink: 0.004, pos: S.at(0.03, 0.06, 0.02), scale: [0.03, 0.025, 0.006] }).userData.free = true; // on the bib
  },
};
