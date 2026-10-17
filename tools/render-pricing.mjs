// Regenerates the no-JavaScript fallback of the price list in site/index.html
// from site/data/pricing.json, with the same renderer the browser uses
// (site/js/pricing.js). The fallback always shows the regular prices only, so
// it can never advertise an offer after it has ended; with JavaScript the page
// renders the live prices (and the October offer while it runs) itself.
//
//   node tools/render-pricing.mjs
//
// Run it after editing site/data/pricing.json (only visitors without
// JavaScript would otherwise see the old fallback).
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
html = html.replace(block, `$1\n${renderPricing(data, ctx).replace(/^/gm, '      ')}\n$2`);
let cards = 0;
html = html.replace(/(<p class="svc__from" data-card-price="([\w-]+)">)[\s\S]*?(<\/p>)/g, (m, open, id, close) => { cards++; return open + cardPrice(id, data, ctx) + close; });
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log(`price list and ${cards} card prices written to site/index.html (regular prices, ${data.updated})`);
