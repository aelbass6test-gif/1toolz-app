import React, { useState } from 'react';
import { Settings, Supplier, SupplyOrder, Transaction } from '../types';
import { UserPlus, Truck, Save, Plus, Package, Calendar, DollarSign, User, Trash2, Edit2, Eye, X } from 'lucide-react';
import { SupplyOrderItem } from '../types';
import { InventoryAudit } from './InventoryAudit';

interface SuppliersPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  wallet: any;
  setWallet: React.Dispatch<React.SetStateAction<any>>;
  treasury?: any;
  setTreasury?: (updater: any) => void;
  currentUser?: any;
}

const SuppliersPage: React.FC<SuppliersPageProps> = ({ settings, setSettings, wallet, setWallet, treasury, setTreasury, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'orders' | 'audit'>('orders');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSupplierForPayment, setSelectedSupplierForPayment] = useState<Supplier | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentNote, setPaymentNote] = useState('');
  const [selectedTreasuryAccountId, setSelectedTreasuryAccountId] = useState('');
  
  // New Supplier State
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({ name: '', phone: '', address: '', notes: '' });
  
  // New Order State
  const [editingOrder, setEditingOrder] = useState<SupplyOrder | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [orderReference, setOrderReference] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderItems, setOrderItems] = useState<SupplyOrderItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'partner' | 'supply_wallet' | 'treasury'>('cash');
  const [partnerPayments, setPartnerPayments] = useState<{ partnerId: string, amount: number }[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState(''); 
  
  const totalCost = React.useMemo(() => {
    return orderItems.reduce((sum, item) => {
        let itemTotal = item.cost * item.quantity;
        if (item.discountValue) {
            if (item.discountType === 'percentage') {
                itemTotal -= (itemTotal * (item.discountValue / 100));
            } else {
                itemTotal -= (item.discountValue * item.quantity);
            }
        }
        return sum + itemTotal;
    }, 0);
  }, [orderItems]);

  // Auto-initialize or keep in sync if only one partner
  React.useEffect(() => {
    if (paymentMethod === 'partner' && settings.partners?.length > 0) {
        if (partnerPayments.length === 0) {
            setPartnerPayments([{ partnerId: settings.partners[0].id, amount: totalCost }]);
        } else if (partnerPayments.length === 1) {
            // If there's only one partner, keep the amount in sync with totalCost
            if (partnerPayments[0].amount !== totalCost) {
                const newPayments = [...partnerPayments];
                newPayments[0].amount = totalCost;
                setPartnerPayments(newPayments);
            }
        }
    }
  }, [paymentMethod, settings.partners, totalCost, partnerPayments]);

  const handleAddSupplier = () => {
      if(!newSupplier.name) return;
      if (editingSupplier) {
          setSettings(prev => ({
              ...prev,
              suppliers: prev.suppliers.map(s => s.id === editingSupplier.id ? { ...editingSupplier, ...newSupplier } as Supplier : s)
          }));
          setEditingSupplier(null);
      } else {
        const supplier: Supplier = {
            id: Date.now().toString(),
            name: newSupplier.name!,
            phone: newSupplier.phone || '',
            address: newSupplier.address || '',
            notes: newSupplier.notes || ''
        };
        setSettings(prev => ({...prev, suppliers: [...(prev.suppliers || []), supplier]}));
      }
      setShowSupplierModal(false);
      setNewSupplier({ name: '', phone: '', address: '', notes: '' });
  };

  const startEditSupplier = (supplier: Supplier) => {
      setEditingSupplier(supplier);
      setNewSupplier(supplier);
      setShowSupplierModal(true);
  };

  const handleDeleteSupplier = (id: string) => {
      if (!confirm('هل أنت متأكد من حذف هذا المورد؟')) return;
      setSettings(prev => ({
          ...prev,
          suppliers: prev.suppliers.filter(s => s.id !== id)
      }));
  };

  const handleAddOrder = () => {
      if(!selectedSupplierId || orderItems.length === 0) return;
      
      const currentOrderId = editingOrder ? (editingOrder as any).id : Date.now().toString();
      
      if (paymentMethod === 'partner') {
          const distributedTotal = partnerPayments.reduce((s, p) => s + p.amount, 0);
          if (Math.abs(distributedTotal - totalCost) > 0.01) {
              alert('عذراً، يجب أن يكون مجموع تمويل الشركاء مساوياً لإجمالي الفاتورة: ' + totalCost.toLocaleString() + ' ج.م');
              return;
          }
          if (partnerPayments.some(p => !p.partnerId)) {
              alert('يرجى التأكد من اختيار الشركاء بشكل صحيح');
              return;
          }
      }

      const supplier = settings.suppliers.find(s => s.id === selectedSupplierId);

      setSettings(prev => {
          let updatedProducts = [...prev.products];
          let updatedOrders = [...(prev.supplyOrders || [])];
          let updatedSuppliers = [...(prev.suppliers || [])];
          let updatedPartners = [...(prev.partners || [])];
          let updatedPartnerTransactions = [...(prev.partnerTransactions || [])];
          
          // 1. Revert Old Order Impact (if editing)
          if (editingOrder) {
              const currentOldOrder = editingOrder as SupplyOrder;
              const oldSuppIdx = updatedSuppliers.findIndex(s => s.id === currentOldOrder.supplierId);
              if (oldSuppIdx > -1 && currentOldOrder.paymentMethod === 'credit') {
                  updatedSuppliers[oldSuppIdx] = {
                      ...updatedSuppliers[oldSuppIdx],
                      balance: (updatedSuppliers[oldSuppIdx].balance || 0) - currentOldOrder.totalCost
                  };
              }

              // Revert Partner Balance if was partner funded
              if (currentOldOrder.paymentMethod === 'partner') {
                  const oldPayments = currentOldOrder.partnerPayments || (currentOldOrder.partnerId ? [{ partnerId: currentOldOrder.partnerId, amount: currentOldOrder.totalCost }] : []);
                  oldPayments.forEach(op => {
                      const pIdx = updatedPartners.findIndex(p => p.id === op.partnerId);
                      if (pIdx > -1) {
                          updatedPartners[pIdx] = {
                              ...updatedPartners[pIdx],
                              balance: (updatedPartners[pIdx].balance || 0) - op.amount
                          };
                      }
                  });
                  // Remove the old partner transactions
                  updatedPartnerTransactions = updatedPartnerTransactions.filter(pt => !pt.id.startsWith(`supply_pt_${currentOldOrder.id}`));
              }

              editingOrder.items.forEach(oldItem => {
                  const product = updatedProducts.find(p => p.id === oldItem.productId);
                  if (product) {
                      const totalQty = oldItem.quantity + (oldItem.bonusQuantity || 0);
                      product.stockQuantity = (product.stockQuantity || 0) - totalQty;
                  }
              });
          }

          // 2. Apply New Impact
          orderItems.forEach(newItem => {
              const productIndex = updatedProducts.findIndex(p => p.id === newItem.productId);
              if (productIndex > -1) {
                  const totalQty = newItem.quantity + (newItem.bonusQuantity || 0);
                  const newQty = (updatedProducts[productIndex].stockQuantity || 0) + totalQty;
                  updatedProducts[productIndex] = {
                      ...updatedProducts[productIndex],
                      stockQuantity: newQty,
                      inStock: newQty > 0,
                      costPrice: newItem.cost // Update cost to newest purchase price
                  };
              }
          });

          // 3. Update Supplier Balance if Credit
          const supplierIdx = updatedSuppliers.findIndex(s => s.id === selectedSupplierId);
          if (supplierIdx > -1 && paymentMethod === 'credit') {
              updatedSuppliers[supplierIdx] = {
                  ...updatedSuppliers[supplierIdx],
                  balance: (updatedSuppliers[supplierIdx].balance || 0) + totalCost
              };
          }

          // 4. Update Partner Balance if Partner Funded
          if (paymentMethod === 'partner') {
              partnerPayments.forEach((pp, idx) => {
                  const pIdx = updatedPartners.findIndex(p => p.id === pp.partnerId);
                  if (pIdx > -1) {
                      updatedPartners[pIdx] = {
                          ...updatedPartners[pIdx],
                          balance: (updatedPartners[pIdx].balance || 0) + pp.amount
                      };
                      
                      // Add Partner Transaction
                      updatedPartnerTransactions.push({
                          id: `supply_pt_${currentOrderId}_${idx}`,
                          partnerId: pp.partnerId,
                          type: 'supply_funding',
                          amount: pp.amount,
                          date: new Date().toISOString(),
                          note: `تمويل مخزون (أمر توريد من ${supplier?.name})`
                      });
                  }
              });
          }

      // 5. Update Supply Wallet Balance
          if (paymentMethod === 'supply_wallet') {
            // This is handled in setWallet, but here we just ensure the order is tagged correctly
          }

          // 6. Update Treasury Balance
          if (paymentMethod === 'treasury' && selectedTreasuryAccountId && setTreasury) {
             setTreasury((prev: any) => ({
                 ...prev,
                 accounts: prev.accounts.map((acc: any) => 
                     acc.id === selectedTreasuryAccountId ? { ...acc, balance: acc.balance - totalCost } : acc
                 ),
                 transactions: [{
                     id: `supply_tx_${currentOrderId}`,
                     date: new Date().toISOString(),
                     type: 'withdrawal',
                     amount: totalCost,
                     fromAccountId: selectedTreasuryAccountId,
                     description: `شراء بضاعة من المورد ${supplier?.name} (أمر: ${orderReference || currentOrderId})`
                 }, ...prev.transactions]
             }));
          }

          if (editingOrder) {
              updatedOrders = updatedOrders.map(o => o.id === editingOrder.id ? {
                  ...o,
                  supplierId: selectedSupplierId,
                  partnerId: paymentMethod === 'partner' ? (partnerPayments.length === 1 ? partnerPayments[0].partnerId : undefined) : undefined,
                  partnerPayments: paymentMethod === 'partner' ? partnerPayments : undefined,
                  referenceNumber: orderReference,
                  notes: orderNotes,
                  items: orderItems,
                  totalCost,
                  paymentMethod
              } as any : o);
          } else {
              const newOrder: SupplyOrder = {
                  id: currentOrderId,
                  supplierId: selectedSupplierId,
                  partnerId: paymentMethod === 'partner' ? (partnerPayments.length === 1 ? partnerPayments[0].partnerId : undefined) : undefined,
                  partnerPayments: paymentMethod === 'partner' ? partnerPayments : undefined,
                  date: new Date().toISOString(),
                  referenceNumber: orderReference || `supply_${currentOrderId}`,
                  notes: orderNotes,
                  items: orderItems,
                  totalCost,
                  status: 'completed',
                  paymentMethod
              } as SupplyOrder;
              updatedOrders.push(newOrder);
          }

          return {
              ...prev,
              products: updatedProducts,
              supplyOrders: updatedOrders,
              suppliers: updatedSuppliers,
              partners: updatedPartners,
              partnerTransactions: updatedPartnerTransactions
          };
      });

      // Update Wallet
      if (paymentMethod === 'cash' || paymentMethod === 'partner' || paymentMethod === 'supply_wallet') {
          setWallet((prev: any) => {
              const currentSupplyBalance = prev.supplyBalance || 0;
              const currentBalance = prev.balance || 0;
              
              let newSupplyBalance = currentSupplyBalance;
              let newBalance = currentBalance;

              // 1. Revert old impacts if editing
              if (editingOrder) {
                  const currentOld = editingOrder as SupplyOrder;
                  if (currentOld.paymentMethod === 'supply_wallet') {
                      newSupplyBalance += currentOld.totalCost;
                  } else if (currentOld.paymentMethod === 'cash') {
                      newBalance += currentOld.totalCost;
                  } else if (currentOld.paymentMethod === 'partner') {
                      // Partner funding previously added to supplyBalance
                      newSupplyBalance -= currentOld.totalCost;
                  }
              }

              // 2. Prepare new transactions
              const newWalletTransactions: Transaction[] = [];
              const now = new Date();

              if (paymentMethod === 'partner') {
                  partnerPayments.forEach((pp, idx) => {
                      const partner = settings.partners.find(p => p.id === pp.partnerId);
                      // Add 1ms per idx so funding are slightly staggered
                      const txDate = new Date(now.getTime() + idx);
                      newWalletTransactions.push({
                          id: `supply_funding_dep_${currentOrderId}_${idx}`,
                          type: 'إيداع',
                          amount: pp.amount,
                          date: txDate.toISOString(),
                          note: `تمويل من الشريك ${partner?.name || 'غير معروف'} لشراء بضاعة (أمر: ${orderReference || currentOrderId})`,
                          category: 'supply_deposit',
                          status: 'completed'
                      } as Transaction);
                      // Partner funding increases the supply wallet
                      newSupplyBalance += pp.amount;
                  });

                  // Add an extra ms offset to purchase to be "newest", so it appears ABOVE funding
                  const purchaseDate = new Date(now.getTime() + partnerPayments.length + 1);
                  newWalletTransactions.push({
                      id: `supply_purchase_with_${currentOrderId}`,
                      type: 'سحب',
                      amount: totalCost,
                      date: purchaseDate.toISOString(),
                      note: `شراء بضاعة (بتمويل الشركاء) من المورد ${supplier?.name} (أمر: ${orderReference || currentOrderId})`,
                      category: 'supply_purchase',
                      status: 'completed'
                  } as Transaction);
                  
                  // Payment comes out of the supply wallet
                  newSupplyBalance -= totalCost;
              } else if (paymentMethod === 'cash') {
                  newBalance -= totalCost;
                  newWalletTransactions.push({
                      id: `supply_purchase_${currentOrderId}`,
                      type: 'سحب',
                      amount: totalCost,
                      date: new Date().toISOString(),
                      note: `شراء بضاعة (كاش) من المورد ${supplier?.name} (المرجع: ${orderReference || currentOrderId})`,
                      category: 'inventory_purchase',
                      status: 'completed'
                  } as Transaction);
              } else if (paymentMethod === 'supply_wallet') {
                  newSupplyBalance -= totalCost;
                  newWalletTransactions.push({
                      id: `supply_purchase_${currentOrderId}`,
                      type: 'سحب',
                      amount: totalCost,
                      date: new Date().toISOString(),
                      note: `شراء بضاعة من محفظة التوريد (المورد: ${supplier?.name})`,
                      category: 'supply_purchase',
                      status: 'completed'
                  } as Transaction);
              }

              const filteredTransactions = prev.transactions.filter((t: any) => 
                !t.id.startsWith(`supply_${currentOrderId}`) && 
                !t.id.startsWith(`supply_purchase_with_${currentOrderId}`) &&
                !t.id.startsWith(`supply_funding_dep_${currentOrderId}`)
              );

              return { 
                ...prev, 
                balance: newBalance,
                supplyBalance: newSupplyBalance,
                transactions: [...newWalletTransactions, ...filteredTransactions] 
              };
          });
      } else if (editingOrder && (editingOrder.paymentMethod as string === 'cash' || editingOrder.paymentMethod as string === 'partner' || editingOrder.paymentMethod as string === 'supply_wallet') && paymentMethod === 'credit') {
          // If changed to credit, remove the transaction and revert balance
          setWallet((prev: any) => {
              let newSupplyBalance = prev.supplyBalance || 0;
              let newBalance = prev.balance || 0;

              const currentOld = editingOrder as SupplyOrder;
              if (currentOld.paymentMethod === 'supply_wallet') {
                  newSupplyBalance += currentOld.totalCost;
              } else if (currentOld.paymentMethod === 'cash') {
                  newBalance += currentOld.totalCost;
              }

              return {
                ...prev,
                balance: newBalance,
                supplyBalance: newSupplyBalance,
                transactions: prev.transactions.filter((t: any) => t.id !== `supply_${editingOrder.id}`)
              };
          });
      }

      setShowOrderModal(false);
      setEditingOrder(null);
      setOrderItems([]);
      setSelectedSupplierId('');
      setPartnerPayments([]);
      setSelectedPartnerId('');
      setOrderReference('');
      setOrderNotes('');
  };

  const startEditOrder = (order: SupplyOrder) => {
      setEditingOrder(order);
      setSelectedSupplierId(order.supplierId);
      const initialPartnerPayments = order.partnerPayments || (order.partnerId ? [{ partnerId: order.partnerId, amount: order.totalCost }] : []);
      setPartnerPayments(initialPartnerPayments);
      setSelectedPartnerId(order.partnerId || '');
      setOrderReference(order.referenceNumber || '');
      setOrderNotes(order.notes || '');
      setOrderItems(order.items);
      setPaymentMethod(order.paymentMethod as any || 'cash');
      setShowOrderModal(true);
  };

  const handleDeleteOrder = (order: SupplyOrder) => {
      if (!confirm('هل أنت متأكد من حذف أمر التوريد هذا؟ سيتم استرجاع المخزون وتعديل الحسابات.')) return;
      
      const currentOrder = order as SupplyOrder;
      setSettings(prev => {
          let updatedSuppliers = [...prev.suppliers];
          let updatedPartners = [...(prev.partners || [])];
          let updatedPartnerTransactions = [...(prev.partnerTransactions || [])];

          if (currentOrder.paymentMethod === 'credit') {
              const suppIdx = updatedSuppliers.findIndex(s => s.id === currentOrder.supplierId);
              if (suppIdx > -1) {
                  updatedSuppliers[suppIdx] = {
                      ...updatedSuppliers[suppIdx],
                      balance: (updatedSuppliers[suppIdx].balance || 0) - currentOrder.totalCost
                  };
              }
          }

          if (currentOrder.paymentMethod === 'partner') {
              const oldPayments = currentOrder.partnerPayments || (currentOrder.partnerId ? [{ partnerId: currentOrder.partnerId, amount: currentOrder.totalCost }] : []);
              oldPayments.forEach(op => {
                  const pIdx = updatedPartners.findIndex(p => p.id === op.partnerId);
                  if (pIdx > -1) {
                      updatedPartners[pIdx] = {
                          ...updatedPartners[pIdx],
                          balance: (updatedPartners[pIdx].balance || 0) - op.amount
                      };
                  }
              });
              // Remove partner transactions
              updatedPartnerTransactions = updatedPartnerTransactions.filter(pt => !pt.id.startsWith(`supply_pt_${currentOrder.id}`));
          }

          return {
            ...prev,
            suppliers: updatedSuppliers,
            partners: updatedPartners,
            partnerTransactions: updatedPartnerTransactions,
            products: prev.products.map(p => {
                const item = order.items.find(i => i.productId === p.id);
                if (item) {
                    const totalQty = item.quantity + (item.bonusQuantity || 0);
                    const newQty = (p.stockQuantity || 0) - totalQty;
                    return { ...p, stockQuantity: newQty, inStock: newQty > 0 };
                }
                return p;
            }),
            supplyOrders: prev.supplyOrders.filter(o => o.id !== order.id)
          };
      });

      // Revert from Wallet if was cash, partner or supply_wallet
      if (order.paymentMethod === 'cash' || order.paymentMethod === 'partner' || order.paymentMethod === 'supply_wallet') {
          setWallet((prev: any) => {
              let newBalance = prev.balance || 0;
              let newSupplyBalance = prev.supplyBalance || 0;

              if (order.paymentMethod === 'cash') {
                  newBalance += order.totalCost;
              } else if (order.paymentMethod === 'supply_wallet') {
                  newSupplyBalance += order.totalCost;
              } else if (order.paymentMethod === 'partner') {
                  // The net impact of partner funding (deposit) followed by purchase (withdrawal) on supplyBalance was 0.
                  // Reverting both means we stay at 0 change, but we must remove the transactions.
              }

              const filteredTransactions = prev.transactions.filter((t: any) => 
                 !t.id.startsWith(`supply_${order.id}`) && 
                 !t.id.startsWith(`supply_purchase_${order.id}`) && 
                 !t.id.startsWith(`supply_purchase_with_${order.id}`) && 
                 !t.id.startsWith(`supply_funding_dep_${order.id}`)
              );

              return {
                  ...prev,
                  balance: newBalance,
                  supplyBalance: newSupplyBalance,
                  transactions: filteredTransactions
              };
          });
      }
  };

const ProductSelect = ({ value, onChange, products }: { value: string, onChange: (val: string) => void, products: any[] }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = React.useRef<HTMLDivElement>(null);
    
    const selectedProduct = products.find(p => p.id === value);
    const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            <button 
                type="button" 
                onClick={() => setIsOpen(!isOpen)} 
                className="w-full flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs sm:text-sm font-bold text-right hover:bg-slate-50 dark:hover:bg-slate-700 transition-all outline-none"
            >
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded bg-slate-100 dark:bg-slate-700 flex-shrink-0 overflow-hidden">
                    {selectedProduct?.thumbnail ? (
                        <img src={selectedProduct.thumbnail} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <Package size={14} />
                        </div>
                    )}
                </div>
                <span className="flex-1 text-slate-800 dark:text-slate-200 truncate">{selectedProduct?.name || 'اختر منتجاً'}</span>
                <Plus size={12} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-45' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                        <input 
                            autoFocus
                            type="text"
                            placeholder="ابحث..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none"
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        {filtered.map(p => (
                            <div 
                                key={p.id} 
                                onClick={() => { onChange(p.id); setIsOpen(false); }} 
                                className="flex items-center gap-3 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-50 dark:border-slate-800/50 last:border-0"
                            >
                                <div className="w-10 h-10 rounded bg-slate-100 dark:bg-slate-700 flex-shrink-0 overflow-hidden">
                                    {p.thumbnail ? (
                                        <img src={p.thumbnail} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : <Package size={18} className="m-auto text-slate-300" />}
                                </div>
                                <div className="flex-1 text-right">
                                    <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">{p.name}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">تكلفة: {p.costPrice} ج.م</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

  const handleRecordPayment = () => {
    if (!selectedSupplierForPayment || paymentAmount <= 0) return;

    const fromSupplyWallet = paymentMethod === 'supply_wallet';
    const fromTreasury = paymentMethod === 'treasury';

    setSettings(prev => ({
        ...prev,
        suppliers: prev.suppliers.map(s => s.id === selectedSupplierForPayment.id ? {
            ...s,
            balance: (s.balance || 0) - paymentAmount
        } : s)
    }));

    if (fromTreasury && selectedTreasuryAccountId && setTreasury) {
        setTreasury((prev: any) => ({
            ...prev,
            accounts: prev.accounts.map((acc: any) => 
                acc.id === selectedTreasuryAccountId ? { ...acc, balance: acc.balance - paymentAmount } : acc
            ),
            transactions: [{
                id: `pay_supp_${Date.now()}`,
                date: new Date().toISOString(),
                type: 'withdrawal',
                amount: paymentAmount,
                fromAccountId: selectedTreasuryAccountId,
                description: `سداد مديونية للمورد: ${selectedSupplierForPayment.name}`
            }, ...prev.transactions]
        }));
    } else {
        // Record in Wallet as "Supply Payment"
        setWallet((prev: any) => {
            const newBalance = fromSupplyWallet ? (prev.balance || 0) : (prev.balance || 0) - paymentAmount;
            const newSupplyBalance = fromSupplyWallet ? (prev.supplyBalance || 0) - paymentAmount : (prev.supplyBalance || 0);
            
            return {
                ...prev,
                balance: newBalance,
                supplyBalance: newSupplyBalance,
                transactions: [
                    {
                        id: `pay_${Date.now()}`,
                        type: 'سحب',
                        amount: paymentAmount,
                        date: new Date().toISOString(),
                        note: `سداد مديونية للمورد: ${selectedSupplierForPayment.name} (${fromSupplyWallet ? 'محفظة التوريد' : 'المحفظة العامة'})`,
                        category: fromSupplyWallet ? 'supply_purchase' : 'supplier_payment',
                        status: 'completed'
                    },
                    ...prev.transactions
                ]
            };
        });
    }

    setShowPaymentModal(false);
    setPaymentAmount(0);
    setPaymentNote('');
    setSelectedSupplierForPayment(null);
    setSelectedTreasuryAccountId('');
  };

  const addItemToOrder = () => {
      if (settings.products.length > 0) {
          const firstProduct = settings.products[0];
          setOrderItems([...orderItems, { 
              productId: firstProduct.id, 
              name: firstProduct.name,
              quantity: 1, 
              bonusQuantity: 0,
              cost: firstProduct.costPrice,
              discountValue: 0,
              discountType: 'amount'
          }]);
      }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 px-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex-shrink-0"><Truck size={28} /></div>
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">إدارة الموردين والمخزون</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">سجل الموردين وقم بإنشاء أوامر توريد لزيادة مخزونك.</p>
                </div>
            </div>
            <div className="bg-white dark:bg-slate-900 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-full md:w-auto">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">إجمالي المديونية الحالية</p>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                        {settings.suppliers.reduce((sum, s) => sum + (s.balance || 0), 0).toLocaleString()} <span className="text-sm">ج.م</span>
                    </span>
                </div>
            </div>
        </div>

        <div className="flex gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 w-full sm:w-fit overflow-x-auto">
            <button onClick={() => setActiveTab('orders')} className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${activeTab === 'orders' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>أوامر التوريد</button>
            <button onClick={() => setActiveTab('suppliers')} className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${activeTab === 'suppliers' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>قائمة الموردين</button>
            <button onClick={() => setActiveTab('audit')} className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${activeTab === 'audit' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>الجرد والتسوية</button>
        </div>

        {activeTab === 'orders' && (
            <div className="space-y-4">
                <button onClick={() => {
                    setEditingOrder(null);
                    setSelectedSupplierId('');
                    setOrderReference('');
                    setOrderNotes('');
                    setOrderItems([]);
                    setShowOrderModal(true);
                }} className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex items-center justify-center gap-2 text-slate-500 hover:text-indigo-600 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all font-bold">
                    <Plus size={20}/> تسجيل فاتورة شراء جديدة
                </button>

                <div className="grid gap-4">
                    {(settings.supplyOrders || []).map(order => {
                        const supplier = settings.suppliers.find(s => s.id === order.supplierId);
                        return (
                            <div key={order.id} className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white flex flex-wrap items-center gap-2">
                                        <User size={16}/> {supplier?.name || 'مورد غير معروف'}
                                        {order.referenceNumber && <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">Ref: {order.referenceNumber}</span>}
                                    </h4>
                                    <p className="text-xs text-slate-500 mt-1">
                                        <Calendar size={12} className="inline ml-1"/> {new Date(order.date).toLocaleDateString('ar-EG')}
                                        <span className={`mr-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${order.paymentMethod === 'credit' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {order.paymentMethod === 'credit' ? 'آجل' : 'كاش'}
                                        </span>
                                        {order.notes && <span className="mr-3 opacity-60">| {order.notes}</span>}
                                    </p>
                                </div>
                                <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-3 sm:gap-4 border-t sm:border-0 pt-3 sm:pt-0">
                                    <div className="flex -space-x-2 sm:-space-x-3 space-x-reverse overflow-hidden">
                                        {order.items.slice(0, 3).map((item, i) => {
                                            const product = settings.products.find(p => p.id === item.productId);
                                            return (
                                                <div key={i} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-700 overflow-hidden shadow-sm">
                                                    {product?.thumbnail ? (
                                                        <img src={product.thumbnail} className="w-full h-full object-cover" />
                                                    ) : <Package size={10} className="m-auto mt-1" />}
                                                </div>
                                            );
                                        })}
                                        {order.items.length > 3 && (
                                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-white dark:border-slate-800 bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-[8px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                                +{order.items.length - 3}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-left flex-1 sm:flex-none">
                                        <div className="font-black text-base sm:text-lg text-emerald-600">{order.totalCost.toLocaleString()} ج.م</div>
                                        <div className="text-[10px] sm:text-xs text-slate-500">{order.items.length} أصناف {order.items.reduce((s, i) => s + (i.bonusQuantity || 0), 0) > 0 && `(+ ${order.items.reduce((s, i) => s + (i.bonusQuantity || 0), 0)} بونص)`}</div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <button onClick={() => startEditOrder(order)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"><Edit2 size={16}/></button>
                                        <button onClick={() => handleDeleteOrder(order)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )}

        {activeTab === 'suppliers' && (
            <div className="space-y-4">
                <button onClick={() => { setEditingSupplier(null); setNewSupplier({name:'', phone:'', address:'', notes:''}); setShowSupplierModal(true); }} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all"><UserPlus size={20}/> إضافة مورد</button>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                    {(settings.suppliers || []).map(supplier => (
                        <div key={supplier.id} className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-base sm:text-lg dark:text-white flex flex-wrap items-center gap-2">
                                    <span className="truncate">{supplier.name}</span>
                                    {(supplier.balance || 0) > 0 && <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">مديونية: {supplier.balance?.toLocaleString()} ج.م</span>}
                                </h3>
                                <p className="text-slate-500 text-xs sm:text-sm truncate">{supplier.phone}</p>
                                {supplier.address && <p className="text-slate-400 text-[10px] sm:text-xs mt-2 line-clamp-2">{supplier.address}</p>}
                                {supplier.notes && <p className="text-slate-400 text-[9px] sm:text-[10px] mt-1 bg-slate-50 dark:bg-slate-800 p-1 rounded italic line-clamp-2">{supplier.notes}</p>}
                            </div>
                            <div className="flex gap-1 shrink-0 ml-2">
                                {(supplier.balance || 0) > 0 && (
                                    <button onClick={() => { setSelectedSupplierForPayment(supplier); setPaymentAmount(supplier.balance || 0); setShowPaymentModal(true); }} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all" title="تسجيل دفعة">
                                        <DollarSign size={18}/>
                                    </button>
                                )}
                                <button onClick={() => startEditSupplier(supplier)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all" title="تعديل"><Edit2 size={18}/></button>
                                <button onClick={() => handleDeleteSupplier(supplier.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all" title="حذف"><Trash2 size={18}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'audit' && (
            <InventoryAudit settings={settings} setSettings={setSettings} currentUser={currentUser} />
        )}

        {/* Supplier Modal */}
        {showSupplierModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6">
                    <h3 className="text-xl font-bold mb-4 dark:text-white">{editingSupplier ? 'تعديل بيانات مورد' : 'إضافة مورد جديد'}</h3>
                    <div className="space-y-3">
                        <input type="text" placeholder="اسم المورد" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-lg" value={newSupplier.name || ''} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} />
                        <input type="text" placeholder="رقم الهاتف" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-lg" value={newSupplier.phone || ''} onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} />
                        <input type="text" placeholder="العنوان" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-lg" value={newSupplier.address || ''} onChange={e => setNewSupplier({...newSupplier, address: e.target.value})} />
                        <textarea placeholder="ملاحظات" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-lg h-24" value={newSupplier.notes || ''} onChange={e => setNewSupplier({...newSupplier, notes: e.target.value})} />
                        <button onClick={handleAddSupplier} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold mt-2">حفظ</button>
                        <button onClick={() => { setShowSupplierModal(false); setEditingSupplier(null); setNewSupplier({name:'', phone:'', address:'', notes:''}); }} className="w-full py-3 text-slate-500 font-bold">إلغاء</button>
                    </div>
                </div>
            </div>
        )}

        {/* Order Modal */}
        {showOrderModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-2xl font-black dark:text-white">{editingOrder ? 'تعديل أمر توريد' : 'تسجيل فاتورة شراء (توريد)'}</h3>
                        <button onClick={() => setShowOrderModal(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={24}/></button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1 block">المورد</label>
                            <select value={selectedSupplierId || ''} onChange={e => setSelectedSupplierId(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white">
                                <option value="">اختر المورد...</option>
                                {(settings.suppliers || []).map(s => <option key={s.id} value={s.id}>{s.name} {(s.balance || 0) > 0 ? `(مدين: ${s.balance})` : ''}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1 block">طريقة الدفع</label>
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto no-scrollbar">
                                <button onClick={() => setPaymentMethod('cash')} className={`flex-1 min-w-[80px] py-2 text-center rounded-lg font-bold transition-all text-[10px] sm:text-xs ${paymentMethod === 'cash' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}>كاش (العامة)</button>
                                <button onClick={() => setPaymentMethod('supply_wallet')} className={`flex-1 min-w-[80px] py-2 text-center rounded-lg font-bold transition-all text-[10px] sm:text-xs ${paymentMethod === 'supply_wallet' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500'}`}>محفظة التوريد</button>
                                <button onClick={() => setPaymentMethod('partner')} className={`flex-1 min-w-[80px] py-2 text-center rounded-lg font-bold transition-all text-[10px] sm:text-xs ${paymentMethod === 'partner' ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-sm' : 'text-slate-500'}`}>تمويل شركاء</button>
                                <button onClick={() => setPaymentMethod('treasury')} className={`flex-1 min-w-[80px] py-2 text-center rounded-lg font-bold transition-all text-[10px] sm:text-xs ${paymentMethod === 'treasury' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}>الخزينة</button>
                                <button onClick={() => setPaymentMethod('credit')} className={`flex-1 min-w-[80px] py-2 text-center rounded-lg font-bold transition-all text-[10px] sm:text-xs ${paymentMethod === 'credit' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm' : 'text-slate-500'}`}>آجل</button>
                            </div>
                            {paymentMethod === 'treasury' && (
                                <div className="mt-4 animate-in slide-in-from-top-2 duration-300">
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">خصم من حساب الخزينة:</label>
                                    <select 
                                        value={selectedTreasuryAccountId} 
                                        onChange={e => setSelectedTreasuryAccountId(e.target.value)} 
                                        className="w-full p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl outline-none dark:text-white text-xs font-bold"
                                        required
                                    >
                                        <option value="">-- اختر حساباً --</option>
                                        {(treasury?.accounts || []).map((acc: any) => (
                                            <option key={acc.id} value={acc.id}>{acc.name} ({acc.balance.toLocaleString()} ج.م)</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <p className="mt-2 text-[10px] text-slate-400 font-medium px-1">
                                {paymentMethod === 'partner' ? 'سيتم خصم المبلغ من أرصدة الشركاء المختارة وإضافته لمحفظة التوريد ثم سداده للمورد.' : 
                                 paymentMethod === 'cash' ? 'سيتم خصم المبلغ مباشرة من الرصيد السائل في المحفظة العامة.' : 
                                 paymentMethod === 'supply_wallet' ? 'سيتم خصم المبلغ من محفظة التوريد (رأس مال البضاعة).' : 
                                 'سيتم إضافة المبلغ كمديونية على الشركة لصالح هذا المورد.'}
                            </p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {paymentMethod === 'partner' && (
                             <div className="md:col-span-2 space-y-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-sm font-bold text-slate-600 dark:text-slate-400">توزيع التكلفة على الشركاء</label>
                                    <button 
                                        type="button"
                                        onClick={() => setPartnerPayments([...partnerPayments, { partnerId: '', amount: 0 }])}
                                        className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                    >
                                        <Plus size={12}/> إضافة شريك ممول
                                    </button>
                                </div>
                                
                                {partnerPayments.map((payment, pidx) => (
                                    <div key={pidx} className="flex gap-2 items-end">
                                        <div className="flex-1">
                                            <select 
                                                value={payment.partnerId} 
                                                onChange={e => {
                                                    const newPayments = [...partnerPayments];
                                                    newPayments[pidx].partnerId = e.target.value;
                                                    setPartnerPayments(newPayments);
                                                }}
                                                className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
                                            >
                                                <option value="">اختر الشريك...</option>
                                                {settings.partners?.map(p => <option key={p.id} value={p.id}>{p.name} (رصيد: {p.balance})</option>)}
                                            </select>
                                        </div>
                                        <div className="w-24 sm:w-32">
                                            <input 
                                                type="number" 
                                                value={payment.amount}
                                                onChange={e => {
                                                    const newPayments = [...partnerPayments];
                                                    newPayments[pidx].amount = Number(e.target.value);
                                                    setPartnerPayments(newPayments);
                                                }}
                                                placeholder="المبلغ"
                                                className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-center outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
                                            />
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => setPartnerPayments(partnerPayments.filter((_, i) => i !== pidx))}
                                            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                                
                                <div className="pt-2 flex flex-col sm:flex-row justify-between items-center gap-2">
                                    {(() => {
                                        const distributedTotal = partnerPayments.reduce((s, p) => s + p.amount, 0);
                                        return (
                                            <>
                                                <span className={`text-[10px] font-black ${Math.abs(distributedTotal - totalCost) < 0.01 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                    تم توزيع: {distributedTotal.toLocaleString()} / {totalCost.toLocaleString()} ج.م
                                                </span>
                                                <div className="flex gap-2 flex-wrap justify-end">
                                                    {distributedTotal < totalCost && partnerPayments.length > 0 && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => {
                                                                const remaining = totalCost - distributedTotal;
                                                                // Find the first partner with 0 or empty amount and give it the remaining
                                                                const newPayments = [...partnerPayments];
                                                                const emptyIdx = newPayments.findIndex(p => p.amount === 0);
                                                                if (emptyIdx > -1) {
                                                                    newPayments[emptyIdx].amount += remaining;
                                                                } else {
                                                                    newPayments[newPayments.length - 1].amount += remaining;
                                                                }
                                                                setPartnerPayments(newPayments);
                                                            }}
                                                            className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                                                        >
                                                            توزيع المتبقي ({(totalCost - distributedTotal).toLocaleString()})
                                                        </button>
                                                    )}
                                                    {partnerPayments.length > 1 && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => {
                                                                const equalShare = Number((totalCost / partnerPayments.length).toFixed(2));
                                                                const newPayments = partnerPayments.map((p, i) => ({
                                                                    ...p,
                                                                    amount: i === partnerPayments.length - 1 
                                                                        ? Number((totalCost - (equalShare * (partnerPayments.length - 1))).toFixed(2))
                                                                        : equalShare
                                                                }));
                                                                setPartnerPayments(newPayments);
                                                            }}
                                                            className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 hover:underline"
                                                        >
                                                            توزيع بالتساوي
                                                        </button>
                                                    )}
                                                    {(partnerPayments.length <= 1) && (
                                                        <button 
                                                          type="button"
                                                          onClick={() => {
                                                              if (partnerPayments.length === 0) {
                                                                  if (settings.partners && settings.partners.length > 0) {
                                                                      setPartnerPayments([{ partnerId: settings.partners[0].id, amount: totalCost }]);
                                                                  } else {
                                                                      setPartnerPayments([{ partnerId: '', amount: totalCost }]);
                                                                  }
                                                              } else {
                                                                  const newPayments = [...partnerPayments];
                                                                  newPayments[0].amount = totalCost;
                                                                  setPartnerPayments(newPayments);
                                                              }
                                                          }}
                                                          className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 hover:underline"
                                                        >
                                                            توزيع تلقائي بالكامل
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}
                        <div className={paymentMethod === 'partner' ? 'md:col-span-2' : 'md:col-span-2'}>
                            <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1 block">رقم المرجع (Ref)</label>
                            <input type="text" placeholder="مثال: Inv-1234" value={orderReference || ''} onChange={e => setOrderReference(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white" />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4 mb-6">
                        <div>
                            <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1 block">ملاحظات</label>
                            <input type="text" placeholder="ملاحظات إضافية..." value={orderNotes || ''} onChange={e => setOrderNotes(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white" />
                        </div>
                    </div>
                    
                    <div className="border-t dark:border-slate-800 pt-6">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-lg font-bold dark:text-white flex items-center gap-2"><Package size={20} className="text-indigo-500"/> الأصناف والمخزون</h4>
                            <button onClick={addItemToOrder} className="flex items-center gap-1 text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-xl font-bold hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-all">+ إضافة صنف</button>
                        </div>

                        <div className="space-y-4">
                            {orderItems.map((item, idx) => (
                                <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="grid grid-cols-2 md:grid-cols-12 gap-3 items-end">
                                        <div className="col-span-2 md:col-span-4">
                                            <label className="text-xs text-slate-500 mb-1 block">المنتج</label>
                                            <ProductSelect 
                                                 value={item.productId || ''} 
                                                 onChange={val => {
                                                    const newItems = [...orderItems];
                                                    const product = settings.products.find(p => p.id === val);
                                                    newItems[idx].productId = val;
                                                    newItems[idx].name = product?.name;
                                                    newItems[idx].cost = product?.costPrice || 0;
                                                    setOrderItems(newItems);
                                                 }} 
                                                 products={settings.products}
                                            />
                                        </div>
                                        <div className="col-span-1 md:col-span-1">
                                            <label className="text-[10px] sm:text-xs text-slate-500 mb-1 block truncate">الكمية</label>
                                            <input type="number" min="1" value={item.quantity || 1} onChange={e => {
                                                const newItems = [...orderItems];
                                                newItems[idx].quantity = Number(e.target.value);
                                                setOrderItems(newItems);
                                            }} className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white text-center outline-none" />
                                        </div>
                                        <div className="col-span-1 md:col-span-1">
                                            <label className="text-[10px] sm:text-xs text-slate-500 mb-1 block truncate">بونص</label>
                                            <input type="number" min="0" value={item.bonusQuantity || 0} onChange={e => {
                                                const newItems = [...orderItems];
                                                newItems[idx].bonusQuantity = Number(e.target.value);
                                                setOrderItems(newItems);
                                            }} className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-emerald-400 font-bold text-center outline-none" />
                                        </div>
                                        <div className="col-span-2 sm:col-span-1 md:col-span-2">
                                            <label className="text-[10px] sm:text-xs text-slate-500 mb-1 block">التكلفة</label>
                                            <input type="number" min="0" value={item.cost || 0} onChange={e => {
                                                const newItems = [...orderItems];
                                                newItems[idx].cost = Number(e.target.value);
                                                setOrderItems(newItems);
                                            }} className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white outline-none" />
                                        </div>
                                        <div className="col-span-2 sm:col-span-1 md:col-span-3">
                                            <label className="text-[10px] sm:text-xs text-slate-500 mb-1 block">الخصم</label>
                                            <div className="flex gap-1">
                                                <input type="number" min="0" value={item.discountValue || 0} onChange={e => {
                                                    const newItems = [...orderItems];
                                                    newItems[idx].discountValue = Number(e.target.value);
                                                    setOrderItems(newItems);
                                                }} className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white outline-none" />
                                                <select value={item.discountType || 'amount'} onChange={e => {
                                                    const newItems = [...orderItems];
                                                    newItems[idx].discountType = e.target.value as 'amount' | 'percentage';
                                                    setOrderItems(newItems);
                                                }} className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] sm:text-xs dark:text-white outline-none">
                                                    <option value="amount">ج.م</option>
                                                    <option value="percentage">%</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="col-span-2 sm:col-span-1 md:col-span-1">
                                            <button onClick={() => setOrderItems(orderItems.filter((_, i) => i !== idx))} className="w-full p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all flex justify-center"><Trash2 size={18}/></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-8 bg-slate-900 dark:bg-black p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="text-center md:text-right">
                            <span className="text-slate-400 text-sm block mb-1">إجمالي الفاتورة الصافي</span>
                            <div className="text-3xl font-black text-emerald-400">
                                {orderItems.reduce((sum, item) => {
                                    let itemTotal = item.cost * item.quantity;
                                    if (item.discountValue) {
                                        if (item.discountType === 'percentage') {
                                            itemTotal -= (itemTotal * (item.discountValue / 100));
                                        } else {
                                            itemTotal -= (item.discountValue * item.quantity);
                                        }
                                    }
                                    return sum + itemTotal;
                                }, 0).toLocaleString()} ج.م
                            </div>
                        </div>
                        <div className="flex gap-3 w-full md:w-auto">
                           <button onClick={() => setShowOrderModal(false)} className="flex-1 md:flex-none px-8 py-3 text-slate-400 font-bold hover:text-white transition-all">إلغاء</button>
                           <button onClick={handleAddOrder} className="flex-1 md:flex-none px-12 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2">
                               <Save size={20}/> {editingOrder ? 'تحديث الفاتورة' : 'تأكيد وحفظ الفاتورة'}
                           </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && selectedSupplierForPayment && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold dark:text-white">تسجيل دفعة للمورد</h3>
                        <button onClick={() => setShowPaymentModal(false)} className="text-slate-400"><X size={20}/></button>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg mb-4">
                            <span className="text-xs text-indigo-600 dark:text-indigo-400 block">مديونية المورد الحالية</span>
                            <span className="text-lg font-black dark:text-white">{selectedSupplierForPayment.balance?.toLocaleString()} ج.م</span>
                        </div>
                        
                        <div>
                            <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1 block">المبلغ المدفوع</label>
                            <input 
                                type="number" 
                                className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-lg font-bold"
                                value={paymentAmount}
                                onChange={e => setPaymentAmount(Number(e.target.value))}
                            />
                        </div>
                        
                        <div>
                            <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1 block">ملاحظات (اختياري)</label>
                            <input 
                                type="text" 
                                placeholder="رقم التحويل أو الوثيقة..."
                                className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                                value={paymentNote}
                                onChange={e => setPaymentNote(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1 block">الدفع من</label>
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                <button 
                                    onClick={() => setPaymentMethod('cash')} 
                                    className={`flex-1 py-2 text-center rounded-lg font-bold transition-all text-xs ${paymentMethod === 'cash' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                                >
                                    المحفظة العامة
                                </button>
                                <button 
                                    onClick={() => setPaymentMethod('supply_wallet')} 
                                    className={`flex-1 py-2 text-center rounded-lg font-bold transition-all text-xs ${paymentMethod === 'supply_wallet' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                                >
                                    محفظة التوريد
                                </button>
                                <button 
                                    onClick={() => setPaymentMethod('treasury')} 
                                    className={`flex-1 py-2 text-center rounded-lg font-bold transition-all text-xs ${paymentMethod === 'treasury' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}
                                >
                                    الخزينة
                                </button>
                            </div>

                            {paymentMethod === 'treasury' && (
                                <div className="mt-4 animate-in slide-in-from-top-2 duration-300">
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">خصم من حساب الخزينة:</label>
                                    <select 
                                        value={selectedTreasuryAccountId} 
                                        onChange={e => setSelectedTreasuryAccountId(e.target.value)} 
                                        className="w-full p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl outline-none dark:text-white text-xs font-bold"
                                        required
                                    >
                                        <option value="">-- اختر حساباً --</option>
                                        {(treasury?.accounts || []).map((acc: any) => (
                                            <option key={acc.id} value={acc.id}>{acc.name} ({acc.balance.toLocaleString()} ج.م)</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <button onClick={handleRecordPayment} className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2">
                            <Save size={20}/> تأكيد الدفع وخصم المديونية
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default SuppliersPage;