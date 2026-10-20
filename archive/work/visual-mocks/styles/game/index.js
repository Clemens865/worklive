import * as T from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildShell } from "./room.js";
import { initMats, buildDesks } from "./furniture.js";
import { buildDecor } from "./decor.js";
import { createGamePipeline } from "./pipeline.js";
import { gameCharacter } from "./character.js";

export const meta = { label: "Game (cinematic realism)" };
const params = new URLSearchParams(location.search);
const chars = new Map(); window.__gameChars = chars;

export async function buildRoom(scene, renderer) {
  initMats();
  const shell = buildShell(scene);
  const screens = buildDesks(shell.root);
  const decor = buildDecor(shell.root);
  const pmrem = new T.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  return { ...shell, ...decor, screens, env };
}

export function applyLook({ scene, renderer, hemi, sun, camera }, set) {
  scene.environment = set.env; scene.environmentIntensity = 0.32;
  scene.background = new T.Color("#caa889");
  scene.fog = new T.Fog("#caa889", 40, 120);
  renderer.toneMapping = T.AgXToneMapping; renderer.toneMappingExposure = 1.05;
  hemi.color.set("#b9cbe0"); hemi.groundColor.set("#6b5a4a"); hemi.intensity = 0.4;
  // Low golden-hour sun raking through the curtain wall.
  sun.color.set("#ffc58a"); sun.intensity = 4.2; sun.position.set(-9, 9, -16);
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 13, bottom: -13, near: 1, far: 50 }); sun.shadow.camera.updateProjectionMatrix();
  const fill = new T.DirectionalLight("#ffe0c0", 1.1); fill.position.set(8, 7, 12); scene.add(fill);         // warm key for faces
  const cool = new T.DirectionalLight("#8fb0e0", 0.45); cool.position.set(-12, 4, 6); scene.add(cool);     // cool bounce from the brick side
}

export function createPipeline(ctx) {
  if (params.has("nopost")) return null;
  const face = params.get("gameface");
  return createGamePipeline(ctx, { beforeRender: face ? () => faceCam(ctx.camera, face) : null });
}

// Close-up portrait camera (style-local hack): ?gameface=<agentId>[&faceyaw=radians]
const hp = new T.Vector3(), hq = new T.Quaternion();
function faceCam(camera, id) {
  const c = chars.get(id); if (!c) return;
  c.head.getWorldPosition(hp); hp.y += 0.1 * (c.genome.height / 1.75);
  c.root.getWorldQuaternion(hq);
  const yaw = +(params.get("faceyaw") || 0.35), dist = +(params.get("facedist") || 0.62);
  const off = new T.Vector3(Math.sin(yaw) * dist, 0.02, Math.cos(yaw) * dist).applyQuaternion(hq);
  camera.position.copy(hp).add(off); camera.lookAt(hp); camera.fov = 30; camera.updateProjectionMatrix();
}

export function createCharacter(agent, index) {
  const c = gameCharacter(agent, index);
  chars.set(agent.id, c);
  return c;
}
