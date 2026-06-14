import { Order, Settings, Wallet, OrderItem } from '../types';

const getPrintControlBarCSS = () => ``;

const getPrintControlBarHTML = (reportTitle: string) => ``;

export const generatePurchasesAndInventoryReportHTML = (stats: any, storeName: string, orientation: 'portrait' | 'landscape' = 'landscape', isContinuous: boolean = false, dateRangeText?: string): string => {
    return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير المشتريات والمخزون - ${storeName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet" crossorigin="anonymous">
      <style>
        @page { 
          size: ${orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'}; 
          margin: ${isContinuous ? '0' : '1.5cm'}; 
        }
        * { box-sizing: border-box; }
        body { 
          font-family: 'Cairo', sans-serif; 
          font-size: 11px; 
          color: #0f172a; 
          line-height: 1.6;
          margin: 0;
          background-color: #f8fafc;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .report-wrapper { padding: ${isContinuous ? '20px' : '0'}; }
        .report-container {
          background-color: #ffffff;
          padding: 30px;
          border-radius: ${isContinuous ? '16px' : '0'};
          margin: 0 auto;
          max-width: ${orientation === 'landscape' ? '297mm' : '210mm'};
          box-shadow: ${isContinuous ? '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' : 'none'};
        }
        @media print {
            body { background-color: #ffffff; }
            .report-wrapper { padding: 0; }
            .report-container { padding: 0; box-shadow: none; border-radius: 0; max-width: 100%; margin: 0; }
        }
        .report-header { 
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 25px; border-bottom: 2px dashed #e2e8f0; padding-bottom: 15px;
        }
        .header-titles h1 { margin: 0 0 6px 0; font-size: 20px; color: #0f172a; font-weight: 900; }
        .header-titles .subtitle { margin: 0; font-size: 13px; color: #64748b; font-weight: 600; }
        .header-titles .date { margin: 4px 0 0 0; font-size: 10px; color: #94a3b8; }
        
        .profit-card {
            background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
            padding: 10px 18px; 
            border-radius: 10px; 
            border: 1px solid #a7f3d0; 
            display: inline-block;
            box-shadow: 0 2px 4px rgba(16, 185, 129, 0.1);
            text-align: left;
        }
        .profit-card p { margin: 0; }
        .profit-card .label { font-size: 10px; color: #059669; font-weight: 700; margin-bottom: 2px; }
        .profit-card .amount { font-size: 18px; font-weight: 900; color: #064e3b; }

        .summary-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 25px;
        }
        .summary-card {
          padding: 12px; border-radius: 10px; background: #ffffff; border: 1px solid #e2e8f0;
          box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
          text-align: center;
        }
        .summary-card .title { font-size: 11px; color: #64748b; font-weight: 700; margin-bottom: 6px; }
        .summary-card .value { font-size: 16px; font-weight: 900; color: #0f172a; }
        .value.emerald { color: #059669; }
        .value.blue { color: #2563eb; }
        .value.amber { color: #d97706; }

        .section-title-wrap {
            margin-bottom: 12px;
            padding-bottom: 6px;
            border-bottom: 2px solid #f1f5f9;
        }
        .section-title { font-size: 14px; font-weight: 800; color: #1e293b; margin: 0; }
        
        table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 10.5px; margin-bottom: 25px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }
        th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; }
        th { background-color: #f8fafc; font-weight: 800; color: #334155; border-bottom: 2px solid #cbd5e1; }
        tbody tr:last-child td { border-bottom: none; }
        tbody tr:nth-child(even) { background-color: #f8fafc; }
        tbody tr:hover { background-color: #f1f5f9; }
        
        .pill { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 9.5px; font-weight: 700; }
        .pill.positive { background-color: #d1fae5; color: #059669; }
        .pill.negative { background-color: #fee2e2; color: #dc2626; }
        .pill.neutral { background-color: #f1f5f9; color: #475569; }
        
        .font-mono { font-family: monospace; font-size: 11.5px; }
        ${getPrintControlBarCSS()}
      </style>
    </head>
    <body>
      ${getPrintControlBarHTML('المشتريات والمخزون')}
      <div class="report-wrapper">
      <div class="report-container">
          <div class="report-header">
            <div class="header-titles">
              <h1>${storeName}</h1>
              <p class="subtitle">تقرير المشتريات والمخزون</p>
              <p class="date">
                ${dateRangeText ? `<strong style="color: #2563eb;">الفترة: ${dateRangeText}</strong><br/>` : ''}
                تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div>
               <div class="profit-card">
                    <p class="label">إجمالي قيمة المخزون الحالي</p>
                    <p class="amount">${stats.totalInventoryValue.toLocaleString('ar-EG')} ج.م</p>
               </div>
            </div>
          </div>

          <div class="summary-grid">
            <div class="summary-card">
              <div class="title">إجمالي المشتريات التاريخية</div>
              <div class="value blue">${stats.totalPurchasesValue.toLocaleString('ar-EG')} ج.م</div>
            </div>
            <div class="summary-card">
              <div class="title">إجمالي عدد الطلبات (الفواتير)</div>
              <div class="value amber">${stats.totalOrdersCount} طلب</div>
            </div>
            <div class="summary-card">
              <div class="title">إجمالي عدد الأصناف في المخزون</div>
              <div class="value">${stats.productHistory.length} صنف</div>
            </div>
          </div>

          <div class="section-title-wrap" style="page-break-after: avoid;">
            <h2 class="section-title">تفاصيل الأرصدة والمخزون لكل منتج</h2>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>المنتج</th>
                <th>المخزون المتوفر</th>
                <th>قيمة المخزون</th>
                <th>مرات الشراء</th>
                <th>تاريخ آخر شراء</th>
                <th style="max-width: 150px;">الموردين</th>
              </tr>
            </thead>
            <tbody>
              ${stats.productHistory.length === 0 ? '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #94a3b8; font-weight: 600;">لا توجد منتجات مسجلة.</td></tr>' : stats.productHistory.map((p: any) => `
                <tr>
                  <td style="font-weight: 700; color: #1e293b;">${p.name}</td>
                  <td>${p.currentStock > 0 ? `<span class="pill positive">${p.currentStock}</span>` : `<span class="pill negative">نفذ</span>`}</td>
                  <td class="font-mono" style="font-weight: 800;">${p.stockValue.toLocaleString('ar-EG')}</td>
                  <td>${p.purchaseCount}</td>
                  <td class="font-mono text-xs">${p.lastPurchaseDate ? new Date(p.lastPurchaseDate).toLocaleDateString('ar-EG') : 'بدون'}</td>
                  <td style="color: #64748b; font-size: 10px;">${Array.from(p.suppliers).join('، ') || 'غيـر مسجل'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="section-title-wrap" style="page-break-after: avoid; margin-top: 30px;">
            <h2 class="section-title">سجل طلبات التوريد الأخيرة (المشتريات)</h2>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>رقم الفاتورة / المرجع</th>
                <th>التاريخ</th>
                <th>المورد</th>
                <th>القيمة الإجمالية</th>
                <th>عدد الأصناف</th>
                <th>طريقة الدفع</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${stats.supplyOrders.length === 0 ? '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #94a3b8; font-weight: 600;">لا توجد طلبات توريد مسجلة.</td></tr>' : stats.supplyOrders.map((o: any) => `
                <tr>
                  <td class="font-mono text-xs" style="font-weight: 800; color: #334155;">${o.referenceNumber || o.orderNumber || o.id.slice(-6).toUpperCase()}</td>
                  <td class="font-mono">${new Date(o.date).toLocaleDateString('ar-EG')}</td>
                  <td style="font-weight: 700; color: #1e293b;">${o.supplierName}</td>
                  <td class="font-mono" style="font-weight: 800; color: #059669;">${o.totalCost.toLocaleString('ar-EG')} ج.م</td>
                  <td><span class="pill neutral">${o.items.reduce((s:number, i:any) => s + i.quantity, 0)} قطعة</span></td>
                  <td>${o.paymentMethod === 'cash' ? 'نقدي' : o.paymentMethod === 'credit' ? 'آجل' : 'غير محدد'}</td>
                  <td>
                    ${o.status === 'completed' ? `<span class="pill positive">مكتمل</span>` : 
                      o.status === 'draft' ? `<span class="pill neutral">مسودة</span>` : 
                      o.status === 'cancelled' ? `<span class="pill negative">ملغي</span>` : `<span class="pill neutral">${o.status}</span>`}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

      </div>
      </div>
    </body>
    </html>
    `;
};

import { calculateOrderProfitLoss, calculateCodFee, getLatestProductCost, isBosta, calculateInsuranceFee, calculateBostaVat } from './financials';

export const generateInvoiceHTML = (order: Order, settings: Settings, storeName: string) => {
  const totalAmount = order.totalAmountOverride ?? (order.productPrice + order.shippingFee - order.discount);
  
  const itemsHtml = order.items.map((item: OrderItem) => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 10px; text-align: right;">${item.name}</td>
      <td style="padding: 10px; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; text-align: center;">${item.price.toLocaleString()}</td>
      <td style="padding: 10px; text-align: center; font-weight: bold;">${(item.price * item.quantity).toLocaleString()}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>فاتورة رقم ${order.orderNumber}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" crossorigin="anonymous">
      <style>
        body { font-family: 'Cairo', sans-serif; margin: 0; padding: 20px; color: #333; }
        .invoice-container { max-width: 800px; margin: auto; border: 1px solid #ddd; padding: 30px; border-radius: 10px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
        .logo { max-height: 60px; }
        .store-info h1 { margin: 0; font-size: 24px; color: ${settings.customization.primaryColor}; }
        .invoice-details { display: flex; justify-content: space-between; margin-bottom: 30px; background: #f9f9f9; padding: 20px; border-radius: 8px; }
        .detail-group h3 { margin: 0 0 10px 0; font-size: 16px; color: #666; }
        .detail-group p { margin: 5px 0; font-weight: bold; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #f1f1f1; padding: 12px; text-align: center; font-weight: bold; font-size: 14px; }
        .totals { width: 250px; margin-right: auto; margin-left: 0; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .grand-total { font-size: 20px; font-weight: bold; color: ${settings.customization.primaryColor}; border-top: 2px solid #ddd; border-bottom: none; padding-top: 15px; }
        .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 20px; }
        @media print {
          body { padding: 0; }
          .invoice-container { border: none; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="header">
          <div class="store-info">
            ${settings.customization.logoUrl ? `<img src="${settings.customization.logoUrl}" class="logo" alt="Logo">` : `<h1>${storeName}</h1>`}
            <p style="margin:5px 0 0; font-size:12px; color:#777;">${settings.customization.footerText}</p>
          </div>
          <div style="text-align: left;">
            <h2 style="margin: 0; color: #333;">فاتورة مبيعات</h2>
            <p style="margin: 5px 0; font-family: monospace;">#${order.orderNumber}</p>
            <p style="margin: 5px 0; font-size: 14px; color: #777;">${new Date().toLocaleDateString('ar-EG')}</p>
          </div>
        </div>

        <div class="invoice-details">
          <div class="detail-group">
            <h3>بيانات العميل</h3>
            <p>الاسم: ${order.customerName}</p>
            <p>الهاتف: ${order.customerPhone}</p>
            <p>العنوان: ${order.customerAddress}</p>
          </div>
          <div class="detail-group" style="text-align: left;">
            <h3>تفاصيل الشحن</h3>
            <p>شركة الشحن: ${order.shippingCompany}</p>
            <p>المنطقة: ${order.shippingArea}</p>
            <p>الحالة: ${order.status.replace(/_/g, ' ')}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align: right;">المنتج</th>
              <th>الكمية</th>
              <th>سعر الوحدة</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span>المجموع الفرعي:</span>
            <span>${order.productPrice.toLocaleString()} ج.م</span>
          </div>
          <div class="total-row">
            <span>مصاريف الشحن:</span>
            <span>${order.shippingFee.toLocaleString()} ج.م</span>
          </div>
          ${order.discount > 0 ? `
          <div class="total-row" style="color: red;">
            <span>خصم:</span>
            <span>-${order.discount.toLocaleString()} ج.م</span>
          </div>` : ''}
          ${order.includeInspectionFee ? `
          <div class="total-row">
            <span>رسوم معاينة (إن وجدت):</span>
            <span>${settings.inspectionFee.toLocaleString()} ج.م</span>
          </div>` : ''}
          <div class="total-row grand-total">
            <span>الإجمالي المستحق:</span>
            <span>${totalAmount.toLocaleString()} ج.م</span>
          </div>
        </div>

        ${order.notes ? `
        <div style="margin-top: 20px; padding: 15px; background: #fffbe6; border: 1px solid #ffe58f; border-radius: 6px;">
          <strong>ملاحظات:</strong> ${order.notes}
        </div>` : ''}

        <div class="footer">
          <p>شكراً لتعاملكم معنا! | تطبق الشروط والأحكام</p>
          <p style="font-weight: bold; margin-top: 5px;">حق المعاينة مكفول بالكامل قبل الاستلام</p>
        </div>
      </div>
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;
};

export const generateOrdersReportHTML = (orders: Order[], settings: Settings, storeName: string, dateRangeText?: string): string => {
  
    const tableRows = orders.map(order => {
        const amountToCollect = order.totalAmountOverride ?? (order.productPrice + order.shippingFee - (order.discount || 0));
        const { net } = calculateOrderProfitLoss(order, settings);
        const totalQuantity = (order.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);

    const getStatusColor = (status: string, type: 'status' | 'payment') => {
        const paymentIsPaid = ['مدفوع'].includes(status);
        const statusIsCollected = ['تم_التحصيل', 'مدفوعة'].includes(status);
        if ((type === 'payment' && paymentIsPaid) || (type === 'status' && statusIsCollected)) return 'background-color: #dcfce7; color: #166534;'; // green
        
        const isFailure = ['مرتجع', 'فشل_التوصيل', 'ملغي', 'تمت_الاعادة_لشركة_الشحن'].includes(status);
        if (isFailure) return 'background-color: #fee2e2; color: #991b1b;'; // red

        const inProgress = ['تم_توصيلها', 'قيد_الشحن', 'تم_الارسال'].includes(status);
        if (inProgress) return 'background-color: #dbeafe; color: #1e40af;'; // blue
        
        return 'background-color: #f1f5f9; color: #475569;'; // slate
    }

    return `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px;">${order.customerName}</td>
        <td style="padding: 8px;">${order.productName}</td>
        <td style="padding: 8px;">${order.productPrice.toLocaleString()}</td>
        <td style="padding: 8px; text-align: center;">${totalQuantity}</td>
        <td style="padding: 8px;">${order.shippingFee.toLocaleString()}</td>
        <td style="padding: 8px;">${amountToCollect.toLocaleString()}</td>
        <td style="padding: 8px; font-weight: bold;">${amountToCollect.toLocaleString()}</td>
        <td style="padding: 8px; text-align: center;"><span style="padding: 4px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold; white-space: nowrap; ${getStatusColor(order.status, 'status')}">${order.status.replace(/_/g, ' ')}</span></td>
        <td style="padding: 8px; text-align: center;"><span style="padding: 4px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold; white-space: nowrap; ${getStatusColor(order.paymentStatus, 'payment')}">${order.paymentStatus}</span></td>
        <td style="padding: 8px; font-weight: bold; color: ${net >= 0 ? '#15803d' : '#b91c1c'};">${net.toLocaleString()}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير الطلبات - ${storeName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" crossorigin="anonymous">
      <style>
        @page { size: A4 landscape; margin: 1cm; }
        body { font-family: 'Cairo', sans-serif; font-size: 9px; -webkit-print-color-adjust: exact; color-adjust: exact; }
        .report-container { width: 100%; }
        h1 { text-align: center; margin-bottom: 5px; color: #111827; font-size: 20px; }
        p { text-align: center; margin-top: 0; margin-bottom: 20px; font-size: 12px; color: #6b7280; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 6px; border: 1px solid #ddd; text-align: right; }
        th { background-color: #1f2937 !important; color: white !important; font-size: 10px; }
        tbody tr:nth-child(even) { background-color: #f9fafb !important; }
        ${getPrintControlBarCSS()}
      </style>
    </head>
    <body>
      ${getPrintControlBarHTML('تقرير الطلبات والمبيعات')}
      <div class="report-container">
        <h1>تقرير الطلبات لمتجر "${storeName}"</h1>
        <p>
          ${dateRangeText ? `<strong style="color: #2563eb;">الفترة: ${dateRangeText}</strong><br/>` : ''}
          تاريخ التقرير: ${new Date().toLocaleString('ar-EG')}
        </p>
        <table>
          <thead>
            <tr>
              <th>اسم العميل</th>
              <th>المنتج</th>
              <th>سعر المنتج</th>
              <th>كمية</th>
              <th>مصاريف الشحن</th>
              <th>مبلغ التحصيل</th>
              <th>إجمالي المبلغ</th>
              <th>حالة الشحنة</th>
              <th>حالة الدفع</th>
              <th>صافي الربح/الخسارة (ج.م)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;
};

export const generateCollectionsReportHTML = (orders: Order[], settings: Settings, storeName: string, dateRangeText?: string): string => {
    let totalGross = 0;
    let totalNetProfit = 0;

    orders.forEach(o => {
      if (!settings) return;
      const { net, breakdown: financials } = calculateOrderProfitLoss(o, settings);
      totalGross += financials.revenue;
      totalNetProfit += net;
    });

    const tableRows = orders.map(order => {
        const { net, breakdown: financials } = calculateOrderProfitLoss(order, settings);
        
        return `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px;">${order.orderNumber}</td>
                <td style="padding: 8px;">${order.customerName}</td>
                <td style="padding: 8px; font-family: monospace;">${new Date(order.date).toLocaleDateString('ar-EG')}</td>
                <td style="padding: 8px;">${financials.revenue.toLocaleString()}</td>
                <td style="padding: 8px;">${financials.productCost.toLocaleString()}</td>
                <td style="padding: 8px; font-weight: bold; color: ${net >= 0 ? '#15803d' : '#b91c1c'};">${net.toLocaleString()}</td>
            </tr>
        `;
    }).join('');

    return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير التحصيلات - ${storeName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" crossorigin="anonymous">
      <style>
        @page { size: A4; margin: 1cm; }
        body { font-family: 'Cairo', sans-serif; font-size: 10px; color: #333; }
        .report-container { width: 100%; }
        h1 { text-align: center; margin-bottom: 5px; color: #111827; font-size: 22px; }
        p.subtitle { text-align: center; margin-top: 0; margin-bottom: 20px; font-size: 12px; color: #6b7280; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px; }
        .stat-box { background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; }
        .stat-box h3 { margin: 0 0 5px 0; font-size: 11px; color: #6b7280; font-weight: bold; text-transform: uppercase; }
        .stat-box p { margin: 0; font-size: 20px; font-weight: 700; color: #111827; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; border: 1px solid #ddd; text-align: right; }
        th { background-color: #f3f4f6; font-weight: bold; font-size: 11px; }
        tbody tr:nth-child(even) { background-color: #f9fafb; }
        ${getPrintControlBarCSS()}
      </style>
    </head>
    <body>
      ${getPrintControlBarHTML('تقرير التحصيلات والأمان')}
      <div class="report-container">
        <h1>تقرير التحصيلات المفصّل</h1>
        <p class="subtitle">
          متجر "${storeName}"
          ${dateRangeText ? `<br/><strong style="color: #2563eb;">الفترة: ${dateRangeText}</strong>` : ''}
          <br/>تاريخ التقرير: ${new Date().toLocaleString('ar-EG')}
        </p>

        <div class="summary-grid">
            <div class="stat-box">
                <h3>إجمالي المحصل</h3>
                <p style="color: #059669;">${totalGross.toLocaleString()} ج.م</p>
            </div>
            <div class="stat-box">
                <h3>صافي الأرباح</h3>
                <p style="color: #2563eb;">${totalNetProfit.toLocaleString()} ج.م</p>
            </div>
            <div class="stat-box">
                <h3>عدد الطلبات</h3>
                <p>${orders.length}</p>
            </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>رقم الطلب</th>
              <th>العميل</th>
              <th>التاريخ</th>
              <th>المبلغ المحصل</th>
              <th>التكلفة</th>
              <th>صافي الربح/الخسارة</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
    `;
};

export const generatePartnersFinancialReportHTML = (stats: any, storeName: string, orientation: 'portrait' | 'landscape' = 'landscape', isContinuous: boolean = false, dateRangeText?: string): string => {
    const { allTimeNetProfit, undistributedProfit, distributedProfit, totals, partnerDetails } = stats;

    return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير الشركاء والمركز المالي - ${storeName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet" crossorigin="anonymous">
      <style>
        @page { 
          size: ${orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'}; 
          margin: ${isContinuous ? '0' : '1.5cm'}; 
        }
        * { box-sizing: border-box; }
        body { 
          font-family: 'Cairo', sans-serif; 
          font-size: 13px; 
          color: #0f172a; 
          line-height: 1.6;
          margin: 0;
          background-color: #f8fafc;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .report-wrapper {
            padding: ${isContinuous ? '20px' : '0'};
        }
        .report-container {
          background-color: #ffffff;
          padding: 30px;
          border-radius: ${isContinuous ? '16px' : '0'};
          margin: 0 auto;
          max-width: ${orientation === 'landscape' ? '297mm' : '210mm'};
          box-shadow: ${isContinuous ? '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' : 'none'};
        }
        @media print {
            body { background-color: #ffffff; }
            .report-wrapper { padding: 0; }
            .report-container { padding: 0; box-shadow: none; border-radius: 0; max-width: 100%; margin: 0; }
        }
        .report-header { 
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 30px; border-bottom: 2px dashed #e2e8f0; padding-bottom: 20px;
        }
        .header-titles h1 { margin: 0 0 8px 0; font-size: 24px; color: #0f172a; font-weight: 900; }
        .header-titles .subtitle { margin: 0; font-size: 14px; color: #64748b; font-weight: 600; }
        .header-titles .date { margin: 4px 0 0 0; font-size: 11px; color: #94a3b8; }
        
        .profit-card {
            background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
            padding: 12px 20px; 
            border-radius: 12px; 
            border: 1px solid #c7d2fe; 
            display: inline-block;
            box-shadow: 0 2px 4px rgba(79, 70, 229, 0.1);
        }
        .profit-card p { margin: 0; }
        .profit-card .label { font-size: 11px; color: #4f46e5; font-weight: 700; margin-bottom: 4px; }
        .profit-card .amount { font-size: 22px; font-weight: 900; color: #312e81; }

        .summary-grid {
          display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 30px;
        }
        .summary-card {
          padding: 16px; border-radius: 12px; background: #ffffff; border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
          text-align: center;
        }
        .summary-card .title { font-size: 12px; color: #64748b; font-weight: 700; margin-bottom: 8px; }
        .summary-card .value { font-size: 18px; font-weight: 900; color: #0f172a; }
        .value.red { color: #e11d48; }
        .value.green { color: #059669; }
        .value.orange { color: #d97706; }

        .section-title-wrap {
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 2px solid #f1f5f9;
        }
        .section-title { font-size: 16px; font-weight: 800; color: #1e293b; margin: 0; }
        
        table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
        th, td { border-bottom: 1px solid #f1f5f9; padding: 12px; text-align: right; }
        th { background-color: #f8fafc; font-weight: 700; color: #475569; border-top: 1px solid #e2e8f0; border-bottom: 2px solid #e2e8f0; }
        th:first-child { border-top-right-radius: 8px; border-left: none; }
        th:last-child { border-top-left-radius: 8px; border-right: none; }
        tbody tr:last-child td { border-bottom: none; }
        tbody tr:nth-child(even) { background-color: #f8fafc; }
        
        .pill { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; }
        .pill.positive { background-color: #d1fae5; color: #059669; }
        .pill.negative { background-color: #ffe4e6; color: #e11d48; }
        .pill.neutral { background-color: #f1f5f9; color: #475569; }
        .pill.blue { background-color: #dbeafe; color: #2563eb; }
        
        .font-mono { font-family: monospace; font-size: 13px; }
        ${getPrintControlBarCSS()}
      </style>
    </head>
    <body>
      ${getPrintControlBarHTML('تقرير الشركاء والمركز المالي')}
      <div class="report-wrapper">
      <div class="report-container">
          <div class="report-header">
            <div class="header-titles">
              <h1>${storeName}</h1>
              <p class="subtitle">تقرير الشركاء والمركز المالي</p>
              <p class="date">
                ${dateRangeText ? `<strong style="color: #4f46e5;">الفترة: ${dateRangeText}</strong><br/>` : ''}
                تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div>
               <div class="profit-card">
                    <p class="label">إجمالي الربح التاريخي</p>
                    <p class="amount">${allTimeNetProfit.toLocaleString('ar-EG')} ج.م</p>
               </div>
            </div>
          </div>

          <div class="summary-grid">
            <div class="summary-card">
              <div class="title">إجمالي رأس المال</div>
              <div class="value">${totals.capital.toLocaleString('ar-EG')} ج.م</div>
            </div>
            <div class="summary-card">
              <div class="title">الأرباح الموزعة</div>
              <div class="value green">${distributedProfit.toLocaleString('ar-EG')} ج.م</div>
            </div>
            <div class="summary-card">
              <div class="title">الأرباح غير الموزعة</div>
              <div class="value orange">${undistributedProfit.toLocaleString('ar-EG')} ج.م</div>
            </div>
            <div class="summary-card">
              <div class="title">إجمالي السلف القائمة</div>
              <div class="value red">${(totals.loans - totals.repayments).toLocaleString('ar-EG')} ج.م</div>
            </div>
            <div class="summary-card">
              <div class="title">إجمالي العرابين المحصلة</div>
              <div class="value" style="color: #0d9488; font-weight: 900;">${(totals.advances || 0).toLocaleString('ar-EG')} ج.م</div>
            </div>
          </div>

          <div class="section-title-wrap">
            <h2 class="section-title">تفاصيل المركز المالي لكل شريك</h2>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>الشريك</th>
                <th>النسبة</th>
                <th>رأس المال</th>
                <th>الأرباح المسحوبة</th>
                <th>السلف القائمة</th>
                <th>العربونات المستلمة</th>
                <th>الرصيد الكلي</th>
              </tr>
            </thead>
            <tbody>
              ${partnerDetails.length === 0 ? '<tr><td colspan="7" style="text-align: center; padding: 30px; color: #94a3b8; font-weight: 600;">لا يوجد شركاء مسجلين حالياً.</td></tr>' : partnerDetails.map((p: any) => `
                <tr>
                  <td style="font-weight: 800; color: #1e293b;">${p.name}</td>
                  <td><span class="pill blue">${p.profitRatio}%</span></td>
                   <td class="font-mono">${p.capital.toLocaleString('ar-EG')}</td>
                  <td class="font-mono green">+${p.withdrawals.toLocaleString('ar-EG')}</td>
                  <td class="font-mono red">${(p.loans - p.repayments).toLocaleString('ar-EG')}</td>
                  <td class="font-mono" style="color: #0d9488;">${(p.advances || 0).toLocaleString('ar-EG')}</td>
                  <td class="font-mono" style="font-weight: 900; font-size: 14px; color: ${p.balance >= 0 ? '#059669' : '#e11d48'};">${p.balance.toLocaleString('ar-EG')} ج.م</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
      </div>
      </div>
    </body>
    </html>
    `;
};

export const generateLossesReportHTML = (orders: Order[], settings: Settings, storeName: string, orientation: 'portrait' | 'landscape' = 'landscape', isContinuous: boolean = false, dateRangeText?: string): string => {
    let totalLoss = 0;
    let totalProductPrice = 0;
    let totalShippingFee = 0;
    let totalInsuranceInspection = 0;
    let totalProductCost = 0;

    const tableRows = orders.map(order => {
        const { net, loss, breakdown: financials } = calculateOrderProfitLoss(order, settings);
        
        totalLoss += loss;
        totalProductPrice += financials.productRevenue;
        totalShippingFee += financials.shippingRevenue;
        totalInsuranceInspection += (financials.insurance + financials.inspection + financials.vat);
        totalProductCost += financials.productCost;

        const products = order.items.map(i => i.name).join(' + ') || order.productName;
        const quantities = order.items.map(i => i.quantity).join(' + ') || '1';
        const prices = order.items.map(i => i.price.toLocaleString()).join(' + ') || order.productPrice.toLocaleString();
        
        return `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px;">${order.customerName}</td>
                <td style="padding: 8px;">${products}</td>
                <td style="padding: 8px; text-align: center;">${quantities}</td>
                <td style="padding: 8px;">${prices}</td>
                <td style="padding: 8px;">${financials.shippingPaid.toLocaleString()}</td>
                <td style="padding: 8px;">${(financials.insurance + financials.inspection + financials.vat).toLocaleString()}</td>
                <td style="padding: 8px;">${financials.productCost.toLocaleString()}</td>
                <td style="padding: 8px;">${order.status.replace(/_/g, ' ')}</td>
                <td style="padding: 8px;">${order.paymentStatus}</td>
                <td style="padding: 8px; font-weight: bold; color: #b91c1c;">
                    -${loss.toLocaleString()}
                    ${financials.cod > 0 ? `<br/><small style="color: #6b7280; font-weight: normal;">(تحصيل: ${financials.cod.toLocaleString()})</small>` : ''}
                </td>
            </tr>
        `;
    }).join('');

    return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير الخسائر - ${storeName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" crossorigin="anonymous">
      <style>
        @page { size: A4 ${orientation}; margin: ${isContinuous ? '0' : '1cm'}; }
        body { font-family: 'Cairo', sans-serif; font-size: 9px; color: #333; margin: 0; padding: 0; background: white; }
        
        /* Fix for Arabic text in html2canvas */
        * {
          letter-spacing: normal !important;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        
        .report-container { 
          width: 100%; 
          min-width: ${orientation === 'landscape' ? '1000px' : 'auto'};
          padding: ${isContinuous ? '40px' : '20px'}; 
          box-sizing: border-box; 
        }
        h1 { text-align: center; margin-bottom: 5px; color: #111827; font-size: 22px; }
        p.subtitle { text-align: center; margin-top: 0; margin-bottom: 20px; font-size: 12px; color: #6b7280; }
        .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 25px; }
        .stat-box { background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; }
        .stat-box h3 { margin: 0 0 5px 0; font-size: 11px; color: #6b7280; font-weight: bold; text-transform: uppercase; }
        .stat-box p { margin: 0; font-size: 20px; font-weight: 700; color: #111827; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; word-wrap: break-word; }
        th, td { padding: 8px 4px; border: 1px solid #ddd; text-align: right; font-size: 10px; overflow: hidden; }
        th { background-color: #f3f4f6; font-weight: bold; font-size: 10px; }
        thead { display: table-header-group; }
        tbody tr:nth-child(even) { background-color: #f9fafb; }
        .no-break { break-inside: avoid; page-break-inside: avoid; }

        ${orientation === 'portrait' ? `
          table { font-size: 8px; }
          th, td { padding: 4px 2px; font-size: 8px; }
          .summary-grid { gap: 10px; }
          .stat-box { padding: 10px; }
          .stat-box p { font-size: 16px; }
          h1 { font-size: 18px; }
        ` : ''}
        ${getPrintControlBarCSS()}
      </style>
    </head>
    <body>
      ${getPrintControlBarHTML('تقرير مسببات الخسائر المرتجعة')}
      <div class="report-container">
        <h1>تقرير الخسائر المفصّل</h1>
        <p class="subtitle">
          متجر "${storeName}"
          ${dateRangeText ? `<br/><strong style="color: #b91c1c;">الفترة: ${dateRangeText}</strong>` : ''}
          <br/><span style="font-size: 10px; color: #94a3b8;">تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')}</span>
        </p>

        <div class="summary-grid">
            <div class="stat-box">
                <h3>إجمالي الخسائر</h3>
                <p style="color: #dc2626;">-${totalLoss.toLocaleString()} ج.م</p>
            </div>
            <div class="stat-box">
                <h3>عدد الطلبات الفاشلة</h3>
                <p>${orders.length}</p>
            </div>
        </div>

        <table style="margin-top: 20px;">
          <thead>
            <tr>
              <th>اسم العميل</th>
              <th>المنتج أو المنتجات</th>
              <th>الكمية</th>
              <th>سعر المنتج</th>
              <th>مصاريف الشحن</th>
              <th>التأمين والمعاينة</th>
              <th>إجمالي التكلفة</th>
              <th>حالة الشحنة</th>
              <th>حالة الدفع</th>
              <th>الخسارة / مصاريف التحصيل</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="no-break" style="margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; padding: 20px; background: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb;">
          <div style="text-align: center;">
            <p style="font-weight: bold; margin-bottom: 30px; font-size: 12px;">توقيع المحاسب المسئول</p>
            <div style="border-top: 1px solid #cbd5e1; width: 150px; margin: 0 auto;"></div>
          </div>
          <div style="text-align: center;">
            <p style="font-weight: bold; margin-bottom: 30px; font-size: 12px;">اعتماد مدير المتجر</p>
            <div style="border-top: 1px solid #cbd5e1; width: 150px; margin: 0 auto;"></div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 30px; font-size: 10px; color: #94a3b8;">
          هذا التقرير تم إنشاؤه آليًا بواسطة "مدير الأوردرات الذكي" &copy; ${new Date().getFullYear()}
        </div>
      </div>
      <script>
        window.onload = function() {
          if (${isContinuous}) {
            setTimeout(() => {
              const container = document.querySelector('.report-container');
              if (!container) { window.print(); return; }
              
              const height = container.scrollHeight;
              
              const div = document.createElement('div');
              div.style.height = '100mm';
              div.style.position = 'absolute';
              div.style.visibility = 'hidden';
              document.body.appendChild(div);
              const mmInPx = div.offsetHeight / 100;
              document.body.removeChild(div);
              
              const heightMm = Math.ceil(height / mmInPx) + 35; 
              const pageWidth = "${orientation}" === "landscape" ? "297mm" : "210mm";
              
              const style = document.createElement('style');
              style.innerHTML = "@page { size: " + pageWidth + " " + heightMm + "mm !important; margin: 0 !important; } " +
                                "body, html { margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; min-height: 0 !important; } " +
                                ".report-container { margin: 0 !important; padding: 40px !important; border: none !important; box-shadow: none !important; width: 100% !important; max-width: none !important; } " +
                                "* { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; break-inside: avoid-page !important; } " +
                                "table, tr, td, th { break-inside: auto !important; } " +
                                ".no-break { break-inside: avoid !important; }";
              document.head.appendChild(style);
              
              setTimeout(() => { window.print(); }, 1200);
            }, 500);
          } else {
            setTimeout(() => { window.print(); }, 800);
          }
        };
      </script>
    </body>
    </html>
    `;
};

export const generateComprehensiveFinancialReportHTML = (orders: Order[], settings: Settings, wallet: Wallet, storeName: string, orientation: 'portrait' | 'landscape' = 'landscape', isContinuous: boolean = false, dateRangeText?: string): string => {
    const collectedOrders = (orders || []).filter(o => o.status === 'تم_التحصيل' || o.status === 'مدفوعة');
    const failedOrders = (orders || []).filter(o => ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'تمت_الاعادة_لشركة_الشحن'].includes(o.status));
    const notCollectedOrders = (orders || []).filter(o => o.status === 'تم_توصيلها' && !o.collectionProcessed);
    const inShippingOrders = (orders || []).filter(o => o.status === 'قيد_الشحن');
    const adminExpenses = (wallet?.transactions || []).filter(t => t.category?.startsWith('expense_') || t.category?.startsWith('supply_expense_'));
    const inventoryPurchases = (wallet?.transactions || []).filter(t => t.category === 'inventory_purchase');
    const totalInventoryPurchases = inventoryPurchases.reduce((sum, t) => sum + t.amount, 0);

    let totalProductRevenue = 0;
    let totalExtraMarkup = 0;
    let totalShippingRevenue = 0;
    let totalCogs = 0;
    let totalInsuranceFees = 0;
    let totalInspectionFees = 0;
    let totalCodFees = 0;
    let totalProfit = 0;
    let totalPercentageProfit = 0;
    let totalCommissionProfit = 0;

    const collectedRows = collectedOrders.map(order => {
        const { profit, breakdown: financials } = calculateOrderProfitLoss(order, settings);
        
        const isPosOrder = order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر';
        
        let orderBaseRevenue = 0;
        let orderExtraMarkup = 0;

        order.items.forEach(item => {
            const product = settings.products.find(p => p.id === item.productId);
            if (product?.profitMode === 'commission' && product.basePrice !== undefined) {
                const basePrice = product.basePrice;
                orderBaseRevenue += basePrice * item.quantity;
                orderExtraMarkup += (item.price - basePrice) * item.quantity;
            } else {
                orderBaseRevenue += item.price * item.quantity;
            }
        });

        const isMultiProfitOrder = orderExtraMarkup > 0;
        const rowStyle = isMultiProfitOrder ? 'background-color: #f0f9ff !important; border-right: 4px solid #0ea5e9;' : '';

        totalProductRevenue += orderBaseRevenue;
        totalExtraMarkup += orderExtraMarkup;
        totalShippingRevenue += order.shippingFee;
        totalCogs += financials.productCost;
        totalInsuranceFees += financials.insurance + financials.vat;
        totalInspectionFees += financials.inspection;
        totalCodFees += financials.cod;
        totalProfit += profit;

        // Calculate item-level profits based on profitMode
        order.items.forEach(item => {
            const product = settings.products.find(p => p.id === item.productId);
            const itemProfit = (item.price - item.cost) * item.quantity;
            if (product?.profitMode === 'commission' && product.basePrice !== undefined && product.commissionPercentage !== undefined) {
                totalCommissionProfit += (product.basePrice * (product.commissionPercentage / 100)) * item.quantity;
            } else {
                totalPercentageProfit += itemProfit;
            }
        });

        const productDetails = order.items.map(item => {
            const product = settings.products.find(p => p.id === item.productId);
            const isMulti = product?.profitMode === 'commission' && product.basePrice !== undefined && item.price > product.basePrice;
            return `
                <div style="margin-bottom: 4px; line-height: 1.4;">
                    <strong>${item.name}</strong> (${item.quantity})
                    ${isMulti ? '<br/><span style="font-size: 8px; background: #0ea5e9; color: white; padding: 1px 4px; border-radius: 4px; display: inline-block; margin-top: 2px;">ربح مركب (أساسي + زيادة)</span>' : ''}
                </div>
            `;
        }).join('');

        return `
            <tr style="${rowStyle}">
                <td>${order.orderNumber}</td>
                <td>${order.customerName}</td>
                <td class="col-products">${productDetails}</td>
                <td>${order.productPrice.toLocaleString()}</td>
                <td>${order.shippingFee.toLocaleString()}</td>
                <td>${financials.productCost.toLocaleString()}</td>
                <td>${(financials.insurance + financials.vat).toLocaleString()}</td>
                <td>${financials.inspection.toLocaleString()}</td>
                <td>${financials.cod.toLocaleString()}</td>
                <td style="color: #15803d; font-weight: bold;">${profit.toLocaleString()}</td>
            </tr>`;
    }).join('');

    let totalFailedShipping = 0;
    let totalFailedInsurance = 0;
    let totalFailedInspection = 0;
    let totalReturnFees = 0;
    let totalLoss = 0;

    const failedRows = failedOrders.map(order => {
        const { loss, breakdown: financials } = calculateOrderProfitLoss(order, settings);
        
        totalFailedShipping += financials.shippingPaid;
        totalFailedInsurance += financials.insurance + financials.vat;
        totalFailedInspection += financials.inspection;
        totalReturnFees += financials.returnFee;
        totalLoss += loss;

        const productDetails = order.items.map(item => `<div style="margin-bottom: 4px; line-height: 1.4;"><strong>${item.name}</strong> (${item.quantity})</div>`).join('');

        return `
            <tr>
                <td>${order.orderNumber}</td>
                <td>${order.customerName}</td>
                <td class="col-products">${productDetails}</td>
                <td>${order.status.replace(/_/g, ' ')}</td>
                <td>${financials.shippingPaid.toLocaleString()}</td>
                <td>${(financials.insurance + financials.vat).toLocaleString()}</td>
                <td>${financials.inspection.toLocaleString()}</td>
                <td>${financials.returnFee.toLocaleString()}</td>
                <td style="color: #b91c1c; font-weight: bold;">-${loss.toLocaleString()}</td>
            </tr>`;
    }).join('');

    let totalExpenses = 0;
    const expenseRows = adminExpenses.map(t => {
        totalExpenses += t.amount;
        return `<tr><td>${new Date(t.date).toLocaleDateString('ar-EG')}</td><td>${t.note}</td><td style="color: #b91c1c;">-${t.amount.toLocaleString()}</td></tr>`;
    }).join('');

    const finalNet = totalProfit - totalLoss - totalExpenses;

    // --- NEW CALCULATIONS ---
    const successRate = orders.length > 0 ? (collectedOrders.length / orders.length) * 100 : 0;
    const grossProfit = totalPercentageProfit + totalCommissionProfit;
    const lossRatio = grossProfit > 0 ? (totalLoss / grossProfit) * 100 : 0;
    const avgProfitPerOrder = orders.length > 0 ? finalNet / orders.length : 0;

    // Carrier Performance
    const carrierStats: Record<string, { count: number, success: number, shipping: number, profit: number }> = {};
    orders.forEach(o => {
        const name = o.shippingCompany || 'غير محدد';
        if (!carrierStats[name]) carrierStats[name] = { count: 0, success: 0, shipping: 0, profit: 0 };
        carrierStats[name].count++;
        if (o.status === 'تم_التحصيل' || o.status === 'مدفوعة') carrierStats[name].success++;
        carrierStats[name].shipping += o.shippingFee;
        const { net } = calculateOrderProfitLoss(o, settings);
        carrierStats[name].profit += net;
    });

    const carrierRows = Object.entries(carrierStats).map(([name, stats]) => {
        const rate = stats.count > 0 ? (stats.success / stats.count) * 100 : 0;
        return `<tr>
            <td>${name}</td>
            <td>${stats.count}</td>
            <td>${rate.toFixed(1)}%</td>
            <td>${stats.shipping.toLocaleString()}</td>
            <td style="font-weight: bold; color: ${stats.profit >= 0 ? '#15803d' : '#b91c1c'};">${stats.profit.toLocaleString()}</td>
        </tr>`;
    }).join('');

    // Product Profitability
    const productStats: Record<string, { revenue: number, extra: number, cost: number, sold: number, returns: number }> = {};
    orders.forEach(o => {
        o.items.forEach(item => {
            if (!productStats[item.name]) productStats[item.name] = { revenue: 0, extra: 0, cost: 0, sold: 0, returns: 0 };
            if (o.status === 'تم_التحصيل' || o.status === 'مدفوعة') {
                const product = settings.products.find(p => p.id === item.productId);
                if (product?.profitMode === 'commission' && product.basePrice !== undefined) {
                    productStats[item.name].revenue += product.basePrice * item.quantity;
                    productStats[item.name].extra += (item.price - product.basePrice) * item.quantity;
                } else {
                    productStats[item.name].revenue += item.price * item.quantity;
                }
                productStats[item.name].cost += item.cost * item.quantity;
                productStats[item.name].sold += item.quantity;
            } else if (['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'تمت_الاعادة_لشركة_الشحن'].includes(o.status)) {
                productStats[item.name].returns += item.quantity;
            }
        });
    });

    const productRows = Object.entries(productStats)
        .sort((a, b) => {
            const profitA = (a[1].revenue - a[1].cost) + a[1].extra;
            const profitB = (b[1].revenue - b[1].cost) + b[1].extra;
            return profitB - profitA;
        })
        .map(([name, stats]) => {
            const totalProfit = (stats.revenue - stats.cost) + stats.extra;
            const returnRate = (stats.sold + stats.returns) > 0 ? (stats.returns / (stats.sold + stats.returns)) * 100 : 0;
            const isMultiProfit = stats.extra > 0;
            const rowStyle = isMultiProfit ? 'background-color: #f0f9ff !important; border-right: 4px solid #0ea5e9;' : '';
            
            return `<tr style="${rowStyle}">
                <td>
                    ${name}
                    ${isMultiProfit ? '<br/><span style="font-size: 8px; background: #0ea5e9; color: white; padding: 1px 4px; border-radius: 4px; display: inline-block; margin-top: 2px;">ربح مركب (أساسي + زيادة)</span>' : ''}
                </td>
                <td>${stats.sold}</td>
                <td>${stats.returns} (${returnRate.toFixed(1)}%)</td>
                <td>${stats.revenue.toLocaleString()}</td>
                <td>${stats.extra.toLocaleString()}</td>
                <td style="font-weight: bold; color: #15803d;">${totalProfit.toLocaleString()}</td>
            </tr>`;
        }).join('');

    // Break-even
    const avgOrderProfit = collectedOrders.length > 0 ? totalProfit / collectedOrders.length : 0;
    const breakEvenOrders = avgOrderProfit > 0 ? Math.ceil(totalExpenses / avgOrderProfit) : 0;

    // Expense Breakdown
    const expenseCats: Record<string, number> = {};
    adminExpenses.forEach(t => {
        let cat = t.category || 'other';
        if (cat.startsWith('supply_expense_')) {
            cat = cat.replace('supply_expense_', 'supply_');
        } else if (cat.startsWith('expense_')) {
            cat = cat.replace('expense_', '');
        }
        expenseCats[cat] = (expenseCats[cat] || 0) + t.amount;
    });
    const expenseCatRows = Object.entries(expenseCats).map(([cat, amount]) => {
        const percent = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
        const catName = cat === 'ads' ? 'إعلانات' : cat === 'salary' ? 'رواتب' : cat === 'rent' ? 'إيجار' : cat === 'supply_shipping' ? 'شحن مشتريات (توريد)' : cat === 'supply_other' ? 'مصاريف توريد أخرى' : 'أخرى';
        return `<tr><td>${catName}</td><td>${amount.toLocaleString()} ج.م</td><td>${percent.toFixed(1)}%</td></tr>`;
    }).join('');

    // Wallet Sync
    const pendingCollection = orders.filter(o => o.status === 'تم_توصيلها' && !o.collectionProcessed).reduce((sum, o) => sum + (o.productPrice + o.shippingFee), 0);
    const inventoryValue = (settings.products || []).reduce((sum, p) => {
        if (p.hasVariants && p.variants) {
            return sum + p.variants.reduce((vSum, v) => vSum + (getLatestProductCost(v.id, settings) * (v.stockQuantity || 0)), 0);
        }
        return sum + (getLatestProductCost(p.id, settings) * (p.stockQuantity || 0));
    }, 0);

    // Geographic Analysis
    const geoStats: Record<string, { count: number, success: number, revenue: number, loss: number }> = {};
    orders.forEach(o => {
        const area = o.governorate || o.shippingArea || 'غير محدد';
        if (!geoStats[area]) geoStats[area] = { count: 0, success: 0, revenue: 0, loss: 0 };
        geoStats[area].count++;
        const { loss } = calculateOrderProfitLoss(o, settings);
        if (o.status === 'تم_التحصيل' || o.status === 'مدفوعة') {
            geoStats[area].success++;
            geoStats[area].revenue += (o.productPrice + o.shippingFee);
        }
        geoStats[area].loss += loss;
    });

    const geoRows = Object.entries(geoStats)
        .sort((a, b) => (b[1].revenue - b[1].loss) - (a[1].revenue - a[1].loss))
        .map(([name, s]) => {
            const rate = (s.success / s.count) * 100;
            const net = s.revenue - s.loss;
            return `<tr>
                <td>${name}</td>
                <td>${s.count}</td>
                <td>${rate.toFixed(1)}%</td>
                <td>${s.revenue.toLocaleString()}</td>
                <td style="font-weight: bold; color: ${net >= 0 ? '#15803d' : '#b91c1c'};">${net.toLocaleString()}</td>
            </tr>`;
        }).join('');

    // Top Insights
    const topProducts = Object.entries(productStats)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 3)
        .map(([name, stats]) => `<li>${name} (${stats.sold} قطعة)</li>`)
        .join('');

    const topAreas = Object.entries(geoStats)
        .sort((a, b) => (b[1].revenue - b[1].loss) - (a[1].revenue - a[1].loss))
        .slice(0, 3)
        .map(([name, s]) => `<li>${name} (${((s.success/s.count)*100).toFixed(0)}% نجاح)</li>`)
        .join('');

    // Smart Recommendations
    const recommendations = [];
    if (successRate < 70) recommendations.push(`⚠️ نسبة النجاح منخفضة (${successRate.toFixed(1)}%). ننصح بمراجعة جودة تأكيد الأوردرات أو تغيير شركة الشحن في المناطق الضعيفة.`);
    if (lossRatio > 15) recommendations.push(`📉 المرتجعات تستهلك نسبة كبيرة من أرباحك (${lossRatio.toFixed(1)}%). حاول تحسين وصف المنتجات لتقليل المرتجعات.`);
    if (totalExpenses > (totalPercentageProfit + totalCommissionProfit) * 0.5) recommendations.push(`💸 المصروفات الإدارية مرتفعة جداً مقارنة بالأرباح. حاول ترشيد الإنفاق على الإعلانات أو الرواتب.`);
    if (avgProfitPerOrder < 50) recommendations.push(`💡 متوسط الربح للطلب ضعيف. قد تحتاج لرفع أسعار المنتجات أو تقليل تكاليف الشحن.`);

    const recommendationHtml = recommendations.length > 0 ? `
        <div class="recommendation-box">
            <h4>توصيات ذكية لتحسين الأداء (Smart Insights)</h4>
            <ul style="margin: 0; padding-right: 20px; font-size: 11px; color: #9a3412; line-height: 1.6;">
                ${recommendations.map(r => `<li>${r}</li>`).join('')}
            </ul>
        </div>
    ` : '';

    return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>ملخص شامل لأداء متجرك والمركز المالي للشركاء - ${storeName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet" crossorigin="anonymous">
      <style>
        @page { 
          size: A4 ${orientation}; 
          margin: ${isContinuous ? '0' : '0.8cm'}; 
          @bottom-right {
            content: "${isContinuous ? '' : 'صفحة ' + 'counter(page)' + ' من ' + 'counter(pages)'}";
            font-family: 'Cairo', sans-serif;
            font-size: 9px;
            color: #94a3b8;
          }
        }
        body { 
          font-family: 'Cairo', sans-serif; 
          font-size: 12px; 
          color: #1e293b; 
          line-height: 1.6;
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact; 
          color-adjust: exact; 
          background-color: white;
        }
        
        /* Fix for Arabic text in html2canvas */
        * {
          letter-spacing: normal !important;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        
        .report-container { 
          width: 100%; 
          margin: 0 auto; 
          position: relative; 
          background: #ffffff;
          min-height: auto;
          padding: ${isContinuous ? '60px' : '40px'};
          box-sizing: border-box;
        }
        
        /* Professional Header */
        .report-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 50px;
          padding: 30px;
          background: #f1f5f9;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
        }
        .store-info h1 { font-size: 32px; font-weight: 900; color: #0f172a; margin: 0; text-align: right; letter-spacing: -1px; }
        .store-info p { margin: 5px 0; color: #64748b; font-size: 14px; font-weight: 600; }
        .report-meta { text-align: left; }
        .report-meta .title { 
          font-size: 20px; 
          font-weight: 900; 
          color: #1e3a8a; 
          display: block; 
          background: #dbeafe; 
          padding: 8px 20px; 
          border-radius: 50px;
          margin-bottom: 10px;
        }
        .report-meta .date { font-size: 12px; color: #94a3b8; font-weight: 600; }

        /* Typography */
        h2 { font-size: 22px; font-weight: 900; color: #1e3a8a; margin: 40px 0 20px 0; display: flex; align-items: center; gap: 15px; }
        h2::after { content: ""; flex: 1; height: 3px; background: linear-gradient(to left, #e5e7eb, transparent); }
        h3 { font-size: 18px; font-weight: 700; margin: 30px 0 15px 0; color: #1e40af; }
        h4 { font-size: 15px; font-weight: 700; margin: 20px 0 12px 0; color: #374151; }

        /* Tables */
        table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 40px; background: white; table-layout: fixed; font-size: 11px; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
        th, td { border: none; border-bottom: 1px solid #f1f5f9; padding: 14px 10px; text-align: center; word-wrap: break-word; white-space: normal !important; }
        th { background-color: #f8fafc; color: #1e293b; font-weight: 800; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
        thead { display: table-header-group; }
        tr:last-child td { border-bottom: none; }
        tr:nth-child(even) { background-color: #fafafa; }
        tr:hover { background-color: #f1f5f9; }
        
        /* Column Widths */
        .col-id { width: 40px; }
        .col-customer { width: 120px; }
        .col-products { width: 250px; text-align: right !important; }
        .col-status { width: 100px; }
        .col-num { width: 80px; }
        .col-profit { width: 90px; }

        .total-row { background-color: #f1f5f9 !important; font-weight: 900; color: #0f172a; }
        .total-row td { border-top: 2px solid #1e3a8a; }

        /* Layout Components */
        .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px; margin-bottom: 40px; }
        .stat-card { 
          background: #ffffff; 
          border: 1px solid #e2e8f0; 
          border-radius: 24px; 
          padding: 30px; 
          text-align: center; 
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
          position: relative;
          overflow: hidden;
          border-bottom: 4px solid #e2e8f0;
        }
        .stat-card::before {
          content: "";
          position: absolute;
          top: 0; right: 0; width: 6px; height: 100%;
          background: #3b82f6;
        }
        .stat-card .label { font-size: 13px; color: #64748b; margin-bottom: 12px; display: block; font-weight: 700; text-transform: uppercase; }
        .stat-card .value { font-size: 32px; font-weight: 900; color: #0f172a; letter-spacing: -1px; }
        .stat-card .sub-label { font-size: 10px; color: #94a3b8; margin-top: 10px; display: block; font-weight: 500; }

        .stage-banner { 
          display: flex; 
          align-items: center; 
          gap: 20px; 
          background: #ffffff; 
          padding: 20px 30px; 
          border-radius: 16px; 
          margin-bottom: 20px; 
          border-right: 8px solid #3b82f6;
          break-inside: avoid;
          box-shadow: 0 4px 15px rgba(0,0,0,0.05);
          position: relative;
        }
        .stage-banner.green { border-right-color: #10b981; background: #f0fdf4; }
        .stage-banner.green .stage-number { background: #10b981; }
        .stage-banner.green .stage-title { color: #065f46; }

        .stage-number { 
          width: 40px; 
          height: 40px; 
          background: #3b82f6; 
          color: white; 
          border-radius: 50%; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          font-weight: 900; 
          font-size: 20px;
          box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);
        }
        .stage-title { font-size: 22px; font-weight: 900; color: #1e3a8a; margin: 0; }

        .explanation-box { 
          background: #ffffff; 
          border-radius: 12px; 
          padding: 18px 25px; 
          margin-bottom: 30px; 
          font-size: 12px; 
          color: #475569; 
          line-height: 1.8;
          border-right: 4px solid #e2e8f0;
          box-shadow: 0 2px 5px rgba(0,0,0,0.02);
        }

        .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 35px; }
        .metric-box { 
          background: #ffffff; 
          border: 1px solid #f1f5f9; 
          padding: 20px; 
          border-radius: 16px; 
          text-align: center;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          transition: transform 0.2s;
          position: relative;
          overflow: hidden;
        }
        .metric-box h4 { margin: 0 0 12px 0; font-size: 12px; color: #64748b; font-weight: 600; }
        .metric-box p { margin: 0; font-size: 22px; font-weight: 900; color: #1e2937; }
        .metric-box .sub-text { font-size: 10px; color: #94a3b8; margin-top: 10px; display: block; }
        
        .progress-bar {
          height: 6px;
          background: #f1f5f9;
          border-radius: 3px;
          margin-top: 15px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: #3b82f6;
          border-radius: 3px;
        }
        .progress-fill.green { background: #10b981; }
        .progress-fill.red { background: #ef4444; }

        .final-banner { 
          background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); 
          color: white; 
          padding: 60px 40px; 
          border-radius: 32px; 
          text-align: center; 
          margin: 60px 0;
          box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.3);
          position: relative;
          overflow: hidden;
        }
        .final-banner::after {
          content: "";
          position: absolute;
          top: -50%; left: -50%; width: 200%; height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%);
          pointer-events: none;
        }
        .final-banner h3 { margin: 0; font-size: 20px; font-weight: 600; opacity: 0.8; color: white; text-transform: uppercase; letter-spacing: 2px; }
        .final-banner .amount { font-size: 64px; font-weight: 900; margin: 20px 0; letter-spacing: -2px; text-shadow: 0 10px 20px rgba(0,0,0,0.2); }
        .final-banner p { font-size: 14px; opacity: 0.7; max-width: 600px; margin: 0 auto; line-height: 1.6; }
        
        .income-statement { border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); background: #fff; }
        .income-statement tr td { padding: 18px 25px; text-align: right; border-bottom: 1px solid #f1f5f9; }
        .income-statement tr td:last-child { text-align: left; font-weight: 800; width: 180px; font-size: 14px; color: #0f172a; }
        .income-statement .group-header { background: #f8fafc; font-weight: 900; color: #1e3a8a; border-top: 1px solid #e2e8f0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
        .income-statement .indent { padding-right: 50px; color: #64748b; font-size: 12px; }
        .income-statement .total-line { border-top: 2px solid #1e3a8a; background: #f0f9ff; font-weight: 900; color: #1e3a8a; }
        .income-statement tr:last-child td { border-bottom: none; }

        .recommendation-box { 
          background: #fffaf0; 
          border: 1px solid #feebc8; 
          border-radius: 12px; 
          padding: 20px; 
          margin-top: 30px;
          break-inside: avoid;
        }
        .recommendation-box h4 { color: #c05621; margin-top: 0; display: flex; align-items: center; gap: 8px; }

        .signature-section {
          margin-top: 80px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 60px;
          padding: 40px;
          background: #f8fafc;
          border-radius: 24px;
          border: 1px solid #e2e8f0;
          break-inside: avoid;
        }
        .signature-box { text-align: center; color: #1e293b; }
        .signature-box p { font-weight: 800; font-size: 14px; margin-bottom: 40px; color: #475569; }
        .signature-line { border-top: 2px solid #cbd5e1; width: 200px; margin: 0 auto; }
        .signature-box span { font-size: 11px; color: #94a3b8; display: block; margin-top: 10px; }

        .page-break { height: 0; margin: 0; padding: 0; page-break-before: ${isContinuous ? 'avoid' : 'always'}; break-before: ${isContinuous ? 'avoid' : 'page'}; }
        .no-break { break-inside: avoid; page-break-inside: avoid; }

        ${orientation === 'portrait' ? `
          .report-container { padding: ${isContinuous ? '40px 20px' : '15px'}; }
          .report-header { padding: 15px; margin-bottom: 20px; flex-direction: column; text-align: center; gap: 10px; }
          .store-info h1 { font-size: 22px; text-align: center; }
          .report-meta { text-align: center; }
          .summary-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
          .stat-card { padding: 12px; border-radius: 12px; }
          .stat-card .value { font-size: 18px; }
          .metrics-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px; }
          .metric-box { padding: 10px; }
          .metric-box p { font-size: 14px; }
          table { font-size: 7.5px; border-radius: 8px; margin-bottom: 15px; }
          th, td { padding: 5px 3px; }
          .col-products { width: 100px; }
          .col-customer { width: 60px; }
          .col-num { width: 40px; }
          .col-profit { width: 50px; }
          .col-status { width: 55px; }
          .final-banner { padding: 25px 15px; margin: 25px 0; border-radius: 16px; }
          .final-banner .amount { font-size: 32px; }
          .income-statement tr td { padding: 8px 12px; font-size: 10px; }
          .income-statement tr td:last-child { width: 100px; font-size: 11px; }
          .signature-section { grid-template-columns: 1fr 1fr; gap: 20px; padding: 15px; margin-top: 30px; }
          h2 { font-size: 16px; margin: 15px 0 8px 0; }
          h3 { font-size: 14px; margin: 12px 0 8px 0; }
        ` : ''}

        /* Watermark */
        .watermark {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 150px;
          color: rgba(0,0,0,0.02);
          pointer-events: none;
          z-index: -1;
          white-space: nowrap;
          font-weight: 900;
        }

        tfoot { display: table-row-group; }
        ${getPrintControlBarCSS()}
      </style>
    </head>
    <body>
      ${getPrintControlBarHTML('ملخص الأداء والمركز المالي')}
      <div class="watermark">${storeName}</div>
      <div class="report-container">
        <div class="report-header">
          <div class="store-info">
            <h1>${storeName}</h1>
            <p>ملخص شامل لأداء متجرك والمركز المالي للشركاء</p>
            ${dateRangeText ? `<p style="color: #1e3a8a; font-weight: bold; margin: 4px 0;">الفترة: ${dateRangeText}</p>` : ''}
            <p>${new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div class="report-meta">
            <span class="title">الملخص الشامل</span>
            <span class="date">تاريخ الاستخراج: ${new Date().toLocaleTimeString('ar-EG')}</span>
          </div>
        </div>

        <div class="summary-grid no-break">
          <div class="stat-card">
            <span class="label">إجمالي المبيعات</span>
            <span class="value">${(totalProductRevenue + totalExtraMarkup + totalShippingRevenue).toLocaleString()} ج.م</span>
            <span class="sub-label">(ثمن المنتجات + الزيادة + تحصيل الشحن)</span>
          </div>
          <div class="stat-card" style="border-top: 4px solid #1e3a8a;">
            <span class="label">صافي الربح النهائي</span>
            <span class="value" style="color: #1e3a8a;">${finalNet.toLocaleString()} ج.م</span>
            <span class="sub-label">(الأرباح - الخسائر - المصاريف)</span>
          </div>
          <div class="stat-card">
            <span class="label">إجمالي المشتروات</span>
            <span class="value" style="color: #e11d48;">${totalInventoryPurchases.toLocaleString()} ج.م</span>
            <span class="sub-label">(بضاعة جديدة من الموردين)</span>
          </div>
          <div class="stat-card">
            <span class="label">نسبة النجاح</span>
            <span class="value" style="color: ${successRate >= 70 ? '#15803d' : '#b91c1c'};">${successRate.toFixed(1)}%</span>
            <span class="sub-label">(الناجح ÷ إجمالي الطلبات)</span>
          </div>
          <div class="stat-card">
            <span class="label">قيمة المخزون</span>
            <span class="value">${inventoryValue.toLocaleString()} ج.م</span>
            <span class="sub-label">(سعر التكلفة)</span>
          </div>
        </div>

        <!-- Stage 1 -->
        <div class="stage-banner no-break">
          <div class="stage-number">1</div>
          <h3 class="stage-title">المرحلة الأولى: الإيرادات والتدفقات (Revenues)</h3>
        </div>
        <div class="explanation-box no-break">
          تمثل هذه المرحلة "إجمالي المال الداخل" للمتجر قبل خصم أي تكاليف. تشمل ثمن المنتجات الأساسي، الزيادة السعرية (Markup)، ومبالغ الشحن المحصلة من العملاء.
        </div>
        <div class="metrics-grid no-break">
          <div class="metric-box"><h4>مبيعات المنتجات</h4><p>${totalProductRevenue.toLocaleString()}</p></div>
          <div class="metric-box"><h4>الربح الإضافي</h4><p>${totalExtraMarkup.toLocaleString()}</p></div>
          <div class="metric-box"><h4>تحصيل الشحن</h4><p>${totalShippingRevenue.toLocaleString()}</p></div>
          <div class="metric-box" style="background: #eff6ff;"><h4>إجمالي الإيرادات</h4><p style="color: #1e40af;">${(totalProductRevenue + totalExtraMarkup + totalShippingRevenue).toLocaleString()}</p></div>
        </div>

        <!-- Stage 2 -->
        <div class="stage-banner no-break" style="border-right-color: #475569;">
          <div class="stage-number" style="background: #475569;">2</div>
          <h3 class="stage-title">المرحلة الثانية: التكاليف المباشرة (Direct Costs)</h3>
        </div>
        <div class="explanation-box no-break">
          نخصم هنا التكاليف الحتمية لإتمام البيع: ثمن البضاعة للموردين ومصاريف الشحن المدفوعة لشركات الشحن للطلبات الناجحة.
        </div>
        <div class="metrics-grid no-break" style="grid-template-columns: repeat(2, 1fr);">
          <div class="metric-box"><h4>مستحقات الموردين</h4><p style="color: #475569;">${totalCogs.toLocaleString()}</p></div>
          <div class="metric-box"><h4>مصاريف شحن الذهاب</h4><p style="color: #dc2626;">-${totalShippingRevenue.toLocaleString()}</p></div>
        </div>

        <!-- Stage 3 -->
        <div class="stage-banner no-break" style="border-right-color: #d97706;">
          <div class="stage-number" style="background: #d97706;">3</div>
          <h3 class="stage-title">المرحلة الثالثة: الرسوم والخدمات (Fees)</h3>
        </div>
        <div class="explanation-box no-break">
          رسوم "تسهيل العمل" التي تقتطعها شركات الشحن أو الخدمات: التأمين، المعاينة، ورسوم تحصيل الكاش (COD).
        </div>
        <div class="metrics-grid no-break" style="grid-template-columns: repeat(3, 1fr);">
          <div class="metric-box"><h4>إجمالي التأمين</h4><p>${totalInsuranceFees.toLocaleString()}</p></div>
          <div class="metric-box"><h4>إجمالي المعاينة</h4><p>${totalInspectionFees.toLocaleString()}</p></div>
          <div class="metric-box"><h4>رسوم COD</h4><p>${totalCodFees.toLocaleString(undefined, {maximumFractionDigits: 2})}</p></div>
        </div>

        <!-- Stage 4 -->
        <div class="stage-banner no-break" style="border-right-color: #dc2626;">
          <div class="stage-number" style="background: #dc2626;">4</div>
          <h3 class="stage-title">المرحلة الرابعة: الخسائر والمصروفات (Losses & Expenses)</h3>
        </div>
        <div class="explanation-box no-break">
          التكاليف المهدرة والمصروفات العامة: خسائر شحن وتأمين المرتجعات، والمصروفات الإدارية (إعلانات، رواتب، إيجار).
        </div>
        <div class="metrics-grid no-break" style="grid-template-columns: repeat(2, 1fr);">
          <div class="metric-box">
            <h4>خسائر المرتجعات</h4>
            <p style="color: #dc2626;">-${totalLoss.toLocaleString()}</p>
            <span class="sub-text">تكلفة شحن المرتجعات المفقودة</span>
          </div>
          <div class="metric-box">
            <h4>المصروفات الإدارية</h4>
            <p style="color: #dc2626;">-${totalExpenses.toLocaleString()}</p>
            <span class="sub-text">إعلانات، رواتب، إيجار، إلخ</span>
          </div>
        </div>

        <!-- Stage 5 -->
        <div class="stage-banner green no-break">
          <div class="stage-number">5</div>
          <h3 class="stage-title">المرحلة الخامسة: تحليل الأداء والنمو (Analysis)</h3>
        </div>
        <div class="explanation-box no-break">
          هذه المرحلة مخصصة لاتخاذ القرارات. توضح كفاءة العمل من خلال نسب النجاح، وتوزيع الأرباح حسب المناطق والمنتجات وشركات الشحن.
        </div>
        <div class="metrics-grid no-break" style="grid-template-columns: repeat(3, 1fr);">
          <div class="metric-box" style="border: 2px solid #10b981;">
            <h4>نسبة نجاح التوصيل</h4>
            <p style="color: #10b981;">${successRate.toFixed(1)}%</p>
            <span class="sub-text">تقيس مدى كفاءة الشحن وتأكيد الأوردرات</span>
            <div class="progress-bar"><div class="progress-fill green" style="width: ${successRate}%"></div></div>
          </div>
          <div class="metric-box" style="border-bottom: 4px solid #ef4444;">
            <h4>نسبة الخسارة إلى الربح</h4>
            <p style="color: #ef4444;">${((totalLoss / (totalProfit || 1)) * 100).toFixed(1)}%</p>
            <span class="sub-text">توضح كم يستهلك المرتجع من أرباحك الصافية</span>
            <div class="progress-bar"><div class="progress-fill red" style="width: ${Math.min(100, (totalLoss / (totalProfit || 1)) * 100)}%"></div></div>
          </div>
          <div class="metric-box">
            <h4>متوسط الربح للطلب</h4>
            <p style="color: #3b82f6;">${(finalNet / (collectedOrders.length || 1)).toFixed(2)} ج.م</p>
            <span class="sub-text">الربح الفعلي الصافي لكل أوردر بعد كل التكاليف</span>
            <div class="progress-bar"><div class="progress-fill" style="width: 100%"></div></div>
          </div>
        </div>

        <div style="break-before: ${isContinuous ? 'avoid' : 'page'}; page-break-before: ${isContinuous ? 'avoid' : 'always'};">
          <h2 class="no-break">القائمة المالية الموحدة (Unified Statement)</h2>
          <table class="income-statement no-break">
            <tr class="group-header"><td colspan="2">1. الإيرادات (Revenues)</td></tr>
            <tr><td class="indent">إجمالي مبيعات المنتجات (بالسعر الأساسي)</td><td style="color: #10b981;">+${totalProductRevenue.toLocaleString()} ج.م</td></tr>
            <tr><td class="indent">الزيادة في السعر (ربح إضافي)</td><td style="color: #10b981;">+${totalExtraMarkup.toLocaleString()} ج.م</td></tr>
            <tr><td class="indent">إجمالي تحصيل الشحن من العملاء</td><td style="color: #10b981;">+${totalShippingRevenue.toLocaleString()} ج.م</td></tr>
            <tr class="total-line"><td>(=) إجمالي الإيرادات (Total Revenue)</td><td>${(totalProductRevenue + totalExtraMarkup + totalShippingRevenue).toLocaleString()} ج.م</td></tr>

            <tr class="group-header"><td colspan="2">2. تكلفة المبيعات (Cost of Goods Sold)</td></tr>
            <tr><td class="indent">(-) إجمالي مستحقات الموردين (ثمن البضاعة)</td><td style="color: #dc2626;">-${totalCogs.toLocaleString()} ج.م</td></tr>
            <tr><td class="indent">(-) إجمالي مصاريف شحن الذهاب (لشركات الشحن)</td><td style="color: #dc2626;">-${totalShippingRevenue.toLocaleString()} ج.م</td></tr>
            
            <tr class="group-header"><td colspan="2">3. إجمالي الربح التشغيلي (Gross Profit)</td></tr>
            <tr><td class="indent">تفصيل الربح: ربح العمولات</td><td style="color: #10b981;">+${totalCommissionProfit.toLocaleString()} ج.م</td></tr>
            <tr><td class="indent">تفصيل الربح: ربح الزيادة في السعر</td><td style="color: #10b981;">+${totalExtraMarkup.toLocaleString()} ج.م</td></tr>
            <tr><td class="indent">تفصيل الربح: ربح المبيعات الأساسي</td><td style="color: #10b981;">+${totalPercentageProfit.toLocaleString()} ج.م</td></tr>
            <tr class="total-line"><td>(=) إجمالي الربح التشغيلي</td><td>${(totalCommissionProfit + totalPercentageProfit + totalExtraMarkup).toLocaleString()} ج.م</td></tr>

            <tr class="group-header"><td colspan="2">4. الخسائر والمصروفات (Losses & Expenses)</td></tr>
            <tr><td class="indent">(-) إجمالي رسوم التأمين والمعاينة والتحصيل</td><td style="color: #dc2626;">-${(totalInsuranceFees + totalInspectionFees + totalCodFees).toLocaleString(undefined, {maximumFractionDigits: 2})} ج.م</td></tr>
            <tr><td class="indent">(-) إجمالي خسائر المرتجعات والفشل</td><td style="color: #dc2626;">-${totalLoss.toLocaleString()} ج.م</td></tr>
            <tr><td class="indent">(-) إجمالي المصروفات الإدارية (إعلانات، رواتب...)</td><td style="color: #dc2626;">-${totalExpenses.toLocaleString()} ج.م</td></tr>
            
            <tr class="group-header"><td colspan="2">5. المشتروات (Purchases)</td></tr>
            <tr><td class="indent">إجمالي مشتريات البضاعة الجديدة</td><td style="color: #e11d48;">-${totalInventoryPurchases.toLocaleString()} ج.م</td></tr>

            <tr class="total-line" style="background: #1e3a8a; color: white; font-size: 18px;">
              <td>صافي الربح النهائي</td>
              <td>${finalNet.toLocaleString()} ج.م</td>
            </tr>
          </table>

          <div class="final-banner no-break">
            <h3>صافي الربح النهائي (The Bottom Line)</h3>
            <div class="amount">${finalNet.toLocaleString()} ج.م</div>
            <p style="font-size: 14px; opacity: 0.8;">نقطة التعادل: تحتاج إلى ${breakEvenOrders} أوردر ناجح إضافي لتغطية المصروفات الإدارية.</p>
          </div>

          <div class="no-break">
            ${recommendationHtml}
          </div>
        </div>

        <div style="break-before: ${isContinuous ? 'avoid' : 'page'}; page-break-before: ${isContinuous ? 'avoid' : 'always'};">
          <h2>الملاحق التفصيلية (Detailed Tables)</h2>
        
        <h3>أ- تفاصيل الأرباح (الطلبات الناجحة)</h3>
        <table>
          <colgroup>
            <col class="col-id">
            <col class="col-customer">
            <col class="col-products">
            <col class="col-num">
            <col class="col-num">
            <col class="col-num">
            <col class="col-num">
            <col class="col-num">
            <col class="col-num">
            <col class="col-profit">
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              <th>العميل</th>
              <th>المنتجات المباعة</th>
              <th>سعر البيع</th>
              <th>الشحن</th>
              <th>التكلفة</th>
              <th>تأمين</th>
              <th>معاينة</th>
              <th>COD</th>
              <th>صافي الربح</th>
            </tr>
          </thead>
          <tbody>
            ${collectedRows || '<tr><td colspan="10">لا توجد طلبات ناجحة.</td></tr>'}
            ${collectedOrders.length > 0 ? `
            <tr class="total-row">
              <td colspan="3">إجمالي الطلبات الناجحة (${collectedOrders.length})</td>
              <td>${(totalProductRevenue + totalExtraMarkup).toLocaleString()}</td>
              <td>${totalShippingRevenue.toLocaleString()}</td>
              <td>${totalCogs.toLocaleString()}</td>
              <td>${totalInsuranceFees.toLocaleString()}</td>
              <td>${totalInspectionFees.toLocaleString()}</td>
              <td>${totalCodFees.toLocaleString()}</td>
              <td style="color: #15803d;">${totalProfit.toLocaleString()}</td>
            </tr>` : ''}
          </tbody>
        </table>

        <h3>ب- تفاصيل الخسائر (الطلبات الفاشلة)</h3>
        <table>
          <colgroup>
            <col class="col-id">
            <col class="col-customer">
            <col class="col-products">
            <col class="col-status">
            <col class="col-num">
            <col class="col-num">
            <col class="col-num">
            <col class="col-num">
            <col class="col-profit">
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              <th>العميل</th>
              <th>المنتجات</th>
              <th>الحالة</th>
              <th>شحن ذهاب</th>
              <th>تأمين</th>
              <th>معاينة</th>
              <th>شحن مرتجع</th>
              <th>الخسارة</th>
            </tr>
          </thead>
          <tbody>
            ${failedRows || '<tr><td colspan="9">لا توجد طلبات فاشلة.</td></tr>'}
            ${failedOrders.length > 0 ? `
            <tr class="total-row">
              <td colspan="4">إجمالي الطلبات الفاشلة (${failedOrders.length})</td>
              <td>${totalFailedShipping.toLocaleString()}</td>
              <td>${totalFailedInsurance.toLocaleString()}</td>
              <td>${totalFailedInspection.toLocaleString()}</td>
              <td>${totalReturnFees.toLocaleString()}</td>
              <td style="color: #b91c1c;">-${totalLoss.toLocaleString()}</td>
            </tr>` : ''}
          </tbody>
        </table>

        <div style="break-before: ${isContinuous ? 'avoid' : 'page'}; page-break-before: ${isContinuous ? 'avoid' : 'always'};">
          <h3>ج- تحليل البيانات والنمو</h3>
        
        <h4>تحليل المناطق</h4>
        <table>
          <thead><tr><th>المنطقة</th><th>الطلبات</th><th>نسبة النجاح</th><th>الإيرادات</th><th>صافي الربح</th></tr></thead>
          <tbody>${geoRows}</tbody>
        </table>

        <h4>أداء شركات الشحن</h4>
        <table>
          <thead><tr><th>الشركة</th><th>الطلبات</th><th>نسبة النجاح</th><th>مصاريف الشحن</th><th>صافي الربح</th></tr></thead>
          <tbody>${carrierRows}</tbody>
        </table>

        <h4>ربحية المنتجات</h4>
        <table>
          <colgroup>
            <col style="width: 200px;">
            <col style="width: 80px;">
            <col style="width: 120px;">
            <col style="width: 100px;">
            <col style="width: 100px;">
            <col style="width: 100px;">
          </colgroup>
          <thead><tr><th>المنتج</th><th>المباع</th><th>المرتجع</th><th>المبيعات</th><th>الزيادة</th><th>صافي الربح</th></tr></thead>
          <tbody>${productRows}</tbody>
        </table>

        <h4>المصروفات الإدارية</h4>
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
          <table>
            <colgroup>
              <col style="width: 100px;">
              <col>
              <col style="width: 100px;">
            </colgroup>
            <thead><tr><th>التاريخ</th><th>البيان</th><th>المبلغ</th></tr></thead>
            <tbody>${expenseRows || '<tr><td colspan="3">لا توجد مصروفات إدارية.</td></tr>'}</tbody>
          </table>
          <table>
            <colgroup>
              <col>
              <col style="width: 100px;">
              <col style="width: 60px;">
            </colgroup>
            <thead><tr><th>التصنيف</th><th>المبلغ</th><th>النسبة</th></tr></thead>
            <tbody>${expenseCatRows || '<tr><td colspan="3">-</td></tr>'}</tbody>
          </table>
        </div>

        <div class="signature-section">
          <div class="signature-box">
            <p>توقيع المحاسب المسئول</p>
            <div class="signature-line"></div>
            <span>الاسم: ____________________</span>
          </div>
          <div class="signature-box">
            <p>اعتماد مدير المتجر</p>
            <div class="signature-line"></div>
            <span>الاسم: ____________________</span>
          </div>
        </div>

        <div style="text-align: center; margin-top: 40px; font-size: 9px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 10px;">
          هذا التقرير تم إنشاؤه آلياً بواسطة "مدير الأوردرات الذكي" &copy; ${new Date().getFullYear()}
        </div>
      </div>
      <script>
        window.onload = function() {
          if (${isContinuous}) {
            setTimeout(() => {
              const container = document.querySelector('.report-container');
              if (!container) { window.print(); return; }
              
              const height = container.scrollHeight;
              
              const div = document.createElement('div');
              div.style.height = '100mm';
              div.style.position = 'absolute';
              div.style.visibility = 'hidden';
              document.body.appendChild(div);
              const mmInPx = div.offsetHeight / 100;
              document.body.removeChild(div);
              
              const heightMm = Math.ceil(height / mmInPx) + 35; 
              const pageWidth = "${orientation}" === "landscape" ? "297mm" : "210mm";
              
              const style = document.createElement('style');
              style.innerHTML = "@page { size: " + pageWidth + " " + heightMm + "mm !important; margin: 0 !important; } " +
                                "body, html { margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; min-height: 0 !important; } " +
                                ".report-container { margin: 0 !important; padding: 40px !important; border: none !important; box-shadow: none !important; width: 100% !important; max-width: none !important; } " +
                                "* { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; break-inside: avoid-page !important; } " +
                                "table, tr, td, th { break-inside: auto !important; } " +
                                ".no-break { break-inside: avoid !important; }";
              document.head.appendChild(style);
              
              setTimeout(() => { window.print(); }, 1200);
            }, 500);
          } else {
            setTimeout(() => { window.print(); }, 800);
          }
        };
      </script>
    </body>
    </html>
    `;
};
