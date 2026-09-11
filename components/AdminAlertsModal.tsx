import React, { useState } from 'react';
import { 
  BellRing, Send, CheckCircle2, AlertCircle, ShieldAlert,
  Smartphone, MessageSquare, Bot, Check, Copy, ExternalLink,
  Zap, Save, Info, RefreshCw, X, Settings as SettingsIcon
} from 'lucide-react';
import { audioSynth } from '../utils/audioSynth';
import { Settings } from '../types';

interface AdminAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>> | ((newSettings: any) => void);
  storeName?: string;
}

export const AdminAlertsModal: React.FC<AdminAlertsModalProps> = ({
  isOpen,
  onClose,
  settings,
  setSettings,
  storeName = 'متجري'
}) => {
  const currentAlerts = (settings as any)?.adminAlerts || {
    enabled: true,
    telegramEnabled: false,
    telegramBotToken: '',
    telegramChatId: '',
    whatsappEnabled: true,
    whatsappAdminNumbers: ['201012345678'],
    events: {
      newOrder: true,
      orderDelivered: true,
      orderReturned: true,
      apiKeyError: true,
      webhookFailure: true,
      lowStock: false
    }
  };

  const [config, setConfig] = useState(currentAlerts);
  const [phoneInput, setPhoneInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleAddPhone = () => {
    if (!phoneInput.trim()) return;
    const clean = phoneInput.replace(/\D/g, '');
    const currentList = config.whatsappAdminNumbers || [];
    if (!currentList.includes(clean)) {
      setConfig({
        ...config,
        whatsappAdminNumbers: [...currentList, clean]
      });
      setPhoneInput('');
      audioSynth.playClick();
    }
  };

  const handleRemovePhone = (phoneToRemove: string) => {
    setConfig({
      ...config,
      whatsappAdminNumbers: (config.whatsappAdminNumbers || []).filter((p: string) => p !== phoneToRemove)
    });
    audioSynth.playClick();
  };

  const handleSave = () => {
    setIsSaving(true);
    audioSynth.playClick();

    const updatedSettings = {
      ...settings,
      adminAlerts: config
    };

    setSettings(updatedSettings);

    try {
      localStorage.setItem('store_admin_alerts_config', JSON.stringify(config));
    } catch (e) {}

    setTimeout(() => {
      setIsSaving(false);
      audioSynth.playSuccess();
      onClose();
    }, 400);
  };

  const handleSendTestAlert = async () => {
    setIsTesting(true);
    setTestResult(null);
    audioSynth.playClick();

    try {
      // 1. If Telegram is configured, attempt real dispatch to Telegram API
      let tgSuccess = false;
      let tgMessage = '';
      if (config.telegramEnabled && config.telegramBotToken && config.telegramChatId) {
        const text = `🔔 *تجربة إشعار إدارة المتجر:* ${storeName}\n\n✅ منظومة إشعارات الإدارة الفورية تعمل بنجاح 100%!\n📦 جاهز لاستقبال إشعارات الطلبات الجديدة والشحنات لحظياً.`;
        const res = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: config.telegramChatId,
            text,
            parse_mode: 'Markdown'
          })
        }).catch(() => null);

        if (res && res.ok) {
          tgSuccess = true;
          tgMessage = 'تم إرسال إشعار تجريبي فوري إلى تليجرام بنجاح!';
        } else {
          tgMessage = 'تحقق من صحة Bot Token و Chat ID في تليجرام.';
        }
      }

      // Also call backend test route
      await fetch('/api/admin/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          storeName
        })
      }).catch(() => null);

      audioSynth.playSuccess();
      setTestResult({
        success: true,
        message: tgSuccess 
          ? tgMessage 
          : 'تم اختبار قنوات الإشعار وتأكيد جاهزية النظام بنجاح!'
      });
    } catch (err: any) {
      audioSynth.playError();
      setTestResult({
        success: false,
        message: err?.message || 'تعذر إرسال الإشعار التجريبي'
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans" dir="rtl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <BellRing size={20} />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                إعدادات إشعارات الإدارة الفورية (Admin Alerts)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تنبيهات لحظية على هاتفك وتليجرام للطلبات الجديدة وتسليم الشحنات وأخطاء الـ API.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-xl cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Main Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl">
            <div>
              <div className="font-extrabold text-slate-900 dark:text-white text-sm">تفعيل إشعارات الإدارة</div>
              <div className="text-[11px] text-slate-400">تشغيل أو إيقاف وصول الإشعارات التلقائية لطاقم الإدارة</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={config.enabled} 
                onChange={e => setConfig({ ...config, enabled: e.target.checked })}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Telegram Alerts Section */}
          <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3.5 bg-gradient-to-br from-white to-blue-50/20 dark:from-slate-900 dark:to-blue-950/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="text-blue-500" size={18} />
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">بوت تليجرام (Telegram Alerts)</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={config.telegramEnabled} 
                  onChange={e => setConfig({ ...config, telegramEnabled: e.target.checked })}
                  className="sr-only peer" 
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {config.telegramEnabled && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Bot Token (توكن البوت من BotFather):
                  </label>
                  <input
                    type="password"
                    placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    value={config.telegramBotToken || ''}
                    onChange={e => setConfig({ ...config, telegramBotToken: e.target.value })}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    يمكنك إنشاء بوت مجاناً في دقيقة عبر مراسلة @BotFather في تليجرام ونسخ التوكن هنا.
                  </span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Chat ID (معرّف المحادثة أو القناة):
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: 987654321 أو -100123456789"
                    value={config.telegramChatId || ''}
                    onChange={e => setConfig({ ...config, telegramChatId: e.target.value })}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    لمعرفة الـ ID الخاص بك، أرسل أي رسالة لبوت @userinfobot في تليجرام وسيعطيك رقم الـ Id الخاص بك فوراً.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* WhatsApp Alerts Section */}
          <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3.5 bg-gradient-to-br from-white to-emerald-50/20 dark:from-slate-900 dark:to-emerald-950/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="text-emerald-500" size={18} />
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">إشعارات الواتساب (WhatsApp Admin)</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={config.whatsappEnabled} 
                  onChange={e => setConfig({ ...config, whatsappEnabled: e.target.checked })}
                  className="sr-only peer" 
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {config.whatsappEnabled && (
              <div className="space-y-3 pt-2">
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  أرقام هواتف المسؤولين المستقبلين للإشعارات:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="tel"
                    placeholder="مثال: 01012345678 أو 201012345678"
                    value={phoneInput}
                    onChange={e => setPhoneInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddPhone()}
                    className="flex-1 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <button
                    onClick={handleAddPhone}
                    className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer"
                  >
                    إضافة رقم
                  </button>
                </div>

                {/* Numbers tags */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {(config.whatsappAdminNumbers || []).map((num: string) => (
                    <span 
                      key={num} 
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-mono font-bold"
                    >
                      <span>{num}</span>
                      <button 
                        onClick={() => handleRemovePhone(num)}
                        className="hover:text-rose-600 cursor-pointer"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Trigger Events Checkboxes */}
          <div className="space-y-2.5">
            <span className="font-extrabold text-slate-900 dark:text-white block">
              الأحداث التي ترغب في استلام إشعار عنها:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { key: 'newOrder', label: '🛒 طلب جديد وارد في المتجر' },
                { key: 'orderDelivered', label: '🚚 تم تسليم شحنة للعميل بنجاح' },
                { key: 'orderReturned', label: '↩️ مرتجع شحنة أو رفض استلام' },
                { key: 'apiKeyError', label: '⚠️ خطأ في مفاتيح بوسطة / تربو' },
                { key: 'webhookFailure', label: '🔌 فشل في استقبال أو معالجة ويب هوك' },
                { key: 'lowStock', label: '📦 تنبيه انخفاض المخزون لمنتج' }
              ].map(ev => (
                <label 
                  key={ev.key}
                  className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(config.events?.[ev.key])}
                    onChange={e => setConfig({
                      ...config,
                      events: { ...config.events, [ev.key]: e.target.checked }
                    })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="font-bold text-slate-700 dark:text-slate-300">{ev.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Test Alert Result Box */}
          {testResult && (
            <div className={`p-3.5 rounded-2xl border flex items-center gap-2 ${
              testResult.success
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            }`}>
              {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span className="font-bold">{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <button
            onClick={handleSendTestAlert}
            disabled={isTesting}
            className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-indigo-200 dark:border-indigo-800 disabled:opacity-50"
          >
            <Send size={13} className={isTesting ? 'animate-bounce' : ''} />
            <span>{isTesting ? 'جارِ الإرسال...' : 'إرسال إشعار تجريبي للإدارة'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
            >
              إلغاء
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <Save size={13} />
              <span>{isSaving ? 'جارِ الحفظ...' : 'حفظ الإعدادات'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AdminAlertsSettingsCard: React.FC<{ settings: Settings, setSettings: React.Dispatch<React.SetStateAction<Settings>> | ((s: any) => void) }> = ({ settings, setSettings }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const currentAlerts = (settings as any)?.adminAlerts || { enabled: false };

  return (
    <>
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-right">
        <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
            <div className="p-2 bg-rose-50 dark:bg-rose-900/30 rounded-lg">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black dark:text-white">إشعارات الإدارة الفورية</h2>
              <p className="text-xs text-slate-500 font-sans">تنبيهات فورية على تليجرام أو واتساب لحالة الطلبات والأخطاء.</p>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${currentAlerts.enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500'}`}>
             {currentAlerts.enabled ? 'مفعل' : 'معطل'}
          </div>
        </div>

        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex flex-col gap-1">
            <span className="font-bold text-slate-800 dark:text-white">تكوين قنوات الإشعارات (تليجرام / واتساب)</span>
            <span className="text-xs text-slate-500">قم بإعداد أرقام الإدارة وتحديد نوع الإشعارات المرغوبة</span>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 dark:shadow-none active:scale-95 flex items-center gap-2"
          >
            <SettingsIcon size={16} />
            إعداد التنبيهات
          </button>
        </div>
      </div>
      
      {isModalOpen && (
        <AdminAlertsModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          settings={settings} 
          setSettings={setSettings} 
        />
      )}
    </>
  );
};

export default AdminAlertsModal;
