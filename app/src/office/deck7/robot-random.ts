import { rng } from "./util";
import { EMOTIONS, type RobotSpec } from "./robot-spec";

// Random robots from interchangeable parts. randomRobot() rolls every part; shuffleParts() swaps
// chosen part groups on an existing robot. Both end in fitRobot(), which repairs combinations
// that would look sloppy (eyes wider than the head, visor poking out of the top, no room for the
// mouth, band visors on round heads, thin necks on round bodies).

export const ROBOT_COLORS: [string, string][] = [
  ["#7c9ea6", "#3f4f57"], ["#5fbf9f", "#2f5a52"], ["#ef8fa8", "#f6e7d8"], ["#f2c23a", "#d9483f"],
  ["#8f86d6", "#d8d2f2"], ["#6e8a6f", "#33403a"], ["#c06a3c", "#7a4a30"], ["#e9e1d0", "#c0462f"],
  ["#4f6fa8", "#f2c23a"], ["#d9d3c7", "#3a3f4a"], ["#e07a5f", "#3d405b"], ["#81b29a", "#f4f1de"],
];
const NAMES = ["Bolt", "Widget", "Sprocket", "Gizmo", "Dynamo", "Ratchet", "Tinker", "Cog", "Servo", "Nibbles", "Fuse", "Clunk", "Patch", "Doodad", "Rivet", "Ohm"];
const ROLES = ["Writes the docs nobody reads.", "Fixes the printer. Again.", "Refactors on Fridays.", "Keeps the coffee machine company.",
  "Ships first, tests later.", "Counts the tickets.", "Reads every log line.", "Guards the main branch."];

export const PART_GROUPS = ["body", "head", "face", "top", "limbs", "colors"] as const;
export type PartGroup = (typeof PART_GROUPS)[number];

const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function randomRobot(seed: number): RobotSpec {
  const r = rng(seed);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const lerp = (a: number, b: number) => a + (b - a) * r();
  const shape = pick(["barrel", "box", "bulb"] as const);
  const w = lerp(0.46, 0.76);
  const h = shape === "bulb" ? lerp(0.58, 0.88) : shape === "box" ? lerp(0.78, 1.02) : lerp(0.78, 1.12);
  const headShape = pick(["can", "dome", "box", "bulb"] as const);
  const hw = Math.min(0.5, Math.max(0.36, w * lerp(0.62, 0.82)));
  const visor = pick(["band", "goggles", "porthole"] as const);
  const eyes: 1 | 2 = visor === "band" ? 2 : r() < 0.25 ? 1 : 2;
  const mouthKind = pick(["line", "teeth", "speaker"] as const);
  const top = pick(["antenna", "lamp", "dish", "chimney", "none"] as const);
  const [metal, trim] = pick(ROBOT_COLORS);
  return fitRobot({
    kind: "robot", id: "rob-" + seed, name: pick(NAMES), role: pick(ROLES), metal, trim,
    body: { shape, w, h, d: w * (shape === "box" ? lerp(0.72, 0.84) : lerp(0.88, 1)), taper: shape === "barrel" ? lerp(-0.1, 0.16) : lerp(0, 0.06), hatch: r() < 0.6 },
    head: { shape: headShape, w: hw, h: headShape === "bulb" ? hw * lerp(1.45, 1.7) : lerp(0.52, 0.68), neck: r() < 0.4 ? 0 : lerp(0.04, 0.18), tilt: lerp(-0.08, 0.12) },
    // negative spread = "pick a spot in the allowed range" (fitRobot knows the range)
    face: { visor, eyes, eye: eyes === 1 ? lerp(0.15, 0.2) : lerp(0.09, 0.13), spread: -r(), pupil: lerp(0.26, 0.38), brow: lerp(0.03, 0.055), temper: r() < 0.35 ? lerp(0.4, 0.85) : lerp(0, 0.3) },
    mouth: { kind: mouthKind, w: mouthKind === "line" ? lerp(0.18, 0.28) : hw * lerp(0.7, 0.95), h: mouthKind === "teeth" ? lerp(0.1, 0.14) : mouthKind === "speaker" ? lerp(0.08, 0.11) : lerp(0.05, 0.07) },
    top: { kind: top, h: top === "antenna" ? lerp(0.22, 0.42) : top === "dish" ? lerp(0.14, 0.2) : top === "chimney" ? lerp(0.16, 0.24) : 0.2 },
    arms: { len: h * lerp(0.62, 0.82), r: lerp(0.055, 0.09), hand: pick(["claw", "mitt", "ball"] as const) },
    legs: { len: lerp(0.18, 0.5), r: lerp(0.06, 0.1), foot: lerp(0.17, 0.26), stance: lerp(0.42, 0.55) },
    emotion: pick(EMOTIONS), yaw: lerp(-0.4, 0.4),
  });
}

