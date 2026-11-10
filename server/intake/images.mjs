import sharp from 'sharp';
import {checkDimensions,IMAGE_MAX_PIXELS,PHOTO_MAX_EDGE,PHOTO_TARGET_BYTES} from '../../site/newlisting/photo-policy.mjs';

const formats={'image/jpeg':'jpeg','image/png':'png','image/webp':'webp'};
const invalid=()=>Object.assign(Error('No se pudo comprobar la imagen. Usá otra copia JPG, PNG o WebP.'),{status:422});
const pipeline=bytes=>sharp(bytes,{limitInputPixels:IMAGE_MAX_PIXELS,failOn:'warning',sequentialRead:true});
async function metadata(bytes,type){
  const info=await pipeline(bytes).metadata();
  if(info.format!==formats[type]||(info.pages||1)>1)throw invalid();
  checkDimensions(info.width,info.height);
  return info;
}
export async function inspectImage(bytes,type){
  try{
    const info=await metadata(bytes,type);
    // Metadata alone accepts files whose image payload is corrupt or truncated.
    await pipeline(bytes).resize(1,1,{fit:'inside'}).raw().toBuffer();
    return {width:info.width,height:info.height};
  }catch{throw invalid();}
}
export async function optimizePhoto(bytes,type){
  try{
    await metadata(bytes,type);
    let result;
    for(const quality of [85,76,66]){
      result=await pipeline(bytes).rotate().resize({width:PHOTO_MAX_EDGE,height:PHOTO_MAX_EDGE,fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).jpeg({quality,mozjpeg:true}).toBuffer();
      if(result.length<=PHOTO_TARGET_BYTES)break;
    }
    return result;
  }catch{throw invalid();}
}

// Derived paths cannot be requested by the upload API's restricted file IDs.
export const publicPhotoPath=path=>path+'/web-v1.jpg';
