<?php
/**
 * E-mail wording for the Hole 19 reservation mailer (German).
 *
 * Each builder returns ['subject' => string, 'text' => string, 'html' => string].
 * $r is the sanitised reservation array from reserve.php:
 *   name, email, phone, date, time, guests, message   (all strings, possibly '')
 */

function h(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Formal (Sie) or casual (du) phrases, chosen by config 'address_form'. */
function wording(array $cfg): array
{
    $business = (string) ($cfg['business_name'] ?? 'Hole 19');
    $team     = (string) ($cfg['team_signature'] ?? 'Hole 19 Team');
    $casual   = strtolower((string) ($cfg['address_form'] ?? 'Sie')) === 'du';

    if ($casual) {
        return [
            'subject'   => 'Deine Reservierung bei ' . $business . ' ist bestätigt',
            'greeting'  => 'Vielen Dank, %s!',
            'confirmed' => 'Deine Reservierung wurde bestätigt.',
            'overview'  => 'Deine Reservierung im Überblick:',
            'closing'   => 'Wir freuen uns auf deinen Besuch!',
            'changes'   => 'Falls sich etwas ändert, antworte einfach auf diese E-Mail.',
            'thanks'    => 'Vielen Dank,',
            'signoff'   => 'Dein ' . $team,
        ];
    }

    return [
        'subject'   => 'Ihre Reservierung bei ' . $business . ' ist bestätigt',
        'greeting'  => 'Vielen Dank, %s!',
        'confirmed' => 'Ihre Reservierung wurde bestätigt.',
        'overview'  => 'Ihre Reservierung im Überblick:',
        'closing'   => 'Wir freuen uns auf Ihren Besuch!',
        'changes'   => 'Falls sich etwas ändert, antworten Sie einfach auf diese E-Mail.',
        'thanks'    => 'Vielen Dank,',
        'signoff'   => 'Ihr ' . $team,
    ];
}

/** 2026-10-12 -> 12.10.2026 (anything else is returned unchanged). */
function format_date_de(string $date): string
{
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $date, $m)) {
        return $m[3] . '.' . $m[2] . '.' . $m[1];
    }
    return $date;
}

/** 19:30 -> 19:30 Uhr */
function format_time_de(string $time): string
{
    return $time === '' ? '' : $time . ' Uhr';
}

/** 1 -> "1 Person", 4 -> "4 Personen" */
function format_guests_de(string $guests): string
{
    if ($guests === '') {
        return '';
    }
    return $guests . ((int) $guests === 1 ? ' Person' : ' Personen');
}

/**
 * Rows shown in the guest confirmation. Only filled fields appear.
 * The free-text message is deliberately NOT echoed back to the guest
 * (keeps the public endpoint useless as a spam relay); the team sees it.
 */
function guest_detail_rows(array $r): array
{
    $rows = [];
    if ($r['date'] !== '')   { $rows['Datum']    = format_date_de($r['date']); }
    if ($r['time'] !== '')   { $rows['Uhrzeit']  = format_time_de($r['time']); }
    if ($r['guests'] !== '') { $rows['Personen'] = $r['guests']; }
    return $rows;
}

/** All fields, for the team. */
function team_detail_rows(array $r): array
{
    $rows = [
        'Name'     => $r['name'],
        'E-Mail'   => $r['email'],
        'Telefon'  => $r['phone'],
        'Datum'    => format_date_de($r['date']),
        'Uhrzeit'  => format_time_de($r['time']),
        'Personen' => $r['guests'],
        'Nachricht'=> $r['message'],
    ];
    return array_filter($rows, static function ($v) { return $v !== ''; });
}

function rows_as_text(array $rows): string
{
    $out = '';
    foreach ($rows as $label => $value) {
        $out .= $label . ': ' . $value . "\n";
    }
    return $out;
}

function rows_as_html(array $rows): string
{
    if (!$rows) {
        return '';
    }
    $out = '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">';
    foreach ($rows as $label => $value) {
        $out .= '<tr>'
              . '<td style="padding:6px 16px 6px 0;color:#5f6b5a;font-size:15px;white-space:nowrap;vertical-align:top;">' . h($label) . '</td>'
              . '<td style="padding:6px 0;color:#1d241b;font-size:15px;font-weight:600;vertical-align:top;">' . nl2br(h($value)) . '</td>'
              . '</tr>';
    }
    return $out . '</table>';
}

