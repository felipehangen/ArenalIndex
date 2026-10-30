/* The map reveal and the listings share a single native scroll offset.
   Safari owns touch tracking and momentum; JS only observes the panel position. */
window.ArenalSheetBounds = space => {
  const max=Math.max(0,space);
  return {min:Math.min(max,space*.55,Math.min(340,Math.max(250,space*.44))),max};
};

window.ArenalResultsScroll = ({root, sheet, scroll, handle, onChange, loadMore}) => {
  let limits={min:0,max:0}, travel=0, progress=-1, frame=0;
  let drag=null, suppressClickUntil=0;
  const observe = (checkMore=false) => {
    const offset=Math.max(0,scroll.scrollTop);
    const next=travel>0?Math.min(1,offset/travel):0;
    // Once the list is expanded, scrolling it never resizes the panel or redraws
    // map markers. Native scrolling continues independently of the main thread.
    if(next!==progress){
      progress=next;
      root.style.setProperty('--sheet-height',Math.min(limits.max,limits.min+offset)+'px');
      root.style.setProperty('--sheet-progress',progress);
      onChange(progress);
    }
    if(checkMore && scroll.scrollHeight-scroll.clientHeight-offset<600)loadMore();
  };
  const schedule = () => {
    if(!frame)frame=requestAnimationFrame(()=>{frame=0;observe(true);});
  };
  const setExpanded = expanded => {
    scroll.scrollTo({top:expanded?travel:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  };
  const resetList = () => {
    // A result/filter change returns to the first card without lowering the panel.
    if(scroll.scrollTop>travel)scroll.scrollTo({top:travel,behavior:'instant'});
  };
  // Stop bubbling into the map, but never cancel a native wheel/touch gesture.
  for(const type of ['wheel','touchstart','touchmove','pointerdown','dblclick']){
    sheet.addEventListener(type,event=>event.stopPropagation(),{passive:true});
  }
  handle.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    const start=Math.min(travel,Math.max(0,scroll.scrollTop));
    scroll.scrollTo({top:start,behavior:'instant'});
    drag={id:event.pointerId,y:event.clientY,start,moved:false};
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove',event=>{
    if(!drag || event.pointerId!==drag.id)return;
    const delta=drag.y-event.clientY;
    if(!drag.moved && Math.abs(delta)<3)return;
    drag.moved=true;
    scroll.scrollTo({top:Math.max(0,Math.min(travel,drag.start+delta)),behavior:'instant'});
  });
  const endDrag=event=>{
    if(!drag || event.pointerId!==drag.id)return;
    if(drag.moved)suppressClickUntil=performance.now()+350;
    drag=null;
  };
  for(const type of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(type,endDrag);
  handle.addEventListener('click',event=>{
    if(performance.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  handle.addEventListener('keydown',event=>{
    if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    event.preventDefault();
    const top=event.key==='Home'?0:event.key==='End'?travel:Math.max(0,Math.min(travel,scroll.scrollTop+(event.key==='ArrowUp'?48:-48)));
    scroll.scrollTo({top,behavior:'instant'});
  });
  scroll.addEventListener('scroll',schedule,{passive:true});
  const resize = () => {
    const space=sheet.parentElement.clientHeight;
    // Hidden dialogs/screens must not erase the saved browse position.
    if(space<=0 || space===limits.max)return;
    const previousTravel=travel,offset=scroll.scrollTop;
    limits=window.ArenalSheetBounds(space);travel=limits.max-limits.min;
    root.style.setProperty('--sheet-travel',travel+'px');
    root.style.setProperty('--sheet-space',space+'px');
    if(previousTravel>0){
      const top=offset>=previousTravel?travel+offset-previousTravel:offset/previousTravel*travel;
      scroll.scrollTo({top,behavior:'instant'});
    }
    progress=-1;observe();
  };
  new ResizeObserver(resize).observe(sheet.parentElement);
  resize();
  return {setExpanded,resetList,get collapsedHeight(){return limits.min;}};
};
