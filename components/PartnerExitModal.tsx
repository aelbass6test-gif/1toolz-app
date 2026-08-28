import React, { useState, useMemo } from 'react';
import { Settings, Partner, PartnerTransaction, Wallet, Order } from '../types';
import { 
  Printer, X, Calculator, FileText, User, Users, DollarSign, Package, 
  Wallet as WalletIcon, ArrowRightLeft, LogOut, CheckCircle2, ShieldCheck, 
  HelpCircle, Copy, Check, Scale, AlertTriangle, ArrowDownLeft
} from 'lucide-react';
import { printHTMLDirectly } from '../utils/printHelper';

interface PartnerExitModalProps {
  initialPartnerId?: string;
  partners: Partner[];
  settings: Settings;
  wallet: Wallet;
  orders: Order[];
  onClose: () => void;
  onExecuteLiquidation?: (partnerId: string, amount: number, method: string, note: string) => void;
}

export const PartnerExitModal: React.FC<PartnerExitModalProps> = ({
  initialPartnerId,
  partners = [],
  settings,
  wallet,
  orders = [],
  onClose,
  onExecuteLiquidation
}) => {
  // Currently selected partner
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(
    initialPartnerId || partners[0]?.id || ''
  );

  const selectedPartner = useMemo(() => {
    return partners.find(p => p.id === selectedPartnerId) || partners[0];
  }, [partners, selectedPartnerId]);

  // Options & Switches
  const [dividendsAlreadyReceivedInCash, setDividendsAlreadyReceivedInCash] = useState<boolean>(false);
  const [settlementMode, setSettlementMode] = useState<'cash' | 'inventory' | 'mixed'>('mixed');
  const [cashPayoutAmount, setCashPayoutAmount] = useState<number>(0);
  const [customAdjustment, setCustomAdjustment] = useState<number>(0);
  const [adjustmentNote, setAdjustmentNote] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Helper calculation for store inventory and profits
  const storeInventoryValuation = useMemo(() => {
    const products = settings.products || [];
    const totalCost = products.reduce((sum, p) => sum + ((p.costPrice || p.price || 0) * (p.stock || 0)), 0);
    return totalCost;
  }, [settings.products]);

  const undistributedProfit = useMemo(() => {
    return (settings as any).undistributedProfit || 0;
  }, [(settings as any).undistributedProfit]);

  // Partner specific transactions calculation
  const partnerCalculations = useMemo(() => {
    if (!selectedPartner) return null;

    const pTxs = (settings.partnerTransactions || []).filter(t => t.partnerId === selectedPartner.id);

    // 1. Capital Investments
    const capitalInvested = pTxs
      .filter(t => ['capital_addition', 'supply_funding', 'shipping_funding', 'expense_coverage'].includes(t.type))
      .reduce((sum, t) => sum + (t.amount || 0), 0) || selectedPartner.capital || selectedPartner.initialCapital || 0;

    // 2. Distributed Dividends Owed
    const distributedDividends = pTxs
      .filter(t => t.type === 'profit_distribution')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    // 3. Unallocated/Undistributed Profits Share
    const profitRatio = selectedPartner.profitRatio || 0;
    const undistributedShare = Math.round((undistributedProfit * profitRatio) / 100);

    // 4. Net Personal Withdrawals & Loans
    const withdrawals = pTxs
      .filter(t => ['loan', 'profit_withdrawal', 'expense_repayment', 'internal_transfer_out', 'personal_withdrawal'].includes(t.type))
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const repayments = pTxs
      .filter(t => ['repayment', 'internal_transfer_in'].includes(t.type))
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const netWithdrawals = Math.max(0, withdrawals - repayments);

    // Total gross investment + earned profits before withdrawals
    const totalGrossEarnings = capitalInvested + (dividendsAlreadyReceivedInCash ? 0 : distributedDividends) + undistributedShare + customAdjustment;

    // Net Investment Settlement Balance (الرصيد الاستثماري الصافي للتخارج)
    const netSettlementBalance = totalGrossEarnings - netWithdrawals;

    // Inventory share based on capital or ratio
    const inventoryShare = Math.round((storeInventoryValuation * profitRatio) / 100);

    return {
      capitalInvested,
      distributedDividends,
      undistributedShare,
      netWithdrawals,
      totalGrossEarnings,
      netSettlementBalance,
      inventoryShare,
      profitRatio,
      currentBalanceInLedger: selectedPartner.balance || 0
    };
  }, [selectedPartner, settings.partnerTransactions, undistributedProfit, storeInventoryValuation, dividendsAlreadyReceivedInCash, customAdjustment]);

  // Sync default cash payout amount when net balance changes
  React.useEffect(() => {
    if (partnerCalculations) {
      if (settlementMode === 'cash') {
        setCashPayoutAmount(Math.max(0, partnerCalculations.netSettlementBalance));
      } else if (settlementMode === 'inventory') {
        setCashPayoutAmount(0);
      } else if (settlementMode === 'mixed') {
        // Half cash, half inventory by default or half of liquidity
        const half = Math.max(0, Math.round(partnerCalculations.netSettlementBalance / 2));
        setCashPayoutAmount(half);
      }
    }
  }, [partnerCalculations?.netSettlementBalance, settlementMode]);

  if (!selectedPartner || !partnerCalculations) return null;

  const netBalance = partnerCalculations.netSettlementBalance;
  const remainingInventoryPayout = Math.max(0, netBalance - cashPayoutAmount);

  // Generate WhatsApp / Verbal Script in simple Arabic
  const generateExplanationScript = () => {
    const pName = selectedPartner.name;
    let script = `يا ${pName}، عشان نفيض الحساب ونصفّي الشراكة بوضوح وبدون أي تعقيد:\n\n`;
    script += `1️⃣ ليك رأس مال واستثمار أصلي بـ (${partnerCalculations.capitalInvested.toLocaleString()} ج.م).\n`;
    
    if (partnerCalculations.distributedDividends > 0) {
      if (dividendsAlreadyReceivedInCash) {
        script += `2️⃣ الأرباح الموزعة سابقاً (${partnerCalculations.distributedDividends.toLocaleString()} ج.م) تم استلامها كاش بالفعل.\n`;
      } else {
        script += `2️⃣ ليك أرباح موزعة مستحقة بـ (${partnerCalculations.distributedDividends.toLocaleString()} ج.م).\n`;
      }
    }

    if (partnerCalculations.undistributedShare > 0) {
      script += `3️⃣ ليك حصة أرباح غير موزعة حالية بـ (${partnerCalculations.undistributedShare.toLocaleString()} ج.م).\n`;
    }

    script += `4️⃣ إجمالي المستحق لك قبل المسحوبات = (${partnerCalculations.totalGrossEarnings.toLocaleString()} ج.م).\n`;
    script += `5️⃣ يُخصم منه إجمالي مسحوباتك الشخصية والسلف بـ (${partnerCalculations.netWithdrawals.toLocaleString()} ج.م).\n\n`;
    script += `📊 **الصافي الاستثماري النهائي المستحق لك للتخارج والتصفية: (${netBalance.toLocaleString()} ج.م).**\n\n`;

    script += `💡 **طريقة التسوية المعتمدة:**\n`;
    if (settlementMode === 'cash') {
      script += `تستلم المبلغ الصافي كاش فوراً أو مقسطاً بقيمة (${netBalance.toLocaleString()} ج.م)، وتؤول كافة البضاعة وأصول الشركة للشركاء المكملين.`;
    } else if (settlementMode === 'inventory') {
      script += `تستلم بضاعة بسعر التكلفة من المخزن بقيمة (${netBalance.toLocaleString()} ج.م) وتخرج بها، دون سحب كاش من الخزينة.`;
    } else {
      script += `تستلم جزء كاش بقيمة (${cashPayoutAmount.toLocaleString()} ج.م) + بضاعة بسعر التكلفة بقيمة (${remainingInventoryPayout.toLocaleString()} ج.م) لتغطية كامل مستحقاتك.`;
    }

    return script;
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(generateExplanationScript());
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  // Official Document Printing Function
  const handlePrintOfficialExitReport = () => {
    const storeName = (settings as any).storeName || 'مدير الأوردرات الذكي';
    const todayStr = new Date().toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const otherPartners = partners.filter(p => p.id !== selectedPartner.id);

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>وثيقة تصفية وتخارج نهائي - ${selectedPartner.name}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
          body {
            font-family: 'Cairo', sans-serif;
            margin: 0;
            padding: 24px;
            color: #0f172a;
            background: #fff;
            font-size: 13px;
            line-height: 1.6;
          }
          .header {
            text-align: center;
            border-bottom: 3px double #0284c7;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .header h1 {
            margin: 0 0 6px 0;
            font-size: 22px;
            font-weight: 900;
            color: #0369a1;
          }
          .header p {
            margin: 2px 0;
            font-weight: 700;
            color: #64748b;
          }
          .badge {
            display: inline-block;
            background: #e0f2fe;
            color: #0369a1;
            padding: 4px 16px;
            border-radius: 20px;
            font-weight: 800;
            font-size: 12px;
            margin-top: 8px;
          }
          .grid-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 20px;
          }
          .info-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 12px 16px;
          }
          .info-box strong {
            color: #334155;
            display: block;
            margin-bottom: 4px;
            font-size: 11px;
            text-transform: uppercase;
          }
          .info-box span {
            font-size: 14px;
            font-weight: 800;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 12px;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 10px 12px;
            text-align: right;
          }
          th {
            background: #f1f5f9;
            font-weight: 800;
            color: #334155;
          }
          .table-total {
            background: #f0fdf4;
            font-weight: 900;
            font-size: 14px;
          }
          .table-total td {
            border-top: 2px solid #16a34a;
            color: #15803d;
          }
          .settlement-card {
            background: #fdf2f8;
            border: 1px solid #fbcfe8;
            border-radius: 12px;
            padding: 16px;
            margin: 20px 0;
          }
          .settlement-card h3 {
            margin: 0 0 10px 0;
            color: #be185d;
            font-size: 14px;
            font-weight: 800;
          }
          .declaration {
            background: #fffbebfb;
            border: 1px dashed #f59e0b;
            border-radius: 12px;
            padding: 16px;
            margin: 24px 0;
            font-size: 12px;
            text-align: justify;
            color: #78350f;
          }
          .signatures {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
            margin-top: 40px;
            text-align: center;
          }
          .sig-box {
            border-top: 1px solid #94a3b8;
            padding-top: 8px;
            font-weight: 700;
            font-size: 11px;
            color: #475569;
          }
          .sig-box .dots {
            margin-top: 32px;
            border-bottom: 1px dashed #cbd5e1;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${storeName}</h1>
          <p>نظام إدارة المحاسبة والشركاء المالي الموحد</p>
          <div class="badge">محضر تسوية وتخارج شريك رسمي - إخلاء طرف نهائي</div>
        </div>

        <div class="grid-info">
          <div class="info-box">
            <strong>الشريك الخارج / المغادر:</strong>
            <span>${selectedPartner.name} (نسبة الشراكة: ${partnerCalculations.profitRatio}%)</span>
          </div>
          <div class="info-box">
            <strong>تاريخ التصفية والإقفال:</strong>
            <span>${todayStr}</span>
          </div>
          <div class="info-box">
            <strong>الشركاء المستمرون والمكملون للمحل:</strong>
            <span>${otherPartners.map(p => p.name).join(' - ') || 'شريك مكمل'}</span>
          </div>
          <div class="info-box">
            <strong>إجمالي قيمة بضاعة المخزن الحالية:</strong>
            <span>${storeInventoryValuation.toLocaleString('ar-EG')} ج.م</span>
          </div>
        </div>

        <h3 style="font-size:14px; font-weight:800; color:#1e293b; margin-top:20px; margin-bottom:8px;">
          أولاً: التفنيط المالي الشامل لحسابات الشريك خارج المحل
        </h3>

        <table>
          <thead>
            <tr>
              <th>البنـــد المحاسبــي</th>
              <th>النوع / الحالة</th>
              <th>المبلغ (ج.م)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1. رأس المال والاستثمار الأصلي</td>
              <td>إيداعات ثابتة</td>
              <td style="font-weight:800; color:#2563eb;">+${partnerCalculations.capitalInvested.toLocaleString('ar-EG')}</td>
            </tr>
            <tr>
              <td>2. الأرباح الموزعة المستحقة غير المسبوق سحبها كاش</td>
              <td>أرباح معتمدة</td>
              <td style="font-weight:800; color:#16a34a;">+${(dividendsAlreadyReceivedInCash ? 0 : partnerCalculations.distributedDividends).toLocaleString('ar-EG')}</td>
            </tr>
            <tr>
              <td>3. نصيب الشريك من الأرباح غير الموزعة (المحتجزة)</td>
              <td>توزيع الجاري</td>
              <td style="font-weight:800; color:#0d9488;">+${partnerCalculations.undistributedShare.toLocaleString('ar-EG')}</td>
            </tr>
            ${customAdjustment !== 0 ? `
            <tr>
              <td>4. تسويات وإعادة تقييم خاصة (${adjustmentNote || 'تعديل اتفاقي'})</td>
              <td>تسوية خاصة</td>
              <td style="font-weight:800; color:${customAdjustment > 0 ? '#16a34a' : '#dc2626'};">
                ${customAdjustment > 0 ? '+' : ''}${customAdjustment.toLocaleString('ar-EG')}
              </td>
            </tr>
            ` : ''}
            <tr style="background:#f8fafc; font-weight:800;">
              <td colspan="2">إجمالي الحقوق والأرباح والاستثمارات قبل خصم المسحوبات:</td>
              <td style="color:#1e293b; font-size:13px;">${partnerCalculations.totalGrossEarnings.toLocaleString('ar-EG')} ج.م</td>
            </tr>
            <tr>
              <td>5. المسحوبات الشخصية بالسلف والتسويات النقدية (-)</td>
              <td>مسحوبات تراكمية</td>
              <td style="font-weight:800; color:#dc2626;">-${partnerCalculations.netWithdrawals.toLocaleString('ar-EG')}</td>
            </tr>
            <tr class="table-total">
              <td colspan="2">الرصيد الصافي النهائي المستحق للشريك الخارج (Net Settlement):</td>
              <td>${netBalance.toLocaleString('ar-EG')} ج.م</td>
            </tr>
          </tbody>
        </table>

        <div class="settlement-card">
          <h3>ثانياً: الاتفاق المعتمد لطريقة التسوية والتسليم</h3>
          <p style="margin:0 0 8px 0; font-weight:700;">
            تم الاتفاق بين الشريك المغادر والشركاء المكملين على تسوية الصافي المستحق قدره 
            <strong style="color:#0f172a; font-size:14px;">(${netBalance.toLocaleString('ar-EG')} ج.م)</strong> بالكيفية الآتية:
          </p>
          <ul style="margin:0; padding-right:20px; font-weight:700; color:#334155;">
            ${settlementMode === 'cash' ? `
              <li>تسليم الشريك الخارج كامل المبلغ كاش نقداً بقيمة: <strong>${netBalance.toLocaleString('ar-EG')} ج.م</strong>، وتؤول كافة أصول وبضاعة المخزن للشركاء الباقين.</li>
            ` : settlementMode === 'inventory' ? `
              <li>تسليم الشريك الخارج بضاعة بسعر التكلفة من مخزن المحل بقيمة: <strong>${netBalance.toLocaleString('ar-EG')} ج.م</strong>، دون أي سحب كاش من الخزينة.</li>
            ` : `
              <li><strong>تسليم نقدي (كاش):</strong> بمبلغ <strong>${cashPayoutAmount.toLocaleString('ar-EG')} ج.م</strong> يُصرف من الخزينة.</li>
              <li><strong>تسليم عينـي (بضاعة بسعر التكلفة):</strong> بمبلغ <strong>${remainingInventoryPayout.toLocaleString('ar-EG')} ج.م</strong> تُصرف من المخزن.</li>
            `}
          </ul>
        </div>

        <div class="declaration">
          <strong style="display:block; font-size:13px; margin-bottom:6px; color:#92400e;">📄 إقرار وتعهد وتخارج نهائي (إخلاء طرف شامل):</strong>
          أقر أنا الشريك المغادر الموضح اسمه أعلاه (<strong>${selectedPartner.name}</strong>)، بأنني قد اطلعت على كافة الحسابات والدفاتر المالية المبينة أعلاه ووافقت عليها دون أدنى تحفظ، وأقر باستلامي لكافة مستحقاتي الموضحة نقدياً وعينياً، وبناءً عليه أُعلن تخارجي النهائي والتام من شراكة المحل، مع إبراء ذمة باقي الشركاء والمحل إبراءً شاملاً مانعاً للجهالة، ولا يحق لي أو لوكلائي المطالبة بأي مبالغ أو أرباح أو حقوق مستقبلاً.
        </div>

        <div class="signatures">
          <div class="sig-box">
            <strong>الشريك المغادر (تخارج واستلام):</strong>
            <div>${selectedPartner.name}</div>
            <div class="dots"></div>
            <div style="margin-top:4px; font-size:10px; color:#94a3b8;">التوقيع / البصمة</div>
          </div>

          <div class="sig-box">
            <strong>عن الشركاء المكملين للمحل:</strong>
            <div>${otherPartners[0]?.name || 'الشريك المكمل'}</div>
            <div class="dots"></div>
            <div style="margin-top:4px; font-size:10px; color:#94a3b8;">التوقيع / الأختام</div>
          </div>

          <div class="sig-box">
            <strong>إقرار واستلام الشهود:</strong>
            <div>شاهد أول / شاهد ثانٍ</div>
            <div class="dots"></div>
            <div style="margin-top:4px; font-size:10px; color:#94a3b8;">التوقيع</div>
          </div>
        </div>

      </body>
      </html>
    `;

    printHTMLDirectly(html);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 my-8 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-8 py-6 bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-900 text-white flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600/30 border border-indigo-500/40 rounded-2xl flex items-center justify-center text-indigo-400">
              <LogOut size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black flex items-center gap-2">
                حاسبة وتقرير تصفية الشراكة والتخارج
                <span className="text-xs font-bold px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
                  إعادة هيكلة الحصص
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-bold mt-0.5">
                تصفية دقيقة لعناصر الاستثمار، الأرباح، والمسحوبات مع صيغة إقرار تخارج رسمية
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
          
          {/* Partner Selector Bar */}
          <div className="p-6 bg-slate-50 dark:bg-slate-800/60 rounded-3xl border border-slate-200 dark:border-slate-700/60 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <Users className="text-indigo-600 shrink-0" size={20} />
              <div>
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">اختر الشريك الراغب في التخارج:</label>
                <p className="text-[10px] text-slate-400 font-bold">سيتم احتساب القيمة الاستثمارية الصافية بناءً على دفاتره الحالية</p>
              </div>
            </div>

            <select
              value={selectedPartnerId}
              onChange={(e) => setSelectedPartnerId(e.target.value)}
              className="px-5 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-black text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 min-w-[220px]"
            >
              {partners.map(p => (
                <option key={p.id} value={p.id}>
                  👤 {p.name} (نسبته: {p.profitRatio}%)
                </option>
              ))}
            </select>
          </div>

          {/* Core Calculations Breakdown */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Calculator size={18} className="text-indigo-600" />
              تفنيط المستحقات والاستثمارات الصافية لـ ({selectedPartner.name})
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              
              {/* Capital */}
              <div className="p-5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-2xl">
                <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase block mb-1">
                  1️⃣ رأس المال والاستثمار
                </span>
                <p className="text-xl font-black text-slate-800 dark:text-white tabular-nums">
                  {partnerCalculations.capitalInvested.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
                </p>
                <span className="text-[9px] font-bold text-slate-400 mt-1 block">إيداعات ثابتة وحصص</span>
              </div>

              {/* Distributed Dividends */}
              <div className="p-5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">
                    2️⃣ الأرباح الموزعة
                  </span>
                  <input
                    type="checkbox"
                    id="divCheck"
                    checked={dividendsAlreadyReceivedInCash}
                    onChange={(e) => setDividendsAlreadyReceivedInCash(e.target.checked)}
                    className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer"
                  />
                </div>
                <p className="text-xl font-black text-slate-800 dark:text-white tabular-nums">
                  {partnerCalculations.distributedDividends.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
                </p>
                <label htmlFor="divCheck" className="text-[9px] font-bold text-slate-500 cursor-pointer block mt-1">
                  {dividendsAlreadyReceivedInCash ? '✔️ صُرفت كاش سابقاً (مستبعدة)' : '⏳ متبقية لم تُصرف كاش بعد (تُضاف)'}
                </label>
              </div>

              {/* Undistributed Profit Share */}
              <div className="p-5 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-2xl">
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase block mb-1">
                  3️⃣ نصيبه في الأرباح المحتجزة
                </span>
                <p className="text-xl font-black text-slate-800 dark:text-white tabular-nums">
                  {partnerCalculations.undistributedShare.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
                </p>
                <span className="text-[9px] font-bold text-slate-400 mt-1 block">
                  ({partnerCalculations.profitRatio}% من {undistributedProfit.toLocaleString()} ج.م)
                </span>
              </div>

              {/* Net Withdrawals */}
              <div className="p-5 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-2xl">
                <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase block mb-1">
                  4️⃣ المسحوبات والسلف (-)
                </span>
                <p className="text-xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
                  -{partnerCalculations.netWithdrawals.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
                </p>
                <span className="text-[9px] font-bold text-slate-400 mt-1 block">مسحوبات ومشتريات شخصية</span>
              </div>

            </div>

            {/* Custom Adjustment Row */}
            <div className="p-4 bg-slate-100/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                <span>تعديلات أو تسويات اتفاقية خاصة (+/-):</span>
                <p className="text-[10px] text-slate-400 font-normal">خصم أو إضافة أي مبالغ ودية يتفق عليها الشركاء وقت التصفية</p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="سبب التعديل..."
                  value={adjustmentNote}
                  onChange={(e) => setAdjustmentNote(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-white w-36"
                />
                <input
                  type="number"
                  placeholder="المبلغ (+ / -)"
                  value={customAdjustment || ''}
                  onChange={(e) => setCustomAdjustment(Number(e.target.value) || 0)}
                  className="px-3 py-2 text-xs font-mono font-bold border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-white w-32"
                />
              </div>
            </div>

            {/* Net Result Highlight Card */}
            <div className="p-6 bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white rounded-3xl shadow-xl border border-indigo-800/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <span className="text-xs font-black text-indigo-400 uppercase tracking-widest block mb-1 flex items-center gap-2">
                  <ShieldCheck size={16} /> الصافي الاستثماري النهائـي المتبقي لتصفية الشريك
                </span>
                <h4 className="text-3xl font-black text-white tabular-nums flex items-baseline gap-2">
                  {netBalance.toLocaleString('ar-EG')} <span className="text-sm font-normal text-slate-300">جنية مصري</span>
                </h4>
                <p className="text-xs text-slate-300 font-bold mt-1">
                  (إجمالي الاستثمار والربحية {partnerCalculations.totalGrossEarnings.toLocaleString()} - المسحوبات {partnerCalculations.netWithdrawals.toLocaleString()})
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 text-right">
                <span className="text-[10px] text-indigo-200 font-bold block mb-0.5">حصة البضاعة العينية بالمخزن</span>
                <span className="text-lg font-black text-amber-300 tabular-nums">
                  {partnerCalculations.inventoryShare.toLocaleString('ar-EG')} ج.م
                </span>
                <span className="text-[9px] text-slate-400 block font-normal">من إجمالي بضاعة المحل ({storeInventoryValuation.toLocaleString()} ج.م)</span>
              </div>
            </div>
          </div>

          {/* Settlement Options Section */}
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Scale size={18} className="text-indigo-600" />
              اختر سيناريو وطريقة تسوية التخارج والتسليم
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Option 1: Full Cash */}
              <div 
                onClick={() => setSettlementMode('cash')}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all space-y-3 ${
                  settlementMode === 'cash' 
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500 shadow-md' 
                    : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-2">
                    💵 تسوية كاش بالكامل
                  </span>
                  {settlementMode === 'cash' && <CheckCircle2 size={18} className="text-emerald-600" />}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-bold">
                  الشريك يستلم الصافي الاستثماري <strong className="text-emerald-600 font-black">({netBalance.toLocaleString()} ج.م)</strong> كاش، ويترك كافة أصول البضاعة والمحل للشريك المكمل.
                </p>
              </div>

              {/* Option 2: Full Inventory */}
              <div 
                onClick={() => setSettlementMode('inventory')}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all space-y-3 ${
                  settlementMode === 'inventory' 
                    ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-500 shadow-md' 
                    : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-2">
                    📦 تسوية بضاعة بالكامل
                  </span>
                  {settlementMode === 'inventory' && <CheckCircle2 size={18} className="text-amber-600" />}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-bold">
                  الشريك يستلم بضاعة بسعر التكلفة من المخزن بقيمة <strong className="text-amber-600 font-black">({netBalance.toLocaleString()} ج.م)</strong> دون أي سحب كاش من الخزينة.
                </p>
              </div>

              {/* Option 3: Mixed */}
              <div 
                onClick={() => setSettlementMode('mixed')}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all space-y-3 ${
                  settlementMode === 'mixed' 
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-500 shadow-md' 
                    : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-2">
                    ⚖️ تسوية مشتركة (كاش + بضاعة)
                  </span>
                  {settlementMode === 'mixed' && <CheckCircle2 size={18} className="text-indigo-600" />}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-bold">
                  تحديد جزء كاش يُصرف من الخزينة، ويستلم الباقي بضاعة بسعر التكلفة من المخزن.
                </p>
              </div>

            </div>

            {/* Mixed Inputs Detail */}
            {settlementMode === 'mixed' && (
              <div className="p-5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-200 dark:border-indigo-800/40 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                    المبلغ النقدي الممكن دفعه كاش (ج.م):
                  </label>
                  <input
                    type="number"
                    value={cashPayoutAmount || ''}
                    onChange={(e) => setCashPayoutAmount(Math.min(netBalance, Math.max(0, Number(e.target.value))))}
                    className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-black text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                    المتبقي الواجب تسليمه بضاعة بسعر التكلفة:
                  </label>
                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-black text-sm text-amber-600 dark:text-amber-400">
                    {remainingInventoryPayout.toLocaleString()} ج.م
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Explanation Script for Partner */}
          <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-700/60 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                <HelpCircle size={16} className="text-indigo-600" />
                نص الشرح المباشر والمفهوم للشريك الخارج (جاهز للنسخ أو الإرسال)
              </h4>

              <button
                type="button"
                onClick={handleCopyScript}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all"
              >
                {copySuccess ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>{copySuccess ? 'تم النسخ بنجاح!' : 'نسخ الصيغة'}</span>
              </button>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 font-sans text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line shadow-inner">
              {generateExplanationScript()}
            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="px-8 py-5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-xs hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            إغلاق
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {onExecuteLiquidation && (
              <button
                type="button"
                onClick={() => {
                  onExecuteLiquidation(
                    selectedPartner.id,
                    cashPayoutAmount,
                    settlementMode,
                    `تصفية وتخارج نهائي للشريك (${selectedPartner.name}) - تسوية ${settlementMode}`
                  );
                }}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>تنفيذ الخروج والتسوية دفترياً</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrintOfficialExitReport}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Printer size={16} />
              <span>طباعة وثيقة وإقرار التخارج الرسمي</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
