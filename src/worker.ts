import { Hono } from "hono";
import { cors } from "hono/cors";

type Env = {
  CLOUDFLARE_ZONE_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  BACKEND_URL?: string;
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
      verification_errors: hostnameInfo.ssl?.validation_errors,
      ssl_validation_errors: hostnameInfo.ssl?.validation_errors,
      details: hostnameInfo
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Intercept GET requests to Bosta webhooks directly in Cloudflare Worker to return friendly JSON status
app.get("/api/webhooks/bosta", (c) => c.json({
  success: true,
  status: "active",
  message: "Bosta Webhook endpoint is active and ready to receive POST payloads from Bosta."
}));
app.get("/api/webhook/bosta", (c) => c.json({
  success: true,
  status: "active",
  message: "Bosta Webhook endpoint is active and ready to receive POST payloads from Bosta."
}));

// Intercept GET requests to Turbo webhooks directly in Cloudflare Worker to return friendly JSON status
const handleWorkerTurboWebhookGet = (c: any) => c.json({
  success: true,
  status: "active",
  message: "Turbo Webhook endpoint is active and ready to receive POST status updates from Turbo."
});
app.get("/api/webhooks/turbo", handleWorkerTurboWebhookGet);
app.get("/api/webhook/turbo", handleWorkerTurboWebhookGet);
app.get("/api/webhooks/turbo/:storeId", handleWorkerTurboWebhookGet);
app.get("/api/webhook/turbo/:storeId", handleWorkerTurboWebhookGet);

// Intercept Meta WhatsApp webhook challenge verification directly in Cloudflare Worker
const handleWorkerMetaWebhookGet = (c: any) => {
  const mode = c.req.query("hub.mode");
  const challenge = c.req.query("hub.challenge");
  if (mode === "subscribe" && challenge) {
    return c.text(challenge);
  }
  return c.json({
    success: true,
    service: "Meta WhatsApp Cloud API Webhook",
    status: "active",
    message: "Ready to receive WhatsApp interactive replies and status payloads from Meta."
  });
};
app.get("/api/webhook/whatsapp", handleWorkerMetaWebhookGet);
app.get("/api/webhooks/whatsapp", handleWorkerMetaWebhookGet);

// Intercept GET/HEAD verification requests for test & Akked webhooks
app.get("/api/v1/webhooks/test", (c) => c.json({
  success: true,
  status: "active",
  message: "Webhook test dispatcher endpoint is active."
}));
app.get("/api/v1/webhooks/akked", (c) => c.json({
  success: true,
  status: "active",
  message: "Akked WhatsApp inbound webhook endpoint is active."
}));

// Direct Cloudflare Edge WhatsApp Status Endpoint (Prevents hanging and 302 proxy redirects)
app.post("/api/whatsapp/status", async (c) => {
  try {
    const { config } = await c.req.json();
    if (!config) {
      return c.json({ success: false, error: "Missing config" }, 400);
    }

    if (config.providerType === 'meta_cloud') {
      const phoneNumberId = (config.phoneNumberId || config.instanceId || '').trim();
      const accessToken = (config.accessToken || config.token || '').trim();
      if (!phoneNumberId || !accessToken) {
        return c.json({ 
          success: false, 
          connected: false, 
          status: 'unconfigured', 
          message: 'يرجى إدخال Phone Number ID و Access Token الخاصين بـ Meta' 
        });
      }

      try {
        const metaRes = await fetch(
          `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status,status&access_token=${accessToken}`
        );
        const data: any = await metaRes.json();

        if (metaRes.ok && (data.id || data.display_phone_number)) {
          let wabaData: any = null;
          if (config.wabaId) {
            try {
              const wRes = await fetch(
                `https://graph.facebook.com/v21.0/${config.wabaId.trim()}?fields=id,name,currency,timezone_id,account_review_status&access_token=${accessToken}`
              );
              wabaData = await wRes.json();
            } catch (_) {}
          }

          return c.json({
            success: true,
            connected: true,
            status: 'authenticated',
            phone: data.display_phone_number || data.id,
            name: data.verified_name || wabaData?.name || 'Abdo Media - واتساب',
            qualityRating: data.quality_rating,
            codeVerificationStatus: data.code_verification_status,
            wabaData
          });
        } else {
          const errCode = data.error?.code;
          const errSubcode = data.error?.error_subcode;
          let detail = data.error?.message || 'تعذر التحقق من إعدادات Meta Cloud API';

          if (errCode === 190) {
            detail = 'رمز الوصول (Access Token) منتهي الصلاحية أو غير صالح. يرجى إنشاء Permanent Token من System Users في Meta Business Suite.';
          } else if (errCode === 33 || errSubcode === 33) {
            // Auto check if this was WABA ID
            try {
              const pRes = await fetch(
                `https://graph.facebook.com/v21.0/${phoneNumberId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status&access_token=${accessToken}`
              );
              const pData: any = await pRes.json();
              if (pRes.ok && pData.data && pData.data.length > 0) {
                const first = pData.data[0];
                return c.json({
                  success: true,
                  connected: true,
                  status: 'authenticated',
                  phone: first.display_phone_number || first.id,
                  name: first.verified_name || 'Abdo Media - واتساب',
                  qualityRating: first.quality_rating,
                  autoResolvedPhoneNumberId: first.id,
                  notice: `تم اكتشاف أن الرقم المدخل هو WABA ID، وتم استخراج Phone Number ID الصحيح تلقائياً: ${first.id}`
                });
              }
            } catch (_) {}
            detail = 'معرف رقم الهاتف (Phone Number ID) غير صحيح. يرجى التأكد من نسخ Phone Number ID وليس WABA ID.';
          }

          return c.json({
            success: false,
            connected: false,
            status: 'error',
            error: detail,
            metaError: data.error
          });
        }
      } catch (err: any) {
        return c.json({ success: false, connected: false, error: `خطأ أثناء الاتصال بميتا: ${err.message}` });
      }
    }

    // UltraMsg provider
    const instanceId = (config.instanceId || '').replace(/\s+/g, '');
    const token = (config.token || '').trim();

    if (!instanceId || !token) {
      return c.json({
        success: false,
        connected: false,
        status: 'unconfigured',
        message: 'يرجى إدخال Instance ID و Token الخاص بـ UltraMsg'
      });
    }

    try {
      const statusRes = await fetch(`https://api.ultramsg.com/${instanceId}/instance/status?token=${token}`);
      const statusData: any = await statusRes.json();

      if (!statusRes.ok || statusData.error) {
        return c.json({
          success: false,
          connected: false,
          status: 'disconnected',
          error: statusData.error || 'فشل الاتصال بـ UltraMsg'
        });
      }

      const isAuth = statusData.status?.account_status === 'authenticated' || 
                     statusData.status === 'authenticated' || 
                     statusData.account_status === 'authenticated';

      return c.json({
        success: true,
        connected: isAuth,
        status: isAuth ? 'authenticated' : 'disconnected',
        phone: statusData.status?.phone || config.sessionPhone || '',
        rawStatus: statusData
      });
    } catch (err: any) {
      return c.json({ success: false, connected: false, error: err.message });
    }
  } catch (err: any) {
    return c.json({ success: false, connected: false, error: err.message }, 500);
  }
});

// Direct Cloudflare Edge WhatsApp Send Endpoint
app.post("/api/whatsapp/send", async (c) => {
  try {
    const { to, body, footer, buttons, config, templateParameters, templateComponents } = await c.req.json();
    
    if (!config || !config.isActive) {
      return c.json({ success: false, error: "WhatsApp integration is not active." }, 400);
    }

    let cleanTo = (to || '').toString().replace(/\D/g, '').replace(/^00+/, '');
    if (cleanTo.startsWith('0') && cleanTo.length === 11) {
      cleanTo = '2' + cleanTo;
    } else if (cleanTo.startsWith('1') && cleanTo.length === 10) {
      cleanTo = '20' + cleanTo;
    }

    if (!cleanTo || cleanTo.length < 8) {
      return c.json({ success: false, error: "رقم هاتف المستلم غير صحيح أو ناقص." }, 400);
    }

    if (config.providerType === 'meta_cloud') {
      const phoneNumberId = (config.phoneNumberId || config.instanceId || '').trim();
      const accessToken = (config.accessToken || config.token || '').trim();

      if (!phoneNumberId || !accessToken) {
        return c.json({ success: false, error: "Meta Cloud API requires Phone Number ID and Access Token." }, 400);
      }

      const storeDisplayName = config.storeName || '';
      const cleanFooter = footer 
        ? footer.replace(/{storeName}/g, storeDisplayName).replace(/\[اسم المتجر\]/g, storeDisplayName) 
        : undefined;
      const cleanBody = body 
        ? body.replace(/{storeName}/g, storeDisplayName).replace(/\[اسم المتجر\]/g, storeDisplayName) 
        : '';

      let fullBodyText = cleanBody;
      if (cleanFooter) fullBodyText += `\n\n📌 ${cleanFooter}`;

      let metaPayload: any;

      if (config.metaTemplateName && config.metaTemplateName.trim()) {
        const components: any[] = [];
        if (templateComponents && Array.isArray(templateComponents) && templateComponents.length > 0) {
          components.push(...templateComponents);
        } else if (templateParameters && Array.isArray(templateParameters) && templateParameters.length > 0) {
          const validParams = templateParameters.map((p: any) => ({
            type: "text",
            text: String(p !== undefined && p !== null && p !== '' ? p : ' ').trim() || '-'
          }));
          if (validParams.length > 0) {
            components.push({ type: "body", parameters: validParams });
          }
        }

        metaPayload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanTo,
          type: "template",
          template: {
            name: config.metaTemplateName.trim(),
            language: { code: config.metaTemplateLanguage?.trim() || "ar" },
            ...(components.length > 0 ? { components } : {})
          }
        };
      } else if (buttons && Array.isArray(buttons) && buttons.length > 0 && buttons.length <= 3 && cleanBody.length <= 1024) {
        const safeFooter = cleanFooter ? [...cleanFooter.trim()].slice(0, 60).join('') : undefined;
        metaPayload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanTo,
          type: "interactive",
          interactive: {
            type: "button",
            body: { text: cleanBody.trim() || 'إشعار من المتجر' },
            footer: safeFooter ? { text: safeFooter } : undefined,
            action: {
              buttons: buttons.map((b: any, idx: number) => {
                const rawTitle = typeof b === 'string' ? b : (b.text || b.title || `زر ${idx + 1}`);
                const title = [...(rawTitle.replace(/{storeName}/g, storeDisplayName).replace(/\[اسم المتجر\]/g, storeDisplayName).trim() || `زر ${idx + 1}`)].slice(0, 20).join('');
                const id = (typeof b === 'object' && b.id ? b.id : `btn_${idx + 1}`).substring(0, 256);
                return { type: "reply", reply: { id, title } };
              })
            }
          }
        };
      } else {
        metaPayload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanTo,
          type: "text",
          text: { body: fullBodyText }
        };
      }

      const metaRes = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify(metaPayload)
      });

      const data: any = await metaRes.json();

      if (metaRes.ok && data.messages && data.messages.length > 0) {
        return c.json({ success: true, messageId: data.messages[0].id, raw: data });
      }

      // If interactive failed, fallback to plain text once
      if (metaPayload.type !== 'text') {
        try {
          const fallbackRes = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: cleanTo,
              type: "text",
              text: { body: fullBodyText }
            })
          });
          const fallbackData: any = await fallbackRes.json();
          if (fallbackRes.ok && fallbackData.messages) {
            return c.json({ success: true, messageId: fallbackData.messages[0].id, raw: fallbackData, fallback: true });
          }
        } catch (_) {}
      }

      const errMessage = data.error?.message || "فشل إرسال رسالة واتساب عبر Meta Cloud API";
      return c.json({ success: false, error: errMessage, details: data.error }, 400);
    }

    // UltraMsg sender
    const instanceId = (config.instanceId || '').replace(/\s+/g, '');
    const token = (config.token || '').trim();

    if (!instanceId || !token) {
      return c.json({ success: false, error: "UltraMsg requires instanceId and token." }, 400);
    }

    let fullBody = body || '';
    if (footer) fullBody += `\n\n${footer}`;

    const sendRes = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        to: cleanTo,
        body: fullBody
      })
    });

    const sendData: any = await sendRes.json();
    if (sendData.sent === 'true' || sendData.sent === true || sendData.id) {
      return c.json({ success: true, id: sendData.id });
    }

    return c.json({ success: false, error: sendData.message || sendData.error || "فشل الإرسال عبر UltraMsg" }, 400);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});


