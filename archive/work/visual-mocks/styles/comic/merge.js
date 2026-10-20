import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Draw-call reduction. Meshes that never move relative to a container are baked into one mesh per material.
// Mesh flags: userData.keep (never merge: animated / dynamic geometry / mirrored).

function prep(geom, m) {
  let g = geom.index ? geom.toNonIndexed() : geom.clone();
  for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
  g.morphAttributes = {};
  g.applyMatrix4(m);
  return g;
}
const mergeable = (o) => o.isMesh && !o.userData.keep && !o.material.map && !o.material.transparent && !Array.isArray(o.material) && !o.onBeforeRender.__custom && o.matrix.determinant() > 0;

function bake(buckets, parent) {
  let made = 0;
  for (const b of buckets.values()) {
    if (b.geos.length < 2) { b.srcs.forEach(s => s.userData.single = true); continue; }
    const merged = mergeGeometries(b.geos, false);
    if (!merged) continue;
    const mesh = new T.Mesh(merged, b.material);
    mesh.castShadow = b.cast; mesh.receiveShadow = b.receive;
    mesh.raycast = b.material.isShaderMaterial ? () => {} : mesh.raycast;
    parent.add(mesh); made++;
    for (const s of b.srcs) s.userData.merged = true;
  }
  return made;
}

function add(buckets, mesh, matrix) {
  const key = mesh.material.uuid + (mesh.castShadow ? "c" : "") + (mesh.receiveShadow ? "r" : "");
  let b = buckets.get(key);
  if (!b) buckets.set(key, b = { material: mesh.material, cast: mesh.castShadow, receive: mesh.receiveShadow, geos: [], srcs: [] });
  b.geos.push(prep(mesh.geometry, matrix)); b.srcs.push(mesh);
}

function removeMerged(node) {
  for (const c of [...node.children]) {
    if (c.userData.merged) {
      // keep non-merged children (re-parent them)
      for (const cc of [...c.children]) if (!cc.userData.merged) c.parent.attach(cc);
      c.removeFromParent();
    } else removeMerged(c);
  }
}

// Per-joint merge for characters: direct mesh children (+ their hull children) of each Group.
export function mergePerGroup(root) {
  const groups = [];
  root.traverse(o => { if (!o.isMesh) groups.push(o); });
  const _m = new T.Matrix4();
  for (const g of groups) {
    const buckets = new Map();
    for (const c of g.children) {
      if (!mergeable(c)) continue;
      c.updateMatrix();
      add(buckets, c, c.matrix);
      for (const h of c.children) if (mergeable(h) && h.children.length === 0) { h.updateMatrix(); add(buckets, h, _m.multiplyMatrices(c.matrix, h.matrix)); }
    }
    bake(buckets, g);
  }
  removeMerged(root);
}

// Flatten a static container (room) into world-baked batches; skip subtrees with userData.dynamic.
export function mergeStatic(container, exclude = []) {
  container.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(container.matrixWorld).invert();
  const buckets = new Map(), _m = new T.Matrix4();
  const walk = (o) => {
    if (o !== container && (o.userData.dynamic || exclude.includes(o))) return;
    if (o.isMesh && mergeable(o)) add(buckets, o, _m.multiplyMatrices(inv, o.matrixWorld));
    for (const c of o.children) walk(c);
  };
  walk(container);
  bake(buckets, container);
  const kill = [];
  container.traverse(o => { if (o.userData.merged) kill.push(o); });
  for (const o of kill) {
    for (const c of [...o.children]) if (!c.userData.merged) container.attach(c);
    o.removeFromParent();
  }
}
