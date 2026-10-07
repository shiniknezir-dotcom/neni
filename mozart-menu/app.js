/* Mozart café · bistro · bar — menu renderer (vanilla JS, no build step) */
(function () {
  'use strict';
  const DATA = window.MOZART_MENU;
  if (!DATA) return;

  const UI = {
    de: { menu: 'Speisekarte', sizes: {}, euro: '€' },
    en: { menu: 'Menu', sizes: { Flasche: 'bottle', Kännchen: 'pot', Glas: 'glass', klein: 'small', groß: 'large', Tasse: 'cup', Stück: 'piece' }, euro: '€' },
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const txt = (v, lang) => (v && typeof v === 'object') ? (v[lang] || v.de || '') : (v || '');
  const bi = (v, cls) => {
    if (!v) return '';
    const de = txt(v, 'de'), en = txt(v, 'en') || de;
    if (!de && !en) return '';
    const c = cls ? ` class="${cls}"` : '';
    return `<span lang="de"${c}>${esc(de)}</span><span lang="en"${c}>${esc(en)}</span>`;
  };
  const fmtPrice = (n, lang) => {
    const num = Number(n);
    if (!isFinite(num)) return esc(n);
    const s = num.toFixed(2);
    return (lang === 'de' ? s.replace('.', ',') : s) + ' €';
  };
  const fmtSize = (sz, lang) => {
    if (!sz) return '';
    if (lang === 'de') return sz.replace(/(\d)([a-z])/i, '$1 $2');
    const m = UI.en.sizes[sz];
    if (m) return m;
    return sz.replace(',', '.').replace(/(\d)([a-z])/i, '$1 $2');
  };
  const codesHTML = (codes) => codes ? `<sup class="codes" role="button" tabindex="0" data-codes="${esc(codes)}" title="Allergene / Allergens">${esc(codes)}</sup>` : '';

  /* ---------- language ---------- */
  const root = document.documentElement;
  function detectLang() {
    const h = (location.hash || '').replace('#', '').toLowerCase();
    if (h === 'en' || h === 'de') return h;
    try { const s = localStorage.getItem('mozart-lang'); if (s === 'en' || s === 'de') return s; } catch (e) { /* storage blocked */ }
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'de';
    return /^de/i.test(nav) ? 'de' : 'en';
  }
  function setLang(lang, persist) {
    root.setAttribute('data-lang', lang);
    root.setAttribute('lang', lang);
    document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    document.title = lang === 'de' ? 'Mozart café · bistro · bar – Speisekarte' : 'Mozart café · bistro · bar – Menu';
    if (persist) { try { localStorage.setItem('mozart-lang', lang); } catch (e) { /* ignore */ } }
  }
  document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang, true)));
  setLang(detectLang(), false);

  /* ---------- render ---------- */
  const ORNAMENT = '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="8" cy="17" rx="4.2" ry="3" transform="rotate(-20 8 17)" fill="currentColor"/><path d="M12 16V4l7 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function renderItem(it) {
    const prices = Array.isArray(it.prices) ? it.prices.filter((p) => p && p.price != null && p.price !== '') : [];
    const multi = prices.length > 1 || (prices.length === 1 && prices[0].size);
    const tags = (it.tags || []).map((t) => {
      const map = { vegan: { de: 'vegan', en: 'vegan', cls: 'vegan' }, vegetarisch: { de: 'vegetarisch', en: 'vegetarian', cls: 'vegan' }, alkoholfrei: { de: 'alkoholfrei', en: 'alcohol-free', cls: '' } };
      const m = map[t] || { de: t, en: t, cls: '' };
      return `<span class="tag ${m.cls}">${bi(m)}</span>`;
    }).join('');
    let priceHTML = '';
    if (multi) {
      const anySize = prices.some((p) => p.size);
      priceHTML = '<div class="price">' + prices.map((p) => {
        const sz = p.size ? { de: fmtSize(p.size, 'de'), en: fmtSize(p.size, 'en') } : (anySize ? { de: 'normal', en: 'regular' } : null);
        return `<span>${sz ? `<span class="sz">${bi(sz)}</span>` : ''}<span class="amt">${bi({ de: fmtPrice(p.price, 'de'), en: fmtPrice(p.price, 'en') })}</span></span>`;
      }).join('') + '</div>';
    } else if (prices.length === 1) {
      priceHTML = `<div class="price">${bi({ de: fmtPrice(prices[0].price, 'de'), en: fmtPrice(prices[0].price, 'en') })}</div>`;
    }
    const desc = txt(it.description, 'de') || txt(it.description, 'en');
    return `<li class="item${multi ? ' multi' : ''}"${it.uncertain ? ' data-check="1"' : ''}>
      <div class="name">${bi(it.name)}${codesHTML(it.allergens)}${tags}</div>
      ${priceHTML}
      ${desc ? `<div class="desc">${bi(it.description)}</div>` : ''}
    </li>`;
  }
  function renderSection(s) {
    const groups = (s.groups || []).map((g) => {
      const title = txt(g.title, 'de') || txt(g.title, 'en');
      return `<div class="group">${title ? `<h3>${bi(g.title)}</h3>` : ''}${txt(g.note, 'de') ? `<p class="gnote">${bi(g.note)}</p>` : ''}<ul class="items">${(g.items || []).map(renderItem).join('')}</ul></div>`;
    }).join('');
    const sub = txt(s.subtitle, 'de') ? `<span class="sub">${bi(s.subtitle)}</span>` : '';
    return `<section class="section" id="${esc(s.id)}" data-group="${esc(s.group || 'food')}">
      <div class="section-head">
        ${s.tempo ? `<span class="tempo">${esc(s.tempo)}</span>` : ''}
        <h2>${bi(s.title)}${sub}</h2>
        ${txt(s.note, 'de') ? `<p class="note">${bi(s.note)}</p>` : ''}
        ${txt(s.side_text, 'de') ? `<p class="side-text">${bi(s.side_text)}</p>` : ''}
        <div class="ornament">${ORNAMENT}</div>
      </div>
      ${groups}
    </section>`;
  }
  const main = document.getElementById('menu');
  main.innerHTML = DATA.sections.map(renderSection).join('');

  /* ---------- footer / info ---------- */
  const info = DATA.info || {};
  const addr = (info.address || []).join(' · ');
  const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  if (addr) { set('hero-address', esc(addr)); set('f-address', esc(addr)); }
  if (info.phone) set('f-phone', `<span lang="de">Tel. </span><span lang="en">Phone </span><a href="tel:${esc(info.phone.replace(/\s+/g, ''))}">${esc(info.phone)}</a>`);
  if (info.web) set('f-web', `<a href="https://${esc(info.web.replace(/^https?:\/\//, ''))}" rel="noopener">${esc(info.web)}</a>${info.facebook ? ` · <span lang="de">Facebook: </span><span lang="en">Facebook: </span>${esc(info.facebook)}` : ''}`);
  if (info.hours) set('f-hours', bi(info.hours));

  /* ---------- legend ---------- */
  const legend = DATA.legend || {};
  const dlRow = (e) => `<div class="row" data-code="${esc(e.code)}"><dt>${esc(e.code)}</dt><dd>${bi({ de: e.de, en: e.en })}</dd></div>`;
  set('legend-allergens', (legend.allergens || []).map(dlRow).join(''));
  set('legend-additives', (legend.additives || []).map(dlRow).join(''));
  if (legend.footnote) set('legend-foot', bi(legend.footnote));
  const dlg = document.getElementById('legend');
  function openLegend(codes) {
    const want = new Set(String(codes || '').split(/[,\s]+/).map((c) => c.trim()).filter(Boolean));
    dlg.querySelectorAll('.row').forEach((r) => r.classList.toggle('hl', want.has(r.dataset.code)));
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    const first = dlg.querySelector('.row.hl');
    if (first) first.querySelector('dt').scrollIntoView({ block: 'center' });
    else dlg.querySelector('.box').scrollTop = 0;
  }
  function closeLegend() { if (typeof dlg.close === 'function' && dlg.open) dlg.close(); else dlg.removeAttribute('open'); }
  document.getElementById('legend-open').addEventListener('click', () => openLegend(''));
  document.getElementById('legend-close').addEventListener('click', closeLegend);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeLegend(); });
  main.addEventListener('click', (e) => { const c = e.target.closest('.codes'); if (c) { e.preventDefault(); openLegend(c.dataset.codes); } });
  main.addEventListener('keydown', (e) => { const c = e.target.closest('.codes'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openLegend(c.dataset.codes); } });

  /* ---------- food / drinks + chips + scroll-spy ---------- */
  const chips = document.getElementById('chips');
  const sections = Array.from(main.querySelectorAll('.section'));
  const tabs = Array.from(document.querySelectorAll('.seg [role="tab"]'));
  let group = 'food';
  let observer = null;
  function navOffset() { return document.querySelector('.top').offsetHeight + document.querySelector('.nav').offsetHeight; }
  function showGroup(g, scroll) {
    group = g;
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.group === g)));
    sections.forEach((s) => { s.hidden = s.dataset.group !== g; });
    const visible = sections.filter((s) => !s.hidden);
    chips.innerHTML = visible.map((s) => {
      const sd = DATA.sections.find((x) => x.id === s.id) || {};
      return `<a href="#${esc(s.id)}" data-target="${esc(s.id)}">${bi(sd.title)}</a>`;
    }).join('');
    document.documentElement.style.setProperty('--nav-h', navOffset() + 'px');
    if (scroll) {
      const y = main.getBoundingClientRect().top + window.scrollY - navOffset() + 4;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }
    spy(visible);
    try { localStorage.setItem('mozart-group', g); } catch (e) { /* ignore */ }
  }
  chips.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-target]');
    if (!a) return;
    e.preventDefault();
    const el = document.getElementById(a.dataset.target);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - navOffset() - 6;
    window.scrollTo({ top: y, behavior: 'smooth' });
    history.replaceState(null, '', '#' + a.dataset.target);
  });
  tabs.forEach((t) => t.addEventListener('click', () => showGroup(t.dataset.group, true)));
  function spy(visible) {
    if (observer) observer.disconnect();
    if (!('IntersectionObserver' in window)) return;
    const links = Array.from(chips.querySelectorAll('a'));
    const activate = (id) => {
      links.forEach((l) => l.classList.toggle('active', l.dataset.target === id));
      const a = links.find((l) => l.dataset.target === id);
      if (a && chips.scrollWidth > chips.clientWidth) {
        const left = a.offsetLeft - chips.clientWidth / 2 + a.offsetWidth / 2;
        chips.scrollTo({ left, behavior: 'smooth' });
      }
    };
    const ratios = new Map();
    observer = new IntersectionObserver((entries) => {
      entries.forEach((en) => ratios.set(en.target.id, en.isIntersecting ? en.boundingClientRect.top : Infinity));
      let best = null, bestTop = -Infinity;
      const limit = navOffset() + 40;
      ratios.forEach((top, id) => { if (top !== Infinity && top <= limit && top > bestTop) { best = id; bestTop = top; } });
      if (!best) { ratios.forEach((top, id) => { if (top !== Infinity && (best === null || top < bestTop)) { best = id; bestTop = top; } }); }
      if (best) activate(best);
    }, { rootMargin: `-${navOffset()}px 0px -55% 0px`, threshold: [0, 0.01, 0.5, 1] });
    visible.forEach((s) => observer.observe(s));
  }
  // initial group: hash section → its group; else remembered; else food
  let initial = 'food';
  const hashId = (location.hash || '').replace('#', '');
  const hashSec = DATA.sections.find((s) => s.id === hashId);
  if (hashSec) initial = hashSec.group || 'food';
  else { try { const g = localStorage.getItem('mozart-group'); if (g === 'drinks' || g === 'food') initial = g; } catch (e) { /* ignore */ } }
  showGroup(initial, false);
  if (hashSec) { requestAnimationFrame(() => { const el = document.getElementById(hashId); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - navOffset() - 6 }); }); }
  window.addEventListener('resize', () => document.documentElement.style.setProperty('--nav-h', navOffset() + 'px'));

  /* ---------- back to top ---------- */
  const toTop = document.getElementById('to-top');
  window.addEventListener('scroll', () => toTop.classList.toggle('show', window.scrollY > 900), { passive: true });
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* ---------- hero: drifting staff & notes (canvas, decorative) ---------- */
  const canvas = document.querySelector('.hero canvas');
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, t = 0, raf = 0;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const notes = Array.from({ length: 10 }, (_, i) => ({ x: rnd(0.04, 0.96), y: rnd(0.05, 1.1), s: rnd(0.55, 1.1), v: rnd(0.00035, 0.0009), ph: rnd(0, 6.28), kind: i % 3 }));
    function resize() {
      const r = canvas.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.round(r.width); h = Math.round(r.height);
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
    function note(n) {
      const x = n.x * w, y = n.y * h, s = n.s;
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#d4ad5f'; ctx.strokeStyle = '#d4ad5f'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(0, 0, 6, 4.2, -0.35, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(5.2, -1.5); ctx.lineTo(5.2, -22); ctx.stroke();
      if (n.kind === 1) { ctx.beginPath(); ctx.moveTo(5.2, -22); ctx.quadraticCurveTo(14, -16, 10, -6); ctx.stroke(); }
      if (n.kind === 2) { ctx.beginPath(); ctx.ellipse(16, 8, 6, 4.2, -0.35, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(21.2, 6.5); ctx.lineTo(21.2, -16); ctx.stroke(); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(5.2, -22); ctx.lineTo(21.2, -16); ctx.stroke(); }
      ctx.restore();
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      // five staff lines, gently waving
      ctx.strokeStyle = 'rgba(244,236,220,0.10)'; ctx.lineWidth = 1;
      const mid = h * 0.52, gap = Math.max(11, Math.min(16, h * 0.045));
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 8) {
          const y = mid + i * gap + Math.sin(x / 140 + t * 0.6 + i * 0.4) * 3 + Math.sin(x / 47 - t * 0.3) * 1.2;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      notes.forEach(note);
    }
    function tick() {
      t += 0.012;
      notes.forEach((n) => { n.y -= n.v; n.x += Math.sin(t + n.ph) * 0.00025; if (n.y < -0.08) { n.y = 1.08; n.x = rnd(0.04, 0.96); } });
      draw();
      raf = requestAnimationFrame(tick);
    }
    resize();
    window.addEventListener('resize', resize);
    if (!reduce) {
      const io = new IntersectionObserver((en) => { if (en[0].isIntersecting) { if (!raf) raf = requestAnimationFrame(tick); } else { cancelAnimationFrame(raf); raf = 0; } });
      io.observe(canvas);
    }
  }
})();
