#!/usr/bin/env python3
"""Render the prices of bluetensturm.com from site/data/pricing.json (stdlib only).

    python3 tools/pricing.py           # write the price section, the offer, the price note and the translations
    python3 tools/pricing.py --check   # exit 1 if a page or i18n.js is out of step with the JSON (check_site.py runs this)

site/data/pricing.json is the single source of truth (the owner's price list,
German). This tool writes, in place:

  site/index.html   the section between <!-- pricing:start --> and <!-- pricing:end -->,
                    the hero offer link between <!-- pricing:pill:start --> and <!-- pricing:pill:end -->,
                    and <meta name="bs-offer-until"> before boot.js (offer.valid_until)
  every page        the footer price note (data-i18n="prices.vat"; data-vat-de on the German-only legal pages)
  i18n.js           every "prices.*" key in DE, FR, ES and IT

German is taken from the JSON as it stands; English goes into the HTML; the
other languages come from tools/pricing_i18n.json, keyed by the German text.
A German text without its translations stops the tool, so the five languages
never drift apart. Never edit the generated parts by hand: edit the JSON (or
the translation table) and run the tool again.

The October offer is in the markup but hidden: boot.js shows it before the
first paint while the time is before offer.valid_until (html.offer-on), main.js
ends it on time. Without JavaScript only the regular prices show. Remove
"offer" from the JSON once it has ended and run the tool, so the markup goes too.
"""
import datetime
import html
import json
import os
import re
import sys

BASE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SITE = os.path.join(BASE, 'site')
DATA = os.path.join(SITE, 'data', 'pricing.json')
TABLE = os.path.join(BASE, 'tools', 'pricing_i18n.json')
I18N = os.path.join(SITE, 'assets', 'js', 'i18n.js')
LANGS = ['de', 'fr', 'es', 'it']        # the languages in i18n.js; English lives in the HTML
ALL = ['de', 'en', 'fr', 'es', 'it']
PREFIX = 'prices.'
NBSP = '\u00a0'

MONTHS = {
    'en': 'January February March April May June July August September October November December'.split(),
    'fr': 'janvier février mars avril mai juin juillet août septembre octobre novembre décembre'.split(),
    'es': 'enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre'.split(),
    'it': 'gennaio febbraio marzo aprile maggio giugno luglio agosto settembre ottobre novembre dicembre'.split(),
}

# What a request button preselects in the contact form's "Interested in" (must equal an <option value>).
INTEREST = {
    'websites': 'Website & digital experience',
    'social_media': 'Social media management',
    'retail_promotion': 'BlütenSturm Live — in-store games',
    'other_services': {'branding': 'Brand strategy', 'ads': 'Advertising', 'events': 'Event marketing & promotions',
                       'academy_30': 'Academy programme', 'academy_100': 'Academy programme'},
}


class Out(Exception):
    pass


def esc(s):
    return html.escape(s, quote=True)


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', str(s).lower()).strip('-')


def typo(s):
    # German as given, kept from breaking where it must not: "50 %", "z. B."
    return re.sub(r'(\d) %', '\\1' + NBSP + '%', s).replace('z. B.', 'z.' + NBSP + 'B.')


def date(iso, lang):
    y, m, d = (int(x) for x in iso[:10].split('-'))
    if lang == 'de':
        return f'{d:02d}.{m:02d}.{y}'
    month = MONTHS[lang][m - 1]
    if lang == 'fr':
        return ('1er' if d == 1 else str(d)) + NBSP + month + ' ' + str(y)
    if lang == 'es':
        return f'{d} de {month} de {y}'
    if lang == 'it':
        return ('1°' if d == 1 else str(d)) + ' ' + month + ' ' + str(y)
    return f'{d} {month} {y}'


def eur_en(n):
    return '€{:,}'.format(n)


def eur_de(n):
    return '{:,}'.format(n).replace(',', '.') + ' €'


