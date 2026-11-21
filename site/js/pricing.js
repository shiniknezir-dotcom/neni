/* ==========================================================================
   Blüten Sturm — prices and offers, rendered from /data/pricing.json.

   The JSON is the single source of truth for every price on the site. This
   module only turns it into markup; it touches no DOM, so the same code runs
   in the browser and in tools/render-pricing.mjs (the no-JavaScript fallback,
   always rendered without the offer).

   German texts come straight from the JSON, exactly as written in the price
   sheet. Other languages read their wording from i18n/<lang>.json under
   pricing.items.* and fall back to the German text.

   The October offer is shown only while `now <= offer.valid_until`; after
   that the regular prices stand alone and the banner is gone.
   ========================================================================== */

const LOCALES = { en: 'en-GB', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT' };
const TZ = 'Europe/Berlin';

const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* group key in the JSON -> key used in the dictionaries */
export const GROUPS = { websites: 'websites', social: 'social', other: 'other', retail: 'retail' };

export function offerEnd(data) {
  const t = data && data.offer ? Date.parse(data.offer.valid_until) : NaN;
  return Number.isFinite(t) ? t : -Infinity;
}
export function offerActive(data, now) {
  return now <= offerEnd(data);
}

/* Everything the renderer needs from the page: language, translator, time. */
export function makeContext({ lang = 'en', t = (k, f) => f, now = Date.now() } = {}) {
  const locale = LOCALES[lang] || 'en-GB';
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, minimumFractionDigits: 0 });
  const date = new Intl.DateTimeFormat(locale, { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmt = (n) => money.format(n);
  const range = (a, b) => (typeof money.formatRange === 'function' ? money.formatRange(a, b) : `${fmt(a)}–${fmt(b)}`);
  const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0, signDisplay: 'always' });
  /* the discount, computed from the two prices: never a number of its own */
  const off = (regular, offer) => pct.format(offer / regular - 1).replace('-', '−');
  const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  return { lang, t, now, fmt, range, off, fill, day: (ms) => date.format(new Date(ms)) };
}

/* A text from the JSON (German) or its translation. */
function tx(ctx, key, de) {
  if (ctx.lang === 'de') return de;
  const v = ctx.t(key, undefined);
  return v === undefined || v === null || v === '' ? de : v;
}
function list(ctx, key, deArr) {
  if (ctx.lang === 'de') return deArr || [];
  const v = ctx.t(key, undefined);
  return Array.isArray(v) && v.length === (deArr || []).length ? v : (deArr || []);
}
const L = (ctx, key, de, vars) => ctx.fill(ctx.t(`pricing.${key}`, de), vars || {});

export function itemName(ctx, group, item) { return tx(ctx, `pricing.items.${group}.${item.id}.name`, item.name); }

/* the calendar day in Berlin, as YYYY-MM-DD */
const berlinDate = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
export const berlinDay = (ms) => berlinDate.format(new Date(ms));

/* Berlin calendar days left until the offer ends (0 = last day) */
function daysLeft(ctx, end) {
  const d = (ms) => Date.parse(berlinDay(ms) + 'T00:00:00Z');
  return Math.round((d(end) - d(ctx.now)) / 86400000);
}

/* ---------------------------------------------------------------- offer -- */
export function offerTexts(data, ctx) {
  const o = data.offer;
  const end = offerEnd(data);
  const n = daysLeft(ctx, end);
  return {
    name: tx(ctx, 'pricing.offer.name', o.name),
    headline: tx(ctx, 'pricing.offer.headline', o.headline),
    terms: tx(ctx, 'pricing.offer.terms', o.terms),
    until: L(ctx, 'offer.until', 'until {date}', { date: ctx.day(end) }),
    left: n <= 0 ? L(ctx, 'offer.lastDay', 'last day') : n === 1 ? L(ctx, 'offer.oneDay', '1 day left') : L(ctx, 'offer.daysLeft', '{n} days left', { n }),
    cta: L(ctx, 'offer.cta', 'See the prices')
  };
}

function offerCard(data, ctx) {
  const o = offerTexts(data, ctx);
  return `<div class="offer-card">
    <p class="offer-card__tag"><span>${escHtml(o.name)}</span><span>${escHtml(o.until)} · ${escHtml(o.left)}</span></p>
    <p class="offer-card__headline">${escHtml(o.headline)}</p>
    <p class="offer-card__terms">${escHtml(o.terms)}</p>
  </div>`;
}

/* ---------------------------------------------------------------- prices -- */
function strike(ctx, regular, offer) {
  return `<span class="sr-only">${escHtml(L(ctx, 'regular', 'Regular'))}: </span><s>${escHtml(regular)}</s> <span class="sr-only">${escHtml(L(ctx, 'offerPrice', 'Offer price'))}: </span><b>${escHtml(offer)}</b>`;
}

