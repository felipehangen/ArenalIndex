import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDraft,normalizeTitles,validateDraft,pending} from '../site/newlisting/model.mjs';
import {createDraftPreview} from '../site/newlisting/draft-preview.mjs';
import {completeDraft} from './intake-fixtures.mjs';
import {portalFixture} from './portal-fixture.mjs';
test('Spanish and English titles survive save validation and buyer preview with either language supplied',()=>{
 for(const values of [{listing_title_es:'Vista al lago',listing_title_en:'Lake views'},{listing_title_es:'',listing_title_en:'Lake views'},{listing_title_es:'Vista al lago',listing_title_en:''}]){
  const input=completeDraft();input.values={...input.values,...values};const result=validateDraft(input);
  assert.equal(result.values.listing_title_es,values.listing_title_es);assert.equal(result.values.listing_title_en,values.listing_title_en);
  const preview=createDraftPreview(normalizeDraft(result),()=>'/test.png');
  assert.equal(preview.name,values.listing_title_es||values.listing_title_en);
  if(values.listing_title_es&&values.listing_title_en)assert.equal(preview.details.translations.en.title,values.listing_title_en);
  assert.deepEqual(pending(result),[]);
 }
});
test('old titles migrate into the correct language, and clearing both inputs never revives an old title',()=>{
 const english=normalizeTitles({listing_language:'en',listing_title:'Garden home',listing_title_translation:'Casa con jardín'});
 assert.equal(english.listing_title_en,'Garden home');assert.equal(english.listing_title_es,'Casa con jardín');
 assert.equal(normalizeTitles({...english,listing_title_es:'',listing_title_en:''}).listing_title,'');
 const spanish=normalizeTitles({listing_title:'Vista al Arenal'});assert.equal(spanish.listing_title_es,'Vista al Arenal');
});
test('the account draft endpoint stores both explicit titles without requiring a complete submission',async()=>{
 const e=portalFixture(),admin=await e.adminSession();await e.register('writer',admin);const login=await e.login('writer'),token=login.body.token;
 const draft={id:'new-bilingual-property',values:{listing_title_es:'Terreno junto al río',listing_title_en:'Riverside land'},files:[],buildings:[]};
 const prepared=await e.call('workspace_save_prepare',{draft,version:0,editRevision:0},token);assert.equal(prepared.status,200);
 const saved=await e.call('workspace_save_commit',{id:draft.id,transaction:prepared.body.transaction},token);assert.equal(saved.status,200);assert.equal(saved.body.status,'draft');
 const reopened=await e.call('workspace_open',{id:draft.id},token);assert.equal(reopened.body.draft.values.listing_title_en,'Riverside land');assert.equal(reopened.body.draft.values.listing_title_es,'Terreno junto al río');
});
