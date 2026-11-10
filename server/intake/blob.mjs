import * as blob from '@vercel/blob';
import {createHash} from 'node:crypto';

const hash=value=>createHash('sha256').update(value).digest('hex');
const conflict=error=>error instanceof blob.BlobPreconditionFailedError||/already exists/i.test(error.message);
const authPath=(kind,id)=>{
  if(!['challenge','session','owner-challenge','owner-session'].includes(kind)||!/^[a-f0-9]{64}$/.test(id))throw Error('Invalid auth key');
  return 'admin/'+kind+'/'+id+'.json';
};
// Fresh reads plus conditional writes keep approvals tied to one immutable version.
export function createRepository({storeId,token,sdk=blob,now=Date.now}={}){
  const auth={...(storeId?{storeId}:{}),...(token?{token}:{})};
  const options=()=>({...auth,access:'private',abortSignal:AbortSignal.timeout(20000)});
  // Compression weakens ETags and removes the original Content-Length. Both are
  // required for conditional writes and for checking the actual uploaded size.
  const readOptions=()=>({...options(),useCache:false,headers:{'Accept-Encoding':'identity'}});
  async function read(path){
    const result=await sdk.get(path,readOptions());
    if(!result)return null;
    return {row:await new Response(result.stream).json(),etag:result.blob.etag};
  }
  async function write(path,row,etag,extra={}){
    try{
      await sdk.put(path,JSON.stringify(row),{...options(),contentType:'application/json',addRandomSuffix:false,allowOverwrite:!!etag,...(etag?{ifMatch:etag}:{}),...extra});
      return row;
    }catch(error){if(conflict(error))return null;throw error;}
  }
  async function signed(path,operation,file){
    const validUntil=now()+(operation==='put'?30:10)*60000;
    const constraints=file?{allowedContentTypes:[file.type],maximumSizeInBytes:file.size}:{};
    const delegation=await sdk.issueSignedToken({...auth,pathname:path,operations:[operation],validUntil,...constraints});
    return (await sdk.presignUrl(delegation,{access:'private',pathname:path,operation,validUntil,...constraints,...(file?{allowOverwrite:false,addRandomSuffix:false}:{useCache:false})})).presignedUrl;
  }
  return {
    async portalGet(kind,id){return (await read(portalPath(kind,id)))?.row||null;},
    async portalCreate(kind,id,row,ttlDays){return write(portalPath(kind,id),row,null,ttlDays?{ttlDays}:{});},
    async portalUpdate(kind,id,filters,patch){
      const path=portalPath(kind,id),current=await read(path);
      if(!current||Object.entries(filters).some(([key,value])=>current.row[key]!==value))return null;
      return write(path,{...current.row,...patch},current.etag);
    },
    async ownerAccounts(){
      const records=[];let cursor;
      do{const page=await sdk.list({...auth,prefix:'portal/accounts/',limit:100,...(cursor?{cursor}:{})});
        for(let offset=0;offset<page.blobs.length;offset+=10){const rows=await Promise.all(page.blobs.slice(offset,offset+10).map(entry=>read(entry.pathname)));records.push(...rows.filter(Boolean).map(result=>result.row));}
        cursor=page.hasMore?page.cursor:null;
      }while(cursor);return records;
    },
    async ensureOwnerIndex(subject,id){await write('owners/'+hash(subject)+'/'+id+'.json',{id});},
    async ownerRecords(subject,cursor){
      const prefix='owners/'+hash(subject)+'/',page=await sdk.list({...auth,prefix,limit:50,...(cursor?{cursor}:{})});
      const ids=page.blobs.map(entry=>entry.pathname.slice(prefix.length).match(/^([a-zA-Z0-9-]{8,80})\.json$/)?.[1]).filter(Boolean);
      const records=[];for(let offset=0;offset<ids.length;offset+=10){
        const batch=await Promise.all(ids.slice(offset,offset+10).map(async id=>(await read('records/'+id+'.json'))?.row));
        records.push(...batch.filter(row=>row?.owner_subject===subject));
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
      const page=await sdk.list({...auth,prefix:'records/',limit:50,...(cursor?{cursor}:{})});
      const ids=page.blobs.map(item=>item.pathname.match(/^records\/([a-zA-Z0-9-]{8,80})\.json$/)?.[1]).filter(Boolean);
      const records=[];
      for(let offset=0;offset<ids.length;offset+=10){
        const batch=await Promise.all(ids.slice(offset,offset+10).map(async id=>(await read('records/'+id+'.json'))?.row));
        records.push(...batch.filter(Boolean));
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
        const page=await sdk.list({...auth,prefix:'published/',limit:1000,...(cursor?{cursor}:{})});
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
      const result=await sdk.get('files/'+path,readOptions());
      if(!result)return null;
      if(result.blob.size!==file.size||result.blob.contentType.split(';')[0]!==file.type){await result.stream.cancel();return null;}
      const reader=result.stream.getReader(),bytes=new Uint8Array(32);let length=0;
      try{
        while(length<bytes.length){const chunk=await reader.read();if(chunk.done)break;const part=chunk.value.subarray(0,bytes.length-length);bytes.set(part,length);length+=part.length;}
      }finally{await reader.cancel();}
      return {size:result.blob.size,bytes:bytes.subarray(0,length)};
    }
  };
}
function portalPath(kind,id){
  if(!['accounts','emails','stages','geocodes'].includes(kind)||!/^[a-f0-9]{64}$/.test(id))throw Error('Invalid portal key');
  return 'portal/'+kind+'/'+id+'.json';
}
