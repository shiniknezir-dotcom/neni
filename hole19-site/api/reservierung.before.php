<?php
/* Restaurant Hole 19 — the reservation and request mailer.

   Every form on the site (the table reservation and the four Feiern request
   forms) posts here. The fields arrive named as they are labelled on the
   form; they are sent as one mail — a table in HTML, the same rows in plain
   text — to the restaurant, with the guest's address as Reply-To so the
   restaurant can answer with one click.

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
  if (!$sock) return false;
  stream_set_timeout($sock, 15);
  $read = static function () use ($sock): string {
    $out = '';
    while (($line = fgets($sock, 1024)) !== false) { $out .= $line; if (strlen($line) < 4 || $line[3] !== '-') break; }
    return $out;
  };
  $say = static function (string $cmd, string $want) use ($sock, $read): array {
    fwrite($sock, $cmd . "\r\n");
    $r = $read();
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

$ok = false;
if ($useSmtp) $ok = smtp_send($CFG, $from, $TO, $encodedSubject, $headers, $body);
if (!$ok)     $ok = @mail($TO, $encodedSubject, $body, $headers);
finish((bool)$ok, $ok ? 200 : 500, $ok ? $thanks : $again, $wantsJson);
