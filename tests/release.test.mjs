import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runtimeDigest,waitForRelease} from '../scripts/lib/release.mjs';

test('release fingerprint catches frontend and API changes but permits daily rates and documentation updates',async t=>{
  const root=await mkdtemp(join(tmpdir(),'arenal-release-test-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  for(const dir of ['api','server','site','scripts/lib','docs'])await mkdir(join(root,dir),{recursive:true});
  const files=['package.json','package-lock.json','vercel.json','scripts/build.mjs','scripts/lib/release.mjs','scripts/lib/exchange-rate.mjs','api/listings.mjs','server/core.mjs','site/index.html'];
  for(const file of files)await writeFile(join(root,file),'initial');
  const original=await runtimeDigest(root);
  await writeFile(join(root,'site/exchange-rate.json'),'updated');await writeFile(join(root,'docs/note.md'),'updated');
  await writeFile(join(root,'site/.nojekyll'),'');await writeFile(join(root,'site/CNAME'),'example.test');await writeFile(join(root,'site/README.md'),'Documentation');
  assert.equal(await runtimeDigest(root),original);
  for(const file of ['api/listings.mjs','site/index.html','package-lock.json']){
    await writeFile(join(root,file),'changed');assert.notEqual(await runtimeDigest(root),original);await writeFile(join(root,file),'initial');
  }
  await writeFile(join(root,'release-source-config.json'),'initial');
  await writeFile(join(root,'vercel.json'),'provider-generated configuration');
  assert.notEqual(await runtimeDigest(root),original);
  assert.equal(await runtimeDigest(root,{sourceConfigFile:'release-source-config.json'}),original);
});

test('Pages gate requires both production hosts and fails closed on old builds or errors',async()=>{
  const origins=['https://first.example','https://second.example'];let attempts=0;
  await waitForRelease('expected',{origins,attempts:2,interval:0,pause:async()=>{attempts++;},fetcher:async url=>Response.json({runtimeDigest:attempts||url.startsWith(origins[0])?'expected':'old'})});
  assert.equal(attempts,1);
  await assert.rejects(waitForRelease('expected',{origins,attempts:1,fetcher:async()=>Response.json({runtimeDigest:'old'})}),/do not match/);
  await assert.rejects(waitForRelease('expected',{origins,attempts:1,fetcher:async()=>{throw Error('offline');}}),/do not match/);
});
