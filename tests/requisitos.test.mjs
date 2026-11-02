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
  const fields=M.activeFields({buildings:'no'}).map(x=>x.id);
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
  const pending=M.pending({photo_permission:true},[{category:'entrance'},{category:'overview'}]);
  assert.ok(!pending.some(x=>x.step===5));
  assert.ok(M.pending({},[{category:'entrance'},{category:'overview'}]).some(x=>x.label.includes('Permiso')));
});
