import nodemailer from 'nodemailer';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

/**
 * Enterprise Email Service for Smart Order & Inventory Manager
 * مدير الأوردرات الذكي - خدمة الإشعارات والتحقق البريدي
 * 
 * Features:
 * - High-conversion, branded responsive email templates matching the app identity.
 * - Multi-provider resilient dispatch: Resend API -> Brevo API -> SMTP / Gmail.
 * - In-memory and local disk caching to prevent Firestore quota burns.
 * - Graceful fallback and automated spam-filtering prevention (plain-text mirrors).
 */

export interface SendOtpEmailOptions {
  toEmail: string;
  userName?: string;
  otpCode: string;
  deviceInfo?: string;
  ipAddress?: string;
}

export interface SendActivationEmailOptions {
  toEmail: string;
  userName?: string;
  phone?: string;
  activationCode?: string;
  activationLink?: string;
  storeName?: string;
}

export interface SendPasswordResetEmailOptions {
  toEmail: string;
  userName?: string;
  resetLink?: string;
  resetCode?: string;
}

export interface SendNotificationEmailOptions {
  toEmail: string;
  userName?: string;
  title: string;
  message: string;
  actionText?: string;
  actionUrl?: string;
  badge?: string;
}

export interface SmtpSettings {
  provider?: 'gmail' | 'smtp' | 'resend' | 'brevo';
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
  resendApiKey?: string;
  brevoApiKey?: string;
}

export interface MailDeliveryResult {
  success: boolean;
  delivered: boolean;
  recipient?: string;
  error?: string;
  note?: string;
}

const CONFIG_CACHE_PATH = './mail-config-cache.json';
let inMemoryConfig: SmtpSettings | null = null;
let lastCacheTime = 0;
const CACHE_LIFETIME = 15 * 60 * 1000; // 15 minutes cache
let isQuotaExceeded = false;
let quotaExceededTimestamp = 0;

export function updateMailConfigLocalCache(config: SmtpSettings) {
  inMemoryConfig = config;
  lastCacheTime = Date.now();
  try {
    fs.writeFileSync(CONFIG_CACHE_PATH, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    // Ignore file write errors
  }
}

async function getStoredMailConfig(): Promise<SmtpSettings | null> {
  const now = Date.now();

  // Return from in-memory cache if valid
  if (inMemoryConfig && (now - lastCacheTime < CACHE_LIFETIME)) {
    return inMemoryConfig;
  }

  // If we recently encountered Firestore quota exhaustion, avoid querying Firestore
  if (isQuotaExceeded && (now - quotaExceededTimestamp < 30 * 60 * 1000)) {
    if (!inMemoryConfig && fs.existsSync(CONFIG_CACHE_PATH)) {
      try {
        inMemoryConfig = JSON.parse(fs.readFileSync(CONFIG_CACHE_PATH, 'utf8'));
      } catch {}
    }
    return inMemoryConfig;
  }

  // Try reading local file cache first if recent
  if (fs.existsSync(CONFIG_CACHE_PATH)) {
    try {
      const stats = fs.statSync(CONFIG_CACHE_PATH);
      if (now - stats.mtimeMs < CACHE_LIFETIME) {
        inMemoryConfig = JSON.parse(fs.readFileSync(CONFIG_CACHE_PATH, 'utf8'));
        lastCacheTime = now;
        return inMemoryConfig;
      }
    } catch {}
  }

  try {
    const fbConfigPath = './firebase-applet-config.json';
    if (!fs.existsSync(fbConfigPath)) return inMemoryConfig;
    const fbConfig = JSON.parse(fs.readFileSync(fbConfigPath, 'utf8'));
    
    let app = getApps().length > 0 ? getApps()[0] : initializeApp(fbConfig);
    const db = getFirestore(app, fbConfig.firestoreDatabaseId);

    // 1. Try settings/smtp
    const smtpDoc = await getDoc(doc(db, 'settings', 'smtp'));
    if (smtpDoc.exists() && smtpDoc.data()) {
      const data = smtpDoc.data() as SmtpSettings;
      updateMailConfigLocalCache(data);
      isQuotaExceeded = false;
      return data;
    }

    // 2. Try system_settings/smtp
    const sysDoc = await getDoc(doc(db, 'system_settings', 'smtp'));
    if (sysDoc.exists() && sysDoc.data()) {
      const data = sysDoc.data() as SmtpSettings;
      updateMailConfigLocalCache(data);
      isQuotaExceeded = false;
      return data;
    }

    // 3. Try settings/general
    const genDoc = await getDoc(doc(db, 'settings', 'general'));
    if (genDoc.exists() && genDoc.data()?.smtp) {
      const data = genDoc.data()?.smtp as SmtpSettings;
      updateMailConfigLocalCache(data);
      isQuotaExceeded = false;
      return data;
    }
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('resource-exhausted') || msg.toLowerCase().includes('limit exceeded')) {
      isQuotaExceeded = true;
      quotaExceededTimestamp = now;
      console.log('[MAIL-SERVICE] Firestore quota reached. Using local/env cached mail configuration seamlessly.');
    } else {
      console.warn('[MAIL-SERVICE] Could not read stored mail config:', msg);
    }
  }

  // Fallback to local cache
  if (!inMemoryConfig && fs.existsSync(CONFIG_CACHE_PATH)) {
    try {
      inMemoryConfig = JSON.parse(fs.readFileSync(CONFIG_CACHE_PATH, 'utf8'));
    } catch {}
  }

  return inMemoryConfig;
}

