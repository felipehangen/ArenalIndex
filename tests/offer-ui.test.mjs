import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {mountOffer} from '../site/offer/app.mjs';
import {mountOffers} from '../site/cuenta/offers.mjs';
import {mountBrokerResources} from '../site/cuenta/resources.mjs';
import {blankSimpleOffer,simpleNotice,blankOffer} from '../site/offer/model.mjs';
import {proposalSummary,propertyStage} from '../site/offer/view.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const token='listing.'+'a'.repeat(64)+'.'+'b'.repeat(64),receiptToken='receipt.'+'c'.repeat(64)+'.'+'d'.repeat(64);
const record=()=>({property:{id:'lake-house',images:['/photos/lot.jpg','/photos/garden-volcano.jpg'],contact:{whatsapp:'50688887777'},name:'Lake <House>',titles:{en:'Lake <House>',es:'Casa del lago'},place:'La Fortuna',currency:'USD',price:180000,area:1000,image:'/photos/lot.jpg',isDemo:true},broker:'Broker <Arenal>',propertyVersion:'a'.repeat(64)});
function dom(path){
  const {document,window}=parseHTML(fs.readFileSync(new URL(path,import.meta.url),'utf8'));
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.value||this.querySelector('option')?.value||'';},set(v){for(const o of this.querySelectorAll('option')){if(o.value===v)o.setAttribute('selected','');else o.removeAttribute('selected');}}});
  window.ArenalI18n={language:'en',locale:'en-US',t:s=>s,photoText:s=>s};window.location={hash:'#'+token,assign(url){this.assigned=url;},reload(){this.reloaded=true;}};window.history={state:null,replaceState(a,b,url){this.state=structuredClone(a);if(url)window.location.hash=url;},pushState(a,b,url){this.state=structuredClone(a);if(url)window.location.hash=url;}};window.scrollY=0;window.scrollTo=({top})=>{window.scrollY=top;};
  vm.runInNewContext(fs.readFileSync(new URL('../site/offer/session.js',import.meta.url),'utf8'),{window});window.print=()=>{window.printed=true;};
  for(const file of ['property-content.js','photo-tour.js'])vm.runInNewContext(fs.readFileSync(new URL('../site/'+file,import.meta.url),'utf8'),{document,window,cancelAnimationFrame(){},requestAnimationFrame:fn=>{fn();return 0;}});
  return {document,window,$:s=>document.querySelector(s)};
}
async function buyer({stored,handler,blockedStorage=false,prepare=true,linkToken=token}={}){
  const e=dom('../site/offer/index.html'),calls=[],store=new Map(stored?[['arenalindex.simple-offer:'+token,JSON.stringify(stored)]]:[]);
  e.window.location.hash='#'+linkToken;
  const api=async(action,body)=>{calls.push({action,body});if(handler){const result=await handler(action,body);if(result)return result;}if(action==='offer_form_open')return record();if(action==='offer_form_submit')return {...record(),id:'c'.repeat(64),receiptURL:'https://arenalindex.com/offer/#'+receiptToken,revision:1,versions:[{revision:1,offer:body.offer,submittedAt:'2026-11-11T12:00:00Z',notice:simpleNotice.en}]};throw Error(action);};
  await mountOffer({...e,api,storage:{getItem:k=>store.get(k),setItem(k,v){if(blockedStorage)throw Error('Blocked');store.set(k,v);},removeItem:k=>store.delete(k)}}).ready;
  if(prepare&&e.$('[data-prepare]'))e.$('[data-prepare]').click();
  const choose=method=>{for(const radio of e.document.querySelectorAll('[name=replyMethod]'))radio.checked=radio.value===method;const radio=e.$('[name=replyMethod][value='+method+']');radio.dispatchEvent(new e.window.Event('change',{bubbles:true}));};
  const set=(name,value)=>{const el=e.$('[name="'+name+'"]');el.value=value;el.dispatchEvent(new e.window.Event('input',{bubbles:true}));};
  const submit=async()=>{e.$('#offer-form').dispatchEvent(new e.window.Event('submit',{bubbles:true,cancelable:true}));await tick();};
  return {...e,calls,store,set,submit,choose};
}
test('three short steps validate separately, retain edits and send only after explicit review',async()=>{
  const e=await buyer();assert.match(e.$('h1').textContent,/Your offer/);assert.deepEqual([...e.document.querySelectorAll('#offer-form [name]')].map(el=>el.name),['amount','currency','message']);assert.match(e.$('.offer-progress').textContent,/1 of 3/);
  await e.submit();assert.ok(e.$('[name=amount][aria-invalid=true]'));assert.equal(e.calls.length,1);
  e.set('amount','155000');e.set('message','Subject to a property inspection.');await e.submit();
  assert.equal(e.$('#offer-root').dataset.stage,'contact');assert.equal(e.$('[name=amount]'),null);assert.match(e.$('.offer-progress').textContent,/2 of 3/);
  await e.submit();assert.ok(e.$('[name=name][aria-invalid=true]'));assert.ok(e.$('#error-replyMethod'));assert.equal(e.calls.length,1);
  e.set('name','Buyer <Test>');e.choose('whatsapp');e.set('phone','8888 7777');await e.submit();
  assert.match(e.$('.proposal-paper').textContent,/155,000/);assert.match(e.$('.proposal-paper').textContent,/Subject to a property inspection/);assert.equal(e.calls.length,1);assert.equal(e.$('test'),null);assert.equal(e.$('[type=checkbox]'),null);assert.match(e.$('.offer-progress').textContent,/3 of 3/);
  e.$('[data-back]').click();e.$('[data-back]').click();assert.equal(e.$('[name=message]').value,'Subject to a property inspection.');e.set('amount','156000');await e.submit();assert.equal(e.$('[name=name]').value,'Buyer <Test>');await e.submit();await e.submit();
  const request=e.calls.find(c=>c.action==='offer_form_submit');assert.equal(request.body.offer.amount,'156000');assert.equal(request.body.offer.schema,2);assert.equal(request.body.offer.contact,'+50688887777');assert.equal('funding' in request.body.offer,false);assert.equal(request.body.confirmed,true);
  assert.match(e.$('.offer-success').textContent,/OFFER SENT/);assert.match(e.$('.offer-team-note').textContent,/We’re rooting for you/);assert.equal(e.store.size,0);assert.equal(e.window.location.hash,'#'+receiptToken);e.$('[data-print]').click();assert.equal(e.window.printed,true);
});
test('language switching and tab recovery retain each step and both sets of fields',async()=>{
  const e=await buyer();e.set('amount','120000');e.set('message','Pago al contado');e.window.ArenalI18n.language='es';e.window.dispatchEvent(new e.window.Event('arenal-language-change'));assert.equal(e.$('[name=amount]').value,'120000');assert.match(e.$('h1').textContent,/Tu oferta/);
  await e.submit();e.set('name','María');e.choose('email');e.set('email','buyer@example.test');
  const stored=JSON.parse([...e.store.values()][0]),f=await buyer({stored});assert.equal(f.$('#offer-root').dataset.stage,'contact');assert.equal(f.$('[name=name]').value,'María');assert.equal(f.$('[name=email]').value,'buyer@example.test');assert.equal(f.calls.length,1);
  f.$('[data-back]').click();assert.equal(f.$('[name=message]').value,'Pago al contado');assert.equal(f.$('[name=amount]').value,'120000');
});
test('lost send response keeps review editable and retries the same submission; blocked storage does not prevent sending',async()=>{
  let fail=true;const e=await buyer({blockedStorage:true,stored:{draft:{...blankSimpleOffer('USD'),amount:'100000',name:'Buyer',contact:'buyer@example.test'},submissionId:'c'.repeat(32)},handler:async action=>{if(action==='offer_form_submit'&&fail)throw Error('Connection interrupted');}});
  await e.submit();await e.submit();await e.submit();assert.match(e.$('.offer-error').textContent,/interrupted/);assert.ok(e.$('[data-back]'));assert.equal(e.$('[data-edit]'),null);fail=false;await e.submit();
  const sent=e.calls.filter(c=>c.action==='offer_form_submit');assert.equal(sent.length,2);assert.equal(sent[0].body.submissionId,sent[1].body.submissionId);assert.ok(e.$('.offer-success'));
});
test('summary escapes buyer text, leaves unspecified terms out and still renders historical full offers',()=>{
  const html=proposalSummary({...record(),language:'en',offer:{...blankSimpleOffer('CRC'),amount:'90000000',name:'<img src=x>',contact:'buyer@example.test',message:'<script>bad</script>'}}),{document}=parseHTML(html);
  assert.equal(document.querySelector('script'),null);assert.equal(document.querySelector('img'),null);assert.match(document.querySelector('article').textContent,/CRC/);assert.doesNotMatch(document.querySelector('article').textContent,/Funding|Deposit|Validity|Closing/);assert.match(html,/&lt;script&gt;/);
  assert.match(proposalSummary({...record(),language:'en',offer:{...blankOffer('USD'),amount:'100000',funding:'guidance'}}),/I need guidance/);
});
function account({handler,clipboard={writeText:async()=>{}},onUnauthorized}={}){
  const e=dom('../site/cuenta/index.html'),calls=[];
  // Native dialog and focus semantics are represented here; no layout/browser simulation.
  let active=e.document.body;
  Object.defineProperty(e.document,'activeElement',{get:()=>active});
  e.window.HTMLElement.prototype.focus=function(){active=this;};
  e.window.HTMLTextAreaElement.prototype.select=function(){this.selected=true;};
  const accountWindow=new Proxy(e.window,{get:(target,key)=>key==='navigator'?{clipboard}:Reflect.get(target,key)});
  const api={request:async(action,body)=>{calls.push({action,body});if(handler)return handler(action,body);if(action==='offers_list')return {records:[],cursor:null};return {...record(),url:'https://arenalindex.com/offer/#'+token};}};
  const controller=mountOffers({...e,window:accountWindow,api,onUnauthorized});mountBrokerResources(e);
  const dialog=e.$('.offer-share-dialog');
  Object.defineProperty(dialog,'open',{get(){return this.hasAttribute('open');}});
  dialog.showModal=function(){this.setAttribute('open','');this.usedNativeModal=true;};
  dialog.close=function(){this.removeAttribute('open');};
  dialog.getBoundingClientRect=()=>({left:10,right:450,top:10,bottom:400});
  controller.setListings([{id:'property-001',title:'Lake house',publishedVersion:1,publicId:'public-001'},{id:'property-002',title:'Garden house',publishedVersion:1,publicId:'public-002'}]);controller.setIdentity({email:'broker@example.test'});
  e.$('#admin-records').innerHTML='<button data-offer-invite="property-001">Offer form</button><button data-offer-invite="property-002">Offer form</button>';
  e.$('[data-owner-panel="listings"]').click();
  return {...e,dialog,calls,controller};
}
test('listing action opens Copy link / View form in a native popup and preserves the listing context; Offers is inbox only',async()=>{
  let copied;const e=account({clipboard:{writeText:async text=>{copied=text;}}}),button=e.$('[data-offer-invite]');
  e.$('#admin-search').value='Lake';button.focus();button.click();await tick();
  assert.equal(e.dialog.open,true);assert.equal(e.dialog.usedNativeModal,true);assert.equal(e.$('#offers-panel').hidden,true);assert.equal(e.$('#listings-panel').hidden,false);assert.equal(e.$('#admin-search').value,'Lake');
  assert.deepEqual(e.calls,[{action:'offer_form',body:{propertyId:'property-001'}}]);
  assert.equal(e.$('.offer-share-dialog [data-view-form]').getAttribute('href'),'https://arenalindex.com/offer/#'+token);assert.equal(e.$('[data-view-form]').target,'_blank');
  assert.equal(e.$('#offers-panel [data-new]'),null);assert.equal(e.$('#offers-panel [data-copy]'),null);assert.equal(e.$('[name=label]'),null);assert.equal(e.$('#offer-link-form'),null);
  e.$('.offer-share-dialog [data-copy]').click();await tick();assert.equal(copied,'https://arenalindex.com/offer/#'+token);assert.match(e.$('.offer-copy-status').textContent,/Ready to paste/);
  e.$('[data-share-close]').click();assert.equal(e.dialog.open,false);assert.equal(e.document.activeElement,button);assert.equal(e.$('#admin-search').value,'Lake');
  e.$('[data-owner-panel="offers"]').click();await tick();assert.equal(e.$('#offers-panel').hidden,false);assert.equal(e.$('#offers-panel [data-new]'),null);assert.match(e.$('.offer-empty').textContent,/My listings/);
});
test('popup retries link errors, supports manual copy, switches language and closes through Escape or the backdrop',async()=>{
  let fail=true;const e=account({handler:async()=>{if(fail)throw Error('Try later');return {...record(),url:'https://arenalindex.com/offer/#'+token};},clipboard:{writeText:async()=>{throw Error('Clipboard denied');}}});
  const button=e.$('[data-offer-invite]');button.click();await tick();assert.match(e.$('.offer-share-dialog [role=alert]').textContent,/Try later/);
  fail=false;e.$('[data-share-retry]').click();await tick();e.$('.offer-share-dialog [data-copy]').click();await tick();assert.equal(e.$('.offer-copy-area').hidden,false);assert.equal(e.$('#offer-share-url').selected,true);assert.equal(e.$('#offer-share-url').value,'https://arenalindex.com/offer/#'+token);
  e.window.ArenalI18n.language='es';e.window.dispatchEvent(new e.window.Event('arenal-language-change'));assert.match(e.$('#offer-share-title').textContent,/Formulario/);assert.equal(e.$('.offer-copy-area').hidden,false);assert.equal(e.document.activeElement,e.$('#offer-share-url'));
  const escape=new e.window.Event('cancel',{cancelable:true});e.dialog.dispatchEvent(escape);assert.equal(escape.defaultPrevented,true);assert.equal(e.dialog.open,false);assert.equal(e.document.activeElement,button);
  button.click();await tick();const inside=new e.window.Event('click');inside.clientX=20;inside.clientY=20;e.dialog.dispatchEvent(inside);assert.equal(e.dialog.open,true);
  const outside=new e.window.Event('click');outside.clientX=0;outside.clientY=0;e.dialog.dispatchEvent(outside);assert.equal(e.dialog.open,false);assert.equal(e.document.activeElement,button);
});
test('closing a loading popup and choosing another listing ignores earlier responses, and logout clears pending links',async()=>{
  const requests=[],e=account({handler:(action,body)=>new Promise(resolve=>requests.push({body,resolve}))});
  const [first,second]=e.document.querySelectorAll('[data-offer-invite]');
  first.click();assert.ok(e.$('.offer-share-loading'));e.$('[data-share-close]').click();assert.equal(e.dialog.open,false);
  second.click();requests[0].resolve({...record(),url:'https://arenalindex.com/old-link'});await tick();assert.equal(e.$('[data-view-form]'),null);assert.match(e.$('.offer-share-property').textContent,/Garden house/);
  requests[1].resolve({...record(),property:{...record().property,titles:{en:'Garden house'}},url:'https://arenalindex.com/new-link'});await tick();assert.equal(e.$('[data-view-form]').getAttribute('href'),'https://arenalindex.com/new-link');
  e.$('[data-share-close]').click();first.click();e.window.dispatchEvent(new e.window.Event('arenal-owner-clear'));requests[2].resolve({...record(),url:'https://arenalindex.com/private-link'});await tick();assert.equal(e.dialog.open,false);assert.equal(e.dialog.innerHTML,'');assert.equal(e.$('#offers-panel').innerHTML,'');
});
test('a delayed clipboard failure cannot repopulate a closed popup; session expiry closes the popup',async()=>{
  let rejectCopy;const e=account({clipboard:{writeText:()=>new Promise((resolve,reject)=>{rejectCopy=reject;})}});
  e.$('[data-offer-invite]').click();await tick();e.$('.offer-share-dialog [data-copy]').click();e.$('[data-share-close]').click();rejectCopy(Error('Denied'));await tick();assert.equal(e.dialog.innerHTML,'');
  let expired=false;const f=account({handler:async()=>{throw Object.assign(Error('Expired'),{status:401});},onUnauthorized:()=>{expired=true;}});
  f.$('[data-offer-invite]').click();await tick();assert.equal(expired,true);assert.equal(f.dialog.open,false);assert.equal(f.dialog.innerHTML,'');
});
test('logout also ignores an in-flight inbox refresh',async()=>{
  let resolve;const e=account({handler:()=>new Promise(done=>resolve=done)});
  e.$('[data-owner-panel="offers"]').click();e.window.dispatchEvent(new e.window.Event('arenal-owner-clear'));resolve({records:[],cursor:null});await tick();assert.equal(e.$('#offers-panel').innerHTML,'');
});
test('buyer property context survives review, missing imagery and language changes; comments have a visible field',async()=>{
  const e=await buyer();assert.ok(e.$('textarea[name=message]'));assert.match(e.$('.property-caption').textContent,/Lake <House>/);
  e.$('.property-scene img').dispatchEvent(new e.window.Event('error'));assert.equal(e.$('.property-scene img'),null);assert.match(e.$('.property-caption').textContent,/Lake <House>/);
  e.set('amount','120000');await e.submit();e.set('name','María');e.choose('email');e.set('email','buyer@example.test');await e.submit();assert.match(e.$('.property-caption').textContent,/Lake <House>/);assert.match(e.$('.proposal-paper').textContent,/Broker <Arenal>/);assert.match(e.$('.proposal-footnote').textContent,/not a contract or reservation/);
  e.window.ArenalI18n.language='es';e.window.dispatchEvent(new e.window.Event('arenal-language-change'));assert.match(e.$('.property-caption').textContent,/Casa del lago/);assert.match(e.$('[type=submit]').textContent,/Enviar a Broker/);assert.equal(e.calls.length,1);
  e.$('[data-back]').click();e.$('[data-back]').click();assert.equal(e.$('[name=amount]').value,'120000');
  const {document}=parseHTML(propertyStage({...record().property,name:'<script>x</script>',titles:{},images:['javascript:alert(1)'],image:'javascript:alert(1)'}));assert.equal(document.querySelector('script'),null);assert.equal(document.querySelector('img'),null);
});

