import * as T from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { DESKS, seatOf, monitorOf } from "../../layout.js";
import { buildStylizedRoom, officeChair, rbox } from "./room.js";
import { stylizedCharacter } from "./character.js";

export const meta = { label: "Classic (first mock)" };

export async function buildRoom(scene, renderer) {
  const set = buildStylizedRoom(scene);
  const screens = [];
  for (const d of DESKS) {
    const m = monitorOf(d);
    rbox(0.72, 0.44, 0.03, new T.MeshStandardMaterial({ color: "#1b1d1f", roughness: 0.35, metalness: 0.4 }), m.x, m.y + 0.12, m.z, set.root, 0.012);
    rbox(0.05, 0.3, 0.04, new T.MeshStandardMaterial({ color: "#c7cacc", metalness: 0.8, roughness: 0.3 }), m.x, 0.9, m.z - 0.04, set.root, 0.01);
    rbox(0.42, 0.015, 0.14, "#e9e8e4", m.x, 0.775, m.z + 0.28, set.root, 0.005);
    const screen = new T.Mesh(new T.PlaneGeometry(0.68, 0.4), new T.MeshBasicMaterial({ color: "#222" }));
    screen.position.set(m.x, m.y + 0.12, m.z + 0.017); set.root.add(screen); screens.push(screen);
    const chair = officeChair(set.root, "#2c2f33"); const s = seatOf(d); chair.position.set(s.x, 0, s.z + 0.06);
  }
  const pmrem = new T.PMREMGenerator(renderer);
  set.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  return { ...set, screens };
}

export function applyLook({ scene, renderer, hemi, sun }, set) {
  scene.environment = set.env; scene.environmentIntensity = 0.55;
  scene.background = new T.Color("#dfe3df"); scene.fog = new T.Fog(scene.background, 30, 70);
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  hemi.intensity = 0.75; sun.intensity = 2.6;
}

export function createCharacter(agent, index) {
  const c = stylizedCharacter(agent, index);
  return { ...c, update: (t, dt, pose) => c.update(t, dt, pose) };
}
