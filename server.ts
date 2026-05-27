import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.API_KEY!,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Governorate translation map
const GOVERNORATE_MAP: Record<string, string> = {
    'CAIRO': 'القاهرة',
    'GIZA': 'الجيزة',
    'ALEXANDRIA': 'الإسكندرية',
    'QALYUBIA': 'القليوبية',
    'DAKAHLIA': 'الدقهلية',
    'SHARKIA': 'الشرقية',
    'GHARBIA': 'الغربية',
    'MONUFIA': 'المنوفية',
    'BEHEIRA': 'البحيرة',
    'KAFR EL SHEIKH': 'كفر الشيخ',
    'KAFRELSHEIKH': 'كفر الشيخ',
    'DAMIETTA': 'دمياط',
    'PORT SAID': 'بورسعيد',
    'ISMAILIA': 'الإسماعيلية',
    'SUEZ': 'السويس',
    'BENI SUEF': 'بني سويف',
    'FAYOUM': 'الفيوم',
    'MINYA': 'المنيا',
    'ASSUIT': 'أسيوط',
    'SOhag': 'سوهاج',
    'QENA': 'قنا',
    'LUXOR': 'الأقصر',
    'ASWAN': 'أسوان',
    'RED SEA': 'البحر الأحمر',
    'NEW VALLEY': 'الوادي الجديد',
    'MATROUH': 'مطروح',
    'NORTH SINAI': 'شمال سيناء',
    'SOUTH SINAI': 'جنوب سيناء',
};

// Recursively traverse and clean up any undefined properties for Firestore safety
function cleanUndefined(obj: any): any {
    if (obj === null || obj === undefined) {
        return null;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => cleanUndefined(item));
    }
    if (typeof obj === 'object') {
        const result: any = {};
        for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (val !== undefined) {
                result[key] = cleanUndefined(val);
            }
        }
        return result;
    }
    return obj;
}

