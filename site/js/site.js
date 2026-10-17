/* ==========================================================================
   Blüten Sturm — page behaviour (ES module, no framework)
   One module for every page: the home page, the questionnaire, the thank-you
   page, the legal pages and the 404. Each feature looks for its markup and
   stays out of the way where that markup is missing.
   ========================================================================== */

import { SERVICES, BRAND_CATEGORIES, COMPANY } from './data.js';
import { sendEnquiry, fallbackHref } from './form-send.js';
import * as P from './pricing.js';

const LANGS = ['en', 'de', 'fr', 'es', 'it'];
const LOCALES = { en: 'en-GB', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT' };
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const root = document.documentElement;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const span = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const motionOverride = () => (/[?&]motion=(full|reduced)/.exec(window.location.search) || [])[1];

/* --------------------------------------------------------------------------
   i18n — English is in the markup (as on the live site); every language,
   English included, is a dictionary in /i18n/<lang>.json. The dictionaries
   also carry the service details, packages and partner texts.
   -------------------------------------------------------------------------- */
const dicts = {};
let lang = 'en';
let dict = null;
let langSeq = 0;
const fixedLang = root.dataset.langFixed || '';   // legal pages stay German
const REPLY_LANG = { de: 'Deutsch', en: 'English', fr: 'Français', es: 'Español', it: 'Italiano' };

function get(obj, key) {
  if (!obj) return undefined;
  return key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}
export function t(key, fallback = '') {
  const v = get(dict, key);
  if (v !== undefined) return v;
  const en = get(dicts.en, key);
  return en !== undefined ? en : fallback;
}
const fmtNum = (n) => n.toLocaleString(LOCALES[lang] || 'en-GB');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* One request per language, shared by every caller; the head script may
   already have started the visitor's saved language. */
const pendingDicts = {};
function loadDict(code) {
  if (dicts[code]) return Promise.resolve(dicts[code]);
  if (!pendingDicts[code]) {
    const early = window.__bsDict && window.__bsDict.code === code ? window.__bsDict.p : null;
    if (early) window.__bsDict = null;          // a failed prefetch must not stick
    pendingDicts[code] = (early || fetch(`/i18n/${code}.json`).then((res) => {
      if (!res.ok) throw new Error(`i18n ${code}: ${res.status}`);
      return res.json();
    })).then((j) => {
      if (!j) throw new Error(`i18n ${code}: empty`);
      dicts[code] = j;
      return j;
    }).catch((e) => { delete pendingDicts[code]; throw e; });
  }
  return pendingDicts[code];
}

function applyDict() {
  $$('[data-i18n]').forEach((el) => {
    const v = get(dict, el.dataset.i18n);
    if (typeof v === 'string') el.textContent = v;
  });
  $$('[data-i18n-html]').forEach((el) => {
    const v = get(dict, el.dataset.i18nHtml);
    if (typeof v === 'string') el.innerHTML = v;
  });
  $$('[data-i18n-placeholder]').forEach((el) => {
    const v = get(dict, el.dataset.i18nPlaceholder);
    if (typeof v === 'string') el.setAttribute('placeholder', v);
  });
  $$('[data-i18n-aria]').forEach((el) => {
    const v = get(dict, el.dataset.i18nAria);
    if (typeof v === 'string') el.setAttribute('aria-label', v);
  });
  const titleKey = document.body.dataset.i18nTitle;
  const descKey = document.body.dataset.i18nDescription;
  const title = titleKey ? get(dict, titleKey) : undefined;
  if (typeof title === 'string') document.title = title;
  const desc = descKey ? get(dict, descKey) : undefined;
  const meta = $('meta[name="description"]');
  if (typeof desc === 'string' && meta) meta.setAttribute('content', desc);

  root.lang = lang;
  $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  $$('[data-lang-field]').forEach((i) => { i.value = lang; });
  $$('[data-reply-lang]').forEach((sel) => { if (!sel.dataset.touched) sel.value = REPLY_LANG[lang] || 'English'; });
  $$('[data-count]').forEach((el) => {
    if (el.dataset.done || !cio) el.textContent = fmtNum(parseFloat(el.dataset.count) || 0) + (el.dataset.suffix || '');
    else if (!el.dataset.started) el.textContent = '0' + (el.dataset.suffix || '');
  });
  const bc = $('[data-brand-count]');
  if (bc) bc.innerHTML = esc(t('stage.brandsCount', '{n} brands and counting')).replace('{n}', `<b>${bc.dataset.n || $$('[data-brand]').length}</b>`);
  if (panel && panel.open && panelState) fillPanel(panelState);
  renderPrices();
  window.dispatchEvent(new CustomEvent('bs:lang', { detail: lang }));
}

async function setLang(code, { persist = true } = {}) {
  if (!LANGS.includes(code)) code = 'en';
  const seq = ++langSeq;
  let d;
  try {
    d = await loadDict(code);
  } catch (e) {
    console.warn('[i18n]', e);
    return;
  }
  if (seq !== langSeq) return;           // the visitor has already chosen again
  dict = d;
  lang = code;
  applyDict();
  if (persist) { try { localStorage.setItem('bs-lang', code); } catch (e) { /* private mode */ } }
}

function initialLang() {
  const q = (/[?&]lang=(en|de|fr|es|it)\b/.exec(window.location.search) || [])[1];
  if (q) return { code: q, persist: true };
  try {
    const saved = localStorage.getItem('bs-lang');
    if (saved && LANGS.includes(saved)) return { code: saved, persist: false };
  } catch (e) { /* ignore */ }
  return { code: 'en', persist: false };
}

/* --------------------------------------------------------------------------
   Opening sequence: three petals lock into the B, then the view falls
   through the letter into the page.
   -------------------------------------------------------------------------- */
let readyDone = false;
function ready() {
  if (readyDone) return;
  readyDone = true;
  root.classList.add('is-ready');
  window.dispatchEvent(new Event('bs:ready'));
}

function runIntro() {
  const el = $('[data-intro]');
  const fading = el && el.getAnimations && el.getAnimations().some((a) => a.currentTime > 5400);
  if (!el || !root.classList.contains('has-intro') || root.classList.contains('is-ready') || fading) {
    /* no opening, or the module arrived after the head failsafe lifted it */
    root.classList.remove('has-intro');
    if (el) { el.remove(); try { sessionStorage.setItem('bs-intro', '1'); } catch (e) { /* ignore */ } }
    ready();
    return;
  }
  clearTimeout(window.__bsFailsafe);
  el.style.animation = 'none';
  el.classList.add('is-running');
  const g = $('[data-intro-b]', el);
  const paths = $$('[data-intro-p]', el);
  const count = $('[data-intro-count]', el);
  const B_W = 733.3, B_H = 1000;
  const ZX = 560, ZY = 760, CLEAR = 140;         // a point deep inside the bowl
  const FROM = [
    { x: -1100, y: 420, r: -70 },
    { x: 760, y: -980, r: 55 },
    { x: 980, y: 760, r: 80 }
  ];
  const T_IN = 1050, STAGGER = 120, T_HOLD = 380, T_ZOOM = 1000;
  let W = 0, H = 0, base = 1;
  const measure = () => { W = window.innerWidth; H = window.innerHeight; base = Math.min((H * 0.5) / B_H, (W * 0.56) / B_W); };
  measure();
  window.addEventListener('resize', measure);
  root.classList.add('is-locked');

  let t0 = performance.now();
  let raf = 0, finished = false, released = false;
  const backOut = (x) => { const c1 = 1.25, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', measure);
    root.classList.remove('is-locked');
    root.classList.remove('has-intro');
    el.remove();
    try { sessionStorage.setItem('bs-intro', '1'); } catch (e) { /* ignore */ }
    ready();
  };

  const frame = (now) => {
    const t = now - t0;
    paths.forEach((p, i) => {
      const local = clamp((t - i * STAGGER) / T_IN, 0, 1);
      const a = backOut(local);
      const f = FROM[i];
      p.setAttribute('transform', `translate(${(f.x * (1 - a)).toFixed(1)} ${(f.y * (1 - a)).toFixed(1)}) rotate(${(f.r * (1 - a)).toFixed(2)} ${B_W / 2} ${B_H / 2})`);
      p.style.fillOpacity = clamp(local * 2.4, 0, 1).toFixed(3);
    });
    if (count) count.textContent = String(Math.round(easeOut(clamp(t / (T_IN + STAGGER * 2 + T_HOLD), 0, 1)) * 100)).padStart(3, '0');

    const z = clamp((t - T_IN - STAGGER * 2 - T_HOLD) / T_ZOOM, 0, 1);
    if (z > 0) el.classList.add('is-zooming');
    const sFinal = (Math.hypot(W, H) / 2 / CLEAR) * 1.15;
    const s = base * Math.pow(sFinal / base, Math.pow(z, 1.7));
    const zx0 = W / 2 + (ZX - B_W / 2) * base, zy0 = H / 2 + (ZY - B_H / 2) * base;
    const m = easeInOut(z);
    const zx = zx0 + (W / 2 - zx0) * m, zy = zy0 + (H / 2 - zy0) * m;
    g.setAttribute('transform', `translate(${zx.toFixed(2)} ${zy.toFixed(2)}) scale(${s.toFixed(5)}) translate(${-ZX} ${-ZY})`);
    if (z > 0.6 && !released) { released = true; ready(); }
    if (z >= 1) { finish(); return; }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  const skip = () => {
    if (finished) return;
    el.style.transition = 'opacity .35s ease';
    el.style.opacity = '0';
    ready();
    setTimeout(finish, 360);
  };
  el.addEventListener('click', skip);
  document.addEventListener('keydown', function onKey(e) {
    if (finished) { document.removeEventListener('keydown', onKey); return; }
    if (e.key !== 'Escape' && e.key !== 'Enter' && e.key !== ' ') return;
    /* a focused link (e.g. "Skip to content") still does its job */
    const link = e.target && e.target.closest && e.target.closest('a[href]');
    if (!(link && !el.contains(link) && e.key === 'Enter')) e.preventDefault();
    skip();
  });
}

/* --------------------------------------------------------------------------
   Detail panel (<dialog>) — services and partners
   -------------------------------------------------------------------------- */
const panel = $('[data-panel]');
let panelState = null;
let lastFocus = null;
const svcById = Object.fromEntries(SERVICES.map((s) => [s.id, s]));
let brands = [];

function list(items) {
  return (Array.isArray(items) ? items : []).map((i) => `<li>${esc(i)}</li>`).join('');
}
function fillPanel(state) {
  const media = $('[data-panel-media]', panel);
  const img = $('[data-panel-img]', panel);
  const logo = $('[data-panel-logo]', panel);
  if (state.type === 'service') {
    const s = svcById[state.id];
    if (!s) return false;
    $('[data-panel-eyebrow]', panel).textContent = t('panel.service');
    img.src = `/media/services/${s.id}-1280.webp`;
    img.srcset = `/media/services/${s.id}-640.webp 640w, /media/services/${s.id}-1280.webp 1280w`;
    img.sizes = '(max-width: 860px) 100vw, 860px';
    media.hidden = false;
    logo.hidden = true;
    $('[data-panel-title]', panel).textContent = t(`svc.${s.id}.name`);
    $('[data-panel-tagline]', panel).textContent = t(`svc.${s.id}.tagline`);
    $('[data-panel-body]', panel).textContent = t(`svc.${s.id}.desc`);
    $('[data-panel-list]', panel).innerHTML = list(t(`svc.${s.id}.items`, []));
    $('[data-panel-packs]', panel).innerHTML = pricing
      ? P.servicePricing(s.id, pricing, priceCtx())
      : `<div class="pricing__onrequest"><a class="pkg__cta" href="#contact" data-pkg="service:${s.id}">${esc(t('pricing.panelCta', 'Request an offer'))}<i aria-hidden="true"></i></a></div>`;
    const foot = $('[data-panel-foot]', panel);
    foot.textContent = pricing ? (lang === 'de' ? pricing.vat_note : t('pricing.vat', pricing.vat_note)) : t('pricing.vat');
    foot.hidden = false;
  } else {
    const b = brandAt(state.index);
    if (!b) return false;
    $('[data-panel-eyebrow]', panel).textContent = t('panel.partner');
    media.hidden = true;
    img.removeAttribute('src'); img.removeAttribute('srcset');
    logo.src = b.logo; logo.alt = b.name; logo.hidden = false;
    $('[data-panel-title]', panel).textContent = b.name;
    const cat = BRAND_CATEGORIES[b.category];
    $('[data-panel-tagline]', panel).textContent = [cat ? t(`brands.cat.${cat}`, b.category) : b.category, t('brands.markets', b.markets)].filter(Boolean).join('  ·  ');
    $('[data-panel-body]', panel).textContent = t('brands.summary', b.summary || '');
    $('[data-panel-list]', panel).innerHTML = list(t('brands.work', b.work || []));
    $('[data-panel-packs]', panel).innerHTML = '';
    $('[data-panel-foot]', panel).hidden = true;
  }
  return true;
}

/* The partner texts are shared by all 44 partners and live in the
   dictionaries (brands.*); manifest.json supplies name, logo and category.
   If the manifest has not arrived, the tile itself is enough. */
function brandAt(i) {
  if (brands[i]) return brands[i];
  const tile = $(`[data-brand="${i}"]`);
  if (!tile) return null;
  const img = $('img', tile);
  return { name: ($('.brand-tile__name', tile) || tile).textContent.trim(), logo: img ? img.getAttribute('src') : '', category: '' };
}

function openPanel(state) {
  if (!panel) return;
  if (!fillPanel(state)) return;
  panelState = state;
  lastFocus = document.activeElement;
  if (hero3d && hero3d.pause) hero3d.pause();     // nothing to see behind the modal
  if (typeof panel.showModal === 'function') { if (!panel.open) panel.showModal(); }
  else panel.setAttribute('open', '');
  root.classList.add('is-locked');
  $('.panel__inner', panel).scrollTop = 0;
  $('[data-panel-close]', panel).focus({ preventScroll: true });
}
function closePanel() {
  if (!panel) return;
  if (panel.open && typeof panel.close === 'function') panel.close();
  else { panel.removeAttribute('open'); panel.dispatchEvent(new Event('close')); }
}

/* A package or service request carries its context into the contact form. */
const DISCIPLINE_OF = {
  'brand-strategy': 'Brand strategy', 'marketing-strategy': 'Brand strategy', 'creative-services': 'Brand strategy',
  'digital-marketing': 'Digital marketing', 'website-digital-experience': 'Digital marketing', 'analytics': 'Digital marketing',
  'ai-innovation': 'Digital marketing', 'advertising': 'Digital marketing',
  'social-media-management': 'Content & social', 'content-production': 'Content & social', 'video-multimedia': 'Content & social', 'pr': 'Content & social',
  'event-marketing-promotions': 'Events & experience',
  'corporate-training': 'Corporate training',
  'business-development-support': 'Brand strategy', 'consulting': 'Brand strategy',
  'employer-branding': 'Brand strategy', 'ongoing-client-services': 'Brand strategy'
};
function prefillContact(ref) {
  const form = $('#contact form');
  if (!form) return null;
  let label = '', discipline = '';
  if (ref.startsWith('service:')) {
    const id = ref.slice(8);
    label = t(`svc.${id}.name`);
    discipline = DISCIPLINE_OF[id];
  } else {
    const data = pricing || embeddedPricing();
    const info = data && P.packageLabel(ref, data, priceCtx());
    if (!info) return null;
    label = (info.group === 'social' ? `${t('pricing.socialShort', 'Social Media')} ` : '') + info.name + (info.offer ? ` — ${info.offer}` : '');
    discipline = P.DISCIPLINE_OF_GROUP[ref] || P.DISCIPLINE_OF_GROUP[info.group];
  }
  const sel = form.querySelector('[name="Service"]');
  if (sel && discipline) sel.value = discipline;
  const ta = form.querySelector('[name="Project"]');
  /* replace an earlier prefill, never the visitor's own words */
  if (ta && (!ta.value.trim() || ta.value === ta.dataset.prefill)) {
    ta.value = `${label}: `;
    ta.dataset.prefill = ta.value;
  }
  return ta;
}

if (panel) {
  panel.addEventListener('close', () => {
    if (!header || !header.classList.contains('is-open')) root.classList.remove('is-locked');
    panelState = null;
    if (hero3d && hero3d.resume) hero3d.resume();
    if (lastFocus && lastFocus.focus) {
      lastFocus.focus({ preventScroll: true });
      if (lastFocus.setSelectionRange && lastFocus.value) lastFocus.setSelectionRange(lastFocus.value.length, lastFocus.value.length);
      if (lastFocus.tagName === 'TEXTAREA') {
        const field = lastFocus;
        setTimeout(() => field.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' }), 60);
      }
    }
  });
  panel.addEventListener('click', (e) => {
    if (e.target === panel) { closePanel(); return; }       // backdrop
    if (e.target.closest('[data-panel-close]')) { closePanel(); return; }
  });
  panel.addEventListener('cancel', (e) => { e.preventDefault(); closePanel(); });
}
document.addEventListener('click', (e) => {
  const pkg = e.target.closest('[data-pkg]');
  if (pkg) {
    const field = prefillContact(pkg.dataset.pkg);
    if (panel && panel.open && panel.contains(pkg)) { lastFocus = field; closePanel(); }
    else if (field) {
      /* the #contact link scrolls to the section; then the filled field itself */
      setTimeout(() => {
        field.focus({ preventScroll: true });
        field.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
      }, 700);
    }
    return;
  }
  const svc = e.target.closest('[data-service-open]');
  if (svc) { e.preventDefault(); openPanel({ type: 'service', id: svc.dataset.serviceOpen }); return; }
  const br = e.target.closest('[data-brand]');
  if (br) {
    e.preventDefault();
    const index = Number(br.dataset.brand);
    brandsReady.then(() => openPanel({ type: 'brand', index }));
  }
});

let brandsReady = Promise.resolve();
async function loadBrands() {
  if (!$('[data-brands]')) return;
  try {
    const res = await fetch('/media/brands/manifest.json', { cache: 'no-cache' });
    const list = res.ok ? await res.json() : [];
    brands = list.map((b) => ({ ...b, logo: '/' + String(b.logo || '').replace(/^\/+/, '') }));
  } catch (e) { brands = []; }
}

/* --------------------------------------------------------------------------
   Prices and the October offer, from /data/pricing.json (js/pricing.js)
   -------------------------------------------------------------------------- */
let pricing = null;
let serverSkew = 0;       // how far the server clock is ahead of this device
let expiryTimer = 0;
let shownKey = '';        // the offer state and Berlin day the prices were drawn for
let pillClosed = false;   // a closed pill stays closed even where storage is blocked
/* The offer ends by the later of the device clock and the server clock, so a
   device set back in time cannot keep showing an offer that has ended. */
const nowMs = () => Date.now() + Math.max(0, serverSkew);
const priceCtx = () => P.makeContext({ lang, t: (k, f) => t(k, f), now: nowMs() });
/* besides the language, the drawn prices depend on whether the offer runs
   and, for its countdown, on the calendar day in Berlin */
const priceKey = (now) => (P.offerActive(pricing, now) ? `on|${P.berlinDay(now)}` : 'off');
/* the copy tools/render-pricing.mjs writes into the page, for when the file
   cannot be fetched (or has not arrived yet) */
function embeddedPricing() {
  try { return JSON.parse($('#pricing-data').textContent); } catch (e) { return null; }
}

async function loadPricing() {
  try {
    const res = await fetch('/data/pricing.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`pricing: ${res.status}`);
    const server = Date.parse(res.headers.get('date') || '');
    if (Number.isFinite(server)) serverSkew = server - Date.now();
    pricing = await res.json();
  } catch (e) {
    console.warn('[pricing]', e);
    pricing = embeddedPricing();        // without it, the regular-price markup stays
  }
}

function renderPrices() {
  if (!pricing) return;
  const ctx = priceCtx();
  shownKey = priceKey(ctx.now);
  const box = $('[data-pricing]');
  if (box) box.innerHTML = P.renderPricing(pricing, ctx);
  $$('[data-card-price]').forEach((el) => { el.innerHTML = P.cardPrice(el.dataset.cardPrice, pricing, ctx); });
  renderOfferPill(ctx);
  if (panel && panel.open && panelState) fillPanel(panelState);
  /* the moment the offer ends, everything is drawn again without it */
  clearTimeout(expiryTimer);
  const left = P.offerEnd(pricing) - ctx.now;
  if (left >= 0 && left < 2147000000) expiryTimer = setTimeout(renderPrices, left + 1000);
}
/* Timers stand still while a device sleeps, so the wall clock is checked too:
   once the day changes or the offer ends, the prices are drawn again (and
   only then, so a return to the tab keeps the visitor's focus). */
function checkPrices() { if (pricing && priceKey(nowMs()) !== shownKey) renderPrices(); }

const pill = $('[data-offer-pill]');
const pillKey = () => `bs-offer-x:${pricing && pricing.offer ? pricing.offer.valid_until : ''}`;
function renderOfferPill(ctx) {
  if (!pill) return;
  let dismissed = pillClosed;
  try { dismissed = dismissed || sessionStorage.getItem(pillKey()) === '1'; } catch (e) { /* ignore */ }
  if (!pricing || !P.offerActive(pricing, ctx.now) || dismissed) {
    pill.hidden = true;
    pill.innerHTML = '';
    return;
  }
  const o = P.offerTexts(pricing, ctx);
  const href = $('[data-pricing]') ? '#pricing' : '/#pricing';
  pill.setAttribute('aria-label', o.name);
  pill.innerHTML = `<a class="offer-pill__link" href="${href}">
      <b class="offer-pill__name">${esc(o.name)}</b>
      <span class="offer-pill__text">
        <span class="offer-pill__headline">${esc(o.headline)}</span>
        <span class="offer-pill__meta"><span class="offer-pill__until">${esc(o.until)} · ${esc(o.left)}</span>
          <span class="offer-pill__cta">${esc(o.cta)}<i aria-hidden="true"></i></span></span>
      </span>
    </a>
    <button class="offer-pill__close" type="button" data-offer-close aria-label="${esc(t('pricing.offer.close', 'Close'))}"><svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
  pill.hidden = false;
}
if (pill) {
  pill.addEventListener('click', (e) => {
    if (!e.target.closest('[data-offer-close]')) return;
    pillClosed = true;
    try { sessionStorage.setItem(pillKey(), '1'); } catch (err) { /* ignore */ }
    pill.hidden = true;
  });
  /* out of the way where the prices or the form are already on screen */
  if ('IntersectionObserver' in window) {
    const seen = new Set();
    const pio = new IntersectionObserver((es) => {
      es.forEach((en) => { if (en.isIntersecting) seen.add(en.target); else seen.delete(en.target); });
      pill.classList.toggle('is-tucked', seen.size > 0);
    }, { threshold: 0 });
    ['#pricing', '#contact', '.site-footer', '.mini-footer'].forEach((sel) => { const el = $(sel); if (el) pio.observe(el); });
  }
}
/* a tab left open over midnight or the deadline, woken from sleep, or
   restored from the cache */
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkPrices(); });
window.addEventListener('pageshow', (e) => { if (e.persisted) checkPrices(); });
window.addEventListener('focus', checkPrices);

/* --------------------------------------------------------------------------
   Header: scrolled state, tone underneath, drawer, language buttons,
   current section
   -------------------------------------------------------------------------- */
const header = $('[data-header]');
const burger = $('[data-burger]');
function setDrawer(open) {
  if (!header || header.classList.contains('is-open') === open) return;
  header.classList.toggle('is-open', open);
  burger?.setAttribute('aria-expanded', String(open));
  /* an open panel keeps its own scroll lock */
  root.classList.toggle('is-locked', open || !!(panel && panel.open));
  /* keyboard focus stays inside the open menu */
  ['#main', '.site-footer', '.skip', '.site-header .brand', '[data-offer-pill]'].forEach((sel) => { const el = $(sel); if (el) el.inert = open; });
  if (open) $('.nav__links a', header)?.focus();
}
burger?.addEventListener('click', () => setDrawer(!header.classList.contains('is-open')));
$('[data-nav]')?.addEventListener('click', (e) => { if (e.target.closest('a')) setDrawer(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && header?.classList.contains('is-open')) { setDrawer(false); burger?.focus(); } });
window.matchMedia('(min-width: 1301px)').addEventListener('change', (e) => { if (e.matches) setDrawer(false); });
$$('[data-lang]').forEach((b) => b.addEventListener('click', () => {
  const wasOpen = !!(header && header.classList.contains('is-open'));
  setLang(b.dataset.lang);
  setDrawer(false);
  if (wasOpen) burger?.focus();
}));

const progressBar = $('[data-progress]');
function onScrollUi() {
  const y = window.scrollY || 0;
  if (header) {
    header.classList.toggle('is-scrolled', y > 24);
    const probe = document.elementFromPoint(16, Math.min(header.offsetHeight + 4, 90));
    const sec = probe && probe.closest('.tone-forest, .tone-lime, .tone-paper, .tone-mist, .site-footer');
    header.classList.toggle('on-forest', !!sec && sec.classList.contains('tone-forest'));
    header.classList.toggle('on-lime', !!sec && sec.classList.contains('tone-lime'));
  }
  if (progressBar) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1).toFixed(4) : 0})`;
  }
}
let uiTick = false;
window.addEventListener('scroll', () => {
  if (uiTick) return;
  uiTick = true;
  requestAnimationFrame(() => { uiTick = false; onScrollUi(); });
}, { passive: true });
window.addEventListener('resize', onScrollUi);

(function scrollSpy() {
  const links = $$('.nav__links a[href^="#"]');
  if (!links.length || !('IntersectionObserver' in window)) return;
  const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  /* the last section in document order that crosses the middle band wins,
     so the price list (inside services) hands back to services above it */
  const live = new Set();
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) live.add(en.target); else live.delete(en.target); });
    if (!live.size) return;
    const cur = [...live].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)).pop();
    links.forEach((a) => a.removeAttribute('aria-current'));
    byId.get(cur.id)?.setAttribute('aria-current', 'true');
  }, { rootMargin: '-45% 0px -50% 0px' });
  byId.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });
  /* back at the top, no section is current */
  const top = document.getElementById('top');
  if (top) spy.observe(top);
})();

