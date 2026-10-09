<?php
/* Restaurant Hole 19 — the reservation and request mailer.

   Every form on the site (the table reservation and the four Feiern request
   forms) posts here. The fields arrive named as they are labelled on the
   form; they are sent as one mail — a table in HTML, the same rows in plain
   text — to the restaurant, with the guest's address as Reply-To so the
   restaurant can answer with one click.

   A table reservation additionally sends the guest a German confirmation
   ("Vielen Dank, {Name}! Ihre Reservierung wurde bestätigt … Ihr Hole 19
   Team") from the restaurant's own address, right after the restaurant's
   copy went out. See "The guest's confirmation" at the bottom.

   With JavaScript the page posts with `Accept: application/json` and gets
   {"ok":true|false} back; without it the browser lands on the thank-you
   page, or back on the form if the mail could not be sent. */
declare(strict_types=1);

/* The recipient and, optionally, an SMTP mailbox: see api/config.php. */
$CFG = ['to' => 'info@restauranthole19.de', 'smtp_host' => 'smtp.hostinger.com', 'smtp_port' => 465, 'smtp_user' => '', 'smtp_pass' => ''];
ob_start();
$userCfg = @include __DIR__ . '/config.php';
ob_end_clean();
if (is_array($userCfg)) $CFG = array_merge($CFG, $userCfg);
$TO = trim((string)$CFG['to']);
if (filter_var($TO, FILTER_VALIDATE_EMAIL) === false) $TO = 'info@restauranthole19.de';

/* Our own log: the host keeps PHP error logging switched off, so without
   this nothing that goes wrong while sending is recorded anywhere. The log
   is a .php file that exits at once when fetched over HTTP, so the server
   never serves its contents. No passwords are ever written to it. */
$LOG = __DIR__ . '/mailer-log.php';
if (!is_file($LOG)) @file_put_contents($LOG, "<?php exit; ?>\n", LOCK_EX);
@ini_set('log_errors', '1');
@ini_set('error_log', $LOG);
$SMTP_LAST = '';
function logline(string $msg): void { error_log('[hole19] ' . $msg); }

header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

$wantsJson = stripos($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json') !== false;

function finish(bool $ok, int $code, string $redirect, bool $json): void {
  if ($json) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => $ok]);
  } else {
    header('Location: ' . $redirect, true, 303);
  }
  exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  header('Location: /', true, 303);
  exit;
}

$field = static fn(string $k): string => trim((string)($_POST[$k] ?? ''));

/* Which form, and where each outcome lands without JavaScript. */
$form = preg_replace('/[^a-z0-9-]/', '', strtolower($field('form-name')));
if ($form === '') $form = 'reservierung';
$isFeier = strpos($form, 'anfrage-') === 0;
$thanks  = $isFeier ? '/danke-feier.html' : '/danke.html';
$again   = $isFeier ? '/' . substr($form, 8) . '.html#anfrage' : '/#reservieren';

/* Two honeypots (one per delivery path in the JS); a bot that fills either
   is told everything went fine and nothing is sent. */
if ($field('bot-field') !== '' || $field('_gotcha') !== '') finish(true, 200, $thanks, $wantsJson);

/* The same rules the page enforces before it posts. */
$vorname  = $field('Vorname');
$nachname = $field('Nachname');
$email    = $field('E-Mail');
$telefon  = $field('Telefon');
if ($vorname === '' || $nachname === '' || $telefon === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
  finish(false, 400, $again, $wantsJson);
}

/* The rows, in the order of the form. */
$rows = [];
foreach (['Anlass', 'Vorname', 'Nachname', 'E-Mail', 'Telefon', 'Personen', 'Termin', 'Datum', 'Uhrzeit', 'Paket', 'Wunsch', 'Wünsche', 'Loyalty Card'] as $k) {
  $v = $field($k);
  if ($v === '') continue;
  if ($k === 'Loyalty Card') $v = $v === 'ja' ? 'Ja, bitte informieren' : $v;
  $rows[$k] = mb_substr(str_replace(["\r", "\n"], [' ', ' '], $v), 0, $k === 'Wünsche' ? 3000 : 300);
}
if (!isset($rows['Termin']) && isset($rows['Datum'])) $rows['Termin'] = $rows['Datum'];
unset($rows['Datum']);
$rows['Gesendet'] = date('d.m.Y, H:i') . ' Uhr';

