import {createHash} from 'node:crypto';

export const SITE_ORIGIN='https://arenalindex.com';
export const API_ORIGIN='https://arenalindex-intake.vercel.app';
// Enable the branded origin only after its DNS and HTTPS are verified.
export const shareOrigin=()=>process.env.PUBLIC_SHARE_ORIGIN||API_ORIGIN;
function digest(id){
  if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id||''))throw Error('Invalid public listing ID');
  return createHash('sha256').update('arenal-property:'+id).digest();
}
export const legacyShareCode=id=>digest(id).toString('base64url').slice(0,10);
export function shareCode(id){
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value=BigInt('0x'+digest(id).toString('hex')),suffix='';
  for(let i=0;i<5;i++){suffix=alphabet[Number(value%62n)]+suffix;value/=62n;}
  // An uppercase first character keeps aliases separate from existing site paths.
  return alphabet[Number(value%26n)]+suffix;
}
export const propertyURL=id=>SITE_ORIGIN+'/#propiedad/'+encodeURIComponent(id);
export const shareURL=(id,origin=shareOrigin())=>origin+'/'+shareCode(id);
export const withShareURL=row=>({...row,shareUrl:shareURL(row.id)});
