import * as T from "three";
import { boxGeo } from "./robot-geo";
import { shell, dark, eyeball, iris, glass } from "./robot-materials";
import type { RobotSpec, RobotFinish } from "./robot-spec";

// The face carries most of the emotion: brows, slanted upper lids, lower lids that push up into
// happy crescents, pupils, and a morphing mouth. Everything is driven by one FaceState per frame.

export interface FaceState {
  lookX: number; lookY: number; // -1..1
  upper: number; // upper lid closed amount 0..1
  slant: number; // + angry (inner end down), - worried (inner end up)
  lower: number; // lower lid 0..1
  browY: number; // brow raise, in eye radii
  browAng: number; // + angry, - worried
  smile: number; // -1 frown .. 1 grin
  open: number; // 0 closed .. 1 shouting
  pupil: number; // pupil scale
}

export interface FaceRig { apply(f: FaceState): void; eyeZ: number }

type MeshFn = (g: T.BufferGeometry, m: T.Material, parent: T.Object3D, line?: boolean) => T.Mesh;

// An eyelid: a cap slightly bigger than the eyeball; fragments past the lid edge are discarded.
function lidMaterial(color: string, finish: RobotFinish, upper: boolean, side: number) {
  const m = shell(color, finish).clone();
  const u = { uEdge: { value: 1 }, uTan: { value: 0 }, uSide: { value: side }, uCurve: { value: 0 }, uUp: { value: upper ? 1 : -1 } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLid;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLid = position;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLid;\nuniform float uEdge, uTan, uSide, uCurve, uUp;")
      .replace("void main() {", `void main() {
        float edge = uEdge + uTan * uSide * vLid.x - uCurve * vLid.x * vLid.x;
        if ((vLid.y - edge) * uUp < 0.0) discard;`);
  };
  m.customProgramCacheKey = () => `lid-${finish}`;
  return { m, u };
}

