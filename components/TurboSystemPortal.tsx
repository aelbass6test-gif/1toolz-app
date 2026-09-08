import React, { useState, useEffect } from 'react';
import { Settings, Order, TurboConfig, ShippingOption, CompanyFees } from '../types';
import { turboService } from '../utils/turboService';
import { inAppToast, inAppAlert } from '../utils/inAppAlert';
import { generateTurboShippingOptions } from '../constants';
import {
  Truck, Key, CheckCircle2, AlertCircle, RefreshCw,
  Search, ShieldCheck, Zap, Globe, Package, Calculator,
  ArrowRight, FileText, Send, MapPin, ExternalLink, Mail, Lock, Copy,
  X, Plus, Save, RotateCcw, Filter, DollarSign, Info, Check, Sliders,
  ChevronDown, ChevronUp, Clock
} from 'lucide-react';

const TURBO_GOV_CODES: Record<string, number> = {
  "القاهرة": 1,
  "الجيزة": 2,
  "الشرقية": 3,
  "الدقهلية": 4,
  "البحيرة": 5,
  "المنيا": 6,
  "القليوبية": 7,
  "الإسكندرية": 8,
  "الغربية": 9,
  "سوهاج": 10,
  "أسيوط": 11,
  "المنوفية": 12,
  "كفر الشيخ": 13,
  "الفيوم": 14,
  "قنا": 15,
  "بني سويف": 16,
  "أسوان": 17,
  "دمياط": 18,
  "الإسماعيلية": 19,
  "الأقصر": 20,
  "بورسعيد": 21,
  "السويس": 22,
  "مطروح": 23,
  "شمال سيناء": 24,
  "البحر الأحمر": 25,
  "الوادي الجديد": 26,
  "جنوب سيناء": 27,
  "أطراف القاهرة والجيزة": 28,
  "شحن دولي": 29
};

const getGovernorateRegion = (name: string): { label: string; key: 'cairo' | 'delta' | 'canal' | 'upper' | 'frontier'; deliveryDays: string } => {
  if (["القاهرة", "الجيزة", "أطراف القاهرة والجيزة"].includes(name)) {
    return { label: "القاهرة الكبرى", key: "cairo", deliveryDays: "2 يوم" };
  }
  if (["الإسكندرية", "البحيرة", "الغربية", "الشرقية", "الدقهلية", "المنوفية", "دمياط", "كفر الشيخ", "القليوبية"].includes(name)) {
    return { label: "الدلتا والوجه البحري", key: "delta", deliveryDays: "3 يوم" };
  }
  if (["الإسماعيلية", "السويس", "بورسعيد", "الفيوم", "بني سويف", "المنيا"].includes(name)) {
    return { label: "مدن القناة وشمال الصعيد", key: "canal", deliveryDays: "3 يوم" };
  }
  if (["أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان"].includes(name)) {
    return { label: "وسط وجنوب الصعيد", key: "upper", deliveryDays: "3 يوم" };
  }
  return { label: "المحافظات الحدودية", key: "frontier", deliveryDays: "7 يوم" };
};

interface TurboSystemPortalProps {
  onBack: () => void;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  orders?: Order[];
  setOrders?: React.Dispatch<React.SetStateAction<Order[]>>;
}

