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
  projectId?:string;
  taskId?:string;
  taskTitle?:string;
  taskRevision?:number;
  handoffId?:string;
  handoff?:Handoff;
  contextKey?: string;
  freshContext?: boolean;
  contextUsed?: {id:string;revision:number;title:string;scope:string;locator?:string;hash?:string;warning?:string;part?:number;text?:string;excerpt?:string;preview?:string}[];
  memoriesAdded?: {id:string;title:string;scope:string;status:string}[];
}
export interface Artifact { kind?:"deliverable"|"reply"; name: string; path: string; bytes: number; hash: string; at: number; }
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
  workflow?:WorkflowState;
}

export interface Handoff {taskId?:string;taskTitle?:string;sourceTaskId?:string;id:string;sourceRun:string;sourceAgent:string;recipient:string;projectId:string;projectName:string;fileName:string;hash:string;brief:string;createdAt:number;sourceReviewedAt:number;state:"queued"|"started"|"cancelled";runId:string;runStatus?:string;}
export interface Project {id:string;name:string;goal:string;revision:number;updatedAt:number;}
export interface TaskFile {id:string;title:string;revision:number;hash:string;warning:string;createdAt:number;}
export interface ProjectTask {files?:TaskFile[];handoffId?:string;handoff?:Handoff;id:string;projectId:string;title:string;brief:string;agentId:string;dependsOn:string;revision:number;createdAt:number;updatedAt:number;runId:string;status:'planned'|'working'|'attention'|'review'|'accepted';blocked:string;runStatus:string|null;message:string;provider:Provider|null;}
export interface WorkflowState {reviews:{runId:string;rootId:string;agentId:string;accepted:boolean;reviewedAt:number}[];handoffs:Handoff[];projects:Project[];tasks:ProjectTask[];assignments:Record<string,string>;acceptedMilestones:number;busy:boolean;}
