<?php
/**
 * Hole 19 — reservation form endpoint.
 *
 * Point your reservation form at this file (method="post"). On a valid
 * submission it e-mails the guest a German confirmation from the info@
 * address and notifies the team. Works with a classic HTML form post and
 * with a JavaScript fetch() that sends JSON or form data.
 *
 * Fields: name, email, phone, date (YYYY-MM-DD or DD.MM.YYYY), time (HH:MM),
 * guests (1-99), message. Which ones are required is set in config.php
 * ('required_fields'; name and email always are).
 */

declare(strict_types=1);

header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

require_once __DIR__ . '/templates.php';
require_once __DIR__ . '/mailer.php';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    respond(500, ['ok' => false, 'error' => 'Serverkonfiguration fehlt (config.php).'], 'Konfiguration fehlt: Bitte config.example.php nach config.php kopieren und ausfüllen.');
}
$cfg    = require $configFile;
$CASUAL = strtolower((string) ($cfg['address_form'] ?? 'Sie')) === 'du';

$tz = (string) ($cfg['timezone'] ?? 'Europe/Vienna');
if ($tz !== '' && in_array($tz, timezone_identifiers_list(), true)) {
    date_default_timezone_set($tz);
}

if (empty($cfg['smtp_password'])) {
    error_log('[hole19-reservation] running without SMTP: using PHP mail() fallback (Hostinger caps this at 10/min and 100/day per account).');
}

// ---------------------------------------------------------------------------
// Request guards
// ---------------------------------------------------------------------------
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'error' => 'Nur POST erlaubt.'], 'Dieses Skript nimmt nur Formulardaten per POST entgegen.');
}

if (!origin_allowed($cfg)) {
    respond(403, ['ok' => false, 'error' => ui('origin')], ui('origin'));
}

$input = read_input();

// Honeypot: bots fill the hidden field, humans never see it. Pretend success, send nothing.
$honeypot = (string) ($cfg['honeypot_field'] ?? 'website');
if ($honeypot !== '' && array_key_exists($honeypot, $input)) {
    $hp = $input[$honeypot];
    if (is_array($hp) || trim((string) $hp) !== '') {
        error_log('[hole19-reservation] honeypot filled from ' . ($_SERVER['REMOTE_ADDR'] ?? '?') . ' — request discarded (if real guests report missing mails, check the form hides the "' . $honeypot . '" field).');
        respond_success($cfg);
    }
}

// ---------------------------------------------------------------------------
// Sanitise + validate
// ---------------------------------------------------------------------------
$r = [
    'name'    => clean_text($input['name']    ?? '', 60),
    'email'   => clean_text($input['email']   ?? '', 254),
    'phone'   => clean_text($input['phone']   ?? '', 40),
    'date'    => clean_text($input['date']    ?? '', 20),
    'time'    => clean_text($input['time']    ?? '', 10),
    'guests'  => clean_text($input['guests']  ?? '', 4),
    'message' => clean_text($input['message'] ?? '', 1000, true),
];

$required = array_unique(array_merge(['name', 'email'], array_map('strval', (array) ($cfg['required_fields'] ?? []))));
$errors   = [];

foreach (['phone', 'date', 'time', 'guests', 'message'] as $field) {
    if (in_array($field, $required, true) && $r[$field] === '') {
        $errors[$field] = ui('req_' . $field);
    }
}

// Name: letters (any script), spaces, apostrophes, periods and hyphens only — no digits,
// links or domain-like tokens. The name is the only visitor text that reaches the guest's
// inbox under the restaurant's sender address, so it must not be usable for spam.
if (mb_strlen($r['name']) < 2) {
    $errors['name'] = ui('err_name');
} elseif (!preg_match('/^[\p{L}\p{M}\s\'’.\-]{2,60}$/u', $r['name']) || preg_match('/\p{L}\.\p{L}{2,}/u', $r['name'])) {
    $errors['name'] = ui('err_name_chars');
}

if ($r['email'] === '' || filter_var($r['email'], FILTER_VALIDATE_EMAIL) === false) {
    $errors['email'] = ui('err_email');
}

