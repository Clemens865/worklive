import { PROVIDERS, isRunning, type Agent, type RunState, type WorkflowState, type Handoff } from './types';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id)! as T;
const make=(tag:string,text:string,cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n};
export function createWorkflow(options:{agents:()=>Agent[];runs:()=>RunState[];command:(action:string,extra?:Record<string,unknown>)=>Promise<any>;error:(e:unknown)=>void;changed:(state:WorkflowState)=>void;openWork:(agentId:string,runId?:string)=>Promise<void>;openProject:(id:string)=>Promise<void>;award:(earned:boolean)=>void}){
 let state:WorkflowState={reviews:[],handoffs:[],projects:[],tasks:[],assignments:{},acceptedMilestones:0,busy:false};
 let pending=false,source:RunState|null=null,preview:{name:string;hash:string;content:string}|null=null,requestId='',previewToken=0,reviewRevision=0;
 const safe=(fn:()=>Promise<unknown>)=>void fn().catch(options.error);
 const active=()=>options.runs().some(isRunning);
 const name=(id:string)=>options.agents().find(a=>a.id===id)?.name||'Former agent';
 document.body.insertAdjacentHTML('beforeend',`<dialog id="handoffs-dialog" aria-labelledby="handoffs-title"><div class="dialog-heading"><div><span class="eyebrow">ONE TEAM, DIFFERENT STRENGTHS</span><h2 id="handoffs-title">Project handoffs</h2></div><button id="handoffs-close" class="icon-button" aria-label="Close project handoffs">×</button></div><p class="fine-print">Review a result, share one file, and give a teammate the next step. Each new handoff becomes a project task. Starts remain your choice.</p><div id="handoff-compose" hidden><form id="handoff-form"><div class="handoff-fields"><label>Reviewed file<select id="handoff-file" required></select></label><label>Project teammate<select id="handoff-recipient" required></select></label></div><p id="handoff-project" class="context-notice"></p><details id="handoff-preview"><summary>Read the exact file being shared</summary><pre id="handoff-preview-text"></pre></details><label>Next task title<input id="handoff-task-title" maxlength="160" required placeholder="e.g. Turn the findings into a launch brief"></label><label>Next step<textarea id="handoff-brief" rows="3" maxlength="4000" placeholder="e.g. Turn this research into a one-page proposal with three recommendations." required></textarea></label><label class="handoff-consent"><input id="handoff-consent" type="checkbox" required><span id="handoff-sharing"></span></label><div class="button-row"><button id="handoff-submit" class="primary">Queue handoff task</button><button id="handoff-discard" type="button" class="secondary">Cancel</button></div></form></div><div id="handoff-list" role="region" aria-label="Handoff queue"></div></dialog>`);
 const dialog=$<HTMLDialogElement>('handoffs-dialog');
 function apply(next:WorkflowState){state=next;reviewRevision++;options.award(state.acceptedMilestones>0);const count=state.handoffs.filter(h=>h.state==='queued').length;$('project-handoffs').textContent=`Handoffs${count?' · '+count:''}`;$('studio-achievement').hidden=!state.acceptedMilestones;$('studio-achievement').textContent='★ First delivery';$('studio-achievement').title='Earned by accepting useful work. Revisions do not earn extra milestones.';options.changed(state);if(dialog.open&&$('handoff-compose').hidden)render();}
 async function reload(){const token=reviewRevision;const next=await options.command('workflow');if(token===reviewRevision)apply(next);}
 function accepted(id:string){return state.reviews.find(r=>r.runId===id)?.accepted===true;}
 async function review(r:RunState,value:boolean){if(pending)return;pending=true;options.changed(state);try{apply(await options.command('reviewRun',{runId:r.id,accepted:value}));}finally{pending=false;options.changed(state);}}
 function controls(){
  const recipient=options.agents().find(a=>a.id===$<HTMLSelectElement>('handoff-recipient').value);
  const project=source?state.projects.find(p=>p.id===state.assignments[source!.agentId]):null;
  $('handoff-sharing').textContent=recipient&&project?`I reviewed this file and authorize ${recipient.name} to use it for ${project.name}, including project notes and results.`:($<HTMLSelectElement>('handoff-recipient').options.length>1?'Choose a teammate, then confirm sharing the reviewed file.':'Assign both agents to the same project in Context & files first.');
  $('handoff-project').textContent=project?`${project.name} · Only this file and your next-step brief are shared. Original notebooks and conversations stay with their agents.`:'Choose a working project in Context & files before creating a handoff.';
  $<HTMLButtonElement>('handoff-submit').disabled=pending||active()||!preview||!recipient||!$<HTMLInputElement>('handoff-consent').checked;
 }
 async function readPreview(){
  if(!source)return;const token=++previewToken;preview=null;requestId=crypto.randomUUID();$<HTMLInputElement>('handoff-consent').checked=false;controls();$('handoff-preview-text').textContent='Loading the saved file…';
  const file=await options.command('artifact',{runId:source.id,name:$<HTMLSelectElement>('handoff-file').value});if(token!==previewToken)return;
  if(!file.unchanged)throw new Error('This file was edited outside Worklive. Create a revised result before sharing.');
  preview={name:file.name,hash:file.hash,content:file.content};$('handoff-preview-text').textContent=file.content;controls();
 }
 async function compose(r:RunState){
  await reload();if(!accepted(r.id))throw new Error('Accept this result after reviewing it first.');
  if(r.taskId&&state.tasks.find(t=>t.id===r.taskId)?.runId!==r.id)throw new Error('This project task has newer work. Review its current result before sharing.');
  source=r;preview=null;pending=false;$('handoff-compose').hidden=false;$('handoff-list').hidden=true;$('handoffs-title').textContent=`A next step for ${name(r.agentId)}’s work`;
  const files=$<HTMLSelectElement>('handoff-file');files.replaceChildren();for(const f of r.artifacts.filter(a=>a.kind?a.kind==='deliverable':!/^response(-\d+)?\.md$/.test(a.name)))files.add(new Option(f.name,f.name));
  const recipients=$<HTMLSelectElement>('handoff-recipient');recipients.replaceChildren(new Option('Choose a teammate',''));
  const project=state.assignments[r.agentId];for(const a of options.agents().filter(a=>a.id!==r.agentId&&project&&state.assignments[a.id]===project))recipients.add(new Option(`${a.name} · ${PROVIDERS[a.provider].name}`,a.id));
  $<HTMLInputElement>('handoff-task-title').value='';$<HTMLTextAreaElement>('handoff-brief').value='';$<HTMLInputElement>('handoff-consent').checked=false;$<HTMLDetailsElement>('handoff-preview').open=true;controls();document.body.append(dialog);if(!dialog.open)dialog.showModal();await readPreview();
 }
 function button(parent:HTMLElement,label:string,fn:()=>Promise<unknown>,disabled=false){const b=make('button',label,'secondary') as HTMLButtonElement;b.disabled=disabled||pending;b.onclick=()=>safe(fn);parent.append(b);}
 function render(){
  const list=$('handoff-list');list.replaceChildren();
  if(!state.handoffs.length){const empty=make('div','','handoff-empty');empty.append(make('span','↗','handoff-symbol'),make('h3','Good work can become someone else’s starting point.'),make('p','Open Work & results, read a saved deliverable, and mark it accepted. Then hand it to a teammate assigned to the same project.'));list.append(empty);}
  if(active())list.append(make('p','A task is running. Pause it before changing a review or queued handoff. You can start another provider when it is available.','context-notice'));
  for(const h of state.handoffs){
   const card=make('section','','handoff-card');card.setAttribute('role','group');card.setAttribute('aria-label',`${name(h.sourceAgent)} to ${name(h.recipient)}`);card.append(make('span',h.projectName,'eyebrow'),make('h3',`${name(h.sourceAgent)} → ${name(h.recipient)}`),make('p',h.brief,'handoff-task'),make('small',`${h.fileName} · ${new Date(h.createdAt).toLocaleString()}`,'fine-print'));
   const latest=options.runs().find(r=>r.id===h.runId),recipient=options.agents().find(a=>a.id===h.recipient),linked=state.tasks.find(t=>t.id===h.taskId);
   const runStatus=latest?.status||h.runStatus;
   const status=h.state==='queued'?(linked?.blocked||'Queued · waiting for you'):h.state==='cancelled'?'Cancelled':runStatus?(accepted(h.runId)?'Accepted':runStatus==='review'?'Ready for review':runStatus.replace(/^./,c=>c.toUpperCase())):'Started · saved in task history';
   card.append(make('p',h.taskTitle?`${h.taskTitle} · ${status}`:status,'handoff-state'));const actions=make('div','','button-row');
   if(h.state==='queued'){
    const busy=!recipient||!!linked?.blocked||!!h.taskId&&!linked||options.runs().some(r=>isRunning(r)&&(r.agentId===recipient.id||r.provider===recipient.provider));
    button(actions,recipient?`Start with ${PROVIDERS[recipient.provider].name}`:'Recipient unavailable',async()=>{if(!recipient)return;pending=true;render();try{const r=await options.command('startHandoff',{agent:recipient,handoffId:h.id});await reload();dialog.close();await options.openWork(recipient.id,r.id);}finally{pending=false;if(dialog.open)render();}},busy);
    button(actions,'Cancel handoff',async()=>apply(await options.command('cancelHandoff',{handoffId:h.id})),active());
   }else if(h.state==='started')button(actions,'View work',async()=>{dialog.close();await options.openWork(h.recipient,h.runId);},!recipient);
   if(h.taskId)button(actions,'Open project',async()=>{dialog.close();await options.openProject(h.projectId);});
   const meta=document.createElement('details');meta.append(make('summary','Handoff record'),make('p',`Shared from run ${h.sourceRun}. File fingerprint: ${h.hash}. Accepted source: ${new Date(h.sourceReviewedAt).toLocaleString()}.`,'fine-print'));card.append(actions,meta);list.append(card);
  }
 }
 async function open(){source=null;++previewToken;preview=null;$('handoff-compose').hidden=true;$('handoff-list').hidden=false;$('handoffs-title').textContent='Project handoffs';document.body.append(dialog);if(!dialog.open)dialog.showModal();await reload();render();}
 $('handoffs-close').onclick=()=>{if(!pending)dialog.close()};dialog.oncancel=e=>{if(pending)e.preventDefault()};
 $('handoff-discard').onclick=()=>safe(open);
 $('handoff-file').onchange=()=>safe(readPreview);
 $('handoff-recipient').onchange=()=>{$<HTMLInputElement>('handoff-consent').checked=false;requestId=crypto.randomUUID();controls();};
 $('handoff-consent').onchange=controls;
 $('handoff-brief').oninput=$('handoff-task-title').oninput=()=>{requestId=crypto.randomUUID();};
 $('handoff-form').onsubmit=e=>{e.preventDefault();if(pending||!source||!preview)return;safe(async()=>{pending=true;controls();try{const next=await options.command('createHandoff',{runId:source!.id,fileName:preview!.name,expectedHash:preview!.hash,recipient:$<HTMLSelectElement>('handoff-recipient').value,projectId:state.assignments[source!.agentId],brief:$<HTMLTextAreaElement>('handoff-brief').value,taskTitle:$<HTMLInputElement>('handoff-task-title').value,consent:$<HTMLInputElement>('handoff-consent').checked,requestId});apply(next);dialog.close();await options.openProject(state.assignments[source!.agentId]);}finally{pending=false;controls();if($('handoff-compose').hidden)render();}})};
 return {open,compose,review,reload,apply,accepted,locked:()=>pending||active(),refresh:()=>{if(dialog.open&&$('handoff-compose').hidden)safe(reload);},};
}