$kind = $rows['Anlass'] ?? 'Tischreservierung';
$subject = ($kind === 'Tischreservierung' ? 'Neue Reservierung' : 'Neue Anfrage ' . $kind)
         . (isset($rows['Termin'])   ? ' — ' . $rows['Termin'] : '')
         . (isset($rows['Uhrzeit'])  ? ', ' . $rows['Uhrzeit'] : '')
         . (isset($rows['Personen']) ? ', ' . $rows['Personen'] . ' Personen' : '');

/* Plain text: aligned rows. HTML: a table. */
$text = '';
foreach ($rows as $k => $v) $text .= str_pad($k . ':', 14) . $v . "\n";
$h = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$html = '<!doctype html><html lang="de"><body style="font-family:Helvetica,Arial,sans-serif;color:#1a1a1a">'
      . '<h2 style="font-weight:600;margin:0 0 14px">' . $h($subject) . '</h2>'
      . '<table cellpadding="8" cellspacing="0" style="border-collapse:collapse;border:1px solid #ddd">';
foreach ($rows as $k => $v) {
  $html .= '<tr><th align="left" style="border:1px solid #ddd;background:#f4f1e8;white-space:nowrap">' . $h($k) . '</th>'
         . '<td style="border:1px solid #ddd">' . nl2br($h($v)) . '</td></tr>';
}
$html .= '</table><p style="color:#666;font-size:12px;margin-top:16px">Gesendet über das Formular auf der Website. Antworten geht direkt an den Gast.</p></body></html>';

/* From must be an address at the site's own domain or the host will not
   send it — with SMTP it is the mailbox itself; Reply-To is the guest.
   The guest's address was validated above, so it cannot carry a line
   break into the headers. */
$smtpUser = trim((string)$CFG['smtp_user']);
$useSmtp  = $smtpUser !== '' && filter_var($smtpUser, FILTER_VALIDATE_EMAIL) !== false;
$host = strtolower(preg_replace('/^www\./', '', (string)($_SERVER['HTTP_HOST'] ?? 'restauranthole19.de')));
$host = preg_replace('/[^a-z0-9.-]/', '', $host) ?: 'restauranthole19.de';
$from = $useSmtp ? $smtpUser : "noreply@$host";
$boundary = 'hole19-' . bin2hex(random_bytes(8));
$headers = "From: Restaurant Hole 19 <$from>\r\n"
         . "Reply-To: $email\r\n"
         . "MIME-Version: 1.0\r\n"
         . "Content-Type: multipart/alternative; boundary=\"$boundary\"\r\n"
         . "X-Mailer: hole19-site";
$body = "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n$text\r\n"
      . "--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n$html\r\n"
      . "--$boundary--\r\n";
$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

/* SMTP without a library: implicit TLS on 465, STARTTLS where the server
   offers it, AUTH LOGIN, one recipient. Every step must be answered with
   the expected code or the mail is not sent (and mail() is tried instead). */
