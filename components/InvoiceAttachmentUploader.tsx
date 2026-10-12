import React, { useState, useRef } from 'react';
import { 
  Paperclip, Image as ImageIcon, Upload, X, Trash2, 
  ExternalLink, Eye, RefreshCw, CheckCircle2, AlertCircle, Camera 
} from 'lucide-react';
import { compressProductImages, uploadProductImages } from '../services/mediaUploadService';

interface InvoiceAttachmentUploaderProps {
  label?: string;
  helperText?: string;
  attachments: string[];
  onChange: (urls: string[]) => void;
  activeStoreId?: string;
  folderCategory?: 'suppliers' | 'expenses' | 'customers' | 'shipping' | 'returns';
  maxFiles?: number;
  compact?: boolean;
}

export const InvoiceAttachmentUploader: React.FC<InvoiceAttachmentUploaderProps> = ({
  label = 'صورة أو مستند الفاتورة / الإيصال',
  helperText = 'يمكنك تصوير الفاتورة بالكاميرا أو رفعها من الجهاز (JPEG, PNG, WebP)',
  attachments = [],
  onChange,
  activeStoreId = 'store-general',
  folderCategory = 'expenses',
  maxFiles = 5,
  compact = false
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const files = Array.from(filesList);
      const optimized = await compressProductImages(files);
      const uploaded = await uploadProductImages(optimized, {
        storeId: activeStoreId,
        productId: `doc-${folderCategory}-${Date.now()}`
      }, setUploadProgress);

      const newUrls = uploaded.map(u => u.url).filter(Boolean);
      const combined = Array.from(new Set([...attachments, ...newUrls]));
      onChange(combined);
    } catch (err: any) {
      alert('حدث خطأ أثناء رفع الفاتورة: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const removeAttachment = (indexToRemove: number) => {
    const updated = attachments.filter((_, idx) => idx !== indexToRemove);
    onChange(updated);
  };

  return (
    <div className="space-y-2.5 text-right" dir="rtl">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <Paperclip size={14} className="text-indigo-600 dark:text-indigo-400" />
            <span>{label}</span>
          </label>
          <span className="text-[10px] text-slate-400 font-bold">
            ({attachments.length} من {maxFiles})
          </span>
        </div>
      )}

      {/* Hidden Inputs */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={(e) => handleFiles(e.target.files)} 
        accept="image/*" 
        multiple 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={cameraInputRef} 
        onChange={(e) => handleFiles(e.target.files)} 
        accept="image/*" 
        capture="environment" 
        className="hidden" 
      />

      {/* Upload Buttons & Previews Grid */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Render uploaded thumbnails */}
        {attachments.map((url, idx) => (
          <div 
            key={`${url}-${idx}`} 
            className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 group shadow-xs shrink-0"
          >
            <img 
              src={url} 
              alt={`مستند #${idx + 1}`} 
              className="w-full h-full object-cover" 
            />
            
            {/* Hover Actions */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 z-10">
              <button
                type="button"
                onClick={() => setPreviewImage(url)}
                className="w-6 h-6 rounded-lg bg-white/90 text-slate-800 flex items-center justify-center hover:bg-white transition-colors"
                title="معاينة المستند"
              >
                <Eye size={12} />
              </button>
              <button
                type="button"
                onClick={() => removeAttachment(idx)}
                className="w-6 h-6 rounded-lg bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-colors"
                title="حذف المستند"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}

        {/* Upload Trigger Buttons */}
        {attachments.length < maxFiles && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="h-16 sm:h-20 px-3.5 rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex flex-col items-center justify-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isUploading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span className="text-[10px] font-bold">{uploadProgress}%</span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span className="text-[10px] font-bold">رفع ملف</span>
                </>
              )}
            </button>

            {/* Direct Mobile Camera Capture */}
            <button
              type="button"
              disabled={isUploading}
              onClick={() => cameraInputRef.current?.click()}
              className="h-16 sm:h-20 px-3 rounded-2xl border-2 border-dashed border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-50 text-emerald-600 dark:text-emerald-400 flex flex-col items-center justify-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
              title="تصوير فوري بالكاميرا"
            >
              <Camera size={16} />
              <span className="text-[10px] font-bold">كاميرا</span>
            </button>
          </div>
        )}
      </div>

      {helperText && (
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
          {helperText}
        </p>
      )}

      {/* Lightbox Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 p-2 rounded-3xl overflow-hidden shadow-2xl">
            <img 
              src={previewImage} 
              alt="معاينة الفاتورة" 
              className="max-w-full max-h-[82vh] object-contain rounded-2xl" 
            />
            <div className="absolute top-4 left-4 flex gap-2">
              <a
                href={previewImage}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="w-9 h-9 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-indigo-600 transition-colors"
                title="فتح في نافذة كاملة"
              >
                <ExternalLink size={16} />
              </a>
              <button 
                onClick={() => setPreviewImage(null)}
                className="w-9 h-9 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
