/* Original asking prices never change. All browsing uses one dated rate snapshot. */
(() => {
  const currencies=['USD','CRC'];
  function validRate(rate){
    return rate?.source==='BCCR' && rate.method==='midpoint' &&
      Number.isFinite(rate.buy) && Number.isFinite(rate.sell) && rate.buy>0 && rate.sell>=rate.buy &&
      /^\d{4}-\d{2}-\d{2}$/.test(rate.date) && Number.isFinite(Date.parse(rate.date)) &&
      new Date(rate.date).toISOString().slice(0,10)===rate.date;
  }
  function create(items,record=window.ArenalExchangeRate){
    const rate=validRate(record)?Object.freeze({...record}):null;
    const midpoint=rate?(rate.buy+rate.sell)/2:null,cache=new WeakMap();
    const stale=!!rate&&(!Number.isFinite(Date.parse(rate.checkedAt))||Date.now()-Date.parse(rate.checkedAt)>48*3600000);
    const currency=value=>currencies.includes(value)?value:'USD';
    function convert(value,from,to){
      if(!Number.isFinite(value)||!currencies.includes(from)||!currencies.includes(to))return null;
      if(from===to)return value;
      return midpoint===null?null:from==='USD'?value*midpoint:value/midpoint;
    }
    function view(item,target='USD'){
      target=currency(target);
      if(!cache.has(item))cache.set(item,new Map());
      const prices=cache.get(item);
      if(!prices.has(target)){
        const converted=convert(item.price,item.currency,target),unavailable=converted===null;
        const price=unavailable?item.price:converted;
        prices.set(target,Object.freeze({price,unit:Number.isFinite(price)&&item.area>0?price/item.area:null,
          currency:unavailable?item.currency:target,approximate:!unavailable&&item.currency!==target,unavailable}));
      }
      return prices.get(target);
    }
    const capsCache=new Map();
    function caps(target){
      target=currency(target);
      if(!capsCache.has(target)){
        const prices=items.map(item=>view(item,target)).filter(p=>!p.unavailable);
        const step=target==='CRC'?1000000:5000;
        capsCache.set(target,Object.freeze({
          price:Math.ceil(Math.max(target==='CRC'?150000000:300000,...prices.map(p=>p.price))/step)*step,
          unit:Math.ceil(Math.max(target==='CRC'?250000:500,...prices.map(p=>p.unit)))
        }));
      }
      return capsCache.get(target);
    }
    function switchCurrency(filters,target){
      target=currency(target);
      const from=currency(filters.currency),oldCaps=caps(from),newCaps=caps(target);
      const next={...filters,currency:target};
      for(const key of ['price','unit'])next[key]=filters[key].map((value,i)=>
        i===1&&value===oldCaps[key]?newCaps[key]:convert(value,from,target)??(i?newCaps[key]:0));
      return next;
    }
    const inside=(value,range)=>{
      const tolerance=Number.EPSILON*8*Math.max(1,Math.abs(value),...range.map(Math.abs));
      return value>=range[0]-tolerance&&value<=range[1]+tolerance;
    };
    function matchesPrice(item,filters){
      // Missing rate must never turn the catalog into an empty or partial result set.
      if(!rate)return true;
      const p=view(item,filters.currency);
      return inside(p.price,filters.price)&&inside(p.unit,filters.unit);
    }
    function note(){
      if(!rate)return 'Conversión no disponible. Mostramos las monedas originales; los filtros de precio están temporalmente desactivados.';
      const date=new Intl.DateTimeFormat('es-CR',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(rate.date));
      const amount=new Intl.NumberFormat('en-US',{maximumFractionDigits:3}).format(midpoint);
      return `${stale?'Último tipo disponible. ':''}≈ Conversión orientativa: USD 1 = ₡${amount}. Promedio de compra y venta del BCCR · ${date}.`;
    }
    // Prepare both currencies once; slider movement reuses these values.
    for(const item of items)for(const target of currencies)view(item,target);
    return Object.freeze({rate,stale,midpoint,view,caps,convert,switchCurrency,matchesPrice,note});
  }
  window.ArenalPricing=Object.freeze({create,validRate});
})();
