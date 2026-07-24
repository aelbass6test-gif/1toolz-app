import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, ShoppingCart, ExternalLink, Inbox, Eye, UserPlus, 
  Settings as SettingsIcon, XCircle, Send, Filter, ChevronsUpDown, Save, 
  Store as StoreIconLucide, Tag, Globe, Search, Sparkles, CheckCircle2, 
  Copy, Users, ShieldCheck, Layers, BarChart3, Radio
} from 'lucide-react';
import { User, Store, StoreData, Employee } from '../types';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.3 }
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

const StoreCard: React.FC<{ 
  store: Store; 
  ownerName?: string; 
  storeData?: StoreData;
  onSelect: (id: string) => void; 
  onPreview: (id: string) => void; 
  onInvite: (store: Store) => void; 
  onSettings: (store: Store) => void; 
}> = ({ store, ownerName, storeData, onSelect, onPreview, onInvite, onSettings }) => {
  const [copied, setCopied] = useState(false);
  const creationDate = new Date(store.creationDate);
  const formattedDate = `تم الإنشاء: ${creationDate.getDate()} ${creationDate.toLocaleString('ar-EG', { month: 'short' })} ${creationDate.getFullYear()}`;

  const displayUrl = store.customDomain || (store.subdomain ? `${store.subdomain}.abdomedi.com` : store.url);
  
  const isInternal = typeof window !== 'undefined' && (
      window.location.hostname.includes('run.app') || 
      window.location.hostname.includes('pages.dev') ||
      window.location.hostname.includes('localhost') ||
      window.location.hostname.includes('127.0.0.1')
  );
  
  const linkUrl = isInternal 
    ? `${window.location.origin}${window.location.pathname}?preview_store=${store.id}`
    : (displayUrl.startsWith('http') ? displayUrl : `https://${displayUrl}`);

  const copyStoreUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(linkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const employeeCount = storeData?.settings?.employees?.length || 0;

  return (
    <motion.div 
      variants={itemVariants} 
      className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1.5 flex flex-col group overflow-hidden relative"
    >
      {/* Decorative Top Accent Banner */}
      <div className="h-3.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-indigo-600 w-full" />
      
      <div className="p-6 flex-1 flex flex-col space-y-4">
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/60 px-3 py-1 rounded-full">
            <ShoppingCart size={13}/> 
            {store.specialization || 'متجر إلكتروني'}
          </span>

          <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
            <Radio size={10} className="animate-pulse text-emerald-500" />
            نشط أونلاين
          </span>
        </div>

        {/* Title and Owner */}
        <div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors leading-snug">
            {store.name}
          </h3>
          {ownerName && (
            <p className="text-xs font-bold text-slate-400 mt-1 flex items-center gap-1">
              <ShieldCheck size={13} className="text-indigo-400" />
              المالك: <span className="text-slate-600 dark:text-slate-300">{ownerName}</span>
            </p>
          )}
        </div>

        {/* Domain Link Box */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 text-xs font-medium text-slate-600 dark:text-slate-300">
            <Globe size={14} className="text-teal-500 shrink-0" />
            <span className="truncate font-mono dir-ltr">{displayUrl}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button 
              type="button" 
              onClick={copyStoreUrl}
              title="نسخ الرابط"
              className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              {copied ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
            </button>
            <a 
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="زيارة المتجر"
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* Extra Metadata Footer */}
        <div className="flex items-center justify-between pt-2 text-slate-400 text-[11px] font-semibold border-t border-slate-100 dark:border-slate-800/80">
          <span>{formattedDate}</span>
          {employeeCount > 0 && (
            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <Users size={12} />
              {employeeCount} موظفين
            </span>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-3 bg-slate-50/90 dark:bg-slate-800/80 border-t border-slate-200/80 dark:border-slate-800 rounded-b-3xl flex items-center justify-between gap-2">
        <button 
          onClick={() => onSelect(store.id)} 
          className="flex-1 py-2 px-3 bg-teal-500 hover:bg-teal-600 text-slate-950 font-black text-xs rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          <span>لوحة التحكم</span>
          <ArrowLeft size={15}/>
        </button>

        <div className="flex items-center gap-1">
          <button 
            onClick={() => onSettings(store)} 
            className="p-2 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-600" 
            title="إعدادات المتجر"
          >
            <SettingsIcon size={16}/>
          </button>
          
          <button 
            onClick={() => onInvite(store)} 
            className="p-2 text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-600" 
            title="دعوة موظف جديد"
          >
            <UserPlus size={16}/>
          </button>
          
          <button 
            onClick={() => onPreview(store.id)} 
            className="p-2 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-600" 
            title="معاينة المتجر المباشرة"
          >
            <Eye size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const ManageSitesPage: React.FC<ManageSitesPageProps> = ({ currentUser, ownedStores, collaboratingStores, setActiveStoreId, users, setUsers, allStoresData, setAllStoresData }) => {
  const navigate = useNavigate();
  const [storeToEdit, setStoreToEdit] = useState<Store | null>(null);
  const [storeToInvite, setStoreToInvite] = useState<Store | null>(null);
  const [specializationFilter, setSpecializationFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const isAdminView = currentUser?.isAdmin;

  const allPlatformStores = useMemo(() => {
    if (!isAdminView) return [];
    return users.flatMap(user => 
        user.stores?.map(store => ({ store, ownerName: user.fullName })) || []
    ).filter(item => !item.ownerName?.toLowerCase().includes('admin'));
  }, [isAdminView, users]);

  const allSpecializations = useMemo(() => {
    const storesForSpec = isAdminView ? allPlatformStores.map(item => item.store) : [...ownedStores, ...collaboratingStores];
    return [...new Set(storesForSpec.map(s => s.specialization).filter(Boolean))];
  }, [isAdminView, allPlatformStores, ownedStores, collaboratingStores]);

  const filterStore = (s: Store, ownerName?: string) => {
    const matchesSpec = specializationFilter === 'all' || s.specialization === specializationFilter;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return matchesSpec;
    
    const matchesName = s.name.toLowerCase().includes(query);
    const matchesDomain = (s.customDomain || s.subdomain || s.url || '').toLowerCase().includes(query);
    const matchesOwner = ownerName ? ownerName.toLowerCase().includes(query) : false;
    
    return matchesSpec && (matchesName || matchesDomain || matchesOwner);
  };

  const filteredOwnedStores = useMemo(() => ownedStores.filter(s => filterStore(s)), [ownedStores, specializationFilter, searchQuery]);
  const filteredCollaboratingStores = useMemo(() => collaboratingStores.filter(s => filterStore(s)), [collaboratingStores, specializationFilter, searchQuery]);
  const filteredAdminStores = useMemo(() => allPlatformStores.filter(({ store, ownerName }) => filterStore(store, ownerName)), [allPlatformStores, specializationFilter, searchQuery]);

  const handleSelectStore = (storeId: string) => {
    setActiveStoreId(storeId);
    navigate('/');
  };

  const handlePreviewStore = (storeId: string) => {
    window.open(`${window.location.origin}${window.location.pathname}?preview_store=${storeId}`, '_blank');
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
    if (!storeData || storeData.settings?.employees?.some(e => e.id === userToInvite.phone)) {
      throw new Error('هذا المستخدم هو بالفعل عضو في هذا المتجر.');
    }
    const newEmployee: Employee = { id: userToInvite.phone, name: userToInvite.fullName, email: userToInvite.email, permissions: [], status: 'invited' };
    setAllStoresData(prevData => ({
        ...prevData,
        [storeId]: { ...storeData, settings: { ...storeData.settings, employees: [...(storeData.settings?.employees || []), newEmployee] }}
    }));
    setStoreToInvite(null);
  };

  if ((ownedStores.length + collaboratingStores.length) === 0 && !isAdminView) {
    return <CreateSiteView />;
  }

  const totalStoresCount = isAdminView ? allPlatformStores.length : (ownedStores.length + collaboratingStores.length);
  const customDomainsCount = (isAdminView ? allPlatformStores.map(a => a.store) : [...ownedStores, ...collaboratingStores]).filter(s => s.customDomain).length;
  
  return (
    <>
      <motion.div 
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" 
          dir="rtl"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
      >
        {/* Header Header Card */}
        <motion.div variants={itemVariants} className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 dark:border-slate-800 pb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-2 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <StoreIconLucide size={22} />
                </span>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">إدارة المتاجر المنشأة</h1>
              </div>
              <p className="text-xs md:text-sm font-semibold text-slate-500 dark:text-slate-400 pr-11">
                {isAdminView ? "تحكم شامل وإشراف كامل على المتاجر المسجلة بالمنصة." : "التحكم بجميع متاجرك الإلكترونية، التخصيص، وإدارة الموظفين بضغطة زر."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {!isAdminView && (
                <Link 
                  to="/create-store" 
                  className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black px-6 py-3 rounded-2xl shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30 transition-all flex items-center gap-2 text-sm active:scale-95 shrink-0"
                >
                  <Plus size={18} /> أنشئ متجرك الجديد
                </Link>
              )}
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <StatCard 
              icon={<StoreIconLucide size={18} className="text-teal-500" />}
              label="إجمالي المتاجر"
              value={totalStoresCount}
            />
            <StatCard 
              icon={<Radio size={18} className="text-emerald-500" />}
              label="الحالة التشغيلية"
              value="نشط 100%"
            />
            <StatCard 
              icon={<Globe size={18} className="text-indigo-500" />}
              label="دومينات مخصصة"
              value={customDomainsCount}
            />
            <StatCard 
              icon={<Layers size={18} className="text-purple-500" />}
              label="التخصصات المتاحة"
              value={allSpecializations.length || 1}
            />
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <div className="relative flex-1 w-full">
              <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input 
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم المتجر أو الدومين..."
                className="w-full pr-10 pl-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              />
            </div>

            <div className="relative w-full sm:w-56 shrink-0">
              <Filter size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
              <select 
                value={specializationFilter} 
                onChange={e => setSpecializationFilter(e.target.value)} 
                className="appearance-none w-full pr-10 pl-8 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                <option value="all">جميع التخصصات</option>
                {allSpecializations.map(spec => <option key={spec} value={spec}>{spec}</option>)}
              </select>
              <ChevronsUpDown size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
            </div>
          </div>
        </motion.div>
        
        {/* Stores Grid Content */}
        <motion.div variants={itemVariants} className="space-y-12">
            {isAdminView ? (
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                      <ShieldCheck size={20} className="text-indigo-500" />
                      كافة متاجر المنصة ({filteredAdminStores.length})
                    </h2>
                    {filteredAdminStores.length > 0 ? (
                        <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredAdminStores.map(({ store, ownerName }) => 
                                <StoreCard 
                                  key={store.id} 
                                  store={store} 
                                  ownerName={ownerName} 
                                  storeData={allStoresData[store.id]}
                                  onSelect={handleSelectStore} 
                                  onPreview={handlePreviewStore} 
                                  onInvite={setStoreToInvite} 
                                  onSettings={setStoreToEdit} 
                                />
                            )}
                        </motion.div>
                    ) : (
                        <EmptyStoresState text="لم يتم العثور على نتائج طابق البحث الخاص بك." />
                    )}
                </div>
            ) : (
                <>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                          <StoreIconLucide size={20} className="text-teal-500" />
                          متاجرـي الشخصية ({filteredOwnedStores.length})
                        </h2>
                        {filteredOwnedStores.length > 0 ? (
                            <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredOwnedStores.map(store => 
                                    <StoreCard 
                                      key={store.id} 
                                      store={store} 
                                      storeData={allStoresData[store.id]}
                                      onSelect={handleSelectStore} 
                                      onPreview={handlePreviewStore} 
                                      onInvite={setStoreToInvite} 
                                      onSettings={setStoreToEdit} 
                                    />
                                )}
                            </motion.div>
                        ) : (
                            <EmptyStoresState text="لا توجد متاجر تطابق بحثك الحالي." />
                        )}
                    </div>

                    {collaboratingStores.length > 0 && (
                        <div>
                            <h2 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                              <Users size={20} className="text-purple-500" />
                              متاجر أعمل بها كموظف/متعاون ({filteredCollaboratingStores.length})
                            </h2>
                            <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredCollaboratingStores.map(store => 
                                    <StoreCard 
                                      key={store.id} 
                                      store={store} 
                                      storeData={allStoresData[store.id]}
                                      onSelect={handleSelectStore} 
                                      onPreview={handlePreviewStore} 
                                      onInvite={setStoreToInvite} 
                                      onSettings={setStoreToEdit} 
                                    />
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


// --- Helper Components ---

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number }> = ({ icon, label, value }) => (
  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
      {icon}
    </div>
    <div>
      <span className="text-[11px] font-bold text-slate-400 block">{label}</span>
      <span className="text-base font-black text-slate-800 dark:text-slate-100">{value}</span>
    </div>
  </div>
);

const EmptyStoresState: React.FC<{ text: string }> = ({ text }) => (
  <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center space-y-3">
    <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
      <Inbox size={36} />
    </div>
    <h3 className="font-bold text-base text-slate-700 dark:text-slate-300">{text}</h3>
    <p className="text-xs text-slate-400 max-w-sm">يمكنك إضافة متجر جديد أو تغيير التصفية والبحث للوصول للمتجر المطلوب.</p>
  </div>
);

const CreateSiteView: React.FC = () => {
 return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-right space-y-12" dir="rtl">
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl shadow-xl p-8 flex flex-col sm:flex-row justify-between items-center gap-6 border border-slate-800">
        <div>
          <h1 className="text-3xl font-black">إدارة وإنشاء المواقع الإلكترونية</h1>
          <p className="text-slate-300 text-xs md:text-sm mt-2">من هنا يمكنك إطلاق متجرك الإلكتروني الجديد والبدء في تلقي الطلبات مباشرة.</p>
        </div>
        <Link to="/create-store" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 px-6 py-3 rounded-2xl font-black shadow-lg hover:shadow-teal-500/20 transition-all active:scale-95">
          <Plus size={20} /> إنشاء متجر جديد
        </Link>
      </div>

      <div className="text-center space-y-3">
        <h2 className="text-3xl font-black text-slate-900 dark:text-white">ما نوع المشروع الذي تريد إنشائه؟</h2>
        <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm max-w-xl mx-auto">
          اختر نوع المنصة المناسبة لعملك التجاري للتخصيص الفوري.
        </p>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto text-right">
          <ChoiceCard
            title="متجر إلكتروني متكامل"
            description="أضف منتجاتك وسلة المبيعات مع نظام إدارة الطلبات والواتساب تلقائياً."
            buttonText="إلى إنشاء المتجر"
            linkTo="/create-store"
            imageUrl="https://images.unsplash.com/photo-1555529669-e69e7aa0ba9e?q=80&w=870&auto=format&fit=crop"
          />
          <ChoiceCard
            title="موقع تعريفي للأعمال"
            description="موقع احترافي للتعريف بخدماتك وشركتك للعملاء."
            buttonText="قريباً"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl animate-in zoom-in-95 duration-200 space-y-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                      <SettingsIcon size={20} className="text-indigo-500" /> 
                      إعدادات متجر: {store.name}
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-xl text-slate-400 hover:text-rose-500 transition-colors">
                      <XCircle size={22}/>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                     <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block flex items-center gap-1.5">
                          <StoreIconLucide size={16} className="text-teal-500"/> اسم المتجر
                        </label>
                        <input 
                          type="text" 
                          value={formData.name} 
                          onChange={e => setFormData(p => ({...p, name: e.target.value}))} 
                          className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-teal-500 outline-none"
                        />
                     </div>

                     <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block flex items-center gap-1.5">
                          <Tag size={16} className="text-indigo-500"/> تخصص المتجر
                        </label>
                         <select 
                          value={formData.specialization} 
                          onChange={e => setFormData(p => ({...p, specialization: e.target.value}))} 
                          className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-teal-500 outline-none"
                         >
                            <option>الصحة والجمال</option>
                            <option>ملابس وموضة</option>
                            <option>إلكترونيات وأجهزة</option>
                            <option>أدوات منزلية</option>
                            <option>عدد وأدوات يدوم</option>
                            <option>أخرى</option>
                         </select>
                     </div>

                     <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block flex items-center gap-1.5">
                          <Globe size={16} className="text-purple-500"/> النطاق المخصص (Custom Domain)
                        </label>
                        <input 
                          type="text" 
                          value={formData.customDomain || ''} 
                          onChange={e => setFormData(p => ({...p, customDomain: e.target.value}))} 
                          placeholder="مثال: store.com"
                          className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono font-bold focus:ring-2 focus:ring-teal-500 outline-none dir-ltr text-right"
                        />
                     </div>

                     <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors">إلغاء</button>
                        <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-md"><Save size={16}/> حفظ التغييرات</button>
                     </div>
                </form>
            </div>
        </div>
    )
};

const InviteEmployeeModal: React.FC<{ store: Store, onClose: () => void, onInvite: (storeId: string, email: string) => void, users: User[] }> = ({ store, onClose, onInvite }) => {
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <UserPlus size={20} className="text-purple-500" />
                    دعوة موظف لـ {store.name}
                  </h3>
                  <button onClick={onClose} className="text-slate-400 hover:text-rose-500"><XCircle size={20}/></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                     <div>
                       <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                         البريد الإلكتروني للموظف المسجل
                       </label>
                       <input 
                        type="email" 
                        value={email} 
                        onChange={e => { setEmail(e.target.value); setError(''); }} 
                        placeholder="example@gmail.com" 
                        required 
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500"
                       />
                     </div>

                     {error && (
                       <p className="text-xs text-rose-500 font-bold bg-rose-50 dark:bg-rose-950/50 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800">
                         {error}
                       </p>
                     )}

                     <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">إلغاء</button>
                      <button type="submit" className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95">
                        <Send size={15}/> إرسال دعوة
                      </button>
                     </div>
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
      <div className="overflow-hidden rounded-t-3xl">
        <img src={imageUrl} alt={title} className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-500" />
      </div>
      <div className="p-6 text-center flex-1 flex flex-col justify-between space-y-4">
        <div>
          <h3 className="text-xl font-black text-slate-800 dark:text-white">{title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{description}</p>
        </div>
        <div>
          <div className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black text-white transition-all ${disabled ? 'bg-slate-400 dark:bg-slate-600' : 'bg-teal-500 hover:bg-teal-600 group-hover:shadow-lg'}`}>
            <span>{buttonText}</span>
            <ArrowLeft size={16} />
          </div>
        </div>
      </div>
    </>
  );

  if (disabled) {
    return (
      <div className="group bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col cursor-not-allowed opacity-60">
        {content}
      </div>
    );
  }

  return (
    <Link to={linkTo} className="group bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all flex flex-col">
      {content}
    </Link>
  );
};

export default ManageSitesPage;
