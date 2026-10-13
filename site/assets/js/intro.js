/* BlütenSturm — home opening. boot.js sets html.intro, intro.css plays and ends it; this file skips
   on intent, then removes the stage and the class and fires "bs:intro-done". */
(function () {
  'use strict';
  var w = window, d = document.documentElement, el = document.querySelector('.opening');
  var mq = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)');
  var done, timer, opt = { capture: true, passive: true };

  function bind(m) {
    'pointerdown keydown wheel touchstart'.split(' ').forEach(function (t) { w[m](t, skip, opt); });
    'animationend pageshow visibilitychange bs:motion'.split(' ').forEach(function (t) { w[m](t, check, opt); });
    if (mq && mq[m]) mq[m]('change', check);
  }
  function check(e) {   // stage ended, bfcache, reduced motion, motion off, hidden tab
    var t = e.type;
    if (t === 'animationend' ? e.target === el : t === 'pageshow' ? e.persisted : t === 'change' ? e.matches :
        t === 'bs:motion' ? !(e.detail || {}).on : document.hidden) finish();
  }
  function skip() {     // 0.25 s fade; clicks pass at once
    if (done || el.classList.contains('is-out')) return;
    el.classList.add('is-out');
    d.classList.remove('intro');
    clearTimeout(timer);
    timer = setTimeout(finish, 300);
  }
  function finish() {
    if (done) return;
    done = true;
    clearTimeout(timer);
    bind('removeEventListener');
    d.classList.remove('intro');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    try { w.dispatchEvent(new CustomEvent('bs:intro-done')); } catch (e) {}
  }

  if (!el || !d.classList.contains('intro') || d.classList.contains('motion-off') || (mq && mq.matches)) return finish();
  bind('addEventListener');
  timer = setTimeout(finish, 5000);   // backstop
})();
