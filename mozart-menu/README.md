# Mozart café · bistro · bar — QR-Speisekarte / QR menu

Digital, bilingual (Deutsch / English) menu for Mozart, Theaterstr. 21, Würzburg, plus the QR code that opens it.
Static site, no build step, no server: one HTML page, one stylesheet, one script and one data file.

```
mozart-menu/
├── index.html          the menu page (loads menu-data.js)
├── style.css           design (brand plum / cream / gold, Caveat + Nunito via Google Fonts)
├── app.js              rendering, DE/EN switch, Essen/Getränke tabs, allergen legend
├── menu-data.js        THE MENU — every text has a "de" and an "en" value
├── data/menu.json      same data as plain JSON (source for build-data.py)
├── assets/             logo (transparent PNGs), icons, social preview image
├── qr/                 QR codes (PNG, SVG, PDF) + printable A6 table card and 60 mm sticker
├── qr-card.html        the printable card (open in a browser, print at 100 %)
├── make-qr.py          regenerates all QR files for a given URL
└── build-data.py       rebuilds menu-data.js from transcription files (only needed for re-transcription)
```

## Publish it (once)

The QR codes point to **https://shiniknezir-dotcom.github.io/neni/mozart-menu/**.
For that address to work, GitHub Pages has to be switched on for this repository:

1. Merge this branch into `master`.
2. GitHub → repository **Settings → Pages → Build and deployment**: Source "Deploy from a branch", branch `master`, folder `/ (root)`, Save.
3. After a minute the menu is live at the address above. Scan `qr/mozart-menu-qr.png` to test.

Want a nicer address (e.g. `menu.mozart-wuerzburg.de`)? Point a CNAME at `shiniknezir-dotcom.github.io`, add it under Settings → Pages → Custom domain, then regenerate the QR codes:

```
pip install qrcode pillow segno
python3 mozart-menu/make-qr.py https://menu.mozart-wuerzburg.de/
```

## Print the QR code

- `qr/mozart-qr-tischkarte-A6.pdf` — table card, A6 (105 × 148 mm), print on heavy paper, no scaling.
- `qr/mozart-qr-sticker-60mm.png` — 60 × 60 mm sticker (window, door, counter).
- `qr/mozart-menu-qr.svg` / `.pdf` — vector QR for the print shop (plum on cream).
- `qr/mozart-menu-qr-plain.png` — black on white without logo, for very small prints or laminates.

The logo-centred code uses the highest error-correction level and was verified to scan at 240 px.
Keep a quiet zone (light margin) around the code and never print it smaller than 2 × 2 cm.

## Change prices or dishes

Open `menu-data.js` in any text editor. Each dish looks like this:

```js
{ "name": { "de": "Zimtporridge", "en": "Cinnamon porridge" },
  "description": { "de": "mit frischen Früchten & Mandelmilch", "en": "with fresh fruit & almond milk" },
  "allergens": "8a,8c",
  "prices": [ { "size": "", "price": 7.6 } ],
  "tags": [] }
```

- Prices are plain numbers with a dot (`7.6`); the page shows `7,60 €` in German and `7.60 €` in English.
- Drinks with several sizes: `"prices": [ { "size": "0,2l", "price": 2.8 }, { "size": "0,4l", "price": 5.2 } ]`.
- `tags` may contain `"vegan"`, `"vegetarisch"` or `"alkoholfrei"` to show a small badge.
- Sections have `"group": "food"` or `"drinks"` (which tab they appear in) and a `"tempo"` eyebrow (the musical marking above the title; set it to `""` to hide it).
- Commit and push; GitHub Pages updates within a minute. Guests who already scanned the code see the new prices on their next visit.

## Items to double-check

The menu was transcribed from photos. Items whose line was hidden by a shadow or glare carry
`"uncertain": true` with a `"remark"` in `menu-data.js` (search for `"uncertain": true`). Please compare those with the printed card.
