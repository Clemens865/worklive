from pathlib import Path
root=Path('outputs/worklive')
p=root/'src-tauri/src/main.rs';s=p.read_text();a=s.index('#[tauri::command]\nasync fn import_context_file');b=s.index('\nfn main()',a);template=s[a:b]
extra=template.replace('import_context_file','import_task_file').replace('import_context_path','import_task_path').replace('    agent_id: String,\n    scope: String,','    task_id: String,\n    revision: i64,').replace('.import(&agent_id, &scope, &name, &bytes, extracted)','.import_task_file(&task_id, revision, &name, &bytes, extracted)').replace('app, agent_id, scope, name, bytes','app, task_id, revision, name, bytes')
extra+='''
#[tauri::command]
fn task_file_command(store: State<'_, Mutex<knowledge::Knowledge>>, command: Value) -> Result<Value, String> {
    store.lock().map_err(|_| "Knowledge store unavailable")?.task_file_command(command)
}
'''
s=s[:b]+extra+s[b:];s=s.replace('            import_context_path\n','            import_context_path,\n            import_task_file,\n            import_task_path,\n            task_file_command\n');p.write_text(s)
p=root/'src/types.ts';s=p.read_text().replace('export interface ProjectTask {','export interface TaskFile {id:string;title:string;revision:number;hash:string;warning:string;createdAt:number;}\nexport interface ProjectTask {files?:TaskFile[];');p.write_text(s)
p=root/'worker/agent-runtime.mjs';s=p.read_text();s=s.replace('Company entries apply to all agents; respect private and project scopes.', 'Company entries apply to all agents; respect private, project and task scopes. Entries with scope task are references attached only to this assignment. Read their relevant passages with context_read before using them; cite filename, ID, revision, fingerprint and locator. Excerpts are incomplete. When task references are present, save findings as deliverables; memory_append is disabled to keep these files out of other tasks.');p.write_text(s)
p=root/'worker/tool-definitions.mjs';s=p.read_text().replace("List this agent's readable personal, project and company notes and attached files.","List this run's readable personal, project and company notes and task-only reference files.");p.write_text(s)
p=root/'src/projects.ts';s=p.read_text().replace("import { invoke }", "import { createTaskFiles } from './task-files';\nimport { invoke }")
s=s.replace(" const inputDialog=el<HTMLDialogElement>('project-input-dialog');", """ const inputDialog=el<HTMLDialogElement>('project-input-dialog');
 const references=createTaskFiles({agents:options.agents,locked,refresh:async()=>{await options.reload();},task:id=>state.tasks.find(t=>t.id===id),error:options.error,back:()=>open(projectId)});
 async function openReferences(t:ProjectTask){dialog.close();await references.open(t.id);}
""")
s=s.replace('Tasks never start automatically.</p>', 'Tasks never start automatically. After saving, use Task files to attach references for this assignment.</p>')
s=s.replace("    const actions=node('div','','project-task-actions');", """    button(card,`Task files${t.files?.length?` · ${t.files.length}`:''}`,async()=>openReferences(t),false,'quiet task-files-button');
    const actions=node('div','','project-task-actions');""")
p.write_text(s)
for path in ['package.json','package-lock.json','src-tauri/tauri.conf.json','src-tauri/Cargo.toml']:
 p=root/path;s=p.read_text().replace('0.7.0','0.8.0');p.write_text(s)
