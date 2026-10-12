/* ==========================================================================
   BlütenSturm — page behaviour (ES module, no framework)
   ========================================================================== */

import { SERVICES, DISCIPLINES, BRAND_CATEGORIES, ICONS } from './data.js';

const LANGS = ['de', 'en', 'fr', 'es', 'it'];
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* --------------------------------------------------------------------------
   i18n — German is in the markup; other languages load from /i18n/<lang>.json
   -------------------------------------------------------------------------- */
const dicts = {};
let lang = 'de';
let langSeq = 0;              // guards against a slow earlier fetch winning
const LOCALES = { de: 'de-DE', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', it: 'it-IT' };
const fmtNum = (n) => n.toLocaleString(LOCALES[lang] || 'de-DE');
let dict = null;              // the active dictionary
let deSnapshot = null;        // the German text as it stands in the markup

function get(obj, key) {
  return key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}
export function t(key, fallback = '') {
  const v = dict ? get(dict, key) : undefined;
  if (v !== undefined) return v;
  const de = dicts.de ? get(dicts.de, key) : undefined;
  if (de !== undefined) return de;
  /* The markup snapshot is flat: its keys are the literal data-i18n strings. */
  if (deSnapshot && deSnapshot[key] !== undefined) return deSnapshot[key];
  return fallback;
}

function snapshotGerman() {
  const snap = {};
  $$('[data-i18n]').forEach((el) => { snap[el.dataset.i18n] = el.textContent; });
  $$('[data-i18n-html]').forEach((el) => { snap[el.dataset.i18nHtml] = el.innerHTML; });
  $$('[data-i18n-placeholder]').forEach((el) => { snap[el.dataset.i18nPlaceholder] = el.getAttribute('placeholder'); });
  return snap;
}

async function loadDict(code) {
  if (dicts[code]) return dicts[code];
  const res = await fetch(`/i18n/${code}.json`);
  if (!res.ok) throw new Error(`i18n ${code} ${res.status}`);
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
  /* Each page names its own title/description keys on <body>; pages that
     name none keep the title in their markup. */
  const titleKey = document.body.dataset.i18nTitle;
  const descKey = document.body.dataset.i18nDescription;
  const title = titleKey ? get(dict, titleKey) : undefined;
  if (typeof title === 'string') document.title = title;
  const desc = descKey ? get(dict, descKey) : undefined;
  const m = $('meta[name="description"]');
  if (typeof desc === 'string' && m) m.setAttribute('content', desc);
  $$('[data-count][data-done]').forEach((el) => { el.textContent = fmtNum(parseFloat(el.dataset.count) || 0) + (el.dataset.suffix || ''); });
  document.documentElement.lang = lang;
  $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  renderDisciplines();
  renderChips();
  renderBrands();
  if (panel && panel.open && panelState) reopenPanel();
}

async function setLang(code, { persist = true } = {}) {
  if (!LANGS.includes(code)) code = 'de';
  const seq = ++langSeq;
  let d;
  try {
    d = await loadDict(code);
  } catch (e) {
    console.warn('[i18n]', e);
    if (code !== 'de') return;
    d = null;
  }
  if (seq !== langSeq) return;   // the visitor has already chosen again
  dict = d;
  lang = code;
  if (dict) applyDict();
  if (persist) { try { localStorage.setItem('bs-lang', code); } catch (e) { /* private mode */ } }
}

function initialLang() {
  try {
    const saved = localStorage.getItem('bs-lang');
    if (saved && LANGS.includes(saved)) return saved;
  } catch (e) { /* ignore */ }
  const wanted = (navigator.languages || [navigator.language || 'de']).map((l) => String(l).slice(0, 2).toLowerCase());
  return wanted.find((l) => LANGS.includes(l)) || 'de';
}

/* --------------------------------------------------------------------------
   Icons
   -------------------------------------------------------------------------- */
function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.spark}</svg>`;
}
const dot = '<i class="dot" aria-hidden="true"></i>';

/* --------------------------------------------------------------------------
   Services: five discipline cards + the full directory of eighteen
   -------------------------------------------------------------------------- */
const byId = Object.fromEntries(SERVICES.map((s) => [s.id, s]));
function unitLabel(u) { return t(`panel.unit.${u}`, u); }

function renderDisciplines() {
  const host = $('[data-disciplines]');
  if (!host) return;
  /* A language switch re-renders the cards; keep the ones already revealed
     visible instead of fading the whole grid out and back in. */
  const seen = $$('.svc', host).map((el) => el.classList.contains('is-in'));
  host.innerHTML = DISCIPLINES.map((d, i) => {
    const s = byId[d.id];
    const n = String(i + 1).padStart(2, '0');
    const tone = d.tone === 'dark' ? ' svc--dark' : d.tone === 'featured' ? ' svc--featured' : '';
    return `<button class="svc${tone} reveal${seen[i] ? ' is-in' : ''}" type="button" data-service-open="${s.id}" data-delay="${i % 4}">
      <span class="svc__top"><span class="svc__icon">${icon(d.icon)}</span><span class="svc__num">${n}</span></span>
      <span class="svc__body"><span class="svc__title h-3">${t(`svc.${s.id}.name`)}</span><span class="svc__text">${t(`svc.${s.id}.short`)}</span></span>
      <span class="svc__foot"><span class="svc__from">${t('panel.from')}<b>${s.normal[0]}</b>${unitLabel(s.normal[1])}</span><span class="svc__open">${t('panel.open')}</span></span>
    </button>`;
  }).join('');
  observeReveals(host);
}

function renderChips() {
  const host = $('[data-service-chips]');
  if (!host) return;
  host.innerHTML = SERVICES.map((s) => `<button type="button" data-service-open="${s.id}"><i></i>${t(`svc.${s.id}.name`)}</button>`).join('');
}

/* --------------------------------------------------------------------------
   Partner brands from media/brands/manifest.json
   -------------------------------------------------------------------------- */
let brands = [];
let brandFilter = 'all';
async function loadBrands() {
  const host = $('[data-brands]');
  if (!host) return;
  try {
    const res = await fetch('/media/brands/manifest.json');
    brands = res.ok ? await res.json() : [];
  } catch (e) { brands = []; }
  brands = brands.map((b) => ({ ...b, cat: BRAND_CATEGORIES[b.category] || 'other', logo: '/' + String(b.logo || '').replace(/^\/+/, '') }));
  renderBrandFilter();
  renderBrands();
}
function renderBrandFilter() {
  const host = $('[data-brand-filter]');
  if (!host || !brands.length) return;
  const cats = [...new Set(brands.map((b) => b.cat))];
  const all = host.querySelector('[data-filter="all"]');
  host.innerHTML = '';
  host.appendChild(all);
  cats.forEach((c) => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.filter = c; b.dataset.i18n = `brands.cat.${c}`;
    b.setAttribute('aria-pressed', 'false');
    b.textContent = t(`brands.cat.${c}`, c);
    host.appendChild(b);
  });
}
function renderBrands() {
  const host = $('[data-brands]');
  if (!host || !brands.length) return;
  $$('[data-brand-filter] button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.filter === brandFilter));
    if (b.dataset.i18n) b.textContent = t(b.dataset.i18n, b.textContent);
  });
  host.innerHTML = brands.map((b, i) => `<button class="brand-tile${brandFilter !== 'all' && b.cat !== brandFilter ? ' is-hidden' : ''}" type="button" data-brand="${i}" aria-label="${b.name}: ${t('brands.open')}">
    <img src="${b.logo}" alt="" loading="lazy" decoding="async" width="240" height="180" onerror="this.remove()">
    <span>${t(`brands.cat.${b.cat}`, b.category)}</span>
  </button>`).join('');
}

/* --------------------------------------------------------------------------
   Detail panel (<dialog>) — services and partners
   -------------------------------------------------------------------------- */
const panel = $('[data-panel]');
let panelState = null;
let lastFocus = null;

function pack(tier, s) {
  const [price, unit] = s[tier];
  const items = t(`svc.${s.id}.${tier}`, []);
  const list = Array.isArray(items) ? items : [];
  return `<div class="pack${tier === 'premium' ? ' pack--premium' : ''}">
    <p class="pack__tier">${t(`panel.${tier}`)}</p>
    <p class="pack__price">${t('panel.from')}<b>${price}</b>${unitLabel(unit)}</p>
    <ul class="pack__list">${list.map((i) => `<li>${i}</li>`).join('')}</ul>
    <a class="btn btn--sm${tier === 'premium' ? ' btn--lime' : ''}" href="#contact" data-panel-cta>${t('panel.request').replace('{tier}', t(`panel.${tier}`))}${dot}</a>
  </div>`;
}

function fillService(id) {
  const s = byId[id];
  if (!s) return;
  $('[data-panel-eyebrow]', panel).textContent = t('panel.service');
  $('[data-panel-logo]', panel).hidden = true;
  $('[data-panel-title]', panel).textContent = t(`svc.${id}.name`);
  $('[data-panel-tagline]', panel).textContent = t(`svc.${id}.tagline`);
  $('[data-panel-body]', panel).textContent = t(`svc.${id}.desc`);
  const items = t(`svc.${id}.items`, []);
  $('[data-panel-list]', panel).innerHTML = (Array.isArray(items) ? items : []).map((i) => `<li>${i}</li>`).join('');
  $('[data-panel-packs]', panel).innerHTML = pack('normal', s) + pack('premium', s);
  $('[data-panel-foot]', panel).hidden = false;
}

function fillBrand(i) {
  const b = brands[i];
  if (!b) return;
  $('[data-panel-eyebrow]', panel).textContent = t('brands.panel.eyebrow');
  const logo = $('[data-panel-logo]', panel);
  logo.src = b.logo; logo.alt = b.name; logo.hidden = false;
  $('[data-panel-title]', panel).textContent = b.name;
  $('[data-panel-tagline]', panel).textContent = [t(`brands.cat.${b.cat}`, b.category), t('brands.panel.markets')].filter(Boolean).join('  ·  ');
  $('[data-panel-body]', panel).textContent = t('brands.panel.summary');
  const work = t('brands.panel.work', []);
  $('[data-panel-list]', panel).innerHTML = (Array.isArray(work) ? work : []).map((w) => `<li>${w}</li>`).join('');
  $('[data-panel-packs]', panel).innerHTML = '';
  $('[data-panel-foot]', panel).hidden = true;
}

function openPanel(state) {
  if (!panel) return;
  panelState = state;
  if (state.type === 'service') fillService(state.id); else fillBrand(state.index);
  lastFocus = document.activeElement;
  if (typeof panel.showModal === 'function') {
    if (!panel.open) panel.showModal();
  } else {
    panel.setAttribute('open', '');
  }
  document.documentElement.classList.add('is-locked');
  $('.panel__inner', panel).scrollTop = 0;
  $('[data-panel-close]', panel).focus({ preventScroll: true });
}
function reopenPanel() { if (panelState.type === 'service') fillService(panelState.id); else fillBrand(panelState.index); }
function closePanel() {
  if (!panel) return;
  if (panel.open && typeof panel.close === 'function') panel.close(); else panel.removeAttribute('open');
}
if (panel) {
  panel.addEventListener('close', () => {
    document.documentElement.classList.remove('is-locked');
    panelState = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  });
  panel.addEventListener('click', (e) => {
    if (e.target === panel) closePanel();                      // backdrop
    if (e.target.closest('[data-panel-close], [data-panel-cta]')) closePanel();
  });
  panel.addEventListener('cancel', (e) => { e.preventDefault(); closePanel(); });
}
document.addEventListener('click', (e) => {
  const svc = e.target.closest('[data-service-open]');
  if (svc) { e.preventDefault(); openPanel({ type: 'service', id: svc.dataset.serviceOpen }); return; }
  const br = e.target.closest('[data-brand]');
  if (br) { e.preventDefault(); openPanel({ type: 'brand', index: Number(br.dataset.brand) }); return; }
  const f = e.target.closest('[data-brand-filter] button');
  if (f) { brandFilter = f.dataset.filter; renderBrands(); return; }
  const dir = e.target.closest('[data-open-directory]');
  if (dir) { $('#directory')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }); }
});

/* --------------------------------------------------------------------------
   Header: scrolled state, mobile drawer, language buttons
   -------------------------------------------------------------------------- */
const header = $('[data-header]');
const burger = $('[data-burger]');
function setDrawer(open) {
  if (!header) return;
  header.classList.toggle('is-open', open);
  burger?.setAttribute('aria-expanded', String(open));
  document.documentElement.classList.toggle('is-locked', open);
}
burger?.addEventListener('click', () => setDrawer(!header.classList.contains('is-open')));
$('[data-nav]')?.addEventListener('click', (e) => { if (e.target.closest('a')) setDrawer(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && header?.classList.contains('is-open')) { setDrawer(false); burger?.focus(); } });
window.matchMedia('(min-width: 1181px)').addEventListener('change', (e) => { if (e.matches) setDrawer(false); });
$$('[data-lang]').forEach((b) => b.addEventListener('click', () => { setLang(b.dataset.lang); setDrawer(false); }));

/* Which tone is under the header right now decides its scrolled colours. */
function onScroll() {
  if (!header) return;
  const y = window.scrollY || 0;
  header.classList.toggle('is-scrolled', y > 24);
  const probe = document.elementFromPoint(16, Math.min(header.offsetHeight + 4, 90));
  const sec = probe && probe.closest('.tone-forest, .tone-lime, .tone-paper, .tone-mist, .site-footer');
  header.classList.toggle('on-forest', !!sec && sec.classList.contains('tone-forest'));
}
window.addEventListener('scroll', onScroll, { passive: true });

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
function observeReveals(root = document) {
  $$('.reveal:not(.is-in)', root).forEach((el) => { if (io && !reduceMotion) io.observe(el); else el.classList.add('is-in'); });
}
const cio = ('IntersectionObserver' in window) ? new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    const el = en.target; cio.unobserve(el);
    const target = parseFloat(el.dataset.count) || 0;
    const suffix = el.dataset.suffix || '';
    const finish = () => { el.dataset.done = '1'; el.textContent = fmtNum(target) + suffix; };
    if (reduceMotion) { finish(); return; }
    const dur = 1600, start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      if (p >= 1) { finish(); return; }
      el.textContent = fmtNum(Math.round(target * (1 - Math.pow(1 - p, 3)))) + suffix;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}, { threshold: 0.6 }) : null;
$$('[data-count]').forEach((el) => { if (cio) cio.observe(el); else el.textContent = (el.dataset.count || '') + (el.dataset.suffix || ''); });

/* --------------------------------------------------------------------------
   Ticker — duplicate the row once so the CSS loop is seamless
   -------------------------------------------------------------------------- */
const ticker = $('[data-ticker]');
if (ticker) { ticker.innerHTML += ticker.innerHTML; }

/* --------------------------------------------------------------------------
   Tilt: a light 3D lean on the cards (pointer devices only)
   -------------------------------------------------------------------------- */
if (!reduceMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest('.svc, .case');
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `perspective(1200px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg) translateY(-6px)`;
  }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    const card = e.target.closest('.svc, .case');
    if (card && !card.contains(e.relatedTarget)) card.style.transform = '';
  });
}

/* --------------------------------------------------------------------------
   Forms: Formspree + Netlify Forms, then a mailto fallback
   -------------------------------------------------------------------------- */
$$('[data-form]').forEach((form) => {
  const status = $('[data-form-status]', form);
  const show = (msg, kind) => {
    if (!status) return;
    status.hidden = false;
    status.textContent = msg;
    status.classList.toggle('is-error', kind === 'error');
    status.classList.toggle('is-ok', kind === 'ok');
  };
  const btn0 = $('[data-submit]', form);
  let sending = false;
  /* Back from /danke/ restores this exact DOM from the back/forward cache:
     put the button and the status line back the way a fresh page has them. */
  window.addEventListener('pageshow', (ev) => {
    if (!ev.persisted) return;
    sending = false;
    if (btn0) { btn0.disabled = false; btn0.innerHTML = `<span>${t('form.send')}</span>${dot}`; }
    if (status) { status.hidden = true; status.textContent = ''; }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    sending = true;
    const btn = btn0;
    const label = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.textContent = t('form.sending'); }
    show(t('form.sendingMsg'), 'ok');
    try {
      const mod = await import('./form-send.js');
      const r = await mod.sendEnquiry(form, form.dataset.subject || 'Neue Anfrage über bluetensturm.com');
      if (r.ok) {
        try { sessionStorage.setItem('bs-sent', form.getAttribute('name') || '1'); } catch (err) { /* ignore */ }
        window.location.href = form.getAttribute('action') || '/danke/';
        return;
      }
      show(t('form.fallback'), 'error');
      window.location.href = r.href;
    } catch (err) {
      show(t('form.error'), 'error');
    }
    sending = false;
    if (btn) { btn.disabled = false; btn.innerHTML = label; }
  });
});

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
    video.src = hd ? video.dataset.srcHd : video.dataset.srcSd;
    video.addEventListener('playing', () => video.classList.add('is-playing'), { once: true });
    video.addEventListener('error', () => video.remove(), { once: true });
    const p = video.play();
    if (p && p.catch) p.catch(() => { /* autoplay refused: the poster stays */ });
  };
  if ('IntersectionObserver' in window) {
    const wio = new IntersectionObserver((es) => {
      es.forEach((en) => {
        if (en.isIntersecting) { start(); if (video.paused && video.src) video.play().catch(() => {}); }
        else if (video.src && !video.paused) video.pause();
      });
    }, { rootMargin: '400px 0px' });
    wio.observe(box);
  } else start();
})();

/* --------------------------------------------------------------------------
   3D hero — only where it can run well
   -------------------------------------------------------------------------- */
async function mountHero3D() {
  const hero = $('[data-hero]');
  const stage = $('[data-hero-stage]');
  if (!hero || !stage) return;
  /* ?motion=reduced forces the static composition, ?motion=full forces 3D. */
  const override = (/[?&]motion=(full|reduced)/.exec(window.location.search) || [])[1];
  if (override === 'reduced') return;
  if (reduceMotion && override !== 'full') return;
  const conn = navigator.connection;
  if (conn && (conn.saveData || /^(slow-)?2g$/.test(conn.effectiveType || ''))) return;
  try {
    const c = document.createElement('canvas');
    if (!(c.getContext('webgl2') || c.getContext('webgl'))) return;
  } catch (e) { return; }
  try {
    const mod = await import('./hero3d.js');
    const inst = mod.mountHero(stage, { reduced: false });
    if (inst) hero.classList.add('has-3d');
  } catch (e) {
    console.warn('[hero3d] not mounted:', e);
  }
}

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */
(async function boot() {
  deSnapshot = snapshotGerman();
  observeReveals();
  onScroll();
  mountHero3D();
  /* German is the source of truth: the dictionary carries the service
     directory, the panel wording and the partner texts that the markup
     itself does not hold. If it cannot be fetched (file://), the page still
     works with the flat snapshot and empty dynamic lists. */
  try { dict = await loadDict('de'); } catch (e) { dict = null; console.warn('[i18n] de.json unavailable:', e); }
  renderDisciplines();
  renderChips();
  loadBrands();
  const first = initialLang();
  if (first !== 'de') setLang(first, { persist: false });
  else try { if (!localStorage.getItem('bs-lang')) localStorage.setItem('bs-lang', 'de'); } catch (e) { /* ignore */ }
})();
