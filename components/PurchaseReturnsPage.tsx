import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RotateCw, 
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
  Truck,
  Package,
  Warehouse,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { Settings, PurchaseReturn, PurchaseReturnItem, Product, ProductVariant } from '../types';

interface PurchaseReturnsPageProps {
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
  currentUser: any;
}

const PurchaseReturnsPage: React.FC<PurchaseReturnsPageProps> = ({ settings, updateSettings, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'history' | 'create'>('history');
  const [selectedReturn, setSelectedReturn] = useState<PurchaseReturn | null>(null);

  // Create Return Form State
  const [newReturn, setNewReturn] = useState<Partial<PurchaseReturn>>({
    supplierId: '',
    warehouseId: '',
    items: [],
    notes: '',
    status: 'completed'
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [itemSearch, setItemSearch] = useState('');

  const suppliers = settings.suppliers || [];
  const warehouses = settings.warehouses || [];
  const products = settings.products || [];
  const purchaseReturns = settings.purchaseReturns || [];

  const handleAddItem = (product: Product, variant?: ProductVariant) => {
    const existing = newReturn.items?.find(item => 
      variant ? (item.productId === product.id && item.variantId === variant.id) : (item.productId === product.id && !item.variantId)
    );

    if (existing) return;

    const newItem: PurchaseReturnItem = {
      productId: product.id,
      variantId: variant?.id,
      name: variant ? `${product.name} (${Object.values(variant.options).join(' / ')})` : product.name,
      sku: variant?.sku || product.sku,
      quantity: 1,
      costPrice: variant?.costPrice || product.costPrice || 0
    };

    setNewReturn({
      ...newReturn,
      items: [...(newReturn.items || []), newItem]
    });
    setItemSearch('');
  };

  const handleRemoveItem = (index: number) => {
    const items = [...(newReturn.items || [])];
    items.splice(index, 1);
    setNewReturn({ ...newReturn, items });
  };

  const handleUpdateItem = (index: number, field: keyof PurchaseReturnItem, value: any) => {
    const items = [...(newReturn.items || [])];
    items[index] = { ...items[index], [field]: value };
    setNewReturn({ ...newReturn, items });
  };

  const handleExecuteReturn = () => {
    if (!newReturn.supplierId) return alert('يرجى اختيار المورد');
    if (!newReturn.warehouseId) return alert('يرجى اختيار المستودع الذي سيتم السحب منه');
    if (!newReturn.items || newReturn.items.length === 0) return alert('يرجى إضافة منتج واحد على الأقل');

    const returnId = `PRET-${Date.now()}`;
    const returnNumber = `PR-${String(purchaseReturns.length + 1).padStart(5, '0')}`;
    const totalRefund = (newReturn.items || []).reduce((acc, i) => acc + (i.quantity * i.costPrice), 0);
    
    const returnData: PurchaseReturn = {
      id: returnId,
      returnNumber,
      supplierId: newReturn.supplierId!,
      supplierName: suppliers.find(s => s.id === newReturn.supplierId)?.name || 'مورد غير معروف',
      date: new Date().toISOString(),
      items: newReturn.items as PurchaseReturnItem[],
      totalRefundAmount: totalRefund,
      warehouseId: newReturn.warehouseId!,
      status: 'completed',
      notes: newReturn.notes,
      performedBy: currentUser?.fullName || currentUser?.email || 'System'
    };

    // Update product stocks
    const updatedProducts = [...settings.products];
    returnData.items.forEach(item => {
      const pIdx = updatedProducts.findIndex(p => p.id === item.productId);
      if (pIdx > -1) {
        const prod = { ...updatedProducts[pIdx] };
        
        if (item.variantId && prod.variants) {
          prod.variants = prod.variants.map(v => {
            if (v.id === item.variantId) {
              const vUpdated = { ...v };
              vUpdated.stockQuantity = Math.max(0, (vUpdated.stockQuantity || 0) - item.quantity);
              vUpdated.warehouseStock = { ...(vUpdated.warehouseStock || {}) };
              vUpdated.warehouseStock[returnData.warehouseId] = Math.max(0, (vUpdated.warehouseStock[returnData.warehouseId] || 0) - item.quantity);
              return vUpdated;
            }
            return v;
          });
        } else {
          prod.stockQuantity = Math.max(0, (prod.stockQuantity || 0) - item.quantity);
          prod.warehouseStock = { ...(prod.warehouseStock || {}) };
          prod.warehouseStock[returnData.warehouseId] = Math.max(0, (prod.warehouseStock[returnData.warehouseId] || 0) - item.quantity);
        }
        
        updatedProducts[pIdx] = prod;
      }
    });

    // Save
    updateSettings({
      ...settings,
      products: updatedProducts,
      purchaseReturns: [returnData, ...purchaseReturns],
      activityLogs: [
        {
          id: `log-${Date.now()}`,
          user: currentUser?.fullName || 'النظام',
          action: 'مرتجع مشتريات',
          details: `إعادة ${returnData.items.length} أصناف للمورد ${returnData.supplierName} بقيمة ${returnData.totalRefundAmount} ج.م`,
          date: new Date().toLocaleString('ar-EG'),
          timestamp: Date.now()
        },
        ...(settings.activityLogs || [])
      ]
    });

    setNewReturn({
      supplierId: '',
      warehouseId: '',
      items: [],
      notes: '',
      status: 'completed'
    });
    setActiveTab('history');
    alert('تم تنفيذ مرتجع المشتريات وتحديث المخزون بنجاح');
  };

  const filteredReturns = purchaseReturns.filter(r => 
    r.returnNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.supplierName.includes(searchTerm)
  );

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <RotateCw className="text-amber-500" />
            مرتجعات المشتريات (للموردين)
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-bold mt-1">إدارة المرتجعات الصادرة للموردين وحركات المخزون</p>
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
            مرتجع جديد
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'history' ? (
          <motion.div 
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Filter Bar */}
            <div className="glass-card p-4 rounded-2xl">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="البحث برقم المرتجع أو المورد..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-12 pr-4 py-3 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>
            </div>

            {/* List */}
            <div className="space-y-3">
              {filteredReturns.length === 0 ? (
                <div className="text-center py-20 glass-card rounded-2xl">
                  <RotateCw size={48} className="mx-auto text-slate-200 dark:text-slate-800 mb-4" />
                  <p className="text-slate-500 font-bold">لا يوجد سجلات مرتجعات للموردين حالياً</p>
                </div>
              ) : (
                filteredReturns.map(ret => (
                  <motion.div 
                    layout
                    key={ret.id}
                    className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-amber-200 dark:hover:border-amber-900 transition-all cursor-pointer group"
                    onClick={() => setSelectedReturn(selectedReturn?.id === ret.id ? null : ret)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 border border-amber-100 dark:border-amber-900/30">
                          <FileText size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                             <h4 className="font-black text-slate-800 dark:text-white">{ret.returnNumber}</h4>
                             <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/30 text-amber-600 text-[10px] font-black rounded-lg border border-amber-100 uppercase">مكتمل</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                            <span className="flex items-center gap-1.5"><Clock size={12} /> {new Date(ret.date).toLocaleDateString('ar-EG')}</span>
                            <span className="flex items-center gap-1.5"><Truck size={12} /> {ret.supplierName}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-left">
                           <div className="text-[10px] text-slate-400 font-bold mb-0.5 uppercase">إجمالي المرتجع</div>
                           <div className="text-lg font-black text-amber-600 tabular-nums">{ret.totalRefundAmount} <span className="text-[10px]">ج.م</span></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-slate-800 dark:text-white">{ret.items.length}</span>
                          <span className="text-xs text-slate-400 font-bold">منتج</span>
                          {selectedReturn?.id === ret.id ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {selectedReturn?.id === ret.id && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 overflow-hidden"
                        >
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300">
                                 المستودع: <span className="text-slate-900 dark:text-white">{warehouses.find(w => w.id === ret.warehouseId)?.name}</span>
                              </div>
                              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300">
                                 بواسطة: <span className="text-slate-900 dark:text-white">{ret.performedBy}</span>
                              </div>
                           </div>

                           <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                             <table className="w-full text-right text-xs">
                               <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400 font-black h-10 border-b border-slate-100 dark:border-slate-700">
                                 <tr>
                                   <th className="pr-4">الصنف</th>
                                   <th className="px-2">الكمية</th>
                                   <th className="px-2">سعر التكلفة</th>
                                   <th className="pl-4 text-left">الإجمالي</th>
                                 </tr>
                               </thead>
                               <tbody>
                                 {ret.items.map((item, i) => (
                                   <tr key={i} className="h-10 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-50 dark:border-slate-800 last:border-0 font-bold">
                                     <td className="pr-4 text-slate-800 dark:text-white">{item.name}</td>
                                     <td className="px-2 tabular-nums">{item.quantity}</td>
                                     <td className="px-2 tabular-nums">{item.costPrice} ج.م</td>
                                     <td className="pl-4 text-left tabular-nums text-amber-600">{item.costPrice * item.quantity} ج.م</td>
                                   </tr>
                                 ))}
                               </tbody>
                             </table>
                           </div>
                           {ret.notes && (
                             <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl text-xs text-amber-700 dark:text-amber-400">
                               <strong>ملاحظات:</strong> {ret.notes}
                             </div>
                           )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="create"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* Create Form */}
            <div className="lg:col-span-8 space-y-6">
              {/* Setup */}
              <div className="glass-card p-6 rounded-3xl space-y-6">
                 <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <Truck size={20} className="text-amber-500" />
                    <h3 className="font-black text-slate-800 dark:text-white">إعداد فاتورة المرتجع</h3>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-xs font-black text-slate-500 uppercase tracking-wider mr-1">المورد</label>
                       <select 
                         value={newReturn.supplierId}
                         onChange={(e) => setNewReturn({...newReturn, supplierId: e.target.value})}
                         className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm outline-none focus:ring-4 focus:ring-indigo-500/10"
                       >
                         <option value="">-- اختر المورد --</option>
                         {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-black text-slate-500 uppercase tracking-wider mr-1">المستودع للصرف</label>
                       <select 
                         value={newReturn.warehouseId}
                         onChange={(e) => setNewReturn({...newReturn, warehouseId: e.target.value})}
                         className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm outline-none focus:ring-4 focus:ring-indigo-500/10"
                       >
                         <option value="">-- اختر المستودع --</option>
                         {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                       </select>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider mr-1">ملاحظات (اختياري)</label>
                    <textarea 
                      value={newReturn.notes}
                      onChange={(e) => setNewReturn({...newReturn, notes: e.target.value})}
                      placeholder="اكتب سبب الارجاع أو ملاحظات إضافية..."
                      rows={2}
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 resize-none"
                    />
                 </div>
              </div>

              {/* Items */}
              <div className="glass-card p-6 rounded-3xl space-y-4">
                 <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                    <h3 className="font-black text-slate-800 dark:text-white">الأصناف المرتجعة</h3>
                    <span className="text-xs font-black text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-3 py-1 rounded-full">
                       الإجمالي: {(newReturn.items || []).reduce((acc, i) => acc + (i.quantity * i.costPrice), 0)} ج.م
                    </span>
                 </div>

                 {(!newReturn.items || newReturn.items.length === 0) ? (
                   <div className="py-12 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                      <Package size={40} className="mx-auto text-slate-200 dark:text-slate-800 mb-3" />
                      <p className="text-slate-400 font-bold">لم يتم إضافة أصناف للمرتجع</p>
                   </div>
                 ) : (
                   <div className="space-y-3">
                      {newReturn.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-amber-100 transition-all">
                           <div className="flex-1">
                              <div className="font-black text-slate-800 dark:text-white text-sm">{item.name}</div>
                              <div className="flex items-center gap-3 mt-1">
                                 <span className="text-[10px] font-mono text-slate-400 underline">{item.sku}</span>
                                 <div className="flex items-center gap-1.5 text-xs">
                                    <span className="text-slate-400 font-bold">التكلفة:</span>
                                    <input 
                                      type="number"
                                      value={item.costPrice}
                                      onChange={(e) => handleUpdateItem(idx, 'costPrice', Number(e.target.value))}
                                      className="w-20 bg-slate-50 dark:bg-slate-800 border-0 h-6 rounded px-1.5 font-black text-center text-amber-600 outline-none"
                                    />
                                    <span className="text-[10px] font-bold text-slate-400">ج.م</span>
                                 </div>
                              </div>
                           </div>
                           
                           <div className="flex items-center gap-6">
                              <div className="flex items-center gap-2">
                                <button onClick={() => handleUpdateItem(idx, 'quantity', Math.max(1, item.quantity - 1))} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">-</button>
                                <input 
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateItem(idx, 'quantity', Number(e.target.value))}
                                  className="w-12 h-8 bg-transparent text-center font-black text-sm outline-none"
                                />
                                <button onClick={() => handleUpdateItem(idx, 'quantity', item.quantity + 1)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">+</button>
                              </div>
                              <button onClick={() => handleRemoveItem(idx)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl"><Trash2 size={18} /></button>
                           </div>
                        </div>
                      ))}
                   </div>
                 )}

                 <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                    <button 
                      onClick={handleExecuteReturn}
                      className="w-full bg-amber-500 text-white h-14 rounded-2xl font-black shadow-xl shadow-amber-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-3"
                    >
                       <CheckCircle2 size={24} />
                       إتمام فاتورة المرتجع وخصم من المخزن
                    </button>
                 </div>
              </div>
            </div>

            {/* Product Pick */}
            <div className="lg:col-span-4">
              <div className="glass-card p-6 rounded-3xl sticky top-6">
                 <h3 className="font-black text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">إضافة صنف للمرتجع</h3>
                 <div className="relative mb-6">
                    <input 
                      type="text"
                      placeholder="ابحث بالاسم أو SKU..."
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-4 pr-10 py-3 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                    />
                    <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                 </div>

                 <div className="space-y-2 max-h-[500px] overflow-y-auto no-scrollbar pr-1">
                   {products
                     .filter(p => p.name.toLowerCase().includes(itemSearch.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(itemSearch.toLowerCase())))
                     .slice(0, 10)
                     .map(product => (
                       <div key={product.id} className="space-y-1">
                         {product.hasVariants ? (
                           product.variants.map(variant => (
                             <button
                               key={variant.id}
                               onClick={() => handleAddItem(product, variant)}
                               disabled={newReturn.items?.some(i => i.productId === product.id && i.variantId === variant.id)}
                               className="w-full bg-white dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-amber-200 text-right flex flex-col items-start gap-1 disabled:opacity-40"
                             >
                               <span className="font-black text-[11px] text-slate-800 dark:text-white line-clamp-1">{product.name}</span>
                               <span className="text-[10px] font-bold text-amber-500">{Object.values(variant.options).join(' / ')}</span>
                               <span className="text-[9px] font-mono text-slate-400">المخزن: {variant.stockQuantity || 0}</span>
                             </button>
                           ))
                         ) : (
                           <button
                             onClick={() => handleAddItem(product)}
                             disabled={newReturn.items?.some(i => i.productId === product.id && !i.variantId)}
                             className="w-full bg-white dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-amber-200 text-right flex flex-col items-start gap-1 disabled:opacity-40"
                           >
                             <span className="font-black text-[11px] text-slate-800 dark:text-white line-clamp-1">{product.name}</span>
                             <span className="text-[9px] font-mono text-slate-400">المخزن: {product.stockQuantity || 0}</span>
                           </button>
                         )}
                       </div>
                     ))}
                 </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PurchaseReturnsPage;
