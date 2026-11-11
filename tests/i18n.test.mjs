import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import * as M from '../site/newlisting/model.mjs';
import {renderFields,renderPhotoChecklist,renderPendingItems} from '../site/newlisting/view.mjs';
import {createDraftPreview} from '../site/newlisting/draft-preview.mjs';
import {buyerCopy} from '../site/newlisting/buyer-copy.mjs';
import {createPublication} from '../server/intake/publication.mjs';
import {approvedRow,editorial} from './publication-fixture.mjs';
import {supplementalDemos} from '../server/catalog/supplemental.mjs';
const read=file=>fs.readFileSync(new URL('../site/'+file,import.meta.url),'utf8');
function languageFixture({preferred='en-US',stored=null,html='',blocked=false}={}){
  const {window,document}=parseHTML('<!doctype html><html lang="es"><head></head><body>'+html+'</body></html>');
  const storage=new Map(stored?[['arenalindex.language',stored]]:[]);
  const context={window,document,navigator:{language:preferred,languages:[preferred]},localStorage:{getItem:key=>{if(blocked)throw Error('blocked');return storage.get(key);},setItem:(k,v)=>storage.set(k,v)},NodeFilter:{SHOW_ELEMENT:1,SHOW_TEXT:4},CustomEvent:window.CustomEvent,MutationObserver:window.MutationObserver};
  for(const name of ['i18n-en.js','demo-translations.js','i18n.js','catalog.js','property-content.js'])vm.runInNewContext(read(name),context);
  return {window,document,i18n:window.ArenalI18n,storage};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

async function detailFixture(row,offerSession=null){
  const fixture=languageFixture({preferred:'es',html:'<div id="arenal-index-dos"><div id="index-home"></div></div>'});
  const {window,document}=fixture,item=window.ArenalData.normalize(row);
  let focused=null;
  Object.defineProperty(document,'activeElement',{get:()=>focused});
  const proto=window.HTMLElement.prototype;
  proto.focus=function(){focused=this;};
  proto.showModal=function(){this.open=true;};
  proto.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'));};
  proto.scrollTo=function({left,top}){if(left!==undefined)this.scrollLeft=left;if(top!==undefined)this.scrollTop=top;this.dispatchEvent(new window.Event('scroll'));};
  const listeners=new Set(),add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window);
  window.addEventListener=(type,fn,...args)=>{if(type==='arenal-language-change')listeners.add(fn);add(type,fn,...args);};
  window.removeEventListener=(type,fn,...args)=>{if(type==='arenal-language-change')listeners.delete(fn);remove(type,fn,...args);};
  window.ArenalOfferSession=offerSession?{create:()=>offerSession}:undefined;
  window.arenalDemo={items:[item],state:{saved:[],filters:{currency:'USD'}}};
  const context={window,document,location:{hash:'#propiedad/'+item.id},ArenalMotion:{cancel(){},leave(node,done){done();}},IntersectionObserver:class{observe(){}disconnect(){}},ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:()=>1,cancelAnimationFrame(){},matchMedia:()=>({matches:true})};
  vm.runInNewContext(read('ui-format.js'),context);
  await vm.runInNewContext(read('property-detail.js'),context);
  const openGallery=()=>{document.querySelector('[data-action="photos"]').click();return document.querySelector('.pd-tour');};
  return {...fixture,item,listeners,openGallery};
}

