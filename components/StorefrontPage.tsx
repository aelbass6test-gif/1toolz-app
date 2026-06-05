
import React, { useEffect, useMemo, useState } from 'react';
import { Settings, Store, Product, StoreCustomization, OrderItem, Review } from '../types';
import { ShoppingCart, Package, Search, Facebook, Instagram, Twitter, MessageCircle, ArrowDown, CheckCircle, Star, X, LayoutGrid, ChevronLeft, ChevronRight, ArrowRight, BrainCircuit, RefreshCw, Wand2 } from 'lucide-react';
import CartSidebar from './CartSidebar';
import { searchProductsWithAI } from '../services/geminiService';
import { SmartUpdatesWidget } from './SmartUpdatesWidget';

interface StorefrontPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  activeStore: Store | undefined;
  cart: OrderItem[];
  onAddToCart: (product: Product) => void;
  onUpdateCartQuantity: (productId: string, quantity: number) => void;
  onRemoveFromCart: (productId: string) => void;
}

const ReviewModal = ({ productId, onClose, onSubmit }: { productId: string, onClose: () => void, onSubmit: (review: Omit<Review, 'id' | 'status' | 'date'>) => void }) => {
    const [name, setName] = useState('');
    const [comment, setComment] = useState('');
    const [rating, setRating] = useState(5);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ productId, customerName: name, comment, rating });
        onClose();
        alert("شكراً لتقييمك! سيتم مراجعته قبل النشر.");
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 text-right animate-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg dark:text-white">أضف تقييمك</h3>
                    <button onClick={onClose}><X className="text-slate-400"/></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex justify-center gap-2 mb-4">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button key={star} type="button" onClick={() => setRating(star)} className="focus:outline-none transition-transform hover:scale-110">
                                <Star size={32} fill={star <= rating ? "#f59e0b" : "none"} className={star <= rating ? "text-amber-500" : "text-slate-300"} />
                            </button>
                        ))}
                    </div>
                    <input type="text" required placeholder="اسمك" className="w-full p-3 bg-slate-50 dark:bg-slate-800 border rounded-xl" value={name} onChange={e => setName(e.target.value)} />
                    <textarea required placeholder="اكتب رأيك هنا..." className="w-full p-3 bg-slate-50 dark:bg-slate-800 border rounded-xl h-24" value={comment} onChange={e => setComment(e.target.value)} />
                    <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold">إرسال التقييم</button>
                </form>
            </div>
        </div>
    );
};

