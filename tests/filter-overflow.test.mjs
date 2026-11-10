import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
test('quick filter arrows appear only for overflow and reach both ends after a resize or translation',()=>{
 const {document,window}=parseHTML('<div id="row"><button>Filter</button></div><button id="previous"></button><button id="next"></button>');
 const row=document.querySelector('#row'),previous=document.querySelector('#previous'),next=document.querySelector('#next');let available=900,content=900;
 Object.defineProperties(row,{clientWidth:{get:()=>available},scrollWidth:{get:()=>content}});row.scrollLeft=0;row.scrollTo=({left})=>{row.scrollLeft=left;row.dispatchEvent(new window.Event('scroll'));};
 const observers=[];vm.runInNewContext(fs.readFileSync(new URL('../site/filter-overflow.js',import.meta.url),'utf8'),{window,matchMedia:()=>({matches:true}),ResizeObserver:class{constructor(fn){observers.push(fn);}observe(){}}});
 window.ArenalFilterOverflow({row,previous,next});assert.equal(previous.hidden,true);assert.equal(next.hidden,true);
 available=500;observers[0]();assert.equal(next.hidden,false);assert.equal(previous.disabled,true);
 next.click();assert.equal(row.scrollLeft,350);assert.equal(previous.disabled,false);next.click();assert.equal(row.scrollLeft,400);assert.equal(next.disabled,true);
 previous.click();previous.click();assert.equal(row.scrollLeft,0);assert.equal(previous.disabled,true);
 content=450;window.dispatchEvent(new window.Event('arenal-language-change'));assert.equal(previous.hidden,true);assert.equal(next.hidden,true);
});
