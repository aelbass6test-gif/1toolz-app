import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  XCircle, 
  MapPin, 
  Truck, 
  AlertCircle, 
  Edit3, 
  ChevronRight,
  ShieldCheck,
  Send,
  Loader2,
  Search,
  Check,
  ArrowRight
} from 'lucide-react';
import { db as firebaseDb } from '../services/firebaseClient';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { db as localDb } from '../src/lib/db';

interface CustomerOrderActionPageProps {
  orders?: any[];
  allStoresData?: Record<string, any>;
  activeStore?: any;
  setOrders?: React.Dispatch<React.SetStateAction<any[]>>;
  setAllStoresData?: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}

export const CustomerOrderActionPage: React.FC<CustomerOrderActionPageProps> = ({
  orders: propOrders,
  allStoresData: propAllStoresData,
  activeStore,
  setOrders,
  setAllStoresData
}) => {
  const [searchParams] = useSearchParams();
  const routeParams = useParams();

  const rawOrderId = searchParams.get('orderId') || searchParams.get('id') || routeParams.id || '';
  const rawOrderNumber = searchParams.get('orderNumber') || searchParams.get('num') || searchParams.get('order') || '';
  const initialAction = searchParams.get('action') || (window.location.pathname.includes('/confirm-order') ? 'confirm' : window.location.pathname.includes('/cancel-order') ? 'cancel' : '');
  const rawPhone = searchParams.get('phone') || searchParams.get('mobile') || searchParams.get('tel') || '';

  const cleanQueryId = (rawOrderId || '').trim().replace(/^#/, '');
  const cleanQueryNum = (rawOrderNumber || '').trim().replace(/^#/, '');
  const cleanPhone = (rawPhone || '').replace(/\D/g, '');

  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [matchedStoreId, setMatchedStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState('متجرنا');
  const [actionDone, setActionDone] = useState<string | null>(null); // 'confirmed' | 'cancelled' | 'address_updated'
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Manual search input state
  const [manualQuery, setManualQuery] = useState(cleanQueryNum || cleanQueryId || cleanPhone || '');

  // Edit address state
  const [isEditingAddress, setIsEditingAddress] = useState(initialAction === 'edit_address');
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [newCity, setNewCity] = useState('');

  // Core Lookup Engine
  const executeLookup = useCallback(async (qId: string, qNum: string, qPhone: string, autoAction?: string) => {
    const qCleanId = (qId || '').trim().replace(/^#/, '');
    const qCleanNum = (qNum || '').trim().replace(/^#/, '');
    const qRawPhone = (qPhone || '').replace(/\D/g, '');
    const qPhoneCore = qRawPhone.startsWith('20') ? qRawPhone.substring(2) : (qRawPhone.startsWith('0') ? qRawPhone.substring(1) : qRawPhone);

    if (!qCleanId && !qCleanNum && !qPhoneCore) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      let targetOrder: any = null;
      let foundStoreId: string | null = null;
      let foundStoreName: string = activeStore?.name || 'وان تولز للعدد اليدوية والكهربائية';

      const checkPhoneMatch = (pField: any) => {
        if (!qPhoneCore || qPhoneCore.length < 6) return false;
        const pDigits = String(pField || '').replace(/\D/g, '');
        const pCore = pDigits.startsWith('20') ? pDigits.substring(2) : (pDigits.startsWith('0') ? pDigits.substring(1) : pDigits);
        return pCore === qPhoneCore || pCore.endsWith(qPhoneCore) || qPhoneCore.endsWith(pCore) || (qPhoneCore.length >= 8 && pCore.includes(qPhoneCore));
      };

      const matchesOrder = (ord: any) => {
        if (!ord) return false;
        const oId = String(ord.id || '').trim().replace(/^#/, '');
        const oNum = String(ord.orderNumber || '').trim().replace(/^#/, '');

        let matchId = false;
        let matchNum = false;

        if (qCleanId) {
          if (oId === qCleanId || oNum === qCleanId || oId.endsWith(qCleanId) || qCleanId.endsWith(oId) || oId.includes(qCleanId)) matchId = true;
        }
        if (qCleanNum) {
          if (oNum === qCleanNum || oId === qCleanNum || oNum.endsWith(qCleanNum) || qCleanNum.endsWith(oNum)) matchNum = true;
        }
        
        const matchPhone = checkPhoneMatch(ord.customerPhone || ord.phone || ord.customer_phone || ord.mobile || ord.tel || ord.whatsapp);

        if (qCleanId || qCleanNum) {
          // If we have an EXACT match on the long unique order ID, don't let a phone mismatch ruin it.
          // Only enforce phone match if it was a short order number match (which could collide).
          if (matchId) {
            return true;
          }
          if (matchNum) {
            return qPhone ? Boolean(matchPhone) : true;
          }
          return false;
        }
        
        return matchPhone;
      };

      // Strategy 1: Check propOrders (in-memory React state)
      if (propOrders && propOrders.length > 0) {
        const match = propOrders.find(matchesOrder);
        if (match) {
          targetOrder = match;
          foundStoreId = activeStore?.id || null;
          foundStoreName = activeStore?.name || foundStoreName;
        }
      }

      // Strategy 2: Check propAllStoresData
      if (!targetOrder && propAllStoresData) {
        for (const [sId, sData] of Object.entries(propAllStoresData)) {
          const sOrders = (sData as any)?.orders || (sData as any)?.storeData?.orders || [];
          const match = sOrders.find(matchesOrder);
          if (match) {
            targetOrder = match;
            foundStoreId = sId;
            foundStoreName = (sData as any)?.settings?.general?.storeName || (sData as any)?.settings?.storeName || (sData as any)?.name || foundStoreName;
            break;
          }
        }
      }

      // Strategy 3: Check LocalStorage backups
      if (!targetOrder && typeof window !== 'undefined') {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('wuilt_backup_') || key.startsWith('store_data_') || key === 'pending_orders')) {
              const raw = localStorage.getItem(key);
              if (raw) {
                const parsed = JSON.parse(raw);
                const sOrders = Array.isArray(parsed) ? parsed : (parsed.orders || parsed.storeData?.orders || []);
                const match = sOrders.find(matchesOrder);
                if (match) {
                  targetOrder = match;
                  foundStoreId = key.replace('wuilt_backup_', '').replace('store_data_', '');
                  foundStoreName = parsed.settings?.general?.storeName || parsed.settings?.storeName || parsed.name || foundStoreName;
                  break;
                }
              }
            }
          }
        } catch (e) {
          console.warn('LocalStorage search warning:', e);
        }
      }

      // Strategy 3.5: Check IndexedDB
      if (!targetOrder && typeof window !== 'undefined') {
        try {
          // Check synced orders table
          const localOrders = await localDb.orders.toArray();
          const match = localOrders.find(matchesOrder);
          if (match) {
            targetOrder = match;
            foundStoreId = match.store_id || null;
            if (foundStoreId) {
              const settingsRecord = await localDb.settings.get(foundStoreId) as any;
              if (settingsRecord?.data?.settings?.storeName) {
                foundStoreName = settingsRecord.data.settings.storeName;
              }
            }
          }
          
          // Check unsynced orders in settings table
          if (!targetOrder) {
            const allSettings = await localDb.settings.toArray();
            for (const setting of allSettings) {
              if (setting.id === 'global') continue;
              const sData = setting.data;
              const sOrders = sData?.orders || sData?.storeData?.orders || [];
              const sMatch = sOrders.find(matchesOrder);
              if (sMatch) {
                targetOrder = sMatch;
                foundStoreId = setting.id;
                foundStoreName = sData?.settings?.general?.storeName || sData?.settings?.storeName || sData?.name || foundStoreName;
                break;
              }
            }
          }
        } catch (e) {
          console.warn('IndexedDB search warning:', e);
        }
      }

      // Strategy 4: Server API lookup (/api/order/public-details)
      if (!targetOrder) {
        try {
          const url = `/api/order/public-details?orderId=${encodeURIComponent(qCleanId || qCleanNum)}&orderNumber=${encodeURIComponent(qCleanNum || qCleanId)}&phone=${encodeURIComponent(qPhoneCore || qRawPhone)}`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.order) {
              targetOrder = data.order;
              foundStoreName = data.storeName || foundStoreName;
            }
          }
        } catch (apiErr) {
          console.warn('Server public-details fetch note:', apiErr);
        }
      }

      // Strategy 5: Direct Firestore Query in 'orders' collection
      if (!targetOrder && firebaseDb) {
        try {
          const ordersSnap = await getDocs(collection(firebaseDb, 'orders'));
          for (const ordDoc of ordersSnap.docs) {
            const ordData = { id: ordDoc.id, ...ordDoc.data() as any };
            if (matchesOrder(ordData)) {
              targetOrder = ordData;
              foundStoreId = ordData.storeId || ordData.store_id || null;
              break;
            }
          }
        } catch (fErr) {
          console.warn('Firestore orders collection search note:', fErr);
        }
      }

      // Strategy 6: Direct Firestore Query in 'stores_data' collection
      if (!targetOrder && firebaseDb) {
        try {
          const storesSnap = await getDocs(collection(firebaseDb, 'stores_data'));
          for (const sDoc of storesSnap.docs) {
            const sData = sDoc.data();
            const sOrders = sData.orders || sData.storeData?.orders || [];
            const match = sOrders.find(matchesOrder);
            if (match) {
              targetOrder = match;
              foundStoreId = sDoc.id;
              foundStoreName = sData.settings?.general?.storeName || sData.settings?.storeName || sData.name || foundStoreName;
              break;
            }
          }
        } catch (fErr) {
          console.warn('Firestore stores_data search note:', fErr);
        }
      }

      if (targetOrder) {
        setOrder(targetOrder);
        setMatchedStoreId(foundStoreId);
        setStoreName(foundStoreName);
        setNewAddress(targetOrder.customerAddress || targetOrder.address || '');
        setNewCity(targetOrder.customerCity || targetOrder.city || targetOrder.governorate || '');

        if (targetOrder.status === 'قيد_التنفيذ' || targetOrder.status === 'مؤكد') {
          setActionDone('confirmed');
        } else if (targetOrder.status === 'ملغي') {
          setActionDone('cancelled');
        } else if (autoAction === 'confirm') {
          handleExecuteAction('confirm', targetOrder, foundStoreId);
        } else if (autoAction === 'cancel') {
          handleExecuteAction('cancel', targetOrder, foundStoreId);
        }
      } else {
        setErrorMsg('لم نتمكن من العثور على طلب بهذا الرقم أو الهاتف. يرجى التحقق من الرقم والمحاولة مرة أخرى.');
      }
    } catch (err: any) {
      setErrorMsg('حدث خطأ أثناء تحميل بيانات الطلب. يرجى إعادة المحاولة.');
    } finally {
      setLoading(false);
    }
  }, [activeStore, propOrders, propAllStoresData]);

  // Initial load
  useEffect(() => {
    if (cleanQueryId || cleanQueryNum || cleanPhone) {
      executeLookup(cleanQueryId, cleanQueryNum, cleanPhone, initialAction);
    }
  }, [cleanQueryId, cleanQueryNum, cleanPhone, initialAction, executeLookup]);

  // Manual search submit handler
  const handleManualSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = manualQuery.trim();
    if (!q) return;

    const isNumericOnly = /^\d+$/.test(q);
    if (isNumericOnly && q.length >= 8) {
      // Treat as phone number
      executeLookup('', '', q);
    } else if (q.includes('-') || q.startsWith('#') || q.toLowerCase().startsWith('order')) {
      // Treat as order ID
      executeLookup(q, '', '');
    } else {
      // Treat as short order number
      executeLookup('', q, '');
    }
  };

  // Action Handler (Confirm / Cancel / Edit Address)
  const handleExecuteAction = async (
    actionType: 'confirm' | 'cancel' | 'edit_address', 
    targetOrderParam?: any,
    targetStoreIdParam?: string | null
  ) => {
    const currentOrder = targetOrderParam || order;
    const currentStoreId = targetStoreIdParam !== undefined ? targetStoreIdParam : matchedStoreId;

    if (!currentOrder) return;

    try {
      setExecuting(true);
      setErrorMsg(null);

      const targetStatus = actionType === 'cancel' ? 'ملغي' : 'قيد_التنفيذ';
      const updatedOrderObj = {
        ...currentOrder,
        status: targetStatus,
        customerAddress: actionType === 'edit_address' && newAddress ? newAddress : (currentOrder.customerAddress || currentOrder.address),
        customerCity: actionType === 'edit_address' && newCity ? newCity : (currentOrder.customerCity || currentOrder.city || currentOrder.governorate),
        updatedAt: new Date().toISOString(),
        notes: `${currentOrder.notes || ''} [بوابة العميل: ${actionType === 'confirm' ? 'تأكيد الطلب' : actionType === 'cancel' ? 'إلغاء الطلب' : `تعديل العنوان إلى: ${newAddress}`}]`.trim()
      };

      // 1. Direct Firestore Update (Orders Collection)
      if (firebaseDb) {
        try {
          const docId = currentOrder.id || `${currentStoreId || 'store'}_${currentOrder.orderNumber}`;
          await setDoc(doc(firebaseDb, 'orders', docId), updatedOrderObj, { merge: true });
        } catch (fErr) {
          console.warn('Direct Firestore orders collection update notice:', fErr);
        }
      }

      // 2. Direct Firestore Update (Stores Data Collection)
      if (firebaseDb && currentStoreId) {
        try {
          const storeRef = doc(firebaseDb, 'stores_data', currentStoreId);
          const storeDoc = await getDoc(storeRef);
          if (storeDoc.exists()) {
            const data = storeDoc.data();
            const currentOrders = data.orders || [];
            const idx = currentOrders.findIndex((o: any) => String(o.id) === String(currentOrder.id) || String(o.orderNumber) === String(currentOrder.orderNumber));
            if (idx !== -1) {
              currentOrders[idx] = { ...currentOrders[idx], ...updatedOrderObj };
              await setDoc(storeRef, { orders: currentOrders }, { merge: true });
            }
          }
        } catch (fErr) {
          console.warn('Direct Firestore stores_data update notice:', fErr);
        }
      }

      // 3. Direct Server API Call
      try {
        await fetch('/api/order/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: currentOrder.id,
            orderNumber: currentOrder.orderNumber,
            phone: currentOrder.customerPhone || cleanPhone,
            action: actionType,
            newAddress: actionType === 'edit_address' ? newAddress : undefined,
            newCity: actionType === 'edit_address' ? newCity : undefined
          })
        });
      } catch (apiErr) {
        console.warn('Server API action sync notice:', apiErr);
      }

      // 4. React State & LocalStorage Updates
      if (setOrders) {
        setOrders(prev => prev.map(o => (String(o.id) === String(currentOrder.id) || String(o.orderNumber) === String(currentOrder.orderNumber)) ? { ...o, ...updatedOrderObj } : o));
      }
      if (setAllStoresData && currentStoreId) {
        setAllStoresData(prev => {
          if (!prev[currentStoreId]) return prev;
          const sOrders = prev[currentStoreId].orders || [];
          const updated = sOrders.map((o: any) => (String(o.id) === String(currentOrder.id) || String(o.orderNumber) === String(currentOrder.orderNumber)) ? { ...o, ...updatedOrderObj } : o);
          return { ...prev, [currentStoreId]: { ...prev[currentStoreId], orders: updated } };
        });
      }

      // 4.5 Update IndexedDB directly if it's there
      if (typeof window !== 'undefined') {
        try {
          const localOrder = await localDb.orders.get(currentOrder.id);
          if (localOrder) {
            await localDb.orders.put({ ...localOrder, ...updatedOrderObj });
          } else {
            // Also try searching by orderNumber just in case
            const allLocal = await localDb.orders.toArray();
            const matchingLocal = allLocal.find(o => String(o.id) === String(currentOrder.id) || String(o.orderNumber) === String(currentOrder.orderNumber));
            if (matchingLocal) {
              await localDb.orders.put({ ...matchingLocal, ...updatedOrderObj });
            }
          }
        } catch (e) {
          console.warn('IndexedDB update warning:', e);
        }
      }

      // 5. Update UI Display
      setOrder(updatedOrderObj);
      if (actionType === 'confirm') {
        setActionDone('confirmed');
      } else if (actionType === 'cancel') {
        setActionDone('cancelled');
      } else if (actionType === 'edit_address') {
        setActionDone('address_updated');
        setIsEditingAddress(false);
      }
    } catch (err: any) {
      setErrorMsg('حدث خطأ أثناء تحديث الطلب، يرجى إعادة المحاولة.');
    } finally {
      setExecuting(false);
      setShowCancelPrompt(false);
    }
  };

  // Format currency display
  const currencyDisplay = order?.currency || 'EGP';
  const totalPriceDisplay = typeof order?.totalPrice === 'number' ? order.totalPrice.toFixed(2) : (order?.totalPrice || order?.total || '0.00');

  // Customer full address display
  const fullAddress = [
    order?.customerAddress || order?.address,
    order?.customerCity || order?.city || order?.governorate,
    'Egypt'
  ].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-slate-900 dark:text-slate-100">
      <div className="max-w-[420px] w-full flex flex-col items-center space-y-5 my-auto">
        
        {/* Top 3D Shopping Bag Icon & Title */}
        <div className="flex flex-col items-center text-center space-y-1.5 pt-2">
          {/* 3D Bag Graphic / Emoji */}
          <div className="relative mb-1">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-4xl select-none transform hover:scale-105 transition-transform">
              🛍️
            </div>
          </div>
          
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Confirm Your Order
          </h1>
          
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {order?.customerName ? `!Hi ${order.customerName}` : 'مرحباً بك!'}
          </p>
        </div>

        {/* Search Box if No Order is Loaded or Error */}
        {(!order || errorMsg) && (
          <div className="w-full bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200/80 dark:border-slate-800 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3" dir="rtl">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <Search size={16} className="text-blue-600" />
              <h2 className="text-xs font-black">البحث عن طلبك وإدارته:</h2>
            </div>
            
            <form onSubmit={handleManualSearchSubmit} className="space-y-2.5">
              <div className="relative">
                <input
                  type="text"
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  placeholder="أدخل رقم الطلب (مثال: 595) أو رقم الموبايل..."
                  className="w-full pl-10 pr-3.5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold outline-none focus:border-blue-500 transition-all text-slate-800 dark:text-slate-100"
                />
                {loading && (
                  <Loader2 size={16} className="absolute left-3.5 top-3.5 text-blue-600 animate-spin" />
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !manualQuery.trim()}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                <span>عرض تفاصيل الطلب وتأكيد الشحن 🔍</span>
              </button>
            </form>
          </div>
        )}

        {/* Error Alert if any */}
        {errorMsg && (
          <div className="w-full p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-2xl flex items-start gap-3 text-rose-700 dark:text-rose-300 text-xs font-bold animate-in fade-in duration-200" dir="rtl">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p className="leading-relaxed">{errorMsg}</p>
          </div>
        )}

        {/* Main Order Card (Matching User Screenshot) */}
        {order && (
          <div className="w-full bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200/70 dark:border-slate-800 shadow-[0_4px_25px_rgba(0,0,0,0.05)] overflow-hidden">
            
            {/* Card Content */}
            <div className="p-5 sm:p-6 space-y-4">
              
              {/* Header: Order Number Left & Store Name Right */}
              <div className="flex items-center justify-between text-xs font-medium border-b border-slate-100 dark:border-slate-800/80 pb-3">
                <span className="text-slate-400 dark:text-slate-500 font-semibold tracking-wider">
                  #{order.orderNumber ? `#${order.orderNumber}` : `#${order.id || '595'}`}
                </span>
                <span className="text-slate-600 dark:text-slate-300 font-bold text-right" dir="rtl">
                  {storeName}
                </span>
              </div>

              {/* Items Section */}
              <div className="space-y-2.5">
                {order.items && order.items.length > 0 ? (
                  order.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-start justify-between gap-3 text-xs">
                      <div className="text-left font-bold text-slate-800 dark:text-slate-200 shrink-0 pt-0.5">
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          {item.price || item.totalPrice || order.totalPrice}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">
                          {currencyDisplay}
                        </div>
                      </div>
                      <div className="text-right text-slate-700 dark:text-slate-300 font-medium leading-relaxed" dir="rtl">
                        {item.name || item.productName || 'منتج'} {item.quantity || item.qty ? `× ${item.quantity || item.qty}` : '× 1'}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-start justify-between gap-3 text-xs">
                    <div className="text-left font-bold text-slate-800 dark:text-slate-200 shrink-0 pt-0.5">
                      <div className="font-extrabold text-slate-900 dark:text-white">
                        {order.totalPrice || order.total || '2440'}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        {currencyDisplay}
                      </div>
                    </div>
                    <div className="text-right text-slate-700 dark:text-slate-300 font-medium leading-relaxed" dir="rtl">
                      {order.productName || order.notes || 'طلب منتجات من المتجر'} × 1
                    </div>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3">
                {/* Total Row */}
                <div className="flex items-center justify-between">
                  <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    {currencyDisplay} {totalPriceDisplay}
                  </div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Total
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3">
                {/* Address Row */}
                <div className="flex items-start justify-end gap-2 text-right">
                  <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium flex-1 text-right" dir="rtl">
                    {fullAddress || 'كفرالشيخ بلطيم مركز البرلس، Cairo, Egypt'}
                  </div>
                  <span className="text-base select-none shrink-0 mt-0.5">📍</span>
                </div>
                
                {/* Edit Address Link */}
                {!actionDone && (
                  <div className="text-left pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditingAddress(!isEditingAddress)}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 hover:underline"
                    >
                      <Edit3 size={12} />
                      <span>تعديل العنوان / Edit Address</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Edit Address Inline Box */}
              {isEditingAddress && (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-2.5 animate-in fade-in duration-200" dir="rtl">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <MapPin size={13} className="text-blue-600" />
                    <span>تعديل عنوان التوصيل بالتفصيل:</span>
                  </div>
                  <textarea
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    rows={2}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-blue-500"
                    placeholder="الشارع / رقم العمارة / علامة مميزة..."
                  />
                  <input
                    type="text"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-blue-500"
                    placeholder="المدينة / المحافظة..."
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleExecuteAction('edit_address')}
                      disabled={executing || !newAddress.trim()}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      {executing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      <span>حفظ العنوان وتأكيد الطلب</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingAddress(false)}
                      className="px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Action Status Feedback if already acted */}
        {actionDone === 'confirmed' && (
          <div className="w-full p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-xs font-bold animate-in fade-in duration-300" dir="rtl">
            <CheckCircle2 size={22} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="font-black text-sm text-emerald-700 dark:text-emerald-300">تم تأكيد طلبك بنجاح! 👍</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">جاري تجهيز الشحنة لتسليمها لشركة الشحن فوراً.</p>
            </div>
          </div>
        )}

        {actionDone === 'cancelled' && (
          <div className="w-full p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl flex items-center gap-3 text-rose-800 dark:text-rose-300 text-xs font-bold animate-in fade-in duration-300" dir="rtl">
            <XCircle size={22} className="text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <p className="font-black text-sm text-rose-700 dark:text-rose-300">تم إلغاء الطلب بنجاح ❌</p>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">تم تسجيل إلغاء الشحنة بناءً على رغبتك.</p>
            </div>
          </div>
        )}

        {actionDone === 'address_updated' && (
          <div className="w-full p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-2xl flex items-center gap-3 text-blue-800 dark:text-blue-300 text-xs font-bold animate-in fade-in duration-300" dir="rtl">
            <MapPin size={22} className="text-blue-600 dark:text-blue-400 shrink-0" />
            <div>
              <p className="font-black text-sm text-blue-700 dark:text-blue-300">تم تحديث العنوان وتأكيد الشحن! 📍</p>
              <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">سيتم توصيل الطلب إلى العنوان الجديد.</p>
            </div>
          </div>
        )}

        {/* Action Buttons (Confirm & Cancel) - Exact Layout from Screenshot */}
        {order && !actionDone && (
          <div className="w-full space-y-2.5 pt-1">
            
            {/* Confirm Order Button - Vibrant Green */}
            <button
              type="button"
              onClick={() => handleExecuteAction('confirm')}
              disabled={executing}
              className="w-full py-4 px-6 bg-[#00c853] hover:bg-[#00b047] active:scale-[0.99] text-white font-bold text-base rounded-[20px] shadow-[0_4px_14px_rgba(0,200,83,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {executing ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Check size={20} strokeWidth={3} />
              )}
              <span>Confirm Order</span>
            </button>

            {/* Cancel Order Button - Soft Pastel Pink/Red */}
            {!showCancelPrompt ? (
              <button
                type="button"
                onClick={() => setShowCancelPrompt(true)}
                disabled={executing}
                className="w-full py-3.5 px-6 bg-[#ffebee] hover:bg-[#ffcdd2] dark:bg-rose-950/40 dark:hover:bg-rose-950/60 active:scale-[0.99] text-[#d32f2f] dark:text-rose-400 font-bold text-base rounded-[20px] transition-all flex items-center justify-center gap-2 border border-rose-100 dark:border-rose-900/30"
              >
                <span>Cancel Order</span>
              </button>
            ) : (
              <div className="w-full p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl space-y-3 text-center animate-in fade-in duration-200" dir="rtl">
                <p className="text-xs font-black text-rose-800 dark:text-rose-300">
                  هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleExecuteAction('cancel')}
                    disabled={executing}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all disabled:opacity-50"
                  >
                    {executing ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                    <span>نعم، إلغاء الطلب</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCancelPrompt(false)}
                    className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl"
                  >
                    تراجع
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Footer Text (Exact text from screenshot) */}
        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium text-center pt-2">
          .This link expires in 24 hours
        </p>

        {/* Track Order Link if order is loaded */}
        {order && (
          <div className="pt-1 text-center">
            <Link
              to={`/track-order?orderNumber=${encodeURIComponent(order?.orderNumber || '')}&phone=${encodeURIComponent((cleanPhone || '').slice(-4))}`}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <Truck size={13} />
              <span>Track Order / تتبع الشحنة</span>
            </Link>
          </div>
        )}

      </div>
    </div>
  );
};

export default CustomerOrderActionPage;
