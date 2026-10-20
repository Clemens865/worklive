// Workbench stage: the same character builder as the office, without the office around it.
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildCharacter } from "../office/styles/comic/character.js";
import { buildDesk, comicChair } from "../office/styles/comic/desks.js";
import { withFinish } from "../office/styles/comic/toon.js";
import { COLLIDERS, boxDistance } from "../office/styles/comic/colliders.js";
import { probeWorld } from "../office/styles/comic/probes.js";
import { seatOf } from "../office/layout.js";

export function createStage(host) {
  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
  host.append(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(32, 1, 0.05, 80);
  camera.position.set(0, 1.5, 6.2);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.85, 0); controls.enableDamping = true; controls.maxPolarAngle = 1.52; controls.minDistance = 0.6; controls.maxDistance = 22;

  // Lights: "office" matches applyLook() in the app; "studio" is a soft three-point set that suits clay.
  const hemi = new T.HemisphereLight("#fff6e8", "#b9a7c9", 1.35); scene.add(hemi);
  const key = new T.DirectionalLight("#fff0d8", 2.3); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 6, bottom: -4, near: 0.5, far: 40 });
  scene.add(key, key.target);
  const fill = new T.DirectionalLight("#cfe0ff", 0.55); scene.add(fill);
  const rim = new T.DirectionalLight("#ffe2c4", 0); scene.add(rim);
  const floor = new T.Mesh(new T.CircleGeometry(14, 64), new T.MeshStandardMaterial({ color: "#e9e2d6", roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  function setLight(kind) {
    if (kind === "studio") {
      scene.background = new T.Color("#d9d3ca"); scene.fog = new T.Fog("#d9d3ca", 14, 34);
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
      hemi.color.set("#fff4e6"); hemi.groundColor.set("#8c7f74"); hemi.intensity = 1.1;
      key.color.set("#fff1de"); key.intensity = 3.0; key.position.set(-4, 7, 5);
      fill.color.set("#dbe6ff"); fill.intensity = 0.8; fill.position.set(6, 3, 6);
      rim.intensity = 1.6; rim.position.set(2, 4, -6);
      floor.material.color.set("#d9d3ca");
    } else {
      scene.background = new T.Color("#bfe3ef"); scene.fog = new T.Fog("#cfe9f0", 18, 40);
      renderer.toneMapping = T.NoToneMapping; renderer.toneMappingExposure = 1;
      hemi.color.set("#fff6e8"); hemi.groundColor.set("#b9a7c9"); hemi.intensity = 1.35;
      key.color.set("#fff0d8"); key.intensity = 2.3; key.position.set(-7, 15, 9);
      fill.color.set("#cfe0ff"); fill.intensity = 0.55; fill.position.set(8, 6, 12);
      rim.intensity = 0;
      floor.material.color.set("#e8c999");
    }
  }

  // Furniture: a full desk for the single view, plain chairs for a seated lineup.
  const furniture = new T.Group(); scene.add(furniture);
  function setFurniture(kind, finish, spots) {
    furniture.clear(); COLLIDERS.length = 0;
    withFinish(finish, () => {
      if (kind === "desk") buildDesk(furniture, 0, { x: 0, z: 0 });
      if (kind === "chairs") for (const s of spots) { const c = comicChair(furniture, "#f7c948", false); c.position.set(s.x, 0, s.z); }
    });
    furniture.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
  const DESK_SEAT = seatOf({ x: 0, z: 0 });

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host); resize();

  function build(agent, i) {
    const c = buildCharacter(agent, i);
    scene.add(c.root);
    return c;
  }
  function remove(c) { scene.remove(c.root); }

  // Seated fit: body probes (spheres on the joints) against the desk's hard colliders.
  function fitCheck(chars) {
    const hits = [];
    for (const c of chars) {
      c.root.updateMatrixWorld(true);
      for (const p of c.root.userData.probes || []) {
        if (p.kind === "hand" || p.kind === "foot") continue;
        const w = probeWorld(p);
        for (const col of COLLIDERS) {
          if (col.soft) continue;
          const pen = p.r - boxDistance(col, w);
          if (pen > 0.012) hits.push({ who: c.name, part: p.name, what: col.name.replace(/\d+$/, ""), cm: Math.round(pen * 100) });
        }
      }
    }
    return hits;
  }

  return { renderer, scene, camera, controls, setLight, setFurniture, DESK_SEAT, build, remove, fitCheck };
}