/* --------------------------------------------------------------------------
   Reveal on scroll + counters
   -------------------------------------------------------------------------- */
const io = ('IntersectionObserver' in window) ? new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add('is-in');
    io.unobserve(en.target);
  });
}, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }) : null;
root.classList.add('reveal-on');
$$('.reveal').forEach((el) => { if (io && !reduceMotion) io.observe(el); else el.classList.add('is-in'); });

const cio = ('IntersectionObserver' in window && !reduceMotion) ? new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    const el = en.target;
    cio.unobserve(el);
    const target = parseFloat(el.dataset.count) || 0;
    const suffix = el.dataset.suffix || '';
    el.dataset.started = '1';
    const dur = 1700, start = performance.now();
    const tick = (now) => {
      const p = clamp((now - start) / dur, 0, 1);
      if (p >= 1) { el.dataset.done = '1'; el.textContent = fmtNum(target) + suffix; return; }
      el.textContent = fmtNum(Math.round(target * easeOut(p))) + suffix;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}, { threshold: 0.6 }) : null;
$$('[data-count]').forEach((el) => {
  if (cio) { el.textContent = '0' + (el.dataset.suffix || ''); cio.observe(el); }
  else { el.dataset.done = '1'; }
});

/* --------------------------------------------------------------------------
   Marquee: duplicate the row once so the CSS loop is seamless
   -------------------------------------------------------------------------- */
