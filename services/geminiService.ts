import { GoogleGenAI, Type } from "@google/genai";
import { Order, Settings, Product, Wallet, OrderItem, User, Store } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const chatWithAI = async (message: string, settings: Settings, orders: Order[], useThinkingMode: boolean) => {
  
  const productsInfo = settings.products
    .map(p => `- ${p.name} (SKU: ${p.sku}) بسعر ${p.price}ج.م وتكلفته ${p.costPrice}ج.م`)
    .join('\n');

  const ordersContext = orders.length > 0 
  ? `بيانات الطلبات الحالية لمساعدتك في التحليل:
${JSON.stringify(orders.map(o => ({
  رقم_الطلب: o.orderNumber,
  العميل: o.customerName,
  الحالة: o.status,
  المنتجات: o.items.map(i => `${i.name} (x${i.quantity})`).join(', '),
  الاجمالي: o.productPrice + o.shippingFee - (o.discount || 0),
  التكلفة_الكلية: o.productCost,
  تاريخ: o.date,
})), null, 2)}
` 
  : 'لا توجد طلبات مسجلة حالياً.';


  const systemInstruction = `
    أنت مساعد مبيعات مصري خبير ومحلل بيانات محترف في إدارة الأوردرات. 
    مهمتك هي تحليل البيانات اللي بقدمها لك وتقديم إجابات دقيقة وموجزة.
    
    قواعد الحسابات اللي لازم تلتزم بيها تماماً (صافي الربح والخسارة):
    1. لو الأوردر "تم التحصيل" و "مؤمن":
       الربح = سعر المنتج - سعر التكلفة - رسوم التأمين (${settings.insuranceFeePercent}%) - رسوم المعاينة (${settings.inspectionFee}ج) - رسوم COD (إن وجدت).
       * ملحوظة: لو الأوردر "غير مؤمن"، لا يتم خصم رسوم التأمين.
       * ملحوظة: لو العميل دفع رسوم المعاينة، لا يتم خصمها من الربح.
    
    2. لو الأوردر "مرتجع" و "مؤمن":
       الخسارة = سعر التكلفة + رسوم التأمين (${settings.insuranceFeePercent}%) + شحن الذهاب + رسوم المعاينة (${settings.inspectionFee}ج) + شحن المرتجع (${settings.returnShippingFee}ج).
       * ملحوظة: لو الأوردر "غير مؤمن"، لا يتم إضافة رسوم التأمين للخسارة.
    
    3. حالات "جاري المراجعة"، "قيد التنفيذ"، و"ملغي": 
       ممنوع تماماً خصم أي مبالغ من المحفظة أو حساب أرباح/خسائر لهذه الحالات.

    مهامك الجديدة بناءً على البيانات:
    - لديك الآن وصول كامل لبيانات الطلبات. استخدمها للإجابة على أي سؤال تحليلي.
    - عند السؤال عن عميل معين، قم بتلخيص كل طلباته وحساب إجمالي أرباحه أو خسائره.
    - عند السؤال عن حالة معينة (مثلاً "مرتجع")، اعرض قائمة موجزة بالطلبات المتعلقة بها.
    - كن دقيقاً في حساباتك بناءً على البيانات والقواعد المذكورة.
    - لازم تذكرني دائماً بالجملة دي في كل رد: "يا فندم حضرتك ليك حق المعاينة بالكامل عند الاستلام قبل ما تدفع مليم".
    
    اللهجة: مصرية مهنية جدعة (مثلاً: "عنيا ليك يا باشا"، "كله تمام يا ريس"، "دي الحسبة بالمليم").
    
    قائمة المنتجات الحالية:
    ${productsInfo}

    ${ordersContext}
  `;

  const modelName = 'gemini-2.5-flash';
  
  const requestConfig = {
    systemInstruction: systemInstruction,
    temperature: 0.7,
    ...(useThinkingMode && { thinkingConfig: { thinkingBudget: 32768 } })
  };


  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: message,
      config: requestConfig,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "يا باشا معلش حصل مشكلة في التواصل مع المساعد، جرب كمان شوية كدة.";
  }
};

