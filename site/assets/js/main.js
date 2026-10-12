/* ==========================================================================
   BlütenSturm — page behaviour. Plain JavaScript, no dependencies, no build.

   1. Language switch (DE · EN · FR · ES · IT), texts from i18n.js
   2. Navigation: scrolled state, mobile menu sheet
   3. Motion: reveal on scroll, hero parallax, counting stats
   4. Services: deep links to a service, package buttons prefill the form
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
    'js.sending': "Sending…"
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
    if (save) { try { window.localStorage.setItem(STORE, next); } catch (e) {} }
    d.classList.remove('i18n-pending');
  }

  // Prices: data-price holds the number; show it the way each language writes it.
  function renderPrices() {
    var nf;
    try { nf = new Intl.NumberFormat(lang, { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
    catch (e) { return; }
    each('[data-price]', function (el) { el.textContent = nf.format(+el.getAttribute('data-price')); });
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
  function fmt(n, kind) {
    try {
      return kind === 'percent'
        ? new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 0 }).format(n / 100)
        : new Intl.NumberFormat(lang, { maximumFractionDigits: 0 }).format(n);
    } catch (e) { return kind === 'percent' ? Math.round(n) + '%' : String(Math.round(n)); }
  }
  function renderStats() {
    each('[data-count]', function (el) {
      var n = el.__cur != null ? el.__cur : +el.getAttribute('data-count');
      el.textContent = fmt(n, el.getAttribute('data-format'));
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
  function openFromHash() {
    var id = '';
    try { id = decodeURIComponent((window.location.hash || '').slice(1)); } catch (e) { return; }
    if (!id || id.indexOf('svc-') !== 0) return;
    var el = document.getElementById(id);
    if (el && el.tagName === 'DETAILS') el.open = true;
  }
  window.addEventListener('hashchange', openFromHash);
  openFromHash();

  // Any element with data-package="…" (package buttons, Live, Academy, the
  // full package) writes that text into the form's hidden "Package" field and
  // preselects "Interested in"; the anchor then scrolls to #contact as usual.
  var form = document.getElementById('enquiry');
  var pick = null;
  function renderPick() {
    if (!form) return;
    var box = form.querySelector('[data-picked]'), out = form.querySelector('[data-picked-text]');
    if (!box || !out) return;
    if (!pick) { box.classList.remove('is-visible'); return; }
    var q = function (root, sel) { var n = root.querySelector(sel); return n ? n.textContent.trim() : ''; };
    var amount = q(pick.pkg, '.pkg__price [data-price]');
    out.textContent = q(pick.svc, '.svc__name') + ' — ' + q(pick.pkg, '.pkg__head .lbl') +
      ' (' + q(pick.svc, '[data-i18n="pkg.from"]') + ' ' + amount + ' ' + q(pick.pkg, '.pkg__price small') + ')';
    box.classList.add('is-visible');
  }
  var interest = form ? form.querySelector('select[name="Interested in"]') : null;
  var autoInterest = null; // the value a package button chose, until the visitor changes it
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('[data-package]') : null;
    if (!a || !form) return;
    var field = form.querySelector('[data-package-field]');
    if (field) field.value = a.getAttribute('data-package');
    var want = a.getAttribute('data-interest');
    if (want && interest) {
      for (var i = 0; i < interest.options.length; i++) if (interest.options[i].value === want) { interest.selectedIndex = i; autoInterest = want; break; }
    } else if (interest && autoInterest && interest.value === autoInterest) {
      interest.selectedIndex = 0;
      autoInterest = null;
    }
    var svc = a.closest('.svc'), pkg = a.closest('.pkg');
    pick = (svc && pkg) ? { svc: svc, pkg: pkg } : null;
    renderPick();
  });
  if (interest) {
    // A manual choice wins: forget the package so the enquiry never contradicts itself.
    interest.addEventListener('change', function () {
      autoInterest = null;
      pick = null;
      var field = form.querySelector('[data-package-field]');
      if (field) field.value = '';
      renderPick();
    });
  }

  /* ---------- 5. Forms ------------------------------------------------- */
  // Long answers are shortened: Windows hands mailto: links to the mail app with a ~2,000-character limit.
  function mailtoFrom(data, subject) {
    var lines = [], total = 0;
    data.forEach(function (v, k) {
      if (k.charAt(0) === '_' || typeof v !== 'string' || !v.trim()) return;
      var line = k + ': ' + (v.length > 400 ? v.slice(0, 400) + '…' : v);
      if (total + line.length > 1500) return;
      total += line.length + 2;
      lines.push(line);
    });
    return 'mailto:' + MAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\r\n'));
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
        if (btn) { btn.removeAttribute('aria-disabled'); btn.textContent = label; }
      };

      function fail() {
        f.__reset();
        if (!status) { window.location.href = mailtoFrom(data, subject); return; }
        status.textContent = '';
        var p = document.createElement('p');
        p.textContent = t('js.error');
        var link = document.createElement('a');
        link.className = 'btn btn--sm';
        link.href = mailtoFrom(data, subject);
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
          f.__reset();
          window.location.href = '/thank-you';
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
