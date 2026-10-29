import { TransparencyAnalyticsResult } from './merchantAnalytics';
import { printHTMLDirectly } from './printHelper';

/**
 * Generate Printable Official A4 Transparency Report HTML
 * Modern, high-fidelity design with Cairo font and detailed financial breakdown.
 */
export function printModernMerchantTransparencyReport(
  analytics: TransparencyAnalyticsResult,
  storeName: string = 'المتجر الإلكتروني'
) {
  const isProfit = analytics.merchantNetProfitOrLoss >= 0;
  
  const printDate = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const printHtml = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>تقرير الشفافية ومحاسبة الموكل - ${analytics.merchantDisplayName}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
      <style>
        @page { size: A4 portrait; margin: 8mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body {
          font-family: 'Cairo', sans-serif;
          color: #1e293b;
          background: #ffffff;
          margin: 0;
          padding: 0;
          font-size: 10px;
          line-height: 1.4;
          direction: rtl;
        }
        .header-banner {
          background: linear-gradient(135deg, #064e3b 0%, #059669 100%);
          color: white;
          padding: 24px;
          border-radius: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .header-title h1 { margin: 0; font-size: 20px; font-weight: 900; }
        .header-title p { margin: 4px 0 0 0; font-size: 11px; opacity: 0.9; font-weight: 600; }
        .merchant-info { text-align: left; background: rgba(255,255,255,0.1); padding: 12px 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2); }
        .merchant-info .name { font-size: 16px; font-weight: 900; color: #34d399; display: block; }
        .merchant-info .date { font-size: 10px; opacity: 0.8; margin-top: 2px; display: block; }

        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
        .kpi-card { border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; display: flex; flex-direction: column; }
        .kpi-card .label { font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 6px; }
        .kpi-card .value { font-size: 18px; font-weight: 900; color: #0f172a; direction: ltr; text-align: right; }
        .kpi-card.highlight { background: #f8fafc; border-color: #cbd5e1; }
        .kpi-card.success { background: #ecfdf5; border-color: #10b981; }
        .kpi-card.success .value { color: #059669; }
        .kpi-card.primary { background: #0f172a; color: white; border: none; }
        .kpi-card.primary .label { color: #94a3b8; }
        .kpi-card.primary .value { color: #10b981; }

        .section-header { display: flex; align-items: center; gap: 8px; margin: 24px 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid #f1f5f9; }
        .section-header span { font-size: 14px; font-weight: 900; color: #0f172a; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; table-layout: fixed; }
        th { background: #f8fafc; color: #475569; font-weight: 800; font-size: 9px; padding: 10px 8px; border-bottom: 2px solid #e2e8f0; text-align: center; }
        td { padding: 8px; border-bottom: 1px solid #f1f5f9; font-size: 9.5px; font-weight: 600; text-align: center; vertical-align: middle; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .font-mono { font-family: monospace; }
        
        .net-formula { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 16px; margin-top: 20px; page-break-inside: avoid; }
        .formula-title { font-size: 11px; font-weight: 800; color: #475569; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
        .formula-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; text-align: center; }
        .formula-item { display: flex; flex-direction: column; gap: 4px; }
        .formula-item .lbl { font-size: 9px; color: #64748b; font-weight: 700; }
        .formula-item .val { font-size: 12px; font-weight: 800; color: #1e293b; direction: ltr; }
        .formula-sep { display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 900; color: #94a3b8; }
        
        .footer-note { margin-top: 30px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 12px; }
        
        .badge { padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: 800; }
        .badge-success { background: #dcfce7; color: #15803d; }
        .badge-error { background: #fee2e2; color: #b91c1c; }
        
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header-banner">
        <div class="header-title">
          <h1>تقرير الشفافية المالية للموكل</h1>
          <p>${storeName} • مركز محاسبة الشركاء والموكلين</p>
        </div>
        <div class="merchant-info">
          <span class="name">${analytics.merchantDisplayName}</span>
          <span class="date">تاريخ التقرير: ${printDate}</span>
          <span class="date">الفترة: ${analytics.dateRangeLabel}</span>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="label">إجمالي التحصيل النقدي</span>
          <span class="value">${analytics.totalCollected.toLocaleString()} ج.م</span>
        </div>
        <div class="kpi-card">
          <span class="label">تكلفة البضاعة (رأس المال المسترد)</span>
          <span class="value" style="color: #0369a1;">${analytics.totalGoodsCostRecovered.toLocaleString()} ج.م</span>
        </div>
        <div class="kpi-card">
          <span class="label">إجمالي المصاريف (شحن + تسويق + عمولة)</span>
          <span class="value" style="color: #be123c;">-${analytics.totalAllDeductions.toLocaleString()} ج.م</span>
        </div>
        <div class="kpi-card success">
          <span class="label">صافي الربح / الخسارة (فوق رأس المال)</span>
          <span class="value">${isProfit ? '+' : ''}${analytics.merchantNetProfitOrLoss.toLocaleString()} ج.م</span>
        </div>
        <div class="kpi-card highlight">
          <span class="label">نسبة نجاح التسليم</span>
          <span class="value" style="color: #0d9488;">${analytics.deliverySuccessRate}%</span>
        </div>
        <div class="kpi-card primary">
          <span class="label">الصافي النهائي المستحق للتحويل</span>
          <span class="value">${analytics.netPayoutToMerchant.toLocaleString()} ج.م</span>
        </div>
      </div>

      <div class="section-header">
        <span>بيان تفصيلي بالأوردرات وحصتك المالية</span>
      </div>
      
      <table>
        <thead>
          <tr>
            <th style="width: 10%">رقم الطلب</th>
            <th style="width: 15%" class="text-right">العميل</th>
            <th style="width: 25%" class="text-right">المنتجات</th>
            <th style="width: 10%">الحالة</th>
            <th style="width: 10%">المحصل</th>
            <th style="width: 10%">تكلفة البضاعة</th>
            <th style="width: 10%">المصاريف</th>
            <th style="width: 10%">الصافي</th>
          </tr>
        </thead>
        <tbody>
          ${analytics.orderRows.map(o => {
            const rowExp = o.totalShippingAndCarrier + o.serviceFee + o.marketingFee;
            return `
            <tr>
              <td class="font-mono">${o.orderNumber}</td>
              <td class="text-right">${o.customerName}</td>
              <td class="text-right" style="font-size: 8px;">${o.itemsSummary}</td>
              <td>
                <span class="badge ${o.isDelivered ? 'badge-success' : o.isReturn ? 'badge-error' : ''}">
                  ${o.status.replace(/_/g, ' ')}
                </span>
              </td>
              <td class="font-mono">${o.collectedAmount.toLocaleString()}</td>
              <td class="font-mono">${o.merchantGoodsCost.toLocaleString()}</td>
              <td class="font-mono" style="color: #be123c;">${rowExp.toLocaleString()}</td>
              <td class="font-mono" style="color: #059669; font-weight: 800;">${o.netMerchantAmount.toLocaleString()}</td>
            </tr>
          `; }).join('')}
        </tbody>
      </table>

      <div class="net-formula">
        <div class="formula-title">كيف تم حساب صافي مستحقاتك (${analytics.netPayoutToMerchant.toLocaleString()} ج.م)؟</div>
        <div class="formula-grid">
          <div class="formula-item">
            <span class="lbl">إجمالي المحصل</span>
            <span class="val">${analytics.totalCollected.toLocaleString()}</span>
          </div>
          <div class="formula-sep">-</div>
          <div class="formula-item">
            <span class="lbl">تكاليف الشحن والرسوم</span>
            <span class="val">${analytics.totalShippingAndCarrier.toLocaleString()}</span>
          </div>
          <div class="formula-sep">-</div>
          <div class="formula-item">
            <span class="lbl">عمولات التشغيل والتسويق</span>
            <span class="val">${(analytics.totalServiceFees + analytics.totalMarketingCosts).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div class="footer-note">
        صدر هذا التقرير آلياً من منصة ${storeName} • جميع الأرقام تخضع للمراجعة والتدقيق المحاسبي • ${new Date().toLocaleString('ar-EG')}
      </div>
    </body>
    </html>
  `;

  printHTMLDirectly(printHtml);
}
