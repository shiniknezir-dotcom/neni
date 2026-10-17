# CLAUDE.md — bluetensturm.com

Static website of **BlütenSturm**, a marketing, creative and corporate-training agency in Würzburg (owners: Nezir Shinik & Dijan Cika). Production: https://bluetensturm.com on Netlify. Domain and mailbox (info@bluetensturm.com) at STRATO. Brand: "BlütenSturm Noir" — black and white, one pollen-yellow spark. House line: *Real brands. Real people.*

## Hard rules

- **No build step, no framework, no npm for the site.** Plain HTML, CSS and JavaScript in `site/`. Netlify publishes `site/` as is (`netlify.toml`). Keep it that way unless the owner asks.
- **Never change DNS, nameservers or MX records** (STRATO), and don't change domain settings in Netlify. The STRATO mailbox must keep working.
- **Never publish to production without the owner's explicit OK.** Preview first (PR deploy preview or `netlify deploy --dir=site`).
- **Content Security Policy** (`site/_headers`) allows only this site plus formspree.io. So: no inline `<script>` (JSON-LD data blocks are fine), no `style=""` attributes, no `onclick=` handlers, no CDNs, external fonts, iframes or embeds. Spacing utilities (`.mt-24`, `.maxw-640`, …) exist because inline styles are blocked. If a third-party service is truly needed, update the CSP **and** `site/datenschutz.html`, and add a consent banner first if it sets cookies or tracks.
- **Privacy by default:** no cookies, no analytics, fonts self-hosted. Keep it true or update the privacy page in the same change.
- **Five languages, always.** Every visible text exists in EN (in the HTML) and DE, FR, ES, IT (in `site/assets/js/i18n.js`). Run `python3 tools/check_site.py` before every commit and deploy; it must report **0 errors**.
- **Root-relative paths only** (`/assets/…`, `/questionnaire`, `/#contact`): Netlify serves `404.html` for any unknown path, so relative paths would break there.
- **Legal pages** (`impressum.html`, `datenschutz.html`) are German only and outside the i18n system. Never invent legal data; fill the yellow `[placeholders]` only with what the owner gives you.
- Don't add stock photos, fake testimonials, invented clients, numbers or case studies. Anything factual comes from the owner.

## Files

