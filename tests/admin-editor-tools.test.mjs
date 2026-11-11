import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {adminActionMarkup} from '../site/newlisting/admin-tools.mjs';
const markup=(status,{published=false,dirty=false}={})=>parseHTML('<div>'+adminActionMarkup({cloud:{dirty},submission:{version:2,status,publishedVersion:published?1:null}})+'</div>').document;
test('the editor shows the next valid workflow action and keeps destructive actions grouped',()=>{
 for(const [status,action] of [['draft','prepare'],['ready_for_review','approve'],['approved','publish']]){
  const d=markup(status);assert.ok(d.querySelector('[data-admin-action="'+action+'"]'));assert.ok(d.querySelector('[data-admin-action=preview]'));
  assert.ok(d.querySelector('details [data-admin-action=delete]'));assert.equal(d.querySelector('[data-admin-action=unlist]'),null);
 }
 const published=markup('approved',{published:true});assert.equal(published.querySelector('[data-admin-action=publish]').textContent,'Revisar y publicar');assert.ok(published.querySelector('details [data-admin-action=unlist]'));
});
test('unsaved edits cannot be approved or published against an old saved version',()=>{
 for(const status of ['ready_for_review','approved']){
  const d=markup(status,{dirty:true}),control=d.querySelector('[data-admin-action="'+(status==='approved'?'publish':'approve')+'"]');assert.equal(control.disabled,true);assert.match(control.title,/Guardá/);
 }
 assert.equal(markup('draft',{dirty:true}).querySelector('[data-admin-action=prepare]').disabled,false);
});
