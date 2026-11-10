import {createHash} from 'node:crypto';
import {listingRules} from '../../site/publicar/rules.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
export const rulesHash=hash(JSON.stringify(listingRules));
export const currentRules=Object.freeze({...listingRules,contentHash:rulesHash});
export const hasAcceptedRules=account=>account.rulesAcceptances?.[rulesHash]?.version===listingRules.version;
export const rulesIdentity=account=>({requiresRulesAcceptance:!hasAcceptedRules(account),listingRules:currentRules});
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};

export async function acceptListingRules({repository,account,session,body,now}){
  if(body.accepted!==true)fail(422,'Marcá la casilla para aceptar las reglas de publicación.');
  if(body.version!==listingRules.version||body.contentHash!==rulesHash)fail(409,'Las reglas cambiaron. Volvé a cargar la página para leer la versión actual.');
  if(!['es','en'].includes(body.language))fail(422,'Elegí español o inglés para registrar la aceptación.');
  const previous=account.rulesAcceptances?.[rulesHash];
  if(previous?.version===listingRules.version)return {accepted:true,receipt:previous};
  const receipt={version:listingRules.version,contentHash:rulesHash,acceptedAt:now().toISOString(),email:account.email,subject:account.subject,language:body.language,method:session.method,rules:listingRules};
  const updated=await repository.portalUpdate('accounts',hash(account.subject),{
    active:true,session_version:account.session_version,password_version:account.password_version,rulesRevision:account.rulesRevision
  },{rulesAcceptances:{...account.rulesAcceptances,[rulesHash]:receipt},rulesRevision:(account.rulesRevision||0)+1});
  if(!updated){
    const latest=await repository.portalGet('accounts',hash(account.subject));
    if(latest?.active&&(latest.session_version||0)===(account.session_version||0)&&latest.password_version===account.password_version&&hasAcceptedRules(latest))return {accepted:true,receipt:latest.rulesAcceptances[rulesHash]};
    fail(409,'La cuenta cambió. Volvé a iniciar sesión.');
  }
  return {accepted:true,receipt};
}