if ($r['date'] !== '' && !isset($errors['date'])) {
    $normalised = normalise_date($r['date']);
    if ($normalised === null) {
        $errors['date'] = ui('err_date');
    } elseif ($normalised < date('Y-m-d')) {
        $errors['date'] = ui('err_date_past');
    } else {
        $r['date'] = $normalised;
    }
}

if ($r['time'] !== '' && !isset($errors['time'])) {
    $normalised = normalise_time($r['time']);
    if ($normalised === null) {
        $errors['time'] = ui('err_time');
    } else {
        $r['time'] = $normalised;
    }
}

if ($r['guests'] !== '' && !isset($errors['guests'])) {
    if (!preg_match('/^\d{1,2}$/', $r['guests']) || (int) $r['guests'] < 1) {
        $errors['guests'] = ui('err_guests');
    } else {
        $r['guests'] = (string) (int) $r['guests'];
    }
}

if ($errors) {
    respond(422, ['ok' => false, 'errors' => $errors], ui('check_input'), array_values($errors));
}

// Only valid submissions count towards the limit, so a guest fixing typos is never locked out.
if (!rate_limit_ok()) {
    respond(429, ['ok' => false, 'error' => ui('too_many')], ui('too_many'));
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------
$guestMail = build_guest_confirmation($cfg, $r);
$sent = send_mail($cfg, $r['email'], $r['name'], $guestMail['subject'], $guestMail['html'], $guestMail['text']);

if (!$sent) {
    respond(500, ['ok' => false, 'error' => ui('send_failed')], ui('send_failed'));
}

$notify = trim((string) ($cfg['notify_email'] ?? ''));
if ($notify !== '') {
    $teamMail = build_team_notification($cfg, $r);
    // A failure here must not break the guest's experience; send_mail() logs it.
    send_mail($cfg, $notify, (string) ($cfg['team_signature'] ?? 'Team'), $teamMail['subject'], $teamMail['html'], $teamMail['text'], $r['email'], $r['name']);
}

respond_success($cfg);

// ===========================================================================
// Helpers
// ===========================================================================

/** Accepts application/json (up to 64 KB), form-encoded and multipart bodies. */
function read_input(): array
{
    $type = (string) ($_SERVER['CONTENT_TYPE'] ?? '');
    if (stripos($type, 'application/json') !== false) {
        $raw = (string) file_get_contents('php://input', false, null, 0, 65537);
        if (strlen($raw) > 65536) {
            return [];
        }
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }
    return $_POST;
}

/** Trim, drop control characters, cap length. Newlines survive only when $multiline. */
function clean_text($value, int $max, bool $multiline = false): string
{
    if (is_array($value) || is_object($value)) {
        return '';
    }
    $s = (string) $value;
    if (!mb_check_encoding($s, 'UTF-8')) {
        $s = (string) mb_convert_encoding($s, 'UTF-8', 'UTF-8');
    }
    $s = $multiline
        ? preg_replace('/[^\P{C}\n]+/u', '', str_replace("\r\n", "\n", $s))
        : preg_replace('/\p{C}+/u', '', $s);
    $s = trim(preg_replace('/[ \t]+/', ' ', (string) $s));
    return mb_substr($s, 0, $max);
}

/** Returns YYYY-MM-DD for YYYY-MM-DD or DD.MM.YYYY input, null if invalid. */
function normalise_date(string $date): ?string
{
    if (preg_match('/^(\d{4})-(\d{1,2})-(\d{1,2})$/', $date, $m)) {
        [$y, $mo, $d] = [(int) $m[1], (int) $m[2], (int) $m[3]];
    } elseif (preg_match('/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/', $date, $m)) {
        [$d, $mo, $y] = [(int) $m[1], (int) $m[2], (int) $m[3]];
    } else {
        return null;
    }
    if (!checkdate($mo, $d, $y)) {
        return null;
    }
    return sprintf('%04d-%02d-%02d', $y, $mo, $d);
}

/** Returns HH:MM for "19:30", "7:30", "19.30", "1930" or "19:30 Uhr", null if invalid. */
function normalise_time(string $time): ?string
{
    $t = strtolower(trim($time));
    $t = trim((string) preg_replace('/\s*uhr$/u', '', $t));
    if (preg_match('/^(\d{1,2})[:.](\d{2})$/', $t, $m) || preg_match('/^(\d{2})(\d{2})$/', $t, $m)) {
        $h = (int) $m[1];
        $i = (int) $m[2];
        if ($h <= 23 && $i <= 59) {
            return sprintf('%02d:%02d', $h, $i);
        }
    }
    return null;
}

/** Optional same-site check based on Origin / Referer. */
function origin_allowed(array $cfg): bool
{
    $allowed = array_values(array_filter(array_map('strval', (array) ($cfg['allowed_origins'] ?? []))));
    if (!$allowed) {
        return true;
    }
    $source = (string) ($_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '');
    if ($source === '') {
        return false;
    }
    $parts = parse_url($source);
    if (!$parts || empty($parts['host'])) {
        return false;
    }
    $sourceOrigin = strtolower(($parts['scheme'] ?? 'https') . '://' . $parts['host'] . (isset($parts['port']) ? ':' . $parts['port'] : ''));
    foreach ($allowed as $o) {
        if (strtolower(rtrim($o, '/')) === $sourceOrigin) {
            return true;
        }
    }
    return false;
}

/**
 * At most $limit accepted submissions per IP per $window seconds, tracked in a
 * small file in the temp dir. Read-modify-write happens under one exclusive
 * lock so parallel requests cannot slip past. Fails open if the dir is unusable.
 */
function rate_limit_ok(int $limit = 5, int $window = 600): bool
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    if ($ip === '') {
        return true;
    }
    $file = rtrim(sys_get_temp_dir(), '/') . '/hole19-rl-' . hash('sha256', $ip) . '.json';
    $now  = time();

    $fp = @fopen($file, 'c+'); // create if missing, never truncate on open
    if (!$fp) {
        return true;
    }
    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        return true;
    }
    $hits = json_decode((string) stream_get_contents($fp), true);
    $hits = is_array($hits) ? array_values(array_filter($hits, static function ($t) use ($now, $window) {
        return is_int($t) && $t > $now - $window;
    })) : [];
    $ok = count($hits) < $limit;
    if ($ok) {
        $hits[] = $now;
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, (string) json_encode($hits));
        fflush($fp);
    }
    flock($fp, LOCK_UN);
    fclose($fp);
    return $ok;
}

