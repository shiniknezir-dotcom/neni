/* ==========================================================================
   BlütenSturm — language-independent content data.
   Every word a visitor reads lives in /i18n/<lang>.json; this file only
   carries ids, prices, units, icons and ordering.
   ========================================================================== */

/* Unit keys resolve through i18n: unit.mo / unit.pr / unit.day */
export const SERVICES = [
  { id: 'brand-strategy',               icon: 'pen',       featured: true,  normal: ['6.500 €', 'pr'],  premium: ['18.000 €', 'pr'] },
  { id: 'marketing-strategy',           icon: 'compass',   featured: false, normal: ['4.800 €', 'pr'],  premium: ['12.000 €', 'pr'] },
  { id: 'creative-services',            icon: 'spark',     featured: false, normal: ['3.900 €', 'pr'],  premium: ['14.000 €', 'pr'] },
  { id: 'digital-marketing',            icon: 'trend',     featured: true,  normal: ['2.400 €', 'mo'],  premium: ['6.500 €', 'mo'] },
  { id: 'social-media-management',      icon: 'chat',      featured: true,  normal: ['1.900 €', 'mo'],  premium: ['4.900 €', 'mo'] },
  { id: 'content-production',           icon: 'camera',    featured: true,  normal: ['3.200 €', 'mo'],  premium: ['8.500 €', 'mo'] },
  { id: 'website-digital-experience',   icon: 'browser',   featured: true,  normal: ['8.500 €', 'pr'],  premium: ['24.000 €', 'pr'] },
  { id: 'advertising',                  icon: 'megaphone', featured: false, normal: ['5.500 €', 'pr'],  premium: ['16.000 €', 'pr'] },
  { id: 'pr',                           icon: 'mic',       featured: false, normal: ['2.200 €', 'mo'],  premium: ['5.800 €', 'mo'] },
  { id: 'business-development-support', icon: 'growth',    featured: false, normal: ['3.600 €', 'mo'],  premium: ['9.000 €', 'mo'] },
  { id: 'event-marketing-promotions',   icon: 'ticket',    featured: false, normal: ['7.500 €', 'pr'],  premium: ['22.000 €', 'pr'] },
  { id: 'video-multimedia',             icon: 'play',      featured: false, normal: ['4.500 €', 'pr'],  premium: ['14.500 €', 'pr'] },
  { id: 'analytics',                    icon: 'chart',     featured: false, normal: ['3.400 €', 'pr'],  premium: ['1.900 €', 'mo'] },
  { id: 'ai-innovation',                icon: 'cpu',       featured: false, normal: ['4.200 €', 'pr'],  premium: ['11.000 €', 'pr'] },
  { id: 'consulting',                   icon: 'bulb',      featured: false, normal: ['1.850 €', 'day'], premium: ['4.500 €', 'mo'] },
  { id: 'employer-branding',            icon: 'people',    featured: false, normal: ['5.400 €', 'pr'],  premium: ['15.000 €', 'pr'] },
  { id: 'ongoing-client-services',      icon: 'loop',      featured: false, normal: ['2.900 €', 'mo'],  premium: ['7.900 €', 'mo'] },
  { id: 'corporate-training',           icon: 'board',     featured: true,  normal: ['2.400 €', 'day'], premium: ['3.900 €', 'day'] }
];

/* The five discipline cards on the home page map onto a lead service each. */
export const DISCIPLINES = [
  { id: 'brand-strategy',             icon: 'pen',     tone: 'featured' },
  { id: 'digital-marketing',          icon: 'trend',   tone: '' },
  { id: 'content-production',         icon: 'camera',  tone: '' },
  { id: 'event-marketing-promotions', icon: 'ticket',  tone: '' },
  { id: 'corporate-training',         icon: 'board',   tone: 'dark' }
];

/* Partner brand categories, keyed for translation (brands.cat.<key>). */
export const BRAND_CATEGORIES = {
  'Dairy & Chilled': 'dairy',
  'Meat & Charcuterie': 'meat',
  'Confectionery': 'sweets',
  'Food & Beverage': 'food',
  'Beverages': 'drinks',
  'Baby & Infant': 'baby',
  'Frozen & Vegetables': 'frozen',
  'Bakery & Grains': 'bakery'
};

/* Inline stroke icons, 24 × 24, drawn to sit in the petal tiles. */
export const ICONS = {
  pen:       '<path d="M12 3l5 7-5 11-5-11 5-7z"/><circle cx="12" cy="10.5" r="1.6"/><path d="M12 12v9"/>',
  compass:   '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5 5-2z"/>',
  spark:     '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/><path d="M19 16l.7 2.1L22 19l-2.3.8L19 22l-.7-2.2L16 19l2.3-.9L19 16z"/>',
  trend:     '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  chat:      '<path d="M4 5h16v11H9l-4 3.5V16H4V5z"/><path d="M12 13.2l-2.4-2.3a1.4 1.4 0 0 1 2-2l.4.4.4-.4a1.4 1.4 0 0 1 2 2L12 13.2z"/>',
  camera:    '<path d="M4 8h3l1.5-2h7L17 8h3v11H4V8z"/><circle cx="12" cy="13" r="3.2"/>',
  browser:   '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18"/><path d="M7 13h7M7 16h4"/>',
  megaphone: '<path d="M4 10v4h3l8 4V6l-8 4H4z"/><path d="M18 9.5a3.5 3.5 0 0 1 0 5"/><path d="M7 14l1 5h3"/>',
  mic:       '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3M9 21h6"/>',
  growth:    '<path d="M4 20V10M10 20V5M16 20v-7M22 20V3"/><path d="M4 9l6-4 6 5 6-7"/>',
  ticket:    '<path d="M4 8a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4V8z"/><path d="M12 9l.9 1.9 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.5 2.1-.3L12 9z"/>',
  play:      '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3V9z"/>',
  chart:     '<path d="M4 20h16"/><rect x="6" y="11" width="3" height="6"/><rect x="11" y="7" width="3" height="10"/><rect x="16" y="13" width="3" height="4"/>',
  cpu:       '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="10" y="10" width="4" height="4"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
  bulb:      '<path d="M9 18h6M10 21h4"/><path d="M8 13a5 5 0 1 1 8 0c-1 1-1.5 2-1.5 3h-5c0-1-.5-2-1.5-3z"/>',
  people:    '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2.4"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M15 20a4.5 4.5 0 0 1 6 0"/>',
  loop:      '<path d="M4 12a8 8 0 0 1 13.6-5.7L20 8"/><path d="M20 4v4h-4"/><path d="M20 12a8 8 0 0 1-13.6 5.7L4 16"/><path d="M4 20v-4h4"/>',
  board:     '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M7 12l3-3 3 2 4-4"/><path d="M12 16v4M8 20h8"/>'
};

export const COMPANY = {
  name: 'BlütenSturm',
  legal: 'BlütenSturm GmbH',
  email: 'info@bluetensturm.com',
  instagram: 'https://www.instagram.com/bluetensturmcreative',
  instagramHandle: '@bluetensturmcreative',
  city: 'Würzburg',
  cities: 'Würzburg · Berlin · Zürich · Wien · Milano',
  domain: 'bluetensturm.com'
};

/* Form delivery: Formspree keeps sending mail to info@bluetensturm.com as
   before; on Netlify the same submission is also stored as a Netlify Form. */
export const FORMSPREE = 'https://formspree.io/f/mvkpynzr';
