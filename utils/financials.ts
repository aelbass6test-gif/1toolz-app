import { Order, Settings } from '../types';
import { EGYPT_GOVERNORATES } from '../constants';

export const isBosta = (companyName: string): boolean => {
    if (!companyName) return false;
    const norm = companyName.trim().toLowerCase();
    return norm.includes('bosta') || norm.includes('بوسطة') || norm.includes('بوسطه');
};

export const getOrderProductCost = (order: Order, settings?: Settings): number => {
    if (order.maintenanceItemValue && order.maintenanceItemValue > 0) {
        return order.maintenanceItemValue;
    }
    if (order.productCost && order.productCost > 0) {
        return order.productCost;
    }
    if (order.items && order.items.length > 0) {
        return order.items.reduce((sum, item) => {
            const cost = settings ? (getLatestProductCost(item.productId, settings) || item.cost || 0) : (item.cost || 0);
            return sum + (cost * (item.quantity || 1));
        }, 0);
    }
    return 0;
};

export const getStandardShippingFee = (order: Order, settings?: Settings): number => {
    if (!settings) return order.shippingFee || 0;
    
    const company = order.shippingCompany;
    const userOptions = (company && settings.shippingOptions?.[company]) || [];
    
    // Fallback options
    const options = [...userOptions];
    EGYPT_GOVERNORATES.forEach((gov, index) => {
        const exists = options.some(o => o.label === gov.name);
        if (!exists) {
            options.push({
                id: `gov_fallback_${index}`,
                label: gov.name,
                details: 'شحن قياسي',
                deliveryPrice: 55,
                baseWeight: 1,
                extraKgPrice: 5,
                returnPrice: 30,
                exchangePrice: 35,
                cashCollectionPrice: 0,
                returnToSenderPrice: 0,
                active: true,
                cities: gov.cities.map((city, cIndex) => ({ 
                    id: `city_fallback_${index}_${cIndex}`, 
                    name: city,
                    deliveryPrice: 55,
                    extraKgPrice: 5,
                    returnPrice: 30,
                    exchangePrice: 35,
                    cashCollectionPrice: 0,
                    returnToSenderPrice: 0,
                    useParentFees: true,
                    active: true
                }))
            });
        }
    });

    const selectedOption = options.find(opt => opt.label === (order.governorate || order.shippingArea));
    if (!selectedOption) {
        return order.shippingFee || 0; // fallback if no gov matched
    }

    const getPriceKey = (type?: string): 'deliveryPrice' | 'exchangePrice' | 'returnPrice' | 'cashCollectionPrice' | 'returnToSenderPrice' | 'maintenancePickupPrice' | 'maintenanceReturnPrice' => {
        if (type === 'exchange') return 'exchangePrice';
        if (type === 'return') return 'returnPrice';
        if (type === 'maintenance_pickup') return 'returnPrice';
        if (type === 'maintenance_return') return 'maintenanceReturnPrice' as any;
        if (type === 'cash_collection') return 'cashCollectionPrice';
        return 'deliveryPrice';
    };
    
    const priceKey = getPriceKey(order.shipmentType);
    let fee = (selectedOption[priceKey] as number) || selectedOption.deliveryPrice || 0;
    let extraKgPrice = selectedOption.extraKgPrice || 0;
    
    if (order.city) {
        const cityOpt = selectedOption.cities?.find(c => c.name === order.city);
        if (cityOpt) {
            if (cityOpt.useParentFees) {
                fee = (selectedOption[priceKey] as number) || selectedOption.deliveryPrice || 0;
                extraKgPrice = selectedOption.extraKgPrice || 0;
            } else {
                const cityFee = cityOpt[priceKey] !== undefined && cityOpt[priceKey] !== null ? cityOpt[priceKey] : cityOpt.deliveryPrice;
                if (cityFee !== undefined && cityFee !== null) {
                    fee = cityFee;
                    extraKgPrice = cityOpt.extraKgPrice || 0;
                }
            }
        }
    }
    
    const compFees = settings.companySpecificFees?.[company];
    const baseWeight = compFees?.useCustomFees && compFees.baseWeight !== undefined 
        ? compFees.baseWeight 
        : (settings.baseWeight !== undefined ? settings.baseWeight : 5);
        
    const totalWeight = order.items?.reduce((sum: number, item: any) => {
        const itemWeight = parseFloat(item.weight?.toString() || '0');
        const itemQuantity = parseInt(item.quantity?.toString() || '1');
        return sum + (itemWeight * itemQuantity);
    }, 0) || 0;
    
    const extraWeight = Math.max(0, totalWeight - baseWeight);
    const totalFee = fee + (Math.ceil(extraWeight) * extraKgPrice);
    
    return totalFee;
};

