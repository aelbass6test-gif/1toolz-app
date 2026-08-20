const fs = require('fs');
const content = fs.readFileSync('components/ProductsPage.tsx', 'utf8');

const targetContent1 = `
    // 1. Supply Orders (Purchases) - Only count 'completed' status!
    (settings.supplyOrders || []).forEach(order => {
        if (order.status !== 'completed') return;
        order.items.forEach(item => {
            const qty = (item.receivedQuantity !== undefined && item.receivedQuantity !== null) 
                ? Number(item.receivedQuantity) 
                : (Number(item.quantity) || 0);
            const totalQty = qty + (Number(item.bonusQuantity) || 0);
            const pId = normalizeId(item.productId);
            const vId = normalizeId(item.variantId);

            if (pId) {
`;

const replaceContent1 = `
    // 1. Supply Orders (Purchases) - Only count 'completed' status!
    (settings.supplyOrders || []).forEach(order => {
        if (order.status !== 'completed') return;
        order.items.forEach(item => {
            const pId = normalizeId(item.productId);
            const vId = normalizeId(item.variantId);
            
            if (!isAfterAudit(pId, vId, order.date)) return;

            const qty = (item.receivedQuantity !== undefined && item.receivedQuantity !== null) 
                ? Number(item.receivedQuantity) 
                : (Number(item.quantity) || 0);
            const totalQty = qty + (Number(item.bonusQuantity) || 0);

            if (pId) {
`;

let newFileContent = content.replace(targetContent1, replaceContent1);

const targetContent2 = `
    // 2. Orders (Sales) - Exclude statuses where product is returned/stayed in warehouse
    const excludedStatuses = ['ملغي', 'مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'تمت_الاعادة_لشركة_الشحن'];
    orders.forEach(order => {
        if (excludedStatuses.includes(order.status)) return;
        order.items?.forEach(item => {
            const qty = Number(item.quantity) || 0;
            const pId = normalizeId(item.productId);
            const vId = normalizeId(item.variantId);

            if (pId) {
`;

const replaceContent2 = `
    // 2. Orders (Sales) - Exclude statuses where product is returned/stayed in warehouse
    const excludedStatuses = ['ملغي', 'مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'تمت_الاعادة_لشركة_الشحن'];
    orders.forEach(order => {
        if (excludedStatuses.includes(order.status)) return;
        order.items?.forEach(item => {
            const pId = normalizeId(item.productId);
            const vId = normalizeId(item.variantId);
            
            if (!isAfterAudit(pId, vId, order.date)) return;

            const qty = Number(item.quantity) || 0;

            if (pId) {
`;

newFileContent = newFileContent.replace(targetContent2, replaceContent2);

const targetContent2b = `
        // Add back incoming items for exchange orders
        const isExchange = (order as any).orderType === 'exchange' || (order as any).shipmentType === 'exchange';
        if (isExchange && (order as any).exchangedItems) {
            const exchangedItems = ((order as any).exchangedItems || []).filter((item: any) => item && (item.selected === true || item.selected === undefined));
            exchangedItems.forEach((exItem: any) => {
                const qty = Number(exItem.quantity) || 1;
                const pId = normalizeId(exItem.productId);
                const vId = normalizeId(exItem.variantId);

                if (pId) {
`;

const replaceContent2b = `
        // Add back incoming items for exchange orders
        const isExchange = (order as any).orderType === 'exchange' || (order as any).shipmentType === 'exchange';
        if (isExchange && (order as any).exchangedItems) {
            const exchangedItems = ((order as any).exchangedItems || []).filter((item: any) => item && (item.selected === true || item.selected === undefined));
            exchangedItems.forEach((exItem: any) => {
                const pId = normalizeId(exItem.productId);
                const vId = normalizeId(exItem.variantId);
                
                if (!isAfterAudit(pId, vId, order.date)) return;

                const qty = Number(exItem.quantity) || 1;

                if (pId) {
`;

newFileContent = newFileContent.replace(targetContent2b, replaceContent2b);

const targetContent3 = `
    // 3. Order Returns (Add back items that were previously subtracted)
    (settings.orderReturns || []).forEach(ret => {
        if (ret.status === 'cancelled' || !ret.restockItems) return;
        // Only add back if the original order was actually subtracted (not in excluded statuses)
        const originalOrder = orders.find(o => o.id === ret.orderId);
        if (originalOrder && !excludedStatuses.includes(originalOrder.status)) {
            ret.items.forEach(item => {
                const qty = Number(item.quantity) || 0;
                const pId = normalizeId(item.productId);
                const vId = normalizeId(item.variantId);

                if (pId) {
`;

const replaceContent3 = `
    // 3. Order Returns (Add back items that were previously subtracted)
    (settings.orderReturns || []).forEach(ret => {
        if (ret.status === 'cancelled' || !ret.restockItems) return;
        // Only add back if the original order was actually subtracted (not in excluded statuses)
        const originalOrder = orders.find(o => o.id === ret.orderId);
        if (originalOrder && !excludedStatuses.includes(originalOrder.status)) {
            ret.items.forEach(item => {
                const pId = normalizeId(item.productId);
                const vId = normalizeId(item.variantId);
                
                if (!isAfterAudit(pId, vId, ret.date)) return;

                const qty = Number(item.quantity) || 0;

                if (pId) {
`;

newFileContent = newFileContent.replace(targetContent3, replaceContent3);

const targetContent4 = `
    // 4. Purchase Returns (Subtract items returned to suppliers)
    const prPMap: Record<string, number> = {};
    const prVMap: Record<string, number> = {};

    (settings.purchaseReturns || []).forEach(ret => {
        if (ret.status === 'cancelled') return;
        ret.items.forEach(item => {
            const qty = Number(item.quantity) || 0;
            const pId = normalizeId(item.productId);
            const vId = normalizeId(item.variantId);

            if (pId) {
`;

const replaceContent4 = `
    // 4. Purchase Returns (Subtract items returned to suppliers)
    const prPMap: Record<string, number> = {};
    const prVMap: Record<string, number> = {};

    (settings.purchaseReturns || []).forEach(ret => {
        if (ret.status === 'cancelled') return;
        ret.items.forEach(item => {
            const pId = normalizeId(item.productId);
            const vId = normalizeId(item.variantId);
            
            if (!isAfterAudit(pId, vId, ret.date)) return;

            const qty = Number(item.quantity) || 0;

            if (pId) {
`;

newFileContent = newFileContent.replace(targetContent4, replaceContent4);

fs.writeFileSync('components/ProductsPage.tsx', newFileContent);