// Handle WhatsApp Webhook POST from Meta & UltraMsg
const handleWorkerWhatsAppWebhookPost = async (c: any) => {
  try {
    let body: any = {};
    try {
      body = await c.req.json();
    } catch (_) {}

    console.log("[WORKER-META-WEBHOOK-POST] Received payload:", JSON.stringify(body).slice(0, 300));

    // Handle Meta status updates (sent, delivered, read) immediately with 200 OK
    if (body.entry?.[0]?.changes?.[0]?.value?.statuses) {
      return c.json({ success: true, processed: "statuses" });
    }

    const defaultBackend = "https://ais-dev-xcte2r3fyl5agkthujufx4-222930444647.europe-west1.run.app";
    const backendUrl = (c.env && c.env.BACKEND_URL) || defaultBackend;
    const targetUrl = new URL(c.req.url).pathname + new URL(c.req.url).search;
    const fullTargetUrl = new URL(targetUrl, backendUrl).toString();

    const headers = new Headers(c.req.raw.headers);
    headers.set("host", new URL(backendUrl).hostname);
    headers.set("content-type", "application/json");

    try {
      const backendRes = await fetch(fullTargetUrl, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(body),
        redirect: "follow"
      });

      const responseText = await backendRes.text();
      try {
        const parsed = JSON.parse(responseText);
        return c.json(parsed, backendRes.ok ? 200 : 200); // Always return 200 to Meta
      } catch (_) {
        return c.json({ success: true, forwardStatus: backendRes.status });
      }
    } catch (fwdErr: any) {
      console.warn("[WORKER-WEBHOOK-POST-FWD-WARN]", fwdErr?.message);
      // Still return 200 OK to Meta so it does not disable the webhook
      return c.json({ success: true, received: true });
    }
  } catch (err: any) {
    console.error("[WORKER-META-WEBHOOK-POST-ERR]", err);
    return c.json({ success: true, error: err?.message || "Processed with fallback" });
  }
};

