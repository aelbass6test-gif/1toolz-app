import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { Settings, Store, Product, StoreCustomization, OrderItem, Review, Order, CustomerProfile } from '../types';
import { 
  ShoppingCart, 
  Package, 
  Search, 
  Facebook, 
  Instagram, 
  Twitter, 
  MessageCircle, 
  ArrowDown, 
  CheckCircle, 
  Star, 
  X, 
  LayoutGrid, 
  ChevronLeft, 
  ChevronRight, 
  ArrowRight, 
  ArrowLeft, 
  RefreshCw, 
  Info, 
  ShieldCheck, 
  Truck, 
  RotateCcw, 
  CreditCard, 
  Heart, 
  Store as StoreIcon, 
  Phone, 
  Mail, 
  LayoutDashboard, 
  Palette, 
  ExternalLink, 
  Eye, 
  User, 
  Zap, 
  Sparkles,
  ShoppingBag,
  SlidersHorizontal
} from 'lucide-react';
import CartSidebar from './CartSidebar';
import { SmartUpdatesWidget } from './SmartUpdatesWidget';
import { motion, AnimatePresence } from 'motion/react';
import { CustomerAuthModal, StoreCustomer } from './storefront/CustomerAuthModal';
import { generateSlug, getProductUrl } from '../utils/slugUtils';
import { ProductImage } from './ProductImage';

interface StorefrontPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  activeStore: Store | undefined;
  cart: OrderItem[];
  orders?: Order[];
  customers?: CustomerProfile[];
  onAddToCart: (product: Product) => void;
  onUpdateCartQuantity: (productId: string, quantity: number) => void;
  onRemoveFromCart: (productId: string) => void;
}

const ProductReviewDisplay = ({ reviews }: { reviews: Review[] }) => {
  if (reviews.length === 0) {
    return (
      <div className="py-12 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
          <MessageCircle className="text-slate-300" size={32} />
        </div>
        <h4 className="font-black text-slate-800 mb-1">لا توجد تقييمات حتى الآن</h4>
        <p className="text-slate-500 text-sm max-w-[200px] mx-auto">كن أول من يشارك تجربته مع هذا المنتج الرائع!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {reviews.map((review) => (
        <div 
          key={review.id} 
          className="group p-6 bg-white rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:shadow-xl"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-emerald-200">
                {review.customerName.charAt(0)}
              </div>
              <div className="text-right">
                <h4 className="font-black text-base">{review.customerName}</h4>
                <div className="flex text-amber-500 mt-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} fill={i < review.rating ? "currentColor" : "none"} className={i < review.rating ? "" : "text-slate-200"} />
                  ))}
                </div>
              </div>
            </div>
            <span className="text-[10px] bg-slate-100 px-3 py-1 rounded-full text-slate-400 font-black uppercase tracking-wider">
              {new Date(review.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
            </span>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed pr-2 border-r-2 border-emerald-100">{review.comment}</p>
        </div>
      ))}
    </div>
  );
};

