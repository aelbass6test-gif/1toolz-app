


import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, Building, Phone, KeyRound, Loader2, UserPlus, User as UserIcon, CheckCircle, Mail } from 'lucide-react';
import { User, StoreData, Employee } from '../types';

interface EmployeeRegisterRequestData {
  fullName: string;
  phone: string;
  password: string;
  storeId: string;
  email: string;
}

interface EmployeeLoginPageProps {
  onLoginAttempt: (data: { storeId: string; phone: string; password: string }) => Promise<void>;
  onRegisterRequest: (data: EmployeeRegisterRequestData) => Promise<void>;
  allStoresData: Record<string, StoreData>;
  users: User[];
}

const EmployeeLoginPage: React.FC<EmployeeLoginPageProps> = ({ onLoginAttempt, onRegisterRequest, allStoresData, users }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'success'>('login');
  
  // Login State
  const [loginStoreId, setLoginStoreId] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Registration State
  const [regFullName, setRegFullName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regStoreId, setRegStoreId] = useState('');
  const [regError, setRegError] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoading(true);

    try {
        await onLoginAttempt({
            storeId: loginStoreId.trim(),
            phone: loginPhone.trim(),
            password: loginPassword
        });
    } catch (err: any) {
        console.error('Employee login error:', err);
        const errorCode = err?.code || '';
        const errorMessage = err?.message || '';
        
        if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/user-not-found' || errorMessage.includes('invalid-credential')) {
            setLoginError('رقم الموبايل أو كلمة المرور غير صحيحة.');
        } else if (errorCode === 'auth/network-request-failed') {
            setLoginError('فشل الاتصال بالخادم. يرجى التحقق من الإنترنت.');
        } else if (errorCode === 'auth/too-many-requests') {
            setLoginError('تمت محاولة تسجيل الدخول عدة مرات بشكل خاطئ. يرجى المحاولة لاحقاً.');
        } else {
            setLoginError(errorMessage || 'حدث خطأ أثناء تسجيل الدخول.');
        }
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setIsLoading(true);
    try {
        if (!regFullName.trim() || !regPhone.trim() || !regEmail.trim() || !regPassword.trim() || !regConfirmPassword.trim() || !regStoreId.trim()) {
            throw new Error('يرجى ملء كافة الحقول المطلوبة بما في ذلك تأكيد كلمة المرور.');
        }
        if (regPassword !== regConfirmPassword) {
            throw new Error('كلمة المرور وتأكيد كلمة المرور غير متطابقين.');
        }
        if (regPassword.length < 8) { 
            throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل.'); 
        }
        
        await onRegisterRequest({
            fullName: regFullName,
            phone: regPhone,
            password: regPassword,
            storeId: regStoreId,
            email: regEmail
        });
        setActiveTab('success');
    } catch(err: any) {
        setRegError(err.message);
    } finally {
        setIsLoading(false);
    }
  };


  return (
    <div dir="rtl" className="font-cairo bg-[#f7f8f4] min-h-screen flex items-center justify-center p-4 text-slate-900">
      <div className="w-full max-w-md bg-white p-7 sm:p-9 rounded-[2rem] border border-white shadow-[0_24px_70px_rgba(23,60,45,0.12)] transition-all">
        <div className="mb-7 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"><Building size={20} /></span>
          <div><strong className="block text-lg font-black tracking-tight text-slate-950">عبدو ميديا برايم</strong><span className="block text-[11px] font-semibold text-slate-500">AbdoMedia Prime • مساحة فريق العمل</span></div>
        </div>
        {activeTab === 'success' ? (
            <div className="animate-in fade-in duration-300 text-center">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-emerald-500/30">
                    <CheckCircle size={40} />
                </div>
                <h1 className="text-2xl font-black text-slate-950">تم إرسال طلبك بنجاح!</h1>
                <p className="text-slate-500 mt-2 mb-6">سيقوم مالك المتجر بمراجعة طلبك. سيتم إشعارك عند الموافقة.</p>
                <button onClick={() => setActiveTab('login')} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-3 font-bold transition-colors">
                    العودة لصفحة الدخول
                </button>
            </div>
        ) : (
          <>
            <div className="flex bg-slate-100 border border-slate-100 rounded-2xl p-1.5 mb-8" role="tablist" aria-label="نوع العملية">
                <button type="button" role="tab" aria-selected={activeTab === 'login'} onClick={() => setActiveTab('login')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  <LogIn size={16}/> تسجيل الدخول
                </button>
                <button type="button" role="tab" aria-selected={activeTab === 'register'} onClick={() => setActiveTab('register')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  <UserPlus size={16}/> طلب انضمام
                </button>
            </div>
            
            {activeTab === 'login' && (
              <div className="animate-in fade-in duration-300">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black text-slate-950">تسجيل دخول الموظفين</h1>
                    <p className="text-slate-500 mt-2">وصول آمن لمهام المتجر والطلبات</p>
                </div>
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="employee-store-id" className="text-sm font-bold text-slate-700 mb-2 block flex items-center gap-2"><Building size={16}/> كود المتجر</label>
                    <input id="employee-store-id" autoComplete="organization" type="text" placeholder="store-0" aria-label="كود المتجر" value={loginStoreId} onChange={e => setLoginStoreId(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 placeholder-slate-400" required />
                  </div>
                  <div>
                    <label htmlFor="employee-phone" className="text-sm font-bold text-slate-700 mb-2 block flex items-center gap-2"><Phone size={16}/> رقم الهاتف</label>
                    <input id="employee-phone" autoComplete="username" type="tel" placeholder="010xxxxxxxx" aria-label="رقم الهاتف" value={loginPhone} onChange={e => setLoginPhone(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 placeholder-slate-400" required />
                  </div>
                  <div>
                    <label htmlFor="employee-password" className="text-sm font-bold text-slate-700 mb-2 block flex items-center gap-2"><KeyRound size={16}/> كلمة المرور</label>
                    <input id="employee-password" autoComplete="current-password" type="password" placeholder="********" aria-label="كلمة المرور" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 placeholder-slate-400" required />
                  </div>
                  {loginError && <div role="alert" aria-live="assertive" className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-center font-bold text-sm">{loginError}</div>}
                  
                  <div className="flex justify-between items-center px-1">
                    <button 
                      type="button"
                      onClick={() => {
                        // Redirect to main signup/login page's forgot password flow or implement here
                        // For simplicity, we can redirect to signup which has the modal
                        window.location.href = '/owner-login?forgot=true';
                      }}
                      className="text-xs font-bold text-emerald-700 hover:underline"
                    >
                      نسيت كلمة المرور؟
                    </button>
                  </div>

                  <button type="submit" disabled={isLoading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-3 font-bold transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-wait">
                    {isLoading ? <Loader2 className="animate-spin" /> : <><LogIn size={18}/> تسجيل الدخول</>}
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'register' && (
              <div className="animate-in fade-in duration-300">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black text-slate-950">طلب انضمام لمتجر</h1>
                    <p className="text-slate-500 mt-2">املأ بياناتك وسنرسل طلبك لمالك المتجر.</p>
                </div>
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                   <div><label htmlFor="employee-register-name" className="text-sm font-bold text-slate-700 mb-2 block flex items-center gap-2"><UserIcon size={16}/> اسمك الكامل</label><input id="employee-register-name" autoComplete="name" type="text" placeholder="اسمك الظاهر للمدير" aria-label="اسمك الكامل" value={regFullName} onChange={e => setRegFullName(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 placeholder-slate-400" required /></div>
                   <div><label htmlFor="employee-phone" className="text-sm font-bold text-slate-700 mb-2 block flex items-center gap-2"><Phone size={16}/> رقم هاتفك</label><input id="employee-register-phone" autoComplete="username" type="tel" placeholder="سيستخدم لتسجيل الدخول" aria-label="رقم هاتفك" value={regPhone} onChange={e => setRegPhone(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 placeholder-slate-400" required /></div>
                   <div><label className="text-sm font-bold text-slate-700 mb-2 block flex items-center gap-2"><Mail size={16}/> بريدك الإلكتروني</label><input id="employee-register-email" autoComplete="email" type="email" placeholder="لاسترجاع كلمة المرور وتفعيل الحساب" aria-label="بريدك الإلكتروني" value={regEmail} onChange={e => setRegEmail(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 placeholder-slate-400" required /></div>
                   <div><label htmlFor="employee-password" className="text-sm font-bold text-slate-700 mb-2 block flex items-center gap-2"><KeyRound size={16}/> كلمة المرور</label><input id="employee-register-password" autoComplete="new-password" type="password" placeholder="8 أحرف على الأقل" aria-label="كلمة المرور الجديدة" value={regPassword} onChange={e => setRegPassword(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 placeholder-slate-400" required /></div>
                   <div>
                     <label htmlFor="employee-confirm-password" className="text-sm font-bold text-slate-700 mb-2 block flex items-center gap-2"><KeyRound size={16}/> تأكيد كلمة المرور</label>
                     <input id="employee-confirm-password" autoComplete="new-password" type="password" placeholder="أعد إدخال كلمة المرور" aria-label="تأكيد كلمة المرور" value={regConfirmPassword} onChange={e => setRegConfirmPassword(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 placeholder-slate-400" required />
                     {regPassword && regConfirmPassword && regPassword === regConfirmPassword && (
                       <p className="text-[11px] font-bold text-emerald-600 mt-1">✓ كلمتا المرور متطابقتان</p>
                     )}
                     {regPassword && regConfirmPassword && regPassword !== regConfirmPassword && (
                       <p className="text-[11px] font-bold text-rose-500 mt-1">✕ كلمتا المرور غير متطابقتين</p>
                     )}
                   </div>
                   <div><label htmlFor="employee-store-id" className="text-sm font-bold text-slate-700 mb-2 block flex items-center gap-2"><Building size={16}/> كود المتجر</label><input type="text" placeholder="اطلبه من مالك المتجر" value={regStoreId} onChange={e => setRegStoreId(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 placeholder-slate-400" required /></div>
                  
                  {regError && <div role="alert" aria-live="assertive" className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-center font-bold text-sm">{regError}</div>}
                  
                  <button type="submit" disabled={isLoading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-3 font-bold transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-wait">
                    {isLoading ? <Loader2 className="animate-spin" /> : <><UserPlus size={18}/> إرسال طلب الانضمام</>}
                  </button>
                </form>
              </div>
            )}

            <p className="text-center text-xs text-slate-500 hover:underline mt-8 pt-4 border-t border-slate-100">
                <Link to="/owner-login">هل أنت مالك المتجر؟</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default EmployeeLoginPage;
