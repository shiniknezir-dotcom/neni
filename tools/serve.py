#!/usr/bin/env python3
"""Local preview that behaves close to Netlify for this site.

  python3 tools/serve.py            -> http://localhost:8080
  python3 tools/serve.py 3000       -> another port

Emulates: extensionless URLs (/questionnaire -> questionnaire.html), the
404 page (also for folders without an index.html, as on Netlify), the 301
rules in site/_redirects (paths matched case-sensitively, like Netlify) and
the headers in site/_headers, including the Content-Security-Policy, so a
blocked inline script or style shows up locally the same way as in
production. GET and HEAD (curl -I) both work. Listens on this computer only.
Python standard library only. Not emulated: Netlify's CDN, deploy previews.
"""
import fnmatch, http.server, os, sys, urllib.parse

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site'))


def load_redirects():
    rules = {}
    path = os.path.join(ROOT, '_redirects')
    if os.path.exists(path):
        for line in open(path, encoding='utf-8'):
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            parts = line.split()
            if len(parts) >= 3 and parts[0].startswith('/') and parts[2].rstrip('!').isdigit():
                rules[urllib.parse.unquote(parts[0])] = (parts[1], int(parts[2].rstrip('!')))
    return rules


def load_headers():
    blocks, current = [], None
    path = os.path.join(ROOT, '_headers')
    if os.path.exists(path):
        for raw in open(path, encoding='utf-8'):
            if not raw.strip() or raw.lstrip().startswith('#'):
                continue
            if not raw[0].isspace():
                current = (raw.strip(), [])
                blocks.append(current)
            elif current and ':' in raw:
                k, v = raw.strip().split(':', 1)
                current[1].append((k.strip(), v.strip()))
    return blocks


REDIRECTS, HEADERS = load_redirects(), load_headers()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        path = urllib.parse.urlsplit(self.path).path
        for pattern, pairs in HEADERS:
            if fnmatch.fnmatch(path, pattern):
                for k, v in pairs:
                    self.send_header(k, v)
        super().end_headers()

    def route(self):
        """Return True if a response (redirect or 404) was already sent."""
        path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
        rule = REDIRECTS.get(path)
        if rule:
            self.send_response(rule[1])
            self.send_header('Location', rule[0])
            self.send_header('Content-Length', '0')
            self.end_headers()
            return True
        local = os.path.join(ROOT, path.lstrip('/'))
        if path != '/' and not os.path.splitext(path)[1] and os.path.isfile(local + '.html'):
            self.path = path + '.html'
            return False
        if os.path.isfile(local) or (os.path.isdir(local) and os.path.isfile(os.path.join(local, 'index.html'))):
            return False
        body = open(os.path.join(ROOT, '404.html'), 'rb').read()
        self.send_response(404)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)
        return True

    def do_GET(self):
        if not self.route():
            super().do_GET()

    def do_HEAD(self):
        if not self.route():
            super().do_HEAD()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    Handler.extensions_map.update({'.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2'})
    print(f'Serving {ROOT} on http://localhost:{port}  (Ctrl+C to stop)')
    http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
