import React, { useState, useMemo, useEffect } from 'react';
import { User, Store, StoreData, Employee, Permission, PERMISSIONS, Transaction, WithdrawRequest, Settings } from '../types';
import { INITIAL_SETTINGS } from '../constants';
import { 
    Users, Store as StoreIcon, Activity, Search, ShieldAlert, LogIn, Ban, CheckCircle, 
    Lock, Unlock, LayoutDashboard, TrendingUp, MessageSquare, Send, UserPlus, Clock, 
    UserCog, XCircle, KeyRound, Check, X, Settings as SettingsIcon, ShoppingCart, 
    Package, Wallet, Tag, AlertTriangle, Trash2, ShoppingBasket, Grid, Copy, Plus, 
    ArrowLeftRight, AlertCircle, RefreshCw
} from 'lucide-react';
import * as db from '../services/databaseService';
import { clearStoreData } from '../services/databaseService';
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
    const [filterType, setFilterType] = useState<'all' | 'deposit' | 'withdraw'>('all');

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500);
    };

    // Sort logic to get pending deposits and withdrawals
    const requests = useMemo(() => {
        let reqs: any[] = [];
        Object.entries(allStoresData).forEach(([storeId, storeData]) => {
            const owner = users.find(u => u.stores?.some(s => s.id === storeId));
            const storeInfo = owner?.stores?.find(s => s.id === storeId);
            
            storeData.wallet?.transactions?.forEach(t => {
                if (t.status === 'pending') {
                    // if it's a withdrawal, find the withdraw request to get bank details
                    let details = t.note || 'لا توجد تفاصيل';
                    if (t.type === 'سحب') {
                        const reqId = t.id.replace('W-', '');
                        const wReq = storeData.wallet?.withdrawRequests?.find(r => r?.id === reqId);
                        if (wReq) details = wReq.details || details;
                    }
                    reqs.push({
                        ...t,
                        storeId,
                        storeName: storeInfo?.name || 'غير معروف',
                        ownerName: owner?.fullName || 'غير معروف',
                        details
                    });
                }
            });
        });

        const sorted = reqs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        if (filterType === 'deposit') return sorted.filter(r => r.type === 'إيداع');
        if (filterType === 'withdraw') return sorted.filter(r => r.type === 'سحب');
        return sorted;
    }, [allStoresData, users, filterType]);

    const handleAction = async (transaction: any, action: 'approve' | 'reject') => {
        const storeId = transaction.storeId;
        
        // Prepare updated store data
        let storeData = { ...allStoresData[storeId] };
        if (!storeData || !storeData.wallet) return;

        // update transaction
        const updatedTransactions = storeData.wallet.transactions.map(t => {
             if (t.id === transaction.id) {
                  return { ...t, status: action === 'approve' ? 'completed' : 'cancelled' };
             }
             return t;
        });

        // if withdrawal, update withdraw request too
        let updatedWithdrawRequests = storeData.wallet.withdrawRequests || [];
        if (transaction.type === 'سحب') {
             const reqId = transaction.id.replace('W-', '');
             updatedWithdrawRequests = updatedWithdrawRequests.map(r => {
                 if (r.id === reqId) {
                     return { ...r, status: action === 'approve' ? 'accepted' : 'rejected' };
                 }
                 return r;
             });
        }

        let newBalance = storeData.wallet.balance || 0;
        if (transaction.type === 'إيداع') {
             if (action === 'approve') newBalance += transaction.amount;
        } else if (transaction.type === 'سحب') {
             if (action === 'reject') newBalance += transaction.amount;
        }

        const newStoreData = {
            ...storeData,
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
                <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-700 dark:text-slate-300">عرض المعاملات المعلقة بقيمة:</span>
                    <div className="flex bg-white dark:bg-slate-900 border dark:border-slate-800 p-1 rounded-xl">
                        <button 
                            onClick={() => setFilterType('all')} 
                            className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all ${filterType === 'all' ? 'bg-slate-800 dark:bg-slate-700 text-white' : 'text-slate-400'}`}
                        >الجميع ({requests.length})</button>
                        <button 
                            onClick={() => setFilterType('deposit')} 
                            className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all ${filterType === 'deposit' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
                        >شحن رصيد ({requests.filter(r => r.type === 'إيداع').length})</button>
                        <button 
                            onClick={() => setFilterType('withdraw')} 
                            className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all ${filterType === 'withdraw' ? 'bg-red-600 text-white' : 'text-slate-400'}`}
                        >سحب كاش ({requests.filter(r => r.type === 'سحب').length})</button>
                    </div>
                </div>
            </div>

            {requests.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-dashed dark:border-slate-800">
                    <Activity className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={44} />
                    <p className="text-slate-500 font-bold">لا توجد طلبات مالية معلقة للقرار الحالي.</p>
                </div>
            ) : (
                <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
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
                                        {req.amount.toLocaleString()} ج.م
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
  onImpersonate: (user: User) => void;
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
            
            return {
                ...prevData,
                [store.id]: {
                    ...storeData,
                    settings: {
                        ...storeData.settings,
                        employees: storeData.settings.employees.map(e => e.id === employee.id ? updatedEmployee : e)
                    }
                }
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
                                                <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-black">{employee.name.substring(0,2)}</div>
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

const AdminPage: React.FC<AdminPageProps> = ({ users, setUsers, allStoresData, setAllStoresData, onImpersonate, currentUser, settings, setSettings }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'stores' | 'financial' | 'fee_settings' | 'danger_zone'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Custom Platform broad Announcement Types
  const [announcementText, setAnnouncementText] = useState(() => localStorage.getItem('platform_announcement_text') || '');
  const [announcementType, setAnnouncementType] = useState(() => localStorage.getItem('platform_announcement_type') || 'info');
  
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
        const storeIds: string[] = [];
        users.forEach(u => {
          u.stores?.forEach(s => {
            if (s.id && !storeIds.includes(s.id)) {
              storeIds.push(s.id);
            }
          });
        });

        if (storeIds.length === 0) return;

        // Fetch each store's data in parallel from remote firebase
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
          const next = { ...prev };
          results.forEach(res => {
            if (res && res.data) {
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
  }, [users, setAllStoresData]);

  const pendingRequestsCount = useMemo(() => {
    let count = 0;
      Object.values(allStoresData).forEach((storeData: any) => {
          storeData.wallet?.transactions?.forEach((t: any) => {
              if (t.status === 'pending') {
                  count++;
              }
          });
      });
      return count;
  }, [allStoresData]);

  // Compute all stores list first so it's initialized before charts or stats reference it
  const allStoresList = useMemo(() => {
    let stores: { store: Store, owner: User, totalOrders: number, totalRevenue: number }[] = [];
    users.forEach(user => {
        if(user.stores) {
            user.stores.forEach(store => {
                const storeData = allStoresData[store.id];
                const totalOrders = storeData?.orders?.length || 0;
                const totalRevenue = storeData?.orders?.filter((o: any) => o.status === 'تم_التحصيل').reduce((sum: number, o: any) => sum + (o.productPrice + o.shippingFee - (o.discount || 0)), 0) || 0;
                stores.push({ store, owner: user, totalOrders, totalRevenue });
            });
        }
    });
    return stores.filter(s => s.store.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [users, searchTerm, allStoresData]);

  // Statistics summaries across entire cloud stores
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalOrders = 0;
    let successfulOrders = 0;
    let totalPlatformWalletsBalance = 0;
    
    Object.values(allStoresData).forEach((storeData: any) => {
        totalOrders += (storeData.orders || []).length;
        totalPlatformWalletsBalance += (storeData.wallet?.balance || 0);

        (storeData.orders || []).forEach((order: any) => {
            if (order.status === 'تم_التحصيل') {
                totalRevenue += (order.productPrice + order.shippingFee) - (order.discount || 0);
                successfulOrders++;
            }
        });
    });

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const newUsersThisMonth = users.filter(u => u.joinDate && new Date(u.joinDate) >= firstDayOfMonth).length;
    const newStoresThisMonth = users.reduce((acc, user) => {
        return acc + (user.stores?.filter(s => new Date(s.creationDate) >= firstDayOfMonth).length || 0);
    }, 0);

    return { 
        totalUsers: users.length, 
        totalStores: users.reduce((acc, user) => acc + (user.stores?.length || 0), 0), 
        activeUsers: users.filter(u => !u.isBanned).length,
        totalRevenue,
        averageOrderValue: successfulOrders > 0 ? totalRevenue / successfulOrders : 0,
        newUsersThisMonth,
        newStoresThisMonth,
        totalPlatformWalletsBalance
    };
  }, [users, allStoresData]);

  // Dynamic charts generation
  const chartsData = useMemo(() => {
    const storesRevenue = allStoresList.map(s => ({
      name: s.store.name,
      revenue: s.totalRevenue,
      orders: s.totalOrders
    })).sort((a,b) => b.revenue - a.revenue).slice(0, 6);

    let totalDelivered = 0;
    let totalReturned = 0;
    let totalPendingNew = 0;
    let totalProcessing = 0;
    let totalCancelled = 0;

    Object.values(allStoresData).forEach((storeData: any) => {
      (storeData.orders || []).forEach((o: any) => {
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
  }, [allStoresList, allStoresData]);

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

  const toggleUserBan = async (phone: string) => {
    if(!window.confirm("هل أنت متأكد من تغيير حالة حظر هذا المستخدم؟")) return;
    const updated = users.map(u => u.phone === phone ? { ...u, isBanned: !u.isBanned } : u);
    setUsers(updated);
    try {
        await db.saveGlobalData({ users: updated, loyaltyData: {} });
    } catch (e) {
        alert("فشل تحديث السيرفر العام لمستخدم.");
    }
  };

  // Trigger real persistent announcement
  const handleSaveAnnouncement = () => {
    if (announcementType === 'none') {
        localStorage.removeItem('platform_announcement_text');
        localStorage.removeItem('platform_announcement_type');
        setAnnouncementText('');
        alert('تم إلغاء وحذف الإعلان المنشور بالكامل بنجاح.');
    } else {
        if (!announcementText.trim()) {
            alert('من فضلك اكتب نص الإعلان أولاً.');
            return;
        }
        localStorage.setItem('platform_announcement_text', announcementText);
        localStorage.setItem('platform_announcement_type', announcementType);
        localStorage.removeItem('platform_announcement_dismissed'); // reset dismissed flag for everyone
        alert(`تم بث ونشر الإعلان العام بنجاح من المستوى [${announcementType}]!`);
    }
    // Dispatch storage event to notify current window immediately
    window.dispatchEvent(new Event('storage'));
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

    const newUser: User = {
        fullName: newUserData.fullName,
        phone: newUserData.phone,
        email: newUserData.email,
        password: newUserData.password || 'password123',
        isAdmin: newUserData.isAdmin,
        isBanned: false,
        joinDate: new Date().toISOString(),
        stores: []
    };

    const updatedUsersList = [...users, newUser];
    setUsers(updatedUsersList);

    try {
        await db.saveGlobalData({ users: updatedUsersList, loyaltyData: {} });
        setShowAddUserModal(false);
        setNewUserData({ fullName: '', phone: '', email: '', password: 'password123', isAdmin: false });
        alert('تم تسجيل التاجر/المستخدم الجديد بنجاح على خادم المنصة الرئيسي.');
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
        alert(`تم تجهيز وتخصيص المتجر الجديد [${newStoreObj.name}] بنجاح، وربطه بالتاجر: ${selectedOwner.fullName}`);
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
        setAdjustError(`المبلغ المراد خصمه يدوياً أكبر من رصيد محفظة المتجر الحالي وهو (${currentBalance.toLocaleString()} ج.م)`);
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
        alert(`تمت تسوية الحساب اليدوي للمتجر [${adjustingStoreWallet.name}] بنجاح. الرصيد الجديد: ${newBalance.toLocaleString()} ج.م`);
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
            <p className="text-slate-500 dark:text-slate-400 mt-1.5 font-bold">مرحباً بك، المشرف العام {currentUser.fullName}</p>
        </div>
      </div>

      {/* Tabs list with horizontal scroll styling to handle overflowing elegantly */}
      <div className="flex gap-3 mb-8 overflow-x-auto pb-2 scrollbar-none antialiased">
        <TabButton label="نظرة عامة والتحليلات" icon={<LayoutDashboard size={18}/>} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
        <TabButton label="إدارة المستخدمين" icon={<Users size={18}/>} active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
        <TabButton label="إدارة المتاجر المفتوحة" icon={<StoreIcon size={18}/>} active={activeTab === 'stores'} onClick={() => setActiveTab('stores')} />
        <TabButton label="التسويات والطلبات المالية" icon={<TrendingUp size={18}/>} active={activeTab === 'financial'} onClick={() => setActiveTab('financial')} badge={pendingRequestsCount} />
        <TabButton label="رسوم المنصة والعمولات" icon={<SettingsIcon size={18}/>} active={activeTab === 'fee_settings'} onClick={() => setActiveTab('fee_settings')} />
        <TabButton label="صيانة وإبادة البيانات" icon={<AlertTriangle size={18}/>} active={activeTab === 'danger_zone'} onClick={() => setActiveTab('danger_zone')} />
      </div>

      {/* Main Tab Panels Wrapper */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200/60 dark:border-slate-850 min-h-[500px] p-6 lg:p-8">
        
        {/* Tab content router */}
        {activeTab === 'danger_zone' && (
          <DangerZone stores={users.flatMap(u => u.stores || [])} />
        )}
        
        {activeTab === 'financial' && (
             <FinancialRequestsTab 
                 allStoresData={allStoresData} 
                 setAllStoresData={setAllStoresData}
                 users={users}
             />
        )}
        
        {activeTab === 'fee_settings' && (
          <div className="space-y-6 animate-in face-in duration-300">
            <h2 className="text-xl font-black mb-6 flex items-center gap-2"><SettingsIcon className="text-slate-500" /> إعدادات الرسوم وضبط العمولات</h2>
            <div className="space-y-6">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-right">رسوم السحب المفروضة على شركاء المتاجر</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-850 space-y-4">
                        <div className="flex justify-between items-center">
                            <p className="text-xs font-black text-slate-700 dark:text-slate-300">السحب العادي (مدة معالجة ٢٤-٤٨ ساعة)</p>
                            <div className="flex p-0.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-250 dark:border-slate-800">
                                <button 
                                    onClick={() => setSettings(prev => ({ ...prev, withdrawalFeeType: 'flat' }))}
                                    className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${settings.withdrawalFeeType === 'flat' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >مبلغ ثابت</button>
                                <button 
                                    onClick={() => setSettings(prev => ({ ...prev, withdrawalFeeType: 'percent' }))}
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
                                    if (settings.withdrawalFeeType === 'percent') setSettings(prev => ({ ...prev, withdrawalFeePercent: val }));
                                    else setSettings(prev => ({ ...prev, withdrawalFlatFee: val }));
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
                                    onClick={() => setSettings(prev => ({ ...prev, sameDayWithdrawalFeeType: 'flat' }))}
                                    className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${settings.sameDayWithdrawalFeeType === 'flat' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >مبلغ ثابت</button>
                                <button 
                                    onClick={() => setSettings(prev => ({ ...prev, sameDayWithdrawalFeeType: 'percent' }))}
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
                                    if (settings.sameDayWithdrawalFeeType === 'flat') setSettings(prev => ({ ...prev, sameDayWithdrawalFlatFee: val }));
                                    else setSettings(prev => ({ ...prev, sameDayWithdrawalFeePercent: val }));
                                }}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-2xl px-4 py-3 text-right text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/15"
                                placeholder={settings.sameDayWithdrawalFeeType === 'percent' ? "أدخل النسبة المئوية" : "أدخل المبلغ الثابت للجلسة ج.م"}
                            />
                        </div>
                        <div className="p-3 bg-white/70 dark:bg-black/40 rounded-xl border border-slate-100 dark:border-slate-850">
                            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold leading-relaxed">
                                تنبيه: بالنسبة المئوية، سيتم فرض حد أدنى للمحفظة قدره ٢٥ ج.م عند سحب مبالغ أقل من ٢,٥٠٠ ج.م لضمان تغطية رسوم بوابة التحويل المالي الفوري.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        )}
        
        {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-300">
                
                {/* Visual Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard title="مجموع إيرادات المنصة" value={`${stats.totalRevenue.toLocaleString('ar-EG')} ج.م`} icon={<TrendingUp className="text-emerald-500"/>} />
                    <StatCard title="متوسط السلة المالية" value={`${stats.averageOrderValue.toFixed(0)} ج.م`} icon={<Activity className="text-purple-500"/>} />
                    <StatCard title="مجموع ودائع المحفظة الكلي" value={`${stats.totalPlatformWalletsBalance.toLocaleString('ar-EG')} ج.م`} icon={<Wallet className="text-indigo-500"/>} />
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
                            {chartsData.storesRevenue.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold">لم يسجل أي متجر مبيعات مكتملة كلياً حتى الآن.</div>
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
            </div>
        )}

        {activeTab === 'users' && (
            <div className="space-y-6 animate-in fade-in duration-300">
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

                <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
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
                                    <td className="p-4 font-bold text-emerald-600 dark:text-emerald-400 text-sm">{ltv.toLocaleString('ar-EG')} ج.م</td>
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
                                        <div className="flex justify-end gap-2.5">
                                            <button 
                                                onClick={() => setManagingUser(user)} 
                                                title="إدارة موظفي وصلاحيات المتجر" 
                                                className="p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-600 dark:bg-purple-950/20 dark:hover:bg-purple-900/40 border border-purple-150 dark:border-purple-900/40 transition-all active:scale-95"
                                            >
                                                <UserCog size={15} />
                                            </button>
                                            <button 
                                                onClick={() => onImpersonate(user)} 
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
                                        <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-[10px] text-indigo-700 dark:text-indigo-400 border border-indigo-100/40 rounded-lg font-bold">
                                            {store.specialization || 'عام'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-mono dir-ltr text-right truncate bg-white dark:bg-slate-900 border dark:border-slate-850 px-2.5 py-1 rounded-lg w-max max-w-full">{store.url}</p>
                                </div>

                                <div className="grid grid-cols-3 gap-2 py-3 border-y border-dashed border-slate-200 dark:border-slate-800 my-4 text-right">
                                   <div className="text-xs">
                                        <span className="block text-slate-400 font-bold mb-1">الطلبات</span>
                                        <span className="font-black text-slate-700 dark:text-slate-300 text-sm">{totalOrders}</span>
                                   </div>
                                   <div className="text-xs">
                                        <span className="block text-slate-400 font-bold mb-1">الإيرادات</span>
                                        <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">{totalRevenue.toLocaleString('ar-EG')} ج</span>
                                   </div>
                                   <div className="text-xs">
                                        <span className="block text-slate-400 font-bold mb-1">رصيد المحفظة</span>
                                        <span className={`font-black text-sm ${balance >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-500'}`}>
                                            {balance.toLocaleString('ar-EG')} ج
                                        </span>
                                   </div>
                                </div>

                                <div className="flex gap-2.5 w-full">
                                    <button 
                                        type="button"
                                        onClick={() => onImpersonate(owner)} 
                                        className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl text-center shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1"
                                    >
                                        <LogIn size={13} />
                                        <span>إدارة المتجر</span>
                                    </button>
                                    
                                    <button 
                                        type="button"
                                        onClick={() => setAdjustingStoreWallet({ id: store.id, name: store.name })}
                                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30 border border-indigo-150 dark:border-indigo-900 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1 shrink-0"
                                        title="تعديل مباشر على رصيد المحفظة"
                                    >
                                        <ArrowLeftRight size={13} />
                                        <span>تعديل الرصيد</span>
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


const DangerZone = ({ stores }: { stores: Store[] }) => {
    const [selectedStore, setSelectedStore] = useState<Store | undefined>(stores.length > 0 ? stores[0] : undefined);
    const [showConfirm, setShowConfirm] = useState(false);
    const [confirmationText, setConfirmationText] = useState('');
    const [error, setError] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
    
    if (!selectedStore) {
        return <div className="text-center p-8 bg-slate-50 rounded-2xl">لا توجد متاجر نشطة بالمنصة لتجهيزها للتصفير.</div>;
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
        
        if (selectedTargets.length === 0) {
            setError('يجب اختيار عنصر واحد على الأقل للحذف.');
            return;
        }

        setIsDeleting(true);
        const storeId = selectedStore.id;
        
        if (storeId) {
            const result = await clearStoreData(storeId, selectedTargets);
            if (result.success) {
                alert('تم حذف وتصفير بيانات المتجر ومكوناته المحددة بنجاح تامة.');
                setShowConfirm(false);
                setIsDeleting(false);
            } else {
                setError(result.error || 'حدث خطأ أثناء المسح');
                setIsDeleting(false);
            }
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
            <p className="text-xl lg:text-2xl font-black text-slate-850 dark:text-white tracking-tight">{value}</p>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl shrink-0">
            {icon}
        </div>
    </div>
);

export default AdminPage;