const ReviewModal = ({ 
  productId, 
  productName, 
  onClose, 
  onSubmit 
}: { 
  productId: string; 
  productName: string; 
  onClose: () => void; 
  onSubmit: (review: Omit<Review, 'id' | 'status' | 'date'>) => void; 
}) => {
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
        className="bg-white w-full max-w-xl rounded-[3rem] p-8 sm:p-12 text-right shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] relative overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 to-amber-600" />
        <div className="flex justify-between items-start mb-10">
          <button onClick={onClose} className="p-3 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors cursor-pointer">
            <X className="text-slate-400" size={24} />
          </button>
          <div className="text-right">
            <h3 className="font-black text-3xl text-slate-900 mb-2 leading-none">ضع رأيك في المنتج</h3>
            <p className="text-sm text-slate-500 font-bold">{productName}</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="flex flex-col items-center justify-center gap-4 py-8 bg-slate-50 rounded-[2.5rem] border border-slate-200">
            <div className="flex gap-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button 
                  key={star} 
                  type="button" 
                  onMouseEnter={() => setRating(star)} 
                  onClick={() => setRating(star)} 
                  className="focus:outline-none transition-all hover:scale-125 cursor-pointer"
                >
                  <Star size={48} fill={star <= rating ? "#f59e0b" : "none"} className={star <= rating ? "text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]" : "text-slate-200"} />
                </button>
              ))}
            </div>
            <span className="text-lg font-black text-amber-600 tracking-tight">
              {rating === 5 ? 'تجربة ممتازة! ⭐⭐⭐⭐⭐' : rating === 4 ? 'راضٍ جداً عن المنتج 😊' : rating === 3 ? 'منتج جيد وعملي ✅' : rating === 2 ? 'هناك ملاحظات بسيطة ⚠️' : 'لم يعجبني للأسف ❌'}
            </span>
          </div>

          <div className="space-y-6">
            <div className="relative group">
              <input 
                type="text" 
                required 
                className="w-full pt-8 pb-4 px-6 bg-slate-50 border-2 border-transparent focus:border-emerald-600 focus:bg-white outline-none rounded-3xl transition-all font-black text-slate-900" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="اسمك الكريم"
              />
            </div>
            <div className="relative group">
              <textarea 
                required 
                className="w-full pt-8 pb-4 px-6 bg-slate-50 border-2 border-transparent focus:border-emerald-600 focus:bg-white outline-none rounded-3xl transition-all font-bold text-slate-900 h-36 resize-none" 
                value={comment} 
                onChange={e => setComment(e.target.value)} 
                placeholder="اكتب تفاصيل تجربتك مع المنتج..."
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting} 
            className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[2rem] font-black text-lg shadow-2xl shadow-emerald-500/30 flex items-center justify-center gap-3 transform active:scale-95 transition-all disabled:opacity-70 cursor-pointer"
          >
            {isSubmitting ? <RefreshCw size={22} className="animate-spin" /> : <><CheckCircle size={22} /> <span>اعتماد التقييم</span></>}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
};

