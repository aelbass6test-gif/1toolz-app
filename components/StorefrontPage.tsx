
import React, { useEffect, useMemo, useState } from 'react';
import { Settings, Store, Product, StoreCustomization, OrderItem, Review } from '../types';
import { ShoppingCart, Package, Search, Facebook, Instagram, Twitter, MessageCircle, ArrowDown, CheckCircle, Star, X, LayoutGrid, ChevronLeft, ChevronRight, ArrowRight, BrainCircuit, RefreshCw, Wand2, Info, ShieldCheck, Truck, RotateCcw, CreditCard, Heart, Store as StoreIcon } from 'lucide-react';
import CartSidebar from './CartSidebar';
import { searchProductsWithAI } from '../services/geminiService';
import { SmartUpdatesWidget } from './SmartUpdatesWidget';
import { motion, AnimatePresence } from 'motion/react';

interface StorefrontPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  activeStore: Store | undefined;
  cart: OrderItem[];
  onAddToCart: (product: Product) => void;
  onUpdateCartQuantity: (productId: string, quantity: number) => void;
  onRemoveFromCart: (productId: string) => void;
}

const ProductReviewDisplay = ({ reviews }: { reviews: Review[] }) => {
    if (reviews.length === 0) return (
        <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-800">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <MessageCircle className="text-slate-300" size={32} />
            </div>
            <h4 className="font-black text-slate-800 dark:text-white mb-1">لا توجد تقييمات حتى الآن</h4>
            <p className="text-slate-500 text-sm max-w-[200px] mx-auto">كن أول من يشارك تجربته مع هذا المنتج الرائع!</p>
        </div>
    );

    return (
        <div className="space-y-6">
            {reviews.map((review) => (
                <div key={review.id} className="group p-6 bg-white dark:bg-white/5 rounded-[2rem] border border-slate-100 dark:border-slate-800/50 shadow-sm transition-all hover:shadow-xl hover:border-slate-200 dark:hover:border-slate-700">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-indigo-200 dark:shadow-none">
                                {review.customerName.charAt(0)}
                            </div>
                            <div className="text-right">
                                <h4 className="font-black text-base dark:text-white">{review.customerName}</h4>
                                <div className="flex text-amber-500 mt-1">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} size={14} fill={i < review.rating ? "currentColor" : "none"} className={i < review.rating ? "" : "text-slate-200 dark:text-slate-700"} />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-400 font-black uppercase tracking-wider">
                            {new Date(review.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
                        </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pr-2 border-r-2 border-indigo-100 dark:border-slate-800">{review.comment}</p>
                </div>
            ))}
        </div>
    );
};

const ReviewModal = ({ productId, productName, onClose, onSubmit }: { productId: string, productName: string, onClose: () => void, onSubmit: (review: Omit<Review, 'id' | 'status' | 'date'>) => void }) => {
    const [name, setName] = useState('');
    const [comment, setComment] = useState('');
    const [rating, setRating] = useState(5);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        await new Promise(r => setTimeout(r, 600));
        onSubmit({ productId, customerName: name, comment, rating });
        onClose();
        setIsSubmitting(false);
    };

    return (
        <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
            onClick={onClose}
        >
            <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 30 }}
                className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[3rem] p-8 sm:p-12 text-right shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] relative overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 to-amber-600" />
                
                <div className="flex justify-between items-start mb-10">
                    <button onClick={onClose} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-full hover:bg-slate-100 transition-colors">
                        <X className="text-slate-400" size={24} />
                    </button>
                    <div className="text-right">
                        <h3 className="font-black text-3xl text-slate-900 dark:text-white mb-2 leading-none">ضع بصمتك</h3>
                        <p className="text-sm text-slate-500 font-bold">للمنتج: {productName}</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="flex flex-col items-center justify-center gap-4 py-8 bg-slate-50 dark:bg-slate-950/40 rounded-[2.5rem] border border-slate-100 dark:border-slate-800">
                        <div className="flex gap-3">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button 
                                    key={star} 
                                    type="button" 
                                    onMouseEnter={() => setRating(star)}
                                    onClick={() => setRating(star)} 
                                    className="focus:outline-none transition-all hover:scale-125"
                                >
                                    <Star 
                                        size={48} 
                                        fill={star <= rating ? "#f59e0b" : "none"} 
                                        className={star <= rating ? "text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]" : "text-slate-200 dark:text-slate-800"} 
                                    />
                                </button>
                            ))}
                        </div>
                        <span className="text-lg font-black text-amber-600 tracking-tight">
                            {rating === 5 ? 'تجربة أسطورية! ⭐⭐⭐⭐⭐' : rating === 4 ? 'راضٍ جداً عن المنتج 😊' : rating === 3 ? 'منتج جيد وعملي ✅' : rating === 2 ? 'هناك ملاحظات بسيطة ⚠️' : 'لم يعجبني للأسف ❌'}
                        </span>
                    </div>

                    <div className="space-y-6">
                        <div className="relative group">
                            <input 
                                type="text" 
                                required 
                                className="w-full pt-8 pb-4 px-6 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 outline-none rounded-3xl transition-all font-black text-slate-900 dark:text-white peer" 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                            />
                            <label className="absolute right-6 top-4 text-[10px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-indigo-600 transition-colors pointer-events-none">الاسم الكامل</label>
                        </div>
                        <div className="relative group">
                            <textarea 
                                required 
                                className="w-full pt-8 pb-4 px-6 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 outline-none rounded-3xl transition-all font-bold text-slate-900 dark:text-white h-40 resize-none" 
                                value={comment} 
                                onChange={e => setComment(e.target.value)} 
                            />
                            <label className="absolute right-6 top-4 text-[10px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-indigo-600 transition-colors pointer-events-none">رأيك بالتفصيل</label>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-indigo-500/30 flex items-center justify-center gap-3 transform active:scale-95 transition-all disabled:opacity-70"
                    >
                        {isSubmitting ? (
                            <RefreshCw size={24} className="animate-spin" />
                        ) : (
                            <>
                                <CheckCircle size={24} />
                                <span>اعتمـاد التقييـم</span>
                            </>
                        )}
                    </button>
                    <div className="flex items-center justify-center gap-2 text-slate-400 text-[10px] font-black uppercase">
                        <ShieldCheck size={14}/>
                        <span>خصوصيتك محمية. يتم مراجعة التقييم بشرياً.</span>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
};