def validate(d):
    """Clear messages for the edits the owner is likely to make, before anything is rendered."""
    def need(ok, msg):
        if not ok:
            raise Out('pricing.json: ' + msg)

    def text(v):
        return isinstance(v, str) and v.strip() != ''

    def euros(v):
        return isinstance(v, int) and not isinstance(v, bool) and v >= 0

    seen = {}

    def group(where, v):
        need(isinstance(v, list), f'"{where}" must be a list [ … ] of entries')
        return v

    def item(where, x, kinds):
        need(isinstance(x, dict), f'{where}: each entry must be an object {{…}}')
        need(text(x.get('id')) and text(x.get('name')), f'{where}: every entry needs an "id" and a "name"')
        label = f'{where} "{x["id"]}"'
        need(slug(x['id']) != '', f'{label}: the id needs letters a–z or digits (it becomes part of the page address)')
        need(slug(x['id']) not in seen.setdefault(where, set()), f'{label}: the id is used twice in "{where}"')
        seen[where].add(slug(x['id']))
        need(isinstance(x.get('features', []), list) and all(text(f) for f in x.get('features', [])),
             f'{label}: "features" must be a list of texts')
        found = [k for k in kinds if k in x]
        need(len(found) == 1 or (set(found) == {'price_monthly_min', 'price_monthly_max'}),
             f'{label}: needs exactly one price, one of {", ".join(kinds)}')
        for k in found:
            v = x[k]
            need(euros(v) or (k == 'price' and where == 'other_services' and text(v)),
                 f'{label}: "{k}" must be a whole number of euros, like 1200 (found {v!r})')
        return label

    need(isinstance(d, dict), 'the file must be one JSON object')
    try:
        datetime.date.fromisoformat(d.get('updated') if isinstance(d.get('updated'), str) and re.fullmatch(r'\d{4}-\d\d-\d\d', d['updated']) else '')
    except ValueError:
        need(False, '"updated" must be a real date like "2026-10-17"')
    need(text(d.get('vat_note')), '"vat_note" is missing ("Alle Preise sind Endpreise.")')
    for w in group('websites', d.get('websites', [])):
        label = item('websites', w, ['price', 'price_monthly'])
        if 'offer_price' in w:
            need('price' in w and euros(w['offer_price']) and 0 < w['offer_price'] < w['price'],
                 f'{label}: "offer_price" must be a whole number of euros below "price"')
    sm = d.get('social_media')
    if sm is not None:
        need(isinstance(sm, dict), '"social_media" must be an object { … }')
        need(euros(sm.get('min_term_months')) and sm['min_term_months'] > 0, 'social_media: "min_term_months" must be a number')
        for x in group('social_media.packages', sm.get('packages', [])):
            label = item('social_media', x, ['price_monthly'])
            if 'offer_first_month' in x:
                need(euros(x['offer_first_month']) and 0 < x['offer_first_month'] < x['price_monthly'],
                     f'{label}: "offer_first_month" must be a whole number of euros below "price_monthly"')
        need(sm.get('note') is None or text(sm['note']), 'social_media: "note" must be a text')
    for x in group('other_services', d.get('other_services', [])):
        label = item('other_services', x, ['price_from', 'price_from_monthly', 'price_monthly_min', 'price_monthly', 'price'])
        if 'price_monthly_min' in x:
            need(euros(x.get('price_monthly_max')) and x['price_monthly_max'] > x['price_monthly_min'],
                 f'{label}: "price_monthly_max" must be a number above "price_monthly_min"')
    for x in group('retail_promotion', d.get('retail_promotion', [])):
        item('retail_promotion', x, ['price'])
    need(d.get('retail_promotion_note') is None or text(d['retail_promotion_note']), '"retail_promotion_note" must be a text')
    o = d.get('offer')
    if o is not None:
        need(isinstance(o, dict), '"offer" must be an object { … } (delete it once the offer has ended)')
        need(all(text(o.get(k)) for k in ('name', 'headline', 'terms')), 'offer: needs "name", "headline" and "terms"')
        known = {'websites', 'social_media_first_month'}
        need(isinstance(o.get('applies_to', []), list) and set(o.get('applies_to', [])) <= known,
             'offer.applies_to may only list "websites" and "social_media_first_month"')
        until = o.get('valid_until', '')
        need(isinstance(until, str) and re.fullmatch(r'\d{4}-\d\d-\d\dT23:59:59[+-]\d\d:\d\d', until),
             'offer.valid_until must be the last second of the last day, Berlin time, like 2026-10-31T23:59:59+01:00')
        try:
            at = datetime.datetime.fromisoformat(until)
        except ValueError:
            need(False, f'offer.valid_until: {until} is not a real date')
        try:
            from zoneinfo import ZoneInfo
            berlin = at.astimezone(ZoneInfo('Europe/Berlin')).utcoffset()
        except Exception:   # no time zone data on this computer: skip this one check
            berlin = at.utcoffset()
        need(berlin == at.utcoffset(), f'offer.valid_until: on that date Berlin is UTC{"+" if berlin >= datetime.timedelta(0) else "-"}'
             f'{abs(int(berlin.total_seconds())) // 3600:02d}:00, not {until[-6:]}')