const marquee = $('[data-marquee]');
if (marquee && !reduceMotion) {
  const copy = marquee.cloneNode(true);
  Array.from(copy.children).forEach((c) => { c.setAttribute('aria-hidden', 'true'); marquee.appendChild(c); });
}

/* --------------------------------------------------------------------------
   Tilt and parallax (pointer devices, motion allowed)
   -------------------------------------------------------------------------- */
if (!reduceMotion && finePointer) {
  $$('[data-tilt]').forEach((card) => {
    let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0, on = false;
    const step = () => {
      cx += (tx - cx) * 0.14; cy += (ty - cy) * 0.14;
      card.style.transform = `perspective(1300px) rotateX(${(-cy * 6).toFixed(2)}deg) rotateY(${(cx * 7).toFixed(2)}deg)`;
      if (on || Math.abs(cx) > 0.002 || Math.abs(cy) > 0.002) raf = requestAnimationFrame(step);
      else { raf = 0; card.style.transform = ''; }
    };
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      on = true;
      if (!raf) raf = requestAnimationFrame(step);
    });
    card.addEventListener('pointerleave', () => { on = false; tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(step); });
  });
}
if (!reduceMotion) {
  const par = $$('[data-parallax]');
  if (par.length) {
    const upd = () => par.forEach((img) => {
      const r = img.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      const k = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
      img.style.transform = `translate3d(0, ${(-8 + k * 14).toFixed(2)}%, 0)`;
    });
    window.addEventListener('scroll', () => requestAnimationFrame(upd), { passive: true });
    upd();
  }
}

