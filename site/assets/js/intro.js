/* BlütenSturm — the opening (home page). boot.js decides before the first paint (html.intro) and
   intro.css plays it with keyframes alone. This file never animates: it skips on any intent, then
   removes the overlay and the class and fires the window event "bs:intro-done". Nothing is stored. */
(function () {
  'use strict';
  var w = window, doc = document, d = doc.documentElement;
  var el = doc.querySelector('.opening');
  var mq = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)');
  var opt = { capture: true, passive: true };
  var done = false, timer = 0;

  function bind(m) {
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (t) { w[m](t, skip, opt); });
    w[m]('bs:motion', onMotion);
    w[m]('pageshow', onShow);
    doc[m]('visibilitychange', onVis);
    if (mq && mq[m]) mq[m]('change', onReduce);
    if (el) el[m]('animationend', onEnd);
  }
  function finish() {
    if (done) return;
    done = true;
    clearTimeout(timer);
    bind('removeEventListener');
    d.classList.remove('intro');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    try { w.dispatchEvent(new w.CustomEvent('bs:intro-done')); } catch (e) {}
  }
  // Any intent: a quick fade (intro.css .opening.is-out, clicks pass through at once), then clean up.
  function skip() {
    if (done || el.classList.contains('is-out')) return;
    el.classList.add('is-out');
    d.classList.remove('intro');   // the hero title and the nav stop waiting
    clearTimeout(timer);
    timer = setTimeout(finish, 300);
  }
  function onEnd(e) { if (e.target === el) finish(); }
  function onMotion(e) { if (e.detail && e.detail.on === false) finish(); }
  function onShow(e) { if (e.persisted) finish(); }
  function onVis() { if (doc.hidden) finish(); }
  function onReduce(e) { if (e.matches) finish(); }

  if (!el || !d.classList.contains('intro') || d.classList.contains('motion-off') || (mq && mq.matches)) {
    finish();
    return;
  }
  bind('addEventListener');
  timer = setTimeout(finish, 5000);   // backstop; the CSS has hidden the stage at 2.5 s anyway
})();
