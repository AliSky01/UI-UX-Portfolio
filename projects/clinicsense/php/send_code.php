<?php
header('Content-Type: application/json');
require_once 'config.php';
require_once '../vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

session_start();

error_reporting(E_ALL);
ini_set('display_errors', 1);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request']);
    exit;
}

$firstname  = trim($_POST['firstname'] ?? '');
$middlename = trim($_POST['middlename'] ?? '');
$lastname   = trim($_POST['lastname'] ?? '');
$birthdate  = trim($_POST['birthdate'] ?? '');
$gender     = trim($_POST['gender'] ?? '');
$contact    = trim($_POST['contact'] ?? '');
$email      = trim($_POST['email'] ?? '');

if (!$firstname || !$lastname || !$birthdate || !$gender || !$contact || !$email) {
    echo json_encode(['success' => false, 'message' => 'Please fill out all required fields']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'Invalid email address']);
    exit;
}

$stmt = $pdo->prepare('SELECT Guardian_ID FROM Guardian WHERE Email = ?');
$stmt->execute([$email]);
if ($stmt->rowCount() > 0) {
    echo json_encode(['success' => false, 'message' => 'Email already registered']);
    exit;
}

$code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

$_SESSION['confirmation_code'] = $code;
$_SESSION['code_expires']      = time() + (10 * 60);
$_SESSION['pending_user']      = compact(
    'firstname', 'middlename', 'lastname',
    'birthdate', 'gender', 'contact', 'email'
);

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
    $mail->addAddress($email, $firstname);
    $mail->Subject = 'Your Estrellas Confirmation Code';
    $mail->isHTML(true);
    $mail->Body = "
        <div style='font-family: Arial, sans-serif; max-width: 500px; margin: auto;'>
            <h2 style='color: #4a90d9;'>Estrellas Clinic</h2>
            <p>Hi <strong>$firstname</strong>,</p>
            <p>Your confirmation code is:</p>
            <h1 style='letter-spacing: 8px; color: #333;'>$code</h1>
            <p>This code expires in <strong>10 minutes</strong>.</p>
            <p>If you did not request this, please ignore this email.</p>
        </div>
    ";

    if (!$mail->send()) {
        echo json_encode(['success' => false, 'message' => 'Mailer error: ' . $mail->ErrorInfo]);
    } else {
        echo json_encode(['success' => true, 'email' => $email]);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Failed to send email: ' . $mail->ErrorInfo]);
}
?>