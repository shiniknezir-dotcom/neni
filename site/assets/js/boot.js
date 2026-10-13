/* BlütenSturm — runs in <head>, before first paint.
   Marks that JavaScript is available and picks the language:
   the visitor's saved choice, else their browser language, else English.
   For a non-English first view the page is held invisible for a moment
   (class i18n-pending) so English never flashes before the translation;
   main.js lifts it as soon as the text is swapped, and this file lifts it
   after 1.8 s regardless, so a failed script can never hide the page. */
(function () {
  var d = document.documentElement;
  var langs = ['de', 'en', 'fr', 'es', 'it'];
  var lang = null;
  d.classList.add('js');
  // Key "bs-language" (not "bs-lang": the previous site saved bs-lang=en for everyone).
  try { lang = window.localStorage.getItem('bs-language'); } catch (e) {}
  if (langs.indexOf(lang) < 0) {
    var prefs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'en'];
    lang = 'en';
    for (var i = 0; i < prefs.length; i++) {
      var code = String(prefs[i] || '').slice(0, 2).toLowerCase();
      if (langs.indexOf(code) >= 0) { lang = code; break; }
    }
  }
  d.setAttribute('data-lang', lang);
  if (lang !== 'en') {
    d.classList.add('i18n-pending');
    setTimeout(function () { d.classList.remove('i18n-pending'); }, 1800);
  }
})();

/* Opening (intro.css + intro.js): only on a fresh arrival at the home page, decided here before the
   first paint. Not on reload or back/forward, not from another page of this site, not with a #hash,
   not in a background tab or prerender, not under reduced motion. Nothing is stored. */
(function () {
  var d = document.documentElement, p = window.performance, o = location.origin, r = document.referrer;
  try {
    var n = p && p.getEntriesByType && p.getEntriesByType('navigation')[0];
    var type = n ? n.type : (p && p.navigation && p.navigation.type === 0 ? 'navigate' : '');
    if (d.getAttribute('data-page') === 'home' && type === 'navigate' && !location.hash &&
        !(r && (r === o || r.indexOf(o + '/') === 0)) &&
        document.visibilityState !== 'hidden' && !document.prerendering &&
        !d.classList.contains('motion-off') &&
        !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      d.classList.add('intro');
    }
  } catch (e) {}
})();
