import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const window={};
vm.runInNewContext(fs.readFileSync(new URL('../site/results-scroll.js',import.meta.url),'utf8'),{window});
const step=window.ArenalSheetStep;
const state={min:250,max:700,height:250,scrollTop:0,scrollMax:2000};
test('small scroll deltas move proportionally and can stop between endpoints',()=>{
 const first=step(state,60);assert.equal(first.height,310);assert.equal(first.scrollTop,0);
 const next=step({...state,...first},40);assert.equal(next.height,350);
 const stopped=step({...state,...next},0);assert.equal(stopped.height,350);
 const back=step({...state,...stopped},-25);assert.equal(back.height,325);
});
test('one upward gesture continues into the list without losing its remainder',()=>{
 const next=step({...state,height:680},70);
 assert.equal(next.height,700);assert.equal(next.scrollTop,50);
});
test('downward motion returns to the first item before exposing the map',()=>{
 const first=step({...state,height:700,scrollTop:150},-100);
 assert.equal(first.height,700);assert.equal(first.scrollTop,50);
 const next=step({...state,...first},-100);
 assert.equal(next.height,650);assert.equal(next.scrollTop,0);
});
test('both boundaries clamp without overscroll or inaccessible content',()=>{
 const low=step(state,-2000);assert.equal(low.height,250);assert.equal(low.scrollTop,0);
 const high=step(state,5000);assert.equal(high.height,700);assert.equal(high.scrollTop,2000);
});
test('short and landscape viewports keep space for both map and sheet',()=>{
 const small=window.ArenalSheetBounds(240);
 assert.equal(small.min,132);assert.equal(small.max,216);
 const regular=window.ArenalSheetBounds(700);
 assert.equal(regular.min,308);assert.equal(regular.max,676);
});
