import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, 
  ArrowRightLeft, 
  User, 
  Plus, 
  History, 
  CheckCircle2, 
  AlertCircle, 
  TrendingDown, 
  TrendingUp,
  Banknote,
  Search,
  Clock,
  ChevronDown,
  ChevronUp,
  Handshake,
  UserCheck,
  X,
  AlertTriangle,
  Info,
  Trash2,
  Landmark,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  RefreshCw,
  Layers,
  Users,
  ShieldAlert
} from 'lucide-react';
import { Settings, CashHolder, CashHandover, Treasury, TreasuryTransaction } from '../types';

interface CashManagementProps {
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
  currentUser: any;
  treasury?: Treasury;
  setTreasury?: (updater: any) => void;
  wallet?: any;
  setWallet?: (updater: any) => void;
}

const normalizeName = (name: string): string => {
  if (!name) return '';
  let normalized = name.trim().replace(/\s+/g, ' ');
  normalized = normalized.replace(/\s*\((شريك|موظف|المدير|شريكه|partner|employee|admin|أنت|انت)\)/gi, '');
  normalized = normalized.replace(/\s+(شريك|موظف|المدير|شريكه|partner|employee|admin)$/gi, '');
  normalized = normalized
    .replace(/أ/g, 'ا')
    .replace(/إ/g, 'ا')
    .replace(/آ/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .trim();
  if (/^(زهره)/.test(normalized)) {
      return 'زهره';
  }
  return normalized;
};

const CashManagement: React.FC<CashManagementProps> = ({ settings, updateSettings, currentUser, treasury, setTreasury, wallet, setWallet }) => {
  const [activeTab, setActiveTab] = useState<'balances' | 'handovers'>('balances');
  const [searchQuery, setSearchQuery] = useState('');
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [selectedHandover, setSelectedHandover] = useState<CashHandover | null>(null);

  // New Handover Form
  const [handoverType, setHandoverType] = useState<'holder' | 'treasury' | 'supply_wallet' | 'main_wallet'>('holder');
  const [newHandover, setNewHandover] = useState({
    fromUserId: '',
    toUserId: '',
    amount: 0,
    notes: ''
  });

  // Safe/Treasury Handover states
  const [showTreasuryModal, setShowTreasuryModal] = useState(false);
  const [selectedHolderForTreasury, setSelectedHolderForTreasury] = useState<CashHolder | null>(null);
  const [treasuryAmount, setTreasuryAmount] = useState(0);
  const [selectedTreasuryAccountId, setSelectedTreasuryAccountId] = useState('');
  const [treasuryNotes, setTreasuryNotes] = useState('');

  const [dialog, setDialog] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void, isWarning?: boolean} | null>(null);

  const holders = useMemo(() => {
    const rawHolders = settings.cashHolders || [];
    const grouped: Record<string, any> = {};
    
    rawHolders.forEach(h => {
        const name = normalizeName(h.userName);
        if (!grouped[name]) {
            grouped[name] = { 
              ...h, 
              userName: name,
              originalIds: [h.userId]
            };
        } else {
            grouped[name].currentBalance += (h.currentBalance || 0);
            if (!grouped[name].originalIds.includes(h.userId)) {
              grouped[name].originalIds.push(h.userId);
            }
            if (new Date(h.lastUpdated) > new Date(grouped[name].lastUpdated)) {
                grouped[name].lastUpdated = h.lastUpdated;
            }
        }
    });
    
    return Object.values(grouped);
  }, [settings.cashHolders]);

  const filteredHolders = useMemo(() => {
    if (!searchQuery.trim()) return holders;
    const query = searchQuery.toLowerCase().trim();
    return holders.filter(h => h.userName.toLowerCase().includes(query));
  }, [holders, searchQuery]);

  const handovers = useMemo(() => settings.cashHandovers || [], [settings.cashHandovers]);
  
  const filteredHandovers = useMemo(() => {
    if (!searchQuery.trim()) return handovers;
    const query = searchQuery.toLowerCase().trim();
    return handovers.filter(h => 
      h.fromUserName.toLowerCase().includes(query) ||
      h.toUserName.toLowerCase().includes(query) ||
      (h.notes && h.notes.toLowerCase().includes(query))
    );
  }, [handovers, searchQuery]);

  const employees = settings.employees || [];
  
  // Combine currentUser and employees for selection
  const allPossibleHolders = [
    { id: 'admin', name: 'المدير (أنت)', role: 'admin' },
    ...employees.map((e, index) => ({ id: `emp_${e.id || e.phone || index}`, name: e.name, role: 'employee' })),
    ...(settings.partners || []).map((p, index) => ({ id: `part_${p.id || index}`, name: p.name, role: 'partner' }))
  ];

  // Stats calculation
  const totalCustodyBalance = useMemo(() => {
    return holders.reduce((sum, h) => sum + (h.currentBalance || 0), 0);
  }, [holders]);

  const handleDeleteHandover = (handoverId: string) => {
    const handoverToDelete = handovers.find(h => h.id === handoverId);
    if (!handoverToDelete) return;

    setDialog({
      isOpen: true,
      title: 'تأكيد إلغاء وحذف العملية',
      message: `هل أنت متأكد من حذف عملية التسليم المالي بقيمة ${handoverToDelete.amount.toLocaleString()} ج.م؟ سيتم إلغاء الأثر وإعادة الأرصدة لوضعها السابق تلقائياً.`,
      isWarning: true,
      onConfirm: () => {
        const amount = Number(handoverToDelete.amount);
        const updatedHolders = [...holders];

        // 1. Revert source holder balance (increase it back)
        if (handoverToDelete.fromUserId && handoverToDelete.fromUserId !== 'system' && handoverToDelete.fromUserId !== 'customer') {
          const fromIdx = updatedHolders.findIndex(h => h.userId === handoverToDelete.fromUserId);
          if (fromIdx > -1) {
            updatedHolders[fromIdx] = {
              ...updatedHolders[fromIdx],
              currentBalance: (updatedHolders[fromIdx].currentBalance || 0) + amount,
              lastUpdated: new Date().toISOString()
            };
          }
        }

        // 2. Revert destination
        if (handoverToDelete.toUserId?.startsWith('treasury_')) {
          const targetAccountId = handoverToDelete.toUserId.replace('treasury_', '');
          if (setTreasury) {
            setTreasury((prev: any) => {
              if (!prev) return prev;
              const currentAccounts = prev.accounts || [];
              const updatedAccounts = currentAccounts.map((acc: any) => 
                acc.id === targetAccountId ? { ...acc, balance: Math.max(0, Number(acc.balance || 0) - amount) } : acc
              );
              const updatedTransactions = (prev.transactions || []).filter(
                (tx: any) => tx.reference !== handoverId && !tx.description?.includes(handoverId)
              );
              return {
                ...prev,
                accounts: updatedAccounts,
                transactions: updatedTransactions
              };
            });
          }
        } else if (handoverToDelete.toUserId === 'supply_wallet') {
          if (setWallet) {
            setWallet((prev: any) => {
              if (!prev) return prev;
              const updatedTransactions = (prev.transactions || []).filter(
                 (tx: any) => !tx.id?.includes(handoverId) && !tx.note?.includes(handoverId)
              );
              return {
                ...prev,
                supplyBalance: Math.max(0, (prev.supplyBalance || 0) - amount),
                transactions: updatedTransactions
              };
            });
          }
        } else if (handoverToDelete.toUserId) {
          // Revert destination holder balance (decrease it)
          const toIdx = updatedHolders.findIndex(h => h.userId === handoverToDelete.toUserId);
          if (toIdx > -1) {
            updatedHolders[toIdx] = {
              ...updatedHolders[toIdx],
              currentBalance: (updatedHolders[toIdx].currentBalance || 0) - amount,
              lastUpdated: new Date().toISOString()
            };
          }
        }

        // 3. Update settings
        updateSettings({
          ...settings,
          cashHolders: updatedHolders,
          cashHandovers: handovers.filter(h => h.id !== handoverId),
          activityLogs: [
            {
              id: `log-${Date.now()}`,
              user: currentUser?.fullName || 'المدير',
              action: 'حذف عملية تسليم مالي',
              details: `تم حذف عملية تسليم مالي بقيمة ${amount} ج.م من عهدة ${handoverToDelete.fromUserName} إلى ${handoverToDelete.toUserName} وتعديل الأرصدة المرتبطة.`,
              date: new Date().toLocaleString('ar-EG'),
              timestamp: Date.now()
            },
            ...(settings.activityLogs || [])
          ]
        });

        setDialog(null);
      }
    });
  };

  const handleExecuteHandover = () => {
    if (handoverType !== 'supply_wallet' && !newHandover.toUserId) {
      return setDialog({
        isOpen: true,
        title: 'تنبيه النطاق',
        message: handoverType === 'treasury' ? 'يرجى اختيار الحساب المستلم (الخزينة)' : 'يرجى اختيار المستلم المطلوب',
        onConfirm: () => setDialog(null)
      });
    }
    if (newHandover.amount <= 0) {
      return setDialog({
        isOpen: true,
        title: 'تنبيه القيمة',
        message: 'يرجى تحديد المبلغ المراد تسليمه بدقة محاسبية صحيحة',
        onConfirm: () => setDialog(null)
      });
    }

    const amount = Number(newHandover.amount);
    
    // Determine source
    const fromUserId = newHandover.fromUserId || currentUser?.id || 'admin';
    const fromUser = allPossibleHolders.find(h => h.id === fromUserId);
    const fromUserName = fromUser?.name || currentUser?.fullName || 'المدير';

    const handoverId = `HND-${Date.now()}`;
    let toUserName = '';
    
    if (handoverType === 'supply_wallet') {
      toUserName = 'محفظة التوريد (رأس مال المخزون)';
    } else if (handoverType === 'treasury') {
      const targetAccount = (treasury?.accounts || []).find((acc: any) => acc.id === newHandover.toUserId);
      if (!targetAccount) return setDialog({ isOpen: true, title: 'خطأ وعاء', message: 'الحساب المالي المحدد غير موجود في شجرة الحسابات', onConfirm: () => setDialog(null) });
      toUserName = `الخزينة: ${targetAccount.name}`;
    } else {
      const toUser = allPossibleHolders.find(h => h.id === newHandover.toUserId);
      toUserName = toUser?.name || 'مستخدم غير معروف';
      if (fromUserId === newHandover.toUserId) {
        return setDialog({ isOpen: true, title: 'منع تحويل', message: 'لا يمكن تسليم العهدة المالية لنفس الشخص والمستفيد', onConfirm: () => setDialog(null) });
      }
    }

    const handoverData: CashHandover = {
      id: handoverId,
      fromUserId,
      fromUserName,
      toUserId: handoverType === 'treasury' ? `treasury_${newHandover.toUserId}` : handoverType === 'supply_wallet' ? 'supply_wallet' : newHandover.toUserId,
      toUserName,
      amount,
      date: new Date().toISOString(),
      notes: newHandover.notes,
      status: 'completed'
    };

    // Update balances
    const updatedHolders = [...(settings.cashHolders || [])];
    
    // Decrease from source
    const normalizedFromName = normalizeName(fromUserName);
    const fromIdx = updatedHolders.findIndex(h => normalizeName(h.userName) === normalizedFromName);
    if (fromIdx > -1) {
      updatedHolders[fromIdx].currentBalance -= amount;
      updatedHolders[fromIdx].lastUpdated = handoverData.date;
    } else {
      updatedHolders.push({ userId: fromUserId, userName: fromUserName, currentBalance: -amount, lastUpdated: handoverData.date });
    }

    // Increase destination
    if (handoverType === 'treasury') {
      // Update Treasury State
      if (setTreasury) {
        const treasuryTxId = `tx-custody-deposit-${Date.now()}`;
        setTreasury((prev: any) => {
          if (!prev) return prev;
          const currentAccounts = prev.accounts || [];
          const updatedAccounts = currentAccounts.map((acc: any) => 
            acc.id === newHandover.toUserId ? { ...acc, balance: Number(acc.balance || 0) + amount } : acc
          );
          const treasuryTx: TreasuryTransaction = {
            id: treasuryTxId,
            date: new Date().toISOString(),
            type: 'deposit',
            amount,
            description: `توريد عهدة نقدية من: ${fromUserName}`,
            toAccountId: newHandover.toUserId,
            reference: handoverId
          };
          return {
            ...prev,
            accounts: updatedAccounts,
            transactions: [treasuryTx, ...(prev.transactions || [])]
          };
        });
      }
    } else if (handoverType === 'supply_wallet' || handoverType === 'main_wallet') {
      // Update Wallets
      if (setWallet) {
        setWallet((prev: any) => {
          const isMain = handoverType === 'main_wallet';
          const walletTx = {
            id: `HND-${Date.now()}`,
            type: 'إيداع',
            amount,
            date: new Date().toISOString(),
            note: `توريد عهدة نقدية من ${fromUserName} إلى ${isMain ? 'المحفظة العامة' : 'محفظة التوريد'}: ${newHandover.notes || ''}`,
            category: isMain ? 'general_deposit' : 'supply_funding',
            status: 'completed'
          };
          return {
            ...prev,
            balance: isMain ? (Number(prev.balance) || 0) + amount : prev.balance,
            supplyBalance: !isMain ? (Number(prev.supplyBalance) || 0) + amount : prev.supplyBalance,
            transactions: [walletTx, ...(prev.transactions || [])]
          };
        });
      }
    } else {
      // Increase to destination holder
      const normalizedToName = normalizeName(handoverData.toUserName);
      const toIdx = updatedHolders.findIndex(h => normalizeName(h.userName) === normalizedToName);
      if (toIdx > -1) {
        updatedHolders[toIdx].currentBalance += amount;
        updatedHolders[toIdx].lastUpdated = handoverData.date;
      } else {
        updatedHolders.push({ userId: handoverData.toUserId, userName: handoverData.toUserName, currentBalance: amount, lastUpdated: handoverData.date });
      }
    }

    updateSettings({
      ...settings,
      cashHolders: updatedHolders,
      cashHandovers: [handoverData, ...handovers],
      activityLogs: [
        {
          id: `log-${Date.now()}`,
          user: fromUserName,
          action: handoverType === 'treasury' ? 'توريد عهدة للخزينة' : (handoverType === 'main_wallet' || handoverType === 'supply_wallet') ? 'توريد عهدة للمحفظة' : 'تسليم نقدية بالعهدة',
          details: handoverType === 'treasury' 
            ? `توريد مبلغ ${amount} ج.م من عهدة ${fromUserName} إلى حساب ${toUserName}`
            : (handoverType === 'main_wallet' || handoverType === 'supply_wallet')
            ? `توريد مبلغ ${amount} ج.م من عهدة ${fromUserName} إلى ${handoverType === 'main_wallet' ? 'المحفظة العامة' : 'محفظة التوريد'}`
            : `تسليم مبلغ ${amount} ج.م من عهدة ${fromUserName} إلى ${handoverData.toUserName}`,
          date: new Date().toLocaleString('ar-EG'),
          timestamp: Date.now()
        },
        ...(settings.activityLogs || [])
      ]
    });

    setShowHandoverModal(false);
    setNewHandover({ fromUserId: '', toUserId: '', amount: 0, notes: '' });
  };

  const handleExecuteTreasuryDeposit = () => {
    if (!selectedHolderForTreasury) return;
    if (!selectedTreasuryAccountId) return setDialog({ isOpen: true, title: 'تنبيه وعاء المالي', message: 'يرجى اختيار خزينة أو محفظة للتوريد والإيداع المباشر', onConfirm: () => setDialog(null) });
    if (treasuryAmount <= 0) return setDialog({ isOpen: true, title: 'مبلغ غير مقبول', message: 'يرجى تحديد المبلغ المراد توريده بشكل صحيح', onConfirm: () => setDialog(null) });

    const amount = Number(treasuryAmount);
    const isSupplyWallet = selectedTreasuryAccountId === 'supply_wallet';
    const isMainWallet = selectedTreasuryAccountId === 'main_wallet';
    
    let toUserName = '';
    if (isSupplyWallet) {
      toUserName = 'محفظة التوريد (رأس مال المخزون)';
    } else if (isMainWallet) {
      toUserName = 'المحفظة العامة (الرصيد الأساسي)';
    } else {
      const treasuryAccountsList = treasury?.accounts || [];
      const targetAccount = treasuryAccountsList.find((acc: any) => acc.id === selectedTreasuryAccountId);
      if (!targetAccount) return setDialog({ isOpen: true, title: 'خطأ وعاء مالي', message: 'الحساب المالي المحدد غير موجود بالخزينة', onConfirm: () => setDialog(null) });
      toUserName = `الخزينة: ${targetAccount.name}`;
    }

    const handoverId = `HND-TR-${Date.now()}`;
    const handoverData: CashHandover = {
      id: handoverId,
      fromUserId: selectedHolderForTreasury.userId,
      fromUserName: selectedHolderForTreasury.userName,
      toUserId: isSupplyWallet ? 'supply_wallet' : isMainWallet ? 'main_wallet' : `treasury_${selectedTreasuryAccountId}`,
      toUserName,
      amount,
      date: new Date().toISOString(),
      notes: treasuryNotes ? `توريد مالي لمستودع التوريد: ${treasuryNotes}` : `تسليم مالي وتوريد عهدة للخزينة/المحفظة (${toUserName})`,
      status: 'completed'
    };

    // Update Cash Holders balances
    const updatedHolders = (settings.cashHolders || []).map(h => {
      if (normalizeName(h.userName) === normalizeName(selectedHolderForTreasury.userName)) {
        return {
          ...h,
          currentBalance: h.currentBalance - amount,
          lastUpdated: handoverData.date
        };
      }
      return h;
    });

    // Update Destination state
    if (isSupplyWallet || isMainWallet) {
      if (setWallet) {
        setWallet((prev: any) => {
          const walletTx = {
            id: `TR-CUSTODY-${Date.now()}`,
            type: 'إيداع',
            amount,
            date: new Date().toISOString(),
            note: `توريد عهدة نقدية من الموظف/الشريك ${selectedHolderForTreasury.userName} إلى ${isMainWallet ? 'المحفظة العامة' : 'محفظة التوريد'}: ${treasuryNotes || ''}`,
            category: isMainWallet ? 'general_deposit' : 'supply_funding',
            status: 'completed'
          };
          return {
            ...prev,
            balance: isMainWallet ? (Number(prev.balance) || 0) + amount : prev.balance,
            supplyBalance: !isMainWallet ? (Number(prev.supplyBalance) || 0) + amount : prev.supplyBalance,
            transactions: [walletTx, ...(prev.transactions || [])]
          };
        });
      }
    } else {
      // Update Treasury State
      if (setTreasury) {
        const treasuryTxId = `tx-custody-deposit-${Date.now()}`;
        setTreasury((prev: any) => {
          if (!prev) return prev;
          const currentAccounts = prev.accounts || [];
          const updatedAccounts = currentAccounts.map((acc: any) => 
            acc.id === selectedTreasuryAccountId ? { ...acc, balance: Number(acc.balance || 0) + amount } : acc
          );
          const treasuryTx: TreasuryTransaction = {
            id: treasuryTxId,
            date: new Date().toISOString(),
            type: 'deposit',
            amount,
            description: `توريد عهدة نقدية من الموظف: ${selectedHolderForTreasury.userName}`,
            toAccountId: selectedTreasuryAccountId,
            reference: handoverId
          };
          return {
            ...prev,
            accounts: updatedAccounts,
            transactions: [treasuryTx, ...(prev.transactions || [])]
          };
        });
      }
    }

    updateSettings({
      ...settings,
      cashHolders: updatedHolders,
      cashHandovers: [handoverData, ...handovers],
      activityLogs: [
        {
          id: `log-${Date.now()}`,
          user: currentUser?.fullName || 'المدير',
          action: 'توريد عهدة للخزينة',
          details: `تم توريد مبلغ ${amount} ج.م من عهدة الموظف ${selectedHolderForTreasury.userName} إلى ${toUserName}`,
          date: new Date().toLocaleString('ar-EG'),
          timestamp: Date.now()
        },
        ...(settings.activityLogs || [])
      ]
    });

    setShowTreasuryModal(false);
    setSelectedHolderForTreasury(null);
    setTreasuryAmount(0);
    setTreasuryNotes('');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto font-sans text-right" dir="rtl">
      
      {/* Modern High-End Header */}
      <div id="cashmgmt-header" className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 rounded-lg">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse"></span>
              <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                منظومة إدارة عهد وتحصيل الموظفين والشركاء
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center shadow-sm">
                <Handshake className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  العهد والنقدية المحصلة
                </h1>
                <p className="text-slate-450 dark:text-slate-500 text-[11px] sm:text-xs font-medium leading-relaxed mt-0.5">
                  توثيق شامل وتنظيم النقدية المستلمة والموزعة مع المندوبين، الكاشيرية، والشركاء مع ربط فوري بدفاتر الخزينة والمحافظ.
                </p>
              </div>
            </div>
          </div>

          {/* Premium Tab Switcher & Action */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-1">
              <button 
                id="tab-balances"
                onClick={() => setActiveTab('balances')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'balances' 
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' 
                    : 'text-slate-550 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <UserCheck size={13} />
                <span>العهد الحالية</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  activeTab === 'balances' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {holders.length}
                </span>
              </button>
              <button 
                id="tab-handovers"
                onClick={() => setActiveTab('handovers')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'handovers' 
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' 
                    : 'text-slate-550 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <History size={13} />
                <span>سجل التسليمات</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  activeTab === 'handovers' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {handovers.length}
                </span>
              </button>
            </div>

            <button 
              id="btn-register-handover"
              onClick={() => {
                setNewHandover({
                  fromUserId: currentUser?.id || 'admin',
                  toUserId: '',
                  amount: 0,
                  notes: ''
                });
                setHandoverType('holder');
                setShowHandoverModal(true);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus size={14} />
              <span>تسجيل تسليم مبلغ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Corporate Glassmorphic Stats Deck */}
      <div id="cash-stats-deck" className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        
        {/* Stat 1: Total custody balance */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[10rem]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none"></div>
          <div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">إجمالي النقدية المتداولة بالعهد</span>
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Banknote className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight tabular-nums">
                {totalCustodyBalance.toLocaleString('ar-EG')}
              </span>
              <span className="text-xs font-bold text-slate-400">ج.م</span>
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-3 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            النقدية المتبقية عهدة في ذمة المندوبين والشركاء
          </p>
        </div>

        {/* Stat 2: Active holders */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[10rem]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none"></div>
          <div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">أصحاب حسابات العهد</span>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight tabular-nums">
                {holders.length}
              </span>
              <span className="text-xs font-bold text-slate-400">حسابات نشطة</span>
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-3 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
            أفراد وشركاء لديهم عهد مالية نشطة بالمنظومة
          </p>
        </div>

        {/* Stat 3: Total documented handovers */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[10rem]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-bl-full pointer-events-none"></div>
          <div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">تحويلات نقدية موثقة</span>
              <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight tabular-nums">
                {handovers.length}
              </span>
              <span className="text-xs font-bold text-slate-400">عملية تسليم</span>
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-3 flex items-center gap-1">
            <History className="w-3.5 h-3.5 text-purple-500" />
            تحويلات وعمليات تصفية عهد مسجلة وموثقة
          </p>
        </div>

      </div>

      {/* Search Bar */}
      <div id="search-filter-row" className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder={activeTab === 'balances' ? "البحث برقم الهاتف أو اسم صاحب العهدة..." : "البحث في مذكرات وملاحظات سجل التحويلات..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white pr-10 pl-4 py-2.5 rounded-xl text-xs font-bold border-0 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              مسح
            </button>
          )}
        </div>
      </div>

      {/* Main Container Pages with AnimatePresence */}
      <AnimatePresence mode="wait">
        {activeTab === 'balances' ? (
          <motion.div 
            key="balances"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {filteredHolders.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800">
                <Banknote className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                <h3 className="text-slate-800 dark:text-slate-200 font-black text-base">لا توجد سجلات عهد نقدية مطابقة</h3>
                <p className="text-slate-400 text-xs font-semibold mt-1">
                  {searchQuery ? 'لم يتم العثور على صاحب عهدة بهذا الاسم' : 'اضغط على زر "تسجيل تسليم مبلغ" لإنشاء أول عهدة موظف بالمنظومة'}
                </p>
              </div>
            ) : (
              <div id="holders-cards-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredHolders.map(holder => {
                  const isPositive = holder.currentBalance >= 0;
                  const isManager = holder.userId === 'admin' || holder.originalIds?.includes('admin') || holder.userName === 'المدير' || holder.userName === 'المدير (أنت)';
                  const isPartner = settings?.partners?.find(p => p.id === holder.userId || holder.originalIds?.includes(p.id) || holder.originalIds?.includes(`part_${p.id}`) || holder.originalIds?.includes(`partner_${p.id}`) || normalizeName(p.name) === holder.userName);
                  const isEmployee = settings?.employees?.find(e => e.id === holder.userId || holder.originalIds?.includes(e.id) || holder.originalIds?.includes(`emp_${e.id}`) || holder.originalIds?.includes(`employee_${e.id}`) || normalizeName(e.name) === holder.userName);

                  return (
                    <div 
                      key={holder.userId} 
                      className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/30 dark:hover:border-indigo-500/30 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between min-h-[14rem] relative group"
                    >
                      <div>
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 group-hover:scale-105 transition-transform shrink-0">
                              <User className="w-4 h-4" />
                            </div>
                            <div className="truncate">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm truncate max-w-[120px]">
                                  {holder.userName}
                                </h3>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0 ${
                                  isManager ? 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 border-purple-100 dark:border-purple-900/40' :
                                  isPartner ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 border-amber-100 dark:border-amber-900/40' :
                                  'bg-slate-50 dark:bg-slate-950 text-slate-500 border-slate-150 dark:border-slate-800'
                                }`}>
                                  {isManager ? 'المدير' : isPartner ? 'شريك' : isEmployee ? 'موظف' : 'عهدة'}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {new Date(holder.lastUpdated).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                          </div>

                          <button 
                            onClick={() => {
                              setDialog({ 
                                isOpen: true, 
                                title: 'تأكيد حذف حساب عهدة', 
                                message: `هل أنت متأكد من تصفية وحذف سجل حساب العهدة المالية التابع للموظف (${holder.userName})؟ سيتم مسح بياناته من لائحة العهد النشطة.`, 
                                isWarning: true, 
                                onConfirm: () => { 
                                  const updatedHolders = holders.filter(h => h.userId !== holder.userId); 
                                  updateSettings({ ...settings, cashHolders: updatedHolders }); 
                                  setDialog(null); 
                                } 
                              });
                            }}
                            className="p-1 text-slate-450 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all cursor-pointer shrink-0"
                            title="إلغاء حساب العهدة"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        {/* Balance display */}
                        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/40 rounded-xl p-3.5 mb-4">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-0.5">الرصيد الجاري بالعهدة</span>
                          <div className="flex items-baseline gap-1.5">
                            <span className={`text-xl font-extrabold tabular-nums tracking-tight ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {holder.currentBalance.toLocaleString('ar-EG')}
                            </span>
                            <span className="text-[10px] font-bold text-slate-450">ج.م</span>
                          </div>
                        </div>
                      </div>

                      {/* Premium Card Actions */}
                      {(currentUser?.isAdmin || currentUser?.id === holder.userId) && (
                        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <button 
                            onClick={() => {
                              setSelectedHolderForTreasury(holder);
                              setTreasuryAmount(holder.currentBalance > 0 ? holder.currentBalance : 0);
                              setTreasuryNotes('');
                              if (treasury?.accounts && treasury.accounts.length > 0) {
                                setSelectedTreasuryAccountId(treasury.accounts[0].id);
                              } else {
                                setSelectedTreasuryAccountId('');
                              }
                              setShowTreasuryModal(true);
                            }}
                            className="py-2 px-2.5 bg-emerald-50 hover:bg-emerald-100/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer border border-emerald-100/50 dark:border-emerald-900/30"
                            title="تسليم وتصفية النقدية للخزائن"
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            <span>تصفية للخزينة</span>
                          </button>
                          
                          <button 
                            onClick={() => {
                              setNewHandover({
                                fromUserId: holder.userId,
                                toUserId: '',
                                amount: holder.currentBalance > 0 ? holder.currentBalance : 0,
                                notes: ''
                              });
                              setHandoverType('holder');
                              setShowHandoverModal(true);
                            }}
                            className="py-2 px-2.5 bg-indigo-50 hover:bg-indigo-100/60 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer border border-indigo-100/50 dark:border-indigo-900/30"
                            title="تحويل العهدة النقدية لطرف آخر"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            <span>تحويل عهدة</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : (
          /* Handovers History List */
          <motion.div 
            key="handovers"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {filteredHandovers.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800">
                <History className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                <h3 className="text-slate-800 dark:text-slate-200 font-black text-base">لا توجد عمليات تحويل مسجلة</h3>
                <p className="text-slate-400 text-xs font-semibold mt-1">تُسجل وتوثق هنا كافة عمليات نقل النقدية والتسليم المعتمدة</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-500" />
                    دفتر قيد ومراجعة عمليات النقدية والتحويل
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    عدد السجلات: {filteredHandovers.length} سجل
                  </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredHandovers.map(h => (
                    <div 
                      key={h.id} 
                      className="p-4 sm:p-5 hover:bg-slate-50/50 dark:hover:bg-slate-950/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-800">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-slate-900 dark:text-white text-sm">{h.fromUserName}</span>
                            <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500 rotate-180 shrink-0" />
                            <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">{h.toUserName}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {new Date(h.date).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                            {(h.notes || (h as any).note) && (
                              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 px-2.5 py-0.5 rounded-md truncate max-w-xs">
                                "{h.notes || (h as any).note}"
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 px-3.5 py-1.5 rounded-xl text-emerald-700 dark:text-emerald-400 font-black text-sm tabular-nums flex items-baseline gap-1">
                          {h.amount.toLocaleString('ar-EG')}
                          <span className="text-[10px] font-bold">ج.م</span>
                        </div>

                        <button
                          onClick={() => handleDeleteHandover(h.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer shrink-0"
                          title="حذف السجل وعكس ميزانية الرصيد"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Handover Modal */}
      {showHandoverModal && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-5 sm:p-6 shadow-xl relative border border-slate-150 dark:border-slate-800 text-right" 
            dir="rtl"
          >
            <button 
              onClick={() => setShowHandoverModal(false)}
              className="absolute left-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
            
            <div className="flex items-center gap-3 mb-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">تسجيل تسليم أو تحويل مالي</h3>
                <p className="text-slate-400 dark:text-slate-500 text-[10px] font-medium">نقل وتدوين الأرصدة والسيولة بين العهد أو الخزائن المعتمدة</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Target Selector Buttons */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                  فئة الحساب المالي الجاري تحويله له
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setHandoverType('holder');
                      setNewHandover({ ...newHandover, toUserId: '' });
                    }}
                    className={`py-1.5 px-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      handoverType === 'holder' 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                        : 'bg-slate-550 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-150 dark:border-slate-800'
                    }`}
                  >
                    عهدة
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHandoverType('treasury');
                      setNewHandover({ ...newHandover, toUserId: treasury?.accounts?.[0]?.id || '' });
                    }}
                    className={`py-1.5 px-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      handoverType === 'treasury' 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                        : 'bg-slate-550 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-150 dark:border-slate-800'
                    }`}
                  >
                    خزينة
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHandoverType('main_wallet');
                      setNewHandover({ ...newHandover, toUserId: 'main_wallet' });
                    }}
                    className={`py-1.5 px-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      handoverType === 'main_wallet' 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                        : 'bg-slate-550 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-150 dark:border-slate-800'
                    }`}
                  >
                    المحفظة
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHandoverType('supply_wallet');
                      setNewHandover({ ...newHandover, toUserId: 'supply_wallet' });
                    }}
                    className={`py-1.5 px-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      handoverType === 'supply_wallet' 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                        : 'bg-slate-550 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-150 dark:border-slate-800'
                    }`}
                  >
                    التوريد
                  </button>
                </div>
              </div>

              {currentUser?.isAdmin && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                    المسلِّم (صاحب العهدة المانحة)
                  </label>
                  <select 
                    value={newHandover.fromUserId || (currentUser?.id || 'admin')}
                    onChange={(e) => setNewHandover({...newHandover, fromUserId: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 h-10 px-3 rounded-lg font-bold text-xs outline-none focus:border-indigo-500 transition-colors text-right text-slate-900 dark:text-white"
                  >
                    {allPossibleHolders.map((h, index) => (
                      <option key={'from_' + h.id + index} value={h.id}>{h.name} ({h.role === 'admin' ? 'المدير' : h.role === 'partner' ? 'شريك' : 'موظف'})</option>
                    ))}
                  </select>
                </div>
              )}

              {handoverType !== 'supply_wallet' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                    {handoverType === 'treasury' ? 'الخزينة أو الحساب المالي المستلم' : 'الطرف المستلم'}
                  </label>
                  <select 
                    value={newHandover.toUserId}
                    onChange={(e) => setNewHandover({...newHandover, toUserId: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 h-10 px-3 rounded-lg font-bold text-xs outline-none focus:border-indigo-500 transition-colors text-right text-slate-900 dark:text-white"
                  >
                    {handoverType === 'treasury' ? (
                      <>
                        <option value="">-- اختر خزينة الإيداع المالي --</option>
                        {(treasury?.accounts || []).map((acc: any) => (
                          <option key={'treasury_acc_' + acc.id} value={acc.id}>
                            {acc.name} (رصيد جاري: {acc.balance.toLocaleString()} ج.م)
                          </option>
                        ))}
                      </>
                    ) : (
                      <>
                        <option value="">-- اختر الطرف المالي المستلم --</option>
                        {allPossibleHolders.map((h, index) => (
                          <option key={'to_' + h.id + index} value={h.id}>{h.name} ({h.role === 'admin' ? 'المدير' : h.role === 'partner' ? 'شريك' : 'موظف'})</option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                  المبلغ المراد تسليمه (ج.م)
                </label>
                <div className="relative">
                  <input 
                    type="number"
                    value={newHandover.amount || ''}
                    onChange={(e) => setNewHandover({...newHandover, amount: Number(e.target.value)})}
                    placeholder="0"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 h-10 pl-10 pr-3 rounded-lg font-extrabold text-sm outline-none text-right focus:border-indigo-500 transition-colors text-slate-900 dark:text-white"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">ج.م</span>
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                  المذكرة / البيان والملاحظات
                </label>
                <textarea 
                  placeholder="مثال: توريد تسوية نقدية لليوم، عهدة مصاريف تشغيلية..."
                  value={newHandover.notes}
                  onChange={(e) => setNewHandover({...newHandover, notes: e.target.value})}
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 p-2.5 rounded-lg font-bold text-xs outline-none text-right focus:border-indigo-500 transition-colors text-slate-900 dark:text-white resize-none"
                />
              </div>

              <div className="pt-3.5 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button 
                  type="button"
                  onClick={() => setShowHandoverModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-755 dark:text-slate-300 rounded-lg font-bold text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  type="button"
                  onClick={handleExecuteHandover}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-lg font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  تأكيد التسليم المالي
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}


      {/* Treasury Settlement Modal */}
      {showTreasuryModal && selectedHolderForTreasury && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl relative border border-slate-200 dark:border-slate-800 text-right" 
            dir="rtl"
          >
            <button 
              onClick={() => {
                setShowTreasuryModal(false);
                setSelectedHolderForTreasury(null);
              }}
              className="absolute left-6 top-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">تسوية وتصفية العهد للخزينة</h3>
                <p className="text-slate-400 text-xs font-semibold">تسوية الرصيد المالي وتوريده للخزائن الرسمية للموظف ({selectedHolderForTreasury.userName})</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-450 mb-1.5">
                  الحساب المالي المستلم (الوعاء المالي النهائي)
                </label>
                <select 
                  value={selectedTreasuryAccountId}
                  onChange={(e) => setSelectedTreasuryAccountId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 h-11 px-3 rounded-xl font-bold text-xs outline-none focus:border-indigo-500 text-right text-slate-900 dark:text-white"
                >
                  <option value="">-- اختر وعاء الاستلام --</option>
                  <optgroup label="المحافظ والموازنة العامة">
                     <option value="main_wallet">المحفظة العامة (الرصيد: {Number(wallet?.balance || 0).toLocaleString()} ج.م)</option>
                     <option value="supply_wallet">محفظة التوريد (الرصيد: {Number(wallet?.supplyBalance || 0).toLocaleString()} ج.م)</option>
                  </optgroup>
                  <optgroup label="الخزائن البنكية والنقدية">
                    {(treasury?.accounts || []).map((acc: any) => (
                      <option key={acc.id} value={acc.id}>{acc.name} (رصيد جاري: {Number(acc.balance || 0).toLocaleString()} ج.م)</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-450">المبلغ المراد توريده وتصفيته</label>
                  <button 
                    type="button" 
                    onClick={() => setTreasuryAmount(selectedHolderForTreasury.currentBalance)}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 font-extrabold hover:underline cursor-pointer"
                  >
                    تصفية كامل العهدة ({selectedHolderForTreasury.currentBalance.toLocaleString()} ج.م)
                  </button>
                </div>
                <div className="relative">
                  <input 
                    type="number"
                    value={treasuryAmount || ''}
                    onChange={(e) => setTreasuryAmount(Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 h-11 pl-12 pr-3 rounded-xl font-black text-base outline-none text-right focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold text-xs">ج.م</span>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-450 mb-1.5">
                  بيان وتفاصيل التسوية
                </label>
                <textarea 
                  placeholder="مثال: تسوية وتصفية جزئية لعهد اليوم، توريد نقدية..."
                  value={treasuryNotes}
                  onChange={(e) => setTreasuryNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-3 rounded-xl font-bold text-xs outline-none text-right focus:border-indigo-500 text-slate-900 dark:text-white resize-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button 
                  type="button"
                  onClick={() => {
                    setShowTreasuryModal(false);
                    setSelectedHolderForTreasury(null);
                  }}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-750 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  type="button"
                  onClick={handleExecuteTreasuryDeposit}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-black text-xs transition-all shadow-md shadow-emerald-600/10 cursor-pointer"
                >
                  تأكيد تسوية العهدة
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Corporate Custom Global Dialog */}
      {dialog && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl text-right border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-150" dir="rtl">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border ${dialog.isWarning ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/30 dark:text-rose-450 dark:border-rose-900/40' : 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/40'}`}>
              {dialog.isWarning ? <ShieldAlert className="w-6 h-6 animate-pulse" /> : <Info className="w-6 h-6" />}
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-2">{dialog.title}</h3>
            <p className="text-slate-400 dark:text-slate-400 font-bold text-xs mb-6 leading-relaxed">{dialog.message}</p>
            
            <div className="flex gap-2">
              <button 
                onClick={() => setDialog(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button 
                onClick={dialog.onConfirm}
                className={`flex-1 py-2.5 text-white rounded-xl font-black text-xs transition-all shadow-md cursor-pointer ${
                  dialog.isWarning ? 'bg-rose-650 hover:bg-rose-600 shadow-rose-650/10' : 'bg-indigo-650 hover:bg-indigo-600 shadow-indigo-650/10'
                }`}
              >
                تأكيد العملية
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CashManagement;
