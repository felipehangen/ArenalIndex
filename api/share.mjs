import {createRepository} from '../server/intake/blob.mjs';
import {createCatalog} from '../server/catalog/core.mjs';
import {supplementalDemos} from '../server/catalog/supplemental.mjs';
import {createShareHandler} from '../server/sharing/core.mjs';
import {collectionShareRoute,createCollectionShareHandler} from '../server/sharing/collection.mjs';
import {shareOrigin} from '../server/sharing/links.mjs';
import {publicAccountPage} from '../server/portal/public-page.mjs';

export default async function handler(req,res){
  const repository=createRepository({storeId:process.env.BLOB_STORE_ID,token:process.env.BLOB_READ_WRITE_TOKEN,deadline:Date.now()+20000});
  const catalog=createCatalog({repository,supplemental:supplementalDemos});
  const origin=shareOrigin(),url=new URL(req.url,origin);
  const collection=url.pathname==='/api/share'?url.searchParams.get('collection'):null;
  // The rewrite passes a validated route, never an arbitrary destination URL.
  if(collection!==null)url.pathname='/collection/'+encodeURIComponent(collection)+(url.searchParams.get('image')==='1'?'/image.jpg':'/');
  else if(url.pathname==='/api/share')url.pathname=(url.searchParams.get('legacy')==='1'?'/p/':'/')+(url.searchParams.get('code')||'')+(url.searchParams.get('offer')==='1'?'/offer':'')+(url.searchParams.get('image')==='1'?'/image.jpg':'');
  const share=collection!==null||collectionShareRoute.test(url.pathname)?createCollectionShareHandler({
    origin,publicCollection:slug=>publicAccountPage(repository,slug,{catalog})
  }):createShareHandler({published:async()=>{
    const [real,demo]=await Promise.all([repository.published(),catalog.published()]);return [...real,...demo];
  }});
  const response=await share(new Request(url,{method:req.method}));
  res.statusCode=response.status;response.headers.forEach((value,key)=>res.setHeader(key,value));
  res.end(req.method==='HEAD'?'':Buffer.from(await response.arrayBuffer()));
}