test('an open gallery switches headings, captions and accessible names without losing photo, scroll or focus',async()=>{
  const {document,i18n,listeners,openGallery}=await detailFixture(supplementalDemos.find(d=>d.id==='lot-129'));
  const baseline=listeners.size,node=openGallery(),scroller=node.querySelector('.pd-tour-scroll');
  const track=node.querySelector('.pd-photo-track'),images=[...node.querySelectorAll('img')];
  Object.defineProperty(track,'clientWidth',{value:400});
  scroller.scrollTop=265;
  const link=node.querySelectorAll('.pd-tour-link')[1];link.focus();
  i18n.setLanguage('en');
  for(const image of document.querySelectorAll('.pd-hero img'))assert.equal((image.alt.match(/illustrative image/gi)||[]).length,1);
  assert.equal(node.querySelector('h3').textContent,'Approach road · reference photos');
  assert.equal(node.querySelector('.pd-tour-link [translate="no"]').textContent,'Approach road · reference photos');
  assert.equal(scroller.scrollTop,265);assert.equal(document.activeElement,link);
  const trigger=node.querySelector('[data-photo="1"]');trigger.click();
  const returnButton=node.querySelector('.pd-tour-return');
  assert.equal(document.activeElement,returnButton);
  assert.equal(node.querySelector('.pd-photo-position').textContent,'2 / 3');
  for(const language of ['es','en','es','en']){
    i18n.setLanguage(language);await flush();
    const english=language==='en';
    assert.equal(document.querySelector('.pd-tour'),node);
    assert.deepEqual([...node.querySelectorAll('img')],images);
    assert.equal(node.querySelector('.pd-photo-view').hidden,false);
    assert.equal(node.querySelector('.pd-photo-position').textContent,'2 / 3');
    assert.equal(track.scrollLeft,400);assert.equal(scroller.scrollTop,265);assert.equal(document.activeElement,returnButton);
    assert.match(node.querySelector('.pd-photo-caption').textContent,english?/^Illustrative image/:/^Imagen ilustrativa/);
    assert.equal(node.querySelector('.pd-photo-caption').textContent,track.children[1].querySelector('img').alt);
    for(const button of node.querySelectorAll('[data-photo]')){
      assert.match(button.getAttribute('aria-label'),english?/^Enlarge: .*, photo \d$/:/^Ampliar: .*, foto \d$/);
      assert.equal((button.querySelector('img').alt.match(english?/illustrative image/gi:/imagen ilustrativa/gi)||[]).length,1);
    }
    assert.equal(node.querySelector('.pd-tour-heading span').textContent,english?'1 photo':'1 foto');
  }
  returnButton.click();assert.equal(node.querySelector('.pd-photo-view').hidden,true);assert.equal(scroller.scrollTop,265);assert.equal(document.activeElement,trigger);
  for(let i=0;i<3;i++){
    const gallery=document.querySelector('.pd-tour'),caption=gallery.querySelector('.pd-photo-caption').textContent;
    gallery.close();assert.equal(listeners.size,baseline);
    i18n.setLanguage(i18n.language==='en'?'es':'en');
    assert.equal(gallery.querySelector('.pd-photo-caption').textContent,caption,'closed galleries must stop responding');
    openGallery();assert.equal(listeners.size,baseline+1);
  }
  document.querySelector('.pd-tour').close();
});

test('gallery language refresh preserves literal building names and source listing data',async()=>{
  const row=createPublication(approvedRow(),editorial,{apiURL:'https://api.example/api/listings'}).listing;
  const {document,i18n,item,openGallery}=await detailFixture(row),before=JSON.stringify(item),node=openGallery();
  const block=[...node.querySelectorAll('.pd-tour-block')].find(b=>b.querySelector('h3').textContent.includes('Casa principal'));
  assert.ok(block);block.querySelector('[data-photo]').click();
  for(const language of ['en','es','en']){
    i18n.setLanguage(language);await flush();
    assert.match(block.querySelector('h3').textContent,/Casa principal/);
    assert.match(node.querySelector('.pd-photo-caption').textContent,/Casa principal/);
    assert.match(block.querySelector('img').alt,/Casa principal/);
    assert.doesNotMatch(node.textContent,/Main house/);
    assert.equal(JSON.stringify(item),before);
  }
  node.close();
});

test('galleries without photo groups translate generated labels and fallback captions on every switch',async()=>{
  const row={...supplementalDemos[0],is_demo:false,details:null};
  const {i18n,openGallery}=await detailFixture(row),node=openGallery();
  node.querySelector('[data-photo="0"]').click();
  for(const language of ['en','es','en']){
    i18n.setLanguage(language);await flush();
    const title=language==='en'?'Property photos':'Fotografías de la propiedad';
    assert.equal(node.querySelector('h3').textContent,title);
    assert.match(node.querySelector('.pd-photo-caption').textContent,language==='en'?/^Property photos · Photo 1 of /:/^Fotografías de la propiedad · Foto 1 de /);
    assert.equal(node.querySelector('.pd-tour-photo img').alt,language==='en'?'Photo 1':'Foto 1');
  }
  node.close();
});

