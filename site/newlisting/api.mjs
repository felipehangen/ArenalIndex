export function createAPI(config=globalThis.ArenalConfig,fetcher=globalThis.fetch) {
  const url=config?.intakeUrl||'/api/intake';
  async function request(action,body={},token='',reviewer=false) {
    const headers={'Content-Type':'application/json'};
    if(token)headers[reviewer?'X-Review-Token':'X-Intake-Token']=token;
    const response=await fetcher(url,{method:'POST',headers,body:JSON.stringify({action,...body}),signal:AbortSignal.timeout(30000)});
    const result=await response.json().catch(()=>({error:'No se pudo leer la respuesta del servidor.'}));
    if(!response.ok)throw Error(result.error||'No se pudo completar la solicitud.');
    return result;
  }
  return {request,async available(){try{return (await request('health')).ready===true;}catch{return false;}}};
}
export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function submitDraft(draft,api,onProgress=()=>{},fetcher=globalThis.fetch) {
  draft.accessToken ||= randomToken();
  const payload={version:draft.version,id:draft.id,values:draft.values,buildings:draft.buildings,files:draft.files.map(({blob,data,...f})=>f)};
  const prepared=await api.request('prepare',{draft:payload},draft.accessToken);
  for(let i=0;i<draft.files.length;i++) {
    const file=draft.files[i],upload=prepared.uploads.find(u=>u.id===file.id);
    if(!upload)throw Error('Falta la dirección para subir '+file.name+'.');
    onProgress('Subiendo archivo '+(i+1)+' de '+draft.files.length+'…');
    const response=await fetcher(upload.url,{method:'PUT',headers:{'Content-Type':file.type},body:file.blob,signal:AbortSignal.timeout(120000)});
    if(!response.ok)throw Error('No se pudo subir '+file.name+'. Podés reintentar.');
  }
  onProgress('Enviando la ficha para revisión…');
  try{return await api.request('submit',{id:draft.id,version:prepared.version},draft.accessToken);}
  catch(error){
    // The response may be lost after the server receives the complete submission.
    const received=await api.request('status',{id:draft.id},draft.accessToken).catch(()=>null);
    if(received?.version===prepared.version&&received.status!=='draft')return received;
    throw error;
  }
}
