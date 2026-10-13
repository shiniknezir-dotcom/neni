/* ==========================================================================
   Blüten Sturm — page behaviour (ES module, no framework)
   One module for every page: the home page, the questionnaire, the thank-you
   page, the legal pages and the 404. Each feature looks for its markup and
   stays out of the way where that markup is missing.
   ========================================================================== */

import { SERVICES, BRAND_CATEGORIES, COMPANY } from './data.js';

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

async function loadDict(code) {
  if (dicts[code]) return dicts[code];
  const res = await fetch(`/i18n/${code}.json`);
  if (!res.ok) throw new Error(`i18n ${code}: ${res.status}`);
  dicts[code] = await res.json();
  return dicts[code];
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
    if (el.dataset.done || !el.dataset.started) el.textContent = fmtNum(parseFloat(el.dataset.count) || 0) + (el.dataset.suffix || '');
  });
  const bc = $('[data-brand-count]');
  if (bc) bc.innerHTML = esc(t('stage.brandsCount', '{n} brands and counting')).replace('{n}', `<b>${bc.dataset.n || $$('[data-brand]').length}</b>`);
  if (panel && panel.open && panelState) fillPanel(panelState);
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
  if (!el || !root.classList.contains('has-intro')) { ready(); return; }
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
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); skip(); }
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
function pack(tier, s) {
  const [price, unit] = s[tier];
  const cta = t(tier === 'premium' ? 'panel.reqPremium' : 'panel.reqNormal');
  return `<div class="pack${tier === 'premium' ? ' pack--premium' : ''}">
    <p class="pack__tier">${esc(t(`panel.${tier}`))}</p>
    <p class="pack__price"><span>${esc(t('panel.from'))}</span> <b>${esc(price)}</b> <em>${esc(t(`panel.unit.${unit}`))}</em></p>
    <ul class="pack__list">${list(t(`svc.${s.id}.${tier}`, []))}</ul>
    <a class="btn btn--sm${tier === 'premium' ? ' btn--lime' : ''}" href="#contact" data-panel-cta data-tier="${tier}" data-service="${s.id}">${esc(cta)}<i class="dot" aria-hidden="true"></i></a>
  </div>`;
}

