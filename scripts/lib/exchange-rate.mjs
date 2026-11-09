export const sourceUrl='https://www.bccr.fi.cr/';
// These are the public JSON feeds used by the BCCR homepage, not a third-party rate.
export const feeds=[
  sourceUrl+'content/bccr/cr/es/home/jcr:content/root/container/container/economicindicators/cardindicador.indicator.317.json',
  sourceUrl+'content/bccr/cr/es/home/jcr:content/root/container/container/economicindicators/item_1774647976317.indicator.318.json'
];
export const localDate=date=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Costa_Rica',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export function validateSnapshot(value,now=new Date()){
  if(value?.source!=='BCCR'||value.method!=='midpoint'||!Number.isFinite(value.buy)||!Number.isFinite(value.sell)||
    value.buy<100||value.sell>2000||value.sell<value.buy||value.sell/value.buy>1.1||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.date)||!Number.isFinite(Date.parse(value.date))||
    new Date(value.date).toISOString().slice(0,10)!==value.date||value.date>localDate(now)||
    !Number.isFinite(Date.parse(value.checkedAt))||Date.parse(value.checkedAt)>now.getTime()+60000)throw Error('Invalid BCCR rate snapshot');
  return {source:'BCCR',sourceUrl,method:'midpoint',buy:value.buy,sell:value.sell,date:value.date,checkedAt:value.checkedAt};
}
export function parseIndicators(buy,sell,now=new Date()){
  if(String(buy?.codigoIndicador)!=='317'||String(sell?.codigoIndicador)!=='318')throw Error('Unexpected BCCR indicators');
  const today=localDate(now);
  // Never mix dates or use tomorrow's quote before it takes effect in Costa Rica.
  const rows=data=>(Array.isArray(data?.series)?data.series:[]).filter(row=>/^\d{4}-\d{2}-\d{2}$/.test(row?.fecha)&&row.fecha<=today);
  const sales=new Map(rows(sell).map(row=>[row.fecha,row.valorDatoPorPeriodo]));
  const purchase=rows(buy).filter(row=>sales.has(row.fecha)).sort((a,b)=>b.fecha.localeCompare(a.fecha))[0];
  if(!purchase)throw Error('No matching effective BCCR rate date');
  const snapshot=validateSnapshot({source:'BCCR',method:'midpoint',buy:purchase.valorDatoPorPeriodo,sell:sales.get(purchase.fecha),date:purchase.fecha,checkedAt:now.toISOString()},now);
  if(Date.parse(today)-Date.parse(snapshot.date)>7*86400000)throw Error('BCCR returned an outdated rate');
  return snapshot;
}
export function latestSnapshot(values,now=new Date()){
  const valid=values.flatMap(value=>{try{return [validateSnapshot(value,now)];}catch{return [];}});
  return valid.sort((a,b)=>b.date.localeCompare(a.date)||b.checkedAt.localeCompare(a.checkedAt))[0]||null;
}
export async function refreshRate({fetchImpl=fetch,previous,now=new Date()}){
  const data=await Promise.all(feeds.map(async url=>{
    const response=await fetchImpl(url,{signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
    if(!response.ok)throw Error('BCCR feed unavailable ('+response.status+')');
    return response.json();
  }));
  const next=parseIndicators(...data,now);
  if(previous&&next.date<previous.date)throw Error('BCCR returned an older rate');
  return next;
}