const ProductCard: React.FC<{ product: Product, customization: StoreCustomization, onAddToCart: (product: Product) => void, onReview: (id: string) => void, reviews: Review[], onViewDetails: () => void }> = ({ product, customization, onAddToCart, onReview, reviews, onViewDetails }) => {
    const [isAdded, setIsAdded] = useState(false);
    
    const productReviews = reviews.filter(r => r.productId === product.id && r.status === 'approved');
    const averageRating = productReviews.length > 0 ? productReviews.reduce((acc, r) => acc + r.rating, 0) / productReviews.length : 0;

    const handleAddToCartClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onAddToCart(product);
        setIsAdded(true);
        setTimeout(() => setIsAdded(false), 2000);
    };

    const handleReviewClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onReview(product.id);
    };

    // Card alignment layout
    const isCenter = customization.cardInfoAlignment === 'center';
    const isLeft = customization.cardInfoAlignment === 'left';
    const alignmentClass = isCenter ? 'text-center items-center' : isLeft ? 'text-left items-start' : 'text-right items-end';

    // Shadow size mapping
    const shadowMap = {
        none: 'shadow-none',
        sm: 'shadow-sm',
        md: 'shadow-md',
        lg: 'shadow-lg',
        xl: 'shadow-xl'
    };
    const shadowClass = shadowMap[customization.cardShadowSize || 'sm'] || 'shadow-sm';

    // Hover effect mapping
    let hoverEffectClass = 'transition-all duration-300 ';
    const primary = customization.primaryColor || '#4f46e5';
    switch (customization.cardHoverEffect) {
        case 'scale':
            hoverEffectClass += 'hover:-translate-y-2 hover:scale-[1.03]';
            break;
        case 'glow':
            hoverEffectClass += `hover:-translate-y-1 hover:shadow-[0_10px_25px_${primary}33] hover:border-indigo-500/40`;
            break;
        case 'shadow':
            hoverEffectClass += 'hover:shadow-2xl hover:translate-y-[-4px]';
            break;
        case 'none':
            break;
        default:
            hoverEffectClass += 'hover:-translate-y-1.5 hover:shadow-xl';
    }

    // Card border / outlines style
    let cardStyleClass = 'bg-white dark:bg-slate-900 ';
    if (customization.cardStyle === 'elevated') {
        cardStyleClass += 'border border-transparent bg-white dark:bg-slate-900 shadow';
    } else if (customization.cardStyle === 'outlined') {
        cardStyleClass += 'border-2 border-slate-300/85 dark:border-slate-750';
    } else {
        cardStyleClass += 'border border-slate-200/70 dark:border-slate-800/80';
    }

    return (
        <div 
          className={`${cardStyleClass} ${shadowClass} ${hoverEffectClass} rounded-2xl overflow-hidden flex flex-col cursor-pointer group`} 
          onClick={onViewDetails}
        >
            <div className="bg-slate-50 dark:bg-slate-950 p-2 relative">
                <div className="aspect-square w-full rounded-xl overflow-hidden relative">
                    <img 
                        src={product.thumbnail || `https://picsum.photos/400/400?random=${product.id}`} 
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        loading="lazy"
                    />
                     {productReviews.length > 0 && (
                        <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-md dark:bg-slate-900/95 px-2.5 py-1 rounded-full flex items-center gap-1 text-[10px] font-black shadow-lg">
                            <Star size={10} className="text-amber-500" fill="#f59e0b"/>
                            <span className="text-slate-800 dark:text-white">{averageRating.toFixed(1)}</span>
                        </div>
                     )}
                </div>
            </div>

            <div className={`p-5 flex flex-col flex-grow text-right ${alignmentClass}`}>
                <h3 
                  className={`font-extrabold text-sm sm:text-base flex-grow mb-3 line-clamp-2 leading-relaxed w-full ${customization.headingFontWeight}`}
                  style={{ color: customization.textColor || 'inherit' }}
                >
                    {product.name}
                </h3>
                <div className={`flex justify-between items-center mb-4 w-full ${isCenter ? 'flex-col gap-2' : isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
                     <p className="font-black text-xl" style={{ color: customization.primaryColor }}>
                         {product.price.toLocaleString()} <span className="text-xs font-bold text-slate-455">ج.م</span>
                     </p>
                     <button onClick={handleReviewClick} className="text-xs font-bold underline z-10 relative" style={{ color: customization.primaryColor }}>أضف تقييم</button>
                </div>
                <button 
                    onClick={handleAddToCartClick}
                    disabled={isAdded}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 font-bold text-sm transition-all text-white z-10 relative shadow-md cursor-pointer ${customization.buttonBorderRadius} ${isAdded ? 'bg-emerald-600 hover:bg-emerald-500' : 'hover:opacity-90'}`}
                    style={{ backgroundColor: isAdded ? '' : customization.primaryColor }}
                >
                    {isAdded ? (
                        <>
                            <CheckCircle size={16} />
                            <span>تمت الإضافة للسلة!</span>
                        </>
                    ) : (
                        <>
                            <ShoppingCart size={16} />
                            <span>أضف للسلة</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

const ProductCardSkeleton: React.FC = () => (
    <div className="bg-slate-500/50 dark:bg-slate-700/50 rounded-2xl p-3 flex flex-col animate-pulse">
        <div className="bg-slate-300/50 dark:bg-slate-600/50 rounded-xl aspect-square mb-3"></div>
        <div className="px-2 pb-2 space-y-3">
            <div className="h-4 bg-slate-400/50 dark:bg-slate-600/50 rounded w-3/4"></div>
            <div className="h-4 bg-slate-400/50 dark:bg-slate-600/50 rounded w-1/2"></div>
            <div className="flex justify-between items-center">
                 <div className="h-6 bg-slate-400/50 dark:bg-slate-600/50 rounded w-1/3"></div>
            </div>
            <div className="h-12 bg-slate-400/50 dark:bg-slate-600/50 rounded-lg"></div>
        </div>
    </div>
);

const HeroSection: React.FC<{ customization: StoreCustomization }> = ({ customization }) => {
    const firstBanner = customization.banners?.[0];

    if (!firstBanner) {
        return null; // Or a fallback hero
    }
    
    return (
        <div className="relative h-[60vh] min-h-[400px] bg-cover bg-center flex items-center justify-center text-center text-white" style={{ backgroundImage: `url(${firstBanner.imageUrl})` }}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent"></div>
            <div className="relative z-10 px-4 flex flex-col items-center animate-in fade-in slide-in-from-bottom-10 duration-700">
                <h2 className={`text-4xl md:text-7xl drop-shadow-lg ${customization.headingFontWeight}`}>{firstBanner.title}</h2>
                <p className="mt-4 text-lg md:text-2xl max-w-3xl mx-auto drop-shadow-md">{firstBanner.subtitle}</p>
                <a 
                  href={firstBanner.link || "#products-section"} 
                  className={`mt-8 flex items-center gap-2 bg-white px-8 py-4 font-bold text-lg hover:bg-slate-200 transition-all shadow-lg transform hover:scale-105 ${customization.buttonBorderRadius}`}
                  style={{ color: customization.primaryColor }}
                >
                  <span>{firstBanner.buttonText || 'تصفح المنتجات'}</span>
                  <ArrowDown size={20} />
                </a>
            </div>
        </div>
    );
};

const ProductsSection: React.FC<{ settings: Settings, searchTerm: string, customization: StoreCustomization, onAddToCart: (product: Product) => void, onReview: (id: string) => void, onViewProduct: (product: Product) => void }> = ({ settings, searchTerm, customization, onAddToCart, onReview, onViewProduct }) => {
    const [activeCollectionId, setActiveCollectionId] = useState<string>('all');
    const [sortOption, setSortOption] = useState<'default' | 'price-asc' | 'price-desc'>('default');
    const [isAiSearching, setIsAiSearching] = useState(false);
    const [aiSearchResults, setAiSearchResults] = useState<string[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 1000); // Simulate 1 second loading
        return () => clearTimeout(timer);
    }, [activeCollectionId, sortOption, aiSearchResults, searchTerm]);


    const handleAiSearch = async () => {
        if (!searchTerm.trim() || searchTerm.length < 5) {
            alert('للبحث الذكي، يرجى كتابة وصف أطول للمنتج الذي تبحث عنه (5 أحرف على الأقل).');
            return;
        }
        setIsAiSearching(true);
        const resultIds = await searchProductsWithAI(searchTerm, settings.products);
        setAiSearchResults(resultIds);
        setIsAiSearching(false);
    };

    const clearAiSearch = () => {
        setAiSearchResults(null);
    };

    const filteredProducts = useMemo(() => {
        let products;
        if (aiSearchResults !== null) {
            products = settings.products.filter(p => aiSearchResults.includes(p.id));
        } else {
            products = settings.products.filter(p => {
              const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()));
              const matchesCollection = activeCollectionId === 'all' || p.collectionId === activeCollectionId;
              return matchesSearch && matchesCollection;
            });
        }
        
        if (activeCollectionId !== 'all') {
            products = products.filter(p => p.collectionId === activeCollectionId);
        }

        if (sortOption === 'price-asc') {
            products.sort((a, b) => a.price - b.price);
        } else if (sortOption === 'price-desc') {
            products.sort((a, b) => b.price - a.price);
        }

        return products;
    }, [settings.products, searchTerm, activeCollectionId, sortOption, aiSearchResults]);

    const gridClass = `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${customization.productColumnsDesktop} gap-4 md:gap-6`;

    // Render Category tabs
    const renderCategoryTabs = () => {
        if (settings.collections.length === 0) return null;

        const tabStyle = customization.tabStyle || 'pills';

        if (tabStyle === 'underline') {
            return (
                <div className="flex justify-center items-center border-b border-slate-200 dark:border-slate-800 pb-2 w-full max-w-lg mx-auto flex-wrap gap-4 md:gap-8 mb-8">
                    <button 
                        onClick={() => setActiveCollectionId('all')} 
                        className={`pb-2 relative font-extrabold text-sm px-1.5 transition-all text-center ${activeCollectionId === 'all' ? 'text-slate-900 dark:text-white border-b-2' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`} 
                        style={{ borderBottomColor: activeCollectionId === 'all' ? customization.primaryColor : 'transparent' }}
                    >
                        الكل ({settings.products.length})
                    </button>
                    {settings.collections.map(col => {
                        const count = settings.products.filter(p => p.collectionId === col.id).length;
                        return (
                            <button 
                                key={col.id} 
                                onClick={() => setActiveCollectionId(col.id)} 
                                className={`pb-2 relative font-extrabold text-sm px-1.5 transition-all text-center ${activeCollectionId === col.id ? 'text-slate-900 dark:text-white border-b-2' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`} 
                                style={{ borderBottomColor: activeCollectionId === col.id ? customization.primaryColor : 'transparent' }}
                            >
                                {col.name} ({count})
                            </button>
                        );
                    })}
                </div>
            );
        }

        if (tabStyle === 'bento') {
            const bentoGlowBorder = activeCollectionId === 'all' ? 'ring-2' : '';
            return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 w-full">
                    <div 
                        onClick={() => setActiveCollectionId('all')} 
                        className={`p-5 rounded-2xl cursor-pointer text-center flex flex-col justify-center items-center transition-all border border-slate-200/50 dark:border-slate-800 shadow-sm hover:translate-y-[-2px] ${activeCollectionId === 'all' ? 'text-white scale-105' : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-300'}`} 
                        style={{ 
                            backgroundColor: activeCollectionId === 'all' ? customization.primaryColor : '',
                            borderColor: activeCollectionId === 'all' ? customization.primaryColor : ''
                        }}
                    >
                        <LayoutGrid size={22} className="mb-2 opacity-85"/>
                        <span className="font-extrabold text-xs md:text-sm">الكل ({settings.products.length})</span>
                    </div>
                    {settings.collections.map((col, idx) => {
                        const count = settings.products.filter(p => p.collectionId === col.id).length;
                        const isSel = activeCollectionId === col.id;
                        const initial = col.name ? col.name.trim().charAt(0) : '🔑';
                        const gradients = [
                            'bg-indigo-500/10 text-indigo-600',
                            'bg-emerald-500/10 text-emerald-600',
                            'bg-pink-500/10 text-pink-600',
                            'bg-amber-500/10 text-amber-600'
                        ];
                        const gradClass = gradients[idx % gradients.length];

                        return (
                            <div 
                                key={col.id} 
                                onClick={() => setActiveCollectionId(col.id)} 
                                className={`p-5 rounded-2xl cursor-pointer text-center flex flex-col justify-center items-center transition-all border border-slate-200/50 dark:border-slate-800 shadow-sm hover:translate-y-[-2px] ${isSel ? 'text-white scale-105' : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-300'}`} 
                                style={{ 
                                    backgroundColor: isSel ? customization.primaryColor : '',
                                    borderColor: isSel ? customization.primaryColor : ''
                                }}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-2 ${isSel ? 'bg-white/20 text-white' : gradClass}`}>
                                    {initial}
                                </div>
                                <span className="font-extrabold text-xs md:text-sm">{col.name} ({count})</span>
                            </div>
                        );
                    })}
                </div>
            );
        }

        // Default 'pills' style
        return (
            <div className="flex justify-center flex-wrap gap-2.5 pb-2 -mx-4 px-4 mb-6">
                <button 
                    onClick={() => setActiveCollectionId('all')} 
                    className={`px-5 py-2.5 text-xs sm:text-sm font-bold transition-all whitespace-nowrap shadow-sm hover:scale-[1.02] ${activeCollectionId === 'all' ? 'text-white font-extrabold' : 'bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-305 hover:bg-slate-205 dark:hover:bg-slate-750'} ${customization.buttonBorderRadius}`}
                    style={{ backgroundColor: activeCollectionId === 'all' ? customization.primaryColor : '' }}
                >
                    الكل
                </button>
                {settings.collections.map(col => (
                    <button 
                        key={col.id} 
                        onClick={() => setActiveCollectionId(col.id)} 
                        className={`px-5 py-2.5 text-xs sm:text-sm font-bold transition-all whitespace-nowrap shadow-sm hover:scale-[1.02] ${activeCollectionId === col.id ? 'text-white font-extrabold' : 'bg-slate-100 dark:bg-slate-800 text-slate-655 dark:text-slate-305 hover:bg-slate-205 dark:hover:bg-slate-750'} ${customization.buttonBorderRadius}`}
                        style={{ backgroundColor: activeCollectionId === col.id ? customization.primaryColor : '' }}
                    >
                        {col.name}
                    </button>
                ))}
            </div>
        );
    };

    const isSidebarLayout = customization.tabStyle === 'sidebar' && settings.collections.length > 0;

    return (
        <div id="products-section" className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 scroll-mt-20 text-right">
             <div className="text-center mb-10">
                <h2 className={`text-4xl sm:text-5xl text-slate-800 dark:text-white ${customization.headingFontWeight}`}>منتجاتنا المميزة</h2>
                <p className="mt-2 text-lg text-slate-500 dark:text-slate-400 max-w-xl mx-auto">اكتشف تشكيلتنا الواسعة من المنتجات عالية الجودة.</p>
            </div>
            
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 pb-4 border-b border-slate-150 dark:border-slate-800">
                {/* Search options & Smart AI */}
                <div className="w-full md:w-auto flex items-center justify-between md:justify-end gap-3 flex-row-reverse">
                    <button onClick={handleAiSearch} disabled={isAiSearching} title="بحث بالذكاء الاصطناعي" className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all disabled:bg-slate-400">
                       {isAiSearching ? <RefreshCw size={15} className="animate-spin" /> : <Wand2 size={15}/>}
                       <span>البحث الذكي</span>
                    </button>
                    <select value={sortOption} onChange={e => setSortOption(e.target.value as any)} className="bg-slate-50 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 rounded-xl py-3 px-3 text-xs sm:text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-right">
                        <option value="default">ترتيب وتصفية المنتجات</option>
                        <option value="price-desc">السعر: الأعلى للأقل</option>
                        <option value="price-asc">السعر: الأقل للأعلى</option>
                    </select>
                </div>
            </div>

            {aiSearchResults !== null && (
                <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex justify-between items-center animate-in fade-in duration-300">
                    <p className="font-bold text-indigo-700 dark:text-indigo-300 text-sm">
                        نتائج البحث الذكي عن: "{searchTerm}"
                    </p>
                    <button onClick={clearAiSearch} className="flex items-center gap-1 text-sm text-slate-500 hover:text-red-500 font-bold">
                        <X size={14}/> مسح النتائج
                    </button>
                </div>
            )}

            {isAiSearching && !aiSearchResults && (
                <div className="flex justify-center items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold mb-6">
                    <BrainCircuit size={20} className="animate-pulse" />
                    <span>البحث والذكاء الاصطناعي يفحص المنتجات...</span>
                </div>
            )}

            {isSidebarLayout ? (
                /* Dynamic Sidebar layout split */
                <div className="flex flex-col lg:flex-row gap-8 w-full mt-6">
                    {/* Right Sticky Sidebar */}
                    <aside className="w-full lg:w-1/4 shrink-0 bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 lg:sticky lg:top-24 self-start">
                        <h3 className={`font-black text-sm text-slate-450 dark:text-slate-400 mb-4 pb-2 border-b border-slate-200 dark:border-slate-800 ${customization.headingFontWeight}`}>
                            تصفح حسب الفئات
                        </h3>
                        <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-none">
                            <button 
                                onClick={() => setActiveCollectionId('all')} 
                                className={`flex items-center justify-between text-right px-4.5 py-3 rounded-xl text-xs md:text-sm font-bold w-full transition-all whitespace-nowrap ${activeCollectionId === 'all' ? 'text-white shadow-sm' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-350 bg-white dark:bg-slate-900'}`} 
                                style={{ backgroundColor: activeCollectionId === 'all' ? customization.primaryColor : '' }}
                            >
                                <span>الكل</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${activeCollectionId === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>{settings.products.length}</span>
                            </button>
                            {settings.collections.map(col => {
                                const count = settings.products.filter(p => p.collectionId === col.id).length;
                                return (
                                    <button 
                                        key={col.id} 
                                        onClick={() => setActiveCollectionId(col.id)} 
                                        className={`flex items-center justify-between text-right px-4.5 py-3 rounded-xl text-xs md:text-sm font-bold w-full transition-all whitespace-nowrap ${activeCollectionId === col.id ? 'text-white shadow-sm' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-350 bg-white dark:bg-slate-900'}`} 
                                        style={{ backgroundColor: activeCollectionId === col.id ? customization.primaryColor : '' }}
                                    >
                                        <span>{col.name}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${activeCollectionId === col.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>
                    
                    {/* Left Grid area */}
                    <div className="flex-1">
                        {isLoading ? (
                            <div className={gridClass}>
                                {Array.from({ length: customization.productColumnsDesktop }).map((_, i) => <ProductCardSkeleton key={i} />)}
                            </div>
                        ) : filteredProducts.length > 0 ? (
                            <div className={gridClass}>
                                {filteredProducts.map(product => (
                                    <ProductCard key={product.id} product={product} customization={customization} onAddToCart={onAddToCart} onReview={onReview} reviews={settings.reviews || []} onViewDetails={() => onViewProduct(product)} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-white dark:bg-slate-850 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 flex flex-col items-center justify-center text-slate-500">
                                <Package size={48} className="text-slate-300 dark:text-slate-700 mb-4" />
                                <h2 className="font-extrabold text-base text-slate-600 dark:text-slate-300 mb-1">لا توجد منتجات متطابقة</h2>
                                <p className="text-xs">جرب تفقد فئات أخرى أو مسح مرشح البحث.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Pills / underline / bento layout */
                <>
                    {renderCategoryTabs()}

                    {isLoading ? (
                        <div className={gridClass}>
                            {Array.from({ length: customization.productColumnsDesktop }).map((_, i) => <ProductCardSkeleton key={i} />)}
                        </div>
                    ) : filteredProducts.length > 0 ? (
                        <div className={gridClass}>
                            {filteredProducts.map(product => (
                                <ProductCard key={product.id} product={product} customization={customization} onAddToCart={onAddToCart} onReview={onReview} reviews={settings.reviews || []} onViewDetails={() => onViewProduct(product)} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-white dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                            {isAiSearching ? (
                                <RefreshCw size={48} className="text-slate-300 dark:text-slate-600 mb-4 animate-spin" />
                            ) : (
                                <Package size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
                            )}
                            <h2 className={`font-bold text-xl text-slate-600 dark:text-slate-300 ${customization.headingFontWeight}`}>{isAiSearching ? 'جاري البحث...' : `لا توجد نتائج لخياراتك الحالية`}</h2>
                            <p className="text-sm">{isAiSearching ? 'البحث الذكي يبحث عن تطابق دقيق.' : 'جرب اختيار الكل أو تعديل الكلمات المستخدمة.'}</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

const ProductDetailModal: React.FC<{ product: Product; allProducts: Product[]; allReviews: Review[]; customization: StoreCustomization; onClose: () => void; onAddToCart: (product: Product) => void; onSelectProduct: (product: Product) => void; }> = ({ product, allProducts, allReviews, customization, onClose, onAddToCart, onSelectProduct }) => {
    const [isAdded, setIsAdded] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const images = [product.thumbnail, ...(product.images || [])].filter(Boolean) as string[];
    const productReviews = allReviews.filter(r => r.productId === product.id && r.status === 'approved');
    const relatedProducts = allProducts.filter(p => p.collectionId === product.collectionId && p.id !== product.id).slice(0, 4);

    const handleAddToCartClick = () => {
        onAddToCart(product);
        setIsAdded(true);
        setTimeout(() => setIsAdded(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl flex flex-col md:flex-row animate-in zoom-in-95 duration-300 overflow-hidden" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 z-20 p-2 bg-white/50 dark:bg-black/50 rounded-full text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-black"><X/></button>
                {/* Image Gallery */}
                <div className="w-full md:w-1/2 bg-slate-100 dark:bg-slate-800 relative flex items-center justify-center">
                    <img src={images[currentImageIndex] || `https://picsum.photos/600/600?random=${product.id}`} alt={product.name} className="w-full h-full object-contain"/>
                    {images.length > 1 && (
                        <>
                            <button onClick={e => {e.stopPropagation(); setCurrentImageIndex(p => (p - 1 + images.length) % images.length)}} className="absolute left-4 p-2 bg-white/50 rounded-full"><ChevronLeft/></button>
                            <button onClick={e => {e.stopPropagation(); setCurrentImageIndex(p => (p + 1) % images.length)}} className="absolute right-4 p-2 bg-white/50 rounded-full"><ChevronRight/></button>
                            <div className="absolute bottom-4 flex gap-2">
                                {images.map((_, idx) => <div key={idx} onClick={() => setCurrentImageIndex(idx)} className={`w-2 h-2 rounded-full cursor-pointer ${idx === currentImageIndex ? 'bg-indigo-500' : 'bg-white/50'}`}/>)}
                            </div>
                        </>
                    )}
                </div>

                {/* Product Details */}
                <div className="w-full md:w-1/2 p-8 overflow-y-auto">
                    <h2 className={`text-3xl font-black mb-2 ${customization.headingFontWeight}`}>{product.name}</h2>
                    <p className="font-black text-4xl mb-4" style={{ color: customization.primaryColor }}>{product.price.toLocaleString()} ج.م</p>
                    <div className={`p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-600 dark:text-slate-300 prose prose-sm dark:prose-invert max-w-full mb-6 ${customization.bodyFontSize}`} dangerouslySetInnerHTML={{ __html: product.description?.replace(/\n/g, '<br/>') || 'لا يوجد وصف متاح لهذا المنتج.' }}></div>

                    <button onClick={handleAddToCartClick} disabled={isAdded} className={`w-full flex items-center justify-center gap-2 py-4 font-bold transition-all text-white ${customization.buttonBorderRadius} ${isAdded ? 'bg-emerald-500' : ''}`} style={{ backgroundColor: isAdded ? '' : customization.primaryColor }}>
                        {isAdded ? <><CheckCircle/> تمت الإضافة!</> : <><ShoppingCart/> أضف للسلة</>}
                    </button>
                    
                    {/* Reviews */}
                    {productReviews.length > 0 && (
                        <div className="mt-8">
                            <h3 className="font-bold mb-4">آراء العملاء ({productReviews.length})</h3>
                            <div className="space-y-4 max-h-48 overflow-y-auto">
                                {productReviews.map(r => (
                                    <div key={r.id} className="border-b border-slate-100 dark:border-slate-800 pb-3">
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-sm">{r.customerName}</span>
                                            <div className="flex text-amber-500">{Array(r.rating).fill(0).map((_, i) => <Star key={i} size={14} fill="currentColor"/>)}</div>
                                        </div>
                                        <p className="text-sm text-slate-500 mt-1">{r.comment}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                     {/* Related Products */}
                    {relatedProducts.length > 0 && (
                        <div className="mt-8">
                             <h3 className="font-bold mb-4">قد يعجبك أيضاً</h3>
                             <div className="grid grid-cols-2 gap-4">
                                 {relatedProducts.map(p => (
                                     <div key={p.id} onClick={() => onSelectProduct(p)} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
                                         <img src={p.thumbnail} className="w-full aspect-square object-cover rounded-md mb-2"/>
                                         <p className="font-bold text-xs truncate">{p.name}</p>
                                         <p className="font-bold text-xs" style={{ color: customization.primaryColor }}>{p.price.toLocaleString()} ج.م</p>
                                     </div>
                                 ))}
                             </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const StorefrontPage: React.FC<StorefrontPageProps> = ({ settings, setSettings, activeStore, cart, onAddToCart, onUpdateCartQuantity, onRemoveFromCart }) => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedProductIdForReview, setSelectedProductIdForReview] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const customization = settings.customization;

  const handleReviewSubmit = (review: Omit<Review, 'id' | 'status' | 'date'>) => {
      const newReview: Review = { ...review, id: Date.now().toString(), date: new Date().toISOString(), status: 'pending' };
      setSettings(prevSettings => ({ ...prevSettings, reviews: [...(prevSettings.reviews || []), newReview] }));
  };

  const openReviewModal = (productId: string) => {
      setSelectedProductIdForReview(productId);
      setReviewModalOpen(true);
  };

  return (
    <div 
      className="min-h-screen flex flex-col transition-all duration-300" 
      style={{ 
        fontFamily: customization.fontFamily,
        backgroundColor: customization.backgroundColor || '#f8fafc',
        color: customization.textColor || '#0f172a'
      }}
    >
      
      {customization.isAnnouncementBarVisible && <div className="text-white text-center py-2 text-sm font-bold px-4 transition-all duration-300" style={{ backgroundColor: customization.primaryColor }}>{customization.announcementBarText}</div>}

      {customization.headerStyle === 'floating' ? (
        <div className="mx-auto px-4 max-w-7xl w-full z-40 relative animate-in slide-in-from-top duration-500">
          <nav className="my-3 sm:my-5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/55 dark:border-slate-800/85 rounded-[1.8rem] shadow-xl relative text-right transition-all duration-300" style={{ borderColor: `${customization.primaryColor}22` }}>
            <div className="px-6 h-16 flex items-center justify-between gap-4 flex-row-reverse">
               <div className="flex items-center gap-3">
                  <button onClick={() => setIsCartOpen(true)} className="relative p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <ShoppingCart size={22} className="text-slate-705 dark:text-slate-355" style={{ color: customization.primaryColor }} />
                      {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">{cart.reduce((a, c) => a + c.quantity, 0)}</span>}
                  </button>
               </div>
               
               {customization.navigationLinks && customization.navigationLinks.length > 0 && (
                 <div className="hidden md:flex items-center gap-5 text-xs font-black">
                   {customization.navigationLinks.map((link, idx) => (
                     <a key={idx} href={link.url} className="opacity-80 hover:opacity-100 transition-opacity whitespace-nowrap px-1 py-2">{link.label}</a>
                   ))}
                 </div>
               )}

               {customization.logoUrl ? (
                 <img 
                   src={customization.logoUrl} 
                   alt={activeStore?.name} 
                   className={`object-contain ${customization.logoSize === 'sm' ? 'h-8' : customization.logoSize === 'lg' ? 'h-15' : 'h-11'}`} 
                   referrerPolicy="no-referrer"
                 />
               ) : (
                 <span className="text-xl font-black text-transparent bg-clip-text" style={{ backgroundImage: `linear-gradient(to right, ${customization.primaryColor}, ${customization.primaryColor}cc)` }}>{activeStore?.name || 'اسم المتجر'}</span>
               )}
            </div>
          </nav>
        </div>
      ) : customization.headerStyle === 'minimal' ? (
        <nav className="sticky top-0 z-40 bg-white/95 dark:bg-slate-950/95 border-b border-slate-200/80 dark:border-slate-850/80 text-right transition-all duration-300" style={{ borderBottomColor: `${customization.primaryColor}1a` }}>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 flex-row-reverse">
             <div className="flex items-center gap-4">
                <button onClick={() => setIsCartOpen(true)} className={`relative p-2 hover:bg-slate-100 dark:hover:bg-slate-905 transition-colors ${customization.buttonBorderRadius}`}>
                    <ShoppingCart size={20} style={{ color: customization.primaryColor }} />
                    {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center">{cart.reduce((a, c) => a + c.quantity, 0)}</span>}
                </button>
             </div>

             {customization.navigationLinks && customization.navigationLinks.length > 0 && (
               <div className="hidden md:flex items-center gap-5 text-xs font-black">
                 {customization.navigationLinks.map((link, idx) => (
                   <a key={idx} href={link.url} className="opacity-80 hover:opacity-100 transition-opacity whitespace-nowrap px-1 py-2">{link.label}</a>
                 ))}
               </div>
             )}

             {customization.logoUrl ? (
               <img 
                 src={customization.logoUrl} 
                 alt={activeStore?.name} 
                 className={`object-contain ${customization.logoSize === 'sm' ? 'h-8' : customization.logoSize === 'lg' ? 'h-15' : 'h-11'}`} 
                 referrerPolicy="no-referrer"
               />
             ) : (
               <span className="text-xl font-black tracking-tight" style={{ color: customization.primaryColor }}>{activeStore?.name || 'اسم المتجر'}</span>
             )}
          </div>
        </nav>
      ) : customization.headerStyle === 'luxury' ? (
        <nav className="sticky top-0 z-40 bg-zinc-950 text-amber-500 border-b border-amber-500/20 py-1 shadow-2xl text-right transition-all duration-305">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 flex-row-reverse">
             <div className="flex items-center gap-3">
                <button onClick={() => setIsCartOpen(true)} className="relative p-2.5 rounded-full hover:bg-amber-500/10 transition-colors border border-amber-500/10">
                    <ShoppingCart size={22} className="text-amber-400" />
                    {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-black">{cart.reduce((a, c) => a + c.quantity, 0)}</span>}
                </button>
             </div>

             {customization.navigationLinks && customization.navigationLinks.length > 0 && (
               <div className="hidden md:flex items-center gap-5 text-xs font-black">
                 {customization.navigationLinks.map((link, idx) => (
                   <a key={idx} href={link.url} className="opacity-80 hover:text-amber-400 transition-colors whitespace-nowrap px-1 py-2">{link.label}</a>
                 ))}
               </div>
             )}

             {customization.logoUrl ? (
               <img 
                 src={customization.logoUrl} 
                 alt={activeStore?.name} 
                 className={`object-contain ${customization.logoSize === 'sm' ? 'h-8' : customization.logoSize === 'lg' ? 'h-15' : 'h-11'}`} 
                 referrerPolicy="no-referrer"
               />
             ) : (
               <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-500 tracking-widest uppercase">{activeStore?.name || 'اسم المتجر'}</span>
             )}
          </div>
        </nav>
      ) : (
        /* Classic default style */
        <nav className="sticky top-0 z-40 text-white shadow-md text-right transition-all duration-300" style={{ background: `linear-gradient(135deg, ${customization.primaryColor}, ${customization.primaryColor}eb)` }}>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 flex-row-reverse">
             <div className="flex items-center gap-3 md:gap-6">
                <button onClick={() => setIsCartOpen(true)} className="relative p-2 rounded-full hover:bg-white/10 transition-colors">
                    <ShoppingCart size={24} />
                    {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-white text-indigo-705 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2" style={{ color: customization.primaryColor }}>{cart.reduce((a, c) => a + c.quantity, 0)}</span>}
                </button>
             </div>

             {customization.navigationLinks && customization.navigationLinks.length > 0 && (
               <div className="hidden md:flex items-center gap-5 text-xs font-black">
                 {customization.navigationLinks.map((link, idx) => (
                   <a key={idx} href={link.url} className="opacity-90 hover:opacity-100 transition-opacity whitespace-nowrap px-1 py-2">{link.label}</a>
                 ))}
               </div>
             )}

             {customization.logoUrl ? (
               <img 
                 src={customization.logoUrl} 
                 alt={activeStore?.name} 
                 className={`object-contain ${customization.logoSize === 'sm' ? 'h-8' : customization.logoSize === 'lg' ? 'h-15' : 'h-11'}`} 
                 referrerPolicy="no-referrer"
               />
             ) : (
               <span className="text-2xl font-black text-white">{activeStore?.name || 'اسم المتجر'}</span>
             )}
          </div>
        </nav>
      )}
      
      <main 
        className="flex-1 md:rounded-t-[2.5rem] shadow-sm transition-all duration-300 overflow-hidden text-right" 
        style={{ 
          backgroundColor: customization.backgroundColor || '#ffffff',
          color: customization.textColor || '#0f172a'
        }}
      >
          {(customization.pageSections || []).map((section) => {
            if (!section.enabled) return null;
            if (section.type === 'hero') {
              return <HeroSection key={section.id || 'hero'} customization={customization} />;
            }
            if (section.type === 'products') {
              return (
                <ProductsSection 
                  key={section.id || 'products'} 
                  settings={settings} 
                  searchTerm={searchTerm} 
                  customization={customization} 
                  onAddToCart={onAddToCart} 
                  onReview={openReviewModal} 
                  onViewProduct={setSelectedProduct} 
                />
              );
            }
            if (section.type === 'about_us' || (customization.aboutUs?.enabled && section.type === 'about_us')) {
              const ab = customization.aboutUs || { title: 'من نحن', subtitle: 'قصتنا وهويتنا البصرية', content: 'نحن هاهنا لتقديم أرقى وأفضل معايير الجودة العالمية لعملائنا الكرام.', imageUrl: '' };
              return (
                <div key={section.id || 'about_us'} className="py-16 px-6 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center text-right text-slate-800 dark:text-slate-100" id="about-section">
                   {ab.imageUrl && (
                     <img src={ab.imageUrl} alt={ab.title} className="rounded-3xl object-cover w-full h-80 shadow-md border border-slate-100 dark:border-slate-800" />
                   )}
                   <div className="space-y-4">
                      {ab.subtitle && (
                        <span className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase">{ab.subtitle}</span>
                      )}
                      <h3 className={`text-2xl font-black ${customization.headingFontWeight}`} style={{ color: customization.primaryColor }}>{ab.title}</h3>
                      <p className="text-sm font-semibold opacity-85 leading-relaxed whitespace-pre-line text-slate-600 dark:text-slate-350">{ab.content}</p>
                   </div>
                </div>
              );
            }
            return null;
          })}
      </main>

      {customization.footerStyle === 'multi-column' ? (
          <footer className="bg-slate-950 dark:bg-[#070b13] border-t border-slate-800 py-16 text-right text-slate-300">
              <div className="container mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-10">
                  <div>
                      <h4 className="font-extrabold text-white text-lg mb-4">{activeStore?.name}</h4>
                      <p className="text-sm text-slate-400 mb-6 leading-relaxed">تسوّق مع أفضل متجر إلكتروني يوفر لك أرقى الخدمات والمنتجات الاستثنائية بأسعار مذهلة وجودة حقيقية.</p>
                      <div className="flex gap-4 justify-start flex-row-reverse">
                         {customization.socialLinks.facebook && <a href={customization.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-slate-900 hover:bg-slate-850 hover:text-white text-slate-450 transition-all"><Facebook size={18}/></a>}
                         {customization.socialLinks.instagram && <a href={customization.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-slate-900 hover:bg-slate-850 hover:text-white text-slate-450 transition-all"><Instagram size={18}/></a>}
                         {customization.socialLinks.x && <a href={customization.socialLinks.x} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-slate-900 hover:bg-slate-850 hover:text-white text-slate-450 transition-all"><Twitter size={18}/></a>}
                         {customization.socialLinks.tiktok && <a href={customization.socialLinks.tiktok} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-slate-900 hover:bg-slate-850 hover:text-white text-slate-450 transition-all"><MessageCircle size={18}/></a>}
                      </div>
                  </div>
                  <div>
                      <h4 className="font-extrabold text-white text-sm mb-4">روابط سريعة</h4>
                      <ul className="space-y-2 text-xs font-bold text-slate-400">
                          <li><a href="#products-section" className="hover:text-white transition-all">جميع المعروضات</a></li>
                          <li><a href="#products-section" className="hover:text-white transition-all">التصنيفات والفئات</a></li>
                          <li><span className="text-slate-600 block">سياسة الاسترجاع والضمان</span></li>
                      </ul>
                  </div>
                  <div>
                      <h4 className="font-extrabold text-white text-sm mb-4">تواصل معنا</h4>
                      <p className="text-xs text-slate-400 mb-3 leading-relaxed">يسعدنا دائماً الإجابة على أي تساؤلات أو استفسارات على مدار الساعة.</p>
                      <span className="text-xs font-bold text-[#eab308] px-3.5 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl inline-block">دعم عملاء فني ٢٤/٧</span>
                  </div>
              </div>
              <div className="border-t border-slate-900 mt-12 pt-6 text-center text-xs text-slate-500 font-bold">
                  {customization.footerText}
              </div>
          </footer>
      ) : customization.footerStyle === 'glass' ? (
          <footer className="py-12 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-t border-slate-200/50 dark:border-slate-850/60 text-right">
              <div className="container mx-auto px-4 max-w-5xl text-center">
                  <div className="p-6 sm:p-8 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-xl">
                      <span className="text-xl font-black tracking-tight text-slate-800 dark:text-white mb-2 block">{activeStore?.name}</span>
                      <p className="text-xs text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">نوفر كروت تصفح وقوالب عالية الأداء لتلبية تطلعاتك التسوقية في كل الأقسام.</p>
                      <div className="flex justify-center gap-5 mb-6">
                          {customization.socialLinks.facebook && <a href={customization.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-600 transition-colors"><Facebook size={20}/></a>}
                          {customization.socialLinks.instagram && <a href={customization.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-pink-600 transition-colors"><Instagram size={20}/></a>}
                          {customization.socialLinks.x && <a href={customization.socialLinks.x} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><Twitter size={20}/></a>}
                          {customization.socialLinks.tiktok && <a href={customization.socialLinks.tiktok} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-500 transition-colors"><MessageCircle size={20}/></a>}
                      </div>
                      <p className="text-xs text-slate-500 font-extrabold">{customization.footerText}</p>
                  </div>
              </div>
          </footer>
      ) : (
          /* Simple footer default style */
          <footer className="bg-slate-900 dark:bg-[#0C101B] py-8 border-t border-slate-850 text-white text-right">
              <div className="container mx-auto px-4 text-center">
                  <div className="flex justify-center gap-6 mb-4">
                      {customization.socialLinks.facebook && <a href={customization.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors"><Facebook size={20}/></a>}
                      {customization.socialLinks.instagram && <a href={customization.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors"><Instagram size={20}/></a>}
                      {customization.socialLinks.x && <a href={customization.socialLinks.x} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors"><Twitter size={20}/></a>}
                      {customization.socialLinks.tiktok && <a href={customization.socialLinks.tiktok} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors"><MessageCircle size={20}/></a>}
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">{customization.footerText}</p>
              </div>
          </footer>
      )}

      <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} cart={cart} onUpdateQuantity={onUpdateCartQuantity} onRemoveItem={onRemoveFromCart} primaryColor={customization.primaryColor}/>

      {reviewModalOpen && selectedProductIdForReview && <ReviewModal productId={selectedProductIdForReview} onClose={() => setReviewModalOpen(false)} onSubmit={handleReviewSubmit} />}
      
      {selectedProduct && <ProductDetailModal product={selectedProduct} allProducts={settings.products} allReviews={settings.reviews || []} customization={customization} onClose={() => setSelectedProduct(null)} onAddToCart={onAddToCart} onSelectProduct={setSelectedProduct} />}

      <SmartUpdatesWidget primaryColor={customization.primaryColor} isAdminView={false} />
    </div>
  );
};

export default StorefrontPage;
