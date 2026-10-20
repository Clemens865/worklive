export interface Agent {
  id: string;
  name: string;
  role: string;
  personality: string;
  task: string;
  color: string;
  provider: Provider;
}
export type Provider = "codex" | "claude";
export const PROVIDERS = {
  codex: { name: "Codex", color: "#2D9D8F", mark: "C" },
  claude: { name: "Claude Code", color: "#D97757", mark: "✳" },
};
export interface ProviderStatus {
  provider: Provider;
  status: "ready" | "sign_in" | "missing" | "blocked" | "unsupported" | "unavailable";
  detail: string;
  version?: string;
}
export interface RunState {
  id: string;
  agentId: string;
  provider: Provider;
  task: string;
  status: "starting" | "running" | "pausing" | "paused" | "stopping" | "stopped" | "review" | "error" | "interrupted" | "limited";
  message: string;
  text: string;
  startedAt: number;
  endedAt: number | null;
  sessionId: string | null;
  model: string | null;
  version: string | null;
  events: { at: number; message: string }[];
  artifacts: Artifact[];
  sources: { title: string; url: string; hash: string; retrievedAt: string }[];
  actions: number;
}
export interface Artifact { name: string; path: string; bytes: number; hash: string; at: number; }
export const isRunning = (run?: RunState) => !!run && ["starting", "running", "pausing", "stopping"].includes(run.status);
export interface BrowserState {
  agentId: string;
  owner: "agent" | "user";
  status: "idle" | "working" | "paused" | "complete" | "error" | "loading";
  url: string;
  title: string;
  step: number;
  message: string;
  hasRun: boolean;
}
export interface BrowserEvent {
  type: string;
  agentId?: string;
  state?: BrowserState;
  image?: string;
  seq?: number;
  message?: string;
  width?: number;
  height?: number;
  cursor?: { x: number; y: number } | null;
  run?: RunState;
}
