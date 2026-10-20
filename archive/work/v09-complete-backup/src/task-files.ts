import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { Agent, ProjectTask, TaskFile } from './types';
const node=(tag:string,text:string,cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
export function createTaskFiles(options:{agents:()=>Agent[];locked:()=>boolean;refresh:()=>Promise<void>;task:(id:string)=>ProjectTask|undefined;error:(e:unknown)=>void;back:()=>Promise<void>}){
 let taskId='',busy=false;
 const dialog=document.createElement('dialog');dialog.id='task-files-dialog';dialog.setAttribute('aria-labelledby','task-files-heading');
 dialog.innerHTML=`<div class="dialog-heading"><div><span class="eyebrow">REFERENCES FOR THIS ASSIGNMENT</span><h2 id="task-files-heading">Task files</h2></div><button class="icon-button" data-close aria-label="Back to project">×</button></div><p data-title class="task-reference-title"></p><p data-notice class="fine-print"></p><label class="task-reference-upload">Attach reference files<input data-upload type="file" multiple accept=".txt,.md,.csv,.json,.pdf,.docx" aria-label="Attach task files"></label><p data-status role="status" class="fine-print">Drop files here, or choose files. Up to ten references, 10 MB each.</p><div class="task-reference-layout"><section data-list aria-label="Task references"></section><section data-preview aria-label="Reference preview"><p class="context-empty">Select a file to read the saved text and its source details.</p></section></div>`;
 document.body.append(dialog);
 const el=<T extends HTMLElement=HTMLElement>(selector:string)=>dialog.querySelector<T>(selector)!;
 const safe=(f:()=>Promise<unknown>)=>void f().catch(options.error);
 const locked=()=>busy||options.locked()||!!options.task(taskId)?.runId;
 function render(){
  const task=options.task(taskId);if(!task)return;
  const files=task.files||[];
  el('[data-title]').textContent=task.title;
  const agent=options.agents().find(a=>a.id===task.agentId);
  el('[data-notice]').textContent=`Available only to ${agent?.name||'the owner'} while working on this task. Files are copied into local storage; the original can change without changing this reference. ${task.runId?'Work has started, so references are now fixed.':options.locked()?'Pause running work before changing references.':'You can add or remove references before starting.'} Findings can be saved as deliverables and deliberately shared after review.`;
  el<HTMLInputElement>('[data-upload]').disabled=locked()||files.length>=10;
  el('.task-reference-upload').hidden=!!task.runId;
  if(task.runId)el('[data-status]').textContent='Saved references used by this task. Select a file to inspect its text and source details.';
  el<HTMLButtonElement>('[data-close]').disabled=busy;
  const list=el('[data-list]');list.replaceChildren();
  if(!files.length)list.append(node('p','No references attached yet.','context-empty'));
  for(const file of files){
   const row=node('article','','task-reference-row');
   const read=node('button',file.title,'secondary') as HTMLButtonElement;read.type='button';read.disabled=busy;read.onclick=()=>safe(()=>preview(file));row.append(read);
   if(!task.runId){const remove=node('button',`Remove ${file.title}`,'quiet') as HTMLButtonElement;remove.type='button';remove.disabled=locked();remove.onclick=()=>safe(async()=>{
    if(locked())return;busy=true;render();
    try{await invoke('task_file_command',{command:{action:'remove',taskId,fileId:file.id,revision:task.revision}});await options.refresh();el('[data-preview]').replaceChildren(node('p','Reference removed from this planned task.','context-empty'));}finally{busy=false;render();}
   });row.append(remove);}
   list.append(row);
  }
 }
 async function preview(file:TaskFile){
  const result=await invoke<{entry:TaskFile;chunks:{text:string;locator:string}[]}>('task_file_command',{command:{action:'read',taskId,fileId:file.id}});
  const panel=el('[data-preview]');panel.replaceChildren(node('h3',result.entry.title));
  const view=node('button','Open document','primary') as HTMLButtonElement;view.type='button';view.onclick=()=>dispatchEvent(new CustomEvent('worklive:open-document',{detail:{kind:'task',taskId,fileId:file.id}}));panel.append(view);
  if(result.entry.warning)panel.append(node('p',result.entry.warning,'context-notice'));
  panel.append(node('p',`Saved ${new Date(result.entry.createdAt).toLocaleString()} · ${result.chunks.length} passage${result.chunks.length===1?'':'s'}`,'fine-print'));
  const record=node('details','');record.append(node('summary','Source record'),node('p',`ID: ${file.id} · Version ${file.revision} · SHA-256: ${file.hash}`,'task-reference-record'));panel.append(record);
  for(const chunk of result.chunks){panel.append(node('p',chunk.locator,'fine-print'),node('pre',chunk.text,'task-reference-text'));}
 }
 async function importFiles(files:File[]|string[]){
  if(locked())throw new Error('Pause running work before changing planned task references.');
  if(!files.length)return;
  if(files.length+(options.task(taskId)?.files?.length||0)>10)throw new Error('Attach up to ten references per task.');
  busy=true;render();const imported:string[]=[],failures:string[]=[];
  try{for(const file of files){
   const name=typeof file==='string'?file.split('/').pop()!:file.name;
   el('[data-status]').textContent=`Preparing ${name}…`;
   try{
    const revision=options.task(taskId)!.revision;
    if(typeof file==='string')await invoke('import_task_path',{taskId,revision,path:file});
    else{if(file.size>10*1024*1024)throw new Error('File exceeds 10 MB.');await invoke('import_task_file',{taskId,revision,name:file.name,bytes:Array.from(new Uint8Array(await file.arrayBuffer()))});}
    imported.push(name);await options.refresh();
   }catch(e){failures.push(`${name}: ${String(e)}`);}
  }}finally{busy=false;el<HTMLInputElement>('[data-upload]').value='';render();el('[data-status]').textContent=[imported.length?`${imported.length} reference${imported.length===1?'':'s'} ready.`:'',...failures].join(' ');}
 }
 el('[data-close]').onclick=()=>{if(!busy)dialog.close();};dialog.oncancel=e=>{if(busy)e.preventDefault();};dialog.onclose=()=>safe(options.back);
 el('[data-upload]').onchange=()=>safe(()=>importFiles(Array.from(el<HTMLInputElement>('[data-upload]').files||[])));
 if ("__TAURI_INTERNALS__" in window) void getCurrentWebviewWindow().onDragDropEvent(event=>{if(dialog.open&&event.payload.type==='drop'){const paths=event.payload.paths;safe(()=>importFiles(paths));}}).catch(options.error);
 return {async open(id:string){taskId=id;await options.refresh();el('[data-status]').textContent='Drop files here, or choose files. TXT, Markdown, CSV, JSON, text PDF and DOCX · up to ten references, 10 MB each.';el('[data-preview]').replaceChildren(node('p','Select a file to read the saved text and its source details.','context-empty'));render();document.body.append(dialog);if(!dialog.open)dialog.showModal();}};
}
