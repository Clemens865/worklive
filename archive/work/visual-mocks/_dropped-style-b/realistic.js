import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { ROOM, DESKS, LOUNGE, CAFE, PLANTS, PROVIDER } from "./layout.js";
import { rbox, cyl, mat } from "./stylized-room.js";

// Style B: CC0 Poly Haven furniture + animated Mixamo-style mannequin, PBR textures and an HDR environment.
const loader = new GLTFLoader();
const cache = {};
async function model(name) {
  cache[name] ||= loader.loadAsync(`assets/ph/${name}/${name}.gltf`).then(g => g.scene);
  return cache[name];
}
function place(src, parent, { x = 0, z = 0, y = 0, yaw = 0, height, width }) {
  const o = src.clone(true);
  const box = new T.Box3().setFromObject(o), size = box.getSize(new T.Vector3());
  const s = height ? height / size.y : width ? width / Math.max(size.x, size.z) : 1;
  o.scale.multiplyScalar(s);
  const b2 = new T.Box3().setFromObject(o), c = b2.getCenter(new T.Vector3());
  const holder = new T.Group(); holder.add(o); o.position.set(-c.x, -b2.min.y, -c.z);
  holder.position.set(x, y, z); holder.rotation.y = yaw; parent.add(holder);
  o.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; } });
  return holder;
}

