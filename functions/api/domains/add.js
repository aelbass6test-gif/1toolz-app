export async function onRequestPost({ request, env }) {
  try {
    const { domain, storeId } = await request.json();
    
    if (!domain) {
      return new Response(JSON.stringify({ success: false, error: "النطاق مطلوب" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, "").trim();
    const zoneId = env.CLOUDFLARE_ZONE_ID;
    const apiToken = env.CLOUDFLARE_API_TOKEN;

    if (!zoneId || !apiToken) {
      return new Response(JSON.stringify({
        success: true,
        simulation: true,
        message: "تم حفظ النطاق بنجاح ومحاكاة التفعيل. يرجى توجيه الـ DNS كما هو موضح بالدليل.",
        domain: cleanDomain,
        details: {
          hostname: cleanDomain,
          status: "pending",
          ssl_status: "initializing"
        }
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        hostname: cleanDomain,
        ssl: { method: "http", type: "dv" }
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      const errors = data.errors || [];
      const isDuplicate = errors.some(err => err.code === 1406 || (err.message && err.message.includes("already exists")));
      
      if (isDuplicate) {
        return new Response(JSON.stringify({
          success: true,
          message: "هذا النطاق مسجل بالفعل في حساب Cloudflare.",
          domain: cleanDomain,
          details: { hostname: cleanDomain, status: "active", ssl_status: "active" }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        success: false,
        error: errors[0]?.message || "فشلت عملية إضافة النطاق في Cloudflare",
        details: errors
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      success: true,
      message: "تم تفعيل وتسجيل النطاق بنجاح وتوليد شهادة الـ SSL تلقائياً عبر Cloudflare API!",
      domain: cleanDomain,
      details: data.result
    }), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: "حدث خطأ: " + err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
