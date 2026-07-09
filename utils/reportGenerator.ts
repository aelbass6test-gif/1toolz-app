import { Order, Settings, Wallet, OrderItem, Treasury } from '../types';

const getPrintControlBarCSS = () => ``;

const normalizeName = (name: string): string => {
    if (!name) return name;
    let normalized = name.trim().replace(/\s+/g, ' ');
    normalized = normalized.replace(/\s*\((شريك|موظف|المدير|شريكه|partner|employee|admin)\)/gi, '');
    normalized = normalized.replace(/\s+(شريك|موظف|المدير|شريكه|partner|employee|admin)$/gi, '');
    normalized = normalized.trim();
    if (/^(زهره|زهرة)/.test(normalized)) {
        return 'زهره';
    }
    return normalized;
};

const getPrintControlBarHTML = (reportTitle: string) => ``;

export const generatePurchasesAndInventoryReportHTML = (stats: any, storeName: string, orientation: 'portrait' | 'landscape' = 'landscape', isContinuous: boolean = false, dateRangeText?: string, showInventoryValue: boolean = true): string => {
    return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير المشتريات والمخزون - ${storeName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet" crossorigin="anonymous">
      <style>
        @page { 
          size: ${isContinuous ? 'auto' : (orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait')}; 
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
               ${showInventoryValue ? `<div class="profit-card">
                    <p class="label">إجمالي قيمة المخزون الحالي</p>
                    <p class="amount">${stats.totalInventoryValue.toLocaleString('ar-EG')} ج.م</p>
               </div>` : ''}
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
                ${showInventoryValue ? `<th>قيمة المخزون</th>` : ''}
                <th>مرات الشراء</th>
                <th>تاريخ آخر شراء</th>
                <th style="max-width: 150px;">الموردين</th>
              </tr>
            </thead>
            <tbody>
              ${stats.productHistory.length === 0 ? `<tr><td colspan="${showInventoryValue ? 6 : 5}" style="text-align: center; padding: 20px; color: #94a3b8; font-weight: 600;">لا توجد منتجات مسجلة.</td></tr>` : stats.productHistory.map((p: any) => `
                <tr>
                  <td style="font-weight: 700; color: #1e293b;">${p.name}</td>
                  <td>${p.currentStock > 0 ? `<span class="pill positive">${p.currentStock}</span>` : `<span class="pill negative">نفذ</span>`}</td>
                  ${showInventoryValue ? `<td class="font-mono" style="font-weight: 800;">${p.stockValue.toLocaleString('ar-EG')}</td>` : ''}
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

import { calculateOrderProfitLoss, calculateCodFee, getLatestProductCost, isBosta, calculateInsuranceFee, calculateBostaVat, getStandardShippingFee, getAdvancePaymentCustodyName, resolveCashHolderName } from './financials';

export const generateInvoiceHTML = (order: Order, settings: Settings, storeName: string) => {
  const isPosOrder = order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر' || order.shippingArea === 'نقطة البيع' || (order.id && order.id.startsWith('POS-'));
  const compFees = settings?.companySpecificFees?.[order.shippingCompany];
  const useCustom = compFees?.useCustomFees ?? false;
  const inspectionFeeParams = !isPosOrder && (order.includeInspectionFee ?? true) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings?.enableInspection ? settings.inspectionFee : 0)) : 0;
  
  const computedTotal = (Number(order.productPrice) || 0) + (Number(order.shippingFee) || 0) - (Number(order.discount) || 0) - (Number(order.advancePayment) || 0) + inspectionFeeParams;
  let totalAmount = computedTotal;
  
  if (order.source === 'synced' && order.totalPrice != null) {
      totalAmount = Number(order.totalPrice) + inspectionFeeParams;
  } else if (order.totalAmountOverride !== undefined && order.totalAmountOverride !== null && String(order.totalAmountOverride).trim() !== '') {
      totalAmount = Number(order.totalAmountOverride);
  }
  
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
            <span>${inspectionFeeParams.toLocaleString()} ج.م</span>
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

export const generateOrdersReportHTML = (
  orders: Order[],
  settings: Settings,
  storeName: string,
  dateRangeText?: string,
  isContinuous: boolean = false,
  orientation: 'portrait' | 'landscape' = 'landscape'
): string => {
  let totalProfit = 0;
  let totalCollectedAmount = 0;
  let totalItems = 0;
  let sumProductPrice = 0;
  let sumProductCost = 0;
  let sumShippingCost = 0;
  let sumCollectionAmount = 0;
  let sumInvoiceTotal = 0;

  const tableRows = orders.map(order => {
    const isPosOrder = order.channel === 'pos' || order.shippingCompany?.startsWith('كاشير -') || order.shippingArea === 'نقطة البيع' || (order.id && order.id.startsWith('POS-'));
    const posName = order.shippingArea && order.shippingArea !== 'نقطة البيع' ? order.shippingArea : (order.shippingCompany?.replace("كاشير - ", "") || "نقطة البيع");
    const compFees = settings?.companySpecificFees?.[order.shippingCompany];
    const useCustom = compFees?.useCustomFees ?? false;
    const inspectionFeeParams = !isPosOrder && (order.includeInspectionFee ?? true) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings?.enableInspection ? settings.inspectionFee : 0)) : 0;
    
    const advancePaymentAmount = Number(order.advancePayment) || 0;
    const computedTotalBeforeAdvance = (Number(order.productPrice) || 0) + (Number(order.shippingFee) || 0) - (Number(order.discount) || 0) + inspectionFeeParams;
    const computedTotal = computedTotalBeforeAdvance - advancePaymentAmount;
    
    // totalAmountOverride is the user-provided "Amount to collect", which means the advance was already subtracted manually.
    const amountToCollect = order.totalAmountOverride != null ? Math.max(0, Math.round(Number(order.totalAmountOverride))) : computedTotal;
    
    const displayTotal = order.source === 'synced' && order.totalPrice != null ? Number(order.totalPrice) + inspectionFeeParams : amountToCollect;
    const invoiceTotal = order.source === 'synced' && order.totalPrice != null ? displayTotal + advancePaymentAmount : (order.totalAmountOverride != null ? Number(order.totalAmountOverride) + advancePaymentAmount : computedTotalBeforeAdvance);

    const { net, carrierFees, productCost } = calculateOrderProfitLoss(order, settings);
    
    // Calculate carrier fee breakdown for display
    const standardShippingFee = getStandardShippingFee(order, settings);
    const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
    const insuranceFee = (order.isInsured ?? true) ? calculateInsuranceFee(order, insuranceRate, settings) : 0;
    const inspectionExpense = (!isPosOrder && (order.includeInspectionFee !== false)) ? inspectionFeeParams : 0;
    const inspectionRevenue = (!isPosOrder && (order.includeInspectionFee !== false) && (order.inspectionFeePaidByCustomer !== false)) ? inspectionExpense : 0;
    const codFee = (order.status === 'مدفوعة' || isPosOrder) ? 0 : calculateCodFee(order, settings);
    const bostaVat = calculateBostaVat(order, insuranceFee, settings);

    const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
    
    const isFlexShipEnabled = isPosOrder ? false : (order.enableFlexShip !== undefined ? order.enableFlexShip : (useCustom ? (compFees?.enableFlexShip ?? false) : (settings.enableFlexShip ?? false)));
    const flexShipCompanyDeduction = (isFlexShipEnabled && order.flexShipFeePaidByCustomer) ? (order.flexShipCompanyFee ?? (useCustom ? (compFees?.flexShipCompanyFee ?? 0) : (settings.flexShipCompanyFee ?? 0))) : 0;

    totalProfit += net;
    totalCollectedAmount += displayTotal;
    totalItems += totalQuantity;
    sumProductPrice += Number(order.productPrice) || 0;
    sumProductCost += productCost;
    sumShippingCost += (carrierFees - inspectionRevenue - flexShipCompanyDeduction);
    sumCollectionAmount += (isPosOrder ? (order.totalAmountOverride || order.productPrice || displayTotal) : displayTotal);
    sumInvoiceTotal += invoiceTotal;

    const getStatusStyles = (status: string, type: 'status' | 'payment') => {
        const paymentIsPaid = ['مدفوع'].includes(status);
        const statusIsCollected = ['تم_التحصيل', 'مدفوعة'].includes(status);
        if ((type === 'payment' && paymentIsPaid) || (type === 'status' && statusIsCollected)) return 'background-color: #dcfce7; color: #166534; border: 1px solid #bbf7d0;'; // green
        
        const isFailure = ['مرتجع', 'فشل_التوصيل', 'ملغي', 'تمت_الاعادة_لشركة_الشحن'].includes(status);
        if (isFailure) return 'background-color: #fee2e2; color: #991b1b; border: 1px solid #fecaca;'; // red

        const inProgress = ['تم_توصيلها', 'تم_التوصيل', 'قيد_الشحن', 'تم_الارسال'].includes(status);
        if (inProgress) return 'background-color: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe;'; // blue
        
        return 'background-color: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;'; // slate
    }

    return `
      <tr>
        <td>
          <div class="font-bold text-gray-900">${order.customerName}</div>
          <div class="text-[9px] text-gray-500 mt-0.5 flex items-center gap-1">
            <span>#${order.id.slice(0, 8)}</span>
            ${isPosOrder ? `<span style="color: #6366f1; font-weight: 800;">[${posName}]</span>` : ''}
          </div>
        </td>
        <td>
          <div class="text-gray-900 leading-tight">${order.productName}</div>
          ${isPosOrder ? `
          <div style="margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px;">
            <span style="font-size: 8.5px; padding: 2px 8px; background: ${displayTotal === 0 ? '#f0fdf4' : '#fff7ed'}; color: ${displayTotal === 0 ? '#166534' : '#9a3412'}; border-radius: 20px; font-weight: 800; border: 1.5px solid ${displayTotal === 0 ? '#bbf7d0' : '#fde68a'}; display: inline-flex; align-items: center; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
              <span style="margin-left: 4px; opacity: 0.6;">👤</span>
              ${displayTotal === 0 ? (order.cashHolderId === 'wallet' ? 'جهة الإيداع' : 'جهة التحصيل') : 'العهدة'}: ${resolveCashHolderName(order, settings)}
            </span>
          </div>
          ` : ''}
        </td>
        <td class="text-center font-medium">
          <div>${order.productPrice.toLocaleString()}</div>
          ${order.discount > 0 ? `
          <div style="margin-top: 4px; font-size: 8.5px; color: #b91c1c; background: #fee2e2; border: 1px dashed #fecaca; padding: 1.5px 4px; border-radius: 4px; display: inline-block; font-weight: 800; white-space: nowrap;">
            خصم: ${order.discount.toLocaleString()} ج.م
          </div>
          ` : ''}
        </td>
        <td class="text-center text-gray-600">${productCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
        <td class="text-center">${totalQuantity}</td>
        <td class="text-center">
          <div class="font-bold text-gray-900">${(carrierFees - inspectionRevenue - flexShipCompanyDeduction).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>
          ${(!isPosOrder && order.includeInspectionFee !== false && inspectionExpense > 0) ? `
          <div class="badge mt-1 text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded border border-gray-200 inline-block">
            المعاينة: ${order.inspectionFeePaidByCustomer !== false ? 'على العميل' : 'على المتجر'}
          </div>
          ` : ''}
        </td>
        <td class="text-center">
          <div class="text-gray-900 font-bold">${(isPosOrder ? (order.totalAmountOverride || order.productPrice || displayTotal) : displayTotal).toLocaleString()}</div>
          ${advancePaymentAmount > 0 ? `
          <div class="mt-1 text-[10px] ${isPosOrder ? (displayTotal === 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-indigo-600 bg-indigo-50 border-indigo-200') : 'text-amber-600 bg-amber-50 border-amber-200'} font-bold px-1.5 py-0.5 rounded border inline-block whitespace-nowrap">
            ${isPosOrder ? (displayTotal === 0 ? 'ثمن المنتج (تحصيل نقدي)' : 'عربون مقدم (عهدة)') : 'عربون مدفوع'}: ${advancePaymentAmount.toLocaleString()}
          </div>
          ` : ''}
        </td>
        <td class="text-center font-bold text-gray-900">${invoiceTotal.toLocaleString()}</td>
        <td class="text-center"><span class="status-badge" style="${getStatusStyles(order.status, 'status')}">${order.status.replace(/_/g, ' ')}</span></td>
        <td class="text-center"><span class="status-badge" style="${getStatusStyles(order.paymentStatus, 'payment')}">${order.flexShipFeePaidByCustomer ? 'فليكس ✅' : order.paymentStatus}</span></td>
        <td class="text-center font-bold" style="color: ${net >= 0 ? '#15803d' : '#b91c1c'};" dir="ltr">${net > 0 ? '+' : ''}${net.toLocaleString()} ج.م</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير الطلبات - ${storeName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet" crossorigin="anonymous">
      <style>
    @page { size: ${isContinuous ? 'auto' : `A4 ${orientation}`}; margin: ${isContinuous ? '0' : '1cm'}; }
        * { box-sizing: border-box; }
        body { 
          font-family: 'Cairo', sans-serif; 
          font-size: 11px; 
          -webkit-print-color-adjust: exact; 
          color-adjust: exact; 
          background-color: ${isContinuous ? '#ffffff' : '#f8fafc'};
          color: #334155;
          margin: 0;
          padding: ${isContinuous ? '10px' : '20px'};
        }
        .report-container { 
          width: 100%; 
          max-width: ${isContinuous ? '100%' : (orientation === 'landscape' ? '297mm' : '210mm')};
          margin: 0 auto;
          background: white;
          border-radius: ${isContinuous ? '0' : '12px'};
          box-shadow: ${isContinuous ? 'none' : '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'};
          padding: ${isContinuous ? '15px' : '30px'};
        }
        .header-section {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 30px;
          border-bottom: 2px solid #f1f5f9;
          padding-bottom: 20px;
        }
        .header-title h1 { 
          margin: 0 0 8px 0; 
          color: #0f172a; 
          font-size: 24px; 
          font-weight: 800;
        }
        .header-title p { 
          margin: 0; 
          font-size: 13px; 
          color: #64748b; 
        }
        .header-meta {
          text-align: left;
          background: #f8fafc;
          padding: 12px 16px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }
        .header-meta p {
          margin: 0 0 4px 0;
          font-size: 12px;
          color: #475569;
        }
        .header-meta p:last-child { margin: 0; }
        
        .summary-cards {
          display: flex;
          gap: 16px;
          margin-bottom: 30px;
        }
        .card {
          flex: 1;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 16px;
          box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
          border-right: 4px solid #3b82f6;
        }
        .card.profit { border-right-color: #10b981; }
        .card.orders { border-right-color: #6366f1; }
        .card-title {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 8px;
          font-weight: 600;
        }
        .card-value {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
        }
        
        table { 
          width: 100%; 
          border-collapse: separate; 
          border-spacing: 0;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
        }
        th, td { 
          padding: 12px; 
          text-align: right; 
          border-bottom: 1px solid #e2e8f0;
        }
        th { 
          background-color: #f8fafc; 
          color: #475569; 
          font-size: 11px; 
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        td {
          background-color: #ffffff;
        }
        tbody tr:last-child td { border-bottom: none; }
        tbody tr:nth-child(even) td { background-color: #fcfcfd; }
        tbody tr:hover td { background-color: #f1f5f9; }
        
        .font-bold { font-weight: 700; }
        .font-medium { font-weight: 600; }
        .text-gray-900 { color: #0f172a; }
        .text-gray-600 { color: #475569; }
        .text-gray-500 { color: #64748b; }
        .text-xs { font-size: 10px; }
        .text-center { text-align: center; }
        .mt-1 { margin-top: 4px; }
        
        .status-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 9999px;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }
        ${getPrintControlBarCSS()}
        
        @media print {
          body { background: white; padding: 0; }
          .report-container { box-shadow: none; padding: 0; border: none; }
        }
      </style>
    </head>
    <body>
      ${getPrintControlBarHTML('تقرير الطلبات والمبيعات')}
      <div class="report-container">
        
        <div class="header-section">
          <div class="header-title">
            <h1>تقرير الطلبات والمبيعات</h1>
            <p>متجر "${storeName}"</p>
          </div>
          <div class="header-meta">
            ${dateRangeText ? `<p><strong>الفترة:</strong> ${dateRangeText}</p>` : ''}
            <p><strong>تاريخ التقرير:</strong> ${new Date().toLocaleString('ar-EG', { dateStyle: 'long', timeStyle: 'short' })}</p>
            <p><strong>إجمالي الطلبات بالتقرير:</strong> ${orders.length} طلب</p>
          </div>
        </div>
        
        <div class="summary-cards">
          <div class="card orders">
            <div class="card-title">إجمالي المنتجات</div>
            <div class="card-value">${totalItems} قطعة</div>
          </div>
          <div class="card">
            <div class="card-title">إجمالي المبالغ للتحصيل</div>
            <div class="card-value">${totalCollectedAmount.toLocaleString()} ج.م</div>
          </div>
          <div class="card profit">
            <div class="card-title">صافي الربح / الخسارة</div>
            <div class="card-value" style="color: ${totalProfit >= 0 ? '#10b981' : '#ef4444'}" dir="ltr">${totalProfit > 0 ? '+' : ''}${totalProfit.toLocaleString()} ج.م</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>العميل</th>
              <th>المنتج</th>
              <th class="text-center">سعر المنتج</th>
              <th class="text-center">تكلفة المنتج</th>
              <th class="text-center">كمية</th>
              <th class="text-center">تكلفة الشحن (المقدرة)</th>
              <th class="text-center">مبلغ التحصيل</th>
              <th class="text-center">إجمالي المبلغ</th>
              <th class="text-center">حالة الشحنة</th>
              <th class="text-center">حالة الدفع</th>
              <th class="text-center">صافي الربح</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            <tr class="total-row" style="background-color: #f1f5f9; font-weight: bold; border-top: 2px solid #cbd5e1;">
              <td colspan="2" class="text-right font-bold" style="background-color: #f1f5f9;">الإجمالي</td>
              <td class="text-center" style="background-color: #f1f5f9;">${sumProductPrice.toLocaleString()}</td>
              <td class="text-center" style="background-color: #f1f5f9;">${sumProductCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
              <td class="text-center" style="background-color: #f1f5f9;">${totalItems}</td>
              <td class="text-center font-bold" style="background-color: #f1f5f9;">${sumShippingCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
              <td class="text-center font-bold" style="background-color: #f1f5f9;">${sumCollectionAmount.toLocaleString()}</td>
              <td class="text-center font-bold" style="background-color: #f1f5f9;">${sumInvoiceTotal.toLocaleString()}</td>
              <td style="background-color: #f1f5f9;"></td>
              <td style="background-color: #f1f5f9;"></td>
              <td class="text-center font-bold" style="background-color: #f1f5f9; color: ${totalProfit >= 0 ? '#15803d' : '#b91c1c'};" dir="ltr">${totalProfit > 0 ? '+' : ''}${totalProfit.toLocaleString()} ج.م</td>
            </tr>
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

export const generateCollectionsReportHTML = (
  orders: Order[],
  settings: Settings,
  storeName: string,
  dateRangeText?: string,
  isContinuous: boolean = false,
  orientation: 'portrait' | 'landscape' = 'portrait'
): string => {
    let totalGross = 0;
    let totalNetProfit = 0;
    let totalCogs = 0;

    orders.forEach(o => {
      const compFees = settings.companySpecificFees?.[o.shippingCompany];
      const useCustom = compFees?.useCustomFees ?? false;
      const isPosOrder = o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر';
      const inspectionCost = !isPosOrder && (o.includeInspectionFee ?? true) ? (useCustom ? compFees!.inspectionFee : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
      
      const safeDiscount = o.discount || 0;
      const safeAdvance = o.advancePayment || 0;
      const defaultCollectionAmount = o.productPrice + o.shippingFee - safeDiscount - safeAdvance + (o.inspectionFeePaidByCustomer ? inspectionCost : 0);
      const collectionAmount = (o.totalAmountOverride ?? null) !== null ? o.totalAmountOverride! : defaultCollectionAmount;

      totalGross += collectionAmount;

      const { net } = calculateOrderProfitLoss(o, settings);
      totalNetProfit += net;
      totalCogs += o.productCost || 0;
    });

    const tableRows = orders.map(order => {
        const { net } = calculateOrderProfitLoss(order, settings);
        const compFees = settings.companySpecificFees?.[order.shippingCompany];
        const useCustom = compFees?.useCustomFees ?? false;
        const isPosOrder = order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر';
        const inspectionCost = !isPosOrder && (order.includeInspectionFee ?? true) ? (useCustom ? compFees!.inspectionFee : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
        
        const safeDiscount = order.discount || 0;
        const safeAdvance = order.advancePayment || 0;
        const defaultCollectionAmount = order.productPrice + order.shippingFee - safeDiscount - safeAdvance + (order.inspectionFeePaidByCustomer ? inspectionCost : 0);
        const collectionAmount = (order.totalAmountOverride ?? null) !== null ? order.totalAmountOverride! : defaultCollectionAmount;
        
        let amountDisplay = `${collectionAmount.toLocaleString()} ج.م`;
        if (collectionAmount !== defaultCollectionAmount) {
            amountDisplay = `
                <div style="font-weight: 800; color: #0f172a;">${collectionAmount.toLocaleString()} ج.م</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 4px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px; background: #f8fafc; text-align: right; display: inline-block;" dir="rtl">
                  <div>المطلوب: ${defaultCollectionAmount.toLocaleString()} ج.م</div>
                  <div style="font-weight: 700; color: #4f46e5;">الفعلي: ${collectionAmount.toLocaleString()} ج.م</div>
                </div>
            `;
        }

        return `
            <tr>
                <td class="text-center font-bold text-gray-900">${order.orderNumber || order.id.slice(0, 8)}</td>
                <td class="text-gray-900">${order.customerName}</td>
                <td class="text-center text-gray-500 font-mono">${new Date(order.date).toLocaleDateString('ar-EG')}</td>
                <td class="text-center">
                    ${isPosOrder ? `
                        <div style="font-size: 10px; font-weight: 800; color: #4f46e5;">${resolveCashHolderName(order, settings)}</div>
                        <div style="font-size: 8px; color: #64748b;">بعهدة شخصية</div>
                    ` : '<span style="color: #cbd5e1;">-</span>'}
                </td>
                <td class="text-right">${amountDisplay}</td>
                <td class="text-center text-gray-600">${order.productCost.toLocaleString()}</td>
                <td class="text-center font-bold" style="color: ${net >= 0 ? '#15803d' : '#b91c1c'};" dir="ltr">${net > 0 ? '+' : ''}${net.toLocaleString()} ج.m</td>
            </tr>
        `;
    }).join('');

    return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير التحصيلات - ${storeName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet" crossorigin="anonymous">
      <style>
    @page { size: ${isContinuous ? 'auto' : `A4 ${orientation}`}; margin: ${isContinuous ? '0' : '1cm'}; }
        * { box-sizing: border-box; }
        body { 
          font-family: 'Cairo', sans-serif; 
          font-size: 12px; 
          -webkit-print-color-adjust: exact; 
          color-adjust: exact; 
          background-color: ${isContinuous ? '#ffffff' : '#f8fafc'};
          color: #334155;
          margin: 0;
          padding: ${isContinuous ? '10px' : '20px'};
        }
        .report-container { 
          width: 100%; 
          max-width: ${isContinuous ? '100%' : (orientation === 'landscape' ? '297mm' : '210mm')};
          margin: 0 auto;
          background: white;
          border-radius: ${isContinuous ? '0' : '12px'};
          box-shadow: ${isContinuous ? 'none' : '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'};
          padding: ${isContinuous ? '15px' : '30px'};
        }
        .header-section {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 30px;
          border-bottom: 2px solid #f1f5f9;
          padding-bottom: 20px;
        }
        .header-title h1 { 
          margin: 0 0 8px 0; 
          color: #0f172a; 
          font-size: 24px; 
          font-weight: 800;
        }
        .header-title p { 
          margin: 0; 
          font-size: 13px; 
          color: #64748b; 
        }
        .header-meta {
          text-align: left;
          background: #f8fafc;
          padding: 12px 16px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }
        .header-meta p {
          margin: 0 0 4px 0;
          font-size: 12px;
          color: #475569;
        }
        .header-meta p:last-child { margin: 0; }
        
        .summary-cards {
          display: flex;
          gap: 16px;
          margin-bottom: 30px;
        }
        .card {
          flex: 1;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 16px;
          box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
          border-right: 4px solid #8b5cf6;
        }
        .card.profit { border-right-color: #10b981; }
        .card.orders { border-right-color: #6366f1; }
        .card-title {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 8px;
          font-weight: 600;
        }
        .card-value {
          font-size: 22px;
          font-weight: 800;
          color: #0f172a;
        }
        
        table { 
          width: 100%; 
          border-collapse: separate; 
          border-spacing: 0;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
        }
        th, td { 
          padding: 14px 12px; 
          text-align: right; 
          border-bottom: 1px solid #e2e8f0;
        }
        th { 
          background-color: #f8fafc; 
          color: #475569; 
          font-size: 12px; 
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        td {
          background-color: #ffffff;
        }
        tbody tr:last-child td { border-bottom: none; }
        tbody tr:nth-child(even) td { background-color: #fcfcfd; }
        tbody tr:hover td { background-color: #f1f5f9; }
        
        .font-bold { font-weight: 700; }
        .font-medium { font-weight: 600; }
        .text-gray-900 { color: #0f172a; }
        .text-gray-600 { color: #475569; }
        .text-gray-500 { color: #64748b; }
        .text-center { text-align: center; }
        
        ${getPrintControlBarCSS()}
        
        @media print {
          body { background: white; padding: 0; }
          .report-container { box-shadow: none; padding: 0; border: none; }
        }
      </style>
    </head>
    <body>
      ${getPrintControlBarHTML('تقرير التحصيلات')}
      <div class="report-container">
        
        <div class="header-section">
          <div class="header-title">
            <h1>تقرير التحصيلات والأرباح</h1>
            <p>متجر "${storeName}"</p>
          </div>
          <div class="header-meta">
            ${dateRangeText ? `<p><strong>الفترة:</strong> ${dateRangeText}</p>` : ''}
            <p><strong>تاريخ التقرير:</strong> ${new Date().toLocaleString('ar-EG', { dateStyle: 'long', timeStyle: 'short' })}</p>
          </div>
        </div>
        
        <div class="summary-cards">
          <div class="card orders">
            <div class="card-title">إجمالي الطلبات المحصلة</div>
            <div class="card-value">${orders.length} طلب</div>
          </div>
          <div class="card">
            <div class="card-title">إجمالي المبالغ للتحصيل</div>
            <div class="card-value" style="color: #059669;">${totalGross.toLocaleString()} ج.م</div>
          </div>
          <div class="card profit">
            <div class="card-title">صافي الأرباح للطلبات المحصلة</div>
            <div class="card-value" style="color: ${totalNetProfit >= 0 ? '#10b981' : '#ef4444'}" dir="ltr">${totalNetProfit > 0 ? '+' : ''}${totalNetProfit.toLocaleString()} ج.م</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="text-center">رقم الطلب</th>
              <th>العميل</th>
              <th class="text-center">التاريخ</th>
              <th class="text-center">جهة التحصيل (العهدة)</th>
              <th class="text-center">المبلغ المحصل</th>
              <th class="text-center">التكلفة</th>
              <th class="text-center">صافي الربح/الخسارة</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            <tr class="total-row" style="background-color: #f1f5f9; font-weight: bold; border-top: 2px solid #cbd5e1;">
              <td colspan="3" class="text-right font-bold" style="background-color: #f1f5f9;">الإجمالي</td>
              <td style="background-color: #f1f5f9;"></td>
              <td class="text-right font-bold" style="background-color: #f1f5f9;">${totalGross.toLocaleString()} ج.م</td>
              <td class="text-center font-bold" style="background-color: #f1f5f9;">${totalCogs.toLocaleString()}</td>
              <td class="text-center font-bold" style="background-color: #f1f5f9; color: ${totalNetProfit >= 0 ? '#15803d' : '#b91c1c'};" dir="ltr">${totalNetProfit > 0 ? '+' : ''}${totalNetProfit.toLocaleString()} ج.م</td>
            </tr>
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
          size: ${isContinuous ? 'auto' : (orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait')}; 
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
        const compFees = settings.companySpecificFees?.[order.shippingCompany];
        const useCustom = compFees?.useCustomFees ?? false;
        
        const isPosOrder = order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر';
        const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
        const inspectionCost = !isPosOrder && (order.includeInspectionFee ?? true) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
        
        const isInsured = order.isInsured ?? true;
        const insuranceFee = !isPosOrder && isInsured ? calculateInsuranceFee(order, insuranceRate) : 0;
        const bostaVat = !isPosOrder && isBosta(order.shippingCompany) ? calculateBostaVat(order, insuranceFee) : 0;
        
        const codFee = !isPosOrder ? calculateCodFee(order, settings) : 0;
        const { loss } = calculateOrderProfitLoss(order, settings);
        totalLoss += loss;
        totalProductPrice += order.productPrice;
        totalShippingFee += order.shippingFee;
        totalInsuranceInspection += (insuranceFee + inspectionCost + bostaVat);
        totalProductCost += order.productCost;

        const products = order.items.map(i => i.name).join(' + ') || order.productName;
        const quantities = order.items.map(i => i.quantity).join(' + ') || '1';
        const prices = order.items.map(i => i.price.toLocaleString()).join(' + ') || order.productPrice.toLocaleString();
        const discountHtml = order.discount > 0 ? `
          <div style="margin-top: 4px; font-size: 8px; color: #b91c1c; background: #fee2e2; border: 1px dashed #fecaca; padding: 1.5px 3px; border-radius: 4px; display: inline-block; font-weight: bold; white-space: nowrap;">
            خصم: ${order.discount.toLocaleString()} ج.م
          </div>
        ` : '';
        
        return `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px;">${order.customerName}</td>
                <td style="padding: 8px;">${products}</td>
                <td style="padding: 8px; text-align: center;">${quantities}</td>
                <td style="padding: 8px;">
                  <div>${prices}</div>
                  ${discountHtml}
                </td>
                <td style="padding: 8px;">${order.shippingFee.toLocaleString()}</td>
                <td style="padding: 8px;">${(insuranceFee + inspectionCost + bostaVat).toLocaleString()}</td>
                <td style="padding: 8px;">${order.productCost.toLocaleString()}</td>
                <td style="padding: 8px;">${order.status.replace(/_/g, ' ')}</td>
                <td style="padding: 8px;">${order.paymentStatus}</td>
                <td style="padding: 8px; font-weight: bold; color: #b91c1c;">
                    -${loss.toLocaleString()}
                    ${codFee > 0 ? `<br/><small style="color: #6b7280; font-weight: normal;">(تحصيل: ${codFee.toLocaleString()})</small>` : ''}
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
        @page { size: ${isContinuous ? 'auto' : `A4 ${orientation}`}; margin: ${isContinuous ? '0' : '1cm'}; }
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
    </body>
    </html>
    `;
};

export interface ComprehensiveReportSections {
    showSummary?: boolean;
    showIncomeStatement?: boolean;
    showOperational?: boolean;
    showProductProfitability?: boolean;
    showPartners?: boolean;
    showCustody?: boolean;
    showCollectionLog?: boolean;
    showLossLog?: boolean;
    showExpensesLog?: boolean;
    showInventoryLog?: boolean;
    showRecommendations?: boolean;
    showInventoryValue?: boolean;
    includeMarkupsInProductRevenue?: boolean;
    showExtraServicesRow?: boolean;
}

export const generateComprehensiveFinancialReportHTML = (orders: Order[], settings: Settings, wallet: Wallet, storeName: string, orientation: 'portrait' | 'landscape' = 'landscape', isContinuous: boolean = false, dateRangeText?: string, treasury?: Treasury, sections?: ComprehensiveReportSections): string => {
    const s = {
        showSummary: sections?.showSummary !== false,
        showIncomeStatement: sections?.showIncomeStatement !== false,
        showOperational: sections?.showOperational !== false,
        showProductProfitability: sections?.showProductProfitability !== false,
        showPartners: sections?.showPartners !== false,
        showCustody: sections?.showCustody !== false,
        showCollectionLog: sections?.showCollectionLog !== false,
        showLossLog: sections?.showLossLog !== false,
        showExpensesLog: sections?.showExpensesLog !== false,
        showInventoryLog: sections?.showInventoryLog !== false,
        showRecommendations: sections?.showRecommendations !== false,
        showInventoryValue: sections?.showInventoryValue !== false,
        includeMarkupsInProductRevenue: sections?.includeMarkupsInProductRevenue === true,
        showExtraServicesRow: sections?.showExtraServicesRow !== false,
    };
    const collectedOrders = (orders || []).filter(o => ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل'].includes(o.status));
    const failedOrders = (orders || []).filter(o => ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'تمت_الاعادة_لشركة_الشحن'].includes(o.status));
    const adminExpenses = (wallet?.transactions || []).filter(t => t.category?.startsWith('expense_') || t.category?.startsWith('supply_expense_'));
    const inventoryPurchases = (wallet?.transactions || []).filter(t => t.category === 'inventory_purchase');
    const totalInventoryPurchases = inventoryPurchases.reduce((sum, t) => sum + t.amount, 0);

    const totalInventoryValue = (settings?.products || []).reduce((sum, p) => {
        if (p.hasVariants && p.variants && p.variants.length > 0) {
            return sum + p.variants.reduce((vSum, v) => {
                const stock = v.stockQuantity ?? (v as any).stock ?? 0;
                const cost = getLatestProductCost(v.id, settings) || getLatestProductCost(p.id, settings) || (v.costPrice ?? p.costPrice ?? 0);
                return vSum + (stock * cost);
            }, 0);
        }
        const stock = p.stockQuantity ?? (p as any).stock ?? 0;
        const cost = getLatestProductCost(p.id, settings) || (p.costPrice || 0);
        return sum + (stock * cost);
    }, 0);

    let totalProductRevenue = 0;
    let totalProductExtraMarkup = 0;
    let totalExtraMarkup = 0;
    let totalSuccessShippingOnly = 0;
    let totalSuccessFeesOnly = 0;
    let totalShippingRevenue = 0;
    let totalActualShipping = 0;
    let totalShippingMarkup = 0;
    let totalCogs = 0;
    let totalInsuranceFees = 0;
    let totalInspectionFees = 0;
    let totalCodFees = 0;
    let totalProfit = 0;
    let totalPercentageProfit = 0;
    let totalCommissionProfit = 0;
    let totalOverrideAdjustment = 0;
    let totalInspectionRevenue = 0;
    let totalRequiredCollection = 0;
    let totalDiscount = 0;
    let sumCollectedProductPrice = 0;
    let sumCollectedShippingFee = 0;
    let sumCollectedTax = 0;

    const collectedRows = collectedOrders.map((order, idx) => {
        const { profit, netRevenue, carrierFees, productCost } = calculateOrderProfitLoss(order, settings);
        const codFee = calculateCodFee(order, settings);
        
        const compFees = settings.companySpecificFees?.[order.shippingCompany];
        const useCustom = compFees?.useCustomFees ?? false;
        const isPosOrder = order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر';
        
        const standardShipping = isPosOrder ? 0 : getStandardShippingFee(order, settings);
        const feesOnly = isPosOrder ? 0 : Math.max(0, carrierFees - standardShipping);
        
        totalSuccessShippingOnly += standardShipping;
        totalSuccessFeesOnly += feesOnly;
        
        const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
        const inspectionCost = !isPosOrder && (order.includeInspectionFee ?? true) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
        const isInsured = order.isInsured ?? true;
        const insuranceFee = !isPosOrder && isInsured ? calculateInsuranceFee(order, insuranceRate, settings) : 0;
        const inspectionAdjustment = (!isPosOrder && order.inspectionFeePaidByCustomer !== false) ? 0 : inspectionCost;
        const bostaVat = !isPosOrder ? calculateBostaVat(order, insuranceFee, settings) : 0;

        const safeProductPrice = Number(order.productPrice) || 0;
        const safeShippingFee = Number(order.shippingFee) || 0;
        const safeDiscount = Number(order.discount) || 0;
        const safeAdvance = Number(order.advancePayment) || 0;
        const safeTax = Number((order as any).tax) || 0;

        const totalCollected = order.totalAmountOverride !== undefined && order.totalAmountOverride !== null
            ? order.totalAmountOverride + safeAdvance
            : (safeProductPrice + safeShippingFee + safeTax - safeDiscount);

        const inspectionFeeCollected = (!isPosOrder && order.inspectionFeePaidByCustomer !== false) ? inspectionCost : 0;
        const baseExpected = safeProductPrice + safeShippingFee + safeTax - safeDiscount + inspectionFeeCollected;
        const overrideAdjustment = totalCollected - baseExpected;

        totalShippingRevenue += order.shippingFee;

        // Use the full carrierFees for accurate expense reporting
        totalActualShipping += isPosOrder ? 0 : carrierFees;

        const shippingMarkup = isPosOrder ? 0 : Math.max(0, order.shippingFee - standardShipping);
        totalShippingMarkup += shippingMarkup;

        let orderBaseRevenue = 0;
        let orderProductExtraMarkup = 0;

        order.items.forEach(item => {
            const product = settings.products.find(p => p.id === item.productId || p.variants?.some(v => v.id === item.productId));
            const variant = product?.variants?.find(v => v.id === item.productId);
            const actualCost = getLatestProductCost(item.productId, settings) || item.cost || 0;
            const itemProfit = (item.price - actualCost) * item.quantity;

            const catalogPrice = (product?.profitMode === 'commission' && product.basePrice !== undefined) ? product.basePrice :
                                 (product?.basePrice !== undefined && product.basePrice > 0) ? product.basePrice :
                                 ((variant && variant.price !== undefined) ? variant.price : ((product && product.price !== undefined) ? product.price : item.price));

            if (item.price > catalogPrice) {
                orderBaseRevenue += catalogPrice * item.quantity;
                orderProductExtraMarkup += (item.price - catalogPrice) * item.quantity;
            } else {
                orderBaseRevenue += item.price * item.quantity;
            }

            if (product?.profitMode === 'commission') {
                totalCommissionProfit += itemProfit;
            } else {
                totalPercentageProfit += itemProfit;
            }
        });

        const isMultiProfitOrder = orderProductExtraMarkup > 0;
        const rowStyle = isMultiProfitOrder ? 'background-color: #f0f9ff !important; border-right: 4px solid #0ea5e9;' : '';

        totalProductRevenue += orderBaseRevenue;
        totalDiscount += safeDiscount;
        sumCollectedProductPrice += safeProductPrice;
        sumCollectedShippingFee += order.shippingFee;
        sumCollectedTax += (bostaVat + safeTax);
        totalProductExtraMarkup += orderProductExtraMarkup;
        totalOverrideAdjustment += overrideAdjustment;
        totalInspectionRevenue += inspectionFeeCollected;
        totalRequiredCollection += netRevenue;
        totalExtraMarkup += (orderProductExtraMarkup + overrideAdjustment);
        
        totalCogs += (order.items || []).reduce((sum, item) => {
            const costVal = getLatestProductCost(item.productId, settings) || item.cost || 0;
            return sum + (costVal * item.quantity);
        }, 0);
        
        totalInsuranceFees += insuranceFee;
        totalInspectionFees += inspectionAdjustment;
        totalCodFees += codFee;
        totalProfit += profit;

        const productDetails = order.items.map(item => {
            const product = settings.products.find(p => p.id === item.productId || p.variants?.some(v => v.id === item.productId));
            const isMulti = product?.profitMode === 'commission' && product.basePrice !== undefined && item.price > product.basePrice;
            return `
                <div style="margin-bottom: 4px; line-height: 1.4;">
                    <strong>${item.name}</strong> (${item.quantity})
                    ${isMulti ? '<br/><span style="font-size: 8px; background: #0ea5e9; color: white; padding: 1px 4px; border-radius: 4px; display: inline-block; margin-top: 2px;">ربح مركب (أساسي + زيادة)</span>' : ''}
                </div>
            `;
        }).join('');
        
        const taxDisplay = (bostaVat + safeTax) > 0 ? (bostaVat + safeTax).toLocaleString() : '-';

        return `
            <tr style="${rowStyle}">
                <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
                <td>
                  <div style="font-weight: bold; color: #0f172a;">${order.customerName}</div>
                  <div style="font-size: 9px; color: #64748b;">م: ${order.orderNumber}</div>
                  ${isPosOrder ? `
                  <div style="margin-top: 2px; font-size: 8px; background: #f0fdf4; color: #166534; padding: 1px 4px; border-radius: 4px; border: 1px solid #bbf7d0; display: inline-block;">
                    نقطة بيع (POS) - عهدة: ${resolveCashHolderName(order, settings)}
                  </div>` : ''}
                  ${safeAdvance > 0 ? `
                  <div style="margin-top: 4px; font-size: 9px; font-weight: bold; color: #d97706; background-color: #fffbeb; border: 1px solid #fde68a; padding: 2px 6px; border-radius: 4px; display: inline-block;">
                    عربون مدفوع: ${safeAdvance.toLocaleString()}
                  </div>` : ''}
                </td>
                <td class="col-products">${productDetails}</td>
                <td>
                  <div>${order.productPrice.toLocaleString()}</div>
                  ${order.discount > 0 ? `
                  <div style="margin-top: 4px; font-size: 8.5px; color: #b91c1c; background: #fee2e2; border: 1px dashed #fecaca; padding: 1.5px 4px; border-radius: 4px; display: inline-block; font-weight: bold; white-space: nowrap;">
                    خصم: ${order.discount.toLocaleString()} ج.م
                  </div>
                  ` : ''}
                </td>
                <td>${order.shippingFee.toLocaleString()}</td>
                <td>${taxDisplay}</td>
                <td>${productCost.toLocaleString()}</td>
                <td>${insuranceFee.toLocaleString()}</td>
                <td>${inspectionAdjustment.toLocaleString()}</td>
                <td>${codFee.toLocaleString()}</td>
                <td style="color: #15803d; font-weight: bold;">${profit.toLocaleString()}</td>
            </tr>`;
    }).join('');

    let totalFailedShipping = 0;
    let totalFailedInsurance = 0;
    let totalFailedInspection = 0;
    let totalReturnFees = 0;
    let totalLoss = 0;

    const failedRows = failedOrders.map((order, idx) => {
        const { loss } = calculateOrderProfitLoss(order, settings);
        
        const compFees = settings.companySpecificFees?.[order.shippingCompany];
        const useCustom = compFees?.useCustomFees ?? false;
        const isPosOrder = order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر';
        const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
        const inspectionCost = !isPosOrder && (order.includeInspectionFee ?? true) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
        const isInsured = order.isInsured ?? true;
        const insuranceFee = !isPosOrder && isInsured ? calculateInsuranceFee(order, insuranceRate, settings) : 0;
        
        const applyReturnFee = !isPosOrder && (useCustom ? (compFees?.enableFixedReturn ?? false) : settings.enableReturnShipping);
        const returnFeeAmount = applyReturnFee ? (useCustom ? (compFees?.returnShippingFee ?? 0) : settings.returnShippingFee) : 0;
        const inspectionFeeCollected = 0;

        totalFailedShipping += order.shippingFee;
        totalFailedInsurance += insuranceFee;
        totalFailedInspection += inspectionCost;
        totalReturnFees += returnFeeAmount;
        totalLoss += loss;

        const productDetails = order.items.map(item => `<div style="margin-bottom: 4px; line-height: 1.4;"><strong>${item.name}</strong> (${item.quantity})</div>`).join('');
        return `
            <tr>
                <td>${idx + 1}</td>
                <td>
                  <div style="font-weight: bold; color: #0f172a;">${order.customerName}</div>
                  <div style="font-size: 9px; color: #64748b;">م: ${order.orderNumber}</div>
                </td>
                <td class="col-products">${productDetails}</td>
                <td>${order.status.replace(/_/g, ' ')}</td>
                <td>${order.shippingFee.toLocaleString()}</td>
                <td>${insuranceFee.toLocaleString()}</td>
                <td>${(inspectionCost - inspectionFeeCollected).toLocaleString()}</td>
                <td>${returnFeeAmount.toLocaleString()}</td>
                <td style="color: #b91c1c; font-weight: bold;">${loss.toLocaleString()}</td>
            </tr>`;
    }).join('');

    let totalExpenses = 0;
    const expenseRows = adminExpenses.map(t => {
        totalExpenses += t.amount;
        return `<tr><td>${new Date(t.date).toLocaleDateString('ar-EG')}</td><td>${t.note}</td><td style="color: #b91c1c;">${t.amount.toLocaleString()}</td></tr>`;
    }).join('');

    const extraPosSales = (settings?.posSales || []).filter(s => !orders.some(o => o.id === s.id || o.orderNumber === s.saleNumber));
    let extraPosProfit = 0;
    let extraPosRevenue = 0;
    let extraPosCOGS = 0;
    extraPosSales.forEach(s => {
        (s.items || []).forEach(item => {
            const cost = getLatestProductCost(item.productId, settings) || item.cost || 0;
            extraPosCOGS += (cost * (item.quantity || 1));
            extraPosRevenue += (item.price * (item.quantity || 1));
            const itemProfit = (item.price - cost) * (item.quantity || 1);
            extraPosProfit += itemProfit;
            totalPercentageProfit += itemProfit;
        });
    });

    totalProductRevenue += extraPosRevenue;
    totalCogs += extraPosCOGS;
    totalProfit += extraPosProfit;

    let finalNet = totalProfit - totalLoss - totalExpenses;
    const successRate = orders.length > 0 ? (collectedOrders.length / orders.length) * 100 : 0;
    const avgOrderProfit = collectedOrders.length > 0 ? totalProfit / collectedOrders.length : 0;
    const breakEvenOrders = avgOrderProfit > 0 ? Math.ceil(totalExpenses / avgOrderProfit) : 0;

    // Carrier Performance
    const carrierStats: Record<string, { count: number, success: number, shipping: number, profit: number }> = {};
    orders.filter(o => ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل', 'مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'تمت_الاعادة_لشركة_الشحن'].includes(o.status)).forEach(o => {
        const name = o.shippingCompany || 'غير محدد';
        if (!carrierStats[name]) carrierStats[name] = { count: 0, success: 0, shipping: 0, profit: 0 };
        carrierStats[name].count++;
        if (['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل'].includes(o.status)) carrierStats[name].success++;
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
            if (['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل'].includes(o.status)) {
                const product = settings.products.find(p => p.id === item.productId || p.variants?.some(v => v.id === item.productId));
                if (product?.profitMode === 'commission' && product.basePrice !== undefined) {
                    productStats[item.name].revenue += product.basePrice * item.quantity;
                    productStats[item.name].extra += (item.price - product.basePrice) * item.quantity;
                } else {
                    productStats[item.name].revenue += item.price * item.quantity;
                }
                productStats[item.name].cost += (getLatestProductCost(item.productId, settings) || item.cost || 0) * item.quantity;
                productStats[item.name].sold += item.quantity;
            } else if (['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'تمت_الاعادة_لشركة_الشحن'].includes(o.status)) {
                productStats[item.name].returns += item.quantity;
            }
        });
    });

    const productRows = Object.entries(productStats)
        .sort((a, b) => ((b[1].revenue - b[1].cost) + b[1].extra) - ((a[1].revenue - a[1].cost) + a[1].extra))
        .map(([name, stats]) => {
            const totalProfit = (stats.revenue - stats.cost) + stats.extra;
            return `<tr><td>${name}</td><td>${stats.sold}</td><td>${stats.returns}</td><td style="font-weight: bold; color: #15803d;">${totalProfit.toLocaleString()}</td></tr>`;
        }).join('');

    // Geographic Analysis
    const geoStats: Record<string, { count: number, success: number, revenue: number, net: number }> = {};
    orders.forEach(o => {
        const area = o.governorate || o.shippingArea || 'غير محدد';
        if (!geoStats[area]) geoStats[area] = { count: 0, success: 0, revenue: 0, net: 0 };
        geoStats[area].count++;
        const { net } = calculateOrderProfitLoss(o, settings);
        if (['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل'].includes(o.status)) {
            geoStats[area].success++;
            geoStats[area].revenue += (o.productPrice + o.shippingFee);
        }
        geoStats[area].net += net;
    });

    const geoRows = Object.entries(geoStats)
        .sort((a, b) => b[1].net - a[1].net)
        .map(([name, s]) => `<tr><td>${name}</td><td>${s.count}</td><td>${((s.success/s.count)*100).toFixed(1)}%</td><td style="font-weight: bold; color: ${s.net >= 0 ? '#15803d' : '#b91c1c'};">${s.net.toLocaleString()}</td></tr>`).join('');

    const partners = settings.partners || [];
    const employees = settings.employees || [];
    const treasuryCustody = (treasury?.accounts || []).filter(a => a.type === 'custody').map(a => ({ name: a.name, balance: a.balance }));
    
    const mergedHolders: Record<string, { displayName: string, balance: number }> = {};
    (settings.cashHolders || []).filter(h => h.currentBalance && h.currentBalance > 0).forEach(h => {
        const nName = normalizeName(h.userName);
        const isPartner = partners.some(p => normalizeName(p.name) === nName || h.userId === p.id || h.userId === `part_${p.id}` || h.userId === `partner_${p.id}`);
        const isEmp = employees.some(e => normalizeName(e.name) === nName || h.userId === e.id || h.userId === `emp_${e.id}` || h.userId === `employee_${e.id}`);
        const dispName = (h.userId === 'admin' || nName === 'المدير' || nName === 'المدير (أنت)') ? 'المدير (أنت)' : isPartner ? `${nName} (شريك)` : isEmp ? `${nName} (موظف)` : nName;
        
        if (!mergedHolders[nName]) {
            mergedHolders[nName] = { displayName: dispName, balance: 0 };
        }
        mergedHolders[nName].balance += (h.currentBalance || 0);
    });
    
    const custodyAccounts = [...treasuryCustody, ...Object.values(mergedHolders).map(val => ({ name: val.displayName, balance: val.balance }))];

    // Collect advance payments AND POS collections that contribute to custody
    const custodyDetails: Record<string, Array<{ customerName: string, orderNumber: string, amount: number, type: string }>> = {};
    orders.forEach(o => {
        const advance = Number(o.advancePayment) || 0;
        const isPosOrder = o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر';
        
        // For POS orders, the full amount (price + shipping + tax - discount) is collected in custody
        // unless it's a failed order, but we usually report collected POS orders here.
        const isCollectedPos = isPosOrder && ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل'].includes(o.status);
        
                if (advance > 0 || isCollectedPos) {
                    const holderLabel = getAdvancePaymentCustodyName(o, settings, treasury);
                    let matchName = "";
                    
                    if (holderLabel.includes(': ')) {
                        const parts = holderLabel.split(': ')[1].split(' (');
                        matchName = normalizeName(parts[0].trim());
                    } else if (holderLabel.includes('👤 عهدة المدير')) {
                        matchName = "المدير"; 
                    }

                    if (matchName) {
                        const account = custodyAccounts.find(a => normalizeName(a.name) === matchName || a.name.includes(matchName) || matchName.includes(a.name) || normalizeName(a.name).includes(matchName));
                        const targetName = account ? account.name : matchName;
                        
                        const amountToReport = isCollectedPos ? ((Number(o.productPrice) || 0) + (Number(o.shippingFee) || 0) + (Number((o as any).tax) || 0) - (Number(o.discount) || 0)) : advance;

                        if (!custodyDetails[targetName]) custodyDetails[targetName] = [];
                        custodyDetails[targetName].push({
                            customerName: o.customerName || 'عميل مجهول',
                            orderNumber: o.orderNumber || o.id || '---',
                            amount: amountToReport,
                            type: isCollectedPos ? 'مبيعات POS' : 'عربون'
                        });
                    }
                }
    });

    const recommendations = [];
    if (successRate < 70) recommendations.push(`⚠️ نسبة النجاح منخفضة (${successRate.toFixed(1)}%). ننصح بمراجعة جودة تأكيد الأوردرات.`);
    if (avgOrderProfit < 50) recommendations.push(`💡 متوسط الربح للطلب ضعيف. قد تحتاج لرفع أسعار المنتجات أو تقليل تكاليف الشحن.`);

    let sectionCounter = s.showSummary ? 3 : 1;

    let displayProductRevenue = s.includeMarkupsInProductRevenue ? (totalProductRevenue + totalProductExtraMarkup) : totalProductRevenue;
    let displayExtraMarkup = s.includeMarkupsInProductRevenue ? (totalExtraMarkup - totalProductExtraMarkup + totalInspectionRevenue) : (totalExtraMarkup + totalInspectionRevenue);

    if (!s.showExtraServicesRow) {
        finalNet -= displayExtraMarkup;
        totalProfit -= displayExtraMarkup;
        totalRequiredCollection -= displayExtraMarkup;
        displayExtraMarkup = 0;
    }
    const displayProductGrossProfit = displayProductRevenue - totalDiscount - totalCogs;

    const summaryHtml = s.showSummary ? `
            <div class="stats-grid">
                <div class="stat-card"><span class="label">إجمالي المطلوب تحصيله</span><span class="value">${totalRequiredCollection.toLocaleString()}</span></div>
                <div class="stat-card"><span class="label">إجمالي مبيعات المنتجات</span><span class="value">${displayProductRevenue.toLocaleString()}</span></div>
                <div class="stat-card"><span class="label">إجمالي المشتريات</span><span class="value" style="color: var(--danger);">${totalInventoryPurchases.toLocaleString()}</span></div>
                <div class="stat-card"><span class="label">نسبة نجاح التوصيل</span><span class="value" style="color: var(--success);">${successRate.toFixed(1)}%</span></div>
                <div class="stat-card" style="background: var(--primary-soft); border-color: var(--primary);"><span class="label" style="color: var(--primary);">صافي الربح النهائي</span><span class="value" style="color: var(--primary);">${finalNet.toLocaleString()}</span></div>
            </div>

            <div class="stage-banner">
                <div class="stage-number">1</div>
                <h3 class="stage-title">المرحلة الأولى: تحليل الإيرادات (Revenues)</h3>
            </div>
            <table class="modern-table">
                <thead><tr><th style="text-align: right;">بند الإيرادات</th><th>المبلغ المحصل</th></tr></thead>
                <tbody>
                    <tr><td style="text-align: right;">مبيعات المنتجات (${s.includeMarkupsInProductRevenue ? 'شاملة تعلية السعر والزيادات' : 'بالسعر الأساسي'})</td><td style="color: var(--success);">+${displayProductRevenue.toLocaleString()} ج.م</td></tr>
                    ${totalDiscount > 0 ? `<tr><td style="text-align: right;">(-) الخصومات الممنوحة للعملاء</td><td style="color: var(--danger);">-${totalDiscount.toLocaleString()} ج.م</td></tr>` : ''}
                    ${s.showExtraServicesRow ? `<tr><td style="text-align: right;">إيرادات الخدمات الإضافية ${s.includeMarkupsInProductRevenue ? 'والمعاينة والتسويات' : 'وتعلية السعر والمعاينة والتسويات'}</td><td style="color: var(--success);">+${displayExtraMarkup.toLocaleString()} ج.م</td></tr>` : ''}
                    <tr><td style="text-align: right;">إجمالي تحصيل الشحن من العملاء</td><td style="color: var(--success);">+${totalShippingRevenue.toLocaleString()} ج.م</td></tr>
                    <tr class="total-row"><td style="text-align: right;">إجمالي التدفقات النقدية الداخلة</td><td>${(displayProductRevenue - totalDiscount + displayExtraMarkup + totalShippingRevenue).toLocaleString()} ج.م</td></tr>
                </tbody>
            </table>

            <div class="stage-banner" style="border-right-color: var(--danger);">
                <div class="stage-number" style="background: var(--danger);">2</div>
                <h3 class="stage-title">المرحلة الثانية: التكاليف والمصروفات التشغيلية (Operating Costs & Expenses)</h3>
            </div>
            <table class="modern-table">
                <thead><tr><th style="text-align: right;">بند التكاليف</th><th>المبلغ</th></tr></thead>
                <tbody>
                    <tr><td style="text-align: right;">رسوم تشغيل (تأمين + معاينة + COD) للناجح</td><td style="color: var(--danger);">${totalSuccessFeesOnly.toLocaleString()} ج.م</td></tr>
                    <tr><td style="text-align: right;">خسائر المرتجعات وفشل التوصيل</td><td style="color: var(--danger);">${totalLoss.toLocaleString()} ج.م</td></tr>
                    <tr><td style="text-align: right;">المصروفات الإدارية (إعلانات، رواتب، إيجار)</td><td style="color: var(--danger);">${totalExpenses.toLocaleString()} ج.م</td></tr>
                    <tr class="total-row"><td style="text-align: right;">إجمالي التكاليف والمصروفات التشغيلية</td><td style="color: var(--danger); font-weight: bold;">${(totalSuccessFeesOnly + totalLoss + totalExpenses).toLocaleString()} ج.م</td></tr>
                </tbody>
            </table>

            <div class="final-banner">
                <div style="font-size: 24px; opacity: 0.8; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">صافي الربح النهائي</div>
                <div class="amount">${finalNet.toLocaleString()} ج.م</div>
                <p style="opacity: 0.7; font-size: 18px;">نقطة التعادل: تحتاج إلى ${breakEvenOrders} طلب ناجح إضافي لتغطية المصروفات الثابتة.</p>
            </div>` : '';

    const incomeStatementHtml = s.showIncomeStatement ? `
            <h2 class="section-header">${sectionCounter++}. قائمة الدخل الموحدة (Statement of Income)</h2>
            <table class="modern-table" style="background: var(--slate-50);">
                <thead>
                    <tr><th style="text-align: right;">البند المالي</th><th>القيمة (ج.م)</th></tr>
                </thead>
                <tbody>
                    <tr><td style="text-align: right; font-weight: bold;">(+) إجمالي مبيعات المنتجات والخدمات</td><td>${displayProductRevenue.toLocaleString()}</td></tr>
                    ${totalDiscount > 0 ? `<tr><td style="text-align: right;">(-) الخصومات الممنوحة للعملاء</td><td style="color: var(--danger);">-${totalDiscount.toLocaleString()}</td></tr>` : ''}
                    <tr><td style="text-align: right;">(-) تكلفة البضاعة المباعة (COGS)</td><td style="color: var(--danger);">-${totalCogs.toLocaleString()}</td></tr>
                    <tr class="total-row"><td style="text-align: right;">(=) مجمل ربح المنتجات (Product Gross Profit)</td><td>${displayProductGrossProfit.toLocaleString()}</td></tr>
                    ${s.showExtraServicesRow ? `<tr><td style="text-align: right;">(+) أرباح الخدمات والإضافات (${s.includeMarkupsInProductRevenue ? 'معاينة / تعديل يدوي' : 'زيادة سعر / معاينة / تعديل يدوي'})</td><td style="color: var(--success);">+${displayExtraMarkup.toLocaleString()}</td></tr>` : ''}
                    <tr><td style="text-align: right;">(+) أرباح زيادة الشحن (Shipping Markup)</td><td style="color: var(--success);">+${(totalShippingRevenue - totalSuccessShippingOnly).toLocaleString()}</td></tr>
                    <tr><td style="text-align: right;">(-) رسوم تشغيل الطلبات الناجحة (تأمين/معاينة/تحصيل)</td><td style="color: var(--danger);">-${totalSuccessFeesOnly.toLocaleString()}</td></tr>
                    <tr><td style="text-align: right;">(-) خسائر المرتجعات وفشل التوصيل</td><td style="color: var(--danger);">-${totalLoss.toLocaleString()}</td></tr>
                    <tr><td style="text-align: right;">(-) المصروفات الإدارية والتشغيلية</td><td style="color: var(--danger);">-${totalExpenses.toLocaleString()}</td></tr>
                    <tr class="total-row" style="background: var(--primary) !important; color: white !important;">
                        <td style="text-align: right;">(=) صافي الربح النهائي (Net Profit)</td>
                        <td>${finalNet.toLocaleString()}</td>
                    </tr>
                </tbody>
            </table>` : '';

    const operationalHtml = s.showOperational ? `
            <h2 class="section-header">${sectionCounter++}. الأداء التشغيلي (Operational Performance)</h2>
            <div class="grid-2">
                <div>
                    <h4 style="margin-bottom: 15px; color: var(--slate-700);">أداء شركات الشحن</h4>
                    <table class="modern-table">
                        <thead><tr><th>الشركة</th><th>الطلبات</th><th>النجاح</th><th>الشحن</th><th>الصافي</th></tr></thead>
                        <tbody>${carrierRows}</tbody>
                    </table>
                </div>
                <div>
                    <h4 style="margin-bottom: 15px; color: var(--slate-700);">التحليل الجغرافي</h4>
                    <table class="modern-table">
                        <thead><tr><th>المنطقة</th><th>الطلبات</th><th>النجاح</th><th>الصافي</th></tr></thead>
                        <tbody>${geoRows}</tbody>
                    </table>
                </div>
            </div>` : '';

    const productProfitabilityHtml = s.showProductProfitability ? `
            <h2 class="section-header">${sectionCounter++}. ربحية المنتجات (Product Profitability)</h2>
            <table class="modern-table">
                <thead><tr><th style="text-align: right;">اسم المنتج</th><th>المباع</th><th>المرتجع</th><th>إجمالي الربح</th></tr></thead>
                <tbody>${productRows}</tbody>
            </table>` : '';

    const collectionLogHtml = s.showCollectionLog ? `
            <h2 class="section-header">${sectionCounter++}. سجل التحصيل المالي (Collection Log)</h2>
            <table class="modern-table">
                <thead><tr><th>#</th><th style="text-align: right;">العميل</th><th>المنتجات</th><th>السعر</th><th>الشحن</th><th>ضريبة</th><th>التكلفة</th><th>تأمين</th><th>معاينة</th><th>COD</th><th>الصافي</th></tr></thead>
                <tbody>
                    ${collectedRows}
                    <tr class="total-row" style="background-color: #f1f5f9; font-weight: bold; border-top: 2px solid #cbd5e1;">
                        <td style="text-align: center; font-weight: bold; background-color: #f1f5f9;">-</td>
                        <td colspan="2" style="text-align: right; font-weight: bold; background-color: #f1f5f9;">الإجمالي</td>
                        <td style="background-color: #f1f5f9;">${sumCollectedProductPrice.toLocaleString()}</td>
                        <td style="background-color: #f1f5f9;">${sumCollectedShippingFee.toLocaleString()}</td>
                        <td style="background-color: #f1f5f9;">${sumCollectedTax.toLocaleString()}</td>
                        <td style="background-color: #f1f5f9;">${totalCogs.toLocaleString()}</td>
                        <td style="background-color: #f1f5f9;">${totalInsuranceFees.toLocaleString()}</td>
                        <td style="background-color: #f1f5f9;">${totalInspectionFees.toLocaleString()}</td>
                        <td style="background-color: #f1f5f9;">${totalCodFees.toLocaleString()}</td>
                        <td style="color: #15803d; font-weight: bold; background-color: #f1f5f9;">${totalProfit.toLocaleString()}</td>
                    </tr>
                </tbody>
            </table>` : '';

    const lossLogHtml = (failedRows && s.showLossLog) ? `
            <h2 class="section-header" style="color: var(--danger);">${sectionCounter++}. سجل المرتجعات والخسائر (Loss Log)</h2>
            <table class="modern-table">
                <thead><tr><th>#</th><th style="text-align: right;">العميل</th><th>المنتجات</th><th>الحالة</th><th>شحن</th><th>تأمين</th><th>معاينة</th><th>مرتجع</th><th>الخسارة</th></tr></thead>
                <tbody>
                    ${failedRows}
                    <tr class="total-row" style="background-color: #fee2e2; font-weight: bold; border-top: 2px solid #fca5a5;">
                        <td style="text-align: center; font-weight: bold; background-color: #fee2e2;">-</td>
                        <td colspan="2" style="text-align: right; font-weight: bold; background-color: #fee2e2;">الإجمالي</td>
                        <td style="background-color: #fee2e2;">-</td>
                        <td style="background-color: #fee2e2;">${totalFailedShipping.toLocaleString()}</td>
                        <td style="background-color: #fee2e2;">${totalFailedInsurance.toLocaleString()}</td>
                        <td style="background-color: #fee2e2;">${totalFailedInspection.toLocaleString()}</td>
                        <td style="background-color: #fee2e2;">${totalReturnFees.toLocaleString()}</td>
                        <td style="color: #b91c1c; font-weight: bold; background-color: #fee2e2;">${totalLoss.toLocaleString()}</td>
                    </tr>
                </tbody>
            </table>` : '';

    const expensesLogHtml = s.showExpensesLog ? `
            <h2 class="section-header">${sectionCounter++}. المصروفات الإدارية والتشغيلية (Expenses Log)</h2>
            <table class="modern-table">
                <thead><tr><th>التاريخ</th><th style="text-align: right;">البيان</th><th>المبلغ</th></tr></thead>
                <tbody>
                    ${expenseRows || '<tr><td colspan="3">لا توجد مصروفات إدارية خلال هذه الفترة.</td></tr>'}
                    <tr class="total-row"><td colspan="2" style="text-align: right;">إجمالي المصروفات</td><td>${totalExpenses.toLocaleString()} ج.م</td></tr>
                </tbody>
            </table>` : '';

    const inventoryLogHtml = s.showInventoryLog ? `
            <h2 class="section-header">${sectionCounter++}. حركة المخزون والمشتريات (Inventory & Purchases)</h2>
            <table class="modern-table">
                <thead><tr><th style="text-align: right;">البند</th><th>المبلغ (ج.م)</th></tr></thead>
                <tbody>
                    <tr><td style="text-align: right;">إجمالي قيمة مشتريات المخزون (خلال الفترة)</td><td>${totalInventoryPurchases.toLocaleString()}</td></tr>
                    <tr><td style="text-align: right;">تكلفة البضاعة المباعة (المسحوبة من المخزون)</td><td>${totalCogs.toLocaleString()}</td></tr>
                    ${s.showInventoryValue ? `<tr><td style="text-align: right; font-weight: bold; color: var(--primary);">قيمة البضاعة المتاحة في المخزن (رأس المال الحالي)</td><td style="font-weight: bold; color: var(--primary);">${totalInventoryValue.toLocaleString()}</td></tr>` : ''}
                    <tr class="total-row"><td style="text-align: right;">التدفق النقدي للمخزون</td><td style="color: ${totalInventoryPurchases > totalCogs ? 'var(--danger)' : 'var(--success)'};">${(totalCogs - totalInventoryPurchases).toLocaleString()}</td></tr>
                </tbody>
            </table>` : '';

    const partnerDetailsHtml = (partners.length > 0 && s.showPartners) ? `
        <div style="margin-top: 25px; page-break-inside: avoid;">
            <h3 style="background: #1e3a8a; color: white; padding: 10px; border-radius: 6px; font-size: 16px; margin-bottom: 10px;">${sectionCounter++}. توزيع أرباح الشركاء والمراكز المالية</h3>
            <table class="modern-table">
                <thead><tr><th>اسم الشريك</th><th>نسبة الربح (%)</th><th>نصيب الربح</th><th>المسحوبات</th><th>الرصيد المتاح</th></tr></thead>
                <tbody>
                    ${partners.map(p => {
                        const partnerShare = (p.profitRatio / 100) * finalNet;
                        const partnerTxs = settings.partnerTransactions?.filter(t => t.partnerId === p.id) || [];
                        const totalWithdrawals = partnerTxs.filter(t => ['profit_withdrawal', 'loan', 'profit_distribution'].includes(t.type)).reduce((sum, t) => sum + t.amount, 0);
                        return `<tr><td>${p.name}</td><td>${p.profitRatio}%</td><td style="font-weight: bold; color: ${partnerShare >= 0 ? '#059669' : '#dc2626'};">+${partnerShare.toLocaleString()}</td><td style="color: #b91c1c;">-${totalWithdrawals.toLocaleString()}</td><td style="font-weight: bold; background: #f8fafc;">${p.balance.toLocaleString()}</td></tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>` : '';

    const custodyDetailsHtml = (custodyAccounts.length > 0 && s.showCustody) ? `
        <div style="margin-top: 25px; page-break-inside: avoid;">
            <h3 style="background: #334155; color: white; padding: 10px; border-radius: 6px; font-size: 16px; margin-bottom: 10px;">${sectionCounter++}. ذمم العُهد والموظفين</h3>
            <table class="modern-table">
                <thead>
                    <tr>
                        <th style="width: 25%;">اسم الموظف / الحساب</th>
                        <th style="width: 55%;">تفاصيل العُهد (العميل - رقم الأوردر)</th>
                        <th style="width: 20%;">الإجمالي</th>
                    </tr>
                </thead>
                <tbody>
                    ${custodyAccounts.map(a => {
                        const details = custodyDetails[a.name] || [];
                        const detailsHtml = details.length > 0 
                            ? `<div style="text-align: right; font-size: 11px;">
                                ${details.map(d => `
                                    <div style="margin-bottom: 4px; padding: 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                                        <span>
                                            <span style="font-size: 8px; background: ${d.type === 'نقطة بيع' ? '#f0fdf4' : '#fffbeb'}; color: ${d.type === 'نقطة بيع' ? '#166534' : '#d97706'}; padding: 1px 4px; border-radius: 4px; border: 1px solid ${d.type === 'نقطة بيع' ? '#bbf7d0' : '#fde68a'}; margin-left: 5px;">${d.type}</span>
                                            <strong style="color: #0f172a;">${d.customerName}</strong>
                                            <span style="color: #64748b; margin-right: 5px;">(#${d.orderNumber})</span>
                                        </span>
                                        <span style="font-weight: bold; color: #1e3a8a;">${d.amount.toLocaleString()} ج.م</span>
                                    </div>
                                `).join('')}
                               </div>`
                            : '<span style="color: #94a3b8; font-style: italic;">لا توجد تفاصيل أوردرات مرتبطة (عهد قديمة أو تسويات)</span>';
                        
                        return `
                            <tr>
                                <td style="font-weight: bold; color: #1e3a8a;">${a.name}</td>
                                <td style="padding: 10px;">${detailsHtml}</td>
                                <td style="font-weight: bold; font-size: 16px; ${a.balance > 0 ? 'color: #b91c1c;' : ''}">${a.balance.toLocaleString()} ج.م</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>` : '';

    const recommendationHtml = (recommendations.length > 0 && s.showRecommendations) ? `
        <div style="background: #fffaf0; border: 1px solid #feebc8; border-radius: 12px; padding: 20px; margin-top: 30px;">
            <h4 style="color: #c05621; margin: 0 0 10px 0;">توصيات ذكية لتحسين الأداء</h4>
            <ul style="margin: 0; padding-right: 20px; font-size: 12px; color: #9a3412;">${recommendations.map(r => `<li>${r}</li>`).join('')}</ul>
        </div>` : '';

    return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
        <style>
            :root {
                --primary: #1e3a8a; --primary-soft: #dbeafe; --success: #059669; --danger: #dc2626;
                --slate-50: #f8fafc; --slate-100: #f1f5f9; --slate-200: #e2e8f0; --slate-700: #334155; --slate-900: #0f172a;
            }
            @page { size: ${isContinuous ? 'auto' : (orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait')}; margin: ${isContinuous ? '0' : '10mm'}; }
            body { font-family: 'Cairo', sans-serif; background: #fdfdfd; color: var(--slate-900); margin: 0; padding: ${isContinuous ? '20px' : '0'}; line-height: 1.6; }
            .report-container { width: 100%; max-width: ${orientation === 'landscape' ? '297mm' : '210mm'}; margin: 0 auto; background: white; padding: ${isContinuous ? '20px' : '40px'}; box-sizing: border-box; border-radius: ${isContinuous ? '16px' : '0'}; box-shadow: ${isContinuous ? '0 10px 15px -3px rgb(0 0 0 / 0.1)' : 'none'}; }
            
            .header-banner { background: var(--slate-900); color: white; padding: 40px; border-radius: 24px; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
            .header-banner h1 { margin: 0; font-size: 36px; font-weight: 900; letter-spacing: -1px; }
            
            .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-bottom: 40px; }
            .stat-card { background: white; padding: 25px; border-radius: 20px; border: 1px solid var(--slate-200); text-align: center; position: relative; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
            .stat-card::before { content: ""; position: absolute; top: 0; right: 0; width: 5px; height: 100%; background: var(--primary); }
            .stat-card .label { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 10px; display: block; }
            .stat-card .value { font-size: 26px; font-weight: 900; color: var(--slate-900); }

            .section-header { font-size: 22px; font-weight: 900; color: var(--primary); margin: 50px 0 25px 0; padding-bottom: 12px; border-bottom: 4px solid var(--slate-100); display: flex; align-items: center; gap: 15px; }
            .section-header::before { content: ""; width: 8px; height: 30px; background: var(--primary); border-radius: 4px; }

            .modern-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 30px; border: 1px solid var(--slate-200); border-radius: 16px; overflow: hidden; }
            .modern-table th { background: var(--slate-50); color: var(--slate-700); font-size: 12px; font-weight: 800; padding: 18px 12px; border-bottom: 2px solid var(--slate-200); text-align: center; }
            .modern-table td { padding: 15px 12px; font-size: 13px; border-bottom: 1px solid var(--slate-100); text-align: center; color: #475569; }
            .modern-table tr:last-child td { border-bottom: none; }
            .total-row { background: var(--slate-100) !important; font-weight: 900; color: var(--slate-900) !important; }
            
            .stage-banner { display: flex; align-items: center; gap: 20px; background: white; padding: 25px; border-radius: 20px; margin-bottom: 30px; border-right: 8px solid var(--primary); box-shadow: 0 4px 15px rgba(0,0,0,0.04); }
            .stage-number { width: 45px; height: 45px; background: var(--primary); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 22px; }
            .stage-title { font-size: 20px; font-weight: 900; color: var(--primary); margin: 0; }

            .final-banner { background: linear-gradient(135deg, var(--slate-900) 0%, var(--primary) 100%); color: white; padding: 60px; border-radius: 32px; text-align: center; margin: 60px 0; box-shadow: 0 30px 60px rgba(30, 58, 138, 0.2); }
            .final-banner .amount { font-size: 72px; font-weight: 900; margin: 25px 0; letter-spacing: -2px; }
            
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
            .col-products { text-align: right !important; font-size: 11px; }

            .signature-section { margin-top: 100px; display: grid; grid-template-columns: 1fr 1fr; gap: 100px; padding: 40px; background: var(--slate-50); border-radius: 24px; border: 1px solid var(--slate-200); }
            .signature-box { text-align: center; }
            .signature-line { border-top: 2px solid var(--slate-200); width: 200px; margin: 30px auto 10px auto; }
            
            @media print {
                body { background: white; }
                .report-container { box-shadow: none; padding: 0; width: 100%; }
                .header-banner { border-radius: 0; box-shadow: none; }
                .final-banner { break-inside: avoid; }
                .modern-table { break-inside: auto; }
                tr { break-inside: avoid; }
            }
        </style>
    </head>
    <body>
        <div class="report-container">
            <div class="header-banner">
                <div>
                    <h1>${storeName}</h1>
                    <p style="opacity: 0.9; margin-top: 8px; font-weight: 600; font-size: 18px;">تقرير الأداء الاستراتيجي والمركز المالي الشامل</p>
                </div>
                <div style="text-align: left;">
                    <div style="font-weight: 800; font-size: 22px; background: rgba(255,255,255,0.1); padding: 10px 25px; border-radius: 50px;">${dateRangeText || 'الفترة الكاملة'}</div>
                    <div style="font-size: 13px; opacity: 0.7; margin-top: 15px;">استخراج: ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG')}</div>
                </div>
            </div>

            ${summaryHtml}
            ${incomeStatementHtml}
            ${operationalHtml}
            ${productProfitabilityHtml}
            ${collectionLogHtml}
            ${lossLogHtml}
            ${expensesLogHtml}
            ${inventoryLogHtml}
            ${partnerDetailsHtml}
            ${custodyDetailsHtml}
            ${recommendationHtml}

            <div class="signature-section">
                <div class="signature-box">
                    <p style="font-weight: 800; color: var(--slate-700); margin-bottom: 40px;">توقيع المحاسب المسئول</p>
                    <div class="signature-line"></div>
                    <span style="font-size: 12px; color: #94a3b8;">الاسم: ...........................................</span>
                </div>
                <div class="signature-box">
                    <p style="font-weight: 800; color: var(--slate-700); margin-bottom: 40px;">اعتماد إدارة المتجر</p>
                    <div class="signature-line"></div>
                    <span style="font-size: 12px; color: #94a3b8;">الاسم: ...........................................</span>
                </div>
            </div>

            <div style="text-align: center; margin-top: 50px; color: #94a3b8; font-size: 12px; border-top: 1px solid var(--slate-200); padding-top: 25px;">
                تم استخراج هذا التقرير آلياً بواسطة نظام "مدير الأوردرات الذكي" &copy; ${new Date().getFullYear()}
            </div>
        </div>
        <script>window.onload = function() { setTimeout(() => { window.print(); }, 1200); };</script>
    </body>
    </html>
    `;
};