| Path | What |
|---|---|
| `site/index.html` | Home, built like the live bluetensturm.com (content and section order) in the Noir design. In order: hero ("Where brands bloom and ideas storm.", lead, two buttons) · What we do (18 petal tiles → service dialog; selected clients; the 18 `details.svc` entries as the no-JS list) · ribbon (five disciplines) · 01 agency (stats, facts) · 02 services (five discipline cards → service dialog) · prices & offers (`#prices`, generated, see below) · the full package · 03 why · 04 work (clients + case studies) · 05 portfolio (light band, 44 logos → brand dialog; "Let's work together") · BlütenSturm Live · 06 academy · Real people · 07 contact (form) · footer. Unnumbered sections (prices, full package, Live, people) are not on the live site |
| `site/questionnaire.html` | Full project questionnaire (`/questionnaire`) |
| `site/data/pricing.json` | **The price list** (the owner's, Stand 17.10.2026): the single source of every price and offer on the site. Served at `/data/pricing.json` (`noindex`); during the offer main.js reads it (at load, on wake, before a submission; at most once a minute) to end the offer by the server's clock |
| `site/thank-you.html` | Landing page after a successful form (`/thank-you`, noindex) |
| `site/impressum.html`, `site/datenschutz.html` | Legal pages, German, noindex |
| `site/404.html` | Not-found page |
| `site/_headers` / `site/_redirects` | Security + cache headers / 301s from the previous site's URLs |
| `site/assets/css/style.css` | All styles. Tokens in `:root` at the top; canvas components; a "Page additions" block and "Later fixes" at the end with their own breakpoints |
| `site/assets/js/boot.js` | In `<head>`: adds `.js`, picks the language, holds the page (≤1.8 s) so English never flashes; decides the opening (`html.intro`) and the offer (`html.offer-on`) before the first paint |
| `site/assets/js/i18n.js` | Translations (`window.BS_I18N`) |
| `site/assets/js/main.js` | Language switch, nav + mobile sheet, reveal/parallax/counters, service deep links, the offer clock (`html.offer-on`), request-button prefill, form sending, thank-you hook |
| `site/assets/js/storm.js` | The hero's 3D petal storm: raw WebGL2, instanced procedural petal meshes, wind field, pointer gusts, scroll surge. Starts after the page has loaded; adds `html.storm-on` while running (hides the CSS `.drift` petals so the hero keeps one yellow element). Off under reduced motion, `html.motion-off`, without WebGL2, and when WebGL would run in software (SwiftShader, llvmpipe: no GPU); a frame guard halves, then quarters the petals on slow hardware and finally hands back to the CSS petals |
| `site/assets/js/fx.js` + `site/assets/css/motion.css` | The motion layer: motion toggle (`[data-motion-toggle]`, shown once fx.js runs via `html.motion-ready`; class `html.motion-off`, event `bs:motion`), hero video backdrop (`[data-hero-video]`, played only ≥ 760 px, no data saver, in view), 3D tilt (`[data-tilt]`), word-by-word headline reveals, scroll choreography, cursor light. Everything off under reduced motion; no new storage keys. The base rules that keep the hero canvas, video and toggle inert without the layer are at the end of style.css ("Motion layer hooks") |
| `site/assets/css/intro.css` + `site/assets/js/intro.js` | The opening on the home page, "the bloom becomes the storm" (≈2.4 s, phones ≈1.8 s): the pollen petal drops, the flower opens, a gust bursts it, the wordmark forms, the stage splits to reveal the hero. Pure CSS keyframes; boot.js decides before the first paint (`html.intro`) and plays it only on a fresh arrival (not on reload, back/forward, from another page of the site, with a #hash, in a background tab, under reduced motion or `html.motion-off`). intro.js (async, right after boot.js) only skips on any key, click, wheel, touch or focus and cleans up (`bs:intro-done`). The markup is the `.opening` div, first child of `<body>`; style.css hides it by default. Without intro.css nothing shows; without intro.js the CSS still ends it. No storage |
| `site/assets/img/` | `petal-hero.*` (hero photo), `force-bluete/sturm/wurzel-{800,1400}.webp` (generated force images; the old `crop-*.webp` stay as spares), `petal-side-*.webp` (generated spare), `wordmark.svg`, `academy.svg`, `live.svg`, `symbol.svg`, `petal.svg` / `petal-pollen.svg`, `bloom-to-storm.svg`, `gust.svg`, `bloom-portrait.svg`, `og-image.jpg` |
| `site/assets/video/` | `storm.webm` / `storm.mp4`: the 7 s seamless hero loop (1280×720, silent). Generated with Higgsfield to the brand brief; regenerate the same way if it is ever replaced |
| `site/assets/brands/` | Portfolio logos (PNG, quantised) |
| `tools/check_site.py` | Pre-deploy check (stdlib only): translations, links, forms, and the prices (runs `tools/pricing.py --check`, footers carry Impressum, Datenschutz and the price note, no 500 € price anywhere) |
| `tools/pricing.py` + `tools/pricing_i18n.json` | Writes the price section, the hero offer link, `<meta name="bs-offer-until">`, the footer price note and every `prices.*` key in i18n.js from `site/data/pricing.json`. The JSON's German is used as it stands; EN/FR/ES/IT come from the table, keyed by the German text |
| `tools/make_zip.py` | Builds `dist/bluetensturm-netlify.zip` (the contents of `site/`) for drag-and-drop upload; refuses if check_site finds an error |
| `tools/serve.py` | Local server emulating Netlify: pretty URLs, `_redirects`, `_headers` incl. CSP, 404 |

## Motion layer rules

- The motion layer is additive: with `motion.css`, `storm.js` and `fx.js` removed from the pages (or failing to load), the site must look and behave exactly like the plain build. Keep it that way: no content, copy or layout may depend on the two scripts. The canvas, video and toggle stay in the markup; their inert base rules live in style.css ("Motion layer hooks"), never only in motion.css.
- Respect first: `prefers-reduced-motion: reduce` switches everything off; the hero toggle does the same for one page view and is never persisted (the privacy page lists only `bs-language`). Its accessible name is constant (`hero.motion`: Motion · Bewegung · Animation · Animación · Animazione) with `aria-pressed`; the visible state word (`hero.motion.on` / `hero.motion.off`) is `aria-hidden`. Coarse pointers get no tilt and no cursor light; the video is not requested below 760 px or with data saver on.
- Pollen rule still holds in motion: the storm's single yellow petal replaces the CSS `.drift--pollen` while `html.storm-on` is set; sheens and the cursor light are white.
- Budgets: both scripts together ≤ ~60 KB unminified, DPR capped at 1.5, no per-frame allocations, loops stop when nothing is visible, no storm on software WebGL. Test with `python3 tools/check_site.py` and in a browser at 1440 and 390 px (console must stay empty, no CSP violations). Headless test browsers render WebGL in software, so storm.js refuses to run there: to test the storm itself, serve a copy with `SOFTWARE_GL` set to `/(?!)/` and `failIfMajorPerformanceCaveat: false`.
- The CSP is unchanged: no inline styles (set custom properties from JS instead), no inline scripts, no external hosts. Video is covered by `default-src 'self'`.
- The opening must never trap the visitor: any intent skips it, it never locks scrolling, it never delays the hero image, and it must end through CSS alone if intro.js fails. Test it with a fresh navigation (Playwright `goto` from about:blank), and with reload, `/#contact` and reduced motion to see it skipped.

## Brand rules (Noir)

- Name: **BlütenSturm** (one word, capital S). In URLs and e-mail: `bluetensturm`. The legal entity name in the Impressum may differ — ask.
- Colours (CSS tokens): `--nacht #0A0A0A` ground · `--kohle #131312` panels · `--rauch #2C2B28` hairlines · `--asche #8F8C86` labels · `--nebel #C9C7C2` secondary text · `--weiss #F2F0EB` type · `--pollen #F5C31E` the one spark.
- **Pollen:** at most one yellow element per screen/section (the yellow petal inside the logo belongs to the logo). Never yellow body text, never the yellow petal on a light background. Hover and focus use pollen.
- Type: **Instrument Serif** for headlines and numbers — the second half of a headline in `<em>` (italic); **Montserrat** for text; labels and buttons in medium capitals with wide tracking (`.lbl`, `.btn`, `.tlink`, `.tag`).
- Voice: short, exact, a little poetic. Sentence case. Full stops for weight. No exclamation marks, no emoji. German and English never mixed in one sentence.
- Section labels: `01 — The agency` style. Headline sizes: `.h-xl` `.h-l` `.h-m` `.h-s`; long statements `.statement`; intro text `.lead`.
- The only light surface is the portfolio band (`.portfolio`). Breakpoints: 1360 (tighter nav) / 1240 / 1180 (nav → Menu sheet) / 1080 / 760. Test German and French in the 1181–1360 range: their nav labels are the longest.

## i18n contract

- English lives in the HTML. Mark elements with:
  - `data-i18n="key"` → replaces `textContent` (the element must not contain child elements)
  - `data-i18n-html="key"` → replaces `innerHTML` (for `<em>`, `<br>`, `<a>`); every translation must contain the same tags
  - `data-i18n-attr="placeholder:key;aria-label:key2"` → attributes (`placeholder`, `aria-label`, `alt`, `content`, `label`)
- `site/assets/js/i18n.js` = `window.BS_I18N = { "de": {…}, "en": {…}, "fr": {…}, "es": {…}, "it": {…} };` The object after `=` must stay **valid JSON**. The `en` block only holds `js.*` strings used by main.js.
- **Changing copy:** edit the English in the HTML, then the same key in all four languages. **New text:** new key, added to all four. Then `python3 tools/check_site.py`.
- Register: German formal *Sie*; French *vous* with French spacing (no-break space before `: ; ? !`); Spanish *usted*; Italian *voi* in body copy and the short imperative on buttons (*Invia*, *Richiedi*).
- Language choice is stored in `localStorage` key `bs-language` (named in the privacy policy). Not `bs-lang`: the previous site wrote `bs-lang=en` for every visitor. First visit follows the browser language, fallback English.
- Stats use `data-count` (and `data-format="percent"`) and are formatted per language with `Intl.NumberFormat`.
- `prices.*` keys are generated by `tools/pricing.py`: never edit them in i18n.js (check_site reports the drift). Change the JSON or `tools/pricing_i18n.json` and run the tool.

## Services and prices

- 18 services in `index.html` (in "What we do"), grouped under the three forces **Blüte** (brand & creative), **Sturm** (marketing & reach), **Wurzel** (people & leadership). Each is `<details class="svc" id="svc-<id>">`. Without JavaScript they are a plain list; where `<dialog>` is supported (`html.svc-dlg`) the list is hidden and the petal tiles, the five cards in 02 (`data-svc-open="<id>"`) and `/#svc-<id>` open the service in `#svc-dialog`: main.js moves the entry's name, tagline and body into the dialog and back on close, so translations and buttons keep working on the same nodes.
- The services carry **no prices**. Each body ends in `.svc__cta`: "Request this service" (`data-interest`, no package) and, where the price list covers it, "See prices" to its group or row (`#prices-websites`, `#prices-social`, `#prices-retail`, `#price-branding`, `#price-ads`, `#price-academy-30`). The five discipline cards in 02 open brand-strategy, digital-marketing, content-production, event-marketing-promotions and corporate-training, as on the live site.
- **Prices exist only in `site/data/pricing.json`** (the owner's list; German). `tools/pricing.py` renders them into `#prices` between `<!-- pricing:start -->` and `<!-- pricing:end -->`, the hero offer link between `<!-- pricing:pill:start/end -->`, and `<meta name="bs-offer-until">` before boot.js. Never edit those parts by hand and never add a price anywhere else; don't invent prices for services the list does not name. Netlify builds nothing: a JSON edit published without running the tool leaves the old prices on the page. The tool validates the JSON (types, unique ids, offer prices below the regular ones, `valid_until` = the last second of a day in Berlin time). Removing a whole group or row also needs the hand-written links to it edited ("See prices" in the services, Live and Academy, the menu sheet): check_site names every link that points nowhere. To change a price: edit the JSON, `python3 tools/pricing.py`, `python3 tools/check_site.py`. New German text → its EN/FR/ES/IT in `tools/pricing_i18n.json` (the tool names what is missing). Extra fields in the JSON (`features` of ads/events/academy/retail, `example`, `retail_promotion_note`) are the table texts of the same price file.
- Prices are numbers in `data-price` (ranges `data-price-range="2000-4000"`); main.js formats them per language with `Intl.NumberFormat` (€1,200 · 1.200 € · 1 200 €). The HTML text is the English fallback.
- **The offer** (`offer` in the JSON, now the Oktober-Aktion until `2026-10-31T23:59:59+01:00`): everything offer-only has `.offer-only` (banner `.offer`, hero `.offer-pill`, struck regular price `<s>` next to the offer price, the social first-month line, "nicht rabattiert" on website care); the regular-only price has `.offer-off`. CSS shows them only under `html.offer-on`, which boot.js sets before the first paint while `now < valid_until + 1 s`. main.js ends it at the deadline: a timer (at most a minute long, because timers stop while a laptop sleeps), on visibilitychange, pageshow and focus, and right before every request click and form submission, so a woken laptop never hands out the offer price. It also asks the server: `GET /data/pricing.json` (`cache: no-store`; at load, on wake, on request clicks and before a submission, at most once a minute by either clock, abandoned after 5 s). The response's `Date` sets how far the device clock is behind (`behind`, never negative), so the deadline is then measured in server time even on a page left open; the live JSON's `valid_until` can only end the offer sooner. A submission waits for that check at most 1.5 s. Nothing can extend the offer. `/data/*` is `noindex` (`_headers`). Without JavaScript: regular prices only. After the offer, remove `offer` from the JSON and rerun the tool (check_site warns once it has expired). Legally the offer must end on time (UWG § 5): keep this mechanism.
- The pricing section's one pollen element is the banner's petal; the hero link is white (the hero's spark is the storm petal).
- Request buttons in the price list: `data-package` = the **German** package and price written into the form's hidden `Package` field (`Website Business — 2.400 €`), `data-package-offer` = the same while the offer is on (`Website Business — Oktober-Aktion: 1.200 € statt 2.400 €`). Live, Academy and the full package keep their English `data-package`. `data-interest` = value selected in "Interested in"; it must equal an `<option value>` in the contact form (mapping in `INTEREST` in tools/pricing.py).
- "Alle Preise sind Endpreise." (`vat_note`, key `prices.vat`) stands under the price heading, in the service list/dialog foot and in the footer of every page (`data-vat-de` on the German-only legal pages). No VAT is charged at the moment: never write "zzgl. MwSt." or "net".

## Forms

- Both forms post to **Formspree** `https://formspree.io/f/mvkpynzr` → info@bluetensturm.com. Hidden fields: `_subject` (German subject line for the team), `Form`, `Language` (set by JS), `Package` (contact form), honeypot `_gotcha`. The reply-to field is named `email` (lowercase).
- Request buttons set the hidden `Package` field and the "Interested in" select, and the box "You're asking about" names the card and its price in the visitor's language; a later manual change of the select clears the package, so an enquiry never contradicts itself. If the offer ends while the form is open, the package text switches to the regular price.
- Hidden `_next` = `https://bluetensturm.com/thank-you` (as on the live site): Formspree's redirect for visitors without JavaScript.
- Portfolio logos are buttons (`data-brand`) that open `#brand-dialog`: logo, name, category, markets, the shared summary and work list (keys `portfolio.*`).
- `main.js` sends with `fetch` (`FormData`, `Accept: application/json`). Success → `/thank-you` (and a `dataLayer` event; the button stays in its sending state until that page loads, and if the visitor stops the navigation the form shows `js.sent` after 6 s); failure → a button that opens the visitor's mail app with all answers. Without JavaScript the browser posts directly to Formspree.
- Option **values stay English** in every language; only the labels are translated.
- Changing the endpoint means: both forms + CSP (`connect-src`, `form-action` in `_headers`) + the Datenschutz text.
- Conversion tracking is prepared but off (`ADS_SEND_TO` in main.js). Turning it on needs a consent banner, the Google tag, CSP changes and a privacy-policy update — ask the owner first.

## Check, preview, deploy

```
python3 tools/pricing.py         # after any change to site/data/pricing.json
python3 tools/check_site.py      # 0 errors required
python3 tools/make_zip.py        # dist/bluetensturm-netlify.zip for drag-and-drop
python3 tools/serve.py 8080      # http://localhost:8080 with Netlify-like routing and headers
netlify deploy --dir=site        # draft URL for review
netlify deploy --prod --dir=site # production, only after the owner's OK
```

Deploy previews: the Netlify Drawer (feedback toolbar) injected into previews can log CSP errors. That is expected; never loosen the production CSP for it (it can be switched off under Project configuration → Collaboration tools). Netlify's "Base directory" setting must be empty so `netlify.toml` at the repository root is used.

Test at 1440 px and 390 px, in EN and DE at least: menu sheet (≤1180 px), a service dialog, a price request button (form prefill), the offer with the clock before and after `valid_until` (Playwright `page.clock.install`), the questionnaire, the 404 page, and the browser console (CSP violations show up there). After a production deploy: `curl -I` the pages and a few old URLs from `_redirects` (expect 301), confirm the CSP header, and have the owner send one real test enquiry.

## Open items for the owner (also in README.md)

- Impressum / Datenschutz placeholders (company name as registered, phone, managing director, register, VAT ID, Formspree transfer basis). The address is filled with Kirchstraße 8, 97209 Veitshöchheim from the owner's price list: the owner should confirm it is also the Impressum address.
- The four stats, the four anonymised case studies, the "Presence" cities. Prices: done (the owner's list of 17.10.2026); Kleinunternehmer limit to be checked with the Steuerberater (owner's note).
- Consent of named clients (Café Mozart Würzburg, Restaurant Hole 19, Linie 14, Pizza Marco Würzburg, ShiftCircle); the 44 portfolio logos; Dijan's bio (add `<p class="person__bio" data-i18n="people.dijan.bio">…</p>` under his role, plus the key in all four languages); whether BlütenSturm Live stays.
- `TODO(owner)` comments in the HTML mark each spot.

## Ideas, not started

- German-first SEO: search engines index the English HTML. For strong German rankings, pre-rendered `/de/` pages with `hreflang` would be the next step — a structural change, so ask first.
- Portraits of Nezir and Dijan in the Noir style (black ground, side light), case-study pages with real images once clients agree.
