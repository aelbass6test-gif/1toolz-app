import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Quotation, Store, Settings } from '../types';
import { CheckCircle2, ShieldCheck, Clock, FileText, Phone, MapPin, Building, Package, ExternalLink, AlertTriangle, ArrowRight, Share2, Sparkles, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { db as firebaseDb } from '../services/firebaseClient';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db as localDb } from '../src/lib/db';

interface CustomerQuoteApprovalPageProps {
  allStoresData: Record<string, any>;
  setAllStoresData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  forceSync?: (customStoreData?: any, customUsers?: any) => Promise<void>;
}

export const CustomerQuoteApprovalPage: React.FC<CustomerQuoteApprovalPageProps> = ({
  allStoresData,
  setAllStoresData,
  forceSync
}) => {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const quoteId = id || searchParams.get('id') || searchParams.get('q');
  const urlStoreId = searchParams.get('storeId') || searchParams.get('s') || searchParams.get('store');

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [storeInfo, setStoreInfo] = useState<{ storeName: string; logo?: string; phone?: string } | null>(null);
  const [storeId, setStoreId] = useState<string | null>(urlStoreId);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [approvedSuccess, setApprovedSuccess] = useState<boolean>(false);
  const [customerNotes, setCustomerNotes] = useState<string>('');

  useEffect(() => {
    let isMounted = true;

    const loadQuote = async () => {
      setLoading(true);
      if (!quoteId) {
        if (isMounted) setLoading(false);
        return;
      }

      let foundQuote: Quotation | null = null;
      let foundStoreId: string | null = urlStoreId;
      let foundStoreName = 'المتجر الإلكتروني';
      let foundLogo = '';
      let foundPhone = '';

      // Strategy 1: Search in prop allStoresData
      if (allStoresData && Object.keys(allStoresData).length > 0) {
        Object.entries(allStoresData).forEach(([sId, storeData]: [string, any]) => {
          if (storeData && Array.isArray(storeData.quotations)) {
            const q = storeData.quotations.find(
              (item: Quotation) => item.id === quoteId || item.quotationNumber === quoteId
            );
            if (q) {
              foundQuote = q;
              foundStoreId = sId;
              foundStoreName = storeData.settings?.storeName || storeData.name || 'المتجر';
              foundLogo = storeData.settings?.logoUrl || storeData.settings?.logo || '';
              foundPhone = storeData.settings?.supportPhone || storeData.settings?.phone || '';
            }
          }
        });
      }

      // Strategy 2: If urlStoreId is available, fetch store from Firestore stores_data
      if (!foundQuote && urlStoreId) {
        try {
          const storeRef = doc(firebaseDb, 'stores_data', urlStoreId);
          const storeSnap = await getDoc(storeRef);
          if (storeSnap.exists()) {
            const storeData = storeSnap.data();
            if (Array.isArray(storeData.quotations)) {
              const q = storeData.quotations.find(
                (item: Quotation) => item.id === quoteId || item.quotationNumber === quoteId
              );
              if (q) {
                foundQuote = q;
                foundStoreId = urlStoreId;
                foundStoreName = storeData.settings?.storeName || storeData.name || 'المتجر';
                foundLogo = storeData.settings?.logoUrl || storeData.settings?.logo || '';
                foundPhone = storeData.settings?.supportPhone || storeData.settings?.phone || '';
              }
            }
          }
        } catch (fsErr) {
          console.warn('Firestore store lookup note:', fsErr);
        }
      }

      // Strategy 3: Check LocalStorage backups
      if (!foundQuote && typeof window !== 'undefined') {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('wuilt_backup_') || key.startsWith('store_data_') || key === 'allStoresData')) {
              const raw = localStorage.getItem(key);
              if (raw) {
                const parsed = JSON.parse(raw);
                if (key === 'allStoresData' && typeof parsed === 'object') {
                  Object.entries(parsed).forEach(([sId, sData]: [string, any]) => {
                    const q = sData?.quotations?.find((item: Quotation) => item.id === quoteId || item.quotationNumber === quoteId);
                    if (q) {
                      foundQuote = q;
                      foundStoreId = sId;
                      foundStoreName = sData.settings?.storeName || sData.name || 'المتجر';
                      foundLogo = sData.settings?.logoUrl || sData.settings?.logo || '';
                      foundPhone = sData.settings?.supportPhone || sData.settings?.phone || '';
                    }
                  });
                } else {
                  const sQuotations = parsed.quotations || parsed.storeData?.quotations || [];
                  const q = sQuotations.find((item: Quotation) => item.id === quoteId || item.quotationNumber === quoteId);
                  if (q) {
                    foundQuote = q;
                    foundStoreId = key.replace('wuilt_backup_', '').replace('store_data_', '');
                    foundStoreName = parsed.settings?.storeName || parsed.name || 'المتجر';
                    foundLogo = parsed.settings?.logoUrl || parsed.settings?.logo || '';
                    foundPhone = parsed.settings?.supportPhone || parsed.settings?.phone || '';
                  }
                }
              }
            }
            if (foundQuote) break;
          }
        } catch (lsErr) {
          console.warn('LocalStorage quote lookup note:', lsErr);
        }
      }

      // Strategy 4: Check IndexedDB (Dexie localDb)
      if (!foundQuote) {
        try {
          if (localDb && localDb.quotations) {
            const idbQuote = await localDb.quotations.get(quoteId);
            if (idbQuote) {
              foundQuote = idbQuote;
              foundStoreId = idbQuote.store_id || urlStoreId || null;
            } else {
              const matches = await localDb.quotations.where('quotationNumber').equals(quoteId).toArray();
              if (matches && matches.length > 0) {
                foundQuote = matches[0];
                foundStoreId = matches[0].store_id || urlStoreId || null;
              }
            }
          }
        } catch (idbErr) {
          console.warn('IndexedDB quote lookup note:', idbErr);
        }
      }

      // Strategy 5: Scan Firestore stores_data collection if quote still not found
      if (!foundQuote) {
        try {
          const storesSnap = await getDocs(collection(firebaseDb, 'stores_data'));
          storesSnap.forEach(docSnap => {
            if (foundQuote) return;
            const sData = docSnap.data();
            if (Array.isArray(sData.quotations)) {
              const q = sData.quotations.find(
                (item: Quotation) => item.id === quoteId || item.quotationNumber === quoteId
              );
              if (q) {
                foundQuote = q;
                foundStoreId = docSnap.id;
                foundStoreName = sData.settings?.storeName || sData.name || 'المتجر';
                foundLogo = sData.settings?.logoUrl || sData.settings?.logo || '';
                foundPhone = sData.settings?.supportPhone || sData.settings?.phone || '';
              }
            }
          });
        } catch (fsColErr) {
          console.warn('Firestore stores_data scan note:', fsColErr);
        }
      }

      if (isMounted) {
        if (foundQuote) {
          setQuotation(foundQuote);
          setStoreId(foundStoreId);
          setStoreInfo({ storeName: foundStoreName, logo: foundLogo, phone: foundPhone });
          if ((foundQuote as Quotation).status === 'تمت_الموافقة' || (foundQuote as Quotation).approvedByCustomer) {
            setApprovedSuccess(true);
          }
        }
        setLoading(false);
      }
    };

    loadQuote();

    return () => {
      isMounted = false;
    };
  }, [quoteId, urlStoreId, allStoresData]);

  const handleApproveQuote = async () => {
    if (!quotation || !storeId) return;

    setSubmitting(true);
    try {
      const updatedAt = new Date().toISOString();
      const updatedQuote: Quotation = {
        ...quotation,
        status: 'تمت_الموافقة',
        approvedAt: updatedAt,
        approvedByCustomer: true,
        notes: customerNotes
          ? `${quotation.notes ? quotation.notes + ' | ' : ''}ملاحظة العميل عند التوثيق: ${customerNotes}`
          : quotation.notes
      };

      // 1. Update React state
      setAllStoresData(prev => {
        const currentStore = prev[storeId] || {};
        const currentQuotations: Quotation[] = currentStore.quotations || [];
        const nextQuotations = currentQuotations.map(q =>
          q.id === quotation.id || q.quotationNumber === quotation.quotationNumber ? updatedQuote : q
        );

        const nextData = {
          ...prev,
          [storeId]: {
            ...currentStore,
            quotations: nextQuotations
          }
        };

        if (forceSync) {
          forceSync(nextData);
        }
        return nextData;
      });

      // 2. Persist to Firestore directly
      try {
        const storeRef = doc(firebaseDb, 'stores_data', storeId);
        const storeSnap = await getDoc(storeRef);
        if (storeSnap.exists()) {
          const storeData = storeSnap.data();
          const currentQuotations: Quotation[] = storeData.quotations || [];
          const updatedQuotations = currentQuotations.map((q: Quotation) =>
            q.id === quotation.id || q.quotationNumber === quotation.quotationNumber ? updatedQuote : q
          );
          await setDoc(storeRef, { ...storeData, quotations: updatedQuotations }, { merge: true });
        }
      } catch (fsErr) {
        console.warn('Firestore update on approval note:', fsErr);
      }

      // 3. Persist to IndexedDB
      try {
        if (localDb && localDb.quotations) {
          await localDb.quotations.put({ ...updatedQuote, store_id: storeId });
        }
      } catch (idbErr) {
        console.warn('IndexedDB update on approval note:', idbErr);
      }

      setQuotation(updatedQuote);
      setApprovedSuccess(true);
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch (err) {
      console.error('Error approving quotation:', err);
      alert('حدث خطأ أثناء حفظ الموافقة. يرجى المحاولة مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-600 dark:text-slate-300 dir-rtl" dir="rtl">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-bold text-base">جاري تحميل تفاصيل عرض السعر...</p>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 text-center dir-rtl" dir="rtl">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-800">
          <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4 animate-bounce" />
          <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">عرض السعر غير موجود</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            عذراً، لم نتمكن من العثور على عرض السعر المطلوب. قد يكون الرابط غير صحيح أو تم حذف العرض.
          </p>
        </div>
      </div>
    );
  }

  const isExpired = new Date(quotation.validUntil) < new Date() && quotation.status !== 'تمت_الموافقة';
  const rawShippingFee = Number(quotation.shippingFee) || 0;
  const companyFees = Number(quotation.companyFeesTotal) || 0;
  const roundingAdj = Number(quotation.roundingAdjustment) || 0;
  const roundingAddition = roundingAdj < 0 ? Math.abs(roundingAdj) : 0;
  const totalShippingCombined = rawShippingFee + companyFees + roundingAddition;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20 py-8 px-3 sm:px-6 dir-rtl" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Header Branding Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {storeInfo?.logo ? (
              <img src={storeInfo.logo} alt={storeInfo.storeName} className="w-14 h-14 rounded-2xl object-cover shadow-sm border border-slate-100 dark:border-slate-800" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black text-xl shadow-md">
                {storeInfo?.storeName?.[0] || '🏬'}
              </div>
            )}
            <div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tracking-wide block mb-0.5">عرض سعر رسمي 📜</span>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">{storeInfo?.storeName}</h1>
            </div>
          </div>
          <div className="text-left bg-slate-100 dark:bg-slate-800 px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-slate-500 font-bold block">رقم العرض</span>
            <span className="text-sm font-black text-slate-900 dark:text-white dir-ltr">#{quotation.quotationNumber}</span>
          </div>
        </div>

        {/* Success Confirmation Card */}
        {approvedSuccess && (
          <div className="bg-emerald-500/10 border-2 border-emerald-500/40 rounded-3xl p-6 text-center space-y-3 animate-fade-in shadow-lg">
            <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-black text-emerald-700 dark:text-emerald-400">تمت الموافقة وتأكيد الشحن بنجاح! 🎉</h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
              شكراً لك! تم اعتماد موافقتك وتسجيل الطلب في اللوحه. سيتم التواصل معك قريباً لتنسيق عملية التوصيل والاستلام.
            </p>
            {quotation.approvedAt && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 rounded-full">
                <Clock className="w-3.5 h-3.5" />
                تاريخ التوثيق: {new Date(quotation.approvedAt).toLocaleString('ar-EG')}
              </span>
            )}
          </div>
        )}

        {/* Expired Warning Banner */}
        {isExpired && !approvedSuccess && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <div className="text-xs sm:text-sm font-medium">
              <strong className="font-bold block text-amber-800 dark:text-amber-300">عرض السعر انتهت صلاحيته!</strong>
              هذا العرض انتهت فترة صلاحيته المحددة ({new Date(quotation.validUntil).toLocaleDateString('ar-EG')}). قد تختلف الأسعار أو توفر الممتلكات.
            </div>
          </div>
        )}

        {/* Customer & Quote General Info Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-200/80 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              بيانات العميل والعرض
            </h3>
            <span className={`text-xs px-3 py-1 rounded-full font-bold ${
              approvedSuccess || quotation.status === 'تمت_الموافقة'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : isExpired
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
            }`}>
              {approvedSuccess || quotation.status === 'تمت_الموافقة' ? 'موافق عليه ✓' : isExpired ? 'منتهي الصلاحية ⚠️' : 'بانتظار الموافقة ⏳'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 font-medium block mb-1">العميل والمستلم:</span>
              <p className="font-bold text-slate-900 dark:text-white text-sm">{quotation.customerName || 'عميل كريم'}</p>
              {quotation.customerPhone && (
                <p className="text-slate-500 dark:text-slate-400 font-mono text-[11px] mt-0.5">{quotation.customerPhone}</p>
              )}
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 font-medium block mb-1">صلاحية العرض لغاية:</span>
              <p className="font-bold text-slate-900 dark:text-white text-sm">
                {new Date(quotation.validUntil).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Products Table Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-200/80 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Package className="w-4 h-4 text-emerald-600" />
            تفاصيل المنتجات والأصناف ({quotation.items?.length || 0})
          </h3>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {quotation.items?.map((item, idx) => {
              const itemTotal = (item.price * item.quantity) - (item.discount || 0);
              return (
                <div key={idx} className="py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500 text-xs shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">{item.name}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        الكمية: <span className="font-bold text-slate-700 dark:text-slate-300">{item.quantity}</span> × {item.price.toLocaleString('ar-EG')} ج.م
                        {item.discount > 0 && <span className="text-emerald-600 font-bold mr-1.5">(خصم: {item.discount} ج.م)</span>}
                      </p>
                    </div>
                  </div>
                  <div className="text-left font-black text-slate-900 dark:text-white text-sm shrink-0">
                    {itemTotal.toLocaleString('ar-EG')} <span className="text-[10px] text-slate-500 font-normal">ج.م</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals Breakdown */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-700 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>إجمالي المنتجات:</span>
              <span className="font-bold text-slate-900 dark:text-white">{quotation.subtotal?.toLocaleString('ar-EG')} ج.م</span>
            </div>

            {totalShippingCombined > 0 && (
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>مصاريف الشحن والتسليم:</span>
                <span className="font-bold text-slate-900 dark:text-white">{totalShippingCombined.toLocaleString('ar-EG')} ج.م</span>
              </div>
            )}

            {quotation.discount > 0 && (
              <div className="flex justify-between text-emerald-600 font-bold">
                <span>خصم خاص على العرض:</span>
                <span>-{quotation.discount.toLocaleString('ar-EG')} ج.م</span>
              </div>
            )}

            <div className="border-t border-slate-200 dark:border-slate-700 pt-2.5 mt-2 flex justify-between items-center">
              <span className="font-black text-slate-900 dark:text-white text-sm">الصافي الإجمالي المطلوب:</span>
              <span className="font-black text-lg text-emerald-600 dark:text-emerald-400">
                {quotation.total.toLocaleString('ar-EG')} <span className="text-xs font-bold text-slate-500">ج.م</span>
              </span>
            </div>
          </div>
        </div>

        {/* Customer Notes Input & Action Button Card */}
        {!approvedSuccess && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                ملاحظات أو تعليمات خاصة لعملية التوصيل (اختياري):
              </label>
              <textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="مثال: يرجى الاتصال قبل الوصول بربع ساعة، أو أي تفاصيل أخرى..."
                rows={2}
                className="w-full text-xs p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white"
              />
            </div>

            <button
              onClick={handleApproveQuote}
              disabled={submitting}
              className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-black text-base shadow-xl shadow-emerald-600/20 active:scale-[0.99] transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  جاري تسجيل الموافقة...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-6 h-6" />
                  أوافق على العرض وأكد الشحن
                </>
              )}
            </button>
            <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
              ضغطك على هذا الزر يعني تأكيدك المباشر لطلب العرض والموافقة على جميع تفاصيل الأسعار والشحن الموضحة أعلاه.
            </p>
          </div>
        )}

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-400 py-4 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          معتمد ومؤمن بواسطة نظام إدارة الفواتير والطلبات الذكي
        </div>

      </div>
    </div>
  );
};

export default CustomerQuoteApprovalPage;