class Builder:
    def __init__(self, data, table):
        self.data = data
        self.ui_table = table.get('ui', {})
        self.text_table = table.get('text', {})
        self.keys = {}          # key -> {lang: text} for de, en, fr, es, it
        self.html_keys = set()
        self.missing = []

    # ---- translations ----
    def tr(self, german):
        if not isinstance(german, str) or not german.strip():
            raise Out(f'pricing.json: expected a German text, found {german!r}')
        row = self.text_table.get(german)
        if not row or any(not row.get(l) for l in ('en', 'fr', 'es', 'it')):
            self.missing.append(german)
            row = {l: german for l in ('en', 'fr', 'es', 'it')}
        out = {'de': typo(german)}
        out.update({l: row[l] for l in ('en', 'fr', 'es', 'it')})
        return out

    def ui(self, ident, **fill):
        row = self.ui_table.get(ident)
        if not row or any(not row.get(l) for l in ALL):
            raise Out(f'tools/pricing_i18n.json: ui "{ident}" needs de, en, fr, es and it')
        out = {}
        for l in ALL:
            v = row[l]
            if 'date' in fill:
                v = v.replace('{date}', date(fill['date'], l))
            if 'n' in fill:
                v = v.replace('{n}', str(fill['n']))
            if 'name' in fill:
                v = v.replace('{name}', fill['name'][l])
            if 'text' in fill:
                v = v.replace('{text}', fill['text'][l])
            out[l] = v
        return out

    def key(self, key, values, is_html=False):
        key = PREFIX + key
        old = self.keys.get(key)
        if old is not None and old != values:
            raise Out(f'two different texts for the key "{key}"')
        self.keys[key] = values
        if is_html:
            self.html_keys.add(key)
        return key

    # ---- markup helpers ----
    def el(self, tag, key, values, cls='', extra=''):
        k = self.key(key, values)
        c = f' class="{cls}"' if cls else ''
        return f'<{tag}{c}{extra} data-i18n="{k}">{esc(values["en"])}</{tag}>'

    def items(self, prefix, features, pad, cls='tier__items'):
        lis = []
        for i, f in enumerate(features, 1):
            lis.append(f'{pad}  <li><span class="petal-mark" aria-hidden="true"></span>'
                       + self.el('span', f'{prefix}.f{i}', self.tr(f)) + '</li>')
        return [f'{pad}<ul class="{cls}">'] + lis + [f'{pad}</ul>']

    def request(self, prefix, name, package, offer_package=None, interest=None):
        k = self.key(f'{prefix}.req', self.ui('req.aria', name=name))
        req = self.ui('req')
        self.key('req', req)
        attrs = ''
        if interest:
            attrs += f' data-interest="{esc(interest)}"'
        attrs += f' data-package="{esc(package)}"'
        if offer_package:
            attrs += f' data-package-offer="{esc(offer_package)}"'
        return (f'<a class="tlink tier__req" href="#contact"{attrs} aria-label="{esc(self.keys[k]["en"])}"'
                f' data-i18n-attr="aria-label:{k}" data-i18n="{PREFIX}req">{esc(req["en"])}</a>')

    def money(self, n):
        return f'<span data-price="{n}">{esc(eur_en(n))}</span>'

    def month(self):
        return self.el('small', 'month', self.ui('month'))

    def struck(self, n):
        return self.el('span', 'regular', self.ui('regular'), 'sr-only') + f' <s>{self.money(n)}</s>'

    # ---- the offer ----
    def offer(self):
        o = self.data.get('offer')
        if not o:
            return None
        return o   # checked in validate()

    def pill(self):
        o = self.offer()
        if not o:
            return ''
        pad = '      '
        return (f'\n{pad}<a class="offer-pill offer-only" href="#prices">'
                + self.el('span', 'offer.name', self.tr(o['name']), 'lbl')
                + self.el('span', 'offer.headline', self.tr(o['headline']), 'offer-pill__head')
                + self.el('span', 'until', self.ui('until', date=o['valid_until']), 'offer-pill__until')
                + '</a>')

    # ---- the section ----
    def section(self):
        d = self.data
        o = self.offer()
        P = '  '
        L = []
        a = L.append
        a(f'{P}<section class="section prices" id="prices" aria-labelledby="prices-title">')
        a(f'{P}  <div class="wrap">')
        a(f'{P}    <div class="split split--end">')
        a(f'{P}      ' + self.el('p', 'lbl', self.ui('lbl'), 'lbl', ' data-rule'))
        a(f'{P}      <div class="stack gap-24">')
        title = self.ui('title')
        k = self.key('title', title, is_html=True)
        a(f'{P}        <h2 class="h-l reveal" id="prices-title" data-i18n-html="{k}">{title["en"]}</h2>')
        a(f'{P}        ' + self.el('p', 'vat', self.tr(d['vat_note']), 'lead'))
        a(f'{P}        ' + self.el('p', 'asof', self.ui('asof', date=d['updated']), 'lbl'))
        a(f'{P}      </div>')
        a(f'{P}    </div>')

        if o:
            a('')
            a(f'{P}    <aside class="offer offer-only mt-72" aria-labelledby="offer-title">')
            a(f'{P}      <img class="offer__petal" src="/assets/img/petal-pollen.svg" alt="" width="120" height="178" loading="lazy" decoding="async">')
            a(f'{P}      <div class="offer__text">')
            a(f'{P}        <p class="lbl">' + self.el('span', 'offer.name', self.tr(o['name']))
              + ' · ' + self.el('span', 'until', self.ui('until', date=o['valid_until'])) + '</p>')
            a(f'{P}        ' + self.el('p', 'offer.headline', self.tr(o['headline']), 'offer__title', ' id="offer-title"'))
            a(f'{P}        ' + self.el('p', 'offer.terms', self.tr(o['terms']), 'offer__terms'))
            a(f'{P}      </div>')
            a(f'{P}    </aside>')
        on_web = bool(o) and 'websites' in o.get('applies_to', [])
        on_social = bool(o) and 'social_media_first_month' in o.get('applies_to', [])

        # 1. Websites
        if d.get('websites'):
            a('')
            a(f'{P}    <div class="price-group mt-96" id="prices-websites">')
            a(f'{P}      <div class="price-group__head">')
            a(f'{P}        ' + self.el('h3', 'web.t', self.ui('web.t'), 'h-s'))
            a(f'{P}        ' + self.el('p', 'web.sub', self.ui('web.sub'), 'lbl'))
            a(f'{P}      </div>')
            a(f'{P}      <div class="tiers">')
            for w in d.get('websites', []):
                pre = f'web.{slug(w["id"])}'
                name = self.tr(w['name'])
                q = f'{P}        '
                if 'price' in w:
                    n = w['price']
                    a(f'{q}<article class="tier" id="price-web-{slug(w["id"])}" data-pick data-tilt>')
                    a(f'{q}  ' + self.el('h4', f'{pre}.name', name, 'tier__name', ' data-pick-name'))
                    a(f'{q}  <div class="tier__price">')
                    deal = on_web and w.get('offer_price') is not None
                    if deal:
                        a(f'{q}    <p class="tier__now offer-off" data-pick-reg>{self.money(n)}</p>')
                        a(f'{q}    <p class="tier__now offer-only">{self.struck(n)} <span data-pick-offer>'
                          + self.el('span', 'offer.name', self.tr(o['name']), 'sr-only') + f' <b data-price="{w["offer_price"]}">{esc(eur_en(w["offer_price"]))}</b></span></p>')
                        a(f'{q}    ' + self.el('p', 'offer.name', self.tr(o['name']), 'lbl tier__deal offer-only', ' aria-hidden="true"'))
                    else:
                        a(f'{q}    <p class="tier__now" data-pick-reg>{self.money(n)}</p>')
                    a(f'{q}  </div>')
                    L.extend(self.items(pre, w.get('features', []), q + '  '))
                    if w.get('example'):
                        a(f'{q}  ' + self.el('p', f'{pre}.ex', self.ui('example', text=self.tr(w['example'])), 'tier__ex'))
                    package = f'{w["name"]} — {eur_de(n)}'
                    offer_package = f'{w["name"]} — {o["name"]}: {eur_de(w["offer_price"])} statt {eur_de(n)}' if deal else None
                    a(f'{q}  ' + self.request(pre, name, package, offer_package, INTEREST['websites']))
                    a(f'{q}</article>')
                elif 'price_monthly' in w:
                    n = w['price_monthly']
                    a(f'{q}<div class="tier tier--wide" id="price-web-{slug(w["id"])}" data-pick>')
                    opt = (' ' + self.el('span', 'optional', self.ui('optional'), 'lbl')) if w.get('optional') else ''
                    a(f'{q}  <h4 class="tier__name">' + self.el('span', f'{pre}.name', name, '', ' data-pick-name') + opt + '</h4>')
                    L.extend(self.items(pre, w.get('features', []), q + '  ', 'tier__items tier__items--inline'))
                    nod = (' ' + self.el('small', 'nodiscount', self.ui('nodiscount'), 'offer-only')) if on_web else ''
                    a(f'{q}  <p class="tier__now"><span data-pick-reg>{self.money(n)} {self.month()}</span>{nod}</p>')
                    package = f'{w["name"]}{" (optional)" if w.get("optional") else ""} — {eur_de(n)} / Monat'
                    a(f'{q}  ' + self.request(pre, name, package, None, INTEREST['websites']))
                    a(f'{q}</div>')
                else:
                    raise Out(f'pricing.json: website "{w.get("id")}" has no price or price_monthly')
            a(f'{P}      </div>')
            a(f'{P}    </div>')

        # 2. Social media
        sm = d.get('social_media')
        if sm and sm.get('packages'):
            a('')
            a(f'{P}    <div class="price-group mt-96" id="prices-social">')
            a(f'{P}      <div class="price-group__head">')
            a(f'{P}        ' + self.el('h3', 'social.t', self.ui('social.t'), 'h-s'))
            a(f'{P}        ' + self.el('p', 'social.sub', self.ui('social.sub', n=sm['min_term_months']), 'lbl'))
            a(f'{P}      </div>')
            a(f'{P}      <div class="tiers">')
            for s in sm.get('packages', []):
                pre = f'social.{slug(s["id"])}'
                name = self.tr(s['name'])
                n = s['price_monthly']
                q = f'{P}        '
                a(f'{q}<article class="tier" id="price-social-{slug(s["id"])}" data-pick data-pick-group data-tilt>')
                a(f'{q}  ' + self.el('h4', f'{pre}.name', name, 'tier__name', ' data-pick-name'))
                a(f'{q}  <div class="tier__price">')
                a(f'{q}    <p class="tier__now" data-pick-reg>{self.money(n)} {self.month()}</p>')
                deal = on_social and s.get('offer_first_month') is not None
                if deal:
                    f1 = s['offer_first_month']
                    a(f'{q}    <p class="tier__first offer-only">' + self.el('span', 'first', self.ui('first', date=o['valid_until']))
                      + f' {self.struck(n)} <span data-pick-offer data-pick-add>' + self.el('span', 'firstdeal', self.ui('firstdeal'), 'sr-only')
                      + f' <b data-price="{f1}">{esc(eur_en(f1))}</b></span></p>')
                a(f'{q}  </div>')
                L.extend(self.items(pre, s.get('features', []), q + '  '))
                group = self.ui('social.t')
                aria = {l: group[l] + ' ' + name[l] for l in ALL}
                term = f'{sm["min_term_months"]} Monate Mindestlaufzeit'
                package = f'Social Media {s["name"]} — {eur_de(n)} / Monat, {term}'
                offer_package = (package + f'; {o["name"]}: 1. Monat {eur_de(s["offer_first_month"])}') if deal else None
                a(f'{q}  ' + self.request(pre, aria, package, offer_package, INTEREST['social_media']))
                a(f'{q}</article>')
            a(f'{P}      </div>')
            if sm.get('note'):
                a(f'{P}      ' + self.el('p', 'social.note', self.tr(sm['note']), 'price-group__note'))
            a(f'{P}    </div>')

        # 3. More services
        more = d.get('other_services', [])
        if more:
            a('')
            a(f'{P}    <div class="price-group mt-96" id="prices-more">')
            a(f'{P}      <div class="price-group__head">')
            a(f'{P}        ' + self.el('h3', 'more.t', self.ui('more.t'), 'h-s'))
            a(f'{P}      </div>')
            a(f'{P}      <ul class="price-list">')
            for s in more:
                sid = slug(s['id'])
                pre = f'more.{sid}'
                name = self.tr(s['name'])
                q = f'{P}        '
                frm = self.el('small', 'from', self.ui('from'), 'price-from')
                if 'price_from' in s:
                    price, de = f'{frm} {self.money(s["price_from"])}', f'ab {eur_de(s["price_from"])}'
                elif 'price_from_monthly' in s:
                    price = f'{frm} {self.money(s["price_from_monthly"])} {self.month()}'
                    de = f'ab {eur_de(s["price_from_monthly"])} / Monat'
                    if s.get('note'):
                        price += ' ' + self.el('small', f'{pre}.note', self.tr(s['note']))
                        de += ' ' + s['note']
                elif 'price_monthly_min' in s:
                    lo, hi = s['price_monthly_min'], s['price_monthly_max']
                    price = f'<span data-price-range="{lo}-{hi}">{esc(eur_en(lo) + "–" + eur_en(hi))}</span> {self.month()}'
                    de = '{}–{} € / Monat'.format(eur_de(lo)[:-2], eur_de(hi)[:-2])
                elif isinstance(s.get('price_monthly'), int):
                    price, de = f'{self.money(s["price_monthly"])} {self.month()}', f'{eur_de(s["price_monthly"])} / Monat'
                elif isinstance(s.get('price'), int):
                    price, de = self.money(s['price']), eur_de(s['price'])
                elif isinstance(s.get('price'), str):
                    price, de = self.el('span', f'{pre}.price', self.tr(s['price'])), s['price']
                else:
                    raise Out(f'pricing.json: service "{s.get("id")}" has no price I know how to show')
                a(f'{q}<li class="price-row" id="price-{sid}" data-pick>')
                a(f'{q}  ' + self.el('h4', f'{pre}.name', name, 'price-row__name', ' data-pick-name'))
                if s.get('features'):
                    a(f'{q}  ' + self.el('p', f'{pre}.desc', self.tr(', '.join(s['features'])), 'price-row__desc'))
                a(f'{q}  <p class="price-row__price" data-pick-reg>{price}</p>')
                a(f'{q}  ' + self.request(pre, name, f'{s["name"]} — {de}', None, INTEREST['other_services'].get(s['id'])))
                a(f'{q}</li>')
            a(f'{P}      </ul>')
            a(f'{P}    </div>')

        # 4. Promotion in retail
        retail = d.get('retail_promotion', [])
        if retail:
            a('')
            a(f'{P}    <div class="price-group mt-96" id="prices-retail">')
            a(f'{P}      <div class="price-group__head">')
            a(f'{P}        ' + self.el('h3', 'retail.t', self.ui('retail.t'), 'h-s'))
            a(f'{P}        ' + self.el('p', 'retail.sub', self.ui('retail.sub'), 'lbl'))
            a(f'{P}      </div>')
            a(f'{P}      <div class="tiers tiers--4">')
            for r in retail:
                if r.get('paid_by', 'Marke') != 'Marke':
                    raise Out(f'pricing.json: retail "{r.get("id")}": only paid_by "Marke" has a label (add one to tools/pricing.py)')
                pre = f'retail.{slug(r["id"])}'
                name = self.tr(r['name'])
                q = f'{P}        '
                a(f'{q}<article class="tier" id="price-retail-{slug(r["id"])}" data-pick data-tilt>')
                a(f'{q}  ' + self.el('h4', f'{pre}.name', name, 'tier__name', ' data-pick-name'))
                a(f'{q}  <div class="tier__price">')
                a(f'{q}    <p class="tier__now" data-pick-reg>{self.money(r["price"])}</p>')
                a(f'{q}    ' + self.el('p', 'paidby', self.ui('paidby'), 'lbl tier__by'))
                a(f'{q}  </div>')
                L.extend(self.items(pre, r.get('features', []), q + '  '))
                a(f'{q}  ' + self.request(pre, name, f'{r["name"]} — {eur_de(r["price"])} (zahlt die Marke)', None, INTEREST['retail_promotion']))
                a(f'{q}</article>')
            a(f'{P}      </div>')
            if d.get('retail_promotion_note'):
                a(f'{P}      ' + self.el('p', 'retail.note', self.tr(d['retail_promotion_note']), 'price-group__note'))
            a(f'{P}    </div>')

        a(f'{P}  </div>')
        a(f'{P}</section>')
        # Keys used only by hand-written markup (service dialogs, footers) stay owned here too.
        self.key('see', self.ui('see'))
        return '\n' + '\n'.join(L)


