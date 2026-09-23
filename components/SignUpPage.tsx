import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Store, Mail, User as UserIcon, Phone, KeyRound, LogIn, UserPlus, Loader2, X, ShieldCheck } from 'lucide-react';
import { User } from '../types';
import { getUserByPhone, createUserDoc, getUserByPhoneFromSupabase, updateUserInSupabase, getSupabaseClient } from '../services/databaseService';
import { auth } from '../services/firebaseClient';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuthActions } from '../src/hooks/useAuthActions';
import { motion } from 'framer-motion';

const AuthModal: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm"
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.96, y: 12 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.96, y: 12 }}
      className="relative w-full max-w-md"
      onClick={event => event.stopPropagation()}
    >
      <button type="button" onClick={onClose} aria-label="إغلاق النافذة" className="absolute -left-2 -top-2 z-10 rounded-full bg-white p-2 text-slate-500 shadow-md transition hover:text-slate-900">
        <X size={18} />
      </button>
      {children}
    </motion.div>
  </motion.div>
);

// --- Main Page Component ---
interface SignUpPageProps {
  onPasswordSuccess: (user: User, password?: string) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

const SignUpPage: React.FC<SignUpPageProps> = ({ onPasswordSuccess, users, setUsers }) => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [fullName, setFullName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [resetPhone, setResetPhone] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [userError, setUserError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // If coming from another page with forgot=true, show the modal
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('forgot') === 'true') {
      setShowResetModal(true);
    }
  }, []);

  // Use the professional auth actions hook
  const { 
    handleCustomPasswordReset, 
    loading: authActionsLoading, 
    error: authActionsError, 
    success: authActionsSuccess,
    setError: setAuthActionsError,
    setSuccess: setAuthActionsSuccess
  } = useAuthActions();

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    setIsLoading(true);

    const firebaseEmail = `${userPhone.trim()}@mystore-auth.app`;

    if (isLoginView) {
      try {
        await signInWithEmailAndPassword(auth, firebaseEmail, userPassword);
        const foundUser = await getUserByPhone(userPhone.trim());
        if (foundUser) {
          if (!Array.isArray(foundUser.stores) && !foundUser.isAdmin) {
            setUserError('أنت مسجل كموظف. يرجى تسجيل الدخول من صفحة دخول الموظفين.');
            setIsLoading(false);
            return;
          }
          onPasswordSuccess(foundUser, userPassword);
        } else {
          setUserError('لم يتم العثور على بيانات المستخدم.');
          setIsLoading(false);
        }
      } catch (err: any) {
        if (err.code === 'auth/network-request-failed') {
          setUserError("فشل الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.");
          setIsLoading(false);
          return;
        }
        const isUserNotFoundOrInvalid = err.code === 'auth/user-not-found' || 
                                       err.code === 'auth/invalid-credential' || 
                                       err?.message?.includes('user-not-found') || 
                                       err?.message?.includes('invalid-credential');
        if (isUserNotFoundOrInvalid) {
          try {
            // Check in Firestore first
            const firestoreUser = await getUserByPhone(userPhone.trim());
            if (firestoreUser && firestoreUser.password === userPassword) {
              try {
                await createUserWithEmailAndPassword(auth, firebaseEmail, userPassword);
                onPasswordSuccess(firestoreUser, userPassword);
                return;
              } catch (createErr) {
              }
            }

            const legacyUser = await getUserByPhoneFromSupabase(userPhone.trim());
            
            // 1. Check if they have a CUSTOM email in Supabase (meaning they updated it in settings)
            if (legacyUser && legacyUser.email && legacyUser.email !== `${userPhone.trim()}@mystore-auth.app`) {
              try {
                await signInWithEmailAndPassword(auth, legacyUser.email, userPassword);
                const foundUser = await getUserByPhone(userPhone.trim());
                if (foundUser) {
                  onPasswordSuccess(foundUser, userPassword);
                  return;
                }
              } catch (secondErr: any) {
              }
            }
            
            // 2. Original Migration Logic (Legacy users)
            if (legacyUser) {
              const storedPassword = legacyUser.password;
              if (storedPassword === userPassword) {
                if (userPassword.length < 6) {
                  setUserError("يجب إعادة تعيين كلمة المرور لأن كلمة المرور القديمة لا تستوفي متطلبات Firebase Authentication.");
                  setIsLoading(false);
                  return;
                }
                
                // Use real email if available, otherwise generated one
                const emailToCreate = legacyUser.email || firebaseEmail;

                try {
                  await createUserWithEmailAndPassword(auth, emailToCreate, userPassword);
                  await createUserDoc(legacyUser);
                  onPasswordSuccess(legacyUser, userPassword);
                } catch (createErr: any) {
                  if (createErr.code === 'auth/email-already-in-use') {
                    try {
                      // Try signing in with BOTH potential emails
                      try {
                        await signInWithEmailAndPassword(auth, emailToCreate, userPassword);
                      } catch (signInErr: any) {
                        if (emailToCreate !== firebaseEmail) {
                          await signInWithEmailAndPassword(auth, firebaseEmail, userPassword);
                        } else {
                          throw signInErr;
                        }
                      }
                      
                      const existingFsUser = await getUserByPhone(userPhone.trim());
                      if (!existingFsUser) {
                        await createUserDoc(legacyUser);
                      }
                      onPasswordSuccess(legacyUser, userPassword);
                    } catch (signInErr: any) {
                      if (signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/wrong-password') {
                        setUserError('رقم الموبايل أو كلمة المرور غير صحيحة.');
                      } else {
                        setUserError('رقم الموبايل أو كلمة المرور غير صحيحة.');
                      }
                      setIsLoading(false);
                    }
                  } else {
                    setUserError('فشل إنشاء حساب المصادقة.');
                    setIsLoading(false);
                  }
                }
                return;
              } else {
              }
            } else {
            }
          } catch (migrationErr) {
          }
        }
        setUserError('رقم الموبايل أو كلمة المرور غير صحيحة.');
        setIsLoading(false);
      }
    } else {
      if (!fullName.trim() || !userPhone.trim() || !userPassword.trim() || !userEmail.trim()) {
        setUserError('يرجى ملء جميع الحقول.');
        setIsLoading(false);
        return;
      }
      if (userPassword.length < 8) {
        setUserError('يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل.');
        setIsLoading(false);
        return;
      }
      
      try {
        // ALWAYS use the generated email for the initial Firebase Auth account.
        // This ensures the security rules can verify phone ownership via the email pattern.
        // The real email will be stored in Firestore and used for recovery/login lookups.
        const emailToUse = firebaseEmail;
        await createUserWithEmailAndPassword(auth, emailToUse, userPassword);
        
        const newUser: User = { 
          fullName, 
          phone: userPhone.trim(), 
          email: userEmail, 
          password: userPassword, // Include password for Supabase sync
          stores: [],
          joinDate: new Date().toISOString() 
        };
        const success = await createUserDoc(newUser);
        if (success) {
          // Sync to Supabase as well for legacy compatibility
          try {
            await updateUserInSupabase(newUser);
          } catch (e) {
          }
          
          setUsers(prevUsers => [...prevUsers, newUser]);
          onPasswordSuccess(newUser, userPassword);
        } else {
          setUserError('فشل تسجيل الحساب في قاعدة البيانات. يرجى المحاولة لاحقاً.');
          setIsLoading(false);
        }
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
           setUserError('هذا الرقم مسجل بالفعل.');
        } else {
           setUserError('حدث خطأ أثناء التسجيل. يرجى المحاولة لاحقاً.');
        }
        setIsLoading(false);
      }
    }
  };

  const [sentToEmail, setSentToEmail] = useState('');

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    setIsLoading(true);
    setSentToEmail('');

    if (!resetPhone.trim()) {
      setAuthActionsError('يرجى إدخال رقم الموبايل أو اسم المستخدم أولاً.');
      setIsLoading(false);
      return;
    }

    try {
      // 1. Try to find user in Firestore (already migrated)
      let userEmailToUse = '';
      const firestoreUser = await getUserByPhone(resetPhone.trim());
      
      if (firestoreUser && firestoreUser.email) {
        userEmailToUse = firestoreUser.email;
      } else {
        // 2. Try Supabase
        const legacyUser = await getUserByPhoneFromSupabase(resetPhone.trim());
        if (legacyUser && legacyUser.email && legacyUser.email.includes('@') && !legacyUser.email.includes('mystore-auth.app')) {
          userEmailToUse = legacyUser.email;
        } else {
          // 3. Fallback to generated
          userEmailToUse = `${resetPhone.trim()}@mystore-auth.app`;
        }
      }
      
      const isGeneratedEmail = userEmailToUse.includes('@mystore-auth.app');
      
      if (isGeneratedEmail) {
        setAuthActionsError('عذراً، لم تقم بربط بريد إلكتروني حقيقي بحسابك سابقاً (تستخدم بريد النظام التلقائي). يرجى التواصل مع الدعم الفني لاستعادة حسابك.');
        setIsLoading(false);
        return;
      }
      
      // Use the professional reset function with ActionCodeSettings
      await handleCustomPasswordReset(userEmailToUse);
      
      if (!authActionsError) {
        setSentToEmail(userEmailToUse);
        setResetSuccess(true);
        
        setTimeout(() => {
          setShowResetModal(false);
          setResetSuccess(false);
          setSentToEmail('');
          setAuthActionsSuccess(null);
        }, 8000);
      }
    } catch (err: any) {
      setAuthActionsError('حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.');
    } finally {
      setIsLoading(false);
    }
  };
  const toggleView = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setIsLoginView(!isLoginView);
    setUserError('');
    setFullName('');
    setUserPhone('');
    setUserEmail('');
    setUserPassword('');
  };
  
  const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white px-11 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10';
  const fieldIconClass = 'pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400';

  return (
    <div dir="rtl" className="min-h-screen bg-[#f7f8f4] text-slate-900 font-cairo">
      <div className="relative isolate min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-1/3 h-96 w-96 rounded-full bg-lime-200/30 blur-3xl" />

        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
          <Link to="/owner-login" className="flex items-center gap-3" aria-label="العودة إلى الصفحة الرئيسية">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"><Store size={21} /></span>
            <span><strong className="block text-lg font-black tracking-tight">منصتي</strong><span className="block text-[11px] font-semibold text-slate-500">إدارة تجارتك ببساطة</span></span>
          </Link>
          <Link to="/employee-login" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-white hover:text-emerald-700">دخول الموظفين</Link>
        </header>

        <main className="relative z-10 mx-auto grid min-h-[calc(100vh-88px)] max-w-7xl items-center gap-12 px-5 pb-10 pt-6 sm:px-8 lg:grid-cols-[1fr_480px] lg:gap-20 lg:px-12 lg:pt-0">
          <section className="order-2 max-w-2xl lg:order-1">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm"><span className="h-2 w-2 rounded-full bg-emerald-500" /> مساحة عمل آمنة لتجارتك</div>
            <h1 className="max-w-xl text-4xl font-black leading-[1.18] tracking-tight text-slate-950 sm:text-6xl">كل طلباتك، منتجاتك، وأرقامك <span className="text-emerald-600">في مكان واحد.</span></h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-slate-600 sm:text-lg">ابدأ من لوحة واضحة تساعدك على متابعة البيع والمخزون والعملاء بدون خطوات زائدة أو تشتيت.</p>
            <div className="mt-9 grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                ['01', 'لوحة واضحة'],
                ['02', 'بيانات منظمة'],
                ['03', 'فريق متصل']
              ].map(([number, label]) => <div key={number} className="rounded-2xl border border-white bg-white/70 p-4 shadow-sm"><span className="text-xs font-black text-emerald-600">{number}</span><p className="mt-2 text-sm font-bold text-slate-700">{label}</p></div>)}
            </div>
          </section>

          <section className="order-1 lg:order-2">
            <div className="rounded-[2rem] border border-white bg-white/95 p-6 shadow-[0_24px_70px_rgba(23,60,45,0.12)] sm:p-9">
              <div className="mb-7 flex rounded-2xl bg-slate-100 p-1.5" role="tablist" aria-label="نوع العملية">
                <button type="button" role="tab" aria-selected={isLoginView} onClick={() => { setIsLoginView(true); setUserError(''); }} className={isLoginView ? 'flex-1 rounded-xl bg-white px-3 py-2.5 text-sm font-black text-slate-900 shadow-sm' : 'flex-1 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-500 transition hover:text-slate-800'}>تسجيل الدخول</button>
                <button type="button" role="tab" aria-selected={!isLoginView} onClick={() => { setIsLoginView(false); setUserError(''); }} className={!isLoginView ? 'flex-1 rounded-xl bg-white px-3 py-2.5 text-sm font-black text-slate-900 shadow-sm' : 'flex-1 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-500 transition hover:text-slate-800'}>حساب جديد</button>
              </div>
              <div className="mb-7"><h2 className="text-2xl font-black text-slate-950">{isLoginView ? 'أهلاً بعودتك' : 'ابدأ حسابك الآن'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{isLoginView ? 'أدخل بياناتك للوصول إلى مساحة العمل.' : 'أنشئ حسابك وابدأ في إدارة متجرك.'}</p></div>
              <form onSubmit={handleUserSubmit} className="space-y-4">
                {!isLoginView && <>
                  <label className="relative block"><span className="sr-only">الاسم الكامل</span><UserIcon size={17} className={fieldIconClass} /><input type="text" aria-label="الاسم الكامل" autoComplete="name" placeholder="الاسم الكامل" required className={inputClass} value={fullName} onChange={e => setFullName(e.target.value)} /></label>
                  <label className="relative block"><span className="sr-only">البريد الإلكتروني</span><Mail size={17} className={fieldIconClass} /><input type="email" aria-label="البريد الإلكتروني" autoComplete="email" placeholder="البريد الإلكتروني" required className={inputClass} value={userEmail} onChange={e => setUserEmail(e.target.value)} /></label>
                </>}
                <label className="relative block"><span className="sr-only">رقم الموبايل أو اسم المستخدم</span><Phone size={17} className={fieldIconClass} /><input type="text" aria-label="رقم الموبايل أو اسم المستخدم" autoComplete="username" placeholder="رقم الموبايل أو اسم المستخدم" required className={inputClass} value={userPhone} onChange={e => setUserPhone(e.target.value)} /></label>
                <label className="relative block"><span className="sr-only">كلمة المرور</span><KeyRound size={17} className={fieldIconClass} /><input type="password" aria-label="كلمة المرور" autoComplete={isLoginView ? 'current-password' : 'new-password'} placeholder="كلمة المرور" required className={inputClass} value={userPassword} onChange={e => setUserPassword(e.target.value)} /></label>
                {isLoginView && <div className="text-left"><button type="button" onClick={() => { setResetPhone(userPhone); setAuthActionsError(null); setShowResetModal(true); }} className="text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline">نسيت كلمة المرور؟</button></div>}
                {userError && <div role="alert" aria-live="assertive" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-center text-sm font-bold text-rose-700">{userError}</div>}
                <button type="submit" disabled={isLoading} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 font-black text-white shadow-lg shadow-emerald-600/20 transition hover:-translate-y-0.5 hover:bg-emerald-700 active:scale-[.98] disabled:cursor-wait disabled:opacity-60">{isLoading ? <Loader2 className="animate-spin" size={19} /> : (isLoginView ? <><LogIn size={18} /> دخول آمن</> : <><UserPlus size={18} /> إنشاء الحساب</>)}</button>
              </form>
              <p className="mt-6 text-center text-sm text-slate-500">{isLoginView ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'} <button type="button" onClick={() => { setIsLoginView(!isLoginView); setUserError(''); }} className="font-black text-emerald-700 hover:underline">{isLoginView ? 'أنشئ حساباً' : 'سجّل الدخول'}</button></p>
              <div className="mt-7 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-xs text-slate-400"><ShieldCheck size={15} className="text-emerald-600" /> حماية الحساب تبدأ بكلمة مرور قوية</div>
            </div>
          </section>
        </main>
      </div>

      {showResetModal && <AuthModal onClose={() => { setShowResetModal(false); setAuthActionsError(null); setAuthActionsSuccess(null); }}><div className="rounded-[2rem] border border-slate-200 bg-white p-7 text-slate-900 shadow-2xl"><div className="mb-7 text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><KeyRound size={26} /></div><h2 className="text-2xl font-black">استعادة كلمة المرور</h2><p className="mt-2 text-sm leading-6 text-slate-500">سنرسل رابطاً لإعادة التعيين إلى البريد المرتبط بحسابك.</p></div>{authActionsSuccess ? <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">تم إرسال رابط إعادة التعيين. افحص بريدك الإلكتروني والرسائل غير المرغوبة.</div> : <form onSubmit={handleForgotPassword} className="space-y-4"><label className="block text-sm font-bold text-slate-700" htmlFor="reset-phone">رقم الموبايل أو اسم المستخدم</label><input id="reset-phone" type="text" value={resetPhone} onChange={e => setResetPhone(e.target.value)} autoComplete="username" placeholder="أدخل بيانات الدخول" className={inputClass} required />{authActionsError && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-center text-xs font-bold text-rose-700">{authActionsError}</div>}<button type="submit" disabled={isLoading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 font-black text-white disabled:opacity-60">{isLoading ? <Loader2 className="animate-spin" size={18} /> : 'إرسال رابط الاستعادة'}</button></form>}<button type="button" onClick={() => setShowResetModal(false)} className="mt-4 w-full py-2 text-sm font-bold text-slate-500 hover:text-slate-900">إلغاء</button></div></AuthModal>}
    </div>
  );
};

export default SignUpPage;
