# Hole 19 — Reservierungs-Bestätigung per E-Mail

A small, self-contained PHP endpoint for the Hole 19 website. When a guest submits the reservation form it

1. sends the guest a **German confirmation from the info@ address** ("Vielen Dank, {Name}! Ihre Reservierung wurde bestätigt … Ihr Hole 19 Team"), and
2. sends the team a notification with all details (reply goes straight to the guest).

It runs on any PHP 7.4+ host, including Hostinger shared hosting. PHPMailer is bundled in `vendor/`, so there is nothing to install on the server.

---

## What the guest receives

**Betreff:** Ihre Reservierung bei Hole 19 ist bestätigt

```
Vielen Dank, Anna Müller!

Ihre Reservierung wurde bestätigt.

Ihre Reservierung im Überblick:
Datum: 12.10.2026
Uhrzeit: 19:30 Uhr
Personen: 4

Wir freuen uns auf Ihren Besuch!
Falls sich etwas ändert, antworten Sie einfach auf diese E-Mail.

Vielen Dank,
Ihr Hole 19 Team
```

The HTML version has the same text in a simple branded layout (dark-green header, details table). Only the fields the guest filled in are shown. Set `'address_form' => 'du'` in `config.php` for the casual form ("Deine Reservierung wurde bestätigt … Dein Hole 19 Team").

**The team gets:** *Neue Reservierung: Anna Müller · 12.10.2026 19:30 · 4 Personen* with name, e-mail, phone, date, time, guests and message. Replying answers the guest directly.

---

## Files

| File | Purpose |
|---|---|
| `reserve.php` | The endpoint your form posts to. Validates, rate-limits, sends both e-mails. |
| `templates.php` | All e-mail wording (German, Sie/du) and the HTML layout. |
| `mailer.php` | Thin PHPMailer wrapper: SMTP when a password is set, PHP `mail()` otherwise. |
| `config.example.php` | Copy to `config.php` on the server and fill in. **`config.php` is git-ignored.** |
| `form-snippet.html` | A ready-made reservation form (German labels, inline success message). |
| `vendor/` | PHPMailer 6, installed with Composer. Upload as-is. |
| `.htaccess` | Lets the browser reach only `reserve.php`; blocks direct requests to `config.php`, the templates and `vendor/`. |

---

## Setup on Hostinger (5 minutes)

1. **Upload** this whole folder to your site, e.g. `public_html/reservierung/` (File Manager or FTP). Keep `vendor/` inside it.
2. **Create `config.php`**: in the File Manager copy `config.example.php` to `config.php` and fill in:
   - `from_email` / `smtp_user`: your info mailbox, e.g. `info@hole19.at`
   - `smtp_password`: that mailbox's password (hPanel → E-Mails → Manage)
   - `notify_email`: where the team wants new reservations (usually the same info@)
   - Hostinger SMTP is pre-filled: `smtp.hostinger.com`, port `465`, `ssl`. Port `587` with `tls` also works.
3. **Point your form at it.** Either paste the `<form>` from `form-snippet.html` into your reservation page, or give your existing form `method="post"` and `action="/reservierung/reserve.php"` and use these field names: `name`, `email`, `phone`, `date`, `time`, `guests`, `message`, plus a hidden empty `website` field (spam trap). Only `name` and `email` are required.
4. **Test** with your own e-mail address. You should get the confirmation within a few seconds and the team address should get the notification.
5. Optional hardening in `config.php`: set `allowed_origins` to `['https://hole19.at', 'https://www.hole19.at']` so only your own pages can post to the endpoint.

The info@ mailbox must exist on the domain. If your e-mail is hosted at Hostinger, SPF and DKIM are already set up for it, so the confirmation lands in the inbox rather than spam.

### No SMTP password?

Leave `smtp_password` empty and the script falls back to PHP's `mail()`, which Hostinger shared hosting supports out of the box. Authenticated SMTP is still the better choice for deliverability.

---

## How a submission is handled

- Accepts a classic form post, `multipart/form-data`, or JSON from `fetch()`. JSON callers (the snippet) get `{ "ok": true }` or `{ "ok": false, "errors": {…} }`; classic posts get a small German page or, if `redirect_after_success` is set, a redirect to your thank-you page.
- Validation (German messages): name ≥ 2 characters and no links, valid e-mail, date as `YYYY-MM-DD` or `TT.MM.JJJJ`, time `HH:MM`, guests 1–99. Dates are shown as `12.10.2026`, times as `19:30 Uhr`.
- Spam protection: hidden honeypot field (bots get a fake success and no e-mail), at most 5 submissions per IP per 10 minutes, link-free names, and the free-text message is only sent to the team, never echoed back to the guest.
- Failures to reach the mail server are logged to the PHP error log and the guest sees a friendly German error; the guest's confirmation is sent first, the team notification second.

---

## Wording changes

Everything the guest reads lives in `templates.php` (`wording()`), everything the form shows lives in `reserve.php` (`ui()`). The business name and signature come from `config.php` (`business_name`, `team_signature`, optional `footer_lines` for address and phone).

## "Approved" vs. "confirmed"

The e-mail goes out immediately when the form is submitted, so it says *bestätigt* (confirmed), which is the natural German term. If you would rather review each request first and only then send the confirmation, that needs a small admin step (a list of pending requests with an "approve" button); say so and it can be added on top of this endpoint.

---

## Local testing

```bash
cd hole19-reservation
cp config.example.php config.php          # point smtp_host at a local test server, or leave smtp_password empty
php -S 127.0.0.1:8089
curl -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"name":"Anna Müller","email":"anna@example.com","date":"2026-10-12","time":"19:30","guests":"4"}' \
  http://127.0.0.1:8089/reserve.php
```
