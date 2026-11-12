<?php
/**
 * Site content store
 *
 * GET  -> returns the saved site content as JSON.
 * POST -> replaces the saved site content with the posted JSON.
 *
 * Content is everything the admin panel saves (logo, slider, settings, etc.)
 * so it stays on the server instead of only in one browser.
 *
 * PHP 8.1+
 */

declare(strict_types=1);

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function respond(int $status, array $payload): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

$dataDir = __DIR__ . DIRECTORY_SEPARATOR . 'data';
$dataFile = $dataDir . DIRECTORY_SEPARATOR . 'site-data.json';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    if (!is_file($dataFile)) {
        respond(200, ['ok' => true, 'data' => null]);
    }
    $raw = @file_get_contents($dataFile);
    if ($raw === false) {
        respond(500, ['ok' => false, 'error' => 'Could not read saved content.']);
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        respond(200, ['ok' => true, 'data' => null]);
    }
    respond(200, ['ok' => true, 'data' => $decoded]);
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        respond(400, ['ok' => false, 'error' => 'No content was sent.']);
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        respond(400, ['ok' => false, 'error' => 'The content is not valid JSON.']);
    }

    if (!is_dir($dataDir) && !mkdir($dataDir, 0755, true) && !is_dir($dataDir)) {
        respond(500, ['ok' => false, 'error' => 'The data folder could not be created.']);
    }
    if (!is_writable($dataDir)) {
        respond(500, ['ok' => false, 'error' => 'The data folder is not writable.']);
    }

    $encoded = json_encode($decoded, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($encoded === false) {
        respond(500, ['ok' => false, 'error' => 'Could not encode the content.']);
    }

    $tmp = tempnam($dataDir, 'site-');
    if ($tmp === false) {
        respond(500, ['ok' => false, 'error' => 'Could not prepare the save file.']);
    }
    if (file_put_contents($tmp, $encoded, LOCK_EX) === false) {
        @unlink($tmp);
        respond(500, ['ok' => false, 'error' => 'Could not write the content.']);
    }
    @chmod($tmp, 0644);
    if (!@rename($tmp, $dataFile)) {
        @unlink($tmp);
        respond(500, ['ok' => false, 'error' => 'Could not store the content.']);
    }

    respond(200, ['ok' => true, 'saved' => true, 'bytes' => strlen($encoded)]);
}

respond(405, ['ok' => false, 'error' => 'Method not allowed. Use GET or POST.']);
