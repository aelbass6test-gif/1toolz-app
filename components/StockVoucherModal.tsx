import React, { useState } from 'react';
import { StockTransfer, StockTransferItem, Settings, Warehouse } from '../types';
import { 
  Printer, X, ArrowRightLeft, Package, Calendar, User, 
  MapPin, CheckCircle2, FileText, Download, Building2
} from 'lucide-react';
import { printHTMLDirectly } from '../utils/printHelper';
import * as XLSX from 'xlsx';

interface StockVoucherModalProps {
  transfer: StockTransfer;
  settings: Settings;
  onClose: () => void;
}

export const StockVoucherModal: React.FC<StockVoucherModalProps> = ({
  transfer,
  settings,
  onClose
}) => {
  const warehouses = settings.warehouses || [];
  const srcWarehouse = warehouses.find(w => w.id === transfer.sourceWarehouseId);
  const destWarehouse = warehouses.find(w => w.id === transfer.destinationWarehouseId);

  const handlePrint = () => {
    const printHTML = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>إذن تحويل مخزني - ${transfer.transferNumber}</title>
        <style>
          body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; padding: 25px; color: #1e293b; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: center; border-b: 3px solid #4f46e5; padding-bottom: 15px; margin-bottom: 20px; }
          .title { font-size: 22px; font-weight: 900; color: #1e1b4b; margin: 0; }
          .store-name { font-size: 16px; font-weight: 700; color: #4f46e5; }
          .route-box { display: flex; justify-content: space-between; align-items: center; background: #EEF2FF; border: 2px border-dashed #6366F1; padding: 15px 25px; border-radius: 12px; margin-bottom: 20px; font-size: 14px; font-weight: bold; }
          .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: #f8fafc; padding: 15px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #e2e8f0; font-size: 13px; }
          .info-item { font-weight: bold; }
          .info-item span { color: #64748b; font-weight: normal; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: right; }
          th { background-color: #4f46e5; color: white; font-weight: bold; text-align: center; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .num { font-family: sans-serif; text-align: center; font-weight: bold; }
          .signatures { margin-top: 50px; display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; font-size: 12px; color: #475569; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">🚚 إذن تحويل وصرف مخزني بين المستودعات</h1>
            <div style="font-size: 13px; color: #64748b; margin-top: 5px;">رقم الإذن: ${transfer.transferNumber} | التاريخ: ${new Date(transfer.date).toLocaleDateString('ar-EG')}</div>
          </div>
          <div class="store-name">${settings.storeName || 'إدارة المستودعات المركزية'}</div>
        </div>

        <div class="route-box">
          <div>مستودع المصدر (الخارج منه): <span style="color: #e11d48;">${srcWarehouse?.name || 'مستودع محدد'}</span></div>
          <div style="font-size: 18px;">⬅️</div>
          <div>المستودع المستلم (الداخل إليه): <span style="color: #10b981;">${destWarehouse?.name || 'مستودع محدد'}</span></div>
        </div>

        <div class="info-grid">
          <div class="info-item">المنفذ / أمين المخزن: <span>${transfer.performedBy || 'النظام'}</span></div>
          <div class="info-item">حالة الإذن: <span style="color: #10b981;">مكتمل ومعتمد ✅</span></div>
          <div class="info-item">عدد أصناف التحويل: <span class="num">${transfer.items.length} أصناف</span></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px;">م</th>
              <th>اسم الصنف / المنتج</th>
              <th>SKU / كود المنتج</th>
              <th>الكمية المحولة (عدد)</th>
            </tr>
          </thead>
          <tbody>
            ${transfer.items.map((item, idx) => `
              <tr>
                <td class="num">${idx + 1}</td>
                <td>${item.name}</td>
                <td class="num">${item.sku || '-'}</td>
                <td class="num" style="font-size: 14px; color: #4f46e5;">${item.quantity}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${transfer.notes ? `<div style="margin-top: 20px; padding: 12px; background: #fffbebfb; border: 1px solid #fef3c7; border-radius: 8px; font-size: 12px; font-weight: bold;">📝 ملاحظات التحويل: ${transfer.notes}</div>` : ''}

        <div class="signatures">
          <div>توقيع أمين مخزن المصرف (المصدر):<br><br>......................................</div>
          <div>توقيع المندوب / السائق الناقل:<br><br>......................................</div>
          <div>توقيع أمين المستودع المستلم:<br><br>......................................</div>
        </div>
      </body>
      </html>
    `;
    printHTMLDirectly(printHTML);
  };

  return (
    <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] text-right">
        
        {/* Header Bar */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <ArrowRightLeft size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black flex items-center gap-2">
                <span>إذن تحويل وتسليم مخزني</span>
                <span className="text-xs font-bold px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30 font-mono">
                  {transfer.transferNumber}
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                تاريخ الإذن: {new Date(transfer.date).toLocaleString('ar-EG')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              <Printer size={15} /> طباعة رسمية
            </button>
            <button
              onClick={onClose}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Route Card */}
          <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-rose-500 uppercase block">المستودع المنصرف منه (المصدر)</span>
              <div className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 size={16} className="text-rose-500" />
                <span>{srcWarehouse?.name || 'مستودع غير مسمى'}</span>
              </div>
            </div>

            <div className="p-2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-full">
              <ArrowRightLeft size={20} />
            </div>

            <div className="space-y-1 sm:text-left">
              <span className="text-[10px] font-black text-emerald-500 uppercase block">المستودع المستلم (الوجهة)</span>
              <div className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 size={16} className="text-emerald-500" />
                <span>{destWarehouse?.name || 'مستودع غير مسمى'}</span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-black">
                <tr>
                  <th className="p-3 text-center w-12">م</th>
                  <th className="p-3">اسم المنتج / الصنف</th>
                  <th className="p-3 font-mono">كود SKU</th>
                  <th className="p-3 text-center">الكمية المحولة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold text-slate-800 dark:text-slate-200">
                {transfer.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3">{item.name}</td>
                    <td className="p-3 font-mono text-slate-500">{item.sku || '-'}</td>
                    <td className="p-3 text-center font-black text-indigo-600 dark:text-indigo-400 text-sm font-mono">
                      {item.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Attachments Preview if present */}
          {transfer.attachments && transfer.attachments.length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 block">المستندات المرفقة بالإذن:</span>
              <div className="flex gap-2 overflow-x-auto">
                {transfer.attachments.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="w-16 h-16 rounded-xl overflow-hidden border bg-black/10 shrink-0 block">
                    <img src={url} alt={`مرفق ${i+1}`} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
          <span className="text-xs font-bold text-slate-400">
            تم التنفيذ بواسطة: {transfer.performedBy || 'النظام'}
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded-xl font-extrabold text-xs cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
