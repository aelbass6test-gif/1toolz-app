
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Monitor, 
  Search, 
  ShoppingCart, 
  Trash2, 
  CheckCircle2, 
  User, 
  Hash, 
  CreditCard, 
  Banknote, 
  Wallet,
  Warehouse,
  Plus,
  Minus,
  X,
  Package,
  Receipt,
  Printer,
  ChevronLeft,
  SearchCode
} from 'lucide-react';
import { Settings, Product, ProductVariant, POSSale, POSSaleItem, Order } from '../types';

interface POSPageProps {
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
  orders: Order[];
  updateStoreData: (data: any) => void;
  currentUser: any;
}

const POSPage: React.FC<POSPageProps> = ({ settings, updateSettings, orders, updateStoreData, currentUser }) => {
  if (settings.isPosEnabled === false) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-6" dir="rtl">
        <div className="w-24 h-24 bg-red-50 dark:bg-red-950/30 rounded-3xl flex items-center justify-center text-red-500 shadow-xl shadow-red-500/10">
          <Monitor size={48} className="opacity-50" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white">نقطة البيع معطلة حالياً</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
            تم إيقاف ميزة نقطة البيع من قبل المدير. يرجى مراجعة إعدادات المتجر إذا كنت تعتقد أن هذا خطأ.
          </p>
        </div>
        <button 
          onClick={() => window.history.back()}
          className="px-8 py-3 bg-slate-800 dark:bg-white dark:text-slate-950 text-white rounded-2xl font-bold hover:scale-105 transition-all shadow-lg active:scale-95"
        >
          العودة للخلف
        </button>
      </div>
    );
  }

  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<POSSaleItem[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(settings.warehouses?.find(w => w.isDefault)?.id || settings.warehouses?.[0]?.id || '');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'wallet'>('cash');
  const [paymentStatusType, setPaymentStatusType] = useState<'paid' | 'credit'>('paid');
  const [selectedCashHolder, setSelectedCashHolder] = useState(currentUser?.id || (settings.employees?.[0]?.id || settings.partners?.[0]?.id || ''));
  const [customerInfo, setCustomerInfo] = useState({ name: 'عميل نقدي', phone: '', address: '' });

  const products = settings.products || [];
  const warehouses = settings.warehouses || [];
  const cashHolders = settings.cashHolders || [];
  
  const allPossibleHolders = useMemo(() => [
    ...(settings.employees || []).map((e, index) => ({ id: `emp_${e.id || index}`, name: e.name })),
    ...(settings.partners || []).map((p, index) => ({ id: `part_${p.id || index}`, name: `${p.name} (شريك)` }))
  ], [settings.employees, settings.partners]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products.slice(0, 12);
    const term = searchTerm.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(term) || 
      (p.sku && p.sku.toLowerCase().includes(term))
    ).slice(0, 20);
  }, [products, searchTerm]);

  const addToCart = (product: Product, variant?: ProductVariant) => {
    const existingIdx = cart.findIndex(item => 
      variant ? (item.productId === product.id && item.variantId === variant.id) : (item.productId === product.id && !item.variantId)
    );

    if (existingIdx > -1) {
      const newCart = [...cart];
      newCart[existingIdx].quantity += 1;
      setCart(newCart);
    } else {
      const newItem: POSSaleItem = {
        productId: product.id,
        variantId: variant?.id,
        name: variant ? `${product.name} (${Object.values(variant.options).join(' / ')})` : product.name,
        quantity: 1,
        price: variant?.price || product.price || 0,
        cost: variant?.costPrice || product.costPrice || 0
      };
      setCart([...cart, newItem]);
    }
  };

  const updateQuantity = (idx: number, delta: number) => {
    const newCart = [...cart];
    newCart[idx].quantity = Math.max(1, newCart[idx].quantity + delta);
    setCart(newCart);
  };

  const removeFromCart = (idx: number) => {
    const newCart = [...cart];
    newCart.splice(idx, 1);
    setCart(newCart);
  };

  const [isProcessing, setIsProcessing] = useState(false);
  const totalAmount = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handleCheckout = async () => {
    if (isProcessing) return;
    if (cart.length === 0) return alert('السلة فارغة!');
    if (!selectedWarehouse) return alert('يرجى اختيار المستودع المتوفر به البضاعة');

    setIsProcessing(true);
    try {
      const saleId = `POS-${Date.now()}`;
      const saleNumber = `P-${String((settings.posSales?.length || 0) + 1).padStart(5, '0')}`;
      
      const receiver = allPossibleHolders.find(h => h.id === selectedCashHolder);
      const isCredit = paymentStatusType === 'credit';
      
      const newSale: POSSale = {
        id: saleId,
        saleNumber,
        date: new Date().toISOString(),
        items: cart,
        totalAmount,
        paymentMethod: isCredit ? 'cash' : paymentMethod,
        warehouseId: selectedWarehouse,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        customerAddress: customerInfo.address,
        performedBy: currentUser?.fullName || currentUser?.email || 'كاشير',
        cashHolderId: isCredit ? 'credit' : selectedCashHolder,
        cashHolderName: isCredit ? 'حساب أجل' : receiver?.name,
        notes: `${isCredit ? '[أجل] ' : ''}${customerInfo.address ? `بيع مباشر - ${customerInfo.address}` : 'بيع مباشر من المنفذ'}`
      };

      // Update Stocks
      const updatedProducts = [...(settings.products || [])];
      newSale.items.forEach(item => {
        const pIdx = updatedProducts.findIndex(p => p.id === item.productId);
        if (pIdx > -1) {
          const prod = { ...updatedProducts[pIdx] };
          if (item.variantId && prod.variants) {
            prod.variants = prod.variants.map(v => {
              if (v.id === item.variantId) {
                const vUpdated = { ...v };
                vUpdated.stockQuantity = Math.max(0, (vUpdated.stockQuantity || 0) - item.quantity);
                vUpdated.warehouseStock = { ...(vUpdated.warehouseStock || {}) };
                vUpdated.warehouseStock[selectedWarehouse] = Math.max(0, (vUpdated.warehouseStock[selectedWarehouse] || 0) - item.quantity);
                return vUpdated;
              }
              return v;
            });
          } else {
            prod.stockQuantity = Math.max(0, (prod.stockQuantity || 0) - item.quantity);
            prod.warehouseStock = { ...(prod.warehouseStock || {}) };
            prod.warehouseStock[selectedWarehouse] = Math.max(0, (prod.warehouseStock[selectedWarehouse] || 0) - item.quantity);
          }
          updatedProducts[pIdx] = prod;
        }
      });

      // Update Cash Holder Balance
      let updatedHolders = [...(settings.cashHolders || [])];
      if (!isCredit) {
        const hIdx = updatedHolders.findIndex(h => h.userId === selectedCashHolder);
        if (hIdx > -1) {
          updatedHolders[hIdx].currentBalance += totalAmount;
          updatedHolders[hIdx].lastUpdated = new Date().toISOString();
        } else {
          updatedHolders.push({
            userId: selectedCashHolder,
            userName: receiver?.name || 'مستلم',
            currentBalance: totalAmount,
            lastUpdated: new Date().toISOString()
          });
        }
      }

      const newSettings: Settings = {
        ...settings,
        products: updatedProducts,
        cashHolders: updatedHolders,
        posSales: [newSale, ...(settings.posSales || [])],
        activityLogs: [
          {
            id: `log-${Date.now()}`,
            user: currentUser?.fullName || 'POS',
            action: 'عملية بيع سريعة',
            details: `بيع مباشر بقيمة ${totalAmount} ج.م استلمها ${receiver?.name}`,
            date: new Date().toLocaleString('ar-EG'),
            timestamp: Date.now()
          },
          ...(settings.activityLogs || [])
        ]
      };

      // Create equivalent Order
      const newOrder: Order = {
        id: saleId,
        orderNumber: saleNumber,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone || '0000000000',
        customerAddress: customerInfo.address || 'بيع مباشر - المنفذ',
        shippingCompany: 'كاشير - بيع مباشر',
        shippingArea: 'نقطة البيع',
        productName: cart.length > 1 ? `${cart[0].name} + ${cart.length - 1} منتجات أخرى` : cart[0]?.name || '',
        productPrice: totalAmount,
        productCost: cart.reduce((acc, i) => acc + (i.cost * i.quantity), 0),
        weight: 0,
        discount: 0,
        preparationStatus: 'جاهز',
        items: cart.map(i => ({ ...i, image: '', weight: 0 })),
        totalPrice: totalAmount,
        shippingFee: 0,
        status: isCredit ? 'جاري_المراجعة' : 'تم_التحصيل',
        date: new Date().toISOString(),
        paymentStatus: isCredit ? 'بانتظار الدفع' : 'مدفوع',
        warehouseId: selectedWarehouse,
        channel: 'pos'
      };

      // Perform a single atomic update to the store data
      updateStoreData({ 
        settings: newSettings, 
        orders: [newOrder, ...orders] 
      });

      alert(isCredit ? 'تم تسجيل العملية كطلب أجل بنجاح!' : 'تم إتمام البيع وتحديث المخزن بنجاح!');
      setCart([]);
      setCustomerInfo({ name: 'عميل نقدي', phone: '', address: '' });
      setPaymentStatusType('paid');
    } catch (err) {
      console.error('Checkout failed:', err);
      alert('فشلت عملية البيع، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen lg:h-[calc(100vh-140px)] gap-6 p-1 lg:p-0 pb-32 lg:pb-0">
      {/* Products Catalog - Left Side */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text"
                placeholder="ابحث بالاسم أو الباركود..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 h-12 pl-12 pr-6 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
              />
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
           <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map(product => (
                <div key={product.id} className="space-y-2">
                   {product.hasVariants ? (
                     product.variants.map(variant => (
                       <button
                         key={variant.id}
                         onClick={() => addToCart(product, variant)}
                         className="w-full bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-indigo-500 shadow-sm transition-all text-right flex flex-col gap-1 active:scale-95"
                       >
                          <span className="font-black text-[11px] text-slate-800 dark:text-white line-clamp-2 leading-tight">{product.name}</span>
                          <span className="text-[10px] font-black text-indigo-500">{Object.values(variant.options).join(' / ')}</span>
                          <div className="flex items-center justify-between mt-2">
                             <span className="text-xs font-black text-slate-900 dark:text-white">{variant.price} <span className="text-[10px]">ج.م</span></span>
                             <span className="text-[9px] font-bold text-slate-400">مخزن: {variant.stockQuantity || 0}</span>
                          </div>
                       </button>
                     ))
                   ) : (
                     <button
                       onClick={() => addToCart(product)}
                       className="w-full bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-indigo-500 shadow-sm transition-all text-right flex flex-col gap-1 active:scale-95 h-full"
                     >
                        <span className="font-black text-[11px] text-slate-800 dark:text-white line-clamp-2 leading-tight">{product.name}</span>
                        <div className="mt-auto flex items-center justify-between pt-2">
                            <span className="text-xs font-black text-slate-900 dark:text-white">{product.price} <span className="text-[10px]">ج.م</span></span>
                            <span className="text-[9px] font-bold text-slate-400">مخزن: {product.stockQuantity || 0}</span>
                        </div>
                     </button>
                   )}
                </div>
              ))}
           </div>
        </div>
      </div>

      {/* Cart & Checkout - Right Side */}
      <div className="w-full lg:w-[400px] flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden shrink-0">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-indigo-50/30 dark:bg-indigo-950/20">
           <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
             <ShoppingCart className="text-indigo-600" size={20} />
             سلة المبيعات
           </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar h-[300px]">
           {cart.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-3 italic">
               <Package size={48} className="opacity-20" />
               <p className="text-sm font-bold">السلة فارغة حالياً</p>
             </div>
           ) : (
             cart.map((item, idx) => (
               <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center gap-3 group">
                  <div className="flex-1 min-w-0">
                     <h4 className="text-xs font-black text-slate-800 dark:text-white truncate uppercase">{item.name}</h4>
                     <div className="text-[10px] font-black text-indigo-500">{item.price} ج.م لكل قطعة</div>
                  </div>
                  <div className="flex items-center gap-2">
                     <button onClick={() => updateQuantity(idx, -1)} className="w-6 h-6 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-rose-500"><Minus size={12}/></button>
                     <span className="w-6 text-center text-xs font-black">{item.quantity}</span>
                     <button onClick={() => updateQuantity(idx, 1)} className="w-6 h-6 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-indigo-600"><Plus size={12}/></button>
                  </div>
                  <button onClick={() => removeFromCart(idx)} className="p-1.5 text-slate-300 hover:text-rose-500"><X size={16}/></button>
               </div>
             ))
           )}
        </div>

        <div className="p-5 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 space-y-4 pb-20 lg:pb-5">
           {/* Store/Warehouse Select */}
           <div className="space-y-1.5 text-right">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">خصم من مستودع</label>
              <select 
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-10 px-3 rounded-xl text-xs font-black outline-none"
              >
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
           </div>

           {/* Payment Status (Cash/Credit) */}
           <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaymentStatusType('paid')}
                className={`p-2.5 rounded-xl font-black text-xs transition-all border ${paymentStatusType === 'paid' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'}`}
              >
                بيع نقدي
              </button>
              <button
                onClick={() => setPaymentStatusType('credit')}
                className={`p-2.5 rounded-xl font-black text-xs transition-all border ${paymentStatusType === 'credit' ? 'bg-amber-600 text-white border-amber-600 shadow-md' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'}`}
              >
                بيع أجل
              </button>
           </div>

           {/* Cash Holder Select */}
           <AnimatePresence>
             {paymentStatusType === 'paid' && (
               <motion.div 
                 initial={{ opacity: 0, height: 0 }}
                 animate={{ opacity: 1, height: 'auto' }}
                 exit={{ opacity: 0, height: 0 }}
                 className="space-y-1.5 text-right overflow-hidden"
               >
                  <label className="text-[10px] font-black text-slate-400 font-bold uppercase tracking-widest mr-1">المستلم (صاحب العهدة/الحساب)</label>
                  <select 
                    value={selectedCashHolder}
                    onChange={(e) => setSelectedCashHolder(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-10 px-3 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {allPossibleHolders.length > 0 ? (
                      allPossibleHolders.map(h => <option key={h.id} value={h.id}>{h.name}</option>)
                    ) : (
                      <option value="">لا يوجد موظفين متاحين</option>
                    )}
                  </select>
               </motion.div>
             )}
           </AnimatePresence>

           {/* Payment Method */}
           {paymentStatusType === 'paid' && (
             <div className="grid grid-cols-3 gap-2">
               {[
                 { id: 'cash', icon: <Banknote size={16}/>, label: 'كاش' },
                 { id: 'card', icon: <CreditCard size={16}/>, label: 'فيزا' },
                 { id: 'wallet', icon: <Wallet size={16}/>, label: 'محفظة' }
               ].map(method => (
                 <button
                   key={method.id}
                   onClick={() => setPaymentMethod(method.id as any)}
                   className={`flex flex-col items-center justify-center gap-1 p-2 rounded-2xl border transition-all ${paymentMethod === method.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20 scale-105' : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800'}`}
                 >
                   {method.icon}
                   <span className="text-[10px] font-black">{method.label}</span>
                 </button>
               ))}
             </div>
           )}

           {/* Customer Quick Info */}
           <div className="grid grid-cols-2 gap-2">
             <input 
               type="text" 
               placeholder="اسم العميل"
               value={customerInfo.name}
               onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
               className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-10 px-3 rounded-xl text-[10px] font-bold outline-none" 
             />
             <input 
               type="text" 
               placeholder="موبايل العميل"
               value={customerInfo.phone}
               onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
               className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-10 px-3 rounded-xl text-[10px] font-bold outline-none" 
             />
           </div>

           <div className="space-y-1">
             <input 
               type="text" 
               placeholder="عنوان العميل بالتفصيل"
               value={customerInfo.address}
               onChange={(e) => setCustomerInfo({...customerInfo, address: e.target.value})}
               className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-10 px-3 rounded-xl text-[10px] font-bold outline-none" 
             />
           </div>

           <div className="pt-2">
              <div className="flex items-center justify-between mb-4">
                 <span className="text-sm font-black text-slate-400 uppercase">الإجمالي النهائي</span>
                 <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">{totalAmount} <span className="text-xs">ج.م</span></span>
              </div>
              
              <button 
                onClick={handleCheckout}
                disabled={cart.length === 0}
                className={`w-full h-14 rounded-2xl font-black shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:grayscale disabled:opacity-50 ${paymentStatusType === 'credit' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'} text-white`}
              >
                 <CheckCircle2 size={24} />
                 {paymentStatusType === 'credit' ? 'حفظ كطلب أجل (غير مدفوع)' : 'إتمام البيع واستلام النقدية'}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default POSPage;
