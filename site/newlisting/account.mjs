import * as admin from '../admin/client.mjs';
import * as owner from '../owner/client.mjs';
import {newDraft,normalizeDraft} from './model.mjs';
export const accountKey=(kind,email,id)=>kind+':'+email+':'+id;
export async function accountContext(search=location.search){
  const params=new URLSearchParams(search),kind=params.has('admin')?'admin':params.has('owner')?'owner':null;if(!kind)return null;
  let id=params.get(kind);if(id==='new'){id=crypto.randomUUID();params.set(kind,id);history.replaceState(null,'','?'+params);}
  if(!/^[a-zA-Z0-9-]{8,80}$/.test(id||''))throw Error('Identificador inválido.');
  const client=kind==='admin'?admin:owner;
  const state={expired:false};
  const login=()=>{state.expired=true;document.getElementById('content')?.replaceChildren();location.replace(kind==='admin'?'/admin/#review='+id:'/owner/#edit='+id);};
  let identity;try{identity=await client.request('session');}catch(error){if(error.status===401)login();throw error;}
  if(identity.requiresPasswordChange){login();throw Error('Cambiá tu contraseña temporal para continuar.');}
  const request=async(action,body={})=>{try{return await client.request(action==='health'?'health':'workspace_'+action,{id,...body});}catch(error){if(error.status===401)login();throw error;}};
  return Object.assign(state,{kind,id,key:accountKey(kind,identity.email,id),email:identity.email,expiresAt:identity.expiresAt,client,request,login,back:kind==='admin'?'/admin/review/#id='+id:'/owner/',async read(onProgress=()=>{}){
    const result=await request('open'),files=[];
    for(let offset=0;offset<result.draft.files.length;offset+=4){
      onProgress('Abriendo archivos de tu ficha…');
      files.push(...await Promise.all(result.draft.files.slice(offset,offset+4).map(async file=>{
        const response=await fetch(file.url,{cache:'no-store',signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('No se pudieron abrir los archivos. Intentá de nuevo.');
        const blob=await response.blob();if(blob.size!==file.size)throw Error('No se pudieron abrir los archivos. Intentá de nuevo.');
        const {url,...metadata}=file;return {...metadata,blob,remote:true};
      })));
    }
    return normalizeDraft({...result.draft,files,submission:result,cloud:{version:result.version,editRevision:result.editRevision,dirty:false}});
  },blank(){return {...newDraft(id),cloud:{version:0,editRevision:0,dirty:true}};}});
}
export async function saveToAccount(draft,account,onProgress=()=>{},fetcher=fetch){
  const payload={id:draft.id,values:draft.values,buildings:draft.buildings,files:draft.files.map(({blob,remote,...file})=>file)};
  const prepared=await account.request('save_prepare',{draft:payload,version:draft.cloud?.version||0,editRevision:draft.cloud?.editRevision||0,reuse:draft.files.filter(f=>f.remote).map(f=>f.id)});
  for(let index=0;index<prepared.uploads.length;index++){
    const upload=prepared.uploads[index],file=draft.files.find(f=>f.id===upload.id);onProgress('Subiendo archivo '+(index+1)+' de '+prepared.uploads.length+'…');
    const response=await fetcher(upload.url,{method:'PUT',headers:{'Content-Type':file.type},body:file.blob,signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('No se pudo subir '+file.name+'. Podés reintentar.');
  }
  let result;try{result=await account.request('save_commit',{transaction:prepared.transaction});}
  catch(error){if(error.status&&error.status<500)throw error;result=await account.request('save_commit',{transaction:prepared.transaction});}
  draft.submission=result;draft.cloud={version:result.version,editRevision:result.editRevision,dirty:false};draft.files.forEach(f=>f.remote=true);return result;
}
