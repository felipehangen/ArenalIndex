import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML} from 'linkedom';
import {mountOffer} from '../site/offer/app.mjs';
import {mountOffers} from '../site/cuenta/offers.mjs';
import {mountBrokerResources} from '../site/cuenta/resources.mjs';
import {blankSimpleOffer,simpleNotice,blankOffer} from '../site/offer/model.mjs';
import {proposalSummary} from '../site/offer/view.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const token='listing.'+'a'.repeat(64)+'.'+'b'.repeat(64),receiptToken='receipt.'+'c'.repeat(64)+'.'+'d'.repeat(64);
const record=()=>({property:{name:'Lake <House>',titles:{en:'Lake <House>',es:'Casa del lago'},place:'La Fortuna',currency:'USD',price:180000,area:1000,image:'/photos/lot.jpg',isDemo:true},broker:'Broker <Arenal>',propertyVersion:'a'.repeat(64)});
function dom(path){
  const {document,window}=parseHTML(fs.readFileSync(new URL(path,import.meta.url),'utf8'));
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.value||this.querySelector('option')?.value||'';},set(v){for(const o of this.querySelectorAll('option')){if(o.value===v)o.setAttribute('selected','');else o.removeAttribute('selected');}}});
  window.ArenalI18n={language:'en',locale:'en-US',t:s=>s};window.location={hash:'#'+token,reload(){}};window.history={replaceState(a,b,hash){window.location.hash=hash;}};window.print=()=>{window.printed=true;};
  return {document,window,$:s=>document.querySelector(s)};
}
async function buyer({stored,handler,blockedStorage=false}={}){
  const e=dom('../site/offer/index.html'),calls=[],store=new Map(stored?[['arenalindex.simple-offer:'+token,JSON.stringify(stored)]]:[]);
  const api=async(action,body)=>{calls.push({action,body});if(handler){const result=await handler(action,body);if(result)return result;}if(action==='offer_form_open')return record();if(action==='offer_form_submit')return {...record(),id:'c'.repeat(64),receiptURL:'https://arenalindex.com/offer/#'+receiptToken,revision:1,versions:[{revision:1,offer:body.offer,submittedAt:'2026-11-11T12:00:00Z',notice:simpleNotice.en}]};throw Error(action);};
  await mountOffer({...e,api,storage:{getItem:k=>store.get(k),setItem(k,v){if(blockedStorage)throw Error('Blocked');store.set(k,v);},removeItem:k=>store.delete(k)}}).ready;
  const set=(name,value)=>{const el=e.$('[name="'+name+'"]');el.value=value;el.dispatchEvent(new e.window.Event('input',{bubbles:true}));};
  const submit=async()=>{e.$('#offer-form').dispatchEvent(new e.window.Event('submit',{bubbles:true,cancelable:true}));await tick();};
  return {...e,calls,store,set,submit};
}
test('short form asks only amount, currency, name, contact and optional message; review never submits',async()=>{
  const e=await buyer();assert.match(e.$('h1').textContent,/Make an offer/);assert.deepEqual([...e.document.querySelectorAll('#offer-form [name]')].map(el=>el.name),['amount','currency','name','contact','message']);assert.equal(e.$('.offer-steps'),null);
  await e.submit();assert.ok(e.$('[name=amount][aria-invalid=true]'));assert.equal(e.calls.length,1);
  e.set('amount','155000');e.set('name','Buyer <Test>');e.set('contact','+506 8888 7777');e.set('message','Subject to a property inspection.');await e.submit();
  assert.match(e.$('.proposal-paper').textContent,/155,000/);assert.match(e.$('.proposal-paper').textContent,/Subject to a property inspection/);assert.equal(e.calls.length,1);assert.equal(e.$('test'),null);assert.equal(e.$('[type=checkbox]'),null);
  e.$('[data-edit]').click();assert.equal(e.$('[name=message]').value,'Subject to a property inspection.');e.set('amount','156000');await e.submit();await e.submit();
  const request=e.calls.find(c=>c.action==='offer_form_submit');assert.equal(request.body.offer.amount,'156000');assert.equal(request.body.offer.schema,2);assert.equal(request.body.offer.contact,'+506 8888 7777');assert.equal('funding' in request.body.offer,false);assert.equal(request.body.confirmed,true);
  assert.match(e.$('h1').textContent,/Offer sent/);assert.equal(e.store.size,0);assert.equal(e.window.location.hash,'#'+receiptToken);e.$('[data-print]').click();assert.equal(e.window.printed,true);
});
test('language switching and tab draft recovery preserve the short form without inventing terms',async()=>{
  const e=await buyer();e.set('amount','120000');e.set('name','María');e.set('message','Pago al contado');e.window.ArenalI18n.language='es';e.window.dispatchEvent(new e.window.Event('arenal-language-change'));assert.equal(e.$('[name=amount]').value,'120000');assert.match(e.$('h1').textContent,/Hacé una oferta/);
  const stored=JSON.parse([...e.store.values()][0]),f=await buyer({stored});assert.equal(f.$('[name=message]').value,'Pago al contado');assert.equal(f.$('[name=name]').value,'María');assert.equal(f.calls.length,1);
});
test('lost send response keeps review editable and retries the same submission; blocked storage does not prevent sending',async()=>{
  let fail=true;const e=await buyer({blockedStorage:true,stored:{draft:{...blankSimpleOffer('USD'),amount:'100000',name:'Buyer',contact:'buyer@example.test'},submissionId:'c'.repeat(32)},handler:async action=>{if(action==='offer_form_submit'&&fail)throw Error('Connection interrupted');}});
  await e.submit();await e.submit();assert.match(e.$('.offer-error').textContent,/interrupted/);assert.ok(e.$('[data-edit]'));fail=false;await e.submit();
  const sent=e.calls.filter(c=>c.action==='offer_form_submit');assert.equal(sent.length,2);assert.equal(sent[0].body.submissionId,sent[1].body.submissionId);assert.ok(e.$('.offer-success'));
});
test('summary escapes buyer text, leaves unspecified terms out and still renders historical full offers',()=>{
  const html=proposalSummary({...record(),language:'en',offer:{...blankSimpleOffer('CRC'),amount:'90000000',name:'<img src=x>',contact:'buyer@example.test',message:'<script>bad</script>'}}),{document}=parseHTML(html);
  assert.equal(document.querySelector('script'),null);assert.equal(document.querySelector('img'),null);assert.match(document.querySelector('article').textContent,/CRC/);assert.doesNotMatch(document.querySelector('article').textContent,/Funding|Deposit|Validity|Closing/);assert.match(html,/&lt;script&gt;/);
  assert.match(proposalSummary({...record(),language:'en',offer:{...blankOffer('USD'),amount:'100000',funding:'guidance'}}),/I need guidance/);
});
test('listing action retrieves its reusable link directly without a reference or per-buyer setup; logout clears delayed data',async()=>{
  const e=dom('../site/cuenta/index.html'),calls=[];let resolve;
  const api={request:async(action,body)=>{calls.push({action,body});if(action==='offers_list')return new Promise(done=>resolve=done);if(action==='offer_form')return {...record(),url:'https://arenalindex.com/offer/#'+token};}};
  const controller=mountOffers({...e,api});mountBrokerResources(e);controller.setListings([{id:'property-001',title:'Lake house',publishedVersion:1,publicId:'public-001'}]);controller.setIdentity({email:'broker@example.test'});
  e.$('#admin-records').innerHTML='<button data-offer-invite="property-001">Offer form</button>';e.$('[data-offer-invite]').click();await tick();assert.equal(e.$('#offers-panel').hidden,false);assert.ok(e.$('[data-copy]'));assert.equal(e.$('[name=label]'),null);assert.equal(e.$('#offer-link-form'),null);assert.deepEqual(calls.find(c=>c.action==='offer_form').body,{propertyId:'property-001'});
  resolve({records:[],cursor:null});await tick();e.$('[data-refresh]').click();e.window.dispatchEvent(new e.window.Event('arenal-owner-clear'));resolve({records:[],cursor:null});await tick();assert.equal(e.$('#offers-panel').innerHTML,'');
});