/* --------------------------------------------------------------------------
   Hero runway: the hero pins, the copy steps back, the B blooms apart and
   its petals become the eighteen services.
   -------------------------------------------------------------------------- */
const hero = $('[data-hero]');
const petalsEl = $('[data-petals]');
let hero3d = null;
const runway = { on: false, p: 0, geo: [], originX: 0, originY: 0, raf: 0, inView: true, pageVisible: !document.hidden };

function wantsRunway() {
  if (!hero || !petalsEl) return false;
  const o = motionOverride();
  if (o === 'reduced') return false;
  if (reduceMotion && o !== 'full') return false;
  /* landscape phones and short phones read the list instead */
  if (o !== 'full' && (window.innerHeight < 540 || (window.innerWidth < 720 && window.innerHeight < 680))) return false;
  return true;
}

/* Returns false when the eighteen petals do not fit the pinned screen (a
   short window, a long translation); the caller then falls back to the list. */
function layoutRunway() {
  if (!runway.on) return false;
  const pin = $('[data-hero-pin]');
  const pr = pin.getBoundingClientRect();
  const btns = $$('.petal-btn', petalsEl);
  btns.forEach((b) => { b.style.transform = 'none'; });
  const field = $('[data-petal-field]', petalsEl);
  if (field && motionOverride() !== 'full' && field.getBoundingClientRect().bottom - pr.top > pr.height - 8) {
    teardownRunway();
    return false;
  }
  /* where the petals come from: the letter, wherever the layout put it */
  let ox = pr.width * 0.7, oy = pr.height * 0.55;
  const a = hero3d && hero3d.anchor ? hero3d.anchor() : null;
  if (a && Number.isFinite(a.x) && Number.isFinite(a.y)) { ox = a.x; oy = a.y; }
  else {
    const st = $('.hero__static', hero);
    if (st) { const r = st.getBoundingClientRect(); if (r.width) { ox = r.left - pr.left + r.width / 2; oy = r.top - pr.top + r.height / 2; } }
  }
  runway.originX = ox; runway.originY = oy;
  runway.geo = btns.map((b, i) => {
    const r = b.getBoundingClientRect();
    const cx = r.left - pr.left + r.width / 2, cy = r.top - pr.top + r.height / 2;
    const dist = Math.hypot(cx - ox, cy - oy);
    return { el: b, dx: ox - cx, dy: oy - cy, dist, rz: ((i * 47) % 70) - 35, ry: ((i * 29) % 90) - 45, rx: ((i * 61) % 50) - 25 };
  });
  const maxD = Math.max(1, ...runway.geo.map((g) => g.dist));
  runway.geo.forEach((g) => { g.order = g.dist / maxD; });
  paintRunway(true);
  return true;
}

