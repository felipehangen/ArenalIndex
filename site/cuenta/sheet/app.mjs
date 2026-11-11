import {loadSheet} from './data.mjs?v=1';
import {renderSheet} from './view.mjs?v=1';
const $=s=>document.querySelector(s),t=(es,en)=>window.ArenalI18n?.language==='en'?en:es;
const params=new URLSearchParams(location.search),id=params.get('id'),slug=params.get('collection');
let listing,collection,publicURL,failed=false;
function render(){
  if(failed){$('#sheet-status').textContent=t('Esta propiedad no está publicada o no se pudo cargar. Volvé a Mis anuncios e intentá de nuevo.','This property is not published or could not be loaded. Return to My listings and try again.');return;}
  if(!listing)return;
  document.title=(listing.details?.translations?.[window.ArenalI18n?.language]?.title||listing.name)+' · ArenalIndex';
  $('#property-sheet').innerHTML=renderSheet(listing,{language:window.ArenalI18n?.language,collection,url:publicURL});
  $('#property-sheet').hidden=false;$('#sheet-status').hidden=true;$('#print-sheet').disabled=false;
}
$('#print-sheet').onclick=async()=>{
  const button=$('#print-sheet');button.disabled=true;
  try{await Promise.all([...document.images].map(img=>img.decode?.().catch(()=>{})));window.print();}finally{button.disabled=false;}
};
window.addEventListener('arenal-language-change',render);
try{
  ({listing,collection,publicURL}=await loadSheet({id,slug,endpoint:window.ArenalConfig.listingsUrl}));
  render();
}catch{failed=true;$('#sheet-status').setAttribute('role','alert');render();}
