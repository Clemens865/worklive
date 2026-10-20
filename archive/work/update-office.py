from pathlib import Path
p=Path('src/office.ts');s=p.read_text()
s=s.replace('import type { Agent, BrowserState } from "./types";', 'import type { Agent, BrowserState } from "./types";\nimport { OfficeLife, DESKS, TABLE, type Resident, type Moment } from "./office-life";')
s=s.replace('  status: string;','  status: string;\n  resident: Resident;\n  bubble: HTMLDivElement;\n  mug: T.Group;\n  wateringCan: T.Group;\n  steam: T.Mesh[];\n  shownLabel: string;')
s=s.replace('  onOpen: (id: string) => void,','  onOpen: (id: string) => void,\n  onMoment: (moment: Moment) => void,')
s=s.replace('  const scene = new T.Scene(),','  const life = new OfficeLife(onMoment);\n  const scene = new T.Scene(),')
start=s.index('  box(3, 0.035, 1.6, m.rug,')
end=s.index('  function create(agent:',start)
s=s[:start]+'''  // The table is a shared destination; every visitor gets a reserved place.
  box(3.75, .028, 3.65, m.rug, TABLE.x, .008, TABLE.z);
  cylinder(TABLE.radius, TABLE.radius, .13, m.wood, 0, .94, TABLE.z);
  cylinder(.13, .23, .88, m.leg, 0, .44, TABLE.z);
  cylinder(.46, .46, .045, m.dark, 0, .028, TABLE.z);
  cylinder(.21, .21, .028, '#c1c9ac', .15, 1.025, TABLE.z);
  for (let i=0;i<3;i++) {
    cylinder(.06,.06,.024,'#b68d58',.05+i*.1,1.05,TABLE.z);
  }
  cylinder(.08,.07,.16,m.white,-.36,1.08,TABLE.z-.18);
  const flower=ball(.065,'#dfbc79',-.36,1.38,TABLE.z-.18);
  flower.scale.set(1.6,.5,1.6);
  cylinder(.012,.012,.22,m.leaf,-.36,1.25,TABLE.z-.18);
  let width = 900, height = 600, angle = 35, zoom = 1, selected = '', last = performance.now(),
    paused = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const actors: Actor[] = [];
''' +s[end:]
s=s.replace('    const [x, z] = positions[actors.length];','    const {x,z} = DESKS[actors.length];\n    const resident = life.add(agent.id,agent.name);')
s=s.replace('    body.position.set(0, 0, 0.82);','    body.position.set(0, 0, 1.1);')
anchor='    const ring = mesh('
idx=s.index(anchor)
s=s[:idx]+'''    const mug=new T.Group();arms[1].add(mug);mug.position.set(0,-.32,.07);
    cylinder(.081,.066,.16,m.white,0,0,0,mug);
    cylinder(.064,.064,.008,'#78553a',0,.079,0,mug);
    const handle=mesh(new T.TorusGeometry(.05,.014,8,16),m.white,.092,0,0,mug);
    const steam:T.Mesh[]=[];
    for(let i=0;i<3;i++) {
      const puff=ball(.026,new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.42,depthWrite:false}),0,.15+i*.08,0,mug);
      puff.scale.set(.6,1.8,.6);steam.push(puff);
    }
    mug.visible=false;
    const wateringCan=new T.Group();arms[1].add(wateringCan);wateringCan.position.set(0,-.34,.1);
    cylinder(.12,.11,.2,'#87aaa0',0,0,0,wateringCan);
    const spout=cylinder(.025,.03,.25,'#87aaa0',0,.04,.18,wateringCan);spout.rotation.x=.95;
    wateringCan.visible=false;
''' +s[idx:]
s=s.replace('    labels.append(monitor);','    labels.append(monitor);\n    const bubble=document.createElement("div");bubble.className="speech-bubble";bubble.hidden=true;labels.append(bubble);')
s=s.replace('      status: "idle",','      status: "idle",\n      resident, bubble, mug, wateringCan, steam, shownLabel: "",')
start=s.index('    state.textContent =')
end=s.index('    a.label.append(',start)
s=s[:start]+'''    state.textContent = a.resident.phase==='working' && a.status!=='working'
      ? a.status==='paused'?'You have control':a.status==='error'?'Needs attention':a.status==='loading'?'Opening browser':'At the desk'
      : a.resident.label;
    a.shownLabel = a.resident.label;
''' +s[end:]
start=s.index('  function draw(ms: number) {')
end=s.index('\n  function animate(',start)
s=s[:start]+'''  function draw(ms: number) {
    const dt=Math.min(Math.max((ms-last)/1000,0),.25);last=ms;
    if (!container.clientWidth) return;
    if(!paused&&!document.hidden)life.update(dt);
    const t=life.time, occupied:{x:number;y:number}[]=[];
    for(let i=0;i<actors.length;i++) {
      const a=actors[i], r=a.resident, moving=r.moving,
        coffee=r.phase==='coffee', stretch=r.phase==='stretch', plant=r.phase==='plant',
        seated=r.phase==='desk'||r.phase==='working', working=seated&&a.status==='working';
      a.body.position.set(r.x-a.x,moving?Math.abs(Math.sin(t*8))*.03:0,r.z-a.z);
      if(!paused){const d=r.facing-a.body.rotation.y;a.body.rotation.y+=Math.atan2(Math.sin(d),Math.cos(d))*Math.min(dt*8,1);}
      a.head.rotation.y=Math.sin(t*1.2+i)*.08;
      for(let j=0;j<2;j++) {
        a.arms[j].rotation.z=stretch?(j===0?1:-1)*(1.5+Math.sin(t*1.3)*.45):0;
        a.arms[j].rotation.x=working?-1.1+Math.sin(t*9+j*2)*.07:
          moving?Math.sin(t*8+j*Math.PI)*.38:
          coffee&&j===1?-1.15-Math.max(0,Math.sin(t*1.4+i))*.95:
          plant&&j===1?-1.15:coffee&&r.bubble&&j===0?-.65+Math.sin(t*4)*.18:0;
        a.legs[j].rotation.x=moving?Math.sin(t*8+j*Math.PI)*.36:seated?-.75:0;
      }
      a.mug.visible=coffee;a.wateringCan.visible=plant;
      a.mug.rotation.x=-a.arms[1].rotation.x*.8;
      for(let j=0;j<a.steam.length;j++){
        const puff=a.steam[j];puff.position.y=.14+((t*.09+j*.09)%.26);puff.position.x=Math.sin(t*2+j)*.015;
      }
      a.ring.position.set(r.x-a.x,.012,r.z-a.z);
      if(a.shownLabel!==r.label)updateLabel(a);
      const pos=new T.Vector3(r.x,.08,r.z+.46).project(camera);
      const lx=(pos.x+1)*width/2;let ly=(1-pos.y)*height/2;
      // Keep small name badges readable when perspective brings people together.
      for(const other of occupied)if(Math.abs(other.x-lx)<105&&Math.abs(other.y-ly)<42)ly=other.y+43;
      occupied.push({x:lx,y:ly});a.label.style.left=lx+'px';a.label.style.top=ly+'px';
      const bp=new T.Vector3(r.x,2.02,r.z).project(camera);
      a.bubble.hidden=!r.bubble;
      if(a.bubble.textContent!==r.bubble)a.bubble.textContent=r.bubble;
      a.bubble.style.left=Math.max(105,Math.min(width-105,(bp.x+1)*width/2))+'px';
      a.bubble.style.top=Math.max(60,(1-bp.y)*height/2)+'px';
      const mp=new T.Vector3(a.x,1.59,a.z-.177).project(camera);
      a.monitor.style.left=(mp.x+1)*width/2+'px';a.monitor.style.top=(1-mp.y)*height/2+'px';
    }
    renderer.render(scene,camera);
  }
''' +s[end:]
s=s.replace('          old.agent = a;','          old.agent = a;\n          old.resident.name = a.name;')
s=s.replace('        updateLabel(a);\n      }\n    },\n    frame(', '        life.setBusy(a.agent.id, !["idle","complete"].includes(a.status));\n        updateLabel(a);\n      }\n    },\n    frame(')
s=s.replace('    motion() {','    coffeeBreak() { return life.coffeeBreak(); },\n    isMoving() { return !paused; },\n    motion() {')
p.write_text(s)
