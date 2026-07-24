import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Employee, Permission, PERMISSIONS, User, Store } from '../types';
import { Users, UserPlus, UserCog, Trash2, XCircle, KeyRound, AlertCircle, Check, Clock, Copy, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { createUserDoc } from '../services/databaseService';
import { getApps, initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const secondaryApp = getApps().find(app => app.name === "SecondaryAppForEmployees") 
    || initializeApp(firebaseConfig, "SecondaryAppForEmployees");
const secondaryAuth = getAuth(secondaryApp);

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
  }
};

const PERMISSION_GROUPS: { title: string; permissions: { key: Permission, label: string }[] }[] = [
  { title: 'الإحصائيات والتقارير', permissions: [ { key: 'DASHBOARD_VIEW', label: 'عرض لوحة التحكم الرئيسية' }, { key: 'REPORTS_VIEW', label: 'الاطلاع على التقارير المتقدمة' } ] },
  { title: 'الطلبات والعمليات', permissions: [ { key: 'ORDERS_VIEW', label: 'عرض الطلبات ومتابعتها' }, { key: 'ORDERS_MANAGE', label: 'إدارة الطلبات بالكامل' }, { key: 'RETURNS_MANAGE', label: 'إدارة المرتجعات' } ] },
  { title: 'نقاط البيع (POS)', permissions: [ { key: 'POS_VIEW', label: 'الاطلاع على نقاط البيع' }, { key: 'POS_MANAGE', label: 'إنشاء طلبات نقطة البيع' } ] },
  { title: 'المنتجات والمخزون', permissions: [ { key: 'PRODUCTS_VIEW', label: 'عرض المنتجات وتفاصيلها' }, { key: 'PRODUCTS_MANAGE', label: 'إضافة وتعديل المنتجات' }, { key: 'INVENTORY_MANAGE', label: 'إدارة المخزون والتحويلات' }, { key: 'COLLECTIONS_MANAGE', label: 'إدارة التصنيفات (الأقسام)' } ] },
  { title: 'العملاء والتسويق', permissions: [ { key: 'CUSTOMERS_VIEW', label: 'الاطلاع على بيانات العملاء' }, { key: 'CUSTOMERS_MANAGE', label: 'إدارة وتعديل بيانات العملاء' }, { key: 'MARKETING_MANAGE', label: 'إدارة التسويق والحملات' }, { key: 'DISCOUNTS_MANAGE', label: 'إدارة كوبونات الخصم' }, { key: 'REVIEWS_MANAGE', label: 'إدارة التقييمات' } ] },
  { title: 'المالية والخزينة', permissions: [ { key: 'WALLET_VIEW', label: 'عرض المحفظة والحسابات' }, { key: 'WALLET_MANAGE', label: 'إدارة السحوبات والتحويلات المالية' }, { key: 'CASH_MANAGE', label: 'إدارة الخزينة والعهدة' }, { key: 'EXPENSES_MANAGE', label: 'إدارة المصروفات' } ] },
  { title: 'الاعدادات والتطبيقات', permissions: [ { key: 'SETTINGS_VIEW', label: 'الاطلاع على الإعدادات العامة' }, { key: 'SETTINGS_MANAGE', label: 'تعديل سياسات وإعدادات المتجر' }, { key: 'STOREFRONT_MANAGE', label: 'تخصيص واجهة المتجر' }, { key: 'APPS_MANAGE', label: 'إدارة التطبيقات والربط' } ] },
  { title: 'فريق العمل والصلاحيات', permissions: [ { key: 'TEAM_VIEW', label: 'عرض فريق العمل والموظفين' }, { key: 'TEAM_MANAGE', label: 'إدارة الموظفين والصلاحيات (للمدير)' } ] },
];

import { ROLES, getRoleName } from '../utils/roles';

// Replaced local ROLES and getRoleName with imports


interface EmployeesPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  currentUser: User | null;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  activeStoreId: string | null;
}

