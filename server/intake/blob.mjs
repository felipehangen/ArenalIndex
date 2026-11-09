import * as blob from '@vercel/blob';
import {createHash} from 'node:crypto';

const hash=value=>createHash('sha256').update(value).digest('hex');
const conflict=error=>error instanceof blob.BlobPreconditionFailedError||/already exists/i.test(error.message);
// Fresh reads plus conditional writes keep approvals tied to one immutable version.
export function createRepository({storeId,token,sdk=blob,now=Date.now}={}){
  const auth={...(storeId?{storeId}:{}),...(token?{token}:{})};
  const options=()=>({...auth,access:'private',abortSignal:AbortSignal.timeout(20000)});
  async function read(path){
    const result=await sdk.get(path,{...options(),useCache:false});
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
      const result=await sdk.get('files/'+path,{...options(),useCache:false});
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
