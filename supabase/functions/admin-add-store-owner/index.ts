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
  const store = body.store as Record<string, unknown> | undefined;
  const ownerPhone = String(body.ownerPhone || "").trim();
  const storeId = String(store?.id || "").trim();
  if (!store || !storeId || !ownerPhone) return json({ success: false, error: "Store and owner are required" }, 400);

  const [{ data: ownerProfile, error: ownerProfileError }, { data: ownerUser, error: ownerUserError }, { data: storeRow, error: storeError }] = await Promise.all([
    admin.from("user_profiles").select("user_id").eq("phone", ownerPhone).maybeSingle(),
    admin.from("users").select("phone,stores").eq("phone", ownerPhone).maybeSingle(),
    admin.from("stores_data").select("id").eq("id", storeId).maybeSingle()
  ]);
  if (ownerProfileError || ownerUserError || storeError) return json({ success: false, error: "Unable to validate store owner or store record" }, 500);
  if (!ownerProfile?.user_id || !ownerUser) return json({ success: false, error: "The selected owner must have an active Supabase Auth account" }, 409);
  if (!storeRow) return json({ success: false, error: "Store record does not exist" }, 404);

  const { error: membershipError } = await admin.from("store_memberships")
    .upsert({ user_id: ownerProfile.user_id, store_id: storeId, role: "owner" }, { onConflict: "user_id,store_id" });
  if (membershipError) return json({ success: false, error: membershipError.message }, 500);

  const existingStores = Array.isArray(ownerUser.stores) ? ownerUser.stores : [];
  const nextStores = [...existingStores.filter((item: any) => item?.id !== storeId), store];
  const { error: updateUserError } = await admin.from("users").update({ stores: nextStores }).eq("phone", ownerPhone);
  if (updateUserError) return json({ success: false, error: "Membership created but owner store index update failed" }, 500);

  return json({ success: true, ownerPhone, storeId, stores: nextStores });
});
