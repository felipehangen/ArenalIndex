import test from 'node:test';
import assert from 'node:assert/strict';
import {parseIndicators,validateSnapshot,latestSnapshot,refreshRate,localDate} from '../scripts/lib/exchange-rate.mjs';
const now=new Date('2026-11-09T12:17:00Z');
const indicator=(code,value,date='2026-11-09')=>({codigoIndicador:String(code),series:[{fecha:date,valorDatoPorPeriodo:value}]});
const quote=()=>parseIndicators(indicator(317,446.56),indicator(318,452.13),now);
test('reads the dated official buy/sell values without rounding the midpoint',()=>{
 const rate=quote();assert.equal(rate.buy,446.56);assert.equal(rate.sell,452.13);
 assert.ok(Math.abs((rate.buy+rate.sell)/2-449.345)<1e-10);
 assert.equal(rate.source,'BCCR');assert.equal(rate.date,'2026-11-09');assert.equal(rate.checkedAt,now.toISOString());
});
test('uses matching effective dates and handles midnight in Costa Rica',()=>{
 const buy=indicator(317,449,'2026-11-10');buy.series.push({fecha:'2026-11-09',valorDatoPorPeriodo:446});
 const sell=indicator(318,451,'2026-11-10');sell.series.push({fecha:'2026-11-09',valorDatoPorPeriodo:450});
 const late=new Date('2026-11-10T02:00:00Z');assert.equal(localDate(late),'2026-11-09');
 assert.equal(parseIndicators(buy,sell,late).date,'2026-11-09');
 assert.throws(()=>parseIndicators(indicator(317,446),indicator(318,450,'2026-11-08'),now),/matching/);
 assert.throws(()=>parseIndicators(indicator(317,446,'2026-11-10'),indicator(318,450,'2026-11-10'),now),/matching/);
});
test('rejects wrong indicators, invalid amounts, impossible dates, and obsolete feed data',()=>{
 assert.throws(()=>parseIndicators(indicator(318,446),indicator(317,450),now),/indicators/);
 for(const value of [0,-4,NaN,Infinity,'446.56',9000])assert.throws(()=>parseIndicators(indicator(317,value),indicator(318,450),now));
 assert.throws(()=>parseIndicators(indicator(317,450),indicator(318,440),now));
 assert.throws(()=>parseIndicators(indicator(317,440,'2026-10-01'),indicator(318,450,'2026-10-01'),now),/outdated/);
 assert.throws(()=>validateSnapshot({...quote(),date:'2026-02-30'},now));
});
test('retains the newest verified snapshot across fresh CI checkouts and failures',()=>{
 const previous={...quote(),date:'2026-11-06',checkedAt:'2026-11-06T12:00:00Z'},current=quote();
 assert.deepEqual(latestSnapshot([previous,current,null,{...current,buy:0}],now),current);
 assert.deepEqual(latestSnapshot([previous,null],now),previous);
 assert.equal(latestSnapshot([null,{}],now),null);
});
test('refresh rejects failed or stale upstream responses without mutating the previous snapshot',async()=>{
 const previous=Object.freeze(quote());
 await assert.rejects(refreshRate({previous,now,fetchImpl:async()=>({ok:false,status:503})}),/unavailable/);
 await assert.rejects(refreshRate({previous,now,fetchImpl:async url=>({ok:true,json:async()=>indicator(url.includes('indicator.317.')?317:318,url.includes('indicator.317.')?440:450,'2026-11-08')})}),/older/);
 assert.equal(previous.checkedAt,now.toISOString());
 const result=await refreshRate({previous,now,fetchImpl:async url=>({ok:true,json:async()=>indicator(url.includes('indicator.317.')?317:318,url.includes('indicator.317.')?446.56:452.13)})});
 assert.deepEqual(result,previous);
});
