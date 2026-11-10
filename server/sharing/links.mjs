import {createHash} from 'node:crypto';

export const SITE_ORIGIN='https://arenalindex.com';
export const API_ORIGIN='https://arenalindex-intake.vercel.app';
// Enable the branded origin only after its DNS and HTTPS are verified.
export const shareOrigin=()=>process.env.PUBLIC_SHARE_ORIGIN||API_ORIGIN;
export function shareCode(id){
  if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id||''))throw Error('Invalid public listing ID');
  return createHash('sha256').update('arenal-property:'+id).digest('base64url').slice(0,10);
}
export const propertyURL=id=>SITE_ORIGIN+'/#propiedad/'+encodeURIComponent(id);
export const shareURL=(id,origin=shareOrigin())=>origin+'/p/'+shareCode(id);
export const withShareURL=row=>({...row,shareUrl:shareURL(row.id)});
