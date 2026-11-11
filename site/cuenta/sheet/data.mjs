export async function loadSheet({id,slug=null,endpoint,fetcher=fetch}){
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(id||'')||slug!==null&&!/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug))throw Error('Invalid property');
  const url=new URL(endpoint);url.searchParams.set(slug?'account':'catalog',slug||'1');
  const response=await fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw Error('Unavailable');
  const data=await response.json(),rows=slug?data.listings:data;
  const listing=Array.isArray(rows)?rows.find(row=>row.id===id):null;
  if(!listing||slug&&data.account?.slug!==slug)throw Error('Unavailable');
  const collection=slug?data.account:null;
  const publicURL=(slug?'https://go.arenalindex.com/collection/'+slug+'/':'https://arenalindex.com/')+'#propiedad/'+encodeURIComponent(id);
  return {listing,collection,publicURL};
}
