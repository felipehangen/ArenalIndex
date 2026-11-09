/* The browser receives only published catalog data, never database write credentials. */
(() => {
  const safeImage = value => typeof value === 'string' &&
    (/^\/?photos\/[a-z0-9-]+\.(jpg|png|webp)$/i.test(value) || /^https:\/\//i.test(value));
  const imagePath=value=>value.startsWith('photos/')?'/'+value:value;
  const text=(value,max=2000)=>typeof value==='string'?value.slice(0,max):'';
  function details(input){
    if(input?.schemaVersion!==1)return null;
    const rows=value=>Array.isArray(value)?value.slice(0,50).map(row=>({label:text(row?.label,160),value:text(row?.value),source:text(row?.source,160)})).filter(row=>row.label&&row.value):[];
    return {schemaVersion:1,
      sections:(Array.isArray(input.sections)?input.sections:[]).slice(0,12).map(s=>({id:text(s?.id,60),title:text(s?.title,160),rows:rows(s?.rows)})),
      buildings:(Array.isArray(input.buildings)?input.buildings:[]).slice(0,30).map(b=>({id:text(b?.id,80),name:text(b?.name,120),rows:rows(b?.rows)})),
      photoGroups:(Array.isArray(input.photoGroups)?input.photoGroups:[]).slice(0,40).map(g=>({id:text(g?.id,100),title:text(g?.title,160),photos:(Array.isArray(g?.photos)?g.photos:[]).filter(p=>safeImage(p?.src)).slice(0,100).map(p=>({id:text(p.id,100),src:imagePath(p.src),caption:text(p.caption,300),perspective:p.perspective==='drone'?'drone':'ground'}))})).filter(g=>g.photos.length),
      conditions:(Array.isArray(input.conditions)?input.conditions:[]).map(v=>text(v)).filter(Boolean).slice(0,40),
      declaredArea:Number(input.declaredArea)||null,documentedArea:Number(input.documentedArea)||null,areaSource:text(input.areaSource,120),entrance:input.entrance===true,
      residential:['no','residential','condo'].includes(input.residential)?input.residential:'unknown',
      contact:/^[1-9]\d{7,14}$/.test(input.contact?.whatsapp||'')?{whatsapp:input.contact.whatsapp}:null
    };
  }
  function normalize(row) {
    const price=Number(row.price),area=Number(row.area),lng=Number(row.lng),lat=Number(row.lat);
    if (typeof row.id!=='string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(row.id) || typeof row.name!=='string' || !row.name.trim() ||
        !Number.isFinite(price) || price<0 || !Number.isFinite(area) || area<=0 ||
        !Number.isFinite(lng) || Math.abs(lng)>180 || !Number.isFinite(lat) || Math.abs(lat)>90) {
      throw new Error('Invalid property in catalog');
    }
    const demo=row.is_demo===true,detail=details(row.details),currency=row.currency||'USD';
    if(!['USD','CRC'].includes(currency))throw new Error('Unsupported listing currency');
    const images=Array.isArray(row.images)?row.images.filter(safeImage).map(imagePath):[];
    if (!images.length) images.push(demo?'/photos/lot.jpg':'/icons/no-photo.svg');
    return {id:row.id,name:row.name,description:row.description||'',place:row.place||'La Fortuna',
      price,area,currency,details:detail,coordinates:[lng,lat],house:row.house===true,volcano:row.volcano===true,river:row.river===true,
      water:row.water===true,electricity:row.electricity===true,well:row.well===true,
      privateResidential:detail?.residential==='condo',approximate:row.approximate===true,
      isDemo:demo,images,icon:row.house?'house':'trees'};
  }
  async function load() {
    const {supabaseUrl,publishableKey,listingsUrl}=window.ArenalConfig||{};
    if (!supabaseUrl || !publishableKey) throw new Error('Missing public catalog configuration');
    const loadDatabase=async()=>{
      const rows=[],size=1000;
      for(let offset=0;;offset+=size){
        const query=new URLSearchParams({select:'id,name,description,place,price,currency,area,lng,lat,house,volcano,river,water,electricity,well,private_residential,approximate,images,is_demo,details',status:'eq.published',order:'sort_order.asc,id.asc',limit:String(size),offset:String(offset)});
        const response=await fetch(`${supabaseUrl}/rest/v1/arenalindex_properties?${query}`,{
          headers:{apikey:publishableKey},signal:AbortSignal.timeout(15000),cache:'no-store'
        });
        if(!response.ok)throw new Error(`Catalog request failed (${response.status})`);
        const page=await response.json();
        if(!Array.isArray(page))throw new Error('Invalid catalog response');
        rows.push(...page.map(normalize));
        if(page.length<size)break;
      }
      return rows;
    };
    const loadPublished=async()=>{
      if(!listingsUrl)return [];
      const response=await fetch(listingsUrl,{signal:AbortSignal.timeout(20000),cache:'no-store'});
      if(!response.ok)throw new Error('Published listings unavailable');
      const published=await response.json();
      if(!Array.isArray(published))throw new Error('Invalid published listings');
      return published.map(normalize);
    };
    // Start independent sources together, but never show an incomplete catalog.
    const [rows,published]=await Promise.all([loadDatabase(),loadPublished()]);
    const ids=new Set(rows.map(row=>row.id));
    for(const item of published){if(ids.has(item.id))throw new Error('Duplicate public listing');ids.add(item.id);rows.unshift(item);}
    return rows;
  }
  window.ArenalData=Object.freeze({load,normalize});
})();