// Swap some part groups of a robot for freshly rolled ones; everything else stays.
export function shuffleParts(spec: RobotSpec, groups: PartGroup[], seed: number): RobotSpec {
  const donor = randomRobot(seed);
  const s: RobotSpec = JSON.parse(JSON.stringify(spec));
  for (const g of groups) {
    if (g === "body") s.body = donor.body;
    if (g === "head") { s.head = donor.head; s.face.visor = donor.face.visor; }
    if (g === "face") { s.face = { ...donor.face, temper: s.face.temper }; s.mouth = donor.mouth; }
    if (g === "top") s.top = donor.top;
    if (g === "limbs") { s.arms = donor.arms; s.legs = donor.legs; }
    if (g === "colors") { s.metal = donor.metal; s.trim = donor.trim; }
  }
  return fitRobot(s);
}

// Repair a spec so its parts fit together.
export function fitRobot(input: RobotSpec): RobotSpec {
  const s: RobotSpec = JSON.parse(JSON.stringify(input));
  const B = s.body, H = s.head, F = s.face, M = s.mouth;
  if (B.shape === "bulb") { B.hatch = false; H.neck = Math.max(H.neck, 0.06); }
  if (B.shape === "box") B.taper = 0;
  if (B.shape === "bulb") B.taper = Math.min(Math.max(B.taper, 0), 0.06);
  if (B.h < 0.82) B.hatch = false;
  if (H.shape === "bulb") H.h = Math.max(H.h, H.w * 1.4);
  // band visors only on box heads (on a can they read as a famous TV robot)
  if (F.visor === "band" && H.shape !== "box") F.visor = "goggles";
  if (F.visor === "band") F.eyes = 2;

  const faceW = H.w * (H.shape === "box" ? 0.92 : 0.84);
  const ring = F.visor === "goggles" ? 1.55 : 1.45;
  if (F.eyes === 1) { F.eye = Math.min(F.eye, H.w * 0.46); F.spread = 0; }
  else if (F.visor === "porthole") { F.eye = Math.min(Math.max(F.eye, 0.11), 0.14); F.spread = F.eye * 1.18; } // close together, or they get lost in the dark glass
  else {
    F.eye = Math.min(F.eye, faceW / (1.6 + ring));
    const lo = F.eye * 1.6, hi = Math.max(lo, faceW - F.eye * ring);
    F.spread = F.spread < 0 ? lo + (hi - lo) * -F.spread : Math.min(Math.max(F.spread, lo), hi);
  }
  const half = () => (F.visor === "porthole" && F.eyes === 2 ? F.spread + F.eye * 1.45 : F.eye * ring);
  if (F.visor === "porthole" && half() > H.w * 0.72) { const k = (H.w * 0.72) / half(); F.eye *= k; F.spread *= k; }

  // grow the head so the visor sits under the top with room for a mouth below (eyes shrink last)
  const k = H.shape === "dome" ? 0.42 : 0.6;
  const need = Math.max((half() + 0.13 + M.h) / k, (half() + 0.05) / (1 - k));
  if (need > 0.86) { const f = 0.86 / need; F.eye *= f; F.spread *= f; }
  H.h = Math.min(0.86, Math.max(H.h, need));
  if (H.shape === "bulb") H.w = Math.max(H.w, H.h / 1.9);
  M.w = Math.min(M.w, H.w * 1.5);
  M.h = Math.max(0.045, Math.min(M.h, H.h * k - half() - 0.13));

  s.legs.r = Math.max(s.legs.r, s.arms.r * 0.95);
  const round = (o: object) => { const r = o as Record<string, unknown>; for (const key of Object.keys(r)) if (typeof r[key] === "number") r[key] = r3(r[key] as number); };
  [B, H, F, M, s.top, s.arms, s.legs].forEach(round);
  s.yaw = r3(s.yaw);
  return s;
}
