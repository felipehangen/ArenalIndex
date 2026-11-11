import {mountListingActions} from '../admin/actions.mjs?v=6-simple-workflow';
export function adminActionMarkup(draft,{busy=false,conflict=false}={}){
  const s=draft.submission||{},dirty=!!draft.cloud?.dirty,disabled=busy||conflict,action=s.status==='approved'?'publish':s.status==='ready_for_review'?'approve':'prepare';
  const label=action==='prepare'?'Preparar revisión':'Revisar y publicar';
  const needsSave=dirty&&action!=='prepare';
  const button=(name,text,extra='')=>'<button type="button" class="quiet" data-admin-action="'+name+'"'+(disabled?' disabled':'')+extra+'>'+text+'</button>';
  return button('preview','Vista previa')+'<button type="button" class="secondary" data-admin-action="'+action+'"'+(disabled||needsSave?' disabled':'')+(needsSave?' title="Guardá los cambios antes de revisar o publicar."':'')+'>'+label+'</button>'+
    (s.version!==undefined?'<details class="editor-more"><summary>Más acciones</summary><div class="editor-more-menu">'+
      (s.publishedVersion?button('unlist','Deslistar'):'')+
      button('delete','Borrar',' data-destructive')+'</div></details>':'');
}
export function mountAdminEditor({document,window,account,getDraft,isBusy,isConflict,onChange,onPrepare,onPreview}){
  const controls=document.querySelector('#admin-editor-actions');controls.hidden=false;
  const state=document.createElement('span');state.className='toolbar-state';document.querySelector('#account-back').after(state);
  const row=()=>{const d=getDraft(),s=d.submission||{};return {id:account.id,title:d.values.listing_title||d.values.name||account.id,...s,publicationRevision:s.publicationRevision||0,editRevision:d.cloud?.editRevision||0};};
  const controller={getRecords:()=>[row()],refresh:onChange};
  const actions=mountListingActions({document,window,controller,api:account.client});
  controls.onclick=async event=>{
    const button=event.target.closest('[data-admin-action]');if(!button||button.disabled||isBusy())return;
    controls.querySelector('details')?.removeAttribute('open');
    const action=button.dataset.adminAction;
    if(action==='preview'){onPreview();return;}
    if(action==='prepare'){onPrepare();return;}
    if(getDraft().cloud?.dirty&&action!=='delete'){
      window.alert(window.ArenalI18n?.t('Guardá los cambios antes de revisar o publicar.')||'Guardá los cambios antes de revisar o publicar.');return;
    }
    await actions.run(action,row());
  };
  return {review(){if(isBusy()||isConflict()||getDraft().cloud?.dirty)return;return actions.run(getDraft().submission?.status==='approved'?'publish':'approve',row());},render(){const s=getDraft().submission||{};state.textContent=s.publishedVersion?(s.status==='approved'?'Publicado':'Publicado · Cambios en preparación'):s.status==='approved'?'Listo para publicar':s.status==='ready_for_review'?'En revisión':'Borrador';controls.innerHTML=adminActionMarkup(getDraft(),{busy:isBusy(),conflict:isConflict()});}};
}
