<?php
/**
 * Hole 19 — reservation form endpoint.
 *
 * Point your reservation form at this file (method="post"). On a valid
 * submission it e-mails the guest a German confirmation from the info@
 * address and notifies the team. Works with a classic HTML form post and
 * with a JavaScript fetch() that sends JSON or form data.
 *
 * Expected fields (only name and email are required):
 *   name, email, phone, date (YYYY-MM-DD or DD.MM.YYYY), time (HH:MM),
 *   guests (1-99), message
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
$cfg = require $configFile;
$CASUAL = strtolower((string) ($cfg['address_form'] ?? 'Sie')) === 'du';

// ---------------------------------------------------------------------------
// Request guards
// ---------------------------------------------------------------------------
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'error' => 'Nur POST erlaubt.'], 'Dieses Skript nimmt nur Formulardaten per POST entgegen.');
}

if (!origin_allowed($cfg)) {
    respond(403, ['ok' => false, 'error' => 'Anfrage von dieser Herkunft nicht erlaubt.'], 'Anfrage von dieser Herkunft nicht erlaubt.');
}

$input = read_input();

// Honeypot: bots fill the hidden field, humans never see it. Pretend success.
$honeypot = (string) ($cfg['honeypot_field'] ?? 'website');
if ($honeypot !== '' && trim((string) ($input[$honeypot] ?? '')) !== '') {
    respond_success($cfg);
}

if (!rate_limit_ok()) {
    respond(429, ['ok' => false, 'error' => ui('too_many')], ui('too_many'));
}

// ---------------------------------------------------------------------------
// Sanitise + validate
// ---------------------------------------------------------------------------
$r = [
    'name'    => clean_text($input['name']    ?? '', 100),
    'email'   => clean_text($input['email']   ?? '', 254),
    'phone'   => clean_text($input['phone']   ?? '', 40),
    'date'    => clean_text($input['date']    ?? '', 20),
    'time'    => clean_text($input['time']    ?? '', 10),
    'guests'  => clean_text($input['guests']  ?? '', 4),
    'message' => clean_text($input['message'] ?? '', 1000, true),
];

$errors = [];

if (mb_strlen($r['name']) < 2) {
    $errors['name'] = ui('err_name');
} elseif (preg_match('~https?://|www\.~i', $r['name'])) {
    $errors['name'] = 'Der Name darf keine Links enthalten.';
}

if ($r['email'] === '' || filter_var($r['email'], FILTER_VALIDATE_EMAIL) === false) {
    $errors['email'] = ui('err_email');
}

if ($r['date'] !== '') {
    $normalised = normalise_date($r['date']);
    if ($normalised === null) {
        $errors['date'] = ui('err_date');
    } else {
        $r['date'] = $normalised;
    }
}

if ($r['time'] !== '') {
    if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $r['time'])) {
        $errors['time'] = ui('err_time');
    }
}

if ($r['guests'] !== '') {
    if (!preg_match('/^\d{1,2}$/', $r['guests']) || (int) $r['guests'] < 1) {
        $errors['guests'] = ui('err_guests');
    } else {
        $r['guests'] = (string) (int) $r['guests'];
    }
}

if ($errors) {
    respond(422, ['ok' => false, 'errors' => $errors], ui('check_input') . ' ' . implode(' ', $errors));
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
    // A failure here must not break the guest's experience; it is logged by send_mail().
    send_mail($cfg, $notify, (string) ($cfg['team_signature'] ?? 'Team'), $teamMail['subject'], $teamMail['html'], $teamMail['text'], $r['email'], $r['name']);
}

respond_success($cfg);

// ===========================================================================
// Helpers
// ===========================================================================

/** Accepts application/json, form-encoded and multipart bodies. */
function read_input(): array
{
    $type = (string) ($_SERVER['CONTENT_TYPE'] ?? '');
    if (stripos($type, 'application/json') !== false) {
        $raw  = (string) file_get_contents('php://input');
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }
    return $_POST;
}

