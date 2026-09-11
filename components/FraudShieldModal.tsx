import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, ShieldCheck, Plus, Trash2, Search,
  UserX, AlertTriangle, CheckCircle2, Phone, Calendar,
  FileText, X, AlertCircle
} from 'lucide-react';
import { 
  getStoredBlacklist, 
  saveBlacklistEntry, 
  removeBlacklistEntry, 
  BlacklistEntry 
} from '../utils/fraudShield';
import { audioSynth } from '../utils/audioSynth';

interface FraudShieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPhone?: string;
  defaultName?: string;
}

export const FraudShieldModal: React.FC<FraudShieldModalProps> = ({
  isOpen,
  onClose,
  defaultPhone = '',
  defaultName = ''
}) => {
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(Boolean(defaultPhone));

  // Form
  const [phone, setPhone] = useState(defaultPhone);
  const [customerName, setCustomerName] = useState(defaultName);
  const [reason, setReason] = useState('رفض استلام متكرر / طلب غير جاد');
  const [severity, setSeverity] = useState<'high' | 'medium'>('high');

  useEffect(() => {
    if (isOpen) {
      setBlacklist(getStoredBlacklist());
      if (defaultPhone) {
        setPhone(defaultPhone);
        setCustomerName(defaultName);
        setIsAdding(true);
      }
    }
  }, [isOpen, defaultPhone, defaultName]);

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;

    audioSynth.playClick();
    const newEntry: BlacklistEntry = {
      phone: phone.trim(),
      customerName: customerName.trim() || undefined,
      reason: reason.trim() || 'طلب وهمي / مشبوه',
      severity,
      addedAt: new Date().toISOString(),
      addedBy: 'مدير المتجر'
    };

    const updated = saveBlacklistEntry(newEntry);
    setBlacklist(updated);
    setPhone('');
    setCustomerName('');
    setIsAdding(false);
    audioSynth.playSuccess();
  };

  const handleDelete = (phoneToDelete: string) => {
    if (window.confirm(`هل أنت متأكد من إزالة الرقم ${phoneToDelete} من القائمة التحذيرية؟`)) {
      audioSynth.playClick();
      const updated = removeBlacklistEntry(phoneToDelete);
      setBlacklist(updated);
    }
  };

  const filtered = blacklist.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.phone.includes(q) ||
      (item.customerName && item.customerName.toLowerCase().includes(q)) ||
      item.reason.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans" dir="rtl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                درع حماية المتجر من الطلبات الوهمية والاحتيال (Fraud Shield)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                إدارة أرقام الهواتف المحظورة والتحذيرية لتفادي تكاليف الشحن المهدورة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-xl cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Top bar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40">
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث برقم الهاتف أو الاسم..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500/20"
            />
          </div>

          <button
            onClick={() => { setIsAdding(!isAdding); audioSynth.playClick(); }}
            className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus size={14} />
            <span>{isAdding ? 'إلغاء الإضافة' : 'إضافة رقم للقائمة التحذيرية'}</span>
          </button>
        </div>

        {/* Add Form */}
        {isAdding && (
          <form onSubmit={handleAdd} className="p-4 bg-rose-50/50 dark:bg-rose-950/20 border-b border-rose-100 dark:border-rose-900/30 space-y-3 text-xs">
            <div className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
              <AlertTriangle size={14} />
              <span>تسجيل رقم عميل في القائمة التحذيرية لمنع شحن طلباته بدون عربون</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">رقم الهاتف *</label>
                <input
                  type="tel"
                  required
                  placeholder="01xxxxxxxxx"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">اسم العميل (اختياري)</label>
                <input
                  type="text"
                  placeholder="اسم العميل..."
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">سبب التحذير أو الحظر</label>
                <input
                  type="text"
                  placeholder="مثال: رفض استلام على الباب، طلب وهمي مكرر..."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">درجة الخطورة</label>
                <select
                  value={severity}
                  onChange={e => setSeverity(e.target.value as any)}
                  className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
                >
                  <option value="high">🚨 عالية (حظر أو عربون إلزامي)</option>
                  <option value="medium">⚠️ متوسطة (تأكيد هاتفي دقيق)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-sm"
              >
                تأكيد الإضافة للقائمة
              </button>
            </div>
          </form>
        )}

        {/* List of Blacklisted Numbers */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5 text-xs">
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <ShieldCheck className="mx-auto text-emerald-500 mb-2" size={36} />
              <div className="font-bold text-slate-700 dark:text-slate-300">القائمة التحذيرية نظيفة تماماً</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                لم يتم تسجيل أي أرقام هواتف محظورة أو مشبوهة حتى الآن.
              </p>
            </div>
          ) : (
            filtered.map(item => (
              <div 
                key={item.phone}
                className="p-3 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between gap-3 hover:border-rose-300 transition-all shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl shrink-0 ${
                    item.severity === 'high' 
                      ? 'bg-rose-100 dark:bg-rose-950 text-rose-600' 
                      : 'bg-amber-100 dark:bg-amber-950 text-amber-600'
                  }`}>
                    <UserX size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-slate-900 dark:text-white text-sm dir-ltr">
                        {item.phone}
                      </span>
                      {item.customerName && (
                        <span className="font-bold text-slate-600 dark:text-slate-300">
                          ({item.customerName})
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.severity === 'high'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {item.severity === 'high' ? 'عالي الخطورة' : 'متوسط'}
                      </span>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                      <span>السبب: {item.reason}</span>
                      <span>•</span>
                      <span>{new Date(item.addedAt).toLocaleDateString('ar-EG')}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(item.phone)}
                  title="حذف من القائمة التحذيرية"
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all cursor-pointer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default FraudShieldModal;
