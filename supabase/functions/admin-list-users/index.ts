import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" }
});

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "GET" && request.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);
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

  const { data, error } = await admin.from("users")
    .select("phone,full_name,email,is_admin,is_banned,join_date,stores,sites,default_store_id,auto_launch_default_store")
    .order("join_date", { ascending: false });
  if (error) return json({ success: false, error: "Unable to load user directory" }, 500);

  const users = (data || []).map(row => ({
    phone: row.phone,
    fullName: row.full_name || "",
    email: row.email || "",
    isAdmin: Boolean(row.is_admin),
    isBanned: Boolean(row.is_banned),
    joinDate: row.join_date || "",
    stores: row.stores || [],
    sites: row.sites || [],
    defaultStoreId: row.default_store_id || undefined,
    autoLaunchDefaultStore: Boolean(row.auto_launch_default_store)
  }));
  return json({ success: true, users });
});
