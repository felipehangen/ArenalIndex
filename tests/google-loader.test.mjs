import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {createGoogleLoader} from '../site/admin/google-loader.mjs';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const {window,document}=parseHTML('<html><head></head><body></body></html>');const timers=[];
 const load=createGoogleLoader({window,document,schedule:fn=>{const timer={fn};timers.push(timer);return timer;},cancel:timer=>{timer.cancelled=true;}});
 const finish=locale=>{const script=document.querySelector('script');assert.equal(script.src,'https://accounts.google.com/gsi/client?hl='+locale);window.google={accounts:{id:{locale}}};script.onload();};
 return {load,window,document,finish,timers};
}
test('Google loads the initial English locale and replaces its script for both language switch directions',async()=>{
 const f=fixture();
 for(const locale of ['en','es','en']){const request=f.load(locale);await flush();f.finish(locale);assert.equal((await request).locale,locale);assert.equal(f.document.querySelectorAll('script').length,1);}
 const script=f.document.querySelector('script');assert.equal((await f.load('en')).locale,'en');assert.equal(f.document.querySelector('script'),script);
});
test('a language switch during a slow Google load serializes the scripts and finishes in the latest language',async()=>{
 const f=fixture(),first=f.load('es'),second=f.load('en');await flush();assert.equal(f.document.querySelectorAll('script').length,1);
 f.finish('es');await first;await flush();f.finish('en');assert.equal((await second).locale,'en');
 assert.equal(f.document.querySelectorAll('script').length,1);
});
test('a failed Google script can retry without reusing a stale SDK or leaving a stuck promise',async()=>{
 const f=fixture(),first=f.load('en');await flush();const rejection=assert.rejects(first,/No se pudo cargar Google/);f.document.querySelector('script').onerror();await rejection;
 assert.equal(f.document.querySelector('script'),null);
 const second=f.load('es');await flush();f.finish('es');assert.equal((await second).locale,'es');
 assert.ok(f.timers.every(t=>t.cancelled));
});
