import * as T from "three";
import { PROVIDERS } from "../../types";
import { buildRobot } from "./robot";
import { randomRobot, shuffleParts, fitRobot, PART_GROUPS, type PartGroup } from "./robot-random";
import type { RobotSpec, Emotion } from "./robot-spec";
import type { RobotParts } from "./world";
import { cue } from "./sound";

// The robot creator: Deck 7's "hire an agent" (and "rebuild an agent") dialog. Same result shape as
// the studio's hire dialog (name, role, provider, description, lookSeed, look), with a live robot on
// a turntable and part-by-part shuffles. The parts are saved in look.robot.

export interface RobotDraft { name: string; role: string; provider: "codex" | "claude"; description: string; traits: string[]; lookSeed: string; look: { robot: RobotParts } }
interface Options {
  taken?: string[];
  deskFor?: () => number | null;
  suggest?: (field: string, draft: RobotDraft, taken: string[]) => Promise<string>;
  /** Rebuild an existing robot: only the parts can change. */
  edit?: { name: string; provider: "codex" | "claude"; look?: Record<string, unknown> | null; lookSeed?: string };
  onDone: (draft: RobotDraft) => void;
}

const PART_LABEL: Record<PartGroup, string> = { body: "Body", head: "Head", face: "Face", top: "Top", limbs: "Limbs", colors: "Colours" };
export const partsOf = (s: RobotSpec): RobotParts => ({ metal: s.metal, body: s.body, head: s.head, face: s.face, mouth: s.mouth, top: s.top, arms: s.arms, legs: s.legs });
const seedNow = () => Math.floor(Math.random() * 1e9);