function runwayProgress() {
  const top = hero.getBoundingClientRect().top;
  const dist = hero.offsetHeight - window.innerHeight;
  return dist > 0 ? clamp(-top / dist, 0, 1) : 0;
}

const copyEl = $('[data-hero-copy]');
const headEl = petalsEl ? $('.petals__head', petalsEl) : null;
const stageEl = $('[data-hero-stage]');
function paintRunway(force) {
  const p = runwayProgress();
  const moved = Math.abs(p - runway.p) > 0.0004;
  runway.p = p;
  const time = performance.now() / 1000;
  /* copy steps back */
  const k = easeInOut(span(p, 0.03, 0.2));
  if (copyEl && (moved || force)) {
    copyEl.style.opacity = (1 - k).toFixed(3);
    copyEl.style.transform = k ? `translate3d(0, ${(-k * 90).toFixed(1)}px, 0) scale(${(1 - k * 0.05).toFixed(4)})` : '';
    copyEl.style.visibility = k > 0.995 ? 'hidden' : '';
  }
  hero.classList.toggle('is-past-copy', p > 0.06);
  if (hero3d && hero3d.setProgress) hero3d.setProgress(p);
  if (stageEl) stageEl.style.opacity = (1 - 0.72 * easeInOut(span(p, 0.1, 0.34))).toFixed(3);
  /* the stage title */
  const h = easeOut(span(p, 0.2, 0.36));
  if (headEl) {
    headEl.style.opacity = h.toFixed(3);
    headEl.style.transform = `translate3d(0, ${((1 - h) * 34 - span(p, 0.6, 1) * 16).toFixed(1)}px, 0)`;
  }
  /* the petals bloom out of the letter, nearest first */
  let live = 0;
  runway.geo.forEach((g, i) => {
    const start = 0.18 + g.order * 0.26;
    const e = easeOut(span(p, start, start + 0.22));
    const inv = 1 - e;
    const drift = e > 0.999 ? Math.sin(time * 0.9 + i * 1.7) * 3 : 0;
    const lift = span(p, 0.6, 1) * -16;
    g.el.style.opacity = clamp(e * 1.8, 0, 1).toFixed(3);
    g.el.style.transform = inv > 0.0005
      ? `translate3d(${(g.dx * inv).toFixed(1)}px, ${(g.dy * inv + lift).toFixed(1)}px, ${(-520 * inv).toFixed(1)}px) rotateX(${(g.rx * inv).toFixed(2)}deg) rotateY(${(g.ry * inv).toFixed(2)}deg) rotateZ(${(g.rz * inv).toFixed(2)}deg) scale(${(0.35 + 0.65 * e).toFixed(4)})`
      : `translate3d(0, ${(drift + lift).toFixed(2)}px, 0)`;
    if (e > 0.85) live++;
  });
  petalsEl.classList.toggle('is-live', live > runway.geo.length * 0.6);
}

