import React, { useState } from 'react';
import { Clock, Check, X, Calendar, DollarSign, FileText, Upload, Trash2, Eye } from 'lucide-react';
import { motion } from 'motion/react';
import { StaffMember, StaffAttendance, StaffLeave, StaffAdvance, StaffDocument } from '../types';

// ==========================================
// 1. Attendance Manager Component
// ==========================================
interface AttendanceManagerProps {
  staff: StaffMember[];
  attendanceRecords: StaffAttendance[];
  date: string;
  onSave: (records: StaffAttendance[]) => void;
}

export const AttendanceManager: React.FC<AttendanceManagerProps> = ({
  staff,
  attendanceRecords,
  date,
  onSave,
}) => {
  const [localRecords, setLocalRecords] = useState<Record<string, { status: 'present' | 'absent' | 'delay' | 'leave'; note: string }>>(() => {
    const initial: Record<string, { status: 'present' | 'absent' | 'delay' | 'leave'; note: string }> = {};
    staff.forEach(s => {
      const match = attendanceRecords.find(r => r.staffId === s.id && r.date === date);
      initial[s.id] = {
        status: match ? match.status : 'present',
        note: match ? (match.note || '') : '',
      };
    });
    return initial;
  });

  // Re-sync when date or staff list changes
  React.useEffect(() => {
    const updated: Record<string, { status: 'present' | 'absent' | 'delay' | 'leave'; note: string }> = {};
    staff.forEach(s => {
      const match = attendanceRecords.find(r => r.staffId === s.id && r.date === date);
      updated[s.id] = {
        status: match ? match.status : 'present',
        note: match ? (match.note || '') : '',
      };
    });
    setLocalRecords(updated);
  }, [date, staff, attendanceRecords]);

  const handleStatusChange = (staffId: string, status: 'present' | 'absent' | 'delay' | 'leave') => {
    setLocalRecords(prev => ({
      ...prev,
      [staffId]: { ...prev[staffId], status },
    }));
  };

  const handleNoteChange = (staffId: string, note: string) => {
    setLocalRecords(prev => ({
      ...prev,
      [staffId]: { ...prev[staffId], note },
    }));
  };

  const handleTriggerSave = () => {
    const recordsToSave: StaffAttendance[] = staff.map(s => {
      const local = localRecords[s.id] || { status: 'present', note: '' };
      return {
        id: `att-${s.id}-${date}`,
        staffId: s.id,
        staffName: s.name,
        date,
        status: local.status,
        note: local.note,
      };
    });
    onSave(recordsToSave);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-slate-150 dark:border-slate-800">
        <table className="w-full text-right text-xs md:text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-bold uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3">الموظف / الوظيفة</th>
              <th className="px-6 py-3 text-center">حالة الحضور</th>
              <th className="px-6 py-3">ملاحظات / التأخير</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {staff.map(s => {
              const current = localRecords[s.id] || { status: 'present', note: '' };
              return (
                <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800 dark:text-white">{s.name}</div>
                    <div className="text-[10px] text-slate-400 font-bold">{s.position}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(s.id, 'present')}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                          current.status === 'present'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-300'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        حاضر
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(s.id, 'delay')}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                          current.status === 'delay'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-300'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        متأخر
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(s.id, 'absent')}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                          current.status === 'absent'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-300'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        غائب
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(s.id, 'leave')}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                          current.status === 'leave'
                            ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-300'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        إجازة
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      placeholder="مثال: تأخر ساعة، إذن مسبق..."
                      value={current.note}
                      onChange={e => handleNoteChange(s.id, e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleTriggerSave}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all"
        >
          <Check size={16} /> حفظ حضور وانصراف اليوم
        </button>
      </div>
    </div>
  );
};

// ==========================================
// 2. Add Leave Request Modal Component
// ==========================================
interface AddLeaveModalProps {
  staff: StaffMember[];
  onClose: () => void;
  onSave: (leave: Omit<StaffLeave, 'id'>) => void;
}

export const AddLeaveModal: React.FC<AddLeaveModalProps> = ({ staff, onClose, onSave }) => {
  const [staffId, setStaffId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState<'annual' | 'sick' | 'casual' | 'unpaid'>('annual');
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId || !startDate || !endDate) {
      alert('يرجى ملء كافة الحقول الأساسية');
      return;
    }

    const selected = staff.find(s => s.id === staffId);
    if (!selected) return;

    // Calculate days count
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    onSave({
      staffId,
      staffName: selected.name,
      startDate,
      endDate,
      type,
      daysCount,
      reason,
      status: 'pending',
    });
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden text-right border border-slate-200 dark:border-slate-800"
      >
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
          <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Calendar size={18} className="text-indigo-600" /> تقديم طلب إجازة جديد للموظف
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs font-bold">
          <div>
            <label className="text-slate-500 mb-1 block">اختر الموظف *</label>
            <select
              value={staffId}
              onChange={e => setStaffId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-slate-800 dark:text-white"
              required
            >
              <option value="">-- اختر الموظف --</option>
              {staff.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.position})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-500 mb-1 block">تاريخ البدء *</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-slate-800 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="text-slate-500 mb-1 block">تاريخ الانتهاء *</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-slate-800 dark:text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-slate-500 mb-1 block">نوع الإجازة *</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-slate-800 dark:text-white"
            >
              <option value="annual">سنوية اعتيادية</option>
              <option value="sick">مرضية معتمدة</option>
              <option value="casual">عارضة طارئة</option>
              <option value="unpaid">بدون راتب (خصم)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-500 mb-1 block">السبب / ملاحظات</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="اكتب تفاصيل أو مبررات طلب الإجازة هنا..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-slate-800 dark:text-white h-20"
            />
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500">
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg transition-all"
            >
              حفظ وتقديم الطلب
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ==========================================
// 3. Add Advance (Loan) Modal Component
// ==========================================
interface AddAdvanceModalProps {
  staff: StaffMember[];
  onClose: () => void;
  onSave: (advance: Omit<StaffAdvance, 'id'>) => void;
}

export const AddAdvanceModal: React.FC<AddAdvanceModalProps> = ({ staff, onClose, onSave }) => {
  const [staffId, setStaffId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId || !amount || amount <= 0) {
      alert('يرجى ملء البيانات وإدخال مبلغ صحيح للسلفة');
      return;
    }

    const selected = staff.find(s => s.id === staffId);
    if (!selected) return;

    onSave({
      staffId,
      staffName: selected.name,
      amount,
      date,
      note,
      status: 'pending',
    });
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden text-right border border-slate-200 dark:border-slate-800"
      >
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
          <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
            <DollarSign size={18} className="text-indigo-600" /> صرف سلفة مالية جديدة لموظف
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs font-bold">
          <div>
            <label className="text-slate-500 mb-1 block">اختر الموظف المستلف *</label>
            <select
              value={staffId}
              onChange={e => setStaffId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-slate-800 dark:text-white"
              required
            >
              <option value="">-- اختر الموظف --</option>
              {staff.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.position})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-500 mb-1 block">مبلغ السلفة (بالجنيه) *</label>
              <input
                type="number"
                value={amount || ''}
                onChange={e => setAmount(Number(e.target.value))}
                placeholder="0.00"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 font-mono font-bold text-slate-800 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="text-slate-500 mb-1 block">تاريخ صرف السلفة *</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-slate-800 dark:text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-slate-500 mb-1 block">ملاحظات السلفة / شروط السداد</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="شروط السداد أو تفاصيل إضافية..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-slate-800 dark:text-white h-20"
            />
          </div>

          <div className="p-4 bg-amber-50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/20 text-amber-800 dark:text-amber-400 rounded-2xl flex items-start gap-2">
            <Clock size={16} className="mt-0.5 flex-shrink-0" />
            <p className="leading-relaxed text-[11px] font-medium">
              سيتم حفظ هذه السلفة تحت بند "معلقة"، ويمكنك خصمها تلقائياً بالكامل كجزاء/خصم مباشر من رواتب الموظف بضغطة زر عند احتساب راتبه آخر الشهر.
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500">
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg transition-all"
            >
              تسجيل السلفة وصرفها
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ==========================================
// 4. Add Document Modal Component
// ==========================================
interface AddDocumentModalProps {
  staff: StaffMember[];
  onClose: () => void;
  onSave: (doc: Omit<StaffDocument, 'id'>) => void;
}

export const AddDocumentModal: React.FC<AddDocumentModalProps> = ({ staff, onClose, onSave }) => {
  const [staffId, setStaffId] = useState('');
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState<'contract' | 'id_card' | 'passport' | 'other'>('contract');
  const [expiryDate, setExpiryDate] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId || !docName) {
      alert('يرجى ملء الحقول الأساسية لاسم المستند والموظف');
      return;
    }

    const selected = staff.find(s => s.id === staffId);
    if (!selected) return;

    onSave({
      staffId,
      staffName: selected.name,
      docName,
      docType,
      expiryDate: expiryDate || undefined,
      fileUrl: fileUrl || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden text-right border border-slate-200 dark:border-slate-800"
      >
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
          <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
            <FileText size={18} className="text-indigo-600" /> إضافة مستند أو عقد لموظف جديد
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs font-bold">
          <div>
            <label className="text-slate-500 mb-1 block">اختر الموظف صاحب الملف *</label>
            <select
              value={staffId}
              onChange={e => setStaffId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-slate-800 dark:text-white"
              required
            >
              <option value="">-- اختر الموظف --</option>
              {staff.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.position})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-500 mb-1 block">اسم الملف / المستند *</label>
              <input
                type="text"
                value={docName}
                onChange={e => setDocName(e.target.value)}
                placeholder="مثال: عقد العمل، البطاقة الشخصية..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-slate-800 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="text-slate-500 mb-1 block">نوع المستند *</label>
              <select
                value={docType}
                onChange={e => setDocType(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-slate-800 dark:text-white"
              >
                <option value="contract">عقد عمل</option>
                <option value="id_card">هوية شخصية / إقامة</option>
                <option value="passport">جواز سفر</option>
                <option value="other">مستند إداري آخر</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-slate-500 mb-1 block">تاريخ انتهاء الصلاحية (إن وجد)</label>
              <input
                type="date"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-500 mb-1 block">رابط أو مسار المستند الرقمي (رابط مستضاف)</label>
            <input
              type="url"
              value={fileUrl}
              onChange={e => setFileUrl(e.target.value)}
              placeholder="https://example.com/document.pdf"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-slate-800 dark:text-white font-mono text-left"
              dir="ltr"
            />
          </div>

          <div>
            <label className="text-slate-500 mb-1 block">ملاحظات على المستند</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="مثال: تم التوقيع من الطرفين..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-slate-800 dark:text-white h-20"
            />
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500">
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg transition-all"
            >
              إضافة المستند وحفظه
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
