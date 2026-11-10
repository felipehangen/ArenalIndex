import test from 'node:test';
import assert from 'node:assert/strict';
import {localityLabel,createLocalityResolver} from '../server/intake/locality.mjs';
test('pin locality uses a settlement and district, never a street or house address',()=>{
  assert.equal(localityLabel({village:'El Castillo',municipality:'La Fortuna',road:'Private road',house_number:'123'}),'El Castillo · La Fortuna');
  assert.equal(localityLabel({town:'La Fortuna',municipality:'La Fortuna'}),'La Fortuna');assert.equal(localityLabel({road:'Private road'}),'');
});
test('reverse lookup is cached per pin, rate limited, and failure keeps manual correction available',async()=>{
  const cache=new Map();let calls=0;
  const repository={portalGet:async(_,id)=>structuredClone(cache.get(id)),portalCreate:async(_,id,row)=>cache.set(id,row),portalUpdate:async(_,id,filters,patch)=>{const row=cache.get(id);if(!row||Object.entries(filters).some(([k,v])=>row[k]!==v))return null;Object.assign(row,patch);return row;}};
  const resolve=createLocalityResolver({repository,fetcher:async url=>{calls++;assert.equal(url.hostname,'nominatim.openstreetmap.org');return Response.json({address:{village:'El Castillo'}});}});
  assert.equal((await resolve({lat:'10.4',lng:'-84.7'})).place,'El Castillo');assert.equal((await resolve({lat:'10.4',lng:'-84.7'})).place,'El Castillo');assert.equal(calls,1);
  assert.equal(await resolve({lat:'10.5',lng:'-84.7'}),null);assert.equal(calls,1);
  assert.equal(await resolve({lat:'bad',lng:'-84.7'}),null);
});
