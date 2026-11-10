import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
const padding=source.match(/ function generalPadding\(\)\{[^\n]+/)[0];
const fit=source.match(/ function fitItems\(group,all=false\)\{[^\n]+/)[0];
test('desktop map bounds never reserve space for the results pane beside it',()=>{
 for(const isDesktop of [true,false]){
  let options;const stage={clientWidth:400,clientHeight:600,getBoundingClientRect:()=>({bottom:720,height:600})};
  const context={desktop:{matches:isDesktop},q:selector=>selector==='#index-map'?stage:{getBoundingClientRect:()=>({top:450})},resultsController:{collapsedHeight:isDesktop?0:264},map:{stop(){},fitBounds(bounds,value){options=value;}},maplibregl:{LngLatBounds:class{extend(){}}}};
  vm.createContext(context);vm.runInContext(padding+fit+';fitItems([{coordinates:[-84.6,10.4]}]);',context);
  assert.equal(options.padding.bottom,isDesktop?40:318);
  assert.ok(options.padding.top+options.padding.bottom<stage.clientHeight);
  const general=vm.runInContext('generalPadding()',context);
  assert.equal(general.bottom,isDesktop?40:288);
 }
});

test('quick construction filters are exclusive, toggle off, and retain the current currency',()=>{
 const expression=source.match(/qa\('\[data-quick\]'\)\.forEach\(b=>b.onclick=\(\)=>\{[^\n]+?\}\);/)[0];
 const buttons=[{dataset:{quick:'house',value:'no'}},{dataset:{quick:'house',value:'yes'}},{dataset:{quick:'water'}}];
 let resets=0,renders=0;
 const context={qa:()=>buttons,filters:{currency:'CRC',house:'any',water:false},selected:'lot-1',selectedGroup:['lot-1'],reference:{},selectionAnchor:[-84.6,10.4],visibleLimit:80,resultsController:{resetList(){resets++;}},render(){renders++;},persist(){}};
 vm.createContext(context);vm.runInContext(expression,context);
 buttons[0].onclick();assert.equal(context.filters.house,'no');
 buttons[1].onclick();assert.equal(context.filters.house,'yes');
 buttons[1].onclick();assert.equal(context.filters.house,'any');
 buttons[2].onclick();assert.equal(context.filters.water,true);assert.equal(context.filters.currency,'CRC');
 assert.equal(context.selected,null);assert.equal(context.selectedGroup,null);assert.equal(context.reference,null);assert.equal(context.selectionAnchor,null);
 assert.equal(context.visibleLimit,20);assert.equal(resets,4);assert.equal(renders,4);
});
