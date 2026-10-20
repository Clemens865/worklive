// Small office stage for the jelly mock: floor, desks with monitors, plants, lights (with a back light for the jelly glow).
import * as THREE from "three";

export function createStage(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f3ece2");
  scene.fog = new THREE.Fog("#f3ece2", 14, 30);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.add(new THREE.HemisphereLight("#fff6ea", "#c9b8a4", 1.1));
  const key = new THREE.DirectionalLight("#fff3e0", 2.4);
  key.position.set(4, 8, 5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -9; key.shadow.camera.right = 9; key.shadow.camera.top = 9; key.shadow.camera.bottom = -9; key.shadow.radius = 4;
  scene.add(key);
  const back = new THREE.DirectionalLight("#ffe2c4", 1.6); back.position.set(-3, 3, -7); scene.add(back); // makes thin jelly edges glow

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: "#e4cfae", roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  // a soft rug in the middle
  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), new THREE.MeshStandardMaterial({ color: "#c7d9c8", roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.005, 0.5); rug.receiveShadow = true; scene.add(rug);

  // Desks: low, wide tables (beans have no legs, so the desk is at their eye level with a ramp-free low top).
  const desks = [];
  const wood = new THREE.MeshStandardMaterial({ color: "#f6efe4", roughness: 0.6 });
  const legM = new THREE.MeshStandardMaterial({ color: "#3a3f4a", roughness: 0.5 });
  const screenOff = new THREE.MeshStandardMaterial({ color: "#1e2430", roughness: 0.3 });
  const spots = [[-4, -3], [-1.3, -3], [1.4, -3], [4.1, -3], [-4, 3.6], [4.1, 3.6]];
  spots.forEach(([x, z], i) => {
    const d = new THREE.Group(); d.position.set(x, 0, z); d.rotation.y = z > 0 ? Math.PI : 0;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.8), wood); top.position.y = 0.42; top.castShadow = top.receiveShadow = true; d.add(top);
    for (const [lx, lz] of [[-0.78, -0.33], [0.78, -0.33], [-0.78, 0.33], [0.78, 0.33]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4), legM); l.position.set(lx, 0.2, lz); d.add(l); }
    const screen = new THREE.MeshStandardMaterial({ color: "#2a3346", emissive: "#6aa7ff", emissiveIntensity: 0.0, roughness: 0.3 });
    const mon = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.38, 0.03), [legM, legM, legM, legM, screen, screenOff]); mon.position.set(0, 0.72, -0.22); mon.castShadow = true; d.add(mon);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12), legM); neck.position.set(0, 0.5, -0.24); d.add(neck);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 14), new THREE.MeshStandardMaterial({ color: ["#f59e0b", "#ef4444", "#10b981", "#6366f1", "#ec4899", "#14b8a6"][i] })); mug.position.set(0.55, 0.5, 0.05); d.add(mug);
    scene.add(d);
    // the bean parks in front of the desk, facing it
    const seat = new THREE.Vector3(0, 0, 1.05).applyAxisAngle(new THREE.Vector3(0, 1, 0), d.rotation.y).add(d.position);
    desks.push({ group: d, screen, seat, face: d.rotation.y + Math.PI });
  });
  // plants
  for (const [x, z] of [[-6.5, -4.5], [6.6, -4.5], [-6.5, 5], [6.6, 5.2]]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.4, 18), new THREE.MeshStandardMaterial({ color: "#d97757", roughness: 0.8 })); pot.position.set(x, 0.2, z); pot.castShadow = true; scene.add(pot);
    for (let i = 0; i < 6; i++) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshStandardMaterial({ color: "#5f9d5a", roughness: 0.7 })); leaf.scale.set(0.5, 1.4, 0.25); leaf.position.set(x + Math.cos(i) * 0.12, 0.65, z + Math.sin(i) * 0.12); leaf.rotation.set(Math.sin(i) * 0.5, i, Math.cos(i) * 0.5); leaf.castShadow = true; scene.add(leaf); }
  }
  return { scene, desks, bounds: { x: 6.2, z: 5.2 } };
}

// Faint glossy slime trail on the floor behind crawling beans (pooled, fades out).
export function createTrail(scene, max = 400) {
  const geo = new THREE.CircleGeometry(0.09, 14);
  const dots = [];
  for (let i = 0; i < max; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0, roughness: 0.02, metalness: 0.1, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.004; m.visible = false; scene.add(m);
    dots.push({ m, life: 0 });
  }
  let next = 0;
  return {
    drop(x, z, color, heading = 0) {
      const d = dots[next = (next + 1) % max];
      d.m.position.x = x; d.m.position.z = z; d.m.material.color.set(color).lerp(new THREE.Color("#ffffff"), 0.6);
      d.m.scale.set(1, 1.7, 1); d.m.rotation.z = heading; d.life = 1; d.m.visible = true;
    },
    update(dt) {
      for (const d of dots) if (d.life > 0) { d.life -= dt / 6; d.m.material.opacity = Math.max(0, d.life) * 0.28; if (d.life <= 0) d.m.visible = false; }
    },
  };
}
