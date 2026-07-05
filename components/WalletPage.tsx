import React, { useState, useMemo } from 'react';
import { Wallet as WalletIcon, Users, Plus, Minus, ArrowUpRight, ArrowDownLeft, Trash2, Calendar, Shield, Eye, Truck, TrendingUp, Info, AlertTriangle, AlertCircle, Coins, Receipt, X, Layers, CreditCard, Smartphone, Banknote, Settings as SettingsIcon, ChevronRight, ChevronLeft, Check, History, Search, Filter, CheckCircle, Clock } from 'lucide-react';
import { Wallet, Transaction, Order, Settings, TransactionCategory, WithdrawRequest, WalletSettings, BankAccount, Treasury } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfirmationModal } from './ConfirmationModal';
import { calculateOrderProfitLoss, calculateOrderShippingAndFees, getAdvancePaymentCustodyName } from '../utils/financials';
import { CustodyLedger } from './AccountingReports';
import { triggerCelebration } from '../utils/celebration';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.4, ease: 'easeOut' }
  }
};

interface WalletPageProps {
  wallet: Wallet;
  setWallet: React.Dispatch<React.SetStateAction<Wallet>>;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  orders: Order[];
  settings: Settings;
  treasury?: Treasury;
  setTreasury?: (updater: any) => void;
}

