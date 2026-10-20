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

const toonCache = new Map();
// Toon material with a warm rim light added in the shader.
export function toon(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (toonCache.has(key)) return toonCache.get(key);
  const { rim: rimOpt, ...rest } = opts;
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

// Add an ink hull to a mesh (shares geometry). Skip for tiny details.
export function ink(mesh, width = 0.012, color) {
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
  if (!geoCache.has(key)) geoCache.set(key, make());
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