export const getOrderBasePrice = (order: Order, settings?: Settings): number => {
    if (order.maintenanceItemValue && order.maintenanceItemValue > 0) {
        return order.maintenanceItemValue;
    }
    if (order.items && order.items.length > 0 && settings?.products) {
        return order.items.reduce((sum, item) => {
            const product = settings.products.find(p => p.id === item.productId || p.sku === item.productId || p.variants?.some(v => v.id === item.productId));
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
    // For Bosta, default to 'cost' if no basis is specified, otherwise use global default or 'total'
    const defaultBasis = isCompanyBosta ? 'cost' : (settings?.insuranceBasis || 'total');
    const basis = useCustom ? (compFees?.insuranceBasis ?? defaultBasis) : (settings?.insuranceBasis ?? defaultBasis);
    
    let result = 0;
    const shippingFeeForInsurance = settings ? getStandardShippingFee(order, settings) : (order.shippingFee || 0);
    
    if (basis === 'cost') {
        const productCost = getOrderProductCost(order, settings);
        result = (productCost * insuranceRate) / 100;
    } else if (basis === 'price') {
        result = (order.productPrice * insuranceRate) / 100;
    } else if (basis === 'base') {
        const basePrice = getOrderBasePrice(order, settings);
        result = (basePrice * insuranceRate) / 100;
    } else {
        // total basis: (Price + Shipping - Discount)
        const discountAmount = (order.discountAffectsInsurance ?? true) ? (Number(order.discount) || 0) : 0;
        const totalAmount = (Number(order.productPrice) || 0) + (Number(shippingFeeForInsurance) || 0) - discountAmount;
        result = (Math.max(0, totalAmount) * insuranceRate) / 100;
    }
    
    return Math.round(result * 100) / 100;
};

export const calculateBostaVat = (order: Order, insuranceFee: number, settings?: Settings): number => {
    if (order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر') return 0;
    const compFees = settings?.companySpecificFees?.[order.shippingCompany];
    const useCustom = compFees?.useCustomFees ?? false;
    
    // Check if VAT is completely disabled for this shipping company
    if (useCustom && compFees?.enableVat === false) return 0;
    
    const isCompanyBosta = isBosta(order.shippingCompany);
    const defaultVatRate = isCompanyBosta ? 0.14 : 0;
    const vatRate = useCustom ? (compFees?.shippingVatRate ?? defaultVatRate) : (settings?.shippingVatRate ?? defaultVatRate);
    
    const useStandard = order.vatOnStandardShipping === true; 
    // Fix: If useStandard is false, we should respect the shipping fee even if it's 0.
    // Fallback only if the shipping fee is not a number (not yet entered)
    const hasManualFee = typeof order.shippingFee === 'number';
    const baseShippingFee = (useStandard || !hasManualFee)
        ? (settings ? getStandardShippingFee(order, settings) : (order.shippingFee || 0))
        : (order.shippingFee || 0);
        
    const defaultVatBasis = isCompanyBosta ? 'shipping_and_insurance' : 'shipping_only';
    const vatBasis = useCustom ? (compFees?.vatBasis || defaultVatBasis) : (settings?.vatBasis || defaultVatBasis);
    const insuranceValue = vatBasis === 'shipping_and_insurance' ? insuranceFee : 0;
    
    const isMaintenance = order.orderType === 'maintenance';
    const serviceBase = isMaintenance ? (Number((order as any).maintenanceCost) || 0) : 0;
    
    // Auto-calculate inspection fee internally
    const inspectionFeeParams = !isMaintenance && (order.includeInspectionFee ?? true) 
         ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings?.enableInspection ? (settings?.inspectionFee || 0) : 0)) 
         : 0;
    
    const result = (baseShippingFee + insuranceValue + inspectionFeeParams + serviceBase) * vatRate;
    return Math.round(result * 100) / 100;
};

export const calculateCodFee = (order: Order, settings: Settings): number => {
    if (!settings || order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر') return 0;
    const compFees = settings.companySpecificFees?.[order.shippingCompany];
    const useCustom = compFees?.useCustomFees ?? false;
    const enabled = useCustom ? (compFees?.enableCodFees ?? true) : settings.enableGlobalCod;
    if (!enabled) return 0;

    let threshold = useCustom ? (compFees?.codThreshold ?? settings.codThreshold) : settings.codThreshold;
    const rate = useCustom ? (compFees?.codFeeRate ?? settings.codFeeRate) : settings.codFeeRate;
    const tax = useCustom ? (compFees?.codTaxRate ?? settings.codTaxRate) : settings.codTaxRate;

    let totalAmount = 0;
    const orderSalesTax = Number((order as any).tax) || 0;
    const isDefinitivelyPosOrder = (order as any).channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر' || order.shippingArea === 'نقطة البيع' || (order.id && order.id.startsWith('POS-'));
    const inspectionFee = !isDefinitivelyPosOrder && (order.includeInspectionFee !== false) && (order.inspectionFeePaidByCustomer !== false) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings?.enableInspection ? settings.inspectionFee : 0)) : 0;

    if (order.source === 'synced' && order.totalPrice != null) {
        totalAmount = Number(order.totalPrice);
    } else if (order.totalAmountOverride !== undefined && order.totalAmountOverride !== null) {
        totalAmount = Number(order.totalAmountOverride);
    } else {
        totalAmount = Number(order.productPrice || 0) + Number(order.shippingFee || 0) + orderSalesTax + inspectionFee - Number(order.discount || 0) - Number(order.advancePayment || 0);
    }
    
    if (totalAmount <= threshold && threshold > 0) return 0;
    const taxableAmount = threshold > 0 ? Math.max(0, totalAmount - threshold) : Math.max(0, totalAmount);
    
    // rate and tax are percentages (e.g. 1 for 1%, 14 for 14%)
    const actualRate = rate / 100;
    const actualTax = tax / 100;
    
    const fee = taxableAmount * actualRate;
    const result = fee * (1 + actualTax);
    
    return Math.round(result * 100) / 100;
};

export const getLatestProductCost = (productId: string, settings: Settings): number => {
    if (!settings) return 0;
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
    
    const parentProduct = settings.products?.find(p => p.id === productId || p.variants?.some(v => v.id === productId));
    if (parentProduct) {
        if (parentProduct.id !== productId) {
            const variant = parentProduct.variants?.find(v => v.id === productId);
            if (variant && variant.costPrice !== undefined && variant.costPrice !== null) {
                return variant.costPrice;
            }
        }
        return parentProduct.costPrice || 0;
    }
    return 0;
};

export const calculateOrderProfitLoss = (order: Order, settings: Settings): { 
  profit: number; 
  loss: number; 
  net: number;
  carrierFees: number;
  productCost: number;
  netRevenue: number;
} => {
  let profit = 0;
  let loss = 0;
  let carrierFees = 0;
  let productCostCalculated = getOrderProductCost(order, settings) || 0;
  let netRevenue = 0;

  if (!settings || ['ملغي', 'جاري_المراجعة', 'قيد_التنفيذ', 'في_انتظار_المكالمة'].includes(order.status)) {
    return { profit: 0, loss: 0, net: 0, carrierFees: 0, productCost: productCostCalculated, netRevenue: 0 };
  }

  const isPos = order.channel === 'pos' || 
                order.shippingCompany === 'كاشير - بيع مباشر' || 
                order.shippingArea === 'نقطة البيع' ||
                (order.id && order.id.startsWith('POS-'));

  const compFees = settings.companySpecificFees?.[order.shippingCompany];
  const useCustom = compFees?.useCustomFees ?? false;
  
  const insuranceRate = isPos ? 0 : (useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0));
  const inspectionCost = isPos ? 0 : (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0));
  
  const isInsured = isPos ? false : (order.isInsured ?? true);
  const insuranceFee = isPos ? 0 : (isInsured ? calculateInsuranceFee(order, insuranceRate, settings) : 0);
  const effectiveInspectionCost = isPos || !(order.includeInspectionFee ?? true) ? 0 : inspectionCost;
  const bostaVat = isPos ? 0 : calculateBostaVat(order, insuranceFee, settings);

  const isFinanciallySettledSuccess = order.status === 'تم_التحصيل' || 
                                      order.status === 'مدفوعة' || 
                                      order.status === 'تم_توصيلها' || 
                                      order.status === 'تم_التوصيل' ||
                                      order.status === 'قيد_الشحن' ||
                                      order.status === 'تم_الارسال';

  if (isFinanciallySettledSuccess || order.paymentStatus === 'مدفوع') {
    const isPos = order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر' || order.shippingArea === 'نقطة البيع' || (order.id && order.id.startsWith('POS-'));
    const compFees = settings?.companySpecificFees?.[order.shippingCompany];
    const useCustom = compFees?.useCustomFees ?? false;
    const effectiveInspectionCost = useCustom ? (compFees?.inspectionFee ?? 0) : (settings?.enableInspection ? (settings.inspectionFee ?? 0) : 0);

    const inspectionExpense = (!isPos && (order.includeInspectionFee !== false)) ? effectiveInspectionCost : 0;
    const inspectionRevenue = (!isPos && (order.includeInspectionFee !== false) && (order.inspectionFeePaidByCustomer !== false)) ? effectiveInspectionCost : 0;

    const codFee = (order.status === 'مدفوعة' || isPos) ? 0 : calculateCodFee(order, settings);

    const safeProductPrice = Number(order.productPrice) || 0;
    const safeShippingFee = Number(order.shippingFee) || 0;
    const safeTax = Number(order.tax) || 0;
    const safeDiscount = Number(order.discount) || 0;
    const safeAdvance = Number(order.advancePayment) || 0;

    const flexShipRevenue = (order.enableFlexShip && order.flexShipFeePaidByCustomer) ? (order.flexShipFee ?? (useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0))) : 0;
    const flexShipCompanyDeduction = (order.enableFlexShip && order.flexShipFeePaidByCustomer) ? (order.flexShipCompanyFee ?? (useCustom ? (compFees?.flexShipCompanyFee ?? 0) : (settings.flexShipCompanyFee ?? 0))) : 0;

    const baseExpectedRevenue = safeProductPrice + safeShippingFee + safeTax - safeDiscount + inspectionRevenue + flexShipRevenue;

    let totalRevenueForProfit = baseExpectedRevenue;
    let netRevenueCollected = baseExpectedRevenue;

    if (order.source === 'synced' && order.totalPrice != null) {
        netRevenueCollected = Number(order.totalPrice) + inspectionRevenue + flexShipRevenue;
    } else if (order.totalAmountOverride !== undefined && order.totalAmountOverride !== null && String(order.totalAmountOverride).trim() !== '') {
        // totalAmountOverride is the COD amount. Gross Revenue = COD + Advance.
        netRevenueCollected = Number(order.totalAmountOverride) + safeAdvance;
    }
        
    const standardShippingFee = getStandardShippingFee(order, settings);
    carrierFees = (isPos ? 0 : standardShippingFee) + insuranceFee + inspectionExpense + codFee + bostaVat + flexShipCompanyDeduction;
    
    netRevenue = netRevenueCollected;
    // Calculate profit based on base expected revenue (without manual differences)
    profit = totalRevenueForProfit - carrierFees - productCostCalculated;
  } else {
    const isReturn = ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي'].includes(order.status);
    
    if (isReturn) {
      const applyReturnFee = isPos ? false : (useCustom ? (compFees?.enableFixedReturn ?? false) : settings.enableReturnShipping);
      const returnFeeAmount = (order.status === 'مرتجع' || order.status === 'فشل_التوصيل' || order.status === 'تمت_الاعادة_لشركة_الشحن' || order.status === 'مرتجع_بعد_الاستلام') ? (applyReturnFee ? (useCustom ? (compFees?.returnShippingFee ?? 0) : settings.returnShippingFee) : 0) : 0;
      
      const isFlexShipEnabled = isPos ? false : (order.enableFlexShip !== undefined ? order.enableFlexShip : (useCustom ? (compFees?.enableFlexShip ?? false) : (settings.enableFlexShip ?? false)));
      const flexShipCompanyDeduction = (isFlexShipEnabled && order.flexShipFeePaidByCustomer) ? (order.flexShipCompanyFee ?? (useCustom ? (compFees?.flexShipCompanyFee ?? 0) : (settings.flexShipCompanyFee ?? 0))) : 0;
      
      // For failed/returned orders, we assume nothing was collected from the customer 
      // even if the setting said "on customer", because the delivery failed.
      const inspectionFeeCollected = 0;
      const flexShipCollected = (isFlexShipEnabled && order.flexShipFeePaidByCustomer) ? (order.flexShipFee ?? (useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0))) : 0;
      
      const codFee = (order.status === 'مرتجع_بعد_الاستلام' && !isPos) ? calculateCodFee(order, settings) : 0;
      
      const standardShippingFee = getStandardShippingFee(order, settings);
      
      // Basic carrier fee components
      carrierFees = (insuranceFee + (isPos ? 0 : standardShippingFee) + effectiveInspectionCost + returnFeeAmount + codFee + bostaVat + flexShipCompanyDeduction);
      
      // Net loss is carrier fees reduced by FlexShip fees collected
      loss = Math.max(0, carrierFees - flexShipCollected);
    }
  }
  
  return { 
    profit: Math.round(profit * 1000) / 1000, 
    loss: Math.round(loss * 1000) / 1000, 
    net: Math.round((profit - loss) * 1000) / 1000,
    carrierFees: Math.round(carrierFees * 1000) / 1000,
    productCost: Math.round(productCostCalculated * 1000) / 1000,
    netRevenue: Math.round(netRevenue * 1000) / 1000
  };
}

export const calculateOrderShippingAndFees = (o: Order, settings: Settings): number => {
  if (!settings) return o.shippingFee || 0;
  const isPos = o.channel === 'pos' || 
                o.shippingCompany === 'كاشير - بيع مباشر' || 
                o.shippingArea === 'نقطة البيع' ||
                (o.id && o.id.startsWith('POS-'));
  if (isPos) return 0;

  const compFees = settings.companySpecificFees?.[o.shippingCompany];
  const useCustom = compFees?.useCustomFees ?? false;
  
  const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
  const inspectionCost = useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0);
  
  const insuranceFee = o.insuranceFee ?? calculateInsuranceFee(o, insuranceRate, settings);
  const effectiveInspectionCost = o.inspectionFee ?? (o.includeInspectionFee === false ? 0 : inspectionCost);
  const bostaVat = calculateBostaVat(o, insuranceFee, settings);
  const baseShippingFee = getStandardShippingFee(o, settings);
  const inspectionExpense = (!isPos && (o.includeInspectionFee !== false)) ? effectiveInspectionCost : 0;
  // Inspection is only revenue if the customer is the one paying for it
  const inspectionRevenue = (!isPos && (o.includeInspectionFee !== false) && (o.inspectionFeePaidByCustomer !== false)) ? effectiveInspectionCost : 0;
  
  let totalFees = baseShippingFee + insuranceFee + bostaVat + inspectionExpense;

  if (o.status === 'تم_التحصيل' || o.status === 'مدفوعة' || o.status === 'تم_توصيلها' || o.status === 'تم_التوصيل') {
    const codFee = (o.status === 'مدفوعة' || isPos) ? 0 : calculateCodFee(o, settings);
    const isFlexShipEnabled = o.enableFlexShip !== undefined ? o.enableFlexShip : (useCustom ? (compFees?.enableFlexShip ?? false) : (settings.enableFlexShip ?? false));
    const flexShipCompanyDeduction = (isFlexShipEnabled && o.flexShipFeePaidByCustomer) ? (o.flexShipCompanyFee ?? (useCustom ? (compFees?.flexShipCompanyFee ?? 0) : (settings.flexShipCompanyFee ?? 0))) : 0;
    const flexShipCollected = (isFlexShipEnabled && o.flexShipFeePaidByCustomer) ? (o.flexShipFee ?? (useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0))) : 0;
    
    totalFees += codFee + flexShipCompanyDeduction - flexShipCollected;
  } else if (o.status === 'مرتجع' || o.status === 'فشل_التوصيل' || o.status === 'تمت_الاعادة_لشركة_الشحن') {
    const applyReturnFee = useCustom ? (compFees?.enableFixedReturn ?? false) : settings.enableReturnShipping;
    const returnFeeAmount = applyReturnFee ? (useCustom ? (compFees?.returnShippingFee ?? 0) : settings.returnShippingFee) : 0;
    
    const isFlexShipEnabled = o.enableFlexShip !== undefined ? o.enableFlexShip : (useCustom ? (compFees?.enableFlexShip ?? false) : (settings.enableFlexShip ?? false));
    const flexShipCompanyDeduction = (isFlexShipEnabled && o.flexShipFeePaidByCustomer) ? (o.flexShipCompanyFee ?? (useCustom ? (compFees?.flexShipCompanyFee ?? 0) : (settings.flexShipCompanyFee ?? 0))) : 0;
    const flexShipCollected = (isFlexShipEnabled && o.flexShipFeePaidByCustomer) ? (o.flexShipFee ?? (useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0))) : 0;

    totalFees = baseShippingFee + insuranceFee + inspectionExpense + returnFeeAmount + bostaVat + flexShipCompanyDeduction - flexShipCollected;
  } else if (o.status === 'مرتجع_جزئي') {
    totalFees = insuranceFee + inspectionExpense + bostaVat;
  } else if (o.status === 'مرتجع_بعد_الاستلام') {
    const applyReturnFee = useCustom ? (compFees?.enableFixedReturn ?? false) : settings.enableReturnShipping;
    const returnFeeAmount = applyReturnFee ? (useCustom ? (compFees?.returnShippingFee ?? 0) : settings.returnShippingFee) : 0;
    
    totalFees = baseShippingFee + insuranceFee + inspectionExpense + returnFeeAmount + bostaVat;
  } else {
    // For pending statuses, we can assume standard delivery fees
    const codFee = calculateCodFee(o, settings);
    totalFees += codFee;
  }
  
  return Math.max(0, Math.round(totalFees * 1000) / 1000);
};

export const resolveCashHolderName = (order: Order, settings: Settings): string => {
  if (order.channel === 'pos' && !order.cashHolderId) return 'نقطة البيع';
  if (order.cashHolderId === 'credit') return 'حساب آجل';
  if (order.cashHolderId === 'wallet') return 'المحفظة العامة';
  if (order.cashHolderName) return order.cashHolderName;
  
  if (!order.cashHolderId) return 'غير محدد';
  
  const id = order.cashHolderId;
  
  // Try to find in settings.cashHolders
  if (settings.cashHolders) {
    const holder = settings.cashHolders.find(h => h.userId === id);
    if (holder) return holder.userName;
  }
  
  // Handle prefixed IDs or raw IDs
  const rawId = id.replace(/^(emp_|part_|treas_)/, '');
  
  // Try to find in employees
  if (settings.employees) {
    const emp = settings.employees.find(e => e.id === id || e.id === rawId || (id === 'admin' && e.id === 'admin'));
    if (emp) return emp.name;
  }
  
  // Try to find in partners
  if (settings.partners) {
    const partner = settings.partners.find(p => p.id === id || p.id === rawId);
    if (partner) return `${partner.name} (شريك)`;
  }

  // Try to find in treasury accounts
  const s = settings as any;
  if (s.treasury?.accounts) {
    const acc = (s.treasury.accounts as any[]).find((a: any) => a.id === id || a.id === rawId);
    if (acc) return `${acc.name} (${acc.type === 'custody' ? 'عهدة' : 'حساب'})`;
  }
  
  return id === 'admin' ? 'المدير' : `عهدة (#${id})`;
};

