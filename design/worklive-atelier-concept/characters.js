import * as T from 'three';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
export const COLORS={codex:'#2D9D8F',claude:'#D97757'};
const mat=(color,roughness=.75)=>new T.MeshStandardMaterial({color,roughness});
function mesh(g,m,p,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;}
function ball(p,m,x,y,z,rx,ry=rx,rz=rx){const o=mesh(new T.SphereGeometry(1,24,16),m,p,x,y,z);o.scale.set(rx,ry,rz);return o;}
function box(p,m,x,y,z,w,h,d,r=.03){return mesh(new RoundedBoxGeometry(w,h,d,3,Math.min(r,w/2,h/2,d/2)),m,p,x,y,z);}
function capsule(p,m,r,length,x,y,z){return mesh(new T.CapsuleGeometry(r,length,5,12),m,p,x,y,z);}
export function character(spec,index=0){
 const root=new T.Group(),body=new T.Group();root.add(body);body.position.y=.8;
 const skin=mat(spec.skin||['#ddb18e','#b78160','#7b4c38','#edc3a3'][index%4],.58),hair=mat(spec.hair||['#382b28','#714d31','#241f1c','#a87442'][index%4]);
 const shirt=mat(COLORS[spec.provider],.86),trousers=mat(['#464c46','#354b4b','#777762','#3e4544'][index%4]),shoe=mat('#f0e9d9'),sole=mat('#d5d1bf'),dark=mat('#29342f'),white=mat('#f5f3e7');
 const jacket=box(body,shirt,0,.3,0,.45,.5,.29,.12);jacket.rotation.z=.02;
 box(body,trousers,0,.01,0,.36,.16,.27,.055);
 // Ribbed hem and a small stitched pocket, matching the provider shirt.
 box(body,shirt,0,.10,.154,.39,.035,.018,.01);box(body,shirt,.12,.36,.154,.095,.11,.018,.013);
 capsule(body,skin,.072,.085,0,.58,0);
 const head=new T.Group();head.position.set(0,.79,.015);body.add(head);
 ball(head,skin,0,0,0,.225,.265,.205);ball(head,skin,-.218,-.017,0,.052,.073,.042);ball(head,skin,.218,-.017,0,.052,.073,.042);
 ball(head,skin,0,-.022,.207,.045,.055,.06);
 const eyes=[];
 for(const side of [-1,1]){
  const eye=new T.Group();eye.position.set(side*.085,.04,.174);eye.rotation.y=side*.12;head.add(eye);
  ball(eye,white,0,0,0,.044,.054,.027);ball(eye,dark,side*.004,-.001,.024,.023,.034,.010);ball(eye,white,-.008,.014,.032,.008,.009,.003);eyes.push(eye);
  const brow=box(head,hair,side*.087,.121,.175,.088,.022,.019,.009);brow.rotation.z=-side*.09;
 }
 // Small sculpted smile.
 const smileCurve=new T.QuadraticBezierCurve3(new T.Vector3(-.055,-.118,.185),new T.Vector3(0,-.145,.21),new T.Vector3(.055,-.118,.185));
 mesh(new T.TubeGeometry(smileCurve,12,.006,6,false),mat('#9b6753'),head);
 const cap=mesh(new T.SphereGeometry(.232,28,18,0,Math.PI*2,0,Math.PI*.52),hair,head,0,.035,-.025);cap.scale.set(1,1.12,1);cap.rotation.x=-.19;
 if(index%4===0){
  // Ada: asymmetrical bob, swept fringe and fine round glasses.
  for(const s of [-1,1])ball(head,hair,s*.187,-.026,-.092,.072,.215,.133);
  const fringe=ball(head,hair,-.08,.19,.097,.168,.075,.10);fringe.rotation.z=.24;
  const glasses=mat('#625044',.4);
  for(const s of [-1,1]){const rim=mesh(new T.TorusGeometry(.063,.008,7,28),glasses,head,s*.086,.045,.219);rim.scale.y=.88;}
  box(head,glasses,0,.043,.222,.047,.01,.012,.004);
 } else if(index%4===1){
  // Milo: soft, uneven curls with one lifted lock.
  for(let i=0;i<11;i++){const a=i*2.4;ball(head,hair,Math.cos(a)*(.13+(i%2)*.045),.19+Math.sin(i*4)*.042,Math.sin(a)*.145,.083,.072,.08);}
  ball(head,hair,-.13,.28,.035,.082,.065,.10);
 }else if(index%4===2){
  for(let i=0;i<19;i++){const a=i*2.399;const r=.21*Math.sqrt(i/19);ball(head,hair,Math.cos(a)*r,.12+.17*Math.sqrt(1-r*r/.05),Math.sin(a)*r,.063,.065,.06);}
 }else{
  ball(head,hair,0,.17,-.23,.108,.12,.115);ball(head,hair,.125,.14,.09,.12,.082,.112);
 }
 const arms=[],legs=[];
 for(const side of [-1,1]){
  const shoulder=new T.Group();shoulder.position.set(side*.267,.46,0);body.add(shoulder);
  capsule(shoulder,shirt,.082,.135,0,-.075,0);
  const elbow=new T.Group();elbow.position.set(0,-.2,0);shoulder.add(elbow);capsule(elbow,skin,.057,.16,0,-.10,0);const hand=ball(elbow,skin,0,-.24,.013,.064,.07,.05);arms.push({shoulder,elbow,hand});
  const hip=new T.Group();hip.position.set(side*.105,-.05,0);body.add(hip);capsule(hip,trousers,.078,.24,0,-.16,0);
  const knee=new T.Group();knee.position.y=-.31;hip.add(knee);capsule(knee,trousers,.063,.25,0,-.15,0);
  box(knee,shoe,0,-.332,.066,.15,.09,.28,.035);box(knee,sole,0,-.365,.066,.155,.025,.285,.013);
  for(let k=0;k<3;k++)box(knee,white,0,-.287,.058+k*.036,.09,.008,.012,.003);
  legs.push({hip,knee});
 }
 const cup=new T.Group();arms[1].elbow.add(cup);cup.position.set(.015,-.225,.07);mesh(new T.CylinderGeometry(.042,.033,.08,18),mat('#eee7d7'),cup,0,.01,0);mesh(new T.CylinderGeometry(.035,.035,.002,18),mat('#453529'),cup,0,.052,0);const handle=mesh(new T.TorusGeometry(.026,.008,8,16),mat('#eee7d7'),cup,.044,.017,0);handle.scale.x=.8;cup.visible=false;
 root.traverse(o=>{if(o.isMesh)o.userData.agent=spec.id;});
 return {root,body,head,eyes,arms,legs,update(t,pose='typing'){
  const sit=pose==='typing';body.position.y=sit?.48:.80;
  body.rotation.z=Math.sin(t*.75+index)*.016;head.rotation.y=Math.sin(t*.55+index*2)*.11;head.rotation.x=sit?.1:Math.sin(t*.65+index)*.035;
  const blink=Math.sin(t*.54+index*1.8)>.998?.12:1;eyes.forEach(e=>e.scale.y=blink);
  cup.visible=pose==='coffee';
  for(let i=0;i<2;i++){
   const sign=i?1:-1,a=arms[i],l=legs[i];
   l.hip.rotation.x=sit?-Math.PI/2:pose==='walk'?Math.sin(t*5+i*Math.PI)*.45:0;
   l.knee.rotation.x=sit?Math.PI/2:pose==='walk'?Math.max(0,Math.cos(t*5+i*Math.PI))*.45:0;
   a.shoulder.rotation.set(sit?-.72:pose==='walk'?Math.sin(t*5+i*Math.PI+Math.PI)*.27:0,0,sign*.08);
   a.elbow.rotation.set(sit?-.8+Math.sin(t*8+i*2)*.055:-.12,0,sit?sign*-.18:0);
   if(pose==='coffee'&&i===1){a.shoulder.rotation.x=-.4;a.elbow.rotation.x=-1.45-Math.max(0,Math.sin(t*.65))*.36;}
  }
 }};
}
export function avatar(spec,index){
 const r=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});r.setSize(120,136);r.setPixelRatio(1);r.setClearColor('#e4e6d5',1);r.outputColorSpace=T.SRGBColorSpace;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.25;
 const scene=new T.Scene();scene.add(new T.HemisphereLight('#fff7e2','#84917b',2.5));const sun=new T.DirectionalLight('#fff6dc',3);sun.position.set(-2,4,4);scene.add(sun);
 const c=character(spec,index);scene.add(c.root);c.root.rotation.y=-.17;c.update(0,'standing');
 const camera=new T.PerspectiveCamera(30,120/136,.1,10);camera.position.set(.05,1.54,1.9);camera.lookAt(0,1.43,0);r.render(scene,camera);const url=r.domElement.toDataURL();scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});r.dispose();r.forceContextLoss();return url;
}
