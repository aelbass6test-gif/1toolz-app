import { INITIAL_SETTINGS } from './constants';
import { getLatestProductCost, calculateInsuranceFee, calculateCodFee, calculateBostaVat, calculateOrderShippingAndFees } from './utils/financials';
import { Order, OrderItem } from './types';

async function testAutomation() {
    console.log("--- محاكاة إنشاء طلب جديد للتحقق من الأتمتة ---");

    // 1. إعداد البيانات التجريبية
    const settings = { ...INITIAL_SETTINGS };
    
    // منتج تجريبي بتكلفة محددة في الكتالوج
    const mockProduct = {
        id: 'prod_123',
        name: 'تيشيرت قطني',
        sku: 'TSHIRT-001',
        price: 250,
        costPrice: 150,
        weight: 0.5
    };
    settings.products = [mockProduct as any];

    // 2. محاكاة اختيار المحافظة والشركة
    const mockOrder: Partial<Order> = {
        governorate: 'القاهرة',
        shippingCompany: 'بوسطة',
        items: [
            {
                productId: 'prod_123',
                name: 'تيشيرت قطني',
                price: 250,
                cost: 150,
                quantity: 2,
                weight: 0.5
            }
        ],
        isInsured: true,
        includeInspectionFee: true,
        allowOpenShipment: true,
        merchantId: 'merchant_001' // محاكاة نظام الدروب شيبنج
    };

    console.log(`المحافظة المختارة: ${mockOrder.governorate}`);
    console.log(`شركة الشحن: ${mockOrder.shippingCompany}`);
    console.log(`المنتجات: ${mockOrder.items![0].name} (عدد: ${mockOrder.items![0].quantity})`);

    // 3. الحسابات التلقائية (نفس المنطق الموجود في OrderForm)
    
    // أ. حساب تكلفة الشحن
    const shippingFee = calculateOrderShippingAndFees(mockOrder as Order, settings);
    console.log(`✅ مصاريف الشحن المحسوبة: ${shippingFee} ج.م`);

    // ب. حساب رسوم المعاينة
    const compFees = settings.companySpecificFees?.[mockOrder.shippingCompany!];
    const inspectionFee = settings.enableInspection ? settings.inspectionFee : 0;
    console.log(`✅ رسوم المعاينة: ${inspectionFee} ج.م`);

    // ج. حساب رسوم التأمين (1% افتراضي)
    const insuranceRate = settings.enableInsurance ? settings.insuranceFeePercent : 0;
    const subtotal = mockOrder.items!.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const insuranceFee = calculateInsuranceFee({ ...mockOrder, productPrice: subtotal } as any, insuranceRate, settings);
    console.log(`✅ رسوم التأمين (بناءً على إجمالي ${subtotal} ج.م): ${insuranceFee} ج.م`);

    // د. حساب رسوم الـ COD
    const codFee = calculateCodFee(mockOrder as Order, settings);
    console.log(`✅ رسوم الدفع عند الاستلام (COD): ${codFee} ج.م`);

    // هـ. حساب ضريبة القيمة المضافة
    const vat = calculateBostaVat(mockOrder as Order, insuranceFee, settings);
    console.log(`✅ ضريبة القيمة المضافة (VAT): ${vat} ج.م`);

    // و. حساب مستحقات البضاعة (سعر التكلفة من المخزن)
    const productCost = getLatestProductCost(mockProduct.id, settings);
    const totalMerchantGoodsDue = productCost * mockOrder.items![0].quantity;
    console.log(`✅ إجمالي مستحقات البضاعة (سعر التكلفة ${productCost} × ${mockOrder.items![0].quantity}): ${totalMerchantGoodsDue} ج.م`);

    console.log("\n--- النتيجة النهائية في ملخص الطلب ---");
    const totalAmount = subtotal + shippingFee + inspectionFee + insuranceFee + codFee + vat;
    console.log(`إجمالي المطلوب من العميل: ${totalAmount} ج.م`);
    console.log(`مستحقات التاجر/الموكل: ${totalMerchantGoodsDue} ج.م`);
    console.log(`صافي ربح المنصة (بعد خصم التكلفة والمصاريف): ${totalAmount - totalMerchantGoodsDue - shippingFee - inspectionFee - insuranceFee - codFee - vat} ج.م`);
}

testAutomation().catch(console.error);
