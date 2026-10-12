import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Images, Trash2, Copy, Check, ExternalLink, Search, 
  RefreshCw, Upload, AlertCircle, HardDrive, CheckCircle2,
  Filter, Eye, ArrowUpDown, Sparkles
} from 'lucide-react';
import { Settings, Product } from '../types';
import { deleteProductImage, deleteProductImages, uploadProductImages, compressProductImages } from '../services/mediaUploadService';
import { ProductImage } from './ProductImage';

interface MediaLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  setSettings?: React.Dispatch<React.SetStateAction<Settings>>;
  onSelectImage?: (url: string) => void;
  activeStoreId?: string;
}

export interface MediaItem {
  url: string;
  key: string;
  filename: string;
  associatedProducts: Array<{ id: string; name: string }>;
  isThumbnail: boolean;
  isGallery: boolean;
}

export const MediaLibraryModal: React.FC<MediaLibraryModalProps> = ({
  isOpen,
  onClose,
  settings,
  setSettings,
  onSelectImage,
  activeStoreId
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'used' | 'unused'>('all');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Extract all media items from products
  const mediaItems: MediaItem[] = useMemo(() => {
    const map = new Map<string, MediaItem>();

    (settings.products || []).forEach((prod: Product) => {
      if (prod.thumbnail) {
        const u = prod.thumbnail.trim();
        if (u) {
          if (!map.has(u)) {
            const filename = u.split('/').pop()?.split('?')[0] || 'image.jpg';
            map.set(u, {
              url: u,
              key: u,
              filename,
              associatedProducts: [],
              isThumbnail: true,
              isGallery: false,
            });
          }
          const item = map.get(u)!;
          item.isThumbnail = true;
          if (!item.associatedProducts.some(p => p.id === prod.id)) {
            item.associatedProducts.push({ id: prod.id, name: prod.name });
          }
        }
      }

      (prod.images || []).forEach(img => {
        const u = img?.trim();
        if (u) {
          if (!map.has(u)) {
            const filename = u.split('/').pop()?.split('?')[0] || 'image.jpg';
            map.set(u, {
              url: u,
              key: u,
              filename,
              associatedProducts: [],
              isThumbnail: false,
              isGallery: true,
            });
          }
          const item = map.get(u)!;
          item.isGallery = true;
          if (!item.associatedProducts.some(p => p.id === prod.id)) {
            item.associatedProducts.push({ id: prod.id, name: prod.name });
          }
        }
      });

      // Also scan variants
      (prod.variants || []).forEach(v => {
        if (v.image) {
          const u = v.image.trim();
          if (u) {
            if (!map.has(u)) {
              const filename = u.split('/').pop()?.split('?')[0] || 'image.jpg';
              map.set(u, {
                url: u,
                key: u,
                filename,
                associatedProducts: [],
                isThumbnail: false,
                isGallery: false,
              });
            }
            const item = map.get(u)!;
            if (!item.associatedProducts.some(p => p.id === prod.id)) {
              item.associatedProducts.push({ id: prod.id, name: `${prod.name} (${Object.values(v.options).join(' - ')})` });
            }
          }
        }
      });
    });

    return Array.from(map.values());
  }, [settings.products]);

  // Filter media items
  const filteredItems = useMemo(() => {
    return mediaItems.filter(item => {
      const matchSearch = item.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.associatedProducts.some(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchSearch) return false;

      if (filterType === 'used') return item.associatedProducts.length > 0;
      if (filterType === 'unused') return item.associatedProducts.length === 0;
      return true;
    });
  }, [mediaItems, searchTerm, filterType]);

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleDeleteImage = async (url: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذه الصورة نهائيًا من مساحة التخزين R2؟")) return;
    setIsDeleting(url);
    try {
      await deleteProductImage(url);
      
      // Also unbind from products if setSettings is provided
      if (setSettings) {
        setSettings(prev => ({
          ...prev,
          products: (prev.products || []).map(p => ({
            ...p,
            thumbnail: p.thumbnail === url ? '' : p.thumbnail,
            images: (p.images || []).filter(img => img !== url),
            variants: (p.variants || []).map(v => ({
              ...v,
              image: v.image === url ? '' : v.image
            }))
          }))
        }));
      }
    } catch (err: any) {
      alert("فشل حذف الصورة من التخزين: " + (err.message || "خطأ غير متوقع"));
    } finally {
      setIsDeleting(null);
    }
  };

  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const optimized = await compressProductImages(Array.from(files));
      const res = await uploadProductImages(optimized, {
        storeId: activeStoreId || 'store-general',
        productId: `media-${Date.now()}`
      }, setUploadProgress);

      if (onSelectImage && res[0]?.url) {
        onSelectImage(res[0].url);
        onClose();
      }
    } catch (err: any) {
      alert("حدث خطأ أثناء الرفع: " + (err.message || "خطأ غير معروف"));
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Images size={22} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                مكتبة الوسائط والتخزين السحابي
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono">
                  Cloudflare R2
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                تصفح وإدارة كل صور المنتجات المحفوظة على الرابط https://abdomedi.com/images/
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="cursor-pointer px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition-all active:scale-95">
              {isUploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
              <span>{isUploading ? `جارٍ الرفع ${uploadProgress}%` : 'رفع صور جديدة'}</span>
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                onChange={handleUploadFiles} 
                disabled={isUploading} 
                className="hidden" 
              />
            </label>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Stats & Search Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-80">
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="ابحث باسم الملف أو المنتج..."
                className="w-full pr-10 pl-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
              />
              <Search size={16} className="absolute right-3 top-3 text-slate-400" />
            </div>

            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'all' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs' : 'text-slate-500'}`}
              >
                الكل ({mediaItems.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('used')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'used' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs' : 'text-slate-500'}`}
              >
                مربوطة بمنتجات
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 w-full sm:w-auto justify-end">
            <HardDrive size={15} className="text-indigo-500" />
            <span>إجمالي الصور المسجلة: <strong className="text-slate-800 dark:text-white font-mono">{mediaItems.length}</strong></span>
          </div>
        </div>

        {/* Media Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-950/20">
          {filteredItems.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <Images size={48} className="mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">لا توجد صور مطابقة لبحثك</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredItems.map((item, index) => {
                const isSelected = copiedUrl === item.url;
                return (
                  <div
                    key={`${item.url}-${index}`}
                    className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm overflow-hidden group hover:border-indigo-400 transition-all flex flex-col"
                  >
                    {/* Image Preview Container */}
                    <div 
                      className="aspect-square w-full bg-slate-100 dark:bg-slate-900 relative overflow-hidden flex items-center justify-center cursor-pointer"
                      onClick={() => {
                        if (onSelectImage) {
                          onSelectImage(item.url);
                          onClose();
                        } else {
                          setPreviewImage(item.url);
                        }
                      }}
                    >
                      <ProductImage
                        src={item.url}
                        alt={item.filename}
                        containerClassName="w-full h-full"
                        aspectRatio="square"
                        fallbackIconSize={24}
                      />

                      {/* Floating Badges */}
                      <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                        {item.isThumbnail && (
                          <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-md shadow">
                            رئيسية
                          </span>
                        )}
                        {item.isGallery && (
                          <span className="bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-md shadow">
                            معرض
                          </span>
                        )}
                      </div>

                      {/* Quick Select Overlay */}
                      {onSelectImage && (
                        <div className="absolute inset-0 bg-indigo-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-black">
                          اختيار الصورة ✓
                        </div>
                      )}
                    </div>

                    {/* Metadata & Actions */}
                    <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                      <div>
                        <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate" title={item.filename}>
                          {item.filename}
                        </p>
                        {item.associatedProducts.length > 0 ? (
                          <p className="text-[10px] text-slate-400 truncate mt-0.5" title={item.associatedProducts.map(p => p.name).join('، ')}>
                            📌 {item.associatedProducts.map(p => p.name).join('، ')}
                          </p>
                        ) : (
                          <p className="text-[10px] text-amber-500 font-bold mt-0.5">
                            غير مربوطة بمنتج
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/50">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.url)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-indigo-50 text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-colors"
                          title="نسخ الرابط المباشر"
                        >
                          {isSelected ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                        </button>

                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition-colors"
                          title="فتح في تبويب جديد"
                        >
                          <ExternalLink size={13} />
                        </a>

                        <button
                          type="button"
                          onClick={() => handleDeleteImage(item.url)}
                          disabled={isDeleting === item.url}
                          className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 hover:bg-red-600 hover:text-white transition-colors"
                          title="حذف من مساحة التخزين R2"
                        >
                          {isDeleting === item.url ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Full Preview Lightbox */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 backdrop-blur-md cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh] p-2 bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl">
            <img src={previewImage} alt="" className="max-w-full max-h-[80vh] object-contain rounded-2xl" />
            <button 
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/70 text-white flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