const runwayLive = () => runway.on && runway.inView && runway.pageVisible;
function runwayLoop() {
  runway.raf = 0;
  if (!runwayLive()) return;
  paintRunway(false);
  runway.raf = requestAnimationFrame(runwayLoop);
}
function kickRunway() { if (!runway.raf && runwayLive()) runway.raf = requestAnimationFrame(runwayLoop); }

/* Switching the runway on or off changes the hero's height by hundreds of
   pixels. Keep the reader where they are: on the deep-link target until they
   scroll themselves, otherwise on the first section after the hero. */
let userScrolled = false;
['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((type) => window.addEventListener(type, () => { userScrolled = true; }, { once: true, passive: true }));
function keepPlace(change) {
  const was = runway.on;
  const id = location.hash.length > 1 ? decodeURIComponent(location.hash.slice(1)) : '';
  const target = !userScrolled && id ? document.getElementById(id) : null;
  const next = hero.nextElementSibling;
  const past = hero.getBoundingClientRect().bottom <= 0;
  const t0 = past && next ? next.getBoundingClientRect().top : 0;
  const result = change();
  if (runway.on !== was) {
    if (target && (hero.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING)) target.scrollIntoView({ behavior: 'instant' });
    else if (past && next) window.scrollBy({ top: next.getBoundingClientRect().top - t0, behavior: 'instant' });
  }
  return result;
}

/* Decide (again) whether the runway runs: on load, on resize or rotation,
   after a language switch and once the fonts are in. */
function evaluateRunway() { return keepPlace(evaluateRunwayNow); }
function evaluateRunwayNow() {
  if (!wantsRunway()) {
    if (runway.on) teardownRunway();
    root.classList.remove('runway');
    return;
  }
  if (!runway.on) { runway.on = true; root.classList.add('runway'); }
  if (layoutRunway()) kickRunway();
}

function setupRunway() {
  if (!hero || !petalsEl) { root.classList.remove('runway'); return; }
  evaluateRunway();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => { runway.inView = es[0].isIntersecting; kickRunway(); }).observe(hero);
  }
  document.addEventListener('visibilitychange', () => { runway.pageVisible = !document.hidden; kickRunway(); });
  let rt = 0, lastW = window.innerWidth;
  const relayout = (e) => {
    /* an on-screen keyboard only changes the height: leave the page alone */
    if (e && e.type === 'resize' && window.innerWidth === lastW && document.activeElement && document.activeElement.matches('input, textarea, select')) return;
    clearTimeout(rt);
    rt = setTimeout(() => { lastW = window.innerWidth; evaluateRunway(); }, 140);
  };
  window.addEventListener('resize', relayout);
  window.addEventListener('bs:lang', relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => relayout()).catch(() => {});
  /* a keyboard visitor tabbing into the petals is taken to where they are open */
  petalsEl.addEventListener('focusin', (e) => {
    if (!runway.on || runway.p >= 0.62 || !e.target.matches(':focus-visible')) return;
    const dist = hero.offsetHeight - window.innerHeight;
    const target = hero.getBoundingClientRect().top + window.scrollY + dist * 0.66;
    window.scrollTo({ top: target, behavior: 'instant' });
  });
}
function teardownRunway() {
  runway.on = false;
  root.classList.remove('runway');
  [copyEl, headEl, stageEl].forEach((el) => { if (el) { el.style.opacity = ''; el.style.transform = ''; el.style.visibility = ''; } });
  $$('.petal-btn', petalsEl).forEach((b) => { b.style.opacity = ''; b.style.transform = ''; });
  if (hero3d && hero3d.release) hero3d.release();
}

