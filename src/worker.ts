import { Hono } from "hono";
import { cors } from "hono/cors";

type Env = {
  CLOUDFLARE_ZONE_ID: string;
  CLOUDFLARE_API_TOKEN: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use("/*", cors());

// Debug logging
app.use("*", async (c, next) => {
  console.log(`[WORKER INCOMING] ${c.req.method} ${c.req.url}`);
  await next();
});

app.post("/api/domains/add", async (c) => {
  try {
    const { domain, storeId } = await c.req.json();
    
    if (!domain) {
      return c.json({ success: false, error: "النطاق مطلوب" }, 400);
    }

    const cleanDomain = domain
      .replace(/^(https?:\/\/)?(www\.)?/, "")
      .replace(/\/.*$/, '')
      .replace(/[^a-zA-Z0-9.-]/g, '')
      .toLowerCase();
    // Access environment variables securely in Cloudflare Workers using c.env
    const zoneId = c.env.CLOUDFLARE_ZONE_ID;
    const apiToken = c.env.CLOUDFLARE_API_TOKEN;

    console.log(`[DOMAIN-AUTOMATION-WORKER] Registering: ${cleanDomain} for store: ${storeId}`);

    if (!zoneId || !apiToken) {
      console.log("[DOMAIN-AUTOMATION-WORKER] Missing Tokens. Simulating...");
      return c.json({
        success: true,
        simulation: true,
        message: "تم حفظ النطاق بنجاح ومحاكاة التفعيل. يرجى توجيه الـ DNS كما هو موضح بالدليل.",
        domain: cleanDomain,
        details: {
          hostname: cleanDomain,
          status: "pending",
          ssl_status: "initializing"
        }
      });
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          hostname: cleanDomain,
          ssl: { method: "txt", type: "dv" }
        })
      }
    );

    const data: any = await response.json();

    if (!response.ok || !data.success) {
      const errors = data.errors || [];
      const isDuplicate = errors.some((err: any) => err.code === 1406 || (err.message && err.message.includes("already exists")));
      
      if (isDuplicate) {
        return c.json({
          success: true,
          message: "هذا النطاق مسجل بالفعل في حساب Cloudflare.",
          domain: cleanDomain,
          details: { hostname: cleanDomain, status: "active", ssl_status: "active" }
        });
      }

      return c.json({
        success: false,
        error: data.errors?.[0]?.message || "فشلت عملية إضافة النطاق في Cloudflare",
        details: data.errors
      }, 400);
    }

    return c.json({
      success: true,
      message: "تم تفعيل وتسجيل النطاق بنجاح وتوليد شهادة الـ SSL تلقائياً عبر Cloudflare API!",
      domain: cleanDomain,
      details: data.result
    });
  } catch (err: any) {
    console.error("[DOMAIN-AUTOMATION-WORKER-ERROR]", err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.post("/api/domains/status", async (c) => {
  try {
    const { domain } = await c.req.json();
    if (!domain) {
      return c.json({ success: false, error: "النطاق مطلوب" }, 400);
    }

    const cleanDomain = domain
      .replace(/^(https?:\/\/)?(www\.)?/, "")
      .replace(/\/.*$/, '')
      .replace(/[^a-zA-Z0-9.-]/g, '')
      .toLowerCase();
    const zoneId = c.env.CLOUDFLARE_ZONE_ID;
    const apiToken = c.env.CLOUDFLARE_API_TOKEN;

    if (!zoneId || !apiToken) {
      return c.json({
        success: true,
        simulation: true,
        status: "active",
        ssl_status: "active",
        message: "محاكاة: حالة النطاق نشط والـ SSL مفعل"
      });
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames?hostname=${encodeURIComponent(cleanDomain)}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    const data: any = await response.json();
    if (!response.ok || !data.success) {
      return c.json({ success: false, error: data.errors?.[0]?.message || "فشلت عملية التحقق في Cloudflare" }, 400);
    }

    const hostnameInfo = data.result?.[0];
    if (!hostnameInfo) {
      return c.json({ success: false, status: "none", message: "النطاق غير مسجل في الحساب بـ Cloudflare" });
    }

    return c.json({
      success: true,
      status: hostnameInfo.status,
      ssl_status: hostnameInfo.ssl?.status,
      verification_errors: hostnameInfo.verification_errors,
      ssl_validation_errors: hostnameInfo.ssl?.validation_errors,
      details: hostnameInfo
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export default app;
