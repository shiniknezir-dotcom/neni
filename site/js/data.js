/* ==========================================================================
   Blüten Sturm — language-independent content data.
   Every word a visitor reads lives in /i18n/<lang>.json and every price in
   /data/pricing.json; this file carries only ids and ordering.
   ========================================================================== */

/* Service order. Prices are not kept here: every price on the site comes
   from /data/pricing.json (see js/pricing.js). */
export const SERVICES = [
  { id: 'brand-strategy',                featured: true },
  { id: 'marketing-strategy',            featured: false },
  { id: 'creative-services',             featured: false },
  { id: 'digital-marketing',             featured: true },
  { id: 'social-media-management',       featured: true },
  { id: 'content-production',            featured: true },
  { id: 'website-digital-experience',    featured: true },
  { id: 'advertising',                   featured: false },
  { id: 'pr',                            featured: false },
  { id: 'business-development-support',  featured: false },
  { id: 'event-marketing-promotions',    featured: false },
  { id: 'video-multimedia',              featured: false },
  { id: 'analytics',                     featured: false },
  { id: 'ai-innovation',                 featured: false },
  { id: 'consulting',                    featured: false },
  { id: 'employer-branding',             featured: false },
  { id: 'ongoing-client-services',       featured: false },
  { id: 'corporate-training',            featured: false }
];

/* Partner categories in media/brands/manifest.json -> brands.cat.<key> */
export const BRAND_CATEGORIES = {
  'Dairy & Chilled': 'dairy',
  'Meat & Charcuterie': 'meat',
  'Confectionery': 'confectionery',
  'Food & Beverage': 'food',
  'Beverages': 'beverages',
  'Baby & Infant': 'baby',
  'Frozen & Vegetables': 'frozen',
  'Bakery & Grains': 'bakery'
};

export const COMPANY = {
  name: 'Blüten Sturm',
  legal: 'Blüten Sturm GmbH',
  email: 'info@bluetensturm.com',
  instagram: 'https://www.instagram.com/bluetensturmcreative',
  domain: 'bluetensturm.com'
};

/* Form delivery: Formspree mails info@bluetensturm.com exactly as the live
   site does; on Netlify the same submission is also kept as a Netlify Form. */
export const FORMSPREE = 'https://formspree.io/f/mvkpynzr';
