import {offerURL} from './links.mjs';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {validateOffer,normalizeOffer,notice,noticeVersion,validateSimpleOffer,normalizeSimpleOffer,simpleNotice,simpleNoticeVersion} from '../../site/offer/model.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
const fail=(status,es,en)=>{throw Object.assign(Error(es),{status,offerEnglish:en});};
const signed=(id,config)=>id+'.'+createHmac('sha256',config.reviewSecret).update('purchase-proposal:'+id).digest('hex');
const link=(row,config)=>row.kind==='submission'?offerURL('receipt',row.id,config):new URL('/offer/',config.siteURL).href+'#'+signed(row.id,config);
// Only public tour text and photos already included in the listing may cross into an offer.
const photoGroups=listing=>{
  const images=new Set(Array.isArray(listing.images)?listing.images.slice(0,200):[]);
  return (Array.isArray(listing.details?.photoGroups)?listing.details.photoGroups:[]).slice(0,50).map(group=>({
    title:typeof group.title==='string'?group.title:'',
    photos:(Array.isArray(group.photos)?group.photos:[]).filter(photo=>photo&&images.has(photo.src)).slice(0,200).map(photo=>({src:photo.src,caption:typeof photo.caption==='string'?photo.caption:''}))
  })).filter(group=>group.photos.length);
};
const snapshot=listing=>({id:listing.id,name:listing.name,place:listing.place,price:listing.price,currency:listing.currency||'USD',area:listing.area,image:listing.images?.[0]||'',images:Array.isArray(listing.images)?listing.images.filter(src=>typeof src==='string').slice(0,200):[],photoGroups:photoGroups(listing),photoBuildingNames:(listing.details?.buildings||[]).map(b=>b.name).filter(name=>typeof name==='string').slice(0,50),contact:{name:listing.details?.contact?.name||'',whatsapp:String(listing.details?.contact?.whatsapp||'').replace(/\D/g,'')},isDemo:listing.is_demo===true,titles:{es:listing.details?.translations?.es?.title||listing.name,en:listing.details?.translations?.en?.title||listing.name}});
export async function property({repository,catalog,account,id}){
  if(typeof id!=='string'||!/^[a-zA-Z0-9-]{5,80}$/.test(id))fail(400,'Propiedad inválida.','Invalid property.');
  const row=await repository.get(id);
  if(row?.owner_subject===account.subject&&row.status!=='deleted'&&row.publication?.listing)return snapshot(row.publication.listing);
  const demo=catalog&&(await catalog.published(account.subject)).find(row=>row.id===id);
  if(demo)return snapshot(demo);
  fail(404,'Elegí una propiedad publicada de tu cuenta.','Choose a published property in your account.');
}
export const publicRecord=row=>({kind:row.kind,id:row.id,property:row.property,broker:row.broker,createdAt:row.createdAt,expiresAt:row.expiresAt,revision:row.revision,versions:row.versions,revoked:row.revoked,reviewedRevision:row.reviewedRevision});
export async function ownerOfferAction({action,body,account,repository,catalog,config,now}){
  if(action==='offers_list'){
    if(body.cursor!==undefined&&(typeof body.cursor!=='string'||body.cursor.length>2000))fail(400,'Página inválida.','Invalid page.');
    const page=await repository.ownerOffers(account.subject,body.cursor);
    return {...page,records:page.records.filter(r=>r.ownerSubject===account.subject).map(r=>({...publicRecord(r),label:r.label,url:link(r,config)}))};
  }
  if(action==='offer_create'){
    if(!config.reviewSecret||config.reviewSecret.length<32)fail(503,'Las propuestas no están configuradas.','Proposals are not configured.');
    if(typeof body.label!=='string'||body.label.length>120)fail(422,'Agregá una referencia de hasta 120 caracteres.','Use a reference of up to 120 characters.');
    if(!/^[a-f0-9]{64}$/.test(body.requestId||''))fail(400,'Solicitud inválida.','Invalid request.');
    // A retry after a lost response returns the same invitation, never a duplicate.
    const id=hash(account.subject+':'+body.requestId),existing=await repository.portalGet('offers',id);
    if(existing){await repository.ensureOfferIndex(account.subject,id);return {...publicRecord(existing),label:existing.label,url:link(existing,config)};}
    const p=await property({repository,catalog,account,id:body.propertyId});
    const row={id,ownerSubject:account.subject,sourceId:body.propertyId,property:p,broker:account.name||'ArenalIndex',label:body.label.trim(),createdAt:now().toISOString(),expiresAt:new Date(now().getTime()+30*86400000).toISOString(),revision:0,versions:[],reviewedRevision:0,revoked:false};
    // Index first; readers skip missing records. A failed write cannot hide an invitation.
    await repository.ensureOfferIndex(account.subject,id);
    const created=await repository.portalCreate('offers',id,row)||await repository.portalGet('offers',id);
    return {...publicRecord(created),label:created.label,url:link(created,config)};
  }
  if(!/^[a-f0-9]{64}$/.test(body.id||''))fail(400,'Propuesta inválida.','Invalid proposal.');
  const row=await repository.portalGet('offers',body.id);
  if(!row||row.ownerSubject!==account.subject)fail(404,'No se encontró la propuesta.','Proposal not found.');
  if(body.revision!==row.revision)fail(409,'La propuesta cambió. Actualizá la lista.','The proposal changed. Refresh the list.');
  const patch=action==='offer_revoke'?{revoked:true}:action==='offer_reviewed'?{reviewedRevision:row.revision}:null;
  if(!patch)fail(400,'Acción inválida.','Invalid action.');
  if(!await repository.portalUpdate('offers',row.id,{revision:row.revision,revoked:row.revoked},patch))fail(409,'La propuesta cambió. Actualizá la lista.','The proposal changed. Refresh the list.');
  return {saved:true};
}
export async function publicOfferAction({action,body,repository,catalog,config,now,request}){
  const token=body.token;
  if(typeof token!=='string'||!/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(token)||!config.reviewSecret)fail(404,'El enlace no está disponible.','This link is unavailable.');
  const id=token.split('.')[0];
  if(!timingSafeEqual(Buffer.from(token),Buffer.from(signed(id,config))))fail(404,'El enlace no está disponible.','This link is unavailable.');
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  if(!await repository.allow('offer-public:'+hash(ip+config.rateSalt),120))fail(429,'Demasiados intentos. Intentá más tarde.','Too many attempts. Try again later.');
  const row=await repository.portalGet('offers',id),account=row&&await repository.portalGet('accounts',hash(row.ownerSubject));
  if(!row||row.revoked||!account?.active)fail(410,'Este enlace ya no está disponible. Contactá a tu corredor.','This link is no longer available. Contact your broker.');
  const expired=Date.parse(row.expiresAt)<=now().getTime();
  if(action==='offer_open')return {...publicRecord(row),expired};
  if(expired)fail(410,'El enlace venció. Pedí un nuevo enlace a tu corredor.','This invitation expired. Ask your broker for a new link.');
  if(!/^[a-f0-9]{32}$/.test(body.submissionId||''))fail(400,'Solicitud inválida.','Invalid request.');
  if(row.versions.some(v=>v.submissionId===body.submissionId))return {...publicRecord(row),expired:false};
  if(body.revision!==row.revision)fail(409,'Hay una versión más reciente. Recargá para revisarla antes de enviar.','A newer version exists. Reload to review it before sending.');
  if(row.versions.length>=20)fail(422,'Contactá a tu corredor para continuar con una nueva propuesta.','Contact your broker to continue with a new proposal.');
  // Check current ownership/publication, but retain the asking-price snapshot shown to the buyer.
  await property({repository,catalog,account,id:row.sourceId});
  const simple=body.offer?.schema===2;
  if(body.confirmed!==true||!['es','en'].includes(body.language)||body.noticeVersion!==(simple?simpleNoticeVersion:noticeVersion)||Object.keys((simple?validateSimpleOffer:validateOffer)(body.offer)).length)fail(422,'Revisá los datos y confirmá la propuesta antes de enviar.','Review your details and confirm the proposal before sending.');
  const submittedAt=now().toISOString(),version={revision:row.revision+1,submissionId:body.submissionId,submittedAt,validUntil:simple?null:new Date(now().getTime()+Number(body.offer.validity)*86400000).toISOString(),offer:(simple?normalizeSimpleOffer:normalizeOffer)(body.offer),language:body.language,noticeVersion:simple?simpleNoticeVersion:noticeVersion,notice:(simple?simpleNotice:notice)[body.language]};
  const updated=await repository.portalUpdate('offers',id,{revision:row.revision,revoked:false},{revision:version.revision,versions:[...row.versions,version]});
  if(!updated){const latest=await repository.portalGet('offers',id);if(latest&&!latest.revoked&&latest.versions.some(v=>v.submissionId===body.submissionId))return {...publicRecord(latest),expired:false};fail(409,'La propuesta cambió. Recargá antes de continuar.','The proposal changed. Reload before continuing.');}
  return {...publicRecord(updated),expired:false};
}
