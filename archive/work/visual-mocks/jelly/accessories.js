// Funky accessories for the jelly snails. Each returns a Group placed relative to the head (top of the bean, front).
import * as THREE from "three";

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, ...o });
const add = (g, mesh, x = 0, y = 0, z = 0) => { mesh.position.set(x, y, z); mesh.castShadow = true; g.add(mesh); return mesh; };

export const ACCESSORIES = {
  none: () => new THREE.Group(),
  headphones(color = "#20232b") {
    const g = new THREE.Group(), m = mat(color, { roughness: 0.3, metalness: 0.2 }), pad = mat("#f2c14e");
    const band = add(g, new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.014, 8, 28, Math.PI), m), 0, 0, 0);
    band.rotation.y = Math.PI / 2;
    for (const s of [-1, 1]) {
      const cup = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 20), m), s * 0.235, -0.01, 0);
      cup.rotation.z = Math.PI / 2;
      const p = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.012, 20), pad), s * 0.212, -0.01, 0);
      p.rotation.z = Math.PI / 2;
    }
    g.position.set(0, -0.14, -0.16);
    return g;
  },
  beanie(color = "#f05a7e") {
    const g = new THREE.Group(), m = mat(color, { roughness: 0.9 });
    add(g, new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m)).scale.set(1.05, 0.95, 1.1);
    add(g, new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.035, 10, 28), mat("#ffffff", { roughness: 0.9 })), 0, 0.01, 0).rotation.x = Math.PI / 2;
    add(g, new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), mat("#ffffff", { roughness: 1 })), 0, 0.17, 0);
    g.position.set(0, -0.03, -0.05);
    return g;
  },
  sunglasses() {
    const g = new THREE.Group(), frame = mat("#111318", { roughness: 0.2 }), lens = mat("#1c2a44", { roughness: 0.05, metalness: 0.6 });
    for (const s of [-1, 1]) {
      add(g, new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.055, 0.015), lens), s * 0.09, 0, 0);
      add(g, new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.02), frame), s * 0.09, 0.03, 0);
    }
    add(g, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.015), frame), 0, 0.02, 0);
    g.userData.onEyes = true; // sits on the eye stalks
    return g;
  },
  bowtie(color = "#ffcf3f") {
    const g = new THREE.Group(), m = mat(color, { roughness: 0.5 });
    for (const s of [-1, 1]) { const w = add(g, new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.09, 4), m), s * 0.045, 0, 0); w.rotation.z = s * Math.PI / 2; }
    add(g, new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), m));
    g.position.set(0, -0.2, 0.17);
    return g;
  },
  propeller() {
    const g = new THREE.Group();
    const cap = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat("#3b82f6")));
    cap.scale.set(1, 0.6, 1.1);
    const stripes = ["#ef4444", "#facc15", "#22c55e", "#3b82f6"];
    stripes.forEach((c, i) => { const s = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.131, 24, 10, i * Math.PI / 2, Math.PI / 4, 0, Math.PI / 2), mat(c))); s.scale.copy(cap.scale); });
    add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 6), mat("#999")), 0, 0.1, 0);
    const prop = new THREE.Group(); prop.position.y = 0.135; g.add(prop);
    for (const [s, c] of [[1, "#ef4444"], [-1, "#facc15"]]) add(prop, new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.006, 0.035), mat(c)), s * 0.08, 0, 0);
    g.userData.spin = prop;
    g.position.set(0, -0.02, -0.05);
    return g;
  },
  party() {
    const g = new THREE.Group();
    const cone = add(g, new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 20), mat("#a855f7", { roughness: 0.35 })), 0, 0.1, 0);
    cone.rotation.z = 0.25;
    add(g, new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), mat("#fde047")), -0.05, 0.21, 0);
    g.position.set(0.04, -0.01, -0.06);
    return g;
  },
  flower() {
    const g = new THREE.Group();
    add(g, new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), mat("#fbbf24")));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const p = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat("#fff1f2")), Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05); p.scale.y = 0.35; }
    g.position.set(0.11, -0.02, -0.08); g.rotation.z = -0.4;
    return g;
  },
  // A tiny laptop worn like a snail shell: Worklive agents carry their work with them.
  laptopShell() {
    const g = new THREE.Group(), body = mat("#c9ced6", { metalness: 0.6, roughness: 0.3 });
    const base = add(g, new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.018, 0.19), body)); base.rotation.x = -0.5;
    const lid = add(g, new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.17, 0.014), body), 0, 0.075, -0.1); lid.rotation.x = -0.15;
    add(g, new THREE.Mesh(new THREE.CircleGeometry(0.025, 16), mat("#ffffff", { emissive: "#ffffff", emissiveIntensity: 0.6 })), 0, 0.08, -0.108).rotation.y = Math.PI;
    g.position.set(0, -0.05, -0.45);
    g.userData.onBack = true;
    return g;
  },
};
export const ACCESSORY_NAMES = Object.keys(ACCESSORIES).filter(k => k !== "none");
