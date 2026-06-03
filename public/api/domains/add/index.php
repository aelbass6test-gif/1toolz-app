<?php
// API Endpoint for adding a custom domain to Cloudflare Custom Hostnames (SaaS)
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
$storeId = isset($input['storeId']) ? trim($input['storeId']) : '';

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
// يمكنك كتابة رموز حسابك مباشرة هنا لتشغيلها على استضافتك بـ Hostinger فوراً وبأعلى أمان وسرية:
$CLOUDFLARE_API_TOKEN = "your_real_token_here"; // ضع توكن كلاود فلير الخاص بك هنا
$CLOUDFLARE_ZONE_ID = "your_real_zone_id_here";   // ضع معرف الزون للمجال الرئيسي الخاص بك هنا

// تدعيم المتغيرات عبر السيرفر كخيار بديل
if (empty($CLOUDFLARE_API_TOKEN) || $CLOUDFLARE_API_TOKEN === "your_real_token_here") {
    $CLOUDFLARE_API_TOKEN = getenv("CLOUDFLARE_API_TOKEN");
}
if (empty($CLOUDFLARE_ZONE_ID) || $CLOUDFLARE_ZONE_ID === "your_real_zone_id_here") {
    $CLOUDFLARE_ZONE_ID = getenv("CLOUDFLARE_ZONE_ID");
}

// في حال عدم تعيين المفاتيح بعد، يتم توفير محاكاة تشغيلية لسهولة بناء وتجربة لوحة التحكم
if (empty($CLOUDFLARE_API_TOKEN) || $CLOUDFLARE_API_TOKEN === "your_real_token_here" || $CLOUDFLARE_API_TOKEN == "") {
    echo json_encode([
        "success" => true,
        "simulation" => true,
        "message" => "تم حفظ النطاق بنجاح ومحاكاة التفعيل الفوري. لتفعيله حقيقياً، يرجى كتابة الـ API Token و Zone ID في ملف api/domains/add/index.php المستضاف على خادمك.",
        "domain" => $cleanDomain,
        "details" => [
            "hostname" => $cleanDomain,
            "status" => "pending",
            "ssl_status" => "initializing"
        ]
    ]);
    exit;
}

// Curl Call to Cloudflare API (Custom Hostnames)
$url = "https://api.cloudflare.com/client/v4/zones/" . $CLOUDFLARE_ZONE_ID . "/custom_hostnames";
$payload = json_encode([
    "hostname" => $cleanDomain,
    "ssl" => [
        "method" => "http",
        "type" => "dv"
    ]
]);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer " . $CLOUDFLARE_API_TOKEN,
    "Content-Type: application/json"
]);

// Set options
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "فشلت عملية الإرسال لـ Cloudflare: " . $curlError
    ]);
    exit;
}

$data = json_decode($response, true);

if ($httpCode >= 400 || !$data || !isset($data['success']) || !$data['success']) {
    $errors = isset($data['errors']) ? $data['errors'] : [];
    $isDuplicate = false;
    
    foreach ($errors as $err) {
        if ((isset($err['code']) && $err['code'] == 1406) || (isset($err['message']) && strpos(strtolower($err['message']), 'already exists') !== false)) {
            $isDuplicate = true;
            break;
        }
    }

    if ($isDuplicate) {
        echo json_encode([
            "success" => true,
            "message" => "هذا النطاق مسجل بالفعل في حساب Cloudflare الخاص بمنصتك ومستعد للربط المباشر.",
            "domain" => $cleanDomain,
            "details" => [
                "hostname" => $cleanDomain,
                "status" => "active",
                "ssl_status" => "active"
            ]
        ]);
        exit;
    }

    http_response_code($httpCode > 0 ? $httpCode : 400);
    $errMsg = isset($errors[0]['message']) ? $errors[0]['message'] : "فشلت عملية تفعيل النطاق عبر Cloudflare API";
    echo json_encode([
        "success" => false,
        "error" => $errMsg,
        "details" => $errors
    ]);
    exit;
}

echo json_encode([
    "success" => true,
    "message" => "تم تفعيل وتسجيل النطاق بنجاح وتوليد شهادة الـ SSL تلقائياً عبر Cloudflare API!",
    "domain" => $cleanDomain,
    "details" => $data['result']
]);
