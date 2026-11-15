import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  AlertTriangle,
  MessageSquare,
  Send,
  RefreshCw,
  CheckCircle2,
  Clock,
  PhoneCall,
  Store as StoreIcon,
  LogOut,
  ArrowRight,
  Headphones,
  Lock,
  PlusCircle,
  User as UserIcon,
  ShieldCheck,
  History,
  ChevronDown,
  ChevronUp,
  RotateCcw
} from 'lucide-react';
import { User, Store, SupportAppeal, SupportTicketMessage } from '../types';
import * as db from '../services/databaseService';
import { cfFetch } from '../services/cloudflareClient';
import { inAppAlert } from '../utils/inAppAlert';
import {
  fetchPlatformSupportConfig,
  getCachedPlatformSupportPhone,
  buildSupportWhatsAppUrl
} from '../utils/platformSupport';

interface SuspendedAccountSupportScreenProps {
  mode: 'store' | 'account' | 'employee';
  currentUser: User;
  activeStore?: Store | null;
  users?: User[];
  setCurrentUser?: React.Dispatch<React.SetStateAction<User | null>>;
  setUsers?: React.Dispatch<React.SetStateAction<User[]>>;
  onLogout: () => void;
}

const normalizeWhatsappPhone = (rawPhone: string): string => {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits) return '201000000000';
  if (digits.startsWith('01') && digits.length === 11) {
    return `2${digits}`;
  }
  if (digits.startsWith('20')) {
    return digits;
  }
  return digits;
};

export const buildNormalizedTicketMessages = (
  appeal?: SupportAppeal,
  fallbackOwnerName: string = 'التاجر'
): SupportTicketMessage[] => {
  if (!appeal) return [];
  if (Array.isArray(appeal.messages) && appeal.messages.length > 0) {
    return appeal.messages;
  }
  const list: SupportTicketMessage[] = [];
  if (appeal.message && appeal.message.trim()) {
    list.push({
      id: `${appeal.id}-m1`,
      senderRole: 'merchant',
      senderName: appeal.ownerName || fallbackOwnerName,
      senderTitle: 'مالك المتجر',
      text: appeal.message.trim(),
      createdAt: appeal.createdAt || new Date().toISOString()
    });
  }
  if (appeal.adminReply && appeal.adminReply.trim()) {
    list.push({
      id: `${appeal.id}-s1`,
      senderRole: 'support',
      senderName: appeal.repliedByName || 'إدارة المنصة',
      senderTitle: 'فريق الدعم الفني',
      text: appeal.adminReply.trim(),
      createdAt: appeal.repliedAt || new Date().toISOString()
    });
  }
  return list;
};

const formatRemainingTime = (ms: number): string => {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
};

