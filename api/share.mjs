import {createRepository} from '../server/intake/blob.mjs';
import {createCatalog} from '../server/catalog/core.mjs';
import {supplementalDemos} from '../server/catalog/supplemental.mjs';
import {createShareHandler} from '../server/sharing/core.mjs';
import {shareOrigin} from '../server/sharing/links.mjs';

export default async function handler(req,res){
  const repository=createRepository({storeId:process.env.BLOB_STORE_ID,token:process.env.BLOB_READ_WRITE_TOKEN,deadline:Date.now()+20000});
  const catalog=createCatalog({repository,supplemental:supplementalDemos});
  const url=new URL(req.url,shareOrigin());
  // The rewrite passes a validated route, never an arbitrary destination URL.
  if(url.pathname==='/api/share')url.pathname='/p/'+(url.searchParams.get('code')||'')+(url.searchParams.get('image')==='1'?'/image.jpg':'');
  const response=await createShareHandler({published:async()=>{
    const [real,demo]=await Promise.all([repository.published(),catalog.published()]);return [...real,...demo];
  }})(new Request(url,{method:req.method}));
  res.statusCode=response.status;response.headers.forEach((value,key)=>res.setHeader(key,value));
  res.end(req.method==='HEAD'?'':Buffer.from(await response.arrayBuffer()));
}
