<?php
// API Endpoint for checking custom domain status on Cloudflare Custom Hostnames (SaaS)
// Designed for out-of-the-box compatibility with Hostinger and standard PHP apache hosts.

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=utf-8");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "success" => false, 
        "error" => "طريقة الطلب غير مسموح بها. يجب استخدام POST."
    ]);
    exit;
}

// Read JSON input
$inputRaw = file_get_contents("php://input");
$input = json_decode($inputRaw, true);

$domain = isset($input['domain']) ? trim($input['domain']) : '';

if (empty($domain)) {
    http_response_code(400);
    echo json_encode([
        "success" => false, 
        "error" => "اسم النطاق مطلوب."
    ]);
    exit;
}

// Clean domain (remove http://, https://, and www. if any)
$cleanDomain = preg_replace('#^https?://#i', '', $domain);
$cleanDomain = preg_replace('#^www\.#i', '', $cleanDomain);
$cleanDomain = trim($cleanDomain, '/ ');

// =======================================================
// 🛡️ إرساء مفاتيح الربط البرمجي السحابي المباشر لـ Cloudflare
// =======================================================
$CLOUDFLARE_API_TOKEN = "your_real_token_here"; // ضع توكن كلاود فلير الخاص بك هنا
$CLOUDFLARE_ZONE_ID = "your_real_zone_id_here";   // ضع معرف الزون للمجال الرئيسي الخاص بك هنا

if (empty($CLOUDFLARE_API_TOKEN) || $CLOUDFLARE_API_TOKEN === "your_real_token_here") {
    $CLOUDFLARE_API_TOKEN = getenv("CLOUDFLARE_API_TOKEN");
}
if (empty($CLOUDFLARE_ZONE_ID) || $CLOUDFLARE_ZONE_ID === "your_real_zone_id_here") {
    $CLOUDFLARE_ZONE_ID = getenv("CLOUDFLARE_ZONE_ID");
}

if (empty($CLOUDFLARE_API_TOKEN) || $CLOUDFLARE_API_TOKEN === "your_real_token_here" || $CLOUDFLARE_API_TOKEN == "") {
    echo json_encode([
        "success" => true,
        "simulation" => true,
        "status" => "active",
        "ssl_status" => "active",
        "message" => "محاكاة: النطاق والـ SSL مفعلان بشكل طبيعي وبصحة ممتازة."
    ]);
    exit;
}

// Curl Call to Cloudflare API to search for custom hostname
$url = "https://api.cloudflare.com/client/v4/zones/" . $CLOUDFLARE_ZONE_ID . "/custom_hostnames?hostname=" . urlencode($cleanDomain);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer " . $CLOUDFLARE_API_TOKEN,
    "Content-Type: application/json"
]);

curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($response === false) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "فشلت عملية التحقق في خادم Cloudflare"
    ]);
    exit;
}

$data = json_decode($response, true);

if ($httpCode >= 400 || !$data || !isset($data['success']) || !$data['success']) {
    $errors = isset($data['errors']) ? $data['errors'] : [];
    $errMsg = isset($errors[0]['message']) ? $errors[0]['message'] : "فشلت عملية الاستعلام عن حالة النطاق";
    http_response_code($httpCode > 0 ? $httpCode : 400);
    echo json_encode([
        "success" => false,
        "error" => $errMsg
    ]);
    exit;
}

$hostnameInfo = isset($data['result'][0]) ? $data['result'][0] : null;

if (!$hostnameInfo) {
    echo json_encode([
        "success" => false,
        "status" => "none",
        "message" => "النطاق المكتوب غير متوفر ومسجل في حساب Cloudflare حالياً."
    ]);
    exit;
}

echo json_encode([
    "success" => true,
    "status" => $hostnameInfo['status'], // e.g. "active" or "pending"
    "ssl_status" => isset($hostnameInfo['ssl']['status']) ? $hostnameInfo['ssl']['status'] : 'none',
    "verification_errors" => isset($hostnameInfo['verification_errors']) ? $hostnameInfo['verification_errors'] : [],
    "ssl_validation_errors" => isset($hostnameInfo['ssl']['validation_errors']) ? $hostnameInfo['ssl']['validation_errors'] : [],
    "details" => $hostnameInfo
]);
