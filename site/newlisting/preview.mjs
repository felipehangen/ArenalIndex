import {openStore} from './local.mjs';
import {accountContext} from './account.mjs?v=4-editor';
import {normalizeDraft} from './model.mjs?v=12-title-examples';
import {createDraftPreview} from './draft-preview.mjs?v=11-title-examples';

try{
  const isDraft=new URLSearchParams(location.search).get('draft')==='1';
  let item;
  if(isDraft){
    const account=await accountContext();
    const draft=await(await openStore(account?.key)).read();
    if(!draft)throw Error('No hay un borrador en este navegador. Volvé a la ficha para preparar tu anuncio.');
    item=createDraftPreview(normalizeDraft(draft),file=>URL.createObjectURL(file.blob));
  }else{
    const raw=JSON.parse(sessionStorage.getItem('arenalindex.public-preview')||'null');
    if(!raw)throw Error('Abrí esta vista desde la ficha o la revisión del anuncio.');
    item=window.ArenalData.normalize(raw);
  }
  window.ArenalPreview=true;
  const saved=[];
  window.arenalDemo={pricing:window.ArenalPricing.create([item]),items:[item],state:{saved,filters:{currency:'USD'}},toggleSaved(id){const index=saved.indexOf(id);if(index<0)saved.push(id);else saved.splice(index,1);},focusProperty(){if(item.coordinates)window.open('https://www.openstreetmap.org/?mlat='+item.coordinates[1]+'&mlon='+item.coordinates[0]+'#map=15/'+item.coordinates[1]+'/'+item.coordinates[0],'_blank','noopener,noreferrer');}};
  history.replaceState(null,'','#propiedad/'+item.id);
  window.arenalReady=Promise.resolve();
  await import('/property-detail.js?v=11-photo-counts');
}catch(error){document.querySelector('#index-home p').textContent=error.message;}