/** Trim, drop control characters, cap length. Newlines survive only when $multiline. */
function clean_text($value, int $max, bool $multiline = false): string
{
    if (is_array($value)) {
        return '';
    }
    $s = (string) $value;
    if (!mb_check_encoding($s, 'UTF-8')) {
        $s = mb_convert_encoding($s, 'UTF-8', 'UTF-8');
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

/** At most 5 submissions per IP per 10 minutes, tracked in the temp dir. Fails open. */
function rate_limit_ok(int $limit = 5, int $window = 600): bool
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    if ($ip === '') {
        return true;
    }
    $file = rtrim(sys_get_temp_dir(), '/') . '/hole19-rl-' . hash('sha256', $ip) . '.json';
    $now  = time();
    $hits = [];
    if (is_file($file)) {
        $hits = json_decode((string) @file_get_contents($file), true);
        $hits = is_array($hits) ? array_values(array_filter($hits, static function ($t) use ($now, $window) {
            return is_int($t) && $t > $now - $window;
        })) : [];
    }
    if (count($hits) >= $limit) {
        return false;
    }
    $hits[] = $now;
    @file_put_contents($file, json_encode($hits), LOCK_EX);
    return true;
}

/** Visitor-facing strings, formal (Sie) or casual (du) depending on config. */
function ui(string $key): string
{
    global $CASUAL;
    static $t = [
        'Sie' => [
            'too_many'    => 'Zu viele Anfragen. Bitte versuchen Sie es in ein paar Minuten erneut.',
            'err_name'    => 'Bitte geben Sie Ihren Namen an.',
            'err_email'   => 'Bitte geben Sie eine gültige E-Mail-Adresse an.',
            'err_date'    => 'Bitte geben Sie ein gültiges Datum an.',
            'err_time'    => 'Bitte geben Sie eine gültige Uhrzeit an (HH:MM).',
            'err_guests'  => 'Bitte geben Sie die Personenzahl an (1–99).',
            'check_input' => 'Bitte prüfen Sie Ihre Eingaben:',
            'send_failed' => 'Die Bestätigung konnte gerade nicht gesendet werden. Bitte versuchen Sie es später erneut oder rufen Sie uns an.',
            'success'     => 'Vielen Dank! Ihre Reservierung wurde bestätigt. Sie erhalten in Kürze eine E-Mail.',
            'success_page'=> 'Ihre Reservierung wurde bestätigt. Sie erhalten in Kürze eine Bestätigung per E-Mail.',
        ],
        'du' => [
            'too_many'    => 'Zu viele Anfragen. Bitte versuch es in ein paar Minuten noch einmal.',
            'err_name'    => 'Bitte gib deinen Namen an.',
            'err_email'   => 'Bitte gib eine gültige E-Mail-Adresse an.',
            'err_date'    => 'Bitte gib ein gültiges Datum an.',
            'err_time'    => 'Bitte gib eine gültige Uhrzeit an (HH:MM).',
            'err_guests'  => 'Bitte gib die Personenzahl an (1–99).',
            'check_input' => 'Bitte prüf deine Eingaben:',
            'send_failed' => 'Die Bestätigung konnte gerade nicht gesendet werden. Bitte versuch es später noch einmal oder ruf uns an.',
            'success'     => 'Vielen Dank! Deine Reservierung wurde bestätigt. Du erhältst in Kürze eine E-Mail.',
            'success_page'=> 'Deine Reservierung wurde bestätigt. Du erhältst in Kürze eine Bestätigung per E-Mail.',
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

/** JSON for fetch() callers, a small German HTML page for classic form posts. */
function respond(int $status, array $json, string $humanMessage): void
{
    http_response_code($status);
    if (wants_json()) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($json, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } else {
        header('Content-Type: text/html; charset=utf-8');
        echo '<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reservierung</title>'
           . '<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#f3f5f1;color:#1d241b;margin:0;padding:40px 16px;text-align:center}'
           . 'main{max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px 24px}h1{font-size:22px;margin:0 0 12px;color:#1f4d2e}p{font-size:16px;line-height:1.5;margin:0 0 16px}a{color:#1f4d2e}</style></head>'
           . '<body><main><h1>' . ($status < 400 ? 'Vielen Dank!' : 'Das hat leider nicht geklappt') . '</h1><p>' . h($humanMessage) . '</p>'
           . '<p><a href="javascript:history.back()">Zurück</a></p></main></body></html>';
    }
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
