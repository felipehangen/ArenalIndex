import * as client from './client.mjs';
import {esc} from './view.mjs?v=5-editor';
export function mountListingActions({document,window,controller,api=client}){
  const $=s=>document.querySelector(s),t=s=>window.ArenalI18n?.t(s)||s,dialog=$('#listing-dialog'),body=$('#listing-dialog-body');let generation=0,busy=false;
  function open(title,content){generation++;$('#listing-dialog-title').textContent=t(title);body.innerHTML=content;if(!dialog.open)dialog.showModal();}
  $('#listing-dialog-close').onclick=()=>{if(!busy)dialog.close();};
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  dialog.addEventListener('close',()=>{generation++;body.replaceChildren();});
  for(const button of document.querySelectorAll('[data-panel]'))button.onclick=()=>{
    for(const tab of document.querySelectorAll('[data-panel]')){if(tab===button)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current');}
    const selected=button.dataset.panel;for(const name of ['listings','accounts','analytics','resources']){const panel=$('#'+name+'-panel');if(panel)panel.hidden=name!==selected;}$('#owner-accounts').open=selected==='accounts';window.dispatchEvent(new window.CustomEvent('arenal-admin-panel',{detail:selected}));
  };
  window.addEventListener('message',event=>{
    const frame=body.querySelector('iframe');
    if(event.origin!==window.location.origin||!frame||event.source!==frame.contentWindow||event.data?.type!=='arenal-review-saved')return;
    controller.refresh();
  });
  async function mutate(action,row,extra={}){
    return api.request(row.isDemo?'catalog_'+action:'workspace_'+(action==='reopen'?'reopen_owner':action),{id:row.id,...(row.isDemo?{revision:row.publicationRevision}:{version:row.version,editRevision:row.editRevision,publicationRevision:row.publicationRevision}),...extra});
  }
  function errorMessage(error){if(error.status===401){controller.refresh();return;}const output=body.querySelector('[role=alert]');if(output)output.textContent=t(error.message);}
  async function run(action,row){
    if(busy||!row||!api.session())return;
    if(['approve','publish'].includes(action)&&!row.isDemo){
      open(action==='approve'?'Revisar y aprobar':'Publicar anuncio','<iframe title="'+t('Revisión del anuncio')+'" src="/admin/review/#id='+encodeURIComponent(row.id)+'&focus='+action+'&embedded=1"></iframe>');return;
    }
    if(action==='demo-edit'){
      open('Editar anuncio demo','<p role="status">'+t('Cargando…')+'</p>');const current=generation;
      try{
        const result=await api.request('catalog_open',{id:row.id});if(current!==generation||!api.session())return;
        const listing=result.listing,language=listing.details?.language||'es',title=lang=>language===lang?listing.name:listing.details?.translations?.[lang]?.title||'';
        body.innerHTML='<form class="demo-edit-form"><p class="muted">'+t('Este es un anuncio de demostración.')+'</p><label>'+t('Título en español')+'<input name="titleEs" lang="es" translate="no" maxlength="45" value="'+esc(title('es'))+'"></label><label>'+t('Título en inglés')+'<input name="titleEn" lang="en" translate="no" maxlength="45" value="'+esc(title('en'))+'"></label><div class="dialog-fields"><label>'+t('Precio')+'<input name="price" type="number" min="0" step="any" required value="'+esc(listing.price)+'"></label><label>'+t('Moneda')+'<select name="currency"><option'+(listing.currency!=='CRC'?' selected':'')+'>USD</option><option'+(listing.currency==='CRC'?' selected':'')+'>CRC</option></select></label></div><label>'+t('Área total del terreno (m²)')+'<input name="area" type="number" min="1" step="any" max="999999999" required value="'+esc(listing.area)+'"></label><label>'+t('Localidad')+'<input name="place" maxlength="100" required value="'+esc(listing.place)+'"></label><p role="alert"></p><div class="demo-editor-actions"><div class="demo-management">'+(row.publishedVersion?'<button type="button" class="quiet" data-demo-action="unlist">'+t('Deslistar')+'</button>':'<button type="button" class="quiet" data-demo-action="publish">'+t('Publicar')+'</button>')+'<button type="button" class="quiet danger-text" data-demo-action="delete">'+t('Borrar')+'</button></div><button class="primary" type="submit">'+t('Guardar cambios')+'</button></div></form>';
        const readForm=()=>JSON.stringify([...body.querySelectorAll('[name]')].map(el=>el.value)),initialForm=readForm();
        for(const control of body.querySelectorAll('[data-demo-action]'))control.onclick=()=>{
          if(control.dataset.demoAction!=='delete'&&readForm()!==initialForm&&!window.confirm(t('Hay cambios sin guardar. ¿Descartarlos y continuar?')))return;
          run(control.dataset.demoAction,{...row,publicationRevision:result.revision});
        };
        body.querySelector('form').onsubmit=async e=>{
          e.preventDefault();if(busy)return;busy=true;const submit=body.querySelector('[type=submit]');submit.disabled=true;
          try{const listing=Object.fromEntries([...body.querySelectorAll('[name]')].map(el=>[el.name,el.value]));await api.request('catalog_update',{id:row.id,revision:result.revision,listing});dialog.close();await controller.refresh();}catch(error){errorMessage(error);}finally{busy=false;submit.disabled=false;}
        };
      }catch(error){if(current===generation)body.innerHTML='<p role="alert">'+esc(t(error.message))+'</p>';}
      return;
    }
    const title=action==='delete'?'¿Borrar este anuncio?':action==='unlist'?'¿Deslistar este anuncio?':action==='reopen'?'¿Reabrir como borrador?':'¿Publicar este anuncio demo?';
    const copy=action==='delete'?'Se quitará de la cuenta y del catálogo. Esta acción no se puede deshacer.':action==='unlist'?'Dejará de aparecer en el catálogo. La ficha se conserva para publicarla después.':action==='reopen'?'La ficha volverá a borrador para editar. Podés coordinar las correcciones por llamada o WhatsApp. El anuncio publicado se conserva.':'El anuncio demo volverá a estar visible en el catálogo.';
    open(title,'<p translate="no" class="confirm-property">'+esc(row.title)+'</p><p>'+t(copy)+'</p>'+(action==='delete'?'<label class="delete-confirmation">'+t('Escribí DELETE o BORRAR para confirmar.')+'<input data-delete-confirmation type="text" translate="no" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>':'')+'<p role="alert"></p><div class="dialog-actions"><button class="quiet" data-cancel>'+t('Cancelar')+'</button><button class="primary '+(action==='delete'?'danger':'')+'" data-confirm'+(action==='delete'?' disabled':'')+'>'+t(action==='delete'?'Borrar':action==='unlist'?'Deslistar':action==='reopen'?'Reabrir como borrador':'Publicar')+'</button></div>');
    const confirmation=body.querySelector('[data-delete-confirmation]');
    const confirmed=()=>action!=='delete'||['DELETE','BORRAR'].includes(confirmation?.value.trim().toUpperCase());
    if(confirmation){confirmation.oninput=()=>body.querySelector('[data-confirm]').disabled=!confirmed();confirmation.focus();}
    body.querySelector('[data-cancel]').onclick=()=>dialog.close();
    body.querySelector('[data-confirm]').onclick=async()=>{
      if(busy||!confirmed())return;busy=true;const submit=body.querySelector('[data-confirm]');submit.disabled=true;
      try{await mutate(action,row,action==='delete'?{confirmation:confirmation.value.trim().toUpperCase()}:{});dialog.close();await controller.refresh({action,id:row.id});}catch(error){errorMessage(error);}finally{busy=false;submit.disabled=!confirmed();}
    };
  }
  if($('#admin-records'))$('#admin-records').onclick=async event=>{
    const button=event.target.closest('[data-row-action]');if(!button)return;
    await run(button.dataset.rowAction,controller.getRecords().find(r=>r.id===button.dataset.id));
  };
  return {run};
}
