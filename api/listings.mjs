import {createCatalog} from '../server/catalog/core.mjs';
import {supplementalDemos} from '../server/catalog/supplemental.mjs';
import {createRepository} from '../server/intake/blob.mjs';
import {createPublicHandler} from '../server/intake/public.mjs';
import {waitUntil} from '@vercel/functions';

export default async function handler(req,res){
  const repository=createRepository({storeId:process.env.BLOB_STORE_ID,token:process.env.BLOB_READ_WRITE_TOKEN});
  const response=await createPublicHandler(repository,{catalog:createCatalog({repository,supplemental:supplementalDemos}),defer:waitUntil})(new Request('https://arenalindex.com'+req.url,{method:req.method}));
  res.statusCode=response.status;response.headers.forEach((value,key)=>res.setHeader(key,value));
  res.end(req.method==='HEAD'?'':await response.text());
}