export function openRobotDialog(o: Options) {
  const editing = !!o.edit;
  let seed = seedNow();
  let spec: RobotSpec = randomRobot(seed);
  const saved = (o.edit?.look as { robot?: RobotParts } | undefined)?.robot;
  if (saved) spec = fitRobot({ ...spec, ...saved });
  const draft: RobotDraft = { name: o.edit?.name ?? "", role: "", provider: o.edit?.provider ?? "claude", description: "", traits: [], lookSeed: o.edit?.lookSeed ?? String(seed), look: { robot: partsOf(spec) } };

  const dialog = document.createElement("dialog");
  dialog.className = "deck7-creator";
  dialog.innerHTML = `
    <form method="dialog" class="dc-wrap">
      <div class="dc-stage"><canvas></canvas><div class="dc-parts">
        ${PART_GROUPS.map(g => `<button type="button" data-part="${g}">${PART_LABEL[g]}</button>`).join("")}
        <button type="button" data-part="all" class="dc-all">Surprise me</button></div></div>
      <div class="dc-form">
        <p class="dc-kicker">${editing ? "Maintenance bay" : "Robot requisition form 7-B"}</p>
        <h2>${editing ? "Rebuild " + escapeHtml(o.edit!.name) : "Order a new robot"}</h2>
        <p class="dc-sub">${editing ? "Swap parts until it looks right. Name, job and provider stay as they are." : "Pick a name, a job and a provider. The parts are on us. Mostly."}</p>
        ${editing ? "" : `
        <label>Name<span class="dc-row"><input name="name" maxlength="40" required placeholder="e.g. Rivet"><button type="button" data-suggest="name">Suggest</button></span></label>
        <label>Job<span class="dc-row"><input name="role" maxlength="60" required placeholder="e.g. Researcher"><button type="button" data-suggest="role">Suggest</button></span></label>
        <label>Powered by<select name="provider">${Object.entries(PROVIDERS).map(([k, p]) => `<option value="${k}">${p.name}</option>`).join("")}</select></label>
        <label>Personality<textarea name="description" rows="3" maxlength="2000" placeholder="Grumpy but brilliant. Hates meetings."></textarea></label>
        <p class="dc-note">Suggestions come from Claude Code or Codex through your own subscription. They take a few seconds.</p>`}
        <div class="dc-actions"><span class="dc-desk"></span><button type="button" value="cancel" data-cancel>Cancel</button><button type="submit" class="dc-primary">${editing ? "Save robot" : "Order robot"}</button></div>
      </div>
    </form>`;
  document.body.append(dialog);
  const $ = <E extends Element>(sel: string) => dialog.querySelector(sel) as E;
  if (!editing) {
    ($<HTMLSelectElement>("[name=provider]")).value = draft.provider;
    const desk = o.deskFor?.();
    $<HTMLElement>(".dc-desk").textContent = desk === null || desk === undefined ? "No free station" : `Docking station ${desk + 1}`;
  }

  // live preview
  const canvas = $<HTMLCanvasElement>("canvas");
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = T.NeutralToneMapping;
  const scene = new T.Scene();
  scene.add(new T.HemisphereLight("#fff1dc", "#3a3f4a", 1.6));
  const key = new T.DirectionalLight("#fff4e6", 2);
  key.position.set(-2, 5, 4);
  scene.add(key);
  const camera = new T.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 1.8, 7.4);
  camera.lookAt(0, 1.1, 0);
  const turntable = new T.Group();
  scene.add(turntable);
  let robot: ReturnType<typeof buildRobot> | null = null;
  let emotion: Emotion = "happy", emotionUntil = 1.2;
  const input = { look: new T.Vector2(), hover: false, poke: 0, emotion: "happy" as string, camElev: 0.2 };
  function rebuild() {
    if (robot) { turntable.remove(robot.root); robot.dispose(); }
    spec = fitRobot({ ...spec, trim: PROVIDERS[draft.provider].color, yaw: 0, emotion: "idle" });
    robot = buildRobot(spec, "cartoon");
    turntable.add(robot.root);
    draft.look = { robot: partsOf(spec) };
    emotion = "happy"; emotionUntil = clock + 1.4; input.poke++;
  }
  let clock = 0, last = performance.now(), alive = true;
  function frame(now: number) {
    if (!alive) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; clock += dt;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    turntable.rotation.y = Math.sin(clock * 0.5) * 0.7;
    if (clock > emotionUntil) emotion = "idle";
    input.emotion = emotion;
    robot?.update(dt, clock, input);
    renderer.render(scene, camera);
  }
  rebuild();
  requestAnimationFrame(frame);

  dialog.querySelectorAll<HTMLButtonElement>("[data-part]").forEach(b => (b.onclick = () => {
    seed = seedNow();
    spec = b.dataset.part === "all" ? { ...randomRobot(seed), name: spec.name } : shuffleParts(spec, [b.dataset.part as PartGroup], seed);
    cue("click");
    rebuild();
  }));
  if (!editing) {
    $<HTMLSelectElement>("[name=provider]").onchange = e => { draft.provider = (e.target as HTMLSelectElement).value as RobotDraft["provider"]; rebuild(); };
    dialog.querySelectorAll<HTMLButtonElement>("[data-suggest]").forEach(b => (b.onclick = async () => {
      if (!o.suggest) return;
      const field = b.dataset.suggest!, input = $<HTMLInputElement>(`[name=${field}]`);
      b.disabled = true; b.textContent = "…";
      try {
        draft.name = $<HTMLInputElement>("[name=name]").value; draft.role = $<HTMLInputElement>("[name=role]").value;
        const text = await o.suggest(field, draft, o.taken ?? []);
        if (text) input.value = text.slice(0, field === "name" ? 40 : 60);
      } catch { /* the app shows its own error toast */ } finally { b.disabled = false; b.textContent = "Suggest"; }
    }));
  }
  const close = () => { alive = false; robot?.dispose(); renderer.dispose(); dialog.close(); dialog.remove(); };
  $<HTMLButtonElement>("[data-cancel]").onclick = close;
  dialog.addEventListener("cancel", close);
  $<HTMLFormElement>("form").onsubmit = e => {
    e.preventDefault();
    if (!editing) {
      draft.name = $<HTMLInputElement>("[name=name]").value.trim();
      draft.role = $<HTMLInputElement>("[name=role]").value.trim();
      draft.description = $<HTMLTextAreaElement>("[name=description]").value.trim();
      if (!draft.name || !draft.role) return;
      if (o.taken?.some(n => n.toLowerCase() === draft.name.toLowerCase())) { $<HTMLInputElement>("[name=name]").setCustomValidity("Another robot already has this name."); $<HTMLInputElement>("[name=name]").reportValidity(); return; }
    }
    draft.lookSeed = String(seed);
    cue("hire");
    const done = { ...draft, look: { robot: partsOf(spec) } };
    close();
    o.onDone(done);
  };
  dialog.showModal();
}

function escapeHtml(s: string) { return s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!); }
