import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {waitForRelease} from './lib/release.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const dirty=git('status','--porcelain');
if(dirty&&!process.argv.includes('--committed-only'))throw Error('Commit the reviewed release first, or use --committed-only to explicitly deploy HEAD without local edits.');
const commit=git('rev-parse','HEAD');
const project=JSON.parse(await readFile(join(root,'.vercel/project.json'),'utf8'));
if(project.projectName!=='arenalindex-intake')throw Error('This checkout must be linked to the existing arenalindex-intake project.');
const stage=await mkdtemp(join(tmpdir(),'arenalindex-release-'));
const run=(command,args)=>execFileSync(command,args,{cwd:stage,stdio:'inherit'});
try{
  const archive=execFileSync('git',['archive',commit],{cwd:root,maxBuffer:100*1024*1024});
  execFileSync('tar',['-x','-C',stage],{input:archive});
  await mkdir(join(stage,'.vercel'));
  await writeFile(join(stage,'.vercel/project.json'),JSON.stringify(project));
  console.log('Testing and deploying committed source '+commit+(dirty?' (local edits excluded)':''));
  run('npm',['ci']);
  run('npm',['run','update:exchange-rate']);
  run('npm',['test']);
  run('npm',['run','build']);
  const {runtimeDigest}=JSON.parse(await readFile(join(stage,'dist/release.json'),'utf8'));
  const args=['deploy','--prod','--yes','--meta','sourceCommit='+commit];
  if(process.env.VERCEL_CLI)run(process.execPath,[process.env.VERCEL_CLI,...args]);
  else run('npx',['--yes','--package=vercel@65.14.0','vercel',...args]);
  await waitForRelease(runtimeDigest,{attempts:8});
  console.log('Verified matching source on both production API hosts. Merge/push this reviewed source to main for GitHub Pages.');
  await rm(stage,{recursive:true,force:true});
}catch(error){
  console.error('Release did not complete. Isolated source retained at '+stage);
  throw error;
}
