#!/usr/bin/env python3
"""Pre-deploy check for the BlütenSturm site. Python standard library only.

  python3 tools/check_site.py

Checks:
  1. Translations: every data-i18n / data-i18n-html / data-i18n-attr key used
     in site/*.html exists in DE, FR, ES and IT in site/assets/js/i18n.js, and
     every runtime key main.js asks for (t('js.…')) exists in all five
     languages. Unused dictionary keys are listed as warnings.
  2. Markup in translations: for data-i18n-html keys, each language has the
     same HTML tags as the English source.
  3. Links and files: every local href/src (pages, #anchors, images, CSS, JS,
     fonts referenced from CSS) resolves to a real file or element id.
Exits with status 1 if anything is missing, so it can gate a deploy.
"""
import json, os, re, sys
from html.parser import HTMLParser

BASE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SITE = os.path.join(BASE, 'site')
LANGS = ['de', 'fr', 'es', 'it']
errors, warnings = [], []


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.keys, self.ids, self.refs = {}, set(), []
        self.html_stack = []   # [key, depth, [tags]] for open data-i18n-html elements
        self.depth = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for st in self.html_stack:
            st[2].append(tag)
        if tag not in ('br', 'img', 'input', 'meta', 'link', 'source', 'hr', 'area', 'base', 'col', 'embed', 'wbr'):
            self.depth += 1
        if a.get('id'):
            self.ids.add(a['id'])
        if 'data-i18n' in a:
            self.keys[a['data-i18n']] = 'text'
        if 'data-i18n-html' in a:
            self.keys[a['data-i18n-html']] = 'html'
            self.html_stack.append([a['data-i18n-html'], self.depth, []])
        if 'data-i18n-attr' in a:
            for pair in a['data-i18n-attr'].split(';'):
                if ':' in pair:
                    self.keys[pair.split(':', 1)[1].strip()] = 'attr'
        for attr in ('href', 'src'):
            if a.get(attr):
                self.refs.append(a[attr])
        if a.get('srcset'):
            self.refs += [p.strip().split()[0] for p in a['srcset'].split(',') if p.strip()]

    def handle_endtag(self, tag):
        if self.html_stack and self.html_stack[-1][1] == self.depth:
            key, _, tags = self.html_stack.pop()
            self.html_tags = getattr(self, 'html_tags', {})
            self.html_tags[key] = sorted(tags)
        self.depth -= 1


def load_dict():
    src = open(os.path.join(SITE, 'assets', 'js', 'i18n.js'), encoding='utf-8').read()
    try:
        start = src.index('{', src.index('window.BS_I18N'))
        return json.loads(src[start:src.rindex('}') + 1])
    except ValueError as e:
        errors.append(f'i18n.js: the object after "window.BS_I18N =" is not valid JSON: {e}')
        return {}


pages = {}
for name in sorted(os.listdir(SITE)):
    if name.endswith('.html'):
        p = Page()
        p.feed(open(os.path.join(SITE, name), encoding='utf-8').read())
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
for l in LANGS:
    for k in D.get(l, {}):
        if k not in used and not k.startswith('js.'):
            warnings.append(f'[i18n] "{k}" in {l.upper()} is not used by any page')

# 2. markup parity for html keys
tagre = re.compile(r'<\s*([a-zA-Z0-9]+)')
for name, p in pages.items():
    for k, tags in getattr(p, 'html_tags', {}).items():
        for l in LANGS:
            v = D.get(l, {}).get(k)
            if v is not None and sorted(t.lower() for t in tagre.findall(v)) != tags:
                errors.append(f'[i18n] "{k}" in {l.upper()} has different HTML tags than the English source')

# 3. local links and files
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

css = open(os.path.join(SITE, 'assets', 'css', 'style.css'), encoding='utf-8').read()
for url in re.findall(r'url\("?(\.\./[^")]+)"?\)', css):
    if not os.path.exists(os.path.normpath(os.path.join(SITE, 'assets', 'css', url))):
        errors.append(f'[css] {url} does not exist')

for w in warnings:
    print('warning:', w)
for e in errors:
    print('ERROR:', e)
print(f'\n{len(pages)} pages, {len(used)} translation keys, {len(errors)} errors, {len(warnings)} warnings')
sys.exit(1 if errors else 0)
