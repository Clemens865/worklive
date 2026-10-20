from pathlib import Path
p=Path('/Users/clemenshoenig/.codex/visualizations/2026/09/30/01a0f131-643e-7e50-bcc2-d5aeaa797ffa/agent-studio-browsers.html')
s=p.read_text()
old="box(.81,.54,.065,mats.dark,0,1.46,-.22,g);box(.71,.43,.012,mats.screen,0,1.47,-.179,g);for(let i=0;i<4;i++)box(.35-(i%2)*.1,.018,.016,'#c7ddd1',-.08,1.58-i*.071,-.17,g);"
new="const bezel=box(1.06,.69,.075,mats.dark,0,1.52,-.22,g);bezel.userData.agentScreen=a.id;const pc=computer(a);const display=mesh(new THREE.PlaneGeometry(.96,.6),new THREE.MeshBasicMaterial({map:pc.texture,toneMapped:false}),0,1.52,-.177,g);display.userData.agentScreen=a.id;paintComputer(a,clockTime);"
assert old in s
s=s.replace(old,new)
old="function sync(){const a=agents.find(x=>x.id===selected);"
new="function sync(){const a=agents.find(x=>x.id===selected);root.querySelector('[data-screen-button]').textContent='Open '+(a.name||'agent')+'’s screen';"
assert old in s
s=s.replace(old,new)
old="if(!hits.length)return;let ob=hits[0].object;"
new="if(!hits.length)return;if(hits[0].object.userData.agentScreen){openComputer(hits[0].object.userData.agentScreen);return;}let ob=hits[0].object;"
assert old in s
s=s.replace(old,new)
old="renderer.render(scene,camera);}"
new="""for(const a of agents){const pc=computer(a);if(prefs.motion&&!document.hidden&&a.state==='working'&&!pc.takeover&&pc.surface==='browser'&&pc.step<2){pc.elapsed+=dt;if(pc.elapsed>14)nextDemo(a);}}
if(t-lastScreenPaint>1/6||lastScreenPaint<0){for(const a of agents)paintComputer(a,t);lastScreenPaint=t;}
if(focusedAgent===null)renderer.render(scene,camera);}"""
assert old in s
s=s.replace(old,new)
anchor="rebuild();styleScene();root.querySelector('.os-loading').hidden=true;requestAnimationFrame(animate);"
add="""root.querySelector('[data-action="screen"]').addEventListener('click',()=>openComputer(selected));
root.querySelector('[data-action="office"]').addEventListener('click',closeComputer);
root.querySelector('[data-action="takeover"]').addEventListener('click',()=>{const a=agents.find(a=>a.id===focusedAgent);if(!a)return;const pc=computer(a);pc.takeover=!pc.takeover;focusUI();});
root.querySelector('[data-action="next-demo"]').addEventListener('click',()=>{const a=agents.find(a=>a.id===focusedAgent);if(a)nextDemo(a);});
root.querySelectorAll('[data-surface]').forEach(b=>b.addEventListener('click',()=>{const a=agents.find(a=>a.id===focusedAgent);if(!a)return;computer(a).surface=b.dataset.surface;computer(a).elapsed=0;focusUI();}));
root.addEventListener('keydown',e=>{if(e.key==='Escape'&&focusedAgent!==null)closeComputer();});
"""
assert anchor in s
s=s.replace(anchor,add+anchor)
p.write_text(s)
script=s.split('<script type="module">',1)[1].split('</script>',1)[0]
Path('work/office-screens-check.mjs').write_text(script)
print(f'Screen prototype updated: {len(s.encode())} bytes')
