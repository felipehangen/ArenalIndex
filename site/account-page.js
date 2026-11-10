/* Account pages use the main explorer; only the public data source and identity change. */
(() => {
  const params=new URLSearchParams(window.location.search);
  const route=window.location.pathname.match(/^\/collection\/([a-z0-9][a-z0-9-]{0,99})\/?$/);
  const active=params.has('account')||/^\/(?:collection|properties)(?:\/|$)/.test(window.location.pathname);
  const key=route?.[1]||params.get('account')||'';
  let profile=null,missing=false;
  const t=text=>window.ArenalI18n?.t(text)||text;
  const strip=document.getElementById('account-identity');
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(){
    if(!active||!strip)return;
    strip.hidden=false;
    const name=profile?.name||t(missing?'Página no disponible':'Cargando propiedades…');
    strip.querySelector('#account-name').textContent=name;
    strip.querySelector('.account-monogram').textContent=profile?profile.name.trim().split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]).join('').toLocaleUpperCase():'·';
    strip.querySelector('.account-note').textContent=t(missing?'Esta página no está disponible. Podés explorar el catálogo completo.':'Contacto de venta en cada anuncio.');
    if(profile){
      document.title=profile.name+' · ArenalIndex';
      document.querySelector('link[rel="canonical"]').href=profile.url;
      document.querySelector('meta[name="description"]').content=t('Propiedades de')+' '+profile.name+' · ArenalIndex';
    }
  }
  window.ArenalAccount=Object.freeze({
    active,get profile(){return profile;},get missing(){return missing;},
    async load(endpoint,normalize){
      try{
        if(!/^[a-z0-9][a-z0-9-]{0,99}$/.test(key)){missing=true;throw Error('Account page unavailable');}
        const url=new URL(endpoint);url.searchParams.set('account',key);url.searchParams.delete('catalog');
        const response=await fetch(url,{signal:AbortSignal.timeout(25000),cache:'no-store'});
        if(!response.ok){missing=response.status===404;throw Error('Account page unavailable');}
        const data=await response.json();
        if((data.account?.key!==key&&data.account?.slug!==key)||typeof data.account.name!=='string'||!data.account.name.trim()||!Array.isArray(data.listings))throw Error('Invalid account page');
        const rows=data.listings.map(normalize);
        if(!/^[a-z0-9][a-z0-9-]{0,99}$/.test(data.account.slug||''))throw Error('Invalid collection slug');
        profile={key:data.account.key,slug:data.account.slug,name:data.account.name,url:'https://go.arenalindex.com/collection/'+data.account.slug+'/'};
        render();return rows;
      }catch(error){render();throw error;}
    },
    publicURL(listing){return profile?profile.url+'#propiedad/'+encodeURIComponent(listing.id):null;},
    attribution(){return profile?'<p class="pd-account-attribution"><span>'+t('Propiedades de')+'</span> <strong translate="no">'+esc(profile.name)+'</strong></p>':'';}
  });
  if(active){
    document.getElementById('arenal-index-dos').classList.add('account-page');
    // Avoid presenting the full-catalog canonical while this page is loading.
    document.querySelector('link[rel="canonical"]')?.removeAttribute('href');
    for(const link of document.querySelectorAll('a[href="/cuenta/"],a[href="/publicar/"]'))link.href='https://arenalindex.com'+link.getAttribute('href');
    const contactTitle=document.getElementById('site-menu-contact-title');
    if(contactTitle)contactTitle.textContent=t('Contacto ArenalIndex');
    render();window.addEventListener('arenal-language-change',render);
  }
})();
