import * as T from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

// Small shared pieces for the Deck 7 office (ported from the ThreeJS_Characters studio).

export interface Input { look: T.Vector2; hover: boolean; poke: number; still?: boolean; emotion?: string; camElev?: number; walking?: number; act?: string }
export interface Creature { root: T.Group; update(dt: number, t: number, input: Input): void; dispose(): void }

// Drop seam duplicates and recompute normals so deformed lathes shade without stripes.
export function smooth(geo: T.BufferGeometry): T.BufferGeometry {
  geo.deleteAttribute("normal");
  geo.deleteAttribute("uv");
  const merged = mergeVertices(geo, 1e-4);
  merged.computeVertexNormals();
  geo.dispose();
  return merged;
}

// Soft round contact-shadow texture.
let blobTex: T.Texture | null = null;
export function blobTexture(): T.Texture {
  if (blobTex) return blobTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const gr = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(0,0,0,0.55)");
  gr.addColorStop(0.45, "rgba(0,0,0,0.25)");
  gr.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 128, 128);
  blobTex = new T.CanvasTexture(c);
  blobTex.colorSpace = T.SRGBColorSpace;
  return blobTex;
}

// Seeded random numbers (mulberry32), so an agent id always gives the same robot.
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
