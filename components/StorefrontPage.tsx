
import React, { useEffect, useMemo, useState } from 'react';
import { Settings, Store, Product, StoreCustomization, OrderItem, Review } from '../types';
import { ShoppingCart, Package, Search, Facebook, Instagram, Twitter, MessageCircle, ArrowDown, CheckCircle, Star, X, LayoutGrid, ChevronLeft, ChevronRight, ArrowRight, BrainCircuit, RefreshCw, Wand2 } from 'lucide-react';
import CartSidebar from './CartSidebar';
import { searchProductsWithAI } from '../services/geminiService';

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

    return (
        <div className="bg-slate-500 dark:bg-slate-700 rounded-2xl overflow-hidden flex flex-col shadow-lg cursor-pointer group transition-transform hover:-translate-y-1" onClick={onViewDetails}>
            <div className="bg-white p-2">
                <div className="aspect-square w-full rounded-lg overflow-hidden relative">
                    <img 
                        src={product.thumbnail || `https://picsum.photos/400/400?random=${product.id}`} 
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        loading="lazy"
                    />
                     {productReviews.length > 0 && (
                        <div className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1 text-xs font-bold shadow-sm">
                            <Star size={12} className="text-amber-500" fill="#f59e0b"/>
                            <span>{averageRating.toFixed(1)}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 flex flex-col flex-grow text-white">
                <h3 className={`font-bold text-base flex-grow mb-2 line-clamp-2 ${customization.headingFontWeight}`}>{product.name}</h3>
                <div className="flex justify-between items-center mb-3">
                     <p className="font-black text-2xl" style={{ color: '#A5B4FC' /* indigo-300 */ }}>{product.price.toLocaleString()} <span className="text-sm font-semibold">ج.م</span></p>
                     <button onClick={handleReviewClick} className="text-xs text-slate-300 hover:text-white underline z-10 relative">أضف تقييم</button>
                </div>
                <button 
                    onClick={handleAddToCartClick}
                    disabled={isAdded}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 font-bold transition-all text-white z-10 relative rounded-lg ${isAdded ? 'bg-emerald-500' : ''}`}
                    style={{ backgroundColor: isAdded ? '' : customization.primaryColor }}
                >
                    {isAdded ? (
                        <>
                            <CheckCircle size={18} />
                            <span>تمت الإضافة!</span>
                        </>
                    ) : (
                        <>
                            <ShoppingCart size={18} />
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

    return (
        <div id="products-section" className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 scroll-mt-20">
             <div className="text-center mb-10">
                <h2 className={`text-4xl sm:text-5xl text-slate-800 dark:text-white ${customization.headingFontWeight}`}>منتجاتنا المميزة</h2>
                <p className="mt-2 text-lg text-slate-500 dark:text-slate-400 max-w-xl mx-auto">اكتشف تشكيلتنا الواسعة من المنتجات عالية الجودة.</p>
            </div>
            
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                {settings.collections.length > 0 && (
                    <div className="flex justify-center flex-wrap gap-3 pb-2 -mx-4 px-4">
                        <button onClick={() => setActiveCollectionId('all')} className={`px-5 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeCollectionId === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300'}`}>الكل</button>
                        {settings.collections.map(col => (
                            <button key={col.id} onClick={() => setActiveCollectionId(col.id)} className={`px-5 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeCollectionId === col.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300'}`}>{col.name}</button>
                        ))}
                    </div>
                )}
                 <div className="flex-shrink-0 flex items-center gap-2">
                    <select value={sortOption} onChange={e => setSortOption(e.target.value as any)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2.5 px-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                        <option value="default">ترتيب افتراضي</option>
                        <option value="price-desc">السعر: من الأعلى للأقل</option>
                        <option value="price-asc">السعر: من الأقل للأعلى</option>
                    </select>
                    <button onClick={handleAiSearch} disabled={isAiSearching} title="بحث بالذكاء الاصطناعي" className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all disabled:bg-slate-400">
                       {isAiSearching ? <RefreshCw size={16} className="animate-spin" /> : <Wand2 size={16}/>}
                       <span className="hidden sm:inline">بحث ذكي</span>
                    </button>
                </div>
            </div>
            
            {aiSearchResults !== null && (
                <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg flex justify-between items-center animate-in fade-in duration-300">
                    <p className="font-bold text-indigo-700 dark:text-indigo-300 text-sm">
                        نتائج البحث الذكي عن: "{searchTerm}"
                    </p>
                    <button onClick={clearAiSearch} className="flex items-center gap-1 text-sm text-slate-500 hover:text-red-500 font-bold">
                        <X size={14}/> مسح النتائج
                    </button>
                </div>
            )}

            {isAiSearching && !aiSearchResults && (
                <div className="flex justify-center items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold mb-4">
                    <BrainCircuit size={20} />
                    <span>البحث الذكي يعمل...</span>
                </div>
            )}

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
                    <h2 className={`font-bold text-xl text-slate-600 dark:text-slate-300 ${customization.headingFontWeight}`}>{isAiSearching ? 'جاري البحث...' : `لا توجد نتائج بحث لـ "${searchTerm}"`}</h2>
                    <p className="text-sm">{isAiSearching ? 'يقوم المساعد الذكي بالبحث عن طلبك.' : 'جرب البحث بكلمة أخرى أو استخدم البحث الذكي.'}</p>
                </div>
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
    <div className="min-h-screen flex flex-col transition-colors duration-300 bg-slate-100 dark:bg-[#0C101B]" style={{ fontFamily: customization.fontFamily }}>
      
      {customization.isAnnouncementBarVisible && <div className="text-white text-center py-2 text-sm font-bold px-4" style={{ backgroundColor: customization.primaryColor }}>{customization.announcementBarText}</div>}

      <nav className="sticky top-0 z-40 bg-gradient-to-r from-[#1E293B] to-[#0F172A] text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
           <span className={`text-2xl font-black text-white`}>{activeStore?.name || 'اسم المتجر'}</span>
           <div className="flex items-center gap-3 md:gap-6">
              <button onClick={() => setIsCartOpen(true)} className="relative p-2 rounded-full hover:bg-white/10 transition-colors">
                  <ShoppingCart size={24} />
                  {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#1E293B]">{cart.reduce((a, c) => a + c.quantity, 0)}</span>}
              </button>
           </div>
        </div>
      </nav>
      
      <main className="flex-1 bg-white dark:bg-slate-900 md:rounded-t-3xl">
          {customization.pageSections.find(s => s.type === 'hero' && s.enabled) && <HeroSection customization={customization} />}
          {customization.pageSections.find(s => s.type === 'products' && s.enabled) && <ProductsSection settings={settings} searchTerm={searchTerm} customization={customization} onAddToCart={onAddToCart} onReview={openReviewModal} onViewProduct={setSelectedProduct} />}
      </main>

      <footer className="bg-slate-900 dark:bg-[#0C101B] py-8">
          <div className="container mx-auto px-4 text-center">
              <div className="flex justify-center gap-6 mb-4">
                  {customization.socialLinks.facebook && <a href={customization.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white"><Facebook size={20}/></a>}
                  {customization.socialLinks.instagram && <a href={customization.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white"><Instagram size={20}/></a>}
                  {customization.socialLinks.x && <a href={customization.socialLinks.x} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white"><Twitter size={20}/></a>}
                  {customization.socialLinks.tiktok && <a href={customization.socialLinks.tiktok} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white"><MessageCircle size={20}/></a>}
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm">{customization.footerText}</p>
          </div>
      </footer>

      <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} cart={cart} onUpdateQuantity={onUpdateCartQuantity} onRemoveItem={onRemoveFromCart} primaryColor={customization.primaryColor}/>

      {reviewModalOpen && selectedProductIdForReview && <ReviewModal productId={selectedProductIdForReview} onClose={() => setReviewModalOpen(false)} onSubmit={handleReviewSubmit} />}
      
      {selectedProduct && <ProductDetailModal product={selectedProduct} allProducts={settings.products} allReviews={settings.reviews || []} customization={customization} onClose={() => setSelectedProduct(null)} onAddToCart={onAddToCart} onSelectProduct={setSelectedProduct} />}

    </div>
  );
};

export default StorefrontPage;
