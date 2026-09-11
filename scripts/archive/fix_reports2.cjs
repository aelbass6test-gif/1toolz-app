const fs = require('fs');
let code = fs.readFileSync('components/ReportsPage.tsx', 'utf-8');

const regex = /const stats = useMemo\(\(\) => \{\n        const failedOrders = orders\.filter\(o => \{\n            const \{ loss, net \} = calculateOrderProfitLoss\(o, settings\);\n            return \['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'تمت_الاعادة_لشركة_الشحن', 'ملغي'\].includes\(o\.status\) \|\| loss > 0 \|\| net < 0;\n        \}\);\n        const collectedOrders = orders\.filter\(o => \{\n            return \['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل'\].includes\(o\.status\) && !failedOrders\.some\(f => f\.id === o\.id\);\n        \}\);/g;

const newCode = `const stats = useMemo(() => {
        const failedOrders = orders.filter(o => {
            const { loss, net } = calculateOrderProfitLoss(o, settings);
            return ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'تمت_الاعادة_لشركة_الشحن', 'ملغي'].includes(o.status) || loss > 0 || net < 0;
        });
        const collectedOrders = orders.filter(o => {
            return ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل', 'تم_الاستبدال'].includes(o.status) && !failedOrders.some(f => f.id === o.id);
        });`;

fs.writeFileSync('components/ReportsPage.tsx', code.replace(regex, newCode));
