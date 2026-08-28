import { Order, Settings, Wallet, OrderItem, Treasury } from '../types';

// Helper for formatting currency amounts to at most 2 decimals
const fmt = (val: number) => {
    if (val === undefined || val === null || isNaN(val)) return '0';
    const rounded = Math.round((val + Number.EPSILON) * 100) / 100;
    return rounded.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

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

const getAccountingCycleExplanationHTML = (): string => {
    return `
    <div style="background: #f8fafc; border: 2px solid #3b82f6; border-radius: 12px; padding: 20px; margin-bottom: 24px; direction: rtl; text-align: right; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); page-break-inside: avoid;">
        <div style="display: flex; align-items: center; gap: 8px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 15px;">
            <span style="font-size: 20px;">🔄</span>
            <strong style="color: #1e3a8a; font-size: 16px; font-weight: 800;">الدليل الشامل والدورة المحاسبية الكاملة للمشروع (دورة تدفق وحماية الأموال)</strong>
        </div>
        
        <p style="font-size: 11.5px; color: #334155; line-height: 1.6; margin: 0 0 15px 0;">
            هذا الدليل مُعد لتوضيح كيفية حركة وإدارة أموال المشروع بالكامل من البداية وحتى تحقيق وتوزيع الأرباح، مع شرح الفارق الحاسم بين مبيعات التحصيل وصافي الربح لضمان عدم تآكل رأس المال واستمرارية المحل:
        </p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 15px;">
            <!-- 1. رأس المال -->
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-top: 4px solid #3b82f6; padding: 12px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); text-align: right;">
                <strong style="color: #1e3a8a; font-size: 12px; display: block; margin-bottom: 6px;">🪙 1. رأس المال المستثمر</strong>
                <span style="font-size: 10.5px; color: #475569; line-height: 1.5; display: block;">
                    هو المبلغ الأساسي المودع من الشركاء لتأسيس المحل وتوفير بضاعة المخزن. يُعد <strong>ديناً على المشروع للشريك</strong> يظل مجمداً كأصول ومخزون لدعم الاستمرارية، ولا يجوز نهائياً سحبه أو اعتباره أرباحاً قابلة للاستهلاك.
                </span>
            </div>

            <!-- 2. التحصيلات والمبيعات -->
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-top: 4px solid #f59e0b; padding: 12px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); text-align: right;">
                <strong style="color: #b45309; font-size: 12px; display: block; margin-bottom: 6px;">📦 2. المبيعات الإجمالية (التحصيل)</strong>
                <span style="font-size: 10.5px; color: #475569; line-height: 1.5; display: block;">
                    إجمالي التحصيل النقدي من الزبائن <strong>ليس ربحاً بالكامل</strong>! بل يشتمل على (تكلفة البضاعة الأصلية بسعر الجملة + مصاريف الشحن والتغليف + رسوم شركات الشحن والمعاينة والتأمين + هامش الربح الصغير المتبقي).
                </span>
            </div>

            <!-- 3. تكلفة البضاعة COGS -->
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-top: 4px solid #ef4444; padding: 12px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); text-align: right;">
                <strong style="color: #b91c1c; font-size: 12px; display: block; margin-bottom: 6px;">🛠️ 3. تكلفة البضاعة المباعة (COGS)</strong>
                <span style="font-size: 10.5px; color: #475569; line-height: 1.5; display: block;">
                    تساوي (عدد القطع المباعة × سعر شرائها من المورد بسعر الجملة). يجب استقطاع هذا المبلغ فوراً من كل تحصيل وإعادته لتدوير المخزون لشراء بضاعة بديلة. تسييلها وتوزيعها يعني نفاد الرفوف تدريجياً وإغلاق المحل.
                </span>
            </div>

            <!-- 4. المصاريف والتشغيل -->
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-top: 4px solid #8b5cf6; padding: 12px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); text-align: right;">
                <strong style="color: #6d28d9; font-size: 12px; display: block; margin-bottom: 6px;">📢 4. مصاريف التشغيل والإعلان</strong>
                <span style="font-size: 10.5px; color: #475569; line-height: 1.5; display: block;">
                    تشمل كافة النفقات التشغيلية المباشرة وغير المباشرة مثل (الإعلانات الممولة على فيسبوك، إيجار المقر، أجور الموظفين والمناديب، بوابات الدفع، والاشتراكات). تُخصم بالكامل من أرباح المشروع قبل احتساب الأرباح.
                </span>
            </div>
        </div>

        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px; margin-bottom: 12px; text-align: right;">
            <strong style="color: #065f46; font-size: 12px; display: block; margin-bottom: 4px;">📈 5. الربح الصافي الفعلي (الوحيد القابل للتوزيع):</strong>
            <span style="font-size: 10.5px; color: #065f46; line-height: 1.5; display: block;">
                هو المتبقي بعد المعادلة الذهبية: 
                <strong style="background: #ffffff; padding: 2px 6px; border-radius: 4px; border: 1px solid #86efac; font-family: monospace; display: inline-block; margin: 2px 0;">الربح الصافي = المبيعات الإجمالية - تكلفة البضاعة بسعر الجملة - مصاريف الشحن والتشغيل والإرجاع</strong>.
                هذا الفارق الصافي فقط هو ما يتم تقسيمه وإضافته للشريك في رصيده بنسبة حصته، ويحرم محاسبياً وقانونياً توزيع غير ذلك.
            </span>
        </div>

        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px; font-size: 11px; color: #78350f; line-height: 1.6; text-align: right;">
            <strong style="color: #92400e; font-size: 13px; display: block; margin-bottom: 6px;">📝 مثال توضيحي عملي بالأرقام لشريكين (أحمد وباسم):</strong>
            نفترض أن <strong>أحمد</strong> و<strong>باسم</strong> أسسا محلاً تجارياً بالتساوي (نسبة 50% لكل منهما):
            <div style="margin: 6px 0; padding-right: 10px; border-right: 2px solid #fcd34d; font-size: 10.5px;">
                • <strong>رأس المال المودع:</strong> ساهم كل شريك بـ <strong>10,000 ج.م</strong> (إجمالي رأس مال المتجر = <strong>20,000 ج.م</strong> مجمّدة لشراء البضاعة).<br/>
                • <strong>مبيعات المتجر (التحصيل):</strong> عمل المحل مبيعات إجمالية قدرها <strong>100,000 ج.م</strong> كاش مبيعات.<br/>
                • <strong>تكلفة البضاعة المباعة (بسعر الجملة):</strong> بلغت تكلفة البضاعة التي خرجت من الرفوف <strong>70,000 ج.م</strong> (هذا المبلغ يجب تجميده فوراً لإعادة شراء بضاعة جديدة ولا يُوزع أبداً).<br/>
                • <strong>مصاريف التشغيل والتسويق والشحن والإرجاع:</strong> بلغت <strong>18,000 ج.م</strong> خلال الشهر.<br/>
                • <strong>الربح الصافي الفعلي للمتجر:</strong> 100,000 مبيعات - 70,000 تكلفة بضاعة - 18,000 مصاريف = <strong style="color: #166534;">12,000 ج.م</strong> (هذا فقط هو الربح القابل للتوزيع).
            </div>
            <div style="margin-top: 6px; font-size: 10.5px;">
                👥 <strong>توزيع الأرباح وحساب الأرصدة (50% لكل منهما):</strong><br/>
                • <strong>الشريك أحمد:</strong> نصيبه من الربح <strong>6,000 ج.م</strong> تضاف لرأس ماله الأصلي ليصبح إجمالي مستحقاته <strong>16,000 ج.م</strong>. فإذا سحب مسحوبات شخصية بـ <strong style="color: #991b1b;">2,000 ج.م</strong>، فإن صافي ما يستلمه كاش عند التخارج هو <strong style="color: #1e3a8a;">14,000 ج.م</strong>.<br/>
                • <strong>الشريك باسم:</strong> نصيبه من الربح <strong>6,000 ج.م</strong> تضاف لرأس ماله الأصلي ليصبح إجمالي مستحقاته <strong>16,000 ج.م</strong>. وبما أنه لم يسحب أي مسحوبات (0 ج.م)، فإن صافي ما يستلمه كاش عند التخارج هو <strong style="color: #1e3a8a;">16,000 ج.م</strong>.
            </div>
            
            <div style="margin-top: 12px; padding: 10px; background: rgba(255, 255, 255, 0.7); border: 1px dashed #fcd34d; border-radius: 6px; font-size: 10px; color: #475569; line-height: 1.5;">
                💡 <strong>توضيح مالي حاسم (كيف تبلغ التكلفة 70 ألف بينما رأس المال 20 ألف فقط؟):</strong><br/>
                السر يكمن في سرعة <strong>دوران رأس المال وتكرار تدويره (Capital Turnover)</strong> خلال الشهر. الشريكان لم يشتريا بضاعة بـ 70,000 ج.م دفعة واحدة، بل قاما بتشغيل الـ 20,000 ج.م الأصلية عدة مرات متتالية:
                <div style="margin-top: 4px; padding-right: 8px; border-right: 1.5px solid #cbd5e1;">
                    • <strong>الأسبوع الأول:</strong> يتم شراء بضاعة بـ 20,000 ج.م كاش وعرضها للبيع (أصبح الكاش 0 ج.م ورأس المال تجسد في بضاعة).<br/>
                    • <strong>الأسبوع الثاني:</strong> عند بيع نصف البضاعة بـ 15,000 ج.م (تكلفة جملتها 10,000 ج.م)، يتم فوراً سحب <strong>10,000 ج.م</strong> وإعادة شراء بضاعة بديلة لملء الرفوف بها مجدداً، مع ترك الـ 5,000 ج.م المتبقية في الخزنة كأرباح معلقة وسيولة تشغيلية.<br/>
                    • <strong>تكرار العملية:</strong> تكرار هذه الدورة (البيع ⬅️ استقطاع قيمة الجملة لشراء بضاعة جديدة فوراً) بمعدل 3 إلى 4 مرات شهرياً يراكم مبيعات بـ 100,000 ج.م وتكلفة بضاعة بـ 70,000 ج.م، مع بقاء قيمة الـ 20,000 ج.م (رأس المال الأصلي) مجمّدة ومستمرة دائماً كبضائع تملأ رفوف المحل في أي وقت لحمايته من التصفية.
                </div>
            </div>

            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #475569; direction: rtl;">
                <span>🛡️ تم إعداد وحفظ حقوق هذا الدليل والمثال المحاسبي بموجب:</span>
                <strong style="color: #1e3a8a; background: #eff6ff; padding: 4px 10px; border-radius: 6px; border: 1px solid #bfdbfe;">سياسة التعامل في التسويق مع شركة عبده ميديا © 2026</strong>
            </div>
        </div>
    </div>
    `;
};

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
        
        @media screen and (max-width: 768px) {
          .report-container { padding: 15px; border-radius: 0; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .report-header { flex-direction: column; align-items: stretch; text-align: center; gap: 15px; }
          .header-titles { text-align: center; }
          .summary-grid { grid-template-columns: 1fr; gap: 10px; }
          .profit-card { width: 100%; text-align: center; }
          table { width: 100%; min-width: 600px; display: table !important; }
          th, td { font-size: 10px; padding: 8px 6px; }
        }

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

import { calculateOrderProfitLoss, calculateCodFee, getLatestProductCost, isBosta, calculateInsuranceFee, calculateBostaVat, getStandardShippingFee, getAdvancePaymentCustodyName, resolveCashHolderName, resolveItemCatalogPrice, findProductInSettings } from './financials';

export const renderFlexShipAndCompensationBadges = (
  order: Order, 
  settings: Settings, 
  showFlexShipAmount: boolean = true
): string => {
  const compFees = settings?.companySpecificFees?.[order.shippingCompany];
  const useCustom = compFees?.useCustomFees ?? false;
  const isPosOrder = order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر' || order.shippingArea === 'نقطة البيع' || (order.id && order.id.startsWith('POS-'));

  const isFlexShipPaid = !isPosOrder && !!(
    order.flexShipFeePaidByCustomer || 
    order.flexShipTransactionAdded || 
    (order.enableFlexShip && order.flexShipFeePaidByCustomer)
  );

  const flexFee = order.flexShipFee ?? (useCustom ? (compFees?.flexShipFee ?? 0) : (settings?.flexShipFee ?? 0));
  const isDelivered = ['تم_توصيلها', 'تم_التوصيل', 'تم_التحصيل', 'مدفوعة', 'تم_الاستبدال'].includes(order.status);

  let badgesHtml = '';

  // 1. FlexShip Status / Badge
  const isFailedOrReturned = [
    "مرتجع",
    "فشل_التوصيل",
    "فشل_التوصيل_معالجة",
    "مرتجع_بعد_الاستلام",
    "مرتجع_جزئي",
    "ملغي",
    "جاري_الاسترجاع",
  ].includes(order.status);

  if (isDelivered && order.enableFlexShip) {
    badgesHtml += `
      <div style="margin-top: 3px; font-size: 8px; background: #f0fdf4; color: #166534; padding: 2px 5px; border-radius: 4px; border: 1px solid #bbf7d0; display: inline-block; font-weight: bold; white-space: nowrap;">
        فليكس شيب: لا ينطبق
      </div>`;
  } else if ((order as any).compensationStatus === 'compensated') {
    badgesHtml += `
      <div style="margin-top: 3px; font-size: 8px; background: #f1f5f9; color: #64748b; padding: 2px 5px; border-radius: 4px; border: 1px solid #cbd5e1; display: inline-block; font-weight: bold; white-space: nowrap;">
        فليكس شيب: غير مستحق
      </div>`;
  } else if (isFlexShipPaid) {
    badgesHtml += `
      <div style="margin-top: 3px; font-size: 8px; background: #e0e7ff; color: #3730a3; padding: 2px 5px; border-radius: 4px; border: 1px solid #c7d2fe; display: inline-block; font-weight: bold; white-space: nowrap;">
        🛡️ معوّض فليكس شيب${showFlexShipAmount ? ` (${flexFee} ج.م)` : ''}
      </div>`;
  } else if (order.enableFlexShip) {
    badgesHtml += `
      <div style="margin-top: 3px; font-size: 8px; background: #ffe4e6; color: #9f1239; padding: 1px 4px; border-radius: 4px; border: 1px dashed #fecdd3; display: inline-block; font-weight: bold; white-space: nowrap;">
        فليكس شيب: غير مدفوع
      </div>`;
  }

  // 2. Shipping Company Compensation Status
  const compStatus = (order as any).compensationStatus;
  const compAmt = Number((order as any).compensationAmount) || 0;
  if (compStatus === 'compensated') {
    badgesHtml += `
      <div style="margin-top: 3px; font-size: 8px; background: #dcfce7; color: #166534; padding: 2px 5px; border-radius: 4px; border: 1px solid #bbf7d0; display: inline-block; font-weight: bold; white-space: nowrap;">
        💵 معوّض شحن (${compAmt.toLocaleString()} ج.م)
      </div>`;
  } else if (compStatus === 'pending') {
    badgesHtml += `
      <div style="margin-top: 3px; font-size: 8px; background: #fef3c7; color: #92400e; padding: 2px 5px; border-radius: 4px; border: 1px solid #fde68a; display: inline-block; font-weight: bold; white-space: nowrap;">
        ⏳ قيد التعويض
      </div>`;
  } else if (compStatus === 'rejected') {
    badgesHtml += `
      <div style="margin-top: 3px; font-size: 8px; background: #ffe4e6; color: #9f1239; padding: 2px 5px; border-radius: 4px; border: 1px solid #fecdd3; display: inline-block; font-weight: bold;">
        ❌ تعويض مرفوض
      </div>`;
  }

  return badgesHtml;
};

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
        
        @media screen and (max-width: 600px) {
          body { padding: 10px; }
          .invoice-container { padding: 15px; border-radius: 0; border: none; overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .header { flex-direction: column; text-align: center; gap: 15px; }
          .invoice-details { flex-direction: column; gap: 20px; text-align: center !important; }
          .detail-group { text-align: center !important; }
          .detail-group p { font-size: 13px; }
          .totals { width: 100%; }
          table { width: 100%; min-width: 500px; display: table !important; font-size: 11px; }
          th, td { padding: 8px 4px !important; }
        }
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

  let completedCount = 0;
  let returnedCount = 0;
  let pendingCount = 0;
  let cancelledCount = 0;

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

    const { net, carrierFees, productCost, closingDifference } = calculateOrderProfitLoss(order, settings);
    
    // Calculate carrier fee breakdown for display
    const manualShippingFee = (order.isManualShippingOverride && order.shippingFee !== undefined) ? order.shippingFee : null;
    const standardShippingFee = manualShippingFee !== null ? manualShippingFee : getStandardShippingFee(order, settings);
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

    const isCompleted = ['تم_التحصيل', 'مدفوعة'].includes(order.status);
    const isReturned = ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'جاري_الاسترجاع', 'فشل_التوصيل_معالجة', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي'].includes(order.status);
    const isPending = ['قيد_الشحن', 'تم_الارسال', 'تم_توصيلها', 'تم_التوصيل'].includes(order.status);
    const isCancelled = order.status === 'ملغي';

    if (isCompleted) completedCount++;
    else if (isReturned) returnedCount++;
    else if (isPending) pendingCount++;
    else if (isCancelled) cancelledCount++;

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

    const whatsappIcon = `
<svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 4px;">
  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
</svg>`;

    return `
      <tr>
        <td>
          <div class="font-bold text-gray-900">${order.customerName}</div>
          <div class="text-[9px] text-gray-500 mt-0.5 flex items-center gap-1">
            <span>#${order.id.slice(0, 8)}</span>
            ${isPosOrder ? `<span style="color: #6366f1; font-weight: 800;">[${posName}]</span>` : ''}
          </div>
          <div style="font-size: 8.5px; color: #475569; margin-top: 2px;">الشركة: <span style="font-weight: bold;">${order.shippingCompany || 'غير محدد'}</span></div>
          ${renderFlexShipAndCompensationBadges(order, settings)}
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
          ${closingDifference < 0 ? `
          <div style="margin-top: 4px; font-size: 8.5px; color: #b91c1c; background: #fee2e2; border: 1px dashed #fecaca; padding: 1.5px 4px; border-radius: 4px; display: inline-block; font-weight: 800; white-space: nowrap;">
            خصم تعديل: ${Math.abs(closingDifference).toLocaleString()} ج.م
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
        <td class="text-center">
          ${['مرتجع', 'فشل_التوصيل', 'فشل_التوصيل_معالجة', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'ملغي', 'جاري_الاسترجاع'].includes(order.status) ? `
            <span class="status-badge" style="background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; display: inline-flex; align-items: center; gap: 4px;">
              <span>بدون تحصيل</span>
            </span>
          ` : order.status === 'ملغي' ? `
            <span class="status-badge" style="background-color: #fff7ed; color: #c2410c; border: 1px solid #fdba74; display: inline-flex; align-items: center; gap: 4px;">
              <span>ملغي</span>
              ${whatsappIcon}
            </span>
          ` : `
            <span class="status-badge" style="${getStatusStyles(order.paymentStatus, 'payment')}">${order.flexShipFeePaidByCustomer ? 'فليكس ✅' : order.paymentStatus}</span>
          `}
        </td>
        <td class="text-center font-bold" style="color: ${net >= 0 ? '#15803d' : '#b91c1c'};" dir="ltr">${net > 0 ? '+' : ''}${net.toLocaleString()} ج.م</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير الطلبات والمبيعات - ${storeName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" crossorigin="anonymous">
      <style>
    @page { size: ${isContinuous ? 'auto' : `A4 ${orientation}`}; margin: ${isContinuous ? '0' : '0.8cm'}; }
        * { box-sizing: border-box; }
        body { 
          font-family: 'Cairo', sans-serif; 
          font-size: 11px; 
          -webkit-print-color-adjust: exact; 
          color-adjust: exact; 
          background-color: ${isContinuous ? '#ffffff' : '#f1f5f9'};
          color: #334155;
          margin: 0;
          padding: ${isContinuous ? '10px' : '24px'};
        }
        .report-container { 
          width: 100%; 
          max-width: ${isContinuous ? '100%' : (orientation === 'landscape' ? '297mm' : '210mm')};
          margin: 0 auto;
          background: #ffffff;
          border-radius: ${isContinuous ? '0' : '24px'};
          box-shadow: ${isContinuous ? 'none' : '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)'};
          padding: ${isContinuous ? '15px' : '32px'};
          border: ${isContinuous ? 'none' : '1px solid #e2e8f0'};
          position: relative;
          overflow: hidden;
        }

        .top-accent-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 6px;
          background: linear-gradient(90deg, #3b82f6 0%, #6366f1 35%, #8b5cf6 65%, #10b981 100%);
        }

        .header-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
          border-bottom: 2px solid #f1f5f9;
          padding-bottom: 20px;
          margin-top: 6px;
        }

        .header-brand-wrap {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .store-logo-icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          color: #38bdf8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .header-title h1 { 
          margin: 0 0 4px 0; 
          color: #0f172a; 
          font-size: 26px; 
          font-weight: 900;
          letter-spacing: -0.02em;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .report-badge-pill {
          font-size: 10px;
          background: #eff6ff;
          color: #2563eb;
          padding: 2px 10px;
          border-radius: 20px;
          border: 1px solid #bfdbfe;
          font-weight: 800;
        }

        .header-title p { 
          margin: 0; 
          font-size: 13.5px; 
          color: #64748b; 
          font-weight: 600;
        }

        .header-meta {
          text-align: right;
          background: #f8fafc;
          padding: 14px 20px;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);
        }

        .header-meta p {
          margin: 0 0 4px 0;
          font-size: 11px;
          color: #475569;
          font-weight: 600;
        }

        .header-meta p strong {
          color: #0f172a;
          font-weight: 800;
        }

        .header-meta p:last-child { margin: 0; }
        
        .summary-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 16px 18px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
          background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%);
        }

        .card::before {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          left: 0;
          height: 4px;
          background: #cbd5e1;
        }

        .card.orders::before { background: linear-gradient(90deg, #6366f1, #818cf8); }
        .card.collection::before { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
        .card.success-rate::before { background: linear-gradient(90deg, #06b6d4, #22d3ee); }
        .card.profit::before { background: linear-gradient(90deg, #10b981, #34d399); }

        .card-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .card-icon-badge {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
        }

        .card.orders .card-icon-badge { background: #e0e7ff; color: #4338ca; }
        .card.collection .card-icon-badge { background: #dbeafe; color: #1d4ed8; }
        .card.success-rate .card-icon-badge { background: #cffaff; color: #0891b2; }
        .card.profit .card-icon-badge { background: #dcfce7; color: #15803d; }

        .card-title {
          font-size: 11px;
          color: #64748b;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .card-value {
          font-size: 20px;
          font-weight: 900;
          color: #0f172a;
          line-height: 1.2;
          margin-bottom: 4px;
        }

        .card-subtext {
          font-size: 10px;
          color: #94a3b8;
          font-weight: 600;
        }

        /* Distribution Analytics Section */
        .distribution-section {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 18px 20px;
          margin-bottom: 28px;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);
        }

        .distribution-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .distribution-title {
          font-size: 13px;
          font-weight: 900;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .distribution-subtitle {
          font-size: 11px;
          color: #64748b;
          font-weight: 600;
        }

        .distribution-bar {
          display: flex;
          height: 24px;
          border-radius: 12px;
          overflow: hidden;
          background: #e2e8f0;
          margin-bottom: 14px;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.06);
          padding: 2px;
        }

        .dist-segment {
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 10px;
          font-weight: 800;
          text-shadow: 0 1px 2px rgba(0,0,0,0.2);
          transition: all 0.3s ease;
          min-width: fit-content;
          padding: 0 8px;
          border-radius: 8px;
        }

        .dist-segment.success { background: linear-gradient(135deg, #10b981, #059669); }
        .dist-segment.pending { background: linear-gradient(135deg, #3b82f6, #2563eb); }
        .dist-segment.returned { background: linear-gradient(135deg, #ef4444, #dc2626); }
        .dist-segment.cancelled { background: linear-gradient(135deg, #64748b, #475569); }
        
        .distribution-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          justify-content: center;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #334155;
          background: #ffffff;
          padding: 4px 12px;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }

        .legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 50px;
        }

        .legend-dot.success { background-color: #10b981; }
        .legend-dot.pending { background-color: #3b82f6; }
        .legend-dot.returned { background-color: #ef4444; }
        .legend-dot.cancelled { background-color: #64748b; }
        
        table { 
          width: 100%; 
          border-collapse: separate; 
          border-spacing: 0;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid #cbd5e1;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
        }

        th, td { 
          padding: 9px 8px; 
          text-align: right; 
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
          font-size: 10px;
          line-height: 1.4;
        }

        th { 
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
          color: #1e293b; 
          font-size: 10.5px; 
          font-weight: 800;
          white-space: nowrap;
          border-bottom: 2px solid #cbd5e1;
          letter-spacing: 0.2px;
        }

        td {
          background-color: #ffffff;
        }

        td:first-child { min-width: 120px; }
        td:nth-child(2) { min-width: 140px; }

        tbody tr:last-child td { border-bottom: none; }
        tbody tr:nth-child(even) td { background-color: #f8fafc; }
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
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 9.5px;
          font-weight: 800;
          white-space: nowrap;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        }
        
        @media screen and (max-width: 768px) {
          body { padding: 10px; }
          .report-container { padding: 15px; border-radius: 0; max-width: 100% !important; overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .header-section { flex-direction: column; gap: 15px; align-items: stretch; text-align: center; }
          .header-meta { text-align: center; }
          .summary-cards { grid-template-columns: 1fr; }
          table { width: 100%; min-width: 800px; display: table !important; }
          th, td { font-size: 10px; padding: 8px 6px; }
        }

        ${getPrintControlBarCSS()}
        
        @media print {
          body { background: white; padding: 0; }
          .report-container { box-shadow: none; padding: 0; border: none; }
          .top-accent-bar { display: none; }
        }
      </style>
    </head>
    <body>
      ${getPrintControlBarHTML('تقرير الطلبات والمبيعات')}
      <div class="report-container">
        <div class="top-accent-bar"></div>
        
        <div class="header-section">
          <div class="header-brand-wrap">
            <div class="store-logo-icon">📊</div>
            <div class="header-title">
              <h1>
                تقرير الطلبات والمبيعات
                <span class="report-badge-pill">تحليل شامل</span>
              </h1>
              <p>متجر "${storeName}"</p>
            </div>
          </div>
          <div class="header-meta">
            ${dateRangeText ? `<p><strong>الفترة:</strong> ${dateRangeText}</p>` : ''}
            <p><strong>تاريخ التقرير:</strong> ${new Date().toLocaleString('ar-EG', { dateStyle: 'long', timeStyle: 'short' })}</p>
            <p><strong>إجمالي الطلبات بالتقرير:</strong> ${orders.length} طلب</p>
          </div>
        </div>
        
        <div class="summary-cards">
          <div class="card orders">
            <div class="card-header-row">
              <div class="card-title">حجم المبيعات والطلبات</div>
              <div class="card-icon-badge">📦</div>
            </div>
            <div class="card-value">${orders.length} <span style="font-size: 13px; font-weight:700; color:#64748b;">طلب</span> / ${totalItems} <span style="font-size: 13px; font-weight:700; color:#64748b;">قطعة</span></div>
            <div class="card-subtext">حجم تداول المنتجات بالوحدات</div>
          </div>
          
          <div class="card collection">
            <div class="card-header-row">
              <div class="card-title">المبالغ للتحصيل</div>
              <div class="card-icon-badge">💵</div>
            </div>
            <div class="card-value">${totalCollectedAmount.toLocaleString()} <span style="font-size: 13px; font-weight:700; color:#64748b;">ج.م</span></div>
            <div class="card-subtext">إجمالي مستحقات قيد التحصيل</div>
          </div>
          
          <div class="card success-rate">
            <div class="card-header-row">
              <div class="card-title">معدل نجاح التوصيل</div>
              <div class="card-icon-badge">🎯</div>
            </div>
            <div class="card-value" style="color: ${(() => {
              const db = orders.length - cancelledCount;
              const rate = db > 0 ? Math.round((completedCount / db) * 100) : 0;
              return rate >= 80 ? '#10b981' : rate >= 50 ? '#3b82f6' : '#ef4444';
            })()};">
              ${(() => {
                const db = orders.length - cancelledCount;
                return db > 0 ? Math.round((completedCount / db) * 100) : 0;
              })()}%
            </div>
            <div class="card-subtext">الطلبات المسلمة والمدفوعة بنجاح</div>
          </div>
          
          <div class="card profit">
            <div class="card-header-row">
              <div class="card-title">صافي الربح / الخسارة</div>
              <div class="card-icon-badge">📈</div>
            </div>
            <div class="card-value" style="color: ${totalProfit >= 0 ? '#10b981' : '#ef4444'}" dir="ltr">${totalProfit > 0 ? '+' : ''}${totalProfit.toLocaleString()} <span style="font-size: 13px; font-weight:700; color:#64748b;">ج.م</span></div>
            <div class="card-subtext">العائد الفعلي الصافي للمتجر</div>
          </div>
        </div>

        ${(() => {
          const totalWithStatus = completedCount + returnedCount + pendingCount + cancelledCount;
          const completedPercent = totalWithStatus > 0 ? Math.round((completedCount / totalWithStatus) * 100) : 0;
          const returnedPercent = totalWithStatus > 0 ? Math.round((returnedCount / totalWithStatus) * 100) : 0;
          const pendingPercent = totalWithStatus > 0 ? Math.round((pendingCount / totalWithStatus) * 100) : 0;
          const cancelledPercent = totalWithStatus > 0 ? Math.round((cancelledCount / totalWithStatus) * 100) : 0;

          return `
          <div class="distribution-section">
            <div class="distribution-header">
              <span class="distribution-title">
                <span>⚡</span>
                شريط التحليل وتوزيع حالات التوصيل
              </span>
              <span class="distribution-subtitle">مؤشرات دقيقة لتتبع كفاءة عمليات الشحن</span>
            </div>
            <div class="distribution-bar">
              ${completedPercent > 0 ? `<div class="dist-segment success" style="width: ${completedPercent}%" title="تم التحصيل: ${completedPercent}%">تم التحصيل ${completedPercent}%</div>` : ''}
              ${pendingPercent > 0 ? `<div class="dist-segment pending" style="width: ${pendingPercent}%" title="قيد التوصيل: ${pendingPercent}%">قيد الشحن ${pendingPercent}%</div>` : ''}
              ${returnedPercent > 0 ? `<div class="dist-segment returned" style="width: ${returnedPercent}%" title="مرتجع/فشل: ${returnedPercent}%">مرتجع/فشل ${returnedPercent}%</div>` : ''}
              ${cancelledPercent > 0 ? `<div class="dist-segment cancelled" style="width: ${cancelledPercent}%" title="ملغي: ${cancelledPercent}%">ملغي ${cancelledPercent}%</div>` : ''}
            </div>
            <div class="distribution-legend">
              <div class="legend-item"><span class="legend-dot success"></span>تم التحصيل والتوصيل (${completedCount} طلب)</div>
              <div class="legend-item"><span class="legend-dot pending"></span>قيد الشحن والتسليم (${pendingCount} طلب)</div>
              <div class="legend-item"><span class="legend-dot returned"></span>مرتجع / فشل التوصيل (${returnedCount} طلب)</div>
              <div class="legend-item"><span class="legend-dot cancelled"></span>ملغى (${cancelledCount} طلب)</div>
            </div>
          </div>
          `;
        })()}

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
            <tr class="total-row" style="background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%); color: #ffffff; font-weight: bold; border-top: 3px solid #3b82f6;">
              <td colspan="2" class="text-right font-bold" style="background: transparent; color: #ffffff; font-size: 11px; padding: 12px 10px;">🏆 الإجمالي الكلي بالتقرير</td>
              <td class="text-center" style="background: transparent; color: #cbd5e1; font-size: 11px;">${sumProductPrice.toLocaleString()}</td>
              <td class="text-center" style="background: transparent; color: #cbd5e1; font-size: 11px;">${sumProductCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
              <td class="text-center" style="background: transparent; color: #38bdf8; font-weight: 800; font-size: 11px;">${totalItems}</td>
              <td class="text-center font-bold" style="background: transparent; color: #cbd5e1; font-size: 11px;">${sumShippingCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
              <td class="text-center font-bold" style="background: transparent; color: #fbbf24; font-size: 11px;">${sumCollectionAmount.toLocaleString()} ج.م</td>
              <td class="text-center font-bold" style="background: transparent; color: #ffffff; font-size: 11px;">${sumInvoiceTotal.toLocaleString()} ج.م</td>
              <td style="background: transparent;"></td>
              <td style="background: transparent;"></td>
              <td class="text-center font-bold" style="background: transparent; color: ${totalProfit >= 0 ? '#4ade80' : '#f87171'}; font-size: 11px;" dir="ltr">${totalProfit > 0 ? '+' : ''}${totalProfit.toLocaleString()} ج.م</td>
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
                <td>
                  <div class="font-bold text-gray-900">${order.customerName}</div>
                  <div style="font-size: 8.5px; color: #475569; margin-top: 2px;">الشركة: <span style="font-weight: bold;">${order.shippingCompany || 'غير محدد'}</span></div>
                  ${renderFlexShipAndCompensationBadges(order, settings)}
                </td>
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
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" crossorigin="anonymous">
      <style>
    @page { size: ${isContinuous ? 'auto' : `A4 ${orientation}`}; margin: ${isContinuous ? '0' : '0.8cm'}; }
        * { box-sizing: border-box; }
        body { 
          font-family: 'Cairo', sans-serif; 
          font-size: 11px; 
          -webkit-print-color-adjust: exact; 
          color-adjust: exact; 
          background-color: ${isContinuous ? '#ffffff' : '#f4f6fa'};
          color: #334155;
          margin: 0;
          padding: ${isContinuous ? '10px' : '24px'};
        }
        .report-container { 
          width: 100%; 
          max-width: ${isContinuous ? '100%' : (orientation === 'landscape' ? '297mm' : '210mm')};
          margin: 0 auto;
          background: white;
          border-radius: ${isContinuous ? '0' : '24px'};
          box-shadow: ${isContinuous ? 'none' : '0 10px 30px -5px rgba(0, 0, 0, 0.04), 0 4px 12px -2px rgba(0, 0, 0, 0.01)'};
          padding: ${isContinuous ? '15px' : '24px'};
          border: ${isContinuous ? 'none' : '1px solid #e2e8f0'};
        }
        .header-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #f1f5f9;
          padding-bottom: 24px;
        }
        .header-title h1 { 
          margin: 0 0 6px 0; 
          color: #0f172a; 
          font-size: 26px; 
          font-weight: 900;
          letter-spacing: -0.02em;
        }
        .header-title p { 
          margin: 0; 
          font-size: 14px; 
          color: #64748b; 
          font-weight: 600;
        }
        .header-meta {
          text-align: right;
          background: #f8fafc;
          padding: 16px 20px;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);
        }
        .header-meta p {
          margin: 0 0 6px 0;
          font-size: 11.5px;
          color: #475569;
          font-weight: 600;
        }
        .header-meta p strong {
          color: #0f172a;
          font-weight: 800;
        }
        .header-meta p:last-child { margin: 0; }
        
        .summary-cards {
          display: flex;
          gap: 20px;
          margin-bottom: 30px;
        }
        .card {
          flex: 1;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 20px 24px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
          border-right: 5px solid #8b5cf6;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .card.profit { border-right-color: #10b981; }
        .card.orders { border-right-color: #6366f1; }
        .card-title {
          font-size: 11.5px;
          color: #64748b;
          margin-bottom: 8px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .card-value {
          font-size: 22px;
          font-weight: 900;
          color: #0f172a;
          line-height: 1.2;
        }
        
        table { 
          width: 100%; 
          border-collapse: separate; 
          border-spacing: 0;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.01);
        }
        th, td { 
          padding: 8px 6px; 
          text-align: right; 
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
          font-size: 10px;
          line-height: 1.4;
        }
        th { 
          background-color: #f8fafc; 
          color: #475569; 
          font-size: 10px; 
          font-weight: 800;
          white-space: nowrap;
          border-bottom: 2px solid #cbd5e1;
        }
        td {
          background-color: #ffffff;
        }
        td:first-child { min-width: 110px; }
        td:nth-child(2) { min-width: 130px; }
        tbody tr:last-child td { border-bottom: none; }
        tbody tr:nth-child(even) td { background-color: #fafbfc; }
        tbody tr:hover td { background-color: #f1f5f9; }
        
        .font-bold { font-weight: 700; }
        .font-medium { font-weight: 600; }
        .text-gray-900 { color: #0f172a; }
        .text-gray-600 { color: #475569; }
        .text-gray-500 { color: #64748b; }
        .text-center { text-align: center; }
        
        @media screen and (max-width: 768px) {
          body { padding: 10px; }
          .report-container { padding: 15px; border-radius: 0; max-width: 100% !important; overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .header-section { flex-direction: column; gap: 15px; align-items: stretch; text-align: center; }
          .header-meta { text-align: center; }
          .summary-cards { flex-direction: column; }
          .card { border-right: none; border-bottom: 4px solid #8b5cf6; }
          .card.profit { border-bottom-color: #10b981; }
          .card.orders { border-bottom-color: #6366f1; }
          table { width: 100%; min-width: 800px; display: table !important; }
          th, td { font-size: 10px; padding: 8px 6px; }
        }

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
    const { allTimeNetProfit, undistributedProfit, distributedProfit, totals, partnerDetails = [] } = stats;

    const netLoans = (totals.loans || 0) - (totals.repayments || 0);
    const totalAdvances = totals.advances || 0;
    const totalPosSales = totals.posSales || 0;
    const totalCapital = totals.capital || 0;
    const totalPartnerBalances = partnerDetails.reduce((acc: number, p: any) => acc + (p.balance || 0), 0);
    const docId = `PTR-${Math.floor(100000 + Math.random() * 900000)}`;

    return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير الشركاء والمركز المالي - ${storeName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet" crossorigin="anonymous">
      <style>
        @page { 
          size: ${isContinuous ? 'auto' : (orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait')}; 
          margin: ${isContinuous ? '0' : '1.2cm'}; 
        }
        * { box-sizing: border-box; }
        body { 
          font-family: 'Cairo', sans-serif; 
          font-size: 12px; 
          color: #0f172a; 
          line-height: 1.5;
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
          box-shadow: ${isContinuous ? '0 10px 25px -5px rgba(0,0,0,0.08)' : 'none'};
        }
        @media print {
            body { background-color: #ffffff; }
            .report-wrapper { padding: 0; }
            .report-container { padding: 0; box-shadow: none; border-radius: 0; max-width: 100%; margin: 0; }
        }
        .report-header { 
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 24px; border-bottom: 2px solid #4f46e5; padding-bottom: 18px;
        }
        .header-titles h1 { margin: 0 0 6px 0; font-size: 24px; color: #1e1b4b; font-weight: 900; letter-spacing: -0.5px; }
        .header-titles .subtitle { margin: 0; font-size: 14px; color: #475569; font-weight: 700; display: flex; align-items: center; gap: 8px; }
        .header-titles .date { margin: 6px 0 0 0; font-size: 11px; color: #64748b; }
        
        .header-badge-box {
            text-align: left;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 8px;
        }

        .doc-badge {
            background: #e0e7ff;
            color: #3730a3;
            font-size: 10px;
            font-weight: 800;
            padding: 4px 10px;
            border-radius: 20px;
            letter-spacing: 0.5px;
            border: 1px solid #c7d2fe;
        }

        .profit-card {
            background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
            color: #ffffff;
            padding: 12px 22px; 
            border-radius: 14px; 
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
            text-align: right;
            min-width: 220px;
        }
        .profit-card p { margin: 0; }
        .profit-card .label { font-size: 11px; color: #c7d2fe; font-weight: 700; margin-bottom: 2px; }
        .profit-card .amount { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }

        .summary-grid {
          display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 24px;
        }
        .summary-card {
          padding: 14px; border-radius: 12px; background: #ffffff; border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .summary-card::before {
          content: ''; position: absolute; top: 0; right: 0; left: 0; height: 3px;
          background: #cbd5e1;
        }
        .summary-card.blue::before { background: #3b82f6; }
        .summary-card.green::before { background: #10b981; }
        .summary-card.amber::before { background: #f59e0b; }
        .summary-card.red::before { background: #ef4444; }
        .summary-card.teal::before { background: #14b8a6; }
        .summary-card.indigo::before { background: #6366f1; }

        .summary-card .title { font-size: 11px; color: #64748b; font-weight: 700; margin-bottom: 6px; }
        .summary-card .value { font-size: 16px; font-weight: 900; color: #0f172a; }
        .value.red { color: #e11d48; }
        .value.green { color: #059669; }
        .value.orange { color: #d97706; }

        @media screen and (max-width: 768px) {
          .report-container { padding: 15px; border-radius: 0; max-width: 100% !important; overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .report-header { flex-direction: column; align-items: stretch; text-align: center; gap: 15px; }
          .header-titles { text-align: center; }
          .header-badge-box { align-items: center; }
          .summary-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .profit-card { width: 100%; text-align: center; }
          table { width: 100%; min-width: 650px; display: table !important; }
          th, td { font-size: 10px; padding: 8px 6px; }
        }

        .section-title-wrap {
            margin-bottom: 14px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .section-title { font-size: 15px; font-weight: 800; color: #1e293b; margin: 0; }
        .section-tag { font-size: 11px; font-weight: 700; color: #6366f1; background: #e0e7ff; px: 10px; padding: 3px 8px; border-radius: 6px; }

        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px; }
        th, td { border: 1px solid #e2e8f0; padding: 10px 12px; text-align: right; }
        th { background-color: #f1f5f9; font-weight: 800; color: #334155; }
        tbody tr:nth-child(even) { background-color: #f8fafc; }
        tbody tr:hover { background-color: #f1f5f9; }
        tfoot tr { background-color: #e2e8f0; font-weight: 900; color: #0f172a; }
        
        .pill { display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 10px; font-weight: 800; }
        .pill.positive { background-color: #d1fae5; color: #059669; }
        .pill.negative { background-color: #ffe4e6; color: #e11d48; }
        .pill.neutral { background-color: #f1f5f9; color: #475569; }
        .pill.blue { background-color: #dbeafe; color: #2563eb; }
        
        .progress-bar-wrap { background: #e2e8f0; height: 6px; border-radius: 3px; overflow: hidden; width: 60px; display: inline-block; vertical-align: middle; margin-right: 6px; }
        .progress-bar-fill { background: #4f46e5; height: 100%; border-radius: 3px; }

        .font-mono { font-family: 'Courier New', Courier, monospace; font-size: 12px; font-weight: 700; }

        .audit-footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 2px dashed #cbd5e1;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          text-align: center;
        }
        .signature-box {
          border: 1px border-dashed #cbd5e1;
          padding: 12px;
          border-radius: 8px;
          background: #fafafa;
        }
        .signature-box .title { font-weight: 800; font-size: 11px; color: #475569; margin-bottom: 25px; }
        .signature-box .line { border-bottom: 1px dashed #94a3b8; width: 70%; margin: 0 auto 6px auto; }
        .signature-box .sub { font-size: 10px; color: #94a3b8; }

        .seal-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 2px dashed #818cf8;
          border-radius: 12px;
          padding: 8px;
          background: #eef2ff;
        }
        .seal-title { font-size: 11px; font-weight: 900; color: #3730a3; }
        .seal-sub { font-size: 9px; color: #6366f1; font-family: monospace; }

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
              <p class="subtitle">
                <span>🏛️ تقرير الشركاء والمركز المالي الرسمي</span>
              </p>
              <p class="date">
                ${dateRangeText ? `<strong style="color: #4f46e5;">الفترة المحددة: ${dateRangeText}</strong> | ` : ''}
                تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div class="header-badge-box">
               <span class="doc-badge">رقم الوثيقة: ${docId}</span>
               <div class="profit-card">
                    <p class="label">إجمالي صافي الربح التاريخي</p>
                    <p class="amount">${allTimeNetProfit.toLocaleString('ar-EG')} ج.م</p>
               </div>
            </div>
          </div>

          ${getAccountingCycleExplanationHTML()}

          <div class="summary-grid">
            <div class="summary-card blue">
              <div class="title">إجمالي رأس المال المودع</div>
              <div class="value">${totalCapital.toLocaleString('ar-EG')} ج.م</div>
            </div>
            <div class="summary-card green">
              <div class="title">الأرباح الموزعة والمستلمة</div>
              <div class="value green">${distributedProfit.toLocaleString('ar-EG')} ج.م</div>
            </div>
            <div class="summary-card amber">
              <div class="title">الأرباح القابلة للتوزيع</div>
              <div class="value orange">${undistributedProfit.toLocaleString('ar-EG')} ج.م</div>
            </div>
            <div class="summary-card red">
              <div class="title">إجمالي السلف القائمة</div>
              <div class="value red">${netLoans.toLocaleString('ar-EG')} ج.م</div>
            </div>
            <div class="summary-card teal">
              <div class="title">عربونات المبيعات المحصلة</div>
              <div class="value" style="color: #0d9488;">${totalAdvances.toLocaleString('ar-EG')} ج.م</div>
            </div>
            <div class="summary-card indigo">
              <div class="title">عهد مبيعات (POS)</div>
              <div class="value" style="color: #6366f1;">${totalPosSales.toLocaleString('ar-EG')} ج.م</div>
            </div>
          </div>

          <div class="section-title-wrap">
            <h2 class="section-title">بيان المركز المالي لكل شريك والذمم المالية</h2>
            <span class="section-tag">${partnerDetails.length} شركاء مسجلين</span>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">#</th>
                <th>اسم الشريك</th>
                <th style="text-align: center;">نسبة الأرباح</th>
                <th style="text-align: left;">رأس المال</th>
                <th style="text-align: left;">أرباح موزعة</th>
                <th style="text-align: left;">أرباح متبقية</th>
                <th style="text-align: left;">سحوبات شخصية</th>
                <th style="text-align: left;">السلف القائمة</th>
                <th style="text-align: left;">العربونات</th>
                <th style="text-align: left;">عهد المبيعات (POS)</th>
                <th style="text-align: left;">صافي الرصيد النهائية</th>
                <th style="text-align: center;">الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${partnerDetails.length === 0 ? '<tr><td colspan="12" style="text-align: center; padding: 30px; color: #94a3b8; font-weight: 600;">لا يوجد شركاء مسجلين حالياً.</td></tr>' : partnerDetails.map((p: any, idx: number) => {
                const partnerNetLoan = (p.loans || 0) - (p.repayments || 0);
                const isPositive = p.balance >= 0;
                const remProfit = p.profitShare !== undefined ? p.profitShare : Math.max(0, ((p.profitRatio / 100) * (stats.allTimeNetProfit || 0)) - (p.distributions || 0));
                return `
                <tr>
                  <td style="text-align: center; color: #94a3b8; font-weight: 700;">${idx + 1}</td>
                  <td style="font-weight: 800; color: #0f172a;">${p.name}</td>
                  <td style="text-align: center;">
                    <span class="pill blue">${p.profitRatio}%</span>
                    <div class="progress-bar-wrap">
                      <div class="progress-bar-fill" style="width: ${Math.min(100, p.profitRatio)}%;"></div>
                    </div>
                  </td>
                  <td class="font-mono" style="text-align: left;">${(p.capital || 0).toLocaleString('ar-EG')}</td>
                  <td class="font-mono green" style="text-align: left;">+${(p.distributions || 0).toLocaleString('ar-EG')}</td>
                  <td class="font-mono" style="text-align: left; color: ${remProfit > 0 ? '#d97706' : '#64748b'};">${remProfit > 0 ? '+' + remProfit.toLocaleString('ar-EG') : '0 (مصفّر)'}</td>
                  <td class="font-mono orange" style="text-align: left;">-${(p.withdrawals || 0).toLocaleString('ar-EG')}</td>
                  <td class="font-mono red" style="text-align: left;">${partnerNetLoan.toLocaleString('ar-EG')}</td>
                  <td class="font-mono" style="text-align: left; color: #0d9488;">${(p.advances || 0).toLocaleString('ar-EG')}</td>
                  <td class="font-mono" style="text-align: left; color: #4f46e5;">${(p.posSales || 0).toLocaleString('ar-EG')}</td>
                  <td class="font-mono" style="text-align: left; font-size: 13px; font-weight: 900; color: ${isPositive ? '#059669' : '#e11d48'};">
                    ${(p.balance || 0).toLocaleString('ar-EG')} ج.م
                  </td>
                  <td style="text-align: center;">
                    <span class="pill ${isPositive ? 'positive' : 'negative'}">
                      ${isPositive ? 'رصيد دائن' : 'مديونية قائمة'}
                    </span>
                  </td>
                </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="text-align: right;">المجموع الإجمالي الشامل:</td>
                <td class="font-mono" style="text-align: left;">${totalCapital.toLocaleString('ar-EG')}</td>
                <td class="font-mono green" style="text-align: left;">+${distributedProfit.toLocaleString('ar-EG')}</td>
                <td class="font-mono" style="text-align: left; color: ${undistributedProfit > 0 ? '#d97706' : '#64748b'};">${undistributedProfit > 0 ? '+' + undistributedProfit.toLocaleString('ar-EG') : '0 (مصفّر)'}</td>
                <td class="font-mono" style="text-align: left;">-</td>
                <td class="font-mono red" style="text-align: left;">${netLoans.toLocaleString('ar-EG')}</td>
                <td class="font-mono" style="text-align: left; color: #0d9488;">${totalAdvances.toLocaleString('ar-EG')}</td>
                <td class="font-mono" style="text-align: left; color: #4f46e5;">${totalPosSales.toLocaleString('ar-EG')}</td>
                <td class="font-mono" style="text-align: left; font-size: 13px; font-weight: 900;">${totalPartnerBalances.toLocaleString('ar-EG')} ج.م</td>
                <td style="text-align: center;">✓ ميزانية متزنة</td>
              </tr>
            </tfoot>
          </table>

          <div style="margin-top: -12px; margin-bottom: 24px; padding: 14px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; display: flex; align-items: start; gap: 10px; direction: rtl;">
            <div style="color: #6366f1; font-size: 16px; margin-top: -2px;">💡</div>
            <div style="font-size: 11px; line-height: 1.6; color: #475569; font-weight: 500; text-align: right; width: 100%;">
              <strong style="color: #1e293b; font-weight: 800; display: block; margin-bottom: 4px; font-size: 11.5px;">توضيح مالي هام بخصوص العهد والذمم القائمة:</strong>
              مبالغ <span style="color: #0d9488; font-weight: 700; background: #f0fdf4; padding: 1px 4px; border-radius: 4px; border: 1px solid #ccfbf1;">العربونات المحصلة</span> و<span style="color: #4f46e5; font-weight: 700; background: #eef2ff; padding: 1px 4px; border-radius: 4px; border: 1px solid #e0e7ff;">عهد المبيعات (POS)</span> الموضحة أعلاه هي مبالغ وعهد مؤقتة في حوزة الشركاء لغرض تسوية طلبات العملاء وتحصيلها، وليست <strong style="color: #f59e0b;">سحوبات شخصية</strong> مقتطعة نهائياً من مستحقاتهم أو حصتهم في رأس المال، ولا تؤثر كخصم قطعي أو تقليل للملاءة المالية للشركاء إلا في حال تسويتها رسمياً مع الطلبات أو قيدها وتوثيقها كـ <strong style="color: #4f46e5;">سحوبات شخصية</strong>.
            </div>
          </div>

          <!-- توضيح محاسبي تعليمي مبسط مع مثال بالأرقام -->
          <div style="background: #f0f5ff; border: 1px solid #c7d2fe; border-radius: 6px; padding: 12px; margin-bottom: 15px; line-height: 1.5; font-size: 11px; color: #1e293b; text-align: right; direction: rtl;">
              <strong style="color: #4338ca; font-size: 12px; display: block; margin-bottom: 4px;">💡 توضيح محاسبي هام: كيف يتم احتساب مستحقات التصفية؟</strong>
              تتم التصفية وحساب حقوق كل شريك بناءً على <strong style="color: #4338ca;">الربح الصافي الفعلي</strong> المضاف إلى <strong style="color: #4338ca;">رأس المال المستثمر</strong>، وليس بناءً على مبالغ التحصيل (المبيعات الإجمالية):
              <div style="margin: 4px 0; padding-right: 12px;">
                  • <strong>رأس المال الأصلي:</strong> يظل ثابتاً كما هو دون مساس (لأنه يمثل قيمة الأصول والأساس الذي يمتلكه الشريك).<br/>
                  • <strong>الأرباح الصافية (هي التي تُوزع):</strong> الربح الصافي هو ما يتبقى من المبيعات بعد خصم تكلفة البضاعة المباعة بسعر الجملة وكافة المصاريف والتشغيل.<br/>
                  • <strong>مبالغ التحصيل (لا تُوزع):</strong> لا يجوز تقسيم المبيعات الإجمالية; لأنها تشتمل على ثمن البضاعة الأصلي وتكلفة التشغيل، وتوزيعها يعني خسارة وتآكل رأس مال المتجر بالكامل.
              </div>
              <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 10px; margin-top: 6px; font-size: 10px; color: #78350f; line-height: 1.5;">
                  <strong>📝 مثال توضيحي عملي بالأرقام لشريكين (أحمد وباسم):</strong><br/>
                  نفترض أن <strong>أحمد</strong> و<strong>باسم</strong> أسسا محلاً تجارياً بالتساوي (بنسبة 50% لكل منهما):<br/>
                  • <strong>رأس المال:</strong> ساهم كل منهما بـ <strong>10,000 ج.م</strong> (إجمالي 20,000 ج.م لشراء البضاعة).<br/>
                  • <strong>مبيعات المحل الإجمالية:</strong> بلغت <strong>100,000 ج.م</strong>، بينما بلغت <strong>تكلفة البضاعة والمصاريف بالكامل 88,000 ج.م</strong> (منها 70,000 ج.م ثمن بضاعة الجملة لإعادة تدويرها + 18,000 ج.م مصاريف تشغيل وشحن).<br/>
                  • <strong>الربح الصافي الفعلي:</strong> هو <strong style="color: #166534;">12,000 ج.م</strong> فقط (وليس 100,000 ج.م مبيعات!).<br/>
                  • <strong>الشريك أحمد (سحب 2,000 ج.م):</strong> نصيبه من الأرباح 6,000 ج.م، يضاف لرأس ماله الأصلي ليصبح مستحقاته 16,000 ج.م، وبعد خصم مسحوباته، يستلم كاش <strong style="color: #1e3a8a;">14,000 ج.م</strong> عند التخارج.<br/>
                  • <strong>الشريك باسم (لم يسحب شيئاً):</strong> نصيبه 6,000 ج.م، ومستحقاته 16,000 ج.م، وبما أن مسحوباته 0 ج.م، يستلم كاش <strong style="color: #1e3a8a;">16,000 ج.م</strong> عند التخارج.
                  
                  <div style="margin-top: 8px; padding: 6px 8px; background: rgba(255, 255, 255, 0.7); border: 1px dashed #cbd5e1; border-radius: 4px; font-size: 9.5px; color: #475569; line-height: 1.4;">
                      💡 <strong>توضيح مالي هام (كيف تبلغ التكلفة 70 ألف بينما رأس المال 20 ألف فقط؟):</strong><br/>
                      السبب هو <strong>دوران رأس المال (Capital Turnover)</strong>. الشريكان لم يشتريا بضاعة بـ 70,000 ج.م دفعة واحدة، بل قاما بتشغيل الـ 20,000 ج.م الأصلية عدة مرات متتالية (يشترون بضاعة ⬅️ يبيعونها بـ 15 ألف مثلاً ⬅️ يستقطعون تكلفة الجملة 10 آلاف لإعادة شراء بضاعة فوراً ⬅️ يكررون الدورة 3-4 مرات شهرياً)، مما يراكم مبيعات بـ 100 ألف وتكلفة بـ 70 ألف، مع الحفاظ على قيمة الـ 20,000 ج.م الأصلية كبضائع مستمرة على الرفوف.
                  </div>

                  <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #cbd5e1; text-align: left; font-size: 9px; color: #475569;">
                      🛡️ تم التوثيق والاعتماد بموجب: <strong style="color: #1e3a8a;">سياسة التعامل في التسويق مع شركة عبده ميديا © 2026</strong>
                  </div>
              </div>
          </div>

          <!-- صيغ وتوضيح التصفية الفردية للشركاء في تقرير الشركاء -->
          <div style="margin-top: 15px; display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; margin-bottom: 20px; direction: rtl;">
              ${partnerDetails.map((p: any) => {
                  const capital = p.capital || 0;
                  const remProfit = p.profitShare !== undefined ? p.profitShare : Math.max(0, ((p.profitRatio / 100) * (allTimeNetProfit || 0)) - (p.distributions || 0));
                  const profits = (p.distributions || 0) + remProfit;
                  const totalRights = capital + profits;
                  const withdrawals = p.withdrawals || 0;
                  const netCash = p.balance || 0;
                  const otherPartnerNames = partnerDetails.filter((o: any) => o.name !== p.name).map((o: any) => o.name).join(' أو ') || 'الشريك المستمر';

                  return `
                      <div style="background: #ffffff; border: 1px solid #fde68a; border-radius: 6px; padding: 12px; font-size: 11px; color: #1e293b; text-align: right; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                          <div style="font-weight: bold; color: #92400e; font-size: 12px; margin-bottom: 6px; border-bottom: 1px solid #fef3c7; padding-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
                              <span>🤝 إرشاد وصيغة التخارج الشفاف للشريك: <strong>${p.name}</strong></span>
                              <span style="font-size: 9px; color: #b45309; background: #fef3c7; padding: 1px 6px; border-radius: 4px; font-weight: bold;">تصفية ودية آمنة</span>
                          </div>

                          <!-- 1. التصفية كاش -->
                          <div style="background: #fffdf5; border-right: 3px solid #f59e0b; padding: 8px 10px; border-radius: 4px; line-height: 1.7; margin-bottom: 8px;">
                              <strong style="color: #92400e; font-size: 11px; display: block; margin-bottom: 2px;">💵 خيار 1: التصفية والتخارج النقدي (الكاش):</strong>
                              "يا <strong>${p.name}</strong>، عشان نصلّي على النبي ونصفّي الحساب بينّا بكل أمانة ووضوح:<br/>
                              • إنت ليك رأس مال <strong>${capital.toLocaleString('ar-EG')} ج.م.</strong><br/>
                              • وليك أرباح موزعة وغير موزعة إجماليتها <strong>${profits.toLocaleString('ar-EG')} ج.م.</strong><br/>
                              • يبقى إجمالي حقك بالكامل <strong>${totalRights.toLocaleString('ar-EG')} ج.م.</strong><br/>
                              • نخصم منهم المسحوبات الشخصية والتسويات اللي سحبتها خلال الفترة بـ <strong style="color: #dc2626;">${withdrawals.toLocaleString('ar-EG')} ج.م.</strong><br/>
                              💰 <strong style="color: #1e293b;">يبقى صافي الفلوس اللي تدريجياً أو كاش بتاخدها في إيدك وتخرج بالخير هي: <span style="color: #15803d; font-size: 12px; background: #dcfce7; padding: 1px 6px; border-radius: 4px; font-family: monospace;">${netCash.toLocaleString('ar-EG')} ج.م</span></strong>"
                          </div>

                          <!-- 2. شراء وحساب الحصة للشريك المشتري -->
                          <div style="background: #faf5ff; border-right: 3px solid #a855f7; padding: 8px 10px; border-radius: 4px; line-height: 1.6;">
                              <strong style="color: #6b21a8; font-size: 11px; display: block; margin-bottom: 2px;">🛍️ خيار 2: شراء واستحواذ الشريك المستمر على حصة البضاعة والمتجر بالكامل:</strong>
                              • في حال رغبة الشريك المشتري <strong>(${otherPartnerNames})</strong> في تملك كافة البضاعة والمتجر بالكامل:<br/>
                              🤝 <strong>صيغة الاتفاق والشراء:</strong> يدفع الشريك المشتري لـ <strong>${p.name}</strong> مبلغ كاش صافي مستحقاته قدره <strong style="color: #15803d; background: #dcfce7; padding: 1px 6px; border-radius: 3px; font-family: monospace;">${netCash.toLocaleString('ar-EG')} ج.م</strong> مقابل شراء كافة حقوقه وحصته بالبضاعة وتنازل الشريك <strong>${p.name}</strong> وتخارجه وتملك الشريك المشتري للمتجر بالكامل.
                          </div>
                      </div>
                  `;
              }).join('')}
          </div>

          <div class="audit-footer">
            <div class="signature-box">
              <div class="title">توقيع المحاسب القانوني</div>
              <div class="line"></div>
              <div class="sub">الإدارة المالية والتدقيق</div>
            </div>
            
            <div class="seal-box">
              <div class="seal-title">ختم الاعتماد المالي الرسمي</div>
              <div class="seal-sub">VERIFIED FINANCIAL REPORT</div>
              <div style="font-size: 8px; color: #64748b; margin-top: 4px;">كود المصادقة: ${docId}</div>
            </div>

            <div class="signature-box">
              <div class="title">اعتماد الشريك المدير</div>
              <div class="line"></div>
              <div class="sub">إدارة المبيعات والشركاء</div>
            </div>
          </div>
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

    let returnedCount = 0;
    let failedCount = 0;
    let cancelledCount = 0;
    let otherCount = 0;

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
        const { loss, net, closingDifference } = calculateOrderProfitLoss(order, settings);
        const actualLoss = loss > 0 ? loss : (net < 0 ? Math.abs(net) : 0);
        totalLoss += actualLoss;
        totalProductPrice += order.productPrice;
        totalShippingFee += order.shippingFee;
        totalInsuranceInspection += (insuranceFee + inspectionCost + bostaVat);
        totalProductCost += order.productCost;

        const st = order.status;
        if (['مرتجع', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'جاري_الاسترجاع'].includes(st)) {
          returnedCount++;
        } else if (['فشل_التوصيل', 'فشل_التوصيل_معالجة', 'تمت_الاعادة_لشركة_الشحن'].includes(st)) {
          failedCount++;
        } else if (st === 'ملغي') {
          cancelledCount++;
        } else {
          otherCount++;
        }

    const whatsappIcon = `
<svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; margin-right: 4px;">
  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
</svg>`;

        const products = order.items.map(i => i.name).join(' + ') || order.productName;
        const quantities = order.items.map(i => i.quantity).join(' + ') || '1';
        const prices = order.items.map(i => i.price.toLocaleString()).join(' + ') || order.productPrice.toLocaleString();
        const discountHtml = `
          ${order.discount > 0 ? `
          <div style="margin-top: 4px; font-size: 8px; color: #b91c1c; background: #fee2e2; border: 1px dashed #fecaca; padding: 1.5px 3px; border-radius: 4px; display: inline-block; font-weight: bold; white-space: nowrap;">
            خصم: ${order.discount.toLocaleString()} ج.م
          </div>
          ` : ''}
          ${closingDifference < 0 ? `
          <div style="margin-top: 4px; font-size: 8px; color: #b91c1c; background: #fee2e2; border: 1px dashed #fecaca; padding: 1.5px 3px; border-radius: 4px; display: inline-block; font-weight: bold; white-space: nowrap;">
            خصم تعديل: ${Math.abs(closingDifference).toLocaleString()} ج.م
          </div>
          ` : ''}
        `;
        
        return `
            <tr>
                <td style="padding: 9px 8px;">
                  <div style="font-weight: 800; color: #0f172a; font-size: 11px;">${order.customerName}</div>
                  <div style="font-size: 9px; color: #64748b; margin-top: 2px;">الشركة: <span style="font-weight: 700; color: #334155;">${order.shippingCompany || 'غير محدد'}</span></div>
                  ${renderFlexShipAndCompensationBadges(order, settings)}
                </td>
                <td style="padding: 9px 8px;">${products}</td>
                <td style="padding: 9px 8px; text-align: center; font-weight: 700;">${quantities}</td>
                <td style="padding: 9px 8px;">
                  <div style="font-weight: 700;">${prices}</div>
                  ${discountHtml}
                </td>
                <td style="padding: 9px 8px; font-weight: 700; color: #ef4444;">${order.shippingFee.toLocaleString()}</td>
                <td style="padding: 9px 8px;">${(insuranceFee + inspectionCost + bostaVat).toLocaleString()}</td>
                <td style="padding: 9px 8px; font-weight: 700;">${order.productCost.toLocaleString()}</td>
                <td style="padding: 9px 8px;">
                  ${(() => {
                    const isCancelledWithLoss = order.status === 'ملغي';
                    if (isCancelledWithLoss) {
                        return `
                            <div style="background-color: #fff7ed; color: #c2410c; border: 1px solid #fdba74; padding: 3px 8px; border-radius: 20px; font-size: 9.5px; font-weight: bold; display: inline-flex; align-items: center; gap: 4px;">
                                <span>ملغي</span>
                                ${whatsappIcon}
                            </div>
                        `;
                    }
                    return `<span class="status-badge" style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;">${order.status.replace(/_/g, ' ')}</span>`;
                  })()}
                </td>
                <td style="padding: 9px 8px;">${['مرتجع', 'فشل_التوصيل', 'فشل_التوصيل_معالجة', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'ملغي', 'جاري_الاسترجاع'].includes(order.status) ? '<span style="color: #94a3b8; font-weight: 600;">بدون تحصيل</span>' : order.paymentStatus}</td>
                <td style="padding: 9px 8px; font-weight: 900;">
                  ${(() => {
                    const isFlexPaid = !!(order.flexShipFeePaidByCustomer || order.flexShipTransactionAdded || (order.enableFlexShip && order.flexShipFeePaidByCustomer));
                    const isComp = isFlexPaid || (order as any).compensationStatus === 'compensated';
                    if (actualLoss <= 0 && isComp) {
                      return `<span style="color: #10b981;">0 ج.م <br/><small style="font-size: 8px; color: #166534; font-weight: normal;">(معوّض)</small></span>`;
                    } else if (actualLoss > 0 && isComp) {
                      return `<span style="color: #dc2626;">-${actualLoss.toLocaleString()} ج.م <br/><small style="font-size: 8px; color: #059669; font-weight: normal;">(بعد التعويض)</small></span>`;
                    }
                    return `<span style="color: #dc2626;">-${actualLoss.toLocaleString()} ج.م</span>`;
                  })()}
                  ${codFee > 0 ? `<br/><small style="color: #64748b; font-weight: normal;">(تحصيل: ${codFee.toLocaleString()})</small>` : ''}
                </td>
            </tr>
        `;
    }).join('');

    return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير الخسائر والمرتجعات - ${storeName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" crossorigin="anonymous">
      <style>
        @page { size: ${isContinuous ? 'auto' : `A4 ${orientation}`}; margin: ${isContinuous ? '0' : '0.8cm'}; }
        * { box-sizing: border-box; }
        body { 
          font-family: 'Cairo', sans-serif; 
          font-size: 11px; 
          -webkit-print-color-adjust: exact; 
          color-adjust: exact; 
          background-color: ${isContinuous ? '#ffffff' : '#f1f5f9'};
          color: #334155;
          margin: 0;
          padding: ${isContinuous ? '10px' : '24px'};
        }
        .report-container { 
          width: 100%; 
          max-width: ${isContinuous ? '100%' : (orientation === 'landscape' ? '297mm' : '210mm')};
          margin: 0 auto;
          background: #ffffff;
          border-radius: ${isContinuous ? '0' : '24px'};
          box-shadow: ${isContinuous ? 'none' : '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)'};
          padding: ${isContinuous ? '15px' : '32px'};
          border: ${isContinuous ? 'none' : '1px solid #e2e8f0'};
          position: relative;
          overflow: hidden;
        }

        .top-accent-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 6px;
          background: linear-gradient(90deg, #ef4444 0%, #f97316 40%, #eab308 70%, #64748b 100%);
        }

        .header-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
          border-bottom: 2px solid #f1f5f9;
          padding-bottom: 20px;
          margin-top: 6px;
        }

        .header-brand-wrap {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .store-logo-icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: linear-gradient(135deg, #450a0a 0%, #0f172a 100%);
          color: #f87171;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .header-title h1 { 
          margin: 0 0 4px 0; 
          color: #0f172a; 
          font-size: 25px; 
          font-weight: 900;
          letter-spacing: -0.02em;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .report-badge-pill {
          font-size: 10px;
          background: #fef2f2;
          color: #dc2626;
          padding: 2px 10px;
          border-radius: 20px;
          border: 1px solid #fecaca;
          font-weight: 800;
        }

        .header-title p { 
          margin: 0; 
          font-size: 13.5px; 
          color: #64748b; 
          font-weight: 600;
        }

        .header-meta {
          text-align: right;
          background: #fff5f5;
          padding: 14px 20px;
          border-radius: 16px;
          border: 1px solid #fecaca;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);
        }

        .header-meta p {
          margin: 0 0 4px 0;
          font-size: 11px;
          color: #475569;
          font-weight: 600;
        }

        .header-meta p strong {
          color: #0f172a;
          font-weight: 800;
        }

        .header-meta p:last-child { margin: 0; }

        .summary-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 16px 18px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
          background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%);
        }

        .card::before {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          left: 0;
          height: 4px;
          background: #cbd5e1;
        }

        .card.total-loss::before { background: linear-gradient(90deg, #ef4444, #f87171); }
        .card.affected-orders::before { background: linear-gradient(90deg, #f97316, #fb923c); }
        .card.shipping-loss::before { background: linear-gradient(90deg, #eab308, #fde047); }
        .card.cogs-loss::before { background: linear-gradient(90deg, #64748b, #94a3b8); }

        .card-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .card-icon-badge {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
        }

        .card.total-loss .card-icon-badge { background: #fee2e2; color: #991b1b; }
        .card.affected-orders .card-icon-badge { background: #ffedd5; color: #9a3412; }
        .card.shipping-loss .card-icon-badge { background: #fef9c3; color: #854d0e; }
        .card.cogs-loss .card-icon-badge { background: #f1f5f9; color: #334155; }

        .card-title {
          font-size: 11px;
          color: #64748b;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .card-value {
          font-size: 20px;
          font-weight: 900;
          color: #0f172a;
          line-height: 1.2;
          margin-bottom: 4px;
        }

        .card-subtext {
          font-size: 10px;
          color: #94a3b8;
          font-weight: 600;
        }

        /* Distribution Analytics Section */
        .distribution-section {
          background: #fff5f5;
          border: 1px solid #fecaca;
          border-radius: 18px;
          padding: 18px 20px;
          margin-bottom: 28px;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);
        }

        .distribution-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .distribution-title {
          font-size: 13px;
          font-weight: 900;
          color: #7f1d1d;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .distribution-subtitle {
          font-size: 11px;
          color: #991b1b;
          font-weight: 600;
        }

        .distribution-bar {
          display: flex;
          height: 24px;
          border-radius: 12px;
          overflow: hidden;
          background: #e2e8f0;
          margin-bottom: 14px;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.06);
          padding: 2px;
        }

        .dist-segment {
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 10px;
          font-weight: 800;
          text-shadow: 0 1px 2px rgba(0,0,0,0.2);
          transition: all 0.3s ease;
          min-width: fit-content;
          padding: 0 8px;
          border-radius: 8px;
        }

        .dist-segment.returned { background: linear-gradient(135deg, #ef4444, #dc2626); }
        .dist-segment.failed { background: linear-gradient(135deg, #f97316, #ea580c); }
        .dist-segment.cancelled { background: linear-gradient(135deg, #eab308, #ca8a04); }
        .dist-segment.other { background: linear-gradient(135deg, #64748b, #475569); }

        .distribution-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          justify-content: center;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #334155;
          background: #ffffff;
          padding: 4px 12px;
          border-radius: 20px;
          border: 1px solid #fecaca;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }

        .legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 50px;
        }

        .legend-dot.returned { background-color: #ef4444; }
        .legend-dot.failed { background-color: #f97316; }
        .legend-dot.cancelled { background-color: #eab308; }
        .legend-dot.other { background-color: #64748b; }

        table { 
          width: 100%; 
          border-collapse: separate; 
          border-spacing: 0;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid #fecaca;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
        }

        th, td { 
          padding: 9px 8px; 
          text-align: right; 
          border-bottom: 1px solid #fee2e2;
          vertical-align: middle;
          font-size: 10px;
          line-height: 1.4;
        }

        th { 
          background: linear-gradient(180deg, #fff5f5 0%, #ffe4e4 100%);
          color: #7f1d1d; 
          font-size: 10.5px; 
          font-weight: 800;
          white-space: nowrap;
          border-bottom: 2px solid #fca5a5;
          letter-spacing: 0.2px;
        }

        td {
          background-color: #ffffff;
        }

        td:first-child { min-width: 130px; }
        td:nth-child(2) { min-width: 130px; }

        tbody tr:last-child td { border-bottom: none; }
        tbody tr:nth-child(even) td { background-color: #fffafb; }
        tbody tr:hover td { background-color: #fee2e2; }

        .signature-section {
          margin-top: 36px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          padding: 20px 24px;
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
          border-radius: 16px;
          border: 1px solid #e2e8f0;
        }

        .signature-box {
          text-align: center;
          padding: 12px;
          background: #ffffff;
          border-radius: 12px;
          border: 1px dashed #cbd5e1;
        }

        .signature-title {
          font-weight: 800;
          margin-bottom: 32px;
          font-size: 11.5px;
          color: #1e293b;
        }

        .signature-line {
          border-top: 2px dashed #94a3b8;
          width: 160px;
          margin: 0 auto;
        }

        @media screen and (max-width: 768px) {
          body { padding: 10px; }
          .report-container { padding: 15px; border-radius: 0; max-width: 100% !important; overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .header-section { flex-direction: column; gap: 15px; align-items: stretch; text-align: center; }
          .header-meta { text-align: center; }
          .summary-cards { grid-template-columns: 1fr; }
          .signature-section { grid-template-columns: 1fr; gap: 16px; }
          table { width: 100%; min-width: 800px; display: table !important; }
          th, td { font-size: 10px; padding: 8px 6px; }
        }

        ${getPrintControlBarCSS()}
        
        @media print {
          body { background: white; padding: 0; }
          .report-container { box-shadow: none; padding: 0; border: none; }
          .top-accent-bar { display: none; }
        }
      </style>
    </head>
    <body>
      ${getPrintControlBarHTML('تقرير مسببات الخسائر والمرتجعات')}
      <div class="report-container">
        <div class="top-accent-bar"></div>
        
        <div class="header-section">
          <div class="header-brand-wrap">
            <div class="store-logo-icon">📉</div>
            <div class="header-title">
              <h1>
                تقرير الخسائر والمرتجعات
                <span class="report-badge-pill">رصد وتدقيق</span>
              </h1>
              <p>متجر "${storeName}"</p>
            </div>
          </div>
          <div class="header-meta">
            ${dateRangeText ? `<p><strong>الفترة:</strong> ${dateRangeText}</p>` : ''}
            <p><strong>تاريخ التقرير:</strong> ${new Date().toLocaleString('ar-EG', { dateStyle: 'long', timeStyle: 'short' })}</p>
          </div>
        </div>
        
        <div class="summary-cards">
          <div class="card total-loss">
            <div class="card-header-row">
              <div class="card-title">إجمالي الخسائر المباشرة</div>
              <div class="card-icon-badge">📉</div>
            </div>
            <div class="card-value" style="color: #dc2626;" dir="ltr">-${totalLoss.toLocaleString()} <span style="font-size: 13px; font-weight:700; color:#991b1b;">ج.م</span></div>
            <div class="card-subtext">إجمالي صافي الخسارة بالتقرير</div>
          </div>
          
          <div class="card affected-orders">
            <div class="card-header-row">
              <div class="card-title">الطلبات المتأثرة</div>
              <div class="card-icon-badge">🚨</div>
            </div>
            <div class="card-value">${orders.length} <span style="font-size: 13px; font-weight:700; color:#64748b;">طلب</span></div>
            <div class="card-subtext">عدد الشحنات غير الناجحة</div>
          </div>
          
          <div class="card shipping-loss">
            <div class="card-header-row">
              <div class="card-title">مصاريف شحن وتأمين هدر</div>
              <div class="card-icon-badge">🚚</div>
            </div>
            <div class="card-value" style="color: #b45309;">${(totalShippingFee + totalInsuranceInspection).toLocaleString()} <span style="font-size: 13px; font-weight:700; color:#64748b;">ج.م</span></div>
            <div class="card-subtext">تكلفة اللوجستيات غير المستردة</div>
          </div>
          
          <div class="card cogs-loss">
            <div class="card-header-row">
              <div class="card-title">تكلفة بضائع غير محصلة</div>
              <div class="card-icon-badge">📦</div>
            </div>
            <div class="card-value">${totalProductCost.toLocaleString()} <span style="font-size: 13px; font-weight:700; color:#64748b;">ج.م</span></div>
            <div class="card-subtext">قيمة التكلفة للمنتجات بالتقرير</div>
          </div>
        </div>

        ${(() => {
          const totalStatus = returnedCount + failedCount + cancelledCount + otherCount;
          const returnedPercent = totalStatus > 0 ? Math.round((returnedCount / totalStatus) * 100) : 0;
          const failedPercent = totalStatus > 0 ? Math.round((failedCount / totalStatus) * 100) : 0;
          const cancelledPercent = totalStatus > 0 ? Math.round((cancelledCount / totalStatus) * 100) : 0;
          const otherPercent = totalStatus > 0 ? Math.round((otherCount / totalStatus) * 100) : 0;

          return `
          <div class="distribution-section">
            <div class="distribution-header">
              <span class="distribution-title">
                <span>⚠️</span>
                شريط التحليل وتوزيع مسببات الخسائر
              </span>
              <span class="distribution-subtitle">تحليل أسباب فشل التحصيل والشحن</span>
            </div>
            <div class="distribution-bar">
              ${returnedPercent > 0 ? `<div class="dist-segment returned" style="width: ${returnedPercent}%" title="مرتجعات: ${returnedPercent}%">مرتجع ${returnedPercent}%</div>` : ''}
              ${failedPercent > 0 ? `<div class="dist-segment failed" style="width: ${failedPercent}%" title="فشل تسليم: ${failedPercent}%">فشل توصيل ${failedPercent}%</div>` : ''}
              ${cancelledPercent > 0 ? `<div class="dist-segment cancelled" style="width: ${cancelledPercent}%" title="إلغاءات: ${cancelledPercent}%">ملغي ${cancelledPercent}%</div>` : ''}
              ${otherPercent > 0 ? `<div class="dist-segment other" style="width: ${otherPercent}%" title="أخرى: ${otherPercent}%">أخرى ${otherPercent}%</div>` : ''}
            </div>
            <div class="distribution-legend">
              <div class="legend-item"><span class="legend-dot returned"></span>شحنات مرتجعة (${returnedCount} طلب)</div>
              <div class="legend-item"><span class="legend-dot failed"></span>فشل التسليم والتوصيل (${failedCount} طلب)</div>
              <div class="legend-item"><span class="legend-dot cancelled"></span>طلب ملغى بمصاريف (${cancelledCount} طلب)</div>
              ${otherCount > 0 ? `<div class="legend-item"><span class="legend-dot other"></span>حالات أخرى (${otherCount} طلب)</div>` : ''}
            </div>
          </div>
          `;
        })()}

        <table>
          <thead>
            <tr>
              <th>اسم العميل</th>
              <th>المنتج أو المنتجات</th>
              <th class="text-center">الكمية</th>
              <th>سعر المنتج</th>
              <th>مصاريف الشحن</th>
              <th>التأمين والمعاينة</th>
              <th>إجمالي التكلفة</th>
              <th>حالة الشحنة</th>
              <th>حالة الدفع</th>
              <th>الخسارة / الموقف</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            <tr class="total-row" style="background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); color: #ffffff; font-weight: bold; border-top: 3px solid #ef4444;">
              <td colspan="2" class="text-right font-bold" style="background: transparent; color: #ffffff; font-size: 11px; padding: 12px 10px;">🔴 إجمالي الخسائر والتكاليف بالتقرير</td>
              <td class="text-center font-bold" style="background: transparent; color: #f87171; font-size: 11px;">${orders.length} طلب</td>
              <td class="text-right" style="background: transparent; color: #cbd5e1; font-size: 11px;">${totalProductPrice.toLocaleString()} ج.م</td>
              <td class="text-right font-bold" style="background: transparent; color: #fbbf24; font-size: 11px;">${totalShippingFee.toLocaleString()} ج.م</td>
              <td class="text-right" style="background: transparent; color: #cbd5e1; font-size: 11px;">${totalInsuranceInspection.toLocaleString()} ج.م</td>
              <td class="text-right font-bold" style="background: transparent; color: #ffffff; font-size: 11px;">${totalProductCost.toLocaleString()} ج.م</td>
              <td style="background: transparent;"></td>
              <td style="background: transparent;"></td>
              <td class="text-right font-bold" style="background: transparent; color: #f87171; font-size: 11px;" dir="ltr">-${totalLoss.toLocaleString()} ج.م</td>
            </tr>
          </tbody>
        </table>

        <div class="signature-section no-break">
          <div class="signature-box">
            <div class="signature-title">توقيع المحاسب المسئول</div>
            <div class="signature-line"></div>
          </div>
          <div class="signature-box">
            <div class="signature-title">اعتماد مدير المتجر</div>
            <div class="signature-line"></div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 24px; font-size: 10px; color: #94a3b8; font-weight: 600;">
          تم إصدار التقرير آلياً عبر نظام إدارة المبيعات المتقدم &copy; ${new Date().getFullYear()}
        </div>
      </div>
      <script>
        window.onload = function() { window.print(); }
      </script>
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
    showFlexShipAmount?: boolean;
    supplyOrders?: any[];
    showColProducts?: boolean;
    showColPrice?: boolean;
    showColPriceAfterDiscount?: boolean;
    showColCost?: boolean;
    showColSurplusProfit?: boolean;
    showColPercentageProfit?: boolean;
    showColTotalProfitBeforeExpenses?: boolean;
    showColDiscounts?: boolean;
    showColShipping?: boolean;
    showColInsurance?: boolean;
    showColTax?: boolean;
    showColInspection?: boolean;
    showColCod?: boolean;
    showColNetProfit?: boolean;
}

export const generateComprehensiveFinancialReportHTML = (orders: Order[], settings: Settings, wallet: Wallet, storeName: string, orientation: 'portrait' | 'landscape' = 'landscape', isContinuous: boolean = false, dateRangeText?: string, treasury?: Treasury, sections?: ComprehensiveReportSections): string => {
    const reportStartDate = (dateRangeText && (dateRangeText.includes('كل البيانات') || dateRangeText.includes('جميع البيانات'))) ? null : (settings.activePeriodStartDate ? new Date(settings.activePeriodStartDate) : null);
    
    // Filter historical data to ensure custody section respects current period
    const filteredHandovers = reportStartDate 
        ? (settings.cashHandovers || []).filter(h => new Date(h.date) >= reportStartDate)
        : (settings.cashHandovers || []);
        
    const filteredPartnerTransactions = reportStartDate
        ? (settings.partnerTransactions || []).filter(t => new Date(t.date) >= reportStartDate)
        : (settings.partnerTransactions || []);

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
        showColProducts: sections?.showColProducts !== false,
        showColPrice: sections?.showColPrice !== false,
        showColPriceAfterDiscount: sections?.showColPriceAfterDiscount !== false,
        showColCost: sections?.showColCost !== false,
        showColSurplusProfit: sections?.showColSurplusProfit !== false,
        showColPercentageProfit: sections?.showColPercentageProfit !== false,
        showColTotalProfitBeforeExpenses: sections?.showColTotalProfitBeforeExpenses !== false,
        showColDiscounts: sections?.showColDiscounts !== false,
        showColShipping: sections?.showColShipping !== false,
        showColInsurance: sections?.showColInsurance !== false,
        showColTax: sections?.showColTax !== false,
        showColInspection: sections?.showColInspection !== false,
        showColCod: sections?.showColCod !== false,
        showColNetProfit: sections?.showColNetProfit !== false,
    };
    const failedOrders = (orders || []).filter(o => {
        const { loss, net } = calculateOrderProfitLoss(o, settings);
        return ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'تمت_الاعادة_لشركة_الشحن', 'ملغي', 'تم_الاستبدال'].includes(o.status) || loss > 0 || net < 0;
    });
    const collectedOrders = (orders || []).filter(o => {
        return ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل', 'تم_الاستبدال'].includes(o.status) && !failedOrders.some(f => f.id === o.id);
    });
    const shippingCollectedOrders = collectedOrders.filter(o => !(o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر'));
    const posCollectedOrders = collectedOrders.filter(o => o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر');
    const adminExpenses = (wallet?.transactions || []).filter(t => t.type === 'سحب' && (t.category?.startsWith('expense_') || t.category?.startsWith('supply_expense_') || (settings?.expenseCategories || []).includes(t.category || '')));
    const filteredSupplyOrders = sections?.supplyOrders;
    const totalInventoryPurchases = filteredSupplyOrders 
        ? filteredSupplyOrders.filter(o => o.status !== 'cancelled').reduce((sum, o) => {
            // Subtract shipping fees and other fees if they are bundled in grandTotal/totalCost (handles both legacy and new orders)
            const orderGrandTotal = Number(o.totalCost || o.grandTotal || 0) - (Number(o.shippingFees) || 0) - (Number(o.otherFees) || 0);
            return sum + orderGrandTotal;
        }, 0)
        : (wallet?.transactions || []).filter(t => t.category === 'inventory_purchase' || t.category === 'supply_purchase' || t.category === 'supplier_payment').reduce((sum, t) => sum + t.amount, 0);

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

    let ship_sumProductPrice = 0;
    let ship_sumPriceAfterDiscount = 0;
    let ship_sumShippingFee = 0;
    let ship_sumTax = 0;
    let ship_totalCogs = 0;
    let ship_totalSurplusProfit = 0;
    let ship_totalPercentageProfit = 0;
    let ship_totalProfitBeforeExpenses = 0;
    let ship_sumDiscounts = 0;
    let ship_totalInsurance = 0;
    let ship_totalInspection = 0;
    let ship_totalCod = 0;
    let ship_totalProfit = 0;
    let ship_totalExcluded = 0;

    let pos_sumProductPrice = 0;
    let pos_sumPriceAfterDiscount = 0;
    let pos_sumShippingFee = 0;
    let pos_sumTax = 0;
    let pos_totalCogs = 0;
    let pos_totalSurplusProfit = 0;
    let pos_totalPercentageProfit = 0;
    let pos_totalProfitBeforeExpenses = 0;
    let pos_sumDiscounts = 0;
    let pos_totalInsurance = 0;
    let pos_totalInspection = 0;
    let pos_totalCod = 0;
    let pos_totalProfit = 0;
    let pos_totalExcluded = 0;

    const shippingCollectedRows = shippingCollectedOrders.map((order, idx) => {
        const { profit, netRevenue, carrierFees, productCost, closingDifference } = calculateOrderProfitLoss(order, settings);
        const codFee = calculateCodFee(order, settings);
        
        const compFees = settings.companySpecificFees?.[order.shippingCompany];
        const useCustom = compFees?.useCustomFees ?? false;
        const isPosOrder = false;
        
        const manualShippingFee = (order.isManualShippingOverride && order.shippingFee !== undefined) ? order.shippingFee : null;
        const standardShipping = manualShippingFee !== null ? manualShippingFee : getStandardShippingFee(order, settings);
        const feesOnly = Math.max(0, carrierFees - standardShipping);
        
        totalSuccessShippingOnly += standardShipping;
        totalSuccessFeesOnly += feesOnly;
        
        const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
        const inspectionCost = (order.includeInspectionFee ?? true) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
        const isInsured = order.isInsured ?? true;
        const insuranceFee = isInsured ? calculateInsuranceFee(order, insuranceRate, settings) : 0;
        const inspectionAdjustment = order.inspectionFeePaidByCustomer !== false ? 0 : inspectionCost;
        const bostaVat = calculateBostaVat(order, insuranceFee, settings);

        const safeProductPrice = Number(order.productPrice) || 0;
        const safeShippingFee = Number(order.shippingFee) || 0;
        const safeDiscount = Number(order.discount) || 0;
        const safeAdvance = Number(order.advancePayment) || 0;
        const safeTax = Number((order as any).tax) || 0;

        const totalCollected = order.totalAmountOverride !== undefined && order.totalAmountOverride !== null
            ? order.totalAmountOverride + safeAdvance
            : (safeProductPrice + safeShippingFee + safeTax - safeDiscount);

        const inspectionFeeCollected = order.inspectionFeePaidByCustomer !== false ? inspectionCost : 0;
        const baseExpected = safeProductPrice + safeShippingFee + safeTax - safeDiscount + inspectionFeeCollected;
        const overrideAdjustment = totalCollected - baseExpected;

        totalShippingRevenue += order.shippingFee;

        // Use the full carrierFees for accurate expense reporting
        totalActualShipping += carrierFees;

        const shippingMarkup = Math.max(0, order.shippingFee - standardShipping);
        totalShippingMarkup += shippingMarkup;

        let orderBaseRevenue = 0;
        let orderProductExtraMarkup = 0;
        let orderPercentageProfit = 0;
        let orderSurplusProfit = 0;

        order.items.forEach(item => {
            const product = findProductInSettings(item, settings);
            const actualCost = (item.cost !== undefined && item.cost !== null && item.cost > 0) ? item.cost : (getLatestProductCost(product?.id || item.productId, settings) || item.cost || 0);
            const catalogPrice = resolveItemCatalogPrice(item, product, actualCost);
            const itemProfit = (item.price - actualCost) * item.quantity;

            let basePercentageProfit = itemProfit;
            if (item.price > catalogPrice) {
                orderBaseRevenue += catalogPrice * item.quantity;
                const extra = (item.price - catalogPrice) * item.quantity;
                orderProductExtraMarkup += extra;
                orderSurplusProfit += extra;
                basePercentageProfit = Math.max(0, (catalogPrice - actualCost) * item.quantity);
                orderPercentageProfit += basePercentageProfit;
            } else {
                orderBaseRevenue += item.price * item.quantity;
                orderPercentageProfit += Math.max(0, itemProfit);
            }

            if (product?.profitMode === 'commission') {
                totalCommissionProfit += basePercentageProfit;
            } else {
                totalPercentageProfit += basePercentageProfit;
            }
        });

        const displaySurplusProfit = orderSurplusProfit;

        const isMultiProfitOrder = orderProductExtraMarkup > 0;
        const rowStyle = isMultiProfitOrder ? 'background-color: #f0f9ff !important; border-right: 4px solid #0ea5e9;' : '';

        const currentCogs = (order.items || []).reduce((sum, item) => {
            const product = findProductInSettings(item, settings);
            const costVal = (item.cost !== undefined && item.cost !== null && item.cost > 0) ? item.cost : (getLatestProductCost(product?.id || item.productId, settings) || item.cost || 0);
            return sum + (costVal * item.quantity);
        }, 0);

        const orderTotalMarkup = orderProductExtraMarkup + overrideAdjustment;
        const excludedForOrder = !s.showExtraServicesRow
            ? (s.includeMarkupsInProductRevenue ? (overrideAdjustment + inspectionFeeCollected) : (orderProductExtraMarkup + overrideAdjustment + inspectionFeeCollected))
            : 0;
        const displayOrderProfit = profit - excludedForOrder;
        const displayProductPrice = safeProductPrice - excludedForOrder;

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
        
        totalCogs += currentCogs;
        
        totalInsuranceFees += insuranceFee;
        totalInspectionFees += inspectionAdjustment;
        totalCodFees += codFee;
        totalProfit += displayOrderProfit;

        // Subtotals for Shipping Table
        ship_sumProductPrice += safeProductPrice;
        ship_sumPriceAfterDiscount += (safeProductPrice - safeDiscount - (closingDifference < 0 ? Math.abs(closingDifference) : 0));
        ship_totalExcluded += excludedForOrder;
        ship_sumShippingFee += order.shippingFee;
        ship_sumTax += (bostaVat + safeTax);
        ship_totalCogs += currentCogs;
        ship_totalSurplusProfit += displaySurplusProfit;
        ship_totalPercentageProfit += orderPercentageProfit;
        ship_totalProfitBeforeExpenses += (displaySurplusProfit + orderPercentageProfit);
        ship_sumDiscounts += (safeDiscount + (closingDifference < 0 ? Math.abs(closingDifference) : 0));
        ship_totalInsurance += insuranceFee;
        ship_totalInspection += inspectionAdjustment;
        ship_totalCod += codFee;
        ship_totalProfit += displayOrderProfit;

        const productDetails = order.items.map(item => {
            const product = findProductInSettings(item, settings);
            const actualCost = (item.cost !== undefined && item.cost !== null && item.cost > 0) ? item.cost : (getLatestProductCost(product?.id || item.productId, settings) || item.cost || 0);
            const catalogPrice = resolveItemCatalogPrice(item, product, actualCost);
            const isMulti = item.price > catalogPrice;
            return `
                <div style="margin-bottom: 4px; line-height: 1.4;">
                    <strong>${item.name}</strong> (${item.quantity})
                    ${isMulti ? '<br/><span style="font-size: 8px; background: #0ea5e9; color: white; padding: 1px 4px; border-radius: 4px; display: inline-block; margin-top: 2px;">ربح مركب (أساسي + زيادة)</span>' : ''}
                </div>
            `;
        }).join('');
        
        const taxDisplay = (bostaVat + safeTax) > 0 ? (bostaVat + safeTax).toLocaleString() : '-';

        const totalOrderDiscounts = safeDiscount + (closingDifference < 0 ? Math.abs(closingDifference) : 0);
        const orderPriceAfterDiscount = safeProductPrice - totalOrderDiscounts;
        const totalProfitBeforeExp = displaySurplusProfit + orderPercentageProfit;

        return `
            <tr style="${rowStyle}">
                <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
                <td>
                  <div style="font-weight: bold; color: #0f172a;">${order.customerName}</div>
                  <div style="font-size: 9px; color: #64748b;">م: ${order.orderNumber}</div>
                  <div style="font-size: 8.5px; color: #475569; margin-top: 2px;">الشركة: <span style="font-weight: bold;">${order.shippingCompany || 'غير محدد'}</span></div>
                  ${renderFlexShipAndCompensationBadges(order, settings, sections?.showFlexShipAmount !== false)}
                  ${safeAdvance > 0 ? `
                  <div style="margin-top: 4px; font-size: 9px; font-weight: bold; color: #d97706; background-color: #fffbeb; border: 1px solid #fde68a; padding: 2px 6px; border-radius: 4px; display: inline-block;">
                    عربون مدفوع: ${safeAdvance.toLocaleString()}
                  </div>` : ''}
                </td>
                ${s.showColProducts ? `<td class="col-products">${productDetails}</td>` : ''}
                ${s.showColPrice ? `<td>
                  <div>${safeProductPrice.toLocaleString()}</div>
                  ${excludedForOrder > 0 ? `
                  <div style="margin-top: 4px; font-size: 8.5px; color: #b91c1c; background: #fee2e2; border: 1px dashed #fecaca; padding: 1.5px 4px; border-radius: 4px; display: inline-block; font-weight: bold; white-space: nowrap;">
                    مستبعد فرق وتسويات: ${excludedForOrder.toLocaleString()} ج.م
                  </div>
                  ` : ''}
                </td>` : ''}
                ${s.showColDiscounts ? `<td>${totalOrderDiscounts.toLocaleString()}</td>` : ''}
                ${s.showColPriceAfterDiscount ? `<td>${orderPriceAfterDiscount.toLocaleString()}</td>` : ''}
                ${s.showColCost ? `<td>${productCost.toLocaleString()}</td>` : ''}
                ${s.showColSurplusProfit ? `<td style="text-align: center; font-weight: bold; color: ${displaySurplusProfit > 0 ? '#0284c7' : '#ef4444'};">${displaySurplusProfit > 0 ? fmt(displaySurplusProfit) : '&empty;'}</td>` : ''}
                ${s.showColPercentageProfit ? `<td style="text-align: center; font-weight: bold; color: #4f46e5;">${fmt(orderPercentageProfit)}</td>` : ''}
                ${s.showColTotalProfitBeforeExpenses ? `<td style="text-align: center; font-weight: bold; color: #059669;">${fmt(totalProfitBeforeExp)}</td>` : ''}
                ${s.showColShipping ? `<td>${order.shippingFee.toLocaleString()}</td>` : ''}
                ${s.showColInsurance ? `<td>${insuranceFee.toLocaleString()}</td>` : ''}
                ${s.showColTax ? `<td>${taxDisplay}</td>` : ''}
                ${s.showColInspection ? `<td>${inspectionAdjustment.toLocaleString()}</td>` : ''}
                ${s.showColCod ? `<td>${codFee.toLocaleString()}</td>` : ''}
                ${s.showColNetProfit ? `<td style="color: #15803d; font-weight: bold;">${fmt(displayOrderProfit)}</td>` : ''}
            </tr>`;
    }).join('');

    const posCollectedRows = posCollectedOrders.map((order, idx) => {
        const { profit, netRevenue, productCost, closingDifference } = calculateOrderProfitLoss(order, settings);
        const isPosOrder = true;
        
        const safeProductPrice = Number(order.productPrice) || 0;
        const safeShippingFee = Number(order.shippingFee) || 0;
        const safeDiscount = Number(order.discount) || 0;
        const safeAdvance = Number(order.advancePayment) || 0;
        const safeTax = Number((order as any).tax) || 0;

        const totalCollected = order.totalAmountOverride !== undefined && order.totalAmountOverride !== null
            ? order.totalAmountOverride + safeAdvance
            : (safeProductPrice + safeShippingFee + safeTax - safeDiscount);

        const baseExpected = safeProductPrice + safeShippingFee + safeTax - safeDiscount;
        const overrideAdjustment = totalCollected - baseExpected;

        totalShippingRevenue += order.shippingFee;
        totalActualShipping += 0;

        let orderBaseRevenue = 0;
        let orderProductExtraMarkup = 0;
        let orderPercentageProfit = 0;
        let orderSurplusProfit = 0;

        order.items.forEach(item => {
            const product = findProductInSettings(item, settings);
            const actualCost = (item.cost !== undefined && item.cost !== null && item.cost > 0) ? item.cost : (getLatestProductCost(product?.id || item.productId, settings) || item.cost || 0);
            const catalogPrice = resolveItemCatalogPrice(item, product, actualCost);
            const itemProfit = (item.price - actualCost) * item.quantity;

            let basePercentageProfit = itemProfit;
            if (item.price > catalogPrice) {
                orderBaseRevenue += catalogPrice * item.quantity;
                const extra = (item.price - catalogPrice) * item.quantity;
                orderProductExtraMarkup += extra;
                orderSurplusProfit += extra;
                basePercentageProfit = Math.max(0, (catalogPrice - actualCost) * item.quantity);
                orderPercentageProfit += basePercentageProfit;
            } else {
                orderBaseRevenue += item.price * item.quantity;
                orderPercentageProfit += Math.max(0, itemProfit);
            }

            if (product?.profitMode === 'commission') {
                totalCommissionProfit += basePercentageProfit;
            } else {
                totalPercentageProfit += basePercentageProfit;
            }
        });

        const displaySurplusProfit = orderSurplusProfit;

        const isMultiProfitOrder = orderProductExtraMarkup > 0;
        const rowStyle = isMultiProfitOrder ? 'background-color: #f0f9ff !important; border-right: 4px solid #0ea5e9;' : '';

        const currentCogs = (order.items || []).reduce((sum, item) => {
            const product = findProductInSettings(item, settings);
            const costVal = (item.cost !== undefined && item.cost !== null && item.cost > 0) ? item.cost : (getLatestProductCost(product?.id || item.productId, settings) || item.cost || 0);
            return sum + (costVal * item.quantity);
        }, 0);

        const orderTotalMarkup = orderProductExtraMarkup + overrideAdjustment;
        const posExcludedForOrder = !s.showExtraServicesRow
            ? (s.includeMarkupsInProductRevenue ? overrideAdjustment : (orderProductExtraMarkup + overrideAdjustment))
            : 0;
        const displayOrderProfit = profit - posExcludedForOrder;
        const displayProductPrice = safeProductPrice - posExcludedForOrder;

        totalProductRevenue += orderBaseRevenue;
        totalDiscount += safeDiscount;
        sumCollectedProductPrice += safeProductPrice;
        sumCollectedShippingFee += order.shippingFee;
        sumCollectedTax += safeTax;
        totalProductExtraMarkup += orderProductExtraMarkup;
        totalOverrideAdjustment += overrideAdjustment;
        totalRequiredCollection += netRevenue;
        totalExtraMarkup += (orderProductExtraMarkup + overrideAdjustment);
        
        totalCogs += currentCogs;
        totalProfit += displayOrderProfit;

        // Subtotals POS
        pos_sumProductPrice += safeProductPrice;
        pos_sumPriceAfterDiscount += (safeProductPrice - safeDiscount - (closingDifference < 0 ? Math.abs(closingDifference) : 0));
        pos_totalExcluded += posExcludedForOrder;
        pos_sumShippingFee += order.shippingFee;
        pos_sumTax += safeTax;
        pos_totalCogs += currentCogs;
        pos_totalSurplusProfit += displaySurplusProfit;
        pos_totalPercentageProfit += orderPercentageProfit;
        pos_totalProfitBeforeExpenses += (displaySurplusProfit + orderPercentageProfit);
        pos_sumDiscounts += (safeDiscount + (closingDifference < 0 ? Math.abs(closingDifference) : 0));
        pos_totalProfit += displayOrderProfit;

        const productDetails = order.items.map(item => {
            const product = findProductInSettings(item, settings);
            const actualCost = (item.cost !== undefined && item.cost !== null && item.cost > 0) ? item.cost : (getLatestProductCost(product?.id || item.productId, settings) || item.cost || 0);
            const catalogPrice = resolveItemCatalogPrice(item, product, actualCost);
            const isMulti = item.price > catalogPrice;
            return `
                <div style="margin-bottom: 4px; line-height: 1.4;">
                    <strong>${item.name}</strong> (${item.quantity})
                    ${isMulti ? '<br/><span style="font-size: 8px; background: #0ea5e9; color: white; padding: 1px 4px; border-radius: 4px; display: inline-block; margin-top: 2px;">ربح مركب (أساسي + زيادة)</span>' : ''}
                </div>
            `;
        }).join('');

        const totalOrderDiscounts = safeDiscount + (closingDifference < 0 ? Math.abs(closingDifference) : 0);
        const orderPriceAfterDiscount = safeProductPrice - totalOrderDiscounts;
        const totalProfitBeforeExp = displaySurplusProfit + orderPercentageProfit;

        return `
            <tr style="${rowStyle}">
                <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
                <td>
                  <div style="font-weight: bold; color: #0f172a;">${order.customerName}</div>
                  <div style="font-size: 9px; color: #64748b;">م: ${order.orderNumber}</div>
                  <div style="font-size: 8.5px; color: #475569; margin-top: 2px;">الشركة: <span style="font-weight: bold;">${order.shippingCompany || 'غير محدد'}</span></div>
                  <div style="margin-top: 2px; font-size: 8px; background: #f0fdf4; color: #166534; padding: 1px 4px; border-radius: 4px; border: 1px solid #bbf7d0; display: inline-block;">
                    نقطة بيع (POS) - عهدة: ${resolveCashHolderName(order, settings)}
                  </div>
                  ${safeAdvance > 0 ? `
                  <div style="margin-top: 4px; font-size: 9px; font-weight: bold; color: #166534; background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 2px 6px; border-radius: 4px; display: inline-block;">
                    ثمن المنتج (تحصيل نقدي): ${safeAdvance.toLocaleString()} ج.م
                  </div>` : ''}
                </td>
                ${s.showColProducts ? `<td class="col-products">${productDetails}</td>` : ''}
                ${s.showColPrice ? `<td>
                  <div>${safeProductPrice.toLocaleString()}</div>
                  ${posExcludedForOrder > 0 ? `
                  <div style="margin-top: 4px; font-size: 8.5px; color: #b91c1c; background: #fee2e2; border: 1px dashed #fecaca; padding: 1.5px 4px; border-radius: 4px; display: inline-block; font-weight: bold; white-space: nowrap;">
                    مستبعد فرق وتسويات: ${posExcludedForOrder.toLocaleString()} ج.م
                  </div>
                  ` : ''}
                </td>` : ''}
                ${s.showColDiscounts ? `<td>${totalOrderDiscounts.toLocaleString()}</td>` : ''}
                ${s.showColPriceAfterDiscount ? `<td>${orderPriceAfterDiscount.toLocaleString()}</td>` : ''}
                ${s.showColCost ? `<td>${productCost.toLocaleString()}</td>` : ''}
                ${s.showColSurplusProfit ? `<td style="text-align: center; font-weight: bold; color: ${displaySurplusProfit > 0 ? '#0284c7' : '#ef4444'};">${displaySurplusProfit > 0 ? fmt(displaySurplusProfit) : '&empty;'}</td>` : ''}
                ${s.showColPercentageProfit ? `<td style="text-align: center; font-weight: bold; color: #4f46e5;">${fmt(orderPercentageProfit)}</td>` : ''}
                ${s.showColTotalProfitBeforeExpenses ? `<td style="text-align: center; font-weight: bold; color: #059669;">${fmt(totalProfitBeforeExp)}</td>` : ''}
                ${s.showColNetProfit ? `<td style="color: #15803d; font-weight: bold;">${fmt(displayOrderProfit)}</td>` : ''}
            </tr>`;
    }).join('');

    let totalFailedShipping = 0;
    let totalFailedInsurance = 0;
    let totalFailedInspection = 0;
    let totalReturnFees = 0;
    let totalLoss = 0;

    const failedRows = failedOrders.map((order, idx) => {
        const { loss, net } = calculateOrderProfitLoss(order, settings);
        const actualLoss = loss > 0 ? loss : (net < 0 ? Math.abs(net) : 0);
        
        const compFees = settings.companySpecificFees?.[order.shippingCompany];
        const useCustom = compFees?.useCustomFees ?? false;
        const isPosOrder = order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر';
        const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
        const inspectionCost = !isPosOrder && (order.includeInspectionFee ?? true) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
        const isInsured = order.isInsured ?? true;
        const insuranceFee = !isPosOrder && isInsured ? calculateInsuranceFee(order, insuranceRate, settings) : 0;
        const bostaVat = !isPosOrder && isBosta(order.shippingCompany) ? calculateBostaVat(order, insuranceFee, settings) : 0;
        const displayInsuranceFee = insuranceFee + bostaVat;
        
        const applyReturnFee = !isPosOrder && (useCustom ? (compFees?.enableFixedReturn ?? false) : settings.enableReturnShipping);
        const returnFeeAmount = applyReturnFee ? (useCustom ? (compFees?.returnShippingFee ?? 0) : settings.returnShippingFee) : 0;
        const inspectionFeeCollected = 0;

        totalFailedShipping += order.shippingFee;
        totalFailedInsurance += displayInsuranceFee;
        totalFailedInspection += inspectionCost;
        totalReturnFees += returnFeeAmount;
        totalLoss += actualLoss;

        const productDetails = order.items.map(item => `<div style="margin-bottom: 4px; line-height: 1.4;"><strong>${item.name}</strong> (${item.quantity})</div>`).join('');
        return `
            <tr>
                <td>${idx + 1}</td>
                <td>
                  <div style="font-weight: bold; color: #0f172a;">${order.customerName}</div>
                  <div style="font-size: 9px; color: #64748b;">م: ${order.orderNumber}</div>
                  <div style="font-size: 8.5px; color: #475569; margin-top: 2px;">الشركة: <span style="font-weight: bold;">${order.shippingCompany || 'غير محدد'}</span></div>
                  ${renderFlexShipAndCompensationBadges(order, settings, sections?.showFlexShipAmount !== false)}
                </td>
                <td class="col-products">${productDetails}</td>
                <td style="padding: 8px; text-align: center;">
                    ${(() => {
                        const isCancelledWithLoss = order.status === 'ملغي';
                        if (isCancelledWithLoss) {
                            return `
                                <div style="display: inline-flex; align-items: center; gap: 4px; color: #ea580c; font-weight: bold; background: #fff7ed; padding: 2px 8px; border-radius: 9999px; border: 1px solid #ffedd5; font-size: 9px;">
                                    <span>ملغي</span>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="#25D366" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                    </svg>
                                </div>
                            `;
                        }
                        return order.status.replace(/_/g, ' ');
                    })()}
                </td>
                <td>${order.shippingFee.toLocaleString()}</td>
                <td>${displayInsuranceFee.toLocaleString()}</td>
                <td>${(inspectionCost - inspectionFeeCollected).toLocaleString()}</td>
                <td>${returnFeeAmount.toLocaleString()}</td>
                <td style="font-weight: bold;">
                  ${(() => {
                    const isFlexPaid = !!(order.flexShipFeePaidByCustomer || order.flexShipTransactionAdded || (order.enableFlexShip && order.flexShipFeePaidByCustomer));
                    const isComp = isFlexPaid || (order as any).compensationStatus === 'compensated';
                    if (actualLoss <= 0 && isComp) {
                      return `<span style="color: #059669;">0 ج.م <br/><small style="font-size: 7.5px; color: #166534; font-weight: normal;">(معوّض)</small></span>`;
                    } else if (actualLoss > 0 && isComp) {
                      return `<span style="color: #b91c1c;">-${actualLoss.toLocaleString()} ج.م <br/><small style="font-size: 7.5px; color: #059669; font-weight: normal;">(بعد التعويض)</small></span>`;
                    }
                    return `<span style="color: #b91c1c;">-${actualLoss.toLocaleString()}</span>`;
                  })()}
                </td>
            </tr>`;
    }).join('');

    let totalExpenses = 0;
    const expenseRows = adminExpenses.map(t => {
        totalExpenses += t.amount;
        let payerBadge = '<span style="color: #64748b; font-size: 10px;">الخزينة العامة</span>';
        
        // 1. Check if paid by explicit partner ID
        if (t.details?.paidByPartnerId) {
            const matchedP = (settings?.partners || []).find(p => p.id === t.details?.paidByPartnerId);
            payerBadge = `<span style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; border: 1px solid #fde68a;">🤝 سداد: ${matchedP?.name || 'شريك'}</span>`;
        }
        // 2. Check if paid by Treasury / Bank account
        else {
            const tAccId = t.details?.treasuryAccountId || (t as any).treasuryAccountId;
            const matchedTreasuryAcc = (treasury?.accounts || []).find(a => String(a.id) === String(tAccId) || a.name === t.details?.expensePaidBy);
            
            if (matchedTreasuryAcc) {
                const icon = matchedTreasuryAcc.type === 'bank' ? '🏦' : matchedTreasuryAcc.type === 'wallet' ? '📱' : '💵';
                payerBadge = `<span style="background: #ecfdf5; color: #065f46; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; border: 1px solid #a7f3d0;">${icon} ${matchedTreasuryAcc.name}</span>`;
            } else if (tAccId === 'main_wallet' || t.details?.paymentMethod === 'wallet' || t.details?.expensePaidBy === 'المحفظة العامة') {
                payerBadge = '<span style="background: #eff6ff; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; border: 1px solid #bfdbfe;">💳 المحفظة العامة</span>';
            } else if (t.details?.expensePaidBy) {
                const matchedP = (settings?.partners || []).find(p => normalizeName(p.name) === normalizeName(t.details?.expensePaidBy));
                if (matchedP) {
                    payerBadge = `<span style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; border: 1px solid #fde68a;">🤝 سداد: ${matchedP.name}</span>`;
                } else {
                    payerBadge = `<span style="background: #f1f5f9; color: #334155; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold;">${t.details.expensePaidBy}</span>`;
                }
            } else if (t.note && (t.note.includes('بواسطة') || t.note.includes('سداد شريك') || t.note.includes('دفعهم') || t.note.includes('سداد بواسطة'))) {
                const normNote = normalizeName(t.note);
                const matchedP = (settings?.partners || []).find(p => {
                    const normP = normalizeName(p.name);
                    return normNote.includes(`بواسطه ${normP}`) || normNote.includes(`بواسطة ${normP}`) || normNote.includes(`دفعهم ${normP}`) || normNote.includes(`سداد ${normP}`);
                });
                if (matchedP) {
                    payerBadge = `<span style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; border: 1px solid #fde68a;">🤝 سداد: ${matchedP.name}</span>`;
                }
            }
        }
        return `<tr><td style="font-size: 10.5px;">${new Date(t.date).toLocaleDateString('ar-EG')}</td><td style="text-align: right; font-weight: 600;">${t.note}</td><td>${payerBadge}</td><td style="color: #b91c1c; font-weight: bold; font-family: monospace;">${t.amount.toLocaleString()} ج.م</td></tr>`;
    }).join('');

    const extraPosSales = (settings?.posSales || []).filter(s => !orders.some(o => o.id === s.id || o.orderNumber === s.saleNumber));
    let extraPosProfit = 0;
    let extraPosRevenue = 0;
    let extraPosCOGS = 0;
    extraPosSales.forEach(s => {
        (s.items || []).forEach(item => {
            const cost = (item.cost !== undefined && item.cost !== null && item.cost > 0) ? item.cost : (getLatestProductCost(item.productId, settings) || item.cost || 0);
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
    orders.filter(o => ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل', 'مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'تمت_الاعادة_لشركة_الشحن', 'ملغي', 'تم_الاستبدال'].includes(o.status)).forEach(o => {
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
                const product = findProductInSettings(item, settings);
                const actualCost = (item.cost !== undefined && item.cost !== null && item.cost > 0) ? item.cost : (getLatestProductCost(product?.id || item.productId, settings) || item.cost || 0);
                const catalogPrice = resolveItemCatalogPrice(item, product, actualCost);
                if (item.price > catalogPrice) {
                    productStats[item.name].revenue += catalogPrice * item.quantity;
                    productStats[item.name].extra += (item.price - catalogPrice) * item.quantity;
                } else {
                    productStats[item.name].revenue += item.price * item.quantity;
                }
                productStats[item.name].cost += actualCost * item.quantity;
                productStats[item.name].sold += item.quantity;
            } else if (['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'تمت_الاعادة_لشركة_الشحن', 'تم_الاستبدال'].includes(o.status)) {
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
        const { net, netRevenue } = calculateOrderProfitLoss(o, settings);
        if (['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل', 'تم_الاستبدال'].includes(o.status)) {
            geoStats[area].success++;
            geoStats[area].revenue += netRevenue;
        }
        geoStats[area].net += net;
    });

    const geoRows = Object.entries(geoStats)
        .sort((a, b) => b[1].net - a[1].net)
        .map(([name, s]) => `<tr><td>${name}</td><td>${s.count}</td><td>${((s.success/s.count)*100).toFixed(1)}%</td><td style="font-weight: bold; color: ${s.net >= 0 ? '#15803d' : '#b91c1c'};">${s.net.toLocaleString()}</td></tr>`).join('');

    const isBankOrTreasuryAccount = (name: string): boolean => {
        if (!name) return false;
        const norm = normalizeName(name);
        return norm.includes('بنك') || 
               norm.includes('bank') || 
               norm.includes('cib') || 
               norm.includes('المحفظة') || 
               norm.includes('محفظة') || 
               norm.includes('فودافون كاش') || 
               norm.includes('انستا باي') || 
               norm.includes('حساب بنكي');
    };

    const partners = settings.partners || [];
    const employees = settings.employees || [];
    const rawHolders = settings.cashHolders || [];
    const treasuryCustody = (treasury?.accounts || []).filter(a => a.type === 'custody' && !isBankOrTreasuryAccount(a.name)).map(a => ({ name: a.name, balance: a.balance }));
    
    const mergedHolders: Record<string, { displayName: string, balance: number }> = {};
    rawHolders.forEach(h => {
        const nName = normalizeName(h.userName);
        if (isBankOrTreasuryAccount(nName) || isBankOrTreasuryAccount(h.userName)) return;

        const isPartner = partners.some(p => normalizeName(p.name) === nName || h.userId === p.id || h.userId === `part_${p.id}` || h.userId === `partner_${p.id}`);
        const isEmp = employees.some(e => normalizeName(e.name) === nName || h.userId === e.id || h.userId === `emp_${e.id}` || h.userId === `employee_${e.id}`);
        const dispName = (h.userId === 'admin' || nName === 'المدير' || nName === 'المدير (أنت)') ? 'المدير (أنت)' : isPartner ? `${nName} (شريك)` : isEmp ? `${nName} (موظف)` : nName;
        
        if (!mergedHolders[nName]) {
            mergedHolders[nName] = { displayName: dispName, balance: 0 };
        }
        mergedHolders[nName].balance += (h.currentBalance || 0);
    });

    partners.forEach(p => {
        const nName = normalizeName(p.name);
        if (isBankOrTreasuryAccount(nName) || isBankOrTreasuryAccount(p.name)) return;

        const holderId = `part_${p.id}`;
        const partnerHolders = rawHolders.filter((h: any) => 
            h.userId === holderId || 
            h.userId === p.id || 
            normalizeName(h.userName) === nName
        );
        const partnerUserIds = [holderId, p.id, ...partnerHolders.map(h => h.userId)];

        const partnerHandovers = filteredHandovers.filter(h => 
            partnerUserIds.includes(h.fromUserId) || 
            partnerUserIds.includes(h.toUserId) || 
            normalizeName(h.toUserName || '').includes(nName) || 
            normalizeName(h.fromUserName || '').includes(nName)
        );

        let handoverSum = partnerHandovers.reduce((sum, h) => {
            const isGive = partnerUserIds.includes(h.toUserId) || normalizeName(h.toUserName || '').includes(nName);
            return isGive ? sum + (Number(h.amount) || 0) : sum - (Number(h.amount) || 0);
        }, 0);

        const partnerTxs = filteredPartnerTransactions.filter(t => {
            const matchesId = t.partnerId === p.id || t.partnerId === `part_${p.id}` || t.partnerId === `partner_${p.id}`;
            const matchesName = t.partnerName && normalizeName(t.partnerName) === nName;
            return matchesId || matchesName;
        });

        const equalizationSum = partnerTxs
            .filter(t => {
                const notes = (t.notes || t.description || '').toLowerCase();
                return notes.includes('تسوية') && (notes.includes('مخزون') || notes.includes('بضاعة') || notes.includes('مقاصة'));
            })
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        let holderSum = partnerHolders.reduce((sum, h) => sum + (h.currentBalance || 0), 0);
        // Adjust holder sum to exclude accounting equalization settlements that were added to balance
        holderSum = Math.max(0, holderSum - equalizationSum);

        const settlements = partnerHandovers.filter(h => 
            h.toUserId === 'admin_deduction' || 
            h.toUserId === 'admin_manual' ||
            (h.toUserName && (h.toUserName.includes('خصم') || h.toUserName.includes('تصفية') || h.toUserName.includes('تسوية'))) ||
            (h.notes && (h.notes.includes('خصم') || h.notes.includes('تصفية') || h.notes.includes('تسوية')))
        );
        const hasSettlement = settlements.length > 0;

        let custodyAmt = 0;
        if (hasSettlement) {
            const lastSettlement = settlements.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            const activeHandovers = partnerHandovers.filter(h => new Date(h.date).getTime() > new Date(lastSettlement.date).getTime());
            const activeHandoverSum = activeHandovers.reduce((sum_act, h_act) => {
                const isGive_act = partnerUserIds.includes(h_act.toUserId) || normalizeName(h_act.toUserName || '').includes(nName);
                return isGive_act ? sum_act + (Number(h_act.amount) || 0) : sum_act - (Number(h_act.amount) || 0);
            }, 0);
            custodyAmt = Math.max(0, holderSum) + Math.max(0, activeHandoverSum);
        } else {
            let handoverSum = partnerHandovers.reduce((sum, h) => {
                const isGive = partnerUserIds.includes(h.toUserId) || normalizeName(h.toUserName || '').includes(nName);
                return isGive ? sum + (Number(h.amount) || 0) : sum - (Number(h.amount) || 0);
            }, 0);
            custodyAmt = Math.max(holderSum, Math.max(0, handoverSum));
            if (custodyAmt <= 0 && holderSum > 0) custodyAmt = holderSum;
        }
        custodyAmt = Math.max(0, custodyAmt);

        if (!mergedHolders[nName]) {
            mergedHolders[nName] = {
                displayName: `${p.name} (شريك)`,
                balance: custodyAmt
            };
        } else {
            mergedHolders[nName].balance = custodyAmt;
        }
    });

    const custodyAccounts = [...treasuryCustody, ...Object.values(mergedHolders).map(val => ({ name: val.displayName, balance: val.balance }))];

    // Collect advance payments AND POS collections that contribute to custody
    const custodyDetails: Record<string, Array<{ customerName: string, orderNumber: string, amount: number, type: string }>> = {};
    orders.forEach(o => {
        const advance = Number(o.advancePayment) || 0;
        const isPosOrder = o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر';
        
        // For POS orders, the full amount is collected in custody
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

            if (matchName && !isBankOrTreasuryAccount(matchName)) {
                const account = custodyAccounts.find(a => normalizeName(a.name) === matchName || a.name.includes(matchName) || matchName.includes(a.name) || normalizeName(a.name).includes(matchName));
                const targetName = account ? account.name : matchName;
                
                if (!isBankOrTreasuryAccount(targetName)) {
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
        }
    });

    // Add active cash handovers to custody details for partners and employees
    partners.forEach(p => {
        const nName = normalizeName(p.name);
        if (isBankOrTreasuryAccount(nName) || isBankOrTreasuryAccount(p.name)) return;

        const holderId = `part_${p.id}`;
        const partnerHolders = rawHolders.filter((h: any) => 
            h.userId === holderId || 
            h.userId === p.id || 
            normalizeName(h.userName) === nName
        );
        const partnerUserIds = [holderId, p.id, ...partnerHolders.map(h => h.userId)];

        const partnerHandovers = filteredHandovers.filter(h => 
            partnerUserIds.includes(h.fromUserId) || 
            partnerUserIds.includes(h.toUserId) || 
            normalizeName(h.toUserName || '').includes(nName) || 
            normalizeName(h.fromUserName || '').includes(nName)
        );

        const account = custodyAccounts.find(a => normalizeName(a.name) === nName || a.name.includes(p.name) || p.name.includes(a.name) || normalizeName(a.name).includes(nName));
        const targetName = account ? account.name : `${p.name} (شريك)`;

        if (!custodyDetails[targetName]) {
            custodyDetails[targetName] = [];
        }

        partnerHandovers.forEach(h => {
            const isGive = partnerUserIds.includes(h.toUserId) || normalizeName(h.toUserName || '').includes(nName);
            const isDeductionOrSettlement = h.toUserId === 'admin_deduction' || (h.toUserName && h.toUserName.includes('خصم')) || (h.notes && (h.notes.includes('خصم') || h.notes.includes('تسوية')));
            const noteText = h.notes || (isDeductionOrSettlement ? 'تسوية وخصم عهدة معلقة من الرصيد الجاري للشريك' : (isGive ? 'تسليم عهدة تشغيلية للشريك' : 'تسوية واسترداد عهدة من الشريك'));
            
            // Check if this positive handover is an automatic mirror of an order already listed in custodyDetails
            if (!isDeductionOrSettlement && isGive) {
                const isAutoOrderHandover = (h.id && (h.id.startsWith('pos-handover') || h.id.startsWith('virtual-adv') || h.id.startsWith('hd-'))) ||
                                           (h.notes && (h.notes.includes('طلب #') || h.notes.includes('دفع مقدم') || h.notes.includes('مبيعات كاشير') || h.notes.includes('عربون')));
                
                const matchInDetails = custodyDetails[targetName].some(d => {
                    const orderNumMatch = d.orderNumber && (h.id.includes(d.orderNumber) || (h.notes && h.notes.includes(d.orderNumber)));
                    const custNameMatch = d.customerName && h.notes && h.notes.includes(d.customerName);
                    return orderNumMatch || custNameMatch;
                });

                if (isAutoOrderHandover && matchInDetails) {
                    return;
                }
            }

            const alreadyExists = custodyDetails[targetName].some(d => d.orderNumber === h.id);
            if (!alreadyExists) {
                custodyDetails[targetName].push({
                    customerName: noteText,
                    orderNumber: h.id || 'سند تسوية',
                    amount: isDeductionOrSettlement ? -(Math.abs(Number(h.amount) || 0)) : (isGive ? (Number(h.amount) || 0) : -(Number(h.amount) || 0)),
                    type: isDeductionOrSettlement ? 'تسوية عهدة' : (noteText.includes('فرق جرد') ? 'فرق جرد' : (isGive ? 'تسليم عهدة' : 'تسوية عهدة'))
                });
            }
        });

        // Add partner transactions (such as custody deductions / personal withdrawals that settled custody / inventory audit differences)
        const partnerTxs = (filteredPartnerTransactions).filter((tx: any) => {
            const matchesPartner = tx.partnerId === p.id || 
                                   tx.partnerId === `part_${p.id}` ||
                                   normalizeName(tx.partnerName || '').includes(nName) || 
                                   nName.includes(normalizeName(tx.partnerName || ''));
            const notesNorm = normalizeName(tx.notes || tx.description || '');
            const isCustodySettlement = notesNorm.includes('تسوية عهدة') || notesNorm.includes('خصم عهدة') || notesNorm.includes('تسوية عهده') || notesNorm.includes('خصم عهده') || notesNorm.includes('عهدة معلقة') || notesNorm.includes('عهده معلقة');
            const isAuditOrWithdrawal = tx.type === 'personal_withdrawal' || 
                                        (tx.notes && (tx.notes.includes('جرد') || tx.notes.includes('تسوية'))) ||
                                        (tx.description && (tx.description.includes('جرد') || tx.description.includes('تسوية')));
            return matchesPartner && (isCustodySettlement || isAuditOrWithdrawal);
        });

        partnerTxs.forEach((tx: any) => {
            const txNotes = tx.notes || tx.description || 'تسوية وخصم عهدة من الرصيد الجاري للشريك';
            const notesNorm = normalizeName(txNotes);
            const isCustodySettlement = notesNorm.includes('تسوية عهدة') || notesNorm.includes('خصم عهدة') || notesNorm.includes('تسوية عهده') || notesNorm.includes('خصم عهده') || notesNorm.includes('عهدة معلقة') || notesNorm.includes('عهده معلقة') || notesNorm.includes('خصم عهد');
            
            const alreadyExists = custodyDetails[targetName].some(d => d.orderNumber === tx.id);
            if (!alreadyExists) {
                custodyDetails[targetName].push({
                    customerName: txNotes,
                    orderNumber: tx.id || 'سند تسوية',
                    amount: isCustodySettlement ? -(Math.abs(Number(tx.amount) || 0)) : (Number(tx.amount) || 0),
                    type: isCustodySettlement ? 'تسوية عهدة' : (txNotes.includes('جرد') ? 'فرق جرد' : 'تسوية عهدة')
                });
            }
        });
    });

    employees.forEach(e => {
        const nName = normalizeName(e.name);
        if (isBankOrTreasuryAccount(nName) || isBankOrTreasuryAccount(e.name)) return;

        const holderId = `emp_${e.id}`;
        const empHolders = rawHolders.filter((h: any) => 
            h.userId === holderId || 
            h.userId === e.id || 
            normalizeName(h.userName) === nName
        );
        const empUserIds = [holderId, e.id, ...empHolders.map(h => h.userId)];

        const empHandovers = filteredHandovers.filter(h => 
            empUserIds.includes(h.fromUserId) || 
            empUserIds.includes(h.toUserId) || 
            normalizeName(h.toUserName || '').includes(nName) || 
            normalizeName(h.fromUserName || '').includes(nName)
        );

        const settlements = empHandovers.filter(h => h.toUserId === 'admin_deduction' || (h.toUserName && h.toUserName.includes('خصم')));
        const hasSettlement = settlements.length > 0;

        let activeHandovers = [];
        if (hasSettlement) {
            const lastSettlementDate = settlements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date;
            activeHandovers = empHandovers.filter(h => new Date(h.date).getTime() > new Date(lastSettlementDate).getTime());
        } else {
            activeHandovers = empHandovers;
        }

        const account = custodyAccounts.find(a => normalizeName(a.name) === nName || a.name.includes(e.name) || e.name.includes(a.name) || normalizeName(a.name).includes(nName));
        const targetName = account ? account.name : `${e.name} (موظف)`;

        activeHandovers.forEach(h => {
            const isGive = empUserIds.includes(h.toUserId) || normalizeName(h.toUserName || '').includes(nName);
            const isDeductionOrSettlement = h.toUserId === 'admin_deduction' || (h.toUserName && h.toUserName.includes('خصم')) || (h.notes && (h.notes.includes('خصم') || h.notes.includes('تسوية')));
            const noteText = h.notes || (isDeductionOrSettlement ? 'تسوية وخصم عهدة من الموظف' : (isGive ? 'تسليم عهدة تشغيلية للموظف' : 'تسوية واسترداد عهدة من الموظف'));
            
            // Check if this positive handover is an automatic mirror of an order already listed in custodyDetails
            if (!isDeductionOrSettlement && isGive) {
                const isAutoOrderHandover = (h.id && (h.id.startsWith('pos-handover') || h.id.startsWith('virtual-adv') || h.id.startsWith('hd-'))) ||
                                           (h.notes && (h.notes.includes('طلب #') || h.notes.includes('دفع مقدم') || h.notes.includes('مبيعات كاشير') || h.notes.includes('عربون')));
                
                const matchInDetails = custodyDetails[targetName].some(d => {
                    const orderNumMatch = d.orderNumber && (h.id.includes(d.orderNumber) || (h.notes && h.notes.includes(d.orderNumber)));
                    const custNameMatch = d.customerName && h.notes && h.notes.includes(d.customerName);
                    return orderNumMatch || custNameMatch;
                });

                if (isAutoOrderHandover && matchInDetails) {
                    return;
                }
            }

            if (!custodyDetails[targetName]) {
                custodyDetails[targetName] = [];
            }
            const alreadyExists = custodyDetails[targetName].some(d => d.orderNumber === h.id);
            if (!alreadyExists) {
                custodyDetails[targetName].push({
                    customerName: noteText,
                    orderNumber: h.id || 'سند تسوية',
                    amount: isDeductionOrSettlement ? -(Math.abs(Number(h.amount) || 0)) : (isGive ? (Number(h.amount) || 0) : -(Number(h.amount) || 0)),
                    type: isDeductionOrSettlement ? 'تسوية عهدة' : (noteText.includes('فرق جرد') ? 'فرق جرد' : (isGive ? 'تسليم عهدة' : 'تسوية عهدة'))
                });
            }
        });

        // Add employee staff advances (such as inventory audit differences/deficits)
        const empAdvances = ((settings as any).staffAdvances || []).filter((adv: any) => {
            const matchesEmp = adv.staffId === e.id || 
                               normalizeName(adv.staffName || '').includes(nName) || 
                               nName.includes(normalizeName(adv.staffName || ''));
            return matchesEmp;
        });

        empAdvances.forEach((adv: any) => {
            if (!custodyDetails[targetName]) {
                custodyDetails[targetName] = [];
            }
            const alreadyExists = custodyDetails[targetName].some(d => d.orderNumber === adv.id);
            if (!alreadyExists) {
                custodyDetails[targetName].push({
                    customerName: adv.note || 'سلفة / عهدة موظف',
                    orderNumber: adv.id || '---',
                    amount: Number(adv.amount) || 0,
                    type: (adv.note && adv.note.includes('جرد')) ? 'فرق جرد' : 'سلفة'
                });
            }
        });
    });

    Object.keys(custodyDetails).forEach(targetName => {
        if (isBankOrTreasuryAccount(targetName)) return;
        const existsIdx = custodyAccounts.findIndex(a => normalizeName(a.name) === normalizeName(targetName) || a.name.includes(targetName) || targetName.includes(a.name));
        const details = custodyDetails[targetName] || [];
        const positiveSum = details.filter(d => d.amount > 0).reduce((s, d) => s + d.amount, 0);
        const negativeSum = details.filter(d => d.amount < 0).reduce((s, d) => s + Math.abs(d.amount), 0);
        const netBalance = Math.max(0, positiveSum - negativeSum);

        if (existsIdx === -1) {
            custodyAccounts.push({
                name: targetName,
                balance: netBalance
            });
        } else {
            custodyAccounts[existsIdx].balance = netBalance;
        }
    });

    const recommendations = [];
    if (successRate < 70) recommendations.push(`⚠️ نسبة التوصيل الناجحة منخفضة (${successRate.toFixed(1)}%). يُنصح بتعزيز التحقق التليفوني وتأكيد العنوان قبل الشحن.`);
    if (avgOrderProfit < 50) recommendations.push(`💡 متوسط ربحية الطلب الصافي (${Math.round(avgOrderProfit)} ج.م) يتطلب رفع أسعار المنتجات أو خفض مصاريف الشحن.`);
    if (totalLoss > 0 && totalProfit > 0 && (totalLoss / totalProfit) > 0.25) recommendations.push(`🚨 نسبة خسائر المرتجعات تستهلك أكثر من 25% من الأرباح التشغيلية. مراجعة جودة شركات الشحن أمر ضروري.`);
    if (totalExpenses > (totalProfit * 0.4)) recommendations.push(`📊 المصروفات الإدارية والإعلانية تمثل نسبة عالية من الربح الإجمالي. يُفضل إعادة تحسين الإنفاق الإعلاني.`);

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
    const netSales = displayProductRevenue - totalDiscount;
    const totalOutflowExpenses = (totalSuccessFeesOnly + totalLoss + totalExpenses);
    const totalGrossOverallProfit = finalNet + totalOutflowExpenses;
    const totalInflow = (displayProductRevenue - totalDiscount + displayExtraMarkup + totalShippingRevenue);

    // Compute Health Index / Efficiency score
    const healthScore = Math.min(100, Math.max(20, Math.round(
        (successRate * 0.4) + 
        (totalInflow > 0 ? Math.min(40, (finalNet / totalInflow) * 100 * 1.5) : 0) + 
        (totalLoss === 0 ? 20 : Math.max(0, 20 - (totalLoss / (totalProfit || 1)) * 30))
    )));

    const serialNumber = `FIN-REPORT-${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2,'0')}${new Date().getDate().toString().padStart(2,'0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const summaryHtml = s.showSummary ? `
            <div class="executive-kpi-bar">
                <div class="kpi-box primary">
                    <div class="kpi-label">إجمالي التدفقات الداخلة</div>
                    <div class="kpi-value">+${fmt(totalInflow)} <span class="unit">ج.م</span></div>
                    <div class="kpi-sub">المبيعات + الشحن + الإضافات</div>
                </div>
                <div class="kpi-box danger">
                    <div class="kpi-label">إجمالي التكاليف والمصروفات</div>
                    <div class="kpi-value">-${fmt(totalOutflowExpenses)} <span class="unit">ج.م</span></div>
                    <div class="kpi-sub">رسوم + خسائر + مصاريف</div>
                </div>
                <div class="kpi-box success">
                    <div class="kpi-label">صافي الربح النهائي الخالص</div>
                    <div class="kpi-value">${finalNet >= 0 ? '+' : ''}${fmt(finalNet)} <span class="unit">ج.م</span></div>
                    <div class="kpi-sub">صافي القيمة بعد استقطاع كافة التكاليف</div>
                </div>
                <div class="kpi-box info">
                    <div class="kpi-label">نسبة نجاح التسليم</div>
                    <div class="kpi-value">${successRate.toFixed(1)}%</div>
                    <div class="kpi-sub">${collectedOrders.length} طلب ناجح من أصل ${orders.length}</div>
                </div>
                <div class="kpi-box score">
                    <div class="kpi-label">مؤشر الصحة المالية الذكي</div>
                    <div class="kpi-value">${healthScore}/100</div>
                    <div class="kpi-sub">${healthScore >= 80 ? '🟢 أداء ممتاز ومستقر' : healthScore >= 60 ? '🟡 أداء جيد مع فرص تحسين' : '🔴 ينصح بمراجعة المصاريف'}</div>
                </div>
            </div>

            <!-- Modern Financial Waterfall Timeline Visualizer -->
            <div class="waterfall-card">
                <div class="waterfall-header">
                    <h4 class="waterfall-title">📊 المسار المالي المتسلسل (Financial Flow Diagram)</h4>
                    <span class="waterfall-badge">رصد حركي للسيولة</span>
                </div>
                <div class="waterfall-steps">
                    <div class="wf-step">
                        <div class="wf-circle bg-blue">1</div>
                        <div class="wf-info">
                            <span class="wf-title">${totalDiscount > 0 ? 'صافي المبيعات' : 'إجمالي المبيعات'}</span>
                            <span class="wf-amount blue">+${fmt(netSales)} ج.م</span>
                        </div>
                    </div>
                    <div class="wf-arrow">←</div>
                    <div class="wf-step">
                        <div class="wf-circle bg-amber">2</div>
                        <div class="wf-info">
                            <span class="wf-title">تكلفة البضاعة (COGS)</span>
                            <span class="wf-amount amber">-${fmt(totalCogs)} ج.م</span>
                        </div>
                    </div>
                    <div class="wf-arrow">←</div>
                    <div class="wf-step">
                        <div class="wf-circle bg-emerald">3</div>
                        <div class="wf-info">
                            <span class="wf-title">مجمل ربح المنتجات</span>
                            <span class="wf-amount emerald">+${fmt(displayProductGrossProfit)} ج.م</span>
                        </div>
                    </div>
                    <div class="wf-arrow">←</div>
                    <div class="wf-step">
                        <div class="wf-circle bg-rose">4</div>
                        <div class="wf-info">
                            <span class="wf-title">المصاريف والخسائر والتسويات</span>
                            <span class="wf-amount rose">-${fmt(displayProductGrossProfit - finalNet)} ج.م</span>
                        </div>
                    </div>
                    <div class="wf-arrow">←</div>
                    <div class="wf-step highlight">
                        <div class="wf-circle bg-indigo">5</div>
                        <div class="wf-info">
                            <span class="wf-title">الصافي النهائي الخالص</span>
                            <span class="wf-amount indigo">${fmt(finalNet)} ج.م</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="stage-banner">
                <div class="stage-number">1</div>
                <h3 class="stage-title">المرحلة الأولى: تحليل الإيرادات والتدفقات الداخلة (Revenues & Inflows)</h3>
            </div>
            <table class="modern-table">
                <thead><tr><th style="text-align: right;">بند الإيرادات والتدفقات</th><th>المبلغ المحصل (ج.م)</th></tr></thead>
                <tbody>
                    <tr><td style="text-align: right;">مبيعات المنتجات (${s.includeMarkupsInProductRevenue ? 'شاملة تعلية السعر والزيادات' : 'بالسعر الأساسي'})</td><td style="color: var(--success); font-weight: bold;">+${fmt(displayProductRevenue)} ج.م</td></tr>
                    ${totalDiscount > 0 ? `<tr><td style="text-align: right;">(-) الخصومات الممنوحة للعملاء</td><td style="color: var(--danger); font-weight: bold;">-${fmt(totalDiscount)} ج.م</td></tr>` : ''}
                    ${s.showExtraServicesRow ? `<tr><td style="text-align: right;">إيرادات الخدمات الإضافية ${s.includeMarkupsInProductRevenue ? 'والمعاينة والتسويات' : 'وتعلية السعر والمعاينة والتسويات'}</td><td style="color: var(--success); font-weight: bold;">+${fmt(displayExtraMarkup)} ج.م</td></tr>` : ''}
                    <tr><td style="text-align: right;">إجمالي تحصيل الشحن من العملاء</td><td style="color: var(--success); font-weight: bold;">+${fmt(totalShippingRevenue)} ج.م</td></tr>
                    <tr class="total-row"><td style="text-align: right; font-weight: 900;">إجمالي التدفقات النقدية الداخلة الكلية</td><td style="font-weight: 900; color: #047857;">+${fmt(totalInflow)} ج.م</td></tr>
                </tbody>
            </table>

            <div class="stage-banner" style="border-right-color: var(--danger);">
                <div class="stage-number" style="background: var(--danger);">2</div>
                <h3 class="stage-title">المرحلة الثانية: التكاليف والمصروفات التشغيلية (Operating Costs & Expenses)</h3>
            </div>
            <table class="modern-table">
                <thead><tr><th style="text-align: right;">بند التكاليف والمصروفات</th><th>المبلغ (ج.م)</th></tr></thead>
                <tbody>
                    <tr><td style="text-align: right;">رسوم تشغيل (تأمين + معاينة + COD) للناجح</td><td style="color: var(--danger); font-weight: bold;">-${fmt(totalSuccessFeesOnly)} ج.م</td></tr>
                    <tr><td style="text-align: right;">خسائر المرتجعات وفشل التوصيل (شحن مهدر)</td><td style="color: var(--danger); font-weight: bold;">-${fmt(totalLoss)} ج.م</td></tr>
                    <tr><td style="text-align: right;">المصروفات الإدارية والتشغيلية (إعلانات، رواتب، إيجار)</td><td style="color: var(--danger); font-weight: bold;">-${fmt(totalExpenses)} ج.م</td></tr>
                    <tr class="total-row"><td style="text-align: right; font-weight: 900;">إجمالي التكاليف والمصروفات التشغيلية</td><td style="color: var(--danger); font-weight: 900;">-${fmt(totalOutflowExpenses)} ج.م</td></tr>
                </tbody>
            </table>

            <div class="final-banner">
                <div style="font-size: 20px; opacity: 0.9; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">صافي الربح النهائي الخالص للمتجر</div>
                <div class="amount">${fmt(finalNet)} <span style="font-size: 28px;">ج.م</span></div>
                <p style="opacity: 0.85; font-size: 16px;">نقطة التعادل: تحتاج إلى <strong style="color: #fde047; text-decoration: underline;">${breakEvenOrders}</strong> طلب ناجح إضافي لتغطية كافة المصروفات الإدارية الثابتة.</p>
            </div>` : '';

    const incomeStatementHtml = s.showIncomeStatement ? `
            <h2 class="section-header">${sectionCounter++}. قائمة الدخل الموحدة (Statement of Income)</h2>
            <table class="modern-table" style="background: var(--slate-50);">
                <thead>
                    <tr><th style="text-align: right;">البند المالي</th><th>القيمة (ج.م)</th></tr>
                </thead>
                <tbody>
                    <tr><td style="text-align: right; font-weight: bold;">(+) إجمالي مبيعات المنتجات والخدمات</td><td>${fmt(displayProductRevenue)}</td></tr>
                    ${totalDiscount > 0 ? `<tr><td style="text-align: right;">(-) الخصومات الممنوحة للعملاء</td><td style="color: var(--danger);">-${fmt(totalDiscount)}</td></tr>` : ''}
                    <tr><td style="text-align: right;">(-) تكلفة البضاعة المباعة (COGS)</td><td style="color: var(--danger);">-${fmt(totalCogs)}</td></tr>
                    <tr class="total-row"><td style="text-align: right;">(=) مجمل ربح المنتجات (Product Gross Profit)</td><td>${fmt(displayProductGrossProfit)}</td></tr>
                    ${s.showExtraServicesRow ? `<tr><td style="text-align: right;">(+) أرباح الخدمات والإضافات (${s.includeMarkupsInProductRevenue ? 'معاينة / تعديل يدوي' : 'زيادة سعر / معاينة / تعديل يدوي'})</td><td style="color: var(--success);">+${fmt(displayExtraMarkup)}</td></tr>` : ''}
                    <tr><td style="text-align: right;">(+) أرباح زيادة الشحن (Shipping Markup)</td><td style="color: var(--success);">+${fmt(totalShippingRevenue - totalSuccessShippingOnly)}</td></tr>
                    <tr><td style="text-align: right;">(-) رسوم تشغيل الطلبات الناجحة (تأمين/معاينة/تحصيل)</td><td style="color: var(--danger);">-${fmt(totalSuccessFeesOnly)}</td></tr>
                    <tr><td style="text-align: right;">(-) خسائر المرتجعات وفشل التوصيل</td><td style="color: var(--danger);">-${fmt(totalLoss)}</td></tr>
                    <tr><td style="text-align: right;">(-) المصروفات الإدارية والتشغيلية</td><td style="color: var(--danger);">-${fmt(totalExpenses)}</td></tr>
                    <tr class="total-row" style="background: var(--primary) !important; color: white !important;">
                        <td style="text-align: right;">(=) صافي الربح النهائي (Net Profit)</td>
                        <td>${fmt(finalNet)}</td>
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

    let collectionLogHtml = '';
    if (s.showCollectionLog) {
        if (shippingCollectedRows) {
            collectionLogHtml += `
            <h2 class="section-header">${sectionCounter++}. سجل التحصيل المالي - الشحن (Shipping Collection Log)</h2>
            <table class="modern-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th style="text-align: right;">العميل</th>
                        ${s.showColProducts ? '<th>المنتجات</th>' : ''}
                        ${s.showColPrice ? '<th>السعر</th>' : ''}
                        ${s.showColDiscounts ? '<th>الخصومات</th>' : ''}
                        ${s.showColPriceAfterDiscount ? '<th>السعر بعد الخصم</th>' : ''}
                        ${s.showColCost ? '<th>التكلفة</th>' : ''}
                        ${s.showColSurplusProfit ? '<th>ربح الزيادة</th>' : ''}
                        ${s.showColPercentageProfit ? '<th>ربح النسبة</th>' : ''}
                        ${s.showColTotalProfitBeforeExpenses ? '<th>إجمالي الربح (قبل المصاريف)</th>' : ''}
                        ${s.showColShipping ? '<th>الشحن</th>' : ''}
                        ${s.showColInsurance ? '<th>تأمين</th>' : ''}
                        ${s.showColTax ? '<th>ضريبة</th>' : ''}
                        ${s.showColInspection ? '<th>معاينة</th>' : ''}
                        ${s.showColCod ? '<th>COD</th>' : ''}
                        ${s.showColNetProfit ? '<th>الصافي</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${shippingCollectedRows}
                    <tr class="total-row" style="background-color: #f1f5f9; font-weight: bold; border-top: 2px solid #cbd5e1;">
                        <td style="text-align: center; font-weight: bold; background-color: #f1f5f9;">-</td>
                        <td style="text-align: right; font-weight: bold; background-color: #f1f5f9;">الإجمالي</td>
                        ${s.showColProducts ? '<td style="background-color: #f1f5f9;"></td>' : ''}
                        ${s.showColPrice ? `
                        <td style="background-color: #f1f5f9;">
                           ${fmt(ship_sumProductPrice)}
                           ${ship_totalExcluded > 0 ? `<div style="font-size: 9px; color: #b91c1c; margin-top: 2px;">مستبعد: ${fmt(ship_totalExcluded)}</div>` : ''}
                        </td>
                        ` : ''}
                        ${s.showColDiscounts ? `<td style="background-color: #f1f5f9; color: #b91c1c;">${fmt(ship_sumDiscounts)}</td>` : ''}
                        ${s.showColPriceAfterDiscount ? `<td style="background-color: #f1f5f9;">${fmt(ship_sumPriceAfterDiscount)}</td>` : ''}
                        ${s.showColCost ? `<td style="background-color: #f1f5f9;">${fmt(ship_totalCogs)}</td>` : ''}
                        ${s.showColSurplusProfit ? `<td style="background-color: #f1f5f9; color: #0284c7; font-weight: bold;">${fmt(ship_totalSurplusProfit)}</td>` : ''}
                        ${s.showColPercentageProfit ? `<td style="background-color: #f1f5f9; color: #4f46e5; font-weight: bold;">${fmt(ship_totalPercentageProfit)}</td>` : ''}
                        ${s.showColTotalProfitBeforeExpenses ? `<td style="background-color: #f1f5f9; color: #059669; font-weight: bold;">${fmt(ship_totalProfitBeforeExpenses)}</td>` : ''}
                        ${s.showColShipping ? `<td style="background-color: #f1f5f9;">${fmt(ship_sumShippingFee)}</td>` : ''}
                        ${s.showColInsurance ? `<td style="background-color: #f1f5f9;">${fmt(ship_totalInsurance)}</td>` : ''}
                        ${s.showColTax ? `<td style="background-color: #f1f5f9;">${fmt(ship_sumTax)}</td>` : ''}
                        ${s.showColInspection ? `<td style="background-color: #f1f5f9;">${fmt(ship_totalInspection)}</td>` : ''}
                        ${s.showColCod ? `<td style="background-color: #f1f5f9;">${fmt(ship_totalCod)}</td>` : ''}
                        ${s.showColNetProfit ? `<td style="color: #15803d; font-weight: bold; background-color: #f1f5f9;">${fmt(ship_totalProfit)}</td>` : ''}
                    </tr>
                </tbody>
            </table>`;
        }
        
        if (posCollectedRows) {
            collectionLogHtml += `
            <h2 class="section-header">${sectionCounter++}. سجل التحصيل المالي - نقاط البيع (POS Collection Log)</h2>
            <table class="modern-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th style="text-align: right;">العميل</th>
                        ${s.showColProducts ? '<th>المنتجات</th>' : ''}
                        ${s.showColPrice ? '<th>السعر</th>' : ''}
                        ${s.showColDiscounts ? '<th>الخصومات</th>' : ''}
                        ${s.showColPriceAfterDiscount ? '<th>السعر بعد الخصم</th>' : ''}
                        ${s.showColCost ? '<th>التكلفة</th>' : ''}
                        ${s.showColSurplusProfit ? '<th>ربح الزيادة</th>' : ''}
                        ${s.showColPercentageProfit ? '<th>ربح النسبة</th>' : ''}
                        ${s.showColTotalProfitBeforeExpenses ? '<th>إجمالي الربح (قبل المصاريف)</th>' : ''}
                        ${s.showColNetProfit ? '<th>الصافي</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${posCollectedRows}
                    <tr class="total-row" style="background-color: #f1f5f9; font-weight: bold; border-top: 2px solid #cbd5e1;">
                        <td style="text-align: center; font-weight: bold; background-color: #f1f5f9;">-</td>
                        <td style="text-align: right; font-weight: bold; background-color: #f1f5f9;">الإجمالي</td>
                        ${s.showColProducts ? '<td style="background-color: #f1f5f9;"></td>' : ''}
                        ${s.showColPrice ? `
                        <td style="background-color: #f1f5f9;">
                           ${fmt(pos_sumProductPrice)}
                           ${pos_totalExcluded > 0 ? `<div style="font-size: 9px; color: #b91c1c; margin-top: 2px;">مستبعد: ${fmt(pos_totalExcluded)}</div>` : ''}
                        </td>
                        ` : ''}
                        ${s.showColDiscounts ? `<td style="background-color: #f1f5f9; color: #b91c1c;">${fmt(pos_sumDiscounts)}</td>` : ''}
                        ${s.showColPriceAfterDiscount ? `<td style="background-color: #f1f5f9;">${fmt(pos_sumPriceAfterDiscount)}</td>` : ''}
                        ${s.showColCost ? `<td style="background-color: #f1f5f9;">${fmt(pos_totalCogs)}</td>` : ''}
                        ${s.showColSurplusProfit ? `<td style="background-color: #f1f5f9; color: #0284c7; font-weight: bold;">${fmt(pos_totalSurplusProfit)}</td>` : ''}
                        ${s.showColPercentageProfit ? `<td style="background-color: #f1f5f9; color: #4f46e5; font-weight: bold;">${fmt(pos_totalPercentageProfit)}</td>` : ''}
                        ${s.showColTotalProfitBeforeExpenses ? `<td style="background-color: #f1f5f9; color: #059669; font-weight: bold;">${fmt(pos_totalProfitBeforeExpenses)}</td>` : ''}
                        ${s.showColNetProfit ? `<td style="color: #15803d; font-weight: bold; background-color: #f1f5f9;">${fmt(pos_totalProfit)}</td>` : ''}
                    </tr>
                </tbody>
            </table>`;
        }
    }

    const lossLogHtml = (failedRows && s.showLossLog) ? `
            <h2 class="section-header" style="color: var(--danger);">${sectionCounter++}. سجل المرتجعات والخسائر (Loss Log)</h2>
            <table class="modern-table">
                <thead><tr><th>#</th><th style="text-align: right;">العميل</th><th>المنتجات</th><th>الحالة</th><th>شحن</th><th>تأمين وضريبة</th><th>معاينة</th><th>مرتجع</th><th>الخسارة</th></tr></thead>
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

    const partnerExpenseBreakdown = (partners || []).map(p => {
        const normP = normalizeName(p.name);
        const pTxs = filteredPartnerTransactions.filter(t => {
            const matchesId = t.partnerId === p.id || t.partnerId === `part_${p.id}` || t.partnerId === `partner_${p.id}`;
            const matchesName = t.partnerName && normalizeName(t.partnerName) === normP;
            const matchesNote = t.notes && normalizeName(t.notes).includes(normP);
            return matchesId || matchesName || matchesNote;
        });

        const directExpenses = adminExpenses.filter(e => {
            const isExplicitPartnerId = (e.details?.paidByPartnerId === p.id) || (e.details?.partnerId === p.id) || ((e as any).partnerId === p.id);
            if (isExplicitPartnerId) return true;

            // If it was paid from a bank or treasury account, it is not a partner personal expense
            const tAccId = e.details?.treasuryAccountId || (e as any).treasuryAccountId;
            if (tAccId && tAccId !== '') return false;

            const normPayer = normalizeName(e.details?.expensePaidBy || e.details?.payerName || '');
            if (normPayer && normPayer === normP) return true;

            const normNote = normalizeName(e.note || '');
            const hasPayerKeyword = normNote.includes(`بواسطه ${normP}`) || normNote.includes(`بواسطة ${normP}`) || normNote.includes(`دفعهم ${normP}`) || normNote.includes(`سداد ${normP}`);
            return hasPayerKeyword;
        });
        const directExpensesTotal = directExpenses.reduce((sum, e) => {
            const text = e.details?.expensePaidBy || e.note;
            const regex = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*دفعهم\\s*${p.name}`, 'i');
            const match = text?.match(regex);
            if (match && parseFloat(match[1]) > 0) {
                return sum + parseFloat(match[1]);
            }
            return sum + (Number(e.amount) || 0);
        }, 0);

        const fundedExpenses = pTxs.filter(t => ['expense_coverage', 'supply_funding', 'shipping_funding'].includes(t.type));
        const fundedExpensesTotal = fundedExpenses.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const totalPartnerExpenses = directExpensesTotal + fundedExpensesTotal;

        return {
            partner: p,
            directExpensesTotal,
            fundedExpensesTotal,
            totalPartnerExpenses,
            count: directExpenses.length + fundedExpenses.length
        };
    });

    const totalPartnerDirectPaid = partnerExpenseBreakdown.reduce((sum, b) => sum + b.directExpensesTotal, 0);
    const treasuryPaidExpenses = Math.max(0, totalExpenses - totalPartnerDirectPaid);

    const expensesLogHtml = s.showExpensesLog ? `
            <h2 class="section-header">${sectionCounter++}. المصروفات الإدارية والتشغيلية (Expenses Log)</h2>
            
            <!-- ملخص إجمالي مصروف كل شريك -->
            <div style="margin-bottom: 15px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: #ffffff; padding: 9px 14px; font-weight: 800; font-size: 13px; display: flex; justify-content: space-between; align-items: center;">
                    <span>📊 إجمالي وتحليل المصروفات حسب جهة السداد والشركاء</span>
                    <span style="font-size: 11px; opacity: 0.9; font-weight: normal;">(تحديد نصيب ومساهمة كل طرف في التكاليف)</span>
                </div>
                <table class="modern-table" style="margin: 0; font-size: 11.5px;">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                            <th style="text-align: right; width: 35%;">جهة السداد / الشريك</th>
                            <th style="width: 20%;">عدد البنود</th>
                            <th style="width: 25%;">إجمالي ما صرفه وسدده</th>
                            <th style="width: 20%;">النسبة المئوية</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${partnerExpenseBreakdown.map(b => {
                            const percent = totalExpenses > 0 ? ((b.totalPartnerExpenses / totalExpenses) * 100).toFixed(1) : '0';
                            return `
                                <tr>
                                    <td style="font-weight: bold; color: #1e3a8a; text-align: right;">
                                        👤 سداد بواسطة الشريك: <strong>${b.partner.name}</strong>
                                        <span style="font-size: 9.5px; color: #64748b; margin-right: 4px;">(${((b.partner as any).profitPercentage || b.partner.profitRatio || 0)}% حصة)</span>
                                    </td>
                                    <td>${b.count} عملية</td>
                                    <td style="font-weight: bold; color: #b91c1c; font-family: monospace; font-size: 12px;">${b.totalPartnerExpenses.toLocaleString()} ج.م</td>
                                    <td style="font-weight: bold; color: #4338ca;">${percent}%</td>
                                </tr>
                            `;
                        }).join('')}
                        <tr>
                            <td style="font-weight: bold; color: #059669; text-align: right;">🏦 الخزينة العامة والمحافظ الإلكترونية</td>
                            <td>${adminExpenses.length - partnerExpenseBreakdown.reduce((sum, b) => sum + b.count, 0)} عملية</td>
                            <td style="font-weight: bold; color: #059669; font-family: monospace; font-size: 12px;">${treasuryPaidExpenses.toLocaleString()} ج.م</td>
                            <td style="font-weight: bold; color: #059669;">${totalExpenses > 0 ? ((treasuryPaidExpenses / totalExpenses) * 100).toFixed(1) : '0'}%</td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr style="background: #f1f5f9; font-weight: 800; border-top: 2px solid #94a3b8;">
                            <td style="text-align: right; color: #0f172a;">الإجمالي العام لكافة المصروفات</td>
                            <td>${adminExpenses.length} عملية</td>
                            <td style="color: #b91c1c; font-family: monospace; font-size: 13px;">${totalExpenses.toLocaleString()} ج.م</td>
                            <td style="color: #0f172a;">100%</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <table class="modern-table">
                <thead><tr><th>التاريخ</th><th style="text-align: right;">البيان والتفاصيل</th><th>جهة الدفع</th><th>المبلغ</th></tr></thead>
                <tbody>
                    ${expenseRows || '<tr><td colspan="4">لا توجد مصروفات إدارية خلال هذه الفترة.</td></tr>'}
                    <tr class="total-row"><td colspan="3" style="text-align: right;">إجمالي المصروفات</td><td>${totalExpenses.toLocaleString()} ج.م</td></tr>
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

    const partnerDetailsHtml = (partners.length > 0 && s.showPartners) ? (() => {
        const getPartnerCustody = (partnerName: string) => {
            const nName = normalizeName(partnerName);
            const acc = custodyAccounts.find(a => {
                const nA = normalizeName(a.name);
                return nA === nName || nA.includes(nName) || nName.includes(nA);
            });
            const detailsKey = Object.keys(custodyDetails).find(k => {
                const nK = normalizeName(k);
                return nK === nName || nK.includes(nName) || nName.includes(nK);
            });
            const details = detailsKey ? custodyDetails[detailsKey] : [];
            const posSum = details.filter(d => d.amount > 0).reduce((s, d) => s + d.amount, 0);
            const negSum = details.filter(d => d.amount < 0).reduce((s, d) => s + Math.abs(d.amount), 0);
            const netFromDetails = Math.max(0, posSum - negSum);

            const allTxs = filteredPartnerTransactions.filter(t => {
                const notes = (t.notes || t.description || '').toLowerCase();
                const isEqualization = notes.includes('تسوية') && (notes.includes('مخزون') || notes.includes('بضاعة') || notes.includes('مقاصة'));
                return !isEqualization;
            });
            const hasCustodySettlementTx = allTxs.some((t: any) => {
                const matchesPartner = (t.partnerName && normalizeName(t.partnerName).includes(nName)) || (t.notes && normalizeName(t.notes).includes(nName));
                const notesNorm = normalizeName(t.notes || t.description || '');
                return matchesPartner && (notesNorm.includes('تسوية عهدة') || notesNorm.includes('خصم عهدة') || notesNorm.includes('تسوية عهده') || notesNorm.includes('خصم عهده') || notesNorm.includes('عهدة معلقة') || notesNorm.includes('عهده معلقة'));
            });

            const hasSettlementHandover = filteredHandovers.some((h: any) => 
                (h.toUserId === 'admin_deduction' || (h.toUserName && h.toUserName.includes('خصم')) || (h.notes && (h.notes.includes('خصم') || h.notes.includes('تسوية')))) && 
                (normalizeName(h.fromUserName || '').includes(nName) || normalizeName(h.toUserName || '').includes(nName))
            );

            if (hasCustodySettlementTx || hasSettlementHandover || negSum > 0) {
                return netFromDetails;
            }

            if (details.length > 0) {
                return netFromDetails;
            }

            const baseBalance = acc ? acc.balance : (mergedHolders[nName]?.balance || 0);
            return Math.max(0, baseBalance);
        };

        let totalCapitalSum = 0;
        let totalProfitShareSum = 0;
        let totalDistributedSum = 0;
        let totalUndistributedSum = 0;
        let totalInventoryShareSum = 0;
        let totalWithdrawalsSum = 0;
        let totalCustodySum = 0;
        let totalBalanceSum = 0;

        const partnerCalculatedList: Array<{
            name: string;
            profitRatio: number;
            capital: number;
            distributed: number;
            undistributed: number;
            totalProfits: number;
            totalRights: number;
            withdrawals: number;
            netExitCash: number;
            inventoryShare: number;
            inventoryDiff: number;
        }> = [];

        const partnerRowsHtml = partners.map(p => {
            const partnerGrossShare = (p.profitRatio / 100) * finalNet;
            const normPName = normalizeName(p.name);
            const allTxs = filteredPartnerTransactions;
            const partnerTxs = allTxs.filter(t => {
                const matchesId = t.partnerId === p.id || t.partnerId === `part_${p.id}` || t.partnerId === `partner_${p.id}`;
                const matchesName = t.partnerName && normalizeName(t.partnerName) === normPName;
                const matchesNote = t.notes && normalizeName(t.notes).includes(normPName);
                return matchesId || matchesName || matchesNote;
            });

            const partnerCapital = (p as any).capital || (p as any).initialCapital || 
                partnerTxs.filter(t => ['capital_addition', 'supply_funding', 'shipping_funding', 'expense_coverage'].includes(t.type)).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

            const partnerDistributed = partnerTxs
                .filter(t => t.type === 'profit_distribution')
                .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

            const partnerUndistributed = Math.max(0, partnerGrossShare - partnerDistributed);

            const inventoryShare = (p.profitRatio / 100) * (totalInventoryValue || 0);

            const withdrawalTxs = partnerTxs.filter(t => {
                const isWithdrawalType = ['profit_withdrawal', 'loan', 'personal_withdrawal', 'custody_withdrawal', 'wallet_withdrawal', 'withdrawal', 'draw'].includes(t.type) ||
                    (t.amount > 0 && t.type !== 'capital_addition' && t.type !== 'profit_distribution' && t.type !== 'repayment' && t.type !== 'supply_funding' && t.type !== 'shipping_funding' && t.type !== 'expense_coverage' && t.type !== 'internal_transfer_in' && t.type !== 'custody_receive');
                
                if (!isWithdrawalType) return false;
                
                // Exclude equalization settlements from being listed as active withdrawals in the new period
                const notes = (t.notes || t.description || '').toLowerCase();
                const isEqualization = notes.includes('تسوية') && (notes.includes('مخزون') || notes.includes('بضاعة') || notes.includes('مقاصة'));
                
                // If it's an equalization transaction and we are in a filtered period report, exclude it
                if (isEqualization && reportStartDate) {
                    const txDate = new Date(t.date);
                    // Only exclude if it happened at the exact start of the period (likely a closing adjustment)
                    if (txDate.getTime() <= reportStartDate.getTime() + 86400000) {
                        return false;
                    }
                }
                
                return true;
            });

            const totalWithdrawals = withdrawalTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
            const partnerCustody = getPartnerCustody(p.name);
            const curBalance = p.balance || 0;

            // حساب معادلة البضاعة (الفارق بين الرصيد المتاح وحصة البضاعة)
            const balanceDiff = curBalance - inventoryShare;

            totalCapitalSum += partnerCapital;
            totalProfitShareSum += partnerGrossShare;
            totalDistributedSum += partnerDistributed;
            totalUndistributedSum += partnerUndistributed;
            totalInventoryShareSum += inventoryShare;
            totalWithdrawalsSum += totalWithdrawals;
            totalCustodySum += partnerCustody;
            totalBalanceSum += curBalance;

            const totalPartnerProfits = partnerDistributed + partnerUndistributed;
            const totalRights = partnerCapital + totalPartnerProfits;
            const netExitCash = totalRights - totalWithdrawals;

            partnerCalculatedList.push({
                name: p.name,
                profitRatio: p.profitRatio,
                capital: partnerCapital,
                distributed: partnerDistributed,
                undistributed: partnerUndistributed,
                totalProfits: totalPartnerProfits,
                totalRights: totalRights,
                withdrawals: totalWithdrawals,
                netExitCash: netExitCash,
                inventoryShare: inventoryShare,
                inventoryDiff: netExitCash - inventoryShare
            });

            let statusLabel = 'مسدد بالكامل';
            let statusBg = '#eff6ff';
            let statusColor = '#1d4ed8';
            let statusBorder = '#bfdbfe';

            if (p.balance > 0) {
                statusLabel = 'دائن بمستحقات';
                statusBg = '#ecfdf5';
                statusColor = '#047857';
                statusBorder = '#a7f3d0';
            } else if (p.balance < 0) {
                statusLabel = 'مدين بمسحوبات';
                statusBg = '#fef2f2';
                statusColor = '#b91c1c';
                statusBorder = '#fecaca';
            }

            let withdrawalsHtml = '';
            if (withdrawalTxs.length > 0) {
                withdrawalsHtml = `
                    <div style="text-align: right; font-size: 10px;">
                        <div style="font-weight: 800; color: #b91c1c; margin-bottom: 5px; font-size: 11px; background: #fff1f2; padding: 3px 6px; border-radius: 5px; border: 1px solid #fecdd3; display: flex; justify-content: space-between; align-items: center;">
                            <span>إجمالي المسحوبات والتسويات:</span>
                            <span style="font-size: 12px; font-family: monospace;">-${totalWithdrawals.toLocaleString()} ج.م</span>
                        </div>
                        ${withdrawalTxs.map(t => {
                            const amt = Number(t.amount) || 0;
                            let badge = 'مسحوبات';
                            let badgeBg = '#ffe4e6';
                            let badgeColor = '#9f1239';
                            let badgeBorder = '#fca5a5';

                            const notes = t.notes || t.description || t.category || t.note || '';
                            const notesNorm = normalizeName(notes);

                            if (notesNorm.includes('عهدة') || notesNorm.includes('عهده') || notesNorm.includes('تسوية عهدة') || notesNorm.includes('خصم عهدة') || notesNorm.includes('تسوية عهده') || notesNorm.includes('خصم عهده')) {
                                badge = 'تسوية عهدة';
                                badgeBg = '#fef3c7';
                                badgeColor = '#92400e';
                                badgeBorder = '#fde68a';
                            } else if (t.type === 'loan' || notesNorm.includes('سلفة') || notesNorm.includes('سلفه')) {
                                badge = 'سلفة';
                                badgeBg = '#fffbeb';
                                badgeColor = '#b45309';
                                badgeBorder = '#fde68a';
                            } else if (t.type === 'wallet_withdrawal' || notesNorm.includes('محفظة') || notesNorm.includes('سحب محفظة') || notesNorm.includes('بنك')) {
                                badge = 'سحب محفظة';
                                badgeBg = '#f0fdf4';
                                badgeColor = '#15803d';
                                badgeBorder = '#bbf7d0';
                            } else if (t.type === 'profit_withdrawal') {
                                badge = 'سحب أرباح';
                                badgeBg = '#f0f9ff';
                                badgeColor = '#0369a1';
                                badgeBorder = '#bae6fd';
                            }

                            const displayNote = notes || (badge === 'سلفة' ? 'مسحوبات شخصية' : 'مسحوبات شريك');
                            const dateStr = t.date ? new Date(t.date).toLocaleDateString('ar-EG') : '---';

                            return `
                                <div style="margin-bottom: 3px; padding: 4px 6px; background: #fff5f5; border: 1px solid #fecdd3; border-radius: 5px; display: flex; justify-content: space-between; align-items: center; gap: 6px;">
                                    <div style="display: flex; flex-direction: column; align-items: flex-start; text-align: right; flex: 1;">
                                        <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                                            <span style="font-size: 8px; background: ${badgeBg}; color: ${badgeColor}; padding: 1px 4px; border-radius: 3px; border: 1px solid ${badgeBorder}; font-weight: bold;">${badge}</span>
                                            <strong style="color: #0f172a; font-size: 10px;">${displayNote}</strong>
                                        </div>
                                        <span style="font-size: 8px; color: #64748b; margin-top: 1px;">📅 ${dateStr}</span>
                                    </div>
                                    <span style="font-weight: bold; color: #b91c1c; font-size: 11px; white-space: nowrap; font-family: monospace;">-${amt.toLocaleString()} ج.م</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            } else if (totalWithdrawals > 0) {
                withdrawalsHtml = `<span style="font-weight: bold; color: #b91c1c; font-family: monospace;">-${totalWithdrawals.toLocaleString()} ج.م</span>`;
            } else {
                withdrawalsHtml = `<span style="color: #94a3b8; font-style: italic; font-size: 11px;">لا توجد مسحوبات</span>`;
            }

            const distributedHtml = partnerDistributed > 0
                ? `<div style="font-weight: bold; color: #059669; font-family: monospace;">+${partnerDistributed.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</div><div style="font-size: 8.5px; color: #15803d; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 3px; padding: 1px 4px; display: inline-block; margin-top: 2px; font-weight: bold;">✓ موزع بالكامل</div>`
                : `<span style="color: #94a3b8; font-family: monospace;">0 ج.م</span>`;

            const undistributedHtml = partnerUndistributed > 0
                ? `<div style="font-weight: bold; color: #d97706; font-family: monospace;">+${partnerUndistributed.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</div><div style="font-size: 8.5px; color: #b45309; background: #fffbeb; border: 1px solid #fde68a; border-radius: 3px; padding: 1px 4px; display: inline-block; margin-top: 2px;">قيد التوزيع</div>`
                : `<div style="font-weight: bold; color: #64748b; font-family: monospace;">0 ج.م</div><div style="font-size: 8.5px; color: #047857; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 3px; padding: 1px 4px; display: inline-block; margin-top: 2px; font-weight: bold;">(مصفّر)</div>`;

            let equalizationHtml = '';
            if (balanceDiff > 0.01) {
                equalizationHtml = `
                    <div style="font-weight: 800; color: #0284c7; font-size: 11px; font-family: monospace;">يسحب: +${balanceDiff.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</div>
                    <div style="font-size: 8.5px; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; border-radius: 3px; padding: 1px 4px; display: inline-block; margin-top: 2px; font-weight: bold;">فائض متاح للسحب</div>
                `;
            } else if (balanceDiff < -0.01) {
                const deficit = Math.abs(balanceDiff);
                equalizationHtml = `
                    <div style="font-weight: 800; color: #dc2626; font-size: 11px; font-family: monospace;">يودع: ${deficit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</div>
                    <div style="font-size: 8.5px; background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 3px; padding: 1px 4px; display: inline-block; margin-top: 2px; font-weight: bold;">عجز لتغطية البضاعة</div>
                `;
            } else {
                equalizationHtml = `
                    <div style="font-weight: bold; color: #059669; font-size: 11px; font-family: monospace;">0 ج.م</div>
                    <div style="font-size: 8.5px; background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; border-radius: 3px; padding: 1px 4px; display: inline-block; margin-top: 2px; font-weight: bold;">متعادل مع البضاعة ✓</div>
                `;
            }

            return `<tr>
                <td style="font-weight: bold; color: #1e3a8a; font-size: 12.5px;">${p.name}</td>
                <td style="font-weight: bold; text-align: center;">${p.profitRatio}%</td>
                <td style="font-weight: bold; color: #4338ca; font-family: monospace; text-align: center;">${partnerCapital > 0 ? partnerCapital.toLocaleString() + ' ج.م' : '0 ج.م'}</td>
                <td style="font-weight: bold; text-align: center;">${distributedHtml}</td>
                <td style="font-weight: bold; text-align: center;">${undistributedHtml}</td>
                <td style="font-weight: bold; color: #0284c7; font-family: monospace; text-align: center;">${inventoryShare > 0 ? inventoryShare.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ج.م' : '0 ج.م'}</td>
                <td style="padding: 6px;">${withdrawalsHtml}</td>
                <td style="font-weight: bold; color: ${partnerCustody > 0 ? '#d97706' : '#059669'}; font-family: monospace; text-align: center;">
                    ${partnerCustody > 0 
                        ? `${partnerCustody.toLocaleString()} ج.م` 
                        : `0 ج.م<div style="font-size: 8px; color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 3px; padding: 1px 4px; display: inline-block; margin-top: 2px; font-weight: bold;">(مصفّرة / مسواة)</div>`}
                </td>
                <td style="font-weight: 800; background: #f8fafc; font-size: 13px; font-family: monospace; color: ${p.balance >= 0 ? '#0f172a' : '#dc2626'}; text-align: center;">${curBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</td>
                <td style="text-align: center; background: ${balanceDiff > 0.01 ? '#f0fdfa' : balanceDiff < -0.01 ? '#fff7ed' : '#f8fafc'};">${equalizationHtml}</td>
                <td style="text-align: center;">
                    <span style="font-size: 9.5px; font-weight: bold; background: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusBorder}; padding: 2px 5px; border-radius: 12px; white-space: nowrap; display: inline-block;">
                        ${statusLabel}
                    </span>
                </td>
            </tr>`;
        }).join('');

        const totalProfitRatios = partners.reduce((sum, p) => sum + (p.profitRatio || 0), 0);

        return `
        <div style="margin-top: 25px; page-break-inside: avoid;">
            <h3 style="background: #1e3a8a; color: white; padding: 10px 14px; border-radius: 6px; font-size: 16px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span>${sectionCounter++}. توزيع أرباح الشركاء والمراكز المالية الشاملة</span>
                <span style="font-size: 11px; font-weight: normal; background: rgba(255,255,255,0.2); padding: 3px 8px; border-radius: 4px;">شامل الأرباح، المخزون، ورأس المال ومقاصة البضاعة</span>
            </h3>

            <!-- ملخص توزيع الأرباح وتصفير الأرباح المتبقية -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px;">
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; text-align: right;">
                    <span style="font-size: 10px; color: #64748b; font-weight: bold; display: block; margin-bottom: 2px;">صافي أرباح الفترة الإجمالية:</span>
                    <span style="font-size: 14px; font-weight: 900; color: #0f172a; font-family: monospace;">+${finalNet.toLocaleString()} ج.م</span>
                </div>
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 8px 12px; text-align: right;">
                    <span style="font-size: 10px; color: #166534; font-weight: bold; display: block; margin-bottom: 2px;">الأرباح الموزعة (المعتمدة والمضافة للرصيد):</span>
                    <span style="font-size: 14px; font-weight: 900; color: #15803d; font-family: monospace;">+${totalDistributedSum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م ${totalUndistributedSum === 0 && totalDistributedSum > 0 ? '<span style="font-size: 9px; background: #dcfce7; color: #15803d; padding: 2px 5px; border-radius: 4px; margin-right: 4px;">✓ تم التوزيع بالكامل</span>' : ''}</span>
                </div>
                <div style="background: ${totalUndistributedSum > 0 ? '#fffbeb' : '#f8fafc'}; border: 1px solid ${totalUndistributedSum > 0 ? '#fde68a' : '#e2e8f0'}; border-radius: 6px; padding: 8px 12px; text-align: right;">
                    <span style="font-size: 10px; color: ${totalUndistributedSum > 0 ? '#92400e' : '#475569'}; font-weight: bold; display: block; margin-bottom: 2px;">الأرباح المتبقية للتوزيع:</span>
                    <span style="font-size: 14px; font-weight: 900; color: ${totalUndistributedSum > 0 ? '#d97706' : '#64748b'}; font-family: monospace;">${totalUndistributedSum.toLocaleString()} ج.م ${totalUndistributedSum === 0 ? '<span style="font-size: 9px; background: #e2e8f0; color: #334155; padding: 2px 5px; border-radius: 4px; margin-right: 4px;">(مصفّر 0)</span>' : ''}</span>
                </div>
            </div>

            <table class="modern-table" style="font-size: 10.5px;">
                <thead>
                    <tr>
                        <th style="width: 10%;">اسم الشريك</th>
                        <th style="width: 5%;">النسبة</th>
                        <th style="width: 9%;">رأس المال</th>
                        <th style="width: 10%;">الأرباح الموزعة</th>
                        <th style="width: 8%;">الأرباح المتبقية</th>
                        <th style="width: 9%;">حصة البضاعة</th>
                        <th style="width: 19%;">تفاصيل المسحوبات والتسويات</th>
                        <th style="width: 6%;">العهدة</th>
                        <th style="width: 9%;">الرصيد المتاح</th>
                        <th style="width: 11%;">معادلة البضاعة (سحب/إيداع)</th>
                        <th style="width: 4%;">الحالة</th>
                    </tr>
                </thead>
                <tbody>
                    ${partnerRowsHtml}
                </tbody>
                <tfoot>
                    <tr style="background: #f1f5f9; font-weight: 800; border-top: 2px solid #cbd5e1;">
                        <td style="color: #0f172a; text-align: right; padding: 10px 8px;">الإجمالي العام</td>
                        <td style="color: #0f172a; font-family: monospace; text-align: center;">${totalProfitRatios}%</td>
                        <td style="color: #4338ca; font-family: monospace; text-align: center;">${totalCapitalSum.toLocaleString()} ج.م</td>
                        <td style="color: #059669; font-family: monospace; text-align: center;">+${totalDistributedSum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</td>
                        <td style="color: ${totalUndistributedSum > 0 ? '#d97706' : '#64748b'}; font-family: monospace; text-align: center;">${totalUndistributedSum.toLocaleString()} ج.م</td>
                        <td style="color: #0284c7; font-family: monospace; text-align: center;">${totalInventoryShareSum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</td>
                        <td style="color: #b91c1c; font-family: monospace; text-align: right; padding: 6px;">
                            <span style="background: #fee2e2; padding: 2px 6px; border-radius: 4px;">-${totalWithdrawalsSum.toLocaleString()} ج.م</span>
                        </td>
                        <td style="color: #d97706; font-family: monospace; text-align: center;">${totalCustodySum.toLocaleString()} ج.م</td>
                        <td style="color: #0f172a; font-size: 12px; font-family: monospace; background: #e2e8f0; text-align: center;">${totalBalanceSum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</td>
                        <td style="color: #0369a1; font-size: 10.5px; font-family: monospace; text-align: center;">
                            فائض إجمالي: +${Math.max(0, totalBalanceSum - totalInventoryShareSum).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م
                        </td>
                        <td style="color: #64748b; font-size: 10px; text-align: center;">معتمد</td>
                    </tr>
                </tfoot>
            </table>

            <!-- بيان مقاصة وتسوية الأرصدة مع بضاعة المخزن (معادلة الحصص) -->
            <div style="margin-top: 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; page-break-inside: avoid;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 14px;">⚖️</span>
                        <strong style="color: #0f172a; font-size: 12.5px;">بيان مقاصة وتسوية الأرصدة مع بضاعة المخزن (معادلة الحصص)</strong>
                    </div>
                    <span style="font-size: 10px; color: #475569; background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-weight: bold;">
                        إجمالي قيمة بضاعة المخزن: ${(totalInventoryValue || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م
                    </span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px;">
                    ${partners.map(p => {
                        const invShare = (p.profitRatio / 100) * (totalInventoryValue || 0);
                        const curBal = p.balance || 0;
                        const diff = curBal - invShare;
                        const isSurplus = diff > 0.01;
                        const isDeficit = diff < -0.01;
                        const absDiff = Math.abs(diff);

                        return `
                        <div style="background: ${isSurplus ? '#f0fdf4' : isDeficit ? '#fef2f2' : '#ffffff'}; border: 1px solid ${isSurplus ? '#86efac' : isDeficit ? '#fca5a5' : '#e2e8f0'}; border-radius: 6px; padding: 10px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <strong style="color: #0f172a; font-size: 12px;">الشريك: ${p.name} (${p.profitRatio}%)</strong>
                                <span style="font-size: 9px; font-weight: bold; padding: 2px 6px; border-radius: 4px; ${isSurplus ? 'background: #dcfce7; color: #166534;' : isDeficit ? 'background: #fee2e2; color: #991b1b;' : 'background: #f1f5f9; color: #334155;'}">
                                    ${isSurplus ? '🟢 لديه فائض رصيد متاح للسحب' : isDeficit ? '🔴 عليه عجز مطلوب إيداعه' : '⚪ متطابق تماماً'}
                                </span>
                            </div>
                            <div style="font-size: 10px; color: #475569; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 8px; background: rgba(255,255,255,0.7); padding: 6px; border-radius: 4px; border: 1px solid rgba(0,0,0,0.05);">
                                <div>حصة البضاعة: <strong style="color: #0284c7; font-family: monospace;">${invShare.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</strong></div>
                                <div>الرصيد المتاح: <strong style="color: #0f172a; font-family: monospace;">${curBal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</strong></div>
                            </div>
                            <div style="font-size: 11px; line-height: 1.6; font-weight: 700; ${isSurplus ? 'color: #15803d;' : isDeficit ? 'color: #b91c1c;' : 'color: #334155;'}">
                                ${isSurplus 
                                    ? `👈 <strong>متاح للشريك سحب نقدي:</strong> <span style="font-family: monospace; font-size: 12px; text-decoration: underline;">+${absDiff.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</span> من رصيده المتاح ليتساوى رصيده المتبقي مع قيمة حصته في البضاعة (${invShare.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م).`
                                    : isDeficit 
                                    ? `👈 <strong>مطلوب من الشريك إيداع / سداد:</strong> <span style="font-family: monospace; font-size: 12px; text-decoration: underline;">${absDiff.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</span> ليصبح رصيده مساوياً لحصته في البضاعة بالمخزن (${invShare.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م).`
                                    : `✓ رصيد الشريك الحالي يطابق حصته في بضاعة المخزن تماماً (0 ج.م فارق).`
                                }
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- دليل وسياسة تخارج الشركاء وحساب التصفية -->
            <div style="margin-top: 14px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; page-break-inside: avoid;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #fef3c7; padding-bottom: 8px; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 15px;">📘</span>
                        <strong style="color: #92400e; font-size: 12.5px;">الدليل التنفيذي والسياسة المحاسبية لتخارج الشركاء (Exit Policy Guide)</strong>
                    </div>
                    <span style="font-size: 9.5px; font-weight: bold; color: #b45309; background: #fef3c7; padding: 2px 8px; border-radius: 4px; border: 1px solid #fde68a;">
                        إجراء محاسبي معتمد ⚖️
                    </span>
                </div>

                <p style="font-size: 10.5px; color: #78350f; margin: 0 0 10px 0; line-height: 1.6;">
                    عند رغبة أحد الشركاء في <strong>التخارج النهائي وتصفية حصته</strong>، يتم احتساب وتنفيذ التصفية بدقة وفق الضوابط والخيارات المحاسبية التالية:
                </p>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px;">
                    <div style="background: #ffffff; border: 1px solid #fde68a; border-radius: 6px; padding: 8px; text-align: right;">
                        <strong style="color: #4338ca; font-size: 11px; display: block; margin-bottom: 3px;">1. معادلة مستحقات التخارج</strong>
                        <span style="font-size: 9.5px; color: #475569; line-height: 1.4; display: block;">
                            <strong>صافي حق الكاش</strong> = (رأس المال المساهم + الأرباح المستحقة) - (إجمالي المسحوبات الشخصية والسلف + العرابين).
                        </span>
                    </div>

                    <div style="background: #ffffff; border: 1px solid #fde68a; border-radius: 6px; padding: 8px; text-align: right;">
                        <strong style="color: #d97706; font-size: 11px; display: block; margin-bottom: 3px;">2. الربح الصافي ضد التحصيل</strong>
                        <span style="font-size: 9.5px; color: #475569; line-height: 1.4; display: block;">
                            التوزيع يتم فقط للربح الصافي الفعلي (بعد خصم تكلفة البضاعة والمصاريف) لضمان عدم تآكل رأس مال المحل.
                        </span>
                    </div>

                    <div style="background: #ffffff; border: 1px solid #fde68a; border-radius: 6px; padding: 8px; text-align: right;">
                        <strong style="color: #059669; font-size: 11px; display: block; margin-bottom: 3px;">3. الإثبات وتوثيق الخروج</strong>
                        <span style="font-size: 9.5px; color: #475569; line-height: 1.4; display: block;">
                            توليد <strong>"سند إخلاء طرف رسمي"</strong> مطبوع وموثق بتوقيع الشريك والإدارة الماليّة لخصم حسابه نهائياً.
                        </span>
                    </div>
                </div>

                <!-- توضيح محاسبي تعليمي مبسط مع مثال بالأرقام -->
                <div style="background: #f0f5ff; border: 1px solid #c7d2fe; border-radius: 6px; padding: 10px; margin-bottom: 10px; line-height: 1.5; font-size: 10px; color: #1e293b; text-align: right;">
                    <strong style="color: #4338ca; font-size: 11px; display: block; margin-bottom: 4px;">💡 توضيح محاسبي هام: كيف يتم احتساب مستحقات التصفية?</strong>
                    تتم التصفية وحساب حقوق كل شريك بناءً على <strong style="color: #4338ca;">الربح الصافي الفعلي</strong> المضاف إلى <strong style="color: #4338ca;">رأس المال المستثمر</strong>، وليس بناءً على مبالغ التحصيل (المبيعات الإجمالية):
                    <div style="margin: 4px 0; padding-right: 12px;">
                        • <strong>رأس المال الأصلي:</strong> يظل ثابتاً كما هو دون مساس (لأنه يمثل قيمة الأصول والأساس الذي يمتلكه الشريك).<br/>
                        • <strong>الأرباح الصافية (هي التي تُوزع):</strong> الربح الصافي هو ما يتبقى من المبيعات بعد خصم تكلفة البضاعة المباعة بسعر الجملة وكافة المصاريف والتشغيل.<br/>
                        • <strong>مبالغ التحصيل (لا تُوزع):</strong> لا يجوز تقسيم المبيعات الإجمالية؛ لأنها تشتمل على ثمن البضاعة الأصلي وتكلفة التشغيل، وتوزيعها يعني خسارة وتآكل رأس مال المتجر بالكامل.
                    </div>
                    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 6px 8px; margin-top: 4px; font-size: 9.5px; color: #78350f; line-height: 1.4;">
                        <strong>📝 مثال توضيحي عملي بالأرقام لشريكين (أحمد وباسم):</strong><br/>
                        نفترض أن <strong>أحمد</strong> و<strong>باسم</strong> أسسا محلاً تجارياً بالتساوي (بنسبة 50% لكل منهما):<br/>
                        • <strong>رأس المال:</strong> ساهم كل منهما بـ <strong>10,000 ج.م</strong> (إجمالي 20,000 ج.م لشراء البضاعة).<br/>
                        • <strong>مبيعات المحل الإجمالية:</strong> بلغت <strong>100,000 ج.م</strong>، بينما بلغت <strong>تكلفة البضاعة والمصاريف بالكامل 88,000 ج.م</strong> (منها 70,000 ج.م ثمن بضاعة الجملة لإعادة تدويرها + 18,000 ج.م مصاريف تشغيل وشحن).<br/>
                        • <strong>الربح الصافي الفعلي:</strong> هو <strong style="color: #166534;">12,000 ج.م</strong> فقط (وليس 100,000 ج.م مبيعات!).<br/>
                        • <strong>الشريك أحمد (سحب 2,000 ج.م):</strong> نصيبه من الأرباح 6,000 ج.م، يضاف لرأس ماله الأصلي ليصبح مستحقاته 16,000 ج.م، وبعد خصم مسحوباته، يستلم كاش <strong style="color: #1e3a8a;">14,000 ج.م</strong> عند التخارج.<br/>
                        • <strong>الشريك باسم (لم يسحب شيئاً):</strong> نصيبه 6,000 ج.م، ومستحقاته 16,000 ج.م، وبما أن مسحوباته 0 ج.م، يستلم كاش <strong style="color: #1e3a8a;">16,000 ج.م</strong> عند التخارج.
                        
                        <div style="margin-top: 6px; padding: 6px 8px; background: rgba(255, 255, 255, 0.7); border: 1px dashed #cbd5e1; border-radius: 4px; font-size: 9px; color: #475569; line-height: 1.4;">
                            💡 <strong>توضيح مالي هام (كيف تبلغ التكلفة 70 ألف بينما رأس المال 20 ألف فقط؟):</strong><br/>
                            السبب هو <strong>دوران رأس المال (Capital Turnover)</strong>. الشريكان لم يشتريا بضاعة بـ 70,000 ج.م دفعة واحدة، بل قاما بتشغيل الـ 20,000 ج.م الأصلية عدة مرات متتالية (يشترون بضاعة ⬅️ يبيعونها ⬅️ يستقطعون تكلفة الجملة لإعادة شراء بضاعة فوراً ⬅️ يكررون الدورة)، مما يراكم مبيعات بـ 100 ألف وتكلفة بـ 70 ألف، مع بقاء رأس المال الأصلي (20,000 ج.م) مجمّداً ومستمرّاً دائماً على شكل بضائع على الرفوف لحماية المتجر.
                        </div>

                        <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #cbd5e1; text-align: left; font-size: 8.5px; color: #475569;">
                            🛡️ تم التوثيق والاعتماد بموجب: <strong style="color: #1e3a8a;">سياسة التعامل في التسويق مع شركة عبده ميديا © 2026</strong>
                        </div>
                    </div>
                </div>

                <!-- صيغ وتوضيح التصفية الفردية الشفافة للشركاء -->
                <div style="margin-top: 10px; display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 10px; margin-bottom: 10px;">
                    ${partnerCalculatedList.map(item => `
                        <div style="background: #ffffff; border: 1px solid #fde68a; border-radius: 6px; padding: 10px; font-size: 10.5px; color: #1e293b;">
                            <div style="font-weight: bold; color: #92400e; font-size: 11.5px; margin-bottom: 6px; border-bottom: 1px solid #fef3c7; padding-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
                                <span>🤝 إرشاد وصيغة التخارج الشفاف للشريك: <strong>${item.name}</strong></span>
                                <span style="font-size: 9px; color: #b45309; background: #fef3c7; padding: 1px 6px; border-radius: 4px;">تصفية ودية أمنة</span>
                            </div>

                            <!-- 1. التصفية كاش -->
                            <div style="background: #fffdf5; border-right: 3px solid #f59e0b; padding: 8px 10px; border-radius: 4px; line-height: 1.7; margin-bottom: 8px;">
                                <strong style="color: #92400e; font-size: 10.5px; display: block; margin-bottom: 2px;">💵 خيار 1: التصفية والتخارج النقدي (الكاش):</strong>
                                "يا <strong>${item.name}</strong>، عشان نصلّي على النبي ونصفّي الحساب بينّا بكل أمانة ووضوح:<br/>
                                • إنت ليك رأس مال <strong>${item.capital.toLocaleString()} ج.م.</strong><br/>
                                • وليك أرباح موزعة وغير موزعة إجماليتها <strong>${item.totalProfits.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م.</strong><br/>
                                • يبقى إجمالي حقك بالكامل <strong>${item.totalRights.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م.</strong><br/>
                                • نخصم منهم المسحوبات الشخصية والتسويات اللي سحبتها خلال الفترة بـ <strong style="color: #dc2626;">${item.withdrawals.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م.</strong><br/>
                                💰 <strong style="color: #1e293b;">يبقى صافي الفلوس اللي تدريجياً أو كاش بتاخدها في إيدك وتخرج بالخير هي: <span style="color: #15803d; font-size: 11.5px; background: #dcfce7; padding: 1px 6px; border-radius: 4px; font-family: monospace;">${item.netExitCash.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</span></strong>"
                            </div>

                             <!-- 2. شراء وحساب الحصة للشريك المشتري -->
                            <div style="background: #faf5ff; border-right: 3px solid #a855f7; padding: 8px 10px; border-radius: 4px; line-height: 1.6;">
                                <strong style="color: #6b21a8; font-size: 10.5px; display: block; margin-bottom: 2px;">🛍️ خيار 2: شراء واستحواذ الشريك المستمر على حصة البضاعة والمتجر بالكامل:</strong>
                                • في حال رغبة الشريك المشتري <strong>(${partnerCalculatedList.filter(o => o.name !== item.name).map(o => o.name).join(' أو ') || 'الشريك المستمر'})</strong> في تملك كافة البضاعة والمتجر بالكامل:<br/>
                                🤝 <strong>صيغة الاتفاق والشراء:</strong> يدفع الشريك المشتري لـ <strong>${item.name}</strong> مبلغ كاش صافي مستحقاته قدره <strong style="color: #15803d; background: #dcfce7; padding: 1px 6px; border-radius: 3px; font-family: monospace;">${item.netExitCash.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م</strong> مقابل شراء كافة حقوقه وحصته بالبضاعة وتنازل الشريك <strong>${item.name}</strong> وتخارجه وتملك الشريك المشتري للمتجر بالكامل.
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div style="font-size: 10px; color: #92400e; background: #fef3c7; padding: 6px 10px; border-radius: 5px; font-weight: 600; display: flex; justify-content: space-between; align-items: center;">
                    <span>💡 <strong>تصفية الحساب بالبرنامج:</strong> اضغط زر <strong>"تصفية وتخارج"</strong> بصفحة الشركاء أو التقارير لتنفيذ التسوية فوراً.</span>
                </div>
            </div>

            <!-- إقرار التصفية المالية والاعتماد وتوقيعات الشركاء -->
            <div style="margin-top: 16px; padding: 14px; background: #fafafa; border: 1px dashed #cbd5e1; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px;">
                    <strong style="color: #1e293b; font-size: 12px;">📝 إقرار التصفية المالية واعتماد توزيع الأرباح</strong>
                    <span style="font-size: 10px; color: #64748b;">تاريخ الاعتماد: ${new Date().toLocaleDateString('ar-EG')}</span>
                </div>
                <p style="font-size: 10.5px; color: #475569; margin: 0 0 14px 0; line-height: 1.6;">
                    يقر الشركاء الموقعون أدناه بصحة واكتمال كافة الأرقام والمراكز المالية الموضحة بالتقرير، بما في ذلك رأس المال، وتوزيعات الأرباح، وحصص البضاعة، وتسويات العهد والمسحوبات الشخصية، ويُعتبر هذا التقرير سنداً رسمياً للتسوية المالية للفترة المحددة.
                </p>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                    ${partners.map(p => `
                        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center;">
                            <div style="font-weight: bold; color: #0f172a; font-size: 12px; margin-bottom: 4px;">الشريك / ${p.name}</div>
                            <div style="font-size: 10px; color: #64748b; margin-bottom: 12px;">(نسبة الشراكة: ${p.profitRatio}%)</div>
                            <div style="font-size: 10px; color: #94a3b8; border-bottom: 1px dotted #94a3b8; height: 28px; margin-bottom: 6px; display: flex; align-items: flex-end; justify-content: center;">
                                <span>توقيع الشريك: ........................</span>
                            </div>
                        </div>
                    `).join('')}
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center;">
                        <div style="font-weight: bold; color: #1e3a8a; font-size: 12px; margin-bottom: 4px;">الإدارة المالية والمحاسبة</div>
                        <div style="font-size: 10px; color: #64748b; margin-bottom: 12px;">(اعتماد وتدقيق الحسابات)</div>
                        <div style="font-size: 10px; color: #94a3b8; border-bottom: 1px dotted #94a3b8; height: 28px; margin-bottom: 6px; display: flex; align-items: flex-end; justify-content: center;">
                            <span>توقيع المحاسب: ........................</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    })() : '';

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
                    ${(() => {
                        const filtered = custodyAccounts.filter(a => {
                            if (isBankOrTreasuryAccount(a.name)) return false;
                            const details = custodyDetails[a.name] || [];
                            const posSum = details.filter(d => d.amount > 0).reduce((sum, d) => sum + d.amount, 0);
                            const negSum = details.filter(d => d.amount < 0).reduce((sum, d) => sum + Math.abs(d.amount), 0);
                            const netBal = Math.max(0, posSum - negSum);
                            return netBal > 0 || details.length > 0 || (a.balance && a.balance > 0);
                        });

                        if (filtered.length === 0) {
                            return '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #94a3b8; font-style: italic;">لا توجد عُهد أو ذمم قائمة على الموظفين أو الشركاء</td></tr>';
                        }

                        return filtered.map(a => {
                            const details = custodyDetails[a.name] || [];
                            const posSum = details.filter(d => d.amount > 0).reduce((sum, d) => sum + d.amount, 0);
                            const negSum = details.filter(d => d.amount < 0).reduce((sum, d) => sum + Math.abs(d.amount), 0);
                            const netBalance = Math.max(0, posSum - negSum);

                            // Filter details to show only positive custody items (orders, advances, POS) and hide internal ledger deduction notes to prevent clutter
                            const visibleDetails = details.filter(d => {
                                const isSettlement = d.amount < 0 || d.type === 'تسوية عهدة' || d.type === 'تسوية واسترداد';
                                return !isSettlement && d.amount > 0;
                            });

                            const detailsHtml = visibleDetails.length > 0 
                                ? `<div style="text-align: right; font-size: 11px;">
                                    ${visibleDetails.map(d => `
                                        <div style="margin-bottom: 4px; padding: 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                                            <span>
                                                <span style="font-size: 8px; background: ${d.type === 'مبيعات POS' || d.type === 'نقطة بيع' ? '#f0fdf4' : '#fffbeb'}; color: ${d.type === 'مبيعات POS' || d.type === 'نقطة بيع' ? '#166534' : '#d97706'}; padding: 1px 4px; border-radius: 4px; border: 1px solid ${d.type === 'مبيعات POS' || d.type === 'نقطة بيع' ? '#bbf7d0' : '#fde68a'}; margin-left: 5px;">${d.type}</span>
                                                <strong style="color: #0f172a;">${d.customerName}</strong>
                                                <span style="color: #64748b; margin-right: 5px;">(#${d.orderNumber})</span>
                                            </span>
                                            <span style="font-weight: bold; color: #1e3a8a; font-family: monospace;">+${d.amount.toLocaleString()} ج.م</span>
                                        </div>
                                    `).join('')}
                                   </div>`
                                : '<span style="color: #94a3b8; font-style: italic;">لا توجد تفاصيل أوردرات مرتبطة</span>';

                            return `
                                <tr>
                                    <td style="font-weight: bold; color: #1e3a8a; vertical-align: middle;">${a.name}</td>
                                    <td style="padding: 10px;">${detailsHtml}</td>
                                    <td style="padding: 10px; text-align: center; vertical-align: middle;">
                                        ${netBalance === 0 ? `
                                            <div style="font-weight: 900; font-size: 15px; color: #059669; font-family: monospace;">0 ج.م</div>
                                            <div style="font-size: 8.5px; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; border-radius: 4px; padding: 2px 6px; font-weight: 800; display: inline-block; margin-top: 4px;">
                                                ✓ تم تصفير وتسوية العهدة بالكامل (مخصومة من الحساب)
                                            </div>
                                            ${posSum > 0 ? `
                                                <div style="font-size: 9.5px; color: #334155; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 4px 8px; margin-top: 5px; font-weight: 700; display: inline-block;">
                                                    <span style="color: #64748b;">قبل التصفير:</span>
                                                    <span style="color: #1e3a8a; font-family: monospace; font-weight: 900; margin-right: 4px;">${posSum.toLocaleString()} ج.م</span>
                                                </div>
                                            ` : ''}
                                        ` : `
                                            <div style="font-weight: 900; font-size: 15px; color: #b91c1c; font-family: monospace;">${netBalance.toLocaleString()} ج.م</div>
                                            ${negSum > 0 ? `
                                                <div style="font-size: 8.5px; color: #64748b; margin-top: 2px;">(سُدد ${negSum.toLocaleString()} ج.م ومتبقي ${netBalance.toLocaleString()} ج.م)</div>
                                                <div style="font-size: 9px; color: #334155; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 4px; padding: 2px 6px; margin-top: 4px; display: inline-block;">
                                                    <span>إجمالي العُهد قبل التصفير:</span>
                                                    <strong style="color: #1e3a8a; font-family: monospace;">${posSum.toLocaleString()} ج.م</strong>
                                                </div>
                                            ` : `<div style="font-size: 8.5px; background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; border-radius: 4px; padding: 2px 6px; font-weight: 800; display: inline-block; margin-top: 4px;">عهدة قائمة معلقة</div>`}
                                        `}
                                    </td>
                                </tr>
                            `;
                        }).join('');
                    })()}
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
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
        <style>
            :root {
                --primary: #1e3a8a; --primary-light: #3b82f6; --primary-soft: #eff6ff; 
                --success: #059669; --success-soft: #ecfdf5;
                --danger: #dc2626; --danger-soft: #fef2f2;
                --warning: #d97706; --warning-soft: #fffbeb;
                --slate-50: #f8fafc; --slate-100: #f1f5f9; --slate-200: #e2e8f0; --slate-700: #334155; --slate-900: #0f172a;
            }
            @page { size: ${isContinuous ? 'auto' : (orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait')}; margin: ${isContinuous ? '0' : '8mm'}; }
            body { font-family: 'Cairo', system-ui, -apple-system, sans-serif; background: #f1f5f9; color: var(--slate-900); margin: 0; padding: ${isContinuous ? '20px' : '0'}; line-height: 1.6; }
            .report-container { width: 100%; max-width: ${isContinuous ? '100%' : (orientation === 'landscape' ? '1400px' : '1000px')}; margin: 0 auto; background: white; padding: ${isContinuous ? '20px' : '36px'}; box-sizing: border-box; border-radius: ${isContinuous ? '20px' : '0'}; box-shadow: ${isContinuous ? '0 20px 25px -5px rgba(0,0,0,0.05)' : 'none'}; }
            
            /* High-Tech Header Banner */
            .header-banner { background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1e3a8a 100%); color: white; padding: 32px 36px; border-radius: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden; box-shadow: 0 10px 25px rgba(15,23,42,0.15); }
            .header-banner::before { content: ""; position: absolute; top: -50%; right: -10%; width: 300px; height: 300px; background: rgba(59, 130, 246, 0.15); border-radius: 50%; blur: 40px; }
            .header-banner h1 { margin: 0; font-size: 32px; font-weight: 900; letter-spacing: -0.5px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
            .header-subtitle { color: #93c5fd; margin-top: 6px; font-weight: 700; font-size: 15px; display: flex; items-center; gap: 8px; }
            .serial-badge { background: rgba(255,255,255,0.12); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.2); padding: 6px 14px; border-radius: 30px; font-size: 12px; font-weight: 800; color: #f1f5f9; letter-spacing: 0.5px; display: inline-block; margin-top: 10px; }

            /* Executive KPI Cards Bar */
            .executive-kpi-bar { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-bottom: 28px; }
            .kpi-box { background: white; padding: 18px 16px; border-radius: 16px; border: 1px solid var(--slate-200); position: relative; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.03); transition: transform 0.2s; }
            .kpi-box::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 4px; border-radius: 16px 16px 0 0; }
            .kpi-box.primary::before { background: var(--primary-light); }
            .kpi-box.danger::before { background: var(--danger); }
            .kpi-box.success::before { background: var(--success); }
            .kpi-box.info::before { background: #0284c7; }
            .kpi-box.score::before { background: #8b5cf6; }
            .kpi-label { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 6px; }
            .kpi-value { font-size: 22px; font-weight: 900; color: var(--slate-900); }
            .kpi-value .unit { font-size: 11px; font-weight: 600; opacity: 0.7; }
            .kpi-sub { font-size: 10px; font-weight: 700; color: #94a3b8; margin-top: 4px; }

            /* Financial Waterfall Visualizer */
            .waterfall-card { background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%); border: 1px solid var(--slate-200); border-radius: 18px; padding: 22px; margin-bottom: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
            .waterfall-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; border-bottom: 1px solid var(--slate-200); padding-bottom: 12px; }
            .waterfall-title { margin: 0; font-size: 16px; font-weight: 900; color: var(--slate-900); }
            .waterfall-badge { background: #e0e7ff; color: #3730a3; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 20px; }
            .waterfall-steps { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
            .wf-step { display: flex; align-items: center; gap: 10px; background: white; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--slate-200); flex: 1; min-width: 140px; }
            .wf-step.highlight { background: #f5f3ff; border-color: #ddd6fe; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.08); }
            .wf-circle { width: 30px; height: 30px; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14px; shrink: 0; }
            .wf-circle.bg-blue { background: #2563eb; }
            .wf-circle.bg-amber { background: #d97706; }
            .wf-circle.bg-emerald { background: #059669; }
            .wf-circle.bg-rose { background: #e11d48; }
            .wf-circle.bg-indigo { background: #4f46e5; }
            .wf-info { display: flex; flex-direction: column; }
            .wf-title { font-size: 10px; font-weight: 800; color: #64748b; }
            .wf-amount { font-size: 13px; font-weight: 900; }
            .wf-amount.blue { color: #1d4ed8; }
            .wf-amount.amber { color: #b45309; }
            .wf-amount.emerald { color: #047857; }
            .wf-amount.rose { color: #be123c; }
            .wf-amount.indigo { color: #4338ca; }
            .wf-arrow { color: #cbd5e1; font-weight: 900; font-size: 16px; }

            .section-header { font-size: 20px; font-weight: 900; color: var(--primary); margin: 36px 0 20px 0; padding-bottom: 10px; border-bottom: 3px solid var(--slate-200); display: flex; align-items: center; gap: 12px; }
            .section-header::before { content: ""; width: 6px; height: 26px; background: var(--primary); border-radius: 3px; }

            .modern-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 24px; border: 1px solid var(--slate-200); border-radius: 14px; overflow: hidden; }
            .modern-table th { background: #f8fafc; color: var(--slate-700); font-size: 12px; font-weight: 800; padding: 14px 10px; border-bottom: 2px solid var(--slate-200); text-align: center; }
            .modern-table td { padding: 12px 10px; font-size: 12px; border-bottom: 1px solid var(--slate-100); text-align: center; color: #334155; }
            .modern-table tr:last-child td { border-bottom: none; }
            .total-row { background: var(--slate-100) !important; font-weight: 900; color: var(--slate-900) !important; }
            
            .stage-banner { display: flex; align-items: center; gap: 16px; background: white; padding: 18px 22px; border-radius: 16px; margin-bottom: 20px; border-right: 6px solid var(--primary); box-shadow: 0 2px 8px rgba(0,0,0,0.03); }
            .stage-number { width: 38px; height: 38px; background: var(--primary); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 18px; }
            .stage-title { font-size: 17px; font-weight: 900; color: var(--primary); margin: 0; }

            .final-banner { background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color: white; padding: 40px 30px; border-radius: 24px; text-align: center; margin: 40px 0; box-shadow: 0 20px 40px rgba(30, 58, 138, 0.25); position: relative; overflow: hidden; }
            .final-banner .amount { font-size: 56px; font-weight: 900; margin: 15px 0; letter-spacing: -1.5px; text-shadow: 0 4px 10px rgba(0,0,0,0.3); }
            
            .signature-section { margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 60px; padding: 30px; background: var(--slate-50); border-radius: 20px; border: 1px solid var(--slate-200); page-break-inside: avoid; }
            .signature-box { text-align: center; }
            .signature-line { border-top: 2px dashed var(--slate-300); width: 220px; margin: 25px auto 10px auto; }
            
            @media screen and (max-width: 768px) {
                .report-container { padding: 15px; border-radius: 0; overflow-x: auto; }
                .header-banner { flex-direction: column; padding: 20px; gap: 15px; border-radius: 12px; text-align: center; }
                .header-banner h1 { font-size: 22px; }
                .executive-kpi-bar { grid-template-columns: 1fr; }
                .waterfall-steps { flex-direction: column; }
                .wf-arrow { transform: rotate(90deg); margin: 4px 0; }
                .modern-table { display: table !important; width: 100%; min-width: 1000px; }
                .final-banner { padding: 25px 15px; border-radius: 16px; margin: 25px 0; }
                .final-banner .amount { font-size: 32px; }
                .signature-section { grid-template-columns: 1fr; gap: 30px; padding: 20px; margin-top: 30px; }
            }

            @media print {
                body { background: white; }
                .report-container { box-shadow: none; padding: 0; width: 100%; }
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
                    <div class="header-subtitle">📈 التقرير المالي الموحد والأداء الاستراتيجي الشامل</div>
                    <div class="serial-badge">🔒 رمز التوثيق المالي: ${serialNumber}</div>
                </div>
                <div style="text-align: left;">
                    <div style="font-weight: 800; font-size: 18px; background: rgba(255,255,255,0.15); padding: 8px 20px; border-radius: 30px; border: 1px solid rgba(255,255,255,0.25); text-align: center;">${dateRangeText || 'الفترة الكاملة'}</div>
                    <div style="font-size: 11px; opacity: 0.8; margin-top: 10px; text-align: left;">تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            </div>

            ${getAccountingCycleExplanationHTML()}

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
                    <p style="font-weight: 800; color: var(--slate-700); margin-bottom: 25px; font-size: 14px;">توقيع المحاسب المسئول</p>
                    <div class="signature-line"></div>
                    <span style="font-size: 11px; color: #64748b;">الاسم والتاريخ: ...........................................</span>
                </div>
                <div class="signature-box">
                    <p style="font-weight: 800; color: var(--slate-700); margin-bottom: 25px; font-size: 14px;">اعتماد إدارة المتجر</p>
                    <div class="signature-line"></div>
                    <span style="font-size: 11px; color: #64748b;">الاسم والتوقيع: ...........................................</span>
                </div>
            </div>

            <div style="text-align: center; margin-top: 40px; color: #94a3b8; font-size: 11px; border-top: 1px solid var(--slate-200); padding-top: 20px;">
                تم توليد هذا التقرير المالي الموثق آلياً بواسطة نظام إدارة المبيعات والشركاء الذكي &copy; ${new Date().getFullYear()} - جميع الحقوق محفوظة
            </div>
        </div>
        <script>window.onload = function() { setTimeout(() => { window.print(); }, 1200); };</script>
    </body>
    </html>
    `;
};

export const generatePosReportHTML = (
  orders: Order[],
  settings: Settings,
  storeName: string,
  dateRangeText?: string,
  isContinuous: boolean = false,
  orientation: 'portrait' | 'landscape' = 'landscape'
): string => {
  const posOrders = orders.filter(o => o.channel === 'pos' || o.id?.startsWith('POS-') || o.shippingCompany?.startsWith('كاشير -') || o.shippingArea === 'نقطة البيع');

  let totalRevenue = 0;
  let totalItems = 0;
  let totalProfit = 0;
  let totalDiscount = 0;

  const productMelt: Record<string, { label: string, quantity: number, revenue: number, cost: number }> = {};
  const cashierPerformance: Record<string, { label: string, count: number, revenue: number, profit: number }> = {};
  const paymentMethods: Record<string, { label: string, count: number, revenue: number }> = {
    cash: { label: 'نقدي (عهدة كاشير)', count: 0, revenue: 0 },
    card: { label: 'دفع إلكتروني / بطاقة', count: 0, revenue: 0 },
    wallet: { label: 'محفظة / إيداع مباشر', count: 0, revenue: 0 },
    other: { label: 'طرق أخرى', count: 0, revenue: 0 },
  };

  posOrders.forEach(o => {
    const revenue = (o.totalPrice || (o.productPrice + o.shippingFee));
    totalRevenue += revenue;
    totalDiscount += (o.discount || 0);

    const { profit } = calculateOrderProfitLoss(o, settings);
    totalProfit += profit;

    (o.items || []).forEach(item => {
      totalItems += item.quantity;
      if (!productMelt[item.productId || item.name]) {
        productMelt[item.productId || item.name] = { label: item.name, quantity: 0, revenue: 0, cost: 0 };
      }
      productMelt[item.productId || item.name].quantity += item.quantity;
      productMelt[item.productId || item.name].revenue += (item.price * item.quantity);
      productMelt[item.productId || item.name].cost += (((item as any).costPrice || 0) * item.quantity);
    });

    const cashierName = resolveCashHolderName(o, settings) || o.createdBy || 'كاشير مجهول';
    if (!cashierPerformance[cashierName]) {
      cashierPerformance[cashierName] = { label: cashierName, count: 0, revenue: 0, profit: 0 };
    }
    cashierPerformance[cashierName].count += 1;
    cashierPerformance[cashierName].revenue += revenue;
    cashierPerformance[cashierName].profit += profit;

    if (o.paymentMethod === 'card' || o.paymentMethod === 'visa' || o.paymentMethod === 'online') {
      paymentMethods.card.count += 1;
      paymentMethods.card.revenue += revenue;
    } else if (o.cashHolderId === 'wallet' || o.paymentMethod === 'wallet') {
      paymentMethods.wallet.count += 1;
      paymentMethods.wallet.revenue += revenue;
    } else {
      paymentMethods.cash.count += 1;
      paymentMethods.cash.revenue += revenue;
    }
  });

  const bestProducts = Object.values(productMelt).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const avgBasket = posOrders.length > 0 ? (totalRevenue / posOrders.length) : 0;

  const tableRows = posOrders.map(o => {
    const { profit } = calculateOrderProfitLoss(o, settings);
    const cashierName = resolveCashHolderName(o, settings) || o.createdBy || 'كاشير';
    const itemsSummary = (o.items || []).map(i => `${i.name} (x${i.quantity})`).join(', ');

    return `
      <tr>
        <td style="padding: 10px 8px; font-weight: 800; color: #4f46e5;">#${o.orderNumber || o.id?.slice(0, 8)}</td>
        <td style="padding: 10px 8px;">
          <div style="font-weight: 700; color: #0f172a;">${o.customerName || 'عميل كاشير'}</div>
          ${o.customerPhone ? `<div style="font-size: 9px; color: #64748b;" dir="ltr">${o.customerPhone}</div>` : ''}
        </td>
        <td style="padding: 10px 8px; font-size: 9.5px; color: #475569;">
          ${new Date(o.date).toLocaleDateString('ar-EG')} <br/>
          <small style="color: #94a3b8;">${new Date(o.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</small>
        </td>
        <td style="padding: 10px 8px;">
          <span style="background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; padding: 3px 8px; border-radius: 20px; font-weight: 800; font-size: 9.5px;">👤 ${cashierName}</span>
        </td>
        <td style="padding: 10px 8px; font-size: 9.5px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${itemsSummary || 'منتجات كاشير'}</td>
        <td style="padding: 10px 8px; font-weight: 800; text-align: center;">${(o.discount || 0) > 0 ? `<span style="color: #dc2626;">-${(o.discount || 0).toLocaleString()} ج.م</span>` : '<span style="color: #cbd5e1;">-</span>'}</td>
        <td style="padding: 10px 8px; font-weight: 900; color: #0f172a; font-size: 11px;" dir="ltr">${(o.totalPrice || (o.productPrice + o.shippingFee)).toLocaleString()} ج.م</td>
        <td style="padding: 10px 8px; font-weight: 800; color: ${profit >= 0 ? '#10b981' : '#dc2626'};" dir="ltr">${profit >= 0 ? '+' : ''}${profit.toLocaleString()} ج.م</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير أداء نقطة البيع والكاشير - ${storeName}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" crossorigin="anonymous">
      <style>
        @page { size: ${isContinuous ? 'auto' : `A4 ${orientation}`}; margin: ${isContinuous ? '0' : '0.8cm'}; }
        * { box-sizing: border-box; }
        body { 
          font-family: 'Cairo', sans-serif; 
          font-size: 11px; 
          -webkit-print-color-adjust: exact; 
          color-adjust: exact; 
          background-color: ${isContinuous ? '#ffffff' : '#f8fafc'};
          color: #334155;
          margin: 0;
          padding: ${isContinuous ? '10px' : '24px'};
        }
        .report-container { 
          width: 100%; 
          max-width: ${isContinuous ? '100%' : (orientation === 'landscape' ? '297mm' : '210mm')};
          margin: 0 auto;
          background: #ffffff;
          border-radius: ${isContinuous ? '0' : '24px'};
          box-shadow: ${isContinuous ? 'none' : '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)'};
          padding: ${isContinuous ? '15px' : '32px'};
          border: ${isContinuous ? 'none' : '1px solid #e2e8f0'};
          position: relative;
        }

        .top-accent-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 6px;
          background: linear-gradient(90deg, #4f46e5 0%, #06b6d4 50%, #10b981 100%);
        }

        .header-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
          border-bottom: 2px solid #f1f5f9;
          padding-bottom: 20px;
          margin-top: 6px;
        }

        .header-brand-wrap {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .store-logo-icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: linear-gradient(135deg, #312e81 0%, #1e1b4b 100%);
          color: #818cf8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .header-title h1 { 
          margin: 0 0 4px 0; 
          color: #0f172a; 
          font-size: 25px; 
          font-weight: 900;
          letter-spacing: -0.02em;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .report-badge-pill {
          font-size: 10px;
          background: #eef2ff;
          color: #4f46e5;
          padding: 2px 10px;
          border-radius: 20px;
          border: 1px solid #c7d2fe;
          font-weight: 800;
        }

        .header-title p { 
          margin: 0; 
          font-size: 13.5px; 
          color: #64748b; 
          font-weight: 600;
        }

        .header-meta {
          text-align: right;
          background: #f8fafc;
          padding: 14px 20px;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);
        }

        .header-meta p {
          margin: 0 0 4px 0;
          font-size: 11px;
          color: #475569;
          font-weight: 600;
        }

        .header-meta p strong {
          color: #0f172a;
          font-weight: 800;
        }

        .summary-cards {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }

        .card {
          background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%);
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 14px 16px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
        }

        .card::before {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          left: 0;
          height: 4px;
        }

        .card.sales::before { background: linear-gradient(90deg, #6366f1, #818cf8); }
        .card.invoices::before { background: linear-gradient(90deg, #06b6d4, #38bdf8); }
        .card.profit::before { background: linear-gradient(90deg, #10b981, #34d399); }
        .card.aov::before { background: linear-gradient(90deg, #8b5cf6, #a78bfa); }
        .card.discount::before { background: linear-gradient(90deg, #ef4444, #f87171); }

        .card-title {
          font-size: 10.5px;
          color: #64748b;
          font-weight: 700;
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .card-value {
          font-size: 18px;
          font-weight: 900;
          color: #0f172a;
          line-height: 1.2;
        }

        .card-subtext {
          font-size: 9.5px;
          color: #94a3b8;
          font-weight: 600;
          margin-top: 4px;
        }

        .section-title {
          font-size: 14px;
          font-weight: 900;
          color: #0f172a;
          margin: 24px 0 12px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .two-col-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          margin-bottom: 24px;
        }

        .panel-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 16px 20px;
        }

        .panel-box h3 {
          margin: 0 0 12px 0;
          font-size: 12px;
          font-weight: 800;
          color: #1e293b;
        }

        table { 
          width: 100%; 
          border-collapse: separate; 
          border-spacing: 0;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
        }

        th, td { 
          padding: 9px 8px; 
          text-align: right; 
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
          font-size: 10px;
        }

        th { 
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
          color: #334155; 
          font-size: 10.5px; 
          font-weight: 800;
          border-bottom: 2px solid #cbd5e1;
        }

        tbody tr:last-child td { border-bottom: none; }
        tbody tr:nth-child(even) td { background-color: #fdfdfe; }

        .signature-section {
          margin-top: 36px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          padding: 20px 24px;
          background: #f8fafc;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
        }

        .signature-box { text-align: center; }
        .signature-title { font-weight: 800; margin-bottom: 32px; font-size: 11.5px; color: #1e293b; }
        .signature-line { border-top: 2px dashed #94a3b8; width: 160px; margin: 0 auto; }

        ${getPrintControlBarCSS()}

        @media print {
          body { background: white; padding: 0; }
          .report-container { box-shadow: none; padding: 0; border: none; }
          .top-accent-bar { display: none; }
        }
      </style>
    </head>
    <body>
      ${getPrintControlBarHTML('تقرير مبيعات وأداء الكاشير')}
      <div class="report-container">
        <div class="top-accent-bar"></div>

        <div class="header-section">
          <div class="header-brand-wrap">
            <div class="store-logo-icon">🧮</div>
            <div class="header-title">
              <h1>
                تقرير أداء الكاشير ونقطة البيع
                <span class="report-badge-pill">POS Shift Summary</span>
              </h1>
              <p>متجر "${storeName}"</p>
            </div>
          </div>
          <div class="header-meta">
            ${dateRangeText ? `<p><strong>الفترة:</strong> ${dateRangeText}</p>` : ''}
            <p><strong>تاريخ الإصدار:</strong> ${new Date().toLocaleString('ar-EG', { dateStyle: 'long', timeStyle: 'short' })}</p>
          </div>
        </div>

        <div class="summary-cards">
          <div class="card sales">
            <div class="card-title">إجمالي مبيعات POS</div>
            <div class="card-value" style="color: #4f46e5;" dir="ltr">${totalRevenue.toLocaleString()} <span style="font-size: 11px;">ج.م</span></div>
            <div class="card-subtext">إجمالي المبيعات المباشرة</div>
          </div>

          <div class="card invoices">
            <div class="card-title">عدد الفواتير والقطع</div>
            <div class="card-value">${posOrders.length} <span style="font-size: 11px; color:#64748b;">فاتورة</span></div>
            <div class="card-subtext">إجمالي القطع: ${totalItems} قطعة</div>
          </div>

          <div class="card profit">
            <div class="card-title">صافي ربح الكاشير</div>
            <div class="card-value" style="color: #10b981;" dir="ltr">+${totalProfit.toLocaleString()} <span style="font-size: 11px;">ج.م</span></div>
            <div class="card-subtext">هامش ربح صافي</div>
          </div>

          <div class="card aov">
            <div class="card-title">متوسط السلة (AOV)</div>
            <div class="card-value" style="color: #7c3aed;" dir="ltr">${Math.round(avgBasket).toLocaleString()} <span style="font-size: 11px;">ج.م</span></div>
            <div class="card-subtext">متوسط الفاتورة الواحدة</div>
          </div>

          <div class="card discount">
            <div class="card-title">إجمالي الخصومات</div>
            <div class="card-value" style="color: #ef4444;" dir="ltr">${totalDiscount.toLocaleString()} <span style="font-size: 11px;">ج.م</span></div>
            <div class="card-subtext">خصومات فورية ممنوحة</div>
          </div>
        </div>

        <div class="two-col-grid">
          <div class="panel-box">
            <h3>👥 كفاءة وأداء كاشيرية ورديات العمل</h3>
            <table style="box-shadow: none;">
              <thead>
                <tr>
                  <th>اسم الكاشير / العهدة</th>
                  <th style="text-align: center;">عدد الفواتير</th>
                  <th>إجمالي تحصيل المبيعات</th>
                  <th>صافي الربح المحقق</th>
                </tr>
              </thead>
              <tbody>
                ${Object.values(cashierPerformance).map(c => `
                  <tr>
                    <td style="font-weight: 800; color: #0f172a;">👤 ${c.label}</td>
                    <td style="text-align: center; font-weight: 700;">${c.count}</td>
                    <td style="font-weight: 800; color: #4f46e5;" dir="ltr">${c.revenue.toLocaleString()} ج.م</td>
                    <td style="font-weight: 800; color: #10b981;" dir="ltr">+${c.profit.toLocaleString()} ج.م</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="panel-box">
            <h3>📦 الأكثر مبيعاً في الكاشير (Top POS Items)</h3>
            <table style="box-shadow: none;">
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th style="text-align: center;">الكمية</th>
                  <th>إجمالي المبيعات</th>
                </tr>
              </thead>
              <tbody>
                ${bestProducts.slice(0, 5).map(p => `
                  <tr>
                    <td style="font-weight: 700; color: #0f172a;">${p.label}</td>
                    <td style="text-align: center; font-weight: 800; color: #4f46e5;">${p.quantity}</td>
                    <td style="font-weight: 800;" dir="ltr">${p.revenue.toLocaleString()} ج.م</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="section-title">
          <span>🧾</span>
          <span>سجل المعاملات المباشرة وفواتير الكاشير (${posOrders.length} عملية)</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>رقم الفاتورة</th>
              <th>العميل</th>
              <th>التاريخ والوقت</th>
              <th>الكاشير المسؤول</th>
              <th>تفاصيل الشراء</th>
              <th style="text-align: center;">الخصم</th>
              <th>المبلغ الصافي</th>
              <th>الربح الصافي</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="signature-section no-break">
          <div class="signature-box">
            <div class="signature-title">توقيع الكاشير المسئول عن الوردية</div>
            <div class="signature-line"></div>
          </div>
          <div class="signature-box">
            <div class="signature-title">اعتماد المحاسب / مدير المتجر</div>
            <div class="signature-line"></div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 24px; font-size: 10px; color: #94a3b8; font-weight: 600;">
          تم إصدار تقرير الكاشير آلياً عبر نظام إدارة المبيعات المتقدم &copy; ${new Date().getFullYear()}
        </div>
      </div>
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;
};

export const generateAbdoMediaPolicyHTML = (storeName: string): string => {
  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
        <style>
            :root {
                --primary: #1e3a8a;
                --primary-dark: #0f172a;
                --accent: #b45309;
                --accent-light: #fef3c7;
                --success: #047857;
                --success-soft: #ecfdf5;
                --slate-100: #f1f5f9;
                --slate-700: #334155;
                --slate-900: #0f172a;
            }
            @page { 
                size: A4 portrait; 
                margin: 10mm; 
            }
            body { 
                font-family: 'Cairo', system-ui, -apple-system, sans-serif; 
                background: #f8fafc; 
                color: var(--slate-900); 
                margin: 0; 
                padding: 10px; 
                line-height: 1.6; 
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .policy-container { 
                width: 100%; 
                max-width: 800px; 
                margin: 0 auto; 
                background: white; 
                padding: 30px 35px; 
                box-sizing: border-box; 
                border-radius: 12px; 
                box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                border: 1px solid #e2e8f0;
            }
            
            /* Premium Corporate Header */
            .header-charter {
                border-bottom: 3px double var(--primary);
                padding-bottom: 18px;
                margin-bottom: 25px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .brand-box {
                text-align: right;
            }
            .brand-title {
                color: var(--primary);
                font-size: 24px;
                font-weight: 900;
                margin: 0;
                letter-spacing: -0.5px;
            }
            .brand-subtitle {
                color: var(--accent);
                font-size: 13px;
                font-weight: 800;
                margin-top: 3px;
            }
            .charter-badge {
                border: 2px solid var(--accent);
                background: var(--accent-light);
                color: var(--accent);
                padding: 5px 15px;
                border-radius: 30px;
                font-size: 11px;
                font-weight: 800;
            }
            
            .document-title {
                text-align: center;
                margin: 10px 0 25px 0;
            }
            .document-title h1 {
                font-size: 20px;
                font-weight: 900;
                color: var(--primary-dark);
                margin: 0;
                display: inline-block;
                border-bottom: 2px solid var(--accent);
                padding-bottom: 6px;
            }
            .document-title p {
                font-size: 11.5px;
                color: var(--slate-700);
                margin: 6px 0 0 0;
                font-weight: 600;
            }

            /* Policy Card */
            .policy-section {
                margin-bottom: 20px;
                page-break-inside: avoid;
            }
            .section-header {
                display: flex;
                align-items: center;
                gap: 8px;
                color: var(--primary);
                font-size: 14px;
                font-weight: 800;
                border-bottom: 2px solid #e2e8f0;
                padding-bottom: 6px;
                margin-bottom: 12px;
            }
            .section-icon {
                font-size: 18px;
            }
            
            .grid-pillars {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
                margin-bottom: 20px;
            }
            .pillar-card {
                background: #f8fafc;
                border: 1px solid #cbd5e1;
                border-top: 3.5px solid var(--primary);
                padding: 12px;
                border-radius: 6px;
            }
            .pillar-card.accent {
                border-top-color: var(--accent);
            }
            .pillar-title {
                font-weight: 800;
                font-size: 12px;
                color: var(--primary-dark);
                display: block;
                margin-bottom: 5px;
            }
            .pillar-text {
                font-size: 11px;
                color: var(--slate-700);
                line-height: 1.5;
                display: block;
            }

            /* Visual Formula */
            .formula-box {
                background: var(--success-soft);
                border: 1.5px solid #a7f3d0;
                border-radius: 8px;
                padding: 12px 16px;
                margin-bottom: 20px;
                text-align: center;
            }
            .formula-title {
                color: var(--success);
                font-size: 13px;
                font-weight: 800;
                margin-bottom: 4px;
                display: block;
            }
            .formula-code {
                background: white;
                border: 1px solid #86efac;
                padding: 6px 12px;
                border-radius: 6px;
                font-weight: 900;
                font-size: 12px;
                color: var(--slate-900);
                display: inline-block;
                margin-top: 4px;
                letter-spacing: 0.2px;
            }

            /* Double Partner Example */
            .example-box {
                background: #fffbeb;
                border: 1.5px solid #fde68a;
                border-radius: 8px;
                padding: 15px 18px;
                font-size: 11px;
                color: #78350f;
                line-height: 1.6;
                margin-bottom: 20px;
            }
            .example-title {
                font-size: 13px;
                font-weight: 800;
                color: var(--accent);
                display: block;
                margin-bottom: 6px;
            }
            .example-subgrid {
                padding-right: 12px;
                border-right: 2px solid #fcd34d;
                font-size: 11px;
                margin: 8px 0;
                space-y: 4px;
            }
            
            /* Turnover Explainer Card */
            .turnover-card {
                background: #f0f7ff;
                border: 1px dashed #3b82f6;
                border-radius: 8px;
                padding: 14px;
                font-size: 11px;
                color: #1e3a8a;
                line-height: 1.5;
                margin-bottom: 20px;
            }

            /* Signature Block */
            .signature-area {
                margin-top: 35px;
                border-top: 1.5px solid #cbd5e1;
                padding-top: 20px;
                display: flex;
                justify-content: space-between;
                page-break-inside: avoid;
            }
            .sig-box {
                width: 45%;
                text-align: center;
            }
            .sig-title {
                font-weight: 800;
                font-size: 12px;
                color: var(--slate-700);
                margin-bottom: 45px;
            }
            .sig-line {
                border-bottom: 1.5px solid #94a3b8;
                width: 80%;
                margin: 0 auto 5px auto;
            }
            .sig-seal {
                font-size: 9.5px;
                color: #94a3b8;
                font-weight: 600;
            }

            /* Print Optimization Controls */
            @media print {
                body { 
                    background: white; 
                    padding: 0;
                }
                .policy-container { 
                    border: none; 
                    box-shadow: none; 
                    padding: 10px 0;
                }
            }
        </style>
    </head>
    <body>
        <div class="policy-container">
            <!-- Header Banner -->
            <div class="header-charter">
                <div class="brand-box">
                    <h2 class="brand-title">شركة عبده ميديا للتسويق</h2>
                    <div class="brand-subtitle">ريادة إدارة المتاجر وصناعة العلامات التجارية الرقمية</div>
                </div>
                <div class="charter-badge">وثيقة سياسات معتمدة</div>
            </div>

            <!-- Document Title -->
            <div class="document-title">
                <h1>سياسة المعاملات المالية والدورة المحاسبية للمشروعات المشتركة</h1>
                <p>دليل حماية رأس المال وضوابط توزيع السيولة والأرباح للمتاجر (شراكة المتجر: ${storeName})</p>
            </div>

            <!-- Intro -->
            <p style="font-size: 11px; color: var(--slate-700); line-height: 1.6; text-align: justify; margin-bottom: 20px;">
                يهدف هذا الدليل المالي المعتمد إلى حوكمة وتوضيح دورة حركة الأموال وحمايتها بمشروعات التسويق المشتركة تحت إدارة وإشراف 
                <strong>شركة عبده ميديا</strong>. تم تصميم القواعد المحاسبية التالية لضمان الحفاظ المستمر على تدفق المخزون وسلامة الهيكل المالي للمتجر وتجنب تآكل رأس المال تحت أي ظرف من الظروف.
            </p>

            <!-- Section 1: Pillars -->
            <div class="policy-section">
                <div class="section-header">
                    <span class="section-icon">⚙️</span>
                    <span>المادة الأولى: ركائز الدورة المحاسبية وحماية رأس المال</span>
                </div>
                
                <div class="grid-pillars">
                    <div class="pillar-card">
                        <span class="pillar-title">🪙 1. رأس المال المودع (الأصول المجمّدة)</span>
                        <span class="pillar-text">
                            هو كاش مجمّد مخصص حصرياً لشراء المخزون وتأسيس المتجر. يعتبر <strong>ديناً ثابتاً في ذمة المتجر</strong> لصالح أصحابه، ولا يُسمح نهائياً بسحبه أو توزيعه كأرباح شهرية؛ بل تظل البضائع على الرفوف ممثلة ومحافظة على قيمته الكاملة.
                        </span>
                    </div>

                    <div class="pillar-card accent">
                        <span class="pillar-title">📦 2. المبيعات الإجمالية (التحصيلات)</span>
                        <span class="pillar-text">
                            إجمالي الأموال المحصّلة كاش من الزبائن <strong>ليست أرباحاً</strong>! بل تشتمل بالأساس على (تكلفة البضاعة الأصلية بسعر جملتها + مصاريف الشحن والتغليف + رسوم الدفع والمعاينة + هامش الربح البسيط). توزيعها يعني إفلاس المتجر.
                        </span>
                    </div>

                    <div class="pillar-card accent">
                        <span class="pillar-title">🛠️ 3. تكلفة البضاعة المباعة (COGS)</span>
                        <span class="pillar-text">
                            تساوي (عدد القطع المباعة × سعر شرائها الأصلي بسعر الجملة). يجب محاسبياً وعملياً استقطاع هذه القيمة فوراً من الكاش المحصّل وإعادتها لدرج المشتريات لتمويل البضاعة البديلة والحفاظ على ملء رفوف المتجر باستمرار.
                        </span>
                    </div>

                    <div class="pillar-card">
                        <span class="pillar-title">📢 4. مصاريف التشغيل والتسويق</span>
                        <span class="pillar-text">
                            تتضمن نفقات الإعلانات الممولة المدارة بواسطة <strong>عبده ميديا</strong>، وأجور الشحن والتوصيل، ورواتب الكاشير، والاشتراكات. تُخصم هذه المبالغ بالكامل من الأرباح المتبقية قبل ترحيل حصص الشركاء.
                        </span>
                    </div>
                </div>
            </div>

            <!-- Formula -->
            <div class="formula-box">
                <span class="formula-title">📈 المادة الثانية: المعادلة الذهبية المعتمدة لاحتساب الربح الصافي</span>
                <span style="font-size: 11px; color: var(--slate-700); display: block;">الربح الصافي الفعلي هو المتبقي الوحيد القابل للتوزيع ولا يُعتد بأي طريقة حسابية أخرى:</span>
                <div class="formula-code">
                    صافي الربح الفعلي = إجمالي التحصيلات - تكلفة البضاعة بسعر الجملة - مصاريف الشحن والتشغيل والدعاية والإرجاع
                </div>
            </div>

            <!-- Section 2: Practical Example -->
            <div class="policy-section">
                <div class="section-header">
                    <span class="section-icon">📝</span>
                    <span>المادة الثالثة: مثال توضيحي عملي بالأرقام لشريكين (أحمد وباسم)</span>
                </div>
                
                <div class="example-box">
                    <span class="example-title">💡 سيناريو الشراكة المتساوية (بنسبة 50% لكل منهما):</span>
                    
                    <div class="example-subgrid">
                        • <strong>رأس المال المودع:</strong> ساهم أحمد بـ 10,000 ج.م وباسم بـ 10,000 ج.م (إجمالي رأس المال بالخزنة = 20,000 ج.م كاش تم شراء بضاعة بها).<br/>
                        • <strong>حجم مبيعات المتجر (التحصيل):</strong> حقق المتجر مبيعات إجمالية كاش بلغت <strong>100,000 ج.م</strong>.<br/>
                        • <strong>تكلفة البضاعة المباعة (بسعر الجملة):</strong> بلغت <strong>70,000 ج.م</strong> (هذا الكاش يتم تجميده فوراً لإعادة شراء البضاعة الجديدة ولا يلمسه أحد).<br/>
                        • <strong>مصاريف التشغيل والإعلانات والشحن:</strong> بلغت <strong>18,000 ج.م</strong>.<br/>
                        • <strong>الربح الصافي المتبقي للتوزيع:</strong> 100,000 مبيعات - 70,000 تكلفة - 18,000 مصاريف = <strong style="color: var(--success);">12,000 ج.م</strong> فقط.
                    </div>
                    
                    <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #cbd5e1; font-size: 11px;">
                        👤 <strong>توزيع الأرباح والمسحوبات الشخصية وتخارج الكاش:</strong><br/>
                        • <strong>الشريك أحمد (سحب مسحوبات شخصية 2,000 ج.م):</strong> يضاف نصيبه من الربح (6,000 ج.م) لرأسماله الأصلي ليصبح إجمالي مستحقاته بالمتجر 16,000 ج.م. وعند التخارج يستلم كاش <strong>14,000 ج.م</strong> بعد استرداد مسحوباته الفردية.<br/>
                        • <strong>الشريك باسم (مسحوباته 0 ج.م):</strong> يضاف نصيبه من الربح (6,000 ج.م) لرأسماله الأصلي لتصبح مستحقاته الإجمالية 16,000 ج.م. وبما أنه لم يسحب أي مسحوبات شخصية، يستلم كاش <strong>16,000 ج.م</strong> عند التخارج.
                    </div>
                </div>
            </div>

            <!-- Section 3: Turnover Explainer -->
            <div class="policy-section">
                <div class="section-header">
                    <span class="section-icon">🔄</span>
                    <span>المادة الرابعة: تفسير سرعة دوران رأس المال (Capital Turnover)</span>
                </div>
                
                <div class="turnover-card">
                    <strong>❓ كيف تبلغ تكلفة البضائع 70,000 ج.م بينما إجمالي رأس المال المودع هو 20,000 ج.م فقط؟</strong><br/>
                    <p style="margin: 6px 0 0 0; font-size: 10.5px; color: var(--slate-700); text-align: justify;">
                        السر هو **تكرار تدوير رأس المال**. الشريكان لم يدفعا 70,000 ج.م للمورد في أول يوم بالكامل، بل قاما بتشغيل الـ 20,000 ج.م الأصلية 3 إلى 4 مرات متتالية خلال الشهر:
                        شراء بضاعة بـ 20,000 ج.م ⬅️ بيعها تدريجياً للزبائن وتحصيل 30,000 ج.م ⬅️ استقطاع 20,000 ج.م (تكلفة جملة البضاعة) والنزول لشراء بضاعة جديدة فوراً لملء الرفوف ⬅️ تكرار هذه الدورة يراكم مبيعات قدرها 100 ألف وتكلفة قدرها 70 ألف بنهاية الشهر، مع الحفاظ الكامل على بقاء بضائع الـ 20,000 ج.م الأصلية حية على الرفوف دون تآكل.
                    </p>
                </div>
            </div>

            <!-- Section 4: Abdo Media Commitment -->
            <div class="policy-section">
                <div class="section-header">
                    <span class="section-icon">🛡️</span>
                    <span>المادة الخامسة: الالتزام والتوافق في سياسة الدعاية والتسويق</span>
                </div>
                <p style="font-size: 11px; color: var(--slate-700); line-height: 1.6; text-align: justify; margin: 0;">
                    تلتزم <strong>شركة عبده ميديا بالتسويق</strong> بإدارة الحملات الإعلانية الممولة وبناء قنوات المبيعات واستهداف العملاء لرفع معدل دوران رأس المال بالمتجر، بينما يلتزم الشركاء بتمويل شراء مخزون البضاعة بالجملة وتجميد تكلفة البضائع فور تحصيلها لضمان تغذية الرفوف، والامتناع التام عن سحب أو تجميد أي مبالغ من التحصيلات إلا بعد غلق الدفاتر الدورية واحتساب صافي الأرباح قانونياً.
                </p>
            </div>

            <!-- Signature and Stamp Block -->
            <div class="signature-area">
                <div class="sig-box">
                    <div class="sig-title">إشراف وتوثيق: شركة عبده ميديا للتسويق</div>
                    <div class="sig-line"></div>
                    <div class="sig-seal">قسم الحسابات والتدقيق المالي والسياسات</div>
                </div>
                <div class="sig-box">
                    <div class="sig-title">اعتماد الشريك المستفيد / الطرف الثاني</div>
                    <div class="sig-line"></div>
                    <div class="sig-seal">التوقيع / البصمة وتاريخ الموافقة</div>
                </div>
            </div>

            <p style="text-align: center; font-size: 9px; color: #94a3b8; font-weight: 700; margin-top: 35px; border-top: 1px solid #f1f5f9; padding-top: 10px;">
                حقوق الملكية الفكرية والسياسة التنظيمية محفوظة لشركة عبده ميديا &copy; 2026. أي استخدام للوثيقة أو صياغتها لغير المتاجر المسجلة يعرض فاعله للمساءلة القانونية.
            </p>
        </div>
        <script>
            window.onload = function() { window.print(); }
        </script>
    </body>
    </html>
  `;
};