/** Visitor-facing strings, formal (Sie) or casual (du) depending on config. */
function ui(string $key): string
{
    global $CASUAL;
    static $t = [
        'Sie' => [
            'too_many'       => 'Zu viele Anfragen. Bitte versuchen Sie es in ein paar Minuten erneut.',
            'origin'         => 'Diese Anfrage kann von hier aus nicht gesendet werden. Bitte nutzen Sie das Formular auf unserer Website.',
            'err_name'       => 'Bitte geben Sie Ihren Namen an.',
            'err_name_chars' => 'Bitte geben Sie nur Ihren Namen an (Buchstaben, Leerzeichen, Bindestrich).',
            'err_email'      => 'Bitte geben Sie eine gültige E-Mail-Adresse an.',
            'err_date'       => 'Bitte geben Sie ein gültiges Datum an.',
            'err_date_past'  => 'Bitte wählen Sie ein Datum in der Zukunft.',
            'err_time'       => 'Bitte geben Sie eine gültige Uhrzeit an (z. B. 19:30).',
            'err_guests'     => 'Bitte geben Sie die Personenzahl an (1–99).',
            'req_phone'      => 'Bitte geben Sie Ihre Telefonnummer an.',
            'req_date'       => 'Bitte wählen Sie ein Datum.',
            'req_time'       => 'Bitte wählen Sie eine Uhrzeit.',
            'req_guests'     => 'Bitte geben Sie die Personenzahl an.',
            'req_message'    => 'Bitte schreiben Sie uns eine kurze Nachricht.',
            'check_input'    => 'Bitte prüfen Sie Ihre Eingaben:',
            'send_failed'    => 'Die Bestätigung konnte gerade nicht gesendet werden. Bitte versuchen Sie es später erneut oder rufen Sie uns an.',
            'success'        => 'Vielen Dank! Ihre Reservierung wurde bestätigt. Sie erhalten in Kürze eine E-Mail.',
            'success_page'   => 'Ihre Reservierung wurde bestätigt. Sie erhalten in Kürze eine Bestätigung per E-Mail.',
            'back'           => 'Zurück zum Formular',
        ],
        'du' => [
            'too_many'       => 'Zu viele Anfragen. Bitte versuch es in ein paar Minuten noch einmal.',
            'origin'         => 'Diese Anfrage kann von hier aus nicht gesendet werden. Bitte nutz das Formular auf unserer Website.',
            'err_name'       => 'Bitte gib deinen Namen an.',
            'err_name_chars' => 'Bitte gib nur deinen Namen an (Buchstaben, Leerzeichen, Bindestrich).',
            'err_email'      => 'Bitte gib eine gültige E-Mail-Adresse an.',
            'err_date'       => 'Bitte gib ein gültiges Datum an.',
            'err_date_past'  => 'Bitte wähl ein Datum in der Zukunft.',
            'err_time'       => 'Bitte gib eine gültige Uhrzeit an (z. B. 19:30).',
            'err_guests'     => 'Bitte gib die Personenzahl an (1–99).',
            'req_phone'      => 'Bitte gib deine Telefonnummer an.',
            'req_date'       => 'Bitte wähl ein Datum.',
            'req_time'       => 'Bitte wähl eine Uhrzeit.',
            'req_guests'     => 'Bitte gib die Personenzahl an.',
            'req_message'    => 'Bitte schreib uns eine kurze Nachricht.',
            'check_input'    => 'Bitte prüf deine Eingaben:',
            'send_failed'    => 'Die Bestätigung konnte gerade nicht gesendet werden. Bitte versuch es später noch einmal oder ruf uns an.',
            'success'        => 'Vielen Dank! Deine Reservierung wurde bestätigt. Du erhältst in Kürze eine E-Mail.',
            'success_page'   => 'Deine Reservierung wurde bestätigt. Du erhältst in Kürze eine Bestätigung per E-Mail.',
            'back'           => 'Zurück zum Formular',
        ],
    ];
    return $t[$CASUAL ? 'du' : 'Sie'][$key] ?? $key;
}

