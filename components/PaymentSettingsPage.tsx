import React, { useState } from 'react';
import { Settings, PaymentMethod, MoneyHashConfig, MoneyHashMethodConfig } from '../types';
import { CreditCard, Plus, Trash2, Edit3, Smartphone, Banknote, Save, X, Key, ShieldCheck, RefreshCw, Zap, ExternalLink, CheckCircle, AlertTriangle, Layers, UserPlus } from 'lucide-react';
import { inAppConfirm } from '../utils/inAppAlert';
import { DEFAULT_MONEYHASH_CONFIG, MONEYHASH_DEFAULT_METHODS, createMoneyHashAccount } from '../utils/moneyHashService';

interface ToggleButtonProps { active: boolean; onToggle: () => void; variant?: "blue" | "emerald" | "amber"; disabled?: boolean; }
const ToggleButton: React.FC<ToggleButtonProps> = ({ active, onToggle, variant = "emerald", disabled = false }) => {
  const colors = { blue: active ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700', emerald: active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700', amber: active ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700' };
  const disabledClasses = disabled ? 'cursor-not-allowed opacity-50' : '';
  return ( <button type="button" onClick={(e) => { if (!disabled) { e.stopPropagation(); onToggle(); } }} className={`w-12 h-6 rounded-full relative transition-all duration-300 shadow-inner ${colors[variant]} ${disabledClasses}`} disabled={disabled}> <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-md transform ${active ? 'translate-x-[-28px]' : 'translate-x-[-4px]'}`} /> <span className={`absolute inset-0 flex items-center px-1 text-[8px] font-black uppercase pointer-events-none transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0'}`} style={{ right: '4px', color: 'white' }}>On</span> <span className={`absolute inset-0 flex items-center px-1 text-[8px] font-black uppercase pointer-events-none transition-opacity duration-300 ${active ? 'opacity-0' : 'opacity-100'}`} style={{ left: '4px', color: '#64748b' }}>Off</span> </button> );
};

interface PaymentSettingsPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

const PaymentSettingsPage: React.FC<PaymentSettingsPageProps> = ({ settings, setSettings }) => {
  const [activeTab, setActiveTab] = useState<'moneyhash' | 'manual'>('moneyhash');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState<Partial<PaymentMethod>>({ name: '', details: '', instructions: '', type: 'manual', active: true });

  // MoneyHash State Initialization
  const currentMoneyHashConfig: MoneyHashConfig = settings.moneyHashConfig || DEFAULT_MONEYHASH_CONFIG;
  const [mhConfig, setMhConfig] = useState<MoneyHashConfig>(currentMoneyHashConfig);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // MoneyHash v1.1 Sub-Account Creation State
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [accForm, setAccForm] = useState({ name: '', email: '', phone: '', country: 'EG' });
  const [accCreating, setAccCreating] = useState(false);
  const [accResultMsg, setAccResultMsg] = useState<{ success: boolean; message: string } | null>(null);

  const handleCreateAccountSubmit = async () => {
    if (!accForm.name) return;
    setAccCreating(true);
    setAccResultMsg(null);
    try {
      const res = await createMoneyHashAccount({
        name: accForm.name,
        email: accForm.email,
        phone: accForm.phone,
        country: accForm.country,
        currency: mhConfig.currency || 'EGP',
        config: mhConfig
      });
      if (res.success && res.accountId) {
        setMhConfig(prev => ({
          ...prev,
          accountKey: res.accountKey || res.accountId || prev.accountKey
        }));
        setAccResultMsg({
          success: true,
          message: `تم إنشاء حساب التاجر بنجاح 🚀 (رقم الحساب: ${res.accountId})`
        });
        setTimeout(() => {
          setShowCreateAccountModal(false);
          setAccResultMsg(null);
        }, 2200);
      } else {
        setAccResultMsg({
          success: false,
          message: res.message || 'تعذر إنشاء حساب التاجر على MoneyHash'
        });
      }
    } catch (err: any) {
      setAccResultMsg({
        success: false,
        message: err.message || 'حدث خطأ في الاتصال'
      });
    } finally {
      setAccCreating(false);
    }
  };

  // Toggle single MoneyHash Payment Method
  const handleToggleMoneyHashMethod = (methodId: string) => {
    setMhConfig(prev => {
      const updatedSelected = {
        ...prev.selectedMethods,
        [methodId]: !prev.selectedMethods?.[methodId]
      };
      return {
        ...prev,
        selectedMethods: updatedSelected
      };
    });
  };

  // Test MoneyHash API Connection
  const handleTestMoneyHashConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/moneyhash/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 10,
          currency: mhConfig.currency || 'EGP',
          orderNumber: 'TEST_INIT',
          customerName: 'تجربة اتصال',
          mode: mhConfig.mode,
          apiKey: mhConfig.apiKey,
          publicApiKey: mhConfig.publicApiKey
        })
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          message: `تم الاختبار بنجاح 🟢 (${mhConfig.mode === 'test' ? 'بيئة المعاينة والاختبار Sandbox' : 'البيئة الحية والمباشرة Live'}). الإرسال والاستقبال جاهز!`
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'تعذر الاتصال بـ MoneyHash. يرجى مراجعة المفتاح السري (API Key).'
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'خطأ في الاتصال بالخادم: ' + (err.message || 'حاول مرة أخرى')
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Save MoneyHash Config
  const handleSaveMoneyHashConfig = () => {
    setSettings(prev => ({
      ...prev,
      moneyHashConfig: mhConfig
    }));
    setSaveSuccessMsg('تم حفظ إعدادات بوابة MoneyHash وطرق الدفع المفعلة بنجاح! 🚀');
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // Manual payment methods handlers
  const handleSaveMethod = () => {
    if (!editingMethod.name) return;
    
    const newMethod: PaymentMethod = {
      id: editingMethod.id || Date.now().toString(),
      name: editingMethod.name,
      details: editingMethod.details || '',
      instructions: editingMethod.instructions || '',
      active: editingMethod.active ?? true,
      type: editingMethod.type || 'manual'
    };

    if (editingMethod.id) {
      setSettings(prev => ({
        ...prev,
        paymentMethods: (prev.paymentMethods || []).map(m => m.id === editingMethod.id ? newMethod : m)
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        paymentMethods: [...(prev.paymentMethods || []), newMethod]
      }));
    }
    setShowAddModal(false);
    setEditingMethod({ name: '', details: '', instructions: '', type: 'manual', active: true });
  };

  const toggleMethod = (id: string) => {
    setSettings(prev => ({
      ...prev,
      paymentMethods: (prev.paymentMethods || []).map(m => m.id === id ? { ...m, active: !m.active } : m)
    }));
  };

  const deleteMethod = async (id: string) => {
    const ok = await inAppConfirm("هل أنت متأكد من رغبتك في حذف وسيلة الدفع هذه؟", {
      title: "حذف وسيلة الدفع",
      type: "danger",
      confirmText: "نعم، حذف",
      cancelText: "إلغاء"
    });
    if (!ok) return;
    setSettings(prev => ({
      ...prev,
      paymentMethods: (prev.paymentMethods || []).filter(m => m.id !== id)
    }));
  };

  const openEdit = (method: PaymentMethod) => {
    setEditingMethod(method);
    setShowAddModal(true);
  };

  const activeMoneyHashCount = Object.values(mhConfig.selectedMethods || {}).filter(Boolean).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16 px-4 font-sans text-right" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Zap size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">إعدادات الدفع الموحدة (MoneyHash Integration)</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200">
                Official API v1.1
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              ربط بوابة MoneyHash لتمكين فيزا، ماستركارد، فودافون كاش، إنستا باي، فاليو، تابي، تمارا، وفوري بضغطة زر واحدة.
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shrink-0">
          <button
            onClick={() => setActiveTab('moneyhash')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'moneyhash'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Zap size={14} className="text-purple-600" />
            <span>بوابة MoneyHash الإلكترونية</span>
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Banknote size={14} className="text-emerald-600" />
            <span>طرق الدفع اليدوية والكاش ({settings.paymentMethods?.length || 0})</span>
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-black text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="text-emerald-600" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button onClick={() => setSaveSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800"><X size={16}/></button>
        </div>
      )}

      {/* MONEYHASH TAB */}
      {activeTab === 'moneyhash' && (
        <div className="space-y-6">
          
          {/* Main Activation Banner */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${mhConfig.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  <h3 className="font-black text-lg">بوابة مدفوعات MoneyHash Orchestration</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
                  تتيح لك منصة MoneyHash قبول كافة وسائل الدفع الإلكتروني في مصر والخليج العربي عبر حساب واحد ومفاتيح API موحدة، مع تخصيص الطرق المفعلة لكل متجر بشكل مستقل.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 shrink-0">
                <span className="text-xs font-bold text-slate-200">
                  {mhConfig.isActive ? 'البوابة مفعلة بالمتجر 🟢' : 'البوابة معطلة 🔴'}
                </span>
                <ToggleButton
                  active={mhConfig.isActive}
                  onToggle={() => setMhConfig(prev => ({ ...prev, isActive: !prev.isActive }))}
                  variant="emerald"
                />
              </div>
            </div>
          </div>

          {/* Credentials and Modes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Credentials Inputs (2 Cols) */}
            <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Key size={18} className="text-indigo-600 dark:text-indigo-400" />
                  <h4 className="font-black text-sm text-slate-900 dark:text-white">بيانات الاعتماد والربط المباشر (MoneyHash API Credentials)</h4>
                </div>
                <a
                  href="https://docs.moneyhash.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-bold flex items-center gap-1"
                >
                  <span>وثائق API الرسمي</span>
                  <ExternalLink size={12} />
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Environment Mode */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">بيئة الدفع (Environment Mode)</label>
                  <select
                    value={mhConfig.mode}
                    onChange={(e) => setMhConfig(prev => ({ ...prev, mode: e.target.value as 'test' | 'live' }))}
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none"
                  >
                    <option value="test">🧪 بيئة الاختيار والمعاينة (Sandbox / Test)</option>
                    <option value="live">🚀 البيئة المباشرة والحية (Production / Live)</option>
                  </select>
                </div>

                {/* Currency */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">العملة الافتراضية للمعاملات</label>
                  <select
                    value={mhConfig.currency || 'EGP'}
                    onChange={(e) => setMhConfig(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none"
                  >
                    <option value="EGP">🇪🇬 EGP (جنيه مصري)</option>
                    <option value="SAR">🇸🇦 SAR (ريال سعودي)</option>
                    <option value="AED">🇦🇪 AED (درهم إماراتي)</option>
                    <option value="USD">🇺🇸 USD (دولار أمريكي)</option>
                  </select>
                </div>

                {/* Secret Key */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">المفتاح السري (Secret API Key) *</label>
                  <input
                    type="password"
                    placeholder="mh_sec_live_... أو mh_sec_test_..."
                    value={mhConfig.apiKey}
                    onChange={(e) => setMhConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono outline-none dir-ltr text-left"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">يُحفظ بأمان في سيرفر الخادم لاستدعاء إنشاء نيات الدفع (Payment Intents).</span>
                </div>

                {/* Public API Key */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">المفتاح العام (Public Key / Public API Key)</label>
                  <input
                    type="text"
                    placeholder="mh_pub_..."
                    value={mhConfig.publicApiKey || ''}
                    onChange={(e) => setMhConfig(prev => ({ ...prev, publicApiKey: e.target.value }))}
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono outline-none dir-ltr text-left"
                  />
                </div>

                {/* Account Key / Sub-Account ID with Create Button */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">معرف الحساب (Account Key / ID)</label>
                    <button
                      type="button"
                      onClick={() => {
                        setAccForm({ name: settings.storeName || 'متجري الإلكتروني', email: '', phone: '', country: 'EG' });
                        setShowCreateAccountModal(true);
                      }}
                      className="text-[10px] font-black text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center gap-1 cursor-pointer"
                    >
                      <UserPlus size={11} />
                      <span>إنشاء حساب تاجر فرعي (v1.1)</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="mh_acc_... أو acc_key_..."
                    value={mhConfig.accountKey || ''}
                    onChange={(e) => setMhConfig(prev => ({ ...prev, accountKey: e.target.value }))}
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono outline-none dir-ltr text-left"
                  />
                </div>

                {/* Webhook Secret */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">توقيع الويب هوك (Webhook Secret)</label>
                  <input
                    type="text"
                    placeholder="mh_wh_..."
                    value={mhConfig.webhookSecret || ''}
                    onChange={(e) => setMhConfig(prev => ({ ...prev, webhookSecret: e.target.value }))}
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono outline-none dir-ltr text-left"
                  />
                </div>
              </div>

              {/* Test Action */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleTestMoneyHashConnection}
                  disabled={isTesting}
                  className="px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw size={14} className={isTesting ? 'animate-spin' : ''} />
                  <span>{isTesting ? 'جاري فحص الاتصال...' : 'اختبار صحة الاتصال بـ MoneyHash'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveMoneyHashConfig}
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-md shadow-purple-600/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <Save size={15} />
                  <span>حفظ إعدادات MoneyHash</span>
                </button>
              </div>

              {testResult && (
                <div className={`p-3 rounded-xl border text-xs font-bold ${
                  testResult.success 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300' 
                    : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300'
                }`}>
                  {testResult.message}
                </div>
              )}
            </div>

            {/* Quick Status Box */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <ShieldCheck size={18} className="text-emerald-600" />
                  <h4 className="font-black text-sm text-slate-900 dark:text-white">ملخص إعدادات المتجر الحالي</h4>
                </div>

                <div className="mt-4 space-y-3 text-xs">
                  <div className="flex justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                    <span className="text-slate-500">حالة الربط العامة:</span>
                    <span className={`font-black ${mhConfig.isActive ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {mhConfig.isActive ? 'نشطة ومفعلة ✅' : 'غير مفعلة ❌'}
                    </span>
                  </div>

                  <div className="flex justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                    <span className="text-slate-500">طرق الدفع المفعلة:</span>
                    <span className="font-mono font-black text-purple-600 dark:text-purple-400">
                      {activeMoneyHashCount} من أصل {MONEYHASH_DEFAULT_METHODS.length} طرق
                    </span>
                  </div>

                  <div className="flex justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                    <span className="text-slate-500">رابط Webhook الموصى به:</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300 dir-ltr text-[10px]">
                      /api/webhooks/moneyhash
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <AlertTriangle size={13} className="text-amber-600" />
                  <span>تلميح لأصحاب المتاجر:</span>
                </div>
                <p>يمكن لكل صاحب متجر اختيار وتحديد وسائل الدفع المناسبة لعملاء متجره بحرية كاملة دون التأثير على المتاجر الأخرى.</p>
              </div>
            </div>
          </div>

          {/* Selective Payment Methods Enablement */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers size={18} className="text-indigo-600" />
                  <span>طرق وسنوات الدفع الإلكتروني المتاحة عبر MoneyHash</span>
                </h3>
                <p className="text-xs text-slate-500">قم بتفعيل أو تعطيل أي وسيلة دفع بالتحديد لتظهر مباشرة لعملائك في صفحة إنهاء الطلب (Checkout).</p>
              </div>

              <span className="px-3 py-1 rounded-xl bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 text-xs font-black shrink-0">
                مفعّل {activeMoneyHashCount} طريقـة
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {MONEYHASH_DEFAULT_METHODS.map(method => {
                const isEnabled = mhConfig.selectedMethods?.[method.id] ?? method.enabled;
                return (
                  <div
                    key={method.id}
                    onClick={() => handleToggleMoneyHashMethod(method.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                      isEnabled
                        ? 'bg-white dark:bg-slate-900 border-purple-200 dark:border-purple-800 shadow-sm hover:border-purple-400'
                        : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl shrink-0 p-2 rounded-xl bg-slate-100 dark:bg-slate-800">{method.icon}</span>
                        <div>
                          <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-snug">{method.name}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md mt-1 inline-block ${
                            method.category === 'card' ? 'bg-blue-100 text-blue-800' :
                            method.category === 'wallet' ? 'bg-emerald-100 text-emerald-800' :
                            method.category === 'bnpl' ? 'bg-purple-100 text-purple-800' :
                            method.category === 'kiosk' ? 'bg-amber-100 text-amber-800' :
                            'bg-cyan-100 text-cyan-800'
                          }`}>
                            {method.category === 'card' ? 'بطاقات بانكية' :
                             method.category === 'wallet' ? 'محافظ إلكترونية' :
                             method.category === 'bnpl' ? 'تقسيط مشتريات' :
                             method.category === 'kiosk' ? 'منافذ كاش' : 'تحويل لحظي'}
                          </span>
                        </div>
                      </div>

                      <ToggleButton
                        active={isEnabled}
                        onToggle={() => handleToggleMoneyHashMethod(method.id)}
                        variant="emerald"
                      />
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pt-2 border-t border-slate-100 dark:border-slate-800">
                      {method.description}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={handleSaveMoneyHashConfig}
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-md shadow-purple-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Save size={15} />
                <span>تأكيد وحفظ طرق الدفع المفعلة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL PAYMENT METHODS TAB */}
      {activeTab === 'manual' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-black dark:text-white">طرق الدفع اليدوية والكاش المفعلة</h3>
              <p className="text-xs text-slate-500">الدفع عند الاستلام، التحويل البنكي المباشر، أو المحافظ اليدوية.</p>
            </div>
            <button
              onClick={() => { setEditingMethod({ type: 'manual', active: true }); setShowAddModal(true); }}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 transition-all text-xs shadow-md cursor-pointer"
            >
              <Plus size={16}/> إضافة طريقة دفع يدوية جديدة
            </button>
          </div>
          
          <div className="p-6 space-y-4">
            {(settings.paymentMethods || []).map(method => (
              <div key={method.id} className={`relative p-5 rounded-2xl border transition-all duration-300 group ${method.active ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-lg' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-60'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${method.type === 'cod' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
                      {method.type === 'cod' ? <Banknote size={24}/> : <Smartphone size={24}/>}
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-800 dark:text-white">{method.name}</h4>
                      <p className="text-sm text-slate-500 font-mono mt-1">{method.details}</p>
                    </div>
                  </div>
                  <ToggleButton active={method.active} onToggle={() => toggleMethod(method.id)} />
                </div>
                {method.instructions && <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">{method.instructions}</p>}
                
                <div className="absolute top-4 left-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button onClick={() => openEdit(method)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><Edit3 size={16}/></button>
                  {method.id !== 'cod' && (
                    <button onClick={() => deleteMethod(method.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={16}/></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADD/EDIT MANUAL METHOD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black dark:text-white">{editingMethod.id ? 'تعديل طريقة الدفع' : 'إضافة طريقة دفع يدوية'}</h3>
              <button onClick={() => setShowAddModal(false)}><X className="text-slate-400 hover:text-slate-600"/></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">اسم الطريقة</label>
                <input type="text" placeholder="مثلاً: تحويل إنستا باي يدوي، فودافون كاش مباشر" className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none" value={editingMethod.name} onChange={e => setEditingMethod({...editingMethod, name: e.target.value})} disabled={editingMethod.id === 'cod'} />
              </div>

              {editingMethod.type !== 'cod' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">رقم المحفظة / رقم الحساب IBAN</label>
                    <input type="text" placeholder="مثلاً: 010xxxxxxx / EG..." className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono outline-none dir-ltr text-left" value={editingMethod.details} onChange={e => setEditingMethod({...editingMethod, details: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">تعليمات وتوجيهات الدفع للعميل</label>
                    <textarea placeholder="مثلاً: يرجى إرسال إيصال أو صورة التحويل عبر الواتساب لتأكيد الطلب..." className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none h-24" value={editingMethod.instructions} onChange={e => setEditingMethod({...editingMethod, instructions: e.target.value})} />
                  </div>
                </>
              )}

              {editingMethod.id === 'cod' && (
                <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs font-bold">
                  الدفع عند الاستلام هو الطريقة الافتراضية. يمكنك فقط تفعيلها أو تعطيلها.
                </div>
              )}

              <button onClick={handleSaveMethod} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-md cursor-pointer">
                <Save size={16}/> حفظ وسيلة الدفع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MONEYHASH SUB-ACCOUNT CREATION MODAL (v1.1 Accounts Create) */}
      {showCreateAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-right" dir="rtl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <UserPlus className="text-purple-600" size={20} />
                <h3 className="text-base font-black dark:text-white">إنشاء حساب تاجر فرعي عبر MoneyHash v1.1</h3>
              </div>
              <button onClick={() => setShowCreateAccountModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              تتيح لك واجهة البرمجة (v1.1 Accounts Create) تسطير وتسجيل حساب تاجر فرعي جديد خاص بمتجرك لربط المعاملات المالية بشكل منفصل على منصة MoneyHash.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">اسم المتجر / حساب التاجر *</label>
                <input
                  type="text"
                  placeholder="مثال: متجر الأناقة أو أزياء القاهرة"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"
                  value={accForm.name}
                  onChange={e => setAccForm({ ...accForm, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">البريد الإلكتروني للعمليات</label>
                  <input
                    type="email"
                    placeholder="merchant@store.com"
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none dir-ltr text-left"
                    value={accForm.email}
                    onChange={e => setAccForm({ ...accForm, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">رقم الهاتف المقترن</label>
                  <input
                    type="tel"
                    placeholder="+201000000000"
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none dir-ltr text-left"
                    value={accForm.phone}
                    onChange={e => setAccForm({ ...accForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">الدولة المقر</label>
                <select
                  value={accForm.country}
                  onChange={e => setAccForm({ ...accForm, country: e.target.value })}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"
                >
                  <option value="EG">🇪🇬 مصر (Egypt - EG)</option>
                  <option value="SA">🇸🇦 السعودية (Saudi Arabia - SA)</option>
                  <option value="AE">🇦🇪 الإمارات (UAE - AE)</option>
                  <option value="US">🇺🇸 الولايات المتحدة (USA - US)</option>
                </select>
              </div>

              {accResultMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold border ${
                  accResultMsg.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {accResultMsg.message}
                </div>
              )}

              <button
                type="button"
                onClick={handleCreateAccountSubmit}
                disabled={accCreating || !accForm.name}
                className="w-full py-3 bg-purple-600 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-purple-700 transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                <UserPlus size={16} />
                <span>{accCreating ? 'جاري إنشاء الحساب على MoneyHash...' : 'تأكيد وإنشاء حساب التاجر المباشر'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentSettingsPage;
