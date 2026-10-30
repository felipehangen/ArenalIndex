/* Spend each vertical delta once: raise the sheet, then scroll its contents.
   In reverse, reach the first listing before lowering the sheet. */
window.ArenalSheetStep = ({height, min, max, scrollTop, scrollMax}, delta) => {
  if (delta > 0) {
    const rise = Math.min(delta, max-height);
    height += rise;
    scrollTop = Math.min(scrollMax, scrollTop+delta-rise);
  } else {
    const back = Math.min(-delta, scrollTop);
    scrollTop -= back;
    height = Math.max(min, height+delta+back);
  }
  return {height, scrollTop};
};

window.ArenalSheetBounds = space => {
  const max=Math.max(0,space-24);
  // Leave usable map space even on short windows and landscape phones.
  return {min:Math.min(max,space*.55,Math.min(340,Math.max(250,space*.44))),max};
};

window.ArenalResultsScroll = ({root, sheet, scroll, handle, onChange, loadMore}) => {
  let height = 0, progress = 0, touch = null, drag = null;
  let animation = 0, inertia = 0, suppressClickUntil = 0;
  const bounds = () => window.ArenalSheetBounds(sheet.parentElement.clientHeight);
  const stop = () => {cancelAnimationFrame(animation);cancelAnimationFrame(inertia);animation=0;inertia=0;};
  const paint = value => {
    const {min,max} = bounds();
    height = Math.max(min, Math.min(max,value));
    progress = max>min ? (height-min)/(max-min) : 0;
    root.style.setProperty('--sheet-height', height+'px');
    onChange(progress);
  };
  const more = () => {
    if (scroll.scrollHeight-scroll.clientHeight-scroll.scrollTop < 400) loadMore();
  };
  const step = delta => {
    const next = window.ArenalSheetStep({height,...bounds(),scrollTop:Math.max(0,scroll.scrollTop),scrollMax:Math.max(0,scroll.scrollHeight-scroll.clientHeight)},delta);
    paint(next.height);
    // Read the limit after resizing the scroll viewport.
    scroll.scrollTop = Math.min(next.scrollTop,Math.max(0,scroll.scrollHeight-scroll.clientHeight));
    more();
  };
  const setExpanded = expanded => {
    stop();touch=null;drag=null;
    if (!expanded) scroll.scrollTop=0;
    const from=height, start=performance.now();
    const target=()=>expanded?bounds().max:bounds().min;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {paint(target());return;}
    const frame = now => {
      const t=Math.min(1,(now-start)/240);
      paint(from+(target()-from)*(1-Math.pow(1-t,3)));
      if(t<1)animation=requestAnimationFrame(frame);else animation=0;
    };
    animation=requestAnimationFrame(frame);
  };
  sheet.addEventListener('wheel', event => {
    event.stopPropagation();
    if(event.ctrlKey || Math.abs(event.deltaX)>=Math.abs(event.deltaY))return;
    event.preventDefault();stop();
    step(event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?scroll.clientHeight:1));
  },{passive:false});
  // Native horizontal photo swipes remain available. Vertical touch movement is
  // owned here so Safari can hand off between panel and list within one gesture.
  sheet.addEventListener('touchstart', event => {
    event.stopPropagation();stop();
    if(event.touches.length!==1 || handle.contains(event.target)){touch=null;return;}
    const p=event.touches[0];
    touch={x:p.clientX,y:p.clientY,lastY:p.clientY,time:event.timeStamp,velocity:0,axis:null};
  },{passive:true});
  sheet.addEventListener('touchmove', event => {
    event.stopPropagation();
    if(!touch || event.touches.length!==1){touch=null;return;}
    const p=event.touches[0],dx=p.clientX-touch.x,dy=p.clientY-touch.y;
    if(!touch.axis){
      if(Math.max(Math.abs(dx),Math.abs(dy))<5)return;
      touch.axis=Math.abs(dx)>Math.abs(dy)?'x':'y';
    }
    if(touch.axis==='x')return;
    if(event.cancelable)event.preventDefault();
    const delta=touch.lastY-p.clientY,dt=Math.max(1,event.timeStamp-touch.time);
    touch.velocity=delta/dt;touch.lastY=p.clientY;touch.time=event.timeStamp;
    step(delta);
  },{passive:false});
  sheet.addEventListener('touchend', event => {
    if(!touch)return;
    const gesture=touch;touch=null;
    if(gesture.axis!=='y')return;
    suppressClickUntil=performance.now()+350;
    // Fling the list only. The panel always stays where the finger released it.
    if(progress<.999 || event.timeStamp-gesture.time>80 || Math.abs(gesture.velocity)<.15)return;
    let velocity=gesture.velocity,last=performance.now();
    const frame=now=>{
      const dt=Math.min(32,now-last);last=now;
      const before=scroll.scrollTop;
      scroll.scrollTop+=velocity*dt;more();
      velocity*=Math.pow(.94,dt/16);
      if(Math.abs(velocity)>.03 && Math.abs(scroll.scrollTop-before)>.1)inertia=requestAnimationFrame(frame);
      else inertia=0;
    };
    inertia=requestAnimationFrame(frame);
  },{passive:true});
  sheet.addEventListener('touchcancel',()=>{touch=null;stop();},{passive:true});
  sheet.addEventListener('click',event=>{
    if(performance.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  handle.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    stop();drag={id:event.pointerId,y:event.clientY,height,moved:false};
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove',event=>{
    if(!drag || event.pointerId!==drag.id)return;
    const delta=drag.y-event.clientY;
    if(!drag.moved && Math.abs(delta)<3)return;
    drag.moved=true;paint(drag.height+delta);
  });
  const endDrag=event=>{
    if(!drag || event.pointerId!==drag.id)return;
    if(drag.moved)suppressClickUntil=performance.now()+350;
    drag=null;
  };
  handle.addEventListener('pointerup',endDrag);
  handle.addEventListener('pointercancel',endDrag);
  handle.addEventListener('lostpointercapture',endDrag);
  handle.addEventListener('keydown',event=>{
    if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    event.preventDefault();stop();
    paint(event.key==='Home'?bounds().min:event.key==='End'?bounds().max:height+(event.key==='ArrowUp'?48:-48));
  });
  for(const type of ['pointerdown','dblclick'])sheet.addEventListener(type,event=>event.stopPropagation(),{passive:true});
  scroll.addEventListener('scroll',more,{passive:true});
  new ResizeObserver(()=>{
    const {min,max}=bounds();
    if(max>0)paint(min+progress*(max-min));
  }).observe(sheet.parentElement);
  paint(bounds().min);
  return {setExpanded,get collapsedHeight(){return bounds().min;}};
};
