const unavailable=()=>Object.assign(Error('El almacenamiento está tardando demasiado. Intentá de nuevo.'),{status:503,code:'storage_timeout'});
const transient=error=>error.code==='storage_timeout'||['AbortError','TimeoutError'].includes(error.name)||['BlobRequestAbortedError','BlobServiceNotAvailable','BlobUnknownError'].includes(error.constructor?.name)||error instanceof TypeError&&!!error.cause;

// Bound the complete operation, including auth resolution, SDK backoff and body
// consumption. AbortSignal.timeout uses TimeoutError, which Blob 2.9 retries;
// a regular AbortError stops those retries and cancels the underlying request.
export function storageRequest({timeoutMs=6000,deadline=Infinity,diagnostic=event=>console.warn(JSON.stringify(event))}={}){
  return async function run(operation,collection,perform,{retry=false}={}){
    for(let attempt=1;attempt<=(retry?2:1);attempt++){
      const remaining=Math.min(timeoutMs,deadline-Date.now());
      if(remaining<=0)throw unavailable();
      const controller=new AbortController(),started=Date.now();let timer,outcome='ok';
      try{
        const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(unavailable());},remaining);});
        return await Promise.race([Promise.resolve().then(()=>perform(controller.signal)),timeout]);
      }catch(error){
        outcome=controller.signal.aborted?'timeout':'error';
        if(controller.signal.aborted)error=unavailable();
        if(!retry||attempt===2||!transient(error)||Date.now()>=deadline)throw error;
      }finally{
        clearTimeout(timer);
        const durationMs=Date.now()-started;
        // Never include paths, credentials, record contents or SDK error messages.
        if(outcome!=='ok'||durationMs>=1000)diagnostic({event:'storage_request',operation,collection,attempt,outcome,durationMs});
      }
    }
  };
}
