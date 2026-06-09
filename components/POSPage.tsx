
// Testing edit ability
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
import { Settings, Product, ProductVariant, POSSale, POSSaleItem, Order, Wallet as WalletType, Transaction } from '../types';

import { exportHTMLToPDF } from '../utils/pdfHelper';
import { printHTMLDirectly } from '../utils/printHelper';

interface POSPageProps {
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
  orders: Order[];
  wallet: WalletType;
  updateStoreData: (data: any) => void;
  currentUser: any;
}

const POSPage: React.FC<POSPageProps> = ({ settings, updateSettings, orders, wallet, updateStoreData, currentUser }) => {
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
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [paymentStatusType, setPaymentStatusType] = useState<'paid' | 'credit'>('paid');
  const [selectedCashHolder, setSelectedCashHolder] = useState('');
  const [customerInfo, setCustomerInfo] = useState({ name: 'عميل نقدي', phone: '', address: '' });
  const [activeTab, setActiveTab] = useState<'checkout' | 'history'>('checkout');

  const products = settings.products || [];
  const warehouses = settings.warehouses || [];
  const cashHolders = settings.cashHolders || [];
  const allPossibleHolders = useMemo(() => [
    { id: 'admin', name: 'المدير (أنت)' },
    ...(settings.employees || []).map((e, index) => ({ id: `emp_${e.id || e.phone || index}`, name: e.name })),
    ...(settings.partners || []).map((p, index) => ({ id: `part_${p.id || index}`, name: `${p.name} (شريك)` }))
  ], [settings.employees, settings.partners]);

  const activePaymentMethods = settings.paymentMethods?.filter(m => m.active) || [
    { id: 'cash', name: 'كاش', logoUrl: '' },
    { id: 'card', name: 'فيزا', logoUrl: '' },
    { id: 'wallet', name: 'محفظة', logoUrl: '' }
  ];

  // Set the default cash holder with exact prefixed ID on load
  useEffect(() => {
    if (allPossibleHolders.length > 0) {
      const match = allPossibleHolders.find(h => 
        h.id === `emp_${currentUser?.id}` || 
        h.id === `part_${currentUser?.id}` ||
        h.id === currentUser?.id ||
        (currentUser?.role === 'admin' && h.id === 'admin')
      );
      if (match) {
        setSelectedCashHolder(match.id);
      } else {
        setSelectedCashHolder(allPossibleHolders[0].id);
      }
    }
  }, [allPossibleHolders, currentUser]);

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

  const updatePrice = (idx: number, newPrice: number) => {
    const newCart = [...cart];
    newCart[idx].price = Math.max(0, newPrice);
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
      
      const finalCashHolder = selectedCashHolder || allPossibleHolders[0]?.id || 'admin';
      const receiver = allPossibleHolders.find(h => h.id === finalCashHolder);
      const isCredit = paymentStatusType === 'credit';
      
      const newSale: POSSale = {
        id: saleId,
        saleNumber,
        date: new Date().toISOString(),
        items: cart,
        totalAmount,
        paymentMethod: (isCredit ? 'cash' : paymentMethod) as 'cash' | 'card' | 'wallet',
        warehouseId: selectedWarehouse,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        customerAddress: customerInfo.address,
        performedBy: currentUser?.fullName || currentUser?.email || 'كاشير',
        cashHolderId: isCredit ? 'credit' : finalCashHolder,
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
      let updatedPartners = [...(settings.partners || [])];
      let updatedPartnerTransactions = [...(settings.partnerTransactions || [])];

      if (!isCredit) {
        const hIdx = updatedHolders.findIndex(h => String(h.userId) === String(finalCashHolder));
        if (hIdx > -1) {
          updatedHolders[hIdx].currentBalance += totalAmount;
          updatedHolders[hIdx].lastUpdated = new Date().toISOString();
        } else {
          updatedHolders.push({
            userId: finalCashHolder,
            userName: receiver?.name || 'مستلم',
            currentBalance: totalAmount,
            lastUpdated: new Date().toISOString()
          });
        }

        // Synchronize directly with Partners tab if selected cash holder is a partner
        if (finalCashHolder.startsWith('part_')) {
          const actualPartnerId = finalCashHolder.substring(5);
          const partnerIdx = updatedPartners.findIndex(p => String(p.id) === String(actualPartnerId));
          if (partnerIdx > -1) {
            // Only update balance if it's not a POS collection
            
            updatedPartnerTransactions.push({
              id: `pos-${Date.now()}`,
              partnerId: actualPartnerId,
              type: 'pos_collection',
              amount: totalAmount,
              date: new Date().toISOString(),
              note: `استلام عهدة / مبيعات كاشير من نقطة البيع لطلب #${saleNumber}`
            });
          }
        }
      }

      const newSettings: Settings = {
        ...settings,
        products: updatedProducts,
        cashHolders: updatedHolders,
        partners: updatedPartners,
        partnerTransactions: updatedPartnerTransactions,
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
        channel: 'pos',
        stockDeducted: true,
        includeInspectionFee: false,
        inspectionFee: 0,
        isInsured: false,
        insuranceFee: 0
      };

      // Create wallet transaction
      const newTransaction: Transaction = {
        id: `pos-tx-${Date.now()}`,
        type: 'إيداع',
        amount: totalAmount,
        date: new Date().toISOString(),
        note: `مبيعات كاشير - طلب #${saleNumber}`,
        category: 'collection',
        status: 'completed',
        orderId: saleId,
        orderNumber: saleNumber
      };

      const updatedWallet: WalletType = {
        ...wallet,
        balance: (wallet.balance || 0) + totalAmount,
        transactions: [newTransaction, ...(wallet.transactions || [])]
      };

      // Perform a single atomic update to the store data
      updateStoreData({ 
        settings: newSettings, 
        orders: [newOrder, ...orders],
        wallet: updatedWallet
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
    <div className="flex flex-col h-full space-y-4" dir="rtl">
      {/* Tab Navigation */}
      <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 self-start">
        <button
          onClick={() => setActiveTab('checkout')}
          className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'checkout' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          نقطة البيع (كاشير)
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          سجل الحركات (POS Log)
        </button>
      </div>

      {activeTab === 'checkout' ? (
        <div className="flex flex-col lg:flex-row flex-1 gap-6 p-1 lg:p-0 pb-32 lg:pb-0 overflow-hidden">
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
                         <div className="flex items-center gap-1 mt-1">
                            <span className="text-[9px] font-bold text-slate-400">السعر:</span>
                            <input 
                               type="number"
                               value={item.price || ''}
                               onChange={(e) => updatePrice(idx, parseFloat(e.target.value) || 0)}
                               className="w-14 h-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-lg text-center text-[10px] font-black text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                               min="0"
                            />
                            <span className="text-[9px] font-black text-slate-400">ج.م</span>
                         </div>
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
                        value={selectedCashHolder || (allPossibleHolders[0]?.id || '')}
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
      ) : (
        <POSSalesLog 
          sales={settings.posSales || []} 
          settings={settings} 
          updateSettings={updateSettings} 
          updateStoreData={updateStoreData}
          allHolders={allPossibleHolders}
          orders={orders}
          wallet={wallet}
        />
      )}
    </div>
  );
};

interface POSSalesLogProps {
  sales: POSSale[];
  settings: Settings;
  updateSettings: (s: Settings) => void;
  updateStoreData: (data: any) => void;
  allHolders: { id: string; name: string }[];
  orders: Order[];
  wallet: WalletType;
}

const POSSalesLog: React.FC<POSSalesLogProps> = ({ sales, settings, updateSettings, updateStoreData, allHolders, orders, wallet }) => {
  const [filter, setFilter] = useState({
    startDate: '',
    endDate: '',
    cashier: '',
    paymentType: '',
    searchTerm: ''
  });

  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      const saleDate = new Date(sale.date);
      const start = filter.startDate ? new Date(filter.startDate) : null;
      const end = filter.endDate ? new Date(filter.endDate) : null;
      
      const dateMatch = (!start || saleDate >= start) && (!end || saleDate <= end);
      const cashierMatch = !filter.cashier || sale.performedBy === filter.cashier;
      const paymentMatch = !filter.paymentType || 
                          (filter.paymentType === 'credit' ? sale.cashHolderId === 'credit' : sale.cashHolderId !== 'credit');
      const searchMatch = !filter.searchTerm || 
                          sale.saleNumber.includes(filter.searchTerm) || 
                          sale.customerName?.toLowerCase().includes(filter.searchTerm.toLowerCase()) ||
                          sale.customerPhone?.includes(filter.searchTerm);

      return dateMatch && cashierMatch && paymentMatch && searchMatch;
    });
  }, [sales, filter]);

  const totalFilteredAmount = filteredSales.reduce((acc, s) => acc + s.totalAmount, 0);

  const [editingSale, setEditingSale] = useState<POSSale | null>(null);

  const handleUpdateSale = (updated: POSSale) => {
     // Find the sale and update it
     const newSales = sales.map(s => s.id === updated.id ? updated : s);
     
     // Update relevant Order as well if it exists
     const newOrders = orders.map(o => {
       if (o.id === updated.id) {
         return {
           ...o,
           customerName: updated.customerName || o.customerName,
           customerPhone: updated.customerPhone || o.customerPhone,
           customerAddress: updated.customerAddress || o.customerAddress,
           notes: updated.notes || o.notes
         };
       }
       return o;
     });

     updateStoreData({
       settings: { ...settings, posSales: newSales },
       orders: newOrders
     });
     setEditingSale(null);
  };

  const handleDeleteSale = (saleId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه العملية؟ سيتم استعادة المخزون تلقائياً.')) return;

    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;

    // 1. Restore Stock
    const updatedProducts = [...(settings.products || [])];
    sale.items.forEach(item => {
      const pIdx = updatedProducts.findIndex(p => p.id === item.productId);
      if (pIdx > -1) {
        const prod = { ...updatedProducts[pIdx] };
        if (item.variantId && prod.variants) {
          prod.variants = prod.variants.map(v => {
            if (v.id === item.variantId) {
              const vUpdated = { ...v };
              vUpdated.stockQuantity = (vUpdated.stockQuantity || 0) + item.quantity;
              vUpdated.warehouseStock = { ...(vUpdated.warehouseStock || {}) };
              vUpdated.warehouseStock[sale.warehouseId] = (vUpdated.warehouseStock[sale.warehouseId] || 0) + item.quantity;
              return vUpdated;
            }
            return v;
          });
        } else {
          prod.stockQuantity = (prod.stockQuantity || 0) + item.quantity;
          prod.warehouseStock = { ...(prod.warehouseStock || {}) };
          prod.warehouseStock[sale.warehouseId] = (prod.warehouseStock[sale.warehouseId] || 0) + item.quantity;
        }
        updatedProducts[pIdx] = prod;
      }
    });

    // 2. Remove Transaction from Wallet if not credit
    let updatedWallet = { ...wallet || { balance: 0, transactions: [] } };
    if (sale.cashHolderId !== 'credit') {
      updatedWallet.balance = (updatedWallet.balance || 0) - sale.totalAmount;
      updatedWallet.transactions = (updatedWallet.transactions || []).filter(t => t.orderId !== sale.id);
    }

    // 3. Remove from POS Sales
    const newSales = sales.filter(s => s.id !== saleId);

    // 4. Remove equivalent Order
    const newOrders = orders.filter(o => o.id !== saleId);

    updateStoreData({
      settings: { ...settings, products: updatedProducts, posSales: newSales },
      orders: newOrders,
      wallet: updatedWallet
    });
  };

  const handlePrintReport = (mode: 'print' | 'pdf') => {
    const html = `
      <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; background: white !important; color: #1e293b;">
        <style>
          @media print {
            body { background: white !important; }
            .no-print { display: none !important; }
          }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background-color: #4f46e5 !important; color: white !important; -webkit-print-color-adjust: exact; }
          td, th { border: 1px solid #e2e8f0; padding: 12px; text-align: right; }
          .summary-box { display: flex; justify-content: space-between; margin-bottom: 30px; background: #f8fafc !important; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; -webkit-print-color-adjust: exact; }
        </style>
        
        <div style="text-align: center; margin-bottom: 40px; border-bottom: 3px solid #4f46e5; padding-bottom: 20px;">
          <h1 style="color: #1e293b; font-size: 28px; margin: 0;">تقرير مبيعات نقطة البيع (POS)</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 8px;">تاريخ استخراج التقرير: ${new Date().toLocaleString('ar-EG')}</p>
        </div>

        <div class="summary-box">
          <div>
            <span style="color: #64748b; font-size: 12px; display: block; margin-bottom: 4px;">إجمالي المبيعات (الفلتر الحالي)</span>
            <span style="color: #4f46e5; font-size: 24px; font-weight: 900;">${totalFilteredAmount.toLocaleString()} ج.م</span>
          </div>
          <div style="text-align: left;">
            <span style="color: #64748b; font-size: 12px; display: block; margin-bottom: 4px;">إجمالي العمليات</span>
            <span style="color: #1e293b; font-size: 24px; font-weight: 900;">${filteredSales.length} حركة</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 15%;">رقم الحركة</th>
              <th style="width: 15%;">التاريخ</th>
              <th style="width: 20%;">العميل</th>
              <th style="width: 15%;">الكاشير</th>
              <th style="width: 20%;">المستلم (في العهدة)</th>
              <th style="width: 15%;">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            ${filteredSales.map(s => `
              <tr>
                <td style="font-weight: bold; color: #4f46e5;">#${s.saleNumber}</td>
                <td style="font-size: 11px;">${new Date(s.date).toLocaleDateString('ar-EG')}</td>
                <td style="font-size: 11px;">${s.customerName || 'عميل نقدي'}</td>
                <td style="font-size: 11px;">${s.performedBy}</td>
                <td style="font-size: 11px; font-weight: bold; background: #fff7ed !important; -webkit-print-color-adjust: exact;">
                  <div style="color: #9a3412; font-size: 9px; margin-bottom: 2px;">بعهدة:</div>
                  <div style="color: ${s.cashHolderId === 'credit' ? '#b45309' : '#1e293b'};">
                    ${s.cashHolderName || (s.cashHolderId === 'credit' ? 'حساب آجل (مديونية)' : 'غير محدد')}
                  </div>
                </td>
                <td style="font-size: 13px; font-weight: 900; background: #f1f5f9 !important; text-align: center; -webkit-print-color-adjust: exact;">${s.totalAmount.toLocaleString()} ج.م</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background-color: #f8fafc !important; font-weight: bold; -webkit-print-color-adjust: exact;">
              <td colspan="5" style="padding: 15px; text-align: left; font-size: 14px;">إجمالي القيمة المستخرجة</td>
              <td style="padding: 15px; text-align: center; color: #4f46e5; font-size: 16px;">${totalFilteredAmount.toLocaleString()} ج.م</td>
            </tr>
          </tfoot>
        </table>
        
        <div style="margin-top: 50px; border-top: 1px dashed #e2e8f0; padding-top: 20px; font-size: 10px; color: #94a3b8; text-align: center;">
          هذا المستند يعتبر تقرير داخلي ولا يعتد به كفاتورة ضريبية • تم الاستخراج بنجاح بواسطة النظام الذكي لعام ${new Date().getFullYear()}
        </div>
      </div>
    `;
    
    if (mode === 'print') {
      printHTMLDirectly(html);
    } else {
      exportHTMLToPDF(html, 'landscape', `تقرير_مبيعات_POS_${new Date().toISOString().split('T')[0]}.pdf`);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6" dir="rtl">
       <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="space-y-1">
             <h2 className="text-2xl font-black text-slate-800 dark:text-white">سجل حركات نقطة البيع</h2>
             <p className="text-sm text-slate-500 font-bold">عرض وفلترة جميع العمليات التي تمت عبر الكاشير</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="bg-indigo-50 dark:bg-indigo-950/30 px-6 py-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                <span className="text-[10px] font-black text-indigo-400 block uppercase">إجمالي مبيعات الفلتر</span>
                <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">{totalFilteredAmount.toLocaleString()} ج.م</span>
             </div>
             <button 
                onClick={() => handlePrintReport('print')}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:scale-105 transition-all"
             >
                <Printer size={20} />
                معاينة وطباعة
             </button>
             <button 
                onClick={() => handlePrintReport('pdf')}
                className="flex items-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
             >
                تحميل PDF
             </button>
          </div>
       </div>

       {/* Filters */}
       <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-700/50 mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-1.5">
             <label className="text-[10px] font-black text-slate-400 mr-1 uppercase">البحث برقم الطلب أو العميل</label>
             <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="بحث..."
                  value={filter.searchTerm}
                  onChange={(e) => setFilter({...filter, searchTerm: e.target.value})}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-10 pl-10 pr-4 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
             </div>
          </div>
          <div className="space-y-1.5">
             <label className="text-[10px] font-black text-slate-400 mr-1 uppercase">من تاريخ</label>
             <input 
               type="date"
               value={filter.startDate}
               onChange={(e) => setFilter({...filter, startDate: e.target.value})}
               className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-10 px-4 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500/20"
             />
          </div>
          <div className="space-y-1.5">
             <label className="text-[10px] font-black text-slate-400 mr-1 uppercase">إلى تاريخ</label>
             <input 
               type="date"
               value={filter.endDate}
               onChange={(e) => setFilter({...filter, endDate: e.target.value})}
               className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-10 px-4 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500/20"
             />
          </div>
          <div className="space-y-1.5">
             <label className="text-[10px] font-black text-slate-400 mr-1 uppercase">الموظف (الكاشير)</label>
             <select 
               value={filter.cashier}
               onChange={(e) => setFilter({...filter, cashier: e.target.value})}
               className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-10 px-4 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500/20"
             >
                <option value="">الكل</option>
                {Array.from(new Set(sales.map(s => s.performedBy))).map(c => <option key={c} value={c}>{c}</option>)}
             </select>
          </div>
          <div className="space-y-1.5">
             <label className="text-[10px] font-black text-slate-400 mr-1 uppercase">نوع الدفع</label>
             <select 
               value={filter.paymentType}
               onChange={(e) => setFilter({...filter, paymentType: e.target.value})}
               className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-10 px-4 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500/20"
             >
                <option value="">الكل</option>
                <option value="cash">نقدي</option>
                <option value="credit">آجل / عهدة</option>
             </select>
          </div>
       </div>

       {/* Sales Table */}
       <div className="flex-1 overflow-x-auto min-h-0 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <table className="w-full border-collapse">
             <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/80 sticky top-0 z-10 backdrop-blur-sm">
                   <th className="p-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">رقم البيع</th>
                   <th className="p-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">التاريخ</th>
                   <th className="p-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">العميل</th>
                   <th className="p-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">بواسطة</th>
                   <th className="p-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">المستلم</th>
                   <th className="p-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">الإجمالي</th>
                   <th className="p-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700 text-center">الإجراءات</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSales.map(sale => (
                   <tr key={sale.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                      <td className="p-4">
                         <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <Receipt size={14} className="text-indigo-500" />
                            {sale.saleNumber}
                         </span>
                      </td>
                      <td className="p-4">
                         <div className="flex flex-col">
                            <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">{new Date(sale.date).toLocaleDateString('ar-EG')}</span>
                            <span className="text-[9px] font-bold text-slate-400">{new Date(sale.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                         </div>
                      </td>
                      <td className="p-4">
                         <div className="flex flex-col max-w-[150px]">
                            <span className="text-xs font-black text-slate-800 dark:text-white truncate">{sale.customerName || 'عميل نقدي'}</span>
                            <span className="text-[10px] font-bold text-slate-400">{sale.customerPhone || '-'}</span>
                         </div>
                      </td>
                      <td className="p-4">
                         <span className="text-xs font-black text-slate-700 dark:text-slate-300">{sale.performedBy}</span>
                      </td>
                      <td className="p-4">
                         <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase mb-0.5">بعهدة:</span>
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black inline-block w-fit ${sale.cashHolderId === 'credit' ? 'bg-amber-50 text-amber-700 border border-amber-200/50 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-200/50 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30'}`}>
                                {sale.cashHolderName || (sale.cashHolderId === 'credit' ? 'حساب آجل' : 'غير محدد')}
                            </span>
                         </div>
                      </td>
                      <td className="p-4">
                         <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">{sale.totalAmount.toLocaleString()} ج.م</span>
                      </td>
                      <td className="p-4">
                         <div className="flex items-center justify-center gap-2">
                            <button 
                               onClick={() => setEditingSale(sale)}
                               className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-all"
                               title="تعديل"
                            >
                               <Monitor size={16} />
                            </button>
                            <button 
                               onClick={() => handleDeleteSale(sale.id)}
                               className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all"
                               title="حذف"
                            >
                               <Trash2 size={16} />
                            </button>
                         </div>
                      </td>
                   </tr>
                ))}
                {filteredSales.length === 0 && (
                   <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400/50">
                         <div className="flex flex-col items-center gap-4">
                            <SearchCode size={48} className="opacity-20" />
                            <p className="font-black text-sm italic">لا توجد عمليات مبيعات تطابق الفلتر الحالي</p>
                         </div>
                      </td>
                   </tr>
                )}
             </tbody>
          </table>
       </div>

       {/* Edit Sale Modal */}
       {editingSale && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            >
               <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                     <Receipt className="text-indigo-500" size={24} />
                     تعديل عملية بيع #{editingSale.saleNumber}
                  </h3>
                  <button onClick={() => setEditingSale(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all text-slate-400"><X size={24}/></button>
               </div>
               <div className="p-8 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest italic">اسم العميل</label>
                        <input 
                           type="text" 
                           value={editingSale.customerName || ''}
                           onChange={(e) => setEditingSale({...editingSale, customerName: e.target.value})}
                           className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700/50 rounded-2xl px-5 text-sm font-black focus:border-indigo-500 transition-all outline-none" 
                        />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest italic">رقم الموبايل</label>
                        <input 
                           type="text" 
                           value={editingSale.customerPhone || ''}
                           onChange={(e) => setEditingSale({...editingSale, customerPhone: e.target.value})}
                           className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700/50 rounded-2xl px-5 text-sm font-black focus:border-indigo-500 transition-all outline-none" 
                        />
                     </div>
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest italic">العنوان / ملاحظات البيع</label>
                     <textarea 
                        value={editingSale.notes || ''}
                        onChange={(e) => setEditingSale({...editingSale, notes: e.target.value})}
                        className="w-full h-24 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700/50 rounded-2xl p-5 text-sm font-black focus:border-indigo-500 transition-all outline-none resize-none" 
                     />
                  </div>
                  <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30">
                     <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">تفاصيل الأصناف (للعرض فقط)</h4>
                     <div className="space-y-2">
                        {editingSale.items.map((item, idx) => (
                           <div key={idx} className="flex items-center justify-between text-xs font-black text-slate-600 dark:text-slate-300">
                              <span>{item.name} × {item.quantity}</span>
                              <span className="tabular-nums">{(item.price * item.quantity).toLocaleString()} ج.م</span>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
               <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                  <button 
                     onClick={() => handleUpdateSale(editingSale)}
                     className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white h-12 rounded-2xl font-black shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                  >
                     حفظ التغييرات
                  </button>
                  <button 
                     onClick={() => setEditingSale(null)}
                     className="px-8 h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 rounded-2xl font-black hover:bg-slate-50 active:scale-95"
                  >
                     إلغاء
                  </button>
               </div>
            </motion.div>
         </div>
       )}
    </div>
  );
};

export default POSPage;
