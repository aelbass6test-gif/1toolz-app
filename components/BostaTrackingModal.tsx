import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Truck, AlertTriangle, RefreshCw, ExternalLink, MessageCircle, Copy, Check, Share2, User, Phone } from 'lucide-react';
import { bostaService } from '../utils/bostaService';
import { turboService, TurboConfig } from '../utils/turboService';

interface BostaTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackingNumber: string;
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  totalPrice?: number;
  apiKey?: string;
  carrier?: string;
  turboApiKey?: string;
  turboConfig?: TurboConfig;
}

export const BostaTrackingModal: React.FC<BostaTrackingModalProps> = ({
  isOpen,
  onClose,
  trackingNumber,
  orderNumber,
  customerName,
  customerPhone,
  totalPrice,
  apiKey,
  carrier,
  turboApiKey,
  turboConfig,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [trackData, setTrackData] = useState<any>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const isTurbo = Boolean(
    carrier &&
    (carrier.toLowerCase().includes('turbo') ||
      carrier.includes('تربو') ||
      carrier.includes('توربو'))
  );

  const carrierDisplayName = isTurbo ? 'تربو (Turbo)' : 'بوسطة (Bosta)';
  const trackingUrl = isTurbo
    ? `https://client.turbocourier.net/`
    : bostaService.getTrackingUrl(trackingNumber);

  const fetchTracking = async () => {
    if (!trackingNumber) return;
    setLoading(true);
    setError(null);
    try {
      if (isTurbo) {
        const configToUse = turboConfig || (turboApiKey ? { apiToken: turboApiKey } : apiKey ? { apiToken: apiKey } : undefined);
        const res = await turboService.trackShipment(trackingNumber, configToUse);
        if (res.success && res.trackingInfo) {
          setTrackData(res.trackingInfo);
        } else {
          setError(res.error || 'تعذر جلب تفاصيل التتبع من خوادم تربو');
        }
      } else {
        const res = await bostaService.trackShipment(trackingNumber, apiKey);
        if (res.success && res.tracking) {
          setTrackData(res.tracking);
        } else {
          setError(res.error || 'تعذر جلب تفاصيل التتبع من خوادم بوسطة');
        }
      }
    } catch (err: any) {
      setError(err.message || 'خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && trackingNumber) {
      fetchTracking();
    }
  }, [isOpen, trackingNumber, carrier]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(trackingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    let cleanPhone = (customerPhone || '').replace(/\D/g, '');
    if (cleanPhone.startsWith('01') && cleanPhone.length === 11) {
      cleanPhone = '2' + cleanPhone;
    }
    const message = `مرحباً ${customerName || 'عميلنا العزيز'} 👋،\n` +
      `يسعدنا إبلاغك بأنه تم شحن طلبك ${orderNumber ? `#${orderNumber}` : ''} عبر *${isTurbo ? 'تربو (Turbo)' : 'بوسطة (Bosta)'}* 🚚✨\n\n` +
      `📋 *رقم البوليصة:* ${trackingNumber}\n` +
      (totalPrice ? `💰 *المبلغ المطلوب عند الاستلام:* ${totalPrice} ج.م\n` : '') +
      `🔗 *رابط التتبع لشحنتك:*\n${trackingUrl}\n\n` +
      `شكراً لثقتكم بنا! ❤️`;

    const waUrl = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  if (!isOpen) return null;

  const timeline = trackData?.timeline || trackData?.TransitEvents || trackData?.history || trackData?.events || [];
  const currentStatus =
    trackData?.status_ar ||
    trackData?.statusArabic ||
    trackData?.state?.value ||
    trackData?.state ||
    trackData?.status ||
    (isTurbo ? 'قيد التوصيل في تربو' : 'قيد المعالجة');

  const courierName = trackData?.courier_name || trackData?.courier || trackData?.driver_name;
  const courierPhone = trackData?.courier_phone || trackData?.driver_phone;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 dir-rtl text-right">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-l from-indigo-50 to-white dark:from-slate-800 dark:to-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Truck size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 dark:text-white text-base">
                تتبع شحنة {carrierDisplayName}
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                رقم البوليصة: {trackingNumber} {orderNumber ? `| طلب #${orderNumber}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="animate-spin text-indigo-600" size={32} />
              <p className="text-xs font-bold">جاري الاتصال بخوادم {carrierDisplayName} ومزامنة بيانات الشحنة...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 flex items-start gap-3 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="shrink-0 mt-0.5" size={18} />
              <div className="text-xs space-y-1">
                <p className="font-bold">تعذر استرجاع التتبع:</p>
                <p>{error}</p>
                <button
                  onClick={fetchTracking}
                  className="mt-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] transition inline-flex items-center gap-1.5"
                >
                  <RefreshCw size={12} /> إعادة المحاولة
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Status summary banner */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 font-bold block mb-1">الحالة الحالية في {carrierDisplayName}:</span>
                  <span className="text-base font-black text-indigo-600 dark:text-indigo-400">
                    {currentStatus}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                  >
                    <ExternalLink size={13} /> {isTurbo ? 'بوابة تربو' : 'صفحة بوسطة'}
                  </a>
                </div>
              </div>

              {/* Courier info if available */}
              {(courierName || courierPhone) && (
                <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <User size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800 dark:text-white">
                        مندوب التوصيل: {courierName || 'مندوب تربو'}
                      </p>
                      {courierPhone && (
                        <p className="text-[11px] text-slate-500 font-mono">
                          {courierPhone}
                        </p>
                      )}
                    </div>
                  </div>
                  {courierPhone && (
                    <a
                      href={`tel:${courierPhone}`}
                      className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1"
                    >
                      <Phone size={12} /> اتصال
                    </a>
                  )}
                </div>
              )}

              {/* Quick Customer Notification Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <Share2 size={14} className="text-emerald-600" /> إرسال وتتبع الشحنة للعميل:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition"
                  >
                    {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    {copied ? 'تم نسخ الرابط' : 'نسخ رابط التتبع'}
                  </button>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20"
                  >
                    <MessageCircle size={14} /> إرسال رابط التتبع عبر WhatsApp للعميل
                  </button>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  سجل مراحل وتحركات الشحنة:
                </h4>

                {timeline.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 text-center font-bold">
                    تم تسجيل الشحنة بنجاح في {carrierDisplayName}.
                  </div>
                ) : (
                  <div className="space-y-4 pr-2 border-r-2 border-slate-200 dark:border-slate-800 mr-2">
                    {timeline.map((ev: any, idx: number) => (
                      <div key={idx} className="relative pr-6">
                        <span className="absolute -right-[9px] top-1 w-3 h-3 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-900"></span>
                        <p className="text-xs font-black text-slate-800 dark:text-white">
                          {ev.state || ev.status || ev.message || ev.action || 'تحديث حالة'}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
                          {ev.timestamp ? new Date(ev.timestamp).toLocaleString('ar-EG') : (ev.date || ev.created_at || '')}
                        </p>
                        {ev.reason && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                            السبب: {ev.reason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <button
            onClick={fetchTracking}
            disabled={loading}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> تحديث مباشر
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition"
          >
            إغلاق
          </button>
        </div>
      </motion.div>
    </div>
  );
};
