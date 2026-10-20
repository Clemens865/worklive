import * as T from "three";
import { toon, flat, part, ink, geo } from "./toon.js";
import { sphere, tube, lathe, headRadius } from "./shapes.js";
import { createMouth } from "./mouth.js";

// Face on a unit head (head mesh radius ~1, front at +z). Parent is scaled to real size.
const EYE_SHAPES = { round: [1, 1.1], almond: [1.12, 0.86], wide: [1.1, 1.22], sleepy: [1.05, 0.95] };

const lidGeo = () => geo("lid", () => new T.SphereGeometry(1.08, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2));

function buildEye(parent, side, look) {
  const [sx, sy] = EYE_SHAPES[look.eyes] || EYE_SHAPES.round;
  const er = 0.27;
  const g = new T.Group(); g.position.set(side * 0.33, 0.06, 0.76); g.scale.set(er * sx, er * sy, er * 0.85);
  g.rotation.y = side * 0.2; parent.add(g);
  const sclera = part(sphere(24), toon("#fdfcf8", { rim: 0, gloss: 1 }), g, { ink: 0.009, shadow: false });
  sclera.userData.surface = "head"; // glasses rest in front of the eyes
  const ball = new T.Group(); g.add(ball);
  const iris = part(sphere(16), toon(look.eyeColor, { rim: 0, gloss: 1 }), ball, { ink: 0, shadow: false, pos: [0, 0, 0.9], scale: [0.46, 0.46, 0.14] });
  const pupil = part(sphere(12), flat("#121014"), ball, { ink: 0, shadow: false, pos: [0, 0, 0.965], scale: [0.26, 0.26, 0.06] }); pupil.userData.keep = true;
  const hl = new T.Group(); ball.add(hl);
  part(sphere(8), flat("#ffffff"), hl, { ink: 0, shadow: false, pos: [-0.2, 0.22, 0.99], scale: [0.14, 0.14, 0.05] });
  part(sphere(8), flat("#ffffff"), hl, { ink: 0, shadow: false, pos: [0.14, -0.14, 1.0], scale: [0.06, 0.06, 0.03] });
  const skinLid = toon(look.skinColor, { side: T.DoubleSide, rim: 0 });
  const upper = new T.Mesh(lidGeo(), skinLid); upper.userData.keep = true; g.add(upper);
  const lash = new T.Mesh(geo("lash", () => new T.TorusGeometry(1.08, 0.06, 6, 24, Math.PI)), flat("#241418"));
  lash.rotation.x = Math.PI / 2; upper.add(lash);
  const lower = new T.Mesh(lidGeo(), skinLid); lower.userData.keep = true; lower.rotation.z = Math.PI; g.add(lower);
  return { g, ball, upper, lower, pupil, sy };
}

function buildBrow(parent, side, look, surf) {
  const th = 0.055 * look.brows;
  const b = new T.Group(); b.position.set(side * 0.33, 0.46, surf(side * 0.33, 0.48) + 0.035); b.rotation.y = side * 0.35; parent.add(b);
  const pts = [[-0.17, -0.03, -0.04], [-0.06, 0.025, 0.0], [0.07, 0.025, 0.0], [0.17, -0.03, -0.04]].map(([x, y, z]) => [x * side, y, z]);
  const g = tube("brow" + th.toFixed(3) + side, pts, th, 12);
  part(g, toon(look.hairColor === 8 ? "#b39a70" : darken(look.hairColorHex), { rim: 0 }), b, { ink: 0.005, shadow: false });
  return b;
}
export function darken(hex, k = 0.75) { return "#" + new T.Color(hex).multiplyScalar(k).getHexString(); }

function buildNose(parent, look, surf) {
  const skin = toon("#" + new T.Color(look.skinColor).lerp(new T.Color("#e2786a"), 0.12).getHexString());
  const n = new T.Group(); n.position.set(0, -0.2, surf(0, -0.2) - 0.03); parent.add(n);
  const arc = part(geo("nostril", () => new T.TorusGeometry(0.06, 0.012, 6, 12, Math.PI * 0.8)), flat(darken(look.skinColor, 0.55)), n, { ink: 0, shadow: false });
  arc.position.set(0, -0.07, 0.1); arc.rotation.set(-0.3, 0, Math.PI * 1.1);
  const S = {
    button: () => part(sphere(), skin, n, { ink: 0.008, scale: [0.12, 0.1, 0.1], pos: [0, 0, 0.04] }),
    bulb: () => part(sphere(), skin, n, { ink: 0.008, scale: [0.19, 0.16, 0.16], pos: [0, -0.02, 0.07] }),
    wide: () => part(sphere(), skin, n, { ink: 0.008, scale: [0.2, 0.1, 0.11], pos: [0, -0.02, 0.04] }),
    long: () => part(lathe("noseLong", [[0.001, 0.2], [0.07, 0.12], [0.1, -0.05], [0.13, -0.14], [0.001, -0.2]], 14), skin, n, { ink: 0.008, rot: [1.2, 0, 0], pos: [0, 0.02, 0.1], scale: [1, 1.2, 0.8] }),
    pointy: () => part(lathe("nosePt", [[0.001, 0.22], [0.05, 0.12], [0.1, -0.08], [0.07, -0.16], [0.001, -0.18]], 14), skin, n, { ink: 0.008, rot: [1.35, 0, 0], pos: [0, 0.02, 0.09] }),
  };
  (S[look.nose] || S.button)();
  return n;
}

