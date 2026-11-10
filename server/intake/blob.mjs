import * as blob from '@vercel/blob';
import {createHash} from 'node:crypto';
import {analyticsStore} from '../analytics/store.mjs';
import {storageRequest} from './storage-request.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const conflict=error=>error instanceof blob.BlobPreconditionFailedError||/already exists/i.test(error.message);
const authPath=(kind,id)=>{
  if(!['challenge','session','owner-challenge','owner-session'].includes(kind)||!/^[a-f0-9]{64}$/.test(id))throw Error('Invalid auth key');
  return 'admin/'+kind+'/'+id+'.json';
};
// Fresh reads plus conditional writes keep approvals tied to one immutable version.
export function createRepository({storeId,token,sdk=blob,now=Date.now,timeoutMs,deadline,diagnostic}={}){
  const auth={...(storeId?{storeId}:{}),...(token?{token}:{})};
  const run=storageRequest({timeoutMs,deadline,diagnostic});
  const collection=path=>['admin','portal','analytics'].includes(path.split('/')[0])?path.split('/').slice(0,2).join('/').replace(/\.json$/,''):path.split('/')[0];
  const options=signal=>({...auth,access:'private',abortSignal:signal});
  // Compression weakens ETags and removes the original Content-Length. Both are
  // required for conditional writes and for checking the actual uploaded size.
  const readOptions=signal=>({...options(signal),useCache:false,headers:{'Accept-Encoding':'identity'}});
  const list=values=>run('list',collection(values.prefix),signal=>sdk.list({...auth,...values,abortSignal:signal}),{retry:true});
  async function read(path){
    return run('read',collection(path),async signal=>{
      const result=await sdk.get(path,readOptions(signal));
      if(!result)return null;
      return {row:await new Response(result.stream).json(),etag:result.blob.etag};
    },{retry:true});
  }
  async function write(path,row,etag,extra={}){
    return run('write',collection(path),async signal=>{
      try{
        await sdk.put(path,JSON.stringify(row),{...options(signal),contentType:'application/json',addRandomSuffix:false,allowOverwrite:!!etag,...(etag?{ifMatch:etag}:{}),...extra});
        return row;
      }catch(error){if(conflict(error))return null;throw error;}
    });
  }
  async function signed(path,operation,file){
    const validUntil=now()+(operation==='put'?30:10)*60000;
    const constraints=file?{allowedContentTypes:[file.type],maximumSizeInBytes:file.size}:{};
    const delegation=await run('sign','files',signal=>sdk.issueSignedToken({...auth,abortSignal:signal,pathname:path,operations:[operation],validUntil,...constraints}));
    return (await sdk.presignUrl(delegation,{access:'private',pathname:path,operation,validUntil,...constraints,...(file?{allowOverwrite:false,addRandomSuffix:false}:{useCache:false})})).presignedUrl;
  }
  return {
    ...analyticsStore({read,write,list}),
    async catalogState(){return (await read('catalog/decisions.json'))?.row||{};},
    async catalogUpdate(id,revision,decision){
      const current=await read('catalog/decisions.json');
      if((current?.row[id]?.revision||0)!==revision)return null;
      return write('catalog/decisions.json',{...current?.row,[id]:decision},current?.etag);
    },
    async portalGet(kind,id){return (await read(portalPath(kind,id)))?.row||null;},
    async portalCreate(kind,id,row,ttlDays){return write(portalPath(kind,id),row,null,ttlDays?{ttlDays}:{});},
    async portalUpdate(kind,id,filters,patch){
      const path=portalPath(kind,id),current=await read(path);
      if(!current||Object.entries(filters).some(([key,value])=>current.row[key]!==value))return null;
      return write(path,{...current.row,...patch},current.etag);
    },
    async ownerAccounts(){
      const records=[];let cursor;
      do{const page=await list({prefix:'portal/accounts/',limit:100,...(cursor?{cursor}:{})});
        for(let offset=0;offset<page.blobs.length;offset+=10){const rows=await Promise.all(page.blobs.slice(offset,offset+10).map(entry=>read(entry.pathname)));records.push(...rows.filter(Boolean).map(result=>result.row));}
        cursor=page.hasMore?page.cursor:null;
      }while(cursor);return records;
    },
    async ensureOwnerIndex(subject,id){await write('owners/'+hash(subject)+'/'+id+'.json',{id});},
    async ownerRecords(subject,cursor){
      const prefix='owners/'+hash(subject)+'/',page=await list({prefix,limit:50,...(cursor?{cursor}:{})});
      const ids=page.blobs.map(entry=>entry.pathname.slice(prefix.length).match(/^([a-zA-Z0-9-]{8,80})\.json$/)?.[1]).filter(Boolean);
      const records=[];for(let offset=0;offset<ids.length;offset+=10){
        const batch=await Promise.all(ids.slice(offset,offset+10).map(async id=>(await read('records/'+id+'.json'))?.row));
        records.push(...batch.filter(row=>row?.owner_subject===subject&&row.status!=='deleted'));
      }return {records,cursor:page.hasMore?page.cursor:null};
    },
    async authCreate(kind,id,row){
      const result=await write(authPath(kind,id),row,null,{ttlDays:1});
      if(!result)throw Error('Could not create auth record');return result;
    },
    async authGet(kind,id){return (await read(authPath(kind,id)))?.row||null;},
    async authUpdate(kind,id,filters,patch){
      const path=authPath(kind,id),current=await read(path);
      if(!current||Object.entries(filters).some(([key,value])=>current.row[key]!==value))return null;
      return write(path,{...current.row,...patch},current.etag,{ttlDays:1});
    },
    async records(cursor){
      const page=await list({prefix:'records/',limit:50,...(cursor?{cursor}:{})});
      const ids=page.blobs.map(item=>item.pathname.match(/^records\/([a-zA-Z0-9-]{8,80})\.json$/)?.[1]).filter(Boolean);
      const records=[];
      for(let offset=0;offset<ids.length;offset+=10){
        const batch=await Promise.all(ids.slice(offset,offset+10).map(async id=>(await read('records/'+id+'.json'))?.row));
        records.push(...batch.filter(row=>row&&row.status!=='deleted'));
      }
      return {records,cursor:page.hasMore?page.cursor:null};
    },
    async ensurePublishedIndex(id){
      const path='published/'+id+'.json';
      if(await read(path))return;
      await write(path,{id});
    },
    async published(){
      const ids=[];let cursor;
      do{
        const page=await list({prefix:'published/',limit:1000,...(cursor?{cursor}:{})});
        for(const item of page.blobs){const id=item.pathname.match(/^published\/([a-zA-Z0-9-]{8,80})\.json$/)?.[1];if(id)ids.push(id);}
        cursor=page.hasMore?page.cursor:null;
      }while(cursor);
      const listings=[];
      for(let offset=0;offset<ids.length;offset+=12){
        const batch=await Promise.all(ids.slice(offset,offset+12).map(async id=>(await read('records/'+id+'.json'))?.row.publication?.listing));
        listings.push(...batch.filter(Boolean));
      }
      return listings;
    },
    async health(){try{await read('health.json');return true;}catch{return false;}},
    async get(id){return (await read('records/'+id+'.json'))?.row||null;},
    async create(row){return write('records/'+row.id+'.json',row);},
    async update(id,filters,patch){
      const path='records/'+id+'.json',current=await read(path);
      if(!current||Object.entries(filters).some(([key,value])=>current.row[key]!==value))return null;
      return write(path,{...current.row,...patch},current.etag);
    },
    async allow(key,limit){
      const path='limits/'+Math.floor(now()/3600000)+'/'+hash(key)+'.json';
      for(let attempt=0;attempt<6;attempt++){
        const current=await read(path),count=current?.row.count||0;
        if(count>=limit)return false;
        if(await write(path,{count:count+1},current?.etag,{ttlDays:1}))return true;
      }
      return false;
    },
    uploadURL(path,file){return signed('files/'+path,'put',file);},
    downloadURL(path){return signed('files/'+path,'get');},
    async inspectFile(path,file){
      return run('inspect','files',async signal=>{
        const result=await sdk.get('files/'+path,readOptions(signal));
        if(!result)return null;
        if(result.blob.size!==file.size||result.blob.contentType.split(';')[0]!==file.type){await result.stream.cancel();return null;}
        const reader=result.stream.getReader(),bytes=new Uint8Array(32);let length=0;
        try{
          while(length<bytes.length){const chunk=await reader.read();if(chunk.done)break;const part=chunk.value.subarray(0,bytes.length-length);bytes.set(part,length);length+=part.length;}
        }finally{await reader.cancel();}
        return {size:result.blob.size,bytes:bytes.subarray(0,length)};
      },{retry:true});
    }
  };
}
function portalPath(kind,id){
  if(!['accounts','emails','stages','geocodes'].includes(kind)||!/^[a-f0-9]{64}$/.test(id))throw Error('Invalid portal key');
  return 'portal/'+kind+'/'+id+'.json';
}
