export const PROVIDERS={codex:'#2D9D8F',claude:'#D97757'};
export const DESKS=Array.from({length:20},(_,i)=>({x:-9+(i%5)*3.2,z:-6+Math.floor(i/5)*3.8}));
export const NAMES=['Ada','Milo','June','Atlas','Nora','Finn','Sage','Leo','Iris','Remy','Kit','Luna','Otto','Cleo','Arlo','Nova','Jules','Theo','Wren','Beau'];
export const ROLES=['Research & strategy','Design & storytelling','Engineering','Quality & review','Planning'];
export const OBSTACLES=[...DESKS.map(d=>({x:d.x,z:d.z,hx:1.16,hz:.55})),{x:9,z:-6.5,hx:2.5,hz:.65},{x:10,z:.2,hx:1.35,hz:1.05},{x:9.4,z:6.2,hx:1.4,hz:1.1}];
export const RADIUS=.44;
const minX=-11,minZ=-8.5,step=.4,nx=64,nz=46;
export function walkable(x,z,margin=0){return x>=-11&&x<=14&&z>=-8.5&&z<=9.4&&!OBSTACLES.some(o=>Math.abs(x-o.x)<o.hx+RADIUS+margin&&Math.abs(z-o.z)<o.hz+RADIUS+margin);}
function cell(x,z){return [Math.round((x-minX)/step),Math.round((z-minZ)/step)];}
function point(x,z){return {x:minX+x*step,z:minZ+z*step};}
export function route(from,to,avoid=[]){
 const [sx,sz]=cell(from.x,from.z),[ex,ez]=cell(to.x,to.z),key=(x,z)=>z*nx+x;
 const open=[{x:sx,z:sz,g:0,f:0}],parent=new Map(),cost=new Map([[key(sx,sz),0]]);let found=false;
 while(open.length){open.sort((a,b)=>b.f-a.f);const a=open.pop();if(a.x===ex&&a.z===ez){found=true;break;}
  for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=a.x+dx,z=a.z+dz,p=point(x,z),k=key(x,z),g=a.g+1;
   if(x<0||z<0||x>=nx||z>=nz||!walkable(p.x,p.z,.08)||avoid.some(b=>Math.hypot(p.x-b.x,p.z-b.z)<RADIUS*2+.12)||g>=(cost.get(k)??Infinity))continue;
   cost.set(k,g);parent.set(k,key(a.x,a.z));open.push({x,z,g,f:g+Math.abs(x-ex)+Math.abs(z-ez)});
  }
 }
 if(!found)return[];
 const path=[];let k=key(ex,ez);while(k!==key(sx,sz)){path.push(point(k%nx,Math.floor(k/nx)));k=parent.get(k);if(k===undefined)return[];}
 path.reverse();if(walkable(to.x,to.z))path.push({...to});return path;
}
export function createPeople(){return DESKS.map((d,i)=>({id:i,name:NAMES[i],provider:i%2?'claude':'codex',role:ROLES[i%ROLES.length],x:d.x,z:d.z+1.25,yaw:180,path:[],wait:5+i*1.7,destination:'desk',state:'At the desk',distance:0,breaks:0}));}
const breakSpots=[{x:7.2,z:-4.5},{x:9,z:-4.5},{x:7.5,z:2.7},{x:10.2,z:2.7},{x:7.3,z:7.9},{x:10.9,z:7.9}];
export function advancePeople(people,dt,time){
 let moving=people.filter(a=>a.path.length).length;
 for(const a of [...people].sort((a,b)=>a.breaks-b.breaks||a.wait-b.wait)){
  if(a.id<2){a.state='At the desk';continue;}
  if(!a.path.length){a.wait-=dt;if(a.wait>0)continue;
   if(a.destination==='desk'){
    if(moving>=4)continue;
    const spot=breakSpots.find((p,i)=>!people.some(b=>b!==a&&b.spot===i));if(!spot)continue;
    a.spot=breakSpots.indexOf(spot);a.goal=spot;a.path=route(a,spot,people.filter(b=>b!==a));a.destination='coffee';
   }else{const d=DESKS[a.id];a.goal={x:d.x,z:d.z+1.25};a.path=route(a,a.goal,people.filter(b=>b!==a));a.destination='desk';}
   if(!a.path.length){a.wait=5;if(a.destination==='coffee'){a.destination='desk';a.spot=null;}else a.destination='coffee';continue;}if(a.destination==='coffee')a.breaks++;moving++;
  }
  const target=a.path[0],dx=target.x-a.x,dz=target.z-a.z,dist=Math.hypot(dx,dz),speed=Math.min(dist,dt*.82);
  const x=a.x+dx/Math.max(dist,.0001)*speed,z=a.z+dz/Math.max(dist,.0001)*speed;
  if(!walkable(x,z)||people.some(b=>b!==a&&Math.hypot(x-b.x,z-b.z)<RADIUS*2+.02)){a.state='Waiting to pass';a.blocked=(a.blocked||0)+dt;if(a.blocked>1.2+a.id*.03){const detour=route(a,a.goal,people.filter(b=>b!==a));if(detour.length)a.path=detour;a.blocked=0;}continue;}a.blocked=0;
  a.x=x;a.z=z;a.distance+=speed;a.yaw=Math.atan2(dx,dz)*180/Math.PI;a.state=a.destination==='coffee'?'Walking to a break':'Returning to desk';
  if(dist<=speed+.000001)a.path.shift();
  if(!a.path.length){a.wait=a.destination==='desk'?15+a.id*.9:9+a.id*.4;if(a.destination==='desk'){a.spot=null;a.yaw=180;a.state='At the desk';}else{a.yaw=-60;a.state='Coffee break';}}
 }
}
export function frameSummary(samples){if(!samples.length)return null;const sorted=[...samples].sort((a,b)=>a-b),mean=samples.reduce((a,b)=>a+b,0)/samples.length;return {frames:samples.length,fps:1000/mean,p95:sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))],over50:samples.filter(x=>x>50).length};}
