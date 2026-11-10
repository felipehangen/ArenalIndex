import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

const source=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
const cardSource=source.slice(source.indexOf(' function property('),source.indexOf('\n function baseResults'));
const buttonSource=source.match(/ function button\(label,handler\)\{[^\n]+/)[0];
const mediaSource=source.match(/ const desktop=matchMedia[^\n]+\n const cardGrid=matchMedia[^\n]+/)[0];

function fixture(width=375,images=['land.jpg','house.jpg','garden.jpg','river.jpg','view.jpg']){
  const {document,window}=parseHTML('<html><body></body></html>');
  const item={id:'lot-1',images,name:'Casa y jardín',place:'La Fortuna',area:800,price:150000,currency:'USD',isDemo:false};
  const galleryPositions=new Map();
  const context={document,window,selected:null,filters:{currency:'USD'},saved:new Set(),galleryPositions,
    pricing:{view:d=>({...d,unit:d.price/d.area})},listingCopy:new Map([[item.id,{title:item.name}]]),
    ArenalListing:{highlights:()=>[]},number:String,money:String,requestAnimationFrame:()=>0,
    matchMedia:query=>({matches:width>=Number(query.match(/min-width: (\d+)/)?.[1]||Infinity)})};
  vm.createContext(context);vm.runInContext(mediaSource+buttonSource+cardSource,context);
  const render=()=>{const card=context.property(item);document.body.replaceChildren(card);const track=card.querySelector('.gallery-track');Object.defineProperty(track,'clientWidth',{value:280});return card;};
  const resize=width=>vm.runInContext(`cardGrid.matches=${width>=600};desktop.matches=${width>=960}`,context);
  const select=(card,index)=>{const track=card.querySelector('.gallery-track');track.scrollLeft=index*track.clientWidth;track.dispatchEvent(new window.Event('scroll'));};
  return {render,resize,select,galleryPositions};
}

test('phone cards start with a collage; medium and desktop cards show individual photos',()=>{
  for(const width of [320,375,599,600,768,959,960,1440]){
    const {render}=fixture(width),card=render(),grid=width>=600;
    assert.equal(!!card.querySelector('.listing-collage'),!grid,`${width}px`);
    assert.equal(card.querySelectorAll('.gallery-page').length,grid?5:4);
    assert.equal(card.querySelectorAll('.gallery-indicators span').length,grid?5:4);
    assert.equal(card.querySelector('.gallery-status').textContent,grid?'Vista 1 de 5 · fotografía':'Vista 1 de 4 · collage');
    assert.equal(card.querySelector('.listing-title-link').textContent,'Casa y jardín');
    assert.equal(card.querySelector('.listing-total').textContent,'150000 USD');
  }
});

test('changing between phone, medium and desktop preserves the selected photo rather than its page number',()=>{
  const {render,resize,select,galleryPositions}=fixture();
  let card=render();select(card,3);assert.equal(galleryPositions.get('lot-1'),'garden.jpg');
  for(const [width,index] of [[768,2],[1440,2],[375,3],[600,2]]){
    resize(width);card=render();assert.equal(card.querySelector('.gallery-track').dataset.index,String(index));
    assert.equal(card.querySelector('.gallery-page[aria-hidden="false"] img').getAttribute('src'),'garden.jpg');
  }
  select(card,4);resize(375);card=render();assert.equal(card.querySelector('.gallery-track').dataset.index,'0');
  resize(768);card=render();assert.equal(card.querySelector('.gallery-page[aria-hidden="false"] img').getAttribute('src'),'view.jpg');
});

test('one-photo listings have one gallery page and no dead-end next arrow in the grid',()=>{
  for(const width of [600,768,1440]){
    const {render}=fixture(width,['land.jpg','land.jpg','land.jpg']),card=render();
    assert.equal(card.querySelectorAll('.gallery-page').length,1);
    assert.equal(card.querySelector('.gallery-arrow.next').hidden,true);
    assert.equal(card.querySelector('.gallery-arrow.previous').hidden,true);
    assert.equal(card.querySelector('.gallery-status').textContent,'Vista 1 de 1 · fotografía');
  }
});
