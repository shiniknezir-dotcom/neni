/* ==========================================================================
   BlütenSturm — page behaviour. Plain JavaScript, no dependencies, no build.

   1. Language switch (DE · EN · FR · ES · IT), texts from i18n.js
   2. Navigation: scrolled state, mobile menu sheet
   3. Motion: reveal on scroll, hero parallax, counting stats
   4. Services: deep links to a service; prices: the October offer, request buttons prefill the form
   5. Forms: send to Formspree, then /thank-you; e-mail fallback on failure
   6. Thank-you page: optional conversion signal (off until configured)

   Everything degrades: without JavaScript the pages are complete in English,
   the services are native <details>, and the forms post straight to Formspree.
   ========================================================================== */
(function () {
  'use strict';

  /* Google Ads conversion on /thank-you. Leave empty until a consent banner
     and the Google tag are in place (see README → Tracking). Example value:
     'AW-123456789/AbCdEfGhIjKlMnOp' */
  var ADS_SEND_TO = '';

  var MAIL = 'info@bluetensturm.com';
  // localStorage key for the language choice (named in /datenschutz). Not "bs-lang":
  // the previous site wrote bs-lang=en for every visitor.
  var STORE = 'bs-language';
  var LANGS = ['de', 'en', 'fr', 'es', 'it'];
  var REPLY = { de: 'Deutsch', en: 'English', fr: 'Français', es: 'Español', it: 'Italiano' };

  var d = document.documentElement;
  var DICT = window.BS_I18N || {};
  // English copies of the runtime strings, so a failed i18n.js never leaves a button without a label.
  var EN = {
    'js.error': "We couldn’t reach the mail service just now. Nothing is lost: send the same message from your own e-mail app instead.",
    'js.mailto': "Open in my e-mail app",
    'js.sending': "Sending…",
    'js.sent': "Sent. We answer within two working days."
  };
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var lang = d.getAttribute('data-lang') || 'en';

  function each(sel, fn, root) { Array.prototype.forEach.call((root || document).querySelectorAll(sel), fn); }
  function t(key) {
    var own = DICT[lang] || {};
    if (own[key] != null) return own[key];
    var en = (DICT.en || {})[key];
    return en != null ? en : (EN[key] || '');
  }

  /* ---------- 1. Language ---------------------------------------------- */
  // The English text in the HTML is the source; remember it per element so
  // switching back to EN restores it exactly.
  var originals = typeof WeakMap === 'function' ? new WeakMap() : null;
  function orig(el) {
    if (!originals) return el.__bs || (el.__bs = { attrs: {} });
    var o = originals.get(el);
    if (!o) { o = { attrs: {} }; originals.set(el, o); }
    return o;
  }

  function applyLang(next, save) {
    if (LANGS.indexOf(next) < 0) next = 'en';
    if (next !== 'en' && !DICT[next]) next = 'en'; // no dictionary (i18n.js failed): stay honest and show English
    lang = next;
    var dict = next === 'en' ? null : (DICT[next] || {});

    each('[data-i18n]', function (el) {
      var o = orig(el);
      if (o.text == null) o.text = el.textContent;
      var v = dict && dict[el.getAttribute('data-i18n')];
      el.textContent = v != null ? v : o.text;
    });
    each('[data-i18n-html]', function (el) {
      var o = orig(el);
      if (o.html == null) o.html = el.innerHTML;
      var v = dict && dict[el.getAttribute('data-i18n-html')];
      el.innerHTML = v != null ? v : o.html;
    });
    each('[data-i18n-attr]', function (el) {
      var o = orig(el);
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var i = pair.indexOf(':');
        if (i < 0) return;
        var attr = pair.slice(0, i).trim(), key = pair.slice(i + 1).trim();
        if (!(attr in o.attrs)) o.attrs[attr] = el.getAttribute(attr);
        var v = dict && dict[key];
        var value = v != null ? v : o.attrs[attr];
        if (value != null) el.setAttribute(attr, value);
      });
    });

    d.lang = next;
    d.setAttribute('data-lang', next);
    each('button[data-lang]', function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === next)); });
    each('[data-lang-field]', function (input) { input.value = next; });
    each('[data-reply-lang]', function (sel) {
      if (sel.getAttribute('data-touched')) return;
      for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value === REPLY[next]) sel.selectedIndex = i;
    });
    renderStats();
    renderPrices();
    renderPick();
    // texts main.js wrote at runtime (the form's error message) follow the language too
    each('[data-js-text]', function (el) { el.textContent = t(el.getAttribute('data-js-text')); });
    if (typeof renderBrand === 'function') renderBrand();   // an open brand dialog follows the language
    each('form[data-form]', function (f) {   // a form that is sending keeps saying so
      var b = f.__sending && f.querySelector('button[type="submit"]');
      if (b) b.textContent = t('js.sending');
    });
    if (save) { try { window.localStorage.setItem(STORE, next); } catch (e) {} }
    d.classList.remove('i18n-pending');
  }

  // Prices: data-price holds the number (data-price-range "min-max"); show it the way each language writes it.
  function renderPrices() {
    var nf;
    try { nf = new Intl.NumberFormat(lang, { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
    catch (e) { return; }
    each('[data-price]', function (el) { el.textContent = wide(nf.format(+el.getAttribute('data-price'))); });
    each('[data-price-range]', function (el) {
      var r = el.getAttribute('data-price-range').split('-'), lo = +r[0], hi = +r[1];
      var s;
      try { s = nf.formatRange(lo, hi); } catch (e) { s = nf.format(lo) + ' – ' + nf.format(hi); }   // formatRange: 2023+ browsers
      el.textContent = wide(s).replace(/\s?[-\u2013]\s?(?=[\d\u20ac])/, '\u2013');   // "2.000–4.000 €", "€2,000–€4,000"
    });
  }

  // Translate first, so nothing below can keep a visitor waiting on English.
  applyLang(lang, false);

  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button[data-lang]') : null;
    if (b) applyLang(b.getAttribute('data-lang'), true);
  });
  each('[data-reply-lang]', function (sel) {
    sel.addEventListener('change', function () { sel.setAttribute('data-touched', '1'); });
  });

  /* ---------- 2. Navigation -------------------------------------------- */
  var nav = document.getElementById('nav');
  var sheet = document.getElementById('sheet');
  var openBtn = document.querySelector('[data-menu-open]');

  function setSheet(open) {
    if (!sheet) return;
    sheet.classList.toggle('is-open', open);
    if (open) sheet.removeAttribute('inert'); else sheet.setAttribute('inert', '');
    each('#nav, #main, footer', function (el) { if (open) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
    d.classList.toggle('is-locked', open);
    if (openBtn) openBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      var close = sheet.querySelector('[data-menu-close]');
      if (close) close.focus();
    } else if (openBtn && sheet.contains(document.activeElement)) {
      openBtn.focus();
    }
  }
  if (sheet && openBtn) {
    sheet.setAttribute('inert', '');
    if (window.location.hash === '#sheet' && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    openBtn.addEventListener('click', function (e) { e.preventDefault(); setSheet(true); });
    sheet.addEventListener('click', function (e) {
      if (e.target.closest('[data-menu-close]')) { e.preventDefault(); setSheet(false); return; }
      if (e.target.closest('a')) setSheet(false);
    });
    document.addEventListener('keydown', function (e) {
      if (!sheet.classList.contains('is-open')) return;
      if (e.key === 'Escape') { setSheet(false); return; }
      if (e.key !== 'Tab') return;
      var f = sheet.querySelectorAll('a[href], button:not([disabled])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (!sheet.contains(document.activeElement)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1180 && sheet.classList.contains('is-open')) setSheet(false);
    });
  }

  /* ---------- 3. Motion ------------------------------------------------ */
  var photo = document.querySelector('[data-parallax]');
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      var y = window.pageYOffset || 0;
      if (nav) nav.classList.toggle('is-scrolled', y > 24);
      if (photo && !reduce && y < window.innerHeight * 1.2) {
        photo.style.transform = 'translateX(-50%) translate3d(0,' + (y * 0.14).toFixed(1) + 'px,0)';
      }
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if ('IntersectionObserver' in window && !reduce) {
    d.classList.add('reveal-on');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    each('.reveal', function (el) { io.observe(el); });
  }

  // Stats: formatted for the current language (2,400 · 2.400 · 2 400), and
  // counted up once when they scroll into view.
  // French groups thousands with a narrow no-break space that all but disappears in the serif;
  // a regular no-break space keeps "6 500 €" readable.
  function wide(s) { return String(s).replace(/\u202f/g, '\u00a0'); }
  function fmt(n, kind) {
    try {
      return wide(kind === 'percent'
        ? new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 0 }).format(n / 100)
        : new Intl.NumberFormat(lang, { maximumFractionDigits: 0 }).format(n));
    } catch (e) { return kind === 'percent' ? Math.round(n) + '%' : String(Math.round(n)); }
  }
  function renderStats() {
    each('[data-count]', function (el) {
      var n = el.__cur != null ? el.__cur : +el.getAttribute('data-count');
      el.textContent = fmt(n, el.getAttribute('data-format')) + (el.getAttribute('data-suffix') || '');
    });
  }
  var stats = document.querySelector('.stats');
  if (stats && 'IntersectionObserver' in window && !reduce) {
    var counted = false;
    each('[data-count]', function (el) { el.__cur = 0; });
    renderStats();
    var so = new IntersectionObserver(function (entries) {
      if (counted || !entries[0].isIntersecting) return;
      counted = true;
      so.disconnect();
      var start = null, dur = 1400;
      function step(ts) {
        if (start == null) start = ts;
        var p = Math.min(1, (ts - start) / dur), e = 1 - Math.pow(1 - p, 3);
        each('[data-count]', function (el) { el.__cur = Math.round(+el.getAttribute('data-count') * e); });
        renderStats();
        if (p < 1) window.requestAnimationFrame(step);
      }
      window.requestAnimationFrame(step);
    }, { threshold: 0.4 });
    so.observe(stats);
  }

  each('[data-year]', function (el) { el.textContent = String(new Date().getFullYear()); });

  /* ---------- 4. Services ---------------------------------------------- */
  // The eighteen services live in <details class="svc" id="svc-…"> (a plain list
  // without JavaScript). Where <dialog> is supported, the petals in "What we do",
  // the cards in 02 and /#svc-… links open the service in a dialog instead: its
  // name, tagline and body are moved in while it is open and moved back on close,
  // so translations and the request buttons keep working on the same nodes.
  var svcDlg = document.getElementById('svc-dialog');
  var brandDlg = document.getElementById('brand-dialog');
  var canDialog = !!(svcDlg && typeof svcDlg.showModal === 'function');
  if (canDialog) d.classList.add('svc-dlg');
  var moved = [], svcOpener = null, svcId = '', pushed = false, skipPop = false, before = '';

  function lockScroll(on) { d.classList.toggle('dlg-open', !!on); }
  function hereUrl() { return window.location.pathname + window.location.search; }
  function hashId() {
    try { return decodeURIComponent((window.location.hash || '').slice(1)); } catch (e) { return ''; }
  }
  function moveInto(node, slot) {
    if (!node || !slot) return;
    moved.push({ node: node, parent: node.parentNode, next: node.nextSibling });
    slot.appendChild(node);
  }
  function restoreNodes() {
    for (var i = moved.length - 1; i >= 0; i--) {
      var m = moved[i];
      if (m.next && m.next.parentNode === m.parent) m.parent.insertBefore(m.node, m.next); else m.parent.appendChild(m.node);
    }
    moved = [];
    if (!(brandDlg && brandDlg.open)) lockScroll(false);
  }
  // how: 'ui' (close button, Escape, backdrop) · 'link' (a link inside, e.g. a package request) · 'history' (Back/Forward)
  function closeSvc(how) {
    var opener = svcOpener;
    svcOpener = null;
    restoreNodes();
    svcId = '';
    if (svcDlg.open) svcDlg.close();
    if (how !== 'history' && window.history.replaceState) {
      if (pushed && how === 'ui') { skipPop = true; window.history.back(); }        // the dialog had its own entry: step back off it
      else if (pushed) window.history.replaceState(null, '', before);               // a link follows: turn the entry back into the page
      else if (hashId().indexOf('svc-') === 0) window.history.replaceState(null, '', hereUrl());   // opened by a deep link
    }
    pushed = false;
    if (opener && opener.focus && document.contains(opener)) opener.focus();
  }
  function openSvc(id, opener, fromHistory) {
    var el = document.getElementById('svc-' + id);
    if (!canDialog || !el || el.tagName !== 'DETAILS') return false;
    if (svcDlg.open) { if (svcId === id) return true; restoreNodes(); }
    svcId = id;
    svcOpener = opener || null;
    moveInto(el.querySelector('.svc__name'), svcDlg.querySelector('[data-dlg-title]'));
    moveInto(el.querySelector('.svc__tagline'), svcDlg.querySelector('[data-dlg-tagline]'));
    moveInto(el.querySelector('.svc__body'), svcDlg.querySelector('[data-dlg-body]'));
    if (!fromHistory && !pushed && window.history.pushState) {
      // its own history entry, so Back (and the phone's back gesture) closes the dialog
      before = window.location.href;
      window.history.pushState({ bsSvc: id }, '', '#svc-' + id);
      pushed = true;
    }
    if (!svcDlg.open) svcDlg.showModal();
    svcDlg.scrollTop = 0;
    lockScroll(true);
    var close = svcDlg.querySelector('[data-dlg-close]');
    if (close) close.focus();
    return true;
  }
  // A backdrop click closes a dialog only when the press also started on the backdrop and is a
  // single click: a double click on a tile, or a text selection released outside, must not close it.
  function backdropCloser(dlg, close) {
    var downOnBackdrop = false;
    dlg.addEventListener('pointerdown', function (e) { downOnBackdrop = e.target === dlg; });
    return function (e) { return e.target === dlg && downOnBackdrop && e.detail <= 1; };
  }
  if (canDialog) {
    var svcBackdrop = backdropCloser(svcDlg);
    svcDlg.addEventListener('cancel', function (e) { e.preventDefault(); closeSvc('ui'); });   // Escape
    svcDlg.addEventListener('close', function () { if (moved.length) closeSvc('ui'); });
    svcDlg.addEventListener('click', function (e) {
      if (svcBackdrop(e) || (e.target.closest && e.target.closest('[data-dlg-close]'))) { closeSvc('ui'); return; }
      // A link inside (a package button to #contact): put the service back first,
      // so the package handler below finds it, then let the link do its job.
      var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (a) closeSvc('link');
    });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('[data-svc-open]') : null;
    if (!a || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;   // new tab etc.: /#svc-… opens there
    if (openSvc(a.getAttribute('data-svc-open'), a, false)) e.preventDefault();
  });

  function onHistory() {
    if (skipPop) { skipPop = false; return; }
    var id = hashId();
    if (svcDlg && svcDlg.open) {
      if (id === 'svc-' + svcId) return;
      closeSvc('history');
    }
    if (id.indexOf('svc-') !== 0) return;
    if (openSvc(id.slice(4), null, true)) return;
    var el = document.getElementById(id);
    if (el && el.tagName === 'DETAILS') el.open = true;
  }
  window.addEventListener('popstate', onHistory);
  window.addEventListener('hashchange', onHistory);
  onHistory();

  // Brands in 05: any logo opens the brand dialog (name, category, markets, the work).
  // The buttons ship disabled (no dead buttons without JavaScript or <dialog>); enabled here.
  var brandOpener = null;
  function renderBrand() {
    if (!brandOpener || !brandDlg) return;
    var img = brandOpener.querySelector('img'), cat = brandOpener.querySelector('.logo__cat');
    var logo = brandDlg.querySelector('[data-brand-logo]');
    if (logo && img) { logo.src = img.currentSrc || img.src; logo.width = img.naturalWidth || img.width; logo.height = img.naturalHeight || img.height; }
    var name = brandDlg.querySelector('[data-brand-name]');
    if (name && img) name.textContent = img.alt;
    var c = brandDlg.querySelector('[data-brand-cat]');
    if (c && cat) c.textContent = cat.textContent;
  }
  function closeBrand() {
    var opener = brandOpener;
    brandOpener = null;
    if (brandDlg.open) brandDlg.close();
    if (!(svcDlg && svcDlg.open)) lockScroll(false);
    if (opener && opener.focus) opener.focus();
  }
  if (canDialog && brandDlg) {
    each('[data-brand]', function (b) { b.disabled = false; });
    var brandBackdrop = backdropCloser(brandDlg);
    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-brand]') : null;
      if (!b) return;
      brandOpener = b;
      renderBrand();
      brandDlg.showModal();
      brandDlg.scrollTop = 0;
      lockScroll(true);
      var close = brandDlg.querySelector('[data-dlg-close]');
      if (close) close.focus();
    });
    brandDlg.addEventListener('click', function (e) {
      if (brandBackdrop(e) || (e.target.closest && e.target.closest('[data-dlg-close]'))) closeBrand();
    });
    brandDlg.addEventListener('close', function () { if (brandOpener) closeBrand(); });
  }

  // The October offer runs through offer.valid_until (/data/pricing.json, written into
  // <meta name="bs-offer-until"> by tools/pricing.py). boot.js sets html.offer-on before the
  // first paint; this ends it on time: at the deadline while the page stays open, after a
  // sleeping laptop or a background tab wakes, and by the server's clock when the device's
  // clock is behind (the live JSON can only end it sooner, never extend it). Once over, it
  // stays over for this page view.
  var offerMeta = document.querySelector('meta[name="bs-offer-until"]');
  var offerEnd = offerMeta ? Date.parse(offerMeta.getAttribute('content')) + 1000 : NaN;   // valid through its last second
  var offerOver = !(offerEnd > 0), offerTimer = 0;
  function offerOn() { return d.classList.contains('offer-on'); }
  function checkOffer() {
    if (!offerOver && Date.now() >= offerEnd) offerOver = true;
    var was = offerOn();
    d.classList.toggle('offer-on', !offerOver);
    clearTimeout(offerTimer);
    // at the deadline, or in an hour if that is sooner (timers longer than ~24 days fire at once)
    if (!offerOver) offerTimer = setTimeout(checkOffer, Math.min(offerEnd - Date.now() + 50, 36e5));
    if (was !== offerOn()) syncPick();
  }
  if (!offerOver) {
    document.addEventListener('visibilitychange', function () { if (!document.hidden) checkOffer(); });
    window.addEventListener('pageshow', checkOffer);
    // The live price list, fresh: its server date, and its own valid_until (no offer there: over).
    var askServer = function () {
      if (offerOver || !window.fetch) return;
      fetch('/data/pricing.json', { cache: 'no-store' }).then(function (r) {
        var now = Date.parse(r.headers.get('Date') || '');
        return r.ok ? r.json().then(function (data) {
          var o = data && data.offer, end = o ? Date.parse(o.valid_until) + 1000 : 0;
          if (end < offerEnd) offerEnd = end;
          if (now >= offerEnd || !(offerEnd > 0)) offerOver = true;
          checkOffer();
        }) : null;
      }).catch(function () {});
    };
    if (document.readyState === 'complete') askServer(); else window.addEventListener('load', askServer);
  }

  // Request buttons: data-package="…" (price cards, Live, Academy, the full package) writes that
  // text into the form's hidden "Package" field (data-package-offer instead while the offer is on),
  // data-interest="…" preselects "Interested in"; the anchor then scrolls to #contact as usual.
  var form = document.getElementById('enquiry');
  var pick = null, pickBtn = null;   // the price card (data-pick) and the button it was asked from
  function txt(n) { return n ? n.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function packageOf(a) { return (offerOn() && a.getAttribute('data-package-offer')) || a.getAttribute('data-package') || ''; }
  function renderPick() {
    if (!form) return;
    var box = form.querySelector('[data-picked]'), out = form.querySelector('[data-picked-text]');
    if (!box || !out) return;
    if (!pick) { box.classList.remove('is-visible'); return; }
    var name = txt(pick.querySelector('[data-pick-name]'));
    var group = pick.hasAttribute('data-pick-group') && pick.closest('.price-group');
    if (group) name = txt(group.querySelector('h3')) + ' · ' + name;
    var price = txt(pick.querySelector('[data-pick-reg]'));
    var deal = offerOn() ? pick.querySelector('[data-pick-offer]') : null;
    if (deal) price = (deal.hasAttribute('data-pick-add') ? price + ' · ' : '') + txt(deal);
    out.textContent = name + ' — ' + price;
    box.classList.add('is-visible');
  }
  // The offer ended while a request was picked: the form says what applies now.
  function syncPick() {
    if (!form || !pickBtn) return;
    var field = form.querySelector('[data-package-field]');
    if (field) field.value = packageOf(pickBtn);
    renderPick();
  }
  var interest = form ? form.querySelector('select[name="Interested in"]') : null;
  var autoInterest = null; // the value a request button chose, until the visitor changes it
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('[data-package], [data-interest]') : null;
    if (!a || !form) return;
    var field = form.querySelector('[data-package-field]');
    if (field) field.value = packageOf(a);
    var want = a.getAttribute('data-interest');
    if (want && interest) {
      for (var i = 0; i < interest.options.length; i++) if (interest.options[i].value === want) { interest.selectedIndex = i; autoInterest = want; break; }
    } else if (interest && autoInterest && interest.value === autoInterest) {
      interest.selectedIndex = 0;
      autoInterest = null;
    }
    pick = a.closest('[data-pick]');
    pickBtn = pick ? a : null;
    renderPick();
  });
  if (interest) {
    // A manual choice wins: forget the package so the enquiry never contradicts itself.
    interest.addEventListener('change', function () {
      autoInterest = null;
      pick = pickBtn = null;
      var field = form.querySelector('[data-package-field]');
      if (field) field.value = '';
      renderPick();
    });
  }
  checkOffer();

  /* ---------- 5. Forms ------------------------------------------------- */
  // Long answers are shortened: Windows hands mailto: links to the mail app with a ~2,000-character limit.
  // The budget counts the encoded link (an "ä" takes six characters there).
  var MAILTO_MAX = 1900;
  function enc(s) {
    try { return encodeURIComponent(s); } catch (e) { return encodeURIComponent(s.replace(/[\uD800-\uDFFF]/g, '\uFFFD')); }
  }
  function clip(s, n) { // the first n characters, never half an emoji
    if (s.length <= n) return s;
    s = s.slice(0, n);
    return (/[\uD800-\uDBFF]$/.test(s) ? s.slice(0, -1) : s) + '…';
  }
  function mailtoFrom(data, subject) {
    var url = 'mailto:' + MAIL + '?subject=' + enc(subject) + '&body=', first = true;
    data.forEach(function (v, k) {
      if (k.charAt(0) === '_' || typeof v !== 'string' || !v.trim()) return;
      var room = MAILTO_MAX - url.length - (first ? 0 : 6), line = '', n; // 6 = %0D%0A
      for (n = 400; n >= 40; n = Math.floor(n * 0.75)) {
        line = enc(k + ': ' + clip(v, n));
        if (line.length <= room) break;
      }
      if (line.length > room) return;
      url += (first ? '' : '%0D%0A') + line;
      first = false;
    });
    return url;
  }

  each('form[data-form]', function (f) {
    f.addEventListener('submit', function (e) {
      if (!window.fetch || !window.FormData) return; // let the browser post it
      e.preventDefault();
      if (f.__sending) return;
      var btn = f.querySelector('button[type="submit"]');
      var status = f.querySelector('[data-status]');
      var label = btn ? btn.textContent : '';
      var data = new FormData(f);
      var subject = (f.querySelector('[name="_subject"]') || {}).value || 'Anfrage über bluetensturm.com';
      f.__sending = true;
      // aria-disabled instead of disabled: the button keeps focus, so a keyboard user is not dropped to <body>.
      if (btn) { btn.setAttribute('aria-disabled', 'true'); btn.textContent = t('js.sending'); }
      if (status) { status.className = 'form__status'; status.textContent = ''; }
      f.__reset = function () {
        f.__sending = false;
        if (f.__sentTimer) { window.clearTimeout(f.__sentTimer); f.__sentTimer = 0; }
        if (btn) {
          btn.removeAttribute('aria-disabled');
          // the label in the current language (the visitor may have switched while it was sending)
          var key = btn.getAttribute('data-i18n'), own = lang !== 'en' && DICT[lang] && key ? DICT[lang][key] : null;
          btn.textContent = own != null ? own : (orig(btn).text != null ? orig(btn).text : label);
        }
      };

      function fail() {
        f.__reset();
        if (!status) { window.location.href = mailtoFrom(data, subject); return; }
        status.textContent = '';
        var p = document.createElement('p');
        p.setAttribute('data-js-text', 'js.error');
        p.textContent = t('js.error');
        var link = document.createElement('a');
        link.className = 'btn btn--sm';
        link.href = mailtoFrom(data, subject);
        link.setAttribute('data-js-text', 'js.mailto');
        link.textContent = t('js.mailto');
        status.appendChild(p);
        status.appendChild(link);
        status.classList.add('is-visible', 'is-error');
        status.setAttribute('tabindex', '-1');
        status.focus();
      }

      window.fetch(f.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          try { window.sessionStorage.setItem('bs-sent', f.getAttribute('data-form')); } catch (err) {}
          // The button stays in its sending state until /thank-you replaces this page, so a second
          // click cannot send the enquiry twice. Coming back via Back is handled by pageshow below.
          window.location.href = '/thank-you';
          // If that navigation is stopped (Esc, a stalled connection), say plainly that it was sent.
          f.__sentTimer = window.setTimeout(function () {
            f.__reset();
            if (!status) return;
            status.textContent = '';
            var done = document.createElement('p');
            done.setAttribute('data-js-text', 'js.sent');
            done.textContent = t('js.sent');
            status.appendChild(done);
            status.className = 'form__status is-visible';
          }, 6000);
        })
        .catch(fail);
    });
  });

  // Back from /thank-you (page restored from the back/forward cache): the form is ready to send again.
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) each('form[data-form]', function (f) { if (f.__reset) f.__reset(); });
  });

  /* ---------- 6. Thank-you page ---------------------------------------- */
  if (d.getAttribute('data-page') === 'thank-you') {
    var sent = null;
    try { sent = window.sessionStorage.getItem('bs-sent'); window.sessionStorage.removeItem('bs-sent'); } catch (e) {}
    if (sent) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'enquiry_submitted', form: sent });
      if (ADS_SEND_TO && typeof window.gtag === 'function') window.gtag('event', 'conversion', { send_to: ADS_SEND_TO });
    }
  }

})();
