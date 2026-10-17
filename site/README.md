# Blüten Sturm — bluetensturm.com (Lime Bloom)

The live bluetensturm.com, rebuilt one to one in the **01 Lime Bloom** brand
direction: the same pages, sections, numbering, copy, 18 service panels, 44
partner panels, forms and field names as the live site, in five languages,
with a new opening sequence and a 3D hero. Prices and offers follow the price
sheet of 17.10.2026 (`data/pricing.json`, see "Prices and offers" below).

No build step. Everything in this folder is the finished site.

## Deploy on Netlify

**Drag and drop:** open <https://app.netlify.com/drop> and drop this `site`
folder (or the zip). `netlify.toml` inside it sets the headers, caching and
redirects.

**From Git:** connect the repository. The root `netlify.toml` sets
`base = "site"`, so Netlify publishes this folder with no build command.

After the first deploy:

1. **Domain:** add `bluetensturm.com` under *Domain management* and let Netlify
   issue the certificate.
2. **Forms:** every enquiry is sent to Formspree
   (`https://formspree.io/f/mvkpynzr`), the same endpoint the live site uses,
   which mails `info@bluetensturm.com`. Nothing changes in how leads arrive.
   Netlify also keeps a copy once form detection is on: *Site configuration →
   Forms → Enable form detection*, then redeploy. Both forms (`contact`,
   `questionnaire`) then appear under *Forms*. Add an e-mail notification under
   *Forms → Settings*. Visitors without JavaScript post straight to Netlify.
3. **Legal:** fill the remaining `TODO` fields in `impressum/index.html`
   (managing director, phone, register, VAT ID, person responsible for
   content). They are the same blanks the live site shows today. The address
   (Kirchstraße 8, 97209 Veitshöchheim) comes from the price sheet and is
   already filled in on both legal pages.
4. **Conversion tracking (optional):** the thank-you page already pushes
   `enquiry_submitted` to `window.dataLayer` and fires the Google Ads conversion
   once `gtag` is on the page. Replace `AW-XXXXXXXXX/YYYYYYYY` in `js/site.js`
   with the real label, and switch `netlify.toml` to the commented
   Content-Security-Policy line that allows Google's hosts (the current one
   blocks them). Before adding any tracking, extend the privacy policy and add
   a consent banner.

## Every old address keeps working

`netlify.toml` 301-redirects the live site's addresses to the new pages:
`/questionnaire.dc` and `/Questionnaire.dc.html` go to `/questionnaire/`;
`/Thank You.dc.html` goes to `/thank-you/`; `/Impressum.html` and
`/Datenschutz.html` go to the legal pages; `/bluten sturm v2.dc.html` and
`/index.html` go to `/`. `/impressum` and `/datenschutz` are served as is.

## Structure

```
index.html            home: opening, hero runway (18 service petals), 01–07
questionnaire/        project questionnaire (same 17 fields as the live site)
thank-you/            form redirect target, conversion hook
impressum/ datenschutz/  legal pages (German, as on the live site)
404.html              not-found page (Netlify serves it automatically)
css/site.css          the Lime Bloom design system
css/fonts.css         self-hosted Unbounded + Manrope (no Google Fonts request)
js/site.js            behaviour: i18n, opening, runway, panels, forms, reveals
js/hero3d.js          the 3D B (Three.js, ES modules, loaded after the opening)
js/data.js            service ids, partner categories
js/pricing.js         renders the price list, panel prices and offer texts
data/pricing.json     every price, package and offer (the single source)
js/form-send.js       Formspree + Netlify Forms delivery, mailto fallback
i18n/*.json           en (the live site's default and source), de, fr, es, it
media/services/       18 Higgsfield service visuals (WebP, 640 and 1280 px)
media/gen/            Higgsfield renders, case imagery, the petal-storm loop
media/brands/         44 partner logos + manifest.json
assets/               monogram SVGs, favicons, app icons
vendor/three/         Three.js r180 (module build + the two addons used)
```

## Languages

English is the default, as on the live site. The visitor's choice is
remembered under the same key the live site used (`bs-lang`), and `?lang=de`
(or `fr`, `es`, `it`) in a link opens the site in that language. Every
translation the live site already had is kept word for word. Everything it
left in English (service details, packages, partner texts, questionnaire,
thank-you page, form labels) is now translated as well. The Impressum and
Datenschutz stay German, as on the live site.

## Editing content

* **Copy:** edit `i18n/en.json` and mirror the change in the other four
  files. The English text in the HTML is the no-JavaScript fallback; keep it in
  sync. `data-i18n="key"` on each element names the dictionary key.
