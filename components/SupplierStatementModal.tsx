import React, { useState, useMemo } from 'react';
import { Settings, Supplier, SupplyOrder } from '../types';
import { 
  Printer, X, Download, Calendar, Search, 
  FileText, Building2, Phone, MapPin, 
  ArrowUpRight, ArrowDownLeft, CheckCircle2, Copy, Filter
} from 'lucide-react';
import { printHTMLDirectly } from '../utils/printHelper';
import * as XLSX from 'xlsx';

interface SupplierStatementModalProps {
  supplier: Supplier;
  supplyOrders: SupplyOrder[];
  settings: Settings;
  onClose: () => void;
}

export const SupplierStatementModal: React.FC<SupplierStatementModalProps> = ({
  supplier,
  supplyOrders,
  settings,
  onClose
}) => {
  const [dateFilter, setDateFilter] = useState<'all' | 'this_month' | 'last_30' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter Supply Orders for this Supplier
  const filteredSupplyOrders = useMemo(() => {
    return supplyOrders.filter(so => so.supplierId === supplier.id);
  }, [supplyOrders, supplier]);

  // Combined Ledger Entries (Invoices vs Payments)
  const statementEntries = useMemo(() => {
    let entries: Array<{
      id: string;
      date: string;
      reference: string;
      description: string;
      credit: number; // دائن (التزام علينا للمورد - قيمة الفاتورة)
      debit: number;  // مدين (سددنا للمورد / خفض المديونية)
      balance: number;
    }> = [];

    filteredSupplyOrders.forEach(so => {
      const grandTotal = so.grandTotal || so.totalCost || 0;
      const isPaid = so.paymentMethod !== 'credit'; // cash, treasury, partner, custody are paid upfront

      entries.push({
        id: `so-${so.id}`,
        date: so.date || new Date().toISOString(),
        reference: so.referenceNumber || `ORD-${so.id.slice(-6)}`,
        description: `فاتورة توريد بضاعة (${so.paymentMethod === 'credit' ? 'آجل' : 'مسددة فوراً'}) - ${so.items?.length || 0} أصناف`,
        credit: grandTotal,
        debit: isPaid ? grandTotal : 0,
        balance: 0
      });
    });

    // Sort by Date Ascending for Running Balance calculation
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate Running Balance (For Supplier, Credit increases liability, Debit decreases liability)
    let runningBalance = 0;
    entries = entries.map(entry => {
      runningBalance += (entry.credit - entry.debit);
      return {
        ...entry,
        balance: runningBalance
      };
    });

    // Reverse for display (Newest First)
    return entries.reverse();
  }, [filteredSupplyOrders]);

  // Filtered Entries
  const filteredEntries = useMemo(() => {
    return statementEntries.filter(entry => {
      if (dateFilter === 'this_month') {
        const d = new Date(entry.date);
        const now = new Date();
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
      } else if (dateFilter === 'last_30') {
        const d = new Date(entry.date).getTime();
        const past = Date.now() - (30 * 24 * 60 * 60 * 1000);
        if (d < past) return false;
      } else if (dateFilter === 'custom') {
        if (startDate && new Date(entry.date) < new Date(startDate)) return false;
        if (endDate && new Date(entry.date) > new Date(endDate)) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          entry.reference.toLowerCase().includes(q) ||
          entry.description.toLowerCase().includes(q) ||
          entry.debit.toString().includes(q) ||
          entry.credit.toString().includes(q)
        );
      }

      return true;
    });
  }, [statementEntries, dateFilter, startDate, endDate, searchQuery]);

  // Totals
  const totals = useMemo(() => {
    const totalCredit = filteredEntries.reduce((s, e) => s + e.credit, 0);
    const totalDebit = filteredEntries.reduce((s, e) => s + e.debit, 0);
    const netBalance = supplier.balance || 0;
    return { totalCredit, totalDebit, netBalance };
  }, [filteredEntries, supplier]);

  const handleExportExcel = () => {
    const rows = filteredEntries.map((e, idx) => ({
      'م': idx + 1,
      'التاريخ': new Date(e.date).toLocaleDateString('ar-EG'),
      'المرجع / الرقم': e.reference,
      'البيان والتفاصيل': e.description,
      'دائن (قيمة الفاتورة)': e.credit,
      'مدين (المسدد للمورد)': e.debit,
      'رصيد مديونية المورد': e.balance
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "كشف حساب المورد");
    XLSX.writeFile(wb, `كشف_حساب_مورد_${supplier.name.replace(/\s+/g, '_')}.xlsx`);
  };

  const handlePrint = () => {
    const printHTML = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>كشف حساب مورد - ${supplier.name}</title>
        <style>
          body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; padding: 25px; color: #1e293b; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: center; border-b: 3px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
          .title { font-size: 22px; font-weight: 900; color: #0c4a6e; margin: 0; }
          .store-name { font-size: 16px; font-weight: 700; color: #0284c7; }
          .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: #f0f9ff; padding: 15px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #bae6fd; font-size: 13px; }
          .info-item { font-weight: bold; }
          .info-item span { color: #64748b; font-weight: normal; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: right; }
          th { background-color: #0284c7; color: white; font-weight: bold; text-align: center; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .num { font-family: sans-serif; text-align: center; font-weight: bold; }
          .summary-box { display: flex; justify-content: space-between; background: #e0f2fe; border: 2px solid #0284c7; padding: 15px; border-radius: 12px; margin-top: 25px; font-weight: bold; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; text-align: center; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">🏢 كشف حساب تفصيلي للموكل / المورد</h1>
            <div style="font-size: 13px; color: #64748b; margin-top: 5px;">تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')}</div>
          </div>
          <div class="store-name">${settings.storeName || 'متجرنا الإلكتروني'}</div>
        </div>

        <div class="info-grid">
          <div class="info-item">اسم الموكل / المورد: <span>${supplier.name}</span></div>
          <div class="info-item">رقم الهاتف: <span class="num">${supplier.phone || '-'}</span></div>
          <div class="info-item">العنوان: <span>${supplier.address || '-'}</span></div>
          <div class="info-item">عدد المعاملات/التوريدات: <span class="num">${filteredSupplyOrders.length} حركات</span></div>
          <div class="info-item">رصيد مستحقات الموكل: <span class="num" style="color: #059669; font-size: 15px;">${(supplier.balance || 0).toLocaleString()} ج.م</span></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px;">م</th>
              <th>التاريخ</th>
              <th>المرجع / الرقم</th>
              <th>البيان والتفاصيل</th>
              <th>دائن (مستحقات البضاعة/التوريد)</th>
              <th>مدين (المحول/المسدد)</th>
              <th>رصيد المحفظة المستحق</th>
            </tr>
          </thead>
          <tbody>
            ${filteredEntries.map((e, idx) => `
              <tr>
                <td class="num">${idx + 1}</td>
                <td class="num">${new Date(e.date).toLocaleDateString('ar-EG')}</td>
                <td class="num">${e.reference}</td>
                <td>${e.description}</td>
                <td class="num" style="color: #0284c7;">${e.credit > 0 ? e.credit.toLocaleString() + ' ج.م' : '-'}</td>
                <td class="num" style="color: #10b981;">${e.debit > 0 ? e.debit.toLocaleString() + ' ج.م' : '-'}</td>
                <td class="num">${e.balance.toLocaleString()} ج.م</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="summary-box">
          <div>إجمالي قيمة البضائع الموردة (دائن): ${totals.totalCredit.toLocaleString()} ج.m</div>
          <div>إجمالي المسدد والمحول للمورد (مدين): ${totals.totalDebit.toLocaleString()} ج.م</div>
          <div style="color: #e11d48; font-size: 16px;">الصافي المتبقي للمورد بذمتنا: ${totals.netBalance.toLocaleString()} ج.م</div>
        </div>

        <div class="footer">
          <div>توقيع وتصديق المسؤول المالي: .............................</div>
          <div>توقيع واقرار المورد/الشركة: .............................</div>
        </div>
      </body>
      </html>
    `;
    printHTMLDirectly(printHTML);
  };

  return (
    <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-600/30 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <Building2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black flex items-center gap-2">
                <span>كشف حساب تفصيلي للمورد</span>
                <span className="text-xs font-bold px-3 py-1 bg-sky-500/20 text-sky-300 rounded-full border border-sky-500/30">
                  {supplier.name}
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                سجل التوريدات والفواتير ومستحقات المورد والسدادات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-black text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-sky-600/20 cursor-pointer"
            >
              <Printer size={15} /> طباعة رسمية
            </button>

            <button
              onClick={handleExportExcel}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <Download size={15} /> تصدير Excel
            </button>

            <button
              onClick={onClose}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body / Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-right">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[11px] font-black text-slate-400 uppercase block">بيانات المورد / الشركة</span>
              <div className="font-extrabold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Building2 size={16} className="text-sky-500" />
                <span>{supplier.name}</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono font-bold flex items-center gap-1">
                <Phone size={12} />
                <span>{supplier.phone || 'غير مسجل'}</span>
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/40 space-y-1">
              <span className="text-[11px] font-black text-sky-600 dark:text-sky-400 uppercase block">إجمالي المسدد للمورد</span>
              <div className="font-black text-sky-600 dark:text-sky-400 text-2xl font-mono">
                {totals.totalDebit.toLocaleString()} <span className="text-xs font-bold">ج.م</span>
              </div>
              <span className="text-[10px] text-slate-400 font-bold block">نقداً أو عبر تحويلات الخزينة</span>
            </div>

            <div className="p-5 rounded-3xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 space-y-1">
              <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase block">صافي مستحقات الموكل / المورد</span>
              <div className="font-black text-emerald-600 dark:text-emerald-400 text-2xl font-mono">
                {(supplier.balance || 0).toLocaleString()} <span className="text-xs font-bold">ج.م</span>
              </div>
              <span className="text-[10px] text-slate-400 font-bold block">رصيد محفظة الموكل المتاح</span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-400">تصفية الفترة:</span>
              {(['all', 'this_month', 'last_30', 'custom'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setDateFilter(f)}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    dateFilter === f 
                      ? 'bg-sky-600 text-white shadow-xs' 
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {f === 'all' ? 'جميع الأوقات' : f === 'this_month' ? 'الشهر الحالي' : f === 'last_30' ? 'آخر 30 يوم' : 'مخصص'}
                </button>
              ))}

              {dateFilter === 'custom' && (
                <div className="flex items-center gap-2 mr-2">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-1.5 bg-white dark:bg-slate-900 border rounded-xl" />
                  <span>إلى</span>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-1.5 bg-white dark:bg-slate-900 border rounded-xl" />
                </div>
              )}
            </div>

            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute right-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="بحث بالرقم أو البيان..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Statement Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-black">
                <tr>
                  <th className="p-3.5 text-center w-12">م</th>
                  <th className="p-3.5">التاريخ</th>
                  <th className="p-3.5">المرجع</th>
                  <th className="p-3.5">البيان والتفاصيل</th>
                  <th className="p-3.5 text-center text-sky-600">دائن (قيمة البضاعة)</th>
                  <th className="p-3.5 text-center text-emerald-600">مدين (المسدد للمورد)</th>
                  <th className="p-3.5 text-left">رصيد مستحقات المحفظة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">
                      لا توجد حركات توريد مسجلة لهذا المورد.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry, idx) => (
                    <tr key={entry.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3.5 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-3.5 font-mono text-[11px] whitespace-nowrap">
                        {new Date(entry.date).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="p-3.5 font-mono font-black text-sky-600 dark:text-sky-400">
                        {entry.reference}
                      </td>
                      <td className="p-3.5 font-bold max-w-xs truncate" title={entry.description}>
                        {entry.description}
                      </td>
                      <td className="p-3.5 text-center font-black font-mono text-sky-600 dark:text-sky-400">
                        {entry.credit > 0 ? `${entry.credit.toLocaleString()} ج.م` : '-'}
                      </td>
                      <td className="p-3.5 text-center font-black font-mono text-emerald-600 dark:text-emerald-400">
                        {entry.debit > 0 ? `${entry.debit.toLocaleString()} ج.م` : '-'}
                      </td>
                      <td className="p-3.5 text-left font-black font-mono text-slate-900 dark:text-white">
                        {entry.balance.toLocaleString()} ج.م
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs font-bold shrink-0">
          <span className="text-slate-400">
            عدد الفواتير المسجلة: {filteredEntries.length} حركات
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded-xl font-extrabold cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