const WalletPage: React.FC<WalletPageProps> = ({ wallet, setWallet, setSettings, orders, settings, treasury, setTreasury }) => {
  const [modalMode, setModalMode] = useState<'none' | 'charge' | 'withdraw' | 'settings' | 'history' | 'bank' | 'cod_history' | 'withdraw_confirm' | 'error' | 'transfer_supply'>('none');
  const [selectedTreasuryId, setSelectedTreasuryId] = useState<string>('');
  const [errorConfig, setErrorConfig] = useState({ title: '', message: '' });
  const [supplyAmount, setSupplyAmount] = useState('');
  const [transferDirection, setTransferDirection] = useState<'to_supply' | 'from_supply'>('to_supply');
  const [chargeMethod, setChargeMethod] = useState<'card' | 'wallet' | 'instapay'>('card');
  const [withdrawMode, setWithdrawMode] = useState<'normal' | 'same_day'>('normal');
  const [amount, setAmount] = useState('');
  const [walletViewMode, setWalletViewMode] = useState<'balance' | 'cycle'>('balance');
  const [activeTab, setActiveTab] = useState<'all' | 'orders' | 'withdrawals' | 'manual' | 'supply_wallet'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [settingsScreen, setSettingsScreen] = useState<'main' | 'payment_methods' | 'withdraw_settings'>('main');
  const [txToDelete, setTxToDelete] = useState<string | null>(null);
  
  // Local state for bank account editing
  const [localBankDetails, setLocalBankDetails] = useState<BankAccount>(
    wallet.settings?.bankAccount || { accountHolder: '', bankName: '', iban: '', accountNumber: '' }
  );
  const [localMobileWallet, setLocalMobileWallet] = useState(wallet.settings?.mobileWallet || '');
  const [preferredMethod, setPreferredMethod] = useState<'bank' | 'wallet' | 'instapay' | 'treasury'>(
    (wallet.settings?.preferredWithdrawMethod as 'bank' | 'wallet' | 'instapay' | 'treasury') || 'bank'
  );
  
  const [showCustody, setShowCustody] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const walletStats = useMemo(() => {
    // Current calculation is sum of transactions, ensuring amounts are numbers
    // Deposits and Withdrawals in 'pending' status do NOT affect the live balance
    // This satisfies the requirement that the balance doesn't drop/increase until approval
    const liveBalance = (wallet?.transactions || []).reduce((sum, t) => {
        const amount = Number(t.amount) || 0;
        
        // Exclude transactions that come from the Supply Wallet (they were already deducted from main during funding or never entered main)
        if (t.category === 'supply_purchase' || t.category === 'supply_deposit' || t.category?.startsWith('supply_expense_')) return sum;

        // Exclude partner personal expenses from the global wallet balance
        if (t.details?.paidByPartnerId || t.details?.expensePaidBy || t.note?.includes('دفعهم') || t.note?.includes('شريك')) return sum;

        // Deposits: only include when completed
        if (t.type === 'إيداع') {
             return t.status === 'completed' ? sum + amount : sum;
        }
        
        // Withdrawals: include both completed AND pending (reserve them)
        if (t.type === 'سحب') {
             return t.status === 'cancelled' ? sum : sum - amount;
        }
        
        return sum;
    }, 0);

    // Calculate sum of pending withdrawals for UI display
    const pendingWithdrawalsSum = (wallet?.transactions || []).reduce((sum, t) => {
        if (t.type === 'سحب' && t.status === 'pending') {
            return sum + (Number(t.amount) || 0);
        }
        return sum;
    }, 0);

    const inRouteOrders = orders.filter(o => 
      (!o.paymentMethod || ['cod', 'كاش', 'cash', 'الدفع عند الاستلام', 'دفع عند الاستلام'].includes(o.paymentMethod)) && 
      (o.status === 'تم_توصيلها' || o.status === 'تم_التوصيل' || o.status === 'قيد_الشحن' || o.status === 'تم_الارسال') && 
      !o.collectionProcessed
    );
    
    const inRouteTotal = inRouteOrders.reduce((sum, o) => {
      const isDefinitivelyPosOrder = o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر' || o.shippingArea === 'نقطة البيع' || (o.id && o.id.startsWith('POS-'));
      const compFeesLocal = settings?.companySpecificFees?.[o.shippingCompany];
      const useCustomLocal = compFeesLocal?.useCustomFees ?? false;
      const inspectionFee = !isDefinitivelyPosOrder && (o.includeInspectionFee !== false) && (o.inspectionFeePaidByCustomer !== false) ? (useCustomLocal ? (compFeesLocal?.inspectionFee ?? 0) : (settings?.enableInspection ? settings.inspectionFee : 0)) : 0;
      const tax = Number((o as any).tax) || 0;
      
      const base = o.totalAmountOverride ?? (o.productPrice + o.shippingFee + tax + inspectionFee - (o.discount || 0));
      const advance = Number(o.advancePayment) || 0;
      return sum + (base - advance);
    }, 0);

    return { 
        liveBalance, 
        supplyBalance: wallet.supplyBalance || 0,
        pendingWithdrawals: pendingWithdrawalsSum,
        availableToWithdraw: liveBalance,
        inRouteTotal
    };
  }, [wallet.transactions, wallet.supplyBalance, orders]);

  const handleTransferSupply = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(supplyAmount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    if (transferDirection === 'to_supply') {
      if (numAmount > walletStats.liveBalance) {
        setErrorConfig({
          title: 'رصيد غير كافٍ',
          message: 'لا يمكنك تحويل مبلغ أكبر من متاح المحفظة الأساسية.'
        });
        setModalMode('error');
        return;
      }

      const transMain: Transaction = {
        id: `TR-S-${Date.now()}`,
        type: 'سحب',
        amount: numAmount,
        date: new Date().toISOString(),
        note: 'تحويل إلى محفظة الموردين (تمويل مخزون)',
        category: 'supply_funding',
        status: 'completed'
      };

      setWallet(prev => ({
        ...prev,
        balance: prev.balance - numAmount,
        supplyBalance: (prev.supplyBalance || 0) + numAmount,
        transactions: [transMain, ...prev.transactions]
      }));
    } else {
      if (numAmount > walletStats.supplyBalance) {
        setErrorConfig({
            title: 'رصيد غير كافٍ',
            message: 'لا يمكنك تحويل مبلغ أكبر من متاح محفظة الموردين.'
          });
          setModalMode('error');
          return;
      }

      const transMain: Transaction = {
        id: `TR-M-${Date.now()}`,
        type: 'إيداع',
        amount: numAmount,
        date: new Date().toISOString(),
        note: 'تحويل من محفظة الموردين إلى المحفظة الأساسية',
        category: 'manual_deposit',
        status: 'completed'
      };

      setWallet(prev => ({
        ...prev,
        balance: prev.balance + numAmount,
        supplyBalance: (prev.supplyBalance || 0) - numAmount,
        transactions: [transMain, ...prev.transactions]
      }));
    }

    setModalMode('none');
    setSupplyAmount('');
  };

  const handleDeleteTransaction = (transactionId: string) => {
    setTxToDelete(transactionId);
  };

  const confirmDeleteTransaction = () => {
    if (!txToDelete) return;
    const transactionId = txToDelete;
    
    setWallet(prev => {
      const transactionToDelete = prev.transactions.find(t => t.id === transactionId);
      if (!transactionToDelete) return prev;
      
      const newTransactions = prev.transactions.filter(t => t.id !== transactionId);
      
      // Recalculate balance if it was a completed transaction
      let balanceAdjustment = 0;
      if (transactionToDelete.type === 'إيداع' && transactionToDelete.status === 'completed') {
        balanceAdjustment = -transactionToDelete.amount;
      } else if (transactionToDelete.type === 'سحب' && transactionToDelete.status !== 'cancelled') {
        balanceAdjustment = transactionToDelete.amount;
      }
      
      return {
        ...prev,
        transactions: newTransactions,
        balance: prev.balance + balanceAdjustment
      };
    });
    setTxToDelete(null);
  };

  // Derived settings or defaults
  const walletSettings: WalletSettings = useMemo(() => {
    const base = wallet.settings || {
      preferredWithdrawMethod: 'bank' as const,
      autoWithdrawal: false,
      autoWithdrawalDays: [],
      minAutoWithdrawAmount: 100
    };
    return {
      ...base,
      bankAccount: localBankDetails,
      mobileWallet: localMobileWallet,
      preferredWithdrawMethod: preferredMethod as 'bank' | 'wallet' | 'instapay'
    };
  }, [wallet.settings, localBankDetails, localMobileWallet, preferredMethod]);

  const handleUpdateWalletSettings = () => {
    setWallet(prev => ({
        ...prev,
        settings: {
            ...walletSettings,
            bankAccount: localBankDetails,
            mobileWallet: localMobileWallet,
            preferredWithdrawMethod: preferredMethod
        }
    }));
    setModalMode('settings');
    setSettingsScreen('main');
  };

  const handleCharge = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    const applicableMethods = settings.feeApplicableMethods || [];
    const feePercent = applicableMethods.includes(chargeMethod) ? (settings.depositFeePercent || 0) : 0;
    const fee = (numAmount * feePercent) / 100;
    const finalChargeAmount = numAmount - fee;

    const newTransaction: Transaction = {
      id: Date.now().toString(),
      type: 'إيداع',
      amount: finalChargeAmount,
      fees: fee,
      date: new Date().toISOString(),
      note: `شحن محفظة عبر ${chargeMethod === 'card' ? 'بطاقة دفع' : chargeMethod === 'wallet' ? 'محفظة هاتف' : 'إنستاباي'} (بانتظار موافقة الإدارة)`,
      category: 'wallet_charge',
      status: 'pending'
    };

    setWallet(prev => ({
      ...prev,
      transactions: [newTransaction, ...prev.transactions],
      // Balance is NOT updated here anymore, wait for approval
      balance: prev.balance
    }));
    setModalMode('none');
    setAmount('');
  };

  const currentWithdrawFee = useMemo(() => {
    if (!settings.enableWithdrawalFees) return 0;
    if (preferredMethod === 'treasury') return 0;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return 0;

    let fee = 0;
    if (withdrawMode === 'same_day') {
      const type = settings.sameDayWithdrawalFeeType || 'percent';
      if (type === 'percent') {
        const percent = parseFloat(settings.sameDayWithdrawalFeePercent as any) || 0;
        fee = (numAmount * percent) / 100;
      } else {
        fee = parseFloat(settings.sameDayWithdrawalFlatFee as any) || 0;
      }
    } else {
      const type = settings.withdrawalFeeType || 'flat';
      if (type === 'flat') {
        fee = parseFloat(settings.withdrawalFlatFee as any) || 0;
      } else {
        const percent = parseFloat(settings.withdrawalFeePercent as any) || 0;
        fee = (numAmount * percent) / 100;
      }
    }

    // Apply global minimum fee if set
    if (settings.minWithdrawalFee && fee < settings.minWithdrawalFee) {
        fee = settings.minWithdrawalFee;
    }

    return fee;
  }, [amount, withdrawMode, settings, preferredMethod]);

  const handleWithdrawRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return; 
    
    const fee = currentWithdrawFee;
    const totalDeduction = numAmount + fee;

    if (totalDeduction > walletStats.availableToWithdraw) {
      setErrorConfig({
        title: 'رصيدك غير كافٍ',
        message: `الرصيد المتاح للسحب هو: ${walletStats.availableToWithdraw.toLocaleString()} ج.م. لا يُسمح بأرصدة سالبة.`
      });
      setModalMode('error');
      return;
    }
    
    setModalMode('withdraw_confirm');
  };

  const confirmWithdraw = () => {
    const numAmount = parseFloat(amount);
    const fee = currentWithdrawFee;
    const totalDeduction = numAmount + fee;
    const netAmount = numAmount; 

    // Handle internal treasury transfer
    if (preferredMethod === 'treasury' && selectedTreasuryId && setTreasury && treasury) {
      const selectedAccount = treasury.accounts.find(a => a.id === selectedTreasuryId);
      
      const newTransaction: Transaction = {
        id: `WT-${Date.now()}`,
        type: 'سحب',
        amount: numAmount,
        fees: 0, 
        date: new Date().toISOString(),
        status: 'completed',
        note: `تحويل داخلي من المحفظة إلى خزينة: ${selectedAccount?.name || 'غير معروف'}`,
        category: 'wallet_withdrawal'
      };

      // update wallet
      setWallet(prev => ({
        ...prev,
        transactions: [newTransaction, ...prev.transactions],
        balance: prev.balance - numAmount
      }));

      // update treasury
      setTreasury((prev: Treasury) => {
        const newTreasuryTx: any = {
          id: `TWL-${Date.now()}`,
          date: new Date().toISOString(),
          type: 'deposit',
          amount: numAmount,
          description: 'تحويل وارد من محفظة الشحن الأساسية',
          toAccountId: selectedTreasuryId
        };
        
        return {
          ...prev,
          accounts: prev.accounts.map(acc => 
            acc.id === selectedTreasuryId ? { ...acc, balance: acc.balance + numAmount } : acc
          ),
          transactions: [newTreasuryTx, ...(prev.transactions || [])]
        };
      });

      setModalMode('none');
      setAmount('');
      setSelectedTreasuryId('');
      // تشغيل السمعيات والاحتفالات لسحب وارد للخزينة
      triggerCelebration('wallet_withdraw', settings);
      return;
    }

    const newRequest: WithdrawRequest = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      amount: numAmount,
      date: new Date().toISOString(),
      status: 'pending',
      method: preferredMethod,
      details: preferredMethod === 'bank' 
        ? `${localBankDetails.bankName} - ${localBankDetails.accountHolder} - ${localBankDetails.accountNumber}`
        : localMobileWallet || '',
      fee,
      netAmount,
      isSameDay: withdrawMode === 'same_day'
    };

    const mainTransaction: Transaction = {
      id: `W-${newRequest.id}`,
      type: 'سحب',
      amount: numAmount,
      fees: 0, 
      date: new Date().toISOString(),
      status: 'pending',
      note: `طلب سحب رصيد (${withdrawMode === 'same_day' ? 'فوري' : 'عادي'}) لمبلغ ${numAmount}`,
      category: 'wallet_withdrawal'
    };

    const feeTransaction: Transaction | null = fee > 0 ? {
      id: `WF-${newRequest.id}`,
      type: 'سحب',
      amount: fee,
      fees: 0,
      date: new Date().toISOString(),
      status: 'pending',
      note: `عمولة طلب سحب رصيد #${newRequest.id}`,
      category: 'withdrawal_fee'
    } : null;

    const newTransactions = feeTransaction ? [mainTransaction, feeTransaction] : [mainTransaction];

    setWallet(prev => ({
      ...prev,
      transactions: [...newTransactions, ...prev.transactions],
      withdrawRequests: [newRequest, ...(prev.withdrawRequests || [])],
      // Deduct immediately on pending request
      balance: prev.balance - totalDeduction 
    }));
    setModalMode('none');
    setAmount('');
    // تشغيل السمعيات والاحتفالات لطلب سحب جديد
    triggerCelebration('wallet_withdraw', settings);
  };

  const filteredHistory = useMemo(() => {
    if (activeTab === 'withdrawals') {
        return (wallet.withdrawRequests || []).map(r => ({
            id: r.id,
            type: 'سحب' as const,
            amount: r.amount,
            date: r.date,
            note: `طلب سحب (${r.method === 'bank' ? 'بنكي' : r.method === 'instapay' ? 'إنستاباي' : r.method === 'wallet' ? 'محفظة' : 'خزينة'}) - الرسوم: ${r.fee || 0} ج.م`,
            isWithdraw: true,
            status: r.status,
            category: 'wallet_withdrawal' as TransactionCategory
        }));
    }
    
    let base = wallet.transactions.map(t => ({ ...t, isWithdraw: t.type === 'سحب' }));
    
    if (activeTab === 'orders') {
        base = base.filter(t => (t.note || '').includes('#') || t.orderNumber || t.orderId);
    } else if (activeTab === 'manual') {
        base = base.filter(t => !(t.note || '').includes('#') && !t.orderNumber && !t.orderId && t.category !== 'wallet_withdrawal' && t.category !== 'wallet_charge' && !t.category?.startsWith('supply_'));
    } else if (activeTab === 'supply_wallet') {
        base = base.filter(t => t.category?.startsWith('supply_') || t.category === 'inventory_purchase');
    } else if (activeTab === 'all') {
        // Show everything
    }
    
    return base;
  }, [wallet, activeTab]);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const groupedHistory = useMemo(() => {
    if (activeTab === 'withdrawals' || activeTab === 'manual') return filteredHistory;

    const groups: Record<string, any[]> = {};
    const ungrouped: any[] = [];

    filteredHistory.forEach(t => {
      // Improved regex to catch variations like "أوردر #", "الطلب #", "بطلب #", or just "#" at the end of a word
      const note = t.note || '';
      const orderNumMatch = note.match(/أوردر #([^ \(\)\[\]]+)/) || 
                            note.match(/الطلب #([^ \(\)\[\]]+)/) ||
                            note.match(/بطلب #([^ \(\)\[\]]+)/) ||
                            note.match(/#([^ \(\)\[\]]+)$/) ||
                            note.match(/#([^ \(\)\[\]]+) /);
                            
      const supplyOrderMatch = note.match(/أمر:\s?([^ \)]+)/);
      const orderKey = t.orderNumber || t.orderId || (orderNumMatch ? orderNumMatch[1] : null);
      const supplyKey = supplyOrderMatch ? supplyOrderMatch[1] : null;

      if (orderKey && (t.type === 'سحب' || t.type === 'إيداع') && t.category !== 'wallet_withdrawal' && t.category !== 'wallet_charge') {
        if (!groups[orderKey]) groups[orderKey] = [];
        groups[orderKey].push(t);
      } else if (supplyKey && (t.category?.startsWith('supply_') || t.category === 'inventory_purchase')) {
        const key = `supply_${supplyKey}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
      } else {
        ungrouped.push(t);
      }
    });

    const result: any[] = [...ungrouped];
    
    Object.entries(groups).forEach(([key, items]) => {
      if (items.length === 1) {
        result.push(items[0]);
      } else {
        const sortedItems = [...items].sort((a, b) => {
          const timeDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
          if (timeDiff !== 0) return timeDiff;
          if (a.type !== b.type) return a.type === 'سحب' ? -1 : 1;
          return 0;
        });
        const first = sortedItems[0];
        const totalAmount = items.reduce((sum, i) => i.type === 'إيداع' ? sum + i.amount : sum - i.amount, 0);
        
        result.push({
          ...first,
          id: `group-${key}`,
          isGroup: true,
          items: sortedItems,
          amount: Math.abs(totalAmount),
          type: totalAmount >= 0 ? 'إيداع' : 'سحب',
          note: key.startsWith('supply_') ? `إجمالي تمويل وشراء بضاعة (أمر: ${key.replace('supply_', '')})` : `إجمالي تسويات الأوردر #${key}`,
          orderNumber: key.startsWith('supply_') ? key.replace('supply_', '') : key
        });
      }
    });

    return result.sort((a, b) => {
      const timeDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (timeDiff !== 0) return timeDiff;
      // If times are exactly identical, list the purchase (سحب) before funding (إيداع)
      // This applies specifically to supply stock orders with partner funding.
      if (a.type !== b.type) {
        return a.type === 'سحب' ? -1 : 1;
      }
      return 0;
    });
  }, [filteredHistory, activeTab]);

  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return groupedHistory.slice(start, start + itemsPerPage);
  }, [groupedHistory, currentPage]);

  const totalPages = Math.ceil(groupedHistory.length / itemsPerPage);

  const getTransactionTitle = (item: any) => {
      let baseTitle = item.category === 'collection' ? 'رصيد من الدفع عند الاستلام' 
                    : item.category === 'shipping' ? 'مصاريف شحن' 
                    : (item.note?.replace('إصدار بوليصة شحن', 'مصاريف شحن') || item.type);
      
      const relevantOrder = item.orderId 
        ? cycleOrders.find(o => o.id === item.orderId) || orders.find(o => o.id === item.orderId)
        : item.orderNumber 
          ? cycleOrders.find(o => String(o.orderNumber) === String(item.orderNumber)) || orders.find(o => String(o.orderNumber) === String(item.orderNumber))
          : null;

      if (relevantOrder && ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي'].includes(relevantOrder.status)) {
          if (item.category === 'shipping' || item.category === 'collection' || item.isGroup || baseTitle.includes('مصاريف شحن')) {
              baseTitle += ` (أوردر فاشل/مرتجع)`;
          }
      }
      return baseTitle;
  };

  const getNextMondayFormatted = () => {
    const d = new Date();
    const day = d.getDay();
    const daysUntilMonday = (8 - day) % 7 || 7;
    const nextMonday = new Date(d.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
    return nextMonday.toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric', year: 'numeric' });
  };

  const cycleOrders = useMemo(() => {
    // Only show orders that are relevant to the financial cycle (shipped, delivered, returned, or collected)
    // and haven't been fully processed/accounted into the treasury yet.
    // We also keep recently processed orders for 7 days for visibility.
    return orders.filter(o => {
      const isRelevantStatus = ['تم_توصيلها', 'تم_التوصيل', 'تم_التحصيل', 'مدفوعة', 'مدفوع', 'قيد_الشحن', 'تم_الارسال', 'مرتجع', 'فشل_التوصيل', 'مرتجع_جزئي', 'تمت_الاعادة_لشركة_الشحن'].includes(o.status);
      const daysSinceOrder = (Date.now() - new Date(o.date).getTime()) / (1000 * 60 * 60 * 24);
      return isRelevantStatus && (!o.collectionProcessed || o.status === 'تم_التحصيل' || daysSinceOrder < 7);
    });
  }, [orders]);

  const cycleFinancials = useMemo(() => {
    return cycleOrders.reduce((acc, o) => {
      // Exclude failed or returned orders from the expected collection and shipping totals for success stats
      const isFailed = ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_بعد_الاستلام'].includes(o.status);
      const { netRevenue, carrierFees, net } = calculateOrderProfitLoss(o, settings);
      
      if (!isFailed) {
        acc.collected += netRevenue;
        acc.shipping += carrierFees;
      } else {
        // For failed orders, we still want to track the shipping fees loss
        acc.shipping += carrierFees; 
      }
      
      acc.profit += net;
      return acc;
    }, { collected: 0, shipping: 0, profit: 0 });
  }, [cycleOrders, settings]);

  const totalCollectedFromCustomers = cycleFinancials.collected;
  const totalShippingFee = cycleFinancials.shipping;
  const totalNetProfit = cycleFinancials.profit;

  return (
    <div className="min-h-[80vh] p-4 md:p-8" dir="rtl">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-6xl mx-auto space-y-10"
      >
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-100 dark:border-slate-800 pb-6">
          <motion.div variants={itemVariants} className="space-y-1 text-right flex-1 w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">نظام الإدارة المالية الشاملة</span>
              </div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <WalletIcon size={32} className="text-indigo-500"/>
                المحفظة الماليّة المركزيّة
              </h1>
              <p className="text-slate-500 text-sm font-medium">نظرة تفصيلية على حركات السحب، الإيداع، الدورة المالية، ومحفظة المورّدين الخاصة بك</p>
            </div>
            
            {/* Modern responsive tabs for display modes matching screenshots */}
            <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 flex-row-reverse w-full md:w-auto">
              <button 
                onClick={() => setWalletViewMode('balance')}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black transition-all duration-300 whitespace-nowrap cursor-pointer ${walletViewMode === 'balance' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                الرصيد الحالي
              </button>
              <button 
                onClick={() => setWalletViewMode('cycle')}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black transition-all duration-300 whitespace-nowrap cursor-pointer ${walletViewMode === 'cycle' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                الدورة المالية
              </button>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="flex gap-3 w-full md:w-auto justify-end">
            <button
              onClick={() => setShowCustody(!showCustody)}
              className={`px-4 py-2 ${showCustody ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'} rounded-xl text-xs font-black cursor-pointer leading-tight flex items-center gap-1.5 transition-colors`}
            >
              <Users size={14} />
              العهد النقدية
            </button>
            <button
              onClick={() => alert('مرحبا بك في مركز الدعم المالي! إذا كنت بحاجة إلى مساعدة، يمكنك الاستفسار من مدير الحساب المالي المخصص لك.')}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black cursor-pointer leading-tight flex items-center gap-1.5"
            >
              احتاج مساعدة ؟
            </button>
            <button
              onClick={() => setModalMode('settings')}
              className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition-all shadow-sm flex items-center justify-center"
              title="إعدادات المحفظة"
            >
              <SettingsIcon size={20} />
            </button>
            <button
              onClick={() => setModalMode('history')}
              className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition-all shadow-sm flex items-center justify-center"
              title="تصدير التقارير"
            >
              <History size={20} />
            </button>
          </motion.div>
        </div>

        {/* Custody Ledger Section (Toggleable) */}
        <AnimatePresence>
          {showCustody && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-100 dark:border-amber-900/30 rounded-[2.5rem] p-6">
                <CustodyLedger settings={settings} treasury={treasury} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Cards Section */}
        {walletViewMode === 'balance' ? (
          <>
            {/* 3 Premium Cards Section for Current Balance View matching screenshots */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 font-sans">
              {/* Card 1: Available Balance */}
              <div className="bg-gradient-to-br from-indigo-900 via-slate-905 to-indigo-950 dark:from-black dark:to-slate-950 border border-white/10 rounded-[2.5rem] p-6 text-white shadow-2xl flex flex-col justify-between h-full min-h-[13rem] relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-30 bg-radial-gradient from-indigo-500/10 via-transparent to-transparent"></div>
                  <div className="text-right font-sans">
                      <div className="flex justify-between items-center flex-row-reverse mb-3">
                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">الرصيد الأساسي المتاح</span>
                          <WalletIcon size={16} className="text-indigo-400" />
                      </div>
                      <p className="text-3xl font-black mt-1 tracking-tight">
                          {walletStats.liveBalance.toLocaleString('ar-EG')} <span className="text-sm font-bold opacity-65">ج.م</span>
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 mt-2 leading-relaxed">هذا هو إجمالي رصيد المحفظة المتاح للسحوبات الآن. يرجى الضغط على شحن الرصيد لإنشاء دفعة.</p>
                  </div>
                  <div className="flex gap-2.5 justify-end mt-4 relative z-10 flex-wrap">
                      <button onClick={() => setModalMode('history')} className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-[10px] font-black cursor-pointer leading-tight transition-all text-center">سجل العمليات</button>
                      <button onClick={() => { setAmount(''); setModalMode('charge'); }} className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black cursor-pointer leading-tight transition-all text-center shadow-lg shadow-emerald-500/20">شحن الرصيد</button>
                      <button onClick={() => { setAmount(''); setModalMode('withdraw'); }} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black cursor-pointer leading-tight transition-all text-center shadow-lg shadow-indigo-500/20">طلب سحب نقدي</button>
                  </div>
              </div>

              {/* Card 2: Auto payout settings frequency */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-[2.5rem] p-6 text-right flex flex-col justify-between h-full min-h-[13rem] shadow-sm font-sans">
                  <div>
                      <div className="flex justify-between items-center flex-row-reverse mb-3 font-sans">
                          <span className="text-[10px] font-black text-slate-400">تكرار السحب النقدي</span>
                          <Clock size={16} className="text-slate-400" />
                      </div>
                      <div className="flex items-center gap-1.5 justify-end mt-1 font-sans">
                          <span className="bg-indigo-50 text-indigo-650 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-0.5 rounded-lg text-[9px] font-black">أسبوعي</span>
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 mt-2 leading-relaxed">سيتم تحويل قيمة السحب النقدي إلى حسابك البنكي كل يوم اثنين كمعيار دوري لتأمين الحيازات المعتمدة.</p>
                  </div>
                  <div className="flex gap-2 justify-end mt-4">
                      <button onClick={() => setModalMode('settings')} className="text-indigo-600 dark:text-indigo-400 text-[10px] font-black hover:underline cursor-pointer">تغيير النظام</button>
                      <span className="w-1.5 h-1.5 bg-slate-200 dark:bg-slate-700/60 rounded-full self-center"></span>
                      <button onClick={() => alert('نظام السحب مخصص لتجربة تسليم سريعة تحافظ على سلاسة رأس المال التشغيلي.')} className="text-slate-400 text-[10px] font-black hover:underline cursor-pointer">اعرف أكثر</button>
                  </div>
              </div>

              {/* Card 3: Next settlement date */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-[2.5rem] p-6 text-right flex flex-col justify-between h-full min-h-[13rem] shadow-sm font-sans">
                      <div>
                          <div className="flex justify-between items-center flex-row-reverse mb-3 font-sans">
                              <span className="text-[10px] font-black text-slate-400 animate-pulse font-sans">تاريخ السحب النقدي القادم</span>
                              <Calendar size={16} className="text-slate-400" />
                          </div>
                          <p className="text-lg font-black text-slate-850 dark:text-white mt-1">
                              الإثنين، {getNextMondayFormatted()}
                          </p>
                          <p className="text-[11px] font-bold text-slate-500 mt-2 leading-relaxed font-sans">سيتم تحويل قيمة التحصيل المستحق مباشرة بدون أي رسوم معاملات إلى الحساب البنكي المعتمد.</p>
                      </div>
                      <div className="mt-4">
                          <div className="w-full bg-slate-50 dark:bg-slate-800/40 py-2.5 rounded-xl text-center text-[10px] font-black text-slate-500 border border-slate-100 dark:border-slate-800/80 font-sans">
                              الاثنين القادم، {getNextMondayFormatted()}
                          </div>
                      </div>
              </div>
            </motion.div>

            {/* Supply Wallet Widget */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 gap-8 mb-8 font-sans">
              {/* Supply Wallet Card */}
              <div className="relative group">
                <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-900/40 rounded-[2.5rem] p-8 text-right shadow-sm border border-slate-200/60 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-5 flex-row-reverse">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-650 dark:text-indigo-400 flex items-center justify-center">
                            <Coins size={28} />
                        </div>
                        <div className="text-right">
                            <h3 className="text-lg font-black text-slate-850 dark:text-white mb-1">محفظة التوريد (رأس مال المخزون)</h3>
                            <p className="text-xs text-slate-400 font-bold">مخصصة لتمويل عمليات شراء البضاعة والطلب المسبق بأمان مالي تام.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-right font-sans">
                            <span className="text-[10px] font-black text-slate-400 uppercase">الرصيد المتاح للمخزون</span>
                            <p className="text-3xl font-black text-slate-900 dark:text-white mt-0.5">
                                {walletStats.supplyBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} <span className="text-xs font-bold text-slate-400">ج.م</span>
                            </p>
                        </div>
                        <button
                            onClick={() => { setSupplyAmount(''); setModalMode('transfer_supply'); }}
                            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs transition-all shadow-md cursor-pointer whitespace-nowrap"
                        >
                            تحويل للمخزون
                        </button>
                    </div>
                </div>
              </div>
            </motion.div>

        {/* Stats Grid - Bento Style */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* Coming Revenue Card */}
            <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 p-8 shadow-sm hover:shadow-xl transition-all flex flex-col group">
                <div className="flex items-center justify-between flex-row-reverse mb-8">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl group-hover:rotate-12 transition-transform shadow-sm">
                        <Truck size={24} />
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">في الطريق إليك</p>
                        <h4 className="text-3xl font-black text-slate-800 dark:text-white">{walletStats.inRouteTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} <span className="text-sm font-bold opacity-30">ج.م</span></h4>
                    </div>
                </div>
                
                <div className="space-y-5">
                    {[
                      { label: 'دفع عند الاستلام (نشط)', value: walletStats.inRouteTotal.toLocaleString(), progress: walletStats.inRouteTotal > 0 ? 100 : 0, color: 'bg-emerald-500' },
                      { label: 'بانتظار التحصيل', value: '٠', progress: 0, color: 'bg-blue-500' },
                      { label: 'متوقع دخوله', value: (walletStats.inRouteTotal * 0.8).toLocaleString(), progress: 60, color: 'bg-indigo-500' }
                    ].map((item, idx) => (
                      <div key={idx} className="space-y-2 flex flex-col">
                         <div className="flex justify-between flex-row-reverse text-[11px] font-bold">
                             <span className="text-slate-500">{item.label}</span>
                             <span className="text-slate-900 dark:text-slate-100">{item.value} ج.م</span>
                         </div>
                         <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden">
                             <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${item.progress}%` }}
                                  className={`h-full ${item.color} shadow-[0_0_8px_rgba(0,0,0,0.1)]`}
                              />
                         </div>
                      </div>
                    ))}
                </div>
                
                <div className="mt-auto pt-6 flex justify-center">
                  <button 
                    onClick={() => setModalMode('cod_history')}
                    className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 group/link"
                  >
                      عرض تفاصيل التسويات <ChevronRight size={12} className="rotate-180 group-hover/link:-translate-x-1 transition-transform" />
                  </button>
                </div>
            </div>

            {/* Transactions Summary Card */}
            <div className="bg-slate-900 dark:bg-slate-800/50 rounded-[3rem] p-8 text-white flex flex-col shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                    <TrendingUp size={140} />
                </div>
                <div className="flex justify-between items-start flex-row-reverse relative z-10">
                  <div className="text-right">
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">إجمالي ما تم سحبه</p>
                      <h4 className="text-4xl font-black tracking-tight">{(wallet.withdrawRequests || []).reduce((sum, r) => r.status === 'accepted' ? sum + r.amount : sum, 0).toLocaleString()} <span className="text-lg opacity-30">ج.م</span></h4>
                  </div>
                  <button 
                    onClick={() => setModalMode('history')}
                    className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/10"
                    title="عرض سجل السحوبات"
                  >
                    <History size={18} />
                  </button>
                </div>

                <div className="relative z-10 grid grid-cols-2 gap-4 mt-8">
                    <div className="p-5 bg-white/5 rounded-[2rem] border border-white/10 hover:bg-white/10 transition-colors">
                        <p className="text-[10px] font-bold text-white/40 mb-1">طلبات السحب</p>
                        <p className="text-2xl font-black text-emerald-400">{wallet.withdrawRequests?.length || 0}</p>
                    </div>
                    <div className="p-5 bg-white/5 rounded-[2rem] border border-white/10 hover:bg-white/10 transition-colors">
                        <p className="text-[10px] font-bold text-white/40 mb-1">متوسط السحب</p>
                        <p className="text-2xl font-black text-emerald-400">٠ <span className="text-[10px] opacity-40">ج.م</span></p>
                    </div>
                </div>
            </div>
        </motion.div>
      </>) : (
          <>
            {/* Financial Cycle Dashboard view matching second & third screenshots */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 font-sans">
              {/* Card 1: Collected values */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-[2.5rem] p-6 text-right flex flex-col justify-between h-40 shadow-sm hover:border-indigo-500/30 hover:shadow-md transition-all font-sans">
                  <div>
                      <div className="flex justify-between items-center flex-row-reverse mb-2 font-sans overflow-hidden">
                          <span className="text-[10px] font-black text-slate-400">المبلغ المحصل</span>
                          <Coins size={16} className="text-indigo-500" />
                      </div>
                      <p className="text-3xl font-black text-slate-850 dark:text-white mt-1">
                          {totalCollectedFromCustomers.toLocaleString('ar-EG')} <span className="text-xs font-bold text-slate-400">ج.م</span>
                      </p>
                      <p className="text-[10px] h-4 font-bold text-slate-400 mt-1 whitespace-nowrap">إجمالي القيمة المطلوب تحصيلها بالكامل من العملاء</p>
                  </div>
                  <button onClick={() => alert('المبلغ المحصل يتم جمعه من جميع طلباتك للدورة المالية النشطة.')} className="text-indigo-600 dark:text-indigo-400 text-[10px] font-black self-start hover:underline cursor-pointer font-sans">عرض التفاصيل</button>
              </div>

              {/* Card 2: Shipping Fee */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-[2.5rem] p-6 text-right flex flex-col justify-between h-40 shadow-sm hover:border-indigo-500/30 hover:shadow-md transition-all font-sans">
                  <div>
                      <div className="flex justify-between items-center flex-row-reverse mb-2">
                          <span className="text-[10px] font-black text-slate-400">سعر الشحن والرسوم</span>
                          <Truck size={16} className="text-amber-500" />
                      </div>
                      <p className="text-3xl font-black text-slate-850 dark:text-white mt-1 font-sans">
                          {totalShippingFee.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} <span className="text-xs font-bold text-slate-400">ج.م</span>
                      </p>
                      <p className="text-[10px] h-4 font-bold text-slate-400 mt-1">تكلفة النقل والتسليم المخصومة بالكامل</p>
                  </div>
                  <button onClick={() => alert('مصاريف الشحن تشمل بوليصة النقل ورسوم تأمين شركات الخدمات.')} className="text-indigo-600 dark:text-indigo-400 text-[10px] font-black self-start hover:underline cursor-pointer font-sans">عرض التفاصيل</button>
              </div>

              {/* Card 3: Expected Profit from cycle */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-[2.5rem] p-6 text-right flex flex-col justify-between h-40 shadow-sm hover:border-indigo-500/30 hover:shadow-md transition-all font-sans">
                  <div>
                      <div className="flex justify-between items-center flex-row-reverse mb-2">
                          <span className="text-[10px] font-black text-emerald-600 font-sans">صافي الربح الفعلي للدورة</span>
                          <TrendingUp size={16} className="text-emerald-500" />
                      </div>
                      <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                          {totalNetProfit.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} <span className="text-xs font-bold text-emerald-600/60 font-sans">ج.م</span>
                      </p>
                      <p className="text-[10px] h-4 font-bold text-slate-400 opacity-80 mt-1">صافي مكاسبك المقبولة للدفع لك يوم الاثنين</p>
                  </div>
                  <button onClick={() => alert('صافي الأرباح يمثل إجمالي مبيعاتك مطروحاً منها سعر الشحن وتكاليف البضائع.')} className="text-emerald-600 dark:text-emerald-400 text-[10px] font-black self-start hover:underline cursor-pointer font-sans">عرض تفصيلي</button>
              </div>
            </motion.div>

            {/* Financial Cycle Table ("قائمة بوليصات الدورة") */}
            <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800 p-6 shadow-sm text-right">
              <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 mb-6 flex-row-reverse font-sans">
                <div className="text-right">
                  <h3 className="text-lg font-black text-slate-850 dark:text-white flex items-center justify-end gap-2 text-right">
                    <span>قائمة الأوردرات وشحنات الدورة</span>
                    <span className="text-[11px] font-black text-indigo-100 bg-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-2.5 py-0.5 rounded-full font-sans">
                      {cycleOrders.length} شحنة
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-bold mt-1 max-w-xl text-right font-sans">توضح الشحنات التابعة لهذه الدورة وحالة تصفيتها المالية وإجمالي الفوائد المستحقة.</p>
                </div>
              </div>

              <div className="overflow-x-auto text-right">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-right">
                      <th className="p-5 text-right font-sans">رقم الشحنة</th>
                      <th className="p-5 text-right font-sans">النوع</th>
                      <th className="p-5 text-right font-sans">الوجهة</th>
                      <th className="p-5 text-right font-sans">مبلغ بوليصة التحصيل</th>
                      <th className="p-5 text-right font-sans">مصاريف الشحن</th>
                      <th className="p-5 text-right font-sans">تاريخ الإضافة</th>
                      <th className="p-5 text-right font-sans">صافي الربح للدورة</th>
                      <th className="p-1 text-center font-sans">حالة التوصيل</th>
                      <th className="p-1 text-center font-sans">حالة السداد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/10 text-xs text-right">
                    {cycleOrders.length > 0 ? (
                      cycleOrders.map((o) => {
                        const isDefinitivelyPosOrder = o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر' || o.shippingArea === 'نقطة البيع' || (o.id && o.id.startsWith('POS-'));
                        const compFeesLocal = settings?.companySpecificFees?.[o.shippingCompany];
                        const useCustomLocal = compFeesLocal?.useCustomFees ?? false;
                        const inspectionFee = !isDefinitivelyPosOrder && (o.includeInspectionFee !== false) && (o.inspectionFeePaidByCustomer !== false) ? (useCustomLocal ? (compFeesLocal?.inspectionFee ?? 0) : (settings?.enableInspection ? settings.inspectionFee : 0)) : 0;
                        const tax = Number((o as any).tax) || 0;

                        const oTotal = o.source === 'synced' && o.totalPrice != null ? Number(o.totalPrice) : (o.totalAmountOverride ?? (Number(o.productPrice) || 0) + (Number(o.shippingFee) || 0) + tax + inspectionFee - (Number(o.discount) || 0));
                        const { net, carrierFees: actualShippingFee } = calculateOrderProfitLoss(o, settings);
                        
                        return (
                          <tr key={o.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all font-sans text-right">
                            <td className="p-5 font-black text-indigo-600 dark:text-indigo-400 text-right">#{o.orderNumber}</td>
                            <td className="p-5 font-bold text-slate-700 dark:text-slate-300 text-right">توصيل بضاعة</td>
                            <td className="p-5 text-slate-500 font-medium text-right">{o.governorate}</td>
                            <td className="p-5 font-black text-slate-850 dark:text-white text-right">{oTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ج.م</td>
                            <td className="p-5 text-rose-500 font-bold text-right">{actualShippingFee.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ج.م</td>
                            <td className="p-5 text-slate-400 font-bold text-right">{new Date(o.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</td>
                            <td className={`p-5 font-extrabold text-right ${net >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{net.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ج.م</td>
                            <td className="p-1 text-center">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border ${
                                o.status === 'تم_التحصيل' || o.status === 'تم_التوصيل' || o.status === 'تم_توصيلها' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10' :
                                ['جاري_التوصيل', 'تم_الشحن'].includes(o.status as any) ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10' :
                                ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي'].includes(o.status) ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400' :
                                'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/40'
                              }`}>
                                {o.status === 'تم_التحصيل' || o.status === 'تم_التوصيل' || o.status === 'تم_توصيلها' ? 'تم التوصيل ✓' : 
                                 ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي'].includes(o.status) ? 'فشل / مرتجع' :
                                 (o.status as any) === 'جاري_التوصيل' ? 'قيد التوصيل' : 'مع الشاحن'}
                              </span>
                            </td>
                            <td className="p-1 text-center font-sans">
                              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black border ${
                                o.paymentStatus === 'مدفوع' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 font-sans' : 'bg-rose-50 text-rose-500 border-rose-100'
                              }`}>
                                {o.paymentStatus === 'مدفوع' ? 'تم الدفع' : 'غير مدفوع'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="p-16 text-center text-slate-400 font-bold">لا يوجد أوردرات مسجلة في هذه الدورة المالية حالياً</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </>
        )}

        {/* Interactive List Section */}
        <motion.div id="transactions-section" variants={itemVariants} className="space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6">
            <div className="flex flex-row-reverse p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-x-auto no-scrollbar max-w-full">
                {[
                    { id: 'all', label: 'الجميع' },
                    { id: 'orders', label: 'طلبات' },
                    { id: 'withdrawals', label: 'سحوبات' },
                    { id: 'supply_wallet', label: 'التوريد' },
                    { id: 'manual', label: 'يدوي' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all duration-300 whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            
            <div className="flex gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-80">
                    <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="ابحث برقم الطلب أو الملاحظة..." 
                        className="w-full pl-4 pr-12 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/50 transition-all dark:text-white shadow-sm"
                    />
                </div>
                <button className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all shadow-sm" title="تصفية">
                    <Filter size={20} />
                </button>
            </div>
          </div>

          {/* Transactions List */}
          {activeTab === 'withdrawals' ? (
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl">
                  <table className="w-full text-right border-collapse">
                      <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                              <th className="p-8">تفاصيل السحب</th>
                              <th className="p-8 text-center">الحالة</th>
                              <th className="p-8 text-center">المبلغ</th>
                              <th className="p-8 text-center">الرسوم</th>
                              <th className="p-8 text-center">إجمالي المخصوم</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                          {(wallet.withdrawRequests || []).length > 0 ? (
                              (wallet.withdrawRequests || []).map((r, idx) => (
                                  <motion.tr 
                                      key={r.id}
                                      initial={{ opacity: 0, x: 20 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: idx * 0.05 }}
                                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all cursor-default group"
                                  >
                                      <td className="p-8">
                                          <div className="flex flex-col text-right">
                                              <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider mb-1">
                                                  {r.method === 'bank' ? 'تحويل بنكي' : 'محفظة إلكترونية'}
                                              </span>
                                              <span className="text-[10px] font-bold text-slate-400">
                                                  {new Date(r.date).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                              </span>
                                              <span className="text-[9px] font-mono text-slate-400 mt-1 opacity-60 group-hover:opacity-100 transition-opacity">ID: {r.id}</span>
                                          </div>
                                      </td>
                                      <td className="p-8 text-center">
                                          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black border tracking-wide ${
                                              r.status === 'accepted' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' :
                                              r.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' : 
                                              'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20'
                                          }`}>
                                              <div className={`w-1.5 h-1.5 rounded-full ${
                                                  r.status === 'accepted' ? 'bg-emerald-500' : 
                                                  r.status === 'pending' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
                                              }`}></div>
                                              {r.status === 'accepted' ? 'تم قبولها' : r.status === 'pending' ? 'قيد المراجعة' : 'عملية مرفوضة'}
                                          </div>
                                      </td>
                                      <td className="p-8 text-center">
                                          <div className="flex items-baseline justify-center gap-1">
                                              <span className="text-sm font-black text-slate-900 dark:text-white">{r.amount.toLocaleString('ar-EG')}</span>
                                              <span className="text-[10px] font-bold text-slate-400 opacity-60">ج.م</span>
                                          </div>
                                      </td>
                                      <td className="p-8 text-center">
                                          <div className="flex items-baseline justify-center gap-1">
                                              <span className="text-sm font-black text-rose-500">{(r.fee || 0).toLocaleString('ar-EG')}</span>
                                              <span className="text-[10px] font-bold text-slate-400 opacity-60">ج.م</span>
                                          </div>
                                      </td>
                                      <td className="p-8 text-center">
                                          <div className="flex items-baseline justify-center gap-1">
                                              <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{(r.amount + (r.fee || 0)).toLocaleString('ar-EG')}</span>
                                              <span className="text-[10px] font-bold text-slate-400 opacity-60">ج.م</span>
                                          </div>
                                      </td>
                                  </motion.tr>
                              ))
                          ) : (
                              <tr>
                                  <td colSpan={5} className="p-32 text-center text-slate-400 font-bold">لا توجد سجلات سحب حالياً</td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
          ) : (
          <>
          <div className="grid grid-cols-1 gap-4">
              <AnimatePresence mode="popLayout">
                {paginatedHistory.map((item: any, idx) => (
                    <div key={item.id} className="space-y-4">
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3, delay: idx * 0.03 }}
                        onClick={() => {
                          if (item.isGroup) {
                            setExpandedGroups(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                          } else {
                            setExpandedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                          }
                        }}
                        className={`group p-5 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-xl hover:border-indigo-200/50 dark:hover:border-indigo-500/30 transition-all cursor-pointer relative overflow-hidden ${item.isGroup || expandedItems[item.id] ? 'border-r-8 border-r-indigo-500' : ''}`}
                      >
                          {/* Status dynamic border */}
                          {!item.isGroup && <div className={`absolute top-0 right-0 w-1 h-full ${item.type === 'إيداع' ? 'bg-emerald-500' : 'bg-rose-500'} opacity-0 group-hover:opacity-100 transition-opacity`}/>}
                          
                          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                              <div className="flex items-center gap-5 w-full md:w-auto flex-row-reverse">
                                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                                      item.type === 'إيداع' 
                                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-500/10' 
                                      : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-100/50 dark:border-rose-500/10'
                                  }`}>
                                      {item.isGroup ? <Layers size={24} className="text-indigo-600" /> : (item.type === 'إيداع' ? <ArrowUpRight size={24} /> : <ArrowDownLeft size={24} />)}
                                  </div>
                                  <div className="text-right">
                                      <h5 className="text-base font-black text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors tracking-tight">
                                          {getTransactionTitle(item)}
                                      </h5>
                                      <div className="flex items-center gap-3 flex-row-reverse mt-1.5">
                                          <span className="text-[11px] font-black text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-100 dark:border-slate-700">#{item.orderNumber || item.id.slice(-6)}</span>
                                           {item.category?.startsWith('supply_') && (
                                              <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-800">محفظة التوريد</span>
                                           )}
                                          <span className="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full"></span>
                                          <div className="flex items-center gap-1.5 flex-row-reverse">
                                              <Calendar size={12} className="text-slate-400"/>
                                              <span className="text-[11px] text-slate-400 font-bold">{new Date(item.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                          </div>
                                          {item.isGroup && (
                                            <>
                                              <span className="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full"></span>
                                              <span className="text-[11px] text-indigo-500 font-black">{item.items.length} عمليات</span>
                                            </>
                                          )}
                                      </div>
                                  </div>
                              </div>

                              <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end flex-row-reverse">
                                  <div className="text-right">
                                      <div className="flex items-baseline gap-1 flex-row-reverse">
                                          <p className={`text-2xl font-black ${item.type === 'إيداع' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                              {item.type === 'إيداع' ? '+' : '-'}{item.amount.toLocaleString()}
                                          </p>
                                          <span className={`text-xs font-bold ${item.type === 'إيداع' ? 'text-emerald-600/60' : 'text-rose-600/60'}`}>ج.م</span>
                                      </div>
                                      {item.fees > 0 && (
                                          <div className="flex items-center gap-1 justify-end mt-1">
                                              <p className="text-[10px] text-slate-400 font-black">رسوم: {item.fees} ج.م</p>
                                              <Info size={10} className="text-slate-300"/>
                                          </div>
                                      )}
                                  </div>
                                  
                                  <div className="flex items-center gap-4">
                                      <span className={`inline-flex flex-row-reverse items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black border tracking-wide ${
                                          item.status === 'pending'
                                          ? 'bg-amber-50 text-amber-600 border-amber-200/50 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                                          : item.status === 'completed'
                                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200/50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                                          : 'bg-rose-50 text-rose-600 border-rose-200/50 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20'
                                      }`}>
                                          {item.status === 'pending' ? 'قيد التنفيذ' : item.status === 'completed' ? 'تم التنفيذ' : 'تم إلغاؤها'}
                                          <span className={`w-1.5 h-1.5 rounded-full ${
                                              item.status === 'pending' ? 'bg-amber-500' :
                                              item.status === 'completed' ? 'bg-emerald-500' : 'bg-rose-500'
                                          }`} />
                                      </span>
                                      <motion.div 
                                          animate={{ rotate: item.isGroup && expandedGroups[item.id] ? 90 : 0 }}
                                          className={`p-3 rounded-2xl transition-all duration-300 shadow-sm ${item.isGroup && expandedGroups[item.id] ? 'bg-indigo-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}
                                      >
                                          <ChevronRight size={18} className="rotate-180" />
                                      </motion.div>
                                  </div>
                              </div>
                          </div>
                      </motion.div>

                      {/* Expanded Sub-transactions */}
                      <AnimatePresence>
                        {item.isGroup && expandedGroups[item.id] && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mr-12 overflow-hidden space-y-2"
                          >
                            {(() => {
                              const orderNum = item.orderNumber || item.id.replace('group-', '');
                              const relatedOrder = orders.find(o => String(o.orderNumber) === String(orderNum) || o.id === orderNum);
                              const advance = relatedOrder ? Number(relatedOrder.advancePayment) || 0 : 0;
                              if (advance > 0 && relatedOrder) {
                                return (
                                  <div className="flex items-center justify-between p-4 bg-amber-50/30 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                                    <div className="flex items-center gap-3 flex-row-reverse">
                                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
                                        <ArrowUpRight size={14}/>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">عربون مقدم للطلب #{relatedOrder.orderNumber}</p>
                                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">مسجل في عهدة: {getAdvancePaymentCustodyName(relatedOrder, settings, treasury)}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-baseline gap-1 flex-row-reverse">
                                      <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                                        +{advance.toLocaleString()}
                                      </span>
                                      <span className="text-[10px] opacity-40">ج.م</span>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                            {item.items.map((sub: any) => (
                              <div 
                                key={sub.id} 
                                className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800"
                              >
                                <div className="flex items-center gap-3 flex-row-reverse">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${sub.type === 'إيداع' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                    {sub.type === 'إيداع' ? <ArrowUpRight size={14}/> : <ArrowDownLeft size={14}/>}
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{getTransactionTitle(sub)}</p>
                                    <p className="text-[10px] text-slate-400">{new Date(sub.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
                                  </div>
                                </div>
                                <div className="flex items-baseline gap-1 flex-row-reverse">
                                  <span className={`text-sm font-black ${sub.type === 'إيداع' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {sub.type === 'إيداع' ? '+' : '-'}{sub.amount.toLocaleString()}
                                  </span>
                                  <span className="text-[10px] opacity-40">ج.م</span>
                                </div>
                              </div>
                            ))}
                          </motion.div>
                        )}
                        {!item.isGroup && expandedItems[item.id] && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-2 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-4">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-right">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">رقم العملية</p>
                                        <p className="font-mono text-xs font-black text-slate-700 dark:text-slate-300">{item.id}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">التصنيف</p>
                                        <p className="text-xs font-black text-slate-700 dark:text-slate-300">{item.category === 'wallet_charge' ? 'شحن محفظة' : item.category === 'wallet_withdrawal' ? 'سحب رصيد' : item.category === 'cod' ? 'تحصيل COD' : item.category || 'أخرى'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">تاريخ التنفيذ</p>
                                        <p className="text-xs font-black text-slate-700 dark:text-slate-300">{new Date(item.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">المبلغ</p>
                                        <p className={`text-xs font-black ${item.type === 'إيداع' ? 'text-emerald-600' : 'text-rose-600'}`}>{item.amount.toLocaleString()} ج.م</p>
                                    </div>
                                </div>
                                <div className="h-px bg-slate-200 dark:bg-slate-700 w-full" />
                                <div className="text-right space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">تفاصيل / ملاحظات</p>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{getTransactionTitle(item)}</p>
                                </div>
                                {item.orderId && (
                                    <>
                                        <div className="h-px bg-slate-200 dark:bg-slate-700 w-full" />
                                        <div className="text-right space-y-1">
                                            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">مرتبط بطلب رقم</p>
                                            <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">#{item.orderNumber || item.orderId}</p>
                                        </div>
                                    </>
                                )}
                                <div className="h-px bg-slate-200 dark:bg-slate-700 w-full" />
                                <div className="flex justify-end pt-2">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteTransaction(item.id);
                                        }}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl text-[10px] font-black transition-all shadow-sm active:scale-95"
                                    >
                                        <Trash2 size={14} />
                                        <span>حذف العملية نهائياً وتصحيح الرصيد</span>
                                    </button>
                                </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                ))}
              </AnimatePresence>

              {paginatedHistory.length === 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-32 bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800/50"
                  >
                      <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                          <History size={48} className="text-slate-200 dark:text-slate-700" />
                      </div>
                      <h4 className="text-xl font-black text-slate-800 dark:text-white">لا توجد سجلات حالياً</h4>
                      <p className="text-sm text-slate-400 font-bold max-w-sm mx-auto mt-3 leading-relaxed">عند قيامك بأي عمليات مالية جديدة ستظهر تفاصيلها هنا بشكل فورى وتلقائى</p>
                  </motion.div>
              )}
          </div>

           {/* Pagination Modern */}
          {totalPages > 0 && (
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              {/* Items per page selector */}
              <div className="flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/50 px-3 py-1.5 rounded-[1.25rem] border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">عدد العمليات بالصفحة:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="text-xs font-black bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-[11px] font-bold text-slate-400 mr-2">
                  (عرض {paginatedHistory.length} من {groupedHistory.length})
                </span>
              </div>

              {/* Page navigation */}
              <div className="flex items-center gap-2 p-1.5 bg-slate-50/50 dark:bg-slate-900/50 rounded-[1.25rem] border border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm text-slate-700 dark:text-slate-300 disabled:shadow-none bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700 disabled:border-transparent disabled:bg-transparent"
                >
                  <ChevronRight size={18} />
                </button>
                
                <div className="px-3 py-1 flex items-center gap-1.5 text-xs font-black">
                  <span className="text-slate-800 dark:text-slate-200">
                    صفحة {currentPage}
                  </span>
                  <span className="text-slate-400">من {totalPages || 1}</span>
                </div>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages <= 1}
                  className="p-2 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm text-slate-700 dark:text-slate-300 disabled:shadow-none bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700 disabled:border-transparent disabled:bg-transparent"
                >
                  <ChevronLeft size={18} />
                </button>
              </div>
            </div>
          )}
          </>
          )}
        </motion.div>
      </motion.div>


      {/* Charge Modal */}
      <AnimatePresence>
        {modalMode === 'charge' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-10 space-y-8">
                <div className="flex justify-between items-center flex-row-reverse">
                  <div className="flex items-center gap-5 text-right">
                    <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center shadow-inner">
                      <CreditCard size={28} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-800 dark:text-white">إيداع رصيد</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 text-emerald-500">Add funds to your wallet</p>
                    </div>
                  </div>
                  <button onClick={() => setModalMode('none')} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-2xl transition-all">
                    <X size={24}/>
                  </button>
                </div>

                <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] flex items-center justify-between flex-row-reverse border border-slate-100 dark:border-slate-800 shadow-inner">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                          <WalletIcon size={16} className="text-slate-400"/>
                        </div>
                        <p className="text-xs font-bold text-slate-400">الرصيد المتاح</p>
                    </div>
                    <div className="flex items-baseline gap-1.5 flex-row-reverse">
                      <h4 className="text-2xl font-black text-slate-800 dark:text-white">
                        {walletStats.liveBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                      </h4>
                      <span className="text-[10px] font-bold text-slate-400">ج.م</span>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'card', label: 'بطاقة دفع', icon: CreditCard },
                    { id: 'wallet', label: 'محفظة الهاتف', icon: Smartphone },
                    { id: 'instapay', label: 'إنستاباي', icon: Banknote }
                  ].map(method => (
                    <button
                      key={method.id}
                      onClick={() => setChargeMethod(method.id as any)}
                      className={`p-5 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 font-black text-[11px] relative overflow-hidden ${
                        chargeMethod === method.id 
                        ? 'border-emerald-500 bg-emerald-50/20 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' 
                        : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 text-slate-400 bg-slate-50/20'
                      }`}
                    >
                      {chargeMethod === method.id && (
                        <motion.div layoutId="charge-bg" className="absolute inset-0 bg-emerald-500/5 dark:bg-emerald-500/10 pointer-events-none"/>
                      )}
                      <method.icon size={24} className={chargeMethod === method.id ? 'text-emerald-500' : 'text-slate-400'} />
                      <span className="relative z-10">{method.label}</span>
                    </button>
                  ))}
                </div>

                <form onSubmit={handleCharge} className="space-y-8">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center flex-row-reverse px-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">المبلغ المراد شحنه</label>
                        <div className="flex items-center gap-1.5">
                            <Info size={12} className="text-slate-300"/>
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-wide">الرسوم تطبق حسب الطريقة</label>
                        </div>
                    </div>
                    <div className="relative group">
                        <input
                          type="number"
                          placeholder="0.00"
                          value={amount}
                          onChange={e => setAmount(e.target.value)}
                          className="w-full text-6xl font-black text-center py-10 bg-slate-50 dark:bg-slate-800/80 rounded-[2.5rem] border-2 border-transparent focus:border-emerald-500/20 outline-none focus:ring-8 focus:ring-emerald-500/5 placeholder:opacity-5 dark:text-white transition-all shadow-inner"
                          autoFocus
                        />
                        <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col items-center">
                            <span className="text-xs font-black text-slate-300 uppercase tracking-tighter">ج.م</span>
                        </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button type="button" onClick={() => setModalMode('none')} className="flex-1 py-5 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-3xl font-black hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-xs tracking-wide">إلغاء العملية</button>
                    <button type="submit" className="flex-[2] py-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-3xl font-black hover:from-emerald-500 hover:to-teal-500 shadow-2xl shadow-emerald-500/30 transition-all text-sm tracking-wide">تأكيد عملية الشحن</button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Withdraw Modal */}
      <AnimatePresence>
        {modalMode === 'withdraw' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-10 space-y-8">
               <div className="flex justify-between items-center flex-row-reverse">
                  <div className="flex items-center gap-5 text-right">
                    <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shadow-inner">
                      <ArrowDownLeft size={28} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-800 dark:text-white">سحب رصيد</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 text-indigo-500">Withdraw your funds</p>
                    </div>
                  </div>
                  <button onClick={() => setModalMode('none')} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-2xl transition-all">
                    <X size={24}/>
                  </button>
                </div>

                <div className="flex p-2 bg-slate-100 dark:bg-slate-800 rounded-[2rem] relative border border-slate-200/50 dark:border-slate-700/50 shadow-inner">
                  <button
                    onClick={() => setWithdrawMode('normal')}
                    className={`flex-1 py-3.5 text-xs font-black rounded-[1.5rem] transition-all relative z-10 ${withdrawMode === 'normal' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    السحب العادي
                  </button>
                  <button
                    onClick={() => setWithdrawMode('same_day')}
                    className={`flex-1 py-3.5 text-xs font-black rounded-[1.5rem] transition-all relative z-10 flex items-center justify-center gap-2 ${withdrawMode === 'same_day' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <span>سحب فوري</span>
                    <div className="px-2 py-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[8px] font-black rounded-lg shadow-sm border border-white/10 italic">EXPRESS</div>
                  </button>
                </div>

                {withdrawMode === 'normal' && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-[1.8rem] space-y-2 text-right relative overflow-hidden"
                  >
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed pr-1">
                      يتم تحويل المبالغ في غضون ٣-٥ أيام عمل. تطبق رسوم {
                        settings.withdrawalFeeType === 'percent'
                        ? `بنسبة ${settings.withdrawalFeePercent || 0}%`
                        : `ثابتة بقيمة ${settings.withdrawalFlatFee || 0} ج.م`
                      } على كل عملية سحب.
                    </p>
                  </motion.div>
                )}

                {withdrawMode === 'same_day' && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 dark:from-indigo-500/10 dark:to-purple-500/10 border border-indigo-100/50 dark:border-indigo-500/20 rounded-[1.8rem] space-y-2 text-right relative overflow-hidden"
                  >
                    <div className="absolute -top-6 -right-6 w-20 h-20 bg-indigo-500/5 rounded-full blur-xl"></div>
                    <div className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center justify-end gap-2">
                        خدمة السحب الفوري مفعلة
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping"/>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed pr-1">
                      الطلبات المقدمة قبل ١:٠٠ ظهراً سيتم تحويلها في نفس اليوم. تطبق رسوم {
                        settings.sameDayWithdrawalFeeType === 'percent' 
                        ? `بنسبة ${settings.sameDayWithdrawalFeePercent || 0}% (بحد أدنى ٢٥ ج.م للمبالغ أقل من ٢٥٠٠ ج.م)`
                        : `بمقدار ثابت ${settings.sameDayWithdrawalFlatFee || 0} ج.م`
                      }.
                    </p>
                  </motion.div>
                )}

                <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] flex items-center justify-between flex-row-reverse border border-slate-100 dark:border-slate-800 shadow-inner">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                          <WalletIcon size={16} className="text-slate-400"/>
                        </div>
                        <p className="text-xs font-bold text-slate-400">الرصيد المتاح</p>
                    </div>
                    <div className="flex items-baseline gap-1.5 flex-row-reverse">
                      <h4 className="text-2xl font-black text-slate-800 dark:text-white">
                        {walletStats.liveBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                      </h4>
                      <span className="text-[10px] font-bold text-slate-400">ج.م</span>
                    </div>
                </div>

                <form onSubmit={handleWithdrawRequest} className="space-y-8">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center flex-row-reverse px-4">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] block text-right">أدخل مبلغ السحب</label>
                      {currentWithdrawFee > 0 && (
                        <div className="flex items-center gap-2 flex-row-reverse">
                          <span className="text-[10px] font-black text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded-lg">سيتم خصم {currentWithdrawFee.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ج.م رسوم</span>
                        </div>
                      )}
                    </div>
                    <div className="relative group">
                        <input
                          type="number"
                          placeholder="0.00"
                          value={amount}
                          onChange={e => setAmount(e.target.value)}
                          className="w-full text-6xl font-black text-center py-10 bg-slate-50 dark:bg-slate-800/80 rounded-[2.5rem] border-2 border-transparent focus:border-indigo-500/20 outline-none focus:ring-8 focus:ring-indigo-500/5 placeholder:opacity-5 dark:text-white transition-all shadow-inner"
                          autoFocus
                        />
                        <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col items-center">
                            <span className="text-xs font-black text-slate-300 uppercase tracking-tighter">ج.م</span>
                        </div>
                    </div>
                  </div>

                  <div className="space-y-3 text-right">
                      <div className="flex justify-between items-center flex-row-reverse px-4">
                         <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">يتم التحويل إلى</label>
                         <div className="flex gap-2">
                           {(['bank', 'wallet', 'treasury'] as const).map((m) => (
                             <button
                               key={m}
                               type="button"
                               onClick={() => setPreferredMethod(m)}
                               className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${
                                 preferredMethod === m 
                                 ? 'bg-indigo-600 text-white' 
                                 : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'
                               }`}
                             >
                               {m === 'bank' ? 'بنك' : m === 'wallet' ? 'محفظة' : 'خزينة'}
                             </button>
                           ))}
                         </div>
                      </div>

                      {preferredMethod === 'treasury' && (
                        <div className="space-y-3">
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 text-right px-4">اختر الخزينة / الحساب (داخلي)</label>
                          <select
                            value={selectedTreasuryId}
                            onChange={(e) => setSelectedTreasuryId(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-[1.8rem] px-6 py-4 text-right text-sm font-black outline-none focus:border-indigo-500/50 transition-all dark:text-white shadow-sm"
                            required
                          >
                            <option value="">-- اختر الوجهة --</option>
                            {treasury?.accounts && (Array.isArray(treasury.accounts) ? treasury.accounts : Object.values(treasury.accounts || {})).map((acc: any) => (
                              <option key={acc.id} value={acc.id}>{acc.name} (رصيد: {acc.balance.toLocaleString()} ج.م)</option>
                            ))}
                          </select>
                          <p className="text-[10px] text-indigo-500 font-bold px-4 text-right">سيتم تحويل المبلغ فوراً إلى الخزينة المختارة وسيتم تسجيل الحركة في سجل الخزينة.</p>
                        </div>
                      )}

                      {preferredMethod !== 'treasury' && (
                        <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-[1.8rem] border border-slate-100 dark:border-slate-800 flex justify-between items-center flex-row-reverse group transition-all hover:bg-slate-100/50 dark:hover:bg-slate-800 cursor-pointer" onClick={() => setPreferredMethod(preferredMethod === 'bank' ? 'wallet' : 'bank')}>
                           <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-800">
                                  {preferredMethod === 'bank' ? <Banknote size={20} className="text-indigo-500" /> : <Smartphone size={20} className="text-emerald-500" />}
                              </div>
                              <div className="text-right">
                                  <p className="text-xs font-black text-slate-800 dark:text-white">{preferredMethod === 'bank' ? 'الحساب البنكي' : 'المحفظة الإلكترونية'}</p>
                                  <p className="text-[10px] font-mono text-slate-400 mt-0.5 tracking-widest font-black">
                                      {preferredMethod === 'bank' ? (localBankDetails.iban || localBankDetails.accountNumber || 'لم يتم الضبط') : (localMobileWallet || 'لم يتم الضبط')}
                                  </p>
                              </div>
                           </div>
                           <div className="flex flex-col items-center gap-1">
                              <CheckCircle size={20} className="text-emerald-500" />
                              <span className="text-[8px] font-bold text-slate-400">تبديل وجهة السحب</span>
                           </div>
                        </div>
                      )}
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setModalMode('none')} className="flex-1 py-5 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-3xl font-black hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-xs tracking-wide">إلغاء العملية</button>
                    <button type="submit" className="flex-[2] py-5 bg-indigo-600 text-white rounded-3xl font-black hover:bg-indigo-700 shadow-2xl shadow-indigo-500/30 transition-all text-sm tracking-wide">تأكيد طلب السحب</button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal (Methods Selector) */}
      <AnimatePresence>
        {modalMode === 'settings' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm" onClick={() => setModalMode('none')}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-10 space-y-10">
                <div className="flex justify-between items-center flex-row-reverse">
                  <div className="flex items-center gap-5 text-right">
                    <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform">
                      <SettingsIcon size={28} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                        {settingsScreen === 'main' ? 'إعدادات المحفظة' : 
                         settingsScreen === 'payment_methods' ? 'وسائل الدفع' : 'إعدادات سحب الأرباح'}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 text-indigo-500">
                        {settingsScreen === 'main' ? 'Finance & Payout Settings' :
                         settingsScreen === 'payment_methods' ? 'Payment Methods' : 'Update Payout Methods'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                        if (settingsScreen === 'main') setModalMode('none');
                        else setSettingsScreen('main');
                    }} 
                    className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-2xl transition-all"
                  >
                    {settingsScreen === 'main' ? <X size={24}/> : <ChevronRight size={24} className="rotate-180"/>}
                  </button>
                </div>

                <AnimatePresence mode="wait">
                    {settingsScreen === 'main' && (
                        <motion.div 
                            key="main"
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -20, opacity: 0 }}
                            className="space-y-4"
                        >
                            <button 
                                onClick={() => setSettingsScreen('payment_methods')} 
                                className="w-full p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:bg-white dark:hover:bg-slate-900 hover:border-indigo-200/50 dark:hover:border-indigo-500/30 transition-all shadow-sm hover:shadow-xl"
                            >
                                <ChevronRight size={20} className="text-slate-300 group-hover:text-indigo-500 transition-all rotate-180"/>
                                <div className="flex items-center gap-6 text-right">
                                    <div>
                                        <p className="text-lg font-black text-slate-800 dark:text-white">وسائل الدفع</p>
                                        <p className="text-xs text-slate-400 font-bold mt-1">إضافة وحذف البطاقات والمحافظ الإلكترونية</p>
                                    </div>
                                    <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <CreditCard size={28} className="text-slate-400 group-hover:text-indigo-500 transition-colors"/>
                                    </div>
                                </div>
                            </button>

                            <button 
                                onClick={() => setSettingsScreen('withdraw_settings')} 
                                className="w-full p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:bg-white dark:hover:bg-slate-900 hover:border-indigo-200/50 dark:hover:border-indigo-500/30 transition-all shadow-sm hover:shadow-xl"
                            >
                                <ChevronRight size={20} className="text-slate-300 group-hover:text-indigo-500 transition-all rotate-180"/>
                                <div className="flex items-center gap-6 text-right">
                                    <div>
                                        <p className="text-lg font-black text-slate-800 dark:text-white">إعدادات سحب الأرباح</p>
                                        <p className="text-xs text-slate-400 font-bold mt-1">تحديد مواعيد السحب الفوري والتلقائي</p>
                                    </div>
                                    <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Banknote size={28} className="text-slate-400 group-hover:text-emerald-500 transition-colors"/>
                                    </div>
                                </div>
                            </button>
                        </motion.div>
                    )}

                    {settingsScreen === 'payment_methods' && (
                        <motion.div 
                            key="payments"
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -20, opacity: 0 }}
                            className="space-y-10 flex flex-col items-center py-16"
                        >
                            <div className="relative">
                                <div className="absolute -inset-10 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"></div>
                                <div className="w-32 h-32 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center shadow-inner relative">
                                    <CreditCard size={64} className="text-slate-200 dark:text-slate-700"/>
                                    <div className="absolute top-0 right-0 p-2 bg-white dark:bg-slate-900 rounded-full shadow-md">
                                        <Plus size={20} className="text-indigo-500" />
                                    </div>
                                </div>
                            </div>
                            <div className="text-center space-y-3">
                                <h4 className="text-xl font-black text-slate-800 dark:text-white">لا توجد وسائل دفع محفوظة</h4>
                                <p className="text-sm text-slate-400 font-bold max-w-xs mx-auto leading-relaxed">بإمكانك إضافة وسيلة دفع جديدة عند قيامك بأول عملية شحن لمحفظتك.</p>
                            </div>
                        </motion.div>
                    )}

                    {settingsScreen === 'withdraw_settings' && (
                        <motion.div 
                            key="withdraw"
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -20, opacity: 0 }}
                            className="space-y-8"
                        >
                            <div className="flex gap-4">
                                <button 
                                    onClick={() => setWallet(prev => ({ 
                                        ...prev, 
                                        settings: { ...(prev.settings || walletSettings), autoWithdrawal: false } 
                                    }))}
                                    className={`flex-1 p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-4 font-black text-xs relative overflow-hidden ${!walletSettings.autoWithdrawal ? 'border-emerald-500 bg-emerald-50/20 text-emerald-700 dark:text-emerald-400' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}
                                >
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${!walletSettings.autoWithdrawal ? 'border-emerald-500' : 'border-slate-300 dark:border-slate-700'}`}>
                                        {!walletSettings.autoWithdrawal && <motion.div layoutId="check" className="w-3 h-3 rounded-full bg-emerald-500" />}
                                    </div>
                                    السحب اليدوي
                                </button>
                                <button 
                                    onClick={() => setWallet(prev => ({ 
                                        ...prev, 
                                        settings: { ...(prev.settings || walletSettings), autoWithdrawal: true } 
                                    }))}
                                    className={`flex-1 p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-4 font-black text-xs relative overflow-hidden ${walletSettings.autoWithdrawal ? 'border-emerald-500 bg-emerald-50/20 text-emerald-700 dark:text-emerald-400' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}
                                >
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${walletSettings.autoWithdrawal ? 'border-emerald-500' : 'border-slate-300 dark:border-slate-700'}`}>
                                        {walletSettings.autoWithdrawal && <motion.div layoutId="check" className="w-3 h-3 rounded-full bg-emerald-500" />}
                                    </div>
                                    السحب التلقائي
                                </button>
                            </div>

                            {walletSettings.autoWithdrawal && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                                    <div className="text-right space-y-3">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-4">أيام التحويل الدوري</label>
                                        <div className="flex flex-wrap justify-end gap-2 px-2">
                                            {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map((day) => (
                                                <button 
                                                    key={day}
                                                    className="px-5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-[10px] font-black text-slate-600 dark:text-slate-300 hover:border-indigo-500/30 transition-all"
                                                >
                                                    {day}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            )}


                            <div className="space-y-4">
                                <div className="flex justify-between items-center flex-row-reverse px-4">
                                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">بيانات الحساب البنكي</p>
                                    <button 
                                        onClick={() => setModalMode('bank')}
                                        className="text-indigo-600 text-[10px] font-black hover:underline px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg"
                                    >
                                        تعديل البيانات
                                    </button>
                                </div>
                                <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 text-right space-y-5 shadow-inner">
                                    <div className="flex justify-between items-start flex-row-reverse">
                                        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                            <Banknote className="text-indigo-500" size={28} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">المصرف المعتمد</p>
                                            <h4 className="text-base font-black text-slate-800 dark:text-white">{walletSettings.bankAccount?.bankName || 'لم يتم تحديد البنك'}</h4>
                                        </div>
                                    </div>
                                    <div className="space-y-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                                        <p className="text-sm text-slate-700 dark:text-slate-300 font-black">{walletSettings.bankAccount?.accountHolder || 'اسم صاحب الحساب'}</p>
                                        <div className="space-y-1">
                                            <p className="text-[11px] text-slate-400 font-mono tracking-[0.2em]">{walletSettings.bankAccount?.accountNumber || 'رقم الحساب'}</p>
                                            {walletSettings.bankAccount?.iban && (
                                              <p className="text-[10px] text-slate-400 font-mono tracking-[0.1em] break-all">{walletSettings.bankAccount.iban}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={() => {
                                    setModalMode('none');
                                    setSettingsScreen('main');
                                }}
                                className="w-full py-5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-[1.8rem] font-black hover:bg-black dark:hover:bg-slate-100 shadow-2xl transition-all text-sm tracking-widest mt-6"
                            >
                                حفظ الإعدادات المالية
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bank Account Modal - Modernized */}
      <AnimatePresence>
        {modalMode === 'bank' && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md" onClick={() => setModalMode('settings')}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-10 space-y-10">
                <div className="flex justify-between items-center flex-row-reverse">
                  <div className="flex items-center gap-5 text-right">
                    <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shadow-inner">
                        <Banknote size={28} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-800 dark:text-white">حساب البنك</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 text-indigo-500">Update Bank Details</p>
                    </div>
                  </div>
                  <button onClick={() => setModalMode('settings')} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-2xl transition-all">
                    <X size={24}/>
                  </button>
                </div>

                <div className="space-y-6">
                    <div className="text-right space-y-3">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-4">اسم صاحب الحساب</label>
                        <input 
                            type="text" 
                            value={localBankDetails.accountHolder}
                            onChange={(e) => setLocalBankDetails(prev => ({ ...prev, accountHolder: e.target.value }))}
                            className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-[1.8rem] px-8 py-5 text-right text-sm font-black outline-none focus:ring-8 focus:ring-indigo-500/5 transition-all dark:text-white shadow-inner"
                        />
                    </div>
                    
                    <div className="text-right space-y-3">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-4">البنك</label>
                        <div className="relative group">
                            <select 
                                value={localBankDetails.bankName}
                                onChange={(e) => setLocalBankDetails(prev => ({ ...prev, bankName: e.target.value }))}
                                className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-[1.8rem] px-12 py-5 text-right text-sm font-black outline-none focus:ring-8 focus:ring-indigo-500/5 transition-all dark:text-white shadow-inner"
                            >
                                <option value="">اختر البنك...</option>
                                <option value="National Bank of Egypt (NBE)">National Bank of Egypt (NBE)</option>
                                <option value="Banque Misr">Banque Misr</option>
                                <option value="CIB">CIB</option>
                                <option value="QNB">QNB</option>
                                <option value="HSBC">HSBC</option>
                            </select>
                            <ChevronRight size={20} className="absolute left-6 top-1/2 -translate-y-1/2 rotate-90 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                        </div>
                    </div>

                    <div className="text-right space-y-3">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-4">رقم الحساب</label>
                        <input 
                            type="text" 
                            value={localBankDetails.accountNumber}
                            onChange={(e) => setLocalBankDetails(prev => ({ ...prev, accountNumber: e.target.value }))}
                            placeholder="أدخل رقم الحساب"
                            className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-[1.8rem] px-8 py-5 text-right text-sm font-black outline-none focus:ring-8 focus:ring-indigo-500/5 transition-all dark:text-white font-mono shadow-inner"
                        />
                    </div>

                    <div className="text-right space-y-3">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-4">رقم IBAN (اختياري)</label>
                        <input 
                            type="text" 
                            value={localBankDetails.iban || ''}
                            onChange={(e) => setLocalBankDetails(prev => ({ ...prev, iban: e.target.value }))}
                            placeholder="أدخل رقم الـ IBAN إن وجد"
                            className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-[1.8rem] px-8 py-5 text-right text-sm font-black outline-none focus:ring-8 focus:ring-indigo-500/5 transition-all dark:text-white font-mono shadow-inner"
                        />
                    </div>
                </div>

                <div className="flex gap-4 pt-6">
                    <button onClick={() => setModalMode('settings')} className="flex-1 py-5 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-3xl font-black hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-xs tracking-wide">إلغاء</button>
                    <button onClick={handleUpdateWalletSettings} className="flex-[2] py-5 bg-indigo-600 text-white rounded-3xl font-black hover:bg-indigo-700 shadow-2xl shadow-indigo-500/30 transition-all text-sm tracking-widest">تأكيد البيانات</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Detail Modal - Modernized Full screen list */}
      <AnimatePresence>
        {modalMode === 'history' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8 bg-slate-950/40 backdrop-blur-xl" onClick={() => setModalMode('none')}>
             <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-900 w-full h-full max-w-6xl rounded-none md:rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800"
                onClick={e => e.stopPropagation()}
             >
                {/* Header */}
                <div className="px-10 py-8 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 flex justify-between items-center flex-row-reverse shrink-0">
                    <div className="flex items-center gap-6 flex-row-reverse">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center shadow-inner">
                            <ArrowDownLeft size={32} className="text-slate-900 dark:text-white" />
                        </div>
                        <div className="text-right">
                            <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">عمليات السحب</h2>
                            <p className="text-xs text-indigo-500 font-black mt-1 uppercase tracking-widest">Withdrawal Operations</p>
                        </div>
                    </div>
                    <button onClick={() => setModalMode('none')} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all group">
                        <X size={28} className="group-hover:rotate-90 transition-transform"/>
                    </button>
                </div>

                {/* Filters */}
                <div className="px-10 py-6 bg-slate-50/50 dark:bg-slate-800/30 flex gap-4 overflow-x-auto no-scrollbar flex-row-reverse border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="relative min-w-[240px]">
                        <ChevronRight size={16} className="absolute left-4 top-1/2 -translate-y-1/2 rotate-90 text-slate-400" />
                        <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 font-black text-xs outline-none text-right appearance-none shadow-sm cursor-pointer hover:border-indigo-500/30 transition-all">
                            <option>حالة عمليات السحب</option>
                            <option>تم قبولها</option>
                            <option>قيد المراجعة</option>
                            <option>مرفوضة</option>
                        </select>
                    </div>
                    <div className="relative min-w-[240px]">
                        <Calendar size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input type="text" placeholder="اختر التاريخ" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-6 pr-12 py-4 font-black text-xs outline-none text-right shadow-sm focus:ring-4 focus:ring-indigo-500/5 transition-all" />
                    </div>
                </div>

                {/* Content Table */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-6 md:p-10">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl">
                        <table className="w-full text-right border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                                    <th className="p-8">تفاصيل السحب</th>
                                    <th className="p-8 text-center">الحالة</th>
                                    <th className="p-8 text-center">المبلغ</th>
                                    <th className="p-8 text-center">الرسوم</th>
                                    <th className="p-8 text-center">إجمالي المخصوم</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                {(wallet.withdrawRequests || []).length > 0 ? (
                                    (wallet.withdrawRequests || []).map((r, idx) => (
                                        <motion.tr 
                                            key={r.id}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all cursor-default group"
                                        >
                                            <td className="p-8">
                                                <div className="flex flex-col text-right">
                                                    <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider mb-1">
                                                        {r.method === 'bank' ? 'تحويل بنكي' : 
                                                         r.method === 'instapay' ? 'إنستاباي' : 
                                                         r.method === 'wallet' ? 'محفظة إلكترونية' : 
                                                         'خزينة داخلية'}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400">
                                                        {new Date(r.date).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <span className="text-[9px] font-mono text-slate-400 mt-1 opacity-60 group-hover:opacity-100 transition-opacity">ID: {r.id}</span>
                                                </div>
                                            </td>
                                            <td className="p-8 text-center">
                                                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black border tracking-wide ${
                                                    r.status === 'accepted' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' :
                                                    r.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' : 
                                                    'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20'
                                                }`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${
                                                        r.status === 'accepted' ? 'bg-emerald-500' : 
                                                        r.status === 'pending' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
                                                    }`}></div>
                                                    {r.status === 'accepted' ? 'تم قبولها' : r.status === 'pending' ? 'قيد المراجعة' : 'عملية مرفوضة'}
                                                </div>
                                            </td>
                                            <td className="p-8 text-center">
                                                <div className="flex items-baseline justify-center gap-1">
                                                    <span className="text-sm font-black text-slate-900 dark:text-white">{r.amount.toLocaleString('ar-EG')}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 opacity-60">ج.م</span>
                                                </div>
                                            </td>
                                            <td className="p-8 text-center">
                                                <div className="flex items-baseline justify-center gap-1">
                                                    <span className="text-sm font-black text-rose-500">{(r.fee || 0).toLocaleString('ar-EG')}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 opacity-60">ج.م</span>
                                                </div>
                                            </td>
                                            <td className="p-8 text-center">
                                                <div className="flex items-baseline justify-center gap-1">
                                                    <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{(r.amount + (r.fee || 0)).toLocaleString('ar-EG')}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 opacity-60">ج.م</span>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="p-32 text-center text-slate-400 font-bold">لا توجد سجلات حالياً</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer / Summary Stats */}
                <div className="px-10 py-8 bg-slate-50/50 dark:bg-slate-800/80 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 flex justify-between items-center flex-row-reverse shrink-0">
                    <div className="flex gap-10 flex-row-reverse">
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">إجمالي ما تم سحبه</p>
                            <p className="text-3xl font-black text-slate-900 dark:text-white">{(wallet.withdrawRequests || []).reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()} <span className="text-sm font-bold opacity-30 tracking-tight">ج.م</span></p>
                        </div>
                        <div className="w-px h-12 bg-slate-200 dark:bg-slate-700 mx-4"></div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">عدد العمليات الناجحة</p>
                            <p className="text-3xl font-black text-emerald-500">{(wallet.withdrawRequests || []).filter(r => r.status === 'accepted').length}</p>
                        </div>
                    </div>
                    <div>
                        <button onClick={() => setModalMode('none')} className="px-10 py-5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-[1.8rem] font-black shadow-2xl transition-all hover:scale-105 active:scale-95 text-xs tracking-widest">إغلاق المجلد</button>
                    </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Withdrawal Confirmation Modal */}
      <AnimatePresence>
        {modalMode === 'withdraw_confirm' && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md" onClick={() => setModalMode('withdraw')}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-10 space-y-8">
                {/* Yellow Icon Container */}
                <div className="relative mx-auto w-24 h-24">
                  <div className="absolute inset-0 bg-amber-400/10 rounded-full animate-ping"></div>
                  <div className="relative w-full h-full bg-amber-50 dark:bg-amber-500/10 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-900 shadow-lg">
                    <AlertCircle size={48} className="text-amber-500" />
                  </div>
                </div>
                
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">تأكيد عملية السحب</h3>
                  <p className="text-xs text-slate-400 font-bold">يرجى مراجعة تفاصيل العملية قبل التأكيد</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-[2.5rem] p-8 space-y-6 border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center flex-row-reverse border-b border-slate-200/50 dark:border-slate-700/50 pb-4">
                    <span className="text-xs text-slate-500 font-bold">وجهة التحويل</span>
                    <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                      {preferredMethod === 'bank' ? 'حساب بنكي' : 
                       preferredMethod === 'wallet' ? 'محفظة إلكترونية' : 
                       preferredMethod === 'instapay' ? 'إنستاباي' : 
                       `خزينة: ${treasury?.accounts.find(a => a.id === selectedTreasuryId)?.name || 'غير محدد'}`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center flex-row-reverse border-b border-slate-200/50 dark:border-slate-700/50 pb-4">
                    <span className="text-xs text-slate-500 font-bold">المبلغ المسحوب</span>
                    <span className="text-sm font-black text-slate-800 dark:text-white">{parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ج.م</span>
                  </div>
                  <div className="flex justify-between items-center flex-row-reverse border-b border-slate-200/50 dark:border-slate-700/50 pb-4">
                    <span className="text-xs text-slate-500 font-bold text-rose-500">رسوم العملية</span>
                    <span className="text-sm font-black text-rose-500">+{currentWithdrawFee.toLocaleString()} ج.م</span>
                  </div>
                  <div className="flex justify-between items-center flex-row-reverse pt-2">
                    <span className="text-xs text-slate-800 dark:text-slate-200 font-black">إجمالي الخصم من المحفظة</span>
                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{(parseFloat(amount) + currentWithdrawFee).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ج.م</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={confirmWithdraw}
                    className="flex-[2] py-5 bg-indigo-600 text-white rounded-[1.8rem] font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 text-sm"
                  >
                    تأكيد السحب الآن
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setModalMode('withdraw')}
                    className="flex-1 py-5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-[1.8rem] font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-sm"
                  >
                    إلغاء
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Supply Transfer Modal */}
      <AnimatePresence>
        {modalMode === 'transfer_supply' && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md" onClick={() => setModalMode('none')}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-10 space-y-8">
                <div className="flex justify-between items-center flex-row-reverse">
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">إدارة رأس المال</h3>
                    <button onClick={() => setModalMode('none')} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={24}/></button>
                </div>

                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                    <button 
                        onClick={() => setTransferDirection('to_supply')}
                        className={`flex-1 py-3 text-center rounded-xl font-black text-xs transition-all ${transferDirection === 'to_supply' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        تحويل للمخزون
                    </button>
                    <button 
                        onClick={() => setTransferDirection('from_supply')}
                        className={`flex-1 py-3 text-center rounded-xl font-black text-xs transition-all ${transferDirection === 'from_supply' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        استرداد للمحفظة
                    </button>
                </div>

                <form onSubmit={handleTransferSupply} className="space-y-6">
                    <div className="space-y-3">
                        <label className="text-sm font-black text-slate-600 dark:text-slate-400 block text-right">المبلغ المراد تحويله</label>
                        <div className="relative">
                            <input
                                type="number"
                                value={supplyAmount}
                                onChange={e => setSupplyAmount(e.target.value)}
                                className="w-full p-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-center text-2xl font-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all dark:text-white"
                                placeholder="0.00"
                                required
                            />
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-400">ج.م</div>
                        </div>
                        <div className="flex justify-between flex-row-reverse text-[10px] font-bold text-slate-400 px-2">
                           <span>الرصيد المتاح: {transferDirection === 'to_supply' ? walletStats.liveBalance.toLocaleString() : walletStats.supplyBalance.toLocaleString()} ج.م</span>
                        </div>
                    </div>

                    <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-[2rem] border border-indigo-100 dark:border-indigo-500/20 text-right">
                        <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 leading-relaxed">
                            {transferDirection === 'to_supply' 
                                ? 'سيتم خصم المبلغ من محفظتك الأساسية وإضافته لمحفظة الموردين. هذا المبلغ سيُستخدم حصرياً لتمويل مشتريات البضاعة.' 
                                : 'سيتم استرداد المبلغ من محفظة الموردين وإعادته لمحفظتك الأساسية المتاحة للسحب.'}
                        </p>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all text-sm"
                    >
                        تأكيد العملية
                    </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Error / Alert Modal */}
      <AnimatePresence>
        {modalMode === 'error' && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md" onClick={() => setModalMode('none')}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-10 text-center space-y-8">
                <div className="w-24 h-24 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center mx-auto border-4 border-white dark:border-slate-900 shadow-xl">
                    <AlertTriangle size={48} className="text-rose-500" />
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white">{errorConfig.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-bold leading-relaxed">{errorConfig.message}</p>
                </div>

                <button 
                  onClick={() => setModalMode('none')}
                  className="w-full py-5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-[2rem] font-black shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] text-sm"
                >
                  فهمت ذلك
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* COD History Modal */}
      <AnimatePresence>
        {modalMode === 'cod_history' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8 bg-slate-950/40 backdrop-blur-xl" onClick={() => setModalMode('none')}>
             <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-900 w-full h-full max-w-7xl rounded-none md:rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800"
                onClick={e => e.stopPropagation()}
             >
                {/* Header */}
                <div className="px-10 py-8 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 flex justify-between items-center flex-row-reverse shrink-0">
                    <div className="flex items-center gap-6 flex-row-reverse">
                        <div className="text-right">
                            <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">المدفوعات من الدفع عند الاستلام</h2>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
                            <span>المحفظة</span>
                            <ChevronRight size={14} className="rotate-180" />
                        </div>
                    </div>
                    <button onClick={() => setModalMode('none')} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all group">
                        <X size={28} className="group-hover:rotate-90 transition-transform"/>
                    </button>
                </div>

                {/* Filters */}
                <div className="px-10 py-6 bg-slate-50/50 dark:bg-slate-800/30 flex gap-4 overflow-x-auto no-scrollbar flex-row-reverse border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="relative min-w-[280px]">
                        <ChevronRight size={16} className="absolute left-4 top-1/2 -translate-y-1/2 rotate-90 text-slate-300" />
                        <select className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 font-bold text-xs outline-none text-right appearance-none shadow-sm cursor-pointer text-slate-500">
                            <option>حالة عمليات الدفع عند الاستلام</option>
                            <option>تمت إضافتها للمحفظة</option>
                            <option>قيد التوصيل</option>
                        </select>
                    </div>
                    <div className="relative min-w-[280px]">
                        <Calendar size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300"/>
                        <input type="text" placeholder="اختر التاريخ" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-6 pr-12 py-4 font-bold text-xs outline-none text-right shadow-sm text-slate-500" />
                    </div>
                </div>

                {/* Content Table */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-10">
                    <div className="bg-white dark:bg-slate-900 rounded-lg overflow-hidden border border-slate-50 dark:border-slate-800/50">
                        <table className="w-full text-right border-collapse text-[11px] font-bold">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-800/20 text-slate-400">
                                    <th className="p-6 font-bold">رقم الطلب</th>
                                    <th className="p-6 font-bold">تاريخ التوصيل</th>
                                    <th className="p-6 font-bold">الشركة</th>
                                    <th className="p-6 font-bold">الحالة</th>
                                    <th className="p-6 font-bold">مبلغ الدفع عند الاستلام</th>
                                    <th className="p-6 font-bold">رسوم تحصيل الدفع عند الاستلام</th>
                                    <th className="p-6 font-bold text-center">الرسوم</th>
                                    <th className="p-6 font-bold text-center">المجموع</th>
                                    <th className="p-6 font-bold text-center">متاح في</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                {orders.filter(o => (!o.paymentMethod || ['cod', 'كاش', 'cash', 'الدفع عند الاستلام', 'دفع عند الاستلام'].includes(o.paymentMethod)) && (o.status === 'تم_توصيلها' || o.status === 'تم_التوصيل' || o.status === 'تم_التحصيل' || o.status === 'قيد_الشحن' || o.status === 'تم_الارسال' || o.status === 'مدفوعة')).map((o, idx) => {
                                    const { netRevenue } = calculateOrderProfitLoss(o, settings);
                                    const advance = Number(o.advancePayment) || 0;
                                    
                                    const isDefinitivelyPosOrder = o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر' || o.shippingArea === 'نقطة البيع' || (o.id && o.id.startsWith('POS-'));
                                    const compFeesLocal = settings?.companySpecificFees?.[o.shippingCompany];
                                    const useCustomLocal = compFeesLocal?.useCustomFees ?? false;
                                    const inspectionFee = !isDefinitivelyPosOrder && (o.includeInspectionFee !== false) && (o.inspectionFeePaidByCustomer !== false) ? (useCustomLocal ? (compFeesLocal?.inspectionFee ?? 0) : (settings?.enableInspection ? settings.inspectionFee : 0)) : 0;
                                    const tax = Number((o as any).tax) || 0;

                                    const total = o.totalAmountOverride ?? (Number(o.productPrice || 0) + Number(o.shippingFee || 0) + tax + inspectionFee - Number(o.discount || 0) - advance);
                                    const isCollected = o.status === 'تم_التحصيل';
                                    return (
                                        <tr key={o.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/10 transition-all">
                                            <td className="p-6 text-indigo-600 font-bold">#{o.orderNumber}</td>
                                            <td className="p-6 text-slate-500">{o.date ? new Date(o.date).toLocaleDateString('en-GB') : '-'}</td>
                                            <td className="p-6">
                                                <div className="flex items-center gap-2 justify-end">
                                                    <span className="text-slate-600">{o.shippingCompany || 'آرامكس'}</span>
                                                    <div className="w-6 h-6 bg-rose-600 rounded-full flex items-center justify-center text-[8px] text-white font-bold">A</div>
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-[9px] ${
                                                    isCollected 
                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400' 
                                                    : 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400'
                                                }`}>
                                                    <div className={`w-1 h-1 rounded-full ${isCollected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                    {isCollected ? 'تمت إضافتها للمحفظة' : 'قيد التوصيل / بانتظار التحصيل'}
                                                </div>
                                            </td>
                                            <td className="p-6 text-slate-800 dark:text-slate-100">{total.toLocaleString()} ج.م</td>
                                            <td className="p-6 text-slate-400 text-center">-</td>
                                            <td className="p-6 text-slate-400 text-center">-</td>
                                            <td className="p-6 text-slate-800 dark:text-slate-100 font-black">{total.toLocaleString()} ج.م</td>
                                            <td className="p-6 text-slate-600 text-center">{isCollected ? 'متاح الآن' : 'بانتظار التحصيل'}</td>
                                        </tr>
                                    );
                                 })}
                                {orders.filter(o => (!o.paymentMethod || ['cod', 'كاش', 'cash', 'الدفع عند الاستلام', 'دفع عند الاستلام'].includes(o.paymentMethod)) && (o.status === 'تم_توصيلها' || o.status === 'تم_التوصيل' || o.status === 'تم_التحصيل' || o.status === 'قيد_الشحن' || o.status === 'تم_الارسال' || o.status === 'مدفوعة')).length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="p-20 text-center text-slate-400 font-bold">لا توجد عمليات دفع خاضعة للتحصيل حالياً</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmationModal 
        isOpen={!!txToDelete}
        message="هل أنت متأكد من حذف هذه العملية؟ سيتم تعديل الرصيد تلقائياً إذا كانت العملية قد اكتملت."
        onConfirm={confirmDeleteTransaction}
        onCancel={() => setTxToDelete(null)}
      />
    </div>
  );
};

export default WalletPage;
