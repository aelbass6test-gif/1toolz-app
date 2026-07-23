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
  Users
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
        title: 'تنبيه',
        message: handoverType === 'treasury' ? 'يرجى اختيار الحساب المستلم (الخزينة)' : 'يرجى اختيار المستلم',
        onConfirm: () => setDialog(null)
      });
    }
    if (newHandover.amount <= 0) {
      return setDialog({
        isOpen: true,
        title: 'تنبيه',
        message: 'يرجى تحديد المبلغ المراد تحويله بشكل صحيح',
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
      if (!targetAccount) return setDialog({ isOpen: true, title: 'تنبيه', message: 'الحساب المالي المحدد غير موجود', onConfirm: () => setDialog(null) });
      toUserName = `الخزينة: ${targetAccount.name}`;
    } else {
      const toUser = allPossibleHolders.find(h => h.id === newHandover.toUserId);
      toUserName = toUser?.name || 'مستخدم غير معروف';
      if (fromUserId === newHandover.toUserId) {
        return setDialog({ isOpen: true, title: 'تنبيه', message: 'لا يمكن تسليم العهدة لنفس الشخص', onConfirm: () => setDialog(null) });
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
          action: handoverType === 'treasury' ? 'توريد عهدة للخزينة' : (handoverType === 'main_wallet' || handoverType === 'supply_wallet') ? 'توريد عهدة للمحفظة' : 'تسليم نقدية',
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
    if (!selectedTreasuryAccountId) return setDialog({ isOpen: true, title: 'تنبيه', message: 'يرجى اختيار خزينة أو محفظة للتوريد والإيداع', onConfirm: () => setDialog(null) });
    if (treasuryAmount <= 0) return setDialog({ isOpen: true, title: 'تنبيه', message: 'يرجى تحديد المبلغ المراد توريده', onConfirm: () => setDialog(null) });

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
      if (!targetAccount) return setDialog({ isOpen: true, title: 'تنبيه', message: 'الحساب المالي المحدد غير موجود', onConfirm: () => setDialog(null) });
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
    <div className="p-3 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto font-sans" dir="rtl">
      
      {/* Top Banner Header */}
      <div className="bg-white/80 dark:bg-[#090d16]/80 backdrop-blur-2xl rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
            <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-0.5 rounded-md border border-indigo-200/60 dark:border-indigo-800/60">
              منظومة إدارة العهد والمبالغ النقدية
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Handshake className="w-5 h-5" />
            </div>
            العهد والنقدية المحصلة
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-bold mt-1.5 leading-relaxed">
            متابعة دقيقة وتوثيق شامل للسيولة النقدية بحوزة الشركاء والمناديب والكاشيرية وتحويلها للخزائن والمحافظ
          </p>
        </div>

        {/* Tab Switcher & Quick Add Button */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="bg-slate-100/80 dark:bg-slate-900/80 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 flex items-center gap-1">
            <button 
              onClick={() => setActiveTab('balances')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'balances' 
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <UserCheck size={16} />
              العهد الحالية
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'balances' ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
              }`}>
                {holders.length}
              </span>
            </button>
            <button 
              onClick={() => setActiveTab('handovers')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'handovers' 
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <History size={16} />
              سجل التسليمات
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'handovers' ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
              }`}>
                {handovers.length}
              </span>
            </button>
          </div>

          <button 
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
            className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-[0.98] text-white rounded-2xl font-black text-xs sm:text-sm transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus size={18} />
            تسجيل تسليم مبلغ
          </button>
        </div>
      </div>

      {/* Modern Glassmorphic Stats Deck */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Stat 1 */}
        <div className="bg-white/80 dark:bg-[#090d16]/80 backdrop-blur-xl rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500 rounded-r-md"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-500 dark:text-slate-400">إجمالي النقدية بالعهد</span>
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight tabular-nums">
              {totalCustodyBalance.toLocaleString('ar-EG')}
            </span>
            <span className="text-xs font-bold text-slate-400">ج.م</span>
          </div>
          <p className="text-[11px] font-bold text-slate-400 mt-2 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            السيولة المتداولة مع الموظفين والشركاء
          </p>
        </div>

        {/* Stat 2 */}
        <div className="bg-white/80 dark:bg-[#090d16]/80 backdrop-blur-xl rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500 rounded-r-md"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-500 dark:text-slate-400">عدد أصحاب العهد</span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight tabular-nums">
              {holders.length}
            </span>
            <span className="text-xs font-bold text-slate-400">شخص</span>
          </div>
          <p className="text-[11px] font-bold text-slate-400 mt-2 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
            حسابات عهد مسجلة ونشطة بالسيستم
          </p>
        </div>

        {/* Stat 3 */}
        <div className="bg-white/80 dark:bg-[#090d16]/80 backdrop-blur-xl rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-2 h-full bg-purple-500 rounded-r-md"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-500 dark:text-slate-400">عمليات التسليم الموثقة</span>
            <div className="w-9 h-9 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight tabular-nums">
              {handovers.length}
            </span>
            <span className="text-xs font-bold text-slate-400">عملية</span>
          </div>
          <p className="text-[11px] font-bold text-slate-400 mt-2 flex items-center gap-1">
            <History className="w-3.5 h-3.5 text-purple-500" />
            سجلات تحويل نقدية مدققة ومحفوظة
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white/80 dark:bg-[#090d16]/80 backdrop-blur-xl rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800/80 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder={activeTab === 'balances' ? "ابحث باسم صاحب العهدة..." : "ابحث في سجل التسليمات بالملاحظات أو الأسطر..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-100/70 dark:bg-slate-900/70 text-slate-900 dark:text-white pr-10 pl-4 py-2 rounded-xl text-xs font-bold border-0 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              مسح
            </button>
          )}
        </div>
      </div>

      {/* Main Content Sections */}
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
              <div className="bg-white/80 dark:bg-[#090d16]/80 backdrop-blur-xl rounded-3xl p-12 text-center border border-slate-200/80 dark:border-slate-800/80">
                <Banknote className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                <h3 className="text-slate-700 dark:text-slate-300 font-black text-base">لا توجد عهد نقدية مطابقة</h3>
                <p className="text-slate-400 text-xs font-bold mt-1">
                  {searchQuery ? 'لم نجد أصحاب عهد بهذا الاسم' : 'يمكنك تسجيل أول عملية تسليم مبلغ نقدية بالضغط على الزر أعلاه'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredHolders.map(holder => {
                  const isPositive = holder.currentBalance >= 0;
                  const isManager = holder.userId === 'admin' || holder.originalIds?.includes('admin') || holder.userName === 'المدير' || holder.userName === 'المدير (أنت)';
                  const isPartner = settings?.partners?.find(p => p.id === holder.userId || holder.originalIds?.includes(p.id) || holder.originalIds?.includes(`part_${p.id}`) || holder.originalIds?.includes(`partner_${p.id}`) || normalizeName(p.name) === holder.userName);
                  const isEmployee = settings?.employees?.find(e => e.id === holder.userId || holder.originalIds?.includes(e.id) || holder.originalIds?.includes(`emp_${e.id}`) || holder.originalIds?.includes(`employee_${e.id}`) || normalizeName(e.name) === holder.userName);

                  return (
                    <div 
                      key={holder.userId} 
                      className="bg-white/80 dark:bg-[#090d16]/80 backdrop-blur-xl rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800/80 hover:border-indigo-500/40 dark:hover:border-indigo-500/40 shadow-xs hover:shadow-lg transition-all duration-300 group flex flex-col justify-between"
                    >
                      <div>
                        {/* Header card info */}
                        <div className="flex items-start justify-between gap-3 mb-5">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 border border-indigo-200/50 dark:border-indigo-800/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                              <User className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-black text-slate-900 dark:text-white text-base">
                                  {holder.userName}
                                </h3>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                                  isManager ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 border-purple-200/60 dark:border-purple-800/60' :
                                  isPartner ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 border-amber-200/60 dark:border-amber-800/60' :
                                  'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-slate-700/60'
                                }`}>
                                  {isManager ? 'المدير' : isPartner ? 'شريك' : isEmployee ? 'موظف' : 'عهدة'}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {new Date(holder.lastUpdated).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                          </div>

                          <button 
                            onClick={() => {
                              setDialog({ 
                                isOpen: true, 
                                title: 'تأكيد حذف سجّل العهدة', 
                                message: `هل أنت متأكد من حذف حساب العهدة الخاص بـ (${holder.userName})؟`, 
                                isWarning: true, 
                                onConfirm: () => { 
                                  const updatedHolders = holders.filter(h => h.userId !== holder.userId); 
                                  updateSettings({ ...settings, cashHolders: updatedHolders }); 
                                  setDialog(null); 
                                } 
                              });
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                            title="حذف العهدة"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        {/* Balance info */}
                        <div className="bg-slate-50/80 dark:bg-slate-900/60 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/60 mb-5">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">إجمالي الرصيد الحالي بحوزته</span>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className={`text-2xl font-black tabular-nums tracking-tight ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {holder.currentBalance.toLocaleString('ar-EG')}
                            </span>
                            <span className="text-xs font-bold text-slate-400">ج.م</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Action Controls */}
                      {(currentUser?.isAdmin || currentUser?.id === holder.userId) && (
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
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
                            className="w-full py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-emerald-200/50 dark:border-emerald-800/50 shadow-xs"
                            title="تسليم المبلغ للخزينة وتصفية العهدة"
                          >
                            <Banknote className="w-4 h-4" />
                            تسليم للخزينة
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
                            className="w-full py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-indigo-200/50 dark:border-indigo-800/50 shadow-xs"
                            title="تحويل العهدة لشخص آخر"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                            تحويل لشخص
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
            className="space-y-3"
          >
            {filteredHandovers.length === 0 ? (
              <div className="bg-white/80 dark:bg-[#090d16]/80 backdrop-blur-xl rounded-3xl p-12 text-center border border-slate-200/80 dark:border-slate-800/80">
                <History className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                <h3 className="text-slate-700 dark:text-slate-300 font-black text-base">لا توجد عمليات تسليم نقدية مسجلة</h3>
                <p className="text-slate-400 text-xs font-bold mt-1">تُسجل هنا جميع التحويلات المالية والتسليمات المعتمدة في النظام</p>
              </div>
            ) : (
              <div className="bg-white/80 dark:bg-[#090d16]/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-500" />
                    سجل حركة العمليات والتحويلات المعتمدة
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    عدد السجلات: {filteredHandovers.length}
                  </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredHandovers.map(h => (
                    <div 
                      key={h.id} 
                      className="p-4 sm:p-5 hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/40">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-900 dark:text-white text-sm">{h.fromUserName}</span>
                            <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500 rotate-180 shrink-0" />
                            <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">{h.toUserName}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(h.date).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                            {(h.notes || (h as any).note) && (
                              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-md truncate max-w-xs">
                                "{h.notes || (h as any).note}"
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60 px-3 py-1.5 rounded-xl text-emerald-700 dark:text-emerald-400 font-black text-base tabular-nums flex items-baseline gap-1">
                          {h.amount.toLocaleString('ar-EG')}
                          <span className="text-[10px] font-bold">ج.م</span>
                        </div>

                        <button
                          onClick={() => handleDeleteHandover(h.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                          title="حذف عملية التسليم وإعادة الموازنة"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-[#090d16] w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl relative border border-slate-200 dark:border-slate-800 text-right" 
            dir="rtl"
          >
            <button 
              onClick={() => setShowHandoverModal(false)}
              className="absolute left-6 top-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">تسليم أو تحويل مالي</h3>
                <p className="text-slate-400 text-xs font-bold">توثيق ونقل النقدية بين العهد أو الخزائن المعرفية</p>
              </div>
            </div>
            
            <div className="space-y-5">
              {/* Select Destination Type */}
              <div>
                <label className="block text-xs font-black text-slate-600 dark:text-slate-400 mb-2">
                  جهة التسليم / المستلم
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setHandoverType('holder');
                      setNewHandover({ ...newHandover, toUserId: '' });
                    }}
                    className={`py-2.5 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      handoverType === 'holder' 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20' 
                        : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
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
                    className={`py-2.5 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      handoverType === 'treasury' 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20' 
                        : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
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
                    className={`py-2.5 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      handoverType === 'main_wallet' 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20' 
                        : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
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
                    className={`py-2.5 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      handoverType === 'supply_wallet' 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20' 
                        : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    التوريد
                  </button>
                </div>
              </div>

              {currentUser?.isAdmin && (
                <div>
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-400 mb-1.5">
                    المسلِّم (صاحب العهدة المصدر)
                  </label>
                  <select 
                    value={newHandover.fromUserId || (currentUser?.id || 'admin')}
                    onChange={(e) => setNewHandover({...newHandover, fromUserId: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-11 px-4 rounded-xl font-bold text-xs outline-none focus:border-indigo-500 text-right text-slate-900 dark:text-white"
                  >
                    {allPossibleHolders.map((h, index) => (
                      <option key={'from_' + h.id + index} value={h.id}>{h.name} ({h.role})</option>
                    ))}
                  </select>
                </div>
              )}

              {handoverType !== 'supply_wallet' && (
                <div>
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-400 mb-1.5">
                    {handoverType === 'treasury' ? 'الخزينة المستلمة' : 'المستلم'}
                  </label>
                  <select 
                    value={newHandover.toUserId}
                    onChange={(e) => setNewHandover({...newHandover, toUserId: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-11 px-4 rounded-xl font-bold text-xs outline-none focus:border-indigo-500 text-right text-slate-900 dark:text-white"
                  >
                    {handoverType === 'treasury' ? (
                      <>
                        <option value="">-- اختر خزينة الإيداع --</option>
                        {(treasury?.accounts || []).map((acc: any) => (
                          <option key={'treasury_acc_' + acc.id} value={acc.id}>
                            {acc.name} (الرصيد: {acc.balance.toLocaleString()} ج.م)
                          </option>
                        ))}
                      </>
                    ) : (
                      <>
                        <option value="">-- اختر المستلم --</option>
                        {allPossibleHolders.map((h, index) => (
                          <option key={'to_' + h.id + index} value={h.id}>{h.name} ({h.role})</option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-xs font-black text-slate-600 dark:text-slate-400 mb-1.5">
                  المبلغ المراد تسليمه
                </label>
                <div className="relative">
                  <input 
                    type="number"
                    value={newHandover.amount || ''}
                    onChange={(e) => setNewHandover({...newHandover, amount: Number(e.target.value)})}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-11 pl-12 pr-4 rounded-xl font-black text-base outline-none text-right focus:border-indigo-500 text-slate-900 dark:text-white"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">ج.م</span>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-black text-slate-600 dark:text-slate-400 mb-1.5">
                  ملاحظات أو بيان
                </label>
                <textarea 
                  placeholder="مثلاً: توريد تحصيل طلبات اليوم، عهدة مصاريف..."
                  value={newHandover.notes}
                  onChange={(e) => setNewHandover({...newHandover, notes: e.target.value})}
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl font-bold text-xs outline-none text-right focus:border-indigo-500 text-slate-900 dark:text-white resize-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800/80">
                <button 
                  type="button"
                  onClick={() => setShowHandoverModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  type="button"
                  onClick={handleExecuteHandover}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-black text-xs transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  تأكيد التسليم
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Treasury Settlement Modal */}
      {showTreasuryModal && selectedHolderForTreasury && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-[#090d16] w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl relative border border-slate-200 dark:border-slate-800 text-right" 
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
            
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">تسليم عهدة للخزينة / المحفظة</h3>
                <p className="text-slate-400 text-xs font-bold">تسوية وتوريد الرصيد النقدي للموظف ({selectedHolderForTreasury.userName})</p>
              </div>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-black text-slate-600 dark:text-slate-400 mb-1.5">
                  الحساب المالي المستلم (الخزينة / المحفظة)
                </label>
                <select 
                  value={selectedTreasuryAccountId}
                  onChange={(e) => setSelectedTreasuryAccountId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-11 px-4 rounded-xl font-bold text-xs outline-none focus:border-indigo-500 text-right text-slate-900 dark:text-white"
                >
                  <option value="">-- اختر الحساب المالي --</option>
                  <optgroup label="المحافظ الإلكترونية">
                     <option value="main_wallet">المحفظة العامة (الرصيد: {Number(wallet?.balance || 0).toLocaleString()} ج.م)</option>
                     <option value="supply_wallet">محفظة التوريد (الرصيد: {Number(wallet?.supplyBalance || 0).toLocaleString()} ج.م)</option>
                  </optgroup>
                  <optgroup label="الخزائن والحسابات البنكية">
                    {(treasury?.accounts || []).map((acc: any) => (
                      <option key={acc.id} value={acc.id}>{acc.name} (رصيد: {Number(acc.balance || 0).toLocaleString()} ج.م)</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-black text-slate-600 dark:text-slate-400">المبلغ المراد توريده</label>
                  <button 
                    type="button" 
                    onClick={() => setTreasuryAmount(selectedHolderForTreasury.currentBalance)}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 font-black hover:underline cursor-pointer"
                  >
                    تصفية كل العهدة ({selectedHolderForTreasury.currentBalance.toLocaleString()} ج.م)
                  </button>
                </div>
                <div className="relative">
                  <input 
                    type="number"
                    value={treasuryAmount || ''}
                    onChange={(e) => setTreasuryAmount(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-11 pl-12 pr-4 rounded-xl font-black text-base outline-none text-right focus:border-emerald-500 text-slate-900 dark:text-white"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">ج.م</span>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-black text-slate-600 dark:text-slate-400 mb-1.5">
                  ملاحظات التوريد
                </label>
                <textarea 
                  placeholder="مثلاً: توريد جزئي للعهدة، تصفية حساب اليومية..."
                  value={treasuryNotes}
                  onChange={(e) => setTreasuryNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl font-bold text-xs outline-none text-right focus:border-indigo-500 text-slate-900 dark:text-white resize-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800/80">
                <button 
                  type="button"
                  onClick={() => {
                    setShowTreasuryModal(false);
                    setSelectedHolderForTreasury(null);
                  }}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  type="button"
                  onClick={handleExecuteTreasuryDeposit}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-black text-xs transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  تأكيد التوريد
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Custom Global Dialog */}
      {dialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#090d16] w-full max-w-sm rounded-3xl p-6 shadow-2xl text-right border border-slate-200 dark:border-slate-800" dir="rtl">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${dialog.isWarning ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400'}`}>
              {dialog.isWarning ? <AlertTriangle className="w-6 h-6" /> : <Info className="w-6 h-6" />}
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-2">{dialog.title}</h3>
            <p className="text-slate-500 dark:text-slate-400 font-bold text-xs mb-6 leading-relaxed">{dialog.message}</p>
            
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
                  dialog.isWarning ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                }`}
              >
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CashManagement;
