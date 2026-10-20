// Opt-in subscription smoke: run via the ignored Rust test, never at app startup.
import { AgentRuntime } from './agent-runtime.mjs';
import { createInterface } from 'node:readline';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const data=process.argv[2],pending=new Map();let seq=0;
const input=createInterface({input:process.stdin});
input.on('line',line=>{const v=JSON.parse(line),p=pending.get(v.id);if(p){pending.delete(v.id);v.error?p.reject(new Error(v.error)):p.resolve(v.result)}});
function request(value){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});process.stdout.write(JSON.stringify({id,...value})+'\n')})}
const desktop=value=>request({desktop:value});
const runtime=new AgentRuntime({data,emit(e){if(e.type==='run'&&e.run)process.stderr.write(`${e.run.provider}: ${e.run.status} · ${e.run.message}\n`)},knowledge:value=>request({host:value}),prepareBrowser:async()=>{},releaseBrowser:async()=>{},browserTool:async()=>{throw new Error('Use the supplied local context for this test.')},duration:180000});
const timeout=setTimeout(()=>{process.stderr.write('Memory smoke timed out\n');process.exit(1)},420000);
const agent={id:'memory-test',name:'Memory test',role:'Researcher',personality:'Exact and concise. Preserve source provenance.'};
async function run(provider,task,previousRunId){
 const start=await runtime.start({...agent,provider,task},{previousRunId,followup:previousRunId?task:''});
 while(['starting','running','pausing','stopping'].includes(runtime.runs.get(start.id).status))await new Promise(r=>setTimeout(r,250));
 const r=runtime.runs.get(start.id);assert.equal(r.status,'review',r.message);return r;
}
try{
 await runtime.init();
 const company=await desktop({action:'addNote',agentId:agent.id,scope:'company',title:'Company handbook',content:'The studio name is Lumen Orchard. Its writing principle is Plain language first.',pinned:true});
 const project=await desktop({action:'createProject',name:'Atlas launch'});await desktop({action:'assignProject',agentId:agent.id,projectId:project.id});
 await desktop({action:'addNote',agentId:agent.id,scope:'project',title:'Atlas delivery',content:'The Atlas delivery day is Thursday. The budget has not been decided.'});
 await request({file:{agentId:agent.id,scope:'agent',name:'atlas-reference.txt',content:'Atlas reference\nThe private review word is Juniper-418. The preferred report length is 90 words.'}});
 const task='Use context_list and context_read to inspect the company handbook, Atlas delivery note, and atlas-reference.txt. Save facts.md with the studio name, writing principle, delivery day, private review word, report length, and budget. Cite exact source title, version and locator. If a value is not decided say so. Save a personal memory titled Atlas checklist containing the sourced delivery day and private review word; cite their sources. No web browsing.';
 const codex=await run('codex',task);
 const first=(await runtime.artifact(codex.id,'facts.md')).content;for(const word of ['Lumen Orchard','Thursday','Juniper-418','90'])assert(first.includes(word),word);assert(codex.memoriesAdded.some(m=>m.title==='Atlas checklist'));
 const claude=await run('claude','Read the local Atlas checklist saved by the previous provider using context tools, plus the company handbook. Save handoff.md with the studio name, delivery day, and private review word. Cite both exact source titles and versions. Do not browse or create new memory.',codex.id);
 const second=(await runtime.artifact(claude.id,'handoff.md')).content;for(const word of ['Lumen Orchard','Thursday','Juniper-418'])assert(second.includes(word),word);assert(claude.contextUsed.some(c=>c.title==='Atlas checklist'));
 await desktop({action:'editNote',agentId:agent.id,id:company.id,revision:1,title:'Company handbook',content:'The studio name is Cedar Harbor. Its writing principle is Plain language first.',pinned:true,source:'Owner correction'});
 const correction=await run('codex','Read the current company handbook and save correction.md with only its current studio name, exact source title, and revision. Do not browse or create new memory.',codex.id);
 const third=(await runtime.artifact(correction.id,'correction.md')).content;assert(third.includes('Cedar Harbor'));assert(!third.includes('Lumen Orchard'));assert(correction.freshContext);assert.notEqual(codex.sessionId,correction.sessionId);
 const report=[codex,claude,correction].map(r=>({provider:r.provider,status:r.status,contextUsed:r.contextUsed.map(c=>({title:c.title,revision:c.revision})),memoriesAdded:r.memoriesAdded,sessionId:r.sessionId,freshContext:r.freshContext,files:r.artifacts.map(a=>a.name)}));
 await writeFile(join(data,'memory-smoke-report.json'),JSON.stringify(report,null,2));
 process.stderr.write('PASS: Codex → Claude memory handoff and correction after context change.\n');
}catch(e){process.stderr.write(String(e.stack||e)+'\n');process.exitCode=1}
finally{clearTimeout(timeout);await runtime.shutdown();input.close();process.stdin.destroy();}
