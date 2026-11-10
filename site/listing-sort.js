/* Sorting changes the list only; map membership and property filters stay independent. */
(() => {
  const modes=['explore','price-asc','price-desc','unit-asc','area-desc'];
  function create(items,pricing,{storage,seed}={}){
    if(storage===undefined)try{storage=window.sessionStorage;}catch{}
    const read=key=>{try{return storage?.getItem(key);}catch{return null;}};
    const write=(key,value)=>{try{storage?.setItem(key,String(value));}catch{}};
    const key='arenalindex.browse-order';
    // One seed per tab session keeps refreshes and returns from listings stable.
    const saved=read(key+'.seed');
    seed??=saved!==null&&/^\d+$/.test(saved)&&Number(saved)<=0xffffffff?Number(saved):Math.floor(Math.random()*0x100000000);
    write(key+'.seed',seed);
    const rank=new Map(items.map(item=>{
      let hash=2166136261^seed;
      for(const char of item.id){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
      hash^=hash>>>16;hash=Math.imul(hash,0x85ebca6b);hash^=hash>>>13;hash=Math.imul(hash,0xc2b2ae35);hash^=hash>>>16;
      return [item.id,hash>>>0];
    }));
    const available=mode=>modes.includes(mode)&&(!mode.startsWith('price-')&&mode!=='unit-asc'||!!pricing.rate);
    let mode=available(read(key+'.mode'))?read(key+'.mode'):'explore';
    function set(next){if(!available(next))return false;mode=next;write(key+'.mode',mode);return true;}
    const tie=(a,b)=>(rank.get(a.id)??0)-(rank.get(b.id)??0)||(a.id<b.id?-1:a.id>b.id?1:0);
    function order(list,currency='USD'){
      const value=item=>mode==='area-desc'?item.area:pricing.view(item,currency)[mode==='unit-asc'?'unit':'price'];
      return [...list].sort((a,b)=>{
        if(mode==='explore')return tie(a,b);
        const av=value(a),bv=value(b),delta=av-bv;
        // Converted equivalents retain the same tie order in either currency.
        if(Math.abs(delta)<=Number.EPSILON*8*Math.max(1,Math.abs(av),Math.abs(bv)))return tie(a,b);
        return delta*(mode==='price-desc'||mode==='area-desc'?-1:1);
      });
    }
    return Object.freeze({get mode(){return mode;},available,set,order});
  }
  window.ArenalListingSort=Object.freeze({create});
})();
