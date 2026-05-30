import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Order, Settings, User, CustomerProfile, Store, OrderStatus } from '../types';
import { OrderForm } from './OrderForm';
import GlobalLoader from './GlobalLoader';

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
    currentUser
}) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);

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

        const normalizedItems = (order.items || []).map(item => ({
            ...item,
            productId: item.productId.startsWith('wuilt-') ? item.productId : `wuilt-${item.productId}`,
            price: (item.price === 0 && (order.items || []).length === 1 && order.productPrice > 0) ? order.productPrice : item.price
        }));

        return {
            ...order,
            governorate: mappedGov,
            shippingArea: mappedGov,
            items: normalizedItems,
            shippingFee: order.shippingFee || 0
        };
    };

    useEffect(() => {
        const order = orders.find(o => o.id === id);
        if (order) {
            setEditingOrder(normalizeSyncedOrder({ ...order }));
        } else if (orders.length > 0) {
            navigate('/orders');
        }
    }, [id, orders, navigate]);

    const handleUpdateOrder = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingOrder) return;

        const originalOrder = orders.find(o => o.id === id);
        if (!originalOrder) return;

        const isExchangeCustom = editingOrder.shipmentType === 'exchange' && editingOrder.useProductsForShipment === false;
        const isReturn = editingOrder.shipmentType === 'return';
        const isCashCollection = editingOrder.shipmentType === 'cash_collection';
        
        const items = isExchangeCustom
            ? [{
                productId: 'custom-shipment',
                name: editingOrder.shipmentDescription || 'شحنة تبديل مرسلة',
                quantity: editingOrder.shipmentQuantity || 1,
                price: editingOrder.customShipmentPrice || 0,
                cost: 0,
                weight: 1,
                thumbnail: ''
            }]
            : (isReturn ? [{
                productId: 'return-shipment',
                name: editingOrder.useProductsForReturn ? (editingOrder.returnDescription || 'طلب إرجاع شحنة') : (editingOrder.returnDescription || 'طلب إرجاع شحنة'),
                quantity: editingOrder.returnQuantity || 1,
                price: 0,
                cost: 0,
                weight: 1,
                thumbnail: editingOrder.returnImage || ''
            }] : (isCashCollection ? [{
                productId: 'cash-collection',
                name: 'طلب تحصيل نقدي',
                quantity: 1,
                price: editingOrder.customShipmentPrice || 0,
                cost: 0,
                weight: 1,
                thumbnail: ''
            }] : (editingOrder.items || [])));

        const totalProductPrice = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
        const totalProductCost = items.reduce((sum, item) => sum + (item.cost || 0) * (item.quantity || 1), 0);
        const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0) * (item.quantity || 1), 0);
        const productNames = items.map(item => item.name).join(', ');

        const updatedOrder: Order = {
            ...editingOrder,
            items,
            productPrice: totalProductPrice,
            productCost: totalProductCost,
            weight: totalWeight,
            productName: productNames,
        };

        // Delta Updates for Advance Payment
        const oldAdvance = originalOrder.advancePayment || 0;
        const newAdvance = updatedOrder.advancePayment || 0;
        const difference = newAdvance - oldAdvance;

        if (difference !== 0 && (updatedOrder as any).advancePaymentPartnerId) {
            const partnerId = (updatedOrder as any).advancePaymentPartnerId;
            const partnerTx = {
                id: `adv-edit-${Date.now()}`,
                partnerId: partnerId,
                type: difference > 0 ? 'customer_advance' : 'repayment',
                amount: Math.abs(difference),
                date: new Date().toISOString(),
                note: `تعديل عربون للطلب #${updatedOrder.orderNumber} ${difference < 0 ? '(إنقاص)' : '(زيادة)'}`
            } as any;
            
            setSettings(prev => ({
                ...prev,
                partnerTransactions: [...(prev.partnerTransactions || []), partnerTx],
                partners: (prev.partners || []).map(p => p.id === partnerId ? { ...p, balance: (p.balance || 0) - difference } : p)
            }));
        } else if (difference !== 0 && (updatedOrder as any).advancePaymentTreasuryId && setTreasury) {
            const treasuryId = (updatedOrder as any).advancePaymentTreasuryId;
            const treasuryTxId = `tx-edit-${Date.now()}`;
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
                    description: `تعديل عربون للطلب #${updatedOrder.orderNumber} ${difference < 0 ? '(استرداد)' : ''}`,
                    toAccountId: difference > 0 ? treasuryId : undefined,
                    fromAccountId: difference < 0 ? treasuryId : undefined,
                };
                return {
                    accounts: updatedAccounts,
                    transactions: [newTx, ...currentTreasury.transactions]
                };
            });
        }

        // Updating Customers
        const cleanPhone = (updatedOrder.customerPhone || '').replace(/\s/g, '').replace('+2', '');
        if (cleanPhone) {
            setCustomers(prev => {
                const existing = prev.find(c => c.phone.replace(/\s/g, '').replace('+2', '') === cleanPhone);
                if (existing) {
                    return prev.map(c => c.id === existing.id ? { 
                        ...c, 
                        name: updatedOrder.customerName || c.name,
                        address: updatedOrder.customerAddress || c.address,
                        governorate: updatedOrder.governorate || updatedOrder.shippingArea || c.governorate,
                        city: updatedOrder.city || c.city,
                        shippingFee: (typeof updatedOrder.shippingFee === 'number' && updatedOrder.shippingFee > 0) ? updatedOrder.shippingFee : c.shippingFee,
                        lastOrderDate: new Date().toISOString()
                    } : c);
                }
                return prev;
            });
        }

        setOrders(prev => prev.map(o => o.id === id ? updatedOrder : o));
        navigate('/orders');
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
            onCancel={() => navigate('/orders')}
            treasury={treasury}
        />
    );
};

export default EditOrderPage;

