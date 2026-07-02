import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Filter, 
  Wrench, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronLeft,
  ChevronRight,
  User,
  Phone,
  Package,
  Calendar,
  MoreVertical,
  Edit2,
  Trash2,
  ExternalLink,
  Settings as SettingsIcon,
  DollarSign,
  TrendingUp,
  Inbox,
  ClipboardList,
  Truck,
  Printer,
  FileText,
  BadgeAlert,
  ArrowLeft,
  Coins,
  Cpu,
  Bookmark,
  CheckCircle,
  HelpCircle,
  Info
} from 'lucide-react';
import { db } from '../../services/firebaseClient';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  where,
  orderBy 
} from 'firebase/firestore';
import { MaintenanceRequest } from '../../types';
import MaintenanceForm from '../../components/maintenance/MaintenanceForm';
import { ConfirmationModal } from '../../components/ConfirmationModal';

interface MaintenancePageProps {
  currentStoreId: string;
  settings: any;
  setSettings?: (updater: any) => void;
  customers?: any[];
  setCustomers?: (updater: any) => void;
  products?: any[];
  treasury?: any;
  setTreasury?: (updater: any) => void;
  setOrders?: (updater: any) => void;
}

const MaintenancePage: React.FC<MaintenancePageProps> = ({ 
  currentStoreId, 
  settings, 
  setSettings,
  customers = [], 
  setCustomers,
  products = [], 
  treasury, 
  setTreasury,
  setOrders
}) => {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<MaintenanceRequest | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Custom toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Voucher print state
  const [printVoucherData, setPrintVoucherData] = useState<MaintenanceRequest | null>(null);

  // Show Toast helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  useEffect(() => {
    if (!currentStoreId) return;

    const q = query(
      collection(db, 'maintenance_requests'),
      where('storeId', '==', currentStoreId),
      orderBy('receivedDate', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MaintenanceRequest[];
      setRequests(data);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching maintenance requests:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentStoreId]);

  const stats = useMemo(() => {
    const total = requests.length;
    const active = requests.filter(r => !['delivered', 'cancelled'].includes(r.status)).length;
    const ready = requests.filter(r => r.status === 'ready').length;
    const totalRevenue = requests.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    const completedRevenue = requests
      .filter(r => r.status === 'delivered')
      .reduce((sum, r) => sum + (r.totalCost || 0), 0);
    
    return { total, active, ready, totalRevenue, completedRevenue };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesSearch = 
        r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.customerPhone.includes(searchTerm) ||
        r.itemDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.orderNumber && r.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = 
        statusFilter === 'all' ? true :
        statusFilter === 'active_only' ? !['delivered', 'cancelled'].includes(r.status) :
        r.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [requests, searchTerm, statusFilter]);

  // Order of statuses for quick progression
  const statusWorkflow = ['received', 'inspecting', 'waiting_for_parts', 'in_repair', 'ready', 'delivered'];

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'received': return { label: 'تم إنشاء طلب', color: 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700', icon: <Inbox size={14} />, desc: 'تم استلام الجهاز وجارٍ جدولته' };
      case 'inspecting': return { label: 'قيد الفحص والتشخيص', color: 'bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/40', icon: <Search size={14} />, desc: 'يقوم المهندس بفحص الأعطال والقطع' };
      case 'waiting_for_parts': return { label: 'انتظار قطع غيار', color: 'bg-amber-50 text-amber-650 border border-amber-100 dark:bg-amber-950/20 dark:text-amber-450 dark:border-amber-900/30', icon: <SettingsIcon size={14} />, desc: 'تم طلب قطع الغيار وجارٍ انتظار وصولها' };
      case 'in_repair': return { label: 'قيد الإصلاح الفعلي', color: 'bg-indigo-50 text-indigo-600 border border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-450 dark:border-indigo-900/30', icon: <Wrench size={14} />, desc: 'تجري عمليات اللحام والصيانة الآن' };
      case 'ready': return { label: 'جاهز للاستلام', color: 'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900/30', icon: <CheckCircle2 size={14} />, desc: 'تم الإصلاح بنجاح، بانتظار العميل' };
      case 'delivered': return { label: 'تم التسليم والتحصيل', color: 'bg-emerald-600 text-white shadow-md shadow-emerald-500/10', icon: <Package size={14} />, desc: 'تم تسليم الجهاز للعميل وتحصيل الفاتورة' };
      case 'cancelled': return { label: 'طلب ملغي', color: 'bg-red-50 text-red-600 border border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30', icon: <AlertCircle size={14} />, desc: 'تم إلغاء الطلب وإرجاع الجهاز للعميل' };
      default: return { label: status, color: 'bg-slate-100', icon: null, desc: '' };
    }
  };

  const getNextStepInfo = (status: string) => {
    switch (status) {
      case 'received':
        return { label: 'بدء الفحص والتشخيص', nextStatus: 'inspecting', color: 'bg-blue-600 hover:bg-blue-700 text-white' };
      case 'inspecting':
        return { label: 'تحويل إلى قيد الإصلاح', nextStatus: 'in_repair', color: 'bg-indigo-600 hover:bg-indigo-700 text-white' };
      case 'waiting_for_parts':
        return { label: 'وصول القطع وبدء الإصلاح', nextStatus: 'in_repair', color: 'bg-indigo-600 hover:bg-indigo-700 text-white' };
      case 'in_repair':
        return { label: 'إنهاء الإصلاح وتجهيز الجهاز', nextStatus: 'ready', color: 'bg-emerald-600 hover:bg-emerald-700 text-white' };
      case 'ready':
        return { label: 'تسليم العميل وتحصيل الفاتورة', nextStatus: 'delivered', color: 'bg-emerald-700 hover:bg-emerald-800 text-white' };
      default:
        return null;
    }
  };

  const rollbackRequestFinancials = (request: MaintenanceRequest) => {
    const orderNumber = request.orderNumber;
    
    // A. Return Stock (if stockDeducted was true)
    if (request.stockDeducted && setSettings && settings?.products) {
      const updatedProducts = (settings.products || []).map((prod: any) => {
        const matchedPart = (request.parts || []).find((part: any) => part.productId === prod.id || part.name === prod.name);
        if (matchedPart) {
          const currentStock = prod.stockQuantity !== null && prod.stockQuantity !== undefined ? Number(prod.stockQuantity) : null;
          if (currentStock !== null) {
            const returnQty = Number(matchedPart.quantity || 1);
            const newQty = currentStock + returnQty;
            return {
              ...prod,
              stockQuantity: newQty,
              stock: newQty,
              inStock: newQty > 0
            };
          }
        }
        return prod;
      });
      setSettings((prev: any) => ({
        ...prev,
        products: updatedProducts
      }));
    }

    // B. Remove Companion Orders (including regular companion and waybill companion)
    if (setOrders) {
      setOrders((prev: any[]) => {
        return prev.filter(o => 
          o.id !== `order-mnt-${orderNumber}` && 
          o.orderNumber !== `MNT-${orderNumber}` && 
          o.id !== `order-mnt-ship-${request.id}` &&
          o.orderNumber !== `MNT-SHIP-${orderNumber}` &&
          o.maintenanceRequestId !== request.id
        );
      });
    }

    // C. Revert Treasury Transactions & Balance
    if (setTreasury && treasury?.transactions) {
      setTreasury((prev: any) => {
        if (!prev) return prev;
        let updatedAccounts = [...(prev.accounts || [])];
        
        // Find all transactions containing `#${orderNumber}` in description
        const txsToDelete = (prev.transactions || []).filter((tx: any) => 
          tx.description && (tx.description.includes(`#${orderNumber}`) || tx.description.includes(`الطلب #${orderNumber}`))
        );
        const txIdsToDelete = txsToDelete.map((tx: any) => tx.id);

        txsToDelete.forEach((tx: any) => {
          const amount = Number(tx.amount || 0);

          // Revert impact on fromAccountId (add back the amount that was spent)
          if (tx.fromAccountId) {
            updatedAccounts = updatedAccounts.map((acc: any) => 
              acc.id === tx.fromAccountId ? { ...acc, balance: Number(acc.balance || 0) + amount } : acc
            );
          }

          // Revert impact on toAccountId (subtract the amount that was received)
          if (tx.toAccountId) {
            updatedAccounts = updatedAccounts.map((acc: any) => 
              acc.id === tx.toAccountId ? { ...acc, balance: Number(acc.balance || 0) - amount } : acc
            );
          }
        });

        return {
          ...prev,
          accounts: updatedAccounts,
          transactions: (prev.transactions || []).filter((tx: any) => !txIdsToDelete.includes(tx.id))
        };
      });
    }

    // D. Revert Payroll Transactions (Technician commission/incentives)
    if (setSettings && settings?.payrollTransactions) {
      setSettings((prev: any) => {
        if (!prev) return prev;
        const currentTx = prev.payrollTransactions || [];
        const filteredTx = currentTx.filter((tx: any) => 
          !(tx.note && (tx.note.includes(`#${orderNumber}`) || tx.note.includes(`الطلب #${orderNumber}`)))
        );
        return {
          ...prev,
          payrollTransactions: filteredTx
        };
      });
    }

    // E. Revert Customer Debt
    let debtToRollback = 0;
    if (request.paymentMethod === 'add_to_debt') {
      debtToRollback = Number(request.totalCost || 0);
    } else if (request.shippingPaymentMethod === 'add_to_debt') {
      debtToRollback = Number(request.shippingCostToCustomer || 0);
    }

    if (debtToRollback > 0 && setCustomers && request.customerPhone) {
      setCustomers((prev: any[]) => {
        return prev.map((c: any) => {
          if (c.phone === request.customerPhone || c.name === request.customerName) {
            const currentDebt = Number(c.debtBalance || 0);
            return { ...c, debtBalance: Math.max(0, currentDebt - debtToRollback) };
          }
          return c;
        });
      });
    }
  };

  // Quick transition helper to advance status without opening full modal form
  const handleQuickStatusTransition = async (request: MaintenanceRequest, nextStatus: string) => {
    try {
      // If advancing to "ready" or "delivered", we require financial logger checks.
      // To keep it seamless, if financialLogged is already true or they aren't ready/delivered, we just update Firestore.
      // If they transition to "ready" or "delivered" and it was never logged, we'll auto-log it with first treasury account & generate companion order to keep financials 100% correct and automated!
      const isReadyOrDelivered = nextStatus === 'ready' || nextStatus === 'delivered';
      const wasLogged = request.financialLogged || false;
      const dataToSave: any = { status: nextStatus };

      if (wasLogged && !isReadyOrDelivered) {
        // Rollback financial logging because the status was reverted/cancelled!
        rollbackRequestFinancials(request);
        dataToSave.financialLogged = false;
        dataToSave.stockDeducted = false;
      }

      if (isReadyOrDelivered && !wasLogged) {
        dataToSave.financialLogged = true;
        
        const totalToCollect = Number(request.totalCost || 0);
        const shopShippingCost = Number(request.shippingCostToShop || 0);
        const customerShippingCost = Number(request.shippingCostToCustomer || 0);
        const paymentMethod = request.paymentMethod || 'cash';
        const shippingPaymentMethod = request.shippingPaymentMethod || 'cash';
        const targetAccountId = request.treasuryAccountId || (treasury?.accounts?.[0]?.id || '1');
        const orderNumber = request.orderNumber || `MNT-${Math.floor(1000 + Math.random() * 9000)}`;

        let debtToAdd = 0;
        let cashToDeposit = 0;

        if (paymentMethod === 'add_to_debt') {
          debtToAdd = totalToCollect;
        } else {
          if (shippingPaymentMethod === 'add_to_debt') {
            debtToAdd = customerShippingCost;
            cashToDeposit = totalToCollect - customerShippingCost;
          } else {
            cashToDeposit = totalToCollect;
          }
        }

        // A. Handle Customer Payment / Debt
        if (debtToAdd > 0) {
          if (setCustomers && request.customerPhone) {
            setCustomers((prev: any[]) => {
              return prev.map(c => {
                if (c.phone === request.customerPhone || c.name === request.customerName) {
                  const currentDebt = Number(c.debtBalance || 0);
                  return { ...c, debtBalance: currentDebt + debtToAdd };
                }
                return c;
              });
            });
          }
        }

        if (cashToDeposit > 0) {
          // Direct payment into selected Treasury account
          if (setTreasury) {
            const depositTxId = `tx-mnt-deposit-${Date.now()}`;
            const depositTx = {
              id: depositTxId,
              date: new Date().toISOString(),
              type: 'deposit',
              amount: cashToDeposit,
              description: `تحصيل فاتورة صيانة طلب رقم #${orderNumber} للعميل: ${request.customerName || 'عام'}${debtToAdd > 0 ? ' (تم ترحيل الشحن كدين آجل)' : ''}`,
              toAccountId: targetAccountId
            };

            setTreasury((prev: any) => {
              if (!prev) return prev;
              const currentAccounts = prev.accounts || [];
              const updatedAccounts = currentAccounts.map((acc: any) => 
                acc.id === targetAccountId ? { ...acc, balance: Number(acc.balance || 0) + cashToDeposit } : acc
              );
              return {
                ...prev,
                accounts: updatedAccounts,
                transactions: [depositTx, ...(prev.transactions || [])]
              };
            });
          }
        }

        // B. Handle Deducting Expenses (Only Shipping Cost to Shop is deducted because labor/parts cost are already paid/accounted or pure revenue)
        if (setTreasury && shopShippingCost > 0 && paymentMethod !== 'add_to_debt') {
          const shipTxId = `tx-mnt-ship-${Date.now()}`;
          const shipTx = {
            id: shipTxId,
            date: new Date().toISOString(),
            type: 'withdrawal',
            amount: shopShippingCost,
            description: `تكلفة شحن الصيانة للمحل للطلب #${orderNumber} (${request.shippingCompany || ''})`,
            fromAccountId: targetAccountId
          };

          setTreasury((prev: any) => {
            if (!prev) return prev;
            const currentAccounts = prev.accounts || [];
            const updatedAccounts = currentAccounts.map((acc: any) => 
              acc.id === targetAccountId ? { ...acc, balance: Math.max(0, Number(acc.balance || 0) - shopShippingCost) } : acc
            );
            return {
              ...prev,
              accounts: updatedAccounts,
              transactions: [shipTx, ...(prev.transactions || [])]
            };
          });
        }

        // C. Technician Commission
        let commissionAmount = 0;
        const commType = request.commissionType || 'fixed';
        const commVal = Number(request.commissionValue !== undefined ? request.commissionValue : (request.laborCost || 0));

        if (commType === 'percentage') {
          commissionAmount = (Number(request.totalCost || 0) * commVal) / 100;
        } else {
          commissionAmount = commVal;
        }

        if (commissionAmount > 0 && request.technicianName) {
          const staffList = settings?.staffMembers || [];
          const matchedStaff = staffList.find((s: any) => s.name?.trim().toLowerCase() === request.technicianName?.trim().toLowerCase());
          const staffId = matchedStaff?.id || `staff-temp-${Date.now()}`;
          const staffName = matchedStaff?.name || request.technicianName || 'فني عام';

          const payrollTx = {
            id: `tx-mnt-comm-${Date.now()}`,
            staffId,
            staffName,
            type: 'incentive',
            amount: commissionAmount,
            date: new Date().toISOString().split('T')[0],
            note: `عمولة صيانة للطلب #${orderNumber} (${request.itemDescription || 'جهاز'})`
          };

          if (setSettings) {
            setSettings((prev: any) => {
              const currentTx = prev.payrollTransactions || [];
              return {
                ...prev,
                payrollTransactions: [payrollTx, ...currentTx]
              };
            });
          }
        }

        // D. Create Companion Order for Sales
        if (setOrders) {
          const partsCost = (request.parts || []).reduce((sum, p) => sum + Number(p.cost || 0), 0);
          const labor = Number(request.laborCost || 0);

          const newMntOrder = {
            id: `order-mnt-${orderNumber}`,
            orderNumber: `MNT-${orderNumber}`,
            customerName: request.customerName || 'عميل صيانة',
            customerPhone: request.customerPhone || '',
            customerAddress: request.customerAddress || '',
            governorate: request.governorate || '',
            city: request.city || '',
            orderType: 'maintenance',
            maintenanceRequestId: request.id,
            items: [
              {
                id: 'mnt-service',
                name: `خدمة صيانة: ${request.itemDescription || 'جهاز'}`,
                price: totalToCollect,
                quantity: 1,
                costPrice: partsCost + labor
              }
            ],
            shippingFee: request.shippingCostToCustomer || 0,
            totalAmount: totalToCollect + (request.shippingCostToCustomer || 0),
            status: 'delivered',
            paymentMethod: request.paymentMethod || 'cash',
            isCod: false,
            createdAt: new Date().toISOString(),
            storeId: currentStoreId
          };

          setOrders((prev: any[]) => {
            if (prev.some(o => o.id === newMntOrder.id)) return prev;
            return [newMntOrder, ...prev];
          });
        }
      }

      await updateDoc(doc(db, 'maintenance_requests', request.id), {
        ...dataToSave,
        updatedAt: new Date().toISOString()
      });

      showToast(`تم تحديث حالة الطلب إلى "${getStatusInfo(nextStatus).label}" بنجاح وتسوية الحسابات.`);
    } catch (error) {
      console.error('Error updating status quick transition:', error);
      showToast('حدث خطأ أثناء تحديث حالة الطلب', 'error');
    }
  };

  const handleSave = async (data: Partial<MaintenanceRequest>) => {
    try {
      const orderNumber = editingRequest?.orderNumber || `MNT-${Math.floor(1000 + Math.random() * 9000)}`;
      const isReadyOrDelivered = data.status === 'ready' || data.status === 'delivered';
      let wasLogged = editingRequest?.financialLogged || false;
      
      let finalData = { ...data };

      // Rollback logic for status changes or edits
      if (wasLogged && !isReadyOrDelivered && editingRequest) {
        // Status reverted/cancelled: rollback all financials
        rollbackRequestFinancials(editingRequest);
        finalData.financialLogged = false;
        finalData.stockDeducted = false;
        wasLogged = false;
        if (editingRequest) {
          editingRequest.financialLogged = false;
          editingRequest.stockDeducted = false;
        }
      } else if (wasLogged && isReadyOrDelivered && editingRequest) {
        // Still ready/delivered but details could have changed: rollback old and re-log fresh
        rollbackRequestFinancials(editingRequest);
        finalData.financialLogged = false;
        finalData.stockDeducted = false;
        wasLogged = false;
        if (editingRequest) {
          editingRequest.financialLogged = false;
          editingRequest.stockDeducted = false;
        }
      }

      // 1. Inventory Stock Deduction (الربط مع جرد المخازن)
      if (['in_repair', 'ready', 'delivered'].includes(data.status || '') && !editingRequest?.stockDeducted && setSettings && settings?.products) {
        const updatedProducts = (settings.products || []).map((prod: any) => {
          const matchedPart = (data.parts || []).find((part: any) => part.productId === prod.id || part.name === prod.name);
          if (matchedPart) {
            const currentStock = prod.stockQuantity !== null && prod.stockQuantity !== undefined ? Number(prod.stockQuantity) : null;
            if (currentStock !== null) {
              const deductQty = Number(matchedPart.quantity || 1);
              const newQty = Math.max(0, currentStock - deductQty);
              return {
                ...prod,
                stockQuantity: newQty,
                stock: newQty,
                inStock: newQty > 0
              };
            }
          }
          return prod;
        });

        setSettings((prev: any) => ({
          ...prev,
          products: updatedProducts
        }));
        
        finalData.stockDeducted = true;
      }

      // 2. Financial Logging & Companion Order creation when marking as ready or delivered
      if (isReadyOrDelivered && !wasLogged) {
        finalData.financialLogged = true;
        
        const totalToCollect = Number(data.totalCost || 0);
        const shopShippingCost = Number(data.shippingCostToShop || 0);
        const customerShippingCost = Number(data.shippingCostToCustomer || 0);
        const paymentMethod = data.paymentMethod || 'cash';
        const shippingPaymentMethod = data.shippingPaymentMethod || 'cash';
        const targetAccountId = data.treasuryAccountId || (treasury?.accounts?.[0]?.id || '1');

        let debtToAdd = 0;
        let cashToDeposit = 0;

        if (paymentMethod === 'add_to_debt') {
          debtToAdd = totalToCollect;
        } else {
          if (shippingPaymentMethod === 'add_to_debt') {
            debtToAdd = customerShippingCost;
            cashToDeposit = totalToCollect - customerShippingCost;
          } else {
            cashToDeposit = totalToCollect;
          }
        }

        // A. Handle Customer Payment / Debt
        if (debtToAdd > 0) {
          if (setCustomers && data.customerPhone) {
            setCustomers((prev: any[]) => {
              return prev.map(c => {
                if (c.phone === data.customerPhone || c.name === data.customerName) {
                  const currentDebt = Number(c.debtBalance || 0);
                  return { ...c, debtBalance: currentDebt + debtToAdd };
                }
                return c;
              });
            });
          }
        }

        if (cashToDeposit > 0) {
          // Direct payment into selected Treasury account
          if (setTreasury) {
            const depositTxId = `tx-mnt-deposit-${Date.now()}`;
            const depositTx = {
              id: depositTxId,
              date: new Date().toISOString(),
              type: 'deposit',
              amount: cashToDeposit,
              description: `تحصيل فاتورة صيانة طلب رقم #${orderNumber} للعميل: ${data.customerName || 'عام'}${debtToAdd > 0 ? ' (تم ترحيل الشحن كدين آجل)' : ''}`,
              toAccountId: targetAccountId
            };

            setTreasury((prev: any) => {
              if (!prev) return prev;
              const currentAccounts = prev.accounts || [];
              const updatedAccounts = currentAccounts.map((acc: any) => 
                acc.id === targetAccountId ? { ...acc, balance: Number(acc.balance || 0) + cashToDeposit } : acc
              );
              return {
                ...prev,
                accounts: updatedAccounts,
                transactions: [depositTx, ...(prev.transactions || [])]
              };
            });
          }
        }

        // B. Handle Deducting Expenses (Only Shipping Cost to Shop is deducted because labor/parts cost are already paid/accounted or pure revenue)
        if (setTreasury && shopShippingCost > 0 && paymentMethod !== 'add_to_debt') {
          const shipTxId = `tx-mnt-ship-${Date.now()}`;
          const shipTx = {
            id: shipTxId,
            date: new Date().toISOString(),
            type: 'withdrawal',
            amount: shopShippingCost,
            description: `تكلفة شحن الصيانة للمحل للطلب #${orderNumber} (${data.shippingCompany || ''})`,
            fromAccountId: targetAccountId
          };

          setTreasury((prev: any) => {
            if (!prev) return prev;
            const currentAccounts = prev.accounts || [];
            const updatedAccounts = currentAccounts.map((acc: any) => 
              acc.id === targetAccountId ? { ...acc, balance: Math.max(0, Number(acc.balance || 0) - shopShippingCost) } : acc
            );
            return {
              ...prev,
              accounts: updatedAccounts,
              transactions: [shipTx, ...(prev.transactions || [])]
            };
          });
        }

        // C. Technician Commission & Payroll Integration (عمولات الفنيين ورواتبهم)
        let commissionAmount = 0;
        const commType = data.commissionType || 'fixed';
        const commVal = Number(data.commissionValue !== undefined ? data.commissionValue : (data.laborCost || 0));

        if (commType === 'percentage') {
          commissionAmount = (Number(data.totalCost || 0) * commVal) / 100;
        } else {
          commissionAmount = commVal;
        }

        if (commissionAmount > 0 && data.technicianName) {
          const staffList = settings?.staffMembers || [];
          const matchedStaff = staffList.find((s: any) => s.name?.trim().toLowerCase() === data.technicianName?.trim().toLowerCase());
          const staffId = matchedStaff?.id || `staff-temp-${Date.now()}`;
          const staffName = matchedStaff?.name || data.technicianName || 'فني عام';

          const payrollTx = {
            id: `tx-mnt-comm-${Date.now()}`,
            staffId,
            staffName,
            type: 'incentive',
            amount: commissionAmount,
            date: new Date().toISOString().split('T')[0],
            note: `عمولة صيانة للطلب #${orderNumber} (${data.itemDescription || 'جهاز'})`
          };

          if (setSettings) {
            setSettings((prev: any) => {
              const currentTx = prev.payrollTransactions || [];
              return {
                ...prev,
                payrollTransactions: [payrollTx, ...currentTx]
              };
            });
          }
        }

        // D. Create Companion Order for Sales Reports & Analytics (فواتير المبيعات الخدمية)
        if (setOrders) {
          const partsCost = (data.parts || []).reduce((sum, p) => sum + Number(p.cost || 0), 0);
          const labor = Number(data.laborCost || 0);

          const newMntOrder = {
            id: `order-mnt-${orderNumber}`,
            orderNumber: `MNT-${orderNumber}`,
            customerName: data.customerName || 'عميل صيانة',
            customerPhone: data.customerPhone || '',
            customerAddress: data.customerAddress || '',
            governorate: data.governorate || '',
            city: data.city || '',
            orderType: 'maintenance',
            maintenanceRequestId: editingRequest?.id || orderNumber,
            items: [
              {
                id: 'mnt-service',
                name: `خدمة صيانة: ${data.itemDescription || 'جهاز'}`,
                price: totalToCollect,
                quantity: 1,
                costPrice: partsCost + labor
              }
            ],
            shippingFee: data.shippingCostToCustomer || 0,
            totalAmount: totalToCollect + (data.shippingCostToCustomer || 0),
            status: 'delivered', // Delivered matches completed sale for charts
            paymentMethod: data.paymentMethod || 'cash',
            isCod: false,
            createdAt: new Date().toISOString(),
            storeId: currentStoreId
          };

          setOrders((prev: any[]) => {
            if (prev.some(o => o.id === newMntOrder.id)) return prev;
            return [newMntOrder, ...prev];
          });
        }
      }

      if (editingRequest?.id) {
        await updateDoc(doc(db, 'maintenance_requests', editingRequest.id), {
          ...finalData,
          updatedAt: new Date().toISOString()
        });
        showToast('تم تحديث بيانات الصيانة والتسويات المالية بنجاح.');
      } else {
        await addDoc(collection(db, 'maintenance_requests'), {
          ...finalData,
          storeId: currentStoreId,
          orderNumber,
          createdAt: new Date().toISOString(),
          receivedDate: data.receivedDate || new Date().toISOString().split('T')[0]
        });
        showToast('تم فتح وتسجيل طلب صيانة جديد بنجاح.');
      }
      setIsFormOpen(false);
      setEditingRequest(null);
    } catch (error) {
      console.error('Error saving maintenance request:', error);
      showToast('حدث خطأ غير متوقع أثناء الحفظ والمزامنة المالية', 'error');
    }
  };

  const handleConvertToWaybill = async (request: MaintenanceRequest) => {
    try {
      if (request.waybillOrderId) {
        showToast('تم إنشاء بوليصة شحن بالفعل لهذا الطلب', 'info');
        return;
      }

      const companionOrderId = `order-mnt-ship-${request.id}`;
      const totalToCollect = Number(request.totalCost || 0) + Number(request.shippingCostToCustomer || request.shippingFee || 0);

      const companionOrder = {
        id: companionOrderId,
        orderNumber: `MNT-SHIP-${request.orderNumber}`,
        customerName: request.customerName,
        customerPhone: request.customerPhone,
        customerAddress: request.customerAddress || '',
        governorate: request.governorate || '',
        city: request.city || '',
        orderType: 'maintenance',
        maintenanceRequestId: request.id,
        items: [
          {
            id: 'mnt-service',
            name: `خدمة صيانة (توصيل): ${request.itemDescription}`,
            price: request.totalCost,
            quantity: 1,
            costPrice: (request.parts?.reduce((sum, p) => sum + Number(p.cost || 0), 0) || 0) + (request.laborCost || 0)
          }
        ],
        shippingFee: request.shippingCostToCustomer || request.shippingFee || 0,
        totalAmount: totalToCollect,
        status: 'pending',
        paymentMethod: request.paymentMethod || 'cash',
        isCod: true,
        codAmount: totalToCollect,
        createdAt: new Date().toISOString(),
        storeId: currentStoreId,
        shippingCompany: request.shippingCompany || '',
        shippingTrackingNumber: request.shippingTrackingNumber || ''
      };

      if (setOrders) {
        setOrders((prev: any[]) => {
          if (prev.some(o => o.id === companionOrderId)) return prev;
          return [companionOrder, ...prev];
        });
      }

      await updateDoc(doc(db, 'maintenance_requests', request.id), {
        waybillOrderId: companionOrderId,
        shippingStatus: 'pickup_requested',
        status: 'ready_for_shipping',
        updatedAt: new Date().toISOString()
      });

      showToast('تم إنشاء بوليصة شحن الصيانة وتسجيلها بنجاح!');
    } catch (error) {
      console.error('Error converting to waybill:', error);
      showToast('حدث خطأ أثناء إعداد بوليصة شحن الصيانة', 'error');
    }
  };

  const performDelete = async () => {
    if (!deleteId) return;
    try {
      const requestToDelete = requests.find(r => r.id === deleteId);
      if (requestToDelete) {
        rollbackRequestFinancials(requestToDelete);
      }
      await deleteDoc(doc(db, 'maintenance_requests', deleteId));
      showToast('تم حذف طلب الصيانة وسجلاته المعلقة نهائياً وتصفية كافة الحركات المالية والمبيعات المرتبطة به.');
    } catch (error) {
      console.error('Error deleting request:', error);
      showToast('خطأ أثناء حذف الطلب', 'error');
    }
    setDeleteId(null);
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-screen text-right" dir="rtl">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[150] px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 border ${
              toast.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-250 dark:bg-emerald-950 dark:text-emerald-200' 
                : toast.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border-rose-250 dark:bg-rose-950 dark:text-rose-200'
                  : 'bg-indigo-50 text-indigo-850 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-200'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-indigo-600 shrink-0" />}
            <span className="font-black text-sm">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header & Main Call-to-Action */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
        <div>
          <div className="flex items-center gap-4">
             <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-blue-600/20">
                <Wrench size={32} className="animate-spin-slow" />
             </div>
             <div>
                <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">مستشار الصيانة والأعطال</h1>
                <p className="text-slate-500 font-bold mt-1 text-sm lg:text-base">تتبع كامل وذكي لدورة صيانة الأجهزة، الفنيين، المستلزمات والتسويات المالية الفورية</p>
             </div>
          </div>
        </div>

        <button
          onClick={() => {
            setEditingRequest(null);
            setIsFormOpen(true);
          }}
          className="w-full lg:w-auto bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-4 rounded-3xl font-black flex items-center justify-center gap-3 shadow-xl shadow-blue-500/20 hover:shadow-indigo-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
        >
          <Plus size={24} />
          <span>فتح طلب صيانة ومتابعة عطل</span>
        </button>
      </div>

      {/* Quick Visual Help Banner */}
      <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/50 dark:from-slate-850 dark:to-slate-900 p-5 rounded-3xl mb-10 border border-blue-150/40 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex gap-3">
          <BadgeAlert className="text-blue-600 dark:text-blue-400 shrink-0 w-6 h-6 mt-0.5" />
          <div>
            <h4 className="text-sm font-black text-blue-900 dark:text-blue-300">سير العمل التفاعلي المباشر:</h4>
            <p className="text-xs font-bold text-blue-700/80 dark:text-slate-400 mt-1 leading-relaxed">
              لست بحاجة لفتح الشاشات المعقدة! يمكنك الآن النقر مباشرة على نقاط تقدم الصيانة في أي بطاقة أدناه لترقية حالة الجهاز فوراً وتسوية القيود المالية والعمولات تلقائياً.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <span className="text-[11px] font-black bg-blue-100 dark:bg-blue-900/40 text-blue-700 px-3 py-1.5 rounded-xl">⚡ تحكم سريع بالنقر</span>
          <span className="text-[11px] font-black bg-emerald-150/60 dark:bg-emerald-900/40 text-emerald-700 px-3 py-1.5 rounded-xl">💸 موازنة حسابات فورية</span>
        </div>
      </div>

      {/* Modern High-End Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          { label: 'إجمالي أجهزة الصيانة', value: stats.total, sub: 'المسجلة بالكامل بالورشة (انقر للعرض)', filterId: 'all', icon: <ClipboardList />, color: 'blue' },
          { label: 'أعطال نشطة بالعمل', value: stats.active, sub: 'أجهزة تحت الإصلاح والفحص (انقر للعرض)', filterId: 'active_only', icon: <Cpu />, color: 'amber' },
          { label: 'جاهز للتسليم والتحصيل', value: stats.ready, sub: 'بانتظار العميل لدفع الفاتورة (انقر للعرض)', filterId: 'ready', icon: <CheckCircle2 />, color: 'emerald' },
          { label: 'صافي إيرادات المحصلة', value: `${(stats?.completedRevenue ?? 0).toLocaleString()} ج.م`, sub: `انقر لعرض الأجهزة التي تم تسليمها وتحصيلها`, filterId: 'delivered', icon: <Coins />, color: 'indigo' },
        ].map((stat, i) => {
          const isSelected = statusFilter === stat.filterId;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => setStatusFilter(stat.filterId)}
              className={`p-6 rounded-[2rem] border transition-all flex flex-col justify-between group cursor-pointer select-none hover:scale-[1.02] active:scale-[0.99] ${
                isSelected 
                  ? 'bg-blue-50/50 dark:bg-slate-800/80 border-blue-500 dark:border-blue-400 shadow-md ring-2 ring-blue-500/15'
                  : 'bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-800 shadow-sm hover:border-slate-350 dark:hover:border-slate-700 hover:shadow-md'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="text-right">
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-wider">{stat.label}</p>
                  <p className="text-3xl font-black text-slate-850 dark:text-white mt-2 tracking-tight">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  stat.color === 'blue' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400' :
                  stat.color === 'amber' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400' :
                  stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-450' :
                  'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400'
                }`}>
                  {stat.icon}
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-bold pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                <span>{stat.sub}</span>
                {isSelected && <span className="text-[9px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-black animate-pulse">نشط</span>}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Search Toolbar & Filter segment */}
      <div className="flex flex-col xl:flex-row gap-5 mb-8 items-stretch xl:items-center">
        <div className="flex-1 relative">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث ذكي: باسم العميل، الهاتف، نوع الجهاز، أو الكود الكودي للصيانة..."
            className="w-full pr-14 pl-6 py-4.5 bg-white dark:bg-slate-900 border-2 border-transparent focus:border-blue-500 rounded-3xl outline-none shadow-sm font-bold text-base transition-all"
          />
        </div>
        
        {/* Dynamic Horizontal Stage Filters */}
        <div className="flex gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-850 rounded-2xl overflow-x-auto no-scrollbar scroll-smooth shrink-0 self-start xl:self-auto max-w-full">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'active_only', label: 'نشط حالياً ⚡' },
            { id: 'received', label: 'مستلم' },
            { id: 'inspecting', label: 'تشخيص' },
            { id: 'waiting_for_parts', label: 'انتظار قطع' },
            { id: 'in_repair', label: 'قيد الإصلاح' },
            { id: 'ready', label: 'جاهز' },
            { id: 'delivered', label: 'مسلم' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setStatusFilter(item.id)}
              className={`px-5 py-3 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === item.id
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-sm scale-102'
                  : 'text-slate-500 hover:bg-white/40 dark:hover:bg-slate-800/40'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Repair Cards Grid */}
      <div className="grid grid-cols-1 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredRequests.map((request) => {
            const statusInfo = getStatusInfo(request.status);
            const profit = (request.totalCost || 0) - (request.parts?.reduce((sum, p) => sum + (p.cost || 0), 0) || 0) - (request.laborCost || 0);
            
            // Generate visual index of status for workflow tracker
            const currentWorkflowIdx = statusWorkflow.indexOf(request.status);

            return (
              <motion.div
                key={request.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-150 dark:border-slate-800 p-6 flex flex-col xl:flex-row gap-6 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm"
              >
                {/* Right side: Badge status & details */}
                <div className="xl:w-60 shrink-0 text-right flex flex-col justify-between border-l border-slate-100 dark:border-slate-800/80 pl-6 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-lg">
                        #{request.orderNumber || 'MNT-N/A'}
                      </span>
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase ${
                        request.priority === 'urgent' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/25 dark:text-rose-400' :
                        request.priority === 'high' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/25 dark:text-amber-400' :
                        'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {request.priority === 'urgent' ? '🚨 طارئ جداً' : request.priority === 'high' ? '⚠️ عاجل' : '🟢 عادي'}
                      </span>
                    </div>

                    <h3 className="text-xl font-black text-slate-950 dark:text-white leading-tight group-hover:text-blue-600 transition-colors">
                      {request.itemDescription}
                    </h3>
                    <p className="text-xs text-slate-400 font-bold mt-1.5 flex items-center gap-1.5">
                      <Calendar size={12} />
                      تاريخ الاستلام: {request.receivedDate}
                    </p>
                  </div>

                  {/* Profit Margin Info box */}
                  <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-bold">التكلفة والقطع:</span>
                      <span className="font-extrabold text-slate-700 dark:text-slate-300">
                        {((request.parts?.reduce((sum, p) => sum + (p.cost || 0), 0) || 0) + (request.laborCost || 0)).toLocaleString()} ج.م
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs mt-2 border-t border-slate-100 dark:border-slate-800/40 pt-2">
                      <span className="text-slate-400 font-bold">صافي الربح:</span>
                      <span className="font-black text-emerald-600 flex items-center gap-0.5">
                        +{(profit ?? 0).toLocaleString()} ج.م
                      </span>
                    </div>
                  </div>
                </div>

                {/* Middle: Client details & interactive Stepper workflow! */}
                <div className="flex-1 flex flex-col justify-between gap-6">
                  {/* Client & Problem detail row */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                        <User size={16} className="text-blue-500 shrink-0" />
                        <span className="font-black text-base">{request.customerName}</span>
                        <span className="text-slate-300 dark:text-slate-700">|</span>
                        <Phone size={14} className="text-slate-400 shrink-0" />
                        <span className="font-bold text-sm text-slate-500">{request.customerPhone}</span>
                      </div>
                      <p className="text-xs text-rose-600 dark:text-rose-400 font-bold bg-rose-50/50 dark:bg-rose-950/20 px-3 py-1.5 rounded-xl border border-rose-100/30 inline-block">
                        🔍 العيب المشخص: {request.initialProblemDescription}
                      </p>
                      {request.technicalReport && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50/30 dark:bg-emerald-950/10 px-3 py-1.5 rounded-xl border border-emerald-100/20 mt-1">
                          🛠️ تقرير الورشة: {request.technicalReport}
                        </p>
                      )}
                    </div>

                    <div className="text-left bg-gradient-to-tr from-slate-900 to-slate-800 text-white dark:from-slate-850 dark:to-slate-800 p-4.5 rounded-2xl flex flex-col items-end shrink-0 min-w-[140px] shadow-sm">
                      <span className="text-[9px] uppercase tracking-wider font-black text-slate-400">الفاتورة الإجمالية</span>
                      <span className="text-2xl font-black text-white mt-1 tabular-nums">{(request.totalCost ?? 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span></span>
                      <span className="text-[9px] text-emerald-400 font-bold mt-1 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        {request.paymentMethod === 'add_to_debt' ? '⏳ آجل بالذمة' : `💳 ${request.paymentMethod === 'cash' ? 'كاش بالخزينة' : 'تحويل إلكتروني'}`}
                      </span>
                    </div>
                  </div>

                  {/* INTERACTIVE WORKFLOW STEPPER BAR (قسم سير العمل الذكي والسهل للغاية) */}
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800/60">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-3 flex items-center gap-1.5 justify-start">
                      <Clock size={12} className="text-blue-500 animate-pulse" />
                      مراحل سير وتحديث حالة صيانة الجهاز (انقر للترقية الفورية):
                    </p>

                    <div className="relative flex justify-between items-center w-full">
                      {/* Connection Line */}
                      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-slate-100 dark:bg-slate-800 z-0 rounded-full" />
                      
                      {/* Interactive Colored Progress Line */}
                      <div 
                        className="absolute right-0 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-l from-blue-500 to-emerald-500 z-0 rounded-full transition-all duration-300" 
                        style={{ 
                          width: `${currentWorkflowIdx >= 0 ? (currentWorkflowIdx / (statusWorkflow.length - 1)) * 100 : 0}%`,
                          right: 0
                        }} 
                      />

                      {/* Stepper Nodes */}
                      {statusWorkflow.map((statusStep, idx) => {
                        const isCompleted = currentWorkflowIdx > idx;
                        const isActive = request.status === statusStep;
                        const isPastOrActive = currentWorkflowIdx >= idx;

                        const info = getStatusInfo(statusStep);

                        return (
                          <div 
                            key={statusStep}
                            onClick={() => handleQuickStatusTransition(request, statusStep)}
                            className="relative z-10 flex flex-col items-center group cursor-pointer"
                            title={`تغيير الحالة إلى: ${info.label}`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${
                              isActive 
                                ? 'bg-blue-600 text-white ring-4 ring-blue-500/20 scale-115' 
                                : isCompleted 
                                  ? 'bg-emerald-500 text-white' 
                                  : 'bg-white text-slate-400 border-2 border-slate-200 dark:bg-slate-900 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                            }`}>
                              {isCompleted ? (
                                <CheckCircle2 className="w-4.5 h-4.5" />
                              ) : (
                                <span className="text-xs font-black">{idx + 1}</span>
                              )}
                            </div>
                            
                            {/* Desktop tooltip label */}
                            <span className={`absolute -bottom-7 whitespace-nowrap text-[10px] font-black tracking-tight transition-all duration-300 ${
                              isActive 
                                ? 'text-blue-600 dark:text-blue-400 scale-105' 
                                : isPastOrActive 
                                  ? 'text-slate-700 dark:text-slate-300' 
                                  : 'text-slate-400'
                            }`}>
                              {idx === 0 ? 'استلام' : idx === 1 ? 'تشخيص' : idx === 2 ? 'انتظار قطع' : idx === 3 ? 'إصلاح' : idx === 4 ? 'جاهز' : 'تم التسليم'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Next Step Action Button & Quick Status Helpers */}
                    {getNextStepInfo(request.status) ? (
                      <div className="flex flex-wrap gap-2 items-center mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/40">
                        <button
                          onClick={() => {
                            const next = getNextStepInfo(request.status);
                            if (next) {
                              handleQuickStatusTransition(request, next.nextStatus);
                            }
                          }}
                          className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow-md hover:scale-102 active:scale-98 ${getNextStepInfo(request.status)?.color}`}
                        >
                          <span>الخطوة التالية للطلب:</span>
                          <span className="underline">{getNextStepInfo(request.status)?.label}</span>
                        </button>

                        {request.status === 'inspecting' && (
                          <button
                            onClick={() => handleQuickStatusTransition(request, 'waiting_for_parts')}
                            className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-450 rounded-xl font-bold text-xs transition-all cursor-pointer"
                          >
                            ⏳ بانتظار قطع الغيار
                          </button>
                        )}

                        {request.status !== 'cancelled' && request.status !== 'delivered' && (
                          <button
                            onClick={() => handleQuickStatusTransition(request, 'cancelled')}
                            className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:text-rose-450 rounded-xl font-bold text-xs transition-all mr-auto cursor-pointer"
                          >
                            🚫 إلغاء وإرجاع الجهاز
                          </button>
                        )}
                      </div>
                    ) : (
                      request.status === 'delivered' ? (
                        <div className="flex gap-2 items-center mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/40">
                          <span className="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-3.5 py-2 rounded-xl flex items-center gap-1.5">
                            🎉 تم تسليم الجهاز بالكامل وإتمام السجل المالي والمخزني بنجاح.
                          </span>
                        </div>
                      ) : request.status === 'cancelled' ? (
                        <div className="flex gap-2 items-center mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/40">
                          <span className="text-xs font-black text-rose-600 bg-rose-50 dark:bg-rose-950/30 px-3.5 py-2 rounded-xl flex items-center gap-1.5">
                            ❌ هذا الطلب ملغي وتمت تصفية كافه القيود والعمولات تلقائياً.
                          </span>
                          <button
                            onClick={() => handleQuickStatusTransition(request, 'received')}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl font-bold text-xs transition-all mr-auto cursor-pointer"
                          >
                            🔄 إعادة تفعيل الطلب
                          </button>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>

                {/* Left Side: Professional Quick Actions (Edit, Delete, Convert to Waybill, Receipt) */}
                <div className="flex xl:flex-col gap-2 justify-center shrink-0 border-r border-slate-100 dark:border-slate-800/80 pr-6 pt-4 xl:pt-0 min-w-[140px]">
                  {/* Print Receipt Button */}
                  <button
                    onClick={() => setPrintVoucherData(request)}
                    className="p-2.5 bg-slate-50 hover:bg-blue-50 text-blue-600 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-xs font-black"
                    title="طباعة إيصال استلام للعميل"
                  >
                    <Printer size={16} />
                    <span>طباعة إيصال</span>
                  </button>

                  {/* Convert to Shipping waybill */}
                  {['ready', 'ready_for_shipping'].includes(request.status) && (
                    <button
                      onClick={() => handleConvertToWaybill(request)}
                      className={`p-2.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-xs font-black ${
                        request.waybillOrderId 
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                          : 'bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 dark:bg-indigo-950/20'
                      }`}
                      title={request.waybillOrderId ? 'تم إنشاء بوليصة شحن مسبقاً' : 'إنشاء بوليصة تتبع وشحن'}
                      disabled={!!request.waybillOrderId}
                    >
                      <Truck size={16} />
                      <span>شحن البوليصة</span>
                    </button>
                  )}

                  {/* Edit details */}
                  <button
                    onClick={() => {
                      setEditingRequest(request);
                      setIsFormOpen(true);
                    }}
                    className="p-2.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 dark:bg-slate-800 dark:hover:bg-slate-700 text-blue-600 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-xs font-black"
                    title="تعديل تفاصيل الصيانة والتسوية"
                  >
                    <Edit2 size={16} />
                    <span>تعديل الطلب</span>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => setDeleteId(request.id)}
                    className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-slate-800 dark:hover:bg-slate-700/80 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-xs font-black"
                    title="حذف السجل"
                  >
                    <Trash2 size={16} />
                    <span>حذف السجل</span>
                  </button>
                </div>
              </motion.div>
            );
          })}

          {/* Empty State */}
          {filteredRequests.length === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-24 flex flex-col items-center justify-center text-slate-400 text-center bg-white dark:bg-slate-900 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800"
            >
              <div className="w-24 h-24 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                <Wrench size={44} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-200">لا توجد طلبات صيانة مطابقة</h3>
              <p className="font-bold text-xs mt-2 text-slate-500 max-w-md leading-relaxed">
                لم نجد أي جهاز صيانة يتطابق مع شروط البحث المحددة. يمكنك الضغط على "فتح طلب صيانة" لإضافة عطل جديد فوراً!
              </p>
              <button
                onClick={() => {
                  setEditingRequest(null);
                  setIsFormOpen(true);
                }}
                className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black text-xs transition-all shadow-md cursor-pointer"
              >
                تسجيل أول جهاز صيانة
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* GORGEOUS PRINTABLE VOUCHER/RECEIPT MODAL (إيصال استلام جهاز صيانة) */}
      <AnimatePresence>
        {printVoucherData && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
              onClick={() => setPrintVoucherData(null)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl border border-slate-200 dark:border-slate-800 text-right p-8 flex flex-col justify-between"
              dir="rtl"
            >
              {/* Header inside modal */}
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-slate-800 print:hidden">
                <h3 className="text-xl font-black text-slate-850 dark:text-white flex items-center gap-2">
                  <Printer className="text-blue-600" />
                  معاينة إيصال استلام الصيانة للطباعة
                </h3>
                <button
                  onClick={() => setPrintVoucherData(null)}
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl transition-all cursor-pointer text-slate-500"
                >
                  إغلاق
                </button>
              </div>

              {/* Print Document Container */}
              <div id="maintenance-print-area" className="p-8 bg-white border-2 border-slate-200 rounded-2xl text-slate-900 print:border-0 print:p-0">
                {/* Print Shop Identity */}
                <div className="flex justify-between items-start mb-6 pb-6 border-b-2 border-dashed border-slate-200">
                  <div className="text-right">
                    <h2 className="text-2xl font-black tracking-tight text-blue-750">مركز الخدمة والصيانة المعتمد</h2>
                    <p className="text-xs font-bold text-slate-500 mt-1">تكنولوجيا الدقة والسرعة في الإصلاح</p>
                    <p className="text-xs text-slate-400 mt-1">هاتف المحل: {settings?.phone || '—'} | الفرع الرئيسي</p>
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-black bg-slate-900 text-white px-3 py-1 rounded-md mb-2 inline-block">
                      إيصال استلام صيانة
                    </span>
                    <p className="text-sm font-black text-slate-800 mt-1">رقم الإيصال: #{printVoucherData.orderNumber}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">تاريخ الاستلام: {printVoucherData.receivedDate}</p>
                  </div>
                </div>

                {/* Customer Details Segment */}
                <div className="bg-slate-50 p-4 rounded-xl mb-6">
                  <h4 className="text-xs font-black text-blue-650 uppercase mb-2">👤 بيانات صاحب الجهاز (العميل)</h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block font-bold">اسم العميل:</span>
                      <span className="font-extrabold text-slate-800">{printVoucherData.customerName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-bold">رقم الجوال:</span>
                      <span className="font-extrabold text-slate-800">{printVoucherData.customerPhone}</span>
                    </div>
                  </div>
                </div>

                {/* Device Details Segment */}
                <div className="mb-6">
                  <h4 className="text-xs font-black text-blue-650 uppercase mb-2">📦 مواصفات وتفاصيل الجهاز</h4>
                  <table className="w-full text-xs text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-bold">
                        <th className="p-2.5 border border-slate-200">نوع وموديل الجهاز</th>
                        <th className="p-2.5 border border-slate-200">الرقم التسلسلي S/N</th>
                        <th className="p-2.5 border border-slate-200">القيمة التقديرية</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="text-slate-800">
                        <td className="p-2.5 border border-slate-200 font-extrabold">{printVoucherData.itemDescription}</td>
                        <td className="p-2.5 border border-slate-200 font-bold">{printVoucherData.itemSerial || 'غير محدد'}</td>
                        <td className="p-2.5 border border-slate-200 font-bold">{printVoucherData.itemValue ? `${printVoucherData.itemValue} ج.م` : 'بدون تأمين'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Diagnosis Details */}
                <div className="mb-6 p-4 border-r-4 border-blue-500 bg-blue-50/40 rounded-l-xl">
                  <h4 className="text-xs font-black text-blue-750">🔍 العيب المسجل والشكوى الفنية:</h4>
                  <p className="text-xs text-slate-700 mt-1 font-bold leading-relaxed">{printVoucherData.initialProblemDescription}</p>
                </div>

                {/* Invoice Breakdown if ready/delivered */}
                <div className="mb-6 border-t-2 border-dashed border-slate-200 pt-6">
                  <h4 className="text-xs font-black text-blue-650 uppercase mb-3">💰 تقدير التكاليف والحساب</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">المستلزمات وقطع الغيار:</span>
                      <span className="font-extrabold text-slate-850">{((printVoucherData.parts?.reduce((sum, p) => sum + p.priceToCustomer, 0) || 0) ?? 0).toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">رسوم الخدمة والمصنعية الفنية:</span>
                      <span className="font-extrabold text-slate-850">{(printVoucherData.laborCost ?? 0).toLocaleString()} ج.م</span>
                    </div>
                    {printVoucherData.shippingCostToCustomer && printVoucherData.shippingCostToCustomer > 0 ? (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-bold">رسوم الشحن والتوصيل للمنزل:</span>
                        <span className="font-extrabold text-slate-850">{(printVoucherData.shippingCostToCustomer ?? 0).toLocaleString()} ج.م</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between items-center border-t border-slate-150 pt-2 text-sm font-black text-slate-900 bg-slate-50 p-2.5 rounded-lg">
                      <span>إجمالي الفاتورة المطلوب سدادها:</span>
                      <span>{(printVoucherData.totalCost ?? 0).toLocaleString()} ج.م</span>
                    </div>
                  </div>
                </div>

                {/* Terms and conditions */}
                <div className="border-t border-slate-200 pt-4 text-[9px] text-slate-400 font-bold leading-relaxed space-y-1">
                  <p className="text-slate-500 font-black">📜 الشروط والأحكام الفنية لمركز الصيانة:</p>
                  <p>1. يرجى مراجعة الجهاز واختباره بالكامل فور الاستلام والتحصيل، لا يشمل الضمان سوء الاستخدام.</p>
                  <p>2. المركز غير مسؤول نهائياً عن الأجهزة التي يمر عليها أكثر من ٣ أشهر بالورشة دون استلامها من العميل.</p>
                  <p>3. يجب إبراز هذا الإيصال أو الكود الرقمي لتسهيل وتسريع تسليم الجهاز لمالكه.</p>
                </div>

                {/* Signatures */}
                <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-100 text-xs">
                  <div className="text-center w-1/2">
                    <p className="font-bold text-slate-400">توقيع الموظف المسؤول</p>
                    <div className="h-10 mt-1" />
                    <p className="font-black text-slate-800">.................................</p>
                  </div>
                  <div className="text-center w-1/2">
                    <p className="font-bold text-slate-400">إقرار وتوقيع العميل</p>
                    <div className="h-10 mt-1" />
                    <p className="font-black text-slate-800">.................................</p>
                  </div>
                </div>
              </div>

              {/* Print Buttons */}
              <div className="flex gap-4 mt-6 print:hidden">
                <button
                  type="button"
                  onClick={() => {
                    const printContents = document.getElementById('maintenance-print-area')?.innerHTML;
                    const originalContents = document.body.innerHTML;
                    if (printContents) {
                      const printWindow = window.open('', '_blank');
                      if (printWindow) {
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>طباعة إيصال صيانة #${printVoucherData.orderNumber}</title>
                              <style>
                                body { font-family: 'Inter', system-ui, sans-serif; direction: rtl; padding: 20px; }
                                .bg-slate-50 { background-color: #f8fafc; }
                                .p-4 { padding: 1rem; }
                                .rounded-xl { border-radius: 0.75rem; }
                                .mb-6 { margin-bottom: 1.5rem; }
                                .flex { display: flex; }
                                .justify-between { justify-content: space-between; }
                                .items-start { align-items: flex-start; }
                                .text-right { text-align: right; }
                                .text-left { text-align: left; }
                                .text-xs { font-size: 0.75rem; }
                                .text-sm { font-size: 0.875rem; }
                                .text-2xl { font-size: 1.5rem; }
                                .font-black { font-weight: 900; }
                                .font-bold { font-weight: 700; }
                                .font-extrabold { font-weight: 800; }
                                .text-slate-500 { color: #64748b; }
                                .text-slate-400 { color: #94a3b8; }
                                .text-slate-800 { color: #1e293b; }
                                .text-blue-750 { color: #1d4ed8; }
                                .bg-slate-900 { background-color: #0f172a; }
                                .text-white { color: #ffffff; }
                                .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
                                .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
                                .rounded-md { border-radius: 0.375rem; }
                                .inline-block { display: inline-block; }
                                .border-b-2 { border-bottom-width: 2px; }
                                .border-dashed { border-style: dashed; }
                                .border-slate-200 { border-color: #e2e8f0; }
                                .pb-6 { padding-bottom: 1.5rem; }
                                .grid { display: grid; }
                                .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                                .gap-4 { gap: 1rem; }
                                .w-full { width: 100%; }
                                .border-collapse { border-collapse: collapse; }
                                .border { border: 1px solid #e2e8f0; }
                                .p-2\.5 { padding: 0.625rem; }
                                .bg-slate-100 { background-color: #f1f5f9; }
                                .border-r-4 { border-right-width: 4px; }
                                .border-blue-500 { border-color: #3b82f6; }
                                .bg-blue-50\\/40 { background-color: rgba(239, 246, 255, 0.4); }
                                .rounded-l-xl { border-top-left-radius: 0.75rem; border-bottom-left-radius: 0.75rem; }
                                .pt-6 { padding-top: 1.5rem; }
                                .space-y-2 > * + * { margin-top: 0.5rem; }
                                .pt-2 { padding-top: 0.5rem; }
                                .border-t { border-top-width: 1px; }
                                .border-slate-150 { border-color: #f1f5f9; }
                                .text-slate-850 { color: #1e293b; }
                                .p-2\.5 { padding: 0.625rem; }
                                .rounded-lg { border-radius: 0.5rem; }
                                .text-slate-900 { color: #0f172a; }
                                .space-y-1 > * + * { margin-top: 0.25rem; }
                                .mt-8 { margin-top: 2rem; }
                                .w-1\\/2 { width: 50%; }
                                .h-10 { height: 2.5rem; }
                                .mt-1 { margin-top: 0.25rem; }
                              </style>
                            </head>
                            <body>
                              ${printContents}
                              <script>
                                window.onload = function() {
                                  window.print();
                                  window.close();
                                }
                              </script>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                      }
                    }
                  }}
                  className="flex-1 bg-blue-650 hover:bg-blue-700 text-white rounded-2xl py-4 font-black text-sm transition-all shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer size={18} />
                  <span>بدء طباعة الإيصال الآن</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintVoucherData(null)}
                  className="px-6 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-sm transition-colors"
                >
                  إلغاء المعاينة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Overlay for edit / creation form */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
              onClick={() => setIsFormOpen(false)}
            />
            <div className="relative w-full max-w-4xl max-h-full overflow-y-auto no-scrollbar">
              <MaintenanceForm
                initialData={editingRequest || {}}
                onSubmit={handleSave}
                onCancel={() => setIsFormOpen(false)}
                settings={settings}
                customers={customers}
                products={products}
                treasury={treasury}
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {!!deleteId && (
          <ConfirmationModal
            isOpen={true}
            message="هل أنت متأكد من حذف هذا العطل وسجل الصيانة المعلق؟ لا يمكن التراجع عن هذا الإجراء الإداري."
            onConfirm={performDelete}
            onCancel={() => setDeleteId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default MaintenancePage;
