import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const ALLOWED_PERMISSIONS = new Set([
  "DASHBOARD_VIEW", "REPORTS_VIEW", "ORDERS_VIEW", "ORDERS_MANAGE", "RETURNS_MANAGE",
  "POS_VIEW", "POS_MANAGE", "PRODUCTS_VIEW", "PRODUCTS_MANAGE", "INVENTORY_MANAGE",
  "COLLECTIONS_MANAGE", "CUSTOMERS_VIEW", "CUSTOMERS_MANAGE", "MARKETING_MANAGE",
  "DISCOUNTS_MANAGE", "REVIEWS_MANAGE", "WALLET_VIEW", "WALLET_MANAGE", "CASH_MANAGE",
  "EXPENSES_MANAGE", "SETTINGS_VIEW", "SETTINGS_MANAGE", "APPS_MANAGE",
  "STOREFRONT_MANAGE", "TEAM_VIEW", "TEAM_MANAGE"
]);

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
    ? [...new Set(body.permissions.filter((p): p is string => typeof p === "string" && ALLOWED_PERMISSIONS.has(p)))]
    : [];
  const mode = body.mode === "link" ? "link" : "create";
  const membershipRole = body.membershipRole === "manager" ? "manager" : "staff";

  if (!storeId || !fullName || !phone || !email || !email.includes("@")) return json({ success: false, error: "بيانات الموظف غير مكتملة." }, 400);
  if (!/^[+0-9][0-9+() -]{5,24}$/.test(phone)) return json({ success: false, error: "رقم الهاتف غير صحيح." }, 400);
  if (mode === "create" && password.length < 8) return json({ success: false, error: "كلمة المرور يجب ألا تقل عن 8 أحرف." }, 400);
  if (permissions.length > 26) return json({ success: false, error: "عدد الصلاحيات غير صالح." }, 400);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const action = String(body.action || "create");

  const { data: store, error: storeError } = await admin.from("stores_data").select("id").eq("id", storeId).maybeSingle();
  if (storeError || !store) return json({ success: false, error: "المتجر غير موجود." }, 404);

  // Applicants may submit only for their own authenticated phone identity.
  // The request is stored relationally, not in the store settings document.
  if (action === "submit_request") {
    const authPhone = String(authData.user.user_metadata?.phone || "").trim();
    if (!authPhone || authPhone !== phone) return json({ success: false, error: "رقم الهاتف لا يطابق حساب الدخول الحالي." }, 403);
    const { data: existingMembership, error: membershipLookupError } = await admin
      .from("store_memberships").select("role").eq("store_id", storeId).eq("user_id", authData.user.id).maybeSingle();
    if (membershipLookupError) return json({ success: false, error: "تعذر التحقق من عضوية المتجر." }, 500);
    if (existingMembership) return json({ success: false, error: "أنت عضو بالفعل في هذا المتجر." }, 409);

    const { error: profileError } = await admin.from("user_profiles").upsert({
      user_id: authData.user.id, phone, display_name: fullName, is_admin: false
    }, { onConflict: "user_id" });
    if (profileError) return json({ success: false, error: "تعذر ربط هوية حساب الموظف." }, 400);

    const { error: requestError } = await admin.from("employees").insert({
      store_id: storeId, phone, name: fullName, email, permissions: [], status: "pending"
    });
    if (requestError) {
      if (requestError.code === "23505") return json({ success: false, error: "لديك طلب انضمام مسجل بالفعل في هذا المتجر." }, 409);
      return json({ success: false, error: "تعذر حفظ طلب الانضمام." }, 400);
    }
    return json({ success: true, status: "pending" }, 201);
  }

  // All management actions require this exact Auth user to own the store.
  const { data: ownerMembership, error: ownerError } = await admin
    .from("store_memberships")
    .select("role")
    .eq("store_id", storeId)
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (ownerError) return json({ success: false, error: "تعذر التحقق من ملكية المتجر." }, 500);
  if (ownerMembership?.role !== "owner") return json({ success: false, error: "إدارة الموظفين متاحة لمالك المتجر فقط." }, 403);
  if (["update", "delete", "reset_password", "accept_request", "decline_request"].includes(action)) {
    const targetPhone = String(body.phone || "").trim();
    if (!targetPhone) return json({ success: false, error: "رقم الموظف مطلوب." }, 400);
    const { data: profile, error: profileError } = await admin.from("user_profiles").select("user_id").eq("phone", targetPhone).maybeSingle();
    if (profileError) return json({ success: false, error: "تعذر التحقق من حساب الموظف." }, 500);
    if (!profile?.user_id) return json({ success: false, error: "حساب الموظف غير مربوط بهوية Supabase موثقة." }, 409);
    const targetUserId = profile.user_id;

    if (action === "accept_request" || action === "decline_request") {
      const { data: pendingEmployee, error: pendingError } = await admin
        .from("employees").select("status").eq("store_id", storeId).eq("phone", targetPhone).maybeSingle();
      if (pendingError) return json({ success: false, error: "تعذر قراءة طلب الموظف." }, 500);
      if (!pendingEmployee || !["pending", "invited"].includes(String(pendingEmployee.status || ""))) {
        return json({ success: false, error: "طلب الانضمام غير موجود أو تمت معالجته مسبقاً." }, 409);
      }
      const { data: currentMembership, error: currentMembershipError } = await admin
        .from("store_memberships").select("role").eq("store_id", storeId).eq("user_id", targetUserId).maybeSingle();
      if (currentMembershipError) return json({ success: false, error: "تعذر التحقق من عضوية الموظف." }, 500);
      if (action === "accept_request") {
        if (currentMembership) return json({ success: false, error: "الحساب عضو بالفعل في المتجر." }, 409);
        const { error: insertMembershipError } = await admin.from("store_memberships").insert({
          store_id: storeId, user_id: targetUserId, role: "staff"
        });
        if (insertMembershipError) return json({ success: false, error: "تعذر تفعيل عضوية الموظف." }, 400);
        const { error: activateError } = await admin.from("employees").update({ status: "active" }).eq("store_id", storeId).eq("phone", targetPhone);
        if (activateError) {
          await admin.from("store_memberships").delete().eq("store_id", storeId).eq("user_id", targetUserId);
          return json({ success: false, error: "تعذر تحديث حالة الطلب؛ تم التراجع عن العضوية." }, 500);
        }
        return json({ success: true });
      }
      if (currentMembership) return json({ success: false, error: "لا يمكن رفض الطلب بعد إنشاء عضوية فعلية." }, 409);
      const { error: declineError } = await admin.from("employees").delete().eq("store_id", storeId).eq("phone", targetPhone);
      if (declineError) return json({ success: false, error: "تعذر رفض طلب الموظف." }, 400);
      return json({ success: true });
    }

    const { data: membership, error: membershipError } = await admin.from("store_memberships").select("role").eq("store_id", storeId).eq("user_id", targetUserId).maybeSingle();
    if (membershipError) return json({ success: false, error: "تعذر التحقق من عضوية الموظف." }, 500);
    if (!membership || membership.role === "owner") return json({ success: false, error: "الموظف غير موجود أو لا يمكن تعديل المالك." }, 404);

    if (action === "reset_password") {
      const nextPassword = String(body.password || "");
      if (nextPassword.length < 8) return json({ success: false, error: "كلمة المرور يجب ألا تقل عن 8 أحرف." }, 400);
      const { error } = await admin.auth.admin.updateUserById(targetUserId, { password: nextPassword });
      if (error) return json({ success: false, error: "تعذر تحديث كلمة مرور الموظف." }, 400);
      return json({ success: true });
    }

    if (action === "delete") {
      const { error: employeeDeleteError } = await admin.from("employees").delete().eq("store_id", storeId).eq("phone", targetPhone);
      if (employeeDeleteError) return json({ success: false, error: "تعذر حذف سجل الموظف." }, 400);
      const { error: membershipDeleteError } = await admin.from("store_memberships").delete().eq("store_id", storeId).eq("user_id", targetUserId);
      if (membershipDeleteError) return json({ success: false, error: "تم حذف سجل الموظف لكن تعذر إنهاء عضويته؛ راجع العضويات." }, 500);
      // Keep the Auth user and global profile: the same person may belong to other stores.
      return json({ success: true });
    }

    const nextName = String(body.fullName || "").trim();
    const nextEmail = String(body.email || "").trim().toLowerCase();
    const nextPermissions = Array.isArray(body.permissions)
      ? [...new Set(body.permissions.filter((p): p is string => typeof p === "string" && ALLOWED_PERMISSIONS.has(p)))]
      : [];
    const nextRole = body.membershipRole === "manager" ? "manager" : "staff";
    if (!nextName || !nextEmail.includes("@") || nextPermissions.length > 26) return json({ success: false, error: "بيانات التعديل غير صالحة." }, 400);
    const { error: employeeUpdateError } = await admin.from("employees").update({ name: nextName, email: nextEmail, permissions: nextPermissions }).eq("store_id", storeId).eq("phone", targetPhone);
    if (employeeUpdateError) return json({ success: false, error: "تعذر تحديث بيانات الموظف." }, 400);
    const { error: membershipUpdateError } = await admin.from("store_memberships").update({ role: nextRole }).eq("store_id", storeId).eq("user_id", targetUserId);
    if (membershipUpdateError) return json({ success: false, error: "تم تحديث بيانات الموظف لكن تعذر تحديث دوره؛ راجع العضوية." }, 500);
    const { error: userUpdateError } = await admin.from("users").update({ full_name: nextName, email: nextEmail }).eq("phone", targetPhone);
    if (userUpdateError) return json({ success: false, error: "تم تحديث عضوية الموظف لكن تعذر تحديث ملفه العام." }, 500);
    const { error: profileUpdateError } = await admin.from("user_profiles").update({ display_name: nextName }).eq("user_id", targetUserId);
    if (profileUpdateError) return json({ success: false, error: "تم تحديث بيانات الموظف لكن تعذر تحديث ملف المصادقة." }, 500);
    return json({ success: true });
  }

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
