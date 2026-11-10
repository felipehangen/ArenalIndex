import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
const read=file=>fs.readFileSync(new URL('../site/'+file,import.meta.url),'utf8');
function fixture({desktop=false,saved=false,conversion=true}={}){
 const {window,document}=parseHTML(read('index.html'));
 const root=document.querySelector('#arenal-index-dos'),sheet=document.querySelector('#index-preview'),scroll=document.querySelector('#results-scroll'),button=document.querySelector('#index-sort'),dialog=document.querySelector('#sort-dialog');
 let mode='explore',selected=0,focus=null;const frames=[];
 Object.defineProperty(sheet.parentElement,'clientHeight',{value:700});
 Object.defineProperty(scroll,'clientHeight',{value:700});Object.defineProperty(scroll,'scrollHeight',{value:10000});
 scroll.scrollTop=0;scroll.scrollTo=({top})=>{scroll.scrollTop=top;};
 const proto=window.HTMLElement.prototype;
 proto.focus=function(options){focus=this;if(!options?.preventScroll)scroll.scrollTop=0;};
 // Model browser focus adjustments when entering/leaving the dialog.
 proto.showModal=function(){this.open=true;scroll.scrollTop=0;};
 proto.close=function(){this.open=false;scroll.scrollTop=0;this.dispatchEvent(new window.Event('close'));};
 dialog.getBoundingClientRect=()=>({left:20,right:360,top:200,bottom:600});
 const context={window,document,requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},ResizeObserver:class{observe(){}},matchMedia:()=>({matches:true}),performance:{now:()=>1000}};
 for(const file of ['results-scroll.js','sort-picker.js'])vm.runInNewContext(read(file),context);
 const controller=window.ArenalResultsScroll({root,sheet,scroll,handle:document.querySelector('#results-handle'),desktop:{matches:desktop,addEventListener(){}},onChange(){},loadMore(){}});
 if(saved)controller.setListOnly(true);
 const picker=window.ArenalSortPicker({button,dialog,getMode:()=>mode,isAvailable:value=>conversion||['explore','area-desc'].includes(value),capturePosition:()=>controller.capturePosition(),restorePosition:p=>controller.restorePosition(p),onSelect:value=>{mode=value;selected++;controller.resetList();picker.sync();return true;}});
 picker.sync();
 const move=top=>{scroll.scrollTop=top;scroll.dispatchEvent(new window.Event('scroll'));while(frames.length)frames.shift()();};
 return {window,document,root,scroll,button,dialog,controller,move,get selected(){return selected;},get mode(){return mode;},get focus(){return focus;}};
}
test('opening and dismissing Sort preserves an expanded, partially revealed, desktop, or Saved list',()=>{
 for(const state of [{top:892},{top:196},{desktop:true,top:500},{saved:true,top:500}]){
  const f=fixture(state);f.move(state.top);
  const height=f.root.style.getPropertyValue('--sheet-height');
  assert.equal(f.dialog.closest('#results-scroll'),null);
  f.button.dispatchEvent(new f.window.Event('pointerdown'));
  f.move(0); // A focus-induced adjustment between pointerdown and click must be undone.
  f.button.click();assert.equal(f.dialog.open,true);assert.equal(f.scroll.scrollTop,state.top);
  assert.equal(f.root.style.getPropertyValue('--sheet-height'),height);
  f.dialog.querySelector('[data-sort-close]').click();
  assert.equal(f.scroll.scrollTop,state.top);assert.equal(f.root.style.getPropertyValue('--sheet-height'),height);
  assert.equal(f.focus,f.button);assert.equal(f.selected,0);
 }
});
test('changing Sort starts at the first result without lowering an expanded sheet',()=>{
 for(const state of [{top:892,expected:392},{saved:true,top:500,expected:0},{desktop:true,top:500,expected:0}]){
  const f=fixture(state);f.move(state.top);f.button.click();f.dialog.querySelector('[data-sort-mode="price-asc"]').click();
  assert.equal(f.mode,'price-asc');assert.equal(f.selected,1);assert.equal(f.scroll.scrollTop,state.expected);
  assert.equal(f.root.style.getPropertyValue('--sheet-height'),'700px');assert.equal(f.dialog.open,false);
  assert.equal(f.button.getAttribute('aria-expanded'),'false');
 }
});
test('the current order, unavailable price options, backdrop dismissal and keyboard activation preserve position',()=>{
 const f=fixture({conversion:false});f.move(892);f.button.click();
 assert.equal(f.dialog.querySelector('[data-sort-mode="price-asc"]').disabled,true);
 f.dialog.querySelector('[data-sort-mode="price-asc"]').click();assert.equal(f.dialog.open,true);assert.equal(f.selected,0);
 f.dialog.querySelector('[data-sort-mode="explore"]').click();assert.equal(f.scroll.scrollTop,892);assert.equal(f.selected,0);
 f.button.dispatchEvent(new f.window.Event('pointerdown'));f.move(1100);
 f.button.dispatchEvent(new f.window.Event('keydown'));f.button.click(); // Keyboard uses the current position, not the previous pointer snapshot.
 const outside=new f.window.Event('click');outside.clientX=0;outside.clientY=0;f.dialog.dispatchEvent(outside);
 assert.equal(f.dialog.open,false);assert.equal(f.scroll.scrollTop,1100);
});
