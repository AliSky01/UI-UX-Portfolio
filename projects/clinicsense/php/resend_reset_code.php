<?php
header('Content-Type: application/json');
require_once 'config.php';
require_once '../vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

session_start();

if (!isset($_SESSION['reset_email'])) {
    echo json_encode(['success' => false, 'message' => 'Session expired. Please try again']);
    exit;
}

$email = $_SESSION['reset_email'];
$code  = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

$_SESSION['reset_code']    = $code;
$_SESSION['reset_expires'] = time() + (10 * 60);

// Fix: query Guardian table instead of users
$stmt = $pdo->prepare('SELECT FirstName as firstname FROM Guardian WHERE Email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host       = 'smtp.gmail.com';
    $mail->SMTPAuth   = true;
    $mail->Username   = 'estrellas.clinic@gmail.com';
    $mail->Password   = 'rfbcqxxpvsujdkik';
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = 587;

    $mail->setFrom('estrellas.clinic@gmail.com', 'Estrellas Clinic');
    $mail->addAddress($email, $user['firstname'] ?? '');
    $mail->Subject = 'Your New Estrellas Reset Code';
    $mail->isHTML(true);
    $mail->Body = "
        <div style='font-family: Arial, sans-serif; max-width: 500px; margin: auto;'>
            <h2 style='color: #4a90d9;'>Estrellas Clinic</h2>
            <p>Your new password reset code is:</p>
            <h1 style='letter-spacing: 8px; color: #333;'>$code</h1>
            <p>This code expires in <strong>10 minutes</strong>.</p>
        </div>
    ";

    if (!$mail->send()) {
        echo json_encode(['success' => false, 'message' => 'Failed to send email']);
    } else {
        echo json_encode(['success' => true]);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Error: ' . $mail->ErrorInfo]);
}
?>