import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf(' function acknowledgeNavigation('),html.indexOf(' // End saved-property navigation.'));
const pressedState=html.match(/q\('#index-saved'\)\.setAttribute\('aria-pressed',String\(onlySaved\)\);q\('#nav-explore'\)\.setAttribute\('aria-pressed',String\(!onlySaved\)\);/)[0];
function fixture(reducedMotion=false){
 let renders=0,persists=0,position={progress:1,contentOffset:1300};
 let cameraView={center:[-84.6,10.4],zoom:15,bearing:0,pitch:0};
 const animations=[],buttons=new Map(['#nav-explore','#index-saved'].map(id=>[id,{
  'aria-pressed':String(id==='#nav-explore'),setAttribute(name,value){this[name]=value;},
  animate(frames,options){const animation={id,frames,options,canceled:false,cancel(){this.canceled=true;}};animations.push(animation);return animation;}
 }]));
 const context={
  q:id=>buttons.get(id),navigationFeedback:new WeakMap(),matchMedia:()=>({matches:reducedMotion}),
  onlySaved:false,browseState:null,cameraJob:0,filters:{currency:'CRC',price:[100,200],zone:'Jauri'},unit:'unit',
  scope:['lot-1','lot-2'],camera:null,history:[],selected:'lot-2',selectedGroup:['lot-1','lot-2'],
  reference:null,selectionAnchor:[-84.6,10.4],visibleLimit:60,page:2,saved:new Set(['lot-1']),
  clone:value=>JSON.parse(JSON.stringify(value)),render(){renders++;vm.runInContext(pressedState,context);},persist(){persists++;},
  setResultsExpanded(){position={progress:1,contentOffset:0};},
  resultsController:{capturePosition:()=>({...position}),restorePosition(value){position=value;},resetList(){position={progress:1,contentOffset:0};}},
  map:{stop(){},getCenter:()=>({toArray:()=>cameraView.center}),getZoom:()=>cameraView.zoom,getBearing:()=>cameraView.bearing,getPitch:()=>cameraView.pitch,jumpTo(value){cameraView=value;}}
 };
 vm.createContext(context);vm.runInContext(source,context);
 return {context,buttons,animations,get renders(){return renders;},get persists(){return persists;},get position(){return position;},get cameraView(){return cameraView;}};
}
test('Explore restores filters, selection, loaded cards, scroll and camera after visiting Saved',()=>{
 const f=fixture(),c=f.context;
 c.showSaved();assert.equal(c.onlySaved,true);assert.equal(c.scope,null);assert.equal(c.selected,null);assert.equal(c.selectionAnchor,null);
 c.filters.price[0]=150;c.filters.zone='La Fortuna';c.selected='lot-1';c.selectedGroup=['lot-1'];c.visibleLimit=20;
 c.saved.add('lot-2');c.map.jumpTo({center:[-84.5,10.5],zoom:12,bearing:0,pitch:0});
 c.showExplore();
 assert.equal(c.onlySaved,false);assert.equal(c.filters.zone,'Jauri');assert.deepEqual(c.filters.price,[100,200]);
 assert.deepEqual(c.scope,['lot-1','lot-2']);assert.equal(c.selected,'lot-2');assert.deepEqual(c.selectedGroup,['lot-1','lot-2']);
 assert.equal(c.visibleLimit,60);assert.equal(c.page,2);assert.equal(c.unit,'unit');assert.equal(c.filters.currency,'CRC');
 assert.equal(f.position.contentOffset,1300);assert.deepEqual(f.cameraView.center,[-84.6,10.4]);assert.equal(f.cameraView.zoom,15);
 assert.ok(c.saved.has('lot-2'),'new favorites survive the return to browsing');assert.equal(c.browseState,null);
});
test('tapping the active navigation item does not reset browsing or overwrite its snapshot',()=>{
 const f=fixture(),c=f.context;
 c.showExplore();assert.equal(f.renders,0);assert.equal(f.persists,0);
 c.showSaved();const state=c.browseState;
 c.showSaved();assert.equal(c.browseState,state);assert.equal(f.renders,1);
});
test('Explore remains available when a saved-only session has no previous browse snapshot or map',()=>{
 const f=fixture(),c=f.context;c.onlySaved=true;c.map=null;
 c.showExplore();assert.equal(c.onlySaved,false);assert.equal(c.selected,null);assert.equal(c.scope,null);assert.equal(f.renders,1);
 assert.equal(c.filters.zone,'Jauri');assert.equal(f.position.contentOffset,0);
});
test('each tab owns the selected state and only repeat taps pulse without navigating',()=>{
 const f=fixture(),c=f.context;
 c.showSaved();
 assert.equal(f.buttons.get('#index-saved')['aria-pressed'],'true');
 assert.equal(f.buttons.get('#nav-explore')['aria-pressed'],'false');
 assert.equal(f.animations.length,0);
 c.showSaved();c.showSaved();
 assert.deepEqual(f.animations.map(a=>a.id),['#index-saved','#index-saved']);
 assert.ok(f.animations[0].canceled,'rapid repeat taps replace the previous animation');
 assert.equal(f.renders,1);assert.equal(f.persists,1);
 c.showExplore();
 assert.equal(f.buttons.get('#index-saved')['aria-pressed'],'false');
 assert.equal(f.buttons.get('#nav-explore')['aria-pressed'],'true');
 c.showExplore();
 assert.equal(f.animations.at(-1).id,'#nav-explore');
 assert.equal(f.position.contentOffset,1300);assert.equal(f.renders,2);assert.equal(f.persists,2);
});
test('reduced motion and browsers without animation retain navigation and position',()=>{
 for(const reducedMotion of [true,false]){
  const f=fixture(reducedMotion),c=f.context;
  if(!reducedMotion)for(const button of f.buttons.values())delete button.animate;
  c.showExplore();c.showSaved();c.showSaved();c.showExplore();c.showExplore();
  assert.equal(f.animations.length,0);assert.equal(f.position.contentOffset,1300);assert.equal(c.onlySaved,false);
 }
});
