import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
const read=name=>fs.readFileSync(new URL('../site/'+name,import.meta.url),'utf8');
function fixture(){
 const {window,document}=parseHTML(read('index.html'));
 const context={window,document,URL,NodeFilter:{SHOW_ELEMENT:1,SHOW_TEXT:4},navigator:{language:'es'},localStorage:{getItem(){return 'es';},setItem(){}},MutationObserver:window.MutationObserver,CustomEvent:window.CustomEvent};
 let focused=null;
 const proto=window.HTMLElement.prototype;
 proto.getClientRects=()=>[{}];proto.focus=function(){focused=this;};
 proto.showModal=function(){this.open=true;};proto.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'));};
 for(const file of ['config.js','i18n-en.js','i18n.js','site-contact.js'])vm.runInNewContext(read(file),context);
 return {document,window,get focused(){return focused;}};
}
test('Menu works before the catalog is available and opens a single contact dialog',()=>{
 const f=fixture(),d=f.document,menu=d.querySelector('#site-menu'),contact=d.querySelector('#site-contact'),trigger=d.querySelector('#nav-menu');
 assert.equal(trigger.closest('[inert]'),null);trigger.click();assert.equal(menu.open,true);
 assert.equal(menu.querySelector('a[href="/cuenta/"]').textContent,'Mis anuncios›');
 menu.querySelector('[data-contact-open]').click();assert.equal(menu.open,false);assert.equal(contact.open,true);
 contact.querySelector('[data-contact-close]').click();assert.equal(f.focused,trigger);
 d.querySelector('#nav-publish').click();assert.equal(contact.open,true);
 contact.querySelector('[data-contact-close]').click();assert.equal(f.focused,d.querySelector('#nav-publish'));
});
test('Menu language selection updates contact links and both selected language states in place',()=>{
 const f=fixture(),d=f.document,menu=d.querySelector('#site-menu');d.querySelector('#nav-menu').click();
 d.querySelector('#results-scroll').scrollTop=541;
 menu.querySelector('[data-menu-language="en"]').click();
 assert.equal(f.window.ArenalI18n.language,'en');assert.equal(menu.open,true);assert.equal(d.querySelector('#results-scroll').scrollTop,541);
 assert.equal(menu.querySelector('[data-menu-language="en"]').getAttribute('aria-pressed'),'true');
 assert.equal(menu.querySelector('[data-menu-language="es"]').getAttribute('aria-pressed'),'false');
 assert.equal(menu.querySelector('[data-contact-open]').textContent,'List your property›');
 for(const link of d.querySelectorAll('[data-contact-whatsapp]')){
  const url=new URL(link.getAttribute('href'));assert.equal(url.origin,'https://wa.me');assert.equal(url.pathname,'/50688542664');assert.match(url.searchParams.get('text'),link.closest('#site-menu')?/^Hi, I have a question/:/^Hi, I would like to list a property/);
 }
 for(const link of d.querySelectorAll('[data-contact-email]'))assert.match(decodeURIComponent(link.getAttribute('href')),link.closest('#site-menu')?/^mailto:equipo@arenalindex.com\?subject=ArenalIndex inquiry/:/^mailto:equipo@arenalindex.com\?subject=List a property/);
 for(const link of d.querySelectorAll('[data-contact-instagram]'))assert.equal(link.hidden,true);
 menu.querySelector('[data-menu-language="es"]').click();assert.equal(menu.querySelector('[data-contact-open]').textContent,'Publicar propiedad›');
});
test('the buyer links wait for the catalog, then use the existing navigation and close the menu',async()=>{
 const f=fixture(),d=f.document,menu=d.querySelector('#site-menu'),trigger=d.querySelector('#nav-menu'),calls=[];
 for(const [mode,id] of [['explore','nav-explore'],['saved','index-saved']])d.getElementById(id).addEventListener('click',()=>calls.push(mode));
 trigger.click();
 for(const button of menu.querySelectorAll('[data-browse-to]')){assert.equal(button.disabled,true);button.click();}
 assert.deepEqual(calls,[]);assert.equal(menu.open,true);
 d.getElementById('arenal-index-dos').dataset.catalog='ready';await new Promise(resolve=>setImmediate(resolve));
 for(const [mode,id] of [['saved','index-saved'],['explore','nav-explore']]){
  trigger.click();const button=menu.querySelector('[data-browse-to="'+mode+'"]');assert.equal(button.disabled,false);
  button.click();assert.equal(menu.open,false);assert.equal(calls.at(-1),mode);assert.equal(f.focused,d.getElementById(id));
 }
 d.getElementById('arenal-index-dos').dataset.catalog='error';await new Promise(resolve=>setImmediate(resolve));
 assert.equal(menu.querySelector('[data-browse-to]').disabled,true);
});
