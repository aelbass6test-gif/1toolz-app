import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" }
});

const findMerchant = (settings: any, merchantId: string) => {
  const values = (v: any) => Array.isArray(v) ? v : (v && typeof v === "object" ? Object.values(v) : []);
  return [...values(settings?.suppliers), ...values(settings?.partners)]
    .find((m: any) => String(m?.id || "") === merchantId);
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  let body: any;
  try { body = await request.json(); } catch { return json({ success: false, error: "Invalid JSON body" }, 400); }
  const storeId = String(body?.storeId || "").trim();
  const merchantId = String(body?.merchantId || "").trim();
  const passcode = String(body?.passcode || "");
  const action = String(body?.action || "");
  if (!storeId || !merchantId || !passcode || !["submit", "list"].includes(action)) {
    return json({ success: false, error: "بيانات الطلب أو التحقق غير مكتملة" }, 400);
  }
  if (storeId.length > 160 || merchantId.length > 160 || passcode.length > 128) {
    return json({ success: false, error: "Invalid request" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ success: false, error: "Server configuration is incomplete" }, 503);
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: store, error: storeError } = await admin
    .from("stores_data").select("settings").eq("id", storeId).maybeSingle();
  if (storeError) return json({ success: false, error: "تعذر التحقق من بيانات المتجر" }, 500);
  if (!store) return json({ success: false, error: "المتجر غير موجود" }, 404);

  const merchant = findMerchant(store.settings || {}, merchantId);
  if (!merchant || String(merchant.passcode || "0000") !== passcode) {
    return json({ success: false, error: "بيانات دخول الموكل غير صحيحة" }, 401);
  }

  if (action === "submit") {
    const req = body.request || {};
    const amount = Number(req.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
      return json({ success: false, error: "مبلغ السحب غير صحيح" }, 400);
    }
    const { data, error } = await admin.rpc("submit_merchant_withdrawal_request", {
      p_store_id: storeId,
      p_merchant_id: merchantId,
      p_passcode: passcode,
      p_request: {
        amount,
        notes: String(req.notes || "").slice(0, 2000),
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        typeArabic: String(req.typeArabic || "طلب سحب مستحقات").slice(0, 120),
        payoutMethod: String(req.payoutMethod || "").slice(0, 80),
        payoutAccount: String(req.payoutAccount || "").slice(0, 300),
        transferFee: Number(req.transferFee || 0),
        netAmount: Number(req.netAmount ?? amount),
        payoutFrequency: String(req.payoutFrequency || "")
      }
    });
    if (error) return json({ success: false, error: error.message || "تعذر حفظ طلب السحب" }, 400);
    return json(data);
  }

  const { data: requests, error: requestError } = await admin
    .from("merchant_requests")
    .select("id,storeId,type,typeArabic,amount,notes,date,status,createdAt,merchantId,merchantName,payoutMethod,payoutAccount,receiptImage,transferReference,approvedBy,approvedAt,details")
    .eq("storeId", storeId)
    .eq("merchantId", merchantId)
    .order("createdAt", { ascending: false });
  if (requestError) return json({ success: false, error: "تعذر تحميل طلبات السحب" }, 500);
  return json({ success: true, requests: requests || [] });
});