function smtp_send(array $c, string $from, string $to, string $subject, string $headers, string $body): bool {
  $port = (int)$c['smtp_port'] ?: 465;
  $hostName = (string)$c['smtp_host'];
  $implicit = $port === 465;
  $sock = @stream_socket_client(($implicit ? 'ssl://' : 'tcp://') . $hostName . ':' . $port, $errno, $errstr, 15);
  if (!$sock) { $GLOBALS['SMTP_LAST'] = 'connect failed: ' . $errno . ' ' . $errstr; return false; }
  stream_set_timeout($sock, 15);
  $read = static function () use ($sock): string {
    $out = '';
    while (($line = fgets($sock, 1024)) !== false) { $out .= $line; if (strlen($line) < 4 || $line[3] !== '-') break; }
    return $out;
  };
  $say = static function (string $cmd, string $want) use ($sock, $read): array {
    fwrite($sock, $cmd . "\r\n");
    $r = $read();
    /* For the log: never the credentials (they travel as bare base64 lines), never the message. */
    $shown = strlen($cmd) > 200 ? 'DATA' : (preg_match('~^[A-Za-z0-9+/=]+$~', $cmd) ? '<credential>' : $cmd);
    $GLOBALS['SMTP_LAST'] = trim($shown . ' -> ' . $r);
    return [strpos($r, $want) === 0, $r];
  };
  if (strpos($read(), '220') !== 0) return false;
  $me = preg_replace('/[^a-z0-9.-]/', '', strtolower((string)($_SERVER['SERVER_NAME'] ?? 'localhost'))) ?: 'localhost';
  [$ok, $ehlo] = $say("EHLO $me", '250');
  if (!$ok) return false;
  if (!$implicit && stripos($ehlo, 'STARTTLS') !== false) {
    if (!$say('STARTTLS', '220')[0]) return false;
    if (!@stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) return false;
    if (!$say("EHLO $me", '250')[0]) return false;
  }
  if (!$say('AUTH LOGIN', '334')[0]) return false;
  if (!$say(base64_encode((string)$c['smtp_user']), '334')[0]) return false;
  if (!$say(base64_encode((string)$c['smtp_pass']), '235')[0]) return false;
  if (!$say("MAIL FROM:<$from>", '250')[0]) return false;
  if (!$say("RCPT TO:<$to>", '250')[0]) return false;
  if (!$say('DATA', '354')[0]) return false;
  $msgId = '<' . bin2hex(random_bytes(12)) . '@' . substr(strrchr($from, '@'), 1) . '>';
  $data = "Date: " . date(DATE_RFC2822) . "\r\nMessage-ID: $msgId\r\nTo: $to\r\nSubject: $subject\r\n" . $headers . "\r\n\r\n" . $body;
  $data = preg_replace('/^\./m', '..', $data);
  if (!$say($data . "\r\n.", '250')[0]) return false;
  $say('QUIT', '221');
  fclose($sock);
  return true;
}

logline('form=' . $form . ' kind=' . $kind . ' ip=' . ($_SERVER['REMOTE_ADDR'] ?? '?') . ' smtp=' . ($useSmtp ? 'yes (' . $smtpUser . ')' : 'no') . ' to=' . $TO . ' guest=' . $email);
$ok = false;
if ($useSmtp) { $ok = smtp_send($CFG, $from, $TO, $encodedSubject, $headers, $body); logline('restaurant copy via SMTP: ' . ($ok ? 'sent' : 'FAILED (' . $SMTP_LAST . ')')); }
if (!$ok)     { $ok = mail($TO, $encodedSubject, $body, $headers); logline('restaurant copy via mail(): ' . ($ok ? 'accepted' : 'FAILED')); }

/* ==========================================================================
   The guest's confirmation.

   Table reservations only — the Feiern forms are requests for a quote, not
   bookings, and a reservation for "mehr als 10" is answered by phone, so
   that one gets an "Anfrage eingegangen, wir rufen an" instead of a
   confirmation. The mail goes out from the restaurant's own address ($TO,
   normally info@restauranthole19.de) and replies land there too.

   Only what the restaurant itself stands behind is echoed to the guest:
   date, time, number of persons and the greeting. The free-text "Wunsch"
   stays in the restaurant's copy, and a "name" that is really a link or a
   slogan is dropped from the greeting, so the public endpoint cannot be
   used to push text into strangers' inboxes. Five confirmations per IP
   and ten minutes at most, for the same reason.

   Whatever happens here never changes the answer to the guest: the
   restaurant's copy has already gone out. Failures are written to the PHP
   error log. */
