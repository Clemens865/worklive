import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { Agent } from "./types";

type Scope = "agent" | "project" | "company";
type Entry = {id:string;kind:string;scope:Scope;scopeId:string;title:string;body?:string;preview:string;revision:number;active:boolean;pinned:boolean;status:string;author:string;provider:string;sourceRun:string;source:string;createdAt:number;updatedAt:number;warning:string};
type Catalog = {entries:Entry[];projects:{id:string;name:string}[];projectId:string;busy:boolean};
const el = <T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id)! as T;
const element = (tag:string,text:string,className="")=>{const n=document.createElement(tag);n.textContent=text;n.className=className;return n;};

export function createContext(options:{agents:()=>Agent[];current:()=>string;error:(e:unknown)=>void}){
  document.body.insertAdjacentHTML("beforeend",`<dialog id="context-dialog" aria-labelledby="context-heading">
    <div class="dialog-heading"><div><span class="eyebrow">KNOWLEDGE THAT STAYS WITH YOUR TEAM</span><h2 id="context-heading">Context & files</h2></div><button id="context-close" class="icon-button" aria-label="Close context">×</button></div>
    <div class="context-settings"><label>Agent<select id="context-agent"></select></label><label>Working project<select id="context-project"></select></label><button id="context-project-add" class="secondary">New project</button></div>
    <form id="context-project-form" hidden><label>Project name<input id="context-project-name" maxlength="120" required></label><button class="primary">Create project</button></form>
    <div class="context-tabs" role="group" aria-label="Knowledge scope"><button data-scope="agent">Personal</button><button data-scope="project">Project</button><button data-scope="company">Company</button></div>
    <p id="context-scope-info"></p><p id="context-busy" class="context-notice" hidden>Pause running tasks to edit context. Reading is always available.</p>
    <div class="context-actions"><button id="context-new" class="primary">Add a note</button><label class="secondary file-picker">Add files<input id="context-files" type="file" multiple accept=".txt,.md,.csv,.json,.pdf,.docx" aria-label="Add context files"></label><input id="context-filter" aria-label="Filter context titles" placeholder="Filter titles…"><label class="archive-toggle"><input id="context-archived" type="checkbox">Show archived</label></div>
    <p id="context-import-status" role="status" class="fine-print">Drop files here. TXT, Markdown, CSV, JSON, text PDF and Word · up to 10 MB each.</p>
    <div class="context-columns"><div id="context-list" aria-label="Context entries"></div><section id="context-detail" aria-label="Context detail"><div class="context-welcome"><span class="context-book">▤</span><h3>A little knowledge goes a long way.</h3><p>Add a reference file or a useful note. Both Codex and Claude Code can use the same context.</p><p class="fine-print">Stored locally. Relevant content is sent through your chosen provider when an agent uses it.</p></div></section></div>
  </dialog>`);
  const dialog=el<HTMLDialogElement>("context-dialog");
  let agentId="",scope:Scope="agent",catalog:Catalog={entries:[],projects:[],projectId:"",busy:false},selected="",importing=false,sequence=0;
  const call=(action:string,extra:Record<string,unknown>={})=>invoke<any>("knowledge_command",{command:{action,agentId,...extra}});
  const safe=(fn:()=>Promise<unknown>)=>void fn().catch(options.error);
  function locked(){return importing||catalog.busy||(scope==="project"&&!catalog.projectId)}
  function controls(){
    el<HTMLButtonElement>("context-close").disabled=importing;
    for(const id of ["context-new","context-files"])el<HTMLInputElement>(id).disabled=locked();
    el<HTMLSelectElement>("context-project").disabled=importing||catalog.busy;
    el<HTMLSelectElement>("context-agent").disabled=importing;
    el<HTMLButtonElement>("context-project-add").disabled=importing||catalog.busy;
    el("context-busy").hidden=!catalog.busy;
    dialog.querySelectorAll<HTMLButtonElement>("[data-scope]").forEach(b=>{b.setAttribute("aria-pressed",String(b.dataset.scope===scope));b.disabled=importing;});
    const name=options.agents().find(a=>a.id===agentId)?.name||"This agent";
    el("context-heading").textContent=scope==="company"?"Company knowledge":`${name}’s context`;
    el("context-scope-info").textContent=scope==="company"?"A shared handbook and library for every agent. Agent contributions arrive as proposals for your review.":scope==="project"?(catalog.projectId?"Shared with agents assigned to this project. Changing project starts fresh context for the next run.":"Choose or create a working project to share context with collaborators."):`Private context for ${name}, available with either provider. Notes learned in a project stay restricted to that project.`;
  }
  function rows(){
    const list=el("context-list");list.replaceChildren();
    const query=el<HTMLInputElement>("context-filter").value.toLowerCase();
    const entries=catalog.entries.filter(e=>e.scope===scope&&e.title.toLowerCase().includes(query));
    if(!entries.length)list.append(element("p",scope==="company"?"Your company handbook starts here. Add its mission, voice or a shared reference.":"No context here yet. Add a note or a reference file.","context-empty"));
    for(const entry of entries){
      const b=element("button","","context-entry") as HTMLButtonElement;b.classList.toggle("selected",entry.id===selected);b.setAttribute("aria-label",`${entry.title}, ${entry.kind}, ${entry.status}${entry.active?"":", archived"}`);
      b.append(element("span",entry.kind==="file"?"FILE":"NOTE","eyebrow"),element("strong",entry.title),element("small",`${entry.pinned?"Pinned · ":""}${!entry.active?"Archived · ":entry.status==="proposal"?"Needs review · ":""}${new Date(entry.updatedAt).toLocaleDateString()}`));
      b.onclick=()=>safe(()=>read(entry.id));list.append(b);
    }
  }
  async function reload(keep=true){
    const token=++sequence;const next=await call("list",{archived:el<HTMLInputElement>("context-archived").checked});if(token!==sequence)return;
    catalog=next;
    const project=el<HTMLSelectElement>("context-project");project.replaceChildren(new Option("No project", ""));for(const p of catalog.projects)project.add(new Option(p.name,p.id));project.value=catalog.projectId;
    controls();rows();if(keep&&selected&&catalog.entries.some(e=>e.id===selected))await read(selected);
  }
  function metadata(e:Entry){return `${e.scope==="agent"?"Personal":e.scope==="project"?"Project":"Company"} · version ${e.revision} · ${e.author}${e.provider?" / "+(e.provider==="claude"?"Claude Code":"Codex"):""} · ${new Date(e.updatedAt).toLocaleString()}`;}
  async function mutate(action:string,e:Entry){await call(action,{id:e.id,revision:e.revision});await reload();if(action==="archive"&&!el<HTMLInputElement>("context-archived").checked){selected="";el("context-detail").replaceChildren(element("p","Archived. Enable “Show archived” to restore it.","context-empty"));}}
  async function read(id:string){
    selected=id;const token=++sequence;const result=await call("read",{id});if(token!==sequence)return;
    const e=result.entry as Entry;const panel=el("context-detail");panel.replaceChildren();rows();
    panel.append(element("h3",e.title),element("p",metadata(e),"fine-print"));
    if(e.scopeId.includes("|"))panel.append(element("p","This personal note is restricted to the current project.","context-notice"));
    if(e.warning)panel.append(element("p",e.warning,"context-notice"));
    if(e.source)panel.append(element("p","Source: "+e.source,"context-source"));
    const actions=element("div","","button-row");
    const button=(title:string,fn:()=>void)=>{const b=element("button",title,"secondary") as HTMLButtonElement;b.disabled=locked();b.onclick=fn;actions.append(b);};
    const view=element("button","Open document","primary") as HTMLButtonElement;view.onclick=()=>dispatchEvent(new CustomEvent("worklive:open-document",{detail:{kind:"context",id:e.id,agentId}}));actions.append(view);
    if(e.kind==="note"&&e.active)button("Edit note",()=>edit(e));
    if(e.status==="proposal"&&e.active)button("Publish to company",()=>safe(()=>mutate("publish",e)));
    button(e.active?"Archive":"Restore",()=>safe(()=>mutate(e.active?"archive":"restore",e)));
    panel.append(actions);
    const body=element("div","","context-passages");
    for(const [part,c]of result.chunks.entries()){
      const passage=element("section","","context-passage");passage.append(element("small",`${c.locator} · passage ${part}`,"context-locator"),element("pre",c.text));body.append(passage);
    }panel.append(body);
    panel.append(element("p",`Citation: ${e.title} · ${e.id} · v${e.revision}`,"fine-print"));
    if(result.versions.length>1){const history=document.createElement("details");history.append(element("summary","Revision history"));for(const v of result.versions){const record=document.createElement("details");record.append(element("summary",`Version ${v.revision} · ${new Date(v.updatedAt).toLocaleString()} · ${v.author}`),element("pre",v.body));history.append(record);}panel.append(history);}
  }
  function edit(e?:Entry){
    selected=e?.id||"";rows();const panel=el("context-detail");panel.replaceChildren();
    const form=document.createElement("form");form.className="context-editor";
    form.innerHTML=`<h3>${e?"Edit note":"A note to remember"}</h3><label>Title<input name="title" maxlength="160" required></label><label>What should the agent know?<textarea name="content" rows="9" maxlength="8000" required></textarea></label><label>Source or reference<input name="source" maxlength="1000" placeholder="Optional: decision, document, or reference"></label><label class="context-check"><input type="checkbox" name="pinned">Pin to task context</label><p class="fine-print">Pinned notes are prioritized in the starting context. Full notes remain searchable. Changes apply to the next run.</p><button class="primary">${e?"Save changes":"Save note"}</button>`;
    (form.elements.namedItem("title") as HTMLInputElement).value=e?.title||"";(form.elements.namedItem("content") as HTMLTextAreaElement).value=e?.body||"";(form.elements.namedItem("source") as HTMLInputElement).value=e?.source||"";(form.elements.namedItem("pinned") as HTMLInputElement).checked=!!e?.pinned;
    form.onsubmit=event=>{event.preventDefault();safe(async()=>{const values=new FormData(form);const saved=await call(e?"editNote":"addNote",{scope,id:e?.id,revision:e?.revision,title:values.get("title"),content:values.get("content"),source:values.get("source"),pinned:values.has("pinned")});await reload(false);await read(saved.id);});};panel.append(form);form.querySelector("input")?.focus();
  }
  async function importFiles(files:File[]|string[]){
    if(locked())throw new Error("Pause running tasks and choose a context scope before importing.");
    if(files.length>10)throw new Error("Import up to ten files at a time.");
    importing=true;controls();const imported:string[]=[],failed:string[]=[];
    try{for(const file of files){const name=typeof file==="string"?file.split("/").pop()!:file.name;el("context-import-status").textContent=`Preparing ${name}…`;
      try{let saved:Entry;
        if(typeof file==="string")saved=await invoke("import_context_path",{agentId,scope,path:file});
        else{if(file.size>10*1024*1024)throw new Error("File exceeds 10 MB.");saved=await invoke("import_context_file",{agentId,scope,name:file.name,bytes:Array.from(new Uint8Array(await file.arrayBuffer()))});}
        imported.push(name);selected=saved.id;
      }catch(e){failed.push(`${name}: ${String(e)}`);}
    }}finally{importing=false;await reload();el<HTMLInputElement>("context-files").value="";el("context-import-status").textContent=[imported.length?`${imported.length} file${imported.length===1?"":"s"} ready.`:"",...failed].join(" ");}
  }
  async function open(id=options.current(),target:Scope="agent"){
    if(importing)return;
    el("context-import-status").textContent="Drop files here. TXT, Markdown, CSV, JSON, text PDF and Word · up to 10 MB each.";
    agentId=id;scope=target;selected="";el("context-detail").replaceChildren(element("p","Select a note or file, or add something useful for the team.","context-empty"));
    const select=el<HTMLSelectElement>("context-agent");select.replaceChildren();for(const a of options.agents())select.add(new Option(a.name,a.id));select.value=agentId;
    if(!dialog.open){document.body.append(dialog);dialog.showModal();}await reload(false);
  }
  el("context-close").onclick=()=>{if(!importing)dialog.close();};
  dialog.oncancel=e=>{if(importing)e.preventDefault();};
  el("context-new").onclick=()=>edit();
  el("context-filter").oninput=rows;
  el("context-archived").onchange=()=>safe(()=>reload());
  el("context-agent").onchange=()=>safe(()=>open(el<HTMLSelectElement>("context-agent").value,scope));
  el("context-project").onchange=()=>safe(async()=>{await call("assignProject",{projectId:el<HTMLSelectElement>("context-project").value});selected="";el("context-detail").replaceChildren();await reload(false);});
  el("context-project-add").onclick=()=>{el("context-project-form").hidden=!el("context-project-form").hidden;el("context-project-name").focus();};
  el("context-project-form").onsubmit=e=>{e.preventDefault();safe(async()=>{const project=await call("createProject",{name:el<HTMLInputElement>("context-project-name").value});await call("assignProject",{projectId:project.id});el("context-project-form").hidden=true;el<HTMLInputElement>("context-project-name").value="";scope="project";selected="";el("context-detail").replaceChildren();await reload(false);});};
  dialog.querySelectorAll<HTMLButtonElement>("[data-scope]").forEach(b=>b.onclick=()=>{scope=b.dataset.scope as Scope;selected="";el("context-detail").replaceChildren(element("p","Select an entry to read its context and history.","context-empty"));controls();rows();});
  el("context-files").onchange=()=>safe(()=>importFiles(Array.from(el<HTMLInputElement>("context-files").files||[])));
  // Drag-and-drop import only exists inside Tauri (the web preview has no native window).
  if ("__TAURI_INTERNALS__" in window) void getCurrentWebviewWindow().onDragDropEvent(event=>{if(!dialog.open)return;if(event.payload.type==="drop"){const paths=event.payload.paths;safe(()=>importFiles(paths));}}).catch(options.error);
  return {open,refresh:()=>{if(dialog.open&&!importing)safe(()=>reload());}};
}
