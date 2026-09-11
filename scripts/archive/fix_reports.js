const fs = require('fs');
let code = fs.readFileSync('components/ReportsPage.tsx', 'utf-8');

const regex = /const FinalReport: React\.FC<ReportsPageProps> = \(\{ orders, settings, wallet, treasury, activeStore, dateRangeText, supplyOrders \}\) => \{[\s\S]*?let totalProductRevenue = 0;/;

const newCode = `const FinalReport: React.FC<ReportsPageProps> = ({ orders, settings, wallet, treasury, activeStore, dateRangeText, supplyOrders }) => {
    const { showInventoryValue, toggleInventoryValue } = useInventoryVisibility();
    const [subTab, setSubTab] = useState<'summary' | 'financials' | 'operations' | 'partners'>('summary');
    const stats = useMemo(() => {
        const failedOrders = orders.filter(o => {
            const { loss, net } = calculateOrderProfitLoss(o, settings);
            return ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'تمت_الاعادة_لشركة_الشحن', 'ملغي'].includes(o.status) || loss > 0 || net < 0;
        });
        const collectedOrders = orders.filter(o => {
            return ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل', 'تم_الاستبدال'].includes(o.status) && !failedOrders.some(f => f.id === o.id);
        });

        let totalProductRevenue = 0;`;

fs.writeFileSync('components/ReportsPage.tsx', code.replace(regex, newCode));
