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
  const isAdminAction = action === "admin_list" || action === "admin_update" || action === "admin_claim";
  if (!storeId || (!isAdminAction && (!merchantId || !passcode)) || !["submit", "list", "admin_list", "admin_update", "admin_claim", "merchant_cancel"].includes(action)) {
    return json({ success: false, error: "بيانات الطلب أو التحقق غير مكتملة" }, 400);
  }
  if (storeId.length > 160 || merchantId.length > 160 || passcode.length > 128) {
    return json({ success: false, error: "Invalid request" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ success: false, error: "Server configuration is incomplete" }, 503);
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Administrative reads/updates use a real Supabase session and verify store ownership
  // or a trusted admin flag server-side before using the service role.
  if (isAdminAction) {
    const authorization = request.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ success: false, error: "يلزم تسجيل دخول الإدارة" }, 401);
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ success: false, error: "جلسة الإدارة غير صالحة" }, 401);
    const userId = authData.user.id;

    const [{ data: profile, error: profileError }, { data: membership, error: membershipError }] = await Promise.all([
      admin.from("user_profiles").select("is_admin,phone").eq("user_id", userId).maybeSingle(),
      admin.from("store_memberships").select("role").eq("user_id", userId).eq("store_id", storeId).maybeSingle()
    ]);
    if (profileError || membershipError) {
      return json({ success: false, error: "تعذر التحقق من صلاحيات الإدارة" }, 500);
    }
    let isTrustedAdmin = profile?.is_admin === true;
    // Preserve compatibility with trusted legacy administrators whose flag is
    // still stored in users until their profile has been synchronized.
    if (!isTrustedAdmin && profile?.phone) {
      const { data: legacyAdmin, error: legacyError } = await admin
        .from("users").select("is_admin").eq("phone", profile.phone).maybeSingle();
      if (legacyError) return json({ success: false, error: "تعذر التحقق من صلاحيات الإدارة" }, 500);
      isTrustedAdmin = legacyAdmin?.is_admin === true;
      if (isTrustedAdmin) {
        await admin.from("user_profiles").update({ is_admin: true }).eq("user_id", userId);
      }
    }
    const membershipRole = String(membership?.role || "").toLowerCase();
    const canViewRequests = isTrustedAdmin || Boolean(membershipRole);
    const canManageRequests = isTrustedAdmin || ["owner", "store_owner", "manager"].includes(membershipRole);
    if (action === "admin_list" ? !canViewRequests : !canManageRequests) {
      return json({ success: false, error: "غير مصرح بعرض أو إدارة طلبات هذا المتجر" }, 403);
    }

    if (action === "admin_list") {
      const { data: requests, error } = await admin
        .from("merchant_requests")
        .select("id,storeId,type,typeArabic,amount,notes,date,status,createdAt,merchantId,merchantName,payoutMethod,payoutAccount,receiptImage,transferReference,approvedBy,approvedAt,details")
        .eq("storeId", storeId)
        .order("createdAt", { ascending: false });
      if (error) return json({ success: false, error: "تعذر تحميل طلبات السحب من قاعدة البيانات" }, 500);
      return json({ success: true, requests: requests || [] });
    }

    const requestId = String(body?.requestId || "").trim();
    if (action === "admin_claim") {
      if (!requestId) return json({ success: false, error: "رقم الطلب غير صحيح" }, 400);
      const { data: claimed, error: claimError } = await admin.from("merchant_requests")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", requestId).eq("storeId", storeId).eq("status", "pending")
        .select("id").maybeSingle();
      if (claimError) return json({ success: false, error: "تعذر حجز الطلب للمعالجة" }, 500);
      if (!claimed?.id) return json({ success: false, error: "الطلب قيد المعالجة أو تمت مراجعته بالفعل" }, 409);
      return json({ success: true, id: claimed.id, status: "processing" });
    }
    const status = String(body?.status || "");
    if (!requestId || !["approved", "rejected", "pending"].includes(status)) {
      return json({ success: false, error: "بيانات تحديث الطلب غير صحيحة" }, 400);
    }
    const meta = body?.meta || {};
    const { data: updated, error } = await admin
      .from("merchant_requests")
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...(meta.receiptImage ? { receiptImage: String(meta.receiptImage).slice(0, 2000000) } : {}),
        ...(meta.transferReference ? { transferReference: String(meta.transferReference).slice(0, 300) } : {}),
        ...(meta.approvedBy ? { approvedBy: String(meta.approvedBy).slice(0, 160) } : {}),
        ...(meta.approvedAt ? { approvedAt: String(meta.approvedAt).slice(0, 80) } : {})
      })
      .eq("id", requestId)
      .eq("storeId", storeId)
      .eq("status", status === "approved" || status === "pending" ? "processing" : "pending")
      .select("id")
      .maybeSingle();
    if (!updated?.id) return json({ success: false, error: "الطلب غير موجود أو تمت معالجته بالفعل" }, 409);
    return json({ success: true, id: updated.id, status });
  }

  const { data: store, error: storeError } = await admin
    .from("stores_data").select("settings").eq("id", storeId).maybeSingle();
  if (storeError) return json({ success: false, error: "تعذر التحقق من بيانات المتجر" }, 500);
  if (!store) return json({ success: false, error: "المتجر غير موجود" }, 404);

  const merchant = findMerchant(store.settings || {}, merchantId);
  if (!merchant || String(merchant.passcode || "0000") !== passcode) {
    return json({ success: false, error: "بيانات دخول الموكل غير صحيحة" }, 401);
  }

  if (action === "merchant_cancel") {
    const requestId = String(body?.requestId || "").trim();
    if (!requestId) return json({ success: false, error: "رقم الطلب غير صحيح" }, 400);
    const { data: updated, error } = await admin
      .from("merchant_requests")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("storeId", storeId)
      .eq("merchantId", merchantId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error) return json({ success: false, error: "تعذر إلغاء طلب السحب" }, 500);
    if (!updated?.id) return json({ success: false, error: "الطلب غير موجود أو تمت معالجته بالفعل" }, 409);
    return json({ success: true, id: updated.id, status: "rejected" });
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
