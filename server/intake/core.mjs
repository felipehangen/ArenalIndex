import {validateDraft,pending,buyerCopy,knownConcerns,validSignature,reference,normalizeReview} from '../../site/newlisting/model.mjs';
import {createPublication} from './publication.mjs';
export const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const summary=row=>({status:row.status,version:row.version,editRevision:row.edit_revision||0,feedback:row.feedback||'',notificationSent:row.notification_sent===true,publishedVersion:row.publication?.version||null,publicationRevision:row.publication_revision||0});
const filePath=(row,file)=>row.file_paths?.[file.id]||row.id+'/'+row.version+'/'+file.id;
export function createHandler({repository,mailer,config,now=()=>new Date(),authorizeReview,authorizeOwner,resolveLocality}){
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
      const reviewAction=['review','approve','request_changes','publish','unpublish','preview_publication'].includes(action);
      const admin=reviewAction&&authorizeReview?await authorizeReview(request):null;
      const owner=!reviewAction&&authorizeOwner?await authorizeOwner(request):null;
      const token=request.headers.get(reviewAction?'X-Review-Token':'X-Intake-Token')||'';
      if(!admin&&!owner&&!/^[a-f0-9]{64}$/.test(token))fail(401,'El enlace o la autorización no son válidos.');
      const tokenHash=admin||owner?null:await digest(token);
      if(action==='prepare'&&config.requireAccountCreation&&!owner&&!admin)fail(401,'Iniciá sesión para agregar un anuncio.');
      const id=action==='prepare'?body.draft?.id:body.id;
      if(!/^[a-zA-Z0-9-]{8,80}$/.test(id||''))fail(400,'Identificador inválido.');
      let row=await repository.get(id);
      if(row?.status==='deleted')fail(404,'No se encontró la ficha.');
      if(admin||owner){if(!row||owner&&owner.role!=='admin'&&row.owner_subject!==owner.subject)fail(404,'No se encontró la ficha.');}
      else if(reviewAction){
        if(!row||row.review_token_hash!==tokenHash||!row.review_token_expires||new Date(row.review_token_expires)<=now())fail(403,'El enlace de revisión venció o fue reemplazado por una nueva versión.');
      }else if(row&&row.token_hash!==tokenHash)fail(403,'No se puede acceder a esta ficha.');
      if(row?.owner_subject&&!reviewAction&&!owner)fail(401,'Abrí esta ficha desde Mis anuncios e iniciá sesión.');
      if(!admin&&!owner&&!await repository.allow('token:'+tokenHash,80))fail(429,'Demasiadas solicitudes. Intentá más tarde.');
      // Also compare the review-token revision for admins, so a seller reopening
      // a record cannot race an approval or publication of the old version.
      const reviewGuard={review_token_hash:admin?row?.review_token_hash:tokenHash};
      if(action==='prepare'){
        if(row?.edit_revision&&!owner&&!admin)fail(409,'Esta ficha cambió en ArenalIndex. Abrila desde Mis anuncios para continuar con la versión actual.');
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
          const object=await repository.inspectFile(filePath(row,file),file);
          if(!object||object.size!==file.size||!validSignature(file.type,object.bytes,object.size))fail(422,'No se pudo comprobar el archivo '+file.name+'. Volvé a enviarlo.');
        }
        // The review secret is reproducible for retrying the same immutable version.
        const reviewToken=await digest(config.reviewSecret+':'+id+':'+row.version+(row.edit_revision?':'+row.edit_revision:''));
        const updates={status:'ready_for_review',review_token_hash:await digest(reviewToken),review_token_expires:new Date(now().getTime()+7*86400000).toISOString(),updated_at:now().toISOString()};
        const submitted=await repository.update(id,{version:row.version,status:row.status,edit_revision:row.edit_revision,review_token_hash:row.review_token_hash},updates);
        if(!submitted)fail(409,'La ficha cambió. Actualizá su estado.');
        try{
          await mailer.send({id,version:row.version,title:reference(row.payload),fileCount:row.payload.files.length,url:config.siteURL+'/newlisting/review/#id='+encodeURIComponent(id)+'&token='+reviewToken,idempotencyKey:'intake-'+id+'-v'+row.version});
          await repository.update(id,{version:row.version,status:'ready_for_review',edit_revision:row.edit_revision,review_token_hash:updates.review_token_hash},{notification_sent:true});
          return respond({...summary(submitted),notificationSent:true});
        }catch{
          // The submission is durably stored. Retrying submit sends the same idempotent email.
          return respond({...summary(submitted),notificationSent:false});
        }
      }
      if(action==='review'){
        // Prepared uploads are unverified until submit finishes; do not sign them for review.
        const files=row.status==='draft'&&!row.last_save_id?[]:await Promise.all(row.payload.files.map(async file=>({...file,url:await repository.downloadURL(filePath(row,file))})));
        const locality=resolveLocality?await resolveLocality(row.payload.values):null;
        return respond({...summary(row),id,draft:{...row.payload,files},review:row.review,editorial:row.editorial||{},locality,ownerEmail:admin?row.owner_email||null:undefined,copy:buyerCopy(row.payload,row.review),concerns:knownConcerns(row.payload,row.review)});
      }
      if(['publish','unpublish','preview_publication'].includes(action)){
        if(body.version!==row.version)fail(409,'La versión cambió. Recargá la revisión.');
        if(action!=='preview_publication'&&body.publicationRevision!==(row.publication_revision||0))fail(409,'La publicación cambió. Recargá la revisión.');
        let publication=null;
        if(action!=='unpublish'){
          if(action==='publish'&&body.confirmed!==true)fail(422,'Confirmá los datos públicos y las fotografías antes de publicar.');
          try{publication=createPublication(row,body.editorial||{},{apiURL:config.publicAPIURL,date:now().toISOString()});}catch(error){fail(422,error.message);}
          // Every publication uses a server-generated, metadata-free image, even
          // for older drafts or clients that skipped browser-side optimization.
          for(const [photoId,file] of Object.entries(publication.media))publication.media[photoId]=await repository.publicPhoto(file.path,file);
          if(action==='preview_publication'){
            const images=new Map();
            for(const group of publication.listing.details.photoGroups)for(const photo of group.photos){const url=await repository.downloadURL(publication.media[photo.id].path);images.set(photo.src,url);photo.src=url;}
            publication.listing.images=publication.listing.images.map(src=>images.get(src));
            return respond({listing:publication.listing});
          }
          // The discovery entry is harmless until the atomic record update succeeds.
          await repository.ensurePublishedIndex(id);
        }
        const editorial=publication?{title:publication.listing.name,place:publication.listing.place,description:publication.listing.description,language:publication.listing.details.language,titleTranslation:publication.listing.details.translations[publication.listing.details.language==='es'?'en':'es'].title||'',descriptionTranslation:publication.listing.details.translations[publication.listing.details.language==='es'?'en':'es'].description||'',whatsapp:publication.listing.details.contact?.whatsapp||''}:row.editorial||{};
        const updated=await repository.update(id,{version:row.version,status:row.status,...reviewGuard,publication_revision:row.publication_revision},{publication,editorial,publication_revision:(row.publication_revision||0)+1,published_by:admin?.email||config.reviewEmail,unlisted_at:action==='unpublish'?now().toISOString():null,updated_at:now().toISOString()});
        if(!updated)fail(409,'La ficha cambió. Recargá la revisión antes de publicar.');
        return respond({...summary(updated),editorial,url:publication?config.siteURL+'/#propiedad/'+publication.listing.id:null});
      }
      if(['approve','request_changes'].includes(action)){
        if(body.version!==row.version||row.status!=='ready_for_review')fail(409,'Esta versión ya cambió o fue revisada. Abrí la ficha actual.');
        const feedback=typeof body.feedback==='string'?body.feedback.trim().slice(0,3000):'';
        const review=normalizeReview(body.review);
        if(action==='request_changes'){
          if(!feedback)fail(422,'Indicá los cambios necesarios.');
          const updated=await repository.update(id,{version:row.version,status:'ready_for_review',...reviewGuard},{status:'changes_requested',review,feedback,reviewed_at:now().toISOString(),reviewed_by:admin?.email||config.reviewEmail,updated_at:now().toISOString()});
          if(!updated)fail(409,'La ficha cambió durante la revisión.');
          return respond(summary(updated));
        }

        const issues=pending(row.payload,{publication:true,review});
        if(issues.length)fail(422,'Antes de aprobar: '+issues.map(i=>i.label).join(', '));
        const updated=await repository.update(id,{version:row.version,status:'ready_for_review',...reviewGuard},{status:'approved',review,feedback,reviewed_at:now().toISOString(),reviewed_by:admin?.email||config.reviewEmail,updated_at:now().toISOString()});
        if(!updated)fail(409,'La ficha cambió durante la revisión.');
        return respond(summary(updated));
      }
      fail(400,'Acción no reconocida.');
    }catch(error){
      return respond({error:error.status?error.message:error instanceof SyntaxError?'Solicitud inválida.':'No se pudo completar la operación. Intentá de nuevo.'},error.status|| (error instanceof SyntaxError?400:500));
    }
  };
}
