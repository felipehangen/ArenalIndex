import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {proposalSummary} from '../site/offer/view.mjs';
import {sampleListing} from '../tests/publication-fixture.mjs';
const root=fileURLToPath(new URL('../site/',import.meta.url)),port=8767,origin='http://127.0.0.1:'+port;
const sample=sampleListing();
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,origin),send=(type,data)=>{res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(data);};
    if(['/offer-preview/','/offer/'].includes(url.pathname))return send('text/html',(await fs.readFile(new URL('../site/offer/index.html',import.meta.url),'utf8')).replace('/offer/app.mjs?v=8','/preview-offer.mjs'));
    if(url.pathname==='/preview-offer.mjs'){
      const property={id:sample.id,name:sample.name,place:sample.place,currency:sample.currency,price:sample.price,area:sample.area,image:sample.images[0],images:sample.images,photoGroups:sample.details.photoGroups,photoBuildingNames:sample.details.buildings.map(b=>b.name),contact:{...sample.details.contact,whatsapp:'+12025550142'},isDemo:true,titles:{es:sample.name,en:'A garden near the volcano'}};
      return send('text/javascript',`const root=document.querySelector('#offer-root');root.removeAttribute('id');
        const {mountOffer}=await import('/offer/app.mjs?v=8');root.id='offer-root';
        const record=${JSON.stringify({property,broker:'ArenalIndex · Demo',propertyVersion:'preview'})};
        if(!location.hash)history.replaceState({},'', '#l.AAAAAAAAAAAAAAAAAAAAAA');
        const receive=offer=>{
          const receiptToken='receipt.'+Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('')+'.'+'d'.repeat(64);
          const receipt={...record,receiptURL:location.origin+'/offer/#'+receiptToken,revision:1,versions:[{revision:1,offer,submittedAt:new Date().toISOString()}]};
          localStorage.setItem('arenalindex.preview-receipt:'+receiptToken,JSON.stringify(receipt));return receipt;
        };
        mountOffer({document,window,api:async(action,body)=>{
          if(action==='offer_form_open')return new URLSearchParams(location.search).has('sent')?receive({schema:2,amount:'170000',currency:'USD',name:'Demo Buyer',contact:'buyer@example.test',replyMethod:'email',message:'Subject to a property inspection.'}):record;
          if(action==='offer_receipt')return JSON.parse(localStorage.getItem('arenalindex.preview-receipt:'+location.hash.slice(1)));
          if(action==='offer_form_submit')return receive(body.offer);
          throw Error('Local preview only');
        }});`);
    }
    if(url.pathname==='/offer-print-preview/'){
      const language=url.searchParams.get('language')==='es'?'es':'en',long=url.searchParams.has('long');
      const property={name:sample.name,titles:{en:'A garden near the volcano'},place:sample.place,isDemo:true};
      const offer={schema:2,amount:'170000',currency:language==='es'?'CRC':'USD',name:'Demo Buyer',contact:'buyer@example.test',replyMethod:'email',message:long?('Condición de prueba: inspección de la propiedad y revisión de documentos.\n'.repeat(28)).slice(0,2000):'Subject to a property inspection.\nPlease include the garden furniture.'};
      const proposal=proposalSummary({property,broker:'ArenalIndex · Demo',offer,version:{submittedAt:'2026-11-11T21:00:00Z'},language});
      return send('text/html','<!doctype html><html lang="'+language+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offer copy · ArenalIndex</title><link rel="stylesheet" href="/admin/style.css"><link rel="stylesheet" href="/offer/style.css?v=8"></head><body><main class="offer-main offer-experience" data-stage="copy"><section class="offer-desk offer-private-copy">'+proposal+'</section></main></body></html>');
    }
    if(url.pathname==='/config.js')return send('text/javascript','window.ArenalConfig='+JSON.stringify({supabaseUrl:origin,publishableKey:'preview',listingsUrl:origin+'/preview-listings'}));
    if(url.pathname==='/rest/v1/arenalindex_properties')return send('application/json','[]');
    if(url.pathname==='/preview-listings')return send('application/json',JSON.stringify([sample,{...sample,id:sample.id+'-crc',name:'Un jardín · ejemplo en colones',currency:'CRC',price:95000000}]));
    const filename=path.resolve(root,'.'+decodeURIComponent(url.pathname)+(url.pathname.endsWith('/')?'index.html':''));
    if(!filename.startsWith(path.resolve(root)+path.sep)){res.writeHead(403);return res.end();}
    send(mime[path.extname(filename)]||'application/octet-stream',await fs.readFile(filename));
  }catch{res.writeHead(404);res.end('No disponible');}
});
server.listen(port,'127.0.0.1',()=>console.log(origin+'/#propiedad/'+sample.id+'\n'+origin+'/offer-preview/'));