test('welcome names the property and recipient; exploring or asking on WhatsApp never submits',async()=>{
  const e=await buyer({prepare:false});assert.equal(e.$('#offer-form'),null);assert.match(e.$('[data-prepare]').textContent,/Prepare my offer/);assert.match(e.$('.offer-broker').textContent,/Broker <Arenal>/);assert.match(e.$('.property-caption').textContent,/La Fortuna/);assert.match(e.$('.welcome-price').textContent,/180,000/);
  const whatsapp=new URL(e.$('.offer-questions a').href);assert.equal(whatsapp.hostname,'wa.me');assert.match(whatsapp.searchParams.get('text'),/Lake <House>/);assert.equal(e.$('[data-full-listing]').getAttribute('target'),null);
  e.$('[data-full-listing]').click();assert.equal(e.window.location.assigned,'/#propiedad/lake-house');assert.equal(e.calls.length,1);
  const context=e.window.ArenalOfferSession.create({storage:{getItem:k=>e.store.get(k)}}).returnFor('lake-house');assert.equal(context.hasDraft,false);
});
test('the selected reply channel is required; switching preserves draft entries but sends only the chosen contact',async()=>{
  const e=await buyer();e.set('amount','150000');await e.submit();e.set('name','Buyer');await e.submit();assert.ok(e.$('#error-replyMethod'));assert.equal(e.$('[name=email]'),null);assert.equal(e.$('[name=phone]'),null);
  e.choose('email');assert.equal(e.$('[name=email]').type,'email');assert.equal(e.$('[name=email]').getAttribute('inputmode'),'email');e.set('email','first@example.test');
  e.choose('whatsapp');assert.equal(e.$('[name=email]'),null);assert.equal(e.$('[name=phone]').type,'tel');e.set('phone','8888 7777');e.choose('email');assert.equal(e.$('[name=email]').value,'first@example.test');
  await e.submit();assert.match(e.$('.proposal-paper').textContent,/Email/);await e.submit();const offer=e.calls.find(c=>c.action==='offer_form_submit').body.offer;assert.equal(offer.contact,'first@example.test');assert.equal(offer.replyMethod,'email');assert.equal('phone' in offer,false);assert.equal('country' in offer,false);
});
test('Continue restores the current writing step and its internal scroll after welcome or reloading',async()=>{
  const e=await buyer();e.set('amount','225000');e.set('message','Comments preserved');e.$('.offer-step-fields').scrollTop=63;e.$('[data-back]').click();assert.match(e.$('[data-prepare]').textContent,/Continue my offer/);e.$('[data-prepare]').click();assert.equal(e.$('.offer-step-fields').scrollTop,63);assert.equal(e.$('[name=message]').value,'Comments preserved');
  await e.submit();e.choose('email');e.set('email','buyer@example.test');
  const saved=JSON.parse(e.store.get('arenalindex.simple-offer:'+token)),f=await buyer({stored:saved,prepare:false});assert.equal(f.$('#offer-root').dataset.stage,'contact');assert.equal(f.$('[name=email]').value,'buyer@example.test');assert.equal(f.calls.length,1);
});
test('offer photos use the listing photo tour, including overview, enlarge, swipe and two-stage Escape',async()=>{
  const e=await buyer({prepare:false});e.$('[data-photos]').click();const dialog=e.$('.pd-tour'),track=e.$('.pd-photo-track');assert.equal(dialog.hasAttribute('open'),true);assert.equal(track.querySelectorAll('img').length,2);assert.ok(e.$('.pd-tour-overview'));assert.equal(e.$('.pd-photo-view').hidden,true);
  Object.defineProperty(track,'clientWidth',{value:300});track.scrollTo=({left})=>{track.scrollLeft=left;track.dispatchEvent(new e.window.Event('scroll'));};
  e.$('[data-photo="0"]').click();assert.match(e.$('.pd-photo-position').textContent,/1 \/ 2/);e.$('[data-action=next]').click();assert.equal(track.scrollLeft,300);assert.match(e.$('.pd-photo-position').textContent,/2 \/ 2/);
  track.scrollLeft=0;track.dispatchEvent(new e.window.Event('scroll'));assert.match(e.$('.pd-photo-position').textContent,/1 \/ 2/);
  dialog.dispatchEvent(new e.window.Event('cancel',{cancelable:true}));assert.equal(dialog.hasAttribute('open'),true);assert.equal(e.$('.pd-photo-view').hidden,true);
  dialog.dispatchEvent(new e.window.Event('cancel',{cancelable:true}));assert.equal(e.$('.pd-tour'),null);assert.equal(e.calls.length,1);
  e.$('[data-prepare]').click();e.set('amount','210000');e.$('[data-back]').click();e.$('[data-photos]').click();e.$('[data-action=close-dialog]').click();e.$('[data-prepare]').click();assert.equal(e.$('[name=amount]').value,'210000');
});

