import { Order, Settings, Wallet, Treasury, SupplyOrder } from '../types';
import { EGYPT_GOVERNORATES } from '../constants';

export const isBosta = (companyName: string): boolean => {
    if (!companyName) return false;
    const norm = companyName.trim().toLowerCase();
    return norm.includes('bosta') || norm.includes('بوسطة') || norm.includes('بوسطه');
};

export const getCompanySpecificFees = (settings?: Settings, companyName?: string) => {
    if (!settings?.companySpecificFees || !companyName) return undefined;
    if (settings.companySpecificFees[companyName]) {
        return settings.companySpecificFees[companyName];
    }
    const norm = (str: string) => str.trim().toLowerCase().replace(/ة/g, 'ه');
    const targetNorm = norm(companyName);
    const matchedKey = Object.keys(settings.companySpecificFees).find(k => norm(k) === targetNorm);
    if (matchedKey) {
        return settings.companySpecificFees[matchedKey];
    }
    return undefined;
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
            const isExternalItem = (item as any).isExternal || item.productId?.startsWith('external-') || item.productId?.startsWith('custom-');
            let cost = 0;
            if (item.cost !== undefined && item.cost !== null && (item.cost > 0 || isExternalItem)) {
                cost = item.cost;
            } else if (settings) {
                cost = getLatestProductCost(item.productId, settings) || item.cost || 0;
            } else {
                cost = item.cost || 0;
            }
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
    
    const compFees = getCompanySpecificFees(settings, company);
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
    
    const compFees = getCompanySpecificFees(settings, order.shippingCompany);
    const useCustom = compFees?.useCustomFees ?? false;
    
    // Check if a custom insurance package is selected
    const selectedPkg = order.insurancePackageId && settings?.insurancePackages?.find(p => p.id === order.insurancePackageId);
    
    let result = 0;
    
    if (selectedPkg) {
        if (selectedPkg.type === 'flat') {
            result = selectedPkg.value;
        } else {
            const pkgRate = selectedPkg.value;
            if (order.insuranceBaseValue && order.insuranceBaseValue > 0) {
                result = (order.insuranceBaseValue * pkgRate) / 100;
            } else {
                const isCompanyBosta = isBosta(order.shippingCompany);
                const defaultBasis = isCompanyBosta ? 'cost' : (settings?.insuranceBasis || 'total');
                const basis = useCustom ? (compFees?.insuranceBasis ?? defaultBasis) : (settings?.insuranceBasis ?? defaultBasis);
                
                if (basis === 'cost') {
                    const productCost = getOrderProductCost(order, settings);
                    result = (productCost * pkgRate) / 100;
                } else if (basis === 'price') {
                    result = (order.productPrice * pkgRate) / 100;
                } else if (basis === 'base') {
                    const basePrice = getOrderBasePrice(order, settings);
                    result = (basePrice * pkgRate) / 100;
                } else {
                    // total basis: (Price + Shipping - Discount)
                    const shippingFeeForInsurance = settings ? getStandardShippingFee(order, settings) : (order.shippingFee || 0);
                    const discountAmount = (order.discountAffectsInsurance ?? true) ? (Number(order.discount) || 0) : 0;
                    const totalAmount = (Number(order.productPrice) || 0) + (Number(shippingFeeForInsurance) || 0) - discountAmount;
                    result = (Math.max(0, totalAmount) * pkgRate) / 100;
                }
            }
        }
        
        // Apply package min/max boundaries, with fallback to company specific/global settings if not specified on the package
        const minAmount = selectedPkg.minAmount !== undefined && selectedPkg.minAmount !== null 
            ? selectedPkg.minAmount 
            : (useCustom ? compFees?.insuranceMinAmount : settings?.insuranceMinAmount);
        const maxAmount = selectedPkg.maxAmount !== undefined && selectedPkg.maxAmount !== null 
            ? selectedPkg.maxAmount 
            : (useCustom ? compFees?.insuranceMaxAmount : settings?.insuranceMaxAmount);
            
        if (typeof minAmount === 'number' && minAmount > 0) {
            if (result < minAmount) {
                result = minAmount;
            }
        }
        if (typeof maxAmount === 'number' && maxAmount > 0) {
            if (result > maxAmount) {
                result = maxAmount;
            }
        }
    } else {
        // Standard insurance rate calculation
        if (order.insuranceBaseValue && order.insuranceBaseValue > 0) {
            result = (order.insuranceBaseValue * insuranceRate) / 100;
        } else {
            const isCompanyBosta = isBosta(order.shippingCompany);
            const defaultBasis = isCompanyBosta ? 'cost' : (settings?.insuranceBasis || 'total');
            const basis = useCustom ? (compFees?.insuranceBasis ?? defaultBasis) : (settings?.insuranceBasis ?? defaultBasis);
            
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
                const shippingFeeForInsurance = settings ? getStandardShippingFee(order, settings) : (order.shippingFee || 0);
                const discountAmount = (order.discountAffectsInsurance ?? true) ? (Number(order.discount) || 0) : 0;
                const totalAmount = (Number(order.productPrice) || 0) + (Number(shippingFeeForInsurance) || 0) - discountAmount;
                result = (Math.max(0, totalAmount) * insuranceRate) / 100;
            }
        }
        
        // Apply min/max boundaries if configured
        const minAmount = useCustom ? compFees?.insuranceMinAmount : settings?.insuranceMinAmount;
        const maxAmount = useCustom ? compFees?.insuranceMaxAmount : settings?.insuranceMaxAmount;
        
        if (typeof minAmount === 'number' && minAmount > 0) {
            if (result < minAmount) {
                result = minAmount;
            }
        }
        if (typeof maxAmount === 'number' && maxAmount > 0) {
            if (result > maxAmount) {
                result = maxAmount;
            }
        }
    }
    
    return Math.round(result * 100) / 100;
};

