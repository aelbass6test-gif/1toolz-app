import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { calculateInsuranceFee, calculateBostaVat, calculateCodFee } from './utils/financials.js';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  try {
    const storesSnap = await getDocs(collection(db, 'stores_data'));
    for (const storeDoc of storesSnap.docs) {
      const storeId = storeDoc.id;
      const storeName = storeDoc.data().name;
      const settings = storeDoc.data().settings || {};

      let ordersSnap = await getDocs(query(collection(db, 'orders'), where('storeId', '==', storeId)));
      if (ordersSnap.empty) {
        ordersSnap = await getDocs(query(collection(db, 'orders'), where('store_id', '==', storeId)));
      }

      if (!ordersSnap.empty) {
        console.log(`\n======================================================`);
        console.log(`Found Store: ${storeId} - ${storeName} with ${ordersSnap.size} orders`);
        console.log(`Settings: enableInsurance: ${settings.enableInsurance}, insuranceFeePercent: ${settings.insuranceFeePercent}, insuranceBasis: ${settings.insuranceBasis}`);
        
        const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const collectedOrders = orders.filter(o => ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها'].includes(o.status));
        const failedOrders = orders.filter(o => ['مرتجع', 'فشل_التوصيل', 'مرتجع_بعد_الاستلام', 'مرتجع_جزئي', 'تمت_الاعادة_لشركة_الشحن'].includes(o.status));

        console.log("\nCOLLECTED ORDERS:");
        let totalInsCollected = 0;
        let totalInspectionCollected = 0;
        collectedOrders.forEach(order => {
          const compFees = settings.companySpecificFees?.[order.shippingCompany];
          const useCustom = compFees?.useCustomFees ?? false;
          const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
          const isPosOrder = order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر';
          const isInsured = order.isInsured ?? true;
          const insuranceFee = !isPosOrder && isInsured ? calculateInsuranceFee(order, insuranceRate, settings) : 0;
          const bostaVat = !isPosOrder && (order.shippingCompany && (order.shippingCompany.includes('bosta') || order.shippingCompany.includes('بوسطة'))) ? calculateBostaVat(order, insuranceFee, settings) : 0;
          
          let inspectionCost = !isPosOrder && (order.includeInspectionFee ?? true) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
          let inspectionAdjustment = (!isPosOrder && order.inspectionFeePaidByCustomer) ? 0 : inspectionCost;

          console.log(`Order: ${order.orderNumber}, status: ${order.status}, company: ${order.shippingCompany}, productPrice: ${order.productPrice}, shippingFee: ${order.shippingFee}, isInsured: ${isInsured}, insuranceRate: ${insuranceRate}, calcInsFee: ${insuranceFee}, calcVat: ${bostaVat}, inspectionAdjustment: ${inspectionAdjustment}`);
          totalInsCollected += insuranceFee + bostaVat;
          totalInspectionCollected += inspectionAdjustment;
        });

        console.log("\nFAILED ORDERS:");
        let totalInsFailed = 0;
        let totalInspectionFailed = 0;
        failedOrders.forEach(order => {
          const compFees = settings.companySpecificFees?.[order.shippingCompany];
          const useCustom = compFees?.useCustomFees ?? false;
          const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
          const isPosOrder = order.channel === 'pos' || order.shippingCompany === 'كاشير - بيع مباشر';
          const isInsured = order.isInsured ?? true;
          const insuranceFee = !isPosOrder && isInsured ? calculateInsuranceFee(order, insuranceRate, settings) : 0;
          const bostaVat = !isPosOrder && (order.shippingCompany && (order.shippingCompany.includes('bosta') || order.shippingCompany.includes('بوسطة'))) ? calculateBostaVat(order, insuranceFee, settings) : 0;
          
          let inspectionCost = !isPosOrder && (order.includeInspectionFee ?? true) ? (useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0)) : 0;
          let inspectionFeeCollected = (!isPosOrder && order.inspectionFeePaidByCustomer) ? inspectionCost : 0;
          let inspectionAdjustment = inspectionCost - inspectionFeeCollected;

          console.log(`Order: ${order.orderNumber}, status: ${order.status}, company: ${order.shippingCompany}, calcInsFee: ${insuranceFee}, calcVat: ${bostaVat}, inspectionAdjustment: ${inspectionAdjustment}`);
          totalInsFailed += insuranceFee + bostaVat;
          totalInspectionFailed += inspectionAdjustment;
        });

        console.log("\nTotal Insurance + VAT for collected:", totalInsCollected);
        console.log("Total Inspection for collected:", totalInspectionCollected);
        console.log("Total Insurance + VAT for failed:", totalInsFailed);
        console.log("Total Inspection for failed:", totalInspectionFailed);
      }
    }
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}
run();