* **Services:** the 18 services live in `js/data.js` (order) and in
  `i18n/<lang>.json → svc.<id>` (name, tagline, scope). The petals in the hero
  and the five cards in section 02 are plain HTML in `index.html`.
* **Prices:** only in `data/pricing.json`; see below.
* **Partners:** add a row to `media/brands/manifest.json`, drop the PNG in
  `media/brands/` and add a matching tile in `index.html` under
  `data-brands` (the `data-brand` number is the row's position). As on the
  live site, all partners share one description, list of work and market
  line; those live in `i18n/<lang>.json → brands`, so they are translated.
* **Case studies:** the four cards in `index.html` under `#work`. Images
  sit in `media/gen/` as JPEG + WebP in two sizes.

## Prices and offers

`data/pricing.json` holds every price on the site, taken unchanged from the
price sheet "Preise & Angebote (Stand: 17.10.2026)". The page reads it and
renders the price list under section 02 ("Preise & Angebote", linked as
"Preise" in the navigation), the price lines on the five service cards and the
prices inside the service panels. Services the sheet does not price show
"Preis auf Anfrage" with a request button. No price is written anywhere else.

* **German texts** come straight from the JSON. The other languages use
  `i18n/<lang>.json → pricing` (labels and translated package names);
  anything missing there falls back to the German text.
* **Fields added to the sheet's JSON** (all taken from the sheet's tables,
  none of them a price): `reference` on Website Premium
  ("restauranthole19.de"), `offer_note` on Website-Pflege ("nicht
  rabattiert"), a `description` on the other services and the in-store
  packages, and `retail_promotion_note`. Every value from the sheet is
  unchanged.
* **The October offer** (`offer`) runs until `offer.valid_until`
  (2026-10-31T23:59:59+01:00, i.e. 31.10.2026 23:59 in Berlin). While it runs,
  the regular price is shown struck through next to the offer price, the
  offer terms sit above the list and a small "Oktober-Aktion" pill floats at
  the bottom left (visitors can close it for the session). From
  01.11.2026 00:00 everything disappears on its own: the page compares the
  deadline with the later of the device clock and the server clock (the
  `Date` header of `pricing.json`, so a device set to the wrong date cannot
  keep the offer alive). A page left open switches at the deadline itself,
  and a wall-clock check every 15 seconds also catches a device that slept
  through it and moves the "noch N Tage" countdown on at midnight.
  `/data/*` is served with `must-revalidate`, so a change reaches every visitor
  at once.
* **Changing a price or the next offer:** edit `data/pricing.json` (keep the
  ids; set a new `offer` with its own `valid_until`, or remove `offer` to show
  regular prices only), then run `node tools/render-pricing.mjs` from the
  repository root. It rewrites the no-JavaScript copy of the price list in
  `index.html` (regular prices only, so it can never advertise an offer that
  has ended) and a copy of the JSON without the offer embedded there, which
  the page draws in the visitor's language until `/data/pricing.json` arrives,
  or instead of it if the file cannot be loaded. Both fallbacks show regular
  prices only, so the offer is never shown without the live file.
* **Footer note:** "Alle Preise sind Endpreise." (`vat_note`) sits under the
  price list, under every panel's prices and in the footer.

## Motion and accessibility

* **Opening:** three petals fly in and lock into the B, a counter runs to
  100, then the view falls through the letter into the page. It plays once per
  browser session. It is skipped for deep links (e.g. `/#contact`), for
  visitors who prefer reduced motion, and on a click, Enter, Space or Escape.
  `?intro=1` forces it, `?intro=0` skips it.
* **Hero runway:** the hero pins while the B blooms apart and its petals become
  the 18 service buttons ("Eighteen ways we move a brand"). Reduced motion,
  short screens and no JavaScript get the same buttons as a plain list ("What
  we do"). The 3D letter needs WebGL and is skipped on Save-Data.
  `?motion=reduced` and `?motion=full` force either path.
* **Petal loop:** the contact section's loop (Higgsfield / Seedance) loads
  only near the section, never with reduced motion. It plays as H.264 or as
  VP9 WebM, whichever the browser supports.
* **Panels:** they use the native `<dialog>` (focus trap, Escape, backdrop
  click). Keyboard access, screen reader labels and visible focus are in place
  throughout.

## Local preview

Any static server works, e.g. `npx http-server site -p 8787` from the repository
root, then open <http://127.0.0.1:8787/>. Opening `index.html` straight from
the file system shows the layout only: the browser blocks the dictionaries and
the 3D module on `file://`.