function buildEars(parent, look) {
  const skin = toon(look.skinColor);
  for (const s of [-1, 1]) {
    // On the side of this head shape (wide heads would swallow ears at a fixed distance)
    const dir = new T.Vector3(s, 0, -0.04).normalize(), e = new T.Group();
    e.position.copy(dir).multiplyScalar(headRadius(look.head || "round", dir) * 1.0); e.rotation.y = s * 0.35; parent.add(e);
    part(sphere(16), skin, e, { ink: 0.009, scale: [0.08, 0.22, 0.16] }).userData.on = "head";
    part(sphere(12), toon(darken(look.skinColor, 0.82), { rim: 0 }), e, { ink: 0, shadow: false, scale: [0.04, 0.13, 0.09], pos: [s * 0.045, 0, 0.02] });
    if (look.earrings) part(geo("earring", () => new T.TorusGeometry(0.06, 0.018, 6, 16)), toon("#f2c94c"), e, { ink: 0.005, pos: [s * 0.02, -0.25, 0.04], rot: [0, Math.PI / 2, 0] });
  }
}

function buildFreckles(parent, look) {
  const m = flat(darken(look.skinColor, 0.68));
  for (let i = 0; i < 10; i++) {
    const s = i < 5 ? -1 : 1, k = i % 5;
    const x = s * (0.28 + (k % 3) * 0.08), y = -0.14 - Math.floor(k / 3) * 0.07 + (k % 2) * 0.03;
    const p = new T.Vector3(x, y, 0).setZ(Math.sqrt(Math.max(0.01, 1 - x * x - y * y)) * 0.99 + 0.03);
    part(sphere(6), m, parent, { ink: 0, shadow: false, pos: [p.x, p.y, p.z], scale: 0.022 });
  }
}

// Surface depth lookup of the head geometry (raycast once per head type, cached).
const surfCache = new Map();
export function surfaceOf(type, headGeoFn) {
  if (surfCache.has(type)) return surfCache.get(type);
  const mesh = new T.Mesh(headGeoFn(type)), ray = new T.Raycaster(), NX = 17, NY = 21;
  const grid = new Float32Array(NX * NY);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const x = -0.8 + (1.6 * i) / (NX - 1), y = -1.0 + (2.0 * j) / (NY - 1);
    ray.set(new T.Vector3(x, y, 3), new T.Vector3(0, 0, -1));
    const hit = ray.intersectObject(mesh)[0];
    grid[j * NX + i] = hit ? hit.point.z : 0;
  }
  const f = (x, y) => {
    const fx = T.MathUtils.clamp((x + 0.8) / 1.6 * (NX - 1), 0, NX - 1.001), fy = T.MathUtils.clamp((y + 1.0) / 2.0 * (NY - 1), 0, NY - 1.001);
    const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, g = (a, b) => grid[b * NX + a];
    return (g(i, j) * (1 - u) + g(i + 1, j) * u) * (1 - v) + (g(i, j + 1) * (1 - u) + g(i + 1, j + 1) * u) * v;
  };
  surfCache.set(type, f); return f;
}

export function buildFace(headS, look, surf) {
  const eyes = [-1, 1].map(s => buildEye(headS, s, look));
  const brows = [-1, 1].map(s => buildBrow(headS, s, look, surf));
  buildNose(headS, look, surf); buildEars(headS, look);
  if (look.freckles) buildFreckles(headS, look);
  // Blush
  for (const s of [-1, 1]) part(sphere(10), toon("#f08c86", { transparent: true, opacity: 0.35, rim: 0, depthWrite: false }), headS, { ink: 0, shadow: false, pos: [s * 0.5, -0.24, 0.74], scale: [0.14, 0.08, 0.1], rot: [0, s * 0.6, 0] });
  const mouth = createMouth(headS, { surf, y0: -0.47, baseW: 0.5 });
  const eyeAnchor = new T.Object3D(); eyeAnchor.position.set(0, 0.1, 1.0); headS.add(eyeAnchor);
  return { eyes, brows, mouth, eyeAnchor };
}
