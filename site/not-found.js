/* One recovery page for unknown routes and missing collections. */
(() => {
  const page=document.getElementById('arenal-not-found');
  function metadata(){
    document.title=(window.ArenalI18n?.t('Fuera del mapa')||'Fuera del mapa')+' · ArenalIndex';
  }
  function show(){
    if(!page)return;
    const first=page.hidden;
    page.hidden=false;
    const app=document.querySelector('.local-app');if(app)app.hidden=true;
    document.querySelector('link[rel="canonical"]')?.removeAttribute('href');
    let robots=document.querySelector('meta[name="robots"]');
    if(!robots){robots=document.createElement('meta');robots.name='robots';document.head.append(robots);}
    robots.content='noindex,follow';
    metadata();
    window.ArenalI18n?.translate(page);
    if(first)page.querySelector('h1').focus({preventScroll:true});
  }
  window.ArenalNotFound=Object.freeze({show});
  window.addEventListener('arenal-language-change',()=>{if(page&&!page.hidden)metadata();});
  if(page&&!page.hidden)show();
})();
