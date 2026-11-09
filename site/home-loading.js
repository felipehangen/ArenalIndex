/* The shell is visible before either the catalog or the map is available. */
(() => {
  const root=document.getElementById('arenal-index-dos'),q=selector=>root.querySelector(selector);
  let catalogDone=false,mapDone=false,mapError=false,mapTimer;
  const sizeShell=()=>{
    const space=q('#index-map-view').clientHeight;
    if(space<=0)return;
    const {min,max}=ArenalSheetBounds(space);
    root.style.setProperty('--sheet-space',max+'px');
    root.style.setProperty('--sheet-height',min+'px');
    root.style.setProperty('--sheet-travel',(max-min)+'px');
  };
  const observer=new ResizeObserver(sizeShell);
  observer.observe(q('#index-map-view'));sizeShell();
  const catalogTimer=setTimeout(()=>{
    if(catalogDone)return;
    q('#catalog-wait').hidden=false;q('#catalog-retry').hidden=false;
  },8000);
  for(const id of ['#catalog-retry','#map-loading-retry'])q(id).onclick=()=>location.reload();
  function finishCatalog(state){
    catalogDone=true;clearTimeout(catalogTimer);
    root.dataset.catalog=state;
    q('#catalog-skeleton').hidden=true;q('#catalog-wait').hidden=true;q('#catalog-retry').hidden=true;
    q('#index-list').setAttribute('aria-busy','false');
  }
  window.ArenalHomeLoading=Object.freeze({
    catalogReady(){
      finishCatalog('ready');observer.disconnect();
      root.querySelectorAll('[data-loading-controls]').forEach(node=>{node.inert=false;});
    },
    catalogFailed(){
      finishCatalog('error');
      q('#index-count').textContent='No pudimos cargar los terrenos';
      q('#catalog-wait').textContent='Revisá tu conexión e intentá de nuevo.';
      q('#catalog-wait').hidden=false;q('#catalog-retry').hidden=false;
      q('#results-more').hidden=true;q('#results-expand').hidden=true;
      clearTimeout(mapTimer);q('#map-loading').hidden=true;
    },
    mapStarted(){
      mapTimer=setTimeout(()=>{
        if(mapDone)return;
        q('#map-loading-message').textContent='El mapa está tardando. Podés explorar la lista.';
        q('#map-loading-retry').hidden=false;
      },10000);
    },
    mapReady(){
      mapDone=true;clearTimeout(mapTimer);
      if(!mapError)q('#map-loading').hidden=true;
    },
    mapFailed(){
      mapDone=true;mapError=true;clearTimeout(mapTimer);
      q('#map-loading').hidden=false;q('#map-loading').dataset.state='error';
      q('#map-loading-message').textContent='No pudimos cargar el mapa. Podés explorar la lista.';
      q('#map-loading-retry').hidden=false;
    }
  });
})();