test('the shared tour normalizes relative public photos and omits photos outside the published gallery',async()=>{
  const e=await buyer({prepare:false,handler:async action=>action==='offer_form_open'?{...record(),property:{...record().property,photoBuildingNames:['Casa principal'],photoGroups:[{title:'Construcciones · Casa principal',photos:[{src:'/photos/lot.jpg',caption:'Exterior · Casa principal'}]},{title:'PRIVATE',photos:[{src:'javascript:alert(1)',caption:'PRIVATE'},{src:'/private.jpg',caption:'PRIVATE'}]}]}}:null});
  e.$('[data-photos]').click();assert.equal(e.document.querySelectorAll('.pd-tour-block').length,1);assert.match(e.$('.pd-tour-block h3').textContent,/Casa principal/);assert.equal(e.$('.pd-tour-photo img').getAttribute('src'),'https://arenalindex.com/photos/lot.jpg');assert.doesNotMatch(e.$('.pd-tour').innerHTML,/PRIVATE|javascript:|private.jpg/);
});

test('short listing links open the form and restore their draft after browsing the full listing',async()=>{
  const linkToken='l.AbcdefghijklmnopqrstuQ',e=await buyer({linkToken});
  assert.equal(e.calls[0].action,'offer_form_open');assert.equal(e.calls[0].body.token,linkToken);
  e.set('amount','210000');await e.submit();e.set('name','Buyer');e.choose('email');e.set('email','buyer@example.test');
  e.$('[data-back]').click();e.$('[data-back]').click();e.$('[data-full-listing]').click();
  const session=e.window.ArenalOfferSession.create({storage:{getItem:k=>e.store.get(k)}}),context=session.returnFor('lake-house');
  assert.equal(context.href,'/offer/#'+linkToken);assert.equal(context.hasDraft,true);assert.equal(context.snapshot.draft.amount,'210000');
});
test('private copy opens in a separate tab and receipt links load a distinct printable saved offer',async()=>{
  const e=await buyer();e.set('amount','156000');await e.submit();e.set('name','Buyer');e.choose('email');e.set('email','buyer@example.test');await e.submit();await e.submit();
  const link=e.$('.receipt-link');assert.equal(link.getAttribute('target'),'_blank');assert.match(link.getAttribute('rel'),/noopener/);assert.match(link.textContent,/Open my private copy/);
  const linkToken=new URL(link.getAttribute('href')).hash.slice(1),offer=e.calls.find(c=>c.action==='offer_form_submit').body.offer;
  const f=await buyer({linkToken,handler:async(action,body)=>{
    assert.equal(action,'offer_receipt');assert.equal(body.token,receiptToken);
    return {...record(),receiptURL:link.href,versions:[{revision:1,offer,submittedAt:'2026-11-11T12:00:00Z',notice:simpleNotice.en}]};
  }});
  assert.equal(f.$('#offer-root').dataset.stage,'copy');assert.equal(f.$('h1').textContent,'Your private copy.');assert.equal(f.$('.offer-success'),null);assert.equal(f.$('.receipt-link'),null);assert.equal(f.$('#offer-form'),null);assert.match(f.$('.proposal-paper').textContent,/156,000/);assert.match(f.$('.proposal-paper').textContent,/buyer@example.test/);
  f.$('[data-print]').click();assert.equal(f.window.printed,true);assert.equal(f.calls.length,1);
  f.window.ArenalI18n.language='es';f.window.dispatchEvent(new f.window.Event('arenal-language-change'));assert.equal(f.$('h1').textContent,'Tu copia privada.');assert.match(f.$('[data-print]').textContent,/Guardar PDF/);
});
test('sending ends the flow with a compact confirmation and a complete print-only record',async()=>{
  const e=await buyer();e.set('amount','170000');e.set('message','Keep the exact submitted terms.');await e.submit();e.set('name','Demo buyer');e.choose('email');e.set('email','buyer@example.test');await e.submit();await e.submit();
  assert.equal(e.$('#offer-root').dataset.stage,'sent');assert.equal(e.$('h1').textContent,'Your offer is in!');assert.match(e.$('.offer-complete-done').textContent,/all done.*close this page/);assert.match(e.$('.offer-complete-record').textContent,/Lake <House>.*170,000/);
  assert.equal(e.$('.property-stage'),null);assert.equal(e.$('.offer-step-nav'),null);assert.equal(e.$('#offer-form'),null);assert.equal(e.$('[data-back]'),null);assert.equal(e.$('[data-edit]'),null);assert.equal(e.$('.offer-complete .proposal-paper'),null);
  assert.match(e.$('.offer-print-copy').textContent,/Keep the exact submitted terms/);assert.match(e.$('.proposal-document-title').textContent,/Purchase offer/);assert.match(e.$('.proposal-footnote').textContent,/Nov 11, 2026/);
  e.window.ArenalI18n.language='es';e.window.dispatchEvent(new e.window.Event('arenal-language-change'));assert.equal(e.$('h1').textContent,'¡Tu oferta ya llegó!');assert.match(e.$('.offer-complete-done').textContent,/Todo listo/);assert.match(e.$('.offer-print-copy').textContent,/Keep the exact submitted terms/);assert.match(e.$('.proposal-document-title').textContent,/Oferta de compra/);
});

test('unavailable private receipts show an error instead of an empty or editable offer',async()=>{
  const e=await buyer({linkToken:receiptToken,handler:async()=>{throw Error('This copy is no longer available.');}});
  assert.match(e.$('[role=alert]').textContent,/no longer available/);assert.equal(e.$('#offer-form'),null);assert.equal(e.$('[data-print]'),null);
});
test('Back is the only review navigation and keeps changes on the correct step',async()=>{
  const e=await buyer();e.set('amount','160000');await e.submit();e.set('name','Buyer');e.choose('email');e.set('email','buyer@example.test');await e.submit();
  assert.equal(e.$('[data-edit]'),null);assert.equal(e.$('[data-edit-contact]'),null);e.$('[data-back]').click();e.set('name','Updated buyer');await e.submit();assert.match(e.$('.proposal-paper').textContent,/Updated buyer/);assert.equal(e.calls.length,1);
  const event=new e.window.Event('popstate');event.state={arenalOffer:{token,snapshot:{screen:'contact'}}};e.window.dispatchEvent(event);assert.equal(e.$('#offer-root').dataset.stage,'contact');assert.equal(e.$('[name=name]').value,'Updated buyer');assert.equal(e.$('[name=email]').value,'buyer@example.test');
});
