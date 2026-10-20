import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const base = '/Users/clemenshoenig/Documents/Codex/2026-09-30/i-w';
const data = await mkdtemp(join(base, 'work/cli-smoke-'));
const child = spawn(process.execPath,[join(base,'outputs/worklive/worker/main.mjs'),data],{stdio:['pipe','pipe','pipe']});
const pending=new Map(), states=new Map();let seq=0;
child.stderr.on('data',c=>process.stderr.write(c));
createInterface({input:child.stdout}).on('line',line=>{
 const e=JSON.parse(line);
 if(e.type==='reply'){const p=pending.get(e.id);pending.delete(e.id);if(p)e.ok?p.resolve(e.result):p.reject(new Error(e.error));}
 if(e.type==='run'){const old=states.get(e.agentId);states.set(e.agentId,e.run);if(old?.message!==e.run.message||old?.status!==e.run.status) console.log(e.agentId,e.run.status,e.run.message);}
});
function command(action, extra={}){return new Promise((resolve,reject)=>{const id=++seq;const timeout=setTimeout(()=>reject(new Error('command timed out '+action)),50000); pending.set(id,{resolve:x=>{clearTimeout(timeout);resolve(x)},reject:e=>{clearTimeout(timeout);reject(e)}});child.stdin.write(JSON.stringify({action,id,...extra})+'\n');});}
const agents=['codex'].map(provider=>({id:'test-'+provider,name:'Test '+provider,provider,role:'Researcher',personality:'Concise and factual.',task:'Open https://example.com using the Worklive browser. Read it. Save example-summary.md with a two-sentence summary and its exact source URL. Do not follow further links.'}));
try {
 console.log('DATA', data);
 console.log('PROVIDERS',JSON.stringify(await command('providers')));
 for(const agent of agents){await command('ensure',{agentId:agent.id});await command('startTask',{agent});}
 const until=Date.now()+180000;
 while(Date.now()<until){if(agents.every(a=>states.has(a.id)&&!['starting','running','pausing','stopping'].includes(states.get(a.id).status)))break;await new Promise(r=>setTimeout(r,500));}
 const report=[];
 for(const agent of agents){const r=states.get(agent.id);if(r&&['starting','running'].includes(r.status))await command('stopTask',{agentId:agent.id}); const result=states.get(agent.id); report.push(result);console.log('RESULT',agent.provider,JSON.stringify({status:result?.status,session:result?.sessionId,sources:result?.sources.length,files:result?.artifacts.map(a=>a.name),actions:result?.actions,text:result?.text}));}
 await writeFile(join(data,'report.json'),JSON.stringify(report,null,2));
 if(report.some(r=>r.status!=='review'||r.sources.length<1||!r.artifacts.some(a=>a.name==='example-summary.md')))process.exitCode=1;
} catch(e){console.error(e);process.exitCode=1;}
finally {await command('shutdown').catch(()=>{});child.stdin.end();setTimeout(()=>child.kill(),3000).unref();}