const ProductCard: React.FC<{ product: Product, customization: StoreCustomization, onAddToCart: (product: Product) => void, onReview: (id: string, name: string) => void, reviews: Review[], onViewDetails: () => void }> = ({ product, customization, onAddToCart, onReview, reviews, onViewDetails }) => {
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
        onReview(product.id, product.name);
    };

    const primaryColor = customization.primaryColor || '#6366f1';

    return (
        <motion.div 
          whileHover={{ y: -12 }}
          className="group relative bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden flex flex-col cursor-pointer border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)] transition-all duration-700" 
          onClick={onViewDetails}
        >
            <div className="relative aspect-[4/5] overflow-hidden bg-slate-50 dark:bg-slate-950 p-4">
                <motion.img 
                    src={product.thumbnail || `https://picsum.photos/600/750?random=${product.id}`} 
                    alt={product.name}
                    className="w-full h-full object-cover rounded-[2rem] transition-transform duration-1000 group-hover:scale-115" 
                    loading="lazy"
                />
                
                {/* Visual Anchors */}
                <div className="absolute top-8 right-8 flex flex-col gap-3">
                    {productReviews.length > 0 && (
                        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-4 py-2 rounded-2xl flex items-center gap-2 shadow-2xl border border-white/20">
                            <Star size={14} className="text-amber-500" fill="currentColor"/>
                            <span className="text-xs font-black">{averageRating.toFixed(1)}</span>
                        </div>
                    )}
                    {product.stockQuantity && product.stockQuantity < 10 && (
                        <div className="bg-rose-600 text-white px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl animate-pulse">
                            قرب يخلص!
                        </div>
                    )}
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[80%] translate-y-6 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                    <button 
                        onClick={handleAddToCartClick}
                        className="w-full py-5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-[1.5rem] font-black text-xs shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center justify-center gap-2 hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-slate-900 active:scale-95 transition-all"
                    >
                        {isAdded ? <CheckCircle size={20} className="text-emerald-500" /> : <ShoppingCart size={20} />}
                        <span>{isAdded ? 'تمت الإضافة' : 'إضافة للسلة'}</span>
                    </button>
                </div>
            </div>

            <div className="p-8 flex flex-col flex-grow text-right">
                <div className="flex justify-between items-center mb-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                        {product.collectionId ? 'وصل حديثاً ✨' : 'الأكثر طلباً 🔥'}
                    </p>
                    <button onClick={handleReviewClick} className="p-2 text-slate-300 hover:text-amber-500 transition-colors backdrop-blur-sm rounded-full">
                        <MessageCircle size={14} />
                    </button>
                </div>
                
                <h3 className="font-black text-xl mb-4 line-clamp-2 leading-tight text-slate-900 dark:text-white h-14">
                    {product.name}
                </h3>
                
                <div className="flex items-center gap-3 mt-auto">
                    <div className="flex items-baseline gap-1.5 order-last">
                        <span className="text-3xl font-black text-slate-900 dark:text-white" style={{ color: primaryColor }}>
                            {product.price.toLocaleString()}
                        </span>
                        <span className="text-xs font-black text-slate-400 uppercase">ج.م</span>
                    </div>
                    <div className="h-px flex-grow bg-slate-100 dark:bg-slate-800" />
                </div>
            </div>
        </motion.div>
    );
};

