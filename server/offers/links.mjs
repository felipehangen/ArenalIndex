import {createHmac,timingSafeEqual} from 'node:crypto';
export function offerToken(kind,id,config){return kind+'.'+id+'.'+createHmac('sha256',config.reviewSecret).update('arenal-offer-v2:'+kind+':'+id).digest('hex');}
export function offerURL(kind,id,config){return new URL('/offer/',config.siteURL).href+'#'+offerToken(kind,id,config);}
export function tokenID(token,kind,config){
  if(typeof token!=='string'||!new RegExp('^'+kind+'\\.[a-f0-9]{64}\\.[a-f0-9]{64}$').test(token)||!config.reviewSecret)return null;
  const id=token.split('.')[1];return timingSafeEqual(Buffer.from(token),Buffer.from(offerToken(kind,id,config)))?id:null;
}
