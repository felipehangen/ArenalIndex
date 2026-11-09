import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../site/listing-activation.js',import.meta.url),'utf8');
function setup(){
  const handlers=new Map(),documentHandlers=new Map(),window={};let time=1000;
  const track={scrollLeft:0},card={},target={closest:selector=>selector==='.gallery-track'?track:selector==='.listing-card'?card:null};
  const scroller={scrollTop:0,ownerDocument:{addEventListener:(type,fn)=>documentHandlers.set(type,fn)},addEventListener:(type,fn,options)=>handlers.set(type,{fn,options})};
  vm.runInNewContext(source,{window,performance:{now:()=>time}});window.ArenalListingActivation(scroller);
  const fire=(type,extra={})=>{
    const event={target,pointerId:1,isPrimary:true,clientX:100,clientY:300,detail:1,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};
    (handlers.get(type)?.fn||documentHandlers.get(type))(event);return event;
  };
  return {fire,track,scroller,handlers,advance:ms=>time+=ms};
}
test('deliberate taps and modified link clicks remain available',()=>{
  const s=setup();s.fire('pointerdown');s.fire('pointerup');assert.equal(s.fire('click').prevented,undefined);
  s.fire('pointerdown');assert.equal(s.fire('click',{ctrlKey:true}).prevented,undefined);
});
test('vertical scrolling blocks the release click even if the pointer ends where it began',()=>{
  const s=setup();s.fire('pointerdown');s.scroller.scrollTop=120;s.fire('scroll');s.fire('pointerup');
  const click=s.fire('click');assert.equal(click.prevented,true);assert.equal(click.stopped,true);
});
test('a swipe that returns to its start and a canceled touch cannot open a property',()=>{
  const s=setup();s.fire('pointerdown');s.fire('pointermove',{clientY:350});s.fire('pointerup');assert.equal(s.fire('click').prevented,true);
  s.fire('pointerdown');s.fire('pointercancel');s.advance(500);assert.equal(s.fire('click').prevented,true);
});
test('horizontal carousel movement and changed scroll offsets block photo and title clicks',()=>{
  const s=setup();s.fire('pointerdown');s.track.scrollLeft=300;assert.equal(s.fire('click').prevented,true);
  s.fire('pointerdown');s.scroller.scrollTop=400;assert.equal(s.fire('click').prevented,true);
});
test('a tap to stop momentum is ignored, then a fresh stationary tap works',()=>{
  const s=setup();s.fire('scroll');s.advance(50);s.fire('pointerdown');s.advance(300);assert.equal(s.fire('click').prevented,true);
  s.fire('pointerdown');s.fire('pointerup');assert.equal(s.fire('click').prevented,undefined);
});
test('keyboard activation is preserved after scrolling and outside controls are untouched',()=>{
  const s=setup();s.fire('pointerdown');s.fire('scroll');assert.equal(s.fire('click',{detail:0}).prevented,undefined);
  assert.equal(s.fire('click',{target:{closest:()=>null}}).prevented,undefined);
});
test('gesture observers remain passive and never capture or cancel native scrolling',()=>{
  const s=setup();for(const type of ['pointerdown','pointermove','scroll'])assert.equal(s.handlers.get(type).options.passive,true);
  s.fire('pointerdown');assert.equal(s.fire('pointermove',{clientY:400}).prevented,undefined);assert.equal(s.fire('scroll').prevented,undefined);
});
