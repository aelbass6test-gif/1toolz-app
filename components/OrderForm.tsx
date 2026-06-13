import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ChevronDown, Package, Coins, User as UserIcon, Building, Truck, CheckCircle, RefreshCcw, ArrowRightLeft, Image as ImageIcon, X, ExternalLink, Link as LinkIcon, ShoppingBag, Info, Calculator, ArrowLeft, Percent, Save, FileText, LayoutList, Banknote, TrendingUp, Settings as SettingsIcon, Wand2, Shield, CreditCard, Star, AlertCircle } from 'lucide-react';
import { Order, Settings, OrderItem, Product, CustomerProfile, Store, User } from '../types';
import { EGYPT_GOVERNORATES } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomerSelectModal } from './CustomerSelectModal';
import { calculateCodFee, getLatestProductCost, calculateInsuranceFee, getStandardShippingFee } from '../utils/financials';

export interface NewOrderState extends Partial<Omit<Order, 'id'>> {
  items: OrderItem[];
  customerPhone2?: string;
  country?: string;
  buildingDetails?: string;
  creditAmount?: number;
  totalAmountOverrideReason?: string;
  advancePayment?: number;
  maintenanceItemValue?: number;
  advancePaymentPartnerId?: string;
  advancePaymentTreasuryId?: string;
  advancePaymentRecipientPhone?: string;
  advancePaymentSenderDetails?: string;
  recordedAsDebt?: boolean;
}

interface OrderFormProps {
  orderData: NewOrderState | Order;
  setOrderData: React.Dispatch<React.SetStateAction<any>>;
  settings: Settings;
  isEditing: boolean;
  customers: CustomerProfile[];
  orders: Order[];
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  treasury?: any;
  allStoresData?: Record<string, any>;
}

