import {validateDraft,pending,buyerCopy,knownConcerns,validSignature,reference,normalizeReview} from '../../site/newlisting/model.mjs';
export const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const summary=row=>({status:row.status,version:row.version,feedback:row.feedback||'',notificationSent:row.notification_sent===true});
export function createHandler({repository,mailer,config,now=()=>new Date()}){
  const origins=new Set(config.origins||['https://arenalindex.com','https://www.arenalindex.com']);
  return async request=>{
    const origin=request.headers.get('Origin');
    const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
    if(origin&&origins.has(origin))headers['Access-Control-Allow-Origin']=origin;
    const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
    if(origin&&!origins.has(origin))return respond({error:'Origen no autorizado.'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type,apikey,x-intake-token,x-review-token','Access-Control-Max-Age':'600'}});
    if(request.method!=='POST')return respond({error:'Método no permitido.'},405);
    try{
      const raw=await request.text();if(raw.length>250000)fail(413,'La ficha es demasiado grande.');
      const body=JSON.parse(raw),action=body.action;
      if(action==='health')return respond({ready:!!config.emailReady&&await repository.health()});
      const reviewAction=['review','approve','request_changes'].includes(action);
      const token=request.headers.get(reviewAction?'X-Review-Token':'X-Intake-Token')||'';
      if(!/^[a-f0-9]{64}$/.test(token))fail(401,'El enlace o la autorización no son válidos.');
      const tokenHash=await digest(token);
      const id=action==='prepare'?body.draft?.id:body.id;
      if(!/^[a-zA-Z0-9-]{8,80}$/.test(id||''))fail(400,'Identificador inválido.');
      let row=await repository.get(id);
      if(reviewAction){
        if(!row||row.review_token_hash!==tokenHash||!row.review_token_expires||new Date(row.review_token_expires)<=now())fail(403,'El enlace de revisión venció o fue reemplazado por una nueva versión.');
      }else if(row&&row.token_hash!==tokenHash)fail(403,'No se puede acceder a esta ficha.');
      if(!await repository.allow('token:'+tokenHash,80))fail(429,'Demasiadas solicitudes. Intentá más tarde.');
      if(action==='prepare'){
        if(!config.emailReady)fail(503,'El envío todavía no está habilitado.');
        let payload;
        try{payload=validateDraft(body.draft);}catch(error){fail(422,error.message);}
        const issues=pending(payload);if(issues.length)fail(422,'Completá antes de enviar: '+issues.map(i=>i.label).join(', '));
        if(row&&row.status!=='draft')fail(409,'La ficha ya fue enviada. Actualizá su estado antes de editar.');
        if(!row){
          const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
          if(!await repository.allow('new:'+await digest(ip+config.rateSalt),5))fail(429,'Se alcanzó el límite de nuevas fichas. Intentá más tarde.');
          row=await repository.create({id,token_hash:tokenHash,payload,version:0,status:'draft'});
          if(!row)fail(409,'La ficha se está preparando. Intentá de nuevo.');
        }
        const version=row.version+1;
        const prepared=await repository.update(id,{version:row.version,status:'draft'},{payload,version,status:'draft',review:{},feedback:'',review_token_hash:null,review_token_expires:null,notification_sent:false,reviewed_at:null,reviewed_by:null,updated_at:now().toISOString()});
        if(!prepared)fail(409,'La ficha cambió mientras se preparaba. Intentá de nuevo.');
        const uploads=await Promise.all(payload.files.map(async file=>({id:file.id,url:await repository.uploadURL(id+'/'+version+'/'+file.id,file)})));
        return respond({version,uploads});
      }
      if(!row)fail(404,'No se encontró la ficha.');
      if(action==='status')return respond(summary(row));
      if(action==='reopen'){
        if(body.version!==row.version)fail(409,'Hay una versión más reciente. Actualizá el estado.');
        const updated=await repository.update(id,{version:row.version,status:row.status},{status:'draft',review:{},review_token_hash:null,review_token_expires:null,reviewed_at:null,reviewed_by:null,updated_at:now().toISOString()});
        if(!updated)fail(409,'La ficha cambió. Actualizá su estado.');
        return respond(summary(updated));
      }
      if(action==='submit'){
        if(body.version!==row.version)fail(409,'La versión de la ficha cambió.');
        if(row.status==='ready_for_review'&&row.notification_sent)return respond(summary(row));
        if(!['draft','ready_for_review'].includes(row.status))fail(409,'La ficha ya fue revisada.');
        const issues=pending(row.payload);if(issues.length)fail(422,'La ficha tiene datos pendientes.');
        if(row.status==='draft')for(const file of row.payload.files){
          const object=await repository.inspectFile(id+'/'+row.version+'/'+file.id,file);
          if(!object||object.size!==file.size||!validSignature(file.type,object.bytes,object.size))fail(422,'No se pudo comprobar el archivo '+file.name+'. Volvé a enviarlo.');
        }
        // The review secret is reproducible for retrying the same immutable version.
        const reviewToken=await digest(config.reviewSecret+':'+id+':'+row.version);
        const updates={status:'ready_for_review',review_token_hash:await digest(reviewToken),review_token_expires:new Date(now().getTime()+7*86400000).toISOString(),updated_at:now().toISOString()};
        const submitted=await repository.update(id,{version:row.version,status:row.status},updates);
        if(!submitted)fail(409,'La ficha cambió. Actualizá su estado.');
        try{
          await mailer.send({id,version:row.version,title:reference(row.payload),fileCount:row.payload.files.length,url:config.siteURL+'/newlisting/review/#id='+encodeURIComponent(id)+'&token='+reviewToken,idempotencyKey:'intake-'+id+'-v'+row.version});
          await repository.update(id,{version:row.version,status:'ready_for_review'},{notification_sent:true});
          return respond({...summary(submitted),notificationSent:true});
        }catch{
          // The submission is durably stored. Retrying submit sends the same idempotent email.
          return respond({...summary(submitted),notificationSent:false});
        }
      }
      if(action==='review'){
        const files=await Promise.all(row.payload.files.map(async file=>({...file,url:await repository.downloadURL(id+'/'+row.version+'/'+file.id)})));
        return respond({...summary(row),id,draft:{...row.payload,files},review:row.review,copy:buyerCopy(row.payload,row.review),concerns:knownConcerns(row.payload,row.review)});
      }
      if(['approve','request_changes'].includes(action)){
        if(body.version!==row.version||row.status!=='ready_for_review')fail(409,'Esta versión ya cambió o fue revisada. Abrí la ficha actual.');
        const feedback=typeof body.feedback==='string'?body.feedback.trim().slice(0,3000):'';
        const review=normalizeReview(body.review);
        if(action==='request_changes'){
          if(!feedback)fail(422,'Indicá los cambios necesarios.');
          const updated=await repository.update(id,{version:row.version,status:'ready_for_review',review_token_hash:tokenHash},{status:'changes_requested',review,feedback,reviewed_at:now().toISOString(),reviewed_by:config.reviewEmail});
          if(!updated)fail(409,'La ficha cambió durante la revisión.');
          return respond(summary(updated));
        }

        const issues=pending(row.payload,{publication:true,review});
        if(issues.length)fail(422,'Antes de aprobar: '+issues.map(i=>i.label).join(', '));
        const updated=await repository.update(id,{version:row.version,status:'ready_for_review',review_token_hash:tokenHash},{status:'approved',review,feedback,reviewed_at:now().toISOString(),reviewed_by:config.reviewEmail,updated_at:now().toISOString()});
        if(!updated)fail(409,'La ficha cambió durante la revisión.');
        return respond(summary(updated));
      }
      fail(400,'Acción no reconocida.');
    }catch(error){
      return respond({error:error.status?error.message:error instanceof SyntaxError?'Solicitud inválida.':'No se pudo completar la operación. Intentá de nuevo.'},error.status|| (error instanceof SyntaxError?400:500));
    }
  };
}
