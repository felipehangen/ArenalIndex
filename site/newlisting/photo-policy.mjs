export const PHOTO_MAX_EDGE = 2000;
export const PHOTO_INPUT_BYTES = 32 * 1024 * 1024;
export const IMAGE_MAX_PIXELS = 60_000_000;
export const IMAGE_MAX_EDGE = 16384;
export const PHOTO_TARGET_BYTES = 600 * 1024;

export function checkDimensions(width,height){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw Error('No se pudo leer el tamaño de la imagen.');
  if(width*height>IMAGE_MAX_PIXELS||Math.max(width,height)>IMAGE_MAX_EDGE)throw Error('La imagen supera 60 megapíxeles o 16384 píxeles por lado. Usá una copia más pequeña.');
  return {width,height};
}
export function photoSize(width,height){
  checkDimensions(width,height);
  const scale=Math.min(1,PHOTO_MAX_EDGE/Math.max(width,height));
  return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
export function photoWarnings({width,height}){
  if(!width||!height)return [];
  const warnings=[];
  if(Math.max(width,height)<1000||Math.min(width,height)<500)warnings.push('Esta foto tiene poca resolución. Si tenés una copia más nítida, usala.');
  if(Math.max(width,height)/Math.min(width,height)>3)warnings.push('Esta foto es muy alargada. La vista completa se conserva en la galería.');
  return warnings;
}

// Check dimensions before asking the browser to allocate a decoded bitmap.
// This is only a resource guard; both the browser and server also decode images.
export function imageDimensions(bytes,type){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const tag=(offset,length)=>String.fromCharCode(...bytes.subarray(offset,offset+length));
  const le24=offset=>bytes[offset]|bytes[offset+1]<<8|bytes[offset+2]<<16;
  let width,height;
  if(type==='image/png'&&bytes.length>=24&&tag(12,4)==='IHDR'){
    width=view.getUint32(16);height=view.getUint32(20);
  }else if(type==='image/jpeg'){
    for(let offset=2;offset+4<=bytes.length;){
      if(bytes[offset++]!==255)break;
      while(bytes[offset]===255)offset++;
      const marker=bytes[offset++];
      if(marker===0xda||marker===0xd9)break;
      if(marker===0x01||marker>=0xd0&&marker<=0xd7)continue;
      if(offset+2>bytes.length)break;
      const length=view.getUint16(offset);
      if(length<2||offset+length>bytes.length)break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&length>=8){height=view.getUint16(offset+3);width=view.getUint16(offset+5);break;}
      offset+=length;
    }
  }else if(type==='image/webp'&&bytes.length>=25){
    const chunk=tag(12,4);
    if(chunk==='VP8X'&&bytes.length>=30){width=le24(24)+1;height=le24(27)+1;}
    else if(chunk==='VP8 '&&bytes.length>=30&&tag(23,3)==='\x9d\x01\x2a'){width=view.getUint16(26,true)&0x3fff;height=view.getUint16(28,true)&0x3fff;}
    else if(chunk==='VP8L'&&bytes[20]===0x2f){const bits=view.getUint32(21,true);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;}
  }
  return checkDimensions(width,height);
}
