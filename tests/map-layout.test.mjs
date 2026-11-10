import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
const read=file=>fs.readFileSync(new URL('../site/'+file,import.meta.url),'utf8');
const window={};vm.runInNewContext(read('map-markers.js'),{window});
const layout=window.ArenalMarkerLayout;
const point=(id,x,y,ids=[id])=>({geometry:{type:'Point',coordinates:[x,y]},properties:{id,listingIds:JSON.stringify(ids),listingCount:ids.length}});
const project=coordinates=>({x:coordinates[0],y:coordinates[1]});
const total=result=>[...result.groups,...result.references].reduce((n,g)=>n+g.count,0);
const plan=options=>layout.layout({width:500,height:500,project,priceWidth:()=>80,...options});
test('nearby listings combine into one clickable membership without dropping either price pin',async()=>{
 const a=point('a',100,100),b=point('b',130,100),result=plan({features:[a,b,a]});
 assert.equal(total(result),2);assert.equal(result.groups.length,1);assert.equal(result.groups[0].count,2);
 assert.deepEqual([...await layout.listingIds(result.groups[0].features,{})],['a','b']);
});
test('landmarks absorb complete cluster and co-located membership; hidden landmarks absorb nothing',async()=>{
 const a=point('a',205,165,['a','b']),cluster={geometry:{coordinates:[215,165]},properties:{cluster:true,cluster_id:5,point_count:2,adCount:3}};
 const features=[a,cluster],landmarks=[{name:'Airport',coordinates:[200,200]}];
 const result=plan({features,landmarks});assert.equal(total(result),5);assert.equal(result.references[0].count,5);assert.equal(result.groups.length,0);
 const ids=await layout.listingIds(result.references[0].features,{async getClusterLeaves(id,limit){assert.equal(id,5);assert.equal(limit,2);return [point('c',0,0,['c','d']),point('e',0,0)];}});
 assert.deepEqual([...ids].sort(),['a','b','c','d','e']);
 const covered=plan({features,landmarks,overlays:[{left:150,right:250,top:110,bottom:210}]});
 assert.equal(covered.references[0].visible,false);assert.equal(covered.references[0].count,0);assert.equal(total(covered),5);
});
test('viewport edges and controls reposition pins onto exposed map space, without losing membership',()=>{
 const features=[point('left',0,100),point('right',500,100),point('top',250,0),point('bottom',250,500),point('control',450,50),point('outside',510,100)];
 const overlays=[{left:400,right:500,top:0,bottom:110}];const result=plan({features,overlays});
 assert.equal(total(result),5);
 for(const g of result.groups){assert.ok(g.x>=24&&g.x<=476&&g.y>=24&&g.y<=476);assert.ok(!(g.x+22>400&&g.y-22<110));}
 assert.equal(plan({features,overlays:[{left:0,right:500,top:0,bottom:500}]}).groups.length,0);
});
test('overlapping reference icons never conceal a second listing-count badge',()=>{
 const result=plan({features:[point('a',190,165),point('b',225,165)],landmarks:[{coordinates:[200,200]},{coordinates:[220,200]}]});
 assert.equal(result.references.filter(r=>r.visible).length,1);assert.equal(total(result),2);
 assert.equal(result.references.filter(r=>!r.visible).reduce((n,r)=>n+r.count,0),0);
});
test('300 listings keep exact counts through filtering, movement, label widths and large cluster selection',async()=>{
 const features=Array.from({length:300},(_,i)=>point('p'+i,30+(i%20)*22,30+Math.floor(i/20)*28));
 for(const selected of [features,features.filter((_,i)=>i%3===0)])for(const shift of [0,3])for(const width of [80,160]){
  const result=plan({features:selected,project:c=>({x:c[0]+shift,y:c[1]+shift}),priceWidth:()=>width,landmarks:[{coordinates:[220,230]}]});
  assert.equal(total(result),selected.length);
  const members=[...result.groups,...result.references].flatMap(g=>g.features.map(f=>f.properties.id));
  assert.equal(new Set(members).size,selected.length);
 }
 const cluster={properties:{cluster:true,cluster_id:9,point_count:300,adCount:300}};
 const ids=await layout.listingIds([cluster],{async getClusterLeaves(id,limit){assert.equal(limit,300);return features;}});
 assert.equal(ids.length,300);
});
test('actual map renderer preserves visible counts and selects every merged member',async()=>{
 const {document}=parseHTML('<html><body></body></html>');const source=read('index.html');
 const features=[point('a',100,100),point('b',130,100)];
 class Marker{constructor({element}){this.element=element;}setLngLat(){return this;}setOffset(offset){this.offset=offset;return this;}addTo(){return this;}remove(){}}
 const items=features.map(f=>({id:f.properties.id,coordinates:f.geometry.coordinates,place:'QA'}));
 let renders=0;
 const context={window,document,ArenalMarkerStore:window.ArenalMarkerStore,ArenalMarkerLayout:layout,ready:true,view:'map',filterOpen:false,q:()=>({hidden:false}),qa:()=>[],desktop:{matches:true},markerStore:null,landmarks:[],items,selected:null,filters:{currency:'USD'},unit:'total',formatNumber:String,money:String,compactMoney:()=>'$100K',pricing:{view:()=>({price:100000,unit:20,currency:'USD'})},listingCopy:new Map(items.map(d=>[d.id,{title:d.id}])),button:()=>document.createElement('button'),maplibregl:{Marker},map:{getContainer:()=>({clientWidth:500,clientHeight:500,getBoundingClientRect:()=>({left:0,top:0})}),project,querySourceFeatures:()=>features,getZoom:()=>10,getSource:()=>({})},cameraJob:0,selectionAnchor:null,reference:null,selectedGroup:null,visibleLimit:20,setResultsExpanded(){},resultsController:{resetList(){}},render(){renders++;},fitSelectedGroup(){},revealSelection(){},persist(){}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf(' async function selectFeature('),source.indexOf('\n window.arenalDemo=')),context);
 context.drawMarkers();const entries=[...context.markerStore.entries.values()];assert.equal(entries.length,1);
 assert.equal(entries[0].button.style.visibility,'');assert.equal(entries[0].button.dataset.count,'2');
 await context.selectFeature(entries[0].feature);assert.deepEqual([...context.selectedGroup],['a','b']);assert.equal(renders,1);
 context.drawMarkers();assert.equal([...context.markerStore.entries.values()][0].button,entries[0].button);
});