export const getAnalyticsFromAI = async (query: string, orders: Order[], settings: Settings, wallet: Wallet) => {
    // Summarize data to keep the payload small and focused
    const simplifiedOrders = orders.map(o => ({
        status: o.status,
        date: o.date.substring(0, 10),
        total: o.productPrice + o.shippingFee - (o.discount || 0),
        cost: o.productCost,
        profit: (o.status === 'تم_التحصيل') ? (o.productPrice - o.productCost) : 0, // Simplified profit
        items: o.items.map(i => ({ name: i.name, quantity: i.quantity })),
        city: o.shippingArea,
        customer: o.customerName
    }));
    const products = settings.products.map(p => ({ name: p.name, price: p.price, cost: p.costPrice, stock: p.stockQuantity }));
    const expenses = wallet.transactions.filter(t => t.type === 'سحب' && t.category?.startsWith('expense_')).map(t => ({ amount: t.amount, category: t.category, date: t.date }));

    const context = `
    أنت محلل بيانات خبير لمتجر إلكتروني، اسمك "تحليلات". مهمتك هي تحليل بيانات المتجر التالية للإجابة على سؤال المستخدم باللهجة المصرية وتقديم رسم بياني مناسب.

    **بيانات المتجر:**
    - **الطلبات:** ${JSON.stringify(simplifiedOrders)}
    - **المنتجات:** ${JSON.stringify(products)}
    - **المصروفات:** ${JSON.stringify(expenses)}

    **سؤال المستخدم:** "${query}"

    **مهمتك:**
    1.  حلل البيانات للإجابة على السؤال بدقة.
    2.  قدم إجابة نصية واضحة وموجزة باللهجة المصرية.
    3.  اقترح أفضل رسم بياني (bar, pie, line, or none) لتوضيح الإجابة.
    4.  قم بإرجاع ردك في صيغة JSON بالبنية المحددة التالية فقط لا غير.

    **قواعد الرسم البياني:**
    - استخدم "bar" للمقارنات (مثل أفضل المنتجات، المبيعات حسب المدينة).
    - استخدم "pie" للنسب المئوية (مثل توزيع حالات الطلبات).
    - يجب أن يحتوي مصفوفة 'data' على كائنات بها 'name' (نص) و 'value' (رقم).
    - إذا كان الرسم البياني غير مناسب، اضبط 'type' على 'none'.
    `;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            analysisText: { type: Type.STRING, description: "الإجابة النصية المفصلة على سؤال المستخدم باللهجة المصرية." },
            chart: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ["bar", "pie", "line", "none"], description: "نوع الرسم البياني المقترح." },
                    title: { type: Type.STRING, description: "عنوان قصير ومعبر للرسم البياني باللغة العربية." },
                    data: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING, description: "اسم العنصر على المحور (مثلاً، اسم المنتج)." },
                                value: { type: Type.NUMBER, description: "قيمة العنصر (مثلاً، عدد المبيعات)." }
                            }
                        },
                        description: "مصفوفة البيانات الخاصة بالرسم البياني."
                    }
                }
            }
        }
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: context,
            config: {
                temperature: 0.3,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            }
        });
        
        const jsonStr = response.text.trim();
        // The API should return valid JSON because of responseSchema
        return JSON.parse(jsonStr);

    } catch (error) {
        console.error("AI Analytics Error:", error);
        return {
            analysisText: "عفواً، حدث خطأ أثناء محاولة تحليل البيانات. يرجى المحاولة مرة أخرى.",
            chart: { type: 'none', title: '', data: [] }
        };
    }
};


export const generateProductDescription = async (productName: string, productPrice: number) => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `اكتب وصف تسويقي جذاب جداً باللهجة المصرية لمنتج اسمه "${productName}" وسعره ${productPrice} جنيه.
            الوصف لازم يكون:
            1. بياع وشاطر ويقنع العميل يشتري.
            2. يستخدم إيموجيز مناسبة.
            3. يركز على القيمة مقابل السعر.
            4. قصير ومقسم نقاط (Bulleted list) للمميزات.`,
            config: {
                temperature: 0.8
            }
        });
        return response.text;
    } catch (error) {
        console.error("AI Generation Error:", error);
        return "حدث خطأ أثناء توليد الوصف. يرجى المحاولة مرة أخرى.";
    }
};

