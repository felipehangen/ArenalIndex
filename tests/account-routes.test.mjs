import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {accountContext,accountKey} from '../site/newlisting/account.mjs';
import * as client from '../site/cuenta/client.mjs';

test('old portal links redirect to the neutral route with their destination intact',()=>{
  const html=fs.readFileSync(new URL('../site/owner/index.html',import.meta.url),'utf8'),{document}=parseHTML(html);
  let destination;const location={search:'?lang=en',hash:'#edit=property-001',replace:url=>destination=url};
  vm.runInNewContext(document.querySelector('script').textContent,{location});assert.equal(destination,'/cuenta/?lang=en#edit=property-001');
});
test('neutral and legacy editor routes retain the same session and local draft key',async t=>{
  const identity={token:'a'.repeat(64),email:'broker@example.com',expiresAt:Date.now()+3600000};let replaced;
  const names=['window','document','location','history','sessionStorage','fetch'],previous=Object.fromEntries(names.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  t.after(()=>{client.clearSession();for(const name of names){if(previous[name])Object.defineProperty(globalThis,name,previous[name]);else delete globalThis[name];}});
  globalThis.window={ArenalConfig:{intakeUrl:'https://backend.example/api/intake'}};globalThis.document={getElementById:()=>null};
  globalThis.location={hash:'#details',replace:url=>replaced=url};globalThis.history={replaceState:(_state,_unused,url)=>replaced=url};
  globalThis.sessionStorage={getItem:()=>null,setItem(){},removeItem(){}};globalThis.fetch=async()=>Response.json(identity);client.saveSession(identity);
  const legacy=await accountContext('?draft=1&owner=property-001');assert.equal(replaced,'?draft=1&cuenta=property-001#details');
  const current=await accountContext('?cuenta=property-001');assert.equal(current.key,legacy.key);assert.equal(current.key,accountKey('owner',identity.email,'property-001'));assert.equal(current.param,'cuenta');assert.equal(current.back,'/cuenta/');
  current.login();assert.equal(replaced,'/cuenta/#edit=property-001');
});
