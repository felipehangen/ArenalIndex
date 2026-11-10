import {createCatalog} from '../catalog/core.mjs';
import {createRepository} from '../intake/blob.mjs';
import {createMailer} from '../intake/services.mjs';
import {createGoogleVerifier} from '../admin/google.mjs';
import {createLocalityResolver} from '../intake/locality.mjs';
export function portalOptions(env){
  const repository=createRepository({storeId:env.BLOB_STORE_ID,token:env.BLOB_READ_WRITE_TOKEN});
  const googleClientId=env.ADMIN_GOOGLE_CLIENT_ID||'',key=env.RESEND_API_KEY||'',from=env.INTAKE_EMAIL_FROM||'',to=env.INTAKE_REVIEW_EMAIL||'',reviewSecret=env.INTAKE_REVIEW_SECRET||'';
  return {repository,catalog:createCatalog({repository}),mailer:createMailer({key,from,to}),verifyGoogle:createGoogleVerifier({clientId:googleClientId}),resolveLocality:createLocalityResolver({repository}),config:{googleClientId,adminEmails:(env.ADMIN_EMAILS||to).split(','),reviewEmail:to,reviewSecret,rateSalt:reviewSecret,siteURL:'https://arenalindex.com',publicAPIURL:'https://arenalindex-intake.vercel.app/api/listings',emailReady:!!(env.BLOB_STORE_ID||env.BLOB_READ_WRITE_TOKEN)&&!!key&&!!from&&!!to&&reviewSecret.length>=32}};
}
export async function serve(req,res,application){
  const body=typeof req.body==='string'?req.body:JSON.stringify(req.body||{});
  if(Buffer.byteLength(body)>250000){res.statusCode=413;res.end('Request too large');return;}
  const headers=new Headers();for(const [name,value] of Object.entries(req.headers))if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(','):value);
  const response=await application()(new Request('https://arenalindex-intake.vercel.app/api/private',{method:req.method,headers,...(['GET','HEAD','OPTIONS'].includes(req.method)?{}:{body})}));
  res.statusCode=response.status;response.headers.forEach((value,key)=>res.setHeader(key,value));res.end(await response.text());
}