export const OrderForm: React.FC<OrderFormProps> = ({
  orderData,
  setOrderData,
  settings,
  isEditing,
  customers,
  orders,
  onSubmit,
  onCancel,
  treasury,
  allStoresData
}) => {
    const navigate = useNavigate();
    const isExchange = (orderData as NewOrderState).orderType === 'exchange' || (orderData as NewOrderState).shipmentType === 'exchange';
    const isReturn = (orderData as NewOrderState).shipmentType === 'return';
    const isCashCollection = (orderData as NewOrderState).shipmentType === 'cash_collection';
    const isMaintenance = (orderData as NewOrderState).orderType === 'maintenance' || (orderData as NewOrderState).shipmentType === 'maintenance_pickup' || (orderData as NewOrderState).shipmentType === 'maintenance_return';
    let creditAmount = (orderData as NewOrderState).creditAmount || 0;

    // Customer Search State
    const [isCustomerListOpen, setIsCustomerListOpen] = useState(false);
    
    const globalCustomerStats = useMemo(() => {
        if (!allStoresData || !orderData.customerPhone) return null;
        let totalOrders = 0;
        let successfulOrders = 0;
        let debtBalance = 0;
        const cleanPhone = orderData.customerPhone.replace(/\s/g, '').replace('+2', '');
        
        if (cleanPhone.length < 8) return null; 

        Object.values(allStoresData).forEach((storeData: any) => {
            const storeCustomers = storeData.customers || [];
            const storeOrders = storeData.orders || [];
            
            const matchingOrders = storeOrders.filter((o: any) => o.customerPhone && o.customerPhone.replace(/\s/g, '').replace('+2', '') === cleanPhone);
            let dynamicTotal = matchingOrders.length;
            let dynamicSuccess = matchingOrders.filter((o: any) => ['تم_توصيلها', 'تم_التحصيل', 'مدفوعة'].includes(o.status)).length;
            
            const matchingCustomer = storeCustomers.find((c: any) => c.phone && c.phone.replace(/\s/g, '').replace('+2', '') === cleanPhone);
            if (matchingCustomer) {
                dynamicTotal = Math.max(dynamicTotal, matchingCustomer.totalOrders || 0);
                dynamicSuccess = Math.max(dynamicSuccess, matchingCustomer.successfulOrders || 0);
                debtBalance += (matchingCustomer.debtBalance || 0);
            }
            
            totalOrders += dynamicTotal;
            successfulOrders += dynamicSuccess;
        });

        if (totalOrders === 0 && debtBalance === 0) {
            return {
                isNew: true,
                totalOrders: 0,
                successfulOrders: 0,
                successRate: 0,
                debtBalance: 0
            };
        }
        return {
            isNew: false,
            totalOrders,
            successfulOrders,
            successRate: (successfulOrders / totalOrders) * 100,
            debtBalance
        };
    }, [allStoresData, orderData.customerPhone]);

    if (isEditing && isExchange && !creditAmount && orderData.originalOrderId) {
        const originalOrder = orders.find(o => o.id === orderData.originalOrderId);
        if (originalOrder) {
            creditAmount = originalOrder.totalAmountOverride ?? (originalOrder.productPrice + originalOrder.shippingFee - (originalOrder.discount || 0));
        }
    }

    const subtotal = useMemo(() => {
        if ((isExchange && orderData.useProductsForShipment === false) || isCashCollection) {
            return Number(orderData.customShipmentPrice) || 0;
        }
        if (isReturn) {
            return 0;
        }
        return (orderData.items || []).reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
    }, [orderData.items, isExchange, orderData.useProductsForShipment, orderData.customShipmentPrice, isReturn, isCashCollection]);

    const totalWeight = useMemo(() => {
        return (orderData.items || []).reduce((sum, item) => sum + (item.weight || 0) * (item.quantity || 1), 0);
    }, [orderData.items]);

    // Helper functions moved from OrderModal
    const handleFieldChange = (field: keyof NewOrderState, value: any) => setOrderData((prev: any) => ({ ...prev, [field]: value }));
    
    const handleCustomerSelect = (customer: CustomerProfile) => {
        setOrderData((prev: any) => ({ 
            ...prev, 
            customerName: customer.name, 
            customerPhone: customer.phone, 
            customerAddress: customer.address,
            governorate: customer.governorate || prev.governorate || '',
            shippingArea: customer.governorate || prev.shippingArea || '',
            city: customer.city || prev.city || '',
            shippingFee: typeof customer.shippingFee === 'number' ? customer.shippingFee : prev.shippingFee || 0
        }));
        setIsCustomerListOpen(false);
    };

    const handleItemChange = (index: number, field: keyof OrderItem, value: any) => {
        let newItems = [...(orderData.items || [])];
    
        if (field === 'productId') {
            const product = settings.products.find(p => p.id === value);
            if (!product) {
                handleFieldChange('items', newItems);
                return;
            }
            
            const existingItemIndex = newItems.findIndex((item, i) => item.productId === value && !item.variantId && i !== index);
    
            if (existingItemIndex !== -1) {
                const existingItem = newItems[existingItemIndex];
                const currentItem = newItems[index];
    
                newItems[existingItemIndex] = {
                    ...existingItem,
                    quantity: (existingItem.quantity || 0) + (currentItem.quantity || 1)
                };
                
                newItems = newItems.filter((_, i) => i !== index);
            } else {
                 newItems[index] = { ...newItems[index], productId: value, name: product.name, price: product.price, cost: getLatestProductCost(value, settings), weight: product.weight, thumbnail: product.thumbnail, variantId: undefined, variantDescription: undefined };
            }
        } else if (field === 'variantId') {
            const product = settings.products.find(p => p.id === newItems[index].productId);
            const variant = product?.variants?.find(v => v.id === value);
            if (variant) {
                newItems[index] = {
                    ...newItems[index],
                    variantId: value,
                    variantDescription: Object.entries(variant.options || {}).map(([k, v]) => `${k}: ${v}`).join(', '),
                    price: variant.price,
                    cost: variant.costPrice,
                    weight: variant.weight
                };
            } else {
                newItems[index] = {
                    ...newItems[index],
                    variantId: undefined,
                    variantDescription: undefined,
                    price: product?.price || 0,
                    cost: product?.costPrice || 0,
                    weight: product?.weight || 0
                };
            }
        } else {
            const updatedItem = { ...newItems[index], [field]: value };
            newItems[index] = updatedItem;
        }
    
        handleFieldChange('items', newItems);
    };

    const addItem = () => {
        const firstProduct = settings.products[0];
        if (!firstProduct) return;
        handleFieldChange('items', [...(orderData.items || []), { 
            productId: firstProduct.id, 
            name: firstProduct.name, 
            quantity: 1, 
            price: firstProduct.price, 
            cost: firstProduct.costPrice || 0, 
            weight: firstProduct.weight || 0, 
            thumbnail: firstProduct.thumbnail || '',
            discountValue: 0,
            discountType: 'amount'
        }]);
    };

    const removeItem = (index: number) => handleFieldChange('items', (orderData.items || []).filter((_, i) => i !== index));

    const itemDiscounts = useMemo(() => (orderData.items || []).reduce((sum, item) => {
        let discount = 0;
        if (item.discountValue) {
            if (item.discountType === 'percentage') {
                discount = ((item.price || 0) * (item.quantity || 1)) * (item.discountValue / 100);
            } else {
                discount = item.discountValue * (item.quantity || 1);
            }
        }
        return sum + discount;
    }, 0), [orderData.items]);
    
    const inspectionFee = useMemo(() => {
        if (!orderData.includeInspectionFee) return 0;
        const compFees = settings.companySpecificFees?.[orderData.shippingCompany!];
        const useCustom = compFees?.useCustomFees ?? false;
        return useCustom ? (compFees?.inspectionFee || 0) : (settings.enableInspection ? settings.inspectionFee : 0);
    }, [orderData.includeInspectionFee, orderData.shippingCompany, settings]);

    // Smart Calculation for Insurance Fee
    const insuranceFee = useMemo(() => {
        if (orderData.isInsured === false) return 0;
        
        const company = orderData.shippingCompany;
        const compFees = settings.companySpecificFees?.[company!];
        const useCustom = compFees?.useCustomFees ?? false;
        
        // Use company specific insurance rate if available, otherwise global setting
        const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
        
        // Use the centralized method to ensure bosta and other settings are respected perfectly
        return calculateInsuranceFee({
            ...orderData as any,
            productPrice: isMaintenance ? (Number(orderData.maintenanceCost) || 0) : (subtotal - itemDiscounts)
        }, insuranceRate, settings);
    }, [orderData.isInsured, orderData.maintenanceItemValue, isMaintenance, orderData.shippingCompany, settings, subtotal, itemDiscounts, orderData.shippingFee, orderData.discount]);

    // Smart VAT Calculation (14% default or from settings)
    const activeVatAmount = useMemo(() => {
        const company = orderData.shippingCompany;
        const compFees = settings.companySpecificFees?.[company!];
        const useCustom = compFees?.useCustomFees ?? false;
        
        const hasVat = compFees?.enableVat !== false;
        if (!hasVat) return 0;
        
        const vatRate = useCustom ? (compFees?.shippingVatRate ?? 14) : (settings.shippingVatRate ?? 14);
        const vatBasis = useCustom ? (compFees?.vatBasis || 'shipping_only') : 'shipping_only';
        
        // VAT usually applies to the shipping fee + service fees, not the product price itself in logistics
        const useStandard = orderData.vatOnStandardShipping === true;
        const shippingFee = useStandard 
            ? getStandardShippingFee(orderData as Order, settings)
            : (Number(orderData.shippingFee) || 0);
        const inspectionFeeValue = orderData.includeInspectionFee ? inspectionFee : 0;
        const insuranceValue = vatBasis === 'shipping_and_insurance' ? insuranceFee : 0;
        
        // In maintenance, cost of maintenance might also be taxed if it's handled through the carrier
        const serviceBase = isMaintenance ? (Number(orderData.maintenanceCost) || 0) : 0;
        
        const taxableBase = shippingFee + inspectionFeeValue + serviceBase + insuranceValue;
        return Math.round(taxableBase * (vatRate / 100) * 100) / 100;
    }, [orderData.shippingCompany, settings, orderData.governorate, orderData.shippingArea, orderData.city, orderData.items, orderData.shipmentType, orderData.includeInspectionFee, inspectionFee, isMaintenance, orderData.maintenanceCost, insuranceFee, orderData.shippingFee, orderData.vatOnStandardShipping]);

    // Final Amount to Collect (مبلغ التحصيل)
    const finalAmount = useMemo(() => {
        if (orderData.shipmentType === 'maintenance_pickup' && orderData.deferPaymentToReturn) {
            return 0; // Customer pays everything upon return
        }

        const basePrice = isMaintenance ? (Number(orderData.maintenanceCost) || 0) : (subtotal - itemDiscounts);
        const shipping = Number(orderData.shippingFee) || 0;
        const inspection = orderData.includeInspectionFee ? inspectionFee : 0;
        const insurance = insuranceFee;
        const vat = activeVatAmount;
        const discount = Number(orderData.discount) || 0;
        const advance = Number(orderData.advancePayment) || 0;
        const credit = Number(creditAmount) || 0;

        let total = basePrice + shipping + inspection + insurance + vat - discount - advance - credit;
        
        // Handle "Return cash to customer" (إرجاع مبالغ نقدية)
        if (orderData.returnCashToCustomer && orderData.cashToReturnAmount) {
            total -= Number(orderData.cashToReturnAmount);
        }

        return Math.max(0, Math.round(total));
    }, [orderData.shipmentType, orderData.deferPaymentToReturn, orderData.maintenanceCost, isMaintenance, subtotal, itemDiscounts, orderData.shippingFee, orderData.includeInspectionFee, inspectionFee, insuranceFee, activeVatAmount, orderData.discount, orderData.advancePayment, creditAmount, orderData.returnCashToCustomer, orderData.cashToReturnAmount]);

    const liveProfitMargin = useMemo(() => {
        const costOfItems = (orderData.items || []).reduce((sum: number, item: any) => {
            const prod = settings.products.find(p => p.id === item.productId);
            let itemCostByQty = Number(prod?.costPrice) || 0;
            if (prod?.hasVariants && item.variantId) {
                const variant = prod.variants?.find(v => v.id === item.variantId);
                itemCostByQty = Number(variant?.costPrice) || itemCostByQty;
            }
            return sum + (itemCostByQty * (Number(item.quantity) || 1));
        }, 0);

        const totalCollected = orderData.totalAmountOverride !== undefined && orderData.totalAmountOverride !== null && (orderData.totalAmountOverride as any) !== ''
            ? Number(orderData.totalAmountOverride)
            : Number(finalAmount || 0);

        const codFee = Number(calculateCodFee({ status: 'تم_التحصيل', totalPrice: totalCollected, shippingFee: orderData.shippingFee || 0 } as any, settings)) || 0;
        const totalExpenses = costOfItems + Number(orderData.shippingFee || 0) + insuranceFee + inspectionFee + codFee + activeVatAmount;
        const profit = totalCollected - totalExpenses;
        
        return {
            costOfItems,
            insuranceFee,
            effectiveInspectionCost: inspectionFee,
            codFee,
            totalExpenses,
            profit,
            profitPercent: totalCollected > 0 ? Math.round((profit / totalCollected) * 100) : 0
        };
    }, [orderData.items, orderData.totalAmountOverride, orderData.shippingFee, orderData.discount, orderData.isInsured, orderData.includeInspectionFee, orderData.shippingCompany, finalAmount, settings, insuranceFee, activeVatAmount]);

    // FIX: Optimized and simplified companies calculation to prevent "missing carriers" issue
    const activeCompanies = useMemo(() => {
        const carrierKeys = Object.keys(settings.shippingOptions || {});
        return carrierKeys.filter(company => settings.activeCompanies?.[company] !== false);
    }, [settings.shippingOptions, settings.activeCompanies]);
    
    const isFlexShipConfigured = useMemo(() => {
        const compFees = settings.companySpecificFees?.[orderData.shippingCompany!];
        const useCustom = compFees?.useCustomFees ?? false;
        return useCustom ? (compFees?.enableFlexShip ?? false) : (settings.enableFlexShip ?? false);
    }, [orderData.shippingCompany, settings]);

    const orderFlexShipActive = useMemo(() => {
        return orderData.enableFlexShip !== undefined ? orderData.enableFlexShip : isFlexShipConfigured;
    }, [orderData.enableFlexShip, isFlexShipConfigured]);

    const activeFlexShipFee = useMemo(() => {
        const compFees = settings.companySpecificFees?.[orderData.shippingCompany!];
        const useCustom = compFees?.useCustomFees ?? false;
        const defaultFlexShipFee = useCustom ? (compFees?.flexShipFee ?? 0) : (settings.flexShipFee ?? 0);
        return orderData.flexShipFee !== undefined && orderData.flexShipFee !== null ? orderData.flexShipFee : defaultFlexShipFee;
    }, [orderData.flexShipFee, orderData.shippingCompany, settings]);

    const activeFlexShipCompanyFee = useMemo(() => {
        const compFees = settings.companySpecificFees?.[orderData.shippingCompany!];
        const useCustom = compFees?.useCustomFees ?? false;
        const defaultFlexShipCompanyFee = useCustom ? (compFees?.flexShipCompanyFee ?? 0) : (settings.flexShipCompanyFee ?? 0);
        return orderData.flexShipCompanyFee !== undefined && orderData.flexShipCompanyFee !== null ? orderData.flexShipCompanyFee : defaultFlexShipCompanyFee;
    }, [orderData.flexShipCompanyFee, orderData.shippingCompany, settings]);
    
    const shippingOptions = useMemo(() => {
        const company = orderData.shippingCompany;
        const userOptions = (company && settings.shippingOptions?.[company]) || [];
        
        // 1. Start with all user-defined options
        const result = [...userOptions];
        
        // 2. Add missing default governorates from EGYPT_GOVERNORATES
        EGYPT_GOVERNORATES.forEach((gov, index) => {
            const exists = result.some(o => o.label === gov.name);
            if (!exists) {
                result.push({
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
        
        return result as any[];
    }, [settings.shippingOptions, orderData.shippingCompany]);

    const isFirstEditLoad = useRef(isEditing);

    useEffect(() => {
        const selectedOption = shippingOptions.find(opt => opt.label === (orderData.governorate || orderData.shippingArea));
            if (selectedOption) {
                if (isFirstEditLoad.current) {
                    isFirstEditLoad.current = false;
                    return;
                }

                // If Manual Shipping is selected, we don't automatically update the shippingFee field 
                // based on governorate/city changes. The user entered it manually.
                if (orderData.vatOnStandardShipping !== true) return;

                const getPriceKey = (type?: string): 'deliveryPrice' | 'exchangePrice' | 'returnPrice' | 'cashCollectionPrice' | 'returnToSenderPrice' | 'maintenancePickupPrice' | 'maintenanceReturnPrice' => {
                    if (type === 'exchange') return 'exchangePrice';
                    if (type === 'return') return 'returnPrice';
                    if (type === 'maintenance_pickup') return 'returnPrice';
                    if (type === 'maintenance_return') return 'maintenanceReturnPrice';
                    if (type === 'cash_collection') return 'cashCollectionPrice';
                    return 'deliveryPrice';
                };
                const priceKey = getPriceKey(orderData.shipmentType);
                let fee = (selectedOption[priceKey] as number) || selectedOption.deliveryPrice || 0;
                let extraKgPrice = selectedOption.extraKgPrice || 0;
                if (orderData.city) {
                    const cityOpt = selectedOption.cities?.find(c => c.name === orderData.city);
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
                
                const compFees = settings.companySpecificFees?.[orderData.shippingCompany!];
                const baseWeight = compFees?.useCustomFees && compFees.baseWeight !== undefined 
                    ? compFees.baseWeight 
                    : (settings.baseWeight !== undefined ? settings.baseWeight : 5);
                
                const currentTotalWeight = orderData.items?.reduce((sum: number, item: any) => {
                    const itemWeight = parseFloat(item.weight?.toString() || '0');
                    const itemQuantity = parseInt(item.quantity?.toString() || '1');
                    return sum + (itemWeight * itemQuantity);
                }, 0) || 0;
                const extraWeight = Math.max(0, currentTotalWeight - baseWeight);
                const totalFee = fee + (Math.ceil(extraWeight) * extraKgPrice);

                if (totalFee !== orderData.shippingFee) {
                    handleFieldChange('shippingFee', totalFee);
                }
            }
    }, [orderData.governorate, orderData.shippingArea, orderData.city, shippingOptions, orderData.items, orderData.shipmentType, orderData.vatOnStandardShipping]);

    // ProductSelect Sub-component
    const ProductSelect = ({ value, onChange, products, index }: { value: string, onChange: (val: string) => void, products: any[], index: number }) => {
        const [isOpen, setIsOpen] = useState(false);
        const [search, setSearch] = useState('');
        const containerRef = useRef<HTMLDivElement>(null);
        
        const selectedProduct = products.find(p => p.id === value);
        const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

        useEffect(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                    setIsOpen(false);
                }
            };
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }, []);

        return (
            <div className="relative" ref={containerRef}>
                <button 
                    type="button" 
                    onClick={() => setIsOpen(!isOpen)} 
                    className="w-full flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-right hover:bg-slate-100 dark:hover:bg-slate-700 transition-all outline-none"
                >
                    <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex-shrink-0 overflow-hidden">
                        {selectedProduct?.thumbnail ? (
                            <img src={selectedProduct.thumbnail} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <Package size={20} />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 text-right">
                        <p className="text-slate-800 dark:text-slate-200 leading-tight">{selectedProduct?.name || 'اختر منتجاً'}</p>
                        <p className="text-[10px] text-slate-500 font-medium">#{selectedProduct?.id.slice(-6)}</p>
                    </div>
                    <ChevronDown size={18} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-[150] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                            <input 
                                autoFocus
                                type="text"
                                placeholder="ابحث عن منتج..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20"
                            />
                        </div>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                            {filtered.length > 0 ? (
                                filtered.map(p => (
                                    <div 
                                        key={p.id} 
                                        onClick={() => { onChange(p.id); setIsOpen(false); }} 
                                        className={`flex items-center gap-3 p-3 hover:bg-amber-50 dark:hover:bg-amber-500/10 cursor-pointer border-b border-slate-50 dark:border-slate-700/50 last:border-0 transition-colors ${value === p.id ? 'bg-amber-50 dark:bg-amber-500/10' : ''}`}
                                    >
                                        <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-700 flex-shrink-0 overflow-hidden">
                                            {p.thumbnail ? (
                                                <img src={p.thumbnail} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                            ) : <Package size={24} className="m-auto text-slate-300" />}
                                        </div>
                                        <div className="flex-1 text-right">
                                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{p.name}</p>
                                            <div className="flex justify-between items-center mt-1">
                                                <span className="text-xs font-black text-amber-600 truncate">{p.price} ج.م</span>
                                                <span className={`text-[10px] font-bold ${(p.stock || p.stockQuantity || 0) <= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                    مخزون: {p.stock || p.stockQuantity || 0}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-slate-400 text-sm">
                                    لا توجد نتائج للبحث
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8" dir="rtl">
            <motion.form 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={onSubmit} 
                className="max-w-6xl mx-auto space-y-8"
            >
                {/* Header (Desktop Style) */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
                    <div className="flex items-center gap-5">
                       <button 
                            type="button" 
                            onClick={onCancel}
                            className="w-12 h-12 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all shadow-sm"
                        >
                            <ArrowRightLeft size={22} className="rotate-180" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">
                                {isEditing ? `تعديل الطلب #${orderData.orderNumber}` : 'إنشاء طلب جديد'}
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 font-bold mt-1">أكمل بيانات الطلب لبدء عملية الشحن والتحصيل في الوقت الفعلي.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            type="button" 
                            onClick={onCancel}
                            className="px-6 py-3.5 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-bold rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm"
                        >
                            إلغاء
                        </button>
                        <button 
                            type="submit"
                            className="px-8 py-3.5 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-2.5 text-sm"
                        >
                            <Save size={18} />
                            <span>{isEditing ? 'حفظ التعديلات' : 'إتمام الطلب'}</span>
                        </button>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20">
                     <div className="lg:col-span-7 space-y-8">
                        {/* Shipment Type Selector - Modern Segmented Control */}
                        <div className="p-2 bg-slate-100 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-wrap gap-1">
                             {(() => {
                                const compFees = (settings.companySpecificFees?.[orderData.shippingCompany!] || {}) as any;
                                const tabs: { id: string; label: string; icon: React.ReactNode; badge?: string }[] = [
                                    { id: 'delivery', label: 'توصيل شحنة', icon: <Truck size={17} /> }
                                ];
                                if (compFees.enablePartialDelivery !== false) {
                                    tabs.push({ id: 'partial_delivery', label: 'توصيل جزئي', icon: <Package size={17} />, badge: 'جديد' });
                                }
                                 if (compFees.enableExchange !== false) tabs.push({ id: 'exchange', label: 'تبديل شحنة', icon: <ArrowRightLeft size={17} /> });
                                 if (compFees.enableReturn !== false) tabs.push({ id: 'return', label: 'إرجاع شحنة', icon: <RefreshCcw size={17} /> });
                                 if (compFees.enableCashCollection !== false) tabs.push({ id: 'cash_collection', label: 'تحصيل نقدي', icon: <Coins size={17} /> });
                                tabs.push({ id: 'maintenance_pickup', label: 'سحب منتج للصيانة', icon: <SettingsIcon size={17} /> });
                                tabs.push({ id: 'maintenance_return', label: 'توصيل منتج صيانة', icon: <Wand2 size={17} /> });
                                return tabs;
                            })().map(tab => {
                                const isActive = (orderData.shipmentType || 'delivery') === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => {
                                            handleFieldChange('shipmentType', tab.id);
                                            if (tab.id.startsWith('maintenance_')) {
                                                handleFieldChange('orderType', 'maintenance');
                                            } else if (tab.id === 'exchange') {
                                                handleFieldChange('orderType', 'exchange');
                                            } else {
                                                handleFieldChange('orderType', 'standard');
                                            }
                                        }}
                                        className={`relative flex items-center gap-2.5 py-3 px-6 rounded-2xl text-xs font-black transition-all duration-300 shrink-0 ${
                                            isActive
                                                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-xl shadow-black/5 ring-1 ring-slate-200 dark:ring-slate-700'
                                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                                        }`}
                                    >
                                        {tab.icon}
                                        <span>{tab.label}</span>
                                        {tab.badge && <span className="text-[10px] px-2 py-0.5 bg-indigo-500 text-white rounded-lg font-bold leading-none">{tab.badge}</span>}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Customer Details Card */}
                        <div className="p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm relative overflow-hidden group">
                            <h4 className="font-extrabold text-slate-800 dark:text-white mb-8 flex items-center gap-3 text-xl">
                                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-600">
                                    <UserIcon size={24}/>
                                </div>
                                بيانات العميل
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="relative">
                                    <div className="flex items-center justify-between mb-2">
                                       <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mr-1 tracking-wider uppercase">اسم العميل</label>
                                       <button 
                                         type="button"
                                         onClick={() => setIsCustomerListOpen(true)}
                                         className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/20 px-2 py-1 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1"
                                       >
                                         <UserIcon size={12}/> اختيار من المسجلين
                                       </button>
                                    </div>
                                    <input type="text" placeholder="اسم العميل" required value={orderData.customerName || ''} onChange={e => handleFieldChange('customerName', e.target.value)} className="p-4.5 bg-slate-50/50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all dark:text-white font-black text-lg" />
                                    
                                    {/* Debt Notification */}
                                    {orderData.customerPhone && (customers || []).find(c => c.phone === orderData.customerPhone)?.debtBalance! > 0 && (
                                        <div className="mt-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl flex items-center gap-3 animate-pulse">
                                            <AlertCircle className="text-red-600 shrink-0" size={20} />
                                            <div>
                                                <p className="text-red-700 dark:text-red-400 text-xs font-black">تنبيه: مديونية مسجلة</p>
                                                <p className="text-red-600 dark:text-red-300 text-[10px] font-bold">العميل عليه دين بقيمة <span className="underline font-black text-xs">{(customers || []).find(c => c.phone === orderData.customerPhone)?.debtBalance} ج.م</span></p>
                                            </div>
                                        </div>
                                    )}
                                    
                                    <CustomerSelectModal 
                                       isOpen={isCustomerListOpen}
                                       onClose={() => setIsCustomerListOpen(false)}
                                       customers={customers}
                                       onSelect={(c) => {
                                          handleCustomerSelect(c);
                                          setIsCustomerListOpen(false);
                                       }}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">رقم الهاتف الأساسي</label>
                                    <input type="tel" placeholder="01xxxxxxxxx" required value={orderData.customerPhone || ''} onChange={e => handleFieldChange('customerPhone', e.target.value)} className="p-4.5 bg-slate-50/50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all dark:text-white font-black text-lg text-right tracking-widest" dir="ltr" />
                                    {globalCustomerStats && (
                                        <div className={`mt-3 text-xs flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border ${globalCustomerStats.isNew ? 'bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-indigo-50/80 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300'}`}>
                                            {globalCustomerStats.isNew ? (
                                                <span className="font-bold flex items-center gap-1.5"><Star size={14} className="fill-current"/>عميل جديد</span>
                                            ) : (
                                                <>
                                                    <span className="font-bold flex items-center gap-1.5"><Star size={14} className="fill-current"/>نسبة نجاح العميل: <span className="font-black text-sm">{Math.round(globalCustomerStats.successRate)}%</span></span>
                                                    {globalCustomerStats.debtBalance > 0 && (
                                                       <span className="font-bold flex items-center gap-1.5 px-3 py-1 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg animate-pulse">
                                                         <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                                                         مديونية سابقة: <span className="font-black text-sm">{globalCustomerStats.debtBalance} ج.م</span>
                                                       </span>
                                                     )}
                                                     <span className="font-medium opacity-80 backdrop-blur-sm">({globalCustomerStats.successfulOrders} طلب ناجح / {globalCustomerStats.totalOrders} إجمالي) بجميع متاجرك</span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">رقم هاتف إضافي (اختياري)</label>
                                    <input type="tel" placeholder="رقم بديل للعميل" value={(orderData as NewOrderState).customerPhone2 || ''} onChange={e => handleFieldChange('customerPhone2', e.target.value)} className="p-4.5 bg-slate-50/50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all dark:text-white font-bold text-right" dir="ltr" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">الدولة</label>
                                    <input type="text" placeholder="مصر" value={(orderData as NewOrderState).country || 'مصر'} className="p-4.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl w-full opacity-60 cursor-not-allowed dark:text-slate-400 font-black" disabled />
                                </div>
                            </div>
                            <div className="mt-6">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">العنوان بالتفصيل</label>
                                <textarea placeholder="شارع، منطقة، علامة مميزة..." required value={orderData.customerAddress || ''} onChange={e => handleFieldChange('customerAddress', e.target.value)} className="w-full p-5 bg-slate-50/50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl h-28 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all resize-none dark:text-white font-bold" />
                            </div>
                            <div className="mt-6">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">تفاصيل المبنى (رقم الشقة، الدور...)</label>
                                <input type="text" placeholder="مثال: عمارة رقم 5، الدور الثالث، شقة 10" value={(orderData as NewOrderState).buildingDetails || ''} onChange={e => handleFieldChange('buildingDetails', e.target.value)} className="w-full p-4 bg-slate-50/50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all dark:text-white font-bold" />
                            </div>
                        </div>

                         {/* Shipping Details Card */}
                         <div className="p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm relative overflow-hidden group">
                            <h4 className="font-extrabold text-slate-800 dark:text-white mb-8 flex items-center gap-3 text-xl">
                                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-600">
                                    <Building size={24}/>
                                </div>
                                بيانات الشحن والمنطقة
                            </h4>
                            
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                 <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">شركة الشحن</label>
                                    <select required value={orderData.shippingCompany} onChange={e => handleFieldChange('shippingCompany', e.target.value)} className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all dark:text-white font-black cursor-pointer">
                                        {activeCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                 </div>
                                 {(settings.warehouses || []).length > 0 && (
                                     <div>
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">مستودع الشحن (المصدر)</label>
                                        <select 
                                            required 
                                            value={orderData.warehouseId || settings.warehouses?.find(w => w.isDefault)?.id || ''} 
                                            onChange={e => handleFieldChange('warehouseId', e.target.value)} 
                                            className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all dark:text-white font-black cursor-pointer"
                                        >
                                            <option value="">-- اختر مستودع الشحن --</option>
                                            {settings.warehouses?.map(w => <option key={w.id} value={w.id}>{w.name} {w.isDefault ? '(الافتراضي)' : ''}</option>)}
                                        </select>
                                     </div>
                                 )}
                                 <div className="grid grid-cols-2 gap-4">
                                     <div>
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">المحافظة</label>
                                        <select 
                                            required 
                                            value={orderData.governorate || orderData.shippingArea || ''} 
                                            onChange={e => {
                                                const gov = e.target.value;
                                                setOrderData((prev: any) => ({ ...prev, governorate: gov, shippingArea: gov, city: '' }));
                                            }} 
                                            className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all dark:text-white font-black cursor-pointer text-sm"
                                        >
                                            <option value="" disabled>اختر المحافظة</option>
                                            {shippingOptions.map(opt => <option key={opt.id} value={opt.label}>{opt.label}</option>)}
                                        </select>
                                     </div>
                                     <div>
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">المدينة</label>
                                        <select 
                                            required 
                                            value={orderData.city || ''} 
                                            onChange={e => handleFieldChange('city', e.target.value)} 
                                            className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all dark:text-white font-black cursor-pointer text-sm disabled:opacity-50"
                                            disabled={!(orderData.governorate || orderData.shippingArea)}
                                        >
                                            <option value="" disabled>اختر المدينة</option>
                                            {(shippingOptions.find(o => o.label === (orderData.governorate || orderData.shippingArea))?.cities || []).map(city => (
                                                <option key={city.id} value={city.name}>{city.name}</option>
                                            ))}
                                        </select>
                                     </div>
                                 </div>
                             </div>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">رقم الطلب (اختياري)</label>
                                    <input type="text" placeholder="تلقائي" value={orderData.orderNumber || ''} onChange={e => handleFieldChange('orderNumber', e.target.value)} className="p-4.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full font-mono focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all dark:text-white text-sm font-black" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">رقم المرجع للفاتورة</label>
                                    <input type="text" placeholder="#" value={orderData.referenceNumber || ''} onChange={e => handleFieldChange('referenceNumber', e.target.value)} className="p-4.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full font-mono focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all dark:text-white text-sm font-black" />
                                </div>
                            </div>
                        </div>

                         <div className="p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                            <h4 className="font-extrabold text-slate-800 dark:text-white mb-6 flex items-center gap-3 text-xl">
                                <div className="w-12 h-12 bg-sky-50 dark:bg-sky-500/10 rounded-2xl flex items-center justify-center text-sky-600">
                                    <CreditCard size={24}/>
                                </div>
                                طريقة الدفع
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {settings.paymentMethods?.filter(m => m.active).map(method => (
                                    <button
                                        key={method.id}
                                        type="button"
                                        onClick={() => handleFieldChange('paymentMethod', method.name)}
                                        className={`p-4 rounded-2xl border-2 font-bold transition-all ${orderData.paymentMethod === method.name ? 'bg-sky-100 border-sky-500 text-sky-700 dark:bg-sky-500/20 dark:border-sky-500 dark:text-sky-300' : 'bg-slate-50 border-transparent text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-100'}`}
                                    >
                                        {method.name}
                                    </button>
                                )) || (
                                    /* Fallback if no payment methods configured */
                                    ['كاش', 'محفظة', 'تحويل', 'فيزا'].map(method => (
                                        <button
                                            key={method}
                                            type="button"
                                            onClick={() => handleFieldChange('paymentMethod', method)}
                                            className={`p-4 rounded-2xl border-2 font-bold transition-all ${orderData.paymentMethod === method ? 'bg-sky-100 border-sky-500 text-sky-700 dark:bg-sky-500/20 dark:border-sky-500 dark:text-sky-300' : 'bg-slate-50 border-transparent text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-100'}`}
                                        >
                                            {method}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                            <h4 className="font-extrabold text-slate-800 dark:text-white mb-6 flex items-center gap-3 text-xl">
                                <div className="w-12 h-12 bg-pink-50 dark:bg-pink-500/10 rounded-2xl flex items-center justify-center text-pink-600">
                                    <ImageIcon size={24}/>
                                </div>
                                صور ومرفقات الطلب
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                                {(orderData.images || []).map((img: string, idx: number) => (
                                    <div key={idx} className="relative aspect-square rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-700 group shadow-lg">
                                        <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-sm">
                                            <button 
                                                type="button" 
                                                onClick={() => handleFieldChange('images', (orderData.images || []).filter((_: any, i: number) => i !== idx))}
                                                className="w-10 h-10 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all shadow-xl scale-90 group-hover:scale-100 flex items-center justify-center"
                                            >
                                                <X size={20} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        const url = prompt('أدخل رابط الصورة:');
                                        if (url) handleFieldChange('images', [...(orderData.images || []), url]);
                                    }}
                                    className="aspect-square rounded-3xl bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/5 transition-all group"
                                >
                                    <Plus size={32} className="mb-2 group-hover:scale-110 transition-transform" />
                                    <span className="text-xs font-black">إضافة صوره</span>
                                </button>
                            </div>
                        </div>

                        <div className="p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                            <h4 className="font-extrabold text-slate-800 dark:text-white mb-6 flex items-center gap-3 text-xl">
                                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-500/10 rounded-2xl flex items-center justify-center text-slate-600">
                                    <FileText size={24}/>
                                </div>
                                ملاحظات إضافية
                            </h4>
                            <textarea placeholder="اكتب أي ملاحظات خاصة للطلب أو المندوب..." value={orderData.notes || ''} onChange={e => handleFieldChange('notes', e.target.value)} className="w-full p-6 bg-slate-50/50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[2rem] h-32 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 outline-none transition-all resize-none dark:text-white font-bold" />
                        </div>
                     </div>

                     <div className="lg:col-span-5 space-y-8">
                        {/* Products / Details based on Shipment type */}
                        {isReturn ? (
                            <div className="p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                                <h4 className="font-extrabold text-slate-800 dark:text-white mb-8 flex items-center gap-3 text-xl">
                                    <div className="w-12 h-12 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center text-red-600">
                                        <RefreshCcw size={24}/>
                                    </div>
                                    تفاصيل الإرجاع
                                </h4>
                                <div className="space-y-6">
                                     <div>
                                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">المنتج المراد استرجاعه</label>
                                        <ProductSelect 
                                            value={orderData.returnProductId || ''} 
                                            onChange={(val) => {
                                                const prod = settings.products.find(p => p.id === val);
                                                handleFieldChange('returnProductId', val);
                                                handleFieldChange('returnVariantId', undefined);
                                                handleFieldChange('returnDescription', prod?.name || '');
                                            }} 
                                            products={settings.products} 
                                            index={0} 
                                        />
                                    </div>
                                    {settings.products.find(p => p.id === orderData.returnProductId)?.hasVariants && (
                                        <div>
                                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">المقاس / اللون</label>
                                            <select 
                                                value={orderData.returnVariantId || ''} 
                                                onChange={(e) => {
                                                    const varId = e.target.value;
                                                    const prod = settings.products.find(p => p.id === orderData.returnProductId);
                                                    const variant = prod?.variants?.find(v => v.id === varId);
                                                    handleFieldChange('returnVariantId', varId);
                                                    let desc = prod?.name || '';
                                                    if (variant) desc += ` (${Object.entries(variant.options || {}).map(([k,v]) => `${k}:${v}`).join(', ')})`;
                                                    handleFieldChange('returnDescription', desc);
                                                }} 
                                                className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm"
                                            >
                                                <option value="">اختر النوع</option>
                                                {settings.products.find(p => p.id === orderData.returnProductId)?.variants?.map(v => (
                                                    <option key={v.id} value={v.id}>{Object.entries(v.options || {}).map(([key, val]) => `${key}: ${val}`).join(' - ')}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">الكمية</label>
                                            <input type="number" min="1" value={orderData.returnQuantity || 1} onChange={e => handleFieldChange('returnQuantity', Number(e.target.value))} className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-center text-lg" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">سعر الفتح</label>
                                            <div className="w-full p-4.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-center text-lg">0 ج.م</div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">سبب الإرجاع / تفاصيل</label>
                                        <textarea value={orderData.returnDescription || ''} onChange={e => handleFieldChange('returnDescription', e.target.value)} className="w-full p-5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl h-24 text-sm font-bold resize-none" />
                                    </div>
                                </div>
                            </div>
                        ) : isExchange ? (
                            <>
                                {/* المنتج المرتجع للتبديل */}
                                <div className="p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                                    <h4 className="font-extrabold text-slate-800 dark:text-white mb-8 flex items-center gap-3 text-xl">
                                        <div className="w-12 h-12 bg-orange-50 dark:bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-600">
                                            <RefreshCcw size={24} className="animate-spin-slow" />
                                        </div>
                                        المنتج المرتجع (الذي سيرجع لمخزننا)
                                    </h4>
                                    <div className="space-y-6">
                                         <div>
                                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">المنتج المراد استبداله</label>
                                            <ProductSelect 
                                                value={orderData.returnProductId || ''} 
                                                onChange={(val) => {
                                                    const prod = settings.products.find(p => p.id === val);
                                                    handleFieldChange('returnProductId', val);
                                                    handleFieldChange('returnVariantId', undefined);
                                                    handleFieldChange('returnDescription', prod?.name || '');
                                                }} 
                                                products={settings.products} 
                                                index={999} 
                                            />
                                        </div>
                                        {settings.products.find(p => p.id === orderData.returnProductId)?.hasVariants && (
                                            <div>
                                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">المقاس / اللون للمنتج المرتجع</label>
                                                <select 
                                                    value={orderData.returnVariantId || ''} 
                                                    onChange={(e) => {
                                                        const varId = e.target.value;
                                                        const prod = settings.products.find(p => p.id === orderData.returnProductId);
                                                        const variant = prod?.variants?.find(v => v.id === varId);
                                                        handleFieldChange('returnVariantId', varId);
                                                        let desc = prod?.name || '';
                                                        if (variant) desc += ` (${Object.entries(variant.options || {}).map(([k,v]) => `${k}:${v}`).join(', ')})`;
                                                        handleFieldChange('returnDescription', desc);
                                                    }} 
                                                    className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm"
                                                >
                                                    <option value="">اختر النوع</option>
                                                    {settings.products.find(p => p.id === orderData.returnProductId)?.variants?.map(v => (
                                                        <option key={v.id} value={v.id}>{Object.entries(v.options || {}).map(([key, val]) => `${key}: ${val}`).join(' - ')}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">الكمية المرتجعة</label>
                                                <input type="number" min="1" value={orderData.returnQuantity || 1} onChange={e => handleFieldChange('returnQuantity', Number(e.target.value))} className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-center text-lg" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">سعر الفتح</label>
                                                <div className="w-full p-4.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-center text-lg">0 ج.م</div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">سبب الاستبدال / تفاصيل أخرى</label>
                                            <textarea value={orderData.returnDescription || ''} onChange={e => handleFieldChange('returnDescription', e.target.value)} className="w-full p-5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl h-24 text-sm font-bold resize-none" />
                                        </div>
                                    </div>
                                </div>

                                {/* المنتج الجديد البديل المرسل */}
                                <div className="p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                                    <div className="flex justify-between items-center mb-8">
                                        <h4 className="font-extrabold text-slate-800 dark:text-white flex items-center gap-3 text-xl">
                                            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600">
                                                <LayoutList size={24}/>
                                            </div>
                                            المنتج الجديد (الذي سنرسله بدلاً منه)
                                        </h4>
                                        <button type="button" onClick={addItem} className="flex items-center gap-2 px-6 py-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl font-black hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all text-sm group">
                                            <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                                            <span>إضافة منتج بديل</span>
                                        </button>
                                    </div>
                                    
                                    <div className="space-y-6">
                                        {(orderData.items || []).map((item, idx) => (
                                            <div key={idx} className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50 relative group transition-all hover:bg-white dark:hover:bg-slate-800 shadow-sm hover:shadow-xl hover:shadow-black/5">
                                                <button type="button" onClick={() => removeItem(idx)} className="absolute top-4 left-4 p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"><Trash2 size={18} /></button>
                                                <div className="space-y-5">
                                                    <ProductSelect value={item.productId || ''} onChange={val => handleItemChange(idx, 'productId', val)} products={settings.products} index={idx} />
                                                    {settings.products.find(p => p.id === item.productId)?.hasVariants && (
                                                        <div>
                                                            <label className="text-[10px] text-slate-400 font-black uppercase mb-1.5 block tracking-widest">المقاس / اللون للمنتج الجديد البديل</label>
                                                            <select value={item.variantId || ''} onChange={e => handleItemChange(idx, 'variantId', e.target.value)} className="w-full p-3.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl font-bold text-sm">
                                                                <option value="">اختر النوع</option>
                                                                {settings.products.find(p => p.id === item.productId)?.variants?.map(v => (
                                                                    <option key={v.id} value={v.id}>{Object.entries(v.options || {}).map(([k, val]) => `${k}:${val}`).join(' - ')}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="text-[10px] text-slate-400 font-black uppercase mb-1.5 block tracking-widest">الكمية</label>
                                                            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl p-1.5">
                                                                <button type="button" onClick={() => handleItemChange(idx, 'quantity', Math.max(1, (item.quantity||1) - 1))} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all">-</button>
                                                                <input type="number" min="1" value={item.quantity || 1} onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))} className="w-full bg-transparent text-center font-black text-lg p-0 border-none outline-none" />
                                                                <button type="button" onClick={() => handleItemChange(idx, 'quantity', (item.quantity||1) + 1)} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all">+</button>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] text-slate-400 font-black uppercase mb-1.5 block tracking-widest">السعر</label>
                                                            <input type="number" value={item.price || 0} onChange={e => handleItemChange(idx, 'price', Number(e.target.value))} className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl w-full font-black text-lg text-emerald-600 text-center" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : isCashCollection ? (
                             <div className="p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                                <h4 className="font-extrabold text-slate-800 dark:text-white mb-8 flex items-center gap-3 text-xl">
                                    <div className="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-600">
                                        <Coins size={24}/>
                                    </div>
                                    تفاصيل التحصيل النقدي
                                </h4>
                                <div className="space-y-6">
                                     <p className="text-slate-500 font-bold p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center">هذا الطلب مخصص لتحصيل مبالغ نقدية فقط بدون منتجات.</p>
                                </div>
                            </div>
                        ) : isMaintenance ? (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Technical Info Card */}
                                <div className="p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                                    
                                    <h4 className="font-extrabold text-slate-800 dark:text-white mb-10 flex items-center gap-4 text-xl justify-between relative">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                                                {orderData.shipmentType === 'maintenance_pickup' ? <SettingsIcon size={24}/> : <Wand2 size={24}/>}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-lg">{orderData.shipmentType === 'maintenance_pickup' ? 'سحب منتج للصيانة' : 'توصيل منتج من الصيانة'}</span>
                                            </div>
                                        </div>
                                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${orderData.shipmentType === 'maintenance_pickup' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                            {orderData.shipmentType === 'maintenance_pickup' ? 'سحب فني' : 'توصيل فني'}
                                        </div>
                                    </h4>
                                    
                                    <div className="space-y-10 relative">
                                        {/* Group 1: Identify Product */}
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">بيانات المنتج الأساسية</span>
                                            </div>
                                            <div className="space-y-6">
                                                <div>
                                                    <label className="text-xs font-black text-slate-500 mb-3 block mr-1">وصف المنتج (خارج البراند)</label>
                                                    <input 
                                                        type="text" 
                                                        placeholder="مثال: سماعة ابل ايربودز الجيل الثالث" 
                                                        value={orderData.maintenanceItemDescription || ''} 
                                                        onChange={e => handleFieldChange('maintenanceItemDescription', e.target.value)} 
                                                        className="w-full p-4.5 bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold dark:text-white transition-all focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none" 
                                                    />
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div>
                                                        <label className="text-xs font-black text-slate-500 mb-3 block mr-1">الرقم التسلسلي / S.N</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="S/N: xxxxxxxx" 
                                                            value={orderData.maintenanceItemSerial || ''} 
                                                            onChange={e => handleFieldChange('maintenanceItemSerial', e.target.value)} 
                                                            className="w-full p-4.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold dark:text-white text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none" 
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-black text-slate-500 mb-3 block mr-1">تقرير العطل / المشكلة</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="وصف المشكلة المذكورة" 
                                                            value={orderData.maintenanceTechnicalReport || ''} 
                                                            onChange={e => handleFieldChange('maintenanceTechnicalReport', e.target.value)} 
                                                            className="w-full p-4.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold dark:text-white text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none" 
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Group 2: Financial Estimates */}
                                        <div className="bg-slate-50/50 dark:bg-slate-800/20 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/50 space-y-8">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">التقديرات المالية والتحصيل</span>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <div className="space-y-4">
                                                    <label className="text-xs font-black text-slate-500 flex items-center gap-2 mr-1">
                                                        <span>قيمة المنتج (للتأمين)</span>
                                                        <Info size={14} className="text-indigo-400" />
                                                    </label>
                                                    <div className="relative">
                                                        <input 
                                                            type="number" 
                                                            value={orderData.maintenanceItemValue || ''} 
                                                            onChange={e => handleFieldChange('maintenanceItemValue', Number(e.target.value))} 
                                                            className="w-full p-5 pl-14 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-black text-2xl text-slate-900 dark:text-white focus:border-indigo-500 outline-none transition-all" 
                                                            placeholder="0"
                                                        />
                                                        <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-300">ج.م</span>
                                                        <div className="absolute -top-3 right-4 bg-indigo-600 text-white text-[9px] px-3 py-1 font-black rounded-lg shadow-lg">تأمين: {insuranceFee} ج.م</div>
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    <label className="text-xs font-black text-slate-500 mr-1">تكلفة الصيانة المقدرة</label>
                                                    <div className="relative">
                                                        <input 
                                                            type="number" 
                                                            value={orderData.maintenanceCost || ''} 
                                                            onChange={e => handleFieldChange('maintenanceCost', Number(e.target.value))} 
                                                            className="w-full p-5 pl-14 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-black text-2xl text-emerald-600 focus:border-emerald-500 outline-none transition-all" 
                                                            placeholder="0"
                                                        />
                                                        <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-300">ج.م</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-8 border-t border-slate-200 dark:border-slate-700/50 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        handleFieldChange('returnCashToCustomer', !orderData.returnCashToCustomer);
                                                        if (!orderData.returnCashToCustomer) handleFieldChange('deferPaymentToReturn', false);
                                                    }}
                                                    className={`p-5 rounded-2xl border-2 transition-all text-right flex flex-col gap-1.5 group ${orderData.returnCashToCustomer ? 'border-rose-500 bg-rose-50 dark:bg-rose-500/10' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm'}`}
                                                >
                                                    <div className="flex justify-between items-center w-full">
                                                        <span className={`text-[10px] font-black uppercase tracking-wider ${orderData.returnCashToCustomer ? 'text-rose-600' : 'text-slate-400'}`}>التحصيل المالي</span>
                                                        <div className={`w-2 h-2 rounded-full ${orderData.returnCashToCustomer ? 'bg-rose-500 animate-pulse' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                                                    </div>
                                                    <span className="text-sm font-black">إرجاع مبلغ نقدى للعميل</span>
                                                </button>

                                                {orderData.shipmentType === 'maintenance_pickup' && (
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            handleFieldChange('deferPaymentToReturn', !orderData.deferPaymentToReturn);
                                                            handleFieldChange('recordedAsDebt', !orderData.deferPaymentToReturn);
                                                            if (!orderData.deferPaymentToReturn) handleFieldChange('returnCashToCustomer', false);
                                                        }}
                                                        className={`p-5 rounded-2xl border-2 transition-all text-right flex flex-col gap-1.5 group ${orderData.deferPaymentToReturn ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm'}`}
                                                    >
                                                        <div className="flex justify-between items-center w-full">
                                                            <span className={`text-[10px] font-black uppercase tracking-wider ${orderData.deferPaymentToReturn ? 'text-amber-600' : 'text-slate-400'}`}>موعد الدفع</span>
                                                            <div className={`w-2 h-2 rounded-full ${orderData.deferPaymentToReturn ? 'bg-amber-500 animate-pulse' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                                                        </div>
                                                        <span className="text-sm font-black">الدفع عند التوصيل لاحقاً</span>
                                                    </button>
                                                )}
                                            </div>

                                            {orderData.returnCashToCustomer && (
                                                <div className="mt-4 p-6 bg-rose-50 dark:bg-rose-500/5 rounded-3xl border border-rose-100 dark:border-rose-900/30 animate-in zoom-in-95 duration-300">
                                                    <label className="text-[10px] font-black text-rose-500 mb-2 block mr-1 uppercase">المبلغ المرتجع للعميل نقداً</label>
                                                    <div className="relative">
                                                        <input 
                                                            type="number" 
                                                            placeholder="0" 
                                                            value={orderData.cashToReturnAmount || ''} 
                                                            onChange={e => handleFieldChange('cashToReturnAmount', Number(e.target.value))}
                                                            className="w-full p-4.5 pl-14 bg-white dark:bg-slate-900 border-2 border-rose-200 dark:border-rose-900/40 rounded-2xl font-black text-2xl text-rose-500 text-center focus:border-rose-500 outline-none shadow-sm" 
                                                        />
                                                        <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-rose-200">ج.م</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                                <div className="flex justify-between items-center mb-8">
                                    <h4 className="font-extrabold text-slate-800 dark:text-white flex items-center gap-3 text-xl">
                                        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600">
                                            <LayoutList size={24}/>
                                        </div>
                                        عناصر الطلب
                                    </h4>
                                    <button type="button" onClick={addItem} className="flex items-center gap-2 px-6 py-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl font-black hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all text-sm group">
                                        <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                                        <span>إضافة منتج</span>
                                    </button>
                                </div>
                                
                                <div className="space-y-6">
                                    {(orderData.items || []).map((item, idx) => (
                                        <div key={idx} className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50 relative group transition-all hover:bg-white dark:hover:bg-slate-800 shadow-sm hover:shadow-xl hover:shadow-black/5">
                                            <button type="button" onClick={() => removeItem(idx)} className="absolute top-4 left-4 p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"><Trash2 size={18} /></button>
                                            <div className="space-y-5">
                                                <ProductSelect value={item.productId || ''} onChange={val => handleItemChange(idx, 'productId', val)} products={settings.products} index={idx} />
                                                {settings.products.find(p => p.id === item.productId)?.hasVariants && (
                                                    <div>
                                                        <label className="text-[10px] text-slate-400 font-black uppercase mb-1.5 block tracking-widest">المقاس / اللون</label>
                                                        <select value={item.variantId || ''} onChange={e => handleItemChange(idx, 'variantId', e.target.value)} className="w-full p-3.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl font-bold text-sm">
                                                            <option value="">اختر النوع</option>
                                                            {settings.products.find(p => p.id === item.productId)?.variants?.map(v => (
                                                                <option key={v.id} value={v.id}>{Object.entries(v.options || {}).map(([k, val]) => `${k}:${val}`).join(' - ')}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-[10px] text-slate-400 font-black uppercase mb-1.5 block tracking-widest">الكمية</label>
                                                        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl p-1.5">
                                                            <button type="button" onClick={() => handleItemChange(idx, 'quantity', Math.max(1, (item.quantity||1) - 1))} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all">-</button>
                                                            <input type="number" min="1" value={item.quantity || 1} onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))} className="w-full bg-transparent text-center font-black text-lg p-0 border-none outline-none" />
                                                            <button type="button" onClick={() => handleItemChange(idx, 'quantity', (item.quantity||1) + 1)} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all">+</button>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] text-slate-400 font-black uppercase mb-1.5 block tracking-widest">السعر</label>
                                                        <input type="number" value={item.price || 0} onChange={e => handleItemChange(idx, 'price', Number(e.target.value))} className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl w-full font-black text-lg text-emerald-600 text-center" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {(!orderData.items || orderData.items.length === 0) && (
                                        <div className="py-20 text-center bg-slate-50/50 dark:bg-slate-800/30 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[2.5rem]">
                                            <p className="text-slate-400 font-bold">لا توجد منتجات مضافة لهذا الطلب</p>
                                            <button type="button" onClick={addItem} className="mt-4 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-500/20">أضف المنتج الأول</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Financial Summary */}
                        <div className="p-8 bg-indigo-900 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                           <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 transition-transform duration-1000 group-hover:scale-125"></div>
                           <h4 className="font-extrabold text-white mb-8 flex items-center gap-3 text-xl">
                               <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white">
                                   <Banknote size={24}/>
                               </div>
                               ملخص مالي دقيق
                            </h4>
                            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-2 mb-4">
                                <label className="text-white text-xs font-bold block text-right">طريقة حساب ضريبة القيمة المضافة:</label>
                                <div className="grid grid-cols-2 gap-1 bg-white/10 p-1 rounded-lg">
                                    <button
                                        type="button"
                                        onClick={() => handleFieldChange('vatOnStandardShipping', true)}
                                        className={`py-2 px-3 rounded-lg text-xs font-black transition-all ${
                                            orderData.vatOnStandardShipping === true
                                                ? 'bg-white text-indigo-950 shadow-sm'
                                                : 'text-white hover:bg-white/5'
                                        }`}
                                    >
                                        الشحن القياسي بالمدن
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleFieldChange('vatOnStandardShipping', false)}
                                        className={`py-2 px-3 rounded-lg text-xs font-black transition-all ${
                                            orderData.vatOnStandardShipping !== true
                                                ? 'bg-white text-indigo-950 shadow-sm'
                                                : 'text-white hover:bg-white/5'
                                        }`}
                                    >
                                        الشحن المدخل بالطلب
                                    </button>
                                </div>
                            </div>

                           <div className="space-y-4">
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   <div className="space-y-1">
                                       <label className="text-white text-xs font-bold block">الشحن</label>
                                       <input type="number" 
                                           value={orderData.shippingFee || 0} 
                                           onChange={(e) => handleFieldChange('shippingFee', Number(e.target.value))}
                                           className="w-full p-2 bg-white/10 rounded-xl text-white font-black text-sm"
                                       />
                                   </div>
                                   <div className="space-y-1">
                                       <label className="text-white text-xs font-bold block">الخصم الإضافي</label>
                                       <input type="number" 
                                           value={orderData.discount || 0} 
                                           onChange={(e) => handleFieldChange('discount', Number(e.target.value))}
                                           className="w-full p-2 bg-white/10 rounded-xl text-white font-black text-sm"
                                       />
                                   </div>
                               </div>

                               {[
                                   { label: isMaintenance ? 'سعر الصيانة' : 'سعر المنتجات', value: isMaintenance ? (orderData.maintenanceCost || 0) : subtotal },
                                   { label: 'الشحن', value: orderData.shippingFee || 0 },
                                   { label: 'الخصم', value: -(orderData.discount || 0) },
                                   { label: 'المعاينة', value: inspectionFee },
                                   { label: 'التأمين', value: insuranceFee },
                                   { label: 'ضريبة القيمة المضافة', value: activeVatAmount },
                                   ...(orderData.returnCashToCustomer ? [{ label: 'مبلغ مرتجع للعميل', value: -(orderData.cashToReturnAmount || 0) }] : [])
                               ].map((row, idx) => (
                                   <div key={idx} className="flex justify-between font-bold text-slate-300 text-sm">
                                       <span>{row.label}</span>
                                       <span className="font-black text-white">{row.value.toLocaleString()} ج.م</span>
                                   </div>
                               ))}
                               
                               <div className="pt-4 mt-2 border-t border-white/10">
                                   {!orderData.totalAmountOverride && (
                                       <button type="button" onClick={() => handleFieldChange('totalAmountOverride', finalAmount)} className="text-xs text-amber-300 font-bold underline">تعديل الإجمالي يدوياً</button>
                                   )}
                                   {orderData.totalAmountOverride !== undefined && (
                                       <div className="space-y-2">
                                           <div className="flex justify-between items-center">
                                                <label className="text-white text-xs font-bold mb-2 block">تعديل الإجمالي يدوياً (للرقابة)</label>
                                                <button type="button" onClick={() => { handleFieldChange('totalAmountOverride', undefined); handleFieldChange('totalAmountOverrideReason', undefined); }} className="text-xs text-red-300 font-bold underline">إلغاء التعديل</button>
                                           </div>
                                           <div className="flex gap-2">
                                               <input type="number" 
                                                   value={orderData.totalAmountOverride ?? ''} 
                                                   placeholder={`الإجمالي: ${finalAmount.toLocaleString()}`}
                                                   onChange={(e) => handleFieldChange('totalAmountOverride', e.target.value === '' ? undefined : Number(e.target.value))}
                                                   className="w-full p-3 bg-white/10 rounded-2xl text-white font-black text-sm"
                                               />
                                               <input type="text"
                                                   value={orderData.totalAmountOverrideReason || ''}
                                                   placeholder="سبب التعديل"
                                                   onChange={(e) => handleFieldChange('totalAmountOverrideReason', e.target.value)}
                                                   className="w-full p-3 bg-white/10 rounded-2xl text-white font-bold text-sm"
                                               />
                                           </div>
                                       </div>
                                   )}
                               </div>

                               <div className="pt-6 border-t border-white/10 mt-2 flex flex-col gap-1">
                                   <div className="flex justify-between items-center">
                                       <span className="text-slate-400 font-black text-xs uppercase tracking-widest">مبلغ التحصيل (المطلوب من العميل)</span>
                                       <div className="text-3xl font-black text-white flex items-baseline gap-2">
                                           {(orderData.totalAmountOverride !== undefined && orderData.totalAmountOverride !== null && (orderData.totalAmountOverride as any) !== '') ? Number(orderData.totalAmountOverride).toLocaleString() : finalAmount.toLocaleString()}
                                           <span className="text-sm font-bold text-slate-400">ج.م</span>
                                       </div>
                                   </div>
                               </div>
                           </div>
                       </div>


                        {/* Advance Payment Card */}
                        <div className="p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden relative group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform"></div>
                            <h4 className="font-extrabold text-slate-800 dark:text-white mb-6 flex items-center gap-3 text-xl">
                                <div className="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-600">
                                    <Coins size={24}/>
                                </div>
                                دفع عربون مسبق (دفعة مقدمة)
                            </h4>
                            
                            <div className="flex flex-col gap-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">مبلغ العربون</label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                placeholder="0.00" 
                                                value={orderData.advancePayment || ''} 
                                                onChange={e => handleFieldChange('advancePayment', Number(e.target.value))} 
                                                className="w-full p-4.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-black text-amber-600 dark:text-amber-500 outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all text-xl pr-12" 
                                            />
                                            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                                                <Banknote size={20} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2 text-right">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2.5 block mr-1 tracking-wider uppercase">وسيلة استلام العربون</label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleFieldChange('advancePaymentPartnerId', settings.partners?.[0]?.id || '');
                                                    handleFieldChange('advancePaymentTreasuryId', '');
                                                }}
                                                className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all border-2 ${orderData.advancePaymentPartnerId ? 'bg-amber-100 border-amber-500 text-amber-700' : 'bg-slate-50 border-transparent text-slate-500'}`}
                                            >
                                                شريك / مودع
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleFieldChange('advancePaymentTreasuryId', treasury?.accounts?.[0]?.id || '1');
                                                    handleFieldChange('advancePaymentPartnerId', '');
                                                }}
                                                className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all border-2 ${orderData.advancePaymentTreasuryId ? 'bg-indigo-100 border-indigo-500 text-indigo-700' : 'bg-slate-50 border-transparent text-slate-500'}`}
                                            >
                                                خزينة / محفظة
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {orderData.advancePaymentPartnerId && (
                                    <div className="p-6 bg-amber-50 dark:bg-amber-500/5 rounded-3xl border border-amber-100 dark:border-amber-500/20 space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-2 block">اختر الشريك</label>
                                            <select 
                                                value={orderData.advancePaymentPartnerId} 
                                                onChange={e => handleFieldChange('advancePaymentPartnerId', e.target.value)}
                                                className="w-full p-3.5 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-500/30 rounded-xl font-bold outline-none text-amber-900 dark:text-amber-100 appearance-none"
                                            >
                                                {settings.partners?.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name} (الرصيد: {p.balance?.toLocaleString()} ج.م)</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {orderData.advancePaymentTreasuryId && (
                                    <div className="p-6 bg-indigo-50 dark:bg-indigo-500/5 rounded-3xl border border-indigo-100 dark:border-indigo-500/20 space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest mb-2 block">الحساب المستلم</label>
                                            <select 
                                                value={orderData.advancePaymentTreasuryId} 
                                                onChange={e => handleFieldChange('advancePaymentTreasuryId', e.target.value)}
                                                className="w-full p-3.5 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-500/30 rounded-xl font-bold outline-none text-indigo-900 dark:text-indigo-100 appearance-none"
                                            >
                                                {treasury?.accounts?.map((acc: any) => (
                                                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.balance?.toLocaleString()} ج.م)</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest mb-2 block">رقم المرسل</label>
                                                <input 
                                                    type="tel" 
                                                    placeholder="رقم المحفظة المرسلة" 
                                                    value={orderData.advancePaymentRecipientPhone || ''} 
                                                    onChange={e => handleFieldChange('advancePaymentRecipientPhone', e.target.value)}
                                                    className="w-full p-3.5 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-500/30 rounded-xl font-bold outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest mb-2 block">تفاصيل العملية</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="ID العملية أو ملاحظة" 
                                                    value={orderData.advancePaymentSenderDetails || ''} 
                                                    onChange={e => handleFieldChange('advancePaymentSenderDetails', e.target.value)}
                                                    className="w-full p-3.5 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-500/30 rounded-xl font-bold outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Order Options Card */}
                        <div className="p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                            <h4 className="font-extrabold text-slate-800 dark:text-white mb-8 flex items-center gap-3 text-xl">
                                <div className="w-12 h-12 bg-purple-50 dark:bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-600">
                                    <SettingsIcon size={24}/>
                                </div>
                                خيارات الطلب الإضافية
                            </h4>
                            <div className={`grid grid-cols-1 sm:grid-cols-${isFlexShipConfigured && orderData.includeInspectionFee ? '3' : '2'} gap-5`}>
                                <button type="button" onClick={() => handleFieldChange('includeInspectionFee', !orderData.includeInspectionFee)} className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-start gap-3 relative overflow-hidden group ${orderData.includeInspectionFee ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500 text-indigo-700 dark:text-indigo-400 shadow-lg' : 'bg-slate-50 dark:bg-slate-800/50 border-transparent text-slate-500'}`}>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${orderData.includeInspectionFee ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                                        <Wand2 size={20} />
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-base">دفع مصاريف المعاينة</p>
                                        <p className="text-xs font-bold opacity-70 mt-1">يتحمل العميل التكاليف في حال الرفض</p>
                                    </div>
                                    {orderData.includeInspectionFee && <CheckCircle className="absolute top-4 left-4" size={24} />}
                                </button>
                                
                                <button type="button" onClick={() => handleFieldChange('isInsured', orderData.isInsured === false ? true : false)} className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-start gap-3 relative overflow-hidden group ${orderData.isInsured !== false ? 'bg-sky-50 dark:bg-sky-500/10 border-sky-500 text-sky-700 dark:text-sky-400 shadow-lg' : 'bg-slate-50 dark:bg-slate-800/50 border-transparent text-slate-500'}`}>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${orderData.isInsured !== false ? 'bg-sky-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                                        <Shield size={20} />
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-base">تأمين الشحن</p>
                                        <p className="text-xs font-bold opacity-70 mt-1">حماية ضد الضياع أو التلف لخدمات الشحن</p>
                                    </div>
                                    {orderData.isInsured !== false && <CheckCircle className="absolute top-4 left-4" size={24} />}
                                </button>

                                {isFlexShipConfigured && orderData.includeInspectionFee && (
                                    <button type="button" onClick={() => handleFieldChange('enableFlexShip', !orderFlexShipActive)} className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-start gap-3 relative overflow-hidden group ${orderFlexShipActive ? 'bg-violet-50 dark:bg-violet-500/10 border-violet-500 text-violet-700 dark:text-violet-400 shadow-lg' : 'bg-slate-50 dark:bg-slate-800/50 border-transparent text-slate-500'}`}>
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${orderFlexShipActive ? 'bg-violet-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                                            <Truck size={20} />
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-base">خدمة فليكس شيب</p>
                                            <p className="text-xs font-bold opacity-70 mt-1">تحصيل رسوم من المستلم في حال الرفض</p>
                                        </div>
                                        {orderFlexShipActive && <CheckCircle className="absolute top-4 left-4" size={24} />}
                                    </button>
                                )}
                            </div>

                            {/* Custom Flex Ship Amounts inside Order */}
                            {isFlexShipConfigured && orderData.includeInspectionFee && orderFlexShipActive && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }} 
                                    animate={{ opacity: 1, height: 'auto' }} 
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-6 p-6 bg-violet-50/50 dark:bg-violet-950/10 rounded-[2rem] border border-violet-100 dark:border-violet-900/30 grid grid-cols-1 gap-4 text-right"
                                >
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-violet-800 dark:text-violet-400 block mb-1">تحديد رسوم فليكس شيب للعميل (ج.م)</label>
                                        <input 
                                            type="number" 
                                            value={activeFlexShipFee} 
                                            onChange={(e) => handleFieldChange('flexShipFee', Number(e.target.value))} 
                                            className="w-full p-4 bg-white dark:bg-slate-800 border border-violet-200 dark:border-violet-800 rounded-2xl font-black text-slate-850 dark:text-white focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 outline-none transition-all text-right" 
                                            placeholder="مثلاً 50"
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </div>
                     </div>
                </div>
            </motion.form>
        </div>
    );
};
