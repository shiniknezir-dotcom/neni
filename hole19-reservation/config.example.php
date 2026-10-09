<?php
/**
 * Hole 19 reservation mailer — configuration.
 *
 * Copy this file to config.php on the server and fill in the values.
 * config.php is git-ignored so the mailbox password never ends up in the repo.
 */
return [
    // ---- Sender (the address guests see) ------------------------------------
    // Must be a mailbox that exists on your domain, e.g. info@hole19.at.
    'from_email'   => 'info@YOUR-DOMAIN.TLD',
    'from_name'    => 'Hole 19',

    // ---- Where new reservations are announced --------------------------------
    // The team gets one e-mail per reservation with all details. Set to '' to disable.
    'notify_email' => 'info@YOUR-DOMAIN.TLD',

    // ---- SMTP (recommended: authenticated sending from the info@ mailbox) ----
    // Hostinger: host smtp.hostinger.com, port 465, secure 'ssl'
    //            (or port 587 with secure 'tls'). User = full mailbox address.
    // Leave smtp_password empty to fall back to PHP's built-in mail(). Hostinger caps that
    // path at 10 e-mails/minute and 100/day per account (2 per reservation), then disables
    // it temporarily — fine for testing, set the password for production.
    'smtp_host'     => 'smtp.hostinger.com',
    'smtp_port'     => 465,
    'smtp_secure'   => 'ssl',          // 'ssl' (465), 'tls' (587) or '' (none, local testing only)
    'smtp_user'     => 'info@YOUR-DOMAIN.TLD',
    'smtp_password' => '',

    // ---- Wording ---------------------------------------------------------------
    // 'Sie' = formal (default for a restaurant), 'du' = casual.
    'address_form'  => 'Sie',
    'business_name' => 'Hole 19',
    'team_signature'=> 'Hole 19 Team',
    // Optional footer lines (address, phone). Leave empty to omit.
    'footer_lines'  => [
        // 'Hole 19 · Musterstraße 1 · 1010 Wien',
        // 'Tel. +43 1 234 56 78',
    ],

    // ---- Form behaviour -------------------------------------------------------
    // After a classic (non-JavaScript) form post, redirect here. '' = show a plain message.
    'redirect_after_success' => '',
    // Only accept posts from these origins (empty array = accept any). Example:
    // ['https://hole19.at', 'https://www.hole19.at']
    'allowed_origins' => [],
    // Name of the hidden honeypot field in the form (bots fill it, humans don't).
    'honeypot_field'  => 'website',
    // Besides name and e-mail, which fields must be filled in? Any of: phone, date, time, guests, message.
    'required_fields' => ['date', 'time', 'guests'],
    // Used to reject dates in the past.
    'timezone'        => 'Europe/Vienna',
];
