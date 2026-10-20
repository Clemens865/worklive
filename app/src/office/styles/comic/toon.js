import * as T from "three";

// Shared toon materials, gradient ramp and inverted-hull ink outlines.
// Everything is cached so 20 agents share materials.

let ramp;
export function gradientMap() {
  if (ramp) return ramp;
  const data = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 214, 214, 214, 255, 255, 255, 255, 255]);
  ramp = new T.DataTexture(data, 4, 1, T.RGBAFormat);
  ramp.minFilter = ramp.magFilter = T.NearestFilter; ramp.generateMipmaps = false; ramp.needsUpdate = true;
  return ramp;
}

// Finish: "comic" (toon + ink outlines, the default) or "clay" (soft plasticine, no outlines).
// Builders call toon()/ink() as usual; withFinish() switches what those produce while a character is built.
let FINISH = "comic";
export const finish = () => FINISH;
export function withFinish(f, build) {
  const prev = FINISH; FINISH = f || "comic";
  try { return build(); } finally { FINISH = prev; }
}

const toonCache = new Map();
// Toon material with a warm rim light added in the shader.
export function toon(color, opts = {}) {
  if (FINISH === "clay") return clay(color, opts);
  const key = color + JSON.stringify(opts);
  if (toonCache.has(key)) return toonCache.get(key);
  const { rim: rimOpt, gloss: _gloss, ...rest } = opts;
  const m = new T.MeshToonMaterial({ color, gradientMap: gradientMap(), ...rest });
  const rim = rimOpt ?? 0.28;
  if (rim > 0) {
    m.onBeforeCompile = sh => {
      sh.uniforms.rimStrength = { value: rim };
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float rimStrength;")
        .replace("#include <opaque_fragment>", `
          float rimF = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
          outgoingLight += diffuseColor.rgb * smoothstep(0.62, 0.78, rimF) * rimStrength;
          #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => "rim" + rim;
  }
  toonCache.set(key, m);
  return m;
}

// ---------- Clay ----------
// Plasticine: soft, slightly glossy, warm light bleeding through the edges, and an uneven hand-made surface
// (lumps + thumb smudges) from 3D noise in the object's own space, so the pattern sticks to the body while it moves.
// One shared uniform block: the workbench tunes it live for every clay material.
export const CLAY = { lumps: { value: 1 }, detail: { value: 1 }, warmth: { value: 1 } };
const clayCache = new Map();
const NOISE = `
  float clayHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float clayNoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(clayHash(i), clayHash(i + vec3(1,0,0)), f.x), mix(clayHash(i + vec3(0,1,0)), clayHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(clayHash(i + vec3(0,0,1)), clayHash(i + vec3(1,0,1)), f.x), mix(clayHash(i + vec3(0,1,1)), clayHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }`;
function clay(color, opts = {}) {
  const gloss = opts.gloss ?? 0, side = opts.side, transparent = opts.transparent, opacity = opts.opacity;
  const key = [color, gloss, side, transparent, opacity, opts.depthWrite].join("|");
  if (clayCache.has(key)) return clayCache.get(key);
  const m = new T.MeshStandardMaterial({ color, roughness: gloss ? 0.18 : 0.62, metalness: 0 });
  if (side !== undefined) m.side = side;
  if (transparent) Object.assign(m, { transparent, opacity, depthWrite: opts.depthWrite ?? true });
  if (!gloss) {
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { clayLumps: CLAY.lumps, clayDetail: CLAY.detail, clayWarm: CLAY.warmth });
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vClayPos;")
        // object space in metres (heads are built at unit size and scaled down)
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvClayPos = transformed * length(modelMatrix[0].xyz);");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vClayPos;\nuniform float clayLumps, clayDetail, clayWarm;" + NOISE)
        .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
          {
            // height: broad lumps + finer thumb smudges, faded out where they would shimmer at a distance
            vec3 q = vClayPos;
            float fade = 1.0 - smoothstep(0.25, 0.9, length(fwidth(q * 60.0)));
            float h = clayNoise(q * 9.0) * 0.004 * clayLumps + (clayNoise(q * 38.0) + 0.5 * clayNoise(q * 85.0)) * 0.0011 * clayDetail * fade;
            // surface gradient from screen derivatives (Mikkelsen): resolution independent
            vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
            vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
            float det = dot(dpx, r1);
            if (abs(det) > 1e-12) normal = normalize(normal - (dFdx(h) * r1 + dFdy(h) * r2) / det);
          }`)
        .replace("#include <opaque_fragment>", `
          // light bleeding through thin, rounded edges (cheap subsurface look)
          float clayRim = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
          outgoingLight += diffuseColor.rgb * vec3(1.0, 0.72, 0.6) * pow(clayRim, 2.5) * 0.35 * clayWarm;
          #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => "clay";
  }
  clayCache.set(key, m);
  return m;
}

const basicCache = new Map();
export function flat(color) {
  if (!basicCache.has(color)) basicCache.set(color, new T.MeshBasicMaterial({ color }));
  return basicCache.get(color);
}

// Inverted hull: back faces pushed out along normals in view space, roughly constant screen width.
const inkCache = new Map();
export function inkMaterial(width = 0.012, color = "#231a1e") {
  const key = width + color;
  if (inkCache.has(key)) return inkCache.get(key);
  const m = new T.ShaderMaterial({
    uniforms: { width: { value: width }, color: { value: new T.Color(color) } },
    vertexShader: `
      uniform float width;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        float d = clamp(-mv.z, 0.5, 30.0);
        float w = width * mix(1.0, sqrt(d) * 0.9, 0.85);
        mv.xyz += n * w;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 color; void main(){ gl_FragColor = vec4(color, 1.0); }`,
    side: T.BackSide,
  });
  inkCache.set(key, m);
  return m;
}

// Add an ink hull to a mesh (shares geometry). Skip for tiny details. Clay has no outlines.
export function ink(mesh, width = 0.012, color) {
  if (FINISH === "clay") return mesh;
  const hull = new T.Mesh(mesh.geometry, inkMaterial(width, color));
  hull.castShadow = false; hull.receiveShadow = false;
  hull.raycast = () => {};
  mesh.add(hull);
  return mesh;
}

// Mesh helper: toon mesh + optional outline, added to parent.
export function part(geo, material, parent, { ink: w = 0.01, shadow = true, pos, rot, scale } = {}) {
  const m = new T.Mesh(geo, typeof material === "string" ? toon(material) : material);
  m.castShadow = shadow; m.receiveShadow = true;
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scale) typeof scale === "number" ? m.scale.setScalar(scale) : m.scale.set(...scale);
  if (w) ink(m, w);
  parent.add(m);
  return m;
}

// Geometry cache so identical shapes are shared across characters.
const geoCache = new Map();
export function geo(key, make) {
  if (!geoCache.has(key)) { const g = make(); if (!g.name) g.name = key.split(/[:,]/)[0]; geoCache.set(key, g); }
  return geoCache.get(key);
}

// Deterministic hash + RNG
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed) {
  let s = seed || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}
export const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
