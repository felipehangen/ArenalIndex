import * as client from './client.mjs';
import {esc} from './view.mjs?v=4-workflow';
export function mountListingActions({document,window,controller,api=client}){
  const $=s=>document.querySelector(s),t=s=>window.ArenalI18n?.t(s)||s,dialog=$('#listing-dialog'),body=$('#listing-dialog-body');let generation=0,busy=false;
  function open(title,content){generation++;$('#listing-dialog-title').textContent=t(title);body.innerHTML=content;if(!dialog.open)dialog.showModal();}
  $('#listing-dialog-close').onclick=()=>{if(!busy)dialog.close();};
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  dialog.addEventListener('close',()=>{generation++;body.replaceChildren();});
  for(const button of document.querySelectorAll('[data-panel]'))button.onclick=()=>{
    for(const tab of document.querySelectorAll('[data-panel]')){if(tab===button)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current');}
    const accounts=button.dataset.panel==='accounts';$('#accounts-panel').hidden=!accounts;$('#listings-panel').hidden=accounts;$('#owner-accounts').open=accounts;
  };
  window.addEventListener('message',event=>{
    const frame=body.querySelector('iframe');
    if(event.origin!==window.location.origin||!frame||event.source!==frame.contentWindow||event.data?.type!=='arenal-review-saved')return;
    controller.refresh();
  });
  async function mutate(action,row,extra={}){
    return api.request(row.isDemo?'catalog_'+action:'workspace_'+action,{id:row.id,...(row.isDemo?{revision:row.publicationRevision}:{version:row.version,editRevision:row.editRevision,publicationRevision:row.publicationRevision}),...extra});
  }
  function errorMessage(error){if(error.status===401){controller.refresh();return;}const output=body.querySelector('[role=alert]');if(output)output.textContent=t(error.message);}
  $('#admin-records').onclick=async event=>{
    const button=event.target.closest('[data-row-action]');if(!button||busy)return;
    const row=controller.getRecords().find(r=>r.id===button.dataset.id);if(!row)return;
    const action=button.dataset.rowAction;
    if(['approve','publish'].includes(action)&&!row.isDemo){
      open(action==='approve'?'Revisar y aprobar':'Publicar anuncio','<iframe title="'+t('Revisión del anuncio')+'" src="/admin/review/#id='+encodeURIComponent(row.id)+'&focus='+action+'&embedded=1"></iframe>');return;
    }
    if(action==='demo-edit'){
      open('Editar anuncio demo','<p role="status">'+t('Cargando…')+'</p>');const current=generation;
      try{
        const result=await api.request('catalog_open',{id:row.id});if(current!==generation||!api.session())return;
        const listing=result.listing,language=listing.details?.language||'es',title=lang=>language===lang?listing.name:listing.details?.translations?.[lang]?.title||'';
        body.innerHTML='<form class="demo-edit-form"><p class="muted">'+t('Este es un anuncio de demostración.')+'</p><label>'+t('Título en español')+'<input name="titleEs" maxlength="45" value="'+esc(title('es'))+'"></label><label>'+t('Título en inglés')+'<input name="titleEn" maxlength="45" value="'+esc(title('en'))+'"></label><div class="dialog-fields"><label>'+t('Precio')+'<input name="price" type="number" min="0" step="any" required value="'+esc(listing.price)+'"></label><label>'+t('Moneda')+'<select name="currency"><option'+(listing.currency!=='CRC'?' selected':'')+'>USD</option><option'+(listing.currency==='CRC'?' selected':'')+'>CRC</option></select></label></div><label>'+t('Área total del terreno (m²)')+'<input name="area" type="number" min="1" step="any" max="999999999" required value="'+esc(listing.area)+'"></label><label>'+t('Localidad')+'<input name="place" maxlength="100" required value="'+esc(listing.place)+'"></label><p role="alert"></p><button class="primary" type="submit">'+t('Guardar cambios')+'</button></form>';
        body.querySelector('form').onsubmit=async e=>{
          e.preventDefault();if(busy)return;busy=true;const submit=body.querySelector('[type=submit]');submit.disabled=true;
          try{const listing=Object.fromEntries([...body.querySelectorAll('[name]')].map(el=>[el.name,el.value]));await api.request('catalog_update',{id:row.id,revision:result.revision,listing});dialog.close();await controller.refresh();}catch(error){errorMessage(error);}finally{busy=false;submit.disabled=false;}
        };
      }catch(error){if(current===generation)body.innerHTML='<p role="alert">'+esc(t(error.message))+'</p>';}
      return;
    }
    const title=action==='delete'?'¿Borrar este anuncio?':action==='unlist'?'¿Deslistar este anuncio?':'¿Publicar este anuncio demo?';
    const copy=action==='delete'?'Se quitará de la cuenta y del catálogo. Esta acción no se puede deshacer.':action==='unlist'?'Dejará de aparecer en el catálogo. La ficha se conserva para publicarla después.':'El anuncio demo volverá a estar visible en el catálogo.';
    open(title,'<p translate="no" class="confirm-property">'+esc(row.title)+'</p><p>'+t(copy)+'</p><p role="alert"></p><div class="dialog-actions"><button class="quiet" data-cancel>'+t('Cancelar')+'</button><button class="primary '+(action==='delete'?'danger':'')+'" data-confirm>'+t(action==='delete'?'Borrar':action==='unlist'?'Deslistar':'Publicar')+'</button></div>');
    body.querySelector('[data-cancel]').onclick=()=>dialog.close();
    body.querySelector('[data-confirm]').onclick=async()=>{
      if(busy)return;busy=true;const submit=body.querySelector('[data-confirm]');submit.disabled=true;
      try{await mutate(action,row);dialog.close();await controller.refresh();}catch(error){errorMessage(error);}finally{busy=false;submit.disabled=false;}
    };
  };
}
