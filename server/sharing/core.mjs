import {createHash} from 'node:crypto';
import {shareCode,legacyShareCode,shareURL,shareOrigin,propertyURL} from './links.mjs';
import {fetchCover,publicCoverURL,renderShareImage} from './image.mjs';

const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number=value=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(value);
const imageVersion=row=>createHash('sha256').update(JSON.stringify([row.images?.[0]||'',row.is_demo===true,'card-v1'])).digest('hex').slice(0,12);

export function renderSharePage(row,origin=shareOrigin()){
  const url=shareURL(row.id,origin),destination=propertyURL(row.id),title=row.name;
  const price=row.price!==null&&row.price!==undefined&&Number.isFinite(Number(row.price))?number(Number(row.price))+' '+(row.currency||'USD'):'';
  const description=[row.is_demo===true?'DEMO':null,price,row.place,Number(row.area)>0?number(Number(row.area))+' m²':null].filter(Boolean).join(' · ');
  const image=url+'/image.jpg?v='+imageVersion(row);
  const script='location.replace('+JSON.stringify(destination)+');';
  const scriptHash=createHash('sha256').update(script).digest('base64');
  const html=`<!doctype html><html lang="${row.details?.language==='en'?'en':'es'}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)} · Arenal Index</title><meta name="description" content="${escape(description)}">
<link rel="canonical" href="${escape(url)}"><meta name="robots" content="noindex,follow">
<meta property="og:type" content="website"><meta property="og:site_name" content="Arenal Index">
<meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${escape(url)}"><meta property="og:image" content="${escape(image)}">
<meta property="og:image:secure_url" content="${escape(image)}"><meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escape(title)} · Arenal Index">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}">
<meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${escape(image)}">
<style>body{margin:0;background:#f0f5ee;color:#24362b;font:17px system-ui,sans-serif}main{max-width:680px;margin:48px auto;padding:24px}img{width:100%;border-radius:16px}a{color:#285a3d}h1{font-size:28px}small{letter-spacing:2px}</style>
</head><body><main><small>ARENAL INDEX</small><h1>${escape(title)}</h1><p>${escape(description)}</p><a href="${escape(destination)}"><img src="${escape(image)}" alt="${escape(title)}"><p>Ver propiedad · View property →</p></a></main><script>${script}</script></body></html>`;
  return {html,csp:`default-src 'none'; img-src https:; style-src 'unsafe-inline'; script-src 'sha256-${scriptHash}'; base-uri 'none'; frame-ancestors 'none'`};
}

export function createShareHandler({published,origin=shareOrigin(),fetchImage=fetchCover,renderImage=renderShareImage,codeFor=shareCode}){
  return async request=>{
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, follow'};
    const error=(status,message)=>new Response(request.method==='HEAD'?null:message,{status,headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}});
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{...headers,Allow:'GET, HEAD'}});
    const url=new URL(request.url),legacy=url.pathname.startsWith('/p/');
    const match=url.pathname.match(legacy? /^\/p\/([A-Za-z0-9_-]{10})(\/image\.jpg)?\/?$/ : /^\/([A-Z][0-9][A-Za-z0-9]{4})(\/image\.jpg)?\/?$/);
    if(!match)return error(404,'Propiedad no disponible · Property unavailable');
    try{
      const rows=await published(),matches=rows.filter(row=>(legacy?legacyShareCode:codeFor)(row.id)===match[1]);
      // Never let an alias collision open a different property.
      if(matches.length>1)return error(409,'Enlace no disponible · Link unavailable');
      if(!matches.length)return error(404,'Propiedad no disponible · Property unavailable');
      const row=matches[0];
      if(match[2]){
        if(request.method==='HEAD')return new Response(null,{headers:{...headers,'Content-Type':'image/jpeg'}});
        const cover=row.images?.[0];
        const bytes=publicCoverURL(cover)?await fetchImage(cover):null;
        // Failed downloads are retryable errors, not cacheable placeholder photos.
        const image=await renderImage(bytes,{demo:row.is_demo===true});
        return new Response(image,{headers:{...headers,'Content-Type':'image/jpeg','Content-Length':String(image.length)}});
      }
      const page=renderSharePage(row,origin);
      return new Response(request.method==='HEAD'?null:page.html,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':page.csp}});
    }catch{return error(503,'Intentá de nuevo · Please try again');}
  };
}
