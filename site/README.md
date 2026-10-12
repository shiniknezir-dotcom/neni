# BlütenSturm — bluetensturm.com (Lime Bloom)

Static website for the Würzburg creative agency, rebuilt in the **01 Lime Bloom**
brand direction: electric lime grounds, deep forest instead of black, Unbounded
display type, Manrope text, petal corners, and the B monogram grown from three
petals — rendered live in 3D on the first screen.

No build step. Everything in this folder is the finished site.

## Deploy on Netlify

**Drag and drop** — open <https://app.netlify.com/drop> and drop this `site`
folder. Done: `netlify.toml` inside it sets the headers, redirects and the
publish directory.

**From Git** — connect the repository; the root `netlify.toml` sets
`base = "site"` so Netlify publishes this folder with no build command.

After the first deploy:

1. **Domain** — add `bluetensturm.com` under *Domain management* and let
   Netlify issue the certificate.
2. **Forms** — both forms (`kontakt`, `fragebogen`) are registered as Netlify
   Forms automatically. Under *Forms → Settings → Form notifications* add an
   e-mail notification to `info@bluetensturm.com`. Every submission is also
   sent through Formspree (`https://formspree.io/f/mvkpynzr`), the existing
   mailbox route, so nothing changes in how leads arrive today. If you ever want
   Formspree gone, remove the `FORMSPREE` constant in `js/data.js` and the
   Formspree hosts from the `Content-Security-Policy` line in `netlify.toml`.
3. **Legal** — fill the `TODO` fields in `impressum/index.html` and
   `datenschutz/index.html` (address, managing director, register, VAT id, date).

## Structure

```
index.html            home (German in the markup; other languages switch live)
fragebogen/           project questionnaire
danke/                thank-you page (form redirect target, conversion hook)
impressum/ datenschutz/  legal pages
404.html              not-found page (Netlify serves it automatically)
css/site.css          the Lime Bloom design system
css/fonts.css         self-hosted Unbounded + Manrope (no Google Fonts request)
js/site.js            behaviour: i18n, services directory, panels, forms, reveals
js/hero3d.js          the 3D hero (Three.js, ES modules, lazy-loaded)
js/data.js            ids, prices, icons — everything language-independent
js/form-send.js       Formspree + Netlify Forms delivery with mailto fallback
i18n/*.json           de (source of truth), en, fr, es, it
media/gen/            Higgsfield-generated renders, case imagery, petal loop
media/brands/         44 partner logos + manifest.json
assets/               monogram SVGs, favicons, app icons
vendor/three/         Three.js r180 (module build + the two addons used)
```

## Editing content

* **Copy** — edit `i18n/de.json` and mirror the change in the other four files.
  The German text in `index.html` is the no-JavaScript fallback; keep it in sync
  (`data-i18n="key"` on each element names the dictionary key).
* **Services and prices** — the 18 services live in `js/data.js` (prices,
  units, icons, order) and `i18n/<lang>.json → svc.<id>` (names, scope,
  package items). Add a service in both places and it appears in the directory
  and the panel.
* **Partners** — add a row to `media/brands/manifest.json` and drop the PNG in
  `media/brands/`; the grid, the filter and the partner panel update themselves.
* **Case studies** — the four cards in `index.html` under `#work`. Images sit in
  `media/gen/` as JPEG + WebP in two sizes.

## Motion and accessibility

* The 3D hero loads only where WebGL exists, the visitor has not asked for
  reduced motion and the connection is not on Save-Data. Otherwise the exact
  static monogram stays. `?motion=reduced` / `?motion=full` on the URL force
  either path for testing.
* The contact section's petal loop (Higgsfield / Seedance) is fetched only when
  the section comes near, never with reduced motion, 540p below 1100 px wide.
* Panels use the native `<dialog>` (focus trap, Escape, backdrop click).
  Keyboard, screen reader labels and visible focus are in place throughout.

## Local preview

Any static server works, e.g. `npx http-server site -p 8787` from the repository
root, then open <http://127.0.0.1:8787/>. Opening `index.html` from the file
system works for layout but not for the dictionaries, the partner grid or the
3D module (browsers block `fetch` and module imports on `file://`).
