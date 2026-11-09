import {openStore} from './local.mjs';
import {normalizeDraft} from './model.mjs?v=5-pending';
import {createDraftPreview} from './draft-preview.mjs?v=1';

try{
  const isDraft=new URLSearchParams(location.search).get('draft')==='1';
  let item;
  if(isDraft){
    const draft=await(await openStore()).read();
    if(!draft)throw Error('No hay un borrador en este navegador. Volvé a la ficha para preparar tu anuncio.');
    item=createDraftPreview(normalizeDraft(draft),file=>URL.createObjectURL(file.blob));
  }else{
    const raw=JSON.parse(sessionStorage.getItem('arenalindex.public-preview')||'null');
    if(!raw)throw Error('Abrí esta vista desde la ficha o la revisión del anuncio.');
    item=window.ArenalData.normalize(raw);
  }
  window.ArenalPreview=true;
  const saved=[];
  window.arenalDemo={items:[item],state:{saved},toggleSaved(id){const index=saved.indexOf(id);if(index<0)saved.push(id);else saved.splice(index,1);},focusProperty(){if(item.coordinates)window.open('https://www.openstreetmap.org/?mlat='+item.coordinates[1]+'&mlon='+item.coordinates[0]+'#map=15/'+item.coordinates[1]+'/'+item.coordinates[0],'_blank','noopener,noreferrer');}};
  history.replaceState(null,'','#propiedad/'+item.id);
  window.arenalReady=Promise.resolve();
  await import('/property-detail.js?v=11-scroll-guard');
}catch(error){document.querySelector('#index-home p').textContent=error.message;}
