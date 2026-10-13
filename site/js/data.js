/* ==========================================================================
   Blüten Sturm — language-independent content data.
   Every word a visitor reads lives in /i18n/<lang>.json; this file carries
   only ids, prices, units and ordering. The figures are the indicative
   from-prices of the live site (Bavarian market, net of VAT).
   ========================================================================== */

/* Service order, prices and units. Units resolve through panel.unit.<key>.
   The featured services are drawn larger in the hero. */
export const SERVICES = [
  { id: 'brand-strategy',                featured: true,  normal: ['6.500 €', 'pr'], premium: ['18.000 €', 'pr'] },
  { id: 'marketing-strategy',            featured: false, normal: ['4.800 €', 'pr'], premium: ['12.000 €', 'pr'] },
  { id: 'creative-services',             featured: false, normal: ['3.900 €', 'pr'], premium: ['14.000 €', 'pr'] },
  { id: 'digital-marketing',             featured: true,  normal: ['2.400 €', 'mo'], premium: ['6.500 €', 'mo'] },
  { id: 'social-media-management',       featured: true,  normal: ['1.900 €', 'mo'], premium: ['4.900 €', 'mo'] },
  { id: 'content-production',            featured: true,  normal: ['3.200 €', 'mo'], premium: ['8.500 €', 'mo'] },
  { id: 'website-digital-experience',    featured: true,  normal: ['8.500 €', 'pr'], premium: ['24.000 €', 'pr'] },
  { id: 'advertising',                   featured: false, normal: ['5.500 €', 'pr'], premium: ['16.000 €', 'pr'] },
  { id: 'pr',                            featured: false, normal: ['2.200 €', 'mo'], premium: ['5.800 €', 'mo'] },
  { id: 'business-development-support',  featured: false, normal: ['3.600 €', 'mo'], premium: ['9.000 €', 'mo'] },
  { id: 'event-marketing-promotions',    featured: false, normal: ['7.500 €', 'pr'], premium: ['22.000 €', 'pr'] },
  { id: 'video-multimedia',              featured: false, normal: ['4.500 €', 'pr'], premium: ['14.500 €', 'pr'] },
  { id: 'analytics',                     featured: false, normal: ['3.400 €', 'pr'], premium: ['1.900 €', 'mo'] },
  { id: 'ai-innovation',                 featured: false, normal: ['4.200 €', 'pr'], premium: ['11.000 €', 'pr'] },
  { id: 'consulting',                    featured: false, normal: ['1.850 €', 'day'], premium: ['4.500 €', 'mo'] },
  { id: 'employer-branding',             featured: false, normal: ['5.400 €', 'pr'], premium: ['15.000 €', 'pr'] },
  { id: 'ongoing-client-services',       featured: false, normal: ['2.900 €', 'mo'], premium: ['7.900 €', 'mo'] },
  { id: 'corporate-training',            featured: false, normal: ['2.400 €', 'day'], premium: ['3.900 €', 'day'] }
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
