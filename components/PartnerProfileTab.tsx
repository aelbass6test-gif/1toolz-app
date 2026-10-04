import React, { useState } from 'react';
import { Partner, Settings } from '../types';
import { 
  User, Mail, Phone, MapPin, ShieldCheck, Key, CheckCircle2, 
  AlertCircle, Loader2, Save, Send, Smartphone, Landmark,
  CreditCard, ShieldAlert, Award
} from 'lucide-react';
import * as db from '../services/databaseService';

interface PartnerProfileTabProps {
  partner: Partner;
  storeId: string;
  storeName: string;
  settings: Settings;
  portalPerms?: any;
  updateSettings: (newSettings: any) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const PartnerProfileTab: React.FC<PartnerProfileTabProps> = ({
  partner,
  storeId,
  storeName,
  settings,
  portalPerms = {},
  updateSettings,
  showToast
}) => {
  const canEditProfile = portalPerms.canEditProfile ?? true;
  const canEditPayoutAccounts = portalPerms.canEditPayoutAccounts ?? true;
  const canChangeSecurity = portalPerms.canChangeSecurity ?? true;

  // Profile edit fields
  const [name, setName] = useState(partner.name || '');
  const [email, setEmail] = useState(partner.email || '');
  const [phone, setPhone] = useState(partner.phone || '');
  const [address, setAddress] = useState(partner.address || '');
  const [nationalId, setNationalId] = useState(partner.nationalId || '');
  
  // Payout fields
  const [walletPhone, setWalletPhone] = useState(partner.payoutAccounts?.walletPhone || '');
  const [instaPayHandle, setInstaPayHandle] = useState(partner.payoutAccounts?.instaPayHandle || '');
  const [bankName, setBankName] = useState(partner.payoutAccounts?.bankName || '');
  const [bankAccount, setBankAccount] = useState(partner.payoutAccounts?.bankAccount || '');

  // Password & PIN fields
  const [newPin, setNewPin] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Email verification state
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isCheckingOtp, setIsCheckingOtp] = useState(false);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  // Save profile updates to settings and Firestore
  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      const updatedPartner: Partner = {
        ...partner,
        name: name.trim() || partner.name,
        email: email.trim().toLowerCase() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        nationalId: nationalId.trim() || undefined,
        passcode: newPin.trim() ? newPin.trim() : partner.passcode,
        password: newPassword.trim() ? newPassword.trim() : partner.password,
        payoutAccounts: {
          walletPhone: walletPhone.trim() || undefined,
          instaPayHandle: instaPayHandle.trim() || undefined,
          bankName: bankName.trim() || undefined,
          bankAccount: bankAccount.trim() || undefined,
        }
      };

      const updatedPartners = (settings.partners || []).map(p => 
        p.id === partner.id ? updatedPartner : p
      );

      const newSettings = { ...settings, partners: updatedPartners };
      updateSettings(newSettings);

      if (storeId) {
        const cur = await db.getStoreData(storeId);
        if (cur) {
          await db.saveStoreData({ id: storeId, name: storeName } as any, {
            ...cur,
            settings: newSettings
          });
        }
      }