def read(path):
    with open(path, encoding='utf-8-sig') as f:   # a BOM (Windows Notepad) is fine
        return f.read()


def between(src, start, end, inner, path):
    pat = re.compile(re.escape(start) + r'.*?(\n[ \t]*' + re.escape(end) + ')', re.S)
    if not pat.search(src):
        raise Out(f'{os.path.relpath(path, BASE)}: markers {start} … {end} not found')
    return pat.sub(lambda m: start + inner + m.group(1), src, count=1)


def render():
    """Return {path: expected content} for every file the tool owns."""
    data = json.loads(read(DATA))
    table = json.loads(read(TABLE))
    validate(data)
    b = Builder(data, table)
    section = b.section()
    pill = b.pill()
    vat = b.tr(data['vat_note'])
    b.key('vat', vat)
    if b.missing:
        raise Out('tools/pricing_i18n.json has no EN/FR/ES/IT for: ' + ' · '.join(f'"{m}"' for m in sorted(set(b.missing))))

    out = {}
    index = os.path.join(SITE, 'index.html')
    for name in sorted(os.listdir(SITE)):
        if not name.endswith('.html'):
            continue
        path = os.path.join(SITE, name)
        src = read(path)
        new = re.sub(r'(<([a-z]+)[^>]*\sdata-i18n="prices\.vat"[^>]*>)[^<]*(</\2>)',
                     lambda m: m.group(1) + esc(vat['en']) + m.group(3), src)
        new = re.sub(r'(<([a-z]+)[^>]*\sdata-vat-de[^>]*>)[^<]*(</\2>)',
                     lambda m: m.group(1) + esc(vat['de']) + m.group(3), new)
        if path == index:
            new = between(new, '<!-- pricing:start -->', '<!-- pricing:end -->', section, path)
            new = between(new, '<!-- pricing:pill:start -->', '<!-- pricing:pill:end -->', pill, path)
            new = re.sub(r'[ \t]*<meta name="bs-offer-until"[^>]*>\n', '', new)
            offer = data.get('offer')
            if offer:
                boot = '<script src="/assets/js/boot.js"></script>'
                if boot not in new:
                    raise Out('index.html: boot.js script tag not found (the offer meta goes right before it)')
                new = new.replace(boot, f'<meta name="bs-offer-until" content="{esc(offer["valid_until"])}">\n' + boot, 1)
        out[path] = new

    src = read(I18N)
    start = src.index('window.BS_I18N = {')
    head, body = src[:start], src[start + len('window.BS_I18N = '):]
    end = body.rindex('}')
    D = json.loads(body[:end + 1])
    for l in LANGS:
        block = {k: v for k, v in D.get(l, {}).items() if not k.startswith(PREFIX)}
        block.update({k: v[l] for k, v in b.keys.items()})
        D[l] = dict(sorted(block.items()))
    out[I18N] = head + 'window.BS_I18N = ' + json.dumps(D, ensure_ascii=False, indent=1) + body[end + 1:]
    return out


