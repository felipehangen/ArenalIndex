import {createRepository} from '../server/intake/blob.mjs';
import {createAdminHandler} from '../server/admin/core.mjs';
import {createGoogleVerifier} from '../server/admin/google.mjs';

export function application(env=process.env){
  const googleClientId=env.ADMIN_GOOGLE_CLIENT_ID||'';
  return createAdminHandler({
    repository:createRepository({storeId:env.BLOB_STORE_ID,token:env.BLOB_READ_WRITE_TOKEN}),
    verifyGoogle:createGoogleVerifier({clientId:googleClientId}),
    config:{googleClientId,adminEmails:(env.ADMIN_EMAILS||env.INTAKE_REVIEW_EMAIL||'').split(','),
      rateSalt:env.INTAKE_REVIEW_SECRET||'',siteURL:'https://arenalindex.com',
      publicAPIURL:'https://arenalindex-intake.vercel.app/api/listings',reviewEmail:env.INTAKE_REVIEW_EMAIL||''}
  });
}
export default async function handler(req,res){
  const body=typeof req.body==='string'?req.body:JSON.stringify(req.body||{});
  if(Buffer.byteLength(body)>250000){res.statusCode=413;res.end('Request too large');return;}
  const headers=new Headers();
  for(const [name,value] of Object.entries(req.headers))if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(','):value);
  const response=await application()(new Request('https://arenalindex-intake.vercel.app/api/admin',{
    method:req.method,headers,...(['GET','HEAD','OPTIONS'].includes(req.method)?{}:{body})
  }));
  res.statusCode=response.status;response.headers.forEach((value,key)=>res.setHeader(key,value));res.end(await response.text());
}
