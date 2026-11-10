import * as client from './client.mjs';
import {selectRecords,renderRows} from './view.mjs';

let googleScript;
export function loadGoogle(){
  if(window.google?.accounts?.id)return Promise.resolve(window.google.accounts.id);
  if(!googleScript)googleScript=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
    const timer=setTimeout(()=>{script.remove();googleScript=null;reject(Error('No se pudo cargar Google. Revisá la conexión e intentá de nuevo.'));},20000);
    script.onload=()=>{clearTimeout(timer);resolve(window.google.accounts.id);};
    script.onerror=()=>{clearTimeout(timer);script.remove();googleScript=null;reject(Error('No se pudo cargar Google. Revisá la conexión e intentá de nuevo.'));};
    document.head.append(script);
  });
  return googleScript;
}

export function mountAdmin({document,window,api=client,googleLoader=loadGoogle,schedule=setTimeout,cancel=clearTimeout,now=Date.now}){
  const $=selector=>document.querySelector(selector);
  const t=(text,values)=>window.ArenalI18n?.t(text,values)||text.replace(/\{(\w+)\}/g,(_,key)=>values?.[key]??'');
  let epoch=0,expiryTimer,records=[],loaded=false,google,config;
  function clearPrivate(){
    cancel(expiryTimer);records=[];loaded=false;$('#admin-records').replaceChildren();$('#admin-account').textContent='';$('#admin-count').textContent='';
    $('#admin-search').value='';$('#inbox').hidden=true;$('#sign-out').hidden=true;$('#inbox-error').hidden=true;$('#admin-empty').hidden=true;
  }
  function loginMessage(message,retry=false){$('#login-status').textContent=t(message);$('#retry-login').hidden=!retry;}
  function showLogin(message){
    ++epoch;clearPrivate();$('#login-panel').hidden=false;$('#google-button').replaceChildren();loginMessage(message,true);
  }
  function expire(){api.clearSession();showLogin('Tu sesión venció. Volvé a entrar con Google.');}
  function render(){
    if(!loaded)return;
    const shown=selectRecords(records,{status:$('#admin-status').value,query:$('#admin-search').value});
    $('#admin-records').innerHTML=renderRows(shown);$('#admin-empty').hidden=shown.length>0;
    $('#admin-count').textContent=t('{shown} de {total} propuestas',{shown:shown.length,total:records.length});
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
      $('#admin-count').textContent='';$('#inbox-error').hidden=false;$('#inbox-error').textContent=t('No se pudieron cargar todas las propuestas. Intentá actualizar.');
    }finally{if(current===epoch){$('#refresh').disabled=false;$('#admin-records').setAttribute('aria-busy','false');}}
  }
  async function openInbox(identity){
    if(!api.session()){expire();return;}
    const target=new URLSearchParams(window.location.hash.slice(1)).get('review');
    if(/^[a-zA-Z0-9-]{8,80}$/.test(target||'')){window.location.replace('/admin/review/#id='+encodeURIComponent(target));return;}
    $('#login-panel').hidden=true;$('#inbox').hidden=false;$('#sign-out').hidden=false;$('#admin-account').textContent=identity.email;
    cancel(expiryTimer);expiryTimer=schedule(expire,Math.max(0,identity.expiresAt-now()));
    await refresh();
  }
  async function prepareGoogle(){
    const current=++epoch;
    $('#google-button').replaceChildren();loginMessage('Preparando acceso con Google…');
    try{
      config=await api.request('config',{},false);if(current!==epoch)return;
      if(!config.configured){loginMessage('El acceso con Google todavía no está configurado.',true);return;}
      const challenge=await api.request('challenge',{},false);if(current!==epoch)return;
      google=await googleLoader();if(current!==epoch)return;
      google.initialize({client_id:config.clientId,nonce:challenge.nonce,auto_select:false,
        callback:async response=>{
          if(current!==epoch)return;
          const attempt=++epoch;$('#google-button').replaceChildren();loginMessage('Verificando tu cuenta…');
          try{
            const identity=await api.request('login',{credential:response.credential,nonce:challenge.nonce},false);
            if(attempt!==epoch)return;
            api.saveSession(identity);await openInbox(identity);
          }catch(error){if(attempt===epoch)loginMessage(error.message,true);}
        }
      });
      google.renderButton($('#google-button'),{type:'standard',theme:'outline',size:'large',text:'signin_with',shape:'pill',locale:window.ArenalI18n?.language||'es',width:Math.min(300,$('#google-button').clientWidth||300)});
      loginMessage('');
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
  $('#sign-out').onclick=async()=>{
    showLogin('Cerrando sesión…');$('#retry-login').hidden=true;const current=epoch;
    try{await api.logout();google?.disableAutoSelect();if(current===epoch)await prepareGoogle();}
    catch{if(current===epoch)loginMessage('Se cerró el acceso en esta pestaña, pero no se pudo revocar la sesión en el servidor. Vence en un máximo de 8 horas.',true);}
  };
  $('#refresh').onclick=refresh;$('#admin-search').oninput=render;$('#admin-status').onchange=render;
  window.addEventListener('arenal-language-change',()=>{render();if(!$('#login-panel').hidden&&google&&config?.configured)prepareGoogle();});
  window.addEventListener('pageshow',event=>{if(event.persisted)start();});
  window.addEventListener('focus',()=>{if(!$('#inbox').hidden&&!api.session())expire();});
  const ready=start();
  return {ready,refresh,destroy(){++epoch;clearPrivate();}};
}