const EmployeesPage: React.FC<EmployeesPageProps> = ({ settings, setSettings, currentUser, users, setUsers, activeStoreId }) => {
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [addEmployeeError, setAddEmployeeError] = useState('');
  const [editEmployeeError, setEditEmployeeError] = useState('');
  const [newEmployeeCredentials, setNewEmployeeCredentials] = useState<{ phone: string, pass: string } | null>(null);
  const [resetPasswordCredentials, setResetPasswordCredentials] = useState<{ phone: string, pass: string } | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);

  const owner = useMemo(() => 
      users.find(u => u.stores?.some(s => s.id === activeStoreId)),
      [users, activeStoreId]
  );

  const handleSaveEmployee = async (employeeData: Omit<Employee, 'id'> & { id?: string; phone?: string }) => {
    if (!employeeData.id) return;
    setEditEmployeeError('');

    const originalEmployee = settings.employees.find(e => e.id === employeeData.id);
    const newPhone = employeeData.phone?.trim() || employeeData.id;

    if (newPhone !== employeeData.id) {
        if (settings.employees.some(e => e.id === newPhone)) {
            setEditEmployeeError('رقم الهاتف الجديد مستخدم بالفعل لموظف آخر.');
            return;
        }
    }

    if (originalEmployee && originalEmployee.email !== employeeData.email) {
        if (users.some(u => u.email === employeeData.email && u.phone !== employeeData.id)) {
            setEditEmployeeError('هذا البريد الإلكتروني مستخدم بالفعل لحساب آخر.');
            return;
        }
    }

    let tempPassword = '';
    if (newPhone !== employeeData.id) {
        tempPassword = Math.random().toString(36).slice(-8);
        const firebaseEmail = `${newPhone}@mystore-auth.app`;
        try {
            await createUserWithEmailAndPassword(secondaryAuth, firebaseEmail, tempPassword);
            await secondaryAuth.signOut();
        } catch (err: any) {
            if (err.code !== 'auth/email-already-in-use') {
                setEditEmployeeError(`فشل في إنشاء حساب المصادقة الجديد: ${err.message}`);
                return;
            }
        }

        const newUser: User = { 
            fullName: employeeData.name, 
            phone: newPhone, 
            email: employeeData.email, 
            joinDate: new Date().toISOString() 
        };
        const success = await createUserDoc(newUser);
        if (!success) {
            setEditEmployeeError('فشل إنشاء حساب الموظف في قاعدة البيانات.');
            return;
        }

        setUsers(prev => {
            const filtered = prev.filter(u => u.phone !== employeeData.id);
            return [...filtered, newUser];
        });
    } else {
        setUsers(prevUsers => prevUsers.map(u => {
            if (u.phone === employeeData.id) {
                const updatedUser: User = { 
                    ...u, 
                    fullName: employeeData.name,
                    email: employeeData.email,
                };
                return updatedUser;
            }
            return u;
        }));
    }

    const updatedEmployee: Employee = {
        ...(employeeData as Employee),
        id: newPhone,
        phone: newPhone
    };

    setSettings(s => ({
        ...s,
        employees: s.employees.map(e => e.id === employeeData.id ? updatedEmployee : e)
    }));

    if (newPhone !== employeeData.id) {
        setNewEmployeeCredentials({ phone: newPhone, pass: tempPassword });
    }

    setIsEmployeeModalOpen(false);
    setEditingEmployee(null);
  };

  const handleDeleteEmployee = () => {
    if (!employeeToDelete) return;
    setSettings(s => ({ ...s, employees: s.employees.filter(e => e.id !== employeeToDelete.id) }));
    setUsers(prevUsers => prevUsers.filter(u => u.phone !== employeeToDelete.id));
    setEmployeeToDelete(null);
  };
  
  const handleAddEmployee = async (data: { name: string; phone: string; email: string; password: string; roleKey: string; }) => {
    setAddEmployeeError('');
    setNewEmployeeCredentials(null);

    const initialPermissions = ROLES[data.roleKey]?.permissions || [];

    if (settings.employees.some(e => e.id === data.phone)) {
        setAddEmployeeError('هذا الموظف مضاف بالفعل في هذا المتجر.');
        return;
    }

    const userByPhone = users.find(u => u.phone === data.phone);

    if (userByPhone) {
        alert(`تم العثور على حساب للمستخدم "${userByPhone.fullName}". سيتم إضافته كموظف في هذا المتجر بالدور المحدد.`);
        const newEmployee: Employee = { id: userByPhone.phone, phone: userByPhone.phone, name: userByPhone.fullName, email: userByPhone.email, permissions: initialPermissions, status: 'active' };
        setSettings(s => ({ ...s, employees: [...(s.employees || []), newEmployee] }));
        setIsAddEmployeeModalOpen(false);
    } else {
        const userByEmail = users.find(u => u.email === data.email);
        if (userByEmail) {
            setAddEmployeeError('هذا البريد الإلكتروني مسجل لحساب آخر.');
            return;
        }

        if (!data.password || data.password.length < 8) {
            setAddEmployeeError('يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل.');
            return;
        }

        const firebaseEmail = `${data.phone.trim()}@mystore-auth.app`;
        try {
            await createUserWithEmailAndPassword(secondaryAuth, firebaseEmail, data.password);
            await secondaryAuth.signOut();
        } catch (err: any) {
            setAddEmployeeError(`فشل في إنشاء الحساب في المصادقة: ${err.message}`);
            return;
        }

        const newUser: User = { fullName: data.name, phone: data.phone, email: data.email, joinDate: new Date().toISOString() };
        const success = await createUserDoc(newUser);
        if (!success) {
            setAddEmployeeError('فشل إنشاء حساب الموظف في قاعدة البيانات.');
            return;
        }

        setUsers(prev => [...prev, newUser]);
        const newEmployee: Employee = { id: data.phone, phone: data.phone, name: data.name, email: data.email, permissions: initialPermissions, status: 'active' };
        setSettings(s => ({ ...s, employees: [...(s.employees || []), newEmployee] }));
        setNewEmployeeCredentials({ phone: data.phone, pass: data.password });
        setIsAddEmployeeModalOpen(false);
    }
  };
  
  const handleRequestAction = (employeeId: string, action: 'accept' | 'decline') => {
     if (action === 'accept') {
         setSettings(s => ({ ...s, employees: s.employees.map(e => e.id === employeeId ? { ...e, status: 'active' } : e) }));
         const employee = settings.employees.find(e => e.id === employeeId);
         if (employee) {
             setEditingEmployee({ ...employee, status: 'active' });
             setIsEmployeeModalOpen(true);
         }
     } else {
         setSettings(s => ({ ...s, employees: s.employees.filter(e => e.id !== employeeId) }));
     }
  };


  return (
    <motion.div 
        className="max-w-6xl mx-auto space-y-6 text-right pb-12 px-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
    >
      <motion.div variants={itemVariants}>
        {newEmployeeCredentials && <CredentialsModal credentials={newEmployeeCredentials} onClose={() => setNewEmployeeCredentials(null)} />}
        {resetPasswordCredentials && <CredentialsModal credentials={resetPasswordCredentials} onClose={() => setResetPasswordCredentials(null)} />}
      </motion.div>
      <motion.div variants={itemVariants}>
        <PermissionsCard 
            employees={settings.employees || []}
            partners={settings.partners || []}
            onAdd={() => setIsAddEmployeeModalOpen(true)}
            onEdit={(emp) => { setEditingEmployee(emp); setIsEmployeeModalOpen(true); }}
            onDelete={(emp) => setEmployeeToDelete(emp)}
            onRequestAction={handleRequestAction}
            owner={owner}
            loggedInUser={currentUser}
            users={users}
        />
      </motion.div>
      
      {isEmployeeModalOpen && (
        <EmployeeModal 
          isOpen={isEmployeeModalOpen}
          onClose={() => { setIsEmployeeModalOpen(false); setEditingEmployee(null); setEditEmployeeError(''); }}
          onSave={handleSaveEmployee}
          employee={editingEmployee}
          error={editEmployeeError}
        />
      )}
      
      {isAddEmployeeModalOpen && (
        <AddEmployeeModal 
          onClose={() => { setIsAddEmployeeModalOpen(false); setAddEmployeeError(''); }}
          onAdd={handleAddEmployee}
          error={addEmployeeError}
        />
      )}

      {employeeToDelete && (
         <DeleteConfirmModal 
           title={`حذف الموظف ${employeeToDelete.name}؟`} 
           desc="سيتم حذف هذا الموظف نهائياً. لا يمكن التراجع عن هذا الإجراء."
           onConfirm={handleDeleteEmployee} 
           onCancel={() => setEmployeeToDelete(null)} 
         />
      )}
    </motion.div>
  );
};

