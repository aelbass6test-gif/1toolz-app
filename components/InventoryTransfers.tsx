
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRightLeft, 
  Plus, 
  Search, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  X, 
  ChevronDown,
  ChevronUp,
  History,
  FileText,
  Warehouse as WarehouseIcon,
  User,
  ArrowLeft,
  Package
} from 'lucide-react';
import { Settings, Warehouse, Product, StockTransfer, StockTransferItem, ProductVariant } from '../types';

interface InventoryTransfersProps {
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
  currentUser: any;
}

const InventoryTransfers: React.FC<InventoryTransfersProps> = ({ settings, updateSettings, currentUser }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'create'>('history');
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);

  // New Transfer Form State
  const [newTransfer, setNewTransfer] = useState<Partial<StockTransfer>>({
    sourceWarehouseId: '',
    destinationWarehouseId: '',
    items: [],
    notes: '',
    status: 'completed'
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [itemSearch, setItemSearch] = useState('');

  const warehouses = settings.warehouses || [];
  const products = settings.products || [];
  const transfers = settings.stockTransfers || [];

  const handleAddItem = (product: Product, variant?: ProductVariant) => {
    const itemId = variant ? `${product.id}-${variant.id}` : product.id;
    const existing = newTransfer.items?.find(item => 
      variant ? (item.productId === product.id && item.variantId === variant.id) : (item.productId === product.id && !item.variantId)
    );

    if (existing) return;

    const newItem: StockTransferItem = {
      productId: product.id,
      variantId: variant?.id,
      name: variant ? `${product.name} (${Object.values(variant.options).join(' / ')})` : product.name,
      sku: variant?.sku || product.sku,
      quantity: 1
    };

    setNewTransfer({
      ...newTransfer,
      items: [...(newTransfer.items || []), newItem]
    });
    setItemSearch('');
  };

  const handleRemoveItem = (index: number) => {
    const items = [...(newTransfer.items || [])];
    items.splice(index, 1);
    setNewTransfer({ ...newTransfer, items });
  };

  const handleUpdateQty = (index: number, qty: number) => {
    const items = [...(newTransfer.items || [])];
    items[index].quantity = Math.max(1, qty);
    setNewTransfer({ ...newTransfer, items });
  };

  const validateTransfer = () => {
    if (!newTransfer.sourceWarehouseId) return "يرجى اختيار مستودع المصدر";
    if (!newTransfer.destinationWarehouseId) return "يرجى اختيار مستودع الوجهة";
    if (newTransfer.sourceWarehouseId === newTransfer.destinationWarehouseId) return "لا يمكن النقل لنفس المستودع";
    if (!newTransfer.items || newTransfer.items.length === 0) return "يرجى إضافة منتج واحد على الأقل";
    return null;
  };

  const handleExecuteTransfer = () => {
    const error = validateTransfer();
    if (error) {
      alert(error);
      return;
    }

    const transferId = `TRF-${Date.now()}`;
    const transferNumber = `T${String(transfers.length + 1).padStart(5, '0')}`;
    
    const transferData: StockTransfer = {
      id: transferId,
      transferNumber,
      date: new Date().toISOString(),
      sourceWarehouseId: newTransfer.sourceWarehouseId!,
      destinationWarehouseId: newTransfer.destinationWarehouseId!,
      items: newTransfer.items!,
      status: 'completed',
      notes: newTransfer.notes,
      performedBy: currentUser?.fullName || currentUser?.email || 'System'
    };

    // Update product stocks
    const updatedProducts = [...settings.products];
    transferData.items.forEach(item => {
      const pIdx = updatedProducts.findIndex(p => p.id === item.productId);
      if (pIdx > -1) {
        const prod = { ...updatedProducts[pIdx] };
        
        if (item.variantId && prod.variants) {
          prod.variants = prod.variants.map(v => {
            if (v.id === item.variantId) {
              const vUpdated = { ...v };
              vUpdated.warehouseStock = { ...(vUpdated.warehouseStock || {}) };
              vUpdated.warehouseStock[transferData.sourceWarehouseId] = (vUpdated.warehouseStock[transferData.sourceWarehouseId] || 0) - item.quantity;
              vUpdated.warehouseStock[transferData.destinationWarehouseId] = (vUpdated.warehouseStock[transferData.destinationWarehouseId] || 0) + item.quantity;
              return vUpdated;
            }
            return v;
          });
        } else {
          prod.warehouseStock = { ...(prod.warehouseStock || {}) };
          prod.warehouseStock[transferData.sourceWarehouseId] = (prod.warehouseStock[transferData.sourceWarehouseId] || 0) - item.quantity;
          prod.warehouseStock[transferData.destinationWarehouseId] = (prod.warehouseStock[transferData.destinationWarehouseId] || 0) + item.quantity;
        }
        
        updatedProducts[pIdx] = prod;
      }
    });

    // Save
    updateSettings({
      ...settings,
      products: updatedProducts,
      stockTransfers: [transferData, ...transfers],
      activityLogs: [
        {
          id: `log-${Date.now()}`,
          user: currentUser?.fullName || 'النظام',
          action: 'نقل مخزون',
          details: `تحويل ${transferData.items.length} منتجات من ${warehouses.find(w => w.id === transferData.sourceWarehouseId)?.name} إلى ${warehouses.find(w => w.id === transferData.destinationWarehouseId)?.name}`,
          date: new Date().toLocaleString('ar-EG'),
          timestamp: Date.now()
        },
        ...(settings.activityLogs || [])
      ]
    });

    setNewTransfer({
      sourceWarehouseId: '',
      destinationWarehouseId: '',
      items: [],
      notes: '',
      status: 'completed'
    });
    setActiveTab('history');
    alert('تم تنفيذ عملية النقل وتحديث المخزون بنجاح');
  };

  const filteredTransfers = transfers.filter(t => 
    t.transferNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    warehouses.find(w => w.id === t.sourceWarehouseId)?.name.includes(searchTerm) ||
    warehouses.find(w => w.id === t.destinationWarehouseId)?.name.includes(searchTerm)
  );

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ArrowRightLeft className="text-indigo-600" />
            نقل المخزون بين المستودعات
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-bold mt-1">إدارة تحويلات المنتجات بين الفروع والمخازن</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800'}`}
          >
            <History size={18} />
            سجل التحويلات
          </button>
          <button 
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'create' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800'}`}
          >
            <Plus size={18} />
            تحويل جديد
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'history' ? (
          <motion.div 
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Filter Bar */}
            <div className="glass-card p-4 rounded-2xl flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="البحث برقم التحويل أو المستودع..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-12 pr-4 py-3 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>
            </div>

            {/* Transfers List */}
            <div className="space-y-3">
              {filteredTransfers.length === 0 ? (
                <div className="text-center py-20 glass-card rounded-2xl">
                  <ArrowRightLeft size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
                  <p className="text-slate-500 font-bold">لا يوجد تحويلات مخزون حالياً</p>
                </div>
              ) : (
                filteredTransfers.map(transfer => (
                  <motion.div 
                    layout
                    key={transfer.id}
                    className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900 transition-all cursor-pointer group"
                    onClick={() => setSelectedTransfer(selectedTransfer?.id === transfer.id ? null : transfer)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-indigo-900/30">
                          <FileText size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                             <h4 className="font-black text-slate-800 dark:text-white">{transfer.transferNumber}</h4>
                             <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black rounded-lg border border-emerald-100 dark:border-emerald-900/30">مكتمل</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400 font-bold">
                            <span className="flex items-center gap-1.5">
                              <Clock size={12} /> {new Date(transfer.date).toLocaleDateString('ar-EG')}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <User size={12} /> {transfer.performedBy}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                          <div className="text-left">
                            <div className="text-[10px] text-slate-400 uppercase font-bold">من</div>
                            <div className="text-sm font-black text-slate-700 dark:text-slate-300">{warehouses.find(w => w.id === transfer.sourceWarehouseId)?.name}</div>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                             <ArrowLeft size={16} />
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-slate-400 uppercase font-bold">إلى</div>
                            <div className="text-sm font-black text-slate-700 dark:text-slate-300">{warehouses.find(w => w.id === transfer.destinationWarehouseId)?.name}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{transfer.items.length}</span>
                          <span className="text-xs text-slate-400 font-bold">منتجات</span>
                          {selectedTransfer?.id === transfer.id ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                        </div>
                      </div>
                    </div>

                    {/* Details Dropdown */}
                    <AnimatePresence>
                      {selectedTransfer?.id === transfer.id && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden mt-6 pt-6 border-t border-slate-100 dark:border-slate-800"
                        >
                           <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800">
                             <table className="w-full text-right text-xs">
                               <thead>
                                 <tr className="bg-slate-100 dark:bg-slate-800 text-slate-500 h-10">
                                   <th className="pr-4 font-black">المنتج</th>
                                   <th className="px-2 font-black">SKU</th>
                                   <th className="px-2 font-black text-center">الكمية</th>
                                 </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                 {transfer.items.map((item, idx) => (
                                   <tr key={idx} className="h-10 hover:bg-white dark:hover:bg-slate-800 transition-colors">
                                     <td className="pr-4 font-bold text-slate-700 dark:text-slate-300">{item.name}</td>
                                     <td className="px-2 font-mono text-slate-500">{item.sku}</td>
                                     <td className="px-2 text-center text-indigo-600 dark:text-indigo-400 font-black">{item.quantity}</td>
                                   </tr>
                                 ))}
                               </tbody>
                             </table>
                           </div>
                           {transfer.notes && (
                             <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl text-xs text-amber-700 dark:text-amber-400">
                               <strong>ملاحظات:</strong> {transfer.notes}
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
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* Create Form */}
            <div className="lg:col-span-8 space-y-6">
              {/* Transfer Setup */}
              <div className="glass-card p-6 rounded-3xl space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                   <WarehouseIcon size={20} className="text-indigo-600" />
                   <h3 className="font-black text-slate-800 dark:text-white">إعدادات عملية التحويل</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                     <label className="text-xs font-black text-slate-500 uppercase tracking-wider mr-1">مستودع المصدر (من)</label>
                     <select 
                       value={newTransfer.sourceWarehouseId}
                       onChange={(e) => setNewTransfer({...newTransfer, sourceWarehouseId: e.target.value})}
                       className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all transition-all"
                     >
                       <option value="">-- اختر مستودع المصدر --</option>
                       {warehouses.map(w => (
                         <option key={w.id} value={w.id}>{w.name} {w.isDefault ? '(الافتراضي)' : ''}</option>
                       ))}
                     </select>
                   </div>
                   
                   <div className="space-y-2">
                     <label className="text-xs font-black text-slate-500 uppercase tracking-wider mr-1">مستودع الوجهة (إلى)</label>
                     <select 
                       value={newTransfer.destinationWarehouseId}
                       onChange={(e) => setNewTransfer({...newTransfer, destinationWarehouseId: e.target.value})}
                       className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                     >
                       <option value="">-- اختر مستودع الوجهة --</option>
                       {warehouses.map(w => (
                         <option key={w.id} value={w.id}>{w.name} {w.isDefault ? '(الافتراضي)' : ''}</option>
                       ))}
                     </select>
                   </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider mr-1">ملاحظات التحويل</label>
                  <textarea 
                    value={newTransfer.notes}
                    onChange={(e) => setNewTransfer({...newTransfer, notes: e.target.value})}
                    placeholder="اكتب ملاحظاتك هنا..."
                    rows={2}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="glass-card p-6 rounded-3xl space-y-4">
                 <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      <Plus size={20} className="text-indigo-600" />
                      <h3 className="font-black text-slate-800 dark:text-white">المنتجات المراد تحويلها</h3>
                    </div>
                    <span className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 px-3 py-1 rounded-full text-xs font-black">{newTransfer.items?.length || 0} صنف</span>
                 </div>

                 {(!newTransfer.items || newTransfer.items.length === 0) ? (
                   <div className="py-12 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                      <Package size={40} className="mx-auto text-slate-200 dark:text-slate-800 mb-3" />
                      <p className="text-slate-400 font-bold text-sm">لم يتم إضافة منتجات بعد</p>
                      <p className="text-[10px] text-slate-300 mt-1">استخدم محرك ابحث لإضافة المنتجات</p>
                   </div>
                 ) : (
                   <div className="overflow-x-auto">
                     <table className="w-full text-right border-collapse">
                       <thead>
                         <tr className="text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                           <th className="pb-4 pt-2">الصنف</th>
                           <th className="pb-4 pt-2 text-center">الكمية المنقولة</th>
                           <th className="pb-4 pt-2 text-center">إجراء</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                         {newTransfer.items.map((item, idx) => (
                           <tr key={idx} className="group">
                             <td className="py-4">
                               <div className="font-black text-slate-800 dark:text-white text-sm">{item.name}</div>
                               <div className="text-[10px] font-mono text-slate-400 mt-0.5">{item.sku}</div>
                             </td>
                             <td className="py-4">
                               <div className="flex items-center justify-center gap-2">
                                 <button 
                                   onClick={() => handleUpdateQty(idx, item.quantity - 1)}
                                   className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200"
                                 >-</button>
                                 <input 
                                   type="number"
                                   min="1"
                                   value={item.quantity}
                                   onChange={(e) => handleUpdateQty(idx, Number(e.target.value))}
                                   className="w-16 h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-black text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                                 />
                                 <button 
                                   onClick={() => handleUpdateQty(idx, item.quantity + 1)}
                                   className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200"
                                 >+</button>
                               </div>
                             </td>
                             <td className="py-4 text-center">
                               <button 
                                 onClick={() => handleRemoveItem(idx)}
                                 className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-colors"
                               >
                                 <Trash2 size={18} />
                               </button>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 )}

                 <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button 
                       onClick={handleExecuteTransfer}
                       className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                    >
                       <CheckCircle2 size={18} />
                       تنفيذ عملية النقل وتحديث المخزون
                    </button>
                 </div>
              </div>
            </div>

            {/* Sidebar Search */}
            <div className="lg:col-span-4 space-y-6">
               <div className="glass-card p-6 rounded-3xl sticky top-6">
                 <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                    <Search size={20} className="text-indigo-600" />
                    <h3 className="font-black text-slate-800 dark:text-white">إضافة منتج للتحويل</h3>
                 </div>
                 
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
                     .slice(0, 15)
                     .map(product => (
                       <div key={product.id} className="space-y-1">
                         {product.hasVariants ? (
                           product.variants.map(variant => (
                             <button
                               key={variant.id}
                               onClick={() => handleAddItem(product, variant)}
                               disabled={newTransfer.items?.some(i => i.productId === product.id && i.variantId === variant.id)}
                               className="w-full bg-white dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900 transition-all text-right flex flex-col items-start gap-1 disabled:opacity-40"
                             >
                               <span className="font-black text-[11px] text-slate-800 dark:text-white line-clamp-1">{product.name}</span>
                               <span className="text-[10px] font-bold text-indigo-500 line-clamp-1">{Object.values(variant.options).join(' / ')}</span>
                               <div className="flex items-center gap-2 mt-1">
                                 <span className="text-[9px] font-mono text-slate-400">{variant.sku}</span>
                                 <span className="text-[9px] font-black text-slate-400 bg-slate-50 dark:bg-slate-800 px-1 rounded">المخزون الحالي: {variant.stockQuantity || 0}</span>
                               </div>
                             </button>
                           ))
                         ) : (
                           <button
                             onClick={() => handleAddItem(product)}
                             disabled={newTransfer.items?.some(i => i.productId === product.id && !i.variantId)}
                             className="w-full bg-white dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900 transition-all text-right flex flex-col items-start gap-1 disabled:opacity-40"
                           >
                             <span className="font-black text-[11px] text-slate-800 dark:text-white line-clamp-1">{product.name}</span>
                             <div className="flex items-center gap-2 mt-1">
                               <span className="text-[9px] font-mono text-slate-400">{product.sku || 'لا يوجد SKU'}</span>
                               <span className="text-[9px] font-black text-slate-400 bg-slate-50 dark:bg-slate-800 px-1 rounded">المخزون: {product.stockQuantity || 0}</span>
                             </div>
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

export default InventoryTransfers;
