import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Partner, PartnerTransaction, StoreData, Wallet, Order, Treasury } from '../types';
import { 
  User, Lock, LogOut, ArrowUpLeft, ArrowDownRight, 
  DollarSign, Search, Printer, FileText, CheckCircle,
  Loader2, RefreshCw, AlertCircle, TrendingUp,
  Copy, Share2, Coins, Package as PackageIcon,
  X, Send, ShieldCheck, Building2, Key, BarChart3
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
import { PartnerProfileTab } from './PartnerProfileTab';
import { PartnerReportsView } from './PartnerReportsView';
import { PartnerAuthView } from './PartnerAuthView';

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

type TabKey = 'overview' | 'withdrawals' | 'statement' | 'performance' | 'reports' | 'profile' | 'account';

export default function PartnerPortal({ allStoresData, updateSettings, showToast: externalShowToast }: PartnerPortalProps) {
  const { storeId, tab: routeTab } = useParams<{ storeId: string; tab?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlPartnerId = searchParams.get('p') || searchParams.get('partnerId') || searchParams.get('partner') || '';
  const urlTab = searchParams.get('tab') || routeTab;

  const validTabs: TabKey[] = ['overview', 'withdrawals', 'statement', 'performance', 'reports', 'profile', 'account'];
  const activeTab: TabKey = validTabs.includes(urlTab as TabKey) ? (urlTab as TabKey) : 'overview';

  const [directStoreData, setDirectStoreData] = useState<StoreData | null>(null);
  const [isLoadingStore, setIsLoadingStore] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [partnerRequestsList, setPartnerRequestsList] = useState<db.PartnerPortalRequest[]>([]);

  const effectiveStoreId = useMemo(() => {
    if (storeId) return storeId;
    const keys = Object.keys(allStoresData);
    if (keys.length > 0) return keys[0];
    return '';
  }, [storeId, allStoresData]);

  const loadRequests = useCallback(async () => {
    const targetStoreId = storeId || effectiveStoreId;
    if (!targetStoreId) return;
    try {
      const reqs = await db.getPartnerRequests(targetStoreId);
      setPartnerRequestsList(reqs);
    } catch (_) {}
  }, [storeId, effectiveStoreId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Fetch fresh store data on mount
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
          showToast('تم تحديث البيانات المالية بنجاح', 'success');
        }
      }
      await loadRequests();
    } catch (err) {
      console.error('[PartnerPortal] Error loading store data:', err);
      if (isManualRefresh) {
        showToast('تعذر تحديث البيانات، يرجى المحاولة لاحقاً', 'error');
      }
    } finally {
      setIsLoadingStore(false);
      setIsRefreshing(false);
    }
  }, [storeId, effectiveStoreId, loadRequests]);

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
  const rawTreasury: Treasury = activeStoreData?.treasury || { accounts: [], transactions: [] };
  const storeName = activeStoreData?.name || settings.storeName || 'وان تولز للعدد اليدوية والكهربائية';

  // Authentication State
  const [authenticatedPartner, setAuthenticatedPartner] = useState<Partner | null>(() => {
    try {
      const saved = sessionStorage.getItem(`partner_portal_auth_${effectiveStoreId}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(() => {
    if (urlPartnerId) return urlPartnerId;
    return '';
  });

  const [pinCode, setPinCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    if (externalShowToast) externalShowToast(msg, type);
    setTimeout(() => setToast(null), 3500);
  };

  // Transaction Filters State (for statement tab)
  const [txSearch, setTxSearch] = useState('');
  const [txCategoryFilter, setTxCategoryFilter] = useState<'all' | 'withdrawals' | 'capital' | 'dividends' | 'custody'>('all');
  const [selectedStatementPartner, setSelectedStatementPartner] = useState<Partner | null>(null);

  // New Request Form State (Withdrawals / Reimbursements / Inquiries)
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestType, setRequestType] = useState<'withdrawal' | 'expense' | 'inquiry'>('withdrawal');
  const [requestAmount, setRequestAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'wallet' | 'instapay' | 'bank' | 'cash'>('wallet');
  const [payoutAccount, setPayoutAccount] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // PIN Management State (in account tab)
  const [newPinInput, setNewPinInput] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);

  // Auto-login if PIN is provided in URL or if partner has default '0000' and auto=1
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
  }, [partners, urlPartnerId, searchParams, authenticatedPartner, effectiveStoreId]);

  // Keep authenticated partner synced with fresh partners list
  const livePartner = useMemo(() => {
    if (!authenticatedPartner) return null;
    const current = partners.find(p => 
      (p.id && authenticatedPartner.id && String(p.id).trim() === String(authenticatedPartner.id).trim()) ||
      (authenticatedPartner.phone && p.phone && String(p.phone).trim() === String(authenticatedPartner.phone).trim()) ||
      (p.name && authenticatedPartner.name && normalizeName(p.name) === normalizeName(authenticatedPartner.name)) ||
      (p.id && String(p.id) === `part_${authenticatedPartner.id}`) ||
      (authenticatedPartner.id && String(authenticatedPartner.id) === `part_${p.id}`)
    );
    return current || authenticatedPartner;
  }, [authenticatedPartner, partners]);

  // Sync fresh partner data with session storage
  useEffect(() => {
    if (livePartner && effectiveStoreId) {
      sessionStorage.setItem(`partner_portal_auth_${effectiveStoreId}`, JSON.stringify(livePartner));
    }
  }, [livePartner, effectiveStoreId]);

  // Partner Portal Permissions
  const portalPerms = useMemo(() => {
    const p = livePartner?.portalPermissions || {};
    return {
      canViewOverview: p.canViewOverview !== false,
      canViewCapital: p.canViewCapital !== false,
      canViewProfits: p.canViewProfits !== false,
      canViewCustody: p.canViewCustody !== false,
      canViewWithdrawalsTab: p.canViewWithdrawalsTab !== false,
      canRequestWithdrawal: p.canRequestWithdrawal !== false,
      canRequestExpense: p.canRequestExpense !== false,
      canViewStatementTab: p.canViewStatementTab !== false,
      canPrintStatement: p.canPrintStatement !== false,
      canViewPerformanceTab: p.canViewPerformanceTab !== false,
      canViewStoreSales: p.canViewStoreSales !== false,
      canViewStoreProfits: p.canViewStoreProfits !== false,
      canViewReportsTab: p.canViewReportsTab !== false,
      allowedReports: {
        salesAndRevenue: p.allowedReports?.salesAndRevenue !== false,
        topSellingProducts: p.allowedReports?.topSellingProducts !== false,
        inventoryValuation: p.allowedReports?.inventoryValuation !== false,
        expensesBreakdown: p.allowedReports?.expensesBreakdown === true,
        shippingPerformance: p.allowedReports?.shippingPerformance !== false,
        profitDistributions: p.allowedReports?.profitDistributions !== false,
        cashFlowSummary: p.allowedReports?.cashFlowSummary === true
      },
      canViewProfileTab: p.canViewProfileTab !== false,
      canEditProfile: p.canEditProfile !== false,
      canEditPayoutAccounts: p.canEditPayoutAccounts !== false,
      canChangeSecurity: p.canChangeSecurity !== false
    };
  }, [livePartner]);

  // Allowed Tabs computed dynamically
  const allowedTabs = useMemo(() => {
    const list: TabKey[] = [];
    if (portalPerms.canViewOverview) list.push('overview');
    if (portalPerms.canViewWithdrawalsTab) list.push('withdrawals');
    if (portalPerms.canViewStatementTab) list.push('statement');
    if (portalPerms.canViewPerformanceTab) list.push('performance');
    if (portalPerms.canViewReportsTab) list.push('reports');
    if (portalPerms.canViewProfileTab) list.push('profile');
    if (portalPerms.canChangeSecurity) list.push('account');
    return list;
  }, [portalPerms]);

  // Effective Active Tab
  const currentTab: TabKey = useMemo(() => {
    if (allowedTabs.length === 0) return 'overview';
    if (allowedTabs.includes(activeTab)) return activeTab;
    return allowedTabs[0];
  }, [allowedTabs, activeTab]);

  // Handle Tab Switch
  const handleTabChange = (newTab: TabKey) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', newTab);
      return next;
    }, { replace: true });
  };

  // Handle Login
  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError('');

    if (!selectedPartnerId) {
      setAuthError('يرجى تحديد اسم الشريك أولاً للمتابعة');
      return;
    }

    const partner = partners.find(p => p.id === selectedPartnerId);
    if (!partner) {
      setAuthError('تعذر العثور على حساب الشريك، يرجى إعادة المحاولة');
      return;
    }

    const correctPin = String(partner.passcode || '0000').trim();
    const enteredPin = pinCode.trim();

    if (enteredPin === correctPin) {
      setAuthenticatedPartner(partner);
      sessionStorage.setItem(`partner_portal_auth_${effectiveStoreId}`, JSON.stringify(partner));
      setPinCode('');
      showToast(`أهلاً بك يا ${partner.name} في بوابتك المالية`, 'success');
    } else {
      setAuthError('رمز المرور (PIN) غير صحيح. الرمز الافتراضي هو 0000 أو اسأل الإدارة');
    }
  };

  // Handle Submitting Partner Request
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!livePartner) return;

    const amt = parseFloat(requestAmount);
    if (requestType !== 'inquiry' && (!amt || isNaN(amt) || amt <= 0)) {
      showToast('يرجى إدخال مبلغ صحيح للطلب', 'error');
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const typeArabic = requestType === 'withdrawal' ? 'طلب سحب أرباح' : requestType === 'expense' ? 'تسجيل مصروف مدفوع من الشريك' : 'استفسار أو ملاحظة مالية';
      
      let payoutDetails = '';
      if (requestType === 'withdrawal') {
        const methodLabels = {
          wallet: 'محفظة إلكترونية (فودافون/أورنج/اتصالات/وي)',
          instapay: 'إنستاباي (InstaPay IPN)',
          bank: 'تحويل بنكي رسمي',
          cash: 'استلام نقدي كاش من الخزينة'
        };
        payoutDetails = ` [طريقة الاستلام: ${methodLabels[payoutMethod]} ${payoutAccount ? `- الحساب: ${payoutAccount}` : ''}]`;
      }

      const logEntry = {
        id: `req_${Date.now()}`,
        user: `الشريك: ${livePartner.name}`,
        action: typeArabic,
        details: `${typeArabic} بمبلغ ${amt > 0 ? `${amt.toLocaleString()} ج.م` : ''}${payoutDetails} - ملاحظات: ${requestNotes || 'بدون تفاصيل إضافية'}`,
        date: new Date().toISOString(),
        timestamp: Date.now()
      };

      const newPartnerRequest: db.PartnerPortalRequest = {
        id: `preq_${Date.now()}`,
        storeId: effectiveStoreId,
        partnerId: livePartner.id,
        partnerName: livePartner.name,
        type: requestType,
        typeArabic,
        amount: amt || 0,
        notes: `${requestNotes || ''}${payoutDetails}`,
        date: new Date().toISOString(),
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      const res = await db.submitPartnerRequest(effectiveStoreId, newPartnerRequest);
      if (!res.success) {
        throw new Error(res.error || 'Failed to submit partner request');
      }

      setPartnerRequestsList(prev => [newPartnerRequest, ...prev.filter(r => r.id !== newPartnerRequest.id)]);

      try {
        const updatedPartnerRequests = [newPartnerRequest, ...(settings.partnerRequests || [])];
        const updatedLogs = [logEntry, ...(settings.activityLogs || [])];
        updateSettings({
          ...settings,
          partnerRequests: updatedPartnerRequests,
          activityLogs: updatedLogs
        });
      } catch (_) {}

      showToast('تم إرسال طلبك بنجاح إلى إدارة المتجر للمراجعة والاعتماد', 'success');
      setShowRequestModal(false);
      setRequestAmount('');
      setRequestNotes('');
      setPayoutAccount('');
      
      handleTabChange('withdrawals');
    } catch (err: any) {
      console.error('Error submitting partner request:', err);
      showToast(err?.message || 'حدث خطأ أثناء إرسال الطلب، يرجى المحاولة لاحقاً', 'error');
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

  // Handle Update Partner PIN
  const handleUpdatePin = () => {
    if (!livePartner) return;
    const cleanPin = newPinInput.trim().replace(/\D/g, '');
    if (cleanPin.length < 4) {
      showToast('رمز PIN يجب أن يتكون من 4 أرقام على الأقل', 'error');
      return;
    }

    const updatedPartners = partners.map(p => p.id === livePartner.id ? { ...p, passcode: cleanPin } : p);
    updateSettings({
      ...settings,
      partners: updatedPartners
    });

    if (effectiveStoreId) {
      db.getStoreData(effectiveStoreId).then(cur => {
        if (cur) {
          db.saveStoreData({ id: effectiveStoreId, name: storeName } as any, {
            ...cur,
            settings: { ...cur.settings, partners: updatedPartners }
          });
        }
      });
    }

    showToast('تم تغيير رمز PIN السري بنجاح', 'success');
    setNewPinInput('');
    setIsChangingPin(false);
  };

  // Comprehensive Partner Calculations
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

    // 3. Wallet Transactions related to partner
    const matchedWalletTxs: PartnerTransaction[] = [];
    rawWalletTransactions.forEach((wTx: any) => {
      const paidBy = wTx.details?.paidByPartnerId;
      const noteNorm = normalizeName(wTx.note || '');
      const isPaidByPartner = paidBy && partnerHolderIds.includes(paidBy);
      const isMentionedInNote = normPName && noteNorm.includes(normPName) && (wTx.type === 'سحب' || wTx.type === 'إيداع');

      if (isPaidByPartner || isMentionedInNote) {
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
        // Neutral
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

    // Financial totals
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

    // Custody calculation
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

    // Pending withdrawal requests
    const pendingWithdrawalHold = partnerRequestsList
      .filter(r => (r.partnerId === pId || normalizeName(r.partnerName) === normPName) && r.type === 'withdrawal' && r.status === 'pending')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    const availableToWithdraw = netBalance - pendingWithdrawalHold;

    // Store-wide Performance
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
      const rawOrderTotal = Number(order.productPrice || (order as any).total || (order as any).price || computedItemsTotal || 0);

      if (isDelivered) {
        totalStoreSales += rawOrderTotal;
        totalDeliveredOrders += 1;
        if (isPos) totalSuccessfulNetPos += rawOrderTotal;
        else totalSuccessfulNetShipping += rawOrderTotal;
      } else if (isReturnOrFailed) {
        returnsLosses += Number(order.shippingFee || settings.returnShippingFee || 40);
      }
    });

    const storeNetProfit = Math.max(0, (totalStoreSales * 0.28) - returnsLosses);
    const partnerRatio = Number(livePartner.profitRatio || 0);
    const partnerEstimatedProfit = (storeNetProfit * partnerRatio) / 100;
    const undistributedProfit = Math.max(0, partnerEstimatedProfit - dividends);

    const inventoryProducts = activeStoreData?.settings?.products || settings.products || [];
    const totalInventoryValue = inventoryProducts.reduce((sum: number, p: any) => {
      const stock = Number(p.stock || p.quantity || p.inventory || 0);
      const cost = Number(p.costPrice || p.cost || p.wholesalePrice || 0);
      return sum + (stock * cost);
    }, 0);
    const partnerInventoryShare = (totalInventoryValue * partnerRatio) / 100;

    return {
      transactions: [...sortedTxs].reverse(),
      chartData,
      capital,
      dividends,
      withdrawals,
      netWithdrawals,
      netBalance,
      pendingWithdrawalHold,
      availableToWithdraw,
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
  }, [livePartner, rawPartnerTransactions, rawCashHandovers, rawWalletTransactions, rawTreasuryTransactions, rawSupplyOrders, rawOrders, rawTreasury, settings, partnerRequestsList, activeStoreData]);

  // Filtered partner requests for current partner
  const myPartnerRequests = useMemo(() => {
    if (!livePartner) return [];
    return partnerRequestsList.filter(
      r => r.partnerId === livePartner.id || normalizeName(r.partnerName) === normalizeName(livePartner.name)
    );
  }, [partnerRequestsList, livePartner]);

  // Filtered Transactions for statement tab
  const filteredStatementTxs = useMemo(() => {
    if (!partnerData) return [];
    return partnerData.transactions.filter(t => {
      if (txCategoryFilter === 'withdrawals' && !['loan', 'profit_withdrawal', 'expense_repayment', 'internal_transfer_out', 'capital_withdrawal', 'wallet_withdrawal'].includes(t.type)) return false;
      if (txCategoryFilter === 'capital' && !['capital_addition', 'supply_funding', 'shipping_funding', 'expense_coverage', 'internal_transfer_in'].includes(t.type)) return false;
      if (txCategoryFilter === 'dividends' && t.type !== 'profit_distribution') return false;
      if (txCategoryFilter === 'custody' && !['custody_give', 'custody_receive'].includes(t.type)) return false;

      if (txSearch) {
        const query = txSearch.toLowerCase();
        const note = (t.note || '').toLowerCase();
        const amount = String(t.amount || '');
        const date = (t.date || '').toLowerCase();
        return note.includes(query) || amount.includes(query) || date.includes(query);
      }

      return true;
    });
  }, [partnerData, txCategoryFilter, txSearch]);

  const getTxTypeBadge = (type: string) => {
    switch (type) {
      case 'profit_distribution':
        return { label: 'توزيع أرباح', bg: 'text-emerald-700 bg-emerald-50 border border-emerald-200' };
      case 'capital_addition':
        return { label: 'إيداع رأس مال', bg: 'text-teal-700 bg-teal-50 border border-teal-200' };
      case 'supply_funding':
        return { label: 'تمويل بضاعة', bg: 'text-[#008060] bg-emerald-50 border border-[#008060]/30' };
      case 'loan':
        return { label: 'سلفة / مسحوبات', bg: 'text-rose-700 bg-rose-50 border border-rose-200' };
      case 'profit_withdrawal':
        return { label: 'سحب من الأرباح', bg: 'text-amber-700 bg-amber-50 border border-amber-200' };
      case 'custody_give':
        return { label: 'تسليم عهدة', bg: 'text-sky-700 bg-sky-50 border border-sky-200' };
      case 'custody_receive':
        return { label: 'استرداد عهدة', bg: 'text-indigo-700 bg-indigo-50 border border-indigo-200' };
      default:
        return { label: 'معاملة مالية', bg: 'text-slate-700 bg-slate-100 border border-slate-200' };
    }
  };

  // ----------------------------------------------------
  // Render: Loading Screen (Clean Light Theme)
  // ----------------------------------------------------
  if (isLoadingStore) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-[#008060] flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 mb-4 animate-pulse">
          <Building2 size={28} />
        </div>
        <h2 className="text-xl font-black mb-1 text-slate-900">{storeName}</h2>
        <p className="text-xs text-[#008060] font-bold mb-4">جاري تحميل البوابة المالية ومزامنة الحسابات السحابية...</p>
        <Loader2 className="animate-spin text-[#008060]" size={24} />
      </div>
    );
  }

  // ----------------------------------------------------
  // Render: Authentication / Login Screen (Secure Multi-Method Auth)
  // ----------------------------------------------------
  if (!livePartner) {
    return (
      <PartnerAuthView
        partners={partners}
        storeName={storeName}
        storeId={effectiveStoreId}
        settings={settings}
        updateSettings={updateSettings}
        onAuthenticated={(p) => {
          setAuthenticatedPartner(p);
          sessionStorage.setItem(`partner_portal_auth_${effectiveStoreId}`, JSON.stringify(p));
        }}
        showToast={showToast}
      />
    );
  }

  // ----------------------------------------------------
  // Render: Authenticated Partner Portal (Clean Light Theme)
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans pb-16" dir="rtl">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-xs font-black shadow-xl flex items-center gap-2 border ${
          toast.type === 'error' 
            ? 'bg-rose-50 text-rose-800 border-rose-300' 
            : 'bg-emerald-50 text-emerald-900 border-emerald-300'
        }`}>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Top Header Navigation (Pure White & Emerald) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Brand & Partner ID */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#008060] to-[#0a664e] text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0">
              {livePartner.name.slice(0, 1)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-slate-900">
                  {livePartner.name}
                </h1>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#008060] border border-emerald-200">
                  شريك معتمد ({livePartner.profitRatio || 0}%)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {storeName} • البوابة المالية المباشرة
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            {portalPerms.canRequestWithdrawal && (
              <button
                onClick={() => setShowRequestModal(true)}
                className="flex items-center gap-1.5 bg-[#008060] hover:bg-[#0a664e] text-white px-3.5 py-2 rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <Coins size={14} />
                <span>طلب سحب أرباح</span>
              </button>
            )}

            <button
              onClick={() => fetchFreshData(true)}
              disabled={isRefreshing}
              className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200"
              title="مزامنة وتحديث البيانات"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-[#008060]' : ''} />
              <span className="hidden md:inline">مزامنة</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border border-rose-200"
              title="تسجيل الخروج الآمن"
            >
              <LogOut size={14} />
              <span className="hidden md:inline">خروج</span>
            </button>
          </div>

        </div>

        {/* Navigation Tabs Bar (Clean Segmented White Bar) */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-2 border-t border-slate-100">
            {portalPerms.canViewOverview && (
              <button
                onClick={() => handleTabChange('overview')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap ${
                  currentTab === 'overview'
                    ? 'border-[#008060] text-[#008060] bg-emerald-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <DollarSign size={15} />
                <span>المركز المالي والأرصدة</span>
              </button>
            )}

            {portalPerms.canViewWithdrawalsTab && (
              <button
                onClick={() => handleTabChange('withdrawals')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap relative ${
                  currentTab === 'withdrawals'
                    ? 'border-[#008060] text-[#008060] bg-emerald-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Coins size={15} />
                <span>طلبات السحب والمصروفات</span>
                {myPartnerRequests.filter(r => r.status === 'pending').length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                )}
              </button>
            )}

            {portalPerms.canViewStatementTab && (
              <button
                onClick={() => handleTabChange('statement')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap ${
                  currentTab === 'statement'
                    ? 'border-[#008060] text-[#008060] bg-emerald-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <FileText size={15} />
                <span>كشف الحساب والعمليات</span>
              </button>
            )}

            {portalPerms.canViewPerformanceTab && (
              <button
                onClick={() => handleTabChange('performance')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap ${
                  currentTab === 'performance'
                    ? 'border-[#008060] text-[#008060] bg-emerald-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <TrendingUp size={15} />
                <span>أداء المتجر والشراكة</span>
              </button>
            )}

            {portalPerms.canViewReportsTab && (
              <button
                onClick={() => handleTabChange('reports')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap ${
                  currentTab === 'reports'
                    ? 'border-[#008060] text-[#008060] bg-emerald-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <BarChart3 size={15} />
                <span>تقارير المتجر المخصصة</span>
              </button>
            )}

            {portalPerms.canViewProfileTab && (
              <button
                onClick={() => handleTabChange('profile')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap ${
                  currentTab === 'profile'
                    ? 'border-[#008060] text-[#008060] bg-emerald-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <User size={15} />
                <span>الملف الشخصي والصلاحيات</span>
              </button>
            )}

            {portalPerms.canChangeSecurity && (
              <button
                onClick={() => handleTabChange('account')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap ${
                  currentTab === 'account'
                    ? 'border-[#008060] text-[#008060] bg-emerald-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <ShieldCheck size={15} />
                <span>بيانات الشراكة والأمان</span>
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">

        {/* ---------------------------------------------------- */}
        {/* TAB 1: المركز المالي والأرصدة (OVERVIEW)            */}
        {/* ---------------------------------------------------- */}
        {currentTab === 'overview' && portalPerms.canViewOverview && (
          <div className="space-y-6">
            
            {/* Top 4 Financial Metric Cards (Clean Light Theme) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: الرصيد الصافي المتاح */}
              <div className={`p-6 rounded-3xl border shadow-xs relative overflow-hidden transition-all ${
                (partnerData?.netBalance || 0) >= 0 
                  ? 'bg-gradient-to-br from-emerald-50 to-white border-emerald-200' 
                  : 'bg-gradient-to-br from-rose-50 to-white border-rose-200'
              }`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                      الرصيد الصافي المتاح بالمتجر
                    </span>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className={`text-3xl font-black font-mono tracking-tight ${
                        (partnerData?.netBalance || 0) >= 0 ? 'text-[#008060]' : 'text-rose-600'
                      }`}>
                        {(partnerData?.netBalance || 0).toLocaleString()}
                      </span>
                      <span className="text-xs font-bold text-slate-500">ج.م</span>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black ${
                    (partnerData?.netBalance || 0) >= 0 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                  }`}>
                    {(partnerData?.netBalance || 0) >= 0 ? 'لك بالمحل' : 'عليك سلفة'}
                  </span>
                </div>

                {/* Pending Hold Breakdown */}
                {(partnerData?.pendingWithdrawalHold || 0) > 0 && (
                  <div className="mt-2.5 p-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-bold flex flex-col gap-0.5">
                    <div className="flex justify-between">
                      <span>⏳ طلب سحب قيد المراجعة:</span>
                      <span className="font-mono font-black">-{(partnerData?.pendingWithdrawalHold || 0).toLocaleString()} ج.م</span>
                    </div>
                    <div className="text-[10px] text-slate-500 flex justify-between">
                      <span>المتاح الفعلي بعد الصرف:</span>
                      <span className="font-mono font-bold">{(partnerData?.availableToWithdraw || 0).toLocaleString()} ج.م</span>
                    </div>
                  </div>
                )}

                <div className="mt-3 text-[10px] text-slate-400 font-medium">
                  رأس المال + الأرباح الموزعة - المسحوبات المعتمدة
                </div>
              </div>

              {/* Card 2: رأس المال المستثمر */}
              {portalPerms.canViewCapital && (
                <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                        رأس المال المستثمر والتمويل
                      </span>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-3xl font-black font-mono text-slate-900">
                          {(partnerData?.capital || 0).toLocaleString()}
                        </span>
                        <span className="text-xs font-bold text-slate-500">ج.م</span>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50 text-[#008060]">
                      <PackageIcon size={20} />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium mt-3">
                    إجمالي الحصص الرأسمالية وتمويلات البضائع
                  </p>
                </div>
              )}

              {/* Card 3: الأرباح الموزعة */}
              {portalPerms.canViewProfits && (
                <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                        إجمالي الأرباح الموزعة للشريك
                      </span>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-3xl font-black font-mono text-amber-600">
                          {(partnerData?.dividends || 0).toLocaleString()}
                        </span>
                        <span className="text-xs font-bold text-slate-500">ج.م</span>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                      <TrendingUp size={20} />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium mt-3">
                    أرباح تم اعتمادها وتوزيعها لحسابك رسمياً
                  </p>
                </div>
              )}

              {/* Card 4: إجمالي المسحوبات والسلف */}
              {portalPerms.canViewProfits && (
                <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                        المسحوبات الشخصية والسلف
                      </span>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-3xl font-black font-mono text-rose-600">
                          {(partnerData?.netWithdrawals || 0).toLocaleString()}
                        </span>
                        <span className="text-xs font-bold text-slate-500">ج.م</span>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
                      <ArrowDownRight size={20} />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium mt-3">
                    المبالغ التي تم استلامها وصرفها نقداً
                  </p>
                </div>
              )}

            </div>

            {/* Visual Balance Progression Chart (Pure White Card & Light Grid) */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    تطور الرصيد الجاري التراكمي
                  </h3>
                  <p className="text-xs text-slate-500">
                    حركة الحساب المالي عبر المعاملات والإيداعات والمسحوبات الزمنية
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-[#008060]">
                  {partnerData?.transactions.length || 0} حركة مالية مسجلة
                </span>
              </div>

              <div className="h-64 sm:h-72 w-full pt-2" dir="ltr">
                {(!partnerData?.chartData || partnerData.chartData.length === 0) ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                    لا توجد حركات كافية لرسم المنحنى البياني حتى الآن.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={partnerData.chartData}>
                      <defs>
                        <linearGradient id="partnerPortalEmeraldLight" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#008060" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#008060" stopOpacity={0.02}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#ffffff', 
                          borderColor: '#cbd5e1', 
                          borderRadius: '16px',
                          color: '#0f172a',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          direction: 'rtl'
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="الرصيد الجاري" 
                        stroke="#008060" 
                        strokeWidth={3} 
                        fillOpacity={1} 
                        fill="url(#partnerPortalEmeraldLight)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Quick Action Shortcuts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div 
                onClick={() => handleTabChange('withdrawals')}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-[#008060] hover:shadow-sm transition-all cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#008060] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Coins size={20} />
                </div>
                <h4 className="font-black text-sm text-slate-900 mb-1">تقديم ومتابعة طلبات السحب</h4>
                <p className="text-xs text-slate-500">طلب سحب فوري عبر إنستاباي أو المحافظ ومتابعة حالة الطلبات المعلقة.</p>
              </div>

              <div 
                onClick={() => handleTabChange('statement')}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-[#008060] hover:shadow-sm transition-all cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <FileText size={20} />
                </div>
                <h4 className="font-black text-sm text-slate-900 mb-1">كشف الحساب والطباعة</h4>
                <p className="text-xs text-slate-500">مراجعة كامل العمليات التاريخية وطباعة كشف حساب معتمد رسمي.</p>
              </div>

              <div 
                onClick={() => handleTabChange('performance')}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-[#008060] hover:shadow-sm transition-all cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <TrendingUp size={20} />
                </div>
                <h4 className="font-black text-sm text-slate-900 mb-1">مؤشرات أداء المتجر والمخزون</h4>
                <p className="text-xs text-slate-500">تحليل مبيعات المتجر ونسبة الشراكة وقيمة البضاعة المخزنة بالمستودع.</p>
              </div>
            </div>

          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 2: طلبات السحب والمصروفات (WITHDRAWALS & REQUESTS)*/}
        {/* ---------------------------------------------------- */}
        {currentTab === 'withdrawals' && portalPerms.canViewWithdrawalsTab && (
          <div className="space-y-6">
            
            {/* Quick Request Creator Card */}
            {(portalPerms.canRequestWithdrawal || portalPerms.canRequestExpense) && (
              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#008060]/10 text-[#008060] flex items-center justify-center font-black">
                      <Coins size={22} />
                    </div>
                    <div>
                      <h3 className="font-black text-base text-slate-900">
                        تقديم طلب سحب أرباح أو تسجيل مصروف
                      </h3>
                      <p className="text-xs text-slate-500">
                        يصل طلبك مباشرة لإدارة {storeName} ويتم تسجيله سحابياً للمراجعة والاعتماد
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200 text-right">
                    <span className="text-[10px] text-slate-500 block font-bold">الرصيد المتاح للسحب الآن:</span>
                    <span className="text-base font-black font-mono text-[#008060]">
                      {(partnerData?.availableToWithdraw || 0).toLocaleString()} ج.م
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSubmitRequest} className="space-y-4">
                  {/* Request Type Selector */}
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-2">نوع الطلب:</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {portalPerms.canRequestWithdrawal && (
                        <button
                          type="button"
                          onClick={() => setRequestType('withdrawal')}
                          className={`p-3 rounded-2xl text-xs font-black border transition-all text-center cursor-pointer ${
                            requestType === 'withdrawal'
                              ? 'bg-[#008060] text-white border-[#008060] shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          💸 طلب سحب أرباح
                        </button>
                      )}
                      {portalPerms.canRequestExpense && (
                        <button
                          type="button"
                          onClick={() => setRequestType('expense')}
                          className={`p-3 rounded-2xl text-xs font-black border transition-all text-center cursor-pointer ${
                            requestType === 'expense'
                              ? 'bg-[#008060] text-white border-[#008060] shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          🧾 تسجيل مصروف دفعه الشريك
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setRequestType('inquiry')}
                        className={`p-3 rounded-2xl text-xs font-black border transition-all text-center cursor-pointer ${
                          requestType === 'inquiry'
                            ? 'bg-[#008060] text-white border-[#008060] shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        💬 استفسار أو ملاحظة محاسبية
                      </button>
                    </div>
                  </div>

                {requestType !== 'inquiry' && (
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-2">المبلغ المطلوب (ج.م):</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="any"
                        value={requestAmount}
                        onChange={(e) => setRequestAmount(e.target.value)}
                        placeholder="أدخل المبلغ المطلوب..."
                        className="flex-1 bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#008060] focus:ring-1 focus:ring-[#008060]"
                        required
                      />
                    </div>

                    {/* Quick Amount Preset Chips */}
                    {requestType === 'withdrawal' && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap text-xs">
                        <span className="text-[11px] text-slate-500 font-bold">مبالغ سريعة:</span>
                        {[100, 200, 500, 1000].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setRequestAmount(String(val))}
                            className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer border border-slate-200"
                          >
                            {val} ج.م
                          </button>
                        ))}
                        {(partnerData?.availableToWithdraw || 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => setRequestAmount(String(Math.floor(partnerData?.availableToWithdraw || 0)))}
                            className="px-2.5 py-1 rounded-xl bg-emerald-100 text-[#008060] font-black text-xs cursor-pointer border border-emerald-300"
                          >
                            كامل الرصيد المتاح ({(partnerData?.availableToWithdraw || 0).toLocaleString()} ج.م)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Payout Channels for Withdrawal */}
                {requestType === 'withdrawal' && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <label className="block text-xs font-black text-slate-700">طريقة استلام المبلغ:</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'wallet', label: '📱 محفظة كاش', desc: 'فودافون/أورنج/اتصالات/وي' },
                        { id: 'instapay', label: '⚡ إنستاباي', desc: 'InstaPay IPN' },
                        { id: 'bank', label: '🏦 حساب بنكي', desc: 'تحويل بنكي رسمي' },
                        { id: 'cash', label: '💵 كاش نقدي', desc: 'استلام من الخزينة' },
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPayoutMethod(m.id as any)}
                          className={`p-2.5 rounded-xl text-right text-xs font-black border transition-all cursor-pointer ${
                            payoutMethod === m.id
                              ? 'bg-[#008060] text-white border-[#008060]'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div>{m.label}</div>
                          <div className={`text-[9px] mt-0.5 ${payoutMethod === m.id ? 'text-emerald-100' : 'text-slate-400'}`}>{m.desc}</div>
                        </button>
                      ))}
                    </div>

                    {payoutMethod !== 'cash' && (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          {payoutMethod === 'wallet' ? 'رقم المحفظة الإلكترونية:' : payoutMethod === 'instapay' ? 'عنوان الدفع اللحظي (IPN) أو رقم الموبايل:' : 'اسم البنك ورقم الآيبان (IBAN) أو الحساب:'}
                        </label>
                        <input
                          type="text"
                          value={payoutAccount}
                          onChange={(e) => setPayoutAccount(e.target.value)}
                          placeholder={payoutMethod === 'wallet' ? 'مثال: 01012345678' : payoutMethod === 'instapay' ? 'name@instapay' : 'البنك الأهلي - رقم الحساب...'}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#008060]"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Notes Input */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">ملاحظات أو تفاصيل إضافية للإدارة:</label>
                  <textarea
                    rows={2}
                    value={requestNotes}
                    onChange={(e) => setRequestNotes(e.target.value)}
                    placeholder="أي ملاحظات إضافية ترغب في إبلاغ الإدارة بها بخصوص هذا الطلب..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#008060]"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSubmittingRequest}
                    className="flex items-center gap-2 bg-[#008060] hover:bg-[#0a664e] text-white px-6 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {isSubmittingRequest ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    <span>إرسال الطلب للإدارة للمراجعة والاعتماد</span>
                  </button>
                </div>
              </form>
            </div>
            )}

            {/* List of Submitted Requests with Live Tracker */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    سجل طلباتي واستفساراتي ({myPartnerRequests.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    متابعة حالة الطلبات المقدمة للإدارة لحظياً وملاحظات الاعتماد والصرف
                  </p>
                </div>
              </div>

              {myPartnerRequests.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  لم تقدم أي طلبات بعد. يمكنك استخدام النموذج بالأعلى لطلب سحب أرباح أو تسجيل مصروفك.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {myPartnerRequests.map(req => {
                    const isPending = req.status === 'pending';
                    const isApproved = req.status === 'approved';
                    const badgeClass = isPending 
                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                      : isApproved
                      ? 'bg-emerald-50 text-[#008060] border-emerald-300'
                      : 'bg-rose-50 text-rose-700 border-rose-300';

                    const statusTitle = isPending ? '⏳ قيد المراجعة والاعتماد' : isApproved ? '✅ تم الاعتماد والصرف' : '❌ تم الرفض';

                    return (
                      <div key={req.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2.5 shadow-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-xs text-slate-900">{req.typeArabic || req.type}</span>
                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${badgeClass}`}>
                            {statusTitle}
                          </span>
                        </div>

                        {req.amount > 0 && (
                          <div className="text-xl font-black font-mono text-[#008060]">
                            {Number(req.amount).toLocaleString()} ج.م
                          </div>
                        )}

                        {req.notes && (
                          <div className="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 block mb-0.5">تفاصيل الطلب:</span>
                            {req.notes}
                          </div>
                        )}

                        <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-200 flex justify-between items-center">
                          <span>رقم الطلب: {req.id.slice(-6)}</span>
                          <span>{new Date(req.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 3: كشف الحساب والعمليات (STATEMENT & LEDGER)    */}
        {/* ---------------------------------------------------- */}
        {currentTab === 'statement' && portalPerms.canViewStatementTab && (
          <div className="space-y-6">
            
            {/* Header & Controls */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                    <FileText size={20} className="text-[#008060]" />
                    <span>كشف الحساب المالي المعتمد</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    سجل المعاملات المالية المعتمدة للشريك {livePartner.name}
                  </p>
                </div>

                {portalPerms.canPrintStatement && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setSelectedStatementPartner(livePartner)}
                      className="flex items-center gap-1.5 bg-[#008060] hover:bg-[#0a664e] text-white px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                      <Printer size={15} />
                      <span>طباعة كشف حساب رسمي</span>
                    </button>
                    <button
                      onClick={() => {
                        const html = generateAbdoMediaPolicyHTML(storeName);
                        printHTMLDirectly(html);
                      }}
                      className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200"
                    >
                      <Printer size={14} />
                      <span>وثيقة الشراكة</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Filters and Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                    placeholder="ابحث برقم المعاملة، البيان، أو المبلغ..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-2xl pl-4 pr-10 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#008060]"
                  />
                  <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {[
                    { id: 'all', label: 'الكل' },
                    { id: 'withdrawals', label: 'سلف ومسحوبات' },
                    { id: 'capital', label: 'رأس مال وتمويل' },
                    { id: 'dividends', label: 'أرباح' },
                    { id: 'custody', label: 'عهدة' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setTxCategoryFilter(tab.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        txCategoryFilter === tab.id
                          ? 'bg-[#008060] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ledger Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">التاريخ</th>
                      <th className="py-3 px-4">نوع الحركة</th>
                      <th className="py-3 px-4">المبلغ</th>
                      <th className="py-3 px-4">البيان والملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredStatementTxs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-slate-400 font-bold">
                          لا توجد حركات مالية مطابقة للفلاتر المحددة.
                        </td>
                      </tr>
                    ) : (
                      filteredStatementTxs.map(t => {
                        const badge = getTxTypeBadge(t.type);
                        const isCredit = ['capital_addition', 'supply_funding', 'shipping_funding', 'profit_distribution', 'repayment', 'expense_coverage'].includes(t.type);

                        return (
                          <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                              {new Date(t.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${badge.bg}`}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono font-black whitespace-nowrap">
                              <span className={isCredit ? 'text-[#008060]' : 'text-rose-600'}>
                                {isCredit ? '+' : '-'}{Number(t.amount || 0).toLocaleString()} ج.م
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-800 font-medium">
                              {t.note || 'معاملة مالية مقيدة بحساب الشريك'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 4: أداء المتجر والشراكة (STORE PERFORMANCE)     */}
        {/* ---------------------------------------------------- */}
        {currentTab === 'performance' && portalPerms.canViewPerformanceTab && (
          <div className="space-y-6">
            
            {/* Banner with Clean Light Executive Palette */}
            <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50/50 text-slate-900 p-6 sm:p-8 rounded-3xl border border-emerald-200 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#008060] text-white rounded-2xl flex items-center justify-center shadow-xs">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">{storeName} • مؤشرات الشراكة العامة</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      إحصائيات المبيعات، الطلبات المسلمة، وحصتك المقدرة من أرباح المتجر والمخزون
                    </p>
                  </div>
                </div>

                <div className="bg-[#008060] px-4 py-2 rounded-2xl text-xs font-black text-white shadow-xs">
                  نسبتك المعتمدة: {partnerData?.partnerRatio || 0}%
                </div>
              </div>

              {/* Performance Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {portalPerms.canViewStoreSales && (
                  <div className="p-5 rounded-2xl bg-white border border-emerald-200/80 shadow-xs space-y-1">
                    <span className="text-[11px] text-slate-500 font-bold block">إجمالي مبيعات المتجر المحصلة</span>
                    <div className="text-2xl font-black font-mono text-slate-900">
                      {(partnerData?.totalStoreSales || 0).toLocaleString()} <span className="text-xs font-normal opacity-70">ج.م</span>
                    </div>
                    <span className="text-[10px] text-emerald-600 block">الطلبات المسلمة والمدفوعة بالكامل</span>
                  </div>
                )}

                {portalPerms.canViewStoreSales && (
                  <div className="p-5 rounded-2xl bg-white border border-emerald-200/80 shadow-xs space-y-1">
                    <span className="text-[11px] text-slate-500 font-bold block">عدد الطلبات الناجحة</span>
                    <div className="text-2xl font-black font-mono text-slate-900">
                      {(partnerData?.totalDeliveredOrders || 0).toLocaleString()} <span className="text-xs font-normal opacity-70">طلب</span>
                    </div>
                    <span className="text-[10px] text-emerald-600 block">أوردرات مكتملة التحصيل والتسليم</span>
                  </div>
                )}

                {portalPerms.canViewStoreProfits && (
                  <div className="p-5 rounded-2xl bg-white border border-emerald-200/80 shadow-xs space-y-1">
                    <span className="text-[11px] text-amber-700 font-bold block">حصتك التقديرية من أرباح المتجر</span>
                    <div className="text-2xl font-black font-mono text-amber-600">
                      {(partnerData?.partnerEstimatedProfit || 0).toLocaleString()} <span className="text-xs font-normal opacity-70">ج.م</span>
                    </div>
                    <span className="text-[10px] text-amber-700/80 block">بناءً على نسبة {partnerData?.partnerRatio}% من الصافي</span>
                  </div>
                )}

                <div className="p-5 rounded-2xl bg-white border border-emerald-200/80 shadow-xs space-y-1">
                  <span className="text-[11px] text-slate-500 font-bold block">حصتك في قيمة مخزون البضائع</span>
                  <div className="text-2xl font-black font-mono text-slate-900">
                    {(partnerData?.partnerInventoryShare || 0).toLocaleString()} <span className="text-xs font-normal opacity-70">ج.م</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">إجمالي المخزون: {(partnerData?.totalInventoryValue || 0).toLocaleString()} ج.م</span>
                </div>

              </div>
            </div>

            {/* Partnership Charter */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-3">
              <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#008060]" />
                <span>ميثاق وقواعد الشراكة المالية المعتمدة</span>
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                تخضع كافة الحسابات والمسحوبات ونسب الأرباح للسياسة المحاسبية الرسمية لـ {storeName}. يتم تجميد رأس مال البضاعة لحساب التجديد وإعادة الشراء، وتوزيع الأرباح الصافية بعد خصم مصاريف الشحن والتسويق والتشغيل.
              </p>
            </div>

          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB: تقارير المتجر المخصصة (CUSTOM STORE REPORTS)   */}
        {/* ---------------------------------------------------- */}
        {currentTab === 'reports' && portalPerms.canViewReportsTab && livePartner && (
          <PartnerReportsView
            partner={livePartner}
            orders={rawOrders}
            products={settings.products || []}
            settings={settings}
            allowedReports={portalPerms.allowedReports}
            storeName={storeName}
          />
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 5: الملف الشخصي والصلاحيات (PROFILE & PERMISSIONS) */}
        {/* ---------------------------------------------------- */}
        {currentTab === 'profile' && portalPerms.canViewProfileTab && livePartner && (
          <PartnerProfileTab
            partner={livePartner}
            storeId={effectiveStoreId}
            storeName={storeName}
            settings={settings}
            portalPerms={portalPerms}
            updateSettings={updateSettings}
            showToast={showToast}
          />
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 6: بيانات الشراكة والأمان (ACCOUNT & SECURITY)  */}
        {/* ---------------------------------------------------- */}
        {currentTab === 'account' && portalPerms.canChangeSecurity && (
          <div className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Partner Profile Card */}
              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#008060] text-white flex items-center justify-center font-black text-xl">
                    {livePartner.name.slice(0, 1)}
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-900">{livePartner.name}</h3>
                    <p className="text-xs text-slate-500">كود الشريك: {livePartner.id}</p>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-bold">المتجر التابع له:</span>
                    <span className="font-black text-slate-900">{storeName}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-bold">نسبة الأرباح المعتمدة:</span>
                    <span className="font-black text-[#008060]">{livePartner.profitRatio || 0}%</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500 font-bold">حالة الحساب:</span>
                    <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      نشط ومفعل بالبوابة
                    </span>
                  </div>
                </div>
              </div>

              {/* PIN Code & Security Settings */}
              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <Key size={22} className="text-[#008060]" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-900">أمان الحساب ورمز PIN</h3>
                    <p className="text-xs text-slate-500">تغيير رمز المرور الخاص بتسجيل دخولك للبوابة</p>
                  </div>
                </div>

                {!isChangingPin ? (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      رمز PIN الحالي الخاص بك مؤمن. يمكنك تغييره في أي وقت لضمان خصوصية بياناتك المالية.
                    </p>
                    <button
                      onClick={() => setIsChangingPin(true)}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black transition-all cursor-pointer border border-slate-200"
                    >
                      تغيير رمز PIN السري
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        أدخل رمز PIN الجديد (4 أرقام):
                      </label>
                      <input
                        type="password"
                        maxLength={6}
                        value={newPinInput}
                        onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="مثال: 1234"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-center text-lg font-mono tracking-widest text-slate-900 focus:outline-none focus:border-[#008060]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdatePin}
                        className="flex-1 py-2 bg-[#008060] hover:bg-[#0a664e] text-white rounded-xl text-xs font-black cursor-pointer shadow-xs"
                      >
                        حفظ الرمز الجديد
                      </button>
                      <button
                        onClick={() => { setIsChangingPin(false); setNewPinInput(''); }}
                        className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Direct Portal Share Link Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#008060] flex items-center justify-center">
                  <Share2 size={18} />
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-900">رابط البوابة السري المباشر</h4>
                  <p className="text-xs text-slate-500">يمكنك حفظ هذا الرابط في المفضلة للوصول السريع لحسابك من أي هاتف</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/store/${effectiveStoreId}/partner-portal?p=${livePartner.id}`}
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-700"
                />
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/store/${effectiveStoreId}/partner-portal?p=${livePartner.id}`;
                    navigator.clipboard.writeText(link);
                    showToast('تم نسخ رابط البوابة بنجاح', 'success');
                  }}
                  className="flex items-center gap-1 bg-[#008060] hover:bg-[#0a664e] text-white px-4 py-2.5 rounded-xl text-xs font-black cursor-pointer shadow-xs whitespace-nowrap"
                >
                  <Copy size={14} />
                  <span>نسخ الرابط</span>
                </button>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Floating Statement Modal (Official Printable Statement) */}
      {selectedStatementPartner && (
        <PartnerStatementModal
          partner={selectedStatementPartner}
          settings={settings}
          wallet={activeStoreData?.wallet || { balance: 0, transactions: [] }}
          orders={rawOrders}
          treasury={rawTreasury}
          onClose={() => setSelectedStatementPartner(null)}
        />
      )}

      {/* Floating Request Modal */}
      <AnimatePresence>
        {showRequestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" dir="rtl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-[#008060]/10 text-[#008060] flex items-center justify-center font-black">
                    <Coins size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900">تقديم طلب مالي جديد</h3>
                    <p className="text-[11px] text-slate-500">إلى إدارة {storeName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">نوع الطلب:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'withdrawal', label: 'طلب سحب أرباح' },
                      { id: 'expense', label: 'تسجيل مصروف' },
                      { id: 'inquiry', label: 'استفسار مالي' },
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setRequestType(t.id as any)}
                        className={`py-2 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                          requestType === t.id
                            ? 'bg-[#008060] text-white border-[#008060]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {requestType !== 'inquiry' && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-black text-slate-700">المبلغ المطلوب (ج.م):</label>
                      <span className="text-[10px] text-slate-500 font-bold">
                        المتاح: {(partnerData?.availableToWithdraw || 0).toLocaleString()} ج.م
                      </span>
                    </div>
                    <input
                      type="number"
                      step="any"
                      value={requestAmount}
                      onChange={(e) => setRequestAmount(e.target.value)}
                      placeholder="أدخل المبلغ..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#008060]"
                      required
                    />
                  </div>
                )}

                {requestType === 'withdrawal' && (
                  <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <label className="block text-[11px] font-black text-slate-700">طريقة التحويل:</label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { id: 'wallet', label: '📱 محفظة كاش' },
                        { id: 'instapay', label: '⚡ إنستاباي' },
                        { id: 'bank', label: '🏦 حساب بنكي' },
                        { id: 'cash', label: '💵 نقداً خزينة' },
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPayoutMethod(m.id as any)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                            payoutMethod === m.id
                              ? 'bg-[#008060] text-white border-[#008060]'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {payoutMethod !== 'cash' && (
                      <input
                        type="text"
                        value={payoutAccount}
                        onChange={(e) => setPayoutAccount(e.target.value)}
                        placeholder={payoutMethod === 'wallet' ? 'رقم المحفظة (مثال: 01012345678)' : payoutMethod === 'instapay' ? 'عنوان IPN أو الموبايل' : 'اسم البنك ورقم الحساب / IBAN'}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-900 mt-1"
                      />
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">ملاحظات إضافية:</label>
                  <textarea
                    rows={2}
                    value={requestNotes}
                    onChange={(e) => setRequestNotes(e.target.value)}
                    placeholder="أي ملاحظات للإدارة..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRequest}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#008060] hover:bg-[#0a664e] text-white text-xs font-black cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isSubmittingRequest ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    <span>إرسال الطلب</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
