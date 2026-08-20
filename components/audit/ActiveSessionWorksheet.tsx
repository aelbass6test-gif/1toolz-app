import React, { useState, useMemo, useEffect } from 'react';
import { 
    Search, Filter, MapPin, Camera, Mic, Volume2, VolumeX, 
    Target, ClipboardList, CheckCircle, AlertCircle, Save, Info,
    Plus, Minus, RefreshCw, XCircle, Trash2, CameraOff, AlertTriangle, Play
} from 'lucide-react';
import { Settings, Product, InventoryAuditSession, InventoryAuditItemDiscrepancy } from '../../types';
import { audioSynth } from '../../utils/audioSynth';
import confetti from 'canvas-confetti';

interface ActiveSessionWorksheetProps {
    settings: Settings;
    setSettings: (updater: React.SetStateAction<Settings>) => void;
    currentUser: any;
    onCloseSession: () => void;
    onAlert: (title: string, msg: string, type: 'success' | 'warning' | 'danger' | 'info') => void;
    onConfirm: (title: string, msg: string, onConfirm: () => void, type?: string) => void;
}

export default function ActiveSessionWorksheet({
    settings,
    setSettings,
    currentUser,
    onCloseSession,
    onAlert,
    onConfirm
}: ActiveSessionWorksheetProps) {
    // 1. Core States
    const [auditStartTime] = useState(Date.now());
    const [sessionTitle, setSessionTitle] = useState('جلسة جرد سريعة - ' + new Date().toLocaleDateString('ar-EG'));
    const [selectedWarehouse, setSelectedWarehouse] = useState('all');
    const [selectedScope, setSelectedScope] = useState('all');
    const [activeZone, setActiveZone] = useState('');
    const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
    const [isFocusMode, setIsFocusMode] = useState(false);
    
    // Worksheet counts and metadata: key is "productId_variantId" or "productId"
    const [worksheet, setWorksheet] = useState<Record<string, { 
        actualQty: number; 
        method: 'correction' | 'scrap' | 'surplus' | 'gift' | 'missing'; 
        notes: string; 
        zone: string;
        proofImage?: string;
    }>>({});

    const [searchQuery, setSearchQuery] = useState('');
    const [filterMode, setFilterMode] = useState<'all' | 'discrepancy' | 'matching'>('all');
    const [zoneFilter, setZoneFilter] = useState('all');

    // Barcode entry and Scanner States
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scannerError, setScannerError] = useState<string | null>(null);
    const [manualBarcode, setManualBarcode] = useState('');

    // Voice control
    const [isListening, setIsListening] = useState(false);

    // Speak helper
    const speak = (text: string) => {
        if (!isVoiceEnabled) return;
        audioSynth.speak(text);
    };

    // Calculate flat list of products to be audited based on chosen scope/warehouse
    const scopedProductsList = useMemo(() => {
        const list: {
            key: string; // product_variant or product
            productId: string;
            variantId?: string;
            name: string;
            sku: string;
            systemQty: number;
            costPrice: number;
            barcode?: string;
        }[] = [];

        const allProducts = settings.products || [];
        const filteredByScope = selectedScope === 'all' 
            ? allProducts 
            : allProducts.filter(p => p.collectionId === selectedScope);

        filteredByScope.forEach(p => {
            if (p.hasVariants && p.variants && p.variants.length > 0) {
                p.variants.forEach(v => {
                    const variantDesc = Object.entries(v.options || {})
                        .map(([k, val]) => `${k}: ${val}`)
                        .join(' | ');

                    const warehouseQty = selectedWarehouse === 'all' 
                        ? (v.stockQuantity || 0)
                        : (v.warehouseStock?.[selectedWarehouse] || 0);

                    const costPrice = v.costPrice ?? p.costPrice ?? 0;

                    list.push({
                        key: `${p.id}_${v.id}`,
                        productId: p.id,
                        variantId: v.id,
                        name: `${p.name} (${variantDesc})`,
                        sku: v.sku || p.sku || '',
                        systemQty: warehouseQty,
                        costPrice: costPrice,
                        barcode: (v as any).barcode || (p as any).barcode || v.sku || p.sku
                    });
                });
            } else {
                const warehouseQty = selectedWarehouse === 'all' 
                    ? (p.stockQuantity || 0)
                    : (p.warehouseStock?.[selectedWarehouse] || 0);

                const costPrice = p.costPrice || 0;

                list.push({
                    key: p.id,
                    productId: p.id,
                    name: p.name,
                    sku: p.sku || '',
                    systemQty: warehouseQty,
                    costPrice: costPrice,
                    barcode: (p as any).barcode || p.sku || ''
                });
            }
        });

        return list;
    }, [settings.products, selectedScope, selectedWarehouse]);

    // Live Metrics calculations
    const stats = useMemo(() => {
        let totalChecked = 0;
        let totalAudited = 0; 
        let totalWithDiscrepancies = 0;
        let totalSystemQty = 0;
        let totalActualQty = 0;
        let totalNetValueAdjustment = 0;
        let surplusCount = 0;
        let shortageCount = 0;

        scopedProductsList.forEach(row => {
            const data = worksheet[row.key];
            if (data !== undefined) totalAudited += 1;
            
            const effectiveData = data || { actualQty: row.systemQty, method: 'correction', notes: '' };
            totalChecked += 1;
            totalSystemQty += row.systemQty;
            totalActualQty += effectiveData.actualQty;

            const diff = effectiveData.actualQty - row.systemQty;
            if (diff !== 0) {
                totalWithDiscrepancies += 1;
                const valueOfDiff = diff * row.costPrice;
                totalNetValueAdjustment += valueOfDiff;

                if (diff > 0) surplusCount += 1;
                if (diff < 0) shortageCount += 1;
            }
        });

        const progressPercent = scopedProductsList.length > 0 ? (totalAudited / scopedProductsList.length) * 100 : 0;
        
        // Calculate velocity (items per minute)
        const elapsedMinutes = (Date.now() - auditStartTime) / 60000;
        const velocity = elapsedMinutes > 0 ? totalAudited / elapsedMinutes : 0;
        const etc = velocity > 0 ? (scopedProductsList.length - totalAudited) / velocity : 0;

        return {
            totalChecked,
            totalAudited,
            progressPercent: Math.round(progressPercent),
            velocity: Math.round(velocity * 10) / 10,
            etc: Math.round(etc),
            totalWithDiscrepancies,
            totalSystemQty,
            totalActualQty,
            totalNetValueAdjustment,
            surplusCount,
            shortageCount
        };
    }, [scopedProductsList, worksheet, auditStartTime]);

    // Milestones sound feedback & confetti
    const [milestonesReached, setMilestonesReached] = useState<number[]>([]);
    useEffect(() => {
        const milestones = [25, 50, 75, 100];
        milestones.forEach(m => {
            if (stats.progressPercent >= m && !milestonesReached.includes(m)) {
                setMilestonesReached(prev => [...prev, m]);
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#4f46e5', '#10b981', '#f59e0b']
                });
                speak(`رائع يا بطل! تم إنجاز ${m} بالمية من الكميات المجرودة بنجاح`);
            }
        });
    }, [stats.progressPercent, milestonesReached]);

    // Handle single count update (increment/decrement)
    const updateCountValue = (key: string, newValue: number) => {
        const cleanValue = Math.max(0, newValue);
        audioSynth.playTone('click');
        
        setWorksheet(prev => {
            const currentItem = prev[key] || { actualQty: 0, method: 'correction', notes: '', zone: activeZone };
            const sysQty = scopedProductsList.find(r => r.key === key)?.systemQty || 0;
            const diff = cleanValue - sysQty;

            let defaultMethod = currentItem.method;
            if (diff < 0) {
                if (currentItem.method === 'surplus' || currentItem.method === 'correction') {
                    defaultMethod = 'scrap';
                }
            } else if (diff > 0) {
                if (currentItem.method === 'scrap' || currentItem.method === 'missing' || currentItem.method === 'correction') {
                    defaultMethod = 'surplus';
                }
            } else {
                defaultMethod = 'correction';
            }

            return {
                ...prev,
                [key]: {
                    ...currentItem,
                    actualQty: cleanValue,
                    method: defaultMethod,
                    zone: currentItem.zone || activeZone 
                }
            };
        });
    };

    // Fast Barcode Scanned Handlers
    const handleBarcodeScanned = (code: string) => {
        const matched = scopedProductsList.find(item => 
            item.sku.toLowerCase() === code.toLowerCase() || 
            item.barcode === code
        );

        if (matched) {
            const currentQty = worksheet[matched.key]?.actualQty ?? 0;
            updateCountValue(matched.key, currentQty + 1);
            audioSynth.playTone('success');
            speak(`تم رصد باركود: ${matched.name}. أضفنا واحد`);
            onAlert('تم المسح', `تم التعرف على الصنف: ${matched.name}`, 'success');
        } else {
            audioSynth.playTone('error');
            speak(`الباركود غير معرف في نطاق الجرد`);
            onAlert('غير معرف', `رمز الباركود (${code}) غير مدرج في النطاق الحالي.`, 'warning');
        }
    };

    // Filtered items of worksheet rows
    const filteredWorksheetRows = useMemo(() => {
        return scopedProductsList.filter(row => {
            const matchesSearch = 
                row.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                row.sku.toLowerCase().includes(searchQuery.toLowerCase());

            if (!matchesSearch) return false;

            const data = worksheet[row.key] || { actualQty: row.systemQty, method: 'correction', notes: '', zone: '' };
            const diff = data.actualQty - row.systemQty;

            if (filterMode === 'discrepancy') return diff !== 0;
            if (filterMode === 'matching') return diff === 0;

            if (zoneFilter !== 'all') {
                const itemZone = data.zone || '';
                if (zoneFilter === 'unassigned') {
                    if (itemZone !== '') return false;
                } else {
                    if (itemZone !== zoneFilter) return false;
                }
            }

            return true;
        });
    }, [scopedProductsList, worksheet, searchQuery, filterMode, zoneFilter]);

    // Finalize audit and post to database
    const handleFinalizeAndSubmit = async () => {
        if (Object.keys(worksheet).length === 0) {
            onAlert('تنبيه', 'لم يتم عد أي صنف بعد! يرجى إدخال كمية جردية واحدة على الأقل.', 'warning');
            return;
        }

        onConfirm(
            'اعتماد وترحيل تسوية الجرد؟ 🧾',
            'بمجرد الاعتماد، سيتم تعديل كميات الأصناف المجرودة فوراً وتحديث أرصدة المخازن على المنظومة الموحدة وتسجيل العملية بالكامل في تقارير الحركة.',
            async () => {
                try {
                    const auditDateStr = new Date().toISOString();
                    
                    // 1. Compute changes
                    const updatedProducts = [...(settings.products || [])].map(product => {
                        let updatedProduct = { ...product };

                        if (product.hasVariants && product.variants && product.variants.length > 0) {
                            const updatedVariants = product.variants.map(v => {
                                const wsKey = `${product.id}_${v.id}`;
                                if (worksheet[wsKey] !== undefined) {
                                    const newStockQty = worksheet[wsKey].actualQty;
                                    let updatedVariant = { ...v };

                                    if (selectedWarehouse === 'all') {
                                        updatedVariant.stockQuantity = newStockQty;
                                    } else {
                                        if (!updatedVariant.warehouseStock) updatedVariant.warehouseStock = {};
                                        updatedVariant.warehouseStock[selectedWarehouse] = newStockQty;
                                        const total = Object.values(updatedVariant.warehouseStock).reduce((sum, val) => sum + (val || 0), 0);
                                        updatedVariant.stockQuantity = total;
                                    }

                                    if (!updatedVariant.lastAudited) updatedVariant.lastAudited = {};
                                    updatedVariant.lastAudited[selectedWarehouse] = auditDateStr;

                                    return updatedVariant;
                                }
                                return v;
                            });

                            const totalStock = updatedVariants.reduce((s, vr) => s + (vr.stockQuantity || 0), 0);
                            updatedProduct.variants = updatedVariants;
                            updatedProduct.stockQuantity = totalStock;
                            updatedProduct.inStock = totalStock > 0;

                            if (!updatedProduct.lastAudited) updatedProduct.lastAudited = {};
                            updatedProduct.lastAudited[selectedWarehouse] = auditDateStr;
                        } else {
                            const wsKey = product.id;
                            if (worksheet[wsKey] !== undefined) {
                                const newStockQty = worksheet[wsKey].actualQty;

                                if (selectedWarehouse === 'all') {
                                    updatedProduct.stockQuantity = newStockQty;
                                } else {
                                    if (!updatedProduct.warehouseStock) updatedProduct.warehouseStock = {};
                                    updatedProduct.warehouseStock[selectedWarehouse] = newStockQty;
                                    const total = Object.values(updatedProduct.warehouseStock).reduce((sum, val) => sum + (val || 0), 0);
                                    updatedProduct.stockQuantity = total;
                                }

                                updatedProduct.inStock = updatedProduct.stockQuantity > 0;

                                if (!updatedProduct.lastAudited) updatedProduct.lastAudited = {};
                                updatedProduct.lastAudited[selectedWarehouse] = auditDateStr;
                            }
                        }

                        return updatedProduct;
                    });

                    // 2. Format discrepancies list for history
                    const discrepancies: InventoryAuditItemDiscrepancy[] = [];
                    let totalSystemQty = 0;
                    let totalActualQty = 0;
                    let totalVarianceQty = 0;
                    let totalVarianceValue = 0;

                    scopedProductsList.forEach(item => {
                        const countData = worksheet[item.key];
                        const actual = countData ? countData.actualQty : item.systemQty;
                        const diff = actual - item.systemQty;

                        totalSystemQty += item.systemQty;
                        totalActualQty += actual;
                        totalVarianceQty += diff;
                        totalVarianceValue += diff * item.costPrice;

                        // Include items that were explicitly counted, even if variance is 0, to set a baseline timestamp
                        if (countData) {
                            discrepancies.push({
                                productId: item.productId,
                                variantId: item.variantId,
                                name: item.name,
                                sku: item.sku,
                                systemQty: item.systemQty,
                                actualQty: actual,
                                variance: diff,
                                costPrice: item.costPrice,
                                varianceValue: diff * item.costPrice,
                                method: countData.method || 'correction',
                                notes: countData.notes || 'تسوية يدوية مباشرة',
                                zone: countData.zone || activeZone || 'عام'
                            });
                        }
                    });

                    // 3. Create Session Object
                    const sessionLog: InventoryAuditSession = {
                        id: `audit-${Date.now()}`,
                        title: sessionTitle.trim() || 'جرد وتعديل مباشر للأرصدة',
                        date: auditDateStr,
                        performedBy: currentUser?.fullName || currentUser?.email || 'التاجر الرئيسي',
                        scope: selectedScope,
                        warehouseId: selectedWarehouse,
                        totalSystemQty,
                        totalActualQty,
                        totalVarianceQty,
                        totalVarianceValue,
                        totalItemsAudited: Object.keys(worksheet).length,
                        discrepancies,
                        notes: `تم إنهاء الجرد المباشر الميداني وتطبيق الترحيل المالي وتصحيح الأرصدة بنجاح.`
                    };

                    // 4. Update Activity Logs
                    const activityLog = {
                        id: `log-${Date.now()}`,
                        user: currentUser?.fullName || 'التاجر',
                        action: 'جرد مباشر وتسوية',
                        details: `تم ترحيل جرد المخزن الكلي بنجاح لعدد ${discrepancies.length} أصناف عجز/زيادة بتسوية قيمتها ${totalVarianceValue.toLocaleString()} ج.م`,
                        date: new Date().toLocaleDateString('ar-EG'),
                        timestamp: Date.now()
                    };

                    // 5. Commit to settings
                    setSettings(prev => ({
                        ...prev,
                        products: updatedProducts,
                        inventoryAudits: [sessionLog, ...(prev.inventoryAudits || [])],
                        activityLogs: [activityLog, ...(prev.activityLogs || [])]
                    }));

                    speak('مبروك يا بطل، تم ترحيل الجرد وحفظ التسويات في المخزن بنجاح.');
                    onAlert('تم الاعتماد والترحيل', 'تم تحديث أرصدة السلع والمنتجات وتسوية الدفاتر المالية الكلية بنجاح!', 'success');
                    onCloseSession();
                } catch (err) {
                    console.error(err);
                    onAlert('خطأ', 'فشل في ترحيل الجرد، يرجى المحاولة لاحقاً', 'danger');
                }
            }
        );
    };

    return (
        <div className={`space-y-6 dir-rtl text-right animate-in fade-in duration-300 ${isFocusMode ? 'max-w-4xl mx-auto' : ''}`}>
            
            {/* Header Form */}
            {!isFocusMode && (
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="space-y-1">
                            <h3 className="text-sm font-black text-slate-850 dark:text-white flex items-center gap-2">
                                <ClipboardList className="text-indigo-600" size={18} />
                                بدء جلسة جرد ميداني وتعديل مباشر للأرصدة
                            </h3>
                            <p className="text-[10px] text-slate-400 font-bold">تقوم بالعد الفعلي وتأكيد الكميات التي على الأرفف، وسيقوم النظام بتسوية الفروقات بمجرد الحفظ والاعتماد.</p>
                        </div>
                        <button 
                            onClick={onCloseSession}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black transition-all"
                        >
                            إلغاء والعودة للرئيسية
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="text-[11px] text-slate-500 font-black block mb-1">اسم/عنوان الجلسة الحالي *</label>
                            <input 
                                type="text"
                                required
                                value={sessionTitle}
                                onChange={e => setSessionTitle(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/10"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] text-slate-500 font-black block mb-1">المستودع المستهدف للجرد</label>
                            <select 
                                value={selectedWarehouse}
                                onChange={e => setSelectedWarehouse(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/10"
                            >
                                <option value="all">كل الأرصدة التراكمية</option>
                                {(settings.warehouses || []).map(w => (
                                    <option key={w.id} value={w.id}>مستودع: {w.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[11px] text-slate-500 font-black block mb-1">المجموعة أو التصنيف المجرود</label>
                            <select 
                                value={selectedScope}
                                onChange={e => setSelectedScope(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/10"
                            >
                                <option value="all">كل الأصناف دون استثناء</option>
                                {(settings.collections || []).map(c => (
                                    <option key={c.id} value={c.id}>تصنيف: {c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* Smart Tracking stats widgets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Milestone Progress Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between shadow-sm">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] text-slate-400 font-black">معدل الإنجاز وسرعة العد</span>
                            <span className="text-xs font-black text-indigo-600">{stats.progressPercent}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
                            <div className="h-full bg-indigo-600 rounded-full transition-all duration-300" style={{ width: `${stats.progressPercent}%` }} />
                        </div>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                        <span>السرعة: {stats.velocity} صنف/دقيقة</span>
                        <span>متبقي تقريباً: {stats.etc} دقيقة</span>
                    </div>
                </div>

                {/* Scans & Quantities counted */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between shadow-sm">
                    <div>
                        <span className="text-[10px] text-slate-400 block mb-1">إجمالي الأصناف المجرودة والقطع</span>
                        <div className="text-2xl font-black text-slate-850 dark:text-white">
                            {stats.totalAudited} <small className="text-xs text-slate-400 font-normal">من أصل {scopedProductsList.length} صنف</small>
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mt-2">إجمالي القطع الفعلية المدخلة: {stats.totalActualQty} قطعة.</p>
                </div>

                {/* Net Financial Value Adjustments */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between shadow-sm">
                    <div>
                        <span className="text-[10px] text-slate-400 block mb-1">الأثر المالي المتوقع للتسوية الحالية</span>
                        <div className={`text-2xl font-black font-sans leading-none ${stats.totalNetValueAdjustment >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {stats.totalNetValueAdjustment >= 0 ? '+' : ''}{stats.totalNetValueAdjustment.toLocaleString()} <span className="text-xs">ج.م</span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold mt-2">
                        <span>زيادات: {stats.surplusCount}</span>
                        <span>عجز: {stats.shortageCount}</span>
                    </div>
                </div>
            </div>

            {/* Smart Tools Bar */}
            <div className="p-4 bg-indigo-600 rounded-2xl text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md relative overflow-hidden">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-xl">
                        <Target className="text-amber-400" size={20} />
                    </div>
                    <div>
                        <h4 className="text-xs font-black">أدوات الجرد السريع بالكاميرا والصوت</h4>
                        <p className="text-[9px] text-indigo-100">استخدم وضع التركيز لتصغير الشاشة وزيادة فاعلية حصر البضائع.</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* Focus mode toggle */}
                    <button 
                        onClick={() => {
                            setIsFocusMode(!isFocusMode);
                            audioSynth.playTone('info');
                        }}
                        className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${isFocusMode ? 'bg-amber-400 text-slate-900' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                    >
                        <Target size={14} />
                        وضع التركيز
                    </button>

                    {/* Voice Assist toggle */}
                    <button 
                        onClick={() => {
                            setIsVoiceEnabled(!isVoiceEnabled);
                            audioSynth.playTone('info');
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${isVoiceEnabled ? 'bg-white text-indigo-600' : 'bg-indigo-700 text-indigo-100'}`}
                    >
                        {isVoiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                        {isVoiceEnabled ? 'الصوت نشط' : 'كتم الصوت'}
                    </button>

                    {/* Camera Scanner Trigger */}
                    <button 
                        onClick={() => setIsScannerOpen(true)}
                        className="flex-1 sm:flex-none px-5 py-2 bg-white hover:bg-indigo-50 text-indigo-600 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                        <Camera size={14} />
                        قارئ الكاميرا
                    </button>
                </div>
            </div>

            {/* Main Worksheet Layout Grid */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
                
                {/* Search & Filter Rows */}
                <div className="p-4 sm:p-5 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/10 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                            <MapPin size={18} />
                        </div>
                        <div className="flex-1">
                            <span className="text-[9px] text-slate-400 block font-bold mb-0.5">الرف أو القطاع النشط حالياً</span>
                            <input 
                                type="text"
                                value={activeZone}
                                onChange={e => setActiveZone(e.target.value)}
                                placeholder="موقع الصنف..."
                                className="bg-transparent border-none outline-none text-xs font-black dark:text-white w-full"
                            />
                        </div>
                    </div>

                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden lg:block" />

                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-[1.5]">
                        {/* Worksheet search */}
                        <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 flex-1">
                            <Search size={14} className="text-slate-400 ml-1.5" />
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="ابحث باسم المنتج، SKU أو الرف..."
                                className="bg-transparent border-none outline-none text-xs font-bold dark:text-white w-full"
                            />
                        </div>

                        {/* Filter chip selectors */}
                        <div className="flex gap-1">
                            <button 
                                onClick={() => setFilterMode('all')}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-all ${filterMode === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500'}`}
                            >
                                الكل
                            </button>
                            <button 
                                onClick={() => setFilterMode('discrepancy')}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-all ${filterMode === 'discrepancy' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500'}`}
                            >
                                الفوارق
                            </button>
                        </div>
                    </div>
                </div>

                {/* Rows listing */}
                {filteredWorksheetRows.length === 0 ? (
                    <div className="p-16 text-center text-slate-400 space-y-2">
                        <AlertCircle className="mx-auto" size={32} />
                        <p className="text-xs font-bold">لا توجد أصناف تطابق فلاتر البحث حالياً</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredWorksheetRows.map(row => {
                            const itemData = worksheet[row.key] || { actualQty: row.systemQty, method: 'correction', notes: '', zone: '' };
                            const isCounted = worksheet[row.key] !== undefined;
                            const diff = itemData.actualQty - row.systemQty;

                            return (
                                <div key={row.key} className={`p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all ${isCounted ? 'bg-emerald-50/20 dark:bg-emerald-950/5 border-r-4 border-r-emerald-500' : 'hover:bg-slate-50/50'}`}>
                                    
                                    {/* Product Meta */}
                                    <div className="space-y-1.5 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="font-black text-slate-850 dark:text-white text-xs">{row.name}</h4>
                                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[9px] font-mono font-bold rounded">{row.sku}</span>
                                            {itemData.zone && <span className="text-[9px] text-indigo-500 font-bold flex items-center gap-0.5"><MapPin size={9} /> {itemData.zone}</span>}
                                        </div>

                                        <div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold">
                                            <span>💻 رصيد النظام: <strong className="text-slate-700 dark:text-slate-300 font-mono">{row.systemQty}</strong></span>
                                            {isCounted && (
                                                <span>📊 الفارق: 
                                                    <span className={`font-mono px-1.5 py-0.5 rounded text-[9px] font-black ${diff < 0 ? 'bg-rose-50 text-rose-650' : 'bg-emerald-50 text-emerald-650'}`}>
                                                        {diff > 0 ? '+' : ''}{diff}
                                                    </span>
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Interactive count inputs */}
                                    <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                                        
                                        {/* Dynamic resolution method */}
                                        {isCounted && diff !== 0 && (
                                            <select 
                                                value={itemData.method}
                                                onChange={e => {
                                                    const m = e.target.value as any;
                                                    setWorksheet(prev => ({
                                                        ...prev,
                                                        [row.key]: { ...prev[row.key]!, method: m }
                                                    }));
                                                }}
                                                className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black text-slate-700 dark:text-slate-300 outline-none"
                                            >
                                                <option value="correction">تصحيح مباشر</option>
                                                <option value="scrap">شطب هالك/تالف</option>
                                                <option value="surplus">بضاعة زائدة</option>
                                                <option value="gift">هدية ترويجية</option>
                                                <option value="missing">مفقود</option>
                                            </select>
                                        )}

                                        {/* Specific item Notes */}
                                        <input 
                                            type="text"
                                            value={itemData.notes}
                                            onChange={e => {
                                                const v = e.target.value;
                                                setWorksheet(prev => ({
                                                    ...prev,
                                                    [row.key]: { 
                                                        ...(prev[row.key] || { actualQty: row.systemQty, method: 'correction', notes: '', zone: activeZone }),
                                                        notes: v
                                                    }
                                                }));
                                            }}
                                            placeholder="ملاحظات الصنف..."
                                            className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-bold dark:text-white outline-none w-28 placeholder:text-slate-300"
                                        />

                                        {/* Shelf Zone custom override */}
                                        <input 
                                            type="text"
                                            value={itemData.zone}
                                            onChange={e => {
                                                const z = e.target.value;
                                                setWorksheet(prev => ({
                                                    ...prev,
                                                    [row.key]: { 
                                                        ...(prev[row.key] || { actualQty: row.systemQty, method: 'correction', notes: '', zone: z }),
                                                        zone: z
                                                    }
                                                }));
                                            }}
                                            placeholder="الرف/القطاع..."
                                            className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-bold dark:text-white outline-none w-20 placeholder:text-slate-300"
                                        />

                                        {/* Standard input buttons */}
                                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <button 
                                                onClick={() => updateCountValue(row.key, itemData.actualQty - 1)}
                                                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors"
                                            >
                                                <Minus size={12} />
                                            </button>
                                            
                                            <input 
                                                type="number"
                                                value={isCounted ? itemData.actualQty : ''}
                                                onChange={e => {
                                                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                                                    updateCountValue(row.key, val);
                                                }}
                                                placeholder={row.systemQty.toString()}
                                                className="w-12 bg-transparent text-center font-black font-mono text-xs dark:text-white outline-none"
                                            />

                                            <button 
                                                onClick={() => updateCountValue(row.key, itemData.actualQty + 1)}
                                                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors"
                                            >
                                                <Plus size={12} />
                                            </button>
                                        </div>

                                        {/* Reset count button */}
                                        {isCounted && (
                                            <button 
                                                onClick={() => {
                                                    setWorksheet(prev => {
                                                        const copy = { ...prev };
                                                        delete copy[row.key];
                                                        return copy;
                                                    });
                                                    audioSynth.playTone('info');
                                                }}
                                                className="p-2 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl transition-all"
                                                title="إعادة التصفير"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}

                                        {/* Confirm/Audit button if uncounted */}
                                        {!isCounted && (
                                            <button 
                                                onClick={() => updateCountValue(row.key, row.systemQty)}
                                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 border border-indigo-100/30"
                                            >
                                                تأكيد المطابقة
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Camera Barcode Scanner Modal */}
            {isScannerOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/70 dark:bg-black/85 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-950 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-5 bg-indigo-600 text-white flex justify-between items-center">
                            <h4 className="font-extrabold text-sm flex items-center gap-2">
                                📷 قارئ الباركود بالكاميرا (سريع وذكي)
                            </h4>
                            <button 
                                onClick={() => {
                                    setIsScannerOpen(false);
                                    audioSynth.playTone('info');
                                }}
                                className="text-white bg-white/10 hover:bg-white/20 p-2 rounded-full text-xs font-bold transition-all"
                            >
                                إغلاق ✕
                            </button>
                        </div>

                        <div className="p-6 flex flex-col items-center gap-4 text-center">
                            <div className="w-full bg-slate-50 dark:bg-slate-900 p-3 rounded-2xl border border-slate-150 dark:border-slate-850 flex items-center justify-between text-xs">
                                <span className="text-slate-500 font-bold">📍 الرف / القطاع الحالي للعد:</span>
                                <input 
                                    type="text"
                                    value={activeZone}
                                    onChange={e => setActiveZone(e.target.value)}
                                    placeholder="بلا رف محدد"
                                    className="font-black text-indigo-600 dark:text-indigo-400 bg-transparent border-b border-dashed border-indigo-300 outline-none px-1 w-36 text-center"
                                />
                            </div>

                            <div className="w-full aspect-[4/3] max-w-sm rounded-2xl overflow-hidden border-2 border-dashed border-indigo-400 bg-black flex flex-col items-center justify-center relative p-4">
                                <CameraOff className="text-slate-600 mb-2" size={32} />
                                <p className="text-slate-400 text-xs">
                                    المتصفح يمنع تشغيل الكاميرا داخل إطار المعاينة.<br />
                                    الرجاء كتابة الباركود يدوياً بالأسفل للتحقق الفوري.
                                </p>
                            </div>

                            {/* Manual Entry Fallback */}
                            <div className="w-full border-t border-slate-100 dark:border-slate-900 pt-4 mt-2">
                                <label className="text-[10px] text-slate-400 dark:text-slate-500 font-black block mb-2 text-right">أدخل الباركود أو رمز SKU يدوياً للعد السريع:</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text"
                                        value={manualBarcode}
                                        onChange={e => setManualBarcode(e.target.value)}
                                        placeholder="أدخل رمز SKU أو الباركود"
                                        className="flex-1 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-none dark:text-white"
                                    />
                                    <button 
                                        onClick={() => {
                                            if (manualBarcode.trim()) {
                                                handleBarcodeScanned(manualBarcode.trim());
                                                setManualBarcode('');
                                            }
                                        }}
                                        className="px-4 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 text-indigo-600 rounded-xl text-xs font-black transition-all border border-indigo-100 dark:border-indigo-900"
                                    >
                                        إدراج
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Form Submit Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex justify-between items-center border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold">تأكد من مراجعة قيم الفوارق والأساليب المقترحة قبل ترحيل المستودع الكلي.</span>
                <button 
                    onClick={handleFinalizeAndSubmit}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-lg shadow-indigo-600/15 transition-all flex items-center justify-center gap-1.5"
                >
                    <Save size={15} />
                    ترحيل الجرد واعتماد التسويات الآن
                </button>
            </div>
        </div>
    );
}