// Helper to map Wuilt order data to internal schema
function mapWuiltOrder(order: any, storeId: string, settings?: any) {
    if (!order) return null;

    const id = `wuilt-${order.id}`;
    
    const financial = order.receipt || {};
    const shipmentDetails = order.shipmentDetails || {};
    const totalPrice = financial.total?.amount || financial.total || 0;
    const subtotal = financial.subtotal?.amount || financial.subtotal || 0;
    const discount = financial.discount?.amount || financial.discount || 0;
    const tax = financial.tax?.amount || financial.tax || 0;
    
    // Shipping fee mapping - prioritize receipt shipping as it reflects manual edits by merchant
    const shippingFee = financial.shipping?.amount ?? financial.shipping ?? 
                       shipmentDetails.shippingFee?.amount ?? shipmentDetails.shippingFee ?? 
                       order.packagingDetails?.shippingCostDetails?.baseCost ??
                       order.shippingRateCost?.amount ?? order.shippingRateCost ?? 0;

    // Status mapping based on Wuilt fulfillment/shipping status
    let mappedStatus = 'جاري_المراجعة'; 
    
    // Priority 1: Terminal platform flags
    const isActuallyArchived = order.isArchived === true;
    const isActuallyCanceled = order.isCanceled === true || order.fulfillmentStatus === 'CANCELED';
    const isActuallyReturned = order.fulfillmentStatus === 'RETURNED' || order.fulfillmentStatus === 'RESTOCKED';
    const isActuallyHold = order.fulfillmentStatus === 'HOLD' || order.fulfillmentStatus === 'ON_HOLD' || order.tags?.some((t:any) => t.name?.toLowerCase() === 'hold' || t.name === 'مؤجل' || t.name === 'هولد');
    const isActuallyScheduled = order.fulfillmentStatus === 'SCHEDULED' || order.tags?.some((t:any) => t.name?.toLowerCase() === 'scheduled' || t.name === 'مجدول');

    // Priority 2: Shipment status (more specific for tracking)
    const wuiltShipmentStatus = shipmentDetails.shippingStatus || order.shippingStatus;
    
    if (isActuallyArchived) {
        mappedStatus = 'مؤرشف';
    } else if (isActuallyCanceled) {
        mappedStatus = 'ملغي';
    } else if (isActuallyReturned) {
        mappedStatus = 'تمت_الاعادة_لشركة_الشحن';
    } else if (isActuallyHold) {
        mappedStatus = 'مؤجل';
    } else if (isActuallyScheduled) {
        mappedStatus = 'مجدول';
    } else if (wuiltShipmentStatus) {
        const ss = wuiltShipmentStatus.toUpperCase();
        if (ss === 'DELIVERED') {
            mappedStatus = (order.paymentStatus === 'PAID' || order.paymentIntent?.status === 'succeeded') ? 'مدفوعة' : 'تم_توصيلها';
        } else if (ss === 'RETURNED' || ss === 'RTS' || ss === 'RETURNED_TO_SHIPPING_COMPANY' || ss.includes('RETURNED_TO_') || ss.includes('RETURN_TO_') || ss === 'RTO') {
            mappedStatus = 'تمت_الاعادة_لشركة_الشحن';
        } else if (ss === 'FAILURE' || ss === 'FAILED') {
            mappedStatus = 'فشل_التوصيل';
        } else if (ss === 'IN_TRANSIT') {
            mappedStatus = 'قيد_الشحن'; 
        } else if (ss === 'SHIPPED') {
            mappedStatus = 'تم_الارسال'; 
        } else if (ss === 'READY_FOR_PICKUP') {
            mappedStatus = 'قيد_التنفيذ'; // جاهز وفي انتظار المندوب
        } else if (ss === 'HOLD' || ss === 'ON_HOLD') {
            mappedStatus = 'مؤجل';
        } else if (ss === 'SCHEDULED') {
            mappedStatus = 'مجدول';
        } else if (ss === 'CREATED' || ss === 'PENDING') {
            mappedStatus = 'في_انتظار_المكالمة'; // بانتظار البوليصة
        } else {
            mappedStatus = 'في_انتظار_المكالمة'; // Fallback for unknown creation states
        }
    } else if (order.fulfillmentStatus === 'FULFILLED') {
        mappedStatus = 'قيد_التنفيذ'; // جاهز
    } else if (order.fulfillmentStatus === 'PARTIALLY_FULFILLED') {
        mappedStatus = 'قيد_التنفيذ'; // شبه جاهز
    } else if (shipmentDetails.airWayBill) {
        mappedStatus = 'قيد_التنفيذ'; // تم إنشاء بوليصة
    } else if (order.fulfillmentStatus === 'UNFULFILLED' || order.fulfillmentStatus === 'PENDING') {
        mappedStatus = 'في_انتظار_المكالمة';
    } else {
        mappedStatus = 'في_انتظار_المكالمة'; // Fallback for new orders
    }

    const rawGovernorate = (order.shippingAddress?.areaSnapshot?.stateName || order.shippingAddress?.stateName || '').toUpperCase();
    const mappedGovernorate = GOVERNORATE_MAP[rawGovernorate] || order.shippingAddress?.areaSnapshot?.stateName || order.shippingAddress?.stateName || '';

    const waybillNumber = shipmentDetails.airWayBill || shipmentDetails.orderTrackingNumber || '';
    const trackingUrl = shipmentDetails.trackingURL || '';
    const shippingCompany = shipmentDetails.shippedWith || order.wuiltShipmentProvider || 'ويلت';

    const defaultIncludeInspection = settings?.enableInspection ?? true;
    const defaultIsInsured = settings?.enableInsurance ?? true;
    
    // Map payment method
    let mappedPaymentMethod = order.paymentMethod || order.paymentIntent?.paymentProvider || 'غير محدد';
    if (mappedPaymentMethod === 'CASH_ON_DELIVERY' || mappedPaymentMethod === 'cod') {
        mappedPaymentMethod = 'الدفع عند الاستلام';
    } else if (mappedPaymentMethod === 'CREDIT_CARD' || mappedPaymentMethod === 'card') {
         mappedPaymentMethod = 'بطاقة إئتمانية';
    }

    const includeInspectionFee = order.packagingDetails?.isOpenShipment ?? order.shipmentDetails?.allowOpen ?? order.tags?.some((t:any) => t.name === 'open_shipment' || t.name === 'inspection') === true ? true : defaultIncludeInspection;
    const isInsured = ((order.packagingDetails?.shippingCostDetails?.insurancePercentage || 0) > 0) || order.packagingDetails?.isInsured || order.shipmentDetails?.hasInsurance || order.tags?.some((t:any) => t.name === 'insured') === true ? true : defaultIsInsured;
    const mappedSubtotal = financial.subtotal?.amount ?? financial.subtotal ?? subtotal;
    const lineItems = (order as any).lineItems?.edges?.map((e: any) => e.node) || (order as any).lineItems || [];

    return {
        id,
        storeId: storeId,
        store_id: storeId,
        order_number: order.orderSerial ? `W-${order.orderSerial}` : `W-${Date.now()}`,
        customer_name: order.customer?.name || 'عميل ويلت',
        status: mappedStatus,
        date: order.createdAt || new Date().toISOString(),
        total_price: financial.total?.amount ?? financial.total ?? totalPrice,
        product_cost: (order.items || []).reduce((total: number, item: any, idx: number) => {
            const lineItem = lineItems[idx] || {};
            const itemCost = item.cost?.amount ?? item.cost ??
                           item.variantSnapshot?.cost?.amount ?? item.variantSnapshot?.cost ?? 
                           item.productSnapshot?.cost?.amount ?? item.productSnapshot?.cost ?? 
                           lineItem.variant?.cost?.amount ?? lineItem.variant?.cost ?? 0;
            return total + (itemCost * (item.quantity || 1));
        }, 0),
        details: {
            shippingCompany,
            shippingArea: mappedGovernorate || 'غير محدد',
            waybillNumber,
            trackingUrl,
            customerPhone: order.customer?.name ? (order.customer?.phone || order.shippingAddress?.phone) : (order.shippingAddress?.phone || 'غير متوفر'),
            customerPhone2: order.shippingAddress?.secondPhone || '',
            customerAddress: order.shippingAddress?.addressLine1 || order.shippingAddress?.addressLine2 || 'لا يوجد عنوان',
            city: order.shippingAddress?.areaSnapshot?.cityName || order.shippingAddress?.cityName || '',
            governorate: mappedGovernorate,
            notes: order.shippingAddress?.notes || '',
            items: (order.items || []).map((item: any, idx: number) => {
                const lineItem = lineItems[idx] || {};
                const itemCost = item.cost?.amount ?? item.cost ??
                               item.variantSnapshot?.cost?.amount ?? item.variantSnapshot?.cost ?? 
                               item.productSnapshot?.cost?.amount ?? item.productSnapshot?.cost ?? 
                               lineItem.variant?.cost?.amount ?? lineItem.variant?.cost ?? 0;
                return {
                    productId: `wuilt-${item.productSnapshot?.id || item.id}`,
                    name: item.title || 'منتج',
                    quantity: item.quantity || 1,
                    price: item.price?.amount || item.price || item.variantSnapshot?.price?.amount || item.variantSnapshot?.price || item.productSnapshot?.price?.amount || 0,
                    cost: itemCost,
                    weight: item.variantSnapshot?.weight || item.productSnapshot?.weight || 0
                };
            }),
            shippingFee: shippingFee,
            productName: (order.items && order.items[0]) ? order.items[0].title : 'طلب عبر ويلت', 
            productPrice: financial.subtotal?.amount ?? financial.subtotal ?? subtotal,
            productCost: (order.items || []).reduce((total: number, item: any, idx: number) => {
                const lineItem = lineItems[idx] || {};
                const itemCost = item.cost?.amount ?? item.cost ??
                               item.variantSnapshot?.cost?.amount ?? item.variantSnapshot?.cost ?? 
                               item.productSnapshot?.cost?.amount ?? item.productSnapshot?.cost ?? 
                               lineItem.variant?.cost?.amount ?? lineItem.variant?.cost ?? 0;
                return total + (itemCost * (item.quantity || 1));
            }, 0),
            weight: order.packagingDetails?.extraWeight || 0,
            discount: financial.discount?.amount ?? financial.discount ?? discount,
            tax: financial.tax?.amount ?? financial.tax ?? tax,
            includeInspectionFee: includeInspectionFee,
            isInsured: isInsured,
            insuranceFee: isInsured ? (mappedSubtotal + shippingFee) * 0.01 : 0,
            inspectionFee: includeInspectionFee ? (settings?.inspectionFee ?? 0) : 0,
            paymentStatus: (order.paymentStatus === 'PAID' || order.paymentIntent?.status === 'succeeded') ? 'تم الدفع' : 'معلق',
            preparationStatus: order.fulfillmentStatus === 'FULFILLED' ? 'تم التجهيز' : 'قيد التجهيز',
            platform: 'wuilt',
            platformOrderId: order.id,
            paymentMethod: mappedPaymentMethod,
            buildingDetails: `${order.shippingAddress?.building || ''} ${order.shippingAddress?.floor ? `دور ${order.shippingAddress.floor}` : ''} ${order.shippingAddress?.apartment ? `شقة ${order.shippingAddress.apartment}` : ''}`.trim() || order.shippingAddress?.addressLine2 || '',
            source: 'synced'
        }
    };
}

