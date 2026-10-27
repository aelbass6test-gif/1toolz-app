import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, PackageCheck } from 'lucide-react';
import type { Settings } from '../types';
import { getProductsNeedingMerchantReview } from '../utils/merchantProducts';
import { inAppToast } from '../utils/inAppAlert';

interface Props {
  settings: Settings;
  updateSettings: (updater: Settings | ((prev: Settings) => Settings)) => void;
}

export default function MerchantProductReview({ settings, updateSettings }: Props) {
  const candidates = useMemo(() => getProductsNeedingMerchantReview(settings.products, settings.suppliers, settings.partners), [settings.products, settings.suppliers, settings.partners]);
  const merchants = useMemo(() => {
    const unique = new Map<string, { id: string; name: string }>();
    [...(settings.suppliers || []), ...(settings.partners || [])].forEach((entry: any) => {
      if (entry?.id && !unique.has(String(entry.id))) unique.set(String(entry.id), { id: String(entry.id), name: String(entry.name || entry.id) });
    });
    return [...unique.values()];
  }, [settings.suppliers, settings.partners]);
  const [choices, setChoices] = useState<Record<string, { ownerType: 'store' | 'merchant' | 'shared'; merchantId: string }>>({});

  const save = (productId: string) => {
    const choice = choices[productId];
    if (!choice) return;
    if (choice.ownerType !== 'store' && !choice.merchantId) {
      inAppToast('اختر الوكيل أولاً للمنتج الخاص بالوكيل أو المشترك.', 'warning');
      return;
    }
    const merchant = merchants.find(item => item.id === choice.merchantId);
    updateSettings(current => ({
      ...current,
      products: (current.products || []).map(product => {
        if (product.id !== productId) return product;
        const allocations = Array.isArray(product.merchantAllocations) ? product.merchantAllocations : [];
        const sharedAllocations = choice.ownerType === 'shared'
          ? (allocations.some(allocation => allocation.merchantId === choice.merchantId) ? allocations : [...allocations, {
              merchantId: choice.merchantId,
              merchantName: merchant?.name,
              stock: 0,
              costPrice: Number(product.costPrice) || 0,
              sellingPrice: Number(product.price) || 0
            }])
          : [];
        return {
          ...product,
          ownerType: choice.ownerType,
          merchantId: choice.ownerType === 'store' ? undefined : choice.merchantId,
          merchantName: choice.ownerType === 'store' ? product.merchantName : merchant?.name || product.merchantName,
          merchantIds: choice.ownerType === 'store' ? [] : choice.ownerType === 'shared' ? [...new Set(sharedAllocations.map(allocation => allocation.merchantId))] : [choice.merchantId],
          merchantAllocations: choice.ownerType === 'shared' ? sharedAllocations : []
        };
      })
    }));
    setChoices(prev => { const next = { ...prev }; delete next[productId]; return next; });
    inAppToast('تم حفظ ملكية المنتج بمعرّف صريح.', 'success');
  };

  return <div className="space-y-4 p-4 md:p-6">
    <header className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
      <div className="flex items-center gap-3"><AlertTriangle className="h-6 w-6"/><div><h2 className="text-lg font-black">منتجات تحتاج مراجعة ملكيتها</h2><p className="mt-1 text-sm">لا يُنشأ أي ربط تلقائي بالاسم. اختر المعرّف الصحيح أو صنّف المنتج بضاعة المتجر.</p></div></div>
    </header>
    {candidates.length === 0 ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center font-bold text-emerald-800"><PackageCheck className="mx-auto mb-2"/>لا توجد منتجات معلّقة للمراجعة.</div> : candidates.map((product: any) => {
      const choice = choices[product.id] || { ownerType: 'store' as const, merchantId: '' };
      const name = String(product.merchantName || product.supplierName || 'اسم وكيل قديم غير محدد');
      return <section key={product.id} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:grid-cols-[1fr_180px_240px_auto] md:items-center">
        <div><div className="font-black">{product.name}</div><div className="mt-1 text-xs text-slate-500">SKU: {product.sku || '—'} · الاسم القديم: {name}</div></div>
        <select aria-label={`ملكية ${product.name}`} className="rounded-xl border p-2 text-sm" value={choice.ownerType} onChange={e => setChoices(prev => ({ ...prev, [product.id]: { ...choice, ownerType: e.target.value as any } }))}>
          <option value="store">بضاعة المتجر</option><option value="merchant">بضاعة وكيل</option><option value="shared">مشترك</option>
        </select>
        <select aria-label={`الوكيل لمنتج ${product.name}`} className="rounded-xl border p-2 text-sm" disabled={choice.ownerType === 'store'} value={choice.merchantId} onChange={e => setChoices(prev => ({ ...prev, [product.id]: { ...choice, merchantId: e.target.value } }))}>
          <option value="">اختر الوكيل بالمعرّف</option>{merchants.map(merchant => <option key={merchant.id} value={merchant.id}>{merchant.name} · {merchant.id}</option>)}
        </select>
        <button onClick={() => save(product.id)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white"><Check className="h-4 w-4"/>حفظ القرار</button>
      </section>;
    })}
  </div>;
}