export const getAdvancePaymentCustodyName = (order: any, settings?: any, treasury?: any): string => {
  if (!order) return "---";

  if (order.cashHolderId === 'wallet') return "أودعت في المحفظة العامة";

  const isPos = order.channel === 'pos' || order.shippingCompany?.includes('كاشير');
  const hasAdvance = (Number(order.advancePayment) || 0) > 0;

  if (!hasAdvance && !isPos) return "---";

  let tId = order.advancePaymentTreasuryId;
  let pId = order.advancePaymentPartnerId;
  let eId = order.advancePaymentEmployeeId;

  // For POS orders, if custody fields are not set, try cashHolderId
  if (isPos && !tId && !pId && !eId && order.cashHolderId) {
    const cid = order.cashHolderId;
    if (cid.startsWith('part_')) pId = cid.substring(5);
    else if (cid.startsWith('emp_')) eId = cid.substring(4);
    else if (cid.startsWith('treas_')) tId = cid.substring(6);
    else if (cid === 'admin') eId = 'admin';
  }

  // Fallback to history log if root IDs are not set
  if (!tId && !pId && !eId && Array.isArray(order.advancePaymentHistory) && order.advancePaymentHistory.length > 0) {
    const lastLog = order.advancePaymentHistory.slice().reverse().find((l: any) => (l.amount > 0) && (l.recipientId || l.recipientName || l.recipientType));
    if (lastLog) {
      if (lastLog.recipientName) {
        const prefix = lastLog.recipientType === 'partner' ? '🤝 عهدة شريك' : lastLog.recipientType === 'treasury' ? '🏦 خزينة / بنك' : '👤 عهدة';
        return `${prefix}: ${lastLog.recipientName}`;
      }
      if (lastLog.recipientType === 'treasury') tId = lastLog.recipientId;
      else if (lastLog.recipientType === 'partner') pId = lastLog.recipientId;
      else if (lastLog.recipientType === 'employee') eId = lastLog.recipientId;
    }
  }

  // Check Treasury
  if (tId && treasury?.accounts) {
    const accList = Array.isArray(treasury.accounts)
      ? treasury.accounts
      : Object.values(treasury.accounts || {});
    const acc: any = accList.find((a: any) => String(a.id) === String(tId));
    if (acc) {
      return `🏦 خزينة / بنك: ${acc.name} (${acc.type || "خزينة"})`;
    }
    return `🏦 حساب بنكي/خزينة (#${tId})`;
  }

  // Check Partner
  if (pId && settings?.partners) {
    const partnerList = Array.isArray(settings.partners)
      ? settings.partners
      : Object.values(settings.partners || {});
    const p: any = partnerList.find((pt: any) => String(pt.id) === String(pId));
    if (p) {
      return `🤝 عهدة شريك: ${p.name}`;
    }
    return `🤝 عهدة شريك (#${pId})`;
  }

  // Check Employee / Admin
  if (eId) {
    if (String(eId) === "admin") {
      return "👤 عهدة المدير (أنت)";
    }
    // Check in partners first (sometimes partners are selected under employees optgroup)
    if (settings?.partners) {
      const partnerList = Array.isArray(settings.partners)
        ? settings.partners
        : Object.values(settings.partners || {});
      const p: any = partnerList.find((pt: any) => String(pt.id) === String(eId));
      if (p) return `🤝 عهدة شريك: ${p.name}`;
    }
    if (settings?.employees) {
      const empList = Array.isArray(settings.employees)
        ? settings.employees
        : Object.values(settings.employees || {});
      const emp: any = empList.find((e: any) => String(e.id) === String(eId));
      if (emp) {
        return `👤 عهدة موظف: ${emp.name}`;
      }
    }
    return `👤 عهدة موظف (#${eId})`;
  }

  if (order.cashHolderName) {
    let cleanName = order.cashHolderName.replace(/\s*\((شريك|موظف|المدير|شريكه|partner|employee|admin)\)/gi, '').replace(/\s+(شريك|موظف|المدير|شريكه|partner|employee|admin)$/gi, '').trim();
    if (order.cashHolderName.includes('شريك') || order.cashHolderName.includes('partner')) {
      return `🤝 عهدة شريك: ${cleanName}`;
    }
    return `👤 عهدة: ${cleanName}`;
  }

  return "⚠️ غير محدد (لم يتم اختيار جهة استلام)";
};

