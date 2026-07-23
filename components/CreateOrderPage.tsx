import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Order, OrderItem, Settings, User, CustomerProfile, Store, OrderStatus, MaintenanceRequest, AdvancePaymentHistoryLog } from '../types';
import { OrderForm, NewOrderState } from './OrderForm';
import { INITIAL_SETTINGS } from '../constants';
import { getLatestProductCost, calculateInsuranceFee, getStandardShippingFee, calculateCodFee } from '../utils/financials';
import { OrderPreConfirmationModal } from './OrderPreConfirmationModal';
import { OrderConfirmationSummary } from './OrderConfirmationSummary';
import { triggerWebhooks } from '../utils/webhook';
import { db } from '../services/firebaseClient';
import { collection, addDoc } from 'firebase/firestore';
import { triggerCelebration } from '../utils/celebration';

interface CreateOrderPageProps {
    orders: Order[];
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    settings: Settings;
    setSettings: React.Dispatch<React.SetStateAction<Settings>>;
    customers: CustomerProfile[];
    setCustomers: React.Dispatch<React.SetStateAction<CustomerProfile[]>>;
    activeStore?: Store;
    treasury?: any;
    setTreasury?: React.Dispatch<React.SetStateAction<any>>;
    currentUser: User | null;
    allStoresData?: Record<string, any>;
    forceSync?: (customStoreData?: any, customUsers?: any) => Promise<void>;
}

