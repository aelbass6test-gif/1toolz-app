import React, { useState } from 'react';
import { 
  BookOpen, 
  Sparkles, 
  Copy, 
  Check, 
  Terminal, 
  ShieldCheck, 
  Cpu, 
  Layers, 
  RefreshCw, 
  ArrowRight,
  Code,
  Zap,
  Globe,
  Sliders,
  ExternalLink,
  MessageSquare
} from 'lucide-react';

interface DocWuiltGuidesTabProps {
  storeName: string;
  baseUrl: string;
  storeId: string;
  copyToClipboard: (text: string, id: string) => void;
  copiedKey: string | null;
  setActiveTab: (tab: any) => void;
}

export const DocWuiltGuidesTab: React.FC<DocWuiltGuidesTabProps> = ({
  storeName,
  baseUrl,
  storeId,
  copyToClipboard,
  copiedKey,
  setActiveTab
}) => {
  const [activeGuide, setActiveGuide] = useState<'landing-page' | 'ai-prompt' | 'context7' | 'notification-webhooks'>('landing-page');

  const landingPageCode = `// Example: Full Single-Page Cart & Checkout Integration with Wuilt GraphQL API
const WUILT_API_ENDPOINT = "${baseUrl}/api/v1/graphql";
const STORE_ID = "${storeId}";
const API_KEY = "YOUR_WUILT_API_KEY";

// 1. Add Product to Cart
async function addToWuiltCart(productId, variantId, quantity = 1) {
  const query = \`
    mutation AddToCart($input: AddToCartInput!) {
      addToCart(input: $input) {
        cart {
          id
          subtotal
          total
          itemsCount
        }
      }
    }
  \`;

  const response = await fetch(WUILT_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": \`Bearer \${API_KEY}\`,
      "x-store-id": STORE_ID
    },
    body: JSON.stringify({
      query,
      variables: {
        input: { productId, variantId, quantity }
      }
    })
  });

  const { data } = await response.json();
  return data.addToCart.cart;
}

// 2. Direct One-Click Checkout
async function checkoutOrder(cartId, customerData, addressData) {
  const query = \`
    mutation CheckoutCart($input: CheckoutCartInput!) {
      checkoutCart(input: $input) {
        order {
          id
          orderNumber
          total
          status
        }
        paymentUrl
      }
    }
  \`;

  const response = await fetch(WUILT_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": \`Bearer \${API_KEY}\`,
      "x-store-id": STORE_ID
    },
    body: JSON.stringify({
      query,
      variables: {
        input: {
          cartId,
          customer: customerData,
          shippingAddress: addressData,
          paymentMethod: "COD"
        }
      }
    })
  });

  const { data } = await response.json();
  return data.checkoutCart;
}`;

  const aiPromptText = `You are an expert Frontend Engineer and Conversion Rate Optimization (CRO) specialist.
Build a high-converting, single-product Landing Page in React, Tailwind CSS, and TypeScript integrated with the Wuilt Cart & Checkout GraphQL API.

### Store Configuration:
- Store Endpoint: ${baseUrl}/api/v1/graphql
- Store ID: ${storeId}
- Store Name: ${storeName}

### Requirements:
1. Dynamic Product Presentation:
   - Interactive variant selector (Colors, Sizes, Options).
   - Real-time pricing calculator with discount badge.
   - High-impact customer reviews, social proof counter, and countdown urgency timer.

2. Wuilt Cart & Checkout Integration:
   - Call 'AddToCart' mutation when user selects variant and clicks "اطلب الآن (الدفع عند الاستلام)".
   - Call 'ApplyPromoCode' mutation if user types a coupon.
   - Built-in simplified COD checkout form (Name, Phone number, Governorate, Delivery Address).
   - Trigger 'CheckoutCart' mutation and display animated order confirmation screen with Order Number.

3. Technical Stack:
   - React 18, Tailwind CSS, Framer Motion for micro-interactions, Lucide Icons, and TypeScript.`;

  const context7AiSchema = `// Context7 System Prompt & Schema Injection for AI Support Agents
{
  "system_instruction": "You are the AI Sales & Support Assistant for '${storeName}'. You have direct access to the Wuilt Store GraphQL API to query products, look up customer orders, calculate cart discounts, and assist with checkout.",
  "store_context": {
    "store_id": "${storeId}",
    "currency": "EGP",
    "supported_shipping_companies": ["Bosta", "Mylerz", "Aramex"],
    "payment_methods": ["COD", "Credit Card", "InstaPay", "ValU"]
  },
  "available_tools": [
    {
      "name": "search_store_products",
      "description": "Find products matching query or category in Wuilt catalog",
      "graphql_query": "query GetProducts($filter: ProductsFilterInput) { products(filter: $filter) { edges { node { id title price quantity } } } }"
    },
    {
      "name": "lookup_order_status",
      "description": "Lookup customer order status, shipment tracking, and items by phone or order number",
      "graphql_query": "query GetOrder($id: ID!) { order(id: $id) { id orderNumber status trackingUrl shippingAddress { city phone } } }"
    },
    {
      "name": "create_cod_order",
      "description": "Create instant Cash-on-Delivery order for the customer after collecting address",
      "graphql_mutation": "mutation CheckoutCart($input: CheckoutCartInput!) { checkoutCart(input: $input) { order { id orderNumber total } } }"
    }
  ]
}`;

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border border-blue-900/40 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl">
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              أدلة التكامل المتقدمة (Wuilt Guides)
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            أدلة التطوير، اللاندينج بيج، والذكاء الاصطناعي مع ويلت
          </h2>

          <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
            أدلة عملية مفصلة لبناء صفحات هبوط مخصصة بضغطة زر، برومبت الذكاء الاصطناعي لتوليد المتاجر، ربط وكلاء الذكاء الاصطناعي عبر Context7، والـ Webhooks الإشعارات اللحظية.
          </p>

          {/* Guide Selector Pills */}
          <div className="pt-2 flex flex-wrap gap-2">
            <button
              onClick={() => setActiveGuide('landing-page')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeGuide === 'landing-page'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Build Landing Page with Cart APIs</span>
            </button>

            <button
              onClick={() => setActiveGuide('ai-prompt')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeGuide === 'ai-prompt'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Prompt – Build Cart Landing Page</span>
            </button>

            <button
              onClick={() => setActiveGuide('context7')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeGuide === 'context7'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>AI Assistant Integration (Context7)</span>
            </button>

            <button
              onClick={() => setActiveGuide('notification-webhooks')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeGuide === 'notification-webhooks'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              <span>Notification Webhooks</span>
            </button>
          </div>
        </div>
      </div>

      {/* GUIDE 1: BUILD A CUSTOM LANDING PAGE */}
      {activeGuide === 'landing-page' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">دليل الربط الشامل</span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                Build a Custom Landing Page with Wuilt Cart APIs
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                كيفية بناء صفحة هبوط مستقلة فائقة السرعة مع نموذج طلب مباشر والدفع عند الاستلام المتصل بمتجر ويلت
              </p>
            </div>

            <button
              onClick={() => copyToClipboard(landingPageCode, 'landing_page_code')}
              className="px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center gap-1.5 hover:bg-blue-100 transition-all shrink-0"
            >
              {copiedKey === 'landing_page_code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              نسخ كود الربط
            </button>
          </div>

          <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
              مراحل التدفق البرمجي (Integration Flow):
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">1</span>
                <h5 className="font-bold text-slate-900 dark:text-white">إضافة المنتج إلى السلة</h5>
                <p className="text-[11px] text-slate-500">
                  عند ضغط العميل على خيار المقاس واللون، يتم استدعاء <code>addToCart</code> لإنشاء سلة برمجية وحفظ الكميات.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">2</span>
                <h5 className="font-bold text-slate-900 dark:text-white">حساب الخصم والشحن</h5>
                <p className="text-[11px] text-slate-500">
                  استدعاء <code>applyPromoCode</code> و <code>calculateCart</code> لتحديث الإجمالي الصافي قبل الدفع.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">3</span>
                <h5 className="font-bold text-slate-900 dark:text-white">إتمام وتأكيد الطلب</h5>
                <p className="text-[11px] text-slate-500">
                  إرسال بيانات الشحن عبر <code>checkoutCart</code> وتوليد رقم الطلب ومزامنته فورياً مع لوحة تحكم ويلت.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <span className="font-bold text-slate-900 dark:text-white text-xs block">كود جافاسكريبت متكامل للربط:</span>
              <div className="bg-slate-950 text-blue-300 rounded-2xl p-4 font-mono text-xs overflow-x-auto border border-slate-800" dir="ltr">
                <pre className="whitespace-pre leading-relaxed">{landingPageCode}</pre>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* GUIDE 2: AI PROMPT FOR BUILDERS */}
      {activeGuide === 'ai-prompt' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">برومبت الذكاء الاصطناعي</span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                AI Prompt – Build a Cart-Integrated Landing Page
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                انسخ هذا البرومبت المخصص وضعه في محرر الذكاء الاصطناعي (Claude / GPT-4 / Cursor / Gemini) لتوليد لاندينج بيج متكاملة فوراً
              </p>
            </div>

            <button
              onClick={() => copyToClipboard(aiPromptText, 'ai_prompt_copy')}
              className="px-3.5 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 font-bold text-xs flex items-center gap-1.5 hover:bg-purple-100 transition-all shrink-0"
            >
              {copiedKey === 'ai_prompt_copy' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              نسخ البرومبت بالكامل
            </button>
          </div>

          <div className="bg-slate-950 text-purple-300 rounded-2xl p-5 font-mono text-xs overflow-x-auto border border-slate-800 space-y-2" dir="ltr">
            <pre className="whitespace-pre-wrap leading-relaxed">{aiPromptText}</pre>
          </div>

        </div>
      )}

      {/* GUIDE 3: CONTEXT7 AI ASSISTANT INTEGRATION */}
      {activeGuide === 'context7' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">تكامل الوكلاء الأذكياء</span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                AI Assistant Integration with Context7
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                تزويد نماذج الذكاء الاصطناعي وشات بوت المبيعات بمخطط ويلت وسياق المتجر للإجابة ومتابعة الشحنات وإنشاء الطلبات آلياً
              </p>
            </div>

            <button
              onClick={() => copyToClipboard(context7AiSchema, 'context7_copy')}
              className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1.5 hover:bg-emerald-100 transition-all shrink-0"
            >
              {copiedKey === 'context7_copy' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              نسخ تهيئة Context7
            </button>
          </div>

          <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            <p>
              يتيح بروتوكول <strong>Context7</strong> ربط بوتات خدمة العملاء (مثل وكلاء GPT-4 أو Gemini أو WhatsApp Bots) مباشرة بقاعدة بيانات متجر ويلت عبر تزويد النموذج بدوال الـ Function Calling المربوطة باستعلامات الـ GraphQL:
            </p>

            <div className="bg-slate-950 text-emerald-300 rounded-2xl p-5 font-mono text-xs overflow-x-auto border border-slate-800" dir="ltr">
              <pre className="whitespace-pre leading-relaxed">{context7AiSchema}</pre>
            </div>
          </div>

        </div>
      )}

      {/* GUIDE 4: NOTIFICATION WEBHOOKS */}
      {activeGuide === 'notification-webhooks' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">الإشعارات اللحظية</span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                Notification Webhooks in Wuilt
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                استقبال إشعارات وتنبيهات الأحداث الفورية (إنشاء الطلب، تحديث الشحن، السلات المتروكة)
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-2">
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">ORDER_CREATED</span>
                <p className="text-xs text-slate-600 dark:text-slate-400">يُطلق فور تسجيل طلب جديد من قبل العميل.</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-2">
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">ORDER_STATUS_CHANGED</span>
                <p className="text-xs text-slate-600 dark:text-slate-400">يُطلق عند تغيير حالة الطلب (تأكيد، شحن، تسليم، إلغاء).</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-2">
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">ABANDONED_CART_DETECTED</span>
                <p className="text-xs text-slate-600 dark:text-slate-400">يُطلق بعد مرور 15 دقيقة على ترك العميل لسلة الشراء.</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-2">
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">INVENTORY_LOW_STOCK</span>
                <p className="text-xs text-slate-600 dark:text-slate-400">يُطلق عندما يقل رصيد مخزون أي منتج عن الحد الأدنى المحدد.</p>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
