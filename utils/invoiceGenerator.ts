
import { Order, Settings, OrderItem } from '../types';

export const generateInvoiceHTML = (order: Order, settings: Settings, storeName: string) => {
  const itemDiscounts = order.items.reduce((sum, item) => {
    let discount = 0;
    if (item.discountValue) {
      if (item.discountType === 'percentage') {
        discount = (item.price * item.quantity) * (item.discountValue / 100);
      } else {
        discount = item.discountValue * item.quantity;
      }
    }
    return sum + discount;
  }, 0);

  const totalAmount = order.totalAmountOverride ?? (order.productPrice + order.shippingFee + (order.tax || 0) - order.discount - itemDiscounts);
  
  const itemsHtml = order.items.map((item: OrderItem) => {
    let discountText = '';
    let netPrice = item.price * item.quantity;
    if (item.discountValue) {
      const discountAmount = item.discountType === 'percentage' 
        ? (item.price * item.quantity) * (item.discountValue / 100)
        : item.discountValue * item.quantity;
      discountText = `<br><span style="color: red; font-size: 10px;">خصم: -${discountAmount.toLocaleString()}</span>`;
      netPrice -= discountAmount;
    }

    return `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px; text-align: right;">
          ${item.name}
          ${discountText}
        </td>
        <td style="padding: 10px; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; text-align: center;">${item.price.toLocaleString()}</td>
        <td style="padding: 10px; text-align: center; font-weight: bold;">${(item.price * item.quantity).toLocaleString()}</td>
      </tr>
    `;
  }).join('');

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
            <h2 style="margin: 0; color: #333 text-align: left;">فاتورة مبيعات</h2>
            <p style="margin: 5px 0; font-family: monospace;">الطلب: #${order.orderNumber}</p>
            ${order.referenceNumber ? `<p style="margin: 5px 0; font-size: 14px; color: #555;">المرجع: ${order.referenceNumber}</p>` : ''}
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
          ${itemDiscounts > 0 ? `
          <div class="total-row" style="color: red;">
            <span>خصومات الأصناف:</span>
            <span>-${itemDiscounts.toLocaleString()} ج.م</span>
          </div>` : ''}
          <div class="total-row">
            <span>مصاريف الشحن:</span>
            <span>${order.shippingFee.toLocaleString()} ج.م</span>
          </div>
          ${order.tax && order.tax > 0 ? `
          <div class="total-row">
            <span>الضريبة:</span>
            <span>${order.tax.toLocaleString()} ج.م</span>
          </div>` : ''}
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
          ${(Number(order.advancePayment) || 0) > 0 ? `
          <div class="total-row" style="font-size: 14px; color: #555;">
            <span>إجمالي قيمة الطلب:</span>
            <span>${totalAmount.toLocaleString()} ج.م</span>
          </div>
          <div class="total-row" style="color: #0d9488; font-weight: bold;">
            <span>العربون المقدم المدفوع:</span>
            <span>-${(Number(order.advancePayment) || 0).toLocaleString()} ج.م</span>
          </div>
          <div class="total-row grand-total">
            <span>المطلوب سداده عند الاستلام:</span>
            <span>${(totalAmount - (Number(order.advancePayment) || 0)).toLocaleString()} ج.م</span>
          </div>
          ` : `
          <div class="total-row grand-total">
            <span>الإجمالي المستحق:</span>
            <span>${totalAmount.toLocaleString()} ج.م</span>
          </div>
          `}
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
