# bluetensturm.com — BlütenSturm Noir

The new website for BlütenSturm, built in the Noir brand (black and white, one pollen-yellow spark per surface) with all the content and the section order of the current bluetensturm.com, in all five languages: the hero, the eighteen services (each opens its detail), the five disciplines, the prices and the October offer (from your price list of 17.10.2026), why us, the work, the 44 brands (each opens its detail), the academy, the contact form and the questionnaire. Plain HTML, CSS and JavaScript: no framework, no build step, nothing to install. Ready for Netlify.

**Real brands. Real people.**

---

## What is in this folder

```
(repository root)
├── netlify.toml                 Netlify settings: publish the site/ folder, no build
├── README.md                    this file (for people)
├── CLAUDE.md                    project memory for Claude Code (rules, structure, how-tos)
├── HIGGSFIELD-SKILLS.md         the Higgsfield skills pack that also lives in this repository
├── tools/
│   ├── check_site.py            pre-deploy check: translations, links, files, prices
│   ├── pricing.py               writes the price section from site/data/pricing.json
│   ├── pricing_i18n.json        the price list's EN · FR · ES · IT translations
│   ├── make_zip.py              builds dist/bluetensturm-netlify.zip for drag-and-drop upload
│   └── serve.py                 local preview that behaves like Netlify
└── site/                        ← this is the website
    ├── index.html               home: hero, services (18), agency, five disciplines,
    │                            prices & offers, full package, work, portfolio
    │                            (44 brands), Live, Academy, people, contact form
    ├── data/pricing.json        your price list: the one place prices are kept
    ├── questionnaire.html       the full project questionnaire  → /questionnaire
    ├── thank-you.html           after a form is sent            → /thank-you
    ├── impressum.html           legal notice (German)           → /impressum
    ├── datenschutz.html         privacy policy (German)         → /datenschutz
    ├── 404.html                 "Blown away." page for wrong links
    ├── _headers                 security headers (CSP) and caching
    ├── _redirects               old URLs of the previous site → new pages (301)
    ├── robots.txt, sitemap.xml, site.webmanifest, favicons
    └── assets/
        ├── css/style.css        all styles, brand tokens at the top
        ├── css/motion.css       the motion layer: hero canvas, video, tilt, word reveals, scroll choreography
        ├── js/boot.js           picks the language before the page paints
        ├── js/i18n.js           DE · FR · ES · IT translations (English is in the HTML)
        ├── js/main.js           language switch, menu, reveals, forms
        ├── js/fx.js             the motion layer (3D tilt, word reveals, cursor light, video, motion toggle)
        ├── js/storm.js          the 3D petal storm in the hero (WebGL2, no library)
        ├── fonts/               Instrument Serif + Montserrat, self-hosted (OFL licences included)
        ├── img/                 petal photo, generated force images, logos, brand graphics, social image
        ├── video/               the hero loop (storm.webm, storm.mp4)
        └── brands/              the 44 portfolio logos
```

## Languages

Every page except Impressum and Datenschutz is in **DE · EN · FR · ES · IT**. A visitor sees the language of their browser (German browser → German), can switch in the header, and the choice is remembered. English is the text inside the HTML; the other four languages live in `site/assets/js/i18n.js`.

## Forms

The contact form (home page) and the questionnaire send to Formspree (`https://formspree.io/f/mvkpynzr`, the same endpoint as today), which forwards to **info@bluetensturm.com**. On success the visitor lands on `/thank-you`. If Formspree can't be reached, the visitor gets a button that opens their own e-mail app with everything they typed, so no enquiry is lost. Every "Request" button in the price list pre-fills the form with the exact package and price in German (during the October offer: the offer price and the regular one, e.g. "Website Business — Oktober-Aktion: 1.200 € statt 2.400 €"), so you see which price the visitor saw.

## Prices and the October offer

All prices come from **`site/data/pricing.json`**, your price list of 17.10.2026, saved exactly as you sent it (the table texts the JSON did not carry, such as the features of the Academy and the in-store promotions, were added from the same file; no other prices exist on the site). The home page shows them in the section **Preise & Angebote**, in all five languages; the German is word for word yours. "Alle Preise sind Endpreise." stands under the prices and in the footer of every page.

