import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingCart, 
  Heart, 
  Share2, 
  Star, 
  Check, 
  Truck, 
  ShieldCheck, 
  RotateCcw, 
  Package, 
  ChevronRight, 
  Plus, 
  Minus, 
  Zap, 
  MessageCircle, 
  ArrowLeft, 
  CheckCircle2, 
  Copy,
  Store as StoreIcon,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';
import { Settings, Store, Product, OrderItem, Review } from '../types';
import CartSidebar from './CartSidebar';
import { generateSlug, getProductUrl } from '../utils/slugUtils';
import { ProductImage } from './ProductImage';

interface ProductDetailPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  activeStore?: Store;
  cart: OrderItem[];
  onAddToCart: (product: Product, quantity?: number) => void;
  onUpdateCartQuantity: (productId: string, quantity: number) => void;
  onRemoveFromCart: (productId: string) => void;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  settings,
  setSettings,
  activeStore,
  cart,
  onAddToCart,
  onUpdateCartQuantity,
  onRemoveFromCart
}) => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Review submission states
  const [reviewName, setReviewName] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  // Find product by slug or id
  const product = useMemo(() => {
    if (!slug) return null;
    const decodedSlug = decodeURIComponent(slug).toLowerCase().trim();
    return settings.products.find(p => {
      const pSlug = (p.slug || generateSlug(p.name)).toLowerCase().trim();
      return pSlug === decodedSlug || p.id === slug || p.sku?.toLowerCase() === decodedSlug;
    }) || null;
  }, [settings.products, slug]);

  // Update browser tab title for SEO
  useEffect(() => {
    if (product) {
      const storeTitle = activeStore?.name || (settings as any)?.storeName || 'المتجر الإلكتروني';
      document.title = `${product.name} | ${storeTitle}`;
    }
  }, [product, activeStore, settings]);

  const images = useMemo(() => {
    if (!product) return [];
    return [product.thumbnail, ...(product.images || [])].filter(Boolean) as string[];
  }, [product]);

  const productReviews = useMemo(() => {
    if (!product) return [];
    return (settings.reviews || []).filter(r => r.productId === product.id && r.status === 'approved');
  }, [settings.reviews, product]);

  const averageRating = useMemo(() => {
    if (productReviews.length === 0) return 5;
    return productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length;
  }, [productReviews]);

  // Related products in the same category or random
  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return settings.products
      .filter(p => p.id !== product.id && (p.category === product.category || !product.category))
      .slice(0, 4);
  }, [settings.products, product]);

  const primaryColor = settings.customization?.primaryColor || '#059669';
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const isNestedStorePath = Boolean(activeStore?.id && window.location.pathname.startsWith('/store/'));
  const storeHomeUrl = isNestedStorePath ? `/store/${activeStore?.id}/store` : '/store';
  const checkoutUrl = isNestedStorePath ? `/store/${activeStore?.id}/checkout` : '/checkout';

  const handleAddToCartClick = () => {
    if (!product) return;
    onAddToCart(product, quantity);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2500);
  };

  const handleBuyNow = () => {
    if (!product) return;
    onAddToCart(product, quantity);
    navigate(checkoutUrl);
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setIsSubmittingReview(true);
    
    const newReview: Review = {
      id: Date.now().toString(),
      productId: product.id,
      customerName: reviewName.trim() || 'عميل موثق',
      rating: reviewRating,
      comment: reviewComment.trim(),
      date: new Date().toISOString(),
      status: 'approved'
    };

    setSettings(prev => ({
      ...prev,
      reviews: [...(prev.reviews || []), newReview]
    }));

    setIsSubmittingReview(false);
    setReviewSuccess(true);
    setReviewName('');
    setReviewComment('');
    setTimeout(() => setReviewSuccess(false), 4000);
  };

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-slate-300 shadow-md mb-6">
          <Package size={40} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">عذراً، هذا المنتج غير متوفر</h1>
        <p className="text-xs sm:text-sm text-slate-500 font-bold mb-8 max-w-sm">
          قد يكون تم حذف المنتج أو أن الرابط غير صحيح. يمكنك تصفح باقي المنتجات المتاحة في المتجر.
        </p>
        <Link
          to="/store"
          className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          <span>تصفح جميع المنتجات</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased" dir="rtl">
      {/* Top Header */}
      <header className="sticky top-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="container mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
          <Link to={storeHomeUrl} className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs" style={{ backgroundColor: primaryColor }}>
              <StoreIcon size={20} />
            </div>
            <span className="font-black text-sm sm:text-lg text-slate-900 tracking-tight">
              {activeStore?.name || 'متجرنا الإلكتروني'}
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleShare}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="مشاركة رابط المنتج"
            >
              {copiedLink ? <Check size={16} className="text-emerald-600" /> : <Share2 size={16} />}
              <span className="hidden sm:inline">{copiedLink ? 'تم نسخ الرابط' : 'مشاركة'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 sm:px-4 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer"
              style={{ backgroundColor: primaryColor }}
            >
              <ShoppingCart size={18} />
              <span className="hidden sm:inline">السلة</span>
              {cartCount > 0 && (
                <span className="bg-white text-emerald-800 text-[11px] font-black px-2 py-0.2 rounded-full shadow-xs">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Product Details View */}
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 flex-grow max-w-6xl">
        {/* Breadcrumbs Navigation */}
        <nav className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-6 sm:mb-8 overflow-x-auto pb-1 no-scrollbar">
          <Link to={storeHomeUrl} className="hover:text-slate-700 transition-colors">الرئيسية</Link>
          <ChevronRight size={14} className="rotate-180 text-slate-300" />
          {product.category && (
            <>
              <span className="hover:text-slate-700">{product.category}</span>
              <ChevronRight size={14} className="rotate-180 text-slate-300" />
            </>
          )}
          <span className="text-slate-900 truncate max-w-xs">{product.name}</span>
        </nav>

        {/* Product Grid: Media Gallery (Left in RTL) + Buying Box (Right in RTL) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Gallery Images Column (6 of 12) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="relative aspect-square w-full bg-white rounded-3xl border border-slate-200/80 shadow-sm p-4 sm:p-8 flex items-center justify-center overflow-hidden">
              <ProductImage
                src={images[selectedImageIndex] || product.thumbnail}
                alt={product.name}
                containerClassName="w-full h-full max-h-[460px] drop-shadow-md flex items-center justify-center"
                className="w-full h-full object-contain"
                aspectRatio="square"
                priority={true}
              />
              <span className="absolute top-4 right-4 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5 z-10">
                <Sparkles size={13} className="text-emerald-600" />
                منتج أصلي معتمد
              </span>
            </div>

            {/* Thumbnail switcher if multiple images exist */}
            {images.length > 1 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`w-20 h-20 rounded-2xl bg-white border-2 p-1.5 shrink-0 transition-all cursor-pointer overflow-hidden ${
                      selectedImageIndex === idx
                        ? 'border-emerald-600 shadow-md ring-2 ring-emerald-600/20'
                        : 'border-slate-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <ProductImage src={img} alt="" containerClassName="w-full h-full rounded-xl" aspectRatio="square" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details & Purchase Column (6 of 12) */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
              {/* Product Header */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  {product.category && (
                    <span className="text-[11px] font-black uppercase text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl">
                      {product.category}
                    </span>
                  )}
                  {product.sku && (
                    <span className="text-[11px] font-mono font-bold text-slate-400">
                      كود: {product.sku}
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-snug">
                  {product.name}
                </h1>

                {/* Star rating */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={16} fill={i < Math.round(averageRating) ? "currentColor" : "none"} className={i < Math.round(averageRating) ? "" : "text-slate-200"} />
                    ))}
                  </div>
                  <span className="text-xs font-black text-slate-700">{averageRating.toFixed(1)}</span>
                  <span className="text-xs text-slate-400">({productReviews.length} تقييمات معتمدة)</span>
                </div>
              </div>

              {/* Price Display */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-baseline justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 font-bold block mb-0.5">السعر الحالي:</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl sm:text-4xl font-black text-emerald-700 font-mono">
                      {(product.price ?? 0).toLocaleString()}
                    </span>
                    <span className="text-sm font-black text-slate-500">ج.م</span>
                  </div>
                </div>

                <div className="text-left">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-black rounded-full">
                    <CheckCircle2 size={13} />
                    جاهز للشحن الفوري
                  </span>
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">الكمية المطلوبة:</label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-slate-100 rounded-2xl p-1 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="p-2.5 rounded-xl hover:bg-white text-slate-600 transition-colors cursor-pointer"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-12 text-center font-mono font-black text-base">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity(quantity + 1)}
                      className="p-2.5 rounded-xl hover:bg-white text-slate-600 transition-colors cursor-pointer"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  <span className="text-xs text-slate-400 font-medium">
                    الإجمالي: <strong className="text-slate-900 font-mono">{(product.price * quantity).toLocaleString()} ج.م</strong>
                  </span>
                </div>
              </div>

              {/* Purchase Action Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-base shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/35 transition-all flex items-center justify-center gap-3 active:scale-[0.98] cursor-pointer"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Zap size={20} className="text-amber-300" />
                  <span>شراء الآن (طلب مباشر)</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddToCartClick}
                  className={`w-full py-3.5 px-6 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 transition-all border-2 active:scale-[0.98] cursor-pointer ${
                    isAdded
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-500 shadow-sm'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                  }`}
                >
                  {isAdded ? <CheckCircle2 size={18} className="text-emerald-600" /> : <ShoppingCart size={18} />}
                  <span>{isAdded ? 'تمت الإضافة للسلة بنجاح 🎉' : 'إضافة إلى سلة التسوق'}</span>
                </button>
              </div>

              {/* Guarantees Badges */}
              <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100 text-center">
                <div className="p-3 bg-slate-50 rounded-2xl space-y-1">
                  <Truck size={18} className="mx-auto text-slate-500" />
                  <span className="text-[10px] font-black text-slate-800 block">شحن سريع</span>
                  <span className="text-[9px] text-slate-400 block">خلال 24-48 ساعة</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl space-y-1">
                  <ShieldCheck size={18} className="mx-auto text-slate-500" />
                  <span className="text-[10px] font-black text-slate-800 block">معاينة قبل الدفع</span>
                  <span className="text-[9px] text-slate-400 block">فحص المنتج عند الاستلام</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl space-y-1">
                  <RotateCcw size={18} className="mx-auto text-slate-500" />
                  <span className="text-[10px] font-black text-slate-800 block">ضمان الاستبدال</span>
                  <span className="text-[9px] text-slate-400 block">14 يوم استرجاع</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Description Full Box */}
        <section className="mt-12 bg-white p-6 sm:p-10 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Info size={20} className="text-emerald-600" />
            <span>تفاصيل ومواصفات المنتج</span>
          </h3>
          <div 
            className="text-sm sm:text-base text-slate-700 leading-loose font-medium prose max-w-none"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description || 'منتج أصلي عالي الجودة.') }}
          />
        </section>

        {/* Customer Reviews & Form Section */}
        <section className="mt-12 bg-white p-6 sm:p-10 rounded-3xl border border-slate-200/80 shadow-sm space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <h3 className="text-xl font-black text-slate-900">تقييمات وآراء العملاء</h3>
              <p className="text-xs text-slate-400 mt-0.5">تجارب حقيقية من مشترين موثقين</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black text-amber-500">{averageRating.toFixed(1)}</span>
              <div>
                <div className="flex text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={15} fill={i < Math.round(averageRating) ? "currentColor" : "none"} />
                  ))}
                </div>
                <span className="text-[11px] text-slate-400 font-bold">{productReviews.length} تقييم</span>
              </div>
            </div>
          </div>

          {/* Add Review Form */}
          <form onSubmit={handleReviewSubmit} className="p-5 sm:p-6 bg-slate-50 rounded-2xl space-y-4">
            <h4 className="text-sm font-black text-slate-800">أضف تقييمك للمنتج</h4>
            
            {reviewSuccess && (
              <div className="p-3 bg-emerald-100 text-emerald-800 text-xs font-black rounded-xl">
                🎉 شكراً لك! تم اعتماد تقييمك بنجاح.
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">درجة التقييم:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="p-1 text-amber-400 transition-transform hover:scale-125"
                  >
                    <Star size={24} fill={star <= reviewRating ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={reviewName}
                onChange={e => setReviewName(e.target.value)}
                placeholder="اسمك الكريم"
                className="p-3 bg-white rounded-xl border border-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="text"
                required
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                placeholder="اكتب رأيك بالتفصيل..."
                className="p-3 bg-white rounded-xl border border-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingReview}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition-all"
            >
              نشر التقييم
            </button>
          </form>

          {/* Reviews List */}
          <div className="space-y-4">
            {productReviews.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-6">لا توجد تقييمات سابقة بعد. كن أول من يقيم هذا المنتج!</p>
            ) : (
              productReviews.map(r => (
                <div key={r.id} className="p-4 bg-slate-50 rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-slate-900">{r.customerName}</span>
                    <div className="flex text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={12} fill={i < r.rating ? "currentColor" : "none"} />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{r.comment}</p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Related Products Grid */}
        {relatedProducts.length > 0 && (
          <section className="mt-16 space-y-6">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900">منتجات قد تعجبك أيضاً</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {relatedProducts.map(rel => (
                <Link
                  key={rel.id}
                  to={getProductUrl(rel, activeStore?.id)}
                  className="group bg-white p-4 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all space-y-3"
                >
                  <div className="aspect-square bg-slate-50 rounded-2xl overflow-hidden p-2">
                    <img
                      src={rel.thumbnail || `https://picsum.photos/400/400?random=${rel.id}`}
                      alt={rel.name}
                      className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <h4 className="font-black text-xs text-slate-900 line-clamp-2 h-9 leading-snug">
                    {rel.name}
                  </h4>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="font-mono font-black text-base text-emerald-700">
                      {(rel.price ?? 0).toLocaleString()} ج.م
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 group-hover:underline">
                      عرض التفاصيل ←
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Cart Drawer */}
      <CartSidebar
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={onUpdateCartQuantity}
        onRemoveItem={onRemoveFromCart}
        primaryColor={primaryColor}
      />
    </div>
  );
};

export default ProductDetailPage;
