import React, { useState } from 'react';
import { Partner, Permission, PERMISSIONS, Settings, Employee, PartnerPortalPermissions, PartnerAllowedReports } from '../types';
import { 
  ShieldCheck, Check, X, Sparkles, Save, Loader2, Package, 
  ShoppingCart, Users, DollarSign, Settings as SettingsIcon,
  LayoutDashboard, Coins, FileText, TrendingUp, User, Printer,
  Eye, Lock, Sliders, ToggleLeft, ToggleRight, BarChart3, Truck, Layers
} from 'lucide-react';
import * as db from '../services/databaseService';

interface PartnerPermissionsModalProps {
  partner: Partner;
  storeId: string;
  storeName: string;
  settings: Settings;
  updateSettings: (newSettings: any) => void;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const DEFAULT_PORTAL_PERMISSIONS: Required<Omit<PartnerPortalPermissions, 'allowedReports'>> = {
  canViewOverview: true,
  canViewCapital: true,
  canViewProfits: true,
  canViewCustody: true,
  canViewWithdrawalsTab: true,
  canRequestWithdrawal: true,
  canRequestExpense: true,
  canViewStatementTab: true,
  canPrintStatement: true,
  canViewPerformanceTab: true,
  canViewStoreSales: true,
  canViewStoreProfits: true,
  canViewReportsTab: true,
  canViewProfileTab: true,
  canEditProfile: true,
  canEditPayoutAccounts: true,
  canChangeSecurity: true
};

export const PartnerPermissionsModal: React.FC<PartnerPermissionsModalProps> = ({
  partner,
  storeId,
  storeName,
  settings,
  updateSettings,
  onClose,
  showToast
}) => {
  const [activeTab, setActiveTab] = useState<'portal' | 'system'>('portal');

  // Partner Portal Permissions State
  const [portalPerms, setPortalPerms] = useState<Required<Omit<PartnerPortalPermissions, 'allowedReports'>>>(() => {
    const existing = partner.portalPermissions || {};
    return {
      canViewOverview: existing.canViewOverview ?? true,
      canViewCapital: existing.canViewCapital ?? true,
      canViewProfits: existing.canViewProfits ?? true,
      canViewCustody: existing.canViewCustody ?? true,
      canViewWithdrawalsTab: existing.canViewWithdrawalsTab ?? true,
      canRequestWithdrawal: existing.canRequestWithdrawal ?? true,
      canRequestExpense: existing.canRequestExpense ?? true,
      canViewStatementTab: existing.canViewStatementTab ?? true,
      canPrintStatement: existing.canPrintStatement ?? true,
      canViewPerformanceTab: existing.canViewPerformanceTab ?? true,
      canViewStoreSales: existing.canViewStoreSales ?? true,
      canViewStoreProfits: existing.canViewStoreProfits ?? true,
      canViewReportsTab: existing.canViewReportsTab ?? true,
      canViewProfileTab: existing.canViewProfileTab ?? true,
      canEditProfile: existing.canEditProfile ?? true,
      canEditPayoutAccounts: existing.canEditPayoutAccounts ?? true,
      canChangeSecurity: existing.canChangeSecurity ?? true
    };
  });

  // Allowed Reports State
  const [allowedReports, setAllowedReports] = useState<Required<PartnerAllowedReports>>(() => {
    const existing = partner.portalPermissions?.allowedReports || {};
    return {
      salesAndRevenue: existing.salesAndRevenue ?? true,
      topSellingProducts: existing.topSellingProducts ?? true,
      inventoryValuation: existing.inventoryValuation ?? true,
      expensesBreakdown: existing.expensesBreakdown ?? false,
      shippingPerformance: existing.shippingPerformance ?? true,
      profitDistributions: existing.profitDistributions ?? true,
      cashFlowSummary: existing.cashFlowSummary ?? false
    };
  });

  // Employee System Permissions State
  const [selectedSystemPermissions, setSelectedSystemPermissions] = useState<Permission[]>(() => {
    return partner.permissions && partner.permissions.length > 0 
      ? [...partner.permissions] 
      : ['ORDERS_VIEW', 'PRODUCTS_VIEW'];
  });

  const [isSaving, setIsSaving] = useState(false);

  // Toggle portal permission
  const togglePortalPerm = (key: keyof Omit<PartnerPortalPermissions, 'allowedReports'>) => {
    setPortalPerms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Toggle report permission
  const toggleReportPerm = (key: keyof PartnerAllowedReports) => {
    setAllowedReports(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Toggle system permission
  const toggleSystemPermission = (key: Permission) => {
    setSelectedSystemPermissions(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Portal Presets
  const applyPortalPreset = (preset: 'full' | 'restricted' | 'statements_only' | 'sales_only') => {
    if (preset === 'full') {
      setPortalPerms({ ...DEFAULT_PORTAL_PERMISSIONS });
      setAllowedReports({
        salesAndRevenue: true,
        topSellingProducts: true,
        inventoryValuation: true,
        expensesBreakdown: true,
        shippingPerformance: true,
        profitDistributions: true,
        cashFlowSummary: true
      });
    } else if (preset === 'restricted') {
      setPortalPerms({
        canViewOverview: true,
        canViewCapital: false,
        canViewProfits: true,
        canViewCustody: true,
        canViewWithdrawalsTab: true,
        canRequestWithdrawal: false,
        canRequestExpense: false,
        canViewStatementTab: true,
        canPrintStatement: false,
        canViewPerformanceTab: false,
        canViewStoreSales: false,
        canViewStoreProfits: false,
        canViewReportsTab: false,
        canViewProfileTab: true,
        canEditProfile: false,
        canEditPayoutAccounts: false,
        canChangeSecurity: true
      });
      setAllowedReports({
        salesAndRevenue: false,
        topSellingProducts: false,
        inventoryValuation: false,
        expensesBreakdown: false,
        shippingPerformance: false,
        profitDistributions: true,
        cashFlowSummary: false
      });
    } else if (preset === 'statements_only') {
      setPortalPerms({
        canViewOverview: true,
        canViewCapital: false,
        canViewProfits: false,
        canViewCustody: false,
        canViewWithdrawalsTab: false,
        canRequestWithdrawal: false,
        canRequestExpense: false,
        canViewStatementTab: true,
        canPrintStatement: true,
        canViewPerformanceTab: false,
        canViewStoreSales: false,
        canViewStoreProfits: false,
        canViewReportsTab: false,
        canViewProfileTab: true,
        canEditProfile: false,
        canEditPayoutAccounts: false,
        canChangeSecurity: true
      });
    } else if (preset === 'sales_only') {
      setPortalPerms(prev => ({
        ...prev,
        canViewReportsTab: true,
        canViewPerformanceTab: true,
        canViewStoreSales: true
      }));
      setAllowedReports({
        salesAndRevenue: true,
        topSellingProducts: true,
        inventoryValuation: false,
        expensesBreakdown: false,
        shippingPerformance: true,
        profitDistributions: false,
        cashFlowSummary: false
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedPartner: Partner = {
        ...partner,
        portalPermissions: {
          ...portalPerms,
          allowedReports
        },
        permissions: selectedSystemPermissions
      };

      const partnerIdNorm = String(partner.id || '').trim();
      const partnerNameNorm = (partner.name || '').trim().toLowerCase();
      const partnerPhoneNorm = (partner.phone || '').trim();

      const existingPartners = settings.partners || [];
      let found = false;
      const updatedPartners = existingPartners.map(p => {
        const isMatch = (p.id && String(p.id).trim() === partnerIdNorm) ||
                        (partnerPhoneNorm && p.phone && String(p.phone).trim() === partnerPhoneNorm) ||
                        (p.name && partnerNameNorm && p.name.trim().toLowerCase() === partnerNameNorm);
        if (isMatch) {
          found = true;
          return {
            ...p,
            ...updatedPartner,
            portalPermissions: {
              ...portalPerms,
              allowedReports
            },
            permissions: selectedSystemPermissions
          };
        }
        return p;
      });

      const finalPartners = found ? updatedPartners : [...updatedPartners, updatedPartner];

      // Sync with employees
      const existingEmployees = settings.employees || [];
      const empIndex = existingEmployees.findIndex((e: any) => 
        e.id === partner.id || e.partnerId === partner.id || (partner.email && e.email && e.email.toLowerCase() === partner.email.toLowerCase())
      );

      let updatedEmployees: Employee[];
      if (empIndex >= 0) {
        updatedEmployees = existingEmployees.map((e, idx) => {
          if (idx === empIndex) {
            return {
              ...e,
              name: partner.name,
              email: partner.email || e.email || '',
              phone: partner.phone || e.phone || '',
              permissions: selectedSystemPermissions,
              isPartner: true,
              partnerId: partner.id,
              role: `شريك (${partner.profitRatio || 0}%)`,
              status: 'active' as const
            };
          }
          return e;
        });
      } else {
        const newEmployee: Employee = {
          id: partner.id,
          name: partner.name,
          email: partner.email || '',
          phone: partner.phone || '',
          permissions: selectedSystemPermissions,
          isPartner: true,
          partnerId: partner.id,
          role: `شريك (${partner.profitRatio || 0}%)`,
          status: 'active'
        };
        updatedEmployees = [...existingEmployees, newEmployee];
      }

      const newSettings = {
        ...settings,
        partners: finalPartners,
        employees: updatedEmployees
      };

      updateSettings(newSettings);

      if (storeId) {
        const cur = await db.getStoreData(storeId);
        if (cur) {
          await db.saveStoreData({ id: storeId, name: storeName } as any, {
            ...cur,
            settings: newSettings
          });
        }
      }

      showToast(`تم حفظ وتطبيق صلاحيات الشريك والتقارير المحددة (${partner.name}) بنجاح`, 'success');
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'حدث خطأ أثناء حفظ الصلاحيات', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" dir="rtl">
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white flex items-center justify-center font-black shadow-md shadow-indigo-600/20">
              <Sliders size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                التحكم في صلاحيات وتقارير الشريك ({partner.name})
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                حدد بدقة ما يراه الشريك من شاشات وأرصدة وتقارير مبيعات ومخزون ومصروفات
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl text-xs font-black">
          <button
            type="button"
            onClick={() => setActiveTab('portal')}
            className={`flex-1 py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'portal' 
                ? 'bg-white text-indigo-900 shadow-sm font-black ring-1 ring-slate-200' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard size={17} className="text-indigo-600" />
            <span>1. صلاحيات لوحة وبوابة الشريك والتقارير المخصصة</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`flex-1 py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'system' 
                ? 'bg-white text-indigo-900 shadow-sm font-black ring-1 ring-slate-200' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck size={17} className="text-[#008060]" />
            <span>2. صلاحيات الموظف في لوحة تحكم المتجر (Store System)</span>
          </button>
        </div>

        {/* ==================================================== */}
        {/* TAB 1: PARTNER PORTAL & REPORTS PERMISSIONS          */}
        {/* ==================================================== */}
        {activeTab === 'portal' && (
          <div className="space-y-6">
            
            {/* Quick Portal Presets */}
            <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-2.5">
              <div className="flex items-center gap-2 font-black text-xs text-indigo-900">
                <Sparkles size={16} className="text-indigo-600" />
                <span>نماذج جاهزة وسريعة لصلاحيات لوحة الشريك وتقاريره:</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => applyPortalPreset('full')}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs cursor-pointer shadow-xs"
                >
                  🌟 إظهار كل التقارير واللوحة
                </button>
                <button
                  type="button"
                  onClick={() => applyPortalPreset('sales_only')}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer border border-slate-300"
                >
                  📊 تقارير المبيعات والشحن فقط
                </button>
                <button
                  type="button"
                  onClick={() => applyPortalPreset('restricted')}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer border border-slate-300"
                >
                  🔒 مشاهدة الأرباح فقط
                </button>
                <button
                  type="button"
                  onClick={() => applyPortalPreset('statements_only')}
                  className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer border border-slate-300"
                >
                  📜 كشف حساب فقط
                </button>
              </div>
            </div>

            {/* ---------------------------------------------------- */}
            {/* SPECIAL SECTION: ALLOWED SPECIFIC REPORTS            */}
            {/* ---------------------------------------------------- */}
            <div className="p-5 rounded-3xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/40 via-white to-indigo-50/20 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">
                    <BarChart3 size={18} />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-slate-900">
                      تحديد التقارير المصرح للشريك برؤيتها في بوابته
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      اختر بدقة أي تقارير تفصيلية تظهر لهذا الشريك
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs font-black text-indigo-900 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 cursor-pointer shadow-xs">
                  <span>تفعيل تبويب التقارير:</span>
                  <input
                    type="checkbox"
                    checked={portalPerms.canViewReportsTab}
                    onChange={() => togglePortalPerm('canViewReportsTab')}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                </label>
              </div>

              {/* Reports Checkbox Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { key: 'salesAndRevenue', title: 'تقرير المبيعات والإيرادات', desc: 'إجمالي المبيعات، الطلبات، ومتوسط قيمة الأوردر', icon: BarChart3 },
                  { key: 'topSellingProducts', title: 'تقرير المنتجات الأكثر مبيعاً', desc: 'ترتيب الأصناف الأكثر طلباً والأعلى ربحية', icon: Package },
                  { key: 'inventoryValuation', title: 'تقرير قيمة المخزون والبضاعة', desc: 'قيمة المخزون بسعر التكلفة والبيع وحصته', icon: Layers },
                  { key: 'expensesBreakdown', title: 'تقرير المصروفات والتكاليف', desc: 'تفاصيل وتوزيع النفقات والمصروفات التشغيلية', icon: DollarSign },
                  { key: 'shippingPerformance', title: 'تقرير الشحن ونسب التسليم', desc: 'نسب التسليم الناجح ونسب المرتجع والإلغاء', icon: Truck },
                  { key: 'profitDistributions', title: 'تقرير دورات وتوزيعات الأرباح', desc: 'سجل دورات وتوزيعات الأرباح السابقة', icon: TrendingUp },
                  { key: 'cashFlowSummary', title: 'تقرير التدفقات النقدية والخزائن', desc: 'أرصدة الخزائن وحركة المقبوضات والمدفوعات', icon: Coins },
                ].map(rep => {
                  const isChecked = allowedReports[rep.key as keyof PartnerAllowedReports];
                  const Icon = rep.icon;
                  return (
                    <button
                      key={rep.key}
                      type="button"
                      onClick={() => toggleReportPerm(rep.key as keyof PartnerAllowedReports)}
                      className={`p-3 rounded-2xl border text-right transition-all flex items-start justify-between gap-2 cursor-pointer ${
                        isChecked 
                          ? 'bg-indigo-50/90 border-indigo-400 text-indigo-950 shadow-xs ring-1 ring-indigo-400' 
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex gap-2">
                        <Icon size={16} className={isChecked ? 'text-indigo-600 mt-0.5' : 'text-slate-400 mt-0.5'} />
                        <div>
                          <div className="font-black text-xs">{rep.title}</div>
                          <div className="text-[10px] text-slate-500 leading-tight mt-0.5">{rep.desc}</div>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 border ${
                        isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {isChecked && <Check size={12} strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Permission Blocks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Block 1: Overview & Financials */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-xs">
                <div className="flex items-center gap-2 font-black text-xs text-slate-900 border-b border-slate-100 pb-2">
                  <DollarSign size={16} className="text-emerald-600" />
                  <span>المركز المالي والأرصدة في لوحته</span>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer border border-slate-200">
                    <div>
                      <span className="text-xs font-black text-slate-900 block">عرض شاشة المركز المالي والأرصدة</span>
                      <span className="text-[10px] text-slate-500">الملخص المالي الرئيسي للرصيد والمستحقات</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={portalPerms.canViewOverview}
                      onChange={() => togglePortalPerm('canViewOverview')}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer border border-slate-200">
                    <div>
                      <span className="text-xs font-black text-slate-900 block">رؤية رأس المال / الاستثمار</span>
                      <span className="text-[10px] text-slate-500">إظهار كارت رأس المال المدفوع من الشريك</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={portalPerms.canViewCapital}
                      onChange={() => togglePortalPerm('canViewCapital')}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer border border-slate-200">
                    <div>
                      <span className="text-xs font-black text-slate-900 block">رؤية الأرباح التراكمية والمسحوبات</span>
                      <span className="text-[10px] text-slate-500">إظهار إجمالي أرباحه وصافي المسحوبات الشخصية</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={portalPerms.canViewProfits}
                      onChange={() => togglePortalPerm('canViewProfits')}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer border border-slate-200">
                    <div>
                      <span className="text-xs font-black text-slate-900 block">رؤية العهد النقدية النشطة للشريك</span>
                      <span className="text-[10px] text-slate-500">كارت العهد والمبالغ المستلمة للتسليم</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={portalPerms.canViewCustody}
                      onChange={() => togglePortalPerm('canViewCustody')}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                  </label>
                </div>
              </div>

              {/* Block 2: Withdrawal Requests */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-xs">
                <div className="flex items-center gap-2 font-black text-xs text-slate-900 border-b border-slate-100 pb-2">
                  <Coins size={16} className="text-amber-600" />
                  <span>طلبات السحب والمصروفات</span>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer border border-slate-200">
                    <div>
                      <span className="text-xs font-black text-slate-900 block">إظهار تبويب طلبات السحب والمصروفات</span>
                      <span className="text-[10px] text-slate-500">الوصول لسجل وتاريخ طلبات السحب</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={portalPerms.canViewWithdrawalsTab}
                      onChange={() => togglePortalPerm('canViewWithdrawalsTab')}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer border border-slate-200">
                    <div>
                      <span className="text-xs font-black text-slate-900 block">السماح بتقديم طلب سحب أرباح</span>
                      <span className="text-[10px] text-slate-500">زر تقديم طلب سحب رصيد مالي جديد</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={portalPerms.canRequestWithdrawal}
                      onChange={() => togglePortalPerm('canRequestWithdrawal')}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer border border-slate-200">
                    <div>
                      <span className="text-xs font-black text-slate-900 block">السماح بطلب تسوية مصروف أو سلفة</span>
                      <span className="text-[10px] text-slate-500">تقديم فواتير مصروفات لتسويتها من الإدارة</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={portalPerms.canRequestExpense}
                      onChange={() => togglePortalPerm('canRequestExpense')}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                  </label>
                </div>
              </div>

              {/* Block 3: Statements & Performance */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-xs">
                <div className="flex items-center gap-2 font-black text-xs text-slate-900 border-b border-slate-100 pb-2">
                  <FileText size={16} className="text-blue-600" />
                  <span>كشف الحساب والتقارير</span>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer border border-slate-200">
                    <div>
                      <span className="text-xs font-black text-slate-900 block">إظهار تبويب كشف الحساب والعمليات</span>
                      <span className="text-[10px] text-slate-500">استعراض سجل المعاملات المالية التاريخية للشريك</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={portalPerms.canViewStatementTab}
                      onChange={() => togglePortalPerm('canViewStatementTab')}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer border border-slate-200">
                    <div>
                      <span className="text-xs font-black text-slate-900 block">السماح بطباعة وتصدير كشف الحساب</span>
                      <span className="text-[10px] text-slate-500">زر الطباعة والتصدير لـ PDF</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={portalPerms.canPrintStatement}
                      onChange={() => togglePortalPerm('canPrintStatement')}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer border border-slate-200">
                    <div>
                      <span className="text-xs font-black text-slate-900 block">إظهار تبويب أداء المتجر والشراكة</span>
                      <span className="text-[10px] text-slate-500">الرسوم البيانية لمبيعات وأرباح المتجر</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={portalPerms.canViewPerformanceTab}
                      onChange={() => togglePortalPerm('canViewPerformanceTab')}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer border border-slate-200">
                    <div>
                      <span className="text-xs font-black text-slate-900 block">رؤية إجمالي مبيعات وأرباح المتجر العامة</span>
                      <span className="text-[10px] text-slate-500">إظهار أرقام مبيعات المحل بالكامل</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={portalPerms.canViewStoreSales}
                      onChange={() => togglePortalPerm('canViewStoreSales')}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                  </label>
                </div>
              </div>

              {/* Block 4: Profile & Payout Details */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-xs">
                <div className="flex items-center gap-2 font-black text-xs text-slate-900 border-b border-slate-100 pb-2">
                  <User size={16} className="text-purple-600" />
                  <span>الملف الشخصي والحسابات والأمان</span>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer border border-slate-200">
                    <div>
                      <span className="text-xs font-black text-slate-900 block">إظهار تبويب الملف الشخصي</span>
                      <span className="text-[10px] text-slate-500">الوصول لصفحة بيانات الشريك وصلاحياته</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={portalPerms.canViewProfileTab}
                      onChange={() => togglePortalPerm('canViewProfileTab')}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer border border-slate-200">
                    <div>
                      <span className="text-xs font-black text-slate-900 block">السماح بتعديل البيانات الشخصية والهاتف</span>
                      <span className="text-[10px] text-slate-500">تحديث الهاتف والبريد والعنوان بنفسه</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={portalPerms.canEditProfile}
                      onChange={() => togglePortalPerm('canEditProfile')}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer border border-slate-200">
                    <div>
                      <span className="text-xs font-black text-slate-900 block">السماح بتعديل حسابات ومحافظ الصرف</span>
                      <span className="text-[10px] text-slate-500">تعديل محفظة الكاش وإنستاباي والبنك</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={portalPerms.canEditPayoutAccounts}
                      onChange={() => togglePortalPerm('canEditPayoutAccounts')}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer border border-slate-200">
                    <div>
                      <span className="text-xs font-black text-slate-900 block">السماح بتغيير رمز PIN وكلمة المرور</span>
                      <span className="text-[10px] text-slate-500">تغيير رمز المرور الخاص بدخوله</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={portalPerms.canChangeSecurity}
                      onChange={() => togglePortalPerm('canChangeSecurity')}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                  </label>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 2: STORE SYSTEM / EMPLOYEE PERMISSIONS           */}
        {/* ==================================================== */}
        {activeTab === 'system' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-200">
              صلاحيات الشريك عندما يدخل على لوحة تحكم وإدارة المتجر كعضو في طاقم العمل:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { key: 'ORDERS_VIEW', title: 'عرض الطلبيات', desc: 'الاطلاع على قائمة الأوردرات والشحن' },
                { key: 'ORDERS_MANAGE', title: 'إدارة الطلبيات', desc: 'إنشاء وتعديل وحذف وتأكيد الطلبات' },
                { key: 'RETURNS_MANAGE', title: 'إدارة المرتجعات', desc: 'معالجة الشحنات المرتجعة' },
                { key: 'POS_VIEW', title: 'عرض الكاشير (POS)', desc: 'واجهة البيع المباشر' },
                { key: 'POS_MANAGE', title: 'إتمام البيع المباشر', desc: 'إصدار فواتير وقبض نقدية' },
                { key: 'PRODUCTS_VIEW', title: 'عرض المنتجات والأسعار', desc: 'الاطلاع على المخزون والأسعار' },
                { key: 'PRODUCTS_MANAGE', title: 'تعديل وإضافة منتجات', desc: 'إضافة منتجات وتعديل الأسعار' },
                { key: 'INVENTORY_MANAGE', title: 'الجرد والمستودعات', desc: 'تسوية الجرد والتحويلات' },
                { key: 'EXPENSES_MANAGE', title: 'إدارة المصروفات', desc: 'تسجيل وبحث المصروفات' },
                { key: 'WALLET_VIEW', title: 'عرض المحفظة والخزينة', desc: 'الاطلاع على حركة المحفظة' },
                { key: 'CUSTOMERS_VIEW', title: 'عرض العملاء', desc: 'سجل بيانات العملاء' },
                { key: 'SETTINGS_VIEW', title: 'عرض الإعدادات', desc: 'الاطلاع على إعدادات المتجر' },
              ].map(perm => {
                const isChecked = selectedSystemPermissions.includes(perm.key as Permission);
                return (
                  <button
                    key={perm.key}
                    type="button"
                    onClick={() => toggleSystemPermission(perm.key as Permission)}
                    className={`p-3 rounded-2xl border text-right transition-all flex items-start justify-between gap-2 cursor-pointer ${
                      isChecked 
                        ? 'bg-emerald-50/80 border-[#008060] text-emerald-950 shadow-xs ring-1 ring-[#008060]' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="font-black text-xs">{perm.title}</div>
                      <div className="text-[10px] text-slate-500 leading-tight mt-0.5">{perm.desc}</div>
                    </div>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 border ${
                      isChecked ? 'bg-[#008060] border-[#008060] text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {isChecked && <Check size={12} strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 flex-wrap gap-2">
          <span className="text-xs font-bold text-slate-500">
            {activeTab === 'portal' ? 'تم ضبط صلاحيات بوابته والتقارير' : `تم تحديد ${selectedSystemPermissions.length} صلاحية نظام`}
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black cursor-pointer shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span>حفظ وتطبيق الصلاحيات والتقارير فوراً</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
