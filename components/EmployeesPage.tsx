import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Employee, Permission, PERMISSIONS, User, Store } from '../types';
import { Users, UserPlus, UserCog, Trash2, XCircle, KeyRound, AlertCircle, Check, Clock, Copy, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

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
  { title: 'الأوردرات والتحكم', permissions: [ { key: 'ORDERS_VIEW', label: 'عرض الأوردرات فقط' }, { key: 'ORDERS_MANAGE', label: 'إدارة كاملة للأوردرات (إضافة، تعديل، حذف)' } ] },
  { title: 'المنتجات والمخزون', permissions: [ { key: 'PRODUCTS_VIEW', label: 'عرض المنتجات فقط' }, { key: 'PRODUCTS_MANAGE', label: 'إدارة كاملة للمنتجات' } ] },
  { title: 'البيانات المالية', permissions: [ { key: 'DASHBOARD_VIEW', label: 'عرض لوحة التحكم والإحصائيات' }, { key: 'WALLET_VIEW', label: 'عرض المحفظة والعمليات' }, { key: 'WALLET_MANAGE', label: 'إجراء عمليات يدوية بالمحفظة' } ] },
  { title: 'إعدادات المتجر', permissions: [ { key: 'SETTINGS_VIEW', label: 'عرض الإعدادات فقط' }, { key: 'SETTINGS_MANAGE', label: 'تعديل كافة إعدادات المتجر' } ] },
];

const ROLES: Record<string, { name: string; permissions: Permission[] }> = {
  CONFIRMATION: { name: 'مسؤول تأكيد', permissions: ['ORDERS_VIEW', 'PRODUCTS_VIEW'] },
  ORDER_MANAGER: { name: 'مدير طلبات', permissions: ['ORDERS_VIEW', 'ORDERS_MANAGE', 'PRODUCTS_VIEW'] },
  ACCOUNTANT: { name: 'محاسب', permissions: ['DASHBOARD_VIEW', 'WALLET_VIEW', 'WALLET_MANAGE'] },
  FULL_MANAGER: { name: 'مدير كامل', permissions: ['DASHBOARD_VIEW', 'ORDERS_VIEW', 'ORDERS_MANAGE', 'PRODUCTS_VIEW', 'PRODUCTS_MANAGE', 'WALLET_VIEW', 'WALLET_MANAGE', 'SETTINGS_VIEW'] },
};

