// Google owns the button iframe, so its script locale must match the site too.
// Serialize locale changes: a late Spanish load must not overwrite English.
export function createGoogleLoader({window,document,schedule=setTimeout,cancel=clearTimeout}){
  let queue=Promise.resolve(),loadedLanguage,api,element;
  return language=>{
    const locale=language==='en'?'en':'es';
    const request=queue.catch(()=>{}).then(()=>{
      if(api&&loadedLanguage===locale)return api;
      element?.remove();api=null;loadedLanguage=null;
      return new Promise((resolve,reject)=>{
        const script=document.createElement('script');element=script;
        script.src='https://accounts.google.com/gsi/client?hl='+locale;script.async=true;
        const fail=()=>{cancel(timer);script.onload=script.onerror=null;script.remove();reject(Error('No se pudo cargar Google. Revisá la conexión e intentá de nuevo.'));};
        const timer=schedule(fail,20000);
        script.onerror=fail;
        script.onload=()=>{
          if(!window.google?.accounts?.id){fail();return;}
          cancel(timer);script.onload=script.onerror=null;
          api=window.google.accounts.id;loadedLanguage=locale;resolve(api);
        };
        document.head.append(script);
      });
    });
    queue=request;return request;
  };
}