export const calculateBostaVat = (order: Order, insuranceFee: number, settings?: Settings): number => {
    if (order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر') return 0;
    const compFees = getCompanySpecificFees(settings, order.shippingCompany);
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
    const manualShippingFee = (order.isManualShippingOverride && order.shippingFee !== undefined) ? order.shippingFee : null;
    const baseShippingFee = manualShippingFee !== null ? manualShippingFee : (
        (useStandard || !hasManualFee)
            ? (settings ? getStandardShippingFee(order, settings) : (order.shippingFee || 0))
            : (order.shippingFee || 0)
    );
        
    const defaultVatBasis = isCompanyBosta ? 'shipping_and_insurance' : 'shipping_only';
    const vatBasis = useCustom ? (compFees?.vatBasis || defaultVatBasis) : (settings?.vatBasis || defaultVatBasis);
    const insuranceValue = (vatBasis === 'shipping_and_insurance' || vatBasis === 'shipping_insurance_and_cod') ? insuranceFee : 0;
    const codValue = (vatBasis === 'shipping_insurance_and_cod' && settings) ? calculateCodFee(order, settings) : 0;
    
    const isMaintenance = order.orderType === 'maintenance';
    const serviceBase = isMaintenance ? (Number((order as any).maintenanceCost) || 0) : 0;
    
    // Auto-calculate inspection fee internally
    const inspectionFeeParams = !isMaintenance && (order.includeInspectionFee ?? true) 
         ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings?.enableInspection ? (settings?.inspectionFee || 0) : 0)) 
         : 0;
    
    const result = (baseShippingFee + insuranceValue + codValue + inspectionFeeParams + serviceBase) * vatRate;
    return Math.round(result * 100) / 100;
};

