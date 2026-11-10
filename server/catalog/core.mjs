const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const columns='id,name,description,place,price,currency,area,lng,lat,house,volcano,river,water,electricity,well,private_residential,approximate,images,is_demo,details';
// Supabase remains the public source. Private, conditional catalog decisions
// take precedence everywhere, including deleted demos, without exposing a write key.
export function createCatalog({repository,supplemental=[],fetcher=fetch,now=()=>new Date(),url='https://clxntjpofnivxaxmlxui.supabase.co',key='sb_publishable_pIgUE7c7BU65lt1I5R0g7A_O5xfxDB6'}){
  async function base(){
    const rows=[];for(let offset=0;;offset+=1000){
      const query=new URLSearchParams({select:columns,status:'eq.published',order:'sort_order.asc,id.asc',limit:'1000',offset:String(offset)});
      const response=await fetcher(url+'/rest/v1/arenalindex_properties?'+query,{headers:{apikey:key},signal:AbortSignal.timeout(15000),cache:'no-store'});
      if(!response.ok)fail(503,'No se pudieron cargar los anuncios de demostración. Intentá actualizar.');
      const page=await response.json();if(!Array.isArray(page))fail(503,'No se pudo cargar el catálogo.');rows.push(...page);if(page.length<1000)break;
    }
    // Repository demos use the same decisions as Supabase seeds. If a seed is
    // later migrated into Supabase, its database row becomes authoritative.
    const ids=new Set(rows.map(row=>row.id));
    for(const row of supplemental)if(!ids.has(row.id)){rows.push(structuredClone(row));ids.add(row.id);}
    return rows;
  }
  const apply=(row,decision)=>({...row,...decision?.patch,details:{...row.details,...decision?.patch?.details}});
  async function read(){const [rows,state]=await Promise.all([base(),repository.catalogState()]);return {rows,state};}
  const summary=(row,d={})=>({id:row.id,source:'demo',isDemo:true,title:row.name,contact:row.details?.contact?.name||'',email:row.details?.contact?.email||'',price:Number(row.price),area:Number(row.area),currency:row.currency||'USD',status:d.status==='unlisted'?'approved':'published',publishedVersion:d.status==='unlisted'?null:1,withdrawn:d.status==='unlisted',publicId:row.id,version:1,publicationRevision:d.revision||0,updatedAt:d.updatedAt||null});
  return {
    async published(){const {rows,state}=await read();return rows.filter(r=>!['deleted','unlisted'].includes(state[r.id]?.status)).map(r=>apply(r,state[r.id]));},
    async list(){const {rows,state}=await read();return rows.filter(r=>r.is_demo===true&&state[r.id]?.status!=='deleted').map(r=>summary(apply(r,state[r.id]),state[r.id]));},
    async action(action,body,actor){
      if(!/^lot-[0-9]{1,6}$/.test(body.id||''))fail(400,'Identificador inválido.');
      const {rows,state}=await read(),original=rows.find(r=>r.id===body.id&&r.is_demo===true),previous=state[body.id]||{};
      if(!original||previous.status==='deleted')fail(404,'No se encontró el anuncio.');
      const row=apply(original,previous);
      if(action==='catalog_open')return {listing:row,revision:previous.revision||0};
      if(body.revision!==(previous.revision||0))fail(409,'El anuncio cambió. Actualizá la lista antes de continuar.');
      let patch=previous.patch||{},status=previous.status||'published';
      if(action==='catalog_update'){
        const input=body.listing||{},titles={es:String(input.titleEs||'').trim(),en:String(input.titleEn||'').trim()};
        if(!titles.es&&!titles.en||Object.values(titles).some(t=>t.length>45))fail(422,'Agregá un título de hasta 45 caracteres.');
        if(!['USD','CRC'].includes(input.currency)||!Number.isFinite(Number(input.price))||Number(input.price)<0||!Number.isFinite(Number(input.area))||Number(input.area)<=0||Number(input.area)>999999999)fail(422,'Revisá el precio, la moneda y el área.');
        const place=String(input.place||'').trim();if(!place||place.length>100)fail(422,'Indicá la localidad.');
        const language=titles.es?'es':'en';
        patch={...patch,name:titles[language],place,price:Number(input.price),area:Number(input.area),currency:input.currency,details:{...row.details,language,titlesReviewed:true,declaredArea:Number(input.area),documentedArea:Number(input.area),sections:row.details?.sections?.map(section=>({...section,rows:section.rows.map(fact=>fact.label==='Área del plano'?{...fact,value:new Intl.NumberFormat('es-CR').format(Number(input.area))+' m²'}:fact)})),translations:{...row.details?.translations,es:{...row.details?.translations?.es,title:titles.es},en:{...row.details?.translations?.en,title:titles.en}}}};
      }else if(action==='catalog_delete'){
        if(!['DELETE','BORRAR'].includes(String(body.confirmation||'').trim().toUpperCase()))fail(422,'Escribí DELETE o BORRAR para confirmar.');
        status='deleted';
      }
      else if(action==='catalog_unlist')status='unlisted';
      else if(action==='catalog_publish')status='published';
      else fail(400,'Acción no reconocida.');
      const decision={status,patch,revision:(previous.revision||0)+1,updatedAt:now().toISOString(),updatedBy:actor.email};
      if(!await repository.catalogUpdate(body.id,previous.revision||0,decision))fail(409,'El catálogo cambió. Actualizá la lista antes de continuar.');
      return {saved:true,revision:decision.revision};
    }
  };
}
