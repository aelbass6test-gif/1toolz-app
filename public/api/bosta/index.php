<?php
// Universal API Proxy for Hostinger / cPanel Shared Hosting
// Forward any /api/* requests to the fully functional Cloud Run container

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, x-api-key, x-bosta-key");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Target Cloud Run backend
$BACKEND_URL = "https://ais-pre-xcte2r3fyl5agkthujufx4-222930444647.europe-west1.run.app";

// Get requested route
$route = isset($_GET['route']) ? $_GET['route'] : '';
if (empty($route)) {
    // Fallback: parse from REQUEST_URI
    $uri = $_SERVER['REQUEST_URI'];
    if (preg_match('#/api/(.*)$#', $uri, $matches)) {
        $route = explode('?', $matches[1])[0];
    }
}

// Clean route from query parameters
$route = explode('?', $route)[0];

// Build target URL
$queryString = '';
if (isset($_SERVER['QUERY_STRING']) && !empty($_SERVER['QUERY_STRING'])) {
    $queryString = '?' . $_SERVER['QUERY_STRING'];
}

// Remove route parameter from query string to keep it clean on target
if (isset($_GET['route'])) {
    $cleanQuery = $_GET;
    unset($cleanQuery['route']);
    $queryString = !empty($cleanQuery) ? '?' . http_build_query($cleanQuery) : '';
}

$targetUrl = $BACKEND_URL . "/api/" . $route . $queryString;

// Prepare headers
$headers = [];
if (function_exists('getallheaders')) {
    foreach (getallheaders() as $key => $value) {
        $lowerKey = strtolower($key);
        if ($lowerKey !== 'host' && $lowerKey !== 'content-length' && $lowerKey !== 'accept-encoding') {
            $headers[] = "$key: $value";
        }
    }
} else {
    foreach ($_SERVER as $name => $value) {
        if (substr($name, 0, 5) == 'HTTP_') {
            $key = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))));
            $lowerKey = strtolower($key);
            if ($lowerKey !== 'host' && $lowerKey !== 'content-length' && $lowerKey !== 'accept-encoding') {
                $headers[] = "$key: $value";
            }
        }
    }
}

// Curl config
$ch = curl_init($targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $_SERVER['REQUEST_METHOD']);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

// Forward request body for non-GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    $body = file_get_contents('php://input');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    $error_msg = curl_error($ch);
    http_response_code(502);
    echo json_encode([
        "success" => false,
        "error" => "فشل الاتصال بالخادم الخلفي السحابي: $error_msg",
        "targetUrl" => $targetUrl
    ]);
    curl_close($ch);
    exit;
}

curl_close($ch);

// Set response header content-type if available
header("Content-Type: application/json; charset=utf-8");

// Set response code
http_response_code($httpCode);

// Return response
echo $response;
