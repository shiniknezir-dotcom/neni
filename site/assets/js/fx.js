/* ==========================================================================
   BlütenSturm — motion layer. Plain JavaScript, no dependencies, no build.

   1. Motion state: html.motion-off, the hero toggle, the "bs:motion" event
   2. Hero video backdrop: plays only when it is worth it, pauses otherwise
   3. Word reveal: headlines split into words that rise in 3D as they reveal
   4. In view: section hairlines, portfolio logos, the turning flower
   5. Depth: a gentle parallax on images (one rAF-throttled scroll handler)
   6. Pointer: 3D tilt with a light sheen and a cursor light (fine pointers)
   7. Language switch: re-split headlines and relabel the toggle

   Everything is off under prefers-reduced-motion or html.motion-off, pauses
   offscreen and in hidden tabs, and never changes layout. Shared contract
   with storm.js: the html classes motion-off and fx-on, and the window event
   "bs:motion" (CustomEvent, detail: { on: boolean }). Nothing is stored.
   ========================================================================== */
(function () {
  'use strict';
  var w = window, doc = document, d = doc.documentElement;
  if (!d.classList || !w.matchMedia || !w.requestAnimationFrame || !doc.querySelector) return;

  var mqReduce = w.matchMedia('(prefers-reduced-motion: reduce)');
  var mqFine = w.matchMedia('(pointer: fine)');
  var hasIO = 'IntersectionObserver' in w;
  var on = !mqReduce.matches;   // for this page view only; never stored
  var raf = 0;                  // the one animation-frame loop (0 = idle)

  function each(sel, fn, root) { Array.prototype.forEach.call((root || doc).querySelectorAll(sel), fn); }
  function cls(el, name, want) { if (want) el.classList.add(name); else el.classList.remove(name); }
  function t(key, fallback) {
    var dict = w.BS_I18N && w.BS_I18N[d.getAttribute('data-lang') || 'en'];
    return (dict && dict[key] != null) ? dict[key] : fallback;
  }
  function onMq(mq, fn) { if (mq.addEventListener) mq.addEventListener('change', fn); else if (mq.addListener) mq.addListener(fn); }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* ---------- 1. Motion state and toggle ------------------------------ */
  var toggle = doc.querySelector('[data-motion-toggle]');

  function relabel() {
    if (!toggle) return;
    var span = toggle.querySelector('[data-i18n]');
    var key = on ? 'hero.motion.on' : 'hero.motion.off';
    if (span) span.setAttribute('data-i18n', key);
    (span || toggle).textContent = t(key, on ? 'Motion on' : 'Motion off');
    toggle.setAttribute('aria-pressed', String(on));
  }

  function setMotion(next, announce) {
    on = !!next;
    cls(d, 'motion-off', !on);
    cls(d, 'fx-on', on && hasIO);
    relabel();
    syncVideo();
    syncLight();
    if (on) onScroll(); else dropTilts();
    if (announce) {
      try { w.dispatchEvent(new w.CustomEvent('bs:motion', { detail: { on: on } })); } catch (e) {}
    }
  }

  if (toggle) toggle.addEventListener('click', function () { setMotion(!on, true); });
  onMq(mqReduce, function (e) { setMotion(!e.matches, true); });

  /* ---------- 2. Hero video backdrop ---------------------------------- */
  var video = doc.querySelector('[data-hero-video]');
  var heroIn = true;
  var loaded = doc.readyState === 'complete';

  function wantVideo() {
    var c = w.navigator.connection;
    return on && heroIn && loaded && !doc.hidden && w.innerWidth >= 760 && !(c && c.saveData);
  }
  function syncVideo() {
    if (!video) return;
    if (wantVideo()) {
      if (video.paused) {
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
      }
    } else if (!video.paused) {
      video.pause();
    }
    if (!on) video.classList.remove('is-playing');
  }
  if (video) {
    video.addEventListener('playing', function () { if (on) video.classList.add('is-playing'); });
    if (!loaded) w.addEventListener('load', function () { loaded = true; syncVideo(); });
    doc.addEventListener('visibilitychange', syncVideo);
    w.addEventListener('resize', syncVideo);
    if (hasIO && video.parentNode) {
      new w.IntersectionObserver(function (entries) {
        heroIn = entries[entries.length - 1].isIntersecting;
        syncVideo();
      }, { threshold: 0 }).observe(video.parentNode);
    }
  }

  /* ---------- 3. Word reveal ------------------------------------------ */
  var SPLIT = '.hero__title, .h-xl, .h-l, .h-m, .statement, .center-page h1';
  // main.js reads text from these; they are never split.
  var NEVER = '.svc__name, .pkg__head .lbl, [data-i18n="pkg.from"], .pkg__price, .stat__value, [data-picked-text], .form__status';

  function splitNode(node) {
    var i, parts, frag, outer, inner, kids;
    if (node.nodeType === 3) {
      parts = node.nodeValue.split(/(\s+)/);
      frag = doc.createDocumentFragment();
      for (i = 0; i < parts.length; i++) {
        if (!parts[i]) continue;
        if (/^\s+$/.test(parts[i])) { frag.appendChild(doc.createTextNode(' ')); continue; }
        outer = doc.createElement('span');
        outer.className = 'w';
        inner = doc.createElement('span');
        inner.className = 'w__i';
        inner.textContent = parts[i];
        outer.appendChild(inner);
        frag.appendChild(outer);
      }
      node.parentNode.replaceChild(frag, node);
    } else if (node.nodeType === 1 && node.tagName !== 'BR') {
      kids = Array.prototype.slice.call(node.childNodes);
      for (i = 0; i < kids.length; i++) splitNode(kids[i]);
    }
  }
  function splitAll() {
    each(SPLIT, function (el) {
      if ((el.matches && el.matches(NEVER)) || el.querySelector('.w') || !el.textContent.trim()) return;
      splitNode(el);
      var n = 0;
      each('.w__i', function (s) { s.style.setProperty('--i', n++); }, el);
    });
  }

  /* ---------- 4. In view: hairlines, logos, flower -------------------- */
  // Same geometry as the reveal in main.js, so both fire in the same frame.
  var io = hasIO ? new w.IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      io.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 }) : null;

  function watchIn() {
    if (!io) return;
    each(SPLIT + ', [data-rule], .logos', function (el) { if (!el.classList.contains('is-in')) io.observe(el); });
  }
  each('.logo', function (el, i) { el.style.setProperty('--i', i); });

  var flower = doc.querySelector('.flower');
  if (flower && hasIO) {
    new w.IntersectionObserver(function (entries) {
      cls(flower, 'is-near', entries[entries.length - 1].isIntersecting);
    }, { rootMargin: '10% 0px' }).observe(flower);
  }

  /* ---------- 5. Depth (parallax) ------------------------------------- */
  var depth = [], depthLive = 0, scrollQueued = false;
  each('[data-depth]', function (el) {
    el._depth = { el: el, max: +el.getAttribute('data-depth') || 24, active: false, py: 0 };
    depth.push(el._depth);
  });
  if (depth.length && hasIO) {
    var ioDepth = new w.IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.target._depth) en.target._depth.active = en.isIntersecting; });
      depthLive = 0;
      for (var i = 0; i < depth.length; i++) if (depth[i].active) depthLive++;
      onScroll();
    }, { rootMargin: '12% 0px' });
    depth.forEach(function (s) { ioDepth.observe(s.el); });
  }

  function onScroll() {
    if (scrollQueued || !depthLive || !on) return;
    scrollQueued = true;
    w.requestAnimationFrame(scrollFrame);
  }
  function scrollFrame() {
    scrollQueued = false;
    if (!on) return;
    var vh = w.innerHeight || 1, i, s, r, p;
    for (i = 0; i < depth.length; i++) {
      s = depth[i];
      if (!s.active) continue;
      r = s.el.getBoundingClientRect();
      p = clamp(((r.top - s.py + r.height / 2) - vh / 2) / vh, -1, 1);
      s.py = -p * s.max;
      s.el.style.setProperty('--py', s.py.toFixed(1) + 'px');
      if (s.el._tilt && s.el._tilt.live) paintTilt(s.el._tilt);
    }
  }
  w.addEventListener('scroll', onScroll, { passive: true });
  w.addEventListener('resize', onScroll);

  /* ---------- 6. Pointer: tilt and cursor light ----------------------- */
  var MAX_TILT = 5, tilts = [], hovered = null;
  var light = null, lightOn = false, lightShown = false, lx = 0, ly = 0, ltx = 0, lty = 0;
  var portfolio = doc.querySelector('.portfolio'), pTop = 0, pBottom = 0, pMeasured = 0;

  function tiltState(el) {
    return el._tilt || (el._tilt = { el: el, rx: 0, ry: 0, tx: 0, ty: 0, live: false, leaving: false, img: el.tagName === 'IMG' });
  }
  function paintTilt(s) {
    var el = s.el, py = el._depth ? el._depth.py : 0;
    el.style.transform = (py ? 'translate3d(0,' + py.toFixed(1) + 'px,0) ' : '') +
      'perspective(900px) rotateX(' + s.rx.toFixed(2) + 'deg) rotateY(' + s.ry.toFixed(2) + 'deg) translateZ(0)';
  }
  function enter(el) {
    // Let main.js reveal a card first; tilting it earlier would skip its rise.
    if (d.classList.contains('reveal-on') && el.classList.contains('reveal') && !el.classList.contains('is-in')) return;
    var s = tiltState(el);
    s.live = true; s.leaving = false;
    if (tilts.indexOf(s) < 0) tilts.push(s);
    el.classList.add('is-tilting');
    hovered = el;
  }
  function leave() {
    if (!hovered) return;
    var s = hovered._tilt;
    s.tx = s.ty = 0; s.leaving = true;
    hovered = null;
    loop();
  }
  function settle(s) {
    s.rx = s.ry = s.tx = s.ty = 0; s.live = false; s.leaving = false;
    s.el.style.transform = '';
    s.el.style.removeProperty('--mx');
    s.el.style.removeProperty('--my');
    s.el.classList.remove('is-tilting');
  }
  function dropTilts() {
    hovered = null;
    while (tilts.length) settle(tilts.pop());
  }
  function aim(el, e) {
    var s = el._tilt, r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var px = clamp((e.clientX - r.left) / r.width, 0, 1), py = clamp((e.clientY - r.top) / r.height, 0, 1);
    s.tx = (py - 0.5) * 2 * MAX_TILT;   // the side under the pointer tips away, like a pressed card
    s.ty = (px - 0.5) * 2 * MAX_TILT;
    if (!s.img) {
      el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    }
  }

  function measurePortfolio(now) {
    if (!portfolio) return;
    var r = portfolio.getBoundingClientRect(), y = w.pageYOffset || 0;
    pTop = r.top + y; pBottom = r.bottom + y; pMeasured = now || 0;
  }
  function overLight(clientY) {
    if (!portfolio) return false;
    var y = clientY + (w.pageYOffset || 0);
    return y >= pTop && y <= pBottom;
  }
  function syncLight() {
    lightOn = on && mqFine.matches;
    if (light) cls(light, 'is-on', lightOn && lightShown);
  }
  function showLight(show) {
    if (!light || lightShown === show) return;
    lightShown = show;
    if (show) { lx = ltx; ly = lty; }
    syncLight();
  }

  function onMove(e) {
    if (!on || e.pointerType === 'touch') return;
    var now = e.timeStamp || 0;
    if (now - pMeasured > 1000) measurePortfolio(now);
    ltx = e.clientX; lty = e.clientY;
    showLight(!overLight(e.clientY));
    var el = e.target && e.target.closest ? e.target.closest('[data-tilt]') : null;
    if (el !== hovered) { leave(); if (el) enter(el); }
    if (hovered) aim(hovered, e);
    loop();
  }
  function onLeave() { showLight(false); leave(); }

  function loop() { if (!raf) raf = w.requestAnimationFrame(tick); }
  function tick() {
    raf = 0;
    var busy = false, i, s, k = 0.16;
    for (i = tilts.length - 1; i >= 0; i--) {
      s = tilts[i];
      if (Math.abs(s.tx - s.rx) < 0.01 && Math.abs(s.ty - s.ry) < 0.01) {
        if (s.leaving) { settle(s); tilts.splice(i, 1); }
        continue;
      }
      s.rx += (s.tx - s.rx) * k;
      s.ry += (s.ty - s.ry) * k;
      paintTilt(s);
      busy = true;
    }
    if (light && lightShown && lightOn) {
      lx += (ltx - lx) * 0.14;
      ly += (lty - ly) * 0.14;
      light.style.transform = 'translate3d(' + lx.toFixed(1) + 'px,' + ly.toFixed(1) + 'px,0)';
      if (Math.abs(ltx - lx) > 0.3 || Math.abs(lty - ly) > 0.3) busy = true;
    }
    if (busy) loop();
  }

  if (mqFine.matches && doc.body) {
    light = doc.createElement('div');
    light.className = 'cursor-light';
    doc.body.appendChild(light);
    doc.addEventListener('pointermove', onMove, { passive: true });
    d.addEventListener('pointerleave', onLeave);
    w.addEventListener('blur', onLeave);
    w.addEventListener('resize', function () { measurePortfolio(0); });
    w.addEventListener('load', function () { measurePortfolio(0); });
  }

  /* ---------- 7. Language switch -------------------------------------- */
  if (w.MutationObserver) {
    new w.MutationObserver(function () {
      splitAll();
      relabel();
      measurePortfolio(0);
    }).observe(d, { attributes: true, attributeFilter: ['data-lang'] });
  }

  /* ---------- Go ------------------------------------------------------ */
  splitAll();
  watchIn();
  measurePortfolio(0);
  setMotion(on, false);
  var title = doc.querySelector('.hero__title');
  if (title && !title.classList.contains('is-in')) {
    w.requestAnimationFrame(function () { w.requestAnimationFrame(function () { title.classList.add('is-in'); }); });
  }
})();
