# Mozart café · bistro · bar — QR-Speisekarte / QR menu

Digital, bilingual (Deutsch / English) menu for Mozart, Theaterstr. 21, Würzburg, plus the QR code that opens it.
Static site, no build step, no server: one HTML page, one stylesheet, one script and one data file. Hosted on Netlify at **https://mozart-wuerzburg.netlify.app/** (see below).

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
├── build-data.py       rebuilds menu-data.js from data/menu.json
├── build-netlify.py    packs the site into mozart-menu-netlify.zip
├── netlify.toml        Netlify headers and /de /en short links
└── mozart-menu-netlify.zip   ready to drop on https://app.netlify.com/drop
```

## Publish on Netlify (5 minutes, one link for everything)

The QR codes already point to **https://mozart-wuerzburg.netlify.app/**. To make that address live:

1. Log in at https://app.netlify.com and open **https://app.netlify.com/drop**.
2. Drag **`mozart-menu-netlify.zip`** (in this folder) onto the page. Netlify unpacks it and gives the site a random name like `sparkly-otter-1234.netlify.app`.
3. Click the new site → **Site configuration → Site details → Change site name** → enter `mozart-wuerzburg` → Save.
   The menu is now at https://mozart-wuerzburg.netlify.app/ and every printed QR code works.

If Netlify says the name `mozart-wuerzburg` is already taken, choose another (for example `cafe-mozart-wuerzburg`) and regenerate the QR files for it once:

```
pip install qrcode pillow segno
python3 mozart-menu/make-qr.py https://cafe-mozart-wuerzburg.netlify.app/
```

Then print the new files from `qr/`. The card page is also online: https://mozart-wuerzburg.netlify.app/qr-card.html (open it in a browser and print at 100 %).

**Updating later:** change `menu-data.js`, run `python3 build-netlify.py` to rebuild the zip, and drop the new zip on the site's **Deploys** page. Guests see the new prices within a few minutes. Short links: `/de` and `/en` open the menu in that language.

Own domain later (e.g. `menu.mozart-wuerzburg.de`)? Add it under Netlify **Domain management**, then regenerate the QR codes for that address with the command above.

### Alternative: GitHub Pages

The same folder also works on GitHub Pages: merge this branch into `master`, then GitHub **Settings → Pages → Deploy from a branch** (`master`, root). The address is then `https://shiniknezir-dotcom.github.io/neni/mozart-menu/`; regenerate the QR codes for it with `make-qr.py <url>`.

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

The menu was transcribed from 23 photos, read by two independent passes and audited page by page. Everything was legible except the spots below. These carry `"uncertain": true` in `menu-data.js` and `data/menu.json`; please compare them with the printed card and correct the text (the prices are all confirmed except the four extras):

| Abschnitt | Gericht / Getränk | Was zu prüfen ist |
|---|---|---|
| Frühstück | extra Hummus | Preis am Fotorand abgeschnitten: nur '2,0' lesbar (vermutlich 2,00). Bitte prüfen. |
| Frühstück | Joghurt mit Früchten | Preis am Fotorand abgeschnitten: nur '3,5' lesbar (3,50 oder 3,5x). Bitte prüfen. |
| Frühstück | Französisches Croissant | Preis am Fotorand abgeschnitten: nur '2,' und der Ansatz einer Ziffer lesbar. Bitte prüfen. |
| Frühstück | Frühstücksei | Preis am Fotorand abgeschnitten: nur die führende '1' lesbar. Bitte prüfen. |
| Gefüllte überbackene Ofenkartoffel | Mit Lachs & Camembert | Hochgestellte Codes sehr klein: Lachs(4), Camembert(7,4,9,3) – letzte Ziffer könnte auch '8' sein. Preis 10,50 klar. |
| Flammkuchen | Mit Räucherschinken | Nur 'Mit Räuche…' lesbar (Handschatten). 'Räucherschinken' ist eine Vermutung – bitte prüfen, evtl. '& Zwiebeln' ergänzen. |
| Flammkuchen | Mit Tomaten, Mozzarella & Basilikum | Nur 'Mit Tomaten, …' lesbar; Rest vermutet (schwach 'Mozz…' erkennbar). Bitte prüfen. |
| Flammkuchen | Mit Rucola, italienischem Schinken & Parmesan | Lesbar: 'Mit Rucola, italie… & Parmesan'; 'italienischem Schinken' ergänzt. Bitte prüfen. |
| Flammkuchen | Mit geräuchertem Lachs und Brie | Lesbar: 'Mit geräuchertem L… … Brie'; 'Lachs und' ergänzt. Bitte prüfen. |
| Flammkuchen | Mit Sudzuk (Rindersalami) | Lesbar: 'Mit Sudzuk (Rinder S…)'; Klammerinhalt vermutet. Bitte prüfen. |
| Essen im Mozart | Capreseteller | Hochgestellte Codes winzig: '6' könnte auch '8' sein. |
| Kaffeespezialitäten | Schuss Sirup | Ende des Wortes 'Macadamia' samt Code durch Glanzlicht verdeckt; aus der Legende (8d Macadamia) ergänzt. |
| Fränkische Flaschen-Qualitätsweine | Juliusspital Würzburger Riesling | Erster Buchstabe von 'Aprikose' durch das Weinglas-Bild verdeckt; Lesung naheliegend. |

Also worth a glance:

- **Phone number** on the back cover was read from embossed foil as `0931 90704686` (the last digits could be `…886`). Check it before printing cards.
- **Print typos** in the original were corrected on the digital menu: Mozarella → Mozzarella, Tomate-Mozaerlla → Tomate-Mozzarella, Safte → Säfte, Petrsilie → Petersilie, Kardamon → Kardamom, Rooibush → Rooibos, Cachaca → Cachaça, Bombay Saphire → Bombay Sapphire, Hendricks → Hendrick's, Jack Daniels → Jack Daniel's, CocaCola → Coca-Cola, RedBull → Red Bull, "afrikanischer Rotwein" → "südafrikanischer Rotwein" (Skaapred is South African), and in the allergen legend "Lupin Erz" → "Lupinen", "Milchtiere" → "Weichtiere". Revert any of these in `menu-data.js` if the original spelling was intended.
- **Juliusspital Scheurebe and Würzburger Silvaner** carry the identical tasting note on the printed page; both were kept as printed.
- **Flammkuchen allergen codes** on the heading were only partly readable ("…,7"); no codes are shown for that section until confirmed.
