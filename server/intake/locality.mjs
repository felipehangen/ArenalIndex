import {createHash} from 'node:crypto';
export function localityLabel(address={}){
  const name=address.village||address.hamlet||address.town||address.city||address.suburb||address.municipality||address.county;
  const district=address.city_district||address.municipality;
  return typeof name==='string'?[name,typeof district==='string'&&district!==name?district:null].filter(Boolean).join(' · ').slice(0,100):'';
}
export function createLocalityResolver({repository,fetcher=fetch,now=Date.now}){
  return async values=>{
    const lat=Number(values.lat),lng=Number(values.lng);
    if(!values.lat||!values.lng||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return null;
    const coordinate=lat.toFixed(4)+','+lng.toFixed(4),key=createHash('sha256').update(coordinate).digest('hex');
    try{
      const cached=await repository.portalGet('geocodes',key);if(cached)return cached.result;
      const lockKey=createHash('sha256').update('nominatim-shared-lock').digest('hex');
      let lock=await repository.portalGet('geocodes',lockKey);
      if(!lock){await repository.portalCreate('geocodes',lockKey,{nextAt:0});lock=await repository.portalGet('geocodes',lockKey);}
      if(!lock||lock.nextAt>now())return null;
      const lease=now()+10000;
      if(!await repository.portalUpdate('geocodes',lockKey,{nextAt:lock.nextAt},{nextAt:lease}))return null;
      const url=new URL('https://nominatim.openstreetmap.org/reverse');url.search=new URLSearchParams({format:'jsonv2',lat:String(lat),lon:String(lng),zoom:'14','accept-language':'es'});
      try{
        const response=await fetcher(url,{headers:{'User-Agent':'ArenalIndex/1.0 (https://arenalindex.com)','Accept':'application/json'},signal:AbortSignal.timeout(5000)});
        if(!response.ok)return null;const data=await response.json(),place=localityLabel(data.address);if(!place)return null;
        const result={place,source:'OpenStreetMap',coordinate};await repository.portalCreate('geocodes',key,{result},7);return result;
      }finally{await repository.portalUpdate('geocodes',lockKey,{nextAt:lease},{nextAt:now()+1100});}
    }catch{return null;}
  };
}
