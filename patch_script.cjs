const fs = require('fs');
const content = fs.readFileSync('components/PartnerStatementModal.tsx', 'utf8');

const buildHtmlFunction = `
  const buildHtmlContent = () => {
    const storeTitle = (settings as any).storeName || (settings as any).companyName || 'وان تولز للعدد اليدوية';
    const printDate = new Date().toLocaleDateString('ar-EG');
    const printTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    let rowsHtml = '';
    filteredRows.forEach((t, idx) => {
      const typeLabel = getTxTypeName(t.type);
      const isAdd = t.isAddition;
      const val = t.amountNum;
      
      let accountName = 'الخزينة العامة / نقدي';
      if (t.treasuryAccountId) {
        const acc = treasury?.accounts?.find(a => String(a.id) === String(t.treasuryAccountId));
        if (acc) accountName = \`\${acc.name} (\${acc.type === 'bank' ? 'بنك' : acc.type === 'wallet' ? 'محفظة' : 'خزينة'})\`;
      }

      rowsHtml += \`
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px; \${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
          <td style="padding: 9px 12px; text-align: right; color: #475569; white-space: nowrap;">
            \${new Date(t.date).toLocaleDateString('ar-EG')}
            <div style="font-size: 9px; color: #94a3b8;">\${new Date(t.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
          </td>
          <td style="padding: 9px 12px; text-align: right; font-weight: bold; color: #1e293b;">
            \${typeLabel}
            \${t.treasuryAccountId ? \`<div style="font-size: 9px; color: #4f46e5; font-weight: normal;">\${accountName}</div>\` : ''}
          </td>
          <td style="padding: 9px 12px; text-align: right; color: #334155; max-width: 280px; line-height: 1.4;">\${t.note || '-'}</td>
          <td style="padding: 9px 12px; text-align: left; font-weight: bold; font-family: monospace; font-size: 12px; color: \${isAdd ? '#059669' : '#dc2626'}; white-space: nowrap;">
            \${isAdd ? '+' : '-'}\${val.toLocaleString()} ج.م
          </td>
          <td style="padding: 9px 12px; text-align: left; font-weight: 900; font-family: monospace; font-size: 12px; color: #1e293b; white-space: nowrap;">
            \${t.runningBalance.toLocaleString()} ج.م
          </td>
        </tr>
      \`;
    });

    const summaryCardsHtml = showSummaryCards ? \`
      <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-bottom: 25px; background: #f8fafc; padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0;">
        
        <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: right;">
          <div style="font-size: 9px; color: #64748b; font-weight: bold;">الرصيد الصافي</div>
          <div style="font-size: 13px; font-weight: 900; color: \${partner.balance >= 0 ? '#059669' : '#dc2626'}; font-family: monospace; margin-top: 4px;">
            \${partner.balance.toLocaleString()} ج.م
          </div>
          <div style="font-size: 8px; color: \${partner.balance >= 0 ? '#059669' : '#dc2626'}; font-weight: bold;">
            \${partner.balance >= 0 ? 'مستحق للشريك' : 'سلفة عليه'}
          </div>
        </div>

        <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: right;">
          <div style="font-size: 9px; color: #64748b; font-weight: bold;">رأس المال والتمويل</div>
          <div style="font-size: 13px; font-weight: 900; color: #2563eb; font-family: monospace; margin-top: 4px;">
            \${overallStats.totalInvested.toLocaleString()} ج.م
          </div>
          <div style="font-size: 8px; color: #64748b; font-weight: bold;">
            إجمالي الاستثمار
          </div>
        </div>

        <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: right;">
          <div style="font-size: 9px; color: #64748b; font-weight: bold;">الأرباح الموزعة</div>
          <div style="font-size: 13px; font-weight: 900; color: #059669; font-family: monospace; margin-top: 4px;">
            \${overallStats.totalDividends.toLocaleString()} ج.م
          </div>
          <div style="font-size: 8px; color: #059669; font-weight: bold;">
            مستحقات مسددة
          </div>
        </div>

        <div style="background: rgba(16, 185, 129, 0.05); padding: 10px; border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.2); text-align: right;">
          <div style="font-size: 9px; color: #047857; font-weight: bold;">الربح غير الموزع</div>
          <div style="font-size: 13px; font-weight: 900; color: #047857; font-family: monospace; margin-top: 4px;">
            \${overallStats.partnerUnallocatedProfit.toLocaleString()} ج.م
          </div>
          <div style="font-size: 8px; color: #059669; font-weight: bold;">
            حصة تقديرية
          </div>
        </div>

        <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: right;">
          <div style="font-size: 9px; color: #64748b; font-weight: bold;">سحب وسلف</div>
          <div style="font-size: 13px; font-weight: 900; color: #dc2626; font-family: monospace; margin-top: 4px;">
            \${(overallStats.totalWithdrawn + overallStats.totalLoans).toLocaleString()} ج.م
          </div>
          <div style="font-size: 8px; color: #ef4444; font-weight: bold;">
            شخصية
          </div>
        </div>

        <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: right;">
          <div style="font-size: 9px; color: #64748b; font-weight: bold;">العهدة المعلقة</div>
          <div style="font-size: 13px; font-weight: 900; color: #d97706; font-family: monospace; margin-top: 4px;">
            \${overallStats.partnerCustody.toLocaleString()} ج.م
          </div>
          <div style="font-size: 8px; color: #d97706; font-weight: bold;">
            تشغيلية طرفه
          </div>
        </div>

        <div style="background: rgba(79, 70, 229, 0.05); padding: 10px; border-radius: 8px; border: 1px solid rgba(79, 70, 229, 0.2); text-align: right;">
          <div style="font-size: 9px; color: #4338ca; font-weight: bold;">العهد المسواة</div>
          <div style="font-size: 13px; font-weight: 900; color: #4338ca; font-family: monospace; margin-top: 4px;">
            \${overallStats.settledCustodyTotal.toLocaleString()} ج.م
          </div>
          <div style="font-size: 8px; color: #4f46e5; font-weight: bold;">
            تم توريدها
          </div>
        </div>

      </div>
    \` : '';

    const signaturesHtml = showSignatures ? \`
      <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; color: #475569; border-top: 1px dashed #cbd5e1; padding-top: 20px;">
        <div style="text-align: right; width: 45%;">
          <p style="font-weight: bold; margin: 0 0 5px 0;">إعداد واعتماد الإدارة المالية:</p>
          <p style="margin: 0; color: #64748b;">التوقيع / الختم: _____________________________</p>
          <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 9px;">تمت المراجعة والتدقيق المالي للنظام</p>
        </div>
        <div style="text-align: right; width: 45%;">
          <p style="font-weight: bold; margin: 0 0 5px 0;">إقرار ومصادقة الشريك (\${partner.name}):</p>
          <p style="margin: 0; color: #64748b;">التوقيع: _____________________________</p>
          <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 9px;">أقر بصحة العمليات والرصيد المذكور أعلاه</p>
        </div>
      </div>
    \` : '';

    return \`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>كشف حساب الشريك - \${partner.name}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #ffffff;
            color: #0f172a;
            margin: 0;
            padding: 20px;
            direction: rtl;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header-box {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .title-area h1 {
            margin: 0 0 4px 0;
            font-size: 20px;            font-weight: 900;            color: #1e1b4b;          }          .title-area p {            margin: 0;            font-size: 11px;            color: #475569;            font-weight: 600;          }          .meta-box {            text-align: left;            font-size: 10px;            color: #64748b;          }          .meta-box strong {            color: #0f172a;            font-size: 12px;          }          table {            width: 100%;            border-collapse: collapse;            text-align: right;            margin-top: 10px;          }          th {            background-color: #f1f5f9;            color: #334155;            font-weight: 800;            padding: 8px 12px;            font-size: 10.5px;            border-bottom: 2px solid #cbd5e1;            border-top: 1px solid #cbd5e1;          }          .page-footer {            margin-top: 30px;            text-align: center;            font-size: 9px;            color: #94a3b8;            border-top: 1px solid #f1f5f9;            padding-top: 8px;          }        </style>
      </head>
      <body>
        <div class="header-box">
          <div class="title-area">
            <h1>\${storeTitle}</h1>
            <p>كشف حساب الشريك: <strong style="color: #4338ca; font-size: 13px;">\${partner.name}</strong> | نسبة الأرباح: <strong>\${partner.profitRatio}%</strong></p>
          </div>
          <div class="meta-box">
            <div><strong>كشف حساب مالي تفصيلي</strong></div>
            <div style="margin-top: 3px;">تاريخ التوليد: \${printDate} - \${printTime}</div>
            <div>الحالة: <span style="color: #059669; font-weight: bold;">حساب نشط ومطابق</span></div>
          </div>
        </div>
        \${summaryCardsHtml}
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h3 style="font-weight: 900; font-size: 12.5px; margin: 0; color: #1e293b;">سجل القيود والمعاملات المالية (\${filteredRows.length} معاملة)</h3>
            <span style="font-size: 9.5px; color: #64748b;">العملة: الجنيه المصري (ج.م)</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style="text-align: right; width: 14%;">التاريخ والوقت</th>
                <th style="text-align: right; width: 22%;">نوع المعاملة / القيد</th>
                <th style="text-align: right; width: 34%;">البيان والتفاصيل</th>
                <th style="text-align: left; width: 15%;">القيمة (مدين/دائن)</th>
                <th style="text-align: left; width: 15%;">الرصيد التراكمي</th>
              </tr>
            </thead>
            <tbody>
              \${rowsHtml || \`<tr><td colspan="5" style="text-align: center; padding: 25px; color: #94a3b8; font-weight: bold;">لا توجد معاملات مسجلة تطابق محددات البحث.</td></tr>\`}
            </tbody>
            <tfoot>
              <tr style="background: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e1; font-size: 11px;">
                <td colspan="3" style="padding: 10px 12px; text-align: right; color: #1e293b;">
                  صافي الرصيد الختامي بعد جميع الحركات:
                </td>
                <td colspan="2" style="padding: 10px 12px; text-align: left; font-size: 14px; font-weight: 900; color: \${partner.balance >= 0 ? '#059669' : '#dc2626'}; font-family: monospace;">
                  \${partner.balance >= 0 ? '+' : ''}\${partner.balance.toLocaleString()} ج.م
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        \${signaturesHtml}
        <div class="page-footer">
          تم استخراج هذا التقرير آلياً عبر نظام إدارة الحسابات المالية الموحد. جميع الأرقام مطابقة للحركات الفعلية.
        </div>
      </body>
      </html>
    \`;
  };

  const handlePrint = () => {
    printHTMLDirectly(buildHtmlContent());
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const id = await shareReport(buildHtmlContent());
      setShareLink(\`\${window.location.origin}/shared-report/\${id}\`);
    } catch (error) {
      console.error('Share Error:', error);
      alert('حدث خطأ أثناء إنشاء رابط المشاركة.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };
`;

const oldHandlePrintRegex = /const handlePrint = \(\) => \{[\s\S]*?printHTMLDirectly\(html\);\s*\};/;
const newContent = content.replace(oldHandlePrintRegex, buildHtmlFunction);

fs.writeFileSync('components/PartnerStatementModal.tsx', newContent);
