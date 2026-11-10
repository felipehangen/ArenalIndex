/* Keep sorting outside the scrollable sheet: mobile select focus can reveal the map. */
window.ArenalSortPicker = ({button,dialog,getMode,isAvailable,onSelect,capturePosition,restorePosition}) => {
  let position=null,pointerPosition=null;
  const options=[...dialog.querySelectorAll('[data-sort-mode]')];
  const t=source=>window.ArenalI18n?.t(source)||source;
  function sync(){
    const mode=getMode(),selected=options.find(option=>option.dataset.sortMode===mode);
    button.value=mode;
    button.dataset.active=String(mode!=='explore');
    button.title=t('Ordenar')+': '+t(selected?.dataset.sortLabel||'Explorar');
    for(const option of options){
      option.disabled=!isAvailable(option.dataset.sortMode);
      option.setAttribute('aria-pressed',String(option===selected));
    }
    window.ArenalI18n?.translate(dialog);
  }
  button.addEventListener('pointerdown',()=>{pointerPosition=capturePosition();});
  button.addEventListener('pointercancel',()=>{pointerPosition=null;});
  // Prevent focus scrolling on pointer activation; keyboard focus remains available.
  button.addEventListener('mousedown',event=>event.preventDefault());
  button.addEventListener('keydown',()=>{pointerPosition=null;});
  button.addEventListener('click',()=>{
    if(dialog.open)return;
    position=pointerPosition||capturePosition();pointerPosition=null;
    if(position)restorePosition(position);
    sync();dialog.showModal();button.setAttribute('aria-expanded','true');
    dialog.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
    if(position)restorePosition(position);
  });
  for(const option of options)option.addEventListener('click',()=>{
    const mode=option.dataset.sortMode;
    if(!isAvailable(mode))return;
    if(mode!==getMode()){
      if(onSelect(mode)===false)return;
      // A new sort intentionally returns to the first card, keeping the sheet height.
      position=capturePosition();
    }
    dialog.close();
  });
  dialog.querySelector('[data-sort-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
  });
  dialog.addEventListener('close',()=>{
    button.setAttribute('aria-expanded','false');
    button.focus({preventScroll:true});
    if(position)restorePosition(position);
    position=null;pointerPosition=null;
  });
  return {sync};
};
