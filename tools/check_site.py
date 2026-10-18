#!/usr/bin/env python3
"""Pre-deploy check for the BlütenSturm site. Python standard library only.

  python3 tools/check_site.py

Checks:
  1. Translations: every data-i18n / data-i18n-html / data-i18n-attr key used
     in site/*.html exists in DE, FR, ES and IT in site/assets/js/i18n.js, and
     every runtime key the scripts ask for (t('js.…') in main.js, every quoted
     dotted key in fx.js) exists in the languages that need it. Unused
     dictionary keys are listed as warnings. The dictionary must be strict
     JSON without repeated keys; no value may be empty.
  2. Markup in translations: text and attribute keys (applied with textContent
     or setAttribute) must not contain tags or entities, and an element with
     data-i18n must not contain child elements (they would be wiped). For
     data-i18n-html keys each language must carry exactly the same tag
     sequence, attributes included, as the English source.
  3. Forms: every data-interest value matches an <option value> of the
     "Interested in" select on the home page.
  4. Links and files: every local href/src (pages, #anchors, images, CSS, JS,
     fonts referenced from CSS) resolves to a real file or element id.
  5. Prices: the price section, the offer and the "prices.*" translations
     match site/data/pricing.json (tools/pricing.py --check); every page links
     Impressum and Datenschutz and carries the price note in its footer; the
     old 500 € website price appears nowhere. Once the offer's valid_until has
     passed, a warning asks to remove it from the JSON.
Exits with status 1 if anything is missing, so it can gate a deploy.
"""
import datetime, html, importlib.util, io, contextlib, json, os, re, sys
from html.parser import HTMLParser

BASE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SITE = os.path.join(BASE, 'site')
LANGS = ['de', 'fr', 'es', 'it']
VOID = {'br', 'img', 'input', 'meta', 'link', 'source', 'hr', 'area', 'base', 'col', 'embed', 'wbr', 'track', 'param'}
errors, warnings = [], []


def tag_token(tag, attrs):
    return 'start', tag.lower(), tuple(sorted((k.lower(), v or '') for k, v in attrs))


# Optional end tags, after the HTML parsing rules (simplified to what static pages use):
# these start tags close an open <p> in button scope ...
P_CLOSERS = {'address', 'article', 'aside', 'blockquote', 'center', 'details', 'dialog', 'dir', 'div', 'dl',
             'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header',
             'hgroup', 'hr', 'li', 'dd', 'dt', 'listing', 'main', 'menu', 'nav', 'ol', 'p', 'plaintext', 'pre',
             'search', 'section', 'summary', 'table', 'ul', 'xmp'}
SCOPE = {'applet', 'caption', 'html', 'table', 'td', 'th', 'marquee', 'object', 'template'}
BUTTON_SCOPE = SCOPE | {'button'}
# ... an <li> closes an open <li> (a <dd>/<dt> an open <dd>/<dt>) unless a list or another special
# element sits in between ...
LIST_STOP = SCOPE | {'ol', 'ul', 'dl', 'section', 'article', 'aside', 'nav', 'header', 'footer', 'main',
                     'form', 'fieldset', 'details', 'figure', 'blockquote', 'button', 'select', 'li', 'dd', 'dt'}
# ... and these close only the current element.
IMPLIED = {'option': {'option', 'optgroup'}, 'optgroup': {'optgroup'},
           'tr': {'tr'}, 'td': {'td', 'th', 'tr'}, 'th': {'td', 'th', 'tr'}}