function fillPanel(state) {
  const media = $('[data-panel-media]', panel);
  const img = $('[data-panel-img]', panel);
  const logo = $('[data-panel-logo]', panel);
  if (state.type === 'service') {
    const s = svcById[state.id];
    if (!s) return;
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
    $('[data-panel-packs]', panel).innerHTML = pack('normal', s) + pack('premium', s);
    $('[data-panel-foot]', panel).hidden = false;
  } else {
    const b = brands[state.index];
    if (!b) return;
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
}

function openPanel(state) {
  if (!panel) return;
  panelState = state;
  fillPanel(state);
  lastFocus = document.activeElement;
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

/* A tier request carries its context into the contact form. */
const DISCIPLINE_OF = {
  'brand-strategy': 'Brand strategy', 'marketing-strategy': 'Brand strategy', 'creative-services': 'Brand strategy',
  'digital-marketing': 'Digital marketing', 'website-digital-experience': 'Digital marketing', 'analytics': 'Digital marketing',
  'ai-innovation': 'Digital marketing', 'advertising': 'Digital marketing',
  'social-media-management': 'Content & social', 'content-production': 'Content & social', 'video-multimedia': 'Content & social', 'pr': 'Content & social',
  'event-marketing-promotions': 'Events & experience',
  'corporate-training': 'Corporate training'
};
function prefillContact(serviceId, tier) {
  const form = $('#contact form');
  if (!form) return;
  const sel = form.querySelector('[name="Service"]');
  const want = DISCIPLINE_OF[serviceId];
  if (sel && want) sel.value = want;
  const ta = form.querySelector('[name="Project"]');
  if (ta && !ta.value.trim()) ta.value = `${t(`svc.${serviceId}.name`)} — ${t(`panel.${tier}`)}: `;
}

if (panel) {
  panel.addEventListener('close', () => {
    root.classList.remove('is-locked');
    panelState = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  });
  panel.addEventListener('click', (e) => {
    if (e.target === panel) { closePanel(); return; }       // backdrop
    if (e.target.closest('[data-panel-close]')) { closePanel(); return; }
    const cta = e.target.closest('[data-panel-cta]');
    if (cta) {
      prefillContact(cta.dataset.service, cta.dataset.tier);
      lastFocus = null;
      closePanel();
    }
  });
  panel.addEventListener('cancel', (e) => { e.preventDefault(); closePanel(); });
}
document.addEventListener('click', (e) => {
  const svc = e.target.closest('[data-service-open]');
  if (svc) { e.preventDefault(); openPanel({ type: 'service', id: svc.dataset.serviceOpen }); return; }
  const br = e.target.closest('[data-brand]');
  if (br) { e.preventDefault(); openPanel({ type: 'brand', index: Number(br.dataset.brand) }); }
});

async function loadBrands() {
  if (!$('[data-brands]')) return;
  try {
    const res = await fetch('/media/brands/manifest.json');
    const list = res.ok ? await res.json() : [];
    brands = list.map((b) => ({ ...b, logo: '/' + String(b.logo || '').replace(/^\/+/, '') }));
  } catch (e) { brands = []; }
}

/* --------------------------------------------------------------------------
   Header: scrolled state, tone underneath, drawer, language buttons,
   current section
   -------------------------------------------------------------------------- */
const header = $('[data-header]');
const burger = $('[data-burger]');
function setDrawer(open) {
  if (!header) return;
  header.classList.toggle('is-open', open);
  burger?.setAttribute('aria-expanded', String(open));
  root.classList.toggle('is-locked', open);
}
burger?.addEventListener('click', () => setDrawer(!header.classList.contains('is-open')));
$('[data-nav]')?.addEventListener('click', (e) => { if (e.target.closest('a')) setDrawer(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && header?.classList.contains('is-open')) { setDrawer(false); burger?.focus(); } });
window.matchMedia('(min-width: 1181px)').addEventListener('change', (e) => { if (e.matches) setDrawer(false); });
$$('[data-lang]').forEach((b) => b.addEventListener('click', () => { setLang(b.dataset.lang); setDrawer(false); }));

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
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((a) => a.removeAttribute('aria-current'));
      byId.get(en.target.id)?.setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  byId.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });
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
      const p = Math.min(1, (now - start) / dur);
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
const runway = { on: false, p: 0, geo: [], originX: 0, originY: 0, raf: 0, visible: true };

function wantsRunway() {
  if (!hero || !petalsEl) return false;
  const o = motionOverride();
  if (o === 'reduced') return false;
  if (reduceMotion && o !== 'full') return false;
  /* landscape phones and short phones read the list instead */
  if (o !== 'full' && (window.innerHeight < 540 || (window.innerWidth < 720 && window.innerHeight < 680))) return false;
  return true;
}

