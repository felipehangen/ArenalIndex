/* Show a small scroll affordance only when quick filters extend off screen. */
window.ArenalFilterOverflow=({row,previous,next})=>{
  function sync(){
    const max=Math.max(0,row.scrollWidth-row.clientWidth),overflow=max>1;
    for(const button of [previous,next])button.hidden=!overflow;
    previous.disabled=row.scrollLeft<=1;next.disabled=row.scrollLeft>=max-1;
  }
  function move(direction){
    row.scrollTo({left:Math.max(0,Math.min(row.scrollWidth-row.clientWidth,row.scrollLeft+direction*row.clientWidth*.7)),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    sync();
  }
  previous.onclick=()=>move(-1);next.onclick=()=>move(1);
  row.addEventListener('scroll',sync,{passive:true});
  const observer=new ResizeObserver(sync);observer.observe(row);
  for(const child of row.children)observer.observe(child);
  window.addEventListener('arenal-language-change',sync);
  sync();return {sync};
};
