import React, { useState } from 'react';
import { Settings, Supplier, SupplyOrder, Transaction, PurchaseReturn, PurchaseReturnItem } from '../types';
import { 
  UserPlus, Truck, Save, Plus, Package, Calendar, DollarSign, User, Trash2, 
  Edit2, Eye, X, Phone, Percent, AlertCircle, Coins, Clock, Check, ArrowRight, 
  ChevronDown, Activity, Briefcase, TrendingUp, TrendingDown, BarChart2, 
  PieChart as LucidePieChart, Download, Printer, Layers, HelpCircle, CheckCircle2,
  Search, Info, RotateCw
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { SupplyOrderItem } from '../types';
import { InventoryAudit } from './InventoryAudit';
import { getLatestProductCost } from '../utils/financials';
import { audioSynth } from '../utils/audioSynth';
import { motion, AnimatePresence } from 'motion/react';

interface SuppliersPageProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  wallet: any;
  setWallet: React.Dispatch<React.SetStateAction<any>>;
  treasury?: any;
  setTreasury?: (updater: any) => void;
  currentUser?: any;
  orders: any[];
}

const SuppliersPage: React.FC<SuppliersPageProps> = ({ settings, setSettings, wallet, setWallet, treasury, setTreasury, currentUser, orders }) => {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'orders' | 'inventory' | 'analytics' | 'audit' | 'warehouses'>('orders');
  
  if (!settings) return null;

  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSupplierForPayment, setSelectedSupplierForPayment] = useState<Supplier | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentNote, setPaymentNote] = useState('');
  const [selectedTreasuryAccountId, setSelectedTreasuryAccountId] = useState('');
  
  // New Supplier State
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({ name: '', phone: '', address: '', notes: '' });

  // Warehouse State
  const [editingWarehouse, setEditingWarehouse] = useState<any | null>(null);
  const [newWarehouse, setNewWarehouse] = useState({ name: '', location: '', isDefault: false });
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  
  // New Order State
  const [editingOrder, setEditingOrder] = useState<SupplyOrder | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [orderReference, setOrderReference] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderItems, setOrderItems] = useState<SupplyOrderItem[]>([]);
  const [shippingFees, setShippingFees] = useState(0);
  const [shippingFeesNote, setShippingFeesNote] = useState('');
  const [shippingFeesPaymentMethod, setShippingFeesPaymentMethod] = useState<'with_order' | 'wallet'>('with_order');
  const [otherFees, setOtherFees] = useState(0);
  const [otherFeesNote, setOtherFeesNote] = useState('');
  const [expensePaidBy, setExpensePaidBy] = useState('');
  const [distributeExpensesEqually, setDistributeExpensesEqually] = useState(false);
  const [recordExpensesFormally, setRecordExpensesFormally] = useState(false);
  const [taxRate, setTaxRate] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'partner' | 'supply_wallet' | 'treasury'>('cash');
  const [partnerPayments, setPartnerPayments] = useState<{ partnerId: string, amount: number }[]>([]);
  const [treasuryPayments, setTreasuryPayments] = useState<{ treasuryAccountId: string, amount: number }[]>([]);
  const [isSplitTreasury, setIsSplitTreasury] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState(''); 

  // Return Product from Invoice States
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedOrderForReturn, setSelectedOrderForReturn] = useState<SupplyOrder | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<{ [itemKey: string]: number }>({});
  const [returnWarehouseId, setReturnWarehouseId] = useState('');
  const [returnRefundMethod, setReturnRefundMethod] = useState<'credit' | 'treasury' | 'supply_wallet'>('credit');
  const [returnTreasuryAccountId, setReturnTreasuryAccountId] = useState('');
  const [expandedWarehouseId, setExpandedWarehouseId] = useState<string | null>(null);

  // Custom Alarm Dialog Modal
  const [modal, setModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'warning' | 'error' | 'info';
    buttonText: string;
    isConfirm: boolean;
    onConfirm: (() => void) | null;
  }>({
    show: false,
    title: '',
    message: '',
    type: 'info',
    buttonText: 'حسناً',
    isConfirm: false,
    onConfirm: null
  });

  React.useEffect(() => {
    if (settings && (!settings.warehouses || settings.warehouses.length === 0)) {
      const defaultWh = {
        id: 'wh_default',
        name: 'المستودع الرئيسي',
        location: 'المقر الرئيسي',
        isDefault: true
      };
      setSettings(prev => ({
        ...prev,
        warehouses: [defaultWh]
      }));
    }
  }, [settings, setSettings]);

  const showAlert = (title: string, message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
    try { audioSynth.playTone(type); } catch(e) {}
    setModal({
      show: true,
      title,
      message,
      type,
      buttonText: 'حسناً',
      isConfirm: false,
      onConfirm: null
    });
  };

  // State & Filter Variables
  const [inventoryQuery, setInventoryQuery] = useState('');
  const [inventoryStockFilter, setInventoryStockFilter] = useState<'all' | 'out_of_stock' | 'low_stock' | 'in_stock'>('all');
  const [inventoryCollectionFilter, setInventoryCollectionFilter] = useState('');

  // Derived Invoice & Order Calculations
  const itemsSubtotal = orderItems.reduce((sum, item) => {
    const qty = item.quantity || 0;
    const cost = item.cost || 0;
    const discountVal = item.discountValue || 0;
    const discountType = item.discountType || 'amount';
    const discountAmt = discountVal ? (discountType === 'percentage' ? (cost * qty * discountVal / 100) : (discountVal * qty)) : 0;
    const lineTotal = (qty * cost) - discountAmt;
    return sum + (item.isReturn ? -lineTotal : lineTotal);
  }, 0);
  const taxAmount = itemsSubtotal * (taxRate / 100);
  const grandTotal = itemsSubtotal + taxAmount;
  const totalCost = itemsSubtotal + taxAmount + shippingFees + otherFees;

  // Edit Initiator Functions
  const startEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setNewSupplier({
      name: supplier.name,
      phone: supplier.phone || '',
      address: supplier.address || '',
      notes: supplier.notes || ''
    });
  };

  const startEditWarehouse = (warehouse: any) => {
    setEditingWarehouse(warehouse);
    setNewWarehouse({
      name: warehouse.name,
      location: warehouse.location || '',
      isDefault: warehouse.isDefault || false
    });
  };

  // Pricing Synchronizer Helper
  const syncItemPricing = (item: any, field: string, val: any) => {
    let updated = { ...item };
    if (field === 'cost') {
        updated.cost = Number(val) || 0;
    } else if (field === 'profitMode') {
        updated.profitMode = val;
    } else if (field === 'sellingPrice') {
        updated.sellingPrice = Number(val) || 0;
    } else if (field === 'profitPercentage') {
        updated.profitPercentage = Number(val) || 0;
    } else if (field === 'basePrice') {
        updated.basePrice = Number(val) || 0;
    } else if (field === 'commissionPercentage') {
        updated.commissionPercentage = Number(val) || 0;
    }

    // Recompute margins/commissions suggest:
    const mode = updated.profitMode || 'manual';
    const cost = updated.cost || 0;
    if (mode === 'manual') {
        // manual
    } else if (mode === 'margin') {
        const margin = updated.profitPercentage || 0;
        if (margin < 100 && margin >= 0) {
            updated.sellingPrice = Number((cost / (1 - (margin / 100))).toFixed(2));
        } else {
            updated.sellingPrice = cost;
        }
    } else if (mode === 'commission') {
        const comm = updated.commissionPercentage || 0;
        let base = updated.basePrice || 0;
        if (base === 0 && cost > 0 && comm < 100) {
            base = Number((cost / (1 - (comm / 100))).toFixed(2));
            updated.basePrice = base;
        }
    }
    return updated;
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'success' | 'warning' | 'error' | 'info' = 'warning') => {
    try { audioSynth.playTone(type); } catch(e) {}
    setModal({
      show: true,
      title,
      message,
      type,
      buttonText: 'تأكيد',
      isConfirm: true,
      onConfirm
    });
  };

  const handleAddSupplier = () => {
    if (!newSupplier.name) {
        showAlert("تنبيه", "يرجى إدخال اسم المورد", "warning");
        return;
    }

    setSettings(prev => {
        const suppliers = prev.suppliers || [];
        let updatedSuppliers;
        
        if (editingSupplier) {
            updatedSuppliers = suppliers.map(s => s.id === editingSupplier.id ? { ...s, ...newSupplier } : s);
        } else {
            const newId = Date.now().toString();
            updatedSuppliers = [...suppliers, { 
                name: '',
                phone: '',
                address: '',
                notes: '',
                ...newSupplier, 
                id: newId,
                balance: 0
            } as Supplier];
        }

        return { ...prev, suppliers: updatedSuppliers };
    });

    audioSynth.announce(editingSupplier ? "تم تحديث بيانات المورد" : "تم تسجيل المورد الجديد بنجاح", "success");
    setNewSupplier({ name: '', phone: '', address: '', notes: '' });
    setEditingSupplier(null);
  };

  const handleDeleteSupplier = (id: string) => {
      // Check if supplier has any supply orders
      const hasAssociatedOrders = (settings.supplyOrders || [])?.some(order => order.supplierId === id);

      if (hasAssociatedOrders) {
          showAlert(
              "خطأ في الحذف",
              "لا يمكن حذف هذا المورد لأنه مرتبط بفواتير وأوامر توريد مسجلة. يرجى حذف فواتير المورد أولاً إذا كنت ترغب في إزالته.",
              "error"
          );
          return;
      }

      showConfirm("تأكيد الحذف", "هل أنت متأكد من حذف هذا المورد؟ لا يمكن التراجع عن هذا الإجراء.", () => {
          setSettings(prev => ({
              ...prev,
              suppliers: (prev.suppliers || []).filter(s => s.id !== id)
          }));
          audioSynth.announce("تم حذف المورد بنجاح", "success");
      });
  };

  const handleAddWarehouse = () => {
    if (!newWarehouse.name) return;

    setSettings(prev => {
        const warehouses = prev.warehouses || [];
        let updatedWarehouses;
        
        if (editingWarehouse) {
            updatedWarehouses = warehouses.map(w => w.id === editingWarehouse.id ? { ...w, ...newWarehouse } : w);
        } else {
            updatedWarehouses = [...warehouses, { ...newWarehouse, id: Date.now().toString() }];
        }

        // If this is set as default, unset others
        if (newWarehouse.isDefault) {
            const currentId = editingWarehouse?.id || updatedWarehouses[updatedWarehouses.length - 1].id;
            updatedWarehouses = updatedWarehouses.map(w => ({
              ...w,
              isDefault: w.id === currentId
            }));
        }

        return { ...prev, warehouses: updatedWarehouses };
    });

    audioSynth.announce(editingWarehouse ? "تم تحديث بيانات المستودع" : "تم إعداد وإضافة المستودع الجديد بنجاح", "success");
    setNewWarehouse({ name: '', location: '', isDefault: false });
    setEditingWarehouse(null);
  };

  const handleDeleteWarehouse = (id: string) => {
    const warehouseToDelete = (settings.warehouses || []).find(w => w.id === id);
    
    // 1. Check if the warehouse holds any products stock
    const productsWithStock = (settings.products || []).filter(p => {
        const stock = p.warehouseStock?.[id] || 0;
        if (stock > 0) return true;
        const variantStock = (p.variants || []).some(v => (v.warehouseStock?.[id] || 0) > 0);
        return variantStock;
    });

    // 2. Check if any supply orders are assigned to this warehouse
    const supplyOrdersWithWh = (settings.supplyOrders || []).filter(o => o.warehouseId === id);

    if (productsWithStock.length > 0 || supplyOrdersWithWh.length > 0) {
        // Show Force Delete confirmation
        showConfirm(
            "حذف إجباري للمستودع",
            `هذا المستودع مرتبط ومسجل به مخزون لـ (${productsWithStock.length}) منتج ومسجل به (${supplyOrdersWithWh.length}) أمر توريد. هل ترغب في حذفه إجبارياً وتصفير مخزونه تلقائياً في كل هذه المنتجات؟ (ملاحظة: المنتجات نفسها لن تُحذف، سيتم فقط تصفير الكميات الخاصة بهذا المستودع وتعديل إجمالي مخزونها).`,
            () => {
                setSettings(prev => {
                    // Update products stock to clear this warehouse ID
                    const updatedProducts = (prev.products || []).map(p => {
                        let updatedProduct = { ...p };

                        // Clear in main warehouseStock
                        if (updatedProduct.warehouseStock && updatedProduct.warehouseStock[id] !== undefined) {
                            const { [id]: _, ...remainingStock } = updatedProduct.warehouseStock;
                            updatedProduct.warehouseStock = remainingStock;
                            updatedProduct.stockQuantity = Object.values(remainingStock).reduce((sum, val) => sum + (Number(val) || 0), 0);
                        }

                        // Clear in variants warehouseStock
                        if (updatedProduct.variants) {
                            const newVariants = updatedProduct.variants.map(v => {
                                if (v.warehouseStock && v.warehouseStock[id] !== undefined) {
                                    const { [id]: _, ...remainingVariantStock } = v.warehouseStock;
                                    const newQty = Object.values(remainingVariantStock).reduce((sum, val) => sum + (Number(val) || 0), 0);
                                    return {
                                        ...v,
                                        warehouseStock: remainingVariantStock,
                                        stockQuantity: newQty
                                    };
                                }
                                return v;
                            });
                            updatedProduct.variants = newVariants;
                            
                            // Re-calculate stockQuantity of product based on variants if it has variants
                            if (p.hasVariants) {
                                updatedProduct.stockQuantity = newVariants.reduce((sum, v) => sum + (Number(v.stockQuantity) || 0), 0);
                            }
                        }

                        return updatedProduct;
                    });

                    // Remove warehouse
                    let updatedWarehouses = (prev.warehouses || []).filter(w => w.id !== id);

                    // If it was default, set the first remaining one as default
                    if (warehouseToDelete?.isDefault && updatedWarehouses.length > 0) {
                        updatedWarehouses = updatedWarehouses.map((w, idx) => ({
                            ...w,
                            isDefault: idx === 0
                        }));
                    }

                    return {
                        ...prev,
                        products: updatedProducts,
                        warehouses: updatedWarehouses
                    };
                });
                audioSynth.announce("تم الحذف الإجباري للمستودع وتصفير مخزونه بكفاءة", "success");
            }
        );
        return;
    }

    showConfirm("تأكيد حذف المستودع", "هل أنت متأكد من حذف هذا المستودع؟ لن يتم حذف المنتجات ولكن سيتم فقدان معلومات موقعها.", () => {
        setSettings(prev => {
            let updatedWarehouses = (prev.warehouses || []).filter(w => w.id !== id);
            if (warehouseToDelete?.isDefault && updatedWarehouses.length > 0) {
                updatedWarehouses = updatedWarehouses.map((w, idx) => ({
                    ...w,
                    isDefault: idx === 0
                }));
            }
            return {
                ...prev,
                warehouses: updatedWarehouses
            };
        });
        audioSynth.announce("تم إزالة المستودع بنجاح", "success");
    });
  };




  const handleAddOrder = () => {
      if(!selectedSupplierId) {
          showAlert("خطأ", "يرجى اختيار المورد أولاً", "error");
          return;
      }
      if(!selectedWarehouseId) {
          showAlert("خطأ", "يرجى اختيار مستودع الاستلام (تخزين البضاعة) والتعيين للفاتورة أولاً", "error");
          return;
      }
      if(orderItems.length === 0) {
          showAlert("خطأ", "يرجى إضافة صنف واحد على الأقل للفاتورة", "error");
          return;
      }
      if(orderItems.some(i => (i.quantity || 0) <= 0 && (i.bonusQuantity || 0) <= 0)) {
          showAlert("خطأ", "يرجى التأكد من أن جميع الكميات صحيحة وأكبر من الصفر", "error");
          return;
      }
      if(paymentMethod === 'treasury') {
          if (isSplitTreasury) {
              const distributedTotal = treasuryPayments.reduce((s, p) => s + p.amount, 0);
              if (Math.abs(distributedTotal - totalCost) > 0.01) {
                  showAlert("خطأ", 'عذراً، يجب أن يكون مجموع الدفع من العهد/الخزائن مساوياً لإجمالي الفاتورة: ' + totalCost.toLocaleString() + ' ج.م', "error");
                  return;
              }
              if (treasuryPayments.some(p => !p.treasuryAccountId)) {
                  showAlert("خطأ", "يرجى التأكد من اختيار عهد/حسابات الخزينة بشكل صحيح", "error");
                  return;
              }
          } else if (!selectedTreasuryAccountId) {
              showAlert("خطأ", "يرجى اختيار حساب الخزينة المراد الخصم منه", "error");
              return;
          }
      }
      
      const currentOrderId = editingOrder ? (editingOrder as any).id : Date.now().toString();
      
      if (paymentMethod === 'partner') {
          const distributedTotal = partnerPayments.reduce((s, p) => s + p.amount, 0);
          if (Math.abs(distributedTotal - totalCost) > 0.01) {
              showAlert("خطأ", 'عذراً، يجب أن يكون مجموع تمويل الشركاء مساوياً لإجمالي الفاتورة: ' + totalCost.toLocaleString() + ' ج.م', "error");
              return;
          }
          if (partnerPayments.some(p => !p.partnerId)) {
              showAlert("خطأ", "يرجى التأكد من اختيار الشركاء بشكل صحيح", "error");
              return;
          }
      }

      // Validate returns against warehouse stock
      const oldItemsMap = new Map<string, number>();
      if (editingOrder) {
          const currentOldOrder = editingOrder as SupplyOrder;
          for (const oldItem of currentOldOrder.items) {
              if (oldItem.isReturn) {
                  const oldWhId = oldItem.warehouseId || currentOldOrder.warehouseId;
                  const targetQty = (oldItem.receivedQuantity !== undefined ? oldItem.receivedQuantity : (oldItem.quantity || 0)) + (oldItem.bonusQuantity || 0);
                  const key = `${oldWhId}_${oldItem.productId}_${oldItem.variantId || ''}`;
                  oldItemsMap.set(key, (oldItemsMap.get(key) || 0) + targetQty);
              }
          }
      }

      for (const item of orderItems) {
        if (item.isReturn && item.productId) {
          const product = settings.products.find(p => p.id === item.productId);
          if (product) {
            const targetWhId = item.warehouseId || selectedWarehouseId;
            const targetQty = (item.quantity || 0) + (item.bonusQuantity || 0);
            const key = `${targetWhId}_${item.productId}_${item.variantId || ''}`;
            let availableQty = 0;
            if (item.variantId && product.variants) {
               const variant = product.variants.find(v => v.id === item.variantId);
               availableQty = Math.max(0, variant?.warehouseStock?.[targetWhId] || 0);
            } else {
               availableQty = Math.max(0, product.warehouseStock?.[targetWhId] || 0);
            }
            
            const oldReturnQty = oldItemsMap.get(key) || 0;
            const trueAvailable = availableQty + oldReturnQty;

            if (targetQty > trueAvailable) {
                const whName = settings.warehouses?.find((w: any) => w.id === targetWhId)?.name || 'المستودع المحدد';
                showAlert("خطأ", `الكمية المرتجعة للصنف (${product.name}) (${targetQty}) تتجاوز رصيد ${whName} المتاح (${trueAvailable})`, "error");
                return;
            }
          }
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
                      balance: (updatedSuppliers[oldSuppIdx].balance || 0) - (currentOldOrder.grandTotal || currentOldOrder.totalCost)
                  };
              }

              // Revert Treasury if was treasury funded
              if (currentOldOrder.paymentMethod === 'treasury') {
                const oldTreasuryPayments = currentOldOrder.treasuryPayments || (currentOldOrder.treasuryAccountId ? [{ treasuryAccountId: currentOldOrder.treasuryAccountId, amount: (currentOldOrder.grandTotal || currentOldOrder.totalCost) }] : []);
                setTreasury((prev: any) => ({
                    ...prev,
                    accounts: prev.accounts.map((acc: any) => {
                        const pm = oldTreasuryPayments.find(p => p.treasuryAccountId === acc.id);
                        if (pm) {
                            return { ...acc, balance: acc.balance + pm.amount };
                        }
                        return acc;
                    }),
                    transactions: prev.transactions.filter((t: any) => 
                        !t.id.startsWith(`supply_tx_${currentOldOrder.id}`) &&
                        !t.id.startsWith(`expense_tx_${currentOldOrder.id}`)
                    )
                }));
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

              currentOldOrder.items.forEach(oldItem => {
                  const pIdx = updatedProducts.findIndex(p => p.id === oldItem.productId);
                  if (pIdx > -1) {
                      const receivedQty = oldItem.receivedQuantity !== undefined ? oldItem.receivedQuantity : (oldItem.quantity || 0);
                      const totalQty = receivedQty + (oldItem.bonusQuantity || 0);
                      const revertQty = oldItem.isReturn ? totalQty : -totalQty;
                      const oldWhId = oldItem.warehouseId || currentOldOrder.warehouseId;

                      if (oldItem.variantId && updatedProducts[pIdx].variants) {
                          updatedProducts[pIdx].variants = updatedProducts[pIdx].variants!.map(v => {
                              if (v.id === oldItem.variantId) {
                                  let vUpdated = { ...v };
                                  vUpdated.stockQuantity = (vUpdated.stockQuantity || 0) + revertQty;
                                  if (oldWhId) {
                                      vUpdated.warehouseStock = { ...(vUpdated.warehouseStock || {}) };
                                      vUpdated.warehouseStock[oldWhId] = (vUpdated.warehouseStock[oldWhId] || 0) + revertQty;
                                  }
                                  return vUpdated;
                              }
                              return v;
                          });
                          // Resync product stockQuantity from variants
                          updatedProducts[pIdx].stockQuantity = updatedProducts[pIdx].variants!.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
                      } else {
                          updatedProducts[pIdx].stockQuantity = (updatedProducts[pIdx].stockQuantity || 0) + revertQty;
                          if (oldWhId) {
                              updatedProducts[pIdx].warehouseStock = { ...(updatedProducts[pIdx].warehouseStock || {}) };
                              updatedProducts[pIdx].warehouseStock[oldWhId] = (updatedProducts[pIdx].warehouseStock[oldWhId] || 0) + revertQty;
                          }
                      }
                      updatedProducts[pIdx].inStock = (updatedProducts[pIdx].stockQuantity || 0) > 0;
                  }
              });
          }

          // 2. Apply New Impact
          orderItems.forEach(newItem => {
              const productIndex = updatedProducts.findIndex(p => p.id === newItem.productId);
              if (productIndex > -1) {
                  const receivedQty = newItem.receivedQuantity !== undefined ? newItem.receivedQuantity : newItem.quantity;
                  const totalQty = receivedQty + (newItem.bonusQuantity || 0);
                  
                  const itemSubtotal = (newItem.cost * (newItem.quantity || 0)) - (newItem.discountType === 'percentage' ? (newItem.cost * (newItem.quantity || 0) * (newItem.discountValue || 0) / 100) : ((newItem.discountValue || 0) * (newItem.quantity || 0)));
                  
                  let itemLandedCost = 0;
                  if (distributeExpensesEqually) {
                      const orderTotalUnits = orderItems.reduce((acc, curr) => acc + (curr.receivedQuantity !== undefined ? curr.receivedQuantity : curr.quantity) + (curr.bonusQuantity || 0), 0);
                      const totalAdditions = (recordExpensesFormally ? 0 : (shippingFees + otherFees)) + taxAmount;
                      const additionPerUnit = orderTotalUnits > 0 ? (totalAdditions / orderTotalUnits) : 0;
                      itemLandedCost = totalQty > 0 ? ((itemSubtotal / totalQty) + additionPerUnit) : (newItem.cost + additionPerUnit);
                  } else {
                      const baseTotalForFees = itemsSubtotal;
                      const distributionFactor = (recordExpensesFormally ? (itemsSubtotal + taxAmount) : grandTotal) / (baseTotalForFees || 1);
                      itemLandedCost = totalQty > 0 ? (itemSubtotal * distributionFactor / totalQty) : (newItem.cost * distributionFactor);
                  }

                  const currentProd = updatedProducts[productIndex];
                  const shouldUpdatePricing = newItem.updateCatalogPrice !== false && !newItem.isReturn;
                  
                  let costPrice = shouldUpdatePricing ? itemLandedCost : currentProd.costPrice;
                  let price = currentProd.price || 0;
                  const profitMode = shouldUpdatePricing ? (newItem.profitMode || currentProd.profitMode || 'manual') : (currentProd.profitMode || 'manual');
                  
                  if (shouldUpdatePricing) {
                      if (profitMode === 'manual') {
                          if (newItem.sellingPrice !== undefined && newItem.sellingPrice > 0) price = newItem.sellingPrice;
                      } else if (profitMode === 'margin') {
                          if (newItem.sellingPrice !== undefined && newItem.sellingPrice > 0) {
                              price = newItem.sellingPrice;
                          } else {
                              const margin = newItem.profitPercentage ?? currentProd.profitPercentage ?? 0;
                              price = (margin < 100 && margin >= 0) ? costPrice / (1 - (margin / 100)) : costPrice;
                          }
                      } else if (profitMode === 'commission') {
                          const commission = newItem.commissionPercentage ?? currentProd.commissionPercentage ?? 0;
                          let basePrice = newItem.basePrice || currentProd.basePrice || 0;
                          if (basePrice === 0 && costPrice > 0 && commission < 100) basePrice = costPrice / (1 - (commission / 100));
                          if (newItem.sellingPrice !== undefined && newItem.sellingPrice > 0) price = newItem.sellingPrice;
                          else price = basePrice;
                          if (commission >= 0 && commission < 100) costPrice = basePrice * (1 - (commission / 100));
                      }
                  }

                  // Update the actual stock
                  const stockChangeQty = newItem.isReturn ? -totalQty : totalQty;
                  const targetWhId = newItem.warehouseId || selectedWarehouseId;

                  if (newItem.variantId && currentProd.variants) {
                      currentProd.variants = currentProd.variants.map(v => {
                          if (v.id === newItem.variantId) {
                              let vUpdated = { ...v };
                              vUpdated.stockQuantity = (vUpdated.stockQuantity || 0) + stockChangeQty;
                              if (targetWhId) {
                                  vUpdated.warehouseStock = { ...(vUpdated.warehouseStock || {}) };
                                  vUpdated.warehouseStock[targetWhId] = (vUpdated.warehouseStock[targetWhId] || 0) + stockChangeQty;
                              }
                              // Also update variant cost/price if applicable
                              if (shouldUpdatePricing && !newItem.isReturn) {
                                  vUpdated.costPrice = Number(costPrice);
                                  vUpdated.price = Number(price.toFixed(2));
                              }
                              return vUpdated;
                          }
                          return v;
                      });
                      currentProd.stockQuantity = currentProd.variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
                  } else {
                      currentProd.stockQuantity = (currentProd.stockQuantity || 0) + stockChangeQty;
                      if (targetWhId) {
                          currentProd.warehouseStock = { ...(currentProd.warehouseStock || {}) };
                          currentProd.warehouseStock[targetWhId] = (currentProd.warehouseStock[targetWhId] || 0) + stockChangeQty;
                      }
                  }

                  updatedProducts[productIndex] = {
                      ...currentProd,
                      inStock: (currentProd.stockQuantity || 0) > 0,
                      ...(shouldUpdatePricing ? {
                          costPrice: Number(costPrice),
                          price: Number(price.toFixed(2)),
                          profitMode: profitMode,
                          profitPercentage: newItem.profitPercentage !== undefined ? newItem.profitPercentage : currentProd.profitPercentage,
                          basePrice: newItem.basePrice !== undefined ? newItem.basePrice : currentProd.basePrice,
                          commissionPercentage: newItem.commissionPercentage !== undefined ? newItem.commissionPercentage : currentProd.commissionPercentage,
                      } : {})
                  };
              }
          });

          // 3. Update Supplier Balance if Credit
          const orderPayableAmount = totalCost - (shippingFeesPaymentMethod === 'wallet' ? shippingFees : 0);
          const supplierIdx = updatedSuppliers.findIndex(s => s.id === selectedSupplierId);
          if (supplierIdx > -1 && paymentMethod === 'credit') {
              updatedSuppliers[supplierIdx] = {
                  ...updatedSuppliers[supplierIdx],
                  balance: (updatedSuppliers[supplierIdx].balance || 0) + orderPayableAmount
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
                      
                      const partnerShareRatio = orderPayableAmount > 0 ? (pp.amount / orderPayableAmount) : 1;
                      const partnerShippingShare = shippingFeesPaymentMethod === 'with_order' ? Number((shippingFees * partnerShareRatio).toFixed(2)) : 0;
                      const partnerOtherFeesShare = Number((otherFees * partnerShareRatio).toFixed(2));
                      const partnerTaxShare = Number((taxAmount * partnerShareRatio).toFixed(2));
                      const partnerGoodsShare = pp.amount - partnerShippingShare - partnerOtherFeesShare;

                      // Add Shipping Transaction if exists
                      if (partnerShippingShare > 0) {
                          updatedPartnerTransactions.push({
                              id: `supply_pt_${currentOrderId}_ship_${idx}`,
                              partnerId: pp.partnerId,
                              type: 'shipping_funding',
                              amount: partnerShippingShare,
                              date: new Date().toISOString(),
                              note: `شحن بضاعة (أمر توريد من ${supplier?.name}: ${orderReference || currentOrderId})`
                          });
                      }

                      // Add Other Fees Transaction if exists
                      if (partnerOtherFeesShare > 0) {
                          updatedPartnerTransactions.push({
                              id: `supply_pt_${currentOrderId}_other_${idx}`,
                              partnerId: pp.partnerId,
                              type: 'expense_coverage',
                              amount: partnerOtherFeesShare,
                              date: new Date().toISOString(),
                              note: `مصاريف إضافية توريد (أمر: ${orderReference || currentOrderId})`
                          });
                      }

                      // Add Main Goods Funding Transaction
                      if (partnerGoodsShare > 0 || (partnerShippingShare === 0 && partnerOtherFeesShare === 0)) {
                          updatedPartnerTransactions.push({
                              id: `supply_pt_${currentOrderId}_goods_${idx}`,
                              partnerId: pp.partnerId,
                              type: 'supply_funding',
                              amount: partnerGoodsShare > 0 ? partnerGoodsShare : pp.amount,
                              date: new Date().toISOString(),
                              note: `تمويل بضاعة (أمر توريد من ${supplier?.name}: ${orderReference || currentOrderId})`
                          });
                      }
                  }
              });
          }

      // 5. Update Supply Wallet Balance
          if (paymentMethod === 'supply_wallet') {
            // This is handled in setWallet, but here we just ensure the order is tagged correctly
          }

          // 6. Update Treasury Balance
          if (paymentMethod === 'treasury' && setTreasury) {
              const outerSelectedTreasuryAccountId = selectedTreasuryAccountId;
              setTreasury((prev: any) => {
                 const activeTreasuryPayments = isSplitTreasury 
                   ? treasuryPayments 
                   : (outerSelectedTreasuryAccountId ? [{ treasuryAccountId: outerSelectedTreasuryAccountId, amount: orderPayableAmount }] : []);
                 
                 let newTxs = [...prev.transactions];
                  const firstAccountId = activeTreasuryPayments[0]?.treasuryAccountId || '';
                   const baseAmount = orderPayableAmount;
                  const selectedTreasuryAccountId = firstAccountId || outerSelectedTreasuryAccountId;
                 let updatedAccounts = [...prev.accounts];
                  activeTreasuryPayments.forEach((p) => {
                      prev.accounts = updatedAccounts = updatedAccounts.map((acc: any) => 
                          acc.id === p.treasuryAccountId 
                          ? { ...acc, balance: acc.balance - p.amount } 
                          : acc
                      );
                  });
                 if (recordExpensesFormally) {
                     if (shippingFees > 0) {
                         newTxs.unshift({
                             id: `expense_tx_${currentOrderId}_shipping`,
                             date: new Date().toISOString(),
                             type: 'expense',
                             amount: shippingFees,
                             category: 'expense_shipping_fees',
                             fromAccountId: selectedTreasuryAccountId,
                             description: `مصاريف شحن فاتورة مشتريات (أمر: ${orderReference || currentOrderId})`
                         });
                         
                         // Add to Wallet for Expenses Page
                         if (setWallet) {
                            setWallet((prevW: any) => ({
                                ...prevW,
                                transactions: [{
                                    id: `wallet_exp_${currentOrderId}_shipping`,
                                    date: new Date().toISOString(),
                                    type: 'سحب',
                                    amount: shippingFees,
                                    category: 'expense_shipping_fees',
                                    note: `شحن فاتورة مشتريات: ${orderReference || currentOrderId}`,
                                    status: 'completed'
                                }, ...prevW.transactions]
                            }));
                         }
                     }
                     if (otherFees > 0) {
                         newTxs.unshift({
                             id: `expense_tx_${currentOrderId}_other`,
                             date: new Date().toISOString(),
                             type: 'expense',
                             amount: otherFees,
                             category: 'expense_other',
                             fromAccountId: selectedTreasuryAccountId,
                             description: `مصاريف إضافية لفاتورة مشتريات (أمر: ${orderReference || currentOrderId})`
                         });

                         // Add to Wallet for Expenses Page
                         if (setWallet) {
                            setWallet((prevW: any) => ({
                                ...prevW,
                                transactions: [{
                                    id: `wallet_exp_${currentOrderId}_other`,
                                    date: new Date().toISOString(),
                                    type: 'سحب',
                                    amount: otherFees,
                                    category: 'expense_other',
                                    note: `مصاريف إضافية شحنة: ${orderReference || currentOrderId}`,
                                    status: 'completed'
                                }, ...prevW.transactions]
                            }));
                         }
                     }
                 }
                 newTxs.unshift({
                     id: `supply_tx_${currentOrderId}`,
                     date: new Date().toISOString(),
                     type: 'withdrawal',
                     amount: baseAmount,
                     fromAccountId: selectedTreasuryAccountId,
                     description: `شراء بضاعة من المورد ${supplier?.name} (أمر: ${orderReference || currentOrderId})`
                 });
                 
                 return {
                     ...prev,
                     accounts: updatedAccounts,
                     transactions: newTxs
                 };
             });
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
                  totalCost: totalCost,
                  grandTotal: totalCost,
                  taxRate,
                  taxAmount,
                  shippingFees,
                  shippingFeesNote,
                  shippingFeesPaymentMethod,
                  otherFees,
                  otherFeesNote,
                  expensePaidBy,
                  paymentMethod,
                  treasuryAccountId: paymentMethod === 'treasury' ? selectedTreasuryAccountId : undefined,
                  treasuryPayments: paymentMethod === 'treasury' && isSplitTreasury ? treasuryPayments : undefined,
                  warehouseId: selectedWarehouseId,
                  recordExpensesFormally,
                  distributeExpensesEqually
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
                  totalCost: totalCost,
                  grandTotal: totalCost,
                  taxRate,
                  taxAmount,
                  shippingFees,
                  shippingFeesNote,
                  shippingFeesPaymentMethod,
                  otherFees,
                  otherFeesNote,
                  expensePaidBy,
                  status: 'completed',
                  paymentMethod,
                  treasuryAccountId: paymentMethod === 'treasury' ? selectedTreasuryAccountId : undefined,
                  treasuryPayments: paymentMethod === 'treasury' && isSplitTreasury ? treasuryPayments : undefined,
                  warehouseId: selectedWarehouseId,
                  recordExpensesFormally,
                  distributeExpensesEqually
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
                      newSupplyBalance += (currentOld.grandTotal || currentOld.totalCost);
                  } else if (currentOld.paymentMethod === 'cash') {
                      newBalance += (currentOld.grandTotal || currentOld.totalCost);
                  }
                  // FIX: Removed partner from revert logic because partner funding + purchase net change to supplyBalance was 0.
                  // Any manual subtraction here was causing double-deduction on edits.
              }

              // 2. Prepare new transactions
              const newWalletTransactions: Transaction[] = [];
              const now = new Date();
              const orderPayableAmount = totalCost - (shippingFeesPaymentMethod === 'wallet' ? shippingFees : 0);
              const baseAmount = recordExpensesFormally ? (orderPayableAmount - otherFees) : orderPayableAmount;

              const pushFormalExpenses = (date: Date) => {
                  const isCapitalPayment = paymentMethod === 'supply_wallet' || paymentMethod === 'partner';
                  
                  // Always record shipping fees separately if paid from wallet, 
                  // or if recorded formally
                  if (shippingFees > 0 && (recordExpensesFormally || shippingFeesPaymentMethod === 'wallet')) {
                      const shippingNote = shippingFeesNote ? ` (${shippingFeesNote})` : '';
                      const payerNote = expensePaidBy ? ` - دفع بواسطة: ${expensePaidBy}` : '';
                      newWalletTransactions.push({
                          id: `supply_expense_shipping_${currentOrderId}`,
                          type: 'سحب',
                          amount: shippingFees,
                          date: new Date(date.getTime() + 2).toISOString(),
                          note: `مصاريف شحن${shippingNote} (فاتورة مورد: ${supplier?.name}) (أمر: ${orderReference || currentOrderId})${payerNote}`,
                          category: (isCapitalPayment && shippingFeesPaymentMethod === 'with_order') ? 'supply_expense_shipping' : 'expense_shipping_fees',
                          status: 'completed',
                          details: {
                            expensePaidBy,
                            note: shippingFeesNote,
                            supplierId: supplier?.id,
                            orderId: currentOrderId
                          }
                      } as Transaction);
                      
                      // Deduct from appropriate wallet balance if paid via wallet
                      if (shippingFeesPaymentMethod === 'wallet') {
                          newBalance -= shippingFees;
                      }
                  }
                  
                  if (recordExpensesFormally) {
                      if (otherFees > 0) {
                          const otherNote = otherFeesNote ? ` (${otherFeesNote})` : '';
                          const payerNote = expensePaidBy ? ` - دفع بواسطة: ${expensePaidBy}` : '';
                          newWalletTransactions.push({
                              id: `supply_expense_other_${currentOrderId}`,
                              type: 'سحب',
                              amount: otherFees,
                              date: new Date(date.getTime() + 3).toISOString(),
                              note: `مصاريف إضافية${otherNote} (فاتورة مورد: ${supplier?.name}) (أمر: ${orderReference || currentOrderId})${payerNote}`,
                              category: isCapitalPayment ? 'supply_expense_other' : 'expense_other',
                              status: 'completed',
                              details: {
                                expensePaidBy,
                                note: otherFeesNote,
                                supplierId: supplier?.id,
                                orderId: currentOrderId
                              }
                          } as Transaction);
                      }
                  }
              };

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
                      amount: baseAmount,
                      date: purchaseDate.toISOString(),
                      note: `شراء بضاعة (بتمويل الشركاء) من المورد ${supplier?.name} (أمر: ${orderReference || currentOrderId})`,
                      category: 'supply_purchase',
                      status: 'completed'
                  } as Transaction);
                  pushFormalExpenses(purchaseDate);
                  
                  // Payment comes out of the supply wallet
                  newSupplyBalance -= orderPayableAmount;
              } else if (paymentMethod === 'cash') {
                  newBalance -= orderPayableAmount;
                  newWalletTransactions.push({
                      id: `supply_purchase_${currentOrderId}`,
                      type: 'سحب',
                      amount: baseAmount,
                      date: now.toISOString(),
                      note: `شراء بضاعة (كاش) من المورد ${supplier?.name} (أمر: ${orderReference || currentOrderId})`,
                      category: 'inventory_purchase',
                      status: 'completed'
                  } as Transaction);
                  pushFormalExpenses(now);
              } else if (paymentMethod === 'supply_wallet') {
                  newSupplyBalance -= orderPayableAmount;
                  newWalletTransactions.push({
                      id: `supply_purchase_${currentOrderId}`,
                      type: 'سحب',
                      amount: baseAmount,
                      date: now.toISOString(),
                      note: `شراء بضاعة من محفظة التوريد (المورد: ${supplier?.name})`,
                      category: 'supply_purchase',
                      status: 'completed'
                  } as Transaction);
                  pushFormalExpenses(now);
              }

              const filteredTransactions = prev.transactions.filter((t: any) => 
                !t.id.startsWith(`supply_${currentOrderId}`) && 
                !t.id.startsWith(`supply_purchase_with_${currentOrderId}`) &&
                !t.id.startsWith(`supply_expense_shipping_${currentOrderId}`) &&
                !t.id.startsWith(`supply_expense_other_${currentOrderId}`) &&
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
                transactions: prev.transactions.filter((t: any) => 
                    !t.id.startsWith(`supply_${editingOrder.id}`) &&
                    !t.id.startsWith(`supply_purchase_with_${editingOrder.id}`) &&
                    !t.id.startsWith(`supply_expense_shipping_${editingOrder.id}`) &&
                    !t.id.startsWith(`supply_expense_other_${editingOrder.id}`) &&
                    !t.id.startsWith(`supply_funding_dep_${editingOrder.id}`)
                )
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
      setShippingFees(0);
      setShippingFeesNote('');
      setShippingFeesPaymentMethod('with_order');
      setOtherFees(0);
      setOtherFeesNote('');
      setExpensePaidBy('');
      setDistributeExpensesEqually(false);
      setRecordExpensesFormally(false);
      setTaxRate(0);
      setSelectedTreasuryAccountId('');
      setSelectedWarehouseId('');
  };

  const startEditOrder = (order: SupplyOrder) => {
      setEditingOrder(order);
      setSelectedSupplierId(order.supplierId);
      const initialPartnerPayments = order.partnerPayments || (order.partnerId ? [{ partnerId: order.partnerId, amount: order.totalCost || order.grandTotal || 0 }] : []);
      setPartnerPayments(initialPartnerPayments);
      setSelectedPartnerId(order.partnerId || '');
      setOrderReference(order.referenceNumber || '');
      setOrderNotes(order.notes || '');
      setShippingFees(order.shippingFees || 0);
      setShippingFeesNote(order.shippingFeesNote || '');
      setShippingFeesPaymentMethod(order.shippingFeesPaymentMethod || 'with_order');
      setOtherFees(order.otherFees || 0);
      setOtherFeesNote(order.otherFeesNote || '');
      setExpensePaidBy(order.expensePaidBy || '');
      setDistributeExpensesEqually(order.distributeExpensesEqually || false);
      setRecordExpensesFormally(order.recordExpensesFormally || false);
      setTaxRate(order.taxRate || 0);
      
      const itemsHydrated = (order.items || []).map(item => {
          const product = settings.products.find(p => p.id === item.productId);
          return {
              ...item,
              profitMode: item.profitMode || product?.profitMode || 'manual',
              profitPercentage: item.profitPercentage ?? product?.profitPercentage ?? 0,
              basePrice: item.basePrice ?? product?.basePrice ?? 0,
              commissionPercentage: item.commissionPercentage ?? product?.commissionPercentage ?? 0,
              sellingPrice: item.sellingPrice ?? product?.price ?? 0
          };
      });
      setOrderItems(itemsHydrated);
      setPaymentMethod(order.paymentMethod as any || 'cash');
      setSelectedTreasuryAccountId(order.treasuryAccountId || '');
      setTreasuryPayments(order.treasuryPayments || []);
      setIsSplitTreasury(order.treasuryPayments ? order.treasuryPayments.length > 0 : false);
      
      const defaultWhId = settings.warehouses?.find(w => w.isDefault)?.id || settings.warehouses?.[0]?.id || '';
      setSelectedWarehouseId(order.warehouseId || defaultWhId);
      setShowOrderModal(true);
  };

  const handleDeleteOrder = (order: SupplyOrder) => {
      // Check if any product in this supply order was sold in customer orders
      // We block deletion if any product from this order is present in customer orders
      const productIdsInOrder = order.items.map(item => item.productId);
      const isLinkedToSales = orders.some(o => 
        o.items?.some((item: any) => productIdsInOrder.includes(item.productId))
      );

      if (isLinkedToSales) {
          showAlert(
              "حذف غير مسموح",
              "لا يمكن حذف فاتورة الشراء هذه لأنها مرتبطة بعمليات بيع لعملاء. يرجى مراجعة حركة المخزن أولاً.",
              "error"
          );
          return;
      }

      showConfirm("تأكيد حذف الفاتورة", `هل أنت متأكد من حذف فاتورة الشراء رقم ${order.orderNumber || order.id}؟ سيتم خصم الكميات من المخزن وإلغاء المعاملات المالية المرتبطة بها.`, () => {
          setSettings(prev => {
          let updatedSuppliers = [...prev.suppliers];
          let updatedPartners = [...(prev.partners || [])];
          let updatedPartnerTransactions = [...(prev.partnerTransactions || [])];

          if (order.paymentMethod === 'credit') {
              const suppIdx = updatedSuppliers.findIndex(s => s.id === order.supplierId);
              if (suppIdx > -1) {
                  updatedSuppliers[suppIdx] = {
                      ...updatedSuppliers[suppIdx],
                      balance: (updatedSuppliers[suppIdx].balance || 0) - (order.grandTotal || order.totalCost)
                  };
              }
          }

          if (order.paymentMethod === 'partner') {
              const oldPayments = order.partnerPayments || (order.partnerId ? [{ partnerId: order.partnerId, amount: order.grandTotal || order.totalCost }] : []);
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
              updatedPartnerTransactions = updatedPartnerTransactions.filter(pt => !pt.id.startsWith(`supply_pt_${order.id}`));
          }

          return {
            ...prev,
            suppliers: updatedSuppliers,
            partners: updatedPartners,
            partnerTransactions: updatedPartnerTransactions,
            products: prev.products.map(p => {
                const item = order.items.find(i => i.productId === p.id);
                if (item) {
                    const receivedQty = item.receivedQuantity !== undefined ? item.receivedQuantity : (item.quantity || 0);
                    const totalQty = receivedQty + (item.bonusQuantity || 0);
                    const oldWhId = order.warehouseId;
                    
                    let updatedVariants = p.variants;
                    let newQty = p.stockQuantity || 0;
                    let updatedWhStock = p.warehouseStock ? { ...p.warehouseStock } : undefined;

                    if (item.variantId && p.variants) {
                        updatedVariants = p.variants.map(v => {
                            if (v.id === item.variantId) {
                                let vUpdated = { ...v };
                                vUpdated.stockQuantity = (vUpdated.stockQuantity || 0) - totalQty;
                                if (oldWhId) {
                                    vUpdated.warehouseStock = { ...(vUpdated.warehouseStock || {}) };
                                    vUpdated.warehouseStock[oldWhId] = (vUpdated.warehouseStock[oldWhId] || 0) - totalQty;
                                }
                                return vUpdated;
                            }
                            return v;
                        });
                        newQty = updatedVariants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
                    } else {
                        newQty = (p.stockQuantity || 0) - totalQty;
                        if (oldWhId) {
                            updatedWhStock = { ...(updatedWhStock || {}) };
                            updatedWhStock[oldWhId] = (updatedWhStock[oldWhId] || 0) - totalQty;
                        }
                    }

                    return { 
                        ...p, 
                        stockQuantity: newQty, 
                        inStock: newQty > 0, 
                        warehouseStock: updatedWhStock,
                        variants: updatedVariants
                    };
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
              const orderTotal = order.grandTotal || order.totalCost;

              if (order.paymentMethod === 'cash') {
                  newBalance += orderTotal;
              } else if (order.paymentMethod === 'supply_wallet') {
                  newSupplyBalance += orderTotal;
              }

              const filteredTransactions = prev.transactions.filter((t: any) => 
                 !t.id.startsWith(`supply_${order.id}`) && 
                 !t.id.startsWith(`supply_purchase_${order.id}`) && 
                 !t.id.startsWith(`supply_purchase_with_${order.id}`) && 
                 !t.id.startsWith(`supply_expense_shipping_${order.id}`) && 
                 !t.id.startsWith(`supply_expense_other_${order.id}`) && 
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

      if (order.paymentMethod === 'treasury' && order.treasuryAccountId) {
        setTreasury((prev: any) => ({
          ...prev,
          accounts: prev.accounts.map((acc: any) => 
            acc.id === order.treasuryAccountId 
            ? { ...acc, balance: acc.balance + (order.grandTotal || order.totalCost) }
            : acc
          ),
          transactions: prev.transactions.filter((t: any) => 
            !t.id.startsWith(`supply_tx_${order.id}`) &&
            !t.id.startsWith(`expense_tx_${order.id}`)
          )
        }));
      }
    });
  };

  const startReturnFromOrder = (order: SupplyOrder) => {
    setSelectedOrderForReturn(order);
    
    // Default return warehouse is the one used in the order
    setReturnWarehouseId(order.warehouseId || '');
    
    // Default refund method based on payment method of order
    if (order.paymentMethod === 'credit') {
      setReturnRefundMethod('credit');
    } else if (order.paymentMethod === 'treasury') {
      setReturnRefundMethod('treasury');
      setReturnTreasuryAccountId(order.treasuryAccountId || '');
    } else if (order.paymentMethod === 'supply_wallet') {
      setReturnRefundMethod('supply_wallet');
    } else {
      setReturnRefundMethod('treasury'); 
      const defaultAcc = treasury?.accounts?.[0]?.id || '';
      setReturnTreasuryAccountId(defaultAcc);
    }
    
    // Initialize return quantities to 0
    const initialQtys: { [key: string]: number } = {};
    order.items.forEach(item => {
      initialQtys[`${item.productId}_${item.variantId || ''}`] = 0;
    });
    setReturnQuantities(initialQtys);
    
    setShowReturnModal(true);
  };

  const handleConfirmReturn = () => {
    if (!selectedOrderForReturn) return;
    
    // 1. Validate return quantities
    const itemsToReturn = selectedOrderForReturn.items.map(item => {
      const key = `${item.productId}_${item.variantId || ''}`;
      const qtyToReturn = returnQuantities[key] || 0;
      return { ...item, qtyToReturn };
    }).filter(item => item.qtyToReturn > 0);

    if (itemsToReturn.length === 0) {
      showAlert("تنبيه", "يرجى تحديد كمية مرتجع لمنتج واحد على الأقل.", "warning");
      return;
    }

    // Check if they exceed purchased quantity minus any already returned quantity
    for (const item of itemsToReturn) {
      const alreadyReturned = item.returnedQuantity || 0;
      const maxAllowed = (item.quantity + (item.bonusQuantity || 0)) - alreadyReturned;
      if (item.qtyToReturn > maxAllowed) {
        showAlert("تنبيه", `الكمية المدخلة لإرجاع المنتج [${item.name}] تتجاوز الكمية المتاحة المتبقية للإرجاع (${maxAllowed} قطعة).`, "warning");
        return;
      }
    }

    if (returnRefundMethod === 'treasury' && !returnTreasuryAccountId) {
      showAlert("تنبيه", "يرجى تحديد الحساب النقدي لاستلام المرتجع.", "warning");
      return;
    }

    const supplier = settings.suppliers.find(s => s.id === selectedOrderForReturn.supplierId);
    const totalReturnCost = itemsToReturn.reduce((sum, item) => {
      const discountAmt = item.discountValue ? (item.discountType === 'percentage' ? (item.cost * item.discountValue / 100) : item.discountValue) : 0;
      const netCost = item.cost - discountAmt;
      return sum + (item.qtyToReturn * netCost);
    }, 0);

    // 2. Perform the return
    setSettings(prev => {
      let updatedProducts = [...prev.products];
      let updatedSuppliers = [...(prev.suppliers || [])];
      let updatedOrders = [...(prev.supplyOrders || [])];
      let updatedReturns = [...(prev.purchaseReturns || [])];

      // Create PurchaseReturnItem array
      const returnItems: PurchaseReturnItem[] = itemsToReturn.map(item => {
        const discountAmt = item.discountValue ? (item.discountType === 'percentage' ? (item.cost * item.discountValue / 100) : item.discountValue) : 0;
        const netCost = item.cost - discountAmt;
        return {
          productId: item.productId,
          variantId: item.variantId,
          name: item.name || '',
          sku: item.sku || '',
          quantity: item.qtyToReturn,
          costPrice: netCost
        };
      });

      const returnId = `PRT-${Date.now()}`;
      const returnNumber = `PR-${String(updatedReturns.length + 1).padStart(5, '0')}`;

      const returnData: PurchaseReturn = {
        id: returnId,
        returnNumber,
        supplierId: selectedOrderForReturn.supplierId,
        supplierName: supplier?.name || 'مورد عام',
        date: new Date().toISOString(),
        items: returnItems,
        totalRefundAmount: totalReturnCost,
        warehouseId: returnWarehouseId || selectedOrderForReturn.warehouseId || '',
        status: 'completed',
        notes: `مرتجع من الفاتورة رقم ${selectedOrderForReturn.referenceNumber || selectedOrderForReturn.id}`,
        performedBy: currentUser?.fullName || currentUser?.email || 'System'
      };

      // Deduct stock from warehouse/product
      returnItems.forEach(item => {
        const pIdx = updatedProducts.findIndex(p => p.id === item.productId);
        if (pIdx > -1) {
          let prod = { ...updatedProducts[pIdx] };
          const warehouseIdToUse = returnWarehouseId || selectedOrderForReturn.warehouseId || '';

          if (item.variantId && prod.variants) {
            prod.variants = prod.variants.map(v => {
              if (v.id === item.variantId) {
                const vUpdated = { ...v };
                vUpdated.stockQuantity = Math.max(0, (vUpdated.stockQuantity || 0) - item.quantity);
                vUpdated.warehouseStock = { ...(vUpdated.warehouseStock || {}) };
                vUpdated.warehouseStock[warehouseIdToUse] = Math.max(0, (vUpdated.warehouseStock[warehouseIdToUse] || 0) - item.quantity);
                return vUpdated;
              }
              return v;
            });
            // Recalculate total product stock from variants
            prod.stockQuantity = prod.variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
          } else {
            prod.stockQuantity = Math.max(0, (prod.stockQuantity || 0) - item.quantity);
            if (warehouseIdToUse) {
              prod.warehouseStock = { ...(prod.warehouseStock || {}) };
              prod.warehouseStock[warehouseIdToUse] = Math.max(0, (prod.warehouseStock[warehouseIdToUse] || 0) - item.quantity);
            }
          }
          prod.inStock = (prod.stockQuantity || 0) > 0;
          updatedProducts[pIdx] = prod;
        }
      });

      // Update SupplyOrder's items `returnedQuantity`
      updatedOrders = updatedOrders.map(o => {
        if (o.id === selectedOrderForReturn.id) {
          return {
            ...o,
            items: o.items.map(item => {
              const key = `${item.productId}_${item.variantId || ''}`;
              const toReturn = returnQuantities[key] || 0;
              if (toReturn > 0) {
                return {
                  ...item,
                  returnedQuantity: (item.returnedQuantity || 0) + toReturn
                };
              }
              return item;
            })
          };
        }
        return o;
      });

      // Update Supplier Debt if using 'credit'
      if (returnRefundMethod === 'credit') {
        const sIdx = updatedSuppliers.findIndex(s => s.id === selectedOrderForReturn.supplierId);
        if (sIdx > -1) {
          updatedSuppliers[sIdx] = {
            ...updatedSuppliers[sIdx],
            balance: Math.max(0, (updatedSuppliers[sIdx].balance || 0) - totalReturnCost)
          };
        }
      }

      // Prepare Activity Log
      const newLog = {
        id: `log-${Date.now()}`,
        user: currentUser?.fullName || 'النظام',
        action: 'مرتجع مشتريات من فاتورة',
        details: `إرجاع منتجات بقيمة ${totalReturnCost} ج.م للمورد ${supplier?.name || ''} من الفاتورة ${selectedOrderForReturn.referenceNumber || selectedOrderForReturn.id}`,
        date: new Date().toLocaleString('ar-EG'),
        timestamp: Date.now()
      };

      return {
        ...prev,
        products: updatedProducts,
        suppliers: updatedSuppliers,
        supplyOrders: updatedOrders,
        purchaseReturns: [returnData, ...updatedReturns],
        activityLogs: [newLog, ...(prev.activityLogs || [])]
      };
    });

    // Handle Cash or Supply Wallet refunds
    if (returnRefundMethod === 'treasury' && setTreasury) {
      setTreasury((prev: any) => {
        const updatedAccounts = prev.accounts.map((acc: any) => {
          if (acc.id === returnTreasuryAccountId) {
            return { ...acc, balance: acc.balance + totalReturnCost };
          }
          return acc;
        });

        const newTx = {
          id: `return_refund_tx_${Date.now()}`,
          date: new Date().toISOString(),
          type: 'deposit' as const,
          amount: totalReturnCost,
          toAccountId: returnTreasuryAccountId,
          description: `استلام دفعة مرتجع سلع من المورد ${supplier?.name} للفاتورة: ${selectedOrderForReturn.referenceNumber || selectedOrderForReturn.id}`
        };

        return {
          ...prev,
          accounts: updatedAccounts,
          transactions: [newTx, ...prev.transactions]
        };
      });
    }

    if (returnRefundMethod === 'supply_wallet') {
      setWallet((prev: any) => {
        const currentSupplyBalance = prev.supplyBalance || 0;
        const newTx = {
          id: `wallet_return_${Date.now()}`,
          date: new Date().toISOString(),
          type: 'إيداع' as const,
          amount: totalReturnCost,
          category: 'supply_deposit' as const,
          note: `استرداد مرتجع مشتريات: ${selectedOrderForReturn.referenceNumber || selectedOrderForReturn.id}`,
          status: 'completed' as const
        };

        return {
          ...prev,
          supplyBalance: currentSupplyBalance + totalReturnCost,
          transactions: [newTx, ...prev.transactions]
        };
      });
    }

    audioSynth.announce("تم إتمام المرتجع وتحديث الحسابات بنجاح", "success");
    setShowReturnModal(false);
    setSelectedOrderForReturn(null);
    showAlert("نجاح الإرجاع", `تم بنجاح إرجاع السلع للمورد وتحديث المخزون والمالية بقيمة ${totalReturnCost} ج.م`, "success");
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
        orderedQuantity: 1,
        receivedQuantity: 1,
        damagedQuantity: 0,
        bonusQuantity: 0,
        cost: firstProduct.costPrice,
        discountValue: 0,
        discountType: 'amount',
        profitMode: firstProduct.profitMode || 'manual',
        profitPercentage: firstProduct.profitPercentage || 0,
        basePrice: firstProduct.basePrice || 0,
        commissionPercentage: firstProduct.commissionPercentage || 0,
        sellingPrice: firstProduct.price || 0
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
    let totalCostValue = 0;
    (settings.products || []).forEach(p => {
      if (p.hasVariants && p.variants && p.variants.length > 0) {
        p.variants.forEach(v => {
          const qty = v.stockQuantity ?? v.stock ?? 0;
          const cost = getLatestProductCost(v.id, settings) || getLatestProductCost(p.id, settings) || (v.costPrice ?? p.costPrice ?? 0);
          totalCostValue += qty * cost;
        });
      } else {
        const qty = p.stockQuantity ?? p.stock ?? 0;
        const cost = getLatestProductCost(p.id, settings) || (p.costPrice || 0);
        totalCostValue += qty * cost;
      }
    });
    return totalCostValue;
  }, [settings.products, settings.supplyOrders]);

  const totalSuppliersCount = React.useMemo(() => {
    return (settings.suppliers || []).length;
  }, [settings.suppliers]);

  const totalOrdersCount = React.useMemo(() => {
    return (settings.supplyOrders || []).length;
  }, [settings.supplyOrders]);

  // 1. Flatten products and nested variants into standard Inventory Item rows
  const allInventoryItems = React.useMemo(() => {
    const items: Array<{
      key: string;
      productId: string;
      variantId?: string;
      name: string;
      sku: string;
      stock: number;
      cost: number;
      price: number;
      collectionId?: string;
      thumbnail?: string;
      threshold: number;
    }> = [];

    (settings.products || []).forEach(p => {
      const threshold = p.stockThreshold || 5;
      if (p.hasVariants && p.variants && p.variants.length > 0) {
        p.variants.forEach(v => {
          const variantDesc = Object.entries(v.options || {})
            .map(([k, val]) => `${k}: ${val}`)
            .join(' | ');
          const name = `${p.name} (${variantDesc})`;
          const cost = getLatestProductCost(v.id, settings) || getLatestProductCost(p.id, settings) || (v.costPrice ?? p.costPrice ?? 0);
          const price = v.price ?? p.price ?? 0;

          items.push({
            key: `${p.id}_${v.id}`,
            productId: p.id,
            variantId: v.id,
            name,
            sku: v.sku || p.sku || '',
            stock: v.stockQuantity ?? 0,
            cost,
            price,
            collectionId: p.collectionId,
            thumbnail: p.thumbnail || (p.images && p.images[0]),
            threshold
          });
        });
      } else {
        const cost = getLatestProductCost(p.id, settings) || p.costPrice || 0;
        const price = p.price || 0;

        items.push({
          key: p.id,
          productId: p.id,
          name: p.name,
          sku: p.sku || '',
          stock: p.stockQuantity ?? p.stock ?? 0,
          cost,
          price,
          collectionId: p.collectionId,
          thumbnail: p.thumbnail || (p.images && p.images[0]),
          threshold
        });
      }
    });

    return items;
  }, [settings.products, settings.supplyOrders]);

  // 2. Filter flattened Inventory listings based on current search and multi-filters
  const filteredInventoryItems = React.useMemo(() => {
    return allInventoryItems.filter(item => {
      // Name or SKU search matches
      const matchesSearch = item.name.toLowerCase().includes(inventoryQuery.toLowerCase()) || 
                            item.sku.toLowerCase().includes(inventoryQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Group collections filter
      if (inventoryCollectionFilter !== 'all' && item.collectionId !== inventoryCollectionFilter) {
        return false;
      }

      // Stock level status filter check
      if (inventoryStockFilter === 'out_of_stock') {
        return item.stock <= 0;
      } else if (inventoryStockFilter === 'low_stock') {
        return item.stock > 0 && item.stock <= item.threshold;
      } else if (inventoryStockFilter === 'in_stock') {
        return item.stock > item.threshold;
      }

      return true;
    });
  }, [allInventoryItems, inventoryQuery, inventoryStockFilter, inventoryCollectionFilter]);

  // 3. Compute dynamic live stats for the central inventory dashboard
  const inventoryStats = React.useMemo(() => {
    let totalUniqueItems = allInventoryItems.length;
    let totalStockPieces = 0;
    let totalCapitalAtCost = 0;
    let totalRetailWorth = 0;
    let lowStockCount = 0;

    allInventoryItems.forEach(item => {
      totalStockPieces += item.stock;
      totalCapitalAtCost += item.stock * item.cost;
      totalRetailWorth += item.stock * item.price;
      if (item.stock > 0 && item.stock <= item.threshold) {
        lowStockCount++;
      }
    });

    const potentialProfit = Math.max(0, totalRetailWorth - totalCapitalAtCost);
    const profitMarginPercentage = totalCapitalAtCost > 0 ? (potentialProfit / totalCapitalAtCost) * 100 : 0;

    return {
      totalUniqueItems,
      totalStockPieces,
      totalCapitalAtCost,
      totalRetailWorth,
      potentialProfit,
      profitMarginPercentage,
      lowStockCount
    };
  }, [allInventoryItems]);

  // 4. Calculate comprehensive Supplier scorecard summaries for analytics page
  const supplierPerformanceStats = React.useMemo(() => {
    const suppliers = settings.suppliers || [];
    const orders = settings.supplyOrders || [];

    return suppliers.map(s => {
      const suppOrders = orders.filter(o => o.supplierId === s.id && o.status !== 'cancelled');
      const totalCostAmount = suppOrders.reduce((sum, o) => sum + o.totalCost, 0);
      const totalPiecesSupplied = suppOrders.reduce((units, o) => {
        return units + o.items.reduce((acc, item) => acc + item.quantity + (item.bonusQuantity || 0), 0);
      }, 0);
      const avgInvoiceValue = suppOrders.length > 0 ? totalCostAmount / suppOrders.length : 0;

      // Find the date of latest order
      let latestDate = '';
      if (suppOrders.length > 0) {
        const sorted = [...suppOrders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        latestDate = sorted[0].date;
      }

      return {
        id: s.id,
        name: s.name,
        phone: s.phone,
        balance: s.balance || 0,
        ordersCount: suppOrders.length,
        totalCostAmount,
        totalPiecesSupplied,
        avgInvoiceValue,
        latestDate
      };
    }).sort((a, b) => b.totalCostAmount - a.totalCostAmount);
  }, [settings.suppliers, settings.supplyOrders]);

  // 5. Payment breakdown methods stats
  const paymentMethodsStats = React.useMemo(() => {
    const orders = settings.supplyOrders || [];
    let cash = 0;
    let credit = 0;
    let partner = 0;
    let supply_wallet = 0;

    orders.forEach(o => {
      if (o.status === 'cancelled') return;
      if (o.paymentMethod === 'credit') credit += o.totalCost;
      else if (o.paymentMethod === 'partner') partner += o.totalCost;
      else if (o.paymentMethod === 'supply_wallet') supply_wallet += o.totalCost;
      else cash += o.totalCost;
    });

    return [
      { name: 'نقدي (كاش)', value: cash, color: '#10b981' },
      { name: 'آجل مديونية', value: credit, color: '#f43f5e' },
      { name: 'تمويل شركاء', value: partner, color: '#f59e0b' },
      { name: 'محفظة توريد', value: supply_wallet, color: '#6366f1' }
    ].filter(i => i.value > 0);
  }, [settings.supplyOrders]);

  // 6. Top supplied products by supply frequency & quantities
  const topSuppliedProductsSummary = React.useMemo(() => {
    const orders = settings.supplyOrders || [];
    const productQuantities: Record<string, { name: string, qty: number, spent: number }> = {};

    orders.forEach(o => {
      if (o.status === 'cancelled') return;
      o.items.forEach(item => {
        const pId = item.productId;
        const totalQty = item.quantity + (item.bonusQuantity || 0);
        const costAmount = item.cost * item.quantity;

        if (!productQuantities[pId]) {
          const prod = settings.products.find(p => p.id === pId);
          productQuantities[pId] = {
            name: item.name || prod?.name || 'صنف توريد',
            qty: 0,
            spent: 0
          };
        }
        productQuantities[pId].qty += totalQty;
        productQuantities[pId].spent += costAmount;
      });
    });

    return Object.values(productQuantities)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [settings.supplyOrders, settings.products]);

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
      <div className="flex gap-2 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-3xl border border-slate-200/40 dark:border-slate-700/40 w-full sm:w-fit overflow-x-auto select-none scrollbar-none">
        <button 
          onClick={() => { audioSynth.playTone('click'); setActiveTab('orders'); }} 
          className={`flex-1 sm:flex-none px-5 py-3 rounded-2xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'orders' 
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' 
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Coins size={14}/>
          <span>فواتير وأوامر الشراء</span>
        </button>
        <button 
          onClick={() => { audioSynth.playTone('click'); setActiveTab('suppliers'); }} 
          className={`flex-1 sm:flex-none px-5 py-3 rounded-2xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'suppliers' 
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' 
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <User size={14}/>
          <span>قائمة الموردين المعتمدين</span>
        </button>
        <button 
          onClick={() => { audioSynth.playTone('click'); setActiveTab('inventory'); }} 
          className={`flex-1 sm:flex-none px-5 py-3 rounded-2xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'inventory' 
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' 
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Package size={14}/>
          <span>إدارة المخزون المركزي</span>
        </button>
        <button 
          onClick={() => { audioSynth.playTone('click'); setActiveTab('analytics'); }} 
          className={`flex-1 sm:flex-none px-5 py-3 rounded-2xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'analytics' 
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' 
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <BarChart2 size={14}/>
          <span>التحليلات وتقارير الموردين</span>
        </button>
        <button 
          onClick={() => { audioSynth.playTone('click'); setActiveTab('audit'); }} 
          className={`flex-1 sm:flex-none px-5 py-3 rounded-2xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'audit' 
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' 
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Activity size={14}/>
          <span>مراجعة وجرد المستودع</span>
        </button>
        <button 
          onClick={() => { audioSynth.playTone('click'); setActiveTab('warehouses'); }} 
          className={`flex-1 sm:flex-none px-5 py-3 rounded-2xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'warehouses' 
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' 
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Layers size={14}/>
          <span>المستودعات ونقاط البيع (POS)</span>
        </button>
      </div>

      {activeTab === 'orders' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.99, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 290, damping: 25 }}
          className="space-y-6"
        >
          <button 
            onClick={() => {
              setEditingOrder(null);
              setSelectedSupplierId('');
              setOrderReference('');
              setOrderNotes('');
              setOrderItems([]);
              setShippingFees(0);
              setOtherFees(0);
              setTaxRate(0);
              setDistributeExpensesEqually(false);
              setRecordExpensesFormally(false);
              setSelectedTreasuryAccountId('');
              setTreasuryPayments([]);
              setIsSplitTreasury(false);
              const defaultWh = settings.warehouses?.find(w => w.isDefault);
              setSelectedWarehouseId(defaultWh?.id || '');
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
                          {(order.grandTotal || order.totalCost).toLocaleString()} <span className="text-xs font-bold">ج.م</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold flex flex-col items-start lg:items-end mt-0.5">
                          <span>
                            {order.items.length} أصناف {order.items.reduce((s, i) => s + (i.bonusQuantity || 0), 0) > 0 && `(+ ${order.items.reduce((s, i) => s + (i.bonusQuantity || 0), 0)} بونص)`}
                          </span>
                          {(order.shippingFees || 0) > 0 && <span className="text-[9px] text-indigo-400">شحن: +{order.shippingFees} ج.م</span>}
                          {order.items.some(i => (i.damagedQuantity || 0) > 0) && (
                            <span className="text-[9px] text-rose-500 font-black animate-pulse flex items-center gap-1 mt-0.5">
                              <AlertCircle size={10} />
                              يوجد سلع تالفة ({order.items.reduce((s, i) => s + (i.damagedQuantity || 0), 0)})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-1 bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded-2xl border border-slate-100/50 dark:border-slate-800/40 shrink-0">
                        <button 
                          onClick={() => startReturnFromOrder(order)} 
                          className="p-2 text-slate-400 hover:text-amber-500 hover:bg-white dark:hover:bg-slate-700/60 rounded-xl transition-all cursor-pointer shadow-none hover:shadow-sm"
                          title="إرجاع منتجات من هذه الفاتورة"
                        >
                          <RotateCw size={15}/>
                        </button>
                        <button 
                          onClick={() => {
                            const supplier = settings.suppliers.find(s => s.id === order.supplierId);
                            const dateStr = new Date(order.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                            
                            const html = `
                              <!DOCTYPE html>
                              <html dir="rtl" lang="ar">
                              <head>
                                <meta charset="utf-8">
                                <title>فاتورة شراء توريد - ${order.referenceNumber || order.id}</title>
                                <style>
                                  body { font-family: 'Cairo', system-ui, sans-serif; padding: 30px; color: #1e293b; line-height: 1.6; }
                                  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 30px; }
                                  .header-info h1 { font-size: 24px; font-weight: 900; margin: 0; color: #0f172a; }
                                  .header-info p { margin: 5px 0 0; font-size: 13px; color: #64748b; font-weight: bold; }
                                  .meta-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
                                  .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; }
                                  .meta-label { font-size: 11px; font-weight: 900; color: #94a3b8; text-transform: uppercase; margin-bottom: 5px; }
                                  .meta-val { font-size: 14px; font-weight: 800; color: #334155; }
                                  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                                  th { background: #f1f5f9; border: 1px solid #e2e8f0; padding: 12px; text-align: right; font-size: 12px; font-weight: 900; }
                                  td { border: 1px solid #f1f5f9; padding: 12px; font-size: 12px; }
                                  .text-center { text-align: center; }
                                  .text-left { text-align: left; font-family: monospace; }
                                  .footer-stats { margin-top: 30px; border-top: 2px solid #0f172a; pt: 20px; }
                                  .stat-row { display: flex; justify-content: flex-end; gap: 50px; padding: 10px 0; }
                                  .stat-label { font-weight: bold; color: #64748b; }
                                  .stat-val { font-weight: 900; color: #0f172a; min-width: 120px; text-align: left; font-family: monospace; font-size: 15px; }
                                  .grand-total { border-top: 1px dashed #e2e8f0; margin-top: 5px; padding-top: 15px; }
                                  .grand-total .stat-val { color: #059669; font-size: 20px; }
                                  @media print { .no-print { display: none; } body { padding: 0; } }
                                </style>
                              </head>
                              <body>
                                <div class="header">
                                  <div class="header-info">
                                    <h1>فاتورة شراء بضائع / إذن استلام مخزني</h1>
                                    <p>نظام إدارة المخازن والتوريد الذكي</p>
                                  </div>
                                  <div style="text-align: left;">
                                    <div style="font-weight: 900; font-size: 18px; color: #6366f1;"># ${order.referenceNumber || order.id}</div>
                                    <div style="font-size: 11px; color: #94a3b8; font-weight: bold; margin-top: 4px;">تاريخ التوريد: ${new Date(order.date).toLocaleDateString('ar-EG')}</div>
                                  </div>
                                </div>

                                <div class="meta-grid">
                                  <div class="meta-box">
                                    <div class="meta-label">بيانات المورد والشريك المالي:</div>
                                    <div class="meta-val">${supplier?.name || 'مورد عام'}</div>
                                    <div class="meta-val" style="font-size: 12px; margin-top: 5px; color: #64748b;">${supplier?.phone || '-'}</div>
                                  </div>
                                  <div class="meta-box">
                                    <div class="meta-label">بروتوكول السداد ومصدر التمويل:</div>
                                    <div class="meta-val">
                                      ${order.paymentMethod === 'credit' ? 'آجل مديونية معلقة' : order.paymentMethod === 'partner' ? 'تمويل شركاء' : order.paymentMethod === 'supply_wallet' ? 'تمويل محفظة التوريد' : order.paymentMethod === 'treasury' ? 'تمويل من الخزينة' : 'نقدي (كاش)'}
                                    </div>
                                    <div class="meta-val" style="font-size: 11px; margin-top: 5px; color: #64748b;">الحالة: مُعتمدة ومُرحلة للمخازن</div>
                                  </div>
                                </div>

                                <table>
                                  <thead>
                                    <tr>
                                      <th>مسلسل</th>
                                      <th>اسم المنتج / الصنف</th>
                                      <th class="text-center">الكمية</th>
                                      <th class="text-center">بونص</th>
                                      <th class="text-center">سعر التكلفة</th>
                                      <th class="text-center">الخصم</th>
                                      <th class="text-left">الإجمالي الصافي</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    ${order.items.map((item, idx) => {
                                      const lineTotal = (item.cost * (item.quantity || 0)) - (item.discountType === 'percentage' ? (item.cost * (item.quantity || 0) * (item.discountValue || 0) / 100) : ((item.discountValue || 0) * (item.quantity || 0)));
                                      return `
                                        <tr>
                                          <td>${idx + 1}</td>
                                          <td><strong>${item.name}</strong></td>
                                          <td class="text-center">${item.quantity} قطعة</td>
                                          <td class="text-center">${item.bonusQuantity || 0}</td>
                                          <td class="text-center">${item.cost.toLocaleString()} ج.م</td>
                                          <td class="text-center">
                                            ${item.discountValue ? `${item.discountValue}${item.discountType === 'percentage' ? '%' : ' ج.م'}` : '-'}
                                          </td>
                                          <td class="text-left">${lineTotal.toLocaleString()} ج.م</td>
                                        </tr>
                                      `;
                                    }).join('')}
                                  </tbody>
                                </table>

                                <div class="footer-stats">
                                  <div class="stat-row">
                                    <div class="stat-label">إجمالي البضاعة (Subtotal):</div>
                                    <div class="stat-val">${((order.grandTotal || order.totalCost) - (order.shippingFees || 0) - (order.otherFees || 0) - (order.taxAmount || 0)).toLocaleString()} ج.م</div>
                                  </div>
                                  ${(order.shippingFees || 0) > 0 ? `
                                    <div class="stat-row">
                                      <div class="stat-label">مصاريف الشحن والنقل:</div>
                                      <div class="stat-val">+ ${order.shippingFees?.toLocaleString()} ج.م</div>
                                    </div>
                                  ` : ''}
                                  ${(order.taxAmount || 0) > 0 ? `
                                    <div class="stat-row">
                                      <div class="stat-label">الضرائب المضافة (${order.taxRate}%):</div>
                                      <div class="stat-val">+ ${order.taxAmount?.toLocaleString()} ج.م</div>
                                    </div>
                                  ` : ''}
                                  <div class="stat-row grand-total">
                                    <div class="stat-label" style="font-size: 16px; color: #0f172a;">الإجمالي النهائي المستحق:</div>
                                    <div class="stat-val">${(order.grandTotal || order.totalCost).toLocaleString()} ج.م</div>
                                  </div>
                                </div>

                                <div style="margin-top: 80px; display: grid; grid-template-cols: 1fr 1fr; gap: 100px; font-size: 13px; text-align: center;">
                                  <div>
                                    <div style="font-weight: bold; margin-bottom: 50px;">توقيع مأمور الاستلام (المخازن)</div>
                                    <div style="border-top: 1px solid #e2e8f0; width: 200px; margin: 0 auto;"></div>
                                  </div>
                                  <div>
                                    <div style="font-weight: bold; margin-bottom: 50px;">اعتماد المدير المالي / المالك</div>
                                    <div style="border-top: 1px solid #e2e8f0; width: 200px; margin: 0 auto;"></div>
                                  </div>
                                </div>

                                <div style="margin-top: 60px; text-align: center; color: #94a3b8; font-size: 10px; font-weight: bold; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                                  تم استخراج هذه الفاتورة آلياً بواسطة نظام مدير الأوردرات الذكي بتاريخ ${dateStr}
                                </div>
                              </body>
                              </html>
                            `;
                            
                            const prt = window.open('', '_blank');
                            if (prt) {
                              prt.document.write(html);
                              prt.document.close();
                              setTimeout(() => prt.print(), 500);
                            }
                          }} 
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700/60 rounded-xl transition-all cursor-pointer shadow-none hover:shadow-sm"
                          title="طباعة هذه الفاتورة"
                        >
                          <Printer size={15}/>
                        </button>
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
        </motion.div>
      )}

      {activeTab === 'suppliers' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.99, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 290, damping: 25 }}
          className="space-y-6"
        >
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
              {(settings.suppliers || []).map(supplier => {
                  const supplierOrders = (settings.supplyOrders || []).filter(o => o.supplierId === supplier.id);
                  const supplierReturns = (settings.purchaseReturns || []).filter(r => r.supplierId === supplier.id);
                  
                  const purchasesCount = supplierOrders.filter(o => o.status === 'completed').length;
                  const returnsCount = supplierReturns.length;

                  return (
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

                        {/* Transaction Counts */}
                        <div className="grid grid-cols-2 gap-2">
                           <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/50 flex flex-col items-center justify-center transition-colors">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">عمليات الشراء</span>
                              <span className="text-sm font-black text-slate-800 dark:text-slate-200">{purchasesCount}</span>
                           </div>
                           <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/50 flex flex-col items-center justify-center transition-colors">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">مرتجع / استبدال</span>
                              <span className="text-sm font-black text-slate-800 dark:text-slate-200">{returnsCount}</span>
                           </div>
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
                        onClick={() => {
                          const supplierOrders = (settings.supplyOrders || []).filter(o => o.supplierId === supplier.id);
                          const dateStr = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                          
                          const html = `
                            <!DOCTYPE html>
                            <html dir="rtl" lang="ar">
                            <head>
                              <meta charset="utf-8">
                              <title>كشف حساب المورد - ${supplier.name}</title>
                              <style>
                                body { font-family: 'Cairo', system-ui, sans-serif; padding: 30px; color: #1e293b; line-height: 1.6; }
                                .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 30px; }
                                .header h1 { font-size: 24px; font-weight: 900; margin: 0; color: #0f172a; }
                                .meta-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
                                .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; }
                                .meta-label { font-size: 11px; font-weight: 900; color: #94a3b8; text-transform: uppercase; }
                                .meta-val { font-size: 15px; font-weight: 800; color: #334155; margin-top: 5px; }
                                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                                th { background: #f1f5f9; border: 1px solid #e2e8f0; padding: 12px; text-align: right; font-size: 12px; font-weight: 900; }
                                td { border: 1px solid #f1f5f9; padding: 12px; font-size: 12px; }
                                .text-left { text-align: left; font-family: monospace; }
                                .footer { margin-top: 40px; border-top: 2px solid #0f172a; padding-top: 20px; display: flex; justify-content: flex-end; }
                                .balance-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 15px; text-align: center; min-width: 250px; }
                                .balance-label { font-size: 12px; font-weight: bold; color: #166534; }
                                .balance-val { font-size: 28px; font-weight: 900; color: #14532d; margin-top: 5px; }
                                @media print { body { padding: 0; } }
                              </style>
                            </head>
                            <body>
                              <div class="header">
                                <div>
                                  <h1>كشف حساب مورد كلي</h1>
                                  <p style="color: #64748b; font-size: 13px; font-weight: bold;">تاريخ استخراج التقرير: ${dateStr}</p>
                                </div>
                                <div style="text-align: left;">
                                  <div style="font-weight: 900; font-size: 20px; color: #6366f1;">${supplier.name}</div>
                                  <div style="font-size: 13px; color: #94a3b8; font-weight: bold;">هاتف: ${supplier.phone || '-'}</div>
                                </div>
                              </div>

                              <div class="meta-grid">
                                <div class="meta-box">
                                  <div class="meta-label">إجمالي عدد التعاملات الاستيرادية:</div>
                                  <div class="meta-val">${supplierOrders.length} طلبية شراء</div>
                                </div>
                                <div class="meta-box">
                                  <div class="meta-label">إجمالي قيمة المسحوبات التاريخية (فواتير):</div>
                                  <div class="meta-val">${supplierOrders.reduce((sum, o) => sum + (o.grandTotal || o.totalCost), 0).toLocaleString()} ج.م</div>
                                </div>
                              </div>

                              <h3 style="margin-bottom: 10px;">سجل الفواتير والطلبيات:</h3>
                              <table>
                                <thead>
                                  <tr>
                                    <th>التاريخ</th>
                                    <th>رقم المرجع / الفاتورة</th>
                                    <th>وسيلة التمويل</th>
                                    <th style="text-align: center;">الأصناف</th>
                                    <th class="text-left">قيمة الفاتورة</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  ${supplierOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(order => `
                                    <tr>
                                      <td>${new Date(order.date).toLocaleDateString('ar-EG')}</td>
                                      <td><strong>${order.referenceNumber || order.id.slice(0, 8)}</strong></td>
                                      <td>${order.paymentMethod === 'credit' ? 'آجل' : order.paymentMethod === 'cash' ? 'نقدي' : order.paymentMethod === 'treasury' ? 'خزينة' : 'أخرى'}</td>
                                      <td style="text-align: center;">${order.items.length} قطع</td>
                                      <td class="text-left">${(order.grandTotal || order.totalCost).toLocaleString()} ج.م</td>
                                    </tr>
                                  `).join('')}
                                </tbody>
                              </table>

                              <div class="footer">
                                <div class="balance-box">
                                  <div class="balance-label">صافي إجمالي المديونية الحالية المعلقة:</div>
                                  <div class="balance-val">${(supplier.balance || 0).toLocaleString()} ج.م</div>
                                </div>
                              </div>

                              <div style="margin-top: 100px; font-size: 11px; text-align: center; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                                يتم مراجعة هذا الكشف وتوقيعه من كلا الطرفين لإبراء الذمة المالية.
                              </div>
                            </body>
                            </html>
                          `;
                          
                          const prt = window.open('', '_blank');
                          if (prt) {
                            prt.document.write(html);
                            prt.document.close();
                            setTimeout(() => prt.print(), 500);
                          }
                        }} 
                        className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all cursor-pointer" 
                        title="طباعة كشف حساب المورد"
                      >
                        <Printer size={16}/>
                      </button>
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
              );
            })}
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'inventory' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.99, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 290, damping: 25 }}
          className="space-y-6"
        >
          {/* Dynamic Top KPIs Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] text-slate-450 dark:text-slate-500 font-bold block mb-1">أصناف المخزن فريدة</span>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg shrink-0">
                  <Package size={16}/>
                </span>
                <span className="text-base font-black text-slate-850 dark:text-white leading-tight">
                  {inventoryStats.totalUniqueItems} <span className="text-[10px] text-slate-400 font-bold block">مادة</span>
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] text-slate-450 dark:text-slate-500 font-bold block mb-1">إجمالي قطع المخزن</span>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-lg shrink-0">
                  <Layers size={16}/>
                </span>
                <span className="text-base font-black text-slate-850 dark:text-white leading-tight">
                  {inventoryStats.totalStockPieces.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold block">قطعة</span>
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] text-slate-450 dark:text-slate-500 font-bold block mb-1">رأس مال البضاعة</span>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
                  <Coins size={16}/>
                </span>
                <span className="text-base font-black text-emerald-600 leading-tight">
                  {inventoryStats.totalCapitalAtCost.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold block">ج.م (تكلفة)</span>
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] text-slate-450 dark:text-slate-500 font-bold block mb-1">العائد المتوقع للبيع</span>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 rounded-lg shrink-0">
                  <TrendingUp size={16}/>
                </span>
                <span className="text-base font-black text-teal-600 leading-tight">
                  {inventoryStats.totalRetailWorth.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold block">ج.م (تجزئة)</span>
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] text-slate-455 dark:text-slate-500 font-bold block mb-1">صافي الجدوى الربحية</span>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0">
                  <Percent size={16}/>
                </span>
                <span className="text-base font-black text-indigo-600 leading-tight">
                  {inventoryStats.potentialProfit.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold block">ج.م (+{inventoryStats.profitMarginPercentage.toFixed(1)}%)</span>
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] text-slate-455 dark:text-slate-505 font-bold block mb-1">منتجات عجز/حرج الرصيد</span>
              <div className="flex items-center gap-2">
                <span className={`p-1.5 rounded-lg shrink-0 ${inventoryStats.lowStockCount > 0 ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-rose-50 text-rose-400'}`}>
                  <AlertCircle size={16}/>
                </span>
                <span className={`text-base font-black leading-tight ${inventoryStats.lowStockCount > 0 ? 'text-rose-600' : 'text-slate-655'}`}>
                  {inventoryStats.lowStockCount} <span className="text-[10px] text-slate-400 font-bold block">تحت عتبة الأمان</span>
                </span>
              </div>
            </div>
          </div>

          {/* Table Toolbar & Search filter */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
            <div className="flex flex-col sm:flex-row items-stretch gap-3 flex-1">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                  <Search size={16} />
                </span>
                <input 
                  type="text"
                  value={inventoryQuery}
                  onChange={e => setInventoryQuery(e.target.value)}
                  placeholder="بحث عن المنتجات بالاسم، الـ SKU أو تفاصيل الموديل..."
                  className="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs font-bold dark:text-white transition-all placeholder-slate-400"
                />
              </div>

              {/* Status Select filter */}
              <select
                value={inventoryStockFilter}
                onChange={e => setInventoryStockFilter(e.target.value as any)}
                className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-705 rounded-xl text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">كل حالات رصيد المخزن</option>
                <option value="in_stock">متوفر (رصيد آمن)</option>
                <option value="low_stock">منخفض (رصيد حرج)</option>
                <option value="out_of_stock">غير متوفر (رصيد صفر)</option>
              </select>

              {/* Collections filter */}
              <select
                value={inventoryCollectionFilter}
                onChange={e => setInventoryCollectionFilter(e.target.value)}
                className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-705 rounded-xl text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">كل المجموعات والتصنيفات</option>
                {(settings.collections || []).map(group => (
                  <option key={group.id} value={group.id}>مجموعة / {group.name}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={() => {
                const dateStr = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const html = `
                  <!DOCTYPE html>
                  <html dir="rtl" lang="ar">
                  <head>
                    <meta charset="utf-8">
                    <title>كشف جرد وتقييم قيمة المخزون المركزي</title>
                    <style>
                      body { font-family: 'Cairo', system-ui, sans-serif; padding: 25px; color: #334155; }
                      .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 25px; }
                      .title { font-size: 20px; font-weight: bold; color: #1e293b; margin: 0; }
                      .date { font-size: 11px; color: #64748b; margin-top: 5px; }
                      .stats-grid { display: grid; grid-template-cols: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
                      .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; font-size: 12px; }
                      .stat-val { font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 5px; }
                      table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
                      th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; text-align: right; }
                      td { border: 1px solid #e2e8f0; padding: 8px; }
                      tr:nth-child(even) { background: #f8fafc; }
                      .text-left { text-align: left; font-family: monospace; }
                      .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; }
                      .badge-out { background: #fee2e2; color: #b91c1c; }
                      .badge-low { background: #fef3c7; color: #d97706; }
                      .badge-ok { background: #dcfce7; color: #15803d; }
                    </style>
                  </head>
                  <body>
                    <div class="header">
                      <h1 class="title">كشف وتقييم قيمة المخزون المركزي والمستودع</h1>
                      <div class="date">تاريخ الاستخراج: ${dateStr}</div>
                    </div>
                    <div class="stats-grid">
                      <div class="stat-card">
                        <div>إجمالي الأصناف الفريدة</div>
                        <div class="stat-val">${inventoryStats.totalUniqueItems} صنف</div>
                      </div>
                      <div class="stat-card">
                        <div>إجمالي السلع المادية القائمة</div>
                        <div class="stat-val">${inventoryStats.totalStockPieces.toLocaleString()} قطعة</div>
                      </div>
                      <div class="stat-card">
                        <div>رأس مال البضاعة بالتكلفة</div>
                        <div class="stat-val">${inventoryStats.totalCapitalAtCost.toLocaleString()} ج.م</div>
                      </div>
                      <div class="stat-card">
                        <div>العائد المتوقع للبيع بالتجزئة</div>
                        <div class="stat-val">${inventoryStats.totalRetailWorth.toLocaleString()} ج.م</div>
                      </div>
                    </div>
                    <table>
                      <thead>
                        <tr>
                          <th>مسلسل</th>
                          <th>اسم المنتج / الصنف بالتفصيل</th>
                          <th>الـ SKU</th>
                          <th>الرصيد المتاح</th>
                          <th>سعر التكلفة</th>
                          <th>رأس مال الصنف</th>
                          <th>سعر المبيع</th>
                          <th>القيمة المتوقعة</th>
                          <th>حالة المخزون</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${filteredInventoryItems.map((item, idx) => {
                          const statusClass = item.stock <= 0 ? 'badge-out' : item.stock <= item.threshold ? 'badge-low' : 'badge-ok';
                          const statusText = item.stock <= 0 ? 'منفذ' : item.stock <= item.threshold ? 'حرج دنيا' : 'رصيد آمن';
                          return `
                            <tr>
                              <td>${idx + 1}</td>
                              <td><strong>${item.name}</strong></td>
                              <td>${item.sku || '-'}</td>
                              <td>${item.stock} قطعة</td>
                              <td class="text-left">${item.cost.toLocaleString()} ج.م</td>
                              <td class="text-left">${(item.stock * item.cost).toLocaleString()} ج.م</td>
                              <td class="text-left">${item.price.toLocaleString()} ج.م</td>
                              <td class="text-left">${(item.stock * item.price).toLocaleString()} ج.م</td>
                              <td><span class="badge ${statusClass}">${statusText}</span></td>
                            </tr>
                          `;
                        }).join('')}
                      </tbody>
                    </table>
                    <div style="margin-top: 60px; text-align: left; display: flex; justify-content: space-between; font-size: 12px;">
                      <div>توقيع أمين ومأمور المستودع: _____________________</div>
                      <div>توقيع الإدارة المالية والاعتماد: _____________________</div>
                    </div>
                  </body>
                  </html>
                `;
                const prt = window.open('', '_blank');
                if (prt) {
                  prt.document.write(html);
                  prt.document.close();
                  setTimeout(() => {
                    prt.print();
                  }, 500);
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-black transition-all cursor-pointer"
            >
              <Printer size={15}/>
              <span>تصدير وطباعة تقرير الجرد المركزي</span>
            </button>
          </div>

          {/* Dynamic Table of Inventory Details */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-black border-b border-secondary">
                  <tr>
                    <th className="px-5 py-4">صورة المنتج / الصنف</th>
                    <th className="px-5 py-4">مسلسل</th>
                    <th className="px-5 py-4">الصنف والموديل</th>
                    <th className="px-5 py-4">الـ SKU</th>
                    <th className="px-5 py-4 text-center">الرصيد الفعلي الحالي</th>
                    <th className="px-5 py-4 text-center">التكلفة (للقطعة/للإجمالي)</th>
                    <th className="px-5 py-4 text-center">التجزئة (للقطعة/للإجمالي)</th>
                    <th className="px-5 py-4 text-center">المستوى وحالة المخزون</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredInventoryItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                        <Package className="mx-auto block mb-3 opacity-30 text-slate-400" size={40}/>
                        <p className="font-bold text-slate-600 dark:text-slate-400 text-sm">عذراً! لم يتم العثور على أي منتجات مطابقة لخيارات تصفية المخزون</p>
                        <p className="text-slate-405 text-xs mt-1">تأكد من كتابة أحرف البحث بشكل صحيح أو تغيير تصفية المخازن المتبعة.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredInventoryItems.map((item, index) => {
                      const costWorth = item.stock * item.cost;
                      const retailWorth = item.stock * item.price;
                      
                      // Progress width calculation representing safety
                      const maxSafetyDensity = Math.max(20, item.threshold * 4);
                      const densityPercentage = Math.min(100, Math.max(0, (item.stock / maxSafetyDensity) * 100));

                      const isOutOfStock = item.stock <= 0;
                      const isLowStock = item.stock > 0 && item.stock <= item.threshold;

                      return (
                        <tr key={item.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-all">
                          <td className="px-5 py-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center border border-slate-100 dark:border-slate-800">
                              {item.thumbnail ? (
                                <img src={item.thumbnail} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : <Package size={15} className="text-slate-400" />}
                            </div>
                          </td>
                          <td className="px-5 py-3 font-mono text-slate-400">#{index + 1}</td>
                          <td className="px-5 py-3">
                            <h5 className="font-black text-slate-850 dark:text-white text-xs max-w-sm leading-relaxed">{item.name}</h5>
                            {item.collectionId && (
                              <span className="inline-block mt-1 text-[9px] font-bold text-indigo-505 text-indigo-500 bg-indigo-50/65 dark:bg-indigo-950/20 border border-indigo-100/30 px-1.5 py-0.5 rounded ml-1">
                                {(settings.collections || []).find(c => c.id === item.collectionId)?.name || 'مجموعة مصنفة'}
                              </span>
                            )}
                            
                            {/* Warehouse Breakdown */}
                            <div className="mt-2 flex flex-wrap gap-1">
                              {(settings.warehouses || []).map(wh => {
                                // Find product to get its warehouse stock
                                const prod = settings.products.find(p => p.id === item.productId);
                                const vOrig = item.variantId ? prod?.variants.find(v => v.id === item.variantId) : null;
                                const qtyInWh = item.variantId ? (vOrig?.warehouseStock?.[wh.id] || 0) : (prod?.warehouseStock?.[wh.id] || 0);
                                
                                if (qtyInWh <= 0) return null;
                                
                                return (
                                  <span key={wh.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 text-[9px] font-bold text-slate-500 dark:text-slate-400 rounded">
                                    {wh.name}: {qtyInWh}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-slate-500 font-mono font-medium">{item.sku || <span className="opacity-40">-</span>}</td>
                          <td className="px-5 py-3 text-center">
                            <span className="font-exrabold text-sm font-mono text-slate-850 dark:text-white">{item.stock}</span> <span className="text-slate-400 text-[10px]">قطعة</span>
                          </td>
                          <td className="px-5 py-3 text-center font-mono">
                            <div className="font-bold text-slate-800 dark:text-slate-205">{item.cost.toLocaleString()} ج.م</div>
                            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">{costWorth.toLocaleString()} ج.م (كل)</div>
                          </td>
                          <td className="px-5 py-3 text-center font-mono">
                            <div className="font-bold text-slate-800 dark:text-slate-205">{item.price.toLocaleString()} ج.م</div>
                            <div className="text-[10px] text-slate-404 text-slate-400 font-semibold mt-0.5">{retailWorth.toLocaleString()} ج.م (كل)</div>
                          </td>
                          <td className="px-5 py-3 text-center">
                            {isOutOfStock ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-50 dark:bg-rose-950/30 text-rose-500 border border-rose-100/30">
                                رصيد صفر (منفذ)
                              </span>
                            ) : isLowStock ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 dark:bg-amber-955/20 text-amber-600 dark:text-amber-400 border border-amber-100/30">
                                  رصيد حرج (تحت {item.threshold})
                                </span>
                                <div className="w-16 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto overflow-hidden">
                                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${densityPercentage}%` }}></div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100/30">
                                  رصيد آمن (جاهز)
                                </span>
                                <div className="w-16 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto overflow-hidden">
                                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${densityPercentage}%` }}></div>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'analytics' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.99, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 290, damping: 25 }}
          className="space-y-6"
        >
          {/* Dynamic Scorecard Totals overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-6 rounded-3xl shadow-sm">
              <span className="text-xs font-bold text-slate-400 block mb-1">الرأس المالي المتدفق للمشتريات</span>
              <div className="flex items-center gap-3">
                <span className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl shrink-0">
                  <Coins size={22}/>
                </span>
                <div>
                  <h3 className="text-2xl font-black text-slate-850 dark:text-white leading-none">
                    {supplierPerformanceStats.reduce((sum, s) => sum + s.totalCostAmount, 0).toLocaleString()} <span className="text-xs font-bold">ج.م</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold">إجمالي قيمة فواتير الطلبيات وتوريد بضائع مستودعاتك</p>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-6 rounded-3xl shadow-sm">
              <span className="text-xs font-bold text-slate-400 block mb-1">إجمالي القطع الواردة المستلمة</span>
              <div className="flex items-center gap-3">
                <span className="p-3 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 rounded-2xl shrink-0">
                  <Package size={22}/>
                </span>
                <div>
                  <h3 className="text-2xl font-black text-slate-850 dark:text-white leading-none">
                    {supplierPerformanceStats.reduce((sum, s) => sum + s.totalPiecesSupplied, 0).toLocaleString()} <span className="text-xs font-bold">وحدة</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold">مجموع سلع المدخلات والمخازن شاملة كميات البونص الصافي</p>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-6 rounded-3xl shadow-sm">
              <span className="text-xs font-bold text-slate-400 block mb-1">المديونية الإجمالية القائمة للموردين</span>
              <div className="flex items-center gap-3">
                <span className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-455 rounded-2xl shrink-0">
                  <TrendingDown size={22}/>
                </span>
                <div>
                  <h3 className="text-2xl font-black text-rose-600 leading-none">
                    {supplierPerformanceStats.reduce((sum, s) => sum + s.balance, 0).toLocaleString()} <span className="text-xs font-bold">ج.م</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold">التزامات مالية مستحقة الدفع حالياً للشركاء والموردين</p>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Recharts visual layouts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Payments Breakdown Pie */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col">
              <h4 className="font-extrabold text-slate-800 dark:text-white text-sm mb-4 flex items-center gap-1.5">
                <LucidePieChart size={16} className="text-indigo-500" />
                توزيع المشتريات والتوريد حسب طريقة السداد
              </h4>
              <div className="h-64 flex-1">
                {paymentMethodsStats.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">لا توجد سجلات فواتير كافية للتوريد حالياً للرسم الحسابي</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentMethodsStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {paymentMethodsStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value: any) => `${Number(value).toLocaleString()} ج.م`} />
                      <Legend layout="horizontal" verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 2: Top Products Bar */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col">
              <h4 className="font-extrabold text-slate-800 dark:text-white text-sm mb-4 flex items-center gap-1.5">
                <BarChart2 size={16} className="text-teal-500" />
                أكثر البضائع سحباً وتوريداً من الموردين (إجمالي الكمية المدخلة)
              </h4>
              <div className="h-64 flex-1">
                {topSuppliedProductsSummary.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">لا توجد فواتير توريد للمصادقة الحسابية</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topSuppliedProductsSummary} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 8 }} interval={0} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 9 }} stroke="#94a3b8" />
                      <RechartsTooltip formatter={(value: any) => `${value} قطعة`} />
                      <Bar dataKey="qty" fill="#14b8a6" radius={[4, 4, 0, 0]} barSize={25} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Suppliers Performance scorecard table */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40">
              <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span className="w-1 px-0.5 h-4 bg-teal-500 rounded-full"></span>
                مقياس الكفاءة والذمة المالية لشركاء التوريد الماليين
              </h4>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold px-3 py-1 rounded-xl">
                إجمالي الموردين: {supplierPerformanceStats.length} جهات معتمدة
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/20 text-slate-500 dark:text-slate-400 font-extrabold border-b border-light">
                  <tr>
                    <th className="px-5 py-4">اسم وشريك شركة التوريد</th>
                    <th className="px-5 py-4 text-center">أوامر التوريد بالتاريخ</th>
                    <th className="px-5 py-4 text-center">إجمالي المشتريات (ج.م)</th>
                    <th className="px-5 py-4 text-center">مجموع القطع الموردة</th>
                    <th className="px-5 py-4 text-center">المديونية المعلقة</th>
                    <th className="px-5 py-4 text-center">متوسط الفاتورة الصافي</th>
                    <th className="px-5 py-4 text-center">تاريخ آخر أمر شراء</th>
                    <th className="px-5 py-4 text-center">الخيار والمطبوعات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold bg-white dark:bg-slate-900">
                  {supplierPerformanceStats.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-slate-400">لم يتم العثور على أية إحصائيات لموردين ماليين مسجلين بنظامك</td>
                    </tr>
                  ) : (
                    supplierPerformanceStats.map(supp => (
                      <tr key={supp.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors">
                        <td className="px-5 py-3">
                          <div className="font-black text-slate-850 dark:text-white">{supp.name}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{supp.phone || 'بلا هاتف'}</div>
                        </td>
                        <td className="px-5 py-3 text-center text-slate-600 dark:text-slate-350">{supp.ordersCount} فواتير</td>
                        <td className="px-5 py-3 text-center font-mono font-bold text-emerald-600">{supp.totalCostAmount.toLocaleString()} ج.م</td>
                        <td className="px-5 py-3 text-center text-slate-600 dark:text-slate-350">{supp.totalPiecesSupplied} وحدات</td>
                        <td className="px-5 py-3 text-center">
                          {supp.balance > 0 ? (
                            <span className="px-2.5 py-1 text-[10px] font-black bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-full border border-rose-100/30">
                              {supp.balance.toLocaleString()} ج.م متبقية
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-full border border-emerald-100/30">
                              مخلص تماماً
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center font-mono text-slate-500">{Math.round(supp.avgInvoiceValue).toLocaleString()} ج.م</td>
                        <td className="px-5 py-3 text-center text-slate-500 font-medium">
                          {supp.latestDate ? new Date(supp.latestDate).toLocaleDateString('ar-EG') : '-'}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <button
                            onClick={() => {
                              const dateStr = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                              const suppOrders = (settings.supplyOrders || []).filter(o => o.supplierId === supp.id && o.status !== 'cancelled');
                              
                              const html = `
                                <!DOCTYPE html>
                                <html dir="rtl" lang="ar">
                                <head>
                                  <meta charset="utf-8">
                                  <title>كشف حساب مورد - ${supp.name}</title>
                                  <style>
                                    body { font-family: 'Cairo', system-ui, sans-serif; padding: 25px; color: #334155; }
                                    .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 25px; }
                                    .title { font-size: 20px; font-weight: bold; color: #1e293b; margin: 0; }
                                    .date { font-size: 11px; color: #64748b; margin-top: 5px; }
                                    .stats-grid { display: grid; grid-template-cols: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
                                    .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
                                    .stat-val { font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 5px; }
                                    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
                                    th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; text-align: right; }
                                    td { border: 1px solid #e2e8f0; padding: 8px; }
                                    tr:nth-child(even) { background: #f8fafc; }
                                    .text-left { text-align: left; font-family: monospace; }
                                    .status { font-weight: bold; }
                                    .debt { color: #dc2626; }
                                  </style>
                                </head>
                                <body>
                                  <div class="header">
                                    <h1 class="title">كشف المعاملات المالية الموثقة وحركة التوريد للمستودعات</h1>
                                    <div style="font-size: 14px; font-weight: bold; margin-top: 5px;">اسم المورد الشريك: <strong>${supp.name}</strong></div>
                                    <div class="date">تاريخ الاستخراج: ${dateStr}</div>
                                  </div>
                                  <div class="stats-grid">
                                    <div class="stat-card">
                                      <div>إجمالي الفواتير والصفقات</div>
                                      <div class="stat-val">${supp.ordersCount} أمر</div>
                                    </div>
                                    <div class="stat-card">
                                      <div>صافي القيمة التوريدية</div>
                                      <div class="stat-val">${supp.totalCostAmount.toLocaleString()} ج.م</div>
                                    </div>
                                    <div class="stat-card">
                                      <div>إجمالي السلع المستلمة</div>
                                      <div class="stat-val">${supp.totalPiecesSupplied} قطعة</div>
                                    </div>
                                    <div class="stat-card">
                                      <div style="color: #dc2626; font-weight: bold;">أرصدة آجلة متبقية</div>
                                      <div class="stat-val debt">${supp.balance.toLocaleString()} ج.م</div>
                                    </div>
                                  </div>
                                  <h3>بيان حركة فواتير استلام وتوريد البضاعة:</h3>
                                  <table>
                                    <thead>
                                      <tr>
                                        <th>مسلسل</th>
                                        <th>تاريخ الدخول</th>
                                        <th>رقم المرجع والفاتورة</th>
                                        <th>بروتوكول السداد ومصدر التمويل</th>
                                        <th>البيان والمواد الموردة للمستودع</th>
                                        <th>إجمالي الفاتورة</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      ${suppOrders.map((order, idx) => {
                                        const itemsList = order.items.map(it => `${it.name || 'مادة'} (${it.quantity} قطع بسعر تكلفة ${it.cost} ج.م)`).join(' ، ');
                                        const payMethodText = order.paymentMethod === 'credit' ? 'آجل مديونية' : order.paymentMethod === 'partner' ? 'تمويل شركاء' : order.paymentMethod === 'supply_wallet' ? 'محفظة توريد كاش' : 'نقدي (كاش)';
                                        return `
                                          <tr>
                                            <td>${idx + 1}</td>
                                            <td>${new Date(order.date).toLocaleDateString('ar-EG')}</td>
                                            <td>Ref: ${order.referenceNumber || order.id}</td>
                                            <td><strong>${payMethodText}</strong></td>
                                            <td>${itemsList}</td>
                                            <td class="text-left" style="font-weight: bold;">${order.totalCost.toLocaleString()} ج.م</td>
                                          </tr>
                                        `;
                                      }).join('')}
                                    </tbody>
                                  </table>
                                  <div style="margin-top: 60px; text-align: left; display: flex; justify-content: space-between; font-size: 12px;">
                                    <div>ممثّل ومصادقة جهة التوريد: _____________________</div>
                                    <div>توقيع أمين الصندوق والمدير المالي والاعتماد: _____________________</div>
                                  </div>
                                </body>
                                </html>
                              `;
                              const prt = window.open('', '_blank');
                              if (prt) {
                                prt.document.write(html);
                                prt.document.close();
                                setTimeout(() => {
                                  prt.print();
                                }, 500);
                              }
                            }}
                            className="px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/20 text-slate-500 hover:text-indigo-650 rounded-lg text-[10px] font-black transition-all cursor-pointer inline-flex items-center gap-1 border border-slate-200/40"
                          >
                            <Printer size={12}/> كشف حساب ملون
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'audit' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.99, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 290, damping: 25 }}
        >
          <InventoryAudit settings={settings} setSettings={setSettings} currentUser={currentUser} />
        </motion.div>
      )}

      {activeTab === 'warehouses' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.99, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 290, damping: 25 }}
          className="space-y-6"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 dark:border-slate-800">
            <h3 className="text-lg font-black dark:text-white flex items-center gap-2">
              <span className="w-1.5 h-6 bg-amber-500 rounded-full"></span>
              المستودعات ومواقع التخزين
            </h3>
            <button 
              onClick={() => {
                setEditingWarehouse(null);
                setNewWarehouse({ name: '', location: '', isDefault: false });
                setShowWarehouseModal(true);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-amber-600 text-white rounded-2xl font-black text-xs hover:bg-slate-800 dark:hover:bg-amber-500 shadow-lg shadow-slate-900/10 transition-all cursor-pointer"
            >
              <Plus size={16}/>
              <span>إضافة فرع / نقطة بيع جديدة</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(settings.warehouses || []).length === 0 ? (
              <div className="col-span-full bg-white dark:bg-slate-900 p-12 text-center rounded-[2rem] border border-slate-100 dark:border-slate-800/80">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-300">
                  <Layers size={40}/>
                </div>
                <h3 className="text-xl font-black text-slate-400 mb-2">لا توجد مستودعات مضافة</h3>
                <p className="text-slate-400 text-sm font-bold">ابدأ بإضافة المستودع الرئيسي أو الفروع لإدارة المخزون بدقة</p>
              </div>
            ) : (
              settings.warehouses?.map((warehouse: any) => (
                <div key={warehouse.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                  {warehouse.isDefault && (
                    <div className="absolute top-0 left-0 px-4 py-1 bg-amber-500 text-white text-[10px] font-black rounded-br-2xl">
                      المستودع الافتراضي
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center text-slate-400">
                      <Layers size={24}/>
                    </div>
                    <div className="flex gap-2">
                       <button 
                        onClick={() => startEditWarehouse(warehouse)} 
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all cursor-pointer" 
                        title="تعديل بيانات المستودع"
                      >
                        <Edit2 size={16}/>
                      </button>
                      <button 
                        onClick={() => handleDeleteWarehouse(warehouse.id)} 
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all cursor-pointer" 
                        title="حذف المستودع"
                      >
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  </div>
                  <h4 className="text-lg font-black text-slate-800 dark:text-white mb-1">{warehouse.name}</h4>
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-bold mb-4">
                    <HelpCircle size={12}/>
                    <span>{warehouse.location || 'لا يوجد عنوان محدد'}</span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800/40 space-y-3">
                    <div className="flex justify-between items-center text-xs font-black">
                      <span className="text-slate-400">إجمالي الأصناف:</span>
                      <span className="text-slate-900 dark:text-slate-100">
                        {settings.products.filter(p => {
                          const mainStock = p.warehouseStock?.[warehouse.id] || 0;
                          const hasVariantStock = (p.variants || []).some(v => (v.warehouseStock?.[warehouse.id] || 0) > 0);
                          return mainStock > 0 || hasVariantStock;
                        }).length} صنف
                      </span>
                    </div>

                    {settings.products.filter(p => {
                      const mainStock = p.warehouseStock?.[warehouse.id] || 0;
                      const hasVariantStock = (p.variants || []).some(v => (v.warehouseStock?.[warehouse.id] || 0) > 0);
                      return mainStock > 0 || hasVariantStock;
                    }).length > 0 && (
                      <div className="pt-1">
                        <button 
                          onClick={() => setExpandedWarehouseId(expandedWarehouseId === warehouse.id ? null : warehouse.id)}
                          className="w-full py-1.5 px-3 text-right bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/20 dark:hover:bg-slate-800/40 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-[10px] font-bold flex items-center justify-between cursor-pointer transition-all"
                        >
                          <span>{expandedWarehouseId === warehouse.id ? 'إخفاء قائمة الأصناف ▲' : 'عرض قائمة الأصناف بالتفصيل ▼'}</span>
                        </button>
                        
                        {expandedWarehouseId === warehouse.id && (
                          <div className="mt-2.5 max-h-48 overflow-y-auto space-y-2 p-2 rounded-xl bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/40 custom-scrollbar text-right">
                            {settings.products.filter(p => {
                              const mainStock = p.warehouseStock?.[warehouse.id] || 0;
                              const hasVariantStock = (p.variants || []).some(v => (v.warehouseStock?.[warehouse.id] || 0) > 0);
                              return mainStock > 0 || hasVariantStock;
                            }).map(p => {
                              const mainStock = p.warehouseStock?.[warehouse.id] || 0;
                              const variantDetails = (p.variants || []).filter(v => (v.warehouseStock?.[warehouse.id] || 0) > 0);
                              
                              return (
                                <div key={p.id} className="text-[10px] border-b border-dashed border-slate-100 dark:border-slate-800/60 pb-1.5 mb-1.5 last:border-0 last:pb-0 last:mb-0">
                                  <div className="flex justify-between items-start gap-2">
                                    <span className="font-extrabold text-slate-700 dark:text-slate-300 leading-normal flex-1">{p.name}</span>
                                    {mainStock > 0 && (
                                      <span className="shrink-0 text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded-md">
                                        {mainStock} قطعة
                                      </span>
                                    )}
                                  </div>
                                  {p.sku && <div className="text-[8px] text-slate-400 font-mono mt-0.5">SKU: {p.sku}</div>}
                                  
                                  {variantDetails.map(vd => (
                                    <div key={vd.id} className="mr-3 mt-1 flex justify-between items-center bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-100/50 dark:border-slate-800/30 text-[9px]">
                                      <span className="text-slate-500 dark:text-slate-400">النوع: {Object.values(vd.options || {}).join(' / ') || vd.sku}</span>
                                      <span className="text-emerald-600 dark:text-emerald-400 font-black">{vd.warehouseStock?.[warehouse.id]} قطعة</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}

      {/* Warehouse Modal Dialog */}
      {showWarehouseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="bg-amber-600 dark:bg-amber-700 p-6 text-white flex justify-between items-center">
              <h3 className="text-lg font-black">{editingWarehouse ? 'تعديل بيانات المستودع' : 'إضافة مستودع جديد'}</h3>
              <button 
                onClick={() => { 
                  setShowWarehouseModal(false); 
                  setEditingWarehouse(null); 
                  setNewWarehouse({name:'', location:'', isDefault:false}); 
                }} 
                className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <X size={20}/>
              </button>
            </div>
            <div className="p-6 space-y-4 text-right">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">اسم المستودع / الفرع *</label>
                <input 
                  type="text" 
                  value={newWarehouse.name}
                  onChange={(e) => setNewWarehouse({...newWarehouse, name: e.target.value})}
                  placeholder="مثال: المستودع الرئيسي، فرع المهندسين..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none text-right"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">الموقع / العنوان</label>
                <input 
                  type="text" 
                  value={newWarehouse.location}
                  onChange={(e) => setNewWarehouse({...newWarehouse, location: e.target.value})}
                  placeholder="مثال: القاهرة، حي النزهة..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none text-right"
                />
              </div>
              <div className="flex items-center gap-3 py-2">
                <input 
                  type="checkbox" 
                  id="default-wh"
                  checked={newWarehouse.isDefault}
                  onChange={(e) => setNewWarehouse({...newWarehouse, isDefault: e.target.checked})}
                  className="w-5 h-5 accent-amber-500 cursor-pointer"
                />
                <label htmlFor="default-wh" className="text-xs font-black text-slate-700 dark:text-slate-300 cursor-pointer">
                  تعيين كمستودع افتراضي للاستلام والتوريد
                </label>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={handleAddWarehouse}
                  className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-black text-sm hover:bg-amber-700 shadow-lg shadow-amber-600/10 transition-all cursor-pointer"
                >
                  {editingWarehouse ? 'حفظ التعديلات' : 'إضافة المستودع الآن'}
                </button>
                <button 
                  onClick={() => setShowWarehouseModal(false)}
                  className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
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
                <div>
                  <label className="text-xs font-black text-slate-500 mb-1.5 block">مستودع الاستلام (تخزين البضاعة) *</label>
                  <select 
                    value={selectedWarehouseId || ''} 
                    onChange={e => setSelectedWarehouseId(e.target.value)} 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-250 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-xs dark:text-white"
                  >
                    <option value="">-- اختر مستودع الاستلام --</option>
                    {(settings.warehouses || []).map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} {w.isDefault ? '(الافتراضي)' : ''}
                      </option>
                    ))}
                  </select>
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
                    placeholder="أمثلة: مصروفات عمالة، بضاعة صيفية، كميات مضافة لعروض موسمية..." 
                    value={orderNotes || ''} 
                    onChange={e => setOrderNotes(e.target.value)} 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-semibold text-xs dark:text-white" 
                  />
                </div>
              </div>

              {/* Fees and Taxes Section */}
              <div className="space-y-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 mb-1 block">مصاريف الشحن / النقل</label>
                    <div className="space-y-2">
                       <div className="relative">
                         <input 
                           type="number" 
                           min="0"
                           value={shippingFees || ''} 
                           onChange={e => setShippingFees(Number(e.target.value))} 
                           className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-xs dark:text-white pl-8" 
                         />
                         <span className="absolute left-3 top-2.5 text-[10px] text-slate-400 font-bold">ج.م</span>
                       </div>
                       <input 
                         type="text"
                         placeholder="وصف مصروف الشحن (مثل: عمالة، نقل...)"
                         value={shippingFeesNote}
                         onChange={e => setShippingFeesNote(e.target.value)}
                         className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-[10px] dark:text-white"
                       />
                       {shippingFees > 0 && (
                         <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mt-2">
                           <button 
                             onClick={() => setShippingFeesPaymentMethod('with_order')}
                             className={`flex-1 text-[9px] py-1.5 rounded-md transition font-bold ${shippingFeesPaymentMethod === 'with_order' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                           >
                             مع الفاتورة
                           </button>
                           <button 
                             onClick={() => setShippingFeesPaymentMethod('wallet')}
                             className={`flex-1 text-[9px] py-1.5 rounded-md transition font-bold ${shippingFeesPaymentMethod === 'wallet' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                           >
                             محفظة المتجر
                           </button>
                         </div>
                       )}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 mb-1 block">مصاريف أخرى / إضافية</label>
                    <div className="space-y-2">
                        <div className="relative">
                          <input 
                            type="number" 
                            min="0"
                            value={otherFees || ''} 
                            onChange={e => setOtherFees(Number(e.target.value))} 
                            className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-xs dark:text-white pl-8" 
                          />
                          <span className="absolute left-3 top-2.5 text-[10px] text-slate-400 font-bold">ج.م</span>
                        </div>
                        <input 
                          type="text"
                          placeholder="وصف المصاريف الإضافية"
                          value={otherFeesNote}
                          onChange={e => setOtherFeesNote(e.target.value)}
                          className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-[10px] dark:text-white"
                        />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 mb-1 block">نسبة الضريبة %</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        min="0" 
                        max="100"
                        value={taxRate || ''} 
                        onChange={e => setTaxRate(Number(e.target.value))} 
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-xs dark:text-white pl-8" 
                      />
                      <span className="absolute left-3 top-2.5 text-[10px] text-slate-400 font-bold">%</span>
                    </div>
                  </div>
                </div>

                {paymentMethod !== 'partner' && (
                  <div className="pt-2">
                    <label className="text-[10px] font-black text-slate-500 mb-1 block">الشخص / الجهة القائمة بدفع المصروفات الإضافية (إن وجدت)</label>
                    <div className="relative">
                      <input 
                        type="text"
                        list="partnersList"
                        placeholder="اختر الشريك أو اكتب اسم جهة الدفع..."
                        value={expensePaidBy}
                        onChange={e => setExpensePaidBy(e.target.value)}
                        className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs dark:text-white font-bold"
                      />
                      <datalist id="partnersList">
                          {settings.partners?.map(p => (
                              <option key={p.id} value={p.name} />
                          ))}
                      </datalist>
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                    </div>
                  </div>
                )}

                {(shippingFees > 0 || otherFees > 0) && (
                  <div className="pt-3 border-t border-slate-200/50 dark:border-slate-700/50 flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={recordExpensesFormally} 
                        onChange={e => setRecordExpensesFormally(e.target.checked)} 
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900"
                      />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        إدراج كمصروفات منفصلة في دفتر المصروفات (تظهر في التقارير)
                      </span>
                    </label>
                    
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={distributeExpensesEqually} 
                        onChange={e => setDistributeExpensesEqually(e.target.checked)} 
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900"
                      />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        توزيع هذه المصاريف بالتساوي على تكلفة المنتجات (Landed Cost)
                      </span>
                    </label>
                  </div>
                )}
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
                      <div key={idx} className="bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-2.5rem rounded-2xl border border-slate-105 dark:border-slate-800/80">
                        <div className="grid grid-cols-2 md:grid-cols-12 gap-3 items-end">
                          <div className="col-span-2 md:col-span-5 text-right">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-bold text-slate-400 block">تحديد الموديل / المنتج المتاح</label>
                                <label className="flex items-center gap-1 cursor-pointer">
                                  <input type="checkbox" checked={item.isReturn || false} onChange={e => {
                                    const newItems = [...orderItems];
                                    newItems[idx].isReturn = e.target.checked;
                                    setOrderItems(newItems);
                                  }} className="accent-rose-500 rounded cursor-pointer size-3"/>
                                  <span className="text-[10px] font-black text-rose-500">إرجاع للمورد ومخصوم</span>
                                </label>
                            </div>
                            <ProductSelect 
                              value={item.productId || ''} 
                              onChange={val => {
                                const newItems = [...orderItems];
                                const product = settings.products.find(p => p.id === val);
                                if (product) {
                                  let updatedItem = {
                                    ...newItems[idx],
                                    productId: val,
                                    name: product.name,
                                    cost: product.costPrice || 0,
                                    profitMode: product.profitMode || 'manual',
                                    profitPercentage: product.profitPercentage || 0,
                                    basePrice: product.basePrice || 0,
                                    commissionPercentage: product.commissionPercentage || 0,
                                    sellingPrice: product.price || 0
                                  };
                                  if (updatedItem.profitMode === 'commission' && (!updatedItem.basePrice || updatedItem.basePrice === 0)) {
                                    const comm = updatedItem.commissionPercentage || 0;
                                    if (comm < 100) {
                                      updatedItem.basePrice = updatedItem.cost / (1 - (comm / 100));
                                      updatedItem.sellingPrice = updatedItem.basePrice;
                                    }
                                  }
                                  newItems[idx] = updatedItem;
                                }
                                setOrderItems(newItems);
                              }} 
                              products={settings.products}
                            />
                            {item.isReturn && item.productId && (
                              <div className="mt-2 flex flex-col gap-1">
                                <label className="text-[9px] font-bold text-slate-500 px-1">سحب المرتجع من مخزن مستقل:</label>
                                <select
                                  value={item.warehouseId || selectedWarehouseId || ''}
                                  onChange={e => {
                                    const newItems = [...orderItems];
                                    newItems[idx].warehouseId = e.target.value;
                                    setOrderItems(newItems);
                                  }}
                                  className="w-full p-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold font-sans h-9 outline-none focus:border-indigo-400 group"
                                  dir="rtl"
                                >
                                  {settings.warehouses?.map((w: any) => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            {item.isReturn && item.productId && (item.warehouseId || selectedWarehouseId) && (
                              <div className="mt-1 text-[9px] font-bold text-slate-500 px-1">
                                {(() => {
                                  let maxQty = 0;
                                  const targetWarehouse = item.warehouseId || selectedWarehouseId;
                                  const prod = settings.products.find(p => p.id === item.productId);
                                  if (prod) {
                                    if (item.variantId && prod.variants) {
                                      const v = prod.variants.find(vx => vx.id === item.variantId);
                                      maxQty = v?.warehouseStock?.[targetWarehouse] || 0;
                                    } else {
                                      maxQty = prod.warehouseStock?.[targetWarehouse] || 0;
                                    }
                                  }
                                  const whName = settings.warehouses?.find((w: any) => w.id === targetWarehouse)?.name || 'المستودع المحدد';
                                  return <span>رصيد {whName} القابل للارتجاع: {maxQty} قطعة</span>;
                                })()}
                              </div>
                            )}
                          </div>

                          <div className="col-span-1 md:col-span-1">
                            <label className="text-[10px] font-bold text-slate-400 mb-1 block text-center">الكمية المطلوبة</label>
                            <input 
                              type="number" 
                              min="1" 
                              value={item.orderedQuantity || item.quantity || ''} 
                              onChange={e => {
                                const newItems = [...orderItems];
                                const val = Number(e.target.value);
                                newItems[idx].orderedQuantity = val;
                                newItems[idx].quantity = val;
                                newItems[idx].receivedQuantity = val;
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
                                newItems[idx] = syncItemPricing(newItems[idx], 'cost', e.target.value);
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

                        {/* Delivery and Stock In Details Drawer */}
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-100/50 dark:bg-slate-900/30 p-3 rounded-xl border border-slate-200/40 dark:border-slate-800/40">
                          <div>
                            <label className="text-[9px] font-black text-slate-400 mb-1 block">الكمية المستلمة فعلياً</label>
                            <input 
                              type="number"
                              min="0"
                              value={item.receivedQuantity !== undefined ? item.receivedQuantity : (item.quantity || 0)}
                              onChange={e => {
                                const newItems = [...orderItems];
                                newItems[idx].receivedQuantity = Number(e.target.value);
                                setOrderItems(newItems);
                              }}
                              className="w-full p-1.5 bg-white dark:bg-slate-800 border border-emerald-100 dark:border-emerald-900/30 rounded-lg text-xs text-center font-black text-emerald-600 dark:text-emerald-400"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-slate-400 mb-1 block">الكمية التالفة / المرفوضة</label>
                            <input 
                              type="number"
                              min="0"
                              value={item.damagedQuantity || 0}
                              onChange={e => {
                                const newItems = [...orderItems];
                                newItems[idx].damagedQuantity = Number(e.target.value);
                                setOrderItems(newItems);
                              }}
                              className="w-full p-1.5 bg-white dark:bg-slate-800 border border-rose-100 dark:border-rose-900/30 rounded-lg text-xs text-center font-black text-rose-600 dark:text-rose-400"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-slate-400 mb-1 block">تاريخ الانتهاء (Expiry)</label>
                            <input 
                              type="date"
                              value={item.expiryDate || ''}
                              onChange={e => {
                                const newItems = [...orderItems];
                                newItems[idx].expiryDate = e.target.value;
                                setOrderItems(newItems);
                              }}
                              className="w-full p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] text-center font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-slate-400 mb-1 block">رقم الدفعة (Batch No.)</label>
                            <input 
                              type="text"
                              placeholder="#"
                              value={item.batchNumber || ''}
                              onChange={e => {
                                const newItems = [...orderItems];
                                newItems[idx].batchNumber = e.target.value;
                                setOrderItems(newItems);
                              }}
                              className="w-full p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] text-center font-bold"
                            />
                          </div>
                        </div>

                        {/* Cost & Calculation Method Configuration Drawer */}
                        {item.productId && (
                          <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50 space-y-3 font-sans select-none" dir="rtl">
                            {!item.isReturn && (
                              <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg">طريقة الحساب للتسعير والربح:</span>
                                  
                                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newItems = [...orderItems];
                                      newItems[idx] = syncItemPricing(newItems[idx], 'profitMode', 'manual');
                                      setOrderItems(newItems);
                                    }}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                      (item.profitMode || 'manual') === 'manual'
                                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow'
                                        : 'text-slate-500'
                                    }`}
                                  >
                                    <Edit2 size={10} />
                                    <span>يدوي</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newItems = [...orderItems];
                                      newItems[idx] = syncItemPricing(newItems[idx], 'profitMode', 'margin');
                                      setOrderItems(newItems);
                                    }}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                      item.profitMode === 'margin'
                                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow'
                                        : 'text-slate-500'
                                    }`}
                                  >
                                    <Percent size={10} />
                                    <span>هامش ربح</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newItems = [...orderItems];
                                      newItems[idx] = syncItemPricing(newItems[idx], 'profitMode', 'commission');
                                      setOrderItems(newItems);
                                    }}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                      item.profitMode === 'commission'
                                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow'
                                        : 'text-slate-500'
                                    }`}
                                  >
                                    <Coins size={10} />
                                    <span>عمولة</span>
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 flex-wrap">
                                  <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">تحديد سعر البيع بالمتجر:</label>
                                    <div className="relative">
                                      <input
                                        type="number"
                                        min="0"
                                        value={item.sellingPrice || ''}
                                        onChange={e => {
                                          const newItems = [...orderItems];
                                          newItems[idx] = syncItemPricing(newItems[idx], 'sellingPrice', e.target.value);
                                          setOrderItems(newItems);
                                        }}
                                        className="w-24 p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-black text-center outline-none"
                                        placeholder="سعر البيع"
                                      />
                                      <span className="absolute left-1.5 top-1.5 text-[9px] text-slate-400 font-bold">ج.م</span>
                                    </div>
                                  </div>

                                {item.profitMode === 'margin' && (
                                  <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">نسبة الربح %:</label>
                                    <div className="relative">
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={item.profitPercentage || ''}
                                        onChange={e => {
                                          const newItems = [...orderItems];
                                          newItems[idx] = syncItemPricing(newItems[idx], 'profitPercentage', e.target.value);
                                          setOrderItems(newItems);
                                        }}
                                        className="w-16 p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-black text-center outline-none"
                                        placeholder="20%"
                                      />
                                    </div>
                                  </div>
                                )}

                                {item.profitMode === 'commission' && (
                                  <div className="flex gap-2.5 items-center flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 font-sans">سعر البيع الأساسي:</label>
                                      <input
                                        type="number"
                                        value={item.basePrice || ''}
                                        onChange={e => {
                                          const newItems = [...orderItems];
                                          newItems[idx] = syncItemPricing(newItems[idx], 'basePrice', e.target.value);
                                          setOrderItems(newItems);
                                        }}
                                        className="w-20 p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-black text-center outline-none"
                                        placeholder="أدخل"
                                      />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 font-sans">العمولة %:</label>
                                      <input
                                        type="number"
                                        value={item.commissionPercentage || ''}
                                        onChange={e => {
                                          const newItems = [...orderItems];
                                          newItems[idx] = syncItemPricing(newItems[idx], 'commissionPercentage', e.target.value);
                                          setOrderItems(newItems);
                                        }}
                                        className="w-16 p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-black text-center outline-none"
                                        placeholder="10%"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            )}

                            {/* Dynamically simulated live comparison badge for cost changes */}
                            {(() => {
                              const itemLiveCost = Number(item.cost || 0);
                              const itemLiveQty = Number(item.orderedQuantity || item.quantity || 0);
                              const itemLiveDiscount = Number(item.discountValue || 0);
                              const itemLiveBonus = Number(item.bonusQuantity || 0);
                              const itemLiveReceived = Number(item.receivedQuantity !== undefined ? item.receivedQuantity : itemLiveQty);
                              const itemLiveTotalUnits = itemLiveReceived + itemLiveBonus;

                              const itemGrossSubtotal = itemLiveCost * itemLiveQty;
                              let itemNetSubtotal = itemGrossSubtotal;
                              if (itemLiveDiscount > 0) {
                                if (item.discountType === 'percentage') {
                                  itemNetSubtotal -= itemGrossSubtotal * (itemLiveDiscount / 100);
                                } else {
                                  itemNetSubtotal -= itemLiveDiscount * itemLiveQty;
                                }
                              }
                              const itemNetUnitCost = itemLiveQty > 0 ? (itemNetSubtotal / itemLiveQty) : itemLiveCost;

                              const currentItemsSubtotal = itemsSubtotal || 0;
                              const currentGrandTotal = grandTotal || 0;
                              const liveFeesFactor = currentItemsSubtotal > 0 ? (currentGrandTotal / currentItemsSubtotal) : 1;

                              // Landed cost is calculated using our exact catalog formula
                              const itemLiveLandedCost = itemLiveTotalUnits > 0 
                                ? (itemNetSubtotal * liveFeesFactor / itemLiveTotalUnits) 
                                : (itemLiveCost * liveFeesFactor);

                              const itemProfitMode = item.profitMode || 'manual';
                              let itemCalculatedSellingPrice = Number(item.sellingPrice || 0);
                              
                              if ((!item.sellingPrice || item.sellingPrice === 0) && itemProfitMode === 'manual') {
                                itemCalculatedSellingPrice = Number(item.cost || 0);
                              } else if ((!item.sellingPrice || item.sellingPrice === 0) && itemProfitMode === 'margin') {
                                const margin = Number(item.profitPercentage || 0);
                                if (margin < 100 && margin >= 0) {
                                  itemCalculatedSellingPrice = itemLiveLandedCost / (1 - (margin / 100));
                                } else {
                                  itemCalculatedSellingPrice = itemLiveLandedCost;
                                }
                              } else if ((!item.sellingPrice || item.sellingPrice === 0) && itemProfitMode === 'commission') {
                                itemCalculatedSellingPrice = Number(item.basePrice || 0);
                              }
                              
                              if (item.isReturn) {
                                return (
                                  <div className="bg-rose-50/50 dark:bg-rose-900/10 p-4 rounded-xl border border-rose-200/50 dark:border-rose-800/30 flex flex-col gap-3 text-xs">
                                     <div className="flex flex-wrap justify-between items-center w-full pb-2 border-b border-rose-200/40 dark:border-rose-800/40">
                                      <span className="text-rose-600 dark:text-rose-400 font-extrabold text-[11px] flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>
                                        هذا الصنف عبارة عن مرتجع (تُخصم قيمته من الفاتورة ويُخصم من المخزون)
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-right">
                                      <div>
                                        <span className="text-slate-400 text-[10px] block mb-0.5 font-bold">قيمة المرتجع للوحدة</span>
                                        <div className="text-slate-700 dark:text-slate-300 font-mono font-black">{itemLiveCost.toFixed(2)} ج.م</div>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 text-[10px] block mb-0.5 font-bold">إجمالي الخصم من الفاتورة</span>
                                        <div className="text-rose-600 dark:text-rose-400 font-mono font-black">
                                          {(itemLiveCost * itemLiveQty).toFixed(2)} ج.م
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div className="bg-slate-100 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/50 dark:border-slate-700/50 flex flex-col gap-3 text-xs">
                                  <div className="flex flex-wrap justify-between items-center w-full pb-2 border-b border-slate-200/40 dark:border-slate-700/40">
                                    <span className="text-slate-500 dark:text-slate-400 font-extrabold text-[11px] flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
                                      تفاصيل احتساب التكلفة والتسعير لهذا الصنف للكتالوج:
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-right">
                                    <div>
                                      <span className="text-slate-400 text-[10px] block mb-0.5 font-bold">شراء الحبة الأساسي</span>
                                      <div className="text-slate-700 dark:text-slate-300 font-mono font-black">{itemLiveCost.toFixed(2)} ج.م</div>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 text-[10px] block mb-0.5 font-bold">الشراء الصافي (بعد بند الخصم)</span>
                                      <div className="text-slate-700 dark:text-slate-300 font-mono font-black">
                                        {itemNetUnitCost.toFixed(2)} ج.m
                                        {itemLiveDiscount > 0 && <span className="text-[9px] text-emerald-500 font-bold block"> (خصم {itemLiveDiscount}{item.discountType === 'percentage' ? '%' : ' ج.م'})</span>}
                                      </div>
                                    </div>
                                    <div className="bg-indigo-50/40 dark:bg-indigo-950/20 p-2 rounded-lg border border-indigo-100/30 dark:border-indigo-900/10">
                                      <span className="text-indigo-600 dark:text-indigo-400 text-[10px] block mb-0.5 font-black">تكلفة الحبة المحمّلة (Landed)</span>
                                      <div className="text-indigo-700 dark:text-indigo-300 font-mono font-black">
                                        {itemLiveLandedCost.toFixed(2)} ج.م
                                        {liveFeesFactor > 1.0001 && <span className="text-[9px] text-slate-400 font-bold block"> (+ {((liveFeesFactor - 1) * 105).toFixed(1)}% مصاريف نقل/ضريبة)</span>}
                                        {itemLiveBonus > 0 && <span className="text-[9px] text-emerald-500 font-bold block"> (مُخفّض بالبونص {itemLiveBonus} قطع)</span>}
                                      </div>
                                    </div>
                                    <div className="bg-amber-50/40 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-100/30 dark:border-amber-900/10">
                                      <span className="text-amber-600 dark:text-amber-400 text-[10px] block mb-0.5 font-black">سعر البيع النهائي بالمتجر</span>
                                      <div className="text-amber-700 dark:text-amber-300 font-mono font-black">
                                        {itemCalculatedSellingPrice.toFixed(2)} ج.م
                                        <span className="text-[9px] text-slate-400 font-bold block">{itemProfitMode === 'margin' ? `(هامش ربح ${item.profitPercentage || 0}%)` : itemProfitMode === 'commission' ? `(نظام عمولة ${item.commissionPercentage || 0}%)` : '(تسعير يدوي)'}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200/40 dark:border-slate-700/40">
                                    <label className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-black cursor-pointer select-none">
                                      <input 
                                        type="checkbox"
                                        checked={item.updateCatalogPrice !== false}
                                        onChange={e => {
                                          const newItems = [...orderItems];
                                          newItems[idx].updateCatalogPrice = e.target.checked;
                                          setOrderItems(newItems);
                                        }}
                                        className="w-3.5 h-3.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-505/20 accent-indigo-600 cursor-pointer"
                                      />
                                      <span>تحديث وتعديل أسعار هذا المنتج ونظام حساب التكلفة الخاص به في الكتالوج العام تلقائياً عند الترحيل</span>
                                    </label>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Total Bottom sticky footer */}
            <div className="p-6 bg-slate-900 dark:bg-black flex flex-col sm:flex-row justify-between items-center gap-5 shrink-0 border-t border-white/5">
              <div className="flex flex-wrap gap-6 text-right select-none">
                <div className="hidden sm:block">
                  <span className="text-slate-500 text-[10px] block mb-0.5">مجموع الأصناف</span>
                  <div className="text-sm font-bold text-white">
                    {itemsSubtotal.toLocaleString()} <span className="text-[10px] opacity-60">ج.م</span>
                  </div>
                </div>
                <div className="hidden sm:block">
                  <span className="text-slate-500 text-[10px] block mb-0.5">الرسوم والضرائب</span>
                  <div className="text-sm font-bold text-indigo-400">
                    {(shippingFees + otherFees + taxAmount).toLocaleString()} <span className="text-[10px] opacity-60">ج.م</span>
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block mb-0.5">صافي إجمالي الفاتورة النهائي</span>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">
                    {totalCost.toLocaleString()} <span className="text-xs sm:text-base font-bold text-white/60">ج.م</span>
                  </div>
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

      {/* Return Products from Purchase Invoice Modal Dialog */}
      {showReturnModal && selectedOrderForReturn && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex flex-col my-8">
            <div className="bg-slate-900 dark:bg-black p-6 text-white flex justify-between items-center select-none shrink-0">
              <div className="text-right">
                <h3 className="text-base font-black flex items-center gap-2">
                  <RotateCw size={18} className="text-amber-500 animate-spin-slow"/>
                  <span>ارتجاع سلع من فاتورة الشراء للمورد</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-1 uppercase font-mono tracking-wider">
                  كود الفاتورة: #{selectedOrderForReturn.referenceNumber || selectedOrderForReturn.id}
                </p>
              </div>
              <button 
                onClick={() => { setShowReturnModal(false); setSelectedOrderForReturn(null); }} 
                className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1.5 hover:bg-white/5 rounded-xl"
              >
                <X size={20}/>
              </button>
            </div>
            
            <div className="p-6 space-y-5 text-right overflow-y-auto max-h-[60vh] custom-scrollbar">
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <div>
                  <span className="text-slate-400 block mb-0.5">اسم المورد:</span>
                  <span className="font-extrabold text-slate-800 dark:text-white block text-sm">
                    {settings.suppliers.find(s => s.id === selectedOrderForReturn.supplierId)?.name || 'مورد عام'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">تاريخ الفاتورة الأصلي:</span>
                  <span className="font-extrabold text-slate-800 dark:text-white block text-sm">
                    {new Date(selectedOrderForReturn.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-black text-slate-500 mb-3 block">المنتجات المسجلة في هذه الفاتورة:</h4>
                <div className="space-y-3.5">
                  {selectedOrderForReturn.items.map((item, idx) => {
                    const key = `${item.productId}_${item.variantId || ''}`;
                    const currentQty = returnQuantities[key] || 0;
                    const alreadyReturned = item.returnedQuantity || 0;
                    const maxAllowed = (item.quantity + (item.bonusQuantity || 0)) - alreadyReturned;
                    const product = settings.products.find(p => p.id === item.productId);

                    const discountAmt = item.discountValue ? (item.discountType === 'percentage' ? (item.cost * item.discountValue / 100) : item.discountValue) : 0;
                    const netCost = item.cost - discountAmt;

                    return (
                      <div 
                        key={idx} 
                        className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-slate-200 dark:hover:border-slate-700 transition-all shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex-shrink-0 overflow-hidden border border-slate-100 dark:border-slate-800 flex items-center justify-center">
                            {product?.thumbnail ? (
                              <img src={product.thumbnail} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : <Package size={18} className="text-slate-400" />}
                          </div>
                          <div>
                            <span className="font-black text-slate-800 dark:text-white text-xs block">{item.name || 'منتج غير معروف'}</span>
                            <div className="text-[10px] text-slate-400 font-bold mt-1 space-y-1 space-x-1.5 space-x-reverse flex flex-wrap items-center">
                              <span>سعر الشراء الأساسي: {item.cost.toLocaleString()} ج.م</span>
                              {discountAmt > 0 && (
                                <>
                                  <span className="text-slate-300">|</span>
                                  <span className="text-emerald-500 font-extrabold text-[9px]">الخصم المطبق: {item.discountValue}{item.discountType === 'percentage' ? '%' : ' ج.م'} (-{discountAmt.toLocaleString()} ج.م)</span>
                                  <span className="text-slate-300">|</span>
                                  <span className="text-amber-600 dark:text-amber-400 font-black">السعر الصافي للمرتجَع: {netCost.toLocaleString()} ج.م</span>
                                </>
                              )}
                              <span className="text-slate-300">|</span>
                              <span>الكمية: {item.quantity} {item.bonusQuantity ? `(+ ${item.bonusQuantity} بونص)` : ''}</span>
                              {alreadyReturned > 0 && (
                                <>
                                  <span className="text-slate-300">|</span>
                                  <span className="text-rose-500">تم إرجاع {alreadyReturned} سابقاً</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Return controller */}
                        <div className="flex items-center gap-3 self-end sm:self-center">
                          {maxAllowed <= 0 ? (
                            <span className="text-[10px] font-black text-rose-500 bg-rose-50 dark:bg-rose-950/20 px-3 py-1.5 rounded-xl border border-rose-100 dark:border-rose-900/10">
                              تم إرجاع الكمية بالكامل
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              {/* Decrement Button */}
                              <button 
                                type="button"
                                onClick={() => {
                                  if (currentQty > 0) {
                                    setReturnQuantities(prev => ({ ...prev, [key]: currentQty - 1 }));
                                  }
                                }}
                                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-white font-bold flex items-center justify-center cursor-pointer transition-colors"
                              >
                                -
                              </button>
                              
                              <input 
                                type="number"
                                value={currentQty || 0}
                                min="0"
                                max={maxAllowed}
                                onChange={e => {
                                  const val = Math.max(0, Math.min(maxAllowed, Number(e.target.value)));
                                  setReturnQuantities(prev => ({ ...prev, [key]: val }));
                                }}
                                className="w-12 h-8 text-center text-xs font-black p-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />

                              {/* Increment Button */}
                              <button 
                                type="button"
                                onClick={() => {
                                  if (currentQty < maxAllowed) {
                                    setReturnQuantities(prev => ({ ...prev, [key]: currentQty + 1 }));
                                  }
                                }}
                                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-white font-bold flex items-center justify-center cursor-pointer transition-colors"
                              >
                                +
                              </button>

                              <span className="text-[10px] text-slate-400 font-bold block whitespace-nowrap self-center mr-1">
                                (المتبق للإرجاع: {maxAllowed})
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Logistics Warehouse & Refund Setup */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-slate-500 mb-1.5 block">المستودع المراد خصم الكميات منه:</label>
                  <select 
                    value={returnWarehouseId} 
                    onChange={e => setReturnWarehouseId(e.target.value)} 
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none dark:text-white text-xs font-bold"
                  >
                    <option value="">-- اختر مستودع صرف المرتجع --</option>
                    {(settings.warehouses || []).map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-500 mb-1.5 block">طريقة رَدّ واسترداد القيمة المالية المرتجعة:</label>
                  <select 
                    value={returnRefundMethod} 
                    onChange={e => setReturnRefundMethod(e.target.value as any)} 
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none dark:text-white text-xs font-bold"
                  >
                    <option value="credit">رصيد المورد (خصم وتقليص مديونية الآجل المستحقة له)</option>
                    <option value="treasury">نقدي (إيداع نقدي فوري لحساب خزينة محددة)</option>
                    <option value="supply_wallet">محفظة التوريد (إيداع رصيد المحفظة السحابية الدائري)</option>
                  </select>
                </div>
              </div>

              {/* Account Dropdown if Treasury is selected */}
              {returnRefundMethod === 'treasury' && (
                <div className="animate-in slide-in-from-top-1 duration-200">
                  <label className="text-xs font-black text-blue-600 dark:text-blue-400 mb-1.5 block">حساب الخزينة المستلم لدفعة المرتجع:</label>
                  <select 
                    value={returnTreasuryAccountId} 
                    onChange={e => setReturnTreasuryAccountId(e.target.value)} 
                    className="w-full p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl outline-none dark:text-white text-xs font-bold"
                  >
                    <option value="">-- اختر حساب الخزينة المنفذ للإيداع --</option>
                    {(treasury?.accounts || []).map((acc: any) => (
                      <option key={acc.id} value={acc.id}>{acc.name} ({acc.balance.toLocaleString()} ج.م)</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Total calculations */}
              <div className="bg-amber-50/50 dark:bg-amber-950/20 p-4 rounded-[1.8rem] border border-amber-100/50 dark:border-amber-900/30 flex justify-between items-center select-none">
                <div>
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400 block mb-1">إجمالي قيمة المستردات المالية:</span>
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-500 tracking-tight block">
                    {selectedOrderForReturn.items.reduce((sum, item) => {
                      const key = `${item.productId}_${item.variantId || ''}`;
                      const qty = returnQuantities[key] || 0;
                      const discountAmt = item.discountValue ? (item.discountType === 'percentage' ? (item.cost * item.discountValue / 100) : item.discountValue) : 0;
                      const netCost = item.cost - discountAmt;
                      return sum + (qty * netCost);
                    }, 0).toLocaleString()} <span className="text-xs font-bold text-slate-500">ج.م</span>
                  </span>
                </div>
                <div className="text-left text-[10px] text-slate-400 font-bold">
                  <div>
                    عدد الأصناف المرتجعة: {selectedOrderForReturn.items.reduce((sum, item) => sum + (returnQuantities[`${item.productId}_${item.variantId || ''}`] ? 1 : 0), 0)} أصناف
                  </div>
                  <div className="mt-0.5">
                    إجمالي الوحدات: {selectedOrderForReturn.items.reduce((sum, item) => sum + (returnQuantities[`${item.productId}_${item.variantId || ''}`] || 0), 0)} قطعة
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-900 dark:bg-black flex gap-3 shrink-0 border-t border-white/5 select-none">
              <button 
                type="button"
                onClick={() => { setShowReturnModal(false); setSelectedOrderForReturn(null); }} 
                className="flex-1 py-3.5 text-slate-400 hover:text-white font-bold transition-all text-xs cursor-pointer text-center"
              >
                إلغاء المرتجع
              </button>
              <button 
                type="button"
                onClick={handleConfirmReturn} 
                className="flex-1 py-3.5 bg-amber-500 text-slate-900 rounded-xl font-black shadow-lg shadow-amber-500/10 hover:bg-amber-600 hover:text-white transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
              >
                <Check size={16}/>
                <span>تأكيد الإرجاع واسترداد القيمة</span>
              </button>
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

      {/* Custom Alarm / Prompt Sound Alert Modal */}
      <AnimatePresence>
        {modal && modal.show && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!modal.isConfirm) setModal(prev => ({ ...prev, show: false }));
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            
            {/* Alarm Dialog Card */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden text-right font-sans"
            >
              {/* Sound Ring Pulse Decorator with Premium Adaptive Gradient */}
              <div className={`absolute top-0 right-0 left-0 h-2 bg-gradient-to-r ${
                modal.type === 'success' ? 'from-emerald-400 via-teal-500 to-indigo-500' :
                modal.type === 'error' ? 'from-rose-400 via-red-500 to-amber-500' :
                modal.type === 'warning' ? 'from-amber-400 via-orange-500 to-red-500' :
                'from-sky-400 via-blue-500 to-indigo-500'
              }`} />
              
              <div className="flex flex-col items-center text-center mt-3">
                {/* Visual Icon based on Alarm TYPE */}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-lg ${
                  modal.type === 'success' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' :
                  modal.type === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400' :
                  modal.type === 'warning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 font-bold' :
                  'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                }`}>
                  {modal.type === 'success' && <CheckCircle2 size={32} />}
                  {modal.type === 'error' && <AlertCircle size={32} />}
                  {modal.type === 'warning' && <AlertCircle size={32} />}
                  {modal.type === 'info' && <Info size={32} />}
                </div>

                {/* Alarm Ringing Animation Indicator with Custom Sprung Bell */}
                <div className="flex items-center gap-1.5 mb-2 px-3.5 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800/60 text-[10.5px] text-slate-500 dark:text-slate-400 font-black tracking-wider border border-slate-100 dark:border-slate-800 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
                  <span>تنبيه داخلي نشط</span>
                  <motion.span
                    animate={{ rotate: [0, -18, 15, -12, 10, -5, 0] }}
                    transition={{
                      repeat: Infinity,
                      repeatDelay: 1.2,
                      duration: 0.85,
                      type: "tween",
                      ease: "easeInOut"
                    }}
                    className="inline-block origin-top"
                  >
                    🔔
                  </motion.span>
                </div>

                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1 leading-tight">
                  {modal.title}
                </h3>
                
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-3 leading-relaxed whitespace-pre-line text-center px-2">
                  {modal.message}
                </p>
              </div>

              {/* Confirm / Cancel Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    const onConf = modal.onConfirm;
                    setModal(prev => ({ ...prev, show: false }));
                    if (onConf) onConf();
                  }}
                  className={`flex-1 px-5 py-3 rounded-2xl text-xs font-black text-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md cursor-pointer ${
                    modal.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10' :
                    modal.type === 'error' ? 'bg-red-600 hover:bg-red-700 shadow-red-500/10' :
                    modal.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/10' :
                    'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/10'
                  }`}
                >
                  {modal.buttonText}
                </button>
                
                {modal.isConfirm && (
                  <button
                    onClick={() => setModal(prev => ({ ...prev, show: false }))}
                    className="flex-1 px-5 py-3 rounded-2xl text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 cursor-pointer"
                  >
                    إلغاء
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SuppliersPage;