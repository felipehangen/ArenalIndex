/* Complete dismissal before hiding a navigation layer. Reopening cancels it. */
(() => {
  const pending = new WeakMap();
  function cancel(element) {
    const job = pending.get(element);
    if (!job) return;
    pending.delete(element);
    element.inert = job.inert;
    element.removeAttribute('data-panel-leaving');
    job.animation.cancel();
  }
  function leave(element, complete) {
    if (pending.has(element)) return;
    if (element.hidden || !element.isConnected || matchMedia('(prefers-reduced-motion: reduce)').matches || !element.animate) {
      complete();
      return;
    }
    const style = getComputedStyle(element);
    const start = { transform: style.transform, opacity: style.opacity };
    const inert = element.inert;
    element.inert = true;
    element.setAttribute('data-panel-leaving', '');
    const animation = element.animate([start, { transform: 'translateY(72px)', opacity: 0 }], {
      duration: 320, easing: 'cubic-bezier(.7,0,.84,0)', fill: 'forwards'
    });
    const job = { animation, inert };
    pending.set(element, job);
    const finish = () => {
      if (pending.get(element) !== job) return;
      pending.delete(element);
      element.inert = inert;
      try { complete(); }
      finally { element.removeAttribute('data-panel-leaving'); animation.cancel(); }
    };
    animation.finished.then(finish, finish);
  }
  window.ArenalMotion = { leave, cancel };
})();