const PermissionsCard: React.FC<{ 
  employees: Employee[], 
  partners?: any[],
  onAdd: () => void, 
  onEdit: (emp: Employee) => void, 
  onDelete: (emp: Employee) => void, 
  onRequestAction: (id: string, action: 'accept' | 'decline') => void, 
  owner: User | undefined, 
  loggedInUser: User | null,
  users: User[]
}> = ({ employees, partners = [], onAdd, onEdit, onDelete, onRequestAction, owner, loggedInUser, users }) => {
  // Consolidate everyone for display
  const employeesToDisplay = useMemo(() => {
    let list: any[] = [];
    
    // 1. Add Owner
    if (owner) {
      list.push({
        id: owner.phone,
        name: owner.fullName,
        email: owner.email,
        phone: owner.phone,
        permissions: ['DASHBOARD_VIEW', 'ORDERS_VIEW', 'ORDERS_MANAGE', 'PRODUCTS_VIEW', 'PRODUCTS_MANAGE', 'WALLET_VIEW', 'WALLET_MANAGE', 'SETTINGS_VIEW', 'SETTINGS_MANAGE'],
        status: 'active',
        role: 'owner'
      });
    }

    // 2. Add Partners
    partners.forEach(p => {
      if (!list.some(e => e.id === p.id)) {
        list.push({
          ...p,
          email: p.phone || 'N/A',
          permissions: ['DASHBOARD_VIEW', 'ORDERS_VIEW', 'PRODUCTS_VIEW', 'WALLET_VIEW'],
          status: 'active',
          role: 'partner'
        });
      }
    });

    // 3. Add Employees
    employees.forEach(e => {
      if (!list.some(item => item.id === e.id)) {
        const user = users.find(u => u.phone === e.id);
        list.push({ 
          ...e, 
          name: e.name || user?.fullName || 'موظف',
          email: e.email || user?.email || e.id,
          role: 'staff' 
        });
      }
    });
    
    return list;
  }, [employees, partners, owner, users]);

  const [filterRole, setFilterRole] = useState<string>('الكل');

  const pendingEmployees = employeesToDisplay.filter(e => e.status === 'pending');
  let activeAndInvitedArr = employeesToDisplay.filter(e => e.status !== 'pending');

  const uniqueRoles = Array.from(new Set(activeAndInvitedArr.map(emp => {
      if (emp.role === 'owner') return 'المالك';
      if (emp.role === 'partner') return 'شريك';
      if (emp.status === 'invited') return 'دعوة معلقة';
      return getRoleName(emp.permissions);
  })));

  if (filterRole !== 'الكل') {
      activeAndInvitedArr = activeAndInvitedArr.filter(emp => {
          if (emp.role === 'owner') return filterRole === 'المالك';
          if (emp.role === 'partner') return filterRole === 'شريك';
          if (emp.status === 'invited') return filterRole === 'دعوة معلقة';
          return getRoleName(emp.permissions) === filterRole;
      });
  }

  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 border-b border-slate-200 dark:border-slate-800 pb-6 gap-4">
        <div className="flex items-center gap-3 text-purple-600 dark:text-purple-400">
          <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg"><Users size={24}/></div>
          <div>
            <h2 className="text-xl font-black dark:text-white">إدارة صلاحيات الموظفين</h2>
            <p className="text-xs text-slate-500 dark:text-slate-500">التحكم في من يمكنه عرض أو تعديل بيانات متجرك.</p>
          </div>
        </div>
        <button onClick={onAdd} className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2.5 rounded-xl font-black shadow-lg shadow-purple-100 dark:shadow-none hover:bg-purple-700 active:scale-95 transition-all">
          <UserPlus size={20} /> إضافة موظف / مندوب جديد
        </button>
      </div>

      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none">
          <button 
              onClick={() => setFilterRole('الكل')}
              className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-colors ${filterRole === 'الكل' ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
          >
              الكل
          </button>
          {uniqueRoles.map(roleName => (
              <button 
                  key={roleName}
                  onClick={() => setFilterRole(roleName)}
                  className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-colors ${filterRole === roleName ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                  {roleName}
              </button>
          ))}
      </div>
      
      {pendingEmployees.length > 0 && (
          <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
              <h3 className="font-bold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2"><Clock size={16}/> طلبات انضمام معلقة</h3>
              <div className="space-y-2">
                  {pendingEmployees.map((emp, idx) => (
                      <div key={emp.id || `pending-${idx}`} className="bg-white/50 dark:bg-slate-800/30 p-3 rounded-lg flex justify-between items-center">
                          <div>
                              <p className="font-bold text-sm text-slate-800 dark:text-white">{emp.name}</p>
                              <p className="text-xs text-slate-500">{emp.email}</p>
                          </div>
                          <div className="flex gap-2">
                              <button onClick={() => onRequestAction(emp.id, 'accept')} className="px-3 py-1.5 text-xs font-bold bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200">موافقة</button>
                              <button onClick={() => onRequestAction(emp.id, 'decline')} className="px-3 py-1.5 text-xs font-bold bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300">رفض</button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-right">
          <thead className="text-slate-500 dark:text-slate-400 text-sm font-semibold">
            <tr>
              <th className="px-6 py-4">الموظف</th>
              <th className="px-6 py-4">الحالة / الصلاحيات</th>
              <th className="px-6 py-4 text-left">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {activeAndInvitedArr.map((emp, idx) => {
                const isOwner = emp.role === 'owner';
                const isPartner = emp.role === 'partner';
                const isInvited = emp.status === 'invited';

                return (
                <tr key={emp.id || `${emp.role}-${idx}`} className="group">
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                             <div className="font-bold text-slate-800 dark:text-slate-200">{emp.name}</div>
                             {isOwner && (
                                 <span className="text-[10px] font-black bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded uppercase">المالك</span>
                             )}
                             {isPartner && (
                                 <span className="text-[10px] font-black bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded uppercase">شريك</span>
                             )}
                        </div>
                        <div className="text-xs text-slate-500 font-mono" dir="ltr">{emp.id || emp.email}</div>
                    </td>
                    <td className="px-6 py-4">
                        {isOwner ? <span className="text-xs font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/50 px-2 py-1 rounded-full">المالك (صلاحيات كاملة)</span>
                        : isPartner ? <span className="text-xs font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded-full">شريك (شريك أرباح)</span>
                        : isInvited ? <span className="flex items-center gap-2 text-xs font-bold text-sky-700 bg-sky-100 dark:text-sky-300 dark:bg-sky-900/50 px-2 py-1 rounded-full w-fit"><Clock size={14}/> دعوتك بانتظار القبول</span>
                        : (
                            <div className="flex flex-col gap-1">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full w-fit ${getRoleName(emp.permissions).includes('تأكيد') ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'}`}>
                                    {getRoleName(emp.permissions)}
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold px-1">{emp.permissions?.length || 0} صلاحيات مفعلة</span>
                            </div>
                        )
                        }
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            {isOwner ? 
                                (loggedInUser?.isAdmin ? 
                                    <button onClick={() => onEdit(emp)} className="p-2 text-slate-400 hover:text-blue-500 rounded-lg transition-colors" title="تعديل صلاحيات المالك (خاص بالمدير)"><UserCog size={18} /></button>
                                    : <span className="text-xs font-bold text-slate-400 italic">لا يمكن التعديل</span>
                                )
                            : isPartner ?
                                <span className="text-xs font-bold text-slate-400 italic">يتم إدارته من الشركاء</span>
                            : isInvited ? (
                                <>
                                    <button onClick={() => onRequestAction(emp.id, 'accept')} className="flex items-center gap-1.5 text-xs font-bold bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-200"><Check size={16}/> قبول الدعوة</button>
                                    <button onClick={() => onDelete(emp)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors" title="إلغاء الدعوة"><Trash2 size={18} /></button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => onEdit(emp)} className="p-2 text-slate-400 hover:text-blue-500 rounded-lg transition-colors"><UserCog size={18} /></button>
                                    <button onClick={() => onDelete(emp)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={18} /></button>
                                </>
                            )}
                        </div>
                    </td>
                </tr>
                );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface EmployeeModalProps { isOpen: boolean; onClose: () => void; onSave: (employee: Omit<Employee, 'id'> & { id?: string; phone?: string }) => void; employee: Employee | null; error: string; }
const EmployeeModal: React.FC<EmployeeModalProps> = ({ isOpen, onClose, onSave, employee, error }) => {
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', permissions: [] as Permission[] });
  const [activeRole, setActiveRole] = useState('custom');

  useEffect(() => {
    if (employee) { 
        setFormData({ name: employee.name, phone: employee.phone || employee.id || '', email: employee.email, permissions: employee.permissions || [] });
    } else { 
        setFormData({ name: '', phone: '', email: '', permissions: [] }); 
    }
  }, [employee, isOpen]);

  useEffect(() => {
    const currentPermissions = new Set(formData.permissions);
    let foundRole = 'custom';
    for (const roleKey in ROLES) {
      const rolePermissions = new Set(ROLES[roleKey].permissions);
      if (currentPermissions.size === rolePermissions.size && [...currentPermissions].every(p => rolePermissions.has(p as Permission))) {
        foundRole = roleKey;
        break;
      }
    }
    setActiveRole(foundRole);
  }, [formData.permissions]);

  const handlePermissionChange = (permission: Permission, checked: boolean) => {
    setFormData(prev => ({ ...prev, permissions: checked ? [...(prev.permissions || []), permission] : (prev.permissions || []).filter(p => p !== permission) }));
  };
  
  const handleSelectAll = (checked: boolean) => {
    setFormData(prev => ({ ...prev, permissions: checked ? Object.keys(PERMISSIONS) as Permission[] : [] }));
  };

  const handleRoleSelect = (roleKey: string) => {
    if (ROLES[roleKey]) {
      setFormData(prev => ({ ...prev, permissions: [...ROLES[roleKey].permissions] }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...employee, ...formData });
  };
  
  if (!isOpen) return null;

  const allPermissionsSelected = formData.permissions.length === Object.keys(PERMISSIONS).length;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/90 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] text-right border border-slate-300 dark:border-slate-800">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xl font-black dark:text-white flex items-center gap-3">
            <UserCog className="text-purple-600" /> إدارة الموظف
          </h3>
          <button onClick={onClose}><XCircle className="text-slate-400 hover:text-red-500"/></button>
        </div>
        <form onSubmit={handleSubmit} id="permission-form" className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><label className="text-sm font-bold text-slate-700 dark:text-slate-400">اسم الموظف</label><input type="text" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} className="mt-2 w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-purple-500" /></div>
            <div><label className="text-sm font-bold text-slate-700 dark:text-slate-400">رقم الهاتف</label><input type="tel" value={formData.phone} onChange={e => setFormData(p => ({...p, phone: e.target.value}))} className="mt-2 w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-purple-500" /></div>
            <div><label className="text-sm font-bold text-slate-700 dark:text-slate-400">البريد الإلكتروني</label><input type="email" value={formData.email} onChange={e => setFormData(p => ({...p, email: e.target.value}))} className="mt-2 w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-purple-500" /></div>
          </div>
          <div>
              <h4 className="text-lg font-bold dark:text-white mb-4 flex items-center gap-2"><UserCog size={20}/> اختر دوراً سريعاً (قوالب جاهزة)</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(ROLES).map(([key, role]) => ( 
                      <button key={key} type="button" onClick={() => handleRoleSelect(key)} 
                              className={`p-4 rounded-xl border-2 text-center transition-all flex flex-col items-center gap-2 ${ activeRole === key ? 'bg-purple-100 dark:bg-purple-900/40 border-purple-500 text-purple-700 dark:text-purple-300' : 'bg-slate-50 dark:bg-slate-800/50 border-transparent text-slate-700 dark:text-slate-300 hover:border-purple-300 dark:hover:border-purple-700' }`}> 
                          <span className="text-2xl">{role.icon}</span>
                          <span className="font-bold text-sm">{role.name}</span>
                      </button> 
                  ))}
              </div>
          </div>
          <div>
            <div className="flex justify-between items-center pb-6 border-b border-slate-200 dark:border-slate-800 mb-6">
               <div>
                   <h4 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2"><KeyRound className="text-purple-600"/> تخصيص الصلاحيات بدقة</h4>
                   <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">قم بتحديد أو إزالة الصلاحيات لكل قسم على حدة</p>
               </div>
               <label className="flex items-center gap-2 cursor-pointer p-3 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-xl hover:bg-purple-100 transition-colors">
                  <input type="checkbox" checked={allPermissionsSelected} onChange={e => handleSelectAll(e.target.checked)} className="rounded text-purple-600 focus:ring-purple-500 w-5 h-5"/>
                  <span className="font-bold text-sm">منح كافة الصلاحيات</span>
               </label>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-6">
              {PERMISSION_GROUPS.map(group => {
                const groupPermissionKeys = group.permissions.map(p => p.key);
                const isAllGroupSelected = groupPermissionKeys.every(k => formData.permissions.includes(k));
                const isPartialGroupSelected = groupPermissionKeys.some(k => formData.permissions.includes(k)) && !isAllGroupSelected;

                const handleGroupToggle = (checked: boolean) => {
                    setFormData(prev => {
                        const newPerms = new Set(prev.permissions);
                        if (checked) {
                            groupPermissionKeys.forEach(k => newPerms.add(k));
                        } else {
                            groupPermissionKeys.forEach(k => newPerms.delete(k));
                        }
                        return { ...prev, permissions: Array.from(newPerms) };
                    });
                };

                return (
                 <div key={group.title} className={`bg-white dark:bg-slate-800/80 rounded-2xl border transition-colors ${isPartialGroupSelected || isAllGroupSelected ? 'border-purple-300 dark:border-purple-500/50 shadow-sm' : 'border-slate-200 dark:border-slate-700'}`}>
                   <div className={`p-4 flex justify-between items-center border-b ${isPartialGroupSelected || isAllGroupSelected ? 'border-purple-100 dark:border-purple-900/30 bg-purple-50/50 dark:bg-purple-900/10 rounded-t-2xl' : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 rounded-t-2xl'}`}>
                     <h5 className="font-black text-slate-800 dark:text-white flex items-center gap-2">{group.title}</h5>
                     <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" 
                            checked={isAllGroupSelected} 
                            ref={(input) => { if (input) input.indeterminate = isPartialGroupSelected; }}
                            onChange={e => handleGroupToggle(e.target.checked)} 
                            className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-500">الكل</span>
                     </label>
                   </div>
                   <div className="p-4 space-y-3">
                     {group.permissions.map(perm => ( 
                         <label key={perm.key} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 cursor-pointer hover:border-purple-300 dark:hover:border-purple-500/50 transition-colors group"> 
                             <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${formData.permissions.includes(perm.key) ? 'bg-purple-600 border-purple-600' : 'border-2 border-slate-300 dark:border-slate-600 group-hover:border-purple-400'}`}>
                                 {formData.permissions.includes(perm.key) && <Check size={14} className="text-white" />}
                             </div>
                             <input type="checkbox" className="hidden" checked={formData.permissions.includes(perm.key)} onChange={e => handlePermissionChange(perm.key, e.target.checked)}/> 
                             <span className="font-bold text-sm text-slate-700 dark:text-slate-300 group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">{perm.label}</span> 
                         </label> 
                     ))}
                   </div>
                 </div>
                );
              })}
            </div>
          </div>
          {error && <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-center font-bold text-sm">{error}</div>}
        </form>
        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-8 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl font-black">إلغاء</button>
          <button type="submit" form="permission-form" onClick={handleSubmit} className="px-8 py-3 bg-purple-600 text-white rounded-xl font-black hover:bg-purple-700 transition-colors">حفظ التغييرات</button>
        </div>
      </div>
    </div>
  );
};

interface AddEmployeeModalProps { onClose: () => void; onAdd: (data: { name: string, phone: string, email: string, password: string, roleKey: string }) => void; error: string; }
const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({ onClose, onAdd, error }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleKey, setRoleKey] = useState('COURIER');
  
  const generateRandomPassword = () => Math.random().toString(36).slice(-8);

  useEffect(() => {
    setPassword(generateRandomPassword());
  }, []);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && phone.trim() && email.trim() && password.trim() && roleKey) {
      onAdd({ name, phone, email, password, roleKey });
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/90 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl p-8 text-right border border-slate-300 dark:border-slate-800">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-xl font-black dark:text-white">إضافة موظف / مندوب جديد</h3>
          <button onClick={onClose}><XCircle className="text-slate-400 hover:text-red-500"/></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">الاسم الكامل</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="اسم المندوب أو الموظف" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 outline-none text-xs font-bold"/>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">رقم الهاتف (يستخدم لتسجيل الدخول)</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="مثال: 010xxxxxxxx" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 outline-none text-xs font-bold font-mono"/>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">البريد الإلكتروني</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="mail@example.com" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 outline-none text-xs font-bold font-mono"/>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">تعيين دور الموظف / صلاحياته</label>
              <select 
                  value={roleKey} 
                  onChange={e => setRoleKey(e.target.value)} 
                  className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 outline-none font-bold text-xs"
              >
                  {Object.entries(ROLES).map(([key, role]) => (
                      <option key={key} value={key}>{role.icon} {role.name}</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">تعيين كلمة المرور</label>
              <div className="relative">
                  <input type="text" value={password} onChange={e => setPassword(e.target.value)} required placeholder="كلمة المرور لتسجيل الدخول" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 outline-none font-mono text-xs font-bold"/>
                  <button type="button" onClick={() => setPassword(generateRandomPassword())} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-purple-500" title="توليد كلمة مرور عشوائية"><RefreshCw size={16}/></button>
              </div>
            </div>
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onClose} className="px-6 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg font-bold">إلغاء</button>
                <button type="submit" className="px-6 py-2 bg-purple-600 text-white rounded-lg font-bold">إضافة الموظف</button>
            </div>
        </form>
      </div>
    </div>
  );
};

interface CredentialsModalProps { credentials: { phone: string, pass: string }, onClose: () => void; }
const CredentialsModal: React.FC<CredentialsModalProps> = ({ credentials, onClose }) => {
    const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl p-6 text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"><Check size={32}/></div>
                <h3 className="text-xl font-bold dark:text-white">تمت العملية بنجاح!</h3>
                <p className="text-sm text-slate-500 mb-4">شارك بيانات الدخول الجديدة مع الموظف.</p>
                <div className="space-y-3 text-right">
                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <label className="text-xs text-slate-400 font-bold">رقم الهاتف</label>
                        <div className="flex justify-between items-center"><span className="font-mono font-bold text-lg dark:text-white">{credentials.phone}</span><button onClick={() => copyToClipboard(credentials.phone)}><Copy size={16}/></button></div>
                    </div>
                     <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <label className="text-xs text-slate-400 font-bold">كلمة المرور</label>
                        <div className="flex justify-between items-center"><span className="font-mono font-bold text-lg dark:text-white">{credentials.pass}</span><button onClick={() => copyToClipboard(credentials.pass)}><Copy size={16}/></button></div>
                    </div>
                </div>
                <button onClick={onClose} className="w-full mt-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-bold">إغلاق</button>
            </div>
        </div>
    );
};


interface DeleteConfirmModalProps { title: string; desc: string; onConfirm: () => void; onCancel: () => void; }
const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ title, desc, onConfirm, onCancel }) => ( <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/90 backdrop-blur-sm"> <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center animate-in zoom-in duration-200 border border-slate-300 dark:border-slate-800"> <div className="w-20 h-20 bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100 dark:border-red-900"><AlertCircle size={40} /></div> <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-3 uppercase tracking-tight">{title}</h3> <p className="text-slate-600 dark:text-slate-400 text-sm mb-8 leading-relaxed font-bold">{desc}</p> <div className="flex flex-col gap-3"> <button onClick={onConfirm} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black shadow-xl hover:bg-red-700 transition-all active:scale-95">تأكيد الحذف</button> <button onClick={onCancel} className="w-full py-4 text-slate-500 dark:text-slate-400 font-black hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">تراجع</button> </div> </div> </div> );

export default EmployeesPage;