if ($ok && !$isFeier && $kind === 'Tischreservierung') {
  try {
    if (guest_confirmation_allowed()) {
      $g = guest_confirmation($TO, $vorname, $nachname, $field('Datum'), (string)($rows['Termin'] ?? ''), (string)($rows['Uhrzeit'] ?? ''), (string)($rows['Personen'] ?? ''), isset($rows['Loyalty Card']));
      $gHeaders = "From: Restaurant Hole 19 <$TO>\r\n"
                . "Reply-To: Restaurant Hole 19 <$TO>\r\n"
                . "MIME-Version: 1.0\r\n"
                . "Content-Type: multipart/alternative; boundary=\"{$g['boundary']}\"\r\n"
                . "X-Mailer: hole19-site";
      $sent = false;
      /* Through the SMTP mailbox when there is one; its server may refuse a
         From it does not own, in which case mail() — which may send from
         any address of the domain — takes over. */
      if ($useSmtp) { $sent = smtp_send($CFG, $TO, $email, $g['subject'], $gHeaders, $g['body']); logline('guest confirmation via SMTP from ' . $TO . ': ' . ($sent ? 'sent' : 'FAILED (' . $SMTP_LAST . ')')); }
      if (!$sent)   { $sent = mail($email, $g['subject'], $g['body'], $gHeaders, '-f' . $TO); logline('guest confirmation via mail() -f: ' . ($sent ? 'accepted' : 'FAILED')); }
      if (!$sent)   { $sent = mail($email, $g['subject'], $g['body'], $gHeaders); logline('guest confirmation via mail(): ' . ($sent ? 'accepted' : 'FAILED')); }
    } else {
      logline('guest confirmation skipped (rate limit) for ' . ($_SERVER['REMOTE_ADDR'] ?? '?'));
    }
  } catch (\Throwable $e) {
    logline('guest confirmation failed: ' . $e->getMessage());
  }
} else {
  logline('no guest confirmation: ' . (!$ok ? 'restaurant copy failed' : ($isFeier ? 'Feiern request' : 'kind is ' . $kind)));
}

finish((bool)$ok, $ok ? 200 : 500, $ok ? $thanks : $again, $wantsJson);

