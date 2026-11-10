/* Anonymous first-party activity. No form values, account pages, or private URLs. */
(() => {
  'use strict';
  const w=window,d=document,n=navigator;
  const allowed=()=>['arenalindex.com','www.arenalindex.com'].includes(w.location.hostname)&&['/','/publicar/'].includes(w.location.pathname)&&!w.ArenalPreview&&n.doNotTrack!=='1'&&!n.globalPrivacyControl&&!n.webdriver;
  const read=(storage,key)=>{try{return JSON.parse(storage.getItem(key)||'null');}catch{return null;}};
  const write=(storage,key,value)=>{try{storage.setItem(key,JSON.stringify(value));}catch{}};
  let local,session;try{local=w.localStorage;session=w.sessionStorage;}catch{}
  const admin=()=>read(session,'arenalindex.admin-session')?.expiresAt>Date.now();
  if(!allowed()||admin()||!w.crypto?.getRandomValues)return;
  const random=()=>[...w.crypto.getRandomValues(new Uint8Array(16))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  const visitorKey='arenalindex.analytics-visitor',visitKey='arenalindex.analytics-visit';
  let visitor=read(local,visitorKey);
  if(!visitor||!(/^[a-f0-9]{32}$/).test(visitor.id)||visitor.expiresAt<Date.now()){visitor={id:random(),expiresAt:Date.now()+90*86400000};write(local,visitorKey,visitor);}
  let visit=read(session,visitKey),events=[],clicks=0,activeMs=0,lastTick=Date.now(),lastInteraction=Date.now(),pending=[],sending=false,started=false,savedState=[];
  const device=()=>w.innerWidth<600?'mobile':w.innerWidth<960?'tablet':'desktop';
  function publicPhoto(src){
    if(typeof src!=='string')return null;
    if(/^\/?photos\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(src))return '/'+src.replace(/^\//,'');
    try{
      const url=new URL(src),id=url.searchParams.get('id'),photo=url.searchParams.get('photo'),version=url.searchParams.get('version');
      if(url.origin==='https://arenalindex-intake.vercel.app'&&url.pathname==='/api/listings'&&/^[a-zA-Z0-9-]{8,80}$/.test(id||'')&&/^[a-zA-Z0-9-]{1,100}$/.test(photo||'')&&/^\d{1,9}$/.test(version||''))return url.origin+url.pathname+'?'+new URLSearchParams({id,photo,version});
    }catch{}
    return null;
  }
  let referrer='';try{referrer=new URL(d.referrer).origin;}catch{}
  const canTrack=()=>allowed()&&!admin();
  function ensureVisit(){
    const now=Date.now();
    if(!visit||!(/^[a-f0-9]{32}$/).test(visit.id)||now-visit.last>30*60000){
      if(visit&&started)enqueue();
      visit={id:random(),last:now,referrer};events.push({type:'page_view',page:w.location.pathname,at:new Date(now).toISOString()});
    }
    visit.last=now;write(session,visitKey,visit);
  }
  function tick(){const now=Date.now();if(started&&!d.hidden&&canTrack())activeMs+=Math.max(0,Math.min(now-lastTick,10000,lastInteraction+60000-lastTick));lastTick=now;}
  function activity(){if(!started||!canTrack())return;tick();ensureVisit();lastInteraction=Date.now();}
  function track(type,listing,extra={}){
    if(!started||!canTrack())return;
    activity();if(events.length>=50)enqueue();
    events.push({type,at:new Date().toISOString(),...(listing?.id?{listingId:listing.id}:{}),...extra});
  }
  function enqueue(){
    if(!visit||!canTrack()||(!events.length&&!clicks&&!activeMs))return;
    const stored=read(local,'arenalindex.saved');
    const saved=(Array.isArray(stored)?stored:w.arenalDemo?.state.saved||savedState).filter(id=>typeof id==='string').slice(0,500);
    pending.push({id:random(),visit:visit.id,visitor:visitor.id,sentAt:new Date().toISOString(),events,clicks,activeMs:Math.min(120000,Math.round(activeMs)),saved,device:device(),language:w.ArenalI18n?.language||'es',referrer:visit.referrer??referrer});
    if(pending.length>5)pending.shift();events=[];clicks=0;activeMs=0;
  }
  async function send(){
    if(sending||!canTrack())return;sending=true;
    try{
      while(pending.length&&canTrack()){
        const batch=pending[0];
        const endpoint=new URL('analytics',w.ArenalConfig.intakeUrl).href;
        const response=await w.fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(batch),credentials:'omit',keepalive:true,signal:AbortSignal.timeout(12000)});
        if(response.ok||response.status===400||response.status===413)pending.shift();else break;
      }
    }catch{}finally{sending=false;}
  }
  function flush(){tick();enqueue();void send();}
  w.ArenalAnalytics=Object.freeze({
    track,
    start(saved=[]){if(started||!canTrack())return;savedState=Array.isArray(saved)?saved:[];ensureVisit();if(!events.length)events.push({type:'page_view',page:w.location.pathname,at:new Date().toISOString()});started=true;flush();},
    saved(listing,isSaved){track(isSaved?'save':'remove_save',listing);},
    photo(type,listing,src){const photo=publicPhoto(src);if(photo)track(type,listing,{photo});}
  });
  d.addEventListener('click',event=>{
    if(!started||!canTrack()||event.isTrusted===false)return;activity();clicks=Math.min(clicks+1,1000);
    const link=event.target.closest?.('a[href]');if(!link)return;
    const href=link.getAttribute('href')||'',channel=href.startsWith('https://wa.me/')?'whatsapp':href.startsWith('tel:')?'phone':href.startsWith('mailto:')?'email':null;
    if(channel){const match=w.location.hash.match(/^#propiedad\/([a-z0-9-]+)$/);track('contact',match?{id:match[1]}:null,{channel});flush();}
  },true);
  for(const event of ['pointerdown','keydown','scroll'])d.addEventListener(event,activity,{passive:true,capture:true});
  d.addEventListener('visibilitychange',()=>{if(d.hidden)flush();else{lastTick=Date.now();lastInteraction=Date.now();}});
  w.addEventListener('pagehide',flush);
  w.setInterval(tick,5000);w.setInterval(flush,60000);
  // Count public page loads even if the catalog is slow or unavailable.
  const start=()=>w.ArenalAnalytics.start(read(local,'arenalindex.saved')||[]);
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
