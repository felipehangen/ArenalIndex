import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
export function offerToken(kind,id,config){return kind+'.'+id+'.'+createHmac('sha256',config.reviewSecret).update('arenal-offer-v2:'+kind+':'+id).digest('hex');}
export function offerURL(kind,id,config){return new URL('/offer/',config.siteURL).href+'#'+offerToken(kind,id,config);}
export function tokenID(token,kind,config){
  if(typeof token!=='string'||!new RegExp('^'+kind+'\\.[a-f0-9]{64}\\.[a-f0-9]{64}$').test(token)||!config.reviewSecret)return null;
  const id=token.split('.')[1];return timingSafeEqual(Buffer.from(token),Buffer.from(offerToken(kind,id,config)))?id:null;
}
// A 128-bit capability keeps the broker's link short without exposing record IDs.
// Its private lookup contains no buyer data; the usual ownership/publication checks still apply.
const formToken=(id,config)=>'l.'+createHmac('sha256',config.reviewSecret).update('arenal-offer-form-short-v1:'+id).digest().subarray(0,16).toString('base64url');
const linkKey=token=>createHash('sha256').update(token).digest('hex');
export async function shortFormURL(id,config,repository){
  const token=formToken(id,config),key=linkKey(token);
  const row=await repository.portalGet('offer-links',key)||await repository.portalCreate('offer-links',key,{kind:'listing',id})||await repository.portalGet('offer-links',key);
  if(row?.kind!=='listing'||row.id!==id)throw Error('Could not prepare offer link');
  return new URL('/offer/',config.siteURL).href+'#'+token;
}
export async function resolveTokenID(token,kind,config,repository){
  if(kind!=='listing'||typeof token!=='string'||!/^l\.[A-Za-z0-9_-]{22}$/.test(token))return tokenID(token,kind,config);
  if(!config.reviewSecret)return null;
  const row=await repository.portalGet('offer-links',linkKey(token));
  if(row?.kind!=='listing'||!/^[a-f0-9]{64}$/.test(row.id||''))return null;
  return timingSafeEqual(Buffer.from(token),Buffer.from(formToken(row.id,config)))?row.id:null;
}
