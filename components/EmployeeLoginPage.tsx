


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
        setLoginError(err.message);
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setIsLoading(true);
    try {
        if (regPassword.length < 8) { throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل.'); }
        
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
    <div dir="rtl" className="font-cairo bg-gradient-to-br from-[#111827] to-[#0c1e3e] min-h-screen flex items-center justify-center p-4 text-white">
      <div className="w-full max-w-md bg-slate-900/40 p-8 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-sm transition-all">
        {activeTab === 'success' ? (
            <div className="animate-in fade-in duration-300 text-center">
                <div className="w-20 h-20 bg-emerald-900/40 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-emerald-500/30">
                    <CheckCircle size={40} />
                </div>
                <h1 className="text-2xl font-black text-white">تم إرسال طلبك بنجاح!</h1>
                <p className="text-slate-400 mt-2 mb-6">سيقوم مالك المتجر بمراجعة طلبك. سيتم إشعارك عند الموافقة.</p>
                <button onClick={() => setActiveTab('login')} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white rounded-lg py-3 font-bold transition-colors">
                    العودة لصفحة الدخول
                </button>
            </div>
        ) : (
          <>
            <div className="flex bg-slate-800/50 border border-slate-700 rounded-lg p-1 mb-8">
                <button onClick={() => setActiveTab('login')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-bold transition-all ${activeTab === 'login' ? 'bg-slate-700/50 text-white shadow-inner' : 'text-slate-400 hover:bg-slate-700/20'}`}>
                  <LogIn size={16}/> تسجيل الدخول
                </button>
                <button onClick={() => setActiveTab('register')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-bold transition-all ${activeTab === 'register' ? 'bg-slate-700/50 text-white shadow-inner' : 'text-slate-400 hover:bg-slate-700/20'}`}>
                  <UserPlus size={16}/> طلب انضمام
                </button>
            </div>
            
            {activeTab === 'login' && (
              <div className="animate-in fade-in duration-300">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black text-white">تسجيل دخول الموظفين</h1>
                    <p className="text-slate-400 mt-2">مخصص لموظفي تأكيد الطلبات</p>
                </div>
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-bold text-slate-300 mb-2 block flex items-center gap-2"><Building size={16}/> كود المتجر</label>
                    <input type="text" placeholder="store-0" value={loginStoreId} onChange={e => setLoginStoreId(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-slate-500" required />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-slate-300 mb-2 block flex items-center gap-2"><Phone size={16}/> رقم الهاتف</label>
                    <input type="tel" placeholder="010xxxxxxxx" value={loginPhone} onChange={e => setLoginPhone(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-slate-500" required />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-slate-300 mb-2 block flex items-center gap-2"><KeyRound size={16}/> كلمة المرور</label>
                    <input type="password" placeholder="********" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-slate-500" required />
                  </div>
                  {loginError && <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-lg text-center font-bold text-sm">{loginError}</div>}
                  <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white rounded-lg py-3 font-bold transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-wait">
                    {isLoading ? <Loader2 className="animate-spin" /> : <><LogIn size={18}/> تسجيل الدخول</>}
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'register' && (
              <div className="animate-in fade-in duration-300">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black text-white">طلب انضمام لمتجر</h1>
                    <p className="text-slate-400 mt-2">املأ بياناتك وسنرسل طلبك لمالك المتجر.</p>
                </div>
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                   <div><label className="text-sm font-bold text-slate-300 mb-2 block flex items-center gap-2"><UserIcon size={16}/> اسمك الكامل</label><input type="text" placeholder="اسمك الظاهر للمدير" value={regFullName} onChange={e => setRegFullName(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-slate-500" required /></div>
                   <div><label className="text-sm font-bold text-slate-300 mb-2 block flex items-center gap-2"><Phone size={16}/> رقم هاتفك</label><input type="tel" placeholder="سيستخدم لتسجيل الدخول" value={regPhone} onChange={e => setRegPhone(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-slate-500" required /></div>
                   <div><label className="text-sm font-bold text-slate-300 mb-2 block flex items-center gap-2"><Mail size={16}/> بريدك الإلكتروني</label><input type="email" placeholder="لاسترجاع كلمة المرور وتفعيل الحساب" value={regEmail} onChange={e => setRegEmail(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-slate-500" required /></div>
                   <div><label className="text-sm font-bold text-slate-300 mb-2 block flex items-center gap-2"><KeyRound size={16}/> كلمة المرور</label><input type="password" placeholder="8 أحرف على الأقل" value={regPassword} onChange={e => setRegPassword(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-slate-500" required /></div>
                   <div><label className="text-sm font-bold text-slate-300 mb-2 block flex items-center gap-2"><Building size={16}/> كود المتجر</label><input type="text" placeholder="اطلبه من مالك المتجر" value={regStoreId} onChange={e => setRegStoreId(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-slate-500" required /></div>
                  
                  {regError && <div className="bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-lg text-center font-bold text-sm">{regError}</div>}
                  
                  <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white rounded-lg py-3 font-bold transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-wait">
                    {isLoading ? <Loader2 className="animate-spin" /> : <><UserPlus size={18}/> إرسال طلب الانضمام</>}
                  </button>
                </form>
              </div>
            )}

            <p className="text-center text-xs text-slate-500 hover:underline mt-8 pt-4 border-t border-slate-800">
                <Link to="/owner-login">هل أنت مالك المتجر؟</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default EmployeeLoginPage;
