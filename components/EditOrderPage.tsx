import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Order, Settings, User, CustomerProfile, Store, OrderStatus, AdvancePaymentHistoryLog } from '../types';
import { OrderForm } from './OrderForm';
import GlobalLoader from './GlobalLoader';
import { syncMaintenanceStatus } from '../src/utils/maintenanceSync';
import { calculateInsuranceFee, getStandardShippingFee, calculateCodFee } from '../utils/financials';
import { triggerCelebration } from '../utils/celebration';

interface EditOrderPageProps {
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

const EditOrderPage: React.FC<EditOrderPageProps> = ({ 
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
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);

    if (!settings) return <GlobalLoader />;

    // Normalization logic for synced orders
    const normalizeSyncedOrder = (order: Order): Order => {
        if (order.source !== 'synced') return order;

        const GOVERNORATE_MAP: Record<string, string> = {
            'CAIRO': 'القاهرة', 'GIZA': 'الجيزة', 'ALEXANDRIA': 'الإسكندرية', 'QALYUBIA': 'القليوبية',
            'DAKAHLIA': 'الدقهلية', 'SHARKIA': 'الشرقية', 'GHARBIA': 'الغربية', 'MONUFIA': 'المنوفية',
            'BEHEIRA': 'البحيرة', 'KAFR EL SHEIKH': 'كفر الشيخ', 'KAFRELSHEIKH': 'كفر الشيخ',
            'DAMIETTA': 'دمياط', 'PORT SAID': 'بورسعيد', 'ISMAILIA': 'الإسماعيلية', 'SUEZ': 'السويس',
            'BENI SUEF': 'بني سويف', 'FAYOUM': 'الفيوم', 'MINYA': 'المنيا', 'ASSUIT': 'أسيوط',
            'SOhag': 'سوهاج', 'QENA': 'قنا', 'LUXOR': 'الأقصر', 'ASWAN': 'أسوان', 'RED SEA': 'البحر الأحمر',
            'NEW VALLEY': 'الوادي الجديد', 'MATROUH': 'مطروح', 'NORTH SINAI': 'شمال سيناء', 'SOUTH SINAI': 'جنوب سيناء'
        };

        const govKey = (order.governorate || order.shippingArea || '').toUpperCase();
        const mappedGov = GOVERNORATE_MAP[govKey] || order.governorate || order.shippingArea || '';

        const rawItems = Array.isArray(order.items) ? order.items : (order.items && typeof order.items === 'object' ? Object.values(order.items) : []);
        const productsList = Array.isArray(settings?.products) ? settings.products : (settings?.products && typeof settings.products === 'object' ? Object.values(settings.products) : []);

        const normalizedItems = rawItems.map((item: any) => {
            const existsDirectly = productsList.some((p: any) => p.id === item.productId || p.variants?.some((v: any) => v.id === item.productId));
            const wuiltId = `wuilt-${item.productId}`;
            const existsAsWuilt = !existsDirectly && productsList.some((p: any) => p.id === wuiltId || p.variants?.some((v: any) => v.id === wuiltId));
            const targetProductId = existsDirectly ? item.productId : (existsAsWuilt ? wuiltId : (item.productId?.startsWith('wuilt-') ? item.productId : item.productId));

            return {
                ...item,
                productId: targetProductId || item.productId || '',
                price: (item.price === 0 && rawItems.length === 1 && order.productPrice > 0) ? order.productPrice : (item.price || 0)
            };
        });

        return {
            ...order,
            governorate: mappedGov,
            shippingArea: mappedGov,
            items: normalizedItems,
            shippingFee: order.shippingFee || 0
        };
    };

    useEffect(() => {
        console.log("DEBUG: EditOrderPage effect, param id:", id, "available orders:", orders.map(o => o.id));
        const order = orders.find(o => o.id === id);
        if (order) {
            setEditingOrder(normalizeSyncedOrder({ ...order }));
        }
    }, [id, orders, navigate, activeStore]);

    const handleUpdateOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (!editingOrder) {
                console.error("DEBUG: No editingOrder found during save");
                navigate(activeStore ? `/store/${activeStore.id}/orders` : '/orders');
                return;
            }

            const originalOrder = orders.find(o => o.id === id) || editingOrder;

            const isExchangeCustom = editingOrder.shipmentType === 'exchange' && editingOrder.useProductsForShipment === false;
            const isReturn = editingOrder.shipmentType === 'return';
            const isCashCollection = editingOrder.shipmentType === 'cash_collection';
            const isMaintenance = editingOrder.orderType === 'maintenance' || editingOrder.shipmentType?.startsWith('maintenance_');
            
            let items: any[] = [];
            if (isExchangeCustom) {
                items = [{
                    productId: 'custom-shipment',
                    name: editingOrder.shipmentDescription || 'شحنة تبديل مرسلة',
                    quantity: editingOrder.shipmentQuantity || 1,
                    price: editingOrder.customShipmentPrice || 0,
                    cost: 0,
                    weight: 1,
                    thumbnail: ''
                }];
            } else if (isReturn) {
                if (editingOrder.useProductsForReturn && editingOrder.returnProductId) {
                    const prod = settings?.products?.find((p: any) => p.id === editingOrder.returnProductId);
                    const variant = prod && editingOrder.returnVariantId
                        ? prod.variants?.find((v: any) => v.id === editingOrder.returnVariantId)
                        : null;
                    items = [{
                        productId: editingOrder.returnProductId,
                        variantId: editingOrder.returnVariantId || undefined,
                        name: editingOrder.returnDescription || prod?.name || 'طلب إرجاع شحنة',
                        quantity: editingOrder.returnQuantity || 1,
                        price: 0,
                        cost: Number(variant?.costPrice || prod?.costPrice || 0),
                        weight: Number(prod?.weight || 1),
                        thumbnail: prod?.thumbnail || editingOrder.returnImage || ''
                    }];
                } else {
                    items = [{
                        productId: 'return-shipment',
                        name: editingOrder.returnDescription || 'طلب إرجاع شحنة',
                        quantity: editingOrder.returnQuantity || 1,
                        price: 0,
                        cost: 0,
                        weight: 1,
                        thumbnail: editingOrder.returnImage || ''
                    }];
                }
            } else if (isCashCollection) {
                items = [{
                    productId: 'cash-collection',
                    name: 'طلب تحصيل نقدي',
                    quantity: 1,
                    price: editingOrder.customShipmentPrice || 0,
                    cost: 0,
                    weight: 1,
                    thumbnail: ''
                }];
            } else if (isMaintenance) {
                items = [{
                    productId: 'maintenance-item',
                    name: (editingOrder as any).maintenanceItemDescription || 'منتج صيانة',
                    quantity: 1,
                    price: (editingOrder as any).maintenanceCost || 0,
                    cost: 0,
                    weight: 1,
                    thumbnail: ''
                }];
            } else {
                items = Array.isArray(editingOrder.items) ? editingOrder.items : (editingOrder.items && typeof editingOrder.items === 'object' ? Object.values(editingOrder.items) : []);
            }

            const totalProductPrice = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
            const totalProductCost = items.reduce((sum, item) => sum + (item.cost || 0) * (item.quantity || 1), 0);
            const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0) * (item.quantity || 1), 0);
            const productNames = items.map(item => item.name).join(', ');

            const compFees = settings?.companySpecificFees?.[editingOrder.shippingCompany];
            const inspectionFee = (editingOrder.includeInspectionFee !== false && editingOrder.allowOpenShipment !== false) ? (compFees?.useCustomFees ? compFees.inspectionFee : settings.inspectionFee) : 0;
            const insuranceRate = editingOrder.isInsured ? (compFees?.useCustomFees ? compFees.insuranceFeePercent : settings.insuranceFeePercent) : 0;
            const insuranceFee = calculateInsuranceFee(editingOrder as Order, insuranceRate, settings);
            const safeAdvance = Number((editingOrder as any).advancePayment) || 0;
            
            const useCustom = compFees?.useCustomFees ?? false;
            const isCompanyBosta = editingOrder.shippingCompany ? (editingOrder.shippingCompany.toLowerCase().includes('bosta') || editingOrder.shippingCompany.includes('بوسطة') || editingOrder.shippingCompany.includes('بوسطه')) : false;
            const defaultVatRate = isCompanyBosta ? 0.14 : 0;
            const vatRate = useCustom ? (compFees?.shippingVatRate ?? defaultVatRate) : (settings.shippingVatRate ?? defaultVatRate);
            const vatBasis = useCustom ? (compFees?.vatBasis || 'shipping_only') : (settings?.vatBasis || 'shipping_only');
            const hasVat = useCustom ? (compFees?.enableVat !== false) : true;
            const insuranceValueForVat = (vatBasis === 'shipping_and_insurance' || vatBasis === 'shipping_insurance_and_cod') ? insuranceFee : 0;
            const codValueForVat = vatBasis === 'shipping_insurance_and_cod' ? calculateCodFee(editingOrder as Order, settings) : 0;
            const useStandard = editingOrder.vatOnStandardShipping === true;
            const standardShippingFee = useStandard ? getStandardShippingFee(editingOrder as Order, settings) : (editingOrder.shippingFee || 0);
            const taxableBase = standardShippingFee + inspectionFee + insuranceValueForVat + codValueForVat;
            const vatValue = hasVat ? (Math.round(taxableBase * vatRate * 100) / 100) : 0;
            
            const isMaintenanceOrder = editingOrder.orderType === 'maintenance';
            const basePrice = isMaintenanceOrder ? (Number((editingOrder as any).maintenanceCost) || 0) : (totalProductPrice - (editingOrder.discount || 0));
            const baseTotal = basePrice + editingOrder.shippingFee - safeAdvance + inspectionFee + insuranceFee + vatValue;
            const finalCollectedTotal = editingOrder.totalAmountOverride !== undefined && editingOrder.totalAmountOverride !== null
                ? Math.max(0, Math.round(Number(editingOrder.totalAmountOverride)))
                : baseTotal;

            const orderIdVal = editingOrder.id;

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

            const updatedOrder: Order = {
                ...editingOrder,
                items,
                productPrice: totalProductPrice,
                productCost: totalProductCost,
                weight: totalWeight,
                productName: productNames,
                updatedAt: new Date().toISOString(),
                totalPrice: Math.round(finalCollectedTotal),
            };

            // Track history changes
            const oldAdvance = originalOrder.advancePayment || 0;
            const newAdvance = updatedOrder.advancePayment || 0;
            const oldPartnerId = originalOrder.advancePaymentPartnerId;
            const newPartnerId = updatedOrder.advancePaymentPartnerId;
            const oldTreasuryId = originalOrder.advancePaymentTreasuryId;
            const newTreasuryId = updatedOrder.advancePaymentTreasuryId;
            const oldEmployeeId = (originalOrder as any).advancePaymentEmployeeId;
            const newEmployeeId = (updatedOrder as any).advancePaymentEmployeeId;

            const isAmountChanged = oldAdvance !== newAdvance;
            const isRecipientChanged = oldPartnerId !== newPartnerId || oldTreasuryId !== newTreasuryId || oldEmployeeId !== newEmployeeId;

            if (isAmountChanged || isRecipientChanged) {
                let rType: 'partner' | 'treasury' | 'employee' | undefined;
                let rId: string | undefined;
                if (newPartnerId) { rType = 'partner'; rId = newPartnerId; }
                else if (newTreasuryId) { rType = 'treasury'; rId = newTreasuryId; }
                else if (newEmployeeId) { rType = 'employee'; rId = newEmployeeId; }

                const newLog: AdvancePaymentHistoryLog = {
                    id: `log-${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    amount: newAdvance,
                    userId: currentUser?.phone || 'unknown',
                    userName: currentUser?.fullName || 'النظام',
                    recipientType: rType,
                    recipientId: rId,
                    recipientPhone: updatedOrder.advancePaymentRecipientPhone,
                    senderDetails: updatedOrder.advancePaymentSenderDetails,
                    action: newAdvance === 0 ? 'deleted' : (oldAdvance === 0 ? 'created' : 'updated'),
                    reason: `تعديل من صفحة تعديل الطلب (القيمة القديمة: ${oldAdvance})`
                };
                updatedOrder.advancePaymentHistory = [...(originalOrder.advancePaymentHistory || []), newLog];
            }

            // Delta Updates for Custody (Treasury, Partner, Employee)

            const senderInfo = (updatedOrder as any).advancePaymentSenderDetails ? ` | بيانات المحول: ${(updatedOrder as any).advancePaymentSenderDetails}` : '';
            const phoneInfo = (updatedOrder as any).advancePaymentRecipientPhone ? ` | هاتف المستلم: ${(updatedOrder as any).advancePaymentRecipientPhone}` : '';
            const applyNote = `تطبيق عربون معدل للطلب #${updatedOrder.orderNumber}${senderInfo}${phoneInfo}`;

            let updatedPartners = [...(settings.partners || [])];
            let updatedPartnerTxs = [...(settings.partnerTransactions || [])];
            
            let updatedHolders = [...(settings.cashHolders || [])];
            let updatedHandovers = [...(settings.cashHandovers || [])];

            // 1. Revert Old Custodian Balances
            if (oldAdvance > 0) {
                if (oldPartnerId) {
                    updatedPartners = updatedPartners.map(p => 
                        p.id === oldPartnerId ? { ...p, balance: (p.balance || 0) + oldAdvance } : p
                    );
                    updatedPartnerTxs.push({
                        id: `adv-revert-${Date.now()}`,
                        partnerId: oldPartnerId,
                        type: 'repayment',
                        amount: oldAdvance,
                        date: new Date().toISOString(),
                        note: `إلغاء/تعديل عربون سابق للطلب #${updatedOrder.orderNumber}`
                    } as any);
                } else if (oldTreasuryId && setTreasury) {
                    setTreasury((prev: any) => {
                        const currentTreasury = prev || { accounts: [], transactions: [] };
                        const accountsArr = Array.isArray(currentTreasury.accounts) ? currentTreasury.accounts : Object.values(currentTreasury.accounts || {});
                        const updatedAccounts = accountsArr.map((acc: any) => 
                            acc.id === oldTreasuryId ? { ...acc, balance: acc.balance - oldAdvance } : acc
                        );
                        const newTx = {
                            id: `tx-revert-${Date.now()}`,
                            date: new Date().toISOString(),
                            type: 'withdrawal',
                            amount: oldAdvance,
                            description: `تعديل/سحب عربون سابق للطلب #${updatedOrder.orderNumber}`,
                            fromAccountId: oldTreasuryId
                        };
                        return {
                            accounts: updatedAccounts,
                            transactions: [newTx, ...currentTreasury.transactions]
                        };
                    });
                } else if (oldEmployeeId) {
                    updatedHolders = updatedHolders.map(h => 
                        h.userId === oldEmployeeId ? { ...h, currentBalance: (h.currentBalance || 0) - oldAdvance, lastUpdated: new Date().toISOString() } : h
                    );
                }
            }

            // 2. Apply New Custodian Balances
            if (newAdvance > 0) {
                if (newPartnerId) {
                    const partner = (settings.partners || []).find(p => p.id === newPartnerId);
                    const partnerName = normalizeName(partner?.name || 'شريك');
                    
                    updatedPartners = updatedPartners.map(p => 
                        p.id === newPartnerId ? { ...p, balance: (p.balance || 0) - newAdvance } : p
                    );
                    updatedPartnerTxs.push({
                        id: `adv-apply-${Date.now()}`,
                        partnerId: newPartnerId,
                        type: 'customer_advance',
                        amount: newAdvance,
                        date: new Date().toISOString(),
                        note: applyNote
                    } as any);

                    // Record in Cash Handovers log
                    updatedHandovers.unshift({
                        id: `hd-p-${Date.now()}`,
                        fromUserId: 'customer',
                        fromUserName: updatedOrder.customerName || 'العميل',
                        toUserId: `part_${newPartnerId}`,
                        toUserName: partnerName,
                        amount: newAdvance,
                        date: new Date().toISOString(),
                        notes: applyNote,
                        status: 'completed'
                    } as any);
                } else if (newTreasuryId && setTreasury) {
                    const targetAccount = (treasury?.accounts || []).find((a: any) => a.id === newTreasuryId);
                    const accountName = normalizeName(targetAccount?.name || 'الخزينة');

                    // Record in Cash Handovers log
                    updatedHandovers.unshift({
                        id: `hd-t-${Date.now()}`,
                        fromUserId: 'customer',
                        fromUserName: updatedOrder.customerName || 'العميل',
                        toUserId: `treas_${newTreasuryId}`,
                        toUserName: accountName,
                        amount: newAdvance,
                        date: new Date().toISOString(),
                        notes: applyNote,
                        status: 'completed'
                    } as any);

                    setTreasury((prev: any) => {
                        const currentTreasury = prev || { accounts: [], transactions: [] };
                        const accountsArr = Array.isArray(currentTreasury.accounts) ? currentTreasury.accounts : Object.values(currentTreasury.accounts || {});
                        const updatedAccounts = accountsArr.map((acc: any) => 
                            acc.id === newTreasuryId ? { ...acc, balance: acc.balance + newAdvance } : acc
                        );
                        const newTx = {
                            id: `tx-apply-${Date.now()}`,
                            date: new Date().toISOString(),
                            type: 'deposit',
                            amount: newAdvance,
                            description: applyNote,
                            toAccountId: newTreasuryId
                        };
                        return {
                            accounts: updatedAccounts,
                            transactions: [newTx, ...currentTreasury.transactions]
                        };
                    });
                } else if (newEmployeeId) {
                    const empName = normalizeName(newEmployeeId === 'admin' 
                        ? 'المدير (أنت)' 
                        : (((settings.employees || []).find(e => e.id === newEmployeeId)?.name) || ((settings.partners || []).find(p => p.id === newEmployeeId)?.name) || 'المسؤول'));
                    const exists = updatedHolders.find(h => h.userId === newEmployeeId);
                    if (exists) {
                        updatedHolders = updatedHolders.map(h => 
                            h.userId === newEmployeeId ? { ...h, currentBalance: (h.currentBalance || 0) + newAdvance, lastUpdated: new Date().toISOString() } : h
                        );
                    } else {
                        updatedHolders.push({
                            userId: newEmployeeId,
                            userName: empName,
                            currentBalance: newAdvance,
                            lastUpdated: new Date().toISOString()
                        });
                    }
                    updatedHandovers.unshift({
                        id: `hd-edit-${Date.now()}`,
                        fromUserId: 'customer',
                        fromUserName: updatedOrder.customerName || 'عميل',
                        toUserId: newEmployeeId,
                        toUserName: empName,
                        amount: newAdvance,
                        date: new Date().toISOString(),
                        notes: applyNote,
                        status: 'completed'
                    } as any);
                }
            }

            // Apply to settings
            setSettings(prev => ({
                ...prev,
                partners: updatedPartners,
                partnerTransactions: updatedPartnerTxs,
                cashHolders: updatedHolders,
                cashHandovers: updatedHandovers
            }));

            // Updating Customers
            let updatedCustomersList = [...customers];
            const cleanPhone = (updatedOrder.customerPhone || '').replace(/\s/g, '').replace('+2', '');
            if (cleanPhone) {
                setCustomers(prev => {
                    const existing = prev.find(c => c.phone.replace(/\s/g, '').replace('+2', '') === cleanPhone);
                    if (existing) {
                        updatedCustomersList = prev.map(c => c.id === existing.id ? { 
                            ...c, 
                            name: updatedOrder.customerName || c.name,
                            address: updatedOrder.customerAddress || c.address,
                            governorate: updatedOrder.governorate || updatedOrder.shippingArea || c.governorate,
                            city: updatedOrder.city || c.city,
                            shippingFee: (typeof updatedOrder.shippingFee === 'number' && updatedOrder.shippingFee > 0) ? updatedOrder.shippingFee : c.shippingFee,
                            lastOrderDate: new Date().toISOString()
                        } : c);
                        return updatedCustomersList;
                    }
                    return prev;
                });
            }

            setOrders(prev => prev.map(o => o.id === orderIdVal ? updatedOrder : o));

            // Sync with forceSync using complete updated state to bypass React async delay
            const currentStoreId = activeStore?.id;
            if (forceSync && allStoresData && currentStoreId && allStoresData[currentStoreId]) {
                const storeData = allStoresData[currentStoreId];
                const updatedStoreData = {
                    ...storeData,
                    orders: (storeData.orders || []).map(o => o.id === orderIdVal ? updatedOrder : o),
                    settings: {
                        ...(storeData.settings || settings),
                        partners: updatedPartners,
                        partnerTransactions: updatedPartnerTxs,
                        cashHolders: updatedHolders,
                        cashHandovers: updatedHandovers
                    },
                    customers: updatedCustomersList
                };
                void forceSync(updatedStoreData);
            } else if (forceSync) {
                void forceSync();
            }
            
            // تشغيل صوت واحتفالات نجاح تعديل الطلب
            triggerCelebration('edit_order', settings);
            
            if (updatedOrder.orderType === 'maintenance') {
                try {
                    await syncMaintenanceStatus(updatedOrder.orderNumber, updatedOrder.status);
                } catch (mErr) {
                    console.error("Failed to sync maintenance status:", mErr);
                }
            }
        } catch (err) {
            console.error("Error inside handleUpdateOrder:", err);
        }

        navigate(activeStore ? `/store/${activeStore.id}/orders` : '/orders');
    };

    const uniqueCustomers = useMemo(() => {
        const seen = new Set();
        return customers.filter(c => {
          if (seen.has(c.phone)) return false;
          seen.add(c.phone);
          return true;
        });
    }, [customers]);

    if (!editingOrder) return <GlobalLoader />;

    return (
        <OrderForm 
            orderData={editingOrder}
            setOrderData={setEditingOrder as any}
            settings={settings}
            isEditing={true}
            customers={uniqueCustomers}
            orders={orders}
            onSubmit={handleUpdateOrder}
            onCancel={() => navigate(activeStore ? `/store/${activeStore.id}/orders` : '/orders')}
            treasury={treasury}
            allStoresData={allStoresData}
        />
    );
};

export default EditOrderPage;

