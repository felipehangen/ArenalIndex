import {readFile,writeFile} from 'node:fs/promises';
import {latestSnapshot,refreshRate,localDate} from './lib/exchange-rate.mjs';

const output=new URL('../site/exchange-rate.json',import.meta.url),now=new Date();
const local=await readFile(output,'utf8').then(JSON.parse).catch(()=>null);
// Recover the last published snapshot even on a fresh CI checkout.
const published=await fetch('https://arenalindex.com/exchange-rate.json',{signal:AbortSignal.timeout(10000),cache:'no-store'})
  .then(response=>response.ok?response.json():null).catch(()=>null);
let snapshot=latestSnapshot([local,published],now),updated=false;
if(!snapshot||localDate(new Date(snapshot.checkedAt))!==localDate(now)){
  for(let attempt=0;attempt<3;attempt++){
    try{snapshot=await refreshRate({previous:snapshot,now});updated=true;break;}
    catch(error){console.warn('Exchange-rate attempt '+(attempt+1)+': '+error.message);}
  }
  if(!updated){
    if(!snapshot)throw Error('No verified BCCR rate is available to publish');
    console.warn('::warning::BCCR unavailable; retaining the rate dated '+snapshot.date+' without changing its checkedAt date.');
  }
}
await writeFile(output,JSON.stringify(snapshot,null,2)+'\n');
await writeFile(new URL('../site/exchange-rate.js',import.meta.url),'/* Daily BCCR snapshot; generated from exchange-rate.json. */\nwindow.ArenalExchangeRate=Object.freeze('+JSON.stringify(snapshot)+');\n');
console.log('BCCR snapshot: '+snapshot.date+(updated?' (updated)':' (retained)'));
