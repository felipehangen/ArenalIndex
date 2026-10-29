import {cp,mkdir,readdir,readFile,rm} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),source=new URL('site/',root),output=new URL('dist/',root);
for(const file of await readdir(source)){
  if(file.endsWith('.js'))new vm.Script(await readFile(new URL(file,source),'utf8'),{filename:file});
}
const html=await readFile(new URL('index.html',source),'utf8');
for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
if(!html.includes('catalog.js') || html.includes('const items=['))throw new Error('Catalog must load from Supabase');
const config=await readFile(new URL('config.js',source),'utf8');
if(!config.includes('sb_publishable_') || config.includes('sb_secret_') || config.includes('service_role'))throw new Error('Only the public Supabase key belongs in the website');
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
await cp(source,output,{recursive:true});
console.log('Built dist/ with the public Supabase catalog configuration.');
