import {mountAdmin} from '../admin/controller.mjs?v=3-account';
import * as client from './client.mjs';
import {openStore} from '../newlisting/local.mjs';
import {accountKey} from '../newlisting/account.mjs';
const t=text=>window.ArenalI18n?.t(text)||text;
mountAdmin({document,window,api:client,owner:true,onSignedIn:async identity=>{
  const button=document.querySelector('#import-browser-draft'),message=document.querySelector('#import-status'),token=client.session()?.token;let draft;
  try{draft=await(await openStore()).read();}catch{return;}
  if(!draft||!Object.keys(draft.values||{}).length||!token||client.session()?.token!==token)return;button.hidden=false;button.disabled=false;
  button.onclick=async()=>{
    button.disabled=true;
    try{
      let id=draft.id;
      if(draft.accessToken&&draft.submission)await client.request('workspace_claim',{id,token:draft.accessToken});
      else{
        id=crypto.randomUUID();const copy={...draft,id,accessToken:undefined,submission:null,cloud:{version:0,editRevision:0,dirty:true},files:draft.files.map(f=>({...f,remote:false}))};
        await(await openStore(accountKey('owner',identity.email,id))).write(copy);
      }
      location.href='/newlisting/?cuenta='+encodeURIComponent(id);
    }catch(error){message.textContent=t(error.message);button.disabled=false;}
  };
}});
