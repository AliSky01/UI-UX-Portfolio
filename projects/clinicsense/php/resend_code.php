<?php
header('Content-Type: application/json');
require_once 'config.php';
require_once '../vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

session_start();

if (!isset($_SESSION['pending_user'])) {
    echo json_encode(['success' => false, 'message' => 'Session expired. Please register again']);
    exit;
}

$user = $_SESSION['pending_user'];
$code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

$_SESSION['confirmation_code'] = $code;
$_SESSION['code_expires']      = time() + (10 * 60);

$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host       = 'smtp.gmail.com';
    $mail->SMTPAuth   = true;
    $mail->Username   = 'estrellas.clinic@gmail.com';
    $mail->Password   = 'rfbcqxxpvsujdkik';
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = 587;
    $mail->SMTPDebug  = 0;

    $mail->setFrom('estrellas.clinic@gmail.com', 'Estrellas Clinic');
    $mail->addAddress($user['email'], $user['firstname']);
    $mail->Subject = 'Your New Estrellas Confirmation Code';
    $mail->isHTML(true);
    $mail->Body = "
        <div style='font-family: Arial, sans-serif; max-width: 500px; margin: auto;'>
            <h2 style='color: #4a90d9;'>Estrellas Clinic</h2>
            <p>Hi <strong>{$user['firstname']}</strong>,</p>
            <p>Your new confirmation code is:</p>
            <h1 style='letter-spacing: 8px; color: #333;'>$code</h1>
            <p>This code expires in <strong>10 minutes</strong>.</p>
        </div>
    ";

    if(!$mail->send()) {
        echo json_encode(['success' => false, 'message' => 'Mailer error: ' . $mail->ErrorInfo]);
    } else {
        echo json_encode(['success' => true]);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Failed to send email: ' . $mail->ErrorInfo]);
}
?>