test('the new photo demo translates its title, disclosure, facts and gallery in both languages',()=>{
  const {window,document,i18n}=languageFixture(),item=window.ArenalData.normalize(supplementalDemos[0]);
  assert.equal(i18n.listingText(item),'Tropical garden home · demo');
  assert.match(i18n.listingText(item,'description'),/not a property offered for sale/);
  const groups=window.ArenalListing.groups(item);
  assert.equal(groups[0].label,'Garden · reference photos');
  assert.equal(groups[2].images[0].caption,'Illustrative image · Pool · Orphic Clicks / Pexels');
  document.body.innerHTML=window.ArenalListing.content(item);i18n.translate(document);
  assert.match(document.body.textContent,/Fictional demo listing\. Not an offer for sale\./);
  assert.match(document.body.textContent,/Fictional demo information/);
  i18n.setLanguage('es');assert.equal(i18n.listingText(item),'Casa entre jardines tropicales · demo');
  assert.equal(window.ArenalListing.groups(item)[0].label,'Jardín · imágenes de referencia');
});

test('all curated showcases retain their reviewed English titles and translated photo labels',()=>{
  const {window,i18n}=languageFixture();
  for(const row of supplementalDemos.slice(1)){
    const item=window.ArenalData.normalize(row);
    i18n.setLanguage('en');assert.equal(i18n.listingText(item),row.details.translations.en.title);
    assert.match(i18n.listingText(item,'description'),/Not an offer for sale/);
    for(const group of window.ArenalListing.groups(item)){
      assert.match(group.label,/reference photos/);
      for(const photo of group.images){assert.match(photo.caption,/Illustrative image/);assert.doesNotMatch(photo.caption,/Vista general|Vista al lago|Bosque|Río|Jardín|Habitación|Palmeras|Cultivos|Potrero|Atardecer|Sendero|Cascada/);}
    }
    i18n.setLanguage('es');assert.equal(i18n.listingText(item),row.name);
  }
});

test('language uses a saved choice before browser preference and persists an explicit choice of the initial language',()=>{
  for(const [options,expected] of [[{preferred:'en-GB'},'en'],[{preferred:'es-CR'},'es'],[{preferred:'fr-FR'},'es'],[{preferred:'en-US',stored:'es'},'es'],[{preferred:'es',stored:'en'},'en'],[{preferred:'en',blocked:true},'en']]){
    const {i18n,document}=languageFixture(options);assert.equal(i18n.language,expected);assert.equal(document.documentElement.lang,expected);
  }
  const {i18n,storage}=languageFixture();i18n.setLanguage('en');assert.equal(storage.get('arenalindex.language'),'en');i18n.setLanguage('fr');assert.equal(i18n.language,'en');
});

test('switching languages reverses text and labels in place while preserving form values, selections, details and scroll',()=>{
  const {i18n,document}=languageFixture({preferred:'es',html:'<button id="filters" title="Filtros">Filtros</button><details open><summary>Agregar detalles</summary><input id="name" value="Agua" placeholder="Opcional"><textarea>Casa principal</textarea><select><option value="">Elegí una respuesta</option><option value="unknown" selected>No confirmado</option></select><input type="checkbox" checked></details><p translate="no" title="Terreno">Casa principal</p><div id="scroll"></div><span data-language-mount></span>'});
  const input=document.querySelector('#name'),select=document.querySelector('select'),details=document.querySelector('details'),scroll=document.querySelector('#scroll'),check=document.querySelector('[type=checkbox]');
  check.checked=true;scroll.scrollTop=173;input.value='Agua editada';const before=select.value;
  for(const next of ['en','es','en']){i18n.setLanguage(next);assert.equal(document.querySelector('#name'),input);assert.equal(input.value,'Agua editada');assert.equal(select.value,before);assert.equal(check.checked,true);assert.ok(details.hasAttribute('open'));assert.equal(scroll.scrollTop,173);assert.equal(document.querySelector('textarea').value,'Casa principal');assert.equal(document.querySelector('p').textContent,'Casa principal');assert.equal(document.querySelector('p').title,'Terreno');}
  assert.equal(document.querySelector('#filters').textContent,'Filters');assert.equal(document.querySelector('#filters').title,'Filters');assert.equal(input.placeholder,'Optional');assert.equal(select.selectedOptions?.[0]?.textContent||select.querySelector('[selected]').textContent,'Not confirmed');
  i18n.setLanguage('es');assert.equal(document.querySelector('#filters').textContent,'Filtros');assert.equal(input.placeholder,'Opcional');assert.equal(document.querySelector('[data-language-label]').textContent,'ES');
});

