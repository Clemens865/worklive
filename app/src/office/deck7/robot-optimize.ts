import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Office-scale budget: merge every group's static meshes that share a material into one mesh,
// so a robot costs a few dozen draw calls instead of ~100. Animated parts set userData.keep.

export function mergeStatic(root: T.Object3D, ink: T.Material | null, geos: T.BufferGeometry[]) {
  const groups: T.Object3D[] = [];
  root.traverse(o => { if (!(o as T.Mesh).isMesh) groups.push(o); });
  for (const g of groups) {
    const byMat = new Map<T.Material, T.Mesh[]>();
    for (const c of g.children) {
      const m = c as T.Mesh;
      if (!m.isMesh || (m as T.SkinnedMesh).isSkinnedMesh || m.userData.keep || Array.isArray(m.material)) continue;
      if (m.geometry.morphAttributes.position || m.children.some(k => !(k as T.Mesh).isMesh)) continue;
      const list = byMat.get(m.material) ?? [];
      list.push(m);
      byMat.set(m.material, list);
    }
    for (const [mat, list] of byMat) {
      if (list.length < 2) continue;
      const parts = list.map(m => {
        m.updateMatrix();
        let geo = m.geometry.clone();
        for (const k of Object.keys(geo.attributes)) if (k !== "position" && k !== "normal") geo.deleteAttribute(k);
        if (geo.index) geo = geo.toNonIndexed();
        return geo.applyMatrix4(m.matrix);
      });
      const merged = mergeGeometries(parts, false);
      parts.forEach(p => p.dispose());
      if (!merged) continue;
      geos.push(merged);
      const out = new T.Mesh(merged, mat);
      out.castShadow = list[0].castShadow;
      out.receiveShadow = list[0].receiveShadow;
      if (ink && list.some(m => m.children.length)) out.add(new T.Mesh(merged, ink));
      list.forEach(m => g.remove(m));
      g.add(out);
    }
  }
}

// Count what the GPU will draw for one object tree.
export function countDraws(root: T.Object3D) {
  let calls = 0, tris = 0;
  root.traverse(o => {
    const m = o as T.Mesh;
    if (!m.isMesh || !m.visible) return;
    calls++;
    const g = m.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return { calls, tris };
}