const ProductCard: React.FC<{ 
  product: Product; 
  customization: StoreCustomization; 
  activeStoreId?: string;
  onAddToCart: (product: Product) => void; 
  onBuyNow: (product: Product) => void;
  onReview: (id: string, name: string) => void; 
  reviews: Review[]; 
  onQuickView: () => void; 
}> = ({ 
  product, 
  customization, 
  activeStoreId,
  onAddToCart, 
  onBuyNow,
  onReview, 
  reviews, 
  onQuickView 
}) => {
  const navigate = useNavigate();
  const [isAdded, setIsAdded] = useState(false);
  const productReviews = reviews.filter(r => r.productId === product.id && r.status === 'approved');
  const averageRating = productReviews.length > 0 
    ? productReviews.reduce((acc, r) => acc + r.rating, 0) / productReviews.length 
    : 5;

  const productUrl = getProductUrl(product, activeStoreId);

  const handleCardClick = (e: React.MouseEvent) => {
    // Navigate to full product page
    navigate(productUrl);
  };

  const handleAddToCartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToCart(product);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  const handleBuyNowClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onBuyNow(product);
  };

  const handleQuickViewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onQuickView();
  };

  const primaryColor = customization.primaryColor || '#059669';

  return (
    <motion.div 
      whileHover={{ y: -8 }} 
      className="group relative overflow-hidden flex flex-col bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Product Image Box */}
      <div className="relative aspect-[4/4] overflow-hidden bg-slate-50 p-3">
        <ProductImage 
          src={product.thumbnail || product.images?.[0]} 
          alt={product.name} 
          containerClassName="w-full h-full rounded-2xl transition-transform duration-700 group-hover:scale-105" 
          aspectRatio="square"
        />
        
        {/* Rating badge */}
        <div className="absolute top-5 right-5">
          <div className="bg-white/95 backdrop-blur-md px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-md border border-slate-100 text-xs font-black">
            <Star size={13} className="text-amber-500 fill-amber-500"/>
            <span>{averageRating.toFixed(1)}</span>
          </div>
        </div>

        {/* Quick View Button on Hover */}
        <button
          type="button"
          onClick={handleQuickViewClick}
          className="absolute top-5 left-5 p-2 rounded-xl bg-white/90 hover:bg-white text-slate-700 shadow-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
          title="معاينة سريعة"
        >
          <Eye size={15} />
        </button>
      </div>

      {/* Product Info */}
      <div className="p-5 flex flex-col flex-grow text-right space-y-3">
        <h3 className="font-black text-base line-clamp-2 text-slate-900 h-11 leading-snug hover:text-emerald-700 transition-colors">
          {product.name}
        </h3>

        <div className="flex items-baseline justify-between pt-1">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
              {(product.price ?? 0).toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-400">ج.م</span>
          </div>
          {product.category && (
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
              {product.category}
            </span>
          )}
        </div>

        {/* Action Buttons: Add to Cart + Buy Now */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleAddToCartClick}
            className={`py-2.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
              isAdded 
                ? 'bg-emerald-600 text-white shadow-sm' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
            }`}
          >
            {isAdded ? <CheckCircle size={15} /> : <ShoppingCart size={15} />}
            <span>{isAdded ? 'تمت الإضافة' : 'أضف للسلة'}</span>
          </button>

          <button
            type="button"
            onClick={handleBuyNowClick}
            className="py-2.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
            style={{ backgroundColor: primaryColor }}
          >
            <Zap size={14} className="text-amber-300" />
            <span>شراء فوري</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const Header: React.FC<{ 
  customization: StoreCustomization; 
  activeStore: Store | undefined; 
  cartCount: number; 
  onOpenCart: () => void;
  onOpenAccount: () => void;
  customerSession: StoreCustomer | null;
}> = ({ 
  customization, 
  activeStore, 
  cartCount, 
  onOpenCart,
  onOpenAccount,
  customerSession 
}) => {
  const primaryColor = customization.primaryColor || '#059669';

  return (
    <header className="sticky top-0 w-full z-[80] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-xs">
      <div className="container mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
        {/* Left: Cart & Customer Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Cart button */}
          <button 
            type="button"
            onClick={onOpenCart} 
            className="group relative px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-md shadow-emerald-600/20 flex items-center gap-2.5 transition-all active:scale-95 cursor-pointer"
            style={{ backgroundColor: primaryColor }}
            title="فتح سلة المشتريات"
          >
            <ShoppingCart size={19} />
            <span className="text-xs font-black hidden sm:inline">السلة</span>
            {cartCount > 0 && (
              <span className="bg-white text-emerald-800 text-xs font-black px-2 py-0.5 rounded-full shadow-xs">
                {cartCount}
              </span>
            )}
          </button>

          {/* Customer Profile / Sign In */}
          <button
            type="button"
            onClick={onOpenAccount}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer"
            title="حسابي ومتابعة الطلبات"
          >
            <User size={17} className="text-slate-500" />
            <span className="hidden sm:inline">
              {customerSession ? customerSession.name.split(' ')[0] : 'تسجيل الدخول / حسابي'}
            </span>
          </button>
        </div>

        {/* Center: Navigation Links */}
        <div className="hidden md:flex items-center gap-8 font-black text-xs text-slate-600 dark:text-slate-300">
          <a href="#products-section" className="hover:text-emerald-600 transition-colors">المنتجات</a>
          <a href="#about-us-section" className="hover:text-emerald-600 transition-colors">من نحن</a>
          <Link to="/track-order" className="hover:text-emerald-600 transition-colors">تتبع شحنتك 🚚</Link>
        </div>

        {/* Right: Store Brand & Logo */}
        <Link to="/store" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md" style={{ backgroundColor: primaryColor }}>
            <StoreIcon size={22} />
          </div>
          <div className="text-right">
            <h1 className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              {activeStore?.name || 'متجرنا الإلكتروني'}
            </h1>
            <p className="text-[10px] text-slate-400 font-bold hidden sm:block">تجربة تسوق آمنة وسريعة</p>
          </div>
        </Link>
      </div>
    </header>
  );
};

const HeroSection: React.FC<{ customization: StoreCustomization }> = ({ customization }) => {
  const banners = customization.banners || [];
  const [currentIndex, setCurrentIndex] = useState(0);

  if (banners.length === 0) {
    return (
      <div className="relative py-20 sm:py-28 bg-gradient-to-b from-emerald-950 via-slate-900 to-slate-950 text-white text-center px-4 overflow-hidden">
        <div className="max-w-3xl mx-auto space-y-6 relative z-10">
          <span className="px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black uppercase tracking-wider inline-block">
            ✨ مرحباً بك في متجرنا
          </span>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight">
            أفضل المنتجات بأعلى جودة وأفضل الأسعار!
          </h2>
          <p className="text-sm sm:text-lg text-slate-300 font-medium max-w-xl mx-auto">
            تصفح تشكيلتنا المميزة من المنتجات مع شحن سريع وضمان شامل ومعاينة قبل الاستلام.
          </p>
          <div className="pt-4">
            <a 
              href="#products-section" 
              className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-2xl text-sm sm:text-base shadow-xl shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95"
            >
              <span>تسوق الآن</span>
              <ArrowDown size={18} />
            </a>
          </div>
        </div>
      </div>
    );
  }

  const banner = banners[currentIndex];
  return (
    <div className="relative h-[65vh] sm:h-[75vh] w-full bg-slate-950 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div 
          key={currentIndex} 
          initial={{ opacity: 0, scale: 1.05 }} 
          animate={{ opacity: 1, scale: 1 }} 
          exit={{ opacity: 0 }} 
          transition={{ duration: 0.8 }} 
          className="absolute inset-0 bg-cover bg-center" 
          style={{ backgroundImage: `url(${banner.imageUrl})` }} 
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-black/50" />
      <div className="relative z-10 h-full container mx-auto px-6 flex flex-col items-center justify-center text-center">
        <div className="max-w-3xl space-y-6">
          <h2 className="text-3xl sm:text-5xl md:text-6xl text-white font-black leading-tight tracking-tight">
            {banner.title}
          </h2>
          <p className="text-sm sm:text-lg text-slate-200 font-medium max-w-xl mx-auto">
            {banner.subtitle}
          </p>
          <div className="pt-2">
            <a 
              href={banner.link || "#products-section"} 
              className="inline-flex items-center gap-3 px-8 py-4 bg-white text-slate-950 font-black rounded-2xl text-sm sm:text-base shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              <span>تصفح العروض</span>
              <ArrowRight size={18} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export const StorefrontPage: React.FC<StorefrontPageProps> = ({ 
  settings, 
  setSettings, 
  activeStore, 
  cart, 
  orders = [],
  customers = [],
  onAddToCart, 
  onUpdateCartQuantity, 
  onRemoveFromCart 
}) => { 
  const navigate = useNavigate();
  const location = useLocation();
  const [isCartOpen, setIsCartOpen] = useState(false); 
  const [searchTerm, setSearchTerm] = useState(''); 
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [reviewModalOpen, setReviewModalOpen] = useState(false); 
  const [selectedProductForReview, setSelectedProductForReview] = useState<{id: string, name: string} | null>(null); 
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null); 
  const [isCustomerAuthOpen, setIsCustomerAuthOpen] = useState(false);

  // Active logged-in customer session
  const [customerSession, setCustomerSession] = useState<StoreCustomer | null>(() => {
    try {
      const saved = localStorage.getItem('storefront_logged_customer');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const customization = settings.customization; 
  const cartCount = cart.reduce((a, c) => a + c.quantity, 0); 
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const primaryColor = customization.primaryColor || '#059669'; 

  // Check if store owner/merchant previewing
  const isOwnerSession = Boolean(localStorage.getItem('currentUser') || localStorage.getItem('owner_authenticated') || activeStore);

  // Dynamically update browser tab title
  useEffect(() => {
    const storeName = activeStore?.name || (settings as any)?.storeName || (activeStore as any)?.settings?.storeName || 'متجري الإلكتروني';
    document.title = `${storeName} | المتجر الإلكتروني`;
  }, [activeStore?.name, settings]);

  const handleReviewSubmit = (review: Omit<Review, 'id' | 'status' | 'date'>) => { 
    const newReview: Review = { ...review, id: Date.now().toString(), date: new Date().toISOString(), status: 'pending' }; 
    setSettings(prevSettings => ({ ...prevSettings, reviews: [...(prevSettings.reviews || []), newReview] })); 
    alert("شكراً لتقييمك الرائع 🤍! تم استلام التقييم وسيظهر في المتجر فوراً."); 
  }; 

  const openReviewModal = (productId: string, productName: string) => { 
    setSelectedProductForReview({ id: productId, name: productName }); 
    setReviewModalOpen(true); 
  }; 

  // Fast direct Buy Now flow
  const handleDirectBuyNow = (product: Product) => {
    onAddToCart(product);
    navigate('/checkout');
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    (settings.products || []).forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [settings.products]);

  const filteredProducts = useMemo(() => { 
    return (settings.products || []).filter(p => { 
      const matchesSearch = !searchTerm.trim() || p.name.toLowerCase().includes(searchTerm.toLowerCase()); 
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      return matchesSearch && matchesCategory; 
    }); 
  }, [settings.products, searchTerm, selectedCategory]); 

  return ( 
    <div 
      className="min-h-screen flex flex-col antialiased overflow-x-hidden bg-slate-50 text-slate-900" 
      dir="rtl"
      style={{ fontFamily: customization.fontFamily || 'Tajawal, sans-serif' }}
    > 
      {/* Merchant Top Bar */}
      {isOwnerSession && (
        <div className="sticky top-0 z-[120] bg-slate-900/95 backdrop-blur-md text-white px-3 sm:px-6 py-2.5 text-xs border-b border-slate-800 shadow-lg flex items-center justify-between gap-3 font-sans select-none">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-black text-amber-400">معاينة المتجر المباشر:</span>
            <span className="hidden sm:inline text-slate-300 font-bold">أنت تشاهد متجرك الآن كما يراه العميل الحقيقي</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate(activeStore?.id ? `/store/${activeStore.id}/dashboard` : '/dashboard')}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 font-black shadow-md shadow-emerald-600/30 cursor-pointer"
            >
              <LayoutDashboard size={13} />
              <span>لوحة التحكم 🔙</span>
            </button>
          </div>
        </div>
      )}

      {/* Announcement Bar */}
      {customization.isAnnouncementBarVisible && customization.announcementBarText && ( 
        <div className="bg-emerald-600 text-white py-2.5 text-center text-xs font-black tracking-wider uppercase" style={{ backgroundColor: primaryColor }}> 
          {customization.announcementBarText} 
        </div> 
      )} 

      {/* Main Header */}
      <Header 
        customization={customization} 
        activeStore={activeStore} 
        cartCount={cartCount} 
        onOpenCart={() => setIsCartOpen(true)} 
        onOpenAccount={() => setIsCustomerAuthOpen(true)}
        customerSession={customerSession}
      /> 

      {/* Hero Section */}
      <HeroSection customization={customization} />

      {/* Main Catalog Workspace */}
      <main id="products-section" className="flex-grow container mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Search & Categories Bar */}
        <div className="mb-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-md">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="ابحث عن منتج بالاسم..."
              className="w-full p-3.5 pl-10 bg-white rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
            />
            <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
          </div>

          {/* Category Tabs */}
          {categories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                  selectedCategory === 'all'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                الكل
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Section Heading */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              أحدث المنتجات والعروض
            </h2>
            <p className="text-xs text-slate-500 font-bold mt-1">
              متاح {filteredProducts.length} منتج جاهز للشحن الفوري
            </p>
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <ProductCard 
              key={product.id} 
              product={product} 
              customization={customization} 
              activeStoreId={activeStore?.id}
              onAddToCart={onAddToCart} 
              onBuyNow={handleDirectBuyNow}
              onReview={openReviewModal} 
              reviews={settings.reviews || []} 
              onQuickView={() => setSelectedProduct(product)} 
            />
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-8 space-y-3">
            <Package size={40} className="mx-auto text-slate-300" />
            <h3 className="text-base font-black text-slate-800">لا توجد منتجات مطابقة للبحث</h3>
            <p className="text-xs text-slate-400">جرب البحث بكلمات أخرى أو اختر قسماً مختلفاً.</p>
          </div>
        )}

        {/* About Us Section */}
        {customization.aboutUs?.enabled && (
          <section id="about-us-section" className="mt-20 p-8 sm:p-14 bg-white rounded-3xl border border-slate-200 shadow-xs">
            <div className="max-w-3xl space-y-4">
              <span className="text-xs font-black text-emerald-600 uppercase tracking-widest block">
                {customization.aboutUs?.subtitle || 'من نحن'}
              </span>
              <h3 className="text-2xl sm:text-4xl font-black text-slate-900 leading-tight">
                {customization.aboutUs?.title || 'التزامنا بالجودة ورضا العملاء أولاً'}
              </h3>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-medium">
                {customization.aboutUs?.content || 'نسعى دائماً لتقديم أفضل المنتجات بأعلى معايير الجودة وبأفضل الأسعار التنافسية، مع توفير تجربة تسوق سلسة وخدمة عملاء متواصلة على مدار الساعة.'}
              </p>
            </div>
          </section>
        )}
      </main>

      {/* Floating Bottom Cart Bar (Sticky when cart has items) */}
      {cartCount > 0 && (
        <div className="fixed bottom-5 inset-x-4 max-w-xl mx-auto z-[90] animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-slate-900 text-white p-3.5 sm:p-4 rounded-3xl shadow-2xl border border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
                <ShoppingCart size={20} />
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-300">{cartCount} أصناف في السلة</p>
                <p className="text-base font-black text-emerald-400 font-mono">{cartSubtotal.toLocaleString()} ج.م</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
              >
                عرض السلة
              </button>
              <Link
                to="/checkout"
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-md flex items-center gap-1.5 transition-all active:scale-95"
              >
                <span>إتمام الطلب</span>
                <ArrowLeft size={16} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Store Footer */}
      <footer className="bg-slate-950 text-white pt-16 pb-12 mt-auto">
        <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-10 text-right mb-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
                <StoreIcon size={18} />
              </div>
              <h2 className="text-xl font-black">{activeStore?.name || 'متجرنا'}</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              {customization.footerText || 'نوفر لك تجربة تسوق فريدة تجمع بين الجودة والسرعة والضمان الشامل.'}
            </p>
          </div>

          <div>
            <h4 className="font-black text-sm text-white mb-4">خدمة العملاء</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><Link to="/track-order" className="hover:text-emerald-400 transition-colors">تتبع الشحنة</Link></li>
              <li><button onClick={() => setIsCustomerAuthOpen(true)} className="hover:text-emerald-400 transition-colors">حسابي والطلبات السابقة</button></li>
              <li><a href="#about-us-section" className="hover:text-emerald-400 transition-colors">من نحن والضمان</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-black text-sm text-white mb-4">طرق الدفع والتوصيل</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              الدفع عند الاستلام • فودافون كاش • إنستاباي • توصيل سريع لكافة المحافظات 🚚
            </p>
          </div>
        </div>

        <div className="container mx-auto px-6 pt-6 border-t border-slate-800 text-center text-[11px] text-slate-500 font-bold">
          © {new Date().getFullYear()} {activeStore?.name || 'Store'}. جميع الحقوق محفوظة.
        </div>
      </footer>

      {/* Cart Sidebar Drawer */}
      <CartSidebar 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        cart={cart} 
        onUpdateQuantity={onUpdateCartQuantity} 
        onRemoveItem={onRemoveFromCart} 
        primaryColor={primaryColor} 
      /> 

      {/* Customer Account & Login Modal */}
      <CustomerAuthModal
        isOpen={isCustomerAuthOpen}
        onClose={() => setIsCustomerAuthOpen(false)}
        orders={orders}
        customers={customers}
        onSaveCustomer={(c) => setCustomerSession(c)}
        primaryColor={primaryColor}
        storeName={activeStore?.name || 'متجرنا'}
      />

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <ProductDetailModal 
            product={selectedProduct} 
            allProducts={settings.products || []} 
            allReviews={settings.reviews || []} 
            customization={customization} 
            onClose={() => setSelectedProduct(null)} 
            onAddToCart={onAddToCart} 
            onBuyNow={handleDirectBuyNow}
            onSelectProduct={setSelectedProduct} 
          />
        )}
        {reviewModalOpen && selectedProductForReview && (
          <ReviewModal 
            productId={selectedProductForReview.id} 
            productName={selectedProductForReview.name} 
            onClose={() => setReviewModalOpen(false)} 
            onSubmit={handleReviewSubmit} 
          />
        )}
      </AnimatePresence>
    </div> 
  );
};

const ProductDetailModal: React.FC<{ 
  product: Product; 
  allProducts: Product[]; 
  allReviews: Review[]; 
  customization: StoreCustomization; 
  onClose: () => void; 
  onAddToCart: (product: Product) => void; 
  onBuyNow: (product: Product) => void;
  onSelectProduct: (product: Product) => void; 
}> = ({ 
  product, 
  allProducts, 
  allReviews, 
  customization, 
  onClose, 
  onAddToCart, 
  onBuyNow,
  onSelectProduct 
}) => {
  const [isAdded, setIsAdded] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const images = [product.thumbnail, ...(product.images || [])].filter(Boolean) as string[];
  const productReviews = allReviews.filter(r => r.productId === product.id && r.status === 'approved');
  const averageRating = productReviews.length > 0 
    ? productReviews.reduce((acc, r) => acc + r.rating, 0) / productReviews.length 
    : 5;

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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 sm:p-8" 
      onClick={onClose}
      dir="rtl"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 30 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        exit={{ scale: 0.95, opacity: 0, y: 30 }} 
        className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden relative" 
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 left-4 z-20 p-2.5 bg-white/90 border border-slate-200 rounded-xl text-slate-800 shadow-md cursor-pointer hover:bg-slate-100 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Product Image */}
        <div className="w-full md:w-[45%] bg-slate-50 p-6 flex flex-col items-center justify-center">
          <ProductImage 
            src={images[currentImageIndex] || product.thumbnail} 
            alt={product.name}
            containerClassName="w-full max-h-72 drop-shadow-md rounded-2xl flex items-center justify-center" 
            className="w-full h-full object-contain"
            aspectRatio="auto"
          />
        </div>

        {/* Product Details & Actions */}
        <div className="w-full md:w-[55%] p-6 sm:p-8 overflow-y-auto text-right space-y-6">
          <div>
            <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
              {product.category || 'منتج مميز'}
            </span>
            <h2 className="text-xl sm:text-2xl font-black mt-2 text-slate-900 leading-snug">
              {product.name}
            </h2>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-700 font-mono">
              {(product.price ?? 0).toLocaleString()}
            </span>
            <span className="text-sm font-black text-slate-400">ج.م</span>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 mb-2">وصف المنتج:</h4>
            <div 
              className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium" 
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description || 'منتج أصلي عالي الجودة.') }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button 
              onClick={handleAddToCartClick} 
              className={`py-3.5 px-3 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer ${
                isAdded ? 'bg-emerald-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
              }`}
            >
              {isAdded ? <CheckCircle size={18} /> : <ShoppingCart size={18} />}
              <span>{isAdded ? 'تمت الإضافة للسلة' : 'أضف للسلة'}</span>
            </button>

            <button 
              onClick={() => onBuyNow(product)} 
              className="py-3.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs sm:text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <Zap size={18} className="text-amber-300" />
              <span>شراء الآن</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default StorefrontPage;
