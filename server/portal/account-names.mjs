import {createHash,randomBytes} from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const duplicate=()=>fail(409,'Ese nombre ya está en uso. Elegí otro nombre para la cuenta.');
export const nameKey=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().trim().replace(/\s+/gu,' ');
export function normalizeName(value){
  if(typeof value!=='string'||!value.trim()||value.trim().length>100||/[\u0000-\u001f\u007f]/.test(value))fail(422,'Ingresá un nombre de entre 1 y 100 caracteres.');
  const name=value.trim().replace(/\s+/gu,' ');if(!nameKey(name))fail(422,'Ingresá un nombre de entre 1 y 100 caracteres.');return name;
}
// A conditional Blob reservation prevents two requests from claiming the same name.
// Pending claims are retained after ambiguous storage failures rather than risking duplicates.
export async function withUniqueName({repository,email,name,operation}){
  const key=nameKey(name),id=hash(key),accounts=await repository.ownerAccounts();
  if(accounts.some(row=>row.email!==email&&row.name&&nameKey(row.name)===key))duplicate();
  const oldName=accounts.find(row=>row.email===email)?.name,oldId=oldName&&nameKey(oldName)!==key?hash(nameKey(oldName)):null;
  const oldClaim=oldId?await repository.portalGet('account-names',oldId):null;
  const claim={email,key,state:'pending',token:randomBytes(24).toString('hex')};
  let previous=null,reserved=await repository.portalCreate('account-names',id,claim);
  if(!reserved){
    previous=await repository.portalGet('account-names',id);
    if(!previous)fail(409,'La cuenta cambió. Actualizá la lista.');
    if(previous.email&&previous.email!==email)duplicate();
    if(previous.state==='pending')fail(409,'Este nombre se está guardando. Intentá de nuevo.');
    reserved=await repository.portalUpdate('account-names',id,{token:previous.token,state:previous.state},claim);
    if(!reserved)fail(409,'La cuenta cambió. Actualizá la lista.');
  }
  let result;
  try{result=await operation();}
  catch(error){
    if(error.status>=400&&error.status<500)await repository.portalUpdate('account-names',id,{token:claim.token},previous||{email:null,key,state:'free',token:null});
    throw error;
  }
  const committed=await repository.portalUpdate('account-names',id,{token:claim.token,state:'pending'},{state:'committed'});
  if(!committed)fail(409,'La cuenta cambió. Actualizá la lista.');
  if(oldClaim?.email===email)await repository.portalUpdate('account-names',oldId,{token:oldClaim.token,email},{email:null,state:'free',token:null});
  return result;
}
