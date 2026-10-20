import * as T from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {EffectComposer} from './vendor/postprocessing/EffectComposer.js';
import {RenderPass} from './vendor/postprocessing/RenderPass.js';
import {GTAOPass} from './vendor/postprocessing/GTAOPass.js';
import {OutputPass} from './vendor/postprocessing/OutputPass.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {createWorld,world,screens,screenTexture,lamps,pendants,workstation} from './world.js';
import {character,avatar,COLORS} from './characters.js';
const $=s=>document.querySelector(s),stage=$('#stage');
const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;stage.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#e9e6dc');scene.fog=new T.Fog('#e9e6dc',39,85);
const pmrem=new T.PMREMGenerator(renderer),environment=new RoomEnvironment();scene.environment=pmrem.fromScene(environment,.04).texture;scene.environmentIntensity=.35;environment.dispose();pmrem.dispose();
const camera=new T.PerspectiveCamera(34,innerWidth/innerHeight,.1,150);camera.position.set(17,15,20);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.7,0);controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=3;controls.maxDistance=38;controls.maxPolarAngle=Math.PI*.475;controls.minPolarAngle=.15;controls.enablePan=true;controls.zoomSpeed=.7;
const hemi=new T.HemisphereLight('#fbf5df','#9b9f7a',1.6);scene.add(hemi);
const sun=new T.DirectionalLight('#ffdf9c',3.4);sun.position.set(-4,9,-6);sun.target.position.set(0,0,1);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:.1,far:35});sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;sun.shadow.radius=3;scene.add(sun,sun.target);
const fill=new T.DirectionalLight('#e6f1df',1.1);fill.position.set(5,8,9);scene.add(fill);
const rim=new T.DirectionalLight('#ffebc9',.5);rim.position.set(-8,4,6);scene.add(rim);
const ground=new T.Mesh(new T.PlaneGeometry(220,220),new T.MeshStandardMaterial({color:'#e6e3d6',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.36;ground.receiveShadow=true;scene.add(ground);
const built=createWorld();scene.add(world);
const composer=new EffectComposer(renderer);composer.renderTarget1.samples=4;composer.renderTarget2.samples=4;
composer.addPass(new RenderPass(scene,camera));
const occlusion=new GTAOPass(scene,camera,innerWidth,innerHeight);occlusion.blendIntensity=.82;
occlusion.updateGtaoMaterial({radius:.42,thickness:.45,distanceExponent:1,distanceFallOff:1,scale:1,samples:16});
composer.addPass(occlusion);composer.addPass(new OutputPass());
// Original procedural assets, without external model or image services.
const roster=[
 {id:'ada',name:'Ada',provider:'claude',role:'Research & clarity',status:'Finding the useful details',task:'A quieter kind of progress',description:'Turning thoughtful references into a concise direction for the studio.',type:'article',pose:'typing',desk:0},
 {id:'milo',name:'Milo',provider:'codex',role:'Engineering & craft',status:'Making things work',task:'Give the studio a little life',description:'Building the small interactions that make a digital place feel human.',type:'code',pose:'typing',desk:1},
 {id:'june',name:'June',provider:'claude',role:'Words & direction',status:'Bringing the story together',task:'A welcome worth remembering',description:'Finding simple words for the first few minutes with your team.',type:'article',pose:'typing',desk:2},
 {id:'wren',name:'Wren',provider:'codex',role:'Ideas & possibilities',status:'Taking a well-earned breath',task:'A little space to think',description:'A coffee break in the afternoon sun. Good ideas need room to wander.',type:'article',pose:'coffee',desk:3}
];
const actors=[];let selected=null,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,evening=false,clock=0,last=performance.now(),tween=null,initial=true;
function screenFor(spec){const s=screens.find(s=>s.index===spec.desk);if(s){s.mesh.material.map?.dispose();s.mesh.material.map=screenTexture(spec);s.mesh.material.needsUpdate=true;s.mesh.userData.agent=spec.id;}}
function addActor(spec,index){
 const a=character(spec,index);a.spec=spec;
 if(spec.pose==='coffee'){a.root.position.set(-4.08,0,.12);a.root.rotation.y=.42;}else {a.root.position.copy(built.desks[spec.desk].seat);a.root.rotation.y=Math.PI;}
 a.update(index,spec.pose);world.add(a.root);actors.push(a);screenFor(spec);
 const b=document.createElement('button');b.className='team-chip';b.style.setProperty('--provider',COLORS[spec.provider]);b.setAttribute('aria-label',`Meet ${spec.name}, ${spec.provider==='codex'?'Codex':'Claude Code'}`);b.setAttribute('aria-pressed','false');b.dataset.agent=spec.id;
 const img=document.createElement('img');img.className='avatar';img.alt='';img.src=avatar(spec,index);
 const text=document.createElement('span'),name=document.createElement('strong'),sub=document.createElement('small');name.textContent=spec.name;sub.innerHTML='<i></i>';sub.append(document.createTextNode(spec.provider==='codex'?'Codex':'Claude'));text.append(name,sub);b.append(img,text);b.onclick=()=>selectAgent(spec.id);$('#team').append(b);$('#roster-count').textContent=String(roster.length);return a;
}
roster.forEach(addActor);
const viewPresets={studio:{position:[17,15,20],target:[.1,.8,0]},desks:{position:[7,6,10],target:[-.4,1,-.6]},lounge:{position:[1.5,4.6,8.2],target:[-4.7,1.0,1.7]}};
function fly(position,target,duration=1300){tween={start:performance.now(),duration,from:camera.position.clone(),to:new T.Vector3(...position),lookFrom:controls.target.clone(),lookTo:new T.Vector3(...target)};}
function preset(name){camera.clearViewOffset();if(name==='studio'&&innerWidth>=1100)camera.setViewOffset(innerWidth,innerHeight,-130,0,innerWidth,innerHeight);document.body.classList.toggle('is-focused',name!=='studio');const p=viewPresets[name];fly(p.position,p.target);document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));$('#agent-card').hidden=true;selected=null;document.querySelectorAll('.team-chip').forEach(b=>b.setAttribute('aria-pressed','false'));}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>preset(b.dataset.view));$('#office-nav').onclick=()=>preset('studio');
controls.addEventListener('start',()=>{tween=null;});
function selectAgent(id,closeup=false){
 selected=roster.find(a=>a.id===id);if(!selected)return;document.body.classList.add('is-focused');camera.setViewOffset(innerWidth,innerHeight,innerWidth>750?125:70,0,innerWidth,innerHeight);const actor=actors.find(a=>a.spec.id===id),p=actor.root.position;
 $('#agent-card').hidden=false;$('#agent-name').textContent=selected.name;$('#agent-provider').textContent=selected.provider==='codex'?'CODEX / TEAL':'CLAUDE CODE / TERRACOTTA';$('#agent-provider').style.color=COLORS[selected.provider];$('#agent-role').textContent=selected.role;$('#agent-status').textContent=selected.status;$('#agent-task').textContent=selected.task;$('#agent-description').textContent=selected.description;
 document.querySelectorAll('.team-chip').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.agent===id)));document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed','false'));
 if(closeup){const cam=selected.pose==='coffee'?[p.x+.65,1.9,p.z+2.8]:[p.x+1.65,1.95,p.z-1.9];fly(cam,[p.x,selected.pose==='coffee'?1.25:1.20,p.z]);}
 else if(selected.pose==='coffee')fly([p.x+4.8,3.8,p.z+5.4],[p.x,1.0,p.z]);
 else fly([p.x+3.1,3.5,p.z+4.1],[p.x,.95,p.z-.30]);
}
$('.card-close').onclick=()=>{$('#agent-card').hidden=true;camera.clearViewOffset();};$('#portrait').onclick=()=>selected&&selectAgent(selected.id,true);
const raycaster=new T.Raycaster(),pointer=new T.Vector2();let down=null,hover=null;
function hit(event){const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects([...actors.map(a=>a.root),...screens.map(s=>s.mesh)],true);return hits[0];}
renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;const h=hit(e);if(h?.object.userData.agent){const spec=roster.find(a=>a.id===h.object.userData.agent);if(screens.some(s=>s.mesh===h.object)){selected=spec;openScreen(spec);}else selectAgent(spec.id);}down=null;});
renderer.domElement.addEventListener('pointermove',e=>{const h=hit(e),id=h?.object.userData.agent;hover=id?roster.find(a=>a.id===id):null;renderer.domElement.style.cursor=hover?'pointer':'grab';const label=$('#hover-label');label.hidden=!hover;if(hover){label.textContent=hover.name+' · '+(screens.some(s=>s.mesh===h.object)?'Open screen':hover.role);label.style.left=e.clientX+'px';label.style.top=(e.clientY-18)+'px';}});renderer.domElement.addEventListener('pointerleave',()=>$('#hover-label').hidden=true);
function openScreen(spec){
 $('#screen-owner').textContent=spec.name+'’s desk · '+(spec.provider==='codex'?'Codex':'Claude Code');$('#screen-address').textContent='studio.worklive / '+(spec.type==='code'?'studio.ts':'field-notes');
 const page=$('#screen-page');page.replaceChildren();
 if(spec.type==='code'){
  page.style.background='#273e32';page.style.color='#dfdfb8';const title=document.createElement('p');title.className='article-brand';title.style.color='#a9bc96';title.textContent='MILO / STUDIO.TS';const pre=document.createElement('pre');pre.style.cssText='font:14px/2.1 monospace;white-space:pre-wrap';pre.textContent='// A little space for big ideas\n\nconst studio = createOffice({\n  atmosphere: "golden hour",\n  people: yourTeam,\n  focus: "something wonderful"\n});\n\nawait studio.bringIdeasToLife();\n\n// Illustrative code. This screen does not execute tasks.';page.append(title,pre);
 }else{page.style.background='#fffdf6';page.style.color='#304b35';page.innerHTML='<div class="article-brand">F I E L D N O T E S / 01</div><div class="eyebrow">PLACES FOR THOUGHTFUL WORK</div><h2 class="article-title">A quieter kind<br>of progress.</h2><div class="article-meta">Notes from the atelier · 4 minute read</div><div class="article-grid"><div class="article-art"></div><div><p>The best spaces leave room for people. For a question, a pause, or an idea that arrives over a cup of coffee.</p><p>Our studio begins with a simple thought: useful work should feel clear, tangible, and a little more alive.</p></div></div>';}
 $('#screen-dialog').showModal();$('#screen-focus').onclick=()=>{$('#screen-dialog').close();selectAgent(spec.id);};
}
$('#see-screen').onclick=()=>selected&&openScreen(selected);
for(const dialog of document.querySelectorAll('dialog')){dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});}
$('#projects-nav').onclick=()=>{const c=$('#content');c.innerHTML='<span class="eyebrow">THE SHAPE OF THINGS TO COME</span><h2>Small steps.<br><em>Meaningful progress.</em></h2><p class="fineprint">An illustrative project list for this visual concept.</p><div class="project-row"><span>01</span><div><strong>A quieter kind of progress</strong><small>Ada · Research & clarity</small></div><em>Exploring</em></div><div class="project-row"><span>02</span><div><strong>Give the studio a little life</strong><small>Milo · Engineering & craft</small></div><em>Building</em></div><div class="project-row"><span>03</span><div><strong>A welcome worth remembering</strong><small>June · Words & direction</small></div><em>In review</em></div>';$('#content-dialog').showModal();};
$('#library-nav').onclick=()=>{$('#content').innerHTML='<span class="eyebrow">THINGS WORTH KEEPING</span><h2>A shared<br><em>understanding.</em></h2><p class="fineprint">Illustrative context library. Real scoped memory remains in Worklive 0.8.</p><div class="project-row"><span>◈</span><div><strong>Company handbook</strong><small>The things everyone should know</small></div><em>Company</em></div><div class="project-row"><span>▧</span><div><strong>Studio direction</strong><small>Ideas, references and decisions</small></div><em>Project</em></div><div class="project-row"><span>⌑</span><div><strong>Personal notebooks</strong><small>A little knowledge that stays with each agent</small></div><em>Personal</em></div>';$('#content-dialog').showModal();};
$('#invite').onclick=()=>{if(roster.length>=6){$('#content').innerHTML='<span class="eyebrow">A COZY LITTLE STUDIO</span><h2>Six is good company.</h2><p>This visual concept holds six characters. Larger rooms and departments are a future design step.</p>';$('#content-dialog').showModal();return;}$('#invite-dialog').showModal();};
$('#invite-form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),name=String(f.get('name')).trim();if(!name)return;const index=roster.length,spec={id:'guest-'+index,name,provider:f.get('provider'),role:'A new perspective',status:'Settling into the studio',task:'Room for the next idea',description:'A new character in this visual study. Assign real work in the Worklive app.',type:'article',pose:'typing',desk:index};const desk=workstation(4,index===4?-2.35:1.85,index);built.desks.push(desk);roster.push(spec);addActor(spec,index);e.target.reset();$('#invite-dialog').close();selectAgent(spec.id);};
function setEvening(){evening=!evening;document.body.classList.toggle('evening',evening);$('#lighting').innerHTML=evening?'☾ <span>After hours</span>':'☀ <span>Golden hour</span>';$('#lighting').setAttribute('aria-label',evening?'Switch to golden hour light':'Switch to evening light');}
$('#lighting').onclick=setEvening;
function updateMotion(){const b=$('#motion');b.textContent=paused?'▷':'Ⅱ';b.setAttribute('aria-label',paused?'Resume scene animation':'Pause scene animation');}
$('#motion').onclick=()=>{paused=!paused;updateMotion();};updateMotion();
addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]'))preset('studio');});
function resize(){camera.aspect=innerWidth/innerHeight;if(selected)camera.setViewOffset(innerWidth,innerHeight,innerWidth>750?125:70,0,innerWidth,innerHeight);camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);const narrow=innerWidth<1100;const mobile=innerWidth<600;viewPresets.studio.position=mobile?[27,24,32]:narrow?[20,18,24]:[17,15,20];viewPresets.studio.target=narrow?[0,1.7,0]:[.1,.8,0];if(initial||document.querySelector('[data-view=studio]')?.getAttribute('aria-pressed')==='true'){camera.clearViewOffset();if(!narrow)camera.setViewOffset(innerWidth,innerHeight,-130,0,innerWidth,innerHeight);camera.position.fromArray(viewPresets.studio.position);controls.target.fromArray(viewPresets.studio.target);}}
addEventListener('resize',resize);resize();
const dayColor=new T.Color('#e9e6dc'),nightColor=new T.Color('#343e38'),dayFloor=new T.Color('#e6e3d6'),nightFloor=new T.Color('#465044');let lightMix=0;
function render(now){requestAnimationFrame(render);const dt=Math.min((now-last)/1000,.05);last=now;if(!paused)clock+=dt;
 if(tween){const f=Math.min(1,(now-tween.start)/tween.duration),ease=f<.5?4*f*f*f:1-Math.pow(-2*f+2,3)/2;camera.position.lerpVectors(tween.from,tween.to,ease);controls.target.lerpVectors(tween.lookFrom,tween.lookTo,ease);if(f===1)tween=null;}
 controls.update();actors.forEach((a,i)=>a.update(clock+i*.43,a.spec.pose));
 lightMix=T.MathUtils.damp(lightMix,evening?1:0,2.3,dt);scene.background.copy(dayColor).lerp(nightColor,lightMix);scene.fog.color.copy(scene.background);ground.material.color.copy(dayFloor).lerp(nightFloor,lightMix);hemi.intensity=T.MathUtils.lerp(1.05,.42,lightMix);sun.intensity=T.MathUtils.lerp(2.7,.10,lightMix);fill.intensity=T.MathUtils.lerp(.75,.35,lightMix);renderer.toneMappingExposure=T.MathUtils.lerp(1.02,1.02,lightMix);lamps.forEach(m=>m.emissiveIntensity=T.MathUtils.lerp(.35,2.1,lightMix));pendants.forEach(l=>l.intensity=T.MathUtils.lerp(1,7,lightMix));
 composer.render();
 if(initial){initial=false;requestAnimationFrame(()=>{$('#loading').style.opacity=0;setTimeout(()=>$('#loading').hidden=true,650);});}
}
requestAnimationFrame(render);
// Read-only diagnostics for visual QA; no privileged application bridge.
window.atelierDiagnostics=()=>({characters:actors.length,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,providerColors:COLORS,paused,evening,selected:selected?.id||null,concept:true});
