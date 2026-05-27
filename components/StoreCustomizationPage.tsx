
import React, { useState, useMemo, useEffect } from 'react';
// FIX: Updating react-router-dom import to be compatible with v5.
import { Link } from 'react-router-dom';
import { Settings, StoreCustomization, Store, StoreSection, Banner } from '../types';
import { Brush, Save, Image, Type, Info, CheckCircle, Eye, Palette, LayoutDashboard, CaseSensitive, Megaphone, Share2, Link as LinkIcon, LayoutTemplate, GripVertical, ChevronsUpDown, X, Star, Plus, Trash2, Edit3 } from 'lucide-react';
import StorefrontPage from './StorefrontPage';

interface StoreCustomizationPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  activeStore: Store | undefined;
}

type SectionKey = 'identity' | 'layout' | 'colorsAndFonts' | 'content';

const sidebarItems: { key: SectionKey; label: string; icon: React.ReactElement }[] = [
    { key: 'identity', label: 'الهوية البصرية', icon: <Star size={20} /> },
    { key: 'layout', label: 'التخطيط والبانرات', icon: <LayoutDashboard size={20} /> },
    { key: 'colorsAndFonts', label: 'الألوان والخطوط', icon: <Brush size={20} /> },
    { key: 'content', label: 'المحتوى والروابط', icon: <Type size={20} /> },
];

