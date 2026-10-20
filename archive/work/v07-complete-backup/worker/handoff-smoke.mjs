// Opt-in Claude handoff check with an independently reviewed synthetic source.
import {AgentRuntime} from './agent-runtime.mjs';
import {createInterface} from 'node:readline';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const data=process.argv[2],pending=new Map();let seq=0;
const input=createInterface({input:process.stdin});input.on('line',line=>{const v=JSON.parse(line),p=pending.get(v.id);if(p){pending.delete(v.id);v.error?p.reject(new Error(v.error)):p.resolve(v.result)}});
function request(value){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});process.stdout.write(JSON.stringify({id,...value})+'\n')})}
const desktop=value=>request({desktop:value});
const runtime=new AgentRuntime({data,emit(){},knowledge:value=>request({host:value}),prepareBrowser:async()=>{},releaseBrowser:async()=>{},browserTool:async()=>{throw new Error('Use the attached handoff.')},duration:150000});
const timeout=setTimeout(()=>process.exit(1),210000);
try{
 await runtime.init();const p=await desktop({action:'createProject',name:'Handoff validation'});
 for(const id of ['source','recipient'])await desktop({action:'assignProject',agentId:id,projectId:p.id});
 await desktop({action:'addNote',agentId:'source',scope:'agent',title:'Sender-only notebook',content:'Private internal code: PRIVATE-728'});
 const id=randomUUID(),source={id,agentId:'source',provider:'codex',task:'Synthetic source fixture',status:'review',message:'Fixture',text:'',startedAt:Date.now(),endedAt:Date.now(),events:[],artifacts:[],sources:[],dir:join(data,'runs',id)};
 runtime.runs.set(id,source);runtime.latest.set('source',id);const file=await runtime.saveDocument(source,'approved.md','Reviewed handoff reference\nLaunch word: Solstice-621. Delivery day: Friday.\n');await runtime.review(id,true);
 const hid=randomUUID();await runtime.createHandoff({runId:id,fileName:file.name,expectedHash:file.hash,recipient:'recipient',projectId:p.id,brief:'Read all passages of the shared file with handoff_read. Save handoff-check.md containing the launch word and delivery day, citing the filename, handoff ID, hash and locator. Do not browse or add memories.',requestId:hid,consent:true});
 const agent={id:'recipient',name:'Recipient',role:'Writer',personality:'Precise and concise',provider:'claude',task:''};
 const start=await runtime.startHandoff(agent,hid);let r;
 do{await new Promise(resolve=>setTimeout(resolve,250));r=runtime.runs.get(start.id)}while(['starting','running','pausing','stopping'].includes(r.status));
 assert.equal(r.status,'review',r.message);const output=await runtime.artifact(r.id,'handoff-check.md');assert(output.content.includes('Solstice-621'));assert(output.content.includes('Friday'));assert(!output.content.includes('PRIVATE-728'));assert(r.contextUsed.some(c=>c.title==='approved.md'&&c.text.includes('Solstice-621')));
 await writeFile(join(data,'handoff-smoke-report.json'),JSON.stringify({provider:r.provider,status:r.status,handoffId:r.handoffId,contextUsed:r.contextUsed,files:r.artifacts.map(a=>a.name)},null,2));
 process.stderr.write('PASS: Claude Code read the reviewed handoff, cited it, and saved the requested result.\n');
}catch(e){process.stderr.write(String(e.stack||e)+'\n');process.exitCode=1}finally{clearTimeout(timeout);await runtime.shutdown();input.close();process.stdin.destroy();}
