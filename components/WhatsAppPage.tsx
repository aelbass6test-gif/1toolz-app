import React, { useState, useMemo } from 'react';
import { Order, Settings, WhatsAppConfig, WhatsAppTemplate } from '../types';
import { 
  MessageSquare, Send, Search, Settings as SettingsIcon, 
  Save, Trash2, Plus, Bell, CheckCircle2, AlertTriangle, 
  RefreshCw, Smartphone, Code, FileText, Phone, X
} from 'lucide-react';
import { whatsappService } from '../utils/whatsappService';
import { DEFAULT_WHATSAPP_TEMPLATES } from '../constants';

interface WhatsAppPageProps {
  orders: Order[];
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  onSave?: () => Promise<void>;
}

const WhatsAppPage: React.FC<WhatsAppPageProps> = ({ orders, settings, setSettings, onSave }) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'templates' | 'devices' | 'settings'>('chats');
  const [searchTerm, setSearchTerm] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isScanningQR, setIsScanningQR] = useState(false);
  const [deviceName, setDeviceName] = useState('جهاز #186031');

  // WhatsApp Config state (local for form editing)
  const [config, setConfig] = useState<WhatsAppConfig>(settings.whatsappConfig || {
    apiUrl: 'https://api.ultramsg.com/instance186031/',
    instanceId: 'instance186031',
    token: 'hilzrk5qc9lv7jfa',
    isActive: true,
    autoSendOnStatusChange: true,
    providerType: 'local_gateway',
    isConnected: true,
    sessionPhone: '201012345678'
  });

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
      <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 w-fit">
        <button 
          onClick={() => setActiveTab('chats')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'chats' ? 'bg-white dark:bg-slate-800 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50'}`}
        >
          <Smartphone size={18} />
          دردشات سريعة
        </button>
        <button 
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'templates' ? 'bg-white dark:bg-slate-800 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50'}`}
        >
          <FileText size={18} />
          قوالب الرسائل
        </button>
        <button 
          onClick={() => setActiveTab('devices')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'devices' ? 'bg-white dark:bg-slate-800 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50'}`}
        >
          <Smartphone size={18} />
          ربط الأجهزة والـ QR
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'settings' ? 'bg-white dark:bg-slate-800 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50'}`}
        >
          <SettingsIcon size={18} />
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
        {activeTab === 'chats' && (
          <div className="grid grid-cols-1 md:grid-cols-3 h-full divide-x divide-x-reverse divide-slate-100 dark:divide-slate-800">
            <div className="p-6 border-l border-slate-100 dark:border-slate-800">
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
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">قوالب الرسائل الجاهزة</h3>
                <p className="text-sm text-slate-500 mt-1">المتغيرات المتاحة: {'{customerName}'}, {'{orderNumber}'}, {'{totalPrice}'}, {'{storeName}'}, {'{trackingUrl}'}</p>
              </div>
              <button 
                onClick={addTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-lg font-bold hover:bg-emerald-100 transition-all"
              >
                <Plus size={18} />
                إضافة قالب
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {templates.map((template) => (
                <div key={template.id} className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
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

                  <div className="flex flex-col gap-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
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
          <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
            {/* Top Device Bar */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">حالة الاتصال</label>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                  <button 
                    onClick={() => {
                      setIsScanningQR(true);
                      setTimeout(() => setIsScanningQR(false), 2000);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition-all flex items-center gap-1.5"
                  >
                    <RefreshCw size={14} className={isScanningQR ? "animate-spin" : ""} />
                    Scan QR code
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">API URL</label>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                  <input 
                    type="text" 
                    value={config.apiUrl} 
                    onChange={e => setConfig({ ...config, apiUrl: e.target.value })}
                    className="bg-transparent text-xs font-mono outline-none w-full"
                  />
                  <button onClick={() => navigator.clipboard.writeText(config.apiUrl)} className="text-slate-400 hover:text-emerald-600"><Code size={14}/></button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Instance ID</label>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                  <input 
                    type="text" 
                    value={config.instanceId} 
                    onChange={e => setConfig({ ...config, instanceId: e.target.value })}
                    className="bg-transparent text-xs font-mono outline-none w-full"
                  />
                  <button onClick={() => navigator.clipboard.writeText(config.instanceId)} className="text-slate-400 hover:text-emerald-600"><Code size={14}/></button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Token</label>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                  <input 
                    type="password" 
                    value={config.token} 
                    onChange={e => setConfig({ ...config, token: e.target.value })}
                    className="bg-transparent text-xs font-mono outline-none w-full"
                  />
                  <button onClick={() => navigator.clipboard.writeText(config.token)} className="text-slate-400 hover:text-emerald-600"><Code size={14}/></button>
                </div>
              </div>
            </div>

            {/* QR Code & Phone Simulation View */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Phone Preview / Chats list */}
              <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-xl border border-slate-800 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                    <Smartphone size={16} />
                    WhatsApp Connected (#186031)
                  </span>
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">متصل</span>
                </div>
                <div className="space-y-3">
                  <div className="p-3 bg-slate-800/80 rounded-xl flex items-center justify-between">
                    <div>
                      <h5 className="font-bold text-sm">Steve Smith</h5>
                      <p className="text-xs text-slate-400">👍 تأكيد الطلب</p>
                    </div>
                    <span className="text-[10px] text-slate-500">أمس</span>
                  </div>
                  <div className="p-3 bg-slate-800/80 rounded-xl flex items-center justify-between">
                    <div>
                      <h5 className="font-bold text-sm">محمد أحمد</h5>
                      <p className="text-xs text-slate-400">Hola 👋</p>
                    </div>
                    <span className="text-[10px] text-slate-500">أمس</span>
                  </div>
                  <div className="p-3 bg-slate-800/80 rounded-xl flex items-center justify-between">
                    <div>
                      <h5 className="font-bold text-sm">عميل تجريبي #1001</h5>
                      <p className="text-xs text-slate-400">تم استلام الطلب بنجاح</p>
                    </div>
                    <span className="text-[10px] text-slate-500">الآن</span>
                  </div>
                </div>
              </div>

              {/* QR Code Pairing Box */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-8 justify-between">
                <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner">
                  {/* Simulated QR Code Matrix SVG */}
                  <div className="w-56 h-56 bg-white p-3 rounded-xl shadow border border-slate-200 flex items-center justify-center">
                    <svg viewBox="0 0 25 25" className="w-full h-full text-slate-900 fill-current">
                      <path d="M0 0h7v7H0zM2 2h3v3H2zM18 0h7v7h-7zM20 2h3v3h-3zM0 18h7v7H0zM2 20h3v3H2zM9 2h2v3H9zM13 2h2v2h-2zM9 7h2v2H9zM13 6h4v2h-4zM6 9h3v2H6zM14 9h2v2h-2zM18 9h4v2h-4zM2 13h2v3H2zM7 13h3v2H7zM12 12h2v3h-2zM16 13h3v2h-3zM21 12h2v4h-2zM9 16h2v3H9zM13 16h3v2h-3zM17 18h4v2h-4zM2 22h4v2H2zM9 21h3v2H9zM14 21h2v3h-2zM19 22h4v2h-4z"/>
                    </svg>
                  </div>
                  <span className="text-xs text-slate-500 mt-3 font-medium">الباركود صالح لمدة 45 ثانية فقط</span>
                </div>

                <div className="space-y-6 text-right flex-1">
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white">لإرسال الرسائل واستلامها ، يجب عليك تفويض الجهاز</h3>
                    <p className="text-slate-500 text-sm mt-2">قم بربط رقم واتساب الخاص بك بنقرة واحدة عبر مسح الرمز بجوالك.</p>
                  </div>

                  <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</span>
                      <span>افتح تطبيق WhatsApp على هاتفك</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</span>
                      <span>اضغط القائمة (⋮) أو الإعدادات ⚙️ واختر الأجهزة المرتبطة (Linked Devices)</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</span>
                      <span>وجه هاتفك إلى هذه الشاشة لالتقاط الباركود وسيكون جاهزاً فوراً للإرسال التلقائي.</span>
                    </div>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button 
                      onClick={handleSaveSettings}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow transition-all"
                    >
                      حفظ وتفعيل الجهاز
                    </button>
                    <button 
                      onClick={() => setConfig({ ...config, isConnected: false })}
                      className="px-6 py-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 hover:bg-rose-100 rounded-xl font-bold transition-all border border-rose-200 dark:border-rose-900"
                    >
                      تسجيل خروج / قطع الاتصال
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="p-8 max-w-3xl mx-auto space-y-10">
            {/* Provider Type Selector */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 pb-4 border-b border-slate-100 dark:border-slate-800">
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
                <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400 pb-4 border-b border-slate-100 dark:border-slate-800">
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
                <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 pb-4 border-b border-slate-100 dark:border-slate-800">
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
              <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 pb-4 border-b border-slate-100 dark:border-slate-800">
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
