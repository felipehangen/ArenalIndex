/* The browser receives only published catalog data, never database write credentials. */
(() => {
  const safeImage = value => typeof value === 'string' &&
    (/^photos\/[a-z0-9-]+\.(jpg|png|webp)$/i.test(value) || /^https:\/\//i.test(value));
  function normalize(row) {
    const price=Number(row.price),area=Number(row.area),lng=Number(row.lng),lat=Number(row.lat);
    if (typeof row.id!=='string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(row.id) || typeof row.name!=='string' || !row.name.trim() ||
        !Number.isFinite(price) || price<0 || !Number.isFinite(area) || area<=0 ||
        !Number.isFinite(lng) || Math.abs(lng)>180 || !Number.isFinite(lat) || Math.abs(lat)>90) {
      throw new Error('Invalid property in catalog');
    }
    const demo=row.is_demo===true;
    const images=Array.isArray(row.images)?row.images.filter(safeImage):[];
    if (!images.length) images.push(demo?'photos/lot.jpg':'icons/no-photo.svg');
    return {id:row.id,name:row.name,description:row.description||'',place:row.place||'La Fortuna',
      price,area,coordinates:[lng,lat],house:row.house===true,volcano:row.volcano===true,river:row.river===true,
      water:row.water===true,electricity:row.electricity===true,well:row.well===true,
      privateResidential:row.private_residential===true,approximate:row.approximate===true,
      isDemo:demo,images,icon:row.house?'house':'trees'};
  }
  async function load() {
    const {supabaseUrl,publishableKey}=window.ArenalConfig||{};
    if (!supabaseUrl || !publishableKey) throw new Error('Missing public catalog configuration');
    const rows=[],size=1000;
    for(let offset=0;;offset+=size){
      const query=new URLSearchParams({select:'id,name,description,place,price,area,lng,lat,house,volcano,river,water,electricity,well,private_residential,approximate,images,is_demo',status:'eq.published',order:'sort_order.asc,id.asc',limit:String(size),offset:String(offset)});
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
  }
  window.ArenalData=Object.freeze({load,normalize});
})();
