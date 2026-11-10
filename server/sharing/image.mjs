import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import {SITE_ORIGIN,API_ORIGIN} from './links.mjs';

const MAX_BYTES=12*1024*1024;
export function publicCoverURL(value){
  if(typeof value!=='string'||!value)return null;
  try{
    const url=new URL(value,SITE_ORIGIN);
    if(url.username||url.password||url.hash)return null;
    if(url.origin===SITE_ORIGIN&&/^\/photos\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(url.pathname)&&!url.search)return url;
    if(url.origin===API_ORIGIN&&url.pathname==='/api/listings'&&
      /^[a-zA-Z0-9-]{8,80}$/.test(url.searchParams.get('id')||'')&&
      /^[a-zA-Z0-9-]{1,100}$/.test(url.searchParams.get('photo')||'')&&
      /^\d+$/.test(url.searchParams.get('version')||'')&&
      [...url.searchParams.keys()].every(key=>['id','photo','version'].includes(key)))return url;
  }catch{}
  return null;
}

export async function fetchCover(value,{fetcher=fetch}={}){
  let url=publicCoverURL(value);
  if(!url)throw Error('No supported public cover');
  const signal=AbortSignal.timeout(10000);
  for(let hop=0;hop<3;hop++){
    const response=await fetcher(url,{redirect:'manual',signal});
    if([301,302,303,307,308].includes(response.status)){
      const next=new URL(response.headers.get('location'),url);
      await response.body?.cancel();
      // Public-photo authorization may delegate to private Blob storage. Never
      // follow arbitrary destinations from catalog data or an HTTP redirect.
      if(next.protocol!=='https:'||next.username||next.password||next.port||
        !/^[a-z0-9-]+\.(?:public|private)\.blob\.vercel-storage\.com$/.test(next.hostname))throw Error('Invalid photo redirect');
      url=next;continue;
    }
    if(!response.ok||!/^image\/(jpeg|png|webp)(;|$)/i.test(response.headers.get('content-type')||'')||Number(response.headers.get('content-length'))>MAX_BYTES){
      await response.body?.cancel();throw Error('Photo unavailable');
    }
    const reader=response.body.getReader(),chunks=[];let length=0;
    try{
      while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>MAX_BYTES)throw Error('Photo too large');chunks.push(value);}
    }finally{await reader.cancel();}
    return Buffer.concat(chunks,length);
  }
  throw Error('Too many photo redirects');
}

export async function renderShareImage(bytes,{demo=false}={}){
  const background=bytes?await sharp(bytes,{limitInputPixels:40000000,failOn:'warning'}).rotate().resize(1200,630,{fit:'cover',position:'centre'}).flatten({background:'#f0f5ee'}).toBuffer():null;
  const base=background?sharp(background):sharp({create:{width:1200,height:630,channels:3,background:'#e6eee5'}});
  // Raster wordmarks make production independent of server-installed fonts.
  const brand=await readFile(new URL('./assets/brand.png',import.meta.url));
  const overlays=[{input:brand,left:445,top:527}];
  if(demo)overlays.push({input:await readFile(new URL('./assets/demo.png',import.meta.url)),left:475,top:28});
  if(!bytes)overlays.push({input:await readFile(new URL('./assets/no-photo.png',import.meta.url)),left:360,top:230});
  return base.composite(overlays).jpeg({quality:82,mozjpeg:true}).toBuffer();
}
