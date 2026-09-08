const fs = require('fs');
let content = fs.readFileSync('utils/bostaService.ts', 'utf-8');

// loginWithCredentials currently doesn't have a direct fallback.
// If it receives the worker interception error, it will just fail.
// Let's add direct fallback to loginWithCredentials as well.

const oldLogin = `  async loginWithCredentials(email: string, password: string, environment?: 'production' | 'staging'): Promise<BostaVerifyResponse> {
    return await safeFetchJson('/api/bosta/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password, environment }),
    }, 'فشل الاتصال بخادم بوسطة لتسجيل الدخول');
  },`;

const newLogin = `  async loginWithCredentials(email: string, password: string, environment?: 'production' | 'staging'): Promise<BostaVerifyResponse> {
    const res = await safeFetchJson('/api/bosta/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password, environment }),
    }, 'فشل الاتصال بخادم بوسطة لتسجيل الدخول');

    if (res && res.success !== undefined && !res.isHtmlResponse) {
      if (res.error && String(res.error).includes('Worker interception')) {
         console.warn('[BOSTA-SERVICE] Cloudflare Worker intercepted login request. Forcing direct fallback.');
      } else {
         return res;
      }
    }

    // Direct fallback
    try {
      const baseUrl = environment === 'staging' ? 'https://stg-app.bosta.co' : 'https://app.bosta.co';
      const directRes = await fetch(\`\${baseUrl}/api/v2/users/login\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await directRes.json().catch(() => ({}));
      
      if (directRes.ok && data.token) {
        return {
          success: true,
          resolvedApiKey: data.token,
          detectedEnvironment: environment || 'production',
          user: data.user
        };
      } else {
        return { success: false, error: data.message || 'بيانات الدخول غير صحيحة.' };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل الاتصال المباشر بخادم بوسطة' };
    }
  },`;

content = content.replace(oldLogin, newLogin);
fs.writeFileSync('utils/bostaService.ts', content);
console.log('Fixed loginWithCredentials');