test('new UI and changed status text translate through the observer and remain reversible',async()=>{
  const {document,i18n}=languageFixture();const status=document.createElement('p');status.textContent='Mostrando 20 de 100';document.body.append(status);await flush();assert.equal(status.textContent,'Showing 20 of 100');
  status.textContent='Mostrando 40 de 100';await flush();assert.equal(status.textContent,'Showing 40 of 100');i18n.setLanguage('es');assert.equal(status.textContent,'Mostrando 40 de 100');
  status.setAttribute('aria-label','Guardar: Casa principal');await flush();i18n.setLanguage('en');assert.equal(status.getAttribute('aria-label'),'Save: Casa principal');
});

test('dynamic copy translates complete phrases without translating captured owner names',()=>{
  const {i18n}=languageFixture();
  assert.equal(i18n.text('Foto exterior: Casa principal'),'Exterior photo: Casa principal');
  assert.equal(i18n.text('Vista 2 de 4 · imagen ilustrativa'),'View 2 of 4 · illustrative image');
  assert.equal(i18n.text('1 foto de muestra · imágenes ilustrativas'),'1 sample photo · illustrative images');
  assert.equal(i18n.text('1 foto'),'1 photo');
  assert.equal(i18n.text('3 fotos'),'3 photos');
  assert.equal(i18n.text('1 · La propiedad ✓'),'1 · The property ✓');
  assert.equal(i18n.text('Versión 3. Aprobada para preparar la publicación.'),'Version 3. Approved for publication preparation.');
  assert.equal(i18n.text('Agua de red: Conexión activa · Electricidad: Medidor activo'),'Mains/community water: Active connection · Electricity: Active meter');
});

test('map zoom names translate reversibly from their configured Spanish source',()=>{
  const {document,i18n}=languageFixture({preferred:'es',html:'<button title="Acercar" aria-label="Acercar"></button><button title="Alejar" aria-label="Alejar"></button>'});
  for(const lang of ['en','es','en']){
    i18n.setLanguage(lang);
    const expected=lang==='en'?['Zoom in','Zoom out']:['Acercar','Alejar'];
    [...document.querySelectorAll('button')].forEach((button,i)=>{assert.equal(button.title,expected[i]);assert.equal(button.getAttribute('aria-label'),expected[i]);});
  }
});

test('all modeled form labels, help and options and every photo requirement have reviewed English copy',()=>{
  const {i18n}=languageFixture();const unchanged=new Set(['Español','English','No','Internet','Cable','Exterior','Interior','Kölbi','Claro','Liberty','4G','5G']);
  const check=text=>{if(text&&!unchanged.has(text))assert.notEqual(i18n.text(text),text,text);};
  for(const step of [...M.steps,...M.photoGroups,...M.documentGroups]){for(const key of ['short','title','lead','help'])check(step[key]);for(const f of step.fields||[])for(const key of ['label','placeholder','help']){if(key!=='placeholder'||!f.inputLanguage)check(f[key]);}}
  for(const f of [...M.steps.flatMap(s=>s.fields),...M.buildingFields,...M.inspectionItems]){for(const key of ['label','help','placeholder']){if(key!=='placeholder'||!f.inputLanguage)check(f[key]);}for(const [,label] of f.options||[])check(label);}
  Object.values(M.STATES).forEach(check);M.inspectionStates.forEach(([,label])=>check(label));
  const draft=M.newDraft();draft.values.buildings='yes';draft.buildings=[{id:'one',name:'Casa principal'}];for(const item of M.photoRequirements(draft)){check(item.label);check(item.detail);}
});

