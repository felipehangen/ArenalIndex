import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import {createGoogleVerifier} from '../server/admin/google.mjs';

const pair=await generateKeyPair('RS256');
const jwk=await exportJWK(pair.publicKey);jwk.kid='google-test';
const clientId='example.apps.googleusercontent.com',nonce='a'.repeat(64),time=1794225600;
const base={iss:'https://accounts.google.com',aud:clientId,sub:'google-user',email:'FelipeHangen@gmail.com',email_verified:true,nonce,iat:time,exp:time+3600};
const verify=createGoogleVerifier({clientId,keys:createLocalJWKSet({keys:[jwk]}),now:()=>new Date(time*1000)});
const sign=(payload,key=pair.privateKey)=>new SignJWT(payload).setProtectedHeader({alg:'RS256',kid:'google-test'}).sign(key);

test('Google identity requires a signed token and returns a normalized verified email',async()=>{
  assert.deepEqual(await verify(await sign(base),nonce),{subject:'google-user',email:'felipehangen@gmail.com'});
  assert.ok(await verify(await sign({...base,iss:'accounts.google.com',azp:clientId}),nonce));
});
test('wrong issuer, audience, nonce, authorized party, expiry and unverified accounts are rejected',async()=>{
  for(const patch of [{iss:'https://attacker.example'},{aud:'another-client'},{nonce:'other'},
    {azp:'another-client'},{exp:time-1},{iat:time-601},{iat:time+60},{email_verified:false},{email_verified:'true'},{sub:''}]){
    const token=await sign({...base,...patch});await assert.rejects(()=>verify(token,nonce));
  }
});
test('Google claims cannot be omitted or signed by another key',async()=>{
  for(const claim of ['exp','iat','nonce','sub','email','email_verified']){
    const payload={...base};delete payload[claim];await assert.rejects(()=>sign(payload).then(token=>verify(token,nonce)));
  }
  const other=await generateKeyPair('RS256');await assert.rejects(()=>sign(base,other.privateKey).then(token=>verify(token,nonce)));
});
