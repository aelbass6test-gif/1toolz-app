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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ success: false, error: "Server auth configuration is incomplete" }, 503);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerData.user) return json({ success: false, error: "Invalid Supabase session" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data: callerProfile, error: profileError } = await admin
    .from("user_profiles")
    .select("is_admin,phone")
    .eq("user_id", callerData.user.id)
    .maybeSingle();

  if (profileError) return json({ success: false, error: "Unable to verify administrator permissions" }, 500);

  // Existing trusted platform admins may have their flag only on the protected
  // legacy user directory row. Authenticated clients cannot edit that flag.
  let callerIsAdmin = Boolean(callerProfile?.is_admin);
  if (!callerIsAdmin && callerProfile?.phone) {
    const { data: legacyAdmin, error: legacyAdminError } = await admin
      .from("users")
      .select("is_admin")
      .eq("phone", callerProfile.phone)
      .maybeSingle();
    if (legacyAdminError) return json({ success: false, error: "Unable to verify administrator permissions" }, 500);
    callerIsAdmin = Boolean(legacyAdmin?.is_admin);
    if (callerIsAdmin) {
      await admin.from("user_profiles").update({ is_admin: true }).eq("user_id", callerData.user.id);
    }
  }
  if (!callerIsAdmin) return json({ success: false, error: "Administrator permission required" }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Invalid request body" }, 400);
  }

  const fullName = String(body.fullName || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const isAdmin = body.isAdmin === true;

  if (!fullName || !phone || !email || !email.includes("@")) {
    return json({ success: false, error: "Name, phone and a valid contact email are required" }, 400);
  }
  if (password.length < 8) return json({ success: false, error: "Password must be at least 8 characters" }, 400);
  if (!/^[+0-9][0-9+() -]{5,24}$/.test(phone)) return json({ success: false, error: "Invalid phone number" }, 400);

  const [{ data: existingUser, error: existingUserError }, { data: existingProfile, error: existingProfileError }] = await Promise.all([
    admin.from("users").select("phone").eq("phone", phone).maybeSingle(),
    admin.from("user_profiles").select("user_id").eq("phone", phone).maybeSingle()
  ]);
  if (existingUserError || existingProfileError) return json({ success: false, error: "Unable to check existing account" }, 500);
  if (existingUser || existingProfile) return json({ success: false, error: "This phone number is already registered" }, 409);

  const authEmail = `${phone}@mystore-auth.app`;
  const { data: createdAuth, error: createAuthError } = await admin.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    user_metadata: { display_name: fullName, phone },
    app_metadata: { is_admin: isAdmin }
  });

  if (createAuthError || !createdAuth.user) {
    return json({ success: false, error: createAuthError?.message || "Unable to create Supabase Auth user" }, 400);
  }

  const userRow = {
    phone,
    full_name: fullName,
    email,
    is_admin: isAdmin,
    is_banned: false,
    join_date: new Date().toISOString(),
    stores: [],
    sites: []
  };
  const { error: insertError } = await admin.from("users").insert(userRow);
  if (insertError) {
    await admin.auth.admin.deleteUser(createdAuth.user.id);
    return json({ success: false, error: insertError.message || "Unable to create user profile" }, 500);
  }

  return json({
    success: true,
    user: {
      fullName,
      phone,
      email,
      isAdmin,
      isBanned: false,
      joinDate: userRow.join_date,
      stores: [],
      sites: []
    }
  }, 201);
});
