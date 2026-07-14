import React, { useState, useMemo, useEffect } from 'react';
import { Wallet, Transaction, TransactionCategory, Settings, Treasury, TreasuryTransaction, PartnerTransaction } from '../types';
import { DollarSign, Plus, TrendingDown, PieChart as PieChartIcon, Calendar, Trash2, Tag, Receipt, Landmark, User, Info, Printer, Download, Filter, Search, Grid, List, Zap, CreditCard, ArrowUpRight, CheckCircle2, AlertCircle, RefreshCw, Layers, Sparkles, Building2, Wallet as WalletIcon, Copy, Check, ChevronRight, X, ArrowDownRight, ShieldCheck } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { TRANSACTION_CATEGORY_LABELS } from '../constants';

interface ExpensesPageProps {
  wallet: Wallet;
  setWallet: React.Dispatch<React.SetStateAction<Wallet>>;
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
  treasury?: Treasury;
  setTreasury?: (updater: any) => void;
}

const getPayerInfo = (exp: Transaction, settings: any, treasury?: Treasury) => {
  if (exp.details?.paidByPartnerId) {
    const p = settings.partners?.find((p: any) => p.id === exp.details?.paidByPartnerId);
    return {
      text: p ? `🤝 شريك: ${p.name}` : '🤝 سداد شريك',
      icon: <User size={12} />,
      colorClass: 'text-amber-700 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 font-bold',
      type: 'partner'
    };
  }
  if (exp.details?.expensePaidBy && exp.details.expensePaidBy.trim() !== '') {
    return {
      text: `🤝 بواسطة: ${exp.details.expensePaidBy}`,
      icon: <User size={12} />,
      colorClass: 'text-purple-700 bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800 font-bold',
      type: 'partner'
    };
  }
  if (exp.details?.treasuryAccountId === 'main_wallet' || exp.details?.paymentMethod === 'wallet' || exp.details?.paymentMethod === 'supply_wallet' || exp.details?.paymentMethod === 'cash') {
    return {
      text: '💳 المحفظة العامة (محفظة المتجر)',
      icon: <WalletIcon size={12} />,
      colorClass: 'text-blue-700 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 font-bold',
      type: 'treasury'
    };
  }
  if (exp.details?.treasuryAccountId) {
    const acc = treasury?.accounts.find(a => a.id === exp.details?.treasuryAccountId);
    if (acc) {
      const typeIcon = acc.type === 'bank' ? <Building2 size={12} /> : acc.type === 'wallet' ? <WalletIcon size={12} /> : <Landmark size={12} />;
      return {
        text: `${acc.name} (${acc.type === 'bank' ? 'بنك' : acc.type === 'wallet' ? 'محفظة' : 'خزينة'})`,
        icon: typeIcon,
        colorClass: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 font-bold',
        type: 'treasury'
      };
    } else if (exp.details.treasuryAccountId === 'main_wallet') {
      return {
        text: '💳 المحفظة العامة',
        icon: <WalletIcon size={12} />,
        colorClass: 'text-blue-700 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 font-bold',
        type: 'treasury'
      };
    }
  }
  if (exp.note && (exp.note.includes('بواسطة') || exp.note.includes('شريك') || exp.note.includes('شركاء') || exp.note.includes('دفعهم'))) {
    let pName = 'سداد شركاء';
    if (exp.note.includes('بواسطة')) {
      const parts = exp.note.split('بواسطة');
      pName = parts[1]?.trim() || 'شريك';
      if (pName.startsWith(':')) pName = pName.substring(1).trim();
      pName = pName.replace(/\)$/, '').trim();
    } else if (exp.note.includes('دفعهم')) {
      const idx = exp.note.indexOf('دفعهم');
      pName = exp.note.substring(idx).replace(/\)$/, '').trim();
    }
    return {
      text: `🤝 بواسطة: ${pName}`,
      icon: <User size={12} />,
      colorClass: 'text-amber-700 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 font-bold',
      type: 'partner'
    };
  }
  return {
    text: '💳 المحفظة العامة / الخزينة',
    icon: <WalletIcon size={12} />,
    colorClass: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 font-bold',
    type: 'treasury'
  };
};