def own_keys(i18n_source):
    """The prices.* entries per language of an i18n.js text (None if it does not parse)."""
    try:
        body = i18n_source[i18n_source.index('window.BS_I18N = {') + len('window.BS_I18N = '):]
        D = json.loads(body[:body.rindex('}') + 1])
    except ValueError:
        return None
    return {l: {k: v for k, v in D.get(l, {}).items() if k.startswith(PREFIX)} for l in LANGS}


def main(argv):
    check = '--check' in argv
    try:
        files = render()
    except Out as e:
        print('pricing:', e, file=sys.stderr)
        return 1
    except Exception as e:   # anything validate() did not foresee: one line, never a traceback
        print(f'pricing: site/data/pricing.json could not be rendered ({type(e).__name__}: {e})', file=sys.stderr)
        return 1
    # i18n.js counts as stale only when its prices.* entries differ: other edits (and key order) are not ours to judge.
    stale = [p for p, text in files.items()
             if (own_keys(read(p)) != own_keys(text) if p == I18N else read(p) != text)]
    if check:
        for p in stale:
            print(f'pricing: {os.path.relpath(p, BASE)} is out of step with site/data/pricing.json — run python3 tools/pricing.py')
        return 1 if stale else 0
    for p in stale:
        with open(p, 'w', encoding='utf-8', newline='\n') as f:
            f.write(files[p])
        print('pricing: wrote', os.path.relpath(p, BASE))
    if not stale:
        print('pricing: everything already matches site/data/pricing.json')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
