import {esc} from './view.mjs?v=5-editor';

// Share the production entry points, including when admin is previewed locally.
const resources=[
  {id:'catalog',url:'https://arenalindex.com/',title:['Explorar propiedades','Explore properties'],description:['El catálogo público con mapa, fotos y propiedades disponibles.','The public catalog with a map, photos, and available properties.']},
  {id:'publishing',url:'https://arenalindex.com/publicar/',title:['Guía para publicar','Publishing guide'],description:['Los requisitos, las reglas y los ejemplos para preparar un anuncio.','Requirements, rules, and examples for preparing a listing.']},
  {id:'account',url:'https://arenalindex.com/cuenta/',title:['Mi cuenta · Mis anuncios','My account · My listings'],description:['Acceso para las personas con una cuenta habilitada por ArenalIndex.','Access for people with an account enabled by ArenalIndex.'],alias:'https://arenalindex.com/account/'},
  {id:'newlisting',url:'https://arenalindex.com/newlisting/',title:['Agregar una propiedad','Add a property'],description:['Abre una ficha nueva después de iniciar sesión. Requiere una cuenta habilitada.','Opens a new property form after signing in. Requires an enabled account.']}
];

export function mountResources({document,window}){
  const root=document.querySelector('#resources-panel');if(!root)return;
  const language=()=>window.ArenalI18n?.language==='en'?1:0;
  const t=(es,en)=>language()?en:es;
  let generation=0;
  function render(){
    generation++;
    root.innerHTML='<div class="resources-heading"><div><h2 id="resources-title">'+t('Enlaces listos para compartir','Links ready to share')+'</h2><p class="muted">'+t('Copiá el enlace que necesitás y pegalo en un mensaje, correo o publicación.','Copy the link you need and paste it into a message, email, or post.')+'</p></div><button type="button" class="quiet" data-copy-resource="all">'+t('Copiar todos los enlaces','Copy all links')+'</button></div>'+
      '<div class="resources-grid">'+resources.map(resource=>{
        const title=resource.title[language()];
        return '<article class="resource-card" aria-labelledby="resource-'+resource.id+'"><h3 id="resource-'+resource.id+'">'+esc(title)+'</h3><p class="muted">'+esc(resource.description[language()])+'</p><a class="resource-url" translate="no" href="'+resource.url+'" target="_blank" rel="noopener noreferrer">'+resource.url+'</a>'+
          (resource.alias?'<p class="resource-alias">'+t('Enlace alternativo:','Alternative link:')+' <a translate="no" href="'+resource.alias+'" target="_blank" rel="noopener noreferrer">'+resource.alias+'</a></p>':'')+
          '<div class="resource-actions"><button type="button" class="primary" data-copy-resource="'+resource.id+'" aria-label="'+esc(t('Copiar enlace: ','Copy link: ')+title)+'">'+t('Copiar enlace','Copy link')+'</button><a class="quiet" href="'+resource.url+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(t('Abrir en otra pestaña: ','Open in a new tab: ')+title)+'">'+t('Abrir','Open')+' <span aria-hidden="true">↗</span></a></div></article>';
      }).join('')+'</div><p class="resource-status" data-resource-status role="status" aria-live="polite"></p><div class="resource-fallback" data-resource-fallback hidden><label for="resource-copy-text">'+t('Seleccioná y copiá este texto:','Select and copy this text:')+'</label><textarea id="resource-copy-text" rows="5" readonly translate="no" spellcheck="false"></textarea></div>';
  }
  root.onclick=async event=>{
    const button=event.target.closest('[data-copy-resource]');if(!button)return;
    const resource=resources.find(item=>item.id===button.dataset.copyResource);
    if(!resource&&button.dataset.copyResource!=='all')return;
    const text=resource?resource.url:resources.map(item=>item.title[language()]+'\n'+item.url+(item.alias?'\n'+item.alias:'')).join('\n\n');
    const current=generation,status=root.querySelector('[data-resource-status]'),fallback=root.querySelector('[data-resource-fallback]');
    status.textContent='';fallback.hidden=true;button.disabled=true;
    try{
      await window.navigator.clipboard.writeText(text);
      if(current===generation)status.textContent=resource?t('Enlace copiado.','Link copied.'):t('Enlaces copiados.','Links copied.');
    }catch{
      if(current!==generation)return;
      status.textContent=t('No se pudo copiar automáticamente. Podés copiar el texto de abajo.','Automatic copying was unavailable. You can copy the text below.');
      fallback.hidden=false;const field=root.querySelector('#resource-copy-text');field.value=text;field.focus();field.select();
    }finally{if(current===generation)button.disabled=false;}
  };
  window.addEventListener('arenal-language-change',render);
  window.addEventListener('arenal-admin-clear',render);
  render();
}
