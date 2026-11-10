// Private append-only batches make retries idempotent and concurrent visits independent.
export function analyticsStore({read,write,list}){
  const dayPattern=/^\d{4}-\d{2}-\d{2}$/;
  const checkDay=day=>{if(!dayPattern.test(day))throw Error('Invalid analytics date');};
  async function rows(prefix,limit){
    const entries=[];let cursor;
    do{
      const page=await list({prefix,limit:1000,...(cursor?{cursor}:{})});
      entries.push(...page.blobs);cursor=page.hasMore?page.cursor:null;
      if(entries.length>limit)throw Object.assign(Error('Hay demasiados datos. Elegí un período más corto.'),{status:422});
    }while(cursor);
    const values=[];
    for(let i=0;i<entries.length;i+=20){const batch=await Promise.all(entries.slice(i,i+20).map(entry=>read(entry.pathname)));values.push(...batch.filter(Boolean).map(value=>value.row));}
    return values;
  }
  return {
    async analyticsAppend(day,batch){
      checkDay(day);if(!/^[a-f0-9]{32}$/.test(batch.id))throw Error('Invalid analytics batch');
      await write('analytics/batches/'+day+'/'+batch.id+'.json',batch,null,{ttlDays:90});
    },
    async analyticsBatches(days){
      const all=[];
      for(let i=0;i<days.length;i+=5){const groups=await Promise.all(days.slice(i,i+5).map(day=>{checkDay(day);return rows('analytics/batches/'+day+'/',5000);}));all.push(...groups.flat());if(all.length>10000)throw Object.assign(Error('Hay demasiados datos. Elegí un período más corto.'),{status:422});}
      return all;
    },
    async analyticsStart(at){await write('analytics/start.json',{startedAt:at});},
    async analyticsStarted(){return (await read('analytics/start.json'))?.row.startedAt||null;},
    async analyticsSnapshot(day,snapshot){
      checkDay(day);const path='analytics/inventory/'+day+'.json';
      for(let attempt=0;attempt<3;attempt++){
        const previous=await read(path);
        if(previous?.row.observedAt>=snapshot.observedAt)return;
        // Keep canonical labels for listings seen earlier that day, even after withdrawal.
        const properties=new Map((previous?.row.properties||[]).map(property=>[property.id,property]));
        for(const property of snapshot.properties)properties.set(property.id,property);
        if(await write(path,{...snapshot,properties:[...properties.values()]},previous?.etag))return;
      }
      throw Error('Inventory snapshot conflict');
    },
    async analyticsInventory(){return rows('analytics/inventory/',10000);}
  };
}
