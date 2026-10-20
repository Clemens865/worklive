import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentRuntime, safeFileName } from './agent-runtime.mjs';
const agent={id:'ada',name:'Ada',role:'Researcher',personality:'Curious',task:'Research one public page.',provider:'codex'};
async function until(check){const end=Date.now()+3000;while(!check()){if(Date.now()>end)throw new Error('timeout');await new Promise(r=>setTimeout(r,10));}}
async function setup(t,extra={}){
 const data=await mkdtemp(join(tmpdir(),'worklive-test-')),children=[],specs=[];
 const runtime=new AgentRuntime({data,emit(){},browserTool:async()=>({source:{url:'https://example.com',title:'Example',text:'Evidence',retrievedAt:new Date().toISOString()}}),prepareBrowser:async()=>{},releaseBrowser:async()=>{},inspect:async()=>({status:'ready',version:'test'}),spawn(provider,spec){specs.push(spec);const child=new EventEmitter();child.pid=123;child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.kill=()=>{setImmediate(()=>child.emit('close',null));return true};children.push(child);return child},...extra});
 await runtime.init();t.after(async()=>{await runtime.shutdown();await rm(data,{recursive:true,force:true})});
 return {runtime,children,specs,data};
}
function line(child,obj){child.stdout.write(JSON.stringify(obj)+'\n');}
async function begin(runtime,a=agent){const initial=await runtime.start(a);await until(()=>runtime.runs.get(initial.id).status==='running');return runtime.runs.get(initial.id);}
test('saved results are versioned, scoped to the run, and paired with observed evidence',async t=>{
 const {runtime,children}=await setup(t);const r=await begin(runtime);
 await runtime.tool(r,'browser_open',{url:'https://example.com'});
 const one=await runtime.tool(r,'save_document',{name:'notes.md',content:'First'}),two=await runtime.tool(r,'save_document',{name:'notes.md',content:'Second'});
 assert.equal(one.name,'notes.md');assert.equal(two.name,'notes-2.md');assert.equal((await runtime.artifact(r.id,one.name)).content,'First');assert.equal(r.sources.length,1);
 line(children[0],{type:'turn.completed',usage:{input_tokens:1}});children[0].emit('close',0);
 await until(()=>r.status==='review');assert.equal(r.artifacts.length,2);
});
test('exit zero without a completion event is not success',async t=>{
 const {runtime,children}=await setup(t);const r=await begin(runtime);children[0].emit('close',0);await until(()=>r.status==='error');assert.match(r.message,/before confirming/);
});
test('pause revokes queued browser work and resume uses the exact session',async t=>{
 let release;let calls=0;
 const {runtime,children,specs}=await setup(t,{browserTool:async()=>{calls++;await new Promise(r=>release=r);return {}}});
 const r=await begin(runtime);line(children[0],{type:'thread.started',thread_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'});
 const first=runtime.tool(r,'browser_read',{});await until(()=>!!release);
 const second=runtime.tool(r,'browser_read',{});const rejected=assert.rejects(second,/paused or stopped/);
 const stopped=runtime.stop(agent.id,'paused');release();await first;await rejected;await stopped;
 assert.equal(calls,1);assert.equal(r.status,'paused');await assert.rejects(runtime.tool(r,'browser_read',{}),/paused or stopped/);
 await runtime.start(agent,{previousRunId:r.id});await until(()=>specs.length===2);assert.deepEqual(specs[1].args.slice(0,3),['exec','resume',r.sessionId]);
});
test('provider switching starts a new session and another agent cannot adopt the old run',async t=>{
 const {runtime,children,specs}=await setup(t);const r=await begin(runtime);line(children[0],{type:'thread.started',thread_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'});await runtime.stop(agent.id);
 await assert.rejects(runtime.start({...agent,id:'other'},{previousRunId:r.id}),/does not belong/);
 await runtime.start({...agent,provider:'claude'},{previousRunId:r.id});await until(()=>specs.length===2);assert(!specs[1].args.includes('--resume'));
});
test('one active run per provider; different providers can work independently',async t=>{
 const {runtime}=await setup(t);await begin(runtime);
 await assert.rejects(runtime.start({...agent,id:'second'}),/already running/);
 const r=await begin(runtime,{...agent,id:'second',provider:'claude'});assert.equal(r.provider,'claude');
});
test('restart marks unfinished work interrupted and retains the complete history index',async t=>{
 const {runtime,data}=await setup(t);await begin(runtime);await begin(runtime,{...agent,id:'second',provider:'claude'});await runtime.writeTail;
 const restored=new AgentRuntime({data,emit(){}});await restored.init();
 assert.equal(restored.state().length,2);assert(restored.state().every(r=>r.status==='interrupted'));
 assert.equal(JSON.parse(await readFile(join(data,'run-index.json'),'utf8')).length,2);
});
test('output paths cannot escape the run',()=>{
 for(const name of ['../escape.md','/tmp/file.md','file.sh','a/notes.md','a..b.md',''])assert.throws(()=>safeFileName(name));
 assert.equal(safeFileName('research notes.md'),'research notes.md');
});
test('a polite final reply about a blocker cannot count as a completed deliverable',async t=>{
 const {runtime,children}=await setup(t);const r=await begin(runtime);
 line(children[0],{type:'item.completed',item:{type:'agent_message',text:'I could not use the tools.'}});
 line(children[0],{type:'turn.completed'});children[0].emit('close',0);
 await until(()=>r.status==='error');assert.equal(r.artifacts[0].name,'response.md');assert.match(r.message,/No deliverable/);
});
test('pause during subscription verification prevents a late CLI launch',async t=>{
 let release;const {runtime,children}=await setup(t,{inspect:()=>new Promise(r=>release=r)});
 const run=await runtime.start(agent);await until(()=>!!release);
 await runtime.stop(agent.id,'paused');release({status:'ready'});
 await new Promise(r=>setTimeout(r,20));assert.equal(children.length,0);assert.equal(runtime.runs.get(run.id).status,'paused');
});

test('context changes revoke prior CLI history and retained result on continuation',async t=>{
 let epoch='1';const calls=[];
 const {runtime,children,specs}=await setup(t,{knowledge:async request=>{calls.push(request);return request.op==='begin'?{contextKey:epoch,items:[{id:'note',revision:Number(epoch),title:'Brief',scope:'company',part:0,excerpt:'Current fact'}]}:{}}});
 const r=await begin(runtime);line(children[0],{type:'thread.started',thread_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'});r.text='REVOKED_PRIVATE_CONTENT';await runtime.stop(agent.id);
 epoch='2';const next=await runtime.start(agent,{previousRunId:r.id});await until(()=>specs.length===2);const active=runtime.runs.get(next.id);
 assert.equal(active.sessionId,null);assert.equal(active.freshContext,true);assert(!specs[1].args.includes('resume'));
 const prompt=children[1].stdin.read().toString();assert(!prompt.includes('REVOKED_PRIVATE_CONTENT'));assert(prompt.includes('Current fact'));
 await runtime.stop(agent.id);assert.equal(calls.filter(c=>c.op==='end').length,2);
});
test('memory calls retain the same bound identity and record context receipts',async t=>{
 const calls=[];const entry={id:'note',revision:1,title:'Local source',scope:'company',part:0,preview:'Fact'};
 const {runtime}=await setup(t,{knowledge:async request=>{calls.push(request);if(request.op==='begin')return {contextKey:'1',items:[]};if(request.op==='tool')return request.name==='context_list'?{entries:[entry]}:{...entry,status:'proposal'};return {};}});
 const r=await begin(runtime);await runtime.tool(r,'context_list',{});await runtime.tool(r,'memory_append',{scope:'company',title:'Useful',content:'Learned fact',source:'Local source'});
 assert.equal(r.contextUsed.length,1);assert.equal(r.memoriesAdded[0].status,'proposal');assert(calls.every(c=>c.runId===r.id));assert.equal(calls[0].agentId,agent.id);
 await runtime.stop(agent.id);await assert.rejects(runtime.tool(r,'context_list',{}),/paused or stopped/);
});

test('reading a complete passage upgrades its initial excerpt in the run evidence',async t=>{
 const entry={id:'source',revision:1,title:'Brief',scope:'company',part:0,excerpt:'Short preview'};
 const {runtime}=await setup(t,{knowledge:async q=>q.op==='begin'?{contextKey:'1',items:[entry]}:q.op==='tool'?{...entry,text:'Complete passage beyond the preview',locator:'Page 2'}:{}});
 const r=await begin(runtime);await runtime.tool(r,'context_read',{id:'source',revision:1,part:0});
 assert.equal(r.contextUsed.length,1);assert.equal(r.contextUsed[0].text,'Complete passage beyond the preview');
});

test('resumed and provider-switched runs carry the private-history flag to Rust',async t=>{
 const calls=[];const {runtime,children}=await setup(t,{knowledge:async q=>{calls.push(q);return q.op==='begin'?{contextKey:'1',items:[],privateContext:!!q.previousPrivateContext}:q.op==='tool'?{entries:[{id:'private',revision:1,title:'Private',scope:'agent',preview:'Private fact'}]}:{}}});
 const r=await begin(runtime);line(children[0],{type:'thread.started',thread_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'});await runtime.tool(r,'context_list',{});await runtime.stop(agent.id);
 const next=await runtime.start({...agent,provider:'claude'},{previousRunId:r.id});await until(()=>runtime.runs.get(next.id).status==='running');
 assert.equal(calls.filter(c=>c.op==='begin')[1].previousPrivateContext,true);assert.equal(runtime.runs.get(next.id).privateContext,true);
});

test('review checks the saved bytes and agents cannot invoke owner review actions',async t=>{
 const calls=[];const {runtime,children}=await setup(t,{knowledge:async q=>{calls.push(q);return q.op==='begin'?{contextKey:'1',items:[]}:{reviews:[],handoffs:[],acceptedMilestones:1};}});
 const r=await begin(runtime);await runtime.tool(r,'save_document',{name:'finding.md',content:'Reviewed evidence'});
 assert.throws(()=>runtime.tool(r,'work_review',{}),/not available/);
 line(children[0],{type:'turn.completed'});children[0].emit('close',0);await until(()=>r.status==='review');
 await runtime.review(r.id,true);const review=calls.find(c=>c.op==='work_review');assert.equal(review.hashes.length,1);assert.equal(review.rootId,r.id);
 const {writeFile}=await import('node:fs/promises');await writeFile(r.artifacts[0].path,'Edited elsewhere');await assert.rejects(runtime.review(r.id,true),/edited outside/);
});
test('handoff creation rejects changed previews and passes only the chosen file',async t=>{
 const calls=[];const {runtime,children}=await setup(t,{knowledge:async q=>{calls.push(q);return q.op==='begin'?{contextKey:'1',items:[]}:{reviews:[],handoffs:[],acceptedMilestones:1};}});
 const r=await begin(runtime);await runtime.tool(r,'save_document',{name:'one.md',content:'Shared file'});await runtime.tool(r,'save_document',{name:'two.md',content:'Leave this behind'});
 line(children[0],{type:'turn.completed'});children[0].emit('close',0);await until(()=>r.status==='review');
 const input={runId:r.id,fileName:'one.md',expectedHash:r.artifacts[0].hash,recipient:'other',projectId:'project',brief:'Next step',requestId:'handoff',consent:true};
 await assert.rejects(runtime.createHandoff({...input,expectedHash:'changed'}),/changed after preview/);await assert.rejects(runtime.createHandoff({...input,consent:false}),/confirm/);
 await runtime.createHandoff(input);const h=calls.find(c=>c.op==='work_create');assert.equal(h.content,'Shared file');assert(!JSON.stringify(h).includes('Leave this behind'));
});
test('handoff starts with the recipient provider and preserves its binding when continued',async t=>{
 const calls=[];const handoff={id:'handoff',recipient:'ada',state:'queued',brief:'Use the reviewed file',fileName:'shared.md'};
 const {runtime,children,specs}=await setup(t,{knowledge:async q=>{calls.push(q);return q.op==='work_status'?{handoffs:[handoff]}:q.op==='begin'?{contextKey:'1',projectId:'p',items:[],handoff}:{}}});
 const initial=await runtime.startHandoff({...agent,provider:'claude'},'handoff');await until(()=>specs.length===1);const r=runtime.runs.get(initial.id);
 assert.equal(r.task,handoff.brief);assert.equal(r.provider,'claude');assert.equal(calls.find(c=>c.op==='begin').handoffId,'handoff');
 const prompt=children[0].stdin.read().toString();assert(prompt.includes('handoff_read'));await runtime.stop(agent.id);
 await runtime.start({...agent,provider:'codex'},{previousRunId:r.id});await until(()=>specs.length===2);assert.equal(calls.filter(c=>c.op==='begin')[1].handoffId,'handoff');
});