function websitePrice(w, data, ctx, active) {
  const per = escHtml(L(ctx, 'perMonth', '/ month'));
  if (w.price_monthly !== undefined) {
    const note = active && w.offer_note ? `<span class="price__note">${escHtml(tx(ctx, `pricing.items.websites.${w.id}.offer_note`, w.offer_note))}</span>` : '';
    return `<p class="price"><b>${escHtml(ctx.fmt(w.price_monthly))}</b> <span class="price__unit">${per}</span>${note}</p>`;
  }
  if (active && w.offer_price !== undefined) {
    return `<p class="price price--offer">${strike(ctx, ctx.fmt(w.price), ctx.fmt(w.offer_price))}</p>`;
  }
  return `<p class="price"><b>${escHtml(ctx.fmt(w.price))}</b></p>`;
}

function socialPrice(p, data, ctx, active) {
  const per = escHtml(L(ctx, 'perMonth', '/ month'));
  if (active && p.offer_first_month !== undefined) {
    const date = ctx.day(offerEnd(data));
    return `<p class="price price--offer">${strike(ctx, ctx.fmt(p.price_monthly), ctx.fmt(p.offer_first_month))}</p>
      <p class="price__note">${escHtml(L(ctx, 'firstMonth', '1st month if ordered by {date}', { date }))}</p>
      <p class="price__then">${escHtml(L(ctx, 'then', 'then {price} / month', { price: ctx.fmt(p.price_monthly) }))}</p>`;
  }
  return `<p class="price"><b>${escHtml(ctx.fmt(p.price_monthly))}</b> <span class="price__unit">${per}</span></p>`;
}

/* "ab 1.500 €", "ab 390 € / Monat", "2.000–4.000 € / Monat", "auf Anfrage" */
export function otherPrice(o, ctx) {
  const per = L(ctx, 'perMonth', '/ month');
  const from = L(ctx, 'from', 'from');
  if (typeof o.price === 'string') return { text: tx(ctx, `pricing.items.other.${o.id}.price`, o.price), plain: true };
  if (o.price_from !== undefined) return { text: `${from} ${ctx.fmt(o.price_from)}` };
  if (o.price_from_monthly !== undefined) return { text: `${from} ${ctx.fmt(o.price_from_monthly)} ${per}`, note: o.note ? tx(ctx, `pricing.items.other.${o.id}.note`, o.note) : '' };
  if (o.price_monthly_min !== undefined) return { text: `${ctx.range(o.price_monthly_min, o.price_monthly_max)} ${per}` };
  if (o.price_monthly !== undefined) return { text: `${ctx.fmt(o.price_monthly)} ${per}` };
  return { text: L(ctx, 'onRequest', 'on request'), plain: true };
}

/* ---------------------------------------------------------------- blocks -- */
function features(ctx, group, item) {
  const f = list(ctx, `pricing.items.${group}.${item.id}.features`, item.features);
  return f.length ? `<ul class="pkg__list">${f.map((x) => `<li>${escHtml(x)}</li>`).join('')}</ul>` : '';
}
function description(ctx, group, item) {
  return item.description ? `<p class="pkg__desc">${escHtml(tx(ctx, `pricing.items.${group}.${item.id}.description`, item.description))}</p>` : '';
}
function cta(ctx, group, item) {
  return `<a class="pkg__cta" href="#contact" data-pkg="${group}:${escHtml(item.id)}">${escHtml(L(ctx, 'request', 'Request this package'))}<i aria-hidden="true"></i></a>`;
}

function websiteCard(w, data, ctx, active) {
  const optional = w.optional ? ` <small>(${escHtml(L(ctx, 'optional', 'optional'))})</small>` : '';
  const ref = w.reference ? `<p class="pkg__ref">${escHtml(L(ctx, 'reference', 'like {site}', { site: w.reference }))}</p>` : '';
  const badge = active && w.offer_price !== undefined ? `<span class="pkg__badge">${escHtml(ctx.off(w.price, w.offer_price))}</span>` : '';
  return `<article class="pkg${w.optional ? ' pkg--slim' : ''}${w.id === 'premium' ? ' pkg--dark' : ''}">
    ${badge}<h5 class="pkg__name">${escHtml(itemName(ctx, 'websites', w))}${optional}</h5>
    ${websitePrice(w, data, ctx, active)}
    ${features(ctx, 'websites', w)}${ref}
    ${cta(ctx, 'websites', w)}
  </article>`;
}

