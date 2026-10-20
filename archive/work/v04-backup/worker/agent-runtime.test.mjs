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
