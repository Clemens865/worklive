// Robots: a family of grumpy, funny office robots for Worklive. Each robot is plain JSON
// (built by robot.ts); its emotion is driven by the agent's work state.

export const ROBOT_FINISHES = ["metal", "painted", "cartoon"] as const;
export type RobotFinish = (typeof ROBOT_FINISHES)[number];
export const ROBOT_FINISH_LABELS: Record<RobotFinish, string> = { metal: "Brushed metal", painted: "Painted tin", cartoon: "Cartoon ink" };

// Emotions map 1:1 to what a Worklive agent is doing.
export const EMOTIONS = ["idle", "working", "thinking", "waiting", "attention", "happy", "angry", "sleepy"] as const;
export type Emotion = (typeof EMOTIONS)[number];
export const EMOTION_INFO: Record<Emotion, { label: string; state: string }> = {
  idle: { label: "Idle", state: "idle · no task" },
  working: { label: "Working", state: "running a task" },
  thinking: { label: "Thinking", state: "starting · loading" },
  waiting: { label: "Waiting", state: "waiting · rate limited" },
  attention: { label: "Needs you", state: "review · question" },
  happy: { label: "Done", state: "complete · accepted" },
  angry: { label: "Error", state: "error · interrupted" },
  sleepy: { label: "Paused", state: "paused · stopped" },
};

export type Visor = "band" | "goggles" | "porthole";
export type HeadTop = "antenna" | "lamp" | "dish" | "chimney" | "none";

export interface RobotSpec {
  kind: "robot";
  id: string;
  name: string;
  role: string; // one-line personality
  metal: string; // main body colour
  trim: string; // joints, rims, brows, boots
  body: { shape: "barrel" | "box" | "bulb"; w: number; h: number; d: number; taper: number; hatch: boolean };
  head: { shape: "can" | "dome" | "box" | "bulb"; w: number; h: number; neck: number; tilt: number };
  face: {
    visor: Visor;
    eyes: 1 | 2;
    eye: number; // eye radius
    spread: number; // eye distance from the centre
    pupil: number;
    brow: number; // brow thickness (0 = no brows)
    temper: number; // resting grumpiness: brows down at the inner end, heavy lids (0..1)
  };
  mouth: { kind: "line" | "teeth" | "speaker"; w: number; h: number };
  top: { kind: HeadTop; h: number };
  arms: { len: number; r: number; hand: "claw" | "mitt" | "ball" };
  legs: { len: number; r: number; foot: number; stance: number };
  emotion: Emotion; // default state shown in the gallery
  yaw: number;
}

export const isRobot = (s: object): s is RobotSpec => (s as { kind?: string }).kind === "robot";
