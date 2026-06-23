import { Order, Settings } from '../types';

export const generateShippingLabelHTML = (order: Order, storeName: string, settings?: Settings) => {
  const isPosOrder = order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر' || order.shippingArea === 'نقطة البيع' || (order.id && order.id.startsWith('POS-'));
  const compFees = settings?.companySpecificFees?.[order.shippingCompany];
  const useCustom = compFees?.useCustomFees ?? false;
  const inspectionFeeParams = !isPosOrder && (order.includeInspectionFee ?? true) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings?.enableInspection ? (settings?.inspectionFee || 0) : 0)) : 0;
  
  const computedTotal = (Number(order.productPrice) || 0) + (Number(order.shippingFee) || 0) - (Number(order.discount) || 0) - (Number(order.advancePayment) || 0) + inspectionFeeParams;
  let totalAmount = computedTotal;
  
  if (order.source === 'synced' && order.totalPrice != null) {
      totalAmount = Number(order.totalPrice) + inspectionFeeParams;
  } else if (order.totalAmountOverride !== undefined && order.totalAmountOverride !== null && String(order.totalAmountOverride).trim() !== '') {
      totalAmount = Number(order.totalAmountOverride);
  }
  
  // Only show COD amount if payment method is COD
  const isCOD = order.paymentMethod?.toLowerCase().includes('cod') || !order.paymentMethod;
  const amountToCollect = isCOD ? totalAmount : 0;

  return `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <title>بوليصة شحن ${order.orderNumber}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet" crossorigin="anonymous">
    <style>
      @page { size: 100mm 150mm; margin: 5mm; }
      body { font-family: 'Cairo', sans-serif; margin: 0; padding: 0; font-size: 11px; }
      .label-container { width: 100%; height: 100%; border: 2px solid black; padding: 10px; box-sizing: border-box; display: flex; flex-direction: column; }
      .header, .footer { text-align: center; flex-shrink: 0; }
      .header h1 { margin: 0; font-size: 22px; font-weight: 900; }
      .header p { margin: 2px 0; font-size: 10px; }
      .content { flex-grow: 1; display: flex; flex-direction: column; justify-content: space-around; }
      .section { border-top: 2px dashed #333; padding-top: 8px; margin-top: 8px; }
      .to-address h2 { margin: 0 0 5px 0; font-size: 16px; }
      .to-address p { margin: 2px 0; font-size: 14px; font-weight: 700; }
      .order-details p { margin: 3px 0; font-weight: 600; }
      .cod-amount { text-align: center; background: #000; color: #fff; padding: 5px; font-size: 20px; font-weight: 900; border-radius: 5px; margin-top: 5px; }
      .barcode { text-align: center; }
      @media print { .no-print { display: none; } }
    </style>
  </head>
  <body>
    <div class="label-container">
      <div class="header">
        <h1>${storeName}</h1>
        <p>${new Date(order.date).toLocaleDateString('ar-EG')}</p>
      </div>
      <div class="content">
        <div class="section to-address">
          <h2>إلى:</h2>
          <p>${order.customerName}</p>
          <p style="font-size: 12px;">${order.customerAddress}</p>
          <p>${order.customerPhone}</p>
        </div>
        <div class="section order-details">
          <p><strong>المنتجات:</strong> ${order.productName}</p>
          ${amountToCollect > 0 ? `<div class="cod-amount">المبلغ المطلوب: ${amountToCollect.toLocaleString()} ج.م</div>` : '<div class="cod-amount">تم الدفع</div>'}
          ${order.notes ? `<p><strong>ملاحظات:</strong> ${order.notes}</p>` : ''}
        </div>
        <div class="section barcode">
          <svg id="barcode"></svg>
        </div>
      </div>
      <div class="footer">
        <p>حق المعاينة مكفول قبل الاستلام</p>
      </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.0/dist/JsBarcode.all.min.js"></script>
    <script>
      try {
        JsBarcode("#barcode", "${order.orderNumber}", {
          format: "CODE128",
          height: 40,
          displayValue: true,
          fontSize: 14
        });
        window.onload = function() { window.print(); }
      } catch (e) {
        console.error(e);
      }
    </script>
  </body>
  </html>
  `;
};
