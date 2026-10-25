<?php
header('Content-Type: application/json');
require_once 'config.php';
require_once '../vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request']);
    exit;
}

$email = trim($_POST['email'] ?? '');

if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'Please enter a valid email']);
    exit;
}

$normalizedEmail = mb_strtolower($email);

// Check Guardian table (case-insensitive email match)
$stmt = $pdo->prepare('SELECT Guardian_ID as id, FirstName as firstname, Username as username, "guardian" as user_type, Email FROM Guardian WHERE LOWER(Email) = ?');
$stmt->execute([$normalizedEmail]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    echo json_encode(['success' => false, 'message' => 'No account found with that email']);
    exit;
}

$email = $user['Email'];

// Generate 6 digit code
$code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

$_SESSION['reset_code']      = $code;
$_SESSION['reset_expires']   = time() + (10 * 60);
$_SESSION['reset_email']     = $email;
$_SESSION['reset_user_type'] = $user['user_type'];
$_SESSION['reset_username']  = $user['username'] ?? null;

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
    $mail->addAddress($email, $user['firstname']);
    $mail->Subject = 'Your Estrellas Password Reset Code';
    $mail->isHTML(true);
    $mail->Body = "
        <div style='font-family: Arial, sans-serif; max-width: 500px; margin: auto;'>
            <h2 style='color: #4a90d9;'>Estrellas Clinic</h2>
            <p>Hi <strong>{$user['firstname']}</strong>,</p>
            <p>Your password reset code is:</p>
            <h1 style='letter-spacing: 8px; color: #333;'>$code</h1>
            <p>This code expires in <strong>10 minutes</strong>.</p>
            <p>If you did not request this, please ignore this email.</p>
        </div>
    ";

    if (!$mail->send()) {
        echo json_encode(['success' => false, 'message' => 'Failed to send email']);
    } else {
        echo json_encode(['success' => true, 'email' => $email]);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Error: ' . $mail->ErrorInfo]);
}
?>