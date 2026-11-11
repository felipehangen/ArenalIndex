import test,{afterEach} from 'node:test';
const nativeSetTimeout=globalThis.setTimeout;
afterEach(()=>{globalThis.setTimeout=nativeSetTimeout;});
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML} from 'linkedom';
import * as client from '../site/admin/client.mjs';
import {approvedRow,editorial} from './publication-fixture.mjs';
let sequence=0;
function environment({authenticated=true,legacy=false,draft=false,ready=false,published=false}={}){
  globalThis.setTimeout=(fn,ms)=>{const timer=nativeSetTimeout(fn,ms);timer.unref();return timer;};
  const {window,document}=parseHTML(fs.readFileSync(new URL('../site/'+(legacy?'newlisting':'admin')+'/review/index.html',import.meta.url),'utf8'));
  const location={pathname:legacy?'/newlisting/review/':'/admin/review/',hash:'#id=test-property-01'+(legacy?'&token='+'b'.repeat(64):''),replace(url){this.destination=url;}};
  const storage=new Map();Object.assign(globalThis,{window,document,location,sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
  window.ArenalConfig=globalThis.ArenalConfig={intakeUrl:'https://backend.example/api/intake'};
  client.clearSession();const identity={token:'a'.repeat(64),email:'felipehangen@gmail.com',expiresAt:Date.now()+3600000};if(authenticated)client.saveSession(identity);
  const row=approvedRow(),calls=[];let resultStatus=200;
  const record={id:row.id,version:row.version,status:draft?'draft':ready?'ready_for_review':'approved',draft:{...row.payload,files:draft?[]:row.payload.files.map(f=>({...f,url:'https://files.example/'+f.id}))},review:row.review,editorial,locality:{place:'El Castillo · La Fortuna'},publishedVersion:draft||published?1:null,publicationRevision:0,editRevision:4};
  globalThis.fetch=async(url,options)=>{
    const body=JSON.parse(options.body);calls.push({url,headers:options.headers,...body});
    const result=body.action==='session'?identity:body.action==='review'?record:body.action==='logout'?{signedOut:true}:body.action==='preview_publication'?{listing:{name:body.editorial.title}}:body.action==='approve_publish'?{status:'approved',version:record.version,publishedVersion:record.version,publicationRevision:1,editorial:body.editorial}:body.action==='approve'?{status:'approved',version:record.version}:body.action==='unpublish'?{status:record.status,version:record.version,publishedVersion:null,publicationRevision:1}:{};
    return new Response(JSON.stringify(resultStatus===200?result:{error:'Tu sesión venció. Volvé a entrar con Google.'}),{status:resultStatus,headers:{'Content-Type':'application/json'}});
  };
  const open=()=>import('../site/newlisting/review.mjs?test='+ ++sequence);
  return {window,document,location,calls,open,deny(){resultStatus=401;},fail(){resultStatus=422;}};
}
test('direct administrator review requires login and retains its destination without requesting files',async()=>{
  const e=environment({authenticated:false});await e.open();
  assert.equal(e.location.destination,'/admin/#review=test-property-01');assert.equal(e.calls.length,0);assert.equal(e.document.querySelector('#review-content').textContent,'');
});
test('administrator review uses a server session and withdrawal of a reopened draft leaves a visible confirmation',async()=>{
  const e=environment({draft:true});await e.open();
  assert.deepEqual(e.calls.map(c=>c.action),['session','review']);
  for(const call of e.calls){assert.equal(call.url,'https://backend.example/api/admin');assert.equal(call.headers.Authorization,'Bearer '+'a'.repeat(64));assert.ok(!call.headers['X-Review-Token']);}
  assert.match(e.document.querySelector('#review-content').textContent,/está en borrador/);
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
test('administrator review links to direct editing and offers an owner reopening action without mandatory comments',async()=>{
  const e=environment();await e.open();
  assert.equal(e.document.querySelector('.review-admin-tools a').getAttribute('href'),'/newlisting/?admin=test-property-01&edit=1');
  assert.match(e.document.querySelector('#reopen-owner').textContent,/Devolver para cambios/);
  assert.match(e.document.querySelector('#public-place').parentElement.textContent,/Sugerida a partir del pin/);
  await e.document.querySelector('#sign-out').onclick();
});
test('existing email review links continue to use their review token without requiring Google',async()=>{
  const e=environment({authenticated:false,legacy:true});await e.open();
  assert.equal(e.calls.length,1);assert.equal(e.calls[0].action,'review');assert.equal(e.calls[0].headers['X-Review-Token'],'b'.repeat(64));
  assert.ok(!e.calls[0].headers.Authorization);assert.ok(e.document.querySelector('#public-title'));
});

function completeChecks(e){
  for(const input of e.document.querySelectorAll('#review-form input[type=checkbox]'))input.checked=true;
  e.document.querySelector('#review-form').oninput();
}
test('one review screen previews and publishes a submitted version without a separate approval',async()=>{
  const e=environment({ready:true,published:true});await e.open();const $=s=>e.document.querySelector(s);
  assert.ok($('#public-title'));assert.equal($('#public-publish').textContent,'Aprobar y publicar cambios');assert.equal($('#public-publish').disabled,true);
  completeChecks(e);let preview;
  e.window.open=()=>preview={sessionStorage:{setItem(key,value){this.value=value;}},location:{replace(url){this.url=url;}},close(){}};
  await $('#public-preview').onclick();assert.equal(preview.location.url,'/newlisting/preview/');
  assert.equal(e.calls.at(-1).action,'preview_publication');assert.equal(e.calls.at(-1).review.plan_matches,true);assert.equal(e.calls.at(-1).editRevision,4);
  $('#public-confirm').checked=true;$('.publication-panel').oninput({target:$('#public-confirm')});assert.equal($('#public-publish').disabled,false);
  await $('#public-publish').onclick();assert.equal(e.calls.at(-1).action,'approve_publish');assert.equal(e.calls.some(c=>c.action==='approve'),false);
  assert.match($('#public-message').textContent,/está publicado/);
});
test('changing review facts clears publication confirmation; failed publication retains the entered fields',async()=>{
  const e=environment({ready:true});await e.open();const $=s=>e.document.querySelector(s);completeChecks(e);
  $('#public-confirm').checked=true;$('#documented-area').value='3199';$('#review-form').oninput({target:$('#documented-area')});
  assert.equal($('#public-confirm').checked,false);assert.equal($('#copy-checked').checked,false);assert.equal($('#public-publish').disabled,true);
  completeChecks(e);$('#public-title').value='Título corregido';$('#public-confirm').checked=true;e.fail();
  await $('#public-publish').onclick();assert.equal($('#public-title').value,'Título corregido');assert.equal($('#documented-area').value,'3199');assert.equal($('#public-publish').textContent,'Aprobar y publicar');
});
test('saving approval for later is optional and does not publish or discard the current public copy',async()=>{
  const e=environment({ready:true});await e.open();const $=s=>e.document.querySelector(s);completeChecks(e);
  assert.ok($('#approve').closest('details'));$('#public-title').value='Título preparado';
  await $('#approve').onclick();
  assert.equal(e.calls.at(-1).action,'approve');assert.equal(e.calls.some(c=>c.action==='approve_publish'||c.action==='publish'),false);assert.equal($('#public-title').value,'Título preparado');
});