/* --------------------------------------------------------------------------
   3D hero — only where it can run well
   -------------------------------------------------------------------------- */
async function mountHero3D() {
  const stage = $('[data-hero-stage]');
  if (!hero || !stage) return;
  const o = motionOverride();
  if (o === 'reduced') return;
  if (reduceMotion && o !== 'full') return;
  const conn = navigator.connection;
  if (conn && (conn.saveData || /^(slow-)?2g$/.test(conn.effectiveType || '')) && o !== 'full') return;
  try {
    const c = document.createElement('canvas');
    if (!(c.getContext('webgl2') || c.getContext('webgl'))) return;
  } catch (e) { return; }
  try {
    const mod = await import('./hero3d.js');
    /* the static B is already on screen: take over from it in place */
    hero3d = mod.mountHero(stage, { external: runway.on, assembled: true });
    if (hero3d) {
      hero.classList.add('has-3d');
      if (runway.on && keepPlace(layoutRunway)) kickRunway();
    }
  } catch (e) {
    console.warn('[hero3d] not mounted:', e);
  }
}

/* --------------------------------------------------------------------------
   Forms: Formspree + Netlify Forms, then a mailto fallback
   -------------------------------------------------------------------------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
$$('[data-form]').forEach((form) => {
  const status = $('[data-form-status]', form);
  const btn = $('[data-submit]', form);
  const thanks = form.getAttribute('action') || '/thank-you/';
  const next = $('[data-next]', form);
  if (next) next.value = new URL(thanks, window.location.origin).href;
  const show = (msg, kind) => {
    if (!status) return;
    status.textContent = msg;
    status.classList.toggle('is-error', kind === 'error');
    status.classList.toggle('is-ok', kind === 'ok');
  };
  const sendingKey = form.dataset.sendingKey || 'form.sendingMsg';
  const sendKey = form.dataset.sendKey || 'form.send';
  /* English wording if no dictionary could be loaded at all */
  const FALLBACK = {
    send: btn ? btn.textContent.trim() : 'Send',
    sending: 'Sending…',
    sendingMsg: `Sending to ${COMPANY.email} …`,
    invalidEmail: 'Please enter a valid email address so we can reply.',
    fallback: `We could not reach the mail service. Opening your mail app addressed to ${COMPANY.email} — just press send.`,
    error: `Something went wrong. Please write to us directly at ${COMPANY.email}.`
  };
  let sending = false;
  const resetButton = () => {
    if (!btn) return;
    btn.disabled = false;
    btn.innerHTML = `<span data-i18n="${sendKey}">${esc(t(sendKey, FALLBACK.send))}</span><i class="dot" aria-hidden="true"></i>`;
  };
  /* Back from the thank-you page restores this exact DOM from the
     back/forward cache: put the button and the status line back. */
  window.addEventListener('pageshow', (ev) => {
    if (!ev.persisted) return;
    sending = false;
    resetButton();
    if (status) { status.textContent = ''; status.className = 'form__status'; }
  });
  const email = form.querySelector('[name="Email"]');
  email?.addEventListener('input', () => { email.setCustomValidity(''); email.removeAttribute('aria-invalid'); });
  window.addEventListener('bs:lang', () => { if (email && email.getAttribute('aria-invalid')) email.setCustomValidity(t('form.invalidEmail', FALLBACK.invalidEmail)); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    const trap = ['_honey', 'bot-field'].some((n) => { const f = form.querySelector(`[name="${n}"]`); return f && f.value; });
    if (trap) { window.location.href = thanks; return; }
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (email && !EMAIL_RE.test(email.value.trim())) {
      /* a message at the field itself, announced by assistive tech */
      email.setCustomValidity(t('form.invalidEmail', FALLBACK.invalidEmail));
      email.setAttribute('aria-invalid', 'true');
      email.reportValidity();
      return;
    }
    sending = true;
    if (btn) { btn.disabled = true; btn.textContent = t('form.sending', FALLBACK.sending); }
    show(t(sendingKey, FALLBACK.sendingMsg), 'ok');
    const subject = form.dataset.subject || 'Neue Anfrage über bluetensturm.com';
    try {
      const r = await sendEnquiry(form, subject);
      if (r.ok) {
        try { sessionStorage.setItem('bs-sent', form.getAttribute('name') || '1'); } catch (err) { /* ignore */ }
        window.location.href = thanks;
        return;
      }
      show(t('form.fallback', FALLBACK.fallback), 'error');
      window.location.href = r.href;
    } catch (err) {
      /* never lose a lead: hand it to the visitor's mail app */
      show(t('form.fallback', FALLBACK.fallback), 'error');
      try { window.location.href = fallbackHref(form, subject); } catch (e2) { show(t('form.error', FALLBACK.error), 'error'); }
    }
    sending = false;
    resetButton();
  });
});

