# bluetensturm.com — BlütenSturm Noir

The new website for BlütenSturm, built in the Noir brand (black and white, one pollen-yellow spark per surface) with all the content from the current bluetensturm.com. Plain HTML, CSS and JavaScript: no framework, no build step, nothing to install. Ready for Netlify.

**Real brands. Real people.**

---

## What is in this folder

```
bluetensturm-website/
├── netlify.toml                 Netlify settings: publish the site/ folder, no build
├── README.md                    this file (for people)
├── CLAUDE.md                    project memory for Claude Code (rules, structure, how-tos)
├── PROMPT-FOR-CLAUDE-CODE.md    the prompt to paste into Claude Code to deploy
├── tools/
│   ├── check_site.py            pre-deploy check: translations, links, files
│   └── serve.py                 local preview that behaves like Netlify
└── site/                        ← this is the website
    ├── index.html               home: hero, agency, services (18, with packages),
    │                            full package, work, portfolio (44 brands), Live,
    │                            Academy, why us, people, contact form
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
        ├── js/boot.js           picks the language before the page paints
        ├── js/i18n.js           DE · FR · ES · IT translations (English is in the HTML)
        ├── js/main.js           language switch, menu, motion, forms
        ├── fonts/               Instrument Serif + Montserrat, self-hosted (OFL licences included)
        ├── img/                 petal photo, crops, logos, brand graphics, social image
        └── brands/              the 44 portfolio logos
```

## Languages

Every page except Impressum and Datenschutz is in **DE · EN · FR · ES · IT**. A visitor sees the language of their browser (German browser → German), can switch in the header, and the choice is remembered. English is the text inside the HTML; the other four languages live in `site/assets/js/i18n.js`.

## Forms

The contact form (home page) and the questionnaire send to Formspree (`https://formspree.io/f/mvkpynzr`, the same endpoint as today), which forwards to **info@bluetensturm.com**. On success the visitor lands on `/thank-you`. If Formspree can't be reached, the visitor gets a button that opens their own e-mail app with everything they typed, so no enquiry is lost. Every package button ("Request Premium" etc.) pre-fills the form with the exact package.

## Deploy

The site already runs on Netlify with the domain at STRATO. **Nothing changes in DNS or e-mail**: the domain stays pointed at Netlify, the STRATO mailbox (MX records) stays exactly as it is.

Pick one way:

1. **With Claude Code (recommended).** Open this folder in Claude Code and paste the prompt from `PROMPT-FOR-CLAUDE-CODE.md`. It checks everything, puts the site into your GitHub repository on a new branch, shows you a preview link, and only publishes after you say so.
2. **Netlify CLI.** In this folder: `netlify login`, `netlify link` (choose the existing bluetensturm.com site), then `netlify deploy --dir=site` for a preview link and `netlify deploy --prod --dir=site` to publish.
3. **Drag and drop.** Netlify → your site → Deploys → drag the **`site` folder** (not the whole project folder) onto the page. Headers and redirects come along because they live inside `site/`.

If the Netlify site is connected to a Git repository, use 1 or 2 with Git: push this project to the repository and Netlify publishes `site/` automatically thanks to `netlify.toml`.

## Preview on your computer

```
python3 tools/serve.py          # then open http://localhost:8080
python3 tools/check_site.py     # must end with "0 errors" before every deploy
```

`serve.py` mimics Netlify's routing, redirects and security headers, so most problems show up locally before they reach the live site.

## Before it goes live: please check these

Things only you can confirm. Placeholders on the legal pages are shown in **yellow** on purpose, so nothing slips through.

**Legal (required in Germany)**
- [ ] **Impressum**: company name as registered (the old site said "Blüten Sturm GmbH"; the brand is "BlütenSturm"), street, postcode, phone, managing director, commercial register number, VAT ID, person responsible for content. File: `site/impressum.html`.
- [ ] **Datenschutz**: the same company details, and the legal basis Formspree gives for sending form data to the USA (look it up in Formspree's data processing agreement). File: `site/datenschutz.html`.
- The old Impressum linked to the EU online dispute platform. That platform closed on 20 July 2025 and the link must no longer appear, so it has been removed.

**Content carried over from the old site that was written as placeholder text**
- [ ] **Prices.** The 18 services show "from" prices and two packages each, exactly as on the current site (e.g. Social media management from 1.900 €/month, Website from 8.500 €). The old site's code itself called these "positioning numbers, not a rate card", and they are not the same as your internal price list. Decide which prices to show (or show none). Because the prices are net (plus VAT), the note under the list now also says the offers are for businesses only; German price rules require gross prices for consumers. Keep that sentence unless you switch to gross prices.
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

Ask Claude Code in plain words ("change the Social media price to 1.200 €", "add a sentence about Dijan", "remove the case studies"). `CLAUDE.md` tells it where everything is and which rules to keep: brand, five languages, privacy, security headers.

## Tracking (off on purpose)

The site sets **no cookies** and runs **no analytics**, which is why there is no cookie banner. If you later want Google Ads conversions or Analytics, you need a consent banner first, and the privacy policy and the security headers must be updated. A conversion hook on `/thank-you` is already prepared in `site/assets/js/main.js` (`ADS_SEND_TO`), switched off.

## Old addresses

Links to the old site's pages keep working: `/questionnaire.dc`, `/Thank You.dc.html`, `/Bluten Sturm v2.dc.html` and their variants redirect permanently (301) to the new pages. The old `#training` link on the home page still jumps to the Academy.

---

Nezir Shinik & Dijan Cika
