export async function openStore(key='current') {
  const db=await new Promise((resolve,reject)=>{
    const request=indexedDB.open('arenalindex-intake-v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('drafts');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Almacenamiento bloqueado.'));
  });
  return {
    read:()=>new Promise((resolve,reject)=>{const r=db.transaction('drafts').objectStore('drafts').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}),
    write:value=>new Promise((resolve,reject)=>{const t=db.transaction('drafts','readwrite');t.objectStore('drafts').put(value,key);t.oncomplete=()=>resolve();t.onerror=t.onabort=()=>reject(t.error);})
  };
}
// Coalesce edits while a save is running. A successful final save is always the newest draft.
export function createSaver(write,snapshot,status) {
  let pending=false,running=null;
  return function save() {
    pending=true;
    if(!running)running=(async()=>{
      let ok=true;
      try {while(pending){pending=false;status('Guardando…');await write(snapshot());}status('Borrador guardado en este navegador');}
      catch {ok=false;status('No se pudo guardar en este navegador. Guardá el borrador en tu cuenta antes de salir.');}
      finally {running=null;}
      return ok;
    })();
    return running;
  };
}