const CustomizationSidebar: React.FC<{ activeSection: SectionKey; setActiveSection: (key: SectionKey) => void; }> = ({ activeSection, setActiveSection }) => (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
        {sidebarItems.map(item => (
            <button
                key={item.key}
                type="button"
                onClick={() => setActiveSection(item.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-colors text-right ${
                    activeSection === item.key
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
            >
                {item.icon}
                {item.label}
            </button>
        ))}
    </div>
);

const StoreCustomizationPage: React.FC<StoreCustomizationPageProps> = ({ settings, setSettings, activeStore }) => {
  const [activeSection, setActiveSection] = useState<SectionKey>('identity');
  
  const setCustomization = (updater: React.SetStateAction<StoreCustomization>) => {
    setSettings(prev => ({
        ...prev,
        customization: typeof updater === 'function' ? updater(prev.customization) : updater
    }));
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'identity': return <IdentitySection customization={settings.customization} setCustomization={setCustomization} />;
      case 'layout': return <LayoutSection customization={settings.customization} setCustomization={setCustomization} />;
      case 'colorsAndFonts': return <ColorsAndFontsSection customization={settings.customization} setCustomization={setCustomization} />;
      case 'content': return <ContentSection customization={settings.customization} setCustomization={setCustomization} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3"><Brush className="text-indigo-500" /> تخصيص واجهة المتجر</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">تحكم في شكل ومظهر متجرك الإلكتروني ليناسب علامتك التجارية.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/store" className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95"><Eye size={18} /> معاينة المتجر</Link>
        </div>
      </div>

       <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        <div className="space-y-6">
          <CustomizationSidebar activeSection={activeSection} setActiveSection={setActiveSection} />
          {renderSection()}
        </div>
        <div className="xl:sticky xl:top-28">
           <div className="w-full h-[700px] bg-slate-200 dark:bg-slate-800 rounded-2xl p-2 border border-slate-300 dark:border-slate-700 shadow-lg">
             <div className="w-full h-full bg-white dark:bg-slate-950 rounded-xl overflow-hidden">
                <div className="w-full h-full overflow-y-auto no-scrollbar">
                    <StorefrontPage
                        settings={settings}
                        activeStore={activeStore}
                        cart={[]}
                        onAddToCart={() => {}}
                        onUpdateCartQuantity={() => {}}
                        onRemoveFromCart={() => {}}
                        setSettings={() => {}}
                    />
                </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

// ... (Rest of the file remains the same)

interface SectionComponentProps {
    customization: StoreCustomization;
    setCustomization: React.Dispatch<React.SetStateAction<StoreCustomization>>;
}

const IdentitySection: React.FC<SectionComponentProps> = ({ customization, setCustomization }) => {
    const update = (field: keyof StoreCustomization, value: any) => setCustomization(p => ({...p, [field]: value}));

    return (
        <div className="space-y-6">
            <CustomizationSection title="الشعار والأيقونة">
                <div className="grid grid-cols-2 gap-4">
                    <ImageControl label="شعار المتجر" value={customization.logoUrl} onSave={(val) => update('logoUrl', val)} />
                    <ImageControl label="أيقونة المتجر" value={customization.faviconUrl} onSave={(val) => update('faviconUrl', val)} />
                </div>
            </CustomizationSection>
             <CustomizationSection title="ستايل العناصر">
                <RadioGroup
                    label="نمط بطاقة المنتج"
                    value={customization.cardStyle}
                    onChange={(val) => update('cardStyle', val)}
                    options={[
                        { value: 'default', label: 'افتراضي' },
                        { value: 'elevated', label: 'بارز (ظل)' },
                        { value: 'outlined', label: 'مُحدد (إطار)' },
                    ]}
                />
                <RadioGroup
                    label="استدارة حواف الأزرار"
                    value={customization.buttonBorderRadius}
                    onChange={(val) => update('buttonBorderRadius', val)}
                    options={[
                        { value: 'rounded-none', label: 'حادة' },
                        { value: 'rounded-md', label: 'قليلة' },
                        { value: 'rounded-lg', label: 'متوسطة' },
                        { value: 'rounded-full', label: 'دائرية' },
                    ]}
                />
            </CustomizationSection>
        </div>
    );
};

const LayoutSection: React.FC<SectionComponentProps> = ({ customization, setCustomization }) => {
    const update = (field: keyof StoreCustomization, value: any) => setCustomization(p => ({...p, [field]: value}));
    
    return (
        <div className="space-y-6">
            <CustomizationSection title="البانرات الإعلانية (السلايدر)">
                <BannersEditor banners={customization.banners || []} onBannersChange={(val) => update('banners', val)} />
            </CustomizationSection>
            <CustomizationSection title="تخطيط شبكة المنتجات">
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-400 mb-2">عدد الأعمدة (شاشة كبيرة)</label>
                    <input type="range" min="2" max="5" value={customization.productColumnsDesktop} onChange={(e) => update('productColumnsDesktop', Number(e.target.value))} className="w-full" />
                    <div className="flex justify-between text-xs font-bold text-slate-500 px-1">
                        <span>2</span><span>3</span><span>4</span><span>5</span>
                    </div>
                </div>
            </CustomizationSection>
        </div>
    );
};

const ColorsAndFontsSection: React.FC<SectionComponentProps> = ({ customization, setCustomization }) => {
    const update = (field: keyof StoreCustomization, value: any) => setCustomization(p => ({...p, [field]: value}));
    const palettes = [ { name: 'افتراضي', primary: '#4f46e5', bg: '#f8fafc', text: '#0f172a' }, { name: 'زمردي', primary: '#059669', bg: '#f0fdf4', text: '#064e3b' }, { name: 'وردي', primary: '#db2777', bg: '#fdf2f8', text: '#500724' }, { name: 'رمادي', primary: '#475569', bg: '#f8fafc', text: '#1e293b' }, ];
    
    const applyPalette = (p: typeof palettes[0]) => {
        setCustomization(c => ({...c, primaryColor: p.primary, backgroundColor: p.bg, textColor: p.text}));
    };

    return (
        <div className="space-y-6">
            <CustomizationSection title="لوحة الألوان">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ColorPicker label="اللون الأساسي" color={customization.primaryColor} onChange={(c) => update('primaryColor', c)} />
                    <ColorPicker label="لون الخلفية" color={customization.backgroundColor} onChange={(c) => update('backgroundColor', c)} />
                    <ColorPicker label="لون النص" color={customization.textColor} onChange={(c) => update('textColor', c)} />
                </div>
                <div className="space-y-2 pt-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-400">لوحات جاهزة</label>
                    <div className="flex items-center gap-2">{palettes.map(p => <button key={p.name} type="button" onClick={() => applyPalette(p)} className="flex-1 p-2 rounded-lg border-2 hover:border-indigo-400" style={{backgroundColor: p.bg}} title={p.name}><div className="w-full h-8 rounded" style={{backgroundColor: p.primary}}></div></button>)}</div>
                </div>
            </CustomizationSection>
            <CustomizationSection title="الخطوط">
                <SelectControl label="نوع الخط" value={customization.fontFamily} onChange={(v) => update('fontFamily', v)} options={[ { value: 'Cairo', label: 'Cairo' }, { value: 'Readex Pro', label: 'Readex Pro' }, { value: 'Tajawal', label: 'Tajawal' }]} />
                <RadioGroup label="وزن خط العناوين" value={customization.headingFontWeight} onChange={(v) => update('headingFontWeight', v)} options={[ { value: 'font-bold', label: 'عريض' }, { value: 'font-black', label: 'أسود عريض' } ]}/>
                <RadioGroup label="حجم الخط الأساسي" value={customization.bodyFontSize} onChange={(v) => update('bodyFontSize', v)} options={[ { value: 'text-sm', label: 'صغير' }, { value: 'text-base', label: 'متوسط' }, { value: 'text-lg', label: 'كبير' } ]}/>
            </CustomizationSection>
        </div>
    );
};

const ContentSection: React.FC<SectionComponentProps> = ({ customization, setCustomization }) => {
    const update = (field: keyof StoreCustomization, value: any) => setCustomization(p => ({...p, [field]: value}));
    const updateSocial = (platform: keyof StoreCustomization['socialLinks'], value: string) => {
        setCustomization(p => ({ ...p, socialLinks: { ...p.socialLinks, [platform]: value } }));
    };

    return (
        <div className="space-y-6">
            <CustomizationSection title="شريط التنبيهات">
                <ToggleControl label="تفعيل شريط التنبيهات" checked={customization.isAnnouncementBarVisible} onChange={(val) => update('isAnnouncementBarVisible', val)} />
                <div className={`transition-opacity ${customization.isAnnouncementBarVisible ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                     <FormInput name="announcementBarText" label="نص الشريط" value={customization.announcementBarText} onChange={(e) => update('announcementBarText', e.target.value)} icon={<Megaphone/>} />
                </div>
            </CustomizationSection>
             <CustomizationSection title="الشبكات الاجتماعية والفوتر">
                 <FormInput name="facebook" label="فيسبوك" value={customization.socialLinks.facebook} onChange={e => updateSocial('facebook', e.target.value)} icon={<LinkIcon />} placeholder="https://facebook.com/yourpage" />
                 <FormInput name="instagram" label="انستجرام" value={customization.socialLinks.instagram} onChange={e => updateSocial('instagram', e.target.value)} icon={<LinkIcon />} placeholder="https://instagram.com/yourprofile" />
                 <FormInput name="x" label="X (تويتر سابقاً)" value={customization.socialLinks.x} onChange={e => updateSocial('x', e.target.value)} icon={<LinkIcon />} placeholder="https://x.com/yourhandle" />
                 <FormInput name="tiktok" label="تيك توك" value={customization.socialLinks.tiktok} onChange={e => updateSocial('tiktok', e.target.value)} icon={<LinkIcon />} placeholder="https://tiktok.com/@yourusername" />
                 <div className="border-t border-slate-200 dark:border-slate-800 my-4"></div>
                 <FormInput name="footerText" label="نص الحقوق في الفوتر" value={customization.footerText} onChange={(e) => update('footerText', e.target.value)} icon={<Type />} placeholder="© 2024 جميع الحقوق محفوظة" />
            </CustomizationSection>
        </div>
    );
};

// ... (Other controls)

const CustomizationSection: React.FC<{ title: string; children: React.ReactNode; }> = ({ title, children }) => (<div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"><h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">{title}</h2><div className="space-y-6">{children}</div></div>);
interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> { label: string; icon: React.ReactElement; }
const FormInput: React.FC<FormInputProps> = ({ label, icon, ...props }) => (<div><label htmlFor={props.id || props.name} className="block text-sm font-bold text-slate-700 dark:text-slate-400 mb-2 flex items-center gap-2">{icon} {label}</label><input {...props} id={props.id || props.name} className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-700 transition-all dark:text-white" /></div>);
const RadioGroup: React.FC<{ label: string; value: string; options: {value: string; label: string}[]; onChange: (value: string) => void;}> = ({label, value, options, onChange}) => (<div><label className="block text-sm font-bold text-slate-700 dark:text-slate-400 mb-2">{label}</label><div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl">{options.map(opt => <button type="button" key={opt.value} onClick={() => onChange(opt.value)} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${value === opt.value ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-500 hover:bg-white/50 dark:hover:bg-slate-700/50'}`}>{opt.label}</button>)}</div></div>);
const SelectControl: React.FC<{ label: string; value: string; options: {value: string; label: string}[]; onChange: (value: string) => void;}> = ({label, value, options, onChange}) => (<div><label className="block text-sm font-bold text-slate-700 dark:text-slate-400 mb-2">{label}</label><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500">{options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>);
const ColorPicker: React.FC<{ label: string; color: string; onChange: (color: string) => void;}> = ({label, color, onChange}) => (<div><label className="block text-sm font-bold text-slate-700 dark:text-slate-400 mb-2">{label}</label><div className="flex items-center gap-2"><input type="color" value={color} onChange={(e) => onChange(e.target.value)} className="w-12 h-12 p-0 border-none rounded-lg cursor-pointer bg-transparent" /><input type="text" value={color} onChange={(e) => onChange(e.target.value)} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm"/></div></div>);
const ToggleControl: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void;}> = ({label, checked, onChange}) => (<div className="flex items-center justify-between"><label className="text-sm font-bold text-slate-700 dark:text-slate-300">{label}</label><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500" /></div>);

const BannersEditor: React.FC<{ banners: Banner[], onBannersChange: (banners: Banner[]) => void }> = ({ banners, onBannersChange }) => {
    const [editingBanner, setEditingBanner] = useState<Partial<Banner> | null>(null);

    const handleSave = () => {
        if (!editingBanner?.imageUrl) return;
        const newBanner: Banner = { ...editingBanner as Banner, id: editingBanner.id || Date.now().toString() };
        if (editingBanner.id) {
            onBannersChange(banners.map(b => b.id === newBanner.id ? newBanner : b));
        } else {
            onBannersChange([...banners, newBanner]);
        }
        setEditingBanner(null);
    };

    return (
        <div className="space-y-4">
            {banners.map(banner => (
                <div key={banner.id} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src={banner.imageUrl} className="w-16 h-10 rounded object-cover bg-slate-200"/>
                        <div>
                            <p className="font-bold text-sm text-slate-800 dark:text-white">{banner.title}</p>
                            <p className="text-xs text-slate-500">{banner.subtitle}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setEditingBanner(banner)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"><Edit3 size={16}/></button>
                        <button type="button" onClick={() => onBannersChange(banners.filter(b => b.id !== banner.id))} className="p-2 text-red-600 hover:bg-red-100 rounded-lg"><Trash2 size={16}/></button>
                    </div>
                </div>
            ))}
            <button type="button" onClick={() => setEditingBanner({})} className="w-full border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg py-3 text-slate-500 font-bold flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <Plus size={16}/> إضافة بانر جديد
            </button>

            {editingBanner && (
                 <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl w-full max-w-lg text-right space-y-4">
                        <h3 className="font-bold text-lg mb-4">{editingBanner.id ? 'تعديل البانر' : 'بانر جديد'}</h3>
                        <FormInput label="رابط الصورة" icon={<Image/>} value={editingBanner.imageUrl || ''} onChange={e => setEditingBanner(p => ({...p, imageUrl: e.target.value}))}/>
                        <FormInput label="العنوان الرئيسي" icon={<Type/>} value={editingBanner.title || ''} onChange={e => setEditingBanner(p => ({...p, title: e.target.value}))}/>
                        <FormInput label="العنوان الفرعي" icon={<Type/>} value={editingBanner.subtitle || ''} onChange={e => setEditingBanner(p => ({...p, subtitle: e.target.value}))}/>
                        <FormInput label="نص الزر" icon={<Type/>} value={editingBanner.buttonText || ''} onChange={e => setEditingBanner(p => ({...p, buttonText: e.target.value}))}/>
                        <FormInput label="الرابط" icon={<LinkIcon/>} value={editingBanner.link || ''} onChange={e => setEditingBanner(p => ({...p, link: e.target.value}))}/>
                        <div className="flex gap-2 justify-end pt-2">
                            <button type="button" onClick={() => setEditingBanner(null)} className="px-4 py-2 rounded font-bold">إلغاء</button>
                            <button type="button" onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded font-bold">حفظ</button>
                        </div>
                    </div>
                 </div>
            )}
        </div>
    );
};


const ImageControl: React.FC<{label: string, value: string, onSave: (value: string) => void}> = ({label, value, onSave}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [url, setUrl] = useState(value);
    const handleSave = () => { onSave(url); setIsModalOpen(false); };
    return (
        <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-400 mb-2">{label}</label>
            <div className="w-full aspect-video bg-slate-50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center p-2">
                {value ? <img src={value} alt={label} className="max-w-full max-h-full object-contain rounded-md" /> : <span className="text-slate-400 text-sm">لا توجد صورة</span>}
            </div>
            <button type="button" onClick={() => { setUrl(value); setIsModalOpen(true); }} className="w-full mt-2 text-center text-sm font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/50 py-2 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900">تغيير الصورة</button>
            {isModalOpen && <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"><div className="bg-white dark:bg-slate-900 p-6 rounded-xl w-full max-w-md text-right"><h3 className="font-bold text-lg mb-4">تغيير {label}</h3><input type="text" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full p-2 border rounded mb-4 dark:bg-slate-800 dark:border-slate-700" placeholder="https://.../image.png" /><div className="flex gap-2 justify-end"><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded font-bold">إلغاء</button><button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded font-bold">حفظ</button></div></div></div>}
        </div>
    );
};


export default StoreCustomizationPage;