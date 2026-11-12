<?php
/**
 * Image upload endpoint
 *
 * Saves a validated image into the project's assets/ folder using a unique
 * filename and returns the path the front-end should store and display.
 *
 * PHP 8.2+
 */

declare(strict_types=1);

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

/** Send a JSON response and stop. */
function respond(int $status, array $payload): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'Method not allowed. Use POST.']);
}

if (!isset($_FILES['image']) || !is_array($_FILES['image'])) {
    respond(400, ['ok' => false, 'error' => 'No image was uploaded.']);
}

$file = $_FILES['image'];
$error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);

if ($error !== UPLOAD_ERR_OK) {
    $messages = [
        UPLOAD_ERR_INI_SIZE   => 'The image is larger than the server upload limit.',
        UPLOAD_ERR_FORM_SIZE  => 'The image is larger than the allowed upload size.',
        UPLOAD_ERR_PARTIAL    => 'The image was only partially uploaded. Please try again.',
        UPLOAD_ERR_NO_FILE    => 'No image was uploaded.',
        UPLOAD_ERR_NO_TMP_DIR => 'The server upload folder is unavailable.',
        UPLOAD_ERR_CANT_WRITE => 'The server could not write the uploaded image.',
        UPLOAD_ERR_EXTENSION  => 'The upload was stopped by a server extension.',
    ];
    respond(400, ['ok' => false, 'error' => $messages[$error] ?? 'The image could not be uploaded.']);
}

$tmpPath = (string) ($file['tmp_name'] ?? '');
$size = (int) ($file['size'] ?? 0);
$maxBytes = 8 * 1024 * 1024; // 8 MB

if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
    respond(400, ['ok' => false, 'error' => 'The upload could not be verified.']);
}

if ($size <= 0 || $size > $maxBytes) {
    respond(413, ['ok' => false, 'error' => 'Images must be between 1 byte and 8 MB.']);
}

/* Verify the real content type, never trust the browser-supplied one. */
$mime = '';
if (class_exists('finfo')) {
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $detected = $finfo->file($tmpPath);
    $mime = is_string($detected) ? $detected : '';
} elseif (function_exists('mime_content_type')) {
    $mime = (string) mime_content_type($tmpPath);
}

$allowed = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/gif'  => 'gif',
    'image/webp' => 'webp',
];

if (!isset($allowed[$mime])) {
    respond(415, ['ok' => false, 'error' => 'Only JPG, PNG, GIF and WebP images are allowed.']);
}

/* Confirm the file really is a decodable image and that its type agrees. */
$info = @getimagesize($tmpPath);
$typeMap = [
    IMAGETYPE_JPEG => 'image/jpeg',
    IMAGETYPE_PNG  => 'image/png',
    IMAGETYPE_GIF  => 'image/gif',
    IMAGETYPE_WEBP => 'image/webp',
];

if (!$info || !isset($info[2], $typeMap[$info[2]]) || $typeMap[$info[2]] !== $mime) {
    respond(415, ['ok' => false, 'error' => 'The uploaded file is not a valid image.']);
}

$assetsDir = __DIR__ . DIRECTORY_SEPARATOR . 'assets';
if (!is_dir($assetsDir) && !mkdir($assetsDir, 0755, true) && !is_dir($assetsDir)) {
    respond(500, ['ok' => false, 'error' => 'The assets folder could not be created.']);
}

if (!is_writable($assetsDir)) {
    respond(500, ['ok' => false, 'error' => 'The assets folder is not writable.']);
}

$extension = $allowed[$mime];
$filename = 'img_' . date('Ymd_His') . '_' . bin2hex(random_bytes(10)) . '.' . $extension;
$destination = $assetsDir . DIRECTORY_SEPARATOR . $filename;

if (!move_uploaded_file($tmpPath, $destination)) {
    respond(500, ['ok' => false, 'error' => 'The image could not be saved.']);
}

@chmod($destination, 0644);

respond(200, [
    'ok'   => true,
    'path' => 'assets/' . $filename,
    'url'  => 'assets/' . $filename,
    'name' => $filename,
    'size' => $size,
    'mime' => $mime,
]);
