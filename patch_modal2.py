import re

with open('components/SupplyOrderModal.tsx', 'r') as f:
    content = f.read()

# Add distributedCustodyTotal
old_distributed_treasury = """  const distributedTreasuryTotal = useMemo(() => {
    return (treasuryPayments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [treasuryPayments]);"""
new_distributed_treasury = """  const distributedTreasuryTotal = useMemo(() => {
    return (treasuryPayments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [treasuryPayments]);

  const distributedCustodyTotal = useMemo(() => {
    return custodyPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [custodyPayments]);"""
content = content.replace(old_distributed_treasury, new_distributed_treasury)

# Add custody UI section
old_partner_ui = """                {paymentMethod === 'partner' && ("""
new_custody_ui = """                {paymentMethod === 'custody' && (
                  <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-700/60 animate-in slide-in-from-top-2 duration-200 space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                        <Coins size={16} />
                        <span>توزيع السداد على العهد الشخصية (كاشير / شريك):</span>
                      </label>
                      <button 
                        type="button"
                        onClick={() => {
                           const remaining = Math.max(0, totalCost - distributedCustodyTotal);
                           setCustodyPayments([...custodyPayments, { cashHolderId: '', amount: remaining }]);
                        }}
                        className="flex items-center gap-1 text-[10px] font-bold text-teal-600 bg-teal-50 hover:bg-teal-100 dark:text-teal-400 dark:bg-teal-500/10 dark:hover:bg-teal-500/20 px-2 py-1 rounded transition-colors"
                      >
                        <Plus size={12} />
                        <span>إضافة عهدة</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {custodyPayments.map((cp, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <select
                            value={cp.cashHolderId}
                            onChange={(e) => {
                                const newP = [...custodyPayments];
                                newP[idx].cashHolderId = e.target.value;
                                setCustodyPayments(newP);
                            }}
                            className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:ring-1 focus:ring-teal-500"
                          >
                            <option value="">-- اختر صاحب العهدة --</option>
                            {(cashHolders || []).map(h => (
                                <option key={h.userId} value={h.userId}>{h.userName} (العهدة الحالية: {h.currentBalance} ج.م)</option>
                            ))}
                          </select>
                          <div className="relative w-28">
                             <input
                                type="number"
                                min="0"
                                step="any"
                                value={cp.amount || ''}
                                onChange={(e) => {
                                    const newP = [...custodyPayments];
                                    newP[idx].amount = parseFloat(e.target.value) || 0;
                                    setCustodyPayments(newP);
                                }}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pr-7 pl-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-teal-500"
                             />
                             <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">ج.م</span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => setCustodyPayments(custodyPayments.filter((_, i) => i !== idx))}
                            className="text-rose-400 hover:text-rose-600 p-1.5"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      
                      {custodyPayments.length === 0 && (
                          <div className="text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                             <p className="text-[11px] text-slate-500 font-medium">لم يتم تحديد عهد شخصية. سيتم طلب الفاتورة بالكامل من محفظة التوريد إذا لم تحدد.</p>
                          </div>
                      )}
                    </div>
                    
                    {custodyPayments.length > 0 && (
                        <div className={`p-2.5 rounded-lg border flex items-center justify-between text-xs font-bold ${
                            distributedCustodyTotal === totalCost 
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400' 
                            : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400'
                        }`}>
                            <span>إجمالي الموزع على العهد:</span>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-sm">{distributedCustodyTotal.toLocaleString()} ج.م</span>
                                {distributedCustodyTotal !== totalCost && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-white/50 dark:bg-black/20 rounded">
                                        المتبقي: {(totalCost - distributedCustodyTotal).toLocaleString()} ج.م
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                  </div>
                )}

                {paymentMethod === 'partner' && ("""
content = content.replace(old_partner_ui, new_custody_ui)

with open('components/SupplyOrderModal.tsx', 'w') as f:
    f.write(content)
