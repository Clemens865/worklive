import test from 'node:test';
import assert from 'node:assert/strict';
import { cliEnvironment, subscriptionStatus, launchSpec, parseEvent } from './providers.mjs';
import { publicUrl, isPublicAddress, publicProxy } from './public-network.mjs';
import { request } from 'node:http';
import { validateTool } from './tool-definitions.mjs';

test('subscription checks distinguish personal plans from API and Console billing',()=>{
 assert.equal(subscriptionStatus('codex','','Logged in using ChatGPT').status,'ready');
 assert.equal(subscriptionStatus('codex','','Logged in using API key').status,'blocked');
 assert.equal(subscriptionStatus('claude',JSON.stringify({loggedIn:true,authMethod:'claude.ai',apiProvider:'firstParty',subscriptionType:'max'})).status,'ready');
 for(const auth of [{loggedIn:true,authMethod:'oauth',apiProvider:'firstParty',subscriptionType:'max'},{loggedIn:true,authMethod:'claude.ai',apiProvider:'bedrock',subscriptionType:'pro'}])assert.equal(subscriptionStatus('claude',JSON.stringify(auth)).status,'blocked');
 assert.notEqual(subscriptionStatus('claude','unparseable').status,'ready');
});
test('child environments discard API keys, overrides, credentials, and shell startup injection',()=>{
 const env=cliEnvironment({HOME:'/home/user',OPENAI_API_KEY:'secret',ANTHROPIC_API_KEY:'secret',ANTHROPIC_AUTH_TOKEN:'secret',OPENAI_BASE_URL:'https://other',CLAUDE_CODE_USE_BEDROCK:'1',NODE_OPTIONS:'--require /evil.js',BASH_ENV:'/evil.sh',CODEX_HOME:'/trusted-auth'});
 assert.equal(env.HOME,'/home/user');assert.equal(env.CODEX_HOME,'/trusted-auth');
 for(const key of ['OPENAI_API_KEY','ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','OPENAI_BASE_URL','CLAUDE_CODE_USE_BEDROCK','NODE_OPTIONS','BASH_ENV'])assert.equal(env[key],undefined);
});
test('launchers scope tools and resume one exact session without shell interpolation',()=>{
 const options={bridgePath:'/space here/bridge.mjs',socketPath:'/tmp/test.sock',token:'abc',sessionId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'};
 const c=launchSpec('codex',options),a=launchSpec('claude',options);
 assert.deepEqual(c.args.slice(0,3),['exec','resume',options.sessionId]);assert(c.args.includes('--ignore-user-config'));assert(c.args.includes('sandbox_mode="read-only"'));assert(c.args.includes('shell_tool'));assert(!c.args.includes('--last'));
 assert(a.args.includes('--restricted'));assert(a.args.includes('--strict-mcp-config'));assert.equal(a.args[a.args.indexOf('--tools')+1],'');assert.equal(a.args[a.args.indexOf('--resume')+1],options.sessionId);assert(!a.args.includes('--dangerously-skip-permissions'));
 assert.throws(()=>launchSpec('codex',{...options,sessionId:'--last'}));
});
test('parsers never confuse tool output or reasoning with final results',()=>{
 assert.equal(parseEvent('codex',{type:'item.completed',item:{type:'reasoning',text:'private'}}),null);
 assert.equal(parseEvent('codex',{type:'item.completed',item:{type:'agent_message',text:'hello'}}).text,'hello');
 assert(parseEvent('codex',{type:'turn.failed',error:{message:'quota'}}).error);
 assert(parseEvent('claude',{type:'result',is_error:true,result:'failure'}).error);
 assert.equal(parseEvent('claude',{type:'assistant',message:{content:[{type:'thinking',thinking:'private'},{type:'text',text:'hello'}]}}).text,'hello');
});
test('public research URLs reject local services, unsafe schemes and unusual ports',()=>{
 for(const url of ['http://127.0.0.1','http://2130706433','http://[::1]','http://10.1.1.1','http://local','http://device.local','file:///etc/passwd','https://user:pass@example.com','https://example.com:8443'])assert.throws(()=>publicUrl(url),url);
 for(const address of ['10.0.0.1','172.16.0.1','192.168.0.1','169.254.169.254','100.64.0.1','::ffff:127.0.0.1','2001:db8::1','2002:7f00:1::'])assert.equal(isPublicAddress(address),false,address);
 assert.equal(publicUrl('https://example.com/path').hostname,'example.com');assert.equal(isPublicAddress('1.1.1.1'),true);
});
test('proxy refuses private destinations at connection time',async()=>{
 const proxy=await publicProxy();
 try {
 const status=await new Promise((resolve,reject)=>{const req=request(proxy.url,{path:'http://127.0.0.1:80/',method:'GET'},res=>{res.resume();resolve(res.statusCode)});req.on('error',reject);req.end()});
 assert.equal(status,403);
 } finally {proxy.close()}
});
test('tool inputs cannot select another agent or write arbitrary paths',()=>{
 assert.throws(()=>validateTool('browser_read',{agentId:'other'}));
 assert.throws(()=>validateTool('shell',{command:'echo bad'}));
 assert.throws(()=>validateTool('browser_follow',{observationId:'id',linkId:'1'}));
});
