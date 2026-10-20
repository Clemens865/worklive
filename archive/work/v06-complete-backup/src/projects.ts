import { invoke } from '@tauri-apps/api/core';
import { PROVIDERS, isRunning, type Agent, type RunState, type WorkflowState, type ProjectTask } from './types';
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id)! as T;
const node=(tag:string,text:string,cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};

export function createProjects(options:{agents:()=>Agent[];runs:()=>RunState[];command:(action:string,extra?:Record<string,unknown>)=>Promise<any>;reload:()=>Promise<void>;apply:(state:WorkflowState)=>void;error:(e:unknown)=>void;openWork:(id:string,runId?:string)=>Promise<void>;openContext:(id:string)=>Promise<void>}){
 let state:WorkflowState={reviews:[],handoffs:[],projects:[],tasks:[],assignments:{},acceptedMilestones:0,busy:false};
 let projectId='',pending=false,editing:ProjectTask|null=null,projectRevision=0,editingProject='';
 const safe=(fn:()=>Promise<unknown>)=>void fn().catch(options.error);
 const active=()=>state.busy||options.runs().some(isRunning);
 const locked=()=>pending||active();
 const owner=(id:string)=>options.agents().find(a=>a.id===id);
 const name=(id:string)=>owner(id)?.name||'Former agent';
 document.body.insertAdjacentHTML('beforeend',`<dialog id="projects-dialog" aria-labelledby="projects-heading">
  <div class="dialog-heading"><div><span class="eyebrow">A SHARED PLAN. A LITTLE MOMENTUM.</span><h2 id="projects-heading">Projects</h2></div><button id="projects-close" class="icon-button" aria-label="Close projects">×</button></div>
  <div class="project-toolbar"><label>Working project<select id="board-project" aria-label="Choose project"></select></label><button id="project-new" class="secondary">New project</button><button id="project-edit" class="quiet">Edit brief</button><button id="project-team-toggle" class="quiet" aria-expanded="false">Manage team</button><button id="project-context" class="secondary">Shared context & files</button></div>
  <form id="project-brief-form" class="project-form" hidden><fieldset><h3 id="project-form-title">A new project</h3><label>Project name<input id="project-name" maxlength="120" required></label><label>Goal & definition of done<textarea id="project-goal" rows="3" maxlength="8000" placeholder="What are we making, who is it for, and what does a useful result look like?"></textarea></label><p class="fine-print">This brief is included in every project agent’s next run, with its version and timestamp.</p><div class="button-row"><button class="primary">Save project</button><button id="project-brief-cancel" type="button" class="secondary">Cancel</button></div></fieldset></form>
  <div id="project-summary" class="project-summary"></div><div id="project-team" class="project-team" hidden></div>
  <p id="project-busy" class="context-notice" hidden>Work is running. You can inspect the board; pause tasks before editing the shared plan.</p>
  <div class="project-board-heading"><div><h3>Your team’s next steps</h3><p id="project-progress" class="fine-print"></p></div><button id="project-task-new" class="primary">+ Add task</button></div>
  <form id="project-task-form" class="project-form" hidden><fieldset><h3 id="task-form-title">A clear next step</h3><label>Task title<input id="project-task-title" maxlength="160" required></label><label>Brief & expected deliverable<textarea id="project-task-brief" maxlength="4000" rows="3" placeholder="Describe the work and the file the agent should save." required></textarea></label><div class="handoff-fields"><label>Owner<select id="project-task-owner" required></select></label><label>Start after<select id="project-task-dependency"></select></label></div><p class="fine-print">Prerequisites must be accepted by you. This controls the order of work; to share a result file, use a reviewed handoff. Tasks never start automatically.</p><div class="button-row"><button class="primary">Save task</button><button id="project-task-cancel" type="button" class="secondary">Cancel</button></div></fieldset></form>
  <div id="project-board" class="project-board" aria-label="Project task board"></div>
  <p class="fine-print project-board-foot">Starts use the owner’s selected Codex or Claude Code subscription. One active task per provider. Completion moves work into review; only your acceptance completes it.</p>
 </dialog>`);
 const dialog=el<HTMLDialogElement>('projects-dialog');
 function button(parent:HTMLElement,label:string,action:()=>Promise<unknown>,disabled=false,cls='secondary'){
  const b=node('button',label,cls) as HTMLButtonElement;b.disabled=disabled||pending;b.onclick=()=>safe(action);parent.append(b);return b;
 }
 function apply(next:WorkflowState){state=next;if(!state.projects.some(p=>p.id===projectId))projectId=state.projects[0]?.id||'';if(dialog.open)render();}
 function render(){
  const p=state.projects.find(p=>p.id===projectId),tasks=state.tasks.filter(t=>t.projectId===projectId);
  const select=el<HTMLSelectElement>('board-project');select.replaceChildren();if(!state.projects.length)select.add(new Option('Create your first project',''));for(const p of state.projects)select.add(new Option(p.name,p.id));select.value=projectId;select.disabled=pending;
  for(const id of ['project-new','project-edit','project-team-toggle','project-task-new'])el<HTMLButtonElement>(id).disabled=locked()||(!p&&id!=='project-new');
  dialog.querySelectorAll<HTMLFieldSetElement>('fieldset').forEach(f=>f.disabled=locked());
  el('project-busy').hidden=!active();
  const members=options.agents().filter(a=>state.assignments[a.id]===projectId&&projectId);
  el<HTMLButtonElement>('project-context').disabled=pending||!members.length;
  const summary=el('project-summary');summary.replaceChildren();summary.append(node('h3',p?.name||'Give your team a shared direction.'));
  summary.append(node('p',p?.goal|| (p?'Add a goal, assign teammates, and break the work into clear deliverables.':'Create a project to collect a goal, shared references, and a plan of work.'),'project-goal-text'));
  const team=node('div','','project-members');for(const a of members){const badge=node('span',`${a.name} · ${PROVIDERS[a.provider].name}`,'project-member');badge.style.setProperty('--provider',PROVIDERS[a.provider].color);team.append(badge);}if(p&&!members.length)team.append(node('span','No teammates yet. Open Manage team to add someone.','fine-print'));summary.append(team);
  if(p?.revision)summary.append(node('small',`Brief v${p.revision} · ${new Date(p.updatedAt).toLocaleString()}`,'fine-print'));
  const manage=el('project-team');manage.replaceChildren(node('p','Each agent belongs to one working project. Moving an agent changes the context available to its next run.','fine-print'));
  for(const a of options.agents()){
   const row=node('div','','project-team-row'),assigned=state.assignments[a.id],here=assigned===projectId;
   row.append(node('span',`${a.name} · ${here?'On this team':state.projects.find(p=>p.id===assigned)?.name||'No project'}`));
   button(row,here?'Remove from team':'Add to team',async()=>{
    pending=true;render();try{await invoke('knowledge_command',{command:{action:'assignProject',agentId:a.id,projectId:here?'':projectId}});await options.reload();}finally{pending=false;render();}
   },locked()||!p);manage.append(row);
  }
  const accepted=tasks.filter(t=>t.status==='accepted').length;
  el('project-progress').textContent=tasks.length?`${accepted} of ${tasks.length} accepted · ${tasks.filter(t=>t.status==='review').length} waiting for review`:'Small, specific tasks make good starting points.';
  const board=el('project-board');board.replaceChildren();
  const columns=[['planned','Planned'],['working','Working'],['attention','Needs input'],['review','Review'],['accepted','Accepted']] as const;
  for(const [status,label]of columns){
   const column=node('section','',`project-column column-${status}`);column.setAttribute('aria-label',label);
   const items=tasks.filter(t=>t.status===status),heading=node('h4',label);heading.append(node('span',String(items.length)));column.append(heading);
   if(!items.length)column.append(node('p',status==='planned'?'Room for a next step.':status==='review'?'Finished work arrives here.':'—','project-column-empty'));
   for(const t of items){
    const a=owner(t.agentId),card=node('article','','project-task-card');card.setAttribute('aria-label',t.title);card.append(node('h5',t.title));
    const badge=node('p',`${name(t.agentId)} · ${PROVIDERS[t.status==='working'&&t.provider?t.provider:a?.provider||'codex'].name}`,'project-task-owner');badge.style.setProperty('--provider',PROVIDERS[t.status==='working'&&t.provider?t.provider:a?.provider||'codex'].color);card.append(badge);
    const detail=node('details','');detail.append(node('summary','Task brief'),node('p',t.brief,'project-task-brief'));card.append(detail);
    if(t.dependsOn)card.append(node('p',`After: ${state.tasks.find(d=>d.id===t.dependsOn)?.title||'Unavailable task'}`,'project-dependency'));
    if(t.blocked&&['planned','attention'].includes(status))card.append(node('p',t.blocked,'project-task-blocked'));
    if(status==='working'||status==='attention')card.append(node('p',t.message||'Run history is unavailable.','project-task-message'));
    const actions=node('div','','project-task-actions');
    if(!t.runId){
     const busy=!a||options.runs().some(r=>isRunning(r)&&(r.agentId===a.id||r.provider===a.provider));
     button(actions,a?`Start · ${PROVIDERS[a.provider].name}`:'Owner unavailable',async()=>{
      if(!a)return;pending=true;render();try{const r=await options.command('startProjectTask',{agent:a,taskId:t.id});dialog.close();await options.openWork(a.id,r.id);}finally{pending=false;if(dialog.open)render();}
     },busy||!!t.blocked,'primary');
     button(actions,'Edit',async()=>editTask(t),locked(),'quiet');
    }else button(actions,status==='review'?'Review result':'View work',async()=>{dialog.close();await options.openWork(t.agentId,t.runId);},!a,status==='review'?'primary':'secondary');
    card.append(actions);column.append(card);
   }board.append(column);
  }
 }
 function editProject(create=false){
  const p=create?undefined:state.projects.find(p=>p.id===projectId);editingProject=p?.id||'';projectRevision=p?.revision||0;
  el('project-form-title').textContent=p?'Edit project brief':'A new project';el<HTMLInputElement>('project-name').value=p?.name||'';el<HTMLTextAreaElement>('project-goal').value=p?.goal||'';
  el('project-task-form').hidden=true;el('project-brief-form').hidden=false;el('project-brief-form').scrollIntoView({block:'nearest'});el('project-name').focus();
 }
 function editTask(t:ProjectTask|null=null){
  editing=t;el('task-form-title').textContent=t?'Edit planned task':'A clear next step';el<HTMLInputElement>('project-task-title').value=t?.title||'';el<HTMLTextAreaElement>('project-task-brief').value=t?.brief||'';
  const agents=el<HTMLSelectElement>('project-task-owner');agents.replaceChildren(new Option('Choose a teammate',''));for(const a of options.agents().filter(a=>state.assignments[a.id]===projectId))agents.add(new Option(`${a.name} · ${PROVIDERS[a.provider].name}`,a.id));agents.value=t?.agentId||'';
  const dependency=el<HTMLSelectElement>('project-task-dependency');dependency.replaceChildren(new Option('No prerequisite',''));for(const d of state.tasks.filter(d=>d.projectId===projectId&&d.id!==t?.id))dependency.add(new Option(d.title,d.id));dependency.value=t?.dependsOn||'';
  el('project-brief-form').hidden=true;el('project-task-form').hidden=false;el('project-task-form').querySelector('[data-remove]')?.remove();
  if(t){const remove=button(el('project-task-form').querySelector('.button-row')!,'Remove planned task',async()=>{
   pending=true;render();try{options.apply(await options.command('archiveProjectTask',{taskId:t.id,revision:t.revision}));el('project-task-form').hidden=true;}finally{pending=false;render();}
  },locked(),'quiet');remove.type='button';remove.dataset.remove='true';}
  el('project-task-form').scrollIntoView({block:'nearest'});el('project-task-title').focus();
 }
 async function open(id?:string){
  if(id)projectId=id;el('project-brief-form').hidden=true;el('project-task-form').hidden=true;el('project-team').hidden=true;el('project-team-toggle').setAttribute('aria-expanded','false');
  await options.reload();document.body.append(dialog);if(!dialog.open)dialog.showModal();render();
 }
 el('projects-close').onclick=()=>{if(!pending)dialog.close();};dialog.oncancel=e=>{if(pending)e.preventDefault();};
 el('board-project').onchange=()=>{projectId=el<HTMLSelectElement>('board-project').value;el('project-brief-form').hidden=true;el('project-task-form').hidden=true;render();};
 el('project-new').onclick=()=>editProject(true);el('project-edit').onclick=()=>editProject();el('project-brief-cancel').onclick=()=>{el('project-brief-form').hidden=true;};
 el('project-team-toggle').onclick=()=>{el('project-team').hidden=!el('project-team').hidden;el('project-team-toggle').setAttribute('aria-expanded',String(!el('project-team').hidden));};
 el('project-context').onclick=()=>safe(async()=>{const a=options.agents().find(a=>state.assignments[a.id]===projectId);if(a){dialog.close();await options.openContext(a.id);}});
 el('project-task-new').onclick=()=>editTask();el('project-task-cancel').onclick=()=>{el('project-task-form').hidden=true;};
 el('project-brief-form').onsubmit=e=>{e.preventDefault();if(locked())return;safe(async()=>{
  const input={projectId:editingProject,revision:projectRevision,name:el<HTMLInputElement>('project-name').value,goal:el<HTMLTextAreaElement>('project-goal').value};pending=true;render();
  try{const next=await options.command('saveProject',input);projectId=next.savedProjectId;options.apply(next);el('project-brief-form').hidden=true;}finally{pending=false;render();}
 });};
 el('project-task-form').onsubmit=e=>{e.preventDefault();if(locked())return;safe(async()=>{
  const input={taskId:editing?.id||'',revision:editing?.revision,projectId,title:el<HTMLInputElement>('project-task-title').value,brief:el<HTMLTextAreaElement>('project-task-brief').value,agentId:el<HTMLSelectElement>('project-task-owner').value,dependsOn:el<HTMLSelectElement>('project-task-dependency').value};pending=true;render();
  try{options.apply(await options.command('saveProjectTask',input));el('project-task-form').hidden=true;}finally{pending=false;render();}
 });};
 return {open,apply};
}
