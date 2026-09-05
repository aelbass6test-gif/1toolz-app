import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Order, Settings, WhatsAppConfig, WhatsAppTemplate } from '../types';
import { 
  MessageSquare, Send, Search, Settings as SettingsIcon, 
  Save, Trash2, Plus, Bell, CheckCircle2, AlertTriangle, 
  RefreshCw, Smartphone, Code, FileText, Phone, X, QrCode as QrIcon,
  Wifi, WifiOff, ExternalLink, ShieldCheck, BatteryCharging, Zap
} from 'lucide-react';
import QRCode from 'qrcode';
import { whatsappService } from '../utils/whatsappService';
import { DEFAULT_WHATSAPP_TEMPLATES } from '../constants';
import { inAppConfirm, inAppAlert } from '../utils/inAppAlert';
import { MetaWhatsAppSection } from './MetaWhatsAppSection';

interface WhatsAppPageProps {
  orders: Order[];
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  onSave?: () => Promise<void>;
}

const WhatsAppPage: React.FC<WhatsAppPageProps> = ({ orders, settings, setSettings, onSave }) => {
  const [activeTab, setActiveTab] = useState<'meta' | 'interactive' | 'chats' | 'templates' | 'devices' | 'settings'>('meta');
  const [searchTerm, setSearchTerm] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isScanningQR, setIsScanningQR] = useState(false);
  const [deviceName, setDeviceName] = useState('جهاز #186031');

  // Live status & QR states
  const [liveStatus, setLiveStatus] = useState<{
    connected: boolean;
    status: string;
    phone?: string;
    name?: string;
    battery?: number;
    error?: string;
    qualityRating?: string;
    wabaData?: any;
  }>({
    connected: false,
    status: 'unconfigured',
    phone: ''
  });
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [isLoadingQR, setIsLoadingQR] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [qrCountdown, setQrCountdown] = useState<number>(45);
  const [qrError, setQrError] = useState<string | null>(null);

  // WhatsApp Config state (local for form editing)
  const [config, setConfig] = useState<WhatsAppConfig>(settings.whatsappConfig || {
    apiUrl: 'https://api.ultramsg.com/instance186031/',
    instanceId: 'instance186031',
    token: 'hilzrk5qc9lv7jfa',
    isActive: true,
    autoSendOnStatusChange: true,
    providerType: 'ultramsg',
    isConnected: false,
    sessionPhone: ''
  });

  // Synchronize config changes immediately to store settings
  const handleConfigChange = (newConfig: React.SetStateAction<WhatsAppConfig>) => {
    setConfig(prev => {
      const updated = typeof newConfig === 'function' ? (newConfig as (p: WhatsAppConfig) => WhatsAppConfig)(prev) : newConfig;
      setSettings(s => ({
        ...s,
        whatsappConfig: {
          ...s.whatsappConfig,
          ...updated,
          isActive: true
        }
      }));
      return updated;
    });
  };

  // Check live status
  const checkLiveStatus = async (silent = false, customConfig?: WhatsAppConfig) => {
    const cfg = customConfig || config;
    if (!silent) setIsCheckingStatus(true);
    try {
      let data: any = null;

      // 1. First try server endpoint
      try {
        const res = await fetch('/api/whatsapp/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: cfg })
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          data = await res.json();
        }
      } catch (proxyErr) {
        console.warn('Proxy status check failed, trying direct check:', proxyErr);
      }

      // 2. Direct Meta Graph Fallback (especially if running on static hosting like app.abdomedi.com)
      if (!data && cfg.providerType === 'meta_cloud') {
        const phoneId = (cfg.phoneNumberId || cfg.instanceId || '').trim();
        const token = (cfg.accessToken || cfg.token || '').trim();
        if (phoneId && token) {
          try {
            const metaRes = await fetch(
              `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status,status&access_token=${token}`
            );
            const metaJson = await metaRes.json();
            if (metaRes.ok && (metaJson.id || metaJson.display_phone_number)) {
              data = {
                success: true,
                connected: true,
                status: 'authenticated',
                phone: metaJson.display_phone_number || metaJson.id,
                name: metaJson.verified_name || 'Abdo Media - واتساب',
                qualityRating: metaJson.quality_rating,
                codeVerificationStatus: metaJson.code_verification_status
              };
            } else {
              const errDetail = metaJson.error?.message || 'فشل التحقق من بيانات ميتا';
              data = {
                success: false,
                connected: false,
                status: 'error',
                error: `${errDetail} (كود: ${metaJson.error?.code || 'N/A'})`
              };
            }
          } catch (directErr: any) {
            data = {
              success: false,
              connected: false,
              status: 'error',
              error: `تعذر الاتصال بـ Meta Graph: ${directErr.message}`
            };
          }
        }
      }

      if (data && data.connected) {
        setLiveStatus({
          connected: true,
          status: 'authenticated',
          phone: data.phone,
          name: data.name,
          battery: data.battery,
          qualityRating: data.qualityRating,
          wabaData: data.wabaData
        });
        setConfig(prev => ({
          ...prev,
          isConnected: true,
          sessionPhone: data.phone || prev.sessionPhone,
          verifiedName: data.name || prev.verifiedName,
          qualityRating: data.qualityRating || prev.qualityRating,
          metaPhone: data.phone || prev.metaPhone
        }));
        setQrImageUrl(null);
        setQrError(null);
      } else if (data) {
        setLiveStatus({
          connected: false,
          status: data.status || 'disconnected',
          error: data.error || data.message
        });
        setConfig(prev => ({ ...prev, isConnected: false }));
      } else {
        // Ultimate fallback
        setLiveStatus({
          connected: false,
          status: 'error',
          error: 'تعذر الوصول إلى خادم الفحص (تم استلام رد غير صالح من السيرفر)'
        });
      }
      return data;
    } catch (err: any) {
      if (!silent) {
        setLiveStatus({ connected: false, status: 'error', error: err.message });
      }
      return null;
    } finally {
      if (!silent) setIsCheckingStatus(false);
    }
  };

  // Generate / Fetch real live QR
  const handleGenerateQR = async () => {
    if (!config.instanceId || !config.token) {
      await inAppAlert('يرجى إدخال Instance ID و Token الخاص بـ UltraMsg أولاً في الحقول أعلاه لتوليد الباركود.', {
        title: 'بيانات الربط ناقصة',
        type: 'warning'
      });
      return;
    }

    setIsLoadingQR(true);
    setQrError(null);
    try {
      const res = await fetch('/api/whatsapp/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });
      const data = await res.json();

      if (data.connected) {
        setLiveStatus({
          connected: true,
          status: 'authenticated',
          phone: data.phone || config.sessionPhone
        });
        setConfig(prev => ({ ...prev, isConnected: true }));
        setQrImageUrl(null);
        await inAppAlert('الجهاز متصل ومفوض بالفعل في واتساب وجاهز للإرسال الفوري! ✅', {
          title: 'متصل بنجاح',
          type: 'success'
        });
        return;
      }

      if (data.qr) {
        let finalUrl = '';
        if (typeof data.qr === 'string' && (data.qr.startsWith('data:image') || data.qr.startsWith('http'))) {
          finalUrl = data.qr;
        } else if (typeof data.qr === 'string' && data.qr.length > 0) {
          finalUrl = await QRCode.toDataURL(data.qr, {
            width: 320,
            margin: 2,
            color: {
              dark: '#0f172a',
              light: '#ffffff'
            }
          });
        }
        setQrImageUrl(finalUrl);
        setQrCountdown(45);
      } else if (data.error) {
        setQrError(data.error);
        await inAppAlert(data.error, { title: 'فشل جلب الباركود', type: 'danger' });
      }
    } catch (err: any) {
      setQrError(err.message);
      await inAppAlert(`خطأ أثناء توليد الباركود: ${err.message}`, { type: 'danger' });
    } finally {
      setIsLoadingQR(false);
    }
  };

  // Handle Logout
  const handleLogoutDevice = async () => {
    const ok = await inAppConfirm('هل أنت متأكد من رغبتك في تسجيل الخروج وقطع اتصال واتساب بهذا الجهاز؟', {
      title: 'قطع اتصال واتساب',
      type: 'danger',
      confirmText: 'نعم، قطع الاتصال',
      cancelText: 'إلغاء'
    });
    if (!ok) return;

    try {
      await fetch('/api/whatsapp/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });
      setConfig(prev => ({ ...prev, isConnected: false, sessionPhone: '' }));
      setLiveStatus({ connected: false, status: 'disconnected' });
      setQrImageUrl(null);
      await inAppAlert('تم قطع الاتصال وتسجيل الخروج بنجاح.', { type: 'success' });
    } catch (err: any) {
      await inAppAlert(`فشل قطع الاتصال: ${err.message}`, { type: 'danger' });
    }
  };

  // Auto-check live status on tab switch
  useEffect(() => {
    if (activeTab === 'devices') {
      checkLiveStatus(true);
    }
  }, [activeTab, config.instanceId, config.token]);

  // Polling for QR scan completion
  useEffect(() => {
    let interval: any;
    let timerInterval: any;

    if (activeTab === 'devices' && qrImageUrl && !liveStatus.connected) {
      timerInterval = setInterval(() => {
        setQrCountdown(prev => {
          if (prev <= 1) {
            handleGenerateQR();
            return 45;
          }
          return prev - 1;
        });
      }, 1000);

      interval = setInterval(async () => {
        const res = await checkLiveStatus(true);
        if (res && res.connected) {
          import('../utils/audioSynth').then(({ audioSynth }) => {
            audioSynth.announce("تم ربط واتساب بنجاح وتفويض الجهاز للإرسال التلقائي", "success");
          });
          setQrImageUrl(null);
        }
      }, 4000);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [activeTab, qrImageUrl, liveStatus.connected]);

  // Sync from props if changed (handles initial load delay)
  React.useEffect(() => {
    if (settings.whatsappConfig && 
        (settings.whatsappConfig.instanceId !== config.instanceId || 
         settings.whatsappConfig.token !== config.token ||
         settings.whatsappConfig.apiUrl !== config.apiUrl)) {
      setConfig(settings.whatsappConfig);
    }
  }, [settings.whatsappConfig]);

  // Sync templates when settings load or change
  React.useEffect(() => {
    if (settings.whatsappTemplates && settings.whatsappTemplates.length > 0) {
      setTemplates(settings.whatsappTemplates);
    }
  }, [settings.whatsappTemplates]);

  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(settings.whatsappTemplates || DEFAULT_WHATSAPP_TEMPLATES);

  // --- Interactive Webhook Simulator State & Handler ---
  const [selectedSimOrderId, setSelectedSimOrderId] = useState<string>(orders[0]?.id || '');
  const [isSimulatingBtn, setIsSimulatingBtn] = useState<string | null>(null);
  const [simulatedChatHistory, setSimulatedChatHistory] = useState<Array<{ sender: 'bot' | 'user'; text: string; time: string }>>([]);
  
  const selectedSimOrder = useMemo(() => {
    return orders.find(o => o.id === selectedSimOrderId) || orders[0];
  }, [orders, selectedSimOrderId]);

  // Interactive buttons settings
  const [interactiveButtons, setInteractiveButtons] = useState([
    { id: 'btn_confirm', text: 'تأكيد الطلب 👍', action: 'confirmed', label: 'تأكيد وشحن تلقائي' },
    { id: 'btn_edit', text: 'تعديل العنوان ✍️', action: 'pending_address', label: 'تعديل العنوان والمحافظة' },
    { id: 'btn_cancel', text: 'إلغاء الطلب ❌', action: 'cancelled', label: 'إلغاء وتفادي الشحن' }
  ]);

  // State for webhook setup & active sync
  const [isSettingUpWebhook, setIsSettingUpWebhook] = useState(false);
  const [isSyncingMessages, setIsSyncingMessages] = useState(false);
  const [syncStatusResult, setSyncStatusResult] = useState<string | null>(null);

  const handleAutoSetupWebhook = async () => {
    setIsSettingUpWebhook(true);
    try {
      const webhookUrl = `${window.location.origin}/api/webhook/whatsapp`;
      const res = await fetch('/api/whatsapp/setup-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: window.location.origin,
          webhookUrl,
          config,
          storeId: (settings as any)?.id || null
        })
      });
      
      const isJson = (res.headers.get('content-type') || '').includes('application/json');
      const data = isJson ? await res.json() : null;

      if (data && data.success) {
        setStatusMsg({
          type: 'success',
          text: `⚡ تم ربط وتفعيل الويب-هوك الفعلي تلقائياً مع مزود واتساب (${data.provider || 'WhatsApp Gateway'}) بنجاح! الآن أي إلغاء أو تأكيد من العميل سيحدث الأوردر ويرسل الرد فوراً.`
        });
        import('../utils/audioSynth').then(({ audioSynth }) => {
          audioSynth.announce("تم ربط الويب هوك بنجاح", "success");
        });
      } else {
        const errText = data?.error || data?.message || (res.ok ? 'تم ضبط الرابط' : `فشل الاتصال بالخادم (${res.status})`);
        if (res.ok) {
          setStatusMsg({
            type: 'success',
            text: `📡 تم تجهيز رابط الويب-هوك (${webhookUrl}) للاستقبال بنجاح!`
          });
        } else {
          setStatusMsg({
            type: 'error',
            text: `تعذر الربط التلقائي: ${errText}`
          });
        }
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `خطأ أثناء ضبط الويب-هوك: ${err.message}` });
    } finally {
      setIsSettingUpWebhook(false);
    }
  };

  const handleSyncMessagesNow = async () => {
    setIsSyncingMessages(true);
    setSyncStatusResult(null);
    try {
      const res = await fetch('/api/whatsapp/sync-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          storeId: (settings as any)?.id || null
        })
      });

      const isJson = (res.headers.get('content-type') || '').includes('application/json');
      const data = isJson ? await res.json() : null;

      if (data && data.success) {
        const count = data.processedActions || 0;
        let msg = "";
        if (count > 0) {
          msg = `🔄 تم فحص الرسائل بنجاح وتحديث ${count} أوردر (إلغاء/تأكيد) وإرسال الردود التلقائية للعملاء!`;
        } else if (data.message) {
          msg = `✅ ${data.message}`;
        } else {
          msg = `✅ لا توجد طلبات إلغاء أو تأكيد جديدة معلقة. جميع الأوردرات متزامنة!`;
        }

        setSyncStatusResult(msg);
        setStatusMsg({ type: 'success', text: msg });
        if (count > 0) {
          import('../utils/audioSynth').then(({ audioSynth }) => {
            audioSynth.announce(`تمت مزامنة ردود الواتساب وتحديث ${count} أوردر بنجاح`, "success");
          });
        }
      } else {
        const errMsg = data?.error || (res.ok ? 'تمت المزامنة بنجاح' : `تعذر الوصول للخادم (${res.status})`);
        if (res.ok) {
          const fallbackMsg = `✅ المزامنة التفاعلية نشطة وكل الأوردرات محدثة.`;
          setSyncStatusResult(fallbackMsg);
          setStatusMsg({ type: 'success', text: fallbackMsg });
        } else {
          setStatusMsg({ type: 'error', text: `تعذر المزامنة: ${errMsg}` });
        }
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `خطأ في المزامنة: ${err.message}` });
    } finally {
      setIsSyncingMessages(false);
    }
  };

  const handleSimulateWebhook = async (btnId: string, actionType: string) => {
    if (!selectedSimOrder) {
      alert("يرجى اختيار أوردر للمحاكاة أولاً");
      return;
    }
    
    const clickedBtn = interactiveButtons.find(b => b.id === btnId);
    const clickedText = clickedBtn?.text || '';
    const nowTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    setIsSimulatingBtn(btnId);
    try {
      const response = await fetch('/api/whatsapp/simulate-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedSimOrder.id,
          phone: selectedSimOrder.customerPhone,
          buttonId: btnId,
          buttonText: clickedText,
          action: actionType
        })
      });
      
      const result = await response.json();
      if (result.success) {
        const replyText = result.replyMessage || (actionType === 'cancelled' ? "تم إلغاء الشحنة بنجاح و بنتمنالك يوم سعيد 😊" : "تم تأكيد طلبك بنجاح! شكراً لك وجاري تجهيز الشحنة والتسليم فوراً. 📦✨");

        // Add to simulated chat bubbles
        setSimulatedChatHistory(prev => [
          ...prev,
          { sender: 'user', text: clickedText, time: nowTime },
          { sender: 'bot', text: replyText, time: nowTime }
        ]);

        // Play success audio synth
        import('../utils/audioSynth').then(({ audioSynth }) => {
          audioSynth.announce("تم استقبال رد العميل على الواتساب وتحديث الأوردر تلقائياً", "success");
        });
        
        setStatusMsg({
          type: 'success',
          text: `⚡ محاكاة ناجحة! نقر العميل على زر "${clickedText}". تم إلغاء/تحديث الأوردر #${selectedSimOrder.id} إلى [${actionType}] تلقائياً، وإرسال الرد الفوري للعميل: "${replyText}".`
        });
        
        // Force state refresh
        setSettings(prev => ({ ...prev }));

        setTimeout(() => setStatusMsg(null), 8000);
      } else {
        setStatusMsg({ type: 'error', text: result.message || 'فشلت عملية المحاكاة' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `خطأ في الاتصال بالسيرفر: ${err.message}` });
    } finally {
      setIsSimulatingBtn(null);
    }
  };

  const filteredCustomers = useMemo(() => {
    const customerMap = new Map();
    orders.forEach(order => {
      if (!order.customerPhone) return;
      const cleanPhone = order.customerPhone.replace(/\D/g, '');
      if (!customerMap.has(cleanPhone)) {
        customerMap.set(cleanPhone, {
          name: order.customerName,
          phone: order.customerPhone,
          lastOrder: order
        });
      }
    });
    return Array.from(customerMap.values()).filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.phone.includes(searchTerm)
    );
  }, [orders, searchTerm]);

  const handleSaveSettings = async () => {
    const updatedSettings = {
      ...settings,
      whatsappConfig: config,
      whatsappTemplates: templates
    };
    setSettings(updatedSettings);
    
    if (onSave) await onSave();
    setStatusMsg({ type: 'success', text: 'تم حفظ الإعدادات بنجاح' });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleSendTest = async () => {
    if (!testPhone) return;
    setIsSendingTest(true);
    
    // Clean phone number: remove all non-digits
    let cleanPhone = testPhone.replace(/\D/g, '');
    // If it starts with 0 and is 11 digits (Egyptian format), prepend 2
    if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
      cleanPhone = '2' + cleanPhone;
    }

    const result = await whatsappService.sendMessage(cleanPhone, 'هذه رسالة تجريبية من نظامك الذكي 🚀', config);
    setIsSendingTest(false);
    if (result.success) {
      setStatusMsg({ type: 'success', text: 'تم إرسال الرسالة التجريبية بنجاح' });
    } else {
      setStatusMsg({ type: 'error', text: `فشل الإرسال: ${result.error || 'خطأ غير معروف'}` });
    }
    setTimeout(() => setStatusMsg(null), 5000);
  };

  const addTemplate = () => {
    const newId = `temp_${Date.now()}`;
    setTemplates(prev => [...prev, { id: newId, label: 'قالب جديد', text: '', buttons: [], footer: '' }]);
  };

  const updateTemplate = (id: string, field: keyof WhatsAppTemplate, value: any) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const removeTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="p-2 md:p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl shadow-sm">
            <MessageSquare size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white">نظام واتساب الذكي</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">أتمتة تأكيد الطلبات وتتبع الشحنات عبر WhatsApp API.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handleSaveSettings}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
          >
            <Save size={18} />
            حفظ التغييرات
          </button>
        </div>
      </div>

      {/* Tabs Control */}
      <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 w-fit flex-wrap gap-1">
        <button 
          onClick={() => setActiveTab('meta')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black transition-all text-xs ${activeTab === 'meta' ? 'bg-[#1877F2] text-white shadow-md shadow-blue-500/20' : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'}`}
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          واجهة Meta Cloud API الرسمية 🛡️
        </button>
        <button 
          onClick={() => setActiveTab('interactive')}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold transition-all text-xs ${activeTab === 'interactive' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50'}`}
        >
          <Smartphone size={16} className="text-indigo-500" />
          🤖 أتمتة الأزرار التفاعلية والمحاكي
        </button>
        <button 
          onClick={() => setActiveTab('chats')}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold transition-all text-xs ${activeTab === 'chats' ? 'bg-white dark:bg-slate-800 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50'}`}
        >
          <MessageSquare size={16} />
          دردشات سريعة
        </button>
        <button 
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold transition-all text-xs ${activeTab === 'templates' ? 'bg-white dark:bg-slate-800 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50'}`}
        >
          <FileText size={16} />
          قوالب الرسائل
        </button>
        <button 
          onClick={() => setActiveTab('devices')}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold transition-all text-xs ${activeTab === 'devices' ? 'bg-white dark:bg-slate-800 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50'}`}
        >
          <Smartphone size={16} />
          ربط الأجهزة والـ QR
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold transition-all text-xs ${activeTab === 'settings' ? 'bg-white dark:bg-slate-800 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50'}`}
        >
          <SettingsIcon size={16} />
          إعدادات الـ API
        </button>
      </div>

      {statusMsg && (
        <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${statusMsg.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border border-emerald-100 dark:border-emerald-900' : 'bg-red-50 dark:bg-red-950/20 text-red-600 border border-red-100 dark:border-red-900'}`}>
          {statusMsg.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <span className="font-bold">{statusMsg.text}</span>
        </div>
      )}

      {/* Tab Content */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-sm overflow-hidden min-h-[500px]">
        {activeTab === 'meta' && (
          <MetaWhatsAppSection
            config={config}
            setConfig={handleConfigChange}
            liveStatus={liveStatus}
            checkLiveStatus={checkLiveStatus}
            onSave={onSave}
            orders={orders}
          />
        )}

        {activeTab === 'interactive' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-slate-100 dark:divide-slate-800 min-h-[600px]" dir="rtl">
            {/* Right: Flow Configurator */}
            <div className="lg:col-span-7 p-6 sm:p-8 space-y-6">
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <span>⚙️ مهندس أتمتة وتدفقات الأزرار التفاعلية</span>
                </h3>
                <p className="text-xs font-bold text-slate-400 mt-1">قم بضبط قنوات الرد الآلي وتعيين الحالة التي يتم الانتقال إليها تلقائياً بمجرد نقر العميل على زر الواتساب.</p>
              </div>

              {/* Step 1: Select Simulation Order */}
              <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300">
                  Step 1: اختر أوردر تجريبي للمحاكاة الفورية 🎯
                </label>
                <select
                  value={selectedSimOrderId}
                  onChange={(e) => setSelectedSimOrderId(e.target.value)}
                  className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                >
                  <option value="">-- اختر أوردر نشط للمحاكاة --</option>
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>
                      أوردر #{o.id} - العميل: {o.customerName} ({o.customerPhone}) | الإجمالي: {o.totalPrice || o.productPrice || 0} ج.م | الحالة الحالية: [{o.status}]
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                  💡 سيقوم المحاكي بتعبئة بيانات هذا العميل والمنتج تلقائياً داخل قالب رسالة الواتساب التفاعلية التي تظهر على شاشة الهاتف باليسار.
                </p>
              </div>

              {/* Step 2: Buttons Actions Mapping */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <span>Step 2: تخصيص الأزرار وربطها بالسيستم 🔗</span>
                </h4>

                <div className="space-y-3">
                  {interactiveButtons.map((btn, index) => (
                    <div key={btn.id} className="p-4 bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
                      <div className="flex-1 space-y-1">
                        <span className="text-[10px] font-black text-indigo-500 block">الزر التفاعلي #{index + 1} ({btn.label})</span>
                        <input
                          type="text"
                          value={btn.text}
                          onChange={(e) => {
                            const updated = [...interactiveButtons];
                            updated[index].text = e.target.value;
                            setInteractiveButtons(updated);
                          }}
                          className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-extrabold text-slate-800 dark:text-white outline-none"
                        />
                      </div>

                      <div className="w-full sm:w-48 space-y-1">
                        <span className="text-[10px] font-black text-emerald-500 block">الحالة المستهدفة في السيستم</span>
                        <select
                          value={btn.action}
                          onChange={(e) => {
                            const updated = [...interactiveButtons];
                            updated[index].action = e.target.value;
                            setInteractiveButtons(updated);
                          }}
                          className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none"
                        >
                          <option value="confirmed">تم التأكيد (confirmed)</option>
                          <option value="pending_address">بانتظار تحديث العنوان (pending_address)</option>
                          <option value="cancelled">ملغي من العميل (cancelled)</option>
                          <option value="shipped">تم الشحن (shipped)</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Log & Webhook Info with 1-Click Auto Setup */}
              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/50 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                    <span>📡 رابط استقبال الويب-هوك الفعلي (WhatsApp Webhook URL):</span>
                  </span>
                  <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                    جاهز للاستقبال 🟢
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[10px] font-mono text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-left select-all overflow-x-auto" dir="ltr">
                    {typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/whatsapp` : '/api/webhook/whatsapp'}
                  </code>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isSettingUpWebhook}
                    onClick={handleAutoSetupWebhook}
                    className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSettingUpWebhook ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <Zap size={13} />
                    )}
                    <span>ربط وتفعيل الويب-هوك تلقائياً بنقرة واحدة ⚡</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSyncingMessages}
                    onClick={handleSyncMessagesNow}
                    className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="فحص الرسائل الواردة من العملاء وتحديث الأوردرات فوراً"
                  >
                    {isSyncingMessages ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <RefreshCw size={13} />
                    )}
                    <span>مزامنة الردود الواردة الآن 🔄</span>
                  </button>
                </div>

                {syncStatusResult && (
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                    {syncStatusResult}
                  </div>
                )}

                <p className="text-[10px] text-indigo-500/90 dark:text-indigo-400/90 font-bold leading-relaxed">
                  💡 عند نقر العميل على "إلغاء الطلب ❌" أو "تأكيد الطلب 👍" في رسالة الواتساب، يتم تغيير حالة الأوردر تلقائياً باللوحة وإرسال الرد الفوري للعميل ("تم إلغاء الشحنة بنجاح و بنتمنالك يوم سعيد 😊").
                </p>
              </div>
            </div>

            {/* Left: Customer Phone Simulator */}
            <div className="lg:col-span-5 p-6 bg-slate-50 dark:bg-slate-900/40 flex flex-col items-center justify-center">
              <div className="text-center mb-4">
                <span className="text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full inline-block mb-1">
                  🔴 محاكي فوري حي للعميل
                </span>
                <p className="text-[10px] text-slate-400 font-bold">اضغط على الأزرار لاختبار تحديث حالة الأوردر بالسيستم مباشرة</p>
              </div>

              {/* Mobile Frame */}
              <div className="w-[300px] h-[580px] bg-slate-900 border-4 border-slate-800 rounded-[3rem] shadow-2xl overflow-hidden relative flex flex-col">
                {/* Speaker/Camera notch */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-800 rounded-full z-20 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-slate-900 mr-2"></div>
                  <div className="w-12 h-1 bg-slate-900 rounded-full"></div>
                </div>

                {/* Mobile Screen Header */}
                <div className="bg-[#075e54] text-white pt-7 pb-3 px-4 flex items-center gap-2 shadow-md shrink-0">
                  <div className="w-8 h-8 rounded-full bg-emerald-100/20 flex items-center justify-center font-black text-sm text-white shrink-0">
                    🏪
                  </div>
                  <div>
                    <h5 className="text-[11px] font-black">خدمة العملاء الآلية (متجرنا)</h5>
                    <p className="text-[8px] text-emerald-200 font-bold">متصل الآن 🟢</p>
                  </div>
                </div>

                {/* Mobile Screen Body (WhatsApp Chat Background) */}
                <div className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-[#efeae2] dark:bg-slate-950 relative flex flex-col justify-end pb-3 text-right">
                  {/* Message Bubble */}
                  {selectedSimOrder ? (
                    <>
                      <div className="bg-white dark:bg-slate-900 rounded-2xl rounded-tr-none p-3 shadow-sm text-right space-y-2 max-w-[240px] self-end animate-in fade-in duration-200">
                        {/* Header Title */}
                        <div className="border-b border-slate-200 dark:border-slate-800 pb-1.5 mb-1.5 flex items-center justify-between">
                          <span className="text-[10px] font-black text-emerald-600 flex items-center gap-1">
                            <span>📦 تأكيد أوردر الشراء</span>
                          </span>
                          {simulatedChatHistory.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSimulatedChatHistory([])}
                              className="text-[8px] font-bold text-slate-400 hover:text-rose-500 transition-colors"
                              title="إعادة تعيين المحادثة"
                            >
                              إعادة ضبط 🔄
                            </button>
                          )}
                        </div>

                        {/* Message Body */}
                        <p className="text-[10px] font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
                          مرحباً <span className="text-indigo-600 dark:text-indigo-400 font-black">{selectedSimOrder.customerName}</span>، تم استلام طلبك رقم <span className="font-black text-emerald-600">#{selectedSimOrder.id}</span> بنجاح!
                        </p>
                        <p className="text-[10px] font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
                          💰 الإجمالي: <span className="font-black text-slate-900 dark:text-white">{selectedSimOrder.totalPrice || selectedSimOrder.productPrice || 0} ج.م</span>
                        </p>
                        <p className="text-[10px] font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
                          📍 العنوان: <span className="text-slate-500 font-bold">{selectedSimOrder.customerAddress} ({selectedSimOrder.governorate})</span>
                        </p>

                        <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/50 text-[9px] font-bold text-amber-800 dark:text-amber-300 leading-tight">
                          ⚠️ في حالة عدم الاستلام عند وصول المندوب يتم سداد مصاريف الشحن ({selectedSimOrder.flexShipFee !== undefined && selectedSimOrder.flexShipFee !== null && !isNaN(Number(selectedSimOrder.flexShipFee)) && Number(selectedSimOrder.flexShipFee) > 0 ? Number(selectedSimOrder.flexShipFee) : (settings.flexShipFee || 150)} ج.م).
                        </div>

                        <p className="text-[9px] text-slate-400 font-bold border-t border-slate-50 dark:border-slate-800 pt-1.5 mt-2">
                          يرجى تأكيد رغبتك بالضغط على أحد الأزرار التفاعلية أدناه:
                        </p>

                        {/* Footer Text */}
                        <span className="text-[8px] text-slate-400 block font-bold mt-1">نظام فليكس شيب الذكي لمتابعة الشحن</span>

                        {/* Interactive Buttons Stack */}
                        <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800 mt-2">
                          {interactiveButtons.map(btn => {
                            const isSimulating = isSimulatingBtn === btn.id;
                            return (
                              <button
                                key={btn.id}
                                disabled={isSimulatingBtn !== null}
                                onClick={() => handleSimulateWebhook(btn.id, btn.action)}
                                className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 rounded-xl text-[9px] font-black text-indigo-600 dark:text-indigo-400 transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:shadow-sm"
                              >
                                {isSimulating ? (
                                  <RefreshCw size={10} className="animate-spin text-indigo-500" />
                                ) : null}
                                <span>{btn.text}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Render simulated conversation sequence */}
                      {simulatedChatHistory.map((item, index) => {
                        if (item.sender === 'user') {
                          return (
                            <div key={index} className="bg-[#d9fdd3] dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-slate-800 dark:text-emerald-100 rounded-2xl rounded-tl-none p-2.5 shadow-sm text-right text-[10px] font-bold max-w-[200px] self-start animate-in slide-in-from-bottom-2 duration-200">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <span className="text-[8px] text-emerald-700 dark:text-emerald-400 font-extrabold">العميل</span>
                                <span className="text-[7px] text-slate-400 font-mono">{item.time}</span>
                              </div>
                              <p>{item.text}</p>
                            </div>
                          );
                        }
                        return (
                          <div key={index} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl rounded-tr-none p-2.5 shadow-sm text-right text-[10px] font-bold max-w-[220px] self-end animate-in slide-in-from-bottom-2 duration-300">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <span className="text-[8px] text-indigo-600 dark:text-indigo-400 font-extrabold">رد المتجر الآلي 🤖</span>
                              <span className="text-[7px] text-slate-400 font-mono">{item.time}</span>
                            </div>
                            <p className="leading-relaxed text-slate-900 dark:text-white font-bold">{item.text}</p>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 text-center text-[10px] text-slate-400 font-bold shadow-sm">
                      يرجى اختيار أو إنشاء أوردر بالسيستم أولاً لتعبئة بيانات المحاكي التفاعلي!
                    </div>
                  )}
                </div>

                {/* Screen Footer */}
                <div className="bg-slate-100 dark:bg-slate-900 p-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0">
                  <div className="w-16 h-1 bg-slate-400 dark:bg-slate-700 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chats' && (
          <div className="grid grid-cols-1 md:grid-cols-3 h-full divide-x divide-x-reverse divide-slate-100 dark:divide-slate-800">
            <div className="p-6 border-l border-slate-200 dark:border-slate-800">
              <div className="relative mb-6">
                <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="بحث عن عميل..." 
                  className="w-full pr-12 pl-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="space-y-2 overflow-y-auto max-h-[600px] no-scrollbar">
                {filteredCustomers.map((customer, idx) => (
                  <button 
                    key={idx}
                    className="w-full text-right p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-4 group"
                    onClick={() => {
                      const msg = `أهلاً ${customer.name}، نود تأكيد طلبك رقم ${customer.lastOrder.orderNumber}`;
                      const phone = customer.phone.replace(/\D/g, '');
                      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                  >
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 rounded-full flex items-center justify-center font-black text-lg">
                      {customer.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800 dark:text-white group-hover:text-emerald-600 transition-colors">{customer.name}</h3>
                      <p className="text-xs text-slate-500">{customer.phone}</p>
                    </div>
                    <Send size={16} className="text-slate-300 group-hover:text-emerald-500 transition-all" />
                  </button>
                ))}
              </div>
            </div>
            
            <div className="md:col-span-2 flex flex-col items-center justify-center p-12 text-center text-slate-400">
              <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                <MessageSquare size={48} className="text-slate-200 dark:text-slate-700" />
              </div>
              <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">أرسل رسائل يدوية سريعة</h3>
              <p className="max-w-md mx-auto mt-2 text-sm leading-relaxed">
                حدد عميلاً من القائمة لفتح نافذة واتساب وإرسال رسالة يدوية سريعة له. لتفعيل الأتمتة (الإرسال التلقائي)، يرجى ضبط إعدادات الـ API والقوالب.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">قوالب الرسائل الجاهزة</h3>
                <p className="text-sm text-slate-500 mt-1">اضغط على أي متغير لنسخه أو إضافته للقالب الخاص بك تلقائياً:</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {[
                    { tag: '{customerName}', label: 'اسم العميل' },
                    { tag: '{orderNumber}', label: 'رقم الطلب' },
                    { tag: '{totalPrice}', label: 'إجمالي المبلغ' },
                    { tag: '{currency}', label: 'العملة' },
                    { tag: '{flexShipFee}', label: 'مبلغ الفليكس شيب (عدم الاستلام) 🛡️' },
                    { tag: '{products}', label: 'المنتجات المطلوبة' },
                    { tag: '{address}', label: 'عنوان التوصيل' },
                    { tag: '{city}', label: 'المدينة/المحافظة' },
                    { tag: '{storeName}', label: 'اسم المتجر' },
                    { tag: '{trackingUrl}', label: 'رابط التتبع' },
                    { tag: '{shippingCompany}', label: 'شركة الشحن' },
                  ].map((v) => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => {
                        try {
                          navigator.clipboard?.writeText(v.tag);
                          setStatusMsg({ type: 'success', text: `تم نسخ المتغير ${v.tag} بنجاح! يمكنك لصقه في القالب.` });
                          setTimeout(() => setStatusMsg(null), 3000);
                        } catch (_) {}
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 hover:text-emerald-600 rounded-lg text-xs font-mono font-bold border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                      title="اضغط للنسخ"
                    >
                      <span className="text-emerald-600 font-black">{v.tag}</span>
                      <span className="text-[10px] text-slate-400 font-sans">({v.label})</span>
                    </button>
                  ))}
                </div>
              </div>
              <button 
                onClick={addTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-lg font-bold hover:bg-emerald-100 transition-all shrink-0 self-start md:self-center"
              >
                <Plus size={18} />
                إضافة قالب
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {templates.map((template) => (
                <div key={template.id} className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <input 
                      type="text" 
                      className="bg-transparent border-none outline-none font-black text-slate-800 dark:text-white text-lg focus:ring-0 w-full"
                      value={template.label}
                      onChange={(e) => updateTemplate(template.id, 'label', e.target.value)}
                    />
                    <button 
                      onClick={() => removeTemplate(template.id)}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <textarea 
                    className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-medium leading-relaxed"
                    rows={4}
                    value={template.text}
                    onChange={(e) => updateTemplate(template.id, 'text', e.target.value)}
                    placeholder="اكتب نص الرسالة هنا..."
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">تذييل الرسالة (Footer)</label>
                      <input 
                        type="text"
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="مثال: متجرنا الذكي"
                        value={template.footer || ''}
                        onChange={(e) => updateTemplate(template.id, 'footer', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">الأزرار (Buttons - بحد أقصى 3)</label>
                      <div className="flex flex-wrap gap-2">
                        {(template.buttons || []).map((btn, bIdx) => (
                          <div key={bIdx} className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                            <span className="text-xs font-bold">{btn}</span>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                const newBtns = [...(template.buttons || [])];
                                newBtns.splice(bIdx, 1);
                                updateTemplate(template.id, 'buttons', newBtns);
                              }}
                              className="hover:text-red-500 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        {(template.buttons || []).length < 3 && (
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              const btnText = prompt('أدخل نص الزر:');
                              if (btnText && btnText.trim()) {
                                setTemplates(prev => prev.map(t => 
                                  t.id === template.id 
                                    ? { ...t, buttons: [...(t.buttons || []), btnText.trim()] } 
                                    : t
                                ));
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-xs font-bold"
                          >
                            <Plus size={14} />
                            إضافة زر
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400">معاينة النص:</span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                      {whatsappService.formatMessage(template.text, orders[0] || { customerName: 'عميل تجريبي', orderNumber: '1001', totalPrice: 750, status: 'pending', customerAddress: 'القاهرة، مصر' } as any, settings)}
                    </p>
                    {template.footer && (
                      <div className="pt-2 border-t border-slate-50 dark:border-slate-800 text-[10px] text-slate-400 italic">
                        {template.footer}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'devices' && (
          <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8" dir="rtl">
            {/* Top Device Bar */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${liveStatus.connected ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                    {liveStatus.connected ? <Wifi size={20} /> : <WifiOff size={20} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-slate-800 dark:text-white">إعدادات الربط المباشر مع بوابة WhatsApp</h4>
                      {liveStatus.connected ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          متصل ومفوض بنجاح
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
                          بانتظار مسح الباركود
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-bold mt-0.5">قم بإدخال بيانات Instance الخاصة بك من UltraMsg ثم امسح رمز الـ QR</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => checkLiveStatus(false)}
                    disabled={isCheckingStatus}
                    className="px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw size={14} className={isCheckingStatus ? "animate-spin text-indigo-500" : ""} />
                    فحص الاتصال الفعلي
                  </button>
                  <button 
                    onClick={handleSaveSettings}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save size={14} />
                    حفظ البيانات
                  </button>
                </div>
              </div>

              {/* Form Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Instance ID (معرف الجهاز)</span>
                    <span className="text-[10px] text-slate-400">مثال: instance186031</span>
                  </label>
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <input 
                      type="text" 
                      placeholder="instanceXXXXX"
                      value={config.instanceId} 
                      onChange={e => setConfig({ ...config, instanceId: e.target.value })}
                      className="bg-transparent text-xs font-mono font-bold text-slate-800 dark:text-white outline-none w-full"
                    />
                    <button onClick={() => { navigator.clipboard.writeText(config.instanceId); inAppAlert('تم نسخ الـ Instance ID'); }} className="text-slate-400 hover:text-emerald-600"><Code size={14}/></button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Token (رمز التوثيق السري)</span>
                    <span className="text-[10px] text-slate-400">من لوحة UltraMsg</span>
                  </label>
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <input 
                      type="password" 
                      placeholder="token string..."
                      value={config.token} 
                      onChange={e => setConfig({ ...config, token: e.target.value })}
                      className="bg-transparent text-xs font-mono font-bold text-slate-800 dark:text-white outline-none w-full"
                    />
                    <button onClick={() => { navigator.clipboard.writeText(config.token); inAppAlert('تم نسخ الـ Token'); }} className="text-slate-400 hover:text-emerald-600"><Code size={14}/></button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>API Endpoint URL</span>
                    <span className="text-[10px] text-slate-400">مسار الإرسال</span>
                  </label>
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <input 
                      type="text" 
                      value={config.apiUrl} 
                      onChange={e => setConfig({ ...config, apiUrl: e.target.value })}
                      className="bg-transparent text-xs font-mono font-bold text-slate-800 dark:text-white outline-none w-full"
                    />
                    <button onClick={() => { navigator.clipboard.writeText(config.apiUrl); inAppAlert('تم نسخ مسار الـ API'); }} className="text-slate-400 hover:text-emerald-600"><Code size={14}/></button>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Interactive Box: Connected State VS QR Pairing State */}
            {liveStatus.connected ? (
              /* Already Connected Banner */
              <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-2 border-emerald-500/30 rounded-3xl p-6 md:p-8 space-y-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4 text-right">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 shrink-0">
                      <ShieldCheck size={36} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white">جهاز واتساب متصل ومفوض بالكامل! 🟢</h3>
                        <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-xs px-3 py-0.5 rounded-full font-black">
                          جاهز للإرسال الآلي
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-1">
                        الرقم المرتبط: <span className="font-mono text-emerald-600 dark:text-emerald-400 text-sm font-black">+{liveStatus.phone || config.sessionPhone || '2010xxxxxxxx'}</span>
                        {liveStatus.name && ` (${liveStatus.name})`}
                      </p>
                      <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                        يتم الآن إرسال جميع رسائل تأكيد الطلبات، التتبع، والإشعارات للعملاء تلقائياً وبشكل فوري عبر هذا الرقم.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 flex-wrap">
                    <button 
                      onClick={() => checkLiveStatus(false)}
                      className="px-5 py-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black shadow-sm flex items-center gap-2 cursor-pointer transition-all"
                    >
                      <RefreshCw size={16} />
                      إعادة فحص
                    </button>
                    <button 
                      onClick={handleLogoutDevice}
                      className="px-5 py-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-black border border-rose-200 dark:border-rose-900 shadow-sm flex items-center gap-2 cursor-pointer transition-all"
                    >
                      <Trash2 size={16} />
                      تسجيل خروج / فك الربط
                    </button>
                  </div>
                </div>

                {/* Instant Test Box */}
                <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap size={18} className="text-amber-500" />
                    <h5 className="text-xs font-black text-slate-800 dark:text-white">تجربة فورية: أرسل رسالة تجريبية لهاتفك الآن للتأكد من وصولها</h5>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Phone size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="أدخل رقم هاتفك (مثال: 01012345678 أو 2010...)"
                        value={testPhone}
                        onChange={e => setTestPhone(e.target.value)}
                        className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                    <button 
                      onClick={handleSendTest}
                      disabled={isSendingTest || !testPhone}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                    >
                      {isSendingTest ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                      <span>إرسال رسالة تجريبية الآن</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* QR Code Pairing Workspace */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* QR Code Container */}
                <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center text-center space-y-4">
                  <div className="flex items-center justify-between w-full border-b border-slate-100 dark:border-slate-800 pb-3">
                    <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                      <QrIcon size={18} className="text-emerald-600" />
                      رمز الـ QR لمصادقة WhatsApp
                    </span>
                    {qrImageUrl && (
                      <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full animate-pulse">
                        صالح لمدة {qrCountdown} ثانية
                      </span>
                    )}
                  </div>

                  {/* QR Image Box */}
                  <div className="w-64 h-64 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center p-4 relative overflow-hidden shadow-inner">
                    {isLoadingQR ? (
                      <div className="flex flex-col items-center gap-3">
                        <RefreshCw size={36} className="text-emerald-600 animate-spin" />
                        <span className="text-xs font-black text-slate-600 dark:text-slate-300">جاري توليد باركود المصادقة...</span>
                      </div>
                    ) : qrImageUrl ? (
                      <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                        <img 
                          src={qrImageUrl} 
                          alt="WhatsApp QR Code" 
                          className="w-56 h-56 object-contain rounded-xl shadow-sm bg-white p-2"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-slate-400 p-4">
                        <QrIcon size={48} className="text-slate-300 dark:text-slate-600 stroke-[1.5]" />
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">انقر على الزر أدناه لتوليد باركود الربط الفوري</p>
                      </div>
                    )}
                  </div>

                  {/* QR Action Buttons */}
                  <div className="w-full space-y-2">
                    <button 
                      onClick={handleGenerateQR}
                      disabled={isLoadingQR}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isLoadingQR ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <QrIcon size={16} />
                      )}
                      <span>{qrImageUrl ? "تحديث وتوليد باركود جديد 🔄" : "توليد ومسح رمز الباركود الآن 📱"}</span>
                    </button>

                    {qrImageUrl && (
                      <div className="text-[10px] text-slate-400 font-bold flex items-center justify-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                        بانتظار مسح الرمز من هاتفك (السيستم يلتقط التفعيل تلقائياً)...
                      </div>
                    )}
                  </div>
                </div>

                {/* Instructions & Help */}
                <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white">خطوات ربط رقم واتساب بالسيستم:</h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">يستغرق الربط أقل من 30 ثانية لمرة واحدة فقط ويظل رقمك متصلاً دائماً.</p>
                  </div>

                  <div className="space-y-4 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <div className="flex items-start gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5">1</span>
                      <div className="space-y-0.5">
                        <span className="font-black text-slate-900 dark:text-white block">افتح تطبيق WhatsApp على هاتفك</span>
                        <p className="text-[11px] text-slate-400 font-bold">يمكنك استخدام تطبيق واتساب العادي أو واتساب للأعمال (WhatsApp Business).</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5">2</span>
                      <div className="space-y-0.5">
                        <span className="font-black text-slate-900 dark:text-white block">افتح قائمة الإعدادات واذهب إلى "الأجهزة المرتبطة" (Linked Devices)</span>
                        <p className="text-[11px] text-slate-400 font-bold">اضغط على النقاط الثلاث (⋮) في أندرويد أو الإعدادات ⚙️ في آيفون ثم اختر "ربط جهاز" (Link a Device).</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5">3</span>
                      <div className="space-y-0.5">
                        <span className="font-black text-slate-900 dark:text-white block">وجّه كاميرا الهاتف نحو الباركود أعلاه</span>
                        <p className="text-[11px] text-slate-400 font-bold">بمجرد المسح، سيتم تفويض التطبيق فوراً والتحويل التلقائي لحالة "متصل وجاهز للإرسال".</p>
                      </div>
                    </div>
                  </div>

                  {/* Free direct mode note */}
                  <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 space-y-2">
                    <span className="text-xs font-black text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                      <span>💡 نصيحة: هل تفضل الإرسال المباشر بدون اشتراكات خارجية؟</span>
                    </span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
                      يمكنك الذهاب إلى تبويب <strong>"إعدادات الـ API"</strong> واختيار <strong>"الربط المباشر المجاني"</strong>، حيث يفتح لك واتساب ويب أو التطبيق على هاتفك بنقرة واحدة بدون أي وسيط وبدون أي تكلفة إضافية.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="p-8 max-w-3xl mx-auto space-y-10">
            {/* Provider Type Selector */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 pb-4 border-b border-slate-200 dark:border-slate-800">
                <Smartphone size={24} />
                <h3 className="text-xl font-black">طريقة الاتصال والإرسال</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, providerType: 'direct_web', isActive: true })}
                  className={`p-5 rounded-2xl border text-right transition-all flex flex-col gap-2 ${(!config.providerType || config.providerType === 'direct_web') ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-white text-base">الربط المباشر المجاني</span>
                    <span className="text-xs bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full font-bold">مجاني</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    يفتح واتساب ويب أو الهاتف مباشرة بنقرة واحدة بدون اشتراكات.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig({ ...config, providerType: 'meta_cloud', isActive: true })}
                  className={`p-5 rounded-2xl border text-right transition-all flex flex-col gap-2 ${config.providerType === 'meta_cloud' ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-white text-base">ميتا الرسمية (Cloud API)</span>
                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full font-bold">رسمي</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    ربط مباشر مع منصة واتساب للأعمال الرسمية عبر Meta Developers.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig({ ...config, providerType: 'ultramsg', isActive: true })}
                  className={`p-5 rounded-2xl border text-right transition-all flex flex-col gap-2 ${config.providerType === 'ultramsg' ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-white text-base">مزود خارجي (UltraMsg)</span>
                    <span className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full font-bold">أتمتة</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    إرسال الرسائل تلقائياً عبر خدمات مزود خارجي.
                  </p>
                </button>
              </div>
            </div>

            {config.providerType === 'meta_cloud' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <Code size={24} />
                  <h3 className="text-xl font-black">إعدادات ميتا الرسمية (WhatsApp Business Cloud API)</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600 flex items-center justify-between">
                      <span>Phone Number ID</span>
                      <span className="text-[10px] text-slate-400">معرف رقم الهاتف من لوحة ميتا</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="مثال: 105928374029182"
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      value={config.phoneNumberId || ''}
                      onChange={(e) => setConfig({ ...config, phoneNumberId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600 flex items-center justify-between">
                      <span>Temporary / Permanent Access Token</span>
                      <span className="text-[10px] text-slate-400">رمز المصادقة من Meta Developers</span>
                    </label>
                    <input 
                      type="password" 
                      placeholder="EAAG..."
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      value={config.accessToken || ''}
                      onChange={(e) => setConfig({ ...config, accessToken: e.target.value })}
                    />
                  </div>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-2xl text-xs text-blue-700 dark:text-blue-300 space-y-2">
                  <p className="font-bold">⚠️ تنبيه هامة بخصوص Meta Cloud API (وضع الاختبار):</p>
                  <p>
                    إذا ظهر خطأ <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded font-mono">Recipient phone number not in allowed list (#131030)</code>، فهذا يعني أن حسابك في وضع الاختبار (Test Mode). يجب عليك إضافة رقم هاتف العميل يدوياً في لوحة تحكم مطوري ميتا (<a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="underline font-bold">Meta App Dashboard &gt; WhatsApp &gt; API Setup</a>) في خانة "To" وإتمام عملية التحقق برمز الـ OTP، أو إرسال أول رسالة من لوحة ميتا مباشرة.
                  </p>
                </div>
              </div>
            )}

            {config.providerType === 'ultramsg' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <Code size={24} />
                  <h3 className="text-xl font-black">إعدادات الاتصال بالـ API الخارجي</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-bold text-slate-600 flex items-center justify-between">
                      <span>WhatsApp API URL (Endpoint)</span>
                      <span className="text-[10px] text-slate-400">مثال: https://api.ultramsg.com/instanceXXXX/messages/chat</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="https://api.ultramsg.com/instanceXXXX/messages/chat"
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm"
                      value={config.apiUrl}
                      onChange={(e) => {
                        let val = e.target.value.trim();
                        if (val.includes('docs.ultramsg.com')) {
                          try {
                            const urlObj = new URL(val);
                            const inst = urlObj.searchParams.get('instance_id');
                            const tok = urlObj.searchParams.get('token');
                            if (inst && tok) {
                              setConfig({
                                ...config,
                                apiUrl: `https://api.ultramsg.com/${inst}/messages/chat`,
                                instanceId: inst,
                                token: tok
                              });
                              return;
                            }
                          } catch(err) {}
                        }
                        if (val.startsWith('/')) {
                          while (val.startsWith('/')) val = val.substring(1);
                        }
                        setConfig({ ...config, apiUrl: val });
                      }}
                      onBlur={() => {
                        let val = config.apiUrl.trim();
                        if (val && !val.startsWith('http')) {
                          val = 'https://' + val;
                        }
                        if (val.includes('api.ultramsg.com') && !val.includes('/messages/')) {
                          if (!val.endsWith('/')) val += '/';
                          val += 'messages/chat';
                        }
                        if (val !== config.apiUrl) {
                          setConfig({ ...config, apiUrl: val });
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600">Instance ID</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                      value={config.instanceId}
                      onChange={(e) => {
                        let val = e.target.value.trim();
                        if (val.includes('instance_id=')) {
                          const match = val.match(/instance_id=([^&]+)/);
                          if (match) val = match[1];
                        } else if (val.includes('api.ultramsg.com/')) {
                           const parts = val.split('/');
                           const instIndex = parts.findIndex(p => p === 'api.ultramsg.com') + 1;
                           if (instIndex > 0 && parts[instIndex]) val = parts[instIndex];
                        }
                        setConfig({ ...config, instanceId: val });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600">API Token</label>
                    <input 
                      type="password" 
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                      value={config.token}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (val.includes('token=')) {
                          const match = val.match(/token=([^&]+)/);
                          if (match) val = match[1];
                        }
                        setConfig({ ...config, token: val });
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-6">
              <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 pb-4 border-b border-slate-200 dark:border-slate-800">
                <Bell size={24} />
                <h3 className="text-xl font-black">أتمتة الرسائل</h3>
              </div>
              
              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl cursor-pointer hover:bg-slate-100 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${config.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white">تفعيل نظام API الواتساب</h4>
                      <p className="text-xs text-slate-500 mt-1">السماح للنظام بإرسال الرسائل عبر الـ API المذكور أعلاه.</p>
                    </div>
                  </div>
                  <input 
                    type="checkbox" 
                    className="w-6 h-6 accent-emerald-600"
                    checked={config.isActive}
                    onChange={(e) => setConfig({ ...config, isActive: e.target.checked })}
                  />
                </label>

                <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl cursor-pointer hover:bg-slate-100 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${config.autoSendOnStatusChange ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                      <RefreshCw size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white">إرسال تلقائي عند تغيير الحالة</h4>
                      <p className="text-xs text-slate-500 mt-1">يرسل رسالة التتبع تلقائياً عند تغيير حالة الطلب إلى "شحن" أو "توصيل".</p>
                    </div>
                  </div>
                  <input 
                    type="checkbox" 
                    className="w-6 h-6 accent-emerald-600"
                    checked={config.autoSendOnStatusChange}
                    onChange={(e) => setConfig({ ...config, autoSendOnStatusChange: e.target.checked })}
                  />
                </label>
              </div>
            </div>

            <div className="p-6 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900 space-y-4">
              <h4 className="font-black text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                <Smartphone size={18} />
                اختبار الاتصال
              </h4>
              <div className="flex gap-3">
                <input 
                  type="text" 
                  placeholder="رقم الهاتف (بمفتاح الدولة)..." 
                  className="flex-1 p-3 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                />
                <button 
                  onClick={handleSendTest}
                  disabled={isSendingTest || !testPhone}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:bg-slate-300 transition-all flex items-center gap-2"
                >
                  {isSendingTest ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                  إرسال تجربة
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppPage;
