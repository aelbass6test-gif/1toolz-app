import { Order, Settings } from '../types';

export const isBosta = (companyName: string): boolean => {
    if (!companyName) return false;
    const norm = companyName.trim().toLowerCase();
    return norm.includes('bosta') || norm.includes('بوسطة') || norm.includes('بوسطه');
};

export const getOrderProductCost = (order: Order): number => {
    if (order.productCost && order.productCost > 0) {
        return order.productCost;
    }
    if (order.items && order.items.length > 0) {
        return order.items.reduce((sum, item) => sum + ((item.cost || 0) * (item.quantity || 1)), 0);
    }
    return 0;
};

export const getOrderBasePrice = (order: Order, settings?: Settings): number => {
    if (order.items && order.items.length > 0 && settings?.products) {
        return order.items.reduce((sum, item) => {
            const product = settings.products.find(p => p.id === item.productId || p.sku === item.productId);
            const base = product?.basePrice ?? product?.price ?? item.price;
            return sum + (base * (item.quantity || 1));
        }, 0);
    }
    
    if (settings?.products) {
        const product = settings.products.find(p => p.name === order.productName || p.sku === order.productName);
        if (product) {
            return product.basePrice ?? product.price;
        }
    }
    
    return order.productPrice;
};

export const calculateInsuranceFee = (order: Order, insuranceRate: number, settings?: Settings): number => {
    if (order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر') return 0;
    const isInsured = order.isInsured ?? true;
    if (!isInsured) return 0;
    
    const compFees = settings?.companySpecificFees?.[order.shippingCompany];
    const useCustom = compFees?.useCustomFees ?? false;
    
    const isCompanyBosta = isBosta(order.shippingCompany);
    const defaultBasis = isCompanyBosta ? 'cost' : 'total';
    const basis = useCustom ? (compFees?.insuranceBasis ?? defaultBasis) : (settings?.insuranceBasis ?? defaultBasis);
    
    let result = 0;
    if (basis === 'cost') {
        const productCost = getOrderProductCost(order);
        result = (productCost * insuranceRate) / 100;
    } else if (basis === 'price') {
        result = (order.productPrice * insuranceRate) / 100;
    } else if (basis === 'base') {
        const basePrice = getOrderBasePrice(order, settings);
        result = (basePrice * insuranceRate) / 100;
    } else {
        result = ((order.productPrice + order.shippingFee) * insuranceRate) / 100;
    }
    return Math.round(result * 100) / 100;
};

export const calculateBostaVat = (order: Order, insuranceFee: number, settings?: Settings): number => {
    if (order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر') return 0;
    const compFees = settings?.companySpecificFees?.[order.shippingCompany];
    const useCustom = compFees?.useCustomFees ?? false;
    
    const isCompanyBosta = isBosta(order.shippingCompany);
    const defaultVatRate = isCompanyBosta ? 0.14 : 0;
    const vatRate = useCustom ? (compFees?.shippingVatRate ?? defaultVatRate) : (settings?.shippingVatRate ?? defaultVatRate);
    
    const result = (order.shippingFee + insuranceFee) * vatRate;
    return Math.round(result * 100) / 100;
};

export const calculateCodFee = (order: Order, settings: Settings): number => {
    if (order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر') return 0;
    const compFees = settings.companySpecificFees?.[order.shippingCompany];
    const useCustom = compFees?.useCustomFees ?? false;
    const enabled = useCustom ? (compFees?.enableCodFees ?? true) : settings.enableGlobalCod;
    if (!enabled) return 0;

    const threshold = useCustom ? (compFees?.codThreshold ?? settings.codThreshold) : settings.codThreshold;
    const rate = useCustom ? (compFees?.codFeeRate ?? settings.codFeeRate) : settings.codFeeRate;
    const tax = useCustom ? (compFees?.codTaxRate ?? settings.codTaxRate) : settings.codTaxRate;

    const totalAmount = order.productPrice + order.shippingFee;
    
    if (totalAmount <= threshold) return 0;
    const taxableAmount = totalAmount - threshold;
    const fee = taxableAmount * rate;
    const result = fee * (1 + tax);
    return Math.round(result * 100) / 100;
};

export const getLatestProductCost = (productId: string, settings: Settings): number => {
    const latestItem = settings.supplyOrders
        .filter(so => so.status === 'completed')
        .flatMap(so => so.items.map(item => ({ ...item, date: so.date })))
        .filter(item => item.productId === productId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    
    if (latestItem) {
        let cost = latestItem.cost;
        if (latestItem.discountValue) {
            if (latestItem.discountType === 'percentage') {
                cost = cost * (1 - latestItem.discountValue / 100);
            } else {
                cost = cost - latestItem.discountValue;
            }
        }
        return cost;
    }
    
    return settings.products.find(p => p.id === productId)?.costPrice || 0;
};

export const calculateOrderProfitLoss = (order: Order, settings: Settings): { profit: number; loss: number; net: number } => {
  let profit = 0;
  let loss = 0;

  if (['ملغي', 'جاري_المراجعة', 'قيد_التنفيذ', 'في_انتظار_المكالمة'].includes(order.status)) {
    return { profit: 0, loss: 0, net: 0 };
  }

  const isPos = order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر';

  const compFees = settings.companySpecificFees?.[order.shippingCompany];
  const useCustom = compFees?.useCustomFees ?? false;
  
  const insuranceRate = isPos ? 0 : (useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0));
  const inspectionCost = isPos ? 0 : (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0));
  
  const isInsured = isPos ? false : (order.isInsured ?? true);
  // Use order.insuranceFee if available (synced from platform), otherwise calculate
  const insuranceFee = isPos ? 0 : (order.insuranceFee ?? calculateInsuranceFee(order, insuranceRate, settings));
  const effectiveInspectionCost = isPos ? 0 : (order.inspectionFee ?? inspectionCost);
  const bostaVat = isPos ? 0 : calculateBostaVat(order, insuranceFee, settings);

  if (order.status === 'تم_التحصيل' || order.status === 'مدفوعة' || order.status === 'تم_توصيلها') {
    const codFee = (order.status === 'مدفوعة' || isPos) ? 0 : calculateCodFee(order, settings);
    const inspectionAdjustment = (order.inspectionFeePaidByCustomer || isPos) ? 0 : effectiveInspectionCost;

    const safeProductPrice = Number(order.productPrice) || 0;
    const safeShippingFee = Number(order.shippingFee) || 0;
    const safeDiscount = Number(order.discount) || 0;
    const safeAdvance = Number(order.advancePayment) || 0;
    const safeProductCost = getOrderProductCost(order) || 0;

    const totalCollected = order.totalAmountOverride !== undefined && order.totalAmountOverride !== null
        ? order.totalAmountOverride + safeAdvance
        : (safeProductPrice + safeShippingFee - safeDiscount);
        
    const totalExpenses = safeProductCost + (isPos ? 0 : safeShippingFee) + insuranceFee + inspectionAdjustment + codFee + bostaVat;
    
    profit = totalCollected - totalExpenses;
  } else if (order.status === 'مرتجع' || order.status === 'فشل_التوصيل' || order.status === 'تمت_الاعادة_لشركة_الشحن') {
    const applyReturnFee = isPos ? false : (useCustom ? (compFees?.enableFixedReturn ?? false) : settings.enableReturnShipping);
    const returnFeeAmount = applyReturnFee ? (useCustom ? (compFees?.returnShippingFee ?? 0) : settings.returnShippingFee) : 0;
    const inspectionFeeCollected = (order.inspectionFeePaidByCustomer && !isPos) ? effectiveInspectionCost : 0;
    
    const isFlexShipEnabled = isPos ? false : (useCustom ? (compFees?.enableFlexShip ?? false) : (settings.enableFlexShip ?? false));
    const flexShipCollected = (isFlexShipEnabled && order.flexShipFeePaidByCustomer) ? (order.flexShipFee ?? (useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0))) : 0;
    
    loss = (insuranceFee + (isPos ? 0 : order.shippingFee) + effectiveInspectionCost + returnFeeAmount + bostaVat - inspectionFeeCollected - flexShipCollected);
  } else if (order.status === 'مرتجع_جزئي') {
    loss = (insuranceFee + effectiveInspectionCost + bostaVat);
  } else if (order.status === 'مرتجع_بعد_الاستلام') {
    const applyReturnFee = isPos ? false : (useCustom ? (compFees?.enableFixedReturn ?? false) : settings.enableReturnShipping);
    const returnFeeAmount = applyReturnFee ? (useCustom ? (compFees?.returnShippingFee ?? 0) : settings.returnShippingFee) : 0;
    
    const inspectionFeeCollected = (order.inspectionFeePaidByCustomer && !isPos) ? effectiveInspectionCost : 0;
    const codFee = isPos ? 0 : calculateCodFee(order, settings);
    
    loss = (insuranceFee + (isPos ? 0 : order.shippingFee) + effectiveInspectionCost + returnFeeAmount + codFee + bostaVat - inspectionFeeCollected);
  }
  
  const finalProfit = Math.round(profit * 100) / 100;
  const finalLoss = Math.round(loss * 100) / 100;
  const finalNet = Math.round((finalProfit - finalLoss) * 100) / 100;
  
  return { profit: finalProfit, loss: finalLoss, net: finalNet };
}
