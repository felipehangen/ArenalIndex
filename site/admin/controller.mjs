import * as client from './client.mjs';
import {selectRecords,renderRows} from './view.mjs?v=9-simple-workflow';
import {createGoogleLoader} from './google-loader.mjs';

let googleLoader;
export function loadGoogle(language){googleLoader??=createGoogleLoader({window,document});return googleLoader(language);}

export function mountAdmin({document,window,api=client,googleLoader=loadGoogle,schedule=setTimeout,cancel=clearTimeout,now=Date.now,owner=false,onSignedIn=()=>{}}){
  const $=selector=>document.querySelector(selector);
  const t=(text,values)=>window.ArenalI18n?.t(text,values)||text.replace(/\{(\w+)\}/g,(_,key)=>values?.[key]??'');
  let epoch=0,expiryTimer,records=[],loaded=false,google,config,activeIdentity;
  function clearPrivate(){
    cancel(expiryTimer);records=[];loaded=false;$('#admin-records').replaceChildren();$('#admin-account').textContent='';$('#admin-count').textContent='';
    $('#admin-search').value='';$('#inbox').hidden=true;$('#sign-out').hidden=true;$('#inbox-error').hidden=true;$('#admin-empty').hidden=true;
    if($('#listing-dialog')?.open)$('#listing-dialog').close();
    if($('#listing-dialog-body'))$('#listing-dialog-body').replaceChildren();
    if($('[data-accounts]'))$('[data-accounts]').replaceChildren();
    if($('#owner-accounts output')){$('#owner-accounts output').textContent='';$('#owner-accounts output').hidden=true;}
    for(const panel of document.querySelectorAll('#owner-accounts'))panel.open=false;
    for(const node of document.querySelectorAll('#owner-accounts input, #password-panel input, #email-login input'))node.value='';
    for(const node of document.querySelectorAll('#owner-accounts [role=status], #password-status'))node.textContent='';
    if($('#password-panel'))$('#password-panel').hidden=true;
    if($('#rules-panel')){$('#rules-panel').hidden=true;$('#rules-accept').checked=false;$('#rules-submit').disabled=true;$('#rules-status').textContent='';$('#rules-account').textContent='';$('#rules-list').replaceChildren();}
    if($('#accounts-panel')){$('#accounts-panel').hidden=true;$('#listings-panel').hidden=false;for(const tab of document.querySelectorAll('[data-panel]')){if(tab.dataset.panel==='listings')tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current');}}
    activeIdentity=null;
    if($('#resources-panel'))$('#resources-panel').hidden=true;
    if($('#analytics-panel')){$('#analytics-panel').hidden=true;$('#analytics-panel').replaceChildren();window.dispatchEvent(new window.CustomEvent('arenal-admin-clear'));}
  }
  function loginMessage(message,retry=false){$('#login-status').textContent=t(message);$('#login-status').classList.toggle('login-error',retry&&!!message);$('#retry-login').hidden=!retry;}
  function showLogin(message){
    ++epoch;clearPrivate();$('#login-panel').hidden=false;$('#google-button').replaceChildren();loginMessage(message,true);
  }
  function expire(){api.clearSession();showLogin(owner?'Tu sesión venció. Volvé a entrar.':'Tu sesión venció. Volvé a entrar con Google.');}
  function render(){
    if(!loaded)return;
    const shown=selectRecords(records,{status:$('#admin-status').value,query:$('#admin-search').value,source:$('#admin-source')?.value||'all'});
    $('#admin-records').innerHTML=renderRows(shown,{owner});$('#admin-empty').hidden=shown.length>0;
    $('#admin-count').textContent=t('{shown} de {total} anuncios',{shown:shown.length,total:records.length});
  }
  async function refresh(){
    const current=++epoch;loaded=false;records=[];$('#admin-records').replaceChildren();$('#admin-empty').hidden=true;$('#inbox-error').hidden=true;
    $('#refresh').disabled=true;$('#admin-records').setAttribute('aria-busy','true');$('#admin-count').textContent=t('Cargando propuestas…');
    try{
      const found=new Map(),visited=new Set();let cursor;
      do{
        const page=await api.request('list',cursor?{cursor}:{});
        if(current!==epoch)return;
        for(const row of page.records)found.set(row.id,row);
        cursor=page.cursor;
        if(cursor&&visited.has(cursor))throw Error('No se pudieron cargar todas las propuestas. Intentá actualizar.');
        visited.add(cursor);
      }while(cursor);
      if(!api.session()){expire();return;}
      records=[...found.values()];loaded=true;render();
    }catch(error){
      if(current!==epoch)return;
      if(error.status===401){expire();return;}
      if(owner&&error.code==='listing_rules_required'){
        try{const identity=await api.request('session');if(current===epoch)await openInbox(identity);}
        catch{if(current===epoch)expire();}return;
      }
      $('#admin-count').textContent='';$('#inbox-error').hidden=false;$('#inbox-error').textContent=t('No se pudieron cargar todas las propuestas. Intentá actualizar.');
    }finally{if(current===epoch){$('#refresh').disabled=false;$('#admin-records').setAttribute('aria-busy','false');}}
  }
  async function openInbox(identity){
    if(!api.session()){expire();return;}
    activeIdentity=identity;
    if(owner)for(const node of $('#password-panel').querySelectorAll('input'))node.value='';
    cancel(expiryTimer);expiryTimer=schedule(expire,Math.max(0,identity.expiresAt-now()));
    if(owner&&identity.requiresRulesAcceptance){showRules(identity);return;}
    if($('#rules-panel'))$('#rules-panel').hidden=true;
    if(owner&&identity.requiresPasswordChange){showPassword(identity);return;}
    if($('#password-panel'))$('#password-panel').hidden=true;
    const destination=new URLSearchParams(window.location.hash.slice(1)),edit=destination.get('edit'),review=destination.get('review');
    if((owner&&edit==='new')||/^[a-zA-Z0-9-]{8,80}$/.test(edit||'')){window.location.replace('/newlisting/?'+(owner?'cuenta':'admin')+'='+encodeURIComponent(edit)+'&edit=1');return;}
    if(!owner&&/^[a-zA-Z0-9-]{8,80}$/.test(review||'')){window.location.replace('/admin/review/#id='+encodeURIComponent(review));return;}
    $('#login-panel').hidden=true;$('#inbox').hidden=false;$('#sign-out').hidden=false;$('#admin-account').textContent=identity.email;
    await refresh();
    if(api.session()&&!$('#inbox').hidden)await onSignedIn(identity);
  }
  function renderRules(){
    const rules=activeIdentity?.listingRules;if(!rules||!Array.isArray(rules.clauses))return;
    const language=window.ArenalI18n?.language==='en'?'en':'es';
    $('#rules-list').replaceChildren();
    for(const clause of rules.clauses){
      const item=document.createElement('li'),title=document.createElement('strong'),body=document.createElement('p');
      title.textContent=clause[language].title;body.textContent=clause[language].body;item.append(title,body);$('#rules-list').append(item);
    }
    $('#rules-consent').textContent=rules.consent[language];$('#rules-version').textContent=rules.version;
  }
  function showRules(identity){
    ++epoch;$('#inbox').hidden=true;$('#login-panel').hidden=true;$('#password-panel').hidden=true;$('#rules-panel').hidden=false;$('#sign-out').hidden=false;
    $('#rules-account').textContent=identity.email;$('#rules-accept').checked=false;$('#rules-submit').disabled=true;$('#rules-status').textContent='';renderRules();
    $('#rules-title').focus();
  }
  function showPassword(identity){
    ++epoch;$('#inbox').hidden=true;$('#login-panel').hidden=true;$('#password-panel').hidden=false;$('#sign-out').hidden=false;
    $('#password-note').textContent=t(identity.requiresPasswordChange?'Elegí una contraseña personal para reemplazar la temporal y abrir tus fichas.':'Usá al menos 12 caracteres. Podés combinar varias palabras.');
    $('#current-password-label').hidden=identity.requiresPasswordChange||identity.method!=='password';
    $('#current-password').required=!$('#current-password-label').hidden;
    $('#password-back').hidden=!!identity.requiresPasswordChange;$('#password-status').textContent='';
    for(const node of $('#password-panel').querySelectorAll('input'))node.value='';
  }
  async function prepareGoogle(message=''){
    const current=++epoch;
    $('#google-button').replaceChildren();loginMessage(message||'Preparando acceso con Google…',!!message);
    try{
      config=await api.request('config',{},false);if(current!==epoch)return;
      if(!config.configured){loginMessage('El acceso con Google todavía no está configurado.',true);return;}
      const challenge=await api.request('challenge',{},false);if(current!==epoch)return;
      const language=window.ArenalI18n?.language||'es';
      google=await googleLoader(language);if(current!==epoch)return;
      google.initialize({client_id:config.clientId,nonce:challenge.nonce,auto_select:false,
        callback:async response=>{
          if(current!==epoch)return;
          const attempt=++epoch;$('#google-button').replaceChildren();loginMessage('Verificando tu cuenta…');
          try{
            const identity=await api.request('login',{credential:response.credential,nonce:challenge.nonce},false);
            if(attempt!==epoch)return;
            api.saveSession(identity);await openInbox(identity);
          }catch(error){if(attempt===epoch){google?.disableAutoSelect();await prepareGoogle(error.message);}}
        }
      });
      google.renderButton($('#google-button'),{type:'standard',theme:'outline',size:'large',text:'signin_with',shape:'pill',locale:language,width:Math.min(300,$('#google-button').clientWidth||300)});
      loginMessage(message,!!message);
    }catch(error){if(current===epoch)loginMessage(error.message,true);}
  }
  async function start(){
    const current=++epoch;clearPrivate();$('#login-panel').hidden=false;loginMessage('Comprobando acceso…');
    if(api.session()){
      try{const identity=await api.request('session');if(current===epoch)await openInbox(identity);return;}
      catch(error){if(current!==epoch)return;if(error.status!==401){loginMessage('No se pudo comprobar tu sesión. Revisá la conexión e intentá de nuevo.',true);return;}api.clearSession();}
    }
    await prepareGoogle();
  }
  $('#retry-login').onclick=start;
  if(owner){
    $('#rules-accept').onchange=()=>{$('#rules-submit').disabled=!$('#rules-accept').checked;};
    $('#rules-decline').onclick=()=>$('#sign-out').click();
    $('#rules-form').onsubmit=async event=>{
      event.preventDefault();if(!$('#rules-accept').checked)return;
      const current=epoch,rules=activeIdentity?.listingRules,button=$('#rules-submit');if(!rules)return;button.disabled=true;$('#rules-status').textContent=t('Guardando tu aceptación…');
      try{
        await api.request('accept_listing_rules',{accepted:true,version:rules.version,contentHash:rules.contentHash,language:window.ArenalI18n?.language==='en'?'en':'es'});if(current!==epoch)return;
        const identity=await api.request('session');if(current!==epoch)return;
        await openInbox(identity);
      }catch(error){if(current===epoch){if(error.status===401)expire();else $('#rules-status').textContent=t(error.message);}}
      finally{if(current===epoch)button.disabled=!$('#rules-accept').checked;}
    };
    $('#email-login').onsubmit=async event=>{
      event.preventDefault();const current=++epoch,button=$('#email-login button');button.disabled=true;$('#google-button').replaceChildren();
      const email=$('#owner-email').value.trim(),password=$('#owner-password').value;$('#owner-password').value='';loginMessage('Verificando tu cuenta…');
      try{
        const identity=await api.request('login_password',{email,password},false);if(current!==epoch)return;
        api.saveSession(identity);await openInbox(identity);
      }catch(error){if(current===epoch)await prepareGoogle(error.message);}finally{button.disabled=false;}
    };
    $('#change-password').onclick=()=>showPassword(activeIdentity);
    $('#password-back').onclick=()=>openInbox(activeIdentity);
    $('#password-form').onsubmit=async event=>{
      event.preventDefault();const current=epoch,password=$('#new-password').value;
      if(password!==$('#confirm-password').value){$('#password-status').textContent=t('Las contraseñas no coinciden.');return;}
      const button=$('#password-form button[type=submit]'),currentPassword=$('#current-password').value;button.disabled=true;
      try{
        await api.request('change_password',{password,currentPassword});if(current!==epoch)return;
        const identity=await api.request('session');if(current!==epoch)return;
        for(const node of $('#password-panel').querySelectorAll('input'))node.value='';
        await openInbox(identity);
      }catch(error){if(current===epoch){if(error.status===401)expire();else $('#password-status').textContent=t(error.message);}}
      finally{button.disabled=false;}
    };
  }
  $('#sign-out').onclick=async()=>{
    showLogin('Cerrando sesión…');$('#retry-login').hidden=true;const current=epoch;
    try{await api.logout();google?.disableAutoSelect();if(current===epoch)await prepareGoogle();}
    catch{if(current===epoch)loginMessage('Se cerró el acceso en esta pestaña, pero no se pudo revocar la sesión en el servidor. Vence en un máximo de 8 horas.',true);}
  };
  $('#refresh').onclick=refresh;$('#admin-search').oninput=render;$('#admin-status').onchange=render;
  if($('#admin-source'))$('#admin-source').onchange=render;
  if(owner)$('#admin-records').onclick=async event=>{
    const button=event.target.closest('[data-unlist],[data-relist]');if(!button)return;
    const relist=button.hasAttribute('data-relist');
    const row=records.find(row=>row.id===(relist?button.dataset.relist:button.dataset.unlist));if(!row)return;
    if(!window.confirm(t(relist?'¿Volver a enlistar la misma versión publicada, sin cambios?':'¿Retirar este anuncio del catálogo público? La ficha y sus documentos se conservan.')))return;
    button.disabled=true;
    try{await api.request(relist?'workspace_relist':'workspace_unlist',{id:row.id,version:row.version,publicationRevision:row.publicationRevision,...(relist?{editRevision:row.editRevision}:{})});await refresh();}
    catch(error){if(error.status===401)expire();else{$('#inbox-error').hidden=false;$('#inbox-error').textContent=t(error.message);button.disabled=false;}}
  };
  window.addEventListener('arenal-language-change',()=>{render();if(owner&&!$('#rules-panel').hidden)renderRules();if(!$('#login-panel').hidden&&config?.configured)prepareGoogle();});
  window.addEventListener('pageshow',event=>{if(event.persisted)start();});
  window.addEventListener('focus',()=>{if(!$('#inbox').hidden&&!api.session())expire();});
  const ready=start();
  return {ready,refresh,expire,getRecords:()=>records,destroy(){++epoch;clearPrivate();}};
}
