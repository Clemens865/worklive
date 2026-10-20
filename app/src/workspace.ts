import { invoke } from "@tauri-apps/api/core";

// Two fully separate workspaces in one app: "studio" (the Worklive office) and "deck7" (the robot
// crew). The backend keeps a separate data folder per workspace (agents, runs, chats, knowledge,
// projects, files, browser profiles) and restarts to switch. The UI needs the answer synchronously
// at startup, so the last known value is mirrored in localStorage and checked against the backend.

export type Workspace = "studio" | "deck7";
const KEY = "worklive.workspace";
const read = (): Workspace => { try { return localStorage.getItem(KEY) === "deck7" ? "deck7" : "studio"; } catch { return "studio"; } };
export const WORKSPACE: Workspace = read();
export const isDeck = WORKSPACE === "deck7";

/** If the backend disagrees (first start, cleared storage), adopt its value and reload the UI. */
export async function verifyWorkspace() {
  try {
    const actual = await invoke<string>("get_workspace");
    if ((actual === "deck7" ? "deck7" : "studio") !== WORKSPACE) {
      localStorage.setItem(KEY, actual);
      location.reload();
    }
  } catch { /* web preview without the backend: keep the local value */ }
}

/** Switch workspace: the app restarts on the other data folder. */
export async function switchWorkspace(to: Workspace) {
  try { localStorage.setItem(KEY, to); } catch { /* storage blocked */ }
  try { await invoke("set_workspace", { workspace: to }); } catch { location.reload(); } // web preview: just reload
}
