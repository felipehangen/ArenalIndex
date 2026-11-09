import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {createPublication} from '../server/intake/publication.mjs';
import {createPublicHandler} from '../server/intake/public.mjs';
import {approvedRow,editorial,sampleListing} from './publication-fixture.mjs';
const options={apiURL:'https://api.example/api/listings'};
const window={};for(const file of ['catalog.js','property-content.js'])vm.runInNewContext(fs.readFileSync(new URL('../site/'+file,import.meta.url),'utf8'),{window,URLSearchParams,AbortSignal});

test('only approved, complete versions can become public; title and contact are deliberate editorial choices',()=>{
  const row=approvedRow();
  for(const status of ['draft','ready_for_review','changes_requested'])assert.throws(()=>createPublication({...row,status},editorial,options));
  for(const change of [{title:''},{title:'x'.repeat(46)},{title:'TODO MAYÚSCULAS'},{title:'Vista 🌿'},{place:''},{whatsapp:'javascript:alert(1)'}])assert.throws(()=>createPublication(row,{...editorial,...change},options));
  row.payload.values.location_consent=false;assert.throws(()=>createPublication(row,editorial,options));
});
test('the public projection excludes private contact, references, documents, tokens and feedback',()=>{
  const row=approvedRow();row.payload.values.name='PRIVATE-REFERENCE';row.payload.values.documents_notes='PRIVATE-DOCUMENT-NOTES';row.feedback='PRIVATE-FEEDBACK';row.token_hash='SECRET-TOKEN';
  row.payload.files.push({...row.payload.files[0],id:'private-image',category:'technical'});
  const publication=createPublication(row,editorial,options),json=JSON.stringify(publication.listing);
  for(const secret of ['PRIVATE-REFERENCE','PRIVATE-PLAN','PRIVATE-DOCUMENT-NOTES','PRIVATE-FEEDBACK','SECRET-TOKEN','seller@example.com','Test seller','plan-1','private-image'])assert.ok(!json.includes(secret),secret);
  assert.equal(publication.listing.details.contact,null);assert.equal(publication.media['plan-1'],undefined);assert.equal(publication.media['private-image'],undefined);
  assert.equal(publication.listing.details.documentedArea,3200);assert.equal(publication.listing.area,3200);assert.equal(publication.listing.details.declaredArea,3250);
});
test('public facts keep conditional answers, independent buildings, cover order, sources and currencies',()=>{
  const row=approvedRow();row.payload.values.access='direct';row.payload.values.water='none';row.payload.values.currency='CRC';
  const {listing}=createPublication(row,{...editorial,whatsapp:'+506 8888 9999'},options),json=JSON.stringify(listing.details);
  assert.ok(!json.includes('Tramo privado'));assert.ok(!json.includes('ASADA de la comunidad'));
  assert.equal(listing.details.buildings.length,2);assert.match(listing.images[0],/photo=view-1/);assert.equal(listing.currency,'CRC');assert.equal(listing.details.contact.whatsapp,'50688889999');
  assert.match(json,/Residencial con vías públicas/);assert.match(json,/Dron/);assert.match(json,/reportado por el vendedor/);
});
test('buyer content renders available details and escapes editorial text without false missing-document claims',()=>{
  const item=window.ArenalData.normalize(sampleListing());item.name='<script>bad</script>';item.description='<img src=x onerror=bad()>';
  item.details.buildings[0].name='<script>bad</script>';
  const html=window.ArenalListing.content(item);
  assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<script>|<img src=x/);assert.match(html,/Casa|construcciones/);
  for(const label of ['Agua de red','Electricidad','Internet fijo','Aguas residuales','Cabaña del jardín','Área del plano','Residencial con vías públicas'])assert.ok(html.includes(label),label);
  assert.doesNotMatch(html,/todavía no ha aportado/);
  const legacy=window.ArenalData.normalize({...sampleListing(),details:null,private_residential:true});
  assert.equal(legacy.privateResidential,false);assert.match(window.ArenalListing.content(legacy),/régimen de la propiedad está por confirmar/);
});
test('public media reads require the currently published photo/version and reject private documents',async()=>{
  const publication=createPublication(approvedRow(),editorial,options),reads=[];
  let current={publication};
  const handler=createPublicHandler({get:async()=>current,published:async()=>[publication.listing],downloadURL:async path=>{reads.push(path);return 'https://storage.example/approved-photo';}});
  const list=await handler(new Request('https://api.example/api/listings'));assert.equal((await list.json())[0].name,editorial.title);
  const photo=publication.listing.images[0],response=await handler(new Request(photo));assert.equal(response.status,307);assert.equal(response.headers.get('Location'),'https://storage.example/approved-photo');
  for(const url of [photo.replace('view-1','plan-1'),photo.replace('version=2','version=1'),photo.replace('view-1','..%2Fplan-1')])assert.equal((await handler(new Request(url))).status,404);
  current={};assert.equal((await handler(new Request(photo))).status,404);assert.equal(reads.length,1);
});

test('the standalone reviewer preview opens the real detail without a catalog list',async()=>{
  const item=window.ArenalData.normalize(sampleListing());
  const element=()=>({hidden:true,open:false,innerHTML:'',setAttribute(){},removeAttribute(){},addEventListener(){},focus(){},append(){},showModal(){this.open=true;},querySelector(){return element();}});
  const page=element(),home=element(),root=element();
  const preview={arenalReady:Promise.resolve(),ArenalPreview:true,ArenalListing:window.ArenalListing,ArenalFormat:{number:window.ArenalListing.number},arenalDemo:{items:[item],state:{saved:[]}},addEventListener(){}};
  await vm.runInNewContext(fs.readFileSync(new URL('../site/property-detail.js',import.meta.url),'utf8'),{
    window:preview,document:{title:'Preview',activeElement:null,getElementById:id=>({'arenal-index-dos':root,'index-home':home}[id]||null),createElement:()=>page},
    location:{hash:'#propiedad/'+item.id},ArenalMotion:{cancel(){}},IntersectionObserver:class{observe(){} disconnect(){}}
  });
  assert.equal(page.open,true);assert.equal(page.hidden,false);assert.equal(home.inert,true);
  assert.match(page.innerHTML,/Vista previa privada/);assert.match(page.innerHTML,/Un jardín frente al Arenal/);
  assert.equal(typeof preview.arenalDetail.open,'function');
});
