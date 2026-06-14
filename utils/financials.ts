import { Order, Settings } from '../types';
import { EGYPT_GOVERNORATES } from '../constants';

export const isBosta = (companyName: string): boolean => {
    if (!companyName) return false;
    const norm = companyName.trim().toLowerCase();
    return norm.includes('bosta') || norm.includes('بوسطة') || norm.includes('بوسطه');
};

export const getOrderProductCost = (order: Order): number => {
    if (order.maintenanceItemValue && order.maintenanceItemValue > 0) {
        return order.maintenanceItemValue;
    }
    if (order.productCost && order.productCost > 0) {
        return order.productCost;
    }
    if (order.items && order.items.length > 0) {
        return order.items.reduce((sum, item) => sum + ((item.cost || 0) * (item.quantity || 1)), 0);
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
    
    const compFees = settings?.companySpecificFees?.[(order.shippingCompany || '').trim()];
    const useCustom = compFees?.useCustomFees ?? false;
    
    const isCompanyBosta = isBosta(order.shippingCompany);
    const defaultBasis = isCompanyBosta ? 'cost' : 'total';
    const basis = useCustom ? (compFees?.insuranceBasis ?? defaultBasis) : (settings?.insuranceBasis ?? defaultBasis);
    
    let result = 0;
    
    const shippingFeeForInsurance = settings ? getStandardShippingFee(order, settings) : (order.shippingFee || 0);
    
    if (isCompanyBosta) {
        // Bosta insurance is always computed on the COD amount expected from the customer 
        // regardless of the drop-down (which is often misconfigured to 'cost' or 'base').
        const totalAmount = (Number(order.productPrice) || 0) + (Number(shippingFeeForInsurance) || 0) - (Number(order.discount) || 0);
        result = (Math.max(0, totalAmount) * insuranceRate) / 100;
    } else {
        if (basis === 'cost') {
            const productCost = getOrderProductCost(order);
            result = (productCost * insuranceRate) / 100;
        } else if (basis === 'price') {
            result = (order.productPrice * insuranceRate) / 100;
        } else if (basis === 'base') {
            const basePrice = getOrderBasePrice(order, settings);
            result = (basePrice * insuranceRate) / 100;
        } else {
            const totalAmount = (Number(order.productPrice) || 0) + (Number(shippingFeeForInsurance) || 0) - (Number(order.discount) || 0);
            result = (Math.max(0, totalAmount) * insuranceRate) / 100;
        }
    }
    return Math.round(result * 100) / 100;
};

export const calculateBostaVat = (order: Order, insuranceFee: number, settings?: Settings): number => {
    if (order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر') return 0;
    const compFees = settings?.companySpecificFees?.[(order.shippingCompany || '').trim()];
    const useCustom = compFees?.useCustomFees ?? false;
    
    // Check if VAT is completely disabled for this shipping company
    if (useCustom && compFees?.enableVat === false) return 0;
    
    const isCompanyBosta = isBosta(order.shippingCompany);
    const defaultVatRate = isCompanyBosta ? 0.14 : 0;
    const vatRate = useCustom ? (compFees?.shippingVatRate ?? defaultVatRate) : (settings?.shippingVatRate ?? defaultVatRate);
    
    const useStandard = order.vatOnStandardShipping === true; // Default to actual shipping fee if undefined
    const baseShippingFee = useStandard 
        ? (settings ? getStandardShippingFee(order, settings) : (order.shippingFee || 0))
        : (order.shippingFee || 0);
        
    const vatBasis = useCustom ? (compFees?.vatBasis || 'shipping_only') : (settings?.vatBasis || 'shipping_only');
    const insuranceValue = vatBasis === 'shipping_and_insurance' ? insuranceFee : 0;
    
    const result = (baseShippingFee + insuranceValue) * vatRate;
    return Math.round(result * 100) / 100;
};

export const calculateCodFee = (order: Order, settings: Settings): number => {
    if (!settings) return 0;
    if (order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر') return 0;
    const compFees = settings.companySpecificFees?.[(order.shippingCompany || '').trim()];
    const useCustom = compFees?.useCustomFees ?? false;
    const enabled = useCustom ? (compFees?.enableCodFees ?? true) : settings.enableGlobalCod;
    if (!enabled) return 0;

    let threshold = useCustom ? (compFees?.codThreshold ?? settings.codThreshold) : settings.codThreshold;
    const rate = useCustom ? (compFees?.codFeeRate ?? settings.codFeeRate) : settings.codFeeRate;
    const tax = useCustom ? (compFees?.codTaxRate ?? settings.codTaxRate) : settings.codTaxRate;

    let totalAmount = 0;
    if (order.source === 'synced' && order.totalPrice != null) {
        totalAmount = Number(order.totalPrice);
    } else if (order.totalAmountOverride !== undefined && order.totalAmountOverride !== null) {
        totalAmount = Number(order.totalAmountOverride);
    } else {
        totalAmount = Number(order.productPrice || 0) + Number(order.shippingFee || 0) - Number(order.discount || 0);
    }
    
    if (totalAmount <= threshold && threshold > 0) return 0;
    const taxableAmount = Math.max(0, totalAmount);
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

export const getOrderCollectionAmount = (order: Order): number => {
  const safeProductPrice = Number(order.productPrice) || 0;
  const safeShippingFee = Number(order.shippingFee) || 0;
  const safeTax = Number(order.tax) || 0;
  const safeDiscount = Number(order.discount) || 0;
  const safeAdvance = Number(order.advancePayment) || 0;
  
  // Important: Add fees if customer paid them
  const inspectionFee = order.inspectionFeePaidByCustomer ? (order.inspectionFee || 0) : 0;
  const flexShipFee = order.flexShipFeePaidByCustomer ? (order.flexShipFee || 0) : 0;
  
  const computedTotal = safeProductPrice + safeShippingFee + safeTax - safeDiscount - safeAdvance + inspectionFee + flexShipFee;
  const totalAmount = order.totalAmountOverride != null ? Number(order.totalAmountOverride) : computedTotal;
  const displayTotal = order.source === 'synced' && order.totalPrice != null ? Number(order.totalPrice) : totalAmount;
  return displayTotal;
};

export interface OrderFinancialsBreakdown {
  profit: number;
  loss: number;
  net: number;
  breakdown: {
    revenue: number;
    productRevenue: number;
    shippingRevenue: number;
    extraRevenue: number;
    productCost: number;
    shippingPaid: number;
    insurance: number;
    inspection: number;
    cod: number;
    vat: number;
    returnFee: number;
    flexShipDeduction: number;
    totalExpenses: number;
  }
}

export const calculateOrderProfitLoss = (order: Order, settings: Settings): OrderFinancialsBreakdown => {
  if (!settings) return { profit: 0, loss: 0, net: 0, breakdown: {} as any };
  let profit = 0;
  let loss = 0;

  const defaultBreakdown = {
    revenue: 0,
    productRevenue: 0,
    shippingRevenue: 0,
    extraRevenue: 0,
    productCost: 0,
    shippingPaid: 0,
    insurance: 0,
    inspection: 0,
    cod: 0,
    vat: 0,
    returnFee: 0,
    flexShipDeduction: 0,
    totalExpenses: 0
  };

  if (['ملغي', 'جاري_المراجعة', 'قيد_التنفيذ', 'في_انتظار_المكالمة'].includes(order.status)) {
    return { profit: 0, loss: 0, net: 0, breakdown: defaultBreakdown };
  }

  const isPos = order.channel === 'pos' || 
                order.shippingCompany === 'كاشير - بيع مباشر' || 
                order.shippingArea === 'نقطة البيع' ||
                (order.id && order.id.startsWith('POS-'));

  const compFees = settings.companySpecificFees?.[(order.shippingCompany || '').trim()];
  const useCustom = compFees?.useCustomFees ?? false;
  
  const insuranceRate = isPos ? 0 : (useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0));
  const inspectionCost = isPos ? 0 : (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0));
  
  // Use order.insuranceFee if available (synced from platform), otherwise calculate
  const insuranceFee = isPos ? 0 : (order.insuranceFee ?? calculateInsuranceFee(order, insuranceRate, settings));
  const effectiveInspectionCost = isPos ? 0 : (order.inspectionFee ?? inspectionCost);
  const bostaVat = isPos ? 0 : calculateBostaVat(order, insuranceFee, settings);
  const standardShippingFee = isPos ? 0 : getStandardShippingFee(order, settings);

  const safeProductPrice = Number(order.productPrice) || 0;
  const safeShippingFee = Number(order.shippingFee) || 0;
  const safeDiscount = Number(order.discount) || 0;
  const safeAdvance = Number(order.advancePayment) || 0;
  const safeProductCost = getOrderProductCost(order) || 0;
  const safeTax = Number(order.tax) || 0;

  const isSuccessful = order.status === 'تم_التحصيل' || order.status === 'مدفوعة' || order.status === 'تم_توصيلها';
  const isReturned = order.status === 'مرتجع' || order.status === 'فشل_التوصيل' || order.status === 'تمت_الاعادة_لشركة_الشحن';
  const isPartialReturn = order.status === 'مرتجع_جزئي';
  const isPostReturn = order.status === 'مرتجع_بعد_الاستلام';

  const breakdown = { ...defaultBreakdown };
  
  if (isSuccessful) {
     console.log(`Debug FINANCIALS: Order ${order.orderNumber} Status: ${order.status} Company: ${order.shippingCompany}`);
    const codFee = isPos ? 0 : calculateCodFee(order, settings);
    const inspectionAdjustment = (order.inspectionFeePaidByCustomer || isPos) ? 0 : effectiveInspectionCost;

    const totalCollected = order.totalAmountOverride !== undefined && order.totalAmountOverride !== null
        ? order.totalAmountOverride + safeAdvance
        : (safeProductPrice + safeShippingFee + safeTax - safeDiscount);
    
    const extraFeesCollected = (order.inspectionFeePaidByCustomer ? (order.inspectionFee || 0) : 0) + (order.flexShipFeePaidByCustomer ? (order.flexShipFee || 0) : 0);
    const finalRevenue = totalCollected + extraFeesCollected;

    const totalExpenses = safeProductCost + standardShippingFee + insuranceFee + inspectionAdjustment + codFee + bostaVat;
    
    profit = finalRevenue - totalExpenses;

    breakdown.revenue = finalRevenue;
    breakdown.productRevenue = safeProductPrice;
    breakdown.shippingRevenue = safeShippingFee;
    breakdown.extraRevenue = extraFeesCollected + safeTax;
    breakdown.productCost = safeProductCost;
    breakdown.shippingPaid = standardShippingFee;
    breakdown.insurance = insuranceFee;
    breakdown.inspection = inspectionAdjustment;
    breakdown.cod = codFee;
    breakdown.vat = bostaVat;
    breakdown.totalExpenses = totalExpenses;
  } else if (isReturned) {
    const applyReturnFee = isPos ? false : (useCustom ? (compFees?.enableFixedReturn ?? false) : settings.enableReturnShipping);
    const returnFeeAmount = applyReturnFee ? (useCustom ? (compFees?.returnShippingFee ?? 0) : settings.returnShippingFee) : 0;
    const inspectionFeeCollectedFromCustomer = (order.inspectionFeePaidByCustomer && !isPos) ? effectiveInspectionCost : 0;
    
    const isFlexShipEnabled = isPos ? false : (order.enableFlexShip !== undefined ? order.enableFlexShip : (useCustom ? (compFees?.enableFlexShip ?? false) : (settings.enableFlexShip ?? false)));
    const flexShipCollectedFromCustomer = (isFlexShipEnabled && order.flexShipFeePaidByCustomer) ? (order.flexShipFee ?? (useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0))) : 0;
    const flexShipCompanyDeduction = (isFlexShipEnabled && order.flexShipFeePaidByCustomer) ? (order.flexShipCompanyFee ?? (useCustom ? (compFees?.flexShipCompanyFee ?? 0) : (settings.flexShipCompanyFee ?? 0))) : 0;
    
    loss = (insuranceFee + standardShippingFee + effectiveInspectionCost + returnFeeAmount + bostaVat + flexShipCompanyDeduction - inspectionFeeCollectedFromCustomer - flexShipCollectedFromCustomer);

    breakdown.revenue = inspectionFeeCollectedFromCustomer + flexShipCollectedFromCustomer;
    breakdown.shippingPaid = standardShippingFee;
    breakdown.insurance = insuranceFee;
    breakdown.inspection = effectiveInspectionCost;
    breakdown.vat = bostaVat;
    breakdown.returnFee = returnFeeAmount;
    breakdown.flexShipDeduction = flexShipCompanyDeduction;
    breakdown.totalExpenses = (insuranceFee + standardShippingFee + effectiveInspectionCost + returnFeeAmount + bostaVat + flexShipCompanyDeduction);
  } else if (isPartialReturn) {
    loss = (insuranceFee + effectiveInspectionCost + bostaVat);
    breakdown.insurance = insuranceFee;
    breakdown.inspection = effectiveInspectionCost;
    breakdown.vat = bostaVat;
    breakdown.totalExpenses = loss;
  } else if (isPostReturn) {
    const applyReturnFee = isPos ? false : (useCustom ? (compFees?.enableFixedReturn ?? false) : settings.enableReturnShipping);
    const returnFeeAmount = applyReturnFee ? (useCustom ? (compFees?.returnShippingFee ?? 0) : settings.returnShippingFee) : 0;
    
    const inspectionFeeCollectedFromCustomer = (order.inspectionFeePaidByCustomer && !isPos) ? effectiveInspectionCost : 0;
    const codFee = isPos ? 0 : calculateCodFee(order, settings);
    
    loss = (insuranceFee + standardShippingFee + effectiveInspectionCost + returnFeeAmount + codFee + bostaVat - inspectionFeeCollectedFromCustomer);

    breakdown.revenue = inspectionFeeCollectedFromCustomer;
    breakdown.shippingPaid = standardShippingFee;
    breakdown.insurance = insuranceFee;
    breakdown.inspection = effectiveInspectionCost;
    breakdown.vat = bostaVat;
    breakdown.cod = codFee;
    breakdown.returnFee = returnFeeAmount;
    breakdown.totalExpenses = (insuranceFee + standardShippingFee + effectiveInspectionCost + returnFeeAmount + codFee + bostaVat);
  }
  
  const finalProfit = Math.round(profit * 100) / 100;
  const finalLoss = Math.round(loss * 100) / 100;
  const finalNet = Math.round((finalProfit - finalLoss) * 100) / 100;
  
  return { 
    profit: finalProfit, 
    loss: finalLoss, 
    net: finalNet,
    breakdown
  };
}

export const calculateOrderShippingAndFees = (o: Order, settings: Settings): number => {
  if (!settings) return 0;
  const isPos = o.channel === 'pos' || 
                o.shippingCompany === 'كاشير - بيع مباشر' || 
                o.shippingArea === 'نقطة البيع' ||
                (o.id && o.id.startsWith('POS-'));
  if (isPos) return 0;

  const compFees = settings.companySpecificFees?.[(o.shippingCompany || '').trim()];
  const useCustom = compFees?.useCustomFees ?? false;
  
  const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
  const inspectionCost = useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0);
  
  const insuranceFee = o.insuranceFee ?? calculateInsuranceFee(o, insuranceRate, settings);
  const effectiveInspectionCost = o.inspectionFee ?? (o.includeInspectionFee ? inspectionCost : 0);
  const bostaVat = calculateBostaVat(o, insuranceFee, settings);
  const baseShippingFee = getStandardShippingFee(o, settings);

  let totalFees = baseShippingFee + insuranceFee + bostaVat;

  const inspectionAdjustment = (o.includeInspectionFee && !o.inspectionFeePaidByCustomer) ? effectiveInspectionCost : 0;
  totalFees += inspectionAdjustment;

  if (o.status === 'تم_التحصيل' || o.status === 'مدفوعة' || o.status === 'تم_توصيلها') {
    const codFee = isPos ? 0 : calculateCodFee(o, settings);
    totalFees += codFee;
  } else if (o.status === 'مرتجع' || o.status === 'فشل_التوصيل' || o.status === 'تمت_الاعادة_لشركة_الشحن') {
    const applyReturnFee = useCustom ? (compFees?.enableFixedReturn ?? false) : settings.enableReturnShipping;
    const returnFeeAmount = applyReturnFee ? (useCustom ? (compFees?.returnShippingFee ?? 0) : settings.returnShippingFee) : 0;
    
    const isFlexShipEnabled = o.enableFlexShip !== undefined ? o.enableFlexShip : (useCustom ? (compFees?.enableFlexShip ?? false) : (settings.enableFlexShip ?? false));
    const flexShipCompanyDeduction = (isFlexShipEnabled && o.flexShipFeePaidByCustomer) ? (o.flexShipCompanyFee ?? (useCustom ? (compFees?.flexShipCompanyFee ?? 0) : (settings.flexShipCompanyFee ?? 0))) : 0;
    const flexShipCollected = (isFlexShipEnabled && o.flexShipFeePaidByCustomer) ? (o.flexShipFee ?? (useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0))) : 0;

    totalFees = baseShippingFee + insuranceFee + effectiveInspectionCost + returnFeeAmount + bostaVat + flexShipCompanyDeduction - flexShipCollected;
  } else if (o.status === 'مرتجع_جزئي') {
    totalFees = insuranceFee + effectiveInspectionCost + bostaVat;
  } else if (o.status === 'مرتجع_بعد_الاستلام') {
    const applyReturnFee = useCustom ? (compFees?.enableFixedReturn ?? false) : settings.enableReturnShipping;
    const returnFeeAmount = applyReturnFee ? (useCustom ? (compFees?.returnShippingFee ?? 0) : settings.returnShippingFee) : 0;
    
    totalFees = baseShippingFee + insuranceFee + effectiveInspectionCost + returnFeeAmount + bostaVat;
  } else {
    // For pending statuses, we can assume standard delivery fees
    const codFee = calculateCodFee(o, settings);
    totalFees += codFee;
  }
  
  return Math.max(0, Math.round(totalFees * 100) / 100);
};