/* Builds the guest's mail. Returns subject (MIME-encoded), body and boundary. */
function guest_confirmation(string $restaurant, string $vorname, string $nachname, string $datumIso, string $termin, string $uhrzeit, string $personen, bool $loyalty): array {
  $h = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

  /* The greeting — but only with a name that looks like one. */
  $name = trim(preg_replace('/\s+/u', ' ', $vorname . ' ' . $nachname));
  if (!preg_match('/^[\p{L}\p{M}\s\'’.\-]{1,80}$/u', $name) || preg_match('/\p{L}\.\p{L}{2,}/u', $name)) $name = '';
  $greeting = $name === '' ? 'Vielen Dank!' : 'Vielen Dank, ' . $name . '!';

  /* The date, as "Samstag, 5.12.2026": from the ISO value of the date
     field, or from "Termin" when it already has exactly that shape. */
  $days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  $date = '';
  if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $datumIso, $m) && checkdate((int)$m[2], (int)$m[3], (int)$m[1])) {
    $ts = mktime(12, 0, 0, (int)$m[2], (int)$m[3], (int)$m[1]);
    $date = $days[(int)date('N', $ts) - 1] . ', ' . (int)$m[3] . '.' . (int)$m[2] . '.' . $m[1];
  } elseif (preg_match('/^\p{L}+, \d{1,2}\.\d{1,2}\.\d{4}$/u', $termin)) {
    $date = $termin;
  }
  $time = preg_match('/^([01]?\d|2[0-3]):[0-5]\d$/', $uhrzeit) ? $uhrzeit . ' Uhr' : '';
  $count = preg_match('/^\d{1,2}$/', $personen) ? (string)(int)$personen : '';
  $callback = $count === '' && stripos($personen, 'mehr') !== false; // "mehr als 10 — wir rufen zurück"

  if ($callback) {
    $subject = 'Ihre Reservierungsanfrage im Restaurant Hole 19';
    $lead    = 'Ihre Anfrage für mehr als 10 Personen ist bei uns eingegangen. Wir rufen Sie in Kürze an, um die Details zu besprechen.';
    $closing = 'Wir freuen uns auf Sie!';
  } else {
    $subject = 'Ihre Reservierung im Restaurant Hole 19 ist bestätigt';
    $lead    = 'Ihre Reservierung wurde bestätigt.';
    $closing = 'Wir freuen uns auf Ihren Besuch!';
  }

  $overview = $callback ? 'Ihre Anfrage im Überblick:' : 'Ihre Reservierung im Überblick:';
  $details = [];
  if ($date  !== '') $details['Termin']   = $date;
  if ($time  !== '') $details['Uhrzeit']  = $time;
  if ($count !== '') $details['Personen'] = $count;
  elseif ($callback) $details['Personen'] = 'mehr als 10';

  $changes = 'Falls sich etwas ändert, antworten Sie einfach auf diese E-Mail oder rufen Sie uns an: 09303 2090764.';
  $bonus   = $loyalty ? 'Sie stehen auf der Liste für die Loyalty Card — wir melden uns, sobald es losgeht.' : '';
  $footer  = ['Restaurant Hole 19 · Lailachweg 1 · 97318 Kitzingen', 'Tel. 09303 2090764 · ' . $restaurant . ' · www.restauranthole19.de'];

  /* Plain text. */
  $text = $greeting . "\n\n" . $lead . "\n";
  if ($details) {
    $text .= "\n" . $overview . "\n";
    foreach ($details as $k => $v) $text .= str_pad($k . ':', 10) . $v . "\n";
  }
  $text .= "\n" . $closing . "\n" . $changes . "\n";
  if ($bonus !== '') $text .= "\n" . $bonus . "\n";
  $text .= "\nVielen Dank\nIhr Hole 19 Team\n\n" . implode("\n", $footer) . "\n";

  /* HTML, inline styles only, same text. */
  $rowsHtml = '';
  foreach ($details as $k => $v) {
    $rowsHtml .= '<tr><td style="padding:6px 18px 6px 0;color:#5f6b5a;font-size:15px;white-space:nowrap">' . $h($k) . '</td>'
               . '<td style="padding:6px 0;color:#1a1a1a;font-size:15px;font-weight:600">' . $h($v) . '</td></tr>';
  }
  $html = '<!doctype html><html lang="de"><head><meta charset="utf-8"><title>' . $h($subject) . '</title></head>'
        . '<body style="margin:0;padding:0;background:#f3f5f1;font-family:Helvetica,Arial,sans-serif">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f1;padding:24px 12px"><tr><td align="center">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">'
        . '<tr><td style="background:#08160e;padding:20px 28px;color:#e9d9a8;font-size:20px;font-weight:700;letter-spacing:.3px">Restaurant Hole 19</td></tr>'
        . '<tr><td style="padding:28px;color:#1a1a1a;font-size:16px;line-height:1.55">'
        . '<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">' . $h($greeting) . '</h1>'
        . '<p style="margin:0 0 12px">' . $h($lead) . '</p>'
        . ($details ? '<p style="margin:16px 0 4px">' . $h($overview) . '</p><table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px">' . $rowsHtml . '</table>' : '')
        . '<p style="margin:16px 0 4px">' . $h($closing) . '</p>'
        . '<p style="margin:0 0 16px;color:#5f6b5a;font-size:14px">' . $h($changes) . '</p>'
        . ($bonus !== '' ? '<p style="margin:0 0 16px;color:#5f6b5a;font-size:14px">' . $h($bonus) . '</p>' : '')
        . '<p style="margin:0">Vielen Dank<br><strong>Ihr Hole 19 Team</strong></p>'
        . '</td></tr>'
        . '<tr><td style="padding:16px 28px 24px;color:#7a847a;font-size:13px;line-height:1.5;border-top:1px solid #e6eae3">' . $h($footer[0]) . '<br>' . $h($footer[1]) . '</td></tr>'
        . '</table></td></tr></table></body></html>';

  $boundary = 'hole19g-' . bin2hex(random_bytes(8));
  $body = "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n$text\r\n"
        . "--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n$html\r\n"
        . "--$boundary--\r\n";
  return ['subject' => '=?UTF-8?B?' . base64_encode($subject) . '?=', 'body' => $body, 'boundary' => $boundary];
}

/* At most five guest confirmations per IP in ten minutes, counted in a
   small file in the temp dir under an exclusive lock. Fails open. */
function guest_confirmation_allowed(int $limit = 5, int $window = 600): bool {
  $ip = (string)($_SERVER['REMOTE_ADDR'] ?? '');
  if ($ip === '') return true;
  $file = rtrim(sys_get_temp_dir(), '/') . '/hole19-confirm-' . hash('sha256', $ip) . '.json';
  $now  = time();
  $fp = @fopen($file, 'c+');
  if (!$fp) return true;
  if (!flock($fp, LOCK_EX)) { fclose($fp); return true; }
  $hits = json_decode((string)stream_get_contents($fp), true);
  $hits = is_array($hits) ? array_values(array_filter($hits, static fn($t) => is_int($t) && $t > $now - $window)) : [];
  $allowed = count($hits) < $limit;
  if ($allowed) {
    $hits[] = $now;
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, (string)json_encode($hits));
    fflush($fp);
  }
  flock($fp, LOCK_UN);
  fclose($fp);
  return $allowed;
}
