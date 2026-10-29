import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const window={};
vm.runInNewContext(fs.readFileSync(new URL('../site/map-markers.js',import.meta.url),'utf8'),{window});
class Marker {
 constructor({element}){this.element=element;this.moves=0;this.removed=false;}
 setLngLat(){this.moves++;return this;}
 addTo(){return this;}
 remove(){this.removed=true;}
}
const feature=(id='lot-1',coordinates=[-84.6,10.4])=>({geometry:{coordinates},properties:{id}});
test('move and idle redraws preserve the pressed button and click handler',()=>{
 const store=new window.ArenalMarkerStore({},Marker);let creates=0,selected;
 const create=()=>{creates++;return {};};
 store.begin();const first=store.use('lot-1',feature(),create);first.button.onclick=()=>selected=first.feature;store.end();
 // A finger is down on this button while the map emits another idle event.
 const pressed=first.button;
 for(let i=0;i<5;i++){store.begin();store.use('lot-1',feature(),create);store.end();}
 pressed.onclick();assert.equal(creates,1);assert.equal(store.entries.get('lot-1').button,pressed);
 assert.equal(selected,store.entries.get('lot-1').feature);assert.equal(first.marker.removed,false);assert.equal(first.marker.moves,1);
});
test('coordinate changes move the existing marker without replacing its DOM target',()=>{
 const store=new window.ArenalMarkerStore({},Marker);
 store.begin();const first=store.use('lot-1',feature(),()=>({}));store.end();
 store.begin();const next=store.use('lot-1',feature('lot-1',[-84.7,10.5]),()=>({}));store.end();
 assert.equal(next.button,first.button);assert.equal(next.marker.moves,2);
});
test('filtering removes only markers that left the result set',()=>{
 const store=new window.ArenalMarkerStore({},Marker);
 store.begin();const first=store.use('lot-1',feature(),()=>({}));const second=store.use('lot-2',feature('lot-2'),()=>({}));store.end();
 store.begin();store.use('lot-2',feature('lot-2'),()=>({}));store.end();
 assert.equal(first.marker.removed,true);assert.equal(second.marker.removed,false);assert.equal(store.entries.size,1);
 store.begin();store.end();assert.equal(second.marker.removed,true);assert.equal(store.entries.size,0);
});