function socialCard(p, data, ctx, active) {
  const badge = active && p.offer_first_month !== undefined ? `<span class="pkg__badge">${escHtml(ctx.off(p.price_monthly, p.offer_first_month))}</span>` : '';
  return `<article class="pkg${p.id === 'premium' ? ' pkg--dark' : ''}">
    ${badge}<h5 class="pkg__name">${escHtml(itemName(ctx, 'social', p))}</h5>
    ${socialPrice(p, data, ctx, active)}
    ${features(ctx, 'social', p)}
    ${cta(ctx, 'social', p)}
  </article>`;
}

function row(group, o, ctx, priceText, note) {
  return `<li class="prow">
    <div class="prow__main"><h5 class="prow__name">${escHtml(itemName(ctx, group, o))}</h5>${description(ctx, group, o)}${features(ctx, group, o)}</div>
    <p class="prow__price"><b>${escHtml(priceText)}</b>${note ? `<span>${escHtml(note)}</span>` : ''}</p>
    ${cta(ctx, group, o)}
  </li>`;
}

function otherRows(data, ctx, ids) {
  return data.other_services.filter((o) => !ids || ids.includes(o.id)).map((o) => {
    const p = otherPrice(o, ctx);
    return row('other', o, ctx, p.text, p.note);
  }).join('');
}
function retailRows(data, ctx) {
  const paid = L(ctx, 'paidBy', 'paid by the brand');
  return data.retail_promotion.map((r) => row('retail', r, ctx, ctx.fmt(r.price), paid)).join('');
}

export function group(name, data, ctx, opts = {}) {
  const active = offerActive(data, ctx.now);
  if (name === 'websites') {
    /* the optional care plan runs full width under the three packages */
    const card = (w) => websiteCard(w, data, ctx, active);
    return `<div class="pgrid pgrid--web">${data.websites.filter((w) => !w.optional).map(card).join('')}</div>${data.websites.filter((w) => w.optional).map(card).join('')}`;
  }
  if (name === 'social') {
    const note = data.social_media.note ? `<p class="pricing__note">${escHtml(tx(ctx, 'pricing.items.social.note', data.social_media.note))}</p>` : '';
    return `<div class="pgrid">${data.social_media.packages.map((p) => socialCard(p, data, ctx, active)).join('')}</div>${note}`;
  }
  if (name === 'other') return `<ul class="prows">${otherRows(data, ctx, opts.ids)}</ul>`;
  if (name === 'retail') {
    const note = data.retail_promotion_note ? `<p class="pricing__note">${escHtml(tx(ctx, 'pricing.items.retail.note', data.retail_promotion_note))}</p>` : '';
    return `<ul class="prows">${retailRows(data, ctx)}</ul>${note}`;
  }
  return '';
}

function groupTitle(name, data, ctx) {
  const n = data.social_media ? data.social_media.min_term_months : 3;
  const titles = { websites: 'Websites (fixed prices)', social: 'Social media (monthly, {n}-month minimum term)', other: 'Further services', retail: 'In-store promotion (for brands, e.g. in EDEKA stores)' };
  return L(ctx, `groups.${name}`, titles[name], { n });
}

/* The whole price list, as shown under section 02. */
export function renderPricing(data, ctx) {
  const active = offerActive(data, ctx.now);
  const updated = data.updated ? L(ctx, 'updated', 'As of {date}', { date: ctx.day(Date.parse(data.updated + 'T12:00:00Z')) }) : '';
  const c = data.contact || {};
  const ig = c.instagram ? `<a href="https://www.instagram.com/${escHtml(c.instagram.replace(/^@/, ''))}" target="_blank" rel="noopener noreferrer">${escHtml(c.instagram)}</a>` : '';
  const mail = c.email ? `<a href="mailto:${escHtml(c.email)}">${escHtml(c.email)}</a>` : '';
  return `<div class="pricing__head">
      <h3 class="pricing__title" id="pricing-title">${escHtml(L(ctx, 'title', 'Prices & offers'))}</h3>
      ${updated ? `<p class="pricing__updated">${escHtml(updated)}</p>` : ''}
    </div>
    ${active ? offerCard(data, ctx) : ''}
    ${['websites', 'social', 'other', 'retail'].map((g) => `<section class="pricing__group" aria-label="${escHtml(groupTitle(g, data, ctx))}">
      <h4 class="pricing__gtitle">${escHtml(groupTitle(g, data, ctx))}</h4>
      ${group(g, data, ctx)}
    </section>`).join('')}
    <div class="pricing__foot">
      <p class="pricing__vat">${escHtml(tx(ctx, 'pricing.vat', data.vat_note))}</p>
      <p class="pricing__contact"><span>${escHtml(L(ctx, 'contactQ', 'Questions about the packages?'))}</span> ${mail}${ig ? ' · ' + ig : ''}${c.address ? ' · ' + escHtml(c.address) : ''}</p>
    </div>`;
}