export const generateShippingNote = async (customerName: string, address: string, items: OrderItem[], totalAmount: number) => {
    const itemsString = items.map(item => `${item.name} (x${item.quantity})`).join(', ');
    const prompt = `
    أنت مساعد لوجستي. قم بإنشاء ملاحظة موجزة وواضحة باللهجة المصرية لمندوب الشحن لتوضع على بوليصة الشحن.
    يجب أن تحتوي الملاحظة على المعلومات التالية بشكل منظم:
    - اسم العميل: ${customerName}
    - العنوان: ${address}
    - محتوى الشحنة: ${itemsString}
    - المبلغ المطلوب تحصيله: ${totalAmount.toLocaleString()} جنيه مصري
    - ملاحظة هامة: التأكيد على ضرورة الاتصال بالعميل قبل الوصول.
    
    اجعل النص احترافيًا ومختصرًا.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { temperature: 0.3 }
        });
        return response.text;
    } catch (error) {
        console.error("AI Shipping Note Error:", error);
        return "فشل إنشاء الملاحظة. يرجى المحاولة مرة أخرى.";
    }
};

export const generateSocialMediaPost = async (productName: string, description: string, price: number) => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `اكتب منشور تسويقي لمنصة فيسبوك باللهجة المصرية لمنتج اسمه "${productName}" وسعره ${price} جنيه.
            هذا هو وصف المنتج: "${description}".
            المنشور يجب أن يكون:
            1. جذاب ومختصر.
            2. يحتوي على إيموجيز مناسبة وهاشتاجات ذات صلة.
            3. يشجع على الشراء مع دعوة لاتخاذ إجراء (Call to Action).`,
            config: { temperature: 0.8 }
        });
        return response.text;
    } catch (error) {
        console.error("AI Generation Error:", error);
        return "حدث خطأ أثناء توليد المنشور.";
    }
};

export const generateAdCopy = async (productName: string, targetAudience: string) => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `اكتب 3 نماذج مختلفة من نصوص الإعلانات (Ad Copy) لمنصة فيسبوك لمنتج اسمه "${productName}".
            الجمهور المستهدف هو: "${targetAudience}".
            كل نموذج يجب أن يحتوي على:
            1. عنوان رئيسي جذاب (Headline).
            2. نص إعلاني أساسي (Primary Text).
            3. دعوة لاتخاذ إجراء (Call to Action).
            استخدم لهجة مصرية تسويقية قوية.`,
            config: { temperature: 0.9 }
        });
        return response.text;
    } catch (error) {
        console.error("AI Generation Error:", error);
        return "حدث خطأ أثناء توليد نصوص الإعلانات.";
    }
};

export const generateDashboardSuggestions = async (orders: Order[], products: Product[], customerData: any[]) => {
    const context = `
    أنت محلل أعمال خبير. حلل البيانات التالية وقدم 3 اقتراحات ذكية وموجزة لتحسين أداء المتجر.
    ركز على:
    1. المنتجات الأكثر مبيعاً التي على وشك النفاد (الكمية أقل من 5).
    2. العملاء المميزين (VIP) الذين لديهم عدد طلبات ناجحة كبير (أكثر من 3) أو إجمالي صرف عالي (أكثر من 5000 جنيه) واقترح مكافأتهم.
    3. المنتجات التي لا تباع جيداً واقترح عمل خصم عليها.
    
    البيانات:
    - المنتجات: ${JSON.stringify(products.map(p => ({id: p.id, name: p.name, stock: p.stockQuantity})))}
    - العملاء: ${JSON.stringify(customerData.map(c => ({name: c.name, successfulOrders: c.successfulOrders, totalSpent: c.totalSpent})))}
    - الطلبات: ${JSON.stringify(orders.map(o => ({status: o.status, items: o.items.map(i => i.productId)})))}

    قدم الاقتراحات باللهجة المصرية في شكل نقاط قصيرة جداً ومباشرة.
    `;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: context,
            config: { temperature: 0.5 }
        });
        return response.text;
    } catch (error) {
        console.error("AI Suggestions Error:", error);
        return "لا يمكن توليد اقتراحات حالياً.";
    }
};

export const searchProductsWithAI = async (query: string, products: Product[]) => {
    const context = `
    أنت مساعد تسوق ذكي. بناءً على طلب البحث التالي من العميل، ابحث في قائمة المنتجات المتاحة وأرجع قائمة بمعرفات المنتجات (product IDs) الأكثر صلة.
    
    طلب البحث: "${query}"
    
    قائمة المنتجات (اسم المنتج والوصف):
    ${JSON.stringify(products.map(p => ({id: p.id, name: p.name, description: p.description})))}
    
    الرد يجب أن يكون فقط عبارة عن مصفوفة JSON من الـ IDs. مثال: ["p1", "p5", "p3"].
    إذا لم تجد أي منتج مطابق، أرجع مصفوفة فارغة: [].
    `;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: context,
            config: { 
                temperature: 0.2, 
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });
        const jsonStr = response.text.trim();
        const parsed = JSON.parse(jsonStr);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error("AI Search Error:", error);
        return [];
    }
};
