import * as client from './client.mjs';
import {esc} from './view.mjs';
const t=text=>window.ArenalI18n?.t(text)||text;
export async function mountInvitations(){
  const panel=document.querySelector('#invitations');if(!panel)return;
  const list=panel.querySelector('[data-invites]'),message=panel.querySelector('[role=status]'),token=client.session()?.token,valid=()=>token&&client.session()?.token===token;
  async function refresh(){
    const result=await client.request('invitations');if(!valid())return;
    list.innerHTML=result.invitations.map(row=>'<div class="invite-row"><span translate="no">'+esc(row.label)+'</span><span>'+t(row.active?'Activa':'Desactivada')+'</span>'+(row.active?'<button class="quiet" data-revoke="'+esc(row.id)+'">'+t('Desactivar')+'</button>':'')+'</div>').join('')||'<p>'+t('Todavía no hay códigos de invitación.')+'</p>';
  }
  panel.querySelector('[data-create-invite]').onclick=async event=>{
    event.target.disabled=true;
    try{const result=await client.request('create_invitation',{label:panel.querySelector('input').value});if(!valid())return;
      const code=panel.querySelector('output');code.textContent=result.code;code.hidden=false;
      message.textContent=t('Copiá este código y compartilo con las personas que querás invitar. Se muestra solo ahora.');await refresh();
    }catch(error){if(valid())message.textContent=t(error.message);}finally{event.target.disabled=false;}
  };
  list.onclick=async event=>{const button=event.target.closest('[data-revoke]');if(!button||!valid())return;button.disabled=true;try{await client.request('revoke_invitation',{id:button.dataset.revoke});if(valid())await refresh();}catch(error){if(valid())message.textContent=t(error.message);button.disabled=false;}};
  try{await refresh();}catch(error){if(valid())message.textContent=t(error.message);}
}