test('original titles remain the fallback and optional reviewed translations are bounded and deliberate',()=>{
  const {window,i18n}=languageFixture();const row=approvedRow(),options={apiURL:'https://api.example/api/listings'};
  row.payload.values.listing_language='en';row.payload.values.listing_title_translation='Unreviewed suggestion';
  const original=createPublication(row,{...editorial,title:'Garden home',language:'en'},options).listing;
  i18n.setLanguage('es');assert.equal(i18n.listingText(window.ArenalData.normalize(original)),'Garden home');assert.ok(!JSON.stringify(original).includes('Unreviewed suggestion'));
  const translated=createPublication(row,{...editorial,title:'Garden home',description:'Original introduction',language:'en',titleTranslation:'Casa entre jardines',descriptionTranslation:'Introducción revisada'},options).listing;
  const item=window.ArenalData.normalize(translated);assert.equal(i18n.listingText(item),'Casa entre jardines');assert.equal(i18n.listingText(item,'description'),'Introducción revisada');i18n.setLanguage('en');assert.equal(i18n.listingText(item),'Garden home');assert.equal(i18n.listingText(item,'description'),'Original introduction');
  for(const titleTranslation of ['x'.repeat(46),'ALL CAPS','Garden 🌿','Title\nline'])assert.throws(()=>createPublication(row,{...editorial,titleTranslation},options));
  assert.throws(()=>createPublication(row,{...editorial,language:'fr'},options));
  const preview=createDraftPreview(row.payload,()=>'/photos/lot.jpg');assert.equal(preview.details.language,'en');assert.equal(preview.details.translations.es.title,'Unreviewed suggestion');
});

test('normalization exposes only allowed translations and protects owner-written facts in the detail',()=>{
  const {window,document,i18n}=languageFixture();const listing=createPublication(approvedRow(),editorial,{apiURL:'https://api.example/listings'}).listing;
  listing.details.translations={en:{title:'<img onerror=bad()>',privateToken:'SECRET',description:'Reviewed intro'},fr:{title:'HIDDEN'}};
  listing.details.sections[0].rows.push({label:'Indicaciones para llegar',value:'Casa principal',source:'Información del vendedor',literal:true});listing.details.conditions=['Agua'];listing.details.buildings[0].name='Casa principal';
  const item=window.ArenalData.normalize(listing);assert.doesNotMatch(JSON.stringify(item.details),/SECRET|HIDDEN/);
  document.body.innerHTML=window.ArenalListing.content(item);i18n.translate(document);
  assert.ok([...document.querySelectorAll('[translate=no]')].some(n=>n.textContent==='Casa principal'));assert.ok([...document.querySelectorAll('li')].some(n=>n.textContent==='Agua'));assert.match(document.body.textContent,/Seller-provided information/);
  assert.equal(i18n.listingText(item),'<img onerror=bad()>');
});

test('every demo has a reviewed English title within 45 characters and keeps currency, prices, coordinates and structured facts unchanged',()=>{
  const {window,i18n}=languageFixture();const rows=JSON.parse(fs.readFileSync(new URL('../supabase/demo-properties-v2.json',import.meta.url),'utf8'));
  for(const row of rows){const item=window.ArenalData.normalize(row),before=JSON.stringify(item);const title=i18n.listingText(item);assert.notEqual(title,item.name,row.id);assert.ok([...title].length<=45);assert.notEqual(i18n.listingText(item,'description'),item.description);i18n.setLanguage('es');assert.equal(i18n.listingText(item),item.name);i18n.setLanguage('en');assert.equal(JSON.stringify(item),before);}
});

test('English prepared copy preserves literal owner notes, canonical draft values and private-field exclusion',()=>{
  const {window}=languageFixture();globalThis.window=window;
  try{const draft=approvedRow().payload;draft.values.listing_language='en';draft.values.listing_title='Garden home';draft.values.land_notes='Agua';draft.values.name='PRIVATE REFERENCE';draft.values.contact='PRIVATE CONTACT';draft.values.email='private@example.com';draft.values.water_provider='Casa principal';
    const before=JSON.stringify(draft),copy=buyerCopy(draft,{},'en');assert.match(copy,/Garden home/);assert.match(copy,/Casa principal/);assert.match(copy,/• Agua/);assert.match(copy,/m²/);assert.doesNotMatch(copy,/PRIVATE REFERENCE|PRIVATE CONTACT|private@example.com/);assert.equal(JSON.stringify(draft),before);
  }finally{delete globalThis.window;}
});

test('the language assets exist on each entry page and form controls retain canonical option values',()=>{
  const {window,document,i18n}=languageFixture();
  for(const file of ['index.html','newlisting/index.html','newlisting/review/index.html','newlisting/preview/index.html']){const {document:page}=parseHTML(read(file));for(const script of ['i18n-en.js','i18n.js','demo-translations.js'])assert.equal([...page.querySelectorAll('script[src]')].filter(s=>s.getAttribute('src').startsWith('/'+script+'?')).length,1,file+' '+script);}
  const draft=M.newDraft();document.body.innerHTML=renderFields(M.steps[2].fields,{terrain:'Mayormente plano',road:'Lastre'})+renderPhotoChecklist(draft)+renderPendingItems(M.pending(draft));i18n.translate(document);
  assert.equal(document.querySelector('[data-key=terrain]').value,'Mayormente plano');assert.match(document.body.textContent,/Mostly flat/);assert.match(document.body.textContent,/Two photos of the land/);
});

