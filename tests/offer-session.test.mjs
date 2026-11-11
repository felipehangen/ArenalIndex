import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {replyDraft,proposedOffer,validateReply} from '../site/offer/reply.mjs';
const source=fs.readFileSync(new URL('../site/offer/session.js',import.meta.url),'utf8');
const token='listing.'+'a'.repeat(64)+'.'+'b'.repeat(64);
const snapshot=()=>({draft:{...replyDraft('USD'),amount:'200000',name:'Buyer',replyMethod:'email',email:'buyer@example.test'},screen:'welcome',resumeScreen:'draft',hasDraft:true,submissionId:'c'.repeat(32),positions:{draft:{y:540,focus:'email'}}});
function fixture(blocked=false){
 const data=new Map(),visits=[];
 const window={sessionStorage:{getItem:key=>data.get(key),setItem(key,value){if(blocked)throw Error('Blocked');data.set(key,value);},removeItem:key=>data.delete(key)},history:{state:null,replaceState(state,title,url){this.state=structuredClone(state);},pushState(state,title,url){this.state=structuredClone(state);visits.push(url);}},location:{assign:url=>visits.push(url),reload(){visits.push('reload');}}};
 vm.runInNewContext(source,{window});return {window,data,visits,session:window.ArenalOfferSession.create()};
}
test('full listing and offer share only a tab-local return context; Continue restores values and position',()=>{
 const e=fixture(),draft=snapshot();assert.equal(e.session.visitListing(token,'lake-house',draft),true);assert.deepEqual(e.visits,['/#propiedad/lake-house']);
 const context=e.session.returnFor('lake-house');assert.equal(context.hasDraft,true);assert.equal(e.session.returnFor('other-house'),null);assert.equal(e.data.get('arenalindex.offer-return:lake-house').includes('buyer@example.test'),false);
 assert.equal(e.session.returnToOffer(context),true);const restored=e.session.load(token);assert.equal(restored.screen,'draft');assert.equal(restored.draft.email,'buyer@example.test');assert.equal(restored.positions.draft.y,540);assert.equal(restored.positions.draft.focus,'email');assert.equal(e.visits.at(-1),'/offer/#'+token);
 e.session.clear(token,'lake-house');assert.equal(e.session.returnFor('lake-house'),null);assert.equal(e.session.load(token),null);
});
test('history state preserves the same return journey when sessionStorage is blocked',()=>{
 const e=fixture(true);e.session.visitListing(token,'lake-house',snapshot());assert.deepEqual(e.visits,['/#propiedad/lake-house','reload']);const context=e.session.returnFor('lake-house');assert.equal(context.hasDraft,true);
 assert.equal(e.session.returnToOffer(context),true);assert.equal(e.visits.at(-2),'/offer/#'+token);assert.equal(e.session.load(token).draft.amount,'200000');assert.equal(e.session.load(token).positions.draft.y,540);
});
test('before typing, listing Back returns to welcome; forged or unrelated return contexts are ignored',()=>{
 const e=fixture();e.session.visitListing(token,'lake-house',{...snapshot(),hasDraft:false});const context=e.session.returnFor('lake-house');assert.equal(context.hasDraft,false);e.session.returnToOffer(context);assert.equal(e.session.load(token).screen,'welcome');
 e.data.set('arenalindex.offer-return:lake-house',JSON.stringify({token:'javascript:alert(1)',href:'https://evil.example'}));assert.equal(e.session.returnFor('lake-house'),null);assert.equal(e.session.visitListing(token,'../private',snapshot()),false);
});
test('international WhatsApp numbers normalize once and only the chosen channel is submitted',()=>{
 let d={...replyDraft('USD'),name:'Buyer',amount:'100000',replyMethod:'whatsapp',country:'1',phone:'202 555 0123',email:'unused@example.test'};
 assert.deepEqual(validateReply(d),{});assert.equal(proposedOffer(d).contact,'+12025550123');assert.equal('email' in proposedOffer(d),false);
 d.phone='+44 7700 900123';assert.equal(proposedOffer(d).contact,'+447700900123');assert.deepEqual(validateReply(d),{});
 d={...d,country:'other',dialCode:'+598',phone:'99 123 456'};assert.equal(proposedOffer(d).contact,'+59899123456');assert.deepEqual(validateReply(d),{});
 assert.ok(validateReply({...d,phone:''}).phone);assert.ok(validateReply({...d,dialCode:''}).dialCode);assert.ok(validateReply({...d,replyMethod:''}).replyMethod);
 const migrated=replyDraft('USD',{contact:'+506 8888 7777'});assert.equal(migrated.country,'506');assert.equal(migrated.phone,'88887777');assert.equal(replyDraft('USD',{contact:'buyer@example.test'}).replyMethod,'email');
});
