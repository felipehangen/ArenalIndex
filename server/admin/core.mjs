import {randomBytes,createHash} from 'node:crypto';
import {recordSummary} from '../portal/summary.mjs';
export {recordSummary} from '../portal/summary.mjs';
import {createHandler} from '../intake/core.mjs';
import {workspaceAction} from '../portal/workspace.mjs';
import {accountAdminAction} from '../portal/accounts.mjs';
import {analyticsReport} from '../analytics/core.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const secret=()=>randomBytes(32).toString('hex');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const reviewActions=new Set(['review','approve','request_changes','preview_publication','publish','unpublish']);
export function createAdminHandler({repository,verifyGoogle,config,mailer,resolveLocality,catalog,now=()=>new Date()}){
  const origins=new Set(config.origins||['https://arenalindex.com','https://www.arenalindex.com']);
  const allowed=new Set((config.adminEmails||[]).map(email=>email.trim().toLowerCase()).filter(Boolean));
  const configured=!!config.googleClientId&&allowed.size>0;
  return async request=>{
    const origin=request.headers.get('Origin');
    const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
    if(origin&&origins.has(origin))headers['Access-Control-Allow-Origin']=origin;
    const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
    if(origin&&!origins.has(origin))return json({error:'Origen no autorizado.'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type,authorization'}});
    if(request.method!=='POST')return json({error:'Método no permitido.'},405);
    try{
      const raw=await request.text();if(raw.length>250000)fail(413,'Solicitud demasiado grande.');
      const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'Solicitud inválida.');
      const {action}=body;
      if(action==='config')return json({configured,clientId:configured?config.googleClientId:null});
      if(!configured)fail(503,'El acceso con Google todavía no está configurado.');
      if(action==='challenge'||action==='login'){
        const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
        if(!await repository.allow('admin-login:'+hash(ip+config.rateSalt),30))fail(429,'Demasiados intentos. Intentá más tarde.');
        if(action==='challenge'){
          const nonce=secret();await repository.authCreate('challenge',hash(nonce),{used:false,expiresAt:now().getTime()+10*60000});
          return json({nonce});
        }
        if(!/^[a-f0-9]{64}$/.test(body.nonce||'')||typeof body.credential!=='string'||body.credential.length>10000)fail(401,'No se pudo verificar el acceso con Google.');
        const challenge=await repository.authGet('challenge',hash(body.nonce));
        if(!challenge||challenge.used||challenge.expiresAt<=now().getTime())fail(401,'El inicio de sesión venció. Intentá de nuevo.');
        let identity;try{identity=await verifyGoogle(body.credential,body.nonce);}catch{fail(401,'No se pudo verificar el acceso con Google.');}
        if(!allowed.has(identity.email))fail(403,'Esta cuenta no tiene acceso de administrador.');
        if(!await repository.authUpdate('challenge',hash(body.nonce),{used:false},{used:true}))fail(401,'El inicio de sesión ya se utilizó. Intentá de nuevo.');
        const token=secret(),expiresAt=now().getTime()+8*3600000;
        await repository.authCreate('session',hash(token),{...identity,expiresAt,revoked:false});
        return json({token,email:identity.email,expiresAt});
      }
      const token=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
      if(!token)fail(401,'Iniciá sesión para continuar.');
      const session=await repository.authGet('session',hash(token));
      if(!session||session.revoked||session.expiresAt<=now().getTime()||!allowed.has(session.email))fail(401,'Tu sesión venció. Volvé a entrar con Google.');
      if(!await repository.allow('admin-session:'+hash(token),300))fail(429,'Demasiadas solicitudes. Intentá más tarde.');
      if(action==='logout'){
        const revoked=await repository.authUpdate('session',hash(token),{revoked:false},{revoked:true});
        if(!revoked&&!(await repository.authGet('session',hash(token)))?.revoked)fail(503,'No se pudo cerrar la sesión. Intentá de nuevo.');
        return json({signedOut:true});
      }
      if(action==='session')return json({email:session.email,expiresAt:session.expiresAt});
      if(action==='analytics')return json(await analyticsReport({repository,catalog,body,now:now()}));
      if(action==='health')return json({ready:config.emailReady});
      if(['create_account','owner_accounts','set_owner_password','set_owner_active','set_owner_name'].includes(action))return json(await accountAdminAction({action,body,repository,actor:session,now}));
      if(['workspace_open','workspace_save_prepare','workspace_save_commit','workspace_submit','workspace_status','workspace_reopen_owner','workspace_unlist','workspace_delete'].includes(action))return json(await workspaceAction({action,body,actor:{...session,role:'admin'},repository,config,mailer,now}));
      if(typeof action==='string'&&action.startsWith('catalog_')&&catalog)return json(await catalog.action(action,body,session));
      if(action==='list'){
        if(body.cursor!==undefined&&(typeof body.cursor!=='string'||body.cursor.length>2000))fail(400,'Página inválida.');
        const [page,demos]=await Promise.all([repository.records(body.cursor),!body.cursor&&catalog?catalog.list():[]]);
        return json({records:[...page.records.filter(row=>row.status!=='deleted').map(recordSummary),...demos],cursor:page.cursor});
      }
      if(reviewActions.has(action)){
        // Identity is passed through a server-only closure; headers cannot grant this privilege.
        const handler=createHandler({repository,config,now,resolveLocality,authorizeReview:async()=>session});
        const delegated=new Request(request.url,{method:'POST',headers:request.headers,body:raw});
        const response=await handler(delegated);
        for(const [key,value] of Object.entries(headers))response.headers.set(key,value);
        return response;
      }
      fail(400,'Acción no reconocida.');
    }catch(error){
      return json({error:error.status?error.message:error instanceof SyntaxError?'Solicitud inválida.':'No se pudo completar la operación. Intentá de nuevo.'},error.status||(error instanceof SyntaxError?400:500));
    }
  };
}
