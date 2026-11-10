import {createHash} from 'node:crypto';
import {createOwnerHandler} from '../server/portal/core.mjs';
import {createAdminHandler} from '../server/admin/core.mjs';
import {png,pdf} from './intake-fixtures.mjs';
export const hash=value=>createHash('sha256').update(value).digest('hex');
export function portalFixture({acceptRules=true}={}){
  const rows=new Map(),portal=new Map(),auth=new Map(),files=new Map(),emails=[];let clock=Date.parse('2026-11-09T12:00:00Z');
  const clone=value=>structuredClone(value);
  function update(map,key,filters,patch){const row=map.get(key);if(!row||Object.entries(filters).some(([k,v])=>row[k]!==v))return null;Object.assign(row,clone(patch));return clone(row);}
  const repository={
    async ownerAccounts(){return [...portal].filter(([key])=>key.startsWith('accounts/')).map(([,value])=>clone(value));},
    async allow(){return true;},async ensureOwnerIndex(){},async ensurePublishedIndex(){},
    async get(id){return clone(rows.get(id)||null);},async create(row){if(rows.has(row.id))return null;rows.set(row.id,clone(row));return clone(row);},async update(id,filters,patch){return update(rows,id,filters,patch);},
    async records(){return {records:[...rows.values()],cursor:null};},async ownerRecords(subject){return {records:[...rows.values()].filter(r=>r.owner_subject===subject),cursor:null};},
    async portalGet(kind,id){return clone(portal.get(kind+'/'+id)||null);},async portalCreate(kind,id,row){const key=kind+'/'+id;if(portal.has(key))return null;portal.set(key,clone(row));return clone(row);},async portalUpdate(kind,id,filters,patch){return update(portal,kind+'/'+id,filters,patch);},
    async authGet(kind,id){return clone(auth.get(kind+'/'+id)||null);},async authCreate(kind,id,row){auth.set(kind+'/'+id,clone(row));},async authUpdate(kind,id,filters,patch){return update(auth,kind+'/'+id,filters,patch);},
    async downloadURL(path){return 'https://files.example/'+path;},async uploadURL(path,file){return 'https://files.example/'+path;},async inspectFile(path){return files.get(path)||null;}
  };
  const options={repository,mailer:{async send(message){emails.push(message);}},now:()=>new Date(clock),verifyGoogle:async credential=>{if(credential==='invalid')throw Error('invalid');return {subject:credential,email:credential+'@gmail.com'};},config:{googleClientId:'google-client',adminEmails:['admin@gmail.com'],reviewEmail:'admin@gmail.com',reviewSecret:'x'.repeat(64),rateSalt:'salt',emailReady:true,siteURL:'https://arenalindex.com',publicAPIURL:'https://backend.example/api/listings'}};
  const owner=createOwnerHandler(options),admin=createAdminHandler(options);
  async function call(action,body={},token,role='owner',headers={}){
    const response=await(role==='admin'?admin:owner)(new Request('https://backend.example/api/'+role,{method:'POST',headers:{Origin:'https://arenalindex.com',...(token?{Authorization:'Bearer '+token}:{}),...headers},body:JSON.stringify({action,...body})}));return {status:response.status,body:await response.json()};
  }
  async function login(subject,role='owner',extra={}){
    const challenge=await call('challenge',{},undefined,role);
    const result=await call('login',{nonce:challenge.body.nonce,credential:subject,...extra},undefined,role);
    if(acceptRules&&role==='owner'&&result.status===200)await accept(result.body.token,result.body.listingRules);
    return result;
  }
  async function accept(token,rules){rules||=(await call('session',{},token)).body.listingRules;const result=await call('accept_listing_rules',{accepted:true,version:rules.version,contentHash:rules.contentHash,language:'en'},token);if(result.status!==200)throw Error(JSON.stringify(result));return result;}
  async function adminSession(){const result=await login('admin','admin');return result.body.token;}
  async function register(subject,token){const result=await call('create_account',{email:subject+'@gmail.com'},token,'admin');if(result.status!==200)throw Error(JSON.stringify(result));return result;}
  function upload(prepared,payload){for(const upload of prepared.uploads){const f=payload.files.find(f=>f.id===upload.id),path=upload.url.replace('https://files.example/','');files.set(path,{size:f.size,bytes:f.type==='application/pdf'?pdf:png});}}
  return {rows,portal,auth,files,emails,repository,options,call,login,accept,adminSession,register,upload,advance:ms=>clock+=ms};
}
