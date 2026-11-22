import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fetchCover,publicCoverURL,renderShareImage} from './image.mjs';

export const collectionShareRoute=/^\/collection\/([a-z0-9][a-z0-9-]{0,99})(\/image\.jpg)?\/?$/;

const escape=value=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const loadExplorer=()=>readFile(new URL('../../site/index.html',import.meta.url),'utf8');

function collectionCard({account,listings},slug,origin){
  const real=listings.filter(listing=>listing.is_demo!==true);
  const demo=listings.length>0&&!real.length;
  // Only use covers from this collection, and never illustrate live inventory with a demo.
  const cover=(demo?listings:real).find(listing=>publicCoverURL(listing.images?.[0]))?.images[0]??null;
  const version=createHash('sha256').update(JSON.stringify(['collection-v1',cover,demo])).digest('hex').slice(0,12);
  const url=origin+'/collection/'+slug+'/';
  return {
    title:'Terrenos en La Fortuna · '+account.name,
    description:demo?'Colección de demostración de '+account.name+'.':'Propiedades de '+account.name+' en La Fortuna y alrededores.',
    url,
    image:url+'image.jpg?v='+version,
    cover,
    demo
  };
}

function collectionHTML(explorer,card){
  const title=escape(card.title),description=escape(card.description),url=escape(card.url),image=escape(card.image);
  const head=`<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${url}"><meta name="robots" content="noindex,follow">
<meta property="og:type" content="website"><meta property="og:site_name" content="Arenal Index">
<meta property="og:title" content="${title}"><meta property="og:description" content="${description}">
<meta property="og:url" content="${url}"><meta property="og:image" content="${image}">
<meta property="og:image:secure_url" content="${image}"><meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${title}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${image}">`;
  return explorer
    .replace(/<title>[^<]*<\/title>\s*<meta name="description"[^>]*>\s*<link rel="canonical"[^>]*>/,()=>head);
}

export function createCollectionShareHandler({
  publicCollection,origin,explorer=loadExplorer,fetchImage=fetchCover,renderImage=renderShareImage
}){
  return async request=>{
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, follow'};
    const content=(body,status,type)=>new Response(request.method==='HEAD'?null:body,{status,headers:{...headers,'Content-Type':type}});
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{...headers,Allow:'GET, HEAD'}});
    const match=new URL(request.url).pathname.match(collectionShareRoute);
    const plain='text/plain; charset=utf-8',html='text/html; charset=utf-8';
    if(!match)return content('Colección no disponible.',404,plain);
    const [,slug,image]=match;
    let page;
    try{
      page=await publicCollection(slug);
    }catch{
      // The interactive explorer can still show its retry control when the lookup fails.
      return image?content('Intentá de nuevo.',503,plain):content(await explorer(),503,html);
    }
    if(!page)return image?content('Colección no disponible.',404,plain):content(await explorer(),404,html);
    const card=collectionCard(page,slug,origin);
    if(!image)return content(collectionHTML(await explorer(),card),200,html);
    if(request.method==='HEAD')return content(null,200,'image/jpeg');
    try{
      const bytes=card.cover?await fetchImage(card.cover):null;
      return content(await renderImage(bytes,{demo:card.demo}),200,'image/jpeg');
    }catch{return content('Intentá de nuevo.',503,plain);}
  };
}
