import React, { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { User, Store, StoreData, Employee, Permission, PERMISSIONS, Transaction, WithdrawRequest, Settings, SupportAppeal, SupportTicketMessage } from '../types';
import { INITIAL_SETTINGS } from '../constants';
import { createUserDoc } from '../services/databaseService';
import { cfAuthCreateUser, cfFetch } from '../services/cloudflareClient';
import { 
    Users, Store as StoreIcon, Activity, Search, ShieldAlert, LogIn, Ban, CheckCircle, 
    Lock, Unlock, LayoutDashboard, TrendingUp, MessageSquare, Send, UserPlus, Clock, 
    UserCog, XCircle, KeyRound, Check, X, Settings as SettingsIcon, ShoppingCart, 
    Package, Wallet, Tag, AlertTriangle, Trash2, ShoppingBasket, Grid, Copy, Plus, 
    ArrowLeftRight, AlertCircle, RefreshCw, UserMinus, Wrench, Save,
    Database, Mail, Globe, CloudUpload, CloudDownload, CreditCard, Smartphone, Banknote,
    Headphones, PhoneCall
} from 'lucide-react';
import * as db from '../services/databaseService';
import { clearStoreData } from '../services/databaseService';
import { inAppConfirm, inAppAlert } from '../utils/inAppAlert';
import UserMigrationCenter from './UserMigrationCenter';
import AdminSupportCenter from './AdminSupportCenter';
import { buildNormalizedTicketMessages } from './SuspendedAccountSupportScreen';
import {
    fetchPlatformSupportConfig,
    saveProjectWideSupportConfig,
    getCachedPlatformSupportPhone,
    getCachedPlatformSupportAgent,
    buildSupportWhatsAppUrl
} from '../utils/platformSupport';
import { DEFAULT_MONEYHASH_CONFIG, createMoneyHashAccount } from '../utils/moneyHashService';
import { 
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, 
    Cell, PieChart, Pie, Legend, CartesianGrid 
} from 'recharts';

// Financial requests tab with custom copy clipboard actions and layout
const FinancialRequestsTab: React.FC<{
    allStoresData: Record<string, StoreData>;
    setAllStoresData: React.Dispatch<React.SetStateAction<Record<string, StoreData>>>;
    users: User[];
}> = ({ allStoresData, setAllStoresData, users }) => {
    
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [filterType, setFilterType] = useState<'all' | 'deposit' | 'withdraw' | 'compensation'>('all');

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500);
    };

    // Sort logic to get pending deposits, withdrawals, and shipping compensation claims
    const requests = useMemo(() => {
        let reqs: any[] = [];
        Object.entries(allStoresData).forEach(([storeId, storeData]) => {
            const owner = users.find(u => u.stores?.some(s => s.id === storeId));
            const storeInfo = owner?.stores?.find(s => s.id === storeId);
            if (!owner || !storeInfo) return;
            
            storeData.wallet?.transactions?.forEach(t => {
                if (t.status === 'pending') {
                    // Skip withdrawal fee transactions as they are processed with the main withdrawal
                    if (t.id.startsWith('WF-')) return;

                    // if it's a withdrawal, find the withdraw request to get bank details
                    let details = t.note || 'لا توجد تفاصيل';
                    if (t.type === 'سحب') {
                        const reqId = t.id.startsWith('W-') ? t.id.substring(2) : t.id;
                        const wReq = storeData.wallet?.withdrawRequests?.find(r => r?.id === reqId);
                        if (wReq) details = wReq.details || details;
                    }
                    reqs.push({
                        ...t,
                        storeId,
                        storeName: storeInfo.name,
                        ownerName: owner.fullName,
                        details
                    });
                }
            });
        });

        const sorted = reqs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        if (filterType === 'compensation') return sorted.filter(r => r.category === 'shipping_compensation');
        if (filterType === 'deposit') return sorted.filter(r => r.type === 'إيداع' && r.category !== 'shipping_compensation');
        if (filterType === 'withdraw') return sorted.filter(r => r.type === 'سحب');
        return sorted;
    }, [allStoresData, users, filterType]);

    const handleAction = async (transaction: any, action: 'approve' | 'reject') => {
        const storeId = transaction.storeId;
        
        // Prepare updated store data
        let storeData = { ...allStoresData[storeId] };
        if (!storeData || !storeData.wallet) return;

        // update transaction
        const reqId = transaction.id.startsWith('W-') ? transaction.id.substring(2) : null;
        const feeTxId = reqId ? `WF-${reqId}` : null;

        const updatedTransactions = storeData.wallet.transactions.map(t => {
             if (t.id === transaction.id || (feeTxId && t.id === feeTxId)) {
                  return { ...t, status: action === 'approve' ? 'completed' : 'cancelled' };
             }
             return t;
        });

        // if withdrawal, update withdraw request too
        let updatedWithdrawRequests = storeData.wallet.withdrawRequests || [];
        if (transaction.type === 'سحب') {
             const actualReqId = reqId || transaction.id.replace('W-', '');
             updatedWithdrawRequests = updatedWithdrawRequests.map(r => {
                 if (r.id === actualReqId) {
                     return { ...r, status: action === 'approve' ? 'accepted' : 'rejected' };
                 }
                 return r;
             });
        }

        let newBalance = storeData.wallet.balance || 0;
        if (transaction.type === 'إيداع') {
             if (action === 'approve') newBalance += transaction.amount;
        } else if (transaction.type === 'سحب') {
             if (action === 'reject') {
                 newBalance += transaction.amount;
                 // If there was a fee transaction, return it to balance too
                 if (feeTxId) {
                     const feeTx = storeData.wallet.transactions.find(t => t.id === feeTxId);
                     if (feeTx && feeTx.status === 'pending') {
                         newBalance += feeTx.amount;
                     }
                 }
             }
        }

        // If this is a shipping_compensation claim linked to an order, update the order's compensationStatus too
        let updatedOrders = storeData.orders || [];
        if (transaction.category === 'shipping_compensation' && transaction.orderId) {
            updatedOrders = updatedOrders.map(o => {
                if (o.id === transaction.orderId) {
                    return {
                        ...o,
                        compensationStatus: action === 'approve' ? 'compensated' : 'rejected',
                        compensationDate: action === 'approve' ? new Date().toISOString().split('T')[0] : (o as any).compensationDate,
                        compensationTreasuryAccountId: action === 'approve' ? 'central_wallet' : undefined
                    } as any;
                }
                return o;
            });
        }

        const newStoreData = {
            ...storeData,
            orders: updatedOrders,
            wallet: {
                ...storeData.wallet,
                transactions: updatedTransactions as Transaction[],
                withdrawRequests: updatedWithdrawRequests as WithdrawRequest[],
                balance: newBalance
            }
        };

        setAllStoresData(prev => ({
            ...prev,
            [storeId]: newStoreData
        }));

        try {
            await db.saveStoreData({ id: storeId, name: (storeData.settings as any)?.storeName || 'المتجر' } as any, newStoreData);
        } catch (e) {
            alert('حدث خطأ أثناء الحفظ.');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border dark:border-slate-800 flex-wrap gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-slate-700 dark:text-slate-300">عرض المعاملات المعلقة بقيمة:</span>
                    <div className="flex bg-white dark:bg-slate-900 border dark:border-slate-800 p-1 rounded-xl flex-wrap gap-1">
                        <button 
                            onClick={() => setFilterType('all')} 
                            className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all ${filterType === 'all' ? 'bg-slate-800 dark:bg-slate-700 text-white' : 'text-slate-400'}`}
                        >الجميع ({requests.length})</button>
                        <button 
                            onClick={() => setFilterType('deposit')} 
                            className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all ${filterType === 'deposit' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
                        >شحن رصيد ({requests.filter(r => r.type === 'إيداع' && r.category !== 'shipping_compensation').length})</button>
                        <button 
                            onClick={() => setFilterType('withdraw')} 
                            className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all ${filterType === 'withdraw' ? 'bg-red-600 text-white' : 'text-slate-400'}`}
                        >سحب كاش ({requests.filter(r => r.type === 'سحب').length})</button>
                        <button 
                            onClick={() => setFilterType('compensation')} 
                            className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all ${filterType === 'compensation' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}
                        >مطالبات تعويض الشحن ({requests.filter(r => r.category === 'shipping_compensation').length})</button>
                    </div>
                </div>
            </div>

            {requests.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-dashed dark:border-slate-800">
                    <Activity className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={44} />
                    <p className="text-slate-500 font-bold">لا توجد طلبات مالية معلقة للقرار الحالي.</p>
                </div>
            ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                            <tr>
                                <th className="p-4 rounded-r-xl">النوع</th>
                                <th className="p-4">المتجر / المالك</th>
                                <th className="p-4">المبلغ من العملية</th>
                                <th className="p-4">تفاصيل وعنوان التحويل للتسوية</th>
                                <th className="p-4">تاريخ التقديم</th>
                                <th className="p-4 rounded-l-xl text-center">الإجراءات والقرار</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {requests.map((req, idx) => (
                                <tr key={`${req.id}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all font-sans antialiased text-xs">
                                    <td className="p-4">
                                        <span className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 w-max ${req.type === 'إيداع' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50' : 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50'}`}>
                                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                            {req.type}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <p className="font-bold text-slate-800 dark:text-white text-sm font-sans">{req.storeName}</p>
                                        <p className="text-[10px] text-slate-500">{req.ownerName}</p>
                                    </td>
                                    <td className="p-4 font-black text-slate-900 dark:text-white text-sm">
                                        {(req.amount ?? 0).toLocaleString()} ج.م
                                    </td>
                                    <td className="p-4 max-w-xs">
                                        <div className="flex items-center gap-2">
                                            <p className="text-slate-600 dark:text-slate-300 font-bold truncate" title={req.details}>
                                                {req.details}
                                            </p>
                                            <button 
                                                onClick={() => handleCopy(req.details, req.id)}
                                                className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg shrink-0 transition-all"
                                                title="نسخ التفاصيل"
                                            >
                                                {copiedId === req.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="p-4 text-slate-400">
                                        {new Date(req.date).toLocaleString('ar-EG')}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex gap-2 justify-center">
                                            <button 
                                                onClick={() => handleAction(req, 'approve')} 
                                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all flex items-center gap-1 shadow-sm active:scale-95" 
                                                title="اعتماد وإتمام"
                                            >
                                                <Check size={14}/>
                                                <span>قبول طلب</span>
                                            </button>
                                            <button 
                                                onClick={() => handleAction(req, 'reject')} 
                                                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-all flex items-center gap-1 shadow-sm active:scale-95" 
                                                title="رفض"
                                            >
                                                <X size={14}/>
                                                <span>رفض</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

interface AdminPageProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  allStoresData: Record<string, StoreData>;
  setAllStoresData: React.Dispatch<React.SetStateAction<Record<string, StoreData>>>;
  onImpersonate: (user: User, targetStoreId?: string) => void;
  currentUser: User;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

const PERMISSION_GROUPS: { title: string; permissions: { key: Permission, label: string }[] }[] = [
  { title: 'الأوردرات والتحكم', permissions: [ { key: 'ORDERS_VIEW', label: 'عرض الأوردرات فقط' }, { key: 'ORDERS_MANAGE', label: 'إدارة كاملة للأوردرات (إضافة، تعديل، حذف)' } ] },
  { title: 'المنتجات والمخزون', permissions: [ { key: 'PRODUCTS_VIEW', label: 'عرض المنتجات فقط' }, { key: 'PRODUCTS_MANAGE', label: 'إدارة كاملة للمنتجات' } ] },
  { title: 'البيانات المالية', permissions: [ { key: 'DASHBOARD_VIEW', label: 'عرض لوحة التحكم والإحصائيات' }, { key: 'WALLET_VIEW', label: 'عرض المحفظة والعمليات' }, { key: 'WALLET_MANAGE', label: 'إجراء عمليات يدوية بالمحفظة' } ] },
  { title: 'إعدادات المتجر', permissions: [ { key: 'SETTINGS_VIEW', label: 'عرض الإعدادات فقط' }, { key: 'SETTINGS_MANAGE', label: 'تعديل كافة إعدادات المتجر' } ] },
];

const UserPermissionsModal: React.FC<{
    user: User;
    onClose: () => void;
    allStoresData: Record<string, StoreData>;
    setAllStoresData: React.Dispatch<React.SetStateAction<Record<string, StoreData>>>;
    users: User[];
}> = ({ user, onClose, allStoresData, setAllStoresData, users }) => {

    const [editingEmployee, setEditingEmployee] = useState<{ store: Store, employee: Employee } | null>(null);

    const handlePermissionChange = (permission: Permission, isChecked: boolean) => {
        if (!editingEmployee) return;

        const { store, employee } = editingEmployee;
        const newPermissions = isChecked
            ? [...employee.permissions, permission]
            : employee.permissions.filter(p => p !== permission);
        
        const updatedEmployee = { ...employee, permissions: newPermissions };
        setEditingEmployee({ store, employee: updatedEmployee });

        setAllStoresData(prevData => {
            const storeData = prevData[store.id];
            if (!storeData) return prevData;

            const updatedStoreData: StoreData = {
                ...storeData,
                settings: {
                    ...storeData.settings,
                    employees: (storeData.settings.employees || []).map(e => e.id === employee.id ? updatedEmployee : e)
                }
            };

            db.saveStoreData(store, updatedStoreData).catch(err => {
                console.warn('Failed saving employee permissions to D1:', err);
            });

            return {
                ...prevData,
                [store.id]: updatedStoreData
            };
        });
    };
    
    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] text-right border border-slate-300 dark:border-slate-800">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-xl font-black dark:text-white flex items-center gap-3">
                        <UserCog className="text-purple-600" /> إدارة صلاحيات موظفي التاجر: {user.fullName}
                    </h3>
                    <button onClick={onClose}><XCircle className="text-slate-400 hover:text-red-500"/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Stores & Employees Column */}
                    <div className="space-y-4">
                        <h4 className="font-bold text-slate-850 dark:text-slate-250">متاجر وموظفي التاجر</h4>
                        {(user.stores || []).length > 0 ? (user.stores || []).map(store => (
                            <div key={store.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
                                <h5 className="font-bold text-lg text-slate-850 dark:text-white flex items-center gap-2">
                                    <StoreIcon className="text-indigo-500" size={16} />
                                    {store.name}
                                </h5>
                                <div className="mt-2 space-y-2">
                                    {(allStoresData[store.id]?.settings?.employees || []).length > 0 ? (
                                        (allStoresData[store.id]?.settings.employees || []).map(employee => (
                                            <button 
                                                key={employee.id}
                                                type="button"
                                                onClick={() => setEditingEmployee({ store, employee })}
                                                className={`w-full text-right p-3 rounded-xl flex items-center gap-3 transition-all border ${editingEmployee?.employee.id === employee.id ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-900' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                            >
                                                <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-black">{(employee.name || "").substring(0,2)}</div>
                                                <div className="flex-1">
                                                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{employee.name}</p>
                                                    <p className="text-[10px] text-slate-500">{employee.email}</p>
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <p className="text-slate-400 text-xs py-2">لا يوجد موظفين مضافين لهذا المتجر حتى الآن.</p>
                                    )}
                                </div>
                            </div>
                        )) : <p className="text-slate-500 font-bold">هذا المستخدم لا يملك أي متاجر نشطة.</p>}
                    </div>

                    {/* Permissions Column */}
                    <div className={`p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-850 transition-all ${!editingEmployee ? 'opacity-50' : ''}`}>
                       {editingEmployee ? (
                            <div className="space-y-4">
                               <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-2 pb-2 border-b dark:border-slate-800">
                                   صلاحيات الموظف: <span className="text-indigo-600 dark:text-indigo-400 font-black">{editingEmployee.employee.name}</span>
                               </h4>
                               <div className="grid grid-cols-1 gap-6">
                                  {PERMISSION_GROUPS.map(group => (
                                      <div key={group.title} className="space-y-2">
                                          <h5 className="font-black text-xs text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">{group.title}</h5>
                                          <div className="space-y-1.5">
                                              {group.permissions.map(perm => {
                                                  const hasPerm = editingEmployee.employee.permissions.includes(perm.key);
                                                  return (
                                                      <label key={perm.key} className={`flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border cursor-pointer transition-all ${hasPerm ? 'border-purple-300 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/10' : 'border-slate-200 dark:border-slate-800'}`}>
                                                          <input 
                                                              type="checkbox" 
                                                              checked={hasPerm} 
                                                              onChange={e => handlePermissionChange(perm.key, e.target.checked)} 
                                                              className="rounded text-purple-600 focus:ring-purple-500"
                                                          />
                                                          <span className="font-bold text-xs text-slate-700 dark:text-slate-300">{perm.label}</span>
                                                      </label>
                                                  );
                                              })}
                                          </div>
                                      </div>
                                  ))}
                               </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
                                <UserCog size={52} className="mb-3 text-slate-300 dark:text-slate-705" />
                                <p className="font-bold text-center">اختر موظفاً من متاجر التاجر للتعديل أو إدارة صلاحياته هنا.</p>
                            </div>
                        )}
                    </div>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-8 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-2xl font-black">إغلاق</button>
                </div>
            </div>
        </div>
    );
};

type AdminTab = 'dashboard' | 'exclusive_controls' | 'users' | 'user_migration' | 'stores' | 'financial' | 'fee_settings' | 'infrastructure' | 'support' | 'danger_zone';
const VALID_ADMIN_TABS: AdminTab[] = ['dashboard', 'exclusive_controls', 'users', 'user_migration', 'stores', 'financial', 'fee_settings', 'infrastructure', 'support', 'danger_zone'];

const AdminPage: React.FC<AdminPageProps> = ({ users, setUsers, allStoresData, setAllStoresData, onImpersonate, currentUser, settings, setSettings }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as AdminTab | null;
  const initialTab: AdminTab = tabParam && VALID_ADMIN_TABS.includes(tabParam) ? tabParam : 'dashboard';
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
  const storeIdParam = searchParams.get('storeId') || undefined;

  useEffect(() => {
    const nextTab = searchParams.get('tab') as AdminTab | null;
    if (nextTab && VALID_ADMIN_TABS.includes(nextTab)) {
      setActiveTab(nextTab);
    } else if (!nextTab) {
      setActiveTab('dashboard');
    }
    const nextSearch = searchParams.get('search');
    if (nextSearch !== null) {
      setSearchTerm(nextSearch);
    }
  }, [searchParams]);

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    if (tab !== 'danger_zone' && tab !== 'support' && tab !== 'exclusive_controls') {
      next.delete('storeId');
    }
    setSearchParams(next, { replace: true });
  };
  
  // Custom Platform broad Announcement Types (persisted in Cloudflare D1 + local cache)
  const [announcementText, setAnnouncementText] = useState(() => localStorage.getItem('platform_announcement_text') || '');
  const [announcementType, setAnnouncementType] = useState(() => localStorage.getItem('platform_announcement_type') || 'info');

  useEffect(() => {
    void cfFetch<{ success?: boolean; value?: { text?: string; type?: string } | null }>(
      '/api/db/settings/platform_announcement'
    ).then((res) => {
      if (res?.value && typeof res.value === 'object') {
        const nextText = res.value.text || '';
        const nextType = res.value.type || 'info';
        setAnnouncementText(nextText);
        setAnnouncementType(nextType);
        try {
          if (nextType === 'none' || !nextText) {
            localStorage.removeItem('platform_announcement_text');
            localStorage.setItem('platform_announcement_type', nextType);
          } else {
            localStorage.setItem('platform_announcement_text', nextText);
            localStorage.setItem('platform_announcement_type', nextType);
          }
        } catch {}
      }
    }).catch(() => {});
  }, []);
  
  const [managingUser, setManagingUser] = useState<User | null>(null);
  const [isLoadingAllStores, setIsLoadingAllStores] = useState(false);

  // States for Adding New User
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserData, setNewUserData] = useState({ fullName: '', phone: '', email: '', password: 'password123', isAdmin: false });
  const [addUserError, setAddUserError] = useState('');

  // States for Adding New Store
  const [showAddStoreModal, setShowAddStoreModal] = useState(false);
  const [newStoreData, setNewStoreData] = useState({ name: '', url: '', ownerPhone: '', specialization: 'عام' });
  const [addStoreError, setAddStoreError] = useState('');

  // Wallet manual Adjustments
  const [adjustingStoreWallet, setAdjustingStoreWallet] = useState<{ id: string, name: string } | null>(null);
  const [adjustmentDetails, setAdjustmentDetails] = useState({ amount: '', type: 'deposit' as 'deposit' | 'withdraw', note: '' });
  const [adjustError, setAdjustError] = useState('');

  // Reload or Fetch everything from cloud servers
  useEffect(() => {
    let isMounted = true;
    const fetchAllData = async () => {
      setIsLoadingAllStores(true);
      try {
        let targetUsers = users;
        if (targetUsers.length <= 1) {
          const remoteUsers = await db.getAllUsers().catch(() => null);
          if (remoteUsers && remoteUsers.length > 0 && isMounted) {
            targetUsers = remoteUsers;
            setUsers(remoteUsers);
          }
        }

        const storeIds: string[] = [];
        targetUsers.forEach(u => {
          u.stores?.forEach(s => {
            if (s.id && !storeIds.includes(s.id)) {
              storeIds.push(s.id);
            }
          });
        });

        const validSet = new Set(storeIds);

        // Clean any stale deleted store IDs from localStorage
        try {
          const savedLast = localStorage.getItem('lastActiveStoreId');
          if (savedLast && !validSet.has(savedLast)) {
            localStorage.removeItem('lastActiveStoreId');
          }
          const savedDef = localStorage.getItem('defaultStoreId');
          if (savedDef && !validSet.has(savedDef)) {
            localStorage.removeItem('defaultStoreId');
          }
        } catch {}

        if (storeIds.length === 0) {
          if (isMounted) setAllStoresData({});
          return;
        }

        // Fetch each store's data in parallel from Cloudflare D1
        const promises = storeIds.map(async (id) => {
          try {
            const data = await db.getStoreData(id, true); // true to force remote
            return { id, data };
          } catch (e) {
            console.error(`Error loading store ${id}:`, e);
            return null;
          }
        });

        const results = await Promise.all(promises);
        if (!isMounted) return;

        setAllStoresData(prev => {
          // Prune any orphaned/deleted store keys that do not belong to active users
          const next: Record<string, StoreData> = {};
          storeIds.forEach(id => {
            if (prev[id]) next[id] = prev[id];
          });
          results.forEach(res => {
            if (res && res.data && validSet.has(res.id)) {
              next[res.id] = res.data;
            }
          });
          return next;
        });
      } catch (error) {
        console.error("Error loading all stores for Admin:", error);
      } finally {
        if (isMounted) {
          setIsLoadingAllStores(false);
        }
      }
    };

    fetchAllData();
    return () => {
      isMounted = false;
    };
  }, [users.length, setAllStoresData, setUsers]);

  // Valid Store IDs strictly belonging to existing platform users
  const validStoreIds = useMemo(() => {
    const ids = new Set<string>();
    users.forEach(u => {
      u.stores?.forEach(s => {
        if (s?.id) ids.add(s.id);
      });
    });
    return ids;
  }, [users]);

  const getOrderCollectedAmount = (order: any): number => {
    const prod = Number(order?.productPrice ?? 0);
    const ship = Number(order?.shippingFee ?? 0);
    const disc = Number(order?.discount ?? 0);
    const calc = (isNaN(prod) ? 0 : prod) + (isNaN(ship) ? 0 : ship) - (isNaN(disc) ? 0 : disc);
    if (calc > 0) return calc;
    const total = Number(order?.totalPrice ?? 0);
    return isNaN(total) ? 0 : Math.max(0, total);
  };

  const pendingRequestsCount = useMemo(() => {
    let count = 0;
    validStoreIds.forEach(storeId => {
      const storeData = allStoresData[storeId];
      storeData?.wallet?.transactions?.forEach((t: any) => {
        if (t?.status === 'pending' && !String(t?.id || '').startsWith('WF-')) {
          count++;
        }
      });
    });
    return count;
  }, [allStoresData, validStoreIds]);

  const pendingAppealsCount = useMemo(() => {
    let count = 0;
    users.forEach(u => {
      if (u.isBanned && u.supportAppeal?.status === 'pending') count++;
      (u.stores || []).forEach(s => {
        if (s.isBanned && s.supportAppeal?.status === 'pending') count++;
      });
    });
    return count;
  }, [users]);

  // Compute all stores list first so it's initialized before charts or stats reference it
  const allStoresList = useMemo(() => {
    let stores: { store: Store, owner: User, totalOrders: number, totalRevenue: number }[] = [];
    users.forEach(user => {
      if (user.stores) {
        user.stores.forEach(store => {
          const storeData = allStoresData[store.id];
          const orders = storeData?.orders || [];
          const totalOrders = orders.length;
          const rawRev = orders
            .filter((o: any) => o && o.status === 'تم_التحصيل')
            .reduce((sum: number, o: any) => sum + getOrderCollectedAmount(o), 0);
          const totalRevenue = Math.round(rawRev * 100) / 100;
          stores.push({ store, owner: user, totalOrders, totalRevenue });
        });
      }
    });
    const q = searchTerm.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter(s =>
      s.store.name.toLowerCase().includes(q) ||
      (s.store.url || '').toLowerCase().includes(q) ||
      (s.store.subdomain || '').toLowerCase().includes(q) ||
      s.owner.fullName.toLowerCase().includes(q) ||
      s.owner.phone.includes(q)
    );
  }, [users, searchTerm, allStoresData]);

  // Statistics summaries strictly across active stores owned by registered users
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalOrders = 0;
    let successfulOrders = 0;
    let totalPlatformWalletsBalance = 0;
    
    validStoreIds.forEach(storeId => {
      const storeData = allStoresData[storeId];
      if (!storeData) return;
      const orders = storeData.orders || [];
      totalOrders += orders.length;
      totalPlatformWalletsBalance += Number(storeData.wallet?.balance || 0);

      orders.forEach((order: any) => {
        if (order && order.status === 'تم_التحصيل') {
          totalRevenue += getOrderCollectedAmount(order);
          successfulOrders++;
        }
      });
    });

    totalRevenue = Math.round(totalRevenue * 100) / 100;
    totalPlatformWalletsBalance = Math.round(totalPlatformWalletsBalance * 100) / 100;

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const newUsersThisMonth = users.filter(u => u.joinDate && new Date(u.joinDate) >= firstDayOfMonth).length;
    const newStoresThisMonth = users.reduce((acc, user) => {
      return acc + (user.stores?.filter(s => new Date(s.creationDate) >= firstDayOfMonth).length || 0);
    }, 0);

    return { 
      totalUsers: users.length, 
      totalStores: validStoreIds.size, 
      activeUsers: users.filter(u => !u.isBanned).length,
      totalRevenue,
      averageOrderValue: successfulOrders > 0 ? totalRevenue / successfulOrders : 0,
      newUsersThisMonth,
      newStoresThisMonth,
      totalPlatformWalletsBalance
    };
  }, [users, allStoresData, validStoreIds]);

  // Dynamic charts generation strictly from active stores
  const chartsData = useMemo(() => {
    const storesRevenue = allStoresList.map(s => ({
      name: s.store.name,
      revenue: s.totalRevenue,
      orders: s.totalOrders
    })).sort((a, b) => b.revenue - a.revenue).slice(0, 6);

    let totalDelivered = 0;
    let totalReturned = 0;
    let totalPendingNew = 0;
    let totalProcessing = 0;
    let totalCancelled = 0;

    validStoreIds.forEach(storeId => {
      const storeData = allStoresData[storeId];
      if (!storeData) return;
      (storeData.orders || []).forEach((o: any) => {
        if (!o) return;
        if (o.status === 'تم_التحصيل' || o.status === 'مدفوعة') totalDelivered++;
        else if (o.status === 'مرتجع' || o.status === 'فشل_التوصيل') totalReturned++;
        else if (o.status === 'في_انتظار_المكالمة' || o.status === 'جاري_المراجعة') totalPendingNew++;
        else if (o.status === 'ملغي') totalCancelled++;
        else totalProcessing++;
      });
    });

    const statusDistribution = [
      { name: 'مكتمل وتحصيل', value: totalDelivered, color: '#10b981' },
      { name: 'مرتجع وفشل شحن', value: totalReturned, color: '#f43f5e' },
      { name: 'جديد ومعلق باتصال', value: totalPendingNew, color: '#06b6d4' },
      { name: 'جاري الشحن/التوصيل', value: totalProcessing, color: '#3b82f6' },
      { name: 'ملغي ومغلق', value: totalCancelled, color: '#64748b' }
    ].filter(item => item.value > 0);

    return { storesRevenue, statusDistribution };
  }, [allStoresList, allStoresData, validStoreIds]);

  const activityFeed = useMemo(() => {
      const activities: { type: string; data: any; date: Date }[] = [];
      users.forEach(user => {
          if (user.joinDate) {
              activities.push({ type: 'new_user', data: user, date: new Date(user.joinDate) });
          }
          user.stores?.forEach(store => {
              activities.push({ type: 'new_store', data: { store, owner: user }, date: new Date(store.creationDate) });
          });
      });
      return activities.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => 
      !user.isAdmin && 
      (user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone.includes(searchTerm))
    );
  }, [users, searchTerm]);

  const handleDeleteUser = async (user: User) => {
    const ok = await inAppConfirm(`هل أنت متأكد من حذف المستخدم ${user.fullName} وجميع متاجره؟ هذا الإجراء لا يمكن التراجع عنه.`, {
      title: 'حذف مستخدم وجميع متاجره',
      type: 'danger',
      confirmText: 'نعم، حذف المستخدم نهائياً',
      cancelText: 'إلغاء'
    });
    if (!ok) return;

    try {
        await db.deleteUserCompletely(user);
        const deletedStoreIds = (user.stores || []).map(s => s.id);
        
        // Remove from local state
        const updatedUsers = users.filter(u => u.phone !== user.phone);
        setUsers(updatedUsers);
        if (deletedStoreIds.length > 0) {
            setAllStoresData(prev => {
                const next = { ...prev };
                deletedStoreIds.forEach(sid => delete next[sid]);
                return next;
            });
            try {
                if (deletedStoreIds.includes(localStorage.getItem('lastActiveStoreId') || '')) {
                    localStorage.removeItem('lastActiveStoreId');
                }
                if (deletedStoreIds.includes(localStorage.getItem('defaultStoreId') || '')) {
                    localStorage.removeItem('defaultStoreId');
                }
            } catch {}
        }
        
        // Update global users list in Cloudflare D1
        await db.saveGlobalData({ users: updatedUsers, loyaltyData: {} });
        
        await inAppAlert(`تم حذف المستخدم ${user.fullName} وجميع متاجره بنجاح.`, { type: 'success' });
    } catch (e: any) {
        await inAppAlert(`خطأ أثناء حذف المستخدم: ${e.message}`, { type: 'error' });
    }
  };
  
  const toggleUserBan = async (phone: string) => {
    const targetUser = users.find(u => u.phone === phone);
    if (!targetUser) return;
    const nextBanned = !targetUser.isBanned;
    const ok = await inAppConfirm(
      nextBanned
        ? `هل أنت متأكد من حظر حساب التاجر "${targetUser.fullName}" وإيقاف دخوله إلى لوحة التحكم ومتاجره؟`
        : `هل أنت متأكد من فك الحظر عن حساب التاجر "${targetUser.fullName}" وإعادة تفعيله؟`,
      {
        title: nextBanned ? 'حظر حساب التاجر' : 'فك حظر حساب التاجر',
        type: nextBanned ? 'danger' : 'info',
        confirmText: nextBanned ? 'نعم، حظر الحساب فوراً' : 'نعم، فك الحظر',
        cancelText: 'تراجع'
      }
    );
    if (!ok) return;
    const updatedTarget: User = { ...targetUser, isBanned: nextBanned };
    const updated = users.map(u => u.phone === phone ? updatedTarget : u);
    setUsers(updated);
    try {
      await db.createUserDoc(updatedTarget);
      await db.saveGlobalData({ users: updated, loyaltyData: {} });
      await inAppAlert(
        nextBanned
          ? `تم حظر حساب التاجر "${targetUser.fullName}" بنجاح.`
          : `تم فك الحظر عن حساب التاجر "${targetUser.fullName}" بنجاح.`,
        { type: 'success' }
      );
    } catch (e) {
      await inAppAlert("فشل تحديث حالة الحظر على السيرفر العام.", { type: 'error' });
    }
  };

  const toggleStoreBan = async (owner: User, store: Store) => {
    const nextBanned = !store.isBanned;
    const ok = await inAppConfirm(
      nextBanned
        ? `هل أنت متأكد من إيقاف وحظر متجر "${store.name}"؟ سيظهر للتاجر وللعملاء أن المتجر موقوف إدارياً.`
        : `هل أنت متأكد من إعادة تفعيل وفك حظر متجر "${store.name}"؟`,
      {
        title: nextBanned ? 'حظر وإيقاف متجر' : 'إعادة تفعيل متجر',
        type: nextBanned ? 'danger' : 'info',
        confirmText: nextBanned ? 'نعم، حظر المتجر' : 'نعم، تفعيل المتجر',
        cancelText: 'تراجع'
      }
    );
    if (!ok) return;

    const updatedOwner: User = {
      ...owner,
      stores: (owner.stores || []).map(s => s.id === store.id ? { ...s, isBanned: nextBanned } : s)
    };
    const updatedUsers = users.map(u => u.phone === owner.phone ? updatedOwner : u);
    setUsers(updatedUsers);

    try {
      await db.createUserDoc(updatedOwner);
      await db.saveGlobalData({ users: updatedUsers, loyaltyData: {} });
      await inAppAlert(
        nextBanned
          ? `تم حظر وإيقاف متجر "${store.name}" بنجاح.`
          : `تم فك الحظر وإعادة تفعيل متجر "${store.name}" بنجاح.`,
        { type: 'success' }
      );
    } catch {
      await inAppAlert('تعذر حفظ حالة حظر المتجر على السيرفر السحابي.', { type: 'error' });
    }
  };

  // Trigger real persistent announcement (Cloudflare D1 + local fallback)
  const handleSaveAnnouncement = async () => {
    if (announcementType === 'none') {
        localStorage.removeItem('platform_announcement_text');
        localStorage.setItem('platform_announcement_type', 'none');
        setAnnouncementText('');
        try {
          await cfFetch('/api/db/settings/platform_announcement', {
            method: 'PUT',
            body: JSON.stringify({ value: { text: '', type: 'none', updatedAt: new Date().toISOString() } })
          });
        } catch {}
        window.dispatchEvent(new Event('storage'));
        await inAppAlert('تم إلغاء وحذف الإعلان المنشور بالكامل سحابياً بنجاح.', { type: 'success' });
    } else {
        if (!announcementText.trim()) {
            await inAppAlert('من فضلك اكتب نص الإعلان أولاً.', { type: 'warning' });
            return;
        }
        const trimmed = announcementText.trim();
        localStorage.setItem('platform_announcement_text', trimmed);
        localStorage.setItem('platform_announcement_type', announcementType);
        localStorage.removeItem('platform_announcement_dismissed'); // reset dismissed flag for everyone
        try {
          await cfFetch('/api/db/settings/platform_announcement', {
            method: 'PUT',
            body: JSON.stringify({ value: { text: trimmed, type: announcementType, updatedAt: new Date().toISOString() } })
          });
        } catch {}
        window.dispatchEvent(new Event('storage'));
        await inAppAlert(`تم بث ونشر الإعلان العام سحابياً بنجاح من المستوى [${announcementType}]!`, { type: 'success' });
    }
  };

  // Manual New User Merchant Registration
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUserError('');
    if (!newUserData.fullName || !newUserData.phone || !newUserData.email) {
        setAddUserError('يجب تعبئة حقول الاسم والهاتف والبريد الإلكتروني.');
        return;
    }
    
    // Check duplication
    const phoneExists = users.some(u => u.phone.trim() === newUserData.phone.trim());
    if (phoneExists) {
        setAddUserError('هذا الرقم مسجل مسبقاً لمستخدم آخر.');
        return;
    }

    let newUser: User = {
        fullName: newUserData.fullName,
        phone: newUserData.phone.trim(),
        email: newUserData.email,
        isAdmin: newUserData.isAdmin,
        isBanned: false,
        joinDate: new Date().toISOString(),
        stores: []
    };

    try {
        const res = await cfAuthCreateUser({
            fullName: newUserData.fullName,
            phone: newUserData.phone.trim(),
            email: newUserData.email,
            password: newUserData.password || 'password123',
            isAdmin: newUserData.isAdmin
        });
        if (res?.user) newUser = res.user;
    } catch (err: any) {
        setAddUserError(`فشل في إنشاء الحساب في نظام المصادقة: ${err.message}`);
        return;
    }

    const success = await createUserDoc(newUser);
    if (!success) {
        setAddUserError('فشل في إنشاء وثيقة المستخدم في قاعدة البيانات.');
        return;
    }

    const updatedUsersList = [...users, newUser];
    setUsers(updatedUsersList);

    try {
        setShowAddUserModal(false);
        setNewUserData({ fullName: '', phone: '', email: '', password: 'password123', isAdmin: false });
        await inAppAlert('تم تسجيل التاجر/المستخدم الجديد بنجاح على خادم المنصة الرئيسي.', { type: 'success' });
    } catch (e: any) {
        setAddUserError(`خطأ أثناء الحفظ بالسيرفر السحابي: ${e.message}`);
    }
  };

  // Manual Store Creation and Attribution
  const handleAddStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddStoreError('');
    if (!newStoreData.name || !newStoreData.url || !newStoreData.ownerPhone) {
        setAddStoreError('يجب تعبئة حقول اسم المتجر، الرابط، واختيار المالك مسؤول المتجر.');
        return;
    }

    const selectedOwner = users.find(u => u.phone === newStoreData.ownerPhone);
    if (!selectedOwner) {
        setAddStoreError('المالك المحدد غير موجود بالنظام.');
        return;
    }

    const newStoreId = `store-${Math.floor(100000 + Math.random() * 900000)}`;
    const newStoreObj: Store = {
        id: newStoreId,
        name: newStoreData.name,
        url: newStoreData.url.trim(),
        creationDate: new Date().toISOString(),
        specialization: newStoreData.specialization,
        language: 'ar',
        currency: 'ج.م'
    };

    // Update global users list
    const updatedUsers = users.map(u => {
        if (u.phone === selectedOwner.phone) {
            return {
                ...u,
                stores: [...(u.stores || []), newStoreObj]
            };
        }
        return u;
    });

    // Default template data for the store
    const newStoreDataPayload: StoreData = {
        orders: [],
        settings: {
            ...INITIAL_SETTINGS,
            storeName: newStoreData.name,
            storeWebUrl: newStoreData.url,
            supportPhone: getCachedPlatformSupportPhone(selectedOwner.phone || '01000000000'),
            products: []
        } as any,
        wallet: {
            balance: 0,
            transactions: [],
            withdrawRequests: []
        },
        cart: [],
        customers: []
    };

    try {
        // Save store config document
        await db.saveStoreData(newStoreObj, newStoreDataPayload);
        // Save global user index changes
        await db.saveGlobalData({ users: updatedUsers, loyaltyData: {} });

        // Update react state
        setUsers(updatedUsers);
        setAllStoresData(prev => ({
            ...prev,
            [newStoreId]: newStoreDataPayload
        }));

        setShowAddStoreModal(false);
        setNewStoreData({ name: '', url: '', ownerPhone: '', specialization: 'عام' });
        await inAppAlert(`تم تجهيز وتخصيص المتجر الجديد [${newStoreObj.name}] بنجاح، وربطه بالتاجر: ${selectedOwner.fullName}`, { type: 'success' });
    } catch (err: any) {
        setAddStoreError(`فشل في بناء المتجر سحابياً: ${err.message}`);
    }
  };

  // Handle Adjustment of Balance
  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError('');
    if (!adjustingStoreWallet) return;

    const amountNum = parseFloat(adjustmentDetails.amount);
    if (!amountNum || amountNum <= 0) {
        setAdjustError('يجب إدخال مبلغ صحيح أكبر من الصفر.');
        return;
    }

    const storeId = adjustingStoreWallet.id;
    const storeInfo = allStoresData[storeId];
    if (!storeInfo) {
        setAdjustError('بيانات المتجر غير متوفرة محلياً للمزامنة.');
        return;
    }

    const currentBalance = storeInfo.wallet?.balance || 0;
    const isDeposit = adjustmentDetails.type === 'deposit';

    if (!isDeposit && amountNum > currentBalance) {
        setAdjustError(`المبلغ المراد خصمه يدوياً أكبر من رصيد محفظة المتجر الحالي وهو (${(currentBalance ?? 0).toLocaleString()} ج.م)`);
        return;
    }

    const newTxId = `MANUAL-${Math.floor(100000 + Math.random() * 900000)}`;
    const newTx: Transaction = {
        id: newTxId,
        amount: amountNum,
        type: isDeposit ? 'إيداع' : 'سحب',
        category: 'wallet_charge',
        status: 'completed',
        date: new Date().toISOString(),
        note: adjustmentDetails.note.trim() || 'تسوية حساب يدوية بواسطة المدير العام للبلاتفورم'
    };

    const newBalance = isDeposit ? currentBalance + amountNum : currentBalance - amountNum;

    // Build the updated store profile
    const updatedStorePayload: StoreData = {
        ...storeInfo,
        wallet: {
            ...storeInfo.wallet,
            balance: newBalance,
            transactions: [newTx, ...(storeInfo.wallet?.transactions || [])]
        }
    };

    try {
        await db.saveStoreData({ id: storeId, name: adjustingStoreWallet.name } as any, updatedStorePayload);
        
        setAllStoresData(prev => ({
            ...prev,
            [storeId]: updatedStorePayload
        }));

        setAdjustingStoreWallet(null);
        setAdjustmentDetails({ amount: '', type: 'deposit', note: '' });
        await inAppAlert(`تمت تسوية الحساب اليدوي للمتجر [${adjustingStoreWallet.name}] بنجاح. الرصيد الجديد: ${(newBalance ?? 0).toLocaleString()} ج.م`, { type: 'success' });
    } catch (err: any) {
        setAdjustError(`خطأ في مزامنة الرصيد مع الباك اند: ${err.message}`);
    }
  };
  
  const timeSince = (date: Date) => {
      const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
      let interval = seconds / 31536000;
      if (interval > 1) return `منذ ${Math.floor(interval)} سنة`;
      interval = seconds / 2592000;
      if (interval > 1) return `منذ ${Math.floor(interval)} شهر`;
      interval = seconds / 86400;
      if (interval > 1) return `منذ ${Math.floor(interval)} يوم`;
      interval = seconds / 3600;
      if (interval > 1) return `منذ ${Math.floor(interval)} ساعة`;
      interval = seconds / 60;
      if (interval > 1) return `منذ ${Math.floor(interval)} دقيقة`;
      return "الآن";
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 font-cairo text-right" dir="rtl">
      
      {/* Central Platform Header */}
      <div className="flex justify-between items-center mb-8 border-b dark:border-slate-850 pb-6 flex-wrap gap-4">
        <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3 flex-wrap">
                <ShieldAlert className="text-red-650 animate-pulse" size={32} />
                لوحة التحكم المركزية السحابية
                {isLoadingAllStores && (
                  <span className="text-xs font-sans bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold px-3 py-1.5 rounded-xl animate-pulse flex items-center gap-1.5 antialiased border border-indigo-100 dark:border-indigo-900/50">
                    <Clock size={12} className="animate-spin" />
                    جاري مزامنة الحركات المالية الميدانية مع السيرفر السحابي المباشر...
                  </span>
                )}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1.5 font-bold">مرحباً بك، المشرف العام {currentUser?.fullName || ''}</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
            <Link
                to="/admin/manage-stores"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black shadow-sm transition-all active:scale-95"
            >
                <StoreIcon size={16} />
                <span>إدارة متاجر المنصة</span>
            </Link>
        </div>
      </div>

      {/* Tabs list with horizontal scroll styling to handle overflowing elegantly */}
      <div className="flex gap-3 mb-8 overflow-x-auto pb-2 scrollbar-none antialiased">
        <TabButton label="نظرة عامة والتحليلات" icon={<LayoutDashboard size={18}/>} active={activeTab === 'dashboard'} onClick={() => handleTabChange('dashboard')} />
        <TabButton label="🛡️ الصلاحيات الحصرية والرقابة المالية" icon={<Lock size={18}/>} active={activeTab === 'exclusive_controls'} onClick={() => handleTabChange('exclusive_controls')} badge={pendingRequestsCount} />
        <TabButton label="إدارة المستخدمين" icon={<Users size={18}/>} active={activeTab === 'users'} onClick={() => handleTabChange('users')} />
        <TabButton label="خطة ترحيل المستخدمين الآمنة" icon={<ShieldAlert size={18}/>} active={activeTab === 'user_migration'} onClick={() => handleTabChange('user_migration')} />
        <TabButton label="إدارة المتاجر المفتوحة" icon={<StoreIcon size={18}/>} active={activeTab === 'stores'} onClick={() => handleTabChange('stores')} badge={pendingAppealsCount} />
        <TabButton label="التسويات والطلبات المالية" icon={<TrendingUp size={18}/>} active={activeTab === 'financial'} onClick={() => handleTabChange('financial')} badge={pendingRequestsCount} />
        <TabButton label="رسوم المنصة والعمولات" icon={<SettingsIcon size={18}/>} active={activeTab === 'fee_settings'} onClick={() => handleTabChange('fee_settings')} />
        <TabButton label="البريد المركزي والبنية السحابية" icon={<Database size={18}/>} active={activeTab === 'infrastructure'} onClick={() => handleTabChange('infrastructure')} />
        <TabButton label="الدعم الفني وحل المشاكل" icon={<Wrench size={18}/>} active={activeTab === 'support'} onClick={() => handleTabChange('support')} badge={pendingAppealsCount} />
        <TabButton label="صيانة وإبادة البيانات" icon={<AlertTriangle size={18}/>} active={activeTab === 'danger_zone'} onClick={() => handleTabChange('danger_zone')} />
      </div>

      {/* Main Tab Panels Wrapper */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200/60 dark:border-slate-850 min-h-[500px] p-6 lg:p-8">
        
        {/* Tab content router */}
        {activeTab === 'exclusive_controls' && (
          <div className="space-y-10 animate-in fade-in duration-300">
            {/* Hero Header explaining the 6 exclusive Platform Admin controls */}
            <div className="p-6 rounded-3xl bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-500/30 shadow-lg space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-xs font-black mb-2">
                    <Lock size={13} />
                    تحكم حصري لمدير المنظومة (مخفي عن واجهة التجار)
                  </span>
                  <h2 className="text-xl md:text-2xl font-black">مركز الصلاحيات الحصرية والرقابة المالية والتقنية</h2>
                  <p className="text-xs text-slate-300 mt-1">
                    جميع الأدوات الـ 6 الحساسة التي تم تأمينها وإخفاؤها من حسابات التجار مجمعة هنا بالكامل تحت سيطرتك المباشرة.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 text-[11px] font-black">
                <div className="p-3 rounded-2xl bg-white/10 border border-white/10 text-emerald-300">1. حذف حركات المحفظة وتصحيح الرصيد</div>
                <div className="p-3 rounded-2xl bg-white/10 border border-white/10 text-amber-300">2. اعتماد تعويضات الشحن للمحفظة</div>
                <div className="p-3 rounded-2xl bg-white/10 border border-white/10 text-sky-300">3. المبلغ المخفي وفرق التقفيل</div>
                <div className="p-3 rounded-2xl bg-white/10 border border-white/10 text-purple-300">4. محاكاة وتفريغ سجل Webhooks</div>
                <div className="p-3 rounded-2xl bg-white/10 border border-white/10 text-indigo-300">5. مفاتيح MoneyHash والحسابات الفرعية</div>
                <div className="p-3 rounded-2xl bg-white/10 border border-white/10 text-rose-300">6. حذف قيود الخزينة وعكس الأرصدة</div>
              </div>
            </div>

            {/* 1. Central Payment Gateway Keys & Sub-Accounts */}
            <MoneyHashAdminSection
              users={users}
              allStoresData={allStoresData}
              setAllStoresData={setAllStoresData}
            />

            {/* 2. Pending Financial Requests & Shipping Compensation Claims */}
            <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 space-y-4">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp size={20} className="text-amber-500" />
                <span>اعتماد مطالبات تعويضات الشحن للمحفظة المركزية وطلبات السحب والإيداع</span>
              </h3>
              <FinancialRequestsTab
                allStoresData={allStoresData}
                setAllStoresData={setAllStoresData}
                users={users}
              />
            </div>

            {/* 3. Store-level Financial & Technical Overrides (Wallet Tx Delete, Hidden Wallet Amount, Treasury Ledger Delete, Webhook Simulation/Clear) */}
            <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert size={20} className="text-indigo-500" />
                <span>التحكم المحاسبي والتقني لكل متجر (المحفظة، المبلغ المخفي، دفتر الأستاذ والخزينة، وسجل الـ Webhooks)</span>
              </h3>
              <AdminSupportCenter
                users={users}
                setUsers={setUsers}
                allStoresData={allStoresData}
                setAllStoresData={setAllStoresData}
                initialStoreId={storeIdParam}
                initialSubTab="orders_finance"
                onImpersonate={onImpersonate}
              />
            </div>
          </div>
        )}

        {activeTab === 'support' && (
          <div className="space-y-8">
            <ProjectWideSupportContactCard
              users={users}
              allStoresData={allStoresData}
              setAllStoresData={setAllStoresData}
              setSettings={setSettings}
            />
            <SuspendedAppealsCenter
              users={users}
              setUsers={setUsers}
              allStoresData={allStoresData}
              setAllStoresData={setAllStoresData}
              setSettings={setSettings}
            />
            <AdminSupportCenter
              users={users}
              setUsers={setUsers}
              allStoresData={allStoresData}
              setAllStoresData={setAllStoresData}
              initialStoreId={storeIdParam}
              onImpersonate={onImpersonate}
            />
          </div>
        )}

        {activeTab === 'infrastructure' && (
          <PlatformInfrastructureTab
            users={users}
            setUsers={setUsers}
            allStoresData={allStoresData}
            setAllStoresData={setAllStoresData}
          />
        )}

        {activeTab === 'user_migration' && (
          <UserMigrationCenter onUserMigrated={async () => {
            try {
              const globalData = await db.getGlobalData(true);
              if (globalData?.users) setUsers(globalData.users);
            } catch (e) {
              console.warn('Failed to refresh users:', e);
            }
          }} />
        )}

        {activeTab === 'danger_zone' && (
          <DangerZone
            stores={users.flatMap(u => u.stores || [])}
            initialStoreId={storeIdParam}
            users={users}
            setUsers={setUsers}
            setAllStoresData={setAllStoresData}
          />
        )}
        
        {activeTab === 'financial' && (
             <FinancialRequestsTab 
                 allStoresData={allStoresData} 
                 setAllStoresData={setAllStoresData}
                 users={users}
             />
        )}
        
        {activeTab === 'fee_settings' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
              <div>
                <h2 className="text-xl font-black flex items-center gap-2 text-slate-900 dark:text-white">
                  <SettingsIcon className="text-indigo-600" />
                  <span>إدارة رسوم المنصة وسياسات المحفظة المركزية</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  التحكم المركزي في نسب الإيداع، رسوم السحب العادي والفوري، والحد الأدنى للعمولات المطبقة على جميع المتاجر.
                </p>
              </div>
              <span className="px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 text-xs font-black">
                تعميم مركزي على ({users.flatMap(u => u.stores || []).length}) متجر
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* تفعيل رسوم السحب والتحويل الداخلي */}
              <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h3 className="text-sm font-black text-slate-800 dark:text-white">حالة تفعيل الرسوم على المتاجر</h3>
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="text-xs font-black text-rose-700 dark:text-rose-400">تفعيل رسوم السحب على محافظ المتاجر</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">عند التعطيل، تُعفى جميع طلبات السحب من الرسوم</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !(settings.enableWithdrawalFees !== false);
                      setAllStoresData(prev => {
                        const next = { ...prev };
                        for (const sid in next) {
                          next[sid] = { ...next[sid], settings: { ...next[sid].settings, enableWithdrawalFees: nextVal } };
                        }
                        return next;
                      });
                      setSettings(prev => ({ ...prev, enableWithdrawalFees: nextVal }));
                    }}
                    className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer ${settings.enableWithdrawalFees !== false ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.enableWithdrawalFees !== false ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="text-xs font-black text-indigo-700 dark:text-indigo-400">تطبيق الرسوم على التحويل للخزينة الداخلية</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">تطبيق رسوم السحب عند تحويل رصيد المحفظة إلى الخزينة الداخلية للمتجر</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !settings.enableInternalWithdrawalFees;
                      setAllStoresData(prev => {
                        const next = { ...prev };
                        for (const sid in next) {
                          next[sid] = { ...next[sid], settings: { ...next[sid].settings, enableInternalWithdrawalFees: nextVal } };
                        }
                        return next;
                      });
                      setSettings(prev => ({ ...prev, enableInternalWithdrawalFees: nextVal }));
                    }}
                    className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer ${settings.enableInternalWithdrawalFees ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.enableInternalWithdrawalFees ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              {/* رسوم الإيداع والحد الأدنى */}
              <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h3 className="text-sm font-black text-slate-800 dark:text-white">رسوم الإيداع (الشحن) والحد الأدنى</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">نسبة رسوم الإيداع (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.depositFeePercent || 0}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setAllStoresData(prev => {
                          const next = { ...prev };
                          for (const sid in next) {
                            next[sid] = { ...next[sid], settings: { ...next[sid].settings, depositFeePercent: val } };
                          }
                          return next;
                        });
                        setSettings(prev => ({ ...prev, depositFeePercent: val }));
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-black tabular-nums outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">الحد الأدنى لرسوم السحب (ج.م)</label>
                    <input
                      type="number"
                      value={settings.minWithdrawalFee || 0}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setAllStoresData(prev => {
                          const next = { ...prev };
                          for (const sid in next) {
                            next[sid] = { ...next[sid], settings: { ...next[sid].settings, minWithdrawalFee: val } };
                          }
                          return next;
                        });
                        setSettings(prev => ({ ...prev, minWithdrawalFee: val }));
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-black tabular-nums outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">وسائل الدفع الخاضعة لرسوم الإيداع:</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'card', label: 'بطاقة بنكية', icon: CreditCard },
                      { id: 'wallet', label: 'محفظة إلكترونية', icon: Smartphone },
                      { id: 'instapay', label: 'إنستاباي (InstaPay)', icon: Banknote }
                    ].map(method => {
                      const active = (settings.feeApplicableMethods || []).includes(method.id);
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => {
                            const current = settings.feeApplicableMethods || [];
                            const nextMethods = current.includes(method.id)
                              ? current.filter(m => m !== method.id)
                              : [...current, method.id];
                            setAllStoresData(prev => {
                              const next = { ...prev };
                              for (const sid in next) {
                                next[sid] = { ...next[sid], settings: { ...next[sid].settings, feeApplicableMethods: nextMethods } };
                              }
                              return next;
                            });
                            setSettings(prev => ({ ...prev, feeApplicableMethods: nextMethods }));
                          }}
                          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                            active
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500'
                          }`}
                        >
                          <method.icon size={14} />
                          <span>{method.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-right">رسوم السحب المفروضة على شركاء المتاجر</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-850 space-y-4">
                        <div className="flex justify-between items-center">
                            <p className="text-xs font-black text-slate-700 dark:text-slate-300">السحب العادي (مدة معالجة ٢٤-٤٨ ساعة)</p>
                            <div className="flex p-0.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-250 dark:border-slate-800">
                                <button 
                                    onClick={() => {
                                        setAllStoresData(prev => {
                                            const next = { ...prev };
                                            for(const sid in next) {
                                                next[sid] = { ...next[sid], settings: { ...next[sid].settings, withdrawalFeeType: 'flat' } };
                                            }
                                            return next;
                                        });
                                        setSettings(prev => ({ ...prev, withdrawalFeeType: 'flat' }));
                                    }}
                                    className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${settings.withdrawalFeeType === 'flat' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >مبلغ ثابت</button>
                                <button 
                                    onClick={() => {
                                        setAllStoresData(prev => {
                                            const next = { ...prev };
                                            for(const sid in next) {
                                                next[sid] = { ...next[sid], settings: { ...next[sid].settings, withdrawalFeeType: 'percent' } };
                                            }
                                            return next;
                                        });
                                        setSettings(prev => ({ ...prev, withdrawalFeeType: 'percent' }));
                                    }}
                                    className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${settings.withdrawalFeeType === 'percent' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >نسبة مئوية %</button>
                            </div>
                        </div>
                        <div className="text-right">
                            <input 
                                type="number"
                                value={settings.withdrawalFeeType === 'percent' ? (settings.withdrawalFeePercent || 0) : (settings.withdrawalFlatFee || 0)}
                                onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setAllStoresData(prev => {
                                        const next = { ...prev };
                                        for(const sid in next) {
                                            next[sid] = {
                                                ...next[sid],
                                                settings: {
                                                    ...next[sid].settings,
                                                    [settings.withdrawalFeeType === 'percent' ? 'withdrawalFeePercent' : 'withdrawalFlatFee']: val
                                                }
                                            };
                                        }
                                        return next;
                                    });
                                    setSettings(prev => ({ 
                                        ...prev, 
                                        [settings.withdrawalFeeType === 'percent' ? 'withdrawalFeePercent' : 'withdrawalFlatFee']: val 
                                    }));
                                }}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-2xl px-4 py-3 text-right text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/15"
                                placeholder={settings.withdrawalFeeType === 'percent' ? "أدخل النسبة المئوية" : "أدخل المبلغ الثابت للتسوية ج.م"}
                            />
                        </div>
                    </div>

                    <div className="p-6 bg-indigo-50/20 dark:bg-indigo-550/5 rounded-3xl border border-indigo-100/50 dark:border-indigo-900/40 space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping"/>
                                <p className="text-xs font-black text-indigo-900 dark:text-indigo-300">السحب السريع الفوري (Express / Instapay)</p>
                            </div>
                            <div className="flex p-0.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-250 dark:border-slate-800">
                                <button 
                                    onClick={() => {
                                        setAllStoresData(prev => {
                                            const next = { ...prev };
                                            for(const sid in next) {
                                                next[sid] = { ...next[sid], settings: { ...next[sid].settings, sameDayWithdrawalFeeType: 'flat' } };
                                            }
                                            return next;
                                        });
                                        setSettings(prev => ({ ...prev, sameDayWithdrawalFeeType: 'flat' }));
                                    }}
                                    className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${settings.sameDayWithdrawalFeeType === 'flat' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >مبلغ ثابت</button>
                                <button 
                                    onClick={() => {
                                        setAllStoresData(prev => {
                                            const next = { ...prev };
                                            for(const sid in next) {
                                                next[sid] = { ...next[sid], settings: { ...next[sid].settings, sameDayWithdrawalFeeType: 'percent' } };
                                            }
                                            return next;
                                        });
                                        setSettings(prev => ({ ...prev, sameDayWithdrawalFeeType: 'percent' }));
                                    }}
                                    className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${settings.sameDayWithdrawalFeeType === 'percent' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >نسبة مئوية %</button>
                            </div>
                        </div>
                        <div className="text-right">
                            <input 
                                type="number"
                                value={settings.sameDayWithdrawalFeeType === 'flat' ? (settings.sameDayWithdrawalFlatFee || 0) : (settings.sameDayWithdrawalFeePercent || 0)}
                                onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setAllStoresData(prev => {
                                        const next = { ...prev };
                                        for(const sid in next) {
                                            next[sid] = {
                                                ...next[sid],
                                                settings: {
                                                    ...next[sid].settings,
                                                    [settings.sameDayWithdrawalFeeType === 'flat' ? 'sameDayWithdrawalFlatFee' : 'sameDayWithdrawalFeePercent']: val
                                                }
                                            };
                                        }
                                        return next;
                                    });
                                    setSettings(prev => ({ 
                                        ...prev, 
                                        [settings.sameDayWithdrawalFeeType === 'flat' ? 'sameDayWithdrawalFlatFee' : 'sameDayWithdrawalFeePercent']: val 
                                    }));
                                }}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-2xl px-4 py-3 text-right text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/15"
                                placeholder={settings.sameDayWithdrawalFeeType === 'percent' ? "أدخل النسبة المئوية" : "أدخل المبلغ الثابت للجلسة ج.م"}
                            />
                        </div>
                        <div className="p-3 bg-white/70 dark:bg-black/40 rounded-xl border border-slate-200 dark:border-slate-850">
                            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold leading-relaxed">
                                تنبيه: يتم تطبيق الحد الأدنى المحدد أعلاه ({settings.minWithdrawalFee ?? 0} ج.م) عند سحب مبالغ صغيرة لضمان تغطية رسوم بوابة التحويل المالي.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        type="button"
                        onClick={async () => {
                            try {
                                const storesToUpdate = users.flatMap(u => u.stores || []);
                                await Promise.all(
                                    storesToUpdate.map(s => {
                                        const data = allStoresData[s.id];
                                        if (!data) return Promise.resolve();
                                        return db.saveStoreData(s, data);
                                    })
                                );
                                await inAppAlert(`تم حفظ وتعميم إعدادات الرسوم على (${storesToUpdate.length}) متجر سحابياً في Cloudflare D1 بنجاح.`, { type: 'success' });
                            } catch (err: any) {
                                await inAppAlert(`تعذر حفظ بعض المتاجر: ${err?.message || err}`, { type: 'error' });
                            }
                        }}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer"
                    >
                        <Save size={16} />
                        <span>حفظ وتعميم إعدادات الرسوم على جميع المتاجر (D1)</span>
                    </button>
                </div>
            </div>
          </div>
        )}
        
        {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-300">
                
                {/* Visual Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard title="مجموع إيرادات المنصة" value={`${(stats.totalRevenue ?? 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م`} icon={<TrendingUp className="text-emerald-500"/>} />
                    <StatCard title="متوسط السلة المالية" value={`${Math.round(stats.averageOrderValue || 0).toLocaleString('ar-EG')} ج.م`} icon={<Activity className="text-purple-500"/>} />
                    <StatCard title="مجموع ودائع المحفظة الكلي" value={`${(stats.totalPlatformWalletsBalance ?? 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م`} icon={<Wallet className="text-indigo-500"/>} />
                    <StatCard title="إجمالي التجار والمستخدمين" value={stats.totalUsers} icon={<Users className="text-blue-500"/>} />
                </div>

                {/* Platform Analytics Charts Area */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Recharts Performance Visualizer */}
                    <div className="lg:col-span-8 p-6 bg-slate-50 dark:bg-slate-850/40 rounded-3xl border border-slate-200/50 dark:border-slate-850 flex flex-col justify-between">
                        <div className="mb-4">
                            <h3 className="font-black text-slate-850 dark:text-slate-100 flex items-center gap-2">
                                <Activity className="text-indigo-500" size={18} />
                                إحصائية مبيعات أفضل المتاجر المفتوحة (ج.م)
                            </h3>
                            <p className="text-slate-400 text-xs mt-1">توضح الإيرادات المجمعة والمحققة عن فئة المبيعات المستلمة والمحصلة نقدياً.</p>
                        </div>
                        <div className="h-[280px] w-full font-sans antialiased">
                            {chartsData.storesRevenue.length === 0 || chartsData.storesRevenue.every(s => s.revenue <= 0) ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs font-bold gap-2">
                                    <span>لم يسجل أي متجر من المتاجر المفتوحة ({chartsData.storesRevenue.map(s => s.name).join('، ') || 'لا توجد متاجر'}) مبيعات محصلة حتى الآن (0 ج.م).</span>
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartsData.storesRevenue} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                        <ChartTooltip contentStyle={{ borderRadius: '12px', background: '#1e293b', border: 'none', color: '#fff', fontSize: '11px', textAlign: 'right' }} formatter={(val) => [`${Number(val).toLocaleString()} ج.م`, 'إجمالي التحصيل']} />
                                        <Bar dataKey="revenue" radius={[10, 10, 0, 0]}>
                                            {chartsData.storesRevenue.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index === 0 ? '#4f46e5' : index % 2 === 0 ? '#8b5cf6' : '#10b981'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Order Status Proportions Pie Chart */}
                    <div className="lg:col-span-4 p-6 bg-slate-50 dark:bg-slate-850/40 rounded-3xl border border-slate-200/50 dark:border-slate-850 flex flex-col justify-between">
                        <div className="mb-4">
                            <h3 className="font-black text-slate-850 dark:text-slate-100 flex items-center gap-2">
                                <Grid className="text-purple-500" size={18} />
                                توزيع أوردرات المنصة
                            </h3>
                            <p className="text-slate-400 text-xs mt-1">تقسيم نسبي لحالات الأوردرات الإجمالية.</p>
                        </div>
                        <div className="h-[200px] w-full flex items-center justify-center font-sans antialiased">
                            {chartsData.statusDistribution.length === 0 ? (
                                <div className="text-slate-400 text-xs font-bold">لا توجد أوردرات مسجلة بالمنصة.</div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie 
                                            data={chartsData.statusDistribution} 
                                            cx="50%" 
                                            cy="50%" 
                                            innerRadius={50} 
                                            outerRadius={80} 
                                            paddingAngle={4} 
                                            dataKey="value"
                                        >
                                            {chartsData.statusDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <ChartTooltip contentStyle={{ borderRadius: '12px', background: '#1e293b', border: 'none', color: '#fff', fontSize: '10px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                        <div className="space-y-1 mt-3">
                            {chartsData.statusDistribution.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between text-[11px] font-bold">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-slate-600 dark:text-slate-300">{item.name}</span>
                                    </div>
                                    <span className="text-slate-800 dark:text-slate-200 font-mono">{item.value} أوردر</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Dual Column Bottom: Quick Actions Announcement and cloud log */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-8 p-6 bg-slate-50 dark:bg-slate-850/40 rounded-3xl border border-slate-200/50 dark:border-slate-850">
                        <h3 className="font-black text-lg mb-2 text-slate-850 dark:text-slate-100 flex items-center gap-2">
                            <MessageSquare className="text-indigo-600" size={20} />
                            لوحة نشر وإدارة الإعلانات العامة لجميع التجار والشركاء
                        </h3>
                        <p className="text-slate-400 text-xs mb-4">اكتب رسالة أو تعميماً هاماً وبثه فوراً ليظهر على فئة الباث بورد الخاصة بجميع التجار.</p>
                        <div className="space-y-4">
                           <div className="flex items-center justify-between gap-4 flex-wrap bg-white dark:bg-slate-900 border dark:border-slate-800 p-3 rounded-2xl">
                               <span className="text-xs font-black text-slate-600 dark:text-slate-300">مستوى الخطورة ولون الإعلان:</span>
                               <div className="flex gap-2">
                                   <button 
                                       onClick={() => setAnnouncementType('info')} 
                                       className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${announcementType === 'info' ? 'bg-indigo-50 border-indigo-400 text-indigo-700 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-800 text-slate-400'}`}
                                   >تنويه عادي (أزرق)</button>
                                   <button 
                                       onClick={() => setAnnouncementType('warning')} 
                                       className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${announcementType === 'warning' ? 'bg-amber-50 border-amber-400 text-amber-700 dark:bg-amber-950/30' : 'border-slate-200 dark:border-slate-800 text-slate-400'}`}
                                   >تحذير هام (برتقالي)</button>
                                   <button 
                                       onClick={() => setAnnouncementType('error')} 
                                       className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${announcementType === 'error' ? 'bg-rose-50 border-rose-400 text-rose-700 dark:bg-rose-950/30' : 'border-slate-200 dark:border-slate-800 text-slate-400'}`}
                                   >صيانة أو طارئ (أحمر)</button>
                                   <button 
                                       onClick={() => setAnnouncementType('none')} 
                                       className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${announcementType === 'none' ? 'bg-slate-800 text-white' : 'border-slate-200 dark:border-slate-800 text-slate-400'}`}
                                   >إخفاء وتعطيل البث</button>
                               </div>
                           </div>

                           <div className="space-y-1.5">
                               <label className="text-xs font-black text-slate-700 dark:text-slate-350">نص الرسالة المنشورة:</label>
                               <textarea 
                                   value={announcementText} 
                                   onChange={e => setAnnouncementText(e.target.value)} 
                                   placeholder="اكتب الإحصائية أو الإشعار الطارئ لبثه حالاً لجميع الحسابات بالمنصة..." 
                                   className="w-full h-24 p-4 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none text-xs font-sans text-right"
                               ></textarea>
                           </div>
                           
                           <button 
                               onClick={handleSaveAnnouncement} 
                               className="w-full py-3 bg-slate-800 hover:bg-slate-950 text-white dark:bg-indigo-600 dark:hover:bg-indigo-700 rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg"
                           >
                               <Send size={16}/> 
                               <span>حفظ وتفعيل بث الإعلان المنصبي المباشر</span>
                           </button>
                        </div>
                    </div>

                    <div className="lg:col-span-4 p-6 bg-slate-50 dark:bg-slate-850/40 rounded-3xl border border-slate-200/50 dark:border-slate-850 flex flex-col justify-between">
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1">
                                <Activity className="text-emerald-500" size={16}/>
                                سجل الأحداث والعمليات الأخيرة
                            </h3>
                            <p className="text-[10px] text-slate-400 mb-4">نشاطات المستخدمين والمتاجر فور تسجيلها.</p>
                        </div>
                        <div className="space-y-4 max-h-[280px] overflow-y-auto pr-1">
                           {activityFeed.map((act, i) => (
                               <div key={i} className="flex gap-3 text-xs antialiased">
                                   <div className="p-1.5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl h-max text-slate-600 dark:text-slate-300">
                                       {act.type === 'new_user' ? <UserPlus size={14} className="text-blue-500"/> : <StoreIcon size={14} className="text-emerald-500"/>}
                                   </div>
                                   <div className="flex-1">
                                       <p className="text-slate-700 dark:text-slate-200 leading-normal">
                                           {act.type === 'new_user' ? (
                                               <span>تسجيل مستخدم جديد: <span className="font-bold text-slate-900 dark:text-white">{act.data.fullName}</span></span>
                                           ) : (
                                               <span>تأسيس متجر <span className="font-bold text-slate-900 dark:text-white">{act.data.store.name}</span> لـ {act.data.owner.fullName}</span>
                                           )}
                                       </p>
                                       <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5"><Clock size={10}/> {timeSince(act.date)}</p>
                                   </div>
                               </div>
                           ))}
                        </div>
                    </div>
                </div>

                {/* Project-Wide Support Phone & Team Identity Card */}
                <ProjectWideSupportContactCard
                  users={users}
                  allStoresData={allStoresData}
                  setAllStoresData={setAllStoresData}
                  setSettings={setSettings}
                />
            </div>
        )}

        {activeTab === 'users' && (
            <div className="space-y-6 animate-in fade-in duration-300">
                <SuspendedAppealsCenter
                  users={users}
                  setUsers={setUsers}
                  allStoresData={allStoresData}
                  setAllStoresData={setAllStoresData}
                  setSettings={setSettings}
                  compact
                />
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Users className="text-indigo-500" />
                        إدارة المستخدمين النشطين
                    </h3>
                    
                    <button 
                        onClick={() => setShowAddUserModal(true)}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                    >
                        <UserPlus size={16} />
                        تسجيل إضافة تاجر جديد
                    </button>
                </div>

                <div className="relative">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="ابحث عن مستخدم بالاسم، أو البريد الإلكتروني، أو رقم الهاتف..." 
                        className="w-full pr-11 pl-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold placeholder:text-slate-400 text-sm" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                    />
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                    <table className="w-full text-right">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase">
                            <tr>
                                <th className="p-4 rounded-tr-xl">المستخدم والتاجر</th>
                                <th className="p-4">رقم الهاتف</th>
                                <th className="p-4">إجمالي الإيرادات (LTV)</th>
                                <th className="p-4 text-center">عدد المتاجر</th>
                                <th className="p-4 text-center">أذونات الأمان والوظيفة</th>
                                <th className="p-4 rounded-tl-xl text-left pl-6">الإجراءات والعمليات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                            {filteredUsers.map(user => {
                                const ltv = user.stores?.reduce((total, store) => {
                                    const storeData = allStoresData[store.id];
                                    if (!storeData) return total;
                                    return total + (storeData.orders?.filter((o: any) => o.status === 'تم_التحصيل').reduce((sum: number, o: any) => sum + (o.productPrice + o.shippingFee - (o.discount || 0)), 0) || 0);
                                }, 0) || 0;
                                return (
                                <tr key={user.phone} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/30 transition-colors text-xs">
                                    <td className="p-4">
                                        <div className="font-bold text-slate-850 dark:text-white text-sm">{user.fullName}</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">{user.email}</div>
                                    </td>
                                    <td className="p-4 font-mono font-bold text-slate-600 dark:text-slate-300">{user.phone}</td>
                                    <td className="p-4 font-bold text-emerald-600 dark:text-emerald-400 text-sm">{(ltv ?? 0).toLocaleString('ar-EG')} ج.م</td>
                                    <td className="p-4 text-center font-black text-slate-700 dark:text-slate-200 text-sm">{user.stores?.length || 0}</td>
                                    <td className="p-4 text-center">
                                        {user.isBanned ? (
                                            <span className="inline-flex items-center gap-1 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/50 px-2 py-1 rounded-full text-[10px] font-bold">
                                                <Ban size={10}/> محظور التصفح
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 px-2 py-1 rounded-full text-[10px] font-bold">
                                                <CheckCircle size={10}/> تاجر نشط وصالح
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-left">
                                        <div className="flex justify-end gap-2">
                                            {user.stores && user.stores.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSearchParams({ tab: 'support', storeId: user.stores![0].id }, { replace: true })}
                                                    title="تشخيص ودعم فني لمتجر التاجر"
                                                    className="p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:hover:bg-amber-900/40 dark:text-amber-300 border border-amber-200/70 dark:border-amber-900/40 transition-all active:scale-95"
                                                >
                                                    <Wrench size={15} />
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => setManagingUser(user)} 
                                                title="إدارة موظفي وصلاحيات المتجر" 
                                                className="p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-600 dark:bg-purple-950/20 dark:hover:bg-purple-900/40 border border-purple-150 dark:border-purple-900/40 transition-all active:scale-95"
                                            >
                                                <UserCog size={15} />
                                            </button>
                                            <button 
                                                onClick={() => onImpersonate(user, user.stores?.[0]?.id)} 
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-bold shadow-sm transition-all active:scale-95"
                                            >
                                                <LogIn size={13} /> 
                                                <span>دخول كتاجر</span>
                                            </button>
                                            <button 
                                                onClick={() => toggleUserBan(user.phone)} 
                                                className={`p-2.5 rounded-xl transition-all border shrink-0 active:scale-95 ${user.isBanned ? 'bg-emerald-50 border-emerald-250 text-emerald-700 dark:bg-emerald-950/20' : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20'}`}
                                                title={user.isBanned ? "إلغاء حظر الحساب" : "حظر الحساب"}
                                            >
                                                {user.isBanned ? <Unlock size={14} /> : <Lock size={14} />}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(user)}
                                                className="p-2.5 rounded-xl transition-all border shrink-0 active:scale-95 bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 dark:border-rose-900/50 dark:text-rose-400"
                                                title="حذف المستخدم وجميع متاجره نهائياً"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === 'stores' && (
             <div className="space-y-6 animate-in fade-in duration-300">
                <SuspendedAppealsCenter
                  users={users}
                  setUsers={setUsers}
                  allStoresData={allStoresData}
                  setAllStoresData={setAllStoresData}
                  setSettings={setSettings}
                  compact
                />
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <StoreIcon className="text-emerald-500" />
                        مستودعات ومتاجر المنصة
                    </h3>
                    
                    <button 
                        onClick={() => setShowAddStoreModal(true)}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                    >
                        <Plus size={16} />
                        إنشاء متجر جديد للتاجر
                    </button>
                </div>

                <div className="relative">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="بحث عن متجر مخصص بالاسم أو الرابط..." 
                        className="w-full pr-11 pl-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold placeholder:text-slate-400 text-sm" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allStoresList.map(({ store, owner, totalOrders, totalRevenue }) => {
                        const storeDetails = allStoresData[store.id];
                        const balance = storeDetails?.wallet?.balance || 0;
                        return (
                            <div key={store.id} className="border border-slate-200/60 dark:border-slate-850 rounded-2xl p-6 hover:shadow-lg transition-all bg-slate-50/50 dark:bg-slate-800/20 hover:border-indigo-200 dark:hover:border-indigo-900 flex flex-col justify-between min-h-[220px]">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-black text-base text-slate-850 dark:text-white flex items-center gap-1.5">
                                                <StoreIcon size={16} className="text-secondary" />
                                                {store.name}
                                            </h4>
                                            <p className="text-[10px] text-slate-400 mt-0.5">المالك: <span className="font-bold text-slate-600 dark:text-slate-350">{owner.fullName}</span></p>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {(store.isBanned || owner.isBanned) && (
                                                <span className="px-2 py-1 bg-rose-100 dark:bg-rose-950/60 text-[10px] text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg font-black">
                                                    {owner.isBanned ? '⛔ المالك محظور' : '⛔ المتجر موقوف'}
                                                </span>
                                            )}
                                            <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-[10px] text-indigo-700 dark:text-indigo-400 border border-indigo-100/40 rounded-lg font-bold">
                                                {store.specialization || 'عام'}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 font-mono dir-ltr text-right truncate bg-white dark:bg-slate-900 border dark:border-slate-850 px-2.5 py-1 rounded-lg w-max max-w-full">{store.url}</p>
                                </div>

                                <div className="grid grid-cols-3 gap-2 py-3 border-y border-dashed border-slate-200 dark:border-slate-800 my-4 text-right">
                                   <div className="text-xs">
                                        <span className="block text-slate-400 font-bold mb-1">الطلبات</span>
                                        <span className="font-black text-slate-700 dark:text-slate-300 text-sm tabular-nums">{totalOrders}</span>
                                   </div>
                                   <div className="text-xs">
                                        <span className="block text-slate-400 font-bold mb-1">الإيرادات</span>
                                        <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm tabular-nums">{(totalRevenue ?? 0).toLocaleString('ar-EG')} ج</span>
                                   </div>
                                   <div className="text-xs">
                                        <span className="block text-slate-400 font-bold mb-1">رصيد المحفظة</span>
                                        <span className={`font-black text-sm tabular-nums ${balance >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-500'}`}>
                                            {(balance ?? 0).toLocaleString('ar-EG')} ج
                                        </span>
                                   </div>
                                </div>

                                <div className="flex gap-2 w-full">
                                    <button 
                                        type="button"
                                        onClick={() => onImpersonate(owner, store.id)} 
                                        className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl text-center shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1"
                                    >
                                        <LogIn size={13} />
                                        <span>إدارة المتجر</span>
                                    </button>
                                    
                                    <button 
                                        type="button"
                                        onClick={() => setAdjustingStoreWallet({ id: store.id, name: store.name })}
                                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30 border border-indigo-150 dark:border-indigo-900 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1 shrink-0"
                                        title="تعديل مباشر على رصيد المحفظة"
                                    >
                                        <ArrowLeftRight size={13} />
                                        <span>الرصيد</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => toggleStoreBan(owner, store)}
                                        className={`p-2 rounded-xl border transition-all shrink-0 ${
                                            store.isBanned
                                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                                                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800'
                                        }`}
                                        title={store.isBanned ? 'إلغاء حظر وإعادة تفعيل المتجر' : 'حظر وإيقاف المتجر مؤقتاً'}
                                    >
                                        {store.isBanned ? <Unlock size={14} /> : <Ban size={14} />}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setSearchParams({ tab: 'support', storeId: store.id }, { replace: true })}
                                        className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:hover:bg-amber-900/40 border border-amber-200/70 dark:border-amber-900/40 rounded-xl transition-all shrink-0"
                                        title="دعم فني وتشخيص المتجر"
                                    >
                                        <Wrench size={14} />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setSearchParams({ tab: 'danger_zone', storeId: store.id }, { replace: true })}
                                        className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 border border-rose-200/70 dark:border-rose-900/40 rounded-xl transition-all shrink-0"
                                        title="صيانة وتصفير / حذف المتجر"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
             </div>
        )}
      </div>

      {managingUser && (
        <UserPermissionsModal
            user={managingUser}
            onClose={() => setManagingUser(null)}
            allStoresData={allStoresData}
            setAllStoresData={setAllStoresData}
            users={users}
        />
      )}

      {/* Manual Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 border border-slate-300 dark:border-slate-800 text-right">
                <div className="flex items-center justify-between pb-4 border-b dark:border-slate-800 mb-6">
                    <h3 className="text-lg font-black text-slate-855 dark:text-white flex items-center gap-2">
                        <UserPlus className="text-indigo-600" />
                        تسجيل وإضافة تاجر جديد بالسيرفر
                    </h3>
                    <button onClick={() => { setShowAddUserModal(false); setAddUserError(''); }}><XCircle className="text-slate-400 hover:text-red-500" /></button>
                </div>

                <form onSubmit={handleAddUser} className="space-y-4 text-xs font-sans">
                    <div className="space-y-1.5">
                        <label className="font-bold text-slate-700 dark:text-slate-300">الاسم الكامل للتاجر:</label>
                        <input 
                            type="text" 
                            required 
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" 
                            placeholder="مثال: عبد الرحمن محمد"
                            value={newUserData.fullName}
                            onChange={e => setNewUserData(prev => ({ ...prev, fullName: e.target.value }))}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="font-bold text-slate-700 dark:text-slate-300">رقم الهاتف (رقم الدخول):</label>
                        <input 
                            type="tel" 
                            required 
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold" 
                            placeholder="مثال: 01012345678"
                            value={newUserData.phone}
                            onChange={e => setNewUserData(prev => ({ ...prev, phone: e.target.value }))}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="font-bold text-slate-700 dark:text-slate-300">البريد الإلكتروني للاتصالات:</label>
                        <input 
                            type="email" 
                            required 
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" 
                            placeholder="example@mail.com"
                            value={newUserData.email}
                            onChange={e => setNewUserData(prev => ({ ...prev, email: e.target.value }))}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="font-bold text-slate-700 dark:text-slate-300">كلمة المرور الابتدائية للحساب:</label>
                        <input 
                            type="text" 
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" 
                            value={newUserData.password}
                            onChange={e => setNewUserData(prev => ({ ...prev, password: e.target.value }))}
                        />
                    </div>

                    <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border dark:border-slate-850 cursor-pointer">
                        <input 
                            type="checkbox" 
                            id="is_admin_check" 
                            checked={newUserData.isAdmin} 
                            onChange={e => setNewUserData(prev => ({ ...prev, isAdmin: e.target.checked }))}
                            className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <label htmlFor="is_admin_check" className="font-bold text-slate-700 dark:text-slate-300 select-none cursor-pointer">منح صلاحيات آدمن مشرف للمنصة</label>
                    </div>

                    {addUserError && <p className="text-red-500 font-bold p-2 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-150 text-[10px]">{addUserError}</p>}

                    <div className="flex gap-2 pt-2">
                        <button type="submit" className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all">إضافة الحساب</button>
                        <button type="button" onClick={() => { setShowAddUserModal(false); setAddUserError(''); }} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:text-slate-300 rounded-xl font-bold transition-all">إلغاء</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Manual Add Store Modal */}
      {showAddStoreModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 border border-slate-300 dark:border-slate-800 text-right">
                <div className="flex items-center justify-between pb-4 border-b dark:border-slate-800 mb-6">
                    <h3 className="text-lg font-black text-slate-855 dark:text-white flex items-center gap-2">
                        <StoreIcon className="text-emerald-500" />
                        تجهيز وبناء متجر جديد سحابياً
                    </h3>
                    <button onClick={() => { setShowAddStoreModal(false); setAddStoreError(''); }}><XCircle className="text-slate-400 hover:text-red-500" /></button>
                </div>

                <form onSubmit={handleAddStore} className="space-y-4 text-xs font-sans">
                    <div className="space-y-1.5">
                        <label className="font-bold text-slate-700 dark:text-slate-300">اسم المتجر السحابي الجديد:</label>
                        <input 
                            type="text" 
                            required 
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" 
                            placeholder="مثال: وايت ستور White Store"
                            value={newStoreData.name}
                            onChange={e => setNewStoreData(prev => ({ ...prev, name: e.target.value }))}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="font-bold text-slate-700 dark:text-slate-300">رابط المتجر (Subdomain):</label>
                        <input 
                            type="text" 
                            required 
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold font-mono text-left" 
                            placeholder="white-store.com"
                            value={newStoreData.url}
                            onChange={e => setNewStoreData(prev => ({ ...prev, url: e.target.value }))}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="font-bold text-slate-700 dark:text-slate-300">نطاق التخصص والنشاط:</label>
                        <select 
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                            value={newStoreData.specialization}
                            onChange={e => setNewStoreData(prev => ({ ...prev, specialization: e.target.value }))}
                        >
                            <option value="ملابس">ملابس وأزياء</option>
                            <option value="أحذية">أحذية وحقائب</option>
                            <option value="إلكترونيات">إلكترونيات ذكية</option>
                            <option value="إكسسوارات">مجوهرات وإكسسوارات</option>
                            <option value="مستحضرات تجميل">مستحضرات تجميل وعناية بالبشرة</option>
                            <option value="عام">نشاط عام / متعدد الأقسام</option>
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="font-bold text-slate-700 dark:text-slate-300">تخصيص الحساب المالك للمتجر:</label>
                        <select 
                            required
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                            value={newStoreData.ownerPhone}
                            onChange={e => setNewStoreData(prev => ({ ...prev, ownerPhone: e.target.value }))}
                        >
                            <option value="">-- اختر مالك المتجر من القائمة --</option>
                            {users.filter(u => !u.isAdmin).map(u => (
                                <option key={u.phone} value={u.phone}>{u.fullName} ({u.phone})</option>
                            ))}
                        </select>
                    </div>

                    {addStoreError && <p className="text-red-500 font-bold p-2 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-150 text-[10px]">{addStoreError}</p>}

                    <div className="flex gap-2 pt-2">
                        <button type="submit" className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all">تأسيس وبناء المتجر</button>
                        <button type="button" onClick={() => { setShowAddStoreModal(false); setAddStoreError(''); }} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:text-slate-300 rounded-xl font-bold transition-all">إلغاء</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Manual Wallet balance adjusting */}
      {adjustingStoreWallet && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 border border-slate-300 dark:border-slate-800 text-right">
                <div className="flex items-center justify-between pb-4 border-b dark:border-slate-800 mb-6">
                    <h3 className="text-lg font-black text-slate-855 dark:text-white flex items-center gap-2">
                        <ArrowLeftRight className="text-indigo-600" />
                        تعديل رصيد محفظة: {adjustingStoreWallet.name}
                    </h3>
                    <button onClick={() => { setAdjustingStoreWallet(null); setAdjustError(''); }}><XCircle className="text-slate-400 hover:text-red-500" /></button>
                </div>

                <form onSubmit={handleAdjustBalance} className="space-y-4 text-xs font-sans">
                    <div className="p-3.5 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100/40 rounded-2xl flex justify-between items-center">
                        <span className="font-bold text-slate-500">رصيد المتجر الحالي:</span>
                        <span className="font-black text-indigo-700 dark:text-indigo-450 text-sm">{(allStoresData[adjustingStoreWallet.id]?.wallet?.balance || 0).toLocaleString()} ج.م</span>
                    </div>

                    <div className="space-y-1.5">
                        <label className="font-bold text-slate-700 dark:text-slate-300">نوع الإجراء والتسوية:</label>
                        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 rounded-xl">
                            <button 
                                type="button"
                                onClick={() => setAdjustmentDetails(prev => ({ ...prev, type: 'deposit' }))}
                                className={`py-1.5 font-bold rounded-lg text-center transition-all ${adjustmentDetails.type === 'deposit' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400'}`}
                            >شحن / إضافة رصيد (+)</button>
                            <button 
                                type="button"
                                onClick={() => setAdjustmentDetails(prev => ({ ...prev, type: 'withdraw' }))}
                                className={`py-1.5 font-bold rounded-lg text-center transition-all ${adjustmentDetails.type === 'withdraw' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-400'}`}
                            >خصم / سحب رصيد (-)</button>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="font-bold text-slate-700 dark:text-slate-300">المبلغ المراد تعديله (ج.م):</label>
                        <input 
                            type="number" 
                            required 
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 rounded-xl outline-none focus:ring-2 focus:ring-indigo-550 font-bold" 
                            placeholder="أدخل قيمة المبلغ مثلاً 250"
                            value={adjustmentDetails.amount}
                            onChange={e => setAdjustmentDetails(prev => ({ ...prev, amount: e.target.value }))}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="font-bold text-slate-700 dark:text-slate-300">سبب التسوية / ملاحظة:</label>
                        <input 
                            type="text" 
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 rounded-xl outline-none focus:ring-2 focus:ring-indigo-550 font-bold" 
                            placeholder="مثال: تعويض مالي / تسوية يدوية لعمولة"
                            value={adjustmentDetails.note}
                            onChange={e => setAdjustmentDetails(prev => ({ ...prev, note: e.target.value }))}
                        />
                    </div>

                    {adjustError && <p className="text-red-500 font-bold p-2 bg-red-55 dark:bg-red-950/20 rounded-xl border border-red-150 text-[10px]">{adjustError}</p>}

                    <div className="flex gap-2 pt-2">
                        <button type="submit" className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all">اعتماد التحديث المالي</button>
                        <button type="button" onClick={() => { setAdjustingStoreWallet(null); setAdjustError(''); }} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:text-slate-300 rounded-xl font-bold transition-all">إلغاء</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};


const DangerZone = ({
    stores,
    initialStoreId,
    users,
    setUsers,
    setAllStoresData
}: {
    stores: Store[];
    initialStoreId?: string;
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    setAllStoresData: React.Dispatch<React.SetStateAction<Record<string, StoreData>>>;
}) => {
    const [selectedStore, setSelectedStore] = useState<Store | undefined>(() => {
        if (initialStoreId) {
            return stores.find(s => s.id === initialStoreId) || stores[0];
        }
        return stores.length > 0 ? stores[0] : undefined;
    });
    const [showConfirm, setShowConfirm] = useState(false);
    const [confirmationText, setConfirmationText] = useState('');
    const [error, setError] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

    useEffect(() => {
        if (initialStoreId) {
            const match = stores.find(s => s.id === initialStoreId);
            if (match) setSelectedStore(match);
        } else if (!selectedStore && stores.length > 0) {
            setSelectedStore(stores[0]);
        } else if (selectedStore && !stores.some(s => s.id === selectedStore.id)) {
            setSelectedStore(stores[0]);
        }
    }, [initialStoreId, stores]);
    
    if (!selectedStore) {
        return <div className="text-center p-8 bg-slate-50 dark:bg-slate-800/40 rounded-2xl font-bold text-slate-500">لا توجد متاجر نشطة بالمنصة لتجهيزها للتصفير.</div>;
    }

    const isConfirmationMatch = confirmationText === selectedStore.name;

    const availableTargets = [
        { id: 'orders', label: 'الطلبات والسلات', icon: <ShoppingCart size={16}/> },
        { id: 'products', label: 'المنتجات والمخزون', icon: <Package size={16}/> },
        { id: 'customers', label: 'قاعدة العملاء', icon: <Users size={16}/> },
        { id: 'wallet', label: 'المعاملات المالية', icon: <Wallet size={16}/> },
        { id: 'activity', label: 'سجل النشاط', icon: <Activity size={16}/> },
        { id: 'coupons', label: 'الكوبونات', icon: <Tag size={16}/> },
        { id: 'reviews', label: 'التقييمات', icon: <MessageSquare size={16}/> },
        { id: 'abandoned_carts', label: 'السلات المتروكة', icon: <ShoppingBasket size={16}/> },
        { id: 'shipping', label: 'إعدادات الشحن', icon: <Package size={16}/> },
        { id: 'pages', label: 'الصفحات المخصصة', icon: <LayoutDashboard size={16}/> },
        { id: 'suppliers', label: 'الموردين', icon: <UserPlus size={16}/> },
        { id: 'supply_orders', label: 'طلبات التوريد', icon: <TrendingUp size={16}/> },
        { id: 'global_options', label: 'خيارات عامة', icon: <SettingsIcon size={16}/> },
        { id: 'payment_methods', label: 'طرق الدفع', icon: <Wallet size={16}/> },
        { id: 'collections', label: 'التصنيفات', icon: <Grid size={16}/> },
        { id: 'employees', label: 'الموظفين', icon: <UserCog size={16}/> },
        { id: 'partner_withdrawals', label: 'سحوبات الشركاء والمحفظة', icon: <Wallet size={16}/> },
        { id: 'partners', label: 'الشركاء', icon: <UserMinus size={16}/> },
        { id: 'full_store_deletion', label: 'حذف المتجر بالكامل نهائياً', icon: <Trash2 size={24} className="text-red-600"/> },
    ];

    const toggleTarget = (id: string) => {
        setSelectedTargets(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
    };

    const toggleAll = () => {
        if (selectedTargets.length === availableTargets.length) {
            setSelectedTargets([]);
        } else {
            setSelectedTargets(availableTargets.map(t => t.id));
        }
    };

    const handleClearData = async () => {
        if (!isConfirmationMatch) {
            setError('اسم المتجر غير متطابق للتحقق الأمني.');
            return;
        }
        if (selectedTargets.length === 0 && !selectedTargets.includes('full_store_deletion')) {
            setError('يجب اختيار عنصر واحد على الأقل للحذف.');
            return;
        }

        setIsDeleting(true);
        const storeId = selectedStore.id;
        
        try {
            if (selectedTargets.includes('full_store_deletion')) {
                await db.deleteStoreCompletely(storeId);
                const updatedUsers = users.map(u => {
                    const hadStore = (u.stores || []).some(s => s.id === storeId);
                    const nextStores = (u.stores || []).filter(s => s.id !== storeId);
                    const nextDefault = u.defaultStoreId === storeId ? undefined : u.defaultStoreId;
                    const updatedUser = {
                        ...u,
                        stores: nextStores,
                        defaultStoreId: nextDefault,
                        autoLaunchDefaultStore: nextDefault ? u.autoLaunchDefaultStore : false
                    };
                    if (hadStore || u.defaultStoreId === storeId) {
                        void db.createUserDoc(updatedUser).catch(() => {});
                    }
                    return updatedUser;
                });
                setUsers(updatedUsers);
                setAllStoresData(prev => {
                    const next = { ...prev };
                    delete next[storeId];
                    return next;
                });
                try {
                    if (localStorage.getItem('lastActiveStoreId') === storeId) {
                        localStorage.removeItem('lastActiveStoreId');
                    }
                    if (localStorage.getItem('defaultStoreId') === storeId) {
                        localStorage.removeItem('defaultStoreId');
                    }
                } catch {}
                await db.saveGlobalData({ users: updatedUsers, loyaltyData: {} }).catch(console.warn);
                await inAppAlert('تم حذف المتجر وكافة بياناته نهائياً.', { type: 'success' });
            } else {
                await db.clearStoreData(storeId, selectedTargets);
                const freshData = await db.getStoreData(storeId, true).catch(() => null);
                if (freshData) {
                    setAllStoresData(prev => ({ ...prev, [storeId]: freshData }));
                }
                await inAppAlert('تم مسح البيانات المختارة بنجاح.', { type: 'success' });
            }
            
            setIsDeleting(false);
            setConfirmationText('');
            setSelectedTargets([]);
            setShowConfirm(false);
        } catch (err: any) {
            setError(`فشل في مسح البيانات: ${err.message}`);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="bg-red-50 dark:bg-red-950/15 p-8 rounded-3xl border border-red-200 dark:border-red-900/40 shadow-sm">
            <div className="flex items-center gap-3 text-red-650 dark:text-red-400 mb-6">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-2xl border border-red-205/30"><AlertTriangle size={24}/></div>
                <div>
                    <h2 className="text-xl font-black">منطقة الصيانة وإبادة بيانات المتجر</h2>
                    <p className="text-xs text-red-500 dark:text-red-450 mt-1">تنبيه: العمليات الواردة هنا نهائية ومدمرة للبيانات المسحوبة ولا يمكن بأي حال استردادها.</p>
                </div>
            </div>

            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-2">اختر المتجر لتصفير محتواه:</label>
                    <select 
                        className="w-full p-3 bg-white dark:bg-slate-905 rounded-xl border border-slate-300 dark:border-slate-800 outline-none text-xs font-bold"
                        value={selectedStore.id}
                        onChange={(e) => setSelectedStore(stores.find(s => s.id === e.target.value) || stores[0])}
                    >
                        {stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
                    </select>
                </div>
                
                <div className="flex gap-2 justify-end">
                     <button 
                         onClick={() => { setShowConfirm(true); setConfirmationText(''); setError(''); setSelectedTargets([]); }} 
                         className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all w-max h-max"
                     >
                         <Trash2 size={16}/> تصفير واستئصال البيانات يدوياً
                     </button>
                </div>
            </div>

            {showConfirm && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 text-center border border-slate-300 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-4 border-b dark:border-slate-850 pb-4">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <Trash2 size={20} className="text-red-650"/>
                                حدد فئات البيانات المراد إبادتها لـ [{selectedStore.name}]
                            </h3>
                            <button onClick={() => setShowConfirm(false)}><XCircle className="text-slate-400 hover:text-red-500"/></button>
                        </div>

                        <div className="mb-6 space-y-3">
                            <button onClick={toggleAll} className="text-xs font-bold text-indigo-600 hover:underline mb-2 block w-full text-right" type="button">
                                {selectedTargets.length === availableTargets.length ? 'إلغاء تحديد الكل ☒' : 'تحديد وتظليل الكل ☑'}
                            </button>
                            <div className="grid grid-cols-2 gap-2 text-right max-h-[250px] overflow-y-auto pr-1">
                                {availableTargets.map(target => (
                                    <div 
                                        key={target.id}
                                        onClick={() => toggleTarget(target.id)}
                                        className={`cursor-pointer p-3 rounded-xl border flex items-center gap-2 transition-all ${selectedTargets.includes(target.id) ? 'bg-red-50 dark:bg-red-950/30 border-red-500 text-red-700 dark:text-red-300' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-400'}`}
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedTargets.includes(target.id) ? 'bg-red-500 border-red-500 text-white' : 'border-slate-400'}`}>
                                            {selectedTargets.includes(target.id) && <Check size={10}/>}
                                        </div>
                                        <div className="text-[11px] font-black flex items-center gap-1.5">
                                            {target.icon} {target.label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-850 mb-4">
                            <p className="text-slate-500 dark:text-slate-400 text-xs mb-3 font-bold leading-relaxed">لتأكيد العملية وبدء الحذف النهائي، من فضلك أعد كتابة اسم المتجر بنفس الأحرف تماماً: <span className="font-black text-red-600 select-all">{selectedStore?.name}</span></p>
                            <input 
                                type="text" 
                                className="w-full text-center text-base font-bold p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-305 dark:border-slate-800 outline-none focus:ring-4 focus:ring-red-500/10"
                                placeholder="..."
                                value={confirmationText}
                                onChange={(e) => setConfirmationText(e.target.value)}
                                autoFocus
                            />
                        </div>
                        
                        {error && <p className="text-red-550 font-bold text-xs mb-4 bg-red-50 dark:bg-red-950/20 p-2.5 rounded-lg border border-red-100">{error}</p>}

                        <div className="flex gap-2">
                            <button 
                                onClick={handleClearData} 
                                disabled={isDeleting || !isConfirmationMatch}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase"
                            >
                                {isDeleting ? 'جاري المسح الحتمي...' : `نعم متأكد، امسح (${selectedTargets.length}) عنصر نهائياً`}
                            </button>
                            <button 
                                onClick={() => { setShowConfirm(false); setConfirmationText(''); setError(''); }} 
                                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-all"
                            >
                                تراجع وإلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const TabButton = ({ label, icon, active, onClick, badge }: { label: string, icon: any, active: boolean, onClick: () => void, badge?: number }) => (
    <button 
        onClick={onClick} 
        className={`relative flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs transition-all whitespace-nowrap shrink-0 ${active ? 'bg-slate-900 text-white dark:bg-indigo-600 dark:text-white shadow-md scale-105' : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/50 dark:border-transparent'}`}
    >
        {icon}
        <span>{label}</span>
        {badge !== undefined && badge > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] w-5 h-5 flex items-center justify-center rounded-full font-black animate-pulse shadow-sm">
                {badge}
            </span>
        )}
    </button>
);

const StatCard = ({ title, value, icon }: { title: string, value: any, icon: any }) => (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-250/50 dark:border-slate-850 shadow-sm flex items-center justify-between transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-800">
        <div className="text-right"> 
            <p className="text-slate-400 dark:text-slate-500 text-xs font-black mb-1">{title}</p>
            <p className="text-xl lg:text-2xl font-black text-slate-850 dark:text-white tracking-tight tabular-nums">{value}</p>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl shrink-0">
            {icon}
        </div>
    </div>
);

const PlatformInfrastructureTab: React.FC<{
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    allStoresData: Record<string, StoreData>;
    setAllStoresData: React.Dispatch<React.SetStateAction<Record<string, StoreData>>>;
}> = ({ users, setUsers, allStoresData, setAllStoresData }) => {
    const [mailProvider, setMailProvider] = useState<'resend' | 'brevo' | 'gmail' | 'smtp'>('resend');
    const [mailFrom, setMailFrom] = useState('onboarding@resend.dev');
    const [mailResendKey, setMailResendKey] = useState('');
    const [mailBrevoKey, setMailBrevoKey] = useState('');
    const [mailSmtpHost, setMailSmtpHost] = useState('smtp.gmail.com');
    const [mailSmtpPort, setMailSmtpPort] = useState('587');
    const [mailSmtpUser, setMailSmtpUser] = useState('');
    const [mailSmtpPass, setMailSmtpPass] = useState('');
    const [isSavingMail, setIsSavingMail] = useState(false);
    const [isMailConfigured, setIsMailConfigured] = useState(false);
    const [testEmailRecipient, setTestEmailRecipient] = useState('');
    const [isSendingTestMail, setIsSendingTestMail] = useState(false);

    const [cfSaasStatus, setCfSaasStatus] = useState<{
        loading: boolean;
        configured: boolean;
        isSaaSActive: boolean;
        fallbackOrigin: string | null;
        fallbackStatus: string;
        message: string;
        settingFallback: boolean;
    }>({
        loading: false,
        configured: false,
        isSaaSActive: false,
        fallbackOrigin: null,
        fallbackStatus: '',
        message: '',
        settingFallback: false
    });
    const [fallbackInput, setFallbackInput] = useState('fallback.abdomedi.com');
    const [d1Health, setD1Health] = useState<{ loading: boolean; ok?: boolean; message?: string }>({ loading: false });

    const checkSaas = async () => {
        setCfSaasStatus(prev => ({ ...prev, loading: true }));
        try {
            const res = await fetch('/api/cloudflare/saas-status');
            const data = await res.json();
            setCfSaasStatus({
                loading: false,
                configured: Boolean(data.configured),
                isSaaSActive: Boolean(data.isSaaSActive),
                fallbackOrigin: data.fallbackOrigin || 'fallback.abdomedi.com',
                fallbackStatus: data.fallbackStatus || 'active',
                message: data.message || '',
                settingFallback: false
            });
            if (data.fallbackOrigin) setFallbackInput(data.fallbackOrigin);
        } catch (err: any) {
            setCfSaasStatus(prev => ({ ...prev, loading: false, message: err?.message || 'تعذر فحص حالة Cloudflare SaaS' }));
        }
    };

    useEffect(() => {
        fetch('/api/smtp-config')
            .then(r => r.json())
            .then(data => {
                if (data) {
                    if (data.provider) setMailProvider(data.provider);
                    if (data.from) setMailFrom(data.from);
                    if (data.configured) setIsMailConfigured(true);
                }
            })
            .catch(() => {});
        void checkSaas();
    }, []);

    const handleSaveMailConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingMail(true);
        try {
            const payload: any = {
                provider: mailProvider,
                from: mailFrom.trim(),
                user: mailSmtpUser.trim() || mailFrom.trim()
            };
            if (mailProvider === 'resend') payload.resendApiKey = mailResendKey.trim();
            else if (mailProvider === 'brevo') payload.brevoApiKey = mailBrevoKey.trim();
            else if (mailProvider === 'gmail') {
                payload.host = 'smtp.gmail.com';
                payload.port = 587;
                payload.pass = mailSmtpPass.trim();
            } else {
                payload.host = mailSmtpHost.trim();
                payload.port = Number(mailSmtpPort) || 587;
                payload.pass = mailSmtpPass.trim();
            }

            const res = await fetch('/api/save-smtp-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                setIsMailConfigured(true);
                await inAppAlert('تم حفظ وتفعيل خادم البريد المركزي للمنصة بنجاح!', { type: 'success' });
            } else {
                await inAppAlert(data.error || 'فشل حفظ إعدادات البريد المركزي.', { type: 'error' });
            }
        } catch (err: any) {
            await inAppAlert(err?.message || 'خطأ في الاتصال بالخادم.', { type: 'error' });
        } finally {
            setIsSavingMail(false);
        }
    };

    const handleSendTestMail = async () => {
        if (!testEmailRecipient || !testEmailRecipient.includes('@')) {
            await inAppAlert('يرجى إدخال بريد إلكتروني صالح للتجربة.', { type: 'warning' });
            return;
        }
        setIsSendingTestMail(true);
        try {
            const res = await fetch('/api/send-account-activation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: testEmailRecipient.trim(),
                    userName: 'اختبار البريد المركزي للمنصة',
                    activationCode: '123456'
                })
            });
            const data = await res.json();
            if (data.success || data.delivered) {
                await inAppAlert(`تم إرسال رسالة الاختبار بنجاح إلى (${testEmailRecipient})!`, { type: 'success' });
            } else {
                await inAppAlert(data.error || 'فشل إرسال رسالة الاختبار.', { type: 'error' });
            }
        } catch (err: any) {
            await inAppAlert(err?.message || 'خطأ أثناء إرسال البريد التجريبي.', { type: 'error' });
        } finally {
            setIsSendingTestMail(false);
        }
    };

    const handleSetFallbackOrigin = async () => {
        setCfSaasStatus(prev => ({ ...prev, settingFallback: true }));
        try {
            const res = await fetch('/api/cloudflare/set-fallback-origin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ origin: fallbackInput.trim() || 'fallback.abdomedi.com' })
            });
            const data = await res.json();
            if (data.success) {
                await inAppAlert(data.message || 'تم تحديث Fallback Origin بنجاح.', { type: 'success' });
                await checkSaas();
            } else {
                await inAppAlert(data.error || 'تعذر ضبط Fallback Origin.', { type: 'error' });
                setCfSaasStatus(prev => ({ ...prev, settingFallback: false }));
            }
        } catch (err: any) {
            await inAppAlert(err?.message || 'خطأ أثناء الاتصال بـ Cloudflare API.', { type: 'error' });
            setCfSaasStatus(prev => ({ ...prev, settingFallback: false }));
        }
    };

    const handleVerifyD1 = async () => {
        setD1Health({ loading: true });
        try {
            const check = await db.verifyCloudflareD1Connection();
            if (check.success) {
                setD1Health({
                    loading: false,
                    ok: true,
                    message: `متصل بنجاح — المتاجر السحابية: ${check.storesCount ?? 0} | المستخدمون: ${check.usersCount ?? 0}`
                });
            } else {
                setD1Health({ loading: false, ok: false, message: check.error || 'تعذر الاتصال بـ Cloudflare D1' });
            }
        } catch (err: any) {
            setD1Health({ loading: false, ok: false, message: err?.message || 'خطأ أثناء فحص الاتصال' });
        }
    };

    const handleExportMasterBackup = () => {
        const masterPayload = {
            version: '2.0',
            exportedAt: new Date().toISOString(),
            users,
            allStoresData
        };
        const blob = new Blob([JSON.stringify(masterPayload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `platform-master-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportMasterBackup = async (file: File) => {
        const confirmed = await inAppConfirm(
            'هل أنت متأكد من استيراد نسخة النظام الكلي؟ سيتم تحديث بيانات المستخدمين والمتاجر من ملف النسخة الاحتياطية.',
            { title: 'تأكيد استعادة النسخة الشاملة للنظام', type: 'warning', confirmText: 'نعم، استيراد الآن', cancelText: 'إلغاء' }
        );
        if (!confirmed) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (!parsed || typeof parsed !== 'object') throw new Error('ملف JSON غير صالح');
            if (Array.isArray(parsed.users)) {
                setUsers(parsed.users);
                await db.saveGlobalData({ users: parsed.users, loyaltyData: {} });
            }
            if (parsed.allStoresData && typeof parsed.allStoresData === 'object') {
                setAllStoresData(parsed.allStoresData);
                const allStores = (parsed.users || users).flatMap((u: User) => u.stores || []);
                for (const [sid, sData] of Object.entries(parsed.allStoresData)) {
                    const storeMeta = allStores.find((s: Store) => s.id === sid) || ({ id: sid, name: (sData as any)?.settings?.storeName || sid } as Store);
                    await db.saveStoreData(storeMeta, sData as StoreData);
                }
            }
            await inAppAlert('تم استيراد واستعادة النسخة الشاملة للنظام على Cloudflare D1 بنجاح!', { type: 'success' });
        } catch (err: any) {
            await inAppAlert(`فشل استيراد النسخة الشاملة: ${err?.message || err}`, { type: 'error' });
        }
    };

    const customDomainStores = useMemo(() => {
        const list: { storeId: string; storeName: string; ownerName: string; customDomain: string; subdomain: string }[] = [];
        users.forEach(u => {
            (u.stores || []).forEach(s => {
                const sData = allStoresData[s.id];
                const dom = sData?.settings?.customDomain || sData?.settings?.customAppDomain || (s as any).customDomain || '';
                if (dom) {
                    list.push({
                        storeId: s.id,
                        storeName: s.name,
                        ownerName: u.fullName,
                        customDomain: dom,
                        subdomain: sData?.settings?.subdomain || s.subdomain || ''
                    });
                }
            });
        });
        return list;
    }, [users, allStoresData]);

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* 1. Database Health & Master Backup */}
            <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-indigo-600 text-white shadow-sm">
                            <Database size={22} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">البنية السحابية (Cloudflare D1) والنسخ الاحتياطي الشامل للنظام</h3>
                            <p className="text-xs text-slate-500">مراقبة اتصال قاعدة البيانات السحابية الموحدة وأخذ نسخة احتياطية شاملة لجميع المتاجر والمستخدمين.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={handleVerifyD1}
                            disabled={d1Health.loading}
                            className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-all flex items-center gap-2 cursor-pointer"
                        >
                            <RefreshCw size={14} className={d1Health.loading ? 'animate-spin text-indigo-600' : 'text-indigo-600'} />
                            <span>فحص اتصال Cloudflare D1</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleExportMasterBackup}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                        >
                            <CloudUpload size={14} />
                            <span>تصدير نسخة النظام الكلي (.json)</span>
                        </button>
                        <label className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-2 cursor-pointer">
                            <CloudDownload size={14} />
                            <span>استيراد نسخة النظام الكلي</span>
                            <input
                                type="file"
                                accept=".json"
                                className="hidden"
                                onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) void handleImportMasterBackup(file);
                                }}
                            />
                        </label>
                    </div>
                </div>

                {d1Health.message && (
                    <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 border ${
                        d1Health.ok
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                    }`}>
                        {d1Health.ok ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                        <span>{d1Health.message}</span>
                    </div>
                )}
            </div>

            {/* 2. Cloudflare SaaS Custom Domains Infrastructure */}
            <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-emerald-600 text-white shadow-sm">
                            <Globe size={22} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">بنية النطاقات المخصصة للمتاجر (Cloudflare for SaaS / Custom Hostnames)</h3>
                            <p className="text-xs text-slate-500">إدارة نقطة التوجيه المركزية (Fallback Origin) التي يستقبل عليها النظام دومينات المتاجر المشتراة.</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={checkSaas}
                        disabled={cfSaasStatus.loading}
                        className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer"
                    >
                        <RefreshCw size={14} className={cfSaasStatus.loading ? 'animate-spin' : ''} />
                        <span>تحديث الحالة</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500">نقطة التوجيه المركزية (Fallback Origin):</span>
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-black font-mono" dir="ltr">
                                {cfSaasStatus.fallbackOrigin || 'fallback.abdomedi.com'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            {cfSaasStatus.message || 'يتم ربط النطاقات المخصصة للمتاجر وحفظها في قاعدة بيانات D1 مع التحقق التلقائي من سجلات الـ DNS.'}
                        </p>
                        <div className="flex gap-2" dir="ltr">
                            <input
                                type="text"
                                value={fallbackInput}
                                onChange={e => setFallbackInput(e.target.value)}
                                placeholder="fallback.abdomedi.com"
                                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono outline-none"
                            />
                            <button
                                type="button"
                                onClick={handleSetFallbackOrigin}
                                disabled={cfSaasStatus.settingFallback}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black cursor-pointer shrink-0"
                            >
                                {cfSaasStatus.settingFallback ? 'جاري الضبط...' : 'تعيين Fallback Origin'}
                            </button>
                        </div>
                    </div>

                    <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-slate-800 dark:text-white">المتاجر المربوطة بنطاقات مخصصة حالياً</h4>
                            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-black tabular-nums">
                                {customDomainStores.length}
                            </span>
                        </div>
                        {customDomainStores.length === 0 ? (
                            <p className="text-xs text-slate-400 py-4 text-center">لا توجد متاجر مرتبطة بنطاق مخصص حتى الآن. يمكن لأي تاجر ربط نطاقه من قسم "ربط النطاق المخصص والدومين".</p>
                        ) : (
                            <div className="space-y-2 max-h-44 overflow-y-auto">
                                {customDomainStores.map(item => (
                                    <div key={item.storeId} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 text-xs">
                                        <div>
                                            <p className="font-black text-slate-800 dark:text-white">{item.storeName}</p>
                                            <p className="text-[11px] text-slate-400">{item.ownerName}</p>
                                        </div>
                                        <a
                                            href={`https://${item.customDomain}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                                            dir="ltr"
                                        >
                                            {item.customDomain}
                                        </a>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 3. Central Platform Mailer (SMTP / Resend / Brevo) */}
            <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-rose-600 text-white shadow-sm">
                            <Mail size={22} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">خادم البريد المركزي للمنصة (Platform Global Mailer)</h3>
                            <p className="text-xs text-slate-500">يُستخدم لإرسال أكواد التفعيل، استعادة كلمات المرور، وإشعارات النظام لجميع التجار والعملاء.</p>
                        </div>
                    </div>
                    <span className={`px-3 py-1 rounded-xl text-xs font-black ${
                        isMailConfigured
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                        {isMailConfigured ? 'خادم البريد مفعل ✅' : 'بانتظار الإعداد ⚙️'}
                    </span>
                </div>

                <form onSubmit={handleSaveMailConfig} className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { id: 'resend', label: 'Resend API' },
                            { id: 'brevo', label: 'Brevo API' },
                            { id: 'gmail', label: 'Gmail SMTP' },
                            { id: 'smtp', label: 'Custom SMTP' }
                        ].map(p => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => setMailProvider(p.id as any)}
                                className={`py-2.5 px-4 rounded-xl font-black text-xs border transition-all cursor-pointer ${
                                    mailProvider === p.id
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">البريد المرسل (From Email)</label>
                            <input
                                type="text"
                                value={mailFrom}
                                onChange={e => setMailFrom(e.target.value)}
                                dir="ltr"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono outline-none"
                            />
                        </div>

                        {mailProvider === 'resend' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Resend API Key</label>
                                <input
                                    type="password"
                                    value={mailResendKey}
                                    onChange={e => setMailResendKey(e.target.value)}
                                    placeholder="re_xxxxxxxxx"
                                    dir="ltr"
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono outline-none"
                                />
                            </div>
                        )}

                        {mailProvider === 'brevo' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Brevo API Key</label>
                                <input
                                    type="password"
                                    value={mailBrevoKey}
                                    onChange={e => setMailBrevoKey(e.target.value)}
                                    placeholder="xkeysib-xxxxxxxxx"
                                    dir="ltr"
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono outline-none"
                                />
                            </div>
                        )}

                        {(mailProvider === 'gmail' || mailProvider === 'smtp') && (
                            <>
                                {mailProvider === 'smtp' && (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">SMTP Host</label>
                                            <input
                                                type="text"
                                                value={mailSmtpHost}
                                                onChange={e => setMailSmtpHost(e.target.value)}
                                                dir="ltr"
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">SMTP Port</label>
                                            <input
                                                type="number"
                                                value={mailSmtpPort}
                                                onChange={e => setMailSmtpPort(e.target.value)}
                                                dir="ltr"
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono outline-none"
                                            />
                                        </div>
                                    </>
                                )}
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">اسم المستخدم (SMTP User)</label>
                                    <input
                                        type="text"
                                        value={mailSmtpUser}
                                        onChange={e => setMailSmtpUser(e.target.value)}
                                        dir="ltr"
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">كلمة مرور التطبيق (App Password)</label>
                                    <input
                                        type="password"
                                        value={mailSmtpPass}
                                        onChange={e => setMailSmtpPass(e.target.value)}
                                        dir="ltr"
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono outline-none"
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
                        <div className="flex items-center gap-2 flex-1 max-w-md">
                            <input
                                type="email"
                                value={testEmailRecipient}
                                onChange={e => setTestEmailRecipient(e.target.value)}
                                placeholder="بريد إلكتروني لتجربة الإرسال..."
                                dir="ltr"
                                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono outline-none"
                            />
                            <button
                                type="button"
                                onClick={handleSendTestMail}
                                disabled={isSendingTestMail}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black cursor-pointer shrink-0"
                            >
                                {isSendingTestMail ? 'جاري الإرسال...' : 'إرسال تجربة'}
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={isSavingMail}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                        >
                            <Save size={15} />
                            <span>{isSavingMail ? 'جاري الحفظ...' : 'حفظ إعدادات البريد المركزي'}</span>
                        </button>
                    </div>
                </form>
            </div>

            {/* 4. Central Payment Gateway (MoneyHash API Keys & Merchant Sub-Account Provisioning) */}
            <MoneyHashAdminSection
                users={users}
                allStoresData={allStoresData}
                setAllStoresData={setAllStoresData}
            />
        </div>
    );
};

const MoneyHashAdminSection: React.FC<{
    users: User[];
    allStoresData: Record<string, StoreData>;
    setAllStoresData: React.Dispatch<React.SetStateAction<Record<string, StoreData>>>;
}> = ({ users, allStoresData, setAllStoresData }) => {
    const allStores = useMemo(() => users.flatMap(u => (u.stores || []).map(s => ({ store: s, owner: u }))), [users]);
    const [targetStoreId, setTargetStoreId] = useState<string>(() => allStores[0]?.store.id || 'all');
    const selectedStoreData = targetStoreId !== 'all' ? allStoresData[targetStoreId] : allStoresData[allStores[0]?.store.id || ''];
    const initialMh = selectedStoreData?.settings?.moneyHashConfig || DEFAULT_MONEYHASH_CONFIG;

    const [mode, setMode] = useState<'test' | 'live'>(initialMh.mode || 'test');
    const [apiKey, setApiKey] = useState<string>(initialMh.apiKey || '');
    const [publicApiKey, setPublicApiKey] = useState<string>(initialMh.publicApiKey || '');
    const [accountKey, setAccountKey] = useState<string>(initialMh.accountKey || '');
    const [webhookSecret, setWebhookSecret] = useState<string>(initialMh.webhookSecret || '');
    const [isTesting, setIsTesting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isCreatingSub, setIsCreatingSub] = useState(false);

    useEffect(() => {
        const sd = targetStoreId !== 'all' ? allStoresData[targetStoreId] : allStoresData[allStores[0]?.store.id || ''];
        const cfg = sd?.settings?.moneyHashConfig || DEFAULT_MONEYHASH_CONFIG;
        setMode(cfg.mode || 'test');
        setApiKey(cfg.apiKey || '');
        setPublicApiKey(cfg.publicApiKey || '');
        setAccountKey(cfg.accountKey || '');
        setWebhookSecret(cfg.webhookSecret || '');
    }, [targetStoreId, allStoresData, allStores]);

    const handleTestConnection = async () => {
        setIsTesting(true);
        try {
            const res = await fetch('/api/moneyhash/create-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: 10,
                    currency: 'EGP',
                    orderNumber: 'ADMIN_TEST_INIT',
                    customerName: 'اختبار مدير المنصة',
                    mode,
                    apiKey,
                    publicApiKey
                })
            });
            const data = await res.json();
            if (data.success) {
                await inAppAlert(`تم اختبار الاتصال ببوابة MoneyHash بنجاح (${mode === 'live' ? 'البيئة الحية Live' : 'بيئة الاختبار Sandbox'})!`, { type: 'success' });
            } else {
                await inAppAlert(data.error || 'تعذر الاتصال ببوابة MoneyHash. تأكد من صحة المفتاح السري.', { type: 'error' });
            }
        } catch (err: any) {
            await inAppAlert(err?.message || 'خطأ في الاتصال بالخادم.', { type: 'error' });
        } finally {
            setIsTesting(false);
        }
    };

    const handleCreateSubAccount = async () => {
        if (targetStoreId === 'all') {
            await inAppAlert('يرجى اختيار متجر محدد من القائمة لإنشاء حساب تاجر فرعي (Sub-Account) خاص به.', { type: 'warning' });
            return;
        }
        const entry = allStores.find(e => e.store.id === targetStoreId);
        if (!entry) return;
        setIsCreatingSub(true);
        try {
            const res = await createMoneyHashAccount({
                name: entry.store.name,
                email: entry.owner.email || '',
                phone: entry.owner.phone || '',
                country: 'EG',
                currency: 'EGP',
                config: {
                    ...(selectedStoreData?.settings?.moneyHashConfig || DEFAULT_MONEYHASH_CONFIG),
                    mode,
                    apiKey,
                    publicApiKey,
                    accountKey,
                    webhookSecret
                }
            });
            if (res.success && (res.accountKey || res.accountId)) {
                const newAccKey = res.accountKey || res.accountId || '';
                setAccountKey(newAccKey);
                await inAppAlert(`تم إنشاء حساب تاجر فرعي للمتجر "${entry.store.name}" بنجاح: ${newAccKey}`, { type: 'success' });
            } else {
                await inAppAlert(res.message || 'تعذر إنشاء الحساب الفرعي عبر MoneyHash API.', { type: 'error' });
            }
        } catch (err: any) {
            await inAppAlert(err?.message || 'خطأ أثناء إنشاء الحساب الفرعي.', { type: 'error' });
        } finally {
            setIsCreatingSub(false);
        }
    };

    const handleSaveGatewayKeys = async () => {
        setIsSaving(true);
        try {
            const targets = targetStoreId === 'all' ? allStores : allStores.filter(e => e.store.id === targetStoreId);
            const nextMap = { ...allStoresData };
            for (const { store } of targets) {
                const cur = nextMap[store.id];
                if (!cur) continue;
                const prevMh = cur.settings?.moneyHashConfig || DEFAULT_MONEYHASH_CONFIG;
                const updatedMh = {
                    ...prevMh,
                    mode,
                    apiKey: apiKey.trim(),
                    publicApiKey: publicApiKey.trim(),
                    webhookSecret: webhookSecret.trim(),
                    accountKey: targetStoreId === 'all' ? prevMh.accountKey : accountKey.trim()
                };
                const updatedStoreData: StoreData = {
                    ...cur,
                    settings: {
                        ...cur.settings,
                        moneyHashConfig: updatedMh
                    }
                };
                nextMap[store.id] = updatedStoreData;
                await db.saveStoreData(store, updatedStoreData);
            }
            setAllStoresData(nextMap);
            await inAppAlert(
                targetStoreId === 'all'
                    ? `تم حفظ وتعميم مفاتيح بوابة الدفع المركزية (MoneyHash) على (${targets.length}) متجر بنجاح!`
                    : 'تم حفظ مفاتيح بوابة الدفع ومعرف الحساب الفرعي للمتجر المحدد بنجاح!',
                { type: 'success' }
            );
        } catch (err: any) {
            await inAppAlert(err?.message || 'حدث خطأ أثناء حفظ إعدادات بوابة الدفع.', { type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-purple-600 text-white shadow-sm">
                        <CreditCard size={22} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white">مفاتيح بوابة الدفع المركزية والحسابات الفرعية (MoneyHash API v1.1)</h3>
                        <p className="text-xs text-slate-500">إدارة المفاتيح السرية (Live/Sandbox) وتوليد الحسابات الفرعية للمتاجر مركزياً (مخفية عن التجار).</p>
                    </div>
                </div>
                <select
                    value={targetStoreId}
                    onChange={e => setTargetStoreId(e.target.value)}
                    className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-black outline-none"
                >
                    <option value="all">🌐 تعميم المفاتيح الرئيسية على جميع المتاجر ({allStores.length})</option>
                    {allStores.map(({ store, owner }) => (
                        <option key={store.id} value={store.id}>
                            🏪 {store.name} — ({owner.fullName})
                        </option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">بيئة التشغيل (Mode)</label>
                    <select
                        value={mode}
                        onChange={e => setMode(e.target.value as 'test' | 'live')}
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none"
                    >
                        <option value="test">🧪 Sandbox / Test (بيئة الاختبار)</option>
                        <option value="live">🚀 Production / Live (البيئة الحية المباشرة)</option>
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">المفتاح السري (Secret API Key)</label>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder="mh_sec_live_... أو mh_sec_test_..."
                        dir="ltr"
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono outline-none"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">المفتاح العام (Public API Key)</label>
                    <input
                        type="text"
                        value={publicApiKey}
                        onChange={e => setPublicApiKey(e.target.value)}
                        placeholder="mh_pub_..."
                        dir="ltr"
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono outline-none"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">توقيع الويب هوك (Webhook Secret)</label>
                    <input
                        type="text"
                        value={webhookSecret}
                        onChange={e => setWebhookSecret(e.target.value)}
                        placeholder="mh_wh_..."
                        dir="ltr"
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono outline-none"
                    />
                </div>

                <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">معرف الحساب الفرعي للتاجر (Sub-Account Key)</label>
                        {targetStoreId !== 'all' && (
                            <button
                                type="button"
                                onClick={handleCreateSubAccount}
                                disabled={isCreatingSub}
                                className="text-[11px] font-black text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                                <UserPlus size={12} />
                                <span>{isCreatingSub ? 'جاري التوليد...' : 'توليد حساب فرعي جديد عبر API v1.1'}</span>
                            </button>
                        )}
                    </div>
                    <input
                        type="text"
                        value={targetStoreId === 'all' ? '' : accountKey}
                        onChange={e => setAccountKey(e.target.value)}
                        disabled={targetStoreId === 'all'}
                        placeholder={targetStoreId === 'all' ? 'اختر متجراً محدداً لتخصيص أو توليد Sub-Account خاص به' : 'mh_acc_...'}
                        dir="ltr"
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono outline-none disabled:opacity-50"
                    />
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-2 cursor-pointer"
                >
                    <RefreshCw size={14} className={isTesting ? 'animate-spin' : ''} />
                    <span>{isTesting ? 'جاري فحص الاتصال...' : 'اختبار صحة مفاتيح MoneyHash'}</span>
                </button>

                <button
                    type="button"
                    onClick={handleSaveGatewayKeys}
                    disabled={isSaving}
                    className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black flex items-center gap-2 shadow-sm cursor-pointer"
                >
                    <Save size={15} />
                    <span>{isSaving ? 'جاري الحفظ...' : 'حفظ ومزامنة إعدادات بوابة الدفع (D1)'}</span>
                </button>
            </div>
        </div>
    );
};

// -------------------------------------------------------------------------------------------------
// بطاقة التحكم المركزي في رقم الدعم الفني والواتساب على مستوى المشروع بالكامل (Project-Wide Support Number)
// -------------------------------------------------------------------------------------------------
const ProjectWideSupportContactCard: React.FC<{
  users: User[];
  allStoresData: Record<string, StoreData>;
  setAllStoresData: React.Dispatch<React.SetStateAction<Record<string, StoreData>>>;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}> = ({ users, allStoresData, setAllStoresData, setSettings }) => {
  const defaultAdmin = useMemo(() => users.find(u => u.isAdmin), [users]);
  const fallbackPhone = defaultAdmin?.phone || '01000000000';
  const fallbackName = defaultAdmin?.fullName || 'أحمد — الدعم الفني';

  const [supportPhone, setSupportPhone] = useState(() =>
    getCachedPlatformSupportPhone(fallbackPhone)
  );
  const [agentName, setAgentName] = useState(
    () => getCachedPlatformSupportAgent(fallbackName).name
  );
  const [agentTitle, setAgentTitle] = useState(
    () => getCachedPlatformSupportAgent(fallbackName).title
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchPlatformSupportConfig(fallbackPhone, fallbackName).then(cfg => {
      if (!mounted) return;
      if (cfg.phone) setSupportPhone(cfg.phone);
      if (cfg.defaultAgentName) setAgentName(cfg.defaultAgentName);
      if (cfg.defaultAgentTitle) setAgentTitle(cfg.defaultAgentTitle);
    });
    const onUpdated = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.phone) setSupportPhone(detail.phone);
      if (detail?.defaultAgentName) setAgentName(detail.defaultAgentName);
      if (detail?.defaultAgentTitle) setAgentTitle(detail.defaultAgentTitle);
    };
    window.addEventListener('platform-support-updated', onUpdated);
    return () => {
      mounted = false;
      window.removeEventListener('platform-support-updated', onUpdated);
    };
  }, [fallbackPhone, fallbackName]);

  const handleSaveGlobalSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPhone = supportPhone.trim();
    if (!trimmedPhone) {
      await inAppAlert('يرجى إدخال رقم هاتف / واتساب الدعم الفني أولاً.', { type: 'warning' });
      return;
    }
    setIsSaving(true);
    try {
      await saveProjectWideSupportConfig({
        phone: trimmedPhone,
        defaultAgentName: agentName.trim() || fallbackName,
        defaultAgentTitle: agentTitle.trim() || 'فريق الدعم الفني',
        users,
        allStoresData,
        setAllStoresData,
        setSettings
      });
      const storesCount = Object.keys(allStoresData || {}).length;
      await inAppAlert(
        `تم تحديث وتعميم رقم الدعم الفني (${trimmedPhone}) على مستوى المشروع بالكامل وجميع المتاجر (${storesCount} متجر) وبوابات التجار والوكلاء وشاشات استعادة الحساب بنجاح!`,
        { type: 'success' }
      );
    } catch {
      await inAppAlert('حدث خطأ أثناء حفظ رقم الدعم الموحد على السيرفر.', { type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-[#f7f8f4] dark:bg-slate-900 border-2 border-emerald-200 dark:border-emerald-900/50 shadow-sm">
      <form onSubmit={handleSaveGlobalSupport} className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-emerald-200/70 dark:border-slate-800 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
              <Headphones size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-black">
                  إعداد مركزي على مستوى المشروع بالكامل
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200 text-[11px] font-mono font-black tabular-nums" dir="ltr">
                  {supportPhone || '01000000000'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1">
                رقم الدعم الفني والواتساب الموحد على مستوى المشروع (Global Support Number)
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                تغيير الرقم هنا يُطبّق فوراً في كل صفحات المشروع: بوابة التجار والوكلاء، شاشات التذاكر والمتاجر الموقوفة، استعادة الحسابات، وإعدادات الدعم لجميع المتاجر.
              </p>
            </div>
          </div>

          <a
            href={buildSupportWhatsAppUrl(supportPhone, 'مرحباً فريق الدعم الفني لمنصة عبده ميديا برايم')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-950 hover:bg-emerald-50 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-slate-800 text-xs font-black transition-all shrink-0"
          >
            <PhoneCall size={14} />
            <span>معاينة رابط واتساب الدعم</span>
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4 space-y-1.5">
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300">
              رقم هاتف / واتساب الدعم الفني للمشروع:
            </label>
            <input
              type="tel"
              dir="ltr"
              value={supportPhone}
              onChange={e => setSupportPhone(e.target.value)}
              placeholder="01012345678 أو 201012345678"
              className="w-full p-3 rounded-2xl bg-white dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 text-sm font-mono font-black text-slate-900 dark:text-white tabular-nums outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
            />
          </div>

          <div className="md:col-span-3 space-y-1.5">
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300">
              اسم المرسل الافتراضي لفريق الدعم:
            </label>
            <input
              type="text"
              value={agentName}
              onChange={e => setAgentName(e.target.value)}
              placeholder="مثال: أحمد — الدعم الفني"
              className="w-full p-3 rounded-2xl bg-white dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 text-xs font-black text-slate-900 dark:text-white outline-none focus:border-emerald-500"
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300">
              المسمى الوظيفي للدعم:
            </label>
            <input
              type="text"
              value={agentTitle}
              onChange={e => setAgentTitle(e.target.value)}
              placeholder="فريق الدعم الفني"
              className="w-full p-3 rounded-2xl bg-white dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3.5 px-5 rounded-2xl bg-[#00c48c] hover:bg-[#00b07d] text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-[#00c48c]/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save size={16} />
              <span>{isSaving ? 'جاري التعميم والحفظ...' : 'حفظ وتعميم على المشروع بالكامل'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

// -------------------------------------------------------------------------------------------------
// مركز إدارة المتاجر والحسابات الموقوفة ونظام تذاكر وشات الدعم الفني (Support Tickets & Chat Center)
// -------------------------------------------------------------------------------------------------
const SuspendedAppealsCenter: React.FC<{
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  allStoresData?: Record<string, StoreData>;
  setAllStoresData?: React.Dispatch<React.SetStateAction<Record<string, StoreData>>>;
  setSettings?: React.Dispatch<React.SetStateAction<Settings>>;
  compact?: boolean;
}> = ({ users, setUsers, allStoresData, setAllStoresData, setSettings, compact = false }) => {
  const defaultAdminName = useMemo(() => {
    const adminUser = users.find(u => u.isAdmin && u.fullName);
    return adminUser?.fullName || 'أحمد — الدعم الفني';
  }, [users]);

  const fallbackPhone = useMemo(() => {
    const adminUser = users.find(u => u.isAdmin && u.phone);
    return adminUser?.phone || '01000000000';
  }, [users]);

  const [supportWhatsapp, setSupportWhatsapp] = useState(() =>
    getCachedPlatformSupportPhone(fallbackPhone)
  );
  const [isSavingWhatsapp, setIsSavingWhatsapp] = useState(false);
  const [agentSenderName, setAgentSenderName] = useState(
    () => getCachedPlatformSupportAgent(defaultAdminName).name
  );
  const [agentSenderTitle, setAgentSenderTitle] = useState(
    () => getCachedPlatformSupportAgent(defaultAdminName).title
  );
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [reasonTexts, setReasonTexts] = useState<Record<string, string>>({});
  const [autoCloseSettings, setAutoCloseSettings] = useState<Record<string, number>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchPlatformSupportConfig(fallbackPhone, defaultAdminName).then(cfg => {
      if (!mounted) return;
      if (cfg.phone) setSupportWhatsapp(cfg.phone);
      if (cfg.defaultAgentName) setAgentSenderName(cfg.defaultAgentName);
      if (cfg.defaultAgentTitle) setAgentSenderTitle(cfg.defaultAgentTitle);
    });
    const onUpdated = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.phone) setSupportWhatsapp(detail.phone);
      if (detail?.defaultAgentName) setAgentSenderName(detail.defaultAgentName);
      if (detail?.defaultAgentTitle) setAgentSenderTitle(detail.defaultAgentTitle);
    };
    window.addEventListener('platform-support-updated', onUpdated);
    return () => {
      mounted = false;
      window.removeEventListener('platform-support-updated', onUpdated);
    };
  }, [fallbackPhone, defaultAdminName]);

  const [ticketsViewMode, setTicketsViewMode] = useState<'active' | 'archive'>('active');
  const [expandedArchiveKey, setExpandedArchiveKey] = useState<string | null>(null);

  const suspendedItems = useMemo(() => {
    const items: Array<{
      key: string;
      type: 'store' | 'user';
      owner: User;
      store?: Store;
      banReason?: string;
      appeal?: SupportAppeal;
      history: SupportAppeal[];
    }> = [];

    users.forEach(u => {
      if (u.isBanned) {
        items.push({
          key: `user_${u.phone}`,
          type: 'user',
          owner: u,
          banReason: u.banReason,
          appeal: u.supportAppeal,
          history: Array.isArray(u.supportTicketsHistory) ? u.supportTicketsHistory : []
        });
      }
      (u.stores || []).forEach(s => {
        if (s.isBanned) {
          items.push({
            key: `store_${s.id}`,
            type: 'store',
            owner: u,
            store: s,
            banReason: s.banReason,
            appeal: s.supportAppeal,
            history: Array.isArray(s.supportTicketsHistory) ? s.supportTicketsHistory : []
          });
        }
      });
    });

    return items.sort((a, b) => {
      const aPending = a.appeal?.status === 'pending' ? 1 : 0;
      const bPending = b.appeal?.status === 'pending' ? 1 : 0;
      return bPending - aPending;
    });
  }, [users]);

  // All closed / resolved / archived tickets across all users & stores (even after unban or new ticket)
  const archivedTicketsList = useMemo(() => {
    const list: Array<{
      archiveKey: string;
      ticket: SupportAppeal;
      owner: User;
      store?: Store;
      isCurrentlyBanned: boolean;
    }> = [];

    users.forEach(u => {
      (u.supportTicketsHistory || []).forEach(t => {
        list.push({
          archiveKey: `uhist_${u.phone}_${t.id}`,
          ticket: t,
          owner: u,
          isCurrentlyBanned: Boolean(u.isBanned)
        });
      });
      if (
        u.supportAppeal &&
        (u.supportAppeal.status === 'closed' || u.supportAppeal.status === 'resolved' || !u.isBanned)
      ) {
        list.push({
          archiveKey: `ucur_${u.phone}_${u.supportAppeal.id}`,
          ticket: u.supportAppeal,
          owner: u,
          isCurrentlyBanned: Boolean(u.isBanned)
        });
      }

      (u.stores || []).forEach(s => {
        (s.supportTicketsHistory || []).forEach(t => {
          list.push({
            archiveKey: `shist_${s.id}_${t.id}`,
            ticket: t,
            owner: u,
            store: s,
            isCurrentlyBanned: Boolean(s.isBanned)
          });
        });
        if (
          s.supportAppeal &&
          (s.supportAppeal.status === 'closed' || s.supportAppeal.status === 'resolved' || !s.isBanned)
        ) {
          list.push({
            archiveKey: `scur_${s.id}_${s.supportAppeal.id}`,
            ticket: s.supportAppeal,
            owner: u,
            store: s,
            isCurrentlyBanned: Boolean(s.isBanned)
          });
        }
      });
    });

    return list.sort((a, b) => {
      const tA = new Date(a.ticket.closedAt || a.ticket.repliedAt || a.ticket.createdAt || 0).getTime();
      const tB = new Date(b.ticket.closedAt || b.ticket.repliedAt || b.ticket.createdAt || 0).getTime();
      return tB - tA;
    });
  }, [users]);

  if (compact && suspendedItems.length === 0) {
    return null;
  }

  const handleSaveSupportWhatsapp = async () => {
    setIsSavingWhatsapp(true);
    try {
      await saveProjectWideSupportConfig({
        phone: supportWhatsapp.trim(),
        defaultAgentName: agentSenderName.trim() || defaultAdminName,
        defaultAgentTitle: agentSenderTitle.trim() || 'فريق الدعم الفني',
        users,
        allStoresData,
        setAllStoresData,
        setSettings
      });
      await inAppAlert(
        'تم حفظ وتعميم رقم الدعم الفني واسم المرسل على مستوى المشروع بالكامل وجميع المتاجر بنجاح.',
        { type: 'success' }
      );
    } catch {
      await inAppAlert('تعذر حفظ إعدادات الدعم على السيرفر.', { type: 'error' });
    } finally {
      setIsSavingWhatsapp(false);
    }
  };

  const persistItemAppeal = async (
    item: (typeof suspendedItems)[0],
    nextReason: string | undefined,
    nextAppeal: SupportAppeal | undefined,
    nextHistory?: SupportAppeal[]
  ) => {
    const historyToKeep = nextHistory ?? item.history;
    const updatedOwner: User =
      item.type === 'store' && item.store
        ? {
            ...item.owner,
            stores: (item.owner.stores || []).map(s =>
              s.id === item.store!.id
                ? {
                    ...s,
                    banReason: nextReason,
                    supportAppeal: nextAppeal,
                    supportTicketsHistory: historyToKeep
                  }
                : s
            )
          }
        : {
            ...item.owner,
            banReason: nextReason,
            supportAppeal: nextAppeal,
            supportTicketsHistory: historyToKeep
          };

    const updatedUsers = users.map(u => (u.phone === item.owner.phone ? updatedOwner : u));
    setUsers(updatedUsers);
    await db.createUserDoc(updatedOwner);
    await db.saveGlobalData({ users: updatedUsers, loyaltyData: {} });
  };

  const handleSendSupportReply = async (item: (typeof suspendedItems)[0]) => {
    const replyText = (replyTexts[item.key] || '').trim();
    const reasonText = (reasonTexts[item.key] ?? item.banReason ?? '').trim();
    const closeMins = autoCloseSettings[item.key] ?? item.appeal?.autoCloseMinutes ?? 60;

    if (!replyText && reasonText === (item.banReason || '')) {
      await inAppAlert('يرجى كتابة رسالة الرد أولاً أو تعديل سبب الإيقاف.', { type: 'warning' });
      return;
    }

    // Clear the reply box immediately so the message moves into the chat thread
    setReplyTexts(prev => ({ ...prev, [item.key]: '' }));
    setBusyKey(item.key);

    try {
      const nowIso = new Date().toISOString();
      const existingMsgs = buildNormalizedTicketMessages(item.appeal, item.owner.fullName);
      const senderDisplayName = agentSenderName.trim() || defaultAdminName;
      const senderDisplayTitle = agentSenderTitle.trim() || 'فريق الدعم الفني';

      let nextMessages: SupportTicketMessage[] = [...existingMsgs];
      if (replyText) {
        nextMessages.push({
          id: `MSG-S-${Date.now()}`,
          senderRole: 'support',
          senderName: senderDisplayName,
          senderTitle: senderDisplayTitle,
          text: replyText,
          createdAt: nowIso
        });
      }

      const isPermanentLock = closeMins === -1;
      const isImmediateClose = closeMins === 0 || isPermanentLock;
      const computedAutoCloseAt =
        replyText && closeMins > 0
          ? new Date(Date.now() + closeMins * 60 * 1000).toISOString()
          : item.appeal?.autoCloseAt;

      const updatedAppeal: SupportAppeal | undefined =
        item.appeal || replyText
          ? {
              id: item.appeal?.id || `APPEAL-${Date.now()}`,
              ticketNumber:
                item.appeal?.ticketNumber || `TKT-${String(Date.now()).slice(-4)}`,
              targetType: item.type,
              storeId: item.store?.id,
              storeName: item.store?.name,
              ownerPhone: item.owner.phone,
              ownerName: item.owner.fullName,
              message: item.appeal?.message || 'محادثة دعم فني',
              createdAt: item.appeal?.createdAt || nowIso,
              status: isImmediateClose
                ? 'closed'
                : replyText
                ? 'replied'
                : item.appeal?.status || 'pending',
              adminReply: replyText || item.appeal?.adminReply,
              repliedAt: replyText ? nowIso : item.appeal?.repliedAt,
              repliedByName: replyText ? senderDisplayName : item.appeal?.repliedByName,
              messages: nextMessages,
              autoCloseMinutes: closeMins > 0 ? closeMins : 60,
              autoCloseAt: isImmediateClose ? undefined : computedAutoCloseAt,
              closedAt: isImmediateClose ? nowIso : undefined,
              closedBy: isPermanentLock
                ? `قفل نهائي بواسطة ${senderDisplayName}`
                : isImmediateClose
                ? `أُغلقت بواسطة ${senderDisplayName}`
                : undefined,
              lockedByAdmin: isPermanentLock ? true : false,
              reopenCount: item.appeal?.reopenCount || 0
            }
          : undefined;

      await persistItemAppeal(item, reasonText || undefined, updatedAppeal);
    } catch {
      setReplyTexts(prev => ({ ...prev, [item.key]: replyText }));
      await inAppAlert('حدث خطأ أثناء إرسال الرد على السيرفر.', { type: 'error' });
    } finally {
      setBusyKey(null);
    }
  };

  const handleToggleTicketClose = async (
    item: (typeof suspendedItems)[0],
    lockPermanently: boolean = false
  ) => {
    if (!item.appeal) return;
    const isClosed = item.appeal.status === 'closed' || item.appeal.status === 'resolved';
    setBusyKey(item.key);
    try {
      const nowIso = new Date().toISOString();
      const senderDisplayName = agentSenderName.trim() || defaultAdminName;
      const nextAppeal: SupportAppeal =
        isClosed && !lockPermanently
          ? {
              ...item.appeal,
              status: 'pending',
              autoCloseAt: undefined,
              closedAt: undefined,
              closedBy: undefined,
              lockedByAdmin: false
            }
          : {
              ...item.appeal,
              status: 'closed',
              autoCloseAt: undefined,
              closedAt: nowIso,
              closedBy: lockPermanently
                ? `قفل نهائي بواسطة ${senderDisplayName}`
                : `أُغلقت بواسطة ${senderDisplayName}`,
              lockedByAdmin: lockPermanently
            };
      await persistItemAppeal(item, item.banReason, nextAppeal);
      await inAppAlert(
        isClosed && !lockPermanently
          ? 'تم إعادة فتح التذكرة بنجاح.'
          : lockPermanently
          ? 'تم قفل التذكرة نهائياً ومنع التاجر من فتح تذكرة أخرى لنفس الطلب.'
          : 'تم إغلاق التذكرة بنجاح.',
        { type: 'success' }
      );
    } catch {
      await inAppAlert('تعذر تحديث حالة التذكرة.', { type: 'error' });
    } finally {
      setBusyKey(null);
    }
  };

  const handleUnbanQuick = async (item: (typeof suspendedItems)[0]) => {
    const targetLabel =
      item.type === 'store' && item.store
        ? `متجر "${item.store.name}"`
        : `حساب التاجر "${item.owner.fullName}"`;

    const ok = await inAppConfirm(`هل تريد فك الحظر وإعادة تفعيل ${targetLabel} فوراً؟`, {
      title: 'فك الحظر وإعادة التفعيل',
      type: 'info',
      confirmText: 'نعم، تفعيل فوراً',
      cancelText: 'تراجع'
    });
    if (!ok) return;

    setBusyKey(item.key);
    try {
      const resolvedAppeal = item.appeal
        ? {
            ...item.appeal,
            status: 'resolved' as const,
            closedAt: new Date().toISOString(),
            closedBy: 'تم حل المشكلة وإعادة تفعيل المتجر'
          }
        : undefined;

      // Also archive the resolved ticket into supportTicketsHistory so it remains in the Archive forever
      const nextHistory = resolvedAppeal
        ? [resolvedAppeal, ...item.history.filter(h => h.id !== resolvedAppeal.id)]
        : item.history;

      const updatedOwner: User =
        item.type === 'store' && item.store
          ? {
              ...item.owner,
              stores: (item.owner.stores || []).map(s =>
                s.id === item.store!.id
                  ? {
                      ...s,
                      isBanned: false,
                      supportAppeal: resolvedAppeal,
                      supportTicketsHistory: nextHistory
                    }
                  : s
              )
            }
          : {
              ...item.owner,
              isBanned: false,
              supportAppeal: resolvedAppeal,
              supportTicketsHistory: nextHistory
            };

      const updatedUsers = users.map(u => (u.phone === item.owner.phone ? updatedOwner : u));
      setUsers(updatedUsers);
      await db.createUserDoc(updatedOwner);
      await db.saveGlobalData({ users: updatedUsers, loyaltyData: {} });

      await inAppAlert(`تم فك الحظر وإعادة تفعيل ${targetLabel} وأرشفة التذكرة في السجل بنجاح!`, {
        type: 'success'
      });
    } catch {
      await inAppAlert('تعذر تحديث حالة فك الحظر على السيرفر.', { type: 'error' });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-[#f7f8f4] dark:bg-slate-900/90 border-2 border-emerald-200/80 dark:border-emerald-900/50 shadow-sm space-y-5">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-emerald-200/60 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-black">
              <MessageSquare size={13} />
              نظام تذاكر وشات الدعم الفني للمتاجر الموقوفة
            </span>
            {suspendedItems.length > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black tabular-nums">
                {suspendedItems.length} حساب/متجر موقوف حالياً
              </span>
            )}
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
            محادثات تذاكر المراجعة والرد باسم فريق الدعم
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            تظهر هنا محادثة التاجر كشريط رسائل (Chat Thread)، مع حفظ أي تذكرة مغلقة في أرشيف التذاكر ومنع التاجر من فتح أكثر من تذكرة لنفس الطلب.
          </p>
        </div>

        {/* Support Agent Identity & WhatsApp Bar */}
        <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-950 p-2.5 rounded-2xl border border-emerald-200/80 dark:border-slate-800">
          <div className="px-2 border-l border-slate-200 dark:border-slate-800">
            <label className="block text-[10px] font-black text-emerald-700">
              اسم المرسل من فريق الدعم:
            </label>
            <input
              type="text"
              value={agentSenderName}
              onChange={e => setAgentSenderName(e.target.value)}
              placeholder="مثال: أحمد — الدعم الفني"
              className="w-36 text-xs font-black text-slate-900 dark:text-white bg-transparent outline-none"
            />
          </div>

          <div className="px-2 border-l border-slate-200 dark:border-slate-800">
            <label className="block text-[10px] font-black text-slate-500">
              المسمى الوظيفي:
            </label>
            <input
              type="text"
              value={agentSenderTitle}
              onChange={e => setAgentSenderTitle(e.target.value)}
              placeholder="فريق الدعم الفني"
              className="w-28 text-xs font-bold text-slate-700 dark:text-slate-300 bg-transparent outline-none"
            />
          </div>

          <div className="px-2">
            <label className="block text-[10px] font-black text-slate-500">
              واتساب الدعم (للمشروع):
            </label>
            <input
              type="tel"
              dir="ltr"
              value={supportWhatsapp}
              onChange={e => setSupportWhatsapp(e.target.value)}
              placeholder="01012345678"
              className="w-32 text-xs font-mono font-black text-slate-900 dark:text-white bg-transparent outline-none tabular-nums"
            />
          </div>

          <button
            type="button"
            onClick={handleSaveSupportWhatsapp}
            disabled={isSavingWhatsapp}
            className="px-3.5 py-2 rounded-xl bg-[#00c48c] hover:bg-[#00b07d] text-slate-950 font-black text-xs transition-all cursor-pointer shrink-0"
          >
            {isSavingWhatsapp ? 'يحفظ...' : 'حفظ وتعميم'}
          </button>
        </div>
      </div>

      {/* View Switcher Tabs: Active Tickets vs Closed/Archived Tickets */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-white dark:bg-slate-950 p-1.5 rounded-2xl border border-emerald-200/80 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setTicketsViewMode('active')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              ticketsViewMode === 'active'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <MessageSquare size={14} />
            <span>التذاكر والحالات الموقوفة الحالية ({suspendedItems.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTicketsViewMode('archive')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              ticketsViewMode === 'archive'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock size={14} />
            <span>أرشيف التذاكر المغلقة والسابقة ({archivedTicketsList.length})</span>
          </button>
        </div>

        <span className="text-[11px] font-bold text-slate-500">
          💡 عند إغلاق تذكرة وفتح تذكرة متابعة جديدة، تُحفظ التذكرة القديمة تلقائياً في «أرشيف التذاكر المغلقة» وفي سجل المتجر.
        </span>
      </div>

      {ticketsViewMode === 'archive' ? (
        archivedTicketsList.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-950 border border-emerald-100 dark:border-slate-800 text-center space-y-1">
            <p className="text-sm font-black text-slate-700 dark:text-slate-300">
              لا توجد تذاكر مغلقة أو مؤرشفة في السجل حتى الآن.
            </p>
            <p className="text-xs text-slate-500">
              أي تذكرة يتم إغلاقها أو حلها أو أرشفتها ستظهر هنا بكامل محادثاتها للرجوع إليها في أي وقت.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {archivedTicketsList.map(({ archiveKey, ticket, owner, store, isCurrentlyBanned }) => {
              const msgs = buildNormalizedTicketMessages(ticket, owner.fullName);
              const isOpenCard = expandedArchiveKey === archiveKey;
              return (
                <div
                  key={archiveKey}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono text-[11px] font-black tabular-nums">
                          #{ticket.ticketNumber || ticket.id.slice(-6)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                            ticket.status === 'resolved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ticket.lockedByAdmin
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {ticket.status === 'resolved'
                            ? '✅ تم الحل وتفعيل المتجر'
                            : ticket.lockedByAdmin
                            ? '🔒 مغلقة نهائياً'
                            : '📁 تذكرة مغلقة ومؤرشفة'}
                        </span>
                        {isCurrentlyBanned && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-black">
                            المتجر لا يزال موقوفاً
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white mt-1">
                        {store ? `متجر: ${store.name}` : `حساب: ${owner.fullName}`}
                      </h4>
                      <p className="text-[11px] font-bold text-slate-500">
                        التاجر: {owner.fullName} ({owner.phone}) • عدد الرسائل: {msgs.length}
                      </p>
                      {ticket.closedBy && (
                        <p className="text-[11px] font-bold text-emerald-700 mt-0.5">
                          حالة الإغلاق: {ticket.closedBy}{' '}
                          {ticket.closedAt
                            ? `(${new Date(ticket.closedAt).toLocaleString('ar-EG')})`
                            : ''}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedArchiveKey(isOpenCard ? null : archiveKey)
                      }
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black cursor-pointer shrink-0"
                    >
                      {isOpenCard ? 'إخفاء المحادثة' : `عرض المحادثة (${msgs.length})`}
                    </button>
                  </div>

                  {isOpenCard && (
                    <div className="p-3 rounded-xl bg-[#f7f8f4] border border-slate-200 space-y-2 max-h-56 overflow-y-auto">
                      {msgs.map(m => (
                        <div
                          key={m.id}
                          className={`p-2.5 rounded-xl text-xs border ${
                            m.senderRole === 'merchant'
                              ? 'bg-white border-slate-200 text-slate-800'
                              : m.senderRole === 'system'
                              ? 'bg-amber-50 border-amber-200 text-amber-900 text-center'
                              : 'bg-emerald-600 text-white border-emerald-700'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] font-black mb-1 opacity-80">
                            <span>
                              {m.senderName} ({m.senderTitle || (m.senderRole === 'merchant' ? 'التاجر' : 'الدعم الفني')})
                            </span>
                            <span className="font-mono tabular-nums">
                              {new Date(m.createdAt).toLocaleString('ar-EG')}
                            </span>
                          </div>
                          <p className="font-bold whitespace-pre-wrap">{m.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : suspendedItems.length === 0 ? (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-950 border border-emerald-100 dark:border-slate-800 text-center space-y-1">
          <p className="text-sm font-black text-emerald-700 dark:text-emerald-400">
            لا توجد أي متاجر أو حسابات موقوفة حالياً — جميع المتاجر تعمل بشكل طبيعي ✅
          </p>
          <p className="text-xs text-slate-500">
            عند إيقاف أي متجر أو تاجر، ستظهر هنا تذاكر ومحادثات المراجعة الخاصة به للرد عليها أو تفعيلها.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {suspendedItems.map(item => {
            const currentReason = reasonTexts[item.key] ?? item.banReason ?? '';
            const currentReply = replyTexts[item.key] ?? '';
            const closeMins = autoCloseSettings[item.key] ?? item.appeal?.autoCloseMinutes ?? 60;
            const isBusy = busyKey === item.key;
            const threadMessages = buildNormalizedTicketMessages(item.appeal, item.owner.fullName);
            const isClosed =
              item.appeal?.status === 'closed' || item.appeal?.status === 'resolved';

            return (
              <div
                key={item.key}
                className="p-5 rounded-3xl bg-white dark:bg-slate-950 border border-emerald-200/80 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  {/* Card Top Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-black">
                          {item.type === 'store' ? 'متجر موقوف' : 'حساب تاجر موقوف'}
                        </span>
                        {item.appeal?.ticketNumber && (
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-mono font-black tabular-nums">
                            #{item.appeal.ticketNumber}
                          </span>
                        )}
                        {item.appeal?.status === 'pending' && (
                          <span className="px-2.5 py-0.5 rounded-lg bg-rose-600 text-white text-[11px] font-black animate-pulse">
                            بانتظار رد الدعم
                          </span>
                        )}
                        {item.appeal?.status === 'replied' && (
                          <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-black">
                            تم الرد (تُغلق تلقائياً)
                          </span>
                        )}
                        {isClosed && (
                          <span className="px-2.5 py-0.5 rounded-lg bg-slate-200 text-slate-700 text-[11px] font-black">
                            {item.appeal?.lockedByAdmin ? '🔒 مغلقة نهائياً' : '🔒 تذكرة مغلقة'}
                          </span>
                        )}
                        {item.history.length > 0 && (
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black">
                            +{item.history.length} تذاكر سابقة بالأرشيف
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-black text-slate-900 dark:text-white mt-1.5">
                        {item.type === 'store' && item.store
                          ? `متجر: ${item.store.name}`
                          : `التاجر: ${item.owner.fullName}`}
                      </h4>
                      <p className="text-xs font-bold text-slate-500">
                        المالك: {item.owner.fullName} • الهاتف:{' '}
                        <span className="font-mono tabular-nums" dir="ltr">
                          {item.owner.phone}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {item.appeal && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleTicketClose(item, false)}
                            disabled={isBusy}
                            className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                            title={isClosed ? 'إعادة فتح التذكرة' : 'إغلاق التذكرة'}
                          >
                            {isClosed ? <Unlock size={13} /> : <Lock size={13} />}
                            <span>{isClosed ? 'إعادة فتح' : 'إغلاق التذكرة'}</span>
                          </button>
                          {!item.appeal.lockedByAdmin && (
                            <button
                              type="button"
                              onClick={() => handleToggleTicketClose(item, true)}
                              disabled={isBusy}
                              className="px-2.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-black text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                              title="قفل التذكرة نهائياً ومنع العميل من فتح تذكرة أخرى لنفس الطلب"
                            >
                              <Lock size={13} />
                              <span>قفل نهائي</span>
                            </button>
                          )}
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => handleUnbanQuick(item)}
                        disabled={isBusy}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <Unlock size={14} />
                        <span>فك الحظر وتفعيل</span>
                      </button>
                    </div>
                  </div>

                  {/* Ban Reason Field */}
                  <div>
                    <label className="block text-[11px] font-black text-slate-600 dark:text-slate-400 mb-1">
                      سبب الإيقاف المسجل (يظهر للتاجر أعلى التذكرة):
                    </label>
                    <input
                      type="text"
                      value={currentReason}
                      onChange={e =>
                        setReasonTexts(prev => ({ ...prev, [item.key]: e.target.value }))
                      }
                      placeholder="مثال: مخالفة السياسة أو مراجعة الحسابات المالية..."
                      className="w-full p-2.5 rounded-xl bg-amber-50/50 dark:bg-slate-900 border border-amber-200 dark:border-slate-800 text-xs font-bold outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Chronological Chat Thread */}
                  <div className="rounded-2xl bg-[#f7f8f4] dark:bg-slate-900 border border-emerald-200/70 dark:border-slate-800 overflow-hidden">
                    <div className="px-3.5 py-2 bg-white dark:bg-slate-950 border-b border-emerald-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-black text-slate-600">
                      <span>سجل محادثة التذكرة الحالية ({threadMessages.length} رسائل)</span>
                      {item.appeal?.autoCloseAt && !isClosed && (
                        <span className="text-amber-700 font-mono tabular-nums">
                          إغلاق تلقائي: {new Date(item.appeal.autoCloseAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    <div className="p-3.5 max-h-[240px] overflow-y-auto space-y-2.5">
                      {threadMessages.length === 0 ? (
                        <p className="text-center py-6 text-xs font-bold text-slate-400">
                          لم يرسل التاجر أي رسالة في هذه التذكرة بعد. يمكنك إرسال رسالة إدارية له بالأسفل.
                        </p>
                      ) : (
                        threadMessages.map(msg => {
                          if (msg.senderRole === 'system' || msg.isSystemNotice) {
                            return (
                              <div key={msg.id} className="flex items-center justify-center my-1.5">
                                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-black">
                                  {msg.text}
                                </span>
                              </div>
                            );
                          }
                          const isMerchant = msg.senderRole === 'merchant';
                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${isMerchant ? 'items-start' : 'items-end'}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-2xl p-3 text-xs shadow-sm border ${
                                  isMerchant
                                    ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-tr-none'
                                    : 'bg-emerald-600 text-white border-emerald-700 rounded-tl-none'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 mb-1 pb-1 border-b border-current/10 text-[10px]">
                                  <span className="font-black">
                                    {msg.senderName}{' '}
                                    <span className="opacity-75 font-bold">
                                      ({msg.senderTitle || (isMerchant ? 'مالك المتجر' : 'الدعم الفني')})
                                    </span>
                                  </span>
                                  <span className="font-mono tabular-nums opacity-80">
                                    {new Date(msg.createdAt).toLocaleTimeString('ar-EG', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                                <p className="font-bold leading-relaxed whitespace-pre-wrap">
                                  {msg.text}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Support Agent Reply Composer */}
                    <div className="p-3 bg-white dark:bg-slate-950 border-t border-emerald-100 dark:border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-400">
                          إرسال رد باسم: <strong className="underline">{agentSenderName || defaultAdminName}</strong>
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                          <Clock size={12} className="text-amber-600" />
                          <span>إغلاق التذكرة بعد الرد:</span>
                          <select
                            value={closeMins}
                            onChange={e =>
                              setAutoCloseSettings(prev => ({
                                ...prev,
                                [item.key]: Number(e.target.value)
                              }))
                            }
                            className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] font-black text-slate-800 dark:text-white outline-none"
                          >
                            <option value={15}>بعد 15 دقيقة</option>
                            <option value={30}>بعد 30 دقيقة</option>
                            <option value={60}>بعد ساعة (60 د)</option>
                            <option value={1440}>بعد 24 ساعة</option>
                            <option value={0}>إغلاق التذكرة فوراً</option>
                            <option value={-1}>قفل نهائي (منع تذكرة جديدة) 🔒</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-end gap-2">
                        <textarea
                          rows={2}
                          value={currentReply}
                          onChange={e =>
                            setReplyTexts(prev => ({ ...prev, [item.key]: e.target.value }))
                          }
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (currentReply.trim() && !isBusy) {
                                void handleSendSupportReply(item);
                              }
                            }
                          }}
                          placeholder="اكتب رد الدعم الفني هنا... (ينتقل للشات فوراً بعد الإرسال)"
                          className="flex-1 p-2.5 rounded-xl bg-[#f7f8f4] dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 text-xs font-bold outline-none focus:bg-white focus:border-emerald-500 resize-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSendSupportReply(item)}
                          disabled={isBusy}
                          className="h-[58px] px-4 rounded-xl bg-[#00c48c] hover:bg-[#00b07d] text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0 disabled:opacity-50"
                        >
                          <Send size={14} />
                          <span>{isBusy ? 'يرسل...' : 'إرسال الرد'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Per-Store Archived Previous Closed Tickets */}
                  {item.history.length > 0 && (
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                      <p className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                        📂 التذاكر المغلقة السابقة لهذا المتجر ({item.history.length}):
                      </p>
                      <div className="space-y-1.5">
                        {item.history.map(oldTkt => {
                          const histKey = `inline_${item.key}_${oldTkt.id}`;
                          const isExpanded = expandedArchiveKey === histKey;
                          const oldMsgs = buildNormalizedTicketMessages(oldTkt, item.owner.fullName);
                          return (
                            <div
                              key={oldTkt.id}
                              className="rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedArchiveKey(isExpanded ? null : histKey)
                                }
                                className="w-full px-3 py-2 flex items-center justify-between text-right text-[11px] font-black text-slate-700 hover:bg-slate-50 cursor-pointer"
                              >
                                <span>
                                  تذكرة #{oldTkt.ticketNumber || oldTkt.id.slice(-6)} ({oldMsgs.length} رسائل)
                                </span>
                                <span className="text-emerald-700">
                                  {isExpanded ? 'إخفاء ▲' : 'عرض المحادثة ▼'}
                                </span>
                              </button>
                              {isExpanded && (
                                <div className="p-2.5 bg-[#f7f8f4] border-t border-slate-100 space-y-1.5 max-h-40 overflow-y-auto">
                                  {oldMsgs.map(m => (
                                    <div
                                      key={m.id}
                                      className="p-2 rounded-lg bg-white border border-slate-200 text-[11px]"
                                    >
                                      <span className="font-black text-emerald-800">
                                        {m.senderName}:{' '}
                                      </span>
                                      <span className="font-bold text-slate-700">{m.text}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminPage;
