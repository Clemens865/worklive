// Jelly bean "snail" agent: a translucent bean that glides on its foot, with snail eye stalks.
// Look: MeshPhysicalMaterial transmission + thickness + attenuation (Beer–Lambert colour), clearcoat for the wet skin.
// Feel: per-bean spring state (squash, lean) + a travelling wave along the foot, all done in the vertex shader.
import * as THREE from "three";

export const PALETTES = {
  provider: { codex: "#2D9D8F", claude: "#D97757" },   // product rule: Codex teal, Claude terracotta
  vivid:    { codex: "#2f7de1", claude: "#e0453a" },   // the "blue / red" option, for comparison
};

// Bean silhouette: a smooth capsule lying on its foot, tail a bit thinner, front end curving up into the head.
function beanGeometry() {
  const g = new THREE.SphereGeometry(1, 72, 48);
  const p = g.attributes.position, v = new THREE.Vector3();
  const L = 0.5, W = 0.25, H = 0.22;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const t = (v.z + 1) / 2;                               // 0 tail … 1 head
    const s = 0.78 + 0.3 * THREE.MathUtils.smoothstep(t, 0, 0.75);
    let x = v.x * W * s, y = v.y * H * s, z = v.z * L;
    const lift = 0.2 * Math.pow(Math.max(0, (t - 0.45) / 0.55), 2); // the head rises like a curious snail
    y += H * 0.92 + lift;
    z -= lift * 0.25;
    // flat, soft foot on the floor (only under the low body; the raised head floats free)
    const floor = 0.025 + lift * 0.9, k = 0.025;          // soft clamp (softplus): no crease where the foot flattens
    y = floor + k * Math.log1p(Math.exp((y - floor) / k));
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}
const BEAN = beanGeometry();
// Head anchors from the actual shape: top of the head (eye stalks, hats) and the front (smile).
export const HEAD = (() => {
  const p = BEAN.attributes.position; let top = { y: -1 }, nose = { z: -1 };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (Math.abs(x) < 0.02 && z > 0.2 && y > top.y) top = { x: 0, y, z };
    if (Math.abs(x) < 0.02 && z > nose.z) nose = { x: 0, y, z };
  }
  // the smile sits on the front face, a bit above the nose line
  let face = { z: -1 };
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (Math.abs(x) < 0.02 && Math.abs(y - (nose.y + 0.09)) < 0.03 && z > face.z) face = { x: 0, y, z }; }
  return { top, nose, face };
})();

// Shared shader patch: squash/stretch, lean (shear) and the crawl wave along the foot.
function patch(material, u) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
        uniform float uTime, uSquash, uCrawl, uPhase;
        uniform vec2 uLean;
        vec3 jelly(vec3 p) {
          float h = clamp(p.y / 0.6, 0.0, 1.0);
          // squash keeps the volume roughly constant: shorter and wider, or taller and thinner
          p.y *= 1.0 - uSquash;
          p.xz *= 1.0 + uSquash * 0.55;
          // lean: the top lags behind the foot (inertia), more the higher the point
          p.xz += uLean * h * h;
          // crawl: muscle waves run from tail to head along the foot, like a snail
          float wave = sin(p.z * 14.0 - uTime * 9.0 + uPhase);
          p.y += uCrawl * 0.018 * wave * (1.0 - h * 0.6);
          p.x *= 1.0 + uCrawl * 0.03 * wave;
          // idle breathing
          p.y *= 1.0 + 0.012 * sin(uTime * 2.1 + uPhase);
          return p;
        }`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        transformed = jelly(transformed);`);
  };
  material.customProgramCacheKey = () => "jelly-bean";
}

