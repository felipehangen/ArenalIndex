/* UI language is independent of currency, measurements, and stored form values. */
(() => {
  const dictionary=window.ArenalEnglish||{},storageKey='arenalindex.language';
  const supported=value=>value==='en'||value==='es';
  let language='es';
  try{const stored=localStorage.getItem(storageKey);language=supported(stored)?stored:(navigator.languages?.[0]||navigator.language||'es').toLowerCase().startsWith('en')?'en':'es';}catch{language=(globalThis.navigator?.language||'es').toLowerCase().startsWith('en')?'en':'es';}
  const patterns=Object.entries(dictionary).filter(([key])=>key.includes('{')).map(([key,value])=>{
    const names=[];const source=key.split(/(\{[a-zA-Z]\w*\})/g).map(part=>{
      if(!/^\{/.test(part))return part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const name=part.slice(1,-1);names.push(name);
      if(['count','shown','current','total','step','version','distance','area','declared','documented','amount'].includes(name))return '([0-9][0-9.,\\s]*?)';
      if(name==='currency')return '(USD|CRC)';
      if(name==='price')return '([₡$0-9][\\s\\S]*?|Por definir)';
      return '([\\s\\S]+?)';
    }).join('');
    return {regex:new RegExp('^'+source+'$'),names,value};
  });
  const interpolate=(text,values)=>text.replace(/\{(\w+)\}/g,(match,key)=>values[key]??match);
  function t(source,values={},target=language){
    source=String(source??'');
    if(target==='es')return interpolate(source,values);
    if(Object.hasOwn(dictionary,source))return interpolate(dictionary[source],values);
    for(const pattern of patterns){const match=source.match(pattern.regex);if(match)return interpolate(pattern.value,Object.fromEntries(pattern.names.map((name,i)=>[name,['label','status','feature','source'].includes(name)?t(match[i+1],{},target):match[i+1]])));}
    return interpolate(source,values);
  }
  function text(source){
    const value=String(source??''),trimmed=value.trim(),translated=t(trimmed);
    if(translated!==trimmed)return value.replace(trimmed,translated);
    const decoration=trimmed.match(/^(.*?)( [✓×]|:)$/);
    if(decoration&&t(decoration[1])!==decoration[1])return value.replace(trimmed,t(decoration[1])+decoration[2]);
    // Generated summaries join fixed labels; editable/user content is excluded by translate="no".
    for(const separator of ['\n',' · ',': '])if(trimmed.includes(separator))return value.split(separator).map(part=>text(part)).join(separator);
    return value;
  }
  const originals=new WeakMap(),attributes=new WeakMap();
  const excluded=node=>node.parentElement?.closest('script,style,textarea,[translate="no"],[data-no-translate],.maplibregl-ctrl-attrib');
  function translateText(node){
    if(!node.nodeValue?.trim()||excluded(node))return;
    let state=originals.get(node);
    if(!state||node.nodeValue!==state.rendered)state={source:node.nodeValue};
    state.rendered=text(state.source);originals.set(node,state);
    if(node.nodeValue!==state.rendered)node.nodeValue=state.rendered;
  }
  const translatedAttrs=['aria-label','aria-roledescription','title','placeholder','alt'];
  function translateAttributes(element){
    if(element.closest?.('[translate="no"],[data-no-translate]'))return;
    let states=attributes.get(element);if(!states){states={};attributes.set(element,states);}
    for(const name of translatedAttrs){
      const value=element.getAttribute(name);if(value===null)continue;
      let state=states[name];if(!state||value!==state.rendered)state={source:value};
      state.rendered=text(state.source);states[name]=state;
      if(value!==state.rendered)element.setAttribute(name,state.rendered);
    }
  }
  function translate(root=document){
    if(root.nodeType===3){translateText(root);return;}
    if(root.nodeType===1){translateAttributes(root);if(root.matches('[data-language-toggle]'))updateToggle(root);}
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){const node=walker.currentNode;if(node.nodeType===3)translateText(node);else{translateAttributes(node);if(node.matches('[data-language-toggle]'))updateToggle(node);}}
  }
  function updateToggle(button){
    button.setAttribute('aria-label',language==='en'?'Change language':'Cambiar idioma');
    const label=button.querySelector('[data-language-label]');if(label)label.textContent=language.toUpperCase();
  }
  const globe='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/></svg>';
  const toggle=()=>'<button type="button" class="language-button" data-language-toggle data-no-translate aria-haspopup="dialog" aria-label="'+(language==='en'?'Change language':'Cambiar idioma')+'">'+globe+'<span data-language-label>'+language.toUpperCase()+'</span></button>';
  function setLanguage(next,{persist=true}={}){
    if(!supported(next))return;
    if(persist)try{localStorage.setItem(storageKey,next);}catch{}
    if(next===language)return;
    language=next;
    document.documentElement.lang=language;
    window.dispatchEvent(new CustomEvent('arenal-language-change',{detail:{language}}));
    translate(document);
  }
  function openMenu(trigger){
    if(document.querySelector('.language-dialog'))return;
    const dialog=document.createElement('dialog');dialog.className='language-dialog';dialog.setAttribute('aria-labelledby','language-title');dialog.setAttribute('data-no-translate','');
    dialog.innerHTML='<div class="language-dialog-heading"><h2 id="language-title">Idioma / Language</h2><button type="button" data-language-close aria-label="'+(language==='en'?'Close':'Cerrar')+'">×</button></div><div class="language-options">'+[['es','Español'],['en','English']].map(([code,label])=>'<button type="button" lang="'+code+'" data-set-language="'+code+'" aria-pressed="'+(code===language)+'"><span>'+label+'</span><span aria-hidden="true">'+(code===language?'✓':'')+'</span></button>').join('')+'</div>';
    document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());
    dialog.querySelector('[data-language-close]').onclick=()=>dialog.close();
    dialog.addEventListener('click',event=>{const choice=event.target.closest('[data-set-language]');if(choice){dialog.close();setLanguage(choice.dataset.setLanguage);if(trigger.isConnected)trigger.focus({preventScroll:true});}else if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
    dialog.showModal();dialog.querySelector('[aria-pressed="true"]').focus();
  }
  function listingText(item,key='title'){
    const detail=item.details,source=key==='title'?item.name:item.description;
    const translated=detail?.translations?.[language]?.[key];
    const demo=language==='en'&&item.isDemo&&!(key==='title'&&detail?.titlesReviewed)?window.ArenalDemoEnglish?.[item.id]?.[key]:null;
    return translated||demo||(item.draftPreview&&source==='Título por definir'?t(source):source)||'';
  }
  function photoText(source,item){
    if(item.isDemo)return text(source);
    const split=source.indexOf(' · '),tail=source.slice(split+3);
    const building=split>=0&&item.details?.buildings?.find(b=>b.name&&(tail===b.name||tail.startsWith(b.name+' · ')));
    return building?text(source.slice(0,split))+' · '+building.name+text(tail.slice(building.name.length)):text(source);
  }
  window.ArenalI18n=Object.freeze({get language(){return language;},get locale(){return language==='en'?'en-US':'es-CR';},t,text,translate,toggle,setLanguage,listingText,photoText});
  if(typeof document==='undefined')return;
  document.documentElement.lang=language;
  document.addEventListener('click',event=>{const trigger=event.target.closest?.('[data-language-toggle]');if(trigger){event.preventDefault();openMenu(trigger);}});
  window.addEventListener('storage',event=>{if(event.key===storageKey&&supported(event.newValue))setLanguage(event.newValue,{persist:false});});
  const start=()=>{
    document.querySelectorAll('[data-language-mount]').forEach(mount=>{mount.outerHTML=toggle();});
    translate(document);
    new MutationObserver(records=>{for(const record of records){if(record.type==='characterData')translateText(record.target);else if(record.type==='attributes')translateAttributes(record.target);else record.addedNodes.forEach(node=>{if(node.nodeType===1||node.nodeType===3)translate(node);});}}).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:translatedAttrs});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
