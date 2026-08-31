import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Partner, PartnerTransaction, StoreData, Wallet, Order, Treasury } from '../types';
import { 
  User, Lock, LogOut, ArrowUpLeft, ArrowDownRight, 
  DollarSign, Shield, Calendar, Search, Printer, 
  HelpCircle, ChevronLeft, Award, FileText, CheckCircle,
  Loader2, RefreshCw, AlertCircle, TrendingUp, Wallet as WalletIcon,
  Copy, Check, Share2, Coins, Package as PackageIcon, Truck,
  X, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, CartesianGrid 
} from 'recharts';
import * as db from '../services/databaseService';
import { generateAbdoMediaPolicyHTML } from '../utils/reportGenerator';
import { printHTMLDirectly } from '../utils/printHelper';
import { getVirtualOrderHandovers } from '../utils/financials';
import { PartnerStatementModal } from './PartnerStatementModal';

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

interface PartnerPortalProps {
  allStoresData: Record<string, StoreData>;
  updateSettings: (settings: any) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export default function PartnerPortal({ allStoresData, updateSettings, showToast: externalShowToast }: PartnerPortalProps) {
  const { storeId } = useParams<{ storeId: string }>();
  const [searchParams] = useSearchParams();
  const urlPartnerId = searchParams.get('p') || searchParams.get('partnerId') || searchParams.get('partner') || '';

  const [directStoreData, setDirectStoreData] = useState<StoreData | null>(null);
  const [isLoadingStore, setIsLoadingStore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const effectiveStoreId = useMemo(() => {
    if (storeId) return storeId;
    const keys = Object.keys(allStoresData);
    if (keys.length > 0) return keys[0];
    return '';
  }, [storeId, allStoresData]);

  // Always fetch fresh store data on mount or when storeId changes
  const fetchFreshData = useCallback(async (isManualRefresh = false) => {
    const targetStoreId = storeId || effectiveStoreId;
    if (!targetStoreId) return;

    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoadingStore(true);
    }

    try {
      const fetchedData = await db.getStoreData(targetStoreId, true);
      if (fetchedData) {
        setDirectStoreData(fetchedData);
        if (isManualRefresh) {
          showToast('تم تحديث البيانات المالية بنجاح من الخادم السحابي', 'success');
        }
      }
    } catch (err) {
      console.error('[PartnerPortal] Error loading store data:', err);
      if (isManualRefresh) {
        showToast('تعذر تحديث البيانات، يرجى المحاولة لاحقاً', 'error');
      }
    } finally {
      setIsLoadingStore(false);
      setIsRefreshing(false);
    }
  }, [storeId, effectiveStoreId]);

  useEffect(() => {
    fetchFreshData(false);
  }, [fetchFreshData]);

  const activeStoreData = directStoreData || (storeId && allStoresData[storeId]) || (effectiveStoreId ? allStoresData[effectiveStoreId] : null);
  const settings = (activeStoreData?.settings || { partners: [], partnerTransactions: [], cashHolders: [], cashHandovers: [] }) as any;
  const partners: Partner[] = settings.partners || [];
  const rawPartnerTransactions: PartnerTransaction[] = settings.partnerTransactions || [];
  const rawCashHandovers = settings.cashHandovers || [];
  const rawWalletTransactions = activeStoreData?.wallet?.transactions || [];
  const rawTreasuryTransactions = activeStoreData?.treasury?.transactions || [];
  const rawSupplyOrders = settings.supplyOrders || [];
  const rawOrders: Order[] = activeStoreData?.orders || [];
  const rawTreasury: Treasury | undefined = activeStoreData?.treasury;
  const rawWallet: Wallet = activeStoreData?.wallet || { balance: 0, transactions: [] };
  const storeName = settings.storeName || 'عبده ميديا';

  // Internal toast state
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    if (externalShowToast) {
      externalShowToast(msg, type);
    }
    setToast({ msg, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Authentication State
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [pin, setPin] = useState('');
  const [authenticatedPartner, setAuthenticatedPartner] = useState<Partner | null>(null);

  // Pre-select partner if passed in URL or if partners load
  useEffect(() => {
    if (urlPartnerId && partners.length > 0) {
      const normUrlId = normalizeName(urlPartnerId);
      const match = partners.find(p => 
        p.id === urlPartnerId || 
        p.id === `part_${urlPartnerId}` || 
        urlPartnerId === `part_${p.id}` || 
        normalizeName(p.name) === normUrlId ||
        normalizeName(p.id) === normUrlId
      );
      if (match) {
        setSelectedPartnerId(match.id);
      }
    }
  }, [urlPartnerId, partners]);

  // Restore authenticated session
  useEffect(() => {
    if (!authenticatedPartner && partners.length > 0 && effectiveStoreId) {
      const saved = sessionStorage.getItem(`partner_portal_auth_${effectiveStoreId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const match = partners.find(p => p.id === parsed.id || normalizeName(p.name) === normalizeName(parsed.name));
          if (match) {
            setAuthenticatedPartner(match);
          }
        } catch (e) {
          // ignore parsing error
        }
      }
    }
  }, [partners, effectiveStoreId, authenticatedPartner]);

  // Keep live authenticated partner synced with latest partner updates in store settings
  const livePartner = useMemo(() => {
    if (!authenticatedPartner) return null;
    return partners.find(p => p.id === authenticatedPartner.id || normalizeName(p.name) === normalizeName(authenticatedPartner.name)) || authenticatedPartner;
  }, [authenticatedPartner, partners]);

  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showFullStatementModal, setShowFullStatementModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestType, setRequestType] = useState<'withdrawal' | 'expense' | 'inquiry'>('withdrawal');
  const [requestAmount, setRequestAmount] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // Auto-login if PIN is provided in URL or if partner has no password/default and auto=1
  useEffect(() => {
    const urlPin = searchParams.get('pin') || searchParams.get('code') || '';
    const autoLogin = searchParams.get('auto') === '1' || searchParams.get('direct') === '1';

    if (!authenticatedPartner && partners.length > 0 && urlPartnerId) {
      const normUrlId = normalizeName(urlPartnerId);
      const match = partners.find(p => 
        p.id === urlPartnerId || 
        p.id === `part_${urlPartnerId}` || 
        urlPartnerId === `part_${p.id}` || 
        normalizeName(p.name) === normUrlId ||
        normalizeName(p.id) === normUrlId ||
        String(p.id).includes(urlPartnerId) ||
        urlPartnerId.includes(String(p.id))
      );

      if (match) {
        setSelectedPartnerId(match.id);
        const correctPin = String(match.passcode || '0000').trim();
        if (urlPin && urlPin.trim() === correctPin) {
          setAuthenticatedPartner(match);
          sessionStorage.setItem(`partner_portal_auth_${effectiveStoreId}`, JSON.stringify(match));
        } else if (autoLogin && (!match.passcode || match.passcode === '0000')) {
          setAuthenticatedPartner(match);
          sessionStorage.setItem(`partner_portal_auth_${effectiveStoreId}`, JSON.stringify(match));
        }
      }
    }
  }, [urlPartnerId, partners, searchParams, authenticatedPartner, effectiveStoreId]);

  // Handle Login
  const handleLogin = (e?: React.FormEvent, customPartner?: Partner, bypassPin = false) => {
    if (e) e.preventDefault();
    const partnerToAuth = customPartner || partners.find(p => p.id === selectedPartnerId);
    if (!partnerToAuth) {
      showToast('برجاء اختيار اسم الشريك أولاً من القائمة', 'error');
      return;
    }

    const correctPasscode = String(partnerToAuth.passcode || '0000').trim();
    const enteredPin = String(pin || '').trim();
    
    if (bypassPin || enteredPin === correctPasscode || (enteredPin === '0000' && !partnerToAuth.passcode) || (!partnerToAuth.passcode && enteredPin === '')) {
      setAuthenticatedPartner(partnerToAuth);
      sessionStorage.setItem(`partner_portal_auth_${effectiveStoreId}`, JSON.stringify(partnerToAuth));
      showToast(`مرحباً بك يا ${partnerToAuth.name}`, 'success');
      setPin('');
    } else {
      showToast('رمز المرور (PIN) غير صحيح! يرجى إدخال الرمز الصحيح أو مراجعة إدارة المتجر.', 'error');
    }
  };

  // Submit Partner Request to Admin Activity Logs
  const handleSubmitPartnerRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!livePartner) return;

    const amt = Number(requestAmount) || 0;
    if (requestType !== 'inquiry' && amt <= 0) {
      showToast('يرجى إدخال مبلغ صحيح للطلب', 'error');
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const typeArabic = requestType === 'withdrawal' ? 'طلب سحب أرباح' : requestType === 'expense' ? 'تسجيل مصروف مدفوع من الشريك' : 'استفسار أو ملاحظة مالية';
      const logEntry = {
        id: `req_${Date.now()}`,
        user: `الشريك: ${livePartner.name}`,
        action: typeArabic,
        details: `${typeArabic} بمبلغ ${amt > 0 ? `${amt.toLocaleString()} ج.م` : ''} - ملاحظات: ${requestNotes || 'بدون تفاصيل إضافية'}`,
        date: new Date().toISOString(),
        timestamp: Date.now()
      };

      const updatedLogs = [logEntry, ...(settings.activityLogs || [])];
      const updatedSettings = {
        ...settings,
        activityLogs: updatedLogs
      };

      const currentStoreData = await db.getStoreData(effectiveStoreId);
      if (currentStoreData) {
        await db.saveStoreData({ id: effectiveStoreId, name: storeName || 'المتجر' } as any, {
          ...currentStoreData,
          settings: updatedSettings
        });
      }
      updateSettings(updatedSettings);

      showToast('تم إرسال طلبك بنجاح إلى إدارة المتجر للمراجعة والاعتماد', 'success');
      setShowRequestModal(false);
      setRequestAmount('');
      setRequestNotes('');
    } catch (err) {
      console.error('Error submitting partner request:', err);
      showToast('حدث خطأ أثناء إرسال الطلب، يرجى المحاولة لاحقاً', 'error');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    setAuthenticatedPartner(null);
    sessionStorage.removeItem(`partner_portal_auth_${effectiveStoreId}`);
    showToast('تم تسجيل الخروج بنجاح', 'success');
  };

  // Comprehensive Partner Calculations (Multi-source aggregation)
  const partnerData = useMemo(() => {
    if (!livePartner) return null;
    const pId = livePartner.id;
    const pName = livePartner.name || '';
    const normPName = normalizeName(pName);
    const holderId = `part_${pId}`;
    const partnerHolderIds = [pId, holderId, pId.replace('part_', '')];

    // 1. Direct partner transactions from settings.partnerTransactions
    const matchedPartnerTxs = rawPartnerTransactions.filter((t: any) => {
      if (t.type === 'pos_collection') return false;
      const tPId = t.partnerId || t.partner_id || '';
      const tPName = normalizeName(t.partnerName || t.partner_name || '');
      const tNote = normalizeName(t.note || t.notes || t.description || '');

      const isIdMatch = partnerHolderIds.includes(tPId) || (tPId && partnerHolderIds.includes(`part_${tPId}`));
      const isNameMatch = normPName && tPName && (tPName === normPName || tPName.includes(normPName) || normPName.includes(tPName));
      const isNoteMatch = normPName && tNote && (tNote.includes(normPName) || (normPName === 'زهره' && tNote.includes('زهره')));

      return isIdMatch || isNameMatch || isNoteMatch;
    });

    // 2. Cash handovers & custody
    const partnerHolders = (settings.cashHolders || []).filter((h: any) => {
      const hUserId = h.userId || h.user_id || '';
      const hUserName = normalizeName(h.userName || h.user_name || '');
      return partnerHolderIds.includes(hUserId) || (normPName && hUserName === normPName);
    });
    const allPartnerUserIds = [...partnerHolderIds, ...partnerHolders.map((h: any) => h.userId || h.user_id)];

    const allHandovers = [
      ...rawCashHandovers,
      ...getVirtualOrderHandovers(rawOrders, settings, rawTreasury)
    ];

    const matchedHandovers = allHandovers
      .filter((h: any) => {
        const fromId = h.fromUserId || '';
        const toId = h.toUserId || '';
        const fromName = normalizeName(h.fromUserName || '');
        const toName = normalizeName(h.toUserName || '');
        const hNote = normalizeName(h.notes || h.note || '');

        return allPartnerUserIds.includes(fromId) || 
               allPartnerUserIds.includes(toId) || 
               (normPName && fromName.includes(normPName)) || 
               (normPName && toName.includes(normPName)) ||
               (normPName && hNote.includes(normPName));
      })
      .map((h: any) => {
        const isGive = allPartnerUserIds.includes(h.toUserId) || (normPName && normalizeName(h.toUserName || '').includes(normPName));
        return {
          id: h.id || `HND-${h.date}-${h.amount}`,
          partnerId: pId,
          type: isGive ? 'custody_give' : 'custody_receive',
          amount: Number(h.amount) || 0,
          date: h.date || new Date().toISOString(),
          note: h.notes || h.note || (isGive ? 'تسليم عهدة تشغيلية للشريك' : 'تسوية واسترداد عهدة من الشريك'),
        } as PartnerTransaction;
      });

    // 3. Wallet Transactions related to partner (expenses paid by partner, manual partner deposits/withdrawals)
    const matchedWalletTxs: PartnerTransaction[] = [];
    rawWalletTransactions.forEach((wTx: any) => {
      const paidBy = wTx.details?.paidByPartnerId;
      const noteNorm = normalizeName(wTx.note || '');
      const isPaidByPartner = paidBy && partnerHolderIds.includes(paidBy);
      const isMentionedInNote = normPName && noteNorm.includes(normPName) && (wTx.type === 'سحب' || wTx.type === 'إيداع');

      if (isPaidByPartner || isMentionedInNote) {
        // Avoid duplicate if already in partner transactions
        const isDuplicate = matchedPartnerTxs.some(pt => pt.id === wTx.id || (Math.abs(pt.amount - wTx.amount) < 0.01 && pt.date?.slice(0, 10) === wTx.date?.slice(0, 10)));
        if (!isDuplicate) {
          const isExpenseCoverage = isPaidByPartner || (wTx.type === 'سحب' && noteNorm.includes('سداد مصروف'));
          const isLoan = wTx.type === 'سحب' && (noteNorm.includes('سلفة') || noteNorm.includes('سحب شريك') || noteNorm.includes('مسحوبات'));
          const isRepayment = wTx.type === 'إيداع' && (noteNorm.includes('سداد') || noteNorm.includes('رد'));
          const isCapital = wTx.type === 'إيداع' && (noteNorm.includes('رأس مال') || noteNorm.includes('استثمار'));

          let txType: any = 'expense_coverage';
          if (isLoan) txType = 'loan';
          else if (isRepayment) txType = 'repayment';
          else if (isCapital) txType = 'capital_addition';
          else if (isExpenseCoverage) txType = 'expense_coverage';

          matchedWalletTxs.push({
            id: wTx.id,
            partnerId: pId,
            type: txType,
            amount: Number(wTx.amount) || 0,
            date: wTx.date || new Date().toISOString(),
            note: wTx.note || 'معاملة مالية من المحفظة'
          });
        }
      }
    });

    // 4. Supply Orders funded by partner
    const matchedSupplyTxs: PartnerTransaction[] = [];
    rawSupplyOrders.forEach((so: any) => {
      const soPartnerId = so.partnerPayment?.partnerId || so.paidByPartnerId || so.partnerId;
      const soPartnerName = normalizeName(so.partnerPayment?.partnerName || so.partnerName || '');
      const isSupplyFundedByPartner = (soPartnerId && partnerHolderIds.includes(soPartnerId)) || (normPName && soPartnerName.includes(normPName));

      if (isSupplyFundedByPartner) {
        const supplyAmt = Number(so.partnerPayment?.amount || so.totalAmount || so.paidAmount || 0);
        if (supplyAmt > 0) {
          const isDuplicate = matchedPartnerTxs.some(pt => pt.type === 'supply_funding' && Math.abs(pt.amount - supplyAmt) < 0.01);
          if (!isDuplicate) {
            matchedSupplyTxs.push({
              id: `SO-FUND-${so.id}`,
              partnerId: pId,
              type: 'supply_funding',
              amount: supplyAmt,
              date: so.date || so.createdAt || new Date().toISOString(),
              note: `تمويل أمر توريد بضاعة: ${so.orderNumber || so.supplierName || 'بضاعة جديدة'}`
            });
          }
        }
      }
    });

    // All combined transactions
    const allCombinedTxs = [
      ...matchedPartnerTxs,
      ...matchedHandovers,
      ...matchedWalletTxs,
      ...matchedSupplyTxs
    ];

    // Chronological sorting
    const sortedTxs = [...allCombinedTxs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Cumulative balance progression for chart
    let runningBalance = 0;
    const chartData = sortedTxs.map(t => {
      const amount = Number(t.amount) || 0;
      if (['capital_addition', 'repayment', 'supply_funding', 'shipping_funding', 'profit_distribution', 'expense_coverage', 'internal_transfer_in'].includes(t.type)) {
        runningBalance += amount;
      } else if (t.type === 'pos_collection' || t.type === 'custody_give' || t.type === 'custody_receive') {
        // Neutral or separate from running equity balance
      } else {
        runningBalance -= amount;
      }
      return {
        date: new Date(t.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }),
        'الرصيد الجاري': runningBalance,
        amount: amount,
        type: t.type
      };
    });

    // Calculations matching PartnersPage.tsx & PartnerProfilePage.tsx
    const capitalFromTxs = allCombinedTxs
      .filter((t: any) => ['capital_addition', 'supply_funding', 'shipping_funding', 'expense_coverage'].includes(t.type))
      .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0) - 
      allCombinedTxs.filter((t: any) => t.type === 'capital_withdrawal').reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);

    const baseCapital = Number(livePartner.capital ?? livePartner.initialCapital ?? (livePartner as any).investmentAmount ?? 0);
    const capital = capitalFromTxs > 0 ? capitalFromTxs : baseCapital;

    const dividends = allCombinedTxs
      .filter((t: any) => t.type === 'profit_distribution')
      .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);

    const withdrawals = allCombinedTxs
      .filter((t: any) => ['loan', 'profit_withdrawal', 'expense_repayment', 'internal_transfer_out', 'capital_withdrawal', 'wallet_withdrawal', 'personal_withdrawal'].includes(t.type))
      .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);

    const repayments = allCombinedTxs
      .filter((t: any) => ['repayment', 'internal_transfer_in'].includes(t.type))
      .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);

    const netWithdrawals = Math.max(0, withdrawals - repayments);

    // Custody calculation with settlement detection
    const settlements = matchedHandovers.filter((h: any) => 
      h.toUserId === 'admin_deduction' || 
      h.toUserId === 'admin_manual' ||
      (h.note && (h.note.includes('خصم') || h.note.includes('تصفية') || h.note.includes('تسوية')))
    );
    const hasSettlement = settlements.length > 0;
    const holderSum = partnerHolders.reduce((sum: number, h: any) => sum + (Number(h.currentBalance ?? h.current_balance ?? 0)), 0);

    let custodyAmt = 0;
    if (hasSettlement) {
      const lastSettlement = settlements.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      const activeHandovers = matchedHandovers.filter((h: any) => new Date(h.date).getTime() > new Date(lastSettlement.date).getTime());
      const activeHandoverSum = activeHandovers.reduce((sum: number, h: any) => {
        return h.type === 'custody_give' ? sum + (Number(h.amount) || 0) : sum - (Number(h.amount) || 0);
      }, 0);
      custodyAmt = Math.max(0, holderSum) + Math.max(0, activeHandoverSum);
    } else {
      const handoverSum = matchedHandovers.reduce((sum: number, h: any) => {
        return h.type === 'custody_give' ? sum + (Number(h.amount) || 0) : sum - (Number(h.amount) || 0);
      }, 0);
      custodyAmt = Math.max(holderSum, Math.max(0, handoverSum));
    }
    custodyAmt = Math.max(0, custodyAmt);

    // Live Balance calculation
    let netBalance = 0;
    if (livePartner.balance !== undefined && livePartner.balance !== null && !isNaN(Number(livePartner.balance))) {
      netBalance = Number(livePartner.balance);
    } else {
      netBalance = capital + dividends - netWithdrawals;
    }

    // Store-wide Performance & Partnership Profit Share Calculations
    let totalStoreSales = 0;
    let totalDeliveredOrders = 0;
    let totalSuccessfulNetPos = 0;
    let totalSuccessfulNetShipping = 0;
    let returnsLosses = 0;

    rawOrders.forEach(order => {
      const isPos = order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر' || (order.id && order.id.startsWith('POS-'));
      const isDelivered = ['تم_التوصيل', 'تم_توصيلها', 'تم_التحصيل', 'مدفوعة'].includes(order.status);
      const isReturnOrFailed = ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام', 'ملغي'].includes(order.status);
      
      const orderItems = order.items || [];
      const computedItemsTotal = orderItems.reduce((s: number, it: any) => s + ((Number(it.price) || 0) * (Number(it.quantity) || 1)), 0);
      const totalAmt = Number((order as any).totalAmount || (order as any).total || order.totalPrice || computedItemsTotal || 0);
      const itemsCost = orderItems.reduce((s: number, it: any) => s + ((Number(it.costPrice) || 0) * (Number(it.quantity) || 1)), 0);
      const shippingCost = Number((order as any).shippingCost || order.shippingFee || 0);
      const orderNet = Math.max(0, totalAmt - itemsCost - shippingCost);

      if (isDelivered) {
        totalStoreSales += totalAmt;
        totalDeliveredOrders += 1;
        if (isPos) {
          totalSuccessfulNetPos += orderNet;
        } else {
          totalSuccessfulNetShipping += orderNet;
        }
      } else if (isReturnOrFailed) {
        returnsLosses += shippingCost;
      }
    });

    const isCustodyTx = (t: any) => {
      const note = t.note || t.description || '';
      const id = t.id || '';
      return (
        note.includes('عهدة') ||
        note.includes('استرداد') ||
        note.includes('تسوية') ||
        id.includes('CUST') ||
        id.includes('HND')
      );
    };

    const adminExpenses = rawWalletTransactions
      .filter((t: any) => {
        if (isCustodyTx(t)) return false;
        const isExpense = t.category?.startsWith('expense_') || (settings.expenseCategories || []).includes(t.category || '');
        return t.type === 'سحب' && isExpense && !t.note?.includes('معاملة شريك');
      })
      .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);

    const otherIncome = rawWalletTransactions
      .filter((t: any) => {
        if (isCustodyTx(t)) return false;
        return t.type === 'إيداع' && t.category === 'manual_deposit' && !t.note?.includes('معاملة شريك');
      })
      .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);

    const storeNetProfit = Math.max(0, totalSuccessfulNetPos + totalSuccessfulNetShipping + otherIncome - adminExpenses - returnsLosses);
    const partnerRatio = Number(livePartner.profitRatio || 0);
    const partnerEstimatedProfit = (storeNetProfit * partnerRatio) / 100;
    const undistributedProfit = Math.max(0, partnerEstimatedProfit - dividends);

    // Inventory value calculation
    const totalInventoryValue = (settings.products || []).reduce((sum, p) => {
      const stock = Number(p.stockQuantity) || 0;
      const cost = Number(p.costPrice) || 0;
      return sum + (stock * cost);
    }, 0);
    const partnerInventoryShare = (totalInventoryValue * partnerRatio) / 100;

    return {
      transactions: [...sortedTxs].reverse(), // Show newest first in table
      chartData,
      capital,
      dividends,
      netWithdrawals,
      netBalance,
      custodyAmt,
      totalStoreSales,
      totalDeliveredOrders,
      storeNetProfit,
      partnerRatio,
      partnerEstimatedProfit,
      undistributedProfit,
      totalInventoryValue,
      partnerInventoryShare
    };
  }, [livePartner, rawPartnerTransactions, rawCashHandovers, rawWalletTransactions, rawTreasuryTransactions, rawSupplyOrders, rawOrders, rawTreasury, settings]);

  // Matched partner for personalized login card
  const matchedLoginPartner = useMemo(() => {
    if (selectedPartnerId) {
      return partners.find(p => p.id === selectedPartnerId);
    }
    if (urlPartnerId && partners.length > 0) {
      const normUrlId = normalizeName(urlPartnerId);
      return partners.find(p => 
        p.id === urlPartnerId || 
        p.id === `part_${urlPartnerId}` || 
        urlPartnerId === `part_${p.id}` || 
        normalizeName(p.name) === normUrlId ||
        normalizeName(p.id) === normUrlId ||
        String(p.id).includes(urlPartnerId) ||
        urlPartnerId.includes(String(p.id))
      );
    }
    return null;
  }, [selectedPartnerId, urlPartnerId, partners]);

  // Filter transactions for table
  const filteredTransactions = useMemo(() => {
    if (!partnerData) return [];
    return partnerData.transactions.filter(t => {
      const noteStr = t.note || (t as any).notes || (t as any).description || '';
      const matchesSearch = noteStr.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            t.type.toLowerCase().includes(searchTerm.toLowerCase());
      
      const isIncome = ['capital_addition', 'repayment', 'supply_funding', 'shipping_funding', 'profit_distribution', 'expense_coverage', 'internal_transfer_in'].includes(t.type);
      const isExpense = ['loan', 'profit_withdrawal', 'expense_repayment', 'internal_transfer_out', 'capital_withdrawal', 'wallet_withdrawal', 'personal_withdrawal'].includes(t.type);
      const isCustody = ['custody_give', 'custody_receive'].includes(t.type);

      const matchesType = typeFilter === 'all' || 
                          (typeFilter === 'income' && isIncome) ||
                          (typeFilter === 'expense' && isExpense) ||
                          (typeFilter === 'custody' && isCustody);
      
      return matchesSearch && matchesType;
    });
  }, [partnerData, searchTerm, typeFilter]);

  const getTxDetails = (type: string) => {
    switch (type) {
      case 'loan': return { label: 'سلفة / سحب كاش', color: 'bg-rose-50 text-rose-600 dark:bg-rose-950/20' };
      case 'profit_withdrawal': return { label: 'سحب أرباح', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30' };
      case 'personal_withdrawal': return { label: 'مسحوبات شخصية', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30' };
      case 'wallet_withdrawal': return { label: 'سحب من المحفظة', color: 'bg-rose-50 text-rose-600 dark:bg-rose-950/20' };
      case 'repayment': return { label: 'رد كاش للمحل', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' };
      case 'capital_addition': return { label: 'إيداع رأس مال', color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/20' };
      case 'supply_funding': return { label: 'تمويل بضاعة', color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20' };
      case 'shipping_funding': return { label: 'تمويل شحن', color: 'bg-purple-50 text-purple-600 dark:bg-purple-950/20' };
      case 'expense_coverage': return { label: 'تغطية مصروفات', color: 'bg-teal-50 text-teal-600 dark:bg-teal-950/20' };
      case 'expense_repayment': return { label: 'استرداد مصروفات', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' };
      case 'profit_distribution': return { label: 'توزيع أرباح (+)', color: 'bg-emerald-500 text-white' };
      case 'custody_give': return { label: 'تسليم عهدة نقدية', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/20' };
      case 'custody_receive': return { label: 'استرداد عهدة نقدية', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20' };
      case 'internal_transfer_in': return { label: 'تحويل داخلي مستلم', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20' };
      case 'internal_transfer_out': return { label: 'تحويل داخلي صادر', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/20' };
      default: return { label: 'معاملة مالية', color: 'bg-slate-50 text-slate-600 dark:bg-slate-900/20' };
    }
  };

  // Render Login view if not authenticated
  if (!authenticatedPartner) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6" id="partner-login-container">
        {toast && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl text-xs font-black shadow-xl flex items-center gap-2 ${toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
            <span>{toast.msg}</span>
          </div>
        )}

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-8 space-y-8"
        >
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-indigo-600/10 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Award size={36} />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">بوابة الشركاء المالية</h1>
            <p className="text-sm font-medium text-slate-500">{storeName} - الحسابات والاستعلام المباشر</p>
          </div>

          {isLoadingStore ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">جاري فحص وتحديث بيانات الشركاء...</p>
            </div>
          ) : partners.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/30 text-amber-600 rounded-2xl flex items-center justify-center">
                <AlertCircle size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-800 dark:text-white">لا يوجد شركاء مسجلين بعد</h3>
                <p className="text-xs text-slate-500">لم يتم تسجيل أي شريك في إعدادات هذا المتجر حتى الآن.</p>
              </div>
              <Link
                to={`/store/${effectiveStoreId}/dashboard`}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all"
              >
                الذهاب للوحة الإدارة لإضافة شركاء
              </Link>
            </div>
          ) : matchedLoginPartner ? (
            <div className="space-y-6">
              {/* Personalized Partner Badge */}
              <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 p-4 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-lg shadow-md shadow-indigo-500/20">
                    {matchedLoginPartner.name.slice(0, 1)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-slate-900 dark:text-white text-base">{matchedLoginPartner.name}</h3>
                      <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                        شريك
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">
                      {matchedLoginPartner.profitRatio ? `نسبة الشراكة: ${matchedLoginPartner.profitRatio}%` : 'شريك معتمد بالمتجر'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedPartnerId('')}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 underline cursor-pointer"
                >
                  تغيير
                </button>
              </div>

              <form onSubmit={(e) => handleLogin(e, matchedLoginPartner)} className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-slate-600 dark:text-slate-400">رمز المرور السري (PIN)</label>
                    <span className="text-[10px] text-slate-400 font-bold">الافتراضي: 0000</span>
                  </div>
                  <div className="relative">
                    <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="password"
                      maxLength={6}
                      value={pin}
                      autoFocus
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="أدخل رمز المرور (PIN)..."
                      className="w-full pr-12 pl-4 py-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-indigo-600/20 rounded-2xl outline-none transition-all font-black text-center text-lg tracking-widest text-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
                  >
                    <Lock size={16} /> دخول للبوابة المالية
                  </button>

                  {(!matchedLoginPartner.passcode || matchedLoginPartner.passcode === '0000') && (
                    <button
                      type="button"
                      onClick={() => handleLogin(undefined, matchedLoginPartner, true)}
                      className="w-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 py-3 rounded-2xl font-bold text-xs border border-emerald-200 dark:border-emerald-800/50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle size={14} /> دخول سريع بضغطة واحدة (PIN الافتراضي)
                    </button>
                  )}
                </div>
              </form>
            </div>
          ) : (
            <form onSubmit={(e) => handleLogin(e)} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-600 dark:text-slate-400">اختر اسمك كشريك</label>
                <div className="relative">
                  <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <select
                    value={selectedPartnerId}
                    onChange={(e) => setSelectedPartnerId(e.target.value)}
                    className="w-full pr-12 pl-4 py-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-indigo-600/20 rounded-2xl outline-none transition-all font-bold text-sm text-slate-700 dark:text-white appearance-none cursor-pointer"
                  >
                    <option value="">-- اختر اسم الشريك --</option>
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-400">رمز المرور السري (PIN)</label>
                  <span className="text-[10px] text-slate-400 font-bold">الافتراضي: 0000</span>
                </div>
                <div className="relative">
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="password"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="أدخل رمز المرور (PIN)..."
                    className="w-full pr-12 pl-4 py-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-indigo-600/20 rounded-2xl outline-none transition-all font-black text-center text-lg tracking-widest text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
              >
                <Lock size={16} /> دخول آمن للبوابة المالية
              </button>
            </form>
          )}

          <div className="text-center">
            <Link to={`/store/${effectiveStoreId}/dashboard`} className="text-xs font-bold text-indigo-600 hover:underline flex items-center justify-center gap-1">
              <ChevronLeft size={14} /> العودة للوحة تحكم المتجر الرئيسية
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // Render Portal View once Authenticated
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-4 sm:p-8 space-y-8" dir="rtl">
      
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl text-xs font-black shadow-xl flex items-center gap-2 ${toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 font-black text-2xl">
            {livePartner?.name?.slice(0, 1) || 'ش'}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">{livePartner?.name || 'الشريك'}</h1>
              <span className="text-[10px] font-black bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                شريك معتمد بالمتجر
              </span>
              {livePartner?.profitRatio ? (
                <span className="text-[10px] font-black bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                  نسبة الأرباح {livePartner.profitRatio}%
                </span>
              ) : null}
            </div>
            <p className="text-xs font-bold text-slate-400 mt-1">تجارة وتسويق الكتروني {storeName} • البوابة المالية للشركاء</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowRequestModal(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer shadow-md shadow-emerald-600/20 active:scale-95"
          >
            <Coins size={15} />
            <span>طلب سحب أرباح / تسجيل مصروف</span>
          </button>

          <button
            onClick={() => fetchFreshData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer"
            title="تحديث البيانات من السحابة"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-indigo-600' : ''} />
            <span>تحديث</span>
          </button>

          <button 
            onClick={() => setShowFullStatementModal(true)}
            className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer shadow-sm"
          >
            <Printer size={16} /> طباعة كشف الحساب
          </button>
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut size={14} /> خروج
          </button>
        </div>
      </div>

      {/* Main KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* 1. Capital */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-400 transition-colors"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1">إجمالي رأس المال والاستثمارات</p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white">
                {(partnerData?.capital || 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
              </h3>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-2xl">
              <ArrowUpLeft size={22} />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-bold">مجموع المبالغ المودعة والتمويلية لعمل المتجر</p>
        </motion.div>

        {/* 2. Dividends */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.05 }}
          className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-emerald-400 transition-colors"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1">الأرباح الموزعة والمضافة</p>
              <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                {(partnerData?.dividends || 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
              </h3>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <TrendingUp size={22} />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-bold">إجمالي حصتك من أرباح المتجر التي تم ترحيلها لك</p>
        </motion.div>

        {/* 3. Withdrawals */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-rose-400 transition-colors"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1">المسحوبات والسلف الجارية</p>
              <h3 className="text-3xl font-black text-rose-600 dark:text-rose-400">
                -{(partnerData?.netWithdrawals || 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
              </h3>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-2xl">
              <ArrowDownRight size={22} />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-bold">المسحوبات النقدية والشخصية التي تسلمتها</p>
        </motion.div>

        {/* 4. Net Live Balance */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.15 }}
          className={`p-6 rounded-3xl border shadow-sm relative overflow-hidden transition-colors ${
            (partnerData?.netBalance || 0) >= 0 
              ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/50' 
              : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/50'
          }`}
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">الرصيد الصافي المتاح بالمتجر</p>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-black text-white ${
                  (partnerData?.netBalance || 0) >= 0 ? 'bg-emerald-600' : 'bg-rose-600'
                }`}>
                  {(partnerData?.netBalance || 0) >= 0 ? 'لك بالمحل' : 'عليك سلفة'}
                </span>
              </div>
              <h3 className={`text-3xl font-black ${(partnerData?.netBalance || 0) >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {(partnerData?.netBalance || 0).toLocaleString()} <span className="text-xs font-bold opacity-70">ج.م</span>
              </h3>
            </div>
            <div className={`p-3 rounded-2xl ${(partnerData?.netBalance || 0) >= 0 ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600' : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600'}`}>
              <DollarSign size={22} />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">رأس المال + الأرباح الموزعة - المسحوبات</p>
        </motion.div>

      </div>

      {/* Store Performance & Partnership Profit Share Section */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-indigo-500/20 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-800/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 rounded-xl flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black">أداء المتجر المشترك ومؤشرات الشراكة</h3>
              <p className="text-xs text-indigo-300 font-medium">ملخص مبيعات المتجر، الطلبات الناجحة، وحصتك التقديرية من أرباح المتجر</p>
            </div>
          </div>
          {livePartner?.profitRatio ? (
            <div className="bg-indigo-500/20 border border-indigo-400/40 px-3 py-1.5 rounded-xl text-xs font-black text-indigo-200">
              نسبة الشراكة: {livePartner.profitRatio}%
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-1">
            <p className="text-[11px] font-bold text-indigo-300">إجمالي مبيعات المتجر المسلمة</p>
            <p className="text-xl font-black text-white">{(partnerData?.totalStoreSales || 0).toLocaleString()} <span className="text-xs font-normal text-indigo-200">ج.م</span></p>
            <p className="text-[10px] text-slate-400">إجمالي المبالغ المحصلة من الطلبات</p>
          </div>

          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-1">
            <p className="text-[11px] font-bold text-indigo-300">الطلبات الناجحة والمسلمة</p>
            <p className="text-xl font-black text-emerald-400">{(partnerData?.totalDeliveredOrders || 0).toLocaleString()} <span className="text-xs font-normal text-indigo-200">طلب</span></p>
            <p className="text-[10px] text-slate-400">طلبات شحن وبيوع كاشير ناجحة</p>
          </div>

          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-1">
            <p className="text-[11px] font-bold text-indigo-300">صافي أرباح المتجر الكلية</p>
            <p className="text-xl font-black text-emerald-400">{(partnerData?.storeNetProfit || 0).toLocaleString()} <span className="text-xs font-normal text-indigo-200">ج.م</span></p>
            <p className="text-[10px] text-slate-400">بعد استقطاع البضائع والمصاريف</p>
          </div>

          <div className="bg-indigo-600/30 border border-indigo-400/40 p-4 rounded-2xl space-y-1">
            <p className="text-[11px] font-bold text-indigo-200">نصيبك التقديري من أرباح المتجر</p>
            <p className="text-xl font-black text-amber-300">{(partnerData?.partnerEstimatedProfit || 0).toLocaleString()} <span className="text-xs font-normal text-indigo-200">ج.م</span></p>
            <p className="text-[10px] text-indigo-200 font-bold">بناءً على نسبة شراكتك ({partnerData?.partnerRatio || 0}%)</p>
          </div>
        </div>

        {/* 📦 بطاقة حصة البضاعة بالمخزن */}
        <div className="bg-slate-800/80 border border-indigo-400/20 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center flex-shrink-0">
              <PackageIcon size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-amber-300">حصة الشريك التقديرية من بضاعة المخزن:</span>
                <span className="text-sm font-black text-white">{(partnerData?.partnerInventoryShare || 0).toLocaleString()} ج.م</span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold">
                إجمالي قيمة البضاعة المتوفرة على الرفوف بالمتجر حالياً هي {(partnerData?.totalInventoryValue || 0).toLocaleString()} ج.م (هذه أموال مستثمرة في منتجات بالمخزن).
              </p>
            </div>
          </div>
          <div className="text-left bg-white/10 px-3 py-1.5 rounded-xl text-xs font-black text-indigo-200 flex-shrink-0">
            نسبتك من البضاعة: {partnerData?.partnerRatio || 0}%
          </div>
        </div>
      </div>

      {/* Custody notice if partner has cash custody */}
      {partnerData && partnerData.custodyAmt > 0 && (
        <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 p-4 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-xl">
              <WalletIcon size={18} />
            </div>
            <div>
              <p className="text-xs font-black text-amber-800 dark:text-amber-300">
                لديك عهدة نقدية تشغيلية جارية بقيمة: <strong className="text-sm font-black underline">{partnerData.custodyAmt.toLocaleString()} ج.م</strong>
              </p>
              <p className="text-[10px] text-amber-700/80 dark:text-amber-400 font-bold">هذه العهدة مخصصة لشراء مخزون أو سداد مصروفات ومطابقتها مع الإدارة.</p>
            </div>
          </div>
        </div>
      )}

      {/* Chart and Rules Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Historical Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white">منحنى نمو وتغير الرصيد الجاري</h3>
            <p className="text-xs font-bold text-slate-400 mt-1">تتبع تغير مستحقاتك المالية بالمتجر مع كل حركة إيداع أو سحب أو توزيع أرباح</p>
          </div>

          <div className="h-64 w-full">
            {partnerData?.chartData && partnerData.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={partnerData.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                    labelClassName="font-black text-xs text-indigo-300"
                  />
                  <Area type="monotone" dataKey="الرصيد الجاري" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 font-bold text-xs italic">
                لا توجد حركات كافية لرسم المنحنى بعد
              </div>
            )}
          </div>
        </div>

        {/* Brand/Business Model Statement Card */}
        <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white p-6 rounded-3xl shadow-xl border border-indigo-500/20 flex flex-col justify-between space-y-6 relative overflow-hidden">
          <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="space-y-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 rounded-xl flex items-center justify-center">
                <FileText size={20} />
              </div>
              <h3 className="text-md font-black">سياسة التعامل في التسويق - عبده ميديا</h3>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-indigo-200/90 font-medium">
              <p>📌 <strong className="text-white">المادة الأولى: تجميد البضائع</strong> - يتم تجميد تكلفة البضائع المباعة بسعر الجملة تماماً لإعادة شراء وتجديد المخزون، ولا يجوز سحبها أو توزيعها كأرباح تحت أي ظرف لضمان استمرارية المتجر.</p>
              <p>📌 <strong className="text-white">المادة الثانية: حساب صافي الأرباح</strong> - الأرباح القابلة للتوزيع هي صافي الإيراد بعد استقطاع تكلفة البضائع بالجملة، كافة مصاريف الشحن والتسويق، وهالك التغليف، ومصاريف التشغيل بالكامل.</p>
              <p>📌 <strong className="text-white">المادة الثالثة: المسحوبات الشخصية</strong> - تخصم أي سلفة أو مسحوبات نقدية يسحبها الشريك خلال الشهر مباشرة من رصيده الجاري وحقوقه، ويستلم الصافي المتبقي له نقداً عند التصفية.</p>
              <p>📌 <strong className="text-white">المادة الرابعة: الشراكة والتخارج</strong> - تخضع تصفية أي شريك لسياسة فض الشراكة المعتمدة بالمادة السادسة لشركة عبده ميديا.</p>
              
              <div className="pt-3.5 border-t border-indigo-500/20 flex justify-end">
                <button
                  onClick={() => {
                    const html = generateAbdoMediaPolicyHTML(storeName || 'شركائنا للنجاح');
                    printHTMLDirectly(html);
                  }}
                  className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-black py-1.5 px-3 rounded-xl text-[10px] cursor-pointer transition-all border border-white/10"
                >
                  <Printer size={12} />
                  <span>طباعة وثيقة السياسة الرسمية بالكامل (عبده ميديا)</span>
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-indigo-800/60 relative z-10 flex justify-between items-center text-[10px] text-indigo-300 font-bold">
            <span>تجارة وتسويق الكتروني عبده ميديا</span>
            <span>حقوق الطبع محفوظة © 2026</span>
          </div>
        </div>

      </div>

      {/* Filter and Transaction Table */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white">كشف حركة المعاملات المفصلة</h3>
            <p className="text-xs font-bold text-slate-400 mt-1">عرض ومراجعة كافة العمليات المالية المقيدة بحسابك لدى المتجر</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="ابحث في الملاحظات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-48 pr-9 pl-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 font-bold"
              />
            </div>

            {/* Filter Dropdown */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 font-bold"
            >
              <option value="all">كل المعاملات ({partnerData?.transactions.length || 0})</option>
              <option value="income">إيداعات وأرباح (+)</option>
              <option value="expense">مسحوبات وسلف (-)</option>
              <option value="custody">عهد نقدية وتسويات</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-bold">
                <th className="py-3 px-4">التاريخ والوقت</th>
                <th className="py-3 px-4">نوع المعاملة</th>
                <th className="py-3 px-4">المبلغ</th>
                <th className="py-3 px-4">ملاحظات دفتريّة</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((t) => {
                const isIncome = ['capital_addition', 'repayment', 'supply_funding', 'shipping_funding', 'profit_distribution', 'expense_coverage', 'internal_transfer_in'].includes(t.type);
                const isCustody = ['custody_give', 'custody_receive'].includes(t.type);
                return (
                  <tr key={t.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-500">
                      {new Date(t.date).toLocaleString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-full font-black text-[10px] ${getTxDetails(t.type).color}`}>
                        {getTxDetails(t.type).label}
                      </span>
                    </td>
                    <td className={`py-3 px-4 font-black text-sm ${isIncome ? 'text-emerald-600' : isCustody ? 'text-amber-600' : 'text-rose-600'}`}>
                      {isIncome ? '+' : isCustody ? '' : '-'}{t.amount.toLocaleString()} ج.م
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-bold">
                      {t.note || (t as any).notes || 'لا توجد ملاحظات'}
                    </td>
                  </tr>
                );
              })}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 font-bold italic">
                    لا توجد معاملات مسجلة تطابق خيارات البحث الحالية
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official Full Statement Modal */}
      {showFullStatementModal && livePartner && (
        <PartnerStatementModal
          partner={livePartner}
          settings={settings}
          wallet={rawWallet}
          orders={rawOrders}
          treasury={rawTreasury}
          onClose={() => setShowFullStatementModal(false)}
        />
      )}

      {/* Partner Request Modal */}
      {showRequestModal && livePartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" dir="rtl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-emerald-500/10 text-emerald-600 rounded-xl flex items-center justify-center font-black">
                  <Coins size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">تقديم طلب للإدارة</h3>
                  <p className="text-[11px] text-slate-400 font-medium">سحب أرباح أو تسجيل مصروف مدفوع للشريك</p>
                </div>
              </div>
              <button
                onClick={() => setShowRequestModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitPartnerRequest} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300">نوع الطلب</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRequestType('withdrawal')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-black border transition-all ${
                      requestType === 'withdrawal'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    سحب أرباح
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestType('expense')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-black border transition-all ${
                      requestType === 'expense'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    مصروف دفعته
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestType('inquiry')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-black border transition-all ${
                      requestType === 'inquiry'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    استفسار
                  </button>
                </div>
              </div>

              {requestType !== 'inquiry' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300">المبلغ المطلوب (ج.م)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={requestAmount}
                    onChange={(e) => setRequestAmount(e.target.value)}
                    placeholder="مثال: 1500"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-emerald-500 font-black text-sm"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300">تفاصيل / ملاحظات الطلب</label>
                <textarea
                  rows={3}
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder="اكتب أي توضيحات للإدارة (طريقة الاستلام، فودافون كاش، تفاصيل الفاتورة...)"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-emerald-500 font-bold text-xs"
                ></textarea>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  {isSubmittingRequest ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
                  <span>إرسال الطلب للإدارة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 rounded-xl font-bold text-xs transition-all"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Floating internal toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl font-black text-xs text-white flex items-center gap-2 border ${
              toast.type === 'success' 
                ? 'bg-emerald-600 border-emerald-500 shadow-emerald-500/20' 
                : 'bg-rose-600 border-rose-500 shadow-rose-500/20'
            }`}
            dir="rtl"
          >
            {toast.type === 'success' ? <CheckCircle size={14} /> : <Lock size={14} />}
            <span>{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
