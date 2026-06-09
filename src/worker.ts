import { Hono } from "hono";
import { cors } from "hono/cors";

type Env = {
  CLOUDFLARE_ZONE_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  ASSETS?: any;
};

const app = new Hono<{ Bindings: Env }>();

app.use("/*", cors());

// Debug logging
app.use("*", async (c, next) => {
  console.log(`[WORKER INCOMING] ${c.req.method} ${c.req.url}`);
  await next();
});

// Provide SPA fallback support for custom domain frontend routing
app.notFound(async (c) => {
  const pathName = c.req.path;
  const isApi = pathName.startsWith("/api/");
  
  if (!isApi && c.env && c.env.ASSETS) {
    try {
      const url = new URL(c.req.url);
      // Normalize hostname to the worker's default domain so that ASSETS fetch works perfectly for custom domains and subdomains
      url.hostname = "1toolz-app.app1toolz.workers.dev";
      
      const headers = new Headers(c.req.raw.headers);
      headers.set("host", "1toolz-app.app1toolz.workers.dev");
      
      const reqInit: RequestInit = {
        method: c.req.raw.method,
        headers: headers,
      };
      
      if (c.req.raw.method !== "GET" && c.req.raw.method !== "HEAD") {
        reqInit.body = c.req.raw.body;
      }

      // 1. Try to serve the exact asset (so custom hostname asset requests work cleanly)
      const assetRequest = new Request(url.toString(), reqInit);
      const assetRes = await c.env.ASSETS.fetch(assetRequest);
      if (assetRes.status !== 404) {
        return assetRes;
      }
      
      // 2. If asset is not found and this is a GET request, fallback to index.html for React Router SPA routes
      if (c.req.method === "GET") {
        url.pathname = "/index.html";
        const indexRequest = new Request(url.toString(), reqInit);
        const indexRes = await c.env.ASSETS.fetch(indexRequest);
        if (indexRes.status !== 404) {
          return indexRes;
        }
      }
    } catch (e) {
      console.error("[WORKER SPA FALLBACK ERROR]", e);
    }
  }
  
  return c.text("Not Found", 404);
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
