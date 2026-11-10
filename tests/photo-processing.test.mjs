import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {imageDimensions,photoSize,photoWarnings} from '../site/newlisting/photo-policy.mjs';
import {prepareAttachment,addAttachments} from '../site/newlisting/photos.mjs';
import {inspectImage,optimizePhoto} from '../server/intake/images.mjs';
import {createRepository} from '../server/intake/blob.mjs';
import {validateDraft,newDraft,MAX_TOTAL} from '../site/newlisting/model.mjs';

const source=(width=1600,height=1200)=>sharp({create:{width,height,channels:3,background:'#348065'}});
const file=(bytes,type='image/png',name='property.png')=>new File([bytes],name,{type});

test('dimension guards support JPEG, PNG and both WebP encodings before browser decoding',async()=>{
  for(const [format,options,type] of [['png',{},'image/png'],['jpeg',{},'image/jpeg'],['webp',{},'image/webp'],['webp',{lossless:true},'image/webp']]){
    const bytes=await source(128,72).toFormat(format,options).toBuffer();
    assert.deepEqual(imageDimensions(bytes,type),{width:128,height:72});
  }
  assert.deepEqual(photoSize(8000,6000),{width:2000,height:1500});
  assert.deepEqual(photoSize(600,900),{width:600,height:900});
  assert.throws(()=>photoSize(10000,10000),/megapíxeles/);
  assert.throws(()=>photoSize(17000,1),/megapíxeles/);
  assert.throws(()=>imageDimensions(new Uint8Array(40),'image/jpeg'),/tamaño/);
  assert.equal(photoWarnings({width:2000,height:500}).length,1);
  assert.equal(photoWarnings({width:640,height:480}).length,1);
});

test('server optimization preserves the whole frame, fixes camera orientation, strips metadata and never upscales',async()=>{
  const original=await source(80,40).withMetadata({orientation:6}).jpeg().toBuffer();
  assert.ok((await sharp(original).metadata()).exif);
  const optimized=await optimizePhoto(original,'image/jpeg'),info=await sharp(optimized).metadata();
  assert.equal(info.width,40);assert.equal(info.height,80);assert.equal(info.exif,undefined);assert.equal(info.icc,undefined);assert.equal(info.orientation,undefined);
  const large=await source(4000,3000).png().toBuffer(),result=await optimizePhoto(large,'image/png'),meta=await sharp(result).metadata();
  assert.equal(meta.width,2000);assert.equal(meta.height,1500);assert.equal(meta.format,'jpeg');
  assert.deepEqual(await inspectImage(result,'image/jpeg'),{width:2000,height:1500});
  const transparent=await sharp({create:{width:10,height:10,channels:4,background:'#00000000'}}).png().toBuffer();
  const pixels=await sharp(await optimizePhoto(transparent,'image/png')).raw().toBuffer();
  assert.ok(pixels.every(value=>value>=250));
});

test('server validation fully decodes images and rejects wrong types, huge headers and truncated payloads',async()=>{
  const bytes=await source().jpeg().toBuffer();
  await assert.rejects(inspectImage(bytes,'image/png'),{status:422});
  await assert.rejects(inspectImage(bytes.subarray(0,bytes.length-200),'image/jpeg'),{status:422});
  await assert.rejects(optimizePhoto(bytes.subarray(0,bytes.length-200),'image/jpeg'),{status:422});
  const huge=await source(10,10).png().toBuffer();huge.writeUInt32BE(100000,16);
  await assert.rejects(inspectImage(huge,'image/png'),{status:422});
});

// Exercise the upload code with real image decoding/encoding through a small
// canvas adapter. Real-browser checks remain separate from these unit tests.
function canvasEnvironment(t){
  const before={document:globalThis.document,createImageBitmap:globalThis.createImageBitmap};let decodes=0,closes=0;
  t.after(()=>Object.assign(globalThis,before));
  globalThis.createImageBitmap=async(blob,options)=>{
    decodes++;assert.equal(options.imageOrientation,'from-image');
    const {data,info}=await sharp(Buffer.from(await blob.arrayBuffer())).rotate().raw().toBuffer({resolveWithObject:true});
    return {width:info.width,height:info.height,data,info,close(){closes++;}};
  };
  globalThis.document={createElement(tag){
    assert.equal(tag,'canvas');let bitmap;
    return {width:0,height:0,getContext(){return {fillRect(){},drawImage(value){bitmap=value;}};},toBlob(callback,type,quality){
      sharp(bitmap.data,{raw:bitmap.info}).resize(this.width,this.height).flatten({background:'#fff'}).jpeg({quality:Math.round(quality*100)}).toBuffer().then(bytes=>callback(new Blob([bytes],{type})),()=>callback(null));
    }};
  }};
  return {get decodes(){return decodes;},get closes(){return closes;}};
}

