import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

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

export async function signOutFromSupabase(): Promise<void> {
  const { error } = await getAuthSupabaseClient().auth.signOut();
  if (error) throw error;
}

export async function getSupabaseAuthUser(): Promise<User | null> {
  const { data, error } = await getAuthSupabaseClient().auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') throw error;
  return data.user;
}
