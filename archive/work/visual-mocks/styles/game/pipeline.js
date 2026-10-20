import * as T from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// Cinematic grade in display space: split toning (cool shadows / warm highlights), contrast S-curve,
// slight saturation lift, vignette and fine film grain.
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vignette: { value: 0.32 }, grain: { value: 0.025 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, vignette, grain; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126,0.7152,0.0722));
      c += mix(vec3(-0.012,0.0,0.028), vec3(0.03,0.012,-0.022), smoothstep(0.15,0.85,l));   // split tone
      c = mix(c, c*c*(3.0-2.0*c), 0.22);                                                      // S-curve
      c = mix(vec3(l), c, 1.08);                                                               // saturation
      vec2 q = vUv - 0.5; float v = 1.0 - dot(q,q) * vignette * 2.4; c *= clamp(v, 0.0, 1.0);
      c += (hash(vUv * 1024.0 + time) - 0.5) * grain;
      gl_FragColor = vec4(clamp(c,0.0,1.0), 1.0);
    }`,
};

export function createGamePipeline({ renderer, scene, camera }, hooks = {}) {
  const size = renderer.getSize(new T.Vector2());
  const rt = new T.WebGLRenderTarget(size.x, size.y, { type: T.HalfFloatType, samples: 0 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, size.x, size.y);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.85;
  gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1.2, scale: 1, samples: 8 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 8 });
  // AO at half resolution: a quarter of the fragment cost, the blur hides the upsample.
  const gtaoSetSize = gtao.setSize.bind(gtao); gtao.setSize = (w, h) => gtaoSetSize(Math.ceil(w / 2), Math.ceil(h / 2)); gtao.setSize(size.x, size.y);
  // Keep label sprites out of the AO depth/normal pass (they would cast AO smudges).
  const gtaoRender = gtao.render.bind(gtao), hidden = [];
  gtao.render = (...a) => {
    scene.traverseVisible(o => { if (o.isSprite) hidden.push(o); });
    for (const o of hidden) o.visible = false;
    gtaoRender(...a);
    for (const o of hidden) o.visible = true; hidden.length = 0;
  };
  const q = new URLSearchParams(location.search);
  if (!q.has("nogtao")) composer.addPass(gtao);
  const bloom = new UnrealBloomPass(new T.Vector2(size.x / 2, size.y / 2), 0.4, 0.3, 4.5);
  if (!q.has("nobloom")) composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader); composer.addPass(grade);
  const smaa = new SMAAPass(size.x, size.y); composer.addPass(smaa);
  const clock = new T.Timer();
  return {
    composer,
    render() { clock.update(); grade.uniforms.time.value = clock.getElapsed() % 10; hooks.beforeRender?.(); const t0 = performance.now(); composer.render(); window.__gameFrames = (window.__gameFrames || 0) + 1; window.__gameMs = performance.now() - t0; window.__gameInfo = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, progs: renderer.info.programs?.length }; },
    setSize(w, h) { const pr = renderer.getPixelRatio(); composer.setSize(w, h); bloom.setSize(w * pr / 2, h * pr / 2); },
  };
}
