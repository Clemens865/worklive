import * as pc from '/engine.mjs';
import { DESKS, PROVIDERS, createPeople, advancePeople, frameSummary } from './simulation.mjs';

const $=id=>document.getElementById(id),canvas=$('office'),stage=$('stage');
const app=new pc.Application(canvas,{graphicsDeviceOptions:{antialias:true,alpha:false,powerPreference:'low-power'}});
app.autoRender=false;app.graphicsDevice.maxPixelRatio=1;
app.setCanvasFillMode(pc.FILLMODE_NONE,stage.clientWidth,stage.clientHeight);app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.scene.ambientLight=new pc.Color(.63,.68,.59);
app.scene.clusteredLightingEnabled=false;
const camera=new pc.Entity('Office camera');
camera.addComponent('camera',{projection:pc.PROJECTION_ORTHOGRAPHIC,orthoHeight:13,nearClip:.1,farClip:100,clearColor:new pc.Color(.886,.914,.867)});
app.root.addChild(camera);
const keyLight=new pc.Entity('Daylight');keyLight.addComponent('light',{type:'directional',color:new pc.Color(1,.94,.82),intensity:1.35,castShadows:false});keyLight.setEulerAngles(48,-30,0);app.root.addChild(keyLight);
const people=createPeople();let population=20,selected=0,paused=false,quality='smooth',dirty=true,time=0,live=false,liveStarting=false,focused=-1;
const cameraState={yaw:34,pitch:46,zoom:13.5,target:new pc.Vec3(1,.65,1),actualYaw:34,actualPitch:46,actualZoom:13.5};
const meshes={box:pc.createBox(app.graphicsDevice),sphere:pc.createSphere(app.graphicsDevice,{latitudeBands:8,longitudeBands:12}),cylinder:pc.createCylinder(app.graphicsDevice,{heightSegments:1,capSegments:12}),cone:pc.createCone(app.graphicsDevice,{heightSegments:1,capSegments:8}),plane:pc.createPlane(app.graphicsDevice),torus:pc.createTorus(app.graphicsDevice,{tubeRadius:.03,ringRadius:.5,segments:24,sides:5})};
const materials=new Map(),groups=new Map();let nextMaterial=0;
function material(hex,{unlit=false,texture=null,opacity=1}={}){
 const cache=hex+unlit+opacity;if(!texture&&materials.has(cache))return materials.get(cache);
 const m=new pc.StandardMaterial(),c=new pc.Color().fromString(hex);
 m.name=`material-${nextMaterial++}`;m.diffuse.copy(c);m.gloss=0;m.metalness=0;m.useMetalness=true;m.useLighting=!unlit;
 if(unlit){m.emissive.copy(c);m.diffuse.set(0,0,0);}
 if(texture){m.emissive.set(1,1,1);m.emissiveMap=texture;m.diffuse.set(0,0,0);m.useLighting=false;}
 if(opacity<1){m.opacity=opacity;m.blendType=pc.BLEND_NORMAL;m.depthWrite=false;}
 m.update();if(!texture)materials.set(cache,m);return m;
}
const M={floor:material('#D3D9C3'),edge:material('#8B9A7F'),wall:material('#EDEEDF'),wood:material('#D8B985'),woodDark:material('#AB8858'),dark:material('#38493F'),metal:material('#667363'),paper:material('#F3F1DD'),sage:material('#8BA285'),moss:material('#607E59'),leaf:material('#456D47'),mint:material('#B2C7A2'),clay:material('#D7A383'),rug:material('#BCC9AF'),rug2:material('#DFCCAD'),glass:material('#D9EBE0',{unlit:true}),sun:material('#E8E5CC',{unlit:true}),teal:material(PROVIDERS.codex),claude:material(PROVIDERS.claude),pants:material('#46505A'),shoes:material('#E6E4D4'),hair:material('#514239'),hair2:material('#B5834D'),skin:material('#E2B899'),skin2:material('#B48262'),black:material('#2E3734'),shadow:material('#4F6343',{opacity:.09,unlit:true})};
function node(parent,name,pos,scale,rot=[0,0,0]){const e=new pc.Entity(name);parent.addChild(e);e.setLocalPosition(...pos);e.setLocalScale(...scale);e.setLocalEulerAngles(...(rot || [0,0,0]));return e;}
function instance(kind,mat,pos,scale,rot=[0,0,0],parent=null,agent=-1){
 const dynamic=!!parent||agent>=0,key=`${kind}/${mat.name}/${dynamic?'dynamic':'static'}`;
 if(!groups.has(key))groups.set(key,{kind,mat,dynamic,items:[]});
 const n=node(parent||app.root,kind,pos,scale,rot);groups.get(key).items.push({node:n,agent});return n;
}
const box=(mat,pos,scale,rot,parent,agent)=>instance('box',mat,pos,scale,rot,parent,agent);
const sphere=(mat,pos,scale,rot,parent,agent)=>instance('sphere',mat,pos,scale,rot,parent,agent);
const cylinder=(mat,pos,scale,rot,parent,agent)=>instance('cylinder',mat,pos,scale,rot,parent,agent);
const plane=(mat,pos,scale,rot,parent,agent)=>instance('plane',mat,pos,scale,rot,parent,agent);
function plant(x,z,size=1){
 cylinder(M.clay,[x,.29*size,z],[.58*size,.58*size,.58*size]);cylinder(M.woodDark,[x,.57*size,z],[.49*size,.035,.49*size]);
 cylinder(M.woodDark,[x,.95*size,z],[.055,1*size,.055]);
 for(let i=0;i<5;i++){const a=i*2.4;sphere(i%2?M.moss:M.leaf,[x+Math.cos(a)*.19*size,(1.02+i*.13)*size,z+Math.sin(a)*.19*size],[.55*size,.25*size,.33*size],[i*18,i*71,25]);}
}
function mug(x,y,z,mat=M.paper){cylinder(mat,[x,y,z],[.16,.2,.16]);cylinder(M.woodDark,[x,y+.103,z],[.115,.012,.115]);instance('torus',mat,[x+.09,y,z],[.16,.16,.16],[90,0,0]);}
function labelTexture(text,sub,color='#375843',width=512,height=128){const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');ctx.fillStyle='#edeee1';ctx.fillRect(0,0,width,height);ctx.fillStyle=color;ctx.font='500 55px -apple-system, sans-serif';ctx.fillText(text,25,67);ctx.fillStyle='#839176';ctx.font='17px -apple-system, sans-serif';ctx.fillText(sub,28,104);const tex=new pc.Texture(app.graphicsDevice,{width,height,mipmaps:false,minFilter:pc.FILTER_LINEAR,magFilter:pc.FILTER_LINEAR});tex.setSource(c);return material('#FFFFFF',{texture:tex});}
// Repeated geometry is submitted in instanced batches, including the furniture.
box(M.edge,[1,-.25,.5],[26,.45,19.5]);box(M.floor,[1,-.015,.5],[25.8,.08,19.3]);
box(M.wall,[1,1.85,-9.1],[26,3.7,.18]);box(M.wall,[-11.9,1.85,.5],[.18,3.7,19.5]);
box(M.woodDark,[1,.1,-8.93],[25.8,.16,.06]);box(M.woodDark,[-11.75,.1,.5],[.06,.16,19.3]);
for(let x=-10;x<14;x+=1.15)box(M.edge,[x,.03,.5],[.018,.004,19.2]);
for(let i=0;i<7;i++){const x=-9.7+i*3.35;box(M.wood,[x,2.2,-8.95],[2.85,2.05,.1]);box(M.glass,[x,2.2,-8.87],[2.67,1.87,.04]);box(M.paper,[x,2.2,-8.81],[.07,1.9,.06]);box(M.paper,[x,2.2,-8.80],[2.7,.07,.06]);box(M.wood,[x,1.22,-8.62],[3.0,.1,.58]);}
for(let z=-6;z<8;z+=3.9){box(M.glass,[-11.78,2.1,z],[.08,2.1,2.6]);box(M.wood,[-11.66,1,-0+z],[.35,.12,2.9]);}
plane(labelTexture('worklive','A LITTLE SPACE FOR GOOD WORK'),[-4.5,3,-8.79],[3.4,1,.85],[90,0,0]);
// Sun patches are simple flat shapes, not real-time lighting passes.
for(let i=0;i<5;i++)plane(M.sun,[-9+i*4.4,.045,-6.4],[2.0,1,3.5],[0,14,0]);
for(let r=0;r<4;r++)box(r%2?M.rug:M.rug2,[-2.6,.049,-5.5+r*3.8],[15.8,.025,2.55]);
// Shared idle texture; only two monitors receive optional live captures.
const idleCanvas=document.createElement('canvas');idleCanvas.width=512;idleCanvas.height=320;
function drawIdle(){const c=idleCanvas.getContext('2d');c.fillStyle='#263F38';c.fillRect(0,0,512,320);c.fillStyle='#aac0a1';c.font='16px sans-serif';c.fillText('worklive',30,38);c.fillStyle='#E7EADB';c.font='40px sans-serif';c.fillText('Room to think.',30,133);c.fillStyle='#8FA88C';c.font='17px sans-serif';c.fillText('Available · no task running',32,172);c.fillStyle='#34564B';c.fillRect(31,226,448,2);c.fillStyle='#8DAA88';c.font='13px sans-serif';c.fillText('A GOOD DAY STARTS WITH A LITTLE SPACE.',32,258);}
drawIdle();const idleTex=new pc.Texture(app.graphicsDevice,{mipmaps:false});idleTex.setSource(idleCanvas);const idleMat=material('#FFFFFF',{texture:idleTex});
const screenTextures=[],screenThumbs=[],screenNodes=[],screenData=[null,null],imageUrls=[null,null];
DESKS.forEach((d,i)=>{
 const tag=i;
 plane(M.shadow,[d.x,.065,d.z+.2],[2.75,1,2.15],null, null,tag);
 box(M.wood,[d.x,1.03,d.z],[2.32,.13,1.08],undefined,null,tag);
 box(M.woodDark,[d.x,.93,d.z],[2.12,.07,.85],undefined,null,tag);
 for(const dx of [-.94,.94])for(const dz of [-.34,.34])box(M.paper,[d.x+dx,.48,d.z+dz],[.09,.96,.09],undefined,null,tag);
 box(M.dark,[d.x,1.52,d.z-.12],[1.16,.74,.085],undefined,null,tag);
 box(M.metal,[d.x,1.2,d.z-.14],[.065,.31,.065],undefined,null,tag);
 box(M.dark,[d.x,1.12,d.z-.13],[.42,.035,.26],undefined,null,tag);
 box(M.paper,[d.x,1.107,d.z+.35],[.72,.025,.23],undefined,null,tag);
 box(M.metal,[d.x+.52,1.113,d.z+.34],[.1,.035,.15],undefined,null,tag);
 box(i%2?M.clay:M.mint,[d.x-.87,1.13,d.z+.15],[.25,.07,.32],undefined,null,tag);
 // Empty chairs stay tucked beside the standing desks, clear of navigation.
 cylinder(M.dark,[d.x+.96,.64,d.z+.63],[.48,.12,.48],undefined,null,tag);
 cylinder(M.metal,[d.x+.96,.31,d.z+.63],[.05,.62,.05],undefined,null,tag);
 cylinder(M.dark,[d.x+.96,.06,d.z+.63],[.42,.06,.42],undefined,null,tag);
 let mat=idleMat;
 if(i<2){const t=new pc.Texture(app.graphicsDevice,{width:1024,height:640,mipmaps:false,minFilter:pc.FILTER_LINEAR,magFilter:pc.FILTER_LINEAR});t.setSource(idleCanvas);screenTextures[i]=t;const thumb=document.createElement('canvas');thumb.width=256;thumb.height=160;screenThumbs[i]=thumb;mat=material('#FFFFFF',{texture:t});}
 const n=plane(mat,[d.x,1.52,d.z-.068],[1.06,1,.65],[90,0,0],null,tag);screenNodes.push(n);
});
// The communal side of the studio.
box(M.rug,[9,.07,.5],[6.5,.05,16.3]);box(M.wood,[9,1.08,-6.5],[5,.14,1.3]);box(M.sage,[9,.52,-6.5],[4.8,1.04,1.14]);
for(let i=0;i<4;i++)box(M.paper,[7.3+i*1.12,.76,-5.91],[.055,.03,.04]);
box(M.dark,[8,1.44,-6.45],[.72,.58,.55]);box(M.metal,[8,1.43,-6.14],[.58,.27,.03]);cylinder(M.dark,[8,1.77,-6.44],[.32,.1,.32]);mug(8,1.18,-6.05);mug(9.2,1.26,-6.4);mug(9.7,1.26,-6.4,M.clay);
plane(labelTexture('a little pause','COFFEE  /  GOOD COMPANY'),[9,2.85,-8.79],[3.2,1,.8],[90,0,0]);
box(M.woodDark,[10,.66,.2],[2.9,.18,2.1]);box(M.sage,[10,.92,.2],[2.8,.4,1.9]);box(M.moss,[11.18,1.25,.2],[.3,.68,2.1]);
for(const z of [-.65,1.05])box(M.sage,[10,1.11,z],[2.85,.8,.25]);
box(M.paper,[10.5,1.2,-.34],[.58,.22,.58],[0,15,0]);box(M.clay,[10.5,1.2,.35],[.58,.22,.58],[0,-12,0]);
cylinder(M.wood,[7.8,.66,.2],[1.15,.12,1.15]);cylinder(M.dark,[7.8,.32,.2],[.09,.64,.09]);mug(7.8,.81,.2);
box(M.woodDark,[9.4,.69,6.2],[2.8,.13,2.1]);box(M.moss,[9.4,.78,6.2],[2.72,.05,2.04]);
box(M.paper,[9.4,.81,6.2],[.028,.01,2]);box(M.paper,[9.4,.81,6.2],[2.7,.01,.028]);box(M.paper,[9.4,.94,6.2],[2.72,.27,.025]);
for(const x of [8.35,10.45])box(M.dark,[x,.34,6.2],[.12,.68,1.6]);
for(const [x,z,s]of [[-11,-7.8,1.2],[5.4,-7.9,1.1],[12.1,-6.9,1.3],[12.3,3.4,1.4],[5.9,8.6,1],[-10.7,8.6,1.1]])plant(x,z,s);
plane(labelTexture('OFFICE / 01','A TEAM OF TWENTY', '#697B5B',512,128),[-5,.09,8.35],[5,1,1.25],[0,0,0]);
// Characters have original low-detail geometry; limbs share meshes and materials.
const rigs=[];
people.forEach((a,i)=>{
 const root=node(app.root,`Agent ${a.name}`,[a.x,0,a.z],[1,1,1]),shirt=i%2?M.claude:M.teal,skin=i%4<2?M.skin:M.skin2;
 const torso=node(root,'torso',[0,.99,0],[1,1,1]);
 sphere(shirt,[0,0,0],[.63,.64,.37],undefined,torso,i);box(shirt,[0,-.18,0],[.48,.28,.31],undefined,torso,i);
 cylinder(skin,[0,.29,0],[.16,.16,.16],undefined,torso,i);
 const head=node(torso,'head',[0,.53,0],[1,1,1]);
 sphere(skin,[0,0,0],[.49,.54,.45],undefined,head,i);
 sphere(i%3?M.hair:M.hair2,[0,.16,-.045],[.51,.28,.43],undefined,head,i);
 sphere(skin,[-.245,-.02,0],[.1,.13,.09],undefined,head,i);sphere(skin,[.245,-.02,0],[.1,.13,.09],undefined,head,i);
 for(const x of [-.105,.105])box(M.black,[x,.005,.218],[.04,.06,.018],undefined,head,i);
 sphere(skin,[0,-.06,.235],[.07,.07,.065],undefined,head,i);
 if(i%4===0){for(const x of [-.105,.105])box(M.hair,[x,0,.239],[.145,.022,.024],undefined,head,i);box(M.hair,[0,0,.235],[.075,.02,.024],undefined,head,i);}
 const arms=[],legs=[];
 for(const sign of [-1,1]){
  const arm=node(torso,'arm',[sign*.32,.14,0],[1,1,1]);sphere(shirt,[0,-.12,0],[.22,.33,.25],undefined,arm,i);sphere(skin,[0,-.36,0],[.155,.28,.155],undefined,arm,i);sphere(skin,[0,-.51,0],[.17,.18,.17],undefined,arm,i);arms.push(arm);
  const leg=node(root,'leg',[sign*.145,.66,0],[1,1,1]);box(M.pants,[0,-.24,0],[.21,.48,.23],undefined,leg,i);sphere(M.shoes,[0,-.53,.065],[.24,.17,.36],undefined,leg,i);legs.push(leg);
 }
 plane(M.shadow,[0,.07,0],[.85,1,.65],undefined,root,i);
 rigs.push({root,torso,head,arms,legs,yaw:180});
});
const ring=node(app.root,'Selected agent',[0,.09,0],[1,1,1]);instance('torus',material('#FFF7D4',{unlit:true}),[0,0,0],[1.28,1,1.28],undefined,ring);
function compileGroups(){for(const g of groups.values()){
 const e=new pc.Entity(`${g.kind} instances`);app.root.addChild(e);const mi=new pc.MeshInstance(meshes[g.kind],g.mat,e);mi.cull=false;mi.castShadow=false;mi.receiveShadow=false;
 g.entity=e;g.mi=mi;g.buffer=new Float32Array(g.items.length*16);g.vb=new pc.VertexBuffer(app.graphicsDevice,pc.VertexFormat.getDefaultInstancingFormat(app.graphicsDevice),g.items.length,{usage:g.dynamic?pc.BUFFER_DYNAMIC:pc.BUFFER_STATIC});mi.setInstancing(g.vb);e.addComponent('render',{meshInstances:[mi],castShadows:false,receiveShadows:false});uploadGroup(g);
}}
function uploadGroup(g){let n=0;for(const item of g.items){if(item.agent>=population)continue;g.buffer.set(item.node.getWorldTransform().data,n*16);n++;}g.mi.instancingCount=n;g.entity.enabled=n>0;if(n)g.vb.setData(g.buffer);}
compileGroups();
function cameraUpdate(dt){const c=cameraState,t=1-Math.exp(-dt*10);c.actualYaw+=(c.yaw-c.actualYaw)*t;c.actualPitch+=(c.pitch-c.actualPitch)*t;c.actualZoom+=(c.zoom-c.actualZoom)*t;const y=c.actualYaw*Math.PI/180,p=c.actualPitch*Math.PI/180,r=38;camera.setPosition(c.target.x+Math.sin(y)*Math.cos(p)*r,c.target.y+Math.sin(p)*r,c.target.z+Math.cos(y)*Math.cos(p)*r);camera.lookAt(c.target);camera.camera.orthoHeight=c.actualZoom;}
function resize(){const w=stage.clientWidth,h=stage.clientHeight;app.graphicsDevice.maxPixelRatio=Math.min(1,1700/w,1000/h);app.resizeCanvas(w,h);cameraState.zoom=Math.max(12.8,17.8/(w/h));dirty=true;}
new ResizeObserver(resize).observe(stage);resize();cameraUpdate(1);
function animate(dt){
 if(!paused){time+=dt;advancePeople(people.slice(0,population),dt,time);}
 for(let i=0;i<population;i++){
  const a=people[i],r=rigs[i],walk=a.path.length&&a.state!=='Waiting to pass',swing=walk?Math.sin(a.distance*10)*25:0;
  let diff=((a.yaw-r.yaw+540)%360)-180;r.yaw+=diff*Math.min(1,dt*9);
  r.root.setPosition(a.x,walk?Math.abs(Math.sin(a.distance*10))*.025:0,a.z);r.root.setEulerAngles(0,r.yaw,0);
  if(!paused){r.torso.setLocalEulerAngles(walk?3:0,0,Math.sin(time*1.1+i)*.9);r.head.setLocalEulerAngles(0,walk?0:Math.sin(time*.35+i)*10,0);
   r.legs[0].setLocalEulerAngles(swing,0,0);r.legs[1].setLocalEulerAngles(-swing,0,0);
   const typing=a.destination==='desk'&&!walk;
   r.arms[0].setLocalEulerAngles(typing?-50+Math.sin(time*5+i)*3:-swing*.7,0,typing?-12:-5);r.arms[1].setLocalEulerAngles(typing?-50+Math.sin(time*5+i+1)*3:swing*.7,0,typing?12:5);
  }
 }
 const a=people[selected];ring.setPosition(a.x,.09,a.z);for(const g of groups.values())if(g.dynamic)uploadGroup(g);
}
let lastTick=performance.now(),lastRender=0,nextRender=0,statsAt=0,samples=[],history=[],bench=null,lastMetrics=null,renderCounts={drawCalls:0,triangles:0};
app.on('update',()=>{
 const now=performance.now();if(document.hidden)return;
 const interval=quality==='eco'?1000/30:1000/60;
 if($('screen-dialog').open||$('about-dialog').open)return;
 if(now+.5<nextRender&&!dirty)return;
 const dt=Math.min((now-lastTick)/1000,.05);lastTick=now;nextRender=Math.max(nextRender+interval,now+.5);
 const cameraMoving=Math.abs(cameraState.actualZoom-cameraState.zoom)>.005||Math.abs(cameraState.actualYaw-cameraState.yaw)>.005||Math.abs(cameraState.actualPitch-cameraState.pitch)>.005;
 if(paused&&!dirty&&!cameraMoving&&!bench)return;
 cameraUpdate(dt);animate(dt);app.renderNextFrame=true;dirty=false;
});
app.on('postrender',()=>{
 renderCounts={drawCalls:app.graphicsDevice._drawCallsPerFrame,triangles:[...groups.values()].reduce((sum,g)=>sum+(g.mi.instancingCount||0)*meshes[g.kind].primitive[0].count/3,0)};
 const now=performance.now();if(lastRender){const ms=now-lastRender;if(ms>0)samples.push(ms);}
 lastRender=now;
 if(bench){if(bench.lastAt!==null)bench.samples.push(now-bench.lastAt);bench.lastAt=now;}
 if(now-statsAt>600&&!paused){
  const metrics=frameSummary(samples.slice(-120));if(metrics){lastMetrics=metrics;$('fps').textContent=Math.round(metrics.fps);$('frame-time').textContent=`${metrics.p95.toFixed(1)} ms`;history.push(Math.min(40,1000/metrics.fps));history=history.slice(-30);$('spark').firstElementChild.setAttribute('points',history.map((v,i)=>`${i/29*100},${Math.min(30,Math.max(2,v/40*30))}`).join(' '));}
  $('fps').dataset.viewport=`${canvas.width} × ${canvas.height}`;$('fps').dataset.metrics=JSON.stringify({...metrics,...renderCounts});
  $('draws').textContent=`${renderCounts.drawCalls} / ${(renderCounts.triangles/1000).toFixed(1)}k`;
  $('agent-status').textContent=people[selected].state+(selected<2&&live?' · browser demo':'');
  samples=samples.slice(-180);statsAt=now;
 }
 if(bench){const left=Math.max(0,Math.ceil((bench.until-now)/1000));$('benchmark').textContent=`Measuring… ${left}s`;
  if(now>=bench.until){const result={...frameSummary(bench.samples),people:population,livePages:live?2:0,mode:quality,viewport:[canvas.width,canvas.height],drawCalls:renderCounts.drawCalls,triangles:renderCounts.triangles,durationMs:bench.samples.reduce((a,b)=>a+b,0),engine:pc.version,measuredAt:new Date().toISOString(),scope:'Browser rendering and optional scripted preview only; no CLI tasks or packaged Tauri'};window.workliveStudy.lastBenchmark=result;$('benchmark-result').dataset.report=JSON.stringify(result);$('benchmark-result').textContent=`${Math.round(result.fps)} FPS · p95 ${result.p95.toFixed(1)} ms · ${result.over50} frames over 50 ms. ${result.people} people, ${result.livePages} browser pages.`;$('benchmark').textContent='Measure again ↗';$('benchmark').disabled=false;$('population').disabled=false;$('quality').disabled=false;bench=null;}
 }
});
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,6500);}
function cancelBenchmark(reason){if(!bench)return;bench=null;$('benchmark').disabled=false;$('benchmark').textContent='Measure 15 seconds ↗';$('population').disabled=false;$('quality').disabled=false;$('benchmark-result').textContent=reason;}
function selectAgent(i){selected=i;$('agent-name').textContent=people[i].name;$('agent-role').textContent=people[i].role;$('avatar').textContent=people[i].name[0];$('avatar').style.background=i%2?'#f1dfd2':'#d7e9df';$('agent-status').previousElementSibling.className=i%2?'clay':'teal';document.querySelectorAll('#roster button').forEach((b,n)=>b.setAttribute('aria-pressed',String(n===i)));$('agent-detail').textContent=i<2?'This desk can show a real browser during the demo. The character’s actions are simulated; no AI task is running.':'An available teammate. Personalities, memories and real task assignment stay in the main Worklive app.';dirty=true;}
people.forEach((a,i)=>{const b=document.createElement('button');b.title=`${a.name} · ${a.provider==='codex'?'Codex':'Claude Code'}`;b.setAttribute('aria-label',b.title);b.className=a.provider;b.setAttribute('aria-pressed',String(i===0));b.addEventListener('click',()=>selectAgent(i));$('roster').appendChild(b);});
function updatePopulation(){population=Number($('population').value);people.splice(0,people.length,...createPeople());time=0;lastRender=0;samples=[];if(selected>=population)selectAgent(0);document.querySelectorAll('#roster button').forEach((b,i)=>b.hidden=i>=population);$('team-count').textContent=`${population} / 20`;$('footer-count').textContent=`${population} people`;for(const g of groups.values())uploadGroup(g);dirty=true;}
$('population').addEventListener('change',updatePopulation);
$('quality').addEventListener('change',()=>{quality=$('quality').value;samples=[];lastRender=0;dirty=true;});
$('pause').addEventListener('click',()=>{paused=!paused;$('pause').textContent=paused?'▷ Resume life':'Ⅱ Pause life';$('pause').setAttribute('aria-pressed',String(paused));if(paused){cancelBenchmark('Measurement cancelled when office life paused.');$('fps').textContent='—';$('frame-time').textContent='Paused';}lastRender=0;samples=[];dirty=true;});
$('overview').addEventListener('click',()=>{cameraState.yaw=34;cameraState.pitch=46;cameraState.target.set(1,.65,1);resize();dirty=true;});
$('closer').addEventListener('click',()=>{cameraState.zoom=Math.max(5.5,cameraState.zoom*.72);dirty=true;});
$('benchmark').addEventListener('click',()=>{if(paused)$('pause').click();bench={until:performance.now()+15000,samples:[],lastAt:null};$('benchmark').disabled=true;$('population').disabled=true;$('quality').disabled=true;$('benchmark-result').textContent='Keep this window visible. Measuring rendered frame intervals for 15 seconds…';dirty=true;});
$('help').onclick=()=>{cancelBenchmark('Measurement cancelled: the information panel was opened.');$('about-dialog').showModal();};$('about-dialog').addEventListener('close',()=>{lastRender=0;lastTick=performance.now();dirty=true;});$('close-about').onclick=()=>$('about-dialog').close();
let drag=null;
canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{
 if(drag){const dx=e.clientX-drag.lastX,dy=e.clientY-drag.lastY;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>5)drag.moved=true;cameraState.yaw-=dx*.25;cameraState.pitch=Math.max(22,Math.min(74,cameraState.pitch+dy*.18));drag.lastX=e.clientX;drag.lastY=e.clientY;dirty=true;return;}
 const rect=canvas.getBoundingClientRect(),hit=pick(e.clientX-rect.left,e.clientY-rect.top);
 canvas.style.cursor=hit>=0?'pointer':'grab';$('hover').hidden=hit<0;if(hit>=0){$('hover').textContent=`${people[hit].name} · view desk`;$('hover').style.left=`${Math.min(e.clientX-rect.left+12,rect.width-135)}px`;$('hover').style.top=`${Math.max(0,e.clientY-rect.top-32)}px`;}
});
canvas.addEventListener('pointerleave',()=>{$('hover').hidden=true;});
canvas.addEventListener('pointerup',e=>{if(drag&&!drag.moved){const rect=canvas.getBoundingClientRect(),hit=pick(e.clientX-rect.left,e.clientY-rect.top);if(hit>=0){selectAgent(hit);openScreen();}}drag=null;});
canvas.addEventListener('pointercancel',()=>drag=null);
canvas.addEventListener('wheel',e=>{e.preventDefault();cameraState.zoom=Math.max(5,Math.min(25,cameraState.zoom+e.deltaY*.012));dirty=true;},{passive:false});
function screenPoint(i){const d=DESKS[i];return camera.camera.worldToScreen(new pc.Vec3(d.x,1.52,d.z-.068));}
function pick(x,y){let best=-1,distance=30;for(let i=0;i<population;i++){const p=screenPoint(i),d=Math.hypot(p.x-x,p.y-y);if(d<distance){distance=d;best=i;}}return best;}
function updateScreen(){const i=selected;$('start-from-screen').textContent=live&&i>=2?'View Ada’s browser':'Start browser demo';$('screen-name').textContent=people[i].name;$('screen-image').classList.toggle('live',i<2&&!!imageUrls[i]);if(i<2&&imageUrls[i])$('screen-image').src=imageUrls[i];$('screen-url').textContent=i<2&&screenData[i]?screenData[i].url:'worklive.local / available';$('screen-kind').textContent=i<2&&imageUrls[i]?(live&&Date.now()-(screenData[i]?.at||0)<12000?'LIVE BROWSER':'LAST CAPTURE'):'SIMULATED';$('screen-note').textContent='Scripted browser demo · no AI task running. Full browser control belongs in the main app.';$('browse-next').hidden=!(live&&i<2);}
function openScreen(){cancelBenchmark('Measurement cancelled: the expanded screen was opened.');focused=selected<2?selected:-1;updateScreen();$('screen-dialog').showModal();heartbeat();}
$('inspect').onclick=openScreen;$('close-screen').onclick=()=>$('screen-dialog').close();$('screen-dialog').addEventListener('close',()=>{focused=-1;lastRender=0;lastTick=performance.now();dirty=true;heartbeat();});
for(const id of ['screen-dialog','about-dialog'])$(id).addEventListener('click',e=>{if(e.target===$(id)){const r=$(id).getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$(id).close();}});
const viewerId=crypto.randomUUID();
async function control(action,extra={}){const response=await fetch('/api/control',{method:'POST',headers:{'Content-Type':'application/json','X-Worklive-Demo':'1'},body:JSON.stringify({action,...extra})});const result=await response.json();if(!response.ok)throw new Error(result.error||'The browser demo could not start.');return result;}
async function heartbeat(){try{await control('heartbeat',{id:viewerId,visible:!document.hidden,focus:focused});}catch{}}
async function toggleLive(forceStart=false){
 if(liveStarting)return;cancelBenchmark('Browser workload changed. Run a new measurement.');liveStarting=true;$('live').disabled=true;$('start-from-screen').disabled=true;$('live').textContent=live&&!forceStart?'Stopping browsers…':'Opening two browsers…';
 try{await heartbeat();const result=await control(live&&!forceStart?'stop':'start');live=result.enabled;await pollStatus();}
 catch(e){toast(e.message);}
 finally{liveStarting=false;$('live').disabled=false;$('start-from-screen').disabled=false;$('live').textContent=live?'■ Stop browser demo':'↗ Start browser demo';updateScreen();}
}
$('live').onclick=()=>toggleLive();$('start-from-screen').onclick=()=>{if(selected>=2){selectAgent(0);focused=0;updateScreen();heartbeat();}if(!live)toggleLive(true);};
$('browse-next').onclick=async()=>{cancelBenchmark('Browser navigation changed. Run a new measurement.');$('browse-next').disabled=true;try{await control('navigate',{agent:selected});await pollStatus();}catch(e){toast(e.message);}finally{$('browse-next').disabled=false;}};
let polling=false,lastFrames=[0,0],seenError='';
async function pollStatus(){
 if(polling||document.hidden)return;polling=true;
 try{
  const status=await(await fetch('/api/status')).json();live=status.enabled;$('pages').textContent=status.pages;
  $('feed-state').textContent=live?'2 real browser previews · scripted demo':'Office simulation · no AI tasks running';
  if(!liveStarting)$('live').textContent=live?'■ Stop browser demo':'↗ Start browser demo';
  if(status.error&&status.error!==seenError){seenError=status.error;toast(status.error);}
  for(let i=0;i<2;i++){
   screenData[i]=status.feeds[i];
   if(!live||!status.feeds[i].at||status.feeds[i].at===lastFrames[i])continue;
   const response=await fetch(`/api/frame/${i}`);if(response.status!==200)continue;
   const blob=await response.blob(),url=URL.createObjectURL(blob),image=new Image();image.src=url;await image.decode();
   screenThumbs[i].getContext('2d').drawImage(image,0,0,256,160);screenTextures[i].setSource(screenThumbs[i]);if(imageUrls[i])URL.revokeObjectURL(imageUrls[i]);imageUrls[i]=url;lastFrames[i]=Number(response.headers.get('X-Frame-At'));dirty=true;
  }
  if($('screen-dialog').open)updateScreen();
 }catch(e){if(!seenError){seenError=e.message;toast('The prototype server is unavailable. Office animation still works.');}}
 finally{polling=false;}
}
setInterval(heartbeat,2500);setInterval(pollStatus,500);heartbeat();pollStatus();
document.addEventListener('visibilitychange',()=>{heartbeat();if(document.hidden){cancelBenchmark('Measurement cancelled: the page was hidden.');$('hover').hidden=true;}else{lastTick=performance.now();lastRender=0;samples=[];nextRender=0;dirty=true;pollStatus();}});
window.addEventListener('pagehide',()=>{for(const url of imageUrls)if(url)URL.revokeObjectURL(url);});
window.workliveStudy={lastBenchmark:null,get metrics(){return {...lastMetrics,people:population,livePages:live?2:0,drawCalls:renderCounts.drawCalls,triangles:renderCounts.triangles,canvas:[canvas.width,canvas.height],renderGroups:groups.size,paused,hidden:document.hidden};},get monitorPositions(){return Array.from({length:population},(_,i)=>({agent:i,...screenPoint(i)}));}};
selectAgent(0);animate(0);app.start();$('loading').remove();
