import * as T from "three";
import type { RobotFinish } from "./robot-spec";

// Materials for the robot family. "cartoon" is cel shading plus an inked outline (inverted hull),
// closest to the hand-drawn TV look; "metal" and "painted" are toy-like 3D readings of it.

const cache = new Map<string, T.Material>();
const memo = <M extends T.Material>(key: string, make: () => M): M => {
  let m = cache.get(key) as M | undefined;
  if (!m) { m = make(); cache.set(key, m); }
  return m;
};

let ramp: T.DataTexture | undefined;
function toonRamp() {
  if (ramp) return ramp;
  // two flat bands, like ink-and-paint cels: shade and lit
  ramp = new T.DataTexture(new Uint8Array([150, 150, 150, 255, 255, 255, 255, 255]), 2, 1, T.RGBAFormat);
  ramp.minFilter = ramp.magFilter = T.NearestFilter;
  ramp.needsUpdate = true;
  return ramp;
}

// Main shell: metal plates, cans, limbs.
export function shell(color: string, f: RobotFinish): T.Material {
  return memo(`shell|${color}|${f}`, () => {
    const c = new T.Color(color);
    if (f === "cartoon") return new T.MeshToonMaterial({ color: c, gradientMap: toonRamp() });
    if (f === "painted") return new T.MeshPhysicalMaterial({ color: c, roughness: 0.42, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25 });
    return new T.MeshPhysicalMaterial({ color: c, roughness: 0.32, metalness: 0.7, clearcoat: 0.3, clearcoatRoughness: 0.4 });
  });
}

// Dark parts: visor glass, mouth slot, hose rings' shadows.
export function dark(f: RobotFinish): T.Material {
  return memo(`dark|${f}`, () => f === "cartoon"
    ? new T.MeshBasicMaterial({ color: "#1d1b22" })
    : new T.MeshPhysicalMaterial({ color: "#1b1a20", roughness: 0.25, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }));
}

// Visor / porthole glass: a deep tint of the body colour, so faces don't read as black holes.
export function glass(color: string, f: RobotFinish): T.Material {
  return memo(`glass|${color}|${f}`, () => {
    const c = new T.Color(color).multiplyScalar(0.22).lerp(new T.Color("#1b2430"), 0.45);
    return f === "cartoon"
      ? new T.MeshBasicMaterial({ color: c })
      : new T.MeshPhysicalMaterial({ color: c, roughness: 0.12, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 });
  });
}

export function eyeball(f: RobotFinish): T.Material {
  return memo(`eye|${f}`, () => f === "cartoon"
    ? new T.MeshToonMaterial({ color: "#fbf8ee", gradientMap: toonRamp() })
    : new T.MeshStandardMaterial({ color: "#f8f4e8", roughness: 0.3, emissive: "#fff6dc", emissiveIntensity: 0.12 }));
}

export function iris(f: RobotFinish): T.Material {
  return memo(`iris|${f}`, () => f === "cartoon"
    ? new T.MeshBasicMaterial({ color: "#121115" })
    : new T.MeshStandardMaterial({ color: "#121115", roughness: 0.8, envMapIntensity: 0.2 }));
}

export function teeth(f: RobotFinish): T.Material {
  return memo(`teeth|${f}`, () => f === "cartoon"
    ? new T.MeshToonMaterial({ color: "#f3efe2", gradientMap: toonRamp() })
    : new T.MeshStandardMaterial({ color: "#efe9da", roughness: 0.45 }));
}

export function glow(color: string): T.Material {
  return memo(`glow|${color}`, () => new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4, roughness: 0.4 }));
}

// Inverted-hull outline: back faces pushed out along the normal, drawn flat black.
export function outline(width: number): T.Material {
  return memo(`outline|${width}`, () => {
        const m = new T.MeshBasicMaterial({ color: "#16141a", side: T.BackSide });
    m.onBeforeCompile = sh => {
      sh.uniforms.ow = { value: width };
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float ow;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed += normalize(normal) * ow;")
        // push the hull slightly back in depth so it never pokes through the shell it outlines
        .replace("#include <project_vertex>", "#include <project_vertex>\ngl_Position.z += 0.004 * gl_Position.w;");
    };
    m.customProgramCacheKey = () => `outline${width}`;
    return m;
  });
}
