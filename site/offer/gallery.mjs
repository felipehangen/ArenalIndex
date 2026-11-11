import {esc,propertyPhotos} from './view.mjs?v=6';
export function mountGallery({document,window}){
  let active,trigger;
  const paths={back:'<path d="m14 6-6 6 6 6"/>',next:'<path d="m10 6 6 6-6 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'};
  const icon=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[name]+'</svg>';
  const iconButton=(action,label,name)=>'<button type="button" class="pd-icon" data-action="'+action+'" aria-label="'+label+'">'+icon(name)+'</button>';
  function restoreFocus(){if(trigger?.isConnected)trigger.focus({preventScroll:true});else document.querySelector('[data-photos]')?.focus({preventScroll:true});}
  function close(){if(!active)return;if(active.close)active.close();else{active.removeAttribute('open');active.dispatchEvent(new window.Event('close'));}}
  function dialog(title,html,extra){
    const node=document.createElement('dialog');node.className='pd-dialog '+extra;node.setAttribute('aria-label',title);
    node.innerHTML='<div class="pd-dialog-head"><h2>'+title+'</h2>'+iconButton('close-dialog','Cerrar','close')+'</div>'+html;
    document.body.append(node);active=node;
    node.querySelector('[data-action="close-dialog"]').onclick=close;
    node.addEventListener('cancel',event=>{if(node.classList.contains('is-photo'))return;event.preventDefault();close();});
    node.addEventListener('click',event=>{if(event.target!==node)return;const r=node.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();});
    node.addEventListener('close',()=>{if(active===node)active=null;node.remove();restoreFocus();},{once:true});
    if(node.showModal)node.showModal();else node.setAttribute('open','');
    node.querySelector('[data-action="close-dialog"]').focus({preventScroll:true});
    window.ArenalI18n?.translate?.(node);
    return node;
  }
  return {close,open(property,images,button){
    close();if(!images.length)return;trigger=button;
    const allowed=new Set(images),photoGroups=(property.photoGroups||[]).map(group=>({...group,photos:group.photos.map(photo=>({...photo,src:propertyPhotos({images:[photo.src]})[0]})).filter(photo=>allowed.has(photo.src))})).filter(group=>group.photos.length);
    const listing={...property,images,details:{photoGroups,buildings:(property.photoBuildingNames||[]).map(name=>({name}))}};
    return window.ArenalPhotoTour.open({listing,content:window.ArenalListing,dialog,icon,iconButton,escape:esc,photoCount:count=>count+(count===1?' foto':' fotos')});
  }};
}
