/* BlütenSturm — home opening (intro.css). Skips on intent, cleans up, fires "bs:intro-done". Async. */
(function () {
  var w = window, doc = document, d = doc.documentElement, done, timer, opt = { capture: true, passive: true };
  var mq = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)');
  function stage() { return doc.querySelector('.opening'); }
  function on(m) {
    'pointerdown touchstart keydown wheel click focusin'.split(' ').forEach(function (t) { w[m](t, skip, opt); });
    w[m]('animationend', check, opt); w[m]('pageshow', check, opt);
    if (mq && mq[m]) mq[m]('change', check);
  }
  function check(e) {   // stage ended, bfcache restore, reduced motion on
    if (e.type === 'animationend' ? e.target === stage() : e.persisted || e.matches) finish();
  }
  function eat(e) {   // the tap that skips must not press what was hidden below (a scroll cancels)
    if (e.type === 'click') { e.preventDefault(); e.stopPropagation(); }
    eats('removeEventListener');
  }
  function eats(m) { w[m]('click', eat, true); w[m]('pointercancel', eat, true); }
  function skip(e) {
    var s = stage();
    if (!s) return finish();
    if (done || s.classList.contains('is-out')) return;
    if (/^[pt]/.test(e.type)) { eats('addEventListener'); setTimeout(eats, 1000, 'removeEventListener'); }
    s.classList.add('is-out');
    d.classList.remove('intro');
    clearTimeout(timer);
    timer = setTimeout(finish, 300);
  }
  function finish() {
    if (done) return;
    done = true;
    clearTimeout(timer);
    on('removeEventListener');
    var s = stage();
    if (s) s.remove();
    d.classList.remove('intro');
    w.dispatchEvent(new CustomEvent('bs:intro-done'));
  }
  if (!d.classList.contains('intro') || d.classList.contains('motion-off') || (mq && mq.matches)) return finish();
  on('addEventListener');
  w.addEventListener('load', function () {   // no stage or no intro.css: end now
    var s = stage();
    if (!s || getComputedStyle(s).display === 'none') finish(); else setTimeout(finish, 3000);
  });
})();
