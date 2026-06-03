export async function onRequestPost({ request, env }) {
  try {
    const { domain } = await request.json();
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
        status: "active",
        ssl_status: "active",
        message: "محاكاة: حالة النطاق نشط والـ SSL مفعل"
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames?hostname=${cleanDomain}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return new Response(JSON.stringify({
        success: false,
        error: data.errors?.[0]?.message || "فشلت عملية التحقق في Cloudflare"
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const hostnameInfo = data.result?.[0];
    if (!hostnameInfo) {
      return new Response(JSON.stringify({
        success: false,
        status: "none",
        message: "النطاق غير مسجل في الحساب بـ Cloudflare"
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      success: true,
      status: hostnameInfo.status,
      ssl_status: hostnameInfo.ssl?.status,
      verification_errors: hostnameInfo.verification_errors,
      ssl_validation_errors: hostnameInfo.ssl?.validation_errors,
      details: hostnameInfo
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