const SuspendedAccountSupportScreen: React.FC<SuspendedAccountSupportScreenProps> = ({
  mode,
  currentUser,
  activeStore,
  users = [],
  setCurrentUser,
  setUsers,
  onLogout
}) => {
  const existingAppeal: SupportAppeal | undefined =
    mode === 'store' ? activeStore?.supportAppeal : currentUser?.supportAppeal;

  const ticketsHistory: SupportAppeal[] = useMemo(() => {
    const raw =
      mode === 'store'
        ? activeStore?.supportTicketsHistory
        : currentUser?.supportTicketsHistory;
    return Array.isArray(raw) ? raw : [];
  }, [mode, activeStore?.supportTicketsHistory, currentUser?.supportTicketsHistory]);

  const banReason =
    mode === 'store'
      ? activeStore?.banReason || currentUser?.banReason
      : currentUser?.banReason;

  // IMPORTANT: Input starts completely empty and clears after every message sent!
  const [messageInput, setMessageInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [supportWhatsapp, setSupportWhatsapp] = useState<string>('');
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const chatMessages = useMemo(
    () => buildNormalizedTicketMessages(existingAppeal, currentUser.fullName),
    [existingAppeal, currentUser.fullName]
  );

  // Live 1-second ticker for auto-close countdown after support reply
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const autoCloseRemainingMs = useMemo(() => {
    if (!existingAppeal?.autoCloseAt || existingAppeal.status !== 'replied') return null;
    const target = new Date(existingAppeal.autoCloseAt).getTime();
    if (isNaN(target)) return null;
    return target - nowTs;
  }, [existingAppeal?.autoCloseAt, existingAppeal?.status, nowTs]);

  const isTicketClosed = useMemo(() => {
    if (!existingAppeal) return false;
    if (existingAppeal.status === 'closed' || existingAppeal.status === 'resolved') return true;
    if (
      existingAppeal.status === 'replied' &&
      existingAppeal.autoCloseAt &&
      new Date(existingAppeal.autoCloseAt).getTime() <= nowTs
    ) {
      return true;
    }
    return false;
  }, [existingAppeal, nowTs]);

  // Persist auto-close transition when timer expires
  useEffect(() => {
    if (
      existingAppeal &&
      existingAppeal.status === 'replied' &&
      existingAppeal.autoCloseAt &&
      new Date(existingAppeal.autoCloseAt).getTime() <= nowTs
    ) {
      const closedAppeal: SupportAppeal = {
        ...existingAppeal,
        status: 'closed',
        closedAt: new Date().toISOString(),
        closedBy: 'إغلاق تلقائي بعد انتهاء مهلة الرد'
      };
      const updatedUser: User =
        mode === 'store' && activeStore
          ? {
              ...currentUser,
              stores: (currentUser.stores || []).map(s =>
                s.id === activeStore.id ? { ...s, supportAppeal: closedAppeal } : s
              )
            }
          : {
              ...currentUser,
              supportAppeal: closedAppeal
            };
      if (setCurrentUser) setCurrentUser(updatedUser);
      if (setUsers && users.length > 0) {
        setUsers(prev => prev.map(u => (u.phone === currentUser.phone ? updatedUser : u)));
      }
      void db.createUserDoc(updatedUser).catch(() => {});
    }
  }, [existingAppeal, nowTs, mode, activeStore, currentUser, setCurrentUser, setUsers, users.length]);

  // Auto-scroll chat thread to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  // Load Platform Support WhatsApp number (project-wide)
  useEffect(() => {
    let mounted = true;
    const adminUser = users.find(u => u.isAdmin && u.phone);
    const fallbackPhone = getCachedPlatformSupportPhone(adminUser?.phone || '01000000000');
    setSupportWhatsapp(fallbackPhone);

    fetchPlatformSupportConfig(fallbackPhone).then(cfg => {
      if (mounted && cfg.phone) {
        setSupportWhatsapp(cfg.phone);
      }
    });

    const onSupportUpdated = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.phone) {
        setSupportWhatsapp(detail.phone);
      } else {
        setSupportWhatsapp(getCachedPlatformSupportPhone(fallbackPhone));
      }
    };
    window.addEventListener('platform-support-updated', onSupportUpdated);
    window.addEventListener('storage', onSupportUpdated);

    return () => {
      mounted = false;
      window.removeEventListener('platform-support-updated', onSupportUpdated);
      window.removeEventListener('storage', onSupportUpdated);
    };
  }, [users]);

  const pullLatestStatusSilently = useCallback(async () => {
    if (!currentUser?.phone) return;
    try {
      const [freshUser, globalData] = await Promise.all([
        db.getUserByPhone(currentUser.phone),
        db.getGlobalData(true).catch(() => null)
      ]);
      const resolvedUser =
        globalData?.users?.find((u: User) => u.phone === currentUser.phone) || freshUser;
      if (globalData?.users && setUsers) {
        setUsers(globalData.users);
      }
      if (resolvedUser && setCurrentUser) {
        setCurrentUser(resolvedUser);
      }
    } catch {}
  }, [currentUser?.phone, setCurrentUser, setUsers]);

  // Background poll every 8 seconds so support replies and unbans appear live in chat!
  useEffect(() => {
    const poll = setInterval(() => {
      void pullLatestStatusSilently();
    }, 8000);
    return () => clearInterval(poll);
  }, [pullLatestStatusSilently]);

  const handleRefreshStatus = async () => {
    if (!currentUser?.phone) return;
    setIsRefreshing(true);
    try {
      await pullLatestStatusSilently();
      await inAppAlert('تم تحديث حالة التذكرة ومزامنة الردود مع الدعم الفني بنجاح.', {
        type: 'info'
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const persistAppealUpdate = async (
    nextAppeal: SupportAppeal,
    nextHistory?: SupportAppeal[]
  ) => {
    const historyToSave = nextHistory ?? ticketsHistory;
    const updatedUser: User =
      mode === 'store' && activeStore
        ? {
            ...currentUser,
            stores: (currentUser.stores || []).map(s =>
              s.id === activeStore.id
                ? {
                    ...s,
                    supportAppeal: nextAppeal,
                    supportTicketsHistory: historyToSave
                  }
                : s
            )
          }
        : {
            ...currentUser,
            supportAppeal: nextAppeal,
            supportTicketsHistory: historyToSave
          };

    if (setCurrentUser) {
      setCurrentUser(updatedUser);
    }

    const updatedUsersList =
      users.length > 0
        ? users.map(u => (u.phone === currentUser.phone ? updatedUser : u))
        : [updatedUser];

    if (setUsers && users.length > 0) {
      setUsers(updatedUsersList);
    }

    await db.createUserDoc(updatedUser);
    if (users.length > 0) {
      await db.saveGlobalData({ users: updatedUsersList, loyaltyData: {} });
    }

    try {
      const existingRes = await cfFetch<any>('/api/db/settings/support_appeals').catch(() => null);
      const prevList: SupportAppeal[] = Array.isArray(existingRes?.value)
        ? existingRes.value
        : [];
      const archivedIds = new Set(historyToSave.map(h => h.id));
      const filtered = prevList.filter(a => a.id !== nextAppeal.id && !archivedIds.has(a.id));
      await cfFetch('/api/db/settings/support_appeals', {
        method: 'PUT',
        body: JSON.stringify({
          value: [nextAppeal, ...historyToSave, ...filtered].slice(0, 150)
        })
      });
    } catch {}
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (existingAppeal?.lockedByAdmin) {
      await inAppAlert(
        'تم إغلاق التذكرة نهائياً من قِبل الدعم الفني بعد المراجعة ولا يمكن فتح تذكرة أخرى لنفس الطلب.',
        { type: 'warning' }
      );
      return;
    }

    const trimmed = messageInput.trim();
    if (!trimmed) {
      await inAppAlert('يرجى كتابة رسالتك أولاً قبل الضغط على إرسال.', {
        type: 'warning'
      });
      return;
    }

    // Clear the input box immediately so the message never stays stuck in the box
    setMessageInput('');
    setIsSubmitting(true);

    try {
      const nowIso = new Date().toISOString();
      const newMsg: SupportTicketMessage = {
        id: `MSG-${Date.now()}`,
        senderRole: 'merchant',
        senderName: currentUser.fullName,
        senderTitle: mode === 'store' ? 'مالك المتجر' : 'صاحب الحساب',
        text: trimmed,
        createdAt: nowIso
      };

      const nextMessages = [...chatMessages, newMsg];
      const ticketNum =
        existingAppeal?.ticketNumber ||
        `TKT-${String(Date.now()).slice(-4)}`;

      const nextAppeal: SupportAppeal = {
        id: existingAppeal?.id || `APPEAL-${Date.now()}`,
        ticketNumber: ticketNum,
        targetType: mode === 'store' ? 'store' : 'user',
        storeId: mode === 'store' ? activeStore?.id : undefined,
        storeName: mode === 'store' ? activeStore?.name : undefined,
        ownerPhone: currentUser.phone,
        ownerName: currentUser.fullName,
        message: trimmed,
        createdAt: existingAppeal?.createdAt || nowIso,
        status: 'pending',
        adminReply: existingAppeal?.adminReply,
        repliedAt: existingAppeal?.repliedAt,
        repliedByName: existingAppeal?.repliedByName,
        messages: nextMessages,
        autoCloseMinutes: existingAppeal?.autoCloseMinutes || 60,
        autoCloseAt: undefined,
        closedAt: undefined,
        closedBy: undefined,
        lockedByAdmin: false,
        reopenCount: existingAppeal?.reopenCount || 0
      };

      await persistAppealUpdate(nextAppeal);
    } catch {
      // Restore message if failed
      setMessageInput(trimmed);
      await inAppAlert('تعذر إرسال الرسالة، يرجى المحاولة مرة أخرى.', {
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reopen the SAME ticket so the merchant doesn't create multiple tickets for the same issue
  const handleReopenSameTicket = async () => {
    if (!existingAppeal) return;
    if (existingAppeal.lockedByAdmin) {
      await inAppAlert(
        'تم قفل هذه التذكرة نهائياً بواسطة إدارة الدعم الفني لمنع تكرار التذاكر لنفس الطلب.',
        { type: 'warning' }
      );
      return;
    }

    const nowIso = new Date().toISOString();
    const systemDivider: SupportTicketMessage = {
      id: `SYS-${Date.now()}`,
      senderRole: 'system',
      senderName: 'النظام',
      text: `تم إعادة فتح نفس التذكرة (#${existingAppeal.ticketNumber || 'TKT'}) بواسطة التاجر للمتابعة`,
      createdAt: nowIso,
      isSystemNotice: true
    };

    const reopenedAppeal: SupportAppeal = {
      ...existingAppeal,
      status: 'pending',
      autoCloseAt: undefined,
      closedAt: undefined,
      closedBy: undefined,
      reopenCount: (existingAppeal.reopenCount || 0) + 1,
      messages: [...chatMessages, systemDivider]
    };

    await persistAppealUpdate(reopenedAppeal);
  };

  // Archive closed ticket into supportTicketsHistory and open a new one (strictly limited so merchant can't spam multiple tickets)
  const handleArchiveAndOpenNewTicket = async () => {
    if (!existingAppeal) return;
    if (existingAppeal.lockedByAdmin) {
      await inAppAlert(
        'لا يمكن فتح تذكرة جديدة لهذا الطلب لأن إدارة الدعم الفني أغلقت التذكرة نهائياً.',
        { type: 'warning' }
      );
      return;
    }
    if (!isTicketClosed) {
      await inAppAlert(
        'لديك تذكرة مفتوحة بالفعل لهذا الطلب. يرجى المتابعة داخل نفس التذكرة الحالية لمنع تكرار التذاكر.',
        { type: 'warning' }
      );
      return;
    }
    if (ticketsHistory.length >= 2) {
      await inAppAlert(
        'عذراً، لقد وصلت للحد الأقصى للتذاكر المسموحة لنفس طلب الإيقاف. يمكنك فقط متابعة المحادثة في التذكرة الحالية لمنع تكرار التذاكر.',
        { type: 'warning' }
      );
      await handleReopenSameTicket();
      return;
    }

    const nowIso = new Date().toISOString();
    const archivedTicket: SupportAppeal = {
      ...existingAppeal,
      status: 'closed',
      closedAt: existingAppeal.closedAt || nowIso,
      closedBy: existingAppeal.closedBy || 'تمت الأرشفة عند فتح تذكرة متابعة'
    };

    const nextHistory = [
      archivedTicket,
      ...ticketsHistory.filter(h => h.id !== archivedTicket.id)
    ];

    const freshAppeal: SupportAppeal = {
      id: `APPEAL-${Date.now()}`,
      ticketNumber: `TKT-${String(Date.now()).slice(-4)}`,
      targetType: mode === 'store' ? 'store' : 'user',
      storeId: mode === 'store' ? activeStore?.id : undefined,
      storeName: mode === 'store' ? activeStore?.name : undefined,
      ownerPhone: currentUser.phone,
      ownerName: currentUser.fullName,
      message: '',
      createdAt: nowIso,
      status: 'pending',
      messages: [],
      autoCloseMinutes: 60
    };

    await persistAppealUpdate(freshAppeal, nextHistory);
    setExpandedHistoryId(archivedTicket.id);
    await inAppAlert(
      `تم حفظ التذكرة السابقة (#${archivedTicket.ticketNumber}) في سجل التذاكر المغلقة بالأسفل وفتح تذكرة متابعة جديدة (#${freshAppeal.ticketNumber}).`,
      { type: 'info' }
    );
  };

  const handleOpenWhatsAppSupport = () => {
    const subjectLine =
      mode === 'store' && activeStore
        ? `تذكرة مراجعة متجر موقوف: "${activeStore.name}" (${existingAppeal?.ticketNumber || activeStore.id})`
        : `تذكرة مراجعة حساب التاجر: ${currentUser.fullName}`;

    const lastMerchantMsg =
      [...chatMessages].reverse().find(m => m.senderRole === 'merchant')?.text || '';

    const details = [
      `مرحباً فريق الدعم الفني لمنصة عبده ميديا برايم 👋`,
      subjectLine,
      `• اسم التاجر: ${currentUser.fullName}`,
      `• رقم الهاتف المسجل: ${currentUser.phone}`,
      banReason ? `• سبب الإيقاف المسجل: ${banReason}` : '',
      lastMerchantMsg ? `• آخر رسالة بالتذكرة: ${lastMerchantMsg}` : 'أرجو المساعدة في مراجعة الحساب وإعادة التفعيل.'
    ]
      .filter(Boolean)
      .join('\n');

    const waUrl = buildSupportWhatsAppUrl(supportWhatsapp, details);
    window.location.href = waUrl;
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden bg-[#f7f8f4] text-slate-900 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans"
      dir="rtl"
    >
      {/* Brand Identity Soft Emerald & Lime Ambient Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-emerald-200/45 blur-3xl" />
        <div className="absolute top-1/3 -left-24 w-80 h-80 rounded-full bg-lime-200/35 blur-3xl" />
        <div className="absolute -bottom-28 right-1/4 w-96 h-96 rounded-full bg-emerald-100/50 blur-3xl" />
      </div>

      {/* Top Brand Header */}
      <header className="relative z-10 max-w-3xl w-full mx-auto flex items-center justify-between gap-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/20">
            <StoreIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-base sm:text-lg font-black tracking-tight text-slate-900">
              عبده ميديا برايم
            </p>
            <p className="text-[11px] font-bold text-emerald-700">
              AbdoMedia Prime • نظام تذاكر الدعم والمراجعة الفورية
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefreshStatus}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-sm text-xs font-black transition-all cursor-pointer disabled:opacity-60"
        >
          <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-emerald-600' : 'text-emerald-600'} />
          <span>{isRefreshing ? 'جاري التحديث...' : 'تحديث الحالة'}</span>
        </button>
      </header>

      {/* Main Content Card */}
      <main className="relative z-10 max-w-3xl w-full mx-auto my-auto py-2">
        <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] border border-emerald-100/90 shadow-[0_24px_70px_rgba(23,60,45,0.10)] overflow-hidden">
          {/* Top Brand Accent Bar */}
          <div className="h-2 w-full bg-gradient-to-l from-emerald-500 via-[#00c48c] to-amber-400" />

          <div className="p-5 sm:p-8 space-y-5">
            {/* Status Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-15 h-15 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shrink-0 shadow-sm">
                {mode === 'account' ? <ShieldAlert size={32} /> : <AlertTriangle size={32} />}
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-black">
                    {mode === 'store'
                      ? 'إيقاف إداري مؤقت للمتجر'
                      : mode === 'account'
                      ? 'تعليق إداري مؤقت للحساب'
                      : 'تنبيه لطاقم العمل'}
                  </span>

                  {existingAppeal?.ticketNumber && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-mono font-black tabular-nums">
                      #{existingAppeal.ticketNumber}
                    </span>
                  )}

                  {!isTicketClosed && existingAppeal?.status === 'pending' && chatMessages.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100/80 text-amber-900 border border-amber-300 text-xs font-black">
                      <Clock size={12} />
                      تذكرة مفتوحة — بانتظار رد الدعم
                    </span>
                  )}

                  {!isTicketClosed && existingAppeal?.status === 'replied' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-black shadow-sm">
                      <CheckCircle2 size={12} />
                      تم الرد من الدعم الفني
                    </span>
                  )}

                  {isTicketClosed && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-200 text-slate-800 border border-slate-300 text-xs font-black">
                      <Lock size={12} />
                      تذكرة مغلقة
                    </span>
                  )}
                </div>

                <h1 className="text-lg sm:text-2xl font-black text-slate-900 leading-snug">
                  {mode === 'store' && activeStore
                    ? `تم إيقاف متجر "${activeStore.name}" مؤقتاً من قِبل إدارة المنصة`
                    : mode === 'account'
                    ? 'تم تعليق صلاحية الحساب مؤقتاً من قِبل إدارة المنصة'
                    : 'هذا المتجر موقوف مؤقتاً من قِبل إدارة المنصة'}
                </h1>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                  {mode === 'store' && activeStore ? (
                    <>
                      مرحباً <strong>{currentUser.fullName}</strong>، المتجر موقوف حالياً بقرار من إدارة المنظومة ولا يمكن استقبال طلبات جديدة عليه حتى يتم مراجعته وإعادة تفعيله مع فريق الدعم الفني.
                    </>
                  ) : mode === 'account' ? (
                    <>
                      مرحباً <strong>{currentUser.fullName}</strong> (<span className="font-mono tabular-nums" dir="ltr">{currentUser.phone}</span>)، تم تعليق الحساب مؤقتاً بقرار من إدارة المنظومة. تواصل مع فريق الدعم الفني في الشات بالأسفل لحل المشكلة.
                    </>
                  ) : (
                    <>
                      تم إيقاف العمل على هذا المتجر مؤقتاً بقرار من إدارة المنظومة. يرجى من مالك المتجر التواصل مع الدعم الفني لإعادة التفعيل.
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Admin Ban Reason (if specified) */}
            {banReason && (
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <p className="font-black text-amber-900">سبب الإيقاف المسجل من إدارة المنصة:</p>
                  <p className="font-bold text-amber-800 leading-relaxed">{banReason}</p>
                </div>
              </div>
            )}

            {/* Support Ticket Live Chat Thread (for Store Owner) */}
            {mode !== 'employee' && (
              <div className="bg-[#f7f8f4] rounded-3xl border border-emerald-200/80 overflow-hidden shadow-inner">
                {/* Chat Window Header */}
                <div className="bg-white px-5 py-3.5 border-b border-emerald-100 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                      <Headphones size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-black text-slate-900">
                          محادثة تذكرة الدعم الفني والمراجعة
                        </h2>
                        {existingAppeal?.ticketNumber && (
                          <span className="text-[11px] font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 tabular-nums">
                            {existingAppeal.ticketNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-bold text-slate-500">
                        تواصل مباشر مع فريق دعم المنصة — تظهر الردود باسم مسؤول الدعم المختص
                      </p>
                    </div>
                  </div>

                  {/* Auto-close live timer badge when Support has replied */}
                  {!isTicketClosed && autoCloseRemainingMs !== null && autoCloseRemainingMs > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-black">
                      <Clock size={13} className="text-amber-600 animate-pulse" />
                      <span>تُغلق التذكرة تلقائياً بعد:</span>
                      <span className="font-mono tabular-nums text-amber-700" dir="ltr">
                        {formatRemainingTime(autoCloseRemainingMs)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Messages Stream */}
                <div className="p-4 sm:p-5 max-h-[320px] overflow-y-auto space-y-3.5">
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-8 px-4 space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center mx-auto">
                        <MessageSquare size={22} />
                      </div>
                      <p className="text-xs sm:text-sm font-black text-slate-700">
                        ابدأ المحادثة الآن مع فريق الدعم الفني
                      </p>
                      <p className="text-[11px] font-bold text-slate-500 max-w-md mx-auto leading-relaxed">
                        اكتب رسالتك أو استفسارك بالأسفل ليتم فتح تذكرة مراجعة فورية، وسيظهر رد موظف الدعم الفني هنا مباشرة تحت رسالتك.
                      </p>
                    </div>
                  ) : (
                    chatMessages.map(msg => {
                      if (msg.senderRole === 'system' || msg.isSystemNotice) {
                        return (
                          <div key={msg.id} className="flex items-center justify-center my-2">
                            <span className="px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-900 border border-emerald-200 text-[11px] font-black">
                              {msg.text}
                            </span>
                          </div>
                        );
                      }
                      const isMerchant = msg.senderRole === 'merchant';
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMerchant ? 'items-start' : 'items-end'}`}
                        >
                          <div
                            className={`max-w-[88%] sm:max-w-[78%] rounded-2xl p-3.5 shadow-sm border ${
                              isMerchant
                                ? 'bg-white border-slate-200/90 text-slate-900 rounded-tr-none'
                                : 'bg-emerald-600 text-white border-emerald-700 rounded-tl-none'
                            }`}
                          >
                            {/* Bubble Sender Header */}
                            <div className="flex items-center justify-between gap-3 mb-1.5 pb-1.5 border-b border-current/10">
                              <div className="flex items-center gap-1.5">
                                {isMerchant ? (
                                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
                                    <UserIcon size={11} />
                                  </span>
                                ) : (
                                  <span className="w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center">
                                    <ShieldCheck size={12} />
                                  </span>
                                )}
                                <span
                                  className={`text-[11px] font-black ${
                                    isMerchant ? 'text-slate-900' : 'text-white'
                                  }`}
                                >
                                  {msg.senderName}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    isMerchant
                                      ? 'bg-slate-100 text-slate-600'
                                      : 'bg-white/20 text-emerald-50'
                                  }`}
                                >
                                  {msg.senderTitle || (isMerchant ? 'مالك المتجر' : 'فريق الدعم الفني')}
                                </span>
                              </div>

                              <span
                                className={`text-[10px] font-mono tabular-nums ${
                                  isMerchant ? 'text-slate-400' : 'text-emerald-100'
                                }`}
                              >
                                {new Date(msg.createdAt).toLocaleTimeString('ar-EG', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>

                            {/* Bubble Message Text */}
                            <p className="text-xs sm:text-sm font-bold leading-relaxed whitespace-pre-wrap">
                              {msg.text}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Composer OR Closed Ticket Notice */}
                <div className="p-3.5 sm:p-4 bg-white border-t border-emerald-100">
                  {isTicketClosed ? (
                    existingAppeal?.lockedByAdmin ? (
                      <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-start gap-2.5 text-xs font-bold text-amber-900">
                          <Lock size={17} className="text-amber-700 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-black">
                              تم إغلاق هذه التذكرة نهائياً من قِبل الدعم الفني بعد المراجعة ({existingAppeal.closedBy || 'إدارة المنصة'})
                            </p>
                            <p className="text-[11px] text-amber-800 mt-0.5">
                              لمنع تكرار التذاكر لنفس الطلب، لا يمكن فتح تذكرة جديدة حتى يقوم الدعم الفني بإعادة فتحها أو تفعيل المتجر.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenWhatsAppSupport}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
                        >
                          <PhoneCall size={14} />
                          <span>تواصل عبر واتساب الدعم</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                        <div className="flex items-start gap-2.5 text-xs font-bold text-slate-600">
                          <Lock size={16} className="text-slate-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-black text-slate-800">
                              تم إغلاق التذكرة ({existingAppeal?.closedBy || 'بعد انتهاء مهلة الرد'})
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              لمنع فتح أكثر من تذكرة لنفس الطلب، يمكنك إعادة فتح نفس التذكرة للمتابعة، أو أرشفتها وفتح تذكرة متابعة جديدة.
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
                          <button
                            type="button"
                            onClick={handleReopenSameTicket}
                            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#00c48c] hover:bg-[#00b07d] text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                          >
                            <RotateCcw size={14} />
                            <span>إعادة فتح نفس التذكرة للمتابعة</span>
                          </button>
                          {ticketsHistory.length < 2 && chatMessages.length > 0 && (
                            <button
                              type="button"
                              onClick={handleArchiveAndOpenNewTicket}
                              className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            >
                              <PlusCircle size={14} />
                              <span>أرشفة وفتح تذكرة جديدة</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  ) : (
                    <form onSubmit={handleSendChatMessage} className="space-y-3">
                      <div className="flex items-end gap-2">
                        <textarea
                          rows={2}
                          value={messageInput}
                          onChange={e => setMessageInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (messageInput.trim() && !isSubmitting) {
                                void handleSendChatMessage(e as any);
                              }
                            }
                          }}
                          placeholder="اكتب رسالتك هنا لفريق الدعم الفني... (اضغط Enter للإرسال)"
                          className="flex-1 p-3 rounded-2xl bg-[#f7f8f4] border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none text-xs sm:text-sm font-bold text-slate-800 placeholder:text-slate-400 transition-all resize-none"
                        />
                        <button
                          type="submit"
                          disabled={isSubmitting || !messageInput.trim()}
                          className="h-[66px] px-5 rounded-2xl bg-[#00c48c] hover:bg-[#00b07d] text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-[#00c48c]/20 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          <Send size={16} />
                          <span>{isSubmitting ? 'يرسل...' : 'إرسال'}</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                        <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                          <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
                          <span>تذكرة موحدة لهذا الطلب — لا يُسمح بفتح أكثر من تذكرة نشطة في نفس الوقت لمنع التكرار.</span>
                        </span>
                        <button
                          type="button"
                          onClick={handleOpenWhatsAppSupport}
                          className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition-all cursor-pointer"
                        >
                          <PhoneCall size={13} />
                          <span>متابعة التذكرة عبر واتساب الدعم</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* Archived / Closed Previous Tickets Section (Shows where closed tickets go when a new one is opened) */}
            {mode !== 'employee' && ticketsHistory.length > 0 && (
              <div className="rounded-2xl bg-slate-50 border border-slate-200/90 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                    <History size={16} className="text-emerald-600" />
                    <span>سجل التذاكر المغلقة السابقة لهذا الطلب ({ticketsHistory.length})</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">
                    محفوظة للرجوع إليها عند الحاجة
                  </span>
                </div>

                <div className="space-y-2">
                  {ticketsHistory.map(oldTicket => {
                    const isExpanded = expandedHistoryId === oldTicket.id;
                    const oldMsgs = buildNormalizedTicketMessages(oldTicket, currentUser.fullName);
                    return (
                      <div
                        key={oldTicket.id}
                        className="rounded-xl bg-white border border-slate-200 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedHistoryId(isExpanded ? null : oldTicket.id)
                          }
                          className="w-full px-3.5 py-2.5 flex items-center justify-between text-right hover:bg-slate-50 transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] font-black tabular-nums">
                              #{oldTicket.ticketNumber || oldTicket.id.slice(-6)}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-black">
                              تذكرة مغلقة ({oldMsgs.length} رسائل)
                            </span>
                            {oldTicket.closedAt && (
                              <span className="text-[11px] font-bold text-slate-400 tabular-nums">
                                أُغلقت: {new Date(oldTicket.closedAt).toLocaleString('ar-EG')}
                              </span>
                            )}
                          </div>
                          {isExpanded ? (
                            <ChevronUp size={15} className="text-slate-400" />
                          ) : (
                            <ChevronDown size={15} className="text-slate-400" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="p-3 bg-[#f7f8f4] border-t border-slate-100 space-y-2 max-h-48 overflow-y-auto">
                            {oldMsgs.map(m => (
                              <div
                                key={m.id}
                                className={`p-2.5 rounded-xl text-xs border ${
                                  m.senderRole === 'merchant'
                                    ? 'bg-white border-slate-200 text-slate-800'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                                }`}
                              >
                                <div className="flex items-center justify-between text-[10px] font-black mb-1 opacity-75">
                                  <span>
                                    {m.senderName} ({m.senderTitle || (m.senderRole === 'merchant' ? 'التاجر' : 'الدعم الفني')})
                                  </span>
                                  <span className="font-mono tabular-nums">
                                    {new Date(m.createdAt).toLocaleTimeString('ar-EG', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                                <p className="font-bold whitespace-pre-wrap">{m.text}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer Navigation Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
              {mode === 'store' ? (
                <Link
                  to="/manage-stores"
                  className="w-full sm:w-auto flex-1 py-3 px-5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all"
                >
                  <ArrowRight size={16} />
                  <span>العودة لقائمة متاجري</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenWhatsAppSupport}
                  className="w-full sm:w-auto flex-1 py-3 px-5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <MessageSquare size={16} />
                  <span>التحدث مع خدمة العملاء عبر واتساب</span>
                </button>
              )}

              <button
                type="button"
                onClick={onLogout}
                className="w-full sm:w-auto py-3 px-6 rounded-2xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <LogOut size={15} />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Subtle Brand Footer */}
      <footer className="relative z-10 text-center text-[11px] font-bold text-slate-500 pt-2">
        منظومة عبده ميديا برايم للتجارة الإلكترونية • دعم فني متواصل لحماية واستقرار أعمالك
      </footer>
    </div>
  );
};

export default SuspendedAccountSupportScreen;