const getRoleName = (permissions: Permission[]): string => {
    if (!permissions) return 'بدون صلاحيات';
    const totalPermissions = Object.keys(PERMISSIONS).length;
    if (permissions.length === totalPermissions) return 'صلاحيات كاملة';

    const currentPermissions = new Set(permissions);
    for (const roleKey in ROLES) {
        const rolePermissions = new Set(ROLES[roleKey].permissions);
        if (currentPermissions.size === rolePermissions.size && [...currentPermissions].every(p => rolePermissions.has(p))) {
            return ROLES[roleKey].name;
        }
    }
    
    if (permissions.length === 0) return 'بدون صلاحيات';
    return `${permissions.length} صلاحيات مخصصة`;
};


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

  const handleSaveEmployee = (employeeData: Omit<Employee, 'id'> & { id?: string }, newPassword: string | null) => {
    if (!employeeData.id) return;
    setEditEmployeeError('');

    const originalEmployee = settings.employees.find(e => e.id === employeeData.id);
    if (originalEmployee && originalEmployee.email !== employeeData.email) {
        if (users.some(u => u.email === employeeData.email && u.phone !== employeeData.id)) {
            setEditEmployeeError('هذا البريد الإلكتروني مستخدم بالفعل لحساب آخر.');
            return;
        }
    }

    setSettings(s => ({
        ...s,
        employees: s.employees.map(e => e.id === employeeData.id ? (employeeData as Employee) : e)
    }));

    setUsers(prevUsers => prevUsers.map(u => {
        if (u.phone === employeeData.id) {
            const updatedUser: User = { 
                ...u, 
                fullName: employeeData.name,
                email: employeeData.email,
            };
            if (newPassword) {
                updatedUser.password = newPassword;
            }
            return updatedUser;
        }
        return u;
    }));
    
    if (newPassword) {
        setResetPasswordCredentials({ phone: employeeData.id, pass: newPassword });
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
  
  const handleAddEmployee = (data: { name: string; phone: string; email: string; password: string; }) => {
    setAddEmployeeError('');
    setNewEmployeeCredentials(null);

    if (settings.employees.some(e => e.id === data.phone)) {
        setAddEmployeeError('هذا الموظف مضاف بالفعل في هذا المتجر.');
        return;
    }

    const userByPhone = users.find(u => u.phone === data.phone);

    if (userByPhone) {
        alert(`تم العثور على حساب للمستخدم "${userByPhone.fullName}". سيتم إضافته كموظف في هذا المتجر.`);
        const newEmployee: Employee = { id: userByPhone.phone, name: userByPhone.fullName, email: userByPhone.email, permissions: [], status: 'active' };
        setSettings(s => ({ ...s, employees: [...(s.employees || []), newEmployee] }));
        setIsAddEmployeeModalOpen(false);
    } else {
        const userByEmail = users.find(u => u.email === data.email);
        if (userByEmail) {
            setAddEmployeeError('هذا البريد الإلكتروني مسجل لحساب آخر.');
            return;
        }

        const newUser: User = { fullName: data.name, phone: data.phone, email: data.email, password: data.password, joinDate: new Date().toISOString() };
        setUsers(prev => [...prev, newUser]);
        const newEmployee: Employee = { id: data.phone, name: data.name, email: data.email, permissions: [], status: 'active' };
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
            onAdd={() => setIsAddEmployeeModalOpen(true)}
            onEdit={(emp) => { setEditingEmployee(emp); setIsEmployeeModalOpen(true); }}
            onDelete={(emp) => setEmployeeToDelete(emp)}
            onRequestAction={handleRequestAction}
            ownerId={owner?.phone}
            loggedInUser={currentUser}
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

const PermissionsCard: React.FC<{ employees: Employee[], onAdd: () => void, onEdit: (emp: Employee) => void, onDelete: (emp: Employee) => void, onRequestAction: (id: string, action: 'accept' | 'decline') => void, ownerId?: string, loggedInUser: User | null }> = ({ employees, onAdd, onEdit, onDelete, onRequestAction, ownerId, loggedInUser }) => {
  const pendingEmployees = employees.filter(e => e.status === 'pending');
  const activeAndInvited = employees.filter(e => e.status !== 'pending');

  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-8 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="flex items-center gap-3 text-purple-600 dark:text-purple-400">
          <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg"><Users size={24}/></div>
          <div>
            <h2 className="text-xl font-black dark:text-white">إدارة صلاحيات الموظفين</h2>
            <p className="text-xs text-slate-500 dark:text-slate-500">التحكم في من يمكنه عرض أو تعديل بيانات متجرك.</p>
          </div>
        </div>
        <button onClick={onAdd} className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2.5 rounded-xl font-black shadow-lg shadow-purple-100 dark:shadow-none hover:bg-purple-700 active:scale-95 transition-all">
          <UserPlus size={20} /> إضافة موظف
        </button>
      </div>
      
      {pendingEmployees.length > 0 && (
          <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
              <h3 className="font-bold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2"><Clock size={16}/> طلبات انضمام معلقة</h3>
              <div className="space-y-2">
                  {pendingEmployees.map(emp => (
                      <div key={emp.id} className="bg-white/50 dark:bg-slate-800/30 p-3 rounded-lg flex justify-between items-center">
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
            {activeAndInvited.map(emp => {
                const isOwner = emp.id === ownerId;
                const isInvited = emp.status === 'invited';

                return (
                <tr key={emp.id} className="group">
                    <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{emp.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{emp.email}</div>
                    </td>
                    <td className="px-6 py-4">
                        {isOwner ? <span className="text-xs font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/50 px-2 py-1 rounded-full">المالك (صلاحيات كاملة)</span>
                        : isInvited ? <span className="flex items-center gap-2 text-xs font-bold text-sky-700 bg-sky-100 dark:text-sky-300 dark:bg-sky-900/50 px-2 py-1 rounded-full w-fit"><Clock size={14}/> في انتظار القبول</span>
                        : <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">{getRoleName(emp.permissions)}</span>
                        }
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            {isOwner ? 
                                (loggedInUser?.isAdmin ? 
                                    <button onClick={() => onEdit(emp)} className="p-2 text-slate-400 hover:text-blue-500 rounded-lg transition-colors" title="تعديل صلاحيات المالك (خاص بالمدير)"><UserCog size={18} /></button>
                                    : <span className="text-xs font-bold text-slate-400 italic">لا يمكن التعديل</span>
                                )
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

interface EmployeeModalProps { isOpen: boolean; onClose: () => void; onSave: (employee: Omit<Employee, 'id'> & { id?: string }, newPassword: string | null) => void; employee: Employee | null; error: string; }
const EmployeeModal: React.FC<EmployeeModalProps> = ({ isOpen, onClose, onSave, employee, error }) => {
  const [formData, setFormData] = useState({ name: '', email: '', permissions: [] as Permission[] });
  const [activeRole, setActiveRole] = useState('custom');
  const [newPassword, setNewPassword] = useState<string | null>(null);
  
  const generateRandomPassword = () => Math.random().toString(36).slice(-8);

  useEffect(() => {
    if (employee) { 
        setFormData({ name: employee.name, email: employee.email, permissions: employee.permissions || [] });
        setNewPassword(null);
    } else { 
        setFormData({ name: '', email: '', permissions: [] }); 
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
  
  const handleResetPassword = () => {
    setNewPassword(generateRandomPassword());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...employee, ...formData }, newPassword);
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className="text-sm font-bold text-slate-700 dark:text-slate-400">اسم الموظف</label><input type="text" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} className="mt-2 w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-purple-500" /></div>
            <div><label className="text-sm font-bold text-slate-700 dark:text-slate-400">البريد الإلكتروني</label><input type="email" value={formData.email} onChange={e => setFormData(p => ({...p, email: e.target.value}))} className="mt-2 w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-purple-500" /></div>
          </div>
          <div>
              <h4 className="text-lg font-bold dark:text-white mb-4 flex items-center gap-2"><KeyRound/> إعادة تعيين كلمة المرور</h4>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border dark:border-slate-800 flex justify-between items-center">
                  <p className="font-bold text-sm text-slate-700 dark:text-slate-300">إنشاء كلمة مرور جديدة ومؤقتة للموظف.</p>
                  <button type="button" onClick={handleResetPassword} className="px-4 py-2 text-xs font-bold bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 whitespace-nowrap">إنشاء كلمة مرور</button>
              </div>
              {newPassword && (
                  <div className="mt-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-700 dark:text-emerald-300 font-bold text-sm flex items-center justify-between">
                      <span>كلمة المرور الجديدة: <span className="font-mono">{newPassword}</span></span>
                      <button type="button" onClick={() => navigator.clipboard.writeText(newPassword)}><Copy size={16}/></button>
                  </div>
              )}
          </div>
          <div>
              <h4 className="text-lg font-bold dark:text-white mb-4 flex items-center gap-2"><UserCog size={20}/> اختر دوراً سريعاً</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(ROLES).map(([key, role]) => ( <button key={key} type="button" onClick={() => handleRoleSelect(key)} className={`p-4 rounded-xl border-2 text-center font-bold transition-all ${ activeRole === key ? 'bg-purple-100 dark:bg-purple-900/40 border-purple-500 text-purple-700 dark:text-purple-300' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-purple-400' }`}> {role.name} </button> ))}
              </div>
          </div>
          <div>
            <div className="flex justify-between items-center pb-4 border-b dark:border-slate-800 mb-4">
               <h4 className="text-lg font-bold dark:text-white flex items-center gap-2"><KeyRound/> تحديد الصلاحيات</h4>
               <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                  <input type="checkbox" checked={allPermissionsSelected} onChange={e => handleSelectAll(e.target.checked)} className="rounded text-purple-600 focus:ring-purple-500"/>
                  <span className="text-sm font-bold">صلاحيات كاملة</span>
               </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {PERMISSION_GROUPS.map(group => (
                <div key={group.title} className="space-y-3">
                  <h5 className="font-black text-purple-800 dark:text-purple-400">{group.title}</h5>
                  {group.permissions.map(perm => ( <label key={perm.key} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border dark:border-slate-800 cursor-pointer"> <input type="checkbox" checked={formData.permissions.includes(perm.key)} onChange={e => handlePermissionChange(perm.key, e.target.checked)} className="rounded text-purple-600 focus:ring-purple-500"/> <span className="font-bold text-sm text-slate-700 dark:text-slate-300">{perm.label}</span> </label> ))}
                </div>
              ))}
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

interface AddEmployeeModalProps { onClose: () => void; onAdd: (data: { name: string, phone: string, email: string, password: string }) => void; error: string; }
const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({ onClose, onAdd, error }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const generateRandomPassword = () => Math.random().toString(36).slice(-8);

  useEffect(() => {
    setPassword(generateRandomPassword());
  }, []);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && phone.trim() && email.trim() && password.trim()) {
      onAdd({ name, phone, email, password });
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/90 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl p-8 text-right border border-slate-300 dark:border-slate-800">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-xl font-black dark:text-white">إضافة موظف جديد</h3>
          <button onClick={onClose}><XCircle className="text-slate-400 hover:text-red-500"/></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="الاسم الكامل" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 outline-none"/>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="رقم الهاتف (لتسجيل الدخول)" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 outline-none"/>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="البريد الإلكتروني" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 outline-none"/>
            <div className="relative">
                <input type="text" value={password} onChange={e => setPassword(e.target.value)} required placeholder="كلمة المرور المؤقتة" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 outline-none font-mono"/>
                <button type="button" onClick={() => setPassword(generateRandomPassword())} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-purple-500"><RefreshCw size={16}/></button>
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