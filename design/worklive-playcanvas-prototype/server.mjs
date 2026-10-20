import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.WORKLIVE_PROTOTYPE_PORT || 8775);
const origin = `http://127.0.0.1:${port}`;
const targets = [
  ['https://developer.playcanvas.com/user-manual/engine/', 'https://developer.playcanvas.com/user-manual/optimization/'],
  ['https://developer.mozilla.org/en-US/docs/Web/JavaScript', 'https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API'],
];
const allowedHosts = new Set(['developer.playcanvas.com','api.playcanvas.com','developer.mozilla.org','mdn.github.io']);
let browser = null, starting = null, closing = false, enabled = false, generation = 0, error = '', busy = false;
let pages = [], lastActive = Date.now();
const viewers = new Map();
const frames = [null, null];
const info = [{url:targets[0][0],title:'PlayCanvas documentation',index:0},{url:targets[1][0],title:'MDN Web Docs',index:0}];
const json = (res, code, data) => { res.writeHead(code, {'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); };
function audience() {
  const now=Date.now();
  for (const [id,v] of viewers) if(now-v.at>10000) viewers.delete(id);
  return [...viewers.values()].filter(v=>v.visible);
}
async function stop() {
  enabled=false; generation++;
  const old=browser; browser=null; pages=[];
  if(old) await old.close().catch(()=>{});
}
async function start() {
  if (enabled) return;
  if (starting) return starting;
  starting=(async()=>{
    const run=++generation;
    const executablePath=[process.env.WORKLIVE_CHROME_PATH,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Chromium.app/Contents/MacOS/Chromium'].filter(Boolean).find(existsSync);
    if(!executablePath) throw new Error('Google Chrome or Chromium is needed for the optional browser demo.');
    error='';
    const next=await chromium.launch({executablePath,headless:true});
    if(run!==generation) {await next.close();return;}
    browser=next;
    const context=await next.newContext({viewport:{width:1024,height:640},deviceScaleFactor:1,acceptDownloads:false,serviceWorkers:'block',permissions:[]});
    await context.route('**/*',async route=>{
      const request=route.request();
      try {
        const u=new URL(request.url());
        if(u.protocol!=='https:'||!allowedHosts.has(u.hostname)||!['GET','HEAD'].includes(request.method())) return await route.abort();
        await route.continue();
      } catch {await route.abort().catch(()=>{});}
    });
    await context.routeWebSocket('**/*',ws=>ws.close());
    for(let i=0;i<2;i++) {
      if(run!==generation) return;
      const page=await context.newPage(); pages.push(page);
      page.on('dialog',d=>void d.dismiss());
      page.on('popup',p=>void p.close());
      page.setDefaultTimeout(8000);
      await page.goto(targets[i][info[i].index],{waitUntil:'domcontentloaded',timeout:25000});
      info[i].url=page.url();info[i].title=await page.title();
    }
    if(run!==generation) return;
    enabled=true;lastActive=Date.now();
  })().catch(async e=>{error=e.message;await stop();throw e;}).finally(()=>{starting=null;});
  return starting;
}
const captureTimer=setInterval(async()=>{
  if(!enabled||busy) return;
  const active=audience();
  if(!active.length){if(Date.now()-lastActive>90000) await stop();return;}
  lastActive=Date.now();busy=true;
  try {
    for(let i=0;i<pages.length;i++) {
      const interval=active.some(v=>v.focus===i)?800:5000;
      if(frames[i]&&Date.now()-frames[i].at<interval)continue;
      const page=pages[i];
      const bytes=await page.screenshot({type:'jpeg',quality:65,timeout:5000});
      if(page!==pages[i]||!enabled)break;
      frames[i]={bytes,at:Date.now()};error='';
    }
  }catch(e){if(enabled)error=`Screen capture: ${e.message.split('\n')[0]}`;}
  finally{busy=false;}
},200);
const files = new Map([
 ['/', 'index.html'],['/index.html','index.html'],['/app.mjs','app.mjs'],['/simulation.mjs','simulation.mjs'],['/style.css','style.css'],
 ['/engine.mjs','node_modules/playcanvas/build/playcanvas.min.mjs'],['/favicon.ico',null],
]);
const server=http.createServer(async(req,res)=>{
 try {
  if(req.headers.host!==`127.0.0.1:${port}`)return json(res,403,{error:'Local prototype only.'});
  const url=new URL(req.url,origin);
  if(req.method==='OPTIONS')return json(res,403,{error:'Cross-origin access is disabled.'});
  if(url.pathname==='/api/control'){
    if(req.method!=='POST'||req.headers.origin!==origin||req.headers['x-worklive-demo']!=='1')return json(res,403,{error:'Use this prototype’s controls.'});
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2048)return json(res,413,{error:'Request too large.'});}
    const data=JSON.parse(raw);
    if(data.action==='heartbeat'){
      if(typeof data.id!=='string'||data.id.length>80)return json(res,400,{error:'Invalid viewer.'});
      if(viewers.size<16||viewers.has(data.id))viewers.set(data.id,{at:Date.now(),visible:data.visible===true,focus:data.focus===0?0:data.focus===1?1:-1});
    }else if(data.action==='start'){await start();}
    else if(data.action==='stop'){await stop();}
    else if(data.action==='navigate'){
      const i=data.agent;
      if(!enabled||![0,1].includes(i))return json(res,400,{error:'Start a browser demo first.'});
      info[i].index=1-info[i].index;
      await pages[i].goto(targets[i][info[i].index],{waitUntil:'domcontentloaded',timeout:25000});
      info[i].url=pages[i].url();info[i].title=await pages[i].title();frames[i]=null;
    }else return json(res,400,{error:'Unknown action.'});
    return json(res,200,{enabled,pages:pages.length,error});
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed.'});
  if(url.pathname==='/api/status')return json(res,200,{enabled,starting:!!starting,pages:pages.length,error,feeds:info.map((x,i)=>({...x,at:frames[i]?.at||0}))});
  const match=url.pathname.match(/^\/api\/frame\/(0|1)$/);
  if(match){const f=frames[Number(match[1])];if(!f){res.writeHead(204);return res.end();}res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'no-store','X-Frame-At':String(f.at)});return res.end(f.bytes);}
  if(!files.has(url.pathname))return json(res,404,{error:'Not found.'});
  const file=files.get(url.pathname);if(!file){res.writeHead(204);return res.end();}
  const path=join(root,file);const s=await stat(path);
  const type=file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript';
  res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`,'Content-Length':s.size,'Cache-Control':url.pathname==='/engine.mjs'?'public, max-age=86400':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'"});
  res.end(req.method==='HEAD'?undefined:await readFile(path));
 }catch(e){if(!res.headersSent)json(res,500,{error:e.message});else res.end();}
});
server.listen(port,'127.0.0.1',()=>console.log(`Worklive PlayCanvas prototype: ${origin}`));
async function shutdown(){if(closing)return;closing=true;clearInterval(captureTimer);await stop();server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),2000).unref();}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