test('the real home controller keeps applied currency, saved state, pending filter edits and list position across a language switch',async()=>{
  const html=read('index.html'),{window,document,i18n}=languageFixture({html:parseHTML(html).document.body.innerHTML});
  const items=JSON.parse(fs.readFileSync(new URL('../supabase/demo-properties-v2.json',import.meta.url),'utf8')).map(window.ArenalData.normalize);
  const events=[],loading={catalogReady(){events.push('ready');},catalogFailed(){events.push('failed');},mapStarted(){},mapFailed(){}};
  window.scrollTo=()=>{};
  const proto=window.HTMLElement.prototype;proto.scrollTo=function({top=0,left=0}={}){this.scrollTop=top;this.scrollLeft=left;};
  proto.getClientRects=()=>[{}];proto.showModal=function(){this.open=true;};proto.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'));};
  window.HTMLSelectElement.prototype.add=function(option){this.append(option);};
  const selectValue=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value');
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get:selectValue.get,set(value){for(const option of this.options)option.selected=false;[...this.options].find(option=>option.value===String(value))?.setAttribute('selected','');}});
  const context={window,document,location:{hash:'',pathname:'/'},localStorage:{getItem:()=>null,setItem(){}},console:{error(){}},requestAnimationFrame:()=>1,ResizeObserver:class{observe(){}},matchMedia:()=>({matches:true,addEventListener(){}}),ArenalData:{load:async()=>items},ArenalHomeLoading:loading,ArenalMotion:{cancel(){},leave(node,done){done();}},ArenalResultsScroll:()=>({setListOnly(){},resetList(){},capturePosition(){return {};},restorePosition(){},setExpanded(){},collapsedHeight:250}),Option:function(label,value){const n=document.createElement('option');n.textContent=label;n.value=value;return n;},setTimeout,clearTimeout};
  for(const file of ['ui-format.js','exchange-rate.js','pricing.js','listing-sort.js','sort-picker.js','filter-overflow.js'])vm.runInNewContext(read(file),context);
  context.ArenalFilterOverflow=window.ArenalFilterOverflow;context.ArenalPricing=window.ArenalPricing;context.ArenalListing=window.ArenalListing;
  vm.runInNewContext(html.match(/<script>\s*(window\.arenalReady=[\s\S]*?)<\/script>/)[1],context);
  document.dispatchEvent(new window.Event('DOMContentLoaded'));await window.arenalReady;await flush();assert.deepEqual(events,['ready']);
  const checkPriceLabels=(currency,language='en')=>{
    for(const key of ['price','unit'])document.querySelectorAll('[data-range="'+key+'"] .range-amount').forEach((input,i)=>{
      assert.equal(input.getAttribute('aria-label'),language==='en'?(i?'Maximum':'Minimum')+' '+(key==='price'?'total price':'price per m²')+' in '+currency:(i?'Máximo':'Mínimo')+' de '+(key==='price'?'precio total':'precio por m²')+' en '+currency);
    });
  };
  checkPriceLabels('USD');
  for(const language of ['en','es','en']){
    i18n.setLanguage(language);
    checkPriceLabels('USD',language);
    const area=document.querySelector('[data-range="area"]');
    assert.equal(area.querySelector('input[type=range]').getAttribute('aria-label'),language==='en'?'Minimum land area':'Mínimo de área del terreno');
    assert.equal(area.querySelector('.range-amount').getAttribute('aria-label'),language==='en'?'Minimum land area in m²':'Mínimo de área del terreno en m²');
    assert.equal(area.querySelector('svg').getAttribute('aria-label'),language==='en'?'Land area distribution across 100 listings':'Distribución de área del terreno en 100 anuncios');
  }
  document.querySelector('#index-saved').onclick();await flush();
  assert.match(document.querySelector('#results-empty').textContent,/no saved properties yet/);
  document.querySelector('#nav-explore').onclick();
  const first=document.querySelector('.listing-title-link');assert.equal(first.textContent,window.ArenalI18n.listingText(window.arenalDemo.results[0]));
  const sort=document.querySelector('#index-sort');
  const setSort=value=>{sort.click();document.querySelector('[data-sort-mode="'+value+'"]').click();};
  const listed=()=>[...document.querySelectorAll('#index-list .listing-card')].map(card=>card.dataset.id);
  const initial=window.arenalDemo.results.map(d=>d.id),initialFilters=JSON.stringify(window.arenalDemo.state.filters);
  setSort('price-asc');assert.equal(window.arenalDemo.state.sort,'price-asc');
  const sorted=window.arenalDemo.results;
  assert.ok(sorted.every((d,i)=>i===0||window.arenalDemo.pricing.view(sorted[i-1],'USD').price<=window.arenalDemo.pricing.view(d,'USD').price));
  assert.deepEqual(listed(),Array.from(sorted.slice(0,20),d=>d.id));
  document.querySelector('#results-more').onclick();assert.deepEqual(listed(),Array.from(sorted.slice(0,40),d=>d.id));
  assert.equal(new Set(listed()).size,40);assert.equal(JSON.stringify(window.arenalDemo.state.filters),initialFilters);
  document.querySelector('[data-quick="water"]').onclick();assert.equal(window.arenalDemo.state.sort,'price-asc');
  assert.deepEqual(Array.from(window.arenalDemo.results,d=>d.id),Array.from(sorted.filter(d=>d.water),d=>d.id));
  document.querySelector('[data-quick="water"]').onclick();
  setSort('explore');assert.deepEqual(window.arenalDemo.results.map(d=>d.id),initial);
  setSort('price-asc');
  const currency=document.querySelector('#index-currency');
  // Open via the actual filter handler, then apply CRC.
  document.querySelector('.filter-toggle').onclick({currentTarget:document.querySelector('.filter-toggle')});
  for(const key of ['price','unit']){
    const slider=document.querySelector('[data-range="'+key+'"] input[type=range]');
    slider.value=key==='price'?'5000':'1';slider.oninput();checkPriceLabels('USD');
    slider.value='0';slider.oninput();checkPriceLabels('USD');
  }
  const priceMax=document.querySelector('[data-range=price] .range-amount[data-bound="1"]');
  const unitMax=document.querySelector('[data-range=unit] .range-amount[data-bound="1"]');
  priceMax.value='205000';priceMax.oninput();unitMax.value='53';unitMax.oninput();
  const budget={...window.arenalDemo.state.filters,price:[0,205000],unit:[0,53]};
  const expectedMembers=sorted.filter(item=>window.arenalDemo.pricing.matchesPrice(item,budget)).map(d=>d.id);
  for(const target of ['CRC','USD','CRC']){
    currency.value=target;currency.onchange({target:currency});
    for(const [key,amount] of [['price',205000],['unit',53]]){
      const slider=document.querySelector('[data-range="'+key+'"] input[type=range][data-bound="1"]');
      const expected=window.arenalDemo.pricing.convert(amount,'USD',target);
      assert.ok(Math.abs(Number(slider.value)-expected)<1e-7);
      // Native range inputs sanitize off-step values; converted bounds must be representable.
      assert.ok(slider.step==='any'||Math.abs((expected-Number(slider.min))/Number(slider.step)-Math.round((expected-Number(slider.min))/Number(slider.step)))<1e-9);
      assert.equal(slider.getAttribute('aria-valuetext'),window.ArenalFormat.money(expected,target)+' '+target+(key==='unit'?'/m²':''));
    }
  }
  const priceSlider=document.querySelector('[data-range=price] input[type=range][data-bound="1"]'),converted=Number(priceSlider.value);
  let prevented=false;priceSlider.onkeydown({key:'ArrowRight',preventDefault(){prevented=true;}});
  assert.ok(prevented);assert.equal(Number(priceSlider.value),Math.round(converted+1000000));
  priceMax.value=String(converted);priceMax.oninput();
  document.querySelector('#index-apply').onclick();
  assert.deepEqual(window.arenalDemo.results.map(d=>d.id),expectedMembers);
  document.querySelector('.filter-toggle').onclick({currentTarget:document.querySelector('.filter-toggle')});
  document.querySelector('#index-clear').onclick();
  currency.value='CRC';currency.onchange({target:currency});checkPriceLabels('CRC');document.querySelector('#index-apply').onclick();
  assert.deepEqual(Array.from(window.arenalDemo.results,d=>d.id),Array.from(sorted,d=>d.id));
  assert.equal(document.querySelector('#index-saved-count').hidden,true);
  window.arenalDemo.toggleSaved(items[0].id);document.querySelector('#index-saved').onclick();
  assert.equal(document.querySelector('#index-saved-count').hidden,false);
  assert.ok(document.querySelector('#arenal-index-dos').classList.contains('saved-view'));
  assert.equal(sort.value,'price-asc');
  const scroll=document.querySelector('#results-scroll');scroll.scrollTop=541;
  document.querySelector('.filter-toggle').onclick({currentTarget:document.querySelector('.filter-toggle')});
  const min=document.querySelector('[data-range=price] .range-amount');min.value='12345';min.dispatchEvent(new window.Event('input',{bubbles:true}));
  const draftMin=min.value;
  const before=JSON.stringify(window.arenalDemo.state),resultIDs=window.arenalDemo.results.map(d=>d.id);
  i18n.setLanguage('es');await flush();
  checkPriceLabels('CRC','es');
  assert.equal(JSON.stringify(window.arenalDemo.state),before);assert.deepEqual(window.arenalDemo.results.map(d=>d.id),resultIDs);assert.equal(window.arenalDemo.state.filters.currency,'CRC');assert.equal(document.querySelector('#index-saved').getAttribute('aria-pressed'),'true');assert.equal(document.querySelector('[data-range=price] .range-amount'),min);assert.equal(min.value,draftMin);assert.equal(scroll.scrollTop,541);assert.equal(document.querySelector('#index-filter-page').open,true);assert.equal(document.querySelector('.listing-title-link').textContent,items[0].name);
  assert.equal(sort.value,'price-asc');assert.equal(document.querySelector('.sort-control').title,'Ordenar: Menor precio');
  assert.equal(document.querySelector('[data-sort-mode="unit-asc"]').textContent,'Menor precio por m²');
  i18n.setLanguage('en');assert.equal(document.querySelector('.listing-title-link').textContent,i18n.listingText(items[0]));
  checkPriceLabels('CRC');
  assert.equal(document.querySelector('.sort-control').title,'Sort: Lowest price');
  assert.equal(document.querySelector('[data-sort-mode="unit-asc"]').textContent,'Lowest price per m²');
  document.querySelector('#index-cancel').onclick();document.querySelector('#nav-explore').onclick();
  assert.equal(sort.value,'price-asc');assert.deepEqual(Array.from(window.arenalDemo.results,d=>d.id),Array.from(sorted,d=>d.id));
});