/** Shared HTML frame so both e-mails look like they come from the same place. */
function html_frame(array $cfg, string $headline, string $bodyHtml): string
{
    $business = h((string) ($cfg['business_name'] ?? 'Hole 19'));
    $footer   = '';
    foreach ((array) ($cfg['footer_lines'] ?? []) as $line) {
        if ($line !== '') {
            $footer .= '<div>' . h((string) $line) . '</div>';
        }
    }
    return '<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width,initial-scale=1"><title>' . h($headline) . '</title></head>'
        . '<body style="margin:0;padding:0;background:#f3f5f1;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f1;padding:24px 12px;"><tr><td align="center">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">'
        . '<tr><td style="background:#1f4d2e;padding:20px 28px;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.3px;">' . $business . '</td></tr>'
        . '<tr><td style="padding:28px;color:#1d241b;font-size:16px;line-height:1.55;">'
        . '<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#1d241b;">' . h($headline) . '</h1>'
        . $bodyHtml
        . '</td></tr>'
        . ($footer !== '' ? '<tr><td style="padding:16px 28px 24px;color:#7a847a;font-size:13px;line-height:1.5;border-top:1px solid #e6eae3;">' . $footer . '</td></tr>' : '')
        . '</table></td></tr></table></body></html>';
}

/** The e-mail the guest receives. */
function build_guest_confirmation(array $cfg, array $r): array
{
    $w    = wording($cfg);
    $rows = guest_detail_rows($r);
    $greeting = sprintf($w['greeting'], $r['name']);

    $text = $greeting . "\n\n"
          . $w['confirmed'] . "\n";
    if ($rows) {
        $text .= "\n" . $w['overview'] . "\n" . rows_as_text($rows);
    }
    $text .= "\n" . $w['closing'] . "\n"
           . $w['changes'] . "\n\n"
           . $w['thanks'] . "\n"
           . $w['signoff'] . "\n";
    foreach ((array) ($cfg['footer_lines'] ?? []) as $line) {
        if ($line !== '') {
            $text .= "\n" . $line;
        }
    }

    $body = '<p style="margin:0 0 12px;">' . h($w['confirmed']) . '</p>';
    if ($rows) {
        $body .= '<p style="margin:16px 0 4px;">' . h($w['overview']) . '</p>' . rows_as_html($rows);
    }
    $body .= '<p style="margin:16px 0 4px;">' . h($w['closing']) . '</p>'
           . '<p style="margin:0 0 20px;color:#5f6b5a;font-size:14px;">' . h($w['changes']) . '</p>'
           . '<p style="margin:0;">' . h($w['thanks']) . '<br><strong>' . h($w['signoff']) . '</strong></p>';

    return [
        'subject' => $w['subject'],
        'text'    => $text,
        'html'    => html_frame($cfg, $greeting, $body),
    ];
}

/** The e-mail the team receives. */
function build_team_notification(array $cfg, array $r): array
{
    $rows  = team_detail_rows($r);
    $when  = trim(format_date_de($r['date']) . ' ' . $r['time']);
    $parts = array_filter([$r['name'], $when, format_guests_de($r['guests'])], static function ($v) { return $v !== ''; });
    $subject = 'Neue Reservierung: ' . implode(' · ', $parts);

    $text = "Neue Reservierung über die Website\n\n"
          . rows_as_text($rows)
          . "\nAntworten auf diese E-Mail gehen direkt an den Gast.\n";

    $body = '<p style="margin:0 0 4px;">Über das Reservierungsformular ist gerade eine neue Anfrage eingegangen. Der Gast hat bereits eine Bestätigung erhalten.</p>'
          . rows_as_html($rows)
          . '<p style="margin:0;color:#5f6b5a;font-size:14px;">Antworten auf diese E-Mail gehen direkt an den Gast.</p>';

    return [
        'subject' => $subject,
        'text'    => $text,
        'html'    => html_frame($cfg, 'Neue Reservierung', $body),
    ];
}