// Format brand sender header safely for Resend & RFC 5322
function formatSenderAddress(configuredFrom?: string): string {
  if (!configuredFrom || !configuredFrom.includes('@')) {
    return 'AbdoMedia Prime <onboarding@resend.dev>';
  }
  const clean = configuredFrom.trim();
  if (clean.includes('<') && clean.includes('>')) {
    return clean;
  }
  // Use clean ASCII brand name to ensure Resend API validation always passes
  return `AbdoMedia Prime <${clean}>`;
}

async function dispatchEmail({
  toEmail,
  userName = 'المستخدم العزيز',
  subject,
  htmlContent
}: {
  toEmail: string;
  userName?: string;
  subject: string;
  htmlContent: string;
}): Promise<MailDeliveryResult> {
  try {
    const cleanTo = (toEmail || '').trim().toLowerCase();
    if (!cleanTo || !cleanTo.includes('@')) {
      return { success: false, delivered: false, error: 'عنوان البريد الإلكتروني غير صالح' };
    }

    const cleanSubject = (subject || '').replace(/[\r\n]+/g, ' ').trim();

    // Fetch config from local cache / DB if not in env
    const dbConfig = await getStoredMailConfig();
    let lastProviderError = '';

    // Generate plain text fallback for maximum email client compatibility & spam prevention
    const plainTextFallback = htmlContent
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // 1. Try Resend API (Official REST API: https://resend.com/docs/api-reference/emails/send-email)
    const resendApiKey = (process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY || dbConfig?.resendApiKey || '').trim();
    if (resendApiKey) {
      try {
        let resendFrom = 'onboarding@resend.dev';
        if (dbConfig?.from && dbConfig.from.includes('@')) {
          const rawFrom = dbConfig.from.trim();
          const lowerFrom = rawFrom.toLowerCase();
          const isFreeProvider = lowerFrom.includes('@gmail.com') || 
                                 lowerFrom.includes('@yahoo.com') || 
                                 lowerFrom.includes('@outlook.com') || 
                                 lowerFrom.includes('@hotmail.com');
          if (!isFreeProvider) {
            resendFrom = formatSenderAddress(rawFrom);
          }
        }

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: resendFrom,
            to: [cleanTo],
            subject: cleanSubject,
            html: htmlContent,
            text: plainTextFallback
          })
        });

        if (response.ok) {
          const resData = await response.json().catch(() => ({}));
          console.log(`[MAIL-SERVICE] Email dispatched via Resend (ID: ${resData?.id || 'OK'}) to ${cleanTo}`);
          return { success: true, delivered: true, recipient: cleanTo };
        } else {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData?.message || errData?.name || '';
          
          // If validation error or name error, retry with bare email
          if (errData?.name === 'validation_error' && resendFrom.includes('<')) {
            const rawSender = resendFrom.replace(/.*<([^>]+)>.*/, '$1').trim();
            const retryBare = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: rawSender,
                to: [cleanTo],
                subject: cleanSubject,
                html: htmlContent,
                text: plainTextFallback
              })
            });
            if (retryBare.ok) {
              const resData2 = await retryBare.json().catch(() => ({}));
              console.log(`[MAIL-SERVICE] Email dispatched via Resend bare email (ID: ${resData2?.id || 'OK'}) to ${cleanTo}`);
              return { success: true, delivered: true, recipient: cleanTo };
            }
          }

          console.warn('[MAIL-SERVICE] Resend API response error:', errData);
          
          // If in test sandbox mode (can only send to account owner's email)
          const matchOwner = typeof errMsg === 'string' ? errMsg.match(/your own email address \(([^)]+)\)/i) : null;
          if (matchOwner && matchOwner[1]) {
            const ownerEmail = matchOwner[1].trim().toLowerCase();
            console.log(`[MAIL-SERVICE] Resend sandbox restriction. Forwarding to owner email: ${ownerEmail}`);
            
            const retryRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: resendFrom,
                to: [ownerEmail],
                subject: cleanSubject,
                html: htmlContent,
                text: plainTextFallback
              })
            });

            if (retryRes.ok) {
              return { 
                success: true, 
                delivered: true, 
                recipient: ownerEmail,
                note: `تم إرسال البريد إلى ${ownerEmail} (الحساب المسجل في Resend sandbox).`
              };
            }
          }

          lastProviderError = typeof errMsg === 'string' ? errMsg : 'خطأ في استجابة Resend API';
        }
      } catch (rErr: any) {
        console.error('[MAIL-SERVICE] Resend dispatch exception:', rErr?.message || rErr);
        lastProviderError = rErr?.message || 'تعذر الاتصال بـ Resend';
      }
    }

    // 2. Try Brevo API
    const brevoApiKey = process.env.BREVO_API_KEY || dbConfig?.brevoApiKey;
    if (brevoApiKey) {
      try {
        const brevoFrom = dbConfig?.from || process.env.BREVO_FROM || 'no-reply@smartorder.app';
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': brevoApiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            sender: { name: 'عبدو ميديا برايم | AbdoMedia Prime', email: brevoFrom },
            to: [{ email: cleanTo, name: userName }],
            subject: cleanSubject,
            htmlContent: htmlContent,
            textContent: plainTextFallback
          })
        });

        if (response.ok) {
          console.log(`[MAIL-SERVICE] Email dispatched via Brevo to ${cleanTo}`);
          return { success: true, delivered: true, recipient: cleanTo };
        } else {
          const errData = await response.json().catch(() => ({}));
          console.warn('[MAIL-SERVICE] Brevo API error:', errData);
          lastProviderError = errData?.message || 'خطأ في استجابة Brevo API';
        }
      } catch (bErr: any) {
        console.error('[MAIL-SERVICE] Brevo exception:', bErr?.message || bErr);
        lastProviderError = bErr?.message || 'تعذر الاتصال بـ Brevo';
      }
    }

    // 3. Try Standard SMTP / Gmail via Nodemailer
    const smtpHost = process.env.SMTP_HOST || dbConfig?.host;
    const smtpUser = process.env.SMTP_USER || dbConfig?.user;
    const smtpPass = process.env.SMTP_PASS || dbConfig?.pass;

    if (smtpHost && smtpUser && smtpPass) {
      try {
        const port = Number(process.env.SMTP_PORT || dbConfig?.port || 587);
        let transporter;

        if (smtpHost.includes('gmail.com')) {
          transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: smtpUser,
              pass: smtpPass
            }
          });
        } else {
          transporter = nodemailer.createTransport({
            host: smtpHost,
            port,
            secure: port === 465,
            auth: {
              user: smtpUser,
              pass: smtpPass
            }
          });
        }

        await transporter.sendMail({
          from: formatSenderAddress(dbConfig?.from || smtpUser),
          to: cleanTo,
          subject: cleanSubject,
          html: htmlContent,
          text: plainTextFallback
        });

        console.log(`[MAIL-SERVICE] Email dispatched successfully via SMTP to ${cleanTo}`);
        return { success: true, delivered: true, recipient: cleanTo };
      } catch (sErr: any) {
        console.error('[MAIL-SERVICE] SMTP dispatch error:', sErr?.message || sErr);
        lastProviderError = sErr?.message || 'فشل إرسال البريد عبر خادم SMTP';
      }
    }

    if (lastProviderError) {
      return { 
        success: false, 
        delivered: false, 
        error: `تعذر إرسال البريد: ${lastProviderError}` 
      };
    }

    console.warn(`[MAIL-SERVICE] No mail credentials configured (env or Firestore settings/smtp)`);
    return { 
      success: false, 
      delivered: false, 
      error: 'لم يتم إعداد خادم إرسال البريد الإلكتروني بعد.' 
    };
  } catch (error: any) {
    console.error('[MAIL-SERVICE] Failed in dispatchEmail:', error);
    return { success: false, delivered: false, error: error.message };
  }
}

