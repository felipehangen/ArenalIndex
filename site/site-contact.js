/* Available independently of the catalog, including while listings are loading. */
(() => {
  const dialog=document.getElementById('site-contact');
  if(!dialog)return;
  const contact=window.ArenalConfig?.siteContact||{};
  const whatsapp=dialog.querySelector('[data-contact-whatsapp]');
  const email=dialog.querySelector('[data-contact-email]');
  const instagram=dialog.querySelector('[data-contact-instagram]');
  let trigger;
  const t=source=>window.ArenalI18n?.t(source)||source;
  function updateLinks(){
    const message=t('Hola, me gustaría publicar una propiedad en ArenalIndex. ¿Cómo puedo empezar?');
    whatsapp.hidden=!/^\d{8,15}$/.test(contact.whatsapp||'');
    if(!whatsapp.hidden)whatsapp.setAttribute('href','https://wa.me/'+contact.whatsapp+'?text='+encodeURIComponent(message));
    email.hidden=!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email||'');
    if(!email.hidden)email.setAttribute('href','mailto:'+encodeURIComponent(contact.email)+'?subject='+encodeURIComponent(t('Publicar una propiedad en ArenalIndex'))+'&body='+encodeURIComponent(message));
    instagram.hidden=true;
    try{
      const url=new URL(contact.instagramUrl);
      if(url.protocol==='https:'&&['instagram.com','www.instagram.com'].includes(url.hostname)&&url.pathname!=='/'&&!url.username&&!url.password){
        instagram.setAttribute('href',url.href);instagram.hidden=false;
      }
    }catch{}
  }
  document.querySelectorAll('[data-contact-open]').forEach(button=>button.addEventListener('click',()=>{
    trigger=button;updateLinks();window.ArenalI18n?.translate(dialog);
    dialog.showModal();
  }));
  dialog.querySelector('[data-contact-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
  });
  dialog.addEventListener('close',()=>trigger?.isConnected&&trigger.focus({preventScroll:true}));
  window.addEventListener('arenal-language-change',updateLinks);
  updateLinks();
})();
