import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {mountGuide} from '../site/publicar/app.mjs';
import {listingRules} from '../site/publicar/rules.mjs';
const read=file=>fs.readFileSync(new URL('../site/'+file,import.meta.url),'utf8');
function fixture({saved=[],blocked=false,query=''}={}){
  const {document,window}=parseHTML(read('publicar/index.html')),values=new Map([['arenalindex.publication-checklist.v1',JSON.stringify(saved)]]),copied=[];
  const storage={getItem:key=>{if(blocked)throw Error('blocked');return values.get(key);},setItem:(k,v)=>{if(blocked)throw Error('blocked');values.set(k,v);}};
  const navigator={language:'es',languages:['es'],clipboard:{async writeText(value){copied.push(value);}}};
  window.location={search:query};window.print=()=>{window.printed=true;};
  const context={window,document,navigator,localStorage:storage,NodeFilter:{SHOW_ELEMENT:1,SHOW_TEXT:4},CustomEvent:window.CustomEvent,MutationObserver:window.MutationObserver};
  for(const file of ['i18n-en.js','publicar/english.js','i18n.js','config.js'])vm.runInNewContext(read(file),context);
  mountGuide({document,window,navigator,storage});
  return {document,window,values,copied,navigator,$:s=>document.querySelector(s)};
}

test('the public guide contains the same six accepted rules without scripts and links to real local assets',()=>{
  const {document}=parseHTML(read('publicar/index.html'));
  for(const clause of listingRules.clauses){const card=document.querySelector('[data-rule='+clause.id+']');assert.equal(card.querySelector('h3').textContent,clause.es.title);assert.equal(card.querySelector('p').textContent,clause.es.body);}
  assert.equal(document.querySelector('meta[name=robots]'),null);
  for(const link of document.querySelectorAll('[src],link[href],a[href]')){
    const value=link.getAttribute('src')||link.getAttribute('href');
    if(value.startsWith('#'))assert.ok(document.getElementById(value.slice(1)),value);
    else if(value.startsWith('/')){const path=value.split('?')[0];assert.ok(fs.existsSync(new URL('../site'+path+(path.endsWith('/')?'index.html':''),import.meta.url)),value);}
  }
  for(const img of document.querySelectorAll('img')){assert.ok(img.getAttribute('alt'));assert.ok(img.getAttribute('width'));assert.ok(img.getAttribute('height'));}
  assert.equal(document.querySelector('a[href="/newlisting/"]'),null);
});

test('the guide translates every text label and illustration description; rules remain aligned in both languages',()=>{
  const e=fixture(),english=e.window.ArenalEnglish;
  const allowed=new Set(['ArenalIndex','arenal','INDEX','01','02','03','04','1','2','WhatsApp','↓','→','↗','←','·','· ArenalIndex']);
  const walker=e.document.createTreeWalker(e.document.body,5);let node;
  while(node=walker.nextNode()){
    if(node.nodeType!==3||node.parentElement.closest('script,style,[translate="no"],[data-no-translate]'))continue;
    const text=node.textContent.trim();if(!text||allowed.has(text)||/^[·\s\d.-]+$/.test(text))continue;
    assert.ok(english[text],text);
  }
  e.window.ArenalI18n.setLanguage('en');assert.match(e.$('h1').textContent,/A good listing/);assert.match(e.$('#standard-rules').textContent,/Authority to list/);
  for(const image of e.document.querySelectorAll('img'))assert.doesNotMatch(image.alt,/Ilustración|Esquema/);
  e.window.ArenalI18n.setLanguage('es');assert.match(e.$('#standard-rules').textContent,/Autorización para publicar/);
});

test('checklist progress persists without recording acceptance and language changes keep preparation intact',()=>{
  const e=fixture({saved:['plan']}),input=e.$('[value=photos]');assert.equal(e.$('[value=plan]').checked,true);
  input.checked=true;input.dispatchEvent(new e.window.Event('change'));assert.match(e.$('#ready-count').textContent,/2 de 6/);
  e.window.ArenalI18n.setLanguage('en');assert.match(e.$('#ready-count').textContent,/2 of 6/);assert.equal(input.checked,true);
  assert.deepEqual(JSON.parse(e.values.get('arenalindex.publication-checklist.v1')),['plan','photos']);
  for(const check of e.document.querySelectorAll('[data-ready]'))check.checked=true;
  input.dispatchEvent(new e.window.Event('change'));assert.match(e.$('#ready-message').textContent,/basics ready/);
  e.$('#reset-list').onclick();assert.match(e.$('#ready-count').textContent,/0 of 6/);assert.deepEqual(JSON.parse(e.values.get('arenalindex.publication-checklist.v1')),[]);
});

test('contact and sharing use the selected language, prepare messages only, and support clipboard denial',async()=>{
  const e=fixture({blocked:true,query:'?lang=en'});assert.equal(e.document.documentElement.lang,'en');
  assert.match(decodeURIComponent(e.$('#contact-whatsapp').href),/^https:\/\/wa.me\/50688542664\?text=Hello/);
  assert.match(decodeURIComponent(e.$('#contact-email').href),/Listing on ArenalIndex/);
  await e.$('#share-guide').onclick();assert.deepEqual(e.copied,['https://arenalindex.com/publicar/?lang=en']);
  let selected=false;e.$('#share-url').select=()=>selected=true;e.navigator.clipboard.writeText=async()=>{throw Error('denied');};
  await e.$('#share-guide').onclick();assert.equal(e.$('#share-url').hidden,false);assert.equal(selected,true);
  e.$('#print-guide').onclick();assert.equal(e.window.printed,true);
});
