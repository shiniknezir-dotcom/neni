# restauranthole19.de — live-site changes

Files from the Hostinger hosting account of **restauranthole19.de** (`public_html`)
that were changed from this repo. The rest of the site is not mirrored here.

| File | What it is |
|---|---|
| `api/reservierung.php` | The site's form mailer, **now also sending the guest a German confirmation**. |
| `api/reservierung.before.php` | The mailer exactly as it was before that change. Upload it as `api/reservierung.php` to roll back. |

`api/config.php` on the server (recipient, optional SMTP mailbox) is untouched and never committed.

## What changed

Before: every form posted to `api/reservierung.php`, which mailed one copy of the
submission to the restaurant (info@restauranthole19.de) and nothing to the guest.
The thank-you page promised a confirmation "in Kürze per E-Mail oder Telefon".

Now, for a **table reservation**, the guest immediately receives:

> **Betreff:** Ihre Reservierung im Restaurant Hole 19 ist bestätigt
>
> Vielen Dank, Anna Müller!
> Ihre Reservierung wurde bestätigt.
> Termin: Samstag, 12.12.2026 · Uhrzeit: 19:00 Uhr · Personen: 4
> Wir freuen uns auf Ihren Besuch! Falls sich etwas ändert, antworten Sie einfach auf diese E-Mail oder rufen Sie uns an: 09303 2090764.
> Vielen Dank
> Ihr Hole 19 Team

sent **from** the restaurant's address (`to` in `config.php`, i.e. info@restauranthole19.de)
with Reply-To the same, as plain text plus a simple HTML version.

Rules:

- The restaurant's own copy is sent first and is unchanged; the guest mail never affects
  the answer the form gets. If it cannot be sent, the reason goes to the PHP error log.
- "Mehr als 10" persons: the form says the restaurant calls back, so the guest gets
  *Ihre Reservierungsanfrage … wir rufen Sie in Kürze an* instead of a confirmation.
- The four Feiern request forms (Firmenfeier, Privatfeier, Weihnachtsfeier, Catering)
  get no automatic mail; those are quotes, not bookings.
- Only date, time, number of persons and the name are echoed back. The free-text
  "Wunsch" stays in the restaurant's copy, a name that looks like a link or slogan is
  left out of the greeting, and at most 5 confirmations per IP and 10 minutes go out,
  so the public endpoint cannot be used to push text into strangers' inboxes.
- Delivery: through the SMTP mailbox in `config.php` when one is set (if that mailbox
  is not info@ and the server refuses the sender, PHP `mail()` with the info@ envelope
  takes over), otherwise PHP `mail()`, as before.

## Deploying

Upload the file to `public_html/api/reservierung.php` (hPanel → Files → File Manager,
or Hostinger's file upload API). Nothing else on the server changes.

## Local test

```bash
cd hole19-site
echo "<?php return ['to'=>'info@example.test'];" > api/config.php     # git-ignored
php -S 127.0.0.1:8101 -d sendmail_path="tee /tmp/hole19-mail.eml >/dev/null"
curl -H 'Accept: application/json' --data 'form-name=reservierung&Anlass=Tischreservierung&Vorname=Anna&Nachname=Müller&E-Mail=anna@example.com&Telefon=1&Personen=4&Datum=2026-12-12&Uhrzeit=19:00' http://127.0.0.1:8101/api/reservierung.php
# -> {"ok":true}; /tmp/hole19-mail.eml holds the last mail written (the guest confirmation)
```