export const calculateCodFee = (order: Order, settings: Settings): number => {
    if (!settings || order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر') return 0;
    const compFees = getCompanySpecificFees(settings, order.shippingCompany);
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
  closingDifference: number;
} => {
  let profit = 0;
  let loss = 0;
  let carrierFees = 0;
  let productCostCalculated = order.status === 'تم_الاستبدال' ? 0 : (getOrderProductCost(order, settings) || 0);
  let netRevenue = 0;
  let closingDifference = 0;

  const isCancelledWithLoss = order.status === 'ملغي';
  
  if (!settings || (order.status === 'ملغي' && !isCancelledWithLoss) || ['جاري_المراجعة', 'قيد_التنفيذ', 'في_انتظار_المكالمة'].includes(order.status)) {
    return { profit: 0, loss: 0, net: 0, carrierFees: 0, productCost: productCostCalculated, netRevenue: 0, closingDifference: 0 };
  }

  const isExchange = order.status === 'تم_الاستبدال';
  const isPos = order.channel === 'pos' || 
                order.shippingCompany === 'كاشير - بيع مباشر' || 
                order.shippingArea === 'نقطة البيع' ||
                (order.id && order.id.startsWith('POS-'));

  const compFees = getCompanySpecificFees(settings, order.shippingCompany);
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
                                      order.status === 'تم_الارسال' ||
                                      order.status === 'تم_الاستبدال';

  if (isFinanciallySettledSuccess || order.paymentStatus === 'مدفوع') {
    const isPos = order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر' || order.shippingArea === 'نقطة البيع' || (order.id && order.id.startsWith('POS-'));
    const compFees = getCompanySpecificFees(settings, order.shippingCompany);
    const useCustom = compFees?.useCustomFees ?? false;
    const effectiveInspectionCost = isPos ? 0 : (useCustom ? (compFees?.inspectionFee ?? 0) : (settings?.enableInspection ? (settings.inspectionFee ?? 0) : 0));

    const inspectionExpense = (!isPos && (order.includeInspectionFee !== false)) ? effectiveInspectionCost : 0;
    const inspectionRevenue = (!isPos && (order.includeInspectionFee !== false) && (order.inspectionFeePaidByCustomer !== false)) ? effectiveInspectionCost : 0;

    const codFee = (order.status === 'مدفوعة' || isPos || isExchange) ? 0 : calculateCodFee(order, settings);

    const safeProductPrice = order.status === 'تم_الاستبدال' ? 0 : (Number(order.productPrice) || 0);
    const defaultFlexShipFee = useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0);
    const flexShipFeeValue = order.flexShipFee ?? defaultFlexShipFee;
    const safeShippingFee = order.status === 'تم_الاستبدال' ? 
        (order.enableFlexShip ? flexShipFeeValue : (order.customerPaidOriginalShipping === false ? 0 : (Number(order.shippingFee) || 0))) 
        : (Number(order.shippingFee) || 0);
    const safeTax = Number(order.tax) || 0;
    const safeDiscount = order.status === 'تم_الاستبدال' ? 0 : (Number(order.discount) || 0);
    const safeAdvance = Number(order.advancePayment) || 0;
    const safeAdminFee = Number(order.adminFee) || 0;
    const safeCredit = Number((order as any).creditAmount) || 0;
    const safeReturnCash = order.returnCashToCustomer && (order as any).cashToReturnAmount ? Number((order as any).cashToReturnAmount) : 0;

    const flexShipRevenue = (!isExchange && order.enableFlexShip && order.flexShipFeePaidByCustomer) ? (order.flexShipFee ?? (useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0))) : 0;
    const flexShipCompanyDeduction = (!isExchange && order.enableFlexShip && order.flexShipFeePaidByCustomer) ? (order.flexShipCompanyFee ?? (useCustom ? (compFees?.flexShipCompanyFee ?? 0) : (settings.flexShipCompanyFee ?? 0))) : 0;

    const baseExpectedRevenue = safeProductPrice + safeShippingFee + safeTax - safeDiscount + inspectionRevenue + flexShipRevenue + safeAdminFee;

    let totalRevenueForProfit = baseExpectedRevenue;
    let netRevenueCollected = baseExpectedRevenue;

    if (order.status === 'تم_الاستبدال') {
        netRevenueCollected = baseExpectedRevenue;
    } else if (order.netRevenue != null && !isNaN(Number(order.netRevenue))) {
        netRevenueCollected = Number(order.netRevenue);
    } else if (order.source === 'synced' && order.totalPrice != null) {
        netRevenueCollected = Number(order.totalPrice) + inspectionRevenue + flexShipRevenue;
    } else if (order.totalAmountOverride !== undefined && order.totalAmountOverride !== null && String(order.totalAmountOverride).trim() !== '') {
        // totalAmountOverride is the COD amount. Gross Revenue = COD + Advance.
        netRevenueCollected = Number(order.totalAmountOverride) + safeAdvance;
    }
        
    const manualShippingFee = (order.isManualShippingOverride && order.shippingFee !== undefined) ? order.shippingFee : null;
    const standardShippingFee = manualShippingFee !== null ? manualShippingFee : getStandardShippingFee(order, settings);
    carrierFees = (isPos ? 0 : standardShippingFee) + insuranceFee + inspectionExpense + codFee + bostaVat + flexShipCompanyDeduction;
    
    netRevenue = netRevenueCollected;
    const baseExpectedRevenueWithFees = baseExpectedRevenue - safeCredit - safeReturnCash;
    closingDifference = netRevenueCollected - baseExpectedRevenueWithFees;

    // Calculate profit based on base expected revenue (without manual differences)
    const extraMarkup = Number((order as any).externalProfitMarkup) || Number((order as any).dropshipCommission) || 0;
    profit = totalRevenueForProfit - carrierFees - productCostCalculated + extraMarkup;

    // If there is manual settlement/closure and closing difference is negative, deduct it from profit
    const isManualSettlement = order.totalAmountOverride !== undefined && 
                              order.totalAmountOverride !== null && 
                              String(order.totalAmountOverride).trim() !== '';
    if (isManualSettlement && closingDifference < 0) {
        profit += closingDifference; // Since closingDifference is negative, adding it deducts it
    }
  } else {
    const isReturn = ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'ملغي'].includes(order.status);
    
    if (isReturn) {
      const applyReturnFee = isPos ? false : (useCustom ? (compFees?.enableFixedReturn ?? false) : settings.enableReturnShipping);
      const returnFeeAmount = (order.status === 'مرتجع' || order.status === 'فشل_التوصيل' || order.status === 'تمت_الاعادة_لشركة_الشحن' || order.status === 'مرتجع_بعد_الاستلام' || order.status === 'ملغي') ? (applyReturnFee ? (useCustom ? (compFees?.returnShippingFee ?? 0) : settings.returnShippingFee) : 0) : 0;
      
      const manualShippingFee = (order.isManualShippingOverride && order.shippingFee !== undefined) ? order.shippingFee : null;
      const standardShippingFee = manualShippingFee !== null ? manualShippingFee : getStandardShippingFee(order, settings);
      
      const isFlexShipEnabled = isPos ? false : (order.enableFlexShip !== undefined ? order.enableFlexShip : (useCustom ? (compFees?.enableFlexShip ?? false) : (settings.enableFlexShip ?? false)));
      const flexShipCompanyDeduction = (isFlexShipEnabled && order.flexShipFeePaidByCustomer) ? (order.flexShipCompanyFee ?? (useCustom ? (compFees?.flexShipCompanyFee ?? 0) : (settings.flexShipCompanyFee ?? 0))) : 0;
      
      // For failed/returned orders, we assume nothing was collected from the customer 
      // UNLESS the flex ship transaction was actually added/processed.
      const inspectionFeeCollected = 0;
      const flexShipCollected = (isFlexShipEnabled && (order.flexShipFeePaidByCustomer || order.flexShipTransactionAdded)) ? (order.flexShipFee ?? (useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0))) : 0;
      
      const codFee = (order.status === 'مرتجع_بعد_الاستلام' && !isPos) ? calculateCodFee(order, settings) : 0;
      
      // Basic carrier fee components
      carrierFees = (insuranceFee + (isPos ? 0 : standardShippingFee) + effectiveInspectionCost + returnFeeAmount + codFee + bostaVat + flexShipCompanyDeduction);
      
      // Net loss is carrier fees reduced by FlexShip fees collected
      let calculatedLoss = Math.max(0, carrierFees - flexShipCollected);
      
      const compStatus = (order as any).compensationStatus;
      const compAmount = Number((order as any).compensationAmount) || 0;
      
      if (compStatus === 'compensated' && compAmount > 0) {
          calculatedLoss -= compAmount;
          if (calculatedLoss < 0) {
              profit = Math.abs(calculatedLoss);
              calculatedLoss = 0;
          }
      }
      
      loss = calculatedLoss;
    }
  }
  
  return { 
    profit: Math.round(profit * 100) / 100, 
    loss: Math.round(loss * 100) / 100, 
    net: Math.round((profit - loss) * 100) / 100,
    carrierFees: Math.round(carrierFees * 100) / 100,
    productCost: Math.round(productCostCalculated * 100) / 100,
    netRevenue: Math.round(netRevenue * 100) / 100,
    closingDifference: Math.round(closingDifference * 100) / 100
  };
}

