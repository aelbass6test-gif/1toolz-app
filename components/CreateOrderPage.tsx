import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Order, OrderItem, Settings, User, CustomerProfile, Store, OrderStatus } from '../types';
import { OrderForm, NewOrderState } from './OrderForm';
import { INITIAL_SETTINGS } from '../constants';
import { getLatestProductCost } from '../utils/financials';
import { OrderPreConfirmationModal } from './OrderPreConfirmationModal';
import { OrderConfirmationSummary } from './OrderConfirmationSummary';
import { triggerWebhooks } from '../utils/webhook';

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
    currentUser
}) => {
    const navigate = useNavigate();
    const location = useLocation();

    const [orderToConfirm, setOrderToConfirm] = useState<Omit<Order, 'id'> | null>(null);
    const [showSummaryModal, setShowSummaryModal] = useState<Order | null>(null);

    useEffect(() => {
        const state = location.state as { exchangeData?: any };
        if (state?.exchangeData) {
            setNewOrder(prev => ({
                ...prev,
                ...state.exchangeData
            }));
        }
    }, [location.state]);

    const [newOrder, setNewOrder] = useState<NewOrderState>({
        customerName: '',
        customerPhone: '',
        customerAddress: '',
        items: [],
        shippingCompany: Object.keys(settings.shippingOptions || {})[0] || 'بوسطة',
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
        includeInspectionFee: false,
        isInsured: true,
        source: 'manual',
    });

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
        
        const items = isExchangeCustom
            ? [{
                productId: 'custom-shipment',
                name: orderData.shipmentDescription || 'شحنة تبديل مرسلة',
                quantity: orderData.shipmentQuantity || 1,
                price: orderData.customShipmentPrice || 0,
                cost: 0,
                weight: 1,
                thumbnail: ''
            }]
            : (isReturn ? [{
                productId: 'return-shipment',
                name: orderData.useProductsForReturn ? (orderData.returnDescription || 'طلب إرجاع شحنة') : (orderData.returnDescription || 'طلب إرجاع شحنة'),
                quantity: orderData.returnQuantity || 1,
                price: 0,
                cost: 0,
                weight: 1,
                thumbnail: orderData.returnImage || ''
            }] : (isCashCollection ? [{
                productId: 'cash-collection',
                name: 'طلب تحصيل نقدي',
                quantity: 1,
                price: orderData.customShipmentPrice || 0,
                cost: 0,
                weight: 1,
                thumbnail: ''
            }] : (orderData.items || [])));
        
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
            
            orderToAdd.notes = `طلب استبدال للطلب #${orderData.originalOrderId}. تم تطبيق رصيد بقيمة ${creditAmount.toLocaleString()} ج.م.\n${orderToAdd.notes || ''}`.trim();
        }

        setOrderToConfirm(orderToAdd);
    };

    const handleConfirmAddOrder = () => {
        if (!orderToConfirm) return;
        const orderToAdd = orderToConfirm;
        const id = `order-${Date.now()}`;
        const orderWithId: Order = { ...orderToAdd, id } as Order;

        // Process Treasury / Partner updates
        const difference = orderWithId.advancePayment || 0;
        if (difference !== 0 && (orderWithId as any).advancePaymentPartnerId) {
            const partnerId = (orderWithId as any).advancePaymentPartnerId;
            const partnerTx = {
                id: `adv-${Date.now()}`,
                partnerId: partnerId,
                type: 'customer_advance',
                amount: Math.abs(difference),
                date: new Date().toISOString(),
                note: `عربون / دفع مقدم للطلب #${orderWithId.orderNumber}`
            } as any;
            
            setSettings(prev => ({
                ...prev,
                partnerTransactions: [...(prev.partnerTransactions || []), partnerTx],
                partners: (prev.partners || []).map(p => p.id === partnerId ? { ...p, balance: (p.balance || 0) - difference } : p)
            }));
        } else if (difference !== 0 && (orderWithId as any).advancePaymentTreasuryId && setTreasury) {
            const treasuryId = (orderWithId as any).advancePaymentTreasuryId;
            const treasuryTxId = `tx-${Date.now()}`;
            setTreasury((prev: any) => {
                const currentTreasury = prev || { accounts: [], transactions: [] };
                const updatedAccounts = currentTreasury.accounts.map((acc: any) => 
                    acc.id === treasuryId ? { ...acc, balance: acc.balance + difference } : acc
                );
                const newTx = {
                    id: treasuryTxId,
                    date: new Date().toISOString(),
                    type: difference > 0 ? 'deposit' : 'withdrawal',
                    amount: Math.abs(difference),
                    description: `عربون / دفع مقدم للطلب #${orderWithId.orderNumber}`,
                    toAccountId: difference > 0 ? treasuryId : undefined,
                    fromAccountId: difference < 0 ? treasuryId : undefined,
                };
                return {
                    accounts: updatedAccounts,
                    transactions: [newTx, ...currentTreasury.transactions]
                };
            });
        }

        // Customer Logic
        const cleanPhone = (orderToAdd.customerPhone || '').replace(/\s/g, '').replace('+2', '');
        if (cleanPhone) {
            setCustomers(prev => {
                const existing = prev.find(c => c.phone.replace(/\s/g, '').replace('+2', '') === cleanPhone);
                if (existing) {
                    return prev.map(c => c.id === existing.id ? { 
                        ...c, 
                        name: orderToAdd.customerName || c.name,
                        address: orderToAdd.customerAddress || c.address,
                        governorate: orderToAdd.governorate || orderToAdd.shippingArea || c.governorate,
                        city: orderToAdd.city || c.city,
                        shippingFee: (typeof orderToAdd.shippingFee === 'number' && orderToAdd.shippingFee > 0) ? orderToAdd.shippingFee : c.shippingFee,
                        lastOrderDate: new Date().toISOString()
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
                        loyaltyPoints: 0
                    };
                    return [newCustomer, ...prev];
                }
            });
        }

        // Orders update
        if (orderWithId.orderType === 'exchange' && orderWithId.originalOrderId) {
            setOrders(prevOrders => {
                const updated = prevOrders.map(o => 
                    o.id === orderWithId.originalOrderId ? { ...o, status: 'تم_الاستبدال' as OrderStatus } : o
                );
                return [orderWithId, ...updated];
            });
        } else {
            setOrders(prev => [orderWithId, ...prev]);
        }

        triggerWebhooks(orderWithId, settings);
        
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
                onCancel={() => navigate('/orders')}
                treasury={treasury}
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
                        navigate('/orders');
                    }}
                />
            )}
        </>
    );
};

export default CreateOrderPage;

