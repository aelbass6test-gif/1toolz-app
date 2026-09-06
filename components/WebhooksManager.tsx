import React, { useState, useEffect, useMemo } from 'react';
import { 
  Webhook, Plus, Play, Check, CheckCircle2, X, Trash2, 
  Edit3, Copy, AlertCircle, Clock, Sparkles, Code, 
  ChevronDown, RefreshCw, Send, Radio, Info, Layers, 
  Zap, ArrowUpRight, History, ShoppingBag, User, Package, ShoppingCart,
  Key, Eye, EyeOff, ExternalLink, MessageSquare, ShieldCheck
} from 'lucide-react';
import { Settings, WebhookSubscription, WebhookEventType, Order, CustomerProfile, Product } from '../types';
import { 
  getStoredWebhookLogs, 
  recordWebhookDeliveryLog, 
  WebhookDeliveryLog, 
  formatRealOrderPayload, 
  formatRealCartPayload, 
  formatRealProductPayload, 
  formatRealCustomerPayload,
  triggerWebhookEvent
} from '../services/webhookDispatcherService';
import { audioSynth } from '../utils/audioSynth';

interface WebhooksManagerProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>> | ((newSettings: any) => void);
  activeStoreId?: string;
  hostUrl?: string;
  storeData?: any;
  orders?: Order[];
  customers?: CustomerProfile[];
  products?: Product[];
}

export const WEBHOOK_EVENTS: { id: WebhookEventType; label: string; description: string; category: string }[] = [
  { id: 'cart.abandoned', label: 'التخلي عن سلة التسوق', description: 'يتم إرساله عندما يغادر العميل السلة دون إتمام الشراء', category: 'السلات والمبيعات' },
  { id: 'cart.product_added', label: 'إضافة منتج إلى سلة التسوق', description: 'يتم إرساله لحظة إضافة العميل أي منتج للسلة', category: 'السلات والمبيعات' },
  { id: 'checkout.started', label: 'بدء إتمام الطلب', description: 'يتم إرساله عندما يفتح العميل شاشة ملء بيانات الشحن', category: 'السلات والمبيعات' },
  { id: 'order.completed', label: 'إتمام الطلب', description: 'يتم إرساله فور نجاح تسجيل أو تسليم الطلب النهائي', category: 'الطلبات والشحن' },
  { id: 'order.updated', label: 'تحديث الطلب', description: 'يتم إرساله عند تعديل حالة الطلب، المحتوى أو بيانات التوصيل', category: 'الطلبات والشحن' },
  { id: 'order.cancelled', label: 'إلغاء الطلب', description: 'يتم إرساله عندما يتم إلغاء الطلب من لوحة التحكم أو العميل', category: 'الطلبات والشحن' },
  { id: 'shipment.updated', label: 'تم تحديث الشحنة', description: 'يتم إرساله عند ورود تحديث جديد من شركة الشحن أو المندوب', category: 'الطلبات والشحن' },
  { id: 'customer.created', label: 'تم إنشاء العميل', description: 'يتم إرساله عند تسجيل عميل جديد بالمتجر', category: 'العملاء' },
  { id: 'customer.updated', label: 'تحديث بيانات العملاء', description: 'يتم إرساله عند تحديث هاتف أو عنوان أو بيانات العميل', category: 'العملاء' },
  { id: 'product.created', label: 'تم إنشاء المنتج', description: 'يتم إرساله عند إضافة منتج جديد في المتجر أو المخزون', category: 'المنتجات' },
  { id: 'product.updated', label: 'تم تحديث المنتج', description: 'يتم إرساله عند تعديل سعر أو كمية أو تفاصيل المنتج', category: 'المنتجات' },
  { id: 'product.deleted', label: 'حذف المنتج', description: 'يتم إرساله عند حذف منتج نهائياً من المتجر', category: 'المنتجات' },
];

