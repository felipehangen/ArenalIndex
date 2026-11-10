import * as client from './client.mjs';
import {esc} from './view.mjs';
export function mountAccounts({document=globalThis.document,window=globalThis.window,api=client}={}){
  const panel=document.querySelector('#owner-accounts');if(!panel)return;
  const t=text=>window.ArenalI18n?.t(text)||text,token=api.session()?.token,valid=()=>token&&api.session()?.token===token;
  const form=panel.querySelector('form'),email=form.querySelector('[name=email]'),password=form.querySelector('[name=password]'),output=panel.querySelector('output'),message=panel.querySelector('[role=status]'),list=panel.querySelector('[data-accounts]');
  let loaded=false,loading=false;
  async function refresh(){
    if(loading||!valid())return;loading=true;list.setAttribute('aria-busy','true');
    try{
      const {accounts}=await api.request('owner_accounts');if(!valid())return;
      list.innerHTML=accounts.map(row=>'<div class="account-row"><div><strong translate="no">'+esc(row.email)+'</strong><span>'+[row.google?'Google':'',row.password?t(row.temporaryPassword?'Contraseña temporal':'Contraseña'):''].filter(Boolean).join(' · ')+'</span></div><span>'+t(row.active?'Activa':'Desactivada')+'</span><button class="quiet" data-account="'+esc(row.id)+'" data-active="'+!row.active+'">'+t(row.active?'Desactivar':'Activar')+'</button></div>').join('')||'<p>'+t('Todavía no hay cuentas de propietarios.')+'</p>';loaded=true;
    }catch(error){if(valid())message.textContent=t(error.message);}finally{loading=false;list.setAttribute('aria-busy','false');}
  }
  panel.ontoggle=()=>{if(panel.open&&!loaded)refresh();};
  panel.querySelector('[data-refresh-accounts]').onclick=refresh;
  form.querySelector('[data-generate-password]').onclick=()=>{password.value=Array.from(globalThis.crypto.getRandomValues(new Uint8Array(12)),n=>n.toString(16).padStart(2,'0')).join('');};
  form.querySelector('[data-show-password]').onchange=event=>{password.type=event.target.checked?'text':'password';};
  form.onsubmit=async event=>{
    event.preventDefault();const button=form.querySelector('button[type=submit]'),value=password.value;button.disabled=true;output.textContent='';output.hidden=true;message.textContent='';
    try{
      const result=await api.request('set_owner_password',{email:email.value.trim(),password:value});if(!valid())return;
      password.value='';output.textContent=result.email+'\n'+value;output.hidden=false;
      message.textContent=t(result.active===false?'Contraseña guardada. La cuenta sigue desactivada; activala en la lista de accesos.':'Cuenta lista. Copiá el correo y la contraseña temporal para compartirlos en privado. No se envía ningún correo automáticamente.');await refresh();
    }catch(error){if(valid())message.textContent=t(error.message);}finally{button.disabled=false;}
  };
  list.onclick=async event=>{
    const button=event.target.closest('[data-account]');if(!button||!valid())return;button.disabled=true;
    try{await api.request('set_owner_active',{id:button.dataset.account,active:button.dataset.active==='true'});if(valid())await refresh();}
    catch(error){if(valid()){message.textContent=t(error.message);button.disabled=false;}}
  };
}
