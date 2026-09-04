import React, { useState, useEffect } from 'react';
import { Order, WhatsAppConfig } from '../types';
import { 
  CheckCircle2, AlertTriangle, RefreshCw, Smartphone, 
  ExternalLink, ShieldCheck, Zap, Copy, Check, KeyRound, 
  Send, HelpCircle, X, Globe, Lock, Shield, Sparkles, MessageSquare,
  BookOpen, FileCheck, Layers, ChevronDown, ChevronUp, Clock, PhoneCall
} from 'lucide-react';
import { whatsappService } from '../utils/whatsappService';
import { inAppAlert, inAppConfirm } from '../utils/inAppAlert';

interface MetaWhatsAppSectionProps {
  config: WhatsAppConfig;
  setConfig: React.Dispatch<React.SetStateAction<WhatsAppConfig>>;
  liveStatus: {
    connected: boolean;
    status: string;
    phone?: string;
    name?: string;
    battery?: number;
    error?: string;
    qualityRating?: string;
    wabaData?: any;
  };
  checkLiveStatus: (silent?: boolean, customConfig?: WhatsAppConfig) => Promise<any>;
  onSave?: () => Promise<void>;
  orders: Order[];
}

export const MetaWhatsAppSection: React.FC<MetaWhatsAppSectionProps> = ({
  config,
  setConfig,
  liveStatus,
  checkLiveStatus,
  onSave,
  orders
}) => {
  // Modal state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [modalTab, setModalTab] = useState<'embedded' | 'manual'>('manual');

  // Form states for manual/embedded config
  const [phoneNumberId, setPhoneNumberId] = useState(config.phoneNumberId || '');
  const [accessToken, setAccessToken] = useState(config.accessToken || '');
  const [wabaId, setWabaId] = useState(config.wabaId || '');
  const [metaAppId, setMetaAppId] = useState(
    config.metaAppId && config.metaAppId !== '2067634567465747' 
      ? config.metaAppId 
      : '933545646518077'
  );
  const [metaConfigId, setMetaConfigId] = useState(config.metaConfigId || '');
  const [metaAppSecret, setMetaAppSecret] = useState(config.metaAppSecret || '');
  const [metaVerifyToken, setMetaVerifyToken] = useState(config.metaVerifyToken || 'abdomedi_whatsapp_meta_token');
  const [metaTemplateName, setMetaTemplateName] = useState(config.metaTemplateName || '');
  const [metaTemplateLanguage, setMetaTemplateLanguage] = useState(config.metaTemplateLanguage || 'ar');

  // WABA Discovery State (Phone Numbers & Templates from Meta Graph API)
  const [fetchedPhoneNumbers, setFetchedPhoneNumbers] = useState<any[]>([]);
  const [isLoadingPhoneNumbers, setIsLoadingPhoneNumbers] = useState(false);
  const [fetchedTemplates, setFetchedTemplates] = useState<any[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [showDocumentationGuide, setShowDocumentationGuide] = useState(false);
  const [testMode, setTestMode] = useState<'interactive' | 'template'>('interactive');
  const [testTemplateVariables, setTestTemplateVariables] = useState<string>('أحمد محمد, ORD-5821, 350 ج.م');

  // Interactive Test State
  const [testPhone, setTestPhone] = useState(orders[0]?.customerPhone || '');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; text: string } | null>(null);

  // Webhook Test State
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{ success: boolean; text: string } | null>(null);

  // Copy helpers
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Derive active webhook URL - always prefer custom public domain over internal google cloud run sandbox
  const isInternalSandbox = typeof window !== 'undefined' && (
    window.location.hostname.includes('run.app') || 
    window.location.hostname.includes('localhost') || 
    window.location.hostname.includes('127.0.0.1')
  );
  const webhookUrl = isInternalSandbox 
    ? 'https://app.abdomedi.com/api/webhook/whatsapp' 
    : (typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/whatsapp` : 'https://app.abdomedi.com/api/webhook/whatsapp');

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2500);
  };

  // Sync state when config updates
  useEffect(() => {
    if (config.phoneNumberId) setPhoneNumberId(config.phoneNumberId);
    if (config.accessToken) setAccessToken(config.accessToken);
    if (config.wabaId) setWabaId(config.wabaId);
    if (config.metaAppId) setMetaAppId(config.metaAppId);
    if (config.metaConfigId) setMetaConfigId(config.metaConfigId);
    if (config.metaAppSecret) setMetaAppSecret(config.metaAppSecret);
    if (config.metaVerifyToken) setMetaVerifyToken(config.metaVerifyToken);
    if (config.metaTemplateName) setMetaTemplateName(config.metaTemplateName);
    if (config.metaTemplateLanguage) setMetaTemplateLanguage(config.metaTemplateLanguage);
  }, [config]);

  // Preload Facebook SDK on mount so it is instantly available when clicking
  useEffect(() => {
    const rawId = (config.metaAppId || metaAppId || '933545646518077').trim();
    const appId = rawId === '2067634567465747' ? '933545646518077' : rawId;
    loadFacebookSdk(appId).catch(() => {
      // Benign if ad-blocker blocks it; direct popup fallback is supported
    });
  }, [metaAppId, config.metaAppId]);

  // Listen for Meta Embedded Signup message events from popup
  useEffect(() => {
    const handleMetaMessage = async (event: MessageEvent) => {
      if (typeof event.origin === 'string' && (event.origin.includes('facebook.com') || event.origin.includes('meta.com') || event.origin.includes(window.location.host))) {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data && (data.type === 'WA_EMBEDDED_SIGNUP' || data.event === 'WA_EMBEDDED_SIGNUP')) {
            console.log('⚡ [META-EMBEDDED-SIGNUP-MESSAGE] Received session payload:', data);
            const payload = data.data || data;
            const phoneId = payload.phone_number_id || payload.phoneNumberId;
            const wabaIdVal = payload.waba_id || payload.wabaId;

            if (phoneId) {
              const updatedConfig: WhatsAppConfig = {
                ...config,
                providerType: 'meta_cloud',
                isActive: true,
                phoneNumberId: phoneId,
                wabaId: wabaIdVal || config.wabaId
              };
              setConfig(updatedConfig);
              setPhoneNumberId(phoneId);
              if (wabaIdVal) setWabaId(wabaIdVal);
              setShowConfigModal(false);

              if (onSave) await onSave();
              await checkLiveStatus(false, updatedConfig);
              await inAppAlert('تم التقاط معرّف رقم الهاتف وحساب واتساب للأعمال من ميتا بنجاح! 🚀', {
                title: 'ربط Meta ناجح',
                type: 'success'
              });
            }
          }
        } catch (_) {}
      }
    };

    window.addEventListener('message', handleMetaMessage);
    return () => window.removeEventListener('message', handleMetaMessage);
  }, [config, onSave]);

  // Load Facebook JS SDK dynamically
  const loadFacebookSdk = (appId: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).FB) {
        try {
          (window as any).FB.init({
            appId: appId.trim(),
            cookie: true,
            xfbml: true,
            version: 'v21.0'
          });
          resolve((window as any).FB);
        } catch (_) {
          resolve((window as any).FB);
        }
        return;
      }

      (window as any).fbAsyncInit = function() {
        try {
          (window as any).FB.init({
            appId: appId.trim(),
            cookie: true,
            xfbml: true,
            version: 'v21.0'
          });
        } catch (_) {}
        resolve((window as any).FB);
      };

      const existingScript = document.getElementById('facebook-jssdk');
      if (existingScript) {
        if ((window as any).FB) {
          resolve((window as any).FB);
        } else {
          setTimeout(() => resolve((window as any).FB), 500);
        }
        return;
      }

      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.onerror = () => reject(new Error('تعذر تحميل مكتبة Facebook SDK من خوادم ميتا.'));
      document.head.appendChild(script);
    });
  };

  // Open Direct Meta OAuth Popup as seamless fallback or ad-blocker bypass
  const openDirectMetaOAuthPopup = (appId: string) => {
    const redirectUri = window.location.origin;
    const extras = encodeURIComponent(JSON.stringify({
      feature: 'whatsapp_embedded_signup',
      version: 2,
      sessionInfoVersion: 2
    }));
    const configParam = metaConfigId?.trim() 
      ? `&config_id=${encodeURIComponent(metaConfigId.trim())}` 
      : `&scope=whatsapp_business_management,whatsapp_business_messaging`;
    const url = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code${configParam}&extras=${extras}`;

    const width = 640;
    const height = 760;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
    const popup = window.open(
      url,
      'MetaEmbeddedSignup',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=yes,resizable=yes`
    );

    setIsConnecting(false);
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      setModalTab('manual');
      setShowConfigModal(true);
      void inAppAlert('قام المتصفح بحظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع أو إدخال البيانات يدوياً.', {
        title: 'تنبيه النوافذ المنبثقة',
        type: 'warning'
      });
    }
  };

  // Process FB Auth Response (Synchronous wrapper to avoid "Expression is of type asyncfunction" error)
  const handleAuthResponse = async (response: any, appId: string) => {
    setIsConnecting(false);
    console.log('⚡ [FB.login] Response received:', response);

    if (response && response.authResponse) {
      const code = response.authResponse.code;
      const directToken = response.authResponse.accessToken;

      if (code && metaAppSecret.trim()) {
        try {
          const res = await fetch('/api/whatsapp/meta-exchange-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              appId,
              appSecret: metaAppSecret.trim(),
              redirectUri: window.location.origin
            })
          });
          const data = await res.json();
          if (data.success && data.accessToken) {
            const updatedConfig: WhatsAppConfig = {
              ...config,
              providerType: 'meta_cloud',
              isActive: true,
              accessToken: data.accessToken,
              metaAppId: appId,
              metaAppSecret: metaAppSecret.trim()
            };
            setConfig(updatedConfig);
            setAccessToken(data.accessToken);
            if (onSave) await onSave();
            await checkLiveStatus(false, updatedConfig);
            setShowConfigModal(false);
            await inAppAlert('تم استبدال الرمز بنجاح وتفعيل رمز الوصول الدائم لحساب ميتا! 🎉', { type: 'success' });
            return;
          }
        } catch (err: any) {
          console.error('Exchange token error:', err);
        }
      }

      if (directToken) {
        const updatedConfig: WhatsAppConfig = {
          ...config,
          providerType: 'meta_cloud',
          isActive: true,
          accessToken: directToken,
          metaAppId: appId
        };
        setConfig(updatedConfig);
        setAccessToken(directToken);
        if (onSave) await onSave();
        await checkLiveStatus(false, updatedConfig);
        setShowConfigModal(false);
        await inAppAlert('تم استلام رمز الدخول بنجاح وتوصيل الحساب بميتا! 🎉', { type: 'success' });
        return;
      }

      if (code) {
        await inAppAlert('تم تسجيل الدخول في فيسبوك بنجاح! تم استلام رمز التفويض. يمكنك إدخال رمز الوصول (Permanent Token) لحفظ الاتصال الدائم.', {
          title: 'تمت المصادقة مع فيسبوك',
          type: 'info'
        });
        setModalTab('manual');
        setShowConfigModal(true);
      }
    } else if (response && response.status === 'unknown') {
      // User closed popup without approving
      console.log('User closed Facebook login popup or did not complete flow');
    }
  };

  // Launch Meta Embedded Signup Popup
  const handleLaunchEmbeddedSignup = () => {
    const rawId = metaAppId?.trim() || '933545646518077';
    const appId = rawId === '2067634567465747' ? '933545646518077' : rawId;
    setIsConnecting(true);

    const fbOptions: any = {
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        feature: 'whatsapp_embedded_signup',
        version: 2,
        sessionInfoVersion: 2
      }
    };

    if (metaConfigId.trim()) {
      fbOptions.config_id = metaConfigId.trim();
    } else {
      fbOptions.scope = 'whatsapp_business_management,whatsapp_business_messaging';
    }

    const launchWithSdk = (FB: any) => {
      try {
        // IMPORTANT: Callback MUST be a regular non-async function.
        // If an async function is passed, Facebook SDK throws "Expression is of type asyncfunction, not function".
        FB.login(function(response: any) {
          void handleAuthResponse(response, appId);
        }, fbOptions);
      } catch (e: any) {
        console.warn('FB.login error, falling back to direct popup:', e);
        openDirectMetaOAuthPopup(appId);
      }
    };

    if ((window as any).FB) {
      launchWithSdk((window as any).FB);
    } else {
      loadFacebookSdk(appId)
        .then((FB) => {
          if (FB) {
            launchWithSdk(FB);
          } else {
            openDirectMetaOAuthPopup(appId);
          }
        })
        .catch((err) => {
          console.warn('Facebook SDK load failed, opening direct popup:', err.message);
          openDirectMetaOAuthPopup(appId);
        });
    }
  };

  // Save manual / custom configuration
  const handleSaveManualConfig = async () => {
    if (!phoneNumberId.trim() || !accessToken.trim()) {
      await inAppAlert('يرجى إدخال معرّف رقم الهاتف (Phone Number ID) ورمز الوصول (Access Token) لميتا.', {
        title: 'بيانات ناقصة',
        type: 'warning'
      });
      return;
    }

    setIsConnecting(true);
    const updatedConfig: WhatsAppConfig = {
      ...config,
      providerType: 'meta_cloud',
      isActive: true,
      phoneNumberId: phoneNumberId.trim(),
      accessToken: accessToken.trim(),
      wabaId: wabaId.trim() || undefined,
      metaAppId: metaAppId.trim() || undefined,
      metaAppSecret: metaAppSecret.trim() || undefined,
      metaConfigId: metaConfigId.trim() || undefined,
      metaVerifyToken: metaVerifyToken.trim() || 'abdomedi_whatsapp_meta_token',
      metaTemplateName: metaTemplateName.trim() || undefined,
      metaTemplateLanguage: metaTemplateLanguage.trim() || 'ar'
    };

    try {
      const statusRes = await checkLiveStatus(false, updatedConfig);
      if (statusRes && statusRes.connected) {
        setConfig(updatedConfig);
        if (onSave) await onSave();
        setShowConfigModal(false);
        
        import('../utils/audioSynth').then(({ audioSynth }) => {
          audioSynth.announce("تم التحقق من حساب ميتا وربط واتساب السحابي بنجاح", "success");
        });

        await inAppAlert('تم التحقق من بيانات Meta Cloud API وتوصيل الحساب بنجاح! 🟢', {
          title: 'تم الربط بنجاح',
          type: 'success'
        });
      } else {
        const fullErr = statusRes?.error || statusRes?.message || 'تأكد من صحة الـ Phone ID والـ Token';
        await inAppAlert(`فشل التحقق من بيانات ميتا:\n\n${fullErr}`, {
          title: 'فشل التحقق من ميتا',
          type: 'danger'
        });
      }
    } catch (err: any) {
      await inAppAlert(`خطأ أثناء الاتصال: ${err.message}`, { type: 'danger' });
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect Meta
  const handleDisconnect = async () => {
    const ok = await inAppConfirm('هل تريد قطع الاتصال مع Meta Cloud API؟ لن يتم إرسال رسائل تلقائية عبر ميتا حتى تعيد الربط.', {
      title: 'تأكيد قطع الربط',
      type: 'danger',
      confirmText: 'قطع الاتصال',
      cancelText: 'إلغاء'
    });
    if (!ok) return;

    const updatedConfig: WhatsAppConfig = {
      ...config,
      isConnected: false,
      accessToken: '',
      sessionPhone: ''
    };
    setConfig(updatedConfig);
    if (onSave) await onSave();
    await checkLiveStatus(true, updatedConfig);
    await inAppAlert('تم قطع الاتصال مع حساب ميتا بنجاح.', { type: 'success' });
  };

  // Fetch Registered Phone Numbers under this WABA (GET /{WABA_ID}/phone_numbers)
  const fetchPhoneNumbersFromWABA = async () => {
    const activeWaba = (wabaId || config.wabaId || '').trim();
    const activeToken = (accessToken || config.accessToken || '').trim();

    if (!activeWaba || !activeToken) {
      await inAppAlert('يرجى التأكد من إدخال معرّف حساب الأعمال (WABA ID) ورمز الوصول (Access Token) لجلب الأرقام.', { type: 'warning' });
      return;
    }

    setIsLoadingPhoneNumbers(true);
    try {
      const res = await fetch('/api/whatsapp/meta-phone-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wabaId: activeWaba, accessToken: activeToken })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setFetchedPhoneNumbers(data.data);
        if (data.data.length === 0) {
          await inAppAlert('لم يتم العثور على أرقام هواتف مرتبطة بحساب الأعمال هذا في ميتا.', { type: 'info' });
        } else {
          await inAppAlert(`تم العثور على ${data.data.length} رقم هاتف معتمد في حساب ميتا! يمكنك اختيار الرقم المطلوب بنقرة واحدة. 🎉`, { type: 'success' });
        }
      } else {
        await inAppAlert(`فشل جلب أرقام الهواتف: ${data.error || 'تأكد من صلاحيات whatsapp_business_management'}`, { type: 'danger' });
      }
    } catch (err: any) {
      await inAppAlert(`حدث خطأ أثناء جلب الأرقام: ${err.message}`, { type: 'danger' });
    } finally {
      setIsLoadingPhoneNumbers(false);
    }
  };

  // Fetch Message Templates from Meta (GET /{WABA_ID}/message_templates)
  const fetchTemplatesFromWABA = async () => {
    const activeWaba = (wabaId || config.wabaId || '').trim();
    const activeToken = (accessToken || config.accessToken || '').trim();

    if (!activeWaba || !activeToken) {
      await inAppAlert('يرجى التأكد من إدخال معرّف حساب الأعمال (WABA ID) ورمز الوصول (Access Token) لاستعراض القوالب.', { type: 'warning' });
      return;
    }

    setIsLoadingTemplates(true);
    try {
      const res = await fetch('/api/whatsapp/meta-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wabaId: activeWaba, accessToken: activeToken })
      });
      const data = await res.json();
      if (data.success && data.templates) {
        setFetchedTemplates(data.templates);
        if (data.templates.length === 0) {
          await inAppAlert('لا توجد قوالب رسائل منشأة حالياً في حساب WhatsApp Business هذا.', { type: 'info' });
        } else {
          await inAppAlert(`تم جلب ${data.templates.length} قالب من خوادم ميتا بنجاح! 📑`, { type: 'success' });
        }
      } else {
        await inAppAlert(`تعذر استرداد القوالب: ${data.error || 'تأكد من صلاحيات حساب الأعمال'}`, { type: 'danger' });
      }
    } catch (err: any) {
      await inAppAlert(`حدث خطأ: ${err.message}`, { type: 'danger' });
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // Send Test Message via Meta (Interactive buttons OR Approved Template)
  const handleSendTestMessage = async () => {
    if (!testPhone.trim()) {
      await inAppAlert('يرجى إدخال رقم هاتف صالح للاختبار.', { type: 'warning' });
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    try {
      let clean = testPhone.replace(/\D/g, '');
      if (clean.startsWith('01') && clean.length === 11) clean = '2' + clean;
      if (!clean.startsWith('2') && clean.length === 10) clean = '20' + clean;

      let res: any;

      if (testMode === 'template' && (config.metaTemplateName || metaTemplateName)) {
        const templateName = (config.metaTemplateName || metaTemplateName).trim();
        const templateLang = (config.metaTemplateLanguage || metaTemplateLanguage || 'ar').trim();
        const params = testTemplateVariables.split(',').map(s => s.trim()).filter(Boolean);

        const response = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: clean,
            config: {
              ...config,
              providerType: 'meta_cloud',
              isActive: true,
              metaTemplateName: templateName,
              metaTemplateLanguage: templateLang
            },
            templateParameters: params
          })
        });
        res = await response.json();
      } else {
        const testMsg = `مرحباً بك! هذه رسالة تجريبية من واجهة Meta Cloud API الرسمية 🚀\n\nنظام إدارة الطلبات والشحن الذكي يعمل بأمان ومطابق لسياسات واتساب للأعمال.`;
        const buttons = ['تأكيد الطلب 👍', 'تعديل العنوان ✍️', 'إلغاء الطلب ❌'];

        res = await whatsappService.sendMessage(
          clean,
          testMsg,
          { ...config, providerType: 'meta_cloud', isActive: true, metaTemplateName: '' },
          buttons,
          'نظام فليكس شيب الذكي للأتمتة'
        );
      }

      if (res.success) {
        setTestResult({
          success: true,
          text: `تم إرسال الرسالة بنجاح إلى ${clean} عبر Meta Graph API v21.0! 💬`
        });
        import('../utils/audioSynth').then(({ audioSynth }) => {
          audioSynth.announce("تم إرسال الرسالة بنجاح عبر ميتا كلاود", "success");
        });
      } else {
        setTestResult({
          success: false,
          text: res.error || 'فشل إرسال الرسالة عبر ميتا'
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        text: err.message || 'حدث خطأ غير متوقع'
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Test Webhook Verification Challenge (hub.challenge)
  const handleTestWebhookChallenge = async () => {
    setIsTestingWebhook(true);
    setWebhookResult(null);

    try {
      const challengeToken = 'meta_test_challenge_' + Math.floor(Math.random() * 100000);
      const res = await fetch(`/api/webhook/whatsapp?hub.mode=subscribe&hub.challenge=${challengeToken}&hub.verify_token=${metaVerifyToken}`);
      const text = await res.text();

      if (res.ok && text.trim() === challengeToken) {
        setWebhookResult({
          success: true,
          text: '✅ تم اجتياز فحص الـ Webhook بنجاح! استجاب الخادم لرمز التحدي (hub.challenge) مباشرة بنسبة 100% ومستعد للاعتماد الفوري في ميتا.'
        });
      } else {
        setWebhookResult({
          success: false,
          text: `⚠️ استجاب الخادم بكود ${res.status} ولكن القيمة المستلمة لم تطابق رمز التحدي. (${text})`
        });
      }
    } catch (err: any) {
      setWebhookResult({
        success: false,
        text: `فشل فحص الرابط: ${err.message}`
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const isMetaConnected = config.providerType === 'meta_cloud' && liveStatus.connected;

  return (
    <div className="p-4 sm:p-8 space-y-8" dir="rtl">
      {/* Top Meta Business API Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1877F2] to-[#0d5ec4] text-white flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
            <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">واجهة Meta Business API</h2>
              <span className="px-3 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                Official WhatsApp Cloud API v21.0
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              الربط الرسمي المباشر عبر واجهة Meta API للمشاريع الكبيرة، بدون أي مخاطر للحظر، ومؤهل للحصول على العلامة الخضراء وبدون وسطاء خارجيين.
            </p>
          </div>
        </div>

        {/* Global Connection Badge */}
        <div className="flex items-center gap-3">
          {isMetaConnected ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-black">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              متصل ومفعل في ميتا
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
              غير مرتبط بميتا حالياً
            </div>
          )}
        </div>
      </div>

      {/* Main Connection Hero Card (Matches Akked flow & user screenshots) */}
      <div className={`p-6 sm:p-8 rounded-3xl border transition-all ${isMetaConnected ? 'bg-gradient-to-br from-emerald-50/50 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 shadow-sm' : 'bg-gradient-to-br from-blue-50/40 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/20 border-slate-200 dark:border-slate-800 shadow-sm'}`}>
        {!isMetaConnected ? (
          <div className="flex flex-col items-center text-center max-w-xl mx-auto space-y-6 py-4">
            <div className="w-16 h-16 rounded-3xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner">
              <ShieldCheck size={36} />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                قم بربط حساب واتساب للأعمال Meta
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                اربط رقمك مباشرة مع خوادم WhatsApp الرسمية لتتمكن من إرسال رسائل تأكيد فورية وأزرار تفاعلية موثوقة ومؤهلة للعلامة الخضراء، بدون أي قيود أو وسطاء.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
              {/* Primary Facebook Login / Meta Cloud API Button */}
              <button
                type="button"
                onClick={handleLaunchEmbeddedSignup}
                disabled={isConnecting}
                className="w-full sm:w-auto px-8 py-4 bg-[#1877F2] hover:bg-[#166fe5] active:scale-95 disabled:opacity-50 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-3 cursor-pointer"
              >
                {isConnecting ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                )}
                <span>ربط عبر واجهة Meta Cloud API</span>
              </button>

              {/* Direct Manual Setup Button */}
              <button
                type="button"
                onClick={() => {
                  setModalTab('manual');
                  setShowConfigModal(true);
                }}
                className="w-full sm:w-auto px-6 py-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <KeyRound size={16} />
                <span>إدخال البيانات يدوياً (Phone ID & Token)</span>
              </button>
            </div>

            <div className="flex items-center gap-4 text-[11px] text-slate-400 font-bold">
              <span className="flex items-center gap-1">
                <CheckCircle2 size={13} className="text-emerald-500" />
                حماية تامة من الحظر
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 size={13} className="text-emerald-500" />
                أزرار تفاعلية نقرة واحدة
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 size={13} className="text-emerald-500" />
                مؤهل للعلامة الخضراء
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <ShieldCheck size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      {liveStatus.name || config.verifiedName || 'حساب WhatsApp للأعمال الموثق'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                      معتمد رسمي ✅
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-bold mt-0.5" dir="ltr">
                    {liveStatus.phone || config.metaPhone || config.sessionPhone || 'رقم موثق في ميتا'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => checkLiveStatus(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <RefreshCw size={14} />
                  <span>تحديث الحالة</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setModalTab('manual');
                    setShowConfigModal(true);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <KeyRound size={14} />
                  <span>تعديل الإعدادات</span>
                </button>

                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <X size={14} />
                  <span>قطع الاتصال</span>
                </button>
              </div>
            </div>

            {/* Meta Account Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block">رقم الهاتف المعتمد</span>
                <span className="text-sm font-black text-slate-800 dark:text-white block font-mono" dir="ltr">
                  {liveStatus.phone || config.metaPhone || config.sessionPhone || 'غير محدد'}
                </span>
                <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                  <CheckCircle2 size={11} /> متصل وجاهز للإرسال
                </span>
              </div>

              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block">معرّف الرقم (Phone Number ID)</span>
                <span className="text-sm font-black text-slate-800 dark:text-white block font-mono truncate" title={config.phoneNumberId}>
                  {config.phoneNumberId || 'غير متوفر'}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">معتمد في خوادم ميتا</span>
              </div>

              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block">معرّف حساب الأعمال (WABA ID)</span>
                <span className="text-sm font-black text-slate-800 dark:text-white block font-mono truncate" title={config.wabaId}>
                  {config.wabaId || 'مسجل بميتا'}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">WhatsApp Business Account</span>
              </div>

              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block">تقييم الجودة (Quality Rating)</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {liveStatus.qualityRating || config.qualityRating || 'GREEN (عالي)'}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-500 font-bold">مؤهل لإرسال أعداد ضخمة</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid: 1. Live Interactive Messenger Tester & 2. Official Webhook Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Test Message Sender (Live Testing) */}
        <div className="lg:col-span-6 p-6 sm:p-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Send size={22} />
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">تجربة الإرسال واختبار القوالب عبر ميتا</h3>
              <p className="text-xs text-slate-400 font-bold">إرسال رسالة تفاعلية أو اختبار قالب معتمد مطابق لسياسات ميتا</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Mode Toggle: Interactive vs Template */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setTestMode('interactive')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${testMode === 'interactive' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'}`}
              >
                💬 رسالة تفاعلية بأزرار حرة
              </button>
              <button
                type="button"
                onClick={() => setTestMode('template')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${testMode === 'template' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'}`}
              >
                📑 قالب رسمي معتمد (Approved Template)
              </button>
            </div>

            {testMode === 'template' && (
              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>اسم القالب المعتمد:</span>
                  <span className="font-mono text-blue-600 font-black">{config.metaTemplateName || metaTemplateName || 'غير محدد'}</span>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 block">
                    متغيرات القالب (مفصولة بفاصلة لـ {'{{1}}'}, {'{{2}}'}, {'{{3}}'}):
                  </label>
                  <input
                    type="text"
                    value={testTemplateVariables}
                    onChange={(e) => setTestTemplateVariables(e.target.value)}
                    placeholder="مثال: أحمد محمد, ORD-5821, 350 ج.م"
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold outline-none"
                    dir="rtl"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                رقم هاتف المستلم (للاختبار):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="مثال: 01050511791 أو 201050511791"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="flex-1 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={handleSendTestMessage}
                  disabled={isSendingTest}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-blue-600/20 shrink-0"
                >
                  {isSendingTest ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
                  <span>{testMode === 'template' ? 'إرسال القالب' : 'إرسال تجريبي'}</span>
                </button>
              </div>
            </div>

            {testResult && (
              <div className={`p-4 rounded-2xl text-xs font-bold flex items-start gap-2.5 ${testResult.success ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'}`}>
                {testResult.success ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="shrink-0 mt-0.5" />}
                <div className="space-y-1">
                  <p>{testResult.text}</p>
                  {!testResult.success && testResult.text.includes('#131030') && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 font-medium leading-relaxed">
                      💡 تنبيه وضع الاختبار: حساب ميتا الحالي في وضع التجربة (Test Mode). يجب إضافة هذا الرقم في قائمة To المستلمة في لوحة تحكم Meta Developer أو بدء المحادثة من لوحة ميتا أولاً.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Message Preview Box */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <span className="text-[10px] font-black text-slate-400 block">معاينة الرسالة والأزرار التفاعلية لميتا:</span>
              <div className="bg-[#e7fedb] dark:bg-emerald-950/40 p-3.5 rounded-2xl rounded-tr-none text-xs text-slate-800 dark:text-slate-200 shadow-sm space-y-2 max-w-sm">
                <p className="font-bold leading-relaxed">
                  مرحباً بك! هذه رسالة تجريبية من واجهة Meta Cloud API الرسمية 🚀
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  نظام إدارة الطلبات والشحن الذكي يعمل بأمان ومطابق لسياسات واتساب للأعمال.
                </p>
                <div className="pt-2 border-t border-emerald-600/10 space-y-1">
                  <button type="button" className="w-full py-1.5 px-3 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-[11px] font-black text-blue-600 dark:text-blue-400 shadow-sm flex items-center justify-center">
                    تأكيد الطلب 👍
                  </button>
                  <button type="button" className="w-full py-1.5 px-3 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-[11px] font-black text-slate-700 dark:text-slate-300 shadow-sm flex items-center justify-center">
                    تعديل العنوان ✍️
                  </button>
                  <button type="button" className="w-full py-1.5 px-3 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-[11px] font-black text-red-500 shadow-sm flex items-center justify-center">
                    إلغاء الطلب ❌
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Official Webhook Configuration for Meta */}
        <div className="lg:col-span-6 p-6 sm:p-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Globe size={22} />
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">إعدادات Webhook ميتا (لاستقبال الردود)</h3>
              <p className="text-xs text-slate-400 font-bold">ضع هذا الرابط في لوحة مطوري ميتا لاستقبال ضغطات الأزرار فورياً</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Webhook URL Box */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>رابط الـ Callback URL لميتا:</span>
                <span className="text-[10px] text-blue-600 font-mono">POST &amp; GET (hub.challenge)</span>
              </label>
              <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                <code className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 flex-1 truncate text-left" dir="ltr">
                  {webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(webhookUrl, 'url')}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {copiedField === 'url' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copiedField === 'url' ? 'تم النسخ' : 'نسخ الرابط'}</span>
                </button>
              </div>
            </div>

            {/* Verify Token Box */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>رمز التحقق (Verify Token):</span>
                <span className="text-[10px] text-slate-400">للمصادقة والتحدي الأمني</span>
              </label>
              <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                <code className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 flex-1 truncate text-left" dir="ltr">
                  {metaVerifyToken}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(metaVerifyToken, 'token')}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {copiedField === 'token' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copiedField === 'token' ? 'تم النسخ' : 'نسخ الرمز'}</span>
                </button>
              </div>
            </div>

            {/* Live Webhook Challenge Tester */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleTestWebhookChallenge}
                disabled={isTestingWebhook}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                {isTestingWebhook ? <RefreshCw size={15} className="animate-spin" /> : <Zap size={15} />}
                <span>فحص استجابة الخادم وتحدي Challenge لميتا ⚡</span>
              </button>
            </div>

            {webhookResult && (
              <div className={`p-4 rounded-2xl text-xs font-bold flex items-start gap-2.5 ${webhookResult.success ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'}`}>
                {webhookResult.success ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="shrink-0 mt-0.5" />}
                <p>{webhookResult.text}</p>
              </div>
            )}

            {/* Step-by-Step Meta Instructions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 space-y-2.5">
              <p className="font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                <span>📋 خطوات تفعيل الـ Webhook في لوحة Meta Developers:</span>
              </p>
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-amber-800 dark:text-amber-200 text-[11px] font-bold">
                ⚠️ <strong>ملاحظة هامة:</strong> يجب استخدام رابط الدومين الرسمي المعتمد <code>https://app.abdomedi.com/api/webhook/whatsapp</code> لأن روابط المعاينة التجريبية (ais-dev...) تكون محمية ومغلقة وتمنع وصول فيسبوك.
              </div>
              <ol className="list-decimal list-inside space-y-1.5 leading-relaxed font-medium">
                <li>افتح تطبيقك في <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold">Meta Developers</a> ثم اختر <strong>WhatsApp &gt; Configuration</strong>.</li>
                <li>انقر على زر <strong>Edit</strong> بجانب الـ Webhook.</li>
                <li>الصق رابط الـ <strong>Callback URL</strong> (<code>https://app.abdomedi.com/api/webhook/whatsapp</code>) ورمز الـ <strong>Verify Token</strong> (<code>abdomedi_whatsapp_meta_token</code>).</li>
                <li>انقر <strong>Verify and Save</strong> (سيتفعل فورياً لأن الخادم مهيأ للرد على التحدي).</li>
                <li>في جدول Webhook Fields، فعّل خيار <strong>messages</strong> لتلقي ضغطات الأزرار التفاعلية تلقائياً!</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Meta Message Templates Explorer & Selector */}
      <div className="p-6 sm:p-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 text-purple-600 dark:text-purple-400">
            <FileCheck size={24} />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">قوالب ميتا المعتمدة (Approved Message Templates)</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                  Meta Graph API v21.0
                </span>
              </div>
              <p className="text-xs text-slate-400 font-bold">
                إلزامية لبدء المحادثات وإرسال تأكيدات الأوردرات للعملاء الجدد خارج نافذة الـ 24 ساعة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchTemplatesFromWABA}
            disabled={isLoadingTemplates}
            className="px-4 py-2.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer"
          >
            {isLoadingTemplates ? <RefreshCw size={14} className="animate-spin" /> : <Layers size={14} />}
            <span>{isLoadingTemplates ? 'جاري جلب القوالب...' : 'استيراد القوالب من حساب ميتا'}</span>
          </button>
        </div>

        {/* Current Active Template Info */}
        <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 rounded-2xl border border-purple-200/60 dark:border-purple-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <span className="text-[11px] text-slate-500 font-bold block">القالب الافتراضي لتأكيد الطلبات حالياً:</span>
            <div className="flex items-center gap-2 font-mono">
              <span className="font-black text-purple-700 dark:text-purple-300 text-sm">
                {config.metaTemplateName || 'order_confirmation (افتراضي)'}
              </span>
              <span className="text-slate-400 text-[11px]">[{config.metaTemplateLanguage || 'ar'}]</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setModalTab('manual');
                setShowConfigModal(true);
              }}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50"
            >
              تغيير اسم القالب يدوياً
            </button>
          </div>
        </div>

        {/* Fetched Templates List */}
        {fetchedTemplates.length > 0 ? (
          <div className="space-y-3">
            <span className="text-xs font-black text-slate-700 dark:text-slate-300 block">
              القوالب المتوفرة في حسابك على ميتا ({fetchedTemplates.length} قالب):
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
              {fetchedTemplates.map((tpl) => {
                const isSelected = config.metaTemplateName === tpl.name;
                const isApproved = tpl.status === 'APPROVED';
                const bodyComponent = tpl.components?.find((c: any) => c.type === 'BODY');
                const buttonsComponent = tpl.components?.find((c: any) => c.type === 'BUTTONS');

                return (
                  <div
                    key={tpl.id || tpl.name}
                    className={`p-4 rounded-2xl border transition-all space-y-3 ${isSelected ? 'bg-purple-50/40 dark:bg-purple-950/30 border-purple-400 dark:border-purple-600 ring-2 ring-purple-400/20' : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 hover:border-purple-300'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-slate-900 dark:text-white truncate">
                          {tpl.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">
                          ({tpl.language})
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${isApproved ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'}`}>
                          {tpl.status}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {tpl.category}
                        </span>
                      </div>
                    </div>

                    {bodyComponent?.text && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50 line-clamp-3">
                        {bodyComponent.text}
                      </p>
                    )}

                    {buttonsComponent?.buttons && (
                      <div className="flex flex-wrap gap-1">
                        {buttonsComponent.buttons.map((btn: any, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-md text-[10px] font-bold text-slate-700 dark:text-slate-300">
                            {btn.text}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                      {isSelected ? (
                        <span className="text-xs font-black text-purple-600 dark:text-purple-400 flex items-center gap-1">
                          <CheckCircle2 size={14} /> القالب الافتراضي الحالي
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            const updated = {
                              ...config,
                              metaTemplateName: tpl.name,
                              metaTemplateLanguage: tpl.language || 'ar'
                            };
                            setConfig(updated);
                            setMetaTemplateName(tpl.name);
                            setMetaTemplateLanguage(tpl.language || 'ar');
                            if (onSave) await onSave();
                            await inAppAlert(`تم تعيين القالب "${tpl.name}" كقالب افتراضي للأوردرات بنجاح!`, { type: 'success' });
                          }}
                          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                        >
                          تعيين كافتراضي للأوردرات
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <span>انقر على زر "استيراد القوالب من حساب ميتا" أعلاه لعرض وفحص جميع قوالب الـ WhatsApp المعتمدة واختيار أي منها لتأكيد الطلبات بضغطة واحدة.</span>
            <button
              type="button"
              onClick={fetchTemplatesFromWABA}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl font-bold shrink-0 cursor-pointer"
            >
              فحص القوالب الآن
            </button>
          </div>
        )}
      </div>

      {/* Official Meta Documentation & Compliance Standards Accordion */}
      <div className="p-6 sm:p-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <button
          type="button"
          onClick={() => setShowDocumentationGuide(!showDocumentationGuide)}
          className="w-full flex items-center justify-between text-right cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                دليل توثيق وسياسات Meta WhatsApp Business API الرسمية
              </h3>
              <p className="text-xs text-slate-400 font-bold">
                الروابط المعتمدة، الأذونات المطلوبة، نافذة الـ 24 ساعة، وقواعد قوالب التسويق والمعاملات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-xs font-bold hidden sm:inline">
              {showDocumentationGuide ? 'إخفاء الدليل' : 'استعراض الدليل والمراجع'}
            </span>
            {showDocumentationGuide ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </button>

        {showDocumentationGuide && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4 text-xs text-slate-600 dark:text-slate-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Reference 1: Phone Numbers API */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <PhoneCall size={15} className="text-blue-600" />
                    1. إدارة أرقام الهواتف (Phone Numbers API)
                  </span>
                  <a
                    href="https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1 text-[11px] font-bold"
                  >
                    <span>التوثيق الرسمي</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
                <p className="text-[11px] leading-relaxed">
                  يجب تسجيل الرقم وتأكيده عبر رمز مكون من 6 أرقام (PIN). كل رقم هاتف له معرّف فريد <strong>Phone Number ID</strong> هو المستخدم في إرسال الرسائل عبر الـ Graph API.
                </p>
                <div className="text-[10px] text-slate-400 bg-white dark:bg-slate-900 p-2 rounded-lg font-mono">
                  Endpoint: GET/POST /v21.0/{'{phone-number-id}'}
                </div>
              </div>

              {/* Reference 2: Permissions */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ShieldCheck size={15} className="text-emerald-600" />
                    2. الصلاحيات المطلوبة (Permissions)
                  </span>
                  <a
                    href="https://developers.facebook.com/documentation/business-messaging/whatsapp/permissions"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1 text-[11px] font-bold"
                  >
                    <span>التوثيق الرسمي</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
                <p className="text-[11px] leading-relaxed">
                  يتطلب الربط المباشر صلاحيتين أساسيتين في توكن ميتا:
                </p>
                <ul className="list-disc list-inside text-[11px] font-mono text-slate-700 dark:text-slate-300 space-y-0.5">
                  <li><strong>whatsapp_business_messaging</strong>: لإرسال واستقبال الرسائل والـ Webhooks.</li>
                  <li><strong>whatsapp_business_management</strong>: لاستعراض الأرقام وإدارة القوالب.</li>
                </ul>
              </div>

              {/* Reference 3: 24-Hour Customer Care Window */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Clock size={15} className="text-amber-600" />
                    3. نافذة الـ 24 ساعة (Customer Care Window)
                  </span>
                  <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded text-[10px] font-bold">
                    سياسة حماية المستهلك
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  عندما يرسل العميل رسالة أولاً، تُفتح نافذة حرة مدتها 24 ساعة يمكنك فيها إرسال نصوص حرة أو أزرار تفاعلية. أما للبدء بمحادثة أوردر جديد، <strong>يلزم استخدام قالب معتمد (Approved Template)</strong> وإلا سيعيد النظام الخطأ #131047.
                </p>
              </div>

              {/* Reference 4: Marketing & Custom Templates */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Layers size={15} className="text-purple-600" />
                    4. قوالب المعاملات والتسويق (Templates)
                  </span>
                  <a
                    href="https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/marketing-templates"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1 text-[11px] font-bold"
                  >
                    <span>التوثيق الرسمي</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
                <p className="text-[11px] leading-relaxed">
                  تنقسم القوالب إلى <strong>UTILITY</strong> (تأكيد الطلبات وتحديثات الشحن - الأنسب لنظامنا والأقل تكلفة) و <strong>MARKETING</strong> (العروض الترويجية والخصومات). يتيح نظامنا تمرير متغيرات العميل مثل <code>{'{{1}}'}</code> و <code>{'{{2}}'}</code> تلقائياً.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Meta Configuration & Setup Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">إعدادات ربط Meta WhatsApp API</h3>
                  <p className="text-xs text-slate-400 font-bold">اختر طريقة الربط المناسبة لحسابك</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl gap-1">
              <button
                type="button"
                onClick={() => setModalTab('manual')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${modalTab === 'manual' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'}`}
              >
                🔑 الإدخال المباشر (Phone ID &amp; Token)
              </button>
              <button
                type="button"
                onClick={() => setModalTab('embedded')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${modalTab === 'embedded' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'}`}
              >
                ⚡ تسجيل دخول فيسبوك للأعمال (Embedded)
              </button>
            </div>

            {/* Tab 1: Manual Direct Input */}
            {modalTab === 'manual' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Phone Number ID (معرّف رقم الهاتف) *</span>
                    <span className="text-[10px] text-slate-400">مطلوب من لوحة Meta</span>
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: 105928374029182"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    dir="ltr"
                  />
                </div>

                {/* Auto-detected Phone Numbers Selector */}
                {fetchedPhoneNumbers.length > 0 && (
                  <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-800 space-y-2">
                    <span className="text-xs font-black text-blue-900 dark:text-blue-200 block">
                      الأرقام المسجلة في حساب الأعمال المكتشفة ({fetchedPhoneNumbers.length} رقم):
                    </span>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {fetchedPhoneNumbers.map((p) => (
                        <div
                          key={p.id}
                          className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold font-mono text-slate-800 dark:text-white block" dir="ltr">
                              {p.display_phone_number || p.id}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {p.verified_name || 'رقم معتمد'} • تقييم: {p.quality_rating || 'GREEN'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPhoneNumberId(p.id);
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${phoneNumberId === p.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 text-blue-600'}`}
                          >
                            {phoneNumberId === p.id ? 'محدد ✅' : 'استخدام'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Access Token (رمز الوصول الدائم) *</span>
                    <span className="text-[10px] text-slate-400">System User Token أو EAAG...</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="EAAGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    dir="ltr"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                        WABA ID (معرف حساب الأعمال)
                      </label>
                      <button
                        type="button"
                        onClick={fetchPhoneNumbersFromWABA}
                        disabled={isLoadingPhoneNumbers || !wabaId.trim() || !accessToken.trim()}
                        className="text-[11px] font-bold text-blue-600 hover:underline disabled:opacity-40"
                      >
                        {isLoadingPhoneNumbers ? 'جاري الفحص...' : '⚡ جلب الأرقام تلقائياً'}
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="مثال: 987654321012345"
                      value={wabaId}
                      onChange={(e) => setWabaId(e.target.value)}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                      Webhook Verify Token
                    </label>
                    <input
                      type="text"
                      value={metaVerifyToken}
                      onChange={(e) => setMetaVerifyToken(e.target.value)}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Template Name & Language Setting */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                      اسم قالب تأكيد الطلب المعتمد (Template Name)
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: order_confirmation"
                      value={metaTemplateName}
                      onChange={(e) => setMetaTemplateName(e.target.value)}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                      لغة القالب المعتمدة (Language Code)
                    </label>
                    <input
                      type="text"
                      placeholder="ar أو en"
                      value={metaTemplateLanguage}
                      onChange={(e) => setMetaTemplateLanguage(e.target.value)}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900/50 text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed font-medium">
                  💡 للحصول على هذه البيانات مجاناً: توجه إلى <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="underline font-bold">developers.facebook.com</a> &gt; أنشئ تطبيق نوع Business &gt; أضف منتج WhatsApp &gt; خذ الـ <strong>Phone Number ID</strong> والـ <strong>Temporary / Permanent Token</strong> مباشرة!
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveManualConfig}
                    disabled={isConnecting}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer"
                  >
                    {isConnecting ? <RefreshCw size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                    <span>فحص وحفظ الربط المباشر</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Embedded Signup Configuration */}
            {modalTab === 'embedded' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                    Meta App ID (معرّف تطبيق ميتا)
                  </label>
                  <input
                    type="text"
                    placeholder="933545646518077"
                    value={metaAppId}
                    onChange={(e) => setMetaAppId(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    dir="ltr"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                      Configuration ID (اختياري)
                    </label>
                    <input
                      type="text"
                      placeholder="Configuration ID من لوحة ميتا"
                      value={metaConfigId}
                      onChange={(e) => setMetaConfigId(e.target.value)}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                      Meta App Secret (سر التطبيق - اختياري)
                    </label>
                    <input
                      type="password"
                      placeholder="App Secret لاستبدال الكود تلقائياً"
                      value={metaAppSecret}
                      onChange={(e) => setMetaAppSecret(e.target.value)}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <p className="font-black text-slate-800 dark:text-white">🚀 مميزات الربط عبر نافذة فيسبوك للأعمال:</p>
                  <ul className="list-disc list-inside space-y-1 text-[11px] font-medium leading-relaxed">
                    <li>تأهيل رقم الهاتف واختيار محفظة أعمالك بنقرات سريعة بدون نسخ أو لصق معرفات.</li>
                    <li>التقاط الـ WABA ID والـ Phone Number ID أوتوماتيكياً بمجرد إكمال شاشة ميتا.</li>
                  </ul>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleLaunchEmbeddedSignup}
                    disabled={isConnecting}
                    className="px-6 py-3 bg-[#1877F2] hover:bg-[#166fe5] active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer"
                  >
                    {isConnecting ? <RefreshCw size={15} className="animate-spin" /> : <ExternalLink size={15} />}
                    <span>فتح نافذة تسجيل فيسبوك للأعمال</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