test('uploads optimize before applying the listing budget, preserve documents, skip duplicates and retain valid files in a mixed batch',async t=>{
  const env=canvasEnvironment(t),raw=await source(3000,2000).png().toBuffer();
  // A large camera file is accepted locally and its compressed size is counted.
  const padded=Buffer.concat([raw,Buffer.alloc(13*1024*1024)]),photo=file(padded);
  const draft=newDraft();draft.files=[{id:'existing-plan',category:'plan_file',type:'application/pdf',size:MAX_TOTAL-100000}];
  const progress=[],result=await addAttachments(draft,[photo,photo,file(Buffer.from('corrupt'))],'land',(i,total)=>progress.push([i,total]));
  assert.equal(result.added,1);assert.equal(result.messages.length,2);assert.match(result.messages[0].message,/ya está/);
  assert.equal(draft.files[1].type,'image/jpeg');assert.equal(draft.files[1].width,2000);assert.equal(draft.files[1].height,1333);assert.ok(draft.files[1].size<100000);assert.equal(draft.files[1].contentHash.length,64);
  assert.equal(env.decodes,env.closes);assert.equal(progress.length,3);
  const document=file(raw),prepared=await prepareAttachment(document,'plan_file');assert.equal(prepared.blob,document);assert.equal(prepared.size,raw.length);
  const pdf=file(Buffer.from('%PDF-1.7 test'),'application/pdf','plan.pdf');assert.equal((await prepareAttachment(pdf,'plan_file')).blob,pdf);
  await assert.rejects(prepareAttachment(pdf,'land'),/JPG/);
  const clean=newDraft();clean.files=[draft.files[1]];const saved=validateDraft(clean);assert.equal(saved.files[0].width,2000);assert.equal(saved.files[0].contentHash,draft.files[1].contentHash);
});

test('oversized source images fail before bitmap allocation; failed encoding closes the bitmap',async t=>{
  const env=canvasEnvironment(t);
  await assert.rejects(prepareAttachment({size:33*1024*1024,type:'image/jpeg'},'land'),/32 MB/);
  const png=await source(10,10).png().toBuffer();png.writeUInt32BE(100000,16);
  await assert.rejects(prepareAttachment(file(png),'land'),/megapíxeles/);assert.equal(env.decodes,0);
  globalThis.document.createElement=()=>({getContext:()=>null});
  await assert.rejects(prepareAttachment(file(await source(10,10).png().toBuffer()),'land'),/preparar/);assert.equal(env.closes,1);
});

test('private storage validates real contents and creates immutable public derivatives without modifying source files',async()=>{
  const original=await source(3000,2000).withMetadata({orientation:6}).jpeg().toBuffer();
  const rows=new Map([['files/property/1/photo',{data:original,type:'image/jpeg'}]]),writes=[];
  const sdk={async get(path){const row=rows.get(path);return row?{stream:new Blob([row.data]).stream(),blob:{size:row.data.length,contentType:row.type}}:null;},async put(path,data,options){writes.push(path);assert.equal(options.access,'private');assert.equal(options.allowOverwrite,false);rows.set(path,{data,type:options.contentType});}};
  const repository=createRepository({sdk}),file={size:original.length,type:'image/jpeg'};
  assert.ok(await repository.inspectFile('property/1/photo',file));
  const result=await repository.publicPhoto('property/1/photo',file);assert.equal(result.path,'property/1/photo/web-v1.jpg');
  assert.deepEqual(await repository.publicPhoto('property/1/photo',file),result);assert.equal(writes.length,1);assert.equal(rows.get('files/property/1/photo').data,original);
  const info=await sharp(rows.get('files/'+result.path).data).metadata();assert.equal(info.height,2000);assert.equal(info.width,1333);assert.equal(info.exif,undefined);
  rows.set('files/broken',{data:original.subarray(0,500),type:'image/jpeg'});
  assert.equal(await repository.inspectFile('broken',{size:500,type:'image/jpeg'}),null);
  await assert.rejects(repository.publicPhoto('broken',{size:500,type:'image/jpeg'}),{status:422});
  assert.equal(await repository.inspectFile('property/1/photo',{...file,size:file.size-1}),null);
});