// Shared Brand Header & Shell Generator
function renderEmailShell({
  preheader,
  contentHtml,
  footerNote
}: {
  preheader: string;
  contentHtml: string;
  footerNote?: string;
}): string {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>عبدو ميديا برايم | AbdoMedia Prime</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, a { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      background-color: #0b0f19;
      font-family: 'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #111827;
      border: 1px solid #1f2937;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }
    .code-digit {
      display: inline-block;
      width: 44px;
      height: 52px;
      line-height: 52px;
      margin: 0 4px;
      background: #0b0f19;
      border: 2px solid #10b981;
      border-radius: 12px;
      color: #34d399;
      font-size: 30px;
      font-weight: 900;
      font-family: 'Courier New', Courier, monospace;
      text-align: center;
    }
    @media only screen and (max-width: 620px) {
      .email-container {
        border-radius: 16px !important;
        margin: 10px !important;
        width: auto !important;
      }
      .code-digit {
        width: 38px !important;
        height: 46px !important;
        line-height: 46px !important;
        font-size: 24px !important;
        margin: 0 2px !important;
      }
      .p-responsive {
        padding: 24px 20px !important;
      }
    }
  </style>
</head>
<body style="background-color: #0b0f19; color: #f3f4f6; padding: 24px 10px;" dir="rtl">
  <!-- Hidden Preheader Text for Email Clients -->
  <div style="display: none; font-size: 1px; color: #0b0f19; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${preheader}
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 10px 0;">
        
        <table role="presentation" class="email-container" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #111827; border: 1px solid #1f2937; border-radius: 24px; overflow: hidden;">
          
          <!-- Top Gradient Accent Bar -->
          <tr>
            <td height="6" style="background: linear-gradient(90deg, #10b981, #06b6d4, #6366f1); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Header with Brand Logo & Identity -->
          <tr>
            <td align="center" style="padding: 32px 24px 20px 24px; background-color: #111827; border-bottom: 1px solid #1f2937;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <!-- Brand Icon Badge -->
                    <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">
                      <tr>
                        <td align="center" style="background: linear-gradient(135deg, #059669, #10b981); width: 56px; height: 56px; border-radius: 18px; box-shadow: 0 10px 25px rgba(16, 185, 129, 0.35); text-align: center; vertical-align: middle;">
                          <span style="font-size: 28px; line-height: 56px; display: inline-block;">⚡</span>
                        </td>
                      </tr>
                    </table>
                    <!-- Brand Title -->
                    <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; font-family: 'Cairo', sans-serif;">
                      عبدو ميديا برايم
                    </h1>
                    <p style="margin: 4px 0 0 0; font-size: 12px; font-weight: 700; color: #10b981; letter-spacing: 1px; text-transform: uppercase;">
                      AbdoMedia Prime • التجارة والتسويق الرقمي
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Dynamic Body Content -->
          <tr>
            <td class="p-responsive" style="padding: 36px 32px; background-color: #111827; text-align: right; direction: rtl;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Security Badge / Assurance -->
          <tr>
            <td style="padding: 0 32px 28px 32px; background-color: #111827;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; border: 1px solid #1e293b; border-radius: 14px; padding: 14px 18px;">
                <tr>
                  <td width="30" valign="top" style="padding-left: 10px; font-size: 20px;">🛡️</td>
                  <td style="font-size: 12px; color: #94a3b8; line-height: 1.6; font-family: 'Cairo', sans-serif;">
                    <strong style="color: #e2e8f0;">حماية وتشفير متكامل:</strong> هذه الرسالة صادرة آلياً من الخادم المركزي لمنظومة عبدو ميديا برايم ومحمية بأحدث بروتوكولات الأمان.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td align="center" style="padding: 24px; background-color: #0b0f19; border-top: 1px solid #1f2937; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: bold; color: #9ca3af; font-family: 'Cairo', sans-serif;">
                منظومة عبدو ميديا برايم لإدارة المتاجر والمبيعات والتسويق الإلكتروني
              </p>
              ${footerNote ? `<p style="margin: 0 0 10px 0; font-size: 11px; color: #6b7280;">${footerNote}</p>` : ''}
              <p style="margin: 0; font-size: 11px; color: #4b5563; font-family: monospace;">
                &copy; ${currentYear} AbdoMedia Prime. All rights reserved.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Send OTP Verification Email (2FA)
 */
export async function sendOtpByEmail({
  toEmail,
  userName = 'التاجر العزيز',
  otpCode,
  deviceInfo
}: SendOtpEmailOptions): Promise<MailDeliveryResult> {
  const emailSubject = `🔐 رمز التحقق الأمني: ${otpCode} - عبدو ميديا برايم`;
  const cleanCode = (otpCode || '').trim();
  const digits = cleanCode.split('');

  const digitsHtml = digits.map(d => `<span class="code-digit">${d}</span>`).join('');

  const contentHtml = `
    <div style="margin-bottom: 24px;">
      <div style="display: inline-block; padding: 6px 14px; background-color: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 999px; color: #34d399; font-size: 12px; font-weight: 800; margin-bottom: 14px;">
        🔒 مصادقة تسجيل الدخول الثنائية (2FA)
      </div>
      <h2 style="margin: 0 0 10px 0; font-size: 20px; font-weight: 900; color: #ffffff; font-family: 'Cairo', sans-serif;">
        مرحباً ${userName} 👋
      </h2>
      <p style="margin: 0; font-size: 14px; color: #9ca3af; line-height: 1.7; font-family: 'Cairo', sans-serif;">
        تم استلام طلب لتسجيل الدخول إلى حسابك في منظومة <strong>عبدو ميديا برايم</strong>. يرجى إدخال رمز التحقق الأمني التالي لإتمام تسجيل الدخول:
      </p>
    </div>

    <!-- OTP Display Box -->
    <div style="background: radial-gradient(circle at top, #1e293b, #0f172a); border: 2px solid #10b981; border-radius: 20px; padding: 28px 16px; text-align: center; margin: 28px 0; box-shadow: 0 15px 35px rgba(16, 185, 129, 0.15);">
      <p style="margin: 0 0 14px 0; font-size: 13px; font-weight: 800; color: #94a3b8; font-family: 'Cairo', sans-serif;">
        رمز التحقق الخاص بك هو:
      </p>
      
      <!-- Code Digits -->
      <div style="margin: 8px 0 18px 0;" dir="ltr">
        ${digitsHtml}
      </div>

      <div style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; background-color: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; color: #fbbf24; font-size: 12px; font-weight: bold; font-family: 'Cairo', sans-serif;">
        ⏱️ صالح للاستخدام لمدة 5 دقائق فقط
      </div>
    </div>

    ${deviceInfo ? `
      <div style="background-color: #0b0f19; border: 1px solid #1e293b; border-radius: 12px; padding: 12px 16px; margin-bottom: 24px; font-size: 12px; color: #94a3b8;">
        <span style="color: #cbd5e1; font-weight: bold;">معلومات الجهاز:</span> ${deviceInfo}
      </div>
    ` : ''}

    <div style="border-right: 4px solid #ef4444; background-color: rgba(239, 68, 68, 0.08); border-radius: 10px; padding: 14px 16px; margin-bottom: 20px;">
      <p style="margin: 0; font-size: 12px; font-weight: 700; color: #fca5a5; line-height: 1.6; font-family: 'Cairo', sans-serif;">
        ⚠️ <strong>تنبيه هام جداً:</strong> لا تشارك رمز التحقق هذا مع أي شخص، بما في ذلك فريق الدعم الفني، لحماية بيانات عملائك وأرباحك.
      </p>
    </div>
  `;

  return dispatchEmail({
    toEmail,
    userName,
    subject: emailSubject,
    htmlContent: renderEmailShell({
      preheader: `رمز التحقق الأمني الخاص بك لتسجيل الدخول إلى عبدو ميديا برايم هو ${otpCode}`,
      contentHtml,
      footerNote: 'إذا لم تكن قد طلبت تسجيل الدخول، يرجى تغيير كلمة مرورك فوراً.'
    })
  });
}

/**
 * Send Account Activation / Welcome Email
 */
export async function sendAccountActivationEmail({
  toEmail,
  userName = 'التاجر العزيز',
  phone = '',
  activationCode = '',
  activationLink = '',
  storeName = 'متجرك الذكي'
}: SendActivationEmailOptions): Promise<MailDeliveryResult> {
  const subject = `🎉 مرحباً بك في عبدو ميديا برايم - تم إنشاء حسابك بنجاح!`;

  const contentHtml = `
    <div style="text-align: right; margin-bottom: 28px;">
      <div style="display: inline-block; padding: 6px 14px; background-color: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 999px; color: #34d399; font-size: 12px; font-weight: 800; margin-bottom: 14px;">
        ✨ حساب تاجر معتمد وجديد
      </div>
      <h2 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 900; color: #ffffff; font-family: 'Cairo', sans-serif;">
        أهلاً بك يا ${userName} في منظومة عبدو ميديا برايم 🚀
      </h2>
      <p style="margin: 0; font-size: 14px; color: #9ca3af; line-height: 1.8; font-family: 'Cairo', sans-serif;">
        يسعدنا انضمامك إلى منصة <strong>عبدو ميديا برايم (AbdoMedia Prime)</strong>. حسابك الآن جاهز لإدارة المتاجر المتعددة، المبيعات، الحملات التسويقية، ومعالجة الطلبات بكل احترافية.
      </p>
    </div>

    ${activationCode ? `
      <!-- Activation Code Box -->
      <div style="background: radial-gradient(circle at top, #1e293b, #0f172a); border: 2px solid #10b981; border-radius: 20px; padding: 26px 16px; text-align: center; margin: 24px 0; box-shadow: 0 15px 35px rgba(16, 185, 129, 0.15);">
        <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: bold; color: #94a3b8; font-family: 'Cairo', sans-serif;">
          🔑 كود تفعيل وتوثيق الحساب:
        </p>
        <span style="font-family: 'Courier New', monospace; font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #34d399; display: block;" dir="ltr">
          ${activationCode}
        </span>
        <p style="margin: 10px 0 0 0; font-size: 11px; color: #64748b; font-family: 'Cairo', sans-serif;">
          استخدم هذا الرمز لتوثيق وتأكيد ملكية بريدك الإلكتروني
        </p>
      </div>
    ` : ''}

    <!-- Registered Details Card -->
    <div style="background-color: #0b0f19; border: 1px solid #1f2937; border-radius: 16px; padding: 20px; margin: 24px 0;">
      <h3 style="margin: 0 0 14px 0; font-size: 14px; font-weight: 800; color: #e5e7eb; border-bottom: 1px solid #1f2937; padding-bottom: 10px; font-family: 'Cairo', sans-serif;">
        📋 تفاصيل حسابك المسجل:
      </h3>
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px; font-family: 'Cairo', sans-serif;">
        <tr>
          <td style="padding: 7px 0; color: #9ca3af;">اسم المالك:</td>
          <td style="padding: 7px 0; color: #ffffff; font-weight: bold; text-align: left;">${userName}</td>
        </tr>
        <tr>
          <td style="padding: 7px 0; color: #9ca3af;">اسم المتجر:</td>
          <td style="padding: 7px 0; color: #34d399; font-weight: bold; text-align: left;">${storeName}</td>
        </tr>
        ${phone ? `
        <tr>
          <td style="padding: 7px 0; color: #9ca3af;">رقم تسجيل الدخول:</td>
          <td style="padding: 7px 0; color: #ffffff; font-family: monospace; font-weight: bold; text-align: left;" dir="ltr">${phone}</td>
        </tr>` : ''}
        <tr>
          <td style="padding: 7px 0; color: #9ca3af;">البريد الإلكتروني المعتمد:</td>
          <td style="padding: 7px 0; color: #ffffff; font-family: monospace; text-align: left;" dir="ltr">${toEmail}</td>
        </tr>
        <tr>
          <td style="padding: 7px 0; color: #9ca3af;">الصلاحية:</td>
          <td style="padding: 7px 0; color: #10b981; font-weight: bold; text-align: left;">مالك متجر (Store Owner)</td>
        </tr>
      </table>
    </div>

    ${activationLink ? `
      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${activationLink}" style="display: inline-block; width: 85%; padding: 16px 24px; background: linear-gradient(135deg, #10b981, #059669); color: #022c22; text-decoration: none; font-weight: 900; font-size: 16px; border-radius: 14px; box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4); font-family: 'Cairo', sans-serif;">
          🚀 الانتقال للوحة التحكم والبدء
        </a>
      </div>
    ` : ''}

    <!-- Key Features Quick Start -->
    <div style="background-color: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 14px; padding: 18px; margin-top: 24px;">
      <h4 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 800; color: #a5b4fc; font-family: 'Cairo', sans-serif;">
        💡 مميزات جاهزة للاستخدام فوراً:
      </h4>
      <ul style="margin: 0; padding-right: 18px; font-size: 12px; color: #c7d2fe; line-height: 1.8; font-family: 'Cairo', sans-serif;">
        <li>ربط متجرك مع منصات Shopify وWooCommerce وسلة وEasyOrder.</li>
        <li>الربط المباشر مع شركات الشحن وتوليد البوالص آلياً.</li>
        <li>إدارة الخزينة وحسابات الشركاء والعهد المالية بدقة متناهية.</li>
      </ul>
    </div>
  `;

  return dispatchEmail({
    toEmail,
    userName,
    subject,
    htmlContent: renderEmailShell({
      preheader: `مرحباً بك يا ${userName} في عبدو ميديا برايم. تم إنشاء حسابك بنجاح.`,
      contentHtml,
      footerNote: 'تم إرسال هذا البريد لتأكيد انضمامك إلى المنصة.'
    })
  });
}

/**
 * Send Password Reset Email
 */
export async function sendPasswordResetEmail({
  toEmail,
  userName = 'المستخدم العزيز',
  resetCode = '',
  resetLink = ''
}: SendPasswordResetEmailOptions): Promise<MailDeliveryResult> {
  const subject = `🔑 استعادة كلمة المرور - عبدو ميديا برايم`;

  const contentHtml = `
    <div style="text-align: right; margin-bottom: 24px;">
      <div style="display: inline-block; padding: 6px 14px; background-color: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 999px; color: #f87171; font-size: 12px; font-weight: 800; margin-bottom: 14px;">
        🔐 طلب إعادة تعيين كلمة المرور
      </div>
      <h2 style="margin: 0 0 10px 0; font-size: 20px; font-weight: 900; color: #ffffff; font-family: 'Cairo', sans-serif;">
        مرحباً ${userName} 👋
      </h2>
      <p style="margin: 0; font-size: 14px; color: #9ca3af; line-height: 1.7; font-family: 'Cairo', sans-serif;">
        تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك في <strong>عبدو ميديا برايم</strong>.
      </p>
    </div>

    ${resetCode ? `
      <div style="background: radial-gradient(circle at top, #1e293b, #0f172a); border: 2px solid #ef4444; border-radius: 20px; padding: 26px 16px; text-align: center; margin: 24px 0;">
        <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: bold; color: #94a3b8; font-family: 'Cairo', sans-serif;">
          رمز إعادة التعيين (Reset PIN):
        </p>
        <span style="font-family: 'Courier New', monospace; font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #f87171; display: block;" dir="ltr">
          ${resetCode}
        </span>
        <p style="margin: 10px 0 0 0; font-size: 12px; color: #fbbf24; font-family: 'Cairo', sans-serif;">
          ⏱️ صالح لمدة 10 دقائق فقط
        </p>
      </div>
    ` : ''}

    ${resetLink ? `
      <div style="text-align: center; margin: 28px 0;">
        <a href="${resetLink}" style="display: inline-block; width: 85%; padding: 16px 24px; background: #ef4444; color: #ffffff; text-decoration: none; font-weight: 900; font-size: 16px; border-radius: 14px; box-shadow: 0 10px 25px rgba(239, 68, 68, 0.4); font-family: 'Cairo', sans-serif;">
          تعيين كلمة مرور جديدة
        </a>
      </div>
    ` : ''}

    <div style="background-color: #0b0f19; border: 1px solid #1f2937; border-radius: 12px; padding: 14px 16px; margin-top: 24px;">
      <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.6; font-family: 'Cairo', sans-serif;">
        ℹ️ إذا لم تكن قد طلبت إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة بأمان، وستظل كلمة المرور الحالية صالحة.
      </p>
    </div>
  `;

  return dispatchEmail({
    toEmail,
    userName,
    subject,
    htmlContent: renderEmailShell({
      preheader: `طلب استعادة كلمة المرور لحسابك في عبدو ميديا برايم`,
      contentHtml,
      footerNote: 'إذا واجهت أي صعوبة، يرجى التواصل مع فريق الدعم الفني.'
    })
  });
}

/**
 * Send System Notification / Order Alert Email
 */
export async function sendNotificationEmail({
  toEmail,
  userName = 'التاجر العزيز',
  title,
  message,
  actionText,
  actionUrl,
  badge = 'إشعار من النظام'
}: SendNotificationEmailOptions): Promise<MailDeliveryResult> {
  const subject = `📢 ${title} - عبدو ميديا برايم`;

  const contentHtml = `
    <div style="text-align: right; margin-bottom: 24px;">
      <div style="display: inline-block; padding: 6px 14px; background-color: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 999px; color: #60a5fa; font-size: 12px; font-weight: 800; margin-bottom: 14px;">
        🔔 ${badge}
      </div>
      <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 900; color: #ffffff; font-family: 'Cairo', sans-serif;">
        ${title}
      </h2>
      <p style="margin: 0; font-size: 14px; color: #9ca3af; line-height: 1.8; font-family: 'Cairo', sans-serif;">
        مرحباً ${userName}،
      </p>
    </div>

    <!-- Message Body Box -->
    <div style="background-color: #0b0f19; border: 1px solid #1f2937; border-radius: 16px; padding: 22px; margin: 20px 0; font-size: 14px; color: #e5e7eb; line-height: 1.8; font-family: 'Cairo', sans-serif;">
      ${message.replace(/\n/g, '<br/>')}
    </div>

    ${actionText && actionUrl ? `
      <div style="text-align: center; margin: 28px 0;">
        <a href="${actionUrl}" style="display: inline-block; width: 85%; padding: 15px 24px; background: linear-gradient(135deg, #10b981, #059669); color: #022c22; text-decoration: none; font-weight: 900; font-size: 15px; border-radius: 14px; box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3); font-family: 'Cairo', sans-serif;">
          ${actionText}
        </a>
      </div>
    ` : ''}
  `;

  return dispatchEmail({
    toEmail,
    userName,
    subject,
    htmlContent: renderEmailShell({
      preheader: title,
      contentHtml
    })
  });
}
