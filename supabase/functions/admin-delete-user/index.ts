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
  const { data: callerProfile, error: callerProfileError } = await admin.from("user_profiles").select("is_admin,phone").eq("user_id", callerData.user.id).maybeSingle();
  if (callerProfileError) return json({ success: false, error: "Unable to verify administrator permissions" }, 500);
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
  if (phone === callerProfile?.phone) return json({ success: false, error: "You cannot delete your own administrator account" }, 400);

  const { data: targetProfile, error: targetProfileError } = await admin.from("user_profiles").select("user_id").eq("phone", phone).maybeSingle();
  if (targetProfileError) return json({ success: false, error: "Unable to locate account identity" }, 500);
  if (!targetProfile?.user_id) return json({ success: false, error: "Supabase Auth account not found" }, 404);

  const { error: membershipDeleteError } = await admin.from("store_memberships").delete().eq("user_id", targetProfile.user_id);
  if (membershipDeleteError) return json({ success: false, error: "Unable to remove store memberships" }, 500);

  // Remove chat rows first because sender_id references public.users.phone.
  const { error: chatDeleteError } = await admin.from("chat_messages").delete().or(`sender_id.eq.${phone},receiver_id.eq.${phone}`);
  if (chatDeleteError) return json({ success: false, error: "Unable to remove chat history" }, 500);

  const { error: userRowDeleteError } = await admin.from("users").delete().eq("phone", phone);
  if (userRowDeleteError) return json({ success: false, error: "Unable to remove user profile" }, 500);

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(targetProfile.user_id);
  if (authDeleteError) return json({ success: false, error: "Profile removed but Auth identity deletion failed" }, 500);

  return json({ success: true, phone, storesRetained: true });
});
