/* A vertical gesture belongs to the sheet before it belongs to its list. */
window.ArenalResultsScroll = ({sheet, scroll, isExpanded, expand, loadMore}) => {
  let touch = null, settlingUntil = 0;
  const switchSheet = expanded => {
    expand(expanded);
    settlingUntil = performance.now() + 280;
  };
  sheet.addEventListener('wheel', event => {
    event.stopPropagation();
    if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroll.clientHeight : 1);
    if (performance.now() < settlingUntil) { event.preventDefault(); return; }
    if (!isExpanded() && delta > 0) {
      event.preventDefault(); switchSheet(true);
    } else if (isExpanded() && scroll.scrollTop <= 1 && delta < 0) {
      event.preventDefault(); switchSheet(false);
    } else if (!scroll.contains(event.target)) {
      event.preventDefault(); scroll.scrollTop += delta;
    }
  }, {passive:false});
  sheet.addEventListener('touchstart', event => {
    event.stopPropagation();
    if (event.touches.length !== 1) { touch = null; return; }
    const point = event.touches[0];
    touch = {x:point.clientX, y:point.clientY, switched:false};
  }, {passive:true});
  sheet.addEventListener('touchmove', event => {
    event.stopPropagation();
    if (!touch || event.touches.length !== 1) return;
    const point = event.touches[0], dy = touch.y-point.clientY, dx = touch.x-point.clientX;
    if (Math.abs(dx) >= Math.abs(dy)) return; // Keep photo carousels horizontal.
    if (touch.switched) { if(event.cancelable) event.preventDefault(); return; }
    if (Math.abs(dy) < 14) return;
    if ((!isExpanded() && dy > 0) || (isExpanded() && scroll.scrollTop <= 1 && dy < 0)) {
      if(event.cancelable) event.preventDefault();
      switchSheet(dy > 0); touch.switched = true;
    }
  }, {passive:false});
  for (const type of ['touchend','touchcancel']) sheet.addEventListener(type, () => {touch=null;}, {passive:true});
  for (const type of ['pointerdown','dblclick']) sheet.addEventListener(type, event => event.stopPropagation(), {passive:true});
  scroll.addEventListener('scroll', () => {
    if (!isExpanded() && scroll.scrollTop > 8) expand(true);
    if (isExpanded() && scroll.scrollHeight-scroll.clientHeight-scroll.scrollTop < 400) loadMore();
  }, {passive:true});
};
