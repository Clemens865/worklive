import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
const base='/Users/clemenshoenig/Documents/Codex/2026-09-30/i-w';
const provider=process.argv[2],data=process.argv[3];
const child=spawn(process.execPath,[base+'/outputs/worklive/worker/main.mjs',data],{stdio:['pipe','pipe','pipe']});
let seq=0,latest;const pending=new Map();
child.stderr.on('data',c=>process.stderr.write(c));
createInterface({input:child.stdout}).on('line',line=>{const e=JSON.parse(line);if(e.type==='reply'){const p=pending.get(e.id);pending.delete(e.id);if(p)e.ok?p.resolve(e.result):p.reject(Error(e.error));}if(e.type==='run'){if(e.run.message!==latest?.message||e.run.status!==latest?.status)console.log(provider,e.run.status,e.run.message);latest=e.run;}});
const command=(action,extra={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});child.stdin.write(JSON.stringify({action,id,...extra})+'\n')});
const wait=async(fn)=>{const until=Date.now()+140000;while(!fn()){if(Date.now()>until)throw Error('timeout');await new Promise(r=>setTimeout(r,100));}};
try {
 const history=await command('runHistory',{agentId:'test-'+provider});const previous=history[0];
 const agent={id:previous.agentId,name:'Test '+provider,provider,role:'Researcher',personality:'Concise and factual.',task:previous.task};
 await command('ensure',{agentId:agent.id});
 await command('startTask',{agent,previousRunId:previous.id,followup:'Inspect https://example.com again and save revision.md with a one-sentence summary and its exact URL.'});
 await wait(()=>latest?.status==='running'&&latest?.sessionId);
 if(provider==='codex'){
  await command('takeControl',{agentId:agent.id});
  if(latest.status!=='paused')throw Error('takeover did not pause');
  await command('returnControl',{agentId:agent.id});
  const paused=latest;await command('startTask',{agent,previousRunId:paused.id,followup:'Read https://example.com again and save revision.md with one sentence and its URL.'});
 }
 await wait(()=>latest&&!['starting','running','pausing','stopping'].includes(latest.status));
 console.log('RESUME_RESULT',JSON.stringify({provider,status:latest.status,sameSession:latest.sessionId===previous.sessionId,sources:latest.sources.length,files:latest.artifacts.map(a=>a.name)}));
 if(latest.status!=='review'||latest.sessionId!==previous.sessionId||!latest.artifacts.some(a=>a.name==='revision.md'))process.exitCode=1;
} catch(e){console.error(e);process.exitCode=1;}
finally {await command('shutdown').catch(()=>{});child.stdin.end();setTimeout(()=>child.kill(),3000).unref();}
