
import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, ShoppingCart, ExternalLink, Inbox, Eye, UserPlus, Settings as SettingsIcon, XCircle, Send, Filter, ChevronsUpDown, Save, Store as StoreIconLucide, Tag, MonitorSmartphone } from 'lucide-react';
import { User, Store, StoreData, Employee } from '../types';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
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

interface ManageSitesPageProps {
  ownedStores: Store[];
  collaboratingStores: Store[];
  setActiveStoreId: (id: string) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  allStoresData: Record<string, StoreData>;
  setAllStoresData: React.Dispatch<React.SetStateAction<Record<string, StoreData>>>;
  currentUser: User | null;
}

const StoreCard: React.FC<{ store: Store; ownerName?: string; onSelect: (id: string) => void; onPreview: (id: string) => void; onInvite: (store: Store) => void; onSettings: (store: Store) => void; }> = ({ store, ownerName, onSelect, onPreview, onInvite, onSettings }) => {
  const creationDate = new Date(store.creationDate);
  const formattedDate = `تم إنشاؤه في ${creationDate.getDate()} ${creationDate.toLocaleString('ar-EG', { month: 'long' })} ${creationDate.getFullYear()}`;

  return (
    <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1 flex flex-col group">
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <span className="flex items-center gap-1 text-xs font-bold text-teal-700 bg-teal-100 dark:bg-teal-900/50 dark:text-teal-300 px-2 py-1 rounded-full"><ShoppingCart size={14}/> متجر</span>
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1 leading-tight">{store.name}</h3>
        {ownerName && <p className="text-xs font-bold text-slate-400 mb-2">المالك: {ownerName}</p>}
        <a 
          href={`https://${store.url}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-slate-500 font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="truncate">{store.url}</span>
          <ExternalLink size={14}/>
        </a>
        <p className="text-xs text-slate-400 mt-auto pt-4">{formattedDate}</p>
      </div>
      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 rounded-b-2xl flex items-center gap-2">
        <button onClick={() => onSelect(store.id)} className="flex-1 text-center flex items-center justify-center gap-2 font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 transition-colors py-1.5 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/20">
          <span>لوحة التحكم</span>
          <ArrowLeft size={16}/>
        </button>
        <div className="w-px h-6 bg-slate-200 dark:border-slate-700"></div>
        <button onClick={() => onSettings(store)} className="p-2 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/20" title="الإعدادات"><SettingsIcon size={16}/></button>
        <button onClick={() => onInvite(store)} className="p-2 text-slate-500 hover:text-purple-600 rounded-lg transition-colors hover:bg-purple-50 dark:hover:bg-purple-900/20" title="دعوة موظف"><UserPlus size={16}/></button>
        <button onClick={() => onPreview(store.id)} className="p-2 text-slate-500 hover:text-blue-600 rounded-lg transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20" title="معاينة"><Eye size={16} /></button>
      </div>
    </motion.div>
  );
};

const ManageSitesPage: React.FC<ManageSitesPageProps> = ({ currentUser, ownedStores, collaboratingStores, setActiveStoreId, users, setUsers, allStoresData, setAllStoresData }) => {
  const navigate = useNavigate();
  const [storeToEdit, setStoreToEdit] = useState<Store | null>(null);
  const [storeToInvite, setStoreToInvite] = useState<Store | null>(null);
  const [specializationFilter, setSpecializationFilter] = useState('all');

  const isAdminView = currentUser?.isAdmin;

  const allPlatformStores = useMemo(() => {
    if (!isAdminView) return [];
    return users.flatMap(user => 
        user.stores?.map(store => ({ store, ownerName: user.fullName })) || []
    ).filter(item => !item.ownerName.toLowerCase().includes('admin')); // Filter out admin user's stores
  }, [isAdminView, users]);

  const allSpecializations = useMemo(() => {
    const storesForSpec = isAdminView ? allPlatformStores.map(item => item.store) : [...ownedStores, ...collaboratingStores];
    return [...new Set(storesForSpec.map(s => s.specialization))];
  }, [isAdminView, allPlatformStores, ownedStores, collaboratingStores]);

  const filteredOwnedStores = useMemo(() => ownedStores.filter(s => specializationFilter === 'all' || s.specialization === specializationFilter), [ownedStores, specializationFilter]);
  const filteredCollaboratingStores = useMemo(() => collaboratingStores.filter(s => specializationFilter === 'all' || s.specialization === specializationFilter), [collaboratingStores, specializationFilter]);
  const filteredAdminStores = useMemo(() => allPlatformStores.filter(({ store }) => specializationFilter === 'all' || store.specialization === specializationFilter), [allPlatformStores, specializationFilter]);

  const handleSelectStore = (storeId: string) => {
    setActiveStoreId(storeId);
    navigate('/');
  };

  const handlePreviewStore = (storeId: string) => {
    setActiveStoreId(storeId);
    navigate('/store');
  };
  
  const handleSaveSettings = (updatedStore: Store) => {
    const owner = users.find(u => u.stores?.some(s => s.id === updatedStore.id));
    if (!owner) return;
    
    const updatedOwner = {
      ...owner,
      stores: (owner.stores || []).map(s => s.id === updatedStore.id ? updatedStore : s)
    };
    
    setUsers(currentUsers => currentUsers.map(u => u.phone === owner.phone ? updatedOwner : u));
    setStoreToEdit(null);
  };
  
  const handleInvite = (storeId: string, email: string) => {
    const userToInvite = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!userToInvite) {
      throw new Error('لم يتم العثور على مستخدم بهذا البريد الإلكتروني.');
    }
    const storeData = allStoresData[storeId];
    if (!storeData || storeData.settings.employees.some(e => e.id === userToInvite.phone)) {
      throw new Error('هذا المستخدم هو بالفعل عضو في هذا المتجر.');
    }
    const newEmployee: Employee = { id: userToInvite.phone, name: userToInvite.fullName, email: userToInvite.email, permissions: [], status: 'invited' };
    setAllStoresData(prevData => ({
        ...prevData,
        [storeId]: { ...storeData, settings: { ...storeData.settings, employees: [...storeData.settings.employees, newEmployee] }}
    }));
    setStoreToInvite(null);
  };

  if ((ownedStores.length + collaboratingStores.length) === 0 && !isAdminView) {
    return <CreateSiteView />;
  }
  
  return (
    <>
      <motion.div 
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" 
          dir="rtl"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
      >
        <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white">إدارة المتاجر</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
                {isAdminView ? "تحكم كامل في جميع المتاجر الموجودة على المنصة." : "يمكنك من لوحة التحكم إدارة وحذف أو ترقية أو ضبط الإعدادات لأي من متاجرك على الإنترنت."}
            </p>
          </div>
          <div className="flex items-center gap-2">
              <div className="relative">
                  <Filter size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                  <select value={specializationFilter} onChange={e => setSpecializationFilter(e.target.value)} className="appearance-none w-full sm:w-48 pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="all">كل التخصصات</option>
                      {allSpecializations.map(spec => <option key={spec} value={spec}>{spec}</option>)}
                  </select>
                  <ChevronsUpDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
              </div>
              {!isAdminView && (
                  <Link to="/create-store" className="flex items-center justify-center gap-2 bg-teal-500 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-teal-600 transition-all shadow-md active:scale-95">
                      <Plus size={20} /> أنشئ متجرك
                  </Link>
              )}
          </div>
        </motion.div>
        
        <motion.div variants={itemVariants} className="space-y-12">
            {isAdminView ? (
                <div>
                    <h2 className="text-2xl font-bold text-slate-700 dark:text-white mb-6">كل متاجر المنصة ({filteredAdminStores.length})</h2>
                    {filteredAdminStores.length > 0 ? (
                        <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {filteredAdminStores.map(({ store, ownerName }) => 
                                <StoreCard key={store.id} store={store} ownerName={ownerName} onSelect={handleSelectStore} onPreview={handlePreviewStore} onInvite={setStoreToInvite} onSettings={setStoreToEdit} />
                            )}
                        </motion.div>
                    ) : (
                        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                            <Inbox size={40} className="text-slate-300 dark:text-slate-600 mb-3" />
                            <h3 className="font-bold text-lg text-slate-600 dark:text-slate-300">لا توجد متاجر على المنصة بعد.</h3>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-700 dark:text-white mb-6">متاجري</h2>
                        {filteredOwnedStores.length > 0 ? (
                            <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {filteredOwnedStores.map(store => 
                                    <StoreCard key={store.id} store={store} onSelect={handleSelectStore} onPreview={handlePreviewStore} onInvite={setStoreToInvite} onSettings={setStoreToEdit} />
                                )}
                            </motion.div>
                        ) : (
                            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                                <Inbox size={40} className="text-slate-300 dark:text-slate-600 mb-3" />
                                <h3 className="font-bold text-lg text-slate-600 dark:text-slate-300">ليس لديك أي متاجر بعد.</h3>
                                <p className="text-sm">ابدأ بإنشاء متجرك الأول لتعرضه هنا.</p>
                            </div>
                        )}
                    </div>
                    {collaboratingStores.length > 0 && (
                        <div>
                            <h2 className="text-2xl font-bold text-slate-700 dark:text-white mb-6">متاجر متعاون بها</h2>
                            <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {filteredCollaboratingStores.map(store => 
                                    <StoreCard key={store.id} store={store} onSelect={handleSelectStore} onPreview={handlePreviewStore} onInvite={setStoreToInvite} onSettings={setStoreToEdit} />
                                )}
                            </motion.div>
                        </div>
                    )}
                </>
            )}
        </motion.div>
      </motion.div>
      
      {storeToEdit && <StoreSettingsModal store={storeToEdit} onClose={() => setStoreToEdit(null)} onSave={handleSaveSettings} />}
      {storeToInvite && <InviteEmployeeModal store={storeToInvite} onClose={() => setStoreToInvite(null)} onInvite={handleInvite} users={users} />}
    </>
  );
};


// --- Modals and other components ---

const CreateSiteView: React.FC = () => {
 return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-right" dir="rtl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm p-6 mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">إدارة مواقعك</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">من هنا يمكنك إدارة / ترقية أو تعديل إعدادات مواقعك.</p>
        </div>
        <button className="w-full sm:w-auto flex items-center justify-center gap-2 bg-teal-500 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-teal-600 transition-all shadow-md active:scale-95">
          <Plus size={20} /> إنشاء موقع جديد
        </button>
      </div>

      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white">ما نوع الموقع الذي تحتاجه؟</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-2xl mx-auto">
          قم بإنشاء أي شيء تريده، من موقع ويب متعدد اللغات أو متجر إلكتروني.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <ChoiceCard
            title="متجر إلكتروني"
            description="أضف منتجاتك وابدأ البيع عبر الإنترنت اليوم."
            buttonText="إلى المتجر"
            linkTo="/create-store"
            imageUrl="https://images.unsplash.com/photo-1555529669-e69e7aa0ba9e?q=80&w=870&auto=format&fit=crop"
          />
          <ChoiceCard
            title="موقع للأعمال التجارية"
            description="موقع احترافي متعدد اللغات لعملك."
            buttonText="أنشئ موقعك"
            linkTo="#"
            imageUrl="https://images.unsplash.com/photo-1587440871875-191322ee64b0?q=80&w=871&auto=format&fit=crop"
            disabled
          />
        </div>
      </div>
    </div>
  );
};

const StoreSettingsModal: React.FC<{ store: Store, onClose: () => void, onSave: (s: Store) => void }> = ({ store, onClose, onSave }) => {
    const [formData, setFormData] = useState(store);
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2"><SettingsIcon size={20} className="text-indigo-500" /> إعدادات المتجر</h3>
                    <button onClick={onClose}><XCircle className="text-slate-400 hover:text-red-500"/></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                     <div>
                        <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 block flex items-center gap-1.5"><StoreIconLucide size={16}/> اسم المتجر</label>
                        <input type="text" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"/>
                     </div>
                     <div>
                        <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 block flex items-center gap-1.5"><Tag size={16}/> تخصص المتجر</label>
                         <select value={formData.specialization} onChange={e => setFormData(p => ({...p, specialization: e.target.value}))} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                            <option>الصحة والجمال</option><option>ملابس وموضة</option><option>إلكترونيات</option><option>أدوات منزلية</option><option>أخرى</option>
                         </select>
                     </div>
                     <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-6 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">إلغاء</button>
                        <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors"><Save size={16}/> حفظ التغييرات</button>
                     </div>
                </form>
            </div>
        </div>
    )
};

const InviteEmployeeModal: React.FC<{ store: Store, onClose: () => void, onInvite: (storeId: string, email: string) => void, users: User[] }> = ({ store, onClose, onInvite, users }) => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        try {
            onInvite(store.id, email);
        } catch(err: any) {
            setError(err.message);
        }
    };
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">دعوة موظف لـ {store.name}</h3><button onClick={onClose}><XCircle/></button></div>
                <form onSubmit={handleSubmit} className="space-y-4">
                     <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} placeholder="أدخل البريد الإلكتروني للموظف" required className="w-full p-3 bg-slate-100 rounded-lg"/>
                     {error && <p className="text-sm text-red-500">{error}</p>}
                     <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={onClose}>إلغاء</button><button type="submit" className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg font-bold"><Send size={16}/> إرسال دعوة</button></div>
                </form>
            </div>
        </div>
    )
};


interface ChoiceCardProps {
  title: string;
  description: string;
  buttonText: string;
  linkTo: string;
  imageUrl: string;
  disabled?: boolean;
}

const ChoiceCard: React.FC<ChoiceCardProps> = ({ title, description, buttonText, linkTo, imageUrl, disabled }) => {
  const content = (
    <>
      <div className="overflow-hidden rounded-t-2xl">
        <img src={imageUrl} alt={title} className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300" />
      </div>
      <div className="p-8 text-center flex-1 flex flex-col">
        <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{title}</h3>
        <p className="text-slate-500 dark:text-slate-400 mt-2 flex-1">{description}</p>
        <div className="mt-6">
          <div className={`inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold text-white transition-all ${disabled ? 'bg-slate-400 dark:bg-slate-600' : 'bg-teal-500 hover:bg-teal-600 group-hover:scale-105 group-hover:shadow-lg'}`}>
            <span>{buttonText}</span>
            <ArrowLeft size={20} />
          </div>
        </div>
      </div>
    </>
  );

  if (disabled) {
    return (
      <div className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col cursor-not-allowed opacity-60">
        {content}
      </div>
    );
  }

  return (
    <Link to={linkTo} className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all flex flex-col">
      {content}
    </Link>
  );
};


export default ManageSitesPage;