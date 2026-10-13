/* ==========================================================================
   Blüten Sturm — enquiry delivery.
   Never silently drops a lead. Every transport that can reach the inbox is
   tried, best first:

     1. Formspree (fetch, JSON) — the proven path that mails
        info@bluetensturm.com and gives a real response.
     2. Netlify Forms (POST to the page's own path, urlencoded) — on Netlify
        the same submission is also kept in the site dashboard. Elsewhere this
        request simply fails and is ignored.
     3. mailto: with every answer pre-filled, if nothing network-based worked.
   ========================================================================== */

import { FORMSPREE, COMPANY } from './data.js';

const SKIP = new Set(['bot-field', 'form-name', '_next', '_honey', '_captcha', '_template']);

export function collect(form) {
  const data = {};
  new FormData(form).forEach((v, k) => {
    if (SKIP.has(k)) return;
    data[k] = typeof v === 'string' ? v.trim() : '';
  });
  return data;
}

function bodyText(data) {
  return Object.keys(data)
    .filter((k) => k.charAt(0) !== '_')
    .map((k) => `${k}: ${data[k] || '—'}`)
    .join('\n');
}

export function mailtoHref(data, subject) {
  return `mailto:${COMPANY.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText(data))}`;
}

async function sendFormspree(data, subject, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(FORMSPREE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...data, _subject: subject, email: data.Email || data.email || '' }),
      signal: ctrl.signal
    });
    const json = await res.json().catch(() => ({}));
    return res.ok && String(json.success) !== 'false' && !json.errors;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function sendNetlify(form, data, timeoutMs = 10000) {
  const name = form.getAttribute('name');
  /* Netlify strips data-netlify from deployed HTML but keeps form-name */
  if (!name || !form.querySelector('input[name="form-name"]')) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const body = new URLSearchParams({ 'form-name': name, ...data }).toString();
    const res = await fetch(window.location.pathname, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: ctrl.signal
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send an enquiry. Resolves to { ok, via, href }.
 */
export async function sendEnquiry(form, subject) {
  const data = collect(form);
  const [viaFormspree, viaNetlify] = await Promise.all([
    sendFormspree(data, subject),
    sendNetlify(form, data)
  ]);
  if (viaFormspree) return { ok: true, via: 'formspree' };
  if (viaNetlify) return { ok: true, via: 'netlify' };
  return { ok: false, via: 'mailto', href: mailtoHref(data, subject) };
}

export function fallbackHref(form, subject) {
  return mailtoHref(collect(form), subject);
}
