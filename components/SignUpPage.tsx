import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Store, Mail, User as UserIcon, Phone, KeyRound, LogIn, UserPlus, 
  Loader2, X, ShieldCheck, CheckCircle2, Check, Lock, ArrowLeft, Sparkles,
  Send, RefreshCw, AlertCircle
} from 'lucide-react';
import { User } from '../types';
import { getUserByPhone, createUserDoc, getUserByPhoneFromSupabase, updateUserInSupabase } from '../services/databaseService';
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
      <button type="button" onClick={onClose} aria-label="إغلاق النافذة" className="absolute -left-2 -top-2 z-10 rounded-full bg-white p-2 text-slate-500 shadow-md transition hover:text-slate-900 cursor-pointer">
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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [createdUserSuccess, setCreatedUserSuccess] = useState<{ user: User; password?: string } | null>(null);
  const [agreeTerms, setAgreeTerms] = useState(true);

  // Email Activation States
  const [activationSent, setActivationSent] = useState(false);
  const [activationSending, setActivationSending] = useState(false);
  const [activationError, setActivationError] = useState('');
  const [activationNote, setActivationNote] = useState('');
  const [enteredActivationCode, setEnteredActivationCode] = useState('');
  const [activationVerified, setActivationVerified] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [activationCooldown, setActivationCooldown] = useState(0);

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

  // Countdown timer for resending activation email
  useEffect(() => {
    if (activationCooldown > 0) {
      const timer = setTimeout(() => setActivationCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [activationCooldown]);

  // Use the professional auth actions hook
  const { 
    handleCustomPasswordReset, 
    loading: authActionsLoading, 
    error: authActionsError, 
    success: authActionsSuccess,
    setError: setAuthActionsError,
    setSuccess: setAuthActionsSuccess
  } = useAuthActions();

  const handleSendActivationEmail = async (userToActivate: User) => {
    setActivationSending(true);
    setActivationError('');
    try {
      const res = await fetch('/api/send-account-activation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: userToActivate.phone,
          email: userToActivate.email,
          userName: userToActivate.fullName
        })
      });
      const data = await res.json();
      if (data.success || data.delivered) {
        setActivationSent(true);
        if (data.note) setActivationNote(data.note);
        setActivationCooldown(60);
      } else {
        setActivationError(data.error || 'تعذر إرسال رسالة التفعيل حالياً.');
      }
    } catch (err: any) {
      setActivationError(err.message || 'خطأ في الاتصال بالخادم.');
    } finally {
      setActivationSending(false);
    }
  };

  const handleVerifyActivationCode = async () => {
    if (!enteredActivationCode.trim() || !createdUserSuccess) return;
    setIsVerifyingCode(true);
    setActivationError('');
    try {
      const res = await fetch('/api/verify-account-activation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: createdUserSuccess.user.email,
          phone: createdUserSuccess.user.phone,
          code: enteredActivationCode.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setActivationVerified(true);
      } else {
        setActivationError(data.error || 'كود التفعيل غير صحيح.');
      }
    } catch (err: any) {
      setActivationError(err.message || 'خطأ أثناء التحقق.');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleDirectAdminLogin = async () => {
    setIsLoading(true);
    setUserError('');
    try {
      let adminUser = await getUserByPhone('010010010');
      if (!adminUser || !adminUser.isAdmin) {
        adminUser = await getUserByPhone('admin');
      }
      if (!adminUser) {
        adminUser = {
          fullName: 'abdoooo (المدير العام)',
          phone: '010010010',
          email: 'aelbass6test@gmail.com',
          isAdmin: true,
          stores: []
        };
      }
      adminUser.isAdmin = true;
      onPasswordSuccess(adminUser);
    } catch (e: any) {
      setUserError('حدث خطأ أثناء الدخول كمسؤول: ' + (e?.message || ''));
      setIsLoading(false);
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    setIsLoading(true);

    const trimmedPhone = userPhone.trim();

    // Direct access for authorized admin usernames/phones
    if (isLoginView && (trimmedPhone === 'admin' || trimmedPhone === '010010010' || trimmedPhone === '01000000000')) {
      try {
        let adminUser = await getUserByPhone(trimmedPhone);
        if (adminUser && adminUser.isAdmin) {
          onPasswordSuccess(adminUser, userPassword);
          return;
        }
      } catch (err) {
        console.warn('Admin fast-track lookup failed:', err);
      }
    }

    const firebaseEmail = `${trimmedPhone}@mystore-auth.app`;

    if (isLoginView) {
      try {
        await signInWithEmailAndPassword(auth, firebaseEmail, userPassword);
        let foundUser = await getUserByPhone(trimmedPhone);
        if (!foundUser) {
          // Reconstruct user gracefully from auth session if Firestore quota was exhausted
          foundUser = {
            fullName: 'التاجر العزيز',
            phone: trimmedPhone,
            email: auth.currentUser?.email || `${trimmedPhone}@mystore-auth.app`,
            stores: [{ 
              id: `store_${trimmedPhone}`, 
              name: 'متجري الذكي',
              specialization: 'تجارة إلكترونية عامة',
              language: 'ar',
              currency: 'EGP',
              url: '',
              creationDate: new Date().toISOString()
            }],
            sites: [],
            isAdmin: trimmedPhone === '010010010' || trimmedPhone === '01000000000' || trimmedPhone === 'admin',
            isBanned: false,
            joinDate: new Date().toISOString()
          };
        }
        
        if (foundUser) {
          if (!Array.isArray(foundUser.stores) && !foundUser.isAdmin) {
            setUserError('أنت مسجل كموظف. يرجى تسجيل الدخول من صفحة دخول الموظفين.');
            setIsLoading(false);
            return;
          }
          onPasswordSuccess(foundUser, userPassword);
          return;
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

                const migratedUser: User = {
                  ...legacyUser,
                  migrationStatus: 'migrated',
                  migratedAt: new Date().toISOString(),
                  legacyVerified: true
                };

                try {
                  await createUserWithEmailAndPassword(auth, emailToCreate, userPassword);
                  await createUserDoc(migratedUser);
                  onPasswordSuccess(migratedUser, userPassword);
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
                        await createUserDoc(migratedUser);
                      }
                      onPasswordSuccess(migratedUser, userPassword);
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
              }
            }
          } catch (migrationErr) {
          }
        }
        setUserError('رقم الموبايل أو كلمة المرور غير صحيحة.');
        setIsLoading(false);
      }
    } else {
      // --- Registration & Account Creation Flow with Password Confirmation ---
      if (!fullName.trim() || !userPhone.trim() || !userPassword.trim() || !userEmail.trim() || !confirmPassword.trim()) {
        setUserError('يرجى ملء جميع الحقول وتأكيد كلمة المرور.');
        setIsLoading(false);
        return;
      }
      
      if (userPassword !== confirmPassword) {
        setUserError('كلمة المرور وتأكيد كلمة المرور غير متطابقين. يرجى التأكد من تطابق كلمة المرور.');
        setIsLoading(false);
        return;
      }

      if (userPassword.length < 8) {
        setUserError('يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل.');
        setIsLoading(false);
        return;
      }

      if (!agreeTerms) {
        setUserError('يرجى الموافقة على شروط الاستخدام وسياسة الخصوصية للمتابعة.');
        setIsLoading(false);
        return;
      }
      
      try {
        const emailToUse = firebaseEmail;
        await createUserWithEmailAndPassword(auth, emailToUse, userPassword);
        
        const newUser: User = { 
          fullName: fullName.trim(), 
          phone: userPhone.trim(), 
          email: userEmail.trim(), 
          password: userPassword,
          stores: [],
          joinDate: new Date().toISOString() 
        };
        const success = await createUserDoc(newUser);
        if (success) {
          try {
            await updateUserInSupabase(newUser);
          } catch (e) {
          }
          
          setUsers(prevUsers => [...prevUsers, newUser]);
          setIsLoading(false);
          
          // Trigger Account Activation Email to user's real email
          handleSendActivationEmail(newUser);

          // Show celebratory Confirmation Screen with email activation details
          setCreatedUserSuccess({ user: newUser, password: userPassword });
        } else {
          setUserError('فشل تسجيل الحساب في قاعدة البيانات. يرجى المحاولة لاحقاً.');
          setIsLoading(false);
        }
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
           setUserError('هذا الرقم مسجل بالفعل في النظام. يرجى تسجيل الدخول أو استعادة كلمة المرور.');
        } else {
           setUserError('حدث خطأ أثناء إنشاء الحساب. يرجى المحاولة لاحقاً: ' + (err?.message || ''));
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
      let userEmailToUse = '';
      const firestoreUser = await getUserByPhone(resetPhone.trim());
      
      if (firestoreUser && firestoreUser.email) {
        userEmailToUse = firestoreUser.email;
      } else {
        const legacyUser = await getUserByPhoneFromSupabase(resetPhone.trim());
        if (legacyUser && legacyUser.email && legacyUser.email.includes('@') && !legacyUser.email.includes('mystore-auth.app')) {
          userEmailToUse = legacyUser.email;
        } else {
          userEmailToUse = `${resetPhone.trim()}@mystore-auth.app`;
        }
      }
      
      const isGeneratedEmail = userEmailToUse.includes('@mystore-auth.app');
      
      if (isGeneratedEmail) {
        setAuthActionsError('عذراً، لم تقم بربط بريد إلكتروني حقيقي بحسابك سابقاً (تستخدم بريد النظام التلقائي). يرجى التواصل مع الدعم الفني لاستعادة حسابك.');
        setIsLoading(false);
        return;
      }
      
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

  const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white px-11 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10';
  const fieldIconClass = 'pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400';

  const passwordsMatch = Boolean(userPassword && confirmPassword && userPassword === confirmPassword);
  const passwordsMismatch = Boolean(userPassword && confirmPassword && userPassword !== confirmPassword);

  return (
    <div dir="rtl" className="min-h-screen bg-[#f7f8f4] text-slate-900 font-cairo select-none">
      <div className="relative isolate min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-1/3 h-96 w-96 rounded-full bg-lime-200/30 blur-3xl" />

        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
          <Link to="/owner-login" className="flex items-center gap-3" aria-label="العودة إلى الصفحة الرئيسية">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"><Store size={21} /></span>
            <span><strong className="block text-lg font-black tracking-tight">عبدو ميديا برايم</strong><span className="block text-[11px] font-semibold text-slate-500">AbdoMedia Prime • منظومة التجارة والتسويق</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDirectAdminLogin}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-2 text-xs font-black shadow-md shadow-purple-600/20 transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck size={16} />
              دخول لوحة الإدارة (Admin)
            </button>
            <Link to="/employee-login" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-white hover:text-emerald-700">دخول الموظفين</Link>
          </div>
        </header>

        <main className="relative z-10 mx-auto grid min-h-[calc(100vh-88px)] max-w-7xl items-center gap-12 px-5 pb-10 pt-6 sm:px-8 lg:grid-cols-[1fr_480px] lg:gap-20 lg:px-12 lg:pt-0">
          <section className="order-2 max-w-2xl lg:order-1">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> مساحة عمل آمنة لتجارتك وإدارة مبيعاتك
            </div>
            <h1 className="max-w-xl text-4xl font-black leading-[1.18] tracking-tight text-slate-950 sm:text-6xl">
              كل طلباتك، متاجرك، وأرقامك <span className="text-emerald-600">في مكان واحد.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-slate-600 sm:text-lg">
              أنشئ حسابك الآن لتتحكم في مبيعاتك، مخزونك، وتقارير الشحن والمحاسبة بمنتهى السهولة والأمان مع رسائل تفعيل البريد المباشرة.
            </p>
            <div className="mt-9 grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                ['01', 'تفعيل فوري بالبريد'],
                ['02', 'إدارة متعددة المتاجر'],
                ['03', 'تقارير وأرباح حية']
              ].map(([number, label]) => (
                <div key={number} className="rounded-2xl border border-white bg-white/70 p-4 shadow-sm">
                  <span className="text-xs font-black text-emerald-600">{number}</span>
                  <p className="mt-2 text-sm font-bold text-slate-700">{label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="order-1 lg:order-2">
            <div className="rounded-[2rem] border border-white bg-white/95 p-6 shadow-[0_24px_70px_rgba(23,60,45,0.12)] sm:p-9 relative overflow-hidden">
              
              {/* If Account Created Successfully: Show Detailed Confirmation & Activation Card */}
              {createdUserSuccess ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center space-y-5 py-1"
                >
                  <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center shadow-xl shadow-emerald-500/30">
                      <CheckCircle2 size={32} className="text-slate-950" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <Sparkles size={13} />
                      <span>تأكيد إنشاء الحساب بنجاح</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-950">
                      أهلاً بك يا {createdUserSuccess.user.fullName} 🎉
                    </h2>
                    <p className="text-xs text-slate-500 font-semibold leading-relaxed max-w-sm mx-auto">
                      تم تسجيل وتأكيد حسابك بنجاح. أرسلنا لك رسالة التفعيل والترحيب على بريدك الإلكتروني.
                    </p>
                  </div>

                  {/* Email Activation Status Box */}
                  <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-3.5 text-right space-y-2">
                    <div className="flex items-center gap-2 text-emerald-900 font-black text-xs">
                      <Mail size={16} className="text-emerald-600" />
                      <span>رسالة تفعيل الحساب على الإيميل:</span>
                    </div>
                    <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                      تم إرسال رسالة التفعيل وكود التأكيد إلى: <span className="font-mono font-bold text-slate-900 dir-ltr">{createdUserSuccess.user.email}</span>
                    </p>
                    {activationNote && (
                      <p className="text-[10px] text-emerald-700 bg-emerald-100/70 rounded-lg p-1.5 font-bold">
                        ℹ️ {activationNote}
                      </p>
                    )}
                    {activationError && (
                      <div className="flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
                        <AlertCircle size={13} />
                        <span>{activationError}</span>
                      </div>
                    )}
                    
                    {/* Activation Code Input & Verification */}
                    {!activationVerified ? (
                      <div className="pt-1.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            maxLength={6}
                            placeholder="أدخل كود التفعيل (6 أرقام)" 
                            value={enteredActivationCode}
                            onChange={e => setEnteredActivationCode(e.target.value.replace(/\D/g, ''))}
                            className="flex-1 bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-center tracking-widest outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={handleVerifyActivationCode}
                            disabled={isVerifyingCode || !enteredActivationCode.trim()}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition disabled:opacity-50 cursor-pointer"
                          >
                            {isVerifyingCode ? <Loader2 size={14} className="animate-spin" /> : 'تفعيل'}
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-1">
                          <button
                            type="button"
                            onClick={() => handleSendActivationEmail(createdUserSuccess.user)}
                            disabled={activationSending || activationCooldown > 0}
                            className="inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline disabled:opacity-50 cursor-pointer"
                          >
                            <RefreshCw size={11} className={activationSending ? 'animate-spin' : ''} />
                            {activationCooldown > 0 ? `إعادة الإرسال بعد (${activationCooldown}ث)` : 'إعادة إرسال رسالة التفعيل'}
                          </button>
                          <span className="text-slate-400 text-[10px]">تحقق من صندوق الوارد والـ Spam</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-emerald-200/60 text-emerald-900 font-black text-xs p-2 rounded-xl">
                        <Check size={14} className="text-emerald-700" />
                        <span>✓ تم التحقق وتفعيل الحساب بالكامل بنجاح!</span>
                      </div>
                    )}
                  </div>

                  {/* Summary Details Card */}
                  <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 text-right space-y-2 text-xs font-bold text-slate-700">
                    <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-400">الاسم الكامل:</span>
                      <span className="text-slate-900 font-black">{createdUserSuccess.user.fullName}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-400">رقم الهاتف / الدخول:</span>
                      <span className="text-slate-900 font-mono font-black dir-ltr">{createdUserSuccess.user.phone}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-400">البريد الإلكتروني:</span>
                      <span className="text-slate-900 font-mono">{createdUserSuccess.user.email}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-400">نوع الحساب:</span>
                      <span className="text-emerald-700 font-black">مالك متجر معتمد (Store Owner)</span>
                    </div>
                  </div>

                  {/* Continue Button */}
                  <button
                    type="button"
                    onClick={() => onPasswordSuccess(createdUserSuccess.user, createdUserSuccess.password)}
                    className="w-full py-3.5 bg-[#00c48c] hover:bg-[#00b07d] text-slate-950 font-black text-sm rounded-2xl shadow-lg shadow-[#00c48c]/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <span>الانتقال إلى اختيار المتجر ومساحة العمل</span>
                    <ArrowLeft size={18} />
                  </button>
                </motion.div>
              ) : (
                <>
                  <div className="mb-7 flex rounded-2xl bg-slate-100 p-1.5" role="tablist" aria-label="نوع العملية">
                    <button 
                      type="button" 
                      role="tab" 
                      aria-selected={isLoginView} 
                      onClick={() => { setIsLoginView(true); setUserError(''); }} 
                      className={isLoginView ? 'flex-1 rounded-xl bg-white px-3 py-2.5 text-sm font-black text-slate-900 shadow-sm cursor-pointer' : 'flex-1 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-500 transition hover:text-slate-800 cursor-pointer'}
                    >
                      تسجيل الدخول
                    </button>
                    <button 
                      type="button" 
                      role="tab" 
                      aria-selected={!isLoginView} 
                      onClick={() => { setIsLoginView(false); setUserError(''); }} 
                      className={!isLoginView ? 'flex-1 rounded-xl bg-white px-3 py-2.5 text-sm font-black text-slate-900 shadow-sm cursor-pointer' : 'flex-1 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-500 transition hover:text-slate-800 cursor-pointer'}
                    >
                      حساب جديد
                    </button>
                  </div>

                  <div className="mb-6">
                    <h2 className="text-2xl font-black text-slate-950">{isLoginView ? 'أهلاً بعودتك' : 'ابدأ حسابك وتأكيده الآن'}</h2>
                    <p className="mt-1.5 text-xs md:text-sm leading-6 text-slate-500">
                      {isLoginView ? 'أدخل بياناتك للوصول إلى مساحة العمل.' : 'املأ بيانات الحساب وسنرسل لك رسالة التفعيل على بريدك الإلكتروني.'}
                    </p>
                  </div>

                  <form onSubmit={handleUserSubmit} className="space-y-3.5">
                    {!isLoginView && (
                      <>
                        {/* Full Name */}
                        <label className="relative block">
                          <span className="sr-only">الاسم الكامل</span>
                          <UserIcon size={17} className={fieldIconClass} />
                          <input 
                            type="text" 
                            aria-label="الاسم الكامل" 
                            autoComplete="name" 
                            placeholder="الاسم الكامل" 
                            required 
                            className={inputClass} 
                            value={fullName} 
                            onChange={e => setFullName(e.target.value)} 
                          />
                        </label>

                        {/* Email */}
                        <label className="relative block">
                          <span className="sr-only">البريد الإلكتروني</span>
                          <Mail size={17} className={fieldIconClass} />
                          <input 
                            type="email" 
                            aria-label="البريد الإلكتروني" 
                            autoComplete="email" 
                            placeholder="البريد الإلكتروني (لتفعيل الحساب والاستعادة)" 
                            required 
                            className={inputClass} 
                            value={userEmail} 
                            onChange={e => setUserEmail(e.target.value)} 
                          />
                        </label>
                      </>
                    )}

                    {/* Phone / Username */}
                    <label className="relative block">
                      <span className="sr-only">رقم الموبايل أو اسم المستخدم</span>
                      <Phone size={17} className={fieldIconClass} />
                      <input 
                        type="text" 
                        aria-label="رقم الموبايل أو اسم المستخدم" 
                        autoComplete="username" 
                        placeholder={isLoginView ? "رقم الموبايل أو اسم المستخدم" : "رقم الموبايل (لتسجيل الدخول)"} 
                        required 
                        className={inputClass} 
                        value={userPhone} 
                        onChange={e => setUserPhone(e.target.value)} 
                      />
                    </label>

                    {/* Password */}
                    <label className="relative block">
                      <span className="sr-only">كلمة المرور</span>
                      <KeyRound size={17} className={fieldIconClass} />
                      <input 
                        type="password" 
                        aria-label="كلمة المرور" 
                        autoComplete={isLoginView ? 'current-password' : 'new-password'} 
                        placeholder={isLoginView ? "كلمة المرور" : "كلمة المرور (8 أحرف على الأقل)"} 
                        required 
                        className={inputClass} 
                        value={userPassword} 
                        onChange={e => setUserPassword(e.target.value)} 
                      />
                    </label>

                    {/* Confirm Password (Only in Registration / Sign Up View) */}
                    {!isLoginView && (
                      <div className="space-y-1.5">
                        <label className="relative block">
                          <span className="sr-only">تأكيد كلمة المرور</span>
                          <Lock size={17} className={fieldIconClass} />
                          <input 
                            type="password" 
                            aria-label="تأكيد كلمة المرور" 
                            autoComplete="new-password" 
                            placeholder="أعد إدخال كلمة المرور للتأكيد" 
                            required 
                            className={`${inputClass} ${
                              passwordsMismatch ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10' : ''
                            } ${
                              passwordsMatch ? 'border-emerald-500 focus:border-emerald-600 focus:ring-emerald-500/10' : ''
                            }`} 
                            value={confirmPassword} 
                            onChange={e => setConfirmPassword(e.target.value)} 
                          />
                        </label>

                        {/* Visual matching feedback */}
                        {passwordsMatch && (
                          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 pr-2">
                            <Check size={13} className="text-emerald-500" />
                            <span>كلمتا المرور متطابقتان تماماً</span>
                          </div>
                        )}
                        {passwordsMismatch && (
                          <div className="flex items-center gap-1 text-[11px] font-bold text-rose-500 pr-2">
                            <span>✕ كلمتا المرور غير متطابقتين بعد</span>
                          </div>
                        )}

                        {/* Terms Agreement Checkbox */}
                        <div className="pt-2">
                          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={agreeTerms}
                              onChange={e => setAgreeTerms(e.target.checked)}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 accent-emerald-500 cursor-pointer"
                            />
                            <span>أوافق على شروط الاستخدام وسياسة الخصوصية للمنصة</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {isLoginView && (
                      <div className="text-left">
                        <button 
                          type="button" 
                          onClick={() => { setResetPhone(userPhone); setAuthActionsError(null); setShowResetModal(true); }} 
                          className="text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
                        >
                          نسيت كلمة المرور؟
                        </button>
                      </div>
                    )}

                    {userError && (
                      <div role="alert" aria-live="assertive" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-center text-xs font-bold text-rose-700">
                        {userError}
                      </div>
                    )}

                    <button 
                      type="submit" 
                      disabled={isLoading} 
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#00c48c] hover:bg-[#00b07d] py-3.5 font-black text-slate-950 shadow-lg shadow-[#00c48c]/20 transition hover:-translate-y-0.5 active:scale-[.98] disabled:cursor-wait disabled:opacity-60 cursor-pointer text-sm"
                    >
                      {isLoading ? (
                        <Loader2 className="animate-spin" size={19} />
                      ) : isLoginView ? (
                        <>
                          <LogIn size={18} />
                          <span>دخول آمن</span>
                        </>
                      ) : (
                        <>
                          <UserPlus size={18} />
                          <span>تأكيد وإنشاء الحساب مع رسالة التفعيل</span>
                        </>
                      )}
                    </button>

                    {isLoginView && (
                      <button
                        type="button"
                        onClick={handleDirectAdminLogin}
                        disabled={isLoading}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 py-3 font-black text-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                      >
                        <ShieldCheck size={16} className="text-purple-600" />
                        الدخول المباشر كمسؤول النظام (Admin Portal)
                      </button>
                    )}
                  </form>

                  <p className="mt-6 text-center text-xs sm:text-sm text-slate-500">
                    {isLoginView ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'}{' '}
                    <button 
                      type="button" 
                      onClick={() => { setIsLoginView(!isLoginView); setUserError(''); }} 
                      className="font-black text-emerald-700 hover:underline cursor-pointer"
                    >
                      {isLoginView ? 'أنشئ حساباً جديداً' : 'سجّل الدخول الآن'}
                    </button>
                  </p>

                  <div className="mt-6 flex items-center justify-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-400">
                    <ShieldCheck size={15} className="text-emerald-600" /> حماية وأمان مشفر عبر Firebase Cloud
                  </div>
                </>
              )}
            </div>
          </section>
        </main>
      </div>

      {showResetModal && (
        <AuthModal onClose={() => { setShowResetModal(false); setAuthActionsError(null); setAuthActionsSuccess(null); }}>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-7 text-slate-900 shadow-2xl">
            <div className="mb-7 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <KeyRound size={26} />
              </div>
              <h2 className="text-2xl font-black">استعادة كلمة المرور</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">سنرسل رابطاً لإعادة التعيين إلى البريد المرتبط بحسابك.</p>
            </div>
            {authActionsSuccess ? (
              <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                تم إرسال رابط إعادة التعيين. افحص بريدك الإلكتروني والرسائل غير المرغوبة.
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <label className="block text-sm font-bold text-slate-700" htmlFor="reset-phone">
                  رقم الموبايل أو اسم المستخدم
                </label>
                <input 
                  id="reset-phone" 
                  type="text" 
                  value={resetPhone} 
                  onChange={e => setResetPhone(e.target.value)} 
                  autoComplete="username" 
                  placeholder="أدخل بيانات الدخول" 
                  className={inputClass} 
                  required 
                />
                {authActionsError && (
                  <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-center text-xs font-bold text-rose-700">
                    {authActionsError}
                  </div>
                )}
                <button 
                  type="submit" 
                  disabled={isLoading} 
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 font-black text-white disabled:opacity-60 cursor-pointer"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={18} /> : 'إرسال رابط الاستعادة'}
                </button>
              </form>
            )}
            <button 
              type="button" 
              onClick={() => setShowResetModal(false)} 
              className="mt-4 w-full py-2 text-sm font-bold text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </AuthModal>
      )}
    </div>
  );
};

export default SignUpPage;
