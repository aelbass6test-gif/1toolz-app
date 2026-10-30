import {
  createClient,
  type AuthChangeEvent,
  type EmailOtpType,
  type Session,
  type SupabaseClient,
  type User
} from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * The application must use one project-level Supabase client.
 * Never accept per-store URLs/keys from localStorage or store settings.
 */
export function getAuthSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY
  ) as string | undefined;

  if (!url || !key || !/^https:\/\//.test(url)) {
    throw new Error('إعدادات Supabase غير مكتملة. يرجى التواصل مع مسؤول النظام.');
  }

  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    }
  });
  return client;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  phone?: string;
}

/** Creates a new Supabase Auth identity; no legacy password is read or copied. */
export async function signUpWithSupabase(input: SignUpInput): Promise<User> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const phone = input.phone?.trim() || '';

  if (!email || !email.includes('@')) throw new Error('أدخل بريدًا إلكترونيًا صحيحًا.');
  if (input.password.length < 8) throw new Error('كلمة المرور يجب ألا تقل عن 8 أحرف.');
  if (!displayName) throw new Error('أدخل الاسم بالكامل.');

  const { data, error } = await getAuthSupabaseClient().auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        display_name: displayName,
        ...(phone ? { phone } : {})
      }
    }
  });

  if (error) throw error;
  if (!data.user) throw new Error('لم يتم إنشاء الحساب. حاول مرة أخرى.');
  return data.user;
}

export async function signInWithSupabase(email: string, password: string): Promise<User> {
  const { data, error } = await getAuthSupabaseClient().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });
  if (error) throw error;
  if (!data.user) throw new Error('تعذر التحقق من الحساب.');
  return data.user;
}

/** Read the locally persisted session; Supabase handles refresh-token rotation. */
export async function getSupabaseSession(): Promise<Session | null> {
  const { data, error } = await getAuthSupabaseClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

/** Subscribe to sign-in, sign-out, token refresh, and initial-session events. */
export function onSupabaseAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): () => void {
  const { data } = getAuthSupabaseClient().auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

/**
 * Send a password-reset email. The redirect must be an absolute URL on the
 * current application origin and must also be allow-listed in Supabase Auth.
 */
export async function requestSupabasePasswordReset(
  email: string,
  redirectTo: string
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('أدخل بريدًا إلكترونيًا صحيحًا.');
  }
  if (typeof window === 'undefined') {
    throw new Error('لا يمكن بدء استعادة كلمة المرور من هذا السياق.');
  }

  let redirectUrl: URL;
  try {
    redirectUrl = new URL(redirectTo);
  } catch {
    throw new Error('رابط العودة بعد استعادة كلمة المرور غير صحيح.');
  }
  if (redirectUrl.origin !== window.location.origin) {
    throw new Error('رابط العودة يجب أن يكون من نفس نطاق التطبيق.');
  }

  const { error } = await getAuthSupabaseClient().auth.resetPasswordForEmail(
    normalizedEmail,
    { redirectTo: redirectUrl.toString() }
  );
  if (error) throw error;
}

/** Complete a recovery flow after Supabase has established the recovery session. */
export async function updateSupabasePassword(password: string): Promise<User> {
  if (password.length < 8) throw new Error('كلمة المرور يجب ألا تقل عن 8 أحرف.');
  const { data, error } = await getAuthSupabaseClient().auth.updateUser({ password });
  if (error) throw error;
  if (!data.user) throw new Error('تعذر تحديث كلمة المرور.');
  return data.user;
}

/** Exchange a PKCE email-confirmation/recovery token hash for an Auth session. */
export async function verifySupabaseEmailOtp(
  tokenHash: string,
  type: EmailOtpType
): Promise<User> {
  if (!tokenHash.trim()) throw new Error('رمز التحقق غير صالح.');
  const { data, error } = await getAuthSupabaseClient().auth.verifyOtp({
    token_hash: tokenHash,
    type
  });
  if (error) throw error;
  if (!data.user) throw new Error('تعذر التحقق من رابط البريد الإلكتروني.');
  return data.user;
}

export async function signOutFromSupabase(): Promise<void> {
  const { error } = await getAuthSupabaseClient().auth.signOut();
  if (error) throw error;
}

export async function getSupabaseAuthUser(): Promise<User | null> {
  const { data, error } = await getAuthSupabaseClient().auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') throw error;
  return data.user;
}
