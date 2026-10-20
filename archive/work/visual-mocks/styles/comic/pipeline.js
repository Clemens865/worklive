import * as T from "three";
import { exposeDebug } from "./debug.js";

// Render pipeline. Outlines come from inverted hulls (cheap, MSAA-friendly), so the default path is a
// single forward render with the renderer's native MSAA.
// Screenshot helpers (comic only): `?face=<id>` portrait, `?side=<id>` side view,
// `?check=<id>&view=front|side|back|top|three&dist=2.4&h=0.8` generic close-up camera for overlap checks.
const params = new URLSearchParams(location.search);

export function createComicPipeline({ renderer, scene, camera }) {
  const faceId = params.get("face") || params.get("side") || params.get("check");
  const view = params.get("view") || (params.has("side") ? "side" : "front");
  const dist = +(params.get("dist") || (params.has("check") ? 2.4 : params.has("far") ? 3 : 1.55));
  const tgt = new T.Vector3(), fwd = new T.Vector3(), right = new T.Vector3();
  let frames = 0;
  exposeDebug(scene);
  return {
    render() {
      const root = faceId && scene.getObjectByName("comic-" + faceId);
      if (root) {
        root.updateMatrixWorld(true);
        if (params.has("check")) { root.getWorldPosition(tgt); tgt.y = +(params.get("h") || 0.75); }
        else { root.getObjectByName("head").getWorldPosition(tgt); tgt.y += params.has("side") ? -0.15 : 0.2; }
        fwd.set(0, 0, 1).applyQuaternion(root.quaternion); right.set(fwd.z, 0, -fwd.x);
        const dir = { front: fwd, back: fwd.clone().negate(), side: right.clone().negate(), side2: right,
          three: fwd.clone().add(right.clone().negate()).normalize(), top: new T.Vector3(0, 1, 0.001) }[view] || fwd;
        camera.position.copy(tgt).addScaledVector(dir, dist);
        camera.position.y += view === "top" ? 0 : 0.35;
        camera.lookAt(tgt);
      }
      renderer.render(scene, camera);
      if (params.has("stats") && ++frames === 3) {
        const per = []; scene.traverse(o => { if (o.name?.startsWith("comic-")) per.push(o.name + ":" + o.userData.meshCount); });
        let meshes = 0; scene.traverse(o => { if (o.isMesh) meshes++; });
        console.warn("[comic stats]", per.join(" "), "| scene meshes", meshes, "| calls", renderer.info.render.calls, "| tris", renderer.info.render.triangles);
      }
    },
    setSize() {},
  };
}
