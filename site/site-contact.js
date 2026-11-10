/* Available independently of the catalog, including while listings are loading. */
(() => {
  const dialog=document.getElementById('site-contact');
  if(!dialog)return;
  const menu=document.getElementById('site-menu'),menuTrigger=document.querySelector('[data-menu-open]');
  const contact=window.ArenalConfig?.siteContact||{};
  let trigger,menuReturn=menuTrigger;
  const t=source=>window.ArenalI18n?.t(source)||source;
  function updateLinks(){
    const message=link=>t(link.dataset.contactPurpose==='general'?'Hola, tengo una consulta sobre ArenalIndex.':'Hola, me gustaría publicar una propiedad en ArenalIndex. ¿Cómo puedo empezar?');
    document.querySelectorAll('[data-contact-whatsapp]').forEach(whatsapp=>{
      whatsapp.hidden=!/^\d{8,15}$/.test(contact.whatsapp||'');
      if(!whatsapp.hidden)whatsapp.setAttribute('href','https://wa.me/'+contact.whatsapp+'?text='+encodeURIComponent(message(whatsapp)));
    });
    document.querySelectorAll('[data-contact-email]').forEach(email=>{
      email.hidden=!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email||'');
      const subject=t(email.dataset.contactPurpose==='general'?'Consulta sobre ArenalIndex':'Publicar una propiedad en ArenalIndex');
      if(!email.hidden)email.setAttribute('href','mailto:'+encodeURIComponent(contact.email)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(message(email)));
    });
    document.querySelectorAll('[data-contact-instagram]').forEach(instagram=>{
    instagram.hidden=true;
    try{
      const url=new URL(contact.instagramUrl);
      if(url.protocol==='https:'&&['instagram.com','www.instagram.com'].includes(url.hostname)&&url.pathname!=='/'&&!url.username&&!url.password){
        instagram.setAttribute('href',url.href);instagram.hidden=false;
      }
    }catch{}
    });
    menu?.querySelectorAll('[data-menu-language]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.menuLanguage===(window.ArenalI18n?.language||'es'))));
  }
  document.querySelectorAll('[data-contact-open]').forEach(button=>button.addEventListener('click',()=>{
    trigger=menu?.contains(button)?menuTrigger:button;
    if(menu?.open)menu.close();
    updateLinks();window.ArenalI18n?.translate(dialog);
    dialog.showModal();
  }));
  menuTrigger?.addEventListener('click',()=>{menuReturn=menuTrigger;updateLinks();window.ArenalI18n?.translate(menu);menu.showModal();});
  menu?.querySelector('[data-menu-close]').addEventListener('click',()=>menu.close());
  menu?.querySelectorAll('[data-menu-language]').forEach(button=>button.addEventListener('click',()=>window.ArenalI18n?.setLanguage(button.dataset.menuLanguage)));
  const root=document.getElementById('arenal-index-dos');
  const browseButtons=[...menu?.querySelectorAll('[data-browse-to]')||[]];
  const syncBrowse=()=>{for(const button of browseButtons)button.disabled=root?.dataset.catalog!=='ready';};
  if(root)new MutationObserver(syncBrowse).observe(root,{attributes:true,attributeFilter:['data-catalog']});
  syncBrowse();
  for(const button of browseButtons)button.addEventListener('click',()=>{
    if(button.disabled)return;
    const target=document.getElementById(button.dataset.browseTo==='saved'?'index-saved':'nav-explore');
    menuReturn=target;menu.close();target?.click();
  });
  const restoreFocus=button=>{
    if(button?.getClientRects().length)button.focus({preventScroll:true});
    else document.querySelector('#nav-explore')?.focus({preventScroll:true});
  };
  dialog.querySelector('[data-contact-close]').addEventListener('click',()=>dialog.close());
  for(const panel of [dialog,menu].filter(Boolean))panel.addEventListener('click',event=>{
    if(event.target!==panel)return;
    const r=panel.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)panel.close();
  });
  dialog.addEventListener('close',()=>restoreFocus(trigger));
  menu?.addEventListener('close',()=>{if(!dialog.open)restoreFocus(menuReturn);});
  window.addEventListener('arenal-language-change',updateLinks);
  updateLinks();
})();