// headR(y) = radius of a round head at height y (head space); box heads use the flat front plane.
export function buildFace(spec: RobotSpec, finish: RobotFinish, head: T.Group, front: number, vy: number, mesh: MeshFn, headR: (y: number) => number): FaceRig {
  const F = spec.face, r = F.eye;
  const trim = shell(spec.trim, finish);
  const browCol = "#" + new T.Color(spec.trim).multiplyScalar(0.45).getHexString();
  const xs = F.eyes === 1 ? [0] : [-F.spread, F.spread];
  const curved = spec.head.shape !== "box";

  // Put something on the face at (x, y), dz out from the surface, facing outward. Curved heads
  // wrap it around the can so nothing floats off the sides when seen from an angle.
  const place = (o: T.Object3D, x: number, y: number, dz: number, wrap = curved) => {
    if (wrap) {
      const R0 = Math.max(0.05, headR(vy + y)), R = R0 + dz, a = Math.asin(T.MathUtils.clamp(x / R0, -0.95, 0.95));
      o.position.set(Math.sin(a) * R, y, Math.cos(a) * R);
      o.rotation.y = a;
    } else o.position.set(x, y, front + dz);
    return o;
  };
  const visor = new T.Group();
  visor.position.y = vy;
  head.add(visor);

  // --- visor; eyeDz = eye centre out from the face surface
  let eyeDz: number, browY: number, browDz = 0.015;
  let eyesWrap = curved;
  if (F.visor === "band") {
    const w = (F.eyes === 2 ? F.spread * 2 : 0) + r * 2.7, h = r * 2.5;
    if (curved) {
      // a strip wrapped around the head, not a box stuck on the front
      const R = front + 0.05, th = 2 * Math.asin(Math.min(0.95, (w / 2) / front));
      mesh(new T.CylinderGeometry(R, R, h, 48, 1, false, -th / 2, th), trim, visor);
      mesh(new T.CylinderGeometry(R + 0.012, R + 0.012, h * 0.74, 48, 1, false, -th * 0.44, th * 0.88), glass(spec.metal, finish), visor, false);
      eyeDz = 0.07;
    } else {
      mesh(boxGeo(w, h, 0.3, h * 0.48), trim, visor).position.z = front - 0.03;
      mesh(boxGeo(w * 0.88, h * 0.76, 0.3, h * 0.36), glass(spec.metal, finish), visor, false).position.z = front - 0.005;
      eyeDz = 0.1;
    }
    browY = h / 2 + F.brow * 1.6;
  } else if (F.visor === "goggles") {
    for (const x of xs) {
      // deep cups so the lenses sit in the head from every side
      const cup = new T.Group();
      visor.add(place(cup, x, 0, 0));
      const c = mesh(new T.CylinderGeometry(r * 1.34, r * 1.42, 0.3, 40), glass(spec.metal, finish), cup, false);
      c.rotation.x = Math.PI / 2;
      c.position.z = -0.07;
      mesh(new T.TorusGeometry(r * 1.28, r * 0.24, 10, 32), trim, cup).position.z = 0.085;
    }
    if (curved) {
      const strap = mesh(new T.TorusGeometry(spec.head.w * 1.005, 0.035, 8, 64), dark(finish), visor, false);
      strap.rotation.x = Math.PI / 2;
    }
    eyeDz = 0.075;
    browY = r * 1.55 + F.brow * 1.2;
    browDz = 0.03;
  } else {
    // porthole: one round window, eyes behind flat glass
    const R = F.eyes === 2 ? F.spread + r * 1.4 : r * 1.35;
    const ring = new T.Group();
    visor.add(place(ring, 0, 0, 0));
    const housing = mesh(new T.CylinderGeometry(R + 0.02, R + 0.02, 0.34, 48), trim, ring); // reaches back into the head
    housing.rotation.x = Math.PI / 2;
    housing.position.z = -0.12;
    mesh(new T.TorusGeometry(R, 0.055, 12, 48), trim, ring).position.z = 0.06;
    const pane = mesh(new T.CylinderGeometry(R, R, 0.02, 48), glass(spec.metal, finish), ring, false);
    pane.rotation.x = Math.PI / 2;
    pane.position.z = 0.045;
    eyeDz = 0.055;
    eyesWrap = false;
    browY = R * 0.97; // brows rest on the rim
    browDz = 0.1;
  }

  // on round heads keep brows where the head is still wide, else their ends stick out of the silhouette
  if (curved) {
    let y = browY;
    while (y > 0 && headR(vy + y) < front * 0.82) y -= 0.01;
    if (y < browY) { browY = y; browDz = Math.max(browDz, F.visor === "goggles" ? 0.12 : 0.03); }
  }

  // --- eyes, lids
  const eyes: { g: T.Group; pupil: T.Mesh; up: ReturnType<typeof lidMaterial>; lo: ReturnType<typeof lidMaterial>; upM: T.Mesh; loM: T.Mesh; s: number }[] = [];
  for (const x of xs) {
    const s = F.eyes === 1 ? 0 : Math.sign(x);
    const g = new T.Group();
    visor.add(place(g, x, 0, eyeDz, eyesWrap));
    mesh(new T.SphereGeometry(r, 28, 18), eyeball(finish), g, false).scale.z = 0.55;
    const pupil = mesh(new T.SphereGeometry(r * F.pupil, 24, 16), iris(finish), g, false);
    pupil.scale.z = 0.25;
    pupil.userData.keep = true;
    const up = lidMaterial(spec.metal, finish, true, s), lo = lidMaterial(spec.metal, finish, false, s);
    const lidGeo = new T.SphereGeometry(r * 1.07, 28, 18);
    const upM = mesh(lidGeo, up.m, g, false), loM = mesh(lidGeo.clone(), lo.m, g, false);
    upM.scale.z = loM.scale.z = 0.66;
    upM.userData.keep = loM.userData.keep = true;
    eyes.push({ g, pupil, up, lo, upM, loM, s });
  }

  // --- brows: sit on the head above the visor. Two eyes: one bar each, tilting about its centre.
  // One eye: two halves hinged in the middle, so anger makes a V.
  const brows: { g: T.Group; s: number; y: number }[] = [];
  if (F.brow > 0) {
    const browM = shell(browCol, finish);
    const halves = F.eyes === 1 ? [-1, 1].map(s => ({ s, x: 0, len: r * 1.15 })) : xs.map(x => ({ s: Math.sign(x), x, len: r * 1.9 }));
    for (const h of halves) {
      const g = new T.Group();
      visor.add(place(g, h.x, browY, browDz, curved && F.visor !== "porthole"));
      const tilt = new T.Group(); // animated; the outer group keeps the wrap angle
      g.add(tilt);
      // one-eye halves swing back to follow a round head instead of sticking straight out
      const follow = new T.Group();
      if (F.eyes === 1 && curved && F.visor !== "porthole") follow.rotation.y = h.s * Math.asin(Math.min(0.9, h.len / 2 / front));
      tilt.add(follow);
      const bar = mesh(new T.CapsuleGeometry(F.brow, h.len, 4, 12), browM, follow);
      bar.rotation.z = Math.PI / 2;
      bar.position.x = F.eyes === 1 ? h.s * h.len / 2 : 0;
      bar.scale.z = 0.6;
      brows.push({ g: tilt, s: h.s, y: 0 });
    }
  }
  const eyeZ = front + eyeDz;

  return {
    eyeZ,
    apply(f) {
      for (const e of eyes) {
        const px = f.lookX * r * 0.5, py = f.lookY * r * 0.45;
        e.pupil.position.set(px, py, 0.55 * Math.sqrt(Math.max(0, r * r - px * px - py * py)) - r * 0.02);
        e.pupil.scale.set(f.pupil, f.pupil, 0.25 * f.pupil);
        // upper lid edge runs from r (open) to -r (shut); with one eye the slant becomes a frown/worry curve
        e.up.u.uEdge.value = r * (1 - 2.1 * f.upper);
        e.up.u.uTan.value = e.s ? f.slant : 0;
        e.up.u.uCurve.value = e.s ? 0 : -f.slant * 1.6 / r;
        e.upM.visible = f.upper > 0.02;
        // lower lid rises as an arc, so a raised lower lid reads as a happy squint
        e.lo.u.uEdge.value = -r * (1 - 2.1 * f.lower);
        e.lo.u.uCurve.value = (f.lower > 0.05 ? 1.4 : 0) / r;
        e.loM.visible = f.lower > 0.02;
      }
      for (const b of brows) {
        b.g.position.y = r * f.browY * 0.7 + (F.eyes === 1 ? -f.browAng * r * 0.25 : 0);
        b.g.rotation.z = F.eyes === 1 ? b.s * f.browAng * 0.45 : b.s * f.browAng * 0.55;
      }
    },
  };
}
