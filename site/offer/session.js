/* Tab-local offer drafts and return links. No draft data is sent to the server. */
(() => {
  if(typeof window==='undefined')return;
  function tokenKind(value){
    if(typeof value!=='string')return null;
    if(/^l\.[A-Za-z0-9_-]{22}$/.test(value))return 'listing';
    if(/^(?:(?:listing|receipt)\.)?[a-f0-9]{64}\.[a-f0-9]{64}$/.test(value))return value.startsWith('listing.')?'listing':value.startsWith('receipt.')?'receipt':'legacy';
    return null;
  }
  const tokenOK=value=>!!tokenKind(value);
  const idOK=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9-]{0,79}$/.test(value);
  function create({storage,history=window.history}={}){
    if(!storage)try{storage=window.sessionStorage;}catch{}
    const key=token=>'arenalindex.simple-offer:'+token,returnKey=id=>'arenalindex.offer-return:'+id;
    const read=key=>{try{return JSON.parse(storage?.getItem(key)||'null');}catch{return null;}};
    const write=(key,value)=>{try{if(!storage)return false;storage.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
    const remove=key=>{try{storage?.removeItem(key);}catch{}};
    function load(token){if(!tokenOK(token))return null;const saved=read(key(token));if(saved)return saved;const backup=history?.state?.arenalOffer;return backup?.token===token?backup.snapshot:null;}
    function save(token,snapshot){
      if(!tokenOK(token))return false;const stored=write(key(token),snapshot);let backed=false;
      try{history.replaceState({...history.state,arenalOffer:{token,snapshot}},'');backed=true;}catch{}
      return stored||backed;
    }
    function returnFor(id){
      if(!idOK(id))return null;
      const bridge=history?.state?.arenalOfferBridge,context=read(returnKey(id))||(bridge?.id===id?bridge:null);
      if(!context||context.id!==id||!tokenOK(context.token)||context.token.startsWith('receipt.'))return null;
      const href='/offer/#'+context.token;
      const snapshot=load(context.token)||context.snapshot;
      return {...context,snapshot,hasDraft:!!snapshot?.hasDraft,href:'/offer/#'+context.token};
    }
    function visitListing(token,id,snapshot){
      if(!tokenOK(token)||!idOK(id)||token.startsWith('receipt.'))return false;
      save(token,snapshot);
      const context={id,token};
      if(write(returnKey(id),context)){window.location.assign('/#propiedad/'+id);return true;}
      // History state provides a same-tab fallback when sessionStorage is blocked.
      try{history.pushState({arenalOfferBridge:{...context,snapshot}},'','/#propiedad/'+id);window.location.reload();return true;}catch{return false;}
    }
    function returnToOffer(context){
      if(!context||!tokenOK(context.token))return false;
      const href='/offer/#'+context.token;
      const snapshot=load(context.token)||context.snapshot;
      const resumed=snapshot?{...snapshot,screen:snapshot.hasDraft?(snapshot.resumeScreen||'draft'):'welcome'}:null;
      if(resumed&&write(key(context.token),resumed)){window.location.assign(href);return true;}
      try{history.pushState({arenalOffer:{token:context.token,snapshot:resumed}},'',href);window.location.reload();return true;}catch{return false;}
    }
    function clear(token,id){remove(key(token));if(id&&returnFor(id)?.token===token)remove(returnKey(id));try{const state={...history.state};delete state.arenalOffer;delete state.arenalOfferBridge;history.replaceState(state,'');}catch{}}
    return {load,save,returnFor,visitListing,returnToOffer,clear};
  }
  window.ArenalOfferSession={create,tokenKind};
})();