app.post("/api/webhook/whatsapp", handleWorkerWhatsAppWebhookPost);
app.post("/api/webhooks/whatsapp", handleWorkerWhatsAppWebhookPost);

// API Proxy for all backend routes (including Bosta, Turbo, Meta, etc.)
app.all("/api/*", async (c) => {

  const defaultBackend = "https://ais-dev-xcte2r3fyl5agkthujufx4-222930444647.europe-west1.run.app";
  const backendUrl = (c.env && c.env.BACKEND_URL) || defaultBackend;
  
  const url = new URL(c.req.url);
  const targetUrl = new URL(url.pathname + url.search, backendUrl);
  
  console.log(`[WORKER PROXY] Forwarding ${c.req.method} ${url.pathname} to ${targetUrl.toString()}`);
  
  const headers = new Headers(c.req.raw.headers);
  headers.set("host", new URL(backendUrl).hostname);
  
  const reqInit: RequestInit = {
    method: c.req.method,
    headers: headers,
    redirect: "manual"
  };
  
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    try {
      reqInit.body = await c.req.raw.arrayBuffer();
    } catch (e) {
      // Body reading might fail if empty or already read, fallback to nothing
    }
  }
  
  try {
    const res = await fetch(targetUrl.toString(), reqInit);
    
    const resHeaders = new Headers(res.headers);
    resHeaders.delete("content-encoding");
    
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: resHeaders
    });
  } catch (err: any) {
    console.error("[WORKER PROXY ERROR]", err);
    return c.json({ success: false, error: `فشل تمرير الطلب للخادم السحابي: ${err.message}` }, 502);
  }
});

export default app;
