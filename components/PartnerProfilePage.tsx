import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Settings, Partner, PartnerTransaction, Wallet, Transaction, Order } from '../types';
import { User, ArrowLeft, TrendingUp, DollarSign, ArrowDownRight, ArrowUpLeft, History, PieChart, Activity, Calendar, Download, Check, Package as PackageIcon, Truck, Coins, Trash2, Printer, Wallet as WalletIcon, PlusCircle, RefreshCw, CheckCircle2, Clock } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { motion } from 'motion/react';
import { printHTMLDirectly } from '../utils/printHelper';

import { Treasury } from '../types';

interface PartnerProfilePageProps {
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
  wallet: Wallet;
  setWallet: React.Dispatch<React.SetStateAction<Wallet>>;
  orders: Order[];
  treasury?: Treasury;
  setTreasury?: (updater: any) => void;
}

const PartnerProfilePage: React.FC<PartnerProfilePageProps> = ({ settings, updateSettings, wallet, setWallet, orders, treasury, setTreasury }) => {
  const { storeId, partnerId } = useParams<{ storeId: string; partnerId: string }>();
  const navigate = useNavigate();
  const [selectedTreasuryId, setSelectedTreasuryId] = useState('');
  
  const [custodyAmount, setCustodyAmount] = useState('');
  const [custodyType, setCustodyType] = useState<'give' | 'receive'>('give');
  const [custodyTreasuryId, setCustodyTreasuryId] = useState('');
  const [custodyNotes, setCustodyNotes] = useState('');

  const partner = useMemo(() => settings.partners?.find(p => p.id === partnerId), [settings.partners, partnerId]);
  const transactions = useMemo(() => (settings.partnerTransactions || []).filter(t => t.partnerId === partnerId && t.type !== 'pos_collection'), [settings.partnerTransactions, partnerId]);

  const partnerCustody = useMemo(() => {
    const holderId = `part_${partner?.id}`;
    const holder = (settings.cashHolders || []).find(h => h.userId === holderId || h.userId === partner?.id);
    return holder ? holder.currentBalance || 0 : 0;
  }, [settings.cashHolders, partner]);

  const executeCustodyTx = () => {
     const amount = parseFloat(custodyAmount);
     if (!amount || isNaN(amount) || amount <= 0) {
        alert('برجاء إدخال مبلغ صحيح');
        return;
     }
     if (!custodyTreasuryId) {
        alert('برجاء تحديد الخزينة/الحساب المالي المستخدم');
        return;
     }

     const isCentralWallet = custodyTreasuryId === 'central_wallet';
     const selectedAccount = isCentralWallet 
        ? { id: 'central_wallet', name: 'المحفظة الماليّة المركزيّة (الرصيد الأساسي)', balance: wallet.balance }
        : treasury?.accounts?.find((a: any) => a.id === custodyTreasuryId);

     if (!selectedAccount) return;

     let warningMsg = '';
     if (custodyType === 'give' && selectedAccount.balance < amount) {
        warningMsg = ' (تنبيه: رصيد الخزينة المختار أصبح بالسالب مؤقتاً)';
     }

     const partnerHolderId = `part_${partner?.id}`;
     const partnerHolderName = partner?.name || 'الشريك';
     const dateStr = new Date().toISOString();
     const handoverId = `HND-${Date.now()}`;

     let currentHolders = [...(settings.cashHolders || [])];
     const partnerIdx = currentHolders.findIndex(h => h.userId === partnerHolderId || h.userId === partner?.id);
     
     const fromUserId = custodyType === 'give' ? 'admin' : partnerHolderId;
     const fromUserName = custodyType === 'give' ? 'الادارة' : partnerHolderName;
     const toUserId = custodyType === 'give' ? partnerHolderId : `treasury_${custodyTreasuryId}`;
     const toUserName = custodyType === 'give' ? partnerHolderName : `الخزينة: ${selectedAccount.name}`;

     const handoverData: any = {
        id: handoverId,
        fromUserId,
        fromUserName,
        toUserId,
        toUserName,
        amount,
        date: dateStr,
        notes: custodyNotes || (custodyType === 'give' ? 'تسليم عهدة نقدية للشريك لشراء مخزون أو سداد مصروفات' : 'استلام واسترداد عهدة الشريك للخزينة ومطابقتها'),
        status: 'completed'
     };

     if (partnerIdx > -1) {
        const currentBal = Number(currentHolders[partnerIdx].currentBalance ?? 0);
        const nextBal = custodyType === 'give' ? currentBal + amount : currentBal - amount;
        currentHolders[partnerIdx] = {
           ...currentHolders[partnerIdx],
           currentBalance: nextBal,
           lastUpdated: dateStr
        };
     } else {
        const initialBal = custodyType === 'give' ? amount : -amount;
        currentHolders.push({
           userId: partnerHolderId,
           userName: partnerHolderName,
           currentBalance: initialBal,
           lastUpdated: dateStr
        });
     }

     if (isCentralWallet) {
        setWallet(prev => {
           const isGive = custodyType === 'give';
           const amountNum = amount;
           
           const walletTx: Transaction = {
              id: `W-CUST-${Date.now()}`,
              type: isGive ? 'سحب' : 'إيداع',
              amount: amountNum,
              date: dateStr,
              note: isGive 
                 ? `صرف عهدة نقدية للشريك ${partnerHolderName} من المحفظة المركزية: ${custodyNotes || 'عهدة جديدة'}`
                 : `تسوية واسترداد عهدة من الشريك ${partnerHolderName} للمحفظة المركزية: ${custodyNotes || 'توريد للمحفظة'}`,
              category: isGive ? 'manual_withdrawal' : 'manual_deposit',
              status: 'completed'
           } as Transaction;

           return {
              ...prev,
              balance: isGive ? prev.balance - amountNum : prev.balance + amountNum,
              transactions: [walletTx, ...(prev.transactions || [])]
           };
        });
     } else if (setTreasury && treasury) {
        setTreasury((prev: any) => {
           if (!prev) return prev;
           const updatedAccs = prev.accounts.map((acc: any) => {
              if (acc.id === custodyTreasuryId) {
                 return {
                    ...acc,
                    balance: custodyType === 'give' ? acc.balance - amount : acc.balance + amount
                 };
              }
              return acc;
           });

           const treasuryTx = {
              id: `T-CUST-PART-${Date.now()}`,
              date: dateStr,
              type: custodyType === 'give' ? 'withdrawal' : 'deposit',
              amount,
              description: custodyType === 'give' 
                 ? `صرف عهدة نقدية للشريك ${partnerHolderName}: ${custodyNotes || 'عهدة جديدة لدعم العمليات'}`
                 : `تسوية كاش واسترداد عهدة من الشريك ${partnerHolderName}: ${custodyNotes || 'توريد للخزينة'}`,
              toAccountId: custodyType === 'give' ? undefined : custodyTreasuryId,
              fromAccountId: custodyType === 'give' ? custodyTreasuryId : undefined,
              reference: handoverId
           };

           return {
              ...prev,
              accounts: updatedAccs,
              transactions: [treasuryTx, ...(prev.transactions || [])]
           };
        });
     }

     updateSettings({
        ...settings,
        cashHolders: currentHolders,
        cashHandovers: [handoverData, ...(settings.cashHandovers || [])],
        activityLogs: [
           {
              id: `log-${Date.now()}`,
              user: 'الادارة',
              action: custodyType === 'give' ? 'صرف عهدة للشريك' : 'تسوية عهدة الشريك',
              details: custodyType === 'give'
                 ? `تم صرف عهدة نقدية للشريك ${partnerHolderName} بقيمة ${amount.toLocaleString()} ج.م من حساب ${selectedAccount.name}`
                 : `تم استرداد عهدة نقدية من الشريك ${partnerHolderName} بقيمة ${amount.toLocaleString()} ج.م وتوريدها لحساب ${selectedAccount.name}`,
              date: new Date().toLocaleString('ar-EG'),
              timestamp: Date.now()
           },
           ...(settings.activityLogs || [])
        ]
     });

     setCustodyAmount('');
     setCustodyNotes('');
     alert('تم تسجيل عملية العهدة بنجاح وتحديث كشفي الحساب والخزائن.' + warningMsg);
  };

  const deleteCustodyTx = (h: any) => {
      setDialog({
          isOpen: true,
          title: 'تأكيد الحذف',
          message: 'هل أنت متأكد من مسح حركة العهدة؟ سيتم التراجع عن كل التغييرات المالية المتعلقة بها على الخزينة وحساب الشريك.',
          onConfirm: () => {
              const amount = h.amount;
              const isGive = h.fromUserId === 'admin' || h.toUserId === `part_${partner?.id}`;
              const tRef = h.id;

              const newHandovers = (settings.cashHandovers || []).filter((tx: any) => tx.id !== h.id);

              let currentHolders = [...(settings.cashHolders || [])];
              const partnerHolderId = `part_${partner?.id}`;
              const partnerIdx = currentHolders.findIndex((holder: any) => holder.userId === partnerHolderId || holder.userId === partner?.id);
              
              if (partnerIdx > -1) {
                  const currentBal = Number(currentHolders[partnerIdx].currentBalance ?? 0);
                  // Reverse the operation
                  const nextBal = isGive ? currentBal - amount : currentBal + amount;
                  currentHolders[partnerIdx] = {
                      ...currentHolders[partnerIdx],
                      currentBalance: nextBal,
                      lastUpdated: new Date().toISOString()
                  };
              }

              if (setTreasury && treasury) {
                  setTreasury((prev: any) => {
                      if (!prev) return prev;
                      
                      const linkedTreasuryTx = (prev.transactions || []).find((tx: any) => tx.reference === tRef);
                      let updatedAccounts = prev.accounts;
                      let updatedTxs = prev.transactions;
                      
                      if (linkedTreasuryTx) {
                          const accId = linkedTreasuryTx.toAccountId || linkedTreasuryTx.fromAccountId;
                          if (accId) {
                              updatedAccounts = prev.accounts.map((acc: any) => {
                                  if (acc.id === accId) {
                                      // If it was a deposit, we subtract to reverse it. If it was withdrawal, we add.
                                      const isDeposit = linkedTreasuryTx.toAccountId === accId;
                                      return {
                                          ...acc,
                                          balance: isDeposit ? acc.balance - amount : acc.balance + amount
                                      };
                                  }
                                  return acc;
                              });
                              updatedTxs = prev.transactions.filter((tx: any) => tx.reference !== tRef);
                          }
                      }

                      return {
                          ...prev,
                          accounts: updatedAccounts,
                          transactions: updatedTxs
                      };
                  });
              }

              updateSettings({
                  ...settings,
                  cashHandovers: newHandovers,
                  cashHolders: currentHolders
              });

              setDialog(null);
          }
      });
  };

  const [dialog, setDialog] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void, isWarning?: boolean} | null>(null);

  const deleteTransaction = (t: PartnerTransaction) => {
    // Check if it's explicitly linked to a system document
    const isLinkedExpense = t.id.endsWith('pt');
    const isSupplyOrder = t.id.startsWith('supply_pt_');

    if (isLinkedExpense || isSupplyOrder) {
       setDialog({
        isOpen: true,
        title: 'لا يمكن حذف المعاملة',
        message: isSupplyOrder 
          ? 'هذه المعاملة مرتبطة بفاتورة شراء أو مرتجع. يرجى تعديلها أو حذفها من قسم "الموردين وفواتير الشراء".'
          : 'هذه المعاملة مرتبطة بمصروف مسجل. يرجى حذفها من قسم "المصروفات والإيرادات" لضمان مزامنة الخزينة.',
        onConfirm: () => setDialog(null),
        isWarning: true
       });
       return;
    }

    setDialog({
      isOpen: true,
      title: 'تأكيد الحذف',
      message: 'هل أنت متأكد من حذف هذه المعاملة الخاصة بالشريك؟ قد يؤثر ذلك على رصيد الشريك.',
      onConfirm: () => {
        let currentBalance = partner?.balance || 0;
        const isAddition = ['capital_addition', 'repayment', 'supply_funding', 'shipping_funding', 'profit_distribution', 'expense_coverage'].includes(t.type);
        
        // Reverse the effect
        if (isAddition) {
            currentBalance -= t.amount;
        } else {
            currentBalance += t.amount;
        }

        const newPartners = (settings.partners || []).map(p => 
            p.id === partnerId ? { ...p, balance: currentBalance } : p
        );
        const newPartnerTransactions = (settings.partnerTransactions || []).filter(tx => tx.id !== t.id);

        updateSettings({
            ...settings,
            partners: newPartners,
            partnerTransactions: newPartnerTransactions
        });

        // Revert Treasury transaction
        if (setTreasury && treasury) {
          const tRef = `pt_${t.id}`;
          const linkedTreasuryTx = (treasury.transactions || []).find((tx: any) => tx.reference === tRef);
          if (linkedTreasuryTx) {
            const accId = linkedTreasuryTx.toAccountId || linkedTreasuryTx.fromAccountId;
            if (accId) {
              setTreasury((prev: any) => {
                if (!prev) return prev;
                const updatedAccounts = prev.accounts.map((acc: any) => {
                  if (acc.id === accId) {
                    const isDeposit = linkedTreasuryTx.toAccountId === accId;
                    return {
                      ...acc,
                      balance: isDeposit ? acc.balance - t.amount : acc.balance + t.amount
                    };
                  }
                  return acc;
                });
                const updatedTxs = prev.transactions.filter((tx: any) => tx.reference !== tRef);
                return {
                  ...prev,
                  accounts: updatedAccounts,
                  transactions: updatedTxs
                };
              });
            }
          }
        }

        // Revert global Wallet transaction and balance
        if (setWallet && t.type !== 'profit_distribution') {
          setWallet((prev: any) => {
            if (!prev) return prev;
            const walletTxId = `pt_w_${t.id}`;
            const updatedTransactions = (prev.transactions || []).filter((tx: any) => tx.id !== walletTxId);
            
            const isWithdrawal = t.type === 'loan' || t.type === 'profit_withdrawal' || t.type === 'expense_repayment';
            const isSupplyFunding = t.type === 'supply_funding';
            
            let newBalance = prev.balance;
            
            newBalance = isWithdrawal ? newBalance + t.amount : newBalance - t.amount;
            
            return {
              ...prev,
              balance: newBalance,
              transactions: updatedTransactions
            };
          });
        }

        setDialog(null);
      }
    });
  };

  const stats = useMemo(() => {
    if (!partner) return { totalInvested: 0, totalDividends: 0, totalWithdrawn: 0, totalLoans: 0, totalAdvances: 0, totalRepaid: 0 };
    return {
       totalInvested: transactions.filter(t => t.type === 'capital_addition' || t.type === 'supply_funding' || t.type === 'shipping_funding' || t.type === 'expense_coverage').reduce((sum, t) => sum + t.amount, 0),
       totalDividends: transactions.filter(t => t.type === 'profit_distribution').reduce((sum, t) => sum + t.amount, 0),
       totalWithdrawn: transactions.filter(t => t.type === 'profit_withdrawal').reduce((sum, t) => sum + t.amount, 0),
       totalLoans: transactions.filter(t => t.type === 'loan').reduce((sum, t) => sum + t.amount, 0),
       totalAdvances: transactions.filter(t => t.type === 'customer_advance').reduce((sum, t) => sum + t.amount, 0),
       totalRepaid: transactions.filter(t => t.type === 'repayment').reduce((sum, t) => sum + t.amount, 0),
    };
  }, [transactions, partner]);

  const chartData = useMemo(() => {
    if (!partner) return [];
    let currentBalance = 0;
    return transactions
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(t => {
            if (['capital_addition', 'repayment', 'supply_funding', 'shipping_funding', 'profit_distribution', 'expense_coverage', 'internal_transfer_in'].includes(t.type)) {
                currentBalance += t.amount;
            } else if (t.type !== 'pos_collection') {
                currentBalance -= t.amount;
            }
            return {
                date: new Date(t.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }),
                balance: currentBalance,
                amount: t.amount,
                type: t.type
            };
        });
  }, [transactions, partner]);

  const handlePrintStatement = () => {
    if (!partner) return;
    
    // Sort transactions chronologically 
    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const getTxTypeName = (type: string) => {
      switch (type) {
        case 'loan': return 'سلفة / سحب يدوي';
        case 'customer_advance': return 'عربون محصل من عميل';
        case 'capital_addition': return 'إيداع رأس مال جديد';
        case 'shipping_funding': return 'إيداع مصاريف الشحن';
        case 'profit_withdrawal': return 'سحب من حصة الأرباح';
        case 'profit_distribution': return 'إضافة أرباح من المستحقات';
        case 'supply_funding': return 'تمويل شراء بضاعة';
        case 'expense_coverage': return 'تغطية مصروفات';
        case 'expense_repayment': return 'استرداد مقابل مصروفات مدفوعة';
        case 'pos_collection': return 'استلام عهدة كاشير';
        case 'repayment': return 'سداد سلفة مالية';
        default: return 'معاملة مالية';
      }
    };

    const isAddition = (type: string) => 
      ['capital_addition', 'repayment', 'supply_funding', 'shipping_funding', 'profit_distribution', 'expense_coverage', 'internal_transfer_in'].includes(type);

    let rowsHtml = '';
    let runningBalance = 0;

    sortedTxs.forEach((t) => {
      const typeLabel = getTxTypeName(t.type);
      const isAdd = isAddition(t.type);
      const val = Number(t.amount) || 0;
      
      if (t.type === 'pos_collection') {
        // POS is balance neutral in partner balance
      } else if (isAdd) {
        runningBalance += val;
      } else {
        runningBalance -= val;
      }

      rowsHtml += `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
          <td style="padding: 12px; text-align: right; color: #475569;">${new Date(t.date).toLocaleDateString('ar-EG')}</td>
          <td style="padding: 12px; text-align: right; font-weight: bold; color: #1e293b;">${typeLabel}</td>
          <td style="padding: 12px; text-align: right; color: #64748b; max-width: 250px;">${t.note || '-'}</td>
          <td style="padding: 12px; text-align: left; font-weight: bold; color: ${isAdd ? '#10b981' : '#f43f5e'}">
            ${isAdd ? '+' : '-'}${val.toLocaleString()} ج.م
          </td>
          <td style="padding: 12px; text-align: left; font-weight: 900; color: #334155;">
            ${runningBalance.toLocaleString()} ج.م
          </td>
        </tr>
      `;
    });

    const html = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>كشف حساب الشريك - ${partner.name}</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            background-color: #ffffff;
            color: #1e293b;
            margin: 0;
            padding: 40px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px double #e2e8f0;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .title-area h1 {
            margin: 0 0 5px 0;
            font-size: 24px;
            font-weight: 900;
            color: #4f46e5;
          }
          .title-area p {
            margin: 0;
            font-size: 13px;
            color: #64748b;
          }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 40px;
            background: #f8fafc;
            padding: 20px;
            border-radius: 20px;
            border: 1px solid #e2e8f0;
          }
          .info-card {
            display: flex;
            flex-direction: column;
          }
          .info-card .label {
            font-size: 11px;
            color: #94a3b8;
            font-weight: 700;
            margin-bottom: 5px;
            text-transform: uppercase;
          }
          .info-card .value {
            font-size: 16px;
            font-weight: 950;
            color: #1e293b;
          }
          .table-container {
            width: 100%;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            text-align: right;
          }
          th {
            background-color: #f1f5f9;
            color: #475569;
            font-weight: 800;
            padding: 12px;
            font-size: 12px;
            border-bottom: 2px solid #cbd5e1;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-area">
            <h1>كشف الحساب المالي للشركاء</h1>
            <p>الشريك: ${partner.name} | نسبة الأرباح الشاملة: ${partner.profitRatio}%</p>
          </div>
          <div style="text-align: left;">
            <p style="margin: 0; font-weight: 950; color: #1e293b; font-size: 16px;">النظام المالي الموحد</p>
            <p style="margin: 5px 0 0 0; color: #64748b; font-size: 12px;">تاريخ استخراج المستند: ${new Date().toLocaleDateString('ar-EG')} ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-card">
            <span class="label">الرصيد الجاري المستحق</span>
            <span class="value" style="color: ${partner.balance >= 0 ? '#10b981' : '#f43f5e'}">${partner.balance.toLocaleString()} ج.م</span>
          </div>
          <div class="info-card">
            <span class="label">مجموع عمليات رأس المال والتمويل</span>
            <span class="value">${stats.totalInvested.toLocaleString()} ج.م</span>
          </div>
          <div class="info-card">
            <span class="label">صافي المعاملات المدينة والسلف</span>
            <span class="value">${(stats.totalLoans - stats.totalRepaid).toLocaleString()} ج.م</span>
          </div>
          <div class="info-card">
            <span class="label">المسحوبات الشخصية والأرباح</span>
            <span class="value">${stats.totalWithdrawn.toLocaleString()} ج.م</span>
          </div>
        </div>

        <div class="table-container">
          <h3 style="font-weight: 900; font-size: 15px; margin-bottom: 12px; color: #334155;">سجل الحركات المالية المصدقة</h3>
          <table>
            <thead>
              <tr>
                <th style="text-align: right; width: 15%;">التاريخ</th>
                <th style="text-align: right; width: 25%;">نوع المعاملة</th>
                <th style="text-align: right; width: 30%;">ملاحظات التفاصيل والبيان</th>
                <th style="text-align: left; width: 15%;">القيمة المعنية</th>
                <th style="text-align: left; width: 15%;">الرصيد التراكمي</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="5" style="text-align: center; padding: 30px; color: #94a3b8; font-weight: bold;">لا توجد معاملات جارية مسجلة.</td></tr>`}
            </tbody>
          </table>
        </div>
        
        <div style="margin-top: 65px; display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 20px;">
          <p>توقيع الإدارة المالية والتدقيق: ____________________</p>
          <p>توقيع ومصادقة الشريك: ____________________</p>
        </div>
      </body>
      </html>
    `;

    printHTMLDirectly(html);
  };

  if (!partner) {
    return (
      <div className="p-12 text-center space-y-4">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
           <User size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-800">الشريك غير موجود</h2>
        <button onClick={() => navigate(`/store/${storeId}/partners`)} className="text-indigo-600 font-bold hover:underline">العودة للشركاء</button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-8 bg-slate-50/30 dark:bg-slate-900/10 min-h-screen">
      {dialog && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl shadow-xl p-6 text-right" dir="rtl">
                <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">{dialog.title}</h3>
                <p className="text-slate-500 font-bold text-sm mb-6 leading-relaxed">{dialog.message}</p>
                <div className="flex gap-3">
                    {dialog.isWarning ? (
                        <button 
                            onClick={dialog.onConfirm}
                            className="flex-1 px-4 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 transition-colors"
                        >
                            حسناً
                        </button>
                    ) : (
                        <>
                            <button 
                                onClick={dialog.onConfirm}
                                className="flex-1 px-4 py-3 bg-rose-600 text-white font-black rounded-xl hover:bg-rose-700 transition-colors"
                            >
                                تأكيد الحذف
                            </button>
                            <button 
                                onClick={() => setDialog(null)}
                                className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            >
                                إلغاء
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate(`/store/${storeId}/partners`)} 
          className="group flex items-center gap-2 text-slate-500 font-bold hover:text-indigo-600 transition-colors"
        >
          <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-indigo-50 transition-colors">
            <ArrowLeft size={20} />
          </div>
          العودة للشركاء
        </button>

        <div className="flex gap-2">
            <button 
                onClick={handlePrintStatement}
                className="flex items-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
            >
                <Printer size={18} />
                <span className="text-xs font-black">طباعة كشف الحساب</span>
            </button>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center gap-6 sm:gap-8 justify-between relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        
        <div className="flex items-center gap-4 sm:gap-6 relative z-10 w-full sm:w-auto">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-indigo-600 text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/30 flex-shrink-0">
                <User size={40} className="sm:hidden" />
                <User size={48} className="hidden sm:block" />
            </div>
            <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white truncate max-w-[150px] sm:max-w-none">{partner.name}</h1>
                  <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-3 py-1 rounded-full uppercase">نشط</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
                  <PieChart size={14} className="sm:hidden" />
                  <PieChart size={16} className="hidden sm:block" />
                  <span className="hidden sm:inline">نسبة المشاركة في الأرباح:</span>
                  <span className="sm:hidden">أرباح:</span>
                  <span className="text-indigo-600 font-black">{partner.profitRatio}%</span>
                </p>
            </div>
        </div>

        <div className="text-center md:text-left relative z-10 w-full sm:w-auto mt-4 sm:mt-0">
            <p className="text-[10px] sm:text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">صافي الرصيد الحالي</p>
            <p className={`text-3xl sm:text-5xl font-black tracking-tighter ${partner.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {partner.balance.toLocaleString()} 
                <span className="text-lg sm:text-xl font-bold ml-2 text-slate-300">ج.م</span>
            </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-6">
          {[
            { label: 'إجمالي رأس المال المضاف', value: stats.totalInvested, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/20', icon: ArrowUpLeft },
            { label: 'الأرباح الموزعة له', value: stats.totalDividends, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/20', icon: TrendingUp },
            { label: 'الأرباح المسحوبة', value: stats.totalWithdrawn, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/20', icon: DollarSign },
            { label: 'إجمالي السلف الشخصية', value: stats.totalLoans, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/20', icon: ArrowDownRight },
            { label: 'العهد التشغيلية طرفه', value: partnerCustody, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/20', icon: WalletIcon },
            { label: 'صافي مديونية السلف', value: Math.max(0, stats.totalLoans - stats.totalRepaid), color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-700/20', icon: History },
          ].map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm"
            >
               <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 ${stat.bg} ${stat.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <stat.icon size={14} className="sm:hidden" />
                    <stat.icon size={16} className="hidden sm:block" />
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase line-clamp-1">{stat.label}</span>
               </div>
               <p className={`text-lg sm:text-2xl font-black ${stat.color} dark:text-white tracking-tight`}>
                  {stat.value.toLocaleString()} 
                  <span className="text-[10px] sm:text-xs font-bold ml-1 opacity-50">ج.م</span>
               </p>
            </motion.div>
          ))}
      </div>

      <div className="bg-indigo-50/80 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold text-slate-700 dark:text-slate-300">
        <div className="flex items-center gap-2">
           <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
           <span>💡 <strong>قاعدة الرصيد الصافي للشريك:</strong> (الأرباح الموزعة + رأس المال والإيداعات) - (المسحوبات الشخصية والسلف المالية). الرصيد الأخضر يعني مستحقات للشريك، والأحمر يعني سلف زائدة.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl"><Activity size={20}/></div>
                  منحنى المحفظة المالية
              </h2>
              <div className="flex gap-2">
                 <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400"><div className="w-2 h-2 rounded-full bg-indigo-600"></div>الرصيد</span>
              </div>
            </div>
            <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false}
                          tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                          tickFormatter={(val) => val.toLocaleString()}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            borderRadius: '16px', 
                            border: 'none', 
                            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                            fontWeight: 800,
                            direction: 'rtl'
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="balance" 
                          stroke="#4f46e5" 
                          strokeWidth={4} 
                          fillOpacity={1} 
                          fill="url(#colorBalance)" 
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
          </div>

          {/* بطاقة العهدة والتحصيلات للشركاء */}
          <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 text-right" dir="rtl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 dark:border-slate-800 pb-5">
                  <div className="flex items-center gap-3.5">
                      <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                          <Coins size={28} />
                      </div>
                      <div>
                          <h2 className="text-lg font-black text-slate-800 dark:text-white">بطاقة العهدة والتحصيلات المدينة</h2>
                          <p className="text-slate-400 font-bold text-xs mt-0.5">مراقبة وتسلم وتصفية الأموال السائلة طرف الشريك</p>
                      </div>
                  </div>
                  <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">إجمالي العهدة المالية طرف الشريك</span>
                      <span className={`text-2xl font-black ${partnerCustody > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                          {partnerCustody.toLocaleString()} <span className="text-xs font-bold">ج.م</span>
                      </span>
                  </div>
              </div>

              {partnerCustody > 0 ? (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl flex items-center gap-3 text-amber-800 dark:text-amber-300">
                      <Coins size={18} className="flex-shrink-0" />
                      <p className="text-xs font-bold leading-relaxed">
                        تنبيه: يوجد مبالغ نقدية متبقية كعهدة طرف الشريك بقيمة <strong>{partnerCustody.toLocaleString()} ج.م</strong>. يرجى تسوية المبالغ أو توريدها للخزينة عند تحصيلها.
                      </p>
                  </div>
              ) : (
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-2xl flex items-center gap-3 text-slate-500">
                      <Check size={18} className="flex-shrink-0 text-emerald-500" />
                      <p className="text-xs font-bold">الحساب النقدي مطابق ولا يوجد عهد مالية معلقة ومفتوحة طرف الشريك حالياً.</p>
                  </div>
              )}

              {/* Custody Action Form */}
              <div className="bg-slate-50 dark:bg-slate-900/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-4">
                  <h4 className="text-sm font-black text-slate-700 dark:text-slate-300">إجراء حركة عهدة جديدة مسجلة على ذمة الشريك:</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Custody Type */}
                      <div>
                          <label className="block text-xs font-bold text-slate-400 mb-2">نوع الحركة المالية</label>
                          <div className="grid grid-cols-2 gap-2">
                              <button 
                                  type="button"
                                  onClick={() => setCustodyType('give')}
                                  className={`py-2.5 px-3 rounded-xl font-bold text-xs transition-all ${
                                      custodyType === 'give' 
                                          ? 'bg-indigo-600 text-white shadow-md' 
                                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                  }`}
                              >
                                  تسليم عهدة للشريك (-)
                              </button>
                              <button 
                                  type="button"
                                  onClick={() => setCustodyType('receive')}
                                  className={`py-2.5 px-3 rounded-xl font-bold text-xs transition-all ${
                                      custodyType === 'receive' 
                                          ? 'bg-emerald-600 text-white shadow-md' 
                                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                  }`}
                              >
                                  تسوية/استلام عهدة (+)
                              </button>
                          </div>
                      </div>

                      {/* Select Treasury */}
                      <div>
                          <label className="block text-xs font-bold text-slate-400 mb-2">الخزينة أو الحساب النقدي المرتبط</label>
                          <select 
                              value={custodyTreasuryId}
                              onChange={(e) => setCustodyTreasuryId(e.target.value)}
                              className="w-full bg-white dark:bg-slate-800 outline-none border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold dark:text-white"
                          >
                              <option value="">-- اختر حساباً مالياً --</option>
                              <option value="central_wallet" className="text-indigo-600 font-black">
                                 💳 المحفظة الماليّة المركزيّة (الرصيد الأساسي) — (الرصيد: {wallet.balance.toLocaleString()} ج.م)
                              </option>
                              {treasury?.accounts?.map((acc: any) => (
                                  <option key={acc.id} value={acc.id}>
                                      {acc.name} (المتاح: {acc.balance.toLocaleString()} ج.م)
                                  </option>
                              ))}
                          </select>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Amount */}
                      <div className="sm:col-span-1">
                          <label className="block text-xs font-bold text-slate-400 mb-2 font-black">المبلغ المطلوب (ج.م)</label>
                          <input 
                              type="number"
                              placeholder="0.00"
                              value={custodyAmount}
                              onChange={(e) => setCustodyAmount(e.target.value)}
                              className="w-full bg-white dark:bg-slate-800 outline-none border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-black dark:text-white"
                          />
                      </div>

                      {/* Notes */}
                      <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-slate-400 mb-2">ملاحظات توضيحية للعملية</label>
                          <input 
                              type="text"
                              placeholder="مثال: عهدة نقدية لدفع مصاريف الشحن أو لشراء دفعة بضاعة جديدة"
                              value={custodyNotes}
                              onChange={(e) => setCustodyNotes(e.target.value)}
                              className="w-full bg-white dark:bg-slate-800 outline-none border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-bold dark:text-white"
                          />
                      </div>
                  </div>

                  <button 
                      type="button"
                      onClick={executeCustodyTx}
                      className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                  >
                      {custodyType === 'give' ? 'تسجيل صرف عهدة مالية للشريك' : 'تسجيل تحصيل واسترداد عهدة للخزينة'}
                  </button>
              </div>

              {/* Custody History */}
              <div className="bg-slate-50 dark:bg-slate-900/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-4">
                  <h4 className="text-sm font-black text-slate-700 dark:text-slate-300">سجل حركات العهدة الخاصة بالشريك:</h4>
                  <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                    {(() => {
                        const holderId = `part_${partner?.id}`;
                        const handovers = (settings.cashHandovers || []).filter(h => h.fromUserId === holderId || h.toUserId === holderId);
                        
                        if (handovers.length === 0) {
                            return <p className="text-xs text-slate-500 text-center py-4">لا توجد حركات مسجلة</p>;
                        }

                        return handovers.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(h => {
                            const isGive = h.fromUserId === 'admin' || h.toUserId === holderId; // partner receives money
                            return (
                                <div key={h.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm group">
                                    <div className="flex flex-col gap-1">
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            {isGive ? 'تسليم عهدة للشريك' : 'تسوية عهدة من الشريك'}
                                        </p>
                                        <p className="text-[10px] text-slate-400">{new Date(h.date).toLocaleString('ar-EG')}</p>
                                        {h.notes && <p className="text-[10px] text-slate-500 mt-1">{h.notes}</p>}
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <p className={`text-sm font-black ${isGive ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                            {isGive ? '+' : '-'}{h.amount.toLocaleString()} ج.م
                                        </p>
                                        <button 
                                            onClick={() => deleteCustodyTx(h)}
                                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            title="حذف حركة العهدة"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        });
                    })()}
                  </div>
              </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-50 dark:border-slate-700/50 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl"><History size={18}/></div>
              سجل المعاملات
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-[600px] p-6 space-y-8 custom-scrollbar">
            {Object.entries(
              transactions
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .reduce((groups: Record<string, PartnerTransaction[]>, t) => {
                  const date = new Date(t.date).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric', day: 'numeric' });
                  if (!groups[date]) groups[date] = [];
                  groups[date].push(t);
                  return groups;
                }, {})
            ).map(([date, group], groupIdx) => (
              <div key={date} className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-px flex-1 bg-slate-100 dark:bg-slate-700/50"></div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-900/50 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-800">
                    {date}
                  </span>
                  <div className="h-px flex-1 bg-slate-100 dark:bg-slate-700/50"></div>
                </div>

                <div className="space-y-3">
                  {group.map((t, idx) => {
                    const isPositive = ['capital_addition', 'repayment', 'supply_funding', 'shipping_funding', 'profit_distribution', 'expense_coverage', 'internal_transfer_in'].includes(t.type);
                    const isTransfer = t.type.includes('transfer');
                    
                    return (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: (groupIdx * 0.1) + (idx * 0.05) }}
                        key={t.id} 
                        className="group relative flex flex-col p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-indigo-500/50 dark:hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300"
                      >
                        {/* Type Indicator Bar */}
                        <div className={`absolute right-0 top-4 bottom-4 w-1 rounded-l-full ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>

                        <div className="flex justify-between items-start gap-4 pr-3">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300 ${
                              isPositive 
                                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' 
                                : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600'
                            }`}>
                              {t.type === 'loan' ? <ArrowDownRight size={20}/> : 
                               t.type === 'internal_transfer_in' ? <ArrowUpLeft size={20}/> : 
                               t.type === 'internal_transfer_out' ? <ArrowDownRight size={20}/> : 
                               t.type === 'customer_advance' ? <User size={20}/> : 
                               t.type === 'capital_addition' ? <PlusCircle size={20}/> : 
                               t.type === 'shipping_funding' ? <Truck size={20}/> : 
                               t.type === 'profit_withdrawal' ? <ArrowDownRight size={20}/> : 
                               t.type === 'profit_distribution' ? <TrendingUp size={20}/> : 
                               t.type === 'supply_funding' ? <PackageIcon size={20}/> : 
                               t.type === 'expense_coverage' ? <DollarSign size={20}/> :
                               t.type === 'expense_repayment' ? <RefreshCw size={20}/> :
                               t.type === 'repayment' ? <CheckCircle2 size={20}/> : <DollarSign size={20}/>}
                            </div>

                            <div className="flex flex-col">
                              <h3 className="font-black text-slate-900 dark:text-white text-sm leading-tight">
                                {t.type === 'loan' ? 'سلفة مالية / سحب نقدي' : 
                                 t.type === 'internal_transfer_in' ? 'تحويل مالي وارد (داخلي)' :
                                 t.type === 'internal_transfer_out' ? 'تحويل مالي صادر (داخلي)' :
                                 t.type === 'customer_advance' ? 'عربون محصل من عميل' :
                                 t.type === 'capital_addition' ? 'زيادة رأس المال المضاف' : 
                                 t.type === 'shipping_funding' ? 'تغطية ميزانية الشحن' : 
                                 t.type === 'profit_withdrawal' ? 'سحب من مستحقات الأرباح' : 
                                 t.type === 'profit_distribution' ? 'توزيع أرباح دورية' : 
                                 t.type === 'supply_funding' ? 'تمويل شراء مخزون' : 
                                 t.type === 'expense_coverage' ? (t.note?.includes('توريد') ? 'تغطية مصاريف توريد' : 'تغطية مصروفات تشغيلية') :
                                 t.type === 'pos_collection' ? 'استلام إيراد نقطة بيع' :
                                 t.type === 'expense_repayment' ? 'استرداد عهدة مصروفات' : 'سداد مديونية / سلفة'}
                              </h3>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                  <Clock size={10} />
                                  {new Date(t.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {t.treasuryAccountId && (
                                  <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded-md">
                                    عبر الخزينة
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end shrink-0">
                            <div className={`text-lg font-black tabular-nums tracking-tighter ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {isPositive ? '+' : '-'}{t.amount.toLocaleString()} 
                              <span className="text-[10px] font-bold mr-1 opacity-70">ج.م</span>
                            </div>
                            <button 
                                onClick={() => deleteTransaction(t)}
                                className="mt-2 p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                title="حذف المعاملة"
                            >
                                <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {t.note && (
                          <div className="mt-3 mr-16 ml-2 p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800/50 text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed italic">
                            <span className="text-slate-400 not-italic block mb-1 font-black uppercase text-[9px]">ملاحظات:</span>
                            {t.note}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}

            {transactions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-24 h-24 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6">
                  <History size={40} className="text-slate-200 dark:text-slate-700" />
                </div>
                <h3 className="text-slate-400 font-black text-sm">لا توجد حركات مالية مسجلة</h3>
                <p className="text-slate-300 dark:text-slate-600 text-xs mt-1 max-w-[200px]">سيتم عرض سجل الإيداعات والسحوبات هنا فور إضافتها</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnerProfilePage;
