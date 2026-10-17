// Regenerates the no-JavaScript fallback of the price list in site/index.html
// from site/data/pricing.json, with the same renderer the browser uses
// (site/js/pricing.js). The fallback always shows the regular prices only, so
// it can never advertise an offer after it has ended; with JavaScript the page
// renders the live prices (and the October offer while it runs) itself.
// It also embeds a copy of the JSON, which the page uses (in the visitor's
// language, with the same offer dates) if /data/pricing.json cannot be fetched.
//
//   node tools/render-pricing.mjs
//
// Run it after editing site/data/pricing.json, so the fallback and the
// embedded copy match the file.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeContext, renderPricing, cardPrice } from '../site/js/pricing.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'site');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const data = JSON.parse(read('data/pricing.json'));
const en = JSON.parse(read('i18n/en.json'));
const get = (o, k) => k.split('.').reduce((a, x) => (a && a[x] !== undefined ? a[x] : undefined), o);
/* English (the markup language), long after any offer has ended */
const ctx = makeContext({ lang: 'en', t: (k, f) => { const v = get(en, k); return v === undefined ? f : v; }, now: Number.MAX_SAFE_INTEGER });

let html = read('index.html');
const block = /(<!--@PRICING-->)[\s\S]*?(<!--\/@PRICING-->)/;
if (!block.test(html)) throw new Error('index.html: <!--@PRICING--> markers missing');
/* function replacers: a "$" in the data must not be read as a pattern */
html = html.replace(block, (m, open, close) => `${open}\n${renderPricing(data, ctx).replace(/^/gm, '      ')}\n${close}`);
const embed = /(<!--@PRICING-DATA-->)[\s\S]*?(<!--\/@PRICING-DATA-->)/;
if (!embed.test(html)) throw new Error('index.html: <!--@PRICING-DATA--> markers missing');
/* "<" escaped, so no text in the data can close the script element */
html = html.replace(embed, (m, open, close) => `${open}<script type="application/json" id="pricing-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>${close}`);
let cards = 0;
html = html.replace(/(<p class="svc__from" data-card-price="([\w-]+)">)[\s\S]*?(<\/p>)/g, (m, open, id, close) => { cards++; return open + cardPrice(id, data, ctx) + close; });
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log(`price list, ${cards} card prices and the data copy written to site/index.html (regular prices, ${data.updated})`);
