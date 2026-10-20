import * as T from "three";
import { shell, outline, glow } from "./robot-materials";
import type { RobotFinish } from "./robot-spec";
import { boxGeo, canGeo } from "./robot-geo";

// Shared helper for building Deck 7 props in code: same finishes and ink outline as the robots,
// plus small canvas textures for signs, screens and grime.

export class Kit {
  geos: T.BufferGeometry[] = [];
  mats: T.Material[] = [];
  ink: T.Material | null;
  constructor(public finish: RobotFinish) {
    this.ink = finish === "cartoon" ? outline(0.022) : null;
  }
  mesh(g: T.BufferGeometry, m: T.Material, parent: T.Object3D, opts: { line?: boolean; shadow?: boolean } = {}) {
    this.geos.push(g);
    const o = new T.Mesh(g, m);
    o.castShadow = opts.shadow ?? true;
    o.receiveShadow = this.finish !== "cartoon";
    parent.add(o);
    if (this.ink && (opts.line ?? true)) o.add(new T.Mesh(g, this.ink));
    return o;
  }
  paint(c: string) { return shell(c, this.finish); }
  glow(c: string) { return glow(c); }
  box(w: number, h: number, d: number, m: T.Material, parent: T.Object3D, r = 0.04) {
    const o = this.mesh(boxGeo(w, h, d, r), m, parent);
    return o;
  }
  can(rb: number, rt: number, h: number, m: T.Material, parent: T.Object3D) { return this.mesh(canGeo(rb, rt, h, Math.min(0.04, rb * 0.3)), m, parent); }
  // flat sign / decal from a canvas drawing
  sign(w: number, h: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void, parent: T.Object3D, px = 256, glowing = false) {
    const c = document.createElement("canvas");
    c.width = px; c.height = Math.round((px * h) / w);
    draw(c.getContext("2d")!, c.width, c.height);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    const m = glowing || this.finish === "cartoon" ? new T.MeshBasicMaterial({ map: tex, transparent: true }) : new T.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7 });
    this.mats.push(m);
    const o = this.mesh(new T.PlaneGeometry(w, h), m, parent, { line: false, shadow: false });
    o.receiveShadow = false;
    return o;
  }
  // a hanging cable between two points (sags in the middle)
  cable(a: T.Vector3, b: T.Vector3, sag: number, r: number, m: T.Material, parent: T.Object3D) {
    const mid = a.clone().lerp(b, 0.5);
    mid.y -= sag;
    const curve = new T.CatmullRomCurve3([a, a.clone().lerp(mid, 0.5).setY(Math.min(a.y, mid.y + sag * 0.3)), mid, b.clone().lerp(mid, 0.5).setY(Math.min(b.y, mid.y + sag * 0.3)), b]);
    return this.mesh(new T.TubeGeometry(curve, 24, r, 8), m, parent, { line: false });
  }
  dispose() { this.geos.forEach(g => g.dispose()); this.mats.forEach(m => m.dispose()); }
}

// Stencil-style label text used on all signs.
export function label(g: CanvasRenderingContext2D, W: number, H: number, text: string, opts: { bg?: string; fg?: string; size?: number; border?: string } = {}) {
  if (opts.bg) { g.fillStyle = opts.bg; g.fillRect(0, 0, W, H); }
  if (opts.border) { g.strokeStyle = opts.border; g.lineWidth = Math.max(3, H * 0.06); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, W - g.lineWidth, H - g.lineWidth); }
  g.fillStyle = opts.fg ?? "#1d1b22";
  const lines = text.split("\n");
  let size = opts.size ?? Math.min(H / (lines.length * 1.25), W / (Math.max(...lines.map(l => l.length)) * 0.62));
  g.font = `800 ${size}px Manrope, system-ui, sans-serif`;
  // measure for real and shrink until the widest line fits inside the border
  const widest = () => Math.max(...lines.map(l => g.measureText(l).width));
  for (let i = 0; i < 12 && widest() > W * 0.84; i++) { size *= 0.9; g.font = `800 ${size}px Manrope, system-ui, sans-serif`; }
  g.textAlign = "center";
  g.textBaseline = "middle";
  lines.forEach((l, i) => g.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * size * 1.2));
}
