import React, { useState, useEffect, useMemo } from 'react';
import { Settings, ShippingOption, CompanyFees, CityOption } from '../types';
import { Save, Info, Truck, Plus, Trash2, Wallet, Scale, AlertCircle, XCircle, Package, RefreshCcw, Percent, Coins, Building2, MapPin, Repeat, Settings as SettingsIcon, ShieldCheck, Banknote, ChevronDown, ChevronUp, Eye, ArrowRight, Link2, Plug, CheckCircle2, Wrench, ArrowLeft, Map, Link as LinkIcon, Download, ListChecks, CheckSquare, Square, Search, Lock, Unlock, Unlink, X } from 'lucide-react';
import SaveBar from './SaveBar';
import BostaSystemPortal from './BostaSystemPortal';
import { motion } from 'framer-motion';
import { generateEgyptShippingOptions, EGYPT_GOVERNORATES } from '../constants';
import { isBosta } from '../utils/financials';

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


// Helper Components (modals, toggles, etc.)
interface ToggleButtonProps { active: boolean; onToggle: () => void; variant?: "blue" | "emerald" | "amber"; disabled?: boolean; }
const ToggleButton: React.FC<ToggleButtonProps> = ({ active, onToggle, variant = "blue", disabled = false }) => {
  const colors = { blue: active ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700', emerald: active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700', amber: active ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700' };
  const disabledClasses = disabled ? 'cursor-not-allowed opacity-50' : '';
  return ( <button type="button" onClick={(e) => { if (!disabled) { e.stopPropagation(); onToggle(); } }} className={`w-12 h-6 rounded-full relative transition-all duration-300 shadow-inner ${colors[variant]} ${disabledClasses}`} disabled={disabled}> <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-md transform ${active ? 'translate-x-[-28px]' : 'translate-x-[-4px]'}`} /> <span className={`absolute inset-0 flex items-center px-1 text-[8px] font-black uppercase pointer-events-none transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0'}`} style={{ right: '4px', color: 'white' }}>On</span> <span className={`absolute inset-0 flex items-center px-1 text-[8px] font-black uppercase pointer-events-none transition-opacity duration-300 ${active ? 'opacity-0' : 'opacity-100'}`} style={{ left: '4px', color: '#64748b' }}>Off</span> </button> );
};

interface DeleteConfirmModalProps { title: string; desc: string; onConfirm: () => void; onCancel: () => void; }
const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ title, desc, onConfirm, onCancel }) => ( <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/90 backdrop-blur-sm"> <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center animate-in zoom-in duration-200 border border-slate-300 dark:border-slate-800"> <div className="w-20 h-20 bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100 dark:border-red-900"><AlertCircle size={40} /></div> <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-3 uppercase tracking-tight">{title}</h3> <p className="text-slate-600 dark:text-slate-400 text-sm mb-8 leading-relaxed font-bold">{desc}</p> <div className="flex flex-col gap-3"> <button onClick={onConfirm} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black shadow-xl hover:bg-red-700 transition-all active:scale-95">تأكيد الحذف</button> <button onClick={onCancel} className="w-full py-4 text-slate-500 dark:text-slate-400 font-black hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">تراجع</button> </div> </div> </div> );

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; }> = ({ title, icon, action, children }) => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
    <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
      <h2 className="text-xl font-bold flex items-center gap-3 text-slate-800 dark:text-white">{icon}{title}</h2>
      {action}
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const PolicyToggle: React.FC<{ label: string; description?: string; active: boolean; onToggle: () => void; }> = ({ label, description, active, onToggle }) => (
    <div className="flex items-start justify-between p-4 bg-white dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-700 transition-all hover:border-indigo-300 dark:hover:border-indigo-700">
        <div>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{label}</span>
            {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">{description}</p>}
        </div>
        <div className="flex-shrink-0 pt-0.5">
           <ToggleButton active={active} onToggle={onToggle} />
        </div>
    </div>
);

const CityManagerModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    zone: ShippingOption; 
    onSave: (cities: CityOption[]) => void 
}> = ({ isOpen, onClose, zone, onSave }) => {
    const [targetGovName, setTargetGovName] = useState('');
    const [selectedCities, setSelectedCities] = useState<string[]>([]);
    const [citySearchTerm, setCitySearchTerm] = useState('');
    
    // Determine the list of cities based on the selected governorate name and search term
    const displayedCities = useMemo(() => {
        const govCities = EGYPT_GOVERNORATES.find(g => g.name === targetGovName)?.cities || [];
        if (!citySearchTerm) return govCities;
        return govCities.filter(c => c.toLowerCase().includes(citySearchTerm.toLowerCase()));
    }, [targetGovName, citySearchTerm]);
    
    // On open, sync selected cities and try to auto-detect governorate
    useEffect(() => {
        if (isOpen) {
            const currentNames = (zone.cities || []).map(c => c.name);
            setSelectedCities(currentNames);
            
            // Try to match governorate name exactly
            const exactMatch = EGYPT_GOVERNORATES.find(g => g.name === zone.label);
            if (exactMatch) {
                setTargetGovName(exactMatch.name);
            } else if (currentNames.length > 0) {
                // If name doesn't match, try to find based on existing cities
                const reverseMatch = EGYPT_GOVERNORATES.find(g => g.cities.includes(currentNames[0]));
                if (reverseMatch) {
                    setTargetGovName(reverseMatch.name);
                } else {
                    // Default to first governorate if no match found
                    setTargetGovName(EGYPT_GOVERNORATES[0]?.name || '');
                }
            } else {
                // Default to first governorate
                setTargetGovName(EGYPT_GOVERNORATES[0]?.name || '');
            }
        }
    }, [isOpen, zone]);

    if (!isOpen) return null;

    const toggleCity = (cityName: string) => {
        setSelectedCities(prev => 
            prev.includes(cityName) 
                ? prev.filter(c => c !== cityName) 
                : [...prev, cityName]
        );
    };

    const toggleAll = () => {
        if (displayedCities.every(c => selectedCities.includes(c))) {
            // Unselect all currently displayed cities
            setSelectedCities(prev => prev.filter(c => !displayedCities.includes(c)));
        } else {
            // Select all displayed cities
            const newSelection = new Set([...selectedCities, ...displayedCities]);
            setSelectedCities(Array.from(newSelection));
        }
    };

    const handleSave = () => {
        const newCities: CityOption[] = [];
        
        // Use selectedCities state to build the final list
        selectedCities.forEach(name => {
            // Check if city already existed in zone to preserve its data
            const existingCity = (zone.cities || []).find(c => c.name === name);
            if (existingCity) {
                newCities.push(existingCity);
            } else {
                // Create new city entry linked to parent fees
                newCities.push({
                    id: `city_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                    name: name,
                    deliveryPrice: zone.deliveryPrice,
                    extraKgPrice: zone.extraKgPrice,
                    returnPrice: zone.returnPrice,
                    exchangePrice: zone.exchangePrice,
                    cashCollectionPrice: zone.cashCollectionPrice,
                    returnToSenderPrice: zone.returnToSenderPrice,
                    useParentFees: true,
                    active: true 
                });
            }
        });
        
        onSave(newCities);
    };

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl p-6 text-right flex flex-col max-h-[85vh] border border-slate-300 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <MapPin className="text-indigo-600"/> تحديد مدن {zone.label}
                    </h3>
                    <button onClick={onClose}><XCircle className="text-slate-400 hover:text-red-500"/></button>
                </div>
                
                <div className="space-y-4 mb-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">اختر المحافظة:</label>
                        <select 
                            value={targetGovName} 
                            onChange={(e) => setTargetGovName(e.target.value)}
                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">-- اختر المحافظة --</option>
                            {EGYPT_GOVERNORATES.map(g => (
                                <option key={g.name} value={g.name}>{g.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="relative">
                        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input 
                            type="text" 
                            placeholder="بحث عن مدينة..." 
                            value={citySearchTerm}
                            onChange={(e) => setCitySearchTerm(e.target.value)}
                            className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800">
                    {displayedCities.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                            <Map className="mb-2 opacity-50" size={32}/>
                            <p className="font-bold">لا توجد مدن للعرض.</p>
                        </div>
                    ) : (
                        <>
                            <button onClick={toggleAll} className="mb-4 text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                                <CheckSquare size={14}/>
                                {displayedCities.every(c => selectedCities.includes(c)) ? 'إلغاء تحديد المعروض' : 'تحديد المعروض'}
                            </button>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {displayedCities.map(city => {
                                    const isSelected = selectedCities.includes(city);
                                    return (
                                        <div 
                                            key={city} 
                                            onClick={() => toggleCity(city)}
                                            className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${isSelected ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
                                        >
                                            {isSelected ? <CheckSquare size={18} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0"/> : <Square size={18} className="text-slate-300 flex-shrink-0"/>}
                                            <span className="text-xs font-bold truncate">{city}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </>
                    )}
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 mt-2">
                    <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">إلغاء</button>
                    <button onClick={handleSave} className="px-6 py-2.5 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg active:scale-95">
                        حفظ ({selectedCities.length}) مدينة
                    </button>
                </div>
            </div>
        </div>
    );
};


const ShippingPage: React.FC<{ 
  settings: Settings, 
  setSettings: React.Dispatch<React.SetStateAction<Settings>>,
  treasury?: any,
  setTreasury?: (updater: any) => void,
  wallet?: any,
  setWallet?: (updater: any) => void
}> = ({ settings, setSettings, treasury, setTreasury, wallet, setWallet }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    // Sync with external changes, but only if not dirty
    if (!isDirty) {
      setLocalSettings(settings);
    }
  }, [settings]);

  useEffect(() => {
    setIsDirty(JSON.stringify(localSettings) !== JSON.stringify(settings));
  }, [localSettings, settings]);

  const handleSave = () => {
    setSettings(localSettings);
  };

  const handleDiscard = () => {
    setLocalSettings(settings);
  };

  const [view, setView] = useState<'main' | string>('main');
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [companyToDelete, setCompanyToDelete] = useState<string | null>(null);

  const handleBack = () => {
    if (isDirty) {
      if (window.confirm('لديك تغييرات غير محفوظة. هل تريد تجاهلها والعودة؟')) {
        handleDiscard();
        setView('main');
      }
    } else {
      setView('main');
    }
  };

  const addNewCompany = () => {
    if (!newCompanyName.trim()) return;
    const name = newCompanyName.trim();
    if (localSettings.shippingOptions[name]) { alert("هذه الشركة موجودة بالفعل!"); return; }
    setLocalSettings((prev: Settings) => ({
      ...prev,
      shippingOptions: { ...prev.shippingOptions, [name]: [] },
      activeCompanies: { ...prev.activeCompanies, [name]: true },
      exchangeSupported: { ...(prev.exchangeSupported || {}), [name]: true },
      companySpecificFees: { 
        ...prev.companySpecificFees, 
        [name]: { 
          insuranceFeePercent: prev.insuranceFeePercent, 
          inspectionFee: prev.inspectionFee, 
          returnShippingFee: prev.returnShippingFee, 
          useCustomFees: false, 
          defaultInspectionActive: true, 
          enableCodFees: true, 
          codThreshold: prev.codThreshold, 
          codFeeRate: prev.codFeeRate, 
          codTaxRate: prev.codTaxRate, 
          enableReturnAfter: true, 
          enableReturnWithout: true, 
          enableExchange: true, 
          enableFixedReturn: true, 
          postCollectionReturnRefundsProductPrice: true,
          baseWeight: 1 // إضافة الوزن الافتراضي هنا
        } 
      }
    }));
    setNewCompanyName('');
    setShowAddCompany(false);
  };

  const deleteFullCompany = () => {
    if (!companyToDelete) return;
    setLocalSettings((prev: Settings) => {
      const newOpts = { ...prev.shippingOptions }; const newActive = { ...prev.activeCompanies }; const newExchange = { ...(prev.exchangeSupported || {}) }; const newFees = { ...prev.companySpecificFees };
      delete newOpts[companyToDelete]; delete newActive[companyToDelete]; delete newExchange[companyToDelete]; delete newFees[companyToDelete];
      return { ...prev, shippingOptions: newOpts, activeCompanies: newActive, exchangeSupported: newExchange, companySpecificFees: newFees };
    });
    setCompanyToDelete(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 text-right pb-20 px-4">
        <div className="relative min-h-[600px] w-full overflow-x-hidden">
            <div className={`transition-all duration-500 ease-in-out ${view !== 'main' ? 'absolute opacity-0 -translate-x-full' : 'translate-x-0'}`}>
                <ShippingDashboard 
                    settings={localSettings} 
                    setSettings={setLocalSettings} 
                    onManageCompany={(company: string) => setView(company)} 
                    onAddCompany={() => setShowAddCompany(true)} 
                    onDeleteCompany={(company: string) => setCompanyToDelete(company)} 
                />
            </div>
            <div className={`transition-all duration-500 ease-in-out absolute w-full top-0 ${view === 'main' ? 'translate-x-full opacity-0 pointer-events-none' : 'translate-x-0'}`}>
                {view !== 'main' && view !== 'bosta-system' && (
                    <CompanyManager 
                        companyName={view} 
                        settings={localSettings} 
                        setSettings={setLocalSettings} 
                        onBack={handleBack} 
                    />
                )}
                {view === 'bosta-system' && (
                    <BostaSystemPortal 
                        onBack={handleBack} 
                        treasury={treasury}
                        setTreasury={setTreasury}
                        wallet={wallet}
                        setWallet={setWallet}
                        settings={settings}
                        setSettings={setSettings}
                    />
                )}
            </div>
        </div>

      {showAddCompany && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl p-8 text-right animate-in zoom-in duration-200 border border-slate-300 dark:border-slate-800">
              <div className="flex items-center gap-4 text-indigo-600 dark:text-indigo-400 mb-8 pb-4 border-b border-slate-200 dark:border-slate-800">
                 <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl"><Building2 size={28} /></div>
                 <h3 className="text-2xl font-black dark:text-white">إضافة شركة شحن جديدة</h3>
              </div>
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-sm font-black text-slate-700 dark:text-slate-400 uppercase">اسم الشركة</label>
                    <input type="text" autoFocus placeholder="مثلاً: بوسطة، فيديكس..." className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white dark:focus:bg-slate-700 transition-all text-lg font-black dark:text-white" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addNewCompany()}/>
                 </div>
                 <div className="flex flex-col gap-3 pt-4">
                    <button onClick={addNewCompany} disabled={!newCompanyName.trim()} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 transition-all flex items-center justify-center gap-2 active:scale-95"><Save size={20} /> حفظ الشركة</button>
                    <button onClick={() => { setShowAddCompany(false); setNewCompanyName(''); }} className="w-full py-4 text-slate-500 dark:text-slate-400 font-black hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">إلغاء</button>
                 </div>
              </div>
           </div>
        </div>
      )}
      {companyToDelete && <DeleteConfirmModal title={`حذف شركة ${companyToDelete}؟`} desc="سيتم مسح كافة المناطق والبيانات المالية المرتبطة بهذه الشركة نهائياً." onConfirm={deleteFullCompany} onCancel={() => setCompanyToDelete(null)} />}
      <SaveBar isVisible={isDirty} onSave={handleSave} onDiscard={handleDiscard} />
    </div>
  );
};

const ShippingDashboard: React.FC<any> = ({ settings, setSettings, onManageCompany, onAddCompany, onDeleteCompany }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { const { name, value, type } = e.target; setSettings((prev: Settings) => ({ ...prev, [name]: type === 'number' ? Number(value) : value })); };
    const toggleSetting = (key: keyof Settings) => { setSettings((prev: Settings) => ({ ...prev, [key]: !prev[key] })); };
    const toggleCompanyActive = (company: string) => { setSettings((prev: Settings) => ({ ...prev, activeCompanies: { ...prev.activeCompanies, [company]: !prev.activeCompanies[company] } })); };

    return (
        <motion.div 
            className="space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
             <motion.div variants={itemVariants} className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl"><Truck size={28} /></div>
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white">إعدادات الشحن</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">إدارة شركات الشحن، مناطق التوصيل، والسياسات المالية.</p>
                </div>
            </motion.div>

            <motion.div variants={itemVariants} className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-2xl shadow-md border border-indigo-500/30">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-2 text-right">
                        <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-[10px] font-black w-fit">
                            <Truck size={12} /> بوابة الشريك الرسمي لبوسطة
                        </div>
                        <h2 className="text-xl font-black">نظام بوسطة في الشحن (Bosta Shipping System)</h2>
                        <p className="text-blue-100 text-xs font-bold max-w-2xl leading-relaxed">استعراض أسعار شركة بوسطة الرسمية بمصر بالفئات والجهات، حاسبة الرسوم المتقدمة مع ضريبة القيمة المضافة 14% ورسوم السحب النقدي لبوسطة.</p>
                    </div>
                    <button 
                        type="button"
                        onClick={() => onManageCompany('bosta-system')} 
                        className="bg-white text-indigo-700 hover:bg-blue-50 px-5 py-3 rounded-xl font-black text-xs shadow-xl transition-all hover:scale-[1.02] active:scale-95 whitespace-nowrap self-stretch md:self-auto text-center"
                    >
                        فتح بوابة بوسطة الحصرية
                    </button>
                </div>
            </motion.div>
            
            <motion.div variants={itemVariants}>
              <SectionCard title="شركات الشحن" icon={<Building2 size={22} className="text-indigo-600 dark:text-indigo-400" />} action={<button onClick={onAddCompany} className="flex items-center gap-2 text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-indigo-700 active:scale-95 transition-all"><Plus size={16} /> إضافة شركة</button>}>
                  <div className="space-y-3">
                      {Object.keys(settings.shippingOptions).length > 0 ? Object.keys(settings.shippingOptions).map((company) => (
                          <div key={company} className="flex items-center justify-between p-3 pr-5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                              <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${settings.activeCompanies[company] ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}><Truck size={20}/></div>
                                  <span className="font-bold text-slate-800 dark:text-white">{company}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                  <ToggleButton active={settings.activeCompanies[company]} onToggle={() => toggleCompanyActive(company)} />
                                  <button onClick={() => onManageCompany(company)} className="px-4 py-2 text-xs font-bold bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600">إدارة</button>
                                  <button onClick={() => onDeleteCompany(company)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                              </div>
                          </div>
                      )) : <p className="text-center text-sm text-slate-400 py-4">لم تقم بإضافة أي شركات شحن بعد.</p>}
                  </div>
              </SectionCard>
            </motion.div>

            <motion.div variants={itemVariants}>
              <SectionCard title="الإعدادات المالية العامة" icon={<Coins size={22} className="text-emerald-600 dark:text-emerald-400" />} action={<ToggleButton active={settings.enableGlobalFinancials} onToggle={() => toggleSetting('enableGlobalFinancials')} variant="emerald" />}>
                  <div className={`space-y-6 transition-all duration-300 ${!settings.enableGlobalFinancials && 'opacity-40 pointer-events-none grayscale'}`}>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                          <FinancialCard label="نسبة التأمين (%)" name="insuranceFeePercent" value={settings.insuranceFeePercent} isActive={settings.enableInsurance} onToggle={() => toggleSetting('enableInsurance')} onChange={handleChange} icon={<ShieldCheck size={16} className="text-blue-500" />} desc="تُخصم من إجمالي الأوردر عند التحصيل." />
                          <FinancialCard label="رسوم المعاينة (ج.م)" name="inspectionFee" value={settings.inspectionFee} isActive={settings.enableInspection} onToggle={() => toggleSetting('enableInspection')} onChange={handleChange} icon={<Eye size={16} className="text-emerald-500" />} desc="رسوم مقابل فحص المنتج عند الاستلام." />
                          <FinancialCard label="شحن المرتجع (ج.م)" name="returnShippingFee" value={settings.returnShippingFee} isActive={settings.enableReturnShipping} onToggle={() => toggleSetting('enableReturnShipping')} onChange={handleChange} icon={<RefreshCcw size={16} className="text-red-500" />} desc="مبلغ إضافي يُحسب كخسارة في المرتجع." />
                          <FinancialCard label="السعر الافتراضي (ج.م)" name="defaultProductPrice" value={settings.defaultProductPrice} isActive={settings.enableDefaultPrice} onToggle={() => toggleSetting('enableDefaultPrice')} onChange={handleChange} icon={<Package size={16} className="text-indigo-500" />} desc="السعر التلقائي عند تسجيل أوردر جديد." />
                          <FinancialCard label="رسوم فليكس شيب (ج.م)" name="flexShipFee" value={settings.flexShipFee || 0} isActive={settings.enableFlexShip || false} onToggle={() => toggleSetting('enableFlexShip')} onChange={handleChange} icon={<Truck size={16} className="text-violet-500" />} desc="رسوم إضافية تُطلب من المستلم عند رفض الاستلام." />
                          <div className="p-5 rounded-2xl border bg-white dark:bg-slate-800/30 border-slate-300 dark:border-slate-700 transition-all">
                              <div className="flex items-center justify-between mb-4">
                                  <label className="text-sm font-black text-slate-800 dark:text-slate-300 flex items-center gap-2"><Package size={16} className="text-orange-500" /> الوزن الافتراضي (كجم)</label>
                              </div>
                              <div className="relative">
                                  <input type="number" name="baseWeight" className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-black dark:text-white shadow-inner transition-all" value={settings.baseWeight ?? 5} onChange={handleChange} />
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-3 leading-relaxed font-bold">الوزن الأساسي المشمول في سعر الشحن.</p>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                          {/* طريقة احتساب التأمين الافتراضية */}
                          <div className="p-5 rounded-2xl border bg-white dark:bg-slate-800/30 border-slate-300 dark:border-slate-700 transition-all">
                              <label className="text-sm font-black text-slate-800 dark:text-slate-300 flex items-center gap-2 mb-4">
                                  <ShieldCheck size={16} className="text-blue-500" /> أساس احتساب رسوم التأمين الافتراضي
                              </label>
                              <select 
                                  name="insuranceBasis" 
                                  className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold dark:text-white" 
                                  value={settings.insuranceBasis ?? 'total'} 
                                  onChange={(e) => setSettings((prev: Settings) => ({ ...prev, insuranceBasis: e.target.value as any }))}
                              >
                                  <option value="total">سعر المنتج + مصاريف الشحن (الإجمالي)</option>
                                  <option value="cost">سعر شراء/تكلفة المنتج الفعلي</option>
                                  <option value="price">سعر بيع المنتج الأصلي فقط</option>
                                  <option value="base">السعر الأساسي للمنتج</option>
                              </select>
                              <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-3 leading-relaxed font-bold">الأساس الحسابي الافتراضي لنسبة التأمين لجميع الشركات.</p>
                          </div>
                          
                          {/* ضريبة القيمة المضافة الافتراضية */}
                          <div className="p-5 rounded-2xl border bg-white dark:bg-slate-800/30 border-slate-300 dark:border-slate-700 transition-all">
                              <label className="text-sm font-black text-slate-800 dark:text-slate-300 flex items-center gap-2 mb-4">
                                  <Coins size={16} className="text-emerald-500" /> ضريبة القيمة المضافة الافتراضية للشحن (%)
                              </label>
                              <input 
                                  type="number" 
                                  step="1" 
                                  className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold dark:text-white shadow-inner" 
                                  value={settings.shippingVatRate !== undefined ? Math.round(settings.shippingVatRate * 100) : 0} 
                                  onChange={(e) => setSettings((prev: Settings) => ({ ...prev, shippingVatRate: Number(e.target.value) / 100 }))} 
                                  placeholder="مثلاً 14 لـ 14%" 
                              />
                              <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-3 leading-relaxed font-bold">النسبة الضريبية التلقائية المستحقة على مجموع الشحن والتأمين لجميع الشركات.</p>
                          </div>
                      </div>
                  </div>
              </SectionCard>
            </motion.div>
            
            <motion.div variants={itemVariants}>
              <SectionCard title="الربط الإلكتروني (API)" icon={<Plug size={22} className="text-slate-600 dark:text-slate-400" />}>
                  <div className="text-center py-10 text-slate-400">
                      <Wrench size={48} className="mx-auto mb-4 opacity-50"/>
                      <p className="font-bold">قريباً... تحت الإنشاء</p>
                      <p className="text-sm mt-1">نحن نعمل على ربط النظام مع شركات الشحن لتسهيل إنشاء البوالص.</p>
                  </div>
              </SectionCard>
            </motion.div>
        </motion.div>
    );
};

const CompanyManager: React.FC<any> = ({ companyName, settings, setSettings, onBack }) => {
    const [activeTab, setActiveTab] = useState<'zones' | 'financials'>('zones');
    return (
        <div className="space-y-6">
             <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"><ArrowRight size={20}/></button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 dark:text-white">إدارة شركة: {companyName}</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">تعديل مناطق الشحن والسياسات المالية الخاصة بالشركة.</p>
                    </div>
                 </div>
             </div>
             <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-xl flex items-center gap-2">
                <button onClick={() => setActiveTab('zones')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'zones' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700/50'}`}><MapPin size={16}/> مناطق الشحن</button>
                <button onClick={() => setActiveTab('financials')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'financials' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700/50'}`}><Wallet size={16}/> الإعدادات المالية</button>
             </div>
             <div className="transition-opacity duration-300 animate-in fade-in">
                {activeTab === 'zones' && <ZonesEditor companyName={companyName} settings={settings} setSettings={setSettings} />}
                {activeTab === 'financials' && <CompanyFinancialsEditor companyName={companyName} settings={settings} setSettings={setSettings} />}
             </div>
        </div>
    );
};

// ... (Rest of components remain the same, just receiving `setSettings` which is actually `setLocalSettings`)
const ZonesEditor: React.FC<any> = ({ companyName, settings, setSettings }) => {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedZoneId, setExpandedZoneId] = useState<string | null>(null);
  const [managingZoneId, setManagingZoneId] = useState<string | null>(null);
  
  const [newCityName, setNewCityName] = useState('');
  const [newCityDelivery, setNewCityDelivery] = useState('');
  const [newCityExtraKg, setNewCityExtraKg] = useState('');
  const [newCityReturn, setNewCityReturn] = useState('');
  const [newCityExchange, setNewCityExchange] = useState('');
  const [newCityCashCollection, setNewCityCashCollection] = useState('');
  const [newCityReturnToSender, setNewCityReturnToSender] = useState('');
  const [newCityUseParent, setNewCityUseParent] = useState(true);

  const companyFees = settings.companySpecificFees?.[companyName] || {};
  const showExchange = companyFees.enableExchange !== false;
  const showReturn = companyFees.enableReturn !== false;
  const showCashCollection = companyFees.enableCashCollection !== false;
  const showReturnToSender = companyFees.enableReturnToSender !== false;

  const numActiveColumns = 2 + (showExchange ? 1 : 0) + (showReturn ? 1 : 0) + (showCashCollection ? 1 : 0) + (showReturnToSender ? 1 : 0);
  const gridTemplate = `minmax(140px, 1.5fr) 40px repeat(${numActiveColumns}, minmax(65px, 1fr)) 40px`;

  // When expanding a zone, we want to auto-fill the inputs with parent values if "Link" is checked
  useEffect(() => {
      if (expandedZoneId && newCityUseParent) {
          const zone = settings.shippingOptions[companyName]?.find((z: any) => z.id === expandedZoneId);
          if (zone) {
              setNewCityDelivery(zone.deliveryPrice !== undefined && zone.deliveryPrice !== null ? String(zone.deliveryPrice) : '');
              setNewCityExtraKg(zone.extraKgPrice !== undefined && zone.extraKgPrice !== null ? String(zone.extraKgPrice) : '');
              setNewCityReturn(zone.returnPrice !== undefined && zone.returnPrice !== null ? String(zone.returnPrice) : '');
              setNewCityExchange(zone.exchangePrice !== undefined && zone.exchangePrice !== null ? String(zone.exchangePrice) : '');
              setNewCityCashCollection(zone.cashCollectionPrice !== undefined && zone.cashCollectionPrice !== null ? String(zone.cashCollectionPrice) : '');
              setNewCityReturnToSender(zone.returnToSenderPrice !== undefined && zone.returnToSenderPrice !== null ? String(zone.returnToSenderPrice) : '');
          }
      }
  }, [expandedZoneId, newCityUseParent, settings.shippingOptions, companyName]);

  const addShippingOption = () => {
    const newOption: ShippingOption = { 
        id: Date.now().toString(), 
        label: 'منطقة جديدة', 
        details: 'تفاصيل المنطقة...', 
        deliveryPrice: 50, 
        baseWeight: 1, 
        extraKgPrice: 10, 
        returnPrice: 35, 
        exchangePrice: 70, 
        cashCollectionPrice: 20,
        returnToSenderPrice: 35,
        cities: [] 
    };
    setSettings((prev: Settings) => ({ ...prev, shippingOptions: { ...prev.shippingOptions, [companyName]: [...(prev.shippingOptions[companyName] || []), newOption] } }));
  };
  const updateShippingOption = (id: string, field: keyof ShippingOption, value: string | number) => {
    setSettings((prev: Settings) => ({ ...prev, shippingOptions: { ...prev.shippingOptions, [companyName]: (prev.shippingOptions[companyName] || []).map(opt => opt.id === id ? { ...opt, [field]: value } : opt) } }));
  };
  const removeShippingOption = () => {
    if (!confirmDelete) return;
    setSettings((prev: Settings) => ({ ...prev, shippingOptions: { ...prev.shippingOptions, [companyName]: (prev.shippingOptions[companyName] || []).filter(opt => opt.id !== confirmDelete) } }));
    setConfirmDelete(null);
  };

  const addCity = (zoneId: string) => {
      if (!newCityName || (!newCityUseParent && !newCityDelivery)) return;
      const zone = settings.shippingOptions[companyName]?.find((z: any) => z.id === zoneId);
      
      const newCity: CityOption = {
          id: Date.now().toString(),
          name: newCityName,
          deliveryPrice: newCityUseParent ? (zone?.deliveryPrice || 0) : Number(newCityDelivery),
          extraKgPrice: newCityUseParent ? (zone?.extraKgPrice || 0) : Number(newCityExtraKg) || 0,
          returnPrice: newCityUseParent ? (zone?.returnPrice || 0) : Number(newCityReturn) || 0,
          exchangePrice: newCityUseParent ? (zone?.exchangePrice || 0) : Number(newCityExchange) || 0,
          cashCollectionPrice: newCityUseParent ? (zone?.cashCollectionPrice || 0) : Number(newCityCashCollection) || 0,
          returnToSenderPrice: newCityUseParent ? (zone?.returnToSenderPrice || 0) : Number(newCityReturnToSender) || 0,
          useParentFees: newCityUseParent,
          active: true
      };
      
      setSettings((prev: Settings) => ({
          ...prev,
          shippingOptions: {
              ...prev.shippingOptions,
              [companyName]: (prev.shippingOptions[companyName] || []).map(opt => {
                  if (opt.id === zoneId) {
                      return { ...opt, cities: [...(opt.cities || []), newCity] };
                  }
                  return opt;
              })
          }
      }));
      setNewCityName('');
      // Keep price fields populated if linked, otherwise reset or keep as is? Reset for UX.
      if (!newCityUseParent) {
          setNewCityDelivery('');
          setNewCityExtraKg('');
          setNewCityReturn('');
          setNewCityExchange('');
          setNewCityCashCollection('');
          setNewCityReturnToSender('');
      }
  };

  // Changed from removeCity to toggleCityStatus
  const toggleCityStatus = (zoneId: string, cityId: string) => {
      setSettings((prev: Settings) => ({
          ...prev,
          shippingOptions: {
              ...prev.shippingOptions,
              [companyName]: (prev.shippingOptions[companyName] || []).map(opt => {
                  if (opt.id === zoneId) {
                      return { 
                          ...opt, 
                          cities: (opt.cities || []).map(c => {
                              if (c.id === cityId) {
                                  // Toggle active status (default to true if undefined)
                                  const isActive = c.active !== false;
                                  return { ...c, active: !isActive };
                              }
                              return c;
                          })
                      };
                  }
                  return opt;
              })
          }
      }));
  };

  const toggleZoneStatus = (id: string) => {
      setSettings((prev: Settings) => ({
          ...prev,
          shippingOptions: {
              ...prev.shippingOptions,
              [companyName]: (prev.shippingOptions[companyName] || []).map(opt => {
                  if (opt.id === id) {
                      const isActive = opt.active !== false;
                      // If we are deactivating, collapse it if it's currently expanded
                      if (isActive && expandedZoneId === id) {
                          setExpandedZoneId(null);
                      }
                      return { ...opt, active: !isActive };
                  }
                  return opt;
              })
          }
      }));
  };

  const toggleCityLink = (zoneId: string, cityId: string, currentCity: CityOption, zone: ShippingOption) => {
        const newValue = !currentCity.useParentFees;
        let updates: any = { useParentFees: newValue };

        // If switching to Custom (False), copy parent values to the city so the inputs aren't empty/zero
        if (!newValue) {
            updates = {
                ...updates,
                deliveryPrice: zone.deliveryPrice,
                extraKgPrice: zone.extraKgPrice,
                returnPrice: zone.returnPrice,
                exchangePrice: zone.exchangePrice,
                cashCollectionPrice: zone.cashCollectionPrice,
                returnToSenderPrice: zone.returnToSenderPrice
            };
        }

        setSettings((prev: Settings) => ({
            ...prev,
            shippingOptions: {
                ...prev.shippingOptions,
                [companyName]: (prev.shippingOptions[companyName] || []).map(opt => {
                    if (opt.id === zoneId) {
                        return {
                            ...opt,
                            cities: (opt.cities || []).map(c => c.id === cityId ? { ...c, ...updates } : c)
                        };
                    }
                    return opt;
                })
            }
        }));
    };

    const updateCityField = (zoneId: string, cityId: string, field: keyof CityOption, value: any) => {
        setSettings((prev: Settings) => ({
            ...prev,
            shippingOptions: {
                ...prev.shippingOptions,
                [companyName]: (prev.shippingOptions[companyName] || []).map(opt => {
                    if (opt.id === zoneId) {
                        return {
                            ...opt,
                            cities: (opt.cities || []).map(c => c.id === cityId ? { ...c, [field]: value } : c)
                        };
                    }
                    return opt;
                })
            }
        }));
    };

    // New: Helper to reset all cities in a zone to linked status
    const resetAllToLinked = (e: React.MouseEvent, zoneId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if(!window.confirm("هل أنت متأكد من ربط جميع المدن بسعر المنطقة؟ سيتم إلغاء أي أسعار مخصصة.")) return;
        setSettings((prev: Settings) => ({
            ...prev,
            shippingOptions: {
                ...prev.shippingOptions,
                [companyName]: (prev.shippingOptions[companyName] || []).map(opt => {
                    if (opt.id === zoneId) {
                        return {
                            ...opt,
                            cities: (opt.cities || []).map(c => ({ ...c, useParentFees: true }))
                        };
                    }
                    return opt;
                })
            }
        }));
    };
    
    // New: Helper to unlink all
    const unlinkAll = (e: React.MouseEvent, zoneId: string, zone: ShippingOption) => {
        e.preventDefault();
        e.stopPropagation();
        if(!window.confirm("هل أنت متأكد من فك ربط جميع المدن؟ ستحتفظ المدن بالأسعار الحالية كأسعار مخصصة.")) return;
        setSettings((prev: Settings) => ({
            ...prev,
            shippingOptions: {
                ...prev.shippingOptions,
                [companyName]: (prev.shippingOptions[companyName] || []).map(opt => {
                    if (opt.id === zoneId) {
                        return {
                            ...opt,
                            cities: (opt.cities || []).map(c => ({ 
                                ...c, 
                                useParentFees: false,
                                shippingPrice: zone.deliveryPrice,
                                extraKgPrice: zone.extraKgPrice,
                                returnPrice: zone.returnPrice,
                                exchangePrice: zone.exchangePrice,
                                cashCollectionPrice: zone.cashCollectionPrice,
                                returnToSenderPrice: zone.returnToSenderPrice
                            }))
                        };
                    }
                    return opt;
                })
            }
        }));
    };

  const toggleExpand = (id: string) => {
      if (expandedZoneId === id) {
          setExpandedZoneId(null);
      } else {
          setExpandedZoneId(id);
          // Reset linked state to true when opening a new zone for convenience
          setNewCityUseParent(true);
      }
  };

  const loadEgyptData = () => {
    if (confirm('سيتم إضافة جميع محافظات ومدن مصر إلى هذه الشركة. هل تريد المتابعة؟')) {
        const egyptZones = generateEgyptShippingOptions();
        setSettings((prev: Settings) => ({
            ...prev,
            shippingOptions: {
                ...(prev.shippingOptions || {}),
                [companyName]: egyptZones
            }
        }));
        alert('تم استيراد محافظات مصر بنجاح!');
    }
  }

  const handleUpdateZoneCities = (newCities: CityOption[]) => {
      if (!managingZoneId) return;
      setSettings((prev: Settings) => ({
          ...prev,
          shippingOptions: {
              ...prev.shippingOptions,
              [companyName]: (prev.shippingOptions[companyName] || []).map(opt => {
                  if (opt.id === managingZoneId) {
                      return { ...opt, cities: newCities };
                  }
                  return opt;
              })
          }
      }));
      setManagingZoneId(null);
  };

  const managingZone = settings.shippingOptions[companyName]?.find(z => z.id === managingZoneId);

  return (
    <SectionCard title="جدول تسعير المناطق" icon={<MapPin size={22} />} action={<div className="flex gap-2"><button onClick={loadEgyptData} className="flex items-center gap-2 text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-4 py-2 rounded-lg font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"><Download size={16} /> استيراد محافظات مصر</button><button onClick={addShippingOption} className="flex items-center gap-2 text-xs bg-blue-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm"><Plus size={16} /> إضافة منطقة</button></div>}>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase">
            <tr>
              <th className="p-3 text-right">المنطقة / المحافظة</th>
              <th className="p-3 text-center">توصيل</th>
              {showExchange && <th className="p-3 text-center">تبديل</th>}
              {showReturn && <th className="p-3 text-center">إرجاع</th>}
              {showCashCollection && <th className="p-3 text-center">تحصيل</th>}
              {showReturnToSender && <th className="p-3 text-center">إرجاع لك</th>}
              <th className="p-3 text-center">ز.كجم</th>
              <th className="p-3 text-center">المدن</th>
              <th className="p-3 text-center">إلغاء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {(settings.shippingOptions[companyName] || []).map((opt: ShippingOption) => {
              const isActive = opt.active !== false;
              return (
              <React.Fragment key={opt.id}>
                  <tr className={`transition-all ${!isActive ? 'opacity-50 grayscale bg-slate-100 dark:bg-slate-800/50' : ''}`}>
                    <td className="p-2 w-40"><input type="text" disabled={!isActive} className="w-full bg-slate-50 dark:bg-slate-800 px-2 py-2 border border-slate-200 dark:border-slate-700 rounded-md font-bold text-[11px] text-slate-900 dark:text-white disabled:bg-transparent" value={opt.label ?? ''} onChange={(e) => updateShippingOption(opt.id, 'label', e.target.value)} /></td>
                    <td className="p-1"><input type="number" disabled={!isActive} className="w-full text-center bg-white dark:bg-slate-800 px-1 py-2 border border-slate-200 dark:border-slate-700 rounded-md font-bold text-[11px] text-slate-900 dark:text-white disabled:bg-transparent" value={opt.deliveryPrice ?? ''} onChange={(e) => updateShippingOption(opt.id, 'deliveryPrice', Number(e.target.value))} /></td>
                    {showExchange && <td className="p-1"><input type="number" disabled={!isActive} className="w-full text-center bg-white dark:bg-slate-800 px-1 py-2 border border-slate-200 dark:border-slate-700 rounded-md font-bold text-[11px] text-slate-900 dark:text-white disabled:bg-transparent" value={opt.exchangePrice ?? ''} onChange={(e) => updateShippingOption(opt.id, 'exchangePrice', Number(e.target.value))} /></td>}
                    {showReturn && <td className="p-1"><input type="number" disabled={!isActive} className="w-full text-center bg-white dark:bg-slate-800 px-1 py-2 border border-slate-200 dark:border-slate-700 rounded-md font-bold text-[11px] text-slate-900 dark:text-white disabled:bg-transparent" value={opt.returnPrice ?? ''} onChange={(e) => updateShippingOption(opt.id, 'returnPrice', Number(e.target.value))} /></td>}
                    {showCashCollection && <td className="p-1"><input type="number" disabled={!isActive} className="w-full text-center bg-white dark:bg-slate-800 px-1 py-2 border border-slate-200 dark:border-slate-700 rounded-md font-bold text-[11px] text-slate-900 dark:text-white disabled:bg-transparent" value={opt.cashCollectionPrice ?? ''} onChange={(e) => updateShippingOption(opt.id, 'cashCollectionPrice', Number(e.target.value))} /></td>}
                    {showReturnToSender && <td className="p-1"><input type="number" disabled={!isActive} className="w-full text-center bg-white dark:bg-slate-800 px-1 py-2 border border-slate-200 dark:border-slate-700 rounded-md font-bold text-[11px] text-slate-900 dark:text-white disabled:bg-transparent" value={opt.returnToSenderPrice ?? ''} onChange={(e) => updateShippingOption(opt.id, 'returnToSenderPrice', Number(e.target.value))} /></td>}
                    <td className="p-1"><input type="number" disabled={!isActive} className="w-full text-center bg-white dark:bg-slate-800 px-1 py-2 border border-slate-200 dark:border-slate-700 rounded-md font-bold text-[11px] text-slate-900 dark:text-white disabled:bg-transparent" value={opt.extraKgPrice ?? ''} onChange={(e) => updateShippingOption(opt.id, 'extraKgPrice', Number(e.target.value))} /></td>
                    <td className="p-2 text-center">
                        <button disabled={!isActive} onClick={() => toggleExpand(opt.id)} className={`p-2 rounded-lg transition-colors ${expandedZoneId === opt.id ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'} disabled:opacity-50`}>
                            <Map size={16} />
                        </button>
                    </td>
                    <td className="p-2 text-center">
                        <button onClick={() => toggleZoneStatus(opt.id)} className={`p-2 rounded-lg transition-colors ${isActive ? 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`} title={isActive ? "إلغاء تفعيل المنطقة" : "إعادة تفعيل المنطقة"}>
                            {isActive ? <XCircle size={16} /> : <RefreshCcw size={16} />}
                        </button>
                    </td>
                  </tr>
                  
                  {expandedZoneId === opt.id && (
                      <tr>
                          <td colSpan={10} className="p-0">
                              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-y border-indigo-100 dark:border-slate-700">
                                  <div className="max-w-5xl mx-auto">
                                      <div className="flex justify-between items-center mb-3">
                                          <div className="flex items-center gap-2">
                                              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                  <Map size={14} className="text-indigo-500"/>
                                                  المدن التابعة لـ {opt.label}
                                              </h4>
                                              {/* Bulk Actions for Linking */}
                                              <div className="flex bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 ml-4">
                                                  <button type="button" onClick={(e) => resetAllToLinked(e, opt.id)} className="px-2 py-1 text-[10px] font-bold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700 rounded" title="ربط جميع المدن بسعر المنطقة">
                                                      <LinkIcon size={12} className="inline mr-1"/> ربط الكل
                                                  </button>
                                                  <div className="w-px bg-slate-200 dark:bg-slate-700 mx-0.5"></div>
                                                  <button type="button" onClick={(e) => unlinkAll(e, opt.id, opt)} className="px-2 py-1 text-[10px] font-bold text-slate-600 hover:text-orange-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700 rounded" title="فك ربط جميع المدن لتعديل الأسعار">
                                                      <Unlink size={12} className="inline mr-1"/> فك الكل
                                                  </button>
                                              </div>
                                          </div>
                                          <button onClick={() => setManagingZoneId(opt.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 rounded-lg transition-colors">
                                              <ListChecks size={14}/> تحديد المدن المتاحة
                                          </button>
                                      </div>
                                      
                                      {/* New Header Row for City List */}
                                          <div className="grid gap-2 mb-2 p-2 bg-slate-200 dark:bg-slate-700/50 rounded-t-lg border-b border-slate-300 dark:border-slate-600 text-[10px] font-bold text-slate-600 dark:text-slate-300 text-center items-center" style={{ gridTemplateColumns: gridTemplate }}>
                                              <div className="text-right pr-2">المدينة</div>
                                              <div>ربط</div>
                                              <div>توصيل</div>
                                              {showExchange && <div>تبديل</div>}
                                              {showReturn && <div>إرجاع</div>}
                                              {showCashCollection && <div>تحصيل</div>}
                                              {showReturnToSender && <div>إرجاع لك</div>}
                                              <div>ز.كجم</div>
                                              <div>حالة</div>
                                          </div>

                                          <div className="space-y-1 mb-4">
                                              {opt.cities && opt.cities.length > 0 ? (
                                                  opt.cities.map(city => {
                                                      const isLinked = city.useParentFees;
                                                      const isActive = city.active !== false; 
                                                      
                                                      return (
                                                      <div key={city.id} className={`grid gap-2 items-center p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm group text-[10px] text-center transition-all ${!isActive ? 'opacity-60 grayscale bg-slate-100 dark:bg-slate-800/50' : 'bg-white dark:bg-slate-900'}`} style={{ gridTemplateColumns: gridTemplate }}>
                                                          <div className={`text-right font-bold px-2 truncate ${!isActive ? 'text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`} title={city.name}>
                                                              {city.name}
                                                          </div>
                                                          <div>
                                                              <button 
                                                                  type="button"
                                                                  onClick={() => toggleCityLink(opt.id, city.id, city, opt)}
                                                                  disabled={!isActive}
                                                                  className={`p-1 rounded transition-colors ${isLinked ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'} disabled:opacity-50`}
                                                                  title={isLinked ? 'مرتبط بسعر المنطقة (اضغط لفك الربط)' : 'سعر مخصص (اضغط للربط بالمنطقة)'}
                                                              >
                                                                  {isLinked ? <LinkIcon size={14} /> : <Unlock size={14} />}
                                                              </button>
                                                          </div>
                                                          <div className={`${isLinked ? 'opacity-50' : ''}`}>
                                                              <input type="number" disabled={isLinked || !isActive} value={(isLinked ? opt.deliveryPrice : city.deliveryPrice) ?? ''} onChange={(e) => updateCityField(opt.id, city.id, 'deliveryPrice', Number(e.target.value))} className="w-full px-1 py-1 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-bold outline-none focus:border-indigo-500 disabled:bg-transparent" />
                                                          </div>
                                                          {showExchange && <div className={`${isLinked ? 'opacity-50' : ''}`}>
                                                              <input type="number" disabled={isLinked || !isActive} value={(isLinked ? opt.exchangePrice : city.exchangePrice) ?? ''} onChange={(e) => updateCityField(opt.id, city.id, 'exchangePrice', Number(e.target.value))} className="w-full px-1 py-1 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-bold outline-none focus:border-indigo-500 disabled:bg-transparent" />
                                                          </div>}
                                                          {showReturn && <div className={`${isLinked ? 'opacity-50' : ''}`}>
                                                              <input type="number" disabled={isLinked || !isActive} value={(isLinked ? opt.returnPrice : city.returnPrice) ?? ''} onChange={(e) => updateCityField(opt.id, city.id, 'returnPrice', Number(e.target.value))} className="w-full px-1 py-1 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-bold outline-none focus:border-indigo-500 disabled:bg-transparent" />
                                                          </div>}
                                                          {showCashCollection && <div className={`${isLinked ? 'opacity-50' : ''}`}>
                                                              <input type="number" disabled={isLinked || !isActive} value={(isLinked ? opt.cashCollectionPrice : city.cashCollectionPrice) ?? ''} onChange={(e) => updateCityField(opt.id, city.id, 'cashCollectionPrice', Number(e.target.value))} className="w-full px-1 py-1 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-bold outline-none focus:border-indigo-500 disabled:bg-transparent" />
                                                          </div>}
                                                          {showReturnToSender && <div className={`${isLinked ? 'opacity-50' : ''}`}>
                                                              <input type="number" disabled={isLinked || !isActive} value={(isLinked ? opt.returnToSenderPrice : city.returnToSenderPrice) ?? ''} onChange={(e) => updateCityField(opt.id, city.id, 'returnToSenderPrice', Number(e.target.value))} className="w-full px-1 py-1 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-bold outline-none focus:border-indigo-500 disabled:bg-transparent" />
                                                          </div>}
                                                          <div className={`${isLinked ? 'opacity-50' : ''}`}>
                                                              <input type="number" disabled={isLinked || !isActive} value={(isLinked ? opt.extraKgPrice : city.extraKgPrice) ?? ''} onChange={(e) => updateCityField(opt.id, city.id, 'extraKgPrice', Number(e.target.value))} className="w-full px-1 py-1 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-bold outline-none focus:border-indigo-500 disabled:bg-transparent" />
                                                          </div>
                                                      <div>
                                                          <button onClick={() => toggleCityStatus(opt.id, city.id)} className={`p-1.5 rounded transition-colors ${isActive ? 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`} title={isActive ? "إلغاء تفعيل المدينة" : "إعادة تفعيل المدينة"}>
                                                              {isActive ? <XCircle size={16}/> : <RefreshCcw size={16}/>}
                                                          </button>
                                                      </div>
                                                  </div>
                                              )})
                                          ) : (
                                              <p className="text-xs text-slate-400 italic text-center py-2">لا توجد مدن مضافة لهذه المنطقة.</p>
                                          )}
                                      </div>

                                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                                          <div className="grid gap-2 items-center" style={{ gridTemplateColumns: gridTemplate }}>
                                              <input 
                                                  type="text" 
                                                  placeholder="اسم مدينة جديدة" 
                                                  className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                                                  value={newCityName}
                                                  onChange={(e) => setNewCityName(e.target.value)}
                                              />
                                              <button 
                                                  type="button"
                                                  onClick={() => setNewCityUseParent(!newCityUseParent)}
                                                  className={`flex items-center justify-center p-1.5 rounded-lg transition-all ${newCityUseParent ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}
                                                  title={newCityUseParent ? 'مرتبط بأسعار المنطقة' : 'تخصيص الأسعار يدوياً'}
                                              >
                                                  {newCityUseParent ? <LinkIcon size={14} /> : <Unlock size={14} />}
                                              </button>
                                              
                                              <input type="number" disabled={newCityUseParent} placeholder="توصيل" className="w-full px-1 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] text-center outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800" value={newCityDelivery} onChange={(e) => setNewCityDelivery(e.target.value)} />
                                              {showExchange && <input type="number" disabled={newCityUseParent} placeholder="تبديل" className="w-full px-1 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] text-center outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800" value={newCityExchange} onChange={(e) => setNewCityExchange(e.target.value)} />}
                                              {showReturn && <input type="number" disabled={newCityUseParent} placeholder="إرجاع" className="w-full px-1 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] text-center outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800" value={newCityReturn} onChange={(e) => setNewCityReturn(e.target.value)} />}
                                              {showCashCollection && <input type="number" disabled={newCityUseParent} placeholder="تحصيل" className="w-full px-1 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] text-center outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800" value={newCityCashCollection} onChange={(e) => setNewCityCashCollection(e.target.value)} />}
                                              {showReturnToSender && <input type="number" disabled={newCityUseParent} placeholder="إرجاع لك" className="w-full px-1 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] text-center outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800" value={newCityReturnToSender} onChange={(e) => setNewCityReturnToSender(e.target.value)} />}
                                              <input type="number" disabled={newCityUseParent} placeholder="ز.كجم" className="w-full px-1 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] text-center outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800" value={newCityExtraKg} onChange={(e) => setNewCityExtraKg(e.target.value)} />
                                              
                                              <button 
                                                  onClick={() => addCity(opt.id)} 
                                                  disabled={!newCityName || (!newCityUseParent && !newCityDelivery)}
                                                  className="flex items-center justify-center p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                                  title="إضافة"
                                              >
                                                  <Plus size={16}/>
                                              </button>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          </td>
                      </tr>
                  )}
              </React.Fragment>
            )})}
          </tbody>
        </table>
      </div>
      {confirmDelete && <DeleteConfirmModal title="حذف المنطقة؟" desc="هل أنت متأكد من حذف هذه المنطقة؟" onConfirm={removeShippingOption} onCancel={() => setConfirmDelete(null)} />}
      {managingZone && <CityManagerModal isOpen={!!managingZoneId} onClose={() => setManagingZoneId(null)} zone={managingZone} onSave={handleUpdateZoneCities} />}
    </SectionCard>
  );
};
const CompanyFinancialsEditor: React.FC<any> = ({ companyName, settings, setSettings }) => {
    const companyFees = settings?.companySpecificFees?.[companyName] || { useCustomFees: false };
    const handleCompanyFeeChange = (field: keyof CompanyFees, value: any) => { setSettings((prev: Settings) => ({ ...prev, companySpecificFees: { ...prev.companySpecificFees, [companyName]: { ...prev.companySpecificFees[companyName], [field]: value } } })); };
    return (
        <SectionCard title={`الإعدادات المالية لـ ${companyName}`} icon={<Wallet size={22} />}>
            <div className="space-y-6">
                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
                    <div>
                        <span className="text-sm font-bold text-emerald-800 dark:text-emerald-400">تفعيل إعدادات مالية خاصة</span>
                        <p className="text-xs text-emerald-600 dark:text-emerald-500 font-medium">تجاهل القيم العامة واستخدام قيم مخصصة لهذه الشركة.</p>
                    </div>
                    <ToggleButton active={companyFees.useCustomFees} onToggle={() => handleCompanyFeeChange('useCustomFees', !companyFees.useCustomFees)} variant="emerald" />
                </div>
                <div className={`space-y-6 ${!companyFees.useCustomFees && 'opacity-40 pointer-events-none grayscale'}`}>
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4"> {/* تم تعديل الشبكة لتكون 4 أعمدة */}
                        <div className="space-y-1.5"><label className="text-xs font-bold text-slate-500 dark:text-slate-500">التأمين %</label><input type="number" value={companyFees.insuranceFeePercent || 0} onChange={(e) => handleCompanyFeeChange('insuranceFeePercent', Number(e.target.value))} className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold" /></div>
                        
                        {/* الإضافة الجديدة: خانة الوزن الافتراضي */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-indigo-600 dark:text-indigo-400">الوزن الافتراضي (كجم)</label>
                            <input 
                                type="number" 
                                value={companyFees.baseWeight ?? 5} 
                                onChange={(e) => handleCompanyFeeChange('baseWeight', Number(e.target.value))} 
                                className="w-full p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl font-bold text-indigo-700 dark:text-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" 
                                placeholder="مثلاً 5" 
                            />
                        </div>

                        <div className="space-y-1.5"><label className="text-xs font-bold text-slate-500 dark:text-slate-500">المعاينة ج.م</label><input type="number" value={companyFees.inspectionFee || 0} onChange={(e) => handleCompanyFeeChange('inspectionFee', Number(e.target.value))} className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold" /></div>
                        <div className="space-y-1.5"><label className="text-xs font-bold text-slate-500 dark:text-slate-500">مرتجع ثابت ج.م</label><input type="number" value={companyFees.returnShippingFee || 0} onChange={(e) => handleCompanyFeeChange('returnShippingFee', Number(e.target.value))} className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold" /></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        {/* طريقة احتساب التأمين */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">أساس احتساب رسوم التأمين</label>
                            <select 
                                value={companyFees.insuranceBasis ?? (isBosta(companyName) ? 'cost' : 'total')} 
                                onChange={(e) => handleCompanyFeeChange('insuranceBasis', e.target.value as any)} 
                                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold dark:text-white"
                            >
                                <option value="total">سعر المنتج + مصاريف الشحن (الإجمالي)</option>
                                <option value="cost">سعر شراء/تكلفة المنتج الفعلي</option>
                                <option value="price">سعر بيع المنتج الأصلي فقط</option>
                                <option value="base">السعر الأساسي للمنتج</option>
                            </select>
                        </div>
                        
                        {/* ضريبة القيمة المضافة لشركة الشحن */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">ضريبة القيمة المضافة لشركة الشحن (%)</label>
                            <input 
                                type="number" 
                                step="1" 
                                value={companyFees.shippingVatRate !== undefined ? Math.round(companyFees.shippingVatRate * 100) : (isBosta(companyName) ? 14 : 0)} 
                                onChange={(e) => handleCompanyFeeChange('shippingVatRate', Number(e.target.value) / 100)} 
                                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold dark:text-white" 
                                placeholder="مثلاً 14 لـ 14%" 
                            />
                        </div>
                    </div>
                     <div className="bg-amber-50 dark:bg-amber-950/20 p-5 rounded-xl border border-amber-200 dark:border-amber-900/40 space-y-4">
                        <div className="flex justify-between items-center"><span className="text-sm font-bold text-amber-900 dark:text-amber-300">رسوم COD</span><ToggleButton active={companyFees.enableCodFees} onToggle={() => handleCompanyFeeChange('enableCodFees', !companyFees.enableCodFees)} variant="amber" /></div>
                        <div className={`grid grid-cols-3 gap-3 ${!companyFees.enableCodFees && 'opacity-40 grayscale pointer-events-none'}`}>
                            <CodInput label="حد المجاني" value={companyFees.codThreshold || 0} onChange={(val) => handleCompanyFeeChange('codThreshold', val)} />
                            <CodInput label="النسبة %" value={companyFees.codFeeRate || 0} step="0.01" onChange={(val) => handleCompanyFeeChange('codFeeRate', val)} />
                            <CodInput label="الضريبة %" value={companyFees.codTaxRate || 0} step="0.1" onChange={(val) => handleCompanyFeeChange('codTaxRate', val)} />
                        </div>
                    </div>
                     <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
                        <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4">سياسات التسعير المتقدمة</h4>
                        <div className="space-y-4">
                            <PolicyToggle 
                                label="تفعيل تسعير الاستبدال" 
                                description="يضيف عمود 'تبديل' في جدول تسعير المناطق ويفعل خيار الاستبدال في الطلبات."
                                active={companyFees.enableExchange !== false} onToggle={() => handleCompanyFeeChange('enableExchange', companyFees.enableExchange === false ? true : false)} />
                            <PolicyToggle 
                                label="تفعيل تسعير الإرجاع" 
                                description="يضيف عمود 'إرجاع' في جدول تسعير المناطق."
                                active={companyFees.enableReturn !== false} onToggle={() => handleCompanyFeeChange('enableReturn', companyFees.enableReturn === false ? true : false)} />
                            <PolicyToggle 
                                label="تفعيل تسعير التحصيل" 
                                description="يضيف عمود 'تحصيل' في جدول تسعير المناطق."
                                active={companyFees.enableCashCollection !== false} onToggle={() => handleCompanyFeeChange('enableCashCollection', companyFees.enableCashCollection === false ? true : false)} />
                            <PolicyToggle 
                                label="تفعيل تسعير إرجاع لك" 
                                description="يضيف عمود 'إرجاع لك' في جدول تسعير المناطق."
                                active={companyFees.enableReturnToSender !== false} onToggle={() => handleCompanyFeeChange('enableReturnToSender', companyFees.enableReturnToSender === false ? true : false)} />
                            <PolicyToggle 
                                label="تطبيق رسوم مرتجع ثابتة" 
                                description="يخصم مبلغ 'مرتجع ثابت' من المحفظة كخسارة إضافية عند إرجاع أي طلب."
                                active={companyFees.enableFixedReturn} 
                                onToggle={() => handleCompanyFeeChange('enableFixedReturn', !companyFees.enableFixedReturn)} />
                            <PolicyToggle 
                                label="تفعيل خدمة فليكس شيب (Flex Ship)" 
                                description="عند تفعيل خدمة فليكس شيب، يُطلب من المستلم دفع رسوم خدمة إضافية إذا رفض استلام الشحنة."
                                active={companyFees.enableFlexShip || false} 
                                onToggle={() => handleCompanyFeeChange('enableFlexShip', !companyFees.enableFlexShip)} />
                            {companyFees.enableFlexShip && (
                                <div className="mr-6 space-y-1.5 p-3 bg-violet-50 dark:bg-violet-950/20 rounded-xl border border-violet-100 dark:border-violet-900/30 animate-in slide-in-from-top-2 duration-200">
                                    <label className="text-xs font-bold text-violet-800 dark:text-violet-400">رسوم خدمة فليكس شيب الإضافية عند رفض الاستلام (ج.م)</label>
                                    <input 
                                        type="number" 
                                        value={companyFees.flexShipFee || 0} 
                                        onChange={(e) => handleCompanyFeeChange('flexShipFee', Number(e.target.value))} 
                                        className="w-full max-w-xs p-3 bg-white dark:bg-slate-800 border border-violet-200 dark:border-violet-850 rounded-xl font-bold text-slate-850 dark:text-white" 
                                        placeholder="مثلاً 50"
                                    />
                                </div>
                            )}
                        </div>
                     </div>
                </div>
            </div>
        </SectionCard>
    );
};
const FinancialCard: React.FC<any> = ({ label, name, value, isActive, onToggle, onChange, icon, desc }) => ( <div className={`p-5 rounded-2xl border transition-all ${isActive ? 'bg-white dark:bg-slate-800/30 border-slate-300 dark:border-slate-700' : 'bg-slate-100 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-60'}`}> <div className="flex items-center justify-between mb-4"> <label className="text-sm font-black text-slate-800 dark:text-slate-300 flex items-center gap-2">{icon} {label}</label> <ToggleButton active={isActive} onToggle={onToggle} /> </div> <div className="relative"> <input type="number" name={name} disabled={!isActive} className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed font-black dark:text-white shadow-inner transition-all" value={value} onChange={onChange} /> </div> <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-3 leading-relaxed font-bold">{desc}</p> </div> );
const CodInput: React.FC<any> = ({ label, value, onChange, step = "1" }) => ( <div className="space-y-1"> <label className="text-[10px] font-black text-amber-700 dark:text-amber-500 uppercase tracking-tight">{label}</label> <input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full px-2 py-2.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-900/60 rounded-xl text-sm outline-none font-black dark:text-white" /> </div> );

export default ShippingPage;
