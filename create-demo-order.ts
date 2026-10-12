import { db } from "./services/firebaseClient";
import { collection, addDoc, getDocs, limit, query } from "firebase/firestore";
import { calculateOrderShippingAndFees, calculateInsuranceFee, calculateCodFee, calculateBostaVat, getLatestProductCost } from "./utils/financials";
import { INITIAL_SETTINGS } from "./constants";
import { Order, Settings } from "./types";

async function createDemoOrder() {
    console.log("--- جاري إنشاء أوردر تجريبي باستخدام المنتجات الحقيقية ---");

    // 1. الحصول على الإعدادات الحقيقية (أو استخدام الافتراضية)
    let settings = { ...INITIAL_SETTINGS };
    try {
        const settingsSnap = await getDocs(query(collection(db, "stores_data"), limit(1)));
        if (!settingsSnap.empty) {
            settings = { ...settings, ...(settingsSnap.docs[0].data().settings || {}) };
            console.log("✅ تم تحميل الإعدادات من قاعدة البيانات.");
        }
    } catch (e) {
        console.log("⚠️ فشل تحميل الإعدادات، سيتم استخدام القيم الافتراضية.");
    }

    // 2. اختيار منتج حقيقي من الداتابيز
    const productsSnap = await getDocs(query(collection(db, "products"), limit(1)));
    if (productsSnap.empty) {
        console.log("❌ لا يوجد منتجات في الداتابيز لإنشاء أوردر.");
        return;
    }
    const productData = productsSnap.docs[0].data();
    const productId = productsSnap.docs[0].id;
    console.log(`📦 المنتج المختار: ${productData.name} (سعر البيع: ${productData.price} ج.م)`);

    // 3. إعداد بيانات الأوردر
    const demoOrder: any = {
        customerName: "عميل تجريبي - نظام الأتمتة",
        customerPhone: "01000000000",
        customerAddress: "شارع التجربة، القاهرة",
        governorate: "القاهرة",
        city: "مدينة نصر",
        shippingCompany: "بوسطة",
        items: [
            {
                productId: productId,
                name: productData.name,
                price: productData.price,
                quantity: 1,
                weight: productData.weight || 0.5
            }
        ],
        isInsured: true,
        includeInspectionFee: true,
        allowOpenShipment: true,
        merchantId: "demo_merchant", // تفعيل وضع الدروب شيبنج
        status: "في_انتظار_المكالمة",
        date: new Date().toISOString(),
        orderNumber: "DEMO-" + Math.floor(Math.random() * 10000)
    };

    // 4. الحسابات التلقائية (نفس منطق الكود الجديد)
    const subtotal = demoOrder.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    
    // أ. مصاريف الشحن
    demoOrder.shippingFee = calculateOrderShippingAndFees(demoOrder as Order, settings);
    
    // ب. رسوم المعاينة
    const compFees = settings.companySpecificFees?.[demoOrder.shippingCompany!];
    demoOrder.inspectionFee = (settings.enableInspection ? settings.inspectionFee : 0);
    
    // ج. رسوم التأمين
    const insuranceRate = settings.enableInsurance ? settings.insuranceFeePercent : 0;
    demoOrder.insuranceFee = calculateInsuranceFee({ ...demoOrder, productPrice: subtotal } as any, insuranceRate, settings);
    
    // د. رسوم COD
    demoOrder.codFee = calculateCodFee(demoOrder as Order, settings);
    
    // هـ. ضريبة القيمة المضافة
    demoOrder.vatValue = calculateBostaVat(demoOrder as Order, demoOrder.insuranceFee, settings);
    
    // و. مستحقات البضاعة (Cost)
    const costPerUnit = getLatestProductCost(productId, settings);
    demoOrder.merchantItemCost = costPerUnit * demoOrder.items[0].quantity;
    
    // ز. الإجمالي النهائي
    demoOrder.totalPrice = subtotal;
    demoOrder.totalAmount = subtotal + demoOrder.shippingFee + demoOrder.inspectionFee + demoOrder.insuranceFee + demoOrder.codFee + demoOrder.vatValue;

    console.log(`✅ إجمالي المطلوب من العميل: ${demoOrder.totalAmount} ج.م`);
    console.log(`✅ مستحقات البضاعة المحسوبة تلقائياً: ${demoOrder.merchantItemCost} ج.م`);

    // 5. حفظ الأوردر في الداتابيز
    try {
        const docRef = await addDoc(collection(db, "orders"), demoOrder);
        console.log(`🚀 تم حفظ الأوردر بنجاح! ID: ${docRef.id}`);
        console.log(`رقم الأوردر: ${demoOrder.orderNumber}`);
    } catch (error) {
        console.error("❌ فشل حفظ الأوردر:", error);
    }
}

createDemoOrder().catch(console.error);