const ExpensesPage: React.FC<ExpensesPageProps> = ({ wallet, setWallet, settings, updateSettings, treasury, setTreasury }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPartner, setFilterPartner] = useState('all');
  const [filterAccount, setFilterAccount] = useState('all'); // اختيار المحفظة / الخزينة في الفلاتر
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  
  // Add Expense Form States
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState('main_wallet');
  const [paymentSource, setPaymentSource] = useState<'treasury' | 'partner' | 'custody'>('treasury');
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [selectedCustodyId, setSelectedCustodyId] = useState('');
  const [category, setCategory] = useState<TransactionCategory>(
      (settings.expenseCategories && settings.expenseCategories.length > 0) 
      ? (settings.expenseCategories[0] as TransactionCategory) 
      : 'expense_ads'
  );

  useEffect(() => {
    if (!accountId) {
      setAccountId('main_wallet');
    }
  }, [accountId]);
  
  // Custom dialog & toast states
  const [dialog, setDialog] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
  } | null>(null);

  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit Payer Modal States
  const [editingPayerExp, setEditingPayerExp] = useState<Transaction | null>(null);
  const [editingPayerType, setEditingPayerType] = useState<'main_wallet' | 'treasury' | 'partner_text' | 'partner_id'>('main_wallet');
  const [editingPayerText, setEditingPayerText] = useState('');
  const [editingPayerAccId, setEditingPayerAccId] = useState('');
  const [editingPayerPartnerId, setEditingPayerPartnerId] = useState('');

  const handleOpenEditPayer = (exp: Transaction) => {
    setEditingPayerExp(exp);
    if (exp.details?.paidByPartnerId) {
      setEditingPayerType('partner_id');
      setEditingPayerPartnerId(exp.details.paidByPartnerId);
    } else if (exp.details?.expensePaidBy) {
      setEditingPayerType('partner_text');
      setEditingPayerText(exp.details.expensePaidBy);
    } else if (exp.note.includes('بواسطة') || exp.note.includes('دفعهم')) {
      setEditingPayerType('partner_text');
      if (exp.note.includes('بواسطة')) {
        const parts = exp.note.split('بواسطة');
        let pName = parts[1]?.trim() || 'شريك';
        if (pName.startsWith(':')) pName = pName.substring(1).trim();
        setEditingPayerText(pName.replace(/\)$/, '').trim());
      } else {
        const idx = exp.note.indexOf('دفعهم');
        setEditingPayerText(exp.note.substring(idx).replace(/\)$/, '').trim());
      }
    } else if (exp.details?.treasuryAccountId && exp.details.treasuryAccountId !== 'main_wallet') {
      setEditingPayerType('treasury');
      setEditingPayerAccId(exp.details.treasuryAccountId);
    } else {
      setEditingPayerType('main_wallet');
    }
  };

  const handleSavePayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayerExp) return;
    const id = editingPayerExp.id;
    
    setWallet(prevWallet => {
      const updated = prevWallet.transactions.map(t => {
        if (t.id !== id) return t;
        let newDetails = { ...t.details };
        let newNote = t.note;
        
        if (editingPayerType === 'main_wallet') {
          newDetails.treasuryAccountId = 'main_wallet';
          newDetails.paymentMethod = 'wallet';
          delete newDetails.paidByPartnerId;
          delete newDetails.expensePaidBy;
        } else if (editingPayerType === 'treasury') {
          newDetails.treasuryAccountId = editingPayerAccId;
          delete newDetails.paidByPartnerId;
          delete newDetails.expensePaidBy;
        } else if (editingPayerType === 'partner_id') {
          newDetails.paidByPartnerId = editingPayerPartnerId;
          delete newDetails.treasuryAccountId;
          delete newDetails.expensePaidBy;
        } else if (editingPayerType === 'partner_text') {
          newDetails.expensePaidBy = editingPayerText;
          delete newDetails.treasuryAccountId;
          delete newDetails.paidByPartnerId;
          if (!newNote.includes('بواسطة') && !newNote.includes('دفعهم') && !newNote.includes('شريك')) {
            newNote = `${newNote} - دفع بواسطة: ${editingPayerText}`;
          } else if (newNote.includes('بواسطة:')) {
            newNote = newNote.replace(/بواسطة:.*$/, `بواسطة: ${editingPayerText}`);
          }
        }
        return { ...t, note: newNote, details: newDetails };
      });
      return { ...prevWallet, transactions: updated };
    });
    
    showToast('تم تحديث مصدر الدفع / جهة السداد بنجاح');
    setEditingPayerExp(null);
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setToast({message, type});
      setTimeout(() => setToast(null), 3000);
  };

  const handleCopyNote = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('تم نسخ التفاصيل بنجاح');
    setTimeout(() => setCopiedId(null), 2000);
  };


  const liveBalance = useMemo(() => {
    return wallet.balance ?? (wallet.transactions || []).reduce((sum, t) => {
        const amount = Number(t.amount) || 0;
        if (t.category === 'supply_purchase' || t.category === 'supply_deposit' || t.category?.startsWith('supply_expense_')) return sum;
        if ((t.details?.paidByPartnerId || t.details?.expensePaidBy || t.note?.includes('دفعهم') || t.note?.includes('شريك')) && !t.note?.includes('المحفظة المركزية')) return sum;
        if (t.type === 'إيداع') return t.status === 'completed' ? sum + amount : sum;
        if (t.type === 'سحب') return t.status === 'cancelled' ? sum : sum - amount;
        return sum;
    }, 0);
  }, [wallet.transactions, wallet.balance]);

  const expenses = useMemo(() => {
      const walletExps = wallet.transactions.filter(t => t.type === 'سحب' && t.category && (settings.expenseCategories || []).includes(t.category));
      
      const treasuryExps = (treasury?.transactions || [])
        .filter((t: any) => t.type === 'withdrawal' && t.category && (settings.expenseCategories || []).includes(t.category))
        .map((t: any) => ({
            id: t.id,
            type: 'سحب',
            amount: t.amount,
            date: t.date,
            note: t.description,
            category: t.category,
            status: 'completed',
            details: t.fromAccountId ? { accountId: t.fromAccountId } : undefined
        } as any));

      return [...walletExps, ...treasuryExps].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [wallet.transactions, treasury?.transactions, settings.expenseCategories]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
        // Category Filter
        const matchesCategory = filterCategory === 'all' || exp.category === filterCategory;
        
        // Partner Filter
        const matchesPartner = filterPartner === 'all' || 
            (exp.details?.paidByPartnerId === filterPartner) ||
            (exp.note.includes(settings.partners?.find(p => p.id === filterPartner)?.name || '___NEVER_MATCH___')) ||
            (exp.details?.expensePaidBy?.includes(settings.partners?.find(p => p.id === filterPartner)?.name || '___NEVER_MATCH___'));
        
        // Account / Wallet Filter (اختيار المحفظة في الاختيارات)
        const matchesAccount = filterAccount === 'all' ||
            (filterAccount === 'partner_personal' && (!!exp.details?.paidByPartnerId || !!exp.details?.expensePaidBy || exp.note.includes('سداد شريك') || exp.note.includes('تحمل شخصي') || exp.note.includes('بواسطة') || exp.note.includes('دفعهم') || exp.note.includes('شريك') || exp.note.includes('شركاء'))) ||
            (filterAccount === 'main_wallet' && (!exp.details?.treasuryAccountId || exp.details.treasuryAccountId === 'main_wallet' || exp.details.paymentMethod === 'wallet' || exp.details.paymentMethod === 'supply_wallet' || exp.details.paymentMethod === 'cash') && !exp.details?.paidByPartnerId && !exp.details?.expensePaidBy && !exp.note.includes('بواسطة') && !exp.note.includes('دفعهم')) ||
            (exp.details?.treasuryAccountId === filterAccount) ||
            (treasury?.accounts.find(a => a.id === filterAccount) && exp.note.includes(treasury?.accounts.find(a => a.id === filterAccount)!.name));
        
        // Period Filter
        let matchesPeriod = true;
        if (filterPeriod !== 'all') {
            const expDate = new Date(exp.date);
            const now = new Date();
            if (filterPeriod === 'today') {
                matchesPeriod = expDate.toDateString() === now.toDateString();
            } else if (filterPeriod === 'week') {
                const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                matchesPeriod = expDate >= oneWeekAgo;
            } else if (filterPeriod === 'month') {
                matchesPeriod = expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
            }
        }

        // Search Query
        const matchesSearch = !searchQuery || 
            exp.note.toLowerCase().includes(searchQuery.toLowerCase()) || 
            exp.amount.toString().includes(searchQuery) ||
            (exp.details?.note && exp.details.note.toLowerCase().includes(searchQuery.toLowerCase()));

        return matchesCategory && matchesPartner && matchesAccount && matchesPeriod && matchesSearch;
    }).map(exp => {
        if (filterPartner !== 'all') {
            const partnerName = settings.partners?.find(p => p.id === filterPartner)?.name;
            if (partnerName) {
                const text = exp.details?.expensePaidBy || exp.note;
                const regex = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*دفعهم\\s*${partnerName}`, 'i');
                const match = text.match(regex);
                if (match && parseFloat(match[1]) > 0) {
                    return { ...exp, amount: parseFloat(match[1]) };
                }
            }
        }
        return exp;
    });
  }, [expenses, filterCategory, filterPartner, filterAccount, filterPeriod, searchQuery, settings.partners, treasury?.accounts]);

  const expenseCategoriesConfig = useMemo(() => {
    const stringToColor = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const colors = [
            '#f43f5e', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', 
            '#06b6d4', '#ec4899', '#6366f1', '#14b8a6', '#f97316'
        ];
        return colors[Math.abs(hash) % colors.length];
    };

    const getLabel = (key: string) => {
        return TRANSACTION_CATEGORY_LABELS[key] || key;
    };

    return (settings.expenseCategories || []).map(cat => ({
        key: cat,
        label: getLabel(cat),
        color: stringToColor(cat)
    }));
  }, [settings.expenseCategories]);

  const stats = useMemo(() => {
      const total = filteredExpenses.reduce((sum, t) => sum + t.amount, 0);
      const treasuryTotal = filteredExpenses.filter(t => !t.details?.paidByPartnerId && !t.note.includes('بواسطة')).reduce((sum, t) => sum + t.amount, 0);
      const partnerTotal = filteredExpenses.filter(t => !!t.details?.paidByPartnerId || t.note.includes('بواسطة')).reduce((sum, t) => sum + t.amount, 0);
      const avgExpense = filteredExpenses.length > 0 ? Math.round(total / filteredExpenses.length) : 0;
      
      const categoryTotals = expenseCategoriesConfig.map(cat => ({
          name: cat.label,
          key: cat.key,
          value: filteredExpenses.filter(t => t.category === cat.key).reduce((sum, t) => sum + t.amount, 0),
          count: filteredExpenses.filter(t => t.category === cat.key).length,
          color: cat.color
      })).filter(c => c.value > 0).sort((a, b) => b.value - a.value);

      return { total, treasuryTotal, partnerTotal, avgExpense, count: filteredExpenses.length, categoryTotals };
  }, [filteredExpenses, expenseCategoriesConfig]);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('الرجاء إدخال مبلغ صحيح أكبر من الصفر', 'error');
      return;
    }

    if (paymentSource === 'treasury' && !accountId) {
      showToast('الرجاء اختيار حساب الخزينة أو المحفظة', 'error');
      return;
    }
    
    if (paymentSource === 'partner' && !selectedPartnerId) {
      showToast('الرجاء اختيار الشريك المساهم', 'error');
      return;
    }

    if (paymentSource === 'custody' && !selectedCustodyId) {
      showToast('الرجاء اختيار العهدة المسؤولة عن السداد', 'error');
      return;
    }

    const newTransactionId = Date.now().toString();

    if (paymentSource === 'partner') {
      const partner = (settings.partners || []).find(p => p.id === selectedPartnerId);
      if (!partner) return;

      const categoryLabel = TRANSACTION_CATEGORY_LABELS[category] || category;

      const partnerTx: PartnerTransaction = {
          id: newTransactionId + 'pt',
          partnerId: selectedPartnerId,
          type: 'expense_coverage',
          amount: numAmount,
          date: new Date().toISOString(),
          note: `سداد مصروفات (تحمل شخصي): ${description || 'مصروف عام'} (${categoryLabel})`
      };

      updateSettings({
          ...settings,
          partners: (settings.partners || []).map(p => p.id === selectedPartnerId ? { ...p, balance: (p.balance || 0) + numAmount } : p),
          partnerTransactions: [partnerTx, ...(settings.partnerTransactions || [])]
      });

      const walletTransaction: Transaction = {
          id: newTransactionId,
          type: 'سحب',
          amount: numAmount,
          date: new Date().toISOString(),
          note: `مصروف (بواسطة ${partner.name}): ${description || 'مصروف جديد'}`,
          category: category,
          status: 'completed',
          details: { paidByPartnerId: selectedPartnerId }
      };

      setWallet(prev => ({
          ...prev,
          transactions: [walletTransaction, ...prev.transactions]
      }));

      showToast(`تم تسجيل المصروف وقيده كذمة دائنة للشريك ${partner.name}`);
    } else if (paymentSource === 'custody') {
      const holder = (settings.cashHolders || []).find(h => h.userId === selectedCustodyId);
      if (!holder) return;

      const categoryLabel = TRANSACTION_CATEGORY_LABELS[category] || category;
      const dateStr = new Date().toISOString();

      // Update cashHolders balance
      const nextHolders = (settings.cashHolders || []).map(h => 
        h.userId === selectedCustodyId 
          ? { ...h, currentBalance: (h.currentBalance || 0) - numAmount, lastUpdated: dateStr } 
          : h
      );

      // Record a handover/deduction transaction for custody tracking
      const handoverId = `HND-EXP-${Date.now()}`;
      const handoverData: any = {
         id: handoverId,
         fromUserId: selectedCustodyId,
         fromUserName: holder.userName,
         toUserId: 'expense',
         toUserName: `مصروف: ${categoryLabel}`,
         amount: numAmount,
         date: dateStr,
         notes: `سداد مصروف من العهدة: ${description || 'مصروف عام'}`,
         status: 'completed'
      };

      updateSettings({
         ...settings,
         cashHolders: nextHolders,
         cashHandovers: [handoverData, ...(settings.cashHandovers || [])]
      });

      const walletTransaction: Transaction = {
          id: newTransactionId,
          type: 'سحب',
          amount: numAmount,
          date: dateStr,
          note: `مصروف (بواسطة عهدة ${holder.userName}): ${description || 'مصروف جديد'}`,
          category: category,
          status: 'completed',
          details: { expensePaidBy: holder.userName, cashHolderId: selectedCustodyId }
      };

      setWallet(prev => ({
          ...prev,
          transactions: [walletTransaction, ...prev.transactions]
      }));

      showToast(`تم تسجيل المصروف وخصمه من عهدة ${holder.userName}`);
    } else {
      const selectedAcc = treasury?.accounts.find(a => a.id === accountId);
      const accName = selectedAcc ? selectedAcc.name : (accountId === 'main_wallet' ? 'المحفظة العامة' : 'الخزينة');

      const newTransaction: Transaction = {
          id: newTransactionId,
          type: 'سحب',
          amount: numAmount,
          date: new Date().toISOString(),
          note: description || 'مصروف جديد',
          category: category,
          status: 'completed',
          details: { treasuryAccountId: accountId }
      };

      setWallet(prevWallet => {
          const currentBalance = Number(prevWallet.balance) || 0;
          return {
              ...prevWallet,
              balance: currentBalance - numAmount,
              transactions: [newTransaction, ...prevWallet.transactions]
          };
      });

      if (setTreasury && accountId !== 'main_wallet') {
        const treasuryTx: TreasuryTransaction = {
          id: newTransactionId,
          date: new Date().toISOString(),
          type: 'withdrawal',
          amount: numAmount,
          description: `مصروف (${TRANSACTION_CATEGORY_LABELS[category] || category}): ${description || 'مصروف عام'}`,
          fromAccountId: accountId
        };
        
        setTreasury((prev: Treasury) => {
          const updatedAccounts = prev.accounts.map(acc => 
            acc.id === accountId ? { ...acc, balance: acc.balance - numAmount } : acc
          );
          return {
            ...prev,
            accounts: updatedAccounts,
            transactions: [treasuryTx, ...(prev.transactions || [])]
          };
        });
      }

      showToast(`تم خصم ${numAmount.toLocaleString()} ج.م من ${accName} بنجاح`);
    }

    setShowAddModal(false);
    setAmount('');
    setDescription('');
    setSelectedPartnerId('');
    setSelectedCustodyId('');
  };

  const handlePrint = () => {
    window.print();
  };

  const exportToCSV = () => {
    if (filteredExpenses.length === 0) {
      showToast('لا توجد بيانات لتصديرها', 'error');
      return;
    }
    const headers = ["التاريخ", "الوقت", "البيان / الملاحظة", "التصنيف", "المبلغ (ج.م)", "مصدر الدفع / الخزينة"];
    const rows = filteredExpenses.map(exp => {
      const dateStr = new Date(exp.date).toLocaleDateString('ar-EG');
      const timeStr = new Date(exp.date).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'});
      const catLabel = TRANSACTION_CATEGORY_LABELS[exp.category || ''] || exp.category || 'مصروف عام';
      
      let payerStr = 'الخزينة العامة';
      if (exp.details?.paidByPartnerId) {
        const p = settings.partners?.find(p => p.id === exp.details?.paidByPartnerId);
        payerStr = p ? `سداد شريك: ${p.name}` : 'سداد شريك';
      } else if (exp.details?.treasuryAccountId) {
        const acc = treasury?.accounts.find(a => a.id === exp.details?.treasuryAccountId);
        payerStr = acc ? `${acc.name} (${acc.type === 'bank' ? 'بنك' : acc.type === 'wallet' ? 'محفظة' : 'خزينة'})` : 'خزينة / محفظة';
      } else if (exp.note.includes('بواسطة')) {
        payerStr = exp.note.split('بواسطة')[1]?.split(':')[0]?.trim() || 'سداد شريك';
      }

      return [
        `"${dateStr}"`,
        `"${timeStr}"`,
        `"${exp.note.replace(/"/g, '""')}"`,
        `"${catLabel}"`,
        exp.amount,
        `"${payerStr}"`
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `تقرير_المصروفات_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('تم تصدير تقرير المصروفات بنجاح');
  };

  const deleteExpense = (id: string) => {
      setDialog({
        isOpen: true,
        title: 'تأكيد حذف المصروف',
        message: 'هل أنت متأكد من رغبتك في حذف هذا المصروف؟ سيتم استرداد المبلغ تلقائياً إلى رصيد المحفظة وحساب الخزينة، أو تسوية ذمة الشريك الدائنة.',
        onConfirm: () => {
          const transactionToDelete = wallet.transactions.find(t => t.id === id);
          if (!transactionToDelete) {
              setDialog(null);
              return;
          }

          const txAccountToRefund = transactionToDelete.details?.treasuryAccountId;
          const paidByPartnerId = transactionToDelete.details?.paidByPartnerId;
          const amntoRefund = Number(transactionToDelete.amount) || 0;

          if (paidByPartnerId) {
              updateSettings({
                  ...settings,
                  partners: (settings.partners || []).map(p => p.id === paidByPartnerId ? { ...p, balance: (p.balance || 0) - amntoRefund } : p),
                  partnerTransactions: (settings.partnerTransactions || []).filter(pt => pt.id !== id + 'pt')
              });
          }

          setWallet(prevWallet => {
            const updatedTransactions = prevWallet.transactions.filter(t => t.id !== id);
            const currentBalance = Number(prevWallet.balance) || 0;
            const newBalance = (!paidByPartnerId && !transactionToDelete.details?.expensePaidBy && !transactionToDelete.note.includes('بواسطة') && !transactionToDelete.note.includes('دفعهم')) || txAccountToRefund ? currentBalance + amntoRefund : currentBalance;

            return {
                ...prevWallet,
                balance: newBalance,
                transactions: updatedTransactions
            };
          });

          if (setTreasury && amntoRefund > 0 && txAccountToRefund && txAccountToRefund !== 'main_wallet') {
            setTreasury((prev: Treasury) => {
              const updatedAccounts = prev.accounts.map(acc => 
                acc.id === txAccountToRefund ? { ...acc, balance: acc.balance + amntoRefund } : acc
              );
              return {
                ...prev,
                accounts: updatedAccounts,
                transactions: prev.transactions.filter(tx => tx.id !== id)
              };
            });
          }

          setDialog(null);
          showToast('تم حذف المصروف واسترداد القيمة بنجاح');
        }
      });
  };

  // Quick Expense Templates
  const applyTemplate = (catKey: TransactionCategory, title: string, suggestedAmount?: string) => {
    setCategory(catKey);
    setDescription(title);
    if (suggestedAmount) setAmount(suggestedAmount);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16 px-4 sm:px-8" dir="rtl">
      {/* Print-only Header */}
      <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
             <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
                <Receipt size={32} />
             </div>
             <div>
                <h1 className="text-3xl font-black text-slate-900">مصروفات المتجر العام</h1>
                <p className="text-sm text-slate-600 mt-1 uppercase tracking-widest font-bold">تقرير الضبط المالي والجرد التفصيلي</p>
             </div>
          </div>
          <div className="text-left text-xs font-bold text-slate-500 space-y-1">
            <div>تاريخ التقرير: {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <div>تاريخ الاستخراج: {new Date().toLocaleTimeString('ar-EG')}</div>
            <div className="text-slate-900 font-extrabold pt-2">إجمالي المصروفات في الفترة: {stats.total.toLocaleString()} ج.م</div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-8 border-t border-slate-200 pt-6">
           <div>
             <h3 className="text-sm font-black text-slate-900 mb-3 border-b border-slate-100 pb-1">أرصدة الخزائن والمحافظ المالية</h3>
             <div className="space-y-2">
                {treasury?.accounts.map(acc => (
                  <div key={acc.id} className="flex justify-between text-xs">
                    <span className="text-slate-600">{acc.name} ({acc.type === 'bank' ? 'بنك' : acc.type === 'wallet' ? 'محفظة' : 'خزينة'}):</span>
                    <span className="font-bold text-slate-900">{acc.balance.toLocaleString()} ج.م</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs border-t border-slate-100 pt-1 font-black">
                  <span>إجمالي السيولة المتاحة:</span>
                  <span>{(treasury?.accounts.reduce((sum, a) => sum + a.balance, 0) || 0).toLocaleString()} ج.م</span>
                </div>
             </div>
           </div>
           <div>
             <h3 className="text-sm font-black text-slate-900 mb-3 border-b border-slate-100 pb-1">ذمم ومسحوبات الشركاء (مديونيات)</h3>
             <div className="space-y-2">
                {settings.partners?.map(p => (
                  <div key={p.id} className="flex justify-between text-xs">
                    <span className="text-slate-600">{p.name}:</span>
                    <span className="font-bold text-slate-900">{p.balance?.toLocaleString() || 0} ج.م</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs border-t border-slate-100 pt-1 font-black">
                  <span>إجمالي مديونية الشركاء:</span>
                  <span>{(settings.partners?.reduce((sum, p) => sum + (p.balance || 0), 0) || 0).toLocaleString()} ج.م</span>
                </div>
             </div>
           </div>
        </div>
      </div>

      {dialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800 text-right animate-in zoom-in-95 duration-200" dir="rtl">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-500">
               <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center flex-shrink-0">
                  <AlertCircle size={26} />
               </div>
               <div>
                 <h3 className="font-black text-lg text-slate-900 dark:text-white">{dialog.title}</h3>
                 <p className="text-xs text-slate-400 font-bold">إجراء غير قابل للتراجع</p>
               </div>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-sm font-medium leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl">{dialog.message}</p>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setDialog(null)} className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer">إلغاء</button>
              <button onClick={dialog.onConfirm} className="px-5 py-2.5 rounded-xl bg-rose-600 text-white font-black hover:bg-rose-700 shadow-lg shadow-rose-600/20 transition-all cursor-pointer">تأكيد الحذف</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-6 z-50 px-6 py-4 rounded-2xl shadow-2xl text-white font-black flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300 ${toast.type === 'success' ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 'bg-gradient-to-r from-rose-600 to-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={22} /> : <AlertCircle size={22} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 rounded-[2.5rem] p-6 sm:p-10 shadow-2xl border border-slate-800 text-white print:hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-black tracking-wider">
              <Sparkles size={14} className="animate-spin" style={{ animationDuration: '4s' }} />
              <span>نظام الرقابة المالية والتكاليف الذكي</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-3">
              <Receipt className="text-rose-500 w-10 h-10 flex-shrink-0" />
              <span>إدارة المصروفات والتكاليف العامة</span>
            </h1>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed font-medium">
              تتبع النفقات التشغيلية، الإعلانات، الرواتب والالتزامات مع ربط مباشر بالأرصدة النقدية والمحافظ الإلكترونية وذمم الشركاء.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <button 
                onClick={exportToCSV} 
                className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 border border-white/10 text-white px-5 py-3.5 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer text-xs sm:text-sm"
            >
                <Download size={18} className="text-slate-300"/>
                <span>تصدير CSV</span>
            </button>
            <button 
                onClick={handlePrint} 
                className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 border border-white/10 text-white px-5 py-3.5 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer text-xs sm:text-sm"
            >
                <Printer size={18} className="text-slate-300"/>
                <span>طباعة تقرير</span>
            </button>
            <button 
                onClick={() => setShowAddModal(true)} 
                className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white px-7 py-3.5 rounded-2xl font-black shadow-xl shadow-rose-600/30 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer text-sm"
            >
                <Plus size={20} className="stroke-[3]"/>
                <span>تسجيل مصروف جديد</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bento Grid Analytics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 print:hidden">
        {/* Card 1: Total Expenses */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-rose-500/50 transition-all">
          <div className="absolute top-0 left-0 w-24 h-24 bg-rose-500/5 rounded-br-full pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-black text-slate-500 dark:text-slate-400">إجمالي المصروفات ({filterPeriod === 'all' ? 'الكل' : filterPeriod === 'today' ? 'اليوم' : filterPeriod === 'week' ? 'هذا الأسبوع' : 'هذا الشهر'})</span>
            <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <TrendingDown size={20} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight tabular-nums">
              {stats.total.toLocaleString()} <span className="text-sm font-bold text-slate-400">ج.م</span>
            </div>
            <div className="flex items-center gap-2 mt-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-xl w-max">
              <span>{stats.count} عملية مسجلة</span>
              <span>•</span>
              <span className="text-rose-600 dark:text-rose-400">متوسط {stats.avgExpense.toLocaleString()} ج.م</span>
            </div>
          </div>
        </div>

        {/* Card 2: Treasury Liquidity */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-indigo-500/50 transition-all">
          <div className="absolute top-0 left-0 w-24 h-24 bg-indigo-500/5 rounded-br-full pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-black text-slate-500 dark:text-slate-400">سيولة الخزائن والمحافظ المتاحة</span>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <WalletIcon size={20} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight tabular-nums">
              {(treasury?.accounts.reduce((sum, a) => sum + a.balance, 0) || 0).toLocaleString()} <span className="text-sm font-bold text-slate-400">ج.م</span>
            </div>
            <div className="flex items-center gap-1.5 mt-3 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1.5 rounded-xl w-max">
              <Building2 size={13} />
              <span>{treasury?.accounts.length || 0} حساب نشط للدفع</span>
            </div>
          </div>
        </div>

        {/* Card 3: Partner Liabilities */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-amber-500/50 transition-all">
          <div className="absolute top-0 left-0 w-24 h-24 bg-amber-500/5 rounded-br-full pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-black text-slate-500 dark:text-slate-400">ذمم الشركاء (سداد شخصي)</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <User size={20} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight tabular-nums">
              {stats.partnerTotal.toLocaleString()} <span className="text-sm font-bold text-slate-400">ج.م</span>
            </div>
            <div className="flex items-center gap-1.5 mt-3 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-xl w-max">
              <span>{((stats.partnerTotal / (stats.total || 1)) * 100).toFixed(0)}% من إجمالي المصاريف</span>
            </div>
          </div>
        </div>

        {/* Card 4: Treasury vs Partner Coverage */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-emerald-500/50 transition-all">
          <div className="absolute top-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-br-full pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-black text-slate-500 dark:text-slate-400">الخصم النقدي المباشر (خزائن)</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Landmark size={20} />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight tabular-nums">
              {stats.treasuryTotal.toLocaleString()} <span className="text-sm font-bold text-slate-400">ج.م</span>
            </div>
            <div className="flex items-center gap-1.5 mt-3 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl w-max">
              <ShieldCheck size={13} />
              <span>{((stats.treasuryTotal / (stats.total || 1)) * 100).toFixed(0)}% خصم مباشر من الأرصدة</span>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        {/* Category Breakdown Donut */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 sm:p-7 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-black text-lg text-slate-800 dark:text-white">توزيع التكاليف حسب البنود</h3>
                <p className="text-xs text-slate-400 mt-0.5">نسبة وتناسب التصنيفات التشغيلية</p>
              </div>
              <PieChartIcon className="text-slate-400" size={20} />
            </div>
            
            {stats.categoryTotals.length > 0 ? (
              <div className="flex flex-col items-center">
                <div className="w-52 h-52 relative flex items-center justify-center my-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.categoryTotals} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                        {stats.categoryTotals.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: '#0f172a', color: '#fff', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.2)' }} formatter={(val: number) => [`${val.toLocaleString()} ج.م`, 'المبلغ']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[11px] uppercase font-black text-slate-400">إجمالي البنود</span>
                    <span className="text-xl font-black text-slate-800 dark:text-white">{stats.categoryTotals.length}</span>
                  </div>
                </div>

                <div className="w-full space-y-2 mt-4 max-h-52 overflow-y-auto pr-1">
                  {stats.categoryTotals.map((cat, idx) => {
                    const percentage = ((cat.value / (stats.total || 1)) * 100).toFixed(1);
                    return (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }}></div>
                          <span className="font-extrabold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-3 font-mono">
                          <span className="text-slate-400 font-bold">{percentage}%</span>
                          <span className="font-black text-slate-900 dark:text-white">{cat.value.toLocaleString()} ج.م</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <PieChartIcon size={44} className="mb-3 opacity-30 text-slate-300 dark:text-slate-600"/>
                <p className="text-sm font-bold text-slate-500">لا توجد مصاريف مسجلة للتحليل</p>
                <p className="text-xs text-slate-400 mt-1">قم بتسجيل مصروفاتك لتظهر الرسوم البيانية وتوزيع البنود هنا</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Expenses Categories Bar Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 sm:p-7 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-black text-lg text-slate-800 dark:text-white">مقارنة التكاليف التشغيلية (أعلى البنود إنفاقاً)</h3>
              <p className="text-xs text-slate-400 mt-0.5">تحليل المبالغ المنفقة لكل تصنيف لمساعدتك في ترشيد النفقات</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300">
              <Layers size={14} className="text-rose-500" />
              <span>مقارنة مالية</span>
            </div>
          </div>

          {stats.categoryTotals.length > 0 ? (
            <div className="h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.categoryTotals} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} fontWeight={700} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" />
                  <YAxis stroke="#64748b" fontSize={11} fontWeight={700} tickLine={false} axisLine={false} tickFormatter={(val) => `${val >= 1000 ? (val / 1000) + 'k' : val}`} />
                  <Tooltip cursor={{ fill: 'rgba(244, 63, 94, 0.05)' }} contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: '#0f172a', color: '#fff', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.2)' }} formatter={(val: number) => [`${val.toLocaleString()} ج.م`, 'إجمالي المصروف']} />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]} maxBarSize={45}>
                    {stats.categoryTotals.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-80 flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <Layers size={44} className="mb-3 opacity-30 text-slate-300 dark:text-slate-600"/>
              <p className="text-sm font-bold text-slate-500">لا توجد بيانات كافية لعرض الرسم البياني</p>
              <p className="text-xs text-slate-400 mt-1">ابدأ بتسجيل المصروفات لتظهر المقارنات الإحصائية هنا</p>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Filter Bar ("اختيار المحفظة في الاختيارات") */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/60 dark:border-slate-800 shadow-sm space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Filter className="text-rose-500 w-5 h-5" />
            <h3 className="font-black text-base text-slate-800 dark:text-white">فلترة واختيارات المصروفات</h3>
            {(filterCategory !== 'all' || filterPartner !== 'all' || filterAccount !== 'all' || filterPeriod !== 'all' || searchQuery !== '') && (
              <button 
                onClick={() => {
                  setFilterCategory('all');
                  setFilterPartner('all');
                  setFilterAccount('all');
                  setFilterPeriod('all');
                  setSearchQuery('');
                }} 
                className="text-xs font-extrabold text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 px-3 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw size={12} />
                <span>إعادة ضبط</span>
              </button>
            )}
          </div>

          {/* View Toggle Table vs Grid */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-end sm:self-auto">
            <button 
              onClick={() => setViewMode('table')} 
              className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              title="عرض جدول"
            >
              <List size={16} />
              <span className="hidden md:inline">جدول تفصيلي</span>
            </button>
            <button 
              onClick={() => setViewMode('grid')} 
              className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              title="عرض بطاقات"
            >
              <Grid size={16} />
              <span className="hidden md:inline">بطاقات</span>
            </button>
          </div>
        </div>

        {/* Filter Dropdowns Grid including WALLET / ACCOUNT SELECTION */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Account / Wallet Filter (اختيار المحفظة في الاختيارات) */}
          <div className="relative">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 block flex items-center gap-1.5">
              <WalletIcon size={13} className="text-indigo-500" />
              <span>المحفظة / الخزينة (مصدر الدفع)</span>
            </label>
            <div className="relative">
              <select 
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
                className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black px-4 py-3 pr-9 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all cursor-pointer"
              >
                <option value="all">🏦 كل الخزائن والمحافظ والمساهمين</option>
                <optgroup label="💼 الحسابات المالية النشطة (خزائن/محافظ)">
                  {treasury?.accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.type === 'bank' ? '🏦' : acc.type === 'wallet' ? '📱' : acc.type === 'safe' ? '💵' : '🤝'} {acc.name} ({acc.balance.toLocaleString()} ج.م)
                    </option>
                  ))}
                </optgroup>
                <optgroup label="📌 خيارات أخرى">
                  <option value="partner_personal">🤝 سداد شخصي (من جيب شريك)</option>
                  <option value="main_wallet">💳 المحفظة العامة (بدون خزينة محددة)</option>
                </optgroup>
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" size={16} />
            </div>
          </div>

          {/* 2. Category Filter */}
          <div className="relative">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 block flex items-center gap-1.5">
              <Tag size={13} className="text-rose-500" />
              <span>تصنيف المصروف</span>
            </label>
            <div className="relative">
              <select 
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black px-4 py-3 pr-9 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/30 transition-all cursor-pointer"
              >
                <option value="all">🏷️ كل التصنيفات والبنود</option>
                {expenseCategoriesConfig.map(cat => (
                  <option key={cat.key} value={cat.key}>{cat.label}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" size={16} />
            </div>
          </div>

          {/* 3. Partner Filter */}
          <div className="relative">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 block flex items-center gap-1.5">
              <User size={13} className="text-amber-500" />
              <span>الشريك المساهم</span>
            </label>
            <div className="relative">
              <select 
                value={filterPartner}
                onChange={(e) => setFilterPartner(e.target.value)}
                className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black px-4 py-3 pr-9 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all cursor-pointer"
              >
                <option value="all">👤 كل المساهمين والشركاء</option>
                {(settings.partners || []).map(p => (
                  <option key={p.id} value={p.id}>{p.name} (مديونية: {p.balance?.toLocaleString() || 0} ج.م)</option>
                ))}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" size={16} />
            </div>
          </div>

          {/* 4. Period Filter */}
          <div className="relative">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 block flex items-center gap-1.5">
              <Calendar size={13} className="text-emerald-500" />
              <span>الفترة الزمنية</span>
            </label>
            <div className="relative">
              <select 
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value as any)}
                className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black px-4 py-3 pr-9 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all cursor-pointer"
              >
                <option value="all">📅 كل الفترات السابقة</option>
                <option value="today">🌞 اليوم فقط</option>
                <option value="week">📆 هذا الأسبوع</option>
                <option value="month">🗓️ هذا الشهر</option>
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" size={16} />
            </div>
          </div>

          {/* 5. Text Search */}
          <div className="relative">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 block flex items-center gap-1.5">
              <Search size={13} className="text-blue-500" />
              <span>بحث في التفاصيل والمبلغ</span>
            </label>
            <div className="relative">
              <input 
                type="text"
                placeholder="ابحث عن كلمة، مبلغ، ملاحظة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold pl-4 pr-10 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
              />
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expenses List & Display */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <span>سجل المصروفات المالي</span>
              <span className="bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-xs font-black px-2.5 py-0.5 rounded-full">{filteredExpenses.length}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">قائمة تفصيلية بكافة الحركات والقيود المالية مرتبة زمنياً</p>
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Receipt size={32} />
            </div>
            <h4 className="text-base font-black text-slate-700 dark:text-slate-300">لم يتم العثور على مصروفات مطابقة</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">تأكد من إعدادات الفلترة أو قم بتسجيل مصروف جديد باستخدام الزر العلوي</p>
            <button onClick={() => setShowAddModal(true)} className="mt-5 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all inline-flex items-center gap-2 cursor-pointer">
              <Plus size={16} />
              <span>تسجيل مصروف الآن</span>
            </button>
          </div>
        ) : viewMode === 'table' ? (
          /* Table View */
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4">البيان والتفاصيل</th>
                  <th className="px-6 py-4">التصنيف</th>
                  <th className="px-6 py-4">المحفظة / مصدر الدفع</th>
                  <th className="px-6 py-4">التاريخ والوقت</th>
                  <th className="px-6 py-4 text-center">القيمة (ج.م)</th>
                  <th className="px-6 py-4 text-center print:hidden">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredExpenses.map(exp => {
                  const catInfo = expenseCategoriesConfig.find(c => c.key === exp.category);
                  
                  // Determine Payer info
                  const payerBadge = getPayerInfo(exp, settings, treasury);

                  return (
                    <tr key={exp.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-850/50 transition-colors group">
                      <td className="px-6 py-4.5">
                        <div className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">{exp.note}</div>
                        {exp.details?.note && exp.details.note !== exp.note && (
                          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md w-max">
                            <Info size={11} />
                            <span>{exp.details.note}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4.5">
                        <span className="px-3 py-1 rounded-full text-[11px] font-black text-white inline-flex items-center gap-1.5 shadow-sm" style={{ backgroundColor: catInfo?.color || '#94a3b8' }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                          <span>{catInfo?.label || 'مصروف عام'}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs border ${payerBadge.colorClass}`}>
                            {payerBadge.icon}
                            <span>{payerBadge.text}</span>
                          </span>
                          <button 
                            onClick={() => handleOpenEditPayer(exp)} 
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="تعديل جهة الدفع أو الشريك لهذا المصروف"
                          >
                            <CreditCard size={13} />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4.5">
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                          {new Date(exp.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {new Date(exp.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-6 py-4.5 text-center">
                        <span className="font-black text-base text-rose-600 dark:text-rose-400 tabular-nums bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 rounded-xl border border-rose-200/50 dark:border-rose-900/40 inline-block">
                          -{exp.amount.toLocaleString()} ج.م
                        </span>
                      </td>
                      <td className="px-6 py-4.5 text-center print:hidden">
                        <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleCopyNote(exp.id, exp.note)} 
                            className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer"
                            title="نسخ البيان"
                          >
                            {copiedId === exp.id ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                          </button>
                          <button 
                            onClick={() => deleteExpense(exp.id)} 
                            className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                            title="حذف المصروف"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid Cards View */
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredExpenses.map(exp => {
              const catInfo = expenseCategoriesConfig.find(c => c.key === exp.category);
              
              const payerInfo = getPayerInfo(exp, settings, treasury);
              const payerText = payerInfo.text;
              const payerType = payerInfo.type;

              return (
                <div key={exp.id} className="bg-slate-50/80 dark:bg-slate-800/50 rounded-3xl p-5 border border-slate-200/60 dark:border-slate-750 flex flex-col justify-between hover:border-rose-500/40 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: catInfo?.color || '#f43f5e' }}></div>
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="px-3 py-1 rounded-full text-[11px] font-black text-white shadow-sm" style={{ backgroundColor: catInfo?.color || '#94a3b8' }}>
                        {catInfo?.label || 'مصروف عام'}
                      </span>
                      <span className="text-lg font-black text-rose-600 dark:text-rose-400 tabular-nums font-mono">
                        -{exp.amount.toLocaleString()} ج.م
                      </span>
                    </div>
                    
                    <h4 className="font-extrabold text-slate-800 dark:text-white text-sm mb-3 leading-relaxed">{exp.note}</h4>
                    
                    {exp.details?.note && exp.details.note !== exp.note && (
                      <p className="text-xs text-slate-500 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 mb-3">
                        {exp.details.note}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs mt-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 font-bold px-2.5 py-1 rounded-xl ${payerType === 'partner' ? 'text-amber-700 bg-amber-100/60 dark:bg-amber-950/50' : 'text-indigo-700 bg-indigo-100/60 dark:bg-indigo-950/50'}`}>
                        {payerType === 'partner' ? <User size={12} /> : <WalletIcon size={12} />}
                        <span>{payerText}</span>
                      </span>
                      <button 
                        onClick={() => handleOpenEditPayer(exp)} 
                        className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="تعديل جهة الدفع"
                      >
                        <CreditCard size={13} />
                      </button>
                    </div>

                    <div className="flex items-center gap-1 text-slate-400 font-mono text-[11px]">
                      <Calendar size={11} />
                      <span>{new Date(exp.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}</span>
                      <button onClick={() => deleteExpense(exp.id)} className="p-1 text-slate-400 hover:text-rose-600 transition-colors mr-1 cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Enhanced Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200 text-right" dir="rtl">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <Receipt size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black">تسجيل مصروف أو تكلفة جديدة</h2>
                  <p className="text-xs text-slate-400 mt-0.5">يتم خصم المبلغ تلقائياً وتحديث التقارير المالية</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              
              {/* Quick Template Shortcuts */}
              <div>
                <label className="text-xs font-black text-slate-500 dark:text-slate-400 mb-2 block flex items-center gap-1.5">
                  <Zap size={14} className="text-amber-500 fill-amber-500" />
                  <span>بنود سريعة بنقرة واحدة</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => applyTemplate('expense_ads', 'إعلانات ممولة على السوشيال ميديا')} className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-extrabold border border-rose-200/60 dark:border-rose-900/40 hover:bg-rose-100 transition-all cursor-pointer">📢 إعلانات وتسويق</button>
                  <button type="button" onClick={() => applyTemplate('expense_packaging', 'شراء كراتين وبلاستر وأدوات تغليف')} className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-extrabold border border-indigo-200/60 dark:border-indigo-900/40 hover:bg-indigo-100 transition-all cursor-pointer">📦 أدوات تغليف</button>
                  <button type="button" onClick={() => applyTemplate('expense_other', 'ضيافة ومشروبات المتجر')} className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-xs font-extrabold border border-amber-200/60 dark:border-amber-900/40 hover:bg-amber-100 transition-all cursor-pointer">☕ ضيافة ومشروبات</button>
                  <button type="button" onClick={() => applyTemplate('expense_shipping_fees', 'إكراميات ومصاريف شحن وتوصيل')} className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-extrabold border border-emerald-200/60 dark:border-emerald-900/40 hover:bg-emerald-100 transition-all cursor-pointer">🚚 شحن وإكراميات</button>
                  <button type="button" onClick={() => applyTemplate('expense_hr', 'سلفة / راتب موظف')} className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-xs font-extrabold border border-blue-200/60 dark:border-blue-900/40 hover:bg-blue-100 transition-all cursor-pointer">💼 سلف ورواتب</button>
                </div>
              </div>

              {/* Payment Source Selector */}
              <div>
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 mb-2 block flex items-center gap-1.5">
                  <CreditCard size={15} className="text-indigo-500" />
                  <span>مصدر الدفع (المحفظة / الخزينة / الشركاء / العهد)</span>
                </label>
                <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
                  <button 
                    type="button" 
                    onClick={() => setPaymentSource('treasury')} 
                    className={`py-3 px-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${paymentSource === 'treasury' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    <WalletIcon size={14} />
                    <span>خزينة / محفظة</span>
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setPaymentSource('partner')} 
                    className={`py-3 px-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${paymentSource === 'partner' ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    <User size={14} />
                    <span>شريك (شخصي)</span>
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setPaymentSource('custody')} 
                    className={`py-3 px-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${paymentSource === 'custody' ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    <Landmark size={14} />
                    <span>عهدة موظف/شريك</span>
                  </button>
                </div>
              </div>

              {/* Conditional Account, Partner, or Custody Select */}
              {paymentSource === 'treasury' ? (
                <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 space-y-2">
                  <label className="text-xs font-black text-indigo-950 dark:text-indigo-300 block flex items-center justify-between">
                    <span>اختر الحساب المالي المخصوم منه:</span>
                    {accountId && (
                      <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-bold">
                        رصيد الحساب: {(accountId === 'main_wallet' ? liveBalance : treasury?.accounts.find(a => a.id === accountId)?.balance || 0).toLocaleString()} ج.م
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <select 
                      required={paymentSource === 'treasury'} 
                      value={accountId} 
                      onChange={e => setAccountId(e.target.value)} 
                      className="w-full appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-4 pr-10 font-bold text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all cursor-pointer"
                    >
                      <option value="" disabled>-- اختر الخزينة أو البنك أو المحفظة --</option>
                      <option value="main_wallet">💳 المحفظة العامة (رصيد المحفظة: {liveBalance.toLocaleString()} ج.م)</option>
                      {treasury?.accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.type === 'bank' ? '🏦 بنك:' : acc.type === 'wallet' ? '📱 محفظة:' : '💵 خزينة:'} {acc.name} - (الرصيد: {acc.balance.toLocaleString()} ج.م)
                        </option>
                      ))}
                    </select>
                    <Landmark className="absolute right-3.5 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none" size={18}/>
                  </div>
                </div>
              ) : paymentSource === 'partner' ? (
                <div className="bg-amber-50/50 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/40 space-y-2">
                  <label className="text-xs font-black text-amber-950 dark:text-amber-300 block flex items-center justify-between">
                    <span>اختر الشريك الذي قام بالسداد من جيبه:</span>
                    <span className="text-[11px] text-amber-700 dark:text-amber-400 font-bold">سيتم قيد المبلغ كذمة دائنة له</span>
                  </label>
                  <div className="relative">
                    <select 
                      required={paymentSource === 'partner'} 
                      value={selectedPartnerId} 
                      onChange={e => setSelectedPartnerId(e.target.value)} 
                      className="w-full appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-4 pr-10 font-bold text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/40 transition-all cursor-pointer"
                    >
                      <option value="" disabled>-- اختر الشريك المساهم --</option>
                      {(settings.partners || []).map(p => (
                        <option key={p.id} value={p.id}>
                          👤 {p.name} - (رصيد مديونيته الحالي: {p.balance?.toLocaleString() || 0} ج.م)
                        </option>
                      ))}
                    </select>
                    <User className="absolute right-3.5 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none" size={18}/>
                  </div>
                </div>
              ) : (
                <div className="bg-teal-50/50 dark:bg-teal-950/20 p-4 rounded-2xl border border-teal-100 dark:border-teal-900/40 space-y-2">
                  <label className="text-xs font-black text-teal-950 dark:text-teal-300 block flex items-center justify-between">
                    <span>اختر العهدة النقدية المخصوم منها:</span>
                    {selectedCustodyId && (
                      <span className="text-teal-600 dark:text-teal-400 bg-teal-100/80 dark:bg-teal-950/80 px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-bold">
                        رصيد العهدة الحالي: {((settings.cashHolders || []).find(h => h.userId === selectedCustodyId)?.currentBalance || 0).toLocaleString()} ج.م
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <select 
                      required={paymentSource === 'custody'} 
                      value={selectedCustodyId} 
                      onChange={e => setSelectedCustodyId(e.target.value)} 
                      className="w-full appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-4 pr-10 font-bold text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-teal-500/40 transition-all cursor-pointer"
                    >
                      <option value="" disabled>-- اختر العهدة النقدية --</option>
                      {(settings.cashHolders || []).map(h => (
                        <option key={h.userId} value={h.userId}>
                          💼 {h.userName} - (الرصيد: {h.currentBalance?.toLocaleString() || 0} ج.م)
                        </option>
                      ))}
                    </select>
                    <User className="absolute right-3.5 top-1/2 -translate-y-1/2 text-teal-500 pointer-events-none" size={18}/>
                  </div>
                </div>
              )}

              {/* Expense Amount with Quick Buttons */}
              <div>
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5 block flex items-center justify-between">
                  <span>قيمة المصروف (ج.م)</span>
                  {amount && parseFloat(amount) > 0 && (
                    <span className="text-rose-600 dark:text-rose-400 font-mono font-black text-xs">خصم مباشر: -{parseFloat(amount).toLocaleString()} ج.م</span>
                  )}
                </label>
                <div className="relative">
                  <input 
                    type="number" 
                    required 
                    autoFocus 
                    value={amount} 
                    onChange={e => setAmount(e.target.value)} 
                    className="w-full pl-4 pr-12 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-rose-500 font-black text-xl text-rose-600 dark:text-rose-400 tabular-nums transition-all" 
                    placeholder="0.00" 
                  />
                  <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[50, 100, 200, 500, 1000, 2000].map(val => (
                    <button 
                      key={val} 
                      type="button" 
                      onClick={() => setAmount(val.toString())} 
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-black transition-all cursor-pointer"
                    >
                      +{val}
                    </button>
                  ))}
                  {amount && (
                    <button 
                      type="button" 
                      onClick={() => setAmount('')} 
                      className="px-3 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-black transition-all ml-auto cursor-pointer"
                    >
                      مسح
                    </button>
                  )}
                </div>
              </div>

              {/* Category Selection Grid */}
              <div>
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 mb-2 block">تصنيف المصروف</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {expenseCategoriesConfig.map(cat => {
                    const isSelected = category === cat.key;
                    return (
                      <button 
                        key={cat.key} 
                        type="button" 
                        onClick={() => setCategory(cat.key as any)}
                        className={`p-3 rounded-2xl text-xs font-extrabold border transition-all flex items-center gap-2 cursor-pointer ${isSelected ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-600 dark:text-rose-400 shadow-sm scale-[1.02]' : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}
                      >
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }}></div>
                        <span className="truncate">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description / Notes */}
              <div>
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5 block">البيان / تفاصيل وملاحظات المصروف</label>
                <textarea 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500/40 dark:text-white font-bold text-sm h-24 resize-none transition-all" 
                  placeholder="اكتب تفاصيل المصروف، الفاتورة أو الجهة المستفيدة هنا..." 
                />
              </div>

              {/* Submit / Cancel Footer */}
              <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button 
                  type="submit" 
                  className="flex-1 py-4 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-2xl font-black text-base shadow-xl shadow-rose-600/25 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={20} />
                  <span>تأكيد خصم المصروف</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)} 
                  className="px-6 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Payer Modal */}
      {editingPayerExp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:hidden" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="text-indigo-600 dark:text-indigo-400" size={22} />
                <h3 className="font-black text-lg text-slate-800 dark:text-white">تعديل مصدر الدفع / جهة السداد</h3>
              </div>
              <button onClick={() => setEditingPayerExp(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300">
              <span className="font-bold block mb-1">المصروف:</span>
              <span className="font-extrabold text-slate-800 dark:text-white">{editingPayerExp.note} ({editingPayerExp.amount} ج.م)</span>
            </div>
            <form onSubmit={handleSavePayer} className="space-y-4">
              <div>
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 mb-2 block">اختر نوع مصدر الدفع:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingPayerType('main_wallet')}
                    className={`p-3 rounded-2xl text-xs font-black border flex items-center gap-2 transition cursor-pointer ${editingPayerType === 'main_wallet' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                  >
                    <WalletIcon size={16} />
                    <span>💳 المحفظة العامة (محفظة المتجر)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPayerType('treasury')}
                    className={`p-3 rounded-2xl text-xs font-black border flex items-center gap-2 transition cursor-pointer ${editingPayerType === 'treasury' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                  >
                    <Landmark size={16} />
                    <span>🏦 خزينة أو حساب بنكي محدد</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPayerType('partner_text')}
                    className={`p-3 rounded-2xl text-xs font-black border flex items-center gap-2 transition cursor-pointer ${editingPayerType === 'partner_text' ? 'bg-amber-600 text-white border-amber-600 shadow-md' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'}`}
                  >
                    <User size={16} />
                    <span>🤝 سداد شركاء (كتابة أسماء / تفاصيل)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPayerType('partner_id')}
                    className={`p-3 rounded-2xl text-xs font-black border flex items-center gap-2 transition cursor-pointer ${editingPayerType === 'partner_id' ? 'bg-amber-600 text-white border-amber-600 shadow-md' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'}`}
                  >
                    <User size={16} />
                    <span>👤 تحديد شريك من القائمة</span>
                  </button>
                </div>
              </div>

              {editingPayerType === 'treasury' && (
                <div>
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5 block">اختر الحساب المالي:</label>
                  <select
                    required
                    value={editingPayerAccId}
                    onChange={e => setEditingPayerAccId(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs outline-none text-slate-800 dark:text-white cursor-pointer"
                  >
                    <option value="" disabled>-- اختر الحساب --</option>
                    {treasury?.accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.balance.toLocaleString()} ج.م)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editingPayerType === 'partner_id' && (
                <div>
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5 block">اختر الشريك المساهم:</label>
                  <select
                    required
                    value={editingPayerPartnerId}
                    onChange={e => setEditingPayerPartnerId(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs outline-none text-slate-800 dark:text-white cursor-pointer"
                  >
                    <option value="" disabled>-- اختر الشريك --</option>
                    {settings.partners?.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        👤 {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editingPayerType === 'partner_text' && (
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">اكتب أسماء الشركاء أو تفاصيل السداد:</label>
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {settings.partners?.map((p: any) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          if (!editingPayerText) setEditingPayerText(`300 دفعهم ${p.name} شريك`);
                          else setEditingPayerText(`${editingPayerText} و 300 دفعهم ${p.name} شريك`);
                        }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 hover:bg-amber-200 cursor-pointer transition"
                      >
                        + {p.name}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="مثال: 300 دفعهم زهره شريك و 300 دفعهم البص شريك مدفعوين للسائق..."
                    value={editingPayerText}
                    onChange={e => setEditingPayerText(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs outline-none text-slate-800 dark:text-white"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-sm shadow-lg transition-all cursor-pointer"
                >
                  حفظ التعديل
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPayerExp(null)}
                  className="px-6 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-sm cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensesPage;