class Page(HTMLParser):
    """Collects i18n keys, ids, references and the tag sequence inside html keys.

    Keeps a stack of open elements, so omitted optional end tags (</li>, </option>, </p> …)
    close their element where the browser would, instead of shifting every later record."""

    def __init__(self, name):
        super().__init__(convert_charrefs=True)
        self.name = name
        self.keys, self.ids, self.refs = {}, set(), []
        self.stack = []        # open elements: {'tag', 'text' (data-i18n key), 'html' ([key, tokens])}
        self.html_tags = {}
        self.interests, self.options = [], []
        self.in_interest = False

    def close(self):
        super().close()
        while self.stack:
            self._pop()

    def _close(self, names, stop):
        """Close the nearest open element named in names, unless an element in stop comes first."""
        for i in range(len(self.stack) - 1, -1, -1):
            tag = self.stack[i]['tag']
            if tag in names:
                while len(self.stack) > i:
                    self._pop()
                return
            if tag in stop:
                return

    def _pop(self):
        el = self.stack.pop()
        if el['tag'] == 'select':
            self.in_interest = False
        if el['html']:
            key, tokens = el['html']
            self.html_tags[key] = tokens

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)      # <br/> is a start tag only; never pops a record

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        a = dict(attrs)
        if tag in P_CLOSERS:
            self._close({'p'}, BUTTON_SCOPE)
        if tag == 'li':
            self._close({'li'}, LIST_STOP - {'li'})
        elif tag in ('dd', 'dt'):
            self._close({'dd', 'dt'}, LIST_STOP - {'dd', 'dt'})
        while self.stack and tag in IMPLIED.get(self.stack[-1]['tag'], ()):
            self._pop()
        for el in self.stack:
            if el['html']:
                el['html'][1].append(tag_token(tag, attrs))
            if el['text']:
                errors.append(f'[i18n] {self.name}: element with data-i18n="{el["text"]}" contains a <{tag}> child (textContent would remove it)')
        if a.get('id'):
            self.ids.add(a['id'])
        if 'data-i18n' in a:
            self.keys[a['data-i18n']] = 'text'
        if 'data-i18n-html' in a:
            self.keys[a['data-i18n-html']] = 'html'
        if 'data-i18n-attr' in a:
            for pair in a['data-i18n-attr'].split(';'):
                if ':' in pair:
                    self.keys[pair.split(':', 1)[1].strip()] = 'attr'
        if 'data-interest' in a:
            self.interests.append(a['data-interest'])
        if tag == 'select' and a.get('name') == 'Interested in':
            self.in_interest = True
        if tag == 'option' and self.in_interest and a.get('value') is not None:
            self.options.append(a['value'])
        for attr in ('href', 'src'):
            if a.get(attr):
                self.refs.append(a[attr])
        if a.get('srcset'):
            self.refs += [p.strip().split()[0] for p in a['srcset'].split(',') if p.strip()]
        if tag in VOID:
            return
        self.stack.append({'tag': tag, 'text': a.get('data-i18n'),
                           'html': [a['data-i18n-html'], []] if 'data-i18n-html' in a else None})

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in VOID:
            return
        if not any(el['tag'] == tag for el in self.stack):
            effect = {'p': 'the browser inserts an empty <p>', 'br': 'the browser reads it as <br>'}.get(tag, 'the browser ignores it')
            warnings.append(f'[html] {self.name}: </{tag}> has no open <{tag}> ({effect})')
            return
        while self.stack[-1]['tag'] != tag:  # elements whose end tag was omitted close here too
            self._pop()
        self._pop()
        for el in self.stack:
            if el['html']:
                el['html'][1].append(('end', tag))


