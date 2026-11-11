/* One photo tour for public listings and buyer offer forms. */
(() => {
  if(typeof window==='undefined')return;
  window.ArenalPhotoTour={open({listing,content,dialog,icon,iconButton,escape,photoCount,motion=window.ArenalMotion||{leave:(node,done)=>done()}}){

    const groups = content.groups(listing);
    if(!groups.length)return;
    window.ArenalAnalytics?.track('gallery_open',listing);
    let offset=0;
    groups.forEach(group=>{group.start=offset;offset+=group.images.length;});
    const flattenPhotos=groups=>groups.flatMap(group=>group.images.map((photo,i)=>({...photo,caption:photo.caption||group.label+' · '+(window.ArenalI18n?.t('Foto {count} de {total}',{count:i+1,total:group.images.length})||'Foto '+(i+1)+' de '+group.images.length)})));
    let tourPhotos=flattenPhotos(groups);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??true;
    const node = dialog('Recorrido fotográfico', `
      <div class="pd-tour-overview">
        <nav class="pd-tour-nav" aria-label="Bloques de fotos">${groups.map((p,i)=>`<button class="pd-tour-link" data-block="${i}" aria-controls="pd-photo-block-${i}" ${i===0?'aria-current="true"':''}><img src="${escape(p.images[0].src)}" alt=""><span><span translate="no">${escape(p.label)}</span><small>${photoCount(p.images.length)}</small></span></button>`).join('')}</nav>
        <div class="pd-tour-scroll" tabindex="0" aria-label="Recorrido por las fotos">
          <p class="pd-tour-note">${photoCount(tourPhotos.length)}${listing.isDemo?' de muestra · imágenes ilustrativas':''}</p>
          ${groups.map((group,i)=>`<section class="pd-tour-block" id="pd-photo-block-${i}" aria-labelledby="pd-photo-title-${i}"><div class="pd-tour-heading"><h3 translate="no" id="pd-photo-title-${i}">${escape(group.label)}</h3><span>${photoCount(group.images.length)}</span></div><div class="pd-tour-grid ${group.images.length%2?'has-lead':''}">${group.images.map((p,j)=>`<button class="pd-tour-photo" data-photo="${group.start+j}" aria-label="Ampliar: ${escape(group.label)}, foto ${j+1}"><img translate="no" src="${escape(p.src)}" alt="${escape(content.photoAlt(p,listing))}" loading="lazy"><span>${icon('grid')}<span class="pd-enlarge-label"> Ampliar</span></span></button>`).join('')}</div></section>`).join('')}
          <p class="pd-tour-end">Fin del recorrido</p>
        </div>
      </div>
      <div class="pd-photo-view" hidden>
        <div class="pd-photo-toolbar"><button class="pd-tour-return">${icon('back')} Volver al recorrido</button><span class="pd-photo-position" role="status" aria-live="polite"></span></div>
        <div class="pd-photo-track" tabindex="0" aria-label="Fotos ampliadas. Deslizá o usá las flechas">${tourPhotos.map(p=>`<div class="pd-photo-slide"><img translate="no" src="${escape(p.src)}" alt="${escape(content.photoAlt(p,listing))}" draggable="false"></div>`).join('')}</div>
        <div class="pd-photo-controls">${iconButton('previous','Foto anterior','back')}<span class="pd-photo-caption" translate="no"></span>${iconButton('next','Foto siguiente','next')}</div>
      </div>`, 'pd-tour');
    const overview=node.querySelector('.pd-tour-overview'), scroller=node.querySelector('.pd-tour-scroll');
    const blocks=[...node.querySelectorAll('.pd-tour-block')], links=[...node.querySelectorAll('.pd-tour-link')];
    const viewer=node.querySelector('.pd-photo-view'),track=node.querySelector('.pd-photo-track');
    const previous=node.querySelector('[data-action="previous"]'),next=node.querySelector('[data-action="next"]');
    let photoIndex=0, photoTrigger=null, scrollFrame=0;
    function markBlock(index) {links.forEach((link,i)=>{if(i===index)link.setAttribute('aria-current','true');else link.removeAttribute('aria-current');}); }
    function jump(index) { markBlock(index);const top=blocks[index].getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop-20;scroller.scrollTo({top,behavior:reduced?'auto':'smooth'}); }
    links.forEach((link,i)=>link.onclick=()=>jump(i));
    scroller.addEventListener('scroll',()=>{if(scrollFrame)return;scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;const threshold=scroller.getBoundingClientRect().top+scroller.clientHeight*.35;let index=0;blocks.forEach((block,i)=>{if(block.getBoundingClientRect().top<=threshold)index=i;});markBlock(index);});},{passive:true});
    function updatePhoto() {Array.from(track.children).forEach((slide,i)=>slide.setAttribute('aria-hidden',String(i!==photoIndex)));node.querySelector('.pd-photo-position').textContent=(photoIndex+1)+' / '+tourPhotos.length;node.querySelector('.pd-photo-caption').textContent=tourPhotos[photoIndex].caption;previous.disabled=photoIndex===0;next.disabled=photoIndex===tourPhotos.length-1;}
    function move(delta) {const target=Math.max(0,Math.min(tourPhotos.length-1,photoIndex+delta));track.scrollTo({left:target*track.clientWidth,behavior:reduced?'auto':'smooth'});}
    function expand(index,trigger) {window.ArenalAnalytics?.photo('photo_open',listing,tourPhotos[index].src);photoTrigger=trigger;photoIndex=index;overview.hidden=true;viewer.hidden=false;node.classList.add('is-photo');updatePhoto();track.scrollTo({left:index*track.clientWidth,behavior:'instant'});node.querySelector('.pd-tour-return').focus({preventScroll:true});}
    function returnToTour() {motion.leave(viewer,()=>{viewer.hidden=true;overview.hidden=false;node.classList.remove('is-photo');photoTrigger?.focus({preventScroll:true});});}
    node.querySelectorAll('[data-photo]').forEach(button=>button.onclick=()=>expand(Number(button.dataset.photo),button));
    node.querySelector('.pd-tour-return').onclick=returnToTour;
    previous.onclick=()=>move(-1);next.onclick=()=>move(1);
    track.addEventListener('scroll',()=>{if(viewer.hidden||!track.clientWidth)return;const nextIndex=Math.max(0,Math.min(tourPhotos.length-1,Math.round(track.scrollLeft/track.clientWidth)));if(nextIndex!==photoIndex){photoIndex=nextIndex;window.ArenalAnalytics?.photo('photo_open',listing,tourPhotos[photoIndex].src);}updatePhoto();},{passive:true});
    node.addEventListener('keydown',e=>{if(e.altKey||e.metaKey||e.ctrlKey)return;if(!viewer.hidden&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}else if(viewer.hidden&&e.target.closest('.pd-tour-nav')&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const focused=links.indexOf(e.target.closest('.pd-tour-link'));const target=e.key==='Home'?0:e.key==='End'?links.length-1:Math.max(0,Math.min(links.length-1,focused+(e.key==='ArrowRight'?1:-1)));links[target].focus();jump(target);}});
    node.addEventListener('cancel',e=>{if(!viewer.hidden){e.preventDefault();returnToTour();}});
    const resize=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>{if(!viewer.hidden)track.scrollTo({left:photoIndex*track.clientWidth,behavior:'instant'});});resize?.observe(track);
    // Rebuild localized copy from the listing, preserving the open tour and its image nodes.
    function refreshLanguage(){
      const localized=content.groups(listing);
      tourPhotos=flattenPhotos(localized);
      const alt=photo=>content.photoAlt(photo,listing);
      localized.forEach((group,i)=>{
        links[i].querySelector('[translate="no"]').textContent=group.label;
        blocks[i].querySelector('h3').textContent=group.label;
        blocks[i].querySelectorAll('[data-photo]').forEach((button,j)=>{
          button.setAttribute('aria-label','Ampliar: '+group.label+', foto '+(j+1));
          button.querySelector('img').alt=alt(group.images[j]);
          window.ArenalI18n?.translate?.(button);
        });
      });
      track.querySelectorAll('img').forEach((img,i)=>img.alt=alt(tourPhotos[i]));
      updatePhoto();
    }
    refreshLanguage();
    window.addEventListener('arenal-language-change',refreshLanguage);
    node.addEventListener('close',()=>{window.removeEventListener('arenal-language-change',refreshLanguage);resize?.disconnect();cancelAnimationFrame(scrollFrame);},{once:true});
    return node;
  }};
})();