/* ---------------------------------------------------------- service map -- */
/* Which price-sheet entries belong to which of the 18 services. Services
   that are not on the price sheet show "price on request". */
export const SERVICE_PRICING = {
  'website-digital-experience': [['websites']],
  'social-media-management': [['social']],
  'content-production': [['social']],
  'brand-strategy': [['other', ['branding']]],
  'advertising': [['other', ['ads']]],
  'digital-marketing': [['other', ['ads']]],
  'event-marketing-promotions': [['other', ['events']], ['retail']],
  'corporate-training': [['other', ['academy_30', 'academy_100']]]
};

export function servicePricing(serviceId, data, ctx) {
  const parts = SERVICE_PRICING[serviceId];
  if (!parts) {
    return `<div class="pricing__onrequest"><p><b>${escHtml(L(ctx, 'panelOnRequest', 'Price on request'))}</b></p>
      <a class="pkg__cta" href="#contact" data-pkg="service:${escHtml(serviceId)}">${escHtml(L(ctx, 'panelCta', 'Request an offer'))}<i aria-hidden="true"></i></a></div>`;
  }
  const active = offerActive(data, ctx.now);
  const offer = active && parts.some(([g]) => g === 'websites' || g === 'social') ? offerCard(data, ctx) : '';
  return offer + parts.map(([g, ids]) => `<div class="pricing__group">${ids ? '' : `<h4 class="pricing__gtitle">${escHtml(groupTitle(g, data, ctx))}</h4>`}${group(g, data, ctx, { ids })}</div>`).join('');
}

/* The five discipline cards in section 02 show one from-price each. */
export const CARD_PRICE = {
  'brand-strategy': ['other', 'branding'],
  'digital-marketing': ['other', 'ads'],
  'content-production': ['social', 'start'],
  'event-marketing-promotions': ['other', 'events'],
  'corporate-training': ['other', 'academy_30']
};
export function cardPrice(serviceId, data, ctx) {
  const ref = CARD_PRICE[serviceId];
  if (!ref) return '';
  const [g, id] = ref;
  if (g === 'social') {
    const p = data.social_media.packages.find((x) => x.id === id);
    return `<span>${escHtml(L(ctx, 'from', 'from'))}</span> <b>${escHtml(ctx.fmt(p.price_monthly))}</b> <em>${escHtml(L(ctx, 'perMonth', '/ month'))}</em>`;
  }
  const o = data.other_services.find((x) => x.id === id);
  if (o.price_monthly_min !== undefined) return `<span>${escHtml(L(ctx, 'from', 'from'))}</span> <b>${escHtml(ctx.fmt(o.price_monthly_min))}</b> <em>${escHtml(L(ctx, 'perMonth', '/ month'))}</em>`;
  if (o.price_from_monthly !== undefined) return `<span>${escHtml(L(ctx, 'from', 'from'))}</span> <b>${escHtml(ctx.fmt(o.price_from_monthly))}</b> <em>${escHtml(L(ctx, 'perMonth', '/ month'))}</em>${o.note ? ` <em>${escHtml(tx(ctx, `pricing.items.other.${o.id}.note`, o.note))}</em>` : ''}`;
  if (o.price_from !== undefined) return `<span>${escHtml(L(ctx, 'from', 'from'))}</span> <b>${escHtml(ctx.fmt(o.price_from))}</b>`;
  return `<b>${escHtml(otherPrice(o, ctx).text)}</b>`;
}

/* Contact-form prefill for a package request */
export function packageLabel(ref, data, ctx) {
  const [g, id] = String(ref).split(':');
  const pool = g === 'websites' ? data.websites : g === 'social' ? data.social_media.packages : g === 'other' ? data.other_services : g === 'retail' ? data.retail_promotion : [];
  const item = pool.find((x) => x.id === id);
  if (!item) return null;
  const active = offerActive(data, ctx.now) && ((g === 'websites' && item.offer_price !== undefined) || (g === 'social' && item.offer_first_month !== undefined));
  return { group: g, name: itemName(ctx, g, item), offer: active ? tx(ctx, 'pricing.offer.name', data.offer.name) : '' };
}
export const DISCIPLINE_OF_GROUP = {
  websites: 'Digital marketing', social: 'Content & social', retail: 'Events & experience',
  'other:branding': 'Brand strategy', 'other:ads': 'Digital marketing', 'other:events': 'Events & experience',
  'other:academy_30': 'Corporate training', 'other:academy_100': 'Corporate training'
};
