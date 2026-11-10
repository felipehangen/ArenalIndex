import {publicAccountPage} from '../portal/public-page.mjs';
import {recordInventory} from '../analytics/core.mjs';
import {withShareURL} from '../sharing/links.mjs';
let lastSnapshot=0;
export function createPublicHandler(repository,{catalog,defer}={}){
  return async request=>{
    const headers={'Access-Control-Allow-Origin':'*','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
    const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json'}});
    if(!['GET','HEAD'].includes(request.method))return json({error:'Método no permitido.'},405);
    try{
      const url=new URL(request.url),id=url.searchParams.get('id'),photo=url.searchParams.get('photo');
      if(photo){
        if(!/^[a-zA-Z0-9-]{8,80}$/.test(id||'')||!/^[a-zA-Z0-9-]{1,100}$/.test(photo))return json({error:'No disponible.'},404);
        const publication=(await repository.get(id))?.publication;
        const file=publication?.media[photo];
        if(!file||String(publication.version)!==url.searchParams.get('version')||!['image/jpeg','image/png','image/webp'].includes(file.type))return json({error:'No disponible.'},404);
        // Delegate only this published image. Direct storage delivery also supports
        // the intake's 12 MB files without passing them through a function response.
        const location=await repository.downloadURL(file.path);
        return new Response(null,{status:307,headers:{...headers,Location:location}});
      }
      if(url.searchParams.has('account')){
        const page=await publicAccountPage(repository,url.searchParams.get('account'),{catalog});
        return page?json(page):json({error:'Esta página no está disponible.'},404);
      }
      if(url.searchParams.has('catalog')&&catalog){
        const [listings,legacy]=await Promise.all([repository.published(),catalog.published()]);
        // At most one observation per warm instance per minute; failures never hide listings.
        if(request.method==='GET'&&repository.analyticsSnapshot&&Date.now()-lastSnapshot>60000){
          lastSnapshot=Date.now();
          const work=recordInventory(repository,[...listings,...legacy]).catch(()=>{lastSnapshot=0;console.error('Inventory snapshot unavailable');});
          if(defer)defer(work);else await work;
        }
        return json([...listings,...legacy].map(withShareURL));
      }
      return json((await repository.published()).map(withShareURL));
    }catch{return json({error:'No se pudo cargar el catálogo. Intentá de nuevo.'},503);}
  };
}
