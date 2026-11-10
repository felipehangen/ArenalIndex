import {randomBytes,createHash} from 'node:crypto';
import {recordSummary} from './summary.mjs';
import {workspaceAction} from './workspace.mjs';
import {findAccount,googleAccount,normalizeEmail,verifyPassword,changePassword} from './accounts.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const secret=()=>randomBytes(32).toString('hex');
export async function invitationAction({action,body,repository,actor,now}){
  if(action==='invitations')return {invitations:(await repository.invitations()).map(({id,label,active,createdAt})=>({id,label,active,createdAt}))};
  if(action==='create_invitation'){
    const code=randomBytes(15).toString('base64url'),id=hash(code),row={id,label:String(body.label||'Invitación de propietarios').trim().slice(0,80),active:true,createdAt:now().toISOString(),createdBy:actor.email};
    await repository.portalCreate('invites',id,row);return {code,invitation:row};
  }
  if(action==='revoke_invitation'){
    if(!/^[a-f0-9]{64}$/.test(body.id||''))fail(400,'Invitación inválida.');
    const updated=await repository.portalUpdate('invites',body.id,{active:true},{active:false,revokedAt:now().toISOString()});
    if(!updated)fail(409,'La invitación ya cambió. Actualizá la lista.');return {revoked:true};
  }
  fail(400,'Acción no reconocida.');
}
export function createOwnerHandler({repository,verifyGoogle,config,mailer,now=()=>new Date()}){
  const origins=new Set(config.origins||['https://arenalindex.com','https://www.arenalindex.com']);
  return async request=>{
    const origin=request.headers.get('Origin'),headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
    if(origins.has(origin))headers['Access-Control-Allow-Origin']=origin;
    const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
    if(origin&&!origins.has(origin))return json({error:'Origen no autorizado.'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type,authorization'}});
    if(request.method!=='POST')return json({error:'Método no permitido.'},405);
    try{
      const raw=await request.text();if(raw.length>250000)fail(413,'Solicitud demasiado grande.');
      const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'Solicitud inválida.');
      const action=body.action;
      if(action==='config')return json({configured:!!config.googleClientId,clientId:config.googleClientId||null,passwordEnabled:true});
      const startSession=async(account,method)=>{
        const token=secret(),expiresAt=now().getTime()+8*3600000;
        await repository.authCreate('owner-session',hash(token),{subject:account.subject,email:account.email,method,passwordVersion:method==='password'?account.password_version:null,accountVersion:account.session_version||0,role:'owner',expiresAt,revoked:false});
        return json({token,email:account.email,expiresAt,method,requiresPasswordChange:method==='password'&&!!account.mustChangePassword});
      };
      if(['challenge','login','login_password'].includes(action)){
        const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
        if(!await repository.allow('owner-login:'+hash(ip+config.rateSalt),40))fail(429,'Demasiados intentos. Intentá más tarde.');
        if(action==='login_password'){
          const email=normalizeEmail(body.email);
          if(email.length>254)fail(401,'El correo o la contraseña no coinciden, o el acceso venció.');
          if(!await repository.allow('owner-password:'+hash(email+config.rateSalt),12))fail(429,'Demasiados intentos. Intentá más tarde.');
          const account=await findAccount(repository,email),valid=await verifyPassword(body.password,account?.password);
          if(!valid||!account?.active||account.mustChangePassword&&account.passwordExpiresAt<=now().getTime())fail(401,'El correo o la contraseña no coinciden, o el acceso venció.');
          return startSession(account,'password');
        }
        if(!config.googleClientId)fail(503,'El acceso con Google todavía no está configurado.');
        if(action==='challenge'){const nonce=secret();await repository.authCreate('owner-challenge',hash(nonce),{used:false,expiresAt:now().getTime()+10*60000});return json({nonce});}
        if(!/^[a-f0-9]{64}$/.test(body.nonce||'')||typeof body.credential!=='string'||body.credential.length>10000)fail(401,'No se pudo verificar el acceso con Google.');
        const challenge=await repository.authGet('owner-challenge',hash(body.nonce));
        if(!challenge||challenge.used||challenge.expiresAt<=now().getTime())fail(401,'El inicio de sesión venció. Intentá de nuevo.');
        let identity;try{identity=await verifyGoogle(body.credential,body.nonce);}catch{fail(401,'No se pudo verificar el acceso con Google.');}
        identity.email=normalizeEmail(identity.email);
        const code=typeof body.invitation==='string'?body.invitation.trim():'';
        const invite=/^[A-Za-z0-9_-]{20}$/.test(code)?await repository.portalGet('invites',hash(code)):null;
        if(!await repository.authUpdate('owner-challenge',hash(body.nonce),{used:false},{used:true}))fail(401,'El inicio de sesión ya se utilizó. Intentá de nuevo.');
        const account=await googleAccount(repository,identity,{allowCreate:!!invite?.active,now});
        return startSession(account,'google');
      }
      const token=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!token)fail(401,'Iniciá sesión para continuar.');
      const session=await repository.authGet('owner-session',hash(token));
      if(!session||session.revoked||session.expiresAt<=now().getTime())fail(401,'Tu sesión venció. Volvé a entrar.');
      const account=await repository.portalGet('accounts',hash(session.subject));
      if(!account?.active||(session.accountVersion||0)!==(account.session_version||0)||session.method==='password'&&(session.passwordVersion!==account.password_version||account.mustChangePassword&&account.passwordExpiresAt<=now().getTime()))fail(401,'Tu sesión venció. Volvé a entrar.');
      if(!await repository.allow('owner-session:'+hash(token),300))fail(429,'Demasiadas solicitudes. Intentá más tarde.');
      if(action==='session')return json({email:session.email,expiresAt:session.expiresAt,method:session.method,requiresPasswordChange:session.method==='password'&&!!account.mustChangePassword});
      if(action==='logout'){
        const revoked=await repository.authUpdate('owner-session',hash(token),{revoked:false},{revoked:true});
        if(!revoked&&!(await repository.authGet('owner-session',hash(token)))?.revoked)fail(503,'No se pudo cerrar la sesión. Intentá de nuevo.');return json({signedOut:true});
      }
      if(action==='change_password'){
        if(!await repository.allow('owner-change-password:'+hash(session.subject),12))fail(429,'Demasiados intentos. Intentá más tarde.');
        return json(await changePassword({repository,account,session,tokenHash:hash(token),body}));
      }
      if(session.method==='password'&&account.mustChangePassword)fail(403,'Cambiá tu contraseña temporal para continuar.');
      if(action==='health')return json({ready:config.emailReady});
      if(action==='list'){
        if(body.cursor!==undefined&&(typeof body.cursor!=='string'||body.cursor.length>2000))fail(400,'Página inválida.');
        const page=await repository.ownerRecords(session.subject,body.cursor);return json({records:page.records.map(recordSummary),cursor:page.cursor});
      }
      if(['workspace_open','workspace_claim','workspace_save_prepare','workspace_save_commit','workspace_submit','workspace_status','workspace_reopen','workspace_unlist'].includes(action))return json(await workspaceAction({action,body,actor:session,repository,config,mailer,now}));
      fail(400,'Acción no reconocida.');
    }catch(error){return json({error:error.status?error.message:error instanceof SyntaxError?'Solicitud inválida.':'No se pudo completar la operación. Intentá de nuevo.'},error.status||(error instanceof SyntaxError?400:500));}
  };
}
