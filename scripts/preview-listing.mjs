import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {sampleListing} from '../tests/publication-fixture.mjs';
const root=new URL('../site/',import.meta.url).pathname,port=8767,origin='http://127.0.0.1:'+port;
const sample=sampleListing();
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,origin),send=(type,data)=>{res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(data);};
    if(url.pathname==='/config.js')return send('text/javascript','window.ArenalConfig='+JSON.stringify({supabaseUrl:origin,publishableKey:'preview',listingsUrl:origin+'/preview-listings'}));
    if(url.pathname==='/rest/v1/arenalindex_properties')return send('application/json','[]');
    if(url.pathname==='/preview-listings')return send('application/json',JSON.stringify([sample,{...sample,id:sample.id+'-crc',name:'Un jardín · ejemplo en colones',currency:'CRC',price:95000000}]));
    const filename=path.resolve(root,'.'+decodeURIComponent(url.pathname)+(url.pathname.endsWith('/')?'index.html':''));
    if(!filename.startsWith(path.resolve(root)+path.sep)){res.writeHead(403);return res.end();}
    send(mime[path.extname(filename)]||'application/octet-stream',await fs.readFile(filename));
  }catch{res.writeHead(404);res.end('No disponible');}
});
server.listen(port,'127.0.0.1',()=>console.log(origin+'/#propiedad/'+sample.id));