export default function TurboSystemPortal({
  onBack,
  settings,
  setSettings,
  orders = [],
  setOrders
}: TurboSystemPortalProps) {
  const [activeTab, setActiveTab] = useState<'api-integration' | 'tracking' | 'dispatch' | 'governorates' | 'calculator' | 'tickets'>('api-integration');

  // Config states
  const [apiKey, setApiKey] = useState<string>(settings?.turboConfig?.apiKey || 'TnyyEjN91eG0ED6ZMX6ONbnVtAxSvsuUWuZClNslNsffFcOe0iZrkdDYNoX2vSAHxkLGGunzo3WbMjXC');
  const [authenticationKey, setAuthenticationKey] = useState<string>(settings?.turboConfig?.authenticationKey || 'TnyyEjN91eG0ED6ZMX6ONbnVtAxSvsuUWuZClNslNsffFcOe0iZrkdDYNoX2vSAHxkLGGunzo3WbMjXC');
  const [mainClientCode, setMainClientCode] = useState<number>(settings?.turboConfig?.mainClientCode || 74068);
  const [secondClient, setSecondClient] = useState<string>(settings?.turboConfig?.secondClient || '');
  const [apiFollowupPhone, setApiFollowupPhone] = useState<string>(settings?.turboConfig?.apiFollowupPhone || '');
  const [environment, setEnvironment] = useState<'production' | 'staging'>(settings?.turboConfig?.environment || 'production');
  const [allowOpenPackage, setAllowOpenPackage] = useState<boolean>(settings?.turboConfig?.allowOpenPackage ?? true);
  const [autoSendOnConfirm, setAutoSendOnConfirm] = useState<boolean>(settings?.turboConfig?.autoSendOnConfirm ?? false);
  const [webhookToken, setWebhookToken] = useState<string>(settings?.turboConfig?.webhookToken || '');
  const [defaultReturnAmount, setDefaultReturnAmount] = useState<number>(settings?.turboConfig?.defaultReturnAmount || 0);
  const [isVerifyingKey, setIsVerifyingKey] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Login Form states
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Tracking states
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [trackingInfo, setTrackingInfo] = useState<any>(null);
  const [isTracking, setIsTracking] = useState<boolean>(false);

  // Dispatch states
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [isSendingOrder, setIsSendingOrder] = useState<boolean>(false);
  const [customInvoiceNumber, setCustomInvoiceNumber] = useState<string>('');
  const [customBuildingNumber, setCustomBuildingNumber] = useState<string>('');

  useEffect(() => {
    if (selectedOrderId) {
      const target = orders.find(o => o.id === selectedOrderId || o.orderNumber === selectedOrderId) as any;
      if (target) {
        setCustomInvoiceNumber(target.invoiceNumber || target.invoice_number || target.orderNumber || '');
        setCustomBuildingNumber(target.buildingNumber || target.building || target.buildingDetails || '');
      }
    } else {
      setCustomInvoiceNumber('');
      setCustomBuildingNumber('');
    }
  }, [selectedOrderId, orders]);

  // Governorates state
  const [governoratesList, setGovernoratesList] = useState<any[]>([]);
  const [isLoadingGovs, setIsLoadingGovs] = useState<boolean>(false);

  // Turbo Rates & Governorates pricing state
  const [turboRates, setTurboRates] = useState<ShippingOption[]>(() => {
    const existing = settings?.shippingOptions?.['تربو'];
    if (existing && existing.length > 0) {
      const cairo = existing.find(e => e.label === 'القاهرة');
      if (cairo && (cairo.deliveryPrice === 45 || cairo.deliveryPrice === 55)) {
        return generateTurboShippingOptions();
      }
      return existing;
    }
    return generateTurboShippingOptions();
  });

  const [turboFees, setTurboFees] = useState<CompanyFees>(() => {
    return settings?.companySpecificFees?.['تربو'] || {
      insuranceFeePercent: 0,
      inspectionFee: 0,
      returnShippingFee: 30,
      useCustomFees: true,
      defaultInspectionActive: true,
      enableCodFees: true,
      codThreshold: 3000,
      codFeeRate: 0.01,
      codTaxRate: 0.14,
      enableReturnAfter: true,
      enableReturnWithout: true,
      enableExchange: true,
      enableFixedReturn: true,
      postCollectionReturnRefundsProductPrice: true,
      baseWeight: 1
    };
  });

  const [govSearchQuery, setGovSearchQuery] = useState('');
  const [govRegionFilter, setGovRegionFilter] = useState<'all' | 'cairo' | 'delta' | 'canal' | 'upper' | 'frontier'>('all');
  const [showTurboApiCodes, setShowTurboApiCodes] = useState(false);
  const [showTurboFinancials, setShowTurboFinancials] = useState(false);
  const [isSavingRates, setIsSavingRates] = useState(false);

  // Sync state if settings update
  useEffect(() => {
    if (settings?.shippingOptions?.['تربو'] && settings.shippingOptions['تربو'].length > 0) {
      const cairo = settings.shippingOptions['تربو'].find(e => e.label === 'القاهرة');
      if (cairo && (cairo.deliveryPrice === 45 || cairo.deliveryPrice === 55)) {
        setTurboRates(generateTurboShippingOptions());
      } else {
        setTurboRates(settings.shippingOptions['تربو']);
      }
    }
    if (settings?.companySpecificFees?.['تربو']) {
      setTurboFees(settings.companySpecificFees['تربو']);
    }
  }, [settings?.shippingOptions, settings?.companySpecificFees]);

  const handleRateChange = (govLabel: string, field: keyof ShippingOption, value: any) => {
    setTurboRates(prev => prev.map(opt => {
      if (opt.label === govLabel) {
        const updated = {
          ...opt,
          [field]: value
        };
        if (updated.cities) {
          updated.cities = updated.cities.map(c => ({
            ...c,
            [field]: c.useParentFees ? value : (c as any)[field]
          }));
        }
        return updated;
      }
      return opt;
    }));
  };

  const handleSaveRatesToSystem = () => {
    setIsSavingRates(true);
    setSettings(prev => ({
      ...prev,
      shippingOptions: {
        ...(prev.shippingOptions || {}),
        'تربو': turboRates
      },
      activeCompanies: {
        ...prev.activeCompanies,
        'تربو': true
      },
      companySpecificFees: {
        ...(prev.companySpecificFees || {}),
        'تربو': turboFees
      }
    }));
    inAppToast('تم حفظ ومزامنة أسعار محافظات تربو بنجاح مع النظام المالي وتقارير الأرباح!', 'success');
    setTimeout(() => setIsSavingRates(false), 500);
  };

  const handleResetToStandardRates = () => {
    const standard = generateTurboShippingOptions();
    setTurboRates(standard);
    setSettings(prev => ({
      ...prev,
      shippingOptions: {
        ...(prev.shippingOptions || {}),
        'تربو': standard
      }
    }));
    inAppToast('تمت استعادة الأسعار الافتراضية المعتمدة لشركة تربو بنجاح', 'info');
  };

  // Calculator states
  const [calcGov, setCalcGov] = useState<string>('القاهرة');
  const [calcCod, setCalcCod] = useState<number>(500);
  const [calcResult, setCalcResult] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  // Ticket System states
  const [ticketsList, setTicketsList] = useState<any[]>([]);
  const [ticketCategories, setTicketCategories] = useState<any[]>([]);
  const [ticketStatuses, setTicketStatuses] = useState<any[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [showCreateTicketModal, setShowCreateTicketModal] = useState(false);
  const [totalOpenTickets, setTotalOpenTickets] = useState(0);

  // Create Ticket Form
  const [ticketForm, setTicketForm] = useState({
    category_id: '',
    content: '',
    code: '',
    priority: 'low',
    related_to: 'others'
  });

  useEffect(() => {
    if (settings?.turboConfig) {
      setApiKey(settings.turboConfig.apiKey || 'TnyyEjN91eG0ED6ZMX6ONbnVtAxSvsuUWuZClNslNsffFcOe0iZrkdDYNoX2vSAHxkLGGunzo3WbMjXC');
      setAuthenticationKey(settings.turboConfig.authenticationKey || 'TnyyEjN91eG0ED6ZMX6ONbnVtAxSvsuUWuZClNslNsffFcOe0iZrkdDYNoX2vSAHxkLGGunzo3WbMjXC');
      setMainClientCode(settings.turboConfig.mainClientCode || 74068);
      setSecondClient(settings.turboConfig.secondClient || '');
      setApiFollowupPhone(settings.turboConfig.apiFollowupPhone || '');
      setEnvironment(settings.turboConfig.environment || 'production');
      setAllowOpenPackage(settings.turboConfig.allowOpenPackage ?? true);
      setAutoSendOnConfirm(settings.turboConfig.autoSendOnConfirm ?? false);
      setWebhookToken(settings.turboConfig.webhookToken || '');
      setDefaultReturnAmount(settings.turboConfig.defaultReturnAmount || 0);
    }
  }, [settings]);

  const handleSaveConfig = () => {
    const updatedTurboConfig: TurboConfig = {
      apiKey: apiKey || authenticationKey,
      authenticationKey: authenticationKey || apiKey,
      mainClientCode,
      secondClient,
      apiFollowupPhone,
      environment,
      isActive: !!(apiKey || authenticationKey),
      allowOpenPackage,
      autoSendOnConfirm,
      webhookToken,
      defaultReturnAmount,
      lastSync: new Date().toISOString()
    };

    setSettings((prev) => {
      const currentOpts = prev.shippingOptions?.['تربو'];
      const hasOpts = Array.isArray(currentOpts) && currentOpts.length > 0;
      return {
        ...prev,
        turboConfig: updatedTurboConfig,
        shippingOptions: {
          ...(prev.shippingOptions || {}),
          'تربو': hasOpts ? currentOpts : turboRates
        },
        activeCompanies: {
          ...prev.activeCompanies,
          'تربو': !!(apiKey || authenticationKey)
        },
        companySpecificFees: {
          ...(prev.companySpecificFees || {}),
          'تربو': prev.companySpecificFees?.['تربو'] || turboFees
        }
      };
    });

    setIsSaved(true);
    inAppToast('تم حفظ إعدادات ربط شركة تربو بنجاح', 'success');
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleVerifyApi = async () => {
    if (!apiKey) {
      inAppAlert('يرجى إدخال مفتاح API لشركة تربو أولاً', { title: 'تنبيه' });
      return;
    }
    setIsVerifyingKey(true);
    try {
      const res = await turboService.verifyApiKey(apiKey, environment);
      if (res.success) {
        inAppAlert('تم التحقق من ربط شركة تربو بنجاح وربط الحساب مفعل!', { title: 'تم الربط بنجاح' });
      } else {
        inAppAlert(res.error || 'فشل التحقق من مفتاح API. يرجى التأكد من المفتاح.', { title: 'فشل الربط' });
      }
    } catch (err: any) {
      inAppAlert('تعذر الاتصال بخوادم شركة تربو', { title: 'خطأ بالاتصال' });
    } finally {
      setIsVerifyingKey(false);
    }
  };

  const handleAccountLogin = async () => {
    if (!loginEmail || !loginPassword) {
      inAppAlert('يرجى إدخال البريد الإلكتروني وكلمة المرور لحساب تربو', { title: 'بيانات ناقصة' });
      return;
    }
    setIsLoggingIn(true);
    try {
      const res = await turboService.login(loginEmail, loginPassword, environment);
      if (res.success && res.apiKey) {
        setApiKey(res.apiKey);
        inAppToast('تم جلب مفتاح API وتسجيل الدخول لحساب تربو بنجاح!', 'success');
      } else {
        inAppAlert(res.error || 'فشل تسجيل الدخول لحساب تربو', { title: 'خطأ' });
      }
    } catch (err: any) {
      inAppAlert('حدث خطأ أثناء الاتصال', { title: 'خطأ' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleTrackShipment = async () => {
    if (!trackingNumber) {
      inAppToast('يرجى إدخال رقم بوليصة تربو للتتبع', 'warning');
      return;
    }
    setIsTracking(true);
    setTrackingInfo(null);
    try {
      const res = await turboService.trackShipment(trackingNumber, apiKey, environment === 'staging');
      if (res.success) {
        setTrackingInfo(res.trackingInfo);
        inAppToast('تم جلب بيانات تتبع الشحنة بنجاح من تربو', 'success');
      } else {
        inAppToast(res.error || 'الشحنة غير موجودة أو لم يتم استلامها بعد', 'error');
      }
    } catch (err) {
      inAppToast('حدث خطأ أثناء التتبع', 'error');
    } finally {
      setIsTracking(false);
    }
  };

  const handleAction = async (action: 'cancel' | 'delete' | 'resend') => {
    if (!trackingNumber) return;
    const config: TurboConfig = { apiKey, authenticationKey, mainClientCode, environment, isActive: true };
    
    let res;
    switch (action) {
      case 'cancel':
        res = await turboService.cancelShipment(trackingNumber, config);
        break;
      case 'delete':
        res = await turboService.deleteShipment(trackingNumber, config);
        break;
      case 'resend':
        res = await turboService.resendRequest(trackingNumber, config);
        break;
    }

    if (res && res.success) {
      inAppToast(res.message || 'تمت العملية بنجاح', 'success');
      handleTrackShipment(); // Refresh tracking info
    } else {
      inAppAlert(res?.error || 'فشل تنفيذ العملية', { title: 'خطأ' });
    }
  };

  const handleDispatchOrder = async () => {
    const targetOrder = orders.find(o => o.id === selectedOrderId || o.orderNumber === selectedOrderId);
    if (!targetOrder) {
      inAppToast('يرجى اختيار الطلب المراد إرساله إلى تربو', 'warning');
      return;
    }

    const orderToDispatch: any = {
      ...targetOrder,
      invoiceNumber: customInvoiceNumber.trim() || (targetOrder as any).invoiceNumber || targetOrder.orderNumber,
      invoice_number: customInvoiceNumber.trim() || (targetOrder as any).invoiceNumber || targetOrder.orderNumber,
      buildingNumber: customBuildingNumber.trim() || (targetOrder as any).buildingNumber || '',
      building: customBuildingNumber.trim() || (targetOrder as any).building || ''
    };

    setIsSendingOrder(true);
    try {
      const res = await turboService.createShipment(orderToDispatch, {
        apiKey,
        authenticationKey,
        mainClientCode,
        secondClient,
        apiFollowupPhone,
        environment,
        isActive: true,
        allowOpenPackage,
        defaultReturnAmount
      });

      if (res.success && res.waybillNumber) {
        inAppAlert(`تم إرسال الطلب #${targetOrder.orderNumber} لشركة تربو بنجاح! رقم البوليصة: ${res.waybillNumber}`, { title: 'نجاح التصدير' });
        if (setOrders) {
          setOrders(prev => prev.map(o => o.id === targetOrder.id ? { ...o, waybillNumber: res.waybillNumber, shippingCompany: 'تربو' } : o));
        }
      } else {
        inAppAlert(res.error || 'فشل إرسال الشحنة إلى تربو', { title: 'خطأ بالتصدير' });
      }
    } catch (err: any) {
      inAppAlert('حدث خطأ أثناء التصدير', { title: 'خطأ' });
    } finally {
      setIsSendingOrder(false);
    }
  };

  const handleFetchGovs = async () => {
    setIsLoadingGovs(true);
    try {
      const res = await turboService.getGovernorates(apiKey, environment === 'staging');
      if (res.success && Array.isArray(res.governorates)) {
        setGovernoratesList(res.governorates);
        inAppToast('تم تحديث قائمة المحافظات المتاحة لدى تربو', 'success');
      } else {
        setGovernoratesList([]);
        inAppToast('لم يتم العثور على بيانات المحافظات', 'info');
      }
    } catch (err) {
      setGovernoratesList([]);
    } finally {
      setIsLoadingGovs(false);
    }
  };

  const handleCalculateRate = async () => {
    setIsCalculating(true);
    try {
      const res = await turboService.calculatePricing({
        governorate: calcGov,
        cod: calcCod,
        apiKey,
        isStaging: environment === 'staging'
      });
      if (res.success && res.pricing) {
        setCalcResult(res.pricing);
        inAppToast('تم حساب تكلفة الشحن المقدرة مع تربو بنجاح', 'success');
      } else {
        setCalcResult(null);
        inAppToast('فشل حساب التسعير', 'error');
      }
    } catch (err) {
      setCalcResult(null);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleFetchTicketsData = async () => {
    if (!apiKey && !authenticationKey) return;
    setIsLoadingTickets(true);
    const config: TurboConfig = { apiKey, authenticationKey, mainClientCode, environment, isActive: true };
    try {
      const [ticketsRes, catsRes, statusesRes, totalRes] = await Promise.all([
        turboService.getTickets(config),
        turboService.getTicketCategories(config),
        turboService.getTicketStatuses(config),
        turboService.getTotalOpenTickets(config)
      ]);

      if (ticketsRes.success) setTicketsList(ticketsRes.data || []);
      if (catsRes.success) setTicketCategories(catsRes.data || []);
      if (statusesRes.success) setTicketStatuses(statusesRes.data || []);
      if (totalRes.success) setTotalOpenTickets(totalRes.data?.total || 0);

    } catch (err) {
      inAppToast('حدث خطأ أثناء جلب بيانات التذاكر', 'error');
    } finally {
      setIsLoadingTickets(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!ticketForm.category_id || !ticketForm.content) {
      inAppToast('يرجى ملء جميع الحقول المطلوبة', 'warning');
      return;
    }
    setIsCreatingTicket(true);
    const config: TurboConfig = { apiKey, authenticationKey, mainClientCode, environment, isActive: true };
    try {
      const res = await turboService.createTicket({
        category_id: Number(ticketForm.category_id),
        content: ticketForm.content,
        code: ticketForm.code,
        priority: ticketForm.priority,
        related_to: ticketForm.related_to
      }, config);

      if (res.success) {
        inAppAlert('تم إنشاء التذكرة بنجاح!', { title: 'نجاح' });
        setShowCreateTicketModal(false);
        setTicketForm({ category_id: '', content: '', code: '', priority: 'low', related_to: 'others' });
        handleFetchTicketsData();
      } else {
        inAppAlert(res.error || 'فشل إنشاء التذكرة', { title: 'خطأ' });
      }
    } catch (err) {
      inAppAlert('حدث خطأ أثناء الاتصال', { title: 'خطأ' });
    } finally {
      setIsCreatingTicket(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'tickets') {
      handleFetchTicketsData();
    }
  }, [activeTab]);

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-purple-800/40 relative overflow-hidden">
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div className="space-y-2">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition mb-2"
            >
              <ArrowRight size={14} /> العودة لإعدادات الشحن
            </button>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg font-black text-xl tracking-tighter">
                TURBO
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                  بوابة شركة تربو للشحن (Turbo Express Courier Portal)
                </h1>
                <p className="text-xs text-purple-200 mt-1">
                  إدارة الربط البرمجي، تصدير الشحنات بضغطة زر، تتبع البوالص، واستعلام التغطية والتسعير في مصر.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 ${apiKey ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
              <ShieldCheck size={14} /> {apiKey ? 'الربط مفعل' : 'غير مرتبط'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('api-integration')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'api-integration' ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
        >
          <Key size={16} /> إعدادات الربط والـ API
        </button>

        <button
          onClick={() => setActiveTab('tracking')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'tracking' ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
        >
          <Search size={16} /> تتبع الشحنات المباشر
        </button>

        <button
          onClick={() => setActiveTab('dispatch')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'dispatch' ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
        >
          <Send size={16} /> تصدير وأمر شحن جديد
        </button>

        <button
          onClick={() => setActiveTab('governorates')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'governorates' ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
        >
          <MapPin size={16} /> جدول المحافظات والتسعيرات
        </button>

        <button
          onClick={() => setActiveTab('calculator')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'calculator' ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
        >
          <Calculator size={16} /> حاسبة تسعير تربو
        </button>

        <button
          onClick={() => setActiveTab('tickets')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'tickets' ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
        >
          <FileText size={16} /> الدعم والتذاكر
          {totalOpenTickets > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center animate-pulse">
              {totalOpenTickets}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: API Integration */}
      {activeTab === 'api-integration' && (
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          {/* Main API Key Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-sm space-y-8">
            <div className="flex items-center justify-between border-b pb-6 dark:border-slate-800">
              <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Key className="text-purple-600" size={24} /> ربط شحن Turbo
              </h2>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="font-bold text-slate-500 dark:text-slate-400 text-[11px] block text-left">اسم العرض Turbo</label>
                  <input
                    type="text"
                    value={secondClient}
                    onChange={(e) => setSecondClient(e.target.value)}
                    placeholder="مثال: Turbo"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm dark:text-white outline-none focus:ring-2 focus:ring-purple-500 text-left"
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-bold text-slate-500 dark:text-slate-400 text-[11px] block text-left">كود العميل</label>
                  <input
                    type="number"
                    value={mainClientCode}
                    onChange={(e) => setMainClientCode(Number(e.target.value))}
                    placeholder="كود العميل"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-mono text-sm dark:text-white outline-none focus:ring-2 focus:ring-purple-500 text-left"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="font-bold text-slate-500 dark:text-slate-400 text-[11px] block text-left">مفتاح API</label>
                  <input
                    type="text"
                    value={authenticationKey}
                    onChange={(e) => setAuthenticationKey(e.target.value)}
                    placeholder="مفتاح API"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-mono text-sm dark:text-white outline-none focus:ring-2 focus:ring-purple-500 text-left"
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-bold text-slate-500 dark:text-slate-400 text-[11px] block text-left">هاتف المتابعة</label>
                  <input
                    type="text"
                    value={apiFollowupPhone}
                    onChange={(e) => setApiFollowupPhone(e.target.value)}
                    placeholder="هاتف المتابعة"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-mono text-sm dark:text-white outline-none focus:ring-2 focus:ring-purple-500 text-left"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="allowOpen"
                    checked={allowOpenPackage}
                    onChange={(e) => setAllowOpenPackage(e.target.checked)}
                    className="w-5 h-5 text-emerald-500 rounded-lg focus:ring-emerald-500"
                  />
                  <label htmlFor="allowOpen" className="font-bold text-slate-700 dark:text-slate-300 text-sm cursor-pointer">السماح بفتح الطرد</label>
                </div>

                <div className="space-y-2">
                  <label className="font-bold text-slate-500 dark:text-slate-400 text-[11px] block text-left">قيمة المرتجع الافتراضية</label>
                  <input
                    type="number"
                    value={defaultReturnAmount}
                    onChange={(e) => setDefaultReturnAmount(Number(e.target.value))}
                    placeholder="0"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-mono text-sm dark:text-white outline-none focus:ring-2 focus:ring-purple-500 text-left"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 py-2 border-t border-slate-100 dark:border-slate-800 pt-6">
                <input
                  type="checkbox"
                  id="autoSend"
                  checked={autoSendOnConfirm}
                  onChange={(e) => setAutoSendOnConfirm(e.target.checked)}
                  className="w-5 h-5 text-emerald-500 rounded-lg focus:ring-emerald-500"
                />
                <div className="flex flex-col">
                  <label htmlFor="autoSend" className="font-bold text-slate-800 dark:text-slate-200 text-sm cursor-pointer">إرسال الطلبات المؤكدة إلى Turbo تلقائياً</label>
                  <span className="text-[10px] text-slate-400">عند التفعيل، ترسل أكدلي الطلبات المؤكدة إلى Turbo بعد التأكيد.</span>
                </div>
              </div>

              {/* Webhook Section - Akked Style */}
              <div className="bg-slate-50 dark:bg-slate-800/30 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-6">
                <div className="space-y-2">
                  <label className="font-bold text-slate-500 dark:text-slate-400 text-[10px] block text-left">رابط Webhook</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/api/webhooks/turbo/${settings.id}`}
                      className="flex-1 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-[11px] text-slate-600 dark:text-slate-400 outline-none"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/turbo/${settings.id}`);
                        inAppToast('تم نسخ رابط الـ Webhook', 'success');
                      }}
                      className="p-3 bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 transition"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-bold text-slate-500 dark:text-slate-400 text-[10px] block text-left">توكن Webhook</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        readOnly
                        value={webhookToken || '••••••••••••••••••••••••••••••••••••••••'}
                        className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-[11px] text-slate-600 dark:text-slate-400 outline-none pr-10"
                      />
                      <button 
                        onClick={() => {
                          if (webhookToken) {
                            navigator.clipboard.writeText(webhookToken);
                            inAppToast('تم نسخ التوكن', 'success');
                          }
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                        setWebhookToken(newToken);
                      }}
                      className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-[11px] hover:bg-slate-200 transition"
                    >
                      توليد
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center leading-relaxed">
                  استخدم هذا الرابط وتوكن Bearer داخل إعدادات Webhook في Turbo.
                </p>
              </div>

              <div className="flex items-center gap-4 pt-4">
                <button
                  type="button"
                  onClick={onBack}
                  className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-sm hover:bg-slate-200 transition"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="flex-[2] py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={18} /> ربط Turbo
                </button>
              </div>

              {isSaved && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 rounded-2xl text-xs font-bold text-center border border-emerald-200">
                  تم حفظ الإعدادات وتنشيط شركة تربو في الخيارات!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Live Tracking */}
      {activeTab === 'tracking' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Truck size={20} className="text-purple-600" /> تتبع شحنة بوليصة تربو (Live Tracking)
            </h2>
            <p className="text-xs text-slate-400 mt-1">استعلام مباشر برقم بوليصة تربو لمعرفة الحالة ومراحل التوصيل.</p>
          </div>

          <div className="flex gap-3">
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="أدخل رقم بوليصة الشحن (مثال: TRB-987654)"
              className="flex-1 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-mono text-xs dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="button"
              onClick={handleTrackShipment}
              disabled={isTracking}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold text-xs shadow-md transition flex items-center gap-2"
            >
              {isTracking ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
              تتبع الآن
            </button>
          </div>

          {trackingInfo && (
            <div className="p-5 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 rounded-2xl space-y-3 font-sans text-xs">
              <div className="flex justify-between items-center border-b pb-2 dark:border-purple-900">
                <span className="font-black text-purple-900 dark:text-purple-200">حالة الشحنة الحالية:</span>
                <span className="px-3 py-1 bg-purple-600 text-white font-bold rounded-lg">{trackingInfo.status || trackingInfo.state || 'قيد المعالجة'}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-slate-700 dark:text-slate-300 font-bold">
                <div>رقم الشحنة: <span className="font-mono text-purple-600">{trackingInfo.airway_bill || trackingNumber}</span></div>
                <div>العميل: <span>{trackingInfo.customer_name || 'غير محدد'}</span></div>
                <div>المحافظة: <span>{trackingInfo.governorate || 'القاهرة'}</span></div>
                <div>التحصيل المطلوب: <span className="font-mono text-emerald-600">{trackingInfo.cod || 0} ج.م</span></div>
              </div>

              <div className="pt-4 flex flex-wrap gap-2 border-t dark:border-purple-900/40">
                <button
                  onClick={() => handleAction('resend')}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-black transition flex items-center gap-1.5"
                >
                  <RefreshCw size={12} /> إعادة إرسال الطلب (Resend)
                </button>
                <button
                  onClick={() => handleAction('cancel')}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black transition flex items-center gap-1.5"
                >
                  <AlertCircle size={12} /> طلب إلغاء (Cancel)
                </button>
                <button
                  onClick={() => handleAction('delete')}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black transition flex items-center gap-1.5"
                >
                  <AlertCircle size={12} /> حذف من النظام (Delete)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Dispatch Order */}
      {activeTab === 'dispatch' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Send size={20} className="text-purple-600" /> إرسال وتصدير طلب لشركة تربو
            </h2>
            <p className="text-xs text-slate-400 mt-1">اختر الطلب المؤكد وتصديره مباشرة لإنشاء بوليصة شحن لدى تربو.</p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">اختر الطلب المراد تصديره:</label>
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none"
              >
                <option value="">-- اختر طلباً من قائمة الأوردرات --</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.orderNumber} - {o.customerName} ({o.shippingArea || 'القاهرة'}) - {o.totalPrice || 0} ج.م
                  </option>
                ))}
              </select>
            </div>

            {(() => {
              const target = orders.find(o => o.id === selectedOrderId || o.orderNumber === selectedOrderId) as any;
              if (!target) return null;
              const sender = target.merchantBrandName || target.subSenderName || target.storeName || secondClient || 'وان تولز';
              const nts = [target.shippingNotes, target.deliveryNotes, target.notes].filter(Boolean).filter(n => n !== "شحنة متجر تربو" && !n.includes("رقم الفاتورة") && !n.includes("رقم الفاتوره")).join(' | ') || 'بدون ملاحظات إضافية';
              const flexAmt = Number(target.flexShipFee !== undefined && target.flexShipFee !== null && Number(target.flexShipFee) > 0 ? target.flexShipFee : target.flexShipCompanyFee || target.returnAmount || 0);
              const itemsList = Array.isArray(target.items) ? target.items : [];

              return (
                <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-3xl space-y-4 text-xs">
                  {/* Card Header */}
                  <div className="font-black text-slate-800 dark:text-slate-100 border-b pb-3 dark:border-slate-700 flex flex-wrap justify-between items-center gap-2">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-purple-600" />
                      <span>مراجعة بيانات البوليصة قبل الإرسال إلى تربو</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-black rounded-lg text-[11px]">
                        طلب #{target.orderNumber}
                      </span>
                    </div>
                  </div>

                  {/* Top Critical Fields: Invoice Number & Building Number */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white dark:bg-slate-900/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>رقم الفاتورة (يظهر في أعلى البوليصة):</span>
                        <span className="text-[10px] text-purple-600 font-normal">مستقل عن الملاحظات</span>
                      </label>
                      <input
                        type="text"
                        value={customInvoiceNumber}
                        onChange={(e) => setCustomInvoiceNumber(e.target.value)}
                        placeholder="مثال: 239 أو INV-001"
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-purple-200 dark:border-purple-900 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/20"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>رقم المبنى:</span>
                        <span className="text-[10px] text-emerald-600 font-normal">يتم إرساله لحقول تربو</span>
                      </label>
                      <input
                        type="text"
                        value={customBuildingNumber}
                        onChange={(e) => setCustomBuildingNumber(e.target.value)}
                        placeholder="مثال: عمارة 15 أو 12"
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/20"
                      />
                    </div>
                  </div>

                  {/* Shipment Info Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px] text-slate-600 dark:text-slate-300">
                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="text-slate-400 text-[10px]">اسم الراسل / المتجر:</div>
                      <div className="font-bold text-slate-800 dark:text-white mt-0.5">{sender}</div>
                    </div>

                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="text-slate-400 text-[10px]">المستلم والهاتف:</div>
                      <div className="font-bold text-slate-800 dark:text-white mt-0.5">{target.customerName} ({target.customerPhone})</div>
                    </div>

                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="text-slate-400 text-[10px]">المحافظة والمدينة / المنطقة:</div>
                      <div className="font-bold text-slate-800 dark:text-white mt-0.5">
                        {target.governorate || target.shippingArea || 'القاهرة'} - {target.city || target.area || 'بلطيم'}
                      </div>
                    </div>

                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="text-slate-400 text-[10px]">العنوان وتفاصيل السكن:</div>
                      <div className="font-bold text-slate-800 dark:text-white mt-0.5">
                        طابق: {target.floorNumber || '-'} | شقة: {target.apartmentNumber || '-'}
                      </div>
                    </div>

                    <div className="p-2.5 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/50">
                      <div className="text-amber-700 dark:text-amber-400 text-[10px] font-bold">قيمة الارتجاع (مبلغ الفلكس FlexShip):</div>
                      <div className="font-black text-amber-900 dark:text-amber-200 mt-0.5">
                        {flexAmt.toLocaleString('ar-EG')} ج.م
                      </div>
                    </div>

                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="text-slate-400 text-[10px]">المبلغ المطلوب تحصيله:</div>
                      <div className="font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {Number(target.totalPrice || 0).toLocaleString('ar-EG')} ج.م
                      </div>
                    </div>
                  </div>

                  {/* Expanded Shipment Summary: Multiple Products Display */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Package size={14} className="text-purple-600" />
                        وصف ومحتويات الشحنة ({itemsList.length} منتج):
                      </span>
                      <span className="text-[10px] text-slate-400">مكان موسّع لعرض كافة المنتجات والكميات</span>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 max-h-48 overflow-y-auto">
                      {itemsList.length > 0 ? (
                        itemsList.map((item: any, idx: number) => {
                          const name = item.productName || item.name || 'منتج';
                          const qty = item.quantity || 1;
                          const variant = [item.color, item.size, item.variant].filter(Boolean).join(' - ');
                          return (
                            <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-[11px]">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-[10px]">
                                  {idx + 1}
                                </span>
                                <span className="font-bold text-slate-800 dark:text-white">{name}</span>
                                {variant && (
                                  <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[10px]">
                                    {variant}
                                  </span>
                                )}
                              </div>
                              <div className="font-black text-purple-700 dark:text-purple-300">
                                العدد: {qty}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-slate-400 text-center py-2 text-xs">
                          {target.order_summary || 'منتجات متنوعة'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes Preview */}
                  <div className="p-3 bg-slate-100/70 dark:bg-slate-900 rounded-2xl text-[11px] flex items-start gap-2 border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-600 dark:text-slate-400 shrink-0">ملاحظات الشحنة:</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{nts}</span>
                  </div>
                </div>
              );
            })()}

            <button
              type="button"
              onClick={handleDispatchOrder}
              disabled={isSendingOrder || !selectedOrderId}
              className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white rounded-2xl font-bold text-xs shadow-lg transition flex items-center justify-center gap-2"
            >
              {isSendingOrder ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
              تصدير الشحنة فوراً وإصدار البوليصة
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: Governorates & Pricing Matrix */}
      {activeTab === 'governorates' && (
        <div className="space-y-6">
          {/* Header & Financial Context Banner */}
          <div className="bg-gradient-to-br from-purple-900/90 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl border border-purple-800/40 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-purple-500/30 text-purple-200 border border-purple-400/30 rounded-full text-[11px] font-black flex items-center gap-1.5">
                    <DollarSign size={13} /> التسعير المحاسبي الرسمي
                  </span>
                  <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[11px] font-black flex items-center gap-1">
                    <Check size={13} /> معتمد في حسابات الأرباح
                  </span>
                </div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <MapPin size={22} className="text-purple-400" /> جدول تسعيرات شحن ومحافظات شركة تربو (Turbo Rates Matrix)
                </h2>
                <p className="text-xs text-purple-200 max-w-3xl leading-relaxed">
                  هذا هو جدول الأسعار الفعلي لشركة <strong className="text-white">تربو</strong>. عند اختيار شركة "تربو" لأي أوردر، يعتمد محرك الحسابات المالية وتقارير الأرباح على هذه الأسعار لحساب تكلفة الشحن وصافي ربحك بدقة.
                </p>
                <div className="p-3 bg-white/10 rounded-2xl text-[11px] text-purple-100 flex items-start gap-2 border border-white/10 max-w-2xl">
                  <Info size={16} className="text-amber-300 shrink-0 mt-0.5" />
                  <span>
                    <strong>توضيح بخصوص الـ 55 ج.م:</strong> قيمة الـ 55 ج.م السابقة كانت مجرد قيمة احتياطية عامة (Fallback) تُستخدم إذا لم تكن تسعيرات شركة تربو مسجلة لكل محافظة. مع هذا الجدول يمكنك تحديد تسعيرة كل محافظة بدقة، وحفظها للمزامنة الفورية.
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch md:items-center gap-2.5 shrink-0 self-stretch md:self-auto">
                <button
                  type="button"
                  onClick={handleSaveRatesToSystem}
                  disabled={isSavingRates}
                  className="px-5 py-3 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-black text-xs rounded-2xl shadow-lg transition flex items-center justify-center gap-2"
                >
                  {isSavingRates ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                  حفظ ومزامنة الأسعار مع الحسابات
                </button>
                <button
                  type="button"
                  onClick={handleResetToStandardRates}
                  className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-2xl transition flex items-center justify-center gap-1.5 border border-white/15"
                >
                  <RotateCcw size={14} /> استعادة تسعيرة تربو الرسمية
                </button>
              </div>
            </div>
          </div>

          {/* Quick Toggles: Financial Policies & API Codes */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowTurboFinancials(!showTurboFinancials)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${showTurboFinancials ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'}`}
              >
                <Sliders size={14} /> السياسات والرسوم الإضافية لتربو
                {showTurboFinancials ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              <button
                type="button"
                onClick={() => setShowTurboApiCodes(!showTurboApiCodes)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${showTurboApiCodes ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'}`}
              >
                <Key size={14} /> أكواد الـ API المعتمدة (29 كود)
                {showTurboApiCodes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
              <span>إجمالي المحافظات المهيئة:</span>
              <span className="font-black text-purple-600 dark:text-purple-400 font-mono text-sm">{turboRates.length}</span>
            </div>
          </div>

          {/* Turbo Financial Policies Expandable Drawer */}
          {showTurboFinancials && (
            <div className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/60 p-6 rounded-3xl shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
                <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <Sliders size={16} className="text-purple-600" /> السياسات والرسوم المالية الخاصة بشركة تربو (Company Specific Fees)
                </h3>
                <span className="text-[11px] text-slate-400">تُطبق على طلبات تربو في تقارير الحسابات والأرباح</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="space-y-1.5 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">رسوم معاينة/فحص الشحنة (ج.م):</label>
                  <input
                    type="number"
                    value={turboFees.inspectionFee || 0}
                    onChange={(e) => setTurboFees({ ...turboFees, inspectionFee: Number(e.target.value) })}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl font-mono font-bold dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-[10px] text-slate-400 block">إذا كانت الشحنة تسمح بالمعاينة للعميل</span>
                </div>

                <div className="space-y-1.5 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">رسوم المرتجع الثابت (ج.م):</label>
                  <input
                    type="number"
                    value={turboFees.returnShippingFee || 30}
                    onChange={(e) => setTurboFees({ ...turboFees, returnShippingFee: Number(e.target.value) })}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl font-mono font-bold dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-[10px] text-slate-400 block">تكلفة رجوع الطرد في حال رفض الاستلام</span>
                </div>

                <div className="space-y-1.5 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">حد تحصيل كاش COD مجاني (ج.م):</label>
                  <input
                    type="number"
                    value={turboFees.codThreshold || 3000}
                    onChange={(e) => setTurboFees({ ...turboFees, codThreshold: Number(e.target.value) })}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl font-mono font-bold dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-[10px] text-slate-400 block">تربو تفرض 1% على المبالغ فوق هذا الحد</span>
                </div>

                <div className="space-y-1.5 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">الوزن الأساسي المشمول (كجم):</label>
                  <input
                    type="number"
                    value={turboFees.baseWeight || 1}
                    onChange={(e) => setTurboFees({ ...turboFees, baseWeight: Number(e.target.value) })}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl font-mono font-bold dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-[10px] text-slate-400 block">الوزن المشمول في سعر التوصيل الأساسي</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveRatesToSystem}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
                >
                  <Save size={13} /> حفظ إعدادات السياسات المالية لتربو
                </button>
              </div>
            </div>
          )}

          {/* Official API Codes Drawer */}
          {showTurboApiCodes && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
                <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <Key size={16} className="text-purple-600" /> أكواد المحافظات المعتمدة في واجهة برمجة تربو (Turbo Governorate API Codes)
                </h3>
                <span className="text-[11px] text-slate-400">تُرسل تلقائياً إلى خوادم تربو عند إصدار البوليصة</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                {Object.entries(TURBO_GOV_CODES).map(([govName, code]) => (
                  <div key={govName} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{govName}</span>
                    <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded-md text-[10px] font-mono font-black">
                      {code}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Table Container */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden space-y-4 p-6">
            {/* Filters and Search Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={govSearchQuery}
                  onChange={(e) => setGovSearchQuery(e.target.value)}
                  placeholder="ابحث باسم المحافظة (مثل: القاهرة، الدقهلية، سوهاج...)"
                  className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-purple-500 dark:text-white"
                />
              </div>

              {/* Region Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { key: 'all', label: 'الكل' },
                  { key: 'cairo', label: 'القاهرة الكبرى' },
                  { key: 'delta', label: 'الدلتا والبحري' },
                  { key: 'canal', label: 'القناة وشمال الصعيد' },
                  { key: 'upper', label: 'الصعيد' },
                  { key: 'frontier', label: 'الحدودية' }
                ].map((rf) => (
                  <button
                    key={rf.key}
                    type="button"
                    onClick={() => setGovRegionFilter(rf.key as any)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap ${govRegionFilter === rf.key ? 'bg-purple-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                  >
                    {rf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Governorates Table with Full Official Rate Columns */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/40 whitespace-nowrap">
                    <th className="p-3 font-black">المحافظة</th>
                    <th className="p-3 font-black text-center">كود تربو</th>
                    <th className="p-3 font-black text-center text-purple-700 dark:text-purple-300">تكلفة الشحن إلى المحافظة</th>
                    <th className="p-3 font-black text-center text-amber-700 dark:text-amber-300">شحن مرتجع على الراسل</th>
                    <th className="p-3 font-black text-center text-orange-700 dark:text-orange-300">شحن مرتجع مدفوع</th>
                    <th className="p-3 font-black text-center text-rose-700 dark:text-rose-300">مرتجع إلغاء</th>
                    <th className="p-3 font-black text-center text-emerald-700 dark:text-emerald-300">مرتجع على الراسل</th>
                    <th className="p-3 font-black text-center text-teal-700 dark:text-teal-300">مرتجع على المرسل إليه</th>
                    <th className="p-3 font-black text-center text-indigo-700 dark:text-indigo-300">مرتجع جزئي</th>
                    <th className="p-3 font-black text-center">معاد التسليم</th>
                    <th className="p-3 font-black text-center text-slate-500">سعر الاستبدال</th>
                    <th className="p-3 font-black text-center text-slate-500">ك/زائد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 whitespace-nowrap">
                  {turboRates
                    .filter(opt => {
                      if (govSearchQuery.trim()) {
                        return opt.label.includes(govSearchQuery.trim());
                      }
                      if (govRegionFilter !== 'all') {
                        const region = getGovernorateRegion(opt.label);
                        return region.key === govRegionFilter;
                      }
                      return true;
                    })
                    .map((opt) => {
                      const region = getGovernorateRegion(opt.label);
                      const turboCode = TURBO_GOV_CODES[opt.label] || '—';
                      const deliveryDaysText = opt.deliveryDays || region.deliveryDays;
                      return (
                        <tr key={opt.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition">
                          {/* 1. المحافظة */}
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <MapPin size={15} className="text-purple-600 shrink-0" />
                              <div>
                                <span className="font-black text-slate-900 dark:text-white block text-sm">{opt.label}</span>
                                <span className="text-[10px] text-slate-400">{region.label}</span>
                              </div>
                            </div>
                          </td>

                          {/* 2. كود تربو */}
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded-lg font-mono font-black text-xs">
                              {turboCode}
                            </span>
                          </td>

                          {/* 3. تكلفة الشحن إلى المحافظة */}
                          <td className="p-3 text-center">
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                value={opt.deliveryPrice}
                                onChange={(e) => handleRateChange(opt.label, 'deliveryPrice', Number(e.target.value))}
                                className="w-20 p-1.5 bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl text-center font-mono font-black text-purple-700 dark:text-purple-300 outline-none focus:ring-2 focus:ring-purple-500 text-xs"
                              />
                              <span className="text-[10px] text-slate-400 font-bold">ج.م</span>
                            </div>
                          </td>

                          {/* 4. شحن مرتجع على الراسل */}
                          <td className="p-3 text-center">
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                value={opt.returnPrice ?? opt.returnToSenderPrice ?? opt.deliveryPrice}
                                onChange={(e) => {
                                  handleRateChange(opt.label, 'returnPrice', Number(e.target.value));
                                  handleRateChange(opt.label, 'returnToSenderPrice', Number(e.target.value));
                                }}
                                className="w-20 p-1.5 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-center font-mono font-bold text-amber-700 dark:text-amber-300 outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                              />
                              <span className="text-[10px] text-slate-400 font-bold">ج.م</span>
                            </div>
                          </td>

                          {/* 5. شحن مرتجع مدفوع */}
                          <td className="p-3 text-center">
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                value={opt.paidReturnPrice ?? opt.deliveryPrice}
                                onChange={(e) => handleRateChange(opt.label, 'paidReturnPrice', Number(e.target.value))}
                                className="w-20 p-1.5 bg-orange-50/50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl text-center font-mono font-bold text-orange-700 dark:text-orange-300 outline-none focus:ring-2 focus:ring-orange-500 text-xs"
                              />
                              <span className="text-[10px] text-slate-400 font-bold">ج.م</span>
                            </div>
                          </td>

                          {/* 6. مرتجع إلغاء */}
                          <td className="p-3 text-center">
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                value={opt.cancelReturnPrice ?? 21.00}
                                onChange={(e) => handleRateChange(opt.label, 'cancelReturnPrice', Number(e.target.value))}
                                className="w-16 p-1.5 bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-center font-mono font-bold text-rose-700 dark:text-rose-300 outline-none focus:ring-2 focus:ring-rose-500 text-xs"
                              />
                              <span className="text-[10px] text-slate-400 font-bold">ج.م</span>
                            </div>
                          </td>

                          {/* 7. مرتجع على الراسل */}
                          <td className="p-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-bold">
                              0.00 ج.م
                            </span>
                          </td>

                          {/* 8. مرتجع على المرسل إليه */}
                          <td className="p-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 text-xs font-mono font-bold">
                              0.00 ج.م
                            </span>
                          </td>

                          {/* 9. مرتجع جزئي */}
                          <td className="p-3 text-center">
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                value={opt.partialReturnPrice ?? 21.00}
                                onChange={(e) => handleRateChange(opt.label, 'partialReturnPrice', Number(e.target.value))}
                                className="w-16 p-1.5 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl text-center font-mono font-bold text-indigo-700 dark:text-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                              />
                              <span className="text-[10px] text-slate-400 font-bold">ج.م</span>
                            </div>
                          </td>

                          {/* 10. معاد التسليم */}
                          <td className="p-3 text-center">
                            <input
                              type="text"
                              value={opt.deliveryDays || region.deliveryDays}
                              onChange={(e) => handleRateChange(opt.label, 'deliveryDays', e.target.value)}
                              className="w-20 p-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-center font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-purple-500 text-xs"
                            />
                          </td>

                          {/* سعر الاستبدال */}
                          <td className="p-3 text-center">
                            <input
                              type="number"
                              value={opt.exchangePrice || 35}
                              onChange={(e) => handleRateChange(opt.label, 'exchangePrice', Number(e.target.value))}
                              className="w-16 p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-center font-mono font-medium text-slate-600 dark:text-slate-400 outline-none focus:ring-2 focus:ring-purple-500 text-xs"
                            />
                          </td>

                          {/* سعر الكيلو الزائد */}
                          <td className="p-3 text-center">
                            <input
                              type="number"
                              value={opt.extraKgPrice || 5}
                              onChange={(e) => handleRateChange(opt.label, 'extraKgPrice', Number(e.target.value))}
                              className="w-14 p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-center font-mono font-medium text-slate-600 dark:text-slate-400 outline-none focus:ring-2 focus:ring-purple-500 text-xs"
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Bottom Save Bar */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                💡 التعديلات تُطبق فوراً على الأوردرات الجديدة وإعادة حساب الأرباح بعد الضغط على زر الحفظ.
              </span>
              <button
                type="button"
                onClick={handleSaveRatesToSystem}
                disabled={isSavingRates}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black text-xs shadow-lg transition flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                {isSavingRates ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                حفظ ومزامنة أسعار تربو الآن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Calculator */}
      {activeTab === 'calculator' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Calculator size={20} className="text-purple-600" /> حاسبة تسعير شحن تربو (Turbo Rates Calculator)
            </h2>
            <p className="text-xs text-slate-400 mt-1">محاكاة فورية لتكلفة شحن الطرود وحساب رسوم التحصيل لمختلف المحافظات.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">المحافظة الوجهة:</label>
              <input
                type="text"
                value={calcGov}
                onChange={(e) => setCalcGov(e.target.value)}
                placeholder="مثال: القاهرة، الإسكندرية، طنطا..."
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl dark:text-white outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">مبلغ التحصيل المطلوب (COD):</label>
              <input
                type="number"
                value={calcCod}
                onChange={(e) => setCalcCod(Number(e.target.value))}
                placeholder="مبلغ التحصيل (ج.م)"
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-mono dark:text-white outline-none"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleCalculateRate}
            disabled={isCalculating}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
          >
            {isCalculating ? <RefreshCw size={14} className="animate-spin" /> : <Calculator size={14} />}
            حساب السعر المقدر
          </button>

          {calcResult && (
            <div className="p-5 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 rounded-3xl space-y-3 text-xs font-bold font-mono">
              <div className="flex justify-between items-center pb-2 border-b border-purple-200/60 dark:border-purple-900/60">
                <span className="font-black text-slate-800 dark:text-slate-200">المحافظة:</span>
                <span className="text-purple-700 dark:text-purple-300 font-black">{calcResult.governorate || calcGov}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">سعر الشحن الأساسي إلى المحافظة:</span>
                <span className="text-purple-700 dark:text-purple-300">{calcResult.baseFee} ج.م</span>
              </div>
              {calcResult.returnPrice && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">شحن المرتجع على الراسل:</span>
                  <span className="text-amber-700 dark:text-amber-400">{calcResult.returnPrice} ج.م</span>
                </div>
              )}
              {calcResult.cancelReturnFee !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">رسوم مرتجع الإلغاء:</span>
                  <span className="text-rose-600 dark:text-rose-400">{calcResult.cancelReturnFee} ج.م</span>
                </div>
              )}
              {calcResult.partialReturnFee !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">رسوم المرتجع الجزئي:</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{calcResult.partialReturnFee} ج.م</span>
                </div>
              )}
              {calcResult.deliveryDays && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">ميعاد التسليم المتوقع:</span>
                  <span className="text-emerald-700 dark:text-emerald-400">{calcResult.deliveryDays}</span>
                </div>
              )}
              {calcResult.codFee > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>رسوم تحصيل إضافية (1% فوق 3000):</span>
                  <span>+{calcResult.codFee} ج.م</span>
                </div>
              )}
              <div className="flex justify-between pt-3 border-t border-purple-200/60 dark:border-purple-900/60 text-sm font-black text-purple-700 dark:text-purple-300">
                <span>إجمالي تكلفة الشحن:</span>
                <span className="text-emerald-600 text-base">{calcResult.totalPrice} ج.م</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: Tickets */}
      {activeTab === 'tickets' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                <FileText size={24} className="text-purple-600" /> نظام الدعم الفني والتذاكر
              </h2>
              <p className="text-xs text-slate-400 mt-1">تواصل مباشرة مع فريق دعم تربو لحل مشكلات الشحنات والاستفسارات.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleFetchTicketsData}
                className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl hover:bg-slate-200 transition"
                title="تحديث البيانات"
              >
                <RefreshCw size={18} className={isLoadingTickets ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setShowCreateTicketModal(true)}
                className="px-6 py-2.5 bg-purple-600 text-white rounded-2xl text-xs font-black shadow-lg hover:bg-purple-700 transition flex items-center gap-2"
              >
                <Plus size={16} /> إنشاء تذكرة دعم جديدة
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-3xl">
              <p className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1">إجمالي التذاكر</p>
              <h3 className="text-2xl font-black text-purple-900 dark:text-white">{ticketsList.length}</h3>
            </div>
            <div className="p-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-3xl">
              <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">التذاكر المفتوحة</p>
              <h3 className="text-2xl font-black text-amber-900 dark:text-white">{totalOpenTickets}</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">الكود</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">الفئة</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">المحتوى</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">الحالة</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">التاريخ</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">التحكم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {isLoadingTickets ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-xs font-bold italic">
                        <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-purple-600" />
                        جاري جلب قائمة التذاكر من تربو...
                      </td>
                    </tr>
                  ) : ticketsList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-xs font-bold italic">
                        لا يوجد تذاكر دعم مسجلة حالياً.
                      </td>
                    </tr>
                  ) : (
                    ticketsList.map((ticket, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 text-xs font-black text-slate-800 dark:text-white">#{ticket.code}</td>
                        <td className="px-6 py-4">
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                            {ticket.category?.name}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 max-w-xs truncate">{ticket.content}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                            ticket.status?.value === 'open' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            ticket.status?.value === 'closed' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' :
                            'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          }`}>
                            {ticket.status?.label || ticket.status?.value}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[10px] font-mono text-slate-400">{ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('ar-EG') : '---'}</td>
                        <td className="px-6 py-4">
                           <button className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-xl transition" title="عرض التفاصيل والدردشة">
                              <ExternalLink size={16} />
                           </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      {showCreateTicketModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[32px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/50 rounded-2xl flex items-center justify-center text-purple-600">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white">إنشاء تذكرة دعم جديدة</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">سحب تذاكر تربو - الدعم الفني</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCreateTicketModal(false)}
                className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-1.5 text-right">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">فئة التذكرة</label>
                <select
                  value={ticketForm.category_id}
                  onChange={(e) => setTicketForm(prev => ({ ...prev, category_id: e.target.value }))}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-purple-500 appearance-none"
                >
                  <option value="">اختر فئة التذكرة...</option>
                  {ticketCategories.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 text-right">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">الأولوية</label>
                  <select
                    value={ticketForm.priority}
                    onChange={(e) => setTicketForm(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-purple-500 appearance-none"
                  >
                    <option value="low">منخفضة</option>
                    <option value="medium">متوسطة</option>
                    <option value="high">عالية</option>
                    <option value="urgent">عاجلة</option>
                  </select>
                </div>
                <div className="space-y-1.5 text-right">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">رقم الشحنة (اختياري)</label>
                  <input
                    type="text"
                    value={ticketForm.code}
                    onChange={(e) => setTicketForm(prev => ({ ...prev, code: e.target.value }))}
                    placeholder="رقم البوليصة المرتبطة..."
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-mono dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5 text-right">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">محتوى التذكرة / المشكلة</label>
                <textarea
                  value={ticketForm.content}
                  onChange={(e) => setTicketForm(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="يرجى كتابة تفاصيل المشكلة أو الاستفسار هنا..."
                  rows={4}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>

              <button
                onClick={handleCreateTicket}
                disabled={isCreatingTicket}
                className="w-full py-5 bg-purple-600 text-white rounded-[24px] font-black shadow-xl hover:bg-purple-700 transition active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
              >
                {isCreatingTicket ? (
                  <>
                    <RefreshCw size={20} className="animate-spin" /> جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Send size={20} /> إرسال التذكرة الآن
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
