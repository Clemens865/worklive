import * as T from "three";
import { ROOM } from "../../layout.js";
import { buildComicRoom } from "./room.js";
import { buildCharacter } from "./character.js";
import { createComicPipeline } from "./pipeline.js";
import { seatUnder, seatInfo } from "./seats.js";
import { registerChairs, claimChair, driveChair, tickChairs, addChair } from "./chairs.js";
import { buildDesk } from "./desks.js";

export const meta = { label: "Comic" };

export async function buildRoom(scene, renderer) {
  const set = await buildComicRoom(scene, renderer);
  registerChairs(set.chairs);
  return set;
}

// Office growth: build one more workstation at runtime and pop it in from the floor.
export function addDesk(set, i, d) {
  const g = new T.Group(); set.root.add(g);
  const { screen, chair } = buildDesk(g, i, d);
  set.root.attach(chair); // chairs live in room space (they roll around)
  set.screens[i] = screen; set.chairs[i] = chair; addChair(chair);
  // Re-pivot the desk group on its centre so it can grow out of the floor.
  const pivot = new T.Vector3(d.x, 0, d.z);
  for (const c of g.children) c.position.sub(pivot);
  g.position.copy(pivot); g.scale.setScalar(0.001); chair.scale.setScalar(0.001);
  let t = 0;
  const tick = () => {
    t = Math.min(1, t + 1 / 45);
    const k = 1 - Math.pow(1 - t, 3), over = 1 + Math.sin(t * Math.PI) * 0.1;
    g.scale.set(k * over, Math.min(1, t * 1.5) * over, k * over);
    chair.scale.setScalar(Math.max(0.001, Math.min(1, (t - 0.4) / 0.6)));
    if (t < 1) requestAnimationFrame(tick); else { g.scale.setScalar(1); chair.scale.setScalar(1); }
  };
  requestAnimationFrame(tick);
  return g;
}

export function applyLook({ scene, renderer, hemi, sun, camera }, set) {
  scene.background = new T.Color("#bfe3ef");
  scene.fog = new T.Fog("#cfe9f0", 38, 80);
  renderer.toneMapping = T.NoToneMapping;
  renderer.toneMappingExposure = 1;
  hemi.color.set("#fff6e8"); hemi.groundColor.set("#b9a7c9"); hemi.intensity = 1.35;
  sun.color.set("#fff0d8"); sun.intensity = 2.3; sun.position.set(-7, 15, 9);
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; sun.shadow.radius = 2;
  Object.assign(sun.shadow.camera, { left: ROOM.minX - 3, right: ROOM.maxX + 3, top: ROOM.maxZ + 3, bottom: ROOM.minZ - 3, far: 60 });
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.updateProjectionMatrix();
  const fill = new T.DirectionalLight("#cfe0ff", 0.55); fill.position.set(8, 6, 12); scene.add(fill);
  set.camera = camera;
}

export function createPipeline(ctx) { return createComicPipeline(ctx); }

export function createCharacter(agent, index) {
  const c = buildCharacter(agent, index);
  // Debug: ?forcepose=coffee|walk|type|sit|lounge|stand overrides the pose (lineup testing only).
  const force = new URLSearchParams(location.search).get("forcepose");
  const ud = c.root.userData;
  const update = (t, dt, pose, ctx) => {
    let p = force || pose;
    // While the harness slides an agent into/out of a sofa or armchair it still reports "stand"/"walk".
    // Once the root is over the seat footprint, blend into the lounge pose so legs never cut through the base.
    // Subagent helpers (scaled copies) and the hire-dialog preview are not in the office: never sit or ride chairs.
    const mini = c.root.scale.x < 0.9 || ctx.mode === "preview" || ctx.mode === "helper";
    if (!force && !mini && (p === "stand" || p === "walk") && !ctx.spot) {
      const seat = seatUnder(c.root.position);
      if (seat) { p = "lounge"; ctx = { ...ctx, spot: seat }; }
    }
    if (p === "lounge") ctx = { ...ctx, seat: seatInfo(c.root, ctx.spot) };
    tickChairs(t, dt);
    const ride = force || mini ? { chair: null } : claimChair(c.root.uuid, c.root, p, ctx);
    if (ride.sit) p = "sit";
    ud.pose = p; ud.spot = ctx.spot; ud.status = ctx.status;
    c.update(t, dt, p, ctx);
    if (ride.chair) driveChair(ride.chair, c.root, c.hips, dt);
  };
  return { root: c.root, head: c.head, eyeAnchor: c.eyeAnchor, update };
}
export { LOOK_OPTIONS, lookFor } from "./looks.js";
