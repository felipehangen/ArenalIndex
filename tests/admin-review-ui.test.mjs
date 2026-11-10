import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML} from 'linkedom';
import * as client from '../site/admin/client.mjs';
import {approvedRow,editorial} from './publication-fixture.mjs';
let sequence=0;
function environment({authenticated=true,legacy=false,draft=false}={}){
  const {window,document}=parseHTML(fs.readFileSync(new URL('../site/'+(legacy?'newlisting':'admin')+'/review/index.html',import.meta.url),'utf8'));
  const location={pathname:legacy?'/newlisting/review/':'/admin/review/',hash:'#id=test-property-01'+(legacy?'&token='+'b'.repeat(64):''),replace(url){this.destination=url;}};
  const storage=new Map();Object.assign(globalThis,{window,document,location,sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
  window.ArenalConfig=globalThis.ArenalConfig={intakeUrl:'https://backend.example/api/intake'};
  client.clearSession();const identity={token:'a'.repeat(64),email:'felipehangen@gmail.com',expiresAt:Date.now()+3600000};if(authenticated)client.saveSession(identity);
  const row=approvedRow(),calls=[];let resultStatus=200;
  const record={id:row.id,version:row.version,status:draft?'draft':'approved',draft:{...row.payload,files:draft?[]:row.payload.files.map(f=>({...f,url:'https://files.example/'+f.id}))},review:row.review,editorial,publishedVersion:draft?1:null,publicationRevision:0};
  globalThis.fetch=async(url,options)=>{
    const body=JSON.parse(options.body);calls.push({url,headers:options.headers,...body});
    const result=body.action==='session'?identity:body.action==='review'?record:body.action==='logout'?{signedOut:true}:body.action==='unpublish'?{status:record.status,version:record.version,publishedVersion:null,publicationRevision:1}:{};
    return new Response(JSON.stringify(resultStatus===200?result:{error:'Tu sesión venció. Volvé a entrar con Google.'}),{status:resultStatus,headers:{'Content-Type':'application/json'}});
  };
  const open=()=>import('../site/newlisting/review.mjs?test='+ ++sequence);
  return {window,document,location,calls,open,deny(){resultStatus=401;}};
}
test('direct administrator review requires login and retains its destination without requesting files',async()=>{
  const e=environment({authenticated:false});await e.open();
  assert.equal(e.location.destination,'/admin/#review=test-property-01');assert.equal(e.calls.length,0);assert.equal(e.document.querySelector('#review-content').textContent,'');
});
test('administrator review uses a server session and withdrawal of a reopened draft leaves a visible confirmation',async()=>{
  const e=environment({draft:true});await e.open();
  assert.deepEqual(e.calls.map(c=>c.action),['session','review']);
  for(const call of e.calls){assert.equal(call.url,'https://backend.example/api/admin');assert.equal(call.headers.Authorization,'Bearer '+'a'.repeat(64));assert.ok(!call.headers['X-Review-Token']);}
  assert.match(e.document.querySelector('#review-content').textContent,/sigue en preparación/);
  await e.document.querySelector('#public-unpublish').onclick();
  assert.match(e.document.querySelector('#review-message').textContent,/retirado del catálogo/);
  await e.document.querySelector('#sign-out').onclick();assert.equal(e.document.querySelector('#review-content').textContent,'');assert.equal(client.session(),null);
});
test('an expired administrator session clears an open review and redirects to login',async()=>{
  const e=environment();await e.open();e.deny();
  // Publication confirms on the server; this exercises a protected request with an expired session.
  await e.document.querySelector('#public-publish').onclick();
  assert.equal(e.location.destination,'/admin/#review=test-property-01');assert.equal(e.document.querySelector('#review-content').textContent,'');
});
test('existing email review links continue to use their review token without requiring Google',async()=>{
  const e=environment({authenticated:false,legacy:true});await e.open();
  assert.equal(e.calls.length,1);assert.equal(e.calls[0].action,'review');assert.equal(e.calls[0].headers['X-Review-Token'],'b'.repeat(64));
  assert.ok(!e.calls[0].headers.Authorization);assert.ok(e.document.querySelector('#public-title'));
});
