import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, LayoutDashboard, ShoppingCart, Plus, Monitor, Package, 
  Users, Truck, Wallet, FileText, Settings, Sparkles, MessageSquare, 
  BarChart2, Landmark, Wrench, Shield, ArrowRight, X, Command
} from 'lucide-react';
import { Store } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  activeStore?: Store;
}

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  category: 'صفحات النظام' | 'إجراءات سريعة' | 'المالية والمخزون' | 'الذكاء الاصطناعي والتسويق';
  icon: React.ReactNode;
  path?: string;
  action?: () => void;
  badge?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, activeStore }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const storePrefix = activeStore ? `/store/${activeStore.id}` : '';

  const commandItems: CommandItem[] = [
    // إجـراءات سـريـعة
    {
      id: 'create-order',
      title: 'إنشاء طلب أوردر جديد',
      description: 'إضافة طلبيات عميل جديدة وبدء المعالجة الشاملة',
      category: 'إجراءات سريعة',
      icon: <Plus className="text-emerald-500" size={18} />,
      path: `${storePrefix}/create-order`,
      badge: 'جديد'
    },
    {
      id: 'pos-cashier',
      title: 'فتح كاشير نقطة البيع (POS)',
      description: 'واجهة البيع الفوري السريع وإصدار الفواتير المباشرة',
      category: 'إجراءات سريعة',
      icon: <Monitor className="text-indigo-500" size={18} />,
      path: `${storePrefix}/pos`,
      badge: 'فوري ⚡'
    },
    {
      id: 'add-product',
      title: 'إضافة منتج جديد للمخزن',
      description: 'إدخال أصناف ومتغيرات منتجات للمنظومة',
      category: 'إجراءات سريعة',
      icon: <Package className="text-amber-500" size={18} />,
      path: `${storePrefix}/products`,
    },

    // صـفحـات النـظـام
    {
      id: 'dashboard',
      title: 'لوحة التحكم الرئيسية',
      description: 'مؤشرات الأداء العامة، الإحصائيات، ومتابعة المبيعات',
      category: 'صفحات النظام',
      icon: <LayoutDashboard className="text-indigo-500" size={18} />,
      path: `${storePrefix}/dashboard`,
    },
    {
      id: 'orders-list',
      title: 'سجل الطلبيات والمبيعات',
      description: 'عرض جميع الطلبات، الفلاتر، وتتبع الشحنات',
      category: 'صفحات النظام',
      icon: <ShoppingCart className="text-cyan-500" size={18} />,
      path: `${storePrefix}/orders`,
    },
    {
      id: 'products-page',
      title: 'إدارة المخزون والمنتجات',
      description: 'المنتجات، المجموعات، خيارات الأصناف والتجريف',
      category: 'صفحات النظام',
      icon: <Package className="text-amber-500" size={18} />,
      path: `${storePrefix}/products`,
    },
    {
      id: 'customers-page',
      title: 'قاعدة بيانات العملاء CRM',
      description: 'سجل العملاء، التحليلات، وإرشادات الشراء',
      category: 'صفحات النظام',
      icon: <Users className="text-purple-500" size={18} />,
      path: `${storePrefix}/customers`,
    },
    {
      id: 'shipping-page',
      title: 'قنوات وشركات الشحن',
      description: 'إعدادات بوسطة، الشركات اللوجستية، وحساب التكاليف',
      category: 'صفحات النظام',
      icon: <Truck className="text-blue-500" size={18} />,
      path: `${storePrefix}/shipping`,
    },
    {
      id: 'reports-page',
      title: 'التحليلات التقارير الذكية',
      description: 'رسوم بيانية لمؤشرات النمو، الأداء المالي والربحية',
      category: 'صفحات النظام',
      icon: <BarChart2 className="text-teal-500" size={18} />,
      path: `${storePrefix}/reports`,
    },
    {
      id: 'maintenance-page',
      title: 'مركز عمليات الصيانة والدعم 🛠️',
      description: 'متابعة أجهزة وأوامر الشغل والتكاليف المباشرة',
      category: 'صفحات النظام',
      icon: <Wrench className="text-orange-500" size={18} />,
      path: `${storePrefix}/maintenance`,
      badge: 'جديد'
    },

    // الـمالـية والـمـخزون
    {
      id: 'treasury-page',
      title: 'الخزينة والسيولة المالية',
      description: 'صناديق الخزائن، الحسابات البنكية، والسيولة',
      category: 'المالية والمخزون',
      icon: <Landmark className="text-emerald-500" size={18} />,
      path: `${storePrefix}/treasury`,
    },
    {
      id: 'wallet-page',
      title: 'المحفظة الإلكترونية',
      description: 'رصيد العمولات، طلبات السحب، والشحن',
      category: 'المالية والمخزون',
      icon: <Wallet className="text-indigo-500" size={18} />,
      path: `${storePrefix}/wallet`,
    },

    // الـذكـاء الاصطنـاعي والـتسويق
    {
      id: 'ai-assistant',
      title: 'مستشار الذكاء الاصطناعي (AI)',
      description: 'توليد أفكار تسويقية، خطط النمو وتحليل المبيعات',
      category: 'الذكاء الاصطناعي والتسويق',
      icon: <Sparkles className="text-amber-400" size={18} />,
      path: `${storePrefix}/ai-assistant`,
      badge: 'Gemini AI ✨'
    },
    {
      id: 'whatsapp-marketing',
      title: 'حملات الرسائل والواتساب',
      description: 'التواصل المباشر مع العملاء وإرسال العروض',
      category: 'الذكاء الاصطناعي والتسويق',
      icon: <MessageSquare className="text-emerald-500" size={18} />,
      path: `${storePrefix}/whatsapp`,
    },
    {
      id: 'settings-page',
      title: 'إعدادات النظام العامة',
      description: 'تخصيص المتجر، بوابات الدفع، والموظفين',
      category: 'صفحات النظام',
      icon: <Settings className="text-slate-500" size={18} />,
      path: `${storePrefix}/settings`,
    },
  ];

  // Global key listener to toggle Command Palette (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open palette
          window.dispatchEvent(new CustomEvent('open-command-palette'));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filter command items based on query
  const filteredItems = commandItems.filter(item => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      item.category.toLowerCase().includes(q)
    );
  });

  const handleSelect = (item: CommandItem) => {
    onClose();
    if (item.action) {
      item.action();
    } else if (item.path) {
      navigate(item.path);
    }
  };

  const handleKeyDownInInput = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  // Group by category
  const categories = Array.from(new Set(filteredItems.map(item => item.category)));

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200" dir="rtl">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
      />

      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 font-sans flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
        
        {/* Search Header */}
        <div className="flex items-center px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
          <Search className="text-slate-400 ml-3 flex-shrink-0" size={20} />
          <input
            ref={inputRef}
            type="text"
            placeholder="ابحث عن صفحة، خدمة، أو إجراء سريع (مثال: طلب جديد، كاشير، الخزينة...)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDownInInput}
            className="w-full bg-transparent text-sm font-bold text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
            >
              <X size={16} />
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1 font-mono text-[10px] font-bold text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-2 py-1 rounded-md mr-2">
            <span>ESC</span>
          </div>
        </div>

        {/* Command Items List */}
        <div className="overflow-y-auto p-3 space-y-4 no-scrollbar flex-1">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm font-bold">
              لا توجد نتائج مطابقة لـ "{query}" 🔍
            </div>
          ) : (
            categories.map(category => {
              const categoryItems = filteredItems.filter(item => item.category === category);
              if (categoryItems.length === 0) return null;

              return (
                <div key={category} className="space-y-1">
                  <div className="px-3 py-1 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                    {category}
                  </div>
                  {categoryItems.map(item => {
                    const globalIdx = filteredItems.indexOf(item);
                    const isSelected = globalIdx === selectedIndex;

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={`flex items-center justify-between px-3.5 py-3 rounded-2xl cursor-pointer transition-all duration-150 ${
                          isSelected 
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 translate-x-[-2px]' 
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl flex-shrink-0 transition-colors ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800'
                          }`}>
                            {item.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black leading-snug">{item.title}</span>
                              {item.badge && (
                                <span className={`px-2 py-0.5 text-[9px] font-black rounded-full ${
                                  isSelected 
                                    ? 'bg-white/20 text-white' 
                                    : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                                }`}>
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className={`text-[10px] font-medium line-clamp-1 mt-0.5 ${
                                isSelected ? 'text-indigo-100' : 'text-slate-400'
                              }`}>
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-80">
                          <span className="text-[10px] font-bold">انتقال</span>
                          <ArrowRight size={14} className="rotate-180" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-bold px-5">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[9px]">↑↓</span> للتنقل
            </span>
            <span className="flex items-center gap-1">
              <span className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[9px]">ENTER</span> للاختيار
            </span>
          </div>
          <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-black">
            <Command size={12} />
            <span>منظومة عبدو ميديا السريعة</span>
          </div>
        </div>

      </div>
    </div>
  );
};
