import { Order, Settings, OrderItem } from '../types';
import { getAdvancePaymentCustodyName } from './financials';

export const generateInvoiceHTML = (order: Order, settings: Settings, storeName: string) => {
  const senderBrand = order.merchantBrandName?.trim() || storeName || 'المتجر الإلكتروني';
  const senderPhone = order.merchantBrandPhone?.trim() || "";

  const safeItems: OrderItem[] = Array.isArray(order.items) && order.items.length > 0 
    ? order.items 
    : [{
        name: order.productName || 'منتج عام',
        quantity: 1,
        price: Number(order.productPrice) || 0,
      } as any];

  const itemDiscounts = safeItems.reduce((sum, item) => {
    let discount = 0;
    const itemPrice = Number(item.price) || 0;
    const itemQty = Number(item.quantity) || 1;
    if (item.discountValue) {
      if (item.discountType === 'percentage') {
        discount = (itemPrice * itemQty) * (Number(item.discountValue) / 100);
      } else {
        discount = Number(item.discountValue) * itemQty;
      }
    }
    return sum + discount;
  }, 0);

  const compFees = settings?.companySpecificFees?.[order.shippingCompany];
  const inspectionFeeValue = order.includeInspectionFee 
    ? (compFees?.useCustomFees ? (Number(compFees.inspectionFee) ?? Number(settings?.inspectionFee || 0)) : Number(settings?.inspectionFee || 0))
    : 0;

  const itemsTotalSum = safeItems.reduce((sum, it) => sum + ((Number(it.price) || 0) * (Number(it.quantity) || 1)), 0);
  const safeProductPrice = Number(order.productPrice) > 0 ? Number(order.productPrice) : itemsTotalSum;
  const safeShippingFee = Number(order.shippingFee) || 0;
  const safeTax = Number(order.tax) || 0;
  const safeDiscount = Number(order.discount) || 0;
  const safeAdvance = Number(order.advancePayment) || 0;

  const totalAmount = order.totalAmountOverride != null 
    ? Number(order.totalAmountOverride) 
    : Math.max(0, safeProductPrice + safeShippingFee + safeTax + inspectionFeeValue - safeDiscount - itemDiscounts);
  
  const itemsHtml = safeItems.map((item: OrderItem) => {
    let discountText = '';
    const itemPrice = Number(item.price) || 0;
    const itemQty = Number(item.quantity) || 1;
    let netPrice = itemPrice * itemQty;
    if (item.discountValue) {
      const discountAmount = item.discountType === 'percentage' 
        ? (itemPrice * itemQty) * (Number(item.discountValue) / 100)
        : Number(item.discountValue) * itemQty;
      discountText = `<br><span style="color: red; font-size: 10px;">خصم: -${(Number(discountAmount) || 0).toLocaleString()}</span>`;
      netPrice -= discountAmount;
    }

    return `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px; text-align: right;">
          ${item.name || 'منتج'}
          ${discountText}
        </td>
        <td style="padding: 10px; text-align: center;">${itemQty}</td>
        <td style="padding: 10px; text-align: center;">${itemPrice.toLocaleString()}</td>
        <td style="padding: 10px; text-align: center; font-weight: bold;">${(itemPrice * itemQty).toLocaleString()}</td>
      </tr>
    `;
  }).join('');

  const primaryColor = settings?.customization?.primaryColor || '#4f46e5';
  const footerText = settings?.customization?.footerText || '';
  const logoUrl = settings?.customization?.logoUrl;

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>فاتورة رقم ${order.orderNumber || order.id || ''}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" crossorigin="anonymous">
      <style>
        body { font-family: 'Cairo', sans-serif; margin: 0; padding: 20px; color: #333; }
        .invoice-container { max-width: 800px; margin: auto; border: 1px solid #ddd; padding: 30px; border-radius: 10px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
        .logo { max-height: 60px; }
        .store-info h1 { margin: 0; font-size: 24px; color: ${primaryColor}; }
        .invoice-details { display: flex; justify-content: space-between; margin-bottom: 30px; background: #f9f9f9; padding: 20px; border-radius: 8px; }
        .detail-group h3 { margin: 0 0 10px 0; font-size: 16px; color: #666; }
        .detail-group p { margin: 5px 0; font-weight: bold; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #f1f1f1; padding: 12px; text-align: center; font-weight: bold; font-size: 14px; }
        .totals { width: 280px; margin-right: auto; margin-left: 0; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .grand-total { font-size: 20px; font-weight: bold; color: ${primaryColor}; border-top: 2px solid #ddd; border-bottom: none; padding-top: 15px; }
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
            ${order.merchantBrandName?.trim() ? `
              <h1 style="margin: 0; font-size: 24px; color: ${primaryColor};">${senderBrand}</h1>
              ${senderPhone ? `<p style="margin: 3px 0; font-size: 13px; font-weight: bold; color: #444;">هاتف البراند: ${senderPhone}</p>` : ''}
              <p style="margin: 2px 0; font-size: 10px; color: #888; text-transform: uppercase;">(فاتورة شحن براند خارجي / دروب شيبنج)</p>
            ` : (logoUrl ? `<img src="${logoUrl}" class="logo" alt="Logo">` : `<h1>${senderBrand}</h1>`)}
            ${footerText ? `<p style="margin:5px 0 0; font-size:12px; color:#777;">${footerText}</p>` : ''}
          </div>
          <div style="text-align: left;">
            <h2 style="margin: 0; color: #333; text-align: left;">فاتورة مبيعات</h2>
            <p style="margin: 5px 0; font-family: monospace;">الطلب: #${order.orderNumber || order.id || ''}</p>
            ${order.referenceNumber ? `<p style="margin: 5px 0; font-size: 14px; color: #555;">المرجع: ${order.referenceNumber}</p>` : ''}
            <p style="margin: 5px 0; font-size: 14px; color: #777;">${new Date().toLocaleDateString('ar-EG')}</p>
          </div>
        </div>

        <div class="invoice-details">
          <div class="detail-group">
            <h3>بيانات العميل</h3>
            <p>الاسم: ${order.customerName || 'بدون اسم'}</p>
            <p>الهاتف: ${order.customerPhone || 'بدون هاتف'}</p>
            <p>العنوان: ${order.customerAddress || order.shippingArea || 'غير محدد'}</p>
          </div>
          <div class="detail-group" style="text-align: left;">
            <h3>تفاصيل الشحن</h3>
            <p>شركة الشحن: ${order.shippingCompany || 'غير محددة'}</p>
            <p>المنطقة: ${order.shippingArea || order.governorate || 'غير محددة'}</p>
            <p>الحالة: ${(order.status || '').replace(/_/g, ' ')}</p>
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
            <span>${safeProductPrice.toLocaleString()} ج.م</span>
          </div>
          ${itemDiscounts > 0 ? `
          <div class="total-row" style="color: red;">
            <span>خصومات الأصناف:</span>
            <span>-${(Number(itemDiscounts) || 0).toLocaleString()} ج.م</span>
          </div>` : ''}
          <div class="total-row">
            <span>مصاريف الشحن:</span>
            <span>${safeShippingFee.toLocaleString()} ج.م</span>
          </div>
          ${safeTax > 0 ? `
          <div class="total-row">
            <span>الضريبة:</span>
            <span>${safeTax.toLocaleString()} ج.م</span>
          </div>` : ''}
          ${safeDiscount > 0 ? `
          <div class="total-row" style="color: red;">
            <span>خصم:</span>
            <span>-${safeDiscount.toLocaleString()} ج.م</span>
          </div>` : ''}
          ${order.includeInspectionFee ? `
          <div class="total-row">
            <span>رسوم معاينة:</span>
            <span>${inspectionFeeValue.toLocaleString()} ج.م</span>
          </div>` : ''}
          ${safeAdvance > 0 ? `
          <div class="total-row" style="font-size: 14px; color: #555;">
            <span>إجمالي قيمة الطلب:</span>
            <span>${totalAmount.toLocaleString()} ج.م</span>
          </div>
          <div class="total-row" style="color: #0d9488; font-weight: bold;">
            <span>العربون المقدم المدفوع (${getAdvancePaymentCustodyName(order, settings)}):</span>
            <span>-${safeAdvance.toLocaleString()} ج.م</span>
          </div>
          <div class="total-row grand-total">
            <span>المطلوب سداده عند الاستلام:</span>
            <span>${Math.max(0, totalAmount - safeAdvance).toLocaleString()} ج.م</span>
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
