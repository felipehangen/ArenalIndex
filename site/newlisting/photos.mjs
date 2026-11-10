import {MAX_FILE,MAX_TOTAL,TYPES,photoGroups,validSignature} from './model.mjs';
import {PHOTO_INPUT_BYTES,PHOTO_TARGET_BYTES,imageDimensions,photoSize} from './photo-policy.mjs';

export const isTourPhoto=file=>file.type.startsWith('image/')&&photoGroups.some(group=>group.id===file.category);
export async function contentHash(blob){
  const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function prepareAttachment(file,category){
  const photo=photoGroups.some(group=>group.id===category),limit=photo?PHOTO_INPUT_BYTES:MAX_FILE;
  if(!TYPES.includes(file.type)||photo&&!file.type.startsWith('image/'))throw Error(photo?'Usá fotos JPG, PNG o WebP. Exportá HEIC como JPG.':'Usá JPG, PNG, WebP o PDF de hasta 12 MB.');
  if(file.size<1||file.size>limit)throw Error(photo?'La foto supera 32 MB. Usá una copia más pequeña.':'Usá JPG, PNG, WebP o PDF de hasta 12 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(!validSignature(file.type,bytes,bytes.length))throw Error('No se reconoció el contenido del archivo.');
  let blob=file,width,height;
  if(file.type.startsWith('image/')){
    imageDimensions(bytes,file.type);
    let bitmap,canvas;
    try{
      bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
      ({width,height}=photo?photoSize(bitmap.width,bitmap.height):{width:bitmap.width,height:bitmap.height});
      if(photo){
        canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
        const context=canvas.getContext('2d');if(!context)throw Error('canvas');
        context.fillStyle='#fff';context.fillRect(0,0,width,height);
        context.drawImage(bitmap,0,0,width,height);
        // Re-encoding drops EXIF/GPS and bakes the camera orientation into pixels.
        for(const quality of [.85,.76,.66]){
          blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
          if(!blob||blob.type!=='image/jpeg')throw Error('encode');
          if(blob.size<=PHOTO_TARGET_BYTES)break;
        }
        if(blob.size>MAX_FILE)throw Error('encode');
      }
    }catch{throw Error('No se pudo preparar la imagen. Probá con otra copia JPG, PNG o WebP.');}
    finally{bitmap?.close();if(canvas){canvas.width=1;canvas.height=1;}}
  }
  return {blob,name:photo?file.name.replace(/\.[^.]*$/,'').slice(0,245)+'.jpg':file.name,type:blob.type,size:blob.size,...(width?{width,height}:{}),...(photo?{contentHash:await contentHash(blob)}:{})};
}

export async function addAttachments(draft,selected,category,onProgress=()=>{}){
  const messages=[];let added=0;
  for(const [index,file] of Array.from(selected).entries()){
    onProgress(index+1,selected.length);
    try{
      if(draft.files.length>=120)throw Error('El máximo es 120 archivos por ficha.');
      const prepared=await prepareAttachment(file,category);
      if(prepared.contentHash){
        let duplicate=false;
        for(const existing of draft.files.filter(isTourPhoto)){
          const hash=existing.contentHash||await contentHash(existing.blob);
          if(hash===prepared.contentHash){duplicate=true;break;}
        }
        if(duplicate)throw Error('Esta foto ya está en la ficha. Podés cambiar su grupo sin subirla otra vez.');
      }
      if(draft.files.reduce((sum,f)=>sum+f.size,0)+prepared.size>MAX_TOTAL)throw Error('La ficha supera 60 MB.');
      draft.files.push({id:crypto.randomUUID(),category,shot:'general',perspective:'ground',buildingId:'',...prepared});added++;
    }catch(error){messages.push({name:file.name,message:error.message});}
  }
  return {added,messages};
}
