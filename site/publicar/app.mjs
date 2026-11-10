import {rulesMarkup} from './rules.mjs';

export function mountGuide({document,window,navigator=globalThis.navigator,storage}={}){
  const $=s=>document.querySelector(s),checks=[...document.querySelectorAll('[data-ready]')];
  const key='arenalindex.publication-checklist.v1',lang=()=>window.ArenalI18n?.language==='en'?'en':'es';
  const copy=(es,en)=>lang()==='en'?en:es;
  try{storage??=globalThis.localStorage;const saved=JSON.parse(storage.getItem(key)||'[]');if(Array.isArray(saved))checks.forEach(input=>{input.checked=saved.includes(input.value);});}catch{}
  function update(){
    const count=checks.filter(input=>input.checked).length;
    $('#ready-count').textContent=copy(count+' de '+checks.length+' preparados',count+' of '+checks.length+' ready');
    $('#ready-progress').style.width=(100*count/checks.length)+'%';
    $('#ready-message').textContent=count===checks.length?copy('Tenés lo básico preparado. Conversemos sobre tu cuenta y los próximos pasos.','You have the basics ready. Let’s discuss your account and the next steps.'):copy('¿Tenés una duda o querés empezar? Conversemos sobre tu propiedad.','Have a question or ready to start? Let’s talk about your property.');
    $('#standard-rules').innerHTML=rulesMarkup(lang(),{cards:true});
    const contact=window.ArenalConfig?.siteContact||{},message=copy('Hola, leí la guía para publicar en ArenalIndex. Me gustaría conversar sobre mi propiedad y coordinar el acceso a mi cuenta.','Hello, I read the ArenalIndex listing guide. I would like to discuss my property and arrange access to my account.');
    const whatsapp=$('#contact-whatsapp'),email=$('#contact-email');
    whatsapp.hidden=!/^\d{8,15}$/.test(contact.whatsapp||'');email.hidden=!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email||'');
    if(!whatsapp.hidden)whatsapp.href='https://wa.me/'+contact.whatsapp+'?text='+encodeURIComponent(message);
    if(!email.hidden)email.href='mailto:'+encodeURIComponent(contact.email)+'?subject='+encodeURIComponent(copy('Publicar en ArenalIndex','Listing on ArenalIndex'))+'&body='+encodeURIComponent(message);
    $('#contact-unavailable').hidden=!whatsapp.hidden||!email.hidden;
    const meta=document.querySelector('meta[name=description]');
    meta.content=copy('Conocé los requisitos para publicar en ArenalIndex: plano, entrada exacta, fotos, datos y revisión. Una guía clara antes de solicitar tu cuenta.','Learn what you need to list on ArenalIndex: cadastral plan, exact entrance, photos, facts, and review. A clear guide before requesting your account.');
  }
  const save=()=>{try{storage.setItem(key,JSON.stringify(checks.filter(input=>input.checked).map(input=>input.value)));}catch{}update();};
  checks.forEach(input=>input.addEventListener('change',save));
  $('#reset-list').onclick=()=>{checks.forEach(input=>{input.checked=false;});save();};
  $('#print-guide').onclick=()=>window.print();
  $('#share-guide').onclick=async()=>{
    const url='https://arenalindex.com/publicar/?lang='+lang();
    try{await navigator.clipboard.writeText(url);$('#share-status').textContent=copy('Enlace copiado. Ya podés compartirlo.','Link copied. It is ready to share.');$('#share-url').hidden=true;}
    catch{$('#share-url').value=url;$('#share-url').hidden=false;$('#share-url').focus();$('#share-url').select();$('#share-status').textContent=copy('Copiá este enlace para compartir la guía.','Copy this link to share the guide.');}
  };
  window.addEventListener('arenal-language-change',()=>{$('#share-status').textContent='';$('#share-url').hidden=true;update();});
  const requested=new URLSearchParams(window.location.search).get('lang');
  if(['es','en'].includes(requested))window.ArenalI18n?.setLanguage(requested,{persist:true});
  update();
}
if(typeof document!=='undefined'&&document.querySelector('#standard-rules'))mountGuide({document,window});