export function createBean(color, { seed = 0 } = {}) {
  const u = { uTime: { value: 0 }, uSquash: { value: 0 }, uCrawl: { value: 0 }, uPhase: { value: seed * 1.7 }, uLean: { value: new THREE.Vector2() } };
  const tint = new THREE.Color(color);
  const body = new THREE.MeshPhysicalMaterial({
    color: tint.clone().lerp(new THREE.Color("#ffffff"), 0.2),
    transmission: 1,               // see-through
    thickness: 0.5,                // how much jelly the light crosses
    attenuationColor: tint,        // Beer–Lambert: thick parts get deeper colour
    attenuationDistance: 0.55,
    emissive: tint, emissiveIntensity: 0.18, // a little inner glow so it never turns muddy in shadow
    ior: 1.42,                     // gelatin
    roughness: 0.07,
    clearcoat: 1, clearcoatRoughness: 0.06, // wet skin
    sheen: 0.6, sheenColor: tint.clone().lerp(new THREE.Color("#ffffff"), 0.6), sheenRoughness: 0.4,
    specularIntensity: 0.9,
  });
  patch(body, u);
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(BEAN, body);
  mesh.castShadow = true;
  group.add(mesh);

  // Bubbles and a few "seeds" suspended in the jelly (opaque, so they show through the transmission).
  const rnd = mulberry(seed + 3);
  const bubbleMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.1, transparent: true, opacity: 0.55 });
  const seedMat = new THREE.MeshStandardMaterial({ color: tint.clone().multiplyScalar(0.45), roughness: 0.5 });
  const inner = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(i < 5 ? 0.012 + rnd() * 0.02 : 0.03, 10, 8), i < 5 ? bubbleMat : seedMat);
    s.position.set((rnd() - 0.5) * 0.3, 0.12 + rnd() * 0.25, (rnd() - 0.5) * 0.7);
    if (i >= 5) s.scale.set(0.7, 0.45, 1.2);
    inner.add(s);
  }
  group.add(inner);

  // Head: eye stalks, smile and hats ride on this group, which follows the shader deformation (see deformPoint).
  const head = new THREE.Group(); head.position.set(HEAD.top.x, HEAD.top.y, HEAD.top.z); group.add(head);
  // Snail eye stalks with big eyes; they retract when poked.
  const stalks = [];
  const stalkMat = new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.25, clearcoat: 1, transmission: 0.4, thickness: 0.1 });
  const white = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.25 });
  const black = new THREE.MeshStandardMaterial({ color: "#14161a", roughness: 0.2 });
  for (const side of [-1, 1]) {
    const stalk = new THREE.Group();
    stalk.position.set(side * 0.09, -0.03, 0.04);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.022, 0.2, 10), stalkMat);
    rod.position.y = 0.1; stalk.add(rod);
    const eye = new THREE.Group(); eye.position.y = 0.21; stalk.add(eye);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), white); eye.add(ball);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.025, 14, 10), black); pupil.position.set(0, 0, 0.034); eye.add(pupil);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), white); shine.position.set(0.01, 0.012, 0.056); eye.add(shine);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.054, 20, 12), stalkMat); lid.visible = false; eye.add(lid);
    stalk.rotation.z = -side * 0.18;
    head.add(stalk);
    stalks.push({ stalk, eye, pupil, lid, side });
  }
  // A small smile on the front of the head.
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 16, Math.PI), black);
  smile.position.set(0, HEAD.face.y - HEAD.top.y, HEAD.face.z - HEAD.top.z - 0.004); smile.rotation.set(-0.35, 0, Math.PI);
  head.add(smile);

  return { group, mesh, head, uniforms: u, stalks, smile, inner, tint };
}

export function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Same deformation as the vertex shader (without the small crawl ripple), for things attached to the body.
export function deformPoint(out, p, u) {
  const h = Math.min(1, Math.max(0, p.y / 0.6)), sq = u.uSquash.value, lean = u.uLean.value;
  out.set(p.x * (1 + sq * 0.55) + lean.x * h * h, p.y * (1 - sq), p.z * (1 + sq * 0.55) + lean.y * h * h);
  return out;
}
