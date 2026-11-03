import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../site/requisitos-model.js',import.meta.url),'utf8'),context);
const M=context.ArenalIntake;
const backup=(values={},files=[])=>({format:'arenalindex-intake',version:1,values,files,step:5});
test('an approximate or unconfirmed map point cannot satisfy the exact-entry requirement',()=>{
  assert.ok(M.pending({lat:'10.47',lng:'-84.64'}).some(x=>x.label.includes('Entrada exacta')));
  assert.ok(!M.pending({lat:'10.47',lng:'-84.64',exact:true}).some(x=>x.label.includes('Entrada exacta')));
  assert.equal(M.validPoint({lat:'',lng:''}),false);
  assert.equal(M.validPoint({lat:'91',lng:'-84'}),false);
});
test('empty and unknown service states stay pending; a documented absence is an answer',()=>{
  assert.ok(M.pending({water:'unknown',electricity:'No tiene',access:'Calle pública'}).some(x=>x.label.includes('agua')));
  assert.ok(!M.pending({water:'No tiene',electricity:'No tiene',access:'Calle pública'}).some(x=>x.label.includes('agua')));
});
test('a lot without construction still captures residential rules and fees',()=>{
  const fields=M.activeFields({type:'land',buildings:'no',residential:'condo'}).map(x=>x.id);
  assert.ok(fields.includes('residential'));assert.ok(fields.includes('fees'));assert.ok(!fields.includes('bedrooms'));
});
test('a complete backup restores all answers and actual attachment bytes',()=>{
  const data='data:image/png;base64,iVBORw0KGgo=';
  const restored=M.validateImport(backup({name:'Prueba',area:'5000',type:'Lote',authorization:true},[{category:'overview',name:'ejemplo.png',type:'image/png',data}]));
  assert.equal(restored.values.name,'Prueba');assert.equal(restored.values.authorization,true);assert.equal(restored.files[0].size,8);assert.equal(restored.files[0].data,data);assert.equal(restored.step,5);
});
test('restore rejects corrupt, foreign and executable attachments without modifying state',()=>{
  assert.throws(()=>M.validateImport({values:{},files:[]}));
  assert.throws(()=>M.validateImport(backup({type:'inventado'})));
  assert.throws(()=>M.validateImport(backup({lat:'200'})));
  assert.throws(()=>M.validateImport(backup({},[{category:'overview',name:'x.svg',type:'image/svg+xml',data:'data:image/svg+xml;base64,AAAA'}])));
  assert.throws(()=>M.validateImport(backup({},[{category:'overview',name:'x.png',type:'image/png',data:'data:image/png;base64,@@@='}])));
});
test('required photos and permission are separate from field completeness',()=>{
  const pending=M.pending({type:'land',photo_permission:true,cover_id:'cover'},[{id:'entry',category:'entrance',type:'image/jpeg'},{id:'cover',category:'overview',type:'image/jpeg'}]);
  assert.ok(!pending.some(x=>x.step===5));
  assert.ok(M.pending({},[{category:'entrance'},{category:'overview'}]).some(x=>x.label.includes('Permiso')));
});

test('a reference is optional, limited to 60 characters and legacy long names are not lost',()=>{
  const name=M.steps[0].fields.find(f=>f.id==='name');assert.equal(name.maxLength,60);assert.equal(name.essential,false);
  assert.ok(!M.pending({type:'land'}).some(p=>p.label===name.label));
  const imported=M.validateImport(backup({name:'a'.repeat(100),type:'Lote'}));
  assert.equal(imported.values.name.length,100);assert.ok(M.pending(imported.values).some(p=>p.label.includes('acortar')));
  assert.equal(M.reference({type:'land'}),'Terreno');
});
test('legacy categories preserve buildings and previous location metadata',()=>{
  const imported=M.validateImport(backup({type:'Quinta',buildings:'yes',province:'Alajuela',district:'La Fortuna'}));
  assert.equal(imported.values.type,'built_land');assert.ok(M.hasBuildings(imported.values));assert.equal(imported.values.province,'Alajuela');
  assert.ok(!M.steps[1].fields.some(f=>['province','canton','district','locality'].includes(f.id)));
});
test('service details depend on their own service, never another block',()=>{
  const a=M.activeFields({water:'No tiene',electricity:'Red cercana, conexión pendiente',internet:'No tiene',well:'no'}).map(f=>f.id);
  assert.ok(!a.includes('water_provider'));assert.ok(a.includes('electric_distance'));assert.ok(!a.includes('internet_provider'));assert.ok(!a.includes('well_details'));
});
test('legacy photo groups migrate without dropping files; cover IDs follow import',()=>{
  const data='data:image/png;base64,iVBORw0KGgo=';
  const restored=M.validateImport({...backup({type:'Lote',cover_id:'one'},[{id:'one',category:'flat',name:'a.png',type:'image/png',data,caption:'Pendiente al fondo'},{id:'two',category:'services',name:'b.png',type:'image/png',data}]),version:2});
  assert.equal(restored.files[0].category,'overview');assert.equal(restored.files[1].category,'technical');assert.equal(restored.values.cover_id,restored.files[0].id);assert.equal(restored.files[0].caption,'Pendiente al fondo');
});
test('technical evidence cannot be used as cover and room photos only apply to buildings',()=>{
  assert.ok(!M.activePhotos({type:'land'}).some(p=>p.building));assert.ok(M.activePhotos({type:'home'}).some(p=>p.id==='bedrooms'));
  assert.ok(M.pending({type:'land',cover_id:'t'},[{id:'t',category:'technical',type:'image/jpeg'}]).some(p=>p.label.includes('portada')));
});