const CreateOrderPage: React.FC<CreateOrderPageProps> = ({ 
    orders, 
    setOrders, 
    settings, 
    setSettings,
    customers, 
    setCustomers,
    activeStore, 
    treasury,
    setTreasury,
    currentUser,
    allStoresData,
    forceSync
}) => {
    const navigate = useNavigate();
    const location = useLocation();

    const [orderToConfirm, setOrderToConfirm] = useState<Omit<Order, 'id'> | null>(null);
    const [showSummaryModal, setShowSummaryModal] = useState<Order | null>(null);

    const [newOrder, setNewOrder] = useState<NewOrderState>({
        customerName: '',
        customerPhone: '',
        customerAddress: '',
        items: [],
        shippingCompany: Object.keys(settings?.shippingOptions || {})[0] || 'بوسطة',
        governorate: '',
        city: '',
        shippingFee: 0,
        discount: 0,
        paymentStatus: 'بانتظار الدفع',
        status: 'جاري_المراجعة' as OrderStatus,
        preparationStatus: 'بانتظار التجهيز',
        date: new Date().toISOString(),
        orderType: 'standard',
        shipmentType: 'delivery',
        warehouseId: settings?.warehouses?.find((w: any) => w.isDefault)?.id || settings?.warehouses?.[0]?.id || '',
        includeInspectionFee: settings?.enableInspection ?? true,
        allowOpenShipment: settings?.enableInspection ?? true,
        isInsured: true,
        vatOnStandardShipping: false,
        source: 'manual',
    });

    if (!settings) return null;

    useEffect(() => {
        const state = location.state as { exchangeData?: any };
        if (state?.exchangeData) {
            setNewOrder(prev => ({
                ...prev,
                ...state.exchangeData
            }));
        }
    }, [location.state]);

    const getNextOrderNumber = () => {
        const nums = orders
            .map(o => {
                const match = o.orderNumber.match(/\d+/);
                return match ? parseInt(match[0]) : null;
            })
            .filter((n): n is number => n !== null);
        return nums.length > 0 ? Math.max(...nums) + 1 : 1;
    };

    const handleAddOrder = (e: React.FormEvent) => {
        e.preventDefault();
        const orderData = newOrder;
        
        const isExchangeCustom = orderData.shipmentType === 'exchange' && orderData.useProductsForShipment === false;
        const isReturn = orderData.shipmentType === 'return';
        const isCashCollection = orderData.shipmentType === 'cash_collection';
        const isMaintenance = orderData.orderType === 'maintenance' || orderData.shipmentType?.startsWith('maintenance_');
        
        let items: any[] = [];
        if (isExchangeCustom) {
            items = [{
                productId: 'custom-shipment',
                name: orderData.shipmentDescription || 'شحنة تبديل مرسلة',
                quantity: orderData.shipmentQuantity || 1,
                price: orderData.customShipmentPrice || 0,
                cost: 0,
                weight: 1,
                thumbnail: ''
            }];
        } else if (isReturn) {
            if (orderData.useProductsForReturn && orderData.returnProductId) {
                const prod = settings?.products?.find((p: any) => p.id === orderData.returnProductId);
                const variant = prod && orderData.returnVariantId
                    ? prod.variants?.find((v: any) => v.id === orderData.returnVariantId)
                    : null;
                items = [{
                    productId: orderData.returnProductId,
                    variantId: orderData.returnVariantId || undefined,
                    name: orderData.returnDescription || prod?.name || 'طلب إرجاع شحنة',
                    quantity: orderData.returnQuantity || 1,
                    price: 0,
                    cost: Number(variant?.costPrice || prod?.costPrice || 0),
                    weight: Number(prod?.weight || 1),
                    thumbnail: prod?.thumbnail || orderData.returnImage || ''
                }];
            } else {
                items = [{
                    productId: 'return-shipment',
                    name: orderData.returnDescription || 'طلب إرجاع شحنة',
                    quantity: orderData.returnQuantity || 1,
                    price: 0,
                    cost: 0,
                    weight: 1,
                    thumbnail: orderData.returnImage || ''
                }];
            }
        } else if (isCashCollection) {
            items = [{
                productId: 'cash-collection',
                name: 'طلب تحصيل نقدي',
                quantity: 1,
                price: orderData.customShipmentPrice || 0,
                cost: 0,
                weight: 1,
                thumbnail: ''
            }];
        } else if (isMaintenance) {
            items = [{
                productId: 'maintenance-item',
                name: orderData.maintenanceItemDescription || 'منتج صيانة',
                quantity: 1,
                price: orderData.maintenanceCost || 0,
                cost: 0,
                weight: 1,
                thumbnail: ''
            }];
        } else {
            items = Array.isArray(orderData.items) ? orderData.items : (orderData.items && typeof orderData.items === 'object' ? Object.values(orderData.items) : []);
        }
        
        if (items.length === 0) {
            alert("يجب إضافة منتج واحد على الأقل.");
            return;
        }
        
        const fullAddress = `${orderData.customerAddress}, ${orderData.buildingDetails || ''}`.trim();
        const finalNotes = orderData.notes || '';

        const totalProductPrice = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
        const totalProductCost = items.reduce((sum, item) => sum + (item.cost || 0) * (item.quantity || 1), 0);
        const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0) * (item.quantity || 1), 0);
        const productNames = items.map(item => item.name).join(', ');

        const totalBeforeAdvance = totalProductPrice + (orderData.shippingFee || 0) - (orderData.discount || 0);
        if ((orderData.advancePayment || 0) > totalBeforeAdvance) {
            alert("عفواً، لا يمكن أن يكون مبلغ العربون أكبر من إجمالي الطلب.");
            return;
        }

        const orderToAdd: Omit<Order, 'id'> = {
            ...(orderData as any),
            items,
            customerAddress: fullAddress,
            notes: finalNotes,
            orderNumber: orderData.orderNumber || `${getNextOrderNumber()}`,
            productPrice: totalProductPrice,
            productCost: totalProductCost,
            weight: totalWeight,
            productName: productNames,
            storeId: activeStore?.id || '',
            createdBy: currentUser?.fullName || 'النظام'
        };

        const creditAmount = orderData.creditAmount || 0;
        if (orderData.orderType === 'exchange' && creditAmount > 0) {
            const newTotal = (orderToAdd.productPrice + orderToAdd.shippingFee) - (orderToAdd.discount || 0);
            const finalAmount = newTotal - creditAmount;
            
            (orderToAdd as any).totalAmountOverride = finalAmount;
            
            if (finalAmount <= 0) {
                orderToAdd.paymentStatus = 'مدفوع';
            } else {
                orderToAdd.paymentStatus = 'بانتظار الدفع';
            }
            
            const exchangedItemNames = (orderData.exchangedItems || [])
                .filter((item: any) => item && item.selected)
                .map((item: any) => `${item.name} (كمية: ${item.quantity})`)
                .join('، ');
            const exchangeDetail = exchangedItemNames ? ` [المرتجع: ${exchangedItemNames}]` : '';
            orderToAdd.notes = `طلب استبدال للطلب #${orderData.originalOrderId}${exchangeDetail}. تم تطبيق رصيد بقيمة ${creditAmount.toLocaleString()} ج.م.\n${orderToAdd.notes || ''}`.trim();
            
            // Persist exchange details in database fields
            (orderToAdd as any).creditAmount = creditAmount;
            (orderToAdd as any).originalOrderItems = orderData.originalOrderItems || [];
            (orderToAdd as any).exchangedItems = orderData.exchangedItems || [];
        }

        setOrderToConfirm(orderToAdd);
    };

    const handleConfirmAddOrder = () => {
        if (!orderToConfirm) return;
        const orderToAdd = orderToConfirm;
        
        // Calculate exact customer billing/collection amount to save in totalPrice
        const compFees = settings?.companySpecificFees?.[orderToAdd.shippingCompany];
        const inspectionFee = (orderToAdd.includeInspectionFee !== false && orderToAdd.allowOpenShipment !== false) ? (compFees?.useCustomFees ? compFees.inspectionFee : settings.inspectionFee) : 0;
        const insuranceRate = orderToAdd.isInsured ? (compFees?.useCustomFees ? compFees.insuranceFeePercent : settings.insuranceFeePercent) : 0;
        const insuranceFee = calculateInsuranceFee(orderToAdd as Order, insuranceRate, settings);
        const safeAdvance = Number((orderToAdd as any).advancePayment) || 0;
        
        const useCustom = compFees?.useCustomFees ?? false;
        const isCompanyBosta = orderToAdd.shippingCompany ? (orderToAdd.shippingCompany.toLowerCase().includes('bosta') || orderToAdd.shippingCompany.includes('بوسطة') || orderToAdd.shippingCompany.includes('بوسطه')) : false;
        const defaultVatRate = isCompanyBosta ? 0.14 : 0;
        const vatRate = useCustom ? (compFees?.shippingVatRate ?? defaultVatRate) : (settings.shippingVatRate ?? defaultVatRate);
        const vatBasis = useCustom ? (compFees?.vatBasis || 'shipping_only') : (settings?.vatBasis || 'shipping_only');
        const hasVat = useCustom ? (compFees?.enableVat !== false) : true;
        const insuranceValueForVat = (vatBasis === 'shipping_and_insurance' || vatBasis === 'shipping_insurance_and_cod') ? insuranceFee : 0;
        const codValueForVat = vatBasis === 'shipping_insurance_and_cod' ? calculateCodFee(orderToAdd as Order, settings) : 0;
        const useStandard = orderToAdd.vatOnStandardShipping === true;
        const standardShippingFee = useStandard ? getStandardShippingFee(orderToAdd as Order, settings) : (orderToAdd.shippingFee || 0);
        const taxableBase = standardShippingFee + inspectionFee + insuranceValueForVat + codValueForVat;
        const vatValue = hasVat ? (Math.round(taxableBase * vatRate * 100) / 100) : 0;
        
  const isMaintenance = orderToAdd.orderType === 'maintenance';
        const basePrice = isMaintenance ? (Number((orderToAdd as any).maintenanceCost) || 0) : (orderToAdd.productPrice - (orderToAdd.discount || 0));
        const baseTotal = basePrice + orderToAdd.shippingFee - safeAdvance + inspectionFee + insuranceFee + vatValue;
        const returnCash = (orderToAdd.returnCashToCustomer && orderToAdd.cashToReturnAmount) ? Number(orderToAdd.cashToReturnAmount) : 0;
        const finalCollectedTotal = orderToAdd.totalAmountOverride !== undefined && orderToAdd.totalAmountOverride !== null
            ? Math.max(0, Math.round(Number(orderToAdd.totalAmountOverride)))
            : baseTotal;

        const id = `order-${Date.now()}`;
        
        // --- Helper for Unifying Names ---
        const normalizeName = (name: string) => {
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

        // Add history log if advance payment exists
        const advanceHistory: AdvancePaymentHistoryLog[] = [];
        const diffValue = orderToAdd.advancePayment || 0;
        if (diffValue > 0) {
            let rType: 'partner' | 'treasury' | 'employee' | undefined;
            let rId: string | undefined;
            if ((orderToAdd as any).advancePaymentPartnerId) {
                rType = 'partner';
                rId = (orderToAdd as any).advancePaymentPartnerId;
            } else if ((orderToAdd as any).advancePaymentTreasuryId) {
                rType = 'treasury';
                rId = (orderToAdd as any).advancePaymentTreasuryId;
            } else if ((orderToAdd as any).advancePaymentEmployeeId) {
                rType = 'employee';
                rId = (orderToAdd as any).advancePaymentEmployeeId;
            }

            advanceHistory.push({
                id: `log-${Date.now()}`,
                timestamp: new Date().toISOString(),
                amount: diffValue,
                userId: currentUser?.phone || 'unknown',
                userName: currentUser?.fullName || 'النظام',
                recipientType: rType,
                recipientId: rId,
                recipientPhone: (orderToAdd as any).advancePaymentRecipientPhone,
                senderDetails: (orderToAdd as any).advancePaymentSenderDetails,
                action: 'created'
            });
        }

        const orderWithId: Order = { 
            ...orderToAdd, 
            id,
            date: orderToAdd.date || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            totalPrice: Math.round(finalCollectedTotal),
            advancePaymentHistory: advanceHistory.length > 0 ? advanceHistory : undefined
        } as Order;

        const senderInfo = (orderWithId as any).advancePaymentSenderDetails ? ` | بيانات المحول: ${(orderWithId as any).advancePaymentSenderDetails}` : '';
        const phoneInfo = (orderWithId as any).advancePaymentRecipientPhone ? ` | هاتف المستلم: ${(orderWithId as any).advancePaymentRecipientPhone}` : '';
        const fullNote = `عربون / دفع مقدم للطلب #${orderWithId.orderNumber}${senderInfo}${phoneInfo}`;

        // Process Treasury / Partner / Employee updates
        const difference = orderWithId.advancePayment || 0;
        let updatedHandovers = [...(settings.cashHandovers || [])];

        if (difference !== 0 && (orderWithId as any).advancePaymentPartnerId) {
            const partnerId = (orderWithId as any).advancePaymentPartnerId;
            const partner = (settings.partners || []).find(p => p.id === partnerId);
            const partnerName = normalizeName(partner?.name || 'شريك');
            const partnerTx = {
                id: `adv-${Date.now()}`,
                partnerId: partnerId,
                type: 'customer_advance',
                amount: Math.abs(difference),
                date: new Date().toISOString(),
                note: fullNote
            } as any;
            
            // Record in Cash Handovers log
            updatedHandovers.unshift({
                id: `hd-p-${Date.now()}`,
                fromUserId: 'customer',
                fromUserName: orderWithId.customerName || 'العميل',
                toUserId: `part_${partnerId}`,
                toUserName: partnerName,
                amount: Math.abs(difference),
                date: new Date().toISOString(),
                notes: fullNote,
                status: 'completed'
            } as any);

            setSettings(prev => ({
                ...prev,
                partnerTransactions: [...(prev.partnerTransactions || []), partnerTx],
                partners: (prev.partners || []).map(p => p.id === partnerId ? { ...p, balance: (p.balance || 0) - difference } : p),
                cashHandovers: updatedHandovers
            }));
        } else if (difference !== 0 && (orderWithId as any).advancePaymentTreasuryId && setTreasury) {
            const treasuryId = (orderWithId as any).advancePaymentTreasuryId;
            const treasuryTxId = `tx-${Date.now()}`;
            const targetAccount = (treasury?.accounts || []).find((a: any) => a.id === treasuryId);
            const accountName = normalizeName(targetAccount?.name || 'الخزينة');

            // Record in Cash Handovers log
            updatedHandovers.unshift({
                id: `hd-t-${Date.now()}`,
                fromUserId: 'customer',
                fromUserName: orderWithId.customerName || 'العميل',
                toUserId: `treas_${treasuryId}`,
                toUserName: accountName,
                amount: Math.abs(difference),
                date: new Date().toISOString(),
                notes: fullNote,
                status: 'completed'
            } as any);

            setSettings(prev => ({ ...prev, cashHandovers: updatedHandovers }));

            setTreasury((prev: any) => {
                const currentTreasury = prev || { accounts: [], transactions: [] };
                const accountsArray = Array.isArray(currentTreasury.accounts) ? currentTreasury.accounts : Object.values(currentTreasury.accounts || {});
                const updatedAccounts = accountsArray.map((acc: any) => 
                    acc.id === treasuryId ? { ...acc, balance: acc.balance + difference } : acc
                );
                const newTx = {
                    id: treasuryTxId,
                    date: new Date().toISOString(),
                    type: difference > 0 ? 'deposit' : 'withdrawal',
                    amount: Math.abs(difference),
                    description: fullNote,
                    toAccountId: difference > 0 ? treasuryId : undefined,
                    fromAccountId: difference < 0 ? treasuryId : undefined,
                };
                return {
                    accounts: updatedAccounts,
                    transactions: [newTx, ...currentTreasury.transactions]
                };
            });
        } else if (difference !== 0 && (orderWithId as any).advancePaymentEmployeeId) {
            const empId = (orderWithId as any).advancePaymentEmployeeId;
            const empName = normalizeName(empId === 'admin' 
                ? 'المدير (أنت)' 
                : (((settings.employees || []).find(e => e.id === empId)?.name) || ((settings.partners || []).find(p => p.id === empId)?.name) || 'المسؤول'));
            
            const curHolders = settings.cashHolders || [];
            const exists = curHolders.find(h => h.userId === empId);
            
            let updatedHolders;
            if (exists) {
                updatedHolders = curHolders.map(h => h.userId === empId ? { ...h, currentBalance: (h.currentBalance || 0) + difference, lastUpdated: new Date().toISOString() } : h);
            } else {
                updatedHolders = [...curHolders, {
                    userId: empId,
                    userName: empName,
                    currentBalance: difference,
                    lastUpdated: new Date().toISOString()
                }];
            }
            
            const handoverTx = {
                id: `hd-${Date.now()}`,
                fromUserId: 'customer',
                fromUserName: orderWithId.customerName || 'العميل',
                toUserId: empId,
                toUserName: empName,
                amount: Math.abs(difference),
                date: new Date().toISOString(),
                notes: fullNote,
                status: 'completed'
            } as any;

            setSettings(prev => ({
                ...prev,
                cashHolders: updatedHolders,
                cashHandovers: [handoverTx, ...(prev.cashHandovers || [])]
            }));
        }

        // Customer Logic
        const cleanPhone = (orderToAdd.customerPhone || '').replace(/\s/g, '').replace('+2', '');
        if (cleanPhone) {
            setCustomers(prev => {
                const existing = prev.find(c => c.phone.replace(/\s/g, '').replace('+2', '') === cleanPhone);
                const debtToAdd = (orderWithId as any).recordedAsDebt ? (orderWithId.totalAmountOverride || (orderWithId.productPrice + orderWithId.shippingFee - (orderWithId.discount || 0))) : 0;

                if (existing) {
                    return prev.map(c => c.id === existing.id ? { 
                        ...c, 
                        name: orderToAdd.customerName || c.name,
                        address: orderToAdd.customerAddress || c.address,
                        governorate: orderToAdd.governorate || orderToAdd.shippingArea || c.governorate,
                        city: orderToAdd.city || c.city,
                        shippingFee: (typeof orderToAdd.shippingFee === 'number' && orderToAdd.shippingFee > 0) ? orderToAdd.shippingFee : c.shippingFee,
                        lastOrderDate: new Date().toISOString(),
                        debtBalance: (c.debtBalance || 0) + debtToAdd,
                        debtHistory: debtToAdd > 0 ? [...(c.debtHistory || []), {
                            amount: debtToAdd,
                            type: 'increase' as const,
                            reason: `دين مسجل من الطلب #${orderWithId.orderNumber}`,
                            date: new Date().toISOString(),
                            orderId: orderWithId.id
                        }] : c.debtHistory
                    } : c);
                } else {
                    const newCustomer: CustomerProfile = {
                        id: `cust-${Date.now()}`,
                        name: orderToAdd.customerName || '',
                        phone: orderToAdd.customerPhone || '',
                        address: orderToAdd.customerAddress || '',
                        governorate: orderToAdd.governorate || orderToAdd.shippingArea || '',
                        city: orderToAdd.city || '',
                        shippingFee: orderToAdd.shippingFee || 0,
                        totalOrders: 1,
                        successfulOrders: 0,
                        returnedOrders: 0,
                        totalSpent: 0,
                        lastOrderDate: new Date().toISOString(),
                        firstOrderDate: new Date().toISOString(),
                        averageOrderValue: 0,
                        loyaltyPoints: 0,
                        debtBalance: debtToAdd,
                        debtHistory: debtToAdd > 0 ? [{
                            amount: debtToAdd,
                            type: 'increase' as const,
                            reason: `دين مسجل من الطلب #${orderWithId.orderNumber}`,
                            date: new Date().toISOString(),
                            orderId: orderWithId.id
                        }] : []
                    };
                    return [newCustomer, ...prev];
                }
            });
        }

        // Orders update
        if (orderWithId.orderType === 'exchange' && orderWithId.originalOrderId) {
            setOrders(prevOrders => {
                const updated = prevOrders.map(o => 
                    o.id === orderWithId.originalOrderId ? { 
                        ...o, 
                        status: 'تم_الاستبدال' as OrderStatus,
                        customerPaidOriginalShipping: orderWithId.customerPaidOriginalShipping !== false
                    } : o
                );
                return [orderWithId, ...updated];
            });
        } else {
            setOrders(prev => [orderWithId, ...prev]);
        }

        // --- LINK TO MAINTENANCE CENTER ---
        const isMaintenanceAction = orderWithId.orderType === 'maintenance' || orderWithId.shipmentType?.startsWith('maintenance_');
        if (isMaintenanceAction && orderWithId.shipmentType === 'maintenance_pickup') {
            const maintenanceRequest: Partial<MaintenanceRequest> = {
                storeId: activeStore?.id || '',
                orderNumber: orderWithId.orderNumber,
                customerName: orderWithId.customerName,
                customerPhone: orderWithId.customerPhone,
                customerAddress: orderWithId.customerAddress,
                governorate: orderWithId.governorate,
                city: orderWithId.city,
                itemDescription: (orderWithId as any).maintenanceItemDescription || 'منتج صيانة من شحنة',
                itemSerial: (orderWithId as any).maintenanceItemSerial || '',
                itemValue: (orderWithId as any).maintenanceItemValue || 0,
                initialProblemDescription: (orderWithId as any).maintenanceTechnicalReport || 'تم السحب من العميل',
                status: 'received',
                priority: (orderWithId as any).priority || 'medium',
                receivedDate: new Date().toISOString().split('T')[0],
                totalCost: (orderWithId as any).maintenanceCost || 0,
                internalNotes: `تم إنشاء الطلب تلقائياً من شحنة سحب صيانة #${orderWithId.orderNumber}`,
                parts: [],
                laborCost: 0
            };

            addDoc(collection(db, 'maintenance_requests'), maintenanceRequest)
                .catch(err => console.error("Error creating linked maintenance request:", err));
        }
        // ----------------------------------

        triggerWebhooks(orderWithId, settings);
        
        // Sync with forceSync using complete updated state to bypass React async delay
        const currentStoreId = activeStore?.id;
        if (forceSync && allStoresData && currentStoreId && allStoresData[currentStoreId]) {
            const storeData = allStoresData[currentStoreId];
            let updatedOrders = [...(storeData.orders || [])];
            if (orderWithId.orderType === 'exchange' && orderWithId.originalOrderId) {
                updatedOrders = updatedOrders.map(o => 
                    o.id === orderWithId.originalOrderId ? { 
                        ...o, 
                        status: 'تم_الاستبدال' as OrderStatus,
                        customerPaidOriginalShipping: orderWithId.customerPaidOriginalShipping !== false
                    } : o
                );
            }
            updatedOrders = [orderWithId, ...updatedOrders];

            const updatedStoreData = {
                ...storeData,
                orders: updatedOrders,
                settings: {
                    ...(storeData.settings || settings),
                    cashHandovers: updatedHandovers
                }
            };
            void forceSync(updatedStoreData);
        } else if (forceSync) {
            void forceSync();
        }
        
        // تشغيل صوت واحتفالات نجاح تسجيل الطلب
        triggerCelebration('create_order', settings);
        
        setOrderToConfirm(null);
        setShowSummaryModal(orderWithId);
    };

    const uniqueCustomers = useMemo(() => {
        const seen = new Set();
        return customers.filter(c => {
          if (seen.has(c.phone)) return false;
          seen.add(c.phone);
          return true;
        });
    }, [customers]);

    return (
        <>
            <OrderForm 
                orderData={newOrder}
                setOrderData={setNewOrder}
                settings={settings}
                isEditing={false}
                customers={uniqueCustomers}
                orders={orders}
                onSubmit={handleAddOrder}
                onCancel={() => navigate(activeStore ? `/store/${activeStore.id}/orders` : '/orders')}
                treasury={treasury}
                allStoresData={allStoresData}
            />

            {orderToConfirm && (
                <OrderPreConfirmationModal 
                    order={orderToConfirm}
                    settings={settings}
                    onConfirm={handleConfirmAddOrder}
                    onCancel={() => setOrderToConfirm(null)}
                />
            )}

            {showSummaryModal && (
                <OrderConfirmationSummary 
                    order={showSummaryModal}
                    settings={settings}
                    storeName={activeStore?.name || 'متجري'}
                    onClose={() => {
                        setShowSummaryModal(null);
                        navigate(activeStore ? `/store/${activeStore.id}/orders` : '/orders');
                    }}
                />
            )}
        </>
    );
};

export default CreateOrderPage;