export default function WebhooksManager({ 
  settings, 
  setSettings, 
  activeStoreId, 
  hostUrl,
  storeData,
  orders: passedOrders,
  customers: passedCustomers,
  products: passedProducts
}: WebhooksManagerProps) {
  // Resolve real store entities
  const availableOrders: Order[] = useMemo(() => {
    if (passedOrders && passedOrders.length > 0) return passedOrders;
    if (storeData?.orders && storeData.orders.length > 0) return storeData.orders;
    if ((settings as any)?.orders && (settings as any).orders.length > 0) return (settings as any).orders;
    return [];
  }, [passedOrders, storeData, settings]);

  const availableProducts: Product[] = useMemo(() => {
    if (passedProducts && passedProducts.length > 0) return passedProducts;
    if (storeData?.settings?.products && storeData.settings.products.length > 0) return storeData.settings.products;
    if (settings?.products && settings.products.length > 0) return settings.products;
    return [];
  }, [passedProducts, storeData, settings]);

  const availableCustomers: CustomerProfile[] = useMemo(() => {
    if (passedCustomers && passedCustomers.length > 0) return passedCustomers;
    if (storeData?.customers && storeData.customers.length > 0) return storeData.customers;
    if ((settings as any)?.customers && (settings as any).customers.length > 0) return (settings as any).customers;
    return [];
  }, [passedCustomers, storeData, settings]);

  const availableAbandonedCarts: any[] = useMemo(() => {
    if (storeData?.settings?.abandonedCarts && storeData.settings.abandonedCarts.length > 0) return storeData.settings.abandonedCarts;
    if ((settings as any)?.abandonedCarts && (settings as any).abandonedCarts.length > 0) return (settings as any).abandonedCarts;
    return [];
  }, [storeData, settings]);

  // Webhook subscriptions
  const webhooks: WebhookSubscription[] = settings.storeWebhooks || (settings.webhookIntegrations || []).map(wi => ({
    id: wi.id,
    event: 'order.completed' as WebhookEventType,
    format: 'JSON' as const,
    url: wi.webhookUrl,
    apiVersion: 'v1.0' as const,
    secretKey: wi.secretKey,
    isActive: wi.isActive,
    createdAt: new Date().toISOString()
  }));

  // Active top-level view tab
  const [mainViewTab, setMainViewTab] = useState<'webhooks' | 'logs'>('webhooks');
  const [deliveryLogs, setDeliveryLogs] = useState<WebhookDeliveryLog[]>([]);

  // Load delivery logs & listen for real-time dispatches
  useEffect(() => {
    setDeliveryLogs(getStoredWebhookLogs());

    const handleLogAdded = () => {
      setDeliveryLogs(getStoredWebhookLogs());
    };

    window.addEventListener('store_webhook_delivered', handleLogAdded);
    return () => window.removeEventListener('store_webhook_delivered', handleLogAdded);
  }, []);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWebhookId, setEditingWebhookId] = useState<string | null>(null);

  // Form State
  const [selectedEvent, setSelectedEvent] = useState<WebhookEventType>('order.completed');
  const [selectedFormat, setSelectedFormat] = useState<'JSON' | 'XML' | 'FORM'>('JSON');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [apiVersion, setApiVersion] = useState<'v1.0' | 'v2.0'>('v1.0');
  const [secretKey, setSecretKey] = useState('');
  const [webhookName, setWebhookName] = useState('');

  // REAL DATA SELECTION STATE
  const [useRealData, setUseRealData] = useState<boolean>(true);
  const [selectedRealOrderId, setSelectedRealOrderId] = useState<string>('');
  const [selectedRealProductId, setSelectedRealProductId] = useState<string>('');
  const [selectedRealCustomerId, setSelectedRealCustomerId] = useState<string>('');
  const [quickOrderNotice, setQuickOrderNotice] = useState<string | null>(null);

  // Quick action triggering state
  const [triggeringWebhookId, setTriggeringWebhookId] = useState<string | null>(null);

  // Initialize selected order / product / customer when modal opens or event changes
  useEffect(() => {
    if (availableOrders.length > 0 && !selectedRealOrderId) {
      setSelectedRealOrderId(availableOrders[0].id);
    }
    if (availableProducts.length > 0 && !selectedRealProductId) {
      setSelectedRealProductId(availableProducts[0].id);
    }
    if (availableCustomers.length > 0 && !selectedRealCustomerId) {
      setSelectedRealCustomerId(availableCustomers[0].id);
    }
  }, [availableOrders, availableProducts, availableCustomers, selectedRealOrderId, selectedRealProductId, selectedRealCustomerId]);

  // Testing State inside modal
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    statusCode?: number;
    statusText?: string;
    durationMs?: number;
    message?: string;
    error?: string;
    responseBody?: string;
    sentPayload?: any;
    isRealData?: boolean;
    isAkked?: boolean;
  } | null>(null);

  // Payload viewer drawer
  const [viewPayloadModal, setViewPayloadModal] = useState<any | null>(null);
  const [copiedState, setCopiedState] = useState<string | null>(null);
  const [activeQuickTab, setActiveQuickTab] = useState<'all' | 'orders' | 'cart' | 'customers' | 'products'>('all');
  const [showSecretKey, setShowSecretKey] = useState<boolean>(false);
  const [isVerifyingAkked, setIsVerifyingAkked] = useState<boolean>(false);
  const [akkedVerifyResult, setAkkedVerifyResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);

  const openAddModal = () => {
    setEditingWebhookId(null);
    setSelectedEvent('order.completed');
    setSelectedFormat('JSON');
    setWebhookUrl('');
    setApiVersion('v1.0');
    setSecretKey(`whsec_${Math.random().toString(36).substring(2, 12)}`);
    setWebhookName('');
    setTestResult(null);
    setAkkedVerifyResult(null);
    setUseRealData(true);
    if (availableOrders.length > 0) setSelectedRealOrderId(availableOrders[0].id);
    setIsModalOpen(true);
  };

  const openAkkedModal = () => {
    setEditingWebhookId(null);
    setSelectedEvent('order.completed');
    setSelectedFormat('JSON');
    setWebhookUrl('https://akked.app/api/v1/messages');
    setApiVersion('v1.0');
    setSecretKey('');
    setWebhookName('منصة أكد لتأكيد الطلبات عبر واتساب (Akked)');
    setTestResult(null);
    setAkkedVerifyResult(null);
    setUseRealData(true);
    if (availableOrders.length > 0) setSelectedRealOrderId(availableOrders[0].id);
    setIsModalOpen(true);
    audioSynth.playClick();
  };

  const openEditModal = (wh: WebhookSubscription) => {
    setEditingWebhookId(wh.id);
    setSelectedEvent(wh.event);
    setSelectedFormat(wh.format || 'JSON');
    setWebhookUrl(wh.url);
    setApiVersion(wh.apiVersion || 'v1.0');
    setSecretKey(wh.secretKey || '');
    setWebhookName(wh.name || '');
    setTestResult(null);
    setAkkedVerifyResult(null);
    setUseRealData(true);
    if (availableOrders.length > 0) setSelectedRealOrderId(availableOrders[0].id);
    setIsModalOpen(true);
  };

  const handleVerifyAkkedKey = async (keyToVerify: string) => {
    if (!keyToVerify || !keyToVerify.trim()) {
      setAkkedVerifyResult({ success: false, message: 'يرجى إدخال مفتاح Akked API Key أولاً (يبدأ بـ ak_live_)' });
      audioSynth.playAlarm();
      return;
    }
    setIsVerifyingAkked(true);
    setAkkedVerifyResult(null);
    try {
      const res = await fetch('/api/v1/akked/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyToVerify.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAkkedVerifyResult({
          success: true,
          message: data.message || 'تم التحقق بنجاح من حسابك في منصة أكد!',
          details: data.data
        });
        audioSynth.playSuccess();
      } else {
        setAkkedVerifyResult({
          success: false,
          message: data.error || 'فشل التحقق من مفتاح API',
          details: data.details
        });
        audioSynth.playAlarm();
      }
    } catch (err: any) {
      setAkkedVerifyResult({ success: false, message: err.message || 'خطأ في الاتصال بخادم أكد' });
      audioSynth.playAlarm();
    } finally {
      setIsVerifyingAkked(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTestResult(null);
    setAkkedVerifyResult(null);
    setEditingWebhookId(null);
  };

  /**
   * Helper to build the real payload object for the currently selected event
   */
  const getSelectedRealPayload = () => {
    // 1. Order Events
    if (selectedEvent.startsWith('order.') || selectedEvent === 'shipment.updated') {
      const order = availableOrders.find(o => o.id === selectedRealOrderId) || availableOrders[0];
      if (order) {
        return formatRealOrderPayload(order, settings);
      }
      // If no orders exist yet in the store, synthesize a rich realistic Egyptian order
      return {
        order_id: 'ord_live_demo',
        order_number: 'ORD-1001',
        customer_name: 'أحمد محمود كمال',
        customer_phone: '01012345678',
        phone: '01012345678',
        customer_address: 'شارع النصر، المعادي، القاهرة',
        address: 'شارع النصر، المعادي، القاهرة',
        governorate: 'القاهرة',
        city: 'المعادي',
        total_price: 650,
        total: 650,
        shipping_fee: 50,
        status: selectedEvent === 'order.cancelled' ? 'ملغي' : 'تم_التأكيد',
        items: [
          { product_id: 'p1', name: availableProducts[0]?.name || 'ساعة يد ذكية Pro', quantity: 1, price: 600, total: 600 }
        ],
        notes: 'يرجى الاتصال قبل التوصيل',
        payment_method: 'الدفع عند الاستلام'
      };
    }

    // 2. Cart Events
    if (selectedEvent.startsWith('cart.') || selectedEvent === 'checkout.started') {
      const cart = availableAbandonedCarts[0];
      if (cart) {
        return formatRealCartPayload(cart, settings);
      }
      const prod = availableProducts.find(p => p.id === selectedRealProductId) || availableProducts[0];
      return {
        cart_id: `cart_${Date.now()}`,
        customer_name: 'محمد عبدالله',
        customer_phone: '01122334455',
        phone: '01122334455',
        items: [
          {
            product_id: prod?.id || 'prod_1',
            name: prod?.name || 'سماعات بلوتوث عازلة للضوضاء',
            price: prod?.price || 450,
            quantity: 1
          }
        ],
        estimated_total: prod?.price || 450,
        currency: 'EGP'
      };
    }

    // 3. Customer Events
    if (selectedEvent.startsWith('customer.')) {
      const customer = availableCustomers.find(c => c.id === selectedRealCustomerId) || availableCustomers[0];
      if (customer) {
        return formatRealCustomerPayload(customer, settings);
      }
      return {
        customer_id: 'cust_real_1',
        name: 'كريم طارق حسن',
        phone: '01234567890',
        governorate: 'الجيزة',
        city: 'الدقي',
        address: 'ميدان المساحة، الدقي'
      };
    }

    // 4. Product Events
    if (selectedEvent.startsWith('product.')) {
      const product = availableProducts.find(p => p.id === selectedRealProductId) || availableProducts[0];
      if (product) {
        return formatRealProductPayload(product, settings);
      }
      return {
        product_id: 'prd_sample',
        name: 'قميص قطن بريميوم رجالي',
        sku: 'SHIRT-COTTON-01',
        price: 350,
        stock_quantity: 25
      };
    }

    return null;
  };

  /**
   * Quick order generator when the store has no orders yet
   */
  const handleGenerateRealOrder = () => {
    const prod = availableProducts[0];
    const newRealOrder: Order = {
      id: `ord_${Date.now()}`,
      orderNumber: `${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: 'أحمد محمود كمال',
      customerPhone: '01012345678',
      customerAddress: 'شارع النصر، المعادي، القاهرة',
      governorate: 'القاهرة',
      shippingArea: 'القاهرة',
      city: 'المعادي',
      totalPrice: (prod?.price || 450) + 50,
      productPrice: prod?.price || 450,
      productCost: (prod as any)?.cost || 200,
      productName: prod?.name || 'سماعات بلوتوث عازلة للضوضاء Pro',
      shippingFee: 50,
      weight: (prod as any)?.weight || 0.5,
      discount: 0,
      shippingCompany: 'بوسطة (Bosta)',
      status: 'قيد_التنفيذ',
      paymentStatus: 'بانتظار الدفع',
      preparationStatus: 'بانتظار التجهيز',
      paymentMethod: 'الدفع عند الاستلام',
      date: new Date().toISOString(),
      items: [
        {
          productId: prod?.id || 'prod_1',
          name: prod?.name || 'سماعات بلوتوث عازلة للضوضاء Pro',
          price: prod?.price || 450,
          quantity: 1,
          cost: (prod as any)?.cost || 200,
          weight: (prod as any)?.weight || 0.5
        }
      ]
    };

    if (storeData && Array.isArray(storeData.orders)) {
      storeData.orders.unshift(newRealOrder);
    }
    setSelectedRealOrderId(newRealOrder.id);
    setQuickOrderNotice('تم إضافة طلب حقيقي جديد للمتجر بنجاح للاختبار!');
    setTimeout(() => setQuickOrderNotice(null), 3000);
  };

  /**
   * Test Webhook Button Handler
   */
  const handleTestWebhook = async (urlToTest?: string, eventToTest?: WebhookEventType, forcedRealPayload?: any) => {
    const targetUrl = urlToTest || webhookUrl;
    const targetEvent = eventToTest || selectedEvent;

    if (!targetUrl || !targetUrl.trim()) {
      setTestResult({
        success: false,
        error: 'يرجى إدخال رابط الـ Webhook أولاً لإجراء الفحص التجريبي'
      });
      return;
    }

    // If target is direct messages endpoint (/api/v1/messages) and no key is provided, inform user, but do not strictly block if they are testing a webhook endpoint
    const isDirectAkkedApi = targetUrl.toLowerCase().includes('akked.app/api/v1/messages');
    if (isDirectAkkedApi && (!secretKey || !secretKey.trim())) {
      setTestResult({
        success: false,
        error: 'يتطلب مسار API المباشر (/api/v1/messages) إدخال مفتاح API Key (يبدأ بـ ak_live_). إذا كنت تستخدم رابط Webhook من أكد، يمكنك استخدامه مباشرة دون مفتاح.'
      });
      audioSynth.playAlarm();
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const realDataPayload = forcedRealPayload || (useRealData ? getSelectedRealPayload() : null);

    try {
      const res = await fetch('/api/v1/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl.trim(),
          event: targetEvent,
          format: selectedFormat,
          apiVersion: apiVersion,
          secretKey: secretKey || undefined,
          realData: realDataPayload
        })
      });

      const data = await res.json();
      setTestResult({
        ...data,
        isRealData: !!realDataPayload
      });

      // Play audio feedback
      if (data.success) {
        audioSynth.playSuccess();
      } else {
        audioSynth.playAlarm();
      }

      // Record in live logs
      recordWebhookDeliveryLog({
        id: `test_${Date.now()}`,
        eventId: data.sentPayload?.event_id || `evt_${Date.now()}`,
        event: targetEvent,
        url: targetUrl.trim(),
        statusCode: data.statusCode,
        statusText: data.statusText,
        success: data.success,
        durationMs: data.durationMs,
        error: data.error,
        timestamp: new Date().toISOString(),
        payloadSummary: {
          orderNumber: realDataPayload?.order_number || realDataPayload?.orderNumber,
          customerName: realDataPayload?.customer_name || realDataPayload?.customerName,
          customerPhone: realDataPayload?.customer_phone || realDataPayload?.customerPhone,
          totalPrice: realDataPayload?.total_price || realDataPayload?.totalPrice,
          productName: realDataPayload?.name || realDataPayload?.product_name
        },
        fullPayload: data.sentPayload
      });

      // If testing an existing webhook from table, update its status
      if (editingWebhookId) {
        updateWebhookInState(editingWebhookId, {
          lastTriggeredAt: new Date().toISOString(),
          lastStatusCode: data.statusCode || (data.success ? 200 : 500),
          lastStatusText: data.statusText || (data.success ? 'OK' : 'Error')
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message || 'فشل الاتصال بخادم إرسال الويب هوك'
      });
      audioSynth.playAlarm();
    } finally {
      setIsTesting(false);
    }
  };

  /**
   * Quick trigger real event directly from the list table
   */
  const handleQuickTriggerRealEvent = async (wh: WebhookSubscription) => {
    setTriggeringWebhookId(wh.id);
    audioSynth.playClick();

    // Prepare real payload
    const order = availableOrders[0];
    const prod = availableProducts[0];
    let realData: any = null;

    if (wh.event.startsWith('order.') || wh.event === 'shipment.updated') {
      realData = order ? formatRealOrderPayload(order, settings) : {
        order_id: 'ord_real_sample',
        order_number: 'ORD-1002',
        customer_name: 'أحمد محمود كمال',
        customer_phone: '01012345678',
        phone: '01012345678',
        customer_address: 'المعادي، القاهرة',
        address: 'المعادي، القاهرة',
        governorate: 'القاهرة',
        total_price: 650,
        status: wh.event === 'order.cancelled' ? 'ملغي' : 'تم_التأكيد',
        items: [{ name: prod?.name || 'سماعات بلوتوث', price: 600, quantity: 1 }]
      };
    } else if (wh.event.startsWith('cart.')) {
      realData = {
        cart_id: `cart_${Date.now()}`,
        customer_name: 'محمود حسن',
        customer_phone: '01223344556',
        items: [{ name: prod?.name || 'منتج المتجر', price: prod?.price || 350, quantity: 1 }],
        estimated_total: prod?.price || 350
      };
    }

    try {
      const res = await fetch('/api/v1/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: wh.url,
          event: wh.event,
          format: wh.format || 'JSON',
          apiVersion: wh.apiVersion || 'v1.0',
          secretKey: wh.secretKey,
          realData
        })
      });

      const data = await res.json();
      if (data.success) {
        audioSynth.playSuccess();
      } else {
        audioSynth.playAlarm();
      }

      updateWebhookInState(wh.id, {
        lastTriggeredAt: new Date().toISOString(),
        lastStatusCode: data.statusCode || (data.success ? 200 : 500),
        lastStatusText: data.statusText || (data.success ? 'OK' : 'Error')
      });

      recordWebhookDeliveryLog({
        id: `dispatch_${Date.now()}`,
        eventId: data.sentPayload?.event_id || `evt_${Date.now()}`,
        event: wh.event,
        url: wh.url,
        statusCode: data.statusCode,
        statusText: data.statusText,
        success: data.success,
        durationMs: data.durationMs,
        error: data.error,
        timestamp: new Date().toISOString(),
        payloadSummary: {
          orderNumber: realData?.order_number || realData?.orderNumber,
          customerName: realData?.customer_name || realData?.customerName,
          customerPhone: realData?.customer_phone || realData?.customerPhone,
          totalPrice: realData?.total_price || realData?.totalPrice
        },
        fullPayload: data.sentPayload
      });
    } catch (e: any) {
      console.error('Quick trigger error:', e);
      audioSynth.playAlarm();
    } finally {
      setTriggeringWebhookId(null);
    }
  };

  const handleSaveWebhook = () => {
    if (!webhookUrl || !webhookUrl.trim()) {
      alert('يرجى كتابة رابط الـ Webhook المستهدف');
      return;
    }

    const isAkked = webhookUrl.toLowerCase().includes('akked.app');
    const finalUrl = isAkked && (webhookUrl.includes('/docs') || webhookUrl.endsWith('akked.app') || webhookUrl.endsWith('akked.app/'))
      ? 'https://akked.app/api/v1/messages'
      : webhookUrl.trim();

    const eventObj = WEBHOOK_EVENTS.find(e => e.id === selectedEvent);
    const resolvedName = webhookName.trim() || (isAkked ? 'منصة أكد (Akked WhatsApp)' : (eventObj?.label || 'Webhook'));

    let updatedList: WebhookSubscription[];

    if (editingWebhookId) {
      updatedList = webhooks.map(wh => {
        if (wh.id === editingWebhookId) {
          return {
            ...wh,
            name: resolvedName,
            event: selectedEvent,
            format: selectedFormat,
            url: finalUrl,
            apiVersion,
            secretKey: secretKey || wh.secretKey,
            lastStatusCode: testResult?.statusCode || wh.lastStatusCode,
            lastStatusText: testResult?.statusText || wh.lastStatusText,
            lastTriggeredAt: testResult ? new Date().toISOString() : wh.lastTriggeredAt
          };
        }
        return wh;
      });
    } else {
      const newWebhook: WebhookSubscription = {
        id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: resolvedName,
        event: selectedEvent,
        format: selectedFormat,
        url: finalUrl,
        apiVersion,
        secretKey: secretKey || `whsec_${Math.random().toString(36).substring(2, 12)}`,
        isActive: true,
        createdAt: new Date().toISOString(),
        lastStatusCode: testResult?.statusCode,
        lastStatusText: testResult?.statusText,
        lastTriggeredAt: testResult ? new Date().toISOString() : undefined
      };
      updatedList = [newWebhook, ...webhooks];
    }

    saveWebhooksToSettings(updatedList, isAkked ? { key: secretKey, url: finalUrl } : undefined);
    audioSynth.playSuccess();
    closeModal();
  };

  const saveWebhooksToSettings = (list: WebhookSubscription[], akkedInfo?: { key?: string; url?: string }) => {
    if (typeof setSettings === 'function') {
      setSettings((prev: any) => {
        const nextSettings = {
          ...prev,
          storeWebhooks: list,
          webhookIntegrations: list.map(wh => ({
            id: wh.id,
            storeUrl: '',
            webhookUrl: wh.url,
            secretKey: wh.secretKey || '',
            isActive: wh.isActive
          }))
        };

        if (akkedInfo) {
          nextSettings.akkedIntegration = {
            enabled: true,
            apiKey: akkedInfo.key || prev.akkedIntegration?.apiKey || '',
            apiUrl: akkedInfo.url || 'https://akked.app/api/v1/messages',
            orderConfirmationTemplate: 'order_confirmation',
            autoSendOnOrderCreated: true,
            status: akkedInfo.key ? 'connected' : 'disconnected',
            lastSyncTime: new Date().toISOString()
          };
        }

        return nextSettings;
      });
    }
  };

  const updateWebhookInState = (id: string, patch: Partial<WebhookSubscription>) => {
    const updated = webhooks.map(w => w.id === id ? { ...w, ...patch } : w);
    saveWebhooksToSettings(updated);
  };

  const toggleWebhookActive = (id: string) => {
    const target = webhooks.find(w => w.id === id);
    if (!target) return;
    updateWebhookInState(id, { isActive: !target.isActive });
    audioSynth.playClick();
  };

  const handleDeleteWebhook = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الـ Webhook نهائياً؟')) {
      const updated = webhooks.filter(w => w.id !== id);
      saveWebhooksToSettings(updated);
      audioSynth.playClick();
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedState(id);
    setTimeout(() => setCopiedState(null), 2000);
  };

  const filteredWebhooks = webhooks.filter(wh => {
    if (activeQuickTab === 'all') return true;
    if (activeQuickTab === 'orders') return wh.event.startsWith('order.') || wh.event.startsWith('shipment.');
    if (activeQuickTab === 'cart') return wh.event.startsWith('cart.') || wh.event.startsWith('checkout.');
    if (activeQuickTab === 'customers') return wh.event.startsWith('customer.');
    if (activeQuickTab === 'products') return wh.event.startsWith('product.');
    return true;
  });

  // Active selected order object for real preview
  const currentOrder = useMemo(() => {
    return availableOrders.find(o => o.id === selectedRealOrderId) || availableOrders[0];
  }, [availableOrders, selectedRealOrderId]);

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100 font-sans" dir="rtl">
      
      {/* Header & Concept Explanation */}
      <div className="bg-gradient-to-l from-indigo-950 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-300 text-xs font-semibold backdrop-blur-sm border border-emerald-400/20">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>إشعارات الأحداث الحقيقية (Real-Time Live Webhooks)</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3 text-white">
              <Webhook className="w-8 h-8 text-indigo-400 animate-pulse" />
              نظام إشعارات الـ Webhooks
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              <strong>الـ Webhooks</strong> هي أداة متطورة لاسترجاع وتخزين البيانات الناتجة عن حدث معين تلقائياً؛ 
              حيث يتم إرسال طلب <code className="bg-black/40 text-emerald-300 px-1.5 py-0.5 rounded text-xs font-mono">HTTP POST</code> فوري يحمل تفاصيل الحدث الحقيقي (بيانات العميل، رقم الهاتف، المنتجات، والأسعار) بصيغة JSON 
              إلى أنظمة التأكيد الخارجية (مثل <strong>Akked.app</strong>، Google Sheets، Zapier، أو خادمك الخاص) بمجرد وقوعه في المتجر.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end gap-3 shrink-0">
            <button
              onClick={openAddModal}
              className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2.5 transition-all text-sm group"
            >
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              <span>أضف webhook</span>
            </button>
            
            <div className="flex items-center gap-3 text-xs text-slate-300 bg-white/5 px-3.5 py-2 rounded-xl border border-white/5">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>المفعّل: {webhooks.filter(w => w.isActive).length} من {webhooks.length}</span>
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-emerald-400 font-bold">{deliveryLogs.length} حدث حقيقي مسجل</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Mode View Selector (Webhooks vs Live Logs) */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMainViewTab('webhooks')}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all ${
              mainViewTab === 'webhooks'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Webhook className="w-4 h-4" />
            <span>نقاط الـ Webhook النشطة ({webhooks.length})</span>
          </button>

          <button
            onClick={() => setMainViewTab('logs')}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all ${
              mainViewTab === 'logs'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>سجل إرسال الأحداث اللحظية (Live Logs)</span>
            {deliveryLogs.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500 text-white">
                {deliveryLogs.length}
              </span>
            )}
          </button>
        </div>

        {mainViewTab === 'webhooks' && (
          <button
            onClick={openAddModal}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة نقطة نهاية جديدة</span>
          </button>
        )}
      </div>

      {/* VIEW 1: WEBHOOKS LIST */}
      {mainViewTab === 'webhooks' && (
        <div className="space-y-4">
          
          {/* Akked WhatsApp Integration Quick Banner */}
          <div className="bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 border border-purple-500/30 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-start gap-3.5 relative z-10">
              <div className="w-11 h-11 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shrink-0">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">تكامل إشعارات الواتساب عبر منصة أكد (Akked.app)</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/30 text-purple-200 border border-purple-400/20">
                    رسمي معتمد
                  </span>
                </div>
                <p className="text-xs text-purple-200/80 leading-relaxed max-w-2xl">
                  أرسل طلبات متجرك مباشرة إلى Akked لتأكيدها بالواتساب، واستقبل الردود آلياً لتغيير حالة الأوردرات فوراً إلى <strong>مؤكد</strong> أو <strong>ملغي</strong> أو <strong>تحديث العنوان</strong>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 relative z-10">
              <button
                onClick={openAkkedModal}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/30 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                <span>إعداد واختبار أكد (Akked) الآن</span>
              </button>
              <a
                href="https://akked.app/docs/api"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2.5 bg-white/10 hover:bg-white/15 text-purple-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all"
              >
                <span>دليل التوثيق</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Akked Inbound Callback Box - استقبال ردود واتساب وتحديث الحالات */}
          <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-indigo-950/80 text-white rounded-2xl p-4 sm:p-5 border border-emerald-500/30 shadow-md">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <h4 className="text-xs sm:text-sm font-black text-emerald-300">
                    رابط استقبال الردود وتحديث حالات الطلبات من أكد (Webhook Callback URL)
                  </h4>
                  <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                    ثنائي الاتجاه (Auto-Sync)
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  ضع هذا الرابط في لوحة تحكم <strong>أكد &gt; الإعدادات &gt; Webhooks</strong> لتحديث الطلبات تلقائياً:
                  <span className="text-emerald-400 font-bold mx-1">تأكيد الأوردر</span>
                  أو
                  <span className="text-red-400 font-bold mx-1">إلغاء الطلب</span>
                  أو
                  <span className="text-cyan-400 font-bold mx-1">تعديل العنوان فوراً</span>
                  بمجرد رد العميل على الواتساب.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-black/40 border border-emerald-500/30 rounded-xl p-1.5 shrink-0 max-w-full sm:max-w-md">
                <code className="text-xs font-mono text-emerald-300 px-2 overflow-x-auto whitespace-nowrap text-left" dir="ltr">
                  {hostUrl || (typeof window !== 'undefined' ? window.location.origin : '')}/api/v1/akked/callback
                </code>
                <button
                  onClick={() => {
                    const callbackUrl = `${hostUrl || (typeof window !== 'undefined' ? window.location.origin : '')}/api/v1/akked/callback`;
                    navigator.clipboard.writeText(callbackUrl);
                    setCopiedState('akked-callback-url');
                    audioSynth.playSuccess();
                    setTimeout(() => setCopiedState(null), 2500);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
                >
                  {copiedState === 'akked-callback-url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedState === 'akked-callback-url' ? 'تم النسخ!' : 'نسخ الرابط'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Filter Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-sm">
            {[
              { key: 'all', label: 'الكل', count: webhooks.length },
              { key: 'orders', label: 'الطلبات والشحن', count: webhooks.filter(w => w.event.startsWith('order.') || w.event.startsWith('shipment.')).length },
              { key: 'cart', label: 'السلات المتروكة والمبيعات', count: webhooks.filter(w => w.event.startsWith('cart.') || w.event.startsWith('checkout.')).length },
              { key: 'customers', label: 'العملاء', count: webhooks.filter(w => w.event.startsWith('customer.')).length },
              { key: 'products', label: 'المنتجات', count: webhooks.filter(w => w.event.startsWith('product.')).length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveQuickTab(tab.key as any)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeQuickTab === tab.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeQuickTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {filteredWebhooks.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-dashed border-slate-300 dark:border-slate-800 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center mx-auto text-indigo-500">
                <Webhook className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">لا توجد نقاط Webhook مضافة في هذا القسم</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  قم بإضافة أول Webhook لربط أحداث المتجر (كإتمام الطلب، أو التخلي عن السلة) بنظام Akked أو Google Sheets أو Zapier.
                </p>
              </div>
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>أضف webhook الآن</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredWebhooks.map(wh => {
                const eventMeta = WEBHOOK_EVENTS.find(e => e.id === wh.event);
                const isCart = wh.event.startsWith('cart.') || wh.event.startsWith('checkout.');
                const isOrder = wh.event.startsWith('order.') || wh.event.startsWith('shipment.');
                const isAkked = wh.url.toLowerCase().includes('akked');

                return (
                  <div 
                    key={wh.id}
                    className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border transition-all shadow-sm hover:shadow-md ${
                      wh.isActive 
                        ? 'border-slate-200 dark:border-slate-800' 
                        : 'border-slate-200/50 dark:border-slate-800/50 opacity-70 bg-slate-50/50 dark:bg-slate-900/50'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      
                      {/* Event & URL Info */}
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                            isCart 
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : isOrder
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                          }`}>
                            <Radio className="w-3 h-3 animate-pulse" />
                            <span>{eventMeta?.label || wh.event}</span>
                          </span>

                          {isAkked && (
                            <span className="px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 text-[11px] font-bold">
                              منصة أكد (Akked)
                            </span>
                          )}

                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                            {wh.format || 'JSON'}
                          </span>

                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            {wh.apiVersion || 'v1.0'}
                          </span>

                          <span className="text-xs text-slate-400 font-mono">
                            ({wh.event})
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-semibold text-xs text-slate-400 shrink-0">الرابط:</span>
                          <div className="font-mono text-xs text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg truncate max-w-xl text-left" dir="ltr">
                            {wh.url}
                          </div>
                          <button 
                            onClick={() => handleCopy(wh.url, wh.id)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md transition-colors"
                            title="نسخ الرابط"
                          >
                            {copiedState === wh.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>

                        {/* Status & Timing */}
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
                          {wh.lastTriggeredAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>آخر إرسال: {new Date(wh.lastTriggeredAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            </span>
                          )}

                          {wh.lastStatusCode !== undefined && (
                            <span className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                              wh.lastStatusCode >= 200 && wh.lastStatusCode < 300
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            }`}>
                              HTTP {wh.lastStatusCode} {wh.lastStatusText ? `(${wh.lastStatusText})` : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                        
                        {/* Quick Real Event Trigger */}
                        <button
                          onClick={() => handleQuickTriggerRealEvent(wh)}
                          disabled={triggeringWebhookId === wh.id}
                          className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all border border-emerald-200 dark:border-emerald-800/50 shadow-sm disabled:opacity-50"
                          title="إرسال حدث حقيقي فوراً باستخدام أحدث بيانات المتجر"
                        >
                          {triggeringWebhookId === wh.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                          )}
                          <span>إرسال حدث حقيقي</span>
                        </button>

                        {/* Modal Test Button */}
                        <button
                          onClick={() => {
                            openEditModal(wh);
                          }}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                          title="فحص واختبار الـ Webhook"
                        >
                          <Play className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300 fill-slate-600 dark:fill-slate-300" />
                          <span>اختبار</span>
                        </button>

                        {/* Active Switch */}
                        <button
                          onClick={() => toggleWebhookActive(wh.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                            wh.isActive
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 hover:bg-emerald-100'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-300'
                          }`}
                        >
                          {wh.isActive ? 'مفعّل' : 'معطّل'}
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => openEditModal(wh)}
                          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                          title="تعديل الـ Webhook"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteWebhook(wh.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors"
                          title="حذف الـ Webhook"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* VIEW 2: LIVE EVENT DELIVERY LOGS */}
      {mainViewTab === 'logs' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-500" />
              <span>سجل إرسال الأحداث اللحظية المباشرة (أحدث {deliveryLogs.length} عملية إرسال)</span>
            </h3>

            {deliveryLogs.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('هل تريد مسح سجل الأحداث؟')) {
                    localStorage.removeItem('store_webhook_delivery_logs');
                    setDeliveryLogs([]);
                  }
                }}
                className="text-xs text-rose-600 hover:underline font-bold"
              >
                مسح السجل
              </button>
            )}
          </div>

          {deliveryLogs.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-slate-200 dark:border-slate-800 space-y-2">
              <Clock className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="font-bold text-slate-800 dark:text-white text-sm">لا توجد عمليات إرسال مسجلة بعد</h4>
              <p className="text-xs text-slate-500">
                بمجرد حدوث عملية شراء، تعديل طلب، أو الضغط على "اختبار حدث حقيقي"، ستظهر نتائج الإرسال الحية هنا فوراً.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {deliveryLogs.map((log) => (
                <div 
                  key={log.id} 
                  className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        log.success 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' 
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}>
                        {log.statusCode ? `HTTP ${log.statusCode}` : (log.success ? 'نجاح 200' : 'فشل')}
                      </span>

                      <span className="font-bold text-slate-800 dark:text-white">{log.event}</span>
                      <span className="text-slate-400 font-mono text-[11px]">{new Date(log.timestamp).toLocaleTimeString('ar-EG')}</span>
                      {log.durationMs && <span className="text-slate-400 font-mono">({log.durationMs}ms)</span>}
                    </div>

                    <div className="font-mono text-slate-500 truncate max-w-md text-left" dir="ltr">
                      {log.url}
                    </div>

                    {/* Summary badge */}
                    {log.payloadSummary && (log.payloadSummary.orderNumber || log.payloadSummary.customerName) && (
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 rounded-md inline-block">
                        {log.payloadSummary.orderNumber && <span className="font-bold">طلب #{log.payloadSummary.orderNumber} </span>}
                        {log.payloadSummary.customerName && <span>| العميل: {log.payloadSummary.customerName} </span>}
                        {log.payloadSummary.customerPhone && <span className="font-mono">({log.payloadSummary.customerPhone}) </span>}
                        {log.payloadSummary.totalPrice && <span className="font-bold text-emerald-600">| {log.payloadSummary.totalPrice} ج.م</span>}
                      </div>
                    )}

                    {log.error && (
                      <p className="text-rose-600 font-mono text-[11px]">{log.error}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {log.fullPayload && (
                      <button
                        onClick={() => setViewPayloadModal(log.fullPayload)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1"
                      >
                        <Code className="w-3.5 h-3.5" />
                        <span>عرض الـ JSON</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleTestWebhook(log.url, log.event, log.fullPayload)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-100"
                    >
                      إعادة الإرسال
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* --- ADD / EDIT WEBHOOK MODAL (EXACT MATCH WITH USER SCREENSHOTS) --- */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
            dir="rtl"
          >
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingWebhookId ? 'تعديل webhook' : 'أضف webhook'}
              </h2>
              <button 
                onClick={closeModal}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto">

              {/* Row 1: الحدث (Event) & الصيغة (Format) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* الحدث (Event) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    الحدث
                  </label>
                  <div className="relative">
                    <select
                      value={selectedEvent}
                      onChange={(e) => {
                        setSelectedEvent(e.target.value as WebhookEventType);
                        setTestResult(null);
                      }}
                      className="w-full bg-white dark:bg-slate-800 border border-emerald-500/80 dark:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none font-medium text-right cursor-pointer"
                    >
                      <optgroup label="السلات والمبيعات">
                        <option value="cart.abandoned">التخلي عن سلة التسوق</option>
                        <option value="cart.product_added">إضافة منتج إلى سلة التسوق</option>
                        <option value="checkout.started">بدء إتمام الطلب</option>
                      </optgroup>
                      <optgroup label="الطلبات والشحن">
                        <option value="order.completed">إتمام الطلب</option>
                        <option value="order.updated">تحديث الطلب</option>
                        <option value="order.cancelled">إلغاء الطلب</option>
                        <option value="shipment.updated">تم تحديث الشحنة</option>
                      </optgroup>
                      <optgroup label="العملاء">
                        <option value="customer.created">تم إنشاء العميل</option>
                        <option value="customer.updated">تحديث بيانات العملاء</option>
                      </optgroup>
                      <optgroup label="المنتجات">
                        <option value="product.created">تم إنشاء المنتج</option>
                        <option value="product.updated">تم تحديث المنتج</option>
                        <option value="product.deleted">حذف المنتج</option>
                      </optgroup>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  </div>
                </div>

                {/* الصيغة (Format) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    الصيغة
                  </label>
                  <div className="relative">
                    <select
                      value={selectedFormat}
                      onChange={(e) => setSelectedFormat(e.target.value as any)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none font-medium text-right cursor-pointer"
                    >
                      <option value="JSON">JSON</option>
                      <option value="XML">XML</option>
                      <option value="FORM">x-www-form-urlencoded</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  </div>
                </div>

              </div>

              {/* ------------------------------------------------------------------ */}
              {/* REAL EVENTS DATA SOURCE SELECTOR (THE CRITICAL USER REQUEST) */}
              {/* ------------------------------------------------------------------ */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span>بيانات الفحص والحدث التجريبي:</span>
                  </span>

                  {/* Toggle Pills */}
                  <div className="inline-flex rounded-xl bg-slate-200/80 dark:bg-slate-900 p-1 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setUseRealData(true)}
                      className={`px-3 py-1 rounded-lg transition-all ${
                        useRealData 
                          ? 'bg-emerald-600 text-white shadow-sm' 
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      حدث حقيقي من متجرك
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseRealData(false)}
                      className={`px-3 py-1 rounded-lg transition-all ${
                        !useRealData 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      نموذج افتراضي
                    </button>
                  </div>
                </div>

                {useRealData ? (
                  <div className="space-y-2.5 pt-1">
                    {/* Order selector if order event */}
                    {(selectedEvent.startsWith('order.') || selectedEvent === 'shipment.updated') && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-600 dark:text-slate-300">
                            اختر أوردر حقيقي من متجرك لإرساله:
                          </span>
                          {availableOrders.length === 0 && (
                            <button
                              type="button"
                              onClick={handleGenerateRealOrder}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                            >
                              + توليد طلب حقيقي سريع للتجربة
                            </button>
                          )}
                        </div>

                        {availableOrders.length > 0 ? (
                          <div className="relative">
                            <select
                              value={selectedRealOrderId || availableOrders[0].id}
                              onChange={(e) => setSelectedRealOrderId(e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-none cursor-pointer appearance-none text-right font-medium"
                            >
                              {availableOrders.map(o => (
                                <option key={o.id} value={o.id}>
                                  طلب #{o.orderNumber} - {o.customerName || 'عميل'} ({o.customerPhone || 'بدون هاتف'}) - {o.totalPrice || 0} ج.م [{o.status || 'معلق'}]
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                          </div>
                        ) : (
                          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
                            <span>لا توجد طلبات مسجلة بالمتجر حتى الآن.</span>
                            <button
                              type="button"
                              onClick={handleGenerateRealOrder}
                              className="px-3 py-1 bg-amber-600 text-white rounded-lg font-bold text-[11px]"
                            >
                              توليد طلب للتجربة
                            </button>
                          </div>
                        )}

                        {quickOrderNotice && (
                          <p className="text-[11px] text-emerald-600 font-bold">{quickOrderNotice}</p>
                        )}

                        {/* Real Data Highlight Card */}
                        {currentOrder && (
                          <div className="p-3 bg-white dark:bg-slate-900/90 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] space-y-1">
                            <div className="flex items-center justify-between font-bold text-slate-800 dark:text-white">
                              <span>طلب رقم #{currentOrder.orderNumber}</span>
                              <span className="text-emerald-600">{currentOrder.totalPrice} ج.م</span>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400">
                              العميل: <strong>{currentOrder.customerName || 'أحمد محمود'}</strong> | هاتف: <span className="font-mono">{currentOrder.customerPhone || '01012345678'}</span> | {currentOrder.governorate || 'القاهرة'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cart / Checkout product selector */}
                    {(selectedEvent.startsWith('cart.') || selectedEvent === 'checkout.started') && (
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                          اختر منتجاً حقيقياً من الكتالوج لمحاكاة السلة:
                        </label>
                        {availableProducts.length > 0 ? (
                          <div className="relative">
                            <select
                              value={selectedRealProductId || availableProducts[0].id}
                              onChange={(e) => setSelectedRealProductId(e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-none cursor-pointer appearance-none text-right font-medium"
                            >
                              {availableProducts.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} - السعر: {p.price} ج.م (المخزون: {p.stockQuantity || 0})
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400">سيتم استخدام منتج حقيقي من المتجر الافتراضي.</p>
                        )}
                      </div>
                    )}

                    {/* Customer selector */}
                    {selectedEvent.startsWith('customer.') && (
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                          اختر عميلاً حقيقياً من سجل العملاء:
                        </label>
                        {availableCustomers.length > 0 ? (
                          <div className="relative">
                            <select
                              value={selectedRealCustomerId || availableCustomers[0].id}
                              onChange={(e) => setSelectedRealCustomerId(e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white outline-none cursor-pointer appearance-none text-right font-medium"
                            >
                              {availableCustomers.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.name} - هاتف: {c.phone} ({c.city || c.governorate || 'مصر'})
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400">سيتم إرسال بيانات عميل حقيقي متناسقة مع متجرك.</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    سيتم إرسال عينة نموذجية جاهزة (Mock Template) مع معرفات تجريبية ثابتة للفحص السريع.
                  </p>
                )}
              </div>

              {/* Row 2: الرابط (URL) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>الرابط</span>
                  {webhookUrl.toLowerCase().includes('akked') && (
                    <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded">
                      منصة أكد (Akked.app)
                    </span>
                  )}
                </label>
                <input
                  type="url"
                  placeholder="رابط ال Webhook"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-left font-mono"
                  dir="ltr"
                />

                {/* Smart Akked Webhook URL Recognition */}
                {webhookUrl.toLowerCase().includes('akked.app/api/webhooks') && (
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 rounded-xl flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                      رابط Webhook معتمد من منصة أكد. سيعمل الربط مباشرة وبشكل فوري دون الحاجة لمفتاح API!
                    </p>
                  </div>
                )}

                {/* Warning ONLY if user literally pasted the documentation page */}
                {webhookUrl.toLowerCase().includes('akked') && (webhookUrl.includes('/docs') || webhookUrl.trim() === 'https://akked.app' || webhookUrl.trim() === 'https://akked.app/') && (
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-xl space-y-2">
                    <div className="flex items-center gap-1.5 text-purple-900 dark:text-purple-200 font-bold text-xs">
                      <AlertCircle className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span>تنبيه: لقد قمت بإدخال رابط صفحة التوثيق (docs) وليس رابط الـ Webhook الفعلي</span>
                    </div>
                    <p className="text-[11px] text-purple-800 dark:text-purple-300 leading-relaxed">
                      انسخ رابط الـ Webhook الخاص بك من لوحة أكد (يبدأ بـ <code className="font-mono bg-purple-100 dark:bg-purple-900/60 px-1 py-0.5 rounded text-[10px]" dir="ltr">https://akked.app/api/webhooks/...</code>) أو استخدم مسار الرسائل المباشر.
                    </p>
                  </div>
                )}

                <p className="text-[11px] text-slate-400 mr-1">
                  مثال: رابط الـ Webhook من أكد (<code className="font-mono text-[10px]">https://akked.app/api/webhooks/...</code>)، أو Google Sheets، أو Zapier، أو خادمك.
                </p>
              </div>

              {/* Row 3: المفتاح السري أو Akked API Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-500" />
                    <span>
                      {webhookUrl.toLowerCase().includes('akked') 
                        ? 'مفتاح API الخاص بمنصة أكد (Akked API Key)' 
                        : 'المفتاح السري (Secret Key / X-Webhook-Secret)'}
                    </span>
                    {webhookUrl.toLowerCase().includes('akked') && (
                      <span className="text-[10px] text-slate-400 font-normal">(اختياري - غير مطلوب لرابط الـ Webhook)</span>
                    )}
                  </label>

                  {webhookUrl.toLowerCase().includes('akked') && secretKey && (
                    <button
                      type="button"
                      onClick={() => handleVerifyAkkedKey(secretKey)}
                      disabled={isVerifyingAkked || !secretKey}
                      className="text-[11px] text-purple-600 dark:text-purple-400 font-bold hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {isVerifyingAkked ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>جاري الفحص...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>فحص مفتاح API في أكد</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type={showSecretKey ? 'text' : 'password'}
                    placeholder={webhookUrl.toLowerCase().includes('akked') ? 'ak_live_... (اتركه فارغاً إذا كنت تستخدم رابط الـ Webhook)' : 'المفتاح السري لتوقيع الـ Webhook (اختياري)'}
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-left font-mono"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecretKey(!showSecretKey)}
                    className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title={showSecretKey ? 'إخفاء المفتاح' : 'إظهار المفتاح'}
                  >
                    {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Akked Verification Feedback */}
                {akkedVerifyResult && (
                  <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                    akkedVerifyResult.success 
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}>
                    {akkedVerifyResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                    <span className="leading-tight">{akkedVerifyResult.message}</span>
                  </div>
                )}

                <p className="text-[11px] text-slate-400 mr-1">
                  {webhookUrl.toLowerCase().includes('akked') ? (
                    <span>
                      احصل على المفتاح من لوحة تحكم <strong>Akked.app</strong> &gt; الإعدادات &gt; <strong>مفاتيح الـ API</strong> (يبدأ بـ <code className="font-mono text-purple-600 dark:text-purple-400">ak_live_</code>). يتم إرساله تلقائياً كـ <code className="font-mono text-[10px]">Authorization: Bearer</code> مع ترويسة <code className="font-mono text-[10px]">Idempotency-Key</code>.
                    </span>
                  ) : (
                    'يتم إرساله في ترويسات X-Webhook-Secret و X-Signature للتحقق من أمان الإرسال.'
                  )}
                </p>
              </div>

              {/* Row 4: نسخة الـ webhook API */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  نسخة الـ webhook API
                </label>
                <div className="relative">
                  <select
                    value={apiVersion}
                    onChange={(e) => setApiVersion(e.target.value as any)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none font-mono text-right cursor-pointer"
                  >
                    <option value="v1.0">v1.0</option>
                    <option value="v2.0">v2.0</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Live Test Feedback Banner inside Modal */}
              {testResult && (
                <div className={`p-4 rounded-xl text-xs space-y-2 border transition-all ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
                }`}>
                  <div className="flex items-center justify-between font-bold">
                    <div className="flex items-center gap-1.5">
                      {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                      <span>
                        {testResult.success 
                          ? (testResult.isAkked 
                              ? 'تم استلام وتأكيد الطلب في منصة أكد (Akked) بنجاح!' 
                              : (testResult.isRealData ? 'تم إرسال الحدث الحقيقي بنجاح واستجاب الخادم!' : 'نجح الاتصال واستجاب الخادم بنجاح!'))
                          : 'فشل إرسال الحدث إلى الرابط المحدد'}
                      </span>
                    </div>
                    {testResult.statusCode && (
                      <span className="font-mono px-2 py-0.5 rounded bg-black/10">
                        كود: {testResult.statusCode} ({testResult.durationMs}ms)
                      </span>
                    )}
                  </div>

                  {testResult.message && <p className="leading-relaxed">{testResult.message}</p>}
                  {testResult.error && <p className="font-mono text-[11px] text-rose-700 dark:text-rose-300">{testResult.error}</p>}

                  {testResult.sentPayload && (
                    <button
                      type="button"
                      onClick={() => setViewPayloadModal(testResult.sentPayload)}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 underline flex items-center gap-1 pt-1"
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>
                        {testResult.isAkked 
                          ? 'عرض بيانات قالب أكد (Akked Template Payload) المُرسلة' 
                          : 'عرض كود الـ JSON الحقيقي المُرسل إلى الرابط'}
                      </span>
                    </button>
                  )}
                </div>
              )}

            </div>

            {/* Modal Footer Buttons (EXACT MATCH WITH USER SCREENSHOT) */}
            <div className="p-6 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              
              {/* Right side in RTL (Cancel button) */}
              <button
                type="button"
                onClick={closeModal}
                className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white transition-colors"
              >
                إلغاء
              </button>

              {/* Left side in RTL (Test and Save buttons) */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleTestWebhook()}
                  disabled={isTesting || !webhookUrl}
                  className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-2xl flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                      <span>جاري إرسال الحدث...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 text-slate-700 dark:text-slate-200 fill-slate-700 dark:fill-slate-200" />
                      <span>اختبار</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSaveWebhook}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm font-bold rounded-2xl transition-all shadow-sm cursor-pointer"
                >
                  احفظ
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Payload Viewer Drawer */}
      {viewPayloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 dark:border-slate-800" dir="rtl">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                <Code className="w-4 h-4 text-indigo-500" />
                <span>بيانات الـ JSON الحقيقية المرسلة ({viewPayloadModal.event || 'حدث'})</span>
              </h3>
              <button onClick={() => setViewPayloadModal(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <pre className="bg-slate-950 text-emerald-400 p-4 rounded-xl text-xs font-mono max-h-96 overflow-y-auto text-left" dir="ltr">
                {JSON.stringify(viewPayloadModal, null, 2)}
              </pre>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => handleCopy(JSON.stringify(viewPayloadModal, null, 2), 'payload-copy')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                {copiedState === 'payload-copy' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>نسخ الـ JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Integration Guide Accordion */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
          <Info className="w-4 h-4 text-indigo-500" />
          <span>كيف تربط الـ Webhooks مع الأنظمة الخارجية ومنصة Akked؟</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600 dark:text-slate-300">
          
          {/* Akked Guide */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-purple-200 dark:border-purple-800/60 space-y-1.5 relative overflow-hidden">
            <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[10px] font-bold">
              تأكيد تلقائي
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
              <span>1. الربط مع منصة Akked.app</span>
            </h4>
            <p className="leading-relaxed">
              انسخ رابط الـ Webhook الخاص بك من لوحة تحكم <strong>Akked</strong> والصقه هنا، واختر حدث <em>"إتمام الطلب"</em>. سيتم إرسال كل أوردر فوراً ببيانات العميل الحقيقية لتأكيد الطلب آلياً عبر واتساب أو الاتصال الصوتي.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
            <h4 className="font-bold text-slate-900 dark:text-white">2. Zapier أو Make أو n8n</h4>
            <p className="leading-relaxed">
              اختر Triggers نوع <em>Catch Hook</em> في Zapier أو Make، انسخ رابط الخطاف الفريد والصقه هنا واضغط <strong>اختبار</strong> لمزامنة حقول الطلب الحقيقية مباشرة.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
            <h4 className="font-bold text-slate-900 dark:text-white">3. Google Sheets (مباشر)</h4>
            <p className="leading-relaxed">
              افتح جدول بيانات Google، ثم انتقل إلى <em>Extensions &gt; Apps Script</em> وضع دالة <code className="bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded">doPost(e)</code>، وانشرها كتطبيق ويب والصق الرابط هنا لتسجيل الأوردرات تلقائياً.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}
