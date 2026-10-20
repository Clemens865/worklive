import * as T from "three";
import type { RobotSpec, RobotFinish } from "./robot-spec";

// Mouth: a flat lozenge wrapped onto the face, with morph targets for grin, frown and shout.
// The kind only changes its texture: a plain dark slot, a row of teeth, or a speaker grille.

const texCache = new Map<string, T.Texture>();
function mouthTexture(kind: "teeth" | "speaker"): T.Texture {
  let t = texCache.get(kind);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const g = c.getContext("2d")!;
  if (kind === "teeth") {
    g.fillStyle = "#f3eee0"; g.fillRect(0, 0, 256, 128);
    g.fillStyle = "#24212a";
    for (let i = 1; i < 6; i++) g.fillRect((i * 256) / 6 - 6, 0, 12, 128);
    g.fillRect(0, 58, 256, 12);
  } else {
    g.fillStyle = "#2a2830"; g.fillRect(0, 0, 256, 128);
    g.fillStyle = "#8b8794";
    for (let y = 16; y < 128; y += 24) for (let x = 14 + ((y / 24) % 2) * 12; x < 256; x += 24) { g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); }
  }
  t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(kind, t);
  return t;
}

const matCache = new Map<string, T.Material>();
function mouthMaterial(kind: RobotSpec["mouth"]["kind"], finish: RobotFinish): T.Material {
  const key = kind + finish;
  let m = matCache.get(key);
  if (m) return m;
  const map = kind === "line" ? null : mouthTexture(kind);
  const color = kind === "line" ? "#1d1b22" : "#ffffff";
  m = finish === "cartoon" ? new T.MeshBasicMaterial({ color, map }) : new T.MeshStandardMaterial({ color, map, roughness: 0.5 });
  matCache.set(key, m);
  return m;
}

export interface MouthRig { mesh: T.Mesh; apply(smile: number, open: number): void }

// faceR = radius of the head's face curvature (Infinity for flat box faces)
export function buildMouth(spec: RobotSpec, finish: RobotFinish, faceR: number): MouthRig {
  const { w, h } = spec.mouth;
  const geo = new T.SphereGeometry(1, 40, 20);
  const p = geo.attributes.position as T.BufferAttribute;
  const uv = geo.attributes.uv as T.BufferAttribute;
  const n = p.count;
  const smile = new Float32Array(n * 3), frown = new Float32Array(n * 3), open = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = p.getX(i) * w / 2, y = p.getY(i) * h / 2;
    let z = p.getZ(i) * 0.05;
    if (Number.isFinite(faceR)) z -= faceR - Math.sqrt(Math.max(0, faceR * faceR - x * x)); // wrap onto the face
    p.setXYZ(i, x, y, z);
    uv.setXY(i, x / w + 0.5, y / h + 0.5);
    const u = (2 * x) / w;
    const bend = u * u * w * 0.28;
    smile[i * 3 + 1] = bend - h * 0.15 * (1 - u * u);
    frown[i * 3 + 1] = -bend;
    open[i * 3] = -x * 0.15;
    open[i * 3 + 1] = y * 2.4 - Math.abs(y) * 0.6;
  }
  geo.morphAttributes.position = [
    new T.Float32BufferAttribute(smile, 3), new T.Float32BufferAttribute(frown, 3), new T.Float32BufferAttribute(open, 3),
  ];
  geo.morphTargetsRelative = true;
  geo.computeVertexNormals();
  const mesh = new T.Mesh(geo, mouthMaterial(spec.mouth.kind, finish));
  mesh.updateMorphTargets();
  const inf = mesh.morphTargetInfluences!;
  return {
    mesh,
    apply(s, o) {
      inf[0] = Math.max(0, s);
      inf[1] = Math.max(0, -s);
      inf[2] = o;
    },
  };
}
