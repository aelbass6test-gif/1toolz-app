import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Order, Settings, WhatsAppConfig, WhatsAppMessageLog } from '../types';
import { 
  MessageSquare, Send, Search, CheckCircle2, AlertTriangle, 
  X, Phone, ExternalLink, RefreshCw, Copy, Check, Sparkles, 
  Clock, Shield, Truck, XCircle, ChevronRight, User, ShoppingBag, 
  MapPin, DollarSign, ArrowRight, Play, CheckCheck, FileText, CornerDownLeft, Zap
} from 'lucide-react';
import { whatsappService, normalizeWhatsAppPhone } from '../utils/whatsappService';
import { inAppAlert, inAppConfirm } from '../utils/inAppAlert';

interface OrderWhatsAppChatModalProps {
  order?: Order | null;
  orders: Order[];
  settings: Settings;
  onClose?: () => void;
  onUpdateOrder?: (updatedOrder: Order) => Promise<void> | void;
  isEmbedded?: boolean; // When rendered directly inside WhatsAppPage
  selectedOrderId?: string;
  onSelectOrder?: (order: Order) => void;
}

export const OrderWhatsAppChatModal: React.FC<OrderWhatsAppChatModalProps> = ({
  order: initialOrder,
  orders,
  settings,
  onClose,
  onUpdateOrder,
  isEmbedded = false,
  selectedOrderId,
  onSelectOrder
}) => {
  // Current active order
  const [activeOrder, setActiveOrder] = useState<Order | null>(
    initialOrder || (selectedOrderId ? orders.find(o => o.id === selectedOrderId || o.orderNumber === selectedOrderId) : null) || orders[0] || null
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'pending' | 'confirmed' | 'cancelled' | 'shipping'>('all');
  const [customMessage, setCustomMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Keep activeOrder synchronized when props change
  useEffect(() => {
    if (initialOrder) {
      setActiveOrder(initialOrder);
    } else if (selectedOrderId) {
      const found = orders.find(o => o.id === selectedOrderId || o.orderNumber === selectedOrderId);
      if (found) setActiveOrder(found);
    }
  }, [initialOrder, selectedOrderId, orders]);

  // Scroll to bottom when messages update
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeOrder]);

  const storeDisplayName = (settings as any)?.storeName || 
                            (settings as any)?.general?.storeName || 
                            (settings as any)?.name || 
                            activeOrder?.storeName || 
                            'متجرنا';

  const whatsappConfig: WhatsAppConfig = settings.whatsappConfig || {
    apiUrl: 'https://api.ultramsg.com/instance186031/',
    instanceId: 'instance186031',
    token: 'hilzrk5qc9lv7jfa',
    isActive: true,
    autoSendOnStatusChange: true,
    providerType: 'meta_cloud'
  };

  // Filtered orders for the side list
  const filteredOrders = useMemo(() => {
    return orders.filter(ord => {
      const name = (ord.customerName || '').toLowerCase();
      const phone = (ord.customerPhone || '').toLowerCase();
      const orderNum = (ord.orderNumber || '').toString().toLowerCase();
      const matchesSearch = !searchTerm || name.includes(searchTerm.toLowerCase()) || phone.includes(searchTerm.toLowerCase()) || orderNum.includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (filterType === 'pending') {
        return ['جديد', 'قيد_المراجعة', 'في_انتظار_المكالمة', 'معلق', 'بانتظار_التأكيد', 'pending'].includes(ord.status);
      }
      if (filterType === 'confirmed') {
        return ['قيد_التنفيذ', 'مؤكد', 'confirmed'].includes(ord.status);
      }
      if (filterType === 'cancelled') {
        return ['ملغي', 'مرفوض', 'cancelled'].includes(ord.status);
      }
      if (filterType === 'shipping') {
        return ['تم_الشحن', 'مع_المندوب', 'جاري_التوصيل', 'تم_التوصيل'].includes(ord.status);
      }
      return true;
    });
  }, [orders, searchTerm, filterType]);

  // Extract messages and history for active order
  const chatMessages = useMemo(() => {
    if (!activeOrder) return [];
    return whatsappService.getEffectiveChatForOrder(activeOrder, settings, storeDisplayName);
  }, [activeOrder, settings, storeDisplayName]);

  // Handle Order Selection
  const handleSelectOrder = (ord: Order) => {
    setActiveOrder(ord);
    if (onSelectOrder) onSelectOrder(ord);
  };

  const copyText = (text: string, id: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (_) {}
  };

  // Send message helper
  const handleSendMessage = async (
    textToSend: string, 
    type: 'confirmation' | 'cancellation' | 'shipping' | 'tracking' | 'custom', 
    buttons?: string[], 
    footer?: string
  ) => {
    if (!activeOrder) return;
    const phone = activeOrder.customerPhone;
    if (!phone) {
      setStatusMsg({ type: 'error', text: 'لا يوجد رقم هاتف مسجل لهذا الطلب' });
      return;
    }

    setIsSending(true);
    setStatusMsg(null);

    try {
      const res = await whatsappService.sendMessage(
        phone, 
        textToSend, 
        whatsappConfig, 
        buttons, 
        footer, 
        storeDisplayName
      );

      const newLog: WhatsAppMessageLog = {
        id: 'wa_' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        type,
        direction: 'outgoing',
        message: textToSend,
        sender: storeDisplayName + ' (المتجر)',
        recipient: activeOrder.customerName || phone,
        status: res.success ? 'sent' : 'failed',
        buttonSelected: undefined
      };

      const updatedLogs = [...(activeOrder.whatsappLogs || []), newLog];
      const updatedOrder = {
        ...activeOrder,
        whatsappLogs: updatedLogs
      };

      setActiveOrder(updatedOrder);
      if (onUpdateOrder) {
        await onUpdateOrder(updatedOrder);
      }

      if (res.success) {
        setStatusMsg({ type: 'success', text: 'تم إرسال الرسالة بنجاح عبر الواتساب! ✅' });
        setCustomMessage('');
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'فشل إرسال الرسالة عبر الواتساب' });
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.message || 'حدث خطأ أثناء الإرسال' });
    } finally {
      setIsSending(false);
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  // Quick Action Handlers
  const handleSendConfirmation = () => {
    if (!activeOrder) return;
    const conf = whatsappService.formatConfirmationMessage(activeOrder, settings, storeDisplayName);
    handleSendMessage(conf.text, 'confirmation', conf.buttons, conf.footer);
  };

  const handleSendCancellation = () => {
    if (!activeOrder) return;
    const cancel = whatsappService.formatCancellationMessage(activeOrder, settings, storeDisplayName, activeOrder.notes || 'بناءً على طلب العميل');
    handleSendMessage(cancel.text, 'cancellation', [], cancel.footer);
  };

  const handleSendShipping = () => {
    if (!activeOrder) return;
    const ship = whatsappService.formatShippingMessage(activeOrder, settings, storeDisplayName);
    handleSendMessage(ship.text, 'shipping', [], ship.footer);
  };

  // Simulate incoming Customer Action (Confirm / Cancel)
  const handleSimulateCustomerAction = async (actionText: string) => {
    if (!activeOrder) return;
    setIsSimulating(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/webhook/whatsapp/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: activeOrder.customerPhone || '',
          text: actionText,
          orderId: activeOrder.id || activeOrder.orderNumber
        })
      });

      const data = await res.json();
      if (data.success) {
        const isCancel = actionText.includes('إلغاء');
        const updatedStatus = isCancel ? 'ملغي' : 'قيد_التنفيذ';
        
        const incomingLog: WhatsAppMessageLog = {
          id: 'sim_' + Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toISOString(),
          type: isCancel ? 'cancellation' : 'confirmation',
          direction: 'incoming',
          message: actionText,
          sender: activeOrder.customerName || 'العميل',
          recipient: storeDisplayName,
          status: 'received',
          actionTaken: isCancel ? 'تم إلغاء الطلب تلقائياً' : 'تم تأكيد الطلب تلقائياً'
        };

        const updatedOrder: Order = {
          ...activeOrder,
          status: updatedStatus as any,
          whatsappLogs: [...(activeOrder.whatsappLogs || []), incomingLog]
        };

        setActiveOrder(updatedOrder);
        if (onUpdateOrder) {
          await onUpdateOrder(updatedOrder);
        }

        setStatusMsg({ 
          type: 'success', 
          text: `تمت محاكاة استجابة العميل بنجاح! تم تحديث حالة الطلب إلى: [${isCancel ? 'ملغي' : 'قيد التنفيذ'}] ✅` 
        });
      } else {
        setStatusMsg({ type: 'error', text: data.error || data.reason || 'فشلت معالجة المحاكاة' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'حدث خطأ في الاتصال بالخادم' });
    } finally {
      setIsSimulating(false);
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  // Open Direct WhatsApp in Web / App
  const openDirectWhatsApp = () => {
    if (!activeOrder?.customerPhone) return;
    const clean = normalizeWhatsAppPhone(activeOrder.customerPhone);
    const msg = customMessage.trim() || `أهلاً ${activeOrder.customerName || 'عزيزي العميل'}، بخصوص طلبك رقم #${activeOrder.orderNumber} من ${storeDisplayName}`;
    window.open(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Status Badge Helper
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'قيد_التنفيذ':
      case 'مؤكد':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"><CheckCircle2 size={12} /> مؤكد (قيد التنفيذ)</span>;
      case 'ملغي':
      case 'مرفوض':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"><XCircle size={12} /> ملغي ❌</span>;
      case 'تم_الشحن':
      case 'مع_المندوب':
      case 'جاري_التوصيل':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"><Truck size={12} /> تم الشحن 🚚</span>;
      case 'مؤجل':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"><Clock size={12} /> مؤجل ⏳</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"><Clock size={12} /> بانتظار التأكيد</span>;
    }
  };

  const containerContent = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden select-text text-right" dir="rtl">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 font-black">
            <MessageSquare size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
              شاشة محادثات ورسائل الواتساب للطلبات
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                مزامنة حية ⚡
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              استعراض رسائل التأكيد والإلغاء المبعوثة لكل عميل ومتابعة المحادثات التفاعلية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onClose && !isEmbedded && (
            <button 
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
              title="إغلاق"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Status notification toast */}
      {statusMsg && (
        <div className={`px-6 py-3 shrink-0 flex items-center gap-3 text-xs font-bold transition-all animate-in fade-in slide-in-from-top-2 ${
          statusMsg.type === 'success' 
            ? 'bg-emerald-500 text-white' 
            : 'bg-red-500 text-white'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span className="flex-1">{statusMsg.text}</span>
          <button onClick={() => setStatusMsg(null)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-hidden divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-slate-200 dark:divide-slate-800">
        
        {/* Right Sidebar: Orders & Customers List (4 cols) */}
        <div className="lg:col-span-4 flex flex-col h-full min-h-0 bg-slate-50/50 dark:bg-slate-900/40 border-l border-slate-200 dark:border-slate-800">
          {/* Search Box */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
            <div className="relative">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                placeholder="بحث برقم الطلب، اسم العميل، الهاتف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-9 pl-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: 'all', label: 'الكل' },
                { id: 'pending', label: 'بانتظار التأكيد' },
                { id: 'confirmed', label: 'مؤكدة' },
                { id: 'shipping', label: 'مشحونة' },
                { id: 'cancelled', label: 'ملغية' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black shrink-0 transition-all ${
                    filterType === tab.id 
                      ? 'bg-emerald-600 text-white shadow-sm' 
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Orders List Items */}
          <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1.5 no-scrollbar">
            {filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <MessageSquare size={32} className="mx-auto opacity-40 text-slate-400" />
                <p className="text-xs font-bold">لا توجد طلبات مطابقة للبحث</p>
              </div>
            ) : (
              filteredOrders.map(ord => {
                const isSelected = activeOrder?.id === ord.id || activeOrder?.orderNumber === ord.orderNumber;
                const formattedPhone = ord.customerPhone || 'بدون هاتف';
                const totalPrice = ord.totalPrice || (ord.productPrice || 0) + (ord.shippingFee || 0) - (ord.discount || 0);

                return (
                  <button
                    key={ord.id || ord.orderNumber}
                    onClick={() => handleSelectOrder(ord)}
                    className={`w-full text-right p-3 rounded-2xl transition-all flex flex-col gap-1.5 border relative ${
                      isSelected
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 shadow-sm'
                        : 'bg-white dark:bg-slate-800/80 hover:bg-slate-100/80 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-900/50 px-2 py-0.5 rounded-md">
                          #{ord.orderNumber}
                        </span>
                        <h4 className="text-xs font-black text-slate-800 dark:text-white truncate max-w-[130px]">
                          {ord.customerName || 'عميل'}
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {ord.date ? new Date(ord.date).toLocaleDateString('ar-EG', { month: 'numeric', day: 'numeric' }) : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-mono text-slate-600 dark:text-slate-300 font-bold">{formattedPhone}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">{totalPrice} ج.م</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/40">
                      <div className="scale-90 origin-right">
                        {getStatusBadge(ord.status)}
                      </div>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black flex items-center gap-0.5">
                        عرض الشات <ChevronRight size={12} className="rotate-180" />
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Center/Left Main Panel: Chat Window & Sent Messages (8 cols) */}
        <div className="lg:col-span-8 flex flex-col h-full min-h-0 bg-[#F0F2F5] dark:bg-[#0B141A]">
          {activeOrder ? (
            <>
              {/* Order Chat Header Bar */}
              <div className="p-4 bg-white dark:bg-[#202C33] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 font-black text-lg flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-700">
                    {(activeOrder.customerName || 'ع').charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-sm text-slate-900 dark:text-white">
                        {activeOrder.customerName || 'عزيزي العميل'}
                      </h3>
                      <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        طلب #{activeOrder.orderNumber}
                      </span>
                      {getStatusBadge(activeOrder.status)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="font-mono font-bold flex items-center gap-1">
                        <Phone size={11} className="text-emerald-500" />
                        {activeOrder.customerPhone}
                      </span>
                      {activeOrder.customerCity && (
                        <span className="flex items-center gap-1">
                          <MapPin size={11} className="text-blue-500" />
                          {activeOrder.customerCity || activeOrder.governorate}
                        </span>
                      )}
                      <span className="font-black text-slate-700 dark:text-slate-200">
                        المبلغ: {activeOrder.totalPrice || (activeOrder.productPrice || 0) + (activeOrder.shippingFee || 0) - (activeOrder.discount || 0)} ج.م
                      </span>
                    </div>
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={openDirectWhatsApp}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-500/20 transition-all"
                    title="فتح في تطبيق واتساب مباشرة"
                  >
                    <ExternalLink size={13} />
                    فتح واتساب
                  </button>
                </div>
              </div>

              {/* Order Quick Summary Card */}
              <div className="bg-white/70 dark:bg-[#111B21]/70 border-b border-slate-200/80 dark:border-slate-800/80 px-4 py-2 text-xs flex items-center justify-between flex-wrap gap-2 shrink-0">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <ShoppingBag size={14} className="text-emerald-600" />
                  <span className="font-bold">المنتجات:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {activeOrder.items && activeOrder.items.length > 0 
                      ? activeOrder.items.map(i => `${i.name || i.productName} (${i.quantity || 1})`).join('، ')
                      : activeOrder.productName || 'منتج'}
                  </span>
                </div>

                {activeOrder.waybillNumber && (
                  <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-mono font-bold bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-900">
                    <Truck size={12} />
                    بوليصة: {activeOrder.waybillNumber} ({activeOrder.shippingCompany || 'بوسطة'})
                  </div>
                )}
              </div>

              {/* Chat Message Stream */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 min-h-0 no-scrollbar bg-[#EFEAE2] dark:bg-[#0B141A] bg-opacity-95">
                {/* Security/Notice Banner */}
                <div className="max-w-md mx-auto bg-amber-50 dark:bg-[#182229] border border-amber-200 dark:border-amber-900/40 rounded-2xl p-3 text-center text-xs text-amber-800 dark:text-amber-300 shadow-sm space-y-1">
                  <div className="flex items-center justify-center gap-1.5 font-black">
                    <Shield size={14} className="text-amber-600" />
                    الرسائل والمحادثات المزامنة للطلب رقم #{activeOrder.orderNumber}
                  </div>
                  <p className="text-[11px] opacity-90 leading-relaxed">
                    يتم إرسال رسائل التأكيد التفاعلية تلقائياً بأزرار الرد السريع، واستقبال استجابات العميل فورياً وتحديث حالة الطلب.
                  </p>
                </div>

                {/* Messages List */}
                {chatMessages.map((msg, index) => {
                  const isOutgoing = msg.direction === 'outgoing';

                  return (
                    <div 
                      key={msg.id || index}
                      className={`flex flex-col ${isOutgoing ? 'items-start' : 'items-end'} animate-in fade-in slide-in-from-bottom-2 duration-200`}
                    >
                      <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-3.5 shadow-sm space-y-2 relative group text-right ${
                        isOutgoing
                          ? 'bg-white dark:bg-[#005C4B] text-slate-800 dark:text-white rounded-tr-none border border-emerald-100 dark:border-emerald-800/40'
                          : 'bg-[#DCF8C6] dark:bg-[#202C33] text-slate-900 dark:text-slate-100 rounded-tl-none border border-emerald-200/50 dark:border-slate-700'
                      }`}>
                        {/* Header of bubble */}
                        <div className="flex items-center justify-between gap-3 text-[10px] font-bold opacity-75 border-b border-black/5 dark:border-white/10 pb-1">
                          <span className="flex items-center gap-1">
                            {isOutgoing ? (
                              <span className="text-emerald-600 dark:text-emerald-300 font-black">🏢 {msg.sender}</span>
                            ) : (
                              <span className="text-blue-600 dark:text-blue-300 font-black">👤 {msg.sender}</span>
                            )}
                          </span>

                          <span className="font-mono text-[9px] opacity-75">
                            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>

                        {/* Message Content with line breaks */}
                        <div className="text-xs leading-relaxed whitespace-pre-wrap font-medium">
                          {msg.message}
                        </div>

                        {/* Interactive Buttons Preview (if any) */}
                        {msg.buttons && msg.buttons.length > 0 && (
                          <div className="pt-2 border-t border-black/5 dark:border-white/10 space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-400 block">أزرار الاستجابة السريعة المرسلة للعميل:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.buttons.map((btn, bIdx) => (
                                <span 
                                  key={bIdx}
                                  className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-500/10 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[11px] font-black border border-emerald-300/60 dark:border-emerald-700/60"
                                >
                                  {btn}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Action Taken Badge (e.g. status updated automatically) */}
                        {msg.actionTaken && (
                          <div className="mt-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-black flex items-center gap-1 shadow-sm">
                            <Zap size={11} className="text-amber-300" />
                            {msg.actionTaken}
                          </div>
                        )}

                        {/* Footer / Status ticks */}
                        <div className="flex items-center justify-between pt-1 text-[10px] opacity-60">
                          <button
                            onClick={() => copyText(msg.message, msg.id)}
                            className="hover:opacity-100 flex items-center gap-0.5 text-[9px]"
                            title="نسخ نص الرسالة"
                          >
                            {copiedId === msg.id ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                            {copiedId === msg.id ? 'تم النسخ' : 'نسخ'}
                          </button>

                          <div className="flex items-center gap-1 font-mono">
                            {isOutgoing && (
                              <span className="text-emerald-600 dark:text-emerald-400 flex items-center" title="تم التسليم">
                                <CheckCheck size={14} />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatBottomRef} />
              </div>

              {/* Quick Template Actions Bar */}
              <div className="bg-white dark:bg-[#202C33] border-t border-slate-200 dark:border-slate-800 p-3 shrink-0 space-y-3 shadow-lg">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Sparkles size={13} className="text-amber-500" />
                    إرسال قوالب فورية للطلب:
                  </span>

                  {/* Simulator Trigger */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400">🤖 تجربة تفاعل العميل:</span>
                    <button
                      type="button"
                      disabled={isSimulating}
                      onClick={() => handleSimulateCustomerAction('تأكيد الطلب ✅')}
                      className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-lg text-[10px] font-black border border-emerald-200 dark:border-emerald-800 disabled:opacity-50 transition-all flex items-center gap-1"
                      title="محاكاة ضغط العميل على تأكيد الطلب"
                    >
                      <Play size={10} /> محاكاة التأكيد
                    </button>
                    <button
                      type="button"
                      disabled={isSimulating}
                      onClick={() => handleSimulateCustomerAction('إلغاء الطلب ❌')}
                      className="px-2 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-lg text-[10px] font-black border border-red-200 dark:border-red-800 disabled:opacity-50 transition-all flex items-center gap-1"
                      title="محاكاة ضغط العميل على إلغاء الطلب"
                    >
                      <X size={10} /> محاكاة الإلغاء
                    </button>
                  </div>
                </div>

                {/* Instant Template Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={handleSendConfirmation}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm disabled:opacity-50 transition-all"
                  >
                    <CheckCircle2 size={14} />
                    إرسال رسالة تأكيد الطلب 💬
                  </button>

                  <button
                    type="button"
                    disabled={isSending}
                    onClick={handleSendShipping}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-sm disabled:opacity-50 transition-all"
                  >
                    <Truck size={14} />
                    إرسال تفاصيل الشحن والتتبع 🚚
                  </button>

                  <button
                    type="button"
                    disabled={isSending}
                    onClick={handleSendCancellation}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-sm disabled:opacity-50 transition-all"
                  >
                    <XCircle size={14} />
                    إرسال إشعار الإلغاء ❌
                  </button>
                </div>

                {/* Custom Message Input & Send */}
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="اكتب رسالة مخصصة للعميل هنا..."
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && customMessage.trim()) {
                          e.preventDefault();
                          handleSendMessage(customMessage.trim(), 'custom');
                        }
                      }}
                      className="w-full pr-4 pl-10 py-2.5 text-xs bg-slate-100 dark:bg-[#111B21] border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const portalLink = `https://ais-pre-xcte2r3fyl5agkthujufx4-222930444647.europe-west1.run.app/order-action?orderId=${activeOrder.id || activeOrder.orderNumber}&phone=${(activeOrder.customerPhone || '').replace(/\D/g, '')}`;
                        setCustomMessage(prev => prev + ' ' + portalLink);
                      }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 text-[10px] font-bold"
                      title="إضافة رابط تأكيد الطلب للرسالة"
                    >
                      + رابط الطلب
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={isSending || !customMessage.trim()}
                    onClick={() => handleSendMessage(customMessage.trim(), 'custom')}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-emerald-600/20 disabled:shadow-none"
                  >
                    {isSending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                    إرسال
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
              <MessageSquare size={48} className="opacity-30" />
              <h3 className="text-base font-black text-slate-700 dark:text-slate-300">حدد طلباً لعرض محادثات ورسائل الواتساب</h3>
              <p className="text-xs max-w-sm leading-relaxed">
                اختر أي طلب من القائمة الجانبية للاطلاع على الرسائل المرسلة للعميل، رسائل التأكيد والإلغاء وتفاصيل الشات.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // If embedded in a page, return directly without modal backdrop
  if (isEmbedded) {
    return (
      <div className="h-[750px] rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
        {containerContent}
      </div>
    );
  }

  // Otherwise return full modal with backdrop
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-6xl h-[88vh] max-h-[850px] rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col">
        {containerContent}
      </div>
    </div>
  );
};
