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

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return json({ success: false, error: "Authentication required" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return json({ success: false, error: "Server auth configuration is incomplete" }, 503);

  const callerClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { autoRefreshToken: false, persistSession: false } });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerData.user) return json({ success: false, error: "Invalid Supabase session" }, 401);

  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: callerProfile, error: profileError } = await admin.from("user_profiles").select("is_admin,phone").eq("user_id", callerData.user.id).maybeSingle();
  if (profileError) return json({ success: false, error: "Unable to verify administrator permissions" }, 500);
  let isAdmin = Boolean(callerProfile?.is_admin);
  if (!isAdmin && callerProfile?.phone) {
    const { data: legacyAdmin, error } = await admin.from("users").select("is_admin").eq("phone", callerProfile.phone).maybeSingle();
    if (error) return json({ success: false, error: "Unable to verify administrator permissions" }, 500);
    isAdmin = Boolean(legacyAdmin?.is_admin);
    if (isAdmin) await admin.from("user_profiles").update({ is_admin: true }).eq("user_id", callerData.user.id);
  }
  if (!isAdmin) return json({ success: false, error: "Administrator permission required" }, 403);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ success: false, error: "Invalid request body" }, 400); }
  const phone = String(body.phone || "").trim();
  if (!phone) return json({ success: false, error: "Phone is required" }, 400);

  const patch: Record<string, unknown> = {};
  if (typeof body.fullName === "string") patch.full_name = body.fullName.trim();
  if (typeof body.email === "string") patch.email = body.email.trim().toLowerCase();
  if (typeof body.isAdmin === "boolean") patch.is_admin = body.isAdmin;
  if (typeof body.isBanned === "boolean") patch.is_banned = body.isBanned;
  if (Array.isArray(body.stores)) patch.stores = body.stores;
  if (Array.isArray(body.sites)) patch.sites = body.sites;
  if (typeof body.defaultStoreId === "string" || body.defaultStoreId === null) patch.default_store_id = body.defaultStoreId;
  if (typeof body.autoLaunchDefaultStore === "boolean") patch.auto_launch_default_store = body.autoLaunchDefaultStore;
  if (!Object.keys(patch).length) return json({ success: false, error: "No supported changes supplied" }, 400);

  const { data: updated, error: updateError } = await admin.from("users").update(patch).eq("phone", phone)
    .select("phone,full_name,email,is_admin,is_banned,join_date,stores,sites,default_store_id,auto_launch_default_store").maybeSingle();
  if (updateError) return json({ success: false, error: updateError.message }, 500);
  if (!updated) return json({ success: false, error: "User not found" }, 404);

  const { data: targetProfile, error: targetProfileError } = await admin.from("user_profiles").select("user_id").eq("phone", phone).maybeSingle();
  if (targetProfileError) return json({ success: false, error: "User profile lookup failed" }, 500);
  if (targetProfile?.user_id && (typeof body.isAdmin === "boolean" || typeof body.isBanned === "boolean")) {
    const { data: targetAuth } = await admin.auth.admin.getUserById(targetProfile.user_id);
    const appMetadata = {
      ...(targetAuth.user?.app_metadata || {}),
      ...(typeof body.isAdmin === "boolean" ? { is_admin: body.isAdmin } : {}),
      ...(typeof body.isBanned === "boolean" ? { is_banned: body.isBanned } : {})
    };
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(targetProfile.user_id, { app_metadata: appMetadata });
    if (authUpdateError) return json({ success: false, error: "Profile updated but Auth metadata sync failed" }, 500);
    if (typeof body.isAdmin === "boolean") {
      const { error: adminFlagError } = await admin.from("user_profiles").update({ is_admin: body.isAdmin }).eq("user_id", targetProfile.user_id);
      if (adminFlagError) return json({ success: false, error: "Profile updated but admin authorization sync failed" }, 500);
    }
  }

  return json({
    success: true,
    user: {
      phone: updated.phone,
      fullName: updated.full_name || "",
      email: updated.email || "",
      isAdmin: Boolean(updated.is_admin),
      isBanned: Boolean(updated.is_banned),
      joinDate: updated.join_date || "",
      stores: updated.stores || [],
      sites: updated.sites || [],
      defaultStoreId: updated.default_store_id || undefined,
      autoLaunchDefaultStore: Boolean(updated.auto_launch_default_store)
    }
  });
});
