import {esc} from '../admin/view.mjs?v=10-broker-tools';
import qrcode from '../vendor/qrcode.mjs';

export function collectionURL(profile){
  try{const url=new URL(profile?.url);return url.origin==='https://go.arenalindex.com'&&/^\/collection\/[a-z0-9][a-z0-9-]{0,99}\/$/.test(url.pathname)&&!url.search&&!url.hash?url.href:'';}catch{return '';}
}
export function makeQR(url){const qr=qrcode(0,'M');qr.addData(url);qr.make();return qr.createSvgTag({cellSize:4,margin:16,scalable:true});}
export function mountBrokerResources({document,window}){
  const root=document.querySelector('#resources-panel');let identity=null,generation=0;
  const t=(es,en)=>window.ArenalI18n?.language==='en'?en:es;
  const $=s=>root.querySelector(s);
  const link=(url,label)=>'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+label+'<span aria-hidden="true">↗</span></a>';
  function select(panel){
    for(const tab of document.querySelectorAll('[data-owner-panel]')){
      const active=tab.dataset.ownerPanel===panel;
      if(active)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current');
      document.querySelector('#'+tab.dataset.ownerPanel+'-panel').hidden=!active;
    }
  }
  for(const tab of document.querySelectorAll('[data-owner-panel]'))tab.onclick=()=>select(tab.dataset.ownerPanel);
  function render(){
    generation++;
    const url=collectionURL(identity?.publicPage),name=identity?.publicPage?.name||'ArenalIndex';
    const message=t('Explorá las propiedades de '+name+' en ArenalIndex. Encontrá fotos, ubicación y el contacto de cada anuncio.','Explore properties from '+name+' on ArenalIndex. Find photos, locations, and contact details for each listing.')+'\n'+url;
    const qr=url?makeQR(url):'';
    const email=window.ArenalConfig?.siteContact?.email||'';
    const support=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?'mailto:'+email:'https://arenalindex.com/publicar/#mi-lista';
    root.innerHTML='<h1>'+t('Recursos','Resources')+'</h1><p class="muted">'+t('Enlaces y herramientas para presentar tus propiedades y preparar tu próximo anuncio.','Links and tools to present your properties and prepare your next listing.')+'</p>'+ 
      '<h2 class="resource-section-title">'+t('Compartir con clientes','Share with clients')+'</h2><div class="broker-grid">'+
      '<article class="broker-card collection-card"><h3>'+t('Mi colección pública','My public collection')+'</h3><p>'+t('Un enlace con las propiedades publicadas de tu cuenta.','One link for the published properties in your account.')+'</p>'+
      (url?'<a id="account-public-page" class="resource-url" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(url)+'</a><div class="resource-actions"><button class="primary" data-copy="collection">'+t('Copiar enlace','Copy link')+'</button><a class="quiet" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+t('Abrir colección ↗','Open collection ↗')+'</a></div><details><summary>'+t('Código QR de mi colección','My collection QR code')+'</summary><div class="broker-qr"><div role="img" aria-label="'+t('Código QR de mi colección','My collection QR code')+'">'+qr+'</div><a download="arenalindex-collection-qr.svg" href="data:image/svg+xml;charset=utf-8,'+encodeURIComponent(qr)+'">'+t('Descargar QR','Download QR')+'</a></div></details>':'<p>'+t('Contactá a ArenalIndex para habilitar tu colección pública.','Contact ArenalIndex to enable your public collection.')+'</p>')+'</article>'+
      '<article class="broker-card"><h3>'+t('Mensaje para WhatsApp','WhatsApp message')+'</h3><p>'+t('Copiá el texto y pegalo en la conversación que elijás.','Copy the text and paste it into the conversation you choose.')+'</p>'+(url?'<label for="broker-message">'+t('Mensaje listo para compartir','Ready-to-share message')+'</label><textarea id="broker-message" readonly></textarea><div class="resource-actions"><button class="quiet" data-copy="message">'+t('Copiar mensaje','Copy message')+'</button></div>':'<p>'+t('Disponible cuando tu colección esté habilitada.','Available once your collection is enabled.')+'</p>')+'</article>'+
      '<article class="broker-card"><h3>'+t('ArenalIndex completo','All of ArenalIndex')+'</h3><p>'+t('Explorá todas las propiedades publicadas en ArenalIndex.','Explore all properties published on ArenalIndex.')+'</p><div class="resource-actions"><a class="quiet" href="https://arenalindex.com/" target="_blank" rel="noopener noreferrer">'+t('Abrir catálogo ↗','Open catalog ↗')+'</a><button class="quiet" data-copy="catalog">'+t('Copiar enlace','Copy link')+'</button></div></article>'+
      '<article class="broker-card"><h3>'+t('Fichas imprimibles','Printable property sheets')+'</h3><p>'+t('Abrí «Ficha imprimible» en un anuncio publicado para imprimirlo o guardarlo como PDF. Incluye la portada, el precio, el área, la descripción y el contacto público.','Open “Printable sheet” on a published listing to print it or save it as a PDF. It includes the cover photo, price, area, description, and public contact.')+'</p><div class="resource-actions"><button class="quiet" data-show-listings>'+t('Ir a mis anuncios','Go to my listings')+'</button></div></article></div>'+
      '<h2 class="resource-section-title">'+t('Preparar un anuncio','Prepare a listing')+'</h2><div class="broker-grid"><article class="broker-card"><h3>'+t('Guías y listas','Guides and checklists')+'</h3><ul class="resource-list">'+[
        ['https://arenalindex.com/publicar/',t('Guía para publicar','Publishing guide')],['https://arenalindex.com/publicar/#fotos',t('Lista de fotos necesarias','Photo checklist')],['https://arenalindex.com/publicar/#mi-lista',t('Datos y documentos necesarios','Required information and documents')]
      ].map(([href,label])=>'<li>'+link(href,label)+'</li>').join('')+'</ul></article><article class="broker-card"><h3>'+t('Ayuda de ArenalIndex','ArenalIndex support')+'</h3><p>'+t('Consultá sobre tu cuenta, los requisitos o la preparación de una propiedad.','Get help with your account, requirements, or preparing a property.')+'</p><div class="resource-actions"><a class="quiet" href="'+esc(support)+'">'+t('Contactar al equipo','Contact the team')+'</a></div></article></div><p class="broker-status" role="status" aria-live="polite"></p><div class="copy-fallback" hidden><label for="broker-copy-fallback">'+t('Seleccioná y copiá este texto:','Select and copy this text:')+'</label><textarea id="broker-copy-fallback" readonly></textarea></div>';
    if($('#broker-message'))$('#broker-message').value=message;
  }
  root.onclick=async event=>{
    if(event.target.closest('[data-show-listings]')){select('listings');document.querySelector('[data-owner-panel="listings"]').focus();return;}
    const button=event.target.closest('[data-copy]');if(!button)return;
    const text=button.dataset.copy==='catalog'?'https://arenalindex.com/':button.dataset.copy==='message'?$('#broker-message')?.value:collectionURL(identity?.publicPage);
    if(!text)return;
    const current=generation;button.disabled=true;$('.copy-fallback').hidden=true;$('.broker-status').textContent='';
    try{await window.navigator.clipboard.writeText(text);if(current===generation)$('.broker-status').textContent=t('Copiado.','Copied.');}
    catch{if(current===generation){$('.broker-status').textContent=t('Podés copiar el texto de abajo.','You can copy the text below.');$('.copy-fallback').hidden=false;const field=$('#broker-copy-fallback');field.value=text;field.focus();field.select();}}
    finally{if(current===generation)button.disabled=false;}
  };
  window.addEventListener('arenal-language-change',()=>{if(identity)render();});
  window.addEventListener('arenal-owner-clear',()=>{generation++;identity=null;root.replaceChildren();select('listings');});
  return {setIdentity(value){identity=value;render();}};
}
