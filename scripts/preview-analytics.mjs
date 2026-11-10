// Development-only preview. Sample activity is generated in memory and is never uploaded.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {previewReport} from '../tests/analytics-fixture.mjs';
const root=fileURLToPath(new URL('../site/',import.meta.url)),port=8768,origin='http://127.0.0.1:'+port;
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
  const send=(type,data)=>{res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(data);};
  try{
    const url=new URL(req.url,origin);
    if(url.pathname==='/sample-analytics')return send('application/json',JSON.stringify(previewReport(Object.fromEntries(url.searchParams))));
    if(url.pathname==='/admin/app.mjs')return send('text/javascript',`
      import {mountAnalytics} from '/admin/analytics.mjs';
      document.querySelector('#login-panel').hidden=true;
      document.querySelector('#inbox').hidden=false;
      document.querySelector('#listings-panel').hidden=true;
      document.querySelector('.workspace-heading h1').textContent='Analytics preview';
      document.querySelector('.workspace-heading .muted').textContent='Sample data · local preview only';
      document.querySelector('#analytics-panel').hidden=false;
      for(const tab of document.querySelectorAll('[data-panel]')){tab.removeAttribute('aria-current');tab.onclick=()=>{};}
      document.querySelector('[data-panel=analytics]').setAttribute('aria-current','page');
      const api={session:()=>({}),request:async(action,body)=>{const response=await fetch('/sample-analytics?'+new URLSearchParams(body));if(!response.ok)throw Error('Preview unavailable');return response.json();}};
      mountAnalytics({document,window,api,controller:{expire(){}},now:()=>Date.parse('2026-11-10T20:00:00Z')});
      window.dispatchEvent(new CustomEvent('arenal-admin-panel',{detail:'analytics'}));
    `);
    const filename=path.resolve(root,'.'+decodeURIComponent(url.pathname)+(url.pathname.endsWith('/')?'index.html':''));
    if(!filename.startsWith(path.resolve(root)+path.sep)){res.writeHead(403);res.end();return;}
    send(mime[path.extname(filename)]||'application/octet-stream',await fs.readFile(filename));
  }catch{res.writeHead(404);res.end('Not available');}
});
server.listen(port,'127.0.0.1',()=>console.log(origin+'/admin/'));
