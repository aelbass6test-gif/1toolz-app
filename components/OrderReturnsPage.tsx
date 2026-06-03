
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RotateCcw, 
  Plus, 
  Search, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  X, 
  ChevronDown,
  ChevronUp,
  History,
  FileText,
  User,
  Hash,
  Info,
  Calendar,
  Package,
  Receipt,
  ShoppingCart,
  ArrowRight
} from 'lucide-react';
import { Settings, Order, OrderReturn, OrderReturnItem, OrderItem } from '../types';

interface OrderReturnsPageProps {
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
  orders: Order[];
  updateStoreData: (data: any) => void;
  currentUser: any;
}

const OrderReturnsPage: React.FC<OrderReturnsPageProps> = ({ settings, updateSettings, orders, updateStoreData, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'history' | 'create'>('history');
  const [selectedReturn, setSelectedReturn] = useState<OrderReturn | null>(null);
  
  // Create Return Flow State
  const [searchOrderQuery, setSearchOrderQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [returnItems, setReturnItems] = useState<OrderReturnItem[]>([]);
  const [returnDetail, setReturnDetail] = useState({
    reason: '',
    warehouseId: '',
    restockItems: true,
    totalRefund: 0
  });

  const warehouses = settings.warehouses || [];
  const returns = settings.orderReturns || [];

  // Handle Order Selection
  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
    // Initialize return items with full quantities from order
    const initialReturnItems = order.items.map(item => ({
      productId: item.productId,
      variantId: item.variantId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      cost: item.cost
    }));
    setReturnItems(initialReturnItems);
    setReturnDetail(prev => ({
      ...prev,
      warehouseId: order.warehouseId || warehouses.find(w => w.isDefault)?.id || '',
      totalRefund: initialReturnItems.reduce((acc, i) => acc + (i.price * i.quantity), 0)
    }));
  };

  const handleUpdateReturnQty = (idx: number, qty: number) => {
    const originalItem = selectedOrder?.items[idx];
    if (!originalItem) return;

    const newItems = [...returnItems];
    newItems[idx].quantity = Math.max(0, Math.min(qty, originalItem.quantity));
    setReturnItems(newItems);
    
    // Update total refund
    const newTotal = newItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    setReturnDetail(prev => ({ ...prev, totalRefund: newTotal }));
  };

  const handleExecuteReturn = () => {
    if (!selectedOrder) return;
    if (!returnDetail.warehouseId) return alert('يرجى اختيار مستودع الارجاع');
    if (returnItems.filter(i => i.quantity > 0).length === 0) return alert('يرجى اختيار قطعة واحدة على الأقل للاسترجاع');

    const returnId = `RET-${Date.now()}`;
    const returnNumber = `RN-${String(returns.length + 1).padStart(5, '0')}`;
    
    const returnData: OrderReturn = {
      id: returnId,
      returnNumber,
      orderId: selectedOrder.id,
      orderNumber: selectedOrder.orderNumber,
      date: new Date().toISOString(),
      items: returnItems.filter(i => i.quantity > 0),
      totalRefund: returnDetail.totalRefund,
      reason: returnDetail.reason,
      warehouseId: returnDetail.warehouseId,
      restockItems: returnDetail.restockItems,
      status: 'completed',
      performedBy: currentUser?.fullName || currentUser?.email || 'System'
    };

    // Update product stocks if needed
    let updatedProducts = [...settings.products];
    if (returnData.restockItems) {
      returnData.items.forEach(item => {
        const pIdx = updatedProducts.findIndex(p => p.id === item.productId);
        if (pIdx > -1) {
          const prod = { ...updatedProducts[pIdx] };
          
          if (item.variantId && prod.variants) {
            prod.variants = prod.variants.map(v => {
              if (v.id === item.variantId) {
                const vUpdated = { ...v };
                vUpdated.stockQuantity = (vUpdated.stockQuantity || 0) + item.quantity;
                vUpdated.warehouseStock = { ...(vUpdated.warehouseStock || {}) };
                vUpdated.warehouseStock[returnData.warehouseId] = (vUpdated.warehouseStock[returnData.warehouseId] || 0) + item.quantity;
                return vUpdated;
              }
              return v;
            });
          } else {
            prod.stockQuantity = (prod.stockQuantity || 0) + item.quantity;
            prod.warehouseStock = { ...(prod.warehouseStock || {}) };
            prod.warehouseStock[returnData.warehouseId] = (prod.warehouseStock[returnData.warehouseId] || 0) + item.quantity;
          }
          
          updatedProducts[pIdx] = prod;
        }
      });
    }

    // Update global settings & store data
    const newSettings = {
      ...settings,
      products: updatedProducts,
      orderReturns: [returnData, ...returns],
      activityLogs: [
        {
          id: `log-${Date.now()}`,
          user: currentUser?.fullName || 'النظام',
          action: 'إصدار فاتورة مرتجع',
          details: `مرتجع للطلب ${returnData.orderNumber} بقيمة ${returnData.totalRefund} ج.م`,
          date: new Date().toLocaleString('ar-EG'),
          timestamp: Date.now()
        },
        ...(settings.activityLogs || [])
      ]
    };

    updateSettings(newSettings);
    
    // Optionally update order status to returned or partially returned
    const updatedOrders = orders.map(o => {
      if (o.id === selectedOrder.id) {
        // Calculate if fully returned
        const totalItemsOrdered = o.items.reduce((acc, i) => acc + i.quantity, 0);
        const totalItemsReturned = returnData.items.reduce((acc, i) => acc + i.quantity, 0);
        
        return { 
          ...o, 
          status: totalItemsReturned >= totalItemsOrdered ? 'مرتجع' : 'مرتجع_جزئي' as any
        };
      }
      return o;
    });
    
    updateStoreData({ settings: newSettings, orders: updatedOrders });

    setSelectedOrder(null);
    setReturnItems([]);
    setActiveTab('history');
    alert('تم إصدار فاتورة المرتجع وتحديث المخزون بنجاح');
  };

  const filteredReturns = returns.filter(r => 
    r.returnNumber.toLowerCase().includes(searchOrderQuery.toLowerCase()) ||
    r.orderNumber.toLowerCase().includes(searchOrderQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <RotateCcw className="text-rose-500" />
            فواتير المرتجعات (Credit Notes)
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-bold mt-1">إدارة مرتجعات العملاء وحركات المخزون العكسية</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800'}`}
          >
            <History size={18} />
            سجل المرتجعات
          </button>
          <button 
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'create' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800'}`}
          >
            <Plus size={18} />
            فاتورة مرتجع جديدة
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'history' ? (
          <motion.div 
            key="history"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
             {/* History Filters */}
             <div className="glass-card p-4 rounded-2xl flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="ابحث برقم المرتجع أو رقم الطلب..."
                  value={searchOrderQuery}
                  onChange={(e) => setSearchOrderQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-12 pr-4 py-3 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>
            </div>

            {/* Returns Grid */}
            {filteredReturns.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                <RotateCcw size={48} className="mx-auto text-slate-200 dark:text-slate-800 mb-4" />
                <p className="text-slate-500 font-bold italic">لا توجد سجلات مرتجعات متاحة</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReturns.map(ret => (
                  <div key={ret.id} className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-rose-100 dark:hover:border-rose-900/30 transition-all">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-500 border border-rose-100 dark:border-rose-900/30">
                              <Receipt size={22} />
                            </div>
                            <div>
                               <div className="flex items-center gap-2">
                                  <h4 className="font-black text-slate-800 dark:text-white">{ret.returnNumber}</h4>
                                  <span className="text-[10px] font-black text-slate-400"># {ret.orderNumber || 'غير محدد'}</span>
                               </div>
                               <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                                  <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(ret.date).toLocaleDateString('ar-EG')}</span>
                                  <span className="flex items-center gap-1"><User size={12}/> {ret.performedBy}</span>
                               </div>
                            </div>
                         </div>

                         <div className="flex items-center gap-8">
                            <div className="text-center">
                               <div className="text-[10px] text-slate-400 font-bold mb-0.5">القيمة المستردة</div>
                               <div className="text-base font-black text-rose-600 dark:text-rose-400 tabular-nums">{ret.totalRefund} <span className="text-[10px]">ج.م</span></div>
                            </div>
                            <div className="text-center">
                               <div className="text-[10px] text-slate-400 font-bold mb-0.5">عدد القطع</div>
                               <div className="text-base font-black text-slate-800 dark:text-white tabular-nums">{ret.items.reduce((acc, i) => acc + i.quantity, 0)}</div>
                            </div>
                            <button 
                              onClick={() => setSelectedReturn(selectedReturn?.id === ret.id ? null : ret)}
                              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
                            >
                               {selectedReturn?.id === ret.id ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                            </button>
                         </div>
                    </div>

                    <AnimatePresence>
                       {selectedReturn?.id === ret.id && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 overflow-hidden"
                          >
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                               <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 space-y-1">
                                  <div>المستودع المستقبل: <span className="text-slate-900 dark:text-white">{warehouses.find(w => w.id === ret.warehouseId)?.name || 'غير محدد'}</span></div>
                                  <div>سبب الارجاع: <span className="text-slate-900 dark:text-white">{ret.reason || 'لا يوجد'}</span></div>
                               </div>
                               <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 space-y-1">
                                  <div>إعادة للمخزون: <span className={ret.restockItems ? 'text-emerald-500' : 'text-rose-500'}>{ret.restockItems ? 'نعم (تم تحديث الأرقام)' : 'لا (بضاعة تالفة/مفقودة)'}</span></div>
                                  <div>حالة الفاتورة: <span className="text-slate-900 dark:text-white">مكتملة</span></div>
                               </div>
                             </div>

                             <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                               <table className="w-full text-right text-xs">
                                 <thead className="bg-slate-100 dark:bg-slate-800 text-slate-400 font-black h-10 border-b border-slate-200 dark:border-slate-850">
                                   <tr>
                                     <th className="pr-4">المنتج</th>
                                     <th className="px-3 text-center">الكمية</th>
                                     <th className="px-3">السعر</th>
                                     <th className="pl-4 text-left">الإجمالي</th>
                                   </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                   {ret.items.map((item, idx) => (
                                     <tr key={idx} className="h-10 hover:bg-white dark:hover:bg-slate-800 transition-all font-bold">
                                       <td className="pr-4 text-slate-700 dark:text-slate-300">{item.name}</td>
                                       <td className="px-3 text-center tabular-nums text-rose-500">{item.quantity}</td>
                                       <td className="px-3 tabular-nums text-slate-500">{item.price} ج.م</td>
                                       <td className="pl-4 text-left tabular-nums text-slate-900 dark:text-white">{item.price * item.quantity} ج.م</td>
                                     </tr>
                                   ))}
                                 </tbody>
                               </table>
                             </div>
                          </motion.div>
                       )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="create"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* Search Order Section */}
            <div className="lg:col-span-12">
               {!selectedOrder ? (
                 <div className="glass-card p-10 rounded-3xl text-center space-y-6">
                    <div className="max-w-md mx-auto space-y-4">
                       <ShoppingCart size={40} className="mx-auto text-indigo-200" />
                       <h3 className="text-xl font-black text-slate-800 dark:text-white">ابحث عن الطلب لإصدار مرتجع</h3>
                       <p className="text-slate-400 text-xs font-bold leading-relaxed">ابحث برقم الطلب أو اسم العميل أو رقم الهاتف للبدء في عملية الاسترجاع</p>
                       
                       <div className="relative mt-4">
                          <input 
                            type="text"
                            placeholder="رقم الأوردر، الاسم، الموبايل..."
                            value={searchOrderQuery}
                            onChange={(e) => setSearchOrderQuery(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 h-14 pl-14 pr-6 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                          />
                          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                       </div>
                    </div>

                    {searchOrderQuery.length >= 2 && (
                       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
                          {orders.filter(o => 
                            o.orderNumber.includes(searchOrderQuery) || 
                            o.customerName.includes(searchOrderQuery) || 
                            o.customerPhone.includes(searchOrderQuery)
                          ).slice(0, 6).map(o => (
                            <button 
                              key={o.id}
                              onClick={() => handleSelectOrder(o)}
                              className="text-right p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-900 shadow-sm hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-900 transition-all group"
                            >
                               <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] font-black text-indigo-500 tracking-wider">ORD-{o.orderNumber}</span>
                                  <ArrowRight size={16} className="text-slate-200 group-hover:text-indigo-600 transition-colors" />
                               </div>
                               <div className="font-black text-slate-850 dark:text-white text-sm truncate">{o.customerName}</div>
                               <div className="text-[10px] font-bold text-slate-400 mt-0.5">{o.customerPhone}</div>
                               <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-50 dark:border-slate-850">
                                   <div className="text-[10px] font-black text-slate-700 dark:text-slate-300">إجمالي: {o.totalPrice} ج.م</div>
                                   <div className="mr-auto px-2 py-0.5 rounded-lg bg-slate-50 text-[8px] font-black">{o.status}</div>
                               </div>
                            </button>
                          ))}
                       </div>
                    )}
                 </div>
               ) : (
                 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Return Setup Form */}
                    <div className="lg:col-span-7 space-y-6">
                       <div className="glass-card p-6 rounded-3xl space-y-6">
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                             <div className="flex items-center gap-3">
                               <Receipt size={20} className="text-rose-500" />
                               <h3 className="font-black text-slate-800 dark:text-white">إعداد فاتورة المرتجع للطلب {selectedOrder.orderNumber}</h3>
                             </div>
                             <button 
                               onClick={() => setSelectedOrder(null)}
                               className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors"
                             >إلغاء واختيار طلب آخر</button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="space-y-2">
                               <label className="text-xs font-black text-slate-500 uppercase tracking-wider mr-1">المستودع المستقبل للمرتجع</label>
                               <select 
                                 value={returnDetail.warehouseId}
                                 onChange={(e) => setReturnDetail({...returnDetail, warehouseId: e.target.value})}
                                 className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm outline-none focus:ring-4 focus:ring-indigo-500/10"
                               >
                                 <option value="">-- اختر المستودع --</option>
                                 {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                               </select>
                             </div>
                             <div className="space-y-2">
                               <label className="text-xs font-black text-slate-500 uppercase tracking-wider mr-1">سبب الاسترجاع</label>
                               <input 
                                 type="text"
                                 placeholder="مثلاً: بضاعة تالفة، رغبة العميل..."
                                 value={returnDetail.reason}
                                 onChange={(e) => setReturnDetail({...returnDetail, reason: e.target.value})}
                                 className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm outline-none focus:ring-4 focus:ring-rose-500/10"
                               />
                             </div>
                          </div>

                          <div className="flex items-center gap-4 p-4 bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 rounded-2xl">
                             <div className="flex-1">
                               <h4 className="text-sm font-black text-rose-700 dark:text-rose-400">إعادة القطع للمخزون القابل للبيع</h4>
                               <p className="text-[10px] font-bold text-rose-600/70 dark:text-rose-400/60 mt-0.5">عند تفعيل هذا الخيار، سيتم زيادة كميات المنتجات تلقائياً في المستودع المحدد أعلاه.</p>
                             </div>
                             <button 
                               onClick={() => setReturnDetail({...returnDetail, restockItems: !returnDetail.restockItems})}
                               className={`w-14 h-8 rounded-full relative transition-all duration-300 ${returnDetail.restockItems ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                             >
                                <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm transition-all duration-300 ${returnDetail.restockItems ? 'right-7' : 'right-1'}`} />
                             </button>
                          </div>
                       </div>

                       <div className="glass-card p-6 rounded-3xl space-y-4">
                          <h3 className="font-black text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-4">تحديد الكميات المرتجعة</h3>
                          
                          <div className="space-y-3">
                             {selectedOrder.items.map((item, idx) => {
                               const currentRet = returnItems[idx];
                               return (
                                 <div key={idx} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-2xl">
                                    <div>
                                       <div className="font-black text-slate-800 dark:text-white text-sm">{item.name}</div>
                                       <div className="text-[10px] font-bold text-slate-400 mt-0.5">مباع: {item.quantity} | مرجع: <span className="text-rose-500">{currentRet?.quantity || 0}</span></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                       <button 
                                         onClick={() => handleUpdateReturnQty(idx, (currentRet?.quantity || 0) - 1)}
                                         className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400"
                                       >-</button>
                                       <input 
                                         type="number"
                                         value={currentRet?.quantity || 0}
                                         onChange={(e) => handleUpdateReturnQty(idx, Number(e.target.value))}
                                         className="w-12 h-8 bg-transparent text-center font-black text-sm outline-none"
                                       />
                                       <button 
                                         onClick={() => handleUpdateReturnQty(idx, (currentRet?.quantity || 0) + 1)}
                                         className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400"
                                       >+</button>
                                    </div>
                                 </div>
                               );
                             })}
                          </div>
                       </div>
                    </div>

                    {/* Summary Sidebar */}
                    <div className="lg:col-span-5 space-y-6">
                       <div className="glass-card p-6 rounded-3xl sticky top-6 border-t-4 border-t-rose-500 shadow-xl shadow-rose-500/5">
                          <h3 className="font-black text-slate-900 dark:text-white text-lg mb-6">ملخص المرتجع</h3>
                          
                          <div className="space-y-4 mb-8">
                             <div className="flex items-center justify-between text-sm font-bold">
                                <span className="text-slate-400">عدد القطع المسترجعة</span>
                                <span className="text-slate-900 dark:text-white">{returnItems.reduce((acc, i) => acc + i.quantity, 0)} قطعة</span>
                             </div>
                             <div className="flex items-center justify-between text-sm font-bold">
                                <span className="text-slate-400">إجمالي القيمة المستردة</span>
                                <span className="text-rose-600 dark:text-rose-400 font-black text-xl tabular-nums">{returnDetail.totalRefund} ج.م</span>
                             </div>
                          </div>

                          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 flex gap-3 mb-6">
                             <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
                             <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 leading-relaxed">
                                سيتم خصم هذه القيمة من تقارير الأرباح والمبيعات حالياً. تأكد من مراجعة حالة الطلب الأساسية بعد إتمام المرتجع.
                             </p>
                          </div>

                          <button 
                            onClick={handleExecuteReturn}
                            className="w-full bg-rose-500 text-white h-14 rounded-2xl font-black shadow-lg shadow-rose-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                          >
                             <CheckCircle2 size={20} />
                             إتمام المرتجع وإصدار الفاتورة
                          </button>
                       </div>
                    </div>
                 </div>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrderReturnsPage;