test('title placeholders retain their field language while labels follow the interface',()=>{
 const {document,i18n}=languageFixture({html:renderFields(M.steps[0].fields,{})});
 for(const lang of ['en','es','en']){
  i18n.setLanguage(lang);i18n.translate(document);
  assert.equal(document.querySelector('[data-key=listing_title_es]').placeholder,'Ej. Lote con vista al Arenal');
  assert.equal(document.querySelector('[data-key=listing_title_en]').placeholder,'e.g. Land with Arenal views');
  assert.equal(document.querySelector('[data-key=listing_title_es]').getAttribute('lang'),'es');
  assert.equal(document.querySelector('[for=field-listing_title_es]').textContent.includes(lang==='en'?'Title in Spanish':'Título en español'),true);
 }
});

test('the full listing offers a bilingual return action and its Back button returns to the buyer flow',async()=>{
  const row=supplementalDemos.find(d=>d.id==='lot-129'),returned=[];
  const context={hasDraft:false,href:'/offer/#listing.'+'a'.repeat(64)+'.'+'b'.repeat(64)};
  const session={returnFor:id=>id===row.id?context:null,returnToOffer:value=>{returned.push(value);return true;}};
  const {document,i18n}=await detailFixture(row,session);
  assert.match(document.querySelector('.pd-offer-return').textContent,/Volver a la oferta/);
  context.hasDraft=true;i18n.setLanguage('en');await flush();
  assert.match(document.querySelector('.pd-offer-return').textContent,/Continue my offer/);
  assert.match(document.querySelector('.pd-footer').textContent,/Continue my offer/);
  document.querySelector('[data-offer-return]').click();document.querySelector('.pd-bar [data-action=back]').click();assert.equal(returned.length,2);assert.equal(returned[0],context);
});
