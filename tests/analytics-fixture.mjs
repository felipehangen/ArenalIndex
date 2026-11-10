import {BlobPreconditionFailedError} from '@vercel/blob';
import {createRepository} from '../server/intake/blob.mjs';
import {inventorySnapshot,summarize,dateRange} from '../server/analytics/core.mjs';
export const now=new Date('2026-11-10T20:00:00Z');
export const listings=[{id:'real-property',name:'Casa cerca del Arenal',place:'La Fortuna',is_demo:false,images:['/photos/demo-villa-front.webp']},{id:'lot-101',name:'Jardín de demostración',place:'El Castillo',is_demo:true,images:['/photos/lot.jpg']}];
export function memoryRepository(){
  const rows=new Map(),puts=[];let version=0;
  const sdk={
    async get(path){const entry=rows.get(path);if(!entry)return null;return {stream:new Blob([entry.text]).stream(),blob:{etag:entry.etag}};},
    async put(path,text,options){
      if(options.ifMatch&&rows.get(path)?.etag!==options.ifMatch)throw new BlobPreconditionFailedError();
      if(rows.has(path)&&!options.allowOverwrite)throw Error('Blob already exists');
      rows.set(path,{text,etag:String(++version)});puts.push({path,options});
    },
    async list({prefix,limit,cursor}){const paths=[...rows.keys()].filter(path=>path.startsWith(prefix)).sort(),start=Number(cursor||0);return {blobs:paths.slice(start,start+limit).map(path=>({pathname:path})),hasMore:start+limit<paths.length,cursor:String(start+limit)};}
  };
  return {repository:createRepository({sdk,now:()=>now.getTime()}),rows,puts};
}
export function batch(overrides={}){return {id:'a'.repeat(32),visit:'b'.repeat(32),visitor:'c'.repeat(32),sentAt:now.toISOString(),activeMs:45000,clicks:5,saved:['real-property'],device:'mobile',language:'en',referrer:'https://www.google.com/search?q=private',events:[{type:'page_view',at:'2026-11-10T19:59:15Z'},{type:'listing_view',listingId:'real-property',at:'2026-11-10T19:59:20Z'},{type:'photo_open',listingId:'real-property',photo:listings[0].images[0],at:'2026-11-10T19:59:30Z'},{type:'save',listingId:'real-property',at:'2026-11-10T19:59:40Z'},{type:'contact',listingId:'real-property',channel:'whatsapp',at:'2026-11-10T19:59:50Z'}],...overrides};}
export function previewReport(body={}){
  const range=dateRange(body,now),inventory=[],batches=[];
  for(let i=0;i<range.days.length;i++){
    const day=range.days[i],real=1+Math.floor(i/5);
    inventory.push({...inventorySnapshot(listings,new Date(day+'T20:00:00Z')),real});
    const count=4+Math.floor(i/2)+i%4;
    for(let j=0;j<count;j++){
      const timestamp=day+'T'+String(13+j%8).padStart(2,'0')+':00:00Z',listing=j%4?listings[0]:listings[1];
      batches.push(batch({id:day+'-'+j,visit:day+'-visit-'+j,visitor:'browser-'+j,sentAt:timestamp,device:j%3?'mobile':'desktop',activeMs:25000+j*9000,clicks:2+j,referrer:j%3?'www.google.com':'',events:[{type:'page_view',at:timestamp},{type:'listing_view',listingId:listing.id,at:timestamp},{type:'photo_open',listingId:listing.id,photo:listing.images[0],at:timestamp},...(j%2?[{type:'save',listingId:listing.id,at:timestamp}]:[]),...(j%4===0?[{type:'contact',listingId:listing.id,channel:'whatsapp',at:timestamp}]:[])]}));
    }
  }
  return summarize({batches,inventory,startedAt:range.start+'T06:00:00Z',range,kind:body.kind||'all',page:Number(body.page)||0});
}
