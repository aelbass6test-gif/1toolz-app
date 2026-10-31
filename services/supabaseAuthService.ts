import { getSupabaseClient } from "./databaseService";

/**
 * Backward-compatible auth facade. The implementation is Cloudflare Worker +
 * D1 and uses an HttpOnly session cookie; no Supabase SDK or bearer token is
 * sent to the browser.
 */
export interface CloudflareAuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  user_metadata?: Record<string, unknown>;
  is_anonymous?: boolean;
  email_confirmed_at?: string | null;
  app_metadata?: Record<string, unknown>;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  phone?: string;
}

export function getAuthSupabaseClient(): any {
  const client = getSupabaseClient();
  if (!client) throw new Error("Cloudflare Worker API غير متاح في هذا السياق.");
  return client;
}

export async function signUpWithSupabase(input: SignUpInput): Promise<CloudflareAuthUser> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const phone = input.phone?.trim() || "";
  if (!email || !email.includes("@")) throw new Error("أدخل بريدًا إلكترونيًا صحيحًا.");
  if (input.password.length < 10) throw new Error("كلمة المرور يجب ألا تقل عن 10 أحرف.");
  if (!displayName) throw new Error("أدخل الاسم بالكامل.");

  const { data, error } = await getAuthSupabaseClient().auth.signUp({
    email,
    password: input.password,
    options: { data: { display_name: displayName, ...(phone ? { phone } : {}) } }
  });
  if (error) throw new Error(error.message || "تعذر إنشاء الحساب.");
  if (!data.user) throw new Error("لم يتم إنشاء الحساب. حاول مرة أخرى.");
  return data.user as CloudflareAuthUser;
}

export async function signInWithSupabase(login: string, password: string): Promise<CloudflareAuthUser> {
  const normalized = login.trim();
  const { data, error } = await getAuthSupabaseClient().auth.signInWithPassword({
    email: normalized,
    password
  });
  if (error) throw new Error(error.message || "بيانات الدخول غير صحيحة.");
  if (!data.user) throw new Error("تعذر التحقق من الحساب.");
  return data.user as CloudflareAuthUser;
}

export async function getSupabaseSession(): Promise<any | null> {
  const { data, error } = await getAuthSupabaseClient().auth.getSession();
  if (error) throw new Error(error.message || "تعذر قراءة جلسة الدخول.");
  return data.session;
}

export function onSupabaseAuthStateChange(callback: (event: string, session: any) => void): () => void {
  const { data } = getAuthSupabaseClient().auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

export async function requestSupabasePasswordReset(login: string, _redirectTo?: string): Promise<void> {
  const normalized = login.trim().toLowerCase();
  if (!normalized) throw new Error("أدخل رقم الهاتف أو البريد الإلكتروني.");
  const { error } = await getAuthSupabaseClient().auth.resetPasswordForEmail(normalized);
  if (error) throw new Error(error.message || "تعذر بدء استعادة الحساب.");
}

export async function updateSupabasePassword(password: string): Promise<CloudflareAuthUser> {
  if (password.length < 10) throw new Error("كلمة المرور يجب ألا تقل عن 10 أحرف.");
  const { data, error } = await getAuthSupabaseClient().auth.updateUser({ password });
  if (error) throw new Error(error.message || "تعذر تحديث كلمة المرور.");
  if (!data.user) throw new Error("تعذر تحديث بيانات الحساب.");
  return data.user as CloudflareAuthUser;
}

/** Legacy token-hash links are no longer used; D1 verifies one-time six-digit OTPs. */
export async function verifySupabaseEmailOtp(_tokenHash: string, _type: string): Promise<CloudflareAuthUser> {
  throw new Error("روابط التحقق القديمة لم تعد مستخدمة. أدخل رمز التحقق المرسل إلى بريدك الإلكتروني.");
}

export async function signOutFromSupabase(): Promise<void> {
  const { error } = await getAuthSupabaseClient().auth.signOut();
  if (error) throw new Error(error.message || "تعذر تسجيل الخروج.");
}

export async function getSupabaseAuthUser(): Promise<CloudflareAuthUser | null> {
  const { data, error } = await getAuthSupabaseClient().auth.getUser();
  if (error) throw new Error(error.message || "تعذر التحقق من جلسة الدخول.");
  return (data.user as CloudflareAuthUser | null) || null;
}

export async function resendSupabaseSignupConfirmation(email: string, _redirectTo?: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const { error } = await getAuthSupabaseClient().auth.resend({ type: "signup", email: normalized });
  if (error) throw new Error(error.message || "تعذر إعادة إرسال رمز التفعيل.");
}
