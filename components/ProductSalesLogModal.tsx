import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Calendar, Package, TrendingUp, TrendingDown, CheckCircle, 
  ShoppingCart, Eye, FileText, RotateCw, Receipt, Printer, XCircle, 
  Truck, Clock, Filter, AlertTriangle, ArrowUpRight, ArrowDownLeft, Ban
} from 'lucide-react';
import { Order, Product, Settings, SupplyOrder, PurchaseReturn } from '../types';
import { OrderDetailsModal } from './OrderDetailsModal';
import { generateSupplyOrderInvoiceHTML } from '../utils/financials';

interface ProductSalesLogModalProps {
  product: Product;
  orders: Order[];
  settings: Settings;
  onClose: () => void;
}

export const generateProductLogPrintHTML = (
  product: Product,
  sales: { order: Order; itemInfo: any }[],
  purchases: any[],
  salesStats: {
    deliveredQty: number;
    deliveredRevenue: number;
    inProgressQty: number;
    returnedCount: number;
    returnedQty: number;
    exchangedCount: number;
    exchangedQty: number;
    failedDeliveryCount: number;
    failedDeliveryQty: number;
    cancelledCount: number;
    cancelledQty: number;
    totalOrdersCount: number;
  },
  purchaseStats: {
    totalQuantityPurchased: number;
    totalPurchaseCost: number;
    totalQuantityPurchaseReturned: number;
    totalPurchaseReturnedCost: number;
    netBalance: number;
  },
  settings: Settings
): string => {
  const companyName = (settings as any).companyName || settings.companyNames?.[0] || 'مدير الأوردرات الذكي';
  const logoUrl = (settings as any).logoUrl || settings.customization?.logoUrl;
  const printDate = new Date().toLocaleString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const salesRows = sales.map(({ order, itemInfo }, index) => {
    const st = String(order.status || '').trim();
    const isDelivered = ['تم_التوصيل', 'تم_توصيلها', 'delivered', 'تم_التحصيل', 'مدفوعة', 'مكتمل', 'completed'].includes(st);
    const isReturned = ['مرتجع', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام', 'returned', 'partially_returned'].includes(st);
    const isExchanged = ['تم_الاستبدال', 'استبدال', 'exchanged', 'replaced'].includes(st);
    const isFailedDelivery = ['فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'failed_delivery', 'returned_to_shipper'].includes(st);
    const isCancelled = ['ملغي', 'cancelled'].includes(st);

    let statusText: string = String(order.status || '');
    let badgeClass = 'bg-slate-100 text-slate-700';

    if (isDelivered) {
      statusText = st === 'تم_التحصيل' ? 'تم التحصيل' : 'تم التوصيل';
      badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    } else if (isExchanged) {
      statusText = 'تم الاستبدال';
      badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
    } else if (isReturned) {
      statusText = st === 'مرتجع_جزئي' ? 'مرتجع جزئي' : st === 'مرتجع_بعد_الاستلام' ? 'مرتجع بعد الاستلام' : 'مرتجع';
      badgeClass = 'bg-rose-100 text-rose-800 border-rose-300';
    } else if (isFailedDelivery) {
      statusText = 'فشل التوصيل';
      badgeClass = 'bg-purple-100 text-purple-800 border-purple-300';
    } else if (isCancelled) {
      statusText = 'ملغي';
      badgeClass = 'bg-red-100 text-red-800 border-red-300 line-through';
    } else {
      statusText = 'قيد التوصيل / المعالجة';
      badgeClass = 'bg-sky-100 text-sky-800 border-sky-300';
    }

    const qty = itemInfo.quantity || 0;
    const price = itemInfo.price || 0;
    const total = qty * price;
    const dateStr = order.date ? new Date(order.date).toLocaleDateString('ar-EG') : '-';
    const orderNum = order.orderNumber || order.referenceNumber || order.id.substring(0, 8);
    const customer = order.customerName || 'عميل نقدي';
    const location = [order.governorate, order.city].filter(Boolean).join(' - ') || '-';
    const payment = order.paymentMethod === 'cash' ? 'كاش' : order.paymentMethod || 'عام';

    return `
      <tr class="${isCancelled ? 'cancelled-row' : ''}">
        <td style="text-align:center;">${index + 1}</td>
        <td style="text-align:center; font-family: monospace;">${dateStr}</td>
        <td style="font-weight:bold; font-family: monospace; color: #4338ca;">#${orderNum}</td>
        <td>${customer}</td>
        <td>${location}</td>
        <td style="text-align:center; font-weight:bold;">${qty}</td>
        <td style="text-align:center;">${price.toLocaleString()} ج.م</td>
        <td style="text-align:center; font-weight:bold; ${isCancelled ? 'text-decoration: line-through; color: #94a3b8;' : ''}">${total.toLocaleString()} ج.م</td>
        <td style="text-align:center;">
          <span class="badge ${badgeClass}">${statusText}</span>
        </td>
        <td style="text-align:center; font-size: 11px;">${payment}</td>
      </tr>
    `;
  }).join('');

  const purchaseRows = purchases.map(({ type, number, date, supplierId, itemInfo, rawOrder, rawReturn }, index) => {
    const supplier = settings.suppliers?.find(s => s.id === supplierId);
    const suppName = supplier?.name || rawReturn?.supplierName || 'مورد عام';
    const qty = itemInfo.reduce((sum: number, item: any) => {
      if (type === 'purchase') {
        const q = (item.receivedQuantity !== undefined && item.receivedQuantity !== null) 
          ? Number(item.receivedQuantity) 
          : (Number(item.quantity) || 0);
        return sum + q + (Number(item.bonusQuantity) || 0);
      }
      return sum + (item.quantity || 0);
    }, 0);

    const rowTotal = itemInfo.reduce((sum: number, item: any) => {
      if (type === 'purchase') {
        const rawCost = Number(item.cost) || 0;
        const discountVal = Number(item.discountValue) || 0;
        const discountAmt = discountVal ? (item.discountType === 'percentage' ? (rawCost * discountVal / 100) : discountVal) : 0;
        const netUnitCost = Math.max(0, rawCost - discountAmt);
        const paidQty = (item.receivedQuantity !== undefined && item.receivedQuantity !== null) 
          ? Number(item.receivedQuantity) 
          : (Number(item.quantity) || 0);
        return sum + (paidQty * netUnitCost);
      }
      const c = Number(item.costPrice || item.cost) || 0;
      const q = Number(item.quantity) || 0;
      return sum + (c * q);
    }, 0);

    const dateStr = date ? new Date(date).toLocaleDateString('ar-EG') : '-';
    const typeTag = type === 'purchase' 
      ? '<span class="badge bg-emerald-100 text-emerald-800">شراء وتوريد</span>'
      : '<span class="badge bg-rose-100 text-rose-800">مرتجع شراء</span>';

    return `
      <tr>
        <td style="text-align:center;">${index + 1}</td>
        <td style="text-align:center; font-family: monospace;">${dateStr}</td>
        <td style="font-weight:bold; font-family: monospace; color: #4338ca;">${number}</td>
        <td>${suppName}</td>
        <td style="text-align:center;">${typeTag}</td>
        <td style="text-align:center; font-weight:bold;">${qty}</td>
        <td style="text-align:center; font-weight:bold;">${rowTotal.toLocaleString()} ج.م</td>
      </tr>
    `;
  }).join('');

  const productCostPrice = product.costPrice || (product as any).cost || 0;
  const productCategory = (product as any).category || 'عام';

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير حركة منتج - ${product.name}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Cairo', sans-serif;
          background: #f8fafc;
          color: #0f172a;
          padding: 24px;
          direction: rtl;
          font-size: 12px;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        @media print {
          body { background: #fff; padding: 0; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
        .header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 16px;
          border-bottom: 2px solid #e2e8f0;
          margin-bottom: 20px;
        }
        .logo-box {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .logo-box img {
          max-height: 50px;
          border-radius: 8px;
        }
        .company-title {
          font-size: 18px;
          font-weight: 900;
          color: #1e293b;
        }
        .doc-title {
          font-size: 20px;
          font-weight: 900;
          color: #4338ca;
          text-align: center;
          margin-bottom: 16px;
        }
        .product-card {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 20px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        .info-item {
          display: flex;
          flex-direction: column;
        }
        .info-label {
          font-size: 11px;
          color: #64748b;
          font-weight: 700;
          margin-bottom: 2px;
        }
        .info-value {
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }
        .stat-box {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px;
          text-align: center;
        }
        .stat-box.emerald { border-color: #a7f3d0; background: #ecfdf5; }
        .stat-box.blue { border-color: #bae6fd; background: #f0f9ff; }
        .stat-box.rose { border-color: #fecdd3; background: #fff1f2; }
        .stat-box.amber { border-color: #fde68a; background: #fffbeb; }
        .stat-box.purple { border-color: #e9d5ff; background: #faf5ff; }
        .stat-box.red { border-color: #fca5a5; background: #fef2f2; }
        .stat-title { font-size: 10px; font-weight: 700; color: #475569; margin-bottom: 4px; }
        .stat-num { font-size: 14px; font-weight: 900; }
        
        .section-header {
          font-size: 14px;
          font-weight: 800;
          color: #1e293b;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          border-right: 4px solid #4338ca;
          padding-right: 8px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
          font-size: 12px;
          background: #fff;
        }
        th {
          background: #f1f5f9;
          color: #334155;
          font-weight: 800;
          padding: 8px;
          border: 1px solid #cbd5e1;
          text-align: right;
        }
        td {
          padding: 8px;
          border: 1px solid #e2e8f0;
          color: #1e293b;
        }
        tr:nth-child(even) { background: #f8fafc; }
        tr.cancelled-row { background: #fef2f2; opacity: 0.75; }
        .badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 800;
          border: 1px solid transparent;
        }
        .bg-emerald-100 { background-color: #d1fae5; color: #065f46; border-color: #a7f3d0; }
        .bg-amber-100 { background-color: #fef3c7; color: #92400e; border-color: #fde68a; }
        .bg-rose-100 { background-color: #ffe4e6; color: #9f1239; border-color: #fecdd3; }
        .bg-purple-100 { background-color: #f3e8ff; color: #6b21a8; border-color: #e9d5ff; }
        .bg-red-100 { background-color: #fee2e2; color: #991b1b; border-color: #fca5a5; }
        .bg-sky-100 { background-color: #e0f2fe; color: #075985; border-color: #bae6fd; }

        .footer-signatures {
          margin-top: 30px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          text-align: center;
          padding-top: 20px;
          border-top: 2px dashed #cbd5e1;
        }
        .sig-box {
          font-weight: 700;
          color: #475569;
        }
        .sig-line {
          margin-top: 35px;
          border-bottom: 1px solid #94a3b8;
          width: 80%;
          margin-left: auto;
          margin-right: auto;
        }
        .btn-print {
          position: fixed;
          bottom: 24px;
          left: 24px;
          background: #4338ca;
          color: #fff;
          border: none;
          padding: 12px 24px;
          border-radius: 10px;
          font-family: inherit;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(67, 56, 202, 0.3);
        }
      </style>
    </head>
    <body>
      <button onclick="window.print()" class="btn-print no-print">🖨️ طباعة التقرير الآن</button>

      <div class="header-bar">
        <div class="logo-box">
          ${logoUrl ? `<img src="${logoUrl}" alt="logo"/>` : ''}
          <div>
            <div class="company-title">${companyName}</div>
            <div style="font-size: 11px; color: #64748b;">سجل حركة صنف ومطابقة المبيعات والتوريد</div>
          </div>
        </div>
        <div style="text-align: left; font-size: 11px; color: #64748b;">
          <div><b>تاريخ التقرير:</b> ${printDate}</div>
          <div><b>الحالة:</b> تقرير تفصيلي شامل موثق</div>
        </div>
      </div>

      <div class="doc-title">تقرير حركة وتتبع المنتج الشامل</div>

      <!-- Product Meta -->
      <div class="product-card">
        <div class="info-item">
          <span class="info-label">اسم المنتج</span>
          <span class="info-value" style="color: #4338ca;">${product.name}</span>
        </div>
        <div class="info-item">
          <span class="info-label">كود المنتج (SKU)</span>
          <span class="info-value" style="font-family: monospace;">${product.sku || '-'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">سعر البيع الحالي</span>
          <span class="info-value">${(product.price || 0).toLocaleString()} ج.م</span>
        </div>
        <div class="info-item">
          <span class="info-label">سعر التكلفة الحالي</span>
          <span class="info-value">${productCostPrice.toLocaleString()} ج.م</span>
        </div>
        <div class="info-item">
          <span class="info-label">المخزون المتوفر</span>
          <span class="info-value" style="color: #059669;">${product.stock || 0} قطعة</span>
        </div>
        <div class="info-item">
          <span class="info-label">الفئة / التصنيف</span>
          <span class="info-value">${productCategory}</span>
        </div>
        <div class="info-item">
          <span class="info-label">حركات العملاء</span>
          <span class="info-value">${salesStats.totalOrdersCount} طلبات</span>
        </div>
        <div class="info-item">
          <span class="info-label">حركات التوريد</span>
          <span class="info-value">${purchases.length} عمليات</span>
        </div>
      </div>

      <!-- Quick Stats Grid -->
      <div class="stats-grid">
        <div class="stat-box emerald">
          <div class="stat-title">المباع والمحصل (الصافي)</div>
          <div class="stat-num" style="color: #047857;">${salesStats.deliveredQty} قطعة</div>
          <div style="font-size: 10px; color: #065f46; font-weight: 700;">${salesStats.deliveredRevenue.toLocaleString()} ج.م</div>
        </div>
        <div class="stat-box blue">
          <div class="stat-title">قيد التوصيل/المعالجة</div>
          <div class="stat-num" style="color: #0369a1;">${salesStats.inProgressQty} قطعة</div>
        </div>
        <div class="stat-box rose">
          <div class="stat-title">المرتجع</div>
          <div class="stat-num" style="color: #be123c;">${salesStats.returnedCount} طلبات</div>
          <div style="font-size: 10px; color: #881337;">(${salesStats.returnedQty} قطعة)</div>
        </div>
        <div class="stat-box amber">
          <div class="stat-title">تم الاستبدال</div>
          <div class="stat-num" style="color: #b45309;">${salesStats.exchangedCount} طلبات</div>
          <div style="font-size: 10px; color: #78350f;">(${salesStats.exchangedQty} قطعة)</div>
        </div>
        <div class="stat-box purple">
          <div class="stat-title">فشل التوصيل</div>
          <div class="stat-num" style="color: #6b21a8;">${salesStats.failedDeliveryCount} طلبات</div>
          <div style="font-size: 10px; color: #581c87;">(${salesStats.failedDeliveryQty} قطعة)</div>
        </div>
        <div class="stat-box red">
          <div class="stat-title">الطلبات الملغية</div>
          <div class="stat-num" style="color: #b91c1c;">${salesStats.cancelledCount} طلبات</div>
          <div style="font-size: 10px; color: #7f1d1d;">(${salesStats.cancelledQty} قطعة)</div>
        </div>
      </div>

      <!-- Sales Table -->
      <div class="section-header">سجل حركة مبيعات المنتج مع العملاء التفصيلي</div>
      <table>
        <thead>
          <tr>
            <th style="width: 30px; text-align:center;">#</th>
            <th style="text-align:center;">التاريخ</th>
            <th>رقم الطلب</th>
            <th>العميل</th>
            <th>العنوان/المحافظة</th>
            <th style="text-align:center;">الكمية</th>
            <th style="text-align:center;">السعر</th>
            <th style="text-align:center;">الإجمالي</th>
            <th style="text-align:center;">حالة الطلب</th>
            <th style="text-align:center;">الدفع</th>
          </tr>
        </thead>
        <tbody>
          ${salesRows || '<tr><td colspan="10" style="text-align:center;">لا يوجد سجل مبيعات لهذا المنتج</td></tr>'}
        </tbody>
      </table>

      <!-- Purchases Table -->
      <div class="section-header">سجل مشتريات وتوريدات المنتج من الموردين</div>
      <table>
        <thead>
          <tr>
            <th style="width: 30px; text-align:center;">#</th>
            <th style="text-align:center;">التاريخ</th>
            <th>رقم الفاتورة / المرتجع</th>
            <th>المورد</th>
            <th style="text-align:center;">نوع الحركة</th>
            <th style="text-align:center;">الكمية</th>
            <th style="text-align:center;">التكلفة الإجمالية</th>
          </tr>
        </thead>
        <tbody>
          ${purchaseRows || '<tr><td colspan="7" style="text-align:center;">لا يوجد سجل مشتريات لهذا المنتج</td></tr>'}
        </tbody>
      </table>

      <!-- Signatures -->
      <div class="footer-signatures">
        <div class="sig-box">
          <div>مسؤول المبيعات والمخزن</div>
          <div class="sig-line"></div>
        </div>
        <div class="sig-box">
          <div>المراجع الحسابي</div>
          <div class="sig-line"></div>
        </div>
        <div class="sig-box">
          <div>اعتماد الإدارة / الختم الرسمي</div>
          <div class="sig-line"></div>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const ProductSalesLogModal: React.FC<ProductSalesLogModalProps> = ({
  product,
  orders,
  settings,
  onClose
}) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedSupplyOrder, setSelectedSupplyOrder] = useState<SupplyOrder | null>(null);
  const [selectedPurchaseReturn, setSelectedPurchaseReturn] = useState<PurchaseReturn | null>(null);
  const [activeTab, setActiveTab] = useState<'sales' | 'purchases'>('sales');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const salesStats = useMemo(() => {
    const productSales: { order: Order; itemInfo: any }[] = [];
    
    let deliveredQty = 0;
    let deliveredRevenue = 0;
    let inProgressQty = 0;
    
    let returnedCount = 0;
    let returnedQty = 0;
    
    let exchangedCount = 0;
    let exchangedQty = 0;
    
    let failedDeliveryCount = 0;
    let failedDeliveryQty = 0;
    
    let cancelledCount = 0;
    let cancelledQty = 0;

    const deliveredStatuses = ['تم_التوصيل', 'تم_توصيلها', 'delivered', 'تم_التحصيل', 'مدفوعة', 'مكتمل', 'completed'];
    const returnedStatuses = ['مرتجع', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام', 'returned', 'partially_returned'];
    const exchangedStatuses = ['تم_الاستبدال', 'استبدال', 'exchanged', 'replaced'];
    const failedDeliveryStatuses = ['فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'failed_delivery', 'returned_to_shipper'];
    const cancelledStatuses = ['ملغي', 'cancelled'];

    orders.forEach(order => {
      const statusStr = String(order.status || '').trim();
      const item = order.items?.find(i => i.productId === product.id || (i as any).id === product.id);
      
      if (item) {
        productSales.push({ order, itemInfo: item });
        const quantity = item.quantity || 0;
        const price = item.price || 0;

        if (deliveredStatuses.includes(statusStr)) {
          deliveredQty += quantity;
          deliveredRevenue += quantity * price;
        } else if (returnedStatuses.includes(statusStr)) {
          returnedCount++;
          returnedQty += quantity;
        } else if (exchangedStatuses.includes(statusStr)) {
          exchangedCount++;
          exchangedQty += quantity;
        } else if (failedDeliveryStatuses.includes(statusStr)) {
          failedDeliveryCount++;
          failedDeliveryQty += quantity;
        } else if (cancelledStatuses.includes(statusStr)) {
          cancelledCount++;
          cancelledQty += quantity;
        } else {
          inProgressQty += quantity;
        }
      }
    });

    productSales.sort((a, b) => new Date(b.order.date || 0).getTime() - new Date(a.order.date || 0).getTime());

    return {
      sales: productSales,
      deliveredQty,
      deliveredRevenue,
      inProgressQty,
      returnedCount,
      returnedQty,
      exchangedCount,
      exchangedQty,
      failedDeliveryCount,
      failedDeliveryQty,
      cancelledCount,
      cancelledQty,
      totalOrdersCount: productSales.length
    };
  }, [product, orders]);

  const { purchases, totalQuantityPurchased, totalPurchaseCost, totalQuantityPurchaseReturned, totalPurchaseReturnedCost } = useMemo(() => {
    const productPurchases: { 
      type: 'purchase' | 'return'; 
      id: string; 
      number: string; 
      date: string; 
      supplierId: string; 
      itemInfo: any[];
      rawOrder?: SupplyOrder;
      rawReturn?: PurchaseReturn;
    }[] = [];

    let qtyPurchased = 0;
    let cost = 0;

    (settings.supplyOrders || []).forEach(order => {
      if (order.status === 'cancelled') return;

      const orderItems = order.items?.filter(item => item.productId === product.id) || [];
      if (orderItems.length === 0) return;

      const purchaseItems: any[] = [];
      const orderReturnItems: any[] = [];

      orderItems.forEach(item => {
        const qty = (item.receivedQuantity !== undefined && item.receivedQuantity !== null) 
          ? Number(item.receivedQuantity) 
          : (Number(item.quantity) || 0);
        const totalQty = qty + (Number(item.bonusQuantity) || 0);

        if (item.isReturn) {
          orderReturnItems.push({
            ...item,
            quantity: totalQty,
            costPrice: item.cost || 0
          });
        } else {
          if (totalQty > 0) {
            purchaseItems.push(item);
            qtyPurchased += totalQty;
            const rawCost = Number(item.cost) || 0;
            const discountVal = Number(item.discountValue) || 0;
            const discountAmt = discountVal ? (item.discountType === 'percentage' ? (rawCost * discountVal / 100) : discountVal) : 0;
            const netUnitCost = Math.max(0, rawCost - discountAmt);
            cost += qty * netUnitCost;
          }

          if (item.returnedQuantity && Number(item.returnedQuantity) > 0) {
            const rawCost = Number(item.cost) || 0;
            const discountVal = Number(item.discountValue) || 0;
            const discountAmt = discountVal ? (item.discountType === 'percentage' ? (rawCost * discountVal / 100) : discountVal) : 0;
            const netUnitCost = Math.max(0, rawCost - discountAmt);
            orderReturnItems.push({
              ...item,
              quantity: Number(item.returnedQuantity),
              costPrice: netUnitCost
            });
          }
        }
      });

      if (purchaseItems.length > 0) {
        productPurchases.push({
          type: 'purchase',
          id: order.id,
          number: order.referenceNumber || order.orderNumber || order.id,
          date: order.date,
          supplierId: order.supplierId,
          itemInfo: purchaseItems,
          rawOrder: order
        });
      }

      if (orderReturnItems.length > 0) {
        const orderRef = order.referenceNumber || order.orderNumber || order.id;
        const existingPR = (settings.purchaseReturns || []).find(pr => 
          pr.status !== 'cancelled' && 
          (pr.notes?.includes(orderRef) || pr.notes?.includes(order.id))
        );

        if (!existingPR) {
          productPurchases.push({
            type: 'return',
            id: `order-return-${order.id}`,
            number: `مرتجع من ${orderRef}`,
            date: order.date,
            supplierId: order.supplierId,
            itemInfo: orderReturnItems,
            rawOrder: order
          });
        }
      }
    });

    (settings.purchaseReturns || []).forEach(ret => {
      if (ret.status === 'cancelled') return;
      const returnItems = ret.items?.filter(item => item.productId === product.id) || [];
      if (returnItems.length > 0) {
        let returnNum = ret.returnNumber || 'مرتجع';
        if (ret.notes?.includes('مرتجع من الفاتورة رقم')) {
          const matchedRef = ret.notes.replace('مرتجع من الفاتورة رقم ', '').trim();
          returnNum = `${ret.returnNumber || 'مرتجع'} (${matchedRef})`;
        }

        productPurchases.push({
          type: 'return',
          id: ret.id,
          number: returnNum,
          date: ret.date,
          supplierId: ret.supplierId,
          itemInfo: returnItems,
          rawReturn: ret
        });
      }
    });

    let qtyReturned = 0;
    let returnedCost = 0;

    productPurchases.forEach(p => {
      if (p.type === 'return') {
        p.itemInfo.forEach(item => {
          const q = Number(item.quantity) || 0;
          const c = Number(item.costPrice || item.cost) || 0;
          qtyReturned += q;
          returnedCost += c * q;
        });
      }
    });

    productPurchases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { 
      purchases: productPurchases, 
      totalQuantityPurchased: qtyPurchased, 
      totalPurchaseCost: cost,
      totalQuantityPurchaseReturned: qtyReturned,
      totalPurchaseReturnedCost: returnedCost
    };
  }, [product, settings.supplyOrders, settings.purchaseReturns]);

  const filteredSales = useMemo(() => {
    if (statusFilter === 'all') return salesStats.sales;
    
    return salesStats.sales.filter(({ order }) => {
      const st = String(order.status || '').trim();
      if (statusFilter === 'delivered') {
        return ['تم_التوصيل', 'تم_توصيلها', 'delivered', 'تم_التحصيل', 'مدفوعة', 'مكتمل', 'completed'].includes(st);
      }
      if (statusFilter === 'returned') {
        return ['مرتجع', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام', 'returned', 'partially_returned'].includes(st);
      }
      if (statusFilter === 'exchanged') {
        return ['تم_الاستبدال', 'استبدال', 'exchanged', 'replaced'].includes(st);
      }
      if (statusFilter === 'failed_delivery') {
        return ['فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'failed_delivery', 'returned_to_shipper'].includes(st);
      }
      if (statusFilter === 'cancelled') {
        return ['ملغي', 'cancelled'].includes(st);
      }
      if (statusFilter === 'in_progress') {
        return !['تم_التوصيل', 'تم_توصيلها', 'delivered', 'تم_التحصيل', 'مدفوعة', 'مكتمل', 'completed',
                 'مرتجع', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام', 'returned', 'partially_returned',
                 'تم_الاستبدال', 'استبدال', 'exchanged', 'replaced',
                 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'failed_delivery', 'returned_to_shipper',
                 'ملغي', 'cancelled'].includes(st);
      }
      return true;
    });
  }, [salesStats.sales, statusFilter]);

  const handlePrintReport = () => {
    const html = generateProductLogPrintHTML(
      product,
      salesStats.sales,
      purchases,
      salesStats,
      {
        totalQuantityPurchased,
        totalPurchaseCost,
        totalQuantityPurchaseReturned,
        totalPurchaseReturnedCost,
        netBalance: totalQuantityPurchased - totalQuantityPurchaseReturned
      },
      settings
    );
    const prt = window.open('', '_blank');
    if (prt) {
      prt.document.write(html);
      prt.document.close();
      setTimeout(() => prt.print(), 500);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <Package size={24} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span>سجل حركة وتتبع المنتج</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                    رصيد: {product.stock || 0} قطعة
                  </span>
                </h2>
                <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                  {product.name} {product.sku ? `(SKU: ${product.sku})` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrintReport}
                className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2 cursor-pointer"
                title="طباعة كشف ومطابقة حركة المنتج"
              >
                <Printer size={16} />
                <span className="hidden sm:inline">طباعة التقرير الشامل</span>
              </button>

              <button
                onClick={onClose}
                className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50/30 dark:bg-slate-800/20">
            <button
              onClick={() => setActiveTab('sales')}
              className={`py-3.5 px-5 font-extrabold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'sales'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <ArrowUpRight size={16} />
              <span>حركة المبيعات للعملاء ({salesStats.totalOrdersCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('purchases')}
              className={`py-3.5 px-5 font-extrabold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'purchases'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <ArrowDownLeft size={16} />
              <span>المشتريات والتوريد ({purchases.length})</span>
            </button>
          </div>

          <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
            {activeTab === 'sales' ? (
                <>
                    {/* Sales Quick Stats Grid (6 Cards) */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
                      {/* Delivered Card */}
                      <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-900/50 flex flex-col justify-between">
                        <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 mb-1">
                          <CheckCircle size={15} />
                          <span className="font-extrabold text-[11px]">المباع والمحصل</span>
                        </div>
                        <div>
                          <div className="text-lg font-black text-emerald-800 dark:text-emerald-300">{salesStats.deliveredQty} <span className="text-xs font-semibold">قطعة</span></div>
                          <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{salesStats.deliveredRevenue.toLocaleString()} ج.م</div>
                        </div>
                      </div>

                      {/* In Progress Card */}
                      <div className="bg-sky-50/60 dark:bg-sky-950/30 p-3 rounded-2xl border border-sky-100 dark:border-sky-900/50 flex flex-col justify-between">
                        <div className="flex items-center gap-1.5 text-sky-700 dark:text-sky-400 mb-1">
                          <Truck size={15} />
                          <span className="font-extrabold text-[11px]">قيد الشحن والتجهيز</span>
                        </div>
                        <div>
                          <div className="text-lg font-black text-sky-800 dark:text-sky-300">{salesStats.inProgressQty} <span className="text-xs font-semibold">قطعة</span></div>
                          <div className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 mt-0.5">جاري المعالجة</div>
                        </div>
                      </div>

                      {/* Returned Card */}
                      <div className="bg-rose-50/60 dark:bg-rose-950/30 p-3 rounded-2xl border border-rose-100 dark:border-rose-900/50 flex flex-col justify-between">
                        <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 mb-1">
                          <RotateCw size={15} />
                          <span className="font-extrabold text-[11px]">المرتجع</span>
                        </div>
                        <div>
                          <div className="text-lg font-black text-rose-800 dark:text-rose-300">{salesStats.returnedCount} <span className="text-xs font-semibold">طلبات</span></div>
                          <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-0.5">({salesStats.returnedQty} قطعة)</div>
                        </div>
                      </div>

                      {/* Exchanged Card */}
                      <div className="bg-amber-50/60 dark:bg-amber-950/30 p-3 rounded-2xl border border-amber-100 dark:border-amber-900/50 flex flex-col justify-between">
                        <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 mb-1">
                          <TrendingUp size={15} />
                          <span className="font-extrabold text-[11px]">تم الاستبدال</span>
                        </div>
                        <div>
                          <div className="text-lg font-black text-amber-800 dark:text-amber-300">{salesStats.exchangedCount} <span className="text-xs font-semibold">طلبات</span></div>
                          <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">({salesStats.exchangedQty} قطعة)</div>
                        </div>
                      </div>

                      {/* Failed Delivery Card */}
                      <div className="bg-purple-50/60 dark:bg-purple-950/30 p-3 rounded-2xl border border-purple-100 dark:border-purple-900/50 flex flex-col justify-between">
                        <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-400 mb-1">
                          <AlertTriangle size={15} />
                          <span className="font-extrabold text-[11px]">فشل التوصيل</span>
                        </div>
                        <div>
                          <div className="text-lg font-black text-purple-800 dark:text-purple-300">{salesStats.failedDeliveryCount} <span className="text-xs font-semibold">طلبات</span></div>
                          <div className="text-[10px] font-bold text-purple-600 dark:text-purple-400 mt-0.5">({salesStats.failedDeliveryQty} قطعة)</div>
                        </div>
                      </div>

                      {/* Cancelled Card */}
                      <div className="bg-red-50/60 dark:bg-red-950/30 p-3 rounded-2xl border border-red-100 dark:border-red-900/50 flex flex-col justify-between">
                        <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 mb-1">
                          <XCircle size={15} />
                          <span className="font-extrabold text-[11px]">الطلبات الملغية</span>
                        </div>
                        <div>
                          <div className="text-lg font-black text-red-800 dark:text-red-300">{salesStats.cancelledCount} <span className="text-xs font-semibold">طلبات</span></div>
                          <div className="text-[10px] font-bold text-red-600 dark:text-red-400 mt-0.5">({salesStats.cancelledQty} قطعة)</div>
                        </div>
                      </div>
                    </div>

                    {/* Status Filters Bar */}
                    <div className="flex items-center gap-1.5 flex-wrap pb-1">
                      <span className="text-xs font-extrabold text-slate-500 flex items-center gap-1 pl-2">
                        <Filter size={14} /> تصفية الحالة:
                      </span>
                      {[
                        { id: 'all', label: 'الكل', count: salesStats.totalOrdersCount },
                        { id: 'delivered', label: 'تم التحصيل/التوصيل', count: salesStats.sales.filter(({ order }) => ['تم_التوصيل', 'تم_توصيلها', 'delivered', 'تم_التحصيل', 'مدفوعة', 'مكتمل', 'completed'].includes(String(order.status || '').trim())).length },
                        { id: 'in_progress', label: 'قيد الشحن والتجهيز', count: salesStats.sales.filter(({ order }) => !['تم_التوصيل', 'تم_توصيلها', 'delivered', 'تم_التحصيل', 'مدفوعة', 'مكتمل', 'completed', 'مرتجع', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام', 'returned', 'partially_returned', 'تم_الاستبدال', 'استبدال', 'exchanged', 'replaced', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'failed_delivery', 'returned_to_shipper', 'ملغي', 'cancelled'].includes(String(order.status || '').trim())).length },
                        { id: 'returned', label: 'مرتجع', count: salesStats.returnedCount },
                        { id: 'exchanged', label: 'استبدال', count: salesStats.exchangedCount },
                        { id: 'failed_delivery', label: 'فشل توصيل', count: salesStats.failedDeliveryCount },
                        { id: 'cancelled', label: 'ملغي', count: salesStats.cancelledCount }
                      ].map(f => (
                        <button
                          key={f.id}
                          onClick={() => setStatusFilter(f.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            statusFilter === f.id
                              ? 'bg-slate-800 text-white dark:bg-indigo-600 border-slate-800 dark:border-indigo-600 shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {f.label} <span className="opacity-70 font-mono">({f.count})</span>
                        </button>
                      ))}
                    </div>

                    {/* Sales Table */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs sm:text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                            <tr>
                              <th className="px-4 py-3.5 font-black text-center">التاريخ</th>
                              <th className="px-4 py-3.5 font-black">رقم الطلب</th>
                              <th className="px-4 py-3.5 font-black">العميل</th>
                              <th className="px-4 py-3.5 font-black text-center">الكمية المباعة</th>
                              <th className="px-4 py-3.5 font-black text-center">السعر</th>
                              <th className="px-4 py-3.5 font-black text-center">الإجمالي</th>
                              <th className="px-4 py-3.5 font-black text-center">حالة الطلب</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {filteredSales.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                                  <Package size={32} className="mx-auto mb-2 opacity-40" />
                                  <span>لا توجد حركات مبيعات مطابقة لهذا التصفية</span>
                                </td>
                              </tr>
                            ) : (
                              filteredSales.map(({ order, itemInfo }) => {
                                const st = String(order.status || '').trim();
                                const isDelivered = ['تم_التوصيل', 'تم_توصيلها', 'delivered', 'تم_التحصيل', 'مدفوعة', 'مكتمل', 'completed'].includes(st);
                                const isExchange = ['تم_الاستبدال', 'استبدال', 'exchanged', 'replaced'].includes(st);
                                const isReturned = ['مرتجع', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام', 'returned', 'partially_returned'].includes(st);
                                const isFailedDelivery = ['فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'failed_delivery', 'returned_to_shipper'].includes(st);
                                const isCancelled = ['ملغي', 'cancelled'].includes(st);

                                return (
                                  <tr 
                                    key={order.id} 
                                    className={`hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors ${
                                      isCancelled ? 'bg-red-50/20 dark:bg-red-950/10' : ''
                                    }`}
                                  >
                                    <td className="px-4 py-3.5 text-center">
                                      <div className="flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400 font-mono">
                                        <Calendar size={13} className="text-slate-400" />
                                        {new Date(order.date || Date.now()).toLocaleDateString('ar-EG')}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3.5 font-mono font-black text-indigo-600 dark:text-indigo-400">
                                      <button 
                                        onClick={() => setSelectedOrder(order)} 
                                        className="hover:underline text-indigo-600 dark:text-indigo-400 cursor-pointer flex items-center gap-1 font-mono font-bold"
                                      >
                                        <Eye size={13} className="opacity-80" />
                                        <span>#{order.orderNumber || order.referenceNumber || order.id.substring(0, 8)}</span>
                                      </button>
                                    </td>
                                    <td className="px-4 py-3.5 text-slate-800 dark:text-slate-200 font-bold">
                                      <div>{order.customerName || 'عميل نقدي'}</div>
                                      {(order.governorate || order.city) && (
                                        <span className="text-[10px] text-slate-400 block font-normal">
                                          {[order.governorate, order.city].filter(Boolean).join(' - ')}
                                        </span>
                                      )}
                                    </td>
                                    <td className={`px-4 py-3.5 text-center font-extrabold ${isCancelled ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                      {itemInfo.quantity}
                                    </td>
                                    <td className="px-4 py-3.5 text-center text-slate-600 dark:text-slate-400 font-mono">
                                      {itemInfo.price?.toLocaleString()} ج.م
                                    </td>
                                    <td className={`px-4 py-3.5 text-center font-black ${isCancelled ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                                      {(itemInfo.quantity * itemInfo.price)?.toLocaleString()} ج.م
                                    </td>
                                    <td className="px-4 py-3.5 text-center">
                                      <span className={`px-2.5 py-1 rounded-xl text-xs font-black border inline-flex items-center gap-1 ${
                                        isDelivered ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60' :
                                        isExchange ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60' :
                                        isReturned ? 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60' :
                                        isFailedDelivery ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60' :
                                        isCancelled ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/60 line-through' :
                                        'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/60'
                                      }`}>
                                        {st === 'تم_التحصيل' ? 'تم التحصيل' :
                                         st === 'تم_التوصيل' || st === 'تم_توصيلها' ? 'تم التوصيل' :
                                         st === 'تم_الاستبدال' ? 'تم الاستبدال' :
                                         st === 'مرتجع_جزئي' ? 'مرتجع جزئي' :
                                         st === 'مرتجع_بعد_الاستلام' ? 'مرتجع بعد الاستلام' :
                                         isFailedDelivery ? 'فشل التوصيل' :
                                         isCancelled ? 'ملغي' :
                                         isReturned ? 'مرتجع' :
                                         order.status}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                </>
            ) : (
                <>
                    {/* Purchases Quick Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/50">
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 mb-2">
                          <ShoppingCart size={18} />
                          <span className="font-bold text-xs sm:text-sm">إجمالي كمية المشتريات</span>
                        </div>
                        <div className="text-2xl font-black text-emerald-800 dark:text-emerald-300">{totalQuantityPurchased} <span className="text-xs font-normal">قطعة</span></div>
                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">{totalPurchaseCost.toLocaleString()} ج.م</div>
                      </div>
                      
                      <div className="bg-rose-50 dark:bg-rose-950/30 p-4 rounded-2xl border border-rose-100 dark:border-rose-900/50">
                        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 mb-2">
                          <RotateCw size={18} />
                          <span className="font-bold text-xs sm:text-sm">مرتجعات الموردين</span>
                        </div>
                        <div className="text-2xl font-black text-rose-800 dark:text-rose-300">{totalQuantityPurchaseReturned} <span className="text-xs font-normal">قطعة</span></div>
                        <div className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-1">{totalPurchaseReturnedCost.toLocaleString()} ج.م</div>
                      </div>

                      <div className="bg-indigo-50 dark:bg-indigo-950/30 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                        <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 mb-2">
                          <Package size={18} />
                          <span className="font-bold text-xs sm:text-sm">عدد عمليات التوريد</span>
                        </div>
                        <div className="text-2xl font-black text-indigo-800 dark:text-indigo-300">{purchases.length} <span className="text-xs font-normal">عمليات</span></div>
                      </div>
                      
                      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-2">
                          <CheckCircle size={18} />
                          <span className="font-bold text-xs sm:text-sm">صافي الرصيد المستلم</span>
                        </div>
                        <div className="text-2xl font-black text-slate-800 dark:text-slate-100">
                          {totalQuantityPurchased - totalQuantityPurchaseReturned} <span className="text-xs font-normal">قطعة</span>
                        </div>
                      </div>
                    </div>

                    {/* Purchases Table */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs sm:text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                            <tr>
                              <th className="px-4 py-3.5 font-black text-center">التاريخ</th>
                              <th className="px-4 py-3.5 font-black">رقم العملية / الفاتورة</th>
                              <th className="px-4 py-3.5 font-black">المورد</th>
                              <th className="px-4 py-3.5 font-black text-center">النوع</th>
                              <th className="px-4 py-3.5 font-black text-center">الكمية</th>
                              <th className="px-4 py-3.5 font-black text-center">التكلفة الإجمالية</th>
                              <th className="px-4 py-3.5 font-black text-center">التفاصيل</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {purchases.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">لا يوجد سجل مشتريات لهذا المنتج حتى الآن</td>
                              </tr>
                            ) : (
                              purchases.map(({ type, id, number, date, supplierId, itemInfo, rawOrder, rawReturn }) => {
                                const supplier = settings.suppliers?.find(s => s.id === supplierId);
                                const qty = itemInfo.reduce((sum: number, item: any) => {
                                    if (type === 'purchase') {
                                        const q = (item.receivedQuantity !== undefined && item.receivedQuantity !== null) 
                                            ? Number(item.receivedQuantity) 
                                            : (Number(item.quantity) || 0);
                                        return sum + q + (Number(item.bonusQuantity) || 0);
                                    }
                                    return sum + (item.quantity || 0);
                                }, 0);
                                const rowTotal = itemInfo.reduce((sum: number, item: any) => {
                                    if (type === 'purchase') {
                                        const rawCost = Number(item.cost) || 0;
                                        const discountVal = Number(item.discountValue) || 0;
                                        const discountAmt = discountVal ? (item.discountType === 'percentage' ? (rawCost * discountVal / 100) : discountVal) : 0;
                                        const netUnitCost = Math.max(0, rawCost - discountAmt);
                                        const paidQty = (item.receivedQuantity !== undefined && item.receivedQuantity !== null) 
                                            ? Number(item.receivedQuantity) 
                                            : (Number(item.quantity) || 0);
                                        return sum + (paidQty * netUnitCost);
                                    }
                                    const c = Number(item.costPrice || item.cost) || 0;
                                    const q = Number(item.quantity) || 0;
                                    return sum + (c * q);
                                }, 0);

                                const handleOpenDetails = () => {
                                  if (type === 'purchase' && rawOrder) {
                                    setSelectedSupplyOrder(rawOrder);
                                  } else if (type === 'return' && rawReturn) {
                                    setSelectedPurchaseReturn(rawReturn);
                                  } else if (rawOrder) {
                                    setSelectedSupplyOrder(rawOrder);
                                  }
                                };

                                return (
                                  <tr 
                                    key={`${type}-${id}`} 
                                    onClick={handleOpenDetails}
                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                                  >
                                    <td className="px-4 py-3.5 text-center">
                                      <div className="flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400 font-mono">
                                        <Calendar size={13} className="text-slate-400" />
                                        {new Date(date).toLocaleDateString('ar-EG')}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenDetails();
                                        }}
                                        className="hover:underline flex items-center gap-1 font-mono font-bold cursor-pointer text-indigo-600 dark:text-indigo-400"
                                      >
                                        <Eye size={13} className="text-indigo-500 opacity-80 group-hover:opacity-100" />
                                        <span>{number}</span>
                                      </button>
                                    </td>
                                    <td className="px-4 py-3.5 text-slate-800 dark:text-slate-200 font-bold">
                                      {supplier?.name || (rawReturn?.supplierName || 'مورد غير معروف')}
                                    </td>
                                    <td className="px-4 py-3.5 text-center">
                                      <span className={`px-2.5 py-1 rounded-full text-xs font-black inline-flex items-center gap-1 ${
                                        type === 'purchase' 
                                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' 
                                          : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                                      }`}>
                                        {type === 'purchase' ? (
                                          <>
                                            <ShoppingCart size={12} />
                                            <span>شراء</span>
                                          </>
                                        ) : (
                                          <>
                                            <RotateCw size={12} />
                                            <span>مرتجع شراء</span>
                                          </>
                                        )}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-center font-black text-slate-800 dark:text-slate-200">
                                      {qty}
                                    </td>
                                    <td className="px-4 py-3.5 text-center font-black text-slate-900 dark:text-slate-100 font-mono">
                                      {rowTotal.toLocaleString()} ج.م
                                    </td>
                                    <td className="px-4 py-3.5 text-center">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenDetails();
                                        }}
                                        className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors flex items-center justify-center gap-1 mx-auto cursor-pointer"
                                      >
                                        <FileText size={13} />
                                        <span>التفاصيل</span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                </>
            )}
          </div>
        </motion.div>
      </div>

      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          settings={settings}
          allOrders={orders}
          onClose={() => setSelectedOrder(null)}
        />
      )}

      {/* Supply Order Details Modal */}
      {selectedSupplyOrder && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Receipt size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">تفاصيل فاتورة التوريد والشراء</h3>
                  <p className="text-xs text-indigo-300 font-mono mt-0.5">
                    رقم الفاتورة: #{selectedSupplyOrder.referenceNumber || selectedSupplyOrder.orderNumber || selectedSupplyOrder.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSupplyOrder(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-right flex-1 custom-scrollbar">
              {/* Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">المورد</span>
                  <span className="text-xs font-black text-slate-800 dark:text-white block">
                    {settings.suppliers?.find(s => s.id === selectedSupplyOrder.supplierId)?.name || 'مورد غير معروف'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">التاريخ</span>
                  <span className="text-xs font-mono font-bold text-slate-800 dark:text-white block">
                    {new Date(selectedSupplyOrder.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">طريقة السداد</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-white block">
                    {selectedSupplyOrder.paymentMethod === 'cash' ? 'كاش (محفظة عامة)' :
                     selectedSupplyOrder.paymentMethod === 'credit' ? 'آجل (مديونية للمورد)' :
                     selectedSupplyOrder.paymentMethod === 'partner' ? 'تمويل شركاء' :
                     selectedSupplyOrder.paymentMethod === 'treasury' ? 'الخزينة/البنك' :
                     selectedSupplyOrder.paymentMethod === 'custody' ? 'عهدة شخصية' :
                     selectedSupplyOrder.paymentMethod === 'supply_wallet' ? 'محفظة التوريد' : 'كاش'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">الحالة</span>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                    مكتملة
                  </span>
                </div>
              </div>

              {/* Invoice Items Table */}
              <div>
                <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 mb-2.5 flex items-center gap-2">
                  <Package size={16} className="text-indigo-500" />
                  <span>الأصناف والمنتجات المسجلة بفاتورة الشراء</span>
                </h4>
                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="p-3 font-extrabold">المنتج</th>
                        <th className="p-3 font-extrabold text-center">الكمية المستلمة</th>
                        <th className="p-3 font-extrabold text-center">الكمية المجانية</th>
                        <th className="p-3 font-extrabold text-center">تكلفة الحبة</th>
                        <th className="p-3 font-extrabold text-center">الخصم</th>
                        <th className="p-3 font-extrabold text-center">المرتجع</th>
                        <th className="p-3 font-extrabold text-center">الإجمالي الصافي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedSupplyOrder.items?.map((item: any, idx: number) => {
                        const prod = settings.products?.find((p: any) => p.id === item.productId);
                        const qty = (item.receivedQuantity !== undefined && item.receivedQuantity !== null) 
                          ? Number(item.receivedQuantity) 
                          : (Number(item.quantity) || 0);
                        const bonus = Number(item.bonusQuantity) || 0;
                        const totalQty = qty + bonus;
                        const unitCost = Number(item.cost) || 0;
                        const discountVal = Number(item.discountValue) || 0;
                        const discountAmt = discountVal ? (item.discountType === 'percentage' ? (unitCost * discountVal / 100) : discountVal) : 0;
                        const netUnitCost = Math.max(0, unitCost - discountAmt);

                        const isInvoiceReturn = Boolean(item.isReturn);
                        const returnedQty = isInvoiceReturn ? totalQty : (Number(item.returnedQuantity) || 0);

                        let lineNet = 0;
                        if (isInvoiceReturn) {
                          lineNet = -(totalQty * netUnitCost);
                        } else {
                          const billableQty = Math.max(0, totalQty - returnedQty);
                          lineNet = billableQty * netUnitCost;
                        }

                        const totalLineDiscount = discountAmt * totalQty;

                        return (
                          <tr key={idx} className={item.productId === product.id ? 'bg-indigo-50/50 dark:bg-indigo-950/30 font-semibold' : ''}>
                            <td className="p-3">
                              <span className="font-bold text-slate-800 dark:text-white block">{item.name || prod?.name || 'منتج'}</span>
                              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                {prod?.sku && <span className="text-[10px] text-slate-400 font-mono">كود: {prod.sku}</span>}
                                {isInvoiceReturn && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
                                    <RotateCw size={11} /> صنف مرتجع (خصم من الفاتورة)
                                  </span>
                                )}
                                {!isInvoiceReturn && returnedQty > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                                    <RotateCw size={11} /> مرتجع جزئي: {returnedQty} قطعة
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-center font-bold font-mono text-slate-700 dark:text-slate-300">{qty}</td>
                            <td className="p-3 text-center font-bold font-mono text-amber-600 dark:text-amber-400">{bonus > 0 ? `+${bonus}` : '0'}</td>
                            <td className="p-3 text-center font-bold font-mono text-slate-700 dark:text-slate-300">{unitCost.toLocaleString()} ج.م</td>
                            <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300">
                              {discountVal > 0 ? (
                                <div>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold font-mono block">
                                    {discountVal}{item.discountType === 'percentage' ? '%' : ' ج.م'}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono block">
                                    (-{totalLineDiscount.toLocaleString()} ج.م)
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300">
                              {returnedQty > 0 || isInvoiceReturn ? (
                                <div>
                                  <span className="text-rose-600 dark:text-rose-400 font-extrabold font-mono block">
                                    {returnedQty} قطعة
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono block">
                                    (-{(returnedQty * netUnitCost).toLocaleString()} ج.م)
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>
                            <td className="p-3 text-center font-extrabold font-mono">
                              {lineNet < 0 ? (
                                <div className="text-rose-600 dark:text-rose-400">
                                  <span className="block font-black">{lineNet.toLocaleString()} ج.م</span>
                                  <span className="text-[10px] font-bold block">(خصم مرتجع)</span>
                                </div>
                              ) : (
                                <div className="text-indigo-600 dark:text-indigo-400">
                                  <span className="block font-black">{lineNet.toLocaleString()} ج.م</span>
                                  {(totalLineDiscount > 0 || returnedQty > 0) && (
                                    <span className="text-[10px] text-slate-400 line-through block font-normal">
                                      {(totalQty * unitCost).toLocaleString()} ج.م
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Summary */}
              {(() => {
                let grossPurchases = 0;
                let purchaseDiscounts = 0;
                let totalReturnsDeducted = 0;

                selectedSupplyOrder.items?.forEach((item: any) => {
                  const qty = (item.receivedQuantity !== undefined && item.receivedQuantity !== null) 
                    ? Number(item.receivedQuantity) 
                    : (Number(item.quantity) || 0);
                  const bonus = Number(item.bonusQuantity) || 0;
                  const totalQty = qty + bonus;
                  const unitCost = Number(item.cost) || 0;

                  const discountVal = Number(item.discountValue) || 0;
                  const discountAmt = discountVal ? (item.discountType === 'percentage' ? (unitCost * discountVal / 100) : discountVal) : 0;
                  const netUnitCost = Math.max(0, unitCost - discountAmt);

                  const isInvoiceReturn = Boolean(item.isReturn);

                  if (isInvoiceReturn) {
                    totalReturnsDeducted += totalQty * netUnitCost;
                  } else {
                    const returnedQty = Number(item.returnedQuantity) || 0;
                    grossPurchases += totalQty * unitCost;
                    purchaseDiscounts += discountAmt * totalQty;
                    totalReturnsDeducted += returnedQty * netUnitCost;
                  }
                });

                const shipping = Number(selectedSupplyOrder.shippingFees || 0);
                const shippingNote = selectedSupplyOrder.shippingFeesNote;
                const otherFees = Number(selectedSupplyOrder.otherFees || 0);
                const otherFeesNote = selectedSupplyOrder.otherFeesNote;
                const tax = Number(selectedSupplyOrder.taxAmount || 0);

                const itemsNetTotal = grossPurchases - purchaseDiscounts - totalReturnsDeducted;
                const totalWithKnownFees = Math.max(0, itemsNetTotal + shipping + otherFees + tax);
                const actualGrandTotal = selectedSupplyOrder.grandTotal || selectedSupplyOrder.totalCost || totalWithKnownFees;

                const unallocatedExpenses = Math.max(0, actualGrandTotal - totalWithKnownFees);
                const unallocatedDiscount = Math.max(0, totalWithKnownFees - actualGrandTotal);

                return (
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                    <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400">
                      <span>إجمالي قيمة المشتريات (قبل الخصم):</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-white">
                        {grossPurchases.toLocaleString()} ج.م
                      </span>
                    </div>

                    {purchaseDiscounts > 0 && (
                      <div className="flex justify-between items-center text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        <span>إجمالي الخصومات المطبقة على المشتريات:</span>
                        <span className="font-mono font-bold">
                          - {purchaseDiscounts.toLocaleString()} ج.م
                        </span>
                      </div>
                    )}

                    {totalReturnsDeducted > 0 && (
                      <div className="flex justify-between items-center text-xs text-rose-600 dark:text-rose-400 font-medium">
                        <span>إجمالي قيمة المرتجعات المخصومة من الفاتورة:</span>
                        <span className="font-mono font-bold">
                          - {totalReturnsDeducted.toLocaleString()} ج.م
                        </span>
                      </div>
                    )}

                    {shipping > 0 && (
                      <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400">
                        <span>مصاريف الشحن والنقل{shippingNote ? ` (${shippingNote})` : ''}:</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-white">
                          + {shipping.toLocaleString()} ج.م
                        </span>
                      </div>
                    )}

                    {otherFees > 0 && (
                      <div className="flex justify-between items-center text-xs text-amber-600 dark:text-amber-400 font-medium">
                        <span>مصاريف أخرى / إضافية{otherFeesNote ? ` (${otherFeesNote})` : ''}:</span>
                        <span className="font-mono font-bold">
                          + {otherFees.toLocaleString()} ج.م
                        </span>
                      </div>
                    )}

                    {unallocatedExpenses > 0 && (
                      <div className="flex justify-between items-center text-xs text-amber-600 dark:text-amber-400 font-medium">
                        <span>مصاريف أخرى إضافية محملة على الفاتورة:</span>
                        <span className="font-mono font-bold">
                          + {unallocatedExpenses.toLocaleString()} ج.م
                        </span>
                      </div>
                    )}

                    {unallocatedDiscount > 0 && (
                      <div className="flex justify-between items-center text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        <span>خصم إضافي شامـل على الفاتورة:</span>
                        <span className="font-mono font-bold">
                          - {unallocatedDiscount.toLocaleString()} ج.م
                        </span>
                      </div>
                    )}

                    {tax > 0 && (
                      <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400">
                        <span>الضرائب والرسوم ({selectedSupplyOrder.taxRate || 0}%):</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-white">
                          + {tax.toLocaleString()} ج.م
                        </span>
                      </div>
                    )}

                    <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-sm font-black text-slate-800 dark:text-white">
                      <span>الإجمالي الصافي النهائي المستحق للفاتورة:</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-mono text-lg font-black">
                        {actualGrandTotal.toLocaleString()} ج.م
                      </span>
                    </div>
                  </div>
                );
              })()}

              {selectedSupplyOrder.notes && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200/60 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300">
                  <span className="font-bold block mb-1">ملاحظات الفاتورة:</span>
                  <p className="leading-relaxed">{selectedSupplyOrder.notes}</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  const html = generateSupplyOrderInvoiceHTML(selectedSupplyOrder, settings);
                  const prt = window.open('', '_blank');
                  if (prt) {
                    prt.document.write(html);
                    prt.document.close();
                    setTimeout(() => prt.print(), 500);
                  }
                }}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all cursor-pointer inline-flex items-center gap-2 shadow-sm"
              >
                <Printer size={15} />
                طباعة الفاتورة الشاملة
              </button>

              <button
                type="button"
                onClick={() => setSelectedSupplyOrder(null)}
                className="px-5 py-2.5 bg-slate-900 text-white dark:bg-slate-700 rounded-xl font-bold text-xs hover:bg-slate-800 cursor-pointer"
              >
                إغلاق التفاصيل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Return Details Modal */}
      {selectedPurchaseReturn && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-rose-950 text-white p-5 flex items-center justify-between border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <RotateCw size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">تفاصيل فاتورة مرتجع المشتريات</h3>
                  <p className="text-xs text-rose-300 font-mono mt-0.5">
                    رقم العملية: #{selectedPurchaseReturn.returnNumber || selectedPurchaseReturn.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPurchaseReturn(null)}
                className="p-2 text-rose-300 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-right flex-1 custom-scrollbar">
              {/* Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl border border-rose-100 dark:border-rose-900/40">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">المورد</span>
                  <span className="text-xs font-black text-slate-800 dark:text-white block">
                    {selectedPurchaseReturn.supplierName || settings.suppliers?.find(s => s.id === selectedPurchaseReturn.supplierId)?.name || 'مورد عام'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">تاريخ المرتجع</span>
                  <span className="text-xs font-mono font-bold text-slate-800 dark:text-white block">
                    {new Date(selectedPurchaseReturn.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">تم بواسطة</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-white block">
                    {selectedPurchaseReturn.performedBy || 'المستخدم'}
                  </span>
                </div>
              </div>

              {/* Returned Items Table */}
              <div>
                <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 mb-2.5 flex items-center gap-2">
                  <Package size={16} className="text-rose-500" />
                  <span>الأصناف والكميات المرتجعة</span>
                </h4>
                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="p-3 font-extrabold">المنتج</th>
                        <th className="p-3 font-extrabold text-center">الكمية المرتجعة</th>
                        <th className="p-3 font-extrabold text-center">سعر التكلفة المسترد</th>
                        <th className="p-3 font-extrabold text-center">إجمالي الاسترداد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedPurchaseReturn.items?.map((item: any, idx: number) => {
                        const prod = settings.products?.find((p: any) => p.id === item.productId);
                        const qty = Number(item.quantity) || 0;
                        const unitCost = Number(item.costPrice || item.cost) || 0;
                        const itemTotal = qty * unitCost;

                        return (
                          <tr key={idx} className={item.productId === product.id ? 'bg-rose-50/50 dark:bg-rose-950/30' : ''}>
                            <td className="p-3">
                              <span className="font-bold text-slate-800 dark:text-white block">{item.name || prod?.name || 'منتج'}</span>
                              {prod?.sku && <span className="text-[10px] text-slate-400 font-mono">كود: {prod.sku}</span>}
                            </td>
                            <td className="p-3 text-center font-bold font-mono text-rose-600 dark:text-rose-400">{qty}</td>
                            <td className="p-3 text-center font-bold font-mono text-slate-700 dark:text-slate-300">{unitCost.toLocaleString()} ج.م</td>
                            <td className="p-3 text-center font-extrabold font-mono text-rose-600 dark:text-rose-400">{itemTotal.toLocaleString()} ج.م</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Refund Summary */}
              <div className="bg-rose-50 dark:bg-rose-950/40 p-4 rounded-2xl border border-rose-200/80 dark:border-rose-900/60 flex justify-between items-center">
                <span className="text-xs font-black text-rose-800 dark:text-rose-300">إجمالي قيمة المستردات الفاتورة:</span>
                <span className="text-rose-600 dark:text-rose-400 font-mono font-black text-lg">
                  {(selectedPurchaseReturn.totalRefundAmount || 0).toLocaleString()} ج.م
                </span>
              </div>

              {selectedPurchaseReturn.notes && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
                  <span className="font-bold block mb-1">ملاحظات ومرجع الفاتورة:</span>
                  <p className="leading-relaxed">{selectedPurchaseReturn.notes}</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedPurchaseReturn(null)}
                className="px-5 py-2.5 bg-slate-900 text-white dark:bg-slate-700 rounded-xl font-bold text-xs hover:bg-slate-800 cursor-pointer"
              >
                إغلاق التفاصيل
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