export async function buildRealisticRoom(scene, renderer) {
  const root = new T.Group(); scene.add(root);
  const walls = [];
  const tl = new T.TextureLoader();
  const tex = (f, srgb) => { const t = tl.load("assets/ph/" + f); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(7, 4.5); t.anisotropy = 8; if (srgb) t.colorSpace = T.SRGBColorSpace; return t; };
  const W = ROOM.maxX - ROOM.minX, D = ROOM.maxZ - ROOM.minZ;
  const floor = new T.Mesh(new T.PlaneGeometry(W, D), new T.MeshStandardMaterial({
    map: tex("wood_floor_Diffuse.jpg", true), roughnessMap: tex("wood_floor_Rough.jpg"), normalMap: tex("wood_floor_nor_gl.jpg"), roughness: 1,
  }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; root.add(floor);
  const base = new T.Mesh(new T.BoxGeometry(W + 0.3, 0.3, D + 0.3), mat("#cfcac2")); base.position.y = -0.16; root.add(base);

  const plaster = new T.MeshStandardMaterial({ color: "#ecebe7", roughness: 0.92 });
  const frame = new T.MeshStandardMaterial({ color: "#26282a", roughness: 0.4, metalness: 0.6 });
  const wall = (w, x, z, rotY, glass) => {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; g.userData.normal = new T.Vector3(0, 0, 1).applyAxisAngle(new T.Vector3(0, 1, 0), rotY); root.add(g);
    if (glass) {
      const n = Math.round(w / 1.8);
      for (let i = 0; i <= n; i++) { const m = new T.Mesh(new T.BoxGeometry(0.06, ROOM.height, 0.12), frame); m.position.set(-w / 2 + (i * w) / n, ROOM.height / 2, 0); m.castShadow = true; g.add(m); }
      for (const y of [0.05, ROOM.height]) { const m = new T.Mesh(new T.BoxGeometry(w, 0.1, 0.14), frame); m.position.y = y; g.add(m); }
      const pane = new T.Mesh(new T.PlaneGeometry(w, ROOM.height), new T.MeshPhysicalMaterial({ color: "#dfeff5", transparent: true, opacity: 0.12, roughness: 0, metalness: 0.1, depthWrite: false }));
      pane.position.y = ROOM.height / 2; g.add(pane);
    } else {
      const m = new T.Mesh(new T.BoxGeometry(w, ROOM.height, 0.2), plaster); m.position.y = ROOM.height / 2; m.receiveShadow = true; g.add(m);
    }
    walls.push(g); return g;
  };
  wall(W, 0, ROOM.minZ, 0, true);
  const left = wall(D, ROOM.minX, 0, Math.PI / 2, false);
  const right = wall(D, ROOM.maxX, 0, -Math.PI / 2, false);
  wall(W, 0, ROOM.maxZ, Math.PI, false);

  const [desk, arm, sofa, plant1, plant4, ctable, shelves, laptop, rtable, stool, clock] = await Promise.all(
    ["metal_office_desk", "modern_arm_chair_01", "sofa_02", "potted_plant_01", "potted_plant_04", "modern_coffee_table_01",
      "steel_frame_shelves_01", "classic_laptop", "round_wooden_table_01", "bar_chair_round_01", "wall_clock"].map(model));

  for (const [i, d] of DESKS.entries()) {
    place(desk, root, { x: d.x, z: d.z, width: 1.9, yaw: Math.PI });
    if (i % 3 === 1) place(laptop, root, { x: d.x + 0.6, z: d.z + 0.05, y: 0.76, width: 0.34, yaw: Math.PI + 0.3 });
    place(plant4, root, { x: d.x - 0.75, z: d.z - 0.25, y: 0.76, height: 0.25 });
  }
  place(sofa, root, { ...LOUNGE.sofa, width: 2.2 });
  for (const c of LOUNGE.chairs) place(arm, root, { ...c, height: 0.95 });
  place(ctable, root, { ...LOUNGE.table, width: 1.1, yaw: Math.PI / 2 });
  place(rtable, root, { ...CAFE.table, height: 0.75 });
  for (const s of CAFE.stools) place(stool, root, { ...s, height: 0.48 });
  for (const p of PLANTS) place(plant1, root, { x: p.x, z: p.z, height: 1.3 * p.s });
  for (let i = 0; i < 3; i++) place(shelves, left, { x: -2.2 + i * 1.3, z: 0.3, height: 2.0, width: undefined });
  place(clock, left, { x: 2.8, z: 0.12, y: 2.1, height: 0.4, yaw: 0 });
  // Cafe counter: dark stone + oak, no model available in the CC0 set.
  const c = CAFE.counter;
  rbox(c.w, 0.9, 0.62, new T.MeshStandardMaterial({ color: "#b89a74", roughness: 0.6 }), c.x, 0.45, c.z, root, 0.01);
  rbox(c.w + 0.05, 0.04, 0.66, new T.MeshStandardMaterial({ color: "#2d2f31", roughness: 0.25, metalness: 0.1 }), c.x, 0.92, c.z, root, 0.005);
  rbox(0.4, 0.45, 0.35, new T.MeshStandardMaterial({ color: "#c9cdd0", roughness: 0.2, metalness: 0.9 }), c.x + 1.2, 1.17, c.z, root, 0.02);
  const screen = rbox(0.06, 1.1, 1.9, frame, LOUNGE.screen.x - 0.1, 1.55, LOUNGE.screen.z, root, 0.01); right.attach(screen);
  // Recessed ceiling panels are implied by rectangular soft lights.
  const lights = [];
  for (const x of [-7.15, -1.85, 4.5]) for (const z of [-3.2, 0.8, 4.2]) {
    const l = new T.PointLight("#fff1dd", 3.2, 7, 1.7); l.position.set(x, ROOM.height - 0.3, z); root.add(l); lights.push(l);
  }
  const hdr = await new HDRLoader().loadAsync("assets/ph/art_studio_1k.hdr");
  hdr.mapping = T.EquirectangularReflectionMapping;
  return { root, walls, lights, env: hdr };
}

// Mannequin characters. The body material takes the provider colour.
let xbot;
export async function realisticCharacter(agent) {
  xbot ||= loader.loadAsync("assets/Xbot.glb");
  const gltf = await xbot;
  const root = new T.Group();
  const body = SkeletonUtils.clone(gltf.scene); root.add(body);
  body.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      if (o.material.name.includes("HighLimbs")) { o.material = o.material.clone(); o.material.color.set(PROVIDER[agent.provider].color); o.material.roughness = 0.55; o.material.metalness = 0.05; }
    }
  });
  const mixer = new T.AnimationMixer(body);
  const clip = n => gltf.animations.find(a => a.name === n);
  const idle = mixer.clipAction(clip("idle")), walk = mixer.clipAction(clip("walk"));
  idle.play(); walk.play(); walk.setEffectiveWeight(0);
  const bone = n => body.getObjectByName("mixamorig" + n);
  const B = { hips: bone("Hips"), spine: bone("Spine1"), head: bone("Head"), lUp: bone("LeftUpLeg"), rUp: bone("RightUpLeg"), lLeg: bone("LeftLeg"), rLeg: bone("RightLeg"),
    lArm: bone("LeftArm"), rArm: bone("RightArm"), lFore: bone("LeftForeArm"), rFore: bone("RightForeArm") };
  const eyeAnchor = new T.Object3D(); eyeAnchor.position.set(0, 0.1, 0.12); B.head.add(eyeAnchor);
  const q = new T.Quaternion(), e = new T.Euler();
  const rot = (b, x, y, z) => { q.setFromEuler(e.set(x, y, z)); b.quaternion.multiply(q); };
  let w = 0;
  return {
    root, head: B.head, eyeAnchor,
    update(t, dt, pose) {
      w += ((pose === "walk" ? 1 : 0) - w) * Math.min(1, dt * 6);
      walk.setEffectiveWeight(w); idle.setEffectiveWeight(1 - w);
      mixer.update(dt);
      const sit = pose === "sit" || pose === "type" || pose === "lounge";
      body.position.y = sit ? -0.42 : 0;
      if (sit) {
        rot(B.lUp, -1.45, 0, 0); rot(B.rUp, -1.45, 0, 0);
        rot(B.lLeg, 1.5, 0, 0); rot(B.rLeg, 1.5, 0, 0);
      }
      if (pose === "type") {
        rot(B.lArm, 0.9, 0, 0.35); rot(B.rArm, 0.9, 0, -0.35);
        rot(B.lFore, 0, 0, 0.9 + Math.sin(t * 11) * 0.05); rot(B.rFore, 0, 0, -0.9 - Math.sin(t * 11 + 2) * 0.05);
        rot(B.spine, 0.1, 0, 0);
      }
    },
  };
}
