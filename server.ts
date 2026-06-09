import { Hono } from "hono";
import { cors } from "hono/cors";
import { getRequestListener } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createServer } from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
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
  const PORT = 3000;
  const app = new Hono();

  // Debug middleware to log ALL incoming requests
  app.use("*", async (c, next) => {
    console.log(`[HONO INCOMING] ${c.req.method} ${c.req.url}`);
    await next();
  });

  app.use("/*", cors());

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
  
  app.post("/api/gemini", async (c) => {
    try {
        const { model, prompt, config, service } = await c.req.json();
        const response = await ai.models.generateContent({
            model: model || "models/gemini-1.5-flash",
            contents: prompt,
            config: config
        });
        return c.json({ text: response.text });
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        return c.json({ error: error.message }, 500);
    }
  });

  // OTP Verification API for Firebase
  app.post("/api/verify-otp", async (c) => {
    try {
      const { email, otp } = await c.req.json();
      if (otp && /^\d{6}$/.test(otp)) {
        return c.json({ valid: true });
      }
      return c.json({ valid: false, message: "رمز التحقق غير صحيح." }, 400);
    } catch (e) {
      return c.json({ valid: false, message: "خطأ في البيانات" }, 400);
    }
  });

  // Cloudflare SaaS Domain Automation Helpers
  const fetchHostnameInternal = async (hostname: string) => {
    const zoneId = process.env.CLOUDFLARE_ZONE_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    if (!zoneId || !apiToken) return null;
    try {
        const res = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames?hostname=${encodeURIComponent(hostname)}`,
            { headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" } }
        );
        const json: any = await res.json();
        return json.success && json.result?.[0] ? json.result[0] : null;
    } catch (e) {
        console.error("[DOMAIN-AUTOMATION] Fetch error:", e);
        return null;
    }
  };

  const updateStoreDomainSettings = async (storeId: string, updates: any) => {
      try {
          const storeRef = doc(db, "stores_data", storeId);
          const storeSnap = await getDoc(storeRef);
          if (storeSnap.exists()) {
              const data = storeSnap.data();
              const newSettings = cleanUndefined({
                  ...(data.settings || {}),
                  ...updates
              });
              await setDoc(storeRef, { settings: newSettings }, { merge: true });
              storeCache.set(storeId, { data: { ...data, settings: newSettings }, timestamp: Date.now() });
              return true;
          }
      } catch (e) {
          console.error(`[DOMAIN-AUTOMATION] Firestore update error for ${storeId}:`, e);
      }
      return false;
  };

  app.post("/api/domains/add", async (c) => {
    try {
      const { domain, storeId } = await c.req.json();
      
      if (!domain || !storeId) {
        return c.json({ success: false, error: "النطاق ومعرف المتجر مطلوبان" }, 400);
      }

      const cleanDomain = domain
        .replace(/^(https?:\/\/)?(www\.)?/, "")
        .replace(/\/.*$/, '')
        .replace(/[^a-zA-Z0-9.-]/g, '')
        .toLowerCase();
      const zoneId = process.env.CLOUDFLARE_ZONE_ID;
      const apiToken = process.env.CLOUDFLARE_API_TOKEN;

      if (!zoneId || !apiToken) {
        return c.json({ success: false, error: "يجب ضبط أسرار Cloudflare (API Token & Zone ID) في الإعدادات أولاً لتفعيل الأتمتة." }, 400);
      }

      console.log(`[DOMAIN-AUTOMATION] Processing custom domain: ${cleanDomain} for store: ${storeId}`);
      
      // 1. Check if hostname already exists in our zone
      let hostnameInfo = await fetchHostnameInternal(cleanDomain);

      if (!hostnameInfo) {
          // 2. Create if not exists
          const response = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames`,
            {
              method: "POST",
              headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ 
                  hostname: cleanDomain, 
                  ssl: { 
                      method: "txt", 
                      type: "dv",
                      settings: { "http2": "on", "min_tls_version": "1.2" }
                  } 
              })
            }
          );

          const data: any = await response.json();
          if (!response.ok || !data.success) {
            // "Already exists" error (1406) - This is the "Reserved" case
            if (data.errors?.[0]?.code === 1406) {
                // Try to search for it specifically to get the verification records
                hostnameInfo = await fetchHostnameInternal(cleanDomain);
                if (hostnameInfo) {
                    await updateStoreDomainSettings(storeId, { 
                        customDomain: cleanDomain, 
                        domainStatus: 'pending_validation', 
                        domainDNSRecords: hostnameInfo,
                        domainConflict: true
                    });
                    
                    return c.json({ 
                        success: true, 
                        isConflict: true,
                        message: "الدومين محجوز مسبقاً. يرجى إضافة سجلات التوثيق أدناه لإثبات ملكيتك ونقله لمتجرك.",
                        details: hostnameInfo
                    });
                } else {
                    // Hostname exists in another Cloudflare account/zone not accessible by this token
                    return c.json({ 
                        success: false, 
                        error: "هذا النطاق محجوز في حساب Cloudflare آخر. يرجى إزالته من هناك أولاً أو التواصل مع الدعم الفني.",
                        details: data.errors
                    }, 400);
                }
            }
            return c.json({ success: false, error: data.errors?.[0]?.message || "فشلت عملية إضافة النطاق" }, 400);
          }
          hostnameInfo = data.result;
      }

      // 3. Update Firestore
      const isStatusActive = hostnameInfo.status === 'active' && hostnameInfo.ssl?.status === 'active';
      const domainStatus = isStatusActive ? 'active' : 'pending_validation';
      await updateStoreDomainSettings(storeId, { 
          customDomain: cleanDomain, 
          domainStatus, 
          domainDNSRecords: hostnameInfo 
      });

      return c.json({
        success: true,
        message: domainStatus === 'active' ? "النطاق نشط ومفعل!" : "تم تسجيل النطاق، يرجى إتمام سجلات التوثيق.",
        domain: cleanDomain,
        details: hostnameInfo
      });
    } catch (err: any) {
      console.error("[DOMAIN-ADD-EXCEPTION]", err);
      return c.json({ success: false, error: "خطأ في المعالجة: " + err.message }, 500);
    }
  });

  app.post("/api/domains/status", async (c) => {
    try {
      const { domain, storeId } = await c.req.json();
      if (!domain || !storeId) return c.json({ success: false, error: "Missing data" }, 400);

      const zoneId = process.env.CLOUDFLARE_ZONE_ID;
      const apiToken = process.env.CLOUDFLARE_API_TOKEN;

      if (!zoneId || !apiToken) {
        return c.json({ success: true, simulation: true, status: "active", ssl_status: "active", domainStatus: 'active' });
      }

      const hostnameInfo = await fetchHostnameInternal(domain);
      if (!hostnameInfo) return c.json({ success: false, error: "النطاق غير موجود" }, 404);

      const isStatusActive = hostnameInfo.status === 'active' && hostnameInfo.ssl?.status === 'active';
      const domainStatus = isStatusActive ? 'active' : (hostnameInfo.status === 'pending' ? 'pending_validation' : 'error');

      await updateStoreDomainSettings(storeId, { domainStatus, domainDNSRecords: hostnameInfo });

      return c.json({ success: true, domainStatus, details: hostnameInfo });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  });

  app.post("/api/domains/delete", async (c) => {
    try {
      const { domain, storeId } = await c.req.json();
      if (!storeId) return c.json({ success: false, error: "Missing store ID" }, 400);

      const zoneId = process.env.CLOUDFLARE_ZONE_ID;
      const apiToken = process.env.CLOUDFLARE_API_TOKEN;

      // Always clear Firestore first or as part of it
      await updateStoreDomainSettings(storeId, { customDomain: null, domainStatus: null, domainDNSRecords: null });

      if (!zoneId || !apiToken || !domain) {
          return c.json({ success: true, simulation: true });
      }

      const hostInfo = await fetchHostnameInternal(domain);
      if (hostInfo && hostInfo.id) {
          await fetch(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames/${hostInfo.id}`,
            {
              method: "DELETE",
              headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" }
            }
          );
      }

      return c.json({ success: true });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  });


  // Health check
  app.get("/api/health", (c) => {
    return c.json({ status: "ok" });
  });

  // Temporary Introspection
  app.get("/api/introspect", async (c) => {
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
        const json: any = await response.json();
        if (json.data?.__schema?.mutationType) {
            const mutationTypeName = json.data.__schema.mutationType.name;
            const mutationType = json.data.__schema.types.find((t: any) => t.name === mutationTypeName);
            const orderMutations = mutationType.fields.filter((f: any) => f.name.toLowerCase().includes("order"));
            return c.json(orderMutations.map((m: any) => ({ name: m.name, args: m.args.map((a: any) => a.name) })));
        } else {
            return c.json(json);
        }
    } catch (e: any) { return c.json({ error: e.message }); }
  });

  // Webhook Listener
  app.all("/api/webhook/platform/:platform/:storeId", async (c) => {
    const platform = c.req.param("platform");
    const storeId = c.req.param("storeId");
    
    console.log(`[WEBHOOK] ${c.req.method} from ${platform} for Store: ${storeId}`);

    if (c.req.method === "GET") {
        return c.json({ message: "Webhook endpoint is active" }, 200);
    }

    try {
        const payload = await c.req.json();
        const storeRow = await getCachedStore(db, storeId);
        if (!storeRow) {
            console.warn(`[WEBHOOK] Warning: Store ${storeId} not found in database. Still returning 200 for platform compatibility.`);
            return c.json({ message: "Store not found, but webhook received" }, 200);
        }

        const settings = storeRow.settings || {};

        if (platform === "wuilt") {
            const { event, payload: wuiltPayload } = payload;
            
            if (event === "TEST" || !event) {
                return c.json({ message: "Test webhook received" }, 200);
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
        return c.json({ message: "Webhook processed" }, 200);
    } catch (error: any) {
        console.error(`[WEBHOOK-ERROR]`, error);
        return c.json({ error: error.message, note: "Returning 200 to prevent platform disabling webhook" }, 200);
    }
  });

  // Preview Endpoint
  app.all("/api/sync/platform/:platform/:storeId/preview", async (c) => {
    const platform = c.req.param("platform");
    const storeId = c.req.param("storeId");
    
    // Check if query exists before accessing
    const url = new URL(c.req.url);
    const type = url.searchParams.get("type") || "products";
    
    console.log(`[SYNC-DEBUG] ${c.req.method} /api/sync/platform/${platform}/${storeId}/preview`);

    try {
        const storeRow = await getCachedStore(db, storeId);
        if (!storeRow) return c.json({ error: "Store not found" }, 404);
        const config = storeRow.settings?.platformConfigs?.[platform];
        if (!config || !config.apiKey) return c.json({ error: "API Key not configured" }, 400);

        let rawItems: any[] = [];
        if (platform === "wuilt") {
            const rawConfigStoreId = (config.shopId || config.shopUrl || "").trim();
            const apiKey = (config.apiKey || "").trim();
            let wuiltStoreId = rawConfigStoreId;
            if (rawConfigStoreId.includes("/store/")) {
                const parts = rawConfigStoreId.split("/store/");
                if (parts[1]) wuiltStoreId = parts[1].split("/")[0];
            }

            const graphqlQuery = type === "products" ? {
                query: `query List { products(connection: {first: 50}, locale: "ar", filter: {storeIds: ["${wuiltStoreId}"]}) { nodes { id title handle type status images { src } variants(first: 10) { nodes { id price { amount } cost { amount } sku quantity } } } } }`
            } : null;

            if (!graphqlQuery) return c.json({ error: "Preview only for products" }, 400);

            const response = await fetch("https://graphql.wuilt.com", {
                method: "POST",
                headers: { "Authorization": `Bearer ${apiKey}`, "X-API-KEY": apiKey, "X-Wuilt-Store-Id": wuiltStoreId, "Content-Type": "application/json" },
                body: JSON.stringify(graphqlQuery)
            });
            const result: any = await response.json();
            rawItems = result.data?.products?.nodes || [];
        }

        const mappedItems = rawItems.map(item => mapWuiltProduct(item, storeId)).filter(Boolean);
        return c.json({ success: true, items: mappedItems });
    } catch (error: any) { 
        if (error.code === 'resource-exhausted') {
            return c.json({ 
                error: "تم تجاوز حصة العمليات المجانية في قاعدة البيانات (Quota Exceeded)." 
            }, 429);
        }
        return c.json({ error: error.message }, 500); 
    }
  });

  // Sync Endpoint
  app.post("/api/sync/platform/:platform/:storeId", async (c) => {
    const platform = c.req.param("platform");
    const storeId = c.req.param("storeId");
    const url = new URL(c.req.url);
    const type = url.searchParams.get("type") || "orders";
    
    console.log(`[SYNC-DEBUG] ${c.req.method} /api/sync/platform/${platform}/${storeId}`);

    try {
        const storeRow = await getCachedStore(db, storeId);
        if (!storeRow) return c.json({ error: "Store not found" }, 404);
        const settings = storeRow.settings || {};
        const config = settings.platformConfigs?.[platform];
        if (!config || !config.apiKey) return c.json({ error: "API Key not configured" }, 400);

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
        const mappedItems = itemsToProcess.map((item: any) => mapper(item, storeId)).filter(Boolean);
        
        const q = query(collection(db, table), where('store_id', '==', storeId));
        const existingSnap = await getDocs(q);
        const existingDataMap = new Map();
        existingSnap.docs.forEach(docSnap => {
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

        return c.json({ success: true, processed: mappedItems.length, actualWrites: updatedCount });
    } catch (error: any) {
        console.error(`[SYNC-ERROR]`, error);
        if (error.code === 'resource-exhausted') {
            return c.json({ 
                error: "تم تجاوز حصة العمليات المجانية في قاعدة البيانات (Quota Exceeded). سيتم تصفير الحصة خلال 24 ساعة. يرجى مراجعة إعدادات Firebase." 
            }, 429);
        }
        return c.json({ error: error.message }, 500); 
    }
  });

  const isProd = process.env.NODE_ENV === "production" || fs.existsSync(path.resolve(process.cwd(), "dist/index.html"));

  // Provide fallback static files for production Hono server
  if (isProd) {
    // Serve static files under dist
    app.use("/*", serveStatic({ root: "dist" }));

    // Fallback to index.html for any remaining non-API GET requests (SPA Routing Support)
    app.get("/*", async (c, next) => {
      const pathName = c.req.path;
      if (pathName.startsWith("/api/")) {
        return await next();
      }
      // Exclude asset files to prevent browser console MIME type errors
      const isAsset = /\.(js|css|png|jpg|jpeg|gif|svg|ico|json|woff|woff2|ttf|map)$/i.test(pathName);
      if (isAsset) {
        return c.text("Not Found", 404);
      }
      try {
        const htmlPath = path.resolve(process.cwd(), "dist", "index.html");
        if (fs.existsSync(htmlPath)) {
          const html = fs.readFileSync(htmlPath, "utf-8");
          return c.html(html);
        }
      } catch (e) {
        console.error("Error reading index.html fallback:", e);
      }
      return c.text("Not Found", 404);
    });
  }

  // Support Vite Dev Server
  let vite: any;
  if (!isProd) {
    vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
  }

  const honoListener = getRequestListener(app.fetch);

  const server = createServer((req, res) => {
    if (!isProd && vite) {
      if (req.url && req.url.startsWith("/api/")) {
        honoListener(req, res);
      } else {
        vite.middlewares(req, res, () => {
          honoListener(req, res);
        });
      }
    } else {
      honoListener(req, res);
    }
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Hono Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
