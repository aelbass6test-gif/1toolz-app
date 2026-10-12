import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, AlertCircle } from 'lucide-react';

// In-memory cache for images already loaded during this session to prevent re-skeleton flashing
const loadedImagesCache = new Set<string>();

interface ProductImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
  containerClassName?: string;
  fallbackIconSize?: number;
  aspectRatio?: 'square' | 'video' | 'auto';
  showSkeleton?: boolean;
  priority?: boolean;
  onClick?: () => void;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt = 'صورة المنتج',
  className = 'w-full h-full object-cover',
  containerClassName = '',
  fallbackIconSize = 20,
  aspectRatio = 'square',
  showSkeleton = true,
  priority = false,
  onClick
}) => {
  const cleanSrc = src && typeof src === 'string' && src.trim().length > 0 ? src.trim() : null;
  const isAlreadyCached = cleanSrc ? loadedImagesCache.has(cleanSrc) : false;

  const [isLoaded, setIsLoaded] = useState<boolean>(isAlreadyCached);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    if (!cleanSrc) {
      setIsLoaded(false);
      setHasError(false);
      return;
    }

    if (loadedImagesCache.has(cleanSrc)) {
      setIsLoaded(true);
      setHasError(false);
      return;
    }

    // Check if the browser already has it cached in Image element
    const img = new Image();
    img.src = cleanSrc;
    if (img.complete && img.naturalWidth > 0) {
      loadedImagesCache.add(cleanSrc);
      setIsLoaded(true);
      setHasError(false);
    } else {
      setIsLoaded(false);
      setHasError(false);
    }
  }, [cleanSrc]);

  const handleLoad = () => {
    if (cleanSrc) {
      loadedImagesCache.add(cleanSrc);
    }
    setIsLoaded(true);
    setHasError(false);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  const aspectClass = 
    aspectRatio === 'square' ? 'aspect-square' :
    aspectRatio === 'video' ? 'aspect-video' : '';

  if (!cleanSrc) {
    return (
      <div 
        className={`relative overflow-hidden bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-300 dark:text-slate-600 rounded-lg ${aspectClass} ${containerClassName}`}
        onClick={onClick}
      >
        <ImageIcon size={fallbackIconSize} />
      </div>
    );
  }

  if (hasError) {
    return (
      <div 
        className={`relative overflow-hidden bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 rounded-lg p-1 ${aspectClass} ${containerClassName}`}
        title="تعذر تحميل الصورة"
        onClick={onClick}
      >
        <AlertCircle size={Math.max(14, fallbackIconSize - 4)} className="text-amber-500/80 mb-0.5" />
        <span className="text-[9px] font-medium text-slate-400">غير متوفرة</span>
      </div>
    );
  }

  return (
    <div 
      className={`relative overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800/50 ${aspectClass} ${containerClassName}`}
      onClick={onClick}
    >
      {/* Skeleton Loading Shimmer */}
      {showSkeleton && !isLoaded && (
        <div className="absolute inset-0 z-1 flex items-center justify-center bg-slate-200 dark:bg-slate-800 animate-pulse">
          <div className="w-full h-full bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent animate-shimmer" />
          <ImageIcon size={Math.max(14, fallbackIconSize - 2)} className="absolute text-slate-300 dark:text-slate-600" />
        </div>
      )}

      {/* Actual Image with smooth fade-in */}
      <img
        src={cleanSrc}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={handleLoad}
        onError={handleError}
        className={`${className} transition-opacity duration-300 ease-in-out ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};
export default ProductImage;