/** True when the caller is a fetch()/XHR that wants JSON back. */
function wants_json(): bool
{
    $accept = (string) ($_SERVER['HTTP_ACCEPT'] ?? '');
    $xrw    = (string) ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '');
    $type   = (string) ($_SERVER['CONTENT_TYPE'] ?? '');
    return stripos($accept, 'application/json') !== false
        || strcasecmp($xrw, 'XMLHttpRequest') === 0
        || stripos($type, 'application/json') !== false;
}

/**
 * JSON for fetch() callers, a small German HTML page for classic form posts.
 * $items (optional) are rendered as a list under the message.
 */
function respond(int $status, array $json, string $humanMessage, array $items = []): void
{
    http_response_code($status);
    if (wants_json()) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($json, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    // Link back to the page the form was on; fall back to history.back() when unknown.
    $ref  = (string) ($_SERVER['HTTP_REFERER'] ?? '');
    $back = preg_match('~^https?://~i', $ref) ? $ref : 'javascript:history.back()';
    $list = '';
    if ($items) {
        $list = '<ul style="text-align:left;display:inline-block;margin:0 0 16px;padding-left:20px;font-size:16px;line-height:1.6">';
        foreach ($items as $item) {
            $list .= '<li>' . h((string) $item) . '</li>';
        }
        $list .= '</ul>';
    }

    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reservierung</title>'
       . '<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#f3f5f1;color:#1d241b;margin:0;padding:40px 16px;text-align:center}'
       . 'main{max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px 24px}h1{font-size:22px;margin:0 0 12px;color:#1f4d2e}p{font-size:16px;line-height:1.5;margin:0 0 16px}a{color:#1f4d2e}</style></head>'
       . '<body><main><h1>' . ($status < 400 ? 'Vielen Dank!' : 'Das hat leider nicht geklappt') . '</h1><p>' . h($humanMessage) . '</p>' . $list
       . '<p><a href="' . h($back) . '">' . h(function_exists('ui') ? ui('back') : 'Zurück') . '</a></p></main></body></html>';
    exit;
}

function respond_success(array $cfg): void
{
    $redirect = trim((string) ($cfg['redirect_after_success'] ?? ''));
    if (!wants_json() && $redirect !== '') {
        http_response_code(303);
        header('Location: ' . $redirect);
        exit;
    }
    respond(200, ['ok' => true, 'message' => ui('success')], ui('success_page'));
}
