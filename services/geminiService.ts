import { Order, Settings, Product, OrderItem } from "../types";

const callGeminiAPI = async (prompt: string, model: string = "gemini-2.5-flash", config: any = {}) => {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        model,
        prompt,
        config
      })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const chatWithAI = async (message: string, settings: Settings, orders: Order[], useThinkingMode: boolean) => {
  const productsInfo = settings.products
    .map(p => `- ${p.name} (SKU: ${p.sku}) بسعر ${p.price}ج.م وتكلفته ${p.costPrice}ج.م`)
    .join('\n');

  const ordersContext = orders.length > 0 
    ? `بيانات الطلبات:\n${JSON.stringify(orders.map(o => ({
        رقم_الطلب: o.orderNumber,
        العميل: o.customerName,
        الحالة: o.status,
        الاجمالي: o.productPrice + o.shippingFee - (o.discount || 0),
      })), null, 2)}` 
    : 'لا توجد طلبات مسجلة حالياً.';

  const systemInstruction = `أنت مساعد مبيعات مصري خبير ومحلل بيانات محترف. لغة الرد: مصرية مهنية جدعة. الرد لازم يتضمن: "يا فندم حضرتك ليك حق المعاينة بالكامل عند الاستلام قبل ما تدفع مليم". البيانات: ${productsInfo} \n\n ${ordersContext}`;

  const config = {
    systemInstruction,
    temperature: 0.7,
    ...(useThinkingMode && { thinkingConfig: { thinkingBudget: 32768 } })
  };

  try {
    return await callGeminiAPI(message, "gemini-2.5-flash", config);
  } catch (error) {
    return "يا باشا معلش حصل مشكلة في التواصل مع المساعد، جرب كمان شوية كدة.";
  }
};

export const generateDashboardSuggestions = async (orders: Order[], products: Product[], customerData: any[]) => {
    const prompt = `أنت محلل أعمال خبير. حلل البيانات التالية وقدم 3 اقتراحات ذكية وموجزة لتحسين أداء المتجر باللهجة المصرية:
    - المنتجات: ${JSON.stringify(products.map(p => ({id: p.id, name: p.name, stock: p.stockQuantity})))}
    - العملاء: ${JSON.stringify(customerData.map(c => ({name: c.name, successfulOrders: c.successfulOrders, totalSpent: c.totalSpent})))}
    - الطلبات: ${JSON.stringify(orders.map(o => ({status: o.status, items: o.items.map(i => i.productId)})))}`;
    
    try {
        return await callGeminiAPI(prompt, "gemini-2.5-flash", { temperature: 0.5 });
    } catch (error) {
        return "لا يمكن توليد اقتراحات حالياً.";
    }
};

export const searchProductsWithAI = async (query: string, products: Product[]) => {
    const prompt = `أنت مساعد تسوق ذكي. من طلب البحث: "${query}", وأرجع JSON مصفوفة من IDs المنتجات المناسبة. ق قائمة المنتجات: ${JSON.stringify(products.map(p => ({id: p.id, name: p.name, description: p.description})))}. رد فقط بـ JSON.`;
    
    try {
        const text = await callGeminiAPI(prompt, "gemini-2.5-flash", { temperature: 0.2 });
        const jsonStr = text.trim();
        const parsed = JSON.parse(jsonStr);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
};

export const generateProductDescription = async (productName: string, productPrice: number) => {
    const prompt = `اكتب وصف تسويقي جذاب باللهجة المصرية لمنتج اسمه "${productName}" وسعره ${productPrice} جنيه.`;
    return await callGeminiAPI(prompt, "gemini-2.5-flash", { temperature: 0.8 });
};

export const generateSocialMediaPost = async (productName: string, productDescriptionOrPrice: any, productPrice?: number) => {
    let desc = "";
    let price = 0;
    if (typeof productDescriptionOrPrice === 'number') {
        price = productDescriptionOrPrice;
    } else {
        desc = productDescriptionOrPrice || "";
        price = productPrice || 0;
    }
    const prompt = `اكتب بوست فيسبوك جذاب لمنتج "${productName}" ${desc ? `وصفه: "${desc}"` : ''} ${price ? `بسعر ${price} جنيه` : ''} باللهجة المصرية مع إيموجي وهاشتاجات مناسبة وطريقة تواصل جذابة.`;
    return await callGeminiAPI(prompt, "gemini-2.5-flash", { temperature: 0.8 });
};

export const generateShippingNote = async (items: OrderItem[]) => {
    const prompt = `اكتب ملاحظة شحن ظريفة لطلبية تحتوي على: ${items.map(i => i.name).join(', ')}. باللهجة المصرية.`;
    return await callGeminiAPI(prompt, "gemini-2.5-flash", { temperature: 0.7 });
};

export const getAnalyticsFromAI = async (query: any, orders?: any, settings?: any, wallet?: any) => {
    let finalQuery = "";
    let finalOrders = orders;
    if (Array.isArray(query)) {
        finalOrders = query;
        finalQuery = "حلل بيانات الطلبات دي وقدم ملخص تقني سريع عن الأداء.";
    } else {
        finalQuery = query || "";
    }
    const prompt = `أنت مساعد ذكي ومحلل بيانات متقدم لمتجر إلكتروني.
السؤال المطلوب إجابته: "${finalQuery}"

بيانات الطلبات: ${finalOrders ? JSON.stringify(finalOrders.slice(0, 50)) : 'لا توجد'}
الحساب المالي: ${wallet ? JSON.stringify(wallet) : 'لا يوجد'}
الإعدادات: ${settings ? JSON.stringify(settings) : 'لا توجد'}

قدم إجابة باللغة العربية واضحة وتفصيلية وملهمة بناءً على هذه البيانات والتحليل المالي والطلبات.`;
    const result = await callGeminiAPI(prompt, "gemini-2.5-flash", { temperature: 0.5 });
    return {
        analysisText: result || "عذراً، لم أتمكن من إتمام التحليل.",
        chart: {
            type: 'none' as const,
            title: '',
            data: []
        }
    };
};

export const generateAdCopy = async (productName: string, targetAudienceOrPrice: any) => {
    let audText = "";
    if (typeof targetAudienceOrPrice === 'number') {
        audText = `بسعر ${targetAudienceOrPrice}`;
    } else {
        audText = targetAudienceOrPrice ? `الموجه إلى الجمهور المستهدف: "${targetAudienceOrPrice}"` : "";
    }
    const prompt = `اكتب نص إعلاني (Ads Copy) قوي لمنتج "${productName}" ${audText}. باللهجة المصرية مع هاشتاجات وإيموجي وحث قوي على اتخاذ إجراء (CTA) للشراء بروح وفكاهة مصرية.`;
    return await callGeminiAPI(prompt, "gemini-2.5-flash", { temperature: 0.9 });
};