const ProductCardSkeleton: React.FC = () => (
    <div className="bg-white dark:bg-slate-950 rounded-[3rem] p-5 flex flex-col animate-pulse border border-slate-100 dark:border-slate-900">
        <div className="bg-slate-100 dark:bg-slate-900 rounded-[2.5rem] aspect-[4/5] mb-6 shadow-inner"></div>
        <div className="px-2 space-y-5">
            <div className="flex justify-between">
                <div className="h-3 bg-slate-100 dark:bg-slate-900 rounded-full w-24"></div>
                <div className="h-3 bg-slate-100 dark:bg-slate-900 rounded-full w-8"></div>
            </div>
            <div className="h-8 bg-slate-100 dark:bg-slate-900 rounded-full w-full"></div>
            <div className="pt-4 flex justify-end gap-2 items-end">
                <div className="h-4 bg-slate-100 dark:bg-slate-900 rounded-full w-12 mb-1"></div>
                <div className="h-10 bg-slate-100 dark:bg-slate-900 rounded-full w-24"></div>
            </div>
        </div>
    </div>
);

const HeroSection: React.FC<{ customization: StoreCustomization }> = ({ customization }) => {
    const banners = customization.banners || [];
    const [currentIndex, setCurrentIndex] = useState(0);

    if (banners.length === 0) return null;

    const banner = banners[currentIndex];

    return (
        <div className="relative h-[90vh] w-full bg-slate-950 overflow-hidden">
            <AnimatePresence mode="wait">
                <motion.div 
                    key={currentIndex}
                    initial={{ opacity: 0, scale: 1.15 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="absolute inset-0 bg-cover bg-center" 
                    style={{ backgroundImage: `url(${banner.imageUrl})` }}
                />
            </AnimatePresence>

            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
            <div className="absolute inset-0 bg-black/40" />

            {/* Cinematic Overlay */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                <div className="absolute top-[15%] left-[5%] w-64 h-64 bg-indigo-600/30 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[20%] right-[10%] w-96 h-96 bg-rose-600/20 rounded-full blur-[150px] animate-pulse delay-1000" />
            </div>

            <div className="relative z-10 h-full container mx-auto px-6 flex flex-col items-center justify-center text-center">
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={`content-${currentIndex}`}
                    transition={{ delay: 0.2, duration: 1 }}
                    className="max-w-5xl"
                >
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-3 px-6 py-2 bg-white/10 backdrop-blur-3xl border border-white/20 text-white rounded-full text-[11px] font-black uppercase tracking-[0.25em] mb-10 shadow-2xl"
                    >
                        <Heart size={14} className="text-rose-500 fill-rose-500" />
                        <span>مجموعة الإصدار المحدود 2024</span>
                    </motion.div>
                    
                    <h2 className="text-5xl md:text-9xl text-white font-black leading-[0.95] drop-shadow-2xl mb-10 tracking-tighter sm:tracking-[-0.04em]">
                        {banner.title.split(' ').map((word, i) => (
                            <span key={i} className={i % 2 === 1 ? 'text-indigo-400 block' : 'block'}>
                                {word}
                            </span>
                        ))}
                    </h2>
                    
                    <p className="text-xl md:text-3xl text-slate-300/90 max-w-2xl mx-auto font-medium mb-16 leading-relaxed drop-shadow-lg">
                        {banner.subtitle}
                    </p>
                    
                    <div className="flex flex-wrap justify-center gap-6">
                        <motion.a 
                            whileHover={{ scale: 1.05, boxShadow: "0 20px 40px rgba(99,102,241,0.4)" }}
                            whileTap={{ scale: 0.98 }}
                            href={banner.link || "#products-section"} 
                            className="px-14 py-6 bg-white text-slate-950 font-black rounded-[2rem] text-xl shadow-2xl flex items-center gap-4 group transition-all"
                        >
                            <span>تسوق الآن</span>
                            <ArrowRight size={26} className="group-hover:translate-x-[-10px] transition-transform" />
                        </motion.a>
                    </div>
                </motion.div>

                {/* Vertical Indicators */}
                {banners.length > 1 && (
                    <div className="absolute right-12 top-1/2 -translate-y-1/2 flex flex-col gap-4">
                        {banners.map((_, idx) => (
                            <button 
                                key={idx} 
                                onClick={() => setCurrentIndex(idx)}
                                className={`w-1.5 transition-all duration-700 rounded-full ${idx === currentIndex ? 'h-16 bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.8)]' : 'h-4 bg-white/30'}`}
                            />
                        ))}
                    </div>
                )}
            </div>
            
            <motion.div 
                animate={{ y: [0, 15, 0] }}
                transition={{ repeat: Infinity, duration: 2.5 }}
                className="absolute bottom-12 left-1/2 -translate-x-1/2 text-white/20"
            >
                <div className="w-8 h-12 border-2 border-white/20 rounded-full flex justify-center p-1">
                    <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-1 bg-white/40 rounded-full" />
                </div>
            </motion.div>
        </div>
    );
};

const ProductsSection: React.FC<{ settings: Settings, searchTerm: string, customization: StoreCustomization, onAddToCart: (product: Product) => void, onReview: (id: string, name: string) => void, onViewProduct: (product: Product) => void }> = ({ settings, searchTerm, customization, onAddToCart, onReview, onViewProduct }) => {
    const [activeCollectionId, setActiveCollectionId] = useState<string>('all');
    const [sortOption, setSortOption] = useState<'default' | 'price-asc' | 'price-desc'>('default');
    const [isAiSearching, setIsAiSearching] = useState(false);
    const [aiSearchResults, setAiSearchResults] = useState<string[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        const timer = setTimeout(() => setIsLoading(false), 900);
        return () => clearTimeout(timer);
    }, [activeCollectionId, sortOption, aiSearchResults, searchTerm]);

    const filteredProducts = useMemo(() => {
        let products = aiSearchResults !== null 
            ? settings.products.filter(p => aiSearchResults.includes(p.id))
            : settings.products.filter(p => {
                const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()));
                const matchesCollection = activeCollectionId === 'all' || p.collectionId === activeCollectionId;
                return matchesSearch && matchesCollection;
              });
        
        if (sortOption === 'price-asc') products.sort((a, b) => a.price - b.price);
        else if (sortOption === 'price-desc') products.sort((a, b) => b.price - a.price);

        return products;
    }, [settings.products, searchTerm, activeCollectionId, sortOption, aiSearchResults]);

    const numCols = customization.productColumnsDesktop || 4;
    const gridClass = `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${numCols} gap-8 md:gap-12`;

    return (
        <div id="products-section" className="container mx-auto px-6 py-32 text-right">
            <div className="flex flex-col lg:flex-row justify-between items-end mb-24 gap-12">
                <div className="text-right max-w-3xl">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600 mb-4 block">تسكيلاتنا العالمية</span>
                    <h2 className="text-6xl md:text-7xl font-black text-slate-900 dark:text-white mb-6 tracking-tighter">أحدث التوجهـات</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-xl leading-relaxed max-w-2xl">نختار لك بعناية فائقة أفضل ما أنتجته بيوت الموضة لتصلك بجودة لا تضاهى حتى باب منزلك.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                    <div className="relative group flex-1 sm:flex-none">
                         <Search size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                         <input 
                            type="text" 
                            placeholder="كلمة البحث..." 
                            className="w-full sm:w-64 py-4 px-14 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl text-sm font-black focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                         />
                    </div>
                    <select 
                        value={sortOption} 
                        onChange={e => setSortOption(e.target.value as any)} 
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] py-4 px-8 text-sm font-black outline-none shadow-xl cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-all flex-shrink-0"
                    >
                        <option value="default">الترتيب الذكي</option>
                        <option value="price-desc">الأعلى سعراً</option>
                        <option value="price-asc">الأقل سعراً</option>
                    </select>
                </div>
            </div>

            {/* Interactive Collection Sidebar/Header */}
            <div className="flex gap-4 overflow-x-auto pb-8 mb-16 scrollbar-none snap-x flex-row-reverse">
                <button 
                    onClick={() => setActiveCollectionId('all')} 
                    className={`px-10 py-4.5 rounded-[1.8rem] text-sm font-black whitespace-nowrap snap-start transition-all shadow-xl ${activeCollectionId === 'all' ? 'bg-indigo-600 text-white scale-105 shadow-indigo-600/40' : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    كل التشكيلات
                </button>
                {settings.collections.map(col => (
                    <button 
                        key={col.id} 
                        onClick={() => setActiveCollectionId(col.id)} 
                        className={`px-10 py-4.5 rounded-[1.8rem] text-sm font-black whitespace-nowrap snap-start transition-all shadow-xl ${activeCollectionId === col.id ? 'bg-indigo-600 text-white scale-105 shadow-indigo-600/40' : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        {col.name}
                    </button>
                ))}
            </div>

            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={gridClass}
                    >
                        {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
                    </motion.div>
                ) : filteredProducts.length > 0 ? (
                    <motion.div 
                        key={`${activeCollectionId}-${sortOption}`}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className={gridClass}
                    >
                        {filteredProducts.map(product => (
                            <ProductCard key={product.id} product={product} customization={customization} onAddToCart={onAddToCart} onReview={onReview} reviews={settings.reviews || []} onViewDetails={() => onViewProduct(product)} />
                        ))}
                    </motion.div>
                ) : (
                    <div className="py-40 flex flex-col items-center justify-center text-slate-300 dark:text-slate-800 bg-white dark:bg-slate-950/20 rounded-[4rem] border-4 border-dashed border-slate-50 dark:border-slate-900">
                        <Package size={100} strokeWidth={0.5} className="mb-8" />
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-2">عذراً، الرفوف فارغة حالياً</h3>
                        <p className="text-slate-400 font-bold mb-10">لم نجد أي منتجات تتطابق مع بحثك في هذه المجموعة.</p>
                        <button onClick={() => { setActiveCollectionId('all'); }} className="px-12 py-5 bg-indigo-600 text-white rounded-full font-black text-lg hover:scale-105 transition-all shadow-2xl shadow-indigo-500/30">اكتشف كل المنتجات</button>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

const ProductDetailModal: React.FC<{ product: Product; allProducts: Product[]; allReviews: Review[]; customization: StoreCustomization; onClose: () => void; onAddToCart: (product: Product) => void; onSelectProduct: (product: Product) => void; }> = ({ product, allProducts, allReviews, customization, onClose, onAddToCart, onSelectProduct }) => {
    const [isAdded, setIsAdded] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const images = [product.thumbnail, ...(product.images || [])].filter(Boolean) as string[];
    const productReviews = allReviews.filter(r => r.productId === product.id && r.status === 'approved');
    const relatedProducts = allProducts.filter(p => p.collectionId === product.collectionId && p.id !== product.id).slice(0, 4);

    const averageRating = productReviews.length > 0 ? productReviews.reduce((acc, r) => acc + r.rating, 0) / productReviews.length : 5.0;

    const handleAddToCartClick = () => {
        onAddToCart(product);
        setIsAdded(true);
        setTimeout(() => setIsAdded(false), 2000);
    };

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-3xl p-6 sm:p-12" 
            onClick={onClose}
        >
            <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.85, opacity: 0, y: 30 }}
                className="bg-white dark:bg-slate-900 w-full max-w-7xl h-[95vh] rounded-[4rem] shadow-[0_50px_150px_-30px_rgba(0,0,0,0.8)] flex flex-col lg:flex-row overflow-hidden relative" 
                onClick={e => e.stopPropagation()}
            >
                <button 
                    onClick={onClose} 
                    className="absolute top-8 left-8 z-20 p-4 bg-white/95 dark:bg-slate-800/95 border border-slate-100 dark:border-slate-700 rounded-3xl text-slate-900 dark:text-white hover:scale-110 active:scale-95 transition-all shadow-2xl"
                >
                    <X size={26} />
                </button>

                {/* Left: Gallery (60% width on large screens) */}
                <div className="w-full lg:w-[60%] bg-slate-50 dark:bg-slate-950 relative flex flex-col items-center justify-center p-8 lg:p-20 overflow-hidden">
                    <motion.div 
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={currentImageIndex}
                        className="relative w-full aspect-square max-w-[650px]"
                    >
                         <img 
                            src={images[currentImageIndex] || `https://picsum.photos/1000/1000?random=${product.id}`} 
                            className="w-full h-full object-contain drop-shadow-[0_45px_65px_rgba(0,0,0,0.4)] transition-all"
                        />
                    </motion.div>
                    
                    {images.length > 1 && (
                        <div className="flex gap-4 mt-12 overflow-x-auto pb-4 w-full justify-center scrollbar-none px-4">
                            {images.map((img, idx) => (
                                <button 
                                    key={idx} 
                                    onClick={() => setCurrentImageIndex(idx)} 
                                    className={`w-24 h-24 rounded-[1.8rem] overflow-hidden border-4 transition-all flex-shrink-0 flex items-center justify-center bg-white dark:bg-slate-900 shadow-lg ${idx === currentImageIndex ? 'border-indigo-600 scale-115 rotate-3' : 'border-transparent opacity-40 hover:opacity-100'}`}
                                >
                                    <img src={img} className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: Details */}
                <div className="w-full lg:w-[40%] p-10 lg:p-16 overflow-y-auto bg-white dark:bg-slate-900 border-r-2 dark:border-slate-800/50 text-right">
                    <div className="flex flex-wrap gap-3 mb-10">
                         <div className="bg-amber-50 dark:bg-amber-950/40 text-amber-600 px-5 py-2 rounded-2xl flex items-center gap-2 text-sm font-black">
                            <Star size={16} fill="currentColor" />
                            <span>{averageRating.toFixed(1)} من 5</span>
                         </div>
                         <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 px-5 py-2 rounded-2xl flex items-center gap-2 text-sm font-black uppercase tracking-widest">
                            <CheckCircle size={16} />
                            <span>متوفر للشحن</span>
                         </div>
                    </div>

                    <h2 className="text-4xl lg:text-5xl font-black mb-6 text-slate-900 dark:text-white leading-[1.1] tracking-tighter">{product.name}</h2>
                    
                    <div className="flex items-baseline gap-3 mb-12">
                        <span className="text-5xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">
                            {product.price.toLocaleString()}
                        </span>
                        <span className="text-xl font-black text-slate-400 uppercase tracking-widest italic">ج.م</span>
                    </div>

                    <div className="space-y-8 mb-16">
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                             <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-4 px-2">قصة المنتج ومواصفاته</h3>
                             <div 
                                className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed prose prose-indigo max-w-full font-medium"
                                dangerouslySetInnerHTML={{ __html: product.description?.replace(/\n/g, '<br/>') || 'لم يتم إضافة تفاصيل دقيقة لهذا المنتج بعد، ولكن تم اختياره وفق أعلى المعايير.' }}
                            ></div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 sticky bottom-0 bg-white dark:bg-slate-900 pt-6 pb-2">
                        <motion.button 
                            whileTap={{ scale: 0.95 }}
                            onClick={handleAddToCartClick} 
                            className={`w-full py-6 rounded-[2.2rem] font-black text-2xl transition-all flex items-center justify-center gap-4 shadow-2xl ${isAdded ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white hover:bg-indigo-700'}`}
                            style={{ backgroundColor: isAdded ? '' : customization.primaryColor }}
                        >
                            {isAdded ? (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-3">
                                    <CheckCircle size={32} />
                                    <span>تمـت الإضـافة</span>
                                </motion.div>
                            ) : (
                                <>
                                    <ShoppingCart size={32} />
                                    <span>أضـف للسـلة الآن</span>
                                </>
                            )}
                        </motion.button>
                        <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                            جميع المبيعات مضمونة بنسبة 100% ضد عيوب الصناعة
                        </p>
                    </div>
                    
                    <div className="mt-24 pb-12 border-t-2 border-slate-50 dark:border-slate-800 pt-16">
                        <div className="flex items-center justify-between mb-12">
                             <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-none tracking-tighter">آراء العملاء</h3>
                        </div>
                        <ProductReviewDisplay reviews={productReviews} />
                    </div>

                    {relatedProducts.length > 0 && (
                        <div className="mt-20 pt-16 border-t-2 border-slate-50 dark:border-slate-800 pb-10">
                             <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-10 tracking-tighter">اكتشف تشكيلات مماثلة</h3>
                             <div className="grid grid-cols-2 gap-8">
                                 {relatedProducts.map(p => (
                                     <div key={p.id} onClick={() => onSelectProduct(p)} className="group cursor-pointer">
                                         <div className="aspect-square bg-slate-50 dark:bg-slate-800 rounded-[2.5rem] overflow-hidden mb-6 p-4">
                                            <img src={p.thumbnail} className="w-full h-full object-contain group-hover:scale-115 transition-transform duration-700 drop-shadow-xl"/>
                                         </div>
                                         <p className="font-black text-lg text-slate-900 dark:text-white truncate mb-2">{p.name}</p>
                                         <div className="flex items-center justify-between">
                                            <p className="font-black text-indigo-600 dark:text-indigo-400 text-xl">{p.price.toLocaleString()} ج.م</p>
                                            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 opacity-0 group-hover:opacity-100 transition-all">
                                                <ArrowRight size={14} />
                                            </div>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

const StorefrontPage: React.FC<StorefrontPageProps> = ({ settings, setSettings, activeStore, cart, onAddToCart, onUpdateCartQuantity, onRemoveFromCart }) => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedProductForReview, setSelectedProductForReview] = useState<{id: string, name: string} | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const customization = settings.customization;

  const handleReviewSubmit = (review: Omit<Review, 'id' | 'status' | 'date'>) => {
      const newReview: Review = { ...review, id: Date.now().toString(), date: new Date().toISOString(), status: 'pending' };
      setSettings(prevSettings => ({ ...prevSettings, reviews: [...(prevSettings.reviews || []), newReview] }));
      alert("شكراً لك من القلب 🤍! تقييمك قيد المراجعة الفورية وسيظهر للجميع قريباً.");
  };

  const openReviewModal = (productId: string, productName: string) => {
      setSelectedProductForReview({ id: productId, name: productName });
      setReviewModalOpen(true);
  };

  return (
    <div 
      className="min-h-screen flex flex-col font-store selection:bg-indigo-600 selection:text-white antialiased overflow-x-hidden" 
      style={{ 
        backgroundColor: customization.backgroundColor || '#ffffff',
        color: customization.textColor || '#000000'
      }}
    >
      <SmartUpdatesWidget primaryColor={customization.primaryColor} />

      {/* Modern Glass Header */}
      <motion.header 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="sticky top-0 z-[60] py-4"
      >
        <div className="container mx-auto px-6">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-3xl border border-white/40 dark:border-white/5 rounded-[2.5rem] shadow-[0_15px_30px_-5px_rgba(0,0,0,0.08)] px-8 h-20 sm:h-24 flex items-center justify-between gap-8 flex-row-reverse">
                 <div className="flex items-center gap-4">
                    <button onClick={() => setIsCartOpen(true)} className="group relative p-4.5 bg-slate-950 text-white dark:bg-white dark:text-slate-950 rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all">
                        <ShoppingCart size={22} strokeWidth={2.5} />
                        {cart.length > 0 && (
                            <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-[11px] font-black w-7 h-7 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-900 shadow-2xl">
                                {cart.reduce((a, c) => a + c.quantity, 0)}
                            </span>
                        )}
                    </button>
                    <div className="hidden sm:flex flex-col text-right mr-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">سلة التسوق</span>
                        <span className="text-xs font-black text-slate-900 dark:text-white">{cart.reduce((a, c) => a + (c.price * c.quantity), 0).toLocaleString()} ج.م</span>
                    </div>
                 </div>

                 <div className="hidden lg:flex items-center gap-12 font-black text-[13px] uppercase tracking-wider">
                    {customization.navigationLinks?.map((link, idx) => (
                        <a key={idx} href={link.url} className="text-slate-500 hover:text-slate-950 dark:hover:text-white transition-all hover:translate-y-[-2px]">{link.label}</a>
                    ))}
                 </div>

                 <a href="/" className="flex items-center gap-3 group">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white scale-90 sm:scale-100 group-hover:rotate-12 transition-transform">
                        <StoreIcon size={24} />
                    </div>
                    {customization.logoUrl ? (
                        <img 
                            src={customization.logoUrl} 
                            alt={activeStore?.name} 
                            className="h-10 sm:h-12 object-contain" 
                            referrerPolicy="no-referrer"
                        />
                    ) : (
                        <span className="text-3xl font-black tracking-[-10][0.06em] text-slate-950 dark:text-white sm:inline hidden uppercase">
                            {activeStore?.name || 'VOGUE'}
                        </span>
                    )}
                 </a>
            </div>
        </div>
      </motion.header>

      <main className="flex-grow">
        <HeroSection customization={customization} />
        
        {/* Animated Feature Grid */}
        <div className="py-24 bg-slate-50/50 dark:bg-slate-950/20">
            <div className="container mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-12 text-right">
                {[
                    { icon: <Truck size={32} strokeWidth={1} />, title: "توصيل استثنائي", desc: "لباب بيتك في أسرع وقت" },
                    { icon: <ShieldCheck size={32} strokeWidth={1} />, title: "ضمان حقيقي", desc: "حقك محفوظ دائمـاً معنا" },
                    { icon: <RefreshCw size={32} strokeWidth={1} />, title: "تبديل مرن", desc: "سياسة استرجاع مريحة جداً" },
                    { icon: <CreditCard size={32} strokeWidth={1} />, title: "دفعات آمنة", desc: "نأنظمة تشفير بنكية عالمية" }
                ].map((item, i) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 }}
                        key={i} 
                        className="flex flex-col items-center lg:items-end text-center lg:text-right"
                    >
                        <div className="p-6 bg-white dark:bg-slate-900 rounded-[2rem] mb-6 text-indigo-600 dark:text-indigo-400 shadow-xl shadow-slate-100 dark:shadow-none border border-slate-50 dark:border-slate-800 hover:rotate-6 transition-transform">
                            {item.icon}
                        </div>
                        <h4 className="font-black text-lg text-slate-900 dark:text-white mb-2">{item.title}</h4>
                        <p className="text-sm font-bold text-slate-400 leading-relaxed">{item.desc}</p>
                    </motion.div>
                ))}
            </div>
        </div>

        <ProductsSection 
          settings={settings} 
          searchTerm={searchTerm} 
          customization={customization} 
          onAddToCart={onAddToCart} 
          onReview={openReviewModal} 
          onViewProduct={setSelectedProduct} 
        />
        
        {/* CTA Section */}
        <div className="container mx-auto px-6 py-32">
            <div className="bg-slate-950 rounded-[4rem] p-12 lg:p-24 overflow-hidden relative group">
                <div className="absolute top-0 left-0 w-full h-full opacity-30 bg-cover bg-center transition-transform duration-[10s] group-hover:scale-125" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?q=80&w=2070)' }} />
                <div className="absolute inset-0 bg-indigo-900/60 mix-blend-multiply" />
                
                <div className="relative z-10 text-center max-w-4xl mx-auto">
                    <span className="text-xs font-black uppercase text-indigo-300 tracking-[0.4em] mb-8 block">هل أنت جاهز للتميز؟</span>
                    <h2 className="text-4xl md:text-7xl font-black text-white mb-12 tracking-tighter leading-tight">ابدأ رحلتك في عالم الموضة الاستثنائية اليوم!</h2>
                    <button className="px-16 py-6 bg-white text-slate-950 rounded-full font-black text-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all">تصفح الفئات الجديدة</button>
                </div>
            </div>
        </div>
      </main>

      <footer className="bg-white dark:bg-slate-900 pt-32 pb-16">
          <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-20 mb-32 text-right">
              <div className="lg:col-span-1">
                 <div className="flex items-center gap-3 mb-8 justify-end">
                    <span className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{activeStore?.name}</span>
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl" />
                 </div>
                 <p className="text-lg text-slate-500 leading-relaxed font-medium mb-12">{customization.footerText || 'نوفر لك تجربة تسوق لا تنسى تجمع بين الأصالة والمعاصرة في متجر واحد متكامل.'}</p>
                 <div className="flex gap-4 justify-end">
                    {[<Facebook key="fb"/>, <Instagram key="ig"/>, <Twitter key="tw"/>].map((icon, i) => (
                        <a key={i} href="#" className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-950 hover:text-white transition-all shadow-sm">
                            {React.cloneElement(icon as React.ReactElement<any>, { size: 24 })}
                        </a>
                    ))}
                 </div>
              </div>
              
              <div>
                  <h4 className="text-xl font-black text-slate-900 dark:text-white mb-10">المتجر الذكي</h4>
                  <ul className="space-y-5 text-sm font-black text-slate-400">
                      <li><a href="#" className="hover:text-indigo-600 transition-colors">عن رحلتنا</a></li>
                      <li><a href="#" className="hover:text-indigo-600 transition-colors">صناع الجودة</a></li>
                      <li><a href="#" className="hover:text-indigo-600 transition-colors">سياسة البيانات</a></li>
                      <li><a href="#" className="hover:text-indigo-600 transition-colors">وظائف متاحة</a></li>
                  </ul>
              </div>
              
              <div>
                  <h4 className="text-xl font-black text-slate-900 dark:text-white mb-10">الدعم الفني</h4>
                  <ul className="space-y-5 text-sm font-black text-slate-400">
                      <li><a href="#" className="hover:text-indigo-600 transition-colors">تتبع الطلبات</a></li>
                      <li><a href="#" className="hover:text-indigo-600 transition-colors">تواصل مباشر</a></li>
                      <li><a href="#" className="hover:text-indigo-600 transition-colors">مراكز التوزيع</a></li>
                      <li><a href="#" className="hover:text-indigo-600 transition-colors">الشكاوى والمقترحات</a></li>
                  </ul>
              </div>

              <div>
                  <h4 className="text-xl font-black text-slate-900 dark:text-white mb-10">انضم لنادينا</h4>
                  <p className="text-sm font-bold text-slate-500 mb-8 max-w-xs">احصل على وصول حصري للمجموعات الجديدة قبل الجميع.</p>
                  <div className="relative">
                      <input type="email" placeholder="بريدك الإلكتروني..." className="w-full bg-slate-50 dark:bg-slate-800 py-6 px-10 rounded-[2rem] text-sm font-black outline-none border-2 border-transparent focus:border-indigo-600 transition-all text-right shadow-inner" />
                      <button className="absolute left-3 top-3 w-12 h-12 bg-slate-950 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-600 transition-colors"><ArrowRight size={20}/></button>
                  </div>
              </div>
          </div>
          
          <div className="container mx-auto px-6 pt-16 border-t border-slate-50 dark:border-slate-800 text-center flex flex-col md:flex-row justify-between items-center gap-8">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest order-last md:order-first">© {new Date().getFullYear()} {activeStore?.name}. بـكل فخـر صنع في مصـر.</p>
              <div className="flex gap-4 items-center">
                  <div className="h-4 w-8 bg-slate-100 dark:bg-slate-800 rounded-sm" />
                  <div className="h-4 w-8 bg-slate-100 dark:bg-slate-800 rounded-sm" />
                  <div className="h-4 w-8 bg-slate-100 dark:bg-slate-800 rounded-sm" />
              </div>
          </div>
      </footer>

      <CartSidebar 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        cart={cart} 
        onUpdateQuantity={onUpdateCartQuantity} 
        onRemoveItem={onRemoveFromCart} 
        primaryColor={customization.primaryColor || '#6366f1'} 
      />
      
      <AnimatePresence>
        {reviewModalOpen && selectedProductForReview && (
            <ReviewModal 
                productId={selectedProductForReview.id} 
                productName={selectedProductForReview.name}
                onClose={() => setReviewModalOpen(false)} 
                onSubmit={handleReviewSubmit} 
            />
        )}
        {selectedProduct && (
            <ProductDetailModal 
                product={selectedProduct} 
                allProducts={settings.products} 
                allReviews={settings.reviews || []}
                customization={customization}
                onClose={() => setSelectedProduct(null)}
                onAddToCart={onAddToCart}
                onSelectProduct={setSelectedProduct}
            />
        )}
      </AnimatePresence>
    </div>
  );
};

export default StorefrontPage;
