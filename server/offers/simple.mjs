import {createHash} from 'node:crypto';
import {property,publicRecord} from './core.mjs';
import {offerURL,shortFormURL,resolveTokenID} from './links.mjs';
import {validateSimpleOffer,normalizeSimpleOffer,simpleNotice,simpleNoticeVersion} from '../../site/offer/model.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
const fail=(status,es,en)=>{throw Object.assign(Error(es),{status,offerEnglish:en});};
const unavailable=()=>fail(404,'Este formulario ya no está disponible. Consultá con tu corredor.','This form is no longer available. Please contact your broker.');
const receipt=(row,config,extra={})=>({...publicRecord(row),receiptURL:offerURL('receipt',row.id,config),...extra});
export async function listingOfferForm({body,account,repository,catalog,config,now}){
  if(!config.reviewSecret||config.reviewSecret.length<32)fail(503,'El formulario no está disponible.','The form is unavailable.');
  const p=await property({repository,catalog,account,id:body.propertyId});
  const id=hash('listing-form-v2:'+account.subject+':'+body.propertyId);
  const row=await repository.portalGet('offer-forms',id)||await repository.portalCreate('offer-forms',id,{id,ownerSubject:account.subject,sourceId:body.propertyId,createdAt:now().toISOString()})||await repository.portalGet('offer-forms',id);
  if(!row)fail(503,'No se pudo preparar el enlace. Intentá de nuevo.','Could not prepare the link. Please try again.');
  return {property:p,broker:account.name||'ArenalIndex',url:await shortFormURL(id,config,repository)};
}
export async function simpleOfferAction({action,body,repository,catalog,config,now,request}){
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  if(!await repository.allow('simple-offer:'+hash(ip+config.rateSalt),120))fail(429,'Demasiados intentos. Intentá más tarde.','Too many attempts. Please try again later.');
  const kind=action==='offer_receipt'?'receipt':'listing',id=await resolveTokenID(body.token,kind,config,repository);
  if(!id)unavailable();
  if(kind==='receipt'){
    const row=await repository.portalGet('offers',id),account=row&&await repository.portalGet('accounts',hash(row.ownerSubject));
    if(!row||row.kind!=='submission'||row.revoked||!account?.active)unavailable();
    return receipt(row,config);
  }
  const form=await repository.portalGet('offer-forms',id),account=form&&await repository.portalGet('accounts',hash(form.ownerSubject));
  if(!form||!account?.active)unavailable();
  if(action==='offer_form_submit'){
    if(!/^[a-f0-9]{32}$/.test(body.submissionId||''))fail(400,'Solicitud inválida.','Invalid request.');
    if(body.confirmed!==true||!['en','es'].includes(body.language)||body.noticeVersion!==simpleNoticeVersion||Object.keys(validateSimpleOffer(body.offer)).length)fail(422,'Revisá tu nombre, contacto y monto antes de enviar.','Check your name, contact and amount before sending.');
    const receiptId=hash('receipt:'+id+':'+body.submissionId),existing=await repository.portalGet('offers',receiptId);
    if(existing){if(existing.revoked)unavailable();await repository.ensureOfferIndex(account.subject,receiptId);return receipt(existing,config,{alreadySent:JSON.stringify(existing.versions[0].offer)!==JSON.stringify(normalizeSimpleOffer(body.offer))});}
    if(!await repository.allow('simple-offer-submit:'+hash(ip+id+config.rateSalt),30))fail(429,'Demasiados envíos. Intentá más tarde.','Too many submissions. Please try again later.');
    const p=await property({repository,catalog,account,id:form.sourceId});
    if(body.propertyVersion!==hash(JSON.stringify(p)))fail(409,'La propiedad se actualizó. Recargá el formulario; tu borrador se conserva en esta pestaña.','The listing was updated. Reload the form; your draft stays in this tab.');
    const submittedAt=now().toISOString(),version={revision:1,submissionId:body.submissionId,offer:normalizeSimpleOffer(body.offer),submittedAt,validUntil:null,language:body.language,noticeVersion:simpleNoticeVersion,notice:simpleNotice[body.language]};
    const row={id:receiptId,kind:'submission',ownerSubject:account.subject,sourceId:form.sourceId,property:p,broker:account.name||'ArenalIndex',createdAt:submittedAt,expiresAt:null,revision:1,versions:[version],reviewedRevision:0,revoked:false};
    await repository.ensureOfferIndex(account.subject,receiptId);
    const saved=await repository.portalCreate('offers',receiptId,row)||await repository.portalGet('offers',receiptId);
    if(!saved||saved.revoked)unavailable();return receipt(saved,config,{alreadySent:JSON.stringify(saved.versions[0].offer)!==JSON.stringify(version.offer)});
  }
  const p=await property({repository,catalog,account,id:form.sourceId});
  // A shared listing form never includes buyers, receipts, or submission history.
  return {property:p,broker:account.name||'ArenalIndex',propertyVersion:hash(JSON.stringify(p))};
}
