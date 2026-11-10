import {createRepository} from '../server/intake/blob.mjs';
import {createAnalyticsHandler} from '../server/analytics/core.mjs';
export default async function handler(req,res){
  const body=typeof req.body==='string'?req.body:JSON.stringify(req.body||{});
  if(Buffer.byteLength(body)>32768){res.statusCode=413;res.end('Request too large');return;}
  const headers=new Headers();for(const [name,value] of Object.entries(req.headers))if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(','):value);
  const repository=createRepository({storeId:process.env.BLOB_STORE_ID,token:process.env.BLOB_READ_WRITE_TOKEN,deadline:Date.now()+24000});
  const response=await createAnalyticsHandler({repository,config:{rateSalt:process.env.INTAKE_REVIEW_SECRET}})(new Request('https://arenalindex-intake.vercel.app/api/analytics',{method:req.method,headers,...(['GET','HEAD','OPTIONS'].includes(req.method)?{}:{body})}));
  res.statusCode=response.status;response.headers.forEach((value,key)=>res.setHeader(key,value));res.end(await response.text());
}
