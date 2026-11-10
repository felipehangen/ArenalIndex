import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

const source=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
const cardSource=source.slice(source.indexOf(' function property('),source.indexOf('\n function baseResults'));
const buttonSource=source.match(/ function button\(label,handler\)\{[^\n]+/)[0];
const mediaSource=source.match(/ const desktop=matchMedia[^\n]+/)[0];

function fixture(width=375,images=['land.jpg','house.jpg','garden.jpg','river.jpg','view.jpg','access.jpg','lake.jpg']){
  const {document,window}=parseHTML('<html><body></body></html>');
  const item={id:'lot-1',images,name:'Casa y jardín',place:'La Fortuna',area:800,price:150000,currency:'USD',isDemo:false};
  const galleryPositions=new Map();
  const context={document,window,selected:null,filters:{currency:'USD'},saved:new Set(),galleryPositions,
    pricing:{view:d=>({...d,unit:d.price/d.area})},listingCopy:new Map([[item.id,{title:item.name}]]),
    ArenalListing:{highlights:()=>[]},number:String,money:String,requestAnimationFrame:()=>0,
    matchMedia:query=>({matches:width>=Number(query.match(/min-width: (\d+)/)?.[1]||Infinity)})};
  vm.createContext(context);vm.runInContext(mediaSource+buttonSource+cardSource,context);
  const render=()=>{const card=context.property(item);document.body.replaceChildren(card);const track=card.querySelector('.gallery-track');Object.defineProperty(track,'clientWidth',{value:280});return card;};
  const resize=width=>vm.runInContext(`desktop.matches=${width>=960}`,context);
  const select=(card,index)=>{const track=card.querySelector('.gallery-track');track.scrollLeft=index*track.clientWidth;track.dispatchEvent(new window.Event('scroll'));};
  return {render,resize,select,galleryPositions};
}

test('all screen sizes start with the chosen cover and offer each unique photo in publication order',()=>{
  for(const width of [320,375,599,600,768,959,960,1440]){
    const {render}=fixture(width),card=render();
    assert.equal(card.querySelector('.listing-collage'),null,`${width}px`);
    const pages=[...card.querySelectorAll('.gallery-page')];
    assert.deepEqual(pages.map(page=>page.querySelector('img').getAttribute('src')),['land.jpg','house.jpg','garden.jpg','river.jpg','view.jpg','access.jpg','lake.jpg']);
    assert.ok(pages.every(page=>page.querySelectorAll('img').length===1));
    assert.equal(pages[0].getAttribute('aria-hidden'),'false');
    assert.ok(pages.slice(1).every(page=>page.getAttribute('aria-hidden')==='true'));
    assert.equal(card.querySelector('.gallery-count').textContent,'1 / 7');
    assert.equal(card.querySelector('.gallery-status').textContent,'Vista 1 de 7 · fotografía');
    assert.equal(card.querySelector('.listing-title-link').textContent,'Casa y jardín');
    assert.equal(card.querySelector('.listing-total').textContent,'150000 USD');
  }
});

test('photo selection and counts survive rerenders across phone, medium and desktop',()=>{
  const {render,resize,select,galleryPositions}=fixture();
  let card=render();select(card,2);assert.equal(galleryPositions.get('lot-1'),'garden.jpg');
  for(const width of [768,1440,375,600]){
    resize(width);card=render();assert.equal(card.querySelector('.gallery-track').dataset.index,'2');
    assert.equal(card.querySelector('.gallery-page[aria-hidden="false"] img').getAttribute('src'),'garden.jpg');
    assert.equal(card.querySelector('.gallery-count').textContent,'3 / 7');
  }
  select(card,6);resize(375);card=render();
  assert.equal(card.querySelector('.gallery-page[aria-hidden="false"] img').getAttribute('src'),'lake.jpg');
  assert.equal(card.querySelector('.gallery-count').textContent,'7 / 7');
  assert.equal(card.querySelector('.gallery-status').textContent,'Vista 7 de 7 · fotografía');
  assert.equal(card.querySelector('.gallery-arrow.next').hidden,true);
});

test('one-photo listings omit the counter and navigation at every screen size',()=>{
  for(const width of [375,600,768,1440]){
    const {render}=fixture(width,['land.jpg','land.jpg','land.jpg']),card=render();
    assert.equal(card.querySelectorAll('.gallery-page').length,1);
    assert.equal(card.querySelector('.gallery-arrow.next').hidden,true);
    assert.equal(card.querySelector('.gallery-arrow.previous').hidden,true);
    assert.equal(card.querySelector('.gallery-count').hidden,true);
    assert.equal(card.querySelector('.gallery-status').textContent,'Vista 1 de 1 · fotografía');
  }
});
