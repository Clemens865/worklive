import type { Emotion } from "./robot-spec";
import type { FaceState } from "./robot-face";
import type { ArmPose } from "./robot-limbs";

// What each emotion looks like at rest: face, and arm poses [screen-left arm, screen-right arm].
// The motion on top (typing, stomping, bouncing) lives in robot-anim.ts.

type Face = Omit<FaceState, "lookX" | "lookY"> & { lookX?: number; lookY?: number };

const P = (z: number, x: number, bz: number, bx: number): ArmPose => ({ z, x, bz, bx });
export const POSES = {
  down: P(0.15, 0.05, -0.1, 0.15),
  hips: P(0.8, -0.15, -1.9, 0.25),
  type: P(0.3, 0.95, -0.5, 0.9),
  chin: P(0.25, 0.75, -1.2, 1.9),
  wave: P(2.3, 0.15, 0.5, 0),
  cheer: P(2.6, 0.1, 0.25, 0),
  fist: P(0.45, 0.55, -0.3, 1.9),
  cross: P(0.25, 1.3, -2.3, 0.15),
  limp: P(0.06, -0.05, 0, -0.05),
};

export const EMO: Record<Emotion, { face: Face; arms: [ArmPose, ArmPose] }> = {
  idle: { face: { upper: 0.25, slant: 0, lower: 0, browY: 0, browAng: 0, smile: 0.1, open: 0, pupil: 1 }, arms: [POSES.down, POSES.down] },
  working: { face: { upper: 0.45, slant: 0.25, lower: 0.15, browY: -0.1, browAng: 0.35, smile: -0.1, open: 0, pupil: 0.85, lookY: -0.55 }, arms: [POSES.type, POSES.type] },
  thinking: { face: { upper: 0.15, slant: -0.3, lower: 0, browY: 0.3, browAng: -0.45, smile: -0.25, open: 0, pupil: 1, lookX: 0.55, lookY: 0.6 }, arms: [POSES.hips, POSES.chin] },
  waiting: { face: { upper: 0.52, slant: 0, lower: 0.08, browY: -0.05, browAng: 0.1, smile: -0.4, open: 0, pupil: 0.8 }, arms: [POSES.cross, POSES.cross] },
  attention: { face: { upper: 0, slant: -0.2, lower: 0, browY: 0.5, browAng: -0.3, smile: 0.35, open: 0.4, pupil: 1.1 }, arms: [POSES.hips, POSES.wave] },
  happy: { face: { upper: 0, slant: -0.1, lower: 0.55, browY: 0.4, browAng: -0.25, smile: 1, open: 0.45, pupil: 1 }, arms: [POSES.cheer, POSES.cheer] },
  angry: { face: { upper: 0.42, slant: 0.85, lower: 0.2, browY: -0.28, browAng: 1, smile: -1, open: 0.55, pupil: 0.7 }, arms: [POSES.fist, POSES.fist] },
  sleepy: { face: { upper: 0.82, slant: -0.1, lower: 0.12, browY: -0.1, browAng: -0.15, smile: -0.1, open: 0.12, pupil: 1 }, arms: [POSES.limp, POSES.limp] },
};
