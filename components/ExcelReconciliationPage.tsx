import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { StoreData, Order, OrderStatus } from '../types';
import { 
  FileSpreadsheet, Upload, AlertCircle, CheckCircle, 
  RefreshCw, TrendingUp, DollarSign, ArrowRight, Download, 
  Check, Play, HelpCircle, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

interface ExcelReconciliationPageProps {
  allStoresData: Record<string, StoreData>;
  updateStoreData: (storeId: string, updater: (draft: StoreData) => void) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface RowData {
  trackingOrId: string;
  collectedAmount: number;
  sheetStatus: string;
  originalRow: any;
}

interface ReconciliationItem {
  id: string;
  trackingOrId: string;
  excelAmount: number;
  excelStatus: string;
  matchedOrder: Order | null;
  matchType: 'perfect_match' | 'amount_mismatch' | 'status_mismatch' | 'not_found';
  notes: string;
}

export default function ExcelReconciliationPage({ allStoresData, updateStoreData, showToast: externalShowToast }: ExcelReconciliationPageProps) {
  const { storeId } = useParams<{ storeId: string }>();
  const storeData = storeId ? allStoresData[storeId] : null;
  const orders = storeData?.orders || [];
  
  // File upload state
  const [file, setFile] = useState<File | null>(null);
  const [sheetData, setSheetData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Column mapping state
  const [trackingCol, setTrackingCol] = useState('');
  const [amountCol, setAmountCol] = useState('');
  const [statusCol, setStatusCol] = useState('');

  // Results state
  const [reconciledItems, setReconciledItems] = useState<ReconciliationItem[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'perfect' | 'discrepancy' | 'not_found'>('all');

  // Internal toast state
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    if (externalShowToast) {
      externalShowToast(msg, type);
    }
    setToast({ msg, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Process Excel File with XLSX
  const processFile = (file: File) => {
    setFile(file);
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (json.length === 0) {
          showToast('الملف المرفوع فارغ!', 'error');
          setIsProcessing(false);
          return;
        }

        // Get headers
        const firstRow = json[0] as Record<string, any>;
        const cols = Object.keys(firstRow);
        setHeaders(cols);
        setSheetData(json);

        // Auto-detect columns based on common names in Egyptian shipping companies (e.g. Bosta, Mylerz)
        const trCol = cols.find(c => 
          c.toLowerCase().includes('tracking') || 
          c.toLowerCase().includes('waybill') || 
          c.includes('بوليصة') || 
          c.includes('بوليصه') || 
          c.includes('رقم الشحنة') || 
          c.includes('رقم الشحنه') ||
          c.includes('الطلب') ||
          c.includes('كود')
        ) || '';
        
        const amCol = cols.find(c => 
          c.toLowerCase().includes('amount') || 
          c.toLowerCase().includes('collect') || 
          c.includes('مبلغ') || 
          c.includes('التحصيل') || 
          c.includes('المحصل') || 
          c.includes('قيمة') || 
          c.includes('المطلوب')
        ) || '';

        const stCol = cols.find(c => 
          c.toLowerCase().includes('status') || 
          c.includes('حالة') || 
          c.includes('حاله') || 
          c.includes('الوضع')
        ) || '';

        setTrackingCol(trCol || cols[0] || '');
        setAmountCol(amCol || cols[1] || '');
        setStatusCol(stCol || cols[2] || '');

        showToast('تم قراءة ملف الاكسيل بنجاح، يرجى تأكيد مطابقة الأعمدة.', 'success');
      } catch (err) {
        console.error(err);
        showToast('فشل في قراءة ملف الاكسيل. تأكد من صيغة الملف.', 'error');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Perform Reconciliation Match
  const handleReconcile = () => {
    if (!trackingCol) {
      showToast('يرجى تحديد عامود بوليصة الشحن أو المعرف', 'error');
      return;
    }

    setIsProcessing(true);
    const results: ReconciliationItem[] = [];

    sheetData.forEach((row, idx) => {
      const trackingRaw = String(row[trackingCol] || '').trim();
      const excelAmountRaw = parseFloat(row[amountCol]) || 0;
      const excelStatusRaw = String(row[statusCol] || '').trim();

      if (!trackingRaw) return; // skip empty rows

      // Search store orders by waybillNumber, orderNumber, platformOrderId or trackingUrl
      const matchedOrder = orders.find(o => 
        (o.waybillNumber && o.waybillNumber.trim() === trackingRaw) ||
        (o.orderNumber && o.orderNumber.trim() === trackingRaw) ||
        (o.id && o.id === trackingRaw) ||
        (o.platformOrderId && o.platformOrderId.trim() === trackingRaw)
      ) || null;

      let matchType: ReconciliationItem['matchType'] = 'not_found';
      let notes = '';

      if (matchedOrder) {
        const orderPrice = matchedOrder.totalPrice || matchedOrder.productPrice || 0;
        const amountDiff = Math.abs(orderPrice - excelAmountRaw);

        // Map typical arabic sheet statuses to matched statuses
        const statusClean = excelStatusRaw.toLowerCase();
        const isDeliveredSheet = statusClean.includes('delivered') || statusClean.includes('تم التوصيل') || statusClean.includes('تم التسليم') || statusClean.includes('محصل') || statusClean.includes('ناجح');
        const isDeliveredOrder = ['تم_التوصيل', 'تم_التحصيل', 'تم_توصيلها'].includes(matchedOrder.status);

        if (amountDiff <= 1) {
          // Amount matches (allow 1 L.E. rounding diff)
          if (isDeliveredSheet && isDeliveredOrder) {
            matchType = 'perfect_match';
            notes = 'مطابقة تامة للمبلغ والحالة';
          } else if (isDeliveredSheet && !isDeliveredOrder) {
            matchType = 'status_mismatch';
            notes = `الشحنة محصلة في الشيت، بينما حالتها في النظام: ${matchedOrder.status}`;
          } else {
            matchType = 'perfect_match';
            notes = 'مطابقة المبلغ مع حالة شيت موازية';
          }
        } else {
          // Amount mismatch
          matchType = 'amount_mismatch';
          notes = `اختلاف قيمة: المتجر (${orderPrice.toLocaleString()}) ج.م | الشيت (${excelAmountRaw.toLocaleString()}) ج.م`;
        }
      } else {
        matchType = 'not_found';
        notes = 'رقم البوليصة غير متوفر بقاعدة بيانات المتجر الحالي';
      }

      results.push({
        id: `recon_${idx}`,
        trackingOrId: trackingRaw,
        excelAmount: excelAmountRaw,
        excelStatus: excelStatusRaw,
        matchedOrder,
        matchType,
        notes
      });
    });

    setReconciledItems(results);
    setIsProcessing(false);
    showToast(`اكتملت المطابقة لـ ${results.length} طلب! تم كشف الملاحظات بنجاح.`, 'success');
  };

  // Bulk process and resolve status mismatches
  const handleBulkUpdateStatuses = () => {
    if (!storeId) return;
    const mismatches = reconciledItems.filter(item => item.matchType === 'status_mismatch' && item.matchedOrder);
    if (mismatches.length === 0) {
      showToast('لا توجد شحنات بحاجة لتحديث الحالة حالياً', 'error');
      return;
    }

    updateStoreData(storeId, (draft) => {
      mismatches.forEach(item => {
        const orderIndex = draft.orders.findIndex(o => o.id === item.matchedOrder?.id);
        if (orderIndex > -1) {
          draft.orders[orderIndex].status = 'تم_التوصيل';
        }
      });

      // Log bulk action
      draft.settings.activityLogs = [
        {
          id: `log_recon_${Date.now()}`,
          user: 'النظام المالي',
          action: 'تحديث جماعي لحالات الشحن',
          details: `تم تحديث حالة ${mismatches.length} طلب تلقائياً من مطابقة كشف إكسيل شركة الشحن إلى حالة (تم التوصيل).`,
          date: new Date().toLocaleString('ar-EG'),
          timestamp: Date.now()
        },
        ...(draft.settings.activityLogs || [])
      ];
    });

    // Re-trigger match after state updates
    showToast(`تم التحديث الجماعي لـ ${mismatches.length} أوردر بنجاح!`, 'success');
    setReconciledItems(prev => prev.map(item => {
      if (item.matchType === 'status_mismatch') {
        return {
          ...item,
          matchType: 'perfect_match',
          notes: 'تمت مطابقتها وتصحيح الحالة جماعياً'
        };
      }
      return item;
    }));
  };

  // Export Reconciliation results to clean Excel
  const handleExportReconciliation = () => {
    const dataToExport = reconciledItems.map(item => ({
      'بوليصة الشحن / الكود': item.trackingOrId,
      'قيمة الشيت (ج.م)': item.excelAmount,
      'حالة الشيت': item.excelStatus,
      'الطلب المقابل بالمتجر': item.matchedOrder?.orderNumber || 'غير متوفر',
      'قيمة الطلب بالمتجر (ج.م)': item.matchedOrder?.totalPrice || item.matchedOrder?.productPrice || '-',
      'الحالة الحالية بالمتجر': item.matchedOrder?.status || 'غير متوفر',
      'نتيجة المطابقة والتحصيل': item.matchType === 'perfect_match' ? 'مطابق تام' : 
                                  item.matchType === 'amount_mismatch' ? 'اختلاف بالمبالغ' : 
                                  item.matchType === 'status_mismatch' ? 'اختلاف حالة الشحنة' : 'بوليصة غير مسجلة بالمتجر',
      'تفاصيل وملاحظات الفحص': item.notes
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "نتائج المطابقة المالية");
    XLSX.writeFile(workbook, `مطابقة_التحصيل_${storeId}_${new Date().toLocaleDateString('en-US')}.xlsx`);
    showToast('تم تصدير ملف المطابقة بنجاح', 'success');
  };

  // Computed summary metrics
  const stats = useMemo(() => {
    const total = reconciledItems.length;
    const perfect = reconciledItems.filter(i => i.matchType === 'perfect_match').length;
    const amountMismatch = reconciledItems.filter(i => i.matchType === 'amount_mismatch').length;
    const statusMismatch = reconciledItems.filter(i => i.matchType === 'status_mismatch').length;
    const notFound = reconciledItems.filter(i => i.matchType === 'not_found').length;

    const totalExcelAmount = reconciledItems.reduce((sum, i) => sum + i.excelAmount, 0);
    const totalStoreAmount = reconciledItems.reduce((sum, i) => sum + (i.matchedOrder?.totalPrice || i.matchedOrder?.productPrice || 0), 0);

    return {
      total,
      perfect,
      amountMismatch,
      statusMismatch,
      notFound,
      totalExcelAmount,
      totalStoreAmount
    };
  }, [reconciledItems]);

  const viewableItems = useMemo(() => {
    if (activeTab === 'all') return reconciledItems;
    if (activeTab === 'perfect') return reconciledItems.filter(i => i.matchType === 'perfect_match');
    if (activeTab === 'discrepancy') return reconciledItems.filter(i => i.matchType === 'amount_mismatch' || i.matchType === 'status_mismatch');
    return reconciledItems.filter(i => i.matchType === 'not_found');
  }, [reconciledItems, activeTab]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-8 space-y-8" id="reconciliation-page-root">
      
      {/* Header breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <FileSpreadsheet className="text-emerald-500" /> مطابقة ومصالحة كشوف إكسيل شركات الشحن
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1">طابق المبالغ المستلمة وحالات الأوردرات مع كشوف شركات الشحن بضغطة زر</p>
        </div>
        <Link 
          to={`/store/${storeId}/dashboard`}
          className="text-xs font-black text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors"
        >
          <ArrowRight size={14} /> العودة للوحة التحكم الرئيسية
        </Link>
      </div>

      {/* File Dropzone & Configuration UI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Step 1: Upload File */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="space-y-1">
            <h3 className="text-md font-black text-slate-800 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-[10px] font-black flex items-center justify-center">1</span>
              <span>رفع كشف شركة الشحن (Excel)</span>
            </h3>
            <p className="text-[11px] text-slate-400 font-bold">اسحب الملف أو اختره من جهازك لقراءة البيانات وتطابقها</p>
          </div>

          <div 
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center cursor-pointer hover:border-emerald-500 hover:bg-slate-50 dark:hover:bg-slate-850 transition-all group relative"
          >
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="space-y-4">
              <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform shadow-inner">
                <Upload size={28} />
              </div>
              <div>
                <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                  {file ? file.name : 'اسحب كشف الإكسيل هنا أو اضغط للتصفح'}
                </p>
                <p className="text-[10px] text-slate-400 font-bold mt-1">يدعم صيغ Excel (.xlsx, .xls) وكشوف الـ CSV</p>
              </div>
            </div>
          </div>

          {/* Quick guide */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 flex items-start gap-3">
            <Info className="text-indigo-500 flex-shrink-0 mt-0.5" size={16} />
            <div className="space-y-1 text-[11px] leading-relaxed text-slate-500 font-bold">
              <p>💡 <strong className="text-slate-700 dark:text-slate-300">طريقة العمل الذكية:</strong> سيقوم النظام بمطابقة أرقام البوالص أو أرقام الأوردرات في الشيت مع الأوردرات المسجلة بمتجرك، ثم يقارن المبلغ المحصل وحالة التوصيل لإبراز أي اختلاف مالي أو مديونية فوراً.</p>
            </div>
          </div>
        </div>

        {/* Step 2: Mapping Configuration */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <h3 className="text-md font-black text-slate-800 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-black flex items-center justify-center">2</span>
              <span>مطابقة مسميات الأعمدة</span>
            </h3>
            <p className="text-xs font-bold text-slate-400 leading-relaxed">تأكد من اختيار المسميات المقابلة للبيانات في ملف الإكسيل الذي قمت برفعه لتجنب القراءة الخاطئة.</p>

            {headers.length > 0 ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5">عامود رقم البوليصة أو معرف الطلب</label>
                  <select 
                    value={trackingCol} 
                    onChange={e => setTrackingCol(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 font-bold"
                  >
                    <option value="">-- اختر العمود --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5">عامود المبلغ المحصل فعلياً</label>
                  <select 
                    value={amountCol} 
                    onChange={e => setAmountCol(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 font-bold"
                  >
                    <option value="">-- اختر العمود --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5">عامود حالة التوصيل بالشيت</label>
                  <select 
                    value={statusCol} 
                    onChange={e => setStatusCol(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 font-bold"
                  >
                    <option value="">-- اختر العمود --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 font-bold italic text-xs">
                يرجى رفع ملف إكسيل أولاً لتفعيل الخيارات
              </div>
            )}
          </div>

          <button
            onClick={handleReconcile}
            disabled={sheetData.length === 0 || isProcessing}
            className={`w-full py-3.5 rounded-2xl font-black text-xs text-white transition-all shadow-xl flex items-center justify-center gap-2 ${sheetData.length > 0 ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/25' : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed shadow-none'}`}
          >
            {isProcessing ? <RefreshCw className="animate-spin" size={14} /> : <Play size={14} />}
            <span>بدء مطابقة ومصادقة البيانات</span>
          </button>
        </div>

      </div>

      {/* Results & Statistics Summary Panel */}
      {reconciledItems.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Stats Cards Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in zoom-in-95 duration-300">
            {/* Checked items */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="space-y-1">
                <h5 className="text-xs font-bold text-slate-500">إجمالي الأسطر المفحوصة</h5>
                <p className="text-3xl font-black text-slate-800 dark:text-white">{stats.total}</p>
                <p className="text-[9px] text-slate-400 font-bold">بوالص مدرجة في ملف الشحن</p>
              </div>
            </div>

            {/* Perfect Match */}
            <div className="bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-200/50 p-5 rounded-3xl relative overflow-hidden">
              <div className="space-y-1">
                <h5 className="text-xs font-bold text-emerald-600">مطابقات تامة (ناجحة)</h5>
                <p className="text-3xl font-black text-emerald-600">{stats.perfect}</p>
                <p className="text-[9px] text-slate-400 font-bold">مطابقة للقيمة وحالة الاستلام</p>
              </div>
            </div>

            {/* Price/Status Mismatches */}
            <div className="bg-rose-50/40 dark:bg-rose-950/10 border border-rose-200/50 p-5 rounded-3xl relative overflow-hidden">
              <div className="space-y-1">
                <h5 className="text-xs font-bold text-rose-600">الفروقات المكتشفة</h5>
                <p className="text-3xl font-black text-rose-600">{stats.amountMismatch + stats.statusMismatch}</p>
                <p className="text-[9px] text-slate-400 font-bold">اختلاف مبالغ محصلة أو حالات تسليم</p>
              </div>
            </div>

            {/* Financial Totals Compare */}
            <div className="bg-blue-50/40 dark:bg-blue-950/10 border border-blue-200/50 p-5 rounded-3xl relative overflow-hidden">
              <div className="space-y-1">
                <h5 className="text-xs font-bold text-blue-600">إجمالي المبالغ المحصلة بالشيت</h5>
                <p className="text-2xl font-black text-blue-600">{stats.totalExcelAmount.toLocaleString()} <span className="text-xs">ج.م</span></p>
                <p className="text-[9px] text-slate-400 font-bold">مقارنة بـ {stats.totalStoreAmount.toLocaleString()} ج.م في النظام</p>
              </div>
            </div>
          </div>

          {/* Table list and tabs */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            
            {/* Actions & Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Tab Navigation */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${activeTab === 'all' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  الكل ({stats.total})
                </button>
                <button
                  onClick={() => setActiveTab('perfect')}
                  className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${activeTab === 'perfect' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  مطابق تام ({stats.perfect})
                </button>
                <button
                  onClick={() => setActiveTab('discrepancy')}
                  className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${activeTab === 'discrepancy' ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  فروقات وملاحظات ({stats.amountMismatch + stats.statusMismatch})
                </button>
                <button
                  onClick={() => setActiveTab('not_found')}
                  className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${activeTab === 'not_found' ? 'bg-white dark:bg-slate-700 text-slate-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  غير مدرج بالمتجر ({stats.notFound})
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                {stats.statusMismatch > 0 && (
                  <button
                    onClick={handleBulkUpdateStatuses}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs transition-colors flex items-center gap-1"
                  >
                    <CheckCircle size={14} /> تحديث جماعي لحالات الأوردرات ({stats.statusMismatch})
                  </button>
                )}
                <button
                  onClick={handleExportReconciliation}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-750 dark:text-slate-200 rounded-xl font-black text-xs transition-colors flex items-center gap-1"
                >
                  <Download size={14} /> تصدير النتائج مصححة
                </button>
              </div>
            </div>

            {/* Comparison Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-black">
                    <th className="py-3 px-4">رقم البوليصة / الكود بالشيت</th>
                    <th className="py-3 px-4">المبلغ بالشيت</th>
                    <th className="py-3 px-4">حالة التوصيل بالشيت</th>
                    <th className="py-3 px-4">أوردر المتجر المقابل</th>
                    <th className="py-3 px-4">مبلغ ومصلحة المتجر</th>
                    <th className="py-3 px-4">حالة المطابقة</th>
                    <th className="py-3 px-4">توجيه وملاحظة الفحص</th>
                  </tr>
                </thead>
                <tbody>
                  {viewableItems.map((item) => {
                    return (
                      <tr key={item.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-black text-slate-700 dark:text-slate-300 font-mono">
                          {item.trackingOrId}
                        </td>
                        <td className="py-3.5 px-4 font-black">
                          {item.excelAmount.toLocaleString()} ج.م
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-bold">
                          {item.excelStatus || 'غير محدد'}
                        </td>
                        <td className="py-3.5 px-4 font-black text-indigo-600 dark:text-indigo-400">
                          {item.matchedOrder ? (
                            <Link to={`/store/${storeId}/orders/${item.matchedOrder.id}`} className="hover:underline">
                              {item.matchedOrder.orderNumber}
                            </Link>
                          ) : (
                            <span className="text-slate-400 italic">غير متوفر</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-bold">
                          {item.matchedOrder ? `${(item.matchedOrder.totalPrice || item.matchedOrder.productPrice || 0).toLocaleString()} ج.م` : '-'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            item.matchType === 'perfect_match' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400' :
                            item.matchType === 'amount_mismatch' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/20 dark:text-rose-400' :
                            item.matchType === 'status_mismatch' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400' :
                            'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {item.matchType === 'perfect_match' ? 'مطابق تام' : 
                             item.matchType === 'amount_mismatch' ? 'اختلاف بالقيمة' : 
                             item.matchType === 'status_mismatch' ? 'اختلاف بالحالة' : 'غير مدرج'}
                          </span>
                        </td>
                        <td className={`py-3.5 px-4 font-bold ${item.matchType === 'perfect_match' ? 'text-emerald-600' : item.matchType === 'not_found' ? 'text-slate-400' : 'text-rose-500'}`}>
                          {item.notes}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        </motion.div>
      )}

      {/* Floating internal toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl font-black text-xs text-white flex items-center gap-2 border ${
              toast.type === 'success' 
                ? 'bg-emerald-600 border-emerald-500 shadow-emerald-500/20' 
                : 'bg-rose-600 border-rose-500 shadow-rose-500/20'
            }`}
            dir="rtl"
          >
            {toast.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            <span>{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
