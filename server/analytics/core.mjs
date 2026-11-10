import {createHash} from 'node:crypto';
export const zone='America/Costa_Rica';
export const dayOf=value=>new Date(new Date(value).getTime()-6*3600000).toISOString().slice(0,10);
const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const idPattern=/^[a-f0-9]{32}$/;
const listingPattern=/^[a-z0-9][a-z0-9-]{0,79}$/;
const types=new Set(['page_view','listing_view','gallery_open','photo_open','photo_browse','save','remove_save','contact','share','map_open','filter_apply','zero_results']);
const channels=new Set(['whatsapp','phone','email','options']);
const integer=(value,max)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
export function photoPath(value){
  if(typeof value!=='string'||value.length>600)return null;
  if(/^\/?photos\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(value))return '/'+value.replace(/^\//,'');
  try{
    const url=new URL(value);
    if(url.origin!=='https://arenalindex-intake.vercel.app'||url.pathname!=='/api/listings')return null;
    const id=url.searchParams.get('id'),photo=url.searchParams.get('photo'),version=url.searchParams.get('version');
    if(!/^[a-zA-Z0-9-]{8,80}$/.test(id||'')||!/^[a-zA-Z0-9-]{1,100}$/.test(photo||'')||!/^\d{1,9}$/.test(version||''))return null;
    return url.origin+url.pathname+'?'+new URLSearchParams({id,photo,version});
  }catch{return null;}
}
export function inventorySnapshot(listings,now=new Date()){
  const properties=listings.map(row=>({id:row.id,name:String(row.name).slice(0,160),place:String(row.place||'').slice(0,100),isDemo:row.is_demo===true,
    photos:[...new Set([...(row.images||[]),...(row.details?.photoGroups||[]).flatMap(group=>(group.photos||[]).map(photo=>photo.src))].map(photoPath).filter(Boolean))]}));
  return {day:dayOf(now),observedAt:now.toISOString(),real:properties.filter(row=>!row.isDemo).length,demo:properties.filter(row=>row.isDemo).length,properties};
}
// Inventory is measured from the authoritative combined public catalog, never from a browser's count.
export async function recordInventory(repository,listings,now=new Date()){
  const snapshot=inventorySnapshot(listings,now);await repository.analyticsSnapshot(snapshot.day,snapshot);return snapshot;
}
function normalizeBatch(input,now,salt){
  if(!input||![input.id,input.visit,input.visitor].every(value=>idPattern.test(value||'')))fail(400,'Visita inválida.');
  const sent=Date.parse(input.sentAt),clock=now.getTime();
  if(!Number.isFinite(sent)||sent>clock+60000||sent<clock-24*3600000)fail(400,'Fecha inválida.');
  if(!integer(input.activeMs,120000)||!integer(input.clicks,1000)||!Array.isArray(input.events)||input.events.length>60||!Array.isArray(input.saved)||input.saved.length>500||input.saved.some(id=>!listingPattern.test(id)))fail(400,'Actividad inválida.');
  const events=input.events.map(event=>{
    if(!event||!types.has(event.type))fail(400,'Evento inválido.');
    const at=Date.parse(event.at);if(!Number.isFinite(at)||at>sent+1000||at<sent-2*3600000)fail(400,'Fecha de evento inválida.');
    const result={type:event.type,at:new Date(at).toISOString()};
    if(event.type==='page_view')result.page=event.page==='/publicar/'?'/publicar/':'/';
    if(event.listingId!==undefined){if(!listingPattern.test(event.listingId))fail(400,'Propiedad inválida.');result.listingId=event.listingId;}
    if(['listing_view','gallery_open','photo_open','photo_browse','save','remove_save','share','map_open'].includes(event.type)&&!result.listingId)fail(400,'Propiedad requerida.');
    if(['photo_open','photo_browse'].includes(event.type)){result.photo=photoPath(event.photo);if(!result.photo)fail(400,'Foto inválida.');}
    if(event.type==='contact'){if(!channels.has(event.channel))fail(400,'Canal inválido.');result.channel=event.channel;}
    return result;
  });
  // Only a referring hostname is retained. Paths, searches, emails, tokens and raw IPs are never stored.
  let referrer='';try{const url=new URL(input.referrer);if(url.protocol==='https:'||url.protocol==='http:')referrer=url.hostname.slice(0,120);}catch{}
  return {id:input.id,visit:hash(salt+':visit:'+input.visit),visitor:hash(salt+':visitor:'+input.visitor),sentAt:new Date(sent).toISOString(),receivedAt:now.toISOString(),activeMs:input.activeMs,clicks:input.clicks,
    device:['mobile','tablet','desktop'].includes(input.device)?input.device:'unknown',language:input.language==='en'?'en':'es',referrer,events,saved:[...new Set(input.saved)]};
}
export function createAnalyticsHandler({repository,config,now=()=>new Date()}){
  const origins=new Set(config.origins||['https://arenalindex.com','https://www.arenalindex.com']);
  return async request=>{
    const origin=request.headers.get('Origin'),headers={'Cache-Control':'no-store','Content-Type':'application/json','Vary':'Origin','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
    const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
    if(!origins.has(origin))return json({error:'Origen no autorizado.'},403);
    headers['Access-Control-Allow-Origin']=origin;
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type'}});
    if(request.method!=='POST')return json({error:'Método no permitido.'},405);
    try{
      if(!config.rateSalt||config.rateSalt.length<16)fail(503,'Estadísticas no disponibles.');
      const raw=await request.text();if(Buffer.byteLength(raw)>32768)fail(413,'Solicitud demasiado grande.');
      const batch=normalizeBatch(JSON.parse(raw),now(),config.rateSalt);
      if(/bot|crawler|spider|headless|preview/i.test(request.headers.get('user-agent')||'')||request.headers.get('DNT')==='1'||request.headers.get('Sec-GPC')==='1')return json({accepted:false});
      const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
      if(!await repository.allow('analytics:'+hash(config.rateSalt+ip),240))fail(429,'Demasiadas solicitudes.');
      await repository.analyticsStart(batch.receivedAt);
      await repository.analyticsAppend(dayOf(batch.sentAt),batch);
      return json({accepted:true});
    }catch(error){return json({error:error.status?error.message:error instanceof SyntaxError?'Solicitud inválida.':'Estadísticas no disponibles.'},error.status||(error instanceof SyntaxError?400:503));}
  };
}
export function dateRange(body,now){
  const today=dayOf(now),end=body.end||today,start=body.start||new Date(Date.parse(today+'T06:00:00Z')-29*86400000).toISOString().slice(0,10);
  const valid=day=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day;
  if(!valid(start)||!valid(end)||start>end||end>today||Date.parse(start)<Date.parse(today)-89*86400000)fail(400,'Elegí fechas dentro de los últimos 90 días.');
  const days=[];for(let n=Date.parse(start);n<=Date.parse(end);n+=86400000)days.push(new Date(n).toISOString().slice(0,10));
  return {start,end,days};
}
export function summarize({batches,inventory,startedAt,range,kind='all',page=0}){
  const metadata=new Map();for(const snapshot of [...inventory].sort((a,b)=>a.observedAt.localeCompare(b.observedAt)))for(const property of snapshot.properties)metadata.set(property.id,property);
  const matches=id=>kind==='all'||(metadata.has(id)&&(kind==='demo')===metadata.get(id).isDemo);
  const visits=new Map(),latestSaved=new Map(),properties=new Map(),photos=new Map(),places=new Map(),sources=new Map(),devices=new Map(),daily=new Map(range.days.map(day=>[day,{day,visits:new Set(),views:0}]));
  const total={visits:0,visitors:0,views:0,clicks:0,activeMs:0,saves:0,removals:0,photoOpens:0,photoBrowses:0,galleries:0,contacts:0,shares:0,filters:0,zeroResults:0,observedSaved:0,uniqueSaved:0};
  const bump=(map,key)=>map.set(key,(map.get(key)||0)+1);
  for(const batch of [...batches].sort((a,b)=>a.sentAt.localeCompare(b.sentAt))){
    if(!latestSaved.has(batch.visitor)||latestSaved.get(batch.visitor).sentAt<=batch.sentAt)latestSaved.set(batch.visitor,batch);
    if(!visits.has(batch.visit))visits.set(batch.visit,{id:batch.visit.slice(0,12),visitor:batch.visitor,start:batch.sentAt,last:batch.sentAt,device:batch.device,language:batch.language,referrer:batch.referrer,activeMs:0,clicks:0,views:0,photos:0,saves:0,contacts:0,saved:0,events:[]});
    const visit=visits.get(batch.visit);visit.last=batch.sentAt;visit.activeMs+=batch.activeMs;visit.clicks+=batch.clicks;visit.saved=batch.saved.filter(matches).length;
    daily.get(dayOf(batch.sentAt))?.visits.add(batch.visit);
    total.activeMs+=batch.activeMs;total.clicks+=batch.clicks;
    for(const event of batch.events){
      visit.start=event.at<visit.start?event.at:visit.start;
      if(event.listingId&&!matches(event.listingId))continue;
      const property=metadata.get(event.listingId),detail={...event,name:property?.name||event.listingId||''};
      visit.events.push(detail);
      if(event.listingId&&!properties.has(event.listingId))properties.set(event.listingId,{id:event.listingId,name:property?.name||event.listingId,place:property?.place||'',isDemo:property?.isDemo??null,views:0,saves:0,photos:0,contacts:0});
      const row=properties.get(event.listingId);
      if(event.type==='listing_view'){total.views++;visit.views++;row.views++;if(property?.place)bump(places,property.place);daily.get(dayOf(event.at))&&(daily.get(dayOf(event.at)).views++);}
      if(event.type==='save'){total.saves++;visit.saves++;row.saves++;}
      if(event.type==='remove_save')total.removals++;
      if(event.type==='gallery_open')total.galleries++;
      if(event.type==='photo_open'||event.type==='photo_browse'){
        if(event.type==='photo_open')total.photoOpens++;else total.photoBrowses++;
        visit.photos++;row.photos++;
        if(property?.photos.includes(event.photo)){
          const key=event.listingId+'|'+event.photo;
          if(!photos.has(key))photos.set(key,{listingId:event.listingId,name:property.name,src:event.photo,opens:0,browses:0,isDemo:property.isDemo});
          photos.get(key)[event.type==='photo_open'?'opens':'browses']++;
        }
      }
      if(event.type==='contact'){total.contacts++;visit.contacts++;if(row)row.contacts++;}
      if(event.type==='share')total.shares++;
      if(event.type==='filter_apply')total.filters++;
      if(event.type==='zero_results')total.zeroResults++;
    }
  }
  const uniqueSaved=new Set();for(const batch of latestSaved.values())for(const id of batch.saved.filter(matches)){total.observedSaved++;uniqueSaved.add(id);}total.uniqueSaved=uniqueSaved.size;
  const allVisits=[...visits.values()].sort((a,b)=>b.start.localeCompare(a.start));
  for(const visit of allVisits){bump(sources,visit.referrer||'direct');bump(devices,visit.device);}
  total.visits=visits.size;total.visitors=new Set(allVisits.map(visit=>visit.visitor)).size;
  total.averageActiveMs=total.visits?Math.round(total.activeMs/total.visits):0;
  total.contactVisitRate=total.visits?allVisits.filter(visit=>visit.contacts>0).length/total.visits:0;
  const ranking=map=>[...map].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count).slice(0,10);
  return {range:{start:range.start,end:range.end},zone,startedAt,kind,total,
    daily:[...daily.values()].map(day=>({day:day.day,visits:day.visits.size,views:day.views})),
    inventory:inventory.filter(row=>row.day>=range.start&&row.day<=range.end).sort((a,b)=>a.day.localeCompare(b.day)).map(({day,observedAt,real,demo})=>({day,observedAt,real,demo})),
    properties:[...properties.values()].sort((a,b)=>b.views-a.views||b.saves-a.saves),photos:[...photos.values()].sort((a,b)=>b.opens-a.opens||b.browses-a.browses).slice(0,12),places:ranking(places),sources:ranking(sources),devices:ranking(devices),
    visits:allVisits.slice(page*25,(page+1)*25).map(({visitor,events,...visit})=>({...visit,eventCount:events.length,events:events.sort((a,b)=>a.at.localeCompare(b.at)).slice(-100)})),page,pages:Math.max(1,Math.ceil(allVisits.length/25))};
}
export async function analyticsReport({repository,catalog,body,now=new Date()}){
  const range=dateRange(body,now),kind=body.kind||'all',page=body.page||0;
  if(!['all','real','demo'].includes(kind)||!integer(page,10000))fail(400,'Filtro inválido.');
  const [published,legacy]=await Promise.all([repository.published(),catalog.published()]);
  await recordInventory(repository,[...published,...legacy],now);
  const [batches,inventory,startedAt]=await Promise.all([repository.analyticsBatches(range.days),repository.analyticsInventory(),repository.analyticsStarted()]);
  return summarize({batches,inventory,startedAt,range,kind,page});
}
