import * as T from 'three';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
export const world=new T.Group(),screens=[],lamps=[],pendants=[];
const mats=new Map();let seed=91;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
export function material(color,roughness=.8,metalness=0){const key=color+roughness+metalness;if(!mats.has(key))mats.set(key,new T.MeshStandardMaterial({color,roughness,metalness}));return mats.get(key);}
export function object(g,m,x=0,y=0,z=0,parent=world){const a=new T.Mesh(g,typeof m==='string'?material(m):m);a.position.set(x,y,z);a.castShadow=true;a.receiveShadow=true;parent.add(a);return a;}
export function box(w,h,d,m,x,y,z,r=.025,p=world){return object(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/2,h/2,d/2)),m,x,y,z,p);}
export function cyl(rt,rb,h,m,x,y,z,p=world,n=32){return object(new T.CylinderGeometry(rt,rb,h,n),m,x,y,z,p);}
export function ball(rx,ry,rz,m,x,y,z,p=world){const a=object(new T.SphereGeometry(1,18,12),m,x,y,z,p);a.scale.set(rx,ry,rz);return a;}
export function rod(a,b,r,m,p=world){const start=new T.Vector3(...a),end=new T.Vector3(...b),o=cyl(r,r,start.distanceTo(end),m,...start.clone().add(end).multiplyScalar(.5).toArray(),p,12);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.sub(start).normalize());return o;}
function canvasTexture(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;}
const grain=canvasTexture(256,1024,(c,w,h)=>{c.fillStyle='#ccb48a';c.fillRect(0,0,w,h);for(let i=0;i<2200;i++){const x=rand()*w;c.strokeStyle=`rgba(${rand()>.6?'255,244,214':'83,59,31'},${rand()*.09})`;c.lineWidth=rand()*1.7;c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+rand()*10,300,x-rand()*8,700,x+rand()*3,h);c.stroke();}});
const oak=new T.MeshStandardMaterial({map:grain,roughness:.78,color:'#e1cda9'}),walnut=material('#81694c'),cream=material('#e8e1cc'),sage=material('#8b9e7c'),metal=material('#343c32',.38,.6),gold=material('#ab925a',.35,.6),coral=material('#bf7357'),fabric=material('#dbb28e',.96);
const rugTex=canvasTexture(512,512,(c,w,h)=>{c.fillStyle='#caa57e';c.fillRect(0,0,w,h);for(let i=0;i<w;i+=3){c.fillStyle=i%2?'#ffffff13':'#4029100b';c.fillRect(i,0,1,h);c.fillRect(0,i,w,1);}for(let r=30;r<256;r+=15){c.strokeStyle='#f8e6bd22';c.lineWidth=2;c.beginPath();c.arc(256,256,r,0,Math.PI*2);c.stroke();}});
function rug(x,z,rx,rz,color='#d9b48d'){const m=new T.MeshStandardMaterial({map:rugTex,color,roughness:1});const o=cyl(1,1,.019,m,x,.055,z);o.scale.set(rx,1,rz);return o;}
function label(text,w,h,color='#3a523e',bg=null){return canvasTexture(w,h,(c)=>{if(bg){c.fillStyle=bg;c.fillRect(0,0,w,h);}c.fillStyle=color;c.font=`500 ${Math.floor(h*.5)}px Georgia`;c.textAlign='center';c.textBaseline='middle';c.fillText(text,w/2,h/2);});}
function panelText(text,w,h,x,y,z,color,p=world){const tex=label(text,1024,128,color);const m=new T.MeshStandardMaterial({map:tex,transparent:true,roughness:1,side:T.DoubleSide});return object(new T.PlaneGeometry(w,h),m,x,y,z,p);}
export function plant(x,z,size=1,p=world){
 const group=new T.Group();group.position.set(x,0,z);group.scale.setScalar(size);p.add(group);
 cyl(.29,.23,.47,material('#bd9671'),0,.27,0,group);cyl(.265,.265,.025,material('#4b4b31'),0,.505,0,group);
 for(let i=0;i<7;i++){
  const a=i*2.39,end=[Math.sin(a)*(.22+rand()*.21),.88+rand()*.9,Math.cos(a)*(.22+rand()*.2)];rod([0,.5,0],end,.018,'#66764c',group);
  const leaf=ball(.14,.31,.045,i%2?'#8caa6d':'#66824d',...end,group);leaf.rotation.set(Math.sin(a)*.55,a,Math.cos(a)*.6);
 }
 return group;
}
function vase(x,y,z,p=world){cyl(.073,.11,.23,'#c38c6c',x,y+.115,z,p);for(let i=0;i<4;i++){const a=i*2.2;rod([x,y+.21,z],[x+Math.sin(a)*.13,y+.55+rand()*.13,z+Math.cos(a)*.08],.007,'#697846',p);ball(.048,.022,.043,'#e7d3a0',x+Math.sin(a)*.13,y+.55+rand()*.05,z+Math.cos(a)*.08,p);}}
function archPath(cx,bottom,width,height){const r=width/2,top=bottom+height-r;const path=new T.Path();path.moveTo(cx-r,bottom);path.lineTo(cx+r,bottom);path.lineTo(cx+r,top);path.absarc(cx,top,r,0,Math.PI,false);path.lineTo(cx-r,bottom);return path;}
function windows(){
 const wall=new T.Shape();wall.moveTo(-6.7,0);wall.lineTo(6.7,0);wall.lineTo(6.7,4.5);wall.lineTo(-6.7,4.5);wall.lineTo(-6.7,0);
 const xs=[-4.95,-1.9,1.15];for(const x of xs)wall.holes.push(archPath(x,.92,2.4,3.05));
 object(new T.ExtrudeGeometry(wall,{depth:.2,bevelEnabled:false}),material('#e3deca'),0,0,-4.7);
 const sky=canvasTexture(128,512,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#c5d3c5');g.addColorStop(.55,'#e5d8b8');g.addColorStop(1,'#aabb92');c.fillStyle=g;c.fillRect(0,0,w,h);for(let i=0;i<30;i++){c.fillStyle=i%2?'#8d9d7540':'#c5c9aa70';c.beginPath();c.ellipse(rand()*w,h*.7+rand()*h*.3,10+rand()*60,15+rand()*90,rand(),0,7);c.fill();}});
 const glassMat=new T.MeshBasicMaterial({map:sky,color:'#fff2d2'});
 for(const x of xs){
  const shape=new T.Shape(archPath(0,.92,2.39,3.05).getPoints(32));const geo=new T.ShapeGeometry(shape),pos=geo.attributes.position,uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getX(i)+1.195)/2.39,(pos.getY(i)-.92)/3.05);object(geo,glassMat,x,0,-4.78).castShadow=false;
  for(const sx of [-1.2,1.2])box(.065,1.85,.13,'#ded9bf',x+sx,1.84,-4.44,.01);
  const curve=new T.EllipseCurve(x,2.77,1.2,1.2,0,Math.PI,false);const pts=curve.getPoints(48).map(v=>new T.Vector3(v.x,v.y,-4.44));object(new T.TubeGeometry(new T.CatmullRomCurve3(pts),48,.039,8,false),cream);
  box(.046,2.94,.12,'#dad6bf',x,2.39,-4.43,.008);box(2.4,.045,.12,'#dad6bf',x,2.35,-4.43,.008);box(2.63,.11,.40,cream,x,.94,-4.36,.025);
  // Sun stripes continue across the sill and floor.
 }
 box(13.4,.12,.15,cream,0,.11,-4.43);box(13.4,.10,.24,walnut,0,4.47,-4.49);
 // A low return wall makes the room read as a cut-away architectural model.
 box(.20,1.05,9.2,'#e1ddc9',-6.7,.52,-.15,.02);box(.24,.065,9.2,cream,-6.7,1.06,-.15,.025);
 for(let i=0;i<32;i++)box(.04,.93,.035,'#d4cdb5',-6.575,.5,-4.4+i*.275,.006);
 // One tall pier and open timber pergola, avoiding a ceiling over the camera.
 box(.23,4.4,.23,walnut,-6.7,2.2,4.26);box(.25,.22,9.4,walnut,-6.7,4.43,-.1);for(let z=-4.4;z<=4.3;z+=1.45)box(1.30,.12,.085,oak,-6.15,4.47,z,.006);
}
function shelf(){
 const x=4.77,z=-4.15;
 box(2.45,2.85,.55,'#748b67',x,1.53,z,.025);
 for(let y=.25;y<2.9;y+=.64)box(2.5,.045,.62,oak,x,y,z+.04,.006);
 for(const xx of [x-1.21,x,x+1.21])box(.045,2.75,.60,oak,xx,1.58,z,.005);
 const colors=['#d9b384','#476954','#bd755d','#ecdfc1','#9caa8b'];
 for(let level=0;level<4;level++)for(let side=0;side<2;side++){
  const start=x-1.10+side*1.24;
  for(let b=0;b<5;b++){const w=.09+rand()*.06,h=.30+rand()*.18;const book=box(w,h,.30,colors[(b+level+side)%5],start+b*.15,.29+level*.64+h/2,z+.16,.005);if(b===4)book.rotation.z=-.14;box(w*.65,.014,.006,'#f2dfb2',start+b*.15,.34+level*.64+h*.7,z+.314,.002);}
  if(level%2===0)vase(start+.94,.28+level*.64,z+.14);
 }
 box(2.5,.5,.63,'#6e8360',x,.3,z+.04,.02);for(const dx of [-.6,.6]){box(1.12,.38,.035,'#788d69',x+dx,.33,z+.37,.025);box(.15,.024,.025,gold,x+dx,.39,z+.40,.01);}
 panelText('make good things.',2.36,.30,4.77,3.48,-4.38,'#58714e');
}
function coffee(){
 const g=new T.Group();g.position.set(-4.6,0,-2.85);world.add(g);
 box(2.6,.85,.9,'#8a9e76',0,.44,0,.035,g);for(let x=-1.18;x<1.2;x+=.075)box(.031,.73,.025,'#80966c',x,.44,.466,.01,g);
 box(2.77,.10,1.04,cream,0,.925,0,.035,g);box(.9,.66,.52,'#404a3b',-.57,1.31,-.08,.055,g);box(.81,.08,.59,metal,-.57,1.03,-.01,.01,g);box(.68,.12,.05,metal,-.57,1.45,.2,.015,g);for(const dx of [-.74,-.40]){rod([dx,1.37,.23],[dx,1.25,.31],.023,metal,g);cyl(.05,.042,.10,'#f1e7d2',dx,1.10,.14,g);}
 box(.35,.25,.32,'#d5c3a0',.41,1.10,-.03,.04,g);vase(.94,.98,.0,g);
 for(let i=0;i<3;i++)cyl(.055,.05,.08,'#f2e7d1',.35+i*.13,1.3,-.01,g);
 panelText('COFFEE & GOOD IDEAS',2.5,.2,-4.6,1.78,-3.30,'#7b8969');
}
function lounge(){
 rug(-4.47,2.06,1.9,1.63,'#e5c7a3');
 const g=new T.Group();g.position.set(-5.34,0,1.73);g.rotation.y=Math.PI/2;world.add(g);
 for(const x of [-.95,.95])for(const z of [-.35,.35])cyl(.037,.024,.24,walnut,x,.17,z,g);
 box(2.25,.22,.95,fabric,0,.37,0,.14,g);box(2.18,.63,.25,fabric,0,.81,-.36,.12,g);box(.24,.42,1.0,fabric,-1.09,.64,0,.11,g);box(.24,.42,1.0,fabric,1.09,.64,0,.11,g);
 for(const x of [-.53,.53]){box(1.0,.19,.76,'#e0bc96',x,.56,.055,.095,g);const p=box(.4,.39,.16,x<0?'#788d69':'#e7d4b1',x,.86,-.17,.095,g);p.rotation.z=x<0?.13:-.11;}
 const table=cyl(.61,.62,.1,oak,-3.97,.47,2.1);table.scale.z=.82;for(let i=0;i<3;i++){const a=i*Math.PI*2/3;rod([-3.97+Math.cos(a)*.36,.1,2.1+Math.sin(a)*.28],[-3.97+Math.cos(a)*.25,.43,2.1+Math.sin(a)*.22],.045,walnut);}
 box(.32,.035,.42,'#788e76',-3.84,.545,2.11,.009).rotation.y=.17;box(.27,.018,.36,'#ded9ba',-3.89,.57,2.04,.007).rotation.y=-.15;
 vase(-4.20,.52,2.02);cyl(.075,.065,.10,'#e8dfc6',-3.85,.6,2.37);cyl(.063,.063,.004,'#4a392a',-3.85,.653,2.37);
 // A sculpted lounge chair.
 const c=new T.Group();c.position.set(-3.24,0,3.44);c.rotation.y=-.5;world.add(c);
 for(const x of [-.3,.3])for(const z of [-.28,.28])rod([x,.1,z],[x*.8,.49,z*.9],.025,walnut,c);
 box(.82,.2,.76,'#87997a',0,.52,0,.12,c);box(.86,.59,.21,'#87997a',0,.85,-.3,.1,c);for(const x of [-.42,.42])box(.12,.31,.8,walnut,x,.63,0,.035,c);
 // Brass floor lamp with warm pleated shade.
 cyl(.27,.29,.045,metal,-6.02,.09,3.82);rod([-6.02,.1,3.82],[-6.02,1.8,3.82],.022,gold);cyl(.24,.39,.40,'#eee3c2',-6.02,1.86,3.82);const bulb=ball(.13,.07,.13,new T.MeshStandardMaterial({color:'#fff4bc',emissive:'#ffd385',emissiveIntensity:.7}),-6.02,1.68,3.82);lamps.push(bulb.material);
 const light=new T.PointLight('#ffcc82',1.4,4,2);light.position.set(-6.02,1.63,3.82);world.add(light);pendants.push(light);
}
function cup(x,y,z,p){cyl(.042,.034,.08,'#ece5ce',x,y+.04,z,p,20);cyl(.034,.034,.003,'#4b3d29',x,y+.082,z,p,20);object(new T.TorusGeometry(.025,.009,6,16),cream,x+.044,y+.045,z,p);}
export function screenTexture(spec,t=0){return canvasTexture(768,464,(c,w,h)=>{
 c.fillStyle='#f8f7ed';c.fillRect(0,0,w,h);c.fillStyle='#e6eadf';c.fillRect(0,0,w,30);for(let i=0;i<3;i++){c.fillStyle=['#cd8d73','#d8c27f','#89a17e'][i];c.beginPath();c.arc(15+i*13,15,3.4,0,7);c.fill();}c.fillStyle='#97a18c';c.font='10px sans-serif';c.fillText('studio.worklive / '+spec.id,260,19);
 if(spec.type==='code'){
  c.fillStyle='#283d33';c.fillRect(0,30,w,h);c.fillStyle='#344d3e';c.fillRect(0,30,150,h);c.fillStyle='#8aa688';c.font='11px monospace';['atelier','  src','    office.ts','    agents.ts','    memory.ts','  notes.md'].forEach((s,i)=>c.fillText(s,16,65+i*24));c.font='14px monospace';const lines=['// A little space for big ideas','const studio = createOffice({','  atmosphere: "golden hour",','  people: yourTeam,','  focus: "something wonderful"','});','','await studio.bringIdeasToLife();','','✓  All checks passed'];lines.forEach((s,i)=>{c.fillStyle=i===0?'#829c78':i===9?'#b9ce92':['#e3dba9','#9fc4b1','#d6b488'][i%3];c.fillText(s,179,73+i*25);});
 }else{
  c.fillStyle='#416342';c.font='12px sans-serif';c.fillText('F I E L D N O T E S',45,66);c.fillStyle='#304b35';c.font='36px Georgia';c.fillText('A quieter kind',45,123);c.fillText('of progress.',45,165);
  c.fillStyle='#a8b994';c.fillRect(424,73,288,261);c.fillStyle='#e1d8b1';c.beginPath();c.arc(565,120,64,0,Math.PI*2);c.fill();for(let i=0;i<7;i++){c.fillStyle=i%2?'#6c895b':'#859d6f';c.beginPath();c.ellipse(431+i*44,260,21,80,i*.25,0,7);c.fill();}c.fillStyle='#78856d';for(let i=0;i<7;i++)c.fillRect(45,202+i*15,220+(i%3)*27,3);c.fillStyle='#bdc4ad';c.fillRect(45,335,325,1);c.fillStyle='#657958';c.font='12px sans-serif';c.fillText('Thoughtful places. Meaningful work.',45,363);
 }
 c.fillStyle=spec.provider==='codex'?'#2D9D8F':'#D97757';c.fillRect(0,h-5,w*(.4+.3*Math.sin(t*.1+1)),5);
});}
export function workstation(x,z,index){
 const g=new T.Group();g.position.set(x,0,z);world.add(g);
 rug(x,z+.62,1.11,1.05,'#d9d9b7');
 for(const side of [-1,1]){box(.10,.73,.67,oak,side*.91,.43,0,.027,g);box(.09,.055,.87,walnut,side*.91,.085,0,.013,g);}
 box(2.1,.12,.93,oak,0,.84,0,.052,g);box(1.87,.045,.73,cream,0,.755,0,.012,g);
 // Leather desk pad, keyboard and trackpad.
 box(.94,.016,.38,'#9aaa89',.03,.91,.17,.045,g);box(.62,.025,.21,'#dedfd2',-.03,.931,.21,.025,g);
 for(let row=0;row<4;row++)for(let col=0;col<12;col++)box(.037,.006,.035,'#f4f2e4',-.29+col*.047,.948,.14+row*.043,.005,g);
 box(.12,.018,.17,'#f0edde',.44,.93,.20,.03,g);
 box(.32,.025,.23,metal,0,.917,-.22,.06,g);box(.065,.26,.05,metal,0,1.055,-.26,.015,g);box(1.15,.71,.062,'#354136',0,1.47,-.28,.035,g);
 const screen=object(new T.PlaneGeometry(1.075,.632),new T.MeshBasicMaterial({color:'#ced8b9'}),0,1.476,-.243,g);screens.push({mesh:screen,group:g,index});screen.userData.desk=index;screen.castShadow=false;
 ball(.008,.008,.005,'#929c88',0,1.812,-.24,g);
 // Articulated task lamp.
 cyl(.12,.13,.035,metal,-.81,.928,-.19,g);rod([-.81,.95,-.19],[-.84,1.28,-.19],.018,metal,g);rod([-.84,1.28,-.19],[-.54,1.47,-.17],.019,metal,g);const shade=cyl(.06,.15,.14,'#d7c998',-.53,1.48,-.17,g);shade.rotation.z=-.28;
 const emitter=cyl(.13,.13,.012,new T.MeshStandardMaterial({color:'#fff0b1',emissive:'#ffd887',emissiveIntensity:.35}),-.51,1.416,-.17,g);lamps.push(emitter.material);
 cup(.76,.90,.20,g);box(.28,.025,.38,index%2?'#b87c5f':'#748868',-.78,.915,.21,.008,g);const pencil=rod([-.87,.936,.30],[-.69,.936,.07],.009,gold,g);
 // Upholstered task chair, including casters, lumbar cushion and an oak shell.
 const ch=new T.Group();ch.position.z=.95;g.add(ch);
 cyl(.032,.035,.34,metal,0,.29,0,ch);for(let i=0;i<5;i++){const a=i*2*Math.PI/5;rod([0,.17,0],[Math.sin(a)*.30,.10,Math.cos(a)*.3],.024,metal,ch);ball(.034,.038,.034,metal,Math.sin(a)*.30,.08,Math.cos(a)*.30,ch);}
 box(.58,.12,.57,'#99a286',0,.46,0,.13,ch);box(.6,.53,.11,oak,0,.78,.245,.09,ch);box(.54,.46,.095,'#939f82',0,.80,.18,.075,ch);
 for(const side of [-1,1]){rod([side*.25,.4,.11],[side*.30,.68,.07],.019,metal,ch);box(.085,.055,.36,oak,side*.30,.7,-.02,.032,ch);}
 return {group:g,screen,seat:new T.Vector3(x,0,z+.89)};
}
function overhead(){
 for(const x of [-1.5,2]){
  rod([x,4.4,-.60],[x,3.4,-.60],.008,metal);
  const shade=cyl(.43,.69,.35,'#e6d9ba',x,3.30,-.60);for(let i=0;i<28;i++){const a=i*Math.PI*2/28;rod([x+Math.sin(a)*.43,3.48,-.60+Math.cos(a)*.43],[x+Math.sin(a)*.68,3.13,-.60+Math.cos(a)*.68],.006,'#d2c097');}
  const m=new T.MeshStandardMaterial({color:'#fff0be',emissive:'#ffd78b',emissiveIntensity:.5});cyl(.61,.61,.008,m,x,3.12,-.60);lamps.push(m);
  const l=new T.PointLight('#ffdf9d',1,4,2);l.position.set(x,3.02,-.60);world.add(l);pendants.push(l);
 }
}
export function createWorld(){
 box(14.0,.32,10.0,'#dbd4be',0,-.16,-.1,.15);box(13.55,.09,9.54,'#b2a68b',0,.002,-.1,.035);
 // Staggered planks, with physically shaded joints and fine wood grain.
 const geo=new T.BoxGeometry(.245,.038,1.58);const count=54*6;const floor=new T.InstancedMesh(geo,oak,count);let n=0;const dummy=new T.Object3D();for(let col=0;col<54;col++)for(let row=0;row<6;row++){
  dummy.position.set(-6.49+col*.245,.036,-4.05+row*1.58);dummy.updateMatrix();floor.setMatrixAt(n,dummy.matrix);floor.setColorAt(n,new T.Color().setHSL(.105+rand()*.014,.23+rand()*.10,.65+rand()*.12));n++;
 }floor.receiveShadow=true;world.add(floor);
 windows();shelf();coffee();lounge();
 plant(-6.01,-.60,1.2);plant(6.04,-3.8,1.08);plant(5.92,3.62,1.05);plant(-5.82,4.02,.58);
 const desks=[workstation(-1.8,-2.35,0),workstation(1.25,-2.35,1),workstation(-1.8,.65,2),workstation(1.25,.65,3)];
 // Pinboard, books and sketches in a low studio cabinet.
 box(1.23,.77,2.25,'#8e9c79',5.8,.43,.6,.04);box(1.36,.1,2.36,cream,5.8,.85,.6,.055);
 for(let i=0;i<4;i++){box(.95,.04,.55,['#d8bc8e','#748671','#c58463','#e4dbbb'][i],5.8,.94+i*.055,.14,.012).rotation.y=i*.11;}
 vase(5.8,.91,1.33);plant(5.9,-1.28,.5);
 const board=new T.Group();board.position.set(5.82,0,-1.6);board.rotation.y=-Math.PI/2;world.add(board);
 box(1.17,1.5,.06,walnut,0,1.35,0,.025,board);box(1.08,1.40,.025,'#d3b893',0,1.35,.045,.01,board);
 for(let i=0;i<5;i++){const x=-.3+(i%2)*.46,y=.96+Math.floor(i/2)*.38;const page=box(.32,.32,.01,['#faf0cf','#bfc7a2','#edd1b0'][i%3],x,y,.067,.002,board);page.rotation.z=(i%2-.5)*.18;ball(.013,.013,.01,'#8f6947',x,y+.12,.083,board);}
 rod([-.4,.06,0],[-.4,2.13,0],.028,walnut,board);rod([.4,.06,0],[.4,2.13,0],.028,walnut,board);
 overhead();
 // Small entrance steps and subtly engraved studio name.
 box(2.7,.12,.45,'#d9d0b7',3.3,-.12,4.94,.04);box(2.3,.08,.38,'#e7ddc6',3.3,-.24,5.31,.035);
 const text=panelText('W O R K L I V E',2.6,.18,0,-.135,4.906,'#8e937a');
 return {world,desks};
}
