import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Calendar, Clock, MapPin, Phone, User, CheckCircle2, AlertTriangle, Truck, Loader2 } from 'lucide-react';
import { bostaService } from '../utils/bostaService';
import { Settings, Order, BostaPickupRequest } from '../types';

interface BostaPickupModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  setSettings?: React.Dispatch<React.SetStateAction<Settings>>;
  orders?: Order[];
  onSuccess?: (pickupId: string) => void;
}

export const BostaPickupModal: React.FC<BostaPickupModalProps> = ({
  isOpen,
  onClose,
  settings,
  setSettings,
  orders = [],
  onSuccess,
}) => {
  // Tomorrow's date as default
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDateStr = tomorrow.toISOString().split('T')[0];

  // Ready orders: orders with waybill number or bostaDeliveryId
  const readyOrders = orders.filter(
    (o) => o.waybillNumber || o.bostaDeliveryId || o.shippingCompany === 'بوسطة'
  );

  const [scheduledDate, setScheduledDate] = useState<string>(defaultDateStr);
  const [scheduledSlot, setScheduledSlot] = useState<string>('10:00 to 13:00');
  const [pickupAddress, setPickupAddress] = useState<string>(
    settings.bostaConfig?.pickupAddress?.firstLine || (settings as any).storeAddress || 'المقر الرئيسي للمتجر'
  );
  const [city, setCity] = useState<string>(settings.bostaConfig?.pickupAddress?.city || 'Cairo');
  const [contactName, setContactName] = useState<string>(
    settings.bostaConfig?.pickupAddress?.contactPersonName || settings.storeName || 'مسؤول التجهيز'
  );
  const [contactPhone, setContactPhone] = useState<string>(
    settings.bostaConfig?.pickupAddress?.contactPersonPhone || (settings as any).storePhone || '01000000000'
  );
  const [notes, setNotes] = useState<string>('يرجى الحضور في الموعد المحدد لاستلام طرود المتجر');
  const [numberOfParcels, setNumberOfParcels] = useState<number>(readyOrders.length > 0 ? readyOrders.length : 1);
  const [packageType, setPackageType] = useState<'Normal' | 'Light Bulky' | 'Heavy Bulky'>('Normal');
  const [repeatedType, setRepeatedType] = useState<'One Time' | 'Daily' | 'Weekly'>('One Time');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successPickup, setSuccessPickup] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!contactPhone.trim()) {
      setError('يرجى إدخال رقم هاتف مسؤول الاستلام');
      return;
    }
    if (!pickupAddress.trim()) {
      setError('يرجى إدخال عنوان استلام الشحنات');
      return;
    }

    setLoading(true);
    try {
      const res = await bostaService.createPickup({
        scheduledDate,
        scheduledSlot,
        pickupAddress: {
          firstLine: pickupAddress,
          city: city,
        },
        contactPerson: {
          name: contactName,
          phone: contactPhone,
        },
        numberOfParcels: Number(numberOfParcels) || 1,
        packageType,
        repeatedData: repeatedType !== 'One Time' ? { repeatedType } : undefined,
        notes,
        config: settings.bostaConfig,
      });

      if (res.success) {
        const pickupData = res.pickup;
        const pickupId = pickupData?._id || pickupData?.id || `pk_${Date.now()}`;

        const newPickupRecord: BostaPickupRequest = {
          id: pickupId,
          bostaPickupId: pickupId,
          scheduledDate,
          scheduledSlot,
          status: 'مجدول (Scheduled)',
          ordersCount: readyOrders.length,
          orderIds: readyOrders.map((o) => o.id),
          pickupAddress,
          contactPhone,
          contactName,
          notes,
          createdAt: new Date().toISOString(),
        };

        if (setSettings) {
          setSettings((prev) => ({
            ...prev,
            bostaPickups: [newPickupRecord, ...(prev.bostaPickups || [])],
          }));
        }

        setSuccessPickup(pickupData);
        if (onSuccess) onSuccess(pickupId);
      } else {
        setError(res.error || 'فشل إنشاء إذن الاستلام في خوادم بوسطة');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع أثناء إرسال الطلب');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 dir-rtl text-right">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-l from-indigo-50 to-white dark:from-slate-800 dark:to-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Calendar size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 dark:text-white text-base">
                إنشاء إذن استلام من بوسطة (Pickup Request)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تحديد موعد حضور مندوب بوسطة لاستلام وتوريد الطرود المجهزة
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
          {successPickup ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-800 dark:text-white">
                  تم جدولة إذن الاستلام بنجاح!
                </h4>
                <p className="text-xs text-slate-500 font-sans mt-1">
                  رقم إذن الاستلام في بوسطة: {successPickup._id || successPickup.id || 'معتمد'}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto space-y-2 text-right">
                <div className="flex justify-between">
                  <span className="text-slate-400">تاريخ الحضور:</span>
                  <span className="font-bold">{scheduledDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">الفترة الزمنية:</span>
                  <span className="font-bold">{scheduledSlot}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">عنوان المتجر:</span>
                  <span className="font-bold">{pickupAddress}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">عدد الطرود الجاهزة:</span>
                  <span className="font-bold text-indigo-600">{readyOrders.length} طرد</span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-indigo-700 transition"
              >
                تم، إغلاق النافذة
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Notice */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 flex items-start gap-3">
                <Truck className="text-indigo-600 shrink-0 mt-0.5" size={18} />
                <div className="text-xs text-indigo-900 dark:text-indigo-300 space-y-1">
                  <p className="font-black">مبدأ إذن الاستلام الذكي:</p>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                    يتم إنشاء الشحنات وطباعة البوالص مسبقاً لكل أوردر دون احتساب تكلفة فورية، وعند اكتمال تجهيز الدفعة يتم طلب المندوب للحضور واستلام الشحنات وتفعيل المسار.
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* Ready orders badge */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <span className="text-slate-500 font-bold">الطرود الجاهزة للاستلام حالياً:</span>
                <span className="px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-black">
                  {readyOrders.length} طلب ببوليصة جاهزة
                </span>
              </div>

              {/* Date & Slot */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Calendar size={14} className="text-indigo-600" /> تاريخ حضور المندوب:
                  </label>
                  <input
                    type="date"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Clock size={14} className="text-indigo-600" /> الفترة الزمنية:
                  </label>
                  <select
                    value={scheduledSlot}
                    onChange={(e) => setScheduledSlot(e.target.value)}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="10:00 to 13:00">صباحاً (10:00 ص إلى 01:00 م)</option>
                    <option value="13:00 to 16:00">ظهراً (01:00 م إلى 04:00 م)</option>
                    <option value="16:00 to 19:00">مساءً (04:00 م إلى 07:00 م)</option>
                  </select>
                </div>
              </div>

              {/* Package Type & Count & Schedule Frequency */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-750">
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-600 dark:text-slate-400">
                    نوع الطرود (Package Type):
                  </label>
                  <select
                    value={packageType}
                    onChange={(e) => setPackageType(e.target.value as any)}
                    className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Normal">طرد عادي (Normal)</option>
                    <option value="Light Bulky">كبير خفيف (Light Bulky)</option>
                    <option value="Heavy Bulky">كبير ثقيل (Heavy Bulky)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-600 dark:text-slate-400">
                    عدد الطرود المتوقعة:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={numberOfParcels}
                    onChange={(e) => setNumberOfParcels(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold font-mono dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-600 dark:text-slate-400">
                    تكرار الاستلام:
                  </label>
                  <select
                    value={repeatedType}
                    onChange={(e) => setRepeatedType(e.target.value as any)}
                    className="w-full p-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="One Time">مرة واحدة (One Time)</option>
                    <option value="Daily">يومياً (Daily)</option>
                    <option value="Weekly">أسبوعياً (Weekly)</option>
                  </select>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MapPin size={14} className="text-indigo-600" /> عنوان استلام الشحنات:
                </label>
                <input
                  type="text"
                  required
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder="مثال: شارع التحرير، عمارة 15، الدور الثاني"
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Contact Person */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <User size={14} className="text-indigo-600" /> اسم مسؤول التسليم:
                  </label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Phone size={14} className="text-indigo-600" /> رقم هاتف المسؤول:
                  </label>
                  <input
                    type="text"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="01xxxxxxxxx"
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                  ملاحظات لمندوب بوسطة (اختياري):
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات موقع التسليم أو أرقام إضافية"
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={16} /> جاري إرسال الطلب لبوسطة...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> تأكيد إذن الاستلام
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};