export const calculateOrderShippingAndFees = (o: Order, settings: Settings): number => {
  if (!settings) return o.shippingFee || 0;
  const isPos = o.channel === 'pos' || 
                o.shippingCompany === 'كاشير - بيع مباشر' || 
                o.shippingArea === 'نقطة البيع' ||
                (o.id && o.id.startsWith('POS-'));
  if (isPos) return 0;

  const compFees = getCompanySpecificFees(settings, o.shippingCompany);
  const useCustom = compFees?.useCustomFees ?? false;
  
  const isExchange = o.status === 'تم_الاستبدال';
  const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
  const inspectionCost = useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0);
  
  const isInsured = o.isInsured ?? true;
  const insuranceFee = o.insuranceFee ?? (isInsured ? calculateInsuranceFee(o, insuranceRate, settings) : 0);
  const effectiveInspectionCost = o.inspectionFee ?? (o.includeInspectionFee === false ? 0 : inspectionCost);
  const bostaVat = calculateBostaVat(o, insuranceFee, settings);
  
  const manualShippingFee = (o.isManualShippingOverride && o.shippingFee !== undefined) ? o.shippingFee : null;
  const baseShippingFee = manualShippingFee !== null ? manualShippingFee : getStandardShippingFee(o, settings);

  const inspectionExpense = (!isPos && (o.includeInspectionFee !== false)) ? effectiveInspectionCost : 0;
  // Inspection is only revenue if the customer is the one paying for it
  const inspectionRevenue = (!isPos && (o.includeInspectionFee !== false) && (o.inspectionFeePaidByCustomer !== false)) ? effectiveInspectionCost : 0;
  
  let totalFees = baseShippingFee + insuranceFee + bostaVat + inspectionExpense;

  if (o.status === 'تم_الاستبدال' || o.status === 'تم_التحصيل' || o.status === 'مدفوعة' || o.status === 'تم_توصيلها' || o.status === 'تم_التوصيل') {
    const codFee = (o.status === 'مدفوعة' || isPos) ? 0 : calculateCodFee(o, settings);
    const isFlexShipEnabled = o.enableFlexShip !== undefined ? o.enableFlexShip : (useCustom ? (compFees?.enableFlexShip ?? false) : (settings.enableFlexShip ?? false));
    const flexShipCompanyDeduction = (isFlexShipEnabled && o.flexShipFeePaidByCustomer) ? (o.flexShipCompanyFee ?? (useCustom ? (compFees?.flexShipCompanyFee ?? 0) : (settings.flexShipCompanyFee ?? 0))) : 0;
    const flexShipCollected = (isFlexShipEnabled && o.flexShipFeePaidByCustomer) ? (o.flexShipFee ?? (useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0))) : 0;
    
    totalFees += codFee + flexShipCompanyDeduction - flexShipCollected;
  } else if (['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'ملغي'].includes(o.status)) {
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
  
  return Math.max(0, Math.round(totalFees * 100) / 100);
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


export const calculateWalletLiveBalance = (wallet?: Wallet, treasury?: Treasury): number => {
    return (wallet?.transactions || []).reduce((sum, t) => {
        const amount = Number(t.amount) || 0;
        
        // Exclude transactions that come from the Supply Wallet (they were already deducted from main during funding or never entered main)
        if (t.category === 'supply_purchase' || t.category === 'supply_deposit' || t.category?.startsWith('supply_expense_')) return sum;

        // Exclude partner personal expenses from the global wallet balance unless explicitly via central wallet
        if ((t.details?.paidByPartnerId || t.details?.expensePaidBy || t.note?.includes('دفعهم') || t.note?.includes('شريك')) && !t.note?.includes('المحفظة المركزية')) return sum;

        // Deposits: only include when completed
        if (t.type === 'إيداع') {
             return t.status === 'completed' ? sum + amount : sum;
        }
        
        // Withdrawals: include both completed AND pending (reserve them)
        if (t.type === 'سحب') {
             if (t.details?.treasuryAccountId && t.details.treasuryAccountId !== 'main_wallet') return sum;
             return t.status === 'cancelled' ? sum : sum - amount;
        }
        
        // Handle 'تحويل' (Treasury Transfers) which might be legacy or current
        if (t.type === 'تحويل') {
            if (t.category === 'treasury_sync') {
                const treasuryTxId = t.id.replace('TR-', '');
                const tTx = treasury?.transactions?.find(x => x.id === treasuryTxId);
                if (tTx) {
                    if (tTx.toAccountId === 'main_wallet') {
                        return sum + amount;
                    } else if (tTx.fromAccountId === 'main_wallet') {
                        return sum - amount;
                    }
                } else if (t.note?.includes('إنستاباي') || t.note?.includes('بنك') || t.note?.includes('إيداع') || t.note?.includes('تحويل')) {
                    return sum + amount;
                }
            }
            return sum;
        }
        
        return sum;
    }, 0);
};

export const generateSupplyOrderInvoiceHTML = (order: SupplyOrder, settings: Settings, autoPaidOrdersMap?: Map<string, boolean>): string => {
  const supplierList = Array.isArray(settings?.suppliers) ? settings.suppliers : Object.values(settings?.suppliers || {});
  const supplier: any = supplierList.find((s: any) => String(s.id) === String(order.supplierId));
  
  const warehouseList = Array.isArray(settings?.warehouses) ? settings.warehouses : Object.values(settings?.warehouses || {});
  const warehouse: any = warehouseList.find((w: any) => String(w.id) === String(order.warehouseId));
  
  const partnerList = Array.isArray(settings?.partners) ? settings.partners : Object.values(settings?.partners || {});
  const treasuryList = Array.isArray((settings as any)?.treasuryAccounts) ? (settings as any).treasuryAccounts : Object.values((settings as any)?.treasuryAccounts || {});
  const cashHolderList = Array.isArray(settings?.cashHolders) ? settings.cashHolders : Object.values(settings?.cashHolders || {});
  const productList = Array.isArray(settings?.products) ? settings.products : Object.values(settings?.products || {});

  const dateStr = new Date(order.date).toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Calculate payment protocol details
  let paymentText = 'نقدي (كاش)';
  const isPaid = order.isPaid || (autoPaidOrdersMap && autoPaidOrdersMap.get(order.id));
  
  if (order.paymentMethod === 'credit') {
    paymentText = `آجل مديونية (${isPaid ? 'مسددة بالكامل' : 'غير مسددة / قائمة'})`;
  } else if (order.paymentMethod === 'partner') {
    const parts = order.partnerPayments?.map((p: any) => {
      const pt: any = partnerList.find((x: any) => String(x.id) === String(p.partnerId));
      return `${pt?.name || 'شريك'}: ${Number(p.amount || 0).toLocaleString()} ج.م`;
    }).join(' + ');
    paymentText = `تمويل شركاء ${parts ? `[${parts}]` : ''}`;
  } else if (order.paymentMethod === 'treasury') {
    const tr: any = treasuryList.find((t: any) => String(t.id) === String(order.treasuryAccountId));
    paymentText = `تمويل الخزينة / البنك ${tr ? `[${tr.name}]` : ''}`;
  } else if (order.paymentMethod === 'custody') {
    const custs = order.custodyPayments?.map((c: any) => {
      const h: any = cashHolderList.find((x: any) => String(x.id) === String(c.cashHolderId));
      return `${h?.name || 'عهدة'}: ${Number(c.amount || 0).toLocaleString()} ج.م`;
    }).join(' + ');
    paymentText = `سداد عهدة شخصية ${custs ? `[${custs}]` : ''}`;
  } else if (order.paymentMethod === 'supply_wallet') {
    paymentText = 'خصم من محفظة التوريد الخاصة بالمورد';
  }

  // Items table generation
  let grossPurchases = 0;
  let purchaseDiscounts = 0;
  let totalReturnsDeducted = 0;

  const itemRowsHTML = (order.items || []).map((item: any, idx: number) => {
    const prod: any = productList.find((p: any) => String(p.id) === String(item.productId));
    const sku = item.sku || prod?.sku || '';
    const qty = (item.receivedQuantity !== undefined && item.receivedQuantity !== null)
      ? Number(item.receivedQuantity)
      : (Number(item.quantity) || 0);
    const bonus = Number(item.bonusQuantity) || 0;
    const totalQty = qty + bonus;
    const unitCost = Number(item.cost) || 0;

    const discountVal = Number(item.discountValue) || 0;
    const discountAmt = discountVal ? (item.discountType === 'percentage' ? (unitCost * discountVal / 100) : discountVal) : 0;
    const netUnitCost = Math.max(0, unitCost - discountAmt);

    const isInvoiceReturn = Boolean(item.isReturn);
    const returnedQty = isInvoiceReturn ? totalQty : (Number(item.returnedQuantity) || 0);

    let lineNet = 0;
    if (isInvoiceReturn) {
      lineNet = -(totalQty * netUnitCost);
      totalReturnsDeducted += totalQty * netUnitCost;
    } else {
      grossPurchases += totalQty * unitCost;
      purchaseDiscounts += discountAmt * totalQty;
      totalReturnsDeducted += returnedQty * netUnitCost;
      const billableQty = Math.max(0, totalQty - returnedQty);
      lineNet = billableQty * netUnitCost;
    }

    return `
      <tr style="${isInvoiceReturn ? 'background-color: #fff1f2;' : (idx % 2 === 1 ? 'background-color: #f8fafc;' : '')}">
        <td style="text-align: center; font-weight: bold; color: #64748b;">${idx + 1}</td>
        <td>
          <div style="font-weight: 800; color: #0f172a; font-size: 13px;">${item.name || prod?.name || 'منتج'}</div>
          ${sku ? `<div style="font-size: 10px; color: #64748b; font-family: monospace;">كود الصنف: ${sku}</div>` : ''}
          ${isInvoiceReturn ? `<span style="display:inline-block; padding: 2px 6px; background:#fecdd3; color:#9f1239; font-size:10px; font-weight:bold; border-radius:4px; margin-top:3px;">صنف مرتجع بالكامل</span>` : ''}
          ${!isInvoiceReturn && returnedQty > 0 ? `<span style="display:inline-block; padding: 2px 6px; background:#fef3c7; color:#92400e; font-size:10px; font-weight:bold; border-radius:4px; margin-top:3px;">مرتجع جزئي: ${returnedQty} قطعة</span>` : ''}
        </td>
        <td style="text-align: center; font-weight: bold; color: #1e293b;">${qty} قطعة</td>
        <td style="text-align: center;">${bonus > 0 ? `<strong style="color:#059669;">+${bonus}</strong>` : '<span style="color:#cbd5e1;">0</span>'}</td>
        <td style="text-align: center; font-family: monospace; font-weight: 700;">${unitCost.toLocaleString()} ج.م</td>
        <td style="text-align: center;">
          ${discountVal > 0 ? `
            <span style="color: #059669; font-weight: bold;">${discountVal}${item.discountType === 'percentage' ? '%' : ' ج.م'}</span>
            <div style="font-size: 10px; color: #94a3b8; font-family: monospace;">(-${(discountAmt * totalQty).toLocaleString()} ج.م)</div>
          ` : '<span style="color:#cbd5e1;">-</span>'}
        </td>
        <td style="text-align: center;">
          ${returnedQty > 0 || isInvoiceReturn ? `
            <span style="color: #e11d48; font-weight: bold;">${returnedQty} قطعة</span>
            <div style="font-size: 10px; color: #e11d48; font-family: monospace;">(-${(returnedQty * netUnitCost).toLocaleString()} ج.م)</div>
          ` : '<span style="color:#cbd5e1;">-</span>'}
        </td>
        <td style="text-align: left; font-family: monospace; font-weight: 900; ${lineNet < 0 ? 'color: #e11d48;' : 'color: #4338ca;'}">
          ${lineNet.toLocaleString()} ج.م
        </td>
      </tr>
    `;
  }).join('');

  const shipping = Number(order.shippingFees || 0);
  const shippingNote = order.shippingFeesNote;
  const shippingPayment = order.shippingFeesPaymentMethod === 'wallet' ? 'يدفع من المحفظة (غير محمل على دين الفاتورة)' : 'مضاف على قيمة الفاتورة';
  const otherFees = Number(order.otherFees || 0);
  const otherFeesNote = order.otherFeesNote;
  const tax = Number(order.taxAmount || 0);

  const netItemsSubtotal = grossPurchases - purchaseDiscounts - totalReturnsDeducted;
  const calculatedSubtotal = Math.max(0, netItemsSubtotal + shipping + otherFees + tax);
  const finalGrandTotal = order.grandTotal || order.totalCost || calculatedSubtotal;

  const unallocatedExpenses = Math.max(0, finalGrandTotal - calculatedSubtotal);
  const unallocatedDiscount = Math.max(0, calculatedSubtotal - finalGrandTotal);

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>فاتورة شراء توريد - #${order.referenceNumber || order.orderNumber || order.id}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        body { font-family: 'Cairo', system-ui, -apple-system, sans-serif; padding: 30px; color: #0f172a; line-height: 1.6; background-color: #f8fafc; }
        .invoice-card { max-width: 920px; margin: 0 auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 20px; padding: 35px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 25px; }
        .header-info h1 { font-size: 24px; font-weight: 900; margin: 0; color: #0f172a; letter-spacing: -0.5px; }
        .header-info p { margin: 4px 0 0; font-size: 13px; color: #64748b; font-weight: 700; }
        .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px; }
        .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }
        .meta-label { font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
        .meta-val { font-size: 13px; font-weight: 800; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 25px; }
        th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 8px; text-align: right; font-size: 11px; font-weight: 900; color: #334155; }
        td { border: 1px solid #e2e8f0; padding: 10px 8px; font-size: 12px; }
        .footer-stats { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 14px; padding: 22px; margin-top: 20px; }
        .stat-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 13px; }
        .stat-label { font-weight: 700; color: #475569; }
        .stat-val { font-weight: 900; color: #0f172a; font-family: monospace; font-size: 14px; }
        .grand-total { border-top: 2px solid #0f172a; margin-top: 12px; padding-top: 14px; }
        .grand-total .stat-label { font-size: 16px; color: #0f172a; font-weight: 900; }
        .grand-total .stat-val { color: #4338ca; font-size: 22px; font-weight: 900; }
        .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 14px; margin-top: 20px; font-size: 12px; color: #92400e; }
        .signatures { margin-top: 50px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; font-size: 12px; text-align: center; }
        .sig-line { border-top: 1px dashed #94a3b8; width: 80%; margin: 45px auto 0; }
        @media print {
          body { padding: 0; background: #ffffff; }
          .invoice-card { border: none; box-shadow: none; padding: 0; max-width: 100%; }
        }
      </style>
    </head>
    <body>
      <div class="invoice-card">
        <div class="header">
          <div class="header-info">
            <h1>فاتورة شراء بضائع / إذن استلام مخزني</h1>
            <p>نظام إدارة المخازن والتوريد والمالية الذكي</p>
          </div>
          <div style="text-align: left;">
            <div style="font-weight: 900; font-size: 20px; color: #4338ca;"># ${order.referenceNumber || order.orderNumber || order.id}</div>
            <div style="font-size: 11px; color: #64748b; font-weight: 700; margin-top: 4px;">تاريخ التوريد: ${dateStr}</div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-box">
            <div class="meta-label">بيانات المورد والشريك المالي:</div>
            <div class="meta-val">${supplier?.name || 'مورد عام'}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 3px;">الهاتف: ${supplier?.phone || '-'}</div>
            ${supplier?.address ? `<div style="font-size: 11px; color: #64748b;">العنوان: ${supplier.address}</div>` : ''}
          </div>
          <div class="meta-box">
            <div class="meta-label">المخزن المستلم والحالة:</div>
            <div class="meta-val">${warehouse?.name || 'المخزن الرئيسي'}</div>
            <div style="font-size: 11px; color: #059669; font-weight: 800; margin-top: 3px;">الحالة: مُعتمدة ومُرحلة للمخازن</div>
          </div>
          <div class="meta-box">
            <div class="meta-label">بروتوكول السداد ومصدر التمويل:</div>
            <div class="meta-val" style="font-size: 12px;">${paymentText}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">م</th>
              <th>اسم الصنف / المنتج</th>
              <th style="text-align: center;">الكمية المستلمة</th>
              <th style="text-align: center;">بونص</th>
              <th style="text-align: center;">سعر التكلفة</th>
              <th style="text-align: center;">الخصم</th>
              <th style="text-align: center;">المرتجع</th>
              <th style="text-align: left;">الإجمالي الصافي</th>
            </tr>
          </thead>
          <tbody>
            ${itemRowsHTML}
          </tbody>
        </table>

        <div class="footer-stats">
          <div class="stat-row">
            <span class="stat-label">إجمالي قيمة المشتريات (قبل الخصم والمرتجع):</span>
            <span class="stat-val">${grossPurchases.toLocaleString()} ج.م</span>
          </div>

          ${purchaseDiscounts > 0 ? `
            <div class="stat-row" style="color: #059669;">
              <span class="stat-label" style="color: #059669;">إجمالي الخصومات المطبقة على الأصناف:</span>
              <span class="stat-val">- ${purchaseDiscounts.toLocaleString()} ج.م</span>
            </div>
          ` : ''}

          ${totalReturnsDeducted > 0 ? `
            <div class="stat-row" style="color: #e11d48;">
              <span class="stat-label" style="color: #e11d48;">إجمالي قيمة المرتجعات المخصومة من الفاتورة:</span>
              <span class="stat-val">- ${totalReturnsDeducted.toLocaleString()} ج.م</span>
            </div>
          ` : ''}

          <div class="stat-row" style="border-top: 1px dashed #cbd5e1; padding-top: 8px;">
            <span class="stat-label">صافي قيمة الأصناف والمنتجات:</span>
            <span class="stat-val">${netItemsSubtotal.toLocaleString()} ج.م</span>
          </div>

          ${shipping > 0 ? `
            <div class="stat-row">
              <span class="stat-label">مصاريف الشحن والنقل ${shippingNote ? `(${shippingNote})` : ''} - [${shippingPayment}]:</span>
              <span class="stat-val">+ ${shipping.toLocaleString()} ج.م</span>
            </div>
          ` : ''}

          ${otherFees > 0 ? `
            <div class="stat-row" style="color: #d97706;">
              <span class="stat-label" style="color: #d97706;">مصاريف أخرى / إضافية ${otherFeesNote ? `(${otherFeesNote})` : ''}:</span>
              <span class="stat-val">+ ${otherFees.toLocaleString()} ج.م</span>
            </div>
          ` : ''}

          ${unallocatedExpenses > 0 ? `
            <div class="stat-row" style="color: #d97706;">
              <span class="stat-label" style="color: #d97706;">مصاريف إضافية محملة على الفاتورة:</span>
              <span class="stat-val">+ ${unallocatedExpenses.toLocaleString()} ج.م</span>
            </div>
          ` : ''}

          ${unallocatedDiscount > 0 ? `
            <div class="stat-row" style="color: #059669;">
              <span class="stat-label" style="color: #059669;">خصم إضافي شامل على الفاتورة:</span>
              <span class="stat-val">- ${unallocatedDiscount.toLocaleString()} ج.م</span>
            </div>
          ` : ''}

          ${tax > 0 ? `
            <div class="stat-row">
              <span class="stat-label">الضرائب المضافة والرسوم (${order.taxRate || 0}%):</span>
              <span class="stat-val">+ ${tax.toLocaleString()} ج.م</span>
            </div>
          ` : ''}

          <div class="stat-row grand-total">
            <span class="stat-label">الإجمالي الصافي النهائي المستحق للفاتورة:</span>
            <span class="stat-val">${finalGrandTotal.toLocaleString()} ج.م</span>
          </div>
        </div>

        ${order.notes || order.shippingFeesNote || order.otherFeesNote ? `
          <div class="notes-box">
            <strong style="display:block; margin-bottom:4px;">ملاحظات وتفاصيل إضافية:</strong>
            ${order.notes ? `<div>- ${order.notes}</div>` : ''}
            ${order.shippingFeesNote ? `<div>- ملاحظة الشحن والنقل: ${order.shippingFeesNote}</div>` : ''}
            ${order.otherFeesNote ? `<div>- ملاحظة المصاريف الإضافية: ${order.otherFeesNote}</div>` : ''}
          </div>
        ` : ''}

        <div class="signatures">
          <div>
            <div style="font-weight: 800; color: #334155;">توقيع مأمور الاستلام (المخازن)</div>
            <div class="sig-line"></div>
          </div>
          <div>
            <div style="font-weight: 800; color: #334155;">توقيع المحاسب / المراجع</div>
            <div class="sig-line"></div>
          </div>
          <div>
            <div style="font-weight: 800; color: #334155;">اعتماد المدير المالي / المالك</div>
            <div class="sig-line"></div>
          </div>
        </div>

        <div style="margin-top: 40px; text-align: center; color: #94a3b8; font-size: 10px; font-weight: bold; border-top: 1px solid #f1f5f9; padding-top: 15px;">
          تم استخراج هذه الفاتورة الشاملة آلياً بواسطة نظام إدارة المشتريات والمخازن الذكي بتاريخ ${dateStr}
        </div>
      </div>
    </body>
    </html>
  `;
};

export const getVirtualOrderHandovers = (orders: any[] = [], settings?: any, treasury?: any): any[] => {
  if (!Array.isArray(orders) || orders.length === 0) return [];
  
  const existingHandovers = Array.isArray(settings?.cashHandovers) ? settings.cashHandovers : [];
  const virtualHandovers: any[] = [];

  const isBankOrTreasuryAccount = (name: string): boolean => {
    if (!name) return false;
    const norm = name.toLowerCase().trim();
    return norm.includes('بنك') || norm.includes('bank') || norm.includes('cib') || norm.includes('المحفظة') || norm.includes('محفظة') || norm.includes('فودافون كاش') || norm.includes('انستا باي') || norm.includes('حساب بنكي');
  };

  orders.forEach((o: any) => {
    const advance = Number(o.advancePayment) || 0;
    const isPosOrder = o.channel === 'pos' || o.shippingCompany === 'كاشير - بيع مباشر' || (typeof o.shippingCompany === 'string' && o.shippingCompany.includes('كاشير'));
    const isCollectedPos = isPosOrder && ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل'].includes(o.status);

    if (advance > 0 || isCollectedPos) {
      const holderLabel = getAdvancePaymentCustodyName(o, settings, treasury);
      if (!holderLabel || holderLabel === "---" || holderLabel.includes("أودعت في المحفظة العامة")) return;

      let recipientName = "";
      if (holderLabel.includes(': ')) {
        const parts = holderLabel.split(': ')[1].split(' (');
        recipientName = parts[0].trim();
      } else if (holderLabel.includes('المدير')) {
        recipientName = "المدير";
      } else {
        recipientName = holderLabel.replace(/^(🤝 عهدة شريك:|👤 عهدة موظف:|👤 عهدة:|🏦 خزينة \/ بنك:)/g, '').trim();
      }

      if (!recipientName || isBankOrTreasuryAccount(recipientName)) return;

      const orderNumStr = String(o.orderNumber || o.id || '').trim();

      // Check if this advance payment or POS collection is ALREADY in cashHandovers
      const existsInHandovers = existingHandovers.some((h: any) => {
        const notes = String(h.notes || '');
        const matchesNum = orderNumStr && notes.includes(orderNumStr);
        const matchesType = (advance > 0 && (notes.includes('عربون') || notes.includes('دفع مقدم'))) || (isCollectedPos && (notes.includes('كاشير') || notes.includes('POS')));
        return matchesNum && matchesType;
      });

      if (!existsInHandovers) {
        const amountToReport = advance > 0 ? advance : ((Number(o.productPrice) || 0) + (Number(o.shippingFee) || 0) + (Number(o.tax) || 0) - (Number(o.discount) || 0));
        
        let toId = o.advancePaymentPartnerId ? `part_${o.advancePaymentPartnerId}` :
                   o.advancePaymentEmployeeId ? `emp_${o.advancePaymentEmployeeId}` :
                   o.advancePaymentTreasuryId ? `treas_${o.advancePaymentTreasuryId}` :
                   o.cashHolderId || `custody_${recipientName}`;

        virtualHandovers.push({
          id: `virtual-adv-${o.id || orderNumStr}`,
          fromUserId: 'customer',
          fromUserName: o.customerName || 'العميل',
          toUserId: toId,
          toUserName: recipientName,
          amount: amountToReport,
          date: o.date || o.createdAt || new Date().toISOString(),
          notes: advance > 0 ? `عربون / دفع مقدم للطلب #${orderNumStr}` : `مبيعات كاشير - طلب #${orderNumStr}`,
          status: 'completed',
          isVirtual: true,
          orderId: o.id,
          orderNumber: orderNumStr
        });
      }
    }
  });

  return virtualHandovers;
};


