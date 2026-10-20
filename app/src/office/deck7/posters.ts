import * as T from "three";
import { label } from "./kit";
import type { RoomDims } from "./room";

// Posters on Deck 7's walls that the user designs: text in a few poster colours, or an uploaded image
// with an optional caption. Saved on this computer (localStorage); images are downscaled first.

export type PosterCfg = { kind: "text"; text: string; bg: string; fg: string } | { kind: "image"; src: string; caption: string; bg: string; fg: string };
interface Slot { id: string; pos: T.Vector3; rotY: number; w: number; h: number; tilt: number; def: PosterCfg }

const KEY = "worklive.deck7.posters";
export const POSTER_COLORS: [string, string][] = [["#f2c94c", "#1d1b22"], ["#f4f1ea", "#c0462f"], ["#2c3440", "#f2c94c"], ["#c0462f", "#f4f1ea"], ["#5fbf9f", "#1d1b22"], ["#8f86d6", "#f4f1ea"]];

export function posterSlots(d: RoomDims, windowsAt: number[]): Slot[] {
  const back = d.z0 + 0.02, left = d.x0 + 0.02;
  const t = (text: string, i: number): PosterCfg => ({ kind: "text", text, bg: POSTER_COLORS[i][0], fg: POSTER_COLORS[i][1] });
  return [
    { id: "back-left", pos: new T.Vector3(d.x0 + 2.6, 2.4, back), rotY: 0, w: 1.3, h: 0.8, tilt: 0, def: t("DAYS WITHOUT\nINCIDENT: 0", 0) },
    { id: "back-middle", pos: new T.Vector3(windowsAt[windowsAt.length - 1] + 2.4, 2.6, back), rotY: 0, w: 1.15, h: 0.75, tilt: 0.04, def: t("MORALE IS\nMANDATORY", 1) },
    { id: "back-right", pos: new T.Vector3(d.x1 - 3.4, 1.6, back), rotY: 0, w: 1.05, h: 0.6, tilt: -0.05, def: t("PLEASE DO NOT\nLICK THE REACTOR", 1) },
    { id: "left-1", pos: new T.Vector3(left, 2.5, d.z0 + 5.2), rotY: Math.PI / 2, w: 1.4, h: 0.95, tilt: 0.03, def: t("YOUR POSTER\nHERE\n(click me)", 2) },
    { id: "left-2", pos: new T.Vector3(left, 2.5, (d.z0 + d.z1) / 2 + 3.4), rotY: Math.PI / 2, w: 1.4, h: 0.95, tilt: -0.03, def: t("EMPLOYEE OF\nTHE CYCLE:\nNOBODY", 4) },
  ];
}

export function loadPosters(): Record<string, PosterCfg> {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
export function savePoster(id: string, cfg: PosterCfg | null) {
  const all = loadPosters();
  if (cfg) all[id] = cfg; else delete all[id];
  try { localStorage.setItem(KEY, JSON.stringify(all)); return true; } catch { return false; } // full storage: the caller says so
}

// Draw a poster (also used for the editor's preview). Calls back when an image has loaded.
export function drawPoster(c: HTMLCanvasElement, cfg: PosterCfg, done: () => void = () => {}) {
  const g = c.getContext("2d")!, W = c.width, H = c.height;
  g.fillStyle = cfg.bg; g.fillRect(0, 0, W, H);
  const b = Math.max(6, H * 0.03);
  g.strokeStyle = cfg.fg; g.lineWidth = b; g.strokeRect(b * 1.5, b * 1.5, W - b * 3, H - b * 3);
  const tape = () => { g.fillStyle = "rgba(242,234,210,0.85)"; for (const [x, a] of [[W * 0.12, -0.5], [W * 0.88, 0.5]] as const) { g.save(); g.translate(x, 6); g.rotate(a); g.fillRect(-26, -8, 52, 18); g.restore(); } };
  if (cfg.kind === "text") { label(g, W, H, cfg.text || " ", { fg: cfg.fg }); tape(); done(); return; }
  const img = new Image();
  img.onload = () => {
    const capH = cfg.caption ? H * 0.2 : 0, pad = b * 3;
    const boxW = W - pad * 2, boxH = H - pad * 2 - capH;
    const s = Math.min(boxW / img.width, boxH / img.height);
    g.drawImage(img, (W - img.width * s) / 2, pad + (boxH - img.height * s) / 2, img.width * s, img.height * s);
    if (cfg.caption) { g.save(); g.translate(0, H - pad - capH); label(g, W, capH, cfg.caption, { fg: cfg.fg }); g.restore(); }
    tape();
    done();
  };
  img.src = cfg.src;
}

// Downscale an uploaded image to keep storage small (max 640 px, JPEG).
export function shrinkImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const s = Math.min(1, 640 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn't an image this computer can read.")); };
    img.src = url;
  });
}

export function buildPosters(d: RoomDims, windowsAt: number[], cartoon: boolean) {
  const group = new T.Group();
  const saved = loadPosters();
  const items = posterSlots(d, windowsAt).map(slot => {
    const c = document.createElement("canvas");
    c.width = 512; c.height = Math.round((512 * slot.h) / slot.w);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    const mat = cartoon ? new T.MeshBasicMaterial({ map: tex }) : new T.MeshStandardMaterial({ map: tex, roughness: 0.8 });
    const mesh = new T.Mesh(new T.PlaneGeometry(slot.w, slot.h), mat);
    mesh.position.copy(slot.pos);
    mesh.rotation.set(0, slot.rotY, slot.tilt);
    mesh.userData.poster = slot.id;
    mesh.userData.keep = true; // its texture changes: never merged
    group.add(mesh);
    const paint = (cfg: PosterCfg) => drawPoster(c, cfg, () => (tex.needsUpdate = true));
    paint(saved[slot.id] ?? slot.def);
    return { slot, mesh, paint };
  });
  return {
    group,
    meshes: items.map(i => i.mesh),
    get(id: string) { return loadPosters()[id] ?? items.find(i => i.slot.id === id)!.slot.def; },
    def(id: string) { return items.find(i => i.slot.id === id)!.slot.def; },
    aspect(id: string) { const s = items.find(i => i.slot.id === id)!.slot; return s.h / s.w; },
    set(id: string, cfg: PosterCfg | null) { const it = items.find(i => i.slot.id === id); if (!it) return true; const ok = savePoster(id, cfg); it.paint(cfg ?? it.slot.def); return ok; },
  };
}
