import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return json({ success: false, error: "Authentication required" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ success: false, error: "Server configuration unavailable" }, 503);

  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data: authData, error: authError } = await callerClient.auth.getUser();
  if (authError || !authData.user || authData.user.is_anonymous) return json({ success: false, error: "جلسة الدخول غير صالحة." }, 401);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ success: false, error: "Invalid request body" }, 400); }

  const storeId = String(body.storeId || "").trim();
  const fullName = String(body.fullName || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const permissions = Array.isArray(body.permissions)
    ? [...new Set(body.permissions.filter((p): p is string => typeof p === "string" && /^[A-Z_]{2,64}$/.test(p)))]
    : [];
  const mode = body.mode === "link" ? "link" : "create";
  const membershipRole = body.membershipRole === "manager" ? "manager" : "staff";

  if (!storeId || !fullName || !phone || !email || !email.includes("@")) return json({ success: false, error: "بيانات الموظف غير مكتملة." }, 400);
  if (!/^[+0-9][0-9+() -]{5,24}$/.test(phone)) return json({ success: false, error: "رقم الهاتف غير صحيح." }, 400);
  if (mode === "create" && password.length < 8) return json({ success: false, error: "كلمة المرور يجب ألا تقل عن 8 أحرف." }, 400);
  if (permissions.length > 40) return json({ success: false, error: "عدد الصلاحيات غير صالح." }, 400);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // A caller can add staff only to a store where this exact Auth user is the owner.
  const { data: ownerMembership, error: ownerError } = await admin
    .from("store_memberships")
    .select("role")
    .eq("store_id", storeId)
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (ownerError) return json({ success: false, error: "تعذر التحقق من ملكية المتجر." }, 500);
  if (ownerMembership?.role !== "owner") return json({ success: false, error: "إضافة الموظفين متاحة لمالك المتجر فقط." }, 403);

  const { data: store, error: storeError } = await admin.from("stores_data").select("id").eq("id", storeId).maybeSingle();
  if (storeError || !store) return json({ success: false, error: "المتجر غير موجود." }, 404);

  let employeeAuthId: string | null = null;
  let createdAuthUser = false;
  let userRowCreated = false;
  let profileCreated = false;
  let membershipCreated = false;
  let employeeCreated = false;

  try {
    const { data: existingUserRow, error: existingUserError } = await admin
      .from("users").select("phone,email,full_name").eq("phone", phone).maybeSingle();
    if (existingUserError) throw new Error("تعذر التحقق من حساب الموظف.");
    if (mode === "link" && !existingUserRow) throw new Error("لا يوجد حساب Supabase مسجل بهذا الرقم. لا يمكن ربط حساب Firebase قديم تلقائياً.");
    if (mode === "create" && existingUserRow) throw new Error("رقم الهاتف مسجل بالفعل. استخدم ربط الحساب الموجود.");

    const { data: existingProfile, error: profileLookupError } = await admin
      .from("user_profiles").select("user_id,phone").eq("phone", phone).maybeSingle();
    if (profileLookupError) throw new Error("تعذر التحقق من هوية الموظف.");

    if (mode === "link") {
      if (!existingProfile?.user_id) throw new Error("الحساب موجود في دليل المستخدمين لكنه غير مربوط بهوية Supabase موثقة.");
      employeeAuthId = existingProfile.user_id;
    } else {
      if (existingProfile) throw new Error("رقم الهاتف مرتبط بحساب مصادقة بالفعل.");
      const authEmail = `${phone}@mystore-auth.app`;
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
        user_metadata: { display_name: fullName, phone }
      });
      if (createError || !created.user) throw new Error(createError?.message || "تعذر إنشاء حساب الدخول.");
      employeeAuthId = created.user.id;
      createdAuthUser = true;

      const { error: userInsertError } = await admin.from("users").insert({
        phone, full_name: fullName, email, is_admin: false, is_banned: false,
        join_date: new Date().toISOString(), stores: [], sites: []
      });
      if (userInsertError) throw new Error(userInsertError.message || "تعذر إنشاء ملف الموظف.");
      userRowCreated = true;

      const { error: profileInsertError } = await admin.from("user_profiles").insert({
        user_id: employeeAuthId, display_name: fullName, phone, is_admin: false
      });
      if (profileInsertError) throw new Error(profileInsertError.message || "تعذر ربط هوية الموظف.");
      profileCreated = true;
    }

    const { data: priorMembership, error: membershipLookupError } = await admin
      .from("store_memberships").select("role").eq("user_id", employeeAuthId).eq("store_id", storeId).maybeSingle();
    if (membershipLookupError) throw new Error("تعذر التحقق من عضوية الموظف.");
    if (priorMembership) throw new Error("هذا الحساب عضو بالفعل في المتجر.");

    const { error: membershipError } = await admin.from("store_memberships").insert({
      user_id: employeeAuthId, store_id: storeId, role: membershipRole
    });
    if (membershipError) throw new Error(membershipError.message || "تعذر إنشاء عضوية الموظف.");
    membershipCreated = true;

    const { error: employeeError } = await admin.from("employees").insert({
      store_id: storeId, phone, name: fullName, email, permissions, status: "active"
    });
    if (employeeError) throw new Error(employeeError.message || "تعذر حفظ سجل الموظف.");
    employeeCreated = true;

    return json({ success: true, user: { fullName, phone, email }, membershipRole }, 201);
  } catch (error) {
    if (employeeCreated) await admin.from("employees").delete().eq("store_id", storeId).eq("phone", phone);
    if (membershipCreated && employeeAuthId) await admin.from("store_memberships").delete().eq("store_id", storeId).eq("user_id", employeeAuthId);
    if (profileCreated && employeeAuthId) await admin.from("user_profiles").delete().eq("user_id", employeeAuthId);
    if (userRowCreated) await admin.from("users").delete().eq("phone", phone);
    if (createdAuthUser && employeeAuthId) await admin.auth.admin.deleteUser(employeeAuthId);
    const message = error instanceof Error ? error.message : "تعذر إتمام إضافة الموظف.";
    return json({ success: false, error: message }, 400);
  }
});