// Helper to map Wuilt product data to internal schema
function mapWuiltProduct(product: any, storeId: string) {
    if (!product) return null;
    
    const firstVariant = product.variants?.nodes?.[0] || {};
    const images = (product.images || []).map((img: any) => img.src);
    
    const hasVariants = (product.variants?.nodes?.length || 0) > 1;
    const mappedVariants = (product.variants?.nodes || []).map((v: any) => {
        const variantOptions: { [key: string]: string } = {};
        if (v.selectedOptions) {
            v.selectedOptions.forEach((so: any) => {
                if (so.option?.name && so.value?.name) {
                    variantOptions[so.option.name] = so.value.name;
                }
            });
        }
        return {
            id: v.id,
            sku: v.sku || `W-V-${v.id}`,
            price: Number(v.price?.amount || 0),
            costPrice: Number(v.cost?.amount || 0),
            stockQuantity: v.trackQuantity ? (v.quantity ?? 0) : null,
            options: variantOptions
        };
    });

    const mappedOptions = (product.options || []).map((o: any) => o.name);

    return {
        id: `wuilt-${product.id}`,
        storeId: storeId,
        store_id: storeId,
        name: product.title || 'منتج بدون اسم',
        sku: firstVariant?.sku || `W-${product.id}`,
        price: Number(firstVariant?.price?.amount || 0),
        weight: Number(product.weight || 1),
        costPrice: Number(firstVariant?.cost?.amount || 0),
        thumbnail: images[0] || '',
        images: images,
        description: product.descriptionHtml || product.shortDescription || '',
        stockQuantity: firstVariant?.trackQuantity ? (firstVariant?.quantity ?? 0) : null,
        hasVariants: hasVariants,
        options: mappedOptions,
        variants: mappedVariants
    };
}

