import {createHandler} from '../server/intake/core.mjs';
import {createRepository} from '../server/intake/blob.mjs';
import {createMailer} from '../server/intake/services.mjs';

export function application(env=process.env){
  const storeId=env.BLOB_STORE_ID,token=env.BLOB_READ_WRITE_TOKEN;
  const emailKey=env.RESEND_API_KEY||'',from=env.INTAKE_EMAIL_FROM||'',to=env.INTAKE_REVIEW_EMAIL||'';
  const reviewSecret=env.INTAKE_REVIEW_SECRET||'';
  return createHandler({
    repository:createRepository({storeId,token}),
    mailer:createMailer({key:emailKey,from,to}),
    config:{siteURL:'https://arenalindex.com',publicAPIURL:'https://arenalindex-intake.vercel.app/api/listings',reviewEmail:to,reviewSecret,rateSalt:reviewSecret,emailReady:!!(storeId||token)&&!!emailKey&&!!from&&!!to&&reviewSecret.length>=32}
  });
}
export default async function handler(req,res){
  let body=typeof req.body==='string'?req.body:JSON.stringify(req.body||{});
  if(Buffer.byteLength(body)>250000){res.statusCode=413;res.end('Request too large');return;}
  const headers=new Headers();
  for(const [name,value] of Object.entries(req.headers))if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(','):value);
  const request=new Request('https://arenalindex.com/api/intake',{method:req.method,headers,...(['GET','HEAD','OPTIONS'].includes(req.method)?{}:{body})});
  const response=await application()(request);
  res.statusCode=response.status;response.headers.forEach((value,key)=>res.setHeader(key,value));
  res.end(await response.text());
}