      sessionStorage.setItem(`partner_portal_auth_${storeId}`, JSON.stringify(updatedPartner));
      showToast('تم حفظ وتحديث بيانات الملف الشخصي بنجاح', 'success');
      setNewPin('');
      setNewPassword('');
    } catch (err: any) {
      showToast(err?.message || 'حدث خطأ أثناء حفظ البيانات', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Send Email OTP for verification
  const handleSendEmailVerification = async () => {
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      showToast('يرجى كتابة بريد إلكتروني صحيح أولاً', 'error');
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          userName: partner.name,
          phone: partner.phone
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsVerifyingEmail(true);
        showToast('تم إرسال كود التحقق (6 أرقام) إلى بريدك الإلكتروني', 'success');
      } else {
        showToast(data.error || 'تعذر إرسال الرمز، يرجى المحاولة لاحقاً', 'error');
      }
    } catch (err: any) {
      showToast('خطأ أثناء إرسال البريد: ' + err.message, 'error');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Verify Email OTP
  const handleVerifyEmailOtp = async () => {
    if (!emailOtp || emailOtp.trim().length !== 6) {
      showToast('يرجى إدخال رمز التحقق المكون من 6 أرقام', 'error');
      return;
    }

    setIsCheckingOtp(true);
    try {
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: emailOtp.trim()
        })
      });
      const data = await res.json();
      if (data.valid) {
        const updatedPartner: Partner = {
          ...partner,
          email: email.trim().toLowerCase(),
          isEmailVerified: true,
          emailVerifiedAt: new Date().toISOString()
        };

        const updatedPartners = (settings.partners || []).map(p => 
          p.id === partner.id ? updatedPartner : p
        );

        const newSettings = { ...settings, partners: updatedPartners };
        updateSettings(newSettings);

        if (storeId) {
          const cur = await db.getStoreData(storeId);
          if (cur) {
            await db.saveStoreData({ id: storeId, name: storeName } as any, {
              ...cur,
              settings: newSettings
            });
          }
        }

        sessionStorage.setItem(`partner_portal_auth_${storeId}`, JSON.stringify(updatedPartner));
        showToast('تم توثيق وتأكيد بريدك الإلكتروني بنجاح! 🎉', 'success');
        setIsVerifyingEmail(false);
        setEmailOtp('');
      } else {
        showToast(data.message || 'رمز التحقق غير صحيح أو منتهي الصلاحية', 'error');
      }
    } catch (err: any) {
      showToast('خطأ أثناء التحقق: ' + err.message, 'error');
    } finally {
      setIsCheckingOtp(false);
    }
  };

  // Remove or unlink email
  const handleRemoveEmail = async () => {
    if (!window.confirm('هل أنت متأكد من حذف وإلغاء ربط هذا البريد الإلكتروني من حساب الشريك؟')) return;
    setIsSaving(true);
    try {
      const updatedPartner: Partner = {
        ...partner,
        email: undefined,
        isEmailVerified: false,
        emailVerifiedAt: undefined
      };
      setEmail('');
      const updatedPartners = (settings.partners || []).map(p => 
        p.id === partner.id ? updatedPartner : p
      );
      const newSettings = { ...settings, partners: updatedPartners };
      updateSettings(newSettings);

      if (storeId) {
        const cur = await db.getStoreData(storeId);
        if (cur) {
          await db.saveStoreData({ id: storeId, name: storeName } as any, {
            ...cur,
            settings: newSettings
          });
        }
      }

      sessionStorage.setItem(`partner_portal_auth_${storeId}`, JSON.stringify(updatedPartner));
      showToast('تم حذف وإلغاء ربط البريد الإلكتروني بنجاح', 'success');
      setIsVerifyingEmail(false);
      setEmailOtp('');
    } catch (err: any) {
      showToast('حدث خطأ أثناء حذف البريد: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // System permissions list for display
  const permissionsList = partner.permissions && partner.permissions.length > 0
    ? partner.permissions
    : ['ORDERS_VIEW', 'PRODUCTS_VIEW'];

  const permissionLabels: Record<string, { title: string; desc: string }> = {
    ORDERS_VIEW: { title: 'عرض الطلبيات والمبيعات', desc: 'متابعة سجل الأوردرات وحالات الشحن والتسليم' },
    ORDERS_MANAGE: { title: 'إدارة الطلبيات', desc: 'إنشاء وتعديل وتأكيد الطلبات وإلغائها' },
    RETURNS_MANAGE: { title: 'إدارة المرتجعات', desc: 'معالجة المرتجعات والتسويات اللوجستية' },
    POS_VIEW: { title: 'نقطة البيع (POS)', desc: 'عرض شاشة الكاشير والمبيعات المباشرة' },
    POS_MANAGE: { title: 'إدارة الكاشير والبيع', desc: 'إصدار فواتير بيع مباشر وقبض النقدية' },
    PRODUCTS_VIEW: { title: 'عرض المنتجات والمخزون', desc: 'استعراض أسعار وكميات البضائع بالمستودعات' },
    PRODUCTS_MANAGE: { title: 'إدارة المنتجات', desc: 'إضافة وتعديل المنتجات وأسعار التكلفة والبيع' },
    INVENTORY_MANAGE: { title: 'إدارة الجرد والمستودعات', desc: 'تسوية المخزون وإجراء عمليات الجرد الدوري' },
    CUSTOMERS_VIEW: { title: 'عرض العملاء', desc: 'سجل بيانات العملاء وسجل مشترياتهم' },
    EXPENSES_MANAGE: { title: 'إدارة المصروفات والخزينة', desc: 'تسجيل وبحث المصروفات والعهد التشغيلية' },
    WALLET_VIEW: { title: 'عرض المحفظة المالية', desc: 'الاطلاع على حركة المحفظة وسجل السحب والإيداع' },
    SETTINGS_VIEW: { title: 'إعدادات المتجر', desc: 'الاطلاع على الإعدادات العامة للمتجر' }
  };

  return (
    <div className="space-y-6 text-slate-800" dir="rtl">
      
      {/* Partner Identity Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#008060] to-[#0a664e] text-white flex items-center justify-center font-black text-2xl shadow-sm shrink-0">
            {partner.name.slice(0, 1)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-slate-900">{partner.name}</h2>
              <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#008060] border border-emerald-200">
                شريك بنسبة {partner.profitRatio || 0}%
              </span>
              {partner.isEmailVerified ? (
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 size={12} /> بريد موثق
                </span>
              ) : (
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                  <AlertCircle size={12} /> بريد غير موثق
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              كود الشريك: <span className="font-mono font-bold text-slate-700">{partner.id}</span> • {storeName}
            </p>
          </div>
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={isSaving}
          className="flex items-center gap-2 bg-[#008060] hover:bg-[#0a664e] text-white px-5 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer shadow-sm disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          <span>حفظ التعديلات</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Contact & Details Form */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section 1: Contact Information */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-black text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <User size={18} className="text-[#008060]" />
              <span>البيانات الشخصية ووسائل الاتصال</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل للشريك:</label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#008060]"
                  />
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف / الواتساب:</label>
                <div className="relative">
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="مثال: 01012345678"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#008060]"
                  />
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="sm:col-span-2">
                <div className="flex justify-between items-center mb-1 flex-wrap gap-2">
                  <label className="text-xs font-bold text-slate-700">البريد الإلكتروني المعتمد للدخول والإشعارات:</label>
                  <div className="flex items-center gap-3">
                    {!partner.isEmailVerified && email && (
                      <button
                        type="button"
                        onClick={handleSendEmailVerification}
                        disabled={isSendingOtp}
                        className="text-[11px] text-[#008060] font-black hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {isSendingOtp ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                        <span>تأكيد البريد بكود OTP ✉️</span>
                      </button>
                    )}
                    {(partner.email || email) && (
                      <button
                        type="button"
                        onClick={handleRemoveEmail}
                        className="text-[11px] text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                        title="حذف وفك ربط هذا البريد الإلكتروني"
                      >
                        مسح / فك ربط البريد 🗑️
                      </button>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="partner@example.com"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#008060]"
                  />
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>

                {/* OTP Verification Prompt */}
                {isVerifyingEmail && (
                  <div className="mt-3 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
                    <span className="text-xs font-black text-emerald-900 block">
                      تم إرسال رمز التحقق المكون من 6 أرقام إلى ({email}):
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={emailOtp}
                        onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="أدخل الرمز (6 أرقام)"
                        className="w-48 bg-white border border-emerald-300 rounded-xl px-3 py-2 text-center font-mono font-black text-sm tracking-widest text-slate-900 focus:outline-none focus:border-[#008060]"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyEmailOtp}
                        disabled={isCheckingOtp}
                        className="bg-[#008060] hover:bg-[#0a664e] text-white px-4 py-2 rounded-xl text-xs font-black cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        {isCheckingOtp ? <Loader2 size={14} className="animate-spin" /> : 'تأكيد الآن'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsVerifyingEmail(false)}
                        className="bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الرقم القومي (اختياري):</label>
                <input
                  type="text"
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  placeholder="الرقم القومي المكون من 14 رقم"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#008060]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">العنوان والمحافظة:</label>
                <div className="relative">
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="مثال: القاهرة - التجمع الخامس"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#008060]"
                  />
                  <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Saved Payout Channels */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-black text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <CreditCard size={18} className="text-[#008060]" />
              <span>بيانات وحسابات صرف الأرباح المحفوظة للشريك</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم محفظة كاش (فودافون/أورنج/اتصالات/وي):</label>
                <div className="relative">
                  <input
                    type="text"
                    value={walletPhone}
                    onChange={(e) => setWalletPhone(e.target.value)}
                    placeholder="010xxxxxxxx"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#008060]"
                  />
                  <Smartphone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">معرف إنستاباي (InstaPay Handle/IPN):</label>
                <input
                  type="text"
                  value={instaPayHandle}
                  onChange={(e) => setInstaPayHandle(e.target.value)}
                  placeholder="username@instapay"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#008060]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم البنك:</label>
                <div className="relative">
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="مثال: البنك الأهلي المصري"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#008060]"
                  />
                  <Landmark size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الحساب البنكي أو الآيبان (IBAN):</label>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="EG000000000000000000000000000"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#008060]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Password & PIN Management */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-black text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Key size={18} className="text-[#008060]" />
              <span>أمان الحساب وكلمة المرور ورمز PIN</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تعيين رمز PIN جديد (4-6 أرقام):</label>
                <input
                  type="password"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="أدخل رمز PIN الجديد..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#008060]"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">الرمز الحالي: {partner.passcode || '0000'}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تعيين كلمة مرور جديدة للحساب:</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="أدخل كلمة مرور قوية..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#008060]"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Right 1 Column: Employee Permissions & Access */}
        <div className="space-y-6">
          
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#008060] flex items-center justify-center">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900">صلاحيات الموظفين الممنوحة للشريك</h3>
                <p className="text-[11px] text-slate-400">الصلاحيات المعتمدة من إدارة {storeName}</p>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              يمتلك هذا الشريك الصلاحيات التالية في لوحة تحكم وإدارة المتجر:
            </p>

            <div className="space-y-2">
              {permissionsList.map((permKey) => {
                const info = permissionLabels[permKey] || { title: permKey, desc: 'صلاحية نظام معتمدة' };
                return (
                  <div key={permKey} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-[#008060] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black text-xs text-slate-900 block">{info.title}</span>
                      <span className="text-[10px] text-slate-500 block leading-tight">{info.desc}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[10px] text-amber-800 font-medium">
              💡 لتعديل أو توسيع صلاحيات الشريك في النظام، يرجى مراجعة صفحة إدارة الموظفين والشركاء من حساب المدير العام.
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