The **Oktober-Aktion** (banner in the price section, a link under the hero buttons, the regular price struck through next to the October price) shows only until **31.10.2026, 23:59:59** (Berlin time; on the server's clock it can end up to a second early, never late) and disappears by itself from 1 November 00:00, also on a page that is open at midnight, and also when a visitor's own clock is behind (the site checks the server's clock when the page opens, when the visitor comes back to it and before a form is sent, and from then on counts in server time). Without JavaScript only the regular prices show.

To change a price: edit `site/data/pricing.json`, then run `python3 tools/pricing.py` (it rewrites the price section and the translations) and `python3 tools/check_site.py`. **Editing the JSON alone does not change the prices on the page** (it can only end the offer early): Netlify builds nothing, so a JSON edited (for example in GitHub's web editor) and published without running the tool leaves the old prices on the page. Ask Claude Code to change prices, or run the tool yourself before you publish. A new or changed German text needs its translations in `tools/pricing_i18n.json`; the tool tells you which. When the offer ends, delete the `"offer"` block from the JSON, run the tool again and publish, ideally right at midnight on 1 November: until then the offer is hidden, but still in the page source, and a visitor whose own clock is behind can see it for a moment before the page has checked the server's clock. The check reminds you once the date has passed.

## Deploy

The site already runs on Netlify with the domain at STRATO. **Nothing changes in DNS or e-mail**: the domain stays pointed at Netlify, the STRATO mailbox (MX records) stays exactly as it is.

Pick one way:

1. **From this repository (recommended).** In Netlify: Add new project → Import an existing project → GitHub → this repository. Leave the **Base directory** empty, the build command and the publish directory come from `netlify.toml` (publish `site`, no build). Every push to the production branch then publishes the site; every other branch gets a deploy preview with its own link. If the existing bluetensturm.com site is not linked to Git yet, link it under Project configuration → Build & deploy → Continuous deployment, so the domain and the DNS stay exactly as they are.
2. **Netlify CLI.** At the repository root: `netlify login`, `netlify link` (choose the existing bluetensturm.com site), then `netlify deploy --dir=site` for a preview link and `netlify deploy --prod --dir=site` to publish.
3. **Drag and drop.** Netlify → your site → Deploys → drag the **`site` folder** (not the whole repository) onto the page. Headers and redirects come along because they live inside `site/`. Or upload the ready zip, **`dist/bluetensturm-netlify.zip`** (the contents of `site/`, rebuilt with `python3 tools/make_zip.py`, which refuses to build if the check finds an error).

Publish to production only after you have looked at a preview. The previous site stays reachable through its old URLs (see "Old addresses").

## Motion and 3D

The home page opens like a creative agency should: on a first visit the pollen-yellow petal falls into the dark, the five-petal flower opens, a gust bursts it into the storm, the BlütenSturm wordmark forms and the stage splits to reveal the site (about 2.4 seconds). Any click, key, scroll or touch skips it, and it is not shown again on reload, when coming back from another page of the site, or to visitors who prefer reduced motion (`site/assets/css/intro.css`, `site/assets/js/intro.js`).


The hero is a live 3D petal storm: hundreds of curved, side-lit petals rendered in WebGL (`site/assets/js/storm.js`, written by hand, no library, about 26 KB), blown by a wind field with a slow vortex. Moving the mouse pushes the petals away, scrolling makes the storm surge, and exactly one petal is pollen yellow. Behind it plays a short generated loop of drifting petals (`site/assets/video/`), and the petal photo stays in the centre. Further down, cards tilt in 3D under the pointer with a white light sheen, headlines rise word by word, the five-petal flower turns slowly, the portfolio logos float in, and a soft light follows the cursor over the dark sections (`site/assets/js/fx.js`, `site/assets/css/motion.css`).

Everything is optional and polite: it switches off for visitors who have asked their system for reduced motion, there is a **Motion on / Motion off** switch in the hero (in all five languages, not stored anywhere), touch screens get no pointer effects, the video is not even requested on phones, and all animation pauses when it is off screen or the tab is hidden. The storm starts only after the page has loaded, never runs on computers without a usable graphics chip (there the three drawn petals of the original design stay), and draws fewer petals if a device struggles. Without JavaScript the pages are complete, static and English. The Content-Security-Policy stays as strict as before: every script, style, image and video is served from bluetensturm.com itself.

The generated visuals (the hero loop and the three "force" images under Blüte, Sturm and Wurzel) were made with Higgsfield to the brand brief: black ground, one hard side light, white petals, one pollen-yellow petal. They are brand abstractions, not photographs of people or clients. If you would rather keep the original crops, the old files are still in `site/assets/img/` (`crop-head.webp`, `crop-edge.webp`, `crop-fibers.webp`).

To switch the whole motion layer off for good, remove the three lines in `site/index.html` that load `motion.css`, `storm.js` and `fx.js` (and the `motion.css`/`fx.js` lines on the other pages); the site then looks and behaves exactly like the original build. The same holds if one of those files ever fails to load.

## Preview on your computer

```
python3 tools/serve.py          # then open http://localhost:8080
python3 tools/check_site.py     # must end with "0 errors" before every deploy
```

`serve.py` mimics Netlify's routing, redirects and security headers, so most problems show up locally before they reach the live site.

## Before it goes live: please check these

Things only you can confirm. Placeholders on the legal pages are shown in **yellow** on purpose, so nothing slips through.

**Legal (required in Germany)**
- [ ] **Impressum**: company name as registered (the old site said "Blüten Sturm GmbH"; the brand is "BlütenSturm"), phone, managing director, commercial register number, VAT ID, person responsible for content. The address is now **Kirchstraße 8, 97209 Veitshöchheim**, taken from your price list: confirm it is also the address for the Impressum. File: `site/impressum.html`.
- [ ] **VAT**: the prices are final prices without VAT, as your price list says. If you use the small-business rule (§ 19 UStG), the Impressum's VAT-ID line may not apply; and check the Kleinunternehmer limit with your Steuerberater before these totals run into 2027, as your list notes.
- [ ] **Datenschutz**: the same company details (the address is filled in), and the legal basis Formspree gives for sending form data to the USA (look it up in Formspree's data processing agreement). File: `site/datenschutz.html`.
- The old Impressum linked to the EU online dispute platform. That platform closed on 20 July 2025 and the link must no longer appear, so it has been removed.

**Content carried over from the old site that was written as placeholder text**
- Prices: done. The old "from" prices and the Normal/Premium packages of the 18 services are gone; only your price list of 17.10.2026 is shown. The old 500 € website price appears nowhere (the check refuses it). Instagram highlights, bio and the sales agent skill are outside this website: update them yourself.
- [ ] **The four numbers** under "Franconian roots": 120 projects, 9 markets, 2,400 leaders trained, 94 % client retention.
- [ ] **The four anonymised case studies** (manufacturer rebrand, DACH launch, 400-manager programme, Würzburg summit). Keep them only if they are real; otherwise delete that block.
- [ ] **"Presence: Würzburg · Berlin · Zürich · Wien · Milano"** under the facts.

**New content from the brand package**
- [ ] **Client names** in "Recent storms": Café Mozart Würzburg, Restaurant Hole 19, Linie 14, Pizza Marco Würzburg, ShiftCircle. Ask each client if they are happy to be named.
- [ ] **The 44 brand logos** (FMCG brands from the Balkan distribution work) are the same as on the current site; make sure you are allowed to show them.
- [ ] **People**: Nezir's bio is written from your profile; **Dijan has no bio yet** (one sentence is enough).
- [ ] **BlütenSturm Live** (in-store games, "Book a demo day"): remove the section if you are not offering it yet.

**After publishing**
- [ ] Send one test enquiry from the live site and check that it arrives at info@bluetensturm.com. If you see the "couldn't reach the mail service" message instead, look in Formspree at the form's settings: spam protection (Formspree's own reCAPTCHA page can't appear in a JavaScript submission) and "Restrict to domain" (must allow bluetensturm.com).
- [ ] Google Search Console: add the site as a URL-prefix property verified with an HTML file or meta tag (no DNS change at STRATO needed) and submit `https://bluetensturm.com/sitemap.xml`.
- Optional: www.bluetensturm.com is answered by STRATO and forwards with a temporary (302) redirect. Changing it to permanent (301) in STRATO is slightly better for Google.

## Changing things later

Ask Claude Code in plain words ("change the Website Business price to 2.600 €", "add a sentence about Dijan", "remove the case studies"). `CLAUDE.md` tells it where everything is and which rules to keep: brand, five languages, privacy, security headers.

## Tracking (off on purpose)

The site sets **no cookies** and runs **no analytics**, which is why there is no cookie banner. If you later want Google Ads conversions or Analytics, you need a consent banner first, and the privacy policy and the security headers must be updated. A conversion hook on `/thank-you` is already prepared in `site/assets/js/main.js` (`ADS_SEND_TO`), switched off.

## Old addresses

Links to the old site's pages keep working: `/questionnaire.dc`, `/Thank You.dc.html`, `/Bluten Sturm v2.dc.html` and their variants redirect permanently (301) to the new pages. The old `#training` link on the home page still jumps to the Academy.

---

Nezir Shinik & Dijan Cika