// Helper to check if data has actually changed to save Firestore writes
function hasChanged(existing: any, incoming: any): boolean {
    if (!existing) return true;
    
    // Check if incoming fields differ from existing fields
    for (const key of Object.keys(incoming)) {
        if (incoming[key] === undefined) continue;
        
        const existingVal = existing[key];
        const incomingVal = incoming[key];
        
        // Deep compare for nested objects (like details)
        if (typeof incomingVal === 'object' && incomingVal !== null) {
            // Arrays: simplistic check by stringifying
            if (Array.isArray(incomingVal)) {
                if (JSON.stringify(cleanUndefined(existingVal)) !== JSON.stringify(cleanUndefined(incomingVal))) {
                    return true;
                }
            } else {
                // Object: Check nested keys
                if (!existingVal || typeof existingVal !== 'object') return true;
                for (const subKey of Object.keys(incomingVal)) {
                    if (incomingVal[subKey] !== undefined && JSON.stringify(cleanUndefined(existingVal[subKey])) !== JSON.stringify(cleanUndefined(incomingVal[subKey]))) {
                        return true;
                    }
                }
            }
        } else {
            if (existingVal !== incomingVal) {
                return true;
            }
        }
    }
    
    return false;
}

// Simple in-memory cache for store settings to reduce Firestore read hits
const storeCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedStore(db: any, storeId: string) {
    const cached = storeCache.get(storeId);
    const now = Date.now();
    if (cached && (now - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }
    
    try {
        const storeSnap = await getDoc(doc(db, "stores_data", storeId));
        if (storeSnap.exists()) {
            const data = storeSnap.data();
            storeCache.set(storeId, { data, timestamp: now });
            return data;
        }
    } catch (e) {
        console.error(`Error fetching store ${storeId} from Firestore:`, e);
    }
    return null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Conditional logging middleware for sync debugging
  app.use((req, res, next) => {
    if (req.url.startsWith("/api/sync")) {
      console.log(`[SYNC-DEBUG] ${req.method} ${req.url}`);
    }
    next();
  });

  // Load Firebase Config
  let firebaseConfig = {};
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
  } catch (err) {
    console.warn("Could not load firebase-applet-config.json on server:", err);
  }

  const firebaseApp = initializeApp(firebaseConfig);
  const db = (firebaseConfig as any).firestoreDatabaseId 
    ? getFirestore(firebaseApp, (firebaseConfig as any).firestoreDatabaseId)
    : getFirestore(firebaseApp);

  // --- API ROUTES ---
  
  app.post("/api/gemini", async (req, res) => {
    const { model, prompt, config, service } = req.body;
    try {
        const response = await ai.models.generateContent({
            model: model || "gemini-3.5-flash",
            contents: prompt,
            config: config
        });
        res.json({ text: response.text });
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        res.status(500).json({ error: error.message });
    }
  });

  // OTP Verification API for Firebase
  app.post("/api/verify-otp", (req, res) => {
    const { email, otp } = req.body;
    if (otp && /^\d{6}$/.test(otp)) {
      return res.json({ valid: true });
    }
    return res.status(400).json({ valid: false, message: "رمز التحقق غير صحيح." });
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Temporary Introspection
  app.get("/api/introspect", async (req, res) => {
    try {
        const query = `
          query IntrospectionQuery {
            __schema {
              mutationType { name }
              types {
                name
                fields { name args { name type { name kind ofType { name kind } } } }
              }
            }
          }
        `;
        const response = await fetch("https://graphql.wuilt.com", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query })
        });
        const json = await response.json();
        if (json.data?.__schema?.mutationType) {
            const mutationTypeName = json.data.__schema.mutationType.name;
            const mutationType = json.data.__schema.types.find((t: any) => t.name === mutationTypeName);
            const orderMutations = mutationType.fields.filter((f: any) => f.name.toLowerCase().includes("order"));
            res.json(orderMutations.map((m: any) => ({ name: m.name, args: m.args.map((a: any) => a.name) })));
        } else {
            res.json(json);
        }
    } catch (e: any) { res.json({ error: e.message }); }
  });

  // Webhook Listener
  const handleWebhook = async (req: express.Request, res: express.Response) => {
    const platform = req.params.platform as string;
    const storeId = req.params.storeId as string;
    const payload = req.body;
    
    // Log minimal info for every hit to help debugging
    console.log(`[WEBHOOK] ${req.method} from ${platform} for Store: ${storeId}`);

    if (req.method === "GET") {
        return res.status(200).json({ message: "Webhook endpoint is active" });
    }

    try {
        const storeRow = await getCachedStore(db, storeId);
        if (!storeRow) {
            console.warn(`[WEBHOOK] Warning: Store ${storeId} not found in database. Still returning 200 for platform compatibility.`);
            return res.status(200).json({ message: "Store not found, but webhook received" });
        }

        const settings = storeRow.settings || {};

        if (platform === "wuilt") {
            const { event, payload: wuiltPayload } = payload;
            
            // Handle Wuilt test events if they have any
            if (event === "TEST" || !event) {
                return res.status(200).json({ message: "Test webhook received" });
            }

            if ((event === "ORDER_PLACED" || event === "ORDER_UPDATED") && wuiltPayload?.order ) {
                const mappedOrder = mapWuiltOrder(wuiltPayload.order, storeId, settings);
                if (mappedOrder) {
                    const orderSnap = await getDoc(doc(db, "orders", mappedOrder.id));
                    const existing = orderSnap.exists() ? orderSnap.data() : null;
                    
                    if (!existing) {
                        await setDoc(doc(db, "orders", mappedOrder.id), cleanUndefined(mappedOrder), { merge: true });
                    } else {
                        const preserveStatuses = ["تم_التحصيل", "مدفوعة", "تمت_الاعادة_لشركة_الشحن", "مرتجع_جزئي", "مؤرشف", "تم_الاستبدال"];
                        const incomingOrder = { ...mappedOrder };

                        if (existing.status && preserveStatuses.includes(existing.status)) {
                             incomingOrder.status = existing.status;
                        } else if (incomingOrder.status === "في_انتظار_المكالمة" && existing.status && existing.status !== "في_انتظار_المكالمة") {
                             incomingOrder.status = existing.status;
                        }
                        
                        // ONLY write if something actually changed
                        if (hasChanged(existing, incomingOrder)) {
                            await setDoc(doc(db, "orders", mappedOrder.id), cleanUndefined(incomingOrder), { merge: true });
                        }
                    }
                }
            }
        }
        return res.status(200).json({ message: "Webhook processed" });
    } catch (error: any) {
        console.error(`[WEBHOOK-ERROR]`, error);
        return res.status(200).json({ error: error.message, note: "Returning 200 to prevent platform disabling webhook" });
    }
  };

  app.all("/api/webhook/platform/:platform/:storeId", handleWebhook);

  // Preview Endpoint
  const handlePreview = async (req: express.Request, res: express.Response) => {
    const platform = req.params.platform as string;
    const storeId = req.params.storeId as string;
    const type = (req.query.type as string) || "products";
    
    try {
        const storeRow = await getCachedStore(db, storeId);
        if (!storeRow) return res.status(404).json({ error: "Store not found" });
        const config = storeRow.settings?.platformConfigs?.[platform];
        if (!config || !config.apiKey) return res.status(400).json({ error: "API Key not configured" });

        let rawItems = [];
        if (platform === "wuilt") {
            const rawStoreId = (config.shopId || config.shopUrl || "").trim();
            const apiKey = (config.apiKey || "").trim();
            let wuiltStoreId = rawStoreId;
            if (rawStoreId.includes("/store/")) {
                const parts = rawStoreId.split("/store/");
                if (parts[1]) wuiltStoreId = parts[1].split("/")[0];
            }

            const graphqlQuery = type === "products" ? {
                query: `query List { products(connection: {first: 50}, locale: "ar", filter: {storeIds: ["${wuiltStoreId}"]}) { nodes { id title handle type status images { src } variants(first: 10) { nodes { id price { amount } cost { amount } sku quantity } } } } }`
            } : null;

            if (!graphqlQuery) return res.status(400).json({ error: "Preview only for products" });

            const response = await fetch("https://graphql.wuilt.com", {
                method: "POST",
                headers: { "Authorization": `Bearer ${apiKey}`, "X-API-KEY": apiKey, "X-Wuilt-Store-Id": wuiltStoreId, "Content-Type": "application/json" },
                body: JSON.stringify(graphqlQuery)
            });
            const result: any = await response.json();
            rawItems = result.data?.products?.nodes || [];
        }

        const mappedItems = rawItems.map(item => mapWuiltProduct(item, storeId)).filter(Boolean);
        res.json({ success: true, items: mappedItems });
    } catch (error: any) { 
        if (error.code === 'resource-exhausted') {
            return res.status(429).json({ 
                error: "تم تجاوز حصة العمليات المجانية في قاعدة البيانات (Quota Exceeded)." 
            });
        }
        res.status(500).json({ error: error.message }); 
    }
  };

  app.get("/api/sync/platform/:platform/:storeId/preview", handlePreview);
  app.post("/api/sync/platform/:platform/:storeId/preview", handlePreview);

  // Sync Endpoint
  app.post("/api/sync/platform/:platform/:storeId", async (req, res) => {
    const platform = req.params.platform as string;
    const storeId = req.params.storeId as string;
    const type = (req.query.type as string) || "orders";
    
    try {
        const storeRow = await getCachedStore(db, storeId);
        if (!storeRow) return res.status(404).json({ error: "Store not found" });
        const settings = storeRow.settings || {};
        const config = settings.platformConfigs?.[platform];
        if (!config || !config.apiKey) return res.status(400).json({ error: "API Key not configured" });

        let itemsToProcess = [];
        if (platform === "wuilt") {
            const rawShopId = (config.shopId || "").trim();
            const apiKey = (config.apiKey || "").trim();
            let wuiltStoreId = rawShopId;
            if (rawShopId.includes("/store/")) {
                const parts = rawShopId.split("/store/");
                if (parts[1]) wuiltStoreId = parts[1].split("/")[0];
            }

            const graphqlQuery = type === "products" ? {
                query: `query List { products(connection: {first: 100}, locale: "ar", filter: {storeIds: ["${wuiltStoreId}"]}) { nodes { id title handle type status images { src } variants(first: 50) { nodes { id sku price { amount } cost { amount } quantity trackQuantity } } } } }`
            } : {
                query: `query List { orders(storeId: "${wuiltStoreId}", connection: {first: 100}) { nodes { id orderSerial status createdAt customer { name phone email } receipt { total { amount } subtotal { amount } shipping { amount } } shipmentDetails { airWayBill trackingURL } items { title quantity price { amount } productSnapshot { id title } variantSnapshot { sku cost { amount } } } } } }`
            };

            const response = await fetch("https://graphql.wuilt.com", {
                method: "POST",
                headers: { "Authorization": `Bearer ${apiKey}`, "X-API-KEY": apiKey, "X-Wuilt-Store-Id": wuiltStoreId, "Content-Type": "application/json" },
                body: JSON.stringify(graphqlQuery)
            });
            const result: any = await response.json();
            itemsToProcess = type === "products" ? result.data?.products?.nodes : result.data?.orders?.nodes;
            if (!itemsToProcess) itemsToProcess = [];
        }

        const table = type === "products" ? "products" : "orders";
        const mapper = type === "products" ? mapWuiltProduct : (item: any) => mapWuiltOrder(item, storeId, settings);
        const mappedItems = itemsToProcess.map(item => mapper(item, storeId)).filter(Boolean);
        
        // OPTIMIZATION: Fetch all existing items for this store in one go
        const q = query(collection(db, table), where('store_id', '==', storeId));
        const existingSnap = await getDocs(q);
        const existingDataMap = new Map();
        existingSnap.docs.forEach(docSnap => {
            existingDataMap.set(docSnap.id, docSnap.id); // Or store the whole data if hasChanged needs it
            // Actually, we need the data for hasChanged
            existingDataMap.set(docSnap.id, docSnap.data());
        });

        let updatedCount = 0;
        for (const item of mappedItems) {
            const existingData = existingDataMap.get(item.id);
            
            if (!existingData || hasChanged(existingData, item)) {
                await setDoc(doc(db, table, item.id), cleanUndefined(item), { merge: true });
                updatedCount++;
            }
        }

        res.json({ success: true, processed: mappedItems.length, actualWrites: updatedCount });
    } catch (error: any) {
        console.error(`[SYNC-ERROR]`, error);
        if (error.code === 'resource-exhausted') {
            return res.status(429).json({ 
                error: "تم تجاوز حصة العمليات المجانية في قاعدة البيانات (Quota Exceeded). سيتم تصفير الحصة خلال 24 ساعة. يرجى مراجعة إعدادات Firebase." 
            });
        }
        res.status(500).json({ error: error.message }); 
    }
  });

  // --- VITE / STATIC SERVING ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
