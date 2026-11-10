import {canRelist} from './relisting.mjs';
import {randomBytes} from 'node:crypto';
import {newDraft,validateDraft,validSignature} from '../../site/newlisting/model.mjs';
import {createHandler,digest} from '../intake/core.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const freshId=()=>randomBytes(32).toString('hex');
export const filePath=(row,file)=>row.file_paths?.[file.id]||row.id+'/'+row.version+'/'+file.id;
export const workspaceSummary=row=>({id:row.id,status:row.status,version:row.version,editRevision:row.edit_revision||0,feedback:row.feedback||'',publishedVersion:row.publication?.version||null,publicationRevision:row.publication_revision||0,notificationSent:row.notification_sent===true});
export async function workspaceAction({action,body,actor,repository,config,mailer,now=()=>new Date()}){
  const id=body.id||body.draft?.id;
  if(!/^[a-zA-Z0-9-]{8,80}$/.test(id||''))fail(400,'Identificador inválido.');
  let row=await repository.get(id);
  if(row?.status==='deleted')fail(404,'No se encontró la ficha.');
  if(action==='workspace_claim'){
    if(row?.owner_subject===actor.subject)return workspaceSummary(row);
    if(!row||row.owner_subject||!/^[a-f0-9]{64}$/.test(body.token||'')||row.token_hash!==await digest(body.token))fail(403,'No se pudo vincular esta ficha. Necesitás su acceso privado original.');
    await repository.ensureOwnerIndex(actor.subject,id);
    const changed=await repository.update(id,{owner_subject:row.owner_subject,token_hash:row.token_hash},{owner_subject:actor.subject,owner_email:actor.email});
    if(!changed)fail(409,'La ficha cambió. Actualizá su estado.');return workspaceSummary(changed);
  }
  if(!row&&action==='workspace_save_prepare'){
    if(!await repository.allow('owner-create:'+actor.subject,20))fail(429,'Se alcanzó el límite de nuevas fichas. Intentá más tarde.');
    await repository.ensureOwnerIndex(actor.subject,id);
    row=await repository.create({id,owner_subject:actor.subject,owner_email:actor.email,payload:validateDraft(newDraft(id)),status:'draft',version:0,edit_revision:0,updated_at:now().toISOString()});
    if(!row)fail(409,'La ficha cambió. Actualizá su estado.');
  }
  if(!row||row.status==='deleted'||actor.role!=='admin'&&row.owner_subject!==actor.subject)fail(404,'No se encontró la ficha.');
  if(action==='workspace_relist'){
    if(body.version!==row.version||body.editRevision!==(row.edit_revision||0)||body.publicationRevision!==(row.publication_revision||0))fail(409,'La ficha cambió. Actualizá la lista antes de continuar.');
    if(!canRelist(row))fail(409,'Esta ficha necesita revisión antes de volver a publicarse.');
    await repository.ensurePublishedIndex(id);
    const updated=await repository.update(id,{version:row.version,status:row.status,edit_revision:row.edit_revision,publication_revision:row.publication_revision,relist_owner:row.relist_owner},{publication:row.relist_publication,relist_publication:null,relist_owner:null,unlisted_at:null,publication_revision:(row.publication_revision||0)+1,updated_at:now().toISOString(),relisted_by:actor.email});
    if(!updated)fail(409,'La ficha cambió. Actualizá la lista antes de continuar.');
    return workspaceSummary(updated);
  }
  if(action==='workspace_delete'){
    if(actor.role!=='admin')fail(403,'Acción no autorizada.');
    if(!['DELETE','BORRAR'].includes(String(body.confirmation||'').trim().toUpperCase()))fail(422,'Escribí DELETE o BORRAR para confirmar.');
    if(body.version!==row.version||body.editRevision!==(row.edit_revision||0)||body.publicationRevision!==(row.publication_revision||0))fail(409,'La ficha cambió. Actualizá la lista antes de borrarla.');
    const updated=await repository.update(id,{version:row.version,status:row.status,edit_revision:row.edit_revision,publication_revision:row.publication_revision},{status:'deleted',publication:null,relist_publication:null,relist_owner:null,payload:{id,values:{},buildings:[],files:[]},editorial:{},review:{},feedback:'',file_paths:{},token_hash:null,review_token_hash:null,review_token_expires:null,deleted_by:actor.email,deleted_at:now().toISOString(),edit_revision:(row.edit_revision||0)+1,publication_revision:(row.publication_revision||0)+1});
    if(!updated)fail(409,'La ficha cambió. Actualizá la lista antes de borrarla.');return {deleted:true};
  }
  if(action==='workspace_open'){
    let available=row.payload.files;
    if(!row.last_save_id&&row.status==='draft'){
      const checked=await Promise.all(available.map(async file=>{const object=await repository.inspectFile(filePath(row,file),file);return object?.size===file.size&&validSignature(file.type,object.bytes,object.size)?file:null;}));
      available=checked.filter(Boolean);
    }
    const files=await Promise.all(available.map(async file=>({...file,url:await repository.downloadURL(filePath(row,file))})));
    return {...workspaceSummary(row),draft:{...row.payload,files},ownerEmail:actor.role==='admin'?row.owner_email||null:undefined};
  }
  if(action==='workspace_save_prepare'){
    if(actor.role!=='admin'&&!['draft','changes_requested'].includes(row.status))fail(409,'Reabrí la ficha antes de editarla.');
    if(body.editRevision!==(row.edit_revision||0)||body.version!==row.version)fail(409,'Hay cambios más recientes. Volvé a abrir la ficha.');
    let payload;try{payload=validateDraft(body.draft);}catch(error){fail(422,error.message);}
    if(payload.id!==id)fail(400,'Identificador inválido.');
    const transaction=freshId(),file_paths={},uploads=[],reuse=new Set(Array.isArray(body.reuse)?body.reuse:[]);
    for(const file of payload.files){
      const old=row.payload.files.find(f=>f.id===file.id&&f.size===file.size&&f.type===file.type);
      if(old&&reuse.has(file.id))file_paths[file.id]=filePath(row,old);
      else{const path=id+'/draft-'+transaction+'/'+file.id;file_paths[file.id]=path;uploads.push({id:file.id,url:await repository.uploadURL(path,file)});}
    }
    const guards={version:row.version,edit_revision:row.edit_revision,status:row.status,review_token_hash:row.review_token_hash,publication_revision:row.publication_revision};
    // Missing fields become null in persisted guards, then are restored for comparison.
    await repository.portalCreate('stages',transaction,{id,subject:actor.subject,role:actor.role,payload,file_paths,guards:Object.fromEntries(Object.entries(guards).map(([k,v])=>[k,v??null])),expiresAt:now().getTime()+30*60000},1);
    return {transaction,uploads};
  }
  if(action==='workspace_save_commit'){
    if(!/^[a-f0-9]{64}$/.test(body.transaction||''))fail(400,'Guardado inválido.');
    const stage=await repository.portalGet('stages',body.transaction);
    if(!stage||stage.id!==id||stage.subject!==actor.subject||stage.role!==actor.role||stage.expiresAt<=now().getTime())fail(403,'El guardado venció. Intentá de nuevo.');
    if(row.last_save_id===body.transaction)return workspaceSummary(row);
    if(Object.entries(stage.guards).some(([k,v])=>(row[k]??null)!==v))fail(409,'La ficha cambió mientras guardabas. Volvé a abrirla.');
    for(const file of stage.payload.files){
      const object=await repository.inspectFile(stage.file_paths[file.id],file);
      if(!object||object.size!==file.size||!validSignature(file.type,object.bytes,object.size))fail(422,'No se pudo comprobar el archivo '+file.name+'. Volvé a guardarlo.');
    }
    const filters=Object.fromEntries(Object.keys(stage.guards).map(k=>[k,row[k]]));
    const moved=['lat','lng'].some(key=>stage.payload.values[key]!==row.payload.values[key]);
    const updated=await repository.update(id,filters,{payload:stage.payload,file_paths:stage.file_paths,version:row.version+1,edit_revision:(row.edit_revision||0)+1,status:'draft',last_save_id:body.transaction,review:{},review_token_hash:null,review_token_expires:null,reviewed_by:null,reviewed_at:null,notification_sent:false,...(moved?{editorial:{...row.editorial,place:''}}:{}),updated_at:now().toISOString(),edited_by:actor.email});
    if(!updated)fail(409,'La ficha cambió mientras guardabas. Volvé a abrirla.');return workspaceSummary(updated);
  }
  if(action==='workspace_reopen'||action==='workspace_reopen_owner'){
    if(body.version!==row.version||body.editRevision!==(row.edit_revision||0))fail(409,'La ficha cambió. Volvé a abrirla.');
    if(action==='workspace_reopen_owner'&&actor.role!=='admin')fail(403,'Acción no autorizada.');
    const updated=await repository.update(id,{version:row.version,status:row.status,edit_revision:row.edit_revision},{status:'draft',feedback:'',edit_revision:(row.edit_revision||0)+1,review:{},review_token_hash:null,review_token_expires:null,reviewed_by:actor.email,reviewed_at:now().toISOString(),updated_at:now().toISOString()});
    if(!updated)fail(409,'La ficha cambió. Volvé a abrirla.');return workspaceSummary(updated);
  }
  if(['workspace_submit','workspace_status','workspace_unlist'].includes(action)){
    const delegated=action==='workspace_submit'?'submit':action==='workspace_unlist'?'unpublish':'status';
    const handler=createHandler({repository,mailer,config,now,authorizeOwner:async()=>actor,
      ...(action==='workspace_unlist'?{authorizeReview:async()=>actor}:{})});
    const response=await handler(new Request('https://arenalindex.com/api/intake',{method:'POST',body:JSON.stringify({...body,action:delegated})}));
    const result=await response.json();if(!response.ok)fail(response.status,result.error);
    return {...result,editRevision:row.edit_revision||0};
  }
  fail(400,'Acción no reconocida.');
}
