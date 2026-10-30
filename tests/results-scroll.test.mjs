import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../site/results-scroll.js',import.meta.url),'utf8');
function fixture(){
 const frames=[],changes=[],writes=[],handlers=new Map();let resize,more=0;
 const element=name=>({addEventListener(type,fn,options){handlers.set(name+':'+type,{fn,options});}});
 const sheet=element('sheet');sheet.parentElement={clientHeight:700};
 const handle=element('handle');handle.setPointerCapture=()=>{};
 const scroll=element('scroll');Object.assign(scroll,{scrollTop:0,scrollHeight:10000,clientHeight:700,scrollTo(options){writes.push(options);this.scrollTop=options.top;}});
 const styles=new Map(),root={style:{setProperty:(key,value)=>styles.set(key,value)}};
 const window={};vm.runInNewContext(source,{window,requestAnimationFrame(fn){frames.push(fn);return frames.length;},ResizeObserver:class{constructor(fn){resize=fn;}observe(){}},matchMedia:()=>({matches:true}),performance:{now:()=>1000}});
 const controller=window.ArenalResultsScroll({root,sheet,scroll,handle,onChange:p=>changes.push(p),loadMore:()=>more++});
 const dispatch=(target,type,event={})=>handlers.get(target+':'+type)?.fn(event);
 const move=top=>{scroll.scrollTop=top;dispatch('scroll','scroll');while(frames.length)frames.shift()();};
 return {controller,scroll,sheet,styles,handlers,changes,writes,dispatch,move,resize,get more(){return more;},window};
}
test('native offset raises the sheet proportionally, then moves through the list',()=>{
 const f=fixture();assert.equal(f.controller.collapsedHeight,308);
 f.move(120);assert.equal(f.styles.get('--sheet-height'),'428px');
 assert.equal(f.scroll.scrollTop,120);
 f.move(392);assert.equal(f.styles.get('--sheet-height'),'700px');
 f.move(592);assert.equal(f.styles.get('--sheet-height'),'700px');
 f.move(300);assert.equal(f.styles.get('--sheet-height'),'608px');
 assert.equal(f.writes.length,0,'observing native scroll must never write scrollTop');
});
test('browsing an expanded list does not repaint the sheet or map every frame',()=>{
 const f=fixture();f.move(392);const count=f.changes.length;
 for(const top of [450,500,700,1400,900,400])f.move(top);
 assert.equal(f.changes.length,count);assert.equal(f.writes.length,0);
});
test('touch and wheel listeners are passive and do not cancel browser scrolling',()=>{
 const f=fixture();let stopped=0;
 for(const type of ['wheel','touchstart','touchmove']){
  assert.equal(f.handlers.get('sheet:'+type).options.passive,true);
  f.dispatch('sheet',type,{stopPropagation(){stopped++;},preventDefault(){assert.fail('native scrolling must remain enabled');}});
 }
 assert.equal(stopped,3);assert.equal(f.writes.length,0);
});
test('button and list reset preserve the distinction between map reveal and content',()=>{
 const f=fixture();f.controller.setExpanded(true);assert.equal(f.scroll.scrollTop,392);
 f.move(1200);f.controller.resetList();assert.equal(f.scroll.scrollTop,392);
 f.move(150);f.controller.resetList();assert.equal(f.scroll.scrollTop,150);
 f.controller.setExpanded(false);assert.equal(f.scroll.scrollTop,0);
});
test('resize preserves intermediate progress and content position; hidden views keep it',()=>{
 const f=fixture();f.move(196);f.sheet.parentElement.clientHeight=600;f.resize();
 assert.equal(f.scroll.scrollTop,168); // half of the new 336px map reveal
 f.move(836);f.sheet.parentElement.clientHeight=700;f.resize();assert.equal(f.scroll.scrollTop,892);
 f.sheet.parentElement.clientHeight=0;f.resize();assert.equal(f.scroll.scrollTop,892);
});
test('pagination is requested near the end, never during initial layout',()=>{
 const f=fixture();assert.equal(f.more,0);
 f.move(8000);assert.equal(f.more,0);
 f.move(9000);assert.equal(f.more,1);
});
test('handle drag and keyboard can stop midway without triggering the toggle',()=>{
 const f=fixture();f.dispatch('handle','pointerdown',{button:0,pointerId:1,clientY:500});
 f.dispatch('handle','pointermove',{pointerId:1,clientY:420});assert.equal(f.scroll.scrollTop,80);
 f.dispatch('handle','pointerup',{pointerId:1});let canceled=false;
 f.dispatch('handle','click',{preventDefault(){canceled=true;},stopImmediatePropagation(){}});assert.equal(canceled,true);
 f.dispatch('handle','keydown',{key:'End',preventDefault(){}});assert.equal(f.scroll.scrollTop,392);
 f.dispatch('handle','keydown',{key:'Home',preventDefault(){}});assert.equal(f.scroll.scrollTop,0);
});
test('short and landscape viewports keep usable map and list space',()=>{
 const {window}=fixture();assert.equal(window.ArenalSheetBounds(240).min,132);assert.equal(window.ArenalSheetBounds(240).max,240);
});
