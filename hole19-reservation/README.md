# Hole 19 — Reservierungs-Bestätigung per E-Mail

A small, self-contained PHP endpoint for the Hole 19 website. When a guest submits the reservation form it

1. sends the guest a **German confirmation from the info@ address** ("Vielen Dank, {Name}! Ihre Reservierung wurde bestätigt … Ihr Hole 19 Team"), and
2. sends the team a notification with all details (replying answers the guest directly).

It runs on any PHP 7.4+ web host with the `mbstring` extension, which includes Hostinger's shared hosting plans (Single, Premium, Business). It does **not** run on a Hostinger Website Builder site, because Builder sites cannot execute PHP. PHPMailer is bundled in `vendor/`, so there is nothing to install on the server.

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

Vielen Dank
Ihr Hole 19 Team
```

The HTML version has the same text in a simple branded layout (dark-green header, details table). Only the fields the guest filled in are shown. Set `'address_form' => 'du'` in `config.php` for the casual form ("Deine Reservierung wurde bestätigt … Dein Hole 19 Team"); every message the guest sees, including form errors, follows that switch.

**The team gets:** *Neue Reservierung: Anna Müller · 12.10.2026, 19:30 Uhr · 4 Personen* with name, e-mail, phone, date, time, guests and message, and a note that the guest has already been confirmed. Replying answers the guest directly.

---

## Files

| File | Purpose |
|---|---|
| `reserve.php` | The endpoint your form posts to. Validates, rate-limits, sends both e-mails. |
| `templates.php` | All e-mail wording (German, Sie/du) and the HTML layout. |
| `mailer.php` | Thin PHPMailer wrapper: SMTP when a password is set, PHP `mail()` otherwise. |
| `config.example.php` | Copy to `config.php` on the server and fill in. **`config.php` is git-ignored.** |
| `form-snippet.html` | A ready-made reservation form (German labels, inline success message, works without JavaScript). |
| `.htaccess` | Lets the browser reach only `reserve.php`; blocks direct requests to `config.php`, the templates and `vendor/`. |
| `vendor/` | PHPMailer 6, installed with Composer. Upload as-is. |

---

## Setup on Hostinger (5 minutes)

1. **Upload** this whole folder to your site, e.g. `public_html/reservierung/` (File Manager or FTP). Keep `vendor/` and `.htaccess` inside it.
2. **Create `config.php`**: in the File Manager copy `config.example.php` to `config.php` and fill in:
   - `from_email` / `smtp_user`: your info mailbox, e.g. `info@hole19.at`. It must be a mailbox that exists on a domain of this hosting account.
   - `smtp_password`: that mailbox's password (hPanel → E-Mails → Manage).
   - `notify_email`: where the team wants new reservations (usually the same info@).
   - `required_fields`: which fields guests must fill in besides name and e-mail. Default: date, time and guests.
   - Hostinger SMTP is pre-filled: `smtp.hostinger.com`, port `465`, `ssl`. Port `587` with `tls` also works.
3. **Add the form.** Paste the **whole** of `form-snippet.html` (form, style and script) into your reservation page, or point your existing form at the endpoint: `method="post"`, `action="/reservierung/reserve.php"`, field names `name`, `email`, `phone`, `date`, `time`, `guests`, `message`, plus a hidden, empty text field named `website`. That last field is a spam trap: it must stay invisible and empty, because any value in it makes the server discard the request silently (fake success, no e-mail).
4. **Test** with your own e-mail address. The confirmation should arrive within seconds and the team address should get the notification.
5. Optional: set `allowed_origins` in `config.php` to `['https://hole19.at', 'https://www.hole19.at']` so only your own pages can post to the endpoint. Leave it empty if guests report being blocked; some privacy settings strip the headers this check relies on.

If your e-mail is hosted at Hostinger, SPF and DKIM are already set up for the domain, so the confirmation lands in the inbox rather than spam.

### No SMTP password?

Leave `smtp_password` empty and the script falls back to PHP's `mail()`. On Hostinger shared hosting that path is capped at **10 e-mails per minute and 100 per day** for the whole account, after which Hostinger temporarily disables it. Each reservation sends two e-mails, so this is only for testing or an emergency: once the cap is hit, guests see "Die Bestätigung konnte gerade nicht gesendet werden" and the reservation is not recorded anywhere. For production set `smtp_password`; authenticated SMTP from the info@ mailbox uses the mailbox's own, much higher limits and is what Hostinger recommends. The script writes a line to the PHP error log whenever it runs in fallback mode.

---

## How a submission is handled

- **Input**: a classic form post, `multipart/form-data`, or JSON (up to 64 KB) from `fetch()`.
- **Validation** (German messages, Sie or du): name 2–60 characters, letters, spaces, apostrophes and hyphens only (no digits, links or domain names, since the name is the only visitor text that reaches the guest's inbox); valid e-mail; date as `YYYY-MM-DD` or `TT.MM.JJJJ`, not in the past (`timezone` in config); time as `19:30`, `7:30`, `19.30` or `1930`; guests 1–99; fields listed in `required_fields` must be present. Dates are shown as `12.10.2026`, times as `19:30 Uhr`.
- **Responses**: callers that send JSON or `Accept: application/json` get JSON: `{"ok":true,"message":"…"}` on success, `{"ok":false,"errors":{"field":"…"}}` with HTTP 422 on validation errors, `{"ok":false,"error":"…"}` with 403, 405, 429 or 500 otherwise. Classic posts get a small German result page listing any errors with a link back to the form, or a redirect to `redirect_after_success` if set.
- **Spam protection**: hidden honeypot field (bots get a fake success and no e-mail; hits are logged), at most 5 accepted submissions per IP per 10 minutes (validation errors do not count, so typos never lock a guest out), names restricted to letters, and the free-text message goes only to the team, never back to the guest.
- **Failures**: if the mail server cannot be reached the guest sees a friendly German error and the reason is written to the PHP error log. The guest's confirmation is sent first, the team notification second; a failed team notification never affects the guest.

---

## Wording changes

Everything the guest reads lives in `templates.php` (`wording()`), everything the form shows lives in `reserve.php` (`ui()`). The business name and signature come from `config.php` (`business_name`, `team_signature`, optional `footer_lines` for address and phone).

## "Approved" vs. "confirmed"

The e-mail goes out immediately when the form is submitted, so it says *bestätigt* (confirmed), which is the natural German term. If you would rather review each request first and only then send the confirmation, that needs a small admin step (a list of pending requests with an "approve" button); say so and it can be added on top of this endpoint.

---

## Local testing

Without a mail server, let PHP's `mail()` write the message to a file instead of sending it:

```bash
cd hole19-reservation
cp config.example.php config.php        # keep smtp_password empty so the mail() path is used
php -S 127.0.0.1:8089 -d sendmail_path="tee /tmp/hole19-last-mail.eml >/dev/null"

curl -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"name":"Anna Müller","email":"anna@example.com","date":"2026-12-12","time":"19:30","guests":"4"}' \
  http://127.0.0.1:8089/reserve.php
# -> {"ok":true,"message":"Vielen Dank! …"}; the last e-mail sent is in /tmp/hole19-last-mail.eml
```
