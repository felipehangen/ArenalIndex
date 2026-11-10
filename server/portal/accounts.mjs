import {scrypt,randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {hasAcceptedRules,rulesHash} from './listing-rules.mjs';
import {normalizeName,withUniqueName} from './account-names.mjs';
const derive=promisify(scrypt),hash=value=>createHash('sha256').update(value).digest('hex');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const parameters={N:65536,r:8,p:1,maxmem:128*1024*1024};
export const normalizeEmail=value=>typeof value==='string'?value.trim().toLowerCase():'';
export function checkPassword(value){if(typeof value!=='string'||value.length<12||value.length>128)fail(422,'Usá una contraseña de entre 12 y 128 caracteres.');}
export async function hashPassword(value){checkPassword(value);const salt=randomBytes(16).toString('hex'),derived=await derive(value,salt,64,parameters);return {salt,hash:derived.toString('hex')};}
const dummy=hashPassword(randomBytes(32).toString('hex'));
export async function verifyPassword(value,stored){
  const record=stored||await dummy;
  if(typeof value!=='string'||value.length>128)return false;
  const derived=await derive(value,record.salt,64,parameters);return timingSafeEqual(derived,Buffer.from(record.hash,'hex'))&&!!stored;
}
export async function findAccount(repository,email){const index=await repository.portalGet('emails',hash(email));return index?await repository.portalGet('accounts',hash(index.subject)):null;}
export async function googleAccount(repository,identity){
  let account=await findAccount(repository,identity.email);
  if(!account)fail(403,'Tu cuenta todavía no tiene acceso. Pedí a ArenalIndex que habilite tu correo.');
  if(!account?.active||account.email!==identity.email||account.googleSubject&&account.googleSubject!==identity.subject)fail(403,'Esta cuenta no tiene acceso. Contactá a ArenalIndex.');
  if(!account.googleSubject){
    const updated=await repository.portalUpdate('accounts',hash(account.subject),{googleSubject:account.googleSubject,active:true},{googleSubject:identity.subject});
    if(!updated)fail(409,'La cuenta cambió. Intentá iniciar sesión de nuevo.');account=updated;
  }
  return account;
}
async function ensureAccount(repository,email,actor,now){
  let account=await findAccount(repository,email),created=false;
  if(!account){
    const subject='email-'+randomBytes(24).toString('hex');
    const index=await repository.portalCreate('emails',hash(email),{email,subject})||await repository.portalGet('emails',hash(email));
    account=await repository.portalGet('accounts',hash(index.subject));
    if(!account){created=!!await repository.portalCreate('accounts',hash(index.subject),{subject:index.subject,email,active:true,createdAt:now().toISOString(),createdBy:actor.email});account=await repository.portalGet('accounts',hash(index.subject));}
  }
  if(!account||account.email!==email)fail(409,'La cuenta cambió. Actualizá la lista.');
  return {account,created};
}
export async function accountAdminAction({action,body,repository,actor,now}){
  if(action==='owner_accounts')return {accounts:(await repository.ownerAccounts()).map(row=>({id:hash(row.subject),email:row.email,name:row.name||'',nameVersion:row.name_version||0,active:row.active,google:!!row.googleSubject,password:!!row.password,temporaryPassword:!!row.mustChangePassword,rulesAccepted:hasAcceptedRules(row),rulesAcceptance:hasAcceptedRules(row)?{version:row.rulesAcceptances[rulesHash].version,acceptedAt:row.rulesAcceptances[rulesHash].acceptedAt,language:row.rulesAcceptances[rulesHash].language}:null}))};
  if(action==='set_owner_name'){
    if(!/^[a-f0-9]{64}$/.test(body.id||'')||!Number.isSafeInteger(body.nameVersion)||body.nameVersion<0)fail(400,'Cuenta inválida.');
    const name=normalizeName(body.name),account=await repository.portalGet('accounts',body.id);if(!account)fail(404,'No se encontró la cuenta.');
    if((account.name_version||0)!==body.nameVersion)fail(409,'La cuenta cambió. Actualizá la lista.');
    return withUniqueName({repository,email:account.email,name,operation:async()=>{
    const updated=await repository.portalUpdate('accounts',body.id,{name_version:account.name_version},{name,name_version:body.nameVersion+1,updatedBy:actor.email});
    if(!updated)fail(409,'La cuenta cambió. Actualizá la lista.');return {updated:true,name};
    }});
  }
  if(action==='set_owner_active'){
    if(!/^[a-f0-9]{64}$/.test(body.id||'')||typeof body.active!=='boolean')fail(400,'Cuenta inválida.');
    const account=await repository.portalGet('accounts',body.id);if(!account)fail(404,'No se encontró la cuenta.');
    const updated=await repository.portalUpdate('accounts',body.id,{active:account.active,session_version:account.session_version},{active:body.active,session_version:(account.session_version||0)+1,updatedBy:actor.email});if(!updated)fail(409,'La cuenta cambió. Actualizá la lista.');return {updated:true};
  }
  if(action==='set_owner_password'||action==='create_account'){
    const email=normalizeEmail(body.email);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)fail(422,'Ingresá un correo válido.');
    const name=body.name===undefined?undefined:normalizeName(body.name);
    const password=action==='set_owner_password'?await hashPassword(body.password):null;
    const save=async()=>{
      const {account,created}=await ensureAccount(repository,email,actor,now);
      const patch={};
      if(name!==undefined&&name!==account.name)Object.assign(patch,{name,name_version:(account.name_version||0)+1,updatedBy:actor.email});
      if(password)Object.assign(patch,{password,password_version:(account.password_version||0)+1,mustChangePassword:true,passwordExpiresAt:now().getTime()+7*86400000,passwordSetBy:actor.email});
      const updated=Object.keys(patch).length?await repository.portalUpdate('accounts',hash(account.subject),{name_version:account.name_version,password_version:account.password_version},patch):account;
      if(!updated)fail(409,'La cuenta cambió. Actualizá la lista.');
      return password?{email,active:updated.active,temporary:true,expiresAt:updated.passwordExpiresAt}:{email,active:updated.active,created};
    };
    return name===undefined?save():withUniqueName({repository,email,name,operation:save});
  }
  fail(400,'Acción no reconocida.');
}
export async function changePassword({repository,account,session,tokenHash,body}){
  if(session.method==='password'&&!account.mustChangePassword&&!await verifyPassword(body.currentPassword,account.password))fail(403,'La contraseña actual no coincide.');
  if(await verifyPassword(body.password,account.password))fail(422,'Elegí una contraseña distinta de la anterior.');
  const password=await hashPassword(body.password),version=(account.password_version||0)+1;
  const updated=await repository.portalUpdate('accounts',hash(account.subject),{password_version:account.password_version,active:true},{password,password_version:version,mustChangePassword:false,passwordExpiresAt:null});
  if(!updated)fail(409,'La cuenta cambió. Volvé a iniciar sesión.');
  if(session.method==='password'){
    const renewed=await repository.authUpdate('owner-session',tokenHash,{revoked:false,passwordVersion:session.passwordVersion},{passwordVersion:version});
    if(!renewed)fail(401,'Tu sesión venció. Volvé a entrar.');
  }
  return {changed:true};
}