class Fragment(HTMLParser):
    """Tag sequence of a translation string, in the same form as Page records it."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tokens = []

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_starttag(self, tag, attrs):
        self.tokens.append(tag_token(tag, attrs))

    def handle_endtag(self, tag):
        if tag not in VOID:
            self.tokens.append(('end', tag.lower()))


def no_duplicates(pairs):
    d = {}
    for k, v in pairs:
        if k in d:
            errors.append(f'[i18n] key "{k}" appears twice in one block of i18n.js')
        d[k] = v
    return d


def load_dict():
    src = open(os.path.join(SITE, 'assets', 'js', 'i18n.js'), encoding='utf-8-sig').read()   # a BOM is fine for browsers
    # Blank out closed /* … */ comments (keeping offsets), so a mention of the
    # assignment inside the header comment is never mistaken for the real one.
    code = re.sub(r'/\*.*?\*/', lambda m: ' ' * len(m.group(0)), src, flags=re.S)
    m = re.search(r'window\.BS_I18N\s*=\s*\{', code)
    if not m or code[:m.start()].strip():
        errors.append('i18n.js: the file must be comments, then "window.BS_I18N = {…};" (an unclosed /* comment breaks the whole script)')
        return {}
    end = code.rindex('}')
    if code[end + 1:].strip() not in ('', ';'):
        errors.append('i18n.js: unexpected text after the closing brace of window.BS_I18N')
    try:
        return json.loads(src[m.end() - 1:end + 1], object_pairs_hook=no_duplicates)
    except ValueError as e:
        errors.append(f'i18n.js: the object after "window.BS_I18N =" is not valid JSON: {e}')
        return {}


pages = {}
for name in sorted(os.listdir(SITE)):
    if name.endswith('.html'):
        p = Page(name)
        p.feed(open(os.path.join(SITE, name), encoding='utf-8').read())
        p.close()
        pages[name] = p

D = load_dict()
used = {}
for name, p in pages.items():
    for k, kind in p.keys.items():
        used.setdefault(k, (kind, name))

# 1. coverage
for k, (kind, name) in sorted(used.items()):
    for l in LANGS:
        if k not in D.get(l, {}):
            errors.append(f'[i18n] "{k}" (used in {name}) is missing in {l.upper()}')
js = open(os.path.join(SITE, 'assets', 'js', 'main.js'), encoding='utf-8').read()
for k in sorted(set(re.findall(r"t\('(js\.[a-z0-9.\-]+)'\)", js))):
    for l in ['en'] + LANGS:
        if k not in D.get(l, {}):
            errors.append(f'[i18n] runtime key "{k}" (main.js) is missing in {l.upper()}')
runtime = set()
fx_path = os.path.join(SITE, 'assets', 'js', 'fx.js')
if os.path.exists(fx_path):
    fx = open(fx_path, encoding='utf-8').read()
    # fx.js names its translation keys as quoted dotted strings ('hero.motion.on'); it has no other
    # strings of that shape, so every one of them must exist in all four languages.
    for k in set(re.findall(r"'([a-z0-9]+(?:\.[a-z0-9\-]+)+)'", fx)):
        runtime.add(k)
        for l in LANGS:
            if k not in D.get(l, {}):
                errors.append(f'[i18n] runtime key "{k}" (fx.js) is missing in {l.upper()}')
for l in LANGS:
    for k in D.get(l, {}):
        if k not in used and k not in runtime and not k.startswith('js.'):
            warnings.append(f'[i18n] "{k}" in {l.upper()} is not used by any page')

# 2. values and markup
entity = re.compile(r'&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);')
for l in ['en'] + LANGS:
    for k, v in D.get(l, {}).items():
        if not isinstance(v, str) or not v.strip():
            errors.append(f'[i18n] "{k}" in {l.upper()} is empty')
            continue
        kind = used.get(k, ('text', None))[0]
        if kind != 'html' and ('<' in v or entity.search(v)):
            errors.append(f'[i18n] "{k}" in {l.upper()} contains markup or an entity but is applied as plain text')
for name, p in pages.items():
    for k, tokens in p.html_tags.items():
        for l in LANGS:
            v = D.get(l, {}).get(k)
            if v is None:
                continue
            f = Fragment()
            f.feed(v)
            if f.tokens != tokens:
                errors.append(f'[i18n] "{k}" in {l.upper()} has different HTML tags than the English source')

# 3. package buttons point at a real "Interested in" option
home = pages.get('index.html')
if home:
    for name, p in pages.items():
        for v in p.interests:
            if v not in home.options:
                errors.append(f'[form] {name}: data-interest="{v}" is not an option of the "Interested in" select')

# 4. local links and files
def exists(path):
    path = path.split('#')[0].split('?')[0]
    if path in ('', '/'):
        return os.path.exists(os.path.join(SITE, 'index.html'))
    local = os.path.join(SITE, path.lstrip('/'))
    return os.path.exists(local) or os.path.exists(local + '.html') or os.path.isdir(local)

for name, p in pages.items():
    for ref in p.refs:
        if re.match(r'^(https?:|mailto:|tel:|data:)', ref):
            continue
        if ref.startswith('#'):
            if ref != '#' and ref[1:] not in p.ids:
                errors.append(f'[link] {name}: anchor {ref} has no matching id')
            continue
        if not ref.startswith('/'):
            errors.append(f'[link] {name}: use root-relative paths ("/…"), found "{ref}"')
            continue
        if not exists(ref):
            errors.append(f'[link] {name}: {ref} does not exist')
        frag = ref.split('#', 1)[1] if '#' in ref else ''
        target = ref.split('#')[0] or '/'
        if frag and target in ('/', '/index.html') and frag not in pages['index.html'].ids:
            errors.append(f'[link] {name}: {ref} — no id "{frag}" on the home page')

# 5. prices
spec = importlib.util.spec_from_file_location('pricing', os.path.join(BASE, 'tools', 'pricing.py'))
pricing = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pricing)
said, err = io.StringIO(), io.StringIO()
with contextlib.redirect_stdout(said), contextlib.redirect_stderr(err):
    stale = pricing.main(['--check'])
if stale:
    for line in (said.getvalue() + err.getvalue()).strip().splitlines():
        errors.append('[prices] ' + line.replace('pricing: ', '', 1))
try:
    price_list = json.load(open(os.path.join(SITE, 'data', 'pricing.json'), encoding='utf-8-sig'))
except (ValueError, OSError):
    price_list = None   # pricing.py --check above has already said what is wrong
if not stale and isinstance(price_list, dict) and isinstance(price_list.get('offer'), dict):
    offer = price_list['offer']
    until = datetime.datetime.fromisoformat(offer['valid_until'])   # validated by pricing.py: has an offset
    if datetime.datetime.now(datetime.timezone.utc) > until:
        warnings.append(f'[prices] the offer "{offer.get("name")}" ended {offer["valid_until"]}: the site already hides it; '
                        'remove "offer" from site/data/pricing.json and run python3 tools/pricing.py')
for name in pages:
    src = open(os.path.join(SITE, name), encoding='utf-8').read()
    foot = src[src.rfind('<footer'):] if '<footer' in src else ''
    for need in ('href="/impressum"', 'href="/datenschutz"'):
        if need not in foot:
            errors.append(f'[legal] {name}: the footer has no {need} link')
    if 'data-i18n="prices.vat"' not in foot and 'data-vat-de' not in foot:
        errors.append(f'[prices] {name}: the footer has no price note ("Alle Preise sind Endpreise.")')
_SP = '[ \u00a0\u202f\u2009]'
old_price = re.compile(r'(?<!\d[.,\u00a0\u202f\u2009 ])(?<!\d)500' + _SP + r'?(?:[.,](?:00|-|–))?' + _SP + r'?(?:€|euros?\b|EUR\b)'
                       r'|(?:€|\bEUR)' + _SP + r'?500(?:[.,](?:00|-|–))?(?!\d|[.,]\d|' + _SP + r'?\d{3}\b|' + _SP + r'?(?:k|m|mio|million|bn)\b)'
                       r'|data-price=["\']?500\b', re.I)
def _prices(v):
    """Every price number in the price list (fields whose name starts with "price" or "offer_")."""
    if isinstance(v, list):
        return [a for x in v for a in _prices(x)]
    if not isinstance(v, dict):
        return []
    out = [x for k, x in v.items() if (k.startswith('price') or k.startswith('offer_')) and isinstance(x, int)]
    out += [500 for x in v.values() if isinstance(x, str) and old_price.search(x)]   # the owner's own words: "ab 500 € pro Tag"
    out += [500 for x in v.values() if isinstance(x, list) and any(isinstance(y, str) and old_price.search(y) for y in x)]
    return out + [a for x in v.values() for a in _prices(x)]
if 500 in _prices(price_list):   # a 500 € price that the owner's list itself names is allowed again
    old_price = re.compile(r'(?!)')
def _plain(src):
    text = html.unescape(src)   # 500&nbsp;€, &euro;500, 500&#160;€ read as they render
    return text + '\n' + re.sub(r'<[^>]+>', '', text)   # and once without tags: <b>500</b>&nbsp;€
for name in pages:
    if old_price.search(_plain(open(os.path.join(SITE, name), encoding='utf-8').read())):
        errors.append(f'[prices] {name}: a 500 € price is still on the page (the old website price was withdrawn)')
for l in LANGS:
    for k, v in D.get(l, {}).items():
        if isinstance(v, str) and old_price.search(_plain(v)):
            errors.append(f'[prices] i18n.js {l.upper()} "{k}": a 500 € price (the old website price was withdrawn)')

css_dir = os.path.join(SITE, 'assets', 'css')
for css_name in sorted(os.listdir(css_dir)):
    if not css_name.endswith('.css'):
        continue
    css = open(os.path.join(css_dir, css_name), encoding='utf-8').read()
    for url in re.findall(r'url\("?(\.\./[^")]+)"?\)', css):
        if not os.path.exists(os.path.normpath(os.path.join(css_dir, url))):
            errors.append(f'[css] {css_name}: {url} does not exist')

for w in warnings:
    print('warning:', w)
for e in sorted(set(errors)):
    print('ERROR:', e)
print(f'\n{len(pages)} pages, {len(used)} translation keys, {len(set(errors))} errors, {len(warnings)} warnings')
sys.exit(1 if errors else 0)
