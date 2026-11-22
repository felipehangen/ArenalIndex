import {createHash} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';

// Compare executable source rather than Git SHAs so documentation-only commits
// and the daily exchange-rate refresh do not require an API redeployment.
export async function runtimeDigest(root){
  const files=['package.json','package-lock.json','vercel.json','scripts/build.mjs','scripts/lib/release.mjs','scripts/lib/exchange-rate.mjs'];
  for(const directory of ['api','server','site']){
    const entries=await readdir(join(root,directory),{recursive:true,withFileTypes:true});
    for(const entry of entries)if(entry.isFile()){
      const parent=entry.parentPath||entry.path;
      const relative=join(parent,entry.name).slice(root.length+1).replaceAll('\\','/');
      if(!['site/exchange-rate.json','site/exchange-rate.js'].includes(relative))files.push(relative);
    }
  }
  const hash=createHash('sha256');
  for(const file of files.sort())hash.update(file+'\0').update(await readFile(join(root,file))).update('\0');
  return hash.digest('hex');
}

export async function waitForRelease(expected,{origins=['https://go.arenalindex.com','https://arenalindex-intake.vercel.app'],fetcher=fetch,attempts=40,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),interval=15000}={}){
  for(let attempt=0;attempt<attempts;attempt++){
    const ready=await Promise.all(origins.map(async origin=>{
      try{
        const response=await fetcher(origin+'/release.json?expected='+expected,{cache:'no-store',signal:AbortSignal.timeout(15000)});
        return response.ok&&(await response.json()).runtimeDigest===expected;
      }catch{return false;}
    }));
    if(ready.every(Boolean))return;
    if(attempt+1<attempts)await pause(interval);
  }
  throw Error('The production API hosts do not match this website build. Deploy the reviewed commit with npm run release, then rerun the Pages workflow.');
}
