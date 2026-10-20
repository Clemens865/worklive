import * as T from "three";
import { toon, flat, part, geo } from "./toon.js";
import { cyl, torus } from "./shapes.js";

// Coffee mug held in the right hand (child of the wrist joint).
export function buildMug(wrist) {
  const g = new T.Group(); wrist.add(g);
  g.position.set(0, -0.075, -0.075);
  part(cyl(0.042, 0.036, 0.1, 18), toon("#f6efe2"), g, { ink: 0.007 });
  part(cyl(0.043, 0.043, 0.02, 18), toon("#e8594a"), g, { ink: 0, pos: [0, 0.02, 0] });
  part(torus(0.025, 0.007, Math.PI * 1.3), toon("#f6efe2"), g, { ink: 0.005, pos: [0.045, 0, 0], rot: [0, 0, -Math.PI * 0.65] });
  const coffee = new T.Mesh(geo("coffeeTop", () => new T.CircleGeometry(0.036, 16)), flat("#5a3522"));
  coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.045; g.add(coffee);
  g.visible = false;
  return g;
}
