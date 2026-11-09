/* Observe native gestures without preventing scrolling or taking pointer capture. */
window.ArenalListingActivation = scroller => {
  let gesture=null,lastScroll=-Infinity;
  const now=()=>performance.now();
  const moved=event=>{
    if(!gesture||event.pointerId!==gesture.id)return;
    if(Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>=8)gesture.blocked=true;
  };
  scroller.addEventListener('pointerdown',event=>{
    const track=event.target.closest('.gallery-track');
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,top:scroller.scrollTop,
      track,left:track?.scrollLeft,blocked:!event.isPrimary||now()-lastScroll<180};
  },{capture:true,passive:true});
  scroller.addEventListener('pointermove',moved,{capture:true,passive:true});
  scroller.ownerDocument.addEventListener('pointerup',moved,{capture:true,passive:true});
  scroller.ownerDocument.addEventListener('pointercancel',event=>{
    if(gesture?.id===event.pointerId)gesture.blocked=true;
  },{capture:true,passive:true});
  // Capture also observes horizontal gallery scrolling, which does not bubble.
  scroller.addEventListener('scroll',()=>{
    lastScroll=now();if(gesture)gesture.blocked=true;
  },{capture:true,passive:true});
  scroller.addEventListener('click',event=>{
    if(!event.target.closest('.listing-card')||event.detail===0)return; // Keyboard/assistive activation.
    const changed=gesture&&(Math.abs(scroller.scrollTop-gesture.top)>=2||
      (gesture.track&&Math.abs(gesture.track.scrollLeft-gesture.left)>=2));
    if(gesture?.blocked||changed||now()-lastScroll<180){
      event.preventDefault();event.stopImmediatePropagation();
    }
    gesture=null;
  },{capture:true});
};
