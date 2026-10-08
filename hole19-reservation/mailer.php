<?php
/**
 * Sends an e-mail through PHPMailer.
 *
 * Transport: authenticated SMTP when 'smtp_password' is set in config.php
 * (recommended; Hostinger: smtp.hostinger.com, 465/ssl), otherwise PHP's mail().
 * Returns true on success. On failure the reason is written to the PHP error
 * log (never shown to the visitor) and false is returned.
 */

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailException;

require_once __DIR__ . '/vendor/autoload.php';

function send_mail(
    array $cfg,
    string $toEmail,
    string $toName,
    string $subject,
    string $html,
    string $text,
    string $replyToEmail = '',
    string $replyToName = ''
): bool {
    $mail = new PHPMailer(true);

    try {
        $mail->CharSet  = PHPMailer::CHARSET_UTF8;
        $mail->Encoding = PHPMailer::ENCODING_QUOTED_PRINTABLE;
        $mail->Timeout  = 20;

        if (!empty($cfg['smtp_password'])) {
            $mail->isSMTP();
            $mail->Host     = (string) $cfg['smtp_host'];
            $mail->Port     = (int) $cfg['smtp_port'];
            $mail->SMTPAuth = true;
            $mail->Username = (string) ($cfg['smtp_user'] ?: $cfg['from_email']);
            $mail->Password = (string) $cfg['smtp_password'];
            $secure = strtolower((string) ($cfg['smtp_secure'] ?? 'ssl'));
            if ($secure === 'ssl') {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            } elseif ($secure === 'tls') {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            } else {
                $mail->SMTPSecure  = '';
                $mail->SMTPAutoTLS = false;
            }
        } else {
            $mail->isMail();
            // Envelope sender for mail(); helps SPF alignment on shared hosting.
            $mail->Sender = (string) $cfg['from_email'];
        }

        $mail->setFrom((string) $cfg['from_email'], (string) $cfg['from_name']);
        $mail->addAddress($toEmail, $toName);
        if ($replyToEmail !== '') {
            $mail->addReplyTo($replyToEmail, $replyToName);
        }

        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $html;
        $mail->AltBody = $text;

        return $mail->send();
    } catch (MailException $e) {
        error_log('[hole19-reservation] mail to ' . $toEmail . ' failed: ' . $mail->ErrorInfo);
        return false;
    } catch (\Throwable $e) {
        error_log('[hole19-reservation] mail to ' . $toEmail . ' failed: ' . $e->getMessage());
        return false;
    }
}
