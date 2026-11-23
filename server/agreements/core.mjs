import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {termsVersion,normalizeTerms,validateTerms,documentFor,plainDocument,consent} from '../../site/agreement/model.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
const fail=(status,es,en)=>{throw Object.assign(Error(es),{status,offerEnglish:en});};
const unavailable=()=>fail(404,'Este acuerdo no está disponible. Consultá con tu corredor.','This agreement is unavailable. Please contact your broker.');
const signed=(id,config)=>id+'.'+createHmac('sha256',config.reviewSecret).update('owner-agreement-v1:'+id).digest('hex');
const ownerURL=(row,config)=>new URL('/agreement/',config.siteURL).href+'#'+signed(row.id,config);
function projection(row){return {id:row.id,terms:row.terms,brokerEmail:row.brokerEmail,documents:row.documents,consents:row.consents,termsVersion:row.termsVersion,termsHash:row.termsHash,createdAt:row.createdAt,state:row.state,expiresAt:row.expiresAt,acceptedAt:row.acceptedAt||null,acceptance:row.acceptance||null,endsAt:row.endsAt||null};}
const mailStatus=row=>({invitation:row.inviteState,owner:row.ownerCopyState,broker:row.brokerCopyState});
const brokerView=row=>({...projection(row),mail:mailStatus(row)});
async function loadOwned(id,account,repository){
  if(!/^[a-f0-9]{64}$/.test(id||''))unavailable();
  const row=await repository.portalGet('agreements',id);if(!row||row.ownerSubject!==account.subject)unavailable();return row;
}
// Another recipient can update the same Blob ETag without changing this claim.
async function mailUpdate(repository,id,filters,patch){
  for(let attempt=0;attempt<4;attempt++){
    const saved=await repository.portalUpdate('agreements',id,filters,patch);if(saved)return saved;
    const current=await repository.portalGet('agreements',id);
    if(!current||Object.entries(filters).some(([key,value])=>current[key]!==value))return null;
  }return null;
}
// Independent conditional claims preserve a saved acceptance even if either email fails.
async function deliver(row,kind,{repository,mailer,config,now}){
  const field=kind==='invitation'?'invite':kind==='owner'?'ownerCopy':'brokerCopy',state=field+'State',attempt=field+'AttemptAt';
  row=await repository.portalGet('agreements',row.id);
  if(!row||kind==='invitation'&&row.state!=='sent'||kind!=='invitation'&&row.state!=='accepted')return;
  if(row[state]==='sent'||row[state]==='sending'&&now().getTime()-row[attempt]<60000)return;
  const claim={[state]:'sending',[attempt]:now().getTime()};
  const claimed=await mailUpdate(repository,row.id,{state:row.state,[state]:row[state],[attempt]:row[attempt]},claim);if(!claimed)return;
  try{
    const language=kind==='invitation'?row.terms.language:row.acceptance.language,document=row.documents[language];
    await mailer.sendAgreement({recipient:kind==='broker'?row.brokerEmail:row.terms.ownerEmail,replyTo:kind==='broker'?row.terms.ownerEmail:row.brokerEmail,kind,language,property:row.terms.propertyName,broker:row.terms.brokerName,url:ownerURL(row,config),text:plainDocument(document),reference:row.id,version:row.termsVersion,termsHash:row.termsHash,acceptance:row.acceptance,acceptedAt:row.acceptedAt,expiresAt:row.expiresAt,idempotencyKey:'agreement-'+row.id+'-'+kind});
    await mailUpdate(repository,row.id,claim,{[state]:'sent'});
  }catch{
    await mailUpdate(repository,row.id,claim,{[state]:'pending'}).catch(()=>{});
  }
}
async function copies(row,options){await Promise.all([deliver(row,'owner',options),deliver(row,'broker',options)]);}
export async function brokerAgreementAction(options){
  const {action,body,account,repository,config,now}=options;
  if(action==='agreements_list'){
    if(body.cursor!==undefined&&(typeof body.cursor!=='string'||body.cursor.length>2000))fail(400,'Página inválida.','Invalid page.');
    const page=await repository.ownerAgreements(account.subject,body.cursor);return {...page,records:page.records.filter(r=>r.ownerSubject===account.subject).map(brokerView)};
  }
  if(!config.reviewSecret||config.reviewSecret.length<32)fail(503,'Los acuerdos no están configurados.','Agreements are not configured.');
  if(action==='agreement_create'){
    if(!/^[a-f0-9]{32}$/.test(body.requestId||''))fail(400,'Solicitud inválida.','Invalid request.');
    const terms=normalizeTerms(body.terms);if(Object.keys(validateTerms(terms)).length)fail(422,'Revisá los datos, la comisión y los impuestos.','Check the details, commission and taxes.');
    const id=hash(account.subject+':agreement:'+body.requestId),existing=await repository.portalGet('agreements',id);
    if(existing){if(JSON.stringify(existing.terms)!==JSON.stringify(terms))fail(409,'Este borrador ya tiene otros términos. Creá uno nuevo.','This draft already has different terms. Create a new one.');await repository.ensureAgreementIndex(account.subject,id);return brokerView(existing);}
    if(!await repository.allow('agreement-create:'+hash(account.subject),30))fail(429,'Demasiados borradores. Intentá más tarde.','Too many drafts. Please try later.');
    const documents={es:documentFor(terms,account.email,'es'),en:documentFor(terms,account.email,'en')};
    const row={id,ownerSubject:account.subject,terms,brokerEmail:account.email,documents,consents:{...consent},termsVersion,termsHash:hash(JSON.stringify({terms,documents,consents:consent,termsVersion})),createdAt:now().toISOString(),expiresAt:null,state:'draft',inviteState:'pending',inviteAttemptAt:0,ownerCopyState:'pending',ownerCopyAttemptAt:0,brokerCopyState:'pending',brokerCopyAttemptAt:0};
    await repository.ensureAgreementIndex(account.subject,id);
    const saved=await repository.portalCreate('agreements',id,row)||await repository.portalGet('agreements',id);
    if(!saved)fail(503,'No se pudo guardar el borrador.','Could not save the draft.');
    if(JSON.stringify(saved.terms)!==JSON.stringify(terms))fail(409,'El borrador cambió. Volvé a abrirlo.','The draft changed. Open it again.');return brokerView(saved);
  }
  let row=await loadOwned(body.id,account,repository);
  if(action==='agreement_send'){
    if(body.confirmed!==true||body.termsHash!==row.termsHash)fail(422,'Revisá y confirmá el acuerdo antes de enviarlo.','Review and confirm the agreement before sending it.');
    if(!config.emailReady)fail(503,'El envío de correo no está configurado.','Email delivery is not configured.');
    if(!['draft','sent'].includes(row.state))fail(409,'Este acuerdo ya no se puede enviar.','This agreement can no longer be sent.');
    if(row.state==='sent'&&Date.parse(row.expiresAt)<=now().getTime())fail(410,'La invitación venció. Prepará un nuevo acuerdo.','The invitation expired. Prepare a new agreement.');
    if(!await repository.allow('agreement-mail:'+hash(account.subject),30))fail(429,'Demasiados envíos. Intentá más tarde.','Too many sends. Please try later.');
    if(row.state==='draft')row=await repository.portalUpdate('agreements',row.id,{state:'draft'},{state:'sent',sentAt:now().toISOString(),expiresAt:new Date(now().getTime()+14*86400000).toISOString()})||await loadOwned(row.id,account,repository);
    await deliver(row,'invitation',options);
  }else if(action==='agreement_cancel'){
    if(!['draft','sent'].includes(row.state))fail(409,'Un acuerdo aceptado se conserva. Coordiná el retiro con el propietario.','An accepted agreement is retained. Arrange withdrawal with the owner.');
    const cancelled=await repository.portalUpdate('agreements',row.id,{state:row.state},{state:'cancelled'});if(!cancelled)fail(409,'El acuerdo cambió. Actualizá la lista.','The agreement changed. Refresh the list.');
  }else if(action==='agreement_retry'){
    if(!await repository.allow('agreement-mail:'+hash(account.subject),30))fail(429,'Demasiados envíos. Intentá más tarde.','Too many sends. Please try later.');
    if(row.state==='accepted')await copies(row,options);else if(row.state==='sent'&&Date.parse(row.expiresAt)>now().getTime())await deliver(row,'invitation',options);else fail(409,'Prepará una nueva invitación.','Prepare a new invitation.');
  }else fail(400,'Acción inválida.','Invalid action.');
  return brokerView(await loadOwned(row.id,account,repository));
}
export async function publicAgreementAction(options){
  const {action,body,repository,config,now,request}=options,token=body.token;
  if(typeof token!=='string'||!/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(token)||!config.reviewSecret||config.reviewSecret.length<32)unavailable();
  const id=token.split('.')[0];if(!timingSafeEqual(Buffer.from(token),Buffer.from(signed(id,config))))unavailable();
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  if(!await repository.allow('agreement-public:'+hash(ip+config.rateSalt),90))fail(429,'Demasiados intentos. Intentá más tarde.','Too many attempts. Please try later.');
  let row=await repository.portalGet('agreements',id),account=row&&await repository.portalGet('accounts',hash(row.ownerSubject));
  if(!row||['draft','cancelled'].includes(row.state)||!account?.active)unavailable();
  const expired=row.state!=='accepted'&&Date.parse(row.expiresAt)<=now().getTime();
  if(action==='agreement_open')return {...projection(row),expired,mail:row.state==='accepted'?{owner:row.ownerCopyState,broker:row.brokerCopyState}:undefined};
  if(expired)fail(410,'El enlace venció. Pedí un acuerdo nuevo.','The link expired. Ask for a new agreement.');
  if(body.confirmed!==true||body.termsHash!==row.termsHash||body.termsVersion!==row.termsVersion||!['es','en'].includes(body.language)||!['owner','representative'].includes(body.capacity)||typeof body.name!=='string'||body.name.trim().length<2||body.name.trim().length>120||/[\x00-\x1f]/.test(body.name))fail(422,'Leé los términos y confirmá tu nombre y autorización.','Read the terms and confirm your name and authority.');
  const acceptance={name:body.name.trim(),capacity:body.capacity,language:body.language,consent:row.consents[body.language],method:'email-link-and-explicit-acceptance',email:row.terms.ownerEmail};
  if(row.state==='accepted'){
    if(JSON.stringify(row.acceptance)!==JSON.stringify(acceptance))fail(409,'Este acuerdo ya fue aceptado. Revisá la copia guardada.','This agreement has already been accepted. Review the saved copy.');
    await copies(row,options);
  }else{
    const acceptedAt=now().toISOString(),endsAt=new Date(now().getTime()+Number(row.terms.durationDays)*86400000).toISOString();
    const saved=await repository.portalUpdate('agreements',id,{state:'sent',termsHash:row.termsHash},{state:'accepted',acceptedAt,endsAt,acceptance});
    if(!saved){row=await repository.portalGet('agreements',id);if(row?.state!=='accepted'||JSON.stringify(row.acceptance)!==JSON.stringify(acceptance))fail(409,'El acuerdo cambió. Abrí el enlace nuevamente.','The agreement changed. Open the link again.');}else row=saved;
    await copies(row,options);
  }
  row=await repository.portalGet('agreements',id);return {...projection(row),expired:false,mail:{owner:row.ownerCopyState,broker:row.brokerCopyState}};
}