$$('[data-reply-lang]').forEach((sel) => sel.addEventListener('change', () => { sel.dataset.touched = '1'; }));

/* --------------------------------------------------------------------------
   Contact weather: the Higgsfield petal loop, fetched only when near
   -------------------------------------------------------------------------- */
(function weather() {
  const box = $('[data-weather]');
  const video = box && $('video', box);
  if (!video) return;
  const conn = navigator.connection;
  const thrifty = !!(conn && (conn.saveData || /^(slow-)?2g$/.test(conn.effectiveType || '')));
  if (reduceMotion || thrifty) { video.remove(); return; }
  const start = () => {
    if (video.dataset.loaded) return;
    video.dataset.loaded = '1';
    const hd = window.innerWidth >= 1100 && (!conn || !/^3g$/.test(conn.effectiveType || ''));
    /* H.264 where the browser has it, VP9 WebM where it does not */
    const h264 = video.canPlayType('video/mp4; codecs="avc1.640028"');
    const useWebm = !h264 && video.canPlayType('video/webm; codecs="vp9"');
    video.src = useWebm ? (hd ? video.dataset.webmHd : video.dataset.webmSd) : (hd ? video.dataset.srcHd : video.dataset.srcSd);
    video.poster = '/media/gen/weather-petals-900.webp';
    video.addEventListener('playing', () => video.classList.add('is-playing'), { once: true });
    video.addEventListener('error', () => video.remove(), { once: true });
    const p = video.play();
    if (p && p.catch) p.catch(() => { video.classList.add('is-playing'); /* autoplay refused: show the still */ });
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => {
      es.forEach((en) => {
        if (en.isIntersecting) { start(); if (video.paused && video.src) video.play().catch(() => {}); }
        else if (video.src && !video.paused) video.pause();
      });
    }, { rootMargin: '400px 0px' }).observe(box);
  } else start();
})();

/* --------------------------------------------------------------------------
   Thank-you page: the conversion signal, once per landing
   -------------------------------------------------------------------------- */
(function conversion() {
  if (!document.body.hasAttribute('data-conversion')) return;
  /* only a real submission counts: not a reload, a direct visit or a bot */
  let form = null;
  try { form = sessionStorage.getItem('bs-sent'); sessionStorage.removeItem('bs-sent'); } catch (e) { /* ignore */ }
  if (!form) return;
  try {
    /* Google Ads / GA4: replace AW-XXXXXXXXX/YYYYYYYY with the real
       conversion label (Goals → Conversions → enquiry → tag setup). */
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'conversion', { send_to: 'AW-XXXXXXXXX/YYYYYYYY' });
      window.gtag('event', 'generate_lead', { currency: 'EUR', value: 1 });
    }
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'enquiry_submitted', form, page: 'thank-you' });
  } catch (e) { /* never let tracking break the page */ }
})();

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */
(async function boot() {
  onScrollUi();
  setupRunway();
  runIntro();
  /* The 3D scene compiles shaders and builds geometry on the main thread;
     doing that under the opening would stutter it, so it waits its turn. */
  if (readyDone) mountHero3D();
  else window.addEventListener('bs:ready', () => setTimeout(mountHero3D, 650), { once: true });
  /* a partner click waits for the manifest, but never for long */
  brandsReady = Promise.race([loadBrands(), new Promise((r) => setTimeout(r, 1500))]);
  if (pill || $('[data-pricing]') || $('[data-card-price]')) {
    loadPricing().then(() => {
      renderPrices();
      /* while an offer runs: the wall-clock check behind its countdown and end */
      if (pricing && P.offerActive(pricing, nowMs())) setInterval(checkPrices, 15000);
    });
  }
  if (fixedLang) {
    /* German-only pages: keep the markup's language and never relabel it */
    lang = fixedLang;
    return;
  }
  const first = initialLang();
  /* English is the fallback for any missing key; fetch it alongside, not first */
  const en = loadDict('en').catch((e) => console.warn('[i18n] en.json unavailable:', e));
  await setLang(first.code, { persist: first.persist });
  await en;
  /* a page restored from the back/forward cache follows a later choice */
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    let saved = null;
    try { saved = localStorage.getItem('bs-lang'); } catch (err) { /* ignore */ }
    if (saved && LANGS.includes(saved) && saved !== lang) setLang(saved, { persist: false });
  });
})();

export { COMPANY };