function layoutRunway() {
  if (!runway.on) return;
  const pin = $('[data-hero-pin]');
  const pr = pin.getBoundingClientRect();
  const btns = $$('.petal-btn', petalsEl);
  btns.forEach((b) => { b.style.transform = 'none'; });
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
  const runLen = window.innerWidth < 720 ? 280 : 300;
  hero.style.setProperty('--runway', `${runLen}vh`);
  paintRunway(true);
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

function runwayLoop() {
  runway.raf = 0;
  if (!runway.on || !runway.visible) return;
  paintRunway(false);
  runway.raf = requestAnimationFrame(runwayLoop);
}
function kickRunway() { if (!runway.raf && runway.on) runway.raf = requestAnimationFrame(runwayLoop); }

function setupRunway() {
  if (!wantsRunway()) return;
  runway.on = true;
  root.classList.add('runway');
  layoutRunway();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => { runway.visible = es[0].isIntersecting; if (runway.visible) kickRunway(); }).observe(hero);
  }
  document.addEventListener('visibilitychange', () => { runway.visible = !document.hidden; if (runway.visible) kickRunway(); });
  let rt = 0;
  const relayout = () => { clearTimeout(rt); rt = setTimeout(() => {
    if (!wantsRunway()) { teardownRunway(); return; }
    layoutRunway();
  }, 140); };
  window.addEventListener('resize', relayout);
  window.addEventListener('bs:lang', relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout).catch(() => {});
  /* a keyboard visitor tabbing into the petals is taken to where they are open */
  petalsEl.addEventListener('focusin', () => {
    if (!runway.on || runway.p >= 0.62) return;
    const dist = hero.offsetHeight - window.innerHeight;
    const target = hero.getBoundingClientRect().top + window.scrollY + dist * 0.66;
    window.scrollTo({ top: target, behavior: 'auto' });
  });
  kickRunway();
}
function teardownRunway() {
  runway.on = false;
  root.classList.remove('runway');
  hero.style.removeProperty('--runway');
  [copyEl, headEl, stageEl].forEach((el) => { if (el) { el.style.opacity = ''; el.style.transform = ''; el.style.visibility = ''; } });
  $$('.petal-btn', petalsEl).forEach((b) => { b.style.opacity = ''; b.style.transform = ''; });
  if (hero3d && hero3d.setProgress) hero3d.setProgress(0);
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
      if (runway.on) { layoutRunway(); kickRunway(); }
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
    status.hidden = false;
    status.textContent = msg;
    status.classList.toggle('is-error', kind === 'error');
    status.classList.toggle('is-ok', kind === 'ok');
  };
  const sendingKey = form.dataset.sendingKey || 'form.sendingMsg';
  const sendKey = form.dataset.sendKey || 'form.send';
  let sending = false;
  const resetButton = () => {
    if (!btn) return;
    btn.disabled = false;
    btn.innerHTML = `<span data-i18n="${sendKey}">${esc(t(sendKey))}</span><i class="dot" aria-hidden="true"></i>`;
  };
  /* Back from the thank-you page restores this exact DOM from the
     back/forward cache: put the button and the status line back. */
  window.addEventListener('pageshow', (ev) => {
    if (!ev.persisted) return;
    sending = false;
    resetButton();
    if (status) { status.hidden = true; status.textContent = ''; }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    const trap = ['_honey', 'bot-field'].some((n) => { const f = form.querySelector(`[name="${n}"]`); return f && f.value; });
    if (trap) { window.location.href = thanks; return; }
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const email = form.querySelector('[name="Email"]');
    if (email && !EMAIL_RE.test(email.value.trim())) { show(t('form.invalidEmail'), 'error'); email.focus(); return; }
    sending = true;
    if (btn) { btn.disabled = true; btn.textContent = t('form.sending'); }
    show(t(sendingKey), 'ok');
    try {
      const mod = await import('./form-send.js');
      const r = await mod.sendEnquiry(form, form.dataset.subject || 'Neue Anfrage über bluetensturm.com');
      if (r.ok) {
        try { sessionStorage.setItem('bs-sent', form.getAttribute('name') || '1'); } catch (err) { /* ignore */ }
        window.location.href = thanks;
        return;
      }
      show(t('form.fallback'), 'error');
      window.location.href = r.href;
    } catch (err) {
      show(t('form.error'), 'error');
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
    video.addEventListener('playing', () => video.classList.add('is-playing'), { once: true });
    video.addEventListener('error', () => video.remove(), { once: true });
    const p = video.play();
    if (p && p.catch) p.catch(() => { /* autoplay refused: the poster stays */ });
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
  try {
    /* Google Ads / GA4: replace AW-XXXXXXXXX/YYYYYYYY with the real
       conversion label (Goals → Conversions → enquiry → tag setup). */
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'conversion', { send_to: 'AW-XXXXXXXXX/YYYYYYYY' });
      window.gtag('event', 'generate_lead', { currency: 'EUR', value: 1 });
    }
    window.dataLayer = window.dataLayer || [];
    let form = 'contact';
    try { form = sessionStorage.getItem('bs-sent') || 'contact'; sessionStorage.removeItem('bs-sent'); } catch (e) { /* ignore */ }
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
  loadBrands();
  if (fixedLang) {
    /* German-only pages: keep the markup's language and never relabel it */
    lang = fixedLang;
    return;
  }
  const first = initialLang();
  try { await loadDict('en'); } catch (e) { console.warn('[i18n] en.json unavailable:', e); }
  await setLang(first.code, { persist: first.persist });
})();

export { COMPANY };
