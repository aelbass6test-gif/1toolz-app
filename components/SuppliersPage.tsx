import React, { useState } from 'react';
import { Settings, Supplier, SupplyOrder, Transaction } from '../types';
import { UserPlus, Truck, Save, Plus, Package, Calendar, DollarSign, User, Trash2, Edit2, Eye, X, Phone, Percent, AlertCircle, Coins, Clock, Check, ArrowRight, ChevronDown, Activity, Briefcase } from 'lucide-react';
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

  // Advanced custom avatar colorizer based on supplier names for top-tier visual personality
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-indigo-50/80 text-indigo-600 border-indigo-100/50 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900/30',
      'bg-emerald-50/80 text-emerald-600 border-emerald-100/50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/30',
      'bg-rose-50/80 text-rose-600 border-rose-100/50 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/30',
      'bg-amber-50/80 text-amber-600 border-amber-100/50 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/30',
      'bg-sky-50/80 text-sky-600 border-sky-100/50 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900/30',
      'bg-teal-50/80 text-teal-600 border-teal-100/50 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-900/30',
    ];
    let sum = 0;
    const cleanName = name || '';
    for (let i = 0; i < cleanName.length; i++) {
      sum += cleanName.charCodeAt(i);
    }
    return colors[sum % colors.length];
  };

  const totalLiabilities = React.useMemo(() => {
    return (settings.suppliers || []).reduce((sum, s) => sum + (s.balance || 0), 0);
  }, [settings.suppliers]);

  const totalInventoryWorth = React.useMemo(() => {
    return (settings.products || []).reduce((sum, p) => sum + ((p.stockQuantity || 0) * (p.costPrice || 0)), 0);
  }, [settings.products]);

  const totalSuppliersCount = React.useMemo(() => {
    return (settings.suppliers || []).length;
  }, [settings.suppliers]);

  const totalOrdersCount = React.useMemo(() => {
    return (settings.supplyOrders || []).length;
  }, [settings.supplyOrders]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16 px-4 sm:px-8" dir="rtl">
      {/* Premium Elegant Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">سلسلة التوريد المتقدمة والمخزن الذكي</span>
          </div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <Truck size={34} className="text-indigo-600 dark:text-indigo-500"/>
            إدارة الموردين والمخزون المركزي
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm font-medium">سجل الموردين المعتمدين، تابع فواتير الشراء وأوامر التوريد بالتفصيل، وتحكم في أرصدة وتسويات جرد مستودعاتك بدقة لا متناهية.</p>
        </div>
      </div>

      {/* 4 Superb Visual Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 left-0 w-2 h-full bg-rose-500"></div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-505">مديونيات الموردين</p>
              <h3 className="text-2xl font-black text-slate-850 dark:text-white mt-1 tracking-tight">
                {totalLiabilities.toLocaleString()} <span className="text-xs font-bold opacity-60">ج.م</span>
              </h3>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-2xl">
              <Coins size={20} />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 font-semibold">مستحقات معلقة للموردين تسدد لاحقاً</p>
        </div>

        <div className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 left-0 w-2 h-full bg-emerald-550 bg-emerald-500"></div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-505">رأس مال المخزون الحالي</p>
              <h3 className="text-2xl font-black text-slate-850 dark:text-white mt-1 tracking-tight">
                {totalInventoryWorth.toLocaleString()} <span className="text-xs font-bold opacity-60">ج.م</span>
              </h3>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <Package size={20} />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 font-semibold">إجمالي تقييم تكلفة السلع المتواجدة بالمخزن</p>
        </div>

        <div className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-505">شركاء التوريد المعتمدين</p>
              <h3 className="text-2xl font-black text-slate-850 dark:text-white mt-1 tracking-tight">
                {totalSuppliersCount} <span className="text-xs font-bold opacity-60">جهات</span>
              </h3>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
              <UserPlus size={20} />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 font-semibold">إدارة بيانات وجهات الموردين وتواصلهم</p>
        </div>

        <div className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 left-0 w-2 h-full bg-amber-500"></div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-505">رصيد عمليات التوريد</p>
              <h3 className="text-2xl font-black text-slate-850 dark:text-white mt-1 tracking-tight">
                {totalOrdersCount} <span className="text-xs font-bold opacity-60">أمر توريد</span>
              </h3>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-2xl">
              <Calendar size={20} />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 font-semibold">عدد فواتير الشراء ومحاضر الاستلام الموثقة</p>
        </div>
      </div>

      {/* Modern Capsule Tab Bar Navigator */}
      <div className="flex gap-2 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-3xl border border-slate-200/40 dark:border-slate-700/40 w-full sm:w-fit overflow-x-auto select-none">
        <button 
          onClick={() => setActiveTab('orders')} 
          className={`flex-1 sm:flex-none px-6 py-3 rounded-2xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'orders' 
              ? 'bg-white dark:bg-slate-755 dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' 
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Coins size={14}/>
          <span>فواتير وأوامر الشراء</span>
        </button>
        <button 
          onClick={() => setActiveTab('suppliers')} 
          className={`flex-1 sm:flex-none px-6 py-3 rounded-2xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'suppliers' 
              ? 'bg-white dark:bg-slate-755 dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' 
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <User size={14}/>
          <span>قائمة الموردين المعتمدين</span>
        </button>
        <button 
          onClick={() => setActiveTab('audit')} 
          className={`flex-1 sm:flex-none px-6 py-3 rounded-2xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'audit' 
              ? 'bg-white dark:bg-slate-755 dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' 
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Activity size={14}/>
          <span>مراجعة وجرد المستودع</span>
        </button>
      </div>

      {activeTab === 'orders' && (
        <div className="space-y-6">
          <button 
            onClick={() => {
              setEditingOrder(null);
              setSelectedSupplierId('');
              setOrderReference('');
              setOrderNotes('');
              setOrderItems([]);
              setShowOrderModal(true);
            }} 
            className="w-full py-6 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-[2rem] flex items-center justify-center gap-3 text-slate-600 dark:text-slate-400 hover:text-indigo-600 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/10 transition-all duration-300 font-black text-sm shadow-sm hover:shadow-md cursor-pointer group"
          >
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-505 text-indigo-600 group-hover:scale-110 transition-transform">
              <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            </div>
            <span>تسجيل فاتورة شراء جديدة / أمر توريد وارد</span>
          </button>

          <div className="grid gap-5">
            {(!settings.supplyOrders || settings.supplyOrders.length === 0) ? (
              <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-[2rem] border border-slate-100 dark:border-slate-800/80">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 text-slate-400 w-fit mx-auto rounded-full mb-4">
                  <Package size={40} />
                </div>
                <h4 className="text-base font-bold text-slate-700 dark:text-slate-200">لا توجد أوامر توريد مسجلة حتى الآن</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-2">سجل أولى فواتير التوريد لزيادة مخزون سلعك وتسجيل المعاملات المالية المترتبة عليها.</p>
              </div>
            ) : (
              (settings.supplyOrders || []).map(order => {
                const supplier = settings.suppliers.find(s => s.id === order.supplierId);
                return (
                  <div key={order.id} className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-slate-200/80 dark:hover:border-slate-700/80 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 transition-all duration-300">
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${getAvatarColor(supplier?.name || '')}`}>
                          <User size={18}/>
                        </div>
                        <span className="font-extrabold text-slate-800 dark:text-white text-base">{supplier?.name || 'مورد غير معروف'}</span>
                        {order.referenceNumber && (
                          <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl text-slate-500 border border-slate-200/40 dark:border-slate-700/40 uppercase tracking-widest leading-none">
                            Ref: {order.referenceNumber}
                          </span>
                        )}
                      </div>
                      
                      <div className="text-xs text-slate-400 dark:text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Calendar size={13} className="text-slate-400"/>
                          {new Date(order.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                        
                        <span className="text-slate-300">|</span>
                        
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 border ${
                          order.paymentMethod === 'credit'
                            ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-405 border-rose-100 dark:border-rose-900/30'
                            : order.paymentMethod === 'partner'
                            ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-405 border-amber-100 dark:border-amber-900/30'
                            : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-455 border-emerald-100 dark:border-emerald-900/30'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            order.paymentMethod === 'credit' ? 'bg-rose-500' : order.paymentMethod === 'partner' ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}></span>
                          {order.paymentMethod === 'credit' ? 'آجل مديونية' : order.paymentMethod === 'partner' ? 'تمويل شركاء' : 'مدفوعة كاش'}
                        </span>
                        
                        {order.notes && (
                          <>
                            <span className="text-slate-300">|</span>
                            <span className="opacity-80 italic font-medium max-w-xs truncate" title={order.notes}>{order.notes}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex w-full lg:w-auto items-center justify-between lg:justify-end gap-5 border-t lg:border-0 pt-4 lg:pt-0 border-slate-100 dark:border-slate-800">
                      {/* Products visual thumbnails pile */}
                      <div className="flex -space-x-2.5 sm:-space-x-3.5 space-x-reverse overflow-hidden shrink-0">
                        {order.items.slice(0, 4).map((item, i) => {
                          const product = settings.products.find(p => p.id === item.productId);
                          return (
                            <div key={i} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-white dark:border-slate-900 bg-slate-50 dark:bg-slate-800 overflow-hidden shadow-sm shrink-0 flex items-center justify-center">
                              {product?.thumbnail ? (
                                <img src={product.thumbnail} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : <Package size={14} className="text-slate-400" />}
                            </div>
                          );
                        })}
                        {order.items.length > 4 && (
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-white dark:border-slate-900 bg-slate-150 dark:bg-slate-700 flex items-center justify-center text-[10px] sm:text-xs font-black text-slate-600 dark:text-slate-300 shrink-0">
                            +{order.items.length - 4}
                          </div>
                        )}
                      </div>

                      <div className="text-left select-none">
                        <div className="font-black text-xl sm:text-2xl text-emerald-600 dark:text-emerald-555 tracking-tight">
                          {order.totalCost.toLocaleString()} <span className="text-xs font-bold">ج.م</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold block mt-0.5">
                          {order.items.length} أصناف مدمجة {order.items.reduce((s, i) => s + (i.bonusQuantity || 0), 0) > 0 && `(+ ${order.items.reduce((s, i) => s + (i.bonusQuantity || 0), 0)} بونص)`}
                        </div>
                      </div>

                      <div className="flex gap-1 bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded-2xl border border-slate-100/50 dark:border-slate-800/40 shrink-0">
                        <button 
                          onClick={() => startEditOrder(order)} 
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700/60 rounded-xl transition-all cursor-pointer shadow-none hover:shadow-sm"
                          title="تعديل هذا الأمر"
                        >
                          <Edit2 size={15}/>
                        </button>
                        <button 
                          onClick={() => handleDeleteOrder(order)} 
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white dark:hover:bg-slate-700/60 rounded-xl transition-all cursor-pointer shadow-none hover:shadow-sm"
                          title="حذف هذا الأمر"
                        >
                          <Trash2 size={15}/>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'suppliers' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 dark:border-slate-800">
            <h3 className="text-lg font-black dark:text-white flex items-center gap-2">
              <span className="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
              قائمة الشركاء والمورّدين الماليين
            </h3>
            <button 
              onClick={() => { 
                setEditingSupplier(null); 
                setNewSupplier({name:'', phone:'', address:'', notes:''}); 
                setShowSupplierModal(true); 
              }} 
              className="flex items-center gap-2 bg-indigo-650 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-black text-xs sm:text-sm shadow-lg shadow-indigo-600/15 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
            >
              <UserPlus size={18}/> 
              <span>إضافة شريك توريد جديد</span>
            </button>
          </div>

          {(!settings.suppliers || settings.suppliers.length === 0) ? (
            <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-[2rem] border border-slate-100 dark:border-slate-800/80">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 text-slate-400 w-fit mx-auto rounded-full mb-4">
                <User size={40} />
              </div>
              <h4 className="text-base font-bold text-slate-700 dark:text-slate-200">لم يتم تسجيل أي موردين باصقة</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-2">باشر بإضافة شركاء التوريد الماليين والمقرضين لتسجيل طلبيات استيراد المخازن وحفظ صفقات الآجل.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(settings.suppliers || []).map(supplier => (
                <div key={supplier.id} className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-[2.2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700 transition-all duration-300">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base border shrink-0 ${getAvatarColor(supplier.name)}`}>
                          {(supplier.name || 'م')[0]}
                        </div>
                        <div className="text-right">
                          <h3 className="font-extrabold text-base dark:text-white truncate max-w-[180px] sm:max-w-xs">{supplier.name}</h3>
                          <p className="text-slate-400 text-xs font-semibold flex items-center gap-1 mt-0.5" dir="ltr">
                            <Phone size={12} className="text-slate-400"/>
                            <span>{supplier.phone || 'بلا رقم هاتف'}</span>
                          </p>
                        </div>
                      </div>

                      {/* Display Liabilities Pill if balance > 0 */}
                      {(supplier.balance || 0) > 0 ? (
                        <span className="text-[10px] font-black bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 px-3 py-1.5 rounded-2xl border border-rose-100/60 dark:border-rose-900/30 whitespace-nowrap shadow-sm">
                          مديونية: {supplier.balance?.toLocaleString()} ج.م
                        </span>
                      ) : (
                        <span className="text-[10px] font-black bg-indigo-50/50 dark:bg-slate-800/80 text-indigo-505 text-indigo-500 px-3 py-1.5 rounded-2xl border border-slate-100 dark:border-slate-800/50 whitespace-nowrap">
                          مخلص بالكامل
                        </span>
                      )}
                    </div>

                    {supplier.address && (
                      <p className="text-slate-500 dark:text-slate-455 text-xs bg-slate-50/50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100/60 dark:border-slate-800/50 leading-relaxed text-right">
                        {supplier.address}
                      </p>
                    )}

                    {supplier.notes && (
                      <div className="bg-amber-50/20 dark:bg-amber-950/10 p-3 rounded-2xl border border-dashed border-amber-500/10 text-right">
                        <span className="font-extrabold text-[9px] text-amber-600 block mb-1">ملاحظات العمل:</span>
                        <p className="text-slate-400 text-[11px] leading-relaxed italic">{supplier.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-850 flex justify-between items-center gap-3">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => startEditSupplier(supplier)} 
                        className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all cursor-pointer" 
                        title="تعديل بيانات المورد"
                      >
                        <Edit2 size={16}/>
                      </button>
                      <button 
                        onClick={() => handleDeleteSupplier(supplier.id)} 
                        className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all cursor-pointer" 
                        title="حذف المورد نهائياً"
                      >
                        <Trash2 size={16}/>
                      </button>
                    </div>

                    {(supplier.balance || 0) > 0 && (
                      <button 
                        onClick={() => { 
                          setSelectedSupplierForPayment(supplier); 
                          setPaymentAmount(supplier.balance || 0); 
                          setShowPaymentModal(true); 
                        }} 
                        className="flex items-center gap-1 px-4 py-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 font-extrabold text-xs rounded-xl border border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all cursor-pointer"
                        title="تسجيل دفعة سداد"
                      >
                        <DollarSign size={13}/>
                        <span>تسجيل سداد مديونية</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <InventoryAudit settings={settings} setSettings={setSettings} currentUser={currentUser} />
      )}

      {/* Supplier Modal Dialog */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="bg-indigo-900 dark:bg-indigo-950 p-6 text-white flex justify-between items-center">
              <h3 className="text-lg font-black">{editingSupplier ? 'تحديث بيانات مورد معتمد' : 'تسجيل شريك توريد جديد'}</h3>
              <button 
                onClick={() => { 
                  setShowSupplierModal(false); 
                  setEditingSupplier(null); 
                  setNewSupplier({name:'', phone:'', address:'', notes:''}); 
                }} 
                className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <X size={20}/>
              </button>
            </div>
            <div className="p-6 space-y-4 text-right">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">اسم المورد الشامل *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <User size={16}/>
                  </div>
                  <input 
                    type="text" 
                    placeholder="مثال: شركة النور للاستيراد والتصدير" 
                    className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-xs dark:text-white placeholder-slate-400"
                    value={newSupplier.name || ''} 
                    onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} 
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">رقم الهاتف للتواصل</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone size={16}/>
                  </div>
                  <input 
                    type="text" 
                    dir="ltr"
                    placeholder="01xxxxxxxxx" 
                    className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-xs dark:text-white text-right placeholder-slate-400"
                    value={newSupplier.phone || ''} 
                    onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} 
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">العنوان أو المقر</label>
                <input 
                  type="text" 
                  placeholder="المدينة، الشارع، المحافظة" 
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-xs dark:text-white placeholder-slate-400" 
                  value={newSupplier.address || ''} 
                  onChange={e => setNewSupplier({...newSupplier, address: e.target.value})} 
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">ملاحظات عمل مخصصة</label>
                <textarea 
                  placeholder="أي معلومات إضافية، شروط السداد، البونص الدائم..." 
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-semibold text-xs dark:text-white h-24 resize-none placeholder-slate-400" 
                  value={newSupplier.notes || ''} 
                  onChange={e => setNewSupplier({...newSupplier, notes: e.target.value})} 
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => { 
                    setShowSupplierModal(false); 
                    setEditingSupplier(null); 
                    setNewSupplier({name:'', phone:'', address:'', notes:''}); 
                  }} 
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-755 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  إلغاء الأمر
                </button>
                <button 
                  onClick={handleAddSupplier} 
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                >
                  {editingSupplier ? 'تحديث البيانات' : 'تأكيد الحفظ المعجل'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Feature Order (Supply Invoice) Modal Dialog */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2rem] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            <div className="bg-slate-900 dark:bg-black p-6 text-white flex justify-between items-center border-b border-white/5 shrink-0">
              <div>
                <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                  <Package className="text-indigo-400"/>
                  {editingOrder ? 'تعديل تفاصيل أمر التوريد والكميات' : 'تسجيل فاتورة شراء واستلام شحنة بضاعة'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">تؤثر هذه الفاتورة تلقائياً على مخزون سلعك المركزي وتحدث الأرصدة المالية مباشرة.</p>
              </div>
              <button 
                onClick={() => setShowOrderModal(false)} 
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              >
                <X size={20}/>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-right flex-1">
              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-black text-slate-500 mb-1.5 block">مورد الفاتورة المعتمد *</label>
                  <select 
                    value={selectedSupplierId || ''} 
                    onChange={e => setSelectedSupplierId(e.target.value)} 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-250 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-xs dark:text-white"
                  >
                    <option value="">-- اختر مورد الشحنة --</option>
                    {(settings.suppliers || []).map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} {(s.balance || 0) > 0 ? `(مديونية متبقية: ${s.balance.toLocaleString()} ج.م)` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-500 mb-1.5 block">طريقة سداد تكلفة الفاتورة *</label>
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto no-scrollbar gap-1">
                    <button 
                      onClick={() => setPaymentMethod('cash')} 
                      className={`flex-1 min-w-[70px] py-2 px-1 text-center rounded-lg font-black transition-all text-[10px] sm:text-xs cursor-pointer ${
                        paymentMethod === 'cash' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      كاش (العامة)
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('supply_wallet')} 
                      className={`flex-1 min-w-[70px] py-2 px-1 text-center rounded-lg font-black transition-all text-[10px] sm:text-xs cursor-pointer ${
                        paymentMethod === 'supply_wallet' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      محفظة التوريد
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('partner')} 
                      className={`flex-1 min-w-[70px] py-2 px-1 text-center rounded-lg font-black transition-all text-[10px] sm:text-xs cursor-pointer ${
                        paymentMethod === 'partner' ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      تمويل شركاء
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('treasury')} 
                      className={`flex-1 min-w-[70px] py-2 px-1 text-center rounded-lg font-black transition-all text-[10px] sm:text-xs cursor-pointer ${
                        paymentMethod === 'treasury' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      الخزينة
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('credit')} 
                      className={`flex-1 min-w-[70px] py-2 px-1 text-center rounded-lg font-black transition-all text-[10px] sm:text-xs cursor-pointer ${
                        paymentMethod === 'credit' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      آجل مديونية
                    </button>
                  </div>
                </div>
              </div>

              {/* Warnings and Additional Fields based on payment method */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-805 text-xs text-slate-500 space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-600 dark:text-slate-355">
                  <AlertCircle size={14} className="text-indigo-500" />
                  <span>آلية سداد الفاتورة الحالية:</span>
                </div>
                <p className="font-semibold text-[11px] leading-relaxed">
                  {paymentMethod === 'cash' && 'سيتم خصم قيمة الفاتورة فورياً وتلقائياً من السيولة المتواجدة بالمحفظة العامة.'}
                  {paymentMethod === 'supply_wallet' && 'رأس مال البضائع: يخصم المبلغ من محفظة التوريد المركزية المستقلة.'}
                  {paymentMethod === 'treasury' && 'الخزينة المخصصة: سيتم الخصم المباشر من الحساب البنكي أو الخزنة المحددة بالأسفل.'}
                  {paymentMethod === 'credit' && 'مديونية معلقة: سيتم تسجيل إجمالي التكلفة كحساب دائن للمورد (تلتزم بدفعه لاحقاً).'}
                  {paymentMethod === 'partner' && 'توزيع التكلفة على أرصدة الشركاء من حساباتهم الجارية بالتفصيل قبل الشراء.'}
                </p>

                {paymentMethod === 'treasury' && (
                  <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-800 animate-in slide-in-from-top-2 duration-300">
                    <label className="text-xs font-black text-indigo-600 dark:text-indigo-400 mb-1.5 block">خصم التمويل من حساب خزينة محدد:</label>
                    <select 
                      value={selectedTreasuryAccountId} 
                      onChange={e => setSelectedTreasuryAccountId(e.target.value)} 
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-800 rounded-xl outline-none dark:text-white text-xs font-bold"
                      required
                    >
                      <option value="">-- اختر حساب الخزينة المستخلفة للمال --</option>
                      {(treasury?.accounts || []).map((acc: any) => (
                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.balance.toLocaleString()} ج.م)</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {paymentMethod === 'partner' && (
                <div className="space-y-4 bg-slate-50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-3">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-black text-slate-600 dark:text-slate-400">توزيع حصص الدفع الشركاء الممولين</label>
                    <button 
                      type="button"
                      onClick={() => setPartnerPayments([...partnerPayments, { partnerId: '', amount: 0 }])}
                      className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <Plus size={12}/> إضافة شريك شحن ثانِي
                    </button>
                  </div>
                  
                  {partnerPayments.map((payment, pidx) => (
                    <div key={pidx} className="flex gap-2 items-center">
                      <div className="flex-1">
                        <select 
                          value={payment.partnerId} 
                          onChange={e => {
                            const newPayments = [...partnerPayments];
                            newPayments[pidx].partnerId = e.target.value;
                            setPartnerPayments(newPayments);
                          }}
                          className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white font-bold"
                        >
                          <option value="">اختر اسم الشريك...</option>
                          {settings.partners?.map(p => <option key={p.id} value={p.id}>{p.name} (رصيده الجاري: {p.balance} ج.م)</option>)}
                        </select>
                      </div>
                      <div className="w-28 sm:w-36">
                        <input 
                          type="number" 
                          value={payment.amount || ''}
                          onChange={e => {
                            const newPayments = [...partnerPayments];
                            newPayments[pidx].amount = Number(e.target.value);
                            setPartnerPayments(newPayments);
                          }}
                          placeholder="المبلغ المدفوع ج.م"
                          className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-center font-bold outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={() => setPartnerPayments(partnerPayments.filter((_, i) => i !== pidx))}
                        className="p-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex flex-col sm:flex-row justify-between items-center gap-2">
                    {(() => {
                      const distributedTotal = partnerPayments.reduce((s, p) => s + p.amount, 0);
                      const remains = totalCost - distributedTotal;
                      return (
                        <>
                          <span className={`text-[10px] font-black uppercase ${Math.abs(remains) < 0.01 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            المبلغ الموزع: {distributedTotal.toLocaleString()} ج.م / المتبقي لتغطية الفاتورة: {remains.toLocaleString()} ج.م
                          </span>
                          <div className="flex gap-2 flex-wrap">
                            {distributedTotal < totalCost && partnerPayments.length > 0 && (
                              <button 
                                type="button"
                                onClick={() => {
                                  const remaining = totalCost - distributedTotal;
                                  const newPayments = [...partnerPayments];
                                  const emptyIdx = newPayments.findIndex(p => p.amount === 0);
                                  if (emptyIdx > -1) {
                                      newPayments[emptyIdx].amount += remaining;
                                  } else {
                                      newPayments[newPayments.length - 1].amount += remaining;
                                  }
                                  setPartnerPayments(newPayments);
                                }}
                                className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 hover:underline"
                              >
                                تغطية المتبقي بالكامل ({(totalCost - distributedTotal).toLocaleString()})
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
                                className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 hover:underline"
                              >
                                توزيع بالتساوي
                              </button>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-slate-500 mb-1 block">رقم مرجع الفاتورة الشراء (ID)</label>
                  <input 
                    type="text" 
                    placeholder="مثال: Inv-9952" 
                    value={orderReference || ''} 
                    onChange={e => setOrderReference(e.target.value)} 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-xs dark:text-white" 
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 mb-1 block">بيان أو ملاحظات الفاتورة</label>
                  <input 
                    type="text" 
                    placeholder="امثلة: بضاعة صيفية، كميات مضافة لعروض موسمية" 
                    value={orderNotes || ''} 
                    onChange={e => setOrderNotes(e.target.value)} 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-semibold text-xs dark:text-white" 
                  />
                </div>
              </div>

              {/* Inventory items allocation */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-5">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-black dark:text-white flex items-center gap-2">
                    <Package size={18} className="text-indigo-500"/>
                    السلع المستوردة لإدخالها في مخازن الفروع
                  </h4>
                  <button 
                    onClick={addItemToOrder} 
                    className="flex items-center gap-1.5 text-xs bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-xl font-black transition-all cursor-pointer"
                  >
                    <Plus size={14}/>
                    <span>إدراج صنف جديد</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {orderItems.length === 0 ? (
                    <div className="bg-slate-50/50 dark:bg-slate-800/20 p-8 rounded-2xl text-center border border-dashed border-slate-200 dark:border-slate-700/80">
                      <p className="text-slate-400 text-xs font-bold">لم تدرج أي سلع في الفاتورة بعد.</p>
                      <button 
                        onClick={addItemToOrder} 
                        className="text-xs font-black text-indigo-505 text-indigo-600 hover:underline mt-2 inline-block cursor-pointer"
                      >
                        انقر لإدراج أول منتج للتوريد
                      </button>
                    </div>
                  ) : (
                    orderItems.map((item, idx) => (
                      <div key={idx} className="bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-2.5rem rounded-2xl border border-slate-100 dark:border-slate-800/80">
                        <div className="grid grid-cols-2 md:grid-cols-12 gap-3 items-end">
                          <div className="col-span-2 md:col-span-5 text-right">
                            <label className="text-[10px] font-bold text-slate-400 mb-1 block">تحديد الموديل / المنتج المتاح</label>
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
                            <label className="text-[10px] font-bold text-slate-400 mb-1 block text-center">الكمية</label>
                            <input 
                              type="number" 
                              min="1" 
                              value={item.quantity || ''} 
                              onChange={e => {
                                const newItems = [...orderItems];
                                newItems[idx].quantity = Number(e.target.value);
                                setOrderItems(newItems);
                              }} 
                              className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white text-center font-black outline-none" 
                            />
                          </div>

                          <div className="col-span-1 md:col-span-1">
                            <label className="text-[10px] font-bold text-slate-400 mb-1 block text-center">بونص مجاني</label>
                            <input 
                              type="number" 
                              min="0" 
                              value={item.bonusQuantity || ''} 
                              onChange={e => {
                                const newItems = [...orderItems];
                                newItems[idx].bonusQuantity = Number(e.target.value);
                                setOrderItems(newItems);
                              }} 
                              className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-emerald-555 text-emerald-600 text-center font-black outline-none" 
                            />
                          </div>

                          <div className="col-span-1 md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-400 mb-1 block">تكلفة شراء الحبة</label>
                            <input 
                              type="number" 
                              min="0" 
                              value={item.cost || ''} 
                              onChange={e => {
                                const newItems = [...orderItems];
                                newItems[idx].cost = Number(e.target.value);
                                setOrderItems(newItems);
                              }} 
                              className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-black outline-none" 
                            />
                          </div>

                          <div className="col-span-1 md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-400 mb-1 block">الخصم الإضافي</label>
                            <div className="flex gap-1">
                              <input 
                                type="number" 
                                min="0" 
                                value={item.discountValue || ''} 
                                onChange={e => {
                                  const newItems = [...orderItems];
                                  newItems[idx].discountValue = Number(e.target.value);
                                  setOrderItems(newItems);
                                }} 
                                className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs dark:text-white font-bold outline-none" 
                              />
                              <select 
                                value={item.discountType || 'amount'} 
                                onChange={e => {
                                  const newItems = [...orderItems];
                                  newItems[idx].discountType = e.target.value as 'amount' | 'percentage';
                                  setOrderItems(newItems);
                                }} 
                                className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] dark:text-white outline-none font-bold"
                              >
                                <option value="amount">ج.م</option>
                                <option value="percentage">%</option>
                              </select>
                            </div>
                          </div>

                          <div className="col-span-2 md:col-span-1">
                            <button 
                              onClick={() => setOrderItems(orderItems.filter((_, i) => i !== idx))} 
                              className="w-full p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/25 rounded-xl transition-all flex justify-center cursor-pointer"
                              title="حذف هذا الصنف من الفاتورة"
                            >
                              <Trash2 size={16}/>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Total Bottom sticky footer */}
            <div className="p-6 bg-slate-900 dark:bg-black flex flex-col sm:flex-row justify-between items-center gap-5 shrink-0">
              <div className="text-center sm:text-right select-none">
                <span className="text-slate-400 text-[11px] block mb-0.5">صافي إجمالي المستحقات النهائية</span>
                <div className="text-3xl font-black text-emerald-400 tracking-tight">
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
                  }, 0).toLocaleString()} <span className="text-base font-bold text-white/60">ج.م</span>
                </div>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <button 
                  onClick={() => setShowOrderModal(false)} 
                  className="flex-1 sm:flex-none px-6 py-3.5 text-slate-400 hover:text-white font-bold transition-all text-xs cursor-pointer"
                >
                  إلغاء وتجاهل
                </button>
                <button 
                  onClick={handleAddOrder} 
                  className="flex-1 sm:flex-none px-10 py-3.5 bg-emerald-500 text-white rounded-xl font-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  <Save size={16}/>
                  <span>{editingOrder ? 'حفظ وتحديث الفاتورة' : 'تأكيد وترحيل الفاتورة للمخازن'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Supplier settlement Modal Dialog */}
      {showPaymentModal && selectedSupplierForPayment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 dark:bg-black p-5 text-white flex justify-between items-center">
              <h3 className="text-base font-black">تسجيل دفعة سداد للمورد</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
            </div>
            
            <div className="p-6 space-y-4 text-right">
              <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30">
                <span className="text-xs text-indigo-600 dark:text-indigo-400 block mb-0.5 font-bold">اسم المورد الحالي</span>
                <span className="font-extrabold text-slate-800 dark:text-white block text-sm">{selectedSupplierForPayment.name}</span>
                <span className="text-[10px] text-slate-400 block mt-2">إجمالي المسحوبات المستحقة في الدفتر الجاري:</span>
                <span className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight mt-0.5 block">{selectedSupplierForPayment.balance?.toLocaleString()} ج.م</span>
              </div>
              
              <div>
                <label className="text-xs font-black text-slate-500 mb-1.5 block">مبلغ السداد المدفوع *</label>
                <div className="relative">
                  <input 
                    type="number" 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-205 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none dark:text-white text-lg font-black"
                    value={paymentAmount || ''}
                    onChange={e => setPaymentAmount(Number(e.target.value))}
                  />
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none font-bold text-xs text-slate-400">
                    ج.م
                  </div>
                </div>
                {/* Visual Quick percentages selection */}
                <div className="flex gap-1.5 mt-2">
                  <button 
                    onClick={() => setPaymentAmount(Math.round((selectedSupplierForPayment.balance || 0) * 0.25))}
                    className="flex-1 py-1 bg-slate-100 text-slate-550 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 rounded-lg text-[10px] font-black cursor-pointer"
                  >
                    25%
                  </button>
                  <button 
                    onClick={() => setPaymentAmount(Math.round((selectedSupplierForPayment.balance || 0) * 0.50))}
                    className="flex-1 py-1 bg-slate-100 text-slate-550 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 rounded-lg text-[10px] font-black cursor-pointer"
                  >
                    50%
                  </button>
                  <button 
                    onClick={() => setPaymentAmount(selectedSupplierForPayment.balance || 0)}
                    className="flex-1 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 rounded-lg text-[10px] font-black cursor-pointer"
                  >
                    سداد بالكامل
                  </button>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-black text-slate-500 mb-1 block">رقم التحويل أو مرجع المستند</label>
                <input 
                  type="text" 
                  placeholder="مثال: فودافون كاش، حوالة بنكية، شيك..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none dark:text-white text-xs font-semibold"
                  value={paymentNote}
                  onChange={e => setPaymentNote(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-black text-slate-500 mb-1.5 block">سحب التمويل من حساب:</label>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 shrink-0 select-none">
                  <button 
                    onClick={() => setPaymentMethod('cash')} 
                    className={`flex-1 py-2 text-center rounded-lg font-black transition-all text-[10px] sm:text-xs cursor-pointer ${
                      paymentMethod === 'cash' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    المحفظة العامة
                  </button>
                  <button 
                    onClick={() => setPaymentMethod('supply_wallet')} 
                    className={`flex-1 py-2 text-center rounded-lg font-black transition-all text-[10px] sm:text-xs cursor-pointer ${
                      paymentMethod === 'supply_wallet' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    محفظة التوريد
                  </button>
                  <button 
                    onClick={() => setPaymentMethod('treasury')} 
                    className={`flex-1 py-2 text-center rounded-lg font-black transition-all text-[10px] sm:text-xs cursor-pointer ${
                      paymentMethod === 'treasury' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    الخزينة
                  </button>
                </div>

                {paymentMethod === 'treasury' && (
                  <div className="mt-4 animate-in slide-in-from-top-2 duration-350">
                    <label className="text-[10px] font-black text-indigo-605 text-indigo-505 mb-1 block">خصم الدفعة الجارية من خزينة محددة:</label>
                    <select 
                      value={selectedTreasuryAccountId} 
                      onChange={e => setSelectedTreasuryAccountId(e.target.value)} 
                      className="w-full p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl outline-none dark:text-white text-xs font-bold"
                      required
                    >
                      <option value="">-- اختر حساب الخزينة المنفذ له السداد --</option>
                      {(treasury?.accounts || []).map((acc: any) => (
                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.balance.toLocaleString()} ج.م)</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button 
                  onClick={handleRecordPayment} 
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black shadow-lg shadow-emerald-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  <Check size={16}/>
                  <span>تأكيد تسجيل السداد وخصم المديونية</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppliersPage;