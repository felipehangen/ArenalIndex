import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML} from 'linkedom';
import {mountOffer} from '../site/offer/app.mjs';
import {mountOffers} from '../site/cuenta/offers.mjs';
import {mountBrokerResources} from '../site/cuenta/resources.mjs';
import {blankOffer,noticeVersion,notice} from '../site/offer/model.mjs';
import {proposalSummary} from '../site/offer/view.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const record=()=>({id:'a'.repeat(64),url:'https://arenalindex.com/offer/#'+'a'.repeat(64)+'.'+'b'.repeat(64),property:{name:'Lake <House>',titles:{en:'Lake <House>',es:'Casa del lago'},place:'La Fortuna',currency:'USD',price:180000,area:1000,image:'/photos/lot.jpg',isDemo:true},broker:'Broker <Arenal>',revision:0,versions:[],reviewedRevision:0,expiresAt:'2099-12-01T12:00:00Z',createdAt:'2026-11-11T12:00:00Z',revoked:false});
function dom(path){
  const {document,window}=parseHTML(fs.readFileSync(new URL(path,import.meta.url),'utf8'));
  Object.defineProperty(window.HTMLInputElement.prototype,'checked',{configurable:true,get(){return this.hasAttribute('checked');},set(v){if(v)this.setAttribute('checked','');else this.removeAttribute('checked');}});
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.value||this.querySelector('option')?.value||'';},set(v){for(const o of this.querySelectorAll('option')){if(o.value===v)o.setAttribute('selected','');else o.removeAttribute('selected');}}});
  window.ArenalI18n={language:'en',locale:'en-US',t:s=>s};
  window.location={hash:'#'+'a'.repeat(64)+'.'+'b'.repeat(64),reload(){}};window.print=()=>{window.printed=true;};
  return {document,window,$:s=>document.querySelector(s)};
}
async function buyer({stored,handler,blockedStorage=false}={}){
  const e=dom('../site/offer/index.html'),calls=[],store=new Map(stored?[['arenalindex.offer-draft:'+'a'.repeat(64),JSON.stringify(stored)]]:[]);let row=record();
  const api=async(action,body)=>{calls.push({action,body});if(handler){const result=await handler(action,body);if(result)return result;}if(action==='offer_open')return structuredClone(row);if(action==='offer_submit'){row.revision++;row.versions.push({revision:row.revision,offer:body.offer,submittedAt:'2026-11-11T12:00:00Z',validUntil:'2026-11-18T12:00:00Z',notice:notice.en,noticeVersion});return structuredClone(row);}throw Error(action);};
  const controller=mountOffer({...e,api,storage:{getItem:k=>store.get(k),setItem(k,v){if(blockedStorage)throw Error('Blocked');store.set(k,v);},removeItem:k=>store.delete(k)}});await controller.ready;
  const set=(name,value)=>{const el=e.$('[name="'+name+'"]');el.value=value;el.dispatchEvent(new e.window.Event('input',{bubbles:true}));return el;};
  const choose=(name,value)=>{const el=e.$('[name="'+name+'"][value="'+value+'"]');for(const input of e.document.querySelectorAll('[name="'+name+'"]'))if(input.type==='radio')input.checked=false;el.checked=true;el.dispatchEvent(new e.window.Event('input',{bubbles:true}));el.dispatchEvent(new e.window.Event('change',{bubbles:true}));};
  const submit=async()=>{e.$('#offer-form').dispatchEvent(new e.window.Event('submit',{bubbles:true,cancelable:true}));await tick();};
  return {...e,calls,store,set,choose,submit};
}
test('buyer completes the guided form, reviews/edit terms, explicitly confirms, and receives a printable immutable copy',async()=>{
  const e=await buyer();assert.match(e.$('h1').textContent,/clearly expressed/);assert.match(e.$('.demo-notice').textContent,/fictional/);
  await e.submit();assert.ok(e.$('[name=amount][aria-invalid=true]'));assert.equal(e.calls.length,1);
  e.set('amount','155000');await e.submit();
  e.choose('funding','cash');e.choose('depositMode','amount');assert.equal(e.$('#deposit-field').hidden,false);e.set('deposit','10000');e.choose('closing','60');await e.submit();
  e.choose('conditions','inspection');e.set('otherConditions','Furniture included');e.set('message','Happy to discuss');await e.submit();
  e.set('name','Buyer <Test>');e.set('email','buyer@example.test');await e.submit();
  assert.match(e.$('.proposal-paper').textContent,/155,000/);assert.match(e.$('.proposal-paper').textContent,/Furniture included/);assert.equal(e.$('test'),null);
  await e.submit();assert.equal(e.calls.filter(c=>c.action==='offer_submit').length,0);
  e.$('[data-edit-step="0"]').click();e.set('amount','156000');await e.submit();await e.submit();await e.submit();await e.submit();
  const confirm=e.$('[name=confirmed]');confirm.checked=true;confirm.dispatchEvent(new e.window.Event('input',{bubbles:true}));await e.submit();
  const request=e.calls.find(c=>c.action==='offer_submit');assert.equal(request.body.offer.amount,'156000');assert.equal(request.body.offer.deposit,'10000');assert.deepEqual(request.body.offer.conditions,['inspection']);assert.equal(request.body.confirmed,true);
  assert.ok(e.$('.offer-success'));assert.match(e.$('.proposal-paper').textContent,/Version 1/);assert.equal(e.store.size,0);e.$('[data-print]').click();assert.equal(e.window.printed,true);
  e.$('[data-revise]').click();assert.equal(e.$('[name=amount]').value,'156000');assert.equal(e.calls.filter(c=>c.action==='offer_submit').length,1);
});
test('language changes preserve values and saved drafts resume at the same step without submission',async()=>{
  const e=await buyer();e.set('amount','120000');e.window.ArenalI18n.language='es';e.window.dispatchEvent(new e.window.Event('arenal-language-change'));assert.equal(e.$('[name=amount]').value,'120000');assert.match(e.$('h1').textContent,/claramente/);
  await e.submit();e.choose('funding','guidance');const stored=JSON.parse([...e.store.values()][0]);const f=await buyer({stored});assert.equal(f.$('[name=funding][value=guidance]').checked,true);assert.match(f.$('h2[tabindex]').textContent,/purchase plan/);assert.equal(f.calls.length,1);
});
test('lost submission response retains form and reuses idempotency key; unavailable storage remains usable',async()=>{
  let fail=true;const draft={...blankOffer('USD'),name:'Buyer',email:'buyer@example.test',amount:'100000',funding:'guidance',depositMode:'discuss',closing:'flexible'};
  const e=await buyer({blockedStorage:true,stored:{draft,step:4,revision:0,submissionId:'c'.repeat(32)},handler:async action=>{if(action==='offer_submit'&&fail)throw Error('Connection interrupted');}});
  assert.match(e.$('.offer-save-note').textContent,/Keep this tab open/);e.$('[name=confirmed]').checked=true;await e.submit();assert.match(e.$('.offer-error').textContent,/interrupted/);assert.ok(e.$('#offer-form'));fail=false;await e.submit();
  const submissions=e.calls.filter(c=>c.action==='offer_submit');assert.equal(submissions.length,2);assert.equal(submissions[0].body.submissionId,submissions[1].body.submissionId);assert.ok(e.$('.offer-success'));
});
test('summary escapes user input and shows currency, funding uncertainty, literal terms and historical notice',()=>{
  const html=proposalSummary({property:record().property,broker:record().broker,language:'en',offer:{...blankOffer('CRC'),amount:'90000000',name:'<img src=x onerror=alert(1)>',email:'buyer@example.test',funding:'guidance',depositMode:'discuss',closing:'flexible',conditions:[],otherConditions:'<script>bad</script>'}});
  const {document}=parseHTML(html);assert.equal(document.querySelector('script'),null);assert.equal(document.querySelector('img'),null);assert.match(document.querySelector('.proposal-paper').textContent,/CRC/);assert.match(document.querySelector('.proposal-paper').textContent,/I need guidance/);assert.match(html,/&lt;script&gt;/);
});
test('account offers integrate with tabs and listing invitation actions, paginate and clear delayed responses on logout',async()=>{
  const e=dom('../site/cuenta/index.html');let resolve;const calls=[];
  const api={request:async(action,body)=>{calls.push({action,body});if(action==='offers_list')return new Promise(done=>resolve=done);if(action==='offer_create')return record();}};
  const controller=mountOffers({...e,api});mountBrokerResources(e);controller.setListings([{id:'property-001',title:'Lake house',publishedVersion:1,publicId:'public-001'}]);controller.setIdentity({email:'broker@example.test'});
  e.$('#admin-records').innerHTML='<button data-offer-invite="property-001">Invite</button>';e.$('[data-offer-invite]').click();assert.equal(e.$('#offers-panel').hidden,false);assert.equal(e.$('#listings-panel').hidden,true);assert.equal(e.$('[name=propertyId]').value,'property-001');
  resolve({records:[],cursor:null});await tick();e.$('[name=label]').value='Test buyer';e.$('#offer-invite-form').dispatchEvent(new e.window.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.ok(e.$('[data-copy]'));assert.equal(calls.find(c=>c.action==='offer_create').body.propertyId,'property-001');
  e.$('[data-back]').click();e.$('[data-refresh]').click();e.window.dispatchEvent(new e.window.Event('arenal-owner-clear'));resolve({records:[record()],cursor:null});await tick();assert.equal(e.$('#offers-panel').innerHTML,'');assert.equal(e.$('#offers-panel').hidden,true);
});
