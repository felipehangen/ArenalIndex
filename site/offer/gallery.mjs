import {esc} from './view.mjs?v=4';
export function mountGallery({document,window}){
  const dialog=document.createElement('dialog');dialog.className='offer-gallery';dialog.setAttribute('aria-labelledby','offer-gallery-title');dialog.setAttribute('translate','no');document.body.append(dialog);
  let images=[],index=0,trigger,property,returning=false;
  const lang=()=>window.ArenalI18n?.language==='en'?'en':'es',t=(es,en)=>lang()==='en'?en:es,$=s=>dialog.querySelector(s);
  function update(){
    if(!images.length)return;
    $('.offer-gallery-track').setAttribute('aria-label',t('Fotos: deslizá o usá las flechas','Photos: swipe or use arrow keys'));
    dialog.querySelectorAll('img').forEach((img,i)=>img.alt=(property.titles?.[lang()]||property.name)+' · '+(i+1));
    $('#offer-gallery-title').textContent=property.titles?.[lang()]||property.name;
    $('[data-gallery-close]').setAttribute('aria-label',t('Cerrar fotos','Close photos'));
    $('[data-gallery-prev]').setAttribute('aria-label',t('Foto anterior','Previous photo'));$('[data-gallery-next]').setAttribute('aria-label',t('Foto siguiente','Next photo'));
    $('[data-gallery-prev]').disabled=index===0;$('[data-gallery-next]').disabled=index===images.length-1;
    $('.offer-gallery-status').textContent=(index+1)+' / '+images.length+(property.isDemo?' · '+t('Fotos ilustrativas','Illustrative photos'):'');
  }
  function move(next){index=Math.max(0,Math.min(images.length-1,next));const track=$('.offer-gallery-track');track.scrollTo?.({left:index*track.clientWidth,behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});update();}
  function close(){if(dialog.hasAttribute('open')){if(dialog.close)dialog.close();else dialog.removeAttribute('open');}if(trigger?.isConnected)trigger.focus({preventScroll:true});else document.querySelector('[data-photos]')?.focus({preventScroll:true});returning=false;}
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('click',event=>{
    if(event.target.closest('[data-gallery-close]'))close();
    if(event.target.closest('[data-gallery-prev]'))move(index-1);
    if(event.target.closest('[data-gallery-next]'))move(index+1);
    if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}
  });
  dialog.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();move(index+(event.key==='ArrowRight'?1:-1));}});
  window.addEventListener('arenal-language-change',()=>{if(returning)update();});
  window.addEventListener('resize',()=>{if(returning){const track=$('.offer-gallery-track');track.scrollTo?.({left:index*track.clientWidth,behavior:'instant'});}});
  return {close,open(p,photos,button){
    if(!photos.length)return;property=p;images=photos;trigger=button;index=0;returning=true;
    dialog.innerHTML='<header><h2 id="offer-gallery-title"></h2><button class="quiet" data-gallery-close>×</button></header><div class="offer-gallery-track" tabindex="0" role="region" aria-roledescription="carousel" aria-label="'+t('Fotos: deslizá o usá las flechas','Photos: swipe or use arrow keys')+'">'+images.map((src,i)=>'<div class="offer-gallery-slide"><img src="'+esc(src)+'" alt="'+esc(p.titles?.[lang()]||p.name)+' · '+(i+1)+'" '+(i?'loading="lazy"':'')+' draggable="false" referrerpolicy="no-referrer"><p hidden>'+t('No se pudo cargar esta foto.','This photo could not load.')+'</p></div>').join('')+'</div><footer><button class="quiet" data-gallery-prev>←</button><p class="offer-gallery-status" role="status"></p><button class="quiet" data-gallery-next>→</button></footer>';
    for(const img of dialog.querySelectorAll('img'))img.addEventListener('error',()=>{img.hidden=true;img.nextElementSibling.hidden=false;});
    const track=$('.offer-gallery-track');track.addEventListener('scroll',()=>{if(track.clientWidth>0){index=Math.max(0,Math.min(images.length-1,Math.round(track.scrollLeft/track.clientWidth)));update();}},{passive:true});
    update();if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');$('[data-gallery-close]').focus({preventScroll:true});
  }};
